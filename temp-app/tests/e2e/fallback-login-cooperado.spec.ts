import { test, expect } from '@playwright/test';

test.describe('Fallback de Login Seguro para Cooperado Deslogado', () => {
  test('redireciona usuário deslogado que abre link de prontuário direto para o login', async ({ page }) => {
    // 1. O usuário tenta acessar o link compartilhado sem cookies de sessão
    await page.goto('/cooperado/prontuario/pac_teste_link');

    // 2. O middleware deve interceptar e redirecionar para /login com o parâmetro de redirect
    await expect(page).toHaveURL(/.*\/login\?redirect=%2Fcooperado%2Fprontuario%2Fpac_teste_link/);

    // 3. A página deve exibir o formulário de login por CPF com foco no prontuário
    await expect(page.locator('h1')).toContainText('Acesso ao Prontuário');
    await expect(page.locator('text=Digite seu CPF para abrir o prontuário do paciente compartilhado.')).toBeVisible();

    const inputCpf = page.locator('#cpf-input');
    await expect(inputCpf).toBeVisible();

    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toBeDisabled(); // Inicialmente desabilitado até 11 dígitos
  });

  test('aplica máscara de CPF e exibe erro caso o CPF não pertença a um cooperado', async ({ page }) => {
    await page.goto('/login?redirect=%2Fcooperado%2Fprontuario%2Fpac_teste_link');

    const inputCpf = page.locator('#cpf-input');

    // Digita os 11 dígitos
    await inputCpf.fill('99988877766');
    await expect(inputCpf).toHaveValue('999.888.777-66');

    // Simula resposta da API indicando cooperado não encontrado
    await page.route('**/api/auth/cooperado-login', async (route) => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'CPF não encontrado no quadro de cooperados. Verifique se o número foi digitado corretamente.',
        }),
      });
    });

    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // Mensagem de erro amigável em tela
    await expect(
      page.locator('text=CPF não encontrado no quadro de cooperados. Verifique se o número foi digitado corretamente.')
    ).toBeVisible();
  });

  test('autentica cooperado com sucesso e o redireciona diretamente ao prontuário do paciente', async ({ page }) => {
    await page.goto('/login?redirect=%2Fcooperado%2Fprontuario%2Fpac_teste_link');

    const inputCpf = page.locator('#cpf-input');
    await inputCpf.fill('12345678900');
    await expect(inputCpf).toHaveValue('123.456.789-00');

    // Mock das rotas de autenticação e dados do cooperado
    await page.route('**/api/auth/cooperado-login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: {
          'Set-Cookie': 'cooperado_session=mock-token-cooperado; Path=/; SameSite=Lax',
        },
        body: JSON.stringify({
          success: true,
          redirect: '/cooperado/prontuario/pac_teste_link',
          token: 'mock-token-cooperado',
          cooperado: {
            id: 'coop_123',
            nome: 'Carlos Encarregado',
            cargo: 'Tecnico_Enfermagem',
          },
        }),
      });
    });

    await page.route('**/api/cooperado/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          cooperadoId: 'coop_123',
          nome: 'Carlos Encarregado',
        }),
      });
    });

    await page.route('**/api/gestor/prontuarios/pacientes/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          paciente: {
            id: 'pac_teste_link',
            nome: 'Paciente Teste Redirecionado',
            cpf: '123.456.789-00',
            dataNascimento: '1980-01-01',
            endereco: 'Rua das Flores, 123',
            alergias: [],
          },
        }),
      });
    });

    await page.route('**/api/cooperado/agenda', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, results: [] }),
      });
    });

    // Injeta cookie no contexto do browser para o middleware autorizar o retorno à página
    await page.context().addCookies([
      {
        name: 'cooperado_session',
        value: 'mock-token-cooperado',
        url: 'http://localhost:3005',
      },
    ]);

    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();

    // Deve redirecionar de volta para o prontuário do paciente desejado
    await page.waitForURL(/.*\/cooperado\/prontuario\/pac_teste_link/, { timeout: 15000 });
    await expect(page).toHaveURL(/.*\/cooperado\/prontuario\/pac_teste_link/);
  });
});
