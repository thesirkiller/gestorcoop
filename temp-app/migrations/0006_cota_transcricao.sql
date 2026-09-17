-- Medição de consumo de IA por cooperado.
--
-- A cota de transcrição é um pote único: no Workers AI são 10.000 neurons/dia
-- para a conta inteira, e na OpenAI é um crédito pré-pago compartilhado. Sem
-- teto por pessoa, um cooperado gravando plantão inteiro consome a cota de toda
-- a cooperativa e os demais ficam sem transcrever — em campo, isso é o
-- profissional sem conseguir registrar evolução.
--
-- Uma linha por tentativa (não um contador agregado) porque o mesmo dado serve
-- de trilha de auditoria: quem transcreveu, quando, quanto áudio, por qual
-- provedor e se deu certo.
CREATE TABLE IF NOT EXISTS uso_transcricao (
  id TEXT PRIMARY KEY,
  cooperado_id TEXT NOT NULL,
  dia TEXT NOT NULL,                        -- YYYY-MM-DD em UTC, casa com a janela da cota
  criado_em TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  minutos_estimados REAL NOT NULL,          -- derivado dos bytes; o cliente não é fonte confiável de duração
  provedor TEXT,                            -- workersai | groq | openai | null quando nenhum respondeu
  sucesso INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_uso_transcricao_cooperado_dia ON uso_transcricao(cooperado_id, dia);
CREATE INDEX IF NOT EXISTS idx_uso_transcricao_dia ON uso_transcricao(dia);
