-- Expansão aditiva: não substitui pacientes nem remove dados existentes.
ALTER TABLE pacientes ADD COLUMN telefone TEXT NOT NULL DEFAULT '';
ALTER TABLE pacientes ADD COLUMN responsavel_nome TEXT NOT NULL DEFAULT '';
ALTER TABLE pacientes ADD COLUMN responsavel_telefone TEXT NOT NULL DEFAULT '';
ALTER TABLE pacientes ADD COLUMN diagnostico_principal TEXT NOT NULL DEFAULT '';
ALTER TABLE pacientes ADD COLUMN cid10 TEXT NOT NULL DEFAULT '';
ALTER TABLE pacientes ADD COLUMN complexidade TEXT NOT NULL DEFAULT 'Baixa';
ALTER TABLE pacientes ADD COLUMN plano_saude TEXT NOT NULL DEFAULT '';
ALTER TABLE pacientes ADD COLUMN numero_carteirinha TEXT NOT NULL DEFAULT '';
ALTER TABLE pacientes ADD COLUMN status TEXT NOT NULL DEFAULT 'Ativo';
ALTER TABLE pacientes ADD COLUMN created_at TEXT;
ALTER TABLE prescricoes ADD COLUMN medico_nome TEXT NOT NULL DEFAULT '';
ALTER TABLE prescricoes ADD COLUMN medico_crm TEXT NOT NULL DEFAULT '';
ALTER TABLE prescricoes ADD COLUMN horarios_padrao TEXT NOT NULL DEFAULT '[]';
ALTER TABLE prescricoes ADD COLUMN instrucoes TEXT NOT NULL DEFAULT '';
ALTER TABLE prescricoes ADD COLUMN status TEXT NOT NULL DEFAULT 'Ativa';
ALTER TABLE prescricoes ADD COLUMN created_at TEXT;
ALTER TABLE evolucoes ADD COLUMN profissional_nome TEXT NOT NULL DEFAULT '';
ALTER TABLE evolucoes ADD COLUMN soap_subjetivo TEXT;
ALTER TABLE evolucoes ADD COLUMN soap_objetivo TEXT;
ALTER TABLE evolucoes ADD COLUMN soap_avaliacao TEXT;
ALTER TABLE evolucoes ADD COLUMN soap_plano TEXT;

CREATE TABLE auth_embed_tickets (
  hash TEXT PRIMARY KEY, identity_json TEXT NOT NULL, expires_at INTEGER NOT NULL
);
CREATE TABLE auth_sessions (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, area TEXT NOT NULL,
  expires_at INTEGER NOT NULL, revoked_at INTEGER
);
CREATE INDEX idx_auth_ticket_exp ON auth_embed_tickets(expires_at);
CREATE INDEX idx_auth_session_exp ON auth_sessions(expires_at);
CREATE TABLE clinical_sync_receipts (
  user_id TEXT NOT NULL, action_id TEXT NOT NULL, payload_hash TEXT NOT NULL,
  created_at TEXT NOT NULL, PRIMARY KEY(user_id, action_id)
);
-- Toda assinatura posterior permanece imutável. Retificações devem ser novas evoluções.
CREATE TRIGGER evolucao_finalizada_imutavel BEFORE UPDATE ON evolucoes
WHEN OLD.status = 'Finalizado'
BEGIN SELECT RAISE(ABORT, 'Evolucao finalizada nao pode ser alterada'); END;
