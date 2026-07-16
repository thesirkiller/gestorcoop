import { NextRequest, NextResponse } from 'next/server';
import { bubbleApi, equipamentosV2Ativo } from '@/lib/bubble';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!equipamentosV2Ativo) return NextResponse.json({ success: false, error: 'A baixa será habilitada junto com o V2.' }, { status: 503 });
    const body = await request.json();
    if (!body.os_motivo_baixa || !body.txt_autorizado_por) return NextResponse.json({ success: false, error: 'Motivo e autorizador são obrigatórios.' }, { status: 400 });
    const equipamento = await bubbleApi.getEquipamento(params.id);
    if (equipamento.txt_status === 'Baixado') return NextResponse.json({ success: false, error: 'Equipamento já baixado.' }, { status: 409 });
    const response = await fetch(`${process.env.BUBBLE_API_URL}/obj/baixa_equipamento`, {
      method: 'POST', headers: { Authorization: `Bearer ${process.env.BUBBLE_API_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fk_equipamento: params.id, date_baixa: new Date().toISOString(), os_motivo_baixa: body.os_motivo_baixa, OS_status: 'Pendente de aprovação', txt_autorizado_por: body.txt_autorizado_por, txt_observacoes: body.txt_observacoes }),
    });
    if (!response.ok) throw new Error('Não foi possível registrar a solicitação de baixa.');
    const baixa = await response.json();
    return NextResponse.json({ success: true, data: { baixa }, pendingApproval: true });
  } catch (error) { const err = error as { message?: string }; return NextResponse.json({ success: false, error: err.message || 'Erro ao baixar equipamento.' }, { status: 500 }); }
}
