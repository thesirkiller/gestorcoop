-- Migration: 0011_responsaveis_plantao.sql
-- Description: Cadastro de familiares/responsáveis pela validação da finalização do plantão (pacientes e evoluções).

ALTER TABLE pacientes ADD COLUMN responsaveis_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE evolucoes ADD COLUMN responsavel_id TEXT DEFAULT '';
ALTER TABLE evolucoes ADD COLUMN responsavel_nome TEXT DEFAULT '';
ALTER TABLE evolucoes ADD COLUMN responsavel_parentesco TEXT DEFAULT '';
