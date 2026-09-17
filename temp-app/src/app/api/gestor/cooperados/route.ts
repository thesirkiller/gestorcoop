import { NextRequest, NextResponse } from 'next/server';
import { bubbleApi } from '@/lib/bubble';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cursorStr = searchParams.get('cursor');
    const limitStr = searchParams.get('limit');
    if (cursorStr !== null || limitStr !== null) {
      const cursor = Number(cursorStr || 0);
      const limit = Number(limitStr || 100);
      if (!Number.isInteger(cursor) || cursor < 0 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
        return NextResponse.json({ success: false, error: 'Paginação inválida.' }, { status: 400 });
      }
      const data = await bubbleApi.getCooperados(cursor, limit);
      return NextResponse.json({ success: true, data });
    }
    return NextResponse.json({ success: true, data: await bubbleApi.getCooperados() });
  } catch (error) {
    console.error('Erro ao listar cooperados:', error instanceof Error ? error.message : 'Erro desconhecido');
    return NextResponse.json({ success: false, error: 'Não foi possível carregar os cooperados. Tente novamente.' }, { status: 502 });
  }
}
