# Diretrizes do Projeto GestorCoop (Antigravity 2.0)

## 🚀 Orquestração com OpenAI Codex (Boost & Multi-Agente)

### 1. Comportamento para `/boost` (Boost Mode)
Sempre que o usuário acionar o comando `/boost`, solicitar análise aprofundada, raciocínio profundo, ou quando uma tarefa exigir planejamento estratégico complexo e verificação rigorosa:

1. **Fase 1: Planejamento & Múltiplas Perspectivas (Ensemble)**
   - Formule a análise inicial do problema e a proposta de solução.
   - Consulte obrigatoriamente o **OpenAI Codex (`gpt-6-astra` com reasoning `low`)** utilizando a ferramenta MCP `codex_ask`.
   - Apresente de forma sintetizada os pontos fortes de cada perspectiva (Gemini + Codex GPT-6 Astra) e o plano final unificado antes de iniciar as alterações.

2. **Fase 2: Implementação com Precisão**
   - Execute as modificações mantendo a estabilidade do código, modularidade e boas práticas.
   - Caso o usuário peça expressamente para o Codex implementar a tarefa, delegue usando a ferramenta `codex_exec` com sandbox `workspace-write`.

3. **Fase 3: Verificação Rigorosa (Code Review Cruzado)**
   - Finalizadas as alterações no código, acione a ferramenta `codex_review` (com `uncommitted: true`) para que o motor de revisão do Codex inspecione o `git diff`.
   - Reporte os apontamentos críticos identificados pelo Codex (segurança, concorrência, possíveis regressões ou edge cases) e certifique-se de resolvê-los.

---

### 2. Configurações Padrão do Codex
- **Modelo**: `gpt-6-astra` (GPT-6 Astra - Flagship).
- **Reasoning Effort**: `low` (`model_reasoning_effort="low"`).
- **Modelos Alternativos Suportados**: `gpt-5.6-terra`, `gpt-5.6-luna`, `gpt-5.6-sol`.
- **Workspace**: Executar sempre no contexto do repositório (`gestorcoop`) preservando o nível de confiança e sandbox.

---

### 3. Segunda Opinião & Consultas Pontuais
- Quando o usuário mencionar `/codex`, "pergunte ao codex", "peça uma segunda opinião ao codex" ou desejar validação externa, utilize prontamente `codex_ask`.
- Para revisões de pull requests ou commits específicos, utilize `codex_review` apontando a branch ou hash correspondente.
