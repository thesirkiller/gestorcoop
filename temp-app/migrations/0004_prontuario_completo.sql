-- Migration: 0004_prontuario_completo.sql
-- Description: Expansão do Prontuário Clínico: sinais vitais, formato SOAP, histórico e auditoria clínica.

-- Tabela de Sinais Vitais
CREATE TABLE IF NOT EXISTS sinais_vitais (
    id TEXT PRIMARY KEY,
    paciente_id TEXT NOT NULL,
    evolucao_id TEXT,
    data_hora TEXT NOT NULL,
    pa_sistolica INTEGER,
    pa_diastolica INTEGER,
    fc_bpm INTEGER,
    fr_rpm INTEGER,
    temp_celsius REAL,
    spo2_percent INTEGER,
    glicemia_mg_dl INTEGER,
    dor_escala INTEGER,
    nivel_consciencia TEXT,
    observacoes TEXT,
    profissional_id TEXT,
    profissional_nome TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE
);

-- Tabela de Pareceres de Auditoria Clínica
CREATE TABLE IF NOT EXISTS pareceres_auditoria (
    id TEXT PRIMARY KEY,
    paciente_id TEXT NOT NULL,
    evolucao_id TEXT,
    auditor_id TEXT NOT NULL,
    auditor_nome TEXT NOT NULL,
    tipo_parecer TEXT NOT NULL, -- 'Conforme', 'Pendente', 'Inconformidade', 'Recomendacao_Clinica'
    descricao TEXT NOT NULL,
    data_registro TEXT NOT NULL,
    FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE
);

-- Índices de performance clínica
CREATE INDEX IF NOT EXISTS idx_sinais_vitais_paciente ON sinais_vitais(paciente_id, data_hora DESC);
CREATE INDEX IF NOT EXISTS idx_evolucoes_paciente ON evolucoes(paciente_id, check_in DESC);
CREATE INDEX IF NOT EXISTS idx_prescricoes_paciente ON prescricoes(paciente_id);
CREATE INDEX IF NOT EXISTS idx_aprazamentos_prescricao ON aprazamentos(prescricao_id, horario_previsto);
