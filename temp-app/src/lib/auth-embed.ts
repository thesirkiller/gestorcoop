import { requireDb } from './db/client';
import { emitirTokenSessao, IdentidadeSessao, VALIDADE_PADRAO_SEGUNDOS } from './sessao-token';
export async function hashTicket(ticket: string) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ticket));
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}
export async function validarChaveIntegracao(recebida: string | null) {
  const secret = process.env.BUBBLE_EMBED_SECRET;
  if (!secret || secret.length < 32) throw new Error('BUBBLE_EMBED_SECRET não configurada.');
  if (!recebida || recebida.length > 512) return false;
  const a = await hashTicket(recebida), b = await hashTicket(secret);
  let delta = 0;
  for (let i = 0; i < a.length; i++) delta |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return delta === 0;
}
export async function criarTicket(identity: IdentidadeSessao) {
  await emitirTokenSessao(identity, 'configuration-check', 1);
  const ticket = `${crypto.randomUUID()}${crypto.randomUUID()}`;
  await requireDb().prepare('INSERT INTO auth_embed_tickets (hash, identity_json, expires_at) VALUES (?, ?, ?)')
    .bind(await hashTicket(ticket), JSON.stringify(identity), Math.floor(Date.now() / 1000) + 60).run();
  return ticket;
}
export async function trocarTicket(ticket: string) {
  if (!/^[a-f0-9-]{72}$/.test(ticket)) return null;
  const db = requireDb(), now = Math.floor(Date.now() / 1000);
  const row = await db.prepare('DELETE FROM auth_embed_tickets WHERE hash = ? AND expires_at > ? RETURNING identity_json')
    .bind(await hashTicket(ticket), now).first<{ identity_json: string }>();
  if (!row) return null;
  const identity = JSON.parse(row.identity_json) as IdentidadeSessao;
  const sessionId = crypto.randomUUID();
  const token = await emitirTokenSessao(identity, sessionId);
  await db.prepare('INSERT INTO auth_sessions (id, user_id, area, expires_at) VALUES (?, ?, ?, ?)')
    .bind(sessionId, identity.userId, identity.area, now + VALIDADE_PADRAO_SEGUNDOS).run();
  return { token, identity };
}
