# Etapa 5 — Painéis, relatórios, busca e alertas

## Objetivo

Transformar dados operacionais em informação utilizável para logística, manutenção, financeiro e auditoria.

## Resultado esperado

Cada perfil consegue identificar pendências e consultar o histórico necessário sem depender de planilhas externas.

## 1. Ficha individual do equipamento

- [ ] Exibir foto, código interno, série, patrimônio, categoria, marca e modelo.
- [ ] Exibir situação e localização atuais de forma destacada.
- [ ] Exibir paciente e domicílio atual somente para perfis autorizados.
- [ ] Exibir tempo no domicílio, última movimentação e próxima preventiva/calibração.
- [ ] Exibir custo de aquisição, manutenção e receita somente para perfis autorizados.
- [ ] Exibir acessórios atuais e pendências de devolução.
- [ ] Exibir documentos, fotos, termos e ordens de serviço relacionadas.
- [ ] Exibir linha do tempo com filtros por tipo de evento, período e responsável.
- [ ] Permitir abrir a ficha pelo QR Code respeitando autenticação e privacidade.

## 2. Painel operacional

- [ ] Exibir total de equipamentos por situação.
- [ ] Exibir disponíveis, reservados, implantados, em trânsito, em higienização, em manutenção, bloqueados e baixados.
- [ ] Exibir implantações previstas para hoje e próximas datas.
- [ ] Exibir recolhimentos atrasados e pendentes de conferência.
- [ ] Exibir manutenções preventivas e calibrações vencidas/próximas.
- [ ] Exibir equipamentos parados por tempo acima da regra definida.
- [ ] Criar filtros por filial, estoque, categoria, situação e período.
- [ ] Garantir que o painel respeite a visibilidade de cada perfil.

## 3. Busca e localização

- [ ] Implementar busca por código interno, série, patrimônio, QR Code, nome e modelo.
- [ ] Implementar busca por paciente, endereço, profissional responsável e ordem de serviço.
- [ ] Criar filtros por situação, localização, categoria, fabricante, modelo e período de implantação.
- [ ] Permitir acesso rápido ao equipamento a partir de resultado de busca.
- [ ] Registrar e tratar busca sem resultado de forma clara.
- [ ] Avaliar desempenho com inventário real ou volume simulado de equipamentos/movimentações.

## 4. Relatórios operacionais

- [ ] Criar inventário completo com situação e localização atuais.
- [ ] Criar relatório de equipamentos disponíveis, implantados, reservados e em manutenção.
- [ ] Criar relatório de implantações e recolhimentos por período.
- [ ] Criar relatório de equipamentos por paciente e domicílio, com regras de privacidade.
- [ ] Criar relatório de movimentações por profissional.
- [ ] Criar relatório de tempo médio em domicílio, estoque e manutenção.
- [ ] Criar relatório individual de vida do equipamento.

## 5. Relatórios técnicos e financeiros

- [ ] Criar relatório de manutenções por equipamento, fornecedor, defeito e período.
- [ ] Criar relatório de preventivas/calibrações vencidas e próximas.
- [ ] Criar ranking de equipamentos com maior custo de manutenção e maior número de falhas.
- [ ] Criar relatório de receita por equipamento, paciente, contrato ou convênio conforme regra aprovada.
- [ ] Criar comparação entre aquisição, manutenção, receita e rentabilidade.
- [ ] Criar relatório de equipamentos cujo custo ainda não foi recuperado.
- [ ] Separar valores realizados de valores projetados.

## 6. Alertas e pendências

- [ ] Criar regra de alerta para reserva vencida.
- [ ] Criar regra de alerta para implantação prevista não realizada.
- [ ] Criar regra de alerta para recolhimento atrasado.
- [ ] Criar regra de alerta para equipamento recolhido sem conferência.
- [ ] Criar regra de alerta para higienização ou manutenção parada acima do prazo.
- [ ] Criar regra de alerta para preventiva, calibração e garantia próximas do vencimento.
- [ ] Criar regra de alerta para acessório não devolvido.
- [ ] Criar regra de alerta para equipamento extraviado ou bloqueado.
- [ ] Definir destinatários, prioridade, canal e política de encerramento de cada alerta.
- [ ] Evitar alertas duplicados por meio de chave de idempotência ou estado de leitura/resolução.

## 7. Exportação e auditoria de consultas

- [ ] Definir quais relatórios podem ser exportados por perfil.
- [ ] Implementar exportação em formato aprovado, por exemplo CSV ou PDF.
- [ ] Aplicar filtros de privacidade antes da exportação.
- [ ] Registrar exportações de dados sensíveis quando necessário.
- [ ] Verificar se o relatório individual é legível para auditoria e sem campos indevidos.

## Cenários mínimos de teste

- [ ] Conferir números do painel contra amostra manual de equipamentos.
- [ ] Localizar equipamento por QR Code, código interno e número de série.
- [ ] Validar que alerta de preventiva aparece e deixa de aparecer após conclusão registrada.
- [ ] Validar que usuário de consulta não exporta relatório financeiro se não possuir permissão.
- [ ] Gerar relatório de vida do equipamento e conferir eventos, custos e períodos.
- [ ] Validar filtros com dados de duas filiais e múltiplas categorias.

## Critérios de aceite da etapa

- [ ] Painel mostra a situação operacional em tempo compatível com a rotina.
- [ ] Ficha individual reúne histórico, documentos, pendências e indicadores autorizados.
- [ ] Relatórios podem ser filtrados e exportados de forma segura.
- [ ] Alertas são acionáveis, não duplicados e respeitam o perfil destinatário.

