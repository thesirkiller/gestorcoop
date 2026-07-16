import { NextRequest, NextResponse } from 'next/server';
import { bubbleApi, equipamentosV2Ativo, ItemManutencao } from '@/lib/bubble';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

const TIPOS_VALIDOS: ItemManutencao['txt_tipo'][] = ['Peça', 'Mão de obra', 'Frete', 'Outro'];

const guardarV2 = () =>
  NextResponse.json(
    { success: false, error: 'A manutenção será habilitada junto com o fluxo operacional V2.' },
    { status: 503 }
  );

// Recalcula e persiste o custo total da OS somando os itens vigentes.
async function recalcularCustoTotal(osId: string): Promise<number> {
  const itens = await bubbleApi.getItensManutencao(osId);
  const total = itens.reduce((soma, item) => soma + Number(item.num_custo_total || 0), 0);
  await bubbleApi.atualizarOrdemServicoManutencao(osId, { num_custo_total: total });
  return total;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string; osId: string } }
) {
  try {
    if (!equipamentosV2Ativo) return guardarV2();

    const itens = await bubbleApi.getItensManutencao(params.osId);
    return NextResponse.json({ success: true, data: itens });
  } catch (error) {
    const err = error as { message?: string; statusHttp?: number };
    return NextResponse.json(
      { success: false, error: err.message || 'Erro ao carregar os itens da OS.' },
      { status: err.statusHttp || 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; osId: string } }
) {
  try {
    if (!equipamentosV2Ativo) return guardarV2();

    const body = await request.json();
    if (!body.txt_tipo || !TIPOS_VALIDOS.includes(body.txt_tipo)) {
      return NextResponse.json(
        { success: false, error: 'Informe um tipo válido (Peça, Mão de obra, Frete ou Outro).' },
        { status: 400 }
      );
    }
    if (!body.txt_descricao) {
      return NextResponse.json({ success: false, error: 'Informe a descrição do item.' }, { status: 400 });
    }

    const item = await bubbleApi.criarItemManutencao({
      fk_ordem_servico_manutencao: params.osId,
      txt_tipo: body.txt_tipo,
      txt_descricao: body.txt_descricao,
      num_quantidade: body.num_quantidade !== undefined ? Number(body.num_quantidade) : undefined,
      num_custo_unitario: body.num_custo_unitario !== undefined ? Number(body.num_custo_unitario) : undefined,
      txt_fornecedor: body.txt_fornecedor,
      txt_responsavel: body.txt_responsavel,
    });

    const custoTotal = await recalcularCustoTotal(params.osId);
    return NextResponse.json({ success: true, data: { item, num_custo_total: custoTotal } });
  } catch (error) {
    const err = error as { message?: string; statusHttp?: number };
    return NextResponse.json(
      { success: false, error: err.message || 'Erro ao adicionar o item à OS.' },
      { status: err.statusHttp || 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; osId: string } }
) {
  try {
    if (!equipamentosV2Ativo) return guardarV2();

    const { searchParams } = new URL(request.url);
    let itemId = searchParams.get('itemId') || undefined;
    if (!itemId) {
      const body = await request.json().catch(() => ({} as { itemId?: string }));
      itemId = body.itemId;
    }
    if (!itemId) {
      return NextResponse.json({ success: false, error: 'Informe o item a ser removido.' }, { status: 400 });
    }

    await bubbleApi.deleteItemManutencao(itemId);
    const custoTotal = await recalcularCustoTotal(params.osId);
    return NextResponse.json({ success: true, data: { num_custo_total: custoTotal } });
  } catch (error) {
    const err = error as { message?: string; statusHttp?: number };
    return NextResponse.json(
      { success: false, error: err.message || 'Erro ao remover o item da OS.' },
      { status: err.statusHttp || 500 }
    );
  }
}
