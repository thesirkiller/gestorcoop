import { NextRequest, NextResponse } from 'next/server';
import { bubbleApi, equipamentosV2Ativo } from '@/lib/bubble';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

interface EventoMovimentacao {
  tipo: 'Implantação' | 'Recolhimento';
  data: string;
  locacaoId?: string;
  equipamentoId: string;
  pacienteId: string;
}

// GET: relatório de implantações e recolhimentos derivados das locações no período.
export async function GET(request: NextRequest) {
  try {
    if (!equipamentosV2Ativo) {
      return NextResponse.json(
        { success: false, error: 'O fluxo de relatórios será habilitado junto com o V2.' },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(request.url);
    const inicio = searchParams.get('inicio'); // YYYY-MM-DD
    const fim = searchParams.get('fim'); // YYYY-MM-DD

    const dentroDoPeriodo = (dataIso?: string) => {
      if (!dataIso) return false;
      const dia = dataIso.slice(0, 10);
      if (inicio && dia < inicio) return false;
      if (fim && dia > fim) return false;
      return true;
    };

    const locacoes = await bubbleApi.getLocacoes();

    const eventos: EventoMovimentacao[] = [];
    for (const locacao of locacoes) {
      if (dentroDoPeriodo(locacao.date_inicio)) {
        eventos.push({
          tipo: 'Implantação',
          data: locacao.date_inicio,
          locacaoId: locacao._id,
          equipamentoId: locacao.fk_equipamento,
          pacienteId: locacao.fk_paciente,
        });
      }
      if (locacao.date_fim_real && dentroDoPeriodo(locacao.date_fim_real)) {
        eventos.push({
          tipo: 'Recolhimento',
          data: locacao.date_fim_real,
          locacaoId: locacao._id,
          equipamentoId: locacao.fk_equipamento,
          pacienteId: locacao.fk_paciente,
        });
      }
    }

    eventos.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

    const implantacoes = eventos.filter((e) => e.tipo === 'Implantação').length;
    const recolhimentos = eventos.filter((e) => e.tipo === 'Recolhimento').length;

    return NextResponse.json({
      success: true,
      data: {
        periodo: { inicio: inicio || null, fim: fim || null },
        contagens: { implantacoes, recolhimentos, total: eventos.length },
        eventos,
      },
    });
  } catch (error) {
    const err = error as { message?: string };
    console.error('Erro ao gerar relatório de movimentações:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Erro ao gerar o relatório de movimentações.' },
      { status: 500 }
    );
  }
}
