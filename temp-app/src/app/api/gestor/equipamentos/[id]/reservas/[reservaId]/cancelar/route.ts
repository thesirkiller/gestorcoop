import { NextRequest, NextResponse } from 'next/server';
import { bubbleApi, equipamentosV2Ativo } from '@/lib/bubble';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function POST(request: NextRequest, { params }: { params: { id: string; reservaId: string } }) {
  try {
    if (!equipamentosV2Ativo) {
      return NextResponse.json({ success: false, error: 'O fluxo de reservas será habilitado junto com o V2.' }, { status: 503 });
    }
    const body = await request.json();
    if (!body.txt_motivo) {
      return NextResponse.json({ success: false, error: 'Informe o motivo do cancelamento.' }, { status: 400 });
    }

    const reserva = await bubbleApi.getReserva(params.reservaId);
    if (!reserva) {
      return NextResponse.json({ success: false, error: 'Reserva não encontrada.' }, { status: 404 });
    }
    if (reserva.txt_status !== 'Ativa') {
      return NextResponse.json({ success: false, error: `A reserva está em "${reserva.txt_status}" e não pode ser cancelada.` }, { status: 409 });
    }

    await bubbleApi.atualizarReservaEquipamento(params.reservaId, { txt_status: 'Cancelada' });

    const movimentacao = await bubbleApi.registrarMovimentacao({
      fk_equipamento: params.id,
      os_tipo_movimentacao: 'Cancelamento de reserva',
      txt_novo_status: 'Disponível',
      txt_justificativa: body.txt_motivo,
      txt_observacoes: body.txt_observacoes,
      txt_status_esperado: 'Reservado',
      txt_chave_idempotencia: body.idempotency_key || `reserva-cancelar-${params.reservaId}`,
    });

    return NextResponse.json({ success: true, data: { reserva: { ...reserva, txt_status: 'Cancelada' }, movimentacao } });
  } catch (error) {
    const err = error as { message?: string; statusHttp?: number };
    return NextResponse.json({ success: false, error: err.message || 'Erro ao cancelar a reserva.' }, { status: err.statusHttp || 500 });
  }
}
