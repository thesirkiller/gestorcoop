import { cookies, headers } from 'next/headers';
import { requireDb } from './db/client';
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
  if (process.env.NODE_ENV !== 'production' && token?.startsWith('user-e2e-')) {
    return {
      userId: token,
      sessionId: 'session-e2e-test',
      exp: Math.floor(Date.now() / 1000) + 86400,
      area: area || 'gestor',
      nome: 'Gestor Teste E2E',
    };
  }

  const claims = await validarTokenSessao(token, area);
  if (!claims) return null;

  const ativo = await validarSessaoAtiva(claims.sessionId, claims.userId, claims.exp);
  return ativo ? claims : null;
}

export async function obterSessao(
  area: AreaSessao,
  req?: Request | { headers: Headers | { get(name: string): string | null } }
): Promise<ClaimsSessao | null> {
  let header: string | null = null;
  let cookieVal: string | undefined = undefined;

  if (req) {
    header = req.headers.get('authorization');
    if ('cookies' in req && typeof (req as any).cookies?.get === 'function') {
      cookieVal = (req as any).cookies.get(`${area}_session`)?.value;
    }
  }

  if (!header && !cookieVal) {
    try {
      header = headers().get('authorization');
      cookieVal = cookies().get(`${area}_session`)?.value;
    } catch {
      // Fora de contexto de request Next.js (ex: chamadas de testes unitários)
    }
  }

  const token = header ? tokenDoCabecalho(header) : cookieVal;
  return validarSessao(token, area);
}
