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
- [x] Ligar a reserva ao workflow central e bloquear dupla reserva/implantacao (criacao de reserva ja bloqueia; falta apenas listar/cancelar na interface).
- [x] Criar a interface de entrada, reserva, implantacao, recolhimento, conferencia e higienizacao (tela `gestor/equipamentos`).

## Fase 3 - Manutencao, custos e calibracao

- [x] Tipo `ordem_servico_manutencao`: entrada, diagnostico, fornecedor tecnico, garantia, previsao, documentos, evidencias e custos.
- [x] Status da OS: Aberta, Em diagnostico, Aguardando aprovacao, Aguardando peca, Em execucao, Em teste, Liberada, Reprovada, Sem reparo, Baixa recomendada e Cancelada.
- [x] Resultado tecnico: reparado, restrito, aguardando peca, sem defeito, reprovado, sem reparo ou recomendado para baixa.
- [x] Tipo `item_manutencao` para pecas, mao de obra, frete e outros custos.
- [x] Tipo `calibracao_equipamento`: agenda, realizacao, validade, certificado, resultado, custo e anexos.
- [x] Tipo `teste_equipamento`, vinculado a manutencao e movimentacao para liberar ou restringir o ativo apos teste tecnico.
- [x] Preparar no Next a ab2ertura de OS: cria a ordem, registra a movimentação e impede nova implantação ao colocar o ativo em manutenção.
- [x] Implementar diagnóstico, itens, custos, teste, liberação e baixa recomendada da OS (tela `gestor/manutencao`).

## Fase 6 - Baixa e auditoria

- [x] Tipo `baixa_equipamento`: solicitacao, laudo, custos, valor residual, destino, documentos, solicitante, autorizador e decisao.
- [x] Status formal de baixa: Pendente de aprovacao, Aprovada, Reprovada e Cancelada.
- [ ] Implementar no Next a regra de autorizacao e a reversao excepcional de baixa.

## Fase 4 - Locacao e financeiro

- [x] Snapshot financeiro na locacao: diaria, mensalidade, taxas, desconto, acrescimo, regra de cobranca, datas, dias e total estimado.
- [x] Formas de cobranca padronizadas: diaria, mensalidade, proporcional, fechada, personalizada ou sem cobranca.
- [x] Valores padrao no equipamento: diaria, mensalidade, taxas e regra de cobranca.
- [x] Tipo `tabela_preco_equipamento`, com vigencia, equipamento/categoria/modelo, convenio ou contrato, taxas, minimo e desconto; a locacao referencia a tabela aplicada.
- [x] Evidencias de implantacao/recolhimento e identificacao de quem recebeu.
- [x] Implementar no Next o cálculo estimado por diária, mensalidade, proporcional, fechada, personalizada ou sem cobrança; o snapshot permanece gravado na locação.
- [x] Recalcular e gravar o total final no recolhimento usando a data real e o snapshot financeiro da implantação.
- [ ] Implementar períodos suspensos e demonstrativo financeiro detalhado por competência.
- [ ] Criar demonstrativo e indicadores de custo, receita e rentabilidade.

## Fase 5 - Alertas e painel operacional

- [x] Tipo `alerta_equipamento`, com ativo, locacao/OS relacionada, prazo, prioridade, responsavel e resolucao.
- [x] Tipos de alerta para recolhimento, implantacao, preventiva, calibracao, garantia, conferencia, higienizacao, manutencao, acessorios, extravio e documentos.
- [x] Status de alerta: Aberto, Em tratamento, Resolvido e Ignorado.
- [ ] Criar os workflows agendados para gerar e encerrar alertas.
- [x] Criar painel operacional inicial no Next com recolhimentos atrasados, conferencias e tratativas tecnicas pendentes.
- [x] Criar exportacao CSV do inventario pela tela de equipamentos.
- [ ] Criar filtros avancados, alertas agendados e relatorios financeiros/técnicos.

## Pendencias criticas antes de uso operacional

- [x] Implementar no Next o adaptador de movimentacao com idempotencia e compensacao caso a atualizacao do equipamento falhe.
- [x] Preparar implantacao e recolhimento para registrar a movimentacao e atualizar a locacao sem listas duplicadas no paciente.
- [x] Impedir alteracao manual da situacao do equipamento quando o fluxo novo estiver ativo.
- [ ] Expor as tabelas novas no Data API do Bubble e ativar `EQUIPAMENTOS_V2_ENABLED=true` somente apos a revisao de privacidade.
- [ ] O evento visual criado no Bubble permanece sem corpo; o Next passa a ser a camada operacional do modulo.
- [ ] Configurar validacoes de transicao, concorrencia e operacoes retroativas.
- [x] Criar ficha individual e linha do tempo no Next, com compatibilidade para as locacoes legadas e eventos V2.
- [ ] Criar painel operacional, busca avancada e relatorios.
- [ ] Criar regras de privacidade e API por perfil (deixado para a etapa final, conforme solicitado).
- [ ] Homologar com cenarios de reserva, implantacao, recolhimento, manutencao, baixa e acessorios.

## Revisao de interface - 2026-07-18

Ao revisar o estado real das telas em Next, o modulo estava mais completo do que este documento indicava. Ja possuem interface: inventario/locacoes/pacientes, reserva, conferencia, higienizacao e historico (`gestor/equipamentos`); detalhe da OS com diagnostico, itens, custos, liberacao e baixa recomendada (`gestor/manutencao`); relatorios de inventario, manutencoes e movimentacoes e o painel de alertas (`gestor/equipamentos-relatorios`).

Polish aplicado nesta rodada:

- Normalizados ~40 tons de cor invalidos no Tailwind (`slate-550`, `teal-650`, `blue-650` etc.) que nao geravam CSS; corrigia botoes que ficavam invisiveis (Concluir da higienizacao e Reservar).
- Corrigido placeholder em espanhol para portugues no cadastro de equipamento.
- Corrigidos dois erros de lint que quebravam o `next build` (`DollarSign` sem uso e `as any` na troca de aba).
- `next build` verde em todas as rotas.

Capacidades com backend pronto e ainda sem interface: nenhuma. As tres pendencias abaixo foram construidas em 2026-07-18 seguindo a skill de design impeccable.

- [x] Baixa definitiva: nova pagina `gestor/baixas` (fila de aprovacao, decisao aprovar/reprovar com autorizador, e reversao excepcional com dupla autorizacao + justificativa) + link no shell. Backend: `/baixas` + `aprovar`/`reprovar`/`reverter`.
- [x] Rentabilidade por ativo: painel financeiro no topo do Prontuario (`gestor/equipamentos`), consumindo `/:id/rentabilidade`.
- [x] Gestao de reservas: aba "Reservas" em `gestor/equipamentos` com listagem de reservas ativas, chip de validade e cancelamento (`/reservas/:id/cancelar`).

Backend fino adicionado para dar dados as telas: metodos `getReservasPorStatus` e `getBaixasPorStatus` no `bubbleApi` e rotas de colecao `GET /api/gestor/equipamentos/reservas` e `GET /api/gestor/equipamentos/baixas`.

Verificacao: `next build` verde em todas as rotas e typecheck limpo. A validacao visual em navegador com dados reais depende de `EQUIPAMENTOS_V2_ENABLED=true` e credenciais do Bubble, e ainda nao foi executada.

## Observacao de seguranca

Durante uma atualizacao tecnica do contexto foram identificadas credenciais de integracoes no export do app. Elas nao foram reproduzidas nestes documentos. Rotacione-as e revise a privacidade antes de publicar o modulo.
