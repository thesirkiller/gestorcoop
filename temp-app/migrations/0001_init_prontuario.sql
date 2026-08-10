-- Migration: 0001_init_prontuario.sql
-- Description: Inicialização das tabelas de prontuário, prescrições, aprazamentos e evoluções clínicas.

-- Tabela de Pacientes
CREATE TABLE IF NOT EXISTS pacientes (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    cpf TEXT,
    data_nascimento TEXT,
    endereco TEXT,
    warnings TEXT -- JSON array de strings (ex: Alergias)
);

-- Tabela de Prescrições Médicas
CREATE TABLE IF NOT EXISTS prescricoes (
    id TEXT PRIMARY KEY,
    paciente_id TEXT NOT NULL,
    medicamento TEXT NOT NULL,
    dosagem TEXT NOT NULL,
    via_administracao TEXT NOT NULL,
    frequencia_horas INTEGER NOT NULL,
    data_inicio TEXT NOT NULL,
    data_fim TEXT NOT NULL,
    FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE
);

-- Tabela de Aprazamento de Medicamentos (Turnos e checagens)
CREATE TABLE IF NOT EXISTS aprazamentos (
    id TEXT PRIMARY KEY,
    prescricao_id TEXT NOT NULL,
    horario_previsto TEXT NOT NULL, -- ISO Datetime
    horario_executado TEXT,         -- ISO Datetime
    status TEXT NOT NULL DEFAULT 'Pendente', -- 'Pendente', 'Administrado', 'Nao_Administrado'
    justificativa TEXT,
    profissional_id TEXT,
    assinatura_digital TEXT,
    FOREIGN KEY (prescricao_id) REFERENCES prescricoes(id) ON DELETE CASCADE
);

-- Tabela de Evoluções e Atendimentos
CREATE TABLE IF NOT EXISTS evolucoes (
    id TEXT PRIMARY KEY,
    paciente_id TEXT NOT NULL,
    profissional_id TEXT NOT NULL,
    tipo_profissional TEXT NOT NULL, -- 'Tecnico_Enfermagem', 'Medico', 'Terapeuta'
    turno TEXT,                      -- 'Diurno', 'Noturno', '24h'
    check_in TEXT NOT NULL,          -- ISO Datetime
    check_out TEXT NOT NULL,         -- ISO Datetime
    audio_url TEXT,                  -- URL do arquivo no R2
    transcricao_crua TEXT,
    transcricao_revisada TEXT,
    status TEXT NOT NULL DEFAULT 'Em_Andamento', -- 'Em_Andamento', 'Assinado_Pendente_Sync', 'Finalizado'
    data_assinatura TEXT,            -- ISO Datetime
    FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE
);
