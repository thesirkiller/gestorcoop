/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { bubbleApi } from '@/lib/bubble';
import { memoizarComTtl, CHAVE_CACHE_PACIENTES_BUBBLE, TTL_PACIENTES_BUBBLE_MS } from '@/lib/cache-memoria';
import { obterSessaoCooperado } from '@/lib/sessao-cooperado';
import { getDb } from '@/lib/db/client';
import {
  listarIdsPacientesVinculadosAoCooperado,
  inMemoryPacientes,
  inMemoryAprazamentos,
  obterPacienteClinico,
  listarPrescricoesClinicas,
  gerarSlotsAprazamento,
} from '@/lib/db/prontuarios';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    const db = getDb();

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
        const servicos = (await bubbleApi.getServicosByCooperado(cooperadoId)) as any[];
        idsServicos = (servicos || []).map((s: any) => s.fk_paciente).filter(Boolean);
      }
    } catch (errBubble) {
      console.warn('Aviso: busca de serviços no Bubble falhou ou indisponível:', errBubble);
    }

    // 4. União de todos os IDs de pacientes autorizados
    const idsPermitidos = Array.from(new Set([...idsPlanos, ...idsServicos]));

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
      return NextResponse.json({ success: true, pacientes: [], prescricoes: [], aprazamentos: [] });
    }

    let dbPacientes: any[] = [];
    let dbPrescricoes: any[] = [];
    let dbAprazamentos: any[] = [];

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
            dbPacientes.push({
              id: bp._id,
              nome: bp.txt_nome || 'Paciente Sem Nome',
              cpf: bp.txt_cpf || '',
              data_nascimento: '',
              endereco: bp.txt_endereco || 'Sem endereço cadastrado',
              warnings: bp.fks_equipamentos?.length > 0 ? ['Possui equipamentos em casa'] : [],
              limite_visitas_mes: 0,
              visitas_realizadas_mes: 0,
              visitas_restantes_mes: undefined,
              limite_atingido: false,
            });
          } else {
            const pClinico = await obterPacienteClinico(id).catch(() => null);
            dbPacientes.push({
              id,
              nome: pClinico?.nome || 'Paciente Vinculado',
              cpf: pClinico?.cpf || '',
              data_nascimento: pClinico?.data_nascimento || '',
              endereco: pClinico?.endereco || 'Domicílio cadastrado',
              warnings: pClinico?.warnings || [],
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

      dbAprazamentos = (
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
      ).results || [];

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

        dbAprazamentos.push(...novosSlots);
      }
    } else {
      // Fallback em memória (para testes / dev sem D1)
      for (const id of idsAlvo) {
        const pac = inMemoryPacientes.get(id);
        if (pac) {
          dbPacientes.push({
            ...pac,
            warnings: pac.warnings || [],
            limite_visitas_mes: pac.limite_visitas_mes || 0,
            visitas_realizadas_mes: 0,
            visitas_restantes_mes: pac.limite_visitas_mes,
            limite_atingido: false,
          });
        } else {
          const bp = bubblePacientes.find((p) => p._id === id);
          dbPacientes.push({
            id,
            nome: bp?.txt_nome || 'Paciente Vinculado',
            cpf: bp?.txt_cpf || '',
            data_nascimento: '',
            endereco: bp?.txt_endereco || 'Sem endereço cadastrado',
            warnings: bp?.fks_equipamentos?.length > 0 ? ['Possui equipamentos em casa'] : [],
            limite_visitas_mes: 0,
            visitas_realizadas_mes: 0,
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
    }

    return NextResponse.json({
      success: true,
      pacientes: dbPacientes,
      prescricoes: dbPrescricoes,
      aprazamentos: dbAprazamentos,
    });
  } catch (error: any) {
    console.error('Erro na rota de API de Agenda:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Erro interno ao buscar agenda diária.'
    }, { status: 500 });
  }
}
