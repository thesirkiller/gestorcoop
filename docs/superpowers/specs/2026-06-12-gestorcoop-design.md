# Especificação de Design: Plataforma GestorCoop

## 1. Visão Geral do Sistema
O GestorCoop é uma plataforma para cooperativas que gerencia a entrada de novos cooperados e a análise desses cadastros pelos gestores. A arquitetura é dividida entre um Front-end customizado e premium construído em Next.js (hospedado na Vercel) e um Back-end "Headless" gerenciado pelo Bubble.io, garantindo flexibilidade visual e segurança dos dados.

## 2. Arquitetura
- **Front-end / BFF (Backend For Frontend):** Next.js 14+ (App Router).
- **Estilização:** CSS Puro / CSS Modules com design moderno (glassmorphism, animações).
- **Banco de Dados e Autenticação:** Bubble.io (Data API / Workflow API).
- **Assinatura Eletrônica:** ZapSign API.
- **Hospedagem:** Vercel.

### 2.1 Padrão de Comunicação Segura
Toda comunicação com o Bubble e a ZapSign ocorrerá através de *API Routes* no Next.js (ex: `/api/adesao`, `/api/gestor/cooperados`).
O código cliente (React/Navegador) fará requisições para as rotas `/api/` locais do Next.js.
Dessa forma, chaves de API (`BUBBLE_API_KEY`, `ZAPSIGN_API_KEY`) ficarão restritas às variáveis de ambiente da Vercel, nunca expostas no navegador.

## 3. Fluxo de Usuários e Interfaces

### 3.1 Fluxo do Cooperado (`/cooperado/adesao`)
Interface em formato de formulário multi-etapas ("wizard"):
1. **Passo 1 (Dados Pessoais):** Coleta de Nome, CPF/CNPJ, E-mail, Telefone e Endereço.
2. **Passo 2 (Documentos):** Upload de imagens (RG/CNH e Comprovante de Residência).
3. **Passo 3 (Finalização e Assinatura):** Revisão dos dados. Ao enviar, a API do Next.js cria o registro no Bubble com o status "Aguardando Assinatura" e solicita a geração do documento na ZapSign. O usuário recebe na própria interface (ou via redirecionamento) o link para assinar o Termo de Adesão imediatamente.

### 3.2 Fluxo do Gestor (`/gestor/dashboard`)
Dashboard focado em produtividade e análises rápidas. Será embutido (iframe) em uma página do Bubble ou acessado diretamente com validação do token do Bubble.
1. **Visão Principal (Kanban):**
   - **Aguardando Assinatura:** Usuários cadastrados que ainda não assinaram na ZapSign.
   - **Em Análise:** Documento assinado, aguardando validação dos documentos pelo gestor.
   - **Aprovados:** Cooperados oficialmente aceitos.
2. **Painel de Detalhes:** Ao selecionar um card no Kanban, abre-se uma visualização lateral (sidebar) contendo:
   - Resumo dos dados cadastrais.
   - Visualizador de documentos anexados.
   - Botão de ação: "Aprovar Cooperado" (dispara um POST para o Bubble mudando o status final e movendo o card no Kanban).

## 4. Integração ZapSign e Webhooks
- Ao criar o documento, a API da ZapSign envia de volta um link de assinatura.
- Será configurado um Webhook na ZapSign apontando para `/api/webhooks/zapsign` no Next.js.
- Quando o usuário finalizar a assinatura, a ZapSign chama esse webhook, que por sua vez faz um POST para o Bubble atualizando o status do cooperado de "Aguardando Assinatura" para "Em Análise".

## 5. Próximos Passos (Implementação)
1. Inicializar o projeto Next.js no repositório.
2. Configurar variáveis de ambiente placeholder e estrutura base (CSS, fontes).
3. Desenvolver os componentes e fluxo da tela de Adesão do Cooperado.
4. Desenvolver a tela e Kanban do Painel do Gestor.
5. Implementar as API Routes de integração (Bubble e ZapSign).
