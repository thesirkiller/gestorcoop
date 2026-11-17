import { NextRequest, NextResponse } from 'next/server';
import { getOptionalRequestContext } from '@cloudflare/next-on-pages';
import { bubbleApi } from '@/lib/bubble';
import { sincronizarRelatoriosPagamentoBubble } from '@/lib/sincronizar-relatorios-pagamento';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

const THROTTLE_SYNC_RELATORIOS_MS = 60_000;
const chaveGlobalSync = '__gestorcoop_ultimoSyncRelatoriosPagamentoMs';

function dispararAutoSyncRelatorios(forcarAgora: boolean): Promise<unknown> | null {
  const g = globalThis as unknown as Record<string, number | undefined>;
  const agora = Date.now();
  const ultimo = g[chaveGlobalSync] ?? 0;

  if (!forcarAgora && agora - ultimo < THROTTLE_SYNC_RELATORIOS_MS) {
    return null;
  }

  g[chaveGlobalSync] = agora;
  return sincronizarRelatoriosPagamentoBubble({ limiteRelatorios: 20 }).catch((err) => {
    console.warn('[financeiro/escalas] Auto-sync de relatórios de pagamento falhou:', err);
    return null;
  });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cursorStr = searchParams.get('cursor');
    const limitStr = searchParams.get('limit');
    const syncParam = searchParams.get('sync');
    const isFirstPageOrFull = cursorStr === null || cursorStr === '0';
    const syncExplicit = (syncParam === '1' || syncParam === 'true') && isFirstPageOrFull;
    const skipAutoSync = syncParam === '0' || syncParam === 'false';

    let syncRelatorios: unknown = undefined;
    if (syncExplicit) {
      syncRelatorios = await dispararAutoSyncRelatorios(true);
    } else if (isFirstPageOrFull && !skipAutoSync) {
      const promiseSync = dispararAutoSyncRelatorios(false);
      if (promiseSync) {
        try {
          getOptionalRequestContext()?.ctx?.waitUntil?.(promiseSync);
        } catch {
          void promiseSync;
        }
      }
    }

    if (cursorStr !== null || limitStr !== null) {
      const cursor = cursorStr ? parseInt(cursorStr, 10) : 0;
      const limit = limitStr ? parseInt(limitStr, 10) : 100;
      console.log(`Buscando página de escalas no Bubble... cursor: ${cursor}, limit: ${limit}`);
      const pageData = await bubbleApi.getEscalas(cursor, limit);
      return NextResponse.json(
        syncExplicit ? { success: true, data: pageData, syncRelatorios } : { success: true, data: pageData }
      );
    }

    console.log('Buscando lista completa de escalas no Bubble...');
    const list = await bubbleApi.getEscalas();
    return NextResponse.json(
      syncExplicit ? { success: true, data: list, syncRelatorios } : { success: true, data: list }
    );
  } catch (error) {
    const err = error as { message?: string };
    console.error('Erro ao listar escalas:', err);
    return NextResponse.json({ error: err.message || 'Erro ao buscar escalas.' }, { status: 500 });
  }
}

