import { NextRequest, NextResponse } from 'next/server';
import { bubbleApi, equipamentosV2Ativo } from '@/lib/bubble';
import { montarDemonstrativoLocacao, TipoCobrancaLocacao } from '@/lib/equipamentos-financeiro';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!equipamentosV2Ativo) {
      return NextResponse.json({ success: false, error: 'O fluxo financeiro será habilitado junto com o V2.' }, { status: 503 });
    }

    const locacao = await bubbleApi.getLocacao(params.id);
    const suspensoes = await bubbleApi.getSuspensoesLocacao(params.id);

    const periodosSuspensos = suspensoes.map((s) => ({
      inicio: s.date_inicio,
      fim: s.date_fim,
      motivo: s.txt_motivo,
    }));

    const locacaoAberta = locacao.txt_status === 'Ativo' && !locacao.date_fim_real;

    const demonstrativo = montarDemonstrativoLocacao({
      dataInicio: locacao.date_inicio,
      dataFim: locacao.date_fim_real || undefined,
      dataReferencia: new Date().toISOString(),
      tipoCobranca: (locacao.os_tipo_cobranca as TipoCobrancaLocacao) || 'Somente diária',
      valorDiaria: locacao.num_valor_diaria_contratada,
      valorMensal: locacao.num_valor_mensal_contratado,
      taxaImplantacao: locacao.num_taxa_implantacao_contratada,
      taxaRecolhimento: locacao.num_taxa_recolhimento_contratada,
      desconto: locacao.num_desconto_contratado,
      acrescimo: locacao.num_acrescimo_contratado,
      periodosSuspensos,
      locacaoAberta,
    });

    return NextResponse.json({ success: true, data: { demonstrativo } });
  } catch (error) {
    const err = error as { message?: string; statusHttp?: number };
    return NextResponse.json({ success: false, error: err.message || 'Erro ao montar o demonstrativo.' }, { status: err.statusHttp || 500 });
  }
}
