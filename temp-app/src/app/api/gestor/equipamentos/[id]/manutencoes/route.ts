import { NextRequest, NextResponse } from 'next/server';
import { bubbleApi, equipamentosV2Ativo, OrdemServicoManutencao } from '@/lib/bubble';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!equipamentosV2Ativo) {
      return NextResponse.json(
        { success: false, error: 'A manutenção será habilitada junto com o fluxo operacional V2.' },
        { status: 503 }
      );
    }

    const ordens = await bubbleApi.getOrdensServicoManutencao(params.id);
    return NextResponse.json({ success: true, data: ordens });
  } catch (error) {
    const err = error as { message?: string; statusHttp?: number };
    return NextResponse.json(
      { success: false, error: err.message || 'Erro ao carregar as ordens de serviço.' },
      { status: err.statusHttp || 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!equipamentosV2Ativo) {
      return NextResponse.json(
        { success: false, error: 'A manutenção será habilitada junto com o fluxo operacional V2.' },
        { status: 503 }
      );
    }

    const body = await request.json();
    if (!body.txt_motivo) {
      return NextResponse.json({ success: false, error: 'Informe o motivo da manutenção.' }, { status: 400 });
    }

    const equipamento = await bubbleApi.getEquipamento(params.id);
    if (['Baixado', 'Condenado', 'Extraviado'].includes(equipamento.txt_status)) {
      return NextResponse.json(
        { success: false, error: `O equipamento está em "${equipamento.txt_status}" e não pode receber uma OS.` },
        { status: 409 }
      );
    }

    const entrada = body.date_entrada || new Date().toISOString();
    const ordem: Omit<OrdemServicoManutencao, '_id' | 'CreatedDate'> = {
      txt_numero_os: body.txt_numero_os || `OS-${new Date().getFullYear()}-${crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`,
      fk_equipamento: params.id,
      date_entrada: entrada,
      txt_motivo: body.txt_motivo,
      txt_defeito_relatado: body.txt_defeito_relatado,
      txt_responsavel: body.txt_responsavel,
      txt_observacoes: body.txt_observacoes,
      txt_status: 'Aberta',
      num_custo_total: 0,
    };
    const criada = await bubbleApi.criarOrdemServicoManutencao(ordem);

    try {
      const movimentacao = await bubbleApi.registrarMovimentacao({
        fk_equipamento: params.id,
        fk_ordem_servico_manutencao: criada._id,
        os_tipo_movimentacao: 'Manutenção',
        txt_novo_status: 'Manutenção',
        txt_responsavel: body.txt_responsavel,
        txt_observacoes: body.txt_observacoes || body.txt_motivo,
        txt_chave_idempotencia: body.idempotency_key || `os-entrada-${criada._id}`,
        date_data_hora: entrada,
      });
      if (criada._id && movimentacao._id) {
        await bubbleApi.atualizarOrdemServicoManutencao(criada._id, { fk_movimentacao_entrada: movimentacao._id });
      }
      return NextResponse.json({ success: true, data: { ...criada, fk_movimentacao_entrada: movimentacao._id } });
    } catch (error) {
      if (criada._id) {
        await bubbleApi.atualizarOrdemServicoManutencao(criada._id, { txt_status: 'Cancelada' });
      }
      throw error;
    }
  } catch (error) {
    const err = error as { message?: string };
    return NextResponse.json(
      { success: false, error: err.message || 'Erro ao abrir a ordem de serviço.' },
      { status: 500 }
    );
  }
}
