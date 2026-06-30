import { NextResponse } from 'next/server';
import { bubbleApi } from '@/lib/bubble';

export async function GET() {
  try {
    console.log('Buscando lista de escalas no Bubble...');
    const list = await bubbleApi.getEscalas();
    return NextResponse.json({ success: true, data: list });
  } catch (error) {
    const err = error as { message?: string };
    console.error('Erro ao listar escalas:', err);
    return NextResponse.json({ error: err.message || 'Erro ao buscar escalas.' }, { status: 500 });
  }
}
