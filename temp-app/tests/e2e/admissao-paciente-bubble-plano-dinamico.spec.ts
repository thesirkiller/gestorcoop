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

const mockPacientesBubble = [
  {
    _id: 'bub_pac_crer',
    txt_nome: 'CRER - Centro de Reabilitação e Readaptação',
    txt_endereco: 'Av. Vereador José Monteiro, 1655 - Setor Negrão de Lima, Goiânia - GO',
    txt_whatsapp: '(62) 3232-1000',
    txt_cpf: '01.234.567/0001-88',
    txt_tipo: 'Hospital',
    fks_equipamentos: ['eq_1', 'eq_2'],
  },
  {
    _id: 'bub_pac_marcos',
    txt_nome: 'Marcos Vinicius Santos',
    txt_endereco: 'Rua das Acácias, 780 - Morumbi, São Paulo - SP',
    txt_whatsapp: '(11) 98765-4321',
    txt_cpf: '123.456.789-99',
    txt_tipo: 'Homecare',
    fks_equipamentos: [],
  },
];

const mockCooperados = [
  { id: 'coop_tec_carlos', nome: 'Téc. Carlos Enfermagem', cargo: 'Tecnico_Enfermagem' },
  { id: 'coop_tec_roberto', nome: 'Téc. Roberto Soares', cargo: 'Tecnico_Enfermagem' },
  { id: 'coop_med_marcos', nome: 'Dr. Marcos Mendes', cargo: 'Medico' },
  { id: 'coop_dent_camila', nome: 'Dra. Camila Odonto', cargo: 'Dentista' },
  { id: 'coop_fisio_ana', nome: 'Dra. Ana Fisioterapia', cargo: 'Fisioterapeuta' },
];

test.describe('Admissão com Paciente do Bubble & Plano Terapêutico Dinâmico', () => {
  test('Gestor seleciona paciente existente do Bubble e define Plano Dinâmico com múltiplas especialidades', async ({ page }) => {
    await autenticarGestor(page);

    await page.route('**/api/gestor/me', (route) =>
      route.fulfill({ json: { nome: 'Dr. Marcos Gestor' } })
    );

    await page.route('**/api/gestor/pacientes', (route) =>
      route.fulfill({ json: { success: true, data: mockPacientesBubble } })
    );

    await page.route('**/api/gestor/cooperados*', (route) =>
      route.fulfill({ json: { success: true, data: mockCooperados } })
    );

    await page.route('**/api/gestor/prontuarios', (route) =>
      route.fulfill({ json: { success: true, results: [] } })
    );

    let payloadAdmissao: any = null;
    await page.route('**/api/gestor/prontuarios/pacientes', (route) => {
      if (route.request().method() === 'POST') {
        payloadAdmissao = JSON.parse(route.request().postData() || '{}');
        return route.fulfill({
          json: {
            success: true,
            data: {
              id: payloadAdmissao.id || 'bub_pac_marcos',
              nome: payloadAdmissao.nome,
              status: 'Ativo',
            },
            plano: {
              id: 'pln_dinamico_1',
              metas: payloadAdmissao.plano_terapeutico?.metas || [],
            },
          },
        });
      }

      // Lista unificada
      return route.fulfill({
        json: {
          success: true,
          data: [
            {
              id: 'bub_pac_crer',
              nome: 'CRER - Centro de Reabilitação e Readaptação',
              endereco: 'Av. Vereador José Monteiro, 1655',
              complexidade: 'Alta',
              origem: 'Bubble',
              tem_plano_terapeutico: false,
            },
            {
              id: 'bub_pac_marcos',
              nome: 'Marcos Vinicius Santos',
              endereco: 'Rua das Acácias, 780',
              complexidade: 'Média',
              origem: 'Bubble',
              tem_plano_terapeutico: false,
            },
          ],
        },
      });
    });

    await page.route('**/api/gestor/prontuarios/pacientes/bub_pac_marcos', (route) =>
      route.fulfill({
        json: {
          success: true,
          data: {
            completo: true,
            paciente: {
              id: 'bub_pac_marcos',
              nome: 'Marcos Vinicius Santos',
              cpf: '123.456.789-99',
              complexidade: 'Média',
              status: 'Ativo',
            },
            evolucoes: [],
            prescricoes: [],
            sinaisVitais: [],
            pareceres: [],
            planos: [],
            planoVigente: null,
          },
        },
      })
    );

    await page.route('**/api/gestor/prontuarios/pacientes/bub_pac_marcos/dashboard', (route) =>
      route.fulfill({
        json: {
          success: true,
          data: {
            paciente: { id: 'bub_pac_marcos', nome: 'Marcos Vinicius Santos' },
            planoVigente: {
              id: 'pln_dinamico_1',
              total_previsto: 10,
              total_realizado: 0,
              total_restante: 10,
              metas: [],
            },
            planos: [],
            equipamentos: [],
          },
        },
      })
    );

    // 1. Acessa a tela de prontuários
    await page.goto('http://localhost:3005/gestor/prontuarios');
    await expect(page.locator('text=Gestão de Prontuários & Pacientes')).toBeVisible();

    // 2. Os pacientes do Bubble aparecem diretamente na lista com alerta "Sem Plano Terapêutico"
    await expect(page.locator('text=Marcos Vinicius Santos')).toBeVisible();
    await expect(page.locator('text=CRER - Centro de Reabilitação e Readaptação')).toBeVisible();

    // 3. Clica em "Admitir Paciente" para abrir o modal inteligente
    await page.click('button:has-text("Admitir Paciente")');
    await expect(page.locator('text=Admissão Clínica & Plano Terapêutico')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Base GestorCoop (Bubble)' })).toBeVisible();

    // 4. Seleciona o paciente Marcos Vinicius Santos vindo do Bubble dentro do modal
    await page.locator('.cursor-pointer:has-text("Marcos Vinicius Santos")').click();
    await expect(page.locator('text=Pronto para Admissão')).toBeVisible();

    // 5. No Plano Terapêutico Dinâmico: adiciona nova especialidade dinamicamente
    await page.click('button:has-text("+ Adicionar Especialidade")');

    // Seleciona cooperados para as metas
    await page.locator('button:has-text("Téc. Carlos Enfermagem")').first().click();
    await page.locator('button:has-text("Téc. Roberto Soares")').first().click();

    // 6. Submete o formulário com paciente do Bubble e Plano Dinâmico aguardando a resposta da rota
    await Promise.all([
      page.waitForResponse((res) => res.url().includes('/api/gestor/prontuarios/pacientes') && res.request().method() === 'POST'),
      page.click('button:has-text("Admitir Paciente & Ativar Plano Terapêutico")'),
    ]);

    // 7. Valida que o payload enviado contém os dados integrados e as especialidades dinâmicas
    expect(payloadAdmissao).not.toBeNull();
    expect(payloadAdmissao.id).toBe('bub_pac_marcos');
    expect(payloadAdmissao.nome).toBe('Marcos Vinicius Santos');
    expect(payloadAdmissao.plano_terapeutico).toBeDefined();
    expect(payloadAdmissao.plano_terapeutico.metas.length).toBeGreaterThanOrEqual(4); // 3 padrão + 1 adicionada dinamicamente

    // 8. O sistema redireciona com sucesso para a Dashboard Individual do paciente
    await expect(page).toHaveURL(/\/gestor\/prontuarios\/bub_pac_marcos/, { timeout: 15000 });
    await expect(page.locator('h1:has-text("Marcos Vinicius Santos")')).toBeVisible({ timeout: 15000 });
  });
});
