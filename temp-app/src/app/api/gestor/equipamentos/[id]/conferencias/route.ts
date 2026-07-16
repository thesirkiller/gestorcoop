import { NextRequest, NextResponse } from 'next/server';
import { bubbleApi, ConferenciaEquipamento, equipamentosV2Ativo, StatusEquipamento } from '@/lib/bubble';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

const destinosPermitidos: StatusEquipamento[] = ['Aguardando higienização', 'Manutenção', 'Bloqueado'];

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!equipamentosV2Ativo) return NextResponse.json({ success: false, error: 'A conferência será habilitada junto com o V2.' }, { status: 503 });
    const body = await request.json();
    const destino = body.txt_status_destino as StatusEquipamento;
    if (!body.txt_resultado || !destinosPermitidos.includes(destino)) {
      return NextResponse.json({ success: false, error: 'Informe o resultado e um encaminhamento válido.' }, { status: 400 });
    }
    const equipamento = await bubbleApi.getEquipamento(params.id);
    if (equipamento.txt_status !== 'Recolhido e aguardando conferência') {
      return NextResponse.json({ success: false, error: 'Este equipamento não está aguardando conferência.' }, { status: 409 });
    }
    const conferencia: Omit<ConferenciaEquipamento, '_id' | 'CreatedDate'> = {
      fk_equipamento: params.id,
      fk_movimentacao_equipamento: equipamento.fk_ultima_movimentacao,
      date_conferencia: new Date().toISOString(),
      txt_responsavel: body.txt_responsavel,
      txt_estado_conservacao: body.txt_estado_conservacao,
      txt_resultado: body.txt_resultado,
      txt_status_destino: destino,
      txt_observacoes: body.txt_observacoes,
    };
    const criada = await bubbleApi.criarConferenciaEquipamento(conferencia);
    const movimentacao = await bubbleApi.registrarMovimentacao({
      fk_equipamento: params.id,
      os_tipo_movimentacao: 'Correção',
      txt_novo_status: destino,
      txt_observacoes: body.txt_observacoes || `Conferência: ${body.txt_resultado}`,
      txt_chave_idempotencia: body.idempotency_key || `conferencia-${criada._id}`,
    });
    return NextResponse.json({ success: true, data: { conferencia: criada, movimentacao } });
  } catch (error) {
    const err = error as { message?: string };
    return NextResponse.json({ success: false, error: err.message || 'Erro ao registrar a conferência.' }, { status: 500 });
  }
}
