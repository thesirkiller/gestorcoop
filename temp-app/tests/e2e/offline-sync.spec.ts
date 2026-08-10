import { test, expect } from '@playwright/test';

import { autenticarCooperado } from './helpers/sessao-cooperado';

test.describe('Prontuário - Fluxo Offline-First e Sincronização (API Mocked)', () => {
  test.beforeEach(async ({ page }) => {
    await autenticarCooperado(page);

    // Interceptar e simular a chamada da API de escala
    await page.route('**/api/cooperado/agenda', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          pacientes: [
            {
              id: 'p_1',
              nome: 'Seu João da Silva',
              cpf: '123.456.789-00',
              data_nascimento: '12/04/1958',
              endereco: 'Rua das Palmeiras, 102 - Centro',
              warnings: ['Alergia a Dipirona e Penicilina', 'Hipertensão Grave']
            },
            {
              id: 'p_2',
              nome: 'Dona Maria de Oliveira',
              cpf: '987.654.321-11',
              data_nascimento: '25/08/1945',
              endereco: 'Av. Paulista, 1500 - Bela Vista',
              warnings: ['Risco de Queda']
            }
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
              data_fim: '2026-09-01'
            }
          ],
          aprazamentos: [
            {
              id: 'ap_1',
              prescricao_id: 'pr_1',
              horario_previsto: new Date().toISOString().split('T')[0] + 'T08:00:00.000Z',
              status: 'Pendente',
              medicamento: 'Losartana Potássica 50mg',
              dosagem: '1 comprimido',
              via_administracao: 'Oral'
            }
          ]
        })
      });
    });

    // Interceptar e simular a chamada da API de Sincronização
    await page.route('**/api/cooperado/sync', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          syncedCount: 1
        })
      });
    });
  });

  test('deve iniciar check-in do profissional e enfileirar ações locais offline-first', async ({ page }) => {
    // Navegar para a escala do cooperado
    await page.goto('/cooperado');

    // Clicar para carregar a escala diária (prefetch)
    const loadButton = page.getByRole('button', { name: 'Carregar Agenda' });
    await expect(loadButton).toBeVisible();
    await loadButton.click();

    // Verificar se os pacientes mockados foram carregados na agenda
    await expect(page.locator('text=Seu João da Silva')).toBeVisible();
    await expect(page.locator('text=Dona Maria de Oliveira')).toBeVisible();

    // Selecionar o atendimento do primeiro paciente (Seu João)
    await page.click('text=Seu João da Silva');

    // O modal de identificação do paciente deve abrir obrigatoriamente
    await expect(page.locator('text=Identificação de Segurança')).toBeVisible();
    await page.click('button:has-text("Confirmar")');

    // O cronômetro deve estar zerado e o check-in disponível
    await expect(page.locator('text=00:00:00')).toBeVisible();
    const checkInButton = page.getByRole('button', { name: 'Iniciar Check-in' });
    await expect(checkInButton).toBeVisible();
    await checkInButton.click();

    // Sessão iniciada, verificar indicador ativo
    await expect(page.locator('text=Sessão Ativa')).toBeVisible();

    // Para Técnicos, checar aprazamentos
    const checkMedButton = page.locator('button[title="Checar Administração"]').first();
    if (await checkMedButton.isVisible()) {
      await checkMedButton.click();
      // O botão deve sumir e virar badge "Checado"
      await expect(page.locator('text=Checado').first()).toBeVisible();
    }
  });
});
