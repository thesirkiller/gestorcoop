import { NextResponse } from 'next/server';
import { equipamentosV2Ativo } from '@/lib/bubble';
import { expirarReservas } from '@/lib/equipamentos-jobs';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

// POST: rotina batch (também disparável pela UI autenticada) que expira
// reservas vencidas. A lógica vive em equipamentos-jobs (reaproveitada no cron).
export async function POST() {
  try {
    if (!equipamentosV2Ativo) {
      return NextResponse.json({ success: false, error: 'O fluxo de reservas será habilitado junto com o V2.' }, { status: 503 });
    }
    const resultado = await expirarReservas();
    return NextResponse.json({ success: true, data: resultado });
  } catch (error) {
    const err = error as { message?: string; statusHttp?: number };
    return NextResponse.json({ success: false, error: err.message || 'Erro ao expirar reservas.' }, { status: err.statusHttp || 500 });
  }
}
