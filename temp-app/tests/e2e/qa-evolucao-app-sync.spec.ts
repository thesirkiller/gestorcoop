import { test, expect, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const SCREENSHOT_DIR = 'C:/Users/admin/.gemini/antigravity/brain/382d8bdd-0ff7-4427-bd76-b9e5a015a801';

async function autenticarCooperado(page: Page) {
  await page.context().addCookies([
    {
      name: 'cooperado_session',
      value: 'user-e2e-coop-1',
      url: 'http://localhost:3005',
    },
  ]);

  await page.addInitScript(() => {
    window.localStorage.setItem(
      'cooperado_session',
      JSON.stringify({
        id: 'coop_101',
        nome: 'Enf. Camila Andrade Souza',
        cargo: 'Tecnico_Enfermagem',
        profissao: 'Enfermeiro (a)',
        cpf: '529.982.247-25',
        autenticado: true,
      })
    );
  });

  await page.route('**/api/cooperado/me', (route) =>
    route.fulfill({
      json: {
        success: true,
        cooperadoId: 'coop_101',
        id: 'coop_101',
        nome: 'Enf. Camila Andrade Souza',
        cpf: '529.982.247-25',
        cargo: 'Tecnico_Enfermagem',
        profissao: 'Enfermeiro (a)',
      },
    })
  );
}

test.describe('Fluxo de Evolução no App do Cooperado — Persistência, Sincronização e Histórico', () => {
  test.beforeAll(() => {
    if (!fs.existsSync(SCREENSHOT_DIR)) {
      fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    }
  });

  test('Cooperado finaliza evolução com biometria facial, visualiza no Histórico do Prontuário e na aba Finalizados da Agenda', async ({ page }) => {
    await autenticarCooperado(page);
    await page.setViewportSize({ width: 430, height: 1080 });

    const evolucoesServidor: Array<Record<string, unknown>> = [];
    const sinaisServidor: Array<Record<string, unknown>> = [];
    const pacienteMock: Record<string, unknown> = {
      id: 'p_helena_1',
      nome: 'Dona Helena Albuquerque Prado',
      cpf: '295.841.370-04',
      data_nascimento: '19/08/1944',
      endereco: 'Alameda das Rosas, nº 850 - Setor Oeste, Goiânia/GO',
      responsavel_nome: 'Maria Helena Albuquerque',
      responsavel_telefone: '(85) 99981-4420',
      responsaveis: [
        {
          id: 'resp_maria_helena',
          nome: 'Maria Helena Albuquerque',
          parentesco: 'Filha',
          telefone: '(85) 99981-4420',
          principal: true,
        },
        {
          id: 'resp_carlos_prado',
          nome: 'Carlos Eduardo Prado',
          parentesco: 'Neto',
          telefone: '(85) 98812-3310',
          principal: false,
        },
      ],
      warnings: ['Alergia a Dipirona Sódica'],
      limite_visitas_mes: 20,
      visitas_realizadas_mes: 4,
      visitas_restantes_mes: 16,
      limite_atingido: false,
    };

    await page.route('**/api/cooperado/agenda**', (route) =>
      route.fulfill({
        json: {
          success: true,
          pacientes: [pacienteMock],
          prescricoes: [
            {
              id: 'pr_helena_1',
              paciente_id: 'p_helena_1',
              medicamento: 'Losartana Potássica 50mg',
              dosagem: '1 comprimido',
              via_administracao: 'Oral',
              frequencia_horas: 12,
              horarios_padrao: ['08:00'],
              status: 'Ativa',
              data_inicio: '2026-10-01',
              data_fim: '2026-10-31',
            },
          ],
          aprazamentos: [],
          evolucoes: evolucoesServidor,
          sinaisVitais: sinaisServidor,
        },
      })
    );

    await page.route('**/api/cooperado/sync**', async (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          json: {
            success: true,
            pacientes: [pacienteMock],
            prescricoes: [],
            aprazamentos: [],
            evolucoes: evolucoesServidor,
            sinaisVitais: sinaisServidor,
          },
        });
      }

      const body = route.request().postDataJSON() || {};
      const actions = body.actions || [];
      const syncedEvols: Array<Record<string, unknown>> = [];

      for (const act of actions) {
        if (act.type === 'REGISTRAR_SINAIS_VITAIS') {
          sinaisServidor.unshift(act.payload);
        }
        if (act.type === 'SIGN_EVOLUCAO') {
          const p = act.payload || {};
          const evFinal = {
            id: p.evolucaoId,
            paciente_id: p.pacienteId || 'p_helena_1',
            paciente_nome: p.pacienteNome || pacienteMock.nome,
            profissional_id: 'coop_101',
            profissional_nome: p.profissionalNome || 'Enf. Camila Andrade Souza',
            tipo_profissional: p.tipoProfissional || 'Tecnico_Enfermagem',
            turno: p.turno || 'Diurno',
            check_in: p.checkIn || p.checkOut,
            check_out: p.checkOut,
            transcricao_revisada: p.transcricao_revisada,
            status: 'Finalizado',
            data_assinatura: p.checkOut,
            assinatura_digital: `v2:bio:facial:sha256=${p.biometria_hash}:coop=52998224725:ts=${p.checkOut}:sig_hmac_ok`,
            responsavel_id: p.responsavel_id,
            responsavel_nome: p.responsavel_nome,
            responsavel_parentesco: p.responsavel_parentesco,
            sinais_vitais: sinaisServidor,
          };
          evolucoesServidor.unshift(evFinal);
          syncedEvols.push(evFinal);
          pacienteMock.visitas_realizadas_mes = 5;
          pacienteMock.visitas_restantes_mes = 15;
        }
      }

      return route.fulfill({
        json: {
          success: true,
          syncedCount: actions.length,
          evolucoes: syncedEvols,
        },
      });
    });

    // 1. Cooperado abre o prontuário do paciente
    await page.goto('/cooperado/prontuario/p_helena_1');

    // 2. Confirma identificação do paciente
    await expect(page.getByText('Identificação de Segurança')).toBeVisible();
    await page.getByRole('button', { name: 'Confirmar' }).click();

    // 3. Inicia o Check-in
    await page.getByRole('button', { name: 'Iniciar Check-in' }).click();
    await expect(page.getByText('Sessão Ativa')).toBeVisible();

    // 4. Checa medicação se houver slot pendente no turno atual
    const btnAdministrar = page.getByRole('button', { name: /Registrar administrado/i }).first();
    if (await btnAdministrar.isVisible()) {
      await btnAdministrar.click();
      await expect(page.getByText('Checado').first()).toBeVisible();
    }

    // 5. Registra Sinais Vitais
    await page.fill('input[placeholder="Ex: 120"]', '122');
    await page.fill('input[placeholder="Ex: 80"]', '78');
    await page.fill('input[placeholder="Ex: 75"]', '74');
    await page.fill('input[placeholder="Ex: 98"]', '98');
    await page.fill('input[placeholder="Ex: 36.5"]', '36.4');
    await page.fill('input[placeholder="Ex: 110"]', '96');
    await page.getByRole('button', { name: /Registrar Sinais Vitais/i }).click();
    await expect(page.getByText('Aferido nesta sessão:')).toBeVisible();
    await expect(page.getByText('PA 122/78 mmHg')).toBeVisible();

    // 6. Preenche a evolução clínica estruturada
    const textoEvolucao =
      '[S - Subjetivo] Paciente calma, contactuante, sem queixas álgicas no plantão diurno.\n' +
      '[O - Objetivo] Eupneica em ar ambiente (SpO2 98%), normotensa (PA 122/78 mmHg), FC 74 bpm, Tax 36.4°C, HGT 96 mg/dL.\n' +
      '[A - Avaliação] Quadro clínico e hemodinâmico estável em assistência domiciliar.\n' +
      '[P - Plano] Administrada medicação prescrita, realizada higiene, mudança de decúbito e orientações à família.';
    await page.fill('#revisaoEvolucao', textoEvolucao);

    // 6.5. Seleciona o Familiar / Responsável pela Finalização do Plantão (Carlos Eduardo Prado - Neto)
    const secaoResponsavel = page.getByTestId('secao-selecao-responsavel');
    await expect(secaoResponsavel).toBeVisible();
    await page.getByTestId('btn-selecionar-responsavel-resp_carlos_prado').click();

    // 7. Assina via Reconhecimento Facial Biométrico (SHA-256)
    await page.getByTestId('btn-abrir-validacao-facial').click();
    await expect(page.getByText('Reconhecimento Facial • Assinatura')).toBeVisible();
    await expect(page.getByTestId('modal-facial-seletor-responsavel')).toContainText('Carlos Eduardo Prado');
    await page.getByTestId('btn-capturar-rosto').click();
    await expect(page.getByTestId('hash-biometrico-sha256')).toBeVisible();

    // Captura screenshot da tela de validação facial com o Familiar/Responsável selecionado
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'qa-cooperado-selecao-responsavel-facial.png'),
      fullPage: false,
    });

    await page.getByTestId('btn-confirmar-assinatura-facial').click();

    // 8. Verifica que o prontuário foi assinado, exibe o familiar responsável e a seção "Histórico de Evoluções Realizadas" aparece imediatamente
    await expect(page.getByText('Prontuário Assinado Digitalmente')).toBeVisible();
    await expect(page.getByTestId('responsavel-assinado-resumo')).toContainText('Carlos Eduardo Prado (Neto)');
    const secaoHistorico = page.getByTestId('secao-historico-evolucoes');
    await expect(secaoHistorico).toBeVisible();
    await expect(secaoHistorico.getByText('Histórico de Evoluções Realizadas (1)')).toBeVisible();
    await expect(secaoHistorico.getByText('Assinado & Sincronizado')).toBeVisible();
    await expect(secaoHistorico.getByText(/Carlos Eduardo Prado \(Neto\)/)).toBeVisible();
    await expect(secaoHistorico.getByText('PA 122/78 mmHg', { exact: true })).toBeVisible();
    await expect(secaoHistorico.getByText(/Quadro clínico e hemodinâmico estável/)).toBeVisible();
    await expect(page.getByTestId('btn-novo-atendimento')).toBeVisible();

    // Rola até a seção de assinatura + histórico para capturar evidência visual completa
    await secaoHistorico.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'qa-evolucao-app-finalizada.png'),
      fullPage: true,
    });

    // 9. Volta para a Agenda do Cooperado (/cooperado) e verifica a aba Finalizados
    await page.getByRole('button', { name: 'Voltar para a Agenda' }).click();
    await expect(page).toHaveURL(/\/cooperado$/);

    // Verifica que aparece na aba "De hoje" como Concluído e na aba "Finalizados"
    await expect(page.getByText('Dona Helena Albuquerque Prado').first()).toBeVisible();
    await page.locator('#tab-finalizados').click();
    await expect(page.locator('#panel-finalizados').getByText('Dona Helena Albuquerque Prado')).toBeVisible();
    await expect(page.locator('#panel-finalizados').getByText('Assinado')).toBeVisible();
    await expect(page.locator('#panel-finalizados').getByText(/Paciente calma, contactuante/)).toBeVisible();

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'qa-evolucao-historico-app.png'),
      fullPage: true,
    });

    // 10. Visão do Gestor: abre /gestor/prontuarios/p_helena_1 e valida que os Responsáveis e a evolução sincronizada aparecem
    await page.context().addCookies([
      {
        name: 'gestor_session',
        value: 'user-e2e-gestor-marcos',
        url: 'http://localhost:3005',
      },
    ]);

    await page.route('**/api/gestor/me', (route) =>
      route.fulfill({
        json: { nome: 'Dr. Marcos Gabryel (Gestor)', email: 'gestor@gestorcoop.app' },
      })
    );

    await page.route('**/api/gestor/prontuarios/pacientes/p_helena_1', async (route) => {
      if (route.request().method() === 'PUT') {
        const body = route.request().postDataJSON() || {};
        pacienteMock.responsaveis = body.responsaveis || pacienteMock.responsaveis;
        pacienteMock.responsavel_nome = body.responsavel_nome || pacienteMock.responsavel_nome;
        return route.fulfill({
          json: {
            success: true,
            data: pacienteMock,
          },
        });
      }
      return route.fulfill({
        json: {
          success: true,
          data: {
            paciente: pacienteMock,
            evolucoes: evolucoesServidor.map((ev) => ({
              ...ev,
              soap_subjetivo: 'Paciente calma, contactuante, sem queixas álgicas no plantão diurno.',
              soap_objetivo:
                'Eupneica em ar ambiente (SpO2 98%), normotensa (PA 122/78 mmHg), FC 74 bpm, Tax 36.4°C, HGT 96 mg/dL.',
              soap_avaliacao: 'Quadro clínico e hemodinâmico estável em assistência domiciliar.',
              soap_plano:
                'Administrada medicação prescrita, realizada higiene, mudança de decúbito e orientações à família.',
            })),
            prescricoes: [],
            sinaisVitais: sinaisServidor,
            pareceres: [],
            completo: true,
          },
        },
      });
    });

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/gestor/prontuarios/p_helena_1');
    await expect(page.getByText('Dona Helena Albuquerque Prado')).toBeVisible();
    await expect(page.getByText('Enf. Camila Andrade Souza').first()).toBeVisible();
    await expect(page.getByText('Assinado Digitalmente pelo Profissional').first()).toBeVisible();
    await expect(page.getByTestId('card-responsaveis-paciente')).toContainText('Maria Helena Albuquerque');
    await expect(page.getByTestId('card-responsaveis-paciente')).toContainText('Carlos Eduardo Prado');

    // Abre o modal de Gerenciar Responsáveis pela Finalização do Plantão, adiciona um familiar e tira screenshot
    await page.getByTestId('btn-gerenciar-responsaveis').click();
    await expect(page.getByTestId('modal-responsaveis-paciente')).toBeVisible();
    await page.getByTestId('input-novo-responsavel-nome').fill('Roberto Albuquerque Prado');
    await page.getByTestId('select-novo-responsavel-parentesco').selectOption('Irmão(ã)');
    await page.getByTestId('input-novo-responsavel-telefone').fill('(85) 99711-2200');
    await page.getByTestId('btn-adicionar-responsavel-lista').click();
    await expect(page.getByTestId('modal-lista-responsaveis')).toContainText('Roberto Albuquerque Prado');

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'qa-gestor-cadastro-responsaveis.png'),
      fullPage: false,
    });

    await page.getByTestId('btn-salvar-responsaveis-paciente').click();
    await expect(page.getByTestId('card-responsaveis-paciente')).toContainText('Roberto Albuquerque Prado');

    // Abre a aba Evoluções Clínicas & SOAP (1) e valida os 4 campos estruturados do SOAP + responsável no plantão
    await page.getByRole('button', { name: /Evoluções Clínicas & SOAP/i }).click();
    await expect(page.getByText(/Quadro clínico e hemodinâmico estável/).first()).toBeVisible();
    await expect(page.getByText(/Carlos Eduardo Prado/).first()).toBeVisible();
  });

  test('Resiliência de Sincronização: exibe Aguardando Sincronização quando POST /api/cooperado/sync falha e preserva evolução em Finalizados ao iniciar Novo Atendimento', async ({ page }) => {
    await autenticarCooperado(page);
    await page.setViewportSize({ width: 430, height: 1080 });

    const pacienteMock = {
      id: 'p_helena_offline',
      nome: 'Sr. Joaquim Moura Neto',
      cpf: '412.639.850-11',
      data_nascimento: '10/03/1950',
      endereco: 'Rua 9, nº 400 - Setor Oeste, Goiânia/GO',
      warnings: [],
      limite_visitas_mes: 20,
      visitas_realizadas_mes: 2,
      visitas_restantes_mes: 18,
      limite_atingido: false,
    };

    await page.route('**/api/cooperado/agenda**', (route) =>
      route.fulfill({
        json: {
          success: true,
          pacientes: [pacienteMock],
          prescricoes: [],
          aprazamentos: [],
          evolucoes: [],
          sinaisVitais: [],
        },
      })
    );

    // Simula falha temporária no servidor (HTTP 503) durante o POST /api/cooperado/sync
    await page.route('**/api/cooperado/sync**', (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 503,
          json: { success: false, error: 'Servidor temporariamente indisponível.' },
        });
      }
      return route.fulfill({
        json: { success: true, pacientes: [pacienteMock], prescricoes: [], aprazamentos: [], evolucoes: [] },
      });
    });

    await page.goto('/cooperado/prontuario/p_helena_offline');
    await page.getByRole('button', { name: 'Confirmar' }).click();
    await page.getByRole('button', { name: 'Iniciar Check-in' }).click();

    await page.fill('input[placeholder="Ex: 120"]', '118');
    await page.fill('input[placeholder="Ex: 80"]', '76');
    await page.fill('#revisaoEvolucao', '[S] Paciente lúcido e orientado.\n[O] PA 118/76 mmHg.\n[A] Estável.\n[P] Mantida conduta.');

    // Assina via PIN de contingência
    await page.fill('input[placeholder="PIN (6 dígitos)"]', '123456');
    await page.getByRole('button', { name: 'Assinar e Finalizar' }).click();

    // Deve exibir "Aguardando Sincronização" (e NÃO "Assinado & Sincronizado") pois o sync retornou 503
    const secaoHistorico = page.getByTestId('secao-historico-evolucoes');
    await expect(secaoHistorico).toBeVisible();
    await expect(secaoHistorico.getByText('Aguardando Sincronização')).toBeVisible();
    await expect(secaoHistorico.getByText('Assinado & Sincronizado')).toHaveCount(0);

    // Inicia um Novo Atendimento (2ª visita) e verifica que o 1º atendimento permanece no histórico e na aba Finalizados
    await page.getByTestId('btn-novo-atendimento').click();
    await page.getByRole('button', { name: 'Iniciar Check-in' }).click();
    await expect(page.getByText('Sessão Ativa')).toBeVisible();
    await expect(secaoHistorico.getByText('Histórico de Evoluções Realizadas (1)')).toBeVisible();

    await page.getByRole('button', { name: 'Voltar para a Agenda' }).click();
    await expect(page).toHaveURL(/\/cooperado$/);

    // Na aba Finalizados, a 1ª evolução assinada continua visível mesmo com a 2ª sessão em andamento
    await page.locator('#tab-finalizados').click();
    await expect(page.locator('#panel-finalizados').getByText('Sr. Joaquim Moura Neto')).toBeVisible();
    await expect(page.locator('#panel-finalizados').getByText('Pendente de envio')).toBeVisible();
  });
});
