/**
 * Camada de acesso a proprietários e contratos de terceiro (D1).
 *
 * "Terceiro" aqui significa: a cooperativa aluga o equipamento de outra empresa
 * por um VALOR FIXO MENSAL e o subloca ao cliente. O reajuste do contrato é
 * manual — o gestor edita `custo_mensal_terceiro` no equipamento — por isso não
 * existe cálculo de índice em lugar nenhum; `indiceReajuste` é só anotação do
 * que o contrato assinado diz.
 *
 * Sem ORM: tudo via `db.prepare(...).bind(...)`. Nenhum valor é interpolado em
 * string SQL — só nomes de coluna vindos de listas fechadas do próprio código.
 */

import { agoraIso, novoId, type D1Database } from './client';

// =============================================================================
// Tipos de domínio (em português, sem os prefixos txt_/fk_/num_ do Bubble)
// =============================================================================

export interface Proprietario {
  id: string;
  nome: string;
  documento?: string | null;
  contatoNome?: string | null;
  contatoTelefone?: string | null;
  contatoEmail?: string | null;
  observacoes?: string | null;
  ativo: boolean;
  criadoEm: string;
}

export type StatusContratoTerceiro = 'Ativo' | 'Encerrado' | 'Suspenso';

export interface ContratoTerceiro {
  id: string;
  proprietarioId: string;
  numero?: string | null;
  dataInicio: string;
  /** `null` = prazo indeterminado. */
  dataFim?: string | null;
  /** Dia do mês (1..31) em que a fatura do terceiro vence. */
  diaVencimento?: number | null;
  avisoPrevioDias?: number | null;
  /** Informativo. Não há cálculo de reajuste no sistema. */
  indiceReajuste?: string | null;
  status: StatusContratoTerceiro;
  observacoes?: string | null;
  criadoEm: string;
}

export interface NovoProprietario {
  nome: string;
  documento?: string | null;
  contatoNome?: string | null;
  contatoTelefone?: string | null;
  contatoEmail?: string | null;
  observacoes?: string | null;
  ativo?: boolean;
}

export interface NovoContratoTerceiro {
  proprietarioId: string;
  numero?: string | null;
  dataInicio: string;
  dataFim?: string | null;
  diaVencimento?: number | null;
  avisoPrevioDias?: number | null;
  indiceReajuste?: string | null;
  status?: StatusContratoTerceiro;
  observacoes?: string | null;
}

/** Linha do painel de proprietários: quanto cada um custa por mês. */
export interface ResumoProprietario extends Proprietario {
  totalEquipamentos: number;
  equipamentosAtivos: number;
  custoMensalTotal: number;
}

/** Contrato cuja janela de aviso prévio está se fechando. */
export interface ContratoAVencer extends ContratoTerceiro {
  proprietarioNome: string;
  diasParaVencer: number;
  /** Já passou (ou está em cima) da data-limite para avisar o proprietário. */
  avisoPrevioVencido: boolean;
  equipamentosLocados: number;
}

// =============================================================================
// Mapeamento linha -> domínio
// =============================================================================

interface LinhaProprietario {
  id: string;
  nome: string;
  documento: string | null;
  contato_nome: string | null;
  contato_telefone: string | null;
  contato_email: string | null;
  observacoes: string | null;
  ativo: number;
  criado_em: string;
}

interface LinhaContrato {
  id: string;
  proprietario_id: string;
  numero: string | null;
  data_inicio: string;
  data_fim: string | null;
  dia_vencimento: number | null;
  aviso_previo_dias: number | null;
  indice_reajuste: string | null;
  status: string;
  observacoes: string | null;
  criado_em: string;
}

function mapProprietario(l: LinhaProprietario): Proprietario {
  return {
    id: l.id,
    nome: l.nome,
    documento: l.documento,
    contatoNome: l.contato_nome,
    contatoTelefone: l.contato_telefone,
    contatoEmail: l.contato_email,
    observacoes: l.observacoes,
    ativo: l.ativo === 1,
    criadoEm: l.criado_em,
  };
}

function mapContrato(l: LinhaContrato): ContratoTerceiro {
  return {
    id: l.id,
    proprietarioId: l.proprietario_id,
    numero: l.numero,
    dataInicio: l.data_inicio,
    dataFim: l.data_fim,
    diaVencimento: l.dia_vencimento,
    avisoPrevioDias: l.aviso_previo_dias,
    indiceReajuste: l.indice_reajuste,
    status: l.status as StatusContratoTerceiro,
    observacoes: l.observacoes,
    criadoEm: l.criado_em,
  };
}

const COLUNAS_PROPRIETARIO =
  'id, nome, documento, contato_nome, contato_telefone, contato_email, observacoes, ativo, criado_em';

const COLUNAS_CONTRATO =
  'id, proprietario_id, numero, data_inicio, data_fim, dia_vencimento, aviso_previo_dias, indice_reajuste, status, observacoes, criado_em';

// =============================================================================
// Proprietários
// =============================================================================

export async function listarProprietarios(
  db: D1Database,
  filtros: { apenasAtivos?: boolean; busca?: string } = {},
): Promise<Proprietario[]> {
  const condicoes: string[] = [];
  const params: unknown[] = [];

  if (filtros.apenasAtivos) condicoes.push('ativo = 1');
  if (filtros.busca) {
    condicoes.push('(nome LIKE ? OR documento LIKE ?)');
    const termo = `%${filtros.busca}%`;
    params.push(termo, termo);
  }

  const where = condicoes.length ? ` WHERE ${condicoes.join(' AND ')}` : '';
  const sql = `SELECT ${COLUNAS_PROPRIETARIO} FROM proprietarios${where} ORDER BY nome`;

  const { results } = await db.prepare(sql).bind(...params).all<LinhaProprietario>();
  return results.map(mapProprietario);
}

export async function obterProprietario(
  db: D1Database,
  id: string,
): Promise<Proprietario | null> {
  const linha = await db
    .prepare(`SELECT ${COLUNAS_PROPRIETARIO} FROM proprietarios WHERE id = ?`)
    .bind(id)
    .first<LinhaProprietario>();
  return linha ? mapProprietario(linha) : null;
}

export async function criarProprietario(
  db: D1Database,
  entrada: NovoProprietario,
): Promise<Proprietario> {
  const proprietario: Proprietario = {
    id: novoId('prop'),
    nome: entrada.nome,
    documento: entrada.documento ?? null,
    contatoNome: entrada.contatoNome ?? null,
    contatoTelefone: entrada.contatoTelefone ?? null,
    contatoEmail: entrada.contatoEmail ?? null,
    observacoes: entrada.observacoes ?? null,
    ativo: entrada.ativo ?? true,
    criadoEm: agoraIso(),
  };

  await db
    .prepare(
      `INSERT INTO proprietarios
         (id, nome, documento, contato_nome, contato_telefone, contato_email, observacoes, ativo, criado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      proprietario.id,
      proprietario.nome,
      proprietario.documento,
      proprietario.contatoNome,
      proprietario.contatoTelefone,
      proprietario.contatoEmail,
      proprietario.observacoes,
      proprietario.ativo ? 1 : 0,
      proprietario.criadoEm,
    )
    .run();

  return proprietario;
}

/** Campos aceitos em atualização parcial de proprietário. */
const CAMPOS_PROPRIETARIO: Record<keyof NovoProprietario, string> = {
  nome: 'nome',
  documento: 'documento',
  contatoNome: 'contato_nome',
  contatoTelefone: 'contato_telefone',
  contatoEmail: 'contato_email',
  observacoes: 'observacoes',
  ativo: 'ativo',
};

export async function atualizarProprietario(
  db: D1Database,
  id: string,
  mudancas: Partial<NovoProprietario>,
): Promise<Proprietario | null> {
  const sets: string[] = [];
  const params: unknown[] = [];

  for (const chave of Object.keys(CAMPOS_PROPRIETARIO) as (keyof NovoProprietario)[]) {
    if (!(chave in mudancas)) continue;
    const valor = mudancas[chave];
    // Nome de coluna vem da tabela fechada acima; valor vai sempre como bind.
    sets.push(`${CAMPOS_PROPRIETARIO[chave]} = ?`);
    params.push(chave === 'ativo' ? (valor ? 1 : 0) : (valor ?? null));
  }

  if (sets.length === 0) return obterProprietario(db, id);

  params.push(id);
  await db
    .prepare(`UPDATE proprietarios SET ${sets.join(', ')} WHERE id = ?`)
    .bind(...params)
    .run();

  return obterProprietario(db, id);
}

/**
 * Quantos equipamentos ainda estão vinculados ao proprietário.
 * Usado para recusar a exclusão (409) em vez de apagar em cascata.
 */
export async function contarEquipamentosDoProprietario(
  db: D1Database,
  proprietarioId: string,
): Promise<{ total: number; ativos: number }> {
  const linha = await db
    .prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN data_devolucao_terceiro IS NULL THEN 1 ELSE 0 END) AS ativos
         FROM equipamentos
        WHERE proprietario_id = ?`,
    )
    .bind(proprietarioId)
    .first<{ total: number; ativos: number | null }>();

  return { total: linha?.total ?? 0, ativos: linha?.ativos ?? 0 };
}

/**
 * Desativa o proprietário (soft delete). Devolve `false` quando ele ainda tem
 * equipamento não devolvido — quem chama transforma isso em 409.
 */
export async function desativarProprietario(
  db: D1Database,
  id: string,
): Promise<{ ok: boolean; equipamentosAtivos: number }> {
  const { ativos } = await contarEquipamentosDoProprietario(db, id);
  if (ativos > 0) return { ok: false, equipamentosAtivos: ativos };

  await db.prepare('UPDATE proprietarios SET ativo = 0 WHERE id = ?').bind(id).run();
  return { ok: true, equipamentosAtivos: 0 };
}

/** Painel de proprietários com contagem de equipamentos e custo mensal somado. */
export async function listarResumoProprietarios(
  db: D1Database,
): Promise<ResumoProprietario[]> {
  const { results } = await db
    .prepare(
      `SELECT p.id, p.nome, p.documento, p.contato_nome, p.contato_telefone,
              p.contato_email, p.observacoes, p.ativo, p.criado_em,
              COUNT(e.id) AS total_equipamentos,
              SUM(CASE WHEN e.data_devolucao_terceiro IS NULL THEN 1 ELSE 0 END) AS equipamentos_ativos,
              COALESCE(SUM(CASE WHEN e.data_devolucao_terceiro IS NULL
                                THEN e.custo_mensal_terceiro ELSE 0 END), 0) AS custo_mensal_total
         FROM proprietarios p
         LEFT JOIN equipamentos e ON e.proprietario_id = p.id AND e.origem = 'Terceiro'
        GROUP BY p.id
        ORDER BY p.nome`,
    )
    .all<
      LinhaProprietario & {
        total_equipamentos: number;
        equipamentos_ativos: number | null;
        custo_mensal_total: number;
      }
    >();

  return results.map((l) => ({
    ...mapProprietario(l),
    totalEquipamentos: l.total_equipamentos,
    equipamentosAtivos: l.equipamentos_ativos ?? 0,
    custoMensalTotal: l.custo_mensal_total,
  }));
}

// =============================================================================
// Contratos
// =============================================================================

export async function listarContratos(
  db: D1Database,
  filtros: { proprietarioId?: string; status?: StatusContratoTerceiro } = {},
): Promise<ContratoTerceiro[]> {
  const condicoes: string[] = [];
  const params: unknown[] = [];

  if (filtros.proprietarioId) {
    condicoes.push('proprietario_id = ?');
    params.push(filtros.proprietarioId);
  }
  if (filtros.status) {
    condicoes.push('status = ?');
    params.push(filtros.status);
  }

  const where = condicoes.length ? ` WHERE ${condicoes.join(' AND ')}` : '';
  const { results } = await db
    .prepare(
      `SELECT ${COLUNAS_CONTRATO} FROM contratos_terceiro${where} ORDER BY data_inicio DESC`,
    )
    .bind(...params)
    .all<LinhaContrato>();

  return results.map(mapContrato);
}

export async function obterContrato(
  db: D1Database,
  id: string,
): Promise<ContratoTerceiro | null> {
  const linha = await db
    .prepare(`SELECT ${COLUNAS_CONTRATO} FROM contratos_terceiro WHERE id = ?`)
    .bind(id)
    .first<LinhaContrato>();
  return linha ? mapContrato(linha) : null;
}

export async function criarContrato(
  db: D1Database,
  entrada: NovoContratoTerceiro,
): Promise<ContratoTerceiro> {
  const contrato: ContratoTerceiro = {
    id: novoId('ctr'),
    proprietarioId: entrada.proprietarioId,
    numero: entrada.numero ?? null,
    dataInicio: entrada.dataInicio,
    dataFim: entrada.dataFim ?? null,
    diaVencimento: entrada.diaVencimento ?? null,
    avisoPrevioDias: entrada.avisoPrevioDias ?? null,
    indiceReajuste: entrada.indiceReajuste ?? null,
    status: entrada.status ?? 'Ativo',
    observacoes: entrada.observacoes ?? null,
    criadoEm: agoraIso(),
  };

  await db
    .prepare(
      `INSERT INTO contratos_terceiro
         (id, proprietario_id, numero, data_inicio, data_fim, dia_vencimento,
          aviso_previo_dias, indice_reajuste, status, observacoes, criado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      contrato.id,
      contrato.proprietarioId,
      contrato.numero,
      contrato.dataInicio,
      contrato.dataFim,
      contrato.diaVencimento,
      contrato.avisoPrevioDias,
      contrato.indiceReajuste,
      contrato.status,
      contrato.observacoes,
      contrato.criadoEm,
    )
    .run();

  return contrato;
}

const CAMPOS_CONTRATO: Record<keyof Omit<NovoContratoTerceiro, 'proprietarioId'>, string> = {
  numero: 'numero',
  dataInicio: 'data_inicio',
  dataFim: 'data_fim',
  diaVencimento: 'dia_vencimento',
  avisoPrevioDias: 'aviso_previo_dias',
  indiceReajuste: 'indice_reajuste',
  status: 'status',
  observacoes: 'observacoes',
};

export async function atualizarContrato(
  db: D1Database,
  id: string,
  mudancas: Partial<Omit<NovoContratoTerceiro, 'proprietarioId'>>,
): Promise<ContratoTerceiro | null> {
  const sets: string[] = [];
  const params: unknown[] = [];

  type ChaveContrato = keyof typeof CAMPOS_CONTRATO;
  for (const chave of Object.keys(CAMPOS_CONTRATO) as ChaveContrato[]) {
    if (!(chave in mudancas)) continue;
    sets.push(`${CAMPOS_CONTRATO[chave]} = ?`);
    params.push(mudancas[chave] ?? null);
  }

  if (sets.length === 0) return obterContrato(db, id);

  params.push(id);
  await db
    .prepare(`UPDATE contratos_terceiro SET ${sets.join(', ')} WHERE id = ?`)
    .bind(...params)
    .run();

  return obterContrato(db, id);
}

/**
 * Contratos com vencimento dentro da janela informada (padrão 90 dias).
 *
 * O alerta considera o aviso prévio: um contrato de 60 dias de aviso que vence
 * em 45 já está com a janela fechada, e é isso que o gestor precisa ver. Vem
 * junto quantos equipamentos daquele contrato estão locados agora — devolver
 * equipamento que está na casa de um cliente exige recolhimento antes.
 */
export async function listarContratosAVencer(
  db: D1Database,
  opcoes: { dias?: number; hoje?: string } = {},
): Promise<ContratoAVencer[]> {
  const dias = opcoes.dias ?? 90;
  const hoje = (opcoes.hoje ?? agoraIso()).slice(0, 10);
  const limite = new Date(Date.parse(`${hoje}T00:00:00Z`) + dias * 86400000)
    .toISOString()
    .slice(0, 10);

  const { results } = await db
    .prepare(
      `SELECT c.id, c.proprietario_id, c.numero, c.data_inicio, c.data_fim,
              c.dia_vencimento, c.aviso_previo_dias, c.indice_reajuste, c.status,
              c.observacoes, c.criado_em,
              p.nome AS proprietario_nome,
              (SELECT COUNT(*)
                 FROM equipamentos e
                 JOIN locacoes l ON l.equipamento_id = e.id AND l.status = 'Ativo'
                WHERE e.contrato_terceiro_id = c.id) AS equipamentos_locados
         FROM contratos_terceiro c
         JOIN proprietarios p ON p.id = c.proprietario_id
        WHERE c.status = 'Ativo'
          AND c.data_fim IS NOT NULL
          AND substr(c.data_fim, 1, 10) <= ?
        ORDER BY c.data_fim`,
    )
    .bind(limite)
    .all<LinhaContrato & { proprietario_nome: string; equipamentos_locados: number }>();

  const hojeMs = Date.parse(`${hoje}T00:00:00Z`);

  return results.map((l) => {
    const fimMs = Date.parse(`${(l.data_fim ?? hoje).slice(0, 10)}T00:00:00Z`);
    const diasParaVencer = Math.round((fimMs - hojeMs) / 86400000);
    return {
      ...mapContrato(l),
      proprietarioNome: l.proprietario_nome,
      diasParaVencer,
      avisoPrevioVencido:
        l.aviso_previo_dias != null && diasParaVencer <= l.aviso_previo_dias,
      equipamentosLocados: l.equipamentos_locados,
    };
  });
}
