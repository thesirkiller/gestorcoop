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
  // Banco "da época da 0001": pacientes, prescricoes e evolucoes sem as colunas adicionadas depois.
  db.sqlite.exec('CREATE TABLE pacientes (id TEXT PRIMARY KEY, nome TEXT NOT NULL, cpf TEXT, data_nascimento TEXT, endereco TEXT, warnings TEXT)');
  db.sqlite.exec('CREATE TABLE prescricoes (id TEXT PRIMARY KEY, paciente_id TEXT NOT NULL, medicamento TEXT NOT NULL, dosagem TEXT NOT NULL, via_administracao TEXT NOT NULL, frequencia_horas INTEGER NOT NULL, data_inicio TEXT NOT NULL, data_fim TEXT NOT NULL)');
  db.sqlite.exec('CREATE TABLE evolucoes (id TEXT PRIMARY KEY, paciente_id TEXT NOT NULL, profissional_id TEXT NOT NULL, tipo_profissional TEXT NOT NULL, turno TEXT, check_in TEXT NOT NULL, check_out TEXT NOT NULL, audio_url TEXT, transcricao_crua TEXT, transcricao_revisada TEXT, status TEXT NOT NULL DEFAULT "Em_Andamento", data_assinatura TEXT, assinatura_digital TEXT)');

  await garantirSchemaD1(db);

  assert.ok(db.idas > 10, `esperava o caminho de DDL completo (foram ${db.idas} idas)`);
  const colunas = (db.sqlite.prepare("SELECT name FROM pragma_table_info('pacientes')").all() as Array<{ name: string }>).map((c) => c.name);
  for (const c of ['telefone', 'complexidade', 'status', 'limite_visitas_mes']) assert.ok(colunas.includes(c), `coluna ${c} ausente em pacientes`);
  const colunasPresc = (db.sqlite.prepare("SELECT name FROM pragma_table_info('prescricoes')").all() as Array<{ name: string }>).map((c) => c.name);
  for (const c of ['medico_nome', 'horarios_padrao', 'status', 'instrucoes']) assert.ok(colunasPresc.includes(c), `coluna ${c} ausente em prescricoes`);
  const colunasEvol = (db.sqlite.prepare("SELECT name FROM pragma_table_info('evolucoes')").all() as Array<{ name: string }>).map((c) => c.name);
  for (const c of ['profissional_nome', 'soap_subjetivo', 'soap_objetivo', 'soap_avaliacao', 'soap_plano']) assert.ok(colunasEvol.includes(c), `coluna ${c} ausente em evolucoes`);
  const tabelas = (db.sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>).map((t) => t.name);
  for (const t of ['planos_terapeuticos', 'plano_terapeutico_metas', 'prescricoes', 'aprazamentos', 'sinais_vitais', 'pareceres_auditoria', 'evolucoes', 'auth_sessions']) {
    assert.ok(tabelas.includes(t), `tabela ${t} ausente`);
  }

  // Depois de garantido, o isolate não volta ao banco por causa de schema.
  db.zerarIdas();
  await garantirSchemaD1(db);
  assert.equal(db.idas, 0);
});
