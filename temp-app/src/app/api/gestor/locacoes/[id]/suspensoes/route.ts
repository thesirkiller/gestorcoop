import { NextRequest, NextResponse } from 'next/server';
import { bubbleApi, equipamentosV2Ativo } from '@/lib/bubble';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!equipamentosV2Ativo) {
      return NextResponse.json({ success: false, error: 'O fluxo financeiro será habilitado junto com o V2.' }, { status: 503 });
    }
    const suspensoes = await bubbleApi.getSuspensoesLocacao(params.id);
    return NextResponse.json({ success: true, data: { suspensoes } });
  } catch (error) {
    const err = error as { message?: string; statusHttp?: number };
    return NextResponse.json({ success: false, error: err.message || 'Erro ao listar suspensões.' }, { status: err.statusHttp || 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!equipamentosV2Ativo) {
      return NextResponse.json({ success: false, error: 'O fluxo financeiro será habilitado junto com o V2.' }, { status: 503 });
    }
    const body = await request.json();
    if (!body.date_inicio || !body.date_fim) {
      return NextResponse.json({ success: false, error: 'Informe o início e o fim da suspensão.' }, { status: 400 });
    }
    if (new Date(body.date_fim) < new Date(body.date_inicio)) {
      return NextResponse.json({ success: false, error: 'O fim da suspensão não pode ser anterior ao início.' }, { status: 400 });
    }

    const suspensao = await bubbleApi.criarSuspensaoLocacao({
      fk_locacao_equipamento: params.id,
      date_inicio: body.date_inicio,
      date_fim: body.date_fim,
      txt_motivo: body.txt_motivo,
      txt_responsavel: body.txt_responsavel,
    });

    return NextResponse.json({ success: true, data: { suspensao } });
  } catch (error) {
    const err = error as { message?: string; statusHttp?: number };
    return NextResponse.json({ success: false, error: err.message || 'Erro ao registrar a suspensão.' }, { status: err.statusHttp || 500 });
  }
}
