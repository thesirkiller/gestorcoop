import { NextResponse } from 'next/server';
import { bubbleApi } from '@/lib/bubble';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cooperadoId = searchParams.get('cooperadoId');

    if (!cooperadoId) {
      return NextResponse.json({ error: 'Parâmetro cooperadoId é obrigatório.' }, { status: 400 });
    }

    console.log(`Buscando contas bancárias para o cooperado ${cooperadoId}...`);
    const list = await bubbleApi.getContasBancariasByCooperado(cooperadoId);
    return NextResponse.json({ success: true, data: list });
  } catch (error) {
    const err = error as { message?: string };
    console.error('Erro ao listar contas bancárias do cooperado:', err);
    return NextResponse.json({ error: err.message || 'Erro ao buscar contas bancárias.' }, { status: 500 });
  }
}
