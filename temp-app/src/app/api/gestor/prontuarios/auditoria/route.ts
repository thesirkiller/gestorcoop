/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { obterSessao } from '@/lib/sessao';
import { listarAprazamentosParaAuditoria } from '@/lib/db/prontuarios';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    if (!(await obterSessao('gestor'))) {
      return NextResponse.json({ success: false, error: 'Sessão de gestor inválida.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const pacienteId = searchParams.get('pacienteId') || undefined;
    const status = searchParams.get('status') || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const limiteBruto = parseInt(searchParams.get('limit') || '200', 10);
    const limit = Number.isFinite(limiteBruto) && limiteBruto > 0 ? limiteBruto : 200;

    const results = await listarAprazamentosParaAuditoria({
      paciente_id: pacienteId,
      status,
      data_inicio: startDate,
      data_fim: endDate,
      limit,
    });

    return NextResponse.json({
      success: true,
      results,
      total: results.length,
    });
  } catch (error: any) {
    console.error('Erro na API /api/gestor/prontuarios/auditoria:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Falha ao buscar auditoria de aprazamentos no servidor.',
      },
      { status: 500 }
    );
  }
}
