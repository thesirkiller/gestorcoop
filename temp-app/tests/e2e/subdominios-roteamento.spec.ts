import { test, expect, request as playwrightRequest } from '@playwright/test';
import { extrairSubdominio, obterUrlCooperado, obterUrlGestao, obterUrlCooperacao } from '@/lib/subdominios';

test.describe('Helper de Subdomínios (src/lib/subdominios.ts)', () => {
  test('extrai corretamente os subdomínios cooperado, gestao e cooperacao', () => {
    expect(extrairSubdominio('cooperado.gestorcoop.app')).toBe('cooperado');
    expect(extrairSubdominio('cooperado.localhost:3005')).toBe('cooperado');
    expect(extrairSubdominio('gestao.gestorcoop.app')).toBe('gestao');
    expect(extrairSubdominio('gestao.localhost:3005')).toBe('gestao');
    expect(extrairSubdominio('cooperacao.gestorcoop.app')).toBe('cooperacao');
    expect(extrairSubdominio('cooperacao.localhost:3005')).toBe('cooperacao');

    // Domínio principal ou localhost padrão não possuem subdomínio ativo
    expect(extrairSubdominio('gestorcoop.app')).toBeNull();
    expect(extrairSubdominio('localhost:3005')).toBeNull();
    expect(extrairSubdominio('127.0.0.1:3005')).toBeNull();
    expect(extrairSubdominio('')).toBeNull();
    expect(extrairSubdominio(null)).toBeNull();
  });

  test('gera URLs corretas para os subdomínios em produção e desenvolvimento', () => {
    expect(obterUrlCooperado('/prontuario/123')).toContain('/prontuario/123');
    expect(obterUrlGestao('/prontuarios')).toContain('/prontuarios');
    expect(obterUrlCooperacao()).toContain('cooperacao.gestorcoop.app');
  });
});

test.describe('Middleware de Subdomínios e Isolamento de Segurança', () => {
  test('1. cooperacao.gestorcoop.app: raiz entrega o funil de adesão online de página inteira sem casca mobile', async ({ page }) => {
    await page.setExtraHTTPHeaders({ 'x-subdomain': 'cooperacao' });
    await page.goto('/');

    // Deve conter elementos da Ficha de Inscrição e Adesão
    await expect(page.getByText('Portal de Ingresso')).toBeVisible();
    await expect(page.getByText('Ficha de Inscrição & Adesão')).toBeVisible();
    await expect(page.getByText('Adesão de Cooperado')).toBeVisible();

    // NÃO deve conter o cabeçalho nem os elementos da casca de simulação mobile do cooperado
    await expect(page.locator('text=Profissional Online')).not.toBeVisible();
    await expect(page.locator('text=Todos os dados salvos na nuvem')).not.toBeVisible();
    await expect(page.locator('text=Sincronizando alterações locais...')).not.toBeVisible();
  });

  test('2. cooperacao.gestorcoop.app: bloqueia rigidamente qualquer acesso à gestão (/gestor e /api/gestor)', async ({
    baseURL,
  }) => {
    const req = await playwrightRequest.newContext({
      baseURL,
      extraHTTPHeaders: { 'x-subdomain': 'cooperacao' },
    });

    // Requisição de API bloqueada com 403
    const resApi = await req.get('/api/gestor/prontuarios');
    expect(resApi.status()).toBe(403);
    const json = await resApi.json();
    expect(json.success).toBe(false);

    // Navegação de página redirecionada com segurança para a gestão
    const resPage = await req.get('/gestor/dashboard', { maxRedirects: 0 });
    expect([302, 307]).toContain(resPage.status());
    expect(resPage.headers()['location']).toContain('gestao.gestorcoop.app');
    await req.dispose();
  });

  test('3. cooperado.gestorcoop.app: bloqueia rigidamente qualquer acesso do cooperado à gestão', async ({
    baseURL,
  }) => {
    const req = await playwrightRequest.newContext({
      baseURL,
      extraHTTPHeaders: { 'x-subdomain': 'cooperado' },
    });

    // Tentativa de chamar API de gestão a partir do subdomínio do cooperado
    const resApi = await req.get('/api/gestor/prontuarios');
    expect(resApi.status()).toBe(403);
    const json = await resApi.json();
    expect(json.success).toBe(false);

    // Tentativa de acessar tela de gestão redireciona
    const resPage = await req.get('/gestor/prontuarios', { maxRedirects: 0 });
    expect([302, 307]).toContain(resPage.status());
    expect(resPage.headers()['location']).toContain('gestao.gestorcoop.app');
    await req.dispose();
  });

  test('4. cooperado.gestorcoop.app: raiz deslogada redireciona para login e autenticada entrega o portal', async ({
    baseURL,
  }) => {
    // Deslogado -> redireciona para /login
    const reqDeslogado = await playwrightRequest.newContext({
      baseURL,
      extraHTTPHeaders: { 'x-subdomain': 'cooperado' },
    });
    const resDeslogado = await reqDeslogado.get('/', { maxRedirects: 0 });
    expect([302, 307]).toContain(resDeslogado.status());
    expect(resDeslogado.headers()['location']).toContain('/login');
    await reqDeslogado.dispose();

    // Autenticado com cooperado_session -> 200 OK
    const reqLogado = await playwrightRequest.newContext({
      baseURL,
      extraHTTPHeaders: {
        'x-subdomain': 'cooperado',
        Cookie: 'cooperado_session=token-mock-cooperado',
      },
    });
    const resLogado = await reqLogado.get('/');
    expect(resLogado.status()).toBe(200);
    await reqLogado.dispose();
  });

  test('5. cooperado.gestorcoop.app: rota limpa /prontuario/:id sem cookie redireciona para login', async ({
    baseURL,
  }) => {
    const req = await playwrightRequest.newContext({
      baseURL,
      extraHTTPHeaders: { 'x-subdomain': 'cooperado' },
    });

    const res = await req.get('/prontuario/pac_subdom_123', { maxRedirects: 0 });
    expect([302, 307]).toContain(res.status());
    expect(res.headers()['location']).toContain('/login?redirect=%2Fprontuario%2Fpac_subdom_123');
    await req.dispose();
  });

  test('6. gestao.gestorcoop.app: sem cookie gestor_session redireciona para login', async ({ baseURL }) => {
    const req = await playwrightRequest.newContext({
      baseURL,
      extraHTTPHeaders: { 'x-subdomain': 'gestao' },
    });

    const resRaiz = await req.get('/', { maxRedirects: 0 });
    expect([302, 307]).toContain(resRaiz.status());
    expect(resRaiz.headers()['location']).toContain('/login');

    const resAlias = await req.get('/prontuarios', { maxRedirects: 0 });
    expect([302, 307]).toContain(resAlias.status());
    expect(resAlias.headers()['location']).toContain('/login');
    await req.dispose();
  });

  test('7. gestao.gestorcoop.app: com cookie gestor_session permite acesso a prontuários e aliases', async ({
    baseURL,
  }) => {
    const req = await playwrightRequest.newContext({
      baseURL,
      extraHTTPHeaders: {
        'x-subdomain': 'gestao',
        Cookie: 'gestor_session=token-gestor-valido-mock',
      },
    });

    const res = await req.get('/gestor/prontuarios');
    expect(res.status()).toBe(200);
    await req.dispose();
  });

  test('8. Dominio principal: home page renderiza os cards direcionando aos 3 subdomínios', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('Cooperação Online')).toBeVisible();
    await expect(page.getByText('Portal do Cooperado')).toBeVisible();
    await expect(page.getByText('Painel do Gestor')).toBeVisible();

    await expect(page.getByText('cooperacao.gestorcoop.app')).toBeVisible();
    await expect(page.getByText('cooperado.gestorcoop.app')).toBeVisible();
    await expect(page.getByText('gestao.gestorcoop.app')).toBeVisible();
  });

  test('9. gestao.gestorcoop.app: tela de login exibe acesso gestor com botão para Bubble e troca de perfil', async ({ page }) => {
    await page.goto('/login?area=gestor&error=token_missing');

    // Valida títulos e textos da área de gestão
    await expect(page.getByRole('heading', { name: 'Acesso Administrativo & Gestão' })).toBeVisible();
    await expect(page.getByText('Painel exclusivo para diretores, coordenadores e gestores da cooperativa.')).toBeVisible();

    // Valida botão direto para o GestorCoop Bubble
    const bubbleBtn = page.getByRole('link', { name: 'Ir para o GestorCoop (Bubble)' });
    await expect(bubbleBtn).toBeVisible();
    await expect(bubbleBtn).toHaveAttribute('href', 'https://appgestorcoop.bubbleapps.io');

    // Valida link secundário para o domínio principal
    const apexLink = page.getByRole('link', { name: 'Acessar portal principal (gestorcoop.app)' });
    await expect(apexLink).toBeVisible();
    await expect(apexLink).toHaveAttribute('href', 'https://gestorcoop.app');

    // Valida troca de abas para Portal do Cooperado
    await page.getByRole('button', { name: 'Portal do Cooperado' }).click();
    await expect(page.locator('#cpf-input')).toBeVisible();

    // Valida retorno para a aba de Gestão
    await page.getByRole('button', { name: 'Gestão & Diretoria' }).click();
    await expect(bubbleBtn).toBeVisible();
  });
});

