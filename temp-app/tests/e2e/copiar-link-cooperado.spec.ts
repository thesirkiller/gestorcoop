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

const mockPacientes = [
  {
    id: 'pac_marcos_copia',
    nome: 'Marcos Vinicius Santos',
    cpf: '123.456.789-99',
    endereco: 'Rua das Acácias, 780 - SP',
    complexidade: 'Média',
    status: 'Ativo',
    tem_plano_terapeutico: true,
    plano_vigente: {
      data_inicio: '2026-10-01',
      data_fim: '2026-10-31',
      total_previsto: 10,
      total_realizado: 3,
    },
  },
];

test.describe('Ações de Cópia e Envio de Link para o Cooperado', () => {
  test('Gestor visualiza e aciona a cópia do link do cooperado na lista inicial e no prontuário 360', async ({ page, context }) => {
    // Permite leitura e escrita no clipboard do navegador
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    await autenticarGestor(page);

    await page.route('**/api/gestor/me', (route) =>
      route.fulfill({ json: { nome: 'Dr. Marcos Gestor' } })
    );

    await page.route('**/api/gestor/pacientes', (route) =>
      route.fulfill({ json: { success: true, data: [] } })
    );

    await page.route('**/api/gestor/cooperados', (route) =>
      route.fulfill({ json: { success: true, data: [] } })
    );

    await page.route('**/api/gestor/prontuarios', (route) =>
      route.fulfill({ json: { success: true, results: [] } })
    );

    await page.route('**/api/gestor/prontuarios/pacientes', (route) =>
      route.fulfill({
        json: {
          success: true,
          data: mockPacientes,
        },
      })
    );

    await page.route('**/api/gestor/prontuarios/pacientes/pac_marcos_copia', (route) =>
      route.fulfill({
        json: {
          success: true,
          data: {
            paciente: mockPacientes[0],
            evolucoes: [],
            prescricoes: [],
            sinaisVitais: [],
            pareceres: [],
          },
        },
      })
    );

    await page.route('**/api/gestor/prontuarios/pacientes/pac_marcos_copia/dashboard', (route) =>
      route.fulfill({
        json: {
          success: true,
          data: {
            paciente: mockPacientes[0],
            planoVigente: mockPacientes[0].plano_vigente,
            planos: [mockPacientes[0].plano_vigente],
            equipamentos: [],
          },
        },
      })
    );

    // 1. Abre a interface inicial de Prontuários do Gestor
    await page.goto('http://localhost:3005/gestor/prontuarios');
    await expect(page.locator('text=Gestão de Prontuários & Pacientes')).toBeVisible();

    // 2. Valida o botão do Header para copiar link geral do cooperado
    const btnLinkGeral = page.locator('button:has-text("Link do Cooperado")');
    await expect(btnLinkGeral).toBeVisible();
    await btnLinkGeral.click();
    await expect(page.locator('text=Link Copiado!')).toBeVisible();

    // 3. Valida no Card do Paciente os botões específicos de compartilhamento
    await expect(page.locator('text=Marcos Vinicius Santos')).toBeVisible();
    const btnCopiarPaciente = page.locator('button:has-text("Copiar Link")').first();
    await expect(btnCopiarPaciente).toBeVisible();

    // Valida também presença do botão rápido do WhatsApp com link formatado
    const btnWhatsapp = page.locator('a[title*="WhatsApp"]').first();
    await expect(btnWhatsapp).toBeVisible();
    const hrefWhatsapp = await btnWhatsapp.getAttribute('href');
    expect(hrefWhatsapp).toContain('api.whatsapp.com/send');
    expect(hrefWhatsapp).toContain('cooperado%2Fprontuario%2Fpac_marcos_copia');

    // Clica no botão "Copiar Link" do card do paciente
    await btnCopiarPaciente.click();
    await expect(page.locator('button:has-text("Copiado!")').first()).toBeVisible();
    await expect(page.locator('text=Link copiado para o paciente Marcos Vinicius Santos!')).toBeVisible();

    // 4. Entra na página de Prontuário 360° do Paciente
    await page.click('a[href="/gestor/prontuarios/pac_marcos_copia"]');
    await expect(page.locator('h1:has-text("Marcos Vinicius Santos")')).toBeVisible({ timeout: 15000 });

    // 5. Valida os botões de compartilhamento na barra superior do prontuário
    const btnCopiar360 = page.locator('button:has-text("Copiar Link do Cooperado")');
    await expect(btnCopiar360).toBeVisible();
    await btnCopiar360.click();

    // Feedback visual imediato e toast
    await expect(page.locator('button:has-text("Link Copiado!")')).toBeVisible();
    await expect(page.locator('text=Link de atendimento copiado para o paciente Marcos Vinicius Santos!')).toBeVisible();
  });
});
