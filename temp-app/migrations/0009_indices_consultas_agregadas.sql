-- Migration: 0009_indices_consultas_agregadas.sql
-- Description: Índices para as consultas agregadas do painel de prontuários.
--
-- - pareceres_auditoria era lida por paciente ordenada por data sem índice
--   (varredura completa a cada abertura de prontuário).
-- - A linha do tempo global de evoluções (`ORDER BY check_in DESC LIMIT 100`)
--   e a contagem de visitas do mês por intervalo de `check_in` não tinham índice
--   que começasse por `check_in`; os existentes começam por `paciente_id`.
-- - O filtro de plano vigente da listagem (`status = 'Ativo'` + vigência) varre
--   planos_terapeuticos inteira sem um índice por status.
--
-- Só índices: nenhuma alteração de dados, seguro para reaplicar.

CREATE INDEX IF NOT EXISTS idx_pareceres_paciente_data ON pareceres_auditoria(paciente_id, data_registro DESC);
CREATE INDEX IF NOT EXISTS idx_evolucoes_check_in ON evolucoes(check_in DESC);
CREATE INDEX IF NOT EXISTS idx_planos_status_vigencia ON planos_terapeuticos(status, data_inicio, data_fim);
