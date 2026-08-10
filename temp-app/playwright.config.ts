import { defineConfig, devices } from '@playwright/test';

// Os testes E2E mockam todas as chamadas externas (Bubble, ZapSign, ViaCEP)
// via page.route — nenhum dado real é criado ao rodá-los.
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // O prontuário grava áudio. Sem conceder o microfone e sem um
        // dispositivo falso, getUserMedia rejeita, a gravação nunca começa e o
        // teste de transcrição falha procurando um botão que só aparece com a
        // gravação em curso. As flags fazem o Chrome aceitar automaticamente e
        // tocar um tom sintético no lugar do microfone real.
        permissions: ['microphone'],
        launchOptions: {
          args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
        },
      },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
