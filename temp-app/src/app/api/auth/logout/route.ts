import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDb } from '@/lib/db/client';
import { tokenDoCabecalho, validarTokenSessao } from '@/lib/sessao-token';
import { invalidarSessaoMemoria } from '@/lib/cache-memoria';
import { obterDominioCookie } from '@/lib/subdominios';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function POST(request: NextRequest) {
  const header = request.headers.get('authorization');
  let gestorCookie = request.cookies?.get?.('gestor_session')?.value;
  let cooperadoCookie = request.cookies?.get?.('cooperado_session')?.value;

  if (!gestorCookie || !cooperadoCookie) {
    try {
      gestorCookie = gestorCookie || cookies().get('gestor_session')?.value;
      cooperadoCookie = cooperadoCookie || cookies().get('cooperado_session')?.value;
    } catch {}
  }

  const tokens = [
    header ? tokenDoCabecalho(header) : null,
    gestorCookie,
    cooperadoCookie,
  ].filter((t): t is string => Boolean(t));

  const db = getDb();
  for (const token of tokens) {
    try {
      const claims = await validarTokenSessao(token);
      if (claims?.sessionId) {
        invalidarSessaoMemoria(claims.sessionId);
        if (db) {
          await db
            .prepare("UPDATE auth_sessions SET revoked_at = ? WHERE id = ?")
            .bind(Math.floor(Date.now() / 1000), claims.sessionId)
            .run();
        }
      }
    } catch (e) {
      console.warn('Aviso ao revogar sessão no logout:', e);
    }
  }

  const response = NextResponse.json({ success: true });
  const isProduction = process.env.NODE_ENV === 'production';
  const cookieDomain = obterDominioCookie(request.headers.get('host') || request.nextUrl.hostname);

  const nomesCookies = ['gestor_session', 'cooperado_session', 'gc_user_id'];
  for (const nome of nomesCookies) {
    // 1. Limpeza no escopo local do host
    response.cookies.set(nome, '', {
      httpOnly: nome.endsWith('_session'),
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });
    // 2. Limpeza com domínio compartilhado se aplicável (ex: .gestorcoop.app)
    if (cookieDomain) {
      response.cookies.set(nome, '', {
        httpOnly: nome.endsWith('_session'),
        secure: isProduction,
        sameSite: 'lax',
        domain: cookieDomain,
        maxAge: 0,
        path: '/',
      });
    }
  }

  try {
    const jar = cookies();
    for (const nome of nomesCookies) {
      jar.set(nome, '', {
        httpOnly: nome.endsWith('_session'),
        secure: isProduction,
        sameSite: 'lax',
        maxAge: 0,
        path: '/',
      });
    }
  } catch {}

  return response;
}
