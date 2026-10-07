import { test, expect, Page } from '@playwright/test';

const PACIENTE_ID_REAL = '1657134607817x110649329563205630';

async function autenticarGestor(page: Page) {
  await page.context().addCookies([
    {
      name: 'gestor_session',
      value: 'user-e2e-gestor-1',
      url: 'http://localhost:3005',
    },
  ]);
}

test.describe('Fluxo Real E2E - Prontuário e Plano Terapêutico (Paciente New Thing)', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(120_000);

  test('Deve carregar paciente real New Thing do Bubble, salvar plano terapêutico no backend, persistir no reload e refletir no Dashboard Geral', async ({ page }) => {
    // 1. Autenticar como gestor
    await autenticarGestor(page);

    // 2. Acessar a URL real do prontuário do paciente New Thing
    await page.goto(`/gestor/prontuarios/${PACIENTE_ID_REAL}`, { waitUntil: 'networkidle' });

    // 3. Validar que o paciente carregou corretamente (nome "New Thing" do Bubble/D1)
    const headerPaciente = page.locator('h1, h2').filter({ hasText: /New Thing/i });
    await expect(headerPaciente.first()).toBeVisible({ timeout: 25_000 });

    // 4. Navegar para a aba "Plano Terapêutico"
    const abaPlanoBtn = page.locator('button').filter({ hasText: /Plano Terapêutico/i }).first();
    await abaPlanoBtn.click();

    // 5. Iniciar cadastro de plano terapêutico se o formulário não estiver aberto
    const btnNovoPlano = page.locator('button').filter({ hasText: /Novo Plano Terapêutico/i });
    if (await btnNovoPlano.isVisible()) {
      await btnNovoPlano.click();
    }

    // 6. Preencher dados do Plano Terapêutico
    const hoje = new Date().toISOString().split('T')[0];
    const dataFim = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Localizar inputs de vigência
    const inputInicio = page.locator('input[type="date"]').first();
    const inputFim = page.locator('input[type="date"]').nth(1);

    await inputInicio.fill(hoje);
    await inputFim.fill(dataFim);

    // Preencher observações
    const txtObs = page.locator('textarea, input[placeholder*="observações" i], input[placeholder*="Observações" i]').first();
    if (await txtObs.isVisible()) {
      await txtObs.fill('Acompanhamento multiprofissional intensivo validado E2E Playwright.');
    }

    // Configurar metas por especialidade
    // Garantir que as quantidades sejam preenchidas
    const inputsQtd = page.locator('input[type="number"]');
    const totalInputs = await inputsQtd.count();
    if (totalInputs >= 3) {
      await inputsQtd.nth(0).fill('6'); // Técnico Enfermagem
      await inputsQtd.nth(1).fill('2'); // Médico
      await inputsQtd.nth(2).fill('3'); // Dentista
    }

    // 7. Submeter e salvar o plano
    const btnSalvar = page.locator('button').filter({ hasText: /Salvar Plano Terapêutico/i });
    await btnSalvar.click();

    // 8. Assert de sucesso e exibição imediata no frontend
    const alertaSucesso = page.locator('text=Plano Terapêutico salvo com sucesso');
    await expect(alertaSucesso).toBeVisible({ timeout: 15_000 });

    // Validar que o plano salvo aparece listado com status "Ativo"
    const cardPlanoSalvo = page.locator('div').filter({ hasText: /Vigência:/i }).first();
    await expect(cardPlanoSalvo).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('text=Ativo').first()).toBeVisible();

    // 9. Validar sincronização com a aba "Dashboard Geral"
    const abaGeralBtn = page.locator('button').filter({ hasText: /Dashboard Geral|Geral/i }).first();
    await abaGeralBtn.click();

    // No Dashboard Geral, o KPI do Plano Terapêutico deve refletir o plano ativo (não mais "Sem Plano Ativo")
    await expect(page.locator('text=Sem Plano Ativo')).toHaveCount(0);
    const kpiPlano = page.locator('text=Plano Terapêutico').first();
    await expect(kpiPlano).toBeVisible();

    // Metas por Especialidade no Dashboard Geral
    const secaoMetas = page.locator('text=Metas por Especialidade no Plano Terapêutico Vigente');
    await expect(secaoMetas).toBeVisible();

    // 10. Teste de Persistência Real: Recarregar a página (F5 / reload)
    await page.reload({ waitUntil: 'networkidle' });

    // Assert que o paciente continua carregando sem erro
    await expect(headerPaciente.first()).toBeVisible({ timeout: 25_000 });

    // Assert que no Dashboard Geral o plano salvo persiste pós-reload
    await expect(secaoMetas).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('text=Sem Plano Ativo')).toHaveCount(0);

    // Ir para a aba Plano Terapêutico e verificar que a lista continua populada
    await page.locator('button').filter({ hasText: /Plano Terapêutico/i }).first().click();
    await expect(page.locator('div').filter({ hasText: /Vigência:/i }).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('text=Nenhum plano terapêutico registrado ainda')).toHaveCount(0);
  });

  test('Deve editar o plano terapêutico existente e persistir alterações após reload', async ({ page }) => {
    await autenticarGestor(page);
    await page.goto(`/gestor/prontuarios/${PACIENTE_ID_REAL}`, { waitUntil: 'networkidle' });

    // Navegar para a aba Plano Terapêutico
    await page.locator('button').filter({ hasText: /Plano Terapêutico/i }).first().click();

    // Clicar em Editar no plano existente
    const btnEditar = page.locator('button').filter({ hasText: /Editar/i }).first();
    await expect(btnEditar).toBeVisible({ timeout: 15_000 });
    await btnEditar.click();

    // Alterar o campo de observações
    const txtObs = page.locator('textarea').first();
    await expect(txtObs).toBeVisible();
    await txtObs.fill('Observação atualizada: plano revisado e aprovado pela auditoria médica.');

    // Salvar alteração
    const btnSalvar = page.locator('button').filter({ hasText: /Salvar Plano Terapêutico/i });
    await btnSalvar.click();

    await expect(page.locator('text=Plano Terapêutico salvo com sucesso')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('text=Observação atualizada: plano revisado')).toBeVisible();

    // Recarregar a página e checar persistência da alteração
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('button').filter({ hasText: /Plano Terapêutico/i }).first().click();
    await expect(page.locator('text=Observação atualizada: plano revisado')).toBeVisible({ timeout: 10_000 });
  });

  test('Deve cadastrar prescrição médica real e persistir no backend após reload da página', async ({ page }) => {
    await autenticarGestor(page);
    await page.goto(`/gestor/prontuarios/${PACIENTE_ID_REAL}`, { waitUntil: 'networkidle' });

    // Navegar para a aba Prescrições Médicas
    await page.locator('button').filter({ hasText: /Prescrições Médicas/i }).first().click();

    // Abrir modal de nova prescrição
    const btnNovaPresc = page.locator('button').filter({ hasText: /Nova Prescrição|Cadastrar Primeira Prescrição/i }).first();
    await expect(btnNovaPresc).toBeVisible({ timeout: 15_000 });
    await btnNovaPresc.click();

    // Preencher campos
    const inputMedicamento = page.locator('input[placeholder*="Ex: Losartana"]');
    await expect(inputMedicamento).toBeVisible({ timeout: 10_000 });
    await inputMedicamento.fill('Amoxicilina + Clavulanato 875mg');
    await page.locator('input[placeholder*="Ex: 1 comprimido"]').fill('1 comprimido via oral');
    await page.locator('input[placeholder*="Ex: Diluir"]').fill('Tomar a cada 12 horas por 7 dias');

    // Salvar prescrição
    const btnSalvarPresc = page.locator('button[type="submit"]').filter({ hasText: /Salvar Prescrição/i });
    await btnSalvarPresc.click();

    // Verificar que aparece na lista
    await expect(page.locator('text=Amoxicilina + Clavulanato 875mg').first()).toBeVisible({ timeout: 15_000 });

    // Recarregar a página
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('button').filter({ hasText: /Prescrições Médicas/i }).first().click();
    await expect(page.locator('text=Amoxicilina + Clavulanato 875mg').first()).toBeVisible({ timeout: 15_000 });
  });
});
