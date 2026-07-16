# Plano de implementação — módulo de equipamentos e locações

Este diretório transforma a análise funcional em um roteiro de implementação incremental para o GestorCoop.

## Objetivo

Entregar um módulo em que cada equipamento possua uma ficha individual e rastreável durante todo o ciclo de vida: entrada, estoque, reserva, implantação, recolhimento, higienização, manutenção, locação e baixa.

O equipamento é a entidade central. A situação e a localização atuais são dados de consulta rápida, sempre atualizados por meio de movimentações registradas no histórico.

## Ordem de execução

| Etapa | Documento | Resultado principal | Dependência |
| --- | --- | --- | --- |
| 0 | [00-preparacao-e-decisoes.md](00-preparacao-e-decisoes.md) | Escopo fechado, ambiente seguro e regras aprovadas | Nenhuma |
| 1 | [01-fundamentos-e-seguranca.md](01-fundamentos-e-seguranca.md) | Modelo de dados, perfis, auditoria e máquina de estados | Etapa 0 |
| 2 | [02-estoque-e-movimentacoes.md](02-estoque-e-movimentacoes.md) | Entrada, reserva, implantação, recolhimento, conferência e acessórios | Etapa 1 |
| 3 | [03-manutencao-e-ciclo-de-vida.md](03-manutencao-e-ciclo-de-vida.md) | Ordem de serviço, preventivas, calibrações e baixa | Etapas 1 e 2 |
| 4 | [04-locacao-e-financeiro.md](04-locacao-e-financeiro.md) | Preços históricos, cálculo de locação, custos e rentabilidade | Etapas 1 e 2 |
| 5 | [05-paineis-relatorios-e-alertas.md](05-paineis-relatorios-e-alertas.md) | Painel operacional, relatórios, busca e alertas | Etapas 1 a 4 |
| 6 | [06-homologacao-e-entrada-em-producao.md](06-homologacao-e-entrada-em-producao.md) | Testes, migração, treinamento e liberação segura | Etapas 0 a 5 |

## Princípios inegociáveis

- Cada unidade física de equipamento tem cadastro e código interno próprios.
- Nenhuma movimentação é apagada silenciosamente.
- Um equipamento não pode ter duas implantações ou locações ativas simultâneas.
- A tela não altera diretamente a situação do equipamento; ela solicita uma operação de negócio que valida e registra a movimentação.
- Recolhimento não torna o equipamento automaticamente disponível.
- O valor contratado fica preservado na locação, mesmo se a tabela de preços mudar.
- Ações sensíveis exigem perfil autorizado, justificativa e auditoria.
- Dados de pacientes e evidências operacionais são protegidos por regras de acesso.

## Convenções para os checklists

- `[ ]` = item pendente.
- `[x]` = item concluído e validado.
- **Critério de aceite** = condição objetiva para considerar a etapa pronta.
- **Decisão pendente** = ponto que precisa de aprovação do negócio antes da implementação.

## Como usar este plano

1. Concluir a etapa 0 antes de criar tipos de dados ou páginas.
2. Não iniciar uma etapa cuja dependência não esteja aceita.
3. Preencher os checklists conforme os itens forem homologados.
4. Registrar decisões que mudem uma regra de negócio no documento da etapa correspondente.
5. Antes de publicar, executar integralmente a etapa 6.

