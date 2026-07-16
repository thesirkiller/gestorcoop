import { NextRequest, NextResponse } from 'next/server';
import { bubbleApi, equipamentosV2Ativo, Equipamento } from '@/lib/bubble';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function GET() {
  try {
    console.log('Listando todos os equipamentos no Bubble...');
    const list = await bubbleApi.getEquipamentos();
    return NextResponse.json({ success: true, data: list, fluxoV2Ativo: equipamentosV2Ativo });
  } catch (error) {
    const err = error as { message?: string };
    console.error('Erro ao listar equipamentos:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Erro ao buscar equipamentos' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { txt_nome, txt_descricao, txt_marca, txt_modelo, txt_numero_serie, num_preco_padrao } = body;

    if (!txt_nome || !txt_numero_serie || num_preco_padrao === undefined) {
      return NextResponse.json(
        { success: false, error: 'Nome, número de série e preço padrão são obrigatórios.' },
        { status: 400 }
      );
    }

    const codigoInterno = body.txt_codigo_interno || `EQP-${new Date().getFullYear()}-${crypto.randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase()}`;
    const statusInicial = equipamentosV2Ativo ? 'Aguardando conferência' : 'Disponível';
    const newEquip: Omit<Equipamento, '_id' | 'CreatedDate'> = {
      txt_nome,
      txt_descricao,
      txt_marca,
      txt_modelo,
      txt_numero_serie,
      num_preco_padrao: Number(num_preco_padrao),
      txt_status: statusInicial,
      txt_codigo_interno: codigoInterno,
      txt_numero_patrimonio: body.txt_numero_patrimonio,
      txt_codigo_barras: body.txt_codigo_barras,
      txt_categoria: body.txt_categoria,
      txt_fabricante: body.txt_fabricante,
      txt_origem: body.txt_origem,
      txt_fornecedor: body.txt_fornecedor,
      date_aquisicao: body.date_aquisicao,
      date_fim_garantia: body.date_fim_garantia,
      date_proxima_preventiva: body.date_proxima_preventiva,
      num_valor_aquisicao: body.num_valor_aquisicao,
      num_valor_diaria_padrao: body.num_valor_diaria_padrao,
      num_valor_mensal_padrao: body.num_valor_mensal_padrao,
      num_taxa_implantacao_padrao: body.num_taxa_implantacao_padrao,
      num_taxa_recolhimento_padrao: body.num_taxa_recolhimento_padrao,
      txt_regra_cobranca_padrao: body.txt_regra_cobranca_padrao,
    };

    const created = await bubbleApi.createEquipamento(newEquip);
    if (equipamentosV2Ativo && created._id) {
      const movimentacao = await bubbleApi.registrarMovimentacao({
        fk_equipamento: created._id,
        os_tipo_movimentacao: 'Cadastro',
        txt_novo_status: 'Aguardando conferência',
        txt_responsavel: body.txt_responsavel,
        txt_observacoes: body.txt_observacoes,
        txt_chave_idempotencia: `cadastro-${created._id}`,
      });
      created.fk_ultima_movimentacao = movimentacao._id;
    }
    return NextResponse.json({ success: true, data: created });
  } catch (error) {
    const err = error as { message?: string };
    console.error('Erro ao criar equipamento:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Erro ao criar equipamento' },
      { status: 500 }
    );
  }
}
