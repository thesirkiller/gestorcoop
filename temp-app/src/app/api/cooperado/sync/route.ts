/* eslint-disable */
import { NextRequest, NextResponse } from 'next/server';
import { bubbleApi } from '@/lib/bubble';

import { gerarSeloAssinatura, obterSessaoCooperado } from '@/lib/sessao-cooperado';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

interface D1Database {
  prepare(query: string): any;
  batch(statements: any[]): Promise<any>;
}

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

    const db = (process.env.DB as unknown) as D1Database | undefined;

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
        { status: 503 },
      );
    }

    const statements: any[] = [];

    for (const action of actions) {
      const { type, payload } = action;

      if (type === 'CHECK_IN') {
        const { evolucaoId, pacienteId, checkIn, tipoProfissional, turno } = payload;

        // INSERT OR IGNORE, e não REPLACE: reenviar a fila (o que acontece a
        // cada reconexão) não pode zerar uma evolução já em andamento nem
        // ressuscitar uma já finalizada.
        statements.push(
          db.prepare(
            `INSERT OR IGNORE INTO evolucoes (id, paciente_id, profissional_id, tipo_profissional, turno, check_in, status)
             VALUES (?, ?, ?, ?, ?, ?, 'Em_Andamento')`
          ).bind(
            evolucaoId,
            pacienteId,
            sessao.cooperadoId,
            tipoProfissional || 'Tecnico_Enfermagem',
            turno || null,
            checkIn
          )
        );
      }

      else if (type === 'CHECK_MEDICAMENTO') {
        const { aprazamentoId, status, horario_executado, justificativa } = payload;

        const selo =
          status === 'Administrado'
            ? await gerarSeloAssinatura({
                evolucaoId: aprazamentoId,
                cooperadoId: sessao.cooperadoId,
                instante: horario_executado,
                conteudo: `${status}|${justificativa || ''}`,
              })
            : null;

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

        const selo = await gerarSeloAssinatura({
          evolucaoId,
          cooperadoId: sessao.cooperadoId,
          instante: checkOut,
          conteudo: transcricao_revisada || '',
        });

        // O `AND profissional_id = ?` impede assinar evolução de outro
        // profissional: sem ele, bastava mandar um id qualquer no payload.
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
      }
    }

    if (statements.length > 0) {
      await db.batch(statements);
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
