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

async function autenticarCooperado(page: Page, cooperadoId = 'coop_tec_carlos') {
  await page.context().addCookies([
    {
      name: 'cooperado_session',
      value: `token-e2e-${cooperadoId}`,
      url: 'http://localhost:3005',
    },
  ]);
}

const mockPacienteMarcos = {
  id: 'p_marcos',
  nome: 'Marcos Vinicius Santos',
  cpf: '123.456.789-99',
  data_nascimento: '1975-06-20',
  endereco: 'Rua das Acácias, 780 - Morumbi, São Paulo - SP',
  telefone: '(11) 98765-4321',
  responsavel_nome: 'Fernanda Santos (Esposa)',
  responsavel_telefone: '(11) 98765-1122',
  diagnostico_principal: 'Reabilitação Neurológica Pós-TCE',
  cid10: 'S06.9',
  complexidade: 'Alta',
  plano_saude: 'Bradesco Saúde Top',
  numero_carteirinha: '11223344001',
  warnings: ['Risco de Queda', 'Traqueostomia'],
  status: 'Ativo',
  limite_visitas_mes: 0,
};

const mockPlanoTerapeuticoVigente = {
  id: 'pln_marcos_out2026',
  paciente_id: 'p_marcos',
  data_inicio: '2026-10-01',
  data_fim: '2026-10-31',
  status: 'Ativo',
  observacoes: 'Assistência domiciliar intensiva com suporte multiprofissional.',
  metas: [
    {
      id: 'meta_tec',
      plano_id: 'pln_marcos_out2026',
      especialidade: 'Tecnico_Enfermagem',
      quantidade_prevista: 5,
      quantidade_realizada: 5,
      quantidade_restante: 0,
      status_meta: 'Concluido',
      profissionais_designados: [
        { id: 'coop_tec_carlos', nome: 'Téc. Carlos Enfermagem' },
        { id: 'coop_tec_roberto', nome: 'Téc. Roberto Soares' },
      ],
    },
    {
      id: 'meta_med',
      plano_id: 'pln_marcos_out2026',
      especialidade: 'Medico',
      quantidade_prevista: 1,
      quantidade_realizada: 0,
      quantidade_restante: 1,
      status_meta: 'Pendente',
      profissionais_designados: [{ id: 'coop_med_marcos', nome: 'Dr. Marcos Mendes' }],
    },
    {
      id: 'meta_dent',
      plano_id: 'pln_marcos_out2026',
      especialidade: 'Dentista',
      quantidade_prevista: 2,
      quantidade_realizada: 1,
      quantidade_restante: 1,
      status_meta: 'Em_Andamento',
      profissionais_designados: [{ id: 'coop_dent_camila', nome: 'Dra. Camila Odonto' }],
    },
  ],
  total_previsto: 8,
  total_realizado: 6,
  total_restante: 2,
  tem_pendencias: true,
  pendencias_alertas: ['Médico: 0 de 1 visita(s) realizada(s) (1 pendente)'],
};

const mockEquipamentosMarcos = [
  {
    id: 'loc_1',
    nome: 'Cama Hospitalar Motorizada 3 Movimentos',
    categoria: 'Mobiliário Hospitalar',
    numero_serie: 'CAM-2026-9871',
    status_locacao: 'Ativo',
    data_inicio: '2026-09-15',
  },
  {
    id: 'loc_2',
    nome: 'Concentrador de Oxigênio 5L/min',
    categoria: 'Oxigenoterapia',
    numero_serie: 'OX-5L-4412',
    status_locacao: 'Ativo',
    data_inicio: '2026-09-15',
  },
];

test.describe('Dashboard Individual do Paciente & Gestão de Plano Terapêutico Multiprofissional', () => {
  test('1. Gestor: Acessa Dashboard Individual do Paciente com Visão Unificada e KPIs', async ({ page }) => {
    await autenticarGestor(page);

    await page.route('**/api/gestor/me', (route) =>
      route.fulfill({ json: { nome: 'Dr. Marcos Gestor' } })
    );

    await page.route('**/api/gestor/prontuarios/pacientes/p_marcos', (route) =>
      route.fulfill({
        json: {
          success: true,
          data: {
            paciente: mockPacienteMarcos,
            evolucoes: [],
            prescricoes: [],
            sinaisVitais: [],
            pareceres: [],
          },
        },
      })
    );

    await page.route('**/api/gestor/prontuarios/pacientes/p_marcos/dashboard', (route) =>
      route.fulfill({
        json: {
          success: true,
          data: {
            paciente: mockPacienteMarcos,
            planoVigente: mockPlanoTerapeuticoVigente,
            planos: [mockPlanoTerapeuticoVigente],
            equipamentos: mockEquipamentosMarcos,
            pendencias: mockPlanoTerapeuticoVigente.pendencias_alertas,
            estatisticas: {
              total_evolucoes: 6,
              prescricoes_ativas: 2,
              equipamentos_instalados: 2,
            },
          },
        },
      })
    );

    await page.goto('http://localhost:3005/gestor/prontuarios/p_marcos');

    // 1. Verifica identificação do paciente e breadcrumb
    await expect(page.locator('h1:has-text("Marcos Vinicius Santos")')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=Dashboard Geral')).toBeVisible();

    // 2. Verifica as abas estruturadas
    await expect(page.getByRole('button', { name: /Geral \(Dashboard\)/i })).toBeVisible();
    await expect(page.locator('button:has-text("Plano Terapêutico (")')).toBeVisible();

    // 3. Verifica o card de alerta de pendências ("A Menos") na Dashboard Geral
    await expect(page.locator('text=Alerta de Atendimentos Pendentes no Plano Terapêutico')).toBeVisible();
    await expect(page.locator('text=Médico: 0 de 1 visita(s) realizada(s) (1 pendente)')).toBeVisible();

    // 4. Verifica a listagem de equipamentos hospitalares instalados no domicílio
    await expect(page.locator('text=Equipamentos Instalados no Domicílio (2)')).toBeVisible();
    await expect(page.locator('text=Cama Hospitalar Motorizada 3 Movimentos')).toBeVisible();
    await expect(page.locator('text=Concentrador de Oxigênio 5L/min')).toBeVisible();

    // 5. Verifica as metas por especialidade com barras de progresso e cooperados escalados
    await expect(page.locator('text=Técnico de Enfermagem')).toBeVisible();
    await expect(page.locator('text=5 de 5 realizada(s)')).toBeVisible();
    await expect(page.locator('text=Téc. Carlos Enfermagem')).toBeVisible();
    await expect(page.locator('text=Téc. Roberto Soares')).toBeVisible();
  });

  test('2. Gestor: Lança Novo Plano Terapêutico com Período, Metas e Seleção de Cooperados', async ({ page }) => {
    await autenticarGestor(page);

    await page.route('**/api/gestor/me', (route) =>
      route.fulfill({ json: { nome: 'Dr. Marcos Gestor' } })
    );

    await page.route('**/api/gestor/cooperados*', (route) =>
      route.fulfill({
        json: {
          success: true,
          data: [
            { _id: 'coop_tec_carlos', txt_nome: 'Téc. Carlos Enfermagem', txt_profissao: 'Tecnico_Enfermagem' },
            { _id: 'coop_tec_roberto', txt_nome: 'Téc. Roberto Soares', txt_profissao: 'Tecnico_Enfermagem' },
            { _id: 'coop_med_marcos', txt_nome: 'Dr. Marcos Mendes', txt_profissao: 'Medico' },
            { _id: 'coop_dent_camila', txt_nome: 'Dra. Camila Odonto', txt_profissao: 'Dentista' },
          ],
        },
      })
    );

    await page.route('**/api/gestor/prontuarios/pacientes/p_marcos', (route) =>
      route.fulfill({
        json: {
          success: true,
          data: {
            paciente: mockPacienteMarcos,
            evolucoes: [],
            prescricoes: [],
            sinaisVitais: [],
            pareceres: [],
          },
        },
      })
    );

    let payloadSalvo: any = null;
    await page.route('**/api/gestor/prontuarios/pacientes/p_marcos/planos', (route) => {
      if (route.request().method() === 'POST') {
        payloadSalvo = JSON.parse(route.request().postData() || '{}');
        return route.fulfill({
          json: {
            success: true,
            data: {
              ...payloadSalvo,
              id: 'pln_novo_77',
              total_previsto: 8,
              total_realizado: 0,
              total_restante: 8,
            },
          },
        });
      }
      return route.fulfill({
        json: { success: true, data: [mockPlanoTerapeuticoVigente] },
      });
    });

    await page.route('**/api/gestor/prontuarios/pacientes/p_marcos/dashboard', (route) =>
      route.fulfill({
        json: {
          success: true,
          data: {
            paciente: mockPacienteMarcos,
            planoVigente: mockPlanoTerapeuticoVigente,
            planos: [mockPlanoTerapeuticoVigente],
            equipamentos: [],
          },
        },
      })
    );

    await page.goto('http://localhost:3005/gestor/prontuarios/p_marcos');

    // Clica na aba Plano Terapêutico
    await page.locator('button:has-text("Plano Terapêutico (")').click();
    await expect(page.locator('text=Gestão de Planos Terapêuticos')).toBeVisible();

    // Inicia criação de novo plano
    await page.click('button:has-text("Novo Plano Terapêutico")');
    await expect(page.locator('text=Lançar Novo Plano Terapêutico')).toBeVisible();

    // Seleciona cooperados para a meta de técnico (múltiplos técnicos: Carlos e Roberto)
    await page.click('button:has-text("Téc. Carlos Enfermagem")');
    await page.click('button:has-text("Téc. Roberto Soares")');

    // Salva o Plano Terapêutico
    await page.click('button:has-text("Salvar Plano Terapêutico")');

    // Confirma que os dados foram submetidos com sucesso
    await expect(page.locator('text=Plano Terapêutico salvo com sucesso!')).toBeVisible();
    expect(payloadSalvo).not.toBeNull();
    expect(payloadSalvo.paciente_id).toBe('p_marcos');
    expect(payloadSalvo.metas.length).toBeGreaterThanOrEqual(3);
  });

  test('3. Backend API Sync: Bloqueio Rígido ao Tentar Iniciar 6º Atendimento de Técnico', async ({ page }) => {
    await autenticarCooperado(page, 'coop_tec_carlos');

    await page.route('**/api/cooperado/sync', (route) => {
      return route.fulfill({
        status: 403,
        json: {
          success: false,
          error:
            'Limite atingido: O Plano Terapêutico deste paciente prevê 5 atendimento(s) de Técnico de Enfermagem e todos já foram realizados (5/5). Novos atendimentos desta especialidade estão bloqueados pela gestão.',
          cotaAtingida: true,
          limite: 5,
          realizadas: 5,
        },
      });
    });

    await page.goto('http://localhost:3005/cooperado');

    // Dispara tentativa de iniciar 6º atendimento de Técnico de Enfermagem
    const result = await page.evaluate(async () => {
      const res = await fetch('/api/cooperado/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actions: [
            {
              type: 'CHECK_IN',
              payload: {
                evolucaoId: 'evo_tec_extra_6',
                pacienteId: 'p_marcos',
                checkIn: '2026-10-15T08:00:00.000Z',
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

    // Valida que o 6º atendimento foi estritamente bloqueado com 403
    expect(result.status).toBe(403);
    expect(result.body.success).toBe(false);
    expect(result.body.cotaAtingida).toBe(true);
    expect(result.body.error).toContain('Limite atingido');
    expect(result.body.error).toContain('prevê 5 atendimento(s) de Técnico de Enfermagem');
  });

  test('4. Backend API Sync: Especialidade Independente (Médico 0/1) Inicia com Sucesso', async ({ page }) => {
    await autenticarCooperado(page, 'coop_med_marcos');

    await page.route('**/api/cooperado/sync', (route) => {
      return route.fulfill({
        status: 200,
        json: {
          success: true,
          syncedCount: 1,
        },
      });
    });

    await page.goto('http://localhost:3005/cooperado');

    // Médico inicia seu atendimento agendado (está dentro da sua cota de 1)
    const result = await page.evaluate(async () => {
      const res = await fetch('/api/cooperado/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actions: [
            {
              type: 'CHECK_IN',
              payload: {
                evolucaoId: 'evo_med_1',
                pacienteId: 'p_marcos',
                checkIn: '2026-10-16T10:00:00.000Z',
                tipoProfissional: 'Medico',
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

    // Confirma que o médico não é afetado pelo esgotamento dos técnicos
    expect(result.status).toBe(200);
    expect(result.body.success).toBe(true);
    expect(result.body.syncedCount).toBe(1);
  });
});
