import { NextRequest, NextResponse } from 'next/server';
import { bubbleApi, equipamentosV2Ativo } from '@/lib/bubble';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; osId: string } }
) {
  try {
    if (!equipamentosV2Ativo) {
      return NextResponse.json(
        { success: false, error: 'A manutenção será habilitada junto com o fluxo operacional V2.' },
        { status: 503 }
      );
    }

    const body = await request.json();
    if (!body.txt_justificativa) {
      return NextResponse.json(
        { success: false, error: 'Informe a justificativa para recomendar a baixa.' },
        { status: 400 }
      );
    }

    // Registra a recomendação na OS. A baixa formal é aprovada em outra tela.
    await bubbleApi.atualizarOrdemServicoManutencao(params.osId, {
      txt_resultado: 'Recomendado para baixa',
      txt_status: 'Baixa recomendada',
      txt_observacoes: body.txt_observacoes,
    });

    // Bloqueia o equipamento para impedir uso enquanto a baixa não é decidida.
    const movimentacao = await bubbleApi.registrarMovimentacao({
      fk_equipamento: params.id,
      fk_ordem_servico_manutencao: params.osId,
      os_tipo_movimentacao: 'Bloqueio',
      txt_novo_status: 'Bloqueado',
      txt_justificativa: body.txt_justificativa,
      txt_observacoes: body.txt_observacoes,
      txt_chave_idempotencia: body.idempotency_key || `os-recomenda-baixa-${params.osId}`,
    });

    return NextResponse.json({ success: true, data: movimentacao });
  } catch (error) {
    const err = error as { message?: string; statusHttp?: number };
    return NextResponse.json(
      { success: false, error: err.message || 'Erro ao recomendar a baixa.' },
      { status: err.statusHttp || 500 }
    );
  }
}
