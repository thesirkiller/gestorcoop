import { NextRequest, NextResponse } from 'next/server';
import { bubbleApi } from '@/lib/bubble';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

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

    // Salvar sessão do gestor em cookie seguro (HTTP-only)
    const cookieStore = cookies();
    cookieStore.set('gestor_session', user._id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 12, // 12 horas
      path: '/',
    });

    // Redireciona para o destino
    return NextResponse.redirect(new URL(redirectPath, request.url));
  } catch (error) {
    console.error('Erro no fluxo SSO:', error);
    return NextResponse.redirect(new URL('/login?error=internal_error', request.url));
  }
}
