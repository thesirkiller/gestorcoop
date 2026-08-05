# Romaneio de Entrega + Renomeação Cliente — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Renomear "paciente" para "cliente" na interface e entregar um romaneio de entrega imprimível, com conferência item a item, opcionalmente registrada de volta no sistema.

**Spec:** `docs/superpowers/specs/2026-08-05-romaneio-entrega-cliente-design.md`

**Architecture:** A renomeação é restrita a strings visíveis — campos do Bubble (`fk_paciente`), rotas (`/api/gestor/pacientes`) e identificadores TypeScript (`interface Paciente`) permanecem intactos. O romaneio é uma página client-side dedicada (`/gestor/equipamentos/romaneio`) que reaproveita o padrão `#print-area` + `@media print` já usado em `temp-app/src/app/gestor/financeiro/page.tsx:325`. A persistência (Fase 3) adiciona dois tipos de dado novos no Bubble, sem alterar nenhum existente.

**Tech Stack:** Next.js 14 (App Router, edge runtime), React, TypeScript, Tailwind CSS, Lucide Icons, Axios, Playwright.

---

## FASE 1 — Renomeação "Paciente" → "Cliente" (interface)

### Task 1: Renomear textos visíveis na página de equipamentos

**Files:**
- Modify: `temp-app/src/app/gestor/equipamentos/page.tsx`

- [ ] **Step 1: Trocar rótulos de navegação e cabeçalho**
  - `page.tsx:669` — subtítulo: "pacientes cadastrados" → "clientes cadastrados"
  - `page.tsx:781` — aba: `Cadastro de Pacientes` → `Cadastro de Clientes`
  - `page.tsx:805,809` — placeholder de busca: "Buscar por paciente ou equipamento..." → "Buscar por cliente ou equipamento..."

- [ ] **Step 2: Trocar cabeçalhos de tabela e estados vazios**
  - `page.tsx:865,1042` — coluna `Paciente` → `Cliente`
  - `page.tsx:1157` — "Nenhum paciente encontrado." → "Nenhum cliente encontrado."
  - `page.tsx:1365` — fallback `'Paciente'` → `'Cliente'`

- [ ] **Step 3: Trocar textos de formulários e modais**
  - `page.tsx:844,1719` — botão/título "Cadastrar Paciente" → "Cadastrar Cliente"
  - `page.tsx:1478,1480,1481` — label e placeholder do select de reserva
  - `page.tsx:1737` — placeholder "Nome do paciente..." → "Nome do cliente..."
  - `page.tsx:1776` — placeholder de e-mail: `paciente@email.com` → `cliente@email.com`
  - `page.tsx:1782` — "Tipo de Paciente *" → "Tipo de Cliente *"
  - `page.tsx:1850,1855,1862,1867` — "Selecionar Paciente *", busca, `aria-label`, opção default
  - `page.tsx:1380` — placeholder de cancelamento: "desistência do paciente" → "desistência do cliente"
  - `page.tsx:2016` — "Paciente:" → "Cliente:"

- [ ] **Step 4: Trocar cabeçalho do CSV**
  - `page.tsx:496` — `'Paciente'` → `'Cliente'` no array `cabecalho`

- [ ] **Step 5: Não alterar identificadores**
  - Manter: `pacientes`, `filteredPacientes`, `Paciente`, `fk_paciente`, `handleSubmitPaciente`, `reservePatientId`, `/api/gestor/pacientes`, `activeTab === 'pacientes'`
  - Conferir com: `grep -n "fk_paciente\|/api/gestor/pacientes" temp-app/src/app/gestor/equipamentos/page.tsx` (a contagem deve ficar igual à de antes da mudança)

- [ ] **Step 6: Verificar compilação**

Run: `cd temp-app && npx tsc --noEmit`
Expected: PASS (0 erros)

---

### Task 2: Renomear mensagens das rotas de API

**Files:**
- Modify: `temp-app/src/app/api/gestor/locacoes/route.ts:40,67`
- Modify: `temp-app/src/app/api/gestor/pacientes/route.ts`
- Modify: `temp-app/src/app/api/gestor/pacientes/[id]/route.ts`
- Modify: `temp-app/src/app/api/gestor/equipamentos/[id]/reservas/route.ts`
- Modify: `temp-app/src/app/api/gestor/equipamentos/relatorios/movimentacoes/route.ts`

- [ ] **Step 1: Trocar apenas as strings dentro de mensagens de erro e cabeçalhos de relatório**

Exemplo em `locacoes/route.ts:40`:
```ts
// antes
error: 'Equipamento, Paciente, Data de Início, Data de Fim Previsto e Valor do Aluguel são obrigatórios.'
// depois
error: 'Equipamento, Cliente, Data de Início, Data de Fim Previsto e Valor do Aluguel são obrigatórios.'
```

Exemplo em `locacoes/route.ts:67`:
```ts
// antes
error: 'O paciente precisa ter um endereço antes da implantação.'
// depois
error: 'O cliente precisa ter um endereço antes da implantação.'
```

- [ ] **Step 2: Não tocar em nenhuma chave de payload**
  - Manter intactos: `fk_paciente`, `const paciente = await bubbleApi.getPaciente(...)`, caminhos `/obj/locais_de_trabalho_pacientes`

- [ ] **Step 3: Verificar compilação**

Run: `cd temp-app && npx tsc --noEmit`
Expected: PASS

---

### Task 3: Renomear a página de relatórios e documentar a divergência

**Files:**
- Modify: `temp-app/src/app/gestor/equipamentos-relatorios/page.tsx`
- Modify: `temp-app/src/lib/bubble.ts:154`

- [ ] **Step 1: Trocar os 3 textos visíveis em `equipamentos-relatorios/page.tsx`**

- [ ] **Step 2: Adicionar nota explicativa acima de `interface Paciente`**

```ts
// NOTA DE VOCABULÁRIO: na interface o sistema chama esta entidade de "Cliente".
// Os nomes "Paciente" / "fk_paciente" / "locais_de_trabalho_pacientes" foram mantidos
// porque são o contrato do Bubble em produção — renomear exigiria migração de dados.
// Ver docs/superpowers/specs/2026-08-05-romaneio-entrega-cliente-design.md
export interface Paciente {
```

- [ ] **Step 3: Commit**

```
refactor(ui): renomear paciente para cliente na interface do gestor
```

---

### Task 4: Atualizar testes E2E

**Files:**
- Modify: `temp-app/tests/e2e/equipamentos.spec.ts`

- [ ] **Step 1: Atualizar o seletor que depende do texto "Paciente"**

- [ ] **Step 2: Rodar a suíte**

Run: `cd temp-app && npx playwright test tests/e2e/equipamentos.spec.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```
test(e2e): ajustar seletores para o vocabulário de cliente
```

---

## FASE 2 — Romaneio de entrega imprimível

### Task 5: Criar o helper de montagem do romaneio

**Files:**
- Create: `temp-app/src/lib/romaneio-entrega.ts`

- [ ] **Step 1: Definir os tipos e a função de montagem**

```ts
import { Domicilio, Equipamento, LocacaoEquipamento, Paciente } from '@/lib/bubble';

export interface ItemRomaneio {
  locacaoId: string;
  equipamentoId: string;
  nome: string;
  marcaModelo: string;
  numeroSerie: string;
  dataInicio: string;
  selecionado: boolean;
}

export interface DadosRomaneio {
  numero: string;
  dataEmissao: string;
  cliente: Paciente;
  enderecoEntrega: string;
  pontoReferencia?: string;
  instrucoesAcesso?: string;
  contatoLocal?: string;
  itens: ItemRomaneio[];
}

/**
 * Numeração estável para reimpressão no mesmo dia: ROM-AAAAMMDD-XXXX.
 * A numeração sequencial real chega na Fase 3, com persistência no Bubble.
 */
export function gerarNumeroRomaneio(clienteId: string, data = new Date()): string {
  const ymd = data.toISOString().slice(0, 10).replace(/-/g, '');
  return `ROM-${ymd}-${clienteId.slice(-4).toUpperCase()}`;
}

export function montarItens(
  locacoes: LocacaoEquipamento[],
  equipamentos: Equipamento[],
  preSelecionados?: string[],
): ItemRomaneio[] {
  return locacoes
    .filter((l) => l.txt_status === 'Ativo')
    .map((l) => {
      const eq = equipamentos.find((e) => e._id === l.fk_equipamento);
      if (!eq) return null;
      return {
        locacaoId: l._id!,
        equipamentoId: eq._id!,
        nome: eq.txt_nome,
        marcaModelo: [eq.txt_marca, eq.txt_modelo].filter(Boolean).join(' '),
        numeroSerie: eq.txt_numero_serie || eq.txt_numero_patrimonio || '—',
        dataInicio: l.date_inicio,
        selecionado: !preSelecionados?.length || preSelecionados.includes(l._id!),
      };
    })
    .filter((i): i is ItemRomaneio => i !== null);
}

/** Domicílio ativo tem prioridade sobre o endereço legado do cadastro. */
export function resolverEnderecoEntrega(cliente: Paciente, domicilio?: Domicilio): string {
  return domicilio?.geo_endereco || cliente.txt_endereco || '';
}
```

- [ ] **Step 2: Verificar compilação**

Run: `cd temp-app && npx tsc --noEmit`
Expected: PASS

---

### Task 6: Criar a página do romaneio

**Files:**
- Create: `temp-app/src/app/gestor/equipamentos/romaneio/page.tsx`

- [ ] **Step 1: Carregar os dados a partir da query string**
  - Ler `cliente` (obrigatório) e `itens` (lista de ids de locação separada por vírgula, opcional)
  - Buscar em paralelo `/api/gestor/pacientes`, `/api/gestor/locacoes`, `/api/gestor/equipamentos`
  - Filtrar as locações ativas do cliente e montar via `montarItens`
  - Estados de carregamento, cliente não encontrado e nenhum equipamento ativo

- [ ] **Step 2: Barra de controle (oculta na impressão)**
  - Checkbox por item para incluir/excluir do romaneio
  - Campo "Entregue por" (preenche o nome do entregador no impresso)
  - Botão "Imprimir" → `window.print()`
  - Classe `print:hidden` em toda a barra

- [ ] **Step 3: Montar o `#print-area` conforme o layout da spec**
  - Cabeçalho com título, número e data de emissão
  - Bloco de dados do cliente (nome, tipo, CPF, WhatsApp, endereço, ponto de referência, instruções de acesso)
  - Tabela dos itens selecionados com a coluna de quadrado de conferência
  - Total de itens
  - Bloco de observações com linhas em branco
  - Termo de recebimento e assinaturas (entregador e recebedor, com documento e data/hora)

- [ ] **Step 4: Adicionar o CSS de impressão**

Seguir o padrão de `temp-app/src/app/gestor/financeiro/page.tsx:325`:

```tsx
<style jsx global>{`
  @media print {
    @page { size: A4 portrait; margin: 12mm; }
    body * { visibility: hidden; }
    #print-area, #print-area * { visibility: visible; }
    #print-area { position: absolute; left: 0; top: 0; width: 100%; }
    #print-area table { page-break-inside: auto; }
    #print-area tr { page-break-inside: avoid; page-break-after: auto; }
    #print-area thead { display: table-header-group; }
  }
`}</style>
```

- [ ] **Step 5: Validar visualmente**

Run: `cd temp-app && npm run dev`
Verificar em Chrome com Ctrl+P: cabeçalho da tabela repete entre páginas, nada colorido, checkboxes de seleção não aparecem no preview de impressão.

- [ ] **Step 6: Commit**

```
feat(equipamentos): adicionar romaneio de entrega imprimivel
```

---

### Task 7: Ligar os botões de emissão

**Files:**
- Modify: `temp-app/src/app/gestor/equipamentos/page.tsx`

- [ ] **Step 1: Botão na aba de clientes**
  - Nova coluna "Ações" na tabela (`page.tsx:1147-1151`)
  - Botão "Romaneio" com ícone `Printer`, visível apenas quando `activePatientRentals.length > 0`
  - Abre `/gestor/equipamentos/romaneio?cliente=<id>` em nova aba

- [ ] **Step 2: Botão na aba de locações**
  - Na linha da locação ativa, abre `?cliente=<fk_paciente>&itens=<locacaoId>`

- [ ] **Step 3: Verificar compilação e lint**

Run: `cd temp-app && npx tsc --noEmit && npm run lint`
Expected: PASS

- [ ] **Step 4: Teste E2E do fluxo**

**Files:** Modify `temp-app/tests/e2e/equipamentos.spec.ts`

Cobrir: abrir a aba de clientes → clicar em "Romaneio" → a página carrega com os itens ativos marcados → desmarcar um item o remove do documento.

Run: `cd temp-app && npx playwright test`
Expected: PASS

- [ ] **Step 5: Commit**

```
feat(equipamentos): emitir romaneio a partir do cliente e da locacao
```

---

> **PARADA OBRIGATÓRIA:** imprimir um romaneio real e usá-lo em uma entrega antes de iniciar a Fase 3. O formato do impresso precisa ser validado em campo — ajustar o layout depois de persistir os dados custa bem mais caro.

---

## FASE 3 — Persistência e baixa da conferência

### Task 8: Criar os tipos de dado no Bubble

**Ferramenta:** MCP `befree-bubble-mcp` (`create_data_type`, `create_data_field`)

- [ ] **Step 1: Criar `romaneio_entrega`** com os campos da spec (`txt_numero`, `fk_paciente`, `fk_domicilio`, `date_emissao`, `txt_responsavel_entrega`, `txt_status`, `date_confirmacao`, `txt_recebedor`, `txt_documento_recebedor`, `txt_observacoes`, `txt_chave_idempotencia`)

- [ ] **Step 2: Criar `item_romaneio_entrega`** (`fk_romaneio_entrega`, `fk_locacao_equipamento`, `fk_equipamento`, `bool_entregue`, `txt_observacao`)

- [ ] **Step 3: Expor ambos na Data API e criar as privacy rules** seguindo o padrão dos tipos de equipamento existentes

- [ ] **Step 4: Validar com `bubble_context_find`** que ambos os tipos aparecem com todos os campos

---

### Task 9: Estender `bubble.ts`

**Files:**
- Modify: `temp-app/src/lib/bubble.ts`

- [ ] **Step 1: Adicionar as interfaces `RomaneioEntrega` e `ItemRomaneioEntrega`**
- [ ] **Step 2: Adicionar os métodos** `criarRomaneio`, `getRomaneios`, `getRomaneio`, `criarItemRomaneio`, `getItensRomaneio`, `atualizarRomaneio`, `atualizarItemRomaneio`, seguindo o padrão de `criarConferenciaEquipamento` (`bubble.ts:1199`)
- [ ] **Step 3: Verificar compilação** — `npx tsc --noEmit`

---

### Task 10: Criar as rotas de romaneio

**Files:**
- Create: `temp-app/src/app/api/gestor/romaneios/route.ts` (GET lista, POST emite)
- Create: `temp-app/src/app/api/gestor/romaneios/[id]/route.ts` (GET detalhe)
- Create: `temp-app/src/app/api/gestor/romaneios/[id]/confirmar/route.ts` (POST baixa)

- [ ] **Step 1: POST `/api/gestor/romaneios`**
  - Valida cliente e lista de locações ativas
  - Gera número sequencial do dia (contando romaneios já emitidos na data)
  - Cria o romaneio e um item por locação, com `txt_status: 'Emitido'`
  - Idempotência por `txt_chave_idempotencia`

- [ ] **Step 2: POST `/api/gestor/romaneios/[id]/confirmar`**
  - Recebe `{ itens: [{ id, bool_entregue, txt_observacao }], txt_recebedor, txt_documento_recebedor, date_confirmacao }`
  - Rejeita romaneio que não esteja em `Emitido` (409)
  - Para cada item **não entregue**: registra `Movimentação` do tipo `Correção` com `txt_novo_status: 'Disponível'`, observação `Não entregue — romaneio <número>` e chave `romaneio-<id>-item-<equipamentoId>`; cancela a locação com o motivo em `txt_observacoes`
  - Atualiza o romaneio para `Confirmado` ou `Confirmado parcial`

- [ ] **Step 3: Seguir o padrão de erro do projeto** — extrair `error.response.data.body.message` do Bubble (ver `locacoes/route.ts:150-162`)

- [ ] **Step 4: Verificar compilação** — `npx tsc --noEmit`

---

### Task 11: Tela de listagem e baixa

**Files:**
- Modify: `temp-app/src/app/gestor/equipamentos/page.tsx`
- Modify: `temp-app/src/app/gestor/equipamentos/romaneio/page.tsx`

- [ ] **Step 1: Persistir na emissão** — a página do romaneio passa a chamar `POST /api/gestor/romaneios` ao imprimir, substituindo o número derivado pelo número real
- [ ] **Step 2: Nova aba "Romaneios"** com número, cliente, data, status e quantidade de itens
- [ ] **Step 3: Modal "Confirmar entrega"** — toggle Entregue/Não entregue por item, observação por item, recebedor, documento e data/hora
- [ ] **Step 4: Confirmação explícita** antes de gravar, listando o que será alterado (equipamentos que voltam para `Disponível` e locações que serão canceladas)

- [ ] **Step 5: Testes E2E**

Run: `cd temp-app && npx playwright test`
Expected: PASS

- [ ] **Step 6: Verificação final**

Run: `cd temp-app && npx tsc --noEmit && npm run lint && npx playwright test`
Expected: PASS

- [ ] **Step 7: Commit**

```
feat(equipamentos): persistir romaneio de entrega e registrar conferencia
```

---

## Verificação Final

- [ ] Nenhum texto "paciente" visível na interface: `grep -rn "aciente" temp-app/src/app --include=*.tsx` retorna apenas identificadores e chaves de payload
- [ ] `fk_paciente` e `/api/gestor/pacientes` intactos — contagem igual à do início
- [ ] Romaneio imprime corretamente em A4 no Chrome, sem checkboxes de seleção nem botões
- [ ] `npx tsc --noEmit` — PASS
- [ ] `npm run lint` — PASS
- [ ] `npx playwright test` — PASS
