# Volume 00 — Guia Mestre de Handover: Enciclopédia de Regras de Negócio, Glossário do Domínio e Mapa Completo de Arquivos

> **Propósito deste Volume**: Ser o ponto de partida definitivo para qualquer desenvolvedor ou arquiteto que assumir o repositório **GestorCoop**. Este documento consolida **todas as regras de negócio de ponta a ponta** dos 4 grandes domínios do sistema (Adesão/Cooperados, Prontuário Clínico Offline-First & 360°, Equipamentos/Locações Home Care e Financeiro), explica a arquitetura híbrida **Cloudflare Edge + D1 + Bubble.io** e fornece o **Mapa Completo de Todos os Arquivos do Repositório** com links diretos para o código e para os volumes específicos desta documentação.

---

## 1. Visão Geral Executiva do Sistema GestorCoop

O **GestorCoop** é a plataforma operacional central de gestão de cooperativas de saúde e assistência domiciliar (*Home Care*), operando sobre a infraestrutura **Cloudflare Pages + Edge Workers + Cloudflare D1 (SQLite Distribuído) + Cloudflare Workers AI**, integrada em tempo real ao ERP legado da cooperativa no **Bubble.io** (via Data API REST) e ao **ZapSign** (assinatura eletrônica de Termos de Adesão).

### 1.1. Os 4 Subdomínios em Produção (`wrangler.toml` + `middleware.ts`)

Um único deploy Next.js 14 (`@cloudflare/next-on-pages`) serve **4 experiências distintas** roteadas dinamicamente pelo `Host` no [`middleware.ts`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/src/middleware.ts) e [`subdominios.ts`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/src/lib/subdominios.ts):

| Subdomínio / Host | Área Interna (`AreaHost`) | Público-Alvo | Rotas Principais |
| :--- | :--- | :--- | :--- |
| **`gestorcoop.app`** | `portal` | Público geral / Entrada unificada | `/` (Seletor de área), `/entrar`, `/login` |
| **`gestao.gestorcoop.app`** | `gestao` | Gestores, Auditores, Logística, Manutenção e Financeiro | `/gestor/dashboard`, `/gestor/prontuarios`, `/gestor/equipamentos`, `/gestor/manutencao`, `/gestor/baixas`, `/gestor/financeiro`, `/gestor/termos` |
| **`cooperado.gestorcoop.app`** | `cooperado` | Enfermeiros, Técnicos, Médicos e Terapeutas em campo | `/cooperado` (Agenda/Plantões), `/cooperado/prontuario/[id]` (Beira-Leito Offline-First) |
| **`cooperacao.gestorcoop.app`** | `cooperacao` | Candidatos a novos cooperados | `/adesao` e `/cooperado/adesao` (Funil de cadastro, documentos e assinatura ZapSign) |

---

## 2. Enciclopédia Completa de Regras de Negócio (Por Domínio)

### 2.1. Domínio 1: Adesão de Cooperados, Documentação e Assinatura Digital (ZapSign)

1. **Identificação por CPF (`verificar-cpf` + `cpf.ts`)**:
   - Todo CPF é higienizado (apenas 11 dígitos) e validado matematicamente pelos dígitos verificadores (módulo 11) antes de qualquer consulta no Bubble.
   - Se o CPF já existir no Data Type `User` do Bubble, o sistema hidrata os dados existentes do candidato para retomada do funil de adesão em vez de duplicar o registro.
2. **Classificação Profissional e Exigência de Conselho (`profissoes.ts` + `validacao-conselho.ts`)**:
   - Cada função/profissão do Option Set do Bubble é mapeada para uma categoria regulatória:
     - **Saúde com Conselho Obrigatório**: Enfermeiro (`COREN`), Técnico/Auxiliar de Enfermagem (`COREN`), Médico (`CRM`), Fisioterapeuta (`CREFITO`), Fonoaudiólogo (`CREFONO`), Nutricionista (`CRN`), Psicólogo (`CRP`), Farmacêutico (`CRF`), Odontólogo (`CRO`), Assistente Social (`CRESS`), Terapeuta Ocupacional (`CREFITO`).
     - **Profissões sem Conselho / Administrativas / Apoio**: Cuidador, Acompanhante, Motorista, Administrativo — isentos de número/UF de conselho e de certidão de regularidade do conselho.
   - A validação de conselho (`validar-conselho`) verifica formato do registro por UF/Conselho e bloqueia avanço se o profissional de saúde regulamentado não informar número e UF válidos.
3. **Matriz de Documentos Obrigatórios vs. Opcionais (`documentos.ts`)**:
   - O sistema exige envio de documentos pessoais, comprovante de residência, dados bancários/PIX, certificados acadêmicos e carteira/certidão do conselho de classe (quando aplicável à profissão).
   - Cada documento no Bubble (`Documentos`) possui status auditável pelo gestor: `Pendente`, `Aprovado` ou `Reprovado` (com motivo de reprovação).
4. **Aprovação pelo Gestor e Geração do Termo de Adesão (`gerar-termo` + `termo-template.ts` + `zapsign.ts`)**:
   - O gestor analisa os documentos no painel (`/gestor/dashboard` → `ModalDocumentosCooperado.tsx`).
   - Ao aprovar ou acionar a geração do Termo de Adesão, o sistema gera um PDF dinâmico (`jspdf` em `termo-template.ts`) preenchido com os dados cadastrais, endereço, quotas-partes e dados da empresa contratante (`empresas-contratantes.ts`), e envia para a API da **ZapSign** (`zapsign.ts`).
5. **Webhook de Assinatura Concluída (`/api/webhooks/zapsign`)**:
   - Quando o cooperado assina eletronicamente no link da ZapSign, o webhook recebe o evento `doc_signed`, valida o token do documento e atualiza o status do cooperado e do termo no Bubble para assinado/ativo.

---

### 2.2. Domínio 2: Prontuário Clínico Beira-Leito (Cooperado) & Prontuário 360° (Gestor)

1. **Segurança em Iframe / Safari iOS e Sessão Híbrida (`auth-embed.ts` + `sessao-cooperado.ts`)**:
   - Como o módulo de prontuários pode ser aberto tanto diretamente via subdomínio quanto embutido em `<iframe>` dentro do Bubble, o Safari/iOS bloqueia cookies *third-party* (ITP).
   - **Regra de Solução**: O endpoint `/api/auth/embed` valida a assinatura HMAC-SHA256 gerada pelo Bubble (`EMBED_SHARED_SECRET`), grava um ticket de uso único de 60 segundos na tabela `auth_embed_tickets` (D1) e redireciona com `?ticket=...`. O cliente troca o ticket em `/api/auth/embed/exchange` por um JWT HS256, salvando-o simultaneamente em Cookie (`HttpOnly`) e no `sessionStorage` do navegador, enviando-o no header `X-Cooperado-Session` em todas as chamadas via `client-fetch.ts`.
2. **Separação Estrita de Perfis Clínicos (`tipos-clinicos.ts`)**:
   - **Enfermagem de Plantão (`Tecnico_Enfermagem` / Plantonista 12h ou 24h)**:
     - Vê e executa a **Grade de Aprazamento de Medicamentos** do turno (`Diurno`, `Noturno` ou `24h`).
     - Registra **Sinais Vitais** seriados ao longo do plantão.
     - É **proibido de realizar Check-out** se houver qualquer aprazamento do seu turno com status `Pendente` (precisa marcar como `Administrado` ou justificar `Nao_Administrado`).
     - Na finalização do plantão, exige a validação/identificação do **Familiar/Responsável no domicílio** (`0011_responsaveis_plantao.sql`) e captura de **Validação Facial** (`validacao-facial-modal.tsx`).
   - **Equipe Multiprofissional / Visitantes (`Medico`, `Terapeuta` — Fisioterapeuta, Fonoaudiólogo, Nutricionista, Psicólogo, Enfermeiro Supervisor)**:
     - Realiza atendimentos por **Visita/Sessão** (sem grade de aprazamento de medicamentos de rotina da enfermagem).
     - Preenche evolução estruturada no padrão **SOAP** (`Subjetivo`, `Objetivo`, `Avaliacao`, `Plano`) + Sinais Vitais opcionais/contextuais.
3. **Plano Terapêutico Dinâmico, Versionado e Bloqueio Rígido de Cotas (`0008` + `0012` + `prontuarios.ts`)**:
   - Cada paciente possui um **Plano Terapêutico** com vigência (`data_inicio` a `data_fim`), `versao` incremental (`0012_versionamento_planos_terapeuticos.sql`) e metas por especialidade (`plano_terapeutico_metas`).
   - Cada meta define `especialidade`, `quantidade_prevista` (cota de visitas no ciclo) e `profissionais_designados` (array JSON de cooperados autorizados a compartilhar aquela cota).
   - **Regra de Bloqueio HTTP 403**: Quando a soma de evoluções realizadas na vigência para aquela especialidade atinge `quantidade_prevista`, qualquer tentativa de iniciar nova evolução para aquela especialidade é bloqueada com erro `403 Forbidden` (Cota atingida), sem afetar as demais especialidades do mesmo paciente.
   - **Renovação e Versionamento**: Ao renovar ou editar estruturalmente o ciclo de um plano, o plano anterior é preservado no histórico (`status = 'Encerrado'` ou versão anterior) e uma nova `versao` (`versao + 1`) é criada, mantendo rastreabilidade histórica completa.
4. **Transcrição Clínica por Voz em Cascata e Cota Diária de IA (`ia/provedores.ts` + `ia/limites.ts` + `0006_cota_transcricao.sql`)**:
   - O cooperado pode ditar a evolução clínica pelo microfone do celular (`audio-recorder.ts`).
   - **Cota Anti-Abuso (`limites.ts`)**: Antes de chamar a IA, o sistema verifica na tabela `uso_transcricao` se o cooperado não excedeu os limites diários (ex: máximo de minutos estimados por dia/requisições por dia e tamanho máximo do arquivo de áudio), calculando a duração a partir dos `bytes` reais do áudio (nunca confiando apenas no metadado do cliente).
   - **Cascata Resiliente (`provedores.ts`)**: O áudio percorre uma fila ordenada configurável via `IA_ORDEM_TRANSCRICAO` (padrão: `openai,groq,workersai`). Em cada provedor:
     1. Transcreve o áudio bruto (`whisper-1` na OpenAI, `whisper-large-v3-turbo` na Groq ou `@cf/openai/whisper-large-v3-turbo` no Cloudflare Workers AI).
     2. Pós-processa a transcrição com LLM (`gpt-4o-mini`, `llama-3.3-70b-versatile` ou `@cf/meta/llama-3.1-8b-instruct`) usando prompt clínico que corrige termos médicos e extrai automaticamente os 4 campos **SOAP** em JSON sem inventar dados clínicos.
5. **Assinatura Eletrônica HMAC-SHA256 e Imutabilidade por Trigger SQL (`0003` + `0005`)**:
   - Ao finalizar a evolução com seu PIN, o sistema gera um selo criptográfico `v1:<cooperadoId>:<timestamp>:<hmac_sha256>` sobre os dados da evolução (`gerarSeloAssinatura` em `sessao-cooperado.ts`).
   - **Trigger SQL de Imutabilidade (`0005_prontuario_persistente.sql`)**: O banco D1 possui a trigger `evolucao_finalizada_imutavel` (`BEFORE UPDATE ON evolucoes WHEN OLD.status = 'Finalizado'`) que aborta com `RAISE(ABORT, 'Evolucao finalizada nao pode ser alterada')` qualquer tentativa de modificar uma evolução já assinada e finalizada!
6. **Motor Offline-First e Idempotência de Sincronização (`indexeddb.ts` + `sync-service.ts` + `clinical_sync_receipts`)**:
   - Em domicílios sem sinal de internet (zona rural ou subsolo), todas as ações do cooperado (`CHECK_IN`, `CHECAR_APRAZAMENTO`, `REGISTRAR_SINAIS_VITAIS`, `SALVAR_EVOLUCAO`, `ASSINAR_CHECKOUT`) são gravadas imediatamente no **IndexedDB** local (`gestorcoop_clinical_db`, stores `syncQueue`, `drafts`, `shiftsCache`).
   - Quando a conexão retorna (evento `online` ou polling de reconexão), o `sync-service.ts` envia o lote para `/api/cooperado/sync`.
   - O servidor grava um recibo criptográfico na tabela `clinical_sync_receipts (user_id, action_id, payload_hash)` garantindo **idempotência estrita**: se o celular reenviar a mesma ação por falha de rede, o servidor reconhece o `action_id` e retorna sucesso sem duplicar sinais vitais ou evoluções.

---

### 2.3. Domínio 3: Gestão de Equipamentos Hospitalares, Locações, Manutenção e Baixas

1. **Arquitetura Híbrida de Ativos (Próprios vs. Terceiros — `0002_equipamentos.sql` + `terceiros.ts`)**:
   - **Equipamentos Próprios (`origem = 'Proprio'`)**: Pertencem ao patrimônio da cooperativa. Possuem número de patrimônio, valor de aquisição e depreciação/ROI calculados.
   - **Equipamentos Sublocados de Terceiros (`origem = 'Terceiro'`)**: Pertencem a um fornecedor externo (`proprietarios` / `contratos_terceiro`). O banco exige via `CHECK constraint` (`0002_equipamentos.sql`, linhas 83–85) que todo equipamento de terceiro tenha obrigatoriamente `proprietario_id`, `custo_mensal_terceiro` e `data_entrada_terceiro`.
   - **Regra de Sigilo Comercial**: O campo `custo_mensal_terceiro` (quanto a cooperativa paga ao fornecedor) **jamais** é exibido em Romaneios de Entrega ou Demonstrativos enviados ao cliente final.
   - **Unicidade de Número de Série**: O índice único parcial `idx_equip_serie` impede cadastrar dois equipamentos com o mesmo `numero_serie` não vazio, evitando cobrança duplicada em faturas de terceiros. Quando o item físico não tem serial de fábrica, o sistema gera um serial padronizado único (`equipamentos-helpers.ts`).
2. **Máquina de Estados Estrita (`equipamentos-estados.ts`)**:
   - Nenhum equipamento muda de status por edição livre. Os estados (`Aguardando conferência`, `Disponível`, `Reservado`, `Em transporte para implantação`, `Implantado no domicílio`, `Em transporte para recolhimento`, `Recolhido e aguardando conferência`, `Aguardando higienização`, `Em higienização`, `Manutenção`, `Aguardando peça`, `Liberado pela manutenção`, `Bloqueado`, `Extraviado`, `Condenado`, `Baixado`) seguem um grafo direcionado validado em código.
   - **Regra Sanitária Obrigatória**: Um equipamento recolhido do domicílio de um paciente **nunca** volta direto para `Disponível`; ele passa obrigatoriamente por `Recolhido e aguardando conferência` → `Aguardando higienização` → `Em higienização` → `Disponível` (ou `Manutenção` se reprovado na conferência).
3. **Reservas com Expiração Automática (`reservas` + `/api/cron/reservas-expirar`)**:
   - Um equipamento `Disponível` pode ser `Reservado` para um cliente com data limite (`expira_em`).
   - O Cron Worker (`cron-worker/src/index.js`) aciona periodicamente `/api/cron/reservas-expirar`, que identifica reservas vencidas não convertidas em locação, marca a reserva como expirada, devolve o equipamento para `Disponível` e grava um evento de auditoria.
4. **Cálculo Financeiro Pró-Rata e Suspensões de Locação (`equipamentos-financeiro.ts`)**:
   - O faturamento mensal de uma locação calcula os **dias faturáveis reais** dentro da competência (`YYYY-MM`), descontando:
     - Dias anteriores à `data_inicio` da locação;
     - Dias posteriores à `data_fim_real` (recolhimento);
     - Dias cobertos por **Suspensões de Locação** ativas (ex.: paciente internado em hospital onde a cobrança do equipamento domiciliar fica suspensa temporariamente).
   - O valor pró-rata diário é `valor_mensal / dias_no_mes_calendario` multiplicado pelos dias efetivamente faturáveis.
5. **Rentabilidade / ROI por Equipamento (`[id]/rentabilidade`)**:
   - Cruza toda a receita bruta gerada pelas locações daquele equipamento contra o somatório de custos (valor de aquisição ou aluguéis pagos a terceiros + custos de peças e mão de obra de todas as Ordens de Serviço de manutenção em `[id]/manutencoes`), determinando o *payback* e a margem líquida do ativo.
6. **Segregação de Funções na Baixa Patrimonial (`[id]/baixas/**`)**:
   - Quando um equipamento sofre perda total, obsolescência ou custo de reparo antieconômico (podendo vir de uma recomendação técnica na OS via `recomendar-baixa`), abre-se uma solicitação de **Baixa Patrimonial**.
   - **Regra de Governança**: A baixa exige aprovação formal (`aprovar` ou `reprovar`) por perfil gestor/administrador, podendo ser revertida (`reverter`) mediante justificativa auditada.

---

## 3. Mapa Completo de Todos os Arquivos do Repositório (`200+` Arquivos)

Use a tabela abaixo para localizar qualquer arquivo do projeto e saber exatamente em qual volume de `docs/manual-handover/` sua análise linha a linha se encontra:

### 3.1. Raiz, Configuração, Infraestrutura e CI/CD

| Arquivo no Repositório | Papel no Sistema | Volume da Documentação |
| :--- | :--- | :--- |
| [`.github/workflows/ci.yml`](file:///c:/Users/admin/Documents/projetos/gestorcoop/.github/workflows/ci.yml) | Pipeline CI/CD com os 4 Gates obrigatórios no Self-Hosted Runner da VPS Oracle (`Guards`, `Lint/Test/Build`, `Migrações D1 do zero`, `Gitleaks`). | [Volume 01](./01-arquitetura-infra-cicd-e-setup.md) |
| [`AGENTS.md`](file:///c:/Users/admin/Documents/projetos/gestorcoop/AGENTS.md) | Regras de engenharia, fluxo `homolog → main` e orquestração multi-agente. | [Volume 09](./09-design-system-ux-e-documentos-historicos.md) |
| [`PRODUCT.md`](file:///c:/Users/admin/Documents/projetos/gestorcoop/PRODUCT.md) | Posicionamento estratégico, personas e princípios de produto. | [Volume 09](./09-design-system-ux-e-documentos-historicos.md) |
| [`DESIGN.md`](file:///c:/Users/admin/Documents/projetos/gestorcoop/DESIGN.md) | Especificação visual "The Operational Control Room". | [Volume 09](./09-design-system-ux-e-documentos-historicos.md) |
| [`cron-worker/wrangler.toml`](file:///c:/Users/admin/Documents/projetos/gestorcoop/cron-worker/wrangler.toml) | Configuração do Cloudflare Worker agendado (Cron Triggers). | [Volume 01](./01-arquitetura-infra-cicd-e-setup.md) |
| [`cron-worker/src/index.js`](file:///c:/Users/admin/Documents/projetos/gestorcoop/cron-worker/src/index.js) | Código do Worker que dispara geração de alertas, expiração de reservas e sync de pacientes. | [Volume 01](./01-arquitetura-infra-cicd-e-setup.md) |
| [`temp-app/wrangler.toml`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/wrangler.toml) | Configuração Cloudflare Pages, domínios customizados, binding `DB` (D1) e `AI` (Workers AI). | [Volume 01](./01-arquitetura-infra-cicd-e-setup.md) |
| [`temp-app/package.json`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/package.json) | Dependências NPM e scripts de desenvolvimento, build, auditoria e testes. | [Volume 01](./01-arquitetura-infra-cicd-e-setup.md) |
| [`temp-app/next.config.mjs`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/next.config.mjs) | Inicialização do `setupDevPlatform()` para emular Cloudflare D1 localmente no `next dev`. | [Volume 09](./09-design-system-ux-e-documentos-historicos.md) |
| [`temp-app/tailwind.config.ts`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/tailwind.config.ts) | Mapeamento dos tokens semânticos CSS (`--c-*`) para classes utilitárias Tailwind. | [Volume 09](./09-design-system-ux-e-documentos-historicos.md) |
| [`temp-app/playwright.config.ts`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/playwright.config.ts) | Configuração de testes E2E com Chromium, fake media stream (microfone/câmera) e D1 local. | [Volume 09](./09-design-system-ux-e-documentos-historicos.md) |

---

### 3.2. Migrações SQL do Banco de Dados Cloudflare D1 (`temp-app/migrations/`)

| Arquivo de Migração | O que cria / altera no Banco D1 | Volume da Documentação |
| :--- | :--- | :--- |
| [`0001_init_prontuario.sql`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/migrations/0001_init_prontuario.sql) | Cria as 4 tabelas fundamentais do prontuário: `pacientes`, `prescricoes`, `aprazamentos` e `evolucoes`. | [Volume 02](./02-banco-de-dados-d1-e-migracoes.md) |
| [`0002_equipamentos.sql`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/migrations/0002_equipamentos.sql) | Cria a estrutura de equipamentos e terceiros no D1: `proprietarios`, `contratos_terceiro`, `equipamentos` (com `CHECK` de terceiros e `UNIQUE` parcial de série), `domicilios`, `locacoes` e `movimentacoes` (com `chave_idempotencia`). | [Volume 02](./02-banco-de-dados-d1-e-migracoes.md) |
| [`0003_assinatura_evolucao.sql`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/migrations/0003_assinatura_evolucao.sql) | Adiciona `assinatura_digital TEXT` em `evolucoes` para armazenar o selo HMAC-SHA256 `v1:<cooperadoId>:<instante>:<hex>`. | [Volume 02](./02-banco-de-dados-d1-e-migracoes.md) |
| [`0004_prontuario_completo.sql`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/migrations/0004_prontuario_completo.sql) | Cria `sinais_vitais`, `pareceres_auditoria` e os 4 índices clínicos principais. | [Volume 02](./02-banco-de-dados-d1-e-migracoes.md) |
| [`0005_prontuario_persistente.sql`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/migrations/0005_prontuario_persistente.sql) | Expande `pacientes` (diagnóstico, CID-10, complexidade, convênio), `prescricoes` (médico, CRM, horários) e `evolucoes` (campos SOAP); cria `auth_embed_tickets`, `auth_sessions`, `clinical_sync_receipts` e a trigger `evolucao_finalizada_imutavel`. | [Volume 02](./02-banco-de-dados-d1-e-migracoes.md) |
| [`0006_cota_transcricao.sql`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/migrations/0006_cota_transcricao.sql) | Cria `uso_transcricao` e índices por cooperado/dia para controle de cota e auditoria de consumo de IA (Whisper/LLM). | [Volume 02](./02-banco-de-dados-d1-e-migracoes.md) |
| [`0007_limite_visitas_paciente.sql`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/migrations/0007_limite_visitas_paciente.sql) | Adiciona `limite_visitas_mes` em `pacientes` e índice `idx_evolucoes_paciente_checkin`. | [Volume 02](./02-banco-de-dados-d1-e-migracoes.md) |
| [`0008_planos_terapeuticos.sql`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/migrations/0008_planos_terapeuticos.sql) | Cria `planos_terapeuticos` e `plano_terapeutico_metas` para cotas multiprofissionais por vigência e cooperados designados. | [Volume 02](./02-banco-de-dados-d1-e-migracoes.md) |
| [`0009_indices_consultas_agregadas.sql`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/migrations/0009_indices_consultas_agregadas.sql) | Cria `idx_pareceres_paciente_data`, `idx_evolucoes_check_in` e `idx_planos_status_vigencia` para eliminar full table scans no painel 360°. | [Volume 02](./02-banco-de-dados-d1-e-migracoes.md) |
| [`0010_otimizacao_prescricoes_pacientes.sql`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/migrations/0010_otimizacao_prescricoes_pacientes.sql) | Cria `idx_prescricoes_paciente_status` e `idx_pacientes_nome` (`COLLATE NOCASE`). | [Volume 02](./02-banco-de-dados-d1-e-migracoes.md) |
| [`0011_responsaveis_plantao.sql`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/migrations/0011_responsaveis_plantao.sql) | Adiciona `responsaveis_json` em `pacientes` e `responsavel_id`, `responsavel_nome`, `responsavel_parentesco` em `evolucoes`. | [Volume 02](./02-banco-de-dados-d1-e-migracoes.md) |
| [`0012_versionamento_planos_terapeuticos.sql`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/migrations/0012_versionamento_planos_terapeuticos.sql) | Adiciona `versao INTEGER NOT NULL DEFAULT 1` em `planos_terapeuticos` e índice `idx_planos_paciente_versao`. | [Volume 02](./02-banco-de-dados-d1-e-migracoes.md) |

---

### 3.3. Camada de Bibliotecas e Regras de Domínio (`temp-app/src/lib/`)

| Arquivo | Responsabilidade Principal | Volume da Documentação |
| :--- | :--- | :--- |
| [`src/middleware.ts`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/src/middleware.ts) | Interceptação Edge, roteamento por subdomínio, proteção de rotas `/gestor` e `/cooperado` e headers de segurança. | [Volume 01](./01-arquitetura-infra-cicd-e-setup.md) |
| [`src/lib/subdominios.ts`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/src/lib/subdominios.ts) | Resolução de `Host` para área (`portal`, `gestao`, `cooperado`, `cooperacao`) e reescrita de URLs. | [Volume 01](./01-arquitetura-infra-cicd-e-setup.md) |
| [`src/lib/sessao-token.ts`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/src/lib/sessao-token.ts) | Assinatura e verificação criptográfica de tokens JWT HS256 via `jose`. | [Volume 01](./01-arquitetura-infra-cicd-e-setup.md) |
| [`src/lib/sessao.ts`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/src/lib/sessao.ts) | Gestão de sessão de Gestores e Administradores (cookies e permissões RBAC). | [Volume 01](./01-arquitetura-infra-cicd-e-setup.md) |
| [`src/lib/sessao-cooperado.ts`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/src/lib/sessao-cooperado.ts) | Gestão de sessão do Cooperado (Cookie + `X-Cooperado-Session`) e geração/verificação do selo de assinatura clínica HMAC-SHA256. | [Volume 01](./01-arquitetura-infra-cicd-e-setup.md) |
| [`src/lib/auth-embed.ts`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/src/lib/auth-embed.ts) | Validação de URLs assinadas por HMAC vindas do Bubble e troca por tickets efêmeros no D1. | [Volume 01](./01-arquitetura-infra-cicd-e-setup.md) |
| [`src/lib/tema.ts`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/src/lib/tema.ts) | Persistência e alternância do tema visual (`claro` / `escuro`) sincronizado com `data-theme`. | [Volume 01](./01-arquitetura-infra-cicd-e-setup.md) |
| [`src/lib/db/client.ts`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/src/lib/db/client.ts) | Resolução do binding `DB` (Cloudflare D1) via `getRequestContext()` no Edge Runtime. | [Volume 02](./02-banco-de-dados-d1-e-migracoes.md) |
| [`src/lib/db/prontuarios.ts`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/src/lib/db/prontuarios.ts) | Repositório completo SQL D1 de Pacientes, Prescrições, Aprazamentos, Sinais Vitais, Evoluções, Pareceres e Planos Terapêuticos Versionados. | [Volume 02](./02-banco-de-dados-d1-e-migracoes.md) |
| [`src/lib/db/equipamentos.ts`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/src/lib/db/equipamentos.ts) | Repositório SQL D1 de Eventos de Equipamentos, OS de Manutenção, Conferências, Higienizações, Reservas, Suspensões, Baixas e Alertas. | [Volume 02](./02-banco-de-dados-d1-e-migracoes.md) |
| [`src/lib/db/terceiros.ts`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/src/lib/db/terceiros.ts) | Repositório SQL D1 de Proprietários, Contratos de Terceiros e Equipamentos Sublocados. | [Volume 02](./02-banco-de-dados-d1-e-migracoes.md) |
| [`src/lib/bubble.ts`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/src/lib/bubble.ts) | Cliente oficial da Data API do Bubble.io (CRUD tipado, paginação automática, filtros e mapeamento de entidades). | [Volume 03](./03-integracoes-bubble-zapsign-e-ia.md) |
| [`src/lib/zapsign.ts`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/src/lib/zapsign.ts) | Cliente de integração com a API da ZapSign para criação e consulta de documentos assináveis. | [Volume 03](./03-integracoes-bubble-zapsign-e-ia.md) |
| [`src/lib/termo-template.ts`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/src/lib/termo-template.ts) | Gerador de PDF (`jspdf`) do Termo de Adesão e Cooperação com layout oficial da cooperativa. | [Volume 03](./03-integracoes-bubble-zapsign-e-ia.md) |
| [`src/lib/ia/provedores.ts`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/src/lib/ia/provedores.ts) | Motor de cascata de IA (OpenAI, Groq, Cloudflare Workers AI) para transcrição de áudio e estruturação SOAP. | [Volume 03](./03-integracoes-bubble-zapsign-e-ia.md) |
| [`src/lib/ia/limites.ts`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/src/lib/ia/limites.ts) | Controle de cota diária de transcrição por cooperado no D1 (`uso_transcricao`). | [Volume 03](./03-integracoes-bubble-zapsign-e-ia.md) |
| [`src/lib/api-cliente.ts`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/src/lib/api-cliente.ts) | Wrapper HTTP para chamadas de API com tratamento padronizado de erros. | [Volume 03](./03-integracoes-bubble-zapsign-e-ia.md) |
| [`src/lib/client-fetch.ts`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/src/lib/client-fetch.ts) | `fetch` enriquecido no browser que injeta automaticamente o header `X-Cooperado-Session` e gerencia cache de navegação. | [Volume 03](./03-integracoes-bubble-zapsign-e-ia.md) |
| [`src/lib/cache-memoria.ts`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/src/lib/cache-memoria.ts) | Cache em memória no servidor/Edge com TTL e deduplicação de promessas concorrentes (*in-flight*). | [Volume 03](./03-integracoes-bubble-zapsign-e-ia.md) |
| [`src/lib/cache-navegacao.ts`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/src/lib/cache-navegacao.ts) | Cache de cliente entre transições de abas/rotas do Next.js com invalidação seletiva por prefixo. | [Volume 03](./03-integracoes-bubble-zapsign-e-ia.md) |
| [`src/lib/cpf.ts`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/src/lib/cpf.ts) | Algoritmo de validação, formatação e higienização de CPF. | [Volume 04](./04-modulo-adesao-cooperados-e-documentos.md) |
| [`src/lib/profissoes.ts`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/src/lib/profissoes.ts) | Catálogo de profissões, conselhos de classe (COREN, CRM, CREFITO, etc.) e regras por nível de escolaridade. | [Volume 04](./04-modulo-adesao-cooperados-e-documentos.md) |
| [`src/lib/validacao-conselho.ts`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/src/lib/validacao-conselho.ts) | Validação de registros profissionais junto aos conselhos regionais. | [Volume 04](./04-modulo-adesao-cooperados-e-documentos.md) |
| [`src/lib/documentos.ts`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/src/lib/documentos.ts) | Matriz de tipos de documentos de adesão, obrigatoriedade por perfil e cálculo de completude documental. | [Volume 04](./04-modulo-adesao-cooperados-e-documentos.md) |
| [`src/lib/comprovante-upload.ts`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/src/lib/comprovante-upload.ts) | Validação de MIME types, tamanho máximo e conversão Base64 para upload de arquivos ao Bubble. | [Volume 04](./04-modulo-adesao-cooperados-e-documentos.md) |
| [`src/lib/empresas-contratantes.ts`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/src/lib/empresas-contratantes.ts) | Dados societários e bancários das cooperativas/empresas contratantes para emissão de Termos e Romaneios. | [Volume 04](./04-modulo-adesao-cooperados-e-documentos.md) |
| [`src/lib/tipos-clinicos.ts`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/src/lib/tipos-clinicos.ts) | Classificação de profissões clínicas (Enfermagem Plantonista vs. Visitante Multiprofissional) e mapeamento de especialidades do Plano Terapêutico. | [Volume 05](./05-modulo-prontuario-clinico-cooperado-e-offline.md) |
| [`src/lib/aprazamento-engine.ts`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/src/lib/aprazamento-engine.ts) | Motor de geração automática de horários de administração de medicamentos por turno (`Diurno`, `Noturno`, `24h`). | [Volume 05](./05-modulo-prontuario-clinico-cooperado-e-offline.md) |
| [`src/lib/indexeddb.ts`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/src/lib/indexeddb.ts) | Camada de persistência local no navegador (IndexedDB) para fila de sincronização offline, rascunhos de evolução e cache de plantões. | [Volume 05](./05-modulo-prontuario-clinico-cooperado-e-offline.md) |
| [`src/lib/sync-service.ts`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/src/lib/sync-service.ts) | Orquestrador de sincronização em background (fila offline → `/api/cooperado/sync` com retry e backoff). | [Volume 05](./05-modulo-prontuario-clinico-cooperado-e-offline.md) |
| [`src/lib/audio-recorder.ts`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/src/lib/audio-recorder.ts) | Captura de áudio via `MediaRecorder` API com detecção de MIME type suportado (`audio/webm`, `audio/mp4`) e análise de frequência para onda sonora. | [Volume 05](./05-modulo-prontuario-clinico-cooperado-e-offline.md) |
| [`src/lib/sync-pacientes.ts`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/src/lib/sync-pacientes.ts) | Sincronização bidirecional/incremental de pacientes entre o Data Type `Locais de Trabalho - Pacientes` do Bubble e a tabela `pacientes` do D1. | [Volume 06](./06-modulo-prontuario-360-gestor-e-plano-terapeutico.md) |
| [`src/lib/prontuario-equipamentos.ts`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/src/lib/prontuario-equipamentos.ts) | Consulta unificada de equipamentos hospitalares alocados no domicílio de um paciente específico. | [Volume 06](./06-modulo-prontuario-360-gestor-e-plano-terapeutico.md) |
| [`src/lib/equipamentos-estados.ts`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/src/lib/equipamentos-estados.ts) | Máquina de estados finita dos equipamentos hospitalares, matriz de transições válidas e permissões RBAC por ação. | [Volume 07](./07-modulo-equipamentos-locacoes-manutencao-e-baixas.md) |
| [`src/lib/equipamentos-financeiro.ts`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/src/lib/equipamentos-financeiro.ts) | Motor de cálculo pró-rata de locações, desconto de suspensões, demonstrativo mensal e cálculo de ROI/rentabilidade. | [Volume 07](./07-modulo-equipamentos-locacoes-manutencao-e-baixas.md) |
| [`src/lib/equipamentos-helpers.ts`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/src/lib/equipamentos-helpers.ts) | Utilitários de normalização de Option Sets, gerador de número de série interno e validações de equipamentos. | [Volume 07](./07-modulo-equipamentos-locacoes-manutencao-e-baixas.md) |
| [`src/lib/equipamentos-jobs.ts`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/src/lib/equipamentos-jobs.ts) | Rotinas automatizadas de expiração de reservas vencidas e varredura/geração de alertas operacionais. | [Volume 07](./07-modulo-equipamentos-locacoes-manutencao-e-baixas.md) |
| [`src/lib/romaneio-entrega.ts`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/src/lib/romaneio-entrega.ts) | Estruturação de dados e regras de emissão do Romaneio de Entrega/Retirada de equipamentos no domicílio. | [Volume 07](./07-modulo-equipamentos-locacoes-manutencao-e-baixas.md) |

---

### 3.4. Rotas de API (`temp-app/src/app/api/**` — 66 Endpoints Edge Runtime)

- **Autenticação (`src/app/api/auth/*` — 5 rotas)**: Documentadas linha a linha no [Volume 01](./01-arquitetura-infra-cicd-e-setup.md).
- **Webhooks (`src/app/api/webhooks/zapsign/route.ts` — 1 rota)**: Documentada linha a linha no [Volume 03](./03-integracoes-bubble-zapsign-e-ia.md).
- **Cooperado (`src/app/api/cooperado/*` — 8 rotas)**:
  - `adesao`, `me`, `upload`, `validar-conselho`, `verificar-cpf` → [Volume 04](./04-modulo-adesao-cooperados-e-documentos.md).
  - `transcrever` → [Volume 03](./03-integracoes-bubble-zapsign-e-ia.md).
  - `agenda`, `sync` → [Volume 05](./05-modulo-prontuario-clinico-cooperado-e-offline.md).
- **Gestor — Cooperados, Termos e Financeiro (9 rotas)**: Documentadas linha a linha no [Volume 04](./04-modulo-adesao-cooperados-e-documentos.md).
- **Gestor — Pacientes, Domicílios e Prontuários 360° (14 rotas + 1 Cron)**: Documentadas linha a linha no [Volume 06](./06-modulo-prontuario-360-gestor-e-plano-terapeutico.md).
- **Gestor — Equipamentos, Locações, Manutenção, Baixas, Alertas e Relatórios (27 rotas + 2 Crons)**: Documentadas linha a linha no [Volume 07](./07-modulo-equipamentos-locacoes-manutencao-e-baixas.md).

---

### 3.5. Telas e Componentes React (`temp-app/src/app/**`)

- **Portal & Login (`layout.tsx`, `page.tsx`, `login/page.tsx`, `entrar/page.tsx`)**: [Volume 01](./01-arquitetura-infra-cicd-e-setup.md).
- **Adesão, Painel de Cooperados, Termos e Financeiro (`adesao/page.tsx`, `cooperado/adesao/page.tsx`, `gestor/_components/GestorShell.tsx`, `gestor/dashboard/**`, `gestor/termos/page.tsx`, `gestor/financeiro/page.tsx`)**: [Volume 04](./04-modulo-adesao-cooperados-e-documentos.md).
- **Aplicativo Mobile do Cooperado e Atendimento Beira-Leito (`cooperado/layout.tsx`, `cooperado/cooperado-context.tsx`, `cooperado/page.tsx`, `cooperado/_components/AreaDoUsuarioModal.tsx`, `cooperado/prontuario/[id]/**`)**: [Volume 05](./05-modulo-prontuario-clinico-cooperado-e-offline.md).
- **Painel de Prontuários 360° do Gestor e Plano Terapêutico (`gestor/prontuarios/**`)**: [Volume 06](./06-modulo-prontuario-360-gestor-e-plano-terapeutico.md).
- **Painel de Equipamentos, Romaneio, Manutenção, Baixas e Relatórios (`gestor/equipamentos/**`, `gestor/equipamentos-relatorios/**`, `gestor/manutencao/**`, `gestor/baixas/**`)**: [Volume 07](./07-modulo-equipamentos-locacoes-manutencao-e-baixas.md).

---

### 3.6. Scripts de Auditoria, Testes Automatizados e MCP (`scripts/`, `tests/`, `befree-bubble-mcp/`)

- Todos os 9 scripts `.mts` em `temp-app/scripts/`, os 5 arquivos de testes de integração/RPC em `temp-app/tests/api/`, os 3 stubs D1/Edge, as 25 especificações E2E Playwright em `temp-app/tests/e2e/` e a arquitetura completa do pacote Python `befree-bubble-mcp` estão documentados no [Volume 08](./08-scripts-testes-e-befree-bubble-mcp.md).
