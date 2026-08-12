import { NextRequest, NextResponse } from 'next/server';
import { bubbleApi } from '@/lib/bubble';
import { cookies } from 'next/headers';

import { COOKIE_SESSAO_COOPERADO } from '@/lib/sessao-cooperado';
import { assinarTokenSessao } from '@/lib/sessao-token';

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

    // sameSite 'lax' só chega ao iframe do Bubble se o app for servido num
    // domínio same-site de gestorcoop.app. Como não haverá subdomínio, o cookie
    // continua sendo emitido (vale quando o app é primeira-parte: aba própria,
    // WebView abrindo a URL direto) e o token assinado abaixo cobre o caso
    // cross-site. Ver `src/lib/sessao-token.ts`.
    const opcoesCookie = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 60 * 60 * 12, // 12 horas
      path: '/',
    };

    const destino = new URL(redirectPath, request.url);

    if (ehDestinoCooperado) {
      if (!user.fk_cooperado) {
        console.warn(`User ${user._id} tentou abrir o prontuário sem fk_cooperado vinculado.`);
        return NextResponse.redirect(new URL('/login?error=sem_cooperado_vinculado', request.url));
      }
      cookieStore.set(COOKIE_SESSAO_COOPERADO, user._id, opcoesCookie);

      // O token vai no FRAGMENTO, não na query: fragmento não é enviado ao
      // servidor, não entra em log de acesso nem no cabeçalho `Referer` de
      // requisições que saiam da página. O cliente o guarda e limpa a barra de
      // endereços em seguida (`src/lib/api-cliente.ts`).
      let token: string;
      try {
        token = await assinarTokenSessao(user._id);
      } catch (erro) {
        // Falhar aqui é melhor que entregar uma sessão que só funciona fora do
        // iframe: dentro dele o profissional veria a tela carregar e toda
        // chamada de dados responder 401, sem explicação.
        console.error('Não foi possível emitir o token de sessão do cooperado:', erro);
        return NextResponse.redirect(new URL('/login?error=assinatura_nao_configurada', request.url));
      }
      destino.hash = `s=${token}`;
    } else {
      cookieStore.set('gestor_session', user._id, opcoesCookie);
    }

    return NextResponse.redirect(destino);
  } catch (error) {
    console.error('Erro no fluxo SSO:', error);
    return NextResponse.redirect(new URL('/login?error=internal_error', request.url));
  }
}
