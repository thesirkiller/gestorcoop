/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { obterSessao } from '@/lib/sessao';
import { listarEquipamentosDoPaciente } from '@/lib/prontuario-equipamentos';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

/**
 * Equipamentos locados para o paciente (Bubble). Separado do prontuário 360°
 * porque depende de um serviço externo mais lento: a tela clínica abre com os
 * dados do D1 e os equipamentos chegam em segundo plano.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!(await obterSessao('gestor'))) return NextResponse.json({ success: false, error: 'Sessão de gestor inválida.' }, { status: 401 });
    const pacienteId = params.id;
    if (!pacienteId) {
      return NextResponse.json({ success: false, error: 'ID do paciente ausente.' }, { status: 400 });
    }
    const equipamentos = await listarEquipamentosDoPaciente(pacienteId);
    return NextResponse.json({ success: true, data: equipamentos });
  } catch (error: any) {
    console.error('Erro ao listar equipamentos do paciente:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro ao consultar equipamentos do paciente.' },
      { status: 500 }
    );
  }
}
