import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { extrairSubdominio } from '@/lib/subdominios';

// Duplicado de propósito em vez de importado de `@/lib/sessao-cooperado`: aquele
// módulo importa `@/lib/bubble`, que instancia o axios e LANÇA no carregamento
// quando BUBBLE_API_URL falta. Arrastar isso para o bundle do middleware, que
// roda no edge a cada requisição, derruba o SSR inteiro.
const COOKIE_SESSAO_COOPERADO = 'cooperado_session';
const COOKIE_SESSAO_GESTOR = 'gestor_session';

/**
 * Rotas do prefixo /cooperado que precisam continuar públicas: são o funil de
 * adesão, usado por quem AINDA NÃO é cooperado e portanto não tem como estar
 * autenticado. Proteger `/cooperado/*` inteiro derrubaria o cadastro que já
 * está em produção.
 */
const ROTAS_COOPERADO_PUBLICAS = [
  '/adesao',
  '/cooperado/adesao',
  '/api/cooperado/adesao',
  '/api/cooperado/verificar-cpf',
  '/api/cooperado/upload',
  '/api/webhooks',
];

/**
 * Origens autorizadas a embutir o app em iframe (ex: Bubble / portal institucional).
 */
const ORIGEM_EMBED =
  process.env.EMBED_ORIGEM ||
  'https://gestorcoop.app https://cooperado.gestorcoop.app https://gestao.gestorcoop.app https://cooperacao.gestorcoop.app https://appgestorcoop.bubbleapps.io';

function aplicarHeadersSeguranca(resposta: NextResponse, ehRotaCooperado?: boolean): NextResponse {
  // Permite renderizacao em iframe nos portais autorizados (Bubble e subdominios)
  if (ehRotaCooperado !== undefined) {
    resposta.headers.set('Content-Security-Policy', `frame-ancestors 'self' ${ORIGEM_EMBED}`);
  } else {
    resposta.headers.set('Content-Security-Policy', `frame-ancestors 'self' ${ORIGEM_EMBED}`);
  }
  return resposta;
}

function naoAutenticado(request: NextRequest, motivo: string, area?: 'gestor' | 'cooperado') {
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return new NextResponse(
      JSON.stringify({ success: false, error: 'Sessão inválida ou não autenticada.' }),
      { status: 401, headers: { 'content-type': 'application/json' } }
    );
  }
  const loginUrl = new URL('/login', request.url);
  const redirectPath = request.nextUrl.pathname + request.nextUrl.search;
  if (redirectPath !== '/' && redirectPath !== '/login') {
    loginUrl.searchParams.set('redirect', redirectPath);
  }
  loginUrl.searchParams.set('error', motivo);
  if (area) {
    loginUrl.searchParams.set('area', area);
  } else if (request.nextUrl.pathname.startsWith('/gestor')) {
    loginUrl.searchParams.set('area', 'gestor');
  } else if (request.nextUrl.pathname.startsWith('/cooperado')) {
    loginUrl.searchParams.set('area', 'cooperado');
  }
  return NextResponse.redirect(loginUrl);
}

function rotaBloqueada(request: NextRequest, mensagem: string) {
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return new NextResponse(
      JSON.stringify({ success: false, error: mensagem }),
      { status: 403, headers: { 'content-type': 'application/json' } }
    );
  }
  // Redireciona páginas para o portal apropriado de gestão
  const loginGestao = new URL('https://gestao.gestorcoop.app/login');
  loginGestao.searchParams.set('error', 'acesso_restrito_gestao');
  loginGestao.searchParams.set('area', 'gestor');
  return NextResponse.redirect(loginGestao);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Ignora assets estáticos e chunks do Next.js
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.match(/\.(png|jpg|jpeg|gif|webp|svg|woff|woff2|css|js)$/)
  ) {
    return NextResponse.next();
  }

  // Extrai subdomínio via Host, X-Forwarded-Host ou headers/params de teste
  const hostHeader =
    request.headers.get('x-subdomain') ||
    request.nextUrl.searchParams.get('__subdomain') ||
    request.headers.get('x-forwarded-host') ||
    request.headers.get('host') ||
    request.nextUrl.hostname ||
    '';

  const subdominio = extrairSubdominio(hostHeader);

  // =========================================================================
  // SUBDOMÍNIO 1: COOPERAÇÃO ONLINE (cooperacao.gestorcoop.app)
  // Destinado exclusivamente ao funil de adesão online de novos cooperados
  // =========================================================================
  if (subdominio === 'cooperacao') {
    // Bloqueia qualquer tentativa de acessar gestão
    if (pathname.startsWith('/gestor') || pathname.startsWith('/api/gestor')) {
      return rotaBloqueada(request, 'Área restrita ao painel de gestão.');
    }

    // Redireciona prontuários para o subdomínio correto do cooperado
    if (pathname.startsWith('/cooperado/prontuario') || pathname.startsWith('/prontuario')) {
      const urlDestino = new URL(`https://cooperado.gestorcoop.app${pathname}`);
      return NextResponse.redirect(urlDestino);
    }

    // Raiz ou /adesao rewrites diretamente para /adesao (página completa de adesão sem casca mobile)
    if (pathname === '/' || pathname === '/adesao') {
      const url = request.nextUrl.clone();
      url.pathname = '/adesao';
      return aplicarHeadersSeguranca(NextResponse.rewrite(url), true);
    }

    // Rotas de adesão e suas APIs
    if (
      pathname.startsWith('/adesao') ||
      pathname.startsWith('/cooperado/adesao') ||
      ROTAS_COOPERADO_PUBLICAS.some((rota) => pathname.startsWith(rota)) ||
      pathname.startsWith('/api/webhooks') ||
      pathname === '/login' ||
      pathname.startsWith('/api/auth')
    ) {
      return aplicarHeadersSeguranca(NextResponse.next(), true);
    }

    // Qualquer outra rota no subdomínio é reescrita para a página de adesão de tela inteira
    const url = request.nextUrl.clone();
    url.pathname = '/adesao';
    return aplicarHeadersSeguranca(NextResponse.rewrite(url), true);
  }

  // =========================================================================
  // SUBDOMÍNIO 2: PORTAL DO COOPERADO (cooperado.gestorcoop.app)
  // Destinado a cooperados ativos: agenda, plantões, prontuários de atendimento
  // Isolado de qualquer visão de gestão administrativa
  // =========================================================================
  if (subdominio === 'cooperado') {
    // Permite tela de login e rotas de autenticação
    if (pathname === '/login' || pathname.startsWith('/api/auth')) {
      return aplicarHeadersSeguranca(NextResponse.next(), true);
    }

    // Segurança rígida: cooperado NÃO tem acesso ao painel de gestão nem suas APIs
    if (pathname.startsWith('/gestor') || pathname.startsWith('/api/gestor')) {
      return rotaBloqueada(request, 'Acesso restrito ao painel de gestão administrativa.');
    }

    const temCookie =
      !!request.cookies.get(COOKIE_SESSAO_COOPERADO) || !!request.cookies.get(COOKIE_SESSAO_GESTOR);

    // Se estiver deslogado, redireciona imediatamente para o login do cooperado
    if (!temCookie) {
      const loginUrl = new URL('/login', request.url);
      if (pathname !== '/' && pathname !== '/cooperado') {
        loginUrl.searchParams.set('redirect', pathname + request.nextUrl.search);
      }
      loginUrl.searchParams.set('area', 'cooperado');
      return NextResponse.redirect(loginUrl, 302);
    }

    // Raiz rewrites para /cooperado (agenda/atividades)
    if (pathname === '/') {
      const url = request.nextUrl.clone();
      url.pathname = '/cooperado';
      return aplicarHeadersSeguranca(NextResponse.rewrite(url), true);
    }

    // Rota limpa de prontuário: /prontuario/:id -> rewrites para /cooperado/prontuario/:id
    if (pathname.startsWith('/prontuario/')) {
      const url = request.nextUrl.clone();
      url.pathname = `/cooperado${pathname}`;
      return aplicarHeadersSeguranca(NextResponse.rewrite(url), true);
    }

    // Rota direta: /cooperado/prontuario/:id
    if (pathname.startsWith('/cooperado/prontuario')) {
      return aplicarHeadersSeguranca(NextResponse.next(), true);
    }

    // APIs do cooperado
    if (pathname.startsWith('/api/cooperado')) {
      const ehPublica = ROTAS_COOPERADO_PUBLICAS.some((rota) => pathname.startsWith(rota));
      if (!ehPublica) {
        const temToken = !!request.headers.get('authorization');
        if (!temCookie && !temToken) {
          return naoAutenticado(request, 'cooperado_token_missing', 'cooperado');
        }
      }
      return NextResponse.next();
    }

    return aplicarHeadersSeguranca(NextResponse.next(), true);
  }

  // =========================================================================
  // SUBDOMÍNIO 3: GESTÃO & ADMINISTRAÇÃO (gestao.gestorcoop.app)
  // Destinado a gestores: prontuários 360°, auditoria, equipamentos, financeiro
  // =========================================================================
  if (subdominio === 'gestao') {
    // Permite livremente tela de login, rotas de autenticação e iframe embed exchange
    if (pathname === '/login' || pathname.startsWith('/api/auth') || pathname === '/entrar') {
      return aplicarHeadersSeguranca(NextResponse.next(), false);
    }

    const temCookieGestor = !!request.cookies.get(COOKIE_SESSAO_GESTOR);

    // Raiz na gestão rewrites para prontuários (ou login se sem sessão)
    if (pathname === '/') {
      if (!temCookieGestor) {
        return naoAutenticado(request, 'token_missing', 'gestor');
      }
      const url = request.nextUrl.clone();
      url.pathname = '/gestor/prontuarios';
      return aplicarHeadersSeguranca(NextResponse.rewrite(url), false);
    }

    // Atalhos amigáveis na gestão
    const aliasesGestor: Record<string, string> = {
      '/prontuarios': '/gestor/prontuarios',
      '/dashboard': '/gestor/dashboard',
      '/equipamentos': '/gestor/equipamentos',
      '/financeiro': '/gestor/financeiro',
      '/termos': '/gestor/termos',
      '/baixas': '/gestor/baixas',
      '/manutencao': '/gestor/manutencao',
    };

    const aliasMatch = Object.keys(aliasesGestor).find(
      (prefix) => pathname === prefix || pathname.startsWith(prefix + '/')
    );

    if (aliasMatch) {
      if (!temCookieGestor) {
        return naoAutenticado(request, 'token_missing', 'gestor');
      }
      const url = request.nextUrl.clone();
      url.pathname = pathname.replace(aliasMatch, aliasesGestor[aliasMatch]);
      return aplicarHeadersSeguranca(NextResponse.rewrite(url), false);
    }

    // Rotas com prefixo /gestor e /api/gestor
    if (pathname.startsWith('/gestor') || pathname.startsWith('/api/gestor')) {
      if (!temCookieGestor) {
        return naoAutenticado(request, 'token_missing', 'gestor');
      }
      return aplicarHeadersSeguranca(NextResponse.next(), false);
    }

    return aplicarHeadersSeguranca(NextResponse.next(), false);
  }

  // =========================================================================
  // DEFAULT / APEX / DEV LOCAL / TESTES (gestorcoop.app, localhost, pages.dev)
  // Roteamento baseado em caminhos tradicional para compatibilidade total
  // =========================================================================
  const ehRotaGestor = pathname.startsWith('/gestor') || pathname.startsWith('/api/gestor');
  const ehRotaCooperado = pathname.startsWith('/cooperado') || pathname.startsWith('/api/cooperado');
  const ehPublicaDoCooperado = ROTAS_COOPERADO_PUBLICAS.some((rota) => pathname.startsWith(rota));

  if (ehRotaGestor && !request.cookies.get(COOKIE_SESSAO_GESTOR)) {
    return naoAutenticado(request, 'token_missing', 'gestor');
  }

  const ehProntuario =
    pathname.startsWith('/cooperado/prontuario') || pathname.startsWith('/prontuario');
  if (ehProntuario && !ehPublicaDoCooperado) {
    const temCookieCooperado = !!request.cookies.get(COOKIE_SESSAO_COOPERADO);
    const temCookieGestor = !!request.cookies.get(COOKIE_SESSAO_GESTOR);
    if (!temCookieCooperado && !temCookieGestor) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname + request.nextUrl.search);
      return NextResponse.redirect(loginUrl);
    }
  }

  const ehApiCooperado = pathname.startsWith('/api/cooperado');
  if (ehApiCooperado && !ehPublicaDoCooperado) {
    const temCookie =
      !!request.cookies.get(COOKIE_SESSAO_COOPERADO) || !!request.cookies.get(COOKIE_SESSAO_GESTOR);
    const temToken = !!request.headers.get('authorization');
    if (!temCookie && !temToken) {
      return naoAutenticado(request, 'cooperado_token_missing');
    }
  }

  return aplicarHeadersSeguranca(NextResponse.next(), ehRotaCooperado);
}

export const config = {
  matcher: [
    /*
     * Intercepta todas as requisições de página e API, exceto arquivos estáticos
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff|woff2)$).*)',
  ],
};
