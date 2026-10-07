/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Consultas agregadas ("RPC") do módulo de prontuários contra um D1 real em
 * memória (node:sqlite + todas as migrations).
 *
 * Rodar: npm run test:prontuarios
 */
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import axios, { AxiosError } from 'axios';
import { criarD1DeTeste, instalarContextoCloudflare, type D1DeTeste } from './stubs/d1-teste';
import {
  garantirSchemaD1,
  listarPacientesComResumoClinico,
  carregarProntuario360,
  obterPlanoTerapeuticoVigente,
  obterPacienteClinico,
  listarEvolucoesClinicas,
  listarPrescricoesClinicas,
  listarSinaisVitaisClinicos,
  listarPareceresClinicos,
  listarPlanosTerapeuticosPorPaciente,
  enriquecerPlanoComCalculos,
  listarEvolucoesResumo,
  LIMITE_RESUMO_EVOLUCAO,
  listarAprazamentosParaAuditoria,
  calcularDesvioAprazamento,
  inMemoryPacientes,
} from '../../src/lib/db/prontuarios';
import { memoizarComTtl, invalidarCacheMemoria, invalidarSessaoMemoria, TTL_SESSAO_MS } from '../../src/lib/cache-memoria';
import { validarSessaoAtiva } from '../../src/lib/sessao';
import {
  lerCacheNavegacao,
  gravarCacheNavegacao,
  invalidarCacheNavegacao,
  invalidarCacheNavegacaoPorPrefixo,
} from '../../src/lib/cache-navegacao';
import { bubbleApi } from '../../src/lib/bubble';
import { listarEquipamentosDoPaciente } from '../../src/lib/prontuario-equipamentos';
import { sincronizarPacientesBubbleParaD1 } from '../../src/lib/sync-pacientes';
import { POST as cronSyncPost } from '../../src/app/api/cron/sync-pacientes-bubble/route';
import { GET as gestorPacientesGet } from '../../src/app/api/gestor/prontuarios/pacientes/route';
import { NextRequest } from 'next/server';

process.env.BUBBLE_API_URL = 'https://bubble.invalid/version-test/api/1.1';
process.env.BUBBLE_API_TOKEN = 'token-de-teste';
// Nenhuma chamada destes testes pode sair para o Bubble real.
axios.defaults.adapter = async () => {
  throw new Error('Requisição externa não mockada');
};

const hoje = new Date().toISOString().split('T')[0];
const mes = hoje.slice(0, 7);
const anoAtual = Number(hoje.slice(0, 4));
const inicioPlano = `${anoAtual - 1}-01-01`;
const fimPlano = `${anoAtual + 1}-12-31`;

let db: D1DeTeste;

function inserir(tabela: string, linha: Record<string, unknown>) {
  const colunas = Object.keys(linha);
  db.sqlite
    .prepare(`INSERT INTO ${tabela} (${colunas.join(', ')}) VALUES (${colunas.map(() => '?').join(', ')})`)
    .run(...(Object.values(linha) as any[]));
}

function paciente(id: string, extra: Record<string, unknown> = {}) {
  inserir('pacientes', { id, nome: `Paciente ${id}`, cpf: '', warnings: '[]', limite_visitas_mes: 0, ...extra });
}

function evolucao(id: string, pacienteId: string, tipo: string, checkIn: string, extra: Record<string, unknown> = {}) {
  inserir('evolucoes', {
    id,
    paciente_id: pacienteId,
    profissional_id: 'coop_x',
    profissional_nome: `Prof ${id}`,
    tipo_profissional: tipo,
    check_in: checkIn,
    check_out: checkIn,
    transcricao_revisada: `texto ${id}`,
    status: 'Em_Andamento',
    ...extra,
  });
}

function popularBase() {
  // p_a: caso completo
  paciente('p_a', { limite_visitas_mes: 4, complexidade: 'Média' });
  inserir('planos_terapeuticos', {
    id: 'pln_a_vigente', paciente_id: 'p_a', data_inicio: inicioPlano, data_fim: fimPlano, status: 'Ativo',
    created_at: 'x', updated_at: 'x',
  });
  // Também vigente, mas começa antes: NÃO deve ser o escolhido (data_inicio DESC).
  inserir('planos_terapeuticos', {
    id: 'pln_a_antigo', paciente_id: 'p_a', data_inicio: `${anoAtual - 2}-01-01`, data_fim: fimPlano, status: 'Ativo',
    created_at: 'x', updated_at: 'x',
  });
  inserir('planos_terapeuticos', {
    id: 'pln_a_concluido', paciente_id: 'p_a', data_inicio: `${anoAtual - 3}-01-01`, data_fim: `${anoAtual - 3}-12-31`,
    status: 'Concluido', created_at: 'x', updated_at: 'x',
  });
  const meta = (id: string, plano: string, esp: string, qtd: number, designados = '[]') =>
    inserir('plano_terapeutico_metas', {
      id, plano_id: plano, especialidade: esp, quantidade_prevista: qtd, profissionais_designados: designados, created_at: 'x',
    });
  meta('m3', 'pln_a_vigente', 'Tecnico_Enfermagem', 3, JSON.stringify([{ id: 'coop_1', nome: 'Ana' }]));
  meta('m1', 'pln_a_vigente', 'Medico', 1);
  meta('m2', 'pln_a_vigente', 'Dentista', 2, '{json quebrado');
  meta('m_antigo', 'pln_a_antigo', 'Fisioterapeuta', 9);
  meta('m_conc', 'pln_a_concluido', 'Medico', 1);

  evolucao('e1', 'p_a', 'Tecnico_Enfermagem', `${mes}-01T09:00:00.000Z`);
  evolucao('e2', 'p_a', 'Tecnico_Enfermagem', `${hoje}T00:00:01.000Z`);
  evolucao('e3', 'p_a', 'tecnico', `${anoAtual}-01-01T00:00:00.000Z`); // sinônimo
  evolucao('e4', 'p_a', 'Médico', `${inicioPlano}T00:00:00.000Z`); // sinônimo, limite inferior exato
  evolucao('e5', 'p_a', 'Medico', `${anoAtual - 2}-06-01T10:00:00.000Z`); // fora da vigência do plano novo
  evolucao('e6', 'p_a', 'Dentista', `${fimPlano}T23:59:59.999Z`); // limite superior exato (futuro)

  inserir('prescricoes', { id: 'pr1', paciente_id: 'p_a', medicamento: 'A', dosagem: '1', via_administracao: 'Oral', frequencia_horas: 8, data_inicio: hoje, data_fim: hoje, status: 'Ativa', horarios_padrao: '["08:00"]', created_at: '2026-01-02' });
  inserir('prescricoes', { id: 'pr2', paciente_id: 'p_a', medicamento: 'B', dosagem: '1', via_administracao: 'Oral', frequencia_horas: 8, data_inicio: hoje, data_fim: hoje, status: 'Ativa', horarios_padrao: '[]', created_at: '2026-01-03' });
  inserir('prescricoes', { id: 'pr3', paciente_id: 'p_a', medicamento: 'C', dosagem: '1', via_administracao: 'Oral', frequencia_horas: 8, data_inicio: hoje, data_fim: hoje, status: 'Suspensa', horarios_padrao: '[]', created_at: '2026-01-01' });

  inserir('sinais_vitais', { id: 'sv1', paciente_id: 'p_a', data_hora: '2026-01-01T08:00:00.000Z', fc_bpm: 70 });
  inserir('sinais_vitais', { id: 'sv2', paciente_id: 'p_a', data_hora: '2026-02-01T08:00:00.000Z', fc_bpm: 90 });
  inserir('pareceres_auditoria', { id: 'par1', paciente_id: 'p_a', auditor_id: 'g', auditor_nome: 'G', tipo_parecer: 'Conforme', descricao: 'ok', data_registro: '2026-01-05' });

  // p_b: plano vigente sem metas -> não conta como "tem plano"
  paciente('p_b', { complexidade: 'Alta', status: 'Internado' });
  inserir('planos_terapeuticos', { id: 'pln_b', paciente_id: 'p_b', data_inicio: inicioPlano, data_fim: fimPlano, status: 'Ativo', created_at: 'x', updated_at: 'x' });

  // p_c: sem nada
  paciente('p_c');
}

before(async () => {
  db = criarD1DeTeste();
  instalarContextoCloudflare(db);
  db.zerarIdas();
  // Schema já migrado: a sonda deve resolver em UMA ida, sem disparar DDL.
  await garantirSchemaD1(db);
  assert.equal(db.idas, 1, 'schema já aplicado deve custar só a sonda');
  popularBase();
});

beforeEach(() => db.zerarIdas());

test('listagem agregada: uma ida ao D1, independente do número de pacientes', async () => {
  const antes = await listarPacientesComResumoClinico();
  assert.equal(db.idas, 1);
  for (let i = 0; i < 40; i++) paciente(`extra_${i}`);
  db.zerarIdas();
  const depois = await listarPacientesComResumoClinico();
  assert.equal(db.idas, 1);
  assert.equal(depois.pacientes.length, antes.pacientes.length + 40);
});

test('listagem agregada: plano vigente idêntico ao cálculo unitário legado', async () => {
  const { planosVigentes } = await listarPacientesComResumoClinico();
  for (const id of ['p_a', 'p_b', 'p_c']) {
    const legado = await obterPlanoTerapeuticoVigente(id);
    assert.deepEqual(planosVigentes.get(id) ?? null, legado, `plano vigente divergente para ${id}`);
  }
});

test('listagem agregada: progresso do plano confere com o oráculo manual', async () => {
  const plano = (await listarPacientesComResumoClinico()).planosVigentes.get('p_a')!;
  assert.equal(plano.id, 'pln_a_vigente');
  assert.deepEqual(plano.metas!.map((m) => m.id), ['m3', 'm1', 'm2'], 'ordem de inserção das metas');
  const porId = Object.fromEntries(plano.metas!.map((m) => [m.id, m]));
  // Técnico: e1, e2 e e3 ("tecnico"); Médico: e4 ("Médico", no limite inferior); e5 fora da vigência.
  assert.equal(porId.m3.quantidade_realizada, 3);
  assert.equal(porId.m3.status_meta, 'Concluido');
  assert.deepEqual(porId.m3.profissionais_designados, [{ id: 'coop_1', nome: 'Ana' }]);
  assert.equal(porId.m1.quantidade_realizada, 1);
  // Dentista: e6 no limite superior exato conta; JSON quebrado de designados vira [].
  assert.equal(porId.m2.quantidade_realizada, 1);
  assert.deepEqual(porId.m2.profissionais_designados, []);
  assert.equal(plano.total_previsto, 6);
  assert.equal(plano.total_realizado, 5);
  assert.equal(plano.total_restante, 1);
});

test('listagem agregada: plano vigente sem metas fica visível, mas sem metas', async () => {
  const { planosVigentes } = await listarPacientesComResumoClinico();
  assert.equal(planosVigentes.get('p_b')?.metas?.length, 0);
  assert.equal(planosVigentes.has('p_c'), false);
});

test('listagem agregada: contadores clínicos vêm do D1 (não da memória do isolate)', async () => {
  const { pacientes } = await listarPacientesComResumoClinico();
  const a = pacientes.find((p) => p.id === 'p_a')!;
  assert.equal(a.total_prescricoes_ativas, 2);
  assert.equal(a.ultima_evolucao_data, `${fimPlano}T23:59:59.999Z`);
  assert.equal(a.ultimo_profissional_nome, 'Prof e6');
  // Mês corrente: e1 e e2 (e e3 se o mês atual for janeiro).
  const esperadasNoMes = [`${mes}-01T09:00:00.000Z`, `${hoje}T00:00:01.000Z`, `${anoAtual}-01-01T00:00:00.000Z`]
    .filter((c) => c.startsWith(mes)).length;
  assert.equal(a.visitas_realizadas_mes, esperadasNoMes);
  assert.equal(a.visitas_restantes_mes, Math.max(0, 4 - esperadasNoMes));
  assert.equal(a.limite_atingido, esperadasNoMes >= 4);
  assert.equal(a.ultimo_sinal_vital?.id, 'sv2');
  assert.equal('rn' in (a.ultimo_sinal_vital as any), false, 'coluna auxiliar da janela não pode vazar');

  const c = pacientes.find((p) => p.id === 'p_c')!;
  assert.equal(c.total_prescricoes_ativas, 0);
  assert.equal(c.ultima_evolucao_data, undefined);
  assert.equal(c.visitas_realizadas_mes, 0);
  assert.equal(c.visitas_restantes_mes, undefined);
  assert.equal(c.limite_atingido, false);
  assert.equal(c.ultimo_sinal_vital, null);
});

test('listagem agregada: filtros de status e complexidade', async () => {
  const altas = await listarPacientesComResumoClinico({ complexidade: 'Alta' });
  assert.deepEqual(altas.pacientes.map((p) => p.id), ['p_b']);
  const internados = await listarPacientesComResumoClinico({ status: 'Internado', complexidade: 'Alta' });
  assert.deepEqual(internados.pacientes.map((p) => p.id), ['p_b']);
  const nenhum = await listarPacientesComResumoClinico({ status: 'Alta' });
  assert.equal(nenhum.pacientes.length, 0);
  // O mapa de planos não depende do filtro: a rota o aplica também a pacientes do Bubble.
  assert.equal(nenhum.planosVigentes.has('p_a'), true);
});

test('prontuário 360: uma ida ao D1 e resultado idêntico à composição legada', async () => {
  const agregado = await carregarProntuario360('p_a');
  assert.equal(db.idas, 1);
  assert.ok(agregado);

  const [paciente, evolucoes, prescricoes, sinaisVitais, pareceres, planos] = await Promise.all([
    obterPacienteClinico('p_a'),
    listarEvolucoesClinicas({ paciente_id: 'p_a' }),
    listarPrescricoesClinicas('p_a', false),
    listarSinaisVitaisClinicos('p_a', 100),
    listarPareceresClinicos('p_a'),
    listarPlanosTerapeuticosPorPaciente('p_a'),
  ]);
  assert.ok(db.idas > 6, `composição legada deveria custar várias idas (custou ${db.idas})`);

  assert.deepEqual(agregado.paciente, paciente);
  assert.deepEqual(agregado.evolucoes, evolucoes);
  assert.deepEqual(agregado.prescricoes, prescricoes);
  assert.deepEqual(agregado.sinaisVitais, sinaisVitais);
  assert.deepEqual(agregado.pareceres, pareceres);
  assert.deepEqual(agregado.planos, planos);
  assert.equal(agregado.planoVigente?.id, 'pln_a_vigente');
  assert.deepEqual(agregado.planoVigente, await obterPlanoTerapeuticoVigente('p_a'));
});

test('prontuário 360: planos batem com o cálculo a partir das evoluções', async () => {
  const agregado = (await carregarProntuario360('p_a'))!;
  for (const plano of agregado.planos) {
    assert.deepEqual(plano, enriquecerPlanoComCalculos({ ...plano }, agregado.evolucoes));
  }
  assert.deepEqual(agregado.planos.map((p) => p.id), ['pln_a_vigente', 'pln_a_antigo', 'pln_a_concluido']);
});

test('prontuário 360: limite de sinais vitais é respeitado', async () => {
  const agregado = (await carregarProntuario360('p_a', { limiteSinais: 1 }))!;
  assert.deepEqual(agregado.sinaisVitais.map((s) => s.id), ['sv2']);
});

test('prontuário 360: paciente inexistente em D1, memória e Bubble devolve null', async () => {
  assert.equal(await carregarProntuario360('nao_existe'), null);
});

test('prontuário 360: paciente sem registros clínicos', async () => {
  const c = (await carregarProntuario360('p_c'))!;
  assert.equal(c.paciente.id, 'p_c');
  assert.deepEqual([c.evolucoes, c.prescricoes, c.sinaisVitais, c.pareceres, c.planos], [[], [], [], [], []]);
  assert.equal(c.planoVigente, null);
  assert.equal(c.paciente.visitas_realizadas_mes, 0);
});

test('listarPlanosTerapeuticosPorPaciente: uma ida ao D1 (antes 1 + N planos + 1)', async () => {
  const planos = await listarPlanosTerapeuticosPorPaciente('p_a');
  assert.equal(db.idas, 1);
  assert.equal(planos.length, 3);
});

test('memoizarComTtl: reaproveita valor resolvido, expira, invalida e não guarda falhas', async () => {
  let chamadas = 0;
  const carregar = async () => {
    chamadas++;
    return chamadas;
  };
  assert.equal(await memoizarComTtl('k', 50, carregar), 1);
  assert.equal(await memoizarComTtl('k', 50, carregar), 1);
  assert.equal(chamadas, 1);
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(await memoizarComTtl('k', 50, carregar), 2);
  invalidarCacheMemoria('k');
  assert.equal(await memoizarComTtl('k', 50, carregar), 3);

  // Promise em andamento NÃO é compartilhada entre chamadas (no Workers ela fica
  // presa ao contexto da requisição que a criou): cada chamada concorrente carrega.
  chamadas = 0;
  invalidarCacheMemoria('c');
  const [x, y] = await Promise.all([memoizarComTtl('c', 10_000, carregar), memoizarComTtl('c', 10_000, carregar)]);
  assert.equal(chamadas, 2);
  assert.notEqual(x, y);

  // Carga iniciada antes de uma invalidação não pode gravar dado possivelmente velho.
  let liberar!: () => void;
  const lenta = memoizarComTtl('s', 10_000, () => new Promise<string>((r) => { liberar = () => r('velho'); }));
  invalidarCacheMemoria('s');
  liberar();
  assert.equal(await lenta, 'velho');
  assert.equal(await memoizarComTtl('s', 10_000, async () => 'novo'), 'novo');

  let falhar = true;
  const instavel = async () => {
    if (falhar) throw new Error('fora do ar');
    return 'ok';
  };
  await assert.rejects(memoizarComTtl('f', 10_000, instavel));
  falhar = false;
  assert.equal(await memoizarComTtl('f', 10_000, instavel), 'ok');
});

test('equipamentos do paciente: filtra no Bubble e busca equipamentos por id', async () => {
  const originais = { getLocacoes: bubbleApi.getLocacoes, getEquipamento: bubbleApi.getEquipamento, getEquipamentos: bubbleApi.getEquipamentos };
  try {
    const constraintsRecebidas: unknown[] = [];
    bubbleApi.getLocacoes = (async (constraints?: unknown[]) => {
      constraintsRecebidas.push(constraints);
      // Simula Bubble devolvendo também uma locação de outro paciente: o filtro defensivo deve barrar.
      return [
        { _id: 'l1', fk_equipamento: 'eq1', fk_paciente: 'p_a', txt_status: 'Ativo', date_inicio: 'd', date_fim_previsto: 'f', num_valor_aluguel: 10 },
        { _id: 'l2', fk_equipamento: 'eq2', fk_paciente: 'outro', txt_status: 'Ativo', date_inicio: 'd', date_fim_previsto: 'f', num_valor_aluguel: 20 },
      ];
    }) as any;
    const pedidos: string[] = [];
    bubbleApi.getEquipamento = (async (id: string) => {
      pedidos.push(id);
      return { _id: id, txt_nome: 'Cama', txt_categoria: 'Mobiliário', txt_numero_serie: 'S1' };
    }) as any;
    bubbleApi.getEquipamentos = (async () => {
      throw new Error('não deveria varrer todos os equipamentos');
    }) as any;

    const lista = await listarEquipamentosDoPaciente('p_a');
    assert.deepEqual(constraintsRecebidas, [[{ key: 'fk_paciente', constraint_type: 'equals', value: 'p_a' }]]);
    assert.deepEqual(pedidos, ['eq1']);
    assert.deepEqual(lista, [{
      id: 'l1', equipamento_id: 'eq1', nome: 'Cama', categoria: 'Mobiliário', numero_serie: 'S1',
      status_locacao: 'Ativo', data_inicio: 'd', data_fim_previsto: 'f', valor_aluguel: 10,
    }]);

    // Bubble recusa a constraint: cai na varredura completa, ainda filtrando o paciente.
    let tentativa = 0;
    bubbleApi.getLocacoes = (async (constraints?: unknown[]) => {
      tentativa++;
      if (constraints) throw new Error('400 constraint inválida');
      return [{ _id: 'l9', fk_equipamento: 'eq9', fk_paciente: 'p_a', txt_status: 'Finalizado', date_inicio: 'd', date_fim_previsto: 'f', num_valor_aluguel: 1 }];
    }) as any;
    bubbleApi.getEquipamento = (async () => {
      throw new Error('equipamento removido');
    }) as any;
    const fallback = await listarEquipamentosDoPaciente('p_a');
    assert.equal(tentativa, 2);
    assert.equal(fallback.length, 1);
    assert.equal(fallback[0].nome, 'Equipamento Hospitalar', 'equipamento ausente usa o rótulo padrão de antes');

    bubbleApi.getLocacoes = (async () => []) as any;
    assert.deepEqual(await listarEquipamentosDoPaciente('p_c'), []);

    // Paciente que não existe no Bubble (só D1 / cadastro manual): a Data API
    // responde 400 "object with this id does not exist" (corpo real, conferido
    // contra o Bubble). Nenhuma locação pode apontar para ele: lista vazia, sem
    // a varredura completa.
    const erroIdInexistente = (id: string) =>
      new AxiosError('Request failed with status code 400', 'ERR_BAD_REQUEST', undefined, undefined, {
        status: 400,
        statusText: 'Bad Request',
        headers: {},
        config: {} as any,
        data: {
          statusCode: 400,
          body: { status: 'INVALID_DATA', message: `Invalid data for endpoint locacao_equipamento, key fk_paciente: object with this id does not exist: ${id}` },
        },
      });
    let chamadasLocacoes = 0;
    bubbleApi.getLocacoes = (async (constraints?: unknown[]) => {
      chamadasLocacoes++;
      if (!constraints) throw new Error('não deveria varrer todas as locações');
      throw erroIdInexistente('p_d1');
    }) as any;
    assert.deepEqual(await listarEquipamentosDoPaciente('p_d1'), []);
    assert.equal(chamadasLocacoes, 1);

    // Outro 400 (campo renomeado, por exemplo) continua caindo na varredura.
    chamadasLocacoes = 0;
    bubbleApi.getLocacoes = (async (constraints?: unknown[]) => {
      chamadasLocacoes++;
      if (constraints) {
        const e = erroIdInexistente('x');
        (e.response as any).data = { statusCode: 400, body: { status: 'INVALID_DATA', message: 'Unrecognized field: fk_paciente' } };
        throw e;
      }
      return [{ _id: 'l7', fk_equipamento: 'eq7', fk_paciente: 'p_a', txt_status: 'Ativo', date_inicio: 'd', date_fim_previsto: 'f', num_valor_aluguel: 1 }];
    }) as any;
    assert.equal((await listarEquipamentosDoPaciente('p_a')).length, 1);
    assert.equal(chamadasLocacoes, 2);
  } finally {
    Object.assign(bubbleApi, originais);
  }
});

test('linha do tempo (D1): evoluções trazem nome/CPF do paciente e filtros não ficam ambíguos', async () => {
  // `status` existe em evolucoes e pacientes: sem prefixo o SQLite recusaria a consulta.
  const lista = await listarEvolucoesClinicas({ status: 'Em_Andamento', especialidade: 'Tecnico_Enfermagem', limit: 100 });
  assert.equal(db.idas, 1);
  assert.deepEqual(lista.map((e) => e.id).sort(), ['e1', 'e2']);
  for (const ev of lista) {
    assert.equal(ev.paciente_nome, 'Paciente p_a');
    assert.equal(ev.paciente_cpf, undefined, 'CPF vazio não vira string vazia no payload');
  }
  // Evolução órfã (paciente removido): continua listada, só sem nome.
  db.sqlite.exec('PRAGMA foreign_keys = OFF');
  evolucao('e_orfa', 'p_inexistente', 'Medico', '2000-01-01T00:00:00.000Z');
  const todas = await listarEvolucoesClinicas({ limit: 500 });
  const orfa = todas.find((e) => e.id === 'e_orfa');
  assert.ok(orfa);
  assert.equal(orfa!.paciente_nome, undefined);
  db.sqlite.prepare('DELETE FROM evolucoes WHERE id = ?').run('e_orfa');
});

test('prontuário 360: paciente só no Bubble é auto-provisionado no D1', async () => {
  const original = bubbleApi.getPaciente;
  try {
    bubbleApi.getPaciente = (async (id: string) => ({ _id: id, txt_nome: 'Marcos Bubble', txt_cpf: '111', txt_endereco: 'Rua X', txt_whatsapp: '9' })) as any;
    const r = await carregarProntuario360('bub_novo');
    assert.ok(r);
    assert.equal(r!.paciente.id, 'bub_novo');
    assert.equal(r!.paciente.nome, 'Marcos Bubble');
    assert.deepEqual([r!.evolucoes, r!.prescricoes, r!.sinaisVitais, r!.pareceres, r!.planos], [[], [], [], [], []]);
    assert.equal(r!.planoVigente, null);
    assert.equal(r!.paciente.visitas_realizadas_mes, 0);
    const linha = db.sqlite.prepare('SELECT nome FROM pacientes WHERE id = ?').get('bub_novo') as any;
    assert.equal(linha?.nome, 'Marcos Bubble');
  } finally {
    bubbleApi.getPaciente = original;
  }
});

test('listagem agregada: vigência terminando/começando hoje e vários planos ativos batem com o legado', async () => {
  const ontem = new Date(Date.now() - 86_400_000).toISOString().split('T')[0];
  const amanha = new Date(Date.now() + 86_400_000).toISOString().split('T')[0];
  paciente('p_d');
  inserir('planos_terapeuticos', { id: 'pln_d_fim_hoje', paciente_id: 'p_d', data_inicio: ontem, data_fim: hoje, status: 'Ativo', created_at: 'x', updated_at: 'x' });
  inserir('plano_terapeutico_metas', { id: 'm_d1', plano_id: 'pln_d_fim_hoje', especialidade: 'Medico', quantidade_prevista: 2, profissionais_designados: '[]', created_at: 'x' });
  paciente('p_e');
  inserir('planos_terapeuticos', { id: 'pln_e_comeca_hoje', paciente_id: 'p_e', data_inicio: hoje, data_fim: amanha, status: 'Ativo', created_at: 'x', updated_at: 'x' });
  inserir('planos_terapeuticos', { id: 'pln_e_futuro', paciente_id: 'p_e', data_inicio: amanha, data_fim: amanha, status: 'Ativo', created_at: 'x', updated_at: 'x' });
  inserir('plano_terapeutico_metas', { id: 'm_e1', plano_id: 'pln_e_comeca_hoje', especialidade: 'Enfermeiro', quantidade_prevista: 1, profissionais_designados: '[]', created_at: 'x' });
  evolucao('e_e1', 'p_e', 'enfermagem', `${hoje}T00:00:00.000Z`);
  paciente('p_f');
  inserir('planos_terapeuticos', { id: 'pln_f_terminou_ontem', paciente_id: 'p_f', data_inicio: ontem, data_fim: ontem, status: 'Ativo', created_at: 'x', updated_at: 'x' });

  db.zerarIdas();
  const { planosVigentes } = await listarPacientesComResumoClinico();
  assert.equal(db.idas, 1);
  assert.equal(planosVigentes.get('p_d')?.id, 'pln_d_fim_hoje');
  assert.equal(planosVigentes.get('p_e')?.id, 'pln_e_comeca_hoje');
  assert.equal(planosVigentes.get('p_e')?.total_realizado, 1, '"enfermagem" normaliza para Enfermeiro');
  assert.equal(planosVigentes.has('p_f'), false);
  for (const id of ['p_d', 'p_e', 'p_f']) {
    assert.deepEqual(planosVigentes.get(id) ?? null, await obterPlanoTerapeuticoVigente(id), `divergência para ${id}`);
  }
});

/** Captura as instruções do próximo `db.batch` (para inspecionar SQL e plano de execução). */
function capturarProximoBatch(): { stmts: any[] } {
  const captura = { stmts: [] as any[] };
  const original = db.batch;
  db.batch = async (stmts: any[]) => {
    captura.stmts = stmts;
    db.batch = original;
    return original(stmts);
  };
  return captura;
}

function planoDeExecucao(stmt: any): string[] {
  return (db.sqlite.prepare(`EXPLAIN QUERY PLAN ${stmt.sql}`).all(...stmt.params) as any[]).map((r) => String(r.detail));
}

test('listagem agregada: última evolução/sinal por seek no índice, com paridade com a janela antiga', async () => {
  // Empates de horário: vence a linha inserida primeiro (rowid ASC, determinístico).
  paciente('p_empate', { status: 'Internado', complexidade: 'Alta' });
  evolucao('e_emp1', 'p_empate', 'Medico', '2001-01-01T10:00:00.000Z');
  evolucao('e_emp2', 'p_empate', 'Medico', '2001-01-01T10:00:00.000Z');
  evolucao('e_emp0', 'p_empate', 'Medico', '2000-12-31T10:00:00.000Z');
  inserir('sinais_vitais', { id: 'sv_emp1', paciente_id: 'p_empate', data_hora: '2001-01-01T08:00:00.000Z', fc_bpm: 60 });
  inserir('sinais_vitais', { id: 'sv_emp2', paciente_id: 'p_empate', data_hora: '2001-01-01T08:00:00.000Z', fc_bpm: 61 });
  try {
    db.zerarIdas();
    const captura = capturarProximoBatch();
    const { pacientes } = await listarPacientesComResumoClinico();
    assert.equal(db.idas, 1);

    // Oráculo: a consulta de janela antiga (varredura completa), sem empates.
    const ultEvoJanela = new Map(
      (db.sqlite.prepare(
        'SELECT paciente_id, check_in, profissional_nome FROM (SELECT paciente_id, check_in, profissional_nome, ' +
          'ROW_NUMBER() OVER (PARTITION BY paciente_id ORDER BY check_in DESC) AS rn FROM evolucoes WHERE check_in IS NOT NULL) WHERE rn = 1'
      ).all() as any[]).map((r) => [r.paciente_id, r])
    );
    const ultSinalJanela = new Map(
      (db.sqlite.prepare(
        'SELECT id, paciente_id FROM (SELECT sv.*, ROW_NUMBER() OVER (PARTITION BY sv.paciente_id ORDER BY sv.data_hora DESC) AS rn FROM sinais_vitais sv) WHERE rn = 1'
      ).all() as any[]).map((r) => [r.paciente_id, r])
    );
    for (const p of pacientes.filter((x) => x.id !== 'p_empate')) {
      const evo = ultEvoJanela.get(p.id);
      assert.equal(p.ultima_evolucao_data, evo?.check_in, `última evolução divergente para ${p.id}`);
      assert.equal(p.ultimo_profissional_nome, evo ? evo.profissional_nome || '' : undefined);
      assert.equal(p.ultimo_sinal_vital?.id ?? null, ultSinalJanela.get(p.id)?.id ?? null, `último sinal divergente para ${p.id}`);
    }

    const emp = pacientes.find((p) => p.id === 'p_empate')!;
    assert.equal(emp.ultima_evolucao_data, '2001-01-01T10:00:00.000Z');
    assert.equal(emp.ultimo_profissional_nome, 'Prof e_emp1', 'empate exato: vence a primeira inserida');
    assert.equal(emp.ultimo_sinal_vital?.id, 'sv_emp1');
    assert.equal(emp.ultimo_sinal_vital?.fc_bpm, 60);

    // Plano: as subconsultas fazem SEARCH por índice; nada de SCAN em
    // evolucoes/sinais_vitais nem B-tree temporária para ordenar por paciente.
    const [, , stmtUltEvo, , stmtSinal] = captura.stmts;
    for (const stmt of [stmtUltEvo, stmtSinal]) {
      const plano = planoDeExecucao(stmt);
      assert.ok(plano.some((d) => /SEARCH (e2|s2) USING .*INDEX idx_(evolucoes|sinais_vitais)_paciente/.test(d)), `sem seek por índice: ${plano.join(' | ')}`);
      assert.ok(!plano.some((d) => /^SCAN (e|e2|sv|s2|evolucoes|sinais_vitais)\b/.test(d)), `varredura completa: ${plano.join(' | ')}`);
      assert.ok(!plano.some((d) => /TEMP B-TREE/.test(d)), `ordenação extra: ${plano.join(' | ')}`);
    }

    // Filtros continuam valendo (a consulta é guiada pelos pacientes filtrados).
    const filtrados = await listarPacientesComResumoClinico({ status: 'Internado', complexidade: 'Alta' });
    assert.deepEqual(filtrados.pacientes.map((p) => p.id).sort(), ['p_b', 'p_empate']);
    assert.equal(filtrados.pacientes.find((p) => p.id === 'p_empate')!.ultimo_profissional_nome, 'Prof e_emp1');
  } finally {
    db.sqlite.prepare("DELETE FROM evolucoes WHERE paciente_id = 'p_empate'").run();
    db.sqlite.prepare("DELETE FROM sinais_vitais WHERE paciente_id = 'p_empate'").run();
    db.sqlite.prepare("DELETE FROM pacientes WHERE id = 'p_empate'").run();
  }
});

test('linha do tempo (projeção leve): mesma lista/ordem do payload completo, sem campos pesados, uma ida', async () => {
  const textoLongo = 'A'.repeat(LIMITE_RESUMO_EVOLUCAO + 300);
  evolucao('e_apz', 'p_a', 'Enfermeiro', '2000-01-01T08:00:00.000Z', {
    check_out: '2000-01-01T12:00:00.000Z',
    status: 'Finalizado',
    soap_avaliacao: textoLongo,
    transcricao_crua: 'B'.repeat(5000),
    audio_url: 'https://audio.invalid/x.webm',
  });
  // Atendimento ainda aberto (check_out vazio): limite superior é "agora".
  evolucao('e_aberta', 'p_a', 'Enfermeiro', '2000-02-01T08:00:00.000Z', { check_out: '', soap_avaliacao: '', transcricao_revisada: '' });
  inserir('prescricoes', { id: 'pr_b', paciente_id: 'p_b', medicamento: 'X', dosagem: '1', via_administracao: 'Oral', frequencia_horas: 8, data_inicio: hoje, data_fim: hoje, status: 'Ativa', horarios_padrao: '[]', created_at: '2026-01-01' });
  const aprazamento = (id: string, prescricao: string, executado: string | null, status: string) =>
    inserir('aprazamentos', { id, prescricao_id: prescricao, horario_previsto: '2000-01-01T08:00:00.000Z', horario_executado: executado, status });
  aprazamento('a_lim', 'pr3', '2000-01-01T08:00:00.000Z', 'Administrado'); // limite inferior exato; prescrição suspensa conta
  aprazamento('a_adm', 'pr1', '2000-01-01T09:00:00.000Z', 'Administrado');
  aprazamento('a_nao', 'pr2', '2000-01-01T10:00:00.000Z', 'Nao_Administrado');
  aprazamento('a_fora', 'pr1', '2000-01-01T13:00:00.000Z', 'Administrado'); // depois do check-out
  aprazamento('a_pend', 'pr1', null, 'Pendente'); // não executado
  aprazamento('a_vazio', 'pr1', '', 'Pendente'); // horário vazio
  aprazamento('a_outro', 'pr_b', '2000-01-01T09:30:00.000Z', 'Administrado'); // outro paciente
  aprazamento('a_aberta', 'pr1', '2000-02-01T09:00:00.000Z', 'Administrado');
  try {
    db.zerarIdas();
    const resumo = await listarEvolucoesResumo({ limit: 500 });
    assert.equal(db.idas, 1, 'projeção + contagem de aprazamentos num único batch');
    const completa = await listarEvolucoesClinicas({ limit: 500 });
    assert.deepEqual(resumo.map((e) => e.id), completa.map((e) => e.id), 'mesma lista e ordem');

    resumo.forEach((ev, i) => {
      const c = completa[i];
      for (const campo of ['paciente_id', 'paciente_nome', 'paciente_cpf', 'profissional_id', 'profissional_nome', 'tipo_profissional', 'turno', 'check_in', 'check_out', 'status', 'data_assinatura'] as const) {
        assert.deepEqual((ev as any)[campo], (c as any)[campo], `${ev.id}.${campo}`);
      }
      assert.equal(ev.resumo, (c.soap_avaliacao || c.transcricao_revisada || '').slice(0, LIMITE_RESUMO_EVOLUCAO) || undefined, `${ev.id}.resumo`);
      for (const pesado of ['transcricao_crua', 'transcricao_revisada', 'audio_url', 'soap_subjetivo', 'soap_objetivo', 'soap_avaliacao', 'soap_plano', 'assinatura_digital']) {
        assert.equal(pesado in ev, false, `${ev.id} não deveria trazer ${pesado}`);
      }
    });

    const porId = Object.fromEntries(resumo.map((e) => [e.id, e]));
    assert.equal(porId.e_apz.resumo!.length, LIMITE_RESUMO_EVOLUCAO);
    assert.deepEqual([porId.e_apz.aprazamentos_total, porId.e_apz.aprazamentos_administrados], [3, 2]);
    assert.deepEqual([porId.e_aberta.aprazamentos_total, porId.e_aberta.aprazamentos_administrados], [1, 1]);
    assert.equal(porId.e_aberta.resumo, undefined);
    assert.deepEqual([porId.e1.aprazamentos_total, porId.e1.aprazamentos_administrados], [0, 0]);
    assert.ok(JSON.stringify(porId.e_apz).length < 1000, 'item leve não carrega transcrição/áudio');

    // Filtros e limite idênticos aos do payload completo.
    const filtros = { especialidade: 'Enfermeiro', limit: 1 };
    assert.deepEqual((await listarEvolucoesResumo(filtros)).map((e) => e.id), (await listarEvolucoesClinicas(filtros)).map((e) => e.id));
    const filtrosData = { data_inicio: '2000-01-01', data_fim: '2000-01-31', limit: 100 };
    const soJaneiro = await listarEvolucoesResumo(filtrosData);
    assert.deepEqual(soJaneiro.map((e) => e.id), (await listarEvolucoesClinicas(filtrosData)).map((e) => e.id));
    assert.deepEqual(soJaneiro.map((e) => e.id), ['e_apz']);
    assert.equal(soJaneiro[0].aprazamentos_total, 3);
  } finally {
    db.sqlite.prepare("DELETE FROM aprazamentos WHERE id LIKE 'a\\_%' ESCAPE '\\'").run();
    db.sqlite.prepare("DELETE FROM evolucoes WHERE id IN ('e_apz', 'e_aberta')").run();
    db.sqlite.prepare("DELETE FROM prescricoes WHERE id = 'pr_b'").run();
  }
});

test('validarSessaoAtiva: cache em memória reduz round-trips ao D1 e invalida após revogação', async () => {
  const agoraSegundos = Math.floor(Date.now() / 1000);
  const sessaoId = 'sess_teste_cache_1';
  const usuarioId = 'usr_teste_cache_1';

  // Cria sessão ativa no D1
  inserir('auth_sessions', {
    id: sessaoId,
    user_id: usuarioId,
    area: 'gestor',
    expires_at: agoraSegundos + 3600,
    revoked_at: null,
  });

  try {
    invalidarSessaoMemoria(sessaoId);
    db.zerarIdas();

    // 1ª validação: deve ir ao D1 (miss)
    const ativo1 = await validarSessaoAtiva(sessaoId, usuarioId, agoraSegundos + 3600);
    assert.equal(ativo1, true, 'primeira validação deve retornar ativo');
    assert.equal(db.idas, 1, 'primeira validação consulta o D1');

    // 2ª validação: deve resolver no cache (hit)
    const ativo2 = await validarSessaoAtiva(sessaoId, usuarioId, agoraSegundos + 3600);
    assert.equal(ativo2, true, 'segunda validação deve retornar ativo');
    assert.equal(db.idas, 1, 'segunda validação NÃO deve ir ao D1 (cache em memória)');

    // Invalidação manual (ex: disparada no logout)
    invalidarSessaoMemoria(sessaoId);

    // 3ª validação após invalidação: deve ir novamente ao D1
    const ativo3 = await validarSessaoAtiva(sessaoId, usuarioId, agoraSegundos + 3600);
    assert.equal(ativo3, true, 'validação após invalidação deve funcionar se ativo no D1');
    assert.equal(db.idas, 2, 'terceira validação após invalidação consulta o D1');

    // Revoga a sessão no D1 (simulando revogação remota ou banco)
    db.sqlite.prepare('UPDATE auth_sessions SET revoked_at = ? WHERE id = ?').run(agoraSegundos, sessaoId);
    invalidarSessaoMemoria(sessaoId);

    // 4ª validação: sessão revogada deve retornar false
    const ativoRevogado = await validarSessaoAtiva(sessaoId, usuarioId, agoraSegundos + 3600);
    assert.equal(ativoRevogado, false, 'sessão revogada não pode ser válida');
    assert.equal(db.idas, 3, 'consulta ao D1 confirmou revogação');

    // Garante que resultado negativo não fica preso em cache positivo
    const ativoAindaRevogado = await validarSessaoAtiva(sessaoId, usuarioId, agoraSegundos + 3600);
    assert.equal(ativoAindaRevogado, false, 'sessão revogada continua inválida');
  } finally {
    invalidarSessaoMemoria(sessaoId);
    db.sqlite.prepare('DELETE FROM auth_sessions WHERE id = ?').run(sessaoId);
  }
});

test('listarAprazamentosParaAuditoria: 1 round-trip D1 com JOIN prescricoes e cálculo de desvios', async () => {
  paciente('p_auditoria_1', { nome: 'Paciente Auditoria 1', cpf: '111.222.333-44' });
  inserir('prescricoes', {
    id: 'pr_aud_1',
    paciente_id: 'p_auditoria_1',
    medicamento: 'Insulina NPH 100UI',
    dosagem: '20 UI SC',
    via_administracao: 'Subcutânea',
    frequencia_horas: 12,
    data_inicio: '2026-01-01',
    data_fim: '2026-12-31',
    status: 'Ativa',
    horarios_padrao: '["08:00", "20:00"]',
    created_at: '2026-01-01T00:00:00.000Z',
  });

  const agoraIso = new Date().toISOString();
  const tresHorasAtras = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
  const duasHorasAtras = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
  const futuroIso = new Date(Date.now() + 5 * 3600 * 1000).toISOString();

  // 1) Administrado pontual (Conforme)
  inserir('aprazamentos', {
    id: 'ap_conf_1',
    prescricao_id: 'pr_aud_1',
    horario_previsto: duasHorasAtras,
    horario_executado: duasHorasAtras,
    status: 'Administrado',
    justificativa: null,
    profissional_id: 'coop_aud_1',
  });

  // 2) Administrado com atraso crítico > 1h (Atraso)
  inserir('aprazamentos', {
    id: 'ap_atraso_1',
    prescricao_id: 'pr_aud_1',
    horario_previsto: tresHorasAtras,
    horario_executado: agoraIso,
    status: 'Administrado',
    justificativa: 'Demora no transporte de materiais',
    profissional_id: 'coop_aud_1',
  });

  // 3) Não administrado justificado (Omissao_Com_Justificativa)
  inserir('aprazamentos', {
    id: 'ap_omis_1',
    prescricao_id: 'pr_aud_1',
    horario_previsto: duasHorasAtras,
    horario_executado: null,
    status: 'Nao_Administrado',
    justificativa: 'Paciente recusou a medicação',
    profissional_id: 'coop_aud_1',
  });

  // 4) Pendente atrasado há > 1h (Pendente_Atrasado)
  inserir('aprazamentos', {
    id: 'ap_pend_1',
    prescricao_id: 'pr_aud_1',
    horario_previsto: tresHorasAtras,
    horario_executado: null,
    status: 'Pendente',
    justificativa: null,
  });

  // 5) Pendente futuro (Conforme)
  inserir('aprazamentos', {
    id: 'ap_fut_1',
    prescricao_id: 'pr_aud_1',
    horario_previsto: futuroIso,
    horario_executado: null,
    status: 'Pendente',
    justificativa: null,
  });

  // Vincula profissional na tabela de evoluções para checagem do COALESCE
  evolucao('evo_prof_aud', 'p_auditoria_1', 'Tecnico_Enfermagem', duasHorasAtras, {
    profissional_id: 'coop_aud_1',
    profissional_nome: 'Marcos Vinicius (Téc. Enfermagem)',
  });

  try {
    db.zerarIdas();
    const resultados = await listarAprazamentosParaAuditoria({
      paciente_id: 'p_auditoria_1',
      limit: 50,
    });

    assert.equal(db.idas, 1, 'consulta de reconciliação para auditoria deve executar em 1 única ida ao D1');
    assert.equal(resultados.length, 5, 'deve retornar todos os 5 aprazamentos do paciente');

    const porId = Object.fromEntries(resultados.map((r) => [r.id, r]));

    // Confere campos agregados
    assert.equal(porId.ap_conf_1.paciente_nome, 'Paciente Auditoria 1');
    assert.equal(porId.ap_conf_1.medicamento, 'Insulina NPH 100UI');
    assert.equal(porId.ap_conf_1.profissional_nome, 'Marcos Vinicius (Téc. Enfermagem)', 'COALESCE deve buscar nome do profissional');

    // Confere cálculos de desvio
    assert.equal(porId.ap_conf_1.tipoDesvio, 'Conforme');
    assert.equal(porId.ap_atraso_1.tipoDesvio, 'Atraso');
    assert.ok(porId.ap_atraso_1.detalheDesvio.includes('Atraso de'), 'deve indicar tempo de atraso');
    assert.equal(porId.ap_omis_1.tipoDesvio, 'Omissao_Com_Justificativa');
    assert.equal(porId.ap_omis_1.detalheDesvio, 'Paciente recusou a medicação');
    assert.equal(porId.ap_pend_1.tipoDesvio, 'Pendente_Atrasado');
    assert.equal(porId.ap_fut_1.tipoDesvio, 'Conforme');
    assert.equal(porId.ap_fut_1.detalheDesvio, 'Dentro da janela programada (pendente de administração)');

    // Confere paridade do cálculo isolado de desvio
    const calcPendente = calcularDesvioAprazamento({
      horario_previsto: new Date(Date.now() + 1800000).toISOString(),
      status: 'Pendente',
    });
    assert.equal(calcPendente.tipoDesvio, 'Conforme');
    assert.equal(calcPendente.detalheDesvio, 'Dentro da janela programada (pendente de administração)');

    const calcAdmin = calcularDesvioAprazamento({
      horario_previsto: new Date().toISOString(),
      horario_executado: new Date().toISOString(),
      status: 'Administrado',
    });
    assert.equal(calcAdmin.tipoDesvio, 'Conforme');
    assert.equal(calcAdmin.detalheDesvio, 'Administrado dentro da janela regulamentar');

    // Teste de filtro por status
    const apenasPendentes = await listarAprazamentosParaAuditoria({
      paciente_id: 'p_auditoria_1',
      status: 'Pendente',
    });
    assert.equal(apenasPendentes.length, 2);
    assert.ok(apenasPendentes.every((a) => a.status === 'Pendente'));
  } finally {
    db.sqlite.prepare("DELETE FROM aprazamentos WHERE id LIKE 'ap\\_%' ESCAPE '\\'").run();
    db.sqlite.prepare("DELETE FROM evolucoes WHERE id = 'evo_prof_aud'").run();
    db.sqlite.prepare("DELETE FROM prescricoes WHERE id = 'pr_aud_1'").run();
    db.sqlite.prepare("DELETE FROM pacientes WHERE id = 'p_auditoria_1'").run();
  }
});

test('cache-navegacao: leitura rápida, detecção de stale, expiração máxima e invalidação', () => {
  const chave = 'teste_navegacao_pacientes';
  invalidarCacheNavegacao(chave);

  // Sem cache
  assert.equal(lerCacheNavegacao(chave), null, 'cache vazio retorna null');

  // Grava dado
  const dados = [{ id: 'p_10', nome: 'Paciente 10' }];
  gravarCacheNavegacao(chave, dados);

  // Leitura fresca
  const lido = lerCacheNavegacao<typeof dados>(chave, 10_000, 60_000);
  assert.ok(lido, 'deve encontrar dado no cache');
  assert.deepEqual(lido.data, dados);
  assert.equal(lido.isStale, false, 'dado recém gravado não é stale');

  // Simula dado stale (ttlFrescoMs = 0)
  const lidoStale = lerCacheNavegacao<typeof dados>(chave, 0, 60_000);
  assert.ok(lidoStale);
  assert.equal(lidoStale.isStale, true, 'dado além do ttl fresco é marcado como stale');
  assert.deepEqual(lidoStale.data, dados, 'dado stale continua disponível para render instantâneo');

  // Invalidação por prefixo
  gravarCacheNavegacao('prefixo_teste_1', { a: 1 });
  gravarCacheNavegacao('prefixo_teste_2', { b: 2 });
  gravarCacheNavegacao('outro_prefixo', { c: 3 });
  invalidarCacheNavegacaoPorPrefixo('prefixo_teste_');
  assert.equal(lerCacheNavegacao('prefixo_teste_1'), null, 'prefixo 1 deve ter sido invalidado');
  assert.equal(lerCacheNavegacao('prefixo_teste_2'), null, 'prefixo 2 deve ter sido invalidado');
  assert.ok(lerCacheNavegacao('outro_prefixo'), 'outro prefixo não deve ser afetado');

  // Invalidação individual
  invalidarCacheNavegacao(chave);
  assert.equal(lerCacheNavegacao(chave), null, 'após invalidação retorna null');
});

test('sincronizarPacientesBubbleParaD1: replica base do Bubble para D1 em batch preservando dados clínicos locais', async () => {
  // Prepara paciente existente no D1 com dados clínicos enriquecidos
  paciente('pac_sync_1', {
    nome: 'Nome Antigo',
    cpf: '111.111.111-11',
    diagnostico_principal: 'AVC Isquêmico com Hemiparesia',
    complexidade: 'Alta',
    plano_saude: 'Bradesco Saúde',
    numero_carteirinha: 'CARD-12345',
    status: 'Internado',
    limite_visitas_mes: 20,
  });

  const mockBubblePacientes = [
    {
      _id: 'pac_sync_1',
      txt_nome: 'Nome Atualizado no Bubble',
      txt_cpf: '111.111.111-11',
      txt_whatsapp: '11988887777',
      txt_endereco: 'Av. Paulista, 1000',
      txt_email: '',
      txt_tipo: 'Homecare' as const,
      fks_equipamentos: ['eq_1'],
      fks_locacoes: [],
      CreatedDate: '2026-01-01T00:00:00.000Z',
    },
    {
      _id: 'pac_sync_novo',
      txt_nome: 'Novo Paciente Bubble',
      txt_cpf: '222.222.222-22',
      txt_whatsapp: '11977776666',
      txt_endereco: 'Rua Augusta, 500',
      txt_email: '',
      txt_tipo: 'Homecare' as const,
      fks_equipamentos: [],
      fks_locacoes: [],
      CreatedDate: '2026-02-01T00:00:00.000Z',
    },
  ];

  db.zerarIdas();
  const resultado = await sincronizarPacientesBubbleParaD1({
    db,
    pacientesMock: mockBubblePacientes,
  });

  assert.equal(resultado.totalBubble, 2);
  assert.equal(resultado.sincronizados, 2);
  assert.equal(resultado.erros.length, 0);

  // Confere que o paciente existente teve nome e contato atualizados, mas manteve diagnóstico, complexidade, etc.
  const row1 = db.sqlite.prepare('SELECT * FROM pacientes WHERE id = ?').get('pac_sync_1') as any;
  assert.equal(row1.nome, 'Nome Atualizado no Bubble');
  assert.equal(row1.telefone, '11988887777');
  assert.equal(row1.endereco, 'Av. Paulista, 1000');
  assert.equal(row1.diagnostico_principal, 'AVC Isquêmico com Hemiparesia', 'diagnóstico clínico D1 deve ser preservado');
  assert.equal(row1.complexidade, 'Alta', 'complexidade clínica D1 deve ser preservada');
  assert.equal(row1.plano_saude, 'Bradesco Saúde', 'plano de saúde D1 deve ser preservado');
  assert.equal(row1.numero_carteirinha, 'CARD-12345');
  assert.equal(row1.status, 'Internado', 'status clínico D1 deve ser preservado');
  assert.equal(row1.limite_visitas_mes, 20, 'cota de visitas D1 deve ser preservada');

  // Confere que o novo paciente foi inserido corretamente
  const rowNovo = db.sqlite.prepare('SELECT * FROM pacientes WHERE id = ?').get('pac_sync_novo') as any;
  assert.ok(rowNovo, 'novo paciente deve existir no D1');
  assert.equal(rowNovo.nome, 'Novo Paciente Bubble');
  assert.equal(rowNovo.cpf, '222.222.222-22');
  assert.equal(rowNovo.status, 'Ativo');
});

test('listagem agregada: paginação escalável via batch único D1', async () => {
  for (let i = 1; i <= 25; i++) {
    const padded = String(i).padStart(2, '0');
    paciente(`pag_${padded}`, {
      nome: `Paciente Paginado ${padded}`,
      complexidade: i % 2 === 0 ? 'Alta' : 'Baixa',
      status: 'Ativo',
    });
  }

  db.zerarIdas();
  // Página 1 com limite 10
  const pagina1 = await listarPacientesComResumoClinico({
    busca: 'Paginado',
    page: 1,
    limit: 10,
  });
  assert.equal(db.idas, 1, 'paginação deve rodar em EXATAMENTE 1 round-trip no D1');
  assert.equal(pagina1.total, 25, 'total deve refletir a quantidade de registros do filtro');
  assert.equal(pagina1.totalPages, 3, '25 itens com limite 10 = 3 páginas');
  assert.equal(pagina1.page, 1);
  assert.equal(pagina1.limit, 10);
  assert.equal(pagina1.pacientes.length, 10);
  assert.equal(pagina1.pacientes[0].nome, 'Paciente Paginado 01');
  assert.equal(pagina1.pacientes[9].nome, 'Paciente Paginado 10');

  db.zerarIdas();
  // Página 2 com limite 10
  const pagina2 = await listarPacientesComResumoClinico({
    busca: 'Paginado',
    page: 2,
    limit: 10,
  });
  assert.equal(db.idas, 1);
  assert.equal(pagina2.pacientes.length, 10);
  assert.equal(pagina2.pacientes[0].nome, 'Paciente Paginado 11');
  assert.equal(pagina2.pacientes[9].nome, 'Paciente Paginado 20');

  db.zerarIdas();
  // Página 3 (última página com 5 itens restantes)
  const pagina3 = await listarPacientesComResumoClinico({
    busca: 'Paginado',
    page: 3,
    limit: 10,
  });
  assert.equal(db.idas, 1);
  assert.equal(pagina3.pacientes.length, 5);
  assert.equal(pagina3.pacientes[0].nome, 'Paciente Paginado 21');
  assert.equal(pagina3.pacientes[4].nome, 'Paciente Paginado 25');

  // Página além do limite: retorna array vazio com total e totalPages preservados
  const paginaVazia = await listarPacientesComResumoClinico({
    busca: 'Paginado',
    page: 99,
    limit: 10,
  });
  assert.equal(paginaVazia.pacientes.length, 0);
  assert.equal(paginaVazia.total, 25);
  assert.equal(paginaVazia.totalPages, 3);
});

test('listagem agregada: busca textual combinada com filtros', async () => {
  paciente('p_busca_1', { nome: 'Carlos Drumond', cpf: '333.444.555-66', diagnostico_principal: 'Hipertensão', complexidade: 'Baixa' });
  paciente('p_busca_2', { nome: 'Maria Clara', cpf: '777.888.999-00', diagnostico_principal: 'Diabetes Tipo 2', complexidade: 'Alta' });

  // Busca por nome (case insensitive)
  const porNome = await listarPacientesComResumoClinico({ busca: 'drumond' });
  assert.ok(porNome.pacientes.some((p) => p.id === 'p_busca_1'));
  assert.ok(!porNome.pacientes.some((p) => p.id === 'p_busca_2'));

  // Busca por CPF
  const porCpf = await listarPacientesComResumoClinico({ busca: '888.999' });
  assert.ok(porCpf.pacientes.some((p) => p.id === 'p_busca_2'));
  assert.ok(!porCpf.pacientes.some((p) => p.id === 'p_busca_1'));

  // Busca por diagnóstico
  const porDiag = await listarPacientesComResumoClinico({ busca: 'diabetes' });
  assert.ok(porDiag.pacientes.some((p) => p.id === 'p_busca_2'));

  // Busca combinada com filtro de complexidade
  const combinada = await listarPacientesComResumoClinico({ busca: 'Carlos', complexidade: 'Alta' });
  assert.equal(combinada.pacientes.length, 0, 'Carlos é de complexidade Baixa, não deve casar com Alta');
});

test('otimização de prescrições ativas: usa índice idx_prescricoes_paciente_status e confere valores', async () => {
  paciente('p_presc_test');
  inserir('prescricoes', { id: 'pr_t1', paciente_id: 'p_presc_test', medicamento: 'M1', dosagem: '1', via_administracao: 'Oral', frequencia_horas: 12, data_inicio: hoje, data_fim: hoje, status: 'Ativa' });
  inserir('prescricoes', { id: 'pr_t2', paciente_id: 'p_presc_test', medicamento: 'M2', dosagem: '1', via_administracao: 'Oral', frequencia_horas: 8, data_inicio: hoje, data_fim: hoje, status: 'Ativa' });
  inserir('prescricoes', { id: 'pr_t3', paciente_id: 'p_presc_test', medicamento: 'M3', dosagem: '1', via_administracao: 'Oral', frequencia_horas: 24, data_inicio: hoje, data_fim: hoje, status: 'Suspensa' });

  // Confere que a contagem agregada calculada bate exatamente com 2
  const res = await listarPacientesComResumoClinico({ busca: 'p_presc_test' });
  const p = res.pacientes.find((item) => item.id === 'p_presc_test');
  assert.ok(p);
  assert.equal(p.total_prescricoes_ativas, 2);

  // Confere o plano de execução: busca deve usar o covering index composto
  const plan = db.sqlite.prepare(
    "EXPLAIN QUERY PLAN SELECT (SELECT COUNT(*) FROM prescricoes pr WHERE pr.paciente_id = 'p_presc_test' AND pr.status = 'Ativa')"
  ).all() as any[];
  const coveringSearch = plan.some((step) =>
    (step.detail || '').includes('idx_prescricoes_paciente_status') && (step.detail || '').includes('COVERING INDEX')
  );
  assert.ok(coveringSearch, 'contagem de prescrições ativas deve usar o covering index idx_prescricoes_paciente_status');
});

test('rota /api/cron/sync-pacientes-bubble: autorização por segredo CRON_SECRET e execução', async () => {
  const segredoOriginal = process.env.CRON_SECRET;
  process.env.CRON_SECRET = 'segredo_teste_cron_123';

  try {
    // Chamada sem autenticação -> 401
    const reqNaoAuth = new NextRequest('http://localhost/api/cron/sync-pacientes-bubble', { method: 'POST' });
    const resNaoAuth = await cronSyncPost(reqNaoAuth);
    assert.equal(resNaoAuth.status, 401);

    // Chamada com Bearer errado -> 401
    const reqTokenErrado = new NextRequest('http://localhost/api/cron/sync-pacientes-bubble', {
      method: 'POST',
      headers: { Authorization: 'Bearer token_invalido' },
    });
    const resTokenErrado = await cronSyncPost(reqTokenErrado);
    assert.equal(resTokenErrado.status, 401);

    // Mock do getPacientes do bubbleApi
    const getPacientesOriginal = bubbleApi.getPacientes;
    bubbleApi.getPacientes = async () => [
      {
        _id: 'pac_cron_api_1',
        txt_nome: 'Paciente Criado Via Cron Route',
        txt_cpf: '999.888.777-66',
        txt_whatsapp: '1199998888',
        txt_endereco: 'Rua do Cron, 100',
        txt_email: '',
        txt_tipo: 'Homecare' as const,
        fks_equipamentos: [],
        fks_locacoes: [],
        CreatedDate: '2026-03-01T00:00:00.000Z',
      },
    ];

    try {
      // Chamada autorizada com Bearer correto -> 200
      const reqAuth = new NextRequest('http://localhost/api/cron/sync-pacientes-bubble', {
        method: 'POST',
        headers: { Authorization: 'Bearer segredo_teste_cron_123' },
      });
      const resAuth = await cronSyncPost(reqAuth);
      assert.equal(resAuth.status, 200);
      const corpo = (await resAuth.json()) as any;
      assert.equal(corpo.success, true);
      assert.equal(corpo.data.totalBubble, 1);
      assert.equal(corpo.data.sincronizados, 1);

      // Confere inserção no D1
      const pSalvo = db.sqlite.prepare('SELECT * FROM pacientes WHERE id = ?').get('pac_cron_api_1') as any;
      assert.ok(pSalvo);
      assert.equal(pSalvo.nome, 'Paciente Criado Via Cron Route');
      assert.equal(pSalvo.cpf, '999.888.777-66');
      assert.equal(pSalvo.endereco, 'Rua do Cron, 100');
    } finally {
      bubbleApi.getPacientes = getPacientesOriginal;
    }
  } finally {
    process.env.CRON_SECRET = segredoOriginal;
  }
});

test('sincronizarPacientesBubbleParaD1 (in-memory): preserva dados clínicos locais sem D1', async () => {
  // Paciente pré-existente na memória com dados clínicos
  inMemoryPacientes.set('pac_mem_sync_1', {
    id: 'pac_mem_sync_1',
    nome: 'Nome Antigo Memória',
    cpf: '555.666.777-88',
    diagnostico_principal: 'Sequela de TCE Grave',
    complexidade: 'Alta',
    plano_saude: 'Amil Blue',
    numero_carteirinha: 'CARTEIRA-MEM-99',
    status: 'Internado',
    limite_visitas_mes: 25,
    warnings: ['Alergia a Morfina'],
  });

  const mockBubble = [
    {
      _id: 'pac_mem_sync_1',
      txt_nome: 'Nome Atualizado no Bubble',
      txt_cpf: '',
      txt_whatsapp: '11911112222',
      txt_endereco: 'Alameda Santos, 200',
      txt_email: '',
      txt_tipo: 'Homecare' as const,
      fks_equipamentos: ['eq_oxigenio'],
      fks_locacoes: [],
      CreatedDate: '2026-04-01T00:00:00.000Z',
    },
  ];

  const resultado = await sincronizarPacientesBubbleParaD1({
    db: null,
    pacientesMock: mockBubble,
  });

  assert.equal(resultado.totalBubble, 1);
  assert.equal(resultado.sincronizados, 1);

  const salvoMemoria = inMemoryPacientes.get('pac_mem_sync_1');
  assert.ok(salvoMemoria);
  assert.equal(salvoMemoria.nome, 'Nome Atualizado no Bubble');
  assert.equal(salvoMemoria.cpf, '555.666.777-88', 'CPF não informado no Bubble deve preservar o existente');
  assert.equal(salvoMemoria.telefone, '11911112222');
  assert.equal(salvoMemoria.endereco, 'Alameda Santos, 200');
  assert.equal(salvoMemoria.diagnostico_principal, 'Sequela de TCE Grave', 'diagnóstico clínico em memória deve ser preservado');
  assert.equal(salvoMemoria.complexidade, 'Alta', 'complexidade clínica em memória deve ser preservada');
  assert.equal(salvoMemoria.plano_saude, 'Amil Blue', 'plano de saúde em memória deve ser preservado');
  assert.equal(salvoMemoria.numero_carteirinha, 'CARTEIRA-MEM-99');
  assert.equal(salvoMemoria.status, 'Internado', 'status em memória deve ser preservado');
  assert.equal(salvoMemoria.limite_visitas_mes, 25, 'cota de visitas em memória deve ser preservada');
  assert.ok(salvoMemoria.warnings?.includes('Alergia a Morfina'), 'alertas clínicos pré-existentes devem ser preservados');
  assert.ok(salvoMemoria.warnings?.includes('Possui equipamentos em casa'), 'deve agregar alerta de equipamentos do Bubble');
});

test('sincronizarPacientesBubbleParaD1 (D1): não sobrescreve nome preenchido se o Bubble vier vazio ou Paciente sem Nome', async () => {
  paciente('pac_nome_preservado', {
    nome: 'Dona Francisca de Paula',
    cpf: '888.777.666-55',
  });

  const mockBubbleSemNome = [
    {
      _id: 'pac_nome_preservado',
      txt_nome: '', // vazio no Bubble
      txt_cpf: '',
      txt_whatsapp: '11944445555',
      txt_endereco: '',
      txt_email: '',
      txt_tipo: 'Homecare' as const,
      fks_equipamentos: [],
      fks_locacoes: [],
    },
  ];

  await sincronizarPacientesBubbleParaD1({
    db,
    pacientesMock: mockBubbleSemNome,
  });

  const row = db.sqlite.prepare('SELECT * FROM pacientes WHERE id = ?').get('pac_nome_preservado') as any;
  assert.ok(row);
  assert.equal(row.nome, 'Dona Francisca de Paula', 'nome preenchido no D1 não pode virar Paciente sem Nome');
  assert.equal(row.telefone, '11944445555', 'telefone novo deve ser atualizado');
});

test('rota /api/gestor/prontuarios/pacientes: sanitiza page e limit inválidos/NaN', async () => {
  const reqInvalido = new NextRequest(
    'http://localhost/api/gestor/prontuarios/pacientes?page=abc&limit=-10',
    {
      headers: {
        Authorization: 'Bearer user-e2e-gestor',
      },
    }
  );

  const res = await gestorPacientesGet(reqInvalido);
  assert.equal(res.status, 200);
  const json = (await res.json()) as any;
  assert.equal(json.success, true);
  assert.equal(typeof json.page, 'number', 'page não pode ser NaN ou null');
  assert.equal(json.page, 1, 'page inválida deve cair no default 1');
  assert.equal(typeof json.limit, 'number', 'limit não pode ser NaN ou null');
  assert.ok(json.limit >= 1, 'limit deve ser número válido');
});

test('listagem agregada: ordenação determinística com tiebreaker id mesmo com nomes idênticos', async () => {
  // Dois pacientes com o mesmo nome exato
  paciente('p_gemeo_b', { nome: 'Ana Maria Ferreira', status: 'Ativo' });
  paciente('p_gemeo_a', { nome: 'Ana Maria Ferreira', status: 'Ativo' });

  const p1 = await listarPacientesComResumoClinico({
    busca: 'Ana Maria Ferreira',
    page: 1,
    limit: 1,
  });
  const p2 = await listarPacientesComResumoClinico({
    busca: 'Ana Maria Ferreira',
    page: 2,
    limit: 1,
  });

  assert.equal(p1.pacientes.length, 1);
  assert.equal(p2.pacientes.length, 1);
  // O tiebreaker id ASC garante que p_gemeo_a vem na página 1 e p_gemeo_b na página 2
  assert.equal(p1.pacientes[0].id, 'p_gemeo_a', 'primeiro paciente por tiebreaker id');
  assert.equal(p2.pacientes[0].id, 'p_gemeo_b', 'segundo paciente por tiebreaker id');
});


