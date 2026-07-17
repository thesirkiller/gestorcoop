# Plano: Correção do schema de equipamentos (Bubble × Next) e do bug do MCP

> ## ✅ PLANO CONCLUÍDO (2026-07-17)
> Módulo de equipamentos V2 **no ar em produção**. Tasks 2–5 concluídas; Task 1
> removida (não mexemos no MCP, por decisão do usuário).
> - **Schema:** 107/107 campos no Data API **live** + 10/10 option sets com valores 100%.
> - **Homologação:** 27/27 asserts verdes tanto no **version-test** quanto no **live**
>   (reserva, movimentação + máquina de estados + idempotência, OS + item + custo,
>   baixa com dupla autorização, alerta). Registros de teste sempre removidos.
> - **Produção:** `EQUIPAMENTOS_V2_ENABLED=true` ativo; crons `/api/cron/*` retornam 200.
> - **Ferramentas versionadas:** `temp-app/scripts/` (`equip:probe` / `equip:audit-values` / `equip:homolog`).
> - Único item não exercitado: suspensão de locação (não há `locacao_equipamento` no live/test;
>   schema de `suspensao_locacao` probado OK à parte, 5/5).
> - Commits: `3bfc572` (código) · `b179c87` (schema) · `6423e8a` (homolog) · `cd15d0a` (go-live) · `95e9a44` (scripts).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o módulo de equipamentos V2 funcionar de ponta a ponta corrigindo (1) o bug do befree-bubble-mcp que deixa campos "missing" no Bubble, (2) o schema quebrado/incompleto no Bubble e (3) a divergência de nomes de campo entre o código Next e o schema real.

**Contexto do diagnóstico (2026-07-16):**
- `EQUIPAMENTOS_V2_ENABLED` foi **desligado em produção** até este plano concluir.
- Data API live/test responde 404 `Field not found` para praticamente todos os campos dos tipos novos.
- Padrão confirmado empiricamente: campos **simples** (text/date/number/fk) persistiram em `alerta_equipamento`, `item_manutencao` e `suspensao_locacao`; **todo campo de option set** (`os_*`) está missing; e nos tipos `movimentacao_equipamento`, `reserva_equipamento`, `baixa_equipamento`, `ordem_servico_manutencao`, `conferencia_equipamento`, `higienizacao_equipamento` **nenhum campo** persistiu.
- Evidência do bug no MCP: no export base (`~/.config/bubble-mcp/contexts/gestorcoop/appgestorcoop.bubble`), o campo de option set que FUNCIONA em `equipamento` tem `value: "option.os_status_equipamento"` (prefixo `option.`), enquanto existe um artefato quebrado `display: "OS_status - deleted"` com `value: "os_status_equipamento"` (sem prefixo). O overlay de mutação (`appgestorcoop-mutation-overlay.json`) mostra o MCP gravando campos de option set com `%v` **sem** o prefixo `option.` (ex.: `{"%d":"os_status","%v":"os_status_reserva_equipamento"}`). Hipótese principal: formato/ordem incorreto na criação de campos de option set corrompe o campo (e, em alguns tipos, derruba o batch inteiro de campos).

**Arquitetura da correção:** o SCHEMA (overlay + aditivos abaixo) é a fonte da verdade; o código Next se alinha a ele. Campos novos só são adicionados ao Bubble quando o código gravaria dado que o schema não comporta (texto livre de responsável, chave de idempotência de alerta, campos de reversão de baixa etc.).

---

## Contrato de schema (fonte da verdade)

### Renomes no CÓDIGO (payloads/constraints/mappers → nome real do Bubble)

**movimentacao_equipamento**
| Código (errado) | Bubble (real) |
|---|---|
| fk_locacao_equipamento | fk_locacao |
| fk_nova_localizacao | fk_localizacao_nova |
| os_tipo_movimentacao | os_tipo_evento |
| txt_tipo_movimentacao | txt_tipo_evento |
| txt_status_anterior | os_status_anterior |
| txt_novo_status | os_status_novo |
| txt_responsavel | txt_responsavel_operacao |

Mantidos: fk_equipamento, fk_ordem_servico_manutencao, fk_domicilio, fk_localizacao_anterior, date_data_hora, txt_observacoes, txt_justificativa, txt_chave_idempotencia, bool_cancelado.

**reserva_equipamento**
| Código | Bubble |
|---|---|
| date_reserva | date_data_reserva |
| date_implantacao_prevista | date_prevista_implantacao |
| OS_status | os_status |

Mantidos: fk_equipamento, fk_paciente, fk_domicilio, date_validade, txt_observacoes, txt_chave_idempotencia, fk_movimentacao_reserva. Cancelamento deve gravar também `date_cancelamento` e `txt_motivo_cancelamento` (existem no schema). `txt_responsavel` → campo novo (aditivo).

**ordem_servico_manutencao**
| Código | Bubble |
|---|---|
| OS_status | os_status |
| OS_resultado | os_resultado |
| date_prazo_estimado | date_previsao_conclusao |

Mantidos: txt_numero_os, fk_equipamento, fk_movimentacao_entrada, date_entrada, date_diagnostico, date_conclusao, txt_motivo, txt_defeito_relatado, txt_defeito_encontrado, txt_causa_provavel, txt_servico_recomendado, txt_responsavel_tecnico, num_orcamento, num_custo_mao_obra, num_custo_frete, num_outros_custos, num_custo_total. Aditivos: txt_observacoes, txt_responsavel, num_custo_pecas.

**conferencia_equipamento**
| Código | Bubble |
|---|---|
| fk_movimentacao_equipamento | fk_movimentacao |
| txt_status_destino | os_status_destino |

Mantidos: fk_equipamento, date_conferencia, txt_estado_conservacao, txt_resultado, txt_observacoes. Aditivo: txt_responsavel.

**higienizacao_equipamento**
| Código | Bubble |
|---|---|
| date_fim | date_conclusao |
| OS_status | os_status |

Mantidos: fk_equipamento, date_inicio, txt_metodo, txt_resultado, txt_observacoes. Aditivo: txt_responsavel.

**baixa_equipamento**
| Código | Bubble |
|---|---|
| date_baixa (solicitação) | date_solicitacao |
| os_motivo_baixa | os_motivo |
| OS_status | os_status |
| txt_laudo | txt_laudo_tecnico |
| txt_observacoes | txt_observacoes_decisao |

Aprovação grava também date_baixa_efetiva (além de date_decisao). Mantidos: fk_equipamento, num_valor_reparo_estimado, num_valor_residual, txt_destino_final, date_decisao. Aditivos: txt_solicitante, txt_autorizado_por, bool_revertida, txt_revertida_por, txt_revertida_por_segundo, txt_justificativa_reversao, date_reversao.

**alerta_equipamento**
| Código | Bubble |
|---|---|
| fk_locacao_equipamento | fk_locacao |
| fk_ordem_servico_manutencao | fk_ordem_servico |
| os_tipo_alerta | os_tipo |
| OS_status | os_status |
| txt_descricao | txt_detalhe |
| date_prazo | date_vencimento |

Mantidos: fk_equipamento, txt_titulo, date_resolucao (schema tem também date_geracao, num_prioridade, bool_lido — não usados pelo código por ora). Aditivos: txt_prioridade, txt_resolucao, txt_chave_idempotencia, txt_responsavel.

**item_manutencao**
| Código | Bubble |
|---|---|
| fk_ordem_servico_manutencao | fk_ordem_servico |
| os_tipo | txt_tipo (é TEXT, não option set) |
| num_custo_unitario | num_valor_unitario |
| num_custo_total | num_valor_total |

Mantidos: txt_descricao, num_quantidade, txt_fornecedor. Aditivo: txt_responsavel.

**suspensao_locacao, equipamento, locacao_equipamento, domicilio**: sem mudanças (funcionam; `equipamento`/`locacao_equipamento` usam `OS_status` maiúsculo mesmo — NÃO alterar).

### Campos ADITIVOS a criar no Bubble (todos simples, sem option set)
- reserva_equipamento: txt_responsavel (text)
- conferencia_equipamento: txt_responsavel (text)
- higienizacao_equipamento: txt_responsavel (text)
- ordem_servico_manutencao: txt_responsavel (text), txt_observacoes (text), num_custo_pecas (number)
- alerta_equipamento: txt_responsavel (text), txt_prioridade (text), txt_resolucao (text), txt_chave_idempotencia (text)
- item_manutencao: txt_responsavel (text)
- baixa_equipamento: txt_solicitante (text), txt_autorizado_por (text), bool_revertida (boolean), txt_revertida_por (text), txt_revertida_por_segundo (text), txt_justificativa_reversao (text), date_reversao (date)

### Option sets e valores exigidos (verificar/criar valores faltantes)
- os_status_equipamento: todos os `StatusEquipamento` do código (18 valores, inclui legados).
- os_os_tipo_movimentacao_equipamento: todos os `TipoMovimentacaoEquipamento` (16 valores).
- os_status_reserva_equipamento: Ativa, Cancelada, Expirada, Convertida em implantação.
- os_status_ordem_servico_manutencao: Aberta, Em diagnóstico, Aguardando aprovação, Aguardando peça, Em execução, Em teste, Liberada, Reprovada, Sem reparo, Baixa recomendada, Cancelada.
- os_resultado_ordem_servico_manutencao: Reparado e liberado, Reparado com restrições, Aguardando peça, Sem defeito identificado, Reparo não aprovado, Sem reparo possível, Recomendado para baixa.
- os_status_baixa_equipamento: Pendente de aprovação, Aprovada, Reprovada, Cancelada.
- os_motivo_baixa_equipamento: valores padronizados existentes (verificar; criar "Sem reparo", "Custo inviável", "Obsolescência", "Extravio", "Outro" se vazio).
- os_status_higienizacao_equipamento: Aprovada, Reprovada, Em andamento.
- os_tipo_alerta_equipamento: os 12 `TipoAlertaEquipamento` do código.
- os_status_alerta_equipamento: Aberto, Em tratamento, Resolvido, Ignorado.

### Campos de option set a recriar/consertar (com formato correto `option.<set>`)
- movimentacao_equipamento: os_tipo_evento, os_status_anterior, os_status_novo, os_motivo_recolhimento — e TODOS os demais campos do tipo (batch inteiro falhou; lista completa no overlay).
- reserva_equipamento: os_status — e todos os demais campos (batch falhou).
- baixa_equipamento: os_motivo, os_status — e todos os demais (batch falhou).
- ordem_servico_manutencao: os_status, os_resultado — e todos os demais (batch falhou).
- conferencia_equipamento: os_status_destino — e todos os demais (batch falhou).
- higienizacao_equipamento: os_status — e todos os demais (batch falhou).
- alerta_equipamento: os_tipo, os_status (campos simples já existem).
- item_manutencao: nada de option set (txt_tipo é text; campos simples já existem).

### Verificação canônica (usada em todas as tarefas)
Probe via Data API (test): `GET /obj/<tipo>?constraints=[{"key":"<campo>","constraint_type":"is_not_empty"}]&limit=1` → **200** = campo existe; **404 Field not found** = missing.

---

### Task 1: ~~Corrigir o bug do befree-bubble-mcp~~ — REMOVIDA (2026-07-16)

**Decisão do usuário:** não alterar o código-fonte do MCP. A causa raiz está
documentada em `2026-07-16-mcp-fix-notes.md`, que também traz os **payloads brutos
validados** para `bubble_editor_write` (campo de option set com `%v = "option.<set>"`).
A Task 3 usa esses payloads crus diretamente, contornando o helper bugado
(`create_data_field`/`create_option_value`), portanto não depende de um fix no código.

### Task 2: Alinhar o código Next ao contrato — [Agente B]

**Files:** `temp-app/src/lib/bubble.ts`, `temp-app/src/lib/equipamentos-jobs.ts`, rotas em `temp-app/src/app/api/**` que usam fetch cru (baixas) e a página `temp-app/src/app/gestor/**` onde exibir campos renomeados

- [x] **Step 1:** Aplicar TODOS os renomes das tabelas do contrato nos payloads de escrita, constraints de busca e mappers de leitura (ler o valor novo com fallback pro antigo ao mapear, para tolerar dados legados).
- [x] **Step 2:** Rotas de baixa com fetch cru: migrar para os nomes reais (os_motivo, os_status, txt_laudo_tecnico, date_solicitacao/date_baixa_efetiva, txt_observacoes_decisao) e usar os métodos do bubbleApi onde possível.
- [x] **Step 3:** Cancelamento de reserva passa a gravar date_cancelamento e txt_motivo_cancelamento.
- [x] **Step 4:** `npx tsc --noEmit` e `npx next build` limpos.
- [x] **Step 5:** Commit.

### Task 3: Reconstruir o schema no Bubble (test) — [Agente C]

**Files:** nenhum no repo (escritas via MCP no app Bubble, ambiente test)

> **Sem dependência da Task 1.** Usar `bubble_editor_write` com os payloads brutos
> validados em `2026-07-16-mcp-fix-notes.md` (uma change por chamada; ordem option set →
> valores → campos; `%v = "option.<set>"` para option sets). Após CADA lote, rodar o probe
> canônico da Data API (200 = existe / 404 = missing).

- [x] **Step 1:** Contrato extraído direto do código (bubble.ts, pós-Task 2) cruzado com o overlay — fonte da verdade dos nomes/keys/tipos por campo.
- [x] **Step 2:** Todos os 10 option sets com valores auditados por escrita real (Data API): **100% dos valores exigidos presentes** após criar 22 faltantes (equipamento 18/18, movimentacao 16/16, reserva 4/4, os_status OS 11/11, os_resultado 7/7, baixa status 4/4, baixa motivo 5/5, higienizacao 3/3, alerta tipo 12/12, alerta status 4/4). Os 2 sets de alerta precisaram ser (re)criados no servidor + 2 campos quebrados de alerta deletados (colidiam por display name).
- [x] **Step 3:** Todos os 107 campos do contrato criados via `bubble_editor_write` cru (lote por tipo; `option.<set>` para option sets; FKs `custom.<tipo>`), incluindo aditivos. Campos `os_*` quebrados eram irrelevantes (nunca persistiram no servidor).
- [x] **Step 4:** Probe completo da Data API test: **107/107 OK, 0 MISS**. Tabela: movimentacao 16/16, reserva 13/13, ordem_servico 23/23, conferencia 8/8, higienizacao 8/8, baixa 18/18, item_manutencao 8/8, alerta 13/13.
- [x] **Step 5:** Nenhum deploy para produção feito. Usuário fará "Deploy to Live" ao final (Task 5).

**Descoberta-chave (2026-07-16):** a teoria de "campo quebrado corrompe o tipo" era falsa — nos tipos novos NENHUM campo havia persistido no servidor (o overlay só registra o que o MCP *enviou*; HTTP 200 ≠ persistência). Escritas cruas com `%v` correto persistem na hora. Solução: recriar todos os campos do zero via `bubble_editor_write`.

### Task 4: Homologação ponta a ponta — CONCLUÍDA (2026-07-16)

- [x] **Step 1:** Probe completo do contrato: 107/107 campos OK + 10/10 option sets com valores 100%.
- [x] **Step 2:** Homologação real via `bubbleApi` (script tsx com `.env.local`/version-test, `EQUIPAMENTOS_V2_ENABLED=true`): **27 asserts ✅ / 0 ❌**. Cobriu reserva criar→cancelar (date_cancelamento + txt_motivo_cancelamento); movimentação Disponível→Reservado (máquina de estados valida transição e REJEITA inválida; idempotência por chave retorna a mesma mov); OS→item (recálculo custo 2×30=60)→atualização (os_status/os_resultado); baixa solicitar→aprovar (date_baixa_efetiva)→reverter (dupla autorização); alerta criar + getAlertaPorChave idempotente. Todos os registros de teste removidos ao final.
- [x] **Step 3:** Único gap: cenário de suspensão pulado por falta de `locacao_equipamento` no version-test (schema de `suspensao_locacao` probado OK — 5/5 campos). Script de homologação e auditor de valores foram removidos do repo (eram descartáveis; podem ser recriados p/ probar o LIVE na Task 5).

### Task 5: Go-live (manual + assistido) — CONCLUÍDA (2026-07-16)

- [x] **Step 1 (usuário):** "Deploy to Live" feito no editor Bubble.
- [x] **Step 2:** Probe do contrato no Data API **LIVE**: **107/107 campos OK** + valores dos option sets 100% (amostra dos sets corrigidos verde).
- [x] **Step 3:** `EQUIPAMENTOS_V2_ENABLED=true` **já ativo em produção** (Cloudflare Pages `gestorcoop`, git-integrado) — confirmado pelos crons (guard retornaria 503 se off).
- [x] **Step 4:** `POST /api/cron/alertas-gerar` → 200 `{criados:0,porTipo:{},falhas:[]}`; `POST /api/cron/reservas-expirar` → 200 `{expiradas:0,falhas:[]}`. Jobs leram o schema LIVE sem falhas.
