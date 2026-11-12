# Volume 09 — Design System, Configurações de Build, UX Tokens e Acervo Histórico de Documentação

> **Propósito deste Volume**: Documentar linha a linha os arquivos de configuração do projeto (`next.config.mjs`, `tailwind.config.ts`, `tsconfig.json`, `playwright.config.ts`), o sistema de tokens semânticos de Design e Tema Claro/Escuro (`globals.css`, `DESIGN.md`, `PRODUCT.md`), as diretrizes de engenharia (`AGENTS.md`) e catalogar detalhadamente cada documento técnico, auditoria, especificação e vídeo tutorial existente na pasta `docs/`.

---

## 1. Visão Estratégica do Produto (`PRODUCT.md`)

O arquivo [`PRODUCT.md`](file:///c:/Users/admin/Documents/projetos/gestorcoop/PRODUCT.md) (linhas 1–38) define a identidade estratégica do **GestorCoop**:

- **Linhas 1–10 (`Register` & `Platform`)**: Define a aplicação como um produto Web operacional de alta densidade.
- **Linhas 11–14 (`Users`)**:
  - **Primários**: Gestores e Administradores da Cooperativa (acompanham prontuários 360°, inventário de equipamentos hospitalares, ordens de serviço de manutenção, locações, adesão de cooperados e financeiro).
  - **Secundários**: Equipe de logística, almoxarifado, manutenção e cooperados em campo (executam check-ins, evoluções beira-leito, checagens de medicamentos, conferências e diagnósticos).
- **Linhas 15–20 (`Product Purpose` & `Positioning`)**: Fonte única da verdade (*Single Source of Truth*) para ativos hospitalares de home-care e prontuários clínicos da cooperativa, garantindo que nenhum ativo seja alocado em duplicidade e que todas as transições de estado sejam auditáveis.
- **Linhas 21–33 (`Brand Personality`, `Anti-references` & `Design Principles`)**:
  1. **Rastreabilidade Imutável (*Immutable Traceability*)**: Nenhuma mudança de estado ocorre por edição direta arbitrária em células; toda transição decorre de uma ação de negócio registrada em log (`eventos_equipamento`, assinatura SHA-256 de evolução, versionamento de plano terapêutico).
  2. **Utilidade Operacional Densa (*Dense Operational Utility*)**: Layouts de alta densidade informacional para leitura rápida de tabelas, linhas do tempo e painéis.
  3. **Contexto Orientado à Ação (*Action-Oriented Context*)**: Guia o operador por ações explícitas ("Abrir OS", "Iniciar Transporte", "Recomendar Baixa", "Assinar Evolução").
- **Linhas 34–38 (`Accessibility & Inclusion`)**: Contraste mínimo WCAG AA (≥ 4.5:1 para texto de corpo e ≥ 3:1 para componentes de UI nos temas claro e escuro), suporte a teclado em filtros e modais, e badges de status amigáveis a leitores de tela.

---

## 2. Arquitetura do Design System e Tema Claro/Escuro (`DESIGN.md`, `globals.css` e `tailwind.config.ts`)

### 2.1. Especificação Base (`DESIGN.md`)
O arquivo [`DESIGN.md`](file:///c:/Users/admin/Documents/projetos/gestorcoop/DESIGN.md) (linhas 1–132) estabelece o conceito **"The Operational Control Room"**:
- **Frontmatter YAML (linhas 1–44)**: Declara tokens nominais de referência, tipografia (`Inter, system-ui`, base `14px`), raios de borda (`sm: 4px`, `md: 8px`, `lg: 12px`, `xl: 16px`) e espaçamentos (`xs: 4px` a `xl: 24px`).
- **Regra dos 10% de Cor Funcional (linha 76)**: A cor de destaque (*accent*) nunca deve ultrapassar 10% de uma tela operacional, deixando o foco visual para os dados e badges de estado (Disponível = Esmeralda, Implantado/Alugado = Azul, Manutenção = Âmbar, Crítico/Omissão = Vermelho).
- **Do's and Don'ts (linhas 121–132)**:
  - Números alinhados à direita (`tabular-nums`), textos à esquerda.
  - Bordas máximas de cards em `rounded-xl` (12px).
  - Proibido usar gradientes decorativos, *glassmorphism* ou faixas laterais coloridas em alertas no painel de gestão.

---

### 2.2. Análise Linha a Linha de `temp-app/src/app/globals.css`

O arquivo [`globals.css`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/src/app/globals.css) (linhas 1–299) implementa uma arquitetura de **duas camadas de variáveis CSS (Primitivos → Semânticos)** calibrada em espaço de cor **OKLCH** para garantir contraste WCAG AA tanto no tema claro (`:root`) quanto no tema escuro (`[data-theme='escuro']`).

| Faixa de Linhas | Bloco / Seletor | Explicação Detalhada Linha a Linha |
| :--- | :--- | :--- |
| **1–3** | `@tailwind base; @tailwind components; @tailwind utilities;` | Diretivas fundamentais de injeção das camadas do Tailwind CSS. |
| **5–62** | **Camada 1 — Primitivos (`:root`)** | Define os degraus de cor brutos que **nunca** devem ser consumidos diretamente nos componentes:<br>• **Linhas 23–36 (`--brand-50` a `--brand-950`)**: Rampa azul da marca (`--brand-600: #0066e0`, matiz OKLCH `258.4`). Documenta um detalhe histórico crucial: no `tailwind.config.ts`, a escala `indigo` foi sobrescrita por este azul `#0066e0`.<br>• **Linhas 38–46 (`--slate-50` a `--slate-900`)**: Neutros para o tema claro.<br>• **Linhas 48–61 (`--ink-950` a `--ink-50`)**: Neutros do tema escuro levemente tingidos com o matiz da marca (`oklch(L 0.010–0.020 258.4)`), evitando tanto o preto puro chapado quanto um "dark mode azulado" artificial. |
| **64–178** | **Camada 2 — Semânticos no Tema Claro (`:root`)** | Define os tokens consumidos pelos utilitários do Tailwind:<br>• **Linhas 83–94 (Superfícies e Estrutura)**: Escala de elevação por luminosidade (`--c-base`, `--c-canvas`, `--c-surface`, `--c-raised`, `--c-surface-hover`, `--c-chip`, `--c-chip-hover`, `--c-line`, `--c-line-soft`, `--c-line-strong`, `--c-scrim`).<br>• **Linhas 96–110 (Tinta e Desabilitado)**: `--c-ink` (contraste 17.85:1), `--c-ink-body` (10.35:1), `--c-muted` (`#657082`, 5.01:1 sobre surface), `--c-faint` (`#87909f`, exclusivo para ícones decorativos) e `--c-disabled-ink` (`#616874`, 4.55:1).<br>• **Linhas 111–125 (Marca / Accent)**: `--c-accent` (`--brand-600`), `--c-on-accent` (`#ffffff`, 5.28:1), `--c-on-accent-muted` (`--brand-50`, 4.89:1), `--c-focus` (`rgb(28 130 255 / 0.45)`).<br>• **Linhas 126–164 (5 Estados Operacionais)**:<br>  1. `pos-*` (Positivo / Administrado / Concluído — Verde Esmeralda `#047857`)<br>  2. `warn-*` (Atenção / Pendente / Atraso — Âmbar `#b45309`)<br>  3. `crit-*` (Crítico / Omissão / Alerta Clínico — Vermelho `#b91c1c`)<br>  4. `info-*` (Informação / Sincronizando — Azul `#1d4ed8`)<br>  5. `idle-*` (Neutro / Inativo — Slate)<br>• **Linhas 165–177 (Pesos Tipográficos, Sombras e Compat)**: `--w-strong: 700`, `--w-heavy: 800`, sombras `--sh-card`, `--sh-raised`, `--sh-float`, e variáveis legadas `--background` / `--foreground`. |
| **180–277** | **Camada 2 — Semânticos no Tema Escuro (`[data-theme='escuro']`)** | Redefine exclusivamente os tokens semânticos quando o atributo `data-theme="escuro"` está ativo no `<html>`:<br>• **Linhas 183–193**: A profundidade deixa de vir de sombras (`--sh-card: none`, `--sh-raised: none`) e passa a vir da luminância crescente das superfícies (`--c-base: #080a0e` < `--c-canvas: #111419` < `--c-surface: #1c2127` < `--c-raised: #292e36`).<br>• **Linhas 207–220**: Acentos dessaturados em -16% de croma (`#276cd1`) para não vibrarem excessivamente sobre fundo escuro.<br>• **Linhas 222–255**: Recalibração de todas as cores de estado (`pos`, `warn`, `crit`, `info`, `idle`) garantindo contraste ≥ 4.5:1 em botões sólidos e ≥ 8:1 em textos de alerta.<br>• **Linhas 256–267**: Redução automática de um degrau nos pesos tipográficos extremos (`--w-strong: 600`, `--w-heavy: 700`) porque texto claro sobre fundo escuro sofre irradiação óptica e aparenta ser mais grosso que no tema claro. |
| **279–299** | **Regras Globais de `body`, Ring Offset e Utilities** | • **Linhas 279–283**: Aplica `--foreground` e `--background` ao `body`.<br>• **Linhas 285–292**: Sobrescreve `--tw-ring-offset-color: var(--c-canvas)` em `*, ::before, ::after` para evitar halo branco nos anéis de foco do Tailwind quando em modo escuro.<br>• **Linhas 294–298**: Utilitário `.text-balance { text-wrap: balance; }`. |

---

### 2.3. Análise Linha a Linha de `temp-app/tailwind.config.ts`

O arquivo [`tailwind.config.ts`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/tailwind.config.ts) (linhas 1–152) conecta os tokens CSS de `globals.css` ao compilador do Tailwind:

- **Linha 12 (`const token = (name: string) => var(--c-${name})`)**: Helper que mapeia o nome curto do token para a variável CSS semântica.
- **Linhas 15–19 (`content`)**: Escaneia `./src/pages/**/*`, `./src/components/**/*` e `./src/app/**/*`.
- **Linhas 30–44 (`theme.extend.colors.indigo`)**: Mantém a escala `indigo` (na prática azul `#0066e0`) para retrocompatibilidade com telas que usam classes `bg-indigo-600`, `text-indigo-700`, etc.
- **Linhas 50–120 (`theme.extend.colors`)**: Registra todos os tokens semânticos (`canvas`, `surface`, `raised`, `surface-hover`, `chip`, `line`, `ink`, `ink-body`, `muted`, `faint`, `accent`, `pos-*`, `warn-*`, `crit-*`, `info-*`, `idle-*`), gerando automaticamente `bg-*`, `text-*`, `border-*`, `divide-*`, `ring-*`.
- **Linhas 122–130 (`backgroundColor.base`, `borderColor.base`, `ringOffsetColor.base`)**: Isola o token `base` apenas para fundo/borda/ring-offset para **não colidir** com a classe tipográfica nativa `text-base` (`font-size: 1rem`) do Tailwind!
- **Linhas 134–138 (`fontWeight`)**: Registra `font-strong` (`var(--w-strong)`), `font-heavy` (`var(--w-heavy)`) e `font-black` (`800`, evitando que fontes de sistema no Windows caiam em corte incorreto no peso `900`).
- **Linhas 142–146 (`boxShadow`)**: Registra `shadow-card`, `shadow-raised` e `shadow-float`.

---

## 3. Arquivos de Configuração do Next.js, TypeScript e Playwright

### 3.1. `temp-app/next.config.mjs` (Linhas 1–16)
- **Linha 2**: Inicializa `nextConfig = {}`.
- **Linhas 6–13**: Quando `process.env.NODE_ENV === 'development'` e `process.env.CLINICAL_LOCAL_D1 !== 'false'`, importa dinamicamente `@cloudflare/next-on-pages/next-dev` e executa `await setupDevPlatform()`.
  - **Regra de Negócio / Arquitetura**: Como todas as rotas da API do GestorCoop rodam em **Cloudflare Edge Runtime** (`export const runtime = 'edge'`), o `setupDevPlatform()` injeta no servidor de desenvolvimento (`next dev`) o binding `env.DB` conectado ao banco SQLite local do Wrangler (`.wrangler/state/v3/d1`), permitindo que o painel do gestor, o portal do cooperado e a sincronização offline compartilhem o mesmo banco D1 local durante o desenvolvimento e nos testes E2E!

### 3.2. `temp-app/tsconfig.json` (Linhas 1–27)
- Configura TypeScript 5 com `strict: true`, `noEmit: true`, `moduleResolution: "bundler"`, `isolatedModules: true` e alias de importação `"@/*": ["./src/*"]` (linhas 20–22).

### 3.3. `temp-app/playwright.config.ts` (Linhas 1–38)
- **Linhas 6–10**: Diretório de testes `./tests/e2e`, timeout de `60_000` ms (60s) por teste, execução `fullyParallel: true`, `retries: 2` em CI e `0` localmente.
- **Linhas 11–14**: `baseURL: 'http://localhost:3005'` e captura de trace (`retain-on-failure`).
- **Linhas 15–26 (`projects`)**: Configura o navegador `chromium` com permissão de microfone (`permissions: ['microphone']`) e flags do Chrome `--use-fake-ui-for-media-stream` e `--use-fake-device-for-media-stream` para permitir testar gravação de áudio clínico e câmera de validação facial de forma 100% automatizada e headless!
- **Linhas 27–36 (`webServer`)**: Sobe automaticamente `npm run dev -- -p 3005` com `CLINICAL_LOCAL_D1: 'true'` antes de iniciar a suíte E2E.

---

## 4. Diretrizes de Engenharia e Governança (`AGENTS.md`)

O arquivo [`AGENTS.md`](file:///c:/Users/admin/Documents/projetos/gestorcoop/AGENTS.md) na raiz do repositório estabelece o contrato operacional para desenvolvedores e agentes de IA:

1. **Fluxo de Branches Protegido (`homolog` → `main`)**:
   - `homolog` é a branch default de integração contínua. Todo Pull Request de feature/fix deve apontar para `homolog`.
   - `main` é a branch de produção (`gestorcoop.app`) e só aceita Pull Requests vindos exclusivamente de `homolog`.
2. **Os 4 Gates Obrigatórios de CI/CD (executados no Self-Hosted Runner da VPS Oracle `163.176.25.166`)**:
   - **Gate 1 (`Guards`)**: Verifica se PR para `main` vem de `homolog`, valida nomenclatura sequencial das migrações `temp-app/migrations/<numero>_<slug>.sql` e barra comandos SQL destrutivos (`DROP TABLE`, `DROP COLUMN`, `RENAME`, `TRUNCATE`, `DELETE FROM`) caso o PR não tenha a label `contract-aprovado`.
   - **Gate 2 (`Lint · Typecheck · Test · Build`)**: Executa `npm run lint`, `npx tsc --noEmit`, `npm run test:documentacao`, `npm run test:prontuarios` e `npm run build`.
   - **Gate 3 (`Migrações do zero`)**: Cria um banco SQLite/D1 limpo efêmero e aplica todas as migrações `0001` a `0012` em ordem para garantir que nenhuma migração quebre o provisionamento do zero.
   - **Gate 4 (`Segredos - gitleaks`)**: Audita commits em busca de chaves ou tokens vazados.

---

## 5. Catálogo Completo dos Documentos Históricos, Auditorias, Planos e Tutoriais em `docs/`

Além desta coleção completa em `docs/manual-handover/`, a pasta `docs/` contém documentos históricos de arquitetura, auditorias de performance, especificações de produto e vídeos tutoriais. Abaixo está o inventário comentado de cada arquivo:

### 5.1. Guias e Análises na Raiz de `docs/`

| Arquivo | Resumo do Conteúdo e Regras Documentadas |
| :--- | :--- |
| [`docs/como-trabalhar.md`](file:///c:/Users/admin/Documents/projetos/gestorcoop/docs/como-trabalhar.md) | Guia rápido de 1 página sobre os 4 ambientes (`localhost:3000`, Preview Cloudflare Pages, Homolog e Produção), o ciclo de PRs `feature → homolog → main`, os 4 Gates na VPS Oracle e a filosofia *Expand-Contract* para migrações D1. |
| [`docs/bubble-data-api-guia.md`](file:///c:/Users/admin/Documents/projetos/gestorcoop/docs/bubble-data-api-guia.md) | Manual técnico completo da **Data API do Bubble.io**: diferença entre Workflow API e Data API, endpoints `/api/1.1/obj/<tipo>`, diferença entre `version-test` e `live`, paginação (`cursor`/`remaining`), operadores de filtro JSON (`equals`, `in`, `text contains`, etc.), Option Sets e boas práticas de segurança com o Bearer Token Admin. |
| [`docs/analise-modulo-aluguel-equipamentos-home-care.md`](file:///c:/Users/admin/Documents/projetos/gestorcoop/docs/analise-modulo-aluguel-equipamentos-home-care.md) | Levantamento de requisitos de domínio para o módulo de Locação e Gestão de Equipamentos Hospitalares em Home Care: ciclo de vida do ativo, rastreabilidade por número de série/patrimônio, manutenção preventiva/corretiva, higienização obrigatória pós-recolhimento e controle de faturamento pró-rata. |
| [`docs/auditoria-prontuarios-embed-bubble-2026-09-10.md`](file:///c:/Users/admin/Documents/projetos/gestorcoop/docs/auditoria-prontuarios-embed-bubble-2026-09-10.md) | Auditoria técnica da integração via `<iframe>` entre o ERP Bubble e o módulo de Prontuários no Cloudflare Pages, documentando a solução para o bloqueio de cookies de terceiros (ITP do Safari/iOS) usando código efêmero de troca (`/api/auth/embed/exchange`) + `sessionStorage` + header `X-Cooperado-Session`. |
| [`docs/auditoria-prontuario-2026-10-01.md`](file:///c:/Users/admin/Documents/projetos/gestorcoop/docs/auditoria-prontuario-2026-10-01.md) | Relatório de auditoria funcional e clínica do módulo de prontuários (conformidade SOAP, assinatura com hash SHA-256, checagem de aprazamentos e bloqueio de check-out sem checagem). |
| [`docs/otimizacao-requisicoes-prontuarios-2026-10-06.md`](file:///c:/Users/admin/Documents/projetos/gestorcoop/docs/otimizacao-requisicoes-prontuarios-2026-10-06.md) | Diagnóstico e solução para redução drástica de chamadas ao Bubble e D1 no Prontuário 360°: introdução dos índices compostos (`0009` e `0010`), cache em memória com TTL e deduplicação de promessas em voo (`cache-memoria.ts` e `cache-navegacao.ts`), e endpoint consolidado `/dashboard`. |
| [`docs/plano-dashboard-paciente-e-plano-terapeutico.md`](file:///c:/Users/admin/Documents/projetos/gestorcoop/docs/plano-dashboard-paciente-e-plano-terapeutico.md) | Especificação da aba Dashboard Geral 360° do Paciente e do Plano Terapêutico Multiprofissional com controle de cotas de visitas por especialidade e vigência. |
| [`docs/validacao-plano-terapeutico-prontuario.md`](file:///c:/Users/admin/Documents/projetos/gestorcoop/docs/validacao-plano-terapeutico-prontuario.md) | Roteiro de validação e matriz de casos de teste das regras de negócio do Plano Terapêutico (múltiplos cooperados na mesma meta, independência entre especialidades, bloqueio HTTP 403 ao atingir 100% da cota e versionamento de planos). |

---

### 5.2. Trilha de Implementação do Módulo de Equipamentos (`docs/implementacao-modulo-equipamentos/`)

Esta subpasta documenta as 7 fases de engenharia que guiaram a construção do módulo de equipamentos:
1. [`README.md`](file:///c:/Users/admin/Documents/projetos/gestorcoop/docs/implementacao-modulo-equipamentos/README.md) e [`PROGRESSO.md`](file:///c:/Users/admin/Documents/projetos/gestorcoop/docs/implementacao-modulo-equipamentos/PROGRESSO.md): Índice e checklist de progresso das fases.
2. [`00-preparacao-e-decisoes.md`](file:///c:/Users/admin/Documents/projetos/gestorcoop/docs/implementacao-modulo-equipamentos/00-preparacao-e-decisoes.md): Decisão arquitetural de manter o cadastro mestre em `Equipamento` / `Locação Equipamento` no Bubble combinado com tabelas operacionais e trilha de auditoria imutável no Cloudflare D1 (`0002_equipamentos.sql`).
3. [`01-fundamentos-e-seguranca.md`](file:///c:/Users/admin/Documents/projetos/gestorcoop/docs/implementacao-modulo-equipamentos/01-fundamentos-e-seguranca.md): Máquina de estados (`equipamentos-estados.ts`), RBAC por perfil (`Administrador`, `Gestor`, `Financeiro`, `Logística`, `Manutenção`, `Estoquista`) e trilha de eventos imutáveis.
4. [`02-estoque-e-movimentacoes.md`](file:///c:/Users/admin/Documents/projetos/gestorcoop/docs/implementacao-modulo-equipamentos/02-estoque-e-movimentacoes.md): Regras de entrada em estoque, reserva com expiração automática, despacho, implantação no domicílio, recolhimento, conferência de retorno e higienização.
5. [`03-manutencao-e-ciclo-de-vida.md`](file:///c:/Users/admin/Documents/projetos/gestorcoop/docs/implementacao-modulo-equipamentos/03-manutencao-e-ciclo-de-vida.md): Ordens de Serviço (OS) preventivas e corretivas, catálogo de peças/itens de manutenção e fluxo de recomendação e aprovação segregada de baixa patrimonial.
6. [`04-locacao-e-financeiro.md`](file:///c:/Users/admin/Documents/projetos/gestorcoop/docs/implementacao-modulo-equipamentos/04-locacao-e-financeiro.md): Cálculo financeiro pró-rata (`equipamentos-financeiro.ts`), suspensões temporárias de cobrança (ex.: paciente hospitalizado) e cálculo de rentabilidade/ROI por ativo.
7. [`05-paineis-relatorios-e-alertas.md`](file:///c:/Users/admin/Documents/projetos/gestorcoop/docs/implementacao-modulo-equipamentos/05-paineis-relatorios-e-alertas.md): Motor de geração de alertas operacionais (`equipamentos-jobs.ts`) e relatórios de inventário, movimentações e manutenções.
8. [`06-homologacao-e-entrada-em-producao.md`](file:///c:/Users/admin/Documents/projetos/gestorcoop/docs/implementacao-modulo-equipamentos/06-homologacao-e-entrada-em-producao.md): Checklist de homologação e script `homologacao-equipamentos.mts`.

---

### 5.3. Especificações e Planos Arquiteturais (`docs/superpowers/`)

#### Especificações (`docs/superpowers/specs/`)
- [`2026-06-12-gestorcoop-design.md`](file:///c:/Users/admin/Documents/projetos/gestorcoop/docs/superpowers/specs/2026-06-12-gestorcoop-design.md): Especificação original do portal de Adesão de Cooperados, integração ZapSign e Painel de Gestão de Documentos.
- [`2026-06-30-painel-financeiro-cooperados-design.md`](file:///c:/Users/admin/Documents/projetos/gestorcoop/docs/superpowers/specs/2026-06-30-painel-financeiro-cooperados-design.md): Especificação do Painel Financeiro de Cooperados (`/gestor/financeiro`), cruzando Contas, Escalas e Serviços/Plantões do Bubble.
- [`2026-07-21-gerador-numero-serie-design.md`](file:///c:/Users/admin/Documents/projetos/gestorcoop/docs/superpowers/specs/2026-07-21-gerador-numero-serie-design.md): Regra de negócio para geração padronizada de Números de Série internos quando o ativo não possui serial de fábrica legível.
- [`2026-08-05-romaneio-entrega-cliente-design.md`](file:///c:/Users/admin/Documents/projetos/gestorcoop/docs/superpowers/specs/2026-08-05-romaneio-entrega-cliente-design.md): Especificação do documento de Romaneio de Entrega/Retirada de equipamentos no domicílio do paciente (`/gestor/equipamentos/romaneio`).

#### Planos de Implementação (`docs/superpowers/plans/`)
- [`2026-06-12-gestorcoop-implementation-plan.md`](file:///c:/Users/admin/Documents/projetos/gestorcoop/docs/superpowers/plans/2026-06-12-gestorcoop-implementation-plan.md): Plano de implementação inicial do GestorCoop.
- [`2026-07-16-correcao-schema-equipamentos.md`](file:///c:/Users/admin/Documents/projetos/gestorcoop/docs/superpowers/plans/2026-07-16-correcao-schema-equipamentos.md) e [`2026-07-16-mcp-fix-notes.md`](file:///c:/Users/admin/Documents/projetos/gestorcoop/docs/superpowers/plans/2026-07-16-mcp-fix-notes.md): Mapeamento real dos nomes de campos e Option Sets do Bubble para o módulo de equipamentos.
- [`2026-07-21-gerador-numero-serie.md`](file:///c:/Users/admin/Documents/projetos/gestorcoop/docs/superpowers/plans/2026-07-21-gerador-numero-serie.md): Plano técnico do gerador de número de série.
- [`2026-08-05-romaneio-entrega-cliente.md`](file:///c:/Users/admin/Documents/projetos/gestorcoop/docs/superpowers/plans/2026-08-05-romaneio-entrega-cliente.md): Plano técnico do gerador e tela de impressão de Romaneio.
- [`2026-08-10-equipamentos-terceiros-d1.md`](file:///c:/Users/admin/Documents/projetos/gestorcoop/docs/superpowers/plans/2026-08-10-equipamentos-terceiros-d1.md): Arquitetura de persistência de equipamentos sublocados de terceiros (`equipamentos_terceiros` no D1 via `src/lib/db/terceiros.ts`), permitindo gerenciá-los de ponta a ponta sem poluir o patrimônio próprio no Bubble.
- [`2026-08-10-prontuario-clinico-embed-bubble.md`](file:///c:/Users/admin/Documents/projetos/gestorcoop/docs/superpowers/plans/2026-08-10-prontuario-clinico-embed-bubble.md): Plano de arquitetura do Prontuário Eletrônico Offline-First embutido no Bubble via SSO/HMAC.

---

### 5.4. Centro de Tutoriais e Vídeos (`docs/tutoriais/`)

A pasta `docs/tutoriais/` contém a documentação de treinamento para usuários finais e 9 vídeos `.webm` gerados automaticamente via Playwright:
- [`TUTORIAL-COMPLETO-PRONTUARIOS-GESTAO-E-COOPERADO.md`](file:///c:/Users/admin/Documents/projetos/gestorcoop/docs/tutoriais/TUTORIAL-COMPLETO-PRONTUARIOS-GESTAO-E-COOPERADO.md): Roteiro passo a passo das 4 partes do Painel do Gestor (`tutorial-gestor-parte1` a `parte4.webm`) e das 4 partes do Aplicativo Mobile do Cooperado (`tutorial-cooperado-parte1` a `parte4.webm`).
- [`TUTORIAL-DASHBOARD-E-PLANO-TERAPEUTICO.md`](file:///c:/Users/admin/Documents/projetos/gestorcoop/docs/tutoriais/TUTORIAL-DASHBOARD-E-PLANO-TERAPEUTICO.md) e [`tutorial-dashboard-e-plano-terapeutico.webm`](file:///c:/Users/admin/Documents/projetos/gestorcoop/docs/tutoriais/tutorial-dashboard-e-plano-terapeutico.webm): Guia focado na gestão do Dashboard 360° do Paciente e configuração de Planos Terapêuticos.
