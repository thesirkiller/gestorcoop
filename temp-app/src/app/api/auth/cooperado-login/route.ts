/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { bubbleApi } from '@/lib/bubble';
import { emitirTokenSessao } from '@/lib/sessao-token';
import { getDb } from '@/lib/db/client';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const VALIDADE_COOPERADO_SEGUNDOS = 30 * 24 * 60 * 60; // 30 dias para evitar deslogamentos frequentes

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawCpf = body.cpf || '';
    const redirectParam = body.redirect;

    const digits = String(rawCpf).replace(/\D/g, '');
    if (digits.length !== 11) {
      return NextResponse.json(
        { success: false, error: 'Por favor, informe um CPF válido com 11 dígitos.' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // 1. Busca o sócio cooperado pelo CPF
    const cooperado = await bubbleApi.findCooperadoByCPF(digits);
    if (!cooperado || !cooperado._id) {
      return NextResponse.json(
        {
          success: false,
          error: 'CPF não encontrado no quadro de cooperados. Verifique se o número foi digitado corretamente.',
        },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // 2. Localiza ou provisiona o User correspondente no Bubble
    let userId = cooperado.fk_usuario;
    if (!userId) {
      try {
        const existingUser = await bubbleApi.findUserByCooperado(cooperado._id);
        if (existingUser?._id) {
          userId = existingUser._id;
        } else {
          // Auto-provisionamento de User
          const email = cooperado.txt_email || cooperado.email || `cooperado_${digits}@gestorcoop.local`;
          const createdUser = await bubbleApi.createUser({
            fk_cooperado: cooperado._id,
            txt_nome: cooperado.txt_nome || 'Cooperado',
            txt_email: email,
            bool_colaborador_interno: false,
          });

          userId = createdUser?.id || createdUser?.response?.id;
          if (userId) {
            try {
              await bubbleApi.updateCooperado(cooperado._id, { fk_usuario: userId });
            } catch (e) {
              console.warn('Aviso ao vincular fk_usuario ao sócio cooperado:', e);
            }
          }
        }
      } catch (err) {
        console.warn('Aviso no provisionamento de usuário Bubble para cooperado:', err);
      }
    }

    // Fallback garantido: caso a criação do User falhe, o ID do cooperado ancora a sessão
    if (!userId) {
      userId = cooperado._id;
    }

    const sessionId = crypto.randomUUID();
    const nome = cooperado.txt_nome || 'Cooperado';
    const cargo = cooperado.txt_profissao || 'Tecnico_Enfermagem';

    // 3. Emite JWT com validade estendida de 30 dias
    const token = await emitirTokenSessao(
      {
        userId,
        area: 'cooperado',
        cooperadoId: cooperado._id,
        nome,
        cargo,
      },
      sessionId,
      VALIDADE_COOPERADO_SEGUNDOS
    );

    // 4. Registra sessão no banco local D1 (se disponível)
    const db = getDb();
    if (db) {
      try {
        const now = Math.floor(Date.now() / 1000);
        await db
          .prepare('INSERT INTO auth_sessions (id, user_id, area, expires_at) VALUES (?, ?, ?, ?)')
          .bind(sessionId, userId, 'cooperado', now + VALIDADE_COOPERADO_SEGUNDOS)
          .run();
      } catch (e) {
        console.warn('Aviso ao salvar auth_session no D1:', e);
      }
    }

    // Sanitiza URL de redirecionamento para evitar open-redirect
    let destino = redirectParam || '/cooperado';
    if (!destino.startsWith('/') || destino.startsWith('//')) {
      destino = '/cooperado';
    }

    const isProduction = process.env.NODE_ENV === 'production';

    const response = NextResponse.json(
      {
        success: true,
        redirect: destino,
        token,
        cooperado: {
          id: cooperado._id,
          nome,
          cargo,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );

    response.cookies.set('cooperado_session', token, {
      path: '/',
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: VALIDADE_COOPERADO_SEGUNDOS,
    });

    response.cookies.set('gc_user_id', userId, {
      path: '/',
      secure: isProduction,
      sameSite: 'lax',
      maxAge: VALIDADE_COOPERADO_SEGUNDOS,
    });

    return response;
  } catch (error: any) {
    console.error('Erro na rota de login do cooperado:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro interno ao autenticar cooperado.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
