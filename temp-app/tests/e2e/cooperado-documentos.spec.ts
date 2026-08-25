import { test, expect, Page } from '@playwright/test';

async function autenticar(page: Page) {
  await page.context().addCookies([
    {
      name: 'gestor_session',
      value: 'user-e2e-gestor-1',
      url: 'http://localhost:3000',
    },
  ]);
}

const mockCooperados = [
  {
    _id: 'coop-1',
    txt_nomeCompleto: 'Dr. Lucas Ferreira Santos',
    txt_CPF: '111.222.333-44',
    txt_email: 'lucas.santos@exemplo.com',
    txt_whatsapp: '(11) 99887-7665',
    txt_rg: '12.345.678-9',
    txt_endereco: 'Av. Paulista, 1000 - São Paulo, SP',
    txt_termo_status: 'Assinado',
    file_termo_assinado: 'https://cdn.bubble.io/termo_adesao_assinado_lucas.pdf',
    fks_pasta: [
      'https://cdn.bubble.io/foto_rg_frente.png',
      'https://cdn.bubble.io/foto_rg_verso.png',
      'https://cdn.bubble.io/comprovante_residencia.pdf',
      'https://cdn.bubble.io/diploma_medicina.jpg',
    ],
    fks_profissoes: ['Médico'],
  },
];

async function mockDashboardApis(page: Page) {
  await page.route('**/api/gestor/me', (route) =>
    route.fulfill({ json: { nome: 'Marcos Gestor', email: 'gestor@gestorcoop.app', foto: null } })
  );

  await page.route('**/api/gestor/cooperados', (route) => {
    route.fulfill({ json: { success: true, data: mockCooperados } });
  });
}

test('Abre o modal de documentos na grade 2x2 e exibe fotos e PDFs lado a lado', async ({ page }) => {
  await autenticar(page);
  await mockDashboardApis(page);

  await page.goto('/gestor/dashboard');

  // Localiza a linha do cooperado e clica no botão "Doc" / "Gerenciar Documentos"
  const row = page.locator('tr', { hasText: 'Dr. Lucas Ferreira Santos' });
  await expect(row).toBeVisible();

  await row.getByTitle('Ver Documentos e Fotos em Grade 2x2').click();

  // Modal de documentos deve ser exibido com cabeçalho e contagem
  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible();
  await expect(modal.getByText('Documentos & Anexos')).toBeVisible();
  await expect(modal.getByText('Dr. Lucas Ferreira Santos')).toBeVisible();

  // Valida que a grade exibe múltiplos documentos (grid 2x2)
  await expect(modal.getByText('foto_rg_frente.png')).toBeVisible();
  await expect(modal.getByText('foto_rg_verso.png')).toBeVisible();
  await expect(modal.getByText('comprovante_residencia.pdf')).toBeVisible();
  await expect(modal.getByText('diploma_medicina.jpg')).toBeVisible();
  await expect(modal.getByText('termo_adesao_assinado_lucas.pdf')).toBeVisible();

  // Testa o filtro de Fotos
  await modal.getByRole('button', { name: /Fotos/ }).click();
  await expect(modal.getByText('foto_rg_frente.png')).toBeVisible();
  await expect(modal.getByText('diploma_medicina.jpg')).toBeVisible();
  await expect(modal.getByText('comprovante_residencia.pdf')).not.toBeVisible();

  // Volta para Todos
  await modal.getByRole('button', { name: /Todos/ }).click();
  await expect(modal.getByText('comprovante_residencia.pdf')).toBeVisible();
});

test('Permite excluir um documento individualmente com confirmação', async ({ page }) => {
  await autenticar(page);
  await mockDashboardApis(page);

  let deletePayload: any = null;
  await page.route('**/api/gestor/cooperados/coop-1/documentos', async (route) => {
    if (route.request().method() === 'DELETE') {
      deletePayload = route.request().postDataJSON();
      await route.fulfill({ json: { success: true, message: 'Documento removido.' } });
    } else {
      await route.fulfill({ json: { success: true } });
    }
  });

  await page.goto('/gestor/dashboard');

  const row = page.locator('tr', { hasText: 'Dr. Lucas Ferreira Santos' });
  await row.getByTitle('Ver Documentos e Fotos em Grade 2x2').click();

  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible();

  // Localiza o card do comprovante e clica no botão de excluir (lixeira)
  const card = modal.locator('div', { hasText: 'comprovante_residencia.pdf' }).last();
  const deleteBtn = card.getByTitle('Remover documento');
  await deleteBtn.click();

  // Deve exibir botão "Confirmar"
  const confirmBtn = card.getByRole('button', { name: 'Confirmar' });
  await expect(confirmBtn).toBeVisible();
  await confirmBtn.click();

  // Valida que a chamada de DELETE foi feita com a URL correta
  expect(deletePayload).toEqual({ url: 'https://cdn.bubble.io/comprovante_residencia.pdf' });

  // Documento é removido visualmente da lista
  await expect(modal.getByText('Documento removido com sucesso.')).toBeVisible();
  await expect(modal.getByText('comprovante_residencia.pdf')).not.toBeVisible();
});
