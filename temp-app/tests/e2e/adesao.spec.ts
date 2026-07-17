import { test, expect, Page } from '@playwright/test';

// CPF válido (dígitos verificadores corretos) usado nos testes.
const CPF_VALIDO = '529.982.247-25';
const CPF_INVALIDO = '111.111.111-11';

// Mocka todas as dependências externas do fluxo de adesão para que os testes
// nunca criem dados reais no Bubble/ZapSign.
async function mockBackend(
  page: Page,
  opts: { cpfExists?: boolean; termoStatus?: string | null } = {}
) {
  await page.route('**/api/cooperado/verificar-cpf**', (route) =>
    route.fulfill({
      json: opts.cpfExists
        ? { exists: true, termoStatus: opts.termoStatus ?? null, bloqueado: false }
        : { exists: false },
    })
  );

  await page.route('**/api/cooperado/upload', (route) =>
    route.fulfill({
      json: { success: true, url: 'https://cdn.example.com/doc-teste.pdf', name: 'doc-teste.pdf' },
    })
  );

  await page.route('**/api/cooperado/adesao', (route) =>
    route.fulfill({
      json: {
        success: true,
        cooperadoId: 'coop-e2e-1',
        docToken: 'tok-e2e',
        signUrl: 'http://localhost:3000/e2e-assinatura-mock',
      },
    })
  );

  // Página-destino do redirect pós-cadastro (no app real é a ZapSign).
  await page.route('**/e2e-assinatura-mock', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<h1>Assinatura mock</h1>' })
  );

  await page.route('https://viacep.com.br/**', (route) =>
    route.fulfill({
      json: {
        logradouro: 'Avenida Teste',
        bairro: 'Setor Central',
        localidade: 'Goiânia',
        uf: 'GO',
      },
    })
  );
}

async function preencherEtapa1(page: Page, cpf = CPF_VALIDO) {
  await page.fill('input[name="nomeCompleto"]', 'Maria de Teste E2E');
  await page.fill('input[name="cpf"]', cpf);
  await page.fill('input[name="email"]', 'maria.e2e@example.com');
  await page.fill('input[name="whatsapp"]', '62999990000');
}

async function avancar(page: Page) {
  await page.getByRole('button', { name: /Avançar/ }).click();
}

// Cada teste roda em um contexto novo do Playwright — localStorage e cookies
// começam vazios, então não é preciso limpar nada manualmente.

test('fluxo completo de adesão até a tela de assinatura', async ({ page }) => {
  await mockBackend(page);
  await page.goto('/cooperado/adesao');

  // Etapa 1 — Dados pessoais
  await preencherEtapa1(page);
  await avancar(page);

  // Etapa 2 — Endereço (ViaCEP mockado preenche rua/bairro/cidade)
  await expect(page.getByRole('heading', { name: 'Endereço' })).toBeVisible();
  await page.fill('input[name="cep"]', '74000000');
  await expect(page.locator('input[name="rua"]')).toHaveValue('Avenida Teste');
  await page.fill('input[name="numero"]', '120');
  await avancar(page);

  // Etapa 3 — Profissões
  await expect(page.getByRole('heading', { name: 'Profissões' })).toBeVisible();
  await page.fill('input[placeholder="123456"]', '654321');
  await page.getByRole('button', { name: /Salvar Profissão/ }).click();
  await avancar(page);

  // Etapa 4 — Dados bancários
  await expect(page.getByRole('heading', { name: /Dados Bancários/ })).toBeVisible();
  await page.fill('input[placeholder="1234-5"]', '0001');
  await page.fill('input[placeholder="123456-7"]', '12345-6');
  await page.getByRole('button', { name: /Salvar Conta/ }).click();
  await avancar(page);

  // Etapa 5 — Documentos (upload mockado)
  await expect(page.getByRole('heading', { name: /Upload de Documentos/ })).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({
    name: 'rg.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 conteudo de teste'),
  });
  await expect(page.getByText('doc-teste.pdf')).toBeVisible();
  await page.getByRole('button', { name: /Finalizar & Assinar/ }).click();

  // Etapa 6 — Sucesso
  await expect(page.getByText('Cadastro realizado com sucesso!')).toBeVisible();
});

test('CPF inválido bloqueia o avanço da etapa 1', async ({ page }) => {
  await mockBackend(page);
  await page.goto('/cooperado/adesao');

  await preencherEtapa1(page, CPF_INVALIDO);
  await avancar(page);

  await expect(page.getByText('CPF inválido. Confira os números digitados.')).toBeVisible();
  // Continua na etapa 1
  await expect(page.locator('input[name="nomeCompleto"]')).toBeVisible();
});

test('CPF já cadastrado com termo pendente é bloqueado com orientação', async ({ page }) => {
  await mockBackend(page, { cpfExists: true, termoStatus: 'Aguardando Assinatura' });
  await page.goto('/cooperado/adesao');

  await preencherEtapa1(page);
  await avancar(page);

  await expect(page.getByText(/já possui um cadastro com assinatura do termo pendente/)).toBeVisible();
  await expect(page.locator('input[name="nomeCompleto"]')).toBeVisible();
});

test('CPF já cadastrado (ativo) é bloqueado', async ({ page }) => {
  await mockBackend(page, { cpfExists: true, termoStatus: 'Assinado' });
  await page.goto('/cooperado/adesao');

  await preencherEtapa1(page);
  await avancar(page);

  await expect(page.getByText(/já possui cadastro na cooperativa/)).toBeVisible();
});

test('progresso é retomado após recarregar a página', async ({ page }) => {
  await mockBackend(page);
  await page.goto('/cooperado/adesao');

  await preencherEtapa1(page);
  await avancar(page);
  await expect(page.getByRole('heading', { name: 'Endereço' })).toBeVisible();

  // Simula o cooperado fechando e reabrindo a página
  await page.reload();

  await expect(page.getByText('Continuamos de onde você parou')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Endereço' })).toBeVisible();

  // Dados da etapa 1 preservados
  await page.getByRole('button', { name: /Voltar/ }).click();
  await expect(page.locator('input[name="nomeCompleto"]')).toHaveValue('Maria de Teste E2E');
  await expect(page.locator('input[name="cpf"]')).toHaveValue(CPF_VALIDO);
});

test('recomeçar do zero apaga o progresso salvo', async ({ page }) => {
  await mockBackend(page);
  await page.goto('/cooperado/adesao');

  await preencherEtapa1(page);
  await avancar(page);
  await expect(page.getByRole('heading', { name: 'Endereço' })).toBeVisible();
  await page.reload();

  page.on('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: /Recomeçar do zero/ }).click();

  // Volta para a etapa 1 com o formulário vazio
  await expect(page.locator('input[name="nomeCompleto"]')).toHaveValue('');
  await expect(page.getByText('Continuamos de onde você parou')).not.toBeVisible();
});

test('painel de ajuda mostra orientações da etapa atual e contatos', async ({ page }) => {
  await mockBackend(page);
  await page.goto('/cooperado/adesao');

  await page.getByRole('button', { name: /Abrir ajuda/ }).click();
  await expect(page.getByRole('dialog', { name: 'Painel de ajuda' })).toBeVisible();
  await expect(page.getByText('Etapa atual: Dados Pessoais')).toBeVisible();
  await expect(page.getByText(/cada CPF só pode ter uma adesão/i)).toBeVisible();

  await page.getByRole('button', { name: /Fechar ajuda/ }).click();
  await expect(page.getByRole('dialog', { name: 'Painel de ajuda' })).not.toBeVisible();
});
