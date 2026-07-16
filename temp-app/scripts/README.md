# Scripts de homologação — módulo de equipamentos V2

Ferramentas para validar o schema e os fluxos do módulo de equipamentos contra
o Bubble Data API. Todas leem `BUBBLE_API_URL` / `BUBBLE_API_TOKEN` do ambiente
(ou do `../.env.local`), então **não têm segredos hardcoded**.

## Alvo (test x live)

Por padrão usam o `.env.local` (aponta para `version-test`). Para rodar contra
o **live**, sobrescreva a URL:

```bash
# test (padrão)
npx tsx scripts/probar-schema.mts

# live
BUBBLE_API_URL=https://gestorcoop.app/api/1.1 npx tsx scripts/probar-schema.mts
```

## Scripts

| Script | O que faz | Escreve? |
|---|---|---|
| `probar-schema.mts` | GET com `is_not_empty` em cada um dos 107 campos do contrato. 200 = existe / 404 = faltando. | Não (read-only) |
| `auditar-option-values.mts` | Testa cada valor de option set exigido pelo código gravando um registro descartável. Reporta faltantes em `_missing_values.json`. | Cria+apaga registros de teste |
| `homologacao-equipamentos.mts` | Exercita os fluxos reais via `bubbleApi`: reserva, movimentação (máquina de estados + idempotência), OS+item+custo, baixa (dupla autorização), alerta. | Cria+apaga registros de teste (inclui 1 equipamento descartável) |

Todos saem com código 0 em sucesso e 1 se houver falha/faltante (úteis em CI).

## ⚠️ Rodar contra o live

`auditar-option-values` e `homologacao-equipamentos` **criam e apagam registros
descartáveis** no ambiente alvo. Contra o live isso mexe em dados de produção
(sempre limpando ao final). Prefira o `version-test`; use o live só para uma
verificação pontual pós-deploy.

## Reconstruir o schema (referência)

O passo a passo de reconstrução do schema (campos + option sets + valores via
`bubble_editor_write`) e as descobertas do diagnóstico estão em
`docs/superpowers/plans/2026-07-16-correcao-schema-equipamentos.md` e
`docs/superpowers/plans/2026-07-16-mcp-fix-notes.md`.
