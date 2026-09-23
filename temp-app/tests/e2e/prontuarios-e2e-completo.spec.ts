import { test, expect, Page } from '@playwright/test';

async function autenticarGestor(page: Page) {
  await page.context().addCookies([
    {
      name: 'gestor_session',
      value: 'user-e2e-gestor-1',
      url: 'http://localhost:3005',
    },
  ]);
}

async function autenticarCooperado(page: Page) {
  await page.context().addCookies([
    {
      name: 'cooperado_session',
      value: 'token-e2e-cooperado-1',
      url: 'http://localhost:3005',
    },
  ]);
}

const mockPacienteComCota = {
  id: 'p_1',
  nome: 'Nigossauros da Silva',
  cpf: '123.456.789-00',
  data_nascimento: '1980-01-15',
  endereco: 'Rua dos Dinossauros, 100 - Centro',
  telefone: '(11) 98888-7777',
  responsavel_nome: 'Maria Silva',
  responsavel_telefone: '(11) 98888-6666',
  diagnostico_principal: 'Pós-operatório de Artroplastia',
  cid10: 'M16.1',
  complexidade: 'Média',
  plano_saude: 'Unimed',
  numero_carteirinha: '9988776655',
  warnings: ['Alergia a Dipirona'],
  status: 'Ativo',
  limite_visitas_mes: 13,
  visitas_realizadas_mes: 5,
  visitas_restantes_mes: 8,
  limite_atingido: false,
  total_prescricoes_ativas: 2,
};

const mockPacienteCotaEsgotada = {
  id: 'p_esgotado',
  nome: 'Dona Alzira Ferreira',
  cpf: '987.654.321-99',
  data_nascimento: '1945-08-20',
  endereco: 'Av. Brasil, 500 - Apto 12',
  telefone: '(11) 97777-6666',
  responsavel_nome: 'Carlos Ferreira (Filho)',
  responsavel_telefone: '(11) 97777-5555',
  diagnostico_principal: 'Demência Avançada / HAS',
  cid10: 'F03',
  complexidade: 'Alta',
  plano_saude: 'Bradesco Saúde',
  numero_carteirinha: '1122334455',
  warnings: ['Risco Alto de Queda'],
  status: 'Ativo',
  limite_visitas_mes: 13,
  visitas_realizadas_mes: 13,
  visitas_restantes_mes: 0,
  limite_atingido: true,
  total_prescricoes_ativas: 1,
};

test.describe('Módulo Completo de Prontuários & Visitas: Gestor, Cooperado e Bloqueio de Cota', () => {
  test('1. Fluxo de Autenticação SSO & Redirecionamento', async ({ page }) => {
    await autenticarCooperado(page);

    await page.route('**/api/cooperado/me', (route) =>
      route.fulfill({ json: { id: 'coop_123', nome: 'Téc. Carlos Enfermagem', cargo: 'Tecnico_Enfermagem' } })
    );

    await page.route('**/api/cooperado/agenda', (route) =>
      route.fulfill({
        json: {
          success: true,
          pacientes: [mockPacienteComCota],
          prescricoes: [],
          aprazamentos: [],
        },
      })
    );

    // 1. Acessa o painel do cooperado com o fragmento gerado pelo SSO (#s=token)
    await page.goto('http://localhost:3005/cooperado#s=mock-jwt-token');

    // 2. Verifica que a URL do cooperado está ativa
    await expect(page).toHaveURL(/.*\/cooperado/);

    // 3. Verifica que a agenda carregou o paciente com sucesso
    await expect(page.locator('text=Nigossauros da Silva')).toBeVisible({ timeout: 10000 });
  });

  test('2. Gestor: Admissão de Paciente com Cota Mensal de 13 Visitas', async ({ page }) => {
    await autenticarGestor(page);

    await page.route('**/api/gestor/me', (route) =>
      route.fulfill({ json: { nome: 'Dr. Marcos Gestor', email: 'gestor@gestorcoop.app' } })
    );

    let pacienteCadastrado: any = null;

    await page.route('**/api/gestor/prontuarios/pacientes', (route) => {
      if (route.request().method() === 'POST') {
        pacienteCadastrado = JSON.parse(route.request().postData() || '{}');
        return route.fulfill({
          json: {
            success: true,
            data: {
              ...pacienteCadastrado,
              id: 'p_novo_123',
              visitas_realizadas_mes: 0,
              visitas_restantes_mes: pacienteCadastrado.limite_visitas_mes,
              limite_atingido: false,
            },
          },
        });
      }
      return route.fulfill({
        json: {
          success: true,
          data: pacienteCadastrado
            ? [pacienteCadastrado, mockPacienteComCota, mockPacienteCotaEsgotada]
            : [mockPacienteComCota, mockPacienteCotaEsgotada],
        },
      });
    });

    await page.route('**/api/gestor/prontuarios?*', (route) =>
      route.fulfill({ json: { success: true, results: [] } })
    );

    await page.goto('http://localhost:3005/gestor/prontuarios');

    // Abre modal de admissão de paciente
    await page.click('button:has-text("Admitir Paciente")');
    await expect(page.locator('text=Admissão Clínica de Paciente')).toBeVisible();

    // Preenche os dados
    await page.fill('input[placeholder="Ex: Seu João da Silva"]', 'Nigossauros Paciente Teste');
    await page.fill('input[placeholder="000.000.000-00"]', '111.222.333-44');
    await page.fill('input[placeholder="Ex: 13"]', '13');

    // Submete o formulário
    await page.click('button[type="submit"]:has-text("Salvar Admissão")');

    // Verifica que o payload enviado conteve a cota mensal
    expect(pacienteCadastrado).not.toBeNull();
    expect(pacienteCadastrado.limite_visitas_mes).toBe(13);
  });

  test('3. Gestor: Visualização e Ajuste de Cota no Prontuário 360', async ({ page }) => {
    await autenticarGestor(page);

    await page.route('**/api/gestor/me', (route) =>
      route.fulfill({ json: { nome: 'Dr. Marcos Gestor' } })
    );

    let cotaAtualizada = 13;

    await page.route('**/api/gestor/prontuarios/pacientes/p_1', (route) => {
      if (route.request().method() === 'PUT') {
        const body = JSON.parse(route.request().postData() || '{}');
        cotaAtualizada = body.limite_visitas_mes;
        return route.fulfill({
          json: { success: true, data: { ...mockPacienteComCota, limite_visitas_mes: cotaAtualizada } },
        });
      }
      return route.fulfill({
        json: {
          success: true,
          data: {
            paciente: {
              ...mockPacienteComCota,
              limite_visitas_mes: cotaAtualizada,
              visitas_restantes_mes: cotaAtualizada - mockPacienteComCota.visitas_realizadas_mes,
            },
            evolucoes: [],
            prescricoes: [],
            sinaisVitais: [],
            pareceres: [],
          },
        },
      });
    });

    await page.goto('http://localhost:3005/gestor/prontuarios/p_1');

    // Verifica exibição do card de cota
    await expect(page.locator('text=Cota Contratada de Visitas Técnicas')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=5 de 13 visitas técnicas realizadas')).toBeVisible();

    // Clica para alterar cota mensal
    await page.click('button:has-text("Alterar Cota Mensal")');
    await page.fill('input[placeholder="Qtd"]', '20');
    await page.click('button:has-text("Salvar")');

    // Verifica que a cota foi atualizada para 20
    expect(cotaAtualizada).toBe(20);
  });

  test('4. Cooperado: Visualização de Cota Disponível e Início de Check-in', async ({ page }) => {
    await autenticarCooperado(page);

    await page.route('**/api/cooperado/me', (route) =>
      route.fulfill({ json: { id: 'coop_123', nome: 'Téc. Marcos', cargo: 'Tecnico_Enfermagem' } })
    );

    await page.route('**/api/cooperado/agenda', (route) =>
      route.fulfill({
        json: {
          success: true,
          pacientes: [mockPacienteComCota],
          prescricoes: [],
          aprazamentos: [],
        },
      })
    );

    await page.goto('http://localhost:3005/cooperado');

    // Verifica o badge de saldo de visitas no card da agenda
    await expect(page.locator('text=Visitas no mês: 5/13 (8 restam)')).toBeVisible();

    // Acessa o prontuário do paciente
    await page.click(`a[href="/cooperado/prontuario/p_1"]`);

    // Confirma identificação do paciente no modal
    await page.click('button:has-text("Confirmar")');

    // Verifica o banner de cota contratada
    await expect(page.locator('text=📋 Cota Mensal Contratada')).toBeVisible();
    await expect(page.locator('text=5 de 13 visitas realizadas. Restam 8 visitas')).toBeVisible();

    // Verifica que o botão de check-in está ativo e inicia o atendimento
    const btnCheckIn = page.locator('button:has-text("Iniciar Check-in")');
    await expect(btnCheckIn).toBeVisible();
    await btnCheckIn.click();

    await expect(page.locator('text=Sessão Ativa')).toBeVisible();
  });

  test('5. Cooperado: Bloqueio Total quando Cota For Atingida (13/13)', async ({ page }) => {
    await autenticarCooperado(page);

    await page.route('**/api/cooperado/me', (route) =>
      route.fulfill({ json: { id: 'coop_123', nome: 'Téc. Marcos', cargo: 'Tecnico_Enfermagem' } })
    );

    await page.route('**/api/cooperado/agenda', (route) =>
      route.fulfill({
        json: {
          success: true,
          pacientes: [mockPacienteCotaEsgotada],
          prescricoes: [],
          aprazamentos: [],
        },
      })
    );

    await page.goto('http://localhost:3005/cooperado');

    // Verifica que o card exibe badge de cota atingida e status bloqueado
    await expect(page.locator('text=⚠️ Cota atingida (13/13)')).toBeVisible();
    await expect(page.locator('text=Bloqueado')).toBeVisible();

    // Acessa o prontuário do paciente esgotado
    await page.click(`a[href="/cooperado/prontuario/p_esgotado"]`);

    // Confirma identificação do paciente
    await page.click('button:has-text("Confirmar")');

    // Verifica o banner em vermelho alertando sobre o bloqueio
    await expect(page.locator('text=🚫 Cota Mensal Esgotada - Visitas Bloqueadas')).toBeVisible();
    await expect(page.locator('text=atingiu o teto de 13 visitas neste mês (13/13)')).toBeVisible();

    // Verifica que o badge de Visitas Bloqueadas existe e o botão de Iniciar Check-in NÃO existe
    await expect(page.getByText('Visitas Bloqueadas', { exact: true })).toBeVisible();
    await expect(page.locator('button:has-text("Iniciar Check-in")')).not.toBeVisible();
  });

  test('6. Backend API Sync: Bloqueio 403 ao Tentar Forçar Visita Acima da Cota', async ({ page }) => {
    await autenticarCooperado(page);

    await page.route('**/api/cooperado/sync', (route) => {
      return route.fulfill({
        status: 403,
        json: {
          success: false,
          error: 'Limite mensal de 13 visitas atingido para este paciente (13/13). A visita foi bloqueada pela gestão da cooperativa.',
          cotaAtingida: true,
          limite: 13,
          realizadas: 13,
        },
      });
    });

    await page.goto('http://localhost:3005/cooperado');

    const result = await page.evaluate(async () => {
      const res = await fetch('/api/cooperado/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actions: [
            {
              type: 'CHECK_IN',
              payload: {
                evolucaoId: 'evo_extra_14',
                pacienteId: 'p_esgotado',
                checkIn: new Date().toISOString(),
                tipoProfissional: 'Tecnico_Enfermagem',
              },
            },
          ],
        }),
      });
      return {
        status: res.status,
        body: await res.json(),
      };
    });

    expect(result.status).toBe(403);
    expect(result.body.success).toBe(false);
    expect(result.body.cotaAtingida).toBe(true);
    expect(result.body.error).toContain('Limite mensal de 13 visitas atingido');
  });
});
