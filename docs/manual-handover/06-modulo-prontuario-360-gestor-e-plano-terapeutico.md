# 06 — Módulo Prontuário 360° (Visão Gestor) e Plano Terapêutico Multiprofissional

Este documento constitui o manual técnico de handover exaustivo do **Módulo Prontuário Eletrônico do Paciente 360° (EHR / PEP Domiciliar) na Visão do Gestor** e do **Motor de Plano Terapêutico Dinâmico e Versionado** do sistema **GestorCoop**.

Toda a documentação abaixo disseca **regra de negócio por regra de negócio** e **linha a linha / bloco a bloco** os **25 arquivos** (distribuídos nos 23 itens de especificação da camada de bibliotecas, endpoints Edge API e interfaces React/Next.js) que compõem a operação clínica da gestão.

---

## Parte I — Arquitetura e Regras de Negócio Exaustivas do Prontuário 360° (Visão do Gestor)

### 1. Sincronização Híbrida de Pacientes (Bubble Data API ↔ Cloudflare D1) e Admissão Clínica
1. **Desacoplamento de Leitura e Sincronização Assíncrona (`sync-pacientes.ts`)**:
   - No modelo arquitetural do GestorCoop, o cadastro comercial/logístico de clientes nasce no **Bubble.io** (`paciente`), enquanto o prontuário clínico 360° reside no **Cloudflare D1** (SQLite distribuído na Edge) com fallback em memória (`inMemoryPacientes`) para desenvolvimento local sem binding D1.
   - A listagem de pacientes do prontuário (`GET /api/gestor/prontuarios/pacientes`) **não pagina o Bubble de forma síncrona**. Ela lê diretamente do D1 em **1 único round-trip** (`listarPacientesComResumoClinico`), trazendo contadores agregados e planos vigentes em batch.
   - A sincronização periódica ocorre em segundo plano via cron (`GET/POST /api/cron/sync-pacientes-bubble`), autenticada pelo cabeçalho `Authorization: Bearer <CRON_SECRET>` validado por `cronAutorizado(request)`.
   - **Fallback de Primeiro Boot (Cold Start de Banco Vazio)**: Se `GET /api/gestor/prontuarios/pacientes` detectar `total === 0` sem filtros ativos (`!busca && !status && !complexidade`) e a contagem física na tabela `pacientes` do D1 (ou `inMemoryPacientes.size`) for zero, a rota dispara automaticamente `sincronizarPacientesBubbleParaD1({ db })` de forma transparente antes de responder.

2. **Regra de Ouro do Upsert Não-Destrutivo (`ON CONFLICT(id) DO UPDATE`)**:
   - O D1 executa lotes (`db.batch`) fatiados em `CHUNK_SIZE = 50` statements para respeitar os limites da plataforma Cloudflare D1.
   - Quando um paciente do Bubble já existe na tabela `pacientes` do D1, o `ON CONFLICT(id) DO UPDATE` atualiza **exclusivamente** dados cadastrais básicos vindos do ERP (`nome`, `cpf`, `endereco`, `telefone`) e **somente se o valor do Bubble não for vazio** (e, no caso de `nome`, diferente de `'Paciente sem Nome'`).
   - **Preservação Integral de Dados Clínicos**: Campos enriquecidos na admissão clínica ou durante o cuidado (`diagnostico_principal`, `cid10`, `complexidade`, `plano_saude`, `numero_carteirinha`, `status`, `limite_visitas_mes`, `data_nascimento`, `responsavel_nome`, `responsavel_telefone`, `responsaveis` e `warnings` clínicos existentes no D1) **jamais são sobrescritos** pela sincronização com o Bubble.
   - Se o paciente no Bubble possuir itens em `fks_equipamentos`, o registro inicial recebe o alerta `'Possui equipamentos em casa'` no array JSON `warnings`.
   - Ao final de qualquer sincronização, os caches de memória do isolate (`CHAVE_CACHE_PACIENTES_BUBBLE`) e de navegação (`CHAVE_CACHE_LISTAGEM_PACIENTES`) são invalidados imediatamente.

3. **Fluxo Duplo de Admissão de Paciente e Vínculo Institucional**:
   - **Admissão via Gestor Comercial (`POST /api/gestor/pacientes`)**: Exige obrigatoriamente `txt_nome` e `txt_endereco` (HTTP 400 se ausentes). Cria o registro no Bubble (`bubbleApi.createPaciente`) com `txt_tipo` padrão `'Homecare'` e replica imediatamente para o D1 clínico via `salvarPacienteClinico` com `status: 'Ativo'` e `complexidade: 'Baixa'` (em bloco `try/catch` tolerante a falhas para não bloquear o retorno caso o D1 oscile).
   - **Admissão Clínica Completa (`POST /api/gestor/prontuarios/pacientes` e Modal de Admissão em `gestor/prontuarios/page.tsx`)**:
     - Permite escolher entre **Base GestorCoop (Bubble)** (reaproveitando o `_id` original do Bubble como `id` no D1) ou **Cadastrar Novo** (geração de ID clínico).
     - Associa a **Empresa Contratante / Prestadora de Home Care** (`verdes-mares`, `multi-saude`, `isa-homecare`, etc., gerenciadas por `@/lib/empresas-contratantes`), persistindo tanto no campo `plano_saude`/`empresa_contratante` quanto no `localStorage` (`salvarEmpresaContratanteLocal`) e salvando o sexo biológico (`salvarSexoPacienteLocal`) para uso no cabeçalho oficial de impressão A4.
     - Permite cadastrar múltiplos **Familiares / Responsáveis pela Finalização do Plantão** (`responsaveis: ResponsavelPaciente[]`), garantindo que sempre exista exatamente um responsável marcado com `principal: true` (que também preenche as colunas legadas `responsavel_nome` e `responsavel_telefone` para retrocompatibilidade).
     - Se o payload incluir `plano_terapeutico` com `metas.length > 0`, cria atomicamente na mesma requisição a **Versão 1 (`Ativo`)** do Plano Terapêutico.

4. **Vínculo de Domicílios e Equipamentos Hospitalares (`domicilios/route.ts` e `prontuario-equipamentos.ts`)**:
   - Os domicílios cadastrados no Bubble para entrega e logística são consultados por `GET /api/gestor/domicilios?cliente=<id>` via `bubbleApi.getDomiciliosPorPaciente(clienteId)`.
   - Os equipamentos hospitalares alocados na residência do paciente são consultados via `listarEquipamentosDoPaciente(pacienteId)`:
     - Filtra diretamente na Data API do Bubble com constraint `fk_paciente equals pacienteId`.
     - **Tratamento de ID Inexistente no Bubble (`idInexistenteNoBubble`)**: Como `fk_paciente` no Bubble é uma referência tipada ("Thing"), consultar um ID que só existe no D1 (ex: paciente manual ou de teste) faz o Bubble retornar HTTP 400 com a mensagem `"object with this id does not exist"`. A função intercepta esse erro específico e retorna `[]` imediatamente, evitando uma varredura completa desnecessária.
     - **Fallback Resiliente**: Se o Bubble recusar o filtro por outro motivo (ex: regra de privacidade ou renomeação), faz fallback para `bubbleApi.getLocacoes()` completo e aplica o filtro defensivo `locacoes.filter((l) => l.fk_paciente === pacienteId)` em memória.
     - **Otimização de Join de Equipamentos (`MAX_BUSCAS_INDIVIDUAIS = 25`)**: Se o paciente tiver até 25 equipamentos únicos (`fk_equipamento`), busca cada equipamento em paralelo com `Promise.all(ids.map(id => bubbleApi.getEquipamento(id)))`. Acima de 25 itens, baixa o catálogo paginado (`bubbleApi.getEquipamentos()`) uma única vez.
     - **Carregamento Não-Bloqueante na UI**: Na tela do Prontuário 360° (`prontuario-detalhe.tsx`), os dados clínicos vêm do D1 em 1 única requisição (`GET /api/gestor/prontuarios/pacientes/[id]` com `completo: true`), liberando a interface instantaneamente, enquanto os equipamentos do Bubble são buscados em segundo plano via `GET /api/gestor/prontuarios/pacientes/[id]/equipamentos` com `AbortController` para cancelar requisições obsoletas ao trocar de paciente.

---

### 2. Plano Terapêutico Dinâmico, Multiprofissional e Versionado
1. **Ciclo de Vigência Mensal Automático**:
   - Todo Plano Terapêutico opera em regime de competência mensal fechada, calculada por `obterPeriodoMesVigencia()`: **sempre do dia `01` (`YYYY-MM-01`) até o último dia do mês (`28`, `29`, `30` ou `31`)**.
   - Na virada do mês calendário, a contagem de visitas realizadas no ciclo é renovada automaticamente para a nova competência.

2. **Imutabilidade Histórica e Versionamento Automático (`v1`, `v2`, `v3`...)**:
   - Um paciente pode ter múltiplas versões de Plano Terapêutico ao longo do tempo, mas **apenas uma versão possui `status === 'Ativo'`** por vez.
   - Sempre que o gestor edita o plano vigente ou lança uma revisão (`POST /api/gestor/prontuarios/pacientes/[id]/planos`), o motor no banco (`salvarPlanoTerapeutico`) incrementa o número de versão (`proximaVersao = maiorVersaoAtual + 1`), grava o novo registro como `'Ativo'` e transiciona automaticamente as versões anteriores para `'Inativo'` (`Inativo (Histórico para Consulta)`).
   - Versões inativas permanecem visíveis na aba `Plano Terapêutico` em modo **Somente Consulta**, preservando a trilha de auditoria de quais metas e profissionais estavam vigentes em cada momento.

3. **Metas por Especialidade e Escala de Cooperados (`SeletorCooperadosMeta.tsx`)**:
   - Cada plano contém $N \ge 1$ metas (`metas`), onde cada meta define:
     - `especialidade`: Uma das 9 categorias clínicas homologadas (`Tecnico_Enfermagem`, `Enfermeiro`, `Medico`, `Dentista`, `Fisioterapeuta`, `Fonoaudiologo`, `Nutricionista`, `Psicologo`, `Terapeuta_Ocupacional`).
     - `quantidade_prevista`: Teto mensal contratado de visitas para aquela especialidade ($1$ a $120$).
     - `profissionais_designados`: Lista de cooperados escalados nominalmente (`{ id, nome, cargo, cpf }`).
   - **Regra de Cota Aberta vs. Cota Nominal**:
     - Se `profissionais_designados` estiver vazio (`[]`), a meta opera em **Cota Aberta**: qualquer cooperado daquela especialidade pode realizar atendimentos até o limite da meta.
     - Se houver cooperados escalados, o seletor exibe chips nominais e o portal/app prioriza e valida os profissionais designados.
   - **Normalização e Match Inteligente de Especialidades (`matchesSpecialty`)**: O componente `SeletorCooperadosMeta` remove acentos (`NFD`), converte caracteres especiais em espaço e cruza o código interno (`Tecnico_Enfermagem`), o rótulo (`Técnico de Enfermagem`), o `cargo` e o array `profissoes` vindos do Bubble, limitando a renderização do dropdown a 40 itens no DOM (`slice(0, 40)`) para performance em listas com milhares de cooperados, além de exibir até 6 pílulas de **Sugeridos** com adição em 1 clique.

4. **Cálculo de Progresso, Alertas de Pendência ("A Menos") e Bloqueio Automático ("A Mais")**:
   - Para cada meta do plano vigente, o banco cruza as evoluções clínicas assinadas na competência e calcula `quantidade_realizada`, `quantidade_restante` e `status_meta`.
   - **Bloqueio por Esgotamento de Cota**:
     - Quando `quantidade_realizada >= quantidade_prevista` em uma especialidade, a meta recebe o selo `Limite Atingido • Bloqueado` (cor `rose`), impedindo novas evoluções excedentes para aquela categoria.
     - Quando a soma total do plano atinge o teto (`total_realizado >= total_previsto` com `total_previsto > 0`), a rota `GET /api/gestor/prontuarios/pacientes` marca no paciente:
       - `p.bloqueio_plano = true`
       - `p.bloqueio_plano_motivo = "Todas as metas do Plano Terapêutico (vX) foram concluídas no mês (Y/Z)."`
       - `p.limite_atingido = true`
   - **Alerta de Atendimentos Pendentes (`pendencias_alertas`)**: Quando há visitas contratadas ainda não executadas na vigência (`status_meta === 'Pendente'`), o `DashboardGeral` renderiza no topo um banner âmbar destacando quantas pendências existem e listando cada especialidade com déficit de visitas.
   - **Cota Mensal Legada**: Caso um paciente antigo ainda não possua Plano Terapêutico estruturado (`planos.length === 0`), o cabeçalho do `prontuario-detalhe.tsx` exibe o controle de `limite_visitas_mes` com edição inline (`Alterar Cota Mensal`). Assim que o primeiro Plano Terapêutico é criado (`planos.length > 0`), o card legado se oculta automaticamente em favor das metas por especialidade.

---

### 3. Gestão de Prescrições Médicas e Motor de Aprazamento / Reconciliação
1. **Cadastro de Prescrição e Geração de Grade (`prescricoes/route.ts`)**:
   - Toda prescrição exige obrigatoriamente `medicamento`, `dosagem` e `via_administracao` (`Oral`, `Enteral`, `Subcutânea`, `Intravenosa`, `Intramuscular`, `Inalatória`, `Tópica`).
   - Define `frequencia_horas` (padrão `12`h; opções na UI: `24`, `12`, `8`, `6`, `4`h) e `horarios_padrao` (ex: `['08:00', '20:00']`).
   - Ao criar a prescrição via `criarPrescricaoClinica`, o motor gera automaticamente os registros de **Aprazamento** na tabela de checagens à beira do leito.
   - **Vínculo e Edição Inline do Médico Prescritor**:
     - Toda prescrição registra `medico_nome` e `medico_crm`.
     - Na aba `Prescrições Médicas` (`prontuario-detalhe.tsx`), o gestor pode editar ou informar retroativamente o médico prescritor de qualquer prescrição ativa via `PATCH /api/gestor/prontuarios/pacientes/[id]/prescricoes`.
     - O formulário de médico compila automaticamente uma lista de sugestões (`medicosDisponiveis`) unindo: (1) médicos já usados em prescrições anteriores do paciente, (2) médicos escalados nas metas do `planoVigente`, e (3) cooperados da base geral cujo cargo contenha `medic`/`médic` ou conselho contenha `CRM`.

2. **Reconciliação e Auditoria de Aprazamentos (`auditoria/route.ts` e `auditoria/page.tsx`)**:
   - O painel de reconciliação cruza o `horario_previsto` da prescrição com o `horario_executado` e o `status` (`Pendente`, `Administrado`, `Nao_Administrado`) registrado pelo técnico no domicílio:
     - **`Conforme`**: Dose administrada dentro da janela regulamentar de $\pm 60$ minutos ($|\text{exec} - \text{prev}| \le 60\text{ min}$), ou dose `Pendente` cujo horário previsto ainda não venceu há mais de 1 hora ($\text{agora} - \text{prev} \le 60\text{ min}$).
     - **`Atraso`**: Dose com `status === 'Administrado'`, porém executada com diferença superior a $60$ minutos em relação ao previsto ($|\text{diffMinutos}| > 60$). O sistema detalha se houve atraso (`Atraso de Xh Ym`) ou adiantamento (`Adiantamento de Xh Ym`).
     - **`Omissao_Com_Justificativa`**: Dose marcada como `Nao_Administrado`, exibindo a justificativa clínica registrada pelo profissional à beira do leito.
     - **`Pendente_Atrasado`**: Dose que permanece em `status === 'Pendente'` após mais de $1\text{ hora}$ ($3.600.000\text{ ms}$) do horário previsto sem checagem realizada (destacada com `animate-pulse` crítico no painel).
   - O **Índice de Pontualidade (`complianceScore`)** na auditoria é calculado como $\text{round}\left(\frac{\text{countConforme}}{\text{total}} \times 100\right)$ (100% se `total === 0`).

---

### 4. Monitoramento de Sinais Vitais, Evoluções SOAP, Pareceres e Impressão Oficial A4
1. **Sinais Vitais e Triagem de Oximetria (`sinais-vitais/route.ts`)**:
   - Registra PA Sistólica (`pa_sistolica`), PA Diastólica (`pa_diastolica`), Frequência Cardíaca (`fc_bpm`), Frequência Respiratória (`fr_rpm`), Temperatura (`temp_celsius`), Oximetria (`spo2_percent`), Glicemia Capilar (`glicemia_mg_dl`), Escala de Dor (`dor_escala`, aceitando inclusive `0`), Nível de Consciência (`nivel_consciencia`) e `observacoes`.
   - Na tabela de histórico de Sinais Vitais (`prontuario-detalhe.tsx`), valores de $\text{SpO}_2 < 93\%$ recebem automaticamente destaque visual de alerta crítico (`bg-rose-100 text-rose-800`), enquanto $\text{SpO}_2 \ge 93\%$ recebe badge normal (`bg-emerald-100 text-emerald-800`).

2. **Evoluções Clínicas Estruturadas em SOAP, Áudio e Selo Criptográfico**:
   - Cada evolução armazena `check_in`, `check_out`, `turno`, `audio_url` (reproduzível em player HTML5 `<audio>` nativo), `transcricao_crua`, `transcricao_revisada`, os 4 blocos do método clínico **SOAP** (`soap_subjetivo`, `soap_objetivo`, `soap_avaliacao`, `soap_plano`), o familiar que validou o encerramento do plantão (`responsavel_id`, `responsavel_nome`, `responsavel_parentesco`) e o selo de `assinatura_digital`.
   - **Projeção Leve (`X-Gestorcoop-Projecao: resumo`)**: Na listagem geral (`GET /api/gestor/prontuarios`), o cliente solicita a projeção resumida via header HTTP, omitindo textos longos de transcrição/SOAP e retornando apenas `resumo`, `aprazamentos_total` e `aprazamentos_administrados`, com cabeçalho de resposta `Vary: X-Gestorcoop-Projecao` para evitar poluição de caches intermediários.

3. **Pareceres de Auditoria Clínica (`parecer/route.ts`)**:
   - Permite que auditores médicos ou de enfermagem emitam pareceres vinculados ao paciente (e opcionalmente a uma `evolucao_id`), exigindo `tipo_parecer` (`Conforme`, `Recomendacao_Clinica`, `Pendente`, `Inconformidade`) e `descricao`.

4. **Motor de Impressão Oficial Homologado A4 (`impressao-prontuario.tsx`)**:
   - Gera folhas prontas para impressão física ou exportação em PDF (`@page { size: A4; margin: 8mm; }` com `page-break-after: always` entre folhas).
   - **8 Modos/Categorias de Impressão**:
     1. `todas`: Imprime a folha de Prescrição de Enfermagem (se houver prescrições) seguida de todas as evoluções do período ordenadas por categoria (`enfermagem` → `medico` → `fisioterapia` → `fonoaudiologia` → `nutricao`) e data decrescente.
     2. `enfermagem`: Filtra `Enfermeiro` e `Tecnico_Enfermagem`.
     3. `prescricao_enfermagem`: Imprime exclusivamente a grade de medicamentos, posologia, médico prescritor, aprazamentos e tabela SSVV.
     4. `medico`: Filtra `Medico` (rodapé com `Nº do CRM`).
     5. `fisioterapia`: Filtra `Fisioterapeuta` (rodapé com `Nº do CREFITO`).
     6. `fonoaudiologia`: Filtra `Fonoaudiologo` (rodapé com `Nº do CRFa`).
     7. `nutricao`: Filtra `Nutricionista` (rodapé com `Nº do CRN`).
     8. `individual`: Imprime um único atendimento específico selecionado pelo gestor.
   - **Pareamento de SSVV por Data (`obterSinaisParaEvolucao`)**: Cada folha de evolução busca os sinais vitais aferidos no mesmo dia (`diaEv = ev.check_in.slice(0, 10)`). Se não houver aferições naquele dia, exibe as até 5 aferições mais recentes do paciente. A tabela SSVV imprime até 6 linhas preenchidas e completa com linhas em branco (`____:____`) até garantir o mínimo de 3 linhas na grade.
   - **Ficha Oficial em Branco (Fallback de Impressão Física)**: Se o gestor selecionar uma categoria que ainda não possui evoluções digitalizadas no período filtrado, o modal renderiza automaticamente uma **Ficha Oficial em Branco** com o cabeçalho preenchido do paciente, logomarca da empresa contratante, grade SSVV e 6 linhas pontilhadas para preenchimento manual no domicílio.

---

## Parte II — Explicação Exaustiva Linha a Linha / Bloco a Bloco dos 25 Arquivos

---

### Arquivo 1: `temp-app/src/lib/sync-pacientes.ts` (155 linhas)
Responsável pela sincronização em lote da base de pacientes do Bubble para a tabela `pacientes` do Cloudflare D1 (ou memória local), preservando integralmente os dados clínicos.

- **Linhas 1–6 (Diretivas e Imports)**:
  - Desabilita a regra `@typescript-eslint/no-explicit-any` para lidar com bindings dinâmicos do D1.
  - Importa `bubbleApi` e a interface `Paciente` de `@/lib/bubble`.
  - Importa `getClinicalDb`, `garantirSchemaD1`, `inMemoryPacientes` e `PacienteClinico` de `@/lib/db/prontuarios`.
  - Importa os invalidadores e constantes de chaves de cache de servidor (`invalidarCacheMemoria`, `CHAVE_CACHE_PACIENTES_BUBBLE`) e de navegação (`invalidarCacheNavegacao`, `CHAVE_CACHE_LISTAGEM_PACIENTES`).
- **Linhas 7–15 (Contrato de Retorno e Constante de Batch)**:
  - Define a interface exportada `ResultadoSincronizacaoPacientes` com os campos `totalBubble: number`, `sincronizados: number`, `erros: string[]` e `duracaoMs: number`.
  - Define `const CHUNK_SIZE = 50;`, limitando cada chamada `db.batch()` a 50 statements SQL para respeitar os limites operacionais do Cloudflare D1.
- **Linhas 16–32 (Assinatura e Inicialização de `sincronizarPacientesBubbleParaD1`)**:
  - Recebe `opcoes: { db?: any; pacientesMock?: Paciente[] } = {}` (permitindo injeção de banco e mock em testes unitários).
  - Registra `const inicio = Date.now()`, resolve a instância `db` (`opcoes.db !== undefined ? opcoes.db : getClinicalDb()`) e inicializa `erros: string[] = []`.
- **Linhas 33–45 (Coleta de Pacientes do Bubble com Tratamento de Erro)**:
  - Usa `opcoes.pacientesMock` se fornecido; caso contrário, chama `await bubbleApi.getPacientes()`.
  - Se a requisição ao Bubble falhar, loga o erro com prefixo `[sync-pacientes]` e retorna imediatamente `{ totalBubble: 0, sincronizados: 0, erros: [msg], duracaoMs: Date.now() - inicio }` sem abortar o processo chamador com exceção não tratada.
- **Linhas 47–91 (Caminho 1: Ambiente Sem D1 Conectado — `if (!db)`)**:
  - Itera sobre `pacientesBubble` ignorando registros sem `_id` (`if (!b._id) continue;`).
  - Busca o registro prévio em `inMemoryPacientes.get(b._id)`.
  - Resolve `nome`: se `b.txt_nome` limpo existir e não for `'Paciente sem Nome'`, usa `nomeTrim`; senão preserva `existente?.nome` ou usa `'Paciente sem Nome'`.
  - Resolve `cpf`, `endereco` e `telefone` priorizando os campos do Bubble (`txt_cpf`, `txt_endereco`, `txt_whatsapp`) quando preenchidos, com fallback para os valores já existentes em memória.
  - Resolve `warnings`: se `b.fks_equipamentos` tiver itens, adiciona `'Possui equipamentos em casa'` ao conjunto (`Set`) de warnings existentes sem duplicar; caso contrário, mantém `existente?.warnings || []`.
  - Constrói o objeto `registroAtualizado: PacienteClinico` preservando todos os campos clínicos (`data_nascimento`, `responsavel_nome`, `responsavel_telefone`, `responsaveis`, `diagnostico_principal` com default `'Acompanhamento Domiciliar'`, `cid10`, `complexidade` com default `'Baixa'`, `plano_saude`, `numero_carteirinha`, `status` com default `'Ativo'`, `limite_visitas_mes` com default `0`, `created_at`).
  - Persiste no `Map` `inMemoryPacientes.set(b._id, registroAtualizado)` e incrementa `sincronizados++`. Qualquer erro por paciente é capturado e adicionado ao array `erros`.
- **Linhas 92–128 (Caminho 2: Ambiente Com Cloudflare D1 — Preparação de Statements Upsert)**:
  - Executa `await garantirSchemaD1(db)` para assegurar que a tabela `pacientes` e suas colunas existam.
  - Percorre `pacientesBubble` (pulando se `!b._id`), normalizando `nome`, `cpf`, `endereco`, `telefone`, `warnings` (serializado via `JSON.stringify`) e `createdAt`.
  - Prepara a query parametrizada `INSERT INTO pacientes (...) VALUES (?, ?, ?, '', ?, ?, '', '', 'Acompanhamento Domiciliar', '', 'Baixa', '', '', ?, 'Ativo', 0, ?) ON CONFLICT(id) DO UPDATE SET ...`:
    - `nome`: atualiza apenas se `excluded.nome != '' AND excluded.nome != 'Paciente sem Nome'`.
    - `cpf`: atualiza apenas se `excluded.cpf != ''`.
    - `endereco`: atualiza apenas se `excluded.endereco != ''`.
    - `telefone`: atualiza apenas se `excluded.telefone != ''`.
    - Todas as demais colunas clínicas do D1 não entram na cláusula `DO UPDATE`, garantindo preservação de 100% do histórico clínico.
- **Linhas 130–142 (Execução Fatiada em Chunks no D1)**:
  - Divide o array `stmts` em fatias de `CHUNK_SIZE` (50) e executa `await db.batch(chunk)`.
  - Soma `sincronizados += chunk.length` a cada lote bem-sucedido; se um lote falhar, registra o índice do batch (`Math.floor(i / CHUNK_SIZE) + 1`) em `erros` e prossegue para os próximos lotes.
- **Linhas 144–154 (Invalidação de Caches e Retorno)**:
  - Chama `invalidarCacheMemoria(CHAVE_CACHE_PACIENTES_BUBBLE)` e `invalidarCacheNavegacao(CHAVE_CACHE_LISTAGEM_PACIENTES)`.
  - Retorna o objeto consolidado `{ totalBubble, sincronizados, erros, duracaoMs: Date.now() - inicio }`.

---

### Arquivo 2: `temp-app/src/lib/prontuario-equipamentos.ts` (89 linhas)
Módulo otimizado para buscar no Bubble apenas as locações e equipamentos hospitalares vinculados a um paciente específico.

- **Linhas 1–18 (Imports, Interface e Limite de Busca Individual)**:
  - Importa `bubbleApi` e o tipo `LocacaoEquipamento` de `@/lib/bubble`.
  - Exporta a interface `EquipamentoVinculadoPaciente` contendo `id?`, `equipamento_id`, `nome`, `categoria`, `numero_serie`, `status_locacao`, `data_inicio`, `data_fim_previsto` e `valor_aluguel`.
  - Define `const MAX_BUSCAS_INDIVIDUAIS = 25;`, ponto de corte a partir do qual buscar o catálogo inteiro paginado é mais econômico que disparar $N$ requisições HTTP individuais.
- **Linhas 19–32 (Função Auxiliar `idInexistenteNoBubble`)**:
  - Inspeciona erros retornados pelo Axios ao consultar o Bubble.
  - Verifica se `e?.response?.status === 400` e se a mensagem de erro (`corpo?.body?.message ?? corpo?.message`) casa com a expressão regular `/object with this id does not exist/i`.
  - Isso ocorre quando `pacienteId` é um ID exclusivo do D1 (criado manualmente ou em testes) e não um UID do Bubble. Retorna `true` para evitar o fallback de varredura completa.
- **Linhas 34–59 (Busca Filtrada de Locações com Fallback e Filtro Defensivo)**:
  - Exporta `listarEquipamentosDoPaciente(pacienteId: string)`.
  - Tenta buscar no Bubble com constraint `{ key: 'fk_paciente', constraint_type: 'equals', value: pacienteId }`.
  - No `catch (erro)`: se `idInexistenteNoBubble(erro)` for verdadeiro, retorna `[]` imediatamente; caso contrário, emite `console.warn` e faz fallback para `await bubbleApi.getLocacoes()` (varredura completa).
  - Linha 58: Aplica filtro defensivo em memória `locacoes = locacoes.filter((l) => l.fk_paciente === pacienteId)` para garantir isolamento absoluto entre pacientes mesmo se o Bubble ignorar a constraint. Se vazio, retorna `[]`.
- **Linhas 61–72 (Resolução Otimizada dos Dados de Equipamentos)**:
  - Extrai os IDs únicos de equipamentos: `Array.from(new Set(locacoes.map((l) => l.fk_equipamento).filter(Boolean)))`.
  - Se `ids.length > MAX_BUSCAS_INDIVIDUAIS` (mais de 25 equipamentos distintos), chama `await bubbleApi.getEquipamentos()` e indexa num `Map`.
  - Caso contrário ($\le 25$), dispara buscas paralelas `await Promise.all(ids.map((id) => bubbleApi.getEquipamento(id).catch(() => null)))` e popula o `Map` `equipamentos`.
- **Linhas 74–88 (Mapeamento e Normalização do Retorno)**:
  - Mapeia cada locação cruzando com o equipamento no `Map`:
    - `id`: `loc._id`
    - `equipamento_id`: `loc.fk_equipamento`
    - `nome`: `equip.txt_nome || (loc as any).txt_nome || 'Equipamento Hospitalar'`
    - `categoria`: `equip.txt_categoria || 'Domiciliar'`
    - `numero_serie`: `equip.txt_numero_serie || 'N/A'`
    - `status_locacao`: `loc.txt_status || 'Ativo'`
    - `data_inicio`: `loc.date_inicio`
    - `data_fim_previsto`: `loc.date_fim_previsto`
    - `valor_aluguel`: `loc.num_valor_aluguel`

---

### Arquivo 3: `temp-app/src/app/api/cron/sync-pacientes-bubble/route.ts` (41 linhas)
Endpoint Edge acionado pelo worker de cron para sincronizar periodicamente os pacientes do Bubble para o D1.

- **Linhas 1–7 (Imports e Configuração de Runtime)**:
  - Importa `NextRequest`, `NextResponse`, o validador `cronAutorizado` de `@/lib/equipamentos-jobs` e `sincronizarPacientesBubbleParaD1` de `@/lib/sync-pacientes`.
  - Declara `export const dynamic = 'force-dynamic'` e `export const runtime = 'edge'`.
- **Linhas 8–32 (Função `processarSincronizacao`)**:
  - Linhas 13–15: Valida `if (!cronAutorizado(request))` (verifica o segredo `CRON_SECRET` no header `Authorization: Bearer ...` ou header de cron). Se inválido, retorna HTTP `401` com `{ success: false, error: 'Não autorizado.' }`.
  - Linhas 17–23: Chama `const resultado = await sincronizarPacientesBubbleParaD1()` e retorna HTTP `200` com `success: resultado.erros.length === 0`, `data: resultado` e `timestamp: new Date().toISOString()`.
  - Linhas 24–31: Em caso de exceção inesperada, loga o erro e retorna HTTP `500`.
- **Linhas 34–40 (Handlers HTTP `POST` e `GET`)**:
  - Exporta tanto `POST` quanto `GET` delegando para `processarSincronizacao(request)`, permitindo acionamento tanto por schedulers que usam `GET` quanto por webhooks/workers que usam `POST`.

---

### Arquivo 4A: `temp-app/src/app/api/gestor/pacientes/route.ts` (81 linhas)
Endpoint comercial/administrativo para listar a base bruta de pacientes do Bubble (com cache em memória por isolate) e criar novos pacientes no Bubble com replicação imediata no D1.

- **Linhas 1–8 (Imports e Runtime Edge)**:
  - Importa `bubbleApi`, `Paciente`, utilitários de cache (`memoizarComTtl`, `CHAVE_CACHE_PACIENTES_BUBBLE`, `TTL_PACIENTES_BUBBLE_MS`) e `salvarPacienteClinico`. Configura `dynamic = 'force-dynamic'` e `runtime = 'edge'`.
- **Linhas 9–28 (Handler `GET`)**:
  - Verifica se o cliente enviou o header `x-gestorcoop-cache: permitido` (usado pelo modal de admissão do prontuário para reutilizar cache de 60s).
  - Define `const ttl = aceitaCache ? TTL_PACIENTES_BUBBLE_MS : 30_000;`.
  - Executa `memoizarComTtl(CHAVE_CACHE_PACIENTES_BUBBLE, ttl, () => bubbleApi.getPacientes())`.
  - Retorna `{ success: true, data: list }` com header `Vary: X-Gestorcoop-Cache`. Em caso de erro, retorna HTTP `500`.
- **Linhas 30–80 (Handler `POST`)**:
  - Extrai `txt_nome`, `txt_cpf`, `txt_whatsapp`, `txt_endereco`, `txt_email` e `txt_tipo` do JSON do body.
  - Linhas 35–40: Valida obrigatoriedade de `txt_nome` e `txt_endereco`. Se ausentes, retorna HTTP `400` (`'Nome e Endereço de Entrega são obrigatórios.'`).
  - Linhas 43–52: Monta `newPaciente` com `txt_tipo: txt_tipo || 'Homecare'` e cria no Bubble via `await bubbleApi.createPaciente(newPaciente)`.
  - Linhas 54–69: Se `created._id` existir, replica imediatamente para o D1 clínico chamando `salvarPacienteClinico({ id: created._id, nome: created.txt_nome, cpf: created.txt_cpf || '', endereco: created.txt_endereco || '', telefone: created.txt_whatsapp || '', status: 'Ativo', complexidade: 'Baixa' })`. Falhas no D1 geram apenas `console.warn` sem abortar a criação.
  - Linha 71: Retorna `{ success: true, data: created }`.

---

### Arquivo 4B: `temp-app/src/app/api/gestor/pacientes/[id]/route.ts` (27 linhas)
Endpoint para atualização parcial de dados cadastrais do paciente diretamente no Bubble.

- **Linhas 1–6**: Imports (`NextRequest`, `NextResponse`, `bubbleApi`) e declaração de `dynamic = 'force-dynamic'` e `runtime = 'edge'`.
- **Linhas 7–26 (Handler `PATCH`)**:
  - Extrai `const id = params.id` e lê o `body` via `await request.json()`.
  - Invoca `await bubbleApi.updatePaciente(id, body)` e retorna `{ success: true }`.
  - Em caso de falha na Data API do Bubble, loga o erro com o ID do paciente e retorna HTTP `500` com `{ success: false, error: err.message || 'Erro ao atualizar cliente' }`.

---

### Arquivo 5: `temp-app/src/app/api/gestor/domicilios/route.ts` (29 linhas)
Endpoint que consulta os domicílios vinculados a um cliente/paciente no Bubble (utilizado pela logística/romaneio e conferência de endereço).

- **Linhas 1–6**: Imports e configuração `runtime = 'edge'`, `dynamic = 'force-dynamic'`.
- **Linhas 11–28 (Handler `GET`)**:
  - Extrai `const clienteId = request.nextUrl.searchParams.get('cliente')`.
  - Se `!clienteId`, retorna HTTP `400` com `{ success: false, error: 'Informe o cliente.' }`.
  - Chama `const list = await bubbleApi.getDomiciliosPorPaciente(clienteId)` e retorna `{ success: true, data: list }`.
  - Em caso de falha, retorna HTTP `500`.

---

### Arquivo 6: `temp-app/src/app/api/gestor/prontuarios/route.ts` (66 linhas)
Endpoint de listagem global de evoluções clínicas para o painel do gestor, com suporte a filtros combinados e projeção leve (`resumo`) ou completa.

- **Linhas 1–8**: Imports de `obterSessao` (`@/lib/sessao`) e `listarEvolucoesClinicas`, `listarEvolucoesResumo` (`@/lib/db/prontuarios`), mais configuração Edge.
- **Linhas 9–31 (Autenticação e Sanitização de Filtros)**:
  - Linha 11: Valida sessão de gestor `if (!(await obterSessao('gestor')))` → retorna HTTP `401` se inválida.
  - Extrai query params: `pacienteId`, `profissionalId`, `specialty`, `status`, `startDate`, `endDate`.
  - Linhas 21–22: Sanitiza `limit` com `parseInt(searchParams.get('limit') || '100', 10)`. Se o resultado não for finito ou for $\le 0$ (ex: `limit=abc` ou `limit=0`), aplica fallback seguro `100` para evitar varredura sem `LIMIT` da tabela inteira.
- **Linhas 33–54 (Seleção de Projeção e Resposta com `Vary`)**:
  - Verifica se o cliente pediu projeção leve via header `request.headers.get('x-gestorcoop-projecao') === 'resumo'` ou query `?projecao=resumo`.
  - Se `projecaoResumo` for `true`, chama `await listarEvolucoesResumo(filtros)` (que omite transcrição/SOAP completos e traz contagens de aprazamentos agregadas no SQL); caso contrário, chama `await listarEvolucoesClinicas(filtros)`.
  - Retorna `{ success: true, results: evolucoes, total: evolucoes.length, projecao: projecaoResumo ? 'resumo' : 'completa' }` com header HTTP `Vary: X-Gestorcoop-Projecao`.

---

### Arquivo 7: `temp-app/src/app/api/gestor/prontuarios/auditoria/route.ts` (47 linhas)
Endpoint dedicado ao painel de Reconciliação e Auditoria de Aprazamentos Medicamentosos.

- **Linhas 1–14**: Imports, configuração Edge e validação de sessão `obterSessao('gestor')` (retorna HTTP `401` se não autenticado).
- **Linhas 15–29 (Parâmetros e Consulta ao D1)**:
  - Extrai `pacienteId`, `status`, `startDate`, `endDate` e sanitiza `limit` (default `200`, garantindo número finito positivo).
  - Invoca `await listarAprazamentosParaAuditoria({ paciente_id: pacienteId, status, data_inicio: startDate, data_fim: endDate, limit })`.
- **Linhas 31–45**: Retorna `{ success: true, results, total: results.length }` ou HTTP `500` em caso de erro.

---

### Arquivo 8A: `temp-app/src/app/api/gestor/prontuarios/pacientes/route.ts` (198 linhas)
Endpoint central de listagem paginada de pacientes com resumo clínico em batch (`GET`) e de admissão clínica com criação de Plano Terapêutico (`POST`).

- **Linhas 1–23**: Imports de `obterSessao`, funções de banco (`listarPacientesComResumoClinico`, `salvarPacienteClinico`, `salvarPlanoTerapeutico`, `getClinicalDb`, `inMemoryPacientes`) e `sincronizarPacientesBubbleParaD1`.
- **Linhas 24–48 (`GET` — Autenticação, Paginação e Leitura Batch do D1)**:
  - Valida `await obterSessao('gestor', request)` (HTTP `401` se inválida).
  - Extrai `busca`, `status`, `complexidade`, `page` ($\ge 1$) e `limit` (entre $1$ e $500$).
  - Chama `listarPacientesComResumoClinico({ status, complexidade, busca, page, limit })`.
- **Linhas 49–76 (`GET` — Fallback de Sincronização Inicial em Banco Vazio)**:
  - Se `(resumoClinico.total ?? resumoClinico.pacientes.length) === 0` e nenhum filtro (`busca`, `status`, `complexidade`) estiver ativo, verifica no D1 (`SELECT COUNT(*) AS total FROM pacientes`) ou em `inMemoryPacientes.size` se a base está totalmente vazia.
  - Caso esteja vazia, executa `await sincronizarPacientesBubbleParaD1({ db })` e repete a chamada a `listarPacientesComResumoClinico`.
- **Linhas 78–116 (`GET` — Enriquecimento do Plano Terapêutico Vigente e Regra de Bloqueio)**:
  - Para cada paciente `p` retornado, busca seu plano no `Map` `planosVigentes.get(p.id)`.
  - Se possuir plano com `metas.length > 0`:
    - Calcula `totalPrevisto`, `totalRealizado`, `totalRestante` e `cotaPlanoEsgotada = totalPrevisto > 0 && totalRealizado >= totalPrevisto`.
    - Preenche `p.tem_plano_terapeutico = true` e o objeto `p.plano_vigente`.
    - Se `cotaPlanoEsgotada` for verdadeiro, define `p.bloqueio_plano = true`, `p.bloqueio_plano_motivo = "Todas as metas do Plano Terapêutico (vX) foram concluídas no mês (Y/Z)."` e `p.limite_atingido = true`.
  - Se não possuir plano com metas, define `p.tem_plano_terapeutico = false`.
  - Retorna JSON com `data: pacientes`, `total`, `page`, `limit` e `totalPages`.
- **Linhas 126–197 (`POST` — Admissão Clínica de Paciente + Início de Plano Terapêutico)**:
  - Valida sessão de gestor (HTTP `401`) e presença de `body.nome` (HTTP `400` se ausente).
  - Linhas 141–159: Chama `salvarPacienteClinico` preservando `body.id` (se veio do Bubble), dados cadastrais, lista `responsaveis`, `diagnostico_principal` (default `'Acompanhamento Multiprofissional'`), `complexidade` (default `'Média'`), `warnings`, `status` (`'Ativo'`) e `limite_visitas_mes`.
  - Linhas 162–182: Se `body.plano_terapeutico?.metas` for um array não-vazio, chama `salvarPlanoTerapeutico` criando o plano `'Ativo'` vinculado a `pacienteSalvo.id` com suas metas e profissionais designados.
  - Linhas 184–189: Retorna `{ success: true, data: pacienteSalvo, plano: planoSalvo, message: 'Paciente clínico e Plano Terapêutico iniciados com sucesso.' }`.

---

### Arquivo 8B: `temp-app/src/app/api/gestor/prontuarios/pacientes/[id]/route.ts` (81 linhas)
Endpoint unificado do Prontuário 360° individual (`GET` em 1 ida ao D1 e `PUT` para atualização cadastral/clínica).

- **Linhas 21–52 (Handler `GET`)**:
  - Valida sessão de gestor (HTTP `401`).
  - Chama `await carregarProntuario360(pacienteId, { limiteSinais: 100 })`.
  - Se retornar `null`, responde HTTP `404` (`'Paciente não encontrado.'`).
  - Retorna HTTP `200` com `data: { ...prontuario, pendencias: prontuario.planoVigente?.pendencias_alertas || [], completo: true }`. A flag `completo: true` instrui o frontend (`prontuario-detalhe.tsx`) a não disparar chamadas redundantes para `/planos`, `/prescricoes`, `/sinais-vitais`, `/parecer` e `/aprazamentos`.
- **Linhas 54–80 (Handler `PUT`)**:
  - Valida sessão de gestor (HTTP `401`).
  - Recebe o JSON e chama `await salvarPacienteClinico({ ...body, id: pacienteId })` (usado para atualizar cota mensal ou lista de familiares/responsáveis do plantão).
  - Retorna `{ success: true, data: pacienteAtualizado, message: 'Dados do paciente atualizados com sucesso.' }`.

---

### Arquivo 9: `temp-app/src/app/api/gestor/prontuarios/pacientes/[id]/dashboard/route.ts` (78 linhas)
Endpoint agregador da Dashboard executiva individual do paciente (combina dados clínicos do D1 com equipamentos locados no Bubble em paralelo).

- **Linhas 10–31 (Autenticação e Execução Paralela D1 + Bubble)**:
  - Valida sessão de gestor (HTTP `401`) e `pacienteId` (HTTP `400`).
  - Dispara `Promise.all` com:
    1. `carregarProntuario360(pacienteId, { limiteSinais: 5 })`
    2. `listarEquipamentosDoPaciente(pacienteId).catch(() => [])`
  - Se `!prontuario`, retorna HTTP `404`.
- **Linhas 33–53 (Cálculo de Estatísticas e KPIs)**:
  - Filtra `prescricoes = todasPrescricoes.filter((p) => p.status === 'Ativa')`.
  - Extrai `pendencias = planoVigente?.pendencias_alertas || []`.
  - Monta o objeto `estatisticas`:
    - `total_evolucoes`: `evolucoes.length`
    - `prescricoes_ativas`: `prescricoes.length`
    - `equipamentos_instalados`: `equipamentosVinculados.filter((e) => e.status_locacao === 'Ativo').length`
    - `metas_plano_vigente`: `{ total_previsto, total_realizado, total_restante, percentual_cumprido (limitado a 100%), tem_pendencias: pendencias.length > 0 }`.
- **Linhas 55–69**: Retorna `{ success: true, data: { paciente, planoVigente, planos: todosPlanos, pendencias, estatisticas, equipamentos: equipamentosVinculados, evolucoesRecentes: evolucoes.slice(0, 5), prescricoes, sinaisVitais, pareceres } }`.

---

### Arquivo 10: `temp-app/src/app/api/gestor/prontuarios/pacientes/[id]/planos/route.ts` (76 linhas)
Endpoint para listar todo o histórico de versões do Plano Terapêutico de um paciente (`GET`) e criar/versionar um novo Plano Terapêutico ativo (`POST`).

- **Linhas 12–29 (Handler `GET`)**:
  - Valida sessão de gestor (HTTP `401`) e `pacienteId` (HTTP `400`).
  - Chama `await listarPlanosTerapeuticosPorPaciente(pacienteId)` e retorna `{ success: true, data: planos }`.
- **Linhas 31–75 (Handler `POST`)**:
  - Valida sessão de gestor (HTTP `401`) e `pacienteId` (HTTP `400`).
  - Extrai `{ id, mes_referencia, data_inicio, data_fim, status, observacoes, metas }` do body.
  - Linhas 42–47: Valida que `metas` é um array não vazio. Caso contrário, retorna HTTP `400` (`'O plano terapêutico deve conter ao menos uma meta por especialidade.'`).
  - Linhas 49–63: Chama `await salvarPlanoTerapeutico(...)` normalizando `quantidade_prevista: Number(m.quantidade_prevista) || 1` e `profissionais_designados`.
  - Linha 65: Recarrega a lista completa de planos do paciente (`await listarPlanosTerapeuticosPorPaciente(pacienteId)`) incluindo a nova versão ativa e as anteriores agora inativadas, retornando `{ success: true, data: planoSalvo, planos }`.

---

### Arquivo 11: `temp-app/src/app/api/gestor/prontuarios/pacientes/[id]/prescricoes/route.ts` (98 linhas)
Endpoint CRUD de Prescrições Médicas do paciente (`GET`, `POST` e `PATCH`).

- **Linhas 9–21 (Handler `GET`)**:
  - Valida sessão de gestor (HTTP `401`).
  - Chama `await listarPrescricoesClinicas(pacienteId, false)` (o segundo argumento `false` indica que traz todas as prescrições do paciente, não apenas as ativas) e retorna `{ success: true, data: prescricoes }`.
- **Linhas 23–62 (Handler `POST`)**:
  - Valida sessão de gestor (HTTP `401`).
  - Valida obrigatoriedade de `body.medicamento`, `body.dosagem` e `body.via_administracao` (retorna HTTP `400` se faltar qualquer um).
  - Chama `await criarPrescricaoClinica(...)` com defaults seguros (`frequencia_horas: Number(body.frequencia_horas) || 12`, `horarios_padrao: body.horarios_padrao || ['08:00', '20:00']`, `data_inicio: body.data_inicio || new Date().toISOString()`, `status: 'Ativa'`) que insere a prescrição e gera automaticamente os horários de aprazamento.
- **Linhas 64–97 (Handler `PATCH`)**:
  - Valida sessão de gestor (HTTP `401`) e presença de `body.prescricao_id` (HTTP `400`).
  - Chama `await atualizarPrescricaoClinica(body.prescricao_id, pacienteId, { medico_nome, medico_crm, instrucoes, status })`.
  - Se não encontrar a prescrição (`!atualizada`), retorna HTTP `404`. Caso contrário, retorna `{ success: true, data: atualizada, message: 'Prescrição médica atualizada com sucesso.' }`.

---

### Arquivo 12: `temp-app/src/app/api/gestor/prontuarios/pacientes/[id]/aprazamentos/route.ts` (36 linhas)
Endpoint para listar os aprazamentos e checagens de medicamentos de um paciente específico.

- **Linhas 8–35 (Handler `GET`)**:
  - Valida sessão de gestor (HTTP `401`).
  - Chama `await carregarProntuario360(pacienteId)`. Se `!prontuario`, retorna HTTP `404` (`'Paciente não encontrado.'`).
  - Retorna `{ success: true, data: prontuario.aprazamentos || [] }`.

---

### Arquivo 13: `temp-app/src/app/api/gestor/prontuarios/pacientes/[id]/sinais-vitais/route.ts` (59 linhas)
Endpoint para listagem (`GET`) e aferição/registro (`POST`) de sinais vitais e parâmetros fisiológicos do paciente.

- **Linhas 9–21 (Handler `GET`)**:
  - Valida sessão de gestor (HTTP `401`).
  - Chama `await listarSinaisVitaisClinicos(pacienteId, 100)` (últimas 100 aferições) e retorna `{ success: true, data: sinais }`.
- **Linhas 23–58 (Handler `POST`)**:
  - Valida sessão de gestor (HTTP `401`).
  - Converte os parâmetros numéricos opcionais (`pa_sistolica`, `pa_diastolica`, `fc_bpm`, `fr_rpm`, `temp_celsius`, `spo2_percent`, `glicemia_mg_dl`).
  - Linha 43: Tratamento especial para `dor_escala`: verifica `body.dor_escala !== undefined && body.dor_escala !== '' && body.dor_escala !== null ? Number(body.dor_escala) : undefined` para preservar o valor `0` (ausência de dor na escala EVA $0\text{–}10$).
  - Define `profissional_nome: body.profissional_nome?.trim() || 'Profissional Cooperado'` e grava via `registrarSinalVitalClinico`.

---

### Arquivo 14: `temp-app/src/app/api/gestor/prontuarios/pacientes/[id]/parecer/route.ts` (58 linhas)
Endpoint para listagem (`GET`) e emissão (`POST`) de pareceres de auditoria clínica.

- **Linhas 9–21 (Handler `GET`)**:
  - Valida sessão de gestor (HTTP `401`) e retorna `await listarPareceresClinicos(pacienteId)`.
- **Linhas 23–57 (Handler `POST`)**:
  - Valida sessão de gestor (HTTP `401`).
  - Linhas 32–37: Exige `body.descricao` e `body.tipo_parecer` (retorna HTTP `400` se ausentes).
  - Chama `await registrarParecerClinico` com `auditor_id: body.auditor_id || 'gestor_admin'`, `auditor_nome: body.auditor_nome?.trim() || 'Auditor Clínico'` e `data_registro: new Date().toISOString()`.

---

### Arquivo 15: `temp-app/src/app/api/gestor/prontuarios/pacientes/[id]/equipamentos/route.ts` (31 linhas)
Endpoint assíncrono dedicado a buscar os equipamentos locados para o paciente no Bubble sem bloquear o carregamento do Prontuário 360° no D1.

- **Linhas 14–30 (Handler `GET`)**:
  - Valida sessão de gestor (HTTP `401`) e `pacienteId` (HTTP `400`).
  - Invoca `const equipamentos = await listarEquipamentosDoPaciente(pacienteId)` e retorna `{ success: true, data: equipamentos }`.

---

### Arquivo 16: `temp-app/src/app/gestor/prontuarios/page.tsx` (1.832 linhas)
Painel Central de Gestão de Prontuários & Pacientes (`ProntuariosAuditDashboard`), com listagem paginada de pacientes, linha do tempo de evoluções com exportação CSV, compartilhamento de links do Portal do Cooperado (Clipboard e WhatsApp) e o Modal Inteligente de Admissão Clínica & Plano Terapêutico Dinâmico.

- **Linhas 1–59 (Imports e Utilitários)**:
  - Componente `'use client'`. Importa ícones `lucide-react`, `Link`, `useRouter`, `fetchFullDataset` (`@/lib/client-fetch`), formatadores e tipos de `@/lib/tipos-clinicos`, `SeletorCooperadosMeta`, `obterUrlCooperado` (`@/lib/subdominios`), funções de empresas contratantes (`@/lib/empresas-contratantes`) e o sistema de cache SWR de navegação (`@/lib/cache-navegacao`).
- **Linhas 60–147 (Interfaces `PacienteSummary`, `Evolution` e Catálogo de Especialidades)**:
  - `PacienteSummary` (linhas 60–106): modela os dados cadastrais, empresa contratante, cotas de visitas, resumo do `plano_vigente` (`id`, `versao`, `data_inicio`, `data_fim`, `total_previsto`, `total_realizado`, `total_restante`, `tem_pendencias`) e `ultimo_sinal_vital`.
  - `Evolution` (linhas 108–135): modela tanto o formato completo de evolução quanto a projeção leve (`resumo`, `aprazamentos_total`, `aprazamentos_administrados`).
  - `ESPECIALIDADES_DISPONIVEIS` (linhas 137–147): array com as 9 especialidades multiprofissionais disponíveis para metas do plano.
- **Linhas 149–226 (Estados do Dashboard e do Modal de Admissão)**:
  - Controla a aba ativa (`activeTab: 'pacientes' | 'evolucoes'`), listas `pacientes` e `evolutions`, estados de loading e filtros (`search`, `selectedSpecialty`, `selectedComplexidade`).
  - `basesAuxiliaresSolicitadas` (`useRef`) e `requisicaoEvolucoesAtual` (`useRef`): evitam chamadas duplicadas ao Bubble/cooperados e descartam respostas fora de ordem (race conditions) ao trocar rapidamente o filtro de especialidade.
  - Inicializa `novoPacienteForm` (com `complexidade: 'Média'`, `empresa_contratante: 'verdes-mares'`, `limite_visitas_mes: 13`, `responsaveis: []`), `novoRespInput` e `planoDinamico` (vigência calculada por `obterPeriodoMesVigencia()` e 3 metas iniciais padrão: 5 visitas de `Tecnico_Enfermagem`, 1 de `Medico` e 2 de `Dentista`).
  - Configura paginação cliente (`ITENS_POR_PAGINA = 12`, `paginaAtual`).
- **Linhas 227–267 (Funções de Compartilhamento e Clipboard)**:
  - `copiarTextoParaClipboard`: utiliza `navigator.clipboard.writeText` com fallback para `<textarea>` oculto + `document.execCommand('copy')`.
  - `copiarLinkPacienteCooperado(p)`: gera a URL do subdomínio do cooperado (`obterUrlCooperado('/prontuario/' + p.id)`), copia para a área de transferência e aciona toast flutuante por 3,5s.
  - `copiarLinkGeralCooperado()`: copia a URL raiz do portal do cooperado.
- **Linhas 269–348 (Carregamento com Cache de Navegação SWR — `carregarPacientes` e `carregarEvolucoes`)**:
  - `carregarPacientes`: lê `lerCacheNavegacao(CHAVE_CACHE_LISTAGEM_PACIENTES)`. Se existir e não estiver `isStale` ($\le 45\text{s}$), retorna imediatamente sem requisição; se estiver `isStale`, renderiza o cache instantaneamente (sem skeleton) e revalida em background via `GET /api/gestor/prontuarios/pacientes`, gravando o novo resultado no cache.
  - `carregarEvolucoes`: usa `chaveCacheListagemEvolucoes(selectedSpecialty)` e controle de concorrência `++requisicaoEvolucoesAtual.current`. Chama `GET /api/gestor/prontuarios` enviando o header `{ 'X-Gestorcoop-Projecao': 'resumo' }`.
- **Linhas 350–434 (Carga Lazy sob Demanda das Bases Auxiliares — `garantirBasesAuxiliares` e `carregarBasesAuxiliares`)**:
  - A lista bruta de pacientes do Bubble e o catálogo completo de cooperados só são carregados quando o gestor abre pela primeira vez o Modal de Admissão (`abrirModalAdmissaoComPaciente`).
  - Busca `/api/gestor/pacientes` com header `'X-Gestorcoop-Cache': 'permitido'` e pagina `/api/gestor/cooperados` via `fetchFullDataset` (com fallback para `GET` simples e fallback secundário com 5 cooperados realistas para ambiente dev local; se cair no fallback, `basesAuxiliaresSolicitadas.current` volta para `false` para tentar o servidor novamente na próxima abertura).
- **Linhas 436–585 (Preparação do Modal de Admissão, Seleção do Bubble e Gestão de Responsáveis)**:
  - `abrirModalAdmissaoComPaciente(pacienteBubble?)`: se receber um paciente (ex: clicando em `"Iniciar Plano"` num card sem plano), pré-popula todo o formulário, resolve a empresa contratante via `resolverEmpresaDoPaciente` e converte `responsavel_nome` legado em item estruturado de `responsaveis` com `principal: true`.
  - `selecionarPacienteDoBubble(pac)`: ao clicar num item da busca do Bubble dentro do modal, preenche `id: pac._id || pac.id`, `nome`, `cpf`, `endereco`, `telefone` e empresa contratante.
  - `adicionarResponsavelNoModalAdmissao` e `removerResponsavelNoModalAdmissao`: gerenciam a lista de familiares autorizados a validar o fim do plantão, garantindo que o primeiro familiar da lista sempre assuma `principal: true` se o anterior for removido.
- **Linhas 587–627 (Manipulação Dinâmica de Metas no Modal)**:
  - `adicionarMetaAoPlano`, `removerMetaDoPlano`, `atualizarMetaDoPlano` e `toggleCooperadoNaMeta`: permitem adicionar/remover especialidades, alterar quantidades previstas e escalar/desescalar cooperados por meta.
- **Linhas 629–706 (Submissão Unificada `handleSalvarNovoPacienteEPlano`)**:
  - Valida `novoPacienteForm.nome` e `planoDinamico.metas.length > 0`.
  - Se o gestor digitou um nome no campo de responsável (`novoRespInput.nome`) mas esqueceu de clicar em `"Adicionar"`, inclui automaticamente esse responsável na lista `responsaveisFinal` antes de enviar (prevenindo perda de dados de UX).
  - Envia `POST /api/gestor/prontuarios/pacientes` com os dados do paciente e o objeto `plano_terapeutico`.
  - Após sucesso, salva empresa e sexo no `localStorage`, invalida `CHAVE_CACHE_LISTAGEM_PACIENTES`, fecha o modal e redireciona diretamente para `/gestor/prontuarios/${pacienteId}`.
- **Linhas 708–811 (Filtros em Memória, Paginação, KPIs e Exportação CSV)**:
  - `filteredPacientes`: filtra por `nome`, `cpf`, `diagnostico_principal`, `cid10` e `selectedComplexidade`. Reseta `paginaAtual` para `1` sempre que `search` ou `selectedComplexidade` mudam.
  - Calcula os KPIs: `totalPacientesAtivos` (`status !== 'Alta'`), `totalAtendimentos`, `totalAprazados`, `totalAdministrados` (compatível tanto com `ev.aprazamentos_total` da projeção leve quanto com o array `ev.aprazamentos`) e `complianceRate`.
  - `exportToCSV()`: gera arquivo `auditoria_prontuarios_YYYY-MM-DD.csv` calculando o tempo gasto em minutos `(check_out - check_in) / 60000` de cada evolução filtrada.
- **Linhas 813–1288 (Renderização do Painel Principal)**:
  - Cabeçalho com botão de cópia do Link Geral do Cooperado, link para `/gestor/prontuarios/auditoria` e botão `"Admitir Paciente"`.
  - 4 Cards de KPIs Executivos, barra de abas (`Pacientes & Prontuários` vs `Linha do Tempo de Evoluções`), barra de busca/filtros.
  - Grid de cards de pacientes (12 por página) mostrando badge de complexidade, badge colorido da empresa contratante (`empCard`), status do Plano Terapêutico vigente (`vX` com progresso `realizado / previsto` e vigência mensal) ou botão `"Iniciar Plano"` caso não possua plano, contador de prescrições ativas, botão `"Copiar Link"`, botão de envio direto via WhatsApp (`api.whatsapp.com/send`) e link `"Ver Prontuário 360°"`.
  - Aba 2 (`evolucoes`): tabela com paciente, profissional/especialidade, check-in, resumo SOAP e link para o prontuário.
- **Linhas 1290–1831 (Renderização do Modal Inteligente de Admissão e Toast)**:
  - Etapa 1: Alternância entre `Base GestorCoop (Bubble)` (com busca instantânea e seleção visual) e `Cadastrar Novo`, campos cadastrais e sub-bloco de Familiares/Responsáveis com `data-testid` dedicados para testes E2E.
  - Etapa 1.5: Seletor visual de Empresa Contratante com miniatura da logomarca, CNPJ e preview em tempo real do cabeçalho institucional.
  - Etapa 2: Grau de Complexidade e Diagnóstico Principal.
  - Etapa 3: Configuração dinâmica do Plano Terapêutico com banner de vigência mensal automática, lista de metas e componente `<SeletorCooperadosMeta />` em cada meta.

---

### Arquivo 17: `temp-app/src/app/gestor/prontuarios/auditoria/page.tsx` (333 linhas)
Tela de **Reconciliação e Auditoria de Aprazamento** (`ReconciliacaoMedicamentosPage`), responsável pelo cruzamento entre prescrição médica e checagem de enfermagem à beira do leito.

- **Linhas 1–23 (Imports e Interface `Discrepancy`)**:
  - Define a estrutura `Discrepancy` com `id`, `pacienteNome`, `profissionalNome`, `medicamento`, `dosagem`, `horarioPrevisto`, `horarioExecutado?`, `status` (`'Pendente' | 'Administrado' | 'Nao_Administrado'`), `tipoDesvio` (`'Atraso' | 'Omissao_Com_Justificativa' | 'Pendente_Atrasado' | 'Conforme'`) e `detalheDesvio`.
- **Linhas 24–130 (Estado e Motor de Classificação de Desvios em `loadAuditoria`)**:
  - Consulta `GET /api/gestor/prontuarios/auditoria` com fallback automático para `GET /api/gestor/prontuarios` caso receba HTTP `404`.
  - Função `extrairDesvio(a)` (linhas 53–85):
    - Se o backend já enviou `tipoDesvio` e `detalheDesvio` calculados, preserva-os.
    - Caso contrário, calcula em tempo de execução:
      - Se `status === 'Nao_Administrado'`: classifica como `'Omissao_Com_Justificativa'` e usa `a.justificativa || 'Omissão justificada pelo técnico'`.
      - Se `status === 'Pendente'`: verifica se `Date.now() - prev > 3600000` (mais de 1h após o horário previsto). Se sim, classifica como `'Pendente_Atrasado'` (`'Medicamento atrasado sem checagem realizada'`); se não, `'Conforme'` (`'Dentro da janela programada (pendente de administração)'`).
      - Se `status === 'Administrado'` e houver `exec`: calcula `diffMinutos = Math.round((exec - prev) / 60000)`. Se `Math.abs(diffMinutos) > 60`, classifica como `'Atraso'` informando horas e minutos de atraso ou adiantamento; caso contrário, mantém `'Conforme'`.
  - Suporta tanto o formato legado (evoluções com array `item.aprazamentos`) quanto o formato plano direto da rota `/auditoria`.
- **Linhas 132–149 (Filtros e Cálculo das 5 Métricas de Reconciliação)**:
  - Filtra por termo textual (`pacienteNome`, `medicamento`, `profissionalNome`) e por `filterDesvio`.
  - Calcula `countAtrasos`, `countOmissoes`, `countPendenteAtrasado`, `countConforme`, `total` e `complianceScore`.
- **Linhas 150–332 (Interface Visual)**:
  - Renderiza cabeçalho com retorno para `/gestor/prontuarios`, grid de 5 KPIs (com `animate-pulse` no contador de `Pendente Atrasado`), barra de pesquisa e filtro de inconformidades, e tabela responsiva (`min-w-[720px]`) com badges semânticos para cada desvio.

---

### Arquivo 18: `temp-app/src/app/gestor/prontuarios/[id]/page.tsx` (15 linhas)
Casca de Server Component para compatibilidade com Cloudflare Pages (`next-on-pages`).

- **Linhas 1–15**:
  - Importa `Prontuario360Detalhe` de `./prontuario-detalhe`.
  - Exporta `export const runtime = 'edge';` (necessário porque o `next-on-pages` exige que rotas dinâmicas `[id]` declarem runtime Edge num arquivo sem `'use client'`).
  - Renderiza `<Prontuario360Detalhe />`.

---

### Arquivo 19: `temp-app/src/app/gestor/prontuarios/[id]/prontuario-detalhe.tsx` (2.647 linhas)
Componente mestre do **Prontuário Individual 360°** do paciente na visão do gestor, orquestrando 6 abas clínicas, cabeçalho institucional, controle de responsáveis, prescrições, aprazamentos, sinais vitais, pareceres e modal de impressão A4.

- **Linhas 1–173 (Imports e Interfaces de Dados Clínicos)**:
  - Importa `DashboardGeral`, `PlanoTerapeuticoTab`, `ImpressaoProntuarioModal` (`CATEGORIAS_IMPRESSAO`, `CategoriaImpressaoId`), utilitários de empresas contratantes, subdomínios e cache de navegação.
  - Declara as interfaces `PacienteData`, `EvolucaoData`, `PrescricaoData`, `SinalVitalData`, `ParecerData` e `AprazamentoData`.
- **Linhas 174–314 (Estados Principais e Gestão de Familiares / Responsáveis pelo Plantão)**:
  - Gerencia os estados clínicos (`paciente`, `evolucoes`, `prescricoes`, `aprazamentos`, `sinaisVitais`, `pareceres`, `planos`, `planoVigente`, `equipamentos`) e a aba ativa (`'geral' | 'plano' | 'evolucoes' | 'prescricoes' | 'sinais' | 'auditoria'`).
  - Funções `obterListaResponsaveisAtuais`, `abrirModalResponsaveis`, `adicionarResponsavelNaLista`, `definirResponsavelPrincipal`, `removerResponsavelDaLista` e `handleSalvarResponsaveisPaciente`: permitem gerenciar os familiares autorizados a assinar/validar o encerramento do plantão no app do cooperado, salvando via `PUT /api/gestor/prontuarios/pacientes/${paciente.id}` e invalidando o cache de listagem.
- **Linhas 315–374 (Vínculo de Empresa Contratante, Abertura de Impressão e Compartilhamento)**:
  - Resolve a empresa contratante do paciente via `resolverEmpresaDoPaciente(paciente)` e permite trocá-la com 1 clique no cabeçalho (`handleTrocarEmpresaContratante`), persistindo no `localStorage`.
  - `abrirImpressaoPorCategoria(categoria)` e `abrirImpressaoEvolucaoIndividual(evolucaoId)`: abrem o modal de impressão oficial A4 já posicionado na categoria desejada ou em uma evolução específica.
  - `copiarLinkCooperado()`: copia o link direto de atendimento do paciente no Portal do Cooperado.
- **Linhas 406–573 (Motor de Carregamento 360° com Cancelamento de Requisições Obsoletas)**:
  - Mantém `idAtualRef` e `equipamentosAbortRef` (`AbortController`) para descartar respostas caso o gestor navegue rapidamente entre pacientes.
  - `carregarEquipamentos()`: chama `/api/gestor/prontuarios/pacientes/${alvo}/equipamentos` em segundo plano; se falhar, exibe apenas um `partialWarning` amarelo sem bloquear os dados clínicos do D1.
  - `carregarProntuarioCompleto(silencioso)`:
    - Chama `GET /api/gestor/prontuarios/pacientes/${id}`.
    - Se a resposta trouxer `d.completo === true` (padrão atual em 1 round-trip ao D1), popula `paciente`, `evolucoes`, `prescricoes`, `aprazamentos`, `sinaisVitais`, `pareceres`, `planos` e `planoVigente` imediatamente, expande a primeira evolução (`setExpandedEvolucaoId(d.evolucoes[0].id)`) e dispara `carregarEquipamentos()` de forma assíncrona.
    - Mantém fallback legado com `Promise.allSettled` para `/dashboard`, `/planos`, `/prescricoes`, `/sinais-vitais`, `/parecer` e `/aprazamentos`, além de fallback secundário caso o `id` na URL seja o ID de uma evolução e não de um paciente.
- **Linhas 575–781 (Descoberta Inteligente de Médicos e Handlers de Formulários Clínicos)**:
  - `useEffect` (linhas 580–633): quando o modal de nova prescrição ou a edição inline de médico prescritor é aberta, busca `/api/gestor/cooperados` e monta `medicosDisponiveis` combinando médicos de prescrições anteriores, médicos escalados no `planoVigente` e cooperados médicos da base.
  - `handleSalvarPrescricao`: envia `POST .../prescricoes`, converte a string `horarios_padrao` separada por vírgula em array e recarrega o prontuário.
  - `handleAtualizarMedicoPrescricao`: envia `PATCH .../prescricoes` atualizando `medico_nome` e `medico_crm` na prescrição e refletindo imediatamente nos aprazamentos vinculados.
  - `handleSalvarSinalVital`: envia `POST .../sinais-vitais`.
  - `handleSalvarParecer`: envia `POST .../parecer`.
  - `handleSalvarCota`: atualiza a cota mensal legada via `PUT /api/gestor/prontuarios/pacientes/${paciente.id}`.
- **Linhas 783–1200 (Renderização: Skeleton, Erro, Action Bar e Patient Header 360 Card)**:
  - Exibe barra de navegação com breadcrumb dinâmico, botões `"Copiar Link do Cooperado"`, `"WhatsApp"` e `"Imprimir / Exportar PDF"`.
  - No **Patient Header 360 Card**:
    - Faixa institucional da Empresa Contratante com logomarca, razão social, texto de cabeçalho e seletor rápido de prestadora (`EMPRESAS_CONTRATANTES`).
    - Dados demográficos do paciente, badges de complexidade e status, card de Domicílio & Familiares/Responsáveis com botão `"Gerenciar Responsáveis"`, banners de Diagnóstico Principal (com CID-10) e Alergias/Alertas Críticos (`warnings`).
    - Bloco de Cota Contratada legada (exibido apenas se `planos.length === 0 && Number(paciente.limite_visitas_mes) > 0`).
- **Linhas 1200–2080 (Renderização das 6 Abas Clínicas)**:
  - `activeTab === 'geral'`: renderiza `<DashboardGeral />`.
  - `activeTab === 'plano'`: renderiza `<PlanoTerapeuticoTab />` atualizando o estado local de `planoVigente` e inativando versões anteriores ao salvar.
  - `activeTab === 'evolucoes'`: barra rápida de impressão por categoria profissional + cards expansíveis de evoluções com player de áudio HTML5 (`<audio controls>`), grid estruturado **SOAP** (4 quadrantes coloridos: Subjetivo, Objetivo, Avaliação, Plano), identificação do familiar responsável no plantão, selo criptográfico de assinatura digital e botão `"Imprimir Evolução Individual"`.
  - `activeTab === 'prescricoes'`: cards de prescrições com edição inline do Médico Prescritor, lista de checagens por prescrição e a **Tabela Geral de Registro & Auditoria de Administração de Medicamentos** com todos os horários aprazados.
  - `activeTab === 'sinais'`: tabela histórica de Sinais Vitais com destaque automático em vermelho (`bg-rose-100 text-rose-800`) para $\text{SpO}_2 < 93\%$.
  - `activeTab === 'auditoria'`: listagem de pareceres de auditoria emitidos.
- **Linhas 2081–2646 (Modais Operacionais e Modal de Impressão)**:
  - Modal de Nova Prescrição Médica (com seletor rápido de médicos cadastrados).
  - Modal de Aferição de Sinais Vitais.
  - Modal de Emissão de Parecer de Auditoria (`Conforme`, `Recomendacao_Clinica`, `Pendente`, `Inconformidade`).
  - Modal de Gestão de Familiares / Responsáveis pela Finalização do Plantão.
  - Componente `<ImpressaoProntuarioModal />` e toast flutuante.

---

### Arquivo 20: `temp-app/src/app/gestor/prontuarios/[id]/dashboard-geral.tsx` (418 linhas)
Componente da aba **Geral (Dashboard)** dentro do Prontuário 360° individual do paciente.

- **Linhas 1–43 (Imports, Props e Cálculos de Progresso)**:
  - Recebe `paciente`, `planoVigente`, `equipamentos`, `evolucoes`, `prescricoes` e callbacks de navegação `onIrParaPlano` e `onIrParaProntuario`.
  - Extrai `pendencias = planoVigente?.pendencias_alertas || []`, `totalPrevisto`, `totalRealizado` e `percentualTotal` (limitado a $100\%$).
- **Linhas 46–82 (Bloco 1: Banner de Alerta de Pendência Crítica — "A Menos")**:
  - Renderizado quando `pendencias.length > 0`. Exibe alerta âmbar com contador de pendências, link direto `"Ver no Plano"` e lista em tópicos das especialidades com visitas pendentes no ciclo.
- **Linhas 84–157 (Bloco 2: Grid de 4 KPIs Executivos)**:
  - **KPI 1 (Plano Terapêutico)**: exibe versão `(vX)`, proporção `totalRealizado / totalPrevisto`, intervalo de vigência formatado em PT-BR e barra de progresso dinâmica (verde em $100\%$, índigo $> 50\%$, âmbar $\le 50\%$).
  - **KPI 2 (Total de Evoluções)**: total de atendimentos e data do último check-in.
  - **KPI 3 (Prescrições Ativas)**: contagem filtrada por `p.status === 'Ativa'`.
  - **KPI 4 (Equipamentos no Domicílio)**: total de equipamentos locados para o paciente.
- **Linhas 159–281 (Bloco 3: Metas por Especialidade no Plano Terapêutico Vigente)**:
  - Renderiza um card para cada meta do `planoVigente.metas`, calculando `realizadas`, `previstas`, `restantes`, `pct` e a flag `esgotada = realizadas >= previstas`.
  - Quando `esgotada` é verdadeiro, aplica borda e barra vermelha (`rose`) e exibe o badge `<Lock /> Limite Atingido • Bloqueado`.
  - Lista os chips dos **Cooperados Escalados** (`meta.profissionais_designados`) ou informa `"Qualquer cooperado da especialidade"` se a cota for aberta.
  - Se não houver plano ativo, exibe empty state com botão `"Criar Plano Terapêutico"`.
- **Linhas 283–416 (Bloco 4: Grid Inferior — Equipamentos Instalados e Últimos Atendimentos)**:
  - **Coluna 1**: Lista cada equipamento locado no domicílio com `nome`, `numero_serie`, `categoria`, `data_inicio` e badge `status_locacao`.
  - **Coluna 2**: Exibe as 3 evoluções mais recentes (`evolucoes.slice(0, 3)`). Para o atendimento mais recente (`idx === 0`), destaca o bloco completo de Exame & Conduta Clínica (`soap_objetivo || transcricao_revisada`), o familiar responsável no plantão e o selo criptográfico de assinatura digital (`ev.assinatura_digital`).

---

### Arquivo 21: `temp-app/src/app/gestor/prontuarios/[id]/plano-terapeutico-tab.tsx` (651 linhas)
Componente dedicado à aba **Plano Terapêutico**, gerenciando a criação, edição versionada (`v1`, `v2`, `v3`...) e consulta histórica de planos inativos.

- **Linhas 1–85 (Imports, Props e Sincronização de Estado Local)**:
  - Mantém `planosLocais` sincronizado com a prop `planos`. Se inicializar vazio, faz fallback consultando `GET /api/gestor/prontuarios/pacientes/${pacienteId}/planos`.
- **Linhas 86–115 (Cálculo de Vigência Mensal e Versionamento)**:
  - Calcula `periodoMesAtual = obterPeriodoMesVigencia()`.
  - Determina `maiorVersaoAtual = planosLocais.reduce((max, p) => Math.max(max, Number(p.versao || 1)), 0)` e `proximaVersao = maiorVersaoAtual + 1`.
  - Inicializa `formPlano` com as datas do mês corrente e metas padrão.
- **Linhas 116–160 (`carregarCooperados`)**:
  - Carrega a lista completa de cooperados via `fetchFullDataset('/api/gestor/cooperados')` com fallback para `axios.get('/api/gestor/cooperados')`, normalizando `id`, `nome`, `cargo`, `profissoes`, `cpf` e `email`.
- **Linhas 162–240 (Ações de Formulário e Manipulação de Metas)**:
  - `iniciarNovoPlano()`: abre o modo de edição (`setModoEdicao(true)`) com vigência mensal atual e metas iniciais.
  - `editarPlanoExistente(plano)`: carrega os dados e metas do plano vigente no formulário para gerar a próxima versão ativa (`proximaVersao`).
  - `adicionarMeta`, `removerMeta`, `atualizarMeta` e `toggleCooperadoNaMeta`: manipulam as especialidades, quantidades previstas e cooperados designados.
- **Linhas 242–290 (`handleSalvarPlano`)**:
  - Valida `formPlano.metas.length > 0`.
  - Envia `POST /api/gestor/prontuarios/pacientes/${pacienteId}/planos` com `status: 'Ativo'`.
  - Ao receber sucesso, invalida `CHAVE_CACHE_LISTAGEM_PACIENTES`, exibe mensagem confirmando a ativação da nova versão e a preservação da anterior como `Inativa`, atualiza `planosLocais` e notifica o componente pai via `onPlanoAtualizado(salvo)`.
- **Linhas 292–650 (Renderização do Formulário e do Histórico de Versões)**:
  - Banner superior explicativo da regra de vigência mensal automática (dia 01 ao último dia do mês) e botão `"Nova Versão (vX)"` ou `"Criar Plano Terapêutico (v1)"`.
  - Quando `modoEdicao === true`: exibe formulário com cards informativos de Vigência Mensal Automática e Controle de Versão, lista de metas com `<SeletorCooperadosMeta />` e campo de observações.
  - Listagem de Planos (`planosLocais.map`):
    - Destaca visualmente o plano com `status === 'Ativo'` (borda índigo e botão `"Editar Plano"`) e exibe os planos anteriores com badge âmbar `"Inativo (Histórico para Consulta)"` e selo `"Somente Consulta"`.
    - Dentro de cada versão, renderiza os cards de metas com progresso `realizadas / previstas`, barra percentual, selo `<Lock /> Limite Mensal Atingido • Bloqueado` (quando esgotada na versão ativa) e nomes dos cooperados escalados.

---

### Arquivo 22: `temp-app/src/app/gestor/prontuarios/[id]/impressao-prontuario.tsx` (994 linhas)
Motor completo de **Impressão Oficial de Prontuários em Formato A4** (`ImpressaoProntuarioModal`), homologado para as prestadoras de Home Care (Verdes Mares, Multi Saúde, ISA Home Care, etc.).

- **Linhas 1–100 (Imports, Tipos e Catálogo `CATEGORIAS_IMPRESSAO`)**:
  - Exporta `CategoriaImpressaoId` (`'todas' | 'individual' | 'enfermagem' | 'prescricao_enfermagem' | 'fisioterapia' | 'fonoaudiologia' | 'nutricao' | 'medico'`).
  - Exporta a constante `CATEGORIAS_IMPRESSAO` com os 8 modos de impressão, cada um contendo `id`, `rotulo`, `tituloFicha`, `conselhoLabel` (Coren, CRM, CREFITO, CRFa, CRN) e `descricao`.
- **Linhas 130–148 (Funções Exportadas `classificarCategoriaEvolucao` e `obterTituloFichaPorTipo`)**:
  - `classificarCategoriaEvolucao(tipoProfissional)`: usa `normalizarEspecialidade` e mapeia `Enfermeiro` e `Tecnico_Enfermagem` para `'enfermagem'`, `Medico` para `'medico'`, `Fisioterapeuta` para `'fisioterapia'`, `Fonoaudiologo` para `'fonoaudiologia'`, `Nutricionista` para `'nutricao'`, com fallback padrão `'enfermagem'`.
  - `obterTituloFichaPorTipo(tipoProfissional)`: retorna o título oficial do cabeçalho da ficha (`EVOLUÇÃO DE ENFERMAGEM`, `EVOLUÇÃO MÉDICA`, `EVOLUÇÃO DE FISIOTERAPIA`, `EVOLUÇÃO DE FONOAUDIOLOGIA`, `EVOLUÇÃO DE NUTRIÇÃO`).
- **Linhas 150–285 (Estados, Filtros de Período, Contadores e Seleção de Evoluções)**:
  - Gerencia `categoriaAtiva`, `evolucaoSelecionadaId` (para impressão individual), `empresaId` (persistido via `salvarEmpresaContratanteLocal`), `sexoPaciente` (persistido via `salvarSexoPacienteLocal`), `filtroDataInicio` e `filtroDataFim`.
  - `evolucoesPeriodo`: filtra as evoluções pelo intervalo `[filtroDataInicio, filtroDataFim]` comparando `ev.check_in.slice(0, 10)`.
  - `contagemPorCategoria`: calcula dinamicamente quantos documentos existem em cada aba de categoria para exibir nos badges numéricos dos botões.
  - `evolucoesParaImprimir`:
    - Se `individual`: retorna apenas a evolução selecionada.
    - Se `prescricao_enfermagem`: retorna `[]` (pois imprime apenas a folha de prescrição).
    - Se `todas`: ordena todas as evoluções do período agrupando por categoria (`enfermagem` → `medico` → `fisioterapia` → `fonoaudiologia` → `nutricao`) e desempata por `check_in` decrescente.
    - Demais categorias: filtra por `classificarCategoriaEvolucao(ev.tipo_profissional) === categoriaAtiva`.
  - `obterSinaisParaEvolucao(ev)`: filtra os sinais vitais do mesmo dia do `check_in` da evolução; se não houver aferição naquele dia, retorna os 5 registros mais recentes.
- **Linhas 304–378 (`renderCabecalhoOficial`)**:
  - Renderiza o cabeçalho oficial com bordas pretas (`border-2 border-slate-900`), logomarca da empresa contratante (`empresaAtual.logoUrl`), razão social, texto institucional, CNPJ e grade estruturada com `NOME DO PACIENTE`, `SEXO`, `DN` (formatada em BR), `Idade` (calculada por `calcularIdadePaciente`), `DIAGNÓSTICO` (com CID-10), `NOME DO PROFISSIONAL` e `Data do atendimento`.
- **Linhas 380–456 (`renderTabelaSSVV`)**:
  - Renderiza a grade `SSVV — CONTROLE DE SINAIS VITAIS` com colunas `Horário`, `T`, `FC`, `FR`, `PA`, `Glicemia` e `Sat.O2`.
  - Exibe até 6 aferições reais (`linhasPreenchidas = sinaisLista.slice(0, 6)`) e preenche com linhas em branco (`linhasEmBranco = Math.max(0, 3 - linhasPreenchidas.length)`) contendo `____:____` para garantir no mínimo 3 linhas na tabela impressa.
- **Linhas 458–517 (`renderRodapeAssinaturas`)**:
  - Renderiza o rodapé oficial dividido em 2 colunas: à esquerda, nome/registro do profissional, selo criptográfico (`Assinado Digitalmente • Selo: ...`) e linha de assinatura com o conselho específico da categoria; à direita, o nome e parentesco do familiar responsável no plantão (`ev.responsavel_nome` ou `paciente.responsavel_nome`) sobre a linha `Responsável (nome legível)`.
- **Linhas 519–623 (`renderFolhaEvolucao`)**:
  - Monta uma página A4 completa (`.folha-impressao-oficial`) unindo `renderCabecalhoOficial`, `renderTabelaSSVV`, o quadro `EVOLUÇÃO` com os blocos `S`, `O`, `A`, `P` formatados e `renderRodapeAssinaturas`.
- **Linhas 625–721 (`renderFolhaPrescricaoEnfermagem`)**:
  - Monta a página A4 de **Prescrição de Enfermagem e Médica — Plano Medicamentoso e Aprazamento**, com tabela numerada de medicamentos, dosagem/via, médico prescritor + CRM, frequência (`X/Xh`), horários de aprazamento, instruções e contador de doses checadas (`administradas/checagens.length`), seguida da tabela SSVV e do rodapé de assinaturas.
- **Linhas 723–993 (Regras CSS `@media print`, Barra de Controles e Fallback de Ficha em Branco)**:
  - Linhas 725–773: Bloco `<style>` com `@media print` configurando `@page { size: A4; margin: 8mm; }`, ocultando o restante da aplicação (`body * { visibility: hidden; }`), posicionando `#container-impressao-prontuario` no topo absoluto e aplicando `page-break-after: always` e `break-inside: avoid-page` em cada `.folha-impressao-oficial`.
  - Linhas 777–935: Barra superior (oculta na impressão via `.ocultar-na-impressao`) permitindo trocar a Empresa Contratante, editar o Sexo do paciente na ficha, filtrar por intervalo de datas (`De` / `Até`), alternar entre as 8 categorias de impressão e escolher qual evolução imprimir no modo `individual`.
  - Linhas 953–986: Quando a categoria selecionada não possui evoluções registradas no período, renderiza automaticamente uma **Ficha Oficial em Branco** com cabeçalho preenchido, tabela SSVV, 6 linhas pontilhadas para preenchimento manual em campo e rodapé de assinaturas.

---

### Arquivo 23: `temp-app/src/app/gestor/prontuarios/_components/SeletorCooperadosMeta.tsx` (369 linhas)
Componente reutilizável de seleção múltipla e busca inteligente de cooperados para cada meta de especialidade do Plano Terapêutico.

- **Linhas 1–23 (Imports e Interfaces `CooperadoItem` e `SeletorCooperadosMetaProps`)**:
  - Define `CooperadoItem` (`id`, `nome`, `cargo?`, `profissoes?`, `cpf?`, `email?`) e as props recebidas pelo seletor (`especialidade`, `especialidadeRotulo`, `profissionaisDesignados`, `todosCooperados`, `onToggleCooperado`, `disabled`).
- **Linhas 24–51 (Motor de Normalização Textual e Match de Especialidade — `normalizeString` e `matchesSpecialty`)**:
  - `normalizeString(str)`: converte para minúsculas, decompõe acentos via Unicode `NFD`, remove diacríticos (`[\u0300-\u036f]`) e substitui caracteres não-alfanuméricos por espaço.
  - `matchesSpecialty(coop, especialidade, rotulo)`: compara o código da especialidade e seu rótulo normalizados contra `coop.cargo` e todos os itens de `coop.profissoes`, aceitando igualdade exata, inclusão (`includes`) ou prefixos com pelo menos 4 caracteres.
- **Linhas 53–120 (Estados, Click-Outside e Filtragem Memoizada de Alta Performance)**:
  - Controla `searchTerm`, `isOpen` e o toggle `apenasEspecialidade` (iniciado como `true` para mostrar por padrão apenas profissionais daquela especialidade).
  - `useEffect` (linhas 68–76): fecha o dropdown automaticamente ao clicar fora de `containerRef`.
  - `useMemo` (linhas 81–114):
    - Conta quantos cooperados da base pertencem à especialidade (`daEspecialidadeCount`).
    - Se `apenasEspecialidade` estiver ativo e `daEspecialidadeCount > 0`, restringe a lista aos profissionais compatíveis.
    - Se houver `searchTerm`, filtra por nome normalizado, cargo normalizado ou dígitos do CPF (`cpfNorm.includes(sDigits)`).
  - `exibicaoCooperados` (linhas 117–119): aplica `.slice(0, 40)` para garantir que o DOM nunca renderize mais de 40 linhas simultâneas no dropdown, mantendo 60fps mesmo com milhares de cooperados.
- **Linhas 121–368 (Renderização Visual do Seletor)**:
  - **Cabeçalho**: exibe contador `"X escalado(s)"` ou o aviso `"(Cota aberta para qualquer cooperado da categoria)"` quando nenhum cooperado específico é fixado.
  - **Chips de Cooperados Selecionados** (linhas 142–170): lista cada profissional designado com nome, cargo e botão `<X />` para remoção rápida.
  - **Input de Busca e Pílulas de Sugestões Rápidas** (linhas 173–235): campo de pesquisa com botão de limpar e chevron; quando o dropdown está fechado (`!isOpen`), exibe até 6 botões `"Sugeridos"` da especialidade (ainda não selecionados) permitindo escalar com 1 único clique.
  - **Dropdown Pesquisável** (linhas 238–364):
    - Barra de filtro permitindo alternar entre `"Filtrado por: <Especialidade>"` e `"Ver todos os cooperados"` (caso o gestor queira escalar um cooperado cujo cadastro no Bubble esteja sem cargo preenchido).
    - Lista rolável com checkboxes visuais, cargo, CPF e indicador `"Escalado"` / `"+ Escalar"`.
    - Aviso de paginação quando `cooperadosFiltrados.length > 40` e rodapé com botão `"Concluir Seleção"`.
