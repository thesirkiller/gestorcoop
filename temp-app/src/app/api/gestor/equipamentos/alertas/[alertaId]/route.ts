import { NextRequest, NextResponse } from 'next/server';
import { bubbleApi, equipamentosV2Ativo, AlertaEquipamento } from '@/lib/bubble';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

const STATUS_VALIDOS: AlertaEquipamento['txt_status'][] = ['Resolvido', 'Ignorado', 'Em tratamento'];

// PATCH: resolve, ignora ou coloca em tratamento um alerta.
export async function PATCH(request: NextRequest, { params }: { params: { alertaId: string } }) {
  try {
    if (!equipamentosV2Ativo) {
      return NextResponse.json(
        { success: false, error: 'O fluxo de alertas será habilitado junto com o V2.' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const status = body.txt_status as AlertaEquipamento['txt_status'];
    if (!status || !STATUS_VALIDOS.includes(status)) {
      return NextResponse.json(
        { success: false, error: 'txt_status inválido. Use "Resolvido", "Ignorado" ou "Em tratamento".' },
        { status: 400 }
      );
    }

    const patch: Partial<AlertaEquipamento> = {
      txt_status: status,
      txt_resolucao: body.txt_resolucao,
    };
    if (status === 'Resolvido') {
      patch.date_resolucao = new Date().toISOString();
    }

    await bubbleApi.atualizarAlerta(params.alertaId, patch);
    return NextResponse.json({ success: true, data: { _id: params.alertaId, ...patch } });
  } catch (error) {
    const err = error as { message?: string };
    console.error('Erro ao atualizar alerta:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Erro ao atualizar o alerta.' },
      { status: 500 }
    );
  }
}
