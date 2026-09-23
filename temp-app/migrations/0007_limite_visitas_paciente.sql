-- Migration: 0007_limite_visitas_paciente.sql
-- Description: Adiciona limite/cota de visitas mensais do técnico por paciente e índice de busca mensal.

ALTER TABLE pacientes ADD COLUMN limite_visitas_mes INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_evolucoes_paciente_checkin ON evolucoes(paciente_id, check_in);
