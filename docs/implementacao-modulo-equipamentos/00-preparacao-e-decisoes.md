# Etapa 0 — Preparação, escopo e decisões de negócio

## Objetivo

Eliminar ambiguidades antes de alterar banco de dados, workflows, telas ou integrações. Esta etapa protege o projeto contra retrabalho no fluxo operacional e financeiro.

## Entregáveis

- Escopo da primeira versão aprovado.
- Glossário operacional aprovado.
- Matriz de transições de situação aprovada.
- Regras de cobrança definidas.
- Estratégia de migração dos dados atuais aprovada.
- Ambiente Bubble preparado para desenvolvimento e homologação.

## Checklist de preparação técnica

- [ ] Confirmar qual aplicação Bubble e qual versão será alterada: desenvolvimento, teste ou produção.
- [ ] Criar ou confirmar um ambiente de teste com dados fictícios.
- [ ] Confirmar que existe backup/exportação dos dados atuais antes de qualquer migração.
- [ ] Mapear os tipos de dados existentes: `equipamento`, `locacao_equipamento` e `locais_de_trabalho_pacientes`.
- [ ] Listar todos os campos existentes que não podem ser removidos sem migração.
- [ ] Identificar páginas, workflows e integrações que usam os tipos atuais.
- [ ] Definir um responsável de negócio para aprovar cada mudança de regra.
- [ ] Definir um responsável técnico para executar, testar e registrar a alteração.
- [ ] Configurar controle de versão para os artefatos externos ao Bubble quando aplicável.
- [ ] Configurar acesso ao ambiente Bubble apenas para pessoas autorizadas.

## Checklist de acesso e segurança

- [ ] Definir quem será Administrador, Estoque/Logística, Manutenção, Financeiro e Auditoria.
- [ ] Aprovar quais perfis podem visualizar dados de paciente e endereço.
- [ ] Aprovar quais perfis podem visualizar custo de aquisição, custo de manutenção e receita.
- [ ] Definir quem pode corrigir uma data retroativa e como a justificativa será registrada.
- [ ] Definir quem pode bloquear, condenar, baixar ou reverter uma baixa.
- [ ] Definir prazo de retenção para fotos, termos, laudos e documentos fiscais.
- [ ] Definir procedimento para acesso emergencial e revisão periódica de permissões.

## Decisões de negócio obrigatórias

### Identificação e inventário

- [ ] Aprovar o padrão do código interno, por exemplo `EQP-AAAA-000001`.
- [ ] Definir se o número de série é obrigatório para todas as categorias ou somente para ativos serializados.
- [ ] Definir se o código patrimonial será obrigatório, opcional ou inexistente.
- [ ] Definir categorias iniciais de equipamento.
- [ ] Definir quais categorias exigem calibração, validade, preventiva ou acessórios obrigatórios.
- [ ] Definir se o QR Code apontará para página autenticada, consulta pública limitada ou ambas.

### Localização e operação

- [ ] Listar filiais, estoques, assistências técnicas e demais localizações internas.
- [ ] Definir se um veículo ou profissional em rota será uma localização rastreável.
- [ ] Definir quais estados são permitidos para equipamento em transporte.
- [ ] Definir o checklist mínimo de conferência no retorno.
- [ ] Definir o checklist mínimo de higienização por categoria de equipamento.
- [ ] Definir se fotos e assinatura serão obrigatórias na implantação e/ou recolhimento.

### Locação e faturamento

- [ ] Definir as modalidades aceitas: diária, mensalidade fechada, mensalidade proporcional, valor personalizado e comodato.
- [ ] Definir a regra para implantação e recolhimento no mesmo dia.
- [ ] Definir a regra de proporcionalidade por meses de 28, 29, 30 e 31 dias.
- [ ] Definir se existe período mínimo, franquia, taxa de implantação ou taxa de recolhimento.
- [ ] Definir quando desconto pode ser aplicado, por quem e se requer aprovação.
- [ ] Definir como a troca de equipamento no meio de uma locação afeta a cobrança.
- [ ] Definir o comportamento para locação sem data de recolhimento.

### Manutenção e baixa

- [ ] Definir quem abre ordem de serviço e quem pode concluir tecnicamente.
- [ ] Definir se orçamento acima de determinado valor exige aprovação adicional.
- [ ] Definir o critério de “reparo economicamente inviável”.
- [ ] Definir quem pode aprovar baixa e qual documentação é obrigatória por motivo.
- [ ] Definir se equipamento reparado com restrição pode voltar a ser implantado e sob quais condições.

## Matriz inicial de transições a aprovar

| Situação atual | Ação | Nova situação esperada | Perfil mínimo |
| --- | --- | --- | --- |
| Aguardando conferência | Conferir entrada | Aguardando higienização ou Em manutenção | Estoque/Logística |
| Disponível em estoque | Reservar | Reservado | Estoque/Logística |
| Reservado | Despachar para paciente | Em transporte para implantação | Estoque/Logística |
| Em transporte para implantação | Confirmar entrega | Implantado no domicílio | Estoque/Logística |
| Implantado no domicílio | Iniciar retirada | Em transporte para recolhimento | Estoque/Logística |
| Em transporte para recolhimento | Confirmar recolhimento | Recolhido e aguardando conferência | Estoque/Logística |
| Aguardando higienização | Concluir higienização | Disponível em estoque ou Em manutenção | Estoque/Logística / Manutenção |
| Em manutenção | Concluir reparo e teste | Disponível em estoque, Bloqueado ou Condenado | Manutenção |
| Condenado | Aprovar baixa | Baixado | Administrador |

> A matriz final deve incluir cancelamento de reserva, transferência, extravio, bloqueio e exceções autorizadas.

## Critérios de aceite da etapa

- [ ] Escopo do MVP assinado pelo responsável de negócio.
- [ ] Matriz de perfis e permissões aprovada.
- [ ] Regras de cobrança aprovadas por Financeiro.
- [ ] Matriz de transições aprovada por Estoque e Manutenção.
- [ ] Estratégia de migração e contingência aprovada.
- [ ] Nenhuma decisão pendente bloqueando a etapa 1.

