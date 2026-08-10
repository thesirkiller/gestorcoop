# Equipamentos de Terceiros (sublocação) + Migração do Módulo para o D1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) ou superpowers:executing-plans para implementar tarefa a tarefa. Steps usam checkbox (`- [ ]`).

**Goal:** Cadastrar equipamentos que a cooperativa aluga de outras empresas e subloca aos clientes, com custo fixo mensal por equipamento, e entregar relatórios exclusivos desses equipamentos — impressos pelo gestor em PDF, no mesmo padrão do romaneio.

**Modelo de negócio (confirmado com o solicitante em 2026-08-10):**
- O equipamento pertence a uma empresa terceira. A cooperativa **paga aluguel fixo mensal** por ele e **subloca** ao cliente.
- O custo corre **independente de estar locado ou não** — equipamento de terceiro parado é prejuízo direto.
- Os relatórios são acessados **só pelo gestor**, que imprime e envia. Sem login novo, sem portal, sem permissão por proprietário.

---

## Decisão de arquitetura: o módulo de equipamentos vai para o D1

Medição feita na Data API em 2026-08-10, nos dois ambientes:

| Tipo no Bubble | `version-test` | `version-live` |
|---|---|---|
| `equipamento` | 4 (3 "API AUTO TEST") | **31** |
| `movimentacao_equipamento` | 0 | **106** |
| `locacao_equipamento` | 0 | 2 |
| `ordem_servico_manutencao` | 0 | 2 |
| `domicilio` | 0 | **0 — e sem campos nos dois ambientes** |
| `fornecedor_equipamento` | 0 | 0 |
| `locais_de_trabalho_pacientes` (clientes) | 40 | 59 — **dado real** |

O módulo **não** está vazio em produção: a homologação de julho/2026 é real. A migração é um script de verdade sobre ~140 registros — trabalho de horas, não de minutos, mas ainda perfeitamente tratável e mais barato hoje do que daqui a seis meses.

Quatro razões para migrar:

1. **A janela ainda é boa, mas está fechando.** 31 equipamentos e 106 movimentações migram com um script idempotente. Esse número só cresce.
2. **O schema do Bubble está furado e isso quebrou produção.** O tipo `domicilio` existe, está exposto na API e **não tem um único campo criado — nem no test, nem no live**. Foi o que derrubou o cadastro de locação em 2026-08-10 (`Field not found fk_paciente for type domicilio`). Existe ainda uma camada de tradução de nomes viva no código (`bubble.ts:463` mapeia `OS_status` → `txt_status`) porque o schema divergiu do que o código espera.
3. **Os relatórios pedidos são agregações, e a Data API do Bubble não agrega.** Não há `GROUP BY`: hoje `getAllResults` pagina a tabela inteira e o cálculo acontece em JS (ver `equipamentos-relatorios/page.tsx`). Margem por equipamento e ociosidade por período são uma query SQL no D1 e um algoritmo de várias páginas no Bubble.
4. **O D1 impõe as regras que o Bubble não impõe.** Um `CHECK` recusa equipamento marcado como terceiro sem proprietário e sem custo. No Bubble isso seria validação de aplicação — e só onde alguém lembrasse de escrever.

**O que NÃO migra:** clientes (`locais_de_trabalho_pacientes`, 40 registros), cooperados, adesão, termos, financeiro. São dado real e provavelmente têm workflows do Bubble fora deste repo. O D1 referencia o cliente por `cliente_bubble_id TEXT`, sem foreign key — bancos diferentes.

**O que explicitamente descartamos:** deixar equipamentos próprios no Bubble e só os de terceiros no D1. Todo relatório teria que juntar dois bancos em código de aplicação, e "qual o total do mês" viraria duas consultas e uma soma manual. Ou vai tudo, ou fica tudo.

🚨 **URGENTE, antes de qualquer coisa:** o `domicilio` do **`version-live` também está sem o campo `fk_paciente`**. Se `EQUIPAMENTOS_V2_ENABLED` estiver `true` nas variáveis de ambiente do Cloudflare Pages, **o cadastro de locação está quebrado em produção neste momento**, com o mesmo 404. Conferir isso antes de tocar em qualquer outra tarefa deste plano.

**Tech Stack:** Next.js 14 (App Router, edge runtime), Cloudflare D1 + Pages, React, TypeScript, Tailwind, Playwright.

---

## FASE 0 — Desbloqueio imediato e preparação

### Task 1: Criar os campos que faltam no `domicilio` — ✅ CONCLUÍDA em `version-test` (2026-08-10)

**Descartada a ideia de desligar `EQUIPAMENTOS_V2_ENABLED`.** A flag guarda **31 arquivos de rota** (alertas, baixas, reservas, conferências, higienizações, histórico, manutenções, rentabilidade, suspensões, demonstrativo e toda a página `/gestor/equipamentos-relatorios`), todos devolvendo 503 quando ela está `false`. Desligar para destravar um formulário derrubaria o módulo inteiro.

- [x] **Step 1:** 12 campos criados no tipo `domicilio` via MCP (`create_data_field`), todos com status 200:

| Campo | Tipo |
|---|---|
| `fk_paciente` | `custom.locais_de_trabalho_pacientes` (relação) |
| `geo_endereco` | `geographic_address` |
| `txt_cep`, `txt_numero`, `txt_complemento`, `txt_bairro`, `txt_cidade`, `txt_estado`, `txt_ponto_referencia`, `txt_contato_local`, `txt_instrucoes_acesso` | `text` |
| `bool_ativo` | `boolean` |

O tipo de `fk_paciente` foi espelhado de `locacao_equipamento.fk_paciente`, confirmado no export do app (`user_types/locacao-equipamento.json`) — é relação, não texto.

- [x] **Step 2:** Verificado pela Data API: 12/12 campos respondem 200 a constraint.
- [x] **Step 3:** Teste ponta a ponta com registro descartável (criado e apagado): `POST /obj/domicilio` → 201; o Bubble **geocodifica** o endereço em texto e devolve `{address, lat, lng}`, formato que `mapDomicilio` (`bubble.ts:540`) já trata; busca por constraint `fk_paciente equals <id>` → 200 com 1 resultado; `DELETE` → 204.
- [x] **Step 4: Deploy no Bubble** feito pelo usuário. Verificado em produção: 12/12 campos respondem, e o fluxo completo (POST → busca por constraint → DELETE) passou contra `/api/1.1`, deixando a base como estava (0 domicílios antes e depois).
- [x] **Step 5: Cobertura E2E** em `tests/e2e/equipamentos.spec.ts`, seção "Registro de locação" — 4 testes novos: só equipamento `Disponível` é ofertado; payload do POST; a mensagem do Bubble aparece no modal sem perder o preenchimento (regressão do bug); e o fallback genérico. Suíte inteira: 10/10 PASS, `tsc --noEmit` PASS, `lint` PASS (só o warning pré-existente em `manutencao/page.tsx`).
- [ ] **Step 6:** Registrar a locação pendente (Maria Narcisa) pela interface. Endereço já conferido (`R. Nova, Goianira - GO`), e nenhum dos 59 clientes do live está sem endereço, então a validação de endereço não barra ninguém.

**Observação de UI (não corrigida):** `errorMsg` é compartilhado entre o banner da página e o do modal, então o erro de locação aparece duas vezes na tela — atrás e dentro do modal. Não quebra nada; os testes escopam a asserção ao `dialog`.

### Task 2: Verificar se produção está quebrada

- [ ] **Step 1:** Conferir o valor de `EQUIPAMENTOS_V2_ENABLED` nas variáveis de ambiente do Cloudflare Pages. Se estiver `true`, o cadastro de locação em produção está caindo no mesmo 404 do `domicilio` — desligar imediatamente.
- [ ] **Step 2:** Se estiver quebrado, checar se alguém tentou cadastrar locação recentemente e perdeu o registro (`locacao_equipamento` no live tem só 2 registros para 31 equipamentos, o que é pouco e merece um olhar).
- [ ] **Step 3:** Volume em live já medido em 2026-08-10 (tabela acima). Repetir a contagem antes da Fase 4, já que ela vai mudar até lá.

### Task 3: Provisionar o D1 de verdade

- [ ] **Step 1:** `wrangler.toml:8` está com `database_id = "local"`, que só serve para o sqlite de desenvolvimento. Criar o banco real (`wrangler d1 create gestorcoop-db`) e preencher o id.
- [ ] **Step 2:** Centralizar o acesso ao binding num módulo único (`src/lib/db/client.ts`). Hoje `api/cooperado/agenda/route.ts:9`, `api/cooperado/sync/route.ts:8` e `api/gestor/prontuarios/route.ts:7` **cada um redeclara a interface `D1Database`** e faz `(process.env.DB as unknown)`. Isso vai multiplicar por dez com as rotas novas. Consolidar em um `getDb()` tipado.

---

## FASE 1 — Fundação do schema no D1

### Task 4: Migration do módulo de equipamentos

**Files:** Create: `temp-app/migrations/0002_equipamentos.sql`

- [ ] **Step 1: Proprietários e contratos de entrada**

```sql
CREATE TABLE IF NOT EXISTS proprietarios (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    documento TEXT,                      -- CNPJ/CPF
    contato_nome TEXT,
    contato_telefone TEXT,
    contato_email TEXT,
    observacoes TEXT,
    ativo INTEGER NOT NULL DEFAULT 1,
    criado_em TEXT NOT NULL
);

-- Contrato pelo qual a cooperativa aluga DO terceiro (não confundir
-- com a locação, que é o que a cooperativa aluga PARA o cliente).
CREATE TABLE IF NOT EXISTS contratos_terceiro (
    id TEXT PRIMARY KEY,
    proprietario_id TEXT NOT NULL REFERENCES proprietarios(id),
    numero TEXT,
    data_inicio TEXT NOT NULL,
    data_fim TEXT,                       -- NULL = prazo indeterminado
    dia_vencimento INTEGER,              -- 1..31
    aviso_previo_dias INTEGER,
    indice_reajuste TEXT,
    status TEXT NOT NULL DEFAULT 'Ativo',
    observacoes TEXT,
    criado_em TEXT NOT NULL,
    CHECK (status IN ('Ativo','Encerrado','Suspenso'))
);
```

- [ ] **Step 1b:** `indice_reajuste` é campo puramente informativo (anotação do que o contrato diz). **Não implementar cálculo de reajuste**: o gestor edita o `custo_mensal_terceiro` na mão quando o valor muda. Confirmado em 2026-08-10.

- [ ] **Step 2: Equipamentos, com a regra de terceiro imposta pelo banco**

```sql
CREATE TABLE IF NOT EXISTS equipamentos (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    marca TEXT,
    modelo TEXT,
    numero_serie TEXT,
    patrimonio TEXT,
    categoria TEXT,
    status TEXT NOT NULL DEFAULT 'Disponível',
    origem TEXT NOT NULL DEFAULT 'Proprio',
    -- Campos de terceiro: só fazem sentido quando origem = 'Terceiro'
    proprietario_id TEXT REFERENCES proprietarios(id),
    contrato_terceiro_id TEXT REFERENCES contratos_terceiro(id),
    custo_mensal_terceiro REAL,
    data_entrada_terceiro TEXT,
    data_devolucao_terceiro TEXT,
    valor_mensal_padrao REAL,
    criado_em TEXT NOT NULL,
    CHECK (origem IN ('Proprio','Terceiro')),
    -- Esta é a regra que o Bubble não conseguia garantir:
    CHECK (origem = 'Proprio' OR (proprietario_id IS NOT NULL
                                  AND custo_mensal_terceiro IS NOT NULL
                                  AND data_entrada_terceiro IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_equip_origem ON equipamentos(origem, proprietario_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_equip_serie ON equipamentos(numero_serie)
    WHERE numero_serie IS NOT NULL AND numero_serie <> '';
```

- [ ] **Step 2b:** O `UNIQUE` parcial em `numero_serie` é intencional: hoje nada impede cadastrar o mesmo equipamento duas vezes, e com terceiro isso vira custo mensal duplicado numa fatura. Se a base tiver série repetida legítima (não deveria), esse índice falha na migração — checar antes.

- [ ] **Step 3: Domicílios e locações**

```sql
CREATE TABLE IF NOT EXISTS domicilios (
    id TEXT PRIMARY KEY,
    cliente_bubble_id TEXT NOT NULL,     -- id em locais_de_trabalho_pacientes; sem FK, outro banco
    endereco TEXT NOT NULL,
    cep TEXT, numero TEXT, complemento TEXT,
    bairro TEXT, cidade TEXT, estado TEXT,
    ponto_referencia TEXT,
    contato_local TEXT,
    instrucoes_acesso TEXT,
    ativo INTEGER NOT NULL DEFAULT 1,
    criado_em TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS locacoes (
    id TEXT PRIMARY KEY,
    equipamento_id TEXT NOT NULL REFERENCES equipamentos(id),
    cliente_bubble_id TEXT NOT NULL,
    cliente_nome_cache TEXT,             -- ver Step 3b
    domicilio_id TEXT REFERENCES domicilios(id),
    data_inicio TEXT NOT NULL,
    data_fim_previsto TEXT,
    data_fim_real TEXT,
    valor_mensal REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'Ativo',
    observacoes TEXT,
    criado_em TEXT NOT NULL,
    CHECK (status IN ('Ativo','Finalizado','Cancelado'))
);

CREATE INDEX IF NOT EXISTS idx_loc_equip ON locacoes(equipamento_id, status);
CREATE INDEX IF NOT EXISTS idx_loc_cliente ON locacoes(cliente_bubble_id, status);
CREATE INDEX IF NOT EXISTS idx_loc_periodo ON locacoes(data_inicio, data_fim_real);
```

- [ ] **Step 3b:** `cliente_nome_cache` é desnormalização deliberada. Sem ela, todo relatório vira uma chamada ao Bubble por linha e o PDF quebra se o Bubble estiver fora do ar. Atualizar no momento da gravação da locação; a fonte da verdade continua sendo o Bubble.

- [ ] **Step 4: Movimentações** — porte igual ao `movimentacao_equipamento` do Bubble, com `chave_idempotencia TEXT UNIQUE` (no Bubble a idempotência era conferida com uma busca antes de gravar; aqui o índice único resolve de vez).

### Task 5: Camada de acesso

**Files:** Create: `temp-app/src/lib/db/equipamentos.ts`, `temp-app/src/lib/db/terceiros.ts`

- [ ] **Step 1:** Funções de leitura/escrita tipadas, com os tipos de domínio em português e sem os prefixos `txt_`/`fk_` do Bubble — é a chance de largar a nomenclatura herdada.
- [ ] **Step 2:** Sem ORM. Query builder manual com prepared statements (`db.prepare(...).bind(...)`). Nunca interpolar valor em string SQL.
- [ ] **Step 3:** Testes unitários das funções de cálculo (custo pro-rata, dias de ociosidade) com D1 local via `wrangler d1 execute --local`.

---

## FASE 2 — Cadastro de terceiros

### Task 6: CRUD de proprietários e contratos

**Files:** Create: `temp-app/src/app/api/gestor/proprietarios/route.ts`, `.../[id]/route.ts`, `.../contratos/route.ts`; `temp-app/src/app/gestor/terceiros/page.tsx`

- [ ] **Step 1:** Listagem de proprietários com total de equipamentos e custo mensal somado por proprietário.
- [ ] **Step 2:** Formulário de proprietário (nome, documento, contato).
- [ ] **Step 3:** Formulário de contrato (vigência, dia de vencimento, aviso prévio, índice de reajuste).
- [ ] **Step 4:** Bloquear exclusão de proprietário que tenha equipamento ativo vinculado — devolver 409 com a contagem, não apagar em cascata.

### Task 7: Origem no cadastro de equipamento

**Files:** Modify: `temp-app/src/app/gestor/equipamentos/page.tsx`

- [ ] **Step 1:** Seletor "Origem: Próprio / Terceiro" no formulário de equipamento.
- [ ] **Step 2:** Ao escolher "Terceiro", revelar e exigir: proprietário, contrato, custo mensal, data de entrada. Espelha o `CHECK` do banco — a UI avisa antes, o banco garante depois.
- [ ] **Step 3:** Selo visual "Terceiro" na listagem, com o nome do proprietário, no mesmo padrão dos selos já usados em `equipamentos/page.tsx:1186`.
- [ ] **Step 4:** Filtro por origem e por proprietário na listagem.

---

## FASE 3 — Relatórios exclusivos de terceiros

Todos seguem o padrão já validado no romaneio: página client-side, bloco `#print-area`, `@media print` com A4 e margem 12mm, botão que chama `window.print()`, gestor salva como PDF. Ver `equipamentos/romaneio/page.tsx:122`.

### Task 8: Prestação de contas por proprietário

O relatório para conferir a fatura que o terceiro manda todo mês.

**Files:** Create: `temp-app/src/app/gestor/terceiros/prestacao-contas/page.tsx`

- [ ] **Step 1:** Filtro por proprietário e competência (mês/ano).
- [ ] **Step 2:** Tabela: equipamento, série, data de entrada, data de devolução, dias no período, custo mensal, valor devido no mês.
- [ ] **Step 3:** Total do período em destaque, para bater contra a fatura recebida.
- [ ] **Step 4:** Cabeçalho com dados do proprietário, número do contrato e competência.

⚠️ **Decisão pendente — pro-rata.** Equipamento que entra dia 20: cobra mês cheio ou proporcional? Muda a fórmula e o total. Enquanto não houver resposta, implementar **proporcional por dias corridos** e deixar a regra isolada numa função pura (`calcularCustoPeriodo`) para trocar sem tocar na tela. Conferir os contratos assinados antes de fechar.

### Task 9: Margem e ociosidade — o relatório que paga a conta

Como o custo corre com o equipamento parado, este é o relatório que mostra onde está vazando dinheiro. Recomendo priorizar sobre o Task 8.

**Files:** Create: `temp-app/src/app/gestor/terceiros/margem/page.tsx`

- [ ] **Step 1:** Por equipamento de terceiro, no período: custo pago ao proprietário, receita gerada nas locações, margem (receita − custo), dias locado, dias ocioso, taxa de ocupação.
- [ ] **Step 2:** Destacar em vermelho todo equipamento com margem negativa no período.
- [ ] **Step 3:** Linha de totais por proprietário e total geral.
- [ ] **Step 4:** Ordenar por margem crescente — o pior caso aparece primeiro, que é o que o gestor precisa ver.
- [ ] **Step 5:** A agregação é uma query SQL só (`equipamentos` ⋈ `locacoes` com `SUM`/`GROUP BY` sobre a interseção do período). Não puxar tudo e calcular em JS — é exatamente o padrão que estamos deixando para trás.

### Task 10: Contratos a vencer

**Files:** Modify: `temp-app/src/app/gestor/terceiros/page.tsx`

- [ ] **Step 1:** Painel com contratos que vencem nos próximos 90 dias, ordenados por data.
- [ ] **Step 2:** Considerar o `aviso_previo_dias`: alertar quando a janela para avisar estiver fechando, não quando o contrato já venceu.
- [ ] **Step 3:** Para cada contrato a vencer, mostrar quantos equipamentos estão locados no momento — devolver equipamento que está na casa de um cliente exige recolhimento antes.

### Task 11: Origem no relatório por cliente

Conecta com o relatório por cliente pedido em 2026-08-10 (ver conversa; o romaneio já entrega parte disso).

- [ ] **Step 1:** Marcar no relatório do cliente se cada equipamento é próprio ou de terceiro.
- [ ] **Step 2:** **Nunca** exibir `custo_mensal_terceiro` em documento que vá para o cliente. É o custo de aquisição da cooperativa; vazar isso entrega a margem do negócio. Restringir esse campo às telas sob `/gestor/terceiros`.

---

## FASE 4 — Migração dos dados e corte do Bubble

### Task 12: Migrar e cortar

- [ ] **Step 1:** Script de migração do Bubble para o D1 (`scripts/migrar-equipamentos-d1.ts`), idempotente, preservando os `_id` do Bubble como `id` para não quebrar link já salvo. Volume de 2026-08-10: 31 equipamentos, 106 movimentações, 2 locações, 2 ordens de serviço. Rodar primeiro contra `version-test`, conferir, depois live.
- [ ] **Step 2:** Apontar `/api/gestor/equipamentos`, `/locacoes`, `/domicilios` para o D1, mantendo o mesmo contrato de resposta (`{ success, data }`) — assim as páginas não mudam junto.
- [ ] **Step 3:** Ajustar `romaneio-entrega.ts` e o romaneio para os tipos novos. A lógica de `montarItens` continua válida; muda a origem dos dados.
- [ ] **Step 4:** Remover do `bubble.ts` as funções de equipamento migradas e a flag `EQUIPAMENTOS_V2_ENABLED` (`bubble.ts:79`), que deixa de fazer sentido.
- [ ] **Step 5:** Deixar os tipos de equipamento do Bubble intactos por um ciclo, como rede de segurança, e só então limpar.

### Task 13: Testes E2E

**Files:** Create: `temp-app/tests/e2e/terceiros.spec.ts`

- [ ] **Step 1:** Cadastrar proprietário → contrato → equipamento de terceiro → locar para cliente.
- [ ] **Step 2:** Verificar que equipamento de terceiro sem proprietário é recusado.
- [ ] **Step 3:** Gerar os três relatórios e conferir os totais contra valores conhecidos.
- [ ] **Step 4:** Confirmar que o custo do terceiro **não** aparece em nenhum documento do cliente.
- [ ] **Step 5:** Atenção aos dois problemas de ambiente já registrados no plano do romaneio (porta 3000 disputada e `fullyParallel` contra `npm run dev`): rodar com `--workers=1`.

---

## Verificação

- [ ] `npx tsc --noEmit` PASS
- [ ] `npm run lint` PASS (o warning pré-existente em `manutencao/page.tsx` é conhecido)
- [ ] `npm run build` PASS
- [ ] `npx playwright test tests/e2e/terceiros.spec.ts --workers=1` PASS
- [ ] Prestação de contas conferida à mão contra uma fatura real de proprietário

---

## Questões em aberto

1. ~~**Pro-rata na entrada e na devolução**~~ — **FECHADO em 2026-08-10 por decisão do solicitante:** fica o proporcional por dias corridos já implementado em `calcularCustoPeriodo`, contando entrada e devolução como dias cobrados. Não reabrir sem uma fatura real que contradiga a regra. A função segue isolada, então trocar continua sendo mudança de um arquivo.
2. ~~**`EQUIPAMENTOS_V2_ENABLED` em produção**~~ — **RESPONDIDO em 2026-08-10 pelos dados, sem precisar abrir o painel: a flag está `true` no Cloudflare Pages.** A primeira locação registrada após o deploy do schema saiu com `fk_domicilio` e `fk_movimentacao_implantacao` preenchidos, o que só ocorre no caminho V2. Em produção: `locacao_equipamento` 2 → 3, `domicilio` 0 → 1 (o primeiro registro do tipo), `movimentacao_equipamento` 106 → 110. O fluxo de implantação, quebrado desde sempre, está funcionando.
3. ~~**Reajuste de contrato**~~ — **RESOLVIDO em 2026-08-10:** o reajuste é feito manualmente pelo gestor, que edita o valor no cadastro do equipamento. Portanto `custo_mensal_terceiro` continua sendo um campo único, sem histórico de vigência. O schema da Task 4 está confirmado.
4. **Equipamento de terceiro em manutenção** — o custo continua correndo? Quem paga o conserto, cooperativa ou proprietário? Afeta o relatório de margem.
