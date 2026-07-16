import { NextRequest, NextResponse } from 'next/server';
import { bubbleApi, equipamentosV2Ativo } from '@/lib/bubble';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!equipamentosV2Ativo) return NextResponse.json({ success: false, error: 'A higienização será habilitada junto com o V2.' }, { status: 503 });
    const body = await request.json();
    if (!body.txt_metodo || !body.txt_resultado) return NextResponse.json({ success: false, error: 'Informe método e resultado.' }, { status: 400 });
    const equipamento = await bubbleApi.getEquipamento(params.id);
    if (!['Aguardando higienização', 'Em higienização'].includes(equipamento.txt_status)) return NextResponse.json({ success: false, error: 'Equipamento não está aguardando higienização.' }, { status: 409 });
    const agora = new Date().toISOString();
    const registro = await bubbleApi.criarHigienizacaoEquipamento({ fk_equipamento: params.id, date_inicio: body.date_inicio || agora, date_fim: agora, txt_metodo: body.txt_metodo, txt_resultado: body.txt_resultado, txt_responsavel: body.txt_responsavel, txt_status: 'Aprovada', txt_observacoes: body.txt_observacoes });
    const movimentacao = await bubbleApi.registrarMovimentacao({ fk_equipamento: params.id, os_tipo_movimentacao: 'Higienização', txt_novo_status: 'Disponível', txt_observacoes: body.txt_observacoes || `Higienização aprovada: ${body.txt_resultado}`, txt_chave_idempotencia: body.idempotency_key || `higienizacao-${registro._id}` });
    return NextResponse.json({ success: true, data: { registro, movimentacao } });
  } catch (error) { const err = error as { message?: string }; return NextResponse.json({ success: false, error: err.message || 'Erro ao registrar higienização.' }, { status: 500 }); }
}
