import { NextRequest, NextResponse } from 'next/server';
import { trocarTicket } from '@/lib/auth-embed';
import { VALIDADE_PADRAO_SEGUNDOS } from '@/lib/sessao-token';
export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  const headers = { 'Cache-Control': 'no-store' };
  try {
    const { ticket } = await request.json();
    const session = typeof ticket === 'string' ? await trocarTicket(ticket) : null;
    if (!session) return NextResponse.json({ error: 'Acesso expirado ou já utilizado. Abra novamente pelo Bubble.' }, { status: 401, headers });
    const res = NextResponse.json({ success: true, token: session.token, area: session.identity.area }, { headers });
    res.cookies.set(`${session.identity.area}_session`, session.token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: VALIDADE_PADRAO_SEGUNDOS, path: '/' });
    return res;
  } catch { return NextResponse.json({ error: 'Acesso indisponível. Abra novamente pelo Bubble.' }, { status: 503, headers }); }
}
