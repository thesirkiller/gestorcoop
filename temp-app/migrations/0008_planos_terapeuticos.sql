-- Migration: 0008_planos_terapeuticos.sql
-- Description: Cria tabelas para suporte a Planos Terapêuticos individualizados por paciente, vigência e metas por especialidade com cooperados designados.

CREATE TABLE IF NOT EXISTS planos_terapeuticos (
  id TEXT PRIMARY KEY,
  paciente_id TEXT NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  data_inicio TEXT NOT NULL,
  data_fim TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Ativo',
  observacoes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS plano_terapeutico_metas (
  id TEXT PRIMARY KEY,
  plano_id TEXT NOT NULL REFERENCES planos_terapeuticos(id) ON DELETE CASCADE,
  especialidade TEXT NOT NULL,
  quantidade_prevista INTEGER NOT NULL DEFAULT 1,
  profissionais_designados TEXT, -- JSON com lista de cooperados selecionados: [{"id":"...","nome":"..."}]
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_planos_terapeuticos_paciente ON planos_terapeuticos(paciente_id, data_inicio, data_fim);
CREATE INDEX IF NOT EXISTS idx_plano_metas_plano ON plano_terapeutico_metas(plano_id);
