/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import {
  obterPacienteClinico,
  obterPlanoTerapeuticoVigente,
  listarPlanosTerapeuticosPorPaciente,
  listarEvolucoesClinicas,
  listarPrescricoesClinicas,
  listarSinaisVitaisClinicos,
  listarPareceresClinicos,
} from '@/lib/db/prontuarios';
import { bubbleApi } from '@/lib/bubble';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const pacienteId = params.id;
    if (!pacienteId) {
      return NextResponse.json({ success: false, error: 'ID do paciente ausente.' }, { status: 400 });
    }

    const paciente = await obterPacienteClinico(pacienteId);
    if (!paciente) {
      return NextResponse.json({ success: false, error: 'Paciente não encontrado.' }, { status: 404 });
    }

    // Buscar dados clínicos
    const [planoVigente, todosPlanos, evolucoes, prescricoes, sinaisVitais, pareceres] = await Promise.all([
      obterPlanoTerapeuticoVigente(pacienteId),
      listarPlanosTerapeuticosPorPaciente(pacienteId),
      listarEvolucoesClinicas({ paciente_id: pacienteId }),
      listarPrescricoesClinicas(pacienteId),
      listarSinaisVitaisClinicos(pacienteId, 5),
      listarPareceresClinicos(pacienteId),
    ]);

    // Buscar equipamentos vinculados ao paciente (do Bubble / D1)
    let equipamentosVinculados: any[] = [];
    try {
      const todasLocacoes = (await bubbleApi.getLocacoes()) as any[];
      const locacoesDoPaciente = todasLocacoes.filter((l) => l.fk_paciente === pacienteId);

      if (locacoesDoPaciente.length > 0) {
        const todosEquipamentos = (await bubbleApi.getEquipamentos()) as any[];
        const eqMap = new Map(todosEquipamentos.map((e) => [e._id, e]));

        equipamentosVinculados = locacoesDoPaciente.map((loc) => {
          const equip = eqMap.get(loc.fk_equipamento) || {};
          return {
            id: loc._id,
            equipamento_id: loc.fk_equipamento,
            nome: equip.txt_nome || loc.txt_nome || 'Equipamento Hospitalar',
            categoria: equip.txt_categoria || 'Domiciliar',
            numero_serie: equip.txt_numero_serie || 'N/A',
            status_locacao: loc.txt_status || 'Ativo',
            data_inicio: loc.date_inicio,
            data_fim_previsto: loc.date_fim_previsto,
            valor_aluguel: loc.num_valor_aluguel,
          };
        });
      }
    } catch (e) {
      console.warn('Não foi possível obter equipamentos do Bubble para o paciente:', e);
    }

    // Compilar estatísticas e pendências
    const pendencias: string[] = planoVigente?.pendencias_alertas || [];

    const estatisticas = {
      total_evolucoes: evolucoes.length,
      prescricoes_ativas: prescricoes.filter((p) => p.status === 'Ativa').length,
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
