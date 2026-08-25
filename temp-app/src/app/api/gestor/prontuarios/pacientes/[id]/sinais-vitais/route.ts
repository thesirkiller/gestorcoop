/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { listarSinaisVitaisClinicos, registrarSinalVitalClinico } from '@/lib/db/prontuarios';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const pacienteId = params.id;
    const sinais = await listarSinaisVitaisClinicos(pacienteId, 100);
    return NextResponse.json({ success: true, data: sinais });
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

    const sinal = await registrarSinalVitalClinico({
      paciente_id: pacienteId,
      evolucao_id: body.evolucao_id,
      data_hora: body.data_hora || new Date().toISOString(),
      pa_sistolica: body.pa_sistolica ? Number(body.pa_sistolica) : undefined,
      pa_diastolica: body.pa_diastolica ? Number(body.pa_diastolica) : undefined,
      fc_bpm: body.fc_bpm ? Number(body.fc_bpm) : undefined,
      fr_rpm: body.fr_rpm ? Number(body.fr_rpm) : undefined,
      temp_celsius: body.temp_celsius ? Number(body.temp_celsius) : undefined,
      spo2_percent: body.spo2_percent ? Number(body.spo2_percent) : undefined,
      glicemia_mg_dl: body.glicemia_mg_dl ? Number(body.glicemia_mg_dl) : undefined,
      dor_escala: body.dor_escala !== undefined ? Number(body.dor_escala) : undefined,
      nivel_consciencia: body.nivel_consciencia || 'Alerta',
      observacoes: body.observacoes || '',
      profissional_id: body.profissional_id,
      profissional_nome: body.profissional_nome || 'Profissional Cooperado',
    });

    return NextResponse.json({
      success: true,
      data: sinal,
      message: 'Sinais vitais registrados com sucesso.',
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
