/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { bubbleApi } from '@/lib/bubble';
import { memoizarComTtl, CHAVE_CACHE_PACIENTES_BUBBLE, TTL_PACIENTES_BUBBLE_MS } from '@/lib/cache-memoria';
import { obterSessaoCooperado } from '@/lib/sessao-cooperado';
import { getDb } from '@/lib/db/client';
import {
  garantirSchemaD1,
  listarIdsPacientesVinculadosAoCooperado,
  inMemoryPacientes,
  inMemoryAprazamentos,
  inMemoryEvolucoes,
  inMemorySinaisVitais,
  mapearEvolucaoRow,
  obterPacienteClinico,
  listarPrescricoesClinicas,
  gerarSlotsAprazamento,
  deduplicarAprazamentosClinicos,
  normalizarResponsaveisPaciente,
  validarCheckInPlanoTerapeutico,
} from '@/lib/db/prontuarios';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    if (db) {
      await garantirSchemaD1(db);
    }

    // 1. O cooperado vem da SESSÃO, nunca da query string
    const sessao = await obterSessaoCooperado(request);
    if (!sessao) {
      return NextResponse.json(
        { success: false, error: 'Sessão de cooperado ausente ou inválida.' },
        { status: 401 },
      );
    }
    const cooperadoId = sessao.cooperadoId;
    let cooperadoNome = sessao.nome;
    let cooperadoCargo = sessao.cargo;
    let cooperadoCpf = (sessao as any).cpf || '';

    // Se CPF ou dados complementares não vieram no token, tenta enriquecer via Bubble
    if (!cooperadoCpf && cooperadoId) {
      try {
        const bCoop: any = await bubbleApi.getCooperado(cooperadoId);
        if (bCoop) {
          cooperadoCpf = (bCoop.txt_CPF || bCoop.txt_cpf || '').replace(/\D/g, '');
          if (bCoop.txt_nomeCompleto || bCoop.txt_nome) {
            cooperadoNome = (bCoop.txt_nomeCompleto || bCoop.txt_nome).trim();
          }
          if (bCoop.txt_profissao && !cooperadoCargo) {
            cooperadoCargo = bCoop.txt_profissao;
          }
        }
      } catch (e) {
        console.warn('Aviso: enriquecimento de perfil do cooperado via Bubble ignorado:', e);
      }
    }

    const perfilCooperado = {
      id: cooperadoId,
      userId: sessao.userId,
      nome: cooperadoNome,
      cpf: cooperadoCpf,
      cargo: cooperadoCargo,
    };

    // 2. Busca pacientes vinculados via Planos Terapêuticos no D1 ou em memória
    // (compara ID, CPF, normalização fonética/insensível do nome e cota aberta)
    const idsPlanos = await listarIdsPacientesVinculadosAoCooperado(perfilCooperado);

    // 3. Busca serviços legados integrados do Bubble (com tratamento gracioso para não derrubar a rota)
    let idsServicos: string[] = [];
    try {
      if (cooperadoId) {
        const servicos = (await bubbleApi.getServicosByCooperado(sessao.cooperadoId)) as any[];
        idsServicos = (servicos || []).map((s: any) => s.fk_paciente).filter(Boolean);
      }
    } catch (errBubble) {
      console.warn('Aviso: busca de serviços no Bubble falhou ou indisponível:', errBubble);
    }

    // 3b. Inclui pacientes que já possuem evoluções registradas por este cooperado (ex: atendidos via link direto)
    const idsEvoluidos: string[] = [];
    if (cooperadoId) {
      if (db) {
        try {
          const evPacRes = await db
            .prepare('SELECT DISTINCT paciente_id FROM evolucoes WHERE profissional_id = ?')
            .bind(cooperadoId)
            .all<any>();
          for (const row of evPacRes.results || []) {
            if (row?.paciente_id) idsEvoluidos.push(row.paciente_id);
          }
        } catch {}
      }
      for (const ev of Array.from(inMemoryEvolucoes.values())) {
        if (ev.profissional_id === cooperadoId && ev.paciente_id) {
          idsEvoluidos.push(ev.paciente_id);
        }
      }
    }

    // 4. União de todos os IDs de pacientes autorizados
    const idsPermitidos = Array.from(new Set([...idsPlanos, ...idsServicos, ...idsEvoluidos]));

    // Se o cliente pediu um paciente específico (ex: ao abrir diretamente /cooperado/prontuario/[id])
    const { searchParams } = new URL(request.url);
    const rawQueryId = (searchParams.get('paciente_id') || searchParams.get('pacienteId') || '').trim();
    const queryPacienteId = rawQueryId ? decodeURIComponent(rawQueryId).trim() : '';

    let idsAlvo: string[];
    if (queryPacienteId) {
      idsAlvo = [queryPacienteId];
    } else {
      idsAlvo = idsPermitidos;
    }

    if (idsAlvo.length === 0) {
      return NextResponse.json({
        success: true,
        pacientes: [],
        prescricoes: [],
        aprazamentos: [],
        evolucoes: [],
        sinaisVitais: [],
      });
    }

    let dbPacientes: any[] = [];
    let dbPrescricoes: any[] = [];
    let dbAprazamentos: any[] = [];
    let dbEvolucoes: any[] = [];
    let dbSinaisVitais: any[] = [];

    // Busca cache de pacientes do Bubble
    let bubblePacientes: any[] = [];
    try {
      bubblePacientes = ((await memoizarComTtl(
        CHAVE_CACHE_PACIENTES_BUBBLE,
        TTL_PACIENTES_BUBBLE_MS,
        () => bubbleApi.getPacientes()
      )) || []) as any[];
    } catch (err) {
      console.warn('Aviso: cache de pacientes do Bubble indisponível:', err);
    }

    if (db) {
      // Sincroniza/atualiza pacientes do Bubble autorizados no D1 preservando limite_visitas_mes
      for (const bp of bubblePacientes) {
        if (idsAlvo.includes(bp._id)) {
          const warnings = bp.fks_equipamentos?.length > 0 ? ['Possui equipamentos em casa'] : [];
          try {
            await db.prepare(`
              INSERT INTO pacientes (id, nome, cpf, data_nascimento, endereco, warnings)
              VALUES (?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                nome = CASE WHEN excluded.nome != '' AND excluded.nome != 'Paciente Sem Nome' THEN excluded.nome ELSE pacientes.nome END,
                cpf = CASE WHEN excluded.cpf != '' THEN excluded.cpf ELSE pacientes.cpf END,
                endereco = CASE WHEN excluded.endereco != '' THEN excluded.endereco ELSE pacientes.endereco END,
                warnings = excluded.warnings
            `).bind(bp._id, bp.txt_nome || 'Paciente Sem Nome', bp.txt_cpf || '', '', bp.txt_endereco || 'Sem endereço cadastrado', JSON.stringify(warnings)).run();
          } catch (e) {
            console.warn('Aviso ao sincronizar paciente do Bubble no D1:', e);
          }
        }
      }

      // Auto-provisiona qualquer paciente alvo que ainda não esteja no D1
      for (const id of idsAlvo) {
        try {
          const existente = await db.prepare('SELECT id FROM pacientes WHERE id = ?').bind(id).first();
          if (!existente) {
            const bPac = await bubbleApi.getPaciente(id).catch(() => null);
            if (bPac && (bPac._id || bPac.txt_nome)) {
              await db.prepare(`
                INSERT INTO pacientes (id, nome, cpf, data_nascimento, endereco, warnings)
                VALUES (?, ?, ?, ?, ?, ?)
              `).bind(
                id,
                bPac.txt_nome || 'Paciente Sem Nome',
                bPac.txt_cpf || '',
                '',
                bPac.txt_endereco || 'Sem endereço cadastrado',
                JSON.stringify([])
              ).run();
            }
          }
        } catch {}
      }

      const marcadores = idsAlvo.map(() => '?').join(', ');

      const pacientesRes = (
        await db.prepare(`SELECT * FROM pacientes WHERE id IN (${marcadores})`).bind(...idsAlvo).all<any>()
      ).results || [];

      const mesAtualIso = new Date().toISOString().slice(0, 7);

      dbPacientes = await Promise.all(pacientesRes.map(async (p: any) => {
        const limite = Number(p.limite_visitas_mes || 0);
        let realizadas = 0;
        try {
          const countRes: any = await db.prepare(
            "SELECT COUNT(*) as total FROM evolucoes WHERE paciente_id = ? AND strftime('%Y-%m', check_in) = ?"
          ).bind(p.id, mesAtualIso).first();
          realizadas = Number(countRes?.total || 0);
        } catch {}

        const restantes = limite > 0 ? Math.max(0, limite - realizadas) : undefined;
        const atingido = limite > 0 ? realizadas >= limite : false;

        let parsedWarnings: string[] = [];
        try {
          parsedWarnings = p.warnings ? (typeof p.warnings === 'string' ? JSON.parse(p.warnings) : p.warnings) : [];
        } catch {}

        return {
          ...p,
          warnings: parsedWarnings,
          responsaveis: normalizarResponsaveisPaciente(p.responsaveis_json ?? p.responsaveis, p.responsavel_nome, p.responsavel_telefone, p.nome),
          limite_visitas_mes: limite,
          visitas_realizadas_mes: realizadas,
          visitas_restantes_mes: restantes,
          limite_atingido: atingido,
        };
      }));

      // Caso algum paciente não tenha sido encontrado no D1 (ex: falha de DDL ou isolamento), busca fallback
      const idsRetornados = new Set(dbPacientes.map((p) => p.id));
      for (const id of idsAlvo) {
        if (!idsRetornados.has(id)) {
          const bp = bubblePacientes.find((p) => p._id === id);
          if (bp) {
            const nomeBp = bp.txt_nome || 'Paciente Sem Nome';
            dbPacientes.push({
              id: bp._id,
              nome: nomeBp,
              cpf: bp.txt_cpf || '',
              data_nascimento: '',
              endereco: bp.txt_endereco || 'Sem endereço cadastrado',
              warnings: bp.fks_equipamentos?.length > 0 ? ['Possui equipamentos em casa'] : [],
              responsaveis: normalizarResponsaveisPaciente(undefined, undefined, undefined, nomeBp),
              limite_visitas_mes: 0,
              visitas_realizadas_mes: 0,
              visitas_restantes_mes: undefined,
              limite_atingido: false,
            });
          } else {
            const pClinico = await obterPacienteClinico(id).catch(() => null);
            const nomeClinico = pClinico?.nome || 'Paciente Vinculado';
            dbPacientes.push({
              id,
              nome: nomeClinico,
              cpf: pClinico?.cpf || '',
              data_nascimento: pClinico?.data_nascimento || '',
              endereco: pClinico?.endereco || 'Domicílio cadastrado',
              warnings: pClinico?.warnings || [],
              responsaveis: normalizarResponsaveisPaciente(pClinico?.responsaveis, pClinico?.responsavel_nome, pClinico?.responsavel_telefone, nomeClinico),
              limite_visitas_mes: pClinico?.limite_visitas_mes || 0,
              visitas_realizadas_mes: pClinico?.visitas_realizadas_mes || 0,
              visitas_restantes_mes: pClinico?.visitas_restantes_mes,
              limite_atingido: pClinico?.limite_atingido || false,
            });
          }
        }
      }

      dbPrescricoes = (
        await db
          .prepare(`SELECT * FROM prescricoes WHERE paciente_id IN (${marcadores}) ORDER BY created_at DESC`)
          .bind(...idsAlvo)
          .all<any>()
      ).results || [];

      dbPrescricoes = dbPrescricoes.map((p) => {
        let hp = p.horarios_padrao;
        if (typeof hp === 'string') {
          try {
            const parsed = JSON.parse(hp);
            if (Array.isArray(parsed)) hp = parsed;
            else if (typeof parsed === 'string') hp = parsed.split(/[,•]/).map((s: string) => s.trim()).filter(Boolean);
            else hp = [];
          } catch {
            hp = hp.split(/[,•]/).map((s: string) => s.trim()).filter(Boolean);
          }
        }
        if (!Array.isArray(hp) || hp.length === 0) {
          const freq = Number(p.frequencia_horas) || 12;
          if (freq === 24) hp = ['08:00'];
          else if (freq === 12) hp = ['08:00', '20:00'];
          else if (freq === 8) hp = ['08:00', '16:00', '00:00'];
          else if (freq === 6) hp = ['06:00', '12:00', '18:00', '00:00'];
          else if (freq === 4) hp = ['04:00', '08:00', '12:00', '16:00', '20:00', '00:00'];
          else hp = ['08:00', '20:00'];
        }
        return {
          ...p,
          horarios_padrao: Array.isArray(hp) ? hp : [],
        };
      });

      dbAprazamentos = deduplicarAprazamentosClinicos(
        (
          await db
            .prepare(
              `SELECT a.*, p.paciente_id, p.medicamento, p.dosagem, p.via_administracao
                 FROM aprazamentos a
                 JOIN prescricoes p ON p.id = a.prescricao_id
                WHERE p.paciente_id IN (${marcadores})
                ORDER BY a.horario_previsto ASC`
            )
            .bind(...idsAlvo)
            .all<any>()
        ).results || []
      );

      // Garante que prescrições ativas sem slots de aprazamento persistidos tenham slots gerados
      const prescricoesSemApraz = dbPrescricoes.filter((p: any) =>
        (!p.status || p.status === 'Ativa') &&
        !dbAprazamentos.some((a: any) => a.prescricao_id === p.id)
      );

      if (prescricoesSemApraz.length > 0) {
        const novosSlots: any[] = [];
        const insertStmts: any[] = [];
        for (const p of prescricoesSemApraz) {
          const slots = gerarSlotsAprazamento({
            id: p.id,
            paciente_id: p.paciente_id,
            medicamento: p.medicamento,
            dosagem: p.dosagem,
            via_administracao: p.via_administracao,
            frequencia_horas: Number(p.frequencia_horas) || 12,
            data_inicio: p.data_inicio,
            data_fim: p.data_fim,
            horarios_padrao: p.horarios_padrao,
            status: p.status || 'Ativa',
            created_at: p.created_at,
          } as any);

          for (const slot of slots) {
            novosSlots.push({
              ...slot,
              paciente_id: p.paciente_id,
              medicamento: p.medicamento,
              dosagem: p.dosagem,
              via_administracao: p.via_administracao,
            });
            insertStmts.push(
              db.prepare('INSERT OR IGNORE INTO aprazamentos (id, prescricao_id, horario_previsto, status) VALUES (?, ?, ?, ?)')
                .bind(slot.id, slot.prescricao_id, slot.horario_previsto, slot.status)
            );
          }
        }

        if (insertStmts.length > 0) {
          try {
            await db.batch(insertStmts);
          } catch (errBatch) {
            console.warn('Aviso ao persistir slots gerados no D1:', errBatch);
          }
        }

        dbAprazamentos = deduplicarAprazamentosClinicos([...dbAprazamentos, ...novosSlots]);
      }

      // Evoluções e sinais vitais dos pacientes alvo
      try {
        const evoRows = (
          await db
            .prepare(
              `SELECT e.*, pac.nome AS paciente_nome, pac.cpf AS paciente_cpf
                 FROM evolucoes e
                 LEFT JOIN pacientes pac ON pac.id = e.paciente_id
                WHERE e.paciente_id IN (${marcadores})
                ORDER BY e.check_in DESC`
            )
            .bind(...idsAlvo)
            .all<any>()
        ).results || [];

        const svRows = (
          await db
            .prepare(
              `SELECT * FROM sinais_vitais
                WHERE paciente_id IN (${marcadores})
                ORDER BY data_hora DESC LIMIT 100`
            )
            .bind(...idsAlvo)
            .all<any>()
        ).results || [];

        dbSinaisVitais = svRows;
        dbEvolucoes = evoRows.map((r: any) => {
          const ev = mapearEvolucaoRow(r);
          const svVinculados = svRows.filter(
            (sv: any) =>
              sv.evolucao_id === ev.id ||
              (!sv.evolucao_id &&
                sv.paciente_id === ev.paciente_id &&
                sv.data_hora >= ev.check_in &&
                sv.data_hora <= (ev.check_out || new Date().toISOString()))
          );
          return {
            ...ev,
            sinais_vitais: svVinculados,
          };
        });
      } catch (errEvo) {
        console.warn('Aviso ao consultar evoluções na agenda:', errEvo);
      }
    } else {
      // Fallback em memória (para testes / dev sem D1)
      const mesAtualIso = new Date().toISOString().slice(0, 7);
      for (const id of idsAlvo) {
        const pac = inMemoryPacientes.get(id);
        const evolsPac = Array.from(inMemoryEvolucoes.values()).filter((e) => e.paciente_id === id);
        const realizadasMes = evolsPac.filter((e) => e.check_in && e.check_in.startsWith(mesAtualIso)).length;
        if (pac) {
          const limite = pac.limite_visitas_mes || 0;
          dbPacientes.push({
            ...pac,
            warnings: pac.warnings || [],
            responsaveis: normalizarResponsaveisPaciente(pac.responsaveis, pac.responsavel_nome, pac.responsavel_telefone, pac.nome),
            limite_visitas_mes: limite,
            visitas_realizadas_mes: realizadasMes,
            visitas_restantes_mes: limite > 0 ? Math.max(0, limite - realizadasMes) : undefined,
            limite_atingido: limite > 0 ? realizadasMes >= limite : false,
          });
        } else {
          const bp = bubblePacientes.find((p) => p._id === id);
          const nomeBp = bp?.txt_nome || 'Paciente Vinculado';
          dbPacientes.push({
            id,
            nome: nomeBp,
            cpf: bp?.txt_cpf || '',
            data_nascimento: '',
            endereco: bp?.txt_endereco || 'Sem endereço cadastrado',
            warnings: bp?.fks_equipamentos?.length > 0 ? ['Possui equipamentos em casa'] : [],
            responsaveis: normalizarResponsaveisPaciente(undefined, undefined, undefined, nomeBp),
            limite_visitas_mes: 0,
            visitas_realizadas_mes: realizadasMes,
            visitas_restantes_mes: undefined,
            limite_atingido: false,
          });
        }

        const prescs = await listarPrescricoesClinicas(id, false);
        dbPrescricoes.push(...prescs);
      }

      for (const presc of dbPrescricoes) {
        const aprazs = Array.from(inMemoryAprazamentos.values()).filter((a) => a.prescricao_id === presc.id);
        if (aprazs.length === 0) {
          const slots = gerarSlotsAprazamento(presc);
          for (const s of slots) inMemoryAprazamentos.set(s.id, s);
          dbAprazamentos.push(...slots.map((s) => ({
            ...s,
            paciente_id: presc.paciente_id,
            medicamento: presc.medicamento,
            dosagem: presc.dosagem,
            via_administracao: presc.via_administracao,
          })));
        } else {
          dbAprazamentos.push(...aprazs.map((a) => ({
            ...a,
            paciente_id: presc.paciente_id,
            medicamento: presc.medicamento,
            dosagem: presc.dosagem,
            via_administracao: presc.via_administracao,
          })));
        }
      }

      const alvoSet = new Set(idsAlvo);
      dbSinaisVitais = Array.from(inMemorySinaisVitais.values())
        .filter((sv) => alvoSet.has(sv.paciente_id))
        .sort((a, b) => new Date(b.data_hora).getTime() - new Date(a.data_hora).getTime());

      dbEvolucoes = Array.from(inMemoryEvolucoes.values())
        .filter((ev) => alvoSet.has(ev.paciente_id))
        .sort((a, b) => new Date(b.check_in).getTime() - new Date(a.check_in).getTime())
        .map((ev) => {
          const pac = dbPacientes.find((p) => p.id === ev.paciente_id);
          const svVinculados = dbSinaisVitais.filter(
            (sv) =>
              sv.evolucao_id === ev.id ||
              (!sv.evolucao_id &&
                sv.paciente_id === ev.paciente_id &&
                sv.data_hora >= ev.check_in &&
                sv.data_hora <= (ev.check_out || new Date().toISOString()))
          );
          return {
            ...ev,
            paciente_nome: ev.paciente_nome || pac?.nome,
            paciente_cpf: ev.paciente_cpf || pac?.cpf,
            sinais_vitais: svVinculados,
          };
        });
    }

    dbPacientes = await Promise.all(
      dbPacientes.map(async (p: any) => {
        try {
          const validacao = await validarCheckInPlanoTerapeutico({
            pacienteId: p.id,
            tipoProfissional: cooperadoCargo || 'Tecnico_Enfermagem',
            cooperadoId,
            cooperadoNome,
            cooperadoCpf,
            userId: sessao.userId,
          });
          const enriquecido: any = { ...p };
          if (validacao.plano) {
            enriquecido.tem_plano_terapeutico = true;
            enriquecido.plano_vigente = {
              id: validacao.plano.id,
              versao: validacao.plano.versao || 1,
              data_inicio: validacao.plano.data_inicio,
              data_fim: validacao.plano.data_fim,
              total_previsto: validacao.plano.total_previsto ?? 0,
              total_realizado: validacao.plano.total_realizado ?? 0,
              total_restante: validacao.plano.total_restante ?? 0,
              tem_pendencias: Boolean(validacao.plano.tem_pendencias),
            };
          }
          if (validacao.meta) {
            const previstas = Number(validacao.previstas ?? validacao.meta.quantidade_prevista ?? 0);
            const realizadas = Number(validacao.realizadas ?? validacao.meta.quantidade_realizada ?? 0);
            const restantes = Math.max(0, previstas - realizadas);
            enriquecido.especialidade_prevista = previstas;
            enriquecido.especialidade_realizada = realizadas;
            enriquecido.especialidade_restante = restantes;
            if (!enriquecido.limite_visitas_mes || enriquecido.limite_visitas_mes === 0) {
              enriquecido.limite_visitas_mes = previstas;
              enriquecido.visitas_realizadas_mes = realizadas;
              enriquecido.visitas_restantes_mes = restantes;
            }
          }
          if (!validacao.permitido) {
            enriquecido.bloqueio_plano = true;
            enriquecido.bloqueio_plano_motivo = validacao.motivo;
            if (validacao.cotaAtingida) {
              enriquecido.limite_atingido = true;
            }
          } else {
            enriquecido.bloqueio_plano = false;
            enriquecido.bloqueio_plano_motivo = undefined;
          }
          return enriquecido;
        } catch {
          return p;
        }
      })
    );

    return NextResponse.json({
      success: true,
      pacientes: dbPacientes,
      prescricoes: dbPrescricoes,
      aprazamentos: dbAprazamentos,
      evolucoes: dbEvolucoes,
      sinaisVitais: dbSinaisVitais,
    });
  } catch (error: any) {
    console.error('Erro na rota de API de Agenda:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Erro interno ao buscar agenda diária.'
    }, { status: 500 });
  }
}
