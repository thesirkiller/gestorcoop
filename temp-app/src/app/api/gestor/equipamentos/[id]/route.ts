import { NextRequest, NextResponse } from 'next/server';
import { bubbleApi, equipamentosV2Ativo, Equipamento } from '@/lib/bubble';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    const body = await request.json();
    if (equipamentosV2Ativo && body.txt_status !== undefined) {
      return NextResponse.json(
        { success: false, error: 'A situação do equipamento só pode ser alterada por uma movimentação operacional.' },
        { status: 409 }
      );
    }

    const camposEditaveis: Array<keyof Equipamento> = [
      'txt_nome',
      'txt_descricao',
      'txt_marca',
      'txt_modelo',
      'txt_numero_serie',
      'num_preco_padrao',
      'txt_codigo_interno',
      'txt_numero_patrimonio',
      'txt_codigo_barras',
      'txt_categoria',
      'txt_fabricante',
      'txt_origem',
      'txt_fornecedor',
      'fk_categoria_equipamento',
      'fk_fabricante_equipamento',
      'fk_modelo_equipamento',
      'fk_fornecedor_equipamento',
      'date_aquisicao',
      'date_fim_garantia',
      'date_proxima_preventiva',
      'num_valor_aquisicao',
      'num_valor_diaria_padrao',
      'num_valor_mensal_padrao',
      'num_taxa_implantacao_padrao',
      'num_taxa_recolhimento_padrao',
      'txt_regra_cobranca_padrao',
    ];
    if (!equipamentosV2Ativo) camposEditaveis.push('txt_status');

    const atualizacao = camposEditaveis.reduce<Partial<Equipamento>>((resultado, campo) => {
      if (body[campo] !== undefined) resultado[campo] = body[campo];
      return resultado;
    }, {});
    await bubbleApi.updateEquipamento(id, atualizacao);
    return NextResponse.json({ success: true });
  } catch (error) {
    const err = error as { message?: string };
    console.error(`Erro ao atualizar equipamento ${params.id}:`, err);
    return NextResponse.json(
      { success: false, error: err.message || 'Erro ao atualizar equipamento' },
      { status: 500 }
    );
  }
}
