import { test, expect, Page } from '@playwright/test';

async function autenticar(page: Page) {
  await page.context().addCookies([
    {
      name: 'gestor_session',
      value: 'user-e2e-1',
      url: 'http://localhost:3000',
    },
  ]);
}

const mockEquipamentos = [
  {
    _id: 'equip-1',
    txt_nome: 'Concentrador de oxigênio com nebulização',
    txt_marca: 'Lumiar',
    txt_modelo: 'Mercury 5L',
    txt_numero_serie: 'LUMI-MERC-5310',
    num_preco_padrao: 0.001,
    txt_status: 'Aguardando conferência',
    txt_codigo_interno: 'EQP-001',
    txt_numero_patrimonio: 'PAT-001',
  },
  {
    _id: 'equip-2',
    txt_nome: 'Cama Hospitalar Motorizada',
    txt_marca: 'Pilati',
    txt_modelo: 'Comfort',
    txt_numero_serie: 'PIL-COMF-9988',
    num_preco_padrao: 15.0,
    txt_status: 'Recolhido e aguardando conferência',
    txt_codigo_interno: 'EQP-002',
    txt_numero_patrimonio: 'PAT-002',
  }
];

async function mockApis(page: Page) {
  await page.route('**/api/gestor/me', (route) =>
    route.fulfill({ json: { nome: 'Marcos Gabryel', email: 'gestor@multcare.com.br', foto: null } })
  );
  await page.route('**/api/gestor/equipamentos', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({ json: { success: true, data: mockEquipamentos, fluxoV2Ativo: true } });
    } else {
      route.fulfill({ json: { success: true } });
    }
  });
  await page.route('**/api/gestor/pacientes', (route) =>
    route.fulfill({ json: { success: true, data: [] } })
  );
  await page.route('**/api/gestor/locacoes', (route) =>
    route.fulfill({ json: { success: true, data: [] } })
  );
  await page.route('**/api/gestor/equipamentos/reservas**', (route) =>
    route.fulfill({ json: { success: true, data: [] } })
  );
}

test('Exibe botões de Conferir para equipamentos com status de conferência pendente', async ({ page }) => {
  await autenticar(page);
  await mockApis(page);
  await page.goto('/gestor/equipamentos');
  await page.getByRole('button', { name: 'Catálogo de Equipamentos' }).click();

  // Verifica que ambos os equipamentos com status de conferência mostram o botão "Conferir"
  const row1 = page.locator('tr', { hasText: 'LUMI-MERC-5310' });
  await expect(row1.getByRole('button', { name: 'Conferir' })).toBeVisible();

  const row2 = page.locator('tr', { hasText: 'PIL-COMF-9988' });
  await expect(row2.getByRole('button', { name: 'Conferir' })).toBeVisible();
});

test('Realiza o fluxo de conferência de um equipamento Aguardando conferência', async ({ page }) => {
  await autenticar(page);
  await mockApis(page);

  // Monitora a chamada de POST de conferência
  let postData: any = null;
  await page.route('**/api/gestor/equipamentos/equip-1/conferencias', async (route) => {
    postData = route.request().postDataJSON();
    await route.fulfill({ json: { success: true } });
  });

  await page.goto('/gestor/equipamentos');
  await page.getByRole('button', { name: 'Catálogo de Equipamentos' }).click();

  // Abre modal de conferência para o primeiro item
  const row1 = page.locator('tr', { hasText: 'LUMI-MERC-5310' });
  await row1.getByRole('button', { name: 'Conferir' }).click();

  // Modal de conferência deve ser exibido
  await expect(page.getByText('Conferência Pós-Recolhimento')).toBeVisible();

  // Preenche dados do formulário
  await page.fill('textarea[placeholder*="Estado geral do ativo"]', 'Equipamento em perfeito estado físico e funcional.');
  await page.selectOption('select[id*="Destination"]', 'Aguardando higienização');

  // Submete
  await page.getByRole('button', { name: 'Confirmar' }).click();

  // Verifica se o POST foi realizado com os parâmetros corretos
  await expect.poll(() => postData).not.toBeNull();
  expect(postData.txt_status_destino).toBe('Aguardando higienização');
  expect(postData.txt_resultado).toBe('Equipamento em perfeito estado físico e funcional.');
});

test('Permite clicar em "Conferir Agora" de dentro do modal de edição', async ({ page }) => {
  await autenticar(page);
  await mockApis(page);
  await page.goto('/gestor/equipamentos');
  await page.getByRole('button', { name: 'Catálogo de Equipamentos' }).click();

  // Abre o modal de edição do primeiro equipamento
  const row1 = page.locator('tr', { hasText: 'LUMI-MERC-5310' });
  await row1.getByRole('button', { name: 'Editar' }).click();

  // Modal de edição deve conter o status desabilitado e o botão "Conferir Agora"
  await expect(page.getByText('O status do ativo é governado por ações de movimentação.')).toBeVisible();
  const conferirAgoraBtn = page.getByRole('button', { name: 'Conferir Agora' });
  await expect(conferirAgoraBtn).toBeVisible();

  // Clica no botão e deve abrir o modal de conferência
  await conferirAgoraBtn.click();
  await expect(page.getByText('Conferência Pós-Recolhimento')).toBeVisible();
  await expect(page.getByRole('dialog').getByText('Concentrador de oxigênio com nebulização')).toBeVisible();
});

// --- Romaneio de entrega ---

const mockCliente = {
  _id: 'cli-1',
  txt_nome: 'Gabriele Almeida',
  txt_cpf: '123.456.789-00',
  txt_whatsapp: '(11) 90000-0000',
  txt_endereco: 'Rua das Flores, 100 - São Paulo/SP',
  txt_tipo: 'Homecare',
};

const mockLocacoesAtivas = [
  {
    _id: 'loc-1',
    fk_equipamento: 'equip-1',
    fk_paciente: 'cli-1',
    date_inicio: '2026-08-01',
    date_fim_previsto: '2026-09-01',
    num_valor_aluguel: 100,
    txt_status: 'Ativo',
  },
  {
    _id: 'loc-2',
    fk_equipamento: 'equip-2',
    fk_paciente: 'cli-1',
    date_inicio: '2026-08-01',
    date_fim_previsto: '2026-09-01',
    num_valor_aluguel: 200,
    txt_status: 'Ativo',
  },
];

// Sobrepõe os mocks vazios de mockApis com um cliente que tem locações ativas.
// No Playwright a rota registrada por último vence, então esta função deve ser
// chamada depois de mockApis.
async function mockClienteComLocacoes(page: Page) {
  await page.route('**/api/gestor/pacientes', (route) =>
    route.fulfill({ json: { success: true, data: [mockCliente] } })
  );
  await page.route('**/api/gestor/locacoes', (route) =>
    route.fulfill({ json: { success: true, data: mockLocacoesAtivas } })
  );
  await page.route('**/api/gestor/domicilios**', (route) =>
    route.fulfill({ json: { success: true, data: [] } })
  );
}

test('Exibe o botão de romaneio para cliente com locação ativa', async ({ page }) => {
  await autenticar(page);
  await mockApis(page);
  await mockClienteComLocacoes(page);

  await page.goto('/gestor/equipamentos');
  await page.getByRole('button', { name: 'Cadastro de Clientes' }).click();

  const linha = page.locator('tr', { hasText: 'Gabriele Almeida' });
  const botao = linha.getByRole('link', { name: 'Romaneio' });
  await expect(botao).toBeVisible();
  await expect(botao).toHaveAttribute('href', '/gestor/equipamentos/romaneio?cliente=cli-1');
});

test('Romaneio abre com todos os equipamentos ativos marcados e permite desmarcar', async ({ page }) => {
  await autenticar(page);
  await mockApis(page);
  await mockClienteComLocacoes(page);

  await page.goto('/gestor/equipamentos/romaneio?cliente=cli-1');

  // Cabeçalho do documento e dados do cliente
  await expect(page.getByText('ROMANEIO DE ENTREGA DE EQUIPAMENTOS')).toBeVisible();
  await expect(page.getByText('Rua das Flores, 100 - São Paulo/SP')).toBeVisible();

  // Os dois equipamentos vêm marcados e aparecem no documento
  await expect(page.getByText('2 de 2 equipamentos selecionados')).toBeVisible();
  const documento = page.locator('#print-area');
  await expect(documento.getByText('LUMI-MERC-5310')).toBeVisible();
  await expect(documento.getByText('PIL-COMF-9988')).toBeVisible();
  await expect(documento.getByText('Total de itens: 2')).toBeVisible();

  // Desmarcar um item o remove do documento impresso
  await page.getByRole('checkbox').first().uncheck();
  await expect(page.getByText('1 de 2 equipamentos selecionados')).toBeVisible();
  await expect(documento.getByText('LUMI-MERC-5310')).toHaveCount(0);
  await expect(documento.getByText('PIL-COMF-9988')).toBeVisible();
  await expect(documento.getByText('Total de itens: 1')).toBeVisible();
});

test('Romaneio pré-seleciona apenas o item informado na query', async ({ page }) => {
  await autenticar(page);
  await mockApis(page);
  await mockClienteComLocacoes(page);

  await page.goto('/gestor/equipamentos/romaneio?cliente=cli-1&itens=loc-2');

  await expect(page.getByText('1 de 2 equipamentos selecionados')).toBeVisible();
  const documento = page.locator('#print-area');
  await expect(documento.getByText('PIL-COMF-9988')).toBeVisible();
  await expect(documento.getByText('LUMI-MERC-5310')).toHaveCount(0);
});
