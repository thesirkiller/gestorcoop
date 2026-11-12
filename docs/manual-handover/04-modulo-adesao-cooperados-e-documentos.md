# Manual de Handover Técnico — Módulo 04: Adesão de Cooperados, Gestão Documental, Termos e Painel Financeiro

> **Escopo deste Documento**: Documentação técnica exaustiva (linha a linha, bloco a bloco e regra de negócio por regra de negócio) de todo o ecossistema de **Adesão Online de Sócio Cooperado**, **Validação de CPF/PIS e Conselhos de Classe**, **Upload Seguro com Comprovante Criptográfico HMAC**, **Geração e Versionamento de Termos de Adesão (jsPDF + ZapSign)**, **Aprovação e Gestão Documental pelo Gestor (Grade 2x2)** e **Painel Financeiro de Repasses, Escalas, Serviços e Emissão de RPA**.

---

## Sumário Executivo e Arquitetura Ponta-a-Ponta

```mermaid
flowchart TD
    subgraph FunilAdesao["1. Funil de Adesão do Cooperado (/adesao e /cooperado/adesao)"]
        A1["Etapa 1: Dados Pessoais\nValidação CPF (Módulo 11) + PIS (Módulo 11)\nGET /api/cooperado/verificar-cpf"] --> A2["Etapa 2: Endereço Residencial\nAuto-preenchimento ViaCEP"]
        A2 --> A3["Etapa 3: Profissões e Conselho\nValidação formato/entropia/UF/categoria\nPOST /api/cooperado/validar-conselho"]
        A3 --> A4["Etapa 4: Contas Bancárias\nMúltiplas contas Corrente/Poupança"]
        A4 --> A5["Etapa 5: Upload de Documentos\n6 Obrigatórios + 2 Opcionais\nPOST /api/cooperado/upload (HMAC-SHA256)"]
        A5 --> A6["Finalização da Adesão\nPOST /api/cooperado/adesao"]
    end

    subgraph BackendAdesao["2. Processamento BFF Edge (/api/cooperado/adesao)"]
        A6 --> B1{"CPF já existe\nno Bubble?"}
        B1 -- "Não" --> B2["Cria Cooperado no Bubble\ntxt_termo_status = 'Aguardando Assinatura'"]
        B1 -- "Sim e Aguardando Assinatura\n(Não bloqueado)" --> B3["Retomada: Deleta Profissões/Contas antigas\ne atualiza Cooperado"]
        B1 -- "Sim e Assinado/Aprovado\nou Bloqueado/Lista Negra" --> B4["Retorna HTTP 409 Conflict\ncode: CPF_JA_CADASTRADO"]
        B2 --> B5["Cria Sub-registros de Profissão (OS_profissao)\ne Contas Bancárias e vincula listas fks_*"]
        B3 --> B5
        B5 --> B6["Resolve Termo Ativo por Profissão -> Geral -> Fallback\nGera PDF paginado (jsPDF) e envia à ZapSign"]
        B6 --> A7["Etapa 6: Redirecionamento Automático\npara signUrl da ZapSign"]
    end

    subgraph PainelGestor["3. Painel do Gestor (/gestor/*)"]
        B6 --> G1["Dashboard de Adesões (/gestor/dashboard)\nListagem, Filtros, Sincronização ZapSign"]
        G1 --> G2["Modal Documentos 2x2\nGET/POST/PATCH/DELETE /api/gestor/cooperados/[id]/documentos"]
        G1 --> G3["Regerar Termo Manualmente\nPOST /api/gestor/cooperados/gerar-termo"]
        G1 --> G4["Aprovar Cooperado (quando Assinado)\nPOST /api/gestor/cooperados/aprovar\nCria Integralização + Atualiza Cooperativa + Log RH"]
        G5["Gestão de Termos (/gestor/termos)\nVersionamento automático v1 -> v2\nGET/POST /api/gestor/termos"] -.-> B6
        G4 --> G6["Painel Financeiro (/gestor/financeiro)\nContas, Escalas, Plantões, Edição de Valor,\nBaixa em Lote e Emissão de RPA (PDF/Print)"]
    end
```

---

## Parte 1 — Regras de Negócio Detalhadas do Domínio

### 1.1. Regra de Validação de CPF e Unicidade Cadastral
1. **Algoritmo de Dígitos Verificadores (Módulo 11)**:
   - Implementado em [`src/lib/cpf.ts`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/src/lib/cpf.ts#L1-L25) e compartilhado entre frontend e backend.
   - Remove todos os caracteres não numéricos (`\D`).
   - Rejeita qualquer string que não tenha exatamente 11 dígitos ou que possua todos os 11 dígitos idênticos (`/^(\d)\1{10}$/`, como `000.000.000-00` até `999.999.999-99`).
   - Calcula o 1º dígito verificador (`d1`) multiplicando os 9 primeiros dígitos por pesos decrescentes de `10` a `2`, aplicando `(soma * 10) % 11` (se `10`, vira `0`).
   - Calcula o 2º dígito verificador (`d2`) multiplicando os 10 primeiros dígitos por pesos decrescentes de `11` a `2`, aplicando `(soma * 10) % 11` (se `10`, vira `0`).
2. **Política de Unicidade e Retomada Inteligente de Cadastro por CPF**:
   - Cada CPF só pode possuir **um único** cadastro na cooperativa.
   - **Verificação Precoce (Etapa 1 do Funil)**: Ao clicar em "Avançar" na Etapa 1, o frontend consulta `GET /api/cooperado/verificar-cpf?cpf=<11_digitos>`.
     - A rota **nunca** expõe dados pessoais (nome, endereço, telefone, e-mail) do registro encontrado no Bubble (prevenção de vazamento de PII / enumeração de dados). Retorna exclusivamente `{ exists: boolean, termoStatus: string | null, bloqueado: boolean }`.
     - Se `exists === true`:
       - Caso `termoStatus === 'Aguardando Assinatura'` e `!bloqueado`: O usuário é **autorizado a prosseguir** com uma mensagem informativa amarela (`infoMsg`) avisando que seu cadastro anterior parou antes da assinatura e será atualizado com geração de um novo link da ZapSign ao finalizar.
       - Caso contrário (`termoStatus === 'Assinado'`, já aprovado ou `bloqueado === true`): O avanço é bloqueado imediatamente na Etapa 1 com erro orientando contato com a cooperativa.
     - Caso a consulta `GET /api/cooperado/verificar-cpf` falhe por instabilidade momentânea de rede/Bubble, ela retorna HTTP 200 com `{ exists: false, checkFailed: true }` para não travar o preenchimento inicial, pois a validação definitiva é repetida de forma transacional no `POST /api/cooperado/adesao`.
   - **Verificação Definitiva e Retomada no Envio (`POST /api/cooperado/adesao`)**:
     - Busca `bubbleApi.findCooperadoByCPF(cpfDigits(personalData.cpf))`.
     - Se o registro já existe:
       - Verifica `aguardandoAssinatura = (registro.txt_termo_status === 'Aguardando Assinatura')` e `bloqueado = (!!registro.bool_BLOQUEADO || !!registro.bool_listaNegra)`.
       - Se `!aguardandoAssinatura || bloqueado`, aborta com **HTTP 409 Conflict** (`code: 'CPF_JA_CADASTRADO'`).
       - Se `aguardandoAssinatura && !bloqueado`, ativa o modo **Retomada (`retomada = true`)**:
         1. Reaproveita o `_id` existente do cooperado.
         2. Busca todas as profissões (`getProfissoesByCooperado`) e contas bancárias (`getContasByCooperado`) vinculadas a tentativas anteriores daquele cooperado e **deleta todas** em paralelo (`deleteProfissao`, `deleteContaBancaria`) para evitar duplicação de sub-registros órfãos.
         3. Atualiza o registro do cooperado (`updateCooperado`) com o novo payload completo e recria as profissões, contas e documento na ZapSign.

---

### 1.2. Regra de Validação de PIS/PASEP/NIT/NIS (Módulo 11)
- Implementada em [`src/lib/validacao-conselho.ts`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/src/lib/validacao-conselho.ts#L149-L200) (`isValidPIS`, `pisDigits`, `formatarPIS`, `validarPIS`).
- O campo PIS no formulário de adesão é opcional, mas **se preenchido** (qualquer valor não vazio), é validado tanto em tempo real na UI (borda vermelha/verde aos 11 dígitos e feedback textual) quanto no bloqueio da Etapa 1 e no backend (`POST /api/cooperado/adesao` e `GET/POST /api/cooperado/validar-conselho`).
- **Algoritmo Oficial Módulo 11 do PIS**:
  1. Sanitiza para apenas dígitos (`\D`). Exige exatamente 11 dígitos e rejeita sequências de dígitos repetidos (`/^(\d)\1{10}$/`).
  2. Multiplica os 10 primeiros dígitos pelos pesos oficiais da Caixa/Dataprev: `[3, 2, 9, 8, 7, 6, 5, 4, 3, 2]`.
  3. Calcula `remainder = sum % 11`.
  4. Calcula `checkDigit = remainder < 2 ? 0 : 11 - remainder`.
  5. Compara `checkDigit === Number(digits[10])`.
  6. A máscara padrão aplicada por `formatarPIS` é `XXX.XXXXX.XX-X` (`digits.slice(0,3).digits.slice(3,8).digits.slice(8,10)-digits.slice(10,11)`).

---

### 1.3. Categorias Profissionais, Option Set do Bubble e Conselhos de Classe

#### 1.3.1. Armadilhas Reais do Option Set `OS_profissao` no Bubble (`src/lib/profissoes.ts`)
O banco legado no Bubble.io possui um Option Set chamado `"Profissões"` (campo `OS_profissao` na tabela `profissao` e lista `fks_profissoes` na tabela `cooperado`). Qualquer caractere divergente faz a Data API do Bubble rejeitar a requisição com **HTTP 400 `"could not parse"`**.

A auditoria em produção revelou 3 peculiaridades críticas tratadas por [`src/lib/profissoes.ts`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/src/lib/profissoes.ts#L1-L55):
1. **`'Técnico (a) de Enfermagem '` possui um espaço em branco no final** no Option Set do Bubble. Na UI (`PROFISSOES_FORM`), o `label` é exibido limpo (`'Técnico (a) de Enfermagem'`), mas o `value` mapeia para `'Técnico (a) de Enfermagem '`. No campo texto livre `txt_nome` da tabela `profissao`, usa-se `osValue?.trim() || prof.name` (sem o espaço final), enquanto em `OS_profissao` e `fks_profissoes` envia-se `osValue` exato (com o espaço final).
2. **`'Psicologo (a)'` não possui acento agudo** no Option Set do Bubble. Na UI (`PROFISSOES_FORM`), o `label` é `'Psicólogo (a)'`, mas o `value` é `'Psicologo (a)'`.
3. **Categoria genérica / administrativa / sem conselho específico**: No formulário exibe-se o rótulo `'Outros'`, cujo valor no Bubble é `'Outro (a)'`. A função `normalizeProfissaoBubble(name)` aplica normalização Unicode NFD (removendo acentos, espaços extras e caixa) e converte `'outro'` ou `'outros'` em `'Outro (a)'`. Caso um valor não tenha correspondência em `PROFISSOES_BUBBLE`, retorna `null` e o backend omite a propriedade `OS_profissao` do payload para nunca derrubar a adesão com erro 400.

#### 1.3.2. Matriz de Categorias Profissionais × Conselhos Aceitos (`src/lib/validacao-conselho.ts`)
A função [`conselhosAceitosPorProfissao(profissao)`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/src/lib/validacao-conselho.ts#L114-L136) classifica as profissões por nível e conselho de classe:

| Nível / Categoria | Profissão no Catálogo / Texto | Conselho(s) Aceito(s) | Sufixos / Modalidades Aceitos | Órgão e Portal Oficial de Consulta |
|---|---|---|---|---|
| **Nível Superior (Saúde)** | `Enfermeiro (a)` | `COREN` | Categoria obrigatória/inferida: `ENF` (também aceita modalidades `IS`, `IP`, `IR`, `REMIDO`, `SEC`, `PROV`, `OBST`, `PAR`) | COFEN / COREN (`cofen.gov.br/servicos-cofen/consulta-de-inscritos/`) |
| **Nível Técnico / Auxiliar (Enfermagem)** | `Técnico (a) de Enfermagem ` / Auxiliar de Enfermagem | `COREN` | Técnico: `TE` (normaliza `TEC` → `TE`)<br>Auxiliar: `AE` (normaliza `AUX` → `AE`) | COFEN / COREN (`cofen.gov.br/servicos-cofen/consulta-de-inscritos/`) |
| **Nível Superior (Medicina)** | `Médico (a)` | `CRM` | Sem sufixo de categoria (4 a 8 dígitos numéricos) | CFM / CRM (`portal.cfm.org.br/busca-medicos/`) |
| **Nível Superior (Reabilitação)** | `Fisioterapeuta` / Terapeuta Ocupacional | `CREFITO` | Opcional: `F` (Fisioterapeuta) ou `TO` (Terapeuta Ocupacional) | COFFITO / CREFITO (`coffito.gov.br/nsite/?page_id=3482`) |
| **Nível Superior (Nutrição)** | `Nutricionista` | `CRN` | Opcional: `P` (Principal), `S` (Secundário), `D` (Definitivo) | CFN / CRN (`cfn.org.br/index.php/consulta-nacional-de-nutricionistas/`) |
| **Nível Superior (Psicologia)** | `Psicologo (a)` | `CRP` | Permite prefixo de região de 2 dígitos antes do número (ex.: `CRP 06/248591`) | CFP / CRP (`cadastro.cfp.org.br/`) |
| **Nível Superior (Fonoaudiologia)** | `Fonoaudiólogo (a)` | `CRFA` ou `CREFONO` | Equivalentes entre si (não gera conflito se um vier no campo conselho e outro no número) | CFFa / CRFa (`fonoaudiologia.org.br/ache-um-fonoaudiologo/`) |
| **Nível Superior (Biomedicina)** | `Biomédico (a)` | `CRBM` | Opcional: `P`, `S` *(Nota: testado antes de `'medic'` para que `'biomedico'` não caia em `'CRM'`)* | CFBM / CRBM (`cfbm.gov.br/`) |
| **Nível Superior (Farmácia)** | `Farmacêutico (a)` | `CRF` | Sem sufixo específico | CFF / CRF (`site.cff.org.br/`) |
| **Nível Superior (Odontologia)** | Odontólogo / Dentista | `CRO` | Sem sufixo específico | CFO / CRO (`website.cfo.org.br/busca-profissionais/`) |
| **Nível Superior (Serviço Social)** | Assistente Social | `CRESS` | Sem sufixo específico | CFESS / CRESS (`cfess.org.br/`) |
| **Nível Técnico (Laboratório / Radiologia)** | `Técnico (a) de Laboratório` / Radiologia / Industrial | Laboratório: `CRBM`, `CRF`, `CRT`<br>Radiologia/Industrial: `CRT` | Sem sufixo específico | CFT / CRT (`cft.org.br/`) |
| **Genérico / Outras Categorias (`Outro (a)`)** | `Outro (a)` / `Outros` / Vazio | `null` (Aceita qualquer um dos 12 conselhos reconhecidos; sugere `COREN` como default inicial) | Conforme o conselho selecionado pelo usuário | Portal do respectivo conselho informado |

> **Observação Importante sobre Categorias Sem Conselho Específico / Administrativas**: No fluxo atual de adesão de cooperados da cooperativa de saúde (`POST /api/cooperado/adesao`), todo cooperado deve informar pelo menos uma profissão em `professions` e toda profissão passa por `validarRegistroConselho`, que exige uma sigla pertencente a `CONSELHOS_RECONHECIDOS` (`COREN`, `CRM`, `CREFITO`, `CRN`, `CRP`, `CRFA`, `CREFONO`, `CRBM`, `CRF`, `CRO`, `CRESS`, `CRT`), uma UF válida e um número de inscrição válido. Quando a profissão é `'Outro (a)'`, `conselhosAceitosPorProfissao` retorna `null`, permitindo que o profissional vincule qualquer um dos 12 conselhos reconhecidos sem restrição de cruzamento cargo × conselho.

#### 1.3.3. Regras de Validação Sintática, Semântica e Anti-Fraude de Registro no Conselho (`validarRegistroConselho` e `isNumeroRegistroSuspeito`)
1. **Caracteres Permitidos e Separador de Milhar**:
   - Apenas letras, números, espaços, hífens (`-`), barras (`/`) e pontos (`.`) são aceitos. Qualquer outro caractere especial reprova imediatamente.
   - Pontos (`.`) só são aceitos se formatarem exatamente grupos de 3 dígitos de milhar (ex.: `248.591`). Exemplo: `24.85.91` é rejeitado.
2. **Resolução e Cruzamento de UF**:
   - A UF pode vir no campo `uf`, embutida no campo `conselho` (ex.: `COREN-GO`) ou embutida no próprio campo `numero` (ex.: `COREN-GO 248591`).
   - Deve pertencer às 27 UFs oficiais do Brasil (`UFS_BRASIL`).
   - Se a UF for informada em dois lugares diferentes (ex.: campo `uf = "SP"` e `conselho = "COREN-GO"`), a validação falha acusando divergência.
   - **Desambiguação do token `"TO"`**: Como `"TO"` é tanto a sigla do estado do Tocantins quanto o sufixo de Terapeuta Ocupacional no `CREFITO`, se já houver uma `ufExplicita` informada e `"TO"` aparecer como o último token de um registro `CREFITO`, o parser o interpreta como a categoria `TO` (Terapeuta Ocupacional) em vez de sobrescrever a UF!
3. **Cruzamento Cargo × Categoria do COREN**:
   - Se o conselho for `COREN` e nenhuma categoria tiver sido digitada explicitamente, o sistema infere automaticamente a partir da profissão: `'tecnico'` → `'TE'`, `'auxiliar'` → `'AE'`, `'enfermeir'` → `'ENF'`.
   - Se a categoria foi informada (ex.: `482917-ENF`), o sistema bloqueia incompatibilidades:
     - `Técnico(a) de Enfermagem` com sufixo `ENF`, `AE` ou `OBST` → **Rejeitado** (esperado `TE`).
     - `Auxiliar de Enfermagem` com sufixo `ENF`, `TE` ou `OBST` → **Rejeitado** (esperado `AE`).
     - `Enfermeiro(a)` (nível superior) com sufixo `TE` ou `AE` → **Rejeitado** (esperado `ENF`).
4. **Heurísticas Anti-Fraude / Anti-Sequência (`isNumeroRegistroSuspeito`)**:
   - **Comprimento**: Exige entre `4` e `8` dígitos para `CRM`, e entre `4` e `9` dígitos para os demais conselhos.
   - **Zeros à esquerda excessivos**: Rejeita números que começam com 3 ou mais zeros (`/^0{3,}/`, ex.: `000123`) ou que, após remover zeros à esquerda, fiquem com menos de 3 dígitos significativos (ex.: `0012`, `000001`).
   - **Dígitos repetidos**: Rejeita todos os dígitos iguais (`111111`, `001111`) ou 4+ dígitos idênticos consecutivos (`111123`).
   - **Sequências monótonas (crescentes ou decrescentes)**: Rejeita sequências estritamente crescentes (`(prev + 1) % 10`) ou decrescentes (`(prev + 9) % 10`) no número inteiro, no número sem zeros à esquerda, ou em qualquer subsequência contígua de 5 ou mais dígitos (ex.: `123456`, `654321`, `001234`, `987654`, `123450`).
   - **Padrões periódicos curtos**: Rejeita repetições de blocos de 2 a 4 dígitos (`/^(\d{2,4})\1+$/`, ex.: `121212`, `123123`, `12341234`, `001212`).
   - **Baixa entropia em 5+ dígitos**: Se um mesmo dígito se repete `length - 1` vezes (ex.: `111112`, `999990`, `000012`), rejeita por combinação numérica inconsistente.
5. **Formatação Canônica de Saída**:
   - Todo registro aprovado é padronizado para `${conselhoFinal}-${ufFinal} ${numeroPrincipal}${sufixoCat}` (ex.: `COREN-GO 482917-ENF` ou `CRM-SP 148291`).

---

### 1.4. Matriz de Documentos Obrigatórios e Opcionais e Segurança de Upload

#### 1.4.1. Catálogo de Documentos (`src/lib/documentos.ts`)
O funil exige o envio separado de **6 documentos obrigatórios** e permite **2 documentos opcionais**:

| Chave (`TipoDocumentoAdesao`) | Rótulo Exibido ao Usuário (`TIPOS_DOCUMENTO`) | Obrigatoriedade | Regra de Validação |
|---|---|---|---|
| `identificacao` | `Identificação (RG ou CNH)` | **Obrigatório** | Deve possuir URL HTTPS distinta + comprovante HMAC válido |
| `conselho` | `Carteira Profissional (COREN / Conselho)` | **Obrigatório** | Deve possuir URL HTTPS distinta + comprovante HMAC válido |
| `certidao_regularidade` | `Certidão de Regularidade do COREN / Conselho` | **Obrigatório** | Deve possuir URL HTTPS distinta + comprovante HMAC válido |
| `certidao_negativa_criminal` | `Certidão Negativa Criminal` | **Obrigatório** | Deve possuir URL HTTPS distinta + comprovante HMAC válido |
| `residencia` | `Comprovante de endereço` | **Obrigatório** | Deve possuir URL HTTPS distinta + comprovante HMAC válido |
| `cartao_vacinacao` | `Cartão de vacinação` | **Obrigatório** | Deve possuir URL HTTPS distinta + comprovante HMAC válido |
| `cartao_sus_pis` | `Cartão do SUS / PIS (opcional)` | Opcional | Se enviado, também passa por validação de URL e HMAC |
| `outro` | `Outro documento de identificação social (opcional)` | Opcional | Tipo default inicial quando o arquivo acaba de subir no dropzone |

#### 1.4.2. Regras Físicas do Arquivo (`validarArquivoDocumento`)
- **Tamanho mínimo**: `> 0 bytes` (arquivos vazios de `0 bytes` são recusados com `'O arquivo está vazio. Selecione outro documento.'`).
- **Tamanho máximo**: `MAX_DOCUMENTO_BYTES = 10 * 1024 * 1024` (`10 MB`).
- **Dupla verificação de Formato (MIME Type + Extensão)**:
  - `file.type` deve ser `'application/pdf'`, `'image/jpeg'` ou `'image/png'`; **E**
  - `file.name` deve casar com `/\.(pdf|jpe?g|png)$/i`.

#### 1.4.3. Normalização de URL e Bloqueio de Arquivos Falsos (`normalizarUrlDocumento`)
- Aceita strings iniciadas por `https://` ou protocol-relative `//` (convertendo `//...` para `https://...`).
- **Rejeita** (`return null`):
  - Protocolos diferentes de `https:` (ex.: `http:`, `javascript:`, `data:`, `blob:`).
  - URLs contendo `username` ou `password` embutidos (`https://user:pass@host`).
  - URLs cujo `pathname` contenha `'mock-file-'` (impede que URLs de mock/teste ou uploads simulados que nunca chegaram ao storage real sejam aceitos como documentos válidos ou exibidos como links clicáveis no painel do gestor).

#### 1.4.4. Prova Criptográfica de Upload (`src/lib/comprovante-upload.ts`)
Para impedir que um atacante chame diretamente `POST /api/cooperado/adesao` injetando URLs arbitrárias na lista `uploadedFiles` sem ter feito upload real pelo servidor:
1. Quando `POST /api/cooperado/upload` conclui o envio do arquivo para o storage do Bubble e recebe a `fileUrl`, o servidor chama `criarComprovanteUpload(fileUrl)`.
2. `criarComprovanteUpload` importa a chave secreta `process.env.BUBBLE_API_TOKEN` via Web Crypto API (`crypto.subtle.importKey`, algoritmo `HMAC` com `SHA-256`), define `expires = Date.now() + 7 * 24 * 60 * 60 * 1000` (validade de **7 dias**, compatível com a retenção do rascunho no `localStorage`), assina a string `${expires}:${url}` e retorna o token no formato `<expires_ms>.<assinatura_hex_64_chars>`.
3. Na finalização (`POST /api/cooperado/adesao`), além de exigir que todas as URLs sejam distintas (`new Set(documentUrls).size === documents.length`), o servidor executa `verificarComprovanteUpload(urlNormalizada, file.comprovante)` para **cada** arquivo anexado. Se qualquer comprovante tiver expirado, tiver sido adulterado ou não corresponder à URL exata, a adesão é recusada com HTTP 400.

---

### 1.5. Geração, Versionamento e Assinatura do Termo de Adesão

1. **Versionamento Automático por Profissão (`POST /api/gestor/termos`)**:
   - Os termos ficam armazenados na tabela `termos` do Bubble com os campos `txt_titulo`, `txt_conteudo`, `txt_profissao`, `num_versao` e `bool_ativo`.
   - Quando o gestor salva um novo termo para uma `txt_profissao` (comparação case-insensitive e sem espaços nas pontas):
     - O sistema localiza todos os termos existentes daquela mesma profissão.
     - Calcula `newVersion = maxVersion + 1` (iniciando em `1` se for o primeiro).
     - Desativa (`bool_ativo: false`) todas as versões anteriores daquela profissão que estavam ativas.
     - Cria a nova versão com `num_versao: newVersion` e `bool_ativo: true`.
2. **Resolução Dinâmica do Template (`montarTermoResolvido` em `src/lib/termo-template.ts`)**:
   - Prioridade 1: Busca um termo com `bool_ativo === true` cuja `txt_profissao` coincida (case-insensitive) com qualquer uma das profissões do cooperado (`profissoesList`).
   - Prioridade 2: Se não encontrar específico, busca um termo ativo cuja `txt_profissao` seja `'geral'` ou `'todos'`.
   - Prioridade 3: Qualquer termo com `bool_ativo === true`.
   - Prioridade 4 (Fallback Estático): Constante `DEFAULT_TERMO_MULTCARE` (documento jurídico completo de 10 páginas separadas por `[PAGE_BREAK]` cobrindo Declaração de Partes, Dúvidas Frequentes sobre Cooperativismo, Proposta de Admissão com cota-parte de R$ 100,00 em até 4x, Termo de Responsabilidade, Declaração de Palestra, Termo de Compromisso, Políticas das Leis 5.764/71 e 12.690/12, Disponibilidade/Recusa de Plantões com aviso prévio de 72h, Ciência de EPI NR-32 e Aceite Eletrônico).
   - Substitui 14 variáveis dinâmicas (case-insensitive): `{nome}`, `{nomeCompleto}`, `{rg}`, `{cpf}`, `{dataNascimento}`, `{estadoCivil}`, `{endereco}`, `{profissoes}`, `{nomeMae}`, `{nomePai}`, `{pis}`, `{email}`, `{telefone}`, `{matricula}`, `{dataAtual}`.
3. **Renderização PDF Multi-Página (`jsPDF`) e Integração ZapSign**:
   - Divide o texto resolvido pelo delimitador `[PAGE_BREAK]`.
   - Em cada página lógica, desenha o cabeçalho institucional `'MULTCARE - COOPERATIVA DE TRABALHO'`, numeração `'Página X de Y'` e linha horizontal (`doc.line(15, 18, 195, 18)`).
   - Faz word-wrap automático (`doc.splitTextToSize(..., 180)`) começando em `y = 30` com espaçamento `lineSpacing = 5`. Se o texto de uma seção ultrapassar `bottomLimit = 275`, cria automaticamente uma página de continuação (`Página X (cont.) de Y`) repetindo o cabeçalho.
   - Converte o PDF para Base64 e envia para `zapsignApi.createDocument`, passando `external_id: cooperadoId` e `webhook_url` apontando para `/api/webhooks/zapsign`.
   - Valida que a `sign_url` retornada pela ZapSign é HTTPS, pertence ao domínio `zapsign.com.br` (ou `*.zapsign.com.br`) e possui path `/sign/<token>` ou `/verificar/<token>`.

---

### 1.6. Ciclo de Vida de Status do Cooperado, Gestão Documental e Aprovação RH

1. **Os 4 Estágios do Cooperado no Painel do Gestor (`/gestor/dashboard`)**:
   - **Sem Termo** (`!c.txt_termo_status && !c.fk_usuario`): Cooperado cadastrado no banco sem termo gerado.
   - **Aguardando Assinatura** (`c.txt_termo_status === 'Aguardando Assinatura' && !c.fk_usuario`): Termo enviado à ZapSign, pendente de assinatura pelo cooperado. Permite clicar em **Sincronizar** (`GET /api/webhooks/zapsign?cooperadoId=...`) ou **Regerar Termo**.
   - **Em Análise (Assinado)** (`c.txt_termo_status === 'Assinado' && !c.fk_usuario`): Cooperado já assinou na ZapSign; o botão verde **Aprovar** fica habilitado para o gestor.
   - **Aprovado** (`!!c.fk_usuario`): Cooperado aprovado pelo RH.
2. **Orquestração da Aprovação (`POST /api/gestor/cooperados/aprovar`)**:
   Ao aprovar um cooperado (`id`), o backend executa 4 passos sequenciais:
   - **Passo 1 — Integralização de Capital Social**: Lê da cooperativa (`getCooperativa`) a quantidade de parcelas (`num_qtd_parcelas` ou `zz_n_deparcelas_number`, default `1`) e o valor total (`num_valor_integralizacao` ou `zz_valor_total_da_integraliza__o_number`, default `0`), e cria um registro na tabela `integralizacao` (`createIntegralizacao`) com `bool_pago: false`.
   - **Passo 2 — Vínculo na Lista de Membros da Cooperativa**: Se o `id` do cooperado ainda não estiver no array `fks_cooperados` da cooperativa, adiciona-o via `updateCooperativa`.
   - **Passo 3 — Ativação do Cooperado**: Atualiza o cooperado (`updateCooperado`) preenchendo `fk_usuario = '1632307664083x948858892871476400'` (ID de usuário Bubble que marca o cooperado como aprovado) e `fk_integralização = integralizacaoId`.
   - **Passo 4 — Log de Auditoria RH**: Cria um registro em `logs_gerais` (`createLogGeral`) com `txt_acontecimento: "Aprovou o cadastro do cooperado <Nome>"`, `bool_tipo: "Log Rh"` e `bool_escala_fora: true`.
3. **Gestão Documental pelo Gestor (`ModalDocumentosCooperado` e `/api/gestor/cooperados/[id]/documentos`)**:
   - Exibe todos os arquivos de `fks_pasta` e `file_termo_assinado` em grade 2x2 com filtros por tipo (`Todos`, `Fotos`, `PDFs & Arquivos`) e Lightbox de tela cheia para imagens.
   - Sinaliza anexos corrompidos ou de mock (`disponivel: false` quando `normalizarUrlDocumento(url) === null`) com alerta vermelho `"Arquivo perdido"`, ocultando links quebrados e permitindo ao gestor **Trocar** (`PATCH`) ou **Remover** (`DELETE`) qualquer anexo, ou **Adicionar Documento** (`POST`).
   - Se o documento substituído ou removido for o próprio `file_termo_assinado`, o backend atualiza ou limpa sincronizadamente tanto o array `fks_pasta` quanto o campo `file_termo_assinado`.

---

### 1.7. Regras de Negócio do Painel Financeiro (`/gestor/financeiro`)

1. **Fluxo de Apuração por Período, Cooperado e Escala**:
   - Inicializa por padrão o filtro de datas com o **1º dia** (`YYYY-MM-01`) e o **último dia** (`new Date(year, month, 0).getDate()`) do mês corrente.
   - Carrega em background a lista completa de cooperados (`/api/gestor/cooperados`) e de escalas (`/api/gestor/financeiro/escalas`) usando paginação automática (`fetchFullDataset`).
   - Ao selecionar um cooperado e possuir datas completas (`startDate.length === 10 && endDate.length === 10`), busca em paralelo:
     - Os serviços/plantões do cooperado no período (`GET /api/gestor/financeiro/servicos?cooperadoId=...&startDate=...&endDate=...`).
     - As contas bancárias vinculadas ao cooperado (`GET /api/gestor/financeiro/contas?cooperadoId=...`).
   - Permite filtrar os serviços no cliente por múltiplas escalas (`selectedEscalas`) e pelo intervalo exato de timestamp (`T00:00:00` a `T23:59:59` sobre `date_fixa_entrada`).
2. **Métricas Financeiras dos Plantões Filtrados**:
   - **Serviços Filtrados (`metricTotalServicos`)**: Quantidade total de plantões após os filtros.
   - **Prontos p/ Repasse (`metricProntos`)**: Soma de `num_valor_cooperado` dos serviços com `bool_confirmacao_finalizado === true && !bool_pago`.
   - **Aguardando Confirmação (`metricAguardando`)**: Soma de `num_valor_cooperado` dos serviços com `!bool_confirmacao_finalizado && !bool_pago`.
   - **Já Repassados / Pago (`metricPagos`)**: Soma de `num_valor_cooperado` dos serviços com `bool_pago === true`.
   - **Total Selecionado a Pagar (`selectedSum`)**: Soma de `num_valor_cooperado` dos serviços **não pagos** (`!bool_pago`) marcados com checkbox na tabela.
3. **Edição Inline de Valores e Baixa em Lote**:
   - Serviços ainda não pagos (`!serv.bool_pago`) permitem edição inline do campo `num_valor_cooperado` via `PATCH /api/gestor/financeiro/servicos`.
   - O botão **Marcar como Pago** executa `PATCH /api/gestor/financeiro/servicos` (`{ servicoId, bool_pago: true }`) em paralelo (`Promise.all`) para todos os plantões selecionados pendentes de pagamento.
4. **Cálculo e Emissão de RPA (Recibo de Pagamento de Autônomo)**:
   - **Seleção Inteligente para RPA (`rpaSelectedServicos`)**:
     - Se houver serviços não pagos selecionados (`selectedUnpaidServicos.length > 0`), o RPA utiliza esses serviços.
     - Caso **todos** os serviços filtrados do período já estejam pagos (`unpaidFilteredIds.length === 0`), o sistema faz fallback automático para `filteredServicos`, permitindo reemitir/exportar o RPA de períodos já quitados!
   - **Trava Matemática de Retenções/Descontos**:
     - `rpaValorBruto` = soma de `num_valor_cooperado` de `rpaSelectedServicos`.
     - `rawDescontos = Math.max(0, parseFloat((rpaRetencoes || '0').replace(',', '.')) || 0)` (impede descontos negativos e aceita vírgula ou ponto decimal).
     - `rpaValorDescontos = Math.min(rpaValorBruto, rawDescontos)` (impede que o desconto supere o valor bruto).
     - `rpaValorLiquido = Math.max(0, rpaValorBruto - rpaValorDescontos)`.
   - **Dupla Saída (PDF Nativo `jsPDF` + Impressão A4 CSS `@media print`)**:
     - Gera arquivo `RPA_<Nome_Sanitizado>_<DataInicio>_a_<DataFim>.pdf` com cabeçalho institucional da Multcare, quadro duplo Fonte Pagadora × Favorecido (incluindo dados bancários), tabela paginada de plantões com zebra striping, quadro de resumo financeiro (Bruto, Retenções, Líquido), Declaração de Quitação jurídica e linha de assinatura com rodapé numerado (`Página X de Y`).

---

## Parte 2 — Análise Exaustiva das Bibliotecas (`src/lib/*`)

### 2.1. [`src/lib/cpf.ts`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/src/lib/cpf.ts)

Biblioteca pura de validação e sanitização de CPF compartilhada entre componentes React e rotas Edge API.

- **Linhas 1–6 (`isValidCPF` - Sanitização e Guardas Iniciais)**:
  - `const digits = cpf.replace(/\D/g, '');` (Linha 3): Remove pontos, traços e quaisquer caracteres não numéricos.
  - `if (digits.length !== 11) return false;` (Linha 4): Garante tamanho exato de 11 dígitos.
  - `if (/^(\d)\1{10}$/.test(digits)) return false;` (Linha 5): Expressão regular com backreference `\1` que bloqueia sequências homogêneas (`00000000000`, `11111111111`, etc.), que passariam matematicamente na fórmula do Módulo 11 se não fossem barradas.
- **Linhas 7–14 (Helper interno `calcCheckDigit`)**:
  - Recebe a substring `base` (9 ou 10 dígitos) e o peso inicial `factor` (`10` ou `11`).
  - Itera sobre cada caractere de `base`, somando `Number(digit) * factor--`.
  - Calcula `const rest = (sum * 10) % 11;` e retorna `rest === 10 ? 0 : rest;`.
- **Linhas 16–20 (Verificação de `d1` e `d2`)**:
  - Linha 16–17: Calcula `d1` sobre `digits.substring(0, 9)` com fator `10`. Se `d1 !== Number(digits[9])`, retorna `false`.
  - Linha 18–19: Calcula `d2` sobre `digits.substring(0, 10)` com fator `11`. Retorna `d2 === Number(digits[10])`.
- **Linhas 22–24 (`cpfDigits`)**:
  - Retorna `cpf.replace(/\D/g, '')`, usado para normalizar o CPF antes de buscas no Bubble (`findCooperadoByCPF`).

---

### 2.2. [`src/lib/profissoes.ts`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/src/lib/profissoes.ts)

Mapeamento e normalização de profissões para compatibilidade estrita com o Option Set do Bubble.

- **Linhas 1–18 (`PROFISSOES_BUBBLE`)**:
  - Tupla `readonly` com os 11 valores literais exatos do Option Set `"Profissões"` no Bubble:
    `'Biomédico (a)'`, `'Enfermeiro (a)'`, `'Farmacêutico (a)'`, `'Fisioterapeuta'`, `'Fonoaudiólogo (a)'`, `'Médico (a)'`, `'Nutricionista'`, `'Outro (a)'`, `'Psicologo (a)'`, `'Técnico (a) de Enfermagem '`, `'Técnico (a) de Laboratório'`.
- **Linhas 20–33 (`PROFISSOES_FORM`)**:
  - Array de objetos `{ label, value }` consumido pelo `<select>` da Etapa 3 do funil de adesão. Corrige a exibição visual para o usuário (`label: 'Técnico (a) de Enfermagem'` sem espaço final; `label: 'Psicólogo (a)'` com acento; `label: 'Outros'`) preservando no `value` a string exata exigida pelo Bubble.
- **Linhas 35–41 (`fold`)**:
  - Função interna de normalização canônica: aplica `.normalize('NFD')`, remove diacríticos Unicode (`/[\u0300-\u036f]/g`), colapsa múltiplos espaços em um só (`.replace(/\s+/g, ' ')`), aplica `.trim()` e `.toLowerCase()`.
- **Linhas 47–54 (`normalizeProfissaoBubble`)**:
  - Recebe qualquer string vinda do cliente (inclusive rascunhos antigos do `localStorage`).
  - Se `fold(name)` for vazio, retorna `null`.
  - Procura em `PROFISSOES_BUBBLE` um item cujo `fold(p) === target`. Se encontrar, retorna a string exata do Bubble (com espaço final ou sem acento, conforme o caso).
  - Se `target === 'outro' || target === 'outros'`, retorna `'Outro (a)'`.
  - Caso contrário, retorna `null` para que o chamador omita o campo `OS_profissao`.

---

### 2.3. [`src/lib/validacao-conselho.ts`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/src/lib/validacao-conselho.ts)

Motor de validação de registros em conselhos profissionais e de PIS/PASEP.

- **Linhas 4–10 (`UFS_BRASIL` e `UFBrasil`)**:
  - Constante e tipo com as 27 siglas estaduais brasileiras.
- **Linhas 12–27 (`CONSELHOS_RECONHECIDOS` e `ConselhoProfissional`)**:
  - Lista dos 12 conselhos suportados: `'COREN'`, `'CRM'`, `'CREFITO'`, `'CRN'`, `'CRP'`, `'CRFA'`, `'CREFONO'`, `'CRBM'`, `'CRF'`, `'CRO'`, `'CRESS'`, `'CRT'`.
- **Linhas 29–53 (`CATEGORIAS_COREN`, `SUFIXOS_MODALIDADE_COREN`, `SUFIXOS_OUTROS_CONSELHOS`)**:
  - Define as categorias do COREN (`ENF`, `TE`, `TEC`, `AE`, `AUX`, `OBST`, `PAR`), os sufixos administrativos de inscrição do COREN (`IS`, `IP`, `IR`, `REMIDO`, `SEC`, `PROV`) e os sufixos permitidos para `CREFITO` (`F`, `TO`), `CRN` (`P`, `S`, `D`) e `CRBM` (`P`, `S`).
- **Linhas 55–104 (`LINKS_CONSULTA_CONSELHO`)**:
  - Dicionário que mapeia cada `ConselhoProfissional` para `{ orgao, url }`, fornecendo os links diretos de consulta pública exibidos nas Etapas 3 e 5 da adesão.
- **Linhas 106–108 (`isValidUF`)**:
  - Type guard que verifica se o valor é string e se `.trim().toUpperCase()` pertence a `UFS_BRASIL`.
- **Linhas 114–144 (`conselhosAceitosPorProfissao` e `conselhoPorProfissao`)**:
  - Normaliza o nome da profissão sem acentos e em minúsculas.
  - Retorna `null` se vazio ou contiver `'outro'`.
  - Avalia `'biomedic'` (`['CRBM']`) antes de `'medic'` (`['CRM']`) na linha 123 para evitar falso positivo de substring.
  - Mapeia `'enferm'` → `['COREN']`, `'fisioterap'`/`'terapeuta ocupacional'` → `['CREFITO']`, `'nutricion'` → `['CRN']`, `'psicolog'` → `['CRP']`, `'fonoaudiol'` → `['CRFA', 'CREFONO']`, `'farmaceut'` → `['CRF']`, `'odont'`/`'dentist'` → `['CRO']`, `'assistent'` + `'social'` → `['CRESS']`, `'radiolog'`/`'industrial'` → `['CRT']`, `'laborator'` → `['CRBM', 'CRF', 'CRT']`.
  - `conselhoPorProfissao` retorna o primeiro conselho aceito ou `'COREN'` como fallback.
- **Linhas 149–200 (`isValidPIS`, `pisDigits`, `formatarPIS`, `validarPIS`)**:
  - Implementa o cálculo Módulo 11 do PIS com pesos `[3, 2, 9, 8, 7, 6, 5, 4, 3, 2]` (linhas 149–164), extração de dígitos (166–168), formatação `XXX.XXXXX.XX-X` (170–174) e objeto de resposta completo `{ valid, valido, digits, pisFormatado, error }` (176–200).
- **Linhas 202–279 (`isSequenciaMonotona`, `contemSubsequenciaSequencialLonga`, `isNumeroRegistroSuspeito`)**:
  - `isSequenciaMonotona` (202–213): Verifica se uma string de tamanho `>= 4` avança sempre `+1 mod 10` ou retrocede `-1 mod 10` (`(prev + 9) % 10`).
  - `contemSubsequenciaSequencialLonga` (215–222): Verifica janelas deslizantes de tamanho `5` procurando sequências monótonas dentro de números maiores.
  - `isNumeroRegistroSuspeito` (228–279): Valida se `digits` é numérico (229), se tem entre 4 e 8 (`CRM`) ou 9 dígitos (233–238), se não tem zeros à esquerda excessivos (240–243), se não tem dígitos repetidos (246–248), se não é sequência monótona (251–257), se não é padrão repetitivo de 2 a 4 dígitos (260–262) e se tem entropia mínima em 5+ dígitos (265–276).
- **Linhas 281–328 (Interfaces `ValidacaoConselhoInput`, `ResultadoValidacaoConselho` e helper `falhaValidacao`)**:
  - Padroniza o retorno tanto em português (`valido`, `motivo`) quanto em inglês (`valid`, `error`) e inclui `exigeCertidaoRegularidade: true`, `consultaUrl` e `orgao`.
- **Linhas 334–637 (`validarRegistroConselho`)**:
  - **Linhas 346–361**: Suporta sobrecarga de parâmetros (string única, múltiplos argumentos posicionais ou objeto `ValidacaoConselhoInput`).
  - **Linhas 363–381**: Rejeita registro vazio, caracteres proibidos e pontos fora do padrão de milhar.
  - **Linhas 383–415**: Extrai sigla e UF eventual do campo `rawConselho` (ex.: `"COREN-GO"`), valida `rawUf` e impede conflito entre `rawUf` e `ufDoConselho`.
  - **Linhas 417–479**: Remove pontos de milhar legítimos, divide o número em tokens por `[\s\-\/]+` e classifica cada token em: sigla de conselho inicial (435), bloco numérico (441), erro de mistura alfanumérica no mesmo token como `12345ENF` sem separador (447), UF válida (462) ou categoria reconhecida do conselho com normalização `TEC` → `TE` e `AUX` → `AE` (467–468).
  - **Linhas 483–510**: Impede divergência entre o conselho informado no campo separado e o prefixo digitado no número (exceto equivalência `CRFA` ↔ `CREFONO`), valida `conselhoFinal` e verifica compatibilidade com `rawProfissao`.
  - **Linhas 512–536**: Exige `ufFinal` válida e extrai `numeroPrincipal` (permitindo 2 blocos numéricos apenas para `CRP` quando o primeiro tem 2 dígitos de região, ex.: `CRP 06/248591`).
  - **Linhas 538–608**: Valida e infere `categoriaFinal` e executa a checagem cruzada entre profissão de enfermagem (Enfermeiro vs Técnico vs Auxiliar) e a categoria do COREN (`ENF` vs `TE` vs `AE`).
  - **Linhas 610–636**: Executa `isNumeroRegistroSuspeito`, monta `registroFormatado = "${conselhoFinal}-${ufFinal} ${numeroPrincipal}${sufixoCat}"` e retorna o objeto aprovado.

---

### 2.4. [`src/lib/documentos.ts`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/src/lib/documentos.ts)

Regras de tipos de documento, normalização segura de URLs, checklist de pendências e validação de arquivos.

- **Linhas 1–28 (`MAX_DOCUMENTO_BYTES`, `TIPOS_DOCUMENTO`, `TIPOS_DOCUMENTO_OBRIGATORIOS`, `TIPOS_DOCUMENTO_OPCIONAIS`)**:
  - Define o limite de `10 MB` (`10 * 1024 * 1024`), o mapa dos 8 tipos de documento e os arrays de obrigatórios (6 itens) e opcionais (2 itens).
- **Linhas 29–38 (`DocumentoAdesao` e `isTipoDocumentoValido`)**:
  - Interface `{ url, name, tipo, comprovante }` e type guard com `Object.prototype.hasOwnProperty.call(TIPOS_DOCUMENTO, tipo)`.
- **Linhas 40–49 (`normalizarUrlDocumento`)**:
  - Converte URLs iniciadas com `//` para `https://`, faz parse com `new URL(...)` e rejeita qualquer URL que não seja `https:`, que contenha `username`/`password` ou cujo `pathname` inclua `'mock-file-'`.
- **Linhas 51–67 (`documentosObrigatoriosPendentes`)**:
  - Percorre a lista de arquivos enviados ignorando itens sem `comprovante`, com tipo inválido, com URL inválida ou com **URL duplicada** (`urlsUsadas.has(urlNorm)` — impede que o mesmo arquivo/URL satisfaça dois tipos obrigatórios).
  - Retorna os rótulos legíveis (`TIPOS_DOCUMENTO[tipo]`) dos tipos obrigatórios ainda não atendidos.
- **Linhas 69–76 (`validarArquivoDocumento`)**:
  - Valida `file.size === 0`, `file.size > MAX_DOCUMENTO_BYTES`, MIME type (`application/pdf`, `image/jpeg`, `image/png`) e extensão (`/\.(pdf|jpe?g|png)$/i`).
- **Linhas 78–82 (`nomeDocumento`)**:
  - Extrai o último segmento do path da URL antes de `?` ou `#` e aplica `decodeURIComponent` com fallback seguro.

---

### 2.5. [`src/lib/comprovante-upload.ts`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/src/lib/comprovante-upload.ts)

Assinatura e verificação HMAC-SHA256 de comprovantes de upload.

- **Linhas 3–8 (`key`)**:
  - Lê `process.env.BUBBLE_API_TOKEN`. Se ausente, lança `'Armazenamento de documentos não configurado.'`.
  - Importa a chave raw na Web Crypto API (`crypto.subtle.importKey`) para operações `['sign', 'verify']` com `HMAC` / `SHA-256`.
- **Linhas 10–14 (`criarComprovanteUpload`)**:
  - Define `expires = Date.now() + 7 * 24 * 60 * 60 * 1000` (7 dias).
  - Assina `${expires}:${url}` e converte o `ArrayBuffer` resultante em string hexadecimal de 64 caracteres precedida por `${expires}.`.
- **Linhas 16–26 (`verificarComprovanteUpload`)**:
  - Verifica se `receipt` é string com exatamente 2 partes separadas por `.`.
  - Valida formato numérico de `expires`, se `Number(expires) >= Date.now()` (não expirado) e se `signature` possui 64 caracteres hexadecimais (`/^[a-f0-9]{64}$/`).
  - Reconstrói o `Uint8Array` da assinatura e executa `crypto.subtle.verify('HMAC', await key(), bytes, encoder.encode("${expires}:${url}"))` em tempo constante.

---

### 2.6. [`src/lib/empresas-contratantes.ts`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/src/lib/empresas-contratantes.ts)

Catálogo de empresas contratantes / cooperativas do grupo, resolução de identidade visual e utilitários de data/idade.

- **Linhas 1–59 (`EmpresaContratanteId`, `EmpresaContratante`, `EMPRESAS_CONTRATANTES`, `EMPRESA_PADRAO`)**:
  - Define as 3 entidades oficiais:
    1. `verdes-mares` (`Verdes Mares Home Care` — `HOME CARE DE ASSISTÊNCIA INTEGRAL`, CNPJ `54.800.169/0001-55`, cor `#0d9488` / `teal`). Definida como `EMPRESA_PADRAO`.
    2. `multi` (`Multcare Home Care` — `MULTCARE COOPERATIVA DE TRABALHO DOS PROFISSIONAIS DE SAÚDE`, CNPJ `32.450.918/0001-20`, cor `#0284c7` / `sky`).
    3. `isa` (`Isa Care Assistência Domiciliar` — `ISA CARE SAÚDE E ASSISTÊNCIA DOMICILIAR INTEGRAL`, CNPJ `18.920.340/0001-88`, cor `#059669` / `emerald`).
- **Linhas 66–116 (`identificarEmpresaContratante` e `obterEmpresaContratante`)**:
  - Normaliza o texto removendo acentos e identifica a empresa por palavras-chave, variações históricas (`serramaris`, `unicare`, `multi-saude`, `isacare`) ou prefixos de CNPJ (`54.800.169`, `32.450.918`, `11.426.910`, `18.920.340`).
  - `obterEmpresaContratante` retorna a empresa identificada ou `EMPRESA_PADRAO`.
- **Linhas 118–170 (`salvarEmpresaContratanteLocal`, `lerEmpresaContratanteLocal`, `salvarSexoPacienteLocal`, `lerSexoPacienteLocal`)**:
  - Persistência segura em `window.localStorage` sob os prefixos `gestorcoop:empresa_contratante:` (por ID e por `nome:<nome_normalizado>`) e `gestorcoop:paciente_sexo:`.
- **Linhas 179–197 (`resolverEmpresaDoPaciente`)**:
  - Resolve na ordem: `paciente.empresa_contratante` → `paciente.plano_saude` → `localStorage` → `EMPRESA_PADRAO`.
- **Linhas 202–264 (`calcularIdadePaciente`, `dataTesteInvalida`, `formatarDataNascimentoBr`)**:
  - Suporta datas `YYYY-MM-DD`, `DD/MM/YYYY` ou ISO, valida calendário real (rejeitando datas inexistentes como `31/02` via `dataTesteInvalida`) e calcula a idade exata entre `0` e `129 anos`.

---

## Parte 3 — Análise Exaustiva das Rotas de API do Cooperado (`src/app/api/cooperado/*`)

### 3.1. [`src/app/api/cooperado/adesao/route.ts`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/src/app/api/cooperado/adesao/route.ts)
- **Runtime**: `edge` (Linha 13).
- **Linhas 15–36 (Desestruturação e Validação Básica)**:
  - Extrai `{ personalData, addressData, professions, bankAccounts, uploadedFiles }`.
  - Exige `personalData.nomeCompleto` e `personalData.cpf` (400).
  - Valida `isValidCPF(personalData.cpf)` (400).
  - Se `personalData.pis` foi enviado e não é vazio, valida `isValidPIS(String(personalData.pis))` (400).
  - Exige `addressData`, `professions.length > 0`, `bankAccounts.length > 0` e `personalData.email?.trim()` (400).
- **Linhas 38–68 (Validação de Profissões e Conselhos)**:
  - Itera por `professions`, acionando `validarRegistroConselho` para cada item. Se qualquer profissão for inválida, aborta com HTTP 400 e a mensagem de erro específica do conselho.
  - Acumula em `profissoesValidas` já com `registration: validacaoConselho.registroFormatado`.
- **Linhas 70–88 (Validação de Documentos, Unicidade de URLs e Comprovantes HMAC)**:
  - Verifica se `uploadedFiles` é array de objetos válidos e se todos têm `isTipoDocumentoValido(file.tipo)`.
  - Verifica `documentosObrigatoriosPendentes(documents)`: se houver pendências, retorna HTTP 400 com `{ error, pendentes: missing }`.
  - Normaliza todas as URLs com `normalizarUrlDocumento` e exige que nenhuma seja `null` e que `new Set(documentUrls).size === documents.length` (impede reaproveitar a mesma URL para dois documentos).
  - Executa `Promise.all(documents.map((file, index) => verificarComprovanteUpload(documentUrls[index]!, file.comprovante)))`. Se qualquer comprovante falhar, retorna HTTP 400.
- **Linhas 90–120 (Montagem do `cooperadoPayload`)**:
  - Formata `fullAddress` e monta o payload para a tabela `cooperado` do Bubble vinculando `fk_Cooperativa = '1632239151449x283019207795015680'`, `bool_listaNegra: false`, `bool_BLOQUEADO: false`, `txt_termo_status: 'Aguardando Assinatura'` e `fks_pasta: documentUrls`.
- **Linhas 122–175 (Verificação de Duplicidade de CPF e Retomada Transacional)**:
  - Consulta `bubbleApi.findCooperadoByCPF(cpfDigits(personalData.cpf))`.
  - Se existir e (`txt_termo_status !== 'Aguardando Assinatura'` ou `bool_BLOQUEADO` ou `bool_listaNegra`), retorna HTTP 409 com `code: 'CPF_JA_CADASTRADO'`.
  - Se existir e estiver aguardando assinatura sem bloqueio: define `retomada = true`, busca e apaga todas as profissões e contas bancárias anteriores do cooperado e executa `bubbleApi.updateCooperado(cooperadoId, cooperadoPayload)`.
  - Se não existir: cria o registro com `bubbleApi.createCooperado(cooperadoPayload)`.
- **Linhas 177–225 (Criação de Profissões, Contas Bancárias e Amarração de Listas)**:
  - Para cada item de `profissoesValidas`, normaliza `osValue = normalizeProfissaoBubble(prof.name)`, cria o registro em `profissao` (`bubbleApi.createProfissao`) e guarda `professionIds` e `professionOptionNames`.
  - Para cada conta bancária, converte `'Poupança'` em `'Conta Poupança'` (ou `'Conta Corrente'`), cria em `contabancaria` (`bubbleApi.createContaBancaria`) e guarda `bankAccountIds`.
  - Atualiza o cooperado com `'fks_Profissões ': professionIds`, `'fks_ContasBancarias': bankAccountIds` e `'fks_profissoes': professionOptionNames`.
- **Linhas 226–320 (Resolução do Termo e Geração do PDF com `jsPDF`)**:
  - Busca `bubbleApi.getTermos()` (com fallback silencioso em caso de erro) e chama `montarTermoResolvido`.
  - Instancia `new jsPDF()`, divide o texto por `[PAGE_BREAK]`, desenha cabeçalho e paginação em cada página (incluindo páginas de overflow quando `y > 275`) e extrai `pdfBase64`.
- **Linhas 321–364 (Criação do Documento na ZapSign e Resposta)**:
  - Chama `zapsignApi.createDocument("Termo de Adesão - <Nome>", pdfBase64, nomeCompleto, email, cooperadoId)`.
  - Em caso de falha na ZapSign, retorna HTTP 502 informando que os dados foram salvos e orientando tentar finalizar novamente (o que acionará a retomada automática pelo CPF!).
  - Em caso de sucesso, retorna `{ success: true, cooperadoId, retomada, docToken, signUrl }`.

---

### 3.2. [`src/app/api/cooperado/me/route.ts`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/src/app/api/cooperado/me/route.ts)
- **Runtime**: `edge`, `dynamic = 'force-dynamic'` (Linhas 7–8).
- **Linhas 10–22 (`formatarProfissao`)**:
  - Converte códigos internos de cargo/profissão (`Tecnico_Enfermagem`, `Medico`, `Terapeuta`, etc.) para rótulos amigáveis (`'Técnico(a) de Enfermagem'`, `'Médico(a)'`, `'Terapeuta Ocupacional'`, `'Enfermeiro(a)'`, `'Fisioterapeuta'`, `'Fonoaudiólogo(a)'`, `'Nutricionista'`, `'Psicólogo(a)'`).
- **Linhas 30–102 (`GET`)**:
  - Valida a sessão via `obterSessaoCooperado(request)`. Se ausente, retorna HTTP 401.
  - Busca o registro completo do cooperado no Bubble (`bubbleApi.getCooperado(sessao.cooperadoId)`).
  - Sobrescreve `nome`, `profissao`, `email` e `cpf` com os dados atualizados do Bubble, se disponíveis.
  - **Cascata de Resolução de Foto de Perfil (Linhas 63–84)**:
    1. Tenta campos diretos: `cooperado.img_foto || cooperado.foto || cooperado.file_foto || cooperado.foto_perfil`.
    2. Se não houver, procura na lista `cooperado.fks_pasta` a primeira URL cuja extensão (ignorando query string) seja `.jpg`, `.jpeg`, `.png` ou `.webp`.
    3. Se ainda não houver e existir `cooperado.fk_usuario`, busca `bubbleApi.getUser(cooperado.fk_usuario)` e lê `user.img_foto`.
    4. Normaliza prefixo `//` para `https://`.
  - Retorna JSON com `{ success: true, autenticado: true, cooperadoId, userId, nome, cargo, profissao, email, cpf, foto }`.

---

### 3.3. [`src/app/api/cooperado/upload/route.ts`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/src/app/api/cooperado/upload/route.ts)
- **Runtime**: `edge` (Linha 6).
- **Linhas 8–19**: Lê `formData.get('file')`. Se ausente ou string, retorna 400. Executa `validarArquivoDocumento(file)` (bloqueando arquivos vazios, `> 10 MB` ou fora de PDF/JPEG/PNG com HTTP 400).
- **Linhas 20–34**: Converte o `ArrayBuffer` do arquivo byte a byte para string binária e codifica em Base64 (`btoa(binary)`), enviando ao storage do Bubble via `bubbleApi.uploadFile(filename, base64Contents)`.
- **Linhas 35–46**: Gera o recibo criptográfico com `await criarComprovanteUpload(fileUrl)` e retorna `{ success: true, url: fileUrl, name: filename, comprovante }`. Erros de storage retornam HTTP 502.

---

### 3.4. [`src/app/api/cooperado/validar-conselho/route.ts`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/src/app/api/cooperado/validar-conselho/route.ts)
- **Runtime**: `edge` (Linha 4).
- **Linhas 6–20 (`extrairParametrosUrl`)**: Aceita aliases tanto em português quanto em inglês na query string (`conselho`/`council`, `uf`/`estado`, `numero`/`registration`/`registro`, `categoria`/`category`, `profissao`/`profession`, `pis`).
- **Linhas 22–48 (`GET`) e Linhas 50–90 (`POST`)**:
  - Executam `validarRegistroConselho(...)`.
  - Se o parâmetro/propriedade `pis` também tiver sido fornecido, executam `validarPIS(pis)` e combinam o resultado (`valid = resultado.valid && pisResult.valid`), anexando o sub-objeto `pis: pisResult` e retornando HTTP 200 se ambos forem válidos ou HTTP 400 caso contrário.

---

### 3.5. [`src/app/api/cooperado/verificar-cpf/route.ts`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/src/app/api/cooperado/verificar-cpf/route.ts)
- **Runtime**: `edge` (Linha 5).
- **Linhas 10–38 (`GET`)**:
  - Lê `searchParams.get('cpf')` e valida com `isValidCPF(cpf)` (retorna 400 se inválido).
  - Consulta `bubbleApi.findCooperadoByCPF(cpfDigits(cpf))`.
  - Se não encontrar, retorna `{ exists: false }`.
  - Se encontrar, retorna apenas `{ exists: true, termoStatus: registro.txt_termo_status || null, bloqueado: !!registro.bool_BLOQUEADO || !!registro.bool_listaNegra }`.
  - Em caso de exceção na comunicação com o Bubble, registra log e retorna `{ exists: false, checkFailed: true }` com status 200 para degradação graciosa.

---

## Parte 4 — Análise Exaustiva das Rotas de API do Gestor (`src/app/api/gestor/*`)

### 4.1. [`src/app/api/gestor/me/route.ts`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/src/app/api/gestor/me/route.ts)
- **Linhas 10–31 (`GET`)**:
  - Lê o cookie `gestor_session` (`cookies().get('gestor_session')?.value`). Se ausente, retorna HTTP 401.
  - Busca o usuário no Bubble (`bubbleApi.getUser(userId)`), normaliza `img_foto` se começar com `//` para `https://` e retorna `{ nome: user?.txt_nome || 'Gestor', email: user?.authentication?.email?.email || '', foto }`.
  - Se a chamada ao Bubble falhar, retorna perfil genérico `{ nome: 'Gestor', email: '', foto: null }` (HTTP 200) para nunca quebrar a renderização do cabeçalho `GestorShell`.

---

### 4.2. [`src/app/api/gestor/cooperados/route.ts`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/src/app/api/gestor/cooperados/route.ts)
- **Linhas 7–26 (`GET`)**:
  - Suporta dois modos de operação:
    1. **Paginado** (quando `cursor` ou `limit` estão presentes na query string): valida que `cursor` é inteiro `>= 0` e `limit` é inteiro entre `1` e `100` (retorna HTTP 400 `'Paginação inválida.'` se violado). Chama `bubbleApi.getCooperados(cursor, limit)` e retorna `{ success: true, data }`.
    2. **Completo** (sem parâmetros): chama `bubbleApi.getCooperados()` e retorna `{ success: true, data }`.
  - Em caso de erro, retorna HTTP 502 com mensagem amigável.

---

### 4.3. [`src/app/api/gestor/cooperados/aprovar/route.ts`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/src/app/api/gestor/cooperados/aprovar/route.ts)
- **Linhas 6–32**: Lê `{ id }` do body (400 se ausente). Busca `bubbleApi.getCooperado(id)` (404 se não localizado). Resolve `cooperativaId` (default `'1632239151449x283019207795015680'`) e busca as configurações da cooperativa (`bubbleApi.getCooperativa(cooperativaId)`), extraindo `numQtdParcelas` e `numValorIntegralizacao`.
- **Linhas 33–49 (Passo 1 - Integralização)**: Cria registro via `bubbleApi.createIntegralizacao` com `{ fk_cooperado: id, fk_cooperativa: cooperativaId, 'fk_qtd_parcelas ': Number(numQtdParcelas), num_valor: Number(numValorIntegralizacao), bool_pago: false }` (nota: o campo `'fk_qtd_parcelas '` no Bubble possui espaço no final).
- **Linhas 51–64 (Passo 2 - Lista da Cooperativa)**: Verifica se `id` já consta em `fks_cooperados` da cooperativa; se não, faz append via `bubbleApi.updateCooperativa`.
- **Linhas 66–75 (Passo 3 - Vínculo de Usuário e Integralização)**: Atualiza o cooperado com `fk_usuario: '1632307664083x948858892871476400'` e, se criada, `'fk_integralização': integralizacaoId`.
- **Linhas 77–93 (Passo 4 - Auditoria RH)**: Registra log em `logs_gerais` (`bubbleApi.createLogGeral`) com `txt_acontecimento: "Aprovou o cadastro do cooperado ${cooperadoNome}"`, `bool_tipo: "Log Rh"`, `bool_escala_fora: true`.

---

### 4.4. [`src/app/api/gestor/cooperados/gerar-termo/route.ts`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/src/app/api/gestor/cooperados/gerar-termo/route.ts)
- Permite ao gestor gerar ou regerar manualmente o Termo de Adesão para qualquer cooperado já cadastrado no Bubble.
- **Linhas 9–33**: Lê `{ id }`, busca `bubbleApi.getCooperado(id)` (404 se não existir) e valida presença de `txt_nomeCompleto` e `txt_CPF` (400 se incompletos).
- **Linhas 34–61**: Busca termos ativos (`bubbleApi.getTermos()`) e invoca `montarTermoResolvido` passando os campos do cooperado no Bubble (`txt_nomeCompleto`, `txt_rg`, `txt_CPF`, `date_dataNascimento`, `txt_estadoCivil`, `txt_endereco`, `txt_nomeMae`, `txt_nomePai`, `txt_pis`, `txt_email`, `txt_whatsapp`, `txt_telefone`, `matricula: cooperado._id || cooperado.id`, `profissoes: cooperado.fks_profissoes`).
- **Linhas 63–127**: Gera o PDF multi-página com `jsPDF` (mesmo layout padronizado da adesão) e extrai `pdfBase64`.
- **Linhas 129–162**: Cria o documento na ZapSign (`zapsignApi.createDocument`), atualiza `txt_termo_status: 'Aguardando Assinatura'` no Bubble (`bubbleApi.updateCooperado`) e retorna `{ success: true, cooperadoId: id, docToken, signUrl }`.

---

### 4.5. [`src/app/api/gestor/cooperados/[id]/documentos/route.ts`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/src/app/api/gestor/cooperados/%5Bid%5D/documentos/route.ts)
Gerencia todo o ciclo de vida (CRUD) dos documentos e fotos da pasta de um cooperado (`fks_pasta` e `file_termo_assinado`).

- **Linhas 8–39 (`parseDocumentInfo`)**:
  - Avalia `urlNormalizada = normalizarUrlDocumento(safeUrl)` e define `disponivel = urlNormalizada !== null`.
  - Extrai nome do arquivo e extensão, classifica em `isImage` (`jpg`, `jpeg`, `png`, `webp`, `gif`, `bmp`, `svg`) ou `isPdf` (`pdf` ou URL contendo `zapsign`) e define `typeLabel` (`'Termo Assinado'`, `'Foto / Imagem'`, `'Documento PDF'` ou `'Documento'`).
- **Linhas 42–82 (`GET`)**:
  - Busca o cooperado no Bubble (`bubbleApi.getCooperado(params.id)`).
  - Mapeia `fks_pasta` através de `parseDocumentInfo(url, url === termoAssinadoUrl)`.
  - Se `file_termo_assinado` existir e não estiver dentro de `fks_pasta`, insere-o no topo da lista (`documents.unshift(...)`).
- **Linhas 85–152 (`POST` — Adicionar Documento)**:
  - Suporta tanto upload binário (`multipart/form-data`, validando o arquivo com `validarArquivoDocumento` e enviando ao Bubble via `bubbleApi.uploadFile`) quanto JSON (`{ url, filename }`).
  - Busca a lista atual `fks_pasta` do cooperado e, se a `fileUrl` ainda não estiver presente, faz append e salva via `bubbleApi.updateCooperado(cooperadoId, { fks_pasta: updatedPasta })`.
- **Linhas 155–204 (`DELETE` — Remover Documento)**:
  - Aceita a URL a remover via body JSON (`{ url }`) ou query string (`?url=...`).
  - Filtra `fks_pasta` removendo `urlToDelete`.
  - Se `cooperado.file_termo_assinado === urlToDelete`, também limpa `updatePayload.file_termo_assinado = ''`.
  - Atualiza o cooperado no Bubble e retorna `{ success: true, remainingCount }`.
- **Linhas 207–290 (`PATCH` — Substituir Documento)**:
  - Suporta `multipart/form-data` (`file` + `oldUrl`, validando com `validarArquivoDocumento` e subindo novo arquivo no Bubble) ou JSON (`{ oldUrl, newUrl }`).
  - Substitui `oldUrl` por `newUrl` na mesma posição do array `fks_pasta` (ou faz push se `oldUrl` era apenas o `file_termo_assinado`).
  - Se `cooperado.file_termo_assinado === oldUrl`, atualiza `updatePayload.file_termo_assinado = newUrl`.

---

### 4.6. [`src/app/api/gestor/termos/route.ts`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/src/app/api/gestor/termos/route.ts)
- **Linhas 7–26 (`GET`)**:
  - Busca todos os termos (`bubbleApi.getTermos()`) e ordena por `txt_profissao` (ordem alfabética `localeCompare`) e, dentro da mesma profissão, por `num_versao` decrescente (`b.num_versao - a.num_versao`).
- **Linhas 28–78 (`POST`)**:
  - Valida presença de `txt_titulo`, `txt_conteudo` e `txt_profissao` (400).
  - Busca todos os termos existentes, filtra os que têm a mesma `txt_profissao` (case-insensitive), calcula `newVersion = maxVersion + 1`, desativa em paralelo todas as versões anteriores ativas (`updateTermo(t._id!, { bool_ativo: false })`) e cria a nova versão ativa (`createTermo`).

---

### 4.7. Rotas da API Financeira (`src/app/api/gestor/financeiro/*`)

1. **[`src/app/api/gestor/financeiro/contas/route.ts`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/src/app/api/gestor/financeiro/contas/route.ts#L1-L25)**:
   - `GET`: Exige query param `cooperadoId` (400 se ausente). Chama `bubbleApi.getContasBancariasByCooperado(cooperadoId)` e retorna `{ success: true, data: list }`.
2. **[`src/app/api/gestor/financeiro/escalas/route.ts`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/src/app/api/gestor/financeiro/escalas/route.ts#L1-L31)**:
   - `GET`: Se receber `cursor` ou `limit`, faz busca paginada via `bubbleApi.getEscalas(cursor, limit)`; caso contrário, busca lista completa `bubbleApi.getEscalas()`.
3. **[`src/app/api/gestor/financeiro/servicos/route.ts`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/src/app/api/gestor/financeiro/servicos/route.ts#L1-L46)**:
   - `GET` (Linhas 7–26): Exige `cooperadoId` (400 se ausente) e lê opcionalmente `startDate` e `endDate`. Chama `bubbleApi.getServicosByCooperado(cooperadoId, startDate, endDate)` e retorna `{ success: true, data: list }`.
   - `PATCH` (Linhas 28–45): Lê `{ servicoId, ...fields }` do body. Exige `servicoId` (400 se ausente). Chama `bubbleApi.updateServico(servicoId, fields)` (usado tanto para atualizar `num_valor_cooperado` quanto para marcar `bool_pago: true`).


---

## Parte 5 — Análise Exaustiva das Páginas e Componentes React

### 5.1. [`src/app/adesao/page.tsx`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/src/app/adesao/page.tsx)
Rota pública dedicada de tela cheia para o subdomínio/canal de cooperação (`cooperacao.gestorcoop.app` ou `/adesao`).

- **Linhas 1–6**: Importa `AdesaoPage` de `@/app/cooperado/adesao/page` e exporta `metadata` de SEO (`title: 'GestorCoop - Ficha de Inscrição & Adesão'`).
- **Linhas 8–14**: Renderiza `<AdesaoPage />` diretamente na raiz, isolado de cascas mobile do aplicativo de cooperados.

---

### 5.2. [`src/app/cooperado/adesao/page.tsx`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/src/app/cooperado/adesao/page.tsx) (1.756 linhas)
Componente cliente (`'use client'`) que implementa o wizard completo de 6 etapas de inscrição e adesão de cooperados.

#### Bloco A — Tipagens, Constantes de Persistência e Ajuda Contextual (Linhas 50–125)
- **Linhas 51–66**: Define as interfaces `Profession` (`name`, `council`, `uf`, `consultaUrl`, `registration`, `emissionDate`, `isPrincipal`) e `BankAccount` (`bank`, `agency`, `account`, `type`).
- **Linhas 70–74**:
  - `PROGRESS_STORAGE_KEY = 'gc_adesao_progress_v1'`: chave versionada no `localStorage` para salvar o rascunho completo do formulário.
  - `PROGRESS_COOKIE = 'gc_adesao_step'`: cookie leve (7 dias de validade, `max-age=604800`) que armazena apenas o número da etapa atual.
  - `SUPORTE_WHATSAPP` e `SUPORTE_EMAIL`: lidos de variáveis de ambiente `NEXT_PUBLIC_SUPORTE_*`.
- **Linhas 77–124 (`HELP_BY_STEP`)**: Dicionário com dicas específicas para cada uma das 6 etapas exibido no modal flutuante de Ajuda.

#### Bloco B — Estados do Wizard e Persistência / Retomada de Rascunho (Linhas 126–264)
- **Linhas 127–196**:
  - Estados de controle: `currentStep` (`1` a `6`), `loading` (ViaCEP), `submitting`, `errorMsg`, `infoMsg`, `checkingCpf`, `helpOpen`, `resumed` (banner indicando que o progresso foi restaurado), `hydrated`, `signUrl`.
  - Estado `personalData` (17 campos da Etapa 1, com defaults `orgaoUF: 'GO'`, `sexo: 'Feminino'`, `estadoCivil: 'Solteiro(a)'`, `grauEscolaridade: 'Superior Completo'`, `racaCor: 'Branca'`).
  - Estado `addressData` (7 campos da Etapa 2, default `estado: 'GO'`).
  - Estado `professions` e rascunho `currentProf` (default `name: 'Enfermeiro (a)'`, `council: 'COREN'`, `uf: 'GO'`, `isPrincipal: true`).
  - Estado `bankAccounts` e rascunho `currentBank` (default `bank: '341\tItaú Unibanco S.A.'`, `type: 'Conta Corrente'`).
  - Estado `uploadedFiles` (`DocumentoAdesao[]`), `uploading` e cálculo derivado `pendingDocuments = documentosObrigatoriosPendentes(uploadedFiles)`.
- **Linhas 201–220 (Hidratação do Rascunho)**:
  - No mount, lê `localStorage.getItem(PROGRESS_STORAGE_KEY)`. Se existir e `saved.currentStep` estiver entre `1` e `5`, restaura `personalData`, `addressData`, `professions`, `bankAccounts` e filtra `uploadedFiles` mantendo apenas aqueles com `normalizarUrlDocumento(file.url)` válido e `file.comprovante` presente. Ativa `setResumed(true)`.
- **Linhas 222–239 (Auto-Save em Tempo Real)**:
  - Sempre que qualquer estado muda (enquanto `currentStep < 6`), grava o snapshot JSON no `localStorage` e atualiza o cookie `gc_adesao_step`.
- **Linhas 241–254 (`clearProgress` e `restartForm`)**:
  - `clearProgress()` apaga a chave do `localStorage` e expira o cookie (`max-age=0`).
  - `restartForm()` pede confirmação (`window.confirm`), limpa o progresso e recarrega a página (`window.location.reload()`).
- **Linhas 257–264 (Auto-Redirect ZapSign)**:
  - Quando `currentStep === 6 && signUrl`, dispara um `setTimeout` de `2000ms` para redirecionar `window.location.href = signUrl`.

#### Bloco C — Máscaras, ViaCEP e Manipulação de Listas e Uploads (Linhas 266–461)
- **Linhas 267–298**: Formatadores de máscara para CPF (`000.000.000-00`), PIS (`000.00000.00-0`), Telefone/WhatsApp (`(00) 00000-0000`) e CEP (`00000-000`).
- **Linhas 313–349 (`handleAddressChange` e `fetchAddress`)**:
  - Ao digitar o 8º dígito numérico do CEP, consulta `https://viacep.com.br/ws/${cep}/json/` e preenche automaticamente `rua` (`logradouro`), `bairro`, `cidade` (`localidade`) e `estado` (`uf`).
- **Linhas 352–399 (`addProfession` e `removeProfession`)**:
  - Exige `currentProf.registration` preenchido.
  - Se `currentProf.isPrincipal` for `true`, desmarca `isPrincipal` das profissões anteriores.
  - Executa `validarRegistroConselho` localmente; se inválido, exibe `errorMsg` e aborta.
  - Dispara validação em background para `/api/cooperado/validar-conselho` e adiciona a profissão formatada (`validacao.registroFormatado` e `validacao.consultaUrl`) à lista.
- **Linhas 402–418 (`addBankAccount` e `removeBankAccount`)**:
  - Exige `agency` e `account` preenchidos e adiciona à lista `bankAccounts`.
- **Linhas 421–461 (`onDrop` e `useDropzone`)**:
  - Configura `react-dropzone` aceitando `image/jpeg`, `image/png` e `application/pdf`, `minSize: 1`, `maxSize: MAX_DOCUMENTO_BYTES` (10 MB).
  - Envia cada arquivo via `POST /api/cooperado/upload`, valida a URL retornada com `normalizarUrlDocumento` e a presença de `res.data.comprovante`, e adiciona ao estado `uploadedFiles` com `tipo: 'outro'` inicial para que o cooperado selecione a categoria correspondente no `<select>` de cada arquivo.

#### Bloco D — Navegação entre Etapas e Submissão Final (Linhas 464–572)
- **Linhas 464–531 (`nextStep`)**:
  - **Etapa 1**: Exige `nomeCompleto`, `cpf`, `email`, `whatsapp`; valida `isValidCPF` e (se preenchido) `isValidPIS`; chama `GET /api/cooperado/verificar-cpf`. Se o CPF já existir e não estiver em `'Aguardando Assinatura'` (ou estiver bloqueado), bloqueia o avanço com erro. Se estiver em `'Aguardando Assinatura'`, exibe `infoMsg` explicando a retomada.
  - **Etapa 2**: Exige `cep`, `rua`, `numero` e `cidade`.
  - **Etapa 3**: Exige `professions.length > 0`.
  - **Etapa 4**: Exige `bankAccounts.length > 0`.
  - **Etapa 5**: Exige `pendingDocuments.length === 0` e aciona `submitAllData()`.
- **Linhas 538–572 (`submitAllData`)**:
  - Envia `POST /api/cooperado/adesao` com `{ personalData, addressData, professions, bankAccounts, uploadedFiles }`.
  - Valida que `res.data.success`, `normalizarUrlDocumento(res.data.signUrl)` e `res.data.docToken` estão presentes, limpa o rascunho (`clearProgress()`), avança para a Etapa 6 (`setCurrentStep(6)`) e agenda redirecionamento para `signUrl`.

#### Bloco E — Renderização Visual das 6 Etapas e Modal de Ajuda (Linhas 574–1755)
- **Linhas 588–681**: Cabeçalho institucional e barra de progresso interativa (permite clicar em etapas já concluídas `st.num < currentStep` para voltar e revisar dados).
- **Linhas 685–716**: Banners de retomada de rascunho (`resumed` com botão `"Recomeçar do zero"`), aviso de retomada de CPF (`infoMsg`) e alertas de erro (`errorMsg`).
- **Linhas 728–972 (Render Etapa 1)**: Inputs de Dados Pessoais com validação visual instantânea do PIS/PASEP (linhas 955–968).
- **Linhas 975–1076 (Render Etapa 2)**: Inputs de Endereço com spinner do ViaCEP.
- **Linhas 1080–1271 (Render Etapa 3)**: Formulário de adição de profissão (auto-sugerindo o conselho ao trocar a profissão via `conselhoPorProfissao` na linha 1103 e exibindo link direto para consulta pública do conselho nas linhas 1166–1181) + lista de profissões cadastradas com selo `"Formato Validado"`.
- **Linhas 1274–1393 (Render Etapa 4)**: Formulário de adição de conta bancária (7 bancos principais pré-configurados com código COMPE separado por `\t`) + lista de contas.
- **Linhas 1396–1552 (Render Etapa 5)**: Checklist visual interativo dos 6 documentos obrigatórios (verde com `CheckCircle` quando anexado com comprovante válido, âmbar com `AlertCircle` quando pendente) e 2 opcionais, link para emissão da Certidão de Regularidade no conselho principal, área de Drag & Drop e lista de arquivos carregados com `<select>` individual para classificar o tipo de cada documento.
- **Linhas 1555–1596 (Render Etapa 6)**: Tela de confirmação `"Ficha de Inscrição Enviada!"` com indicador de redirecionamento automático e botão manual `"Ir para Assinatura"`.
- **Linhas 1645–1752**: Botão flutuante `"Ajuda"` e modal com instruções da etapa atual + botões de contato via WhatsApp (`wa.me`) e E-mail (`mailto:`).

---

### 5.3. [`src/app/gestor/_components/GestorShell.tsx`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/src/app/gestor/_components/GestorShell.tsx) (330 linhas)
Layout mestre (Sidebar + Header) de todas as páginas autenticadas do Painel do Gestor.

- **Linhas 39–70 (`NAV_SECTIONS`)**:
  - Organiza a navegação lateral em 4 seções:
    1. `Clínico & Pacientes`: Prontuários (`/gestor/prontuarios`, badge `360°`) e Auditoria Clínica (`/gestor/prontuarios/auditoria`).
    2. `Cooperados`: Adesões (`/gestor/dashboard`) e Termos (`/gestor/termos`).
    3. `Equipamentos`: Equipamentos, Romaneios, Manutenção, Baixas e Relatórios.
    4. `Financeiro`: Financeiro (`/gestor/financeiro`).
- **Linhas 90–132**:
  - Restaura estado de colapso da sidebar de `localStorage.getItem('gc_sidebar_collapsed')`.
  - Carrega o perfil do gestor logado via `GET /api/gestor/me`.
  - Implementa `handleLogout` chamando `POST /api/auth/logout` e redirecionando para `/login`.
- **Linhas 135–138 (`activeItem`)**:
  - Ordena os itens de navegação pelo comprimento do `href` decrescente antes do `.find()` para que rotas filhas (como `/gestor/prontuarios/auditoria`) não sejam engolidas pela rota pai (`/gestor/prontuarios`).

---

### 5.4. [`src/app/gestor/dashboard/page.tsx`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/src/app/gestor/dashboard/page.tsx) (1.134 linhas)
Painel principal de gestão de adesões de cooperados.

- **Linhas 30–56 (`interface Cooperado`)**: Mapeia todos os campos da tabela `cooperado` do Bubble, incluindo `fks_pasta`, `fk_usuario`, `fks_profissoes`, `'fks_Profissões '`, `'fks_ContasBancarias'`, `txt_termo_status` e `file_termo_assinado`.
- **Linhas 71–91 (`openDocsModal` e `handleDocumentsChanged`)**:
  - Abre o `ModalDocumentosCooperado` e sincroniza alterações de anexos em tempo real na tabela principal e no modal de detalhes sem precisar recarregar toda a página.
- **Linhas 114–131 (`fetchData`)**:
  - Usa `fetchFullDataset<Cooperado>('/api/gestor/cooperados', ...)` para buscar todas as páginas de cooperados do Bubble.
- **Linhas 139–175 (`filteredCooperados` e Paginação)**:
  - Filtra por busca textual (`txt_nomeCompleto`, `txt_CPF`, `txt_email`), por profissão (`selectedProfession` contida em `c.fks_profissoes`) e por status (`sem_termo`, `aguardando_assinatura`, `em_analise`, `aprovados`).
  - Pagina em blocos de `itemsPerPage = 15`.
- **Linhas 178–181 (KPIs Globais)**:
  - Calcula `totalSubmissions`, `waitingSignatureCount` (`txt_termo_status === 'Aguardando Assinatura' && !fk_usuario`), `underAnalysisCount` (`txt_termo_status === 'Assinado' && !fk_usuario`) e `approvedCount` (`!!fk_usuario`).
- **Linhas 190–268 (Ações Operacionais)**:
  - `handleGerarTermo(id)`: Chama `POST /api/gestor/cooperados/gerar-termo`, guarda a `signUrl` retornada em `generatedLinks[id]` e atualiza o status local para `'Aguardando Assinatura'`.
  - `handleCopyLink(id, link)`: Copia o link da ZapSign para a área de transferência.
  - `handleSyncTermo(id)`: Chama `GET /api/webhooks/zapsign?cooperadoId=${id}` para consultar ativamente a ZapSign caso o webhook não tenha chegado e recarrega a lista se assinado.
  - `approveCooperado(id)`: Chama `POST /api/gestor/cooperados/aprovar` e marca localmente `fk_usuario: 'approved-user-id'`.
- **Linhas 285–309**: Botão `"Copiar Link de Adesão"` que usa `obterUrlCooperacao()` (`src/lib/subdominios.ts`) para copiar o link público do funil de adesão.
- **Linhas 759–1113 (Modal de Ficha de Inscrição Detalhada)**:
  - Exibe todos os dados pessoais, endereço, profissões, quantidade de contas bancárias e a seção de Documentos & Assinaturas, bloqueando links inválidos (`!normalizarUrlDocumento(url)`) com badge vermelho `"Arquivo perdido — pedir reenvio"` ou `"Arquivo indisponível — gerar novamente"`.

---

### 5.5. [`src/app/gestor/dashboard/_components/ModalDocumentosCooperado.tsx`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/src/app/gestor/dashboard/_components/ModalDocumentosCooperado.tsx) (667 linhas)
Modal especializado em visualização em grade 2x2, lightbox de imagens e substituição/exclusão/adição de documentos do cooperado.

- **Linhas 48–77 (`parseDoc`)**:
  - Classifica cada URL da pasta do cooperado. Se `normalizarUrlDocumento(safeUrl)` retornar `null`, marca `disponivel: false` para exibir alerta de arquivo corrompido/perdido em vez de renderizar imagem quebrada ou link que daria erro `AccessDenied` no storage.
- **Linhas 89–99**: Combina `termoAssinadoUrl` (no topo, se existir) e `initialDocuments` sem duplicatas (`new Set(...)`).
- **Linhas 133–218 (`handleAddFile`, `handleReplaceFile`, `handleDeleteDocument`)**:
  - `handleAddFile`: Envia `POST /api/gestor/cooperados/${cooperadoId}/documentos` (`multipart/form-data`), adiciona o novo item ao estado e notifica o componente pai via `onDocumentsChange`.
  - `handleReplaceFile`: Envia `PATCH /api/gestor/cooperados/${cooperadoId}/documentos` com `file` + `oldUrl` (`replacingUrl`), substituindo o documento na mesma posição da grade.
  - `handleDeleteDocument`: Exige confirmação em duas etapas na UI (`confirmDeleteUrl === doc.url`) e envia `DELETE /api/gestor/cooperados/${cooperadoId}/documentos` com `{ data: { url } }`.
- **Linhas 295–335**: Abas de filtro rápido: `Todos (N)`, `Fotos (totalImages)` e `PDFs & Arquivos (totalDocs)`.
- **Linhas 380–564**: Grade 2x2 (`grid-cols-1 md:grid-cols-2`) com preview visual de imagens (com tratamento de `onError` adicionando a URL a `failedPreviews`), destaque verde para o `Termo Assinado` e botões de ação (`Ver` / `Ver PDF`, `Trocar`, `Remover`).
- **Linhas 584–663**: Lightbox fullscreen para imagens com navegação circular (`ChevronLeft` / `ChevronRight`) e botão de download do arquivo original.

---

### 5.6. [`src/app/gestor/termos/page.tsx`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/src/app/gestor/termos/page.tsx) (729 linhas)
Interface de administração, versionamento e preview em PDF dos Termos de Adesão.

- **Linhas 59–114**: Busca `/api/gestor/termos`, extrai profissões únicas (`uniqueProfessions`), filtra por título/conteúdo e profissão e pagina em 10 itens por página.
- **Linhas 116–137 (`helperVariables` e `handleCopyVariable`)**:
  - Painel lateral no editor que lista os 14 placeholders dinâmicos (`{nome}`, `{rg}`, `{cpf}`, `{dataNascimento}`, `{estadoCivil}`, `{endereco}`, `{profissoes}`, `{nomeMae}`, `{nomePai}`, `{pis}`, `{email}`, `{telefone}`, `{matricula}`, `{dataAtual}`) com cópia em 1 clique.
- **Linhas 149–164 (`handleCreateNewVersion`)**:
  - Carrega o título, a profissão (detectando se pertence às profissões comuns ou se deve abrir o campo customizado `'Outro'`) e o conteúdo do termo selecionado no modal de edição para criar uma nova versão.
- **Linhas 166–250 (`handlePreviewTermoPDF`)**:
  - Substitui todas as variáveis do termo por dados fictícios (`FULANO DE TAL DA SILVA`, CPF `123.456.789-00`, etc.), processa as quebras `[PAGE_BREAK]` no `jsPDF` com a marcação `(PREVIEW)` no cabeçalho e abre o PDF em nova aba (`window.open(doc.output('bloburl'), '_blank')`).
- **Linhas 253–282 (`handleSubmit`)**:
  - Envia `POST /api/gestor/termos` com `{ txt_titulo, txt_conteudo, txt_profissao }`, disparando o versionamento automático no backend.

---

### 5.7. [`src/app/gestor/financeiro/page.tsx`](file:///c:/Users/admin/Documents/projetos/gestorcoop/temp-app/src/app/gestor/financeiro/page.tsx) (1.344 linhas)
Painel de apuração de produção cooperativa, gestão de plantões/serviços, repasses financeiros e emissão de RPA.

- **Linhas 64–79 (`getFirstDayOfMonth` e `getLastDayOfMonth`)**: Calcula os limites do mês atual no formato `YYYY-MM-DD`.
- **Linhas 110–172 (Inicialização e Busca por Cooperado/Período)**:
  - No mount, carrega todos os cooperados (`/api/gestor/cooperados`) e todas as escalas (`/api/gestor/financeiro/escalas`) via `fetchFullDataset`.
  - Quando `selectedCooperadoId`, `startDate` e `endDate` estão definidos, busca os serviços (`/api/gestor/financeiro/servicos`) e contas bancárias (`/api/gestor/financeiro/contas`) do cooperado e reseta seleções e retenções do RPA.
- **Linhas 178–248 (Filtros Locais, Métricas e Seleção em Lote)**:
  - Filtra `servicos` por `selectedEscalas` e intervalo de data sobre `date_fixa_entrada`.
  - Calcula `metricTotalServicos`, `metricProntos`, `metricAguardando`, `metricPagos` e `selectedSum`.
  - `handleSelectAll` seleciona ou desmarca todos os plantões filtrados que ainda não foram pagos (`!s.bool_pago`).
- **Linhas 251–308 (`handleMarkAsPaid` e `handleSavePrice`)**:
  - `handleMarkAsPaid`: Confirma com o gestor e dispara `axios.patch('/api/gestor/financeiro/servicos', { servicoId, bool_pago: true })` para todos os serviços selecionados não pagos.
  - `handleSavePrice`: Salva o novo `num_valor_cooperado` editado inline na linha da tabela.
- **Linhas 343–636 (Cálculo do RPA e Geração de PDF A4 via `jsPDF` — `handleDownloadRpaPdf`)**:
  - Calcula `rpaSelectedServicos` (usando os selecionados não pagos ou, se todos do período já estiverem pagos, todos os serviços filtrados do período), `rpaValorBruto`, `rpaValorDescontos` e `rpaValorLiquido`.
  - Desenha o PDF A4 retrato com cabeçalho institucional da Multcare, caixas lado a lado de Fonte Pagadora e Favorecido (com dados bancários da 1ª conta vinculada), tabela paginada de plantões com quebra automática de página (`y + rowHeight > bottomLimit`), resumo financeiro, declaração de quitação, linha de assinatura e numeração de páginas no rodapé.
- **Linhas 648–712 e 1168–1339 (Modal de RPA e Folha de Estilo `@media print`)**:
  - O modal permite ajustar em tempo real o campo `Retenções/Desc. (R$)` (`id="rpa-retencoes-input"`), baixar o PDF direto (`data-testid="btn-download-rpa-pdf"`) ou acionar `window.print()` (`data-testid="btn-print-rpa"`), cuja regra CSS `@media print` oculta toda a interface do painel e imprime exclusivamente o container `#print-area` formatado para folha A4 retrato.

---

## Parte 6 — Dicionário Consolidado de Entidades e Campos no Bubble.io

| Entidade Bubble | Campo no Bubble | Tipo | Descrição e Regra de Uso no GestorCoop |
|---|---|---|---|
| `cooperado` | `txt_nomeCompleto` | `text` | Nome civil completo do cooperado |
| `cooperado` | `txt_CPF` | `text` | CPF formatado (`000.000.000-00`), chave lógica de unicidade |
| `cooperado` | `txt_pis` | `text` | PIS/PASEP/NIT validado por Módulo 11 |
| `cooperado` | `txt_termo_status` | `text` | `'Aguardando Assinatura'` ou `'Assinado'` (vazio quando sem termo) |
| `cooperado` | `file_termo_assinado` | `file` (URL) | URL HTTPS do PDF assinado recebido via webhook/sincronização ZapSign |
| `cooperado` | `fks_pasta` | `list of files` | Lista de URLs HTTPS dos documentos enviados na adesão ou pelo gestor |
| `cooperado` | `'fks_Profissões '` | `list of profissao` | Lista de IDs dos registros da tabela `profissao` *(atenção ao espaço no final do nome do campo)* |
| `cooperado` | `fks_profissoes` | `list of OS_profissao` | Lista de strings do Option Set `"Profissões"` |
| `cooperado` | `fks_ContasBancarias` | `list of contabancaria` | Lista de IDs dos registros da tabela `contabancaria` |
| `cooperado` | `fk_usuario` | `User` (ID) | Preenchido na aprovação pelo RH (`'1632307664083x948858892871476400'`), define se o cooperado está **Aprovado** |
| `cooperado` | `'fk_integralização'` | `integralizacao` (ID) | ID do registro de integralização de capital social criado na aprovação |
| `cooperado` | `bool_BLOQUEADO` / `bool_listaNegra` | `boolean` | Flags de bloqueio administrativo; impedem retomada de adesão (HTTP 409) |
| `profissao` | `txt_nome` | `text` | Nome limpo da profissão (`osValue?.trim() || prof.name`) |
| `profissao` | `OS_profissao` | `option set` | Valor exato em `PROFISSOES_BUBBLE` (omitido se `normalizeProfissaoBubble` retornar `null`) |
| `profissao` | `txt_conselho` | `text` | Registro canônico formatado (`<CONSELHO>-<UF> <NUMERO>[-<CATEGORIA>]`) |
| `contabancaria` | `text_corrente_or_poupanca` | `text` | `'Conta Corrente'` ou `'Conta Poupança'` |
| `termos` | `txt_profissao` / `num_versao` / `bool_ativo` | `text` / `number` / `boolean` | Controle de versionamento de termos por especialidade |
| `servico` | `num_valor_cooperado` | `number` | Valor de repasse do plantão ao cooperado (editável inline quando `!bool_pago`) |
| `servico` | `bool_confirmacao_finalizado` | `boolean` | Indica se o plantão já foi confirmado pela gestão de escalas |
| `servico` | `bool_pago` | `boolean` | Indica se o repasse financeiro já foi efetuado ao cooperado |
