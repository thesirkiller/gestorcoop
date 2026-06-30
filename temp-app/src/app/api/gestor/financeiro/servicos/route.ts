import { NextResponse } from 'next/server';
import { bubbleApi } from '@/lib/bubble';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cooperadoId = searchParams.get('cooperadoId');
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    if (!cooperadoId) {
      return NextResponse.json({ error: 'Parâmetro cooperadoId é obrigatório.' }, { status: 400 });
    }

    console.log(`Buscando serviços para o cooperado ${cooperadoId} no período ${startDate} a ${endDate}...`);
    const list = await bubbleApi.getServicosByCooperado(cooperadoId, startDate, endDate);
    return NextResponse.json({ success: true, data: list });
  } catch (error) {
    const err = error as { message?: string };
    console.error('Erro ao listar serviços do cooperado:', err);
    return NextResponse.json({ error: err.message || 'Erro ao buscar serviços.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { servicoId, ...fields } = body;

    if (!servicoId) {
      return NextResponse.json({ error: 'Parâmetro servicoId é obrigatório.' }, { status: 400 });
    }

    console.log(`Atualizando serviço ${servicoId}:`, fields);
    const response = await bubbleApi.updateServico(servicoId, fields);
    return NextResponse.json({ success: true, data: response });
  } catch (error) {
    const err = error as { message?: string };
    console.error('Erro ao atualizar serviço:', err);
    return NextResponse.json({ error: err.message || 'Erro ao atualizar serviço.' }, { status: 500 });
  }
}
