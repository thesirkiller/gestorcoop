/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { bubbleApi } from '@/lib/bubble';
import { emitirTokenSessao, VALIDADE_PADRAO_SEGUNDOS, AreaSessao } from '@/lib/sessao-token';
import { getDb } from '@/lib/db/client';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

async function processarSSO(userId: string, targetArea?: string, redirectPath?: string) {
  const user = await bubbleApi.getUser(userId);
  if (!user || !user._id) {
    throw new Error('Usuário não encontrado no Bubble.');
  }

  const liberadosPorAmbiente = (process.env.GESTOR_USER_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const ehGestor = user.bool_colaborador_interno === true || liberadosPorAmbiente.includes(userId);

  let area: AreaSessao = 'cooperado';
  if (targetArea === 'gestor' && ehGestor) {
    area = 'gestor';
  } else if (targetArea === 'cooperado') {
    area = 'cooperado';
  } else {
    area = ehGestor && !user.fk_cooperado ? 'gestor' : 'cooperado';
  }

  const cooperadoId = user.fk_cooperado || (area === 'cooperado' ? user._id : undefined);
  const nome = user.txt_nome || 'Profissional';
  const cargo = 'Tecnico_Enfermagem';

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

  const db = getDb();
  if (db) {
    try {
      const now = Math.floor(Date.now() / 1000);
      await db
        .prepare('INSERT INTO auth_sessions (id, user_id, area, expires_at) VALUES (?, ?, ?, ?)')
        .bind(sessionId, user._id, area, now + VALIDADE_PADRAO_SEGUNDOS)
        .run();
    } catch (e) {
      console.warn('Aviso ao registrar auth_session no D1:', e);
    }
  }

  let destino = redirectPath;
  if (!destino) {
    destino = area === 'cooperado' ? '/cooperado' : '/gestor/prontuarios';
  }

  return { token, area, destino, user, sessionId };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('user_id') || searchParams.get('token') || searchParams.get('u');
  const targetArea = searchParams.get('area') || undefined;
  const redirectParam = searchParams.get('redirect') || undefined;

  if (!userId) {
    return NextResponse.json(
      { success: false, error: 'Parâmetro user_id ou token ausente para autenticação SSO.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    const { token, area, destino } = await processarSSO(userId, targetArea, redirectParam);

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
    response.cookies.set('gc_user_id', userId, {
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
    const userId = body.user_id || body.token || body.userId;
    const targetArea = body.area;
    const redirectParam = body.redirect;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Identificador de usuário não informado.' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const { token, area, destino, user } = await processarSSO(userId, targetArea, redirectParam);

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
