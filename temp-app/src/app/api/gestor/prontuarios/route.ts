/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { obterSessao } from '@/lib/sessao';
import { listarEvolucoesClinicas, listarEvolucoesResumo } from '@/lib/db/prontuarios';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    if (!(await obterSessao('gestor'))) return NextResponse.json({ success: false, error: 'Sessão de gestor inválida.' }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const pacienteId = searchParams.get('pacienteId') || undefined;
    const profissionalId = searchParams.get('profissionalId') || undefined;
    const specialty = searchParams.get('specialty') || undefined;
    const status = searchParams.get('status') || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    // `limit` inválido (`abc`, `0`, negativo) virava NaN/0 — falso em
    // `montarConsultaEvolucoes`, ou seja, consulta SEM limite (tabela inteira).
    const limiteBruto = parseInt(searchParams.get('limit') || '100', 10);
    const limit = Number.isFinite(limiteBruto) && limiteBruto > 0 ? limiteBruto : 100;
    const filtros = {
      paciente_id: pacienteId,
      profissional_id: profissionalId,
      especialidade: specialty,
      status,
      data_inicio: startDate,
      data_fim: endDate,
      limit,
    };

    // Projeção leve (sem transcrições/áudio/SOAP completo, com contagem de
    // aprazamentos para o KPI). Opt-in por cabeçalho — a URL continua a mesma,
    // então clientes antigos e mocks de URL dos E2E não mudam — ou `?projecao=resumo`.
    // Sem opt-in o payload é o completo de sempre (a reconciliação de
    // medicamentos e o fallback da tela de detalhe dependem dele).
    const projecaoResumo =
      request.headers.get('x-gestorcoop-projecao') === 'resumo' || searchParams.get('projecao') === 'resumo';

    const evolucoes = projecaoResumo
      ? await listarEvolucoesResumo(filtros)
      : await listarEvolucoesClinicas(filtros);

    return NextResponse.json(
      {
        success: true,
        results: evolucoes,
        total: evolucoes.length,
        projecao: projecaoResumo ? 'resumo' : 'completa',
      },
      // Mesma URL, dois formatos: nenhum cache intermediário pode misturá-los.
      { headers: { Vary: 'X-Gestorcoop-Projecao' } }
    );
  } catch (error: any) {
    console.error('Erro na API /api/gestor/prontuarios:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Falha ao buscar prontuários no servidor.',
      },
      { status: 500 }
    );
  }
}
