# Análise do módulo de aluguel e gestão de equipamentos para home care

**Objetivo deste documento:** comparar a visão funcional proposta para o módulo com o estado atual do projeto e orientar a evolução do produto.

**Data:** 15 de julho de 2026  
**Escopo da análise:** gestão de equipamentos, locações e operação de home care.  
**Alterações realizadas:** nenhuma. Este documento é somente uma análise.

## 1. Conclusão executiva

A proposta está bem direcionada e vai além de um simples controle de aluguel. Ela define um **prontuário individual do equipamento**, no qual cada ativo possui identidade, estado, localização, custos, receitas e um histórico completo de eventos.

Esse é o modelo adequado para uma operação de home care. O equipamento deve ser a entidade central; a locação é apenas um dos eventos de seu ciclo de vida.

O módulo existente é um MVP de locação. Ele permite cadastrar equipamentos, pacientes e locações, mas ainda não cobre o controle operacional necessário para garantir rastreabilidade, segurança e consistência no ciclo completo do ativo.

## 2. Situação atual do módulo

O projeto atual possui:

- Cadastro básico de equipamento: nome, descrição, marca, modelo, número de série, preço padrão e situação.
- Situações atuais: `Disponível`, `Alugado`, `Manutenção` e `Inativo`.
- Cadastro simplificado de paciente e endereço.
- Locação com equipamento, paciente, datas previstas, valor e observações.
- Encerramento de locação com data de devolução e alteração manual do estado do equipamento.
- Painel com totais de equipamentos, disponíveis, alugados, em manutenção e faturamento estimado.

Isso é uma boa base visual, mas não representa ainda o prontuário operacional do equipamento.

## 3. Comparação entre o desejado e o existente

| Tema | Módulo atual | Necessidade proposta |
| --- | --- | --- |
| Equipamento | Cadastro e status simples | Cadastro individual completo, origem, patrimônio, QR Code, documentos, garantia, custos e localização |
| Status | Quatro estados | Máquina de estados operacional, incluindo reserva, trânsito, implantação, conferência, higienização, manutenção, baixa e bloqueios |
| Locação | Registro de período e valor único | Contrato com regra de cobrança, diárias/mensalidades, taxas, descontos, acessórios e valores históricos preservados |
| Recolhimento | Finaliza locação e define status | Solicitação, retirada, evidências, acessórios, conferência, higienização e teste antes de disponibilizar |
| Manutenção | Status isolado | Ordem de serviço, diagnóstico, peças, custo, garantia, teste, preventiva e calibração |
| Histórico | Não existe linha do tempo imutável | Registro de cada evento, autor, data, antes/depois, local e evidências |
| Segurança | Sessão de acesso | Perfis por função, privacidade de dados sensíveis e auditoria de ações |
| Relatórios | Painel resumido | Inventário, utilização, manutenção, rentabilidade, vida útil, alertas e auditoria |

## 4. Principais riscos identificados no módulo atual

### 4.1. Disponibilidade não é validada de forma centralizada

Ao criar uma locação, o sistema cria o registro e altera o equipamento para `Alugado`. Não existe uma validação central que impeça, de forma confiável, a locação de um equipamento já implantado, reservado, em manutenção, bloqueado ou baixado.

Isso abre espaço para duas locações simultâneas do mesmo equipamento, especialmente se dois usuários realizarem a operação ao mesmo tempo.

### 4.2. A criação da locação não é atômica

Atualmente há, em sequência, três ações:

1. Criar a locação.
2. Alterar a situação do equipamento.
3. Associar equipamento e locação ao paciente.

Se uma etapa posterior falhar, pode existir uma locação ativa sem o equipamento correspondente marcado como alugado, ou vice-versa. O fluxo futuro deve ser transacional ou controlado por um workflow único e idempotente.

### 4.3. Recolhimento pode liberar o equipamento cedo demais

O encerramento atual permite encaminhar diretamente o equipamento para `Disponível`. Em home care, o recolhimento deve levá-lo a uma etapa de conferência e, quando necessário, higienização, teste ou manutenção. Só depois ele pode voltar ao estoque disponível.

### 4.4. Dados de paciente são parcialmente descartados

O formulário recebe CPF, WhatsApp e e-mail, mas a integração atual persiste apenas nome, endereço e tipo. Além de ser uma perda de informação operacional, isso deve ser revisado junto com as regras de privacidade para dados pessoais.

### 4.5. Relações duplicadas podem ficar inconsistentes

O módulo mantém listas de equipamentos e locações no registro do paciente. Essas listas podem divergir dos registros reais de locação. A fonte de verdade deve ser a locação e, principalmente, os eventos de movimentação; listas derivadas devem ser apenas otimizações de consulta, nunca o histórico oficial.

### 4.6. Não há auditoria nem controle por perfil

O projeto verifica se existe sessão, mas não separa permissões de Administrador, Estoque/Logística, Manutenção, Financeiro e Auditoria. Também não há registro obrigatório de quem alterou cada dado, quando e qual era o valor anterior.

## 5. Arquitetura funcional recomendada

### 5.1. Equipamento como entidade central

Cada unidade física deve possuir uma ficha individual. Mesmo equipamentos de mesmo modelo precisam ter códigos e históricos próprios.

Informações principais:

- Código interno único e QR Code.
- Número de série, patrimônio, categoria, marca, fabricante e modelo.
- Origem, fornecedor, nota fiscal, valor de aquisição e garantia.
- Estado, situação e localização atuais.
- Próximas manutenções, calibrações e vida útil.
- Custos acumulados, receita acumulada e situação patrimonial.

### 5.2. Movimentação imutável como fonte de verdade

Toda ação operacional deve gerar uma movimentação. Não se deve apenas alterar o campo de situação do equipamento diretamente por uma tela.

Cada movimentação deve registrar:

- Data e hora.
- Tipo do evento.
- Situação anterior e nova situação.
- Local anterior e novo local.
- Paciente, domicílio ou filial relacionados.
- Profissional responsável pela operação.
- Usuário que registrou a ação.
- Observações, fotos, documentos e custos aplicáveis.
- Justificativa para data retroativa ou correção.

O estado atual do equipamento pode continuar armazenado para consulta rápida, mas deve sempre ser atualizado pelo mesmo fluxo que cria o evento.

### 5.3. Entidades recomendadas

| Entidade | Responsabilidade |
| --- | --- |
| Equipamento | Cadastro físico, identificação, situação e localização atuais |
| Localização/Estoque | Filial, almoxarifado, manutenção, transporte ou domicílio |
| Paciente | Dados do paciente, sob regras de privacidade |
| Domicílio | Endereço e orientações de acesso; pode ser reutilizado pelo paciente |
| Reserva | Bloqueio temporário de um equipamento para paciente e domicílio |
| Locação/Implantação | Período de uso, valores contratados e regras de cobrança |
| Movimentação | Linha do tempo imutável do equipamento |
| Acessório | Item que acompanha ou pertence ao equipamento |
| Acessório da movimentação | Quantidade enviada/devolvida, estado e pendências |
| Ordem de manutenção | Diagnóstico, peças, serviços, custos, garantia e resultado |
| Tabela de preços | Valores por categoria, contrato, convênio e vigência |
| Auditoria | Alterações de cadastro, decisões sensíveis e tentativas não permitidas |

## 6. Status operacional recomendados

O equipamento deve ter uma única situação principal. Uma sugestão de máquina de estados é:

- Aguardando conferência.
- Disponível em estoque.
- Reservado.
- Em transporte para implantação.
- Implantado no domicílio.
- Em transporte para recolhimento.
- Recolhido e aguardando conferência.
- Aguardando higienização.
- Em higienização.
- Em manutenção.
- Aguardando peça.
- Bloqueado.
- Extraviado.
- Condenado.
- Baixado.

Resultados como “liberado pela manutenção” podem ser eventos ou resultados de uma ordem de serviço, levando o equipamento para conferência ou disponível conforme a regra operacional definida.

## 7. Regras de negócio que devem ser obrigatórias

1. Um equipamento não pode ter duas implantações ativas ao mesmo tempo.
2. Apenas equipamentos liberados e disponíveis podem ser reservados ou implantados.
3. Equipamentos em manutenção, bloqueados, condenados, extraviados ou baixados não podem ser implantados.
4. Toda entrega, retirada, transferência e manutenção deve identificar responsável e usuário registrador.
5. Recolhimento encerra a locação, mas não torna automaticamente o equipamento disponível.
6. Os valores de uma locação devem ser congelados no momento da contratação.
7. Alteração de preços futuros não pode modificar períodos já contratados.
8. Toda manutenção deve terminar com um resultado, inclusive quando não houver custo ou defeito.
9. Baixa exige justificativa, evidência e autorização de perfil específico.
10. Movimentações não podem ser apagadas silenciosamente; correções devem criar eventos de ajuste e auditoria.
11. Datas retroativas exigem justificativa e permissão especial.
12. Acessórios enviados e devolvidos devem ser conferidos em cada implantação e recolhimento.

## 8. Estratégia de implantação recomendada

### Fase 1 — Fundamentos e segurança

- Perfis e permissões.
- Cadastro individual do equipamento.
- Código interno único, número de série e QR Code.
- Paciente e domicílio separados.
- Localizações e estoques.
- Histórico de movimentação e auditoria.
- Validações centralizadas de estado.

### Fase 2 — Operação de estoque e home care

- Entrada no estoque.
- Reserva com validade.
- Implantação.
- Recolhimento.
- Conferência e higienização.
- Transferências entre estoques, filiais e domicílios.
- Acessórios por movimentação.

### Fase 3 — Manutenção e ciclo de vida

- Ordens de serviço.
- Diagnóstico, orçamento, peças e mão de obra.
- Preventiva, calibração e alertas.
- Teste e liberação.
- Bloqueio, condenação e baixa.

### Fase 4 — Financeiro e inteligência operacional

- Tabelas de preço e contratos.
- Diária, mensalidade, proporcionalidade, taxas e descontos.
- Demonstrativos de locação.
- Custo de aquisição, manutenção, receita e rentabilidade.
- Painel operacional, alertas e relatórios.

### Fase 5 — Recursos adicionais

- Assinatura digital.
- Foto e geolocalização de entrega/recolhimento.
- Integração com cobrança, nota fiscal e sistemas clínicos.
- Aplicativo ou interface móvel para entregadores.

## 9. MVP recomendado

Para disponibilizar uma primeira versão confiável, o foco deve ser:

- Cadastro individual de equipamentos, pacientes, domicílios e localizações.
- Código único e QR Code.
- Estados operacionais e validação de transições.
- Reserva, implantação e recolhimento.
- Conferência/higienização antes da disponibilidade.
- Linha do tempo imutável do equipamento.
- Valor de diária ou mensalidade congelado por locação.
- Registro inicial de manutenção e custo.
- Painel de disponibilidade e relatório individual do equipamento.

Assinatura digital, geolocalização, cobrança automática, integrações fiscais e aplicativo de entregas podem entrar depois sem comprometer o núcleo do sistema.

## 10. Recomendação final

Não é indicado apenas adicionar novos campos à tela atual de locação. O módulo deve evoluir para um fluxo operacional baseado em estados e eventos, com o equipamento como centro da informação.

O princípio que deve orientar o desenvolvimento é:

> Qualquer pessoa autorizada deve conseguir abrir a ficha de um equipamento e entender, sem planilhas externas, onde ele está, por onde passou, quanto custou, quanto gerou e qual é sua condição para o próximo uso.

Essa abordagem reduz perdas, locações duplicadas, equipamentos indevidamente liberados, falhas de cobrança e dependência de informações informais.
