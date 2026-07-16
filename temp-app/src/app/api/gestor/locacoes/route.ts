import { NextRequest, NextResponse } from 'next/server';
import { bubbleApi, equipamentosV2Ativo, LocacaoEquipamento } from '@/lib/bubble';
import { calcularLocacao, TipoCobrancaLocacao } from '@/lib/equipamentos-financeiro';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function GET() {
  try {
    console.log('Listando todas as locações no Bubble...');
    const list = await bubbleApi.getLocacoes();
    return NextResponse.json({ success: true, data: list });
  } catch (error) {
    const err = error as { message?: string };
    console.error('Erro ao listar locações:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Erro ao buscar locações' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      fk_equipamento,
      fk_paciente,
      fk_domicilio,
      date_inicio,
      date_fim_previsto,
      num_valor_aluguel,
      txt_observacoes,
      txt_responsavel,
      idempotency_key,
    } = body;

    if (!fk_equipamento || !fk_paciente || !date_inicio || !date_fim_previsto || num_valor_aluguel === undefined) {
      return NextResponse.json(
        { success: false, error: 'Equipamento, Paciente, Data de Início, Data de Fim Previsto e Valor do Aluguel são obrigatórios.' },
        { status: 400 }
      );
    }

    const valorAluguel = Number(num_valor_aluguel);
    if (!Number.isFinite(valorAluguel) || valorAluguel < 0 || new Date(date_fim_previsto) < new Date(date_inicio)) {
      return NextResponse.json(
        { success: false, error: 'Revise as datas e o valor da locação.' },
        { status: 400 }
      );
    }

    const equipamento = await bubbleApi.getEquipamento(fk_equipamento);
    const statusPermitidos = equipamentosV2Ativo ? ['Disponível', 'Reservado'] : ['Disponível'];
    if (!statusPermitidos.includes(equipamento.txt_status)) {
      return NextResponse.json(
        { success: false, error: `O equipamento está em "${equipamento.txt_status}" e não pode ser implantado.` },
        { status: 409 }
      );
    }

    let domicilioId = fk_domicilio as string | undefined;
    if (equipamentosV2Ativo && !domicilioId) {
      const paciente = await bubbleApi.getPaciente(fk_paciente);
      if (!paciente.txt_endereco) {
        return NextResponse.json(
          { success: false, error: 'O paciente precisa ter um endereço antes da implantação.' },
          { status: 400 }
        );
      }
      const domicilio = await bubbleApi.obterOuCriarDomicilioAtivo(fk_paciente, paciente.txt_endereco);
      domicilioId = domicilio._id;
    }

    const chaveOperacao = idempotency_key || `implantacao-${fk_equipamento}-${date_inicio}-${fk_paciente}`;
    if (equipamentosV2Ativo) {
      const movimentoExistente = await bubbleApi.getMovimentacaoPorChave(chaveOperacao);
      if (movimentoExistente?.fk_locacao_equipamento) {
        const locacaoExistente = await bubbleApi.getLocacao(movimentoExistente.fk_locacao_equipamento);
        return NextResponse.json({ success: true, data: locacaoExistente, idempotent: true });
      }
    }

    const tipoCobranca = (body.os_tipo_cobranca || 'Somente mensalidade') as TipoCobrancaLocacao;
    const valorDiaria = Number(body.num_valor_diaria_contratada ?? equipamento.num_valor_diaria_padrao ?? 0);
    const valorMensal = Number(body.num_valor_mensal_contratado ?? valorAluguel);
    const desconto = Number(body.num_desconto_contratado ?? 0);
    const acrescimo = Number(body.num_acrescimo_contratado ?? 0);
    const calculo = calcularLocacao({
      dataInicio: date_inicio,
      dataFim: date_fim_previsto,
      tipoCobranca,
      valorDiaria,
      valorMensal,
      valorPersonalizado: valorAluguel,
      desconto,
      acrescimo,
    });

    const newLocacao: Omit<LocacaoEquipamento, '_id' | 'CreatedDate'> = {
      fk_equipamento,
      fk_paciente,
      fk_domicilio: domicilioId,
      date_inicio,
      date_fim_previsto,
      num_valor_aluguel: valorAluguel,
      txt_status: 'Ativo',
      txt_observacoes,
      os_tipo_cobranca: tipoCobranca,
      num_valor_diaria_contratada: valorDiaria,
      num_valor_mensal_contratado: valorMensal,
      num_taxa_implantacao_contratada: body.num_taxa_implantacao_contratada ?? equipamento.num_taxa_implantacao_padrao,
      num_taxa_recolhimento_contratada: body.num_taxa_recolhimento_contratada ?? equipamento.num_taxa_recolhimento_padrao,
      num_desconto_contratado: calculo.desconto,
      num_acrescimo_contratado: calculo.acrescimo,
      num_total_estimado: calculo.total,
    };
    const created = await bubbleApi.createLocacao(newLocacao);

    if (equipamentosV2Ativo) {
      try {
        const movimentacao = await bubbleApi.registrarMovimentacao({
          fk_equipamento,
          fk_locacao_equipamento: created._id,
          fk_domicilio: domicilioId,
          os_tipo_movimentacao: 'Implantação',
          txt_novo_status: 'Implantado no domicílio',
          txt_responsavel,
          txt_observacoes,
          txt_chave_idempotencia: chaveOperacao,
        });
        if (created._id && movimentacao._id) {
          await bubbleApi.updateLocacao(created._id, { fk_movimentacao_implantacao: movimentacao._id });
        }
        return NextResponse.json({ success: true, data: { ...created, fk_movimentacao_implantacao: movimentacao._id } });
      } catch (error) {
        if (created._id) {
          await bubbleApi.updateLocacao(created._id, {
            txt_status: 'Cancelado',
            txt_observacoes: `${txt_observacoes || ''}\nCancelada automaticamente: a implantação não foi concluída.`.trim(),
          });
        }
        throw error;
      }
    }

    await bubbleApi.updateEquipamento(fk_equipamento, { txt_status: 'Alugado' });
    return NextResponse.json({ success: true, data: created });
  } catch (error) {
    const err = error as { message?: string };
    console.error('Erro ao registrar locação:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Erro ao registrar locação' },
      { status: 500 }
    );
  }
}
