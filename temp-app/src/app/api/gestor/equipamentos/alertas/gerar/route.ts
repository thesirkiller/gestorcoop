import { NextResponse } from 'next/server';
import { equipamentosV2Ativo } from '@/lib/bubble';
import { gerarAlertas } from '@/lib/equipamentos-jobs';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

// POST: rotina agendável (também disparável pela UI autenticada) que varre os
// dados operacionais e gera alertas idempotentes. A lógica vive em
// equipamentos-jobs para ser reaproveitada pela rota de cron.
export async function POST() {
  if (!equipamentosV2Ativo) {
    return NextResponse.json(
      { success: false, error: 'O fluxo de alertas será habilitado junto com o V2.' },
      { status: 503 }
    );
  }
  const resultado = await gerarAlertas();
  return NextResponse.json({ success: true, data: resultado });
}
