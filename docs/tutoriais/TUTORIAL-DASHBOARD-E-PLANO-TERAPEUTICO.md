# Tutorial em Vídeo & Guia Prático: Dashboard Individual do Paciente & Plano Terapêutico

Bem-vindo ao tutorial oficial do **GestorCoop** demonstrando a nova **Dashboard Individual do Paciente** e a gestão integrada de **Planos Terapêuticos Multiprofissionais**.

---

## 1. Vídeo Demonstrativo Gravado em Alta Definição (HD)

A gravação completa em vídeo (55 segundos, 1280x720 com legendas automáticas passo a passo) está disponível no repositório:

- **Arquivo de Vídeo:** [`docs/tutoriais/tutorial-dashboard-e-plano-terapeutico.webm`](file:///c:/Users/admin/Documents/projetos/gestorcoop/docs/tutoriais/tutorial-dashboard-e-plano-terapeutico.webm)
- **Tamanho:** 3.7 MB
- **Como Reproduzir:**
  - **No Navegador:** Basta arrastar o arquivo `.webm` para qualquer aba do Google Chrome, Microsoft Edge ou Firefox, ou clicar com o botão direito e escolher *"Abrir com Google Chrome"*.
  - **No Player de Mídia:** Compatível nativamente com o *Reprodutor de Mídia do Windows*, *VLC Media Player* e players padrão.

---

## 2. Linha do Tempo e Conteúdo do Vídeo (Timestamps)

| Minuto | Etapa Demonstrada | Descrição do Fluxo |
| :---: | :--- | :--- |
| **00:00 - 00:08** | **Lista Geral de Pacientes** | Visão geral da tela `/gestor/prontuarios`, com pacientes sincronizados do Bubble, complexidade clínica, alertas de risco e cotas. |
| **00:08 - 00:15** | **Acesso à Dashboard Individual** | Clique em *"Ver Prontuário 360°"* no paciente Marcos Vinicius Santos, abrindo `/gestor/prontuarios/p_marcos`. |
| **00:15 - 00:26** | **Dashboard 360° Unificada** | Tour visual: KPIs clínicos, cards de vigência e **Alerta Automático de Pendências no Período ("A Menos")**. |
| **00:26 - 00:33** | **Equipamentos Locados no Domicílio** | Destaque para os equipamentos ativos no domicílio do paciente (Cama Hospitalar Motorizada e Concentrador de O2). |
| **00:33 - 00:38** | **Navegação para a Aba Plano Terapêutico** | Abertura da aba dedicada à gestão de vigências e cotas multiprofissionais. |
| **00:38 - 00:46** | **Lançamento de Novo Plano** | Abertura do formulário de criação, definição das datas de início e fim da vigência e ajuste das metas. |
| **00:46 - 00:50** | **Múltiplos Cooperados na Mesma Cota** | Seleção múltipla: inclusão de **Téc. Carlos Enfermagem** e **Téc. Roberto Soares** compartilhando os 5 atendimentos de técnico. |
| **00:50 - 00:53** | **Alocação de Médico e Dentista** | Associação do Dr. Marcos Mendes (1 visita médica) e Dra. Camila Odonto (2 atendimentos odontológicos). |
| **00:53 - 00:55** | **Salvamento & Sincronização** | Envio dos dados com feedback imediato de sucesso (*"Plano Terapêutico salvo com sucesso!"*) e retorno à Dashboard Geral. |

---

## 3. Passo a Passo para o Gestor

### Passo 1: Acessar a Dashboard do Paciente
1. Acesse o menu lateral do sistema e clique em **Pacientes & Prontuários** (`/gestor/prontuarios`).
2. Localize o paciente desejado pelo campo de busca ou pelos filtros de complexidade.
3. Clique no botão **"Ver Prontuário 360°"**.
4. Você será direcionado para a página unificada `/gestor/prontuarios/[id]`.

### Passo 2: Entender as Informações da Dashboard Geral
- **Cabeçalho:** Nome, CPF, plano de saúde, complexidade e tags de alerta (ex: *Risco de Queda*, *Traqueostomia*).
- **Banner de Alerta de Pendências:** Sempre que o período do plano estiver em andamento e houver atendimentos faltantes em relação ao contratado, o sistema acusará a pendência indicando exatamente quantas visitas restam por área.
- **Card de Progresso das Metas:** Mostra barras de progresso separadas para Técnico de Enfermagem, Médico, Dentista, Fisioterapeuta, etc., com a relação `realizadas / previstas` e os cooperados designados para o caso.
- **Equipamentos Ativos:** Lista os equipamentos hospitalares locados no domicílio do paciente com número de série e data de entrega.

### Passo 3: Cadastrar ou Renovar um Plano Terapêutico
1. No topo da página do paciente, clique na aba **Plano Terapêutico**.
2. Clique no botão azul **"+ Novo Plano Terapêutico"**.
3. Preencha os campos obrigatórios:
   - **Data de Início:** Primeiro dia de vigência do plano (ex: `01/10/2026`).
   - **Data de Fim:** Último dia de vigência do plano (ex: `31/10/2026`).
   - **Status:** *Ativo*.
   - **Observações:** Orientações e detalhes clínicos da prescrição multidisciplinar.
4. Na seção **Metas por Especialidade**:
   - Defina a quantidade de atendimentos prevista para cada área (ex: 5 para Técnico, 1 para Médico, 2 para Dentista).
   - Clique sobre os crachás/badges dos cooperados para escalá-los na meta.
   - **Dica:** Você pode selecionar mais de um cooperado para a mesma especialidade (ex: 2 técnicos de enfermagem cobrindo escalas alternadas no mesmo paciente).
   - Se desejar incluir outras áreas (Fisioterapia, Nutrição, Fonoaudiologia), clique em **"+ Adicionar Especialidade"**.
5. Clique em **"Salvar Plano Terapêutico"**.

---

## 4. Regras de Segurança e Bloqueios em Execução

| Situação | Comportamento do Sistema |
| :--- | :--- |
| **Técnico tenta realizar o 6º atendimento (cota de 5 já atingida)** | **Bloqueio Rígido:** A interface do aplicativo do cooperado bloqueia a ação e a API de sincronização (`POST /api/cooperado/sync`) responde com **HTTP 403 Forbidden**, acusando: *"Não está incluso no plano terapêutico vigente: Cota de 5 atendimentos de Técnico de Enfermagem já atingida para este período."* |
| **Médico precisa visitar o paciente e o técnico já esgotou a cota** | **Permissão Normal:** Cada especialidade possui contagem estritamente independente. O médico com meta de 0/1 inicia o atendimento com sucesso sem ser impedido pelo técnico. |
| **Período do plano encerra com visitas não realizadas** | **Acusação Visual de Pendência:** A dashboard do gestor exibe o aviso em destaque indicando a pendência para que a auditoria e o faturamento tomem providências imediatas. |
| **Dois cooperados designados para a mesma cota** | **Consumo Compartilhado:** Ambos têm acesso liberado ao paciente, e os atendimentos realizados por qualquer um deles abatem do saldo comum daquela meta (ex: Téc. Carlos faz 3 e Téc. Roberto faz 2, totalizando os 5 previstos). |

---

## 5. Como Executar os Testes Automatizados da Demonstração

Para reproduzir a bateria completa ou reexecutar a gravação de vídeo:

```bash
# Rodar todos os 15 testes automatizados de ponta a ponta
cd temp-app
npx playwright test tests/e2e/plano-terapeutico-e2e.spec.ts tests/e2e/prontuarios-e2e-completo.spec.ts tests/e2e/gestor-prontuarios-360.spec.ts tests/e2e/fluxo-completo-cooperado-para-gestor.spec.ts --workers=1

# Reexecutar a gravação do vídeo do tutorial
npx playwright test tests/e2e/gravar-tutorial-video.spec.ts --workers=1
```
