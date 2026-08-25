/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { registrarParecerClinico, listarPareceresClinicos } from '@/lib/db/prontuarios';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const pacienteId = params.id;
    const pareceres = await listarPareceresClinicos(pacienteId);
    return NextResponse.json({ success: true, data: pareceres });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const pacienteId = params.id;
    const body = await request.json();

    if (!body.descricao || !body.tipo_parecer) {
      return NextResponse.json(
        { success: false, error: 'Descrição e tipo de parecer são obrigatórios.' },
        { status: 400 }
      );
    }

    const parecer = await registrarParecerClinico({
      paciente_id: pacienteId,
      evolucao_id: body.evolucao_id,
      auditor_id: body.auditor_id || 'gestor_admin',
      auditor_nome: body.auditor_nome || 'Dr. Médico Auditor',
      tipo_parecer: body.tipo_parecer,
      descricao: body.descricao,
      data_registro: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      data: parecer,
      message: 'Parecer de auditoria clínica registrado com sucesso.',
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
