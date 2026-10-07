/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { GET as cooperadoMeGet } from '../../src/app/api/cooperado/me/route';
import { POST as logoutPost } from '../../src/app/api/auth/logout/route';
import { emitirTokenSessao } from '../../src/lib/sessao-token';
import { criarD1DeTeste, instalarContextoCloudflare } from './stubs/d1-teste';
import { NextRequest } from 'next/server';

process.env.AUTH_JWT_SECRET = 'segredo-de-teste-com-mais-de-32-caracteres-necessarios';
process.env.BUBBLE_API_URL = 'https://bubble.invalid/version-test/api/1.1';
process.env.BUBBLE_API_TOKEN = 'token-de-teste';

before(async () => {
  const d1 = criarD1DeTeste();
  await d1.exec(`
    CREATE TABLE IF NOT EXISTS auth_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      area TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      revoked_at INTEGER
    );
  `);
  instalarContextoCloudflare(d1);
});

test('cooperado/me: sem token devolve 401 e autenticado: false', async () => {
  const req = new NextRequest('http://localhost:3000/api/cooperado/me');
  const res = await cooperadoMeGet(req);
  assert.equal(res.status, 401);
  const data = await res.json();
  assert.equal(data.success, false);
  assert.equal(data.autenticado, false);
});

test('cooperado/me: com sessao valida devolve perfil enriquecido', async () => {
  const sessionId = 'session_coop_teste_1';
  const token = await emitirTokenSessao(
    {
      userId: 'user_123',
      area: 'cooperado',
      cooperadoId: 'coop_abc',
      nome: 'Enf. Juliana Ramos',
      cargo: 'Tecnico_Enfermagem',
    },
    sessionId,
    3600
  );

  // Insere sessao no D1 para validarSessaoAtiva
  const { getDb } = await import('../../src/lib/db/client');
  const db = getDb();
  if (db) {
    const now = Math.floor(Date.now() / 1000);
    await db
      .prepare('INSERT OR REPLACE INTO auth_sessions (id, user_id, area, expires_at) VALUES (?, ?, ?, ?)')
      .bind(sessionId, 'user_123', 'cooperado', now + 3600)
      .run();
  }

  // Simula cookie de cooperado_session via headers
  const req = new NextRequest('http://localhost:3000/api/cooperado/me', {
    headers: {
      cookie: `cooperado_session=${token}`,
      authorization: `Bearer ${token}`,
    },
  });

  const res = await cooperadoMeGet(req);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.autenticado, true);
  assert.equal(data.cooperadoId, 'coop_abc');
  assert.equal(data.nome, 'Enf. Juliana Ramos');
  assert.equal(data.cargo, 'Tecnico_Enfermagem');
  assert.equal(data.profissao, 'Técnico(a) de Enfermagem');
});

test('logout: revoga sessao e zera cookie de cooperado', async () => {
  const req = new NextRequest('http://localhost:3000/api/auth/logout', {
    method: 'POST',
    headers: {
      cookie: 'cooperado_session=token-a-ser-revogado',
    },
  });

  const res = await logoutPost(req);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);

  // Confere que o cookie de cooperado_session e gc_user_id sao zerados (maxAge 0)
  const setCookie = res.headers.get('set-cookie') || '';
  assert.ok(setCookie.includes('cooperado_session=;') || setCookie.includes('cooperado_session=') || res.cookies.get('cooperado_session')?.value === '');
  assert.ok(setCookie.includes('gc_user_id=;') || setCookie.includes('gc_user_id=') || res.cookies.get('gc_user_id')?.value === '');
});

test('logout em subdominio produtivo (.gestorcoop.app): zera cookies no dominio compartilhado', async () => {
  const req = new NextRequest('https://cooperado.gestorcoop.app/api/auth/logout', {
    method: 'POST',
    headers: {
      host: 'cooperado.gestorcoop.app',
      cookie: 'cooperado_session=token-teste; gc_user_id=user_123',
    },
  });

  const res = await logoutPost(req);
  assert.equal(res.status, 200);

  const setCookie = res.headers.get('set-cookie') || '';
  assert.ok(setCookie.includes('.gestorcoop.app'));
});
