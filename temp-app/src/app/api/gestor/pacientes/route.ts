import { NextRequest, NextResponse } from 'next/server';
import { bubbleApi, Paciente } from '@/lib/bubble';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function GET() {
  try {
    console.log('Listando todos os pacientes no Bubble...');
    const list = await bubbleApi.getPacientes();
    return NextResponse.json({ success: true, data: list });
  } catch (error) {
    const err = error as { message?: string };
    console.error('Erro ao listar pacientes:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Erro ao buscar pacientes' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { txt_nome, txt_cpf, txt_whatsapp, txt_endereco, txt_email, txt_tipo } = body;

    if (!txt_nome || !txt_endereco) {
      return NextResponse.json(
        { success: false, error: 'Nome e Endereço de Entrega são obrigatórios.' },
        { status: 400 }
      );
    }

    console.log('Criando novo paciente no Bubble:', txt_nome);
    const newPaciente: Omit<Paciente, '_id' | 'CreatedDate'> = {
      txt_nome,
      txt_cpf: txt_cpf || '',
      txt_whatsapp: txt_whatsapp || '',
      txt_endereco,
      txt_email: txt_email || '',
      txt_tipo: txt_tipo || 'Homecare',
    };

    const created = await bubbleApi.createPaciente(newPaciente);
    return NextResponse.json({ success: true, data: created });
  } catch (error) {
    const err = error as { message?: string };
    console.error('Erro ao criar paciente:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Erro ao criar paciente' },
      { status: 500 }
    );
  }
}
