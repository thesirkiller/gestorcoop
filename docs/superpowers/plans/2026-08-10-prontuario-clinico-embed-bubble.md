# Prontuário Clínico — Embed no App Mobile do Bubble — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para implementar tarefa a tarefa. Steps usam checkbox (`- [ ]`).

**Goal:** Levar o módulo de prontuário clínico de protótipo funcional a sistema confiável de registro clínico, embutido num iframe dentro do app mobile do Bubble.

**Contexto de uso que governa todas as decisões:** a tela `cooperado/prontuario/[id]` é usada por técnico de enfermagem **em campo, no celular**, dentro de um iframe, às vezes em plantão noturno, frequentemente offline. As telas `gestor/prontuarios/*` são de auditoria, em desktop, densas por natureza.

---

## Estado em 2026-08-10

| Frente | Situação |
|---|---|
| Autenticação e atribuição | ✅ Concluída (`d298c9a`) |
| Acessibilidade e mobile — 1ª passada | ✅ Concluída (`aa47a8e`) |
| Alvos de toque da checagem de medicamento | ✅ Concluída (`efa10a7`) |
| Tipografia e classes de cor mortas | ✅ Concluída (`146a9c0`) |
| Performance da tela de atendimento | ✅ Concluída (`d75a29d`) |
| Contraste AA, zoom do iOS, fontes mortas | ✅ Concluída (`d8c7256`) |
| Modo escuro (`colorize`) | ⏸️ Não iniciado — Fase 1 |
| Tipografia das telas do gestor | ⏸️ Não iniciado — Fase 2 |
| Foco preso nos modais | ⏸️ Não iniciado — Fase 2 |
| Backend: mocks, seed, lint | ⏸️ Não iniciado — Fase 3 |
| Infra do embed | ⏸️ **Bloqueia o embed** — Fase 0 |

**`$impeccable audit`: 10/20 → 15/20** (Acceptable → Good).

| Dimensão | Antes | Agora |
|---|---|---|
| Acessibilidade | 1/4 | 3/4 |
| Performance | 2/4 | 3/4 |
| Responsividade | 1/4 | 3/4 |
| Theming | 3/4 | 3/4 |
| Anti-padrões | 3/4 | 3/4 |

⚠️ **O 3/4 original de Theming estava errado.** A primeira auditoria pontuou "tokens usados com disciplina, zero hex hardcoded" sem verificar se as classes existiam — 42 delas não existiam. A nota real era 1–2. Ela não subiu porque partia de um lugar falso; o que mudou é que agora é verdadeira. Registrado para que ninguém leia a tabela como "theming estagnou".

---

## FASE 0 — Infra que bloqueia o embed

Sem estes dois itens o módulo não funciona embutido, por mais polida que a interface esteja.

### Task 1: Subdomínio de `gestorcoop.app`

- [ ] **Step 1:** Publicar o app num subdomínio (ex.: `prontuario.gestorcoop.app`) como custom domain do Cloudflare Pages.
- [ ] **Step 2:** Motivo, para não ser revertido por engano: a sessão é cookie `SameSite=Lax`. Num iframe onde `gestorcoop.app` embute `gestorcoop.pages.dev`, os dois são **sites diferentes** e o cookie **não é enviado** — a sessão não existe lá dentro. `SameSite=None` transformaria em cookie de terceiro, que o Safari bloqueia por padrão. Com subdomínio do mesmo registrable domain o iframe é same-site e o cookie flui em todo navegador.
- [ ] **Step 3:** Conferir `EMBED_ORIGEM` nas variáveis do Pages; o middleware usa esse valor no `frame-ancestors` e cai em `https://gestorcoop.app` por padrão.

### Task 2: `ASSINATURA_SECRET`

- [ ] **Step 1:** Definir `ASSINATURA_SECRET` nas variáveis de ambiente do Pages.
- [ ] **Step 2:** Sem ela `gerarSeloAssinatura` **lança de propósito** (`src/lib/sessao-cooperado.ts`). Gravar qualquer valor no lugar reproduziria a assinatura decorativa que foi removida. Falhar é o comportamento correto.

### Task 3: Ligação a partir do Bubble

- [ ] **Step 1:** O iframe deve apontar para `/api/auth/sso?token=XXX&redirect=/cooperado`, com o token gravado em `user.txt_sso_token`. Mesmo mecanismo já usado pelo gestor.
- [ ] **Step 2:** Usuário sem `fk_cooperado` vinculado é recusado de propósito, para não gerar prontuário órfão. O provisionamento do `user` acontece no login mobile do Bubble (confirmado pelo solicitante em 2026-08-10).

---

## FASE 1 — `$impeccable colorize`: modo escuro

Maior valor de uso real que resta. O app tem `turno: 'Noturno'` como funcionalidade de primeira classe e **zero `dark:`**: enfermeiro em quarto de paciente dormindo, às 3h, recebe tela branca inteira.

### Task 4: Camada de tokens semânticos

⚠️ **Não saia espalhando `dark:` pelas classes.** A referência do impeccable veta explicitamente dark mode como inversão do claro.

- [ ] **Step 1:** Introduzir duas camadas — primitivos (`--indigo-600`) e semânticos (`--color-surface`, `--color-ink`, `--color-muted`). No escuro, redefinir **só** a camada semântica.
- [ ] **Step 2:** Profundidade vem de **luminosidade de superfície, não de sombra**: escala de 3 passos onde elevação maior é mais clara, mantendo matiz e croma da marca. Não recorrer a azul genérico.
- [ ] **Step 3:** Reduzir levemente o peso do corpo no escuro (texto claro sobre fundo escuro lê mais pesado) e dessaturar os acentos.
- [ ] **Step 4:** Migrar as seis telas das classes literais (`bg-white`, `text-slate-900`, `border-slate-200`) para os tokens. São ~2.300 linhas — trabalho de refatoração, não de tinta.
- [ ] **Step 5:** Atenção ao `tailwind.config.ts`, que **redefine toda a rampa `indigo`** para um azul (`indigo-600 = #0066e0`), diferente do `#4f46e5` do `DESIGN.md`. "Indigo" no código não é indigo na tela; os tokens devem refletir o que realmente ships.

---

## FASE 2 — Fechar as duas dimensões travadas em 3

### Task 5: `$impeccable typeset` nas telas do gestor

A passada de tipografia foi aplicada por inteiro só na tela de campo, priorizando o celular do técnico sobre o desktop do auditor. Restam **43 tamanhos arbitrários**: 17 em `gestor/prontuarios/page.tsx`, 15 em `auditoria/page.tsx`, 11 em `[id]/page.tsx`.

- [ ] **Step 1:** Aplicar a escala de seis degraus já definida: `text-xs 12` (só metadado tabular) · `text-sm 14` (corpo padrão) · `text-base 16` · `text-lg 18` · `text-xl 20` · `text-2xl 24`.
- [ ] **Step 2:** Eliminar os degraus imperceptíveis. As telas do gestor saltam de `text-2xl` (24px) direto para 12px, sem nada em 16 ou 14, e depois espremem 12 → 11 → 10 → 9 — passos de 1,09–1,11, abaixo do limiar perceptivo. É ruído com aparência de hierarquia.
- [ ] **Step 3:** `max-w-[68ch]` no bloco de transcrição de `gestor/prontuarios/[id]/page.tsx`, hoje com ~115 caracteres por linha contra o máximo confortável de 75. É o único texto corrido de verdade do módulo e é o que o auditor precisa ler inteiro.
- [ ] **Step 4:** Saturação de peso: praticamente todo texto do módulo é `font-bold`/`extrabold`/`black`. Quando tudo é 700–900 o peso deixa de sinalizar. Corpo em `font-normal`/`medium`, seções em `semibold`, `bold` só no dado principal.
- [ ] **Step 5:** `font-mono` na coluna Turno de `gestor/prontuarios/page.tsx` renderiza "Diurno"/"Noturno" em Consolas. Mono só se justifica em coluna alinhável dígito a dígito.

### Task 6: Foco preso nos modais

- [ ] **Step 1:** Os modais já têm `role="dialog"` e `aria-modal`, mas **não prendem o foco**: o teclado escapa para trás do overlay. Implementar focus trap e devolver o foco ao gatilho ao fechar.
- [ ] **Step 2:** Fechar com `Esc` nos dois modais da tela de campo.

---

## FASE 3 — Backend do módulo

### Task 7: Tirar os mocks do caminho de produção

- [ ] **Step 1:** `api/gestor/prontuarios/route.ts` devolve dados mockados quando o D1 não está configurado — inclusive `profissional_id: 'coop_123'`. Num painel de auditoria clínica, dado falso indistinguível de real é pior que erro.
- [ ] **Step 2:** `seedDatabase` roda a partir de um **GET** em `api/cooperado/agenda/route.ts`, populando o banco com registros clínicos de demonstração.
- [ ] **Step 3:** Migrar as 3 rotas de prontuário para o `getDb()` de `src/lib/db/client.ts`, criado na Fase 1 do plano de equipamentos. Hoje cada uma redeclara sua própria `interface D1Database`.
- [ ] **Step 4:** Remover os `/* eslint-disable */` do topo dos arquivos do módulo e tratar o que aparecer.

### Task 8: Testes

- [ ] **Step 1:** `clinical-transcription.spec.ts` é **intermitente por desenho**: afirma sobre estados transitórios ("gravando", "IA transcrevendo") que, com a API mockada respondendo na hora, já passaram quando o teste olha. Falhou e passou em execuções consecutivas sem mudança de código. Reescrever para afirmar sobre o resultado final. **Não enfraquecer para forçar verde.**
- [ ] **Step 2:** `adesao.spec.ts:69` falha desde antes deste trabalho (elemento de upload oculto), já registrado no plano do romaneio. Quebra pré-existente, sem relação com o prontuário.

---

## Verificação

- [ ] `npx tsc --noEmit` PASS
- [ ] `npm run lint` PASS (o warning em `manutencao/page.tsx` é pré-existente)
- [ ] `npx playwright test --workers=1` — usar `--workers=1`: em paralelo a suíte estoura timeout pela compilação sob demanda do Next
- [ ] `$impeccable audit` de novo; meta 18–20

---

## Armadilhas já pagas, para não repetir

1. **Não importe `@/lib/sessao-cooperado` no `middleware.ts`.** Ele puxa `@/lib/bubble`, que **lança no carregamento do módulo** se `BUBBLE_API_URL` faltar. Isso entra no bundle do edge, derruba o worker de SSR do Next e serve 500 em toda a tela do prontuário. O nome do cookie está duplicado no middleware de propósito, com comentário.
2. **Não confie na classe Tailwind estar certa por parecer certa.** 42 classes usadas no módulo não existiam (`slate-350/355/450/650/750/850`, `red-650`, `indigo-150/650/750`) porque o `extend` só acrescenta `250` e `850`. Elas não geram CSS e o elemento cai na cor herdada — foi assim que um botão desabilitado ficou branco sobre branco e o botão de omissão de medicamento perdeu o vermelho. Verifique contra o `tailwind.config.ts` antes de usar qualquer degrau fora da rampa padrão.
3. **O breakpoint `xs` não existe neste projeto.** `hidden xs:inline` não revela nada em largura nenhuma.
4. **O detector do impeccable subconta.** Emitiu 53 achados de tipografia onde o grep encontrou 61; os 8 omitidos ocorriam 2 linhas depois de outro hit igual no mesmo arquivo. Sempre cruze o detector com grep.
5. **O dev server do Next não se recupera** de um crash de worker de SSR. Se as telas começarem a servir 500 sem motivo aparente no código, reinicie antes de investigar o JSX.
