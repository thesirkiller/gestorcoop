/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { obterSessao } from '@/lib/sessao';
import {
  listarPacientesComResumoClinico,
  salvarPacienteClinico,
  salvarPlanoTerapeutico,
  getClinicalDb,
  inMemoryPacientes,
} from '@/lib/db/prontuarios';
import { sincronizarPacientesBubbleParaD1 } from '@/lib/sync-pacientes';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

/*
 * Listagem de pacientes de prontuários: lê diretamente do D1 em 1 round trip,
 * com contadores clínicos (prescrições ativas indexadas, última evolução, cota mensal)
 * e plano vigente calculados em batch. A sincronização Bubble -> D1 roda em segundo
 * plano via cron-worker (/api/cron/sync-pacientes-bubble), eliminando a paginação
 * pesada do Bubble do caminho síncrono das requisições do usuário.
 */

export async function GET(request: NextRequest) {
  try {
    if (!(await obterSessao('gestor', request))) {
      return NextResponse.json({ success: false, error: 'Sessão de gestor inválida.' }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const busca = searchParams.get('busca') || undefined;
    const status = searchParams.get('status') || undefined;
    const complexidade = searchParams.get('complexidade') || undefined;
    const pageParam = searchParams.get('page');
    const limitParam = searchParams.get('limit');
    const pageParsed = pageParam ? parseInt(pageParam, 10) : undefined;
    const limitParsed = limitParam ? parseInt(limitParam, 10) : undefined;
    const page = Number.isInteger(pageParsed) && pageParsed! >= 1 ? pageParsed : undefined;
    const limit = Number.isInteger(limitParsed) && limitParsed! >= 1 ? Math.min(limitParsed!, 500) : undefined;

    // 1. Leitura direta do D1 em batch único agregado com paginação e filtros
    let resumoClinico = await listarPacientesComResumoClinico({
      status,
      complexidade,
      busca,
      page,
      limit,
    });

    // Fallback: se o banco estiver vazio (ex: primeiro start antes do cron rodar),
    // aciona sincronização inicial para popular a base
    if ((resumoClinico.total ?? resumoClinico.pacientes.length) === 0 && !busca && !status && !complexidade) {
      try {
        const db = getClinicalDb();
        let precisaSync = false;
        if (db) {
          const count = await db.prepare('SELECT COUNT(*) AS total FROM pacientes').first<{ total: number }>();
          precisaSync = !count || Number(count.total) === 0;
        } else {
          precisaSync = inMemoryPacientes.size === 0;
        }

        if (precisaSync) {
          console.log('[prontuarios/pacientes] Base vazia; sincronizando base inicial do Bubble...');
          await sincronizarPacientesBubbleParaD1({ db });
          resumoClinico = await listarPacientesComResumoClinico({
            status,
            complexidade,
            busca,
            page,
            limit,
          });
        }
      } catch (errFallback) {
        console.warn('[prontuarios/pacientes] Fallback de sincronização inicial falhou:', errFallback);
      }
    }

    const { pacientes, planosVigentes, total, totalPages } = resumoClinico;

    // 2. Plano Terapêutico vigente de cada paciente (já calculado no batch)
    for (const p of pacientes) {
      const plano = planosVigentes.get(p.id);
      if (plano && plano.metas && plano.metas.length > 0) {
        p.tem_plano_terapeutico = true;
        p.plano_vigente = {
          id: plano.id,
          data_inicio: plano.data_inicio,
          data_fim: plano.data_fim,
          total_previsto: plano.total_previsto ?? 0,
          total_realizado: plano.total_realizado ?? 0,
          total_restante: plano.total_restante ?? 0,
          tem_pendencias: Boolean(plano.tem_pendencias),
        };
      } else {
        p.tem_plano_terapeutico = false;
      }
    }

    return NextResponse.json({
      success: true,
      data: pacientes,
      total: total ?? pacientes.length,
      page: page ?? 1,
      limit: limit ?? (total ?? pacientes.length),
      totalPages: totalPages ?? 1,
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
    if (!(await obterSessao('gestor', request))) return NextResponse.json({ success: false, error: 'Sessão de gestor inválida.' }, { status: 401 });
    const body = await request.json();
    if (!body.nome) {
      return NextResponse.json(
        { success: false, error: 'O nome do paciente é obrigatório.' },
        { status: 400 }
      );
    }

    // Se vier do Bubble ou sem CPF, define máscara padrão
    const cpfFinal = body.cpf || '';

    // 1. Salva ou atualiza paciente clínico no D1/memória
    const pacienteSalvo = await salvarPacienteClinico({
      id: body.id, // preserva o _id do Bubble se fornecido
      nome: body.nome,
      cpf: cpfFinal,
      data_nascimento: body.data_nascimento || '',
      endereco: body.endereco || '',
      telefone: body.telefone || '',
      responsavel_nome: body.responsavel_nome || '',
      responsavel_telefone: body.responsavel_telefone || '',
      diagnostico_principal: body.diagnostico_principal || 'Acompanhamento Multiprofissional',
      cid10: body.cid10 || '',
      complexidade: body.complexidade || 'Média',
      plano_saude: body.plano_saude || '',
      numero_carteirinha: body.numero_carteirinha || '',
      warnings: body.warnings || [],
      status: body.status || 'Ativo',
      limite_visitas_mes: Number(body.limite_visitas_mes || 0),
    });

    // 2. Se vier com Plano Terapêutico Multiprofissional Dinâmico, salva e vincula
    let planoSalvo = null;
    if (
      body.plano_terapeutico &&
      Array.isArray(body.plano_terapeutico.metas) &&
      body.plano_terapeutico.metas.length > 0
    ) {
      const { data_inicio, data_fim, observacoes, metas } = body.plano_terapeutico;
      planoSalvo = await salvarPlanoTerapeutico({
        paciente_id: pacienteSalvo.id,
        data_inicio: data_inicio || new Date().toISOString().split('T')[0],
        data_fim: data_fim || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
        status: 'Ativo',
        observacoes: observacoes || 'Plano Terapêutico iniciado na admissão clínica.',
        metas: metas.map((m: any) => ({
          especialidade: m.especialidade,
          quantidade_prevista: Number(m.quantidade_prevista) || 1,
          profissionais_designados: m.profissionais_designados || [],
        })),
      });
    }

    return NextResponse.json({
      success: true,
      data: pacienteSalvo,
      plano: planoSalvo,
      message: 'Paciente clínico e Plano Terapêutico iniciados com sucesso.',
    });
  } catch (error: any) {
    console.error('Erro na rota POST /api/gestor/prontuarios/pacientes:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro ao cadastrar paciente e iniciar plano.' },
      { status: 500 }
    );
  }
}
