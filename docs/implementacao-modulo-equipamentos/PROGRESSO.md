# Progresso de implementacao - modulo de equipamentos

## Ambiente aplicado

- Perfil Bubble: `gestorcoop`
- Aplicacao: `appgestorcoop`
- Ambiente: `test`
- Producao: nao alterada

## Fase 1 - Fundamentos e maquina de estados

### Estruturas criadas no Bubble

- [x] Cadastros-base `categoria_equipamento`, `fabricante_equipamento`, `modelo_equipamento` e `fornecedor_equipamento`, vinculados opcionalmente ao equipamento.
- [x] Tipos `localizacao`, `domicilio` e `movimentacao_equipamento`.
- [x] Dados de endereco, paciente, contato e instrucoes operacionais do domicilio.
- [x] Linha do tempo imutavel de movimentacao, com antes/depois, autor, responsavel, evidencias, documentos, justificativa e chave de idempotencia.
- [x] Vinculos entre eventos de substituicao, reserva, locacao e ordem de servico para rastrear operacoes em cascata.
- [x] Campos patrimoniais e operacionais no equipamento: codigo interno, patrimonio, origem, fornecedor, aquisicao, garantia, preventiva, foto, documentos, localizacao e ultima movimentacao.
- [x] Campos de codigo de barras, higienizacao, manutencao, calibracao, bloqueio e baixa definitiva do ativo.
- [x] Vinculos de domicilio, implantacao e recolhimento na locacao.
- [x] Vinculos da auditoria existente com equipamento e movimentacao.
- [x] Marcadores de perfil no User para logistica, manutencao, financeiro e auditoria de equipamentos.
- [x] Evento reutilizavel `Registrar movimentacao do equipamento` criado na pagina `index`, com parametros para equipamento, evento, status de destino, localizacao, domicilio, locacao, responsavel, observacoes, justificativa e idempotencia.

### Situacoes adicionadas

- [x] Aguardando conferencia, Reservado, Em transporte para implantacao, Implantado no domicilio e Em transporte para recolhimento.
- [x] Recolhido e aguardando conferencia, Aguardando higienizacao, Em higienizacao, Aguardando peca e Bloqueado.
- [x] Extraviado, Condenado e Baixado.
- [x] Tipos controlados de evento: cadastro, entrada, alteracao, reserva, implantacao, recolhimento, transferencia, higienizacao, manutencao, calibracao, bloqueio, liberacao, extravio, baixa e correcao.

### Compatibilidade mantida

- [x] Nenhum tipo, campo ou situacao preexistente foi removido.
- [x] Os status legados `Disponivel`, `Alugado`, `Manutencao` e `Inativo` foram preservados.
- [ ] Migrar o uso de `Alugado` para `Implantado no domicilio` somente depois dos workflows e da interface nova estarem ativos.

## Fase 2 - Estoque, reserva e acessorios

- [x] Tipo `reserva_equipamento`: ativo, paciente, domicilio, datas, validade, responsavel, status, cancelamento e idempotencia.
- [x] Status de reserva: Ativa, Cancelada, Expirada e Convertida em implantacao.
- [x] Motivos padronizados de recolhimento e baixa definitiva.
- [x] Tipo `acessorio`: identificacao, categoria, descricao, valor de reposicao, foto, documentos e ativo.
- [x] Tipo `movimentacao_acessorio`: itens enviados/devolvidos/faltantes, estado, cobranca e observacoes.
- [x] Tipos `conferencia_equipamento` e `higienizacao_equipamento`, com responsavel, resultado, aprovacao, evidencias e documentos.
- [x] Implementar reserva no Next com paciente, data prevista, validade e movimentação que muda o ativo para Reservado.
- [x] Implementar cancelamento/expiração de reserva, conferência e higienização. (Rotas `reservas/[reservaId]/cancelar` e `reservas/expirar`; conferência e higienização já existentes.)

## Fase 3 - Manutencao, custos e calibracao

- [x] Tipo `ordem_servico_manutencao`: entrada, diagnostico, fornecedor tecnico, garantia, previsao, documentos, evidencias e custos.
- [x] Status da OS: Aberta, Em diagnostico, Aguardando aprovacao, Aguardando peca, Em execucao, Em teste, Liberada, Reprovada, Sem reparo, Baixa recomendada e Cancelada.
- [x] Resultado tecnico: reparado, restrito, aguardando peca, sem defeito, reprovado, sem reparo ou recomendado para baixa.
- [x] Tipo `item_manutencao` para pecas, mao de obra, frete e outros custos.
- [x] Tipo `calibracao_equipamento`: agenda, realizacao, validade, certificado, resultado, custo e anexos.
- [x] Tipo `teste_equipamento`, vinculado a manutencao e movimentacao para liberar ou restringir o ativo apos teste tecnico.
- [x] Preparar no Next a abertura de OS: cria a ordem, registra a movimentação e impede nova implantação ao colocar o ativo em manutenção.
- [x] Preparar diagnóstico, orçamento, custos, aguardo de peça e liberação da OS no Next; a liberação exige teste técnico aprovado e gera movimentação.
- [x] Exibir as OS existentes na ficha individual do equipamento, com situação, motivo, diagnóstico e custo total.
- [x] Criar a tela de gestão de OS, itens de manutenção, evidências e recomendação de baixa. (Página `/gestor/manutencao`; rotas de itens com recálculo de custo total e `recomendar-baixa`.)

## Fase 6 - Baixa e auditoria

- [x] Tipo `baixa_equipamento`: solicitacao, laudo, custos, valor residual, destino, documentos, solicitante, autorizador e decisao.
- [x] Status formal de baixa: Pendente de aprovacao, Aprovada, Reprovada e Cancelada.
- [x] Implementar no Next a regra de autorizacao e a reversao excepcional de baixa. (Rotas `baixas/[baixaId]/reprovar` e `.../reverter` com dupla autorização, justificativa reforçada e movimentação de correção.)

## Fase 4 - Locacao e financeiro

- [x] Snapshot financeiro na locacao: diaria, mensalidade, taxas, desconto, acrescimo, regra de cobranca, datas, dias e total estimado.
- [x] Formas de cobranca padronizadas: diaria, mensalidade, proporcional, fechada, personalizada ou sem cobranca.
- [x] Valores padrao no equipamento: diaria, mensalidade, taxas e regra de cobranca.
- [x] Tipo `tabela_preco_equipamento`, com vigencia, equipamento/categoria/modelo, convenio ou contrato, taxas, minimo e desconto; a locacao referencia a tabela aplicada.
- [x] Evidencias de implantacao/recolhimento e identificacao de quem recebeu.
- [x] Implementar no Next o cálculo estimado por diária, mensalidade, proporcional, fechada, personalizada ou sem cobrança; o snapshot permanece gravado na locação.
- [x] Recalcular e gravar o total final no recolhimento usando a data real e o snapshot financeiro da implantação.
- [x] Implementar períodos suspensos e demonstrativo financeiro detalhado por competência. (Tipo Bubble `suspensao_locacao`; rota `locacoes/[id]/suspensoes`; cálculo com dias suspensos e `montarDemonstrativoLocacao` em `locacoes/[id]/demonstrativo`.)
- [x] Criar demonstrativo e indicadores de custo, receita e rentabilidade. (`calcularRentabilidadeEquipamento` + rota `equipamentos/[id]/rentabilidade`, separando receita realizada de estimada.)

## Fase 5 - Alertas e painel operacional

- [x] Tipo `alerta_equipamento`, com ativo, locacao/OS relacionada, prazo, prioridade, responsavel e resolucao.
- [x] Tipos de alerta para recolhimento, implantacao, preventiva, calibracao, garantia, conferencia, higienizacao, manutencao, acessorios, extravio e documentos.
- [x] Status de alerta: Aberto, Em tratamento, Resolvido e Ignorado.
- [x] Criar os workflows agendados para gerar e encerrar alertas. (Rotas `/api/cron/alertas-gerar` e `/api/cron/reservas-expirar` protegidas por `CRON_SECRET` + Worker Cloudflare `cron-worker/` que as dispara no horário agendado. Lógica compartilhada em `equipamentos-jobs.ts`.)
- [x] Criar painel operacional inicial no Next com recolhimentos atrasados, conferencias e tratativas tecnicas pendentes.
- [x] Criar exportacao CSV do inventario pela tela de equipamentos.
- [x] Criar filtros avancados, alertas agendados e relatorios financeiros/técnicos. (Página `/gestor/equipamentos-relatorios` com abas de alertas/inventário/movimentações/manutenções, filtros e CSV; agendamento do cron ainda pendente.)

## Pendencias criticas antes de uso operacional

- [x] Implementar no Next o adaptador de movimentacao com idempotencia e compensacao caso a atualizacao do equipamento falhe.
- [x] Preparar implantacao e recolhimento para registrar a movimentacao e atualizar a locacao sem listas duplicadas no paciente.
- [x] Impedir alteracao manual da situacao do equipamento quando o fluxo novo estiver ativo.
- [x] Expor as tabelas novas no Data API do Bubble. (21 data types + `suspensao_locacao` expostos no ambiente `test`; `EQUIPAMENTOS_V2_ENABLED=true`. **A revisao de privacidade foi deliberadamente ignorada por decisao do usuario** — ver ressalva abaixo.)
- [ ] O evento visual criado no Bubble permanece sem corpo; o Next passa a ser a camada operacional do modulo.
- [x] Configurar validacoes de transicao, concorrencia e operacoes retroativas. (Máquina de estados `equipamentos-estados.ts` + guarda de concorrência `txt_status_esperado` aplicadas em `registrarMovimentacao`; datas retroativas via `date_data_hora`.)
- [x] Criar ficha individual e linha do tempo no Next, com compatibilidade para as locacoes legadas e eventos V2.
- [x] Criar painel operacional, busca avancada e relatorios. (Página `/gestor/equipamentos-relatorios`; busca avancada ainda limitada aos filtros por status/categoria/fabricante/periodo.)
- [ ] Criar regras de privacidade e API por perfil (IGNORADO por decisao do usuario nesta rodada — pendente antes de producao).
- [ ] Homologar com cenarios de reserva, implantacao, recolhimento, manutencao, baixa e acessorios.

## Rodada "botar pra moer" (privacidade adiada por decisao do usuario)

Sprint executado em paralelo (fundacao + 4 agentes) com a revisao de privacidade deliberadamente adiada.

### Entregue e validado (build Next `next build` OK, `tsc --noEmit` limpo)

- **Fundacao compartilhada:** `equipamentos-estados.ts` (matriz de transicao + `podeOperar`), `equipamentos-financeiro.ts` estendido (periodos suspensos, `montarDemonstrativoLocacao`, `calcularRentabilidadeEquipamento`), novos tipos/metodos no `bubble.ts` (reserva list/cancel, baixa CRUD, item_manutencao, suspensao, alertas) e validacao de transicao + guarda de concorrencia dentro de `registrarMovimentacao`.
- **Rotas backend:** `reservas/[reservaId]/cancelar`, `reservas/expirar`, `baixas/[baixaId]/reprovar`, `baixas/[baixaId]/reverter`, `locacoes/[id]/suspensoes`, `locacoes/[id]/demonstrativo`, `equipamentos/[id]/rentabilidade`.
- **Manutencao:** `manutencoes/[osId]/itens` (GET/POST/DELETE com recalculo de custo total), `manutencoes/[osId]/recomendar-baixa`, GET em `manutencoes` e pagina `/gestor/manutencao`.
- **Alertas/relatorios:** `alertas` (GET filtros), `alertas/[alertaId]` (PATCH), `alertas/gerar` (POST idempotente), `relatorios/inventario|movimentacoes|manutencoes`, pagina `/gestor/equipamentos-relatorios`.
- **Bubble Data API (test):** 21 data types + `suspensao_locacao` expostos. Nenhuma privacy rule alterada.

### Riscos e pendencias abertas (revisar antes de producao)

1. **Privacidade nao revisada.** Data types expostos no Data API sem privacy rules por perfil. Dados de paciente/evidencias ficam acessiveis via token de API. Criar as regras antes de qualquer uso real.
2. **Nomes de campo no Bubble assumidos por convencao** (`os_tipo_alerta`, `os_tipo` do item, `txt_categoria`/`txt_fabricante` nos filtros de inventario, campos de `item_manutencao`). Nao foram verificados campo-a-campo no editor Bubble; validar na homologacao — divergencia causa gravacao/filtro silenciosamente vazio.
3. **Agendamento dos alertas.** Worker `cron-worker/` DEPLOYADO em Cloudflare (`https://gestorcoop-cron.marcosgabriel040.workers.dev`, cron `0 9 * * *`, plano Free); `APP_BASE_URL` e `CRON_SECRET` configurados no Worker. **Pendencia unica:** adicionar `CRON_SECRET` (mesmo valor) nas Environment Variables do projeto Pages `gestorcoop` (Production) e re-deployar o Pages — sem isso o app responde 401 ao cron.
4. **Relatorio de manutencoes** sem `equipamentoId` varre ate 100 equipamentos (sinalizado com `truncado:true`) e faz 1 chamada Bubble por equipamento — aceitavel sob demanda, revisar em parques grandes.
5. **Homologacao ponta-a-ponta ainda pendente** (cenarios do plano). O build compila, mas os fluxos nao foram exercitados contra o Bubble real.

## Observacao de seguranca

Durante uma atualizacao tecnica do contexto foram identificadas credenciais de integracoes no export do app. Elas nao foram reproduzidas nestes documentos. Rotacione-as e revise a privacidade antes de publicar o modulo.
