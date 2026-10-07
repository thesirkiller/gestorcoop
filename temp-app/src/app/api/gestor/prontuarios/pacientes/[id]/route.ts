/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { obterSessao } from '@/lib/sessao';
import {
  carregarProntuario360,
  salvarPacienteClinico,
} from '@/lib/db/prontuarios';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

/**
 * Prontuário 360° em uma requisição e uma ida ao D1.
 *
 * Mantém os campos de sempre (`paciente`, `evolucoes`, `prescricoes`,
 * `sinaisVitais`, `pareceres`) e acrescenta `planos`, `planoVigente` e
 * `pendencias`. `completo: true` avisa a tela de detalhe que não precisa mais
 * buscar `/planos`, `/prescricoes`, `/sinais-vitais` e `/parecer` em seguida —
 * clientes antigos simplesmente ignoram os campos extras.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!(await obterSessao('gestor'))) return NextResponse.json({ success: false, error: 'Sessão de gestor inválida.' }, { status: 401 });
    const pacienteId = params.id;
    const prontuario = await carregarProntuario360(pacienteId, { limiteSinais: 100 });

    if (!prontuario) {
      return NextResponse.json(
        { success: false, error: 'Paciente não encontrado.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        ...prontuario,
        pendencias: prontuario.planoVigente?.pendencias_alertas || [],
        completo: true,
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
    if (!(await obterSessao('gestor'))) return NextResponse.json({ success: false, error: 'Sessão de gestor inválida.' }, { status: 401 });
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
