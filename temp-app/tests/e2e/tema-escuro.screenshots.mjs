/**
 * Captura das telas do prontuário nos dois temas.
 *
 * Não é um spec: é um script de inspeção visual, rodado à mão com
 * `node tests/e2e/tema-escuro.screenshots.mjs` com o dev server de pé. Fica
 * fora de `*.spec.ts` de propósito para não entrar na suíte do Playwright.
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const BASE = 'http://localhost:3000';
// `test-results/` já é ignorado pelo git (saída padrão do Playwright).
const OUT = process.env.OUT_DIR || './test-results/tema';
fs.mkdirSync(OUT, { recursive: true });

const AGENDA = {
  success: true,
  pacientes: [
    {
      id: 'p_1',
      nome: 'Seu João da Silva',
      cpf: '123.456.789-00',
      data_nascimento: '12/04/1958',
      endereco: 'Rua das Palmeiras, 102 - Centro',
      warnings: ['Alergia a Dipirona e Penicilina', 'Hipertensão Grave'],
    },
    {
      id: 'p_2',
      nome: 'Dona Maria de Oliveira',
      cpf: '987.654.321-11',
      data_nascimento: '25/08/1945',
      endereco: 'Av. Paulista, 1500 - Bela Vista',
      warnings: ['Risco de Queda'],
    },
  ],
  prescricoes: [
    {
      id: 'pr_1',
      paciente_id: 'p_1',
      medicamento: 'Losartana Potássica 50mg',
      dosagem: '1 comprimido',
      via_administracao: 'Oral',
      frequencia_horas: 12,
      data_inicio: '2026-08-01',
      data_fim: '2026-09-01',
    },
    {
      id: 'pr_2',
      paciente_id: 'p_1',
      medicamento: 'Dipirona 500mg',
      dosagem: '20 gotas',
      via_administracao: 'Oral',
      frequencia_horas: 6,
      data_inicio: '2026-08-01',
      data_fim: '2026-09-01',
    },
  ],
  aprazamentos: [
    {
      id: 'ap_1',
      prescricao_id: 'pr_1',
      horario_previsto: new Date().toISOString().split('T')[0] + 'T08:00:00.000Z',
      status: 'Pendente',
      medicamento: 'Losartana Potássica 50mg',
      dosagem: '1 comprimido',
      via_administracao: 'Oral',
    },
    {
      id: 'ap_2',
      prescricao_id: 'pr_2',
      horario_previsto: new Date().toISOString().split('T')[0] + 'T14:00:00.000Z',
      status: 'Pendente',
      medicamento: 'Dipirona 500mg',
      dosagem: '20 gotas',
      via_administracao: 'Oral',
    },
  ],
};

async function preparar(context) {
  await context.addCookies([
    { name: 'cooperado_session', value: 'user-e2e-coop', url: BASE },
    { name: 'gestor_session', value: 'user-e2e-gestor', url: BASE },
  ]);
  await context.route('**/api/cooperado/me', (r) =>
    r.fulfill({ json: { success: true, cooperadoId: 'coop-e2e-1', nome: 'Ana Silva' } })
  );
  await context.route('**/api/cooperado/agenda', (r) => r.fulfill({ json: AGENDA }));
}

async function capturar(browser, tema) {
  const context = await browser.newContext({ viewport: { width: 430, height: 1000 }, deviceScaleFactor: 2 });
  await preparar(context);
  await context.addInitScript((t) => {
    try {
      window.localStorage.setItem('gc_tema', t);
    } catch {}
  }, tema);

  const page = await context.newPage();

  await page.goto(`${BASE}/cooperado`);
  await page.getByRole('button', { name: 'Carregar Agenda' }).click();
  await page.getByText('Seu João da Silva').waitFor({ timeout: 20_000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/agenda-${tema}.png`, fullPage: true });

  await page.getByText('Seu João da Silva').click();
  await page.getByRole('button', { name: 'Confirmar' }).waitFor({ timeout: 20_000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/modal-identificacao-${tema}.png` });

  await page.getByRole('button', { name: 'Confirmar' }).click();
  await page.getByRole('button', { name: 'Iniciar Check-in' }).click();
  await page.getByText('Aprazamento & Checagem Digital').waitFor({ timeout: 20_000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/atendimento-${tema}.png`, fullPage: true });

  // Um medicamento administrado, para ver os estados positivos.
  await page.getByRole('button', { name: /Registrar administrado/ }).first().click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/atendimento-checado-${tema}.png`, fullPage: true });

  await context.close();
}

async function capturarGestor(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  await preparar(context);
  const page = await context.newPage();
  await page.goto(`${BASE}/gestor/prontuarios`);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/gestor-prontuarios-claro.png`, fullPage: true });
  await page.goto(`${BASE}/gestor/prontuarios/auditoria`);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/gestor-auditoria-claro.png`, fullPage: true });
  await context.close();
}

const browser = await chromium.launch();
for (const tema of ['claro', 'escuro']) {
  await capturar(browser, tema);
  console.log('capturado:', tema);
}
await capturarGestor(browser);
console.log('capturado: gestor');
await browser.close();
