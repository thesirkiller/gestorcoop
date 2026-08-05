import { NextRequest, NextResponse } from 'next/server';
import { bubbleApi } from '@/lib/bubble';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

/**
 * Lista os domicílios de um cliente. Usado pelo romaneio de entrega para obter
 * o endereço real da entrega e as instruções de acesso.
 */
export async function GET(request: NextRequest) {
  const clienteId = request.nextUrl.searchParams.get('cliente');
  if (!clienteId) {
    return NextResponse.json({ success: false, error: 'Informe o cliente.' }, { status: 400 });
  }

  try {
    const list = await bubbleApi.getDomiciliosPorPaciente(clienteId);
    return NextResponse.json({ success: true, data: list });
  } catch (error) {
    const err = error as { message?: string };
    console.error('Erro ao listar domicílios:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Erro ao buscar domicílios' },
      { status: 500 }
    );
  }
}
