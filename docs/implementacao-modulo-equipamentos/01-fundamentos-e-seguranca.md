# Etapa 1 — Fundamentos, segurança e máquina de estados

## Objetivo

Criar a base confiável do módulo: modelo de dados, identificação individual, permissões, histórico imutável e transições de situação validadas.

## Resultado esperado

Um equipamento pode ser cadastrado com identidade única, possui uma situação e localização atuais, e toda alteração operacional deixa uma movimentação auditável.

## 1. Modelagem de dados

### Equipamento

- [ ] Criar ou evoluir o tipo `Equipamento`.
- [ ] Adicionar `codigo_interno` com regra de unicidade.
- [ ] Adicionar `numero_serie`, `numero_patrimonio`, categoria, fabricante, marca, modelo e descrição.
- [ ] Adicionar foto principal e lista de documentos técnicos.
- [ ] Adicionar tipo de origem: compra, locação, comodato, doação ou outro.
- [ ] Adicionar fornecedor, data de aquisição, nota fiscal, valor de aquisição, garantia e término de garantia.
- [ ] Adicionar estado de conservação inicial, primeiro uso, vida útil estimada e intervalo de preventiva.
- [ ] Adicionar situação atual e localização atual como dados de consulta rápida.
- [ ] Adicionar indicadores calculados ou atualizáveis: última movimentação, próxima preventiva, total de manutenção, total de receitas e quantidade de implantações.
- [ ] Garantir que o código interno não possa ser alterado após a criação, salvo processo administrativo auditado.

### Paciente e domicílio

- [ ] Criar ou evoluir o tipo `Paciente` para dados pessoais necessários e mínimos.
- [ ] Criar o tipo `Domicilio` separado de paciente.
- [ ] Adicionar endereço estruturado: CEP, logradouro, número, complemento, bairro, cidade, estado e referência.
- [ ] Adicionar contato local e instruções de acesso.
- [ ] Associar domicílio ao paciente sem apagar históricos de endereços anteriores.
- [ ] Definir quais campos são sensíveis e devem ter privacidade reforçada.

### Localização

- [ ] Criar tipo ou opção de `Localizacao` para filiais, estoques, assistência técnica e outras posições internas.
- [ ] Adicionar nome, tipo, endereço, responsável e indicador de ativo.
- [ ] Definir se domicílio do paciente será referenciado como localização operacional ou somente via implantação.

### Movimentação

- [ ] Criar o tipo `MovimentacaoEquipamento` como registro imutável.
- [ ] Adicionar equipamento, tipo de evento, data/hora, situação anterior e nova situação.
- [ ] Adicionar localização anterior e nova localização.
- [ ] Adicionar paciente, domicílio, locação e ordem de serviço quando aplicáveis.
- [ ] Adicionar profissional responsável pela operação e usuário que registrou o evento.
- [ ] Adicionar observação, justificativa, fotos, documentos e campos de correção quando aplicáveis.
- [ ] Criar identificador de idempotência ou chave operacional para impedir duplicação de evento em reenvios.
- [ ] Impedir exclusão de movimentações para todos os perfis comuns.

### Auditoria

- [ ] Criar `Auditoria` ou evoluir o log existente para registrar alterações cadastrais e ações sensíveis.
- [ ] Registrar usuário, data/hora, entidade afetada, campo alterado, valor anterior e novo valor.
- [ ] Registrar motivo da alteração quando o campo for sensível: status, valor, data, baixa, manutenção ou endereço.
- [ ] Registrar tentativa de operação negada quando tecnicamente possível.
- [ ] Definir política de retenção e acesso aos logs.

## 2. Identificação e QR Code

- [ ] Implementar geração sequencial de código interno sem colisão.
- [ ] Validar unicidade de número de série quando a categoria exigir.
- [ ] Definir comportamento para equipamento sem número de série do fabricante.
- [ ] Gerar QR Code a partir de URL estável da ficha do equipamento.
- [ ] Garantir que a URL do QR Code não exponha dados de paciente sem autenticação.
- [ ] Criar função de impressão ou exportação de etiqueta.
- [ ] Testar leitura do QR Code em dispositivo móvel.

## 3. Perfis e regras de privacidade

- [ ] Criar os perfis: Administrador, Estoque/Logística, Manutenção, Financeiro e Consulta/Auditoria.
- [ ] Definir permissões por tipo de dado e ação, não apenas por página.
- [ ] Garantir que Estoque não visualize custos financeiros além do necessário.
- [ ] Garantir que Financeiro não altere laudos ou libere equipamentos tecnicamente.
- [ ] Garantir que Auditoria não altere movimentações, locações ou cadastros.
- [ ] Restringir documentos de pacientes, termos e fotos de entrega a perfis autorizados.
- [ ] Validar regras de privacidade do Bubble com usuários de cada perfil.
- [ ] Revisar se chamadas de API respeitam a mesma autorização das telas.

## 4. Máquina de estados e serviço de transição

- [ ] Criar uma lista controlada de situações operacionais.
- [ ] Implementar tabela de transições permitidas conforme decisão da etapa 0.
- [ ] Criar um único workflow/serviço para executar transições.
- [ ] Validar situação atual antes de criar qualquer nova movimentação.
- [ ] Validar se o perfil do usuário pode realizar aquela transição.
- [ ] Criar a movimentação antes ou na mesma unidade lógica da atualização do estado atual.
- [ ] Atualizar situação, localização e data da última movimentação do equipamento.
- [ ] Recusar transições inválidas com mensagem clara ao usuário.
- [ ] Impedir que uma página faça alteração direta de situação sem passar pelo fluxo central.
- [ ] Implementar mecanismo de idempotência para evitar duplicidade por duplo clique, timeout ou reenvio.
- [ ] Criar rotina de reconciliação para detectar equipamento e última movimentação em estados divergentes.

## 5. Telas básicas

- [ ] Criar lista de equipamentos com código, identificação, situação, localização e próxima pendência.
- [ ] Criar formulário de cadastro e edição controlada de equipamento.
- [ ] Criar ficha individual do equipamento.
- [ ] Exibir situação atual, localização, última movimentação, garantia e próxima preventiva na ficha.
- [ ] Criar linha do tempo inicial, ordenada da movimentação mais recente para a mais antiga.
- [ ] Exibir anexos e fotos com controle de acesso.
- [ ] Criar busca por código interno, número de série, patrimônio, nome e modelo.

## Cenários mínimos de teste

- [ ] Cadastrar dois equipamentos de mesmo modelo, com códigos internos diferentes.
- [ ] Tentar cadastrar dois equipamentos com mesmo número de série em categoria serializada.
- [ ] Alterar situação por fluxo autorizado e confirmar a movimentação criada.
- [ ] Tentar alterar situação por perfil sem permissão.
- [ ] Tentar excluir uma movimentação já registrada.
- [ ] Validar que um usuário financeiro não visualiza dados técnicos restritos, se esta for a regra aprovada.
- [ ] Simular dois envios da mesma transição e confirmar que só um evento foi registrado.

## Critérios de aceite da etapa

- [ ] Todo equipamento possui código interno único.
- [ ] Todo equipamento possui situação e localização atuais válidas.
- [ ] Toda transição permitida gera uma movimentação com autor e data/hora.
- [ ] Transições inválidas ou sem permissão são recusadas.
- [ ] O histórico de movimentações não pode ser apagado pelos usuários operacionais.
- [ ] Ficha do equipamento mostra informações básicas e linha do tempo.

