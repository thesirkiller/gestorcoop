import { NextRequest, NextResponse } from 'next/server';
import { bubbleApi, equipamentosV2Ativo } from '@/lib/bubble';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function POST(request: NextRequest, { params }: { params: { id: string; baixaId: string } }) {
  try {
    if (!equipamentosV2Ativo) return NextResponse.json({ success: false, error: 'A baixa será habilitada junto com o V2.' }, { status: 503 });
    const body = await request.json();
    if (!body.txt_autorizado_por) return NextResponse.json({ success: false, error: 'Informe o autorizador.' }, { status: 400 });

    const baixa = await bubbleApi.getBaixa(params.baixaId);
    if (!baixa) return NextResponse.json({ success: false, error: 'Baixa não encontrada.' }, { status: 404 });
    if (baixa.txt_status !== 'Pendente de aprovação') {
      return NextResponse.json({ success: false, error: `A baixa está em "${baixa.txt_status}" e não pode ser aprovada.` }, { status: 409 });
    }

    const date_decisao = new Date().toISOString();
    await bubbleApi.atualizarBaixaEquipamento(params.baixaId, {
      txt_status: 'Aprovada',
      txt_autorizado_por: body.txt_autorizado_por,
      date_decisao,
      date_baixa_efetiva: date_decisao,
    });

    const movimentacao = await bubbleApi.registrarMovimentacao({ fk_equipamento: params.id, os_tipo_movimentacao: 'Baixa', txt_novo_status: 'Baixado', txt_observacoes: body.txt_observacoes || `Baixa aprovada por ${body.txt_autorizado_por}.`, txt_chave_idempotencia: body.idempotency_key || `baixa-aprovada-${params.baixaId}` });
    return NextResponse.json({
      success: true,
      data: {
        baixa: { ...baixa, txt_status: 'Aprovada', txt_autorizado_por: body.txt_autorizado_por, date_decisao },
        movimentacao,
      },
    });
  } catch (error) { const err = error as { message?: string; statusHttp?: number }; return NextResponse.json({ success: false, error: err.message || 'Erro ao aprovar baixa.' }, { status: err.statusHttp || 500 }); }
}
