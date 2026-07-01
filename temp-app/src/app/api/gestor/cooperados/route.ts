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
      const cursor = cursorStr ? parseInt(cursorStr, 10) : 0;
      const limit = limitStr ? parseInt(limitStr, 10) : 100;
      console.log(`Buscando página de cooperados no Bubble... cursor: ${cursor}, limit: ${limit}`);
      const pageData = await bubbleApi.getCooperados(cursor, limit);
      return NextResponse.json({ success: true, data: pageData });
    }

    console.log('Buscando lista completa de cooperados no Bubble...');
    const list = await bubbleApi.getCooperados();
    return NextResponse.json({ success: true, data: list });
  } catch (error) {
    const err = error as { message?: string };
    console.error('Erro ao listar cooperados:', err);
    return NextResponse.json({ error: err.message || 'Erro ao buscar cooperados' }, { status: 500 });
  }
}

