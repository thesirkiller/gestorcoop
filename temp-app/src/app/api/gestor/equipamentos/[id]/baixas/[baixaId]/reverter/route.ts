import { NextRequest, NextResponse } from 'next/server';
import { bubbleApi, equipamentosV2Ativo } from '@/lib/bubble';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function POST(request: NextRequest, { params }: { params: { id: string; baixaId: string } }) {
  try {
    if (!equipamentosV2Ativo) {
      return NextResponse.json({ success: false, error: 'A baixa será habilitada junto com o V2.' }, { status: 503 });
    }
    const body = await request.json();
    if (!body.txt_revertida_por || !body.txt_revertida_por_segundo || !body.txt_justificativa_reversao) {
      return NextResponse.json({ success: false, error: 'A reversão exige dois autorizadores e a justificativa reforçada.' }, { status: 400 });
    }
    if (body.txt_revertida_por === body.txt_revertida_por_segundo) {
      return NextResponse.json({ success: false, error: 'Os dois autorizadores da reversão devem ser diferentes.' }, { status: 400 });
    }

    const baixa = await bubbleApi.getBaixa(params.baixaId);
    if (!baixa) {
      return NextResponse.json({ success: false, error: 'Baixa não encontrada.' }, { status: 404 });
    }
    if (baixa.txt_status !== 'Aprovada' || baixa.bool_revertida) {
      return NextResponse.json({ success: false, error: 'Só é possível reverter uma baixa aprovada e ainda não revertida.' }, { status: 409 });
    }

    const equipamento = await bubbleApi.getEquipamento(params.id);
    if (equipamento.txt_status !== 'Baixado') {
      return NextResponse.json({ success: false, error: `O equipamento está em "${equipamento.txt_status}", não em "Baixado".` }, { status: 409 });
    }

    const date_reversao = new Date().toISOString();
    await bubbleApi.atualizarBaixaEquipamento(params.baixaId, {
      txt_status: 'Cancelada',
      bool_revertida: true,
      txt_revertida_por: body.txt_revertida_por,
      txt_revertida_por_segundo: body.txt_revertida_por_segundo,
      txt_justificativa_reversao: body.txt_justificativa_reversao,
      date_reversao,
    });

    const movimentacao = await bubbleApi.registrarMovimentacao({
      fk_equipamento: params.id,
      os_tipo_movimentacao: 'Correção',
      txt_novo_status: 'Aguardando conferência',
      txt_justificativa: body.txt_justificativa_reversao,
      txt_observacoes: body.txt_observacoes,
      txt_status_esperado: 'Baixado',
      txt_chave_idempotencia: body.idempotency_key || `baixa-reverter-${params.baixaId}`,
    });

    return NextResponse.json({
      success: true,
      data: {
        baixa: {
          ...baixa,
          txt_status: 'Cancelada',
          bool_revertida: true,
          txt_revertida_por: body.txt_revertida_por,
          txt_revertida_por_segundo: body.txt_revertida_por_segundo,
          txt_justificativa_reversao: body.txt_justificativa_reversao,
          date_reversao,
        },
        movimentacao,
      },
    });
  } catch (error) {
    const err = error as { message?: string; statusHttp?: number };
    return NextResponse.json({ success: false, error: err.message || 'Erro ao reverter a baixa.' }, { status: err.statusHttp || 500 });
  }
}
