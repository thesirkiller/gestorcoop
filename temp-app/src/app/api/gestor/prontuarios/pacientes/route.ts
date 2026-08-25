/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { listarPacientesClinicos, salvarPacienteClinico } from '@/lib/db/prontuarios';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const busca = searchParams.get('busca') || undefined;
    const status = searchParams.get('status') || undefined;
    const complexidade = searchParams.get('complexidade') || undefined;

    const pacientes = await listarPacientesClinicos({
      busca,
      status,
      complexidade,
    });

    return NextResponse.json({
      success: true,
      data: pacientes,
      total: pacientes.length,
    });
  } catch (error: any) {
    console.error('Erro na rota GET /api/gestor/prontuarios/pacientes:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro ao listar pacientes.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.nome || !body.cpf) {
      return NextResponse.json(
        { success: false, error: 'Nome e CPF são campos obrigatórios.' },
        { status: 400 }
      );
    }

    const pacienteSalvo = await salvarPacienteClinico(body);

    return NextResponse.json({
      success: true,
      data: pacienteSalvo,
      message: 'Paciente clínico cadastrado com sucesso.',
    });
  } catch (error: any) {
    console.error('Erro na rota POST /api/gestor/prontuarios/pacientes:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro ao cadastrar paciente.' },
      { status: 500 }
    );
  }
}
