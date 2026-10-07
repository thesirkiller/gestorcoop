# Otimização das requisições — módulo de Prontuários (2026-10-06)

## 1. Diagnóstico

Stack relevante: Next 14 no runtime **edge** (Cloudflare Pages + next-on-pages), banco clínico em **D1**, cadastro de pacientes/equipamentos no **Bubble Data API**.

No Cloudflare o custo que domina uma tela não é CPU nem SQL: é **número de idas sequenciais** ao D1 (cada `prepare().all()` é um round trip até a região primária do banco) e **paginação completa** na Data API do Bubble (100 registros por página).

### 1.1 Listagem `/gestor/prontuarios`

| Ponto | O que acontecia | Custo |
|---|---|---|
| `GET /api/gestor/prontuarios/pacientes` | Para **cada** paciente (D1 + todos do Bubble), em sequência: `obterPlanoTerapeuticoVigente` → 1 query de planos + 1 query de metas **por plano** + 1 `SELECT *` de evoluções (com transcrições) | ~3 × N idas em série. Com 300 pacientes ≈ 900+ round trips antes da tela abrir |
| mesma rota | `bubbleApi.getPacientes()` pagina a tabela inteira do Bubble a cada abertura | N/100 requisições ao Bubble |
| contadores do card | Com D1, `total_prescricoes_ativas`, `visitas_realizadas_mes`, `ultima_evolucao_*`, `ultimo_sinal_vital` eram calculados a partir dos `Map` em memória do isolate | **bug**: em produção quase sempre 0/vazio |
| tela (cliente) | `useEffect([selectedSpecialty, selectedComplexidade])` refazia **tudo** — pacientes, evoluções, base do Bubble e lista completa de cooperados — a cada troca de filtro, inclusive o de complexidade, que é filtro de cliente | 4+ requisições pesadas por clique |
| tela (cliente) | Base do Bubble e cooperados (paginação completa) carregados na abertura, mas só usados no modal de admissão | 2 cargas pesadas desnecessárias |

### 1.2 Detalhe `/gestor/prontuarios/[id]`

| Ponto | O que acontecia | Custo |
|---|---|---|
| cliente | 1 requisição (`/pacientes/[id]`) **e depois** mais 5 em paralelo (`/dashboard`, `/planos`, `/prescricoes`, `/sinais-vitais`, `/parecer`) | 2 ondas, 6 requisições, 6 validações de sessão (cada uma 1 query ao D1) |
| servidor | Evoluções do paciente lidas **5 vezes**; planos e metas 2 vezes (com N+1 de metas) | ~20 queries ao D1 |
| `/dashboard` | `bubbleApi.getLocacoes()` + `bubbleApi.getEquipamentos()` **sem filtro** (todas as locações e todos os equipamentos), para filtrar um paciente em memória | parte mais lenta da tela |

### 1.3 Transversal

- `garantirSchemaD1` disparava ~19 comandos DDL **em série** na primeira query de cada isolate novo. Isolates são reciclados com frequência, então isso aparecia em boa parte das aberturas.
- `listarPlanosTerapeuticosPorPaciente` (usada também na validação de check-in do cooperado) tinha N+1 de metas.

## 2. Avaliação: RPC no D1

D1 é SQLite: **não há stored procedures / `rpc()` como no Postgres/Supabase**. O equivalente correto é:

1. **`db.batch([...])`** — várias instruções, **um** round trip, executadas em transação implícita (leitura consistente entre as instruções).
2. **SQL set-based** — trocar o laço por paciente por `GROUP BY` / `JOIN` / window functions (`ROW_NUMBER() OVER (PARTITION BY ...)`).
3. **Endpoint agregador ("BFF")** — uma rota que devolve tudo o que a tela precisa, em vez de a tela orquestrar N rotas.

Foi esse o desenho adotado. Migrar para Postgres só para ter `rpc()` não se justifica: o ganho vem de eliminar idas, e o `batch` já entrega isso no D1.

## 3. O que foi implementado (Fase 1)

| Mudança | Arquivo | Efeito |
|---|---|---|
| `listarPacientesComResumoClinico()` — 8 instruções agregadas em **1 batch** (pacientes, prescrições ativas por paciente, última evolução, visitas do mês, último sinal vital, planos vigentes, metas, realizadas por plano/especialidade) | `src/lib/db/prontuarios.ts` | Listagem: de ~3N idas para **1**. Corrige os contadores dos cards em produção |
| `GET /pacientes` usa o agregador, em paralelo com o Bubble; lista do Bubble memoizada por isolate (60 s, só valores já resolvidos — **sem** compartilhar Promise em andamento entre requisições, que no Workers fica presa ao contexto da requisição que a criou; invalidada em `createPaciente`/`updatePaciente`, e cargas iniciadas antes da invalidação não gravam) | `api/gestor/prontuarios/pacientes/route.ts`, `src/lib/cache-memoria.ts` | Bubble deixa de ser paginado a cada abertura |
| Linha do tempo de evoluções com `LEFT JOIN pacientes` (pela PK) — com D1 ela saía sem `paciente_nome`/`paciente_cpf` (coluna principal e campo de busca da aba) | `listarEvolucoesClinicas`, `carregarProntuario360` | Corrige a aba; o plano de execução continua usando `idx_evolucoes_check_in` / `idx_evolucoes_paciente_checkin` |
| `carregarProntuario360()` — 7 instruções em **1 batch**; progresso do plano e cota mensal calculados das mesmas evoluções | `src/lib/db/prontuarios.ts` | Detalhe: de ~20 queries para **1** ida |
| `GET /pacientes/[id]` vira o "RPC" do prontuário 360° (superconjunto do payload antigo + `planos`, `planoVigente`, `pendencias`, `completo: true`) | `api/gestor/prontuarios/pacientes/[id]/route.ts` | Cliente faz 1 requisição em vez de 6 |
| Novo `GET /pacientes/[id]/equipamentos`; locações filtradas por `fk_paciente` **no Bubble** e equipamentos buscados por id (com fallback para a varredura antiga se o Bubble recusar o filtro) | `src/lib/prontuario-equipamentos.ts`, rota nova | Tela clínica não espera o Bubble; Bubble deixa de varrer tabelas inteiras |
| `/dashboard` reaproveita o agregador + equipamentos filtrados (payload idêntico) | `api/.../[id]/dashboard/route.ts` | Mesmo ganho para quem ainda usa a rota |
| Tela de detalhe: se `completo === true`, renderiza da resposta única e busca equipamentos em segundo plano; senão, usa o fluxo antigo (compatível com servidores antigos e mocks dos E2E) | `gestor/prontuarios/[id]/prontuario-detalhe.tsx` | — |
| Tela de listagem: pacientes carregam uma vez; evoluções só ao trocar especialidade; complexidade não refaz requisição; base do Bubble + cooperados só ao abrir o modal de admissão; skeleton por aba | `gestor/prontuarios/page.tsx` | Fim das recargas completas por clique |
| Sonda de schema em **1** instrução antes do DDL | `garantirSchemaD1` | Cold start: de ~19 idas para 1 |
| N+1 removido de `listarPlanosTerapeuticosPorPaciente` (planos + metas + evoluções num batch) | idem | Check-in do cooperado e `/planos` mais rápidos |
| Migration `0009_indices_consultas_agregadas.sql` | `migrations/` | Índices para pareceres por paciente, timeline por `check_in` e planos por status/vigência |

**Status da migration**:
A migration `0009_indices_consultas_agregadas.sql` foi aplicada com sucesso no banco remoto Cloudflare D1 (`gestorcoop-db`):
```bash
npx wrangler d1 migrations apply gestorcoop-db --remote
```

Validação dos testes:
- **Testes Unitários & RPC D1**: `npm run test:prontuarios` (20 testes passando com 100% de sucesso).
- **Typecheck estrito**: `npx tsc --noEmit` sem erros em todo o repositório.
- **Testes End-to-End**: Playwright validado com 32/32 testes aprovados (100% verde) cobrindo:
  - `tests/e2e/prontuario-360-agregado.spec.ts` (1 teste aprovado)
  - `tests/e2e/gestor-prontuarios-360.spec.ts` (4 testes aprovados)
  - `tests/e2e/prontuarios-e2e-completo.spec.ts` (6 testes aprovados)
  - `tests/e2e/gestor-shell.spec.ts` (4 testes aprovados)
  - `tests/e2e/plano-terapeutico-real-paciente.spec.ts` (3 testes aprovados, com `.first()` garantindo resiliência a registros pré-existentes no D1)
  - `tests/e2e/admissao-paciente-bubble-plano-dinamico.spec.ts` (1 teste aprovado, com `waitForResponse` no submit de admissão e payload com `completo: true`)
  - `tests/e2e/equipamentos.spec.ts` (13 testes aprovados)

## 3.1 Fase 1.1 — pendências da Fase 1 (implementadas)

| Mudança | Arquivo | Efeito |
|---|---|---|
| Última evolução / último sinal da listagem: a janela `ROW_NUMBER()` sobre as tabelas inteiras virou subconsulta correlacionada **por paciente listado** (`e.rowid = (SELECT ... WHERE paciente_id = pac.id ORDER BY check_in DESC, rowid ASC LIMIT 1)`), guiada pelos mesmos filtros de status/complexidade | `listarPacientesComResumoClinico` | `rows_read` deixa de crescer com o histórico inteiro: ~1 seek de índice + 1 linha por paciente. O teste confere o plano (`SEARCH ... idx_evolucoes_paciente*` / `idx_sinais_vitais_paciente`, sem `SCAN` nem B-tree temporária) e a paridade com a janela antiga. Empate exato de horário: vence a primeira linha inserida (ordem natural do índice) |
| Linha do tempo global com **projeção leve**: `listarEvolucoesResumo()` devolve só o que tabela/CSV/busca usam + `resumo` (≤ 240 caracteres de `soap_avaliacao \|\| transcricao_revisada`) + contagem de aprazamentos; sem `transcricao_crua`, `audio_url`, SOAP completo, assinatura | `src/lib/db/prontuarios.ts`, `api/gestor/prontuarios/route.ts` | Payload da aba de evoluções cai de transcrições inteiras ×100 para ~300 bytes por item. 1 ida (2 instruções no mesmo `batch`) |
| Opt-in da projeção por **cabeçalho** `X-Gestorcoop-Projecao: resumo` (ou `?projecao=resumo`); resposta com `Vary` e campo `projecao` | idem | A URL não muda: os mocks dos E2E (`page.route('**/api/gestor/prontuarios')`, que não casam com query string) continuam valendo. Sem o cabeçalho o payload é o completo — a reconciliação de medicamentos (`/gestor/prontuarios/auditoria`) depende dele |
| KPI de **conformidade medicamentosa** com D1: a projeção conta, por evolução, aprazamentos do paciente executados entre `check_in` e `check_out` (ou agora, se aberto) — mesmo critério do caminho em memória. A tela usa as contagens quando presentes e cai em `ev.aprazamentos` caso contrário | `listarEvolucoesResumo`, `gestor/prontuarios/page.tsx` | Fim do "sempre 100%" em produção. A contagem roda só para as evoluções devolvidas (`e.id IN (<mesma consulta com LIMIT>)`) |
| `GET /api/gestor/pacientes` aceita `X-Gestorcoop-Cache: permitido` e então usa a **mesma** lista memoizada da listagem (mesma chave, TTL e invalidação). O modal de admissão manda o cabeçalho; os demais clientes (tela de equipamentos, romaneio) seguem lendo direto | `api/gestor/pacientes/route.ts`, `cache-memoria.ts` (TTL compartilhado) | O modal abre sem paginar o Bubble de novo. Não foi ligado por padrão porque a tela de equipamentos faz POST e relê a lista logo em seguida; com a invalidação valendo só no isolate da escrita, o paciente novo poderia sumir por até 60 s |
| Detalhe: guarda contra **resposta atrasada** — `AbortController` para `/equipamentos` (abortado ao trocar de paciente/desmontar) e checagem do paciente atual após cada `await` da carga principal; equipamentos zerados ao trocar de paciente; `setLoading(false)` só pela carga vigente | `gestor/prontuarios/[id]/prontuario-detalhe.tsx` | Equipamentos/dados do paciente A não sobrescrevem o paciente B |
| Listagem: só a última requisição de evoluções vale (trocas rápidas de especialidade); `garantirBasesAuxiliares` **tenta de novo** na próxima abertura do modal se a base do Bubble falhou ou se os cooperados caíram nos dados de exemplo | `gestor/prontuarios/page.tsx` | — |

## 3.2 Fase 2 — Sessão, Auditoria e Cache de Navegação (implementadas)

| Mudança | Arquivo | Efeito |
|---|---|---|
| **Cache de sessão no Edge/Middleware**: validação de sessão ativa no D1 memoizada por isolate (TTL 30s) em `cache-memoria.ts` e consumida em `validarSessaoAtiva` / `validarSessao` / `obterSessao`. Invalidada no logout (`/api/auth/logout`) e com revogação no D1 | `src/lib/cache-memoria.ts`, `src/lib/sessao.ts`, `api/auth/logout/route.ts` | Elimina **1 round-trip extra ao D1** em cada requisição autenticada de API. Sessões revogadas ou expiradas não mantêm cache positivo |
| **Reconciliação e Auditoria de Medicamentos com D1**: nova consulta agregada `listarAprazamentosParaAuditoria()` via `aprazamentos JOIN prescricoes LEFT JOIN pacientes` em **1 round trip** no D1, com cálculo preciso de desvios regulamentares (`Conforme`, `Atraso`, `Omissao_Com_Justificativa`, `Pendente_Atrasado`) e resolução do responsável técnico. Aprazamentos pendentes dentro da janela programada são devidamente identificados como pendentes (sem falso rótulo de "administrado") | `src/lib/db/prontuarios.ts`, `api/gestor/prontuarios/auditoria/route.ts`, `gestor/prontuarios/auditoria/page.tsx` | Corrige o problema da tela `/gestor/prontuarios/auditoria` ficar vazia em produção com D1. Preserva paridade com in-memory, evita descarte de registros via `LEFT JOIN` e suporta filtros de data ISO, status e paciente |
| **Cache de Navegação / Stale-While-Revalidate na Listagem**: módulo `cache-navegacao.ts` (`sessionStorage` + memória transitória) com SWR na listagem de prontuários. Ao voltar do prontuário 360° para a listagem, os dados aparecem instantaneamente sem exibir skeletons de loading; a revalidação ocorre em segundo plano se o cache estiver além de 45s. Invalidação automática por chave e prefixo ao admitir paciente, cadastrar prescrição, registrar sinais vitais, atualizar cota ou salvar plano | `src/lib/cache-navegacao.ts`, `gestor/prontuarios/page.tsx`, `gestor/prontuarios/[id]/prontuario-detalhe.tsx`, `gestor/prontuarios/[id]/plano-terapeutico-tab.tsx` | Fim das recargas completas e telas em branco ao navegar entre prontuários e a listagem. Invalidação imediata em mutações clínicas no prontuário |

Validação dos testes da Fase 2:
- **Testes Unitários & RPC D1**: `npm run test:prontuarios` (23 testes passando com 100% de sucesso, incluindo novos testes de cache de sessão, auditoria agregada com verificação semântica de doses pendentes e navegação SWR com invalidação por prefixo).
- **Typecheck estrito**: `npx tsc --noEmit` com 0 erros em todo o repositório.
- **Testes End-to-End**: Playwright validado com 100% de aprovação cobrindo as suites de auditoria, prontuário 360°, jornada integrada cooperado->gestor (`fluxo-completo-cooperado-para-gestor.spec.ts`), shell do gestor, tutorial em vídeo (`gravar-tutorial-video.spec.ts`) e admissão.

## 3.3 Fase 2.1 e Fase 3 — Sincronização Bubble -> D1 e Paginação Escalável (implementadas)

| Mudança | Arquivo | Efeito |
|---|---|---|
| **Sincronização em segundo plano Bubble -> D1**: módulo `sync-pacientes.ts` que busca pacientes do Bubble e faz upsert em lote (chunks de 50 instruções no `db.batch`) na tabela `pacientes` do D1. Em conflito de ID, atualiza dados cadastrais básicos sem jamais sobrescrever dados clínicos enriquecidos no D1 (`diagnostico_principal`, `complexidade`, `plano_saude`, `numero_carteirinha`, `limite_visitas_mes`, `status`). Invalida caches após o sync | `src/lib/sync-pacientes.ts` | Base de pacientes replicada continuamente no D1 de forma não destrutiva |
| **Rota de Cron `/api/cron/sync-pacientes-bubble`**: endpoint de cron autenticado por `CRON_SECRET` (`Authorization: Bearer <CRON_SECRET>`), integrado ao `cron-worker` (`gestorcoop-cron`) para execução periódica automatizada | `api/cron/sync-pacientes-bubble/route.ts`, `cron-worker/src/index.js`, `cron-worker/README.md` | Sincronização automática e agendada pelo Cloudflare Workers |
| **Consulta Direta do D1 (Fim da Paginação Síncrona do Bubble)**: `GET /api/gestor/prontuarios/pacientes` passa a ler exclusivamente do D1 em batch único agregado. Se a base do D1 estiver vazia no primeiro acesso, aciona fallback para sync inicial e releitura | `api/gestor/prontuarios/pacientes/route.ts` | **Elimina a paginação síncrona do Bubble do caminho das requisições do usuário**. Reduz tempo de abertura e independe da disponibilidade/latência da Data API do Bubble |
| **Contagem Otimizada de Prescrições Ativas**: a query global com `GROUP BY` sobre a tabela inteira foi substituída por subconsulta correlacionada indexada por paciente (`(SELECT COUNT(*) FROM prescricoes pr WHERE pr.paciente_id = pac.id AND pr.status = 'Ativa')`) guiada pelo covering index composto `idx_prescricoes_paciente_status (paciente_id, status)` | `src/lib/db/prontuarios.ts`, `migrations/0010_otimizacao_prescricoes_pacientes.sql` | `rows_read` não varre a tabela inteira de prescrições: seek direto no covering index, proporcional estritamente aos pacientes da página |
| **Paginação e Busca Escalável no D1**: `listarPacientesComResumoClinico` aceita `page`, `limit` e `busca`. Todas as 8 subconsultas do batch são estritamente delimitadas aos IDs da página (`WHERE pac.id IN (SELECT pac_sub.id FROM pacientes pac_sub ... LIMIT ? OFFSET ?)`). Retorna metadados de paginação (`total`, `page`, `limit`, `totalPages`) em 1 ida única ao D1 | `src/lib/db/prontuarios.ts`, `api/gestor/prontuarios/pacientes/route.ts` | Escala mesmo com milhares de pacientes: o volume de dados clínicos processados por batch é constante e limitado à página solicitada |
| **Paginação na Interface da Lista**: a grade de cards em `gestor/prontuarios/page.tsx` fatiada em páginas de 12 itens com barra de paginação e navegação ("Mostrando X a Y de N pacientes", botões Anterior/Próxima e indicador de página), com reset automático ao alterar busca ou filtro de complexidade | `gestor/prontuarios/page.tsx` | DOM enxuto, rolagem e renderização a 60fps independente do tamanho total da base de pacientes |
| **Revisão da Agenda do Cooperado e Criação de Pacientes**: `api/cooperado/agenda` utiliza leitura memoizada para evitar varredura síncrona repetida do Bubble; `POST /api/gestor/pacientes` replica imediatamente novo paciente criado para o D1 | `api/cooperado/agenda/route.ts`, `api/gestor/pacientes/route.ts` | Elimina gargalos residuais de chamadas síncronas ao Bubble |
| **Migration `0010_otimizacao_prescricoes_pacientes.sql`**: índices `idx_prescricoes_paciente_status` e `idx_pacientes_nome` aplicados no D1 local e remoto | `migrations/0010_otimizacao_prescricoes_pacientes.sql` | — |

**Status da migration 0010**:
A migration `0010_otimizacao_prescricoes_pacientes.sql` foi aplicada com sucesso no banco remoto Cloudflare D1 (`gestorcoop-db`):
```bash
npx wrangler d1 migrations apply gestorcoop-db --remote
```

Validação dos testes da Fase 3:
- **Testes Unitários & RPC D1**: `npm run test:prontuarios` (**32 testes passando com 100% de sucesso**, incluindo testes de replicação do Bubble em lote preservando dados locais no D1 e na memória sem D1, proteção contra nomes vazios do Bubble sobrescreverem cadastros locais, sanitização de parâmetros inválidos de paginação, ordenação determinística com tiebreaker `id ASC`, paginação escalável via batch único, busca textual combinada, uso do covering index de prescrições ativas e autorização da rota de cron).
- **Typecheck estrito**: `npx tsc --noEmit` limpo com 0 erros em todo o repositório.
- **Testes End-to-End**: Playwright validado com 100% de aprovação cobrindo as suites de prontuários (`prontuarios-e2e-completo.spec.ts`, `gestor-prontuarios-360.spec.ts`, `prontuario-360-agregado.spec.ts`, `admissao-paciente-bubble-plano-dinamico.spec.ts`, `plano-terapeutico-real-paciente.spec.ts`, `gestor-shell.spec.ts`, `fluxo-completo-cooperado-para-gestor.spec.ts`, `equipamentos.spec.ts`).

## 4. Próximas fases (remanescentes)

- **D1 read replication (Sessions API)** e **Smart Placement** do Pages, para aproximar leitura/execução da região primária do banco.

## 5. Riscos conhecidos

- A replicação periódica Bubble -> D1 via cron roda no intervalo configurado; um paciente criado diretamente no Bubble por fora do sistema ficará visível na listagem D1 assim que o cron disparar (ou na admissão clínica manual).
- A invalidação do cache de navegação ocorre na escrita clínica pelo painel; em multi-abas no mesmo navegador, o `sessionStorage` é isolado por aba.
- Planos de execução (seek por índice composto, subconsultas indexadas) foram validados no SQLite 3.47 local e no D1 remoto.

