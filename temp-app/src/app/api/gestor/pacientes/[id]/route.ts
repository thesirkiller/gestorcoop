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
    console.log(`Atualizando paciente ${id} no Bubble...`, body);

    await bubbleApi.updatePaciente(id, body);
    return NextResponse.json({ success: true });
  } catch (error) {
    const err = error as { message?: string };
    console.error(`Erro ao atualizar paciente ${params.id}:`, err);
    return NextResponse.json(
      { success: false, error: err.message || 'Erro ao atualizar paciente' },
      { status: 500 }
    );
  }
}
