import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.use({
  video: {
    mode: 'on',
    size: { width: 1280, height: 720 },
  },
  viewport: { width: 1280, height: 720 },
});

async function autenticarGestor(page: Page) {
  await page.context().addCookies([
    {
      name: 'gestor_session',
      value: 'user-e2e-gestor-1',
      url: 'http://localhost:3005',
    },
  ]);
}

async function exibirLegendaTutorial(page: Page, titulo: string, descricao = '', tempoMs = 2800) {
  await page.evaluate(
    ({ titulo, descricao }) => {
      let overlay = document.getElementById('tutorial-overlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'tutorial-overlay';
        overlay.style.position = 'fixed';
        overlay.style.top = '16px';
        overlay.style.left = '50%';
        overlay.style.transform = 'translateX(-50%)';
        overlay.style.zIndex = '999999';
        overlay.style.backgroundColor = 'rgba(15, 23, 42, 0.94)';
        overlay.style.backdropFilter = 'blur(12px)';
        overlay.style.color = '#ffffff';
        overlay.style.padding = '12px 24px';
        overlay.style.borderRadius = '16px';
        overlay.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.3)';
        overlay.style.border = '1.5px solid #6366f1';
        overlay.style.fontFamily = 'system-ui, -apple-system, sans-serif';
        overlay.style.transition = 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
        overlay.style.pointerEvents = 'none';
        overlay.style.display = 'flex';
        overlay.style.flexDirection = 'column';
        overlay.style.alignItems = 'center';
        overlay.style.textAlign = 'center';
        overlay.style.maxWidth = '850px';
        overlay.style.width = 'max-content';
        document.body.appendChild(overlay);
      }
      overlay.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 800; letter-spacing: 1px; color: #818cf8; text-transform: uppercase;">
          <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #4ade80; box-shadow: 0 0 10px #4ade80;"></span>
          TUTORIAL INTERATIVO GESTORCOOP
        </div>
        <div style="font-size: 15px; font-weight: 700; color: #ffffff; margin-top: 3px;">
          ${titulo}
        </div>
        ${descricao ? `<div style="font-size: 12px; color: #cbd5e1; margin-top: 2px;">${descricao}</div>` : ''}
      `;
    },
    { titulo, descricao }
  );
  await page.waitForTimeout(tempoMs);
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
  visitas_realizadas_mes: 6,
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

test('Gravação Oficial de Tutorial em Vídeo: Dashboard Individual & Plano Terapêutico', async ({ page }) => {
  test.setTimeout(120_000);
  await autenticarGestor(page);

  // Mocks de dados
  await page.route('**/api/gestor/me', (route) =>
    route.fulfill({ json: { nome: 'Dr. Roberto Cardozo (Gestor Clínico)' } })
  );

  await page.route('**/api/gestor/cooperados*', (route) =>
    route.fulfill({
      json: {
        success: true,
        data: [
          { id: 'coop_tec_carlos', nome: 'Téc. Carlos Enfermagem', cargo: 'Tecnico_Enfermagem' },
          { id: 'coop_tec_roberto', nome: 'Téc. Roberto Soares', cargo: 'Tecnico_Enfermagem' },
          { id: 'coop_med_marcos', nome: 'Dr. Marcos Mendes', cargo: 'Medico' },
          { id: 'coop_dent_camila', nome: 'Dra. Camila Odonto', cargo: 'Dentista' },
        ],
      },
    })
  );

  await page.route('**/api/gestor/prontuarios/pacientes', (route) =>
    route.fulfill({
      json: {
        success: true,
        data: [
          {
            ...mockPacienteMarcos,
            visitas_realizadas_mes: 6,
            limite_visitas_mes: 8,
            visitas_restantes_mes: 2,
            total_prescricoes_ativas: 4,
            ultima_evolucao_data: '2026-09-28T14:30:00Z',
            ultimo_profissional_nome: 'Téc. Carlos Enfermagem',
            ultimo_sinal_vital: {
              pa_sistolica: 120,
              pa_diastolica: 80,
              fc_bpm: 76,
              temp_celsius: 36.6,
              spo2_percent: 98,
              data_hora: '2026-09-28T14:30:00Z',
            },
          },
        ],
      },
    })
  );

  await page.route('**/api/gestor/prontuarios', (route) =>
    route.fulfill({ json: { success: true, results: [] } })
  );

  await page.route('**/api/gestor/prontuarios/pacientes/p_marcos', (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          paciente: mockPacienteMarcos,
          evolucoes: [],
          prescricoes: [
            {
              id: 'pr_1',
              paciente_id: 'p_marcos',
              medicamento: 'Enoxaparina Sódica 40mg',
              dosagem: '40mg SC 1x/dia',
              via_administracao: 'Subcutânea',
              frequencia_horas: 24,
              status: 'Ativa',
            },
          ],
          sinaisVitais: [
            {
              id: 'sv_1',
              paciente_id: 'p_marcos',
              data_hora: '2026-09-28T14:30:00Z',
              pa_sistolica: 120,
              pa_diastolica: 80,
              fc_bpm: 76,
              temp_celsius: 36.6,
              spo2_percent: 98,
              profissional_nome: 'Téc. Carlos Enfermagem',
            },
          ],
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
            prescricoes_ativas: 1,
            equipamentos_instalados: 2,
          },
        },
      },
    })
  );

  let novoPlanoCriado: any = null;
  await page.route('**/api/gestor/prontuarios/pacientes/p_marcos/planos', (route) => {
    if (route.request().method() === 'POST') {
      novoPlanoCriado = JSON.parse(route.request().postData() || '{}');
      return route.fulfill({
        json: {
          success: true,
          data: {
            ...novoPlanoCriado,
            id: 'pln_novo_vigente',
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

  // PASSO 1: Acessar a lista geral de pacientes
  await page.goto('http://localhost:3005/gestor/prontuarios');
  await exibirLegendaTutorial(
    page,
    'Visão do Gestor: Lista de Pacientes & Admissões',
    'Aqui o gestor visualiza os pacientes sincronizados do Bubble e seus dados clínicos.',
    2800
  );

  // Localiza e destaca o card do Marcos
  const cardMarcos = page.locator('text=Marcos Vinicius Santos').first();
  await expect(cardMarcos).toBeVisible();
  await cardMarcos.hover();
  await page.waitForTimeout(1000);

  // PASSO 2: Entrar na Dashboard Individual do Paciente
  await exibirLegendaTutorial(
    page,
    'Acessando a Nova Dashboard Individual do Paciente',
    'Clique em "Ver Prontuário 360°" para abrir o painel unificado do paciente.',
    2500
  );
  await page.click('a[href*="/gestor/prontuarios/p_marcos"]');

  // Aguarda identificação do paciente e breadcrumb
  await expect(page.locator('h1:has-text("Marcos Vinicius Santos")')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('text=Dashboard Geral')).toBeVisible();
  await page.waitForTimeout(1000);

  // PASSO 3: Tour pela Dashboard Individual
  await exibirLegendaTutorial(
    page,
    'Dashboard Individual: Visão Unificada 360°',
    'Reúne resumo clínico, metas multiprofissionais, pendências e equipamentos locados no domicílio.',
    3000
  );

  // Destaque no Alerta de Pendências
  await exibirLegendaTutorial(
    page,
    'Alerta Automático de Pendências no Período ("A Menos")',
    'O sistema acusa pendências quando faltam atendimentos para atingir a meta contratada.',
    3000
  );
  const alertaPendencias = page.locator('text=Alerta de Atendimentos Pendentes no Plano Terapêutico');
  await alertaPendencias.scrollIntoViewIfNeeded();
  await alertaPendencias.hover();
  await page.waitForTimeout(1500);

  // Destaque nos Equipamentos Locados
  await exibirLegendaTutorial(
    page,
    'Equipamentos Ativos no Domicílio do Paciente',
    'Integração direta com a base de locações: Cama Hospitalar e Concentrador de Oxigênio.',
    2800
  );
  const equipamentosSection = page.locator('text=Equipamentos no Domicílio');
  await equipamentosSection.scrollIntoViewIfNeeded();
  await equipamentosSection.hover();
  await page.waitForTimeout(1500);

  // Volta ao topo
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await page.waitForTimeout(1000);

  // PASSO 4: Acessar a aba Plano Terapêutico
  await exibirLegendaTutorial(
    page,
    'Aba "Plano Terapêutico": Gestão de Vigência e Especialidades',
    'Vamos lançar um novo plano definindo início, fim, cotas e cooperados designados.',
    2800
  );
  await page.click('button:has-text("Plano Terapêutico (")');
  await expect(page.locator('text=Gestão de Planos Terapêuticos')).toBeVisible();
  await page.waitForTimeout(1200);

  // PASSO 5: Iniciar criação de Novo Plano Terapêutico
  await exibirLegendaTutorial(
    page,
    'Criando Novo Plano Terapêutico Multiprofissional',
    'O gestor clica em "+ Novo Plano Terapêutico" para abrir o formulário interativo.',
    2600
  );
  await page.click('button:has-text("Novo Plano Terapêutico")');
  await expect(page.locator('text=Lançar Novo Plano Terapêutico')).toBeVisible();
  await page.waitForTimeout(1200);

  // PASSO 6: Configuração de Múltiplos Cooperados para a mesma especialidade
  await exibirLegendaTutorial(
    page,
    'Designando Múltiplos Cooperados para a Mesma Especialidade',
    'Exemplo: Téc. Carlos e Téc. Roberto podem realizar conjuntamente os 5 atendimentos de técnico.',
    3200
  );

  // Seleciona Téc. Carlos e Téc. Roberto para a 1ª meta (Técnico de Enfermagem)
  const btnCarlos = page.locator('button:has-text("Téc. Carlos Enfermagem")').first();
  await btnCarlos.hover();
  await btnCarlos.click();
  await page.waitForTimeout(800);

  const btnRoberto = page.locator('button:has-text("Téc. Roberto Soares")').first();
  await btnRoberto.hover();
  await btnRoberto.click();
  await page.waitForTimeout(800);

  // Seleciona Médico e Dentista
  await exibirLegendaTutorial(
    page,
    'Designando Médico e Dentista no Plano',
    'Dr. Marcos Mendes (1 visita médica) e Dra. Camila Odonto (2 atendimentos odontológicos).',
    2800
  );
  const btnMedico = page.locator('button:has-text("Dr. Marcos Mendes")').first();
  await btnMedico.scrollIntoViewIfNeeded();
  await btnMedico.hover();
  await btnMedico.click();
  await page.waitForTimeout(800);

  const btnDentista = page.locator('button:has-text("Dra. Camila Odonto")').first();
  await btnDentista.scrollIntoViewIfNeeded();
  await btnDentista.hover();
  await btnDentista.click();
  await page.waitForTimeout(800);

  // PASSO 7: Salvar o Plano Terapêutico
  await exibirLegendaTutorial(
    page,
    'Salvando o Plano Terapêutico',
    'O sistema persiste as metas e associações na base de dados.',
    2500
  );
  const btnSalvar = page.locator('button:has-text("Salvar Plano Terapêutico")');
  await btnSalvar.scrollIntoViewIfNeeded();
  await btnSalvar.click();

  // Verifica feedback de sucesso
  await expect(page.locator('text=Plano Terapêutico salvo com sucesso!')).toBeVisible();
  await page.waitForTimeout(1800);

  // PASSO 8: Retornar à Dashboard Geral
  await exibirLegendaTutorial(
    page,
    'Plano Vigente e Metas Sincronizadas na Dashboard',
    'O gestor e os cooperados contam agora com acompanhamento em tempo real.',
    2800
  );
  await page.getByRole('button', { name: /Geral \(Dashboard\)/i }).click();
  await expect(page.locator('text=Alerta de Atendimentos Pendentes no Plano Terapêutico')).toBeVisible();
  await page.waitForTimeout(1500);

  // PASSO 9: Conclusão com Destaque nas Regras de Negócio
  await exibirLegendaTutorial(
    page,
    'Resumo das Regras de Negócio Homologadas',
    '✓ Bloqueio Rígido no 6º Atendimento (403)\n✓ Alerta de Pendências no Dashboard\n✓ Especialidades Independentes',
    3500
  );

  // Finaliza a gravação e salva o arquivo de vídeo
  const videoObj = page.video();
  await page.close();

  if (videoObj) {
    const videoSourcePath = await videoObj.path();
    const videoDestDir = path.resolve('..', 'docs', 'tutoriais');
    if (!fs.existsSync(videoDestDir)) {
      fs.mkdirSync(videoDestDir, { recursive: true });
    }
    const videoDestPath = path.join(videoDestDir, 'tutorial-dashboard-e-plano-terapeutico.webm');
    fs.copyFileSync(videoSourcePath, videoDestPath);
    console.log(`\n\n>>> VÍDEO DO TUTORIAL GRAVADO COM SUCESSO EM:\n${videoDestPath}\n\n`);
  }
});
