/**
 * Camada de acesso ao módulo de equipamentos no D1: equipamentos (próprios e de
 * terceiro), domicílios, locações e movimentações.
 *
 * Sem ORM: tudo via `db.prepare(...).bind(...)`. Nenhum valor é interpolado em
 * string SQL — o que entra por concatenação são apenas nomes de coluna vindos de
 * listas fechadas declaradas neste arquivo.
 *
 * Nomenclatura: tipos e campos em português, sem os prefixos `txt_`/`fk_`/`num_`
 * herdados do Bubble. O mapeamento coluna -> campo fica isolado nas funções
 * `map*` deste módulo.
 */

import { agoraIso, novoId, type D1Database } from './client';

// =============================================================================
// Vocabulários
// =============================================================================

/**
 * Mesmo conjunto de `StatusEquipamento` em `src/lib/bubble.ts`, redeclarado aqui
 * de propósito: quando a Fase 4 remover as funções de equipamento do `bubble.ts`,
 * este módulo continua de pé sozinho.
 */
export type StatusEquipamento =
  | 'Aguardando conferência'
  | 'Disponível'
  | 'Reservado'
  | 'Em transporte para implantação'
  | 'Implantado no domicílio'
  | 'Em transporte para recolhimento'
  | 'Recolhido e aguardando conferência'
  | 'Aguardando higienização'
  | 'Em higienização'
  | 'Manutenção'
  | 'Aguardando peça'
  | 'Liberado pela manutenção'
  | 'Bloqueado'
  | 'Extraviado'
  | 'Condenado'
  | 'Baixado'
  | 'Alugado'
  | 'Inativo';

export type TipoMovimentacao =
  | 'Cadastro'
  | 'Entrada no estoque'
  | 'Alteração cadastral'
  | 'Reserva'
  | 'Cancelamento de reserva'
  | 'Implantação'
  | 'Recolhimento'
  | 'Transferência'
  | 'Higienização'
  | 'Manutenção'
  | 'Calibração'
  | 'Bloqueio'
  | 'Liberação'
  | 'Extravio'
  | 'Baixa'
  | 'Correção';

export type OrigemEquipamento = 'Proprio' | 'Terceiro';

export type StatusLocacao = 'Ativo' | 'Finalizado' | 'Cancelado';

// =============================================================================
// Tipos de domínio
// =============================================================================

export interface Equipamento {
  id: string;
  nome: string;
  marca?: string | null;
  modelo?: string | null;
  numeroSerie?: string | null;
  patrimonio?: string | null;
  categoria?: string | null;
  status: StatusEquipamento;
  origem: OrigemEquipamento;
  /** Obrigatório quando origem = 'Terceiro' (o banco recusa o contrário). */
  proprietarioId?: string | null;
  contratoTerceiroId?: string | null;
  /**
   * Quanto a cooperativa paga por mês ao proprietário. NUNCA exibir em documento
   * que vá para o cliente — é a margem do negócio.
   */
  custoMensalTerceiro?: number | null;
  dataEntradaTerceiro?: string | null;
  /** `null` = ainda em posse da cooperativa. */
  dataDevolucaoTerceiro?: string | null;
  valorMensalPadrao?: number | null;
  criadoEm: string;
}

/** Equipamento com o nome do proprietário resolvido, para listagens. */
export interface EquipamentoListado extends Equipamento {
  proprietarioNome?: string | null;
}

export interface NovoEquipamento {
  nome: string;
  marca?: string | null;
  modelo?: string | null;
  numeroSerie?: string | null;
  patrimonio?: string | null;
  categoria?: string | null;
  status?: StatusEquipamento;
  origem?: OrigemEquipamento;
  proprietarioId?: string | null;
  contratoTerceiroId?: string | null;
  custoMensalTerceiro?: number | null;
  dataEntradaTerceiro?: string | null;
  dataDevolucaoTerceiro?: string | null;
  valorMensalPadrao?: number | null;
}

export interface Domicilio {
  id: string;
  /** Id em `locais_de_trabalho_pacientes` no Bubble. Sem FK: outro banco. */
  clienteBubbleId: string;
  endereco: string;
  cep?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  pontoReferencia?: string | null;
  contatoLocal?: string | null;
  instrucoesAcesso?: string | null;
  ativo: boolean;
  criadoEm: string;
}

export type NovoDomicilio = Omit<Domicilio, 'id' | 'criadoEm' | 'ativo'> & {
  ativo?: boolean;
};

export interface Locacao {
  id: string;
  equipamentoId: string;
  clienteBubbleId: string;
  /** Desnormalização deliberada: relatório não pode depender do Bubble estar no ar. */
  clienteNomeCache?: string | null;
  domicilioId?: string | null;
  dataInicio: string;
  dataFimPrevisto?: string | null;
  dataFimReal?: string | null;
  valorMensal: number;
  status: StatusLocacao;
  observacoes?: string | null;
  criadoEm: string;
}

export interface NovaLocacao {
  equipamentoId: string;
  clienteBubbleId: string;
  clienteNomeCache?: string | null;
  domicilioId?: string | null;
  dataInicio: string;
  dataFimPrevisto?: string | null;
  valorMensal: number;
  observacoes?: string | null;
}

export interface Movimentacao {
  id: string;
  equipamentoId: string;
  locacaoId?: string | null;
  /** Ordem de serviço ainda no Bubble nesta fase; guardado como texto. */
  ordemServicoId?: string | null;
  domicilioId?: string | null;
  localizacaoAnterior?: string | null;
  novaLocalizacao?: string | null;
  tipo: TipoMovimentacao;
  statusAnterior?: StatusEquipamento | null;
  novoStatus: StatusEquipamento;
  dataHora: string;
  responsavel?: string | null;
  observacoes?: string | null;
  justificativa?: string | null;
  chaveIdempotencia: string;
  cancelado: boolean;
  criadoEm: string;
}

export interface NovaMovimentacao {
  equipamentoId: string;
  tipo: TipoMovimentacao;
  novoStatus: StatusEquipamento;
  chaveIdempotencia: string;
  locacaoId?: string | null;
  ordemServicoId?: string | null;
  domicilioId?: string | null;
  localizacaoAnterior?: string | null;
  novaLocalizacao?: string | null;
  responsavel?: string | null;
  observacoes?: string | null;
  justificativa?: string | null;
  dataHora?: string;
  /**
   * Guarda de concorrência: se informado, a movimentação só troca o status do
   * equipamento quando ele ainda for este valor (detecta escrita concorrente).
   */
  statusEsperado?: StatusEquipamento;
}

// =============================================================================
// Cálculo de custo — regra isolada de propósito
// =============================================================================

const MS_DIA = 86_400_000;

/** Converte 'YYYY-MM-DD' ou ISO datetime em ms UTC do início do dia. */
function diaUtc(iso: string): number {
  const ms = Date.parse(`${iso.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(ms)) throw new RangeError(`Data inválida: ${iso}`);
  return ms;
}

/** Dias corridos entre duas datas, contando as duas pontas. 0 se invertidas. */
function diasInclusivos(inicioMs: number, fimMs: number): number {
  if (fimMs < inicioMs) return 0;
  return Math.round((fimMs - inicioMs) / MS_DIA) + 1;
}

function arredondarCentavos(valor: number): number {
  return Math.round(valor * 100) / 100;
}

/** Primeiro e último dia (inclusivos) de uma competência mês/ano. */
export function competenciaParaPeriodo(
  ano: number,
  mes: number,
): { inicio: string; fim: string } {
  const inicio = new Date(Date.UTC(ano, mes - 1, 1));
  const fim = new Date(Date.UTC(ano, mes, 0)); // dia 0 do mês seguinte = último deste
  return {
    inicio: inicio.toISOString().slice(0, 10),
    fim: fim.toISOString().slice(0, 10),
  };
}

export interface EntradaCustoPeriodo {
  /** Valor fixo mensal pago ao proprietário. */
  custoMensal: number;
  /** Primeiro dia da competência, inclusivo (YYYY-MM-DD). */
  inicioPeriodo: string;
  /** Último dia da competência, inclusivo (YYYY-MM-DD). */
  fimPeriodo: string;
  /** Quando o equipamento entrou em posse da cooperativa. */
  dataEntrada: string;
  /** Quando foi devolvido ao proprietário; `null`/ausente = ainda em posse. */
  dataDevolucao?: string | null;
}

export interface CustoPeriodo {
  /** Dias corridos da competência (28..31 num mês cheio). */
  diasNoPeriodo: number;
  /** Dias em que o equipamento esteve em posse da cooperativa dentro da competência. */
  diasCobrados: number;
  valor: number;
  /** `false` quando cobrou o mês cheio. */
  proporcional: boolean;
}

/**
 * Custo de um equipamento de terceiro numa competência.
 *
 * REGRA ASSUMIDA (decisão de negócio ainda em aberto — ver "Questões em aberto"
 * item 1 do plano): PRO-RATA PROPORCIONAL POR DIAS CORRIDOS. Um equipamento que
 * entra dia 20 de um mês de 31 dias paga 12/31 do valor mensal (dia de entrada e
 * dia de devolução contam como dias cobrados). Se os contratos assinados disserem
 * "mês cheio a partir da entrada", basta trocar o corpo desta função — é o único
 * lugar onde a regra existe, e por isso ela é pura e não toca o banco.
 *
 * O custo corre esteja o equipamento locado ou parado: ociosidade não entra aqui.
 */
export function calcularCustoPeriodo(entrada: EntradaCustoPeriodo): CustoPeriodo {
  const inicioPeriodoMs = diaUtc(entrada.inicioPeriodo);
  const fimPeriodoMs = diaUtc(entrada.fimPeriodo);
  const diasNoPeriodo = diasInclusivos(inicioPeriodoMs, fimPeriodoMs);

  if (diasNoPeriodo === 0) {
    return { diasNoPeriodo: 0, diasCobrados: 0, valor: 0, proporcional: true };
  }

  const entradaMs = diaUtc(entrada.dataEntrada);
  const devolucaoMs = entrada.dataDevolucao ? diaUtc(entrada.dataDevolucao) : null;

  // Interseção entre [entrada, devolução] e [início, fim] da competência.
  const inicioCobrancaMs = Math.max(inicioPeriodoMs, entradaMs);
  const fimCobrancaMs =
    devolucaoMs === null ? fimPeriodoMs : Math.min(fimPeriodoMs, devolucaoMs);

  const diasCobrados = diasInclusivos(inicioCobrancaMs, fimCobrancaMs);

  if (diasCobrados === 0) {
    return { diasNoPeriodo, diasCobrados: 0, valor: 0, proporcional: true };
  }

  if (diasCobrados >= diasNoPeriodo) {
    return {
      diasNoPeriodo,
      diasCobrados: diasNoPeriodo,
      valor: arredondarCentavos(entrada.custoMensal),
      proporcional: false,
    };
  }

  return {
    diasNoPeriodo,
    diasCobrados,
    valor: arredondarCentavos((entrada.custoMensal * diasCobrados) / diasNoPeriodo),
    proporcional: true,
  };
}

/**
 * Dias em que uma locação esteve vigente dentro de uma competência. Usado para
 * receita pro-rata e para o cálculo de ociosidade (diasNoPeriodo − diasLocado).
 * Mesma convenção de dias corridos inclusivos de `calcularCustoPeriodo`.
 */
export function calcularDiasLocados(
  locacao: Pick<Locacao, 'dataInicio' | 'dataFimReal' | 'dataFimPrevisto' | 'status'>,
  inicioPeriodo: string,
  fimPeriodo: string,
): number {
  if (locacao.status === 'Cancelado') return 0;

  const inicioPeriodoMs = diaUtc(inicioPeriodo);
  const fimPeriodoMs = diaUtc(fimPeriodo);
  const inicioMs = diaUtc(locacao.dataInicio);
  const fimMs = locacao.dataFimReal ? diaUtc(locacao.dataFimReal) : fimPeriodoMs;

  return diasInclusivos(
    Math.max(inicioPeriodoMs, inicioMs),
    Math.min(fimPeriodoMs, fimMs),
  );
}

// =============================================================================
// Validação que espelha os CHECK do banco
// =============================================================================

/**
 * Mesma regra do `CHECK` de `equipamentos`: a UI avisa antes, o banco garante
 * depois. Devolve a lista de problemas (vazia = válido).
 */
export function validarEquipamento(entrada: NovoEquipamento): string[] {
  const erros: string[] = [];
  if (!entrada.nome?.trim()) erros.push('Nome é obrigatório.');

  if ((entrada.origem ?? 'Proprio') === 'Terceiro') {
    if (!entrada.proprietarioId) {
      erros.push('Equipamento de terceiro exige proprietário.');
    }
    if (entrada.custoMensalTerceiro == null) {
      erros.push('Equipamento de terceiro exige custo mensal.');
    }
    if (!entrada.dataEntradaTerceiro) {
      erros.push('Equipamento de terceiro exige data de entrada.');
    }
  }

  return erros;
}

export class ValidacaoEquipamentoError extends Error {
  readonly erros: string[];
  constructor(erros: string[]) {
    super(erros.join(' '));
    this.name = 'ValidacaoEquipamentoError';
    this.erros = erros;
  }
}

// =============================================================================
// Mapeamento linha -> domínio
// =============================================================================

interface LinhaEquipamento {
  id: string;
  nome: string;
  marca: string | null;
  modelo: string | null;
  numero_serie: string | null;
  patrimonio: string | null;
  categoria: string | null;
  status: string;
  origem: string;
  proprietario_id: string | null;
  contrato_terceiro_id: string | null;
  custo_mensal_terceiro: number | null;
  data_entrada_terceiro: string | null;
  data_devolucao_terceiro: string | null;
  valor_mensal_padrao: number | null;
  criado_em: string;
}

interface LinhaDomicilio {
  id: string;
  cliente_bubble_id: string;
  endereco: string;
  cep: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  ponto_referencia: string | null;
  contato_local: string | null;
  instrucoes_acesso: string | null;
  ativo: number;
  criado_em: string;
}

interface LinhaLocacao {
  id: string;
  equipamento_id: string;
  cliente_bubble_id: string;
  cliente_nome_cache: string | null;
  domicilio_id: string | null;
  data_inicio: string;
  data_fim_previsto: string | null;
  data_fim_real: string | null;
  valor_mensal: number;
  status: string;
  observacoes: string | null;
  criado_em: string;
}

interface LinhaMovimentacao {
  id: string;
  equipamento_id: string;
  locacao_id: string | null;
  ordem_servico_id: string | null;
  domicilio_id: string | null;
  localizacao_anterior: string | null;
  nova_localizacao: string | null;
  tipo: string;
  status_anterior: string | null;
  novo_status: string;
  data_hora: string;
  responsavel: string | null;
  observacoes: string | null;
  justificativa: string | null;
  chave_idempotencia: string;
  cancelado: number;
  criado_em: string;
}

function mapEquipamento(l: LinhaEquipamento): Equipamento {
  return {
    id: l.id,
    nome: l.nome,
    marca: l.marca,
    modelo: l.modelo,
    numeroSerie: l.numero_serie,
    patrimonio: l.patrimonio,
    categoria: l.categoria,
    status: l.status as StatusEquipamento,
    origem: l.origem as OrigemEquipamento,
    proprietarioId: l.proprietario_id,
    contratoTerceiroId: l.contrato_terceiro_id,
    custoMensalTerceiro: l.custo_mensal_terceiro,
    dataEntradaTerceiro: l.data_entrada_terceiro,
    dataDevolucaoTerceiro: l.data_devolucao_terceiro,
    valorMensalPadrao: l.valor_mensal_padrao,
    criadoEm: l.criado_em,
  };
}

function mapDomicilio(l: LinhaDomicilio): Domicilio {
  return {
    id: l.id,
    clienteBubbleId: l.cliente_bubble_id,
    endereco: l.endereco,
    cep: l.cep,
    numero: l.numero,
    complemento: l.complemento,
    bairro: l.bairro,
    cidade: l.cidade,
    estado: l.estado,
    pontoReferencia: l.ponto_referencia,
    contatoLocal: l.contato_local,
    instrucoesAcesso: l.instrucoes_acesso,
    ativo: l.ativo === 1,
    criadoEm: l.criado_em,
  };
}

function mapLocacao(l: LinhaLocacao): Locacao {
  return {
    id: l.id,
    equipamentoId: l.equipamento_id,
    clienteBubbleId: l.cliente_bubble_id,
    clienteNomeCache: l.cliente_nome_cache,
    domicilioId: l.domicilio_id,
    dataInicio: l.data_inicio,
    dataFimPrevisto: l.data_fim_previsto,
    dataFimReal: l.data_fim_real,
    valorMensal: l.valor_mensal,
    status: l.status as StatusLocacao,
    observacoes: l.observacoes,
    criadoEm: l.criado_em,
  };
}

function mapMovimentacao(l: LinhaMovimentacao): Movimentacao {
  return {
    id: l.id,
    equipamentoId: l.equipamento_id,
    locacaoId: l.locacao_id,
    ordemServicoId: l.ordem_servico_id,
    domicilioId: l.domicilio_id,
    localizacaoAnterior: l.localizacao_anterior,
    novaLocalizacao: l.nova_localizacao,
    tipo: l.tipo as TipoMovimentacao,
    statusAnterior: l.status_anterior as StatusEquipamento | null,
    novoStatus: l.novo_status as StatusEquipamento,
    dataHora: l.data_hora,
    responsavel: l.responsavel,
    observacoes: l.observacoes,
    justificativa: l.justificativa,
    chaveIdempotencia: l.chave_idempotencia,
    cancelado: l.cancelado === 1,
    criadoEm: l.criado_em,
  };
}

const COLUNAS_EQUIPAMENTO =
  'id, nome, marca, modelo, numero_serie, patrimonio, categoria, status, origem, ' +
  'proprietario_id, contrato_terceiro_id, custo_mensal_terceiro, data_entrada_terceiro, ' +
  'data_devolucao_terceiro, valor_mensal_padrao, criado_em';

const COLUNAS_DOMICILIO =
  'id, cliente_bubble_id, endereco, cep, numero, complemento, bairro, cidade, estado, ' +
  'ponto_referencia, contato_local, instrucoes_acesso, ativo, criado_em';

const COLUNAS_LOCACAO =
  'id, equipamento_id, cliente_bubble_id, cliente_nome_cache, domicilio_id, data_inicio, ' +
  'data_fim_previsto, data_fim_real, valor_mensal, status, observacoes, criado_em';

const COLUNAS_MOVIMENTACAO =
  'id, equipamento_id, locacao_id, ordem_servico_id, domicilio_id, localizacao_anterior, ' +
  'nova_localizacao, tipo, status_anterior, novo_status, data_hora, responsavel, ' +
  'observacoes, justificativa, chave_idempotencia, cancelado, criado_em';

// =============================================================================
// Equipamentos
// =============================================================================

export interface FiltroEquipamentos {
  origem?: OrigemEquipamento;
  proprietarioId?: string;
  contratoTerceiroId?: string;
  status?: StatusEquipamento;
  categoria?: string;
  /** Busca por nome, número de série ou patrimônio. */
  busca?: string;
  /** Só equipamentos de terceiro ainda não devolvidos. */
  apenasEmPosse?: boolean;
  limite?: number;
}

export async function listarEquipamentos(
  db: D1Database,
  filtros: FiltroEquipamentos = {},
): Promise<EquipamentoListado[]> {
  const condicoes: string[] = [];
  const params: unknown[] = [];

  if (filtros.origem) {
    condicoes.push('e.origem = ?');
    params.push(filtros.origem);
  }
  if (filtros.proprietarioId) {
    condicoes.push('e.proprietario_id = ?');
    params.push(filtros.proprietarioId);
  }
  if (filtros.contratoTerceiroId) {
    condicoes.push('e.contrato_terceiro_id = ?');
    params.push(filtros.contratoTerceiroId);
  }
  if (filtros.status) {
    condicoes.push('e.status = ?');
    params.push(filtros.status);
  }
  if (filtros.categoria) {
    condicoes.push('e.categoria = ?');
    params.push(filtros.categoria);
  }
  if (filtros.apenasEmPosse) {
    condicoes.push('e.data_devolucao_terceiro IS NULL');
  }
  if (filtros.busca) {
    condicoes.push('(e.nome LIKE ? OR e.numero_serie LIKE ? OR e.patrimonio LIKE ?)');
    const termo = `%${filtros.busca}%`;
    params.push(termo, termo, termo);
  }

  const where = condicoes.length ? ` WHERE ${condicoes.join(' AND ')}` : '';
  const limite = Math.min(Math.max(filtros.limite ?? 500, 1), 5000);
  params.push(limite);

  const { results } = await db
    .prepare(
      `SELECT ${COLUNAS_EQUIPAMENTO.split(', ').map((c) => `e.${c}`).join(', ')},
              p.nome AS proprietario_nome
         FROM equipamentos e
         LEFT JOIN proprietarios p ON p.id = e.proprietario_id
        ${where}
        ORDER BY e.nome
        LIMIT ?`,
    )
    .bind(...params)
    .all<LinhaEquipamento & { proprietario_nome: string | null }>();

  return results.map((l) => ({ ...mapEquipamento(l), proprietarioNome: l.proprietario_nome }));
}

export async function obterEquipamento(
  db: D1Database,
  id: string,
): Promise<Equipamento | null> {
  const linha = await db
    .prepare(`SELECT ${COLUNAS_EQUIPAMENTO} FROM equipamentos WHERE id = ?`)
    .bind(id)
    .first<LinhaEquipamento>();
  return linha ? mapEquipamento(linha) : null;
}

export async function criarEquipamento(
  db: D1Database,
  entrada: NovoEquipamento,
  opcoes: { id?: string } = {},
): Promise<Equipamento> {
  const erros = validarEquipamento(entrada);
  if (erros.length) throw new ValidacaoEquipamentoError(erros);

  const equipamento: Equipamento = {
    id: opcoes.id ?? novoId('equip'),
    nome: entrada.nome.trim(),
    marca: entrada.marca ?? null,
    modelo: entrada.modelo ?? null,
    numeroSerie: entrada.numeroSerie?.trim() || null,
    patrimonio: entrada.patrimonio ?? null,
    categoria: entrada.categoria ?? null,
    status: entrada.status ?? 'Disponível',
    origem: entrada.origem ?? 'Proprio',
    proprietarioId: entrada.proprietarioId ?? null,
    contratoTerceiroId: entrada.contratoTerceiroId ?? null,
    custoMensalTerceiro: entrada.custoMensalTerceiro ?? null,
    dataEntradaTerceiro: entrada.dataEntradaTerceiro ?? null,
    dataDevolucaoTerceiro: entrada.dataDevolucaoTerceiro ?? null,
    valorMensalPadrao: entrada.valorMensalPadrao ?? null,
    criadoEm: agoraIso(),
  };

  await db
    .prepare(
      `INSERT INTO equipamentos
         (id, nome, marca, modelo, numero_serie, patrimonio, categoria, status, origem,
          proprietario_id, contrato_terceiro_id, custo_mensal_terceiro, data_entrada_terceiro,
          data_devolucao_terceiro, valor_mensal_padrao, criado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      equipamento.id,
      equipamento.nome,
      equipamento.marca,
      equipamento.modelo,
      equipamento.numeroSerie,
      equipamento.patrimonio,
      equipamento.categoria,
      equipamento.status,
      equipamento.origem,
      equipamento.proprietarioId,
      equipamento.contratoTerceiroId,
      equipamento.custoMensalTerceiro,
      equipamento.dataEntradaTerceiro,
      equipamento.dataDevolucaoTerceiro,
      equipamento.valorMensalPadrao,
      equipamento.criadoEm,
    )
    .run();

  return equipamento;
}

const CAMPOS_EQUIPAMENTO: Record<keyof NovoEquipamento, string> = {
  nome: 'nome',
  marca: 'marca',
  modelo: 'modelo',
  numeroSerie: 'numero_serie',
  patrimonio: 'patrimonio',
  categoria: 'categoria',
  status: 'status',
  origem: 'origem',
  proprietarioId: 'proprietario_id',
  contratoTerceiroId: 'contrato_terceiro_id',
  custoMensalTerceiro: 'custo_mensal_terceiro',
  dataEntradaTerceiro: 'data_entrada_terceiro',
  dataDevolucaoTerceiro: 'data_devolucao_terceiro',
  valorMensalPadrao: 'valor_mensal_padrao',
};

/**
 * Atualização parcial. A validação de terceiro roda sobre o estado RESULTANTE
 * (atual + mudanças), senão trocar só a origem passaria batido aqui e estouraria
 * no `CHECK` do banco com uma mensagem incompreensível para o gestor.
 */
export async function atualizarEquipamento(
  db: D1Database,
  id: string,
  mudancas: Partial<NovoEquipamento>,
): Promise<Equipamento | null> {
  const atual = await obterEquipamento(db, id);
  if (!atual) return null;

  const resultante: NovoEquipamento = {
    nome: mudancas.nome ?? atual.nome,
    origem: mudancas.origem ?? atual.origem,
    proprietarioId:
      'proprietarioId' in mudancas ? mudancas.proprietarioId : atual.proprietarioId,
    custoMensalTerceiro:
      'custoMensalTerceiro' in mudancas
        ? mudancas.custoMensalTerceiro
        : atual.custoMensalTerceiro,
    dataEntradaTerceiro:
      'dataEntradaTerceiro' in mudancas
        ? mudancas.dataEntradaTerceiro
        : atual.dataEntradaTerceiro,
  };
  const erros = validarEquipamento(resultante);
  if (erros.length) throw new ValidacaoEquipamentoError(erros);

  const sets: string[] = [];
  const params: unknown[] = [];

  for (const chave of Object.keys(CAMPOS_EQUIPAMENTO) as (keyof NovoEquipamento)[]) {
    if (!(chave in mudancas)) continue;
    // Coluna vem da tabela fechada acima; o valor sempre via bind.
    sets.push(`${CAMPOS_EQUIPAMENTO[chave]} = ?`);
    params.push(mudancas[chave] ?? null);
  }

  if (sets.length === 0) return atual;

  params.push(id);
  await db
    .prepare(`UPDATE equipamentos SET ${sets.join(', ')} WHERE id = ?`)
    .bind(...params)
    .run();

  return obterEquipamento(db, id);
}

/** Marca a devolução ao proprietário: o custo mensal para de correr nesta data. */
export async function registrarDevolucaoAoProprietario(
  db: D1Database,
  equipamentoId: string,
  dataDevolucao: string,
): Promise<Equipamento | null> {
  await db
    .prepare(
      `UPDATE equipamentos SET data_devolucao_terceiro = ?
        WHERE id = ? AND origem = 'Terceiro'`,
    )
    .bind(dataDevolucao, equipamentoId)
    .run();
  return obterEquipamento(db, equipamentoId);
}

// =============================================================================
// Domicílios
// =============================================================================

export async function listarDomicilios(
  db: D1Database,
  filtros: { clienteBubbleId?: string; apenasAtivos?: boolean } = {},
): Promise<Domicilio[]> {
  const condicoes: string[] = [];
  const params: unknown[] = [];

  if (filtros.clienteBubbleId) {
    condicoes.push('cliente_bubble_id = ?');
    params.push(filtros.clienteBubbleId);
  }
  if (filtros.apenasAtivos) condicoes.push('ativo = 1');

  const where = condicoes.length ? ` WHERE ${condicoes.join(' AND ')}` : '';
  const { results } = await db
    .prepare(`SELECT ${COLUNAS_DOMICILIO} FROM domicilios${where} ORDER BY criado_em DESC`)
    .bind(...params)
    .all<LinhaDomicilio>();

  return results.map(mapDomicilio);
}

export async function obterDomicilio(
  db: D1Database,
  id: string,
): Promise<Domicilio | null> {
  const linha = await db
    .prepare(`SELECT ${COLUNAS_DOMICILIO} FROM domicilios WHERE id = ?`)
    .bind(id)
    .first<LinhaDomicilio>();
  return linha ? mapDomicilio(linha) : null;
}

export async function criarDomicilio(
  db: D1Database,
  entrada: NovoDomicilio,
): Promise<Domicilio> {
  const domicilio: Domicilio = {
    id: novoId('dom'),
    clienteBubbleId: entrada.clienteBubbleId,
    endereco: entrada.endereco,
    cep: entrada.cep ?? null,
    numero: entrada.numero ?? null,
    complemento: entrada.complemento ?? null,
    bairro: entrada.bairro ?? null,
    cidade: entrada.cidade ?? null,
    estado: entrada.estado ?? null,
    pontoReferencia: entrada.pontoReferencia ?? null,
    contatoLocal: entrada.contatoLocal ?? null,
    instrucoesAcesso: entrada.instrucoesAcesso ?? null,
    ativo: entrada.ativo ?? true,
    criadoEm: agoraIso(),
  };

  await db
    .prepare(
      `INSERT INTO domicilios
         (id, cliente_bubble_id, endereco, cep, numero, complemento, bairro, cidade,
          estado, ponto_referencia, contato_local, instrucoes_acesso, ativo, criado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      domicilio.id,
      domicilio.clienteBubbleId,
      domicilio.endereco,
      domicilio.cep,
      domicilio.numero,
      domicilio.complemento,
      domicilio.bairro,
      domicilio.cidade,
      domicilio.estado,
      domicilio.pontoReferencia,
      domicilio.contatoLocal,
      domicilio.instrucoesAcesso,
      domicilio.ativo ? 1 : 0,
      domicilio.criadoEm,
    )
    .run();

  return domicilio;
}

// =============================================================================
// Locações
// =============================================================================

export interface FiltroLocacoes {
  equipamentoId?: string;
  clienteBubbleId?: string;
  status?: StatusLocacao;
  /** Locações vigentes em qualquer momento do intervalo (interseção de períodos). */
  inicioPeriodo?: string;
  fimPeriodo?: string;
}

export async function listarLocacoes(
  db: D1Database,
  filtros: FiltroLocacoes = {},
): Promise<Locacao[]> {
  const condicoes: string[] = [];
  const params: unknown[] = [];

  if (filtros.equipamentoId) {
    condicoes.push('equipamento_id = ?');
    params.push(filtros.equipamentoId);
  }
  if (filtros.clienteBubbleId) {
    condicoes.push('cliente_bubble_id = ?');
    params.push(filtros.clienteBubbleId);
  }
  if (filtros.status) {
    condicoes.push('status = ?');
    params.push(filtros.status);
  }
  if (filtros.inicioPeriodo && filtros.fimPeriodo) {
    // Interseção: começou até o fim do período E (ainda aberta OU terminou depois do início).
    condicoes.push(
      "substr(data_inicio, 1, 10) <= ? AND (data_fim_real IS NULL OR substr(data_fim_real, 1, 10) >= ?)",
    );
    params.push(filtros.fimPeriodo.slice(0, 10), filtros.inicioPeriodo.slice(0, 10));
  }

  const where = condicoes.length ? ` WHERE ${condicoes.join(' AND ')}` : '';
  const { results } = await db
    .prepare(`SELECT ${COLUNAS_LOCACAO} FROM locacoes${where} ORDER BY data_inicio DESC`)
    .bind(...params)
    .all<LinhaLocacao>();

  return results.map(mapLocacao);
}

export async function obterLocacao(db: D1Database, id: string): Promise<Locacao | null> {
  const linha = await db
    .prepare(`SELECT ${COLUNAS_LOCACAO} FROM locacoes WHERE id = ?`)
    .bind(id)
    .first<LinhaLocacao>();
  return linha ? mapLocacao(linha) : null;
}

export async function criarLocacao(
  db: D1Database,
  entrada: NovaLocacao,
): Promise<Locacao> {
  const locacao: Locacao = {
    id: novoId('loc'),
    equipamentoId: entrada.equipamentoId,
    clienteBubbleId: entrada.clienteBubbleId,
    clienteNomeCache: entrada.clienteNomeCache ?? null,
    domicilioId: entrada.domicilioId ?? null,
    dataInicio: entrada.dataInicio,
    dataFimPrevisto: entrada.dataFimPrevisto ?? null,
    dataFimReal: null,
    valorMensal: entrada.valorMensal,
    status: 'Ativo',
    observacoes: entrada.observacoes ?? null,
    criadoEm: agoraIso(),
  };

  await db
    .prepare(
      `INSERT INTO locacoes
         (id, equipamento_id, cliente_bubble_id, cliente_nome_cache, domicilio_id,
          data_inicio, data_fim_previsto, data_fim_real, valor_mensal, status,
          observacoes, criado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      locacao.id,
      locacao.equipamentoId,
      locacao.clienteBubbleId,
      locacao.clienteNomeCache,
      locacao.domicilioId,
      locacao.dataInicio,
      locacao.dataFimPrevisto,
      locacao.dataFimReal,
      locacao.valorMensal,
      locacao.status,
      locacao.observacoes,
      locacao.criadoEm,
    )
    .run();

  return locacao;
}

export async function finalizarLocacao(
  db: D1Database,
  id: string,
  dataFimReal: string,
): Promise<Locacao | null> {
  await db
    .prepare(
      `UPDATE locacoes SET data_fim_real = ?, status = 'Finalizado'
        WHERE id = ? AND status = 'Ativo'`,
    )
    .bind(dataFimReal, id)
    .run();
  return obterLocacao(db, id);
}

export async function cancelarLocacao(
  db: D1Database,
  id: string,
  observacoes?: string,
): Promise<Locacao | null> {
  await db
    .prepare(
      `UPDATE locacoes SET status = 'Cancelado', observacoes = COALESCE(?, observacoes)
        WHERE id = ? AND status = 'Ativo'`,
    )
    .bind(observacoes ?? null, id)
    .run();
  return obterLocacao(db, id);
}

/** Atualiza o cache de nome do cliente (a fonte da verdade continua no Bubble). */
export async function atualizarNomeClienteCache(
  db: D1Database,
  clienteBubbleId: string,
  nome: string,
): Promise<number> {
  const { meta } = await db
    .prepare('UPDATE locacoes SET cliente_nome_cache = ? WHERE cliente_bubble_id = ?')
    .bind(nome, clienteBubbleId)
    .run();
  return meta.changes ?? 0;
}

// =============================================================================
// Movimentações
// =============================================================================

export interface ResultadoMovimentacao {
  movimentacao: Movimentacao;
  /** `true` quando a chave de idempotência já existia — nada foi gravado de novo. */
  jaRegistrada: boolean;
  /**
   * `false` quando `statusEsperado` foi informado e o equipamento já estava em
   * outro status: houve escrita concorrente e o status NÃO foi trocado.
   */
  statusAtualizado: boolean;
}

/**
 * Grava a movimentação e, quando ela vem acompanhada de troca de status, atualiza
 * o equipamento.
 *
 * Idempotência: `INSERT ... ON CONFLICT(chave_idempotencia) DO NOTHING`. No Bubble
 * isso era uma busca antes de gravar (com a janela de corrida que toda leitura
 * antes de escrita tem); aqui o índice único resolve de vez.
 */
export async function registrarMovimentacao(
  db: D1Database,
  entrada: NovaMovimentacao,
): Promise<ResultadoMovimentacao> {
  const existente = await db
    .prepare(`SELECT ${COLUNAS_MOVIMENTACAO} FROM movimentacoes WHERE chave_idempotencia = ?`)
    .bind(entrada.chaveIdempotencia)
    .first<LinhaMovimentacao>();

  if (existente) {
    return {
      movimentacao: mapMovimentacao(existente),
      jaRegistrada: true,
      statusAtualizado: false,
    };
  }

  const equipamento = await obterEquipamento(db, entrada.equipamentoId);
  if (!equipamento) {
    throw new Error(`Equipamento não encontrado: ${entrada.equipamentoId}`);
  }

  const agora = agoraIso();
  const movimentacao: Movimentacao = {
    id: novoId('mov'),
    equipamentoId: entrada.equipamentoId,
    locacaoId: entrada.locacaoId ?? null,
    ordemServicoId: entrada.ordemServicoId ?? null,
    domicilioId: entrada.domicilioId ?? null,
    localizacaoAnterior: entrada.localizacaoAnterior ?? null,
    novaLocalizacao: entrada.novaLocalizacao ?? null,
    tipo: entrada.tipo,
    statusAnterior: equipamento.status,
    novoStatus: entrada.novoStatus,
    dataHora: entrada.dataHora ?? agora,
    responsavel: entrada.responsavel ?? null,
    observacoes: entrada.observacoes ?? null,
    justificativa: entrada.justificativa ?? null,
    chaveIdempotencia: entrada.chaveIdempotencia,
    cancelado: false,
    criadoEm: agora,
  };

  const insercao = await db
    .prepare(
      `INSERT INTO movimentacoes
         (id, equipamento_id, locacao_id, ordem_servico_id, domicilio_id,
          localizacao_anterior, nova_localizacao, tipo, status_anterior, novo_status,
          data_hora, responsavel, observacoes, justificativa, chave_idempotencia,
          cancelado, criado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(chave_idempotencia) DO NOTHING`,
    )
    .bind(
      movimentacao.id,
      movimentacao.equipamentoId,
      movimentacao.locacaoId,
      movimentacao.ordemServicoId,
      movimentacao.domicilioId,
      movimentacao.localizacaoAnterior,
      movimentacao.novaLocalizacao,
      movimentacao.tipo,
      movimentacao.statusAnterior,
      movimentacao.novoStatus,
      movimentacao.dataHora,
      movimentacao.responsavel,
      movimentacao.observacoes,
      movimentacao.justificativa,
      movimentacao.chaveIdempotencia,
      0,
      movimentacao.criadoEm,
    )
    .run();

  // Corrida: outra requisição gravou a mesma chave entre o SELECT e o INSERT.
  if ((insercao.meta.changes ?? 1) === 0) {
    const gravada = await db
      .prepare(
        `SELECT ${COLUNAS_MOVIMENTACAO} FROM movimentacoes WHERE chave_idempotencia = ?`,
      )
      .bind(entrada.chaveIdempotencia)
      .first<LinhaMovimentacao>();
    if (gravada) {
      return {
        movimentacao: mapMovimentacao(gravada),
        jaRegistrada: true,
        statusAtualizado: false,
      };
    }
  }

  // Troca de status com guarda de concorrência opcional.
  const atualizacao = entrada.statusEsperado
    ? await db
        .prepare('UPDATE equipamentos SET status = ? WHERE id = ? AND status = ?')
        .bind(movimentacao.novoStatus, movimentacao.equipamentoId, entrada.statusEsperado)
        .run()
    : await db
        .prepare('UPDATE equipamentos SET status = ? WHERE id = ?')
        .bind(movimentacao.novoStatus, movimentacao.equipamentoId)
        .run();

  return {
    movimentacao,
    jaRegistrada: false,
    statusAtualizado: (atualizacao.meta.changes ?? 0) > 0,
  };
}

export async function listarMovimentacoes(
  db: D1Database,
  filtros: { equipamentoId?: string; locacaoId?: string; limite?: number } = {},
): Promise<Movimentacao[]> {
  const condicoes: string[] = [];
  const params: unknown[] = [];

  if (filtros.equipamentoId) {
    condicoes.push('equipamento_id = ?');
    params.push(filtros.equipamentoId);
  }
  if (filtros.locacaoId) {
    condicoes.push('locacao_id = ?');
    params.push(filtros.locacaoId);
  }

  const where = condicoes.length ? ` WHERE ${condicoes.join(' AND ')}` : '';
  params.push(Math.min(Math.max(filtros.limite ?? 200, 1), 2000));

  const { results } = await db
    .prepare(
      `SELECT ${COLUNAS_MOVIMENTACAO} FROM movimentacoes${where}
        ORDER BY data_hora DESC LIMIT ?`,
    )
    .bind(...params)
    .all<LinhaMovimentacao>();

  return results.map(mapMovimentacao);
}
