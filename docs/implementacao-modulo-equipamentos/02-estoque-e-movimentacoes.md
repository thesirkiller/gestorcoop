# Etapa 2 — Estoque, implantação, recolhimento e acessórios

## Objetivo

Implementar o fluxo físico do equipamento entre estoque, paciente, transporte, conferência e higienização, mantendo rastreabilidade e impedindo disponibilidade indevida.

## Resultado esperado

Uma operação consegue reservar, entregar, recolher, conferir e liberar um equipamento sem quebrar o histórico ou permitir uso simultâneo.

## 1. Entrada e conferência em estoque

- [ ] Criar ação de entrada de equipamento recém-adquirido, recebido ou devolvido de terceiro.
- [ ] Registrar origem, fornecedor/remetente, documento, data/hora e responsável pelo recebimento.
- [ ] Criar movimentação com situação inicial `Aguardando conferência`.
- [ ] Criar checklist de conferência: identificação, acessórios, aparência, documentos, funcionamento básico e fotos.
- [ ] Permitir resultado da conferência: disponível, aguardando higienização, em manutenção, bloqueado ou outra situação autorizada.
- [ ] Registrar divergências e anexar evidências.
- [ ] Impedir que equipamento aguardando conferência seja reservado ou implantado.

## 2. Reserva

- [ ] Criar tipo `ReservaEquipamento`.
- [ ] Registrar equipamento, paciente, domicílio, data de criação, implantação prevista, validade, usuário e observações.
- [ ] Validar que o equipamento está disponível antes de reservar.
- [ ] Alterar o estado para `Reservado` e registrar movimentação.
- [ ] Impedir reserva simultânea do mesmo equipamento.
- [ ] Criar ação de cancelamento de reserva com motivo e movimentação.
- [ ] Criar rotina para alertar ou expirar reservas vencidas.
- [ ] Definir comportamento quando reserva expira: retorno a disponível ou necessidade de conferência, conforme regra aprovada.

## 3. Implantação no domicílio

- [ ] Criar tela ou workflow de implantação a partir de equipamento disponível/reservado.
- [ ] Validar situação do equipamento imediatamente antes da confirmação.
- [ ] Validar paciente e domicílio ativos e completos.
- [ ] Registrar data/hora de saída e de entrega.
- [ ] Registrar profissional responsável pelo transporte/entrega e usuário registrador.
- [ ] Registrar estado do equipamento antes da saída.
- [ ] Registrar acessórios enviados, quantidade e estado.
- [ ] Registrar fotos do equipamento, QR Code e instalação quando aplicável.
- [ ] Registrar termo, assinatura/identificação de quem recebeu e documento quando aplicável.
- [ ] Criar movimentação para transporte e outra para confirmação de implantação, se a operação exigir rastreio de ambas as fases.
- [ ] Atualizar localização para o domicílio e situação para `Implantado no domicílio`.
- [ ] Criar ou vincular a locação no mesmo fluxo operacional, conforme etapa 4.
- [ ] Garantir idempotência: uma confirmação repetida não pode criar duas implantações.

## 4. Recolhimento

- [ ] Criar solicitação de recolhimento com motivo, data/hora solicitada e previsão de retirada.
- [ ] Listar motivos controlados: alta, óbito, troca, defeito, preventiva, cancelamento, mudança de endereço, substituição ou outro.
- [ ] Criar pendência operacional para logística.
- [ ] Registrar profissional responsável, data/hora efetiva, estado aparente e fotos da retirada.
- [ ] Conferir acessórios devolvidos, faltantes, avariados ou sem condição de reutilização.
- [ ] Registrar assinatura ou identificação de quem devolveu, quando aplicável.
- [ ] Encerrar o período de locação conforme a regra financeira aprovada.
- [ ] Alterar situação para `Em transporte para recolhimento` e, após a confirmação, `Recolhido e aguardando conferência`.
- [ ] Atualizar localização para estoque de retorno ou local de conferência.
- [ ] Impedir retorno direto para `Disponível em estoque`.

## 5. Conferência, higienização e liberação

- [ ] Criar checklist de pós-recolhimento por categoria de equipamento.
- [ ] Registrar itens faltantes, danos aparentes, necessidade de limpeza, teste e manutenção.
- [ ] Permitir que conferência encaminhe para higienização, manutenção, bloqueio ou baixa sob aprovação.
- [ ] Criar registro de higienização com método, produto/lote quando necessário, data/hora e responsável.
- [ ] Anexar evidência de higienização quando a política exigir.
- [ ] Criar etapa de teste funcional após higienização ou manutenção, quando aplicável.
- [ ] Permitir liberar para estoque somente após todos os requisitos obrigatórios serem concluídos.
- [ ] Registrar movimentação para cada mudança de situação.

## 6. Transferências e mudanças de endereço

- [ ] Criar transferência entre estoques e filiais.
- [ ] Registrar origem, destino, data/hora, responsável e comprovantes.
- [ ] Permitir mudança de endereço do mesmo paciente como operação rastreável.
- [ ] Definir se a mudança de endereço requer recolhimento e nova implantação ou transferência direta.
- [ ] Criar substituição de equipamento como operação composta.
- [ ] Vincular recolhimento do equipamento anterior à implantação do substituto.
- [ ] Registrar motivo da substituição e impacto financeiro, se houver.
- [ ] Garantir que falha parcial em uma substituição seja sinalizada para reconciliação, não ocultada.

## 7. Acessórios

- [ ] Criar catálogo de acessórios com código, descrição, tipo e unidade de medida.
- [ ] Definir se o acessório é individual/rastreável, consumível ou apenas item de checklist.
- [ ] Associar acessórios obrigatórios ou compatíveis a categorias/modelos de equipamento.
- [ ] Registrar acessórios e quantidades em implantação, recolhimento, manutenção e transferência.
- [ ] Registrar estado: íntegro, avariado, ausente, descartado ou necessita reposição.
- [ ] Definir se acessórios ausentes geram pendência, cobrança, reposição ou baixa.
- [ ] Exibir pendências de acessórios na ficha do equipamento e da locação.

## Cenários mínimos de teste

- [ ] Reservar equipamento disponível e tentar uma segunda reserva simultânea.
- [ ] Cancelar reserva e confirmar retorno correto do estado.
- [ ] Implantar equipamento com acessórios e confirmar histórico completo.
- [ ] Tentar implantar equipamento em manutenção, bloqueado, baixado ou já implantado.
- [ ] Recolher equipamento e confirmar que não aparece disponível antes de conferência/higienização.
- [ ] Registrar acessório faltante e confirmar que aparece como pendência.
- [ ] Executar substituição e confirmar que os dois eventos ficam ligados.
- [ ] Transferir equipamento entre filiais e confirmar localização/histórico.

## Critérios de aceite da etapa

- [ ] Equipamento não pode estar em dois domicílios ao mesmo tempo.
- [ ] Reserva bloqueia implantação em outro paciente sem cancelamento ou autorização.
- [ ] Recolhimento sempre deixa rastros de data, responsável, acessórios e situação posterior.
- [ ] Nenhum equipamento recolhido volta a disponível sem conferência e etapas obrigatórias.
- [ ] Transferências e substituições são rastreáveis pela ficha do equipamento.

