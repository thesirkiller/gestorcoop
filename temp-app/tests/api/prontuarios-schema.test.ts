/**
 * Sonda de schema: precisa de processo próprio porque `garantirSchemaD1`
 * memoriza o resultado no módulo (uma vez por isolate, como em produção).
 * O `node --test` já roda cada arquivo num processo separado.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarD1DeTeste } from './stubs/d1-teste';
import { garantirSchemaD1 } from '../../src/lib/db/prontuarios';

test('schema antigo (sem colunas/tabelas novas): a sonda falha e o DDL completo roda', async () => {
  const db = criarD1DeTeste({ aplicarMigrations: false });
  // Banco "da época da 0001": pacientes sem as colunas adicionadas depois.
  db.sqlite.exec('CREATE TABLE pacientes (id TEXT PRIMARY KEY, nome TEXT NOT NULL, cpf TEXT, data_nascimento TEXT, endereco TEXT, warnings TEXT)');

  await garantirSchemaD1(db);

  assert.ok(db.idas > 10, `esperava o caminho de DDL completo (foram ${db.idas} idas)`);
  const colunas = (db.sqlite.prepare("SELECT name FROM pragma_table_info('pacientes')").all() as any[]).map((c) => c.name);
  for (const c of ['telefone', 'complexidade', 'status', 'limite_visitas_mes']) assert.ok(colunas.includes(c), `coluna ${c} ausente`);
  const tabelas = (db.sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as any[]).map((t) => t.name);
  for (const t of ['planos_terapeuticos', 'plano_terapeutico_metas', 'prescricoes', 'aprazamentos', 'sinais_vitais', 'pareceres_auditoria', 'evolucoes']) {
    assert.ok(tabelas.includes(t), `tabela ${t} ausente`);
  }

  // Depois de garantido, o isolate não volta ao banco por causa de schema.
  db.zerarIdas();
  await garantirSchemaD1(db);
  assert.equal(db.idas, 0);
});
