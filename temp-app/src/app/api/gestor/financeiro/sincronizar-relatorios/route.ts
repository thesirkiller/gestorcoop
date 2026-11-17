import { NextRequest, NextResponse } from 'next/server';
import { obterSessao } from '@/lib/sessao';
import { cronAutorizado } from '@/lib/equipamentos-jobs';
import {
  sincronizarRelatoriosPagamentoBubble,
  type SincronizarRelatoriosOpcoes,
} from '@/lib/sincronizar-relatorios-pagamento';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

async function executarSincronizacao(request: NextRequest, lerBodyJson: boolean) {
  try {
    const sessao = await obterSessao('gestor', request);
    const autorizadoCron = cronAutorizado(request);
    if (!sessao && !autorizadoCron) {
      return NextResponse.json(
        { success: false, error: 'Sessão de gestor inválida ou não autorizada.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const opcoes: SincronizarRelatoriosOpcoes = {};

    if (lerBodyJson) {
      try {
        const body = (await request.json()) as Partial<SincronizarRelatoriosOpcoes> | null;
        if (body && typeof body === 'object') {
          if (typeof body.relatorioId === 'string' && body.relatorioId.trim()) {
            opcoes.relatorioId = body.relatorioId.trim();
          }
          if (typeof body.forcar === 'boolean') {
            opcoes.forcar = body.forcar;
          }
          if (typeof body.limiteRelatorios === 'number' && Number.isFinite(body.limiteRelatorios)) {
            opcoes.limiteRelatorios = Math.min(Math.max(1, Math.trunc(body.limiteRelatorios)), 200);
          }
        }
      } catch {
        // Corpo vazio ou opcional: usa parâmetros de query ou padrões.
      }
    }

    if (!opcoes.relatorioId) {
      const qRelId = searchParams.get('relatorioId');
      if (qRelId && qRelId.trim()) opcoes.relatorioId = qRelId.trim();
    }
    if (opcoes.forcar === undefined) {
      const qForcar = searchParams.get('forcar');
      if (qForcar === '1' || qForcar === 'true') opcoes.forcar = true;
    }
    if (opcoes.limiteRelatorios === undefined) {
      const qLimite = searchParams.get('limiteRelatorios') || searchParams.get('limite');
      if (qLimite) {
        const parsed = parseInt(qLimite, 10);
        if (Number.isFinite(parsed) && parsed >= 1) {
          opcoes.limiteRelatorios = Math.min(parsed, 200);
        }
      }
    }

    const resultado = await sincronizarRelatoriosPagamentoBubble(opcoes);
    return NextResponse.json({
      success: resultado.erros.length === 0,
      data: resultado,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    const status = err.message?.includes('não encontrado no Bubble') ? 404 : 500;
    console.error('[financeiro/sincronizar-relatorios] Erro ao sincronizar relatórios:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Erro ao sincronizar relatórios de pagamento no Bubble.' },
      { status }
    );
  }
}

export async function POST(request: NextRequest) {
  return executarSincronizacao(request, true);
}

export async function GET(request: NextRequest) {
  return executarSincronizacao(request, false);
}
