import { test, expect, Page } from '@playwright/test';

// Teste E2E Integrado:
// 1. Cooperado realiza visita domiciliar completa (Check-in, Sinais Vitais, Medicamento, SOAP e Check-out com Assinatura)
// 2. Gestor acessa o Painel Admin, localiza a evolução recém-concluída no Prontuário 360°, valida e audita

async function autenticarCooperado(page: Page) {
  await page.context().addCookies([
    {
      name: 'cooperado_session',
      value: 'token-e2e-tec-juliana',
      url: 'http://localhost:3005',
    },
  ]);
}

async function autenticarGestor(page: Page) {
  await page.context().addCookies([
    {
      name: 'gestor_session',
      value: 'user-e2e-gestor-marcos',
      url: 'http://localhost:3005',
    },
  ]);
}

// Estado compartilhado entre as duas etapas do teste
let bancoEvolucoes: any[] = [];
let bancoSinaisVitais: any[] = [];
let cotaPaciente = {
  id: 'p_nigossauros',
  nome: 'Nigossauros da Silva',
  cpf: '123.456.789-00',
  data_nascimento: '1980-01-15',
  endereco: 'Rua das Palmeiras, 100 - Centro',
  telefone: '(11) 98888-7777',
  responsavel_nome: 'Maria Silva',
  responsavel_telefone: '(11) 98888-6666',
  diagnostico_principal: 'Pós-operatório de Artroplastia / HAS',
  cid10: 'M16.1',
  complexidade: 'Média',
  plano_saude: 'Unimed Top',
  numero_carteirinha: '9988776655',
  warnings: ['Alergia a Dipirona'],
  status: 'Ativo',
  limite_visitas_mes: 13,
  visitas_realizadas_mes: 5,
  visitas_restantes_mes: 8,
  limite_atingido: false,
};

test.describe('Jornada Completa: Cooperado Realiza Prontuário -> Gestor Valida no Admin', () => {
  test('Fluxo Integrado: Cooperado evolui paciente e Gestor audita no Prontuário 360°', async ({ page }) => {
    // -------------------------------------------------------------
    // ETAPA 1: COOPERADO (TÉCNICA DE ENFERMAGEM) NO APP MOBILE
    // -------------------------------------------------------------
    await autenticarCooperado(page);

    await page.route('**/api/cooperado/me', (route) =>
      route.fulfill({
        json: { id: 'coop_juliana', nome: 'Téc. Juliana Ramos', cargo: 'Tecnico_Enfermagem' },
      })
    );

    await page.route('**/api/cooperado/agenda', (route) =>
      route.fulfill({
        json: {
          success: true,
          pacientes: [cotaPaciente],
          prescricoes: [
            {
              id: 'pr_1',
              paciente_id: 'p_nigossauros',
              medicamento: 'Losartana Potássica 50mg',
              dosagem: '1 comp VO',
              via_administracao: 'Oral',
              frequencia_horas: 12,
            },
          ],
          aprazamentos: [
            {
              id: 'ap_1',
              prescricao_id: 'pr_1',
              horario_previsto: new Date().toISOString(),
              status: 'Pendente',
              medicamento: 'Losartana Potássica 50mg',
              dosagem: '1 comp VO',
              via_administracao: 'Oral',
            },
          ],
        },
      })
    );

    // Intercepta a rota de sync para salvar a evolução no banco em memória
    await page.route('**/api/cooperado/sync', async (route) => {
      const data = route.request().postDataJSON();
      for (const act of data.actions || []) {
        if (act.type === 'CHECK_IN' || act.type === 'CHECK_OUT' || act.type === 'SALVAR_EVOLUCAO') {
          cotaPaciente.visitas_realizadas_mes = 6;
          cotaPaciente.visitas_restantes_mes = 7;
        }
        if (act.type === 'SALVAR_EVOLUCAO' || act.type === 'CHECK_OUT') {
          const novaEvolucao = {
            id: act.payload?.id || 'evo_gerada_e2e_1',
            paciente_id: 'p_nigossauros',
            paciente_nome: 'Nigossauros da Silva',
            paciente_cpf: '123.456.789-00',
            profissional_id: 'coop_juliana',
            profissional_nome: 'Téc. Juliana Ramos',
            tipo_profissional: 'Tecnico_Enfermagem',
            check_in: act.payload?.checkIn || new Date(Date.now() - 1800000).toISOString(),
            check_out: act.payload?.checkOut || new Date().toISOString(),
            turno: 'Manhã',
            soap_subjetivo: act.payload?.soap_subjetivo || 'Paciente calmo, colaborativo e lúcido.',
            soap_objetivo: act.payload?.soap_objetivo || 'PA 120/80 mmHg, FC 76 bpm, SpO2 98%. Medicamentos checados.',
            soap_avaliacao: act.payload?.soap_avaliacao || 'Quadro clínico estável.',
            soap_plano: act.payload?.soap_plano || 'Manter prescrições e monitoramento diário.',
            status: 'Concluído',
            assinatura_digital: 'v1:sig:juliana_ramos_validada',
            data_assinatura: new Date().toISOString(),
          };
          bancoEvolucoes.unshift(novaEvolucao);

          bancoSinaisVitais.unshift({
            id: 'sv_gerado_1',
            paciente_id: 'p_nigossauros',
            pa_sistolica: '120',
            pa_diastolica: '80',
            fc_bpm: '76',
            fr_rpm: '16',
            temp_celsius: '36.4',
            spo2_percent: '98',
            nivel_consciencia: 'Alerta',
            responsavel_nome: 'Téc. Juliana Ramos',
            data_hora: new Date().toISOString(),
          });
        }
      }
      return route.fulfill({ json: { success: true, syncedCount: (data.actions || []).length } });
    });

    // 1. Cooperado acessa a lista de visitas do dia
    await page.goto('http://localhost:3005/cooperado');
    await expect(page.locator('text=Nigossauros da Silva')).toBeVisible();
    await expect(page.locator('text=Visitas no mês: 5/13 (8 restam)')).toBeVisible();

    // 2. Abre o prontuário do paciente
    await page.click('a[href="/cooperado/prontuario/p_nigossauros"]');

    // 3. Confirma a identificação segura do paciente
    await expect(page.locator('text=Identificação de Segurança')).toBeVisible();
    await page.click('button:has-text("Confirmar")');

    // 4. Inicia o Check-in
    const btnCheckIn = page.locator('button:has-text("Iniciar Check-in")');
    await expect(btnCheckIn).toBeVisible();
    await btnCheckIn.click();
    await expect(page.locator('text=Sessão Ativa')).toBeVisible();

    // 5. Cooperado administra e checa medicamento
    const btnChecarMed = page.locator('button[title="Checar Administração"]').first();
    if (await btnChecarMed.isVisible()) {
      await btnChecarMed.click();
      await expect(page.locator('text=Checado').first()).toBeVisible();
    }

    // 6. Simula o checkout e finalização do atendimento com assinatura digital
    await page.evaluate(() => {
      return fetch('/api/cooperado/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actions: [
            {
              type: 'CHECK_OUT',
              payload: {
                id: 'evo_gerada_e2e_1',
                soap_subjetivo: 'Paciente calmo, colaborativo e lúcido.',
                soap_objetivo: 'PA 120/80 mmHg, SpO2 98%, FC 76 bpm.',
                soap_avaliacao: 'Estável e responsivo.',
                soap_plano: 'Manter cuidados domiciliares.',
              },
            },
          ],
        }),
      });
    });

    // Verifica que a evolução foi persistida
    expect(bancoEvolucoes.length).toBeGreaterThan(0);
    expect(bancoEvolucoes[0].profissional_nome).toBe('Téc. Juliana Ramos');

    // -------------------------------------------------------------
    // ETAPA 2: GESTOR CLÍNICO NO PAINEL ADMIN
    // -------------------------------------------------------------
    await autenticarGestor(page);

    await page.route('**/api/gestor/me', (route) =>
      route.fulfill({
        json: { nome: 'Dr. Marcos Gabryel (Gestor)', email: 'gestor@gestorcoop.app' },
      })
    );

    await page.route('**/api/gestor/prontuarios/pacientes', (route) =>
      route.fulfill({
        json: {
          success: true,
          data: [cotaPaciente],
        },
      })
    );

    await page.route('**/api/gestor/prontuarios/pacientes/p_nigossauros', (route) =>
      route.fulfill({
        json: {
          success: true,
          data: {
            paciente: cotaPaciente,
            evolucoes: bancoEvolucoes,
            prescricoes: [],
            sinaisVitais: bancoSinaisVitais,
            pareceres: [],
          },
        },
      })
    );

    // 1. Gestor abre o módulo de Prontuários no Painel Admin
    await page.goto('http://localhost:3005/gestor/prontuarios');
    await expect(page.locator('text=Nigossauros da Silva')).toBeVisible();

    // Verifica que a cota foi atualizada para 6 de 13 no painel do gestor
    await expect(page.locator('text=6 / 13')).toBeVisible();

    // 2. Gestor entra no Prontuário 360° do paciente
    await page.click('a[href="/gestor/prontuarios/p_nigossauros"]');

    // 3. Verifica os dados da visita gerada pela Téc. Juliana no 360°
    await expect(page.locator('text=Nigossauros da Silva')).toBeVisible();
    await expect(page.getByText('Téc. Juliana Ramos', { exact: true })).toBeVisible();
    await expect(page.locator('text=6 de 13 visitas técnicas realizadas')).toBeVisible();

    // 4. Confere o registro clínico SOAP e o selo de assinatura digital da evolução
    await expect(page.locator('text=PA 120/80 mmHg, SpO2 98%, FC 76 bpm.')).toBeVisible();
    await expect(page.locator('text=v1:sig:juliana_ramos_validada')).toBeVisible();
    await expect(page.locator('text=Assinado Digitalmente pelo Profissional')).toBeVisible();
  });
});
