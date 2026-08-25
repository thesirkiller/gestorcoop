/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { listarEvolucoesClinicas } from '@/lib/db/prontuarios';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pacienteId = searchParams.get('pacienteId') || undefined;
    const profissionalId = searchParams.get('profissionalId') || undefined;
    const specialty = searchParams.get('specialty') || undefined;
    const status = searchParams.get('status') || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    const evolucoes = await listarEvolucoesClinicas({
      paciente_id: pacienteId,
      profissional_id: profissionalId,
      especialidade: specialty,
      status,
      data_inicio: startDate,
      data_fim: endDate,
      limit,
    });

    return NextResponse.json({
      success: true,
      results: evolucoes,
      total: evolucoes.length,
    });
  } catch (error: any) {
    console.error('Erro na API /api/gestor/prontuarios:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Falha ao buscar prontuários no servidor.',
      },
      { status: 500 }
    );
  }
}
