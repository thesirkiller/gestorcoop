import { NextRequest, NextResponse } from 'next/server';
import { bubbleApi, equipamentosV2Ativo, ReservaEquipamento } from '@/lib/bubble';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!equipamentosV2Ativo) {
      return NextResponse.json({ success: false, error: 'O fluxo de reservas será habilitado junto com o V2.' }, { status: 503 });
    }
    const body = await request.json();
    if (!body.fk_paciente || !body.date_implantacao_prevista || !body.date_validade) {
      return NextResponse.json({ success: false, error: 'Paciente, implantação prevista e validade são obrigatórios.' }, { status: 400 });
    }
    if (new Date(body.date_validade) < new Date(body.date_implantacao_prevista)) {
      return NextResponse.json({ success: false, error: 'A validade não pode ser anterior à implantação prevista.' }, { status: 400 });
    }
    const equipamento = await bubbleApi.getEquipamento(params.id);
    if (equipamento.txt_status !== 'Disponível') {
      return NextResponse.json({ success: false, error: `O equipamento está em "${equipamento.txt_status}" e não está disponível para reserva.` }, { status: 409 });
    }

    const chave = body.idempotency_key || `reserva-${params.id}-${body.fk_paciente}-${body.date_implantacao_prevista}`;
    const reserva: Omit<ReservaEquipamento, '_id' | 'CreatedDate'> = {
      fk_equipamento: params.id,
      fk_paciente: body.fk_paciente,
      fk_domicilio: body.fk_domicilio,
      date_reserva: new Date().toISOString(),
      date_implantacao_prevista: body.date_implantacao_prevista,
      date_validade: body.date_validade,
      txt_responsavel: body.txt_responsavel,
      txt_observacoes: body.txt_observacoes,
      txt_status: 'Ativa',
      txt_chave_idempotencia: chave,
    };
    const criada = await bubbleApi.criarReservaEquipamento(reserva);
    try {
      const movimentacao = await bubbleApi.registrarMovimentacao({
        fk_equipamento: params.id,
        os_tipo_movimentacao: 'Reserva',
        txt_novo_status: 'Reservado',
        txt_observacoes: body.txt_observacoes,
        txt_chave_idempotencia: chave,
      });
      if (criada._id && movimentacao._id) {
        await bubbleApi.atualizarReservaEquipamento(criada._id, { fk_movimentacao_reserva: movimentacao._id });
      }
      return NextResponse.json({ success: true, data: criada });
    } catch (error) {
      if (criada._id) await bubbleApi.atualizarReservaEquipamento(criada._id, { txt_status: 'Cancelada' });
      throw error;
    }
  } catch (error) {
    const err = error as { message?: string };
    return NextResponse.json({ success: false, error: err.message || 'Erro ao registrar a reserva.' }, { status: 500 });
  }
}
