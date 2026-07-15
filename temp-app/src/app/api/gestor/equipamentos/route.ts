import { NextRequest, NextResponse } from 'next/server';
import { bubbleApi, Equipamento } from '@/lib/bubble';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function GET() {
  try {
    console.log('Listando todos os equipamentos no Bubble...');
    const list = await bubbleApi.getEquipamentos();
    return NextResponse.json({ success: true, data: list });
  } catch (error) {
    const err = error as { message?: string };
    console.error('Erro ao listar equipamentos:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Erro ao buscar equipamentos' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { txt_nome, txt_descricao, txt_marca, txt_modelo, txt_numero_serie, num_preco_padrao } = body;

    if (!txt_nome || !txt_numero_serie || num_preco_padrao === undefined) {
      return NextResponse.json(
        { success: false, error: 'Nome, número de série e preço padrão são obrigatórios.' },
        { status: 400 }
      );
    }

    console.log('Criando novo equipamento no Bubble:', txt_nome);
    const newEquip: Omit<Equipamento, '_id' | 'CreatedDate'> = {
      txt_nome,
      txt_descricao,
      txt_marca,
      txt_modelo,
      txt_numero_serie,
      num_preco_padrao: Number(num_preco_padrao),
      txt_status: 'Disponível',
    };

    const created = await bubbleApi.createEquipamento(newEquip);
    return NextResponse.json({ success: true, data: created });
  } catch (error) {
    const err = error as { message?: string };
    console.error('Erro ao criar equipamento:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Erro ao criar equipamento' },
      { status: 500 }
    );
  }
}
