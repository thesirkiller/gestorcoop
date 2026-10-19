import { test, expect, Page } from '@playwright/test';
import path from 'path';

const SCREENSHOT_DIR = 'C:/Users/admin/.gemini/antigravity/brain/0087b269-1d36-45ac-afab-ec5506aa50c4/qa-screenshots';

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
  nome: 'Dona Francisca Ribeiro',
  cpf: '123.456.789-00',
  data_nascimento: '1945-03-22',
  endereco: 'Rua das Camélias, 210 - São Paulo, SP',
  telefone: '(11) 98765-4321',
  responsavel_nome: 'Marcos Ribeiro (Filho)',
  responsavel_telefone: '(11) 97654-3210',
  diagnostico_principal: 'Pós-operatório de Artroplastia Total de Quadril / HAS',
  cid10: 'M16.1 / I10',
  complexidade: 'Alta',
  plano_saude: 'Bradesco Saúde Top Nacional',
  numero_carteirinha: '789456123001',
  warnings: ['Alergia a Dipirona', 'Risco Moderado de Queda'],
  status: 'Ativo',
  limite_visitas_mes: 20,
  visitas_realizadas_mes: 8,
  visitas_restantes_mes: 12,
  limite_atingido: false,
};

const mockPrescricoes = [
  {
    id: 'pr_1',
    paciente_id: 'p_1',
    medicamento: 'Enoxaparina Sódica',
    dosagem: '40mg SC 1x ao dia às 08:00',
    via_administracao: 'Subcutânea',
    frequencia_horas: 24,
    horarios_padrao: ['08:00'],
    status: 'Ativa',
    data_inicio: '2026-10-01',
    medico_nome: 'Dr. Roberto Cardozo',
    medico_crm: 'CRM-SP 114520',
  },
  {
    id: 'pr_2',
    paciente_id: 'p_1',
    medicamento: 'Losartana Potássica',
    dosagem: '50mg VO 12/12h (08:00 / 20:00)',
    via_administracao: 'Oral',
    frequencia_horas: 12,
    horarios_padrao: ['08:00', '20:00'],
    status: 'Ativa',
    data_inicio: '2026-10-01',
    medico_nome: 'Dr. Roberto Cardozo',
    medico_crm: 'CRM-SP 114520',
  },
];

const mockAprazamentos = [
  {
    id: 'ap_1',
    prescricao_id: 'pr_1',
    paciente_id: 'p_1',
    medicamento: 'Enoxaparina Sódica',
    dosagem: '40mg SC 1x ao dia às 08:00',
    via_administracao: 'Subcutânea',
    horario_previsto: '2026-10-09T08:00:00.000Z',
    horario_executado: '2026-10-09T08:12:00.000Z',
    status: 'Realizado',
    justificativa: null,
    profissional_id: 'coop_123',
    profissional_nome: 'Téc. Juliana Ramos (COREN-SP 44521)',
    assinatura_digital: 'v1:sig:enoxaparina:juliana',
  },
  {
    id: 'ap_2',
    prescricao_id: 'pr_2',
    paciente_id: 'p_1',
    medicamento: 'Losartana Potássica',
    dosagem: '50mg VO 12/12h',
    via_administracao: 'Oral',
    horario_previsto: '2026-10-09T08:00:00.000Z',
    horario_executado: '2026-10-09T08:15:00.000Z',
    status: 'Realizado',
    justificativa: null,
    profissional_id: 'coop_123',
    profissional_nome: 'Téc. Juliana Ramos (COREN-SP 44521)',
    assinatura_digital: 'v1:sig:losartana:juliana',
  },
  {
    id: 'ap_3',
    prescricao_id: 'pr_2',
    paciente_id: 'p_1',
    medicamento: 'Losartana Potássica',
    dosagem: '50mg VO 12/12h',
    via_administracao: 'Oral',
    horario_previsto: '2026-10-09T20:00:00.000Z',
    horario_executado: null,
    status: 'Pendente',
    justificativa: null,
    profissional_id: null,
    profissional_nome: null,
    assinatura_digital: null,
  }
];

const mockSinaisVitais = [
  {
    id: 'sv_1',
    paciente_id: 'p_1',
    data_hora: '2026-10-09T08:10:00.000Z',
    pa_sistolica: '125',
    pa_diastolica: '82',
    fc_bpm: '74',
    fr_rpm: '16',
    temp_celsius: '36.5',
    spo2_percent: '98',
    glicemia_mg_dl: '104',
    dor_escala: '0',
    nivel_consciencia: 'Alerta / Vigil',
    profissional_nome: 'Téc. Juliana Ramos (COREN-SP 44521)',
    observacoes: 'Aferição matinal em repouso. Paciente lúcida e sem queixas álgicas.',
  },
];

const mockEvolucoes = [
  {
    id: 'evo_1',
    paciente_id: 'p_1',
    paciente_nome: 'Dona Francisca Ribeiro',
    paciente_cpf: '123.456.789-00',
    profissional_nome: 'Téc. Juliana Ramos',
    tipo_profissional: 'Técnico de Enfermagem',
    check_in: '2026-10-09T07:55:00.000Z',
    check_out: '2026-10-09T08:35:00.000Z',
    turno: 'Diurno',
    soap_subjetivo: 'Paciente refere ter dormido bem, sem dores na articulação operada.',
    soap_objetivo: 'Sinais vitais estáveis. Curativo de ferida operatória limpo e seco.',
    soap_avaliacao: 'Recuperação pós-cirúrgica dentro do previsto.',
    soap_plano: 'Administradas medicações orais e SC conforme prescrição médica. Estimulado repouso.',
    status: 'Finalizado',
    data_assinatura: '2026-10-09T08:35:00.000Z',
    assinatura_digital: 'v1:sig:juliana:20261009',
  },
];

test.describe('Validação Visual de QA - Gestor (Prontuário 360, Auditoria & Modais Limpos)', () => {
  test('Cenário 1: Painel do Gestor - Detalhe 360, Auditoria de Medicamentos e Modais Limpos', async ({ page }) => {
    await autenticarGestor(page);
    await page.setViewportSize({ width: 1366, height: 950 });

    await page.route('**/api/gestor/me', (route) =>
      route.fulfill({ json: { nome: 'Dr. Marcos Gestor', email: 'gestor@gestorcoop.app' } })
    );

    await page.route('**/api/gestor/prontuarios/pacientes', (route) =>
      route.fulfill({
        json: {
          success: true,
          data: [mockPaciente],
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
            aprazamentos: mockAprazamentos,
            sinaisVitais: mockSinaisVitais,
            pareceres: [],
          },
        },
      })
    );

    await page.route('**/api/gestor/prontuarios/pacientes/*/dashboard', (route) =>
      route.fulfill({
        json: {
          success: true,
          data: {
            paciente: mockPaciente,
            planoVigente: null,
            planos: [],
            equipamentos: [],
            estatisticas: { totalEvolucoes: 1, prescricoesAtivas: 2, sinaisRegistrados: 1 },
          },
        },
      })
    );

    await page.route('**/api/gestor/prontuarios/pacientes/*/equipamentos', (route) =>
      route.fulfill({
        json: {
          success: true,
          data: [],
        },
      })
    );

    await page.route('**/api/gestor/prontuarios/pacientes/p_1/aprazamentos', (route) =>
      route.fulfill({
        json: {
          success: true,
          data: mockAprazamentos,
        },
      })
    );

    await page.goto('http://localhost:3005/gestor/prontuarios/p_1');
    await expect(page.getByText('Francisca Ribeiro').first()).toBeVisible({ timeout: 20000 });

    // Alterna para a aba Prescrições
    await page.getByRole('button', { name: /Prescrições/i }).click();
    await expect(page.getByText('Registro & Auditoria de Administração de Medicamentos')).toBeVisible({ timeout: 10000 });

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '01_gestor_prontuario_auditoria.png'),
      fullPage: false,
    });

    // Abrir Modal de Nova Prescrição para conferir ausência de mock e presença de médico/CRM
    await page.getByRole('button', { name: /Nova Prescrição/i }).click();
    await expect(page.getByRole('heading', { name: 'Nova Prescrição Médica' })).toBeVisible({ timeout: 10000 });

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '02_gestor_modal_nova_prescricao.png'),
    });

    // Fechar modal de prescrição via botão Cancelar
    await page.click('button:has-text("Cancelar")');
    await page.waitForTimeout(300);

    // Mudar para a aba Sinais Vitais
    await page.getByRole('button', { name: /Sinais Vitais/i }).click();
    await expect(page.getByRole('button', { name: /Aferir Sinais/i })).toBeVisible({ timeout: 10000 });

    // Abrir modal de Novo Registro de Sinais Vitais
    await page.getByRole('button', { name: /Aferir Sinais/i }).click();
    await expect(page.getByRole('heading', { name: 'Registrar Sinais Vitais' })).toBeVisible({ timeout: 10000 });

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '03_gestor_modal_novo_sinal.png'),
    });
  });
});
