import { urlBaseBubble } from './bubble';

export interface RelatorioPagamentoMensalBubble {
  _id: string;
  Escalas?: string[];
  'Local de trabalho'?: string;
  'Mês ref'?: string;
  'sub relatórios'?: string[];
  'data da sincronia'?: string;
  'em sincronia'?: boolean;
  'Created Date'?: string;
  'Created By'?: string;
}

export interface SubRelatorioPagamentoBubble {
  _id: string;
  txt_nome?: string;
  fk_cooperado?: string;
  fk_relatorio?: string;
  fks_servicos?: string[];
  num_valor_bruto?: number;
  num_inss?: number;
  num_valor_liquido?: number;
}

export interface ServicoEscalaBubble {
  _id: string;
  fk_escala?: string;
  fk_cooperado?: string;
  num_valor_cooperado?: number;
  bool_confirmacao_finalizado?: boolean;
  opt_status?: string;
}

export interface CooperadoResumoBubble {
  _id: string;
  txt_nomeCompleto?: string;
  txt_nome?: string;
}

export interface SincronizarRelatoriosOpcoes {
  /** Sincroniza um relatório específico (`f-relatoriodepagamentomensal._id`). */
  relatorioId?: string;
  /** Quando `true`, limpa e recria os sub-relatórios mesmo que já existam. */
  forcar?: boolean;
  /** Quantidade máxima de relatórios recentes avaliados quando `relatorioId` não é informado. */
  limiteRelatorios?: number;
}

export interface DetalheSyncRelatorio {
  relatorioId: string;
  escalasIds: string[];
  totalServicos: number;
  cooperados: number;
  subRelatoriosCriados: number;
  subRelatoriosReutilizados: number;
  subRelatoriosRemovidos: number;
  subRelatorioIds: string[];
  status:
    | 'sincronizado'
    | 'ignorado_sem_escalas'
    | 'ignorado_sem_servicos'
    | 'ja_sincronizado'
    | 'erro';
  erro?: string;
}

export interface ResultadoSyncRelatoriosPagamento {
  avaliados: number;
  sincronizados: number;
  subRelatoriosCriados: number;
  subRelatoriosReutilizados: number;
  ignorados: number;
  erros: Array<{ relatorioId: string; erro: string }>;
  detalhes: DetalheSyncRelatorio[];
}

interface BubbleListResponse<T> {
  response?: {
    results?: T[];
    remaining?: number;
    count?: number;
  };
}

interface BubbleCreateResponse {
  id?: string;
  response?: { id?: string };
}

function obterConfigBubble(): { baseUrl: string; token: string } {
  const baseUrl = urlBaseBubble().replace(/\/+$/, '');
  const token = process.env.BUBBLE_API_TOKEN;
  if (!token) {
    throw new Error('BUBBLE_API_TOKEN não está definida para sincronizar relatórios no Bubble.');
  }
  return { baseUrl, token };
}

async function bubbleFetchJson<T>(
  path: string,
  init: RequestInit = {},
  opcoes: { aceitar404?: boolean } = {}
): Promise<T | null> {
  const { baseUrl, token } = obterConfigBubble();
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
    signal: init.signal ?? AbortSignal.timeout(25_000),
  });

  if (opcoes.aceitar404 && res.status === 404) {
    return null;
  }

  const texto = await res.text();
  if (!res.ok) {
    throw new Error(`Bubble ${init.method || 'GET'} ${path} falhou (${res.status}): ${texto.slice(0, 300)}`);
  }

  if (!texto) return null;
  return JSON.parse(texto) as T;
}

async function bubbleFetchAll<T>(
  endpoint: string,
  constraints?: unknown[],
  opcoes: { sortField?: string; descending?: boolean; maxItems?: number } = {}
): Promise<T[]> {
  const out: T[] = [];
  let cursor = 0;

  while (true) {
    const restanteLimite = opcoes.maxItems ? opcoes.maxItems - out.length : 100;
    if (restanteLimite <= 0) break;
    const limit = Math.min(100, restanteLimite);

    const qs = new URLSearchParams({
      limit: String(limit),
      cursor: String(cursor),
    });
    if (constraints && constraints.length > 0) {
      qs.set('constraints', JSON.stringify(constraints));
    }
    if (opcoes.sortField) {
      qs.set('sort_field', opcoes.sortField);
    }
    if (typeof opcoes.descending === 'boolean') {
      qs.set('descending', String(opcoes.descending));
    }

    const data = await bubbleFetchJson<BubbleListResponse<T>>(`${endpoint}?${qs.toString()}`);
    const pageResults = data?.response?.results || [];
    const remaining = data?.response?.remaining || 0;
    out.push(...pageResults);

    if (pageResults.length === 0 || remaining === 0 || (opcoes.maxItems && out.length >= opcoes.maxItems)) {
      break;
    }
    cursor += pageResults.length;
  }

  return out;
}

async function executarEmLotes<T, R>(
  itens: T[],
  tamanhoLote: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const resultados: R[] = [];
  for (let i = 0; i < itens.length; i += tamanhoLote) {
    const fatia = itens.slice(i, i + tamanhoLote);
    const parciais = await Promise.all(fatia.map(worker));
    resultados.push(...parciais);
  }
  return resultados;
}

function conjuntosIguais(a: string[] | undefined, b: string[]): boolean {
  const listaA = Array.isArray(a) ? a : [];
  if (listaA.length !== b.length) return false;
  const setA = new Set(listaA);
  if (setA.size !== b.length) return false;
  return b.every((item) => setA.has(item));
}

function arredondarValor(valor: number): number {
  return Number((valor + Number.EPSILON).toFixed(4));
}

function arredondarMoeda4(valor: number): number {
  return Number(valor.toFixed(4));
}

async function resolverNomeCooperado(
  cooperadoId: string,
  cacheNomes: Map<string, string>
): Promise<string> {
  const emCache = cacheNomes.get(cooperadoId);
  if (emCache !== undefined) return emCache;

  const resp = await bubbleFetchJson<{ response?: CooperadoResumoBubble }>(
    `/obj/socioscooperados/${encodeURIComponent(cooperadoId)}`,
    {},
    { aceitar404: true }
  );
  const nome = String(resp?.response?.txt_nomeCompleto || resp?.response?.txt_nome || 'Cooperado');
  cacheNomes.set(cooperadoId, nome);
  return nome;
}

async function apagarSubRelatorioSeguro(subId: string): Promise<boolean> {
  await bubbleFetchJson(
    `/obj/f_subrelatorio_pagamento/${encodeURIComponent(subId)}`,
    { method: 'DELETE' },
    { aceitar404: true }
  );
  return true;
}

interface GrupoCooperadoCalculado {
  cooperadoId: string;
  nomeCooperado: string;
  servicoIds: string[];
  valorBruto: number;
  valorInss: number;
  valorLiquido: number;
}

async function sincronizarUmRelatorio(
  relatorio: RelatorioPagamentoMensalBubble,
  forcar: boolean,
  cacheNomes: Map<string, string>
): Promise<DetalheSyncRelatorio> {
  const relatorioId = relatorio._id;
  const escalasIds = Array.isArray(relatorio.Escalas)
    ? relatorio.Escalas.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
    : [];
  const subsExistentesNoPai = Array.isArray(relatorio['sub relatórios'])
    ? relatorio['sub relatórios'].filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
    : [];

  if (!forcar && subsExistentesNoPai.length > 0) {
    return {
      relatorioId,
      escalasIds,
      totalServicos: 0,
      cooperados: subsExistentesNoPai.length,
      subRelatoriosCriados: 0,
      subRelatoriosReutilizados: subsExistentesNoPai.length,
      subRelatoriosRemovidos: 0,
      subRelatorioIds: subsExistentesNoPai,
      status: 'ja_sincronizado',
    };
  }

  if (escalasIds.length === 0) {
    return {
      relatorioId,
      escalasIds: [],
      totalServicos: 0,
      cooperados: 0,
      subRelatoriosCriados: 0,
      subRelatoriosReutilizados: 0,
      subRelatoriosRemovidos: 0,
      subRelatorioIds: [],
      status: 'ignorado_sem_escalas',
    };
  }

  const constraintEscala =
    escalasIds.length === 1
      ? [{ key: 'fk_escala', constraint_type: 'equals', value: escalasIds[0] }]
      : [{ key: 'fk_escala', constraint_type: 'in', value: escalasIds }];

  const servicos = await bubbleFetchAll<ServicoEscalaBubble>('/obj/servicos', constraintEscala);

  const porCooperado = new Map<string, ServicoEscalaBubble[]>();
  for (const srv of servicos) {
    const coopId = typeof srv.fk_cooperado === 'string' ? srv.fk_cooperado.trim() : '';
    if (!coopId || !srv._id) continue;
    const lista = porCooperado.get(coopId) || [];
    lista.push(srv);
    porCooperado.set(coopId, lista);
  }

  if (porCooperado.size === 0) {
    return {
      relatorioId,
      escalasIds,
      totalServicos: servicos.length,
      cooperados: 0,
      subRelatoriosCriados: 0,
      subRelatoriosReutilizados: 0,
      subRelatoriosRemovidos: 0,
      subRelatorioIds: [],
      status: 'ignorado_sem_servicos',
    };
  }

  const coopIds = Array.from(porCooperado.keys());
  await executarEmLotes(coopIds, 8, (coopId) => resolverNomeCooperado(coopId, cacheNomes));

  const grupos: GrupoCooperadoCalculado[] = coopIds.map((coopId) => {
    const srvs = porCooperado.get(coopId) || [];
    const somaBruta = srvs.reduce((acc, s) => acc + Number(s.num_valor_cooperado || 0), 0);
    const valorBruto = arredondarValor(somaBruta);
    const valorInss = arredondarMoeda4(valorBruto * 0.2);
    return {
      cooperadoId: coopId,
      nomeCooperado: cacheNomes.get(coopId) || 'Cooperado',
      servicoIds: srvs.map((s) => s._id),
      valorBruto,
      valorInss,
      valorLiquido: valorBruto,
    };
  });

  // Mesmo critério de ordenação do backend workflow `cmgVd` no Bubble (`sorted` por `nome_text`).
  grupos.sort((a, b) => a.nomeCooperado.localeCompare(b.nomeCooperado, 'pt-BR', { sensitivity: 'base' }));

  const subRelatoriosAtuais = await bubbleFetchAll<SubRelatorioPagamentoBubble>(
    '/obj/f_subrelatorio_pagamento',
    [{ key: 'fk_relatorio', constraint_type: 'equals', value: relatorioId }]
  );

  let subRelatoriosCriados = 0;
  let subRelatoriosReutilizados = 0;
  let subRelatoriosRemovidos = 0;
  const idsParaRemover = new Set<string>();
  const existentePorCoop = new Map<string, SubRelatorioPagamentoBubble>();

  if (forcar) {
    for (const item of subRelatoriosAtuais) {
      if (item._id) idsParaRemover.add(item._id);
    }
    for (const idPai of subsExistentesNoPai) {
      idsParaRemover.add(idPai);
    }
    if (idsParaRemover.size > 0) {
      await executarEmLotes(Array.from(idsParaRemover), 5, apagarSubRelatorioSeguro);
      subRelatoriosRemovidos = idsParaRemover.size;
      idsParaRemover.clear();
    }
  } else {
    const coopsValidos = new Set(grupos.map((g) => g.cooperadoId));
    for (const sub of subRelatoriosAtuais) {
      const coopId = typeof sub.fk_cooperado === 'string' ? sub.fk_cooperado.trim() : '';
      if (!sub._id) continue;
      if (!coopId || !coopsValidos.has(coopId) || existentePorCoop.has(coopId)) {
        idsParaRemover.add(sub._id);
      } else {
        existentePorCoop.set(coopId, sub);
      }
    }
  }

  const subRelatorioIds = await executarEmLotes(grupos, 5, async (grupo) => {
    const payload = {
      fk_relatorio: relatorioId,
      fk_cooperado: grupo.cooperadoId,
      fks_servicos: grupo.servicoIds,
      txt_nome: grupo.nomeCooperado,
      num_valor_bruto: grupo.valorBruto,
      num_inss: grupo.valorInss,
      num_valor_liquido: grupo.valorLiquido,
    };

    const existente = existentePorCoop.get(grupo.cooperadoId);
    if (existente?._id) {
      const mesmoConteudo =
        (existente.txt_nome ?? '') === grupo.nomeCooperado &&
        conjuntosIguais(existente.fks_servicos, grupo.servicoIds) &&
        Math.abs(Number(existente.num_valor_bruto ?? -1) - grupo.valorBruto) < 0.005 &&
        Math.abs(Number(existente.num_inss ?? -1) - grupo.valorInss) < 0.005 &&
        Math.abs(Number(existente.num_valor_liquido ?? -1) - grupo.valorLiquido) < 0.005;

      if (!mesmoConteudo) {
        await bubbleFetchJson(
          `/obj/f_subrelatorio_pagamento/${encodeURIComponent(existente._id)}`,
          {
            method: 'PATCH',
            body: JSON.stringify(payload),
          }
        );
      }
      subRelatoriosReutilizados += 1;
      return existente._id;
    }

    const criado = await bubbleFetchJson<BubbleCreateResponse>('/obj/f_subrelatorio_pagamento', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const novoId = criado?.id || criado?.response?.id;
    if (!novoId) {
      throw new Error(`Bubble não retornou o _id do f_subrelatorio_pagamento para cooperado ${grupo.cooperadoId}.`);
    }
    subRelatoriosCriados += 1;
    return novoId;
  });

  if (idsParaRemover.size > 0) {
    await executarEmLotes(Array.from(idsParaRemover), 5, apagarSubRelatorioSeguro);
    subRelatoriosRemovidos += idsParaRemover.size;
  }

  await bubbleFetchJson(`/obj/f-relatoriodepagamentomensal/${encodeURIComponent(relatorioId)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      'sub relatórios': subRelatorioIds,
      'data da sincronia': new Date().toISOString(),
    }),
  });

  return {
    relatorioId,
    escalasIds,
    totalServicos: servicos.length,
    cooperados: grupos.length,
    subRelatoriosCriados,
    subRelatoriosReutilizados,
    subRelatoriosRemovidos,
    subRelatorioIds,
    status: 'sincronizado',
  };
}

/**
 * Sincroniza relatórios de pagamento mensal (`f-relatoriodepagamentomensal`) e seus
 * respectivos sub-relatórios por cooperado (`f_subrelatorio_pagamento`) diretamente no Bubble.
 *
 * Reproduz integralmente a lógica dos backend workflows `/wf/sinc` (`cmgVd`) e `/wf/relatsub` (`cmdRN`),
 * contornando a desativação do botão `Sincronizar` (`cmgVb`) na interface nativa do Bubble.
 */
export async function sincronizarRelatoriosPagamentoBubble(
  opcoes: SincronizarRelatoriosOpcoes = {}
): Promise<ResultadoSyncRelatoriosPagamento> {
  const forcar = Boolean(opcoes.forcar);
  const limiteRelatorios = Math.max(1, opcoes.limiteRelatorios ?? 100);
  const cacheNomes = new Map<string, string>();

  let relatorios: RelatorioPagamentoMensalBubble[] = [];
  if (opcoes.relatorioId) {
    const resp = await bubbleFetchJson<{ response?: RelatorioPagamentoMensalBubble }>(
      `/obj/f-relatoriodepagamentomensal/${encodeURIComponent(opcoes.relatorioId)}`,
      {},
      { aceitar404: true }
    );
    if (resp?.response?._id) {
      relatorios = [resp.response];
    } else {
      throw new Error(`Relatório ${opcoes.relatorioId} não encontrado no Bubble.`);
    }
  } else {
    relatorios = await bubbleFetchAll<RelatorioPagamentoMensalBubble>(
      '/obj/f-relatoriodepagamentomensal',
      undefined,
      {
        sortField: 'Created Date',
        descending: true,
        maxItems: limiteRelatorios,
      }
    );
  }

  const alvo = opcoes.relatorioId
    ? relatorios
    : relatorios.filter(
        (r) => forcar || !Array.isArray(r['sub relatórios']) || r['sub relatórios'].length === 0
      );

  const resultado: ResultadoSyncRelatoriosPagamento = {
    avaliados: alvo.length,
    sincronizados: 0,
    subRelatoriosCriados: 0,
    subRelatoriosReutilizados: 0,
    ignorados: 0,
    erros: [],
    detalhes: [],
  };

  for (const relatorio of alvo) {
    try {
      const detalhe = await sincronizarUmRelatorio(relatorio, forcar, cacheNomes);
      resultado.detalhes.push(detalhe);
      if (detalhe.status === 'sincronizado') {
        resultado.sincronizados += 1;
        resultado.subRelatoriosCriados += detalhe.subRelatoriosCriados;
        resultado.subRelatoriosReutilizados += detalhe.subRelatoriosReutilizados;
      } else {
        resultado.ignorados += 1;
      }
    } catch (error: unknown) {
      const mensagem = error instanceof Error ? error.message : 'Erro desconhecido ao sincronizar relatório.';
      resultado.erros.push({ relatorioId: relatorio._id, erro: mensagem });
      resultado.detalhes.push({
        relatorioId: relatorio._id,
        escalasIds: Array.isArray(relatorio.Escalas) ? relatorio.Escalas : [],
        totalServicos: 0,
        cooperados: 0,
        subRelatoriosCriados: 0,
        subRelatoriosReutilizados: 0,
        subRelatoriosRemovidos: 0,
        subRelatorioIds: [],
        status: 'erro',
        erro: mensagem,
      });
    }
  }

  return resultado;
}
