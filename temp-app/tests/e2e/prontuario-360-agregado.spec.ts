import { test, expect, Page } from '@playwright/test';

/**
 * Caminho otimizado da tela de detalhe: `GET /pacientes/[id]` devolve o
 * prontuário 360° inteiro (`completo: true`) e a tela NÃO deve disparar as 5
 * requisições antigas (/dashboard, /planos, /prescricoes, /sinais-vitais,
 * /parecer). Equipamentos chegam depois, por `/equipamentos`.
 */

async function autenticarGestor(page: Page) {
  await page.context().addCookies([{ name: 'gestor_session', value: 'user-e2e-gestor-1', url: 'http://localhost:3005' }]);
}

const hoje = new Date().toISOString().split('T')[0];
const daqui30 = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

const paciente = {
  id: 'p_rpc',
  nome: 'Paciente Agregado RPC',
  cpf: '000.000.000-00',
  diagnostico_principal: 'Diagnóstico do teste agregado',
  complexidade: 'Média',
  status: 'Ativo',
  warnings: ['Alerta do teste agregado'],
  limite_visitas_mes: 0,
};

const plano = {
  id: 'pln_rpc',
  paciente_id: 'p_rpc',
  data_inicio: hoje,
  data_fim: daqui30,
  status: 'Ativo',
  metas: [
    { id: 'm1', plano_id: 'pln_rpc', especialidade: 'Medico', quantidade_prevista: 2, quantidade_realizada: 1, quantidade_restante: 1, status_meta: 'Em_Andamento', profissionais_designados: [] },
  ],
  total_previsto: 2,
  total_realizado: 1,
  total_restante: 1,
  tem_pendencias: false,
  pendencias_alertas: [],
};

test('detalhe do prontuário: resposta completa evita as 5 requisições antigas e carrega equipamentos em segundo plano', async ({ page }) => {
  await autenticarGestor(page);
  await page.route('**/api/gestor/me', (route) => route.fulfill({ json: { nome: 'Gestor', email: 'g@g.app' } }));

  let pacientePedidos = 0;
  await page.route('**/api/gestor/prontuarios/pacientes/p_rpc', (route) => {
    pacientePedidos++;
    return route.fulfill({
      json: {
        success: true,
        data: {
          paciente,
          evolucoes: [],
          prescricoes: [{ id: 'pr1', paciente_id: 'p_rpc', medicamento: 'Dipirona RPC', dosagem: '1g', via_administracao: 'Oral', frequencia_horas: 6, status: 'Ativa', horarios_padrao: [] }],
          sinaisVitais: [],
          pareceres: [],
          planos: [plano],
          planoVigente: plano,
          pendencias: [],
          completo: true,
        },
      },
    });
  });

  let equipamentosPedidos = 0;
  await page.route('**/api/gestor/prontuarios/pacientes/p_rpc/equipamentos', (route) => {
    equipamentosPedidos++;
    return route.fulfill({
      json: {
        success: true,
        data: [{ id: 'l1', equipamento_id: 'eq1', nome: 'Cama Hospitalar RPC', categoria: 'Mobiliário', numero_serie: 'S-1', status_locacao: 'Ativo', data_inicio: hoje, data_fim_previsto: daqui30, valor_aluguel: 10 }],
      },
    });
  });

  const legadas: string[] = [];
  for (const sufixo of ['dashboard', 'planos', 'prescricoes', 'sinais-vitais', 'parecer']) {
    await page.route(`**/api/gestor/prontuarios/pacientes/p_rpc/${sufixo}`, (route) => {
      if (route.request().method() === 'GET') legadas.push(sufixo);
      return route.fulfill({ json: { success: true, data: [] } });
    });
  }

  await page.goto('/gestor/prontuarios/p_rpc');
  await expect(page.getByText('Paciente Agregado RPC').first()).toBeVisible({ timeout: 20000 });
  await expect(page.getByText('Alerta do teste agregado')).toBeVisible();
  await expect(page.getByRole('button', { name: /Plano Terapêutico \(1\)/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Prescrições Médicas \(1\)/ })).toBeVisible();
  // Equipamento vem da rota separada, depois dos dados clínicos.
  await expect(page.getByText('Cama Hospitalar RPC')).toBeVisible({ timeout: 15000 });
  // Em dev o React StrictMode roda o efeito de carga 2x; o invariante é 1 busca
  // de equipamentos por carga do prontuário, e nenhuma das 5 rotas antigas.
  expect(pacientePedidos).toBeGreaterThanOrEqual(1);
  expect(equipamentosPedidos).toBe(pacientePedidos);
  expect(legadas).toEqual([]);
});
