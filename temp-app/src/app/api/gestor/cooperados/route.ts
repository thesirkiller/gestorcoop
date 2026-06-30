import { NextResponse } from 'next/server';
import { bubbleApi } from '@/lib/bubble';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function GET() {
  try {
    console.log('Buscando lista de cooperados no Bubble...');
    const list = await bubbleApi.getCooperados();
    return NextResponse.json({ success: true, data: list });
  } catch (error) {
    const err = error as { message?: string };
    console.error('Erro ao listar cooperados:', err);
    return NextResponse.json({ error: err.message || 'Erro ao buscar cooperados' }, { status: 500 });
  }
}
