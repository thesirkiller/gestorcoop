import { test, expect, request as playwrightRequest } from '@playwright/test';

/**
 * Sessão do prontuário sem subdomínio same-site.
 *
 * Dentro do iframe do Bubble o cookie não chega, então a credencial é um token
 * assinado mandado em `Authorization: Bearer`. Estes testes cobrem as duas
 * partes que a mudança tornou arriscadas:
 *
 *   1. o token em si — falsificar tem que ser impossível sem o segredo;
 *   2. a assimetria do middleware — API exige credencial, página não.
 *
 * O grupo 1 não usa navegador: importa o módulo direto e roda em Node. Fica
 * aqui porque o projeto não tem runner de teste unitário, e ter a cobertura no
 * lugar errado é melhor que não ter.
 */

// O módulo lê o segredo de `process.env` a cada chamada, então definir aqui
// basta e não depende do `.env.local` da máquina.
process.env.AUTH_JWT_SECRET = 'segredo-de-teste-nao-usar-em-producao-ao-menos-32-chars';

import {
  emitirTokenSessao,
  validarTokenSessao,
  tokenDoCabecalho,
} from '../../src/lib/sessao-token';

test.describe('Token de sessão do cooperado', () => {
  const mockIdentidade = {
    userId: 'user_abc123',
    area: 'cooperado' as const,
    cooperadoId: 'coop_123',
    nome: 'Dra. Ana Silva',
  };

  test('ida e volta devolve o mesmo user id', async () => {
    const token = await emitirTokenSessao(mockIdentidade, 'sess_123');
    const claims = await validarTokenSessao(token);
    expect(claims?.userId).toBe('user_abc123');
    expect(claims?.cooperadoId).toBe('coop_123');
  });

  test('recusa token com payload adulterado', async () => {
    const token = await emitirTokenSessao(mockIdentidade, 'sess_123');
    const [header, payload, assinatura] = token.split('.');

    // Reescreve o payload para outro usuário, mantendo a assinatura original
    const payloadObj = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
    payloadObj.sub = 'user_invasor';
    const forjado = Buffer.from(JSON.stringify(payloadObj)).toString('base64url');

    expect(await validarTokenSessao(`${header}.${forjado}.${assinatura}`)).toBeNull();
  });

  test('recusa assinatura de outro segredo', async () => {
    const token = await emitirTokenSessao(mockIdentidade, 'sess_123');
    process.env.AUTH_JWT_SECRET = 'outro-segredo-completamente-diferente-32-chars-long';
    try {
      expect(await validarTokenSessao(token)).toBeNull();
    } finally {
      process.env.AUTH_JWT_SECRET = 'segredo-de-teste-nao-usar-em-producao-ao-menos-32-chars';
    }
  });

  test('recusa token vencido', async () => {
    const token = await emitirTokenSessao(mockIdentidade, 'sess_123', -10);
    expect(await validarTokenSessao(token)).toBeNull();
  });

  test('recusa lixo sem lançar', async () => {
    for (const entrada of ['', 'abc', 'v1.só-duas', 'v2.a.b', null, undefined]) {
      expect(await validarTokenSessao(entrada as string)).toBeNull();
    }
  });

  test('lê o cabeçalho Authorization só no esquema Bearer', () => {
    expect(tokenDoCabecalho('Bearer abc.def.ghi')).toBe('abc.def.ghi');
    expect(tokenDoCabecalho('bearer abc')).toBe('abc');
    expect(tokenDoCabecalho('Basic abc')).toBeNull();
    expect(tokenDoCabecalho('abc')).toBeNull();
    expect(tokenDoCabecalho(null)).toBeNull();
  });
});

test.describe('Middleware: API fechada, casca aberta', () => {
  test('API do prontuário sem credencial nenhuma responde 401', async ({ baseURL }) => {
    // Contexto novo, sem cookie: é a situação de quem chama a API de fora.
    const req = await playwrightRequest.newContext({ baseURL });
    const resposta = await req.get('/api/cooperado/agenda');
    expect(resposta.status()).toBe(401);
    await req.dispose();
  });

  test('token forjado passa o middleware mas é recusado pela rota', async ({ baseURL }) => {
    // O middleware só confere presença; quem valida assinatura é a rota. O que
    // importa é o resultado: sem token legítimo não se lê agenda de ninguém.
    const req = await playwrightRequest.newContext({ baseURL });
    const resposta = await req.get('/api/cooperado/agenda', {
      headers: { Authorization: 'Bearer v1.payload-forjado.assinatura-forjada' },
    });
    expect(resposta.status()).toBe(401);
    await req.dispose();
  });

  test('a casca da página carrega sem credencial, para o iframe poder inicializar', async ({
    baseURL,
  }) => {
    // Se isto virar 401/redirect, o iframe do Bubble nunca chega a rodar o
    // script que guarda o token, e o módulo inteiro fica inacessível.
    const req = await playwrightRequest.newContext({ baseURL });
    const resposta = await req.get('/cooperado', { maxRedirects: 0 });
    expect(resposta.status()).toBe(200);
    await req.dispose();
  });
});
