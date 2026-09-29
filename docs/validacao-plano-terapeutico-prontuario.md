# Relatório de Auditoria e Validação Técnica: Prontuário & Plano Terapêutico

**Data:** 28/09/2026  
**Ambiente de Execução:** Local (`temp-app` / Next.js / Playwright / SQLite / Cloudflare D1)  
**Status da Verificação:** Concluída com execução de testes automatizados e inspeção de código-fonte.

---

## 1. Resumo Executivo: O que foi perguntado vs. O que existe no sistema

| Requisito Citado pelo Usuário | Existe Hoje? | Status / Detalhe no Código |
| :--- | :---: | :--- |
| **Lista de pacientes vindos do Bubble** | **SIM** | Sincronizado via `bubbleApi.getServicosByCooperado` e `bubbleApi.getPacientes` no arquivo `src/app/api/cooperado/agenda/route.ts`. |
| **Geração de prontuário a cada atendimento (Check-in, Sinais Vitais, Medicamentos, Evolução SOAP, Assinatura)** | **SIM** | Totalmente funcional nas interfaces do cooperado (`/cooperado/prontuario/[id]`) e visualização 360° do gestor (`/gestor/prontuarios/[id]`). |
| **Bloqueio de novos atendimentos quando a cota é atingida** | **PARCIAL** | Existe bloqueio quando a cota estoura (interface bloqueia check-in e API retorna `403 Forbidden`). **Porém**, a cota atual é apenas um número global único por paciente no mês (`limite_visitas_mes`), sem separação por categoria/profissão. |
| **Definição de Plano Terapêutico com Período (Data Início e Data Fim)** | **NÃO** | O sistema considera apenas o mês calendário do check-in (`strftime('%Y-%m', check_in)`). Não há campos nem tabelas para definir vigência (ex: 05/10/2026 a 04/11/2026). |
| **Cotas divididas por categoria/profissão (ex: 5 técnico, 1 médico, 2 dentista)** | **NÃO** | O campo existente é apenas `pacientes.limite_visitas_mes` (adicionado na migração `0007_limite_visitas_paciente.sql`). Não há distinção entre quantas visitas são de médico, técnico ou dentista. O dentista nem sequer consta no enum de especialidades atual. |
| **Bloqueio específico por área (ex: técnico bateu 5 visitas não pode iniciar, mas médico com 0 de 1 pode)** | **NÃO** | Hoje qualquer profissional consome o mesmo saldo geral do paciente. Se o limite for 13 e técnicos fizerem 13 visitas, o médico também é bloqueado. Se um técnico tentar fazer a 14ª, é bloqueado. |
| **Acusar pendência se faltar atendimento no fim do período (controle de a mais / a menos)** | **NÃO** | Não existe cálculo, relatório, conciliação ou flag de atendimentos não realizados (a menos) ou autorização para excedentes (a mais). |

---

## 2. Execução dos Testes Automatizados (Playwright)

Foram executados os testes automatizados existentes no projeto para validar o comportamento atual.

### Bateria 1: `tests/e2e/prontuarios-e2e-completo.spec.ts`
- **Resultado:** **6 aprovados (6 passed)** — Duração: 47.6s.
- **Detalhamento dos testes:**
  1. `Fluxo de Autenticação SSO & Redirecionamento`: Valida passagem de token no fragmento `#s=token` e carga da agenda com o paciente do cooperado.
  2. `Gestor: Admissão de Paciente com Cota Mensal de 13 Visitas`: Valida admissão de paciente salvando o campo `limite_visitas_mes: 13`.
  3. `Gestor: Visualização e Ajuste de Cota no Prontuário 360`: Valida alteração da cota de 13 para 20 no prontuário do gestor.
  4. `Cooperado: Visualização de Cota Disponível e Início de Check-in`: Valida badge `Visitas no mês: 5/13 (8 restam)` e liberação do botão "Iniciar Check-in".
  5. `Cooperado: Bloqueio Total quando Cota For Atingida (13/13)`: Valida exibição do alerta `🚫 Cota Mensal Esgotada - Visitas Bloqueadas` e ocultação do botão de check-in.
  6. `Backend API Sync: Bloqueio 403 ao Tentar Forçar Visita Acima da Cota`: Valida que o endpoint `POST /api/cooperado/sync` rejeita `CHECK_IN` com status HTTP `403` e `{ cotaAtingida: true }` quando o total de evoluções no mês atinge o limite.

### Bateria 2: `tests/e2e/fluxo-completo-cooperado-para-gestor.spec.ts` e `tests/e2e/gestor-prontuarios-360.spec.ts`
- **Resultado:** **5 aprovados (5 passed)** — Duração: 45.3s.
- **Detalhamento dos testes:**
  1. `Fluxo Integrado: Cooperado evolui paciente e Gestor audita no Prontuário 360°`: Valida check-in, checagem e administração de medicamento aprazado, preenchimento da evolução SOAP, assinatura digital com selo criptográfico e visualização imediata da evolução na linha do tempo do gestor.
  2. `Lista pacientes, filtra por complexidade e abre o prontuário 360`: Valida filtros da listagem de pacientes no gestor.
  3. `Adiciona nova prescrição médica no prontuário 360`: Valida cadastro de medicamento, dosagem, frequência e cálculo de aprazamentos automáticos.
  4. `Registra aferição de sinais vitais no prontuário 360`: Valida registro de PA sistólica/diastólica, FC, FR, Temperatura e SpO2.
  5. `Navega para o painel de auditoria e reconciliação de medicamentos`: Valida emissão de pareceres clínicos ('Conforme', 'Pendente', 'Inconformidade').

---

## 3. Onde o Código Atual Diverge do Modelo de Plano Terapêutico Solicitado

### 3.1. Estrutura do Banco de Dados Atual
Na migração `0007_limite_visitas_paciente.sql`:
```sql
ALTER TABLE pacientes ADD COLUMN limite_visitas_mes INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_evolucoes_paciente_checkin ON evolucoes(paciente_id, check_in);
```
- Existe apenas uma coluna `limite_visitas_mes` do tipo inteiro.
- Não existem tabelas como `planos_terapeuticos` ou `plano_terapeutico_itens` para suportar:
  - `data_inicio` e `data_fim` da vigência.
  - Vínculo por especialidade (`tipo_profissional`).
  - Quantidade planejada vs. quantidade executada por especialidade.

### 3.2. Validação de Check-in no Backend (`src/app/api/cooperado/sync/route.ts`)
Nas linhas 62–85:
```typescript
const paciente: any = await db.prepare('SELECT limite_visitas_mes FROM pacientes WHERE id = ?').bind(pacienteId).first();
const limite = Number(paciente?.limite_visitas_mes || 0);

if (limite > 0) {
  const mesIso = (checkIn || new Date().toISOString()).slice(0, 7);
  const countRes: any = await db.prepare(
    "SELECT COUNT(*) as total FROM evolucoes WHERE paciente_id = ? AND strftime('%Y-%m', check_in) = ?"
  ).bind(pacienteId, mesIso).first();

  const realizadas = Number(countRes?.total || 0);
  if (realizadas >= limite) {
    return NextResponse.json({
      success: false,
      error: `Limite mensal de ${limite} visitas atingido...`,
      cotaAtingida: true
    }, { status: 403 });
  }
}
```
**Limitações identificadas:**
1. A contagem faz `COUNT(*)` geral de qualquer evolução do paciente naquele mês `YYYY-MM`.
2. Não filtra por especialidade (`tipo_profissional`), impedindo que um médico atenda caso os técnicos tenham consumido o saldo geral.
3. Não reconhece o período do plano (ex: se o plano for de 15 de setembro a 14 de outubro, o filtro mensal padrão quebra o ciclo).

### 3.3. Especialidades Suportadas no Typescript (`src/lib/db/prontuarios.ts`)
```typescript
export type EspecialidadeProfissional =
  | 'Tecnico_Enfermagem'
  | 'Enfermeiro'
  | 'Medico'
  | 'Fisioterapeuta'
  | 'Fonoaudiologo'
  | 'Nutricionista'
  | 'Psicologo'
  | 'Terapeuta_Ocupacional';
```
- A especialidade **Dentista** (mencionada como exemplo pelo usuário) **não constava** no enum original e foi adicionada com sucesso.

---

## 4. Decisões Validadas com o Usuário

Em conformidade com a diretriz de não assumir probabilidades nem fazer deduções, os seguintes pontos foram diretamente alinhados e homologados:
1. **Local de Gestão:** Dashboard Individual do Paciente unificada em `/gestor/prontuarios/[id]` com aba dedicada a Planos Terapêuticos.
2. **Vigência Livre:** O plano possui período delimitado por `data_inicio` e `data_fim` configurável pelo gestor (ex: 28/09/2026 a 28/10/2026).
3. **Múltiplos Cooperados por Especialidade:** O gestor pode associar mais de um cooperado para a mesma especialidade (ex: Téc. Carlos e Téc. Roberto para cumprir conjuntamente os 5 atendimentos de Técnico de Enfermagem).
4. **Bloqueio Rígido no Limite ("A Mais"):** Ao tentar iniciar o 6º atendimento de uma cota de 5, o sistema bloqueia tanto na interface quanto no backend HTTP 403 com a mensagem `"Não está incluso no plano terapêutico vigente: Cota de 5 atendimentos atingida"`.
5. **Independência de Especialidades:** Se a cota de Técnico esgotar, médicos, dentistas ou outras especialidades com saldo disponível continuam aptos a realizar seus atendimentos normalmente.
6. **Acusação Visual de Pendências ("A Menos"):** Na Dashboard Individual, se o período está decorrendo e há atendimentos faltantes, é exibido alerta destacado de pendência multiprofissional com o saldo restante por categoria.
7. **Integração de Equipamentos:** Equipamentos locados no domicílio do paciente são apresentados unificados na dashboard individual.

---

## 5. Implementação Realizada & Arquitetura Técnica

### 5.1. Migração de Banco de Dados (`temp-app/migrations/0008_planos_terapeuticos.sql`)
- Tabela `planos_terapeuticos`: `id`, `paciente_id`, `data_inicio`, `data_fim`, `status` ('Ativo', 'Encerrado', 'Cancelado'), `observacoes`, timestamps.
- Tabela `plano_terapeutico_metas`: `id`, `plano_id`, `especialidade`, `quantidade_prevista`, `profissionais_designados` (JSON serializado contendo array de `{ id, nome }`).

### 5.2. Módulo de Tipos Compartilhados (`temp-app/src/lib/tipos-clinicos.ts`)
- Isolamento dos tipos e utilitários puros (`EspecialidadeProfissional`, `PlanoTerapeutico`, `MetaPlanoTerapeutico`, `formatarNomeEspecialidade`, `normalizarEspecialidade`) permitindo uso seguro tanto em rotas Edge/Node quanto em componentes React client-side (`'use client'`).

### 5.3. Repositório Clínico (`temp-app/src/lib/db/prontuarios.ts`)
- Implementação de persistência dupla (D1 Cloudflare + Fallback in-memory para desenvolvimento ágil e testes isolados).
- Método `buscarPlanoTerapeuticoVigente(pacienteId, data)`: localiza o plano ativo com base no período de vigência e calcula em tempo real `quantidade_realizada`, `quantidade_restante` e percentual de progresso por especialidade.
- Método `validarCheckInPlanoTerapeutico(pacienteId, especialidade, dataHora)`: executa o bloqueio de segurança estrito.

### 5.4. Backend APIs
- `GET /api/gestor/prontuarios/pacientes/[id]/planos`: Lista histórico de planos e metas do paciente.
- `POST /api/gestor/prontuarios/pacientes/[id]/planos`: Cria ou atualiza plano com vigência e metas multiprofissionais com cooperados designados.
- `GET /api/gestor/prontuarios/pacientes/[id]/dashboard`: Endpoint de agregação que retorna dados cadastrais, plano vigente, alertas de pendências, metas com percentual, equipamentos locados e estatísticas de evoluções.
- `POST /api/cooperado/sync`: Sincronização de check-in com interceptação da especialidade do cooperado contra a meta do plano terapêutico vigente, retornando HTTP 403 em caso de cota excedida.

### 5.5. Interfaces do Usuário (Next.js / Tailwind)
- `DashboardGeral` (`temp-app/src/app/gestor/prontuarios/[id]/dashboard-geral.tsx`):
  - KPIs clínicos unificados.
  - Alerta de pendências de atendimentos com contagem por especialidade.
  - Cards de progresso por categoria profissional com cooperados designados e indicador de conformidade.
  - Lista de equipamentos ativos no domicílio do paciente.
- `PlanoTerapeuticoTab` (`temp-app/src/app/gestor/prontuarios/[id]/plano-terapeutico-tab.tsx`):
  - Formulário completo para lançamento de novo plano (vigência `data_inicio` / `data_fim`, seletor de especialidades, metas numéricas e badges interativos para seleção múltipla de cooperados).
  - Histórico de planos cadastrados com status e detalhamento de metas.
- `Prontuario360Detalhe` (`temp-app/src/app/gestor/prontuarios/[id]/prontuario-detalhe.tsx`):
  - Navegação fluida por abas: *Geral (Dashboard)*, *Plano Terapêutico*, *Evoluções Clínicas & SOAP*, *Prescrições Médicas*, *Sinais Vitais* e *Auditoria & Pareceres*.

---

## 6. Homologação Completa dos Testes Automatizados (Playwright)

A bateria completa de 15 testes de ponta a ponta (E2E) foi executada e homologada com **100% de aprovação (15/15 passed)**:

| Teste | Arquivo de Teste | Duração | Status |
| :--- | :--- | :---: | :---: |
| **Fluxo Integrado: Cooperado evolui paciente e Gestor audita no Prontuário 360°** | `fluxo-completo-cooperado-para-gestor.spec.ts` | 10.5s |  **PASSED** |
| **Lista pacientes, filtra por complexidade e abre o prontuário 360** | `gestor-prontuarios-360.spec.ts` | 2.3s |  **PASSED** |
| **Adiciona nova prescrição médica no prontuário 360** | `gestor-prontuarios-360.spec.ts` | 1.5s |  **PASSED** |
| **Registra aferição de sinais vitais no prontuário 360** | `gestor-prontuarios-360.spec.ts` | 1.7s |  **PASSED** |
| **Navega para o painel de auditoria e reconciliação de medicamentos** | `gestor-prontuarios-360.spec.ts` | 1.6s |  **PASSED** |
| **1. Gestor: Acessa Dashboard Individual do Paciente com Visão Unificada e KPIs** | `plano-terapeutico-e2e.spec.ts` | 1.4s |  **PASSED** |
| **2. Gestor: Lança Novo Plano Terapêutico com Período, Metas e Seleção de Cooperados** | `plano-terapeutico-e2e.spec.ts` | 1.5s |  **PASSED** |
| **3. Backend API Sync: Bloqueio Rígido ao Tentar Iniciar 6º Atendimento de Técnico** | `plano-terapeutico-e2e.spec.ts` | 858ms |  **PASSED** |
| **4. Backend API Sync: Especialidade Independente (Médico 0/1) Inicia com Sucesso** | `plano-terapeutico-e2e.spec.ts` | 1.8s |  **PASSED** |
| **1. Fluxo de Autenticação SSO & Redirecionamento** | `prontuarios-e2e-completo.spec.ts` | 1.1s |  **PASSED** |
| **2. Gestor: Admissão de Paciente com Cota Mensal de 13 Visitas** | `prontuarios-e2e-completo.spec.ts` | 1.4s |  **PASSED** |
| **3. Gestor: Visualização e Ajuste de Cota no Prontuário 360** | `prontuarios-e2e-completo.spec.ts` | 1.4s |  **PASSED** |
| **4. Cooperado: Visualização de Cota Disponível e Início de Check-in** | `prontuarios-e2e-completo.spec.ts` | 1.9s |  **PASSED** |
| **5. Cooperado: Bloqueio Total quando Cota For Atingida (13/13)** | `prontuarios-e2e-completo.spec.ts` | 1.2s |  **PASSED** |
| **6. Backend API Sync: Bloqueio 403 ao Tentar Forçar Visita Acima da Cota** | `prontuarios-e2e-completo.spec.ts` | 869ms |  **PASSED** |

**Total:** 15 testes executados, 15 aprovados (0 falhas). Tempo total: 38.1s.

---

## 7. Como Reproduzir os Testes e Executar na Prática

Para rodar todos os testes automatizados da funcionalidade:
```bash
cd temp-app
npx playwright test tests/e2e/plano-terapeutico-e2e.spec.ts tests/e2e/prontuarios-e2e-completo.spec.ts tests/e2e/gestor-prontuarios-360.spec.ts tests/e2e/fluxo-completo-cooperado-para-gestor.spec.ts --workers=1
```

Para acessar no ambiente local:
1. Inicie o servidor: `npm run dev` na pasta `temp-app`.
2. Acesse a lista de pacientes no gestor: `http://localhost:3000/gestor/prontuarios`.
3. Clique em um paciente para abrir a **Dashboard Individual do Paciente** (`/gestor/prontuarios/[id]`).
4. Navegue entre as abas:
   - **Geral (Dashboard):** KPIs, alerta de pendências, progresso de visitas por especialidade e equipamentos.
   - **Plano Terapêutico:** Clique em "Novo Plano Terapêutico", defina o período, metas e selecione os cooperados escalados para cada categoria.
   - **Evoluções & SOAP, Prescrições, Sinais Vitais e Auditoria:** Registros clínicos completos e reconciliação.

