/**
 * Acesso centralizado ao binding D1 do Cloudflare.
 *
 * Antes deste módulo, cada rota redeclarava sua própria `interface D1Database`
 * (`api/cooperado/agenda`, `api/cooperado/sync`, `api/gestor/prontuarios`) e fazia
 * o cast `(process.env.DB as unknown) as D1Database` na mão. Com o módulo de
 * equipamentos indo para o D1 isso se multiplicaria por dez.
 *
 * O projeto não depende de `@cloudflare/workers-types`, então os tipos do D1 são
 * declarados aqui — só a superfície que usamos. Se um dia o pacote entrar no
 * package.json, basta trocar estas declarações pelo import.
 */

/** Metadados devolvidos pelo D1 em cada execução. */
export interface D1Meta {
  duration?: number;
  changes?: number;
  last_row_id?: number;
  rows_read?: number;
  rows_written?: number;
}

export interface D1Result<T = Record<string, unknown>> {
  results: T[];
  success: boolean;
  meta: D1Meta;
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  first<T = unknown>(colName: string): Promise<T | null>;
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = Record<string, unknown>>(
    statements: D1PreparedStatement[],
  ): Promise<D1Result<T>[]>;
  exec(query: string): Promise<{ count: number; duration: number }>;
}

/** Erro lançado por `requireDb()` quando o binding não está disponível. */
export class D1IndisponivelError extends Error {
  constructor(mensagem = 'Banco D1 indisponível: binding "DB" não configurado.') {
    super(mensagem);
    this.name = 'D1IndisponivelError';
  }
}

/**
 * Devolve o binding D1 ou `undefined` quando ele não existe (dev local sem
 * `wrangler`, build, preview sem banco). Quem chama decide o fallback — algumas
 * rotas antigas devolvem dados mockados nesse caso.
 *
 * O binding chega via `process.env.DB` no runtime do next-on-pages: é um objeto,
 * não uma string, daí o cast em duas etapas.
 */
export function getDb(): D1Database | undefined {
  const binding = (process.env as unknown as Record<string, unknown>).DB;
  if (!binding || typeof binding !== 'object') return undefined;
  return binding as unknown as D1Database;
}

/** Igual a `getDb()`, mas estoura quando o banco não está configurado. */
export function requireDb(): D1Database {
  const db = getDb();
  if (!db) throw new D1IndisponivelError();
  return db;
}

/** `true` quando há binding D1 no ambiente atual. */
export function temDb(): boolean {
  return getDb() !== undefined;
}

/**
 * Id de linha. Prefixo curto por tabela ajuda a ler log e a distinguir de id do
 * Bubble (que tem 32 hex + timestamp). Na migração da Fase 4 os registros vindos
 * do Bubble mantêm o `_id` original, então os dois formatos convivem.
 */
export function novoId(prefixo: string): string {
  return `${prefixo}_${crypto.randomUUID().replace(/-/g, '')}`;
}

/** Timestamp ISO em UTC, formato usado em todas as colunas de data do D1. */
export function agoraIso(): string {
  return new Date().toISOString();
}
