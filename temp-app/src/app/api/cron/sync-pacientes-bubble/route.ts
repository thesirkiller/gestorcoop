import { NextRequest, NextResponse } from 'next/server';
import { cronAutorizado } from '@/lib/equipamentos-jobs';
import { sincronizarPacientesBubbleParaD1 } from '@/lib/sync-pacientes';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

/**
 * Endpoint de sincronização periódica Bubble -> D1.
 * Protegido por CRON_SECRET via header Authorization: Bearer <segredo>.
 */
async function processarSincronizacao(request: NextRequest) {
  if (!cronAutorizado(request)) {
    return NextResponse.json({ success: false, error: 'Não autorizado.' }, { status: 401 });
  }

  try {
    const resultado = await sincronizarPacientesBubbleParaD1();
    return NextResponse.json({
      success: resultado.erros.length === 0,
      data: resultado,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error('[cron/sync-pacientes-bubble] Erro na sincronização:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Falha na sincronização de pacientes.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return processarSincronizacao(request);
}

export async function GET(request: NextRequest) {
  return processarSincronizacao(request);
}
