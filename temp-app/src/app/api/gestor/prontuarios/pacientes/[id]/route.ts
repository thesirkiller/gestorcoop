/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import {
  obterPacienteClinico,
  salvarPacienteClinico,
  listarEvolucoesClinicas,
  listarPrescricoesClinicas,
  listarSinaisVitaisClinicos,
  listarPareceresClinicos,
} from '@/lib/db/prontuarios';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const pacienteId = params.id;
    const paciente = await obterPacienteClinico(pacienteId);

    if (!paciente) {
      return NextResponse.json(
        { success: false, error: 'Paciente não encontrado.' },
        { status: 404 }
      );
    }

    const [evolucoes, prescricoes, sinaisVitais, pareceres] = await Promise.all([
      listarEvolucoesClinicas({ paciente_id: pacienteId }),
      listarPrescricoesClinicas(pacienteId, false),
      listarSinaisVitaisClinicos(pacienteId, 100),
      listarPareceresClinicos(pacienteId),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        paciente,
        evolucoes,
        prescricoes,
        sinaisVitais,
        pareceres,
      },
    });
  } catch (error: any) {
    console.error('Erro na rota GET /api/gestor/prontuarios/pacientes/[id]:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro ao carregar prontuário completo do paciente.' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const pacienteId = params.id;
    const body = await request.json();

    const pacienteAtualizado = await salvarPacienteClinico({
      ...body,
      id: pacienteId,
    });

    return NextResponse.json({
      success: true,
      data: pacienteAtualizado,
      message: 'Dados do paciente atualizados com sucesso.',
    });
  } catch (error: any) {
    console.error('Erro na rota PUT /api/gestor/prontuarios/pacientes/[id]:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro ao atualizar dados do paciente.' },
      { status: 500 }
    );
  }
}
