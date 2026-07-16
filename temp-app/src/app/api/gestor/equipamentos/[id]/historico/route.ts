import { NextResponse } from 'next/server';
import { bubbleApi, equipamentosV2Ativo } from '@/lib/bubble';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const [equipamento, eventos, ordensServico] = await Promise.all([
      bubbleApi.getEquipamento(params.id),
      bubbleApi.getHistoricoEquipamento(params.id),
      bubbleApi.getOrdensServicoManutencao(params.id),
    ]);

    return NextResponse.json({
      success: true,
      data: { equipamento, eventos, ordensServico },
      fluxoV2Ativo: equipamentosV2Ativo,
    });
  } catch (error) {
    const err = error as { message?: string };
    return NextResponse.json(
      { success: false, error: err.message || 'Erro ao buscar o histórico do equipamento.' },
      { status: 500 }
    );
  }
}
