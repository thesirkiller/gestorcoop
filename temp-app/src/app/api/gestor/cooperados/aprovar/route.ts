import { NextResponse } from 'next/server';
import { bubbleApi } from '@/lib/bubble';

export const runtime = 'edge';

export async function POST(request: Request) {
  try {
    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ error: 'ID do cooperado é obrigatório' }, { status: 400 });
    }

    console.log(`Buscando detalhes do cooperado para aprovação: ${id}`);
    const cooperado = await bubbleApi.getCooperado(id);
    if (!cooperado) {
      return NextResponse.json({ error: 'Cooperado não localizado' }, { status: 404 });
    }

    const cooperadoNome = cooperado.txt_nomeCompleto || cooperado.nome_text || 'Novo Cooperado';
    const cooperativaId = cooperado.fk_Cooperativa || cooperado.cooperativa_custom_cooperativas || '1632239151449x283019207795015680';

    console.log(`Buscando configurações da cooperativa: ${cooperativaId}`);
    let coopData: any = null;
    try {
      coopData = await bubbleApi.getCooperativa(cooperativaId);
    } catch (e) {
      console.warn('Falha ao obter dados da cooperativa, usando valores default:', e);
    }

    const numQtdParcelas = coopData?.num_qtd_parcelas ?? coopData?.zz_n_deparcelas_number ?? 1;
    const numValorIntegralizacao = coopData?.num_valor_integralizacao ?? coopData?.zz_valor_total_da_integraliza__o_number ?? 0;

    // 1. Criar registro de Integralização de Capital Social
    console.log('Criando registro de integralização de capital social...');
    let integralizacaoId = '';
    try {
      const intPayload = {
        fk_cooperado: id,
        fk_cooperativa: cooperativaId,
        'fk_qtd_parcelas ': Number(numQtdParcelas),
        num_valor: Number(numValorIntegralizacao),
        bool_pago: false
      };
      const intRes = await bubbleApi.createIntegralizacao(intPayload);
      integralizacaoId = intRes?.id || intRes?.response?.id;
      console.log(`Integralização criada com ID: ${integralizacaoId}`);
    } catch (e) {
      console.error('Falha ao criar integralização, prosseguindo com aprovação:', e);
    }

    // 2. Adicionar o cooperado na lista fks_cooperados da Cooperativa
    if (coopData) {
      try {
        const currentCooperados = coopData.fks_cooperados || coopData.lista_de_cooperados_list_custom_cooperados || [];
        if (!currentCooperados.includes(id)) {
          console.log(`Adicionando cooperado à lista de membros da cooperativa...`);
          await bubbleApi.updateCooperativa(cooperativaId, {
            fks_cooperados: [...currentCooperados, id]
          });
        }
      } catch (e) {
        console.error('Falha ao atualizar lista de cooperados da cooperativa:', e);
      }
    }

    // 3. Vincular usuário dummy de aprovação e a integralização ao cooperado
    console.log(`Atualizando registro do cooperado ${id}...`);
    const dummyUserId = '1632307664083x948858892871476400'; // valid Bubble User ID
    const updatePayload: any = {
      fk_usuario: dummyUserId
    };
    if (integralizacaoId) {
      updatePayload['fk_integralização'] = integralizacaoId;
    }
    await bubbleApi.updateCooperado(id, updatePayload);

    // 4. Gravar log de auditoria em logs_gerais
    try {
      console.log('Gravando log de auditoria do RH...');
      const logPayload = {
        txt_acontecimento: `Aprovou o cadastro do cooperado ${cooperadoNome}`,
        fk_cooperado: id,
        fk_cooperativa: cooperativaId,
        data: new Date().toISOString(),
        bool_tipo: "Log Rh",
        bool_escala_fora: true
      };
      await bubbleApi.createLogGeral(logPayload);
    } catch (e) {
      console.error('Falha ao gravar log de auditoria:', e);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const err = error as { message?: string };
    console.error('Erro ao aprovar cooperado:', err);
    return NextResponse.json({ error: err.message || 'Erro ao aprovar cooperado' }, { status: 500 });
  }
}
