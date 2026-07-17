import { test, expect, Page } from '@playwright/test';

// Testes do shell do painel do gestor (sidebar + header). As APIs do Bubble
// são todas mockadas; a sessão é simulada com o cookie gestor_session.

async function autenticar(page: Page) {
  await page.context().addCookies([
    {
      name: 'gestor_session',
      value: 'user-e2e-1',
      url: 'http://localhost:3000',
    },
  ]);
}

async function mockApis(page: Page) {
  // Genérico primeiro: qualquer API do gestor responde algo benigno
  await page.route('**/api/gestor/**', (route) =>
    route.fulfill({ json: { success: true, data: [], results: [] } })
  );
  // Específicos registrados depois têm precedência
  await page.route('**/api/gestor/me', (route) =>
    route.fulfill({ json: { nome: 'Marcos Gabryel', email: 'gestor@multcare.com.br', foto: null } })
  );
  await page.route('**/api/auth/logout', (route) => route.fulfill({ json: { success: true } }));
}

test('sem sessão, /gestor redireciona para /login', async ({ page }) => {
  await page.goto('/gestor/dashboard');
  await expect(page).toHaveURL(/\/login/);
});

test('sidebar navega entre as telas e destaca o item ativo', async ({ page }) => {
  await autenticar(page);
  await mockApis(page);
  await page.goto('/gestor/dashboard');

  // Header mostra o usuário vindo de /api/gestor/me
  await expect(page.getByText('Marcos Gabryel')).toBeVisible();

  // Todos os itens do menu presentes
  const nav = page.locator('aside').first();
  for (const label of ['Adesões', 'Financeiro', 'Termos', 'Equipamentos', 'Manutenção', 'Relatórios']) {
    await expect(nav.getByRole('link', { name: label })).toBeVisible();
  }

  // Navegação via sidebar
  await nav.getByRole('link', { name: 'Financeiro' }).click();
  await expect(page).toHaveURL(/\/gestor\/financeiro/);
  await expect(page.locator('header').getByText('Financeiro')).toBeVisible();
});

test('menu lateral recolhe, persiste e expande de novo', async ({ page }) => {
  await autenticar(page);
  await mockApis(page);
  await page.goto('/gestor/termos');

  const nav = page.locator('aside').first();
  await expect(nav.getByRole('link', { name: 'Adesões' })).toBeVisible();

  await page.getByRole('button', { name: 'Recolher menu' }).click();
  await expect(nav.getByText('Adesões')).not.toBeVisible();

  // Preferência persiste após recarregar
  await page.reload();
  await expect(nav.getByText('Adesões')).not.toBeVisible();

  await page.getByRole('button', { name: 'Expandir menu' }).click();
  await expect(nav.getByRole('link', { name: 'Adesões' })).toBeVisible();
});

test('menu do usuário permite sair do painel', async ({ page }) => {
  await autenticar(page);
  await mockApis(page);
  await page.goto('/gestor/dashboard');

  await page.getByText('Marcos Gabryel').click();
  await page.getByRole('button', { name: /Sair do painel/ }).click();
  await expect(page).toHaveURL(/\/login/);
});
