/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { bubbleApi } from '@/lib/bubble';
import { emitirTokenSessao, VALIDADE_PADRAO_SEGUNDOS, AreaSessao } from '@/lib/sessao-token';
import { requireDb } from '@/lib/db/client';
import { normalizarEspecialidade } from '@/lib/db/prontuarios';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

async function processarSSO(ssoToken: string, targetArea?: string, redirectPath?: string) {
  const user = await bubbleApi.findUserBySSOToken(ssoToken);
  if (!user || !user._id) {
    throw new Error('Token SSO inválido ou expirado.');
  }
  const userId = user._id;

  const liberadosPorAmbiente = (process.env.GESTOR_USER_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const ehGestor = user.bool_colaborador_interno === true || liberadosPorAmbiente.includes(userId);
  if (targetArea === 'gestor' && !ehGestor) throw new Error('Usuário sem acesso de gestor.');

  let area: AreaSessao = 'cooperado';
  if (targetArea === 'gestor' && ehGestor) {
    area = 'gestor';
  } else if (targetArea === 'cooperado') {
    area = 'cooperado';
  } else {
    area = ehGestor && !user.fk_cooperado ? 'gestor' : 'cooperado';
  }

  if (area === 'cooperado' && !user.fk_cooperado) throw new Error('Usuário sem vínculo de cooperado.');
  const cooperadoId = user.fk_cooperado || undefined;
  const nome = user.txt_nome || 'Profissional';
  const cooperado = cooperadoId ? await bubbleApi.getCooperado(cooperadoId) : null;
  const cargoBruto = cooperado?.txt_profissao || user.txt_profissao || undefined;
  const cargo = cargoBruto ? normalizarEspecialidade(cargoBruto) : undefined;
  if (area === 'cooperado' && !cargo) throw new Error('Profissão do cooperado não cadastrada.');

  const sessionId = crypto.randomUUID();
  const token = await emitirTokenSessao(
    {
      userId: user._id,
      area,
      cooperadoId,
      nome,
      cargo,
    },
    sessionId
  );

  const now = Math.floor(Date.now() / 1000);
  await requireDb()
    .prepare('INSERT INTO auth_sessions (id, user_id, area, expires_at) VALUES (?, ?, ?, ?)')
    .bind(sessionId, user._id, area, now + VALIDADE_PADRAO_SEGUNDOS)
    .run();
  await bubbleApi.clearSSOToken(userId);

  let destino = redirectPath;
  if (!destino || !destino.startsWith('/') || destino.startsWith('//') || destino.includes('\\') ||
      (area === 'gestor' && !destino.startsWith('/gestor')) ||
      (area === 'cooperado' && !destino.startsWith('/cooperado'))) {
    destino = area === 'cooperado' ? '/cooperado' : '/gestor/prontuarios';
  }

  return { token, area, destino, user, sessionId };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ssoToken = searchParams.get('token');
  const targetArea = searchParams.get('area') || undefined;
  const redirectParam = searchParams.get('redirect') || undefined;

  if (!ssoToken) {
    return NextResponse.json(
      { success: false, error: 'Token SSO ausente.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    const { token, area, destino, user } = await processarSSO(ssoToken, targetArea, redirectParam);

    const redirectUrl = new URL(destino, request.url);
    if (area === 'cooperado') {
      redirectUrl.hash = `s=${encodeURIComponent(token)}`;
    }

    const response = NextResponse.redirect(redirectUrl.toString(), 302);
    response.headers.set('Cache-Control', 'no-store');

    // Cookies para suporte a acesso direto e embedded/iframe
    response.cookies.set(`${area}_session`, token, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: VALIDADE_PADRAO_SEGUNDOS,
    });
    response.cookies.set('cooperado_session', token, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: VALIDADE_PADRAO_SEGUNDOS,
    });
    response.cookies.set('gc_user_id', user._id, {
      path: '/',
      secure: true,
      sameSite: 'none',
      maxAge: VALIDADE_PADRAO_SEGUNDOS,
    });

    return response;
  } catch (error: any) {
    console.error('Erro no processamento SSO GET:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Falha ao autenticar via SSO.' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const ssoToken = body.token;
    const targetArea = body.area;
    const redirectParam = body.redirect;

    if (!ssoToken) {
      return NextResponse.json(
        { success: false, error: 'Token SSO não informado.' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const { token, area, destino, user } = await processarSSO(ssoToken, targetArea, redirectParam);

    const response = NextResponse.json({
      success: true,
      token,
      area,
      destino,
      user: {
        id: user._id,
        nome: user.txt_nome,
        cooperadoId: user.fk_cooperado,
      },
    }, { headers: { 'Cache-Control': 'no-store' } });

    response.cookies.set(`${area}_session`, token, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: VALIDADE_PADRAO_SEGUNDOS,
    });
    response.cookies.set('cooperado_session', token, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: VALIDADE_PADRAO_SEGUNDOS,
    });

    return response;
  } catch (error: any) {
    console.error('Erro no processamento SSO POST:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Falha ao autenticar via SSO.' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
