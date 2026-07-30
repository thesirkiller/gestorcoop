import { NextRequest, NextResponse } from 'next/server';
import { bubbleApi, equipamentosV2Ativo } from '@/lib/bubble';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    if (!equipamentosV2Ativo) {
      return NextResponse.json({ success: true, data: [], fluxoV2Ativo: false });
    }
    const status = request.nextUrl.searchParams.get('status') || undefined;
    const baixas = await bubbleApi.getBaixasPorStatus(status);
    return NextResponse.json({ success: true, data: baixas, fluxoV2Ativo: true });
  } catch (error) {
    const err = error as { message?: string; statusHttp?: number };
    return NextResponse.json({ success: false, error: err.message || 'Erro ao listar baixas.' }, { status: err.statusHttp || 500 });
  }
}
