import { cookies, headers } from 'next/headers';
import { requireDb } from './db/client';
import { AreaSessao, tokenDoCabecalho, validarTokenSessao } from './sessao-token';
export async function obterSessao(area: AreaSessao) {
  const header = headers().get('authorization');
  const token = header ? tokenDoCabecalho(header) : cookies().get(`${area}_session`)?.value;
  const claims = await validarTokenSessao(token, area);
  if (!claims) return null;
  const row = await requireDb().prepare('SELECT id FROM auth_sessions WHERE id = ? AND user_id = ? AND revoked_at IS NULL AND expires_at > ?')
    .bind(claims.sessionId, claims.userId, Math.floor(Date.now() / 1000)).first();
  return row ? claims : null;
}
