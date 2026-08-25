import { test, expect } from '@playwright/test';
import { autenticarCooperado } from './helpers/sessao-cooperado';

test.describe('Prontuário - Gravação e Transcrição por Voz (API Mocked)', () => {
  test.beforeEach(async ({ page }) => {
    await autenticarCooperado(page);

    // Interceptar e simular a chamada da API de Transcrição
    await page.route('**/api/cooperado/transcrever', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          transcricaoCrua: 'o paciente tá bem... a pressão deu 12 por 8... sem dor... o acesso venoso tá bom, sem sinais de infecção ou inflamação...',
          transcricao: `EVOLUÇÃO CLÍNICA DE ENFERMAGEM:
- ESTADO GERAL: Paciente normotenso (PA: 120/80 mmHg), eupneico, afebril, calmo.
- DISPOSITIVOS: Acesso venoso periférico mantido, pérvio e sem sinais flogísticos.`
        })
      });
    });
  });

  test('deve simular gravação de áudio e receber evolução estruturada da IA', async ({ page }) => {
    // Acessar a tela de prontuário diretamente
    await page.goto('/cooperado/prontuario/p_1');

    // Confirmar modal mandatório
    await page.click('button:has-text("Confirmar")');

    // Iniciar Check-in
    await page.click('button:has-text("Iniciar Check-in")');

    // Localizar área de áudio
    await expect(page.locator('text=Evolução por Comando de Voz')).toBeVisible();

    // Simular início de gravação
    const startRecordBtn = page.locator('button[title="Gravar áudio"]');
    await expect(startRecordBtn).toBeVisible();
    await startRecordBtn.click();

    // Em gravação, botões de Pause e Stop devem aparecer
    const stopRecordBtn = page.locator('button[title="Finalizar e Salvar"]');
    await expect(stopRecordBtn).toBeVisible();
    
    // Finalizar gravação
    await stopRecordBtn.click();

    // Após transcrição, o editor de revisão deve conter o texto formatado final
    const reviewTextArea = page.locator('textarea[placeholder*="A evolução estruturada aparecerá"]');
    await expect(reviewTextArea).toBeVisible();
    await expect(reviewTextArea).toHaveValue(/EVOLUÇÃO CLÍNICA DE ENFERMAGEM/, { timeout: 10000 });

    // Deve conter palavras chaves da formatação estruturada clínica
    const textVal = await reviewTextArea.inputValue();
    expect(textVal).toContain('EVOLUÇÃO CLÍNICA DE ENFERMAGEM');
    expect(textVal).toContain('ESTADO GERAL');
    expect(textVal).toContain('DISPOSITIVOS');

    // Preencher PIN de segurança para assinar
    const pinInput = page.locator('input[placeholder*="PIN"]');
    await pinInput.fill('123456');

    // Assinar prontuário
    await page.click('button:has-text("Assinar e Finalizar")');

    // Verificar se a tela bloqueou os inputs (imutabilidade)
    await expect(page.locator('text=Prontuário Assinado Digitalmente')).toBeVisible();
    await expect(reviewTextArea).toBeDisabled();
  });
});
