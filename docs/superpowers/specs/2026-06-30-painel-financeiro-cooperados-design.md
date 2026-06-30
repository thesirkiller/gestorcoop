# Especificação de Design: Painel Financeiro e Repasses de Cooperados

## 1. Visão Geral
Este documento especifica o design e a implementação do novo **Painel Financeiro de Repasses e Serviços** para o perfil Gestor no sistema GestorCoop. O objetivo é permitir que o gestor busque um cooperado, filtre seus serviços por múltiplas escalas e período de datas, edite valores se necessário, selecione itens específicos para pagamento, emita uma RPA (Recibo de Pagamento de Autônomo) em formato imprimível e registre o pagamento dos repasses no backend (Bubble.io).

## 2. Arquitetura e Fluxo de Dados

O painel será implementado como uma página administrativa totalmente nova integrada ao dashboard do gestor.

### 2.1 Páginas e Rotas do Frontend
*   **Página Principal:** `src/app/gestor/financeiro/page.tsx`
    *   Interface contendo a busca do cooperado, filtros multi-escala, período de datas, cards de resumo, tabela de serviços com checkboxes e botões de ação em lote.
*   **Modal de RPA:** Um componente React modal flutuante que renderiza um recibo formatado em folha timbrada para impressão direta do navegador (`window.print()`).

### 2.2 Rotas de API no Next.js (BFF)
Para manter chaves de API ocultas do navegador, criaremos as seguintes rotas de API:
1.  **`GET /api/gestor/financeiro/servicos?cooperadoId=...`**
    *   Busca serviços associados ao cooperado no Bubble.
2.  **`GET /api/gestor/financeiro/escalas`**
    *   Busca a lista de escalas para popular o seletor multi-escala.
3.  **`PATCH /api/gestor/financeiro/servicos`**
    *   Recebe o ID do serviço e atualiza propriedades como:
        *   `num_valor_cooperado` (quando editado inline).
        *   `bool_pago` (quando o repasse for confirmado).

### 2.3 Integração com Bubble SDK (`src/lib/bubble.ts`)
Estenderemos a `bubbleApi` com três métodos:
*   `getServicosByCooperado(cooperadoId: string)`: Faz um GET em `/obj/servicos` com constraint de igualdade para `fk_cooperado`.
*   `getEscalas()`: Faz um GET em `/obj/escalas` para listar todas as escalas.
*   `updateServico(servicoId: string, data: Partial<Servico>)`: Faz um PATCH em `/obj/servicos/<id>` para alterar o valor do repasse ou status de pagamento.

---

## 3. Elementos de Interface e Experiência do Usuário (UI/UX)

### 3.1 Filtros Dinâmicos
*   **Busca de Cooperado:** Input com autocomplete/dropdown que lista todos os cooperados cadastrados. Ao selecionar, exibe os dados bancários (Banco, Agência, Conta/PIX) logo abaixo.
*   **Dropdown Multi-Seleção de Escalas (Multi-select Combobox):** Permite filtrar os serviços selecionando uma ou mais escalas simultaneamente.
*   **Período de Datas:** Inputs de Data de Início e Data de Fim. Filtra os serviços pela data de entrada (`date_fixa_entrada`).

### 3.2 Cards de Métricas (Resumo)
Dispostos lado a lado no topo:
1.  **Serviços Filtrados:** Quantidade total de plantões correspondentes ao filtro de escala/data.
2.  **Prontos para Repasse:** Soma do valor (`num_valor_cooperado`) de serviços com status **Confirmado** (finalizados pela gestão) e com pagamento pendente.
3.  **Aguardando Finalização:** Soma de serviços com status **Aguardando** (ainda não finalizados) e pagamento pendente.
4.  **Já Repassados:** Soma de serviços com status de pagamento **Pago**.

### 3.3 Tabela de Serviços Interativa
*   **Checkbox por Linha:** Permite selecionar serviços individuais pendentes de pagamento. O box "Total Selecionado" calcula a soma apenas das linhas marcadas.
*   **Edição de Valor Inline:** A coluna de "Valor de Repasse" exibirá o valor atual do cooperado com um ícone de lápis/salvar. O gestor pode alterar o valor ali mesmo e clicar em salvar para atualizar no Bubble.
*   **Badges de Status:**
    *   *Confirmação:* Verde para "Confirmado", Amarelo para "Aguardando", Vermelho para "Cancelado".
    *   *Pagamento:* Azul para "Pago", Vermelho para "Pendente".

### 3.4 Emissão de RPA (Recibo de Pagamento)
*   **Botão "Gerar RPA":** Disponível no painel quando há serviços selecionados na tabela.
*   **Modal de RPA:** Abre um layout minimalista, preto e branco, adequado para impressão, com os dados da Cooperativa (Emissor), dados do Cooperado (Nome, CPF, Conta Bancária) e a listagem de todos os serviços selecionados com os respectivos valores. Inclui o campo de local, data e assinatura.
*   Utiliza `@media print` no CSS para que apenas a área do recibo seja impressa quando a impressão do navegador for acionada.

---

## 4. Próximos Passos (Plano de Ação)
1.  **Aprovação do Design** pelo usuário.
2.  **Atualizar o arquivo `bubble.ts`** para incluir chamadas de serviços e escalas.
3.  **Criar as rotas de API do Next.js** para intermediar a listagem e as atualizações.
4.  **Criar o design visual da nova página** `/gestor/financeiro` e os componentes associados (Combobox multi-select, Tabela, Modal de RPA).
5.  **Validar localmente** as interações, somatórios e a impressão do recibo.
