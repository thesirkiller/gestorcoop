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

const mockPaciente = {
  id: 'p_1',
  nome: 'Seu João da Silva',
  cpf: '123.456.789-00',
  data_nascimento: '1948-05-14',
  endereco: 'Rua das Palmeiras, 450 - Jd. América, São Paulo - SP',
  telefone: '(11) 98765-4321',
  responsavel_nome: 'Clara da Silva (Filha)',
  responsavel_telefone: '(11) 97766-5544',
  diagnostico_principal: 'Sequela de AVC Isquêmico / Hipertensão Arterial Sistêmica',
  cid10: 'I69.3 / I10',
  complexidade: 'Alta',
  plano_saude: 'Bradesco Saúde Top Nacional',
  numero_carteirinha: '789456123001',
  warnings: ['Alergia a Dipirona e Penicilina', 'Risco Alto de Queda (Morse 65)', 'Dieta Enteral por SNE'],
  status: 'Ativo',
  created_at: new Date().toISOString(),
};

const mockPrescricoes = [
  {
    id: 'pr_1',
    paciente_id: 'p_1',
    medicamento: 'Losartana Potássica',
    dosagem: '50mg via oral 12/12h',
    via_administracao: 'Oral',
    frequencia_horas: 12,
    horarios_padrao: ['08:00', '20:00'],
    status: 'Ativa',
    medico_nome: 'Dr. Roberto Cardozo',
    medico_crm: 'CRM-SP 114520',
  },
];

const mockSinaisVitais = [
  {
    id: 'sv_1',
    paciente_id: 'p_1',
    pa_sistolica: '120',
    pa_diastolica: '80',
    fc_bpm: '76',
    fr_rpm: '16',
    temp_celsius: '36.4',
    spo2_percent: '98',
    glicemia_mg_dl: '105',
    dor_escala: '0',
    nivel_consciencia: 'Alerta',
    responsavel_nome: 'Enf. Juliana Ramos (COREN 44521)',
    data_hora: new Date().toISOString(),
  },
];

const mockEvolucoes = [
  {
    id: 'evo_1',
    paciente_id: 'p_1',
    paciente_nome: 'Seu João da Silva',
    paciente_cpf: '123.456.789-00',
    profissional_nome: 'Dr. Roberto Cardozo',
    tipo_profissional: 'Médico',
    check_in: new Date(Date.now() - 3600000).toISOString(),
    check_out: new Date().toISOString(),
    turno: 'Manhã',
    soap_subjetivo: 'Paciente calmo e colaborativo.',
    soap_objetivo: 'Sinais vitais estáveis.',
    soap_avaliacao: 'Evolução favorável.',
    soap_plano: 'Manter conduta.',
    status: 'Finalizado',
    data_assinatura: new Date().toISOString(),
    assinatura_digital: 'v1:sig:medico',
  },
];

test.describe('Gestor - Módulo de Prontuários & Gestão 360 do Paciente', () => {
  test.beforeEach(async ({ page }) => {
    await autenticarGestor(page);

    await page.route('**/api/gestor/me', (route) =>
      route.fulfill({ json: { nome: 'Dr. Marcos Gestor', email: 'gestor@gestorcoop.app' } })
    );

    await page.route('**/api/gestor/prontuarios/pacientes', (route) =>
      route.fulfill({
        json: {
          success: true,
          data: [
            mockPaciente,
            {
              id: 'p_2',
              nome: 'Dona Maria de Oliveira',
              cpf: '987.654.321-11',
              diagnostico_principal: 'Pós-operatório de Artroplastia Total de Quadril',
              complexidade: 'Média',
              status: 'Ativo',
              warnings: [],
            },
          ],
        },
      })
    );

    await page.route('**/api/gestor/prontuarios/pacientes/p_1', (route) =>
      route.fulfill({
        json: {
          success: true,
          data: {
            paciente: mockPaciente,
            evolucoes: mockEvolucoes,
            prescricoes: mockPrescricoes,
            sinaisVitais: mockSinaisVitais,
            pareceres: [],
          },
        },
      })
    );

    await page.route('**/api/gestor/prontuarios', (route) =>
      route.fulfill({
        json: {
          success: true,
          results: mockEvolucoes,
          data: mockEvolucoes,
        },
      })
    );

    await page.route('**/api/gestor/prontuarios/pacientes/p_1/prescricoes', async (route) => {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON();
        mockPrescricoes.push({
          id: 'pr_new',
          paciente_id: 'p_1',
          medicamento: body.medicamento,
          dosagem: body.dosagem,
          via_administracao: body.via_administracao || 'Oral',
          frequencia_horas: body.frequencia_horas || 12,
          horarios_padrao: body.horarios_padrao || ['08:00', '20:00'],
          status: 'Ativa',
          medico_nome: 'Dr. Roberto Cardozo',
          medico_crm: 'CRM-SP 114520',
        });
        await route.fulfill({ json: { success: true, message: 'Prescrição cadastrada.' } });
      } else {
        await route.fulfill({ json: { success: true, data: mockPrescricoes } });
      }
    });

    await page.route('**/api/gestor/prontuarios/pacientes/p_1/sinais-vitais', async (route) => {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON();
        mockSinaisVitais.unshift({
          id: 'sv_new',
          paciente_id: 'p_1',
          pa_sistolica: body.pa_sistolica,
          pa_diastolica: body.pa_diastolica,
          fc_bpm: body.fc_bpm || '75',
          fr_rpm: body.fr_rpm || '18',
          temp_celsius: body.temp_celsius || '36.5',
          spo2_percent: body.spo2_percent || '98',
          glicemia_mg_dl: body.glicemia_mg_dl || '',
          dor_escala: '0',
          nivel_consciencia: 'Alerta',
          responsavel_nome: 'Enf. Auditor',
          data_hora: new Date().toISOString(),
        });
        await route.fulfill({ json: { success: true, message: 'Sinal vital registrado.' } });
      } else {
        await route.fulfill({ json: { success: true, data: mockSinaisVitais } });
      }
    });
  });

  test('Lista pacientes, filtra por complexidade e abre o prontuário 360', async ({ page }) => {
    await page.goto('/gestor/prontuarios');

    await expect(page.getByText('Gestão de Prontuários & Pacientes')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Pacientes em Atendimento')).toBeVisible();

    await expect(page.getByText('Seu João da Silva')).toBeVisible();
    await expect(page.getByText('Dona Maria de Oliveira')).toBeVisible();

    // Clica no botão Ver Prontuário do primeiro paciente
    const link360 = page.locator('a[href*="/gestor/prontuarios/p_1"]').first();
    await link360.click();

    // Deve estar na tela 360 do paciente
    await expect(page.getByText('Seu João da Silva')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Diagnóstico Clínico Principal')).toBeVisible();
    await expect(page.getByText('Alergia a Dipirona e Penicilina')).toBeVisible();

    // Abas visíveis
    await expect(page.getByRole('button', { name: /Evoluções Clínicas & SOAP/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Prescrições Médicas/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Sinais Vitais/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Auditoria & Pareceres/i })).toBeVisible();
  });

  test('Adiciona nova prescrição médica no prontuário 360', async ({ page }) => {
    await page.goto('/gestor/prontuarios/p_1');
    await expect(page.getByText('Seu João da Silva')).toBeVisible({ timeout: 15000 });

    // Alterna para a aba de Prescrições
    await page.getByRole('button', { name: /Prescrições Médicas/i }).click();

    // Clica no botão de nova prescrição
    await page.getByRole('button', { name: /Nova Prescrição/i }).click();

    const modalTitle = page.getByRole('heading', { name: 'Nova Prescrição Médica' });
    await expect(modalTitle).toBeVisible({ timeout: 10000 });

    // Preenche o formulário
    await page.locator('input[placeholder*="Losartana"]').fill('Ceftriaxona 1g');
    await page.locator('input[placeholder*="1 comprimido"]').fill('1 frasco-ampola IV');

    // Salva
    await page.getByRole('button', { name: 'Salvar Prescrição' }).click();

    // Modal deve fechar e a nova prescrição aparecer na lista
    await expect(modalTitle).not.toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: 'Ceftriaxona 1g' })).toBeVisible({ timeout: 15000 });
  });

  test('Registra aferição de sinais vitais no prontuário 360', async ({ page }) => {
    await page.goto('/gestor/prontuarios/p_1');
    await expect(page.getByText('Seu João da Silva')).toBeVisible({ timeout: 15000 });

    // Alterna para aba de Sinais Vitais
    await page.getByRole('button', { name: /Sinais Vitais/i }).click();

    // Clica no botão de nova aferição
    await page.getByRole('button', { name: /Nova Aferição/i }).click();

    const modalTitle = page.getByRole('heading', { name: 'Registrar Sinais Vitais' });
    await expect(modalTitle).toBeVisible({ timeout: 10000 });

    // Preenche PA e SpO2
    await page.locator('input[placeholder="120"]').fill('130');
    await page.locator('input[placeholder="80"]').fill('85');
    await page.locator('input[placeholder="98"]').fill('99');

    // Salva
    await page.getByRole('button', { name: 'Salvar Sinais' }).click();

    // Modal deve fechar e novo registro aparecer na tabela
    await expect(modalTitle).not.toBeVisible({ timeout: 10000 });
    await expect(page.getByText('130/85')).toBeVisible({ timeout: 15000 });
  });

  test('Navega para o painel de auditoria e reconciliação de medicamentos', async ({ page }) => {
    await page.goto('/gestor/prontuarios/auditoria');

    await expect(page.getByText('Reconciliação e Auditoria de Aprazamento')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Índice de Pontualidade')).toBeVisible();
    await expect(page.getByText('Total Aprazamentos')).toBeVisible();
  });
});
