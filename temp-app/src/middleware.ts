import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Duplicado de propósito em vez de importado de `@/lib/sessao-cooperado`: aquele
// módulo importa `@/lib/bubble`, que instancia o axios e LANÇA no carregamento
// quando BUBBLE_API_URL falta. Arrastar isso para o bundle do middleware, que
// roda no edge a cada requisição, derruba o SSR inteiro.
const COOKIE_SESSAO_COOPERADO = 'cooperado_session';

/**
 * Rotas do prefixo /cooperado que precisam continuar públicas: são o funil de
 * adesão, usado por quem AINDA NÃO é cooperado e portanto não tem como estar
 * autenticado. Proteger `/cooperado/*` inteiro derrubaria o cadastro que já
 * está em produção.
 */
const ROTAS_COOPERADO_PUBLICAS = [
  '/cooperado/adesao',
  '/api/cooperado/adesao',
  '/api/cooperado/verificar-cpf',
  '/api/cooperado/upload',
];

/**
 * Origem autorizada a embutir o app em iframe. O prontuário é aberto dentro de
 * uma página do Bubble; `frame-ancestors` restringe a moldura a essa origem em
 * vez de liberar para qualquer site.
 */
const ORIGEM_EMBED = process.env.EMBED_ORIGEM || 'https://gestorcoop.app';

function naoAutenticado(request: NextRequest, motivo: string) {
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return new NextResponse(
      JSON.stringify({ success: false, error: 'Sessão inválida ou não autenticada.' }),
      { status: 401, headers: { 'content-type': 'application/json' } },
    );
  }
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('error', motivo);
  return NextResponse.redirect(loginUrl);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // NOTA: não existe mais bypass por NODE_ENV. Havia um `if (NODE_ENV ===
  // 'development') return next()` aqui, que desligava a autenticação inteira —
  // incluindo a do gestor — em qualquer ambiente que não fosse marcado como
  // produção. Para testes, os E2E injetam o cookie de sessão diretamente.

  const ehRotaGestor = pathname.startsWith('/gestor') || pathname.startsWith('/api/gestor');
  const ehRotaCooperado = pathname.startsWith('/cooperado') || pathname.startsWith('/api/cooperado');
  const ehPublicaDoCooperado = ROTAS_COOPERADO_PUBLICAS.some((rota) => pathname.startsWith(rota));

  if (ehRotaGestor && !request.cookies.get('gestor_session')) {
    return naoAutenticado(request, 'token_missing');
  }

  if (ehRotaCooperado && !ehPublicaDoCooperado) {
    if (!request.cookies.get(COOKIE_SESSAO_COOPERADO)) {
      return naoAutenticado(request, 'cooperado_token_missing');
    }
  }

  const resposta = NextResponse.next();

  // Só o prontuário é embutido no Bubble; o resto continua sem permissão de
  // moldura. `frame-ancestors` substitui o X-Frame-Options, que não aceita
  // origem específica em todos os navegadores.
  if (ehRotaCooperado) {
    resposta.headers.set('Content-Security-Policy', `frame-ancestors 'self' ${ORIGEM_EMBED}`);
  } else {
    resposta.headers.set('X-Frame-Options', 'DENY');
  }

  return resposta;
}

export const config = {
  matcher: ['/gestor/:path*', '/api/gestor/:path*', '/cooperado/:path*', '/api/cooperado/:path*'],
};
