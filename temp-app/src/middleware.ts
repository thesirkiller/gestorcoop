import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const session = request.cookies.get('gestor_session');

  // Check if requesting gestor pages or gestor API routes
  const isGestorRoute = request.nextUrl.pathname.startsWith('/gestor') || request.nextUrl.pathname.startsWith('/api/gestor');

  if (isGestorRoute && !session) {
    // If it's an API route, return 401 Unauthorized
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return new NextResponse(
        JSON.stringify({ success: false, error: 'Sessão inválida ou não autenticada.' }),
        { status: 401, headers: { 'content-type': 'application/json' } }
      );
    }

    // For pages, redirect to the login page
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('error', 'token_missing');
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

// Configure which paths the middleware runs on
export const config = {
  matcher: ['/gestor/:path*', '/api/gestor/:path*'],
};
