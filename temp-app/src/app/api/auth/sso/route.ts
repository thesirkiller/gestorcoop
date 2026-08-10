import { NextRequest, NextResponse } from 'next/server';
import { bubbleApi } from '@/lib/bubble';
import { cookies } from 'next/headers';

import { COOKIE_SESSAO_COOPERADO } from '@/lib/sessao-cooperado';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const redirectPath = searchParams.get('redirect') || '/gestor/dashboard';

    if (!token) {
      return NextResponse.redirect(new URL('/login?error=token_missing', request.url));
    }

    console.log('Validando SSO token no Bubble...');
    const user = await bubbleApi.findUserBySSOToken(token);

    if (!user) {
      console.warn('Token SSO inválido ou expirado.');
      return NextResponse.redirect(new URL('/login?error=invalid_token', request.url));
    }

    console.log(`Usuário autenticado via SSO: ${user.authentication?.email || user._id}`);

    // Limpar o token no Bubble para uso único
    await bubbleApi.clearSSOToken(user._id);

    // O cookie emitido depende da área de destino. Antes, todo SSO gravava
    // `gestor_session` — como o middleware só confere a PRESENÇA do cookie,
    // qualquer usuário que obtivesse um token entrava no painel do gestor
    // inteiro. Emitindo a sessão da área pedida, um cooperado que abre o
    // prontuário não recebe de brinde acesso à gestão.
    const ehDestinoCooperado = redirectPath.startsWith('/cooperado');
    const cookieStore = cookies();

    // sameSite 'lax' funciona dentro do iframe do Bubble DESDE QUE o app seja
    // servido num subdomínio de gestorcoop.app (ex.: prontuario.gestorcoop.app).
    // Em domínio distinto (gestorcoop.pages.dev) o navegador trata como
    // cross-site e não envia o cookie — o Safari bloqueia mesmo com 'none'.
    const opcoesCookie = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 60 * 60 * 12, // 12 horas
      path: '/',
    };

    if (ehDestinoCooperado) {
      if (!user.fk_cooperado) {
        console.warn(`User ${user._id} tentou abrir o prontuário sem fk_cooperado vinculado.`);
        return NextResponse.redirect(new URL('/login?error=sem_cooperado_vinculado', request.url));
      }
      cookieStore.set(COOKIE_SESSAO_COOPERADO, user._id, opcoesCookie);
    } else {
      cookieStore.set('gestor_session', user._id, opcoesCookie);
    }

    // Redireciona para o destino
    return NextResponse.redirect(new URL(redirectPath, request.url));
  } catch (error) {
    console.error('Erro no fluxo SSO:', error);
    return NextResponse.redirect(new URL('/login?error=internal_error', request.url));
  }
}
