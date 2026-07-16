# Etapa 3 — Manutenção, preventiva, calibração e baixa

## Objetivo

Controlar todo o ciclo técnico do equipamento: defeitos, ordens de serviço, peças, custos, garantias, preventivas, calibrações, condenação e baixa.

## Resultado esperado

Todo equipamento em manutenção possui ordem de serviço e resultado técnico. Equipamentos só retornam à operação após liberação registrada; baixas são autorizadas e irreversíveis no fluxo normal.

## 1. Ordem de serviço corretiva

- [ ] Criar tipo `OrdemServicoManutencao` com número único.
- [ ] Registrar equipamento, data/hora de entrada, motivo, defeito relatado e quem identificou.
- [ ] Registrar local onde a falha ocorreu: estoque, transporte, domicílio, assistência técnica ou outro.
- [ ] Anexar fotos, vídeos, laudos e documentos de recebimento.
- [ ] Registrar assistência técnica responsável e dados de contato.
- [ ] Vincular equipamento substituto, se a manutenção gerou troca em domicílio.
- [ ] Alterar equipamento para `Em manutenção` ou `Aguardando peça`, conforme resultado.
- [ ] Criar movimentação automática de entrada em manutenção.

## 2. Diagnóstico e aprovação

- [ ] Registrar data do diagnóstico, defeito encontrado e causa provável.
- [ ] Registrar peças necessárias, serviço recomendado, orçamento e prazo estimado.
- [ ] Registrar técnico responsável e condição de garantia.
- [ ] Definir regra de aprovação por valor, tipo de equipamento ou responsável.
- [ ] Registrar aprovação, reprovação ou pedido de revisão do orçamento.
- [ ] Impedir execução sem aprovação quando a regra exigir.
- [ ] Registrar justificativa obrigatória em reprovação e em mudança de orçamento.

## 3. Execução e custo

- [ ] Criar registros filhos para peças utilizadas: descrição, quantidade, custo unitário e fornecedor.
- [ ] Criar registros filhos para serviços: descrição, mão de obra, custo e responsável.
- [ ] Registrar frete, taxas, outros custos e custo total calculado.
- [ ] Anexar nota fiscal, comprovante e garantia do serviço.
- [ ] Registrar data de conclusão e garantia do reparo.
- [ ] Atualizar custo acumulado de manutenção do equipamento somente pelo fluxo validado.
- [ ] Garantir que ajuste de custo posterior deixe auditoria de antes/depois.

## 4. Resultado, teste e liberação

- [ ] Criar resultados controlados: reparado e liberado, reparado com restrições, aguardando peça, sem defeito identificado, reparo não aprovado, sem reparo possível e recomendado para baixa.
- [ ] Exigir resultado para fechar toda ordem de serviço.
- [ ] Criar checklist de teste funcional após reparo.
- [ ] Registrar data/hora, responsável e evidências do teste.
- [ ] Definir se equipamento reparado com restrição pode voltar ao estoque ou fica bloqueado.
- [ ] Alterar situação para disponível somente após teste e liberação autorizados.
- [ ] Criar movimentação de liberação, bloqueio ou condenação.

## 5. Preventiva e calibração

- [ ] Criar configuração por categoria/modelo: periodicidade por dias, uso, calibração ou vida útil de peça.
- [ ] Calcular e salvar próxima preventiva a partir da última execução ou primeiro uso.
- [ ] Criar agenda de preventivas pendentes, próximas e vencidas.
- [ ] Criar registro de preventiva com checklist, responsável, custo e evidências.
- [ ] Criar campos para certificado de calibração, validade e próxima calibração.
- [ ] Alertar para preventiva/calibração próxima e vencida.
- [ ] Definir regra para equipamento implantado que vence preventiva: alerta, recolhimento programado ou bloqueio imediato.
- [ ] Atualizar a próxima data somente quando a manutenção/preventiva foi efetivamente concluída.

## 6. Bloqueio, extravio, condenação e baixa

- [ ] Criar ações específicas para bloqueio, extravio, condenação e baixa.
- [ ] Exigir motivo, data, responsável, evidências e observações em cada ação.
- [ ] Exigir laudo técnico para condenação quando aplicável.
- [ ] Registrar valor estimado de reparo, valor residual e destino final na baixa.
- [ ] Exigir aprovação por perfil autorizado antes da situação `Baixado`.
- [ ] Impedir locação, reserva, transferência e manutenção comum após baixa.
- [ ] Definir fluxo excepcional de reversão de baixa com dupla autorização e auditoria reforçada.
- [ ] Registrar furto/roubo ou extravio com dados suficientes para procedimentos internos e relatórios.

## Cenários mínimos de teste

- [ ] Abrir ordem de serviço a partir de recolhimento por defeito.
- [ ] Tentar fechar ordem sem resultado técnico.
- [ ] Registrar manutenção sem custo e confirmar que o evento permanece válido.
- [ ] Registrar peças, serviços e frete e conferir totalização.
- [ ] Liberar reparo e confirmar teste obrigatório antes de disponibilidade.
- [ ] Vencer preventiva de equipamento implantado e validar o alerta definido.
- [ ] Tentar implantar equipamento condenado ou baixado.
- [ ] Aprovar baixa e confirmar bloqueio definitivo das operações comuns.

## Critérios de aceite da etapa

- [ ] Todo equipamento em manutenção possui ordem de serviço aberta ou referência equivalente.
- [ ] Toda ordem possui resultado, responsável, datas e custos auditáveis.
- [ ] Equipamento só volta a disponível após liberação e teste quando a categoria exigir.
- [ ] Preventivas e calibrações possuem agenda e alertas.
- [ ] Baixas exigem autorização e não permitem retorno acidental à operação.

