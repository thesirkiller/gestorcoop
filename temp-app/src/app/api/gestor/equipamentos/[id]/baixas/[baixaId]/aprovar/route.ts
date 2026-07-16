import { NextRequest, NextResponse } from 'next/server';
import { bubbleApi, equipamentosV2Ativo } from '@/lib/bubble';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function POST(request: NextRequest, { params }: { params: { id: string; baixaId: string } }) {
  try {
    if (!equipamentosV2Ativo) return NextResponse.json({ success: false, error: 'A baixa será habilitada junto com o V2.' }, { status: 503 });
    const body = await request.json();
    if (!body.txt_autorizado_por) return NextResponse.json({ success: false, error: 'Informe o autorizador.' }, { status: 400 });
    const response = await fetch(`${process.env.BUBBLE_API_URL}/obj/baixa_equipamento/${params.baixaId}`, { method: 'PATCH', headers: { Authorization: `Bearer ${process.env.BUBBLE_API_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ OS_status: 'Aprovada', txt_autorizado_por: body.txt_autorizado_por, date_decisao: new Date().toISOString() }) });
    if (!response.ok) throw new Error('Não foi possível aprovar a baixa.');
    const movimentacao = await bubbleApi.registrarMovimentacao({ fk_equipamento: params.id, os_tipo_movimentacao: 'Baixa', txt_novo_status: 'Baixado', txt_observacoes: body.txt_observacoes || `Baixa aprovada por ${body.txt_autorizado_por}.`, txt_chave_idempotencia: body.idempotency_key || `baixa-aprovada-${params.baixaId}` });
    return NextResponse.json({ success: true, data: { movimentacao } });
  } catch (error) { const err = error as { message?: string }; return NextResponse.json({ success: false, error: err.message || 'Erro ao aprovar baixa.' }, { status: 500 }); }
}
