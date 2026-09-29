# Plano de Arquitetura & Implementação: Dashboard Unificada do Paciente & Plano Terapêutico

**Data:** 28/09/2026  
**Status:** Planejamento e Especificação Técnica  
**Objetivo:** Transformar a visualização do paciente em uma **Dashboard Individual Unificada 360°** e implementar a gestão completa de **Planos Terapêuticos** por especialidade, com controle rígido de cotas, bloqueio estrito de atendimentos excedentes ("a mais") e alertas automáticos de pendências ("a menos").

---

## 1. Visão Geral da Solução

O paciente passa a ter um centro de comando individual em `/gestor/prontuarios/[id]` composto por 4 abas principais:

```
[ Topo: Nome do Paciente | CPF | Status | Convênio | Diagnóstico ]
[ Abas: 📊 Geral (Dashboard) | 📋 Plano Terapêutico | 🩺 Prontuário Clínico | 🛡️ Logs & Auditoria ]
```

1. **📊 Geral (Dashboard do Paciente):**
   - **Visão Executiva & Gráficos:** Barras de progresso do cumprimento das metas do plano terapêutico vigente por categoria.
   - **🚨 Painel de Pendências ("A Menos"):** Destaque visual em alerta caso atendimentos contratados não tenham sido realizados dentro do período (ex: *"Médico: 0 de 1 atendimento realizado - Pendente"*).
   - **🏥 Equipamentos Vinculados:** Unificação com o módulo de equipamentos, listando todos os itens locados/instalados no domicílio do paciente.
   - **⏱️ Linha do Tempo Recente:** Últimos atendimentos com acesso direto à evolução clínica.

2. **📋 Plano Terapêutico:**
   - Cadastro e histórico de planos terapêuticos.
   - Definição explícita de **Data de Início** e **Data de Fim** do período de vigência.
   - Grade dinâmica de metas por especialidade profissional:
     - *Técnico de Enfermagem*
     - *Médico*
     - *Dentista*
     - *Enfermeiro*
     - *Fisioterapeuta*
     - *Fonoaudiólogo*
     - *Nutricionista*
     - *Psicólogo*
     - *Terapeuta Ocupacional*
   - Saldo em tempo real por categoria: Previsto, Realizado, Restante e Status.

3. **🩺 Prontuário Clínico:**
   - Mantém as funcionalidades já consolidadas: Evoluções SOAP, Prescrições ativas, Aprazamento de medicamentos e Registro de Sinais Vitais.

4. **🛡️ Logs & Auditoria:**
   - Histórico de auditoria, pareceres clínicos e rastreabilidade de alterações do plano terapêutico.

---

## 2. Regras de Negócio e Validações Rígidas

### 2.1. Bloqueio Estrito no Check-in (Cooperado)
- Ao abrir o app ou iniciar um check-in, o sistema identifica a categoria do profissional logado (`tipoProfissional`).
- Consulta o **Plano Terapêutico vigente** para o paciente na data atual (`check_in BETWEEN data_inicio AND data_fim`).
- **Se a especialidade não constar no plano:**
  - O check-in é **bloqueado**.
  - Mensagem: *"A especialidade [Especialidade] não possui atendimentos contratados no Plano Terapêutico vigente deste paciente."*
- **Se a cota da especialidade estiver esgotada (`realizadas >= previstas`):**
  - O check-in é **bloqueado imediatamente** (UI desabilita o botão e API retorna HTTP 403).
  - Mensagem: *"Limite atingido: O Plano Terapêutico deste paciente prevê [X] atendimentos de [Especialidade] e todos já foram realizados ([X]/[X]). Novos atendimentos desta especialidade estão bloqueados."*
- **Outras especialidades permanecem desbloqueadas:** Se o técnico completou 5/5, o médico ainda pode iniciar seu 1/1 normalmente.

### 2.2. Apuração de Pendências ("A Menos")
- Quando o plano terapêutico vigente estiver em andamento ou próximo do fim:
  - Cada meta de especialidade com `realizadas < prevista` gera um status de **Pendente**.
  - O gestor visualiza no topo da Dashboard do Paciente um card amarelo/vermelho alertando sobre as visitas faltantes para que possa acionar os profissionais antes de expirar a vigência.

---

## 3. Modelo de Dados (Cloudflare D1 / SQLite)

### Nova Migração: `0008_planos_terapeuticos.sql`
```sql
CREATE TABLE IF NOT EXISTS planos_terapeuticos (
  id TEXT PRIMARY KEY,
  paciente_id TEXT NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  data_inicio TEXT NOT NULL,
  data_fim TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Ativo', -- 'Ativo', 'Concluido', 'Cancelado'
  observacoes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS plano_terapeutico_metas (
  id TEXT PRIMARY KEY,
  plano_id TEXT NOT NULL REFERENCES planos_terapeuticos(id) ON DELETE CASCADE,
  especialidade TEXT NOT NULL,
  quantidade_prevista INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_planos_terapeuticos_paciente ON planos_terapeuticos(paciente_id, data_inicio, data_fim);
CREATE INDEX IF NOT EXISTS idx_plano_metas_plano ON plano_terapeutico_metas(plano_id);
```

---

## 4. Roteiro de Execução

1. **Fase 1: Schema & Backend Repositório**
   - Criar migração SQL `0008_planos_terapeuticos.sql`.
   - Adicionar `Dentista` no enum de especialidades em `src/lib/db/prontuarios.ts`.
   - Implementar métodos de persistência D1 e memória para `PlanosTerapeuticos` e `Metas`.
   - Implementar cálculo dinâmico de saldo e pendências por especialidade.

2. **Fase 2: Endpoints de API**
   - `GET /api/gestor/prontuarios/pacientes/[id]/planos`
   - `POST /api/gestor/prontuarios/pacientes/[id]/planos`
   - `GET /api/gestor/prontuarios/pacientes/[id]/dashboard` (consolida paciente, equipamentos do Bubble/D1, plano vigente e alertas).
   - Atualizar `POST /api/cooperado/sync` para validação estrita da meta da especialidade.

3. **Fase 3: Frontend do Gestor (Dashboard & Plano)**
   - Reestruturar `src/app/gestor/prontuarios/[id]/prontuario-detalhe.tsx` com navegação por abas: Geral, Plano Terapêutico, Prontuário, Logs.
   - Criar formulário de lançamento/edição de Plano Terapêutico com seletor de vigência e metas por especialidade.
   - Criar cards de gráficos de progresso e alertas de pendências.
   - Integrar lista de equipamentos vinculados ao paciente.

4. **Fase 4: Frontend do Cooperado (Visão de Cota da Especialidade)**
   - Atualizar a exibição da cota na agenda e na tela de check-in para refletir o saldo da especialidade do profissional logado.

5. **Fase 5: Testes Automatizados E2E**
   - Criar `tests/e2e/plano-terapeutico-e2e.spec.ts` cobrindo toda a jornada.
   - Executar suíte completa no Playwright para homologação sem regressões.
