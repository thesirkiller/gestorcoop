import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDb } from '@/lib/db/client';
import { tokenDoCabecalho, validarTokenSessao } from '@/lib/sessao-token';
import { invalidarSessaoMemoria } from '@/lib/cache-memoria';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function POST(request: NextRequest) {
  const header = request.headers.get('authorization');
  const tokens = [
    header ? tokenDoCabecalho(header) : null,
    cookies().get('gestor_session')?.value,
    cookies().get('cooperado_session')?.value,
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

  cookies().set('gestor_session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
  cookies().set('cooperado_session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
  return NextResponse.json({ success: true });
}
