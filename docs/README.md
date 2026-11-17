# 📚 Documentação Completa do Repositório GestorCoop (Manual de Handover)

Bem-vindo à central de documentação do **GestorCoop**. Esta pasta contém a **documentação completa, linha a linha, tabela por tabela, endpoint por endpoint e regra de negócio por regra de negócio** de todo o ecossistema do repositório (`temp-app`, `migrations`, `cron-worker`, `scripts`, `tests`, `.github/workflows` e `befree-bubble-mcp`).

---

## 📘 Manual Completo de Handover (`docs/manual-handover/`)

Para entender o sistema do zero até os detalhes de cada linha de código e banco de dados, siga a coleção estruturada em **10 Volumes** dentro de [`docs/manual-handover/`](./manual-handover/):

| Volume | Documento | O que está documentado (Linha a Linha + Regras de Negócio) |
| :---: | :--- | :--- |
| **00** | [**Guia Mestre de Handover, Regras de Negócio e Mapa de Arquivos**](./manual-handover/00-guia-mestre-regras-de-negocio-e-glossario.md) | Visão executiva dos 4 subdomínios, enciclopédia consolidada de todas as regras de negócio de todos os módulos e **mapa completo dos 200+ arquivos** do repositório. |
| **01** | [**Arquitetura, Infraestrutura Cloudflare, Auth/SSO/Embed e CI/CD**](./manual-handover/01-arquitetura-infra-cicd-e-setup.md) | `wrangler.toml`, `package.json`, `.github/workflows/ci.yml` (4 Gates na VPS Oracle), `cron-worker`, roteamento multi-subdomínio (`middleware.ts`, `subdominios.ts`), JWT HS256 (`sessao-token.ts`, `sessao.ts`, `sessao-cooperado.ts`), autenticação iframe HMAC (`auth-embed.ts`), rotas `/api/auth/*` e telas de login/entrada. |
| **02** | [**Banco de Dados Cloudflare D1, Todas as 12 Migrations SQL e Camada DB**](./manual-handover/02-banco-de-dados-d1-e-migracoes.md) | Diagrama ER completo, **todas as 12 migrations SQL (`0001` a `0012`) documentadas linha a linha** (tabelas, colunas, constraints `CHECK`, índices, triggers de imutabilidade) e análise completa de `src/lib/db/client.ts`, `prontuarios.ts`, `equipamentos.ts` e `terceiros.ts`. |
| **03** | [**Integrações Externas: Bubble Data API, ZapSign, IA e Cache**](./manual-handover/03-integracoes-bubble-zapsign-e-ia.md) | Cliente completo da Data API do Bubble (`bubble.ts`), gerador de PDF de Termo de Adesão (`termo-template.ts`), assinatura eletrônica e webhook ZapSign (`zapsign.ts`, `/api/webhooks/zapsign`), cascata de IA OpenAI/Groq/Workers AI (`ia/provedores.ts`, `ia/limites.ts`, `/api/cooperado/transcrever`) e camada de fetch/cache (`api-cliente.ts`, `client-fetch.ts`, `cache-memoria.ts`, `cache-navegacao.ts`). |
| **04** | [**Módulo de Adesão de Cooperados, Documentos, Termos e Financeiro**](./manual-handover/04-modulo-adesao-cooperados-e-documentos.md) | Validação de CPF (`cpf.ts`), matriz de profissões e conselhos (`profissoes.ts`, `validacao-conselho.ts`), matriz de documentos obrigatórios (`documentos.ts`, `comprovante-upload.ts`), empresas contratantes (`empresas-contratantes.ts`), rotas `/api/cooperado/*` e `/api/gestor/cooperados/*`, Painel Financeiro (`/api/gestor/financeiro/*`) e telas do funil de adesão e gestão. |
| **05** | [**Módulo do Cooperado: Plantões, Prontuário Beira-Leito e Motor Offline-First**](./manual-handover/05-modulo-prontuario-clinico-cooperado-e-offline.md) | Perfis clínicos (`tipos-clinicos.ts`), motor de aprazamento (`aprazamento-engine.ts`), banco local IndexedDB (`indexeddb.ts`), sincronizador background idempotente (`sync-service.ts`, `/api/cooperado/sync`), gravador de áudio (`audio-recorder.ts`), validação facial (`validacao-facial-modal.tsx`) e tela de atendimento beira-leito (`prontuario-atendimento.tsx`). |
| **06** | [**Módulo Prontuário 360° do Gestor e Plano Terapêutico Versionado**](./manual-handover/06-modulo-prontuario-360-gestor-e-plano-terapeutico.md) | Sincronização de pacientes Bubble ↔ D1 (`sync-pacientes.ts`), equipamentos por paciente (`prontuario-equipamentos.ts`), todas as 15 rotas de API de prontuários/pacientes/domicílios do gestor, Plano Terapêutico Dinâmico e Versionado (`plano-terapeutico-tab.tsx`), Dashboard 360° (`dashboard-geral.tsx`), auditoria clínica e impressão oficial de prontuário (`impressao-prontuario.tsx`). |
| **07** | [**Módulo de Equipamentos Home Care, Locações, Manutenção, Baixas e Romaneio**](./manual-handover/07-modulo-equipamentos-locacoes-manutencao-e-baixas.md) | Máquina de estados finita (`equipamentos-estados.ts`), cálculo pró-rata, suspensões e ROI (`equipamentos-financeiro.ts`), jobs de alertas e expiração de reservas (`equipamentos-jobs.ts`), romaneio (`romaneio-entrega.ts`), todas as 29 rotas de API de equipamentos e locações, e telas de gestão de ativos, manutenção e baixas. |
| **08** | [**Scripts de Auditoria, Testes Automatizados (Unitários + E2E) e Befree Bubble MCP**](./manual-handover/08-scripts-testes-e-befree-bubble-mcp.md) | Documentação linha a linha dos 9 scripts `.mts` em `temp-app/scripts/`, suíte de testes de API e stubs D1 em memória (`tests/api/`), catálogo das 25 especificações E2E Playwright (`tests/e2e/`) e arquitetura completa do servidor Python `befree-bubble-mcp`. |
| **09** | [**Design System, Configurações de Build, UX Tokens e Acervo Histórico**](./manual-handover/09-design-system-ux-e-documentos-historicos.md) | Documentação linha a linha de `globals.css` (tokens semânticos OKLCH claro/escuro), `tailwind.config.ts`, `next.config.mjs`, `playwright.config.ts`, `tsconfig.json`, `DESIGN.md`, `PRODUCT.md`, `AGENTS.md` e catálogo de todos os documentos históricos e vídeos tutoriais. |

---

## 🗂️ Outros Documentos e Tutoriais na Pasta `docs/`

- **Guias Operacionais e de Integração**:
  - [`como-trabalhar.md`](./como-trabalhar.md): Resumo rápido do fluxo de trabalho (`homolog → main`) e dos 4 Gates de CI.
  - [`bubble-data-api-guia.md`](./bubble-data-api-guia.md): Guia prático de uso da Data API REST do Bubble.io.
- **Auditorias e Planos de Arquitetura**:
  - [`analise-modulo-aluguel-equipamentos-home-care.md`](./analise-modulo-aluguel-equipamentos-home-care.md)
  - [`auditoria-prontuarios-embed-bubble-2026-09-10.md`](./auditoria-prontuarios-embed-bubble-2026-09-10.md)
  - [`auditoria-prontuario-2026-10-01.md`](./auditoria-prontuario-2026-10-01.md)
  - [`otimizacao-requisicoes-prontuarios-2026-10-06.md`](./otimizacao-requisicoes-prontuarios-2026-10-06.md)
  - [`plano-dashboard-paciente-e-plano-terapeutico.md`](./plano-dashboard-paciente-e-plano-terapeutico.md)
  - [`validacao-plano-terapeutico-prontuario.md`](./validacao-plano-terapeutico-prontuario.md)
- **Trilha de Implementação do Módulo de Equipamentos**:
  - [`implementacao-modulo-equipamentos/README.md`](./implementacao-modulo-equipamentos/README.md) (Fases `00` a `06` + `PROGRESSO.md`)
- **Especificações e Planos (`superpowers/`)**:
  - [`superpowers/specs/`](./superpowers/specs/) e [`superpowers/plans/`](./superpowers/plans/)
- **Vídeos Tutoriais (`.webm`) e Roteiros de Treinamento**:
  - [`tutoriais/TUTORIAL-COMPLETO-PRONTUARIOS-GESTAO-E-COOPERADO.md`](./tutoriais/TUTORIAL-COMPLETO-PRONTUARIOS-GESTAO-E-COOPERADO.md)
  - [`tutoriais/TUTORIAL-DASHBOARD-E-PLANO-TERAPEUTICO.md`](./tutoriais/TUTORIAL-DASHBOARD-E-PLANO-TERAPEUTICO.md)
