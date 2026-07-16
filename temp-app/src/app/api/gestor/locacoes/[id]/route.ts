import { NextRequest, NextResponse } from 'next/server';
import { bubbleApi, equipamentosV2Ativo } from '@/lib/bubble';
import { calcularLocacao, TipoCobrancaLocacao } from '@/lib/equipamentos-financeiro';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    const body = await request.json();
    const { txt_status, date_fim_real, txt_status_equipamento, fk_equipamento, idempotency_key, txt_responsavel } = body;
    const dataFimReal = date_fim_real || new Date().toISOString();

    console.log(`Atualizando locação ${id} no Bubble...`, body);

    if (equipamentosV2Ativo && txt_status === 'Finalizado') {
      const locacao = await bubbleApi.getLocacao(id);
      const equipamentoId = fk_equipamento || locacao.fk_equipamento;
      if (!equipamentoId) {
        return NextResponse.json({ success: false, error: 'Locação sem equipamento vinculado.' }, { status: 400 });
      }

      const chaveOperacao = idempotency_key || `recolhimento-${id}-${date_fim_real || new Date().toISOString().slice(0, 10)}`;
      const movimentoExistente = await bubbleApi.getMovimentacaoPorChave(chaveOperacao);
      if (movimentoExistente?.fk_locacao_equipamento === id) {
        await bubbleApi.updateLocacao(id, {
          txt_status: 'Finalizado',
          date_fim_real: date_fim_real || new Date().toISOString(),
          fk_movimentacao_recolhimento: movimentoExistente._id,
        });
        return NextResponse.json({ success: true, idempotent: true });
      }

      const movimentacao = await bubbleApi.registrarMovimentacao({
        fk_equipamento: equipamentoId,
        fk_locacao_equipamento: id,
        fk_domicilio: locacao.fk_domicilio,
        os_tipo_movimentacao: 'Recolhimento',
        txt_novo_status: 'Recolhido e aguardando conferência',
        txt_responsavel,
        txt_observacoes: body.txt_observacoes,
        txt_chave_idempotencia: chaveOperacao,
        date_data_hora: dataFimReal,
      });

      const calculoFinal = calcularLocacao({
        dataInicio: locacao.date_inicio,
        dataFim: dataFimReal,
        tipoCobranca: (locacao.os_tipo_cobranca || 'Somente mensalidade') as TipoCobrancaLocacao,
        valorDiaria: locacao.num_valor_diaria_contratada,
        valorMensal: locacao.num_valor_mensal_contratado ?? locacao.num_valor_aluguel,
        valorPersonalizado: locacao.num_valor_aluguel,
        desconto: locacao.num_desconto_contratado,
        acrescimo: locacao.num_acrescimo_contratado,
      });

      await bubbleApi.updateLocacao(id, {
        txt_status: 'Finalizado',
        date_fim_real: dataFimReal,
        txt_observacoes: body.txt_observacoes,
        fk_movimentacao_recolhimento: movimentacao._id,
        num_total_estimado: calculoFinal.total,
      });
      return NextResponse.json({ success: true, data: { movimentacao, calculoFinal } });
    }

    // Prepare update data for rental
    const updateData: Record<string, unknown> = {};
    if (txt_status) updateData.txt_status = txt_status;
    if (date_fim_real) updateData.date_fim_real = date_fim_real;
    if (body.txt_observacoes !== undefined) updateData.txt_observacoes = body.txt_observacoes;

    if (txt_status === 'Finalizado') {
      const locacao = await bubbleApi.getLocacao(id);
      const calculoFinal = calcularLocacao({
        dataInicio: locacao.date_inicio,
        dataFim: dataFimReal,
        tipoCobranca: (locacao.os_tipo_cobranca || 'Somente mensalidade') as TipoCobrancaLocacao,
        valorDiaria: locacao.num_valor_diaria_contratada,
        valorMensal: locacao.num_valor_mensal_contratado ?? locacao.num_valor_aluguel,
        valorPersonalizado: locacao.num_valor_aluguel,
        desconto: locacao.num_desconto_contratado,
        acrescimo: locacao.num_acrescimo_contratado,
      });
      updateData.date_fim_real = dataFimReal;
      updateData.num_total_estimado = calculoFinal.total;
    }

    // Update rental record
    await bubbleApi.updateLocacao(id, updateData);

    // If finalising or cancelling, update the equipment status
    if (!equipamentosV2Ativo && fk_equipamento && (txt_status === 'Finalizado' || txt_status === 'Cancelado')) {
      const newEquipStatus = txt_status === 'Finalizado' ? (txt_status_equipamento || 'Disponível') : 'Disponível';
      console.log(`Atualizando status do equipamento ${fk_equipamento} para ${newEquipStatus}`);
      await bubbleApi.updateEquipamento(fk_equipamento, { txt_status: newEquipStatus });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const err = error as { message?: string };
    console.error(`Erro ao atualizar locação ${params.id}:`, err);
    return NextResponse.json(
      { success: false, error: err.message || 'Erro ao atualizar locação' },
      { status: 500 }
    );
  }
}
