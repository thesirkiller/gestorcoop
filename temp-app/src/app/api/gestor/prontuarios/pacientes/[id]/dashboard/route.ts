/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { obterSessao } from '@/lib/sessao';
import { carregarProntuario360 } from '@/lib/db/prontuarios';
import { listarEquipamentosDoPaciente } from '@/lib/prontuario-equipamentos';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!(await obterSessao('gestor'))) return NextResponse.json({ success: false, error: 'Sessão de gestor inválida.' }, { status: 401 });
    const pacienteId = params.id;
    if (!pacienteId) {
      return NextResponse.json({ success: false, error: 'ID do paciente ausente.' }, { status: 400 });
    }

    // Dados clínicos (uma ida ao D1) e equipamentos (Bubble, filtrado pelo
    // paciente) em paralelo. Antes eram ~12 consultas ao D1 em cascata mais a
    // varredura completa de locações e equipamentos no Bubble.
    const [prontuario, equipamentosVinculados] = await Promise.all([
      carregarProntuario360(pacienteId, { limiteSinais: 5 }),
      listarEquipamentosDoPaciente(pacienteId).catch((e) => {
        console.warn('Não foi possível obter equipamentos do Bubble para o paciente:', e);
        return [] as any[];
      }),
    ]);

    if (!prontuario) {
      return NextResponse.json({ success: false, error: 'Paciente não encontrado.' }, { status: 404 });
    }

    const { paciente, planoVigente, planos: todosPlanos, evolucoes, prescricoes: todasPrescricoes, sinaisVitais, pareceres } = prontuario;
    const prescricoes = todasPrescricoes.filter((p) => p.status === 'Ativa');

    // Compilar estatísticas e pendências
    const pendencias: string[] = planoVigente?.pendencias_alertas || [];

    const estatisticas = {
      total_evolucoes: evolucoes.length,
      prescricoes_ativas: prescricoes.length,
      equipamentos_instalados: equipamentosVinculados.filter((e) => e.status_locacao === 'Ativo').length,
      metas_plano_vigente: {
        total_previsto: planoVigente?.total_previsto || 0,
        total_realizado: planoVigente?.total_realizado || 0,
        total_restante: planoVigente?.total_restante || 0,
        percentual_cumprido:
          planoVigente?.total_previsto && planoVigente.total_previsto > 0
            ? Math.min(100, Math.round(((planoVigente.total_realizado || 0) / planoVigente.total_previsto) * 100))
            : 0,
        tem_pendencias: pendencias.length > 0,
      },
    };

    return NextResponse.json({
      success: true,
      data: {
        paciente,
        planoVigente,
        planos: todosPlanos,
        pendencias,
        estatisticas,
        equipamentos: equipamentosVinculados,
        evolucoesRecentes: evolucoes.slice(0, 5),
        prescricoes,
        sinaisVitais,
        pareceres,
      },
    });
  } catch (error: any) {
    console.error('Erro na rota de dashboard do paciente:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro ao carregar dashboard do paciente.' },
      { status: 500 }
    );
  }
}
