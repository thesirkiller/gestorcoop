import { NextRequest, NextResponse } from 'next/server';
import { obterSessao } from '@/lib/sessao';
import { carregarProntuario360 } from '@/lib/db/prontuarios';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!(await obterSessao('gestor'))) {
      return NextResponse.json({ success: false, error: 'Sessão de gestor inválida.' }, { status: 401 });
    }
    const pacienteId = params.id;
    const prontuario = await carregarProntuario360(pacienteId);

    if (!prontuario) {
      return NextResponse.json({ success: false, error: 'Paciente não encontrado.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: prontuario.aprazamentos || [],
    });
  } catch (error: unknown) {
    console.error('Erro na rota GET /api/gestor/prontuarios/pacientes/[id]/aprazamentos:', error);
    const mensagem = error instanceof Error ? error.message : 'Erro ao listar aprazamentos do paciente.';
    return NextResponse.json(
      { success: false, error: mensagem },
      { status: 500 }
    );
  }
}
