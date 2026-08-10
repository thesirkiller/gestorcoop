-- Migration: 0003_assinatura_evolucao.sql
-- Description: Selo de assinatura na evolução clínica.
--
-- A tabela `evolucoes` (migration 0001) registrava `data_assinatura` mas não
-- guardava assinatura nenhuma — só `aprazamentos` tinha a coluna, e mesmo lá o
-- valor gravado era a string fixa 'ass_hash_digital_tecnico_enfermagem',
-- idêntica em todos os registros e portanto sem valor probatório.
--
-- O selo agora é um HMAC-SHA256 sobre (evolução, cooperado, instante,
-- conteúdo), no formato `v1:<cooperadoId>:<instante>:<hex>` — ver
-- `gerarSeloAssinatura` em src/lib/sessao-cooperado.ts. Ele prova integridade e
-- atribuição; NÃO é assinatura com validade jurídica (para isso, certificado
-- ICP-Brasil, como já se usa nos termos via ZapSign).

ALTER TABLE evolucoes ADD COLUMN assinatura_digital TEXT;
