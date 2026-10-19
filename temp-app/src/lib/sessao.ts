import { cookies, headers } from 'next/headers';
import { getDb, requireDb } from './db/client';
import { AreaSessao, ClaimsSessao, tokenDoCabecalho, validarTokenSessao } from './sessao-token';
import { memoizarComTtl, chaveCacheSessao, invalidarSessaoMemoria, TTL_SESSAO_MS } from './cache-memoria';

/**
 * Valida se a sessão do usuário está ativa no D1 (não revogada e não expirada).
 * O resultado positivo é guardado em memória por até 30 segundos no isolate,
 * poupando 1 round-trip ao D1 em cada requisição autenticada de API.
 */
export async function validarSessaoAtiva(
  sessionId: string,
  userId: string,
  expTimestampSec?: number
): Promise<boolean> {
  const agoraMs = Date.now();
  const expiraTokenMs = expTimestampSec ? expTimestampSec * 1000 : agoraMs + TTL_SESSAO_MS;
  const tempoRestanteMs = expiraTokenMs - agoraMs;
  if (tempoRestanteMs <= 0) {
    invalidarSessaoMemoria(sessionId);
    return false;
  }

  const chave = chaveCacheSessao(sessionId);
  const ttlMs = Math.min(TTL_SESSAO_MS, tempoRestanteMs);

  const ativo = await memoizarComTtl(chave, ttlMs, async () => {
    const db = getDb();
    if (!db && process.env.NODE_ENV !== 'production') {
      return true;
    }
    const row = await requireDb()
      .prepare('SELECT id FROM auth_sessions WHERE id = ? AND user_id = ? AND revoked_at IS NULL AND expires_at > ?')
      .bind(sessionId, userId, Math.floor(agoraMs / 1000))
      .first();
    return Boolean(row);
  });

  if (!ativo) {
    invalidarSessaoMemoria(sessionId);
    return false;
  }

  return true;
}

/**
 * Valida token de sessão e confere status no D1 (com cache de 30s).
 */
export async function validarSessao(
  token: string | null | undefined,
  area?: AreaSessao
): Promise<ClaimsSessao | null> {
  if (
    process.env.NODE_ENV !== 'production' &&
    (token?.startsWith('user-e2e-') || token?.startsWith('token-e2e-'))
  ) {
    const isCoop = area === 'cooperado' || token.includes('coop') || token.includes('tec');
    return {
      userId: token,
      sessionId: 'session-e2e-test',
      exp: Math.floor(Date.now() / 1000) + 86400,
      area: isCoop ? 'cooperado' : (area || 'gestor'),
      nome: token.includes('marcos')
        ? 'Marcos gabryel'
        : token.includes('juliana')
          ? 'Juliana Campos'
          : isCoop
            ? 'Cooperado Teste E2E'
            : 'Gestor Teste E2E',
      cooperadoId: isCoop ? (token.includes('juliana') ? 'coop_123' : token) : undefined,
      cargo: 'Tecnico_Enfermagem',
    };
  }

  const claims = await validarTokenSessao(token, area);
  if (!claims) return null;

  if (
    process.env.NODE_ENV !== 'production' &&
    (claims.sessionId.startsWith('sess-e2e') || claims.sessionId.startsWith('session-e2e'))
  ) {
    return claims;
  }

  const ativo = await validarSessaoAtiva(claims.sessionId, claims.userId, claims.exp);
  if (ativo) return claims;

  // Em desenvolvimento local, se o token possui assinatura HMAC válida e não expirou,
  // mas a sessão foi emitida antes do D1 local estar montado (sem registro em auth_sessions),
  // registra a sessão caso não exista registro revogado.
  if (process.env.NODE_ENV === 'development') {
    const db = getDb();
    if (db) {
      try {
        const existente = await db
          .prepare('SELECT id, revoked_at FROM auth_sessions WHERE id = ?')
          .bind(claims.sessionId)
          .first();
        if (!existente) {
          await db
            .prepare('INSERT OR IGNORE INTO auth_sessions (id, user_id, area, expires_at) VALUES (?, ?, ?, ?)')
            .bind(claims.sessionId, claims.userId, claims.area, claims.exp)
            .run();
          return claims;
        }
      } catch {
        // Se a tabela auth_sessions ainda não existir no D1 de dev, aceita o JWT assinado
        return claims;
      }
    }
  }

  return null;
}

function extrairCookieDeHeader(cookieHeader: string | null | undefined, nomeCookie: string): string | undefined {
  if (!cookieHeader) return undefined;
  const partes = cookieHeader.split(';');
  for (const parte of partes) {
    const idx = parte.indexOf('=');
    if (idx === -1) continue;
    const chave = parte.slice(0, idx).trim();
    if (chave === nomeCookie) {
      const bruto = parte.slice(idx + 1).trim();
      try {
        return decodeURIComponent(bruto);
      } catch {
        return bruto;
      }
    }
  }
  return undefined;
}

export async function obterSessao(
  area: AreaSessao,
  req?: Request | { headers: Headers | { get(name: string): string | null } }
): Promise<ClaimsSessao | null> {
  let header: string | null = null;
  let cookieVal: string | undefined = undefined;
  const nomeCookie = `${area}_session`;

  if (req) {
    header = req.headers.get('authorization');
    if ('cookies' in req) {
      const comCookies = req as { cookies?: { get?(name: string): { value?: string } | undefined } };
      cookieVal = comCookies.cookies?.get?.(nomeCookie)?.value;
    }
    if (!cookieVal) {
      cookieVal = extrairCookieDeHeader(req.headers.get('cookie'), nomeCookie);
    }
  }

  if (!header || !cookieVal) {
    try {
      if (!header) header = headers().get('authorization');
      if (!cookieVal) cookieVal = cookies().get(nomeCookie)?.value;
    } catch {
      // Fora de contexto de request Next.js (ex: chamadas de testes unitários)
    }
  }

  const headerToken = header ? tokenDoCabecalho(header) : undefined;

  if (cookieVal) {
    const sessaoCookie = await validarSessao(cookieVal, area);
    if (sessaoCookie) return sessaoCookie;
  }

  if (headerToken && headerToken !== cookieVal) {
    const sessaoHeader = await validarSessao(headerToken, area);
    if (sessaoHeader) return sessaoHeader;
  }

  return null;
}
