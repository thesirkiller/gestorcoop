import { NextRequest, NextResponse } from 'next/server';
import { bubbleApi } from '@/lib/bubble';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    const body = await request.json();
    const { txt_status, date_fim_real, txt_status_equipamento, fk_equipamento } = body;

    console.log(`Atualizando locação ${id} no Bubble...`, body);

    // Prepare update data for rental
    const updateData: Record<string, unknown> = {};
    if (txt_status) updateData.txt_status = txt_status;
    if (date_fim_real) updateData.date_fim_real = date_fim_real;
    if (body.txt_observacoes !== undefined) updateData.txt_observacoes = body.txt_observacoes;

    // Update rental record
    await bubbleApi.updateLocacao(id, updateData);

    // If finalising or cancelling, update the equipment status
    if (fk_equipamento && (txt_status === 'Finalizado' || txt_status === 'Cancelado')) {
      const newEquipStatus = txt_status === 'Finalizado' ? (txt_status_equipamento || 'Disponível') : 'Disponível';
      console.log(`Atualizando status do equipamento ${fk_equipamento} para ${newEquipStatus}`);
      await bubbleApi.updateEquipamento(fk_equipamento, { txt_status: newEquipStatus });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const err = error as { message?: string };
    console.error(`Erro ao atualizar locação ${params.id}:`, err);
    return NextResponse.json(
      { success: false, error: err.message || 'Erro ao atualizar locação' },
      { status: 500 }
    );
  }
}
