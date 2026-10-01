/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import {
  obterPacienteClinico,
  salvarPacienteClinico,
  listarEvolucoesClinicas,
  listarPrescricoesClinicas,
  listarSinaisVitaisClinicos,
  listarPareceresClinicos,
} from '@/lib/db/prontuarios';
import { bubbleApi } from '@/lib/bubble';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const pacienteId = params.id;
    let paciente = await obterPacienteClinico(pacienteId);

    // Se não encontrou no D1/memória, tenta buscar da base do Bubble
    if (!paciente) {
      try {
        const bubblePac = await bubbleApi.getPaciente(pacienteId);
        if (bubblePac && bubblePac._id) {
          paciente = await salvarPacienteClinico({
            id: bubblePac._id,
            nome: bubblePac.txt_nome || 'Paciente sem Nome',
            cpf: bubblePac.txt_cpf || '000.000.000-00',
            endereco: bubblePac.txt_endereco || '',
            telefone: bubblePac.txt_whatsapp || '',
            diagnostico_principal: 'Paciente cadastrado no GestorCoop (Bubble)',
            complexidade: 'Média',
            status: 'Ativo',
            limite_visitas_mes: 0,
            warnings: bubblePac.fks_equipamentos?.length ? ['Possui equipamentos em casa'] : [],
          });
        }
      } catch (eBubble) {
        console.warn('Paciente não localizado no Bubble:', eBubble);
      }
    }

    if (!paciente) {
      return NextResponse.json(
        { success: false, error: 'Paciente não encontrado.' },
        { status: 404 }
      );
    }

    const [evolucoes, prescricoes, sinaisVitais, pareceres] = await Promise.all([
      listarEvolucoesClinicas({ paciente_id: pacienteId }),
      listarPrescricoesClinicas(pacienteId, false),
      listarSinaisVitaisClinicos(pacienteId, 100),
      listarPareceresClinicos(pacienteId),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        paciente,
        evolucoes,
        prescricoes,
        sinaisVitais,
        pareceres,
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
