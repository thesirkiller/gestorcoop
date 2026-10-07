/* eslint-disable */
import { NextRequest, NextResponse } from 'next/server';
import { bubbleApi } from '@/lib/bubble';

import { gerarSeloAssinatura, obterSessaoCooperado } from '@/lib/sessao-cooperado';
import { normalizarEspecialidade, validarCheckInPlanoTerapeutico } from '@/lib/db/prontuarios';
import { getDb } from '@/lib/db/client';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function POST(request: NextRequest) {
  try {
    // Identidade pela sessão. O `profissionalId` que vinha no payload era
    // ignorável e caía num `|| 'coop_123'` fixo: todo registro clínico do
    // sistema era atribuído à mesma pessoa inexistente.
    const sessao = await obterSessaoCooperado();
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

    if (!db) {
      // NÃO devolva sucesso aqui. O cliente apaga a fila local ao receber
      // `success: true` (ver sync-service.ts), então responder OK sem gravar
      // destrói o plantão inteiro do profissional exibindo "sincronizado".
      console.error('Binding do D1 ausente: recusando a sincronização para não perder registro clínico.');
      return NextResponse.json(
        {
          success: false,
          error: 'Banco de dados indisponível no servidor. Seus registros seguem salvos no aparelho.',
        },
        { status: 503 }
      );
    }

    const servicos = await bubbleApi.getServicosByCooperado(sessao.cooperadoId);
    const pacientesPermitidos = new Set(servicos.map((servico: any) => servico.fk_paciente).filter(Boolean));

    const statements: any[] = [];
    const tipos: string[] = [];

    for (const action of actions) {
      const { type, payload } = action;

      if (type === 'CHECK_IN') {
        const { evolucaoId, pacienteId, checkIn, tipoProfissional, turno } = payload;
        if (!pacientesPermitidos.has(pacienteId)) {
          return NextResponse.json({ success: false, error: 'Paciente não vinculado aos serviços deste cooperado.' }, { status: 403 });
        }
        const especialidadeSessao = normalizarEspecialidade(sessao.cargo || '');
        if (!especialidadeSessao || normalizarEspecialidade(tipoProfissional || '') !== especialidadeSessao) {
          return NextResponse.json({ success: false, error: 'Especialidade do atendimento difere da sessão do cooperado.' }, { status: 403 });
        }

        // Verificar se é uma nova evolução ou re-envio de uma existente
        const evolucaoExistente = await db.prepare('SELECT id, paciente_id, profissional_id FROM evolucoes WHERE id = ?').bind(evolucaoId).first<any>();
        if (evolucaoExistente && (evolucaoExistente.paciente_id !== pacienteId || evolucaoExistente.profissional_id !== sessao.cooperadoId)) {
          return NextResponse.json({ success: false, error: 'Atendimento pertence a outro paciente ou profissional.' }, { status: 403 });
        }

        if (!evolucaoExistente) {
          // Validação estrita por especialidade e período no Plano Terapêutico (ou cota legada)
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

        // INSERT OR IGNORE: garante idempotência
        tipos.push(type);
        statements.push(
          db.prepare(
            `INSERT OR IGNORE INTO evolucoes (id, paciente_id, profissional_id, tipo_profissional, turno, check_in, check_out, status)
             VALUES (?, ?, ?, ?, ?, ?, '', 'Em_Andamento')`
          ).bind(
            evolucaoId,
            pacienteId,
            sessao.cooperadoId,
            especialidadeSessao,
            turno || null,
            checkIn
          )
        );
      }

      else if (type === 'CHECK_MEDICAMENTO') {
        const { aprazamentoId, status, horario_executado, justificativa } = payload;
        const aprazamento = await db.prepare('SELECT p.paciente_id FROM aprazamentos a JOIN prescricoes p ON p.id = a.prescricao_id WHERE a.id = ?').bind(aprazamentoId).first<any>();
        if (!aprazamento || !pacientesPermitidos.has(aprazamento.paciente_id)) {
          return NextResponse.json({ success: false, error: 'Medicação fora dos pacientes autorizados.' }, { status: 403 });
        }

        const selo =
          status === 'Administrado'
            ? await gerarSeloAssinatura({
                evolucaoId: aprazamentoId,
                cooperadoId: sessao.cooperadoId,
                instante: horario_executado,
                conteudo: `${status}|${justificativa || ''}`,
              })
            : null;

        tipos.push(type);
        statements.push(
          db.prepare(
            `UPDATE aprazamentos
             SET status = ?, horario_executado = ?, profissional_id = ?, justificativa = ?, assinatura_digital = ?
             WHERE id = ?`
          ).bind(
            status,
            horario_executado,
            sessao.cooperadoId,
            justificativa || null,
            selo,
            aprazamentoId
          )
        );
      }

      else if (type === 'SIGN_EVOLUCAO') {
        const { evolucaoId, checkOut, transcricao_revisada } = payload;
        const evolucao = await db.prepare('SELECT paciente_id, profissional_id FROM evolucoes WHERE id = ?').bind(evolucaoId).first<any>();
        const checkInNoLote = actions.some((acao: any) => acao.type === 'CHECK_IN' && acao.payload?.evolucaoId === evolucaoId && pacientesPermitidos.has(acao.payload?.pacienteId));
        if ((!evolucao && !checkInNoLote) ||
            (evolucao && (evolucao.profissional_id !== sessao.cooperadoId || !pacientesPermitidos.has(evolucao.paciente_id)))) {
          return NextResponse.json({ success: false, error: 'Atendimento fora dos pacientes autorizados.' }, { status: 403 });
        }

        const selo = await gerarSeloAssinatura({
          evolucaoId,
          cooperadoId: sessao.cooperadoId,
          instante: checkOut,
          conteudo: transcricao_revisada || '',
        });

        // O `AND profissional_id = ?` impede assinar evolução de outro
        // profissional: sem ele, bastava mandar um id qualquer no payload.
        tipos.push(type);
        statements.push(
          db.prepare(
            `UPDATE evolucoes
             SET check_out = ?, transcricao_revisada = ?, status = 'Finalizado', data_assinatura = ?, assinatura_digital = ?
             WHERE id = ? AND profissional_id = ?`
          ).bind(
            checkOut,
            transcricao_revisada,
            checkOut,
            selo,
            evolucaoId,
            sessao.cooperadoId
          )
        );

        // Agendar sync com o Bubble de forma assíncrona (ou simular)
        try {
          // Aqui faria a chamada à API do Bubble para registrar a evolução permanente
          console.log(`Prontuário ${evolucaoId} finalizado. Sincronizando com o Bubble...`);
          // await bubbleApi.createLogGeral({ ... });
        } catch (e) {
          console.warn('Erro ao notificar Bubble (mas gravado no D1):', e);
        }
      } else {
        return NextResponse.json({ success: false, error: `Ação de sincronização não suportada: ${type}` }, { status: 400 });
      }
    }

    if (statements.length > 0) {
      const resultados = await db.batch(statements);
      if (resultados.some((resultado, index) => !resultado.success ||
        (tipos[index] !== 'CHECK_IN' && (resultado.meta?.changes || 0) === 0))) {
        return NextResponse.json({
          success: false,
          error: 'Uma ou mais ações não foram gravadas. Os registros permanecem pendentes no aparelho.',
        }, { status: 409 });
      }
    }

    return NextResponse.json({
      success: true,
      syncedCount: actions.length
    });
  } catch (error: any) {
    console.error('Erro na rota de API de Sync:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Erro interno no servidor ao processar sincronização.'
    }, { status: 500 });
  }
}
