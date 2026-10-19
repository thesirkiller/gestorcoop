/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { obterSessao } from '@/lib/sessao';
import { listarPrescricoesClinicas, criarPrescricaoClinica } from '@/lib/db/prontuarios';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!(await obterSessao('gestor'))) return NextResponse.json({ success: false, error: 'Sessão de gestor inválida.' }, { status: 401 });
    const pacienteId = params.id;
    const prescricoes = await listarPrescricoesClinicas(pacienteId, false);
    return NextResponse.json({ success: true, data: prescricoes });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!(await obterSessao('gestor'))) return NextResponse.json({ success: false, error: 'Sessão de gestor inválida.' }, { status: 401 });
    const pacienteId = params.id;
    const body = await request.json();

    if (!body.medicamento || !body.dosagem || !body.via_administracao) {
      return NextResponse.json(
        { success: false, error: 'Medicamento, dosagem e via de administração são obrigatórios.' },
        { status: 400 }
      );
    }

    const prescricao = await criarPrescricaoClinica({
      paciente_id: pacienteId,
      medicamento: body.medicamento,
      dosagem: body.dosagem,
      via_administracao: body.via_administracao,
      frequencia_horas: Number(body.frequencia_horas) || 12,
      horarios_padrao: body.horarios_padrao || ['08:00', '20:00'],
      data_inicio: body.data_inicio || new Date().toISOString(),
      data_fim: body.data_fim?.trim() ? body.data_fim.trim() : undefined,
      instrucoes: body.instrucoes || '',
      medico_nome: body.medico_nome?.trim() || undefined,
      medico_crm: body.medico_crm?.trim() || undefined,
      status: 'Ativa',
    });

    return NextResponse.json({
      success: true,
      data: prescricao,
      message: 'Prescrição médica cadastrada e aprazamentos gerados.',
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
