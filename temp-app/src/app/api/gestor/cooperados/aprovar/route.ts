import { NextResponse } from 'next/server';
import { bubbleApi } from '@/lib/bubble';

export async function POST(request: Request) {
  try {
    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ error: 'ID do cooperado é obrigatório' }, { status: 400 });
    }

    console.log(`Aprovando cooperado: ${id}`);
    const dummyUserId = '1632307664083x948858892871476400'; // valid Bubble User ID
    
    await bubbleApi.updateCooperado(id, {
      fk_usuario: dummyUserId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const err = error as { message?: string };
    console.error('Erro ao aprovar cooperado:', err);
    return NextResponse.json({ error: err.message || 'Erro ao aprovar cooperado' }, { status: 500 });
  }
}
