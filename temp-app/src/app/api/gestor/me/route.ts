import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { bubbleApi } from '@/lib/bubble';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

// Dados do usuário logado para o header do painel (nome, e-mail, foto).
// A sessão em si é validada pelo middleware; aqui só resolvemos o perfil.
export async function GET() {
  const userId = cookies().get('gestor_session')?.value;
  if (!userId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  try {
    const user = await bubbleApi.getUser(userId);
    let foto: string | null = user?.img_foto || null;
    if (foto && foto.startsWith('//')) foto = `https:${foto}`;

    return NextResponse.json({
      nome: user?.txt_nome || 'Gestor',
      email: user?.authentication?.email?.email || '',
      foto,
    });
  } catch (error) {
    console.error('Erro ao buscar usuário da sessão:', error);
    // Header degrada para um perfil genérico em vez de quebrar o painel.
    return NextResponse.json({ nome: 'Gestor', email: '', foto: null });
  }
}
