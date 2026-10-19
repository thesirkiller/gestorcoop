/* eslint-disable */
import { NextRequest, NextResponse } from 'next/server';
import { bubbleApi } from '@/lib/bubble';

import { gerarSeloAssinatura, obterSessaoCooperado } from '@/lib/sessao-cooperado';
import {
  garantirSchemaD1,
  normalizarEspecialidade,
  validarCheckInPlanoTerapeutico,
  listarIdsPacientesVinculadosAoCooperado,
  inMemoryPacientes,
  inMemoryPrescricoes,
  inMemoryEvolucoes,
  inMemorySinaisVitais,
  inMemoryAprazamentos,
} from '@/lib/db/prontuarios';
import { getDb } from '@/lib/db/client';
import { GET as agendaGet } from '../agenda/route';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

async function gerarSha256Hex(texto: string): Promise<string> {
  const bytes = new TextEncoder().encode(texto);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function gerarSeloSeguro(dados: {
  evolucaoId: string;
  cooperadoId: string;
  instante: string;
  conteudo: string;
}): Promise<string> {
  if (process.env.ASSINATURA_SECRET && process.env.ASSINATURA_SECRET.length >= 32) {
    return gerarSeloAssinatura(dados);
  }
  const segredoFallback =
    process.env.AUTH_JWT_SECRET && process.env.AUTH_JWT_SECRET.length >= 32
      ? process.env.AUTH_JWT_SECRET
      : 'gestorcoop-assinatura-biometrica-default-secret-key-2026';
  const chave = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(segredoFallback),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const mensagem = JSON.stringify([
    'evolucao:v2',
    dados.evolucaoId,
    dados.cooperadoId,
    dados.instante,
    dados.conteudo,
  ]);
  const assinatura = await crypto.subtle.sign('HMAC', chave, new TextEncoder().encode(mensagem));
  return `v2:${Array.from(new Uint8Array(assinatura))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')}`;
}

export async function GET(request: NextRequest) {
  return agendaGet(request);
}

export async function POST(request: NextRequest) {
  try {
    const sessao = await obterSessaoCooperado(request);
    if (!sessao) {
      return NextResponse.json(
        { success: false, error: 'Sessão de cooperado ausente ou inválida.' },
        { status: 401 },
      );
    }

    const { actions } = await request.json();

    if (!Array.isArray(actions)) {
      return NextResponse.json({ success: false, error: 'Formato de ações inválido.' }, { status: 400 });
    }

    const db = getDb();

    if (!db && process.env.NODE_ENV === 'production') {
      console.error('Binding do D1 ausente: recusando a sincronização para não perder registro clínico.');
      return NextResponse.json(
        {
          success: false,
          error: 'Banco de dados indisponível no servidor. Seus registros seguem salvos no aparelho.',
        },
        { status: 503 }
      );
    }

    if (db) {
      await garantirSchemaD1(db);
    }

    const idsPlanos = await listarIdsPacientesVinculadosAoCooperado({ id: sessao.cooperadoId, ...sessao });
    let idsServicos: string[] = [];
    try {
      if (sessao.cooperadoId) {
        const servicos = (await bubbleApi.getServicosByCooperado(sessao.cooperadoId)) as any[];
        idsServicos = (servicos || []).map((servico: any) => servico.fk_paciente).filter(Boolean);
      }
    } catch {}

    const pacientesPermitidos = new Set([...idsPlanos, ...idsServicos]);
    const cachePacientesValidados = new Set<string>();
    const pacientesProvisionadosNoLote = new Set<string>();

    const garantirPacienteExistente = async (pacId: string, pacNome?: string, statementsTarget?: any[]) => {
      if (!pacId || pacientesProvisionadosNoLote.has(pacId)) return;
      pacientesProvisionadosNoLote.add(pacId);
      const nomeFinal = (pacNome || inMemoryPacientes.get(pacId)?.nome || `Paciente #${pacId.slice(0, 8)}`).trim();
      if (!inMemoryPacientes.has(pacId)) {
        inMemoryPacientes.set(pacId, {
          id: pacId,
          nome: nomeFinal,
          cpf: '',
          data_nascimento: '',
          endereco: '',
          warnings: [],
          status: 'Ativo',
        });
      }
      if (db && statementsTarget) {
        statementsTarget.push({
          stmt: db
            .prepare(
              `INSERT OR IGNORE INTO pacientes (id, nome, cpf, data_nascimento, endereco, warnings)
               VALUES (?, ?, '', '', '', '[]')`
            )
            .bind(pacId, nomeFinal),
          tipo: 'PROVISIONAR_PACIENTE',
        });
      }
    };

    const validarPacientePermitido = async (pacId: string): Promise<boolean> => {
      if (!pacId) return false;
      if (pacientesPermitidos.has(pacId) || cachePacientesValidados.has(pacId)) return true;
      let permitido = false;
      if (db) {
        try {
          const presc = await db.prepare('SELECT id FROM prescricoes WHERE paciente_id = ? LIMIT 1').bind(pacId).first();
          if (presc) permitido = true;
          else {
            const pac = await db.prepare('SELECT id FROM pacientes WHERE id = ? LIMIT 1').bind(pacId).first();
            if (pac) permitido = true;
          }
        } catch {}
      } else {
        if (inMemoryPacientes.has(pacId)) permitido = true;
        else {
          for (const p of Array.from(inMemoryPrescricoes.values())) {
            if (p.paciente_id === pacId) {
              permitido = true;
              break;
            }
          }
        }
      }
      if (!permitido) {
        // Verifica se o paciente existe no Bubble ou não possui restrição impeditiva
        try {
          const bPac = await bubbleApi.getPaciente(pacId);
          if (bPac) permitido = true;
        } catch {}
      }
      if (permitido) {
        cachePacientesValidados.add(pacId);
      }
      return permitido;
    };

    const operacoesBatch: Array<{ stmt: any; tipo: string }> = [];
    const evolucoesSincronizadas: any[] = [];
    const checkInsNoLote = new Map<string, any>();
    const evolucoesAssinadasNoLote = new Set<string>();

    const extrairCamposSoap = (payloadSoap: any, transcricaoTexto: string) => {
      let subjetivo = typeof payloadSoap?.soap_subjetivo === 'string' ? payloadSoap.soap_subjetivo.trim() : '';
      let objetivo = typeof payloadSoap?.soap_objetivo === 'string' ? payloadSoap.soap_objetivo.trim() : '';
      let avaliacao = typeof payloadSoap?.soap_avaliacao === 'string' ? payloadSoap.soap_avaliacao.trim() : '';
      let plano = typeof payloadSoap?.soap_plano === 'string' ? payloadSoap.soap_plano.trim() : '';

      if (!subjetivo && !objetivo && !avaliacao && !plano && transcricaoTexto) {
        const regexSecao = /\[([SOAP])(?:\s*-\s*[^\]]+)?\]\s*\n?([\s\S]*?)(?=\n*\[[SOAP](?:\s*-\s*[^\]]+)?\]|$)/gi;
        let match: RegExpExecArray | null;
        while ((match = regexSecao.exec(transcricaoTexto)) !== null) {
          const letra = match[1].toUpperCase();
          const conteudo = match[2].trim();
          if (letra === 'S' && !subjetivo) subjetivo = conteudo;
          else if (letra === 'O' && !objetivo) objetivo = conteudo;
          else if (letra === 'A' && !avaliacao) avaliacao = conteudo;
          else if (letra === 'P' && !plano) plano = conteudo;
        }
      }

      return {
        soap_subjetivo: subjetivo || null,
        soap_objetivo: objetivo || null,
        soap_avaliacao: avaliacao || null,
        soap_plano: plano || null,
      };
    };

    for (const action of actions) {
      const { type, payload } = action || {};
      if (!type || !payload) continue;

      if (type === 'CHECK_IN') {
        const evolucaoId = payload.evolucaoId || payload.id;
        const { pacienteId, pacienteNome, checkIn, tipoProfissional, turno } = payload;
        if (!evolucaoId || !pacienteId) {
          return NextResponse.json({ success: false, error: 'Dados de check-in incompletos.' }, { status: 400 });
        }

        if (!pacientesPermitidos.has(pacienteId) && !(await validarPacientePermitido(pacienteId))) {
          // Permite se não houver plano restritivo bloqueando o cooperado
          const validacaoPreliminar = await validarCheckInPlanoTerapeutico({
            pacienteId,
            tipoProfissional: normalizarEspecialidade(tipoProfissional || sessao.cargo || 'Tecnico_Enfermagem') || 'Tecnico_Enfermagem',
            checkIn: checkIn || new Date().toISOString(),
            cooperadoId: sessao.cooperadoId,
            cooperadoNome: sessao.nome,
            cooperadoCpf: sessao.cpf,
            userId: sessao.userId,
          });
          if (!validacaoPreliminar.permitido) {
            return NextResponse.json({ success: false, error: 'Paciente não vinculado aos serviços deste cooperado.' }, { status: 403 });
          }
          cachePacientesValidados.add(pacienteId);
        }

        const especialidadeSessao =
          normalizarEspecialidade(tipoProfissional || sessao.cargo || 'Tecnico_Enfermagem') ||
          normalizarEspecialidade(sessao.cargo || 'Tecnico_Enfermagem') ||
          'Tecnico_Enfermagem';

        const evolucaoExistente = db
          ? await db.prepare('SELECT id, paciente_id, profissional_id, status FROM evolucoes WHERE id = ?').bind(evolucaoId).first<any>()
          : inMemoryEvolucoes.get(evolucaoId);

        if (evolucaoExistente && (evolucaoExistente.paciente_id !== pacienteId || evolucaoExistente.profissional_id !== sessao.cooperadoId)) {
          return NextResponse.json({ success: false, error: 'Atendimento pertence a outro paciente ou profissional.' }, { status: 403 });
        }

        if (!evolucaoExistente) {
          const validacao = await validarCheckInPlanoTerapeutico({
            pacienteId,
            tipoProfissional: especialidadeSessao,
            checkIn: checkIn || new Date().toISOString(),
            cooperadoId: sessao.cooperadoId,
            cooperadoNome: sessao.nome,
            cooperadoCpf: sessao.cpf,
            userId: sessao.userId,
          });

          if (!validacao.permitido) {
            return NextResponse.json(
              {
                success: false,
                error: validacao.motivo || 'Atendimento bloqueado pelas regras do Plano Terapêutico.',
                cotaAtingida: !!validacao.cotaAtingida,
                limite: validacao.previstas,
                realizadas: validacao.realizadas,
                meta: validacao.meta,
                plano: validacao.plano,
              },
              { status: 403 }
            );
          }
        }

        await garantirPacienteExistente(pacienteId, pacienteNome, operacoesBatch);

        const checkInIso = checkIn || new Date().toISOString();
        const nomeProfissional = sessao.nome || payload.profissionalNome || 'Profissional Cooperado';

        checkInsNoLote.set(evolucaoId, {
          id: evolucaoId,
          paciente_id: pacienteId,
          profissional_id: sessao.cooperadoId,
          profissional_nome: nomeProfissional,
          tipo_profissional: especialidadeSessao,
          turno: turno || null,
          check_in: checkInIso,
        });

        if (!inMemoryEvolucoes.has(evolucaoId)) {
          inMemoryEvolucoes.set(evolucaoId, {
            id: evolucaoId,
            paciente_id: pacienteId,
            profissional_id: sessao.cooperadoId,
            profissional_nome: nomeProfissional,
            tipo_profissional: especialidadeSessao,
            turno: turno || undefined,
            check_in: checkInIso,
            check_out: '',
            transcricao_revisada: '',
            status: 'Em_Andamento',
          });
        }

        if (db) {
          operacoesBatch.push({
            tipo: 'CHECK_IN',
            stmt: db
              .prepare(
                `INSERT OR IGNORE INTO evolucoes (id, paciente_id, profissional_id, profissional_nome, tipo_profissional, turno, check_in, check_out, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, '', 'Em_Andamento')`
              )
              .bind(
                evolucaoId,
                pacienteId,
                sessao.cooperadoId,
                nomeProfissional,
                especialidadeSessao,
                turno || null,
                checkInIso
              ),
          });
        }
      }

      else if (type === 'CHECK_MEDICAMENTO') {
        const { aprazamentoId, status, horario_executado, justificativa, horario_previsto } = payload;
        const aprazamento = db
          ? await db
              .prepare(
                'SELECT a.id, p.id as prescricao_id, p.paciente_id FROM aprazamentos a JOIN prescricoes p ON p.id = a.prescricao_id WHERE a.id = ?'
              )
              .bind(aprazamentoId)
              .first<any>()
          : inMemoryAprazamentos.get(aprazamentoId);

        let prescricaoId = payload.prescricaoId || aprazamento?.prescricao_id;
        if (!aprazamento && !prescricaoId && typeof aprazamentoId === 'string' && aprazamentoId.startsWith('apraz_')) {
          const partes = aprazamentoId.split('_');
          if (partes.length >= 2) {
            prescricaoId = partes[1];
          }
        }

        let pacienteId = aprazamento?.paciente_id || payload.pacienteId;
        if (!pacienteId && prescricaoId) {
          const presc = db
            ? await db.prepare('SELECT id, paciente_id FROM prescricoes WHERE id = ?').bind(prescricaoId).first<any>()
            : inMemoryPrescricoes.get(prescricaoId);
          if (presc) {
            pacienteId = presc.paciente_id;
          }
        }

        if (!pacienteId || (!pacientesPermitidos.has(pacienteId) && !(await validarPacientePermitido(pacienteId)))) {
          return NextResponse.json({ success: false, error: 'Medicação fora dos pacientes autorizados.' }, { status: 403 });
        }

        const selo =
          status === 'Administrado'
            ? await gerarSeloSeguro({
                evolucaoId: aprazamentoId,
                cooperadoId: sessao.cooperadoId,
                instante: horario_executado || new Date().toISOString(),
                conteudo: `${status}|${justificativa || ''}`,
              })
            : null;

        const previsto = horario_previsto || horario_executado || new Date().toISOString();
        inMemoryAprazamentos.set(aprazamentoId, {
          ...(inMemoryAprazamentos.get(aprazamentoId) || {}),
          id: aprazamentoId,
          prescricao_id: prescricaoId || '',
          paciente_id: pacienteId,
          horario_previsto: previsto,
          horario_executado: horario_executado || undefined,
          status: status as any,
          justificativa: justificativa || undefined,
          profissional_id: sessao.cooperadoId,
          assinatura_digital: selo || undefined,
        });

        if (db) {
          if (aprazamento) {
            operacoesBatch.push({
              tipo: 'CHECK_MEDICAMENTO',
              stmt: db
                .prepare(
                  `UPDATE aprazamentos
                   SET status = ?, horario_executado = ?, profissional_id = ?, justificativa = ?, assinatura_digital = ?
                   WHERE id = ?`
                )
                .bind(
                  status,
                  horario_executado,
                  sessao.cooperadoId,
                  justificativa || null,
                  selo,
                  aprazamentoId
                ),
            });
          } else if (prescricaoId) {
            operacoesBatch.push({
              tipo: 'CHECK_MEDICAMENTO',
              stmt: db
                .prepare(
                  `INSERT INTO aprazamentos (id, prescricao_id, horario_previsto, horario_executado, status, justificativa, profissional_id, assinatura_digital)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                   ON CONFLICT(id) DO UPDATE SET
                     status = excluded.status,
                     horario_executado = excluded.horario_executado,
                     profissional_id = excluded.profissional_id,
                     justificativa = excluded.justificativa,
                     assinatura_digital = excluded.assinatura_digital`
                )
                .bind(
                  aprazamentoId,
                  prescricaoId,
                  previsto,
                  horario_executado,
                  status,
                  justificativa || null,
                  sessao.cooperadoId,
                  selo
                ),
            });
          }
        }
      }

      else if (type === 'REGISTRAR_SINAIS_VITAIS') {
        const {
          id: sinalId,
          pacienteId,
          pacienteNome,
          evolucaoId,
          data_hora,
          pa_sistolica,
          pa_diastolica,
          fc_bpm,
          fr_rpm,
          temp_celsius,
          spo2_percent,
          glicemia_mg_dl,
          dor_escala,
          nivel_consciencia,
          observacoes,
        } = payload;

        const checkInNoLoteParaPaciente = actions.some(
          (a: any) => (a.type === 'CHECK_IN' || a.type === 'SIGN_EVOLUCAO') && (a.payload?.pacienteId === pacienteId || a.payload?.paciente_id === pacienteId)
        );
        const evolucaoDoProfissional = db
          ? await db.prepare('SELECT id FROM evolucoes WHERE paciente_id = ? AND profissional_id = ? LIMIT 1').bind(pacienteId, sessao.cooperadoId).first()
          : Array.from(inMemoryEvolucoes.values()).find((e) => e.paciente_id === pacienteId && e.profissional_id === sessao.cooperadoId);
        const pacienteAutorizado =
          pacientesPermitidos.has(pacienteId) ||
          checkInNoLoteParaPaciente ||
          !!evolucaoDoProfissional ||
          (await validarPacientePermitido(pacienteId));

        if (!pacienteId || !pacienteAutorizado) {
          return NextResponse.json({ success: false, error: 'Sinais vitais fora dos pacientes autorizados.' }, { status: 403 });
        }

        let evolucaoValida: string | null = null;
        if (evolucaoId) {
          const checkInNoLote =
            checkInsNoLote.has(evolucaoId) ||
            actions.some(
              (a: any) =>
                (a.type === 'CHECK_IN' || a.type === 'SIGN_EVOLUCAO') &&
                (a.payload?.evolucaoId === evolucaoId || a.payload?.id === evolucaoId)
            );
          const evolucaoDb = db
            ? await db.prepare('SELECT id FROM evolucoes WHERE id = ? AND paciente_id = ? AND profissional_id = ?').bind(evolucaoId, pacienteId, sessao.cooperadoId).first()
            : inMemoryEvolucoes.get(evolucaoId);
          if (!checkInNoLote && !evolucaoDb) {
            return NextResponse.json({ success: false, error: 'Evolução informada não pertence ao paciente ou ao cooperado.' }, { status: 403 });
          }
          evolucaoValida = evolucaoId;
        }

        await garantirPacienteExistente(pacienteId, pacienteNome, operacoesBatch);

        const idFinal = sinalId || `sv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const agora = new Date().toISOString();
        const nomeProfissional = sessao.nome || 'Profissional Cooperado';

        const sinalObj = {
          id: idFinal,
          paciente_id: pacienteId,
          evolucao_id: evolucaoValida || undefined,
          data_hora: data_hora || agora,
          pa_sistolica: pa_sistolica ? Number(pa_sistolica) : undefined,
          pa_diastolica: pa_diastolica ? Number(pa_diastolica) : undefined,
          fc_bpm: fc_bpm ? Number(fc_bpm) : undefined,
          fr_rpm: fr_rpm ? Number(fr_rpm) : undefined,
          temp_celsius: temp_celsius ? Number(temp_celsius) : undefined,
          spo2_percent: spo2_percent ? Number(spo2_percent) : undefined,
          glicemia_mg_dl: glicemia_mg_dl ? Number(glicemia_mg_dl) : undefined,
          dor_escala: dor_escala !== undefined && dor_escala !== '' && dor_escala !== null ? Number(dor_escala) : undefined,
          nivel_consciencia: nivel_consciencia || undefined,
          observacoes: observacoes || '',
          profissional_id: sessao.cooperadoId,
          profissional_nome: nomeProfissional,
        };
        inMemorySinaisVitais.set(idFinal, sinalObj);

        if (db) {
          operacoesBatch.push({
            tipo: 'REGISTRAR_SINAIS_VITAIS',
            stmt: db
              .prepare(
                `INSERT INTO sinais_vitais (
                  id, paciente_id, evolucao_id, data_hora, pa_sistolica, pa_diastolica,
                  fc_bpm, fr_rpm, temp_celsius, spo2_percent, glicemia_mg_dl,
                  dor_escala, nivel_consciencia, observacoes, profissional_id, profissional_nome, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  pa_sistolica = excluded.pa_sistolica,
                  pa_diastolica = excluded.pa_diastolica,
                  fc_bpm = excluded.fc_bpm,
                  fr_rpm = excluded.fr_rpm,
                  temp_celsius = excluded.temp_celsius,
                  spo2_percent = excluded.spo2_percent,
                  glicemia_mg_dl = excluded.glicemia_mg_dl,
                  dor_escala = excluded.dor_escala,
                  nivel_consciencia = excluded.nivel_consciencia,
                  observacoes = excluded.observacoes
                WHERE sinais_vitais.profissional_id = excluded.profissional_id`
              )
              .bind(
                idFinal,
                pacienteId,
                evolucaoValida,
                data_hora || agora,
                pa_sistolica ? Number(pa_sistolica) : null,
                pa_diastolica ? Number(pa_diastolica) : null,
                fc_bpm ? Number(fc_bpm) : null,
                fr_rpm ? Number(fr_rpm) : null,
                temp_celsius ? Number(temp_celsius) : null,
                spo2_percent ? Number(spo2_percent) : null,
                glicemia_mg_dl ? Number(glicemia_mg_dl) : null,
                dor_escala !== undefined && dor_escala !== '' && dor_escala !== null ? Number(dor_escala) : null,
                nivel_consciencia || null,
                observacoes || '',
                sessao.cooperadoId,
                nomeProfissional,
                agora
              ),
          });
        }
      }

      else if (type === 'SIGN_EVOLUCAO' || type === 'CHECK_OUT' || type === 'SALVAR_EVOLUCAO') {
        const evolucaoId = payload.evolucaoId || payload.id;
        const { checkOut, transcricao_revisada } = payload;
        if (!evolucaoId) {
          return NextResponse.json({ success: false, error: 'ID da evolução ausente para assinatura.' }, { status: 400 });
        }

        const evolucaoDb = db
          ? await db
              .prepare(
                'SELECT id, paciente_id, profissional_id, profissional_nome, tipo_profissional, turno, check_in, check_out, transcricao_revisada, status, data_assinatura, assinatura_digital, responsavel_id, responsavel_nome, responsavel_parentesco FROM evolucoes WHERE id = ?'
              )
              .bind(evolucaoId)
              .first<any>()
          : inMemoryEvolucoes.get(evolucaoId);

        const checkInLote = checkInsNoLote.get(evolucaoId);
        const checkInAcao = actions.find(
          (acao: any) => acao.type === 'CHECK_IN' && (acao.payload?.evolucaoId === evolucaoId || acao.payload?.id === evolucaoId)
        );
        const pacienteIdResolvido =
          evolucaoDb?.paciente_id ||
          checkInLote?.paciente_id ||
          checkInAcao?.payload?.pacienteId ||
          payload.pacienteId ||
          payload.paciente_id;

        let pacPermitido = false;
        if (pacienteIdResolvido) {
          pacPermitido =
            pacientesPermitidos.has(pacienteIdResolvido) ||
            cachePacientesValidados.has(pacienteIdResolvido) ||
            (await validarPacientePermitido(pacienteIdResolvido));
          if (!pacPermitido) {
            const validacaoPlano = await validarCheckInPlanoTerapeutico({
              pacienteId: pacienteIdResolvido,
              tipoProfissional:
                normalizarEspecialidade(
                  payload.tipoProfissional ||
                    payload.tipo_profissional ||
                    checkInLote?.tipo_profissional ||
                    sessao.cargo ||
                    'Tecnico_Enfermagem'
                ) || 'Tecnico_Enfermagem',
              checkIn: payload.checkIn || checkInLote?.check_in || new Date().toISOString(),
              cooperadoId: sessao.cooperadoId,
              cooperadoNome: sessao.nome,
              cooperadoCpf: sessao.cpf,
              userId: sessao.userId,
            });
            if (validacaoPlano.permitido) {
              pacPermitido = true;
              cachePacientesValidados.add(pacienteIdResolvido);
            }
          }
        }

        if (
          !pacienteIdResolvido ||
          !pacPermitido ||
          (evolucaoDb && evolucaoDb.profissional_id !== sessao.cooperadoId)
        ) {
          return NextResponse.json({ success: false, error: 'Atendimento fora dos pacientes autorizados.' }, { status: 403 });
        }

        // Se a evolução já está Finalizada/Auditada no banco ou já foi assinada neste mesmo lote,
        // não executa novo UPDATE para não acionar o trigger evolucao_finalizada_imutavel
        if (
          evolucoesAssinadasNoLote.has(evolucaoId) ||
          (evolucaoDb && (evolucaoDb.status === 'Finalizado' || evolucaoDb.status === 'Auditado'))
        ) {
          if (evolucaoDb && !evolucoesAssinadasNoLote.has(evolucaoId)) {
            evolucoesSincronizadas.push(evolucaoDb);
          }
          evolucoesAssinadasNoLote.add(evolucaoId);
          continue;
        }
        evolucoesAssinadasNoLote.add(evolucaoId);

        const biometriaObj = payload.assinatura_biometrica || {};
        const biometriaHashRaw = String(
          payload.biometria_hash ||
            payload.biometriaHash ||
            biometriaObj.biometriaHash ||
            ''
        ).trim();
        const metodoRaw = String(
          payload.metodo_assinatura ||
            biometriaObj.metodo ||
            (biometriaHashRaw ? 'FACIAL' : 'PIN_FALLBACK')
        )
          .trim()
          .toUpperCase();
        const metodoAssinatura = metodoRaw === 'PIN_FALLBACK' ? 'PIN_FALLBACK' : 'FACIAL';
        const biometriaTimestamp = String(
          payload.biometria_timestamp ||
            biometriaObj.timestamp ||
            checkOut ||
            new Date().toISOString()
        ).trim();
        const cooperadoIdentificador = String(
          sessao.cpf ||
            payload.cooperado_identificador ||
            biometriaObj.cooperadoIdentificador ||
            sessao.cooperadoId
        )
          .trim()
          .replace(/[:|]/g, '_');

        const responsavelId = String(
          payload.responsavel_id ||
            payload.responsavelId ||
            biometriaObj.responsavelId ||
            evolucaoDb?.responsavel_id ||
            ''
        ).trim();
        const responsavelNome = String(
          payload.responsavel_nome ||
            payload.responsavelNome ||
            biometriaObj.responsavelNome ||
            evolucaoDb?.responsavel_nome ||
            ''
        ).trim();
        const responsavelParentesco = String(
          payload.responsavel_parentesco ||
            payload.responsavelParentesco ||
            biometriaObj.responsavelParentesco ||
            evolucaoDb?.responsavel_parentesco ||
            ''
        ).trim();

        const checkOutFinal = String(checkOut || biometriaTimestamp).trim();
        let transcricaoFinal = typeof transcricao_revisada === 'string' ? transcricao_revisada : '';
        if (!transcricaoFinal && (payload.soap_subjetivo || payload.soap_objetivo || payload.soap_avaliacao || payload.soap_plano)) {
          transcricaoFinal = [
            payload.soap_subjetivo ? `[S - Subjetivo]\n${payload.soap_subjetivo}` : '',
            payload.soap_objetivo ? `[O - Objetivo]\n${payload.soap_objetivo}` : '',
            payload.soap_avaliacao ? `[A - Avaliação]\n${payload.soap_avaliacao}` : '',
            payload.soap_plano ? `[P - Plano]\n${payload.soap_plano}` : '',
          ]
            .filter(Boolean)
            .join('\n\n');
        }

        const camposSoap = extrairCamposSoap(payload, transcricaoFinal);

        const biometriaHashFinal = /^[a-f0-9]{64}$/i.test(biometriaHashRaw)
          ? biometriaHashRaw.toLowerCase()
          : await gerarSha256Hex(
              `facial:v1|${cooperadoIdentificador}|${evolucaoId}|${biometriaTimestamp}|${
                biometriaHashRaw || `PIN_FALLBACK:${payload.pinCode || '1234'}`
              }`
            );

        const conteudoComBiometria = `${transcricaoFinal}|metodo=${metodoAssinatura}|sha256=${biometriaHashFinal}|coop=${cooperadoIdentificador}|ts=${biometriaTimestamp}${responsavelNome ? `|resp=${responsavelNome}` : ''}`;
        const seloHmac = await gerarSeloSeguro({
          evolucaoId,
          cooperadoId: sessao.cooperadoId,
          instante: checkOutFinal,
          conteudo: conteudoComBiometria,
        });

        const selo = `v2:bio:${metodoAssinatura.toLowerCase()}:sha256=${biometriaHashFinal}:coop=${cooperadoIdentificador}:ts=${biometriaTimestamp}:${seloHmac.replace(/^v2:/, '')}`;

        const nomeProfissional =
          evolucaoDb?.profissional_nome ||
          checkInLote?.profissional_nome ||
          sessao.nome ||
          payload.profissionalNome ||
          'Profissional Cooperado';
        const especialidadeFinal =
          evolucaoDb?.tipo_profissional ||
          checkInLote?.tipo_profissional ||
          normalizarEspecialidade(payload.tipoProfissional || payload.tipo_profissional || sessao.cargo || 'Tecnico_Enfermagem') ||
          'Tecnico_Enfermagem';
        const turnoFinal = evolucaoDb?.turno || checkInLote?.turno || payload.turno || null;
        const checkInFinal = evolucaoDb?.check_in || checkInLote?.check_in || payload.checkIn || checkOutFinal;

        await garantirPacienteExistente(pacienteIdResolvido, payload.pacienteNome || payload.paciente_nome, operacoesBatch);

        const evolucaoFinalizadaObj = {
          id: evolucaoId,
          paciente_id: pacienteIdResolvido,
          paciente_nome: payload.pacienteNome || payload.paciente_nome || inMemoryPacientes.get(pacienteIdResolvido)?.nome,
          profissional_id: sessao.cooperadoId,
          profissional_nome: nomeProfissional,
          tipo_profissional: especialidadeFinal,
          turno: turnoFinal || undefined,
          check_in: checkInFinal,
          check_out: checkOutFinal,
          transcricao_revisada: transcricaoFinal,
          soap_subjetivo: camposSoap.soap_subjetivo || undefined,
          soap_objetivo: camposSoap.soap_objetivo || undefined,
          soap_avaliacao: camposSoap.soap_avaliacao || undefined,
          soap_plano: camposSoap.soap_plano || undefined,
          status: 'Finalizado' as const,
          data_assinatura: checkOutFinal,
          assinatura_digital: selo,
          responsavel_id: responsavelId || undefined,
          responsavel_nome: responsavelNome || undefined,
          responsavel_parentesco: responsavelParentesco || undefined,
        };

        inMemoryEvolucoes.set(evolucaoId, evolucaoFinalizadaObj);
        evolucoesSincronizadas.push(evolucaoFinalizadaObj);

        if (db) {
          if (evolucaoDb || checkInLote) {
            operacoesBatch.push({
              tipo: 'SIGN_EVOLUCAO',
              stmt: db
                .prepare(
                  `UPDATE evolucoes
                   SET check_out = ?, transcricao_revisada = ?, soap_subjetivo = COALESCE(?, soap_subjetivo), soap_objetivo = COALESCE(?, soap_objetivo), soap_avaliacao = COALESCE(?, soap_avaliacao), soap_plano = COALESCE(?, soap_plano), status = 'Finalizado', data_assinatura = ?, assinatura_digital = ?, profissional_nome = COALESCE(NULLIF(profissional_nome, ''), ?), responsavel_id = COALESCE(NULLIF(?, ''), responsavel_id), responsavel_nome = COALESCE(NULLIF(?, ''), responsavel_nome), responsavel_parentesco = COALESCE(NULLIF(?, ''), responsavel_parentesco)
                   WHERE id = ? AND profissional_id = ?`
                )
                .bind(
                  checkOutFinal,
                  transcricaoFinal,
                  camposSoap.soap_subjetivo,
                  camposSoap.soap_objetivo,
                  camposSoap.soap_avaliacao,
                  camposSoap.soap_plano,
                  checkOutFinal,
                  selo,
                  nomeProfissional,
                  responsavelId || null,
                  responsavelNome || null,
                  responsavelParentesco || null,
                  evolucaoId,
                  sessao.cooperadoId
                ),
            });
          } else {
            // Evolução ainda não existia no D1 nem veio CHECK_IN separado no lote: insere já finalizada
            operacoesBatch.push({
              tipo: 'SIGN_EVOLUCAO_INSERT',
              stmt: db
                .prepare(
                  `INSERT INTO evolucoes (
                    id, paciente_id, profissional_id, profissional_nome, tipo_profissional,
                    turno, check_in, check_out, transcricao_revisada,
                    soap_subjetivo, soap_objetivo, soap_avaliacao, soap_plano,
                    status, data_assinatura, assinatura_digital,
                    responsavel_id, responsavel_nome, responsavel_parentesco
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Finalizado', ?, ?, ?, ?, ?)`
                )
                .bind(
                  evolucaoId,
                  pacienteIdResolvido,
                  sessao.cooperadoId,
                  nomeProfissional,
                  especialidadeFinal,
                  turnoFinal,
                  checkInFinal,
                  checkOutFinal,
                  transcricaoFinal,
                  camposSoap.soap_subjetivo,
                  camposSoap.soap_objetivo,
                  camposSoap.soap_avaliacao,
                  camposSoap.soap_plano,
                  checkOutFinal,
                  selo,
                  responsavelId || null,
                  responsavelNome || null,
                  responsavelParentesco || null
                ),
            });
          }
        }
      } else {
        return NextResponse.json({ success: false, error: `Ação de sincronização não suportada: ${type}` }, { status: 400 });
      }
    }

    if (db && operacoesBatch.length > 0) {
      const statements = operacoesBatch.map((op) => op.stmt);
      const resultados = await db.batch(statements);
      const falha = resultados.some((resultado, index) => {
        const tipo = operacoesBatch[index].tipo;
        if (!resultado.success) return true;
        if (
          tipo !== 'CHECK_IN' &&
          tipo !== 'PROVISIONAR_PACIENTE' &&
          typeof resultado.meta?.changes === 'number' &&
          resultado.meta.changes === 0
        ) {
          return true;
        }
        return false;
      });

      if (falha) {
        return NextResponse.json(
          {
            success: false,
            error: 'Uma ou mais ações não foram gravadas. Os registros permanecem pendentes no aparelho.',
          },
          { status: 409 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      syncedCount: actions.length,
      evolucoes: evolucoesSincronizadas,
    });
  } catch (error: any) {
    console.error('Erro na rota de API de Sync:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Erro interno no servidor ao processar sincronização.',
      },
      { status: 500 }
    );
  }
}
