-- Migration: 0010_otimizacao_prescricoes_pacientes.sql
-- Description: Índices para contagem escalável de prescrições ativas por paciente e busca/ordenação de pacientes

CREATE INDEX IF NOT EXISTS idx_prescricoes_paciente_status ON prescricoes(paciente_id, status);
CREATE INDEX IF NOT EXISTS idx_pacientes_nome ON pacientes(nome COLLATE NOCASE);
