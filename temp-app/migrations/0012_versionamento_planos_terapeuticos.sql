-- Migração 0012: Versionamento e Ciclo Mensal Automático de Planos Terapêuticos
ALTER TABLE planos_terapeuticos ADD COLUMN versao INTEGER NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS idx_planos_paciente_versao ON planos_terapeuticos(paciente_id, versao DESC);
