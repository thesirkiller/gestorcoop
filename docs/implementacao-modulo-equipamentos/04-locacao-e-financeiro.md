# Etapa 4 — Locação, preços, custos e rentabilidade

## Objetivo

Formalizar a locação como contrato operacional e financeiro, preservando preços históricos e permitindo análise de receita, custos e rentabilidade por equipamento.

## Resultado esperado

Cada implantação possui valores contratados, regras de cobrança e período verificável. Alterações futuras de tabela não alteram a cobrança histórica.

## 1. Tabelas de preço

- [ ] Criar tipo `TabelaPreco` com nome, vigência, ativo e responsável pela aprovação.
- [ ] Criar itens de preço por categoria, modelo, acessório, contrato, convênio ou regra específica.
- [ ] Adicionar valores de diária, mensalidade, implantação, recolhimento e acessórios.
- [ ] Adicionar regra de franquia, período mínimo e desconto máximo permitido.
- [ ] Definir precedência de preços: contrato específico, convênio, categoria/modelo e preço padrão.
- [ ] Impedir alteração de tabela já usada em locações históricas; criar nova vigência quando necessário.
- [ ] Auditar criação, ativação, desativação e alteração de valores.

## 2. Contrato de locação/implantação

- [ ] Evoluir o registro de locação para conter número interno, paciente, domicílio, equipamento e status.
- [ ] Salvar modalidade de cobrança selecionada.
- [ ] Salvar o preço contratado como cópia/snapshot, não como consulta dinâmica à tabela.
- [ ] Salvar diária, mensalidade, taxas, descontos, franquias e valor de acessórios aplicados.
- [ ] Registrar data/hora de início efetivo da locação.
- [ ] Registrar data prevista de encerramento quando houver.
- [ ] Vincular termo de entrega, comprovantes e assinatura quando aplicável.
- [ ] Vincular locação à implantação e ao recolhimento correspondentes.
- [ ] Impedir mais de uma locação ativa para o mesmo equipamento.

## 3. Cálculo do período e demonstrativo

- [ ] Implementar cálculo de dias entre início e recolhimento efetivo.
- [ ] Implementar regra de cobrança para início e fim no mesmo dia.
- [ ] Implementar mensalidade fechada, proporcional, diária, personalizado e comodato.
- [ ] Definir tratamento de meses com diferentes quantidades de dias.
- [ ] Definir tratamento de suspensão temporária autorizada no domicílio.
- [ ] Definir tratamento financeiro de troca de equipamento durante locação.
- [ ] Criar demonstrativo com período, regra aplicada, valores, desconto, taxas e total estimado.
- [ ] Exibir claramente se a locação ainda está aberta e até qual data o cálculo foi projetado.
- [ ] Não sobrescrever demonstrativos históricos sem criar versão ou ajuste auditado.

## 4. Custos e rentabilidade do equipamento

- [ ] Consolidar valor de aquisição do equipamento.
- [ ] Consolidar custos de manutenção aprovados.
- [ ] Definir se custos de higienização, transporte e acessórios serão incluídos na rentabilidade.
- [ ] Consolidar receita das locações encerradas e receita estimada das locações abertas em indicadores separados.
- [ ] Calcular resultado bruto por equipamento: receita menos aquisição e custos considerados.
- [ ] Exibir quantidade de implantações, dias implantados, dias em estoque e dias em manutenção.
- [ ] Criar indicador de recuperação do custo de aquisição.
- [ ] Manter transparência de fórmulas: cada indicador deve permitir consultar seus eventos de origem.

## 5. Controles e permissões financeiras

- [ ] Permitir alteração de preço somente a Financeiro/Administrador conforme matriz aprovada.
- [ ] Exigir motivo e autorização para desconto acima de limite definido.
- [ ] Bloquear alteração de valor contratado após implantação; permitir apenas ajuste formal auditado.
- [ ] Limitar visibilidade de custos e rentabilidade a perfis autorizados.
- [ ] Registrar quem gerou ou exportou demonstrativos financeiros quando necessário.

## Cenários mínimos de teste

- [ ] Criar locação mensal com preço de tabela e confirmar snapshot do valor.
- [ ] Alterar preço da tabela e confirmar que locação anterior não foi alterada.
- [ ] Criar locação diária e validar cálculo de período.
- [ ] Criar locação proporcional que atravesse meses de durações diferentes.
- [ ] Criar comodato e confirmar valor zero, mantendo histórico da operação.
- [ ] Substituir equipamento no meio da locação e validar períodos e valores.
- [ ] Registrar desconto acima do limite e confirmar exigência de aprovação.
- [ ] Conferir que custo de manutenção impacta a rentabilidade definida.

## Critérios de aceite da etapa

- [ ] Toda locação possui valor histórico preservado e modalidade de cobrança definida.
- [ ] Alterações de tabela não mudam períodos já contratados.
- [ ] Recolhimento fecha ou atualiza o período financeiro conforme regra aprovada.
- [ ] Demonstrativo detalha como o valor foi calculado.
- [ ] Indicadores financeiros distinguem receita realizada de receita estimada.

