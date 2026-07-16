import { NextRequest, NextResponse } from 'next/server';
import { bubbleApi, equipamentosV2Ativo } from '@/lib/bubble';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

// GET: lista alertas operacionais com filtros opcionais por status, prioridade e tipo.
export async function GET(request: NextRequest) {
  try {
    if (!equipamentosV2Ativo) {
      return NextResponse.json(
        { success: false, error: 'O fluxo de alertas será habilitado junto com o V2.' },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const prioridade = searchParams.get('prioridade');
    const tipo = searchParams.get('tipo');

    const constraints: Array<{ key: string; constraint_type: string; value: string }> = [];
    if (status) constraints.push({ key: 'OS_status', constraint_type: 'equals', value: status });
    if (prioridade) constraints.push({ key: 'txt_prioridade', constraint_type: 'equals', value: prioridade });
    if (tipo) constraints.push({ key: 'os_tipo_alerta', constraint_type: 'equals', value: tipo });

    const data = await bubbleApi.getAlertas(constraints.length > 0 ? constraints : undefined);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const err = error as { message?: string };
    console.error('Erro ao listar alertas:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Erro ao buscar alertas.' },
      { status: 500 }
    );
  }
}
