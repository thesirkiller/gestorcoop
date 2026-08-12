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
process.env.ASSINATURA_SECRET = 'segredo-de-teste-nao-usar-em-producao';

import {
  assinarTokenSessao,
  verificarTokenSessao,
  tokenDoCabecalho,
} from '../../src/lib/sessao-token';

test.describe('Token de sessão do cooperado', () => {
  test('ida e volta devolve o mesmo user id', async () => {
    const token = await assinarTokenSessao('user_abc123');
    expect(await verificarTokenSessao(token)).toBe('user_abc123');
  });

  test('recusa token com payload adulterado', async () => {
    const token = await assinarTokenSessao('user_abc123');
    const [versao, payload, assinatura] = token.split('.');

    // Reescreve o payload para outro usuário, mantendo a assinatura original —
    // exatamente o que alguém faria para gravar evolução em nome de terceiro.
    const forjado = Buffer.from(
      JSON.stringify({ u: 'user_invasor', exp: Math.floor(Date.now() / 1000) + 3600 }),
    )
      .toString('base64url');

    expect(await verificarTokenSessao(`${versao}.${forjado}.${assinatura}`)).toBeNull();
  });

  test('recusa assinatura de outro segredo', async () => {
    const token = await assinarTokenSessao('user_abc123');
    process.env.ASSINATURA_SECRET = 'outro-segredo-completamente-diferente';
    try {
      expect(await verificarTokenSessao(token)).toBeNull();
    } finally {
      process.env.ASSINATURA_SECRET = 'segredo-de-teste-nao-usar-em-producao';
    }
  });

  test('recusa token vencido', async () => {
    const token = await assinarTokenSessao('user_abc123', -1);
    expect(await verificarTokenSessao(token)).toBeNull();
  });

  test('recusa lixo sem lançar', async () => {
    for (const entrada of ['', 'abc', 'v1.só-duas', 'v2.a.b', null, undefined]) {
      expect(await verificarTokenSessao(entrada as string)).toBeNull();
    }
  });

  test('lança ao assinar sem segredo configurado, em vez de emitir sessão fraca', async () => {
    const original = process.env.ASSINATURA_SECRET;
    delete process.env.ASSINATURA_SECRET;
    try {
      await expect(assinarTokenSessao('user_abc123')).rejects.toThrow(/ASSINATURA_SECRET/);
    } finally {
      process.env.ASSINATURA_SECRET = original;
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
