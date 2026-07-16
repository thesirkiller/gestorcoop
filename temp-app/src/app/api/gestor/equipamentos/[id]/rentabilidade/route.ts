import { NextRequest, NextResponse } from 'next/server';
import { bubbleApi, equipamentosV2Ativo } from '@/lib/bubble';
import { calcularRentabilidadeEquipamento } from '@/lib/equipamentos-financeiro';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!equipamentosV2Ativo) {
      return NextResponse.json({ success: false, error: 'O fluxo financeiro será habilitado junto com o V2.' }, { status: 503 });
    }

    const equipamento = await bubbleApi.getEquipamento(params.id);
    const locacoes = await bubbleApi.getLocacoes([
      { key: 'fk_equipamento', constraint_type: 'equals', value: params.id },
    ]);
    const ordens = await bubbleApi.getOrdensServicoManutencao(params.id);

    const receitaRealizada: number[] = [];
    const receitaEstimada: number[] = [];
    let diasImplantado = 0;
    const agora = Date.now();

    for (const locacao of locacoes) {
      const valor = Number(locacao.num_total_estimado ?? locacao.num_valor_aluguel ?? 0);
      if (locacao.txt_status === 'Finalizado') {
        receitaRealizada.push(valor);
      } else if (locacao.txt_status === 'Ativo') {
        receitaEstimada.push(valor);
      }

      if (locacao.txt_status !== 'Cancelado' && locacao.date_inicio) {
        const inicio = new Date(locacao.date_inicio).getTime();
        const fim = locacao.date_fim_real ? new Date(locacao.date_fim_real).getTime() : agora;
        if (!Number.isNaN(inicio) && !Number.isNaN(fim) && fim > inicio) {
          diasImplantado += Math.floor((fim - inicio) / 86_400_000);
        }
      }
    }

    const custosManutencao = ordens.map((os) => Number(os.num_custo_total || 0));

    const rentabilidade = calcularRentabilidadeEquipamento({
      valorAquisicao: equipamento.num_valor_aquisicao,
      custosManutencao,
      receitaRealizada,
      receitaEstimada,
      diasImplantado,
      quantidadeImplantacoes: locacoes.length,
    });

    return NextResponse.json({ success: true, data: { rentabilidade } });
  } catch (error) {
    const err = error as { message?: string; statusHttp?: number };
    return NextResponse.json({ success: false, error: err.message || 'Erro ao calcular a rentabilidade.' }, { status: err.statusHttp || 500 });
  }
}
