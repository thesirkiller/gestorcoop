/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { obterSessao } from '@/lib/sessao';
import {
  listarPlanosTerapeuticosPorPaciente,
  salvarPlanoTerapeutico,
} from '@/lib/db/prontuarios';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!(await obterSessao('gestor'))) return NextResponse.json({ success: false, error: 'Sessão de gestor inválida.' }, { status: 401 });
    const pacienteId = params.id;
    if (!pacienteId) {
      return NextResponse.json({ success: false, error: 'ID do paciente ausente.' }, { status: 400 });
    }

    const planos = await listarPlanosTerapeuticosPorPaciente(pacienteId);
    return NextResponse.json({ success: true, data: planos });
  } catch (error: any) {
    console.error('Erro ao listar planos terapêuticos:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro interno ao consultar planos terapêuticos.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!(await obterSessao('gestor'))) return NextResponse.json({ success: false, error: 'Sessão de gestor inválida.' }, { status: 401 });
    const pacienteId = params.id;
    if (!pacienteId) {
      return NextResponse.json({ success: false, error: 'ID do paciente ausente.' }, { status: 400 });
    }

    const body = await request.json();
    const { id, data_inicio, data_fim, status, observacoes, metas } = body;

    if (!data_inicio || !data_fim) {
      return NextResponse.json(
        { success: false, error: 'Período obrigatório: data_inicio e data_fim devem ser informadas.' },
        { status: 400 }
      );
    }

    if (!Array.isArray(metas) || metas.length === 0) {
      return NextResponse.json(
        { success: false, error: 'O plano terapêutico deve conter ao menos uma meta por especialidade.' },
        { status: 400 }
      );
    }

    const planoSalvo = await salvarPlanoTerapeutico({
      id,
      paciente_id: pacienteId,
      data_inicio,
      data_fim,
      status: status || 'Ativo',
      observacoes: observacoes || '',
      metas: metas.map((m: any) => ({
        id: m.id,
        especialidade: m.especialidade,
        quantidade_prevista: Number(m.quantidade_prevista) || 1,
        profissionais_designados: Array.isArray(m.profissionais_designados) ? m.profissionais_designados : [],
      })),
    });

    return NextResponse.json({ success: true, data: planoSalvo });
  } catch (error: any) {
    console.error('Erro ao salvar plano terapêutico:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro interno ao salvar plano terapêutico.' },
      { status: 500 }
    );
  }
}
