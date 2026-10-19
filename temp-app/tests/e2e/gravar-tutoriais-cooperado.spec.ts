import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.use({
  video: {
    mode: 'on',
    size: { width: 390, height: 844 },
  },
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});

async function autenticarCooperado(page: Page) {
  await page.context().addCookies([
    {
      name: 'cooperado_session',
      value: 'token-e2e-tec-carlos',
      url: 'http://localhost:3005',
    },
  ]);
  // Inicializa o localStorage simulando sessão já ativa do cooperado
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'cooperado_session',
      JSON.stringify({
        id: 'coop_tec_carlos',
        nome: 'Téc. Carlos Enfermagem',
        cargo: 'Tecnico_Enfermagem',
        profissao: 'Técnico de Enfermagem',
        email: 'carlos.enfermagem@gestorcoop.com.br',
        cpf: '123.456.789-11',
        autenticado: true,
      })
    );
  });
}

async function exibirLegendaTutorialMobile(page: Page, titulo: string, descricao = '', tempoMs = 2600) {
  await page.evaluate(
    ({ titulo, descricao }) => {
      let overlay = document.getElementById('tutorial-overlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'tutorial-overlay';
        overlay.style.position = 'fixed';
        overlay.style.top = '10px';
        overlay.style.left = '50%';
        overlay.style.transform = 'translateX(-50%)';
        overlay.style.zIndex = '999999';
        overlay.style.backgroundColor = 'rgba(15, 23, 42, 0.96)';
        overlay.style.backdropFilter = 'blur(10px)';
        overlay.style.color = '#ffffff';
        overlay.style.padding = '8px 14px';
        overlay.style.borderRadius = '12px';
        overlay.style.boxShadow = '0 12px 20px -4px rgba(0, 0, 0, 0.4)';
        overlay.style.border = '1.5px solid #6366f1';
        overlay.style.fontFamily = 'system-ui, -apple-system, sans-serif';
        overlay.style.transition = 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
        overlay.style.pointerEvents = 'none';
        overlay.style.display = 'flex';
        overlay.style.flexDirection = 'column';
        overlay.style.alignItems = 'center';
        overlay.style.textAlign = 'center';
        overlay.style.maxWidth = '360px';
        overlay.style.width = 'calc(100% - 24px)';
        document.body.appendChild(overlay);
      }
      overlay.innerHTML = `
        <div style="display: flex; align-items: center; gap: 6px; font-size: 9px; font-weight: 800; letter-spacing: 0.8px; color: #818cf8; text-transform: uppercase;">
          <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #4ade80; box-shadow: 0 0 8px #4ade80;"></span>
          APP COOPERADO MOBILE
        </div>
        <div style="font-size: 13px; font-weight: 700; color: #ffffff; margin-top: 2px; line-height: 1.2;">
          ${titulo}
        </div>
        ${descricao ? `<div style="font-size: 10px; color: #cbd5e1; margin-top: 2px; line-height: 1.2;">${descricao}</div>` : ''}
      `;
    },
    { titulo, descricao }
  );
  await page.waitForTimeout(tempoMs);
}

const mockPacienteCooperado = {
  id: 'p_marcos',
  nome: 'Marcos Vinicius Santos',
  cpf: '123.456.789-99',
  data_nascimento: '20/06/1975',
  endereco: 'Rua das Acácias, 780 - Morumbi, São Paulo - SP',
  telefone: '(11) 98765-4321',
  warnings: ['Risco de Queda', 'Traqueostomia', 'Alergia a Dipirona'],
  limite_visitas_mes: 8,
  visitas_realizadas_mes: 6,
  visitas_restantes_mes: 2,
  limite_atingido: false,
};

const mockPrescricoesCooperado = [
  {
    id: 'pr_1',
    paciente_id: 'p_marcos',
    medicamento: 'Enoxaparina Sódica 40mg/0,4mL',
    dosagem: '40mg SC 1x/dia',
    via_administracao: 'Subcutânea',
    frequencia_horas: 24,
    status: 'Ativa',
  },
  {
    id: 'pr_2',
    paciente_id: 'p_marcos',
    medicamento: 'Losartana Potássica 50mg',
    dosagem: '1 comp VO',
    via_administracao: 'Oral',
    frequencia_horas: 12,
    status: 'Ativa',
  },
];

const mockAprazamentosCooperado = [
  {
    id: 'ap_1',
    prescricao_id: 'pr_1',
    paciente_id: 'p_marcos',
    medicamento: 'Enoxaparina Sódica 40mg/0,4mL',
    dosagem: '40mg SC',
    via_administracao: 'Subcutânea',
    horario_previsto: new Date(Date.now() + 1000 * 60 * 30).toISOString(),
    status: 'Pendente',
  },
  {
    id: 'ap_2',
    prescricao_id: 'pr_2',
    paciente_id: 'p_marcos',
    medicamento: 'Losartana Potássica 50mg',
    dosagem: '1 comp VO',
    via_administracao: 'Oral',
    horario_previsto: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
    status: 'Pendente',
  },
];

async function registrarRotasCooperado(page: Page) {
  await page.route('**/api/cooperado/me', (route) =>
    route.fulfill({
      json: {
        id: 'coop_tec_carlos',
        nome: 'Téc. Carlos Enfermagem',
        cargo: 'Tecnico_Enfermagem',
        profissao: 'Técnico de Enfermagem',
      },
    })
  );

  await page.route('**/api/cooperado/agenda*', (route) =>
    route.fulfill({
      json: {
        success: true,
        pacientes: [mockPacienteCooperado],
        prescricoes: mockPrescricoesCooperado,
        aprazamentos: mockAprazamentosCooperado,
      },
    })
  );

  await page.route('**/api/cooperado/sync*', (route) =>
    route.fulfill({ json: { success: true, syncedCount: 1 } })
  );

  await page.route('**/api/cooperado/transcrever', (route) =>
    route.fulfill({
      json: {
        success: true,
        transcricao:
          'Paciente lúcido e calmo no leito hospitalar. Aferidos sinais vitais com estabilidade hemodinâmica (PA 120/80 mmHg, FC 74 bpm, SpO2 98%). Medicações do horário administradas com êxito. Realizada higiene da cânula de traqueostomia com aspiração de pequena quantidade de secreção fluida. Sem queixas no período.',
        transcricaoCrua: 'paciente lucido e calmo no leito...',
        simulado: false,
        sinaisVitais: {
          paSistolica: 120,
          paDiastolica: 80,
          fc: 74,
          spo2: 98,
          temp: 36.5,
          glicemia: 95,
        },
      },
    })
  );
}

async function salvarVideoMobile(page: Page, nomeArquivo: string) {
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
    console.log(`\n>>> [OK] VÍDEO MOBILE GRAVADO: ${videoDestPath}\n`);
  }
}

// -------------------------------------------------------------
// PARTE 1 (COOPERADO): ACESSO MOBILE, IDENTIFICAÇÃO E CHECK-IN
// -------------------------------------------------------------
test('Tutorial Cooperado - Parte 1: Identificação Beira-Leito & Início do Atendimento', async ({ page }) => {
  test.setTimeout(90_000);
  await autenticarCooperado(page);
  await registrarRotasCooperado(page);

  await page.goto('http://localhost:3005/cooperado');
  await exibirLegendaTutorialMobile(
    page,
    'Parte 1: Agenda de Visitas no Celular',
    'O cooperado visualiza sua escala diária com status, cotas e alertas de cada paciente.',
    2800
  );

  const cardMarcos = page.locator('text=Marcos Vinicius Santos').first();
  await expect(cardMarcos).toBeVisible({ timeout: 15000 });
  await cardMarcos.hover();
  await page.waitForTimeout(800);

  await exibirLegendaTutorialMobile(
    page,
    'Abrindo o Prontuário Beira-Leito',
    'Toque sobre o paciente para abrir o prontuário de atendimento domiciliar.',
    2400
  );
  await cardMarcos.click();

  // Modal de identificação de segurança
  await expect(page.locator('text=Identificação de Segurança')).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(600);

  await exibirLegendaTutorialMobile(
    page,
    'Protocolo de Segurança do Paciente',
    'Conferência obrigatória de nome, CPF e data de nascimento antes de qualquer procedimento.',
    3000
  );

  const btnConfirmar = page.locator('button:has-text("Confirmar")').first();
  await btnConfirmar.click();
  await page.waitForTimeout(600);

  await exibirLegendaTutorialMobile(
    page,
    'Iniciando o Check-in da Visita',
    'Toque em "Iniciar Check-in" para disparar o cronômetro oficial de atendimento.',
    2600
  );
  const btnCheckIn = page.locator('button:has-text("Iniciar Check-in")').first();
  await btnCheckIn.click();

  await expect(page.locator('text=Sessão Ativa').first()).toBeVisible();
  await page.waitForTimeout(600);

  await exibirLegendaTutorialMobile(
    page,
    'Seleção do Turno de Enfermagem',
    'Selecione Diurno (12h), Noturno (12h) ou 24h para filtrar a grade de medicamentos.',
    2800
  );
  const btnTurnoDiurno = page.locator('button:has-text("Diurno")').first();
  await btnTurnoDiurno.click();
  await page.waitForTimeout(1500);

  await salvarVideoMobile(page, 'tutorial-cooperado-parte1-identificacao-e-checkin.webm');
});

// -------------------------------------------------------------
// PARTE 2 (COOPERADO): APRAZAMENTO & CHECAGEM DE MEDICAMENTOS
// -------------------------------------------------------------
test('Tutorial Cooperado - Parte 2: Aprazamento & Checagem Beira-Leito de Medicamentos', async ({ page }) => {
  test.setTimeout(90_000);
  await autenticarCooperado(page);
  await registrarRotasCooperado(page);

  await page.goto('http://localhost:3005/cooperado/prontuario/p_marcos');
  
  // Confirma modal se aparecer e faz check-in
  const modalSeg = page.locator('text=Identificação de Segurança');
  if (await modalSeg.isVisible({ timeout: 3000 }).catch(() => false)) {
    await page.click('button:has-text("Confirmar")');
  }
  const btnCheckIn = page.locator('button:has-text("Iniciar Check-in")');
  if (await btnCheckIn.isVisible().catch(() => false)) {
    await btnCheckIn.click();
  }

  await exibirLegendaTutorialMobile(
    page,
    'Parte 2: Aprazamento & Checagem Beira-Leito',
    'Visualize os medicamentos aprazados para o plantão de 12 horas.',
    2800
  );

  const secaoAprazamento = page.locator('text=Aprazamento & Checagem Digital');
  await secaoAprazamento.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);

  await exibirLegendaTutorialMobile(
    page,
    'Checagem com 1 Toque: Administrado',
    'Toque no botão verde "Administrado" após aplicar a medicação no paciente.',
    2800
  );
  const btnAdministrado = page.locator('button:has-text("Administrado")').first();
  await btnAdministrado.click();

  await expect(page.locator('text=Checado').first()).toBeVisible();
  await page.waitForTimeout(1000);

  await exibirLegendaTutorialMobile(
    page,
    'Registro de Omissão ("Não deu")',
    'Caso o paciente recuse ou não tome, toque em "Não deu" para justificar formalmente.',
    2800
  );
  const btnNaoDeu = page.locator('button:has-text("Não deu")').first();
  await btnNaoDeu.click();

  // Modal de justificativa
  await expect(page.locator('text=Justificativa de Omissão').first()).toBeVisible();
  await page.waitForTimeout(600);

  await exibirLegendaTutorialMobile(
    page,
    'Justificativa de Omissão Obrigatória',
    'Selecione o motivo (ex: Recusa) e descreva os detalhes clínicos para auditoria.',
    2800
  );
  await page.selectOption('#justificativaMotivo', 'Paciente recusou');
  await page.fill('#justificativaTexto', 'Paciente relatou náusea e solicitou adiar para mais tarde.');
  await page.waitForTimeout(600);

  const btnGravarJust = page.locator('button:has-text("Gravar Justificativa")').first();
  await btnGravarJust.click();

  await expect(page.locator('text=Omitido').first()).toBeVisible();
  await page.waitForTimeout(1500);

  await salvarVideoMobile(page, 'tutorial-cooperado-parte2-checagem-medicamentos.webm');
});

// -------------------------------------------------------------
// PARTE 3 (COOPERADO): AFERIÇÃO RÁPIDA DE SINAIS VITAIS
// -------------------------------------------------------------
test('Tutorial Cooperado - Parte 3: Aferição Rápida de Sinais Vitais no Leito', async ({ page }) => {
  test.setTimeout(90_000);
  await autenticarCooperado(page);
  await registrarRotasCooperado(page);

  await page.goto('http://localhost:3005/cooperado/prontuario/p_marcos');
  
  const modalSeg = page.locator('text=Identificação de Segurança').first();
  if (await modalSeg.isVisible({ timeout: 3000 }).catch(() => false)) {
    await page.click('button:has-text("Confirmar")');
  }
  const btnCheckIn = page.locator('button:has-text("Iniciar Check-in")').first();
  if (await btnCheckIn.isVisible().catch(() => false)) {
    await btnCheckIn.click();
  }

  await exibirLegendaTutorialMobile(
    page,
    'Parte 3: Sinais Vitais à Beira do Leito',
    'Formulário ágil otimizado para digitação rápida com o smartphone na mão.',
    2800
  );

  const secaoSinais = page.locator('text=Aferição de Sinais Vitais (Leito)').first();
  await secaoSinais.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);

  await exibirLegendaTutorialMobile(
    page,
    'Digitando os Parâmetros Clínicos',
    'Pressão Arterial (120x80), FC (74 bpm), SpO2 (98%) e Temperatura (36.5 °C).',
    2800
  );

  await page.fill('input[placeholder="Ex: 120"]', '120');
  await page.fill('input[placeholder="Ex: 80"]', '80');
  await page.fill('input[placeholder="Ex: 75"]', '74');
  await page.fill('input[placeholder="Ex: 98"]', '98');
  await page.fill('input[placeholder="Ex: 36.5"]', '36.5');
  await page.fill('input[placeholder="Ex: 110"]', '95');
  await page.waitForTimeout(600);

  await exibirLegendaTutorialMobile(
    page,
    'Registrando os Sinais Vitais',
    'Toque em "Registrar Sinais Vitais" para salvar com carimbo imediato no prontuário.',
    2600
  );

  const btnSalvarSinais = page.locator('button:has-text("Registrar Sinais Vitais")').first();
  await btnSalvarSinais.click();

  await expect(page.locator('text=Registrado!').first()).toBeVisible();
  await page.waitForTimeout(1500);

  await salvarVideoMobile(page, 'tutorial-cooperado-parte3-sinais-vitais.webm');
});

// -------------------------------------------------------------
// PARTE 4 (COOPERADO): GRAVAÇÃO DE ÁUDIO COM IA, PIN E CHECK-OUT
// -------------------------------------------------------------
test('Tutorial Cooperado - Parte 4: Evolução por Voz com IA, Assinatura e Check-out', async ({ page }) => {
  test.setTimeout(90_000);
  await autenticarCooperado(page);
  await registrarRotasCooperado(page);

  await page.goto('http://localhost:3005/cooperado/prontuario/p_marcos');
  
  const modalSeg = page.locator('text=Identificação de Segurança').first();
  if (await modalSeg.isVisible({ timeout: 3000 }).catch(() => false)) {
    await page.click('button:has-text("Confirmar")');
  }
  const btnCheckIn = page.locator('button:has-text("Iniciar Check-in")').first();
  if (await btnCheckIn.isVisible().catch(() => false)) {
    await btnCheckIn.click();
  }

  // Checa todos os remédios pendentes do plantão para liberar a validação de assinatura
  const secaoApraz = page.locator('text=Aprazamento & Checagem Digital').first();
  await secaoApraz.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);

  const botoesAdministrado = page.locator('button:has-text("Administrado")');
  let totalBotoes = await botoesAdministrado.count();
  while (totalBotoes > 0) {
    await botoesAdministrado.first().click();
    await page.waitForTimeout(500);
    totalBotoes = await botoesAdministrado.count();
  }

  await exibirLegendaTutorialMobile(
    page,
    'Parte 4: Evolução por Comando de Voz com IA',
    'Grave seu relato por áudio. A inteligência artificial transcreve e estrutura tudo.',
    2800
  );

  const secaoVoz = page.locator('text=Evolução por Comando de Voz').first();
  await secaoVoz.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);

  await exibirLegendaTutorialMobile(
    page,
    'Iniciando a Gravação por Áudio',
    'Toque no microfone. A onda sonora dinâmica monitora a captação da sua voz.',
    2800
  );

  const btnGravar = page.locator('button[title="Gravar áudio"]').first();
  await btnGravar.click();
  await page.waitForTimeout(1500);

  await exibirLegendaTutorialMobile(
    page,
    'Finalizando & Transcrevendo por IA',
    'Toque no botão vermelho de parada. O áudio é salvo e processado pelo modelo clínico.',
    2800
  );

  const btnParar = page.locator('button[title="Finalizar e Salvar"]').first();
  await btnParar.click();

  // Aguarda transcrição ser carregada no textarea
  const textareaRevisao = page.locator('#revisaoEvolucao');
  await expect(textareaRevisao).toHaveValue(/Paciente lúcido e calmo/, { timeout: 15000 });
  await page.waitForTimeout(1000);

  await exibirLegendaTutorialMobile(
    page,
    'Assinatura Eletrônica & Selo de Integridade',
    'Digite sua senha/PIN de 6 dígitos para assinar eletronicamente e finalizar a visita.',
    3000
  );

  const secaoAssinatura = page.locator('text=Validação de Assinatura Eletrônica').first();
  await secaoAssinatura.scrollIntoViewIfNeeded();

  await page.fill('input[placeholder="PIN (6 dígitos)"]', '123456');
  await page.waitForTimeout(600);

  const btnAssinar = page.locator('button:has-text("Assinar e Finalizar")').first();
  await btnAssinar.click();

  await expect(page.locator('text=Prontuário Assinado Digitalmente').first()).toBeVisible();
  await page.waitForTimeout(1200);

  await exibirLegendaTutorialMobile(
    page,
    'Atendimento Concluído com Sucesso!',
    'Prontuário selado, check-out registrado e visita sincronizada com a nuvem.',
    3200
  );

  const btnVoltarAgenda = page.locator('button:has-text("Voltar para a Agenda")').first();
  await expect(btnVoltarAgenda).toBeVisible();
  await page.waitForTimeout(1500);

  await salvarVideoMobile(page, 'tutorial-cooperado-parte4-audio-evolucao-checkout.webm');
});
