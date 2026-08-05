# Especificação de Design: Romaneio de Entrega de Equipamentos + Renomeação Paciente → Cliente

**Data**: 2026-08-05
**Módulo**: Gestão de Equipamentos / Locações
**Solicitante**: cliente (pai do usuário) — necessidade operacional de campo

---

## Contexto e Problema

Hoje, quando um conjunto de equipamentos é implantado no domicílio de um cliente (ex.: Gabriele),
o sistema registra a locação e a movimentação de "Implantação", mas **não existe nenhum documento
físico** que acompanhe a entrega. Quem leva os equipamentos não tem uma lista para conferir item a
item, e o cliente não tem onde assinar confirmando o que efetivamente recebeu.

Além disso, a nomenclatura do sistema usa "paciente" em toda a interface, o que não reflete a
relação comercial da cooperativa — o destinatário é um **cliente**, podendo ser Homecare ou
Hospital.

---

## Objetivo

1. Substituir "paciente" por "cliente" em toda a interface visível do sistema.
2. Gerar um **romaneio de entrega** imprimível, listando os equipamentos que vão para um cliente,
   com campo de conferência (entregue / não entregue) e assinatura.
3. Permitir que a conferência feita no papel seja **registrada de volta no sistema**, fechando o
   ciclo entre o que saiu e o que foi de fato entregue.

---

## Decisões Tomadas

| Tema | Decisão | Justificativa |
|---|---|---|
| Escopo da renomeação | **Somente texto visível na tela** | O Bubble usa o tipo `locais_de_trabalho_pacientes` e o campo `fk_paciente` em produção. Renomear no banco exigiria migração e poderia quebrar workflows do Bubble não visíveis pelo repositório. Identificadores de código e rotas internas permanecem como estão. |
| Origem do romaneio | **Botão no cliente + seleção manual** | O botão na linha do cliente já abre o romaneio com todas as locações ativas marcadas; o gestor pode desmarcar itens antes de imprimir, cobrindo entrega total e parcial. |
| Confirmação de entrega | **Papel + baixa posterior no sistema** | O impresso resolve a necessidade imediata de campo; a baixa fecha o ciclo de rastreabilidade do equipamento. |

---

## Parte 1 — Renomeação "Paciente" → "Cliente" (apenas UI)

### O que muda

Todo texto exibido ao usuário final:

- Títulos, subtítulos e descrições de página
- Rótulos de abas (`Cadastro de Pacientes` → `Cadastro de Clientes`)
- Labels de formulário, placeholders e `aria-label`
- Cabeçalhos de coluna de tabelas
- Mensagens de erro e de estado vazio retornadas pelas rotas de API
- Cabeçalhos das exportações CSV
- Seletores de texto nos testes E2E (`temp-app/tests/e2e/equipamentos.spec.ts`)

### O que **não** muda

| Item | Exemplo | Motivo |
|---|---|---|
| Campos do Bubble | `fk_paciente` | Contrato do backend em produção |
| Tipos de dado do Bubble | `locais_de_trabalho_pacientes` | Idem |
| Rotas de API | `/api/gestor/pacientes` | Evita quebrar chamadas e reduz o diff |
| Identificadores TypeScript | `interface Paciente`, `getPacientes()`, `pacientes` | Renomear aumentaria muito o diff sem ganho para o usuário |
| Nomes de arquivo/pasta | `src/app/api/gestor/pacientes/` | Idem |

### Consequência aceita

Haverá divergência entre o vocabulário da tela ("Cliente") e o do código ("paciente"). Isso é
intencional e está documentado aqui. Uma nota deve ser adicionada no topo de
`temp-app/src/lib/bubble.ts`, junto à `interface Paciente`, explicando a divergência para quem
mexer no código depois.

### Arquivos afetados

| Arquivo | Ocorrências | Natureza |
|---|---|---|
| `temp-app/src/app/gestor/equipamentos/page.tsx` | 56 | Maioria texto visível |
| `temp-app/src/lib/bubble.ts` | 24 | Só identificadores — apenas adicionar nota |
| `temp-app/src/app/api/gestor/pacientes/route.ts` | 10 | Mensagens de erro |
| `temp-app/src/app/api/gestor/locacoes/route.ts` | 9 | Mensagens de erro |
| `temp-app/src/app/api/gestor/equipamentos/[id]/reservas/route.ts` | 4 | Mensagens de erro |
| `temp-app/src/app/api/gestor/pacientes/[id]/route.ts` | 4 | Mensagens de erro |
| `temp-app/src/app/gestor/equipamentos-relatorios/page.tsx` | 3 | Texto visível |
| `temp-app/src/app/api/gestor/equipamentos/relatorios/movimentacoes/route.ts` | 3 | Cabeçalho de relatório |
| `temp-app/tests/e2e/equipamentos.spec.ts` | 1 | Seletor de texto |
| `temp-app/scripts/*.mts` | 2 | Log interno — opcional |

---

## Parte 2 — Romaneio de Entrega (documento impresso)

### Fluxo do usuário

```
Aba "Cadastro de Clientes"
  └── linha da Gabriele → botão "Romaneio de entrega"
        └── abre /gestor/equipamentos/romaneio?cliente=<id>  (nova aba)
              ├── todos os equipamentos em locação ativa vêm marcados
              ├── gestor desmarca o que não vai nesta viagem
              └── botão "Imprimir"  →  window.print()
```

O mesmo botão aparece na aba "Locações", permitindo emitir o romaneio a partir de uma locação
específica (pré-seleciona apenas aquele item).

### Nova rota

`temp-app/src/app/gestor/equipamentos/romaneio/page.tsx`

Página client-side que lê `cliente` e (opcionalmente) `itens` da query string, carrega
`/api/gestor/pacientes`, `/api/gestor/locacoes` e `/api/gestor/equipamentos`, e monta o documento.

Página dedicada (e não modal) porque o `@media print` fica muito mais previsível sem os
containers de scroll e overlay da tela principal.

### Layout do documento

Formato A4 retrato. Reaproveita o padrão de impressão já usado em
`temp-app/src/app/gestor/financeiro/page.tsx:325` (`#print-area` + `@media print`).

```
┌─────────────────────────────────────────────────────────────────┐
│  [Cooperativa]                        ROMANEIO DE ENTREGA       │
│                                       Nº ROM-20260805-001       │
│                                       Emitido em 05/08/2026     │
├─────────────────────────────────────────────────────────────────┤
│  CLIENTE                                                        │
│  Nome: Gabriele ...................  Tipo: Homecare             │
│  CPF: ...........................  WhatsApp: ...............    │
│  Endereço de entrega: .......................................   │
│  Ponto de referência / instruções de acesso: ................   │
├─────────────────────────────────────────────────────────────────┤
│  #  Equipamento        Marca/Modelo    Nº Série    Início   ☐   │
│  1  Concentrador O2    Philips EverFlo PHIL-3842   05/08   ☐    │
│  2  Cama hospitalar    ...             ...         05/08   ☐    │
│  3  ...                                                         │
│                                                                 │
│  Total de itens: 3                                              │
├─────────────────────────────────────────────────────────────────┤
│  OBSERVAÇÕES                                                    │
│  ____________________________________________________________   │
│  ____________________________________________________________   │
├─────────────────────────────────────────────────────────────────┤
│  Declaro ter recebido os equipamentos assinalados acima, em     │
│  bom estado de conservação e funcionamento.                     │
│                                                                 │
│  _________________________      _________________________       │
│  Entregue por (nome/assin.)     Recebido por (nome/assin.)      │
│                                 Documento: ______________       │
│                                 Data: ___/___/____  __:__       │
└─────────────────────────────────────────────────────────────────┘
```

### Colunas da tabela de itens

| Coluna | Origem |
|---|---|
| # | índice sequencial |
| Equipamento | `Equipamento.txt_nome` |
| Marca/Modelo | `txt_marca` + `txt_modelo` |
| Nº Série / Patrimônio | `txt_numero_serie` (fallback `txt_numero_patrimonio`) |
| Início da locação | `LocacaoEquipamento.date_inicio` |
| ☐ Entregue | quadrado vazio desenhado em CSS, para marcação à caneta |

### Endereço de entrega

Prioridade: `Domicilio.geo_endereco` do domicílio ativo vinculado à locação
(`fk_domicilio`) → fallback para `Paciente.txt_endereco`. Quando houver domicílio, incluir também
`txt_ponto_referencia`, `txt_instrucoes_acesso` e `txt_contato_local`, que são exatamente as
informações úteis para quem está entregando.

### Numeração do romaneio

Na Parte 2 (sem persistência), o número é derivado da data + cliente:
`ROM-<AAAAMMDD>-<4 primeiros caracteres do id do cliente>`. É estável para reimpressão no mesmo
dia. A numeração sequencial real chega na Parte 3.

### Regras de impressão

- Ocultar na impressão (`print:hidden`): checkboxes de seleção, botão Imprimir, navegação, header do gestor
- Preto e branco, sem fundos coloridos (economia de tinta e legibilidade em impressora térmica/laser simples)
- `page-break-inside: avoid` nas linhas da tabela
- Repetir o cabeçalho da tabela em quebras de página (`thead { display: table-header-group }`)

---

## Parte 3 — Baixa da conferência no sistema

### Por que não reaproveitar `conferencia_equipamento`

O tipo `conferencia_equipamento` existente é da **conferência de retorno** (recolhimento): a rota
`POST /api/gestor/equipamentos/[id]/conferencias` exige que o equipamento esteja em
`Recolhido e aguardando conferência` e só aceita destinos de pós-retorno
(`Aguardando higienização`, `Manutenção`, `Bloqueado`). Reaproveitá-la para entrega distorceria a
semântica e corromperia os relatórios de conferência de retorno.

### Novos tipos de dado no Bubble

Alteração **aditiva** — não renomeia nem remove nada existente, portanto não exige migração de
dados nem quebra workflows atuais.

**`romaneio_entrega`**

| Campo | Tipo | Nota |
|---|---|---|
| `txt_numero` | text | `ROM-AAAAMMDD-NNN` |
| `fk_paciente` | locais_de_trabalho_pacientes | mantém o nome do campo por consistência com o resto do schema |
| `fk_domicilio` | domicilio | destino da entrega |
| `date_emissao` | date | |
| `txt_responsavel_entrega` | text | quem levou |
| `txt_status` | text | `Emitido` / `Confirmado` / `Confirmado parcial` / `Cancelado` |
| `date_confirmacao` | date | preenchido na baixa |
| `txt_recebedor` | text | quem assinou |
| `txt_documento_recebedor` | text | |
| `txt_observacoes` | text | |
| `txt_chave_idempotencia` | text | evita romaneio duplicado |

**`item_romaneio_entrega`**

| Campo | Tipo | Nota |
|---|---|---|
| `fk_romaneio_entrega` | romaneio_entrega | |
| `fk_locacao_equipamento` | locacao_equipamento | |
| `fk_equipamento` | equipamento | |
| `bool_entregue` | yes/no | resultado da conferência |
| `txt_observacao` | text | motivo, quando não entregue |

### Novas rotas de API

| Rota | Método | Função |
|---|---|---|
| `/api/gestor/romaneios` | GET | lista romaneios (filtro por cliente e status) |
| `/api/gestor/romaneios` | POST | emite romaneio + itens; devolve número sequencial |
| `/api/gestor/romaneios/[id]` | GET | detalhe com itens |
| `/api/gestor/romaneios/[id]/confirmar` | POST | grava a conferência item a item |

### O que acontece com um item **não entregue**

Ponto que precisa de definição do cliente antes de implementar. A locação foi criada e o
equipamento já está em `Implantado no domicílio`; se ele não foi entregue, esse status está errado.

**Proposta:** ao confirmar um item como não entregue, a rota `/confirmar`:

1. registra `Movimentação` do tipo `Correção` com `txt_novo_status: 'Disponível'`,
   observação `Não entregue — romaneio <número>`, e chave de idempotência
   `romaneio-<id>-item-<equipamentoId>`;
2. cancela a locação correspondente (`txt_status: 'Cancelado'`), anexando o motivo em
   `txt_observacoes`.

O comportamento fica registrado no histórico do equipamento
(`/api/gestor/equipamentos/[id]/historico`) sem inventar tipo de movimentação novo.

### Tela de baixa

Botão "Confirmar entrega" na listagem de romaneios com status `Emitido`, abrindo modal com:
a lista de itens com toggle Entregue/Não entregue, campo de observação por item, nome do recebedor,
documento e data/hora da entrega.

---

## Sequência de Entrega

| Fase | Escopo | Depende de Bubble? |
|---|---|---|
| 1 | Renomeação UI paciente → cliente | Não |
| 2 | Romaneio impresso (sem persistência) | Não |
| 3 | Persistência + baixa da conferência | Sim — 2 tipos de dado novos |

As fases 1 e 2 entregam sozinhas o que foi pedido ("imprimir e conferir no papel") e podem ir para
produção sem tocar no Bubble. A fase 3 é separável e deve ser feita depois que o formato do
impresso for validado em campo — imprimir, usar numa entrega real e ajustar antes de persistir.

---

## Riscos

| Risco | Mitigação |
|---|---|
| Rename atingir string usada como chave lógica | Revisar cada ocorrência manualmente; não usar substituição cega em massa |
| Testes E2E quebrarem por seletor de texto | Atualizar `equipamentos.spec.ts` na mesma tarefa do rename e rodar a suíte |
| Impressão sair diferente entre navegadores | Validar em Chrome (padrão do cliente); usar CSS de impressão conservador |
| Fase 3 alterar status de equipamento indevidamente | Idempotência por chave e confirmação explícita do gestor antes de gravar |
