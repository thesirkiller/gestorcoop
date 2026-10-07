import { NextRequest, NextResponse } from 'next/server';
import { bubbleApi, Paciente } from '@/lib/bubble';
import { memoizarComTtl, CHAVE_CACHE_PACIENTES_BUBBLE, TTL_PACIENTES_BUBBLE_MS } from '@/lib/cache-memoria';
import { salvarPacienteClinico } from '@/lib/db/prontuarios';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    // Reutiliza a lista memoizada por isolate para evitar paginação síncrona
    // massiva do Bubble em acessos consecutivos. Invalida imediatamente após criações.
    const aceitaCache = request.headers.get('x-gestorcoop-cache') === 'permitido';
    const ttl = aceitaCache ? TTL_PACIENTES_BUBBLE_MS : 30_000;
    const list = await memoizarComTtl(CHAVE_CACHE_PACIENTES_BUBBLE, ttl, () => bubbleApi.getPacientes());
    return NextResponse.json(
      { success: true, data: list },
      { headers: { Vary: 'X-Gestorcoop-Cache' } }
    );
  } catch (error) {
    const err = error as { message?: string };
    console.error('Erro ao listar pacientes:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Erro ao buscar clientes' },
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

    // Replica imediatamente para o D1 clínico
    if (created._id) {
      try {
        await salvarPacienteClinico({
          id: created._id,
          nome: created.txt_nome,
          cpf: created.txt_cpf || '',
          endereco: created.txt_endereco || '',
          telefone: created.txt_whatsapp || '',
          status: 'Ativo',
          complexidade: 'Baixa',
        });
      } catch (errD1) {
        console.warn('Aviso: Não foi possível replicar paciente criado para D1 imediatamente:', errD1);
      }
    }

    return NextResponse.json({ success: true, data: created });
  } catch (error) {
    const err = error as { message?: string };
    console.error('Erro ao criar paciente:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Erro ao criar cliente' },
      { status: 500 }
    );
  }
}
