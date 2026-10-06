/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { obterSessao } from '@/lib/sessao';
import {
  listarPacientesClinicos,
  salvarPacienteClinico,
  salvarPlanoTerapeutico,
  obterPlanoTerapeuticoVigente,
} from '@/lib/db/prontuarios';
import { bubbleApi } from '@/lib/bubble';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    if (!(await obterSessao('gestor'))) return NextResponse.json({ success: false, error: 'Sessão de gestor inválida.' }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const busca = searchParams.get('busca') || undefined;
    const status = searchParams.get('status') || undefined;
    const complexidade = searchParams.get('complexidade') || undefined;

    // 1. Pacientes cadastrados no banco clínico (D1/memória)
    const pacientesClinicos = await listarPacientesClinicos({
      busca: undefined, // filtramos depois de mesclar com o Bubble
      status,
      complexidade,
    });

    const idsClinicos = new Set(pacientesClinicos.map((p) => p.id));

    // 2. Pacientes vindos da base do GestorCoop no Bubble
    let pacientesBubble: any[] = [];
    try {
      pacientesBubble = (await bubbleApi.getPacientes()) || [];
    } catch (e) {
      console.warn('Não foi possível obter pacientes do Bubble no GET /prontuarios/pacientes:', e);
    }

    const unificados: any[] = [...pacientesClinicos];

    // Mescla pacientes do Bubble que ainda não possuem registro clínico aberto no D1
    for (const b of pacientesBubble) {
      const bId = b._id;
      if (bId && !idsClinicos.has(bId)) {
        unificados.push({
          id: bId,
          nome: b.txt_nome || 'Paciente sem Nome',
          cpf: b.txt_cpf || '',
          data_nascimento: '',
          endereco: b.txt_endereco || '',
          telefone: b.txt_whatsapp || '',
          diagnostico_principal: '',
          cid10: '',
          complexidade: undefined,
          plano_saude: '',
          warnings: [],
          status: 'Ativo',
          limite_visitas_mes: 0,
          origem: 'Bubble',
          tem_plano_terapeutico: false,
        });
      }
    }

    // 3. Verifica para cada paciente se já possui Plano Terapêutico vigente
    for (const p of unificados) {
      try {
        const plano = await obterPlanoTerapeuticoVigente(p.id);
        if (plano && plano.metas && plano.metas.length > 0) {
          p.tem_plano_terapeutico = true;
          p.plano_vigente = {
            id: plano.id,
            data_inicio: plano.data_inicio,
            data_fim: plano.data_fim,
            total_previsto: plano.total_previsto,
            total_realizado: plano.total_realizado,
            total_restante: plano.total_restante,
            tem_pendencias: plano.tem_pendencias,
          };
        } else {
          p.tem_plano_terapeutico = false;
        }
      } catch {
        p.tem_plano_terapeutico = false;
      }
    }

    // 4. Filtragem por busca (nome, CPF, diagnóstico)
    let resultadoFinal = unificados;
    if (busca) {
      const bLower = busca.toLowerCase();
      resultadoFinal = resultadoFinal.filter(
        (p) =>
          (p.nome && p.nome.toLowerCase().includes(bLower)) ||
          (p.cpf && p.cpf.includes(bLower)) ||
          (p.diagnostico_principal && p.diagnostico_principal.toLowerCase().includes(bLower)) ||
          (p.endereco && p.endereco.toLowerCase().includes(bLower))
      );
    }

    return NextResponse.json({
      success: true,
      data: resultadoFinal,
      total: resultadoFinal.length,
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
    if (!(await obterSessao('gestor'))) return NextResponse.json({ success: false, error: 'Sessão de gestor inválida.' }, { status: 401 });
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
