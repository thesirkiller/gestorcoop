import { NextRequest, NextResponse } from 'next/server';
import { bubbleApi, equipamentosV2Ativo, Equipamento } from '@/lib/bubble';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

const LIMITE_VARREDURA = 100;

interface LinhaManutencao {
  equipamentoId: string;
  nome: string;
  numeroSerie: string;
  numOrdens: number;
  custoTotal: number;
}

// Agrega custo e nº de OS de manutenção para um equipamento.
async function agregarEquipamento(equipamento: Equipamento): Promise<LinhaManutencao> {
  const ordens = await bubbleApi.getOrdensServicoManutencao(equipamento._id as string);
  const custoTotal = ordens.reduce((soma, os) => soma + (os.num_custo_total ?? 0), 0);
  return {
    equipamentoId: equipamento._id as string,
    nome: equipamento.txt_nome,
    numeroSerie: equipamento.txt_numero_serie,
    numOrdens: ordens.length,
    custoTotal: Math.round((custoTotal + Number.EPSILON) * 100) / 100,
  };
}

// GET: relatório de manutenções por equipamento. Com ?equipamentoId= detalha um só;
// sem ele, varre até LIMITE_VARREDURA equipamentos e sinaliza truncamento.
export async function GET(request: NextRequest) {
  try {
    if (!equipamentosV2Ativo) {
      return NextResponse.json(
        { success: false, error: 'O fluxo de relatórios será habilitado junto com o V2.' },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(request.url);
    const equipamentoId = searchParams.get('equipamentoId');

    if (equipamentoId) {
      const equipamento = await bubbleApi.getEquipamento(equipamentoId);
      const linha = await agregarEquipamento(equipamento);
      return NextResponse.json({
        success: true,
        data: { truncado: false, totalEquipamentos: 1, ranking: [linha] },
      });
    }

    const equipamentos = await bubbleApi.getEquipamentos();
    const truncado = equipamentos.length > LIMITE_VARREDURA;
    const alvos = equipamentos.slice(0, LIMITE_VARREDURA).filter((e) => e._id);

    const linhas = await Promise.all(alvos.map((e) => agregarEquipamento(e)));
    const ranking = linhas
      .filter((linha) => linha.numOrdens > 0)
      .sort((a, b) => b.custoTotal - a.custoTotal);

    return NextResponse.json({
      success: true,
      data: {
        truncado,
        totalEquipamentos: equipamentos.length,
        varridos: alvos.length,
        ranking,
      },
    });
  } catch (error) {
    const err = error as { message?: string };
    console.error('Erro ao gerar relatório de manutenções:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Erro ao gerar o relatório de manutenções.' },
      { status: 500 }
    );
  }
}
