import { test, expect, Page } from '@playwright/test';

async function autenticar(page: Page) {
  await page.context().addCookies([
    {
      name: 'gestor_session',
      value: 'user-e2e-1',
      url: 'http://localhost:3005',
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

// --- Registro de locação ---
//
// O cadastro de locação quebrou em produção em 2026-08-10: com EQUIPAMENTOS_V2_ENABLED
// ligado, a rota chama obterOuCriarDomicilioAtivo, que busca o tipo `domicilio` no Bubble
// por `fk_paciente` — campo que não existia lá. O Bubble devolvia 404 "Field not found
// fk_paciente for type domicilio" e o gestor via a mensagem crua na tela.
// O schema do Bubble foi corrigido; estes testes cobrem o lado do app.

const mockEquipamentoDisponivel = {
  _id: 'equip-3',
  txt_nome: 'Concentrador de Oxigênio',
  txt_marca: 'Philips',
  txt_modelo: 'EverFlo',
  txt_numero_serie: 'SN-AUTO-1784',
  num_preco_padrao: 189.9,
  txt_status: 'Disponível',
  txt_codigo_interno: 'EQP-003',
  txt_numero_patrimonio: 'PAT-003',
};

// Registrada depois de mockApis para vencer a rota anterior (no Playwright a última vence).
async function mockCatalogoComDisponivel(page: Page) {
  await page.route('**/api/gestor/equipamentos', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({
        json: {
          success: true,
          data: [...mockEquipamentos, mockEquipamentoDisponivel],
          fluxoV2Ativo: true,
        },
      });
    } else {
      route.fulfill({ json: { success: true } });
    }
  });
  await page.route('**/api/gestor/pacientes', (route) =>
    route.fulfill({ json: { success: true, data: [mockCliente] } })
  );
}

async function abrirModalDeLocacao(page: Page) {
  await page.goto('/gestor/equipamentos');
  await page.getByRole('button', { name: 'Nova Locação' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText('Registrar Nova Locação')).toBeVisible();
}

async function preencherLocacao(page: Page) {
  await page.getByLabel('Cliente selecionado').selectOption('cli-1');
  await page.locator('#rentEquipId').selectOption('equip-3');
  await page.locator('#rentDataInicio').fill('2026-08-10');
  await page.locator('#rentDataFimPrevisto').fill('2026-09-10');
  await page.locator('#rentTipoCobranca').selectOption('Somente mensalidade');
}

test('Só oferece equipamentos com status Disponível na nova locação', async ({ page }) => {
  await autenticar(page);
  await mockApis(page);
  await mockCatalogoComDisponivel(page);
  await abrirModalDeLocacao(page);

  // equip-1 e equip-2 estão aguardando conferência e não podem ser implantados
  const opcoes = page.locator('#rentEquipId option');
  await expect(opcoes).toHaveCount(2); // placeholder + o único disponível
  await expect(opcoes.nth(1)).toHaveText(/SN-AUTO-1784/);
});

test('Registra locação e envia o payload esperado', async ({ page }) => {
  await autenticar(page);
  await mockApis(page);
  await mockCatalogoComDisponivel(page);

  let payload: any = null;
  await page.route('**/api/gestor/locacoes', async (route) => {
    if (route.request().method() === 'POST') {
      payload = route.request().postDataJSON();
      await route.fulfill({ json: { success: true, data: { _id: 'loc-nova' } } });
    } else {
      await route.fulfill({ json: { success: true, data: [] } });
    }
  });

  await abrirModalDeLocacao(page);
  await preencherLocacao(page);

  // O valor é pré-preenchido a partir do preço padrão do equipamento
  await expect(page.locator('#rentValor')).toHaveValue('189.9');

  await page.getByRole('button', { name: 'Registrar' }).click();

  await expect.poll(() => payload).not.toBeNull();
  expect(payload.fk_paciente).toBe('cli-1');
  expect(payload.fk_equipamento).toBe('equip-3');
  expect(payload.date_inicio).toBe('2026-08-10');
  expect(payload.date_fim_previsto).toBe('2026-09-10');
  expect(payload.num_valor_aluguel).toBe(189.9);
  expect(payload.os_tipo_cobranca).toBe('Somente mensalidade');

  // Sucesso fecha o modal
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('Mostra o erro do Bubble sem fechar o modal nem perder o preenchimento', async ({ page }) => {
  await autenticar(page);
  await mockApis(page);
  await mockCatalogoComDisponivel(page);

  await page.route('**/api/gestor/locacoes', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 500,
        json: { success: false, error: 'Field not found fk_paciente for type domicilio' },
      });
    } else {
      await route.fulfill({ json: { success: true, data: [] } });
    }
  });

  await abrirModalDeLocacao(page);
  await preencherLocacao(page);
  await page.getByRole('button', { name: 'Registrar' }).click();

  // A mensagem do Bubble chega à tela — foi o que o gestor viu em produção.
  // O erro do modal mora no modal: aparece uma única vez, e não também no
  // banner da página (que é reservado a falhas de carregamento da listagem).
  const modal = page.getByRole('dialog');
  await expect(modal.getByText('Field not found fk_paciente for type domicilio')).toBeVisible();
  await expect(page.getByText('Field not found fk_paciente for type domicilio')).toHaveCount(1);

  // O modal continua aberto e nada do que foi digitado se perde
  await expect(modal).toBeVisible();
  await expect(page.getByLabel('Cliente selecionado')).toHaveValue('cli-1');
  await expect(page.locator('#rentEquipId')).toHaveValue('equip-3');
  await expect(page.locator('#rentValor')).toHaveValue('189.9');
});

test('Cai na mensagem genérica quando a API não devolve motivo', async ({ page }) => {
  await autenticar(page);
  await mockApis(page);
  await mockCatalogoComDisponivel(page);

  await page.route('**/api/gestor/locacoes', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ status: 500, json: {} });
    } else {
      await route.fulfill({ json: { success: true, data: [] } });
    }
  });

  await abrirModalDeLocacao(page);
  await preencherLocacao(page);
  await page.getByRole('button', { name: 'Registrar' }).click();

  const modal = page.getByRole('dialog');
  await expect(modal.getByText('Erro ao registrar locação.')).toBeVisible();
  await expect(page.getByText('Erro ao registrar locação.')).toHaveCount(1);
  await expect(modal).toBeVisible();
});

test('Cadastra um novo cliente com sucesso via modal', async ({ page }) => {
  await autenticar(page);
  await mockApis(page);

  let postPayload: any = null;
  await page.route('**/api/gestor/pacientes', async (route) => {
    if (route.request().method() === 'POST') {
      postPayload = route.request().postDataJSON();
      await route.fulfill({
        json: {
          success: true,
          data: {
            _id: 'cli-new-1',
            txt_nome: 'Carlos Drummond de Andrade',
            txt_endereco: 'Rua das Flores, 123 - Centro, Itabira - MG',
            txt_tipo: 'Homecare',
          },
        },
      });
    } else {
      await route.fulfill({ json: { success: true, data: [] } });
    }
  });

  await page.goto('/gestor/equipamentos');
  await page.getByRole('button', { name: 'Cadastro de Clientes' }).click();

  // Clica no botão para abrir o modal de cadastro
  await page.getByRole('button', { name: 'Cadastrar Cliente' }).click();

  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible();
  await expect(modal.getByText('Cadastrar Cliente')).toBeVisible();

  // Preenche os dados do paciente
  await page.fill('#patNome', 'Carlos Drummond de Andrade');
  await page.fill('#patCPF', '123.456.789-00');
  await page.fill('#patWhatsapp', '(11) 98765-4321');
  await page.fill('#patEndereco', 'Rua das Flores, 123 - Centro, Itabira - MG');

  // Submete o formulário
  await modal.getByRole('button', { name: 'Cadastrar' }).click();

  // Modal deve ser fechado
  await expect(modal).not.toBeVisible();

  // Valida que o payload enviado para a API continha os dados corretos
  expect(postPayload).toEqual({
    txt_nome: 'Carlos Drummond de Andrade',
    txt_cpf: '123.456.789-00',
    txt_whatsapp: '(11) 98765-4321',
    txt_endereco: 'Rua das Flores, 123 - Centro, Itabira - MG',
    txt_email: '',
    txt_tipo: 'Homecare',
  });
});

test('Exibe mensagem de erro dentro do modal ao falhar o cadastro de cliente', async ({ page }) => {
  await autenticar(page);
  await mockApis(page);

  await page.route('**/api/gestor/pacientes', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 400,
        json: { success: false, error: 'Nome e Endereço de Entrega são obrigatórios.' },
      });
    } else {
      await route.fulfill({ json: { success: true, data: [] } });
    }
  });

  await page.goto('/gestor/equipamentos');
  await page.getByRole('button', { name: 'Cadastro de Clientes' }).click();
  await page.getByRole('button', { name: 'Cadastrar Cliente' }).click();

  const modal = page.getByRole('dialog');
  await page.fill('#patNome', 'Paciente Incompleto');
  await page.fill('#patCPF', '123.456.789-00');
  await page.fill('#patWhatsapp', '(11) 98765-4321');
  await page.fill('#patEndereco', 'Endereço Inválido');

  await modal.getByRole('button', { name: 'Cadastrar' }).click();

  // Valida que a mensagem de erro é exibida dentro do modal e o modal continua aberto
  await expect(modal.getByText('Nome e Endereço de Entrega são obrigatórios.')).toBeVisible();
  await expect(modal).toBeVisible();
});
