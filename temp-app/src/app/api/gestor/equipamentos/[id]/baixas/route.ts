import { NextRequest, NextResponse } from 'next/server';
import { bubbleApi, equipamentosV2Ativo } from '@/lib/bubble';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!equipamentosV2Ativo) return NextResponse.json({ success: false, error: 'A baixa será habilitada junto com o V2.' }, { status: 503 });
    const body = await request.json();
    const solicitante = body.txt_solicitante || body.txt_autorizado_por;
    if (!body.os_motivo_baixa || !solicitante) return NextResponse.json({ success: false, error: 'Motivo e solicitante são obrigatórios.' }, { status: 400 });
    const equipamento = await bubbleApi.getEquipamento(params.id);
    if (equipamento.txt_status === 'Baixado') return NextResponse.json({ success: false, error: 'Equipamento já baixado.' }, { status: 409 });
    const baixa = await bubbleApi.criarBaixaEquipamento({
      fk_equipamento: params.id,
      date_baixa: new Date().toISOString(),
      os_motivo_baixa: body.os_motivo_baixa,
      txt_laudo: body.txt_laudo,
      num_valor_reparo_estimado: body.num_valor_reparo_estimado,
      num_valor_residual: body.num_valor_residual,
      txt_destino_final: body.txt_destino_final,
      txt_solicitante: solicitante,
      txt_status: 'Pendente de aprovação',
      txt_observacoes: body.txt_observacoes,
    });
    return NextResponse.json({ success: true, data: { baixa }, pendingApproval: true });
  } catch (error) { const err = error as { message?: string }; return NextResponse.json({ success: false, error: err.message || 'Erro ao baixar equipamento.' }, { status: 500 }); }
}
