import { NextRequest, NextResponse } from 'next/server';
import { bubbleApi, equipamentosV2Ativo, OrdemServicoManutencao } from '@/lib/bubble';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; osId: string } }
) {
  try {
    if (!equipamentosV2Ativo) {
      return NextResponse.json({ success: false, error: 'O fluxo de manutenção V2 ainda não está habilitado.' }, { status: 503 });
    }

    const body = await request.json();
    const campos: Array<keyof OrdemServicoManutencao> = [
      'txt_motivo', 'txt_defeito_relatado', 'txt_defeito_encontrado', 'txt_causa_provavel',
      'txt_servico_recomendado', 'txt_responsavel_tecnico', 'txt_observacoes', 'txt_resultado',
      'date_diagnostico', 'date_prazo_estimado', 'num_orcamento', 'num_custo_pecas',
      'num_custo_mao_obra', 'num_custo_frete', 'num_outros_custos',
    ];
    const atualizacao = campos.reduce<Partial<OrdemServicoManutencao>>((resultado, campo) => {
      if (body[campo] !== undefined) resultado[campo] = body[campo];
      return resultado;
    }, {});

    const custoTotal = [body.num_custo_pecas, body.num_custo_mao_obra, body.num_custo_frete, body.num_outros_custos]
      .filter((valor) => valor !== undefined)
      .reduce((total, valor) => total + Number(valor || 0), 0);
    if (custoTotal > 0) atualizacao.num_custo_total = custoTotal;

    const resultadoTecnico = body.txt_resultado as string | undefined;
    if (resultadoTecnico === 'Aguardando peça') {
      atualizacao.txt_status = 'Aguardando peça';
      await bubbleApi.atualizarOrdemServicoManutencao(params.osId, atualizacao);
      await bubbleApi.registrarMovimentacao({
        fk_equipamento: params.id,
        fk_ordem_servico_manutencao: params.osId,
        os_tipo_movimentacao: 'Manutenção',
        txt_novo_status: 'Aguardando peça',
        txt_observacoes: body.txt_observacoes || 'Aguardando peça para conclusão da OS.',
        txt_chave_idempotencia: body.idempotency_key || `os-aguardando-peca-${params.osId}`,
      });
      return NextResponse.json({ success: true });
    }

    if (resultadoTecnico === 'Reparado e liberado') {
      if (body.teste_aprovado !== true) {
        return NextResponse.json(
          { success: false, error: 'A liberação exige o registro de teste técnico aprovado.' },
          { status: 400 }
        );
      }
      atualizacao.txt_status = 'Liberada';
      atualizacao.date_conclusao = body.date_conclusao || new Date().toISOString();
      await bubbleApi.atualizarOrdemServicoManutencao(params.osId, atualizacao);
      await bubbleApi.registrarMovimentacao({
        fk_equipamento: params.id,
        fk_ordem_servico_manutencao: params.osId,
        os_tipo_movimentacao: 'Liberação',
        txt_novo_status: 'Disponível',
        txt_observacoes: body.txt_observacoes || 'Liberado após teste técnico aprovado.',
        txt_chave_idempotencia: body.idempotency_key || `os-liberacao-${params.osId}`,
      });
      return NextResponse.json({ success: true });
    }

    atualizacao.txt_status = body.txt_status || 'Em diagnóstico';
    if (atualizacao.txt_status === 'Em diagnóstico' && !atualizacao.date_diagnostico) {
      atualizacao.date_diagnostico = new Date().toISOString();
    }
    await bubbleApi.atualizarOrdemServicoManutencao(params.osId, atualizacao);
    return NextResponse.json({ success: true });
  } catch (error) {
    const err = error as { message?: string };
    return NextResponse.json(
      { success: false, error: err.message || 'Erro ao atualizar a ordem de serviço.' },
      { status: 500 }
    );
  }
}
