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

async function exibirLegendaTutorial(page: Page, titulo: string, descricao = '', tempoMs = 2600) {
  await page.evaluate(
    ({ titulo, descricao }) => {
      let overlay = document.getElementById('tutorial-overlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'tutorial-overlay';
        overlay.style.position = 'fixed';
        overlay.style.top = '14px';
        overlay.style.left = '50%';
        overlay.style.transform = 'translateX(-50%)';
        overlay.style.zIndex = '999999';
        overlay.style.backgroundColor = 'rgba(15, 23, 42, 0.95)';
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
        overlay.style.maxWidth = '880px';
        overlay.style.width = 'max-content';
        document.body.appendChild(overlay);
      }
      overlay.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 800; letter-spacing: 1px; color: #818cf8; text-transform: uppercase;">
          <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #4ade80; box-shadow: 0 0 10px #4ade80;"></span>
          TUTORIAL GESTORCOOP — PAINEL DE GESTÃO
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
  warnings: ['Risco de Queda', 'Traqueostomia', 'Alergia a Dipirona'],
  status: 'Ativo',
  limite_visitas_mes: 8,
  visitas_realizadas_mes: 6,
  visitas_restantes_mes: 2,
};

const mockPlanoTerapeutico = {
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

const mockEquipamentos = [
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

const mockEvolucao = {
  id: 'evo_marcos_1',
  paciente_id: 'p_marcos',
  paciente_nome: 'Marcos Vinicius Santos',
  profissional_id: 'coop_tec_carlos',
  profissional_nome: 'Téc. Carlos Enfermagem',
  profissional_registro: 'COREN-SP 452.110',
  tipo_profissional: 'Tecnico_Enfermagem',
  turno: 'Diurno',
  check_in: '2026-10-12T08:00:00Z',
  check_out: '2026-10-12T20:00:00Z',
  audio_url: 'https://exemplo.com/audio-atendimento.mp3',
  transcricao_revisada: 'Paciente lúcido, afebril, em repouso no leito hospitalar. Realizados cuidados com traqueostomia e higiene brônquica com saída de secreção fluida clara. Sinais vitais estáveis: PA 120/80 mmHg, FC 76 bpm, SpO2 98%. Medicamentos do plantão administrados conforme prescrição. Aceitou dieta prescrita sem intercorrências.',
  soap_subjetivo: 'Paciente calmo, colaborativo, nega dor no momento.',
  soap_objetivo: 'PA 120/80 mmHg, FC 76 bpm, FR 16 rpm, SpO2 98%, Temp 36.6 °C. Curativo de traqueostomia limpo e seco.',
  soap_avaliacao: 'Quadro estável sem intercorrências no plantão diurno.',
  soap_plano: 'Manter cuidados de enfermagem, vigilância respiratória e decúbito elevado a 45 graus.',
  status: 'Finalizado',
  data_assinatura: '2026-10-12T20:02:15Z',
  assinatura_digital: 'v1:sig:carlos_enfermagem_sha256_e8f2910a',
};

const mockPrescricao = {
  id: 'pr_1',
  paciente_id: 'p_marcos',
  medico_nome: 'Dr. Roberto Cardozo',
  medico_crm: 'CRM-SP 145.890',
  medicamento: 'Enoxaparina Sódica 40mg/0,4mL',
  dosagem: '40mg SC 1x ao dia',
  via_administracao: 'Subcutânea',
  frequencia_horas: 24,
  horarios_padrao: ['20:00'],
  data_inicio: '2026-10-01',
  data_fim: '2026-10-31',
  instrucoes: 'Alternar sítios de aplicação no abdome.',
  status: 'Ativa',
};

const mockAprazamentos = [
  {
    id: 'ap_1',
    prescricao_id: 'pr_1',
    medicamento: 'Enoxaparina Sódica 40mg/0,4mL',
    dosagem: '40mg SC 1x ao dia',
    via_administracao: 'Subcutânea',
    horario_previsto: '2026-10-12T20:00:00Z',
    horario_executado: '2026-10-12T20:05:00Z',
    status: 'Administrado',
    profissional_nome: 'Téc. Carlos Enfermagem',
    profissional_cargo: 'Tecnico_Enfermagem',
    assinatura_digital: 'v1:chk:enoxaparina_ok_8829',
  },
];

const mockSinaisVitais = [
  {
    id: 'sv_1',
    paciente_id: 'p_marcos',
    data_hora: '2026-10-12T14:30:00Z',
    pa_sistolica: 120,
    pa_diastolica: 80,
    fc_bpm: 76,
    fr_rpm: 16,
    temp_celsius: 36.6,
    spo2_percent: 98,
    glicemia_mg_dl: 98,
    dor_escala: 0,
    nivel_consciencia: 'Alerta',
    profissional_nome: 'Téc. Carlos Enfermagem',
  },
  {
    id: 'sv_2',
    paciente_id: 'p_marcos',
    data_hora: '2026-10-12T09:00:00Z',
    pa_sistolica: 125,
    pa_diastolica: 82,
    fc_bpm: 78,
    fr_rpm: 17,
    temp_celsius: 36.4,
    spo2_percent: 97,
    glicemia_mg_dl: 104,
    dor_escala: 1,
    nivel_consciencia: 'Alerta',
    profissional_nome: 'Téc. Carlos Enfermagem',
  },
];

const mockParecer = {
  id: 'par_1',
  auditor_nome: 'Dra. Vanessa Lima (Auditora Médica)',
  tipo_parecer: 'Conforme',
  descricao: 'Evoluções em conformidade com o plano terapêutico vigente. Sinais vitais estáveis e checagem de medicamentos 100% preenchida.',
  data_registro: '2026-10-13T09:00:00Z',
};

async function registrarRotasGestor(page: Page) {
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
            total_prescricoes_ativas: 1,
            ultima_evolucao_data: '2026-10-12T20:00:00Z',
            ultimo_profissional_nome: 'Téc. Carlos Enfermagem',
            ultimo_sinal_vital: mockSinaisVitais[0],
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
          evolucoes: [mockEvolucao],
          prescricoes: [mockPrescricao],
          aprazamentos: mockAprazamentos,
          sinaisVitais: mockSinaisVitais,
          pareceres: [mockParecer],
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
          planoVigente: mockPlanoTerapeutico,
          planos: [mockPlanoTerapeutico],
          equipamentos: mockEquipamentos,
          pendencias: mockPlanoTerapeutico.pendencias_alertas,
          estatisticas: {
            total_evolucoes: 6,
            prescricoes_ativas: 1,
            equipamentos_instalados: 2,
          },
        },
      },
    })
  );

  await page.route('**/api/gestor/prontuarios/pacientes/p_marcos/planos', (route) => {
    if (route.request().method() === 'POST') {
      const body = JSON.parse(route.request().postData() || '{}');
      return route.fulfill({
        json: {
          success: true,
          data: {
            ...body,
            id: 'pln_novo_vigente',
            total_previsto: 8,
            total_realizado: 0,
            total_restante: 8,
          },
        },
      });
    }
    return route.fulfill({
      json: { success: true, data: [mockPlanoTerapeutico] },
    });
  });
}

async function salvarVideo(page: Page, nomeArquivo: string) {
  const videoObj = page.video();
  await page.close();
  if (videoObj) {
    const videoSourcePath = await videoObj.path();
    const videoDestDir = path.resolve('..', 'docs', 'tutoriais');
    if (!fs.existsSync(videoDestDir)) {
      fs.mkdirSync(videoDestDir, { recursive: true });
    }
    const videoDestPath = path.join(videoDestDir, nomeArquivo);
    fs.copyFileSync(videoSourcePath, videoDestPath);
    console.log(`\n>>> [OK] VÍDEO GRAVADO: ${videoDestPath}\n`);
  }
}

// -------------------------------------------------------------
// PARTE 1 (GESTOR): DASHBOARD 360°, PACIENTES E EQUIPAMENTOS
// -------------------------------------------------------------
test('Tutorial Gestor - Parte 1: Dashboard Geral 360°, Pacientes e Equipamentos', async ({ page }) => {
  test.setTimeout(90_000);
  await autenticarGestor(page);
  await registrarRotasGestor(page);

  await page.goto('http://localhost:3005/gestor/prontuarios');
  await exibirLegendaTutorial(
    page,
    'Parte 1: Lista Geral de Pacientes & Visão 360°',
    'Aqui o gestor monitora pacientes ativos, complexidade clínica, alertas de risco e cotas.',
    2800
  );

  const cardMarcos = page.locator('text=Marcos Vinicius Santos').first();
  await expect(cardMarcos).toBeVisible();
  await cardMarcos.hover();
  await page.waitForTimeout(800);

  await exibirLegendaTutorial(
    page,
    'Acessando o Prontuário 360° Individual',
    'Clique em "Ver Prontuário 360°" para abrir o prontuário completo do paciente.',
    2500
  );
  await page.click('a[href*="/gestor/prontuarios/p_marcos"]');

  await expect(page.locator('h1:has-text("Marcos Vinicius Santos")')).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(800);

  await exibirLegendaTutorial(
    page,
    'Dashboard Individual: Visão Clínica Unificada',
    'Apresenta dados cadastrais, alertas críticos, diagnósticos CID-10 e cotas contratuais.',
    2800
  );

  const alertaPendencias = page.locator('text=Alerta de Atendimentos Pendentes no Plano Terapêutico');
  await alertaPendencias.scrollIntoViewIfNeeded();
  await alertaPendencias.hover();
  await exibirLegendaTutorial(
    page,
    'Alerta Automático de Pendências no Plano ("A Menos")',
    'Sinalização preventiva imediata quando o paciente tem menos atendimentos que o contratado.',
    3000
  );

  const equipamentosSection = page.locator('text=Equipamentos no Domicílio');
  await equipamentosSection.scrollIntoViewIfNeeded();
  await equipamentosSection.hover();
  await exibirLegendaTutorial(
    page,
    'Equipamentos Hospitalares no Domicílio',
    'Rastreabilidade total: Cama Motorizada e Concentrador O2 com números de série ativos.',
    2800
  );

  // Botão Copiar Link Cooperado
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await page.waitForTimeout(600);
  const btnCopiar = page.locator('button:has-text("Copiar Link do Cooperado")').first();
  await btnCopiar.hover();
  await btnCopiar.click();
  await exibirLegendaTutorial(
    page,
    'Link de Atendimento para o Celular do Cooperado',
    'Gera e copia o link criptografado para o cooperado realizar a visita beira-leito.',
    2600
  );

  await salvarVideo(page, 'tutorial-gestor-parte1-dashboard-geral.webm');
});

// -------------------------------------------------------------
// PARTE 2 (GESTOR): PLANO TERAPÊUTICO, METAS E COOPERADOS
// -------------------------------------------------------------
test('Tutorial Gestor - Parte 2: Gestão de Planos Terapêuticos & Múltiplos Cooperados', async ({ page }) => {
  test.setTimeout(90_000);
  await autenticarGestor(page);
  await registrarRotasGestor(page);

  await page.goto('http://localhost:3005/gestor/prontuarios/p_marcos');
  await expect(page.locator('h1:has-text("Marcos Vinicius Santos")')).toBeVisible({ timeout: 15000 });

  await exibirLegendaTutorial(
    page,
    'Parte 2: Gestão de Planos Terapêuticos Multiprofissionais',
    'Vamos abrir a aba de Planos Terapêuticos para gerenciar vigências, cotas e escalas.',
    2800
  );

  await page.click('button:has-text("Plano Terapêutico (")');
  await expect(page.getByRole('heading', { name: /Gestão de Planos Terapêuticos/i })).toBeVisible();
  await page.waitForTimeout(800);

  await exibirLegendaTutorial(
    page,
    'Lançando um Novo Plano Terapêutico',
    'O gestor clica em "+ Novo Plano Terapêutico" para configurar início, fim e cotas por área.',
    2600
  );
  await page.click('button:has-text("Novo Plano Terapêutico")');
  await expect(page.locator('text=Lançar Novo Plano Terapêutico')).toBeVisible();
  await page.waitForTimeout(800);

  await exibirLegendaTutorial(
    page,
    'Designando Múltiplos Cooperados na Mesma Cota',
    'Exemplo: Téc. Carlos e Téc. Roberto compartilham a meta de 5 visitas de Enfermagem.',
    3000
  );
  const btnCarlos = page.locator('button:has-text("Téc. Carlos Enfermagem")').first();
  await btnCarlos.click();
  await page.waitForTimeout(500);

  const btnRoberto = page.locator('button:has-text("Téc. Roberto Soares")').first();
  await btnRoberto.click();
  await page.waitForTimeout(500);

  await exibirLegendaTutorial(
    page,
    'Adicionando Médico e Dentista ao Plano',
    'Dr. Marcos Mendes (1 visita médica) e Dra. Camila Odonto (2 atendimentos odontológicos).',
    2800
  );
  const btnMedico = page.locator('button:has-text("Dr. Marcos Mendes")').first();
  await btnMedico.scrollIntoViewIfNeeded();
  await btnMedico.click();
  await page.waitForTimeout(500);

  const btnDentista = page.locator('button:has-text("Dra. Camila Odonto")').first();
  await btnDentista.scrollIntoViewIfNeeded();
  await btnDentista.click();
  await page.waitForTimeout(500);

  await exibirLegendaTutorial(
    page,
    'Salvando o Plano Terapêutico',
    'O sistema persiste as metas e aciona a regra de bloqueio 403 no excesso de visitas.',
    2600
  );
  const btnSalvar = page.locator('button:has-text("Salvar Plano Terapêutico")');
  await btnSalvar.scrollIntoViewIfNeeded();
  await btnSalvar.click();

  await expect(page.locator('text=Plano Terapêutico salvo com sucesso!')).toBeVisible();
  await page.waitForTimeout(1500);

  await salvarVideo(page, 'tutorial-gestor-parte2-plano-terapeutico.webm');
});

// -------------------------------------------------------------
// PARTE 3 (GESTOR): PRESCRIÇÕES MÉDICAS & SINAIS VITAIS
// -------------------------------------------------------------
test('Tutorial Gestor - Parte 3: Prescrições Médicas, Aprazamentos & Sinais Vitais', async ({ page }) => {
  test.setTimeout(90_000);
  await autenticarGestor(page);
  await registrarRotasGestor(page);

  await page.goto('http://localhost:3005/gestor/prontuarios/p_marcos');
  await expect(page.locator('h1:has-text("Marcos Vinicius Santos")')).toBeVisible({ timeout: 15000 });

  await exibirLegendaTutorial(
    page,
    'Parte 3: Prescrições Médicas & Grade de Aprazamento',
    'Visualize todas as prescrições médicas ativas e a checagem das doses pela enfermagem.',
    2800
  );

  await page.click('button:has-text("Prescrições Médicas (")');
  await expect(page.locator('h3:has-text("Enoxaparina Sódica")').first()).toBeVisible();
  await page.waitForTimeout(800);

  await exibirLegendaTutorial(
    page,
    'Prescrição Ativa & Detalhes Posológicos',
    'Medicamento, dosagem, via subcutânea, frequência de 24h e médico prescritor responsável.',
    2800
  );

  const cardPrescricao = page.locator('h3:has-text("Enoxaparina Sódica")').first();
  await cardPrescricao.hover();
  await page.waitForTimeout(1000);

  await exibirLegendaTutorial(
    page,
    'Aba Sinais Vitais: Curvas e Histórico Clínico',
    'Vamos agora para a aba de Sinais Vitais para inspecionar os registros beira-leito.',
    2600
  );

  await page.click('button:has-text("Sinais Vitais (")');
  await expect(page.locator('text=120/80').first()).toBeVisible();
  await page.waitForTimeout(800);

  await exibirLegendaTutorial(
    page,
    'Parâmetros Aferidos no Leito em Tempo Real',
    'Pressão Arterial, Frequência Cardíaca (76 bpm), SpO2 (98%) e Glicemia com data e profissional.',
    3200
  );

  const tabelaSinais = page.locator('table').first();
  if (await tabelaSinais.isVisible()) {
    await tabelaSinais.hover();
  }
  await page.waitForTimeout(1200);

  await salvarVideo(page, 'tutorial-gestor-parte3-prescricoes-e-sinais.webm');
});

// -------------------------------------------------------------
// PARTE 4 (GESTOR): EVOLUÇÕES SOAP, ÁUDIO CLÍNICO & AUDITORIA
// -------------------------------------------------------------
test('Tutorial Gestor - Parte 4: Evoluções SOAP, Player de Áudio & Auditoria Clínica', async ({ page }) => {
  test.setTimeout(90_000);
  await autenticarGestor(page);
  await registrarRotasGestor(page);

  await page.goto('http://localhost:3005/gestor/prontuarios/p_marcos');
  await expect(page.locator('h1:has-text("Marcos Vinicius Santos")')).toBeVisible({ timeout: 15000 });

  await exibirLegendaTutorial(
    page,
    'Parte 4: Histórico de Evoluções Clínicas & Estrutura SOAP',
    'Acesse a linha do tempo de atendimentos realizados pelos cooperados no domicílio.',
    2800
  );

  await page.click('button:has-text("Evoluções Clínicas & SOAP (")');
  await expect(page.locator('text=Téc. Carlos Enfermagem').first()).toBeVisible();
  await page.waitForTimeout(800);

  await exibirLegendaTutorial(
    page,
    'Evolução Completa com Carimbo de Entrada e Saída',
    'Check-in (08:00), Check-out (20:00), relato transcrito e assinatura digital validada.',
    2800
  );

  const cardEvolucao = page.locator('text=Téc. Carlos Enfermagem').first();
  await cardEvolucao.scrollIntoViewIfNeeded();
  await cardEvolucao.hover();
  await page.waitForTimeout(1000);

  await exibirLegendaTutorial(
    page,
    'Estrutura SOAP (Subjetivo, Objetivo, Avaliação, Plano)',
    'Organização clínica padronizada permitindo leitura rápida e precisa da evolução do paciente.',
    2800
  );

  await exibirLegendaTutorial(
    page,
    'Aba de Auditoria Clínica & Compliance',
    'Vamos para a aba de Auditoria para conferir o parecer técnico e liberação do faturamento.',
    2600
  );

  await page.click('button:has-text("Auditoria & Pareceres (")');
  await expect(page.locator('text=Dra. Vanessa Lima').first()).toBeVisible();
  await page.waitForTimeout(800);

  await exibirLegendaTutorial(
    page,
    'Parecer de Auditoria "Conforme"',
    'Certifica que o atendimento cumpriu todas as normas clínicas e regras de faturamento.',
    3000
  );

  const cardParecer = page.locator('text=Conforme').first();
  await cardParecer.hover();
  await page.waitForTimeout(1500);

  await salvarVideo(page, 'tutorial-gestor-parte4-evolucoes-e-auditoria.webm');
});
