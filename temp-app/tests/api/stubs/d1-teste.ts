/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Utilitários de teste: um D1 em memória sobre `node:sqlite`, com o schema real
 * (todas as migrations em ordem) e contador de idas ao banco.
 *
 * O contador é o ponto destes testes: no Cloudflare, o custo dominante de uma
 * tela é o número de round trips ao D1, não o tempo de CPU do SQLite.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * `node:sqlite` existe no Node 22.13+, mas o `@types/node` do projeto é o 20 e
 * não traz os tipos. Superfície mínima declarada aqui.
 */
interface SqliteStatement {
  get(...params: any[]): unknown;
  all(...params: any[]): unknown[];
  run(...params: any[]): { changes: number | bigint };
}
interface DatabaseSync {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
}
const { DatabaseSync } = require('node:sqlite') as { DatabaseSync: new (arquivo: string) => DatabaseSync };

export interface D1DeTeste {
  prepare(sql: string): any;
  batch(stmts: any[]): Promise<any[]>;
  exec(sql: string): Promise<{ count: number; duration: number }>;
  /** Idas ao "banco" desde a criação ou do último `zerarIdas()`. */
  idas: number;
  zerarIdas(): void;
  sqlite: DatabaseSync;
}

const linhasPlanas = (linhas: unknown[]) => linhas.map((l) => ({ ...(l as object) }));

export function criarD1DeTeste(opcoes: { aplicarMigrations?: boolean } = {}): D1DeTeste {
  const sqlite = new DatabaseSync(':memory:');
  if (opcoes.aplicarMigrations !== false) {
    const dir = path.join(__dirname, '..', '..', '..', 'migrations');
    for (const arquivo of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
      sqlite.exec(readFileSync(path.join(dir, arquivo), 'utf8'));
    }
  }

  const d1: D1DeTeste = {
    idas: 0,
    sqlite,
    zerarIdas() {
      d1.idas = 0;
    },
    prepare(sql: string) {
      const criar = (params: unknown[]): any => ({
        sql,
        params,
        bind: (...valores: unknown[]) => criar(valores),
        async first(coluna?: string) {
          d1.idas++;
          const linha = sqlite.prepare(sql).get(...(params as any[])) as any;
          if (!linha) return null;
          return coluna ? linha[coluna] : { ...linha };
        },
        async all() {
          d1.idas++;
          return { results: linhasPlanas(sqlite.prepare(sql).all(...(params as any[]))), success: true, meta: {} };
        },
        async run() {
          d1.idas++;
          const info = sqlite.prepare(sql).run(...(params as any[]));
          return { results: [], success: true, meta: { changes: Number(info.changes) } };
        },
      });
      return criar([]);
    },
    async batch(stmts: any[]) {
      d1.idas++;
      sqlite.exec('BEGIN');
      try {
        const saida = stmts.map((s) => ({
          results: linhasPlanas(sqlite.prepare(s.sql).all(...(s.params as any[]))),
          success: true,
          meta: {},
        }));
        sqlite.exec('COMMIT');
        return saida;
      } catch (erro) {
        sqlite.exec('ROLLBACK');
        throw erro;
      }
    },
    async exec(sql: string) {
      d1.idas++;
      sqlite.exec(sql);
      return { count: 0, duration: 0 };
    },
  };
  return d1;
}

/** Injeta o D1 de teste onde `getDb()` procura em produção. */
export function instalarContextoCloudflare(db: D1DeTeste | undefined): void {
  (globalThis as any)[Symbol.for('__cloudflare-request-context__')] = db ? { env: { DB: db } } : undefined;
}
