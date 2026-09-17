# Revisão do prontuário e prontidão para embed no Bubble

Data: 10/09/2026. Base: checkout local, HEAD `5bc29e1`, incluindo alterações já existentes no workspace.

**Parecer: não liberar o prontuário para uso real.** O mecanismo de iframe do cooperado existe, mas há falhas reproduzidas de autenticação, perda de registros e integração entre cooperado e gestor. Um teste visual pode ser feito em ambiente isolado, com dados sintéticos, depois de configurar o SSO. Isso não equivale à homologação do sistema.

## Escopo e limites

Foi mapeada a aplicação Next.js em `temp-app`: áreas de gestor e cooperado, integração Bubble, autenticação SSO, banco D1, migrações, cache IndexedDB, fila offline, transcrição e testes. A análise aprofundada se concentrou no prontuário e em suas dependências compartilhadas. Não é uma aprovação dos demais módulos financeiros, equipamentos ou adesão.

Foram lidos o código atual e o plano `docs/superpowers/plans/2026-08-10-prontuario-clinico-embed-bubble.md`. As observações desse plano estão parcialmente desatualizadas: existem regressões de autenticação e novas funções clínicas com persistência apenas em memória. A descrição de cookie httpOnly como impossível de forjar está incorreta.

Não foram acessados prontuários reais, alterados dados externos, configurado o Bubble ou publicado código. Os testes de ataque foram locais; os testes SQL usaram SQLite em memória. O schema, bindings, secrets e a revisão efetivamente publicada no Cloudflare não foram inspecionados. A existência de uma configuração no `.env.local` não comprova sua configuração no Pages.

## Verificações executadas

| Verificação | Resultado |
| --- | --- |
| `npm run build` | Passou, incluindo lint e tipos. Warning de dependência de `useEffect` em `gestor/manutencao/page.tsx:99`. |
| `npx tsc --noEmit` | Passou. |
| Quatro arquivos Playwright de prontuário, `--workers=1` | 15 passaram, 1 falhou; 29,3 segundos. |
| HTTP contra `next start -p 3016` | Cookies arbitrários aceitaram acesso nas condições descritas abaixo, mesmo em modo de produção. |
| SQL extraído da rota de sync e aplicado às migrações clínicas | Check-in e assinatura afetaram zero registros. |
| SQL de atualização da agenda, SQLite com foreign keys habilitadas | Uma prescrição existente foi removida por cascata. |
| Funções reais de dados/sync executadas com dependências instrumentadas | Listagem de evoluções e criação de prescrição, sinal vital e parecer não consultaram o binding D1; ações não implementadas receberam sucesso. |

Arquivos Playwright: `sessao-iframe.spec.ts`, `offline-sync.spec.ts`, `clinical-transcription.spec.ts`, `gestor-prontuarios-360.spec.ts`. O Bubble foi direcionado a `http://127.0.0.1:9/auditoria` com credencial sintética no processo de testes, para evitar chamadas ao ambiente real. A primeira tentativa foi bloqueada por `spawn EPERM`; a execução fora do sandbox foi autorizada e concluída.

A falha ocorreu em `tests/e2e/sessao-iframe.spec.ts:104`: o teste esperava HTTP 401 para token forjado, mas recebeu 200. O servidor Playwright usa desenvolvimento; nesse ambiente a sessão inválida vira sessão local. No probe em produção, o token Bearer forjado foi recusado corretamente. O bypass por cookie descrito a seguir ocorre também em produção.

## Bloqueios encontrados

### 1. Crítico — acesso por cookies sem autenticação confiável

- `temp-app/src/middleware.ts:54` exige apenas a presença de `gestor_session`. As APIs de prontuário do gestor não validam sessão ou permissão adicionalmente.
- `temp-app/src/lib/sessao-cooperado.ts:52` aceita o ID bruto do cookie, sem assinatura ou registro de sessão; a linha 80 aceita IDs começando por `dev` e `user-e2e-coop` sem limitar a desenvolvimento.
- Reprodução com build de produção: `/api/gestor/prontuarios` sem cookie → 401; com `gestor_session=auditoria-sem-login` → 200, com dois registros de demonstração. `/api/cooperado/me` com `cooperado_session=dev-auditoria` → 200, identidade `coop-dev-1`.
- `temp-app/src/app/api/auth/sso/route.ts:39` escolhe a área pela URL de destino; na linha 80 emite sessão de gestor sem verificar papel do usuário. Também falta restringir o redirecionamento a destinos internos autorizados.

Correção: autenticar cookies e tokens com a mesma exigência, remover identidades especiais do runtime normal e exigir autorização de gestor no servidor. HttpOnly limita acesso via JavaScript; não prova que um cabeçalho Cookie enviado por um cliente foi emitido pelo servidor. Referência: [MDN — Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie).

### 2. Crítico — check-in pode ser confirmado sem existir no banco

`temp-app/migrations/0001_init_prontuario.sql:48` define `check_out TEXT NOT NULL`, sem default. O `INSERT OR IGNORE` de `temp-app/src/app/api/cooperado/sync/route.ts:63` omite essa coluna.

Com as migrações clínicas 0001, 0003 e 0004 e paciente sintético previamente criado, o SQL real inseriu **zero** evoluções, sem lançar erro. A assinatura seguinte também atualizou zero linhas. A rota não verifica `meta.changes` e retorna `success: true`; `temp-app/src/lib/sync-service.ts:84` remove a fila local nesse caso.

Correção: compatibilizar o schema com atendimento aberto, verificar resultado por ação e confirmar ao cliente apenas o que foi persistido. Homologar check-in → assinatura → consulta a partir de outra sessão.

### 3. Crítico — carregar a agenda pode apagar registros clínicos relacionados

`temp-app/src/app/api/cooperado/agenda/route.ts:60` usa `INSERT OR REPLACE` para atualizar pacientes. As migrações ligam prescrições e evoluções ao paciente com `ON DELETE CASCADE`; aprazamentos dependem das prescrições. A migração 0004 também usa cascata para sinais vitais e pareceres.

Na reprodução local com foreign keys habilitadas, atualizar um paciente já existente deixou **zero prescrições**, partindo de uma. Trata-se da substituição do registro pai, que aciona a exclusão dos filhos. A inferência para D1 com o mesmo schema é sustentada pelo fato de que D1 habilita a validação de foreign keys por padrão. [Cloudflare — foreign keys no D1](https://developers.cloudflare.com/d1/sql-api/foreign-keys/).

Correção: usar UPSERT com `ON CONFLICT(id) DO UPDATE`, preservando o pai e os dados clínicos. Testar explicitamente a preservação dos registros dependentes após carregar a agenda repetidamente.

### 4. Crítico — erros de integração retiram o filtro de acesso aos pacientes

O caminho principal da agenda filtra pacientes pelos serviços do cooperado. Porém, após erro no Bubble ou no processamento desse caminho, o fallback de `temp-app/src/app/api/cooperado/agenda/route.ts:127` chega às linhas 147–149, que fazem `SELECT *` nas tabelas sem filtro por profissional. Se o banco estiver vazio, o GET ainda semeia dados de demonstração.

A escrita de checagem de medicamento em `temp-app/src/app/api/cooperado/sync/route.ts:93` filtra apenas pelo ID do aprazamento; não valida se o paciente pertence ao atendimento autorizado do cooperado. O check-in também aceita `pacienteId` sem conferir essa relação.

Correção: falhar sem devolver a base inteira quando não for possível determinar acesso; aplicar a autorização por paciente/atendimento em cada leitura e escrita. A agenda também precisa filtrar período/status dos serviços: atualmente chama `getServicosByCooperado` sem datas.

### 5. Crítico — gestor e cooperado não compartilham uma fonte clínica persistente completa

Em `temp-app/src/lib/db/prontuarios.ts`:

- `listarEvolucoesClinicas`, linha 549, lê somente `inMemoryEvolucoes`, mesmo com D1 disponível.
- Prescrições e aprazamentos novos, linhas 650–678, são gravados apenas em Maps.
- Sinais vitais, linha 683, e pareceres, linha 704, também são apenas memória.
- `salvarPacienteClinico`, linha 516, persiste apenas seis campos; diagnóstico, contato, responsável, status e complexidade ficam fora da escrita SQL.
- Os filtros `status` e `complexidade`, linhas 378 e 382, usam colunas ausentes nas migrações. O erro cai em demonstrações em memória. A ausência dessas colunas foi reproduzida no SQLite.

Na instrumentação das funções reais, listar evoluções retornou dois exemplos sem nenhuma consulta ao binding disponível. Criar prescrição, sinal vital e parecer também executou zero consultas. Isso explica por que uma tela pode exibir sucesso sem que o dado sobreviva à reciclagem do processo ou apareça em outro dispositivo. Evoluções recebidas pelo sync no D1 não entram no Map lido pelo gestor.

Correção: completar migrações e repositório D1 de todas as entidades; não ocultar falhas de persistência com sucesso ou dados fictícios. Unificar as leituras do gestor com as escritas do cooperado.

### 6. Alto — áudio offline é descartado da fila sem transcrição

`temp-app/src/app/cooperado/prontuario/[id]/page.tsx:303` enfileira `EVOLUCAO_TEXTO` quando grava sem rede. A rota de sync trata apenas `CHECK_IN`, `CHECK_MEDICAMENTO` e `SIGN_EVOLUCAO`.

A execução da rota real com binding instrumentado confirmou que `EVOLUCAO_TEXTO`, `CHECK_OUT` e até um tipo inexistente retornam HTTP 200, `success: true`, `syncedCount: 1`, com zero operações. O serviço local então remove a ação. O blob continua no aparelho, mas não há processamento posterior implementado que cumpra a promessa de transcrição automática.

Correção: implementar o transporte/processamento do áudio pendente ou manter a pendência explícita; recusar tipos desconhecidos e devolver confirmação individual por ação.

### 7. Crítico — demonstrações são apresentadas como informação clínica

- `temp-app/src/app/api/cooperado/transcrever/route.ts:88`: sem chave OpenAI/Groq retorna uma evolução pronta com sinais vitais e condutas que não vêm do áudio, usando `success: true`. Esse fallback não está limitado a desenvolvimento.
- O fallback de estruturação na linha 204 afirma que medicações/cuidados foram administrados, mesmo sem essa informação necessariamente constar do relato.
- `temp-app/src/app/cooperado/prontuario/[id]/page.tsx:177`: paciente ausente no cache ganha CPF, endereço e alergias fictícios.
- A agenda preenche CPF de exemplo e nascimento fixo (`agenda/route.ts:50`).

Correção: remover simulação do runtime normal, representar dados ausentes explicitamente e não acrescentar fatos ao relato. Sem serviço de transcrição configurado, manter áudio/rascunho e oferecer digitação manual. Remover também o log de transcrição integral da linha 160.

### 8. Alto — PIN e imutabilidade são apenas aparentes

`temp-app/src/app/cooperado/prontuario/[id]/page.tsx:413` verifica somente se algum PIN foi digitado. O servidor ignora `pinCode`. O `UPDATE` de assinatura (`sync/route.ts:121`) limita o autor, mas não impede nova assinatura/regravação de uma evolução já finalizada. A checagem de medicamento também permite sobrescrever o estado anterior sem regra de transição.

A tela marca `Finalizado` pela presença de rede, antes da confirmação do servidor (`page.tsx:440`). O HMAC existente é um mecanismo técnico de integridade; esta revisão não avalia validade jurídica de assinaturas e não encontrou rotina de verificação desse selo na auditoria clínica.

Correção: tornar a confirmação de identidade real ou ajustar a interface à garantia efetivamente oferecida; impor finalização no servidor, registrar retificações separadas e só declarar sincronização após confirmação persistente.

### 9. Alto — dados offline e sessões não estão separados por profissional

`temp-app/src/lib/indexeddb.ts:60` usa um único banco por origem. Pacientes e prescrições são atualizados com `put`, sem substituir o conjunto autorizado nem limpar os dados de quem saiu. A fila também não carrega o dono da sessão de origem. O servidor atribui as ações à sessão vigente durante o envio, o que permite que ações pendentes de A sejam enviadas por B após troca de usuário.

`temp-app/src/app/api/auth/logout/route.ts` remove apenas `gestor_session`; não encerra a sessão do cooperado. Na reprodução HTTP, seu único Set-Cookie expirou o cookie do gestor. O token Bearer também não tem revogação implementada.

Correção: particionar cache/fila por usuário, impedir envio por identidade diferente e definir encerramento/expiração de sessão que preserve pendências sem expor o cache a outra conta.

### 10. Alto — retorno ao paciente pode bloquear o próximo plantão

`temp-app/src/app/cooperado/prontuario/[id]/page.tsx:201` escolhe a primeira evolução encontrada para o paciente, sem restringir profissional, dia, turno ou atendimento aberto. Se ela estiver assinada, bloqueia a tela novamente. Não há fluxo implementado nesse carregamento para iniciar uma nova visita ao mesmo paciente.

Além disso, o payload de check-in na linha 253 não envia cargo/turno que o servidor espera, e a agenda não filtra aprazamentos pelo turno/dia. É necessário homologar visitas repetidas e plantões noturnos, além do primeiro atendimento sintético.

## O que existe para incorporar no Bubble

O transporte básico do cooperado está implementado:

- SSO em `/api/auth/sso`, com emissão de token HMAC, validade de 12 horas e retorno no fragmento `#s=...`.
- Captura do fragmento em `src/lib/api-cliente.ts`, limpeza da URL e envio do token em `Authorization: Bearer`.
- Página `/cooperado` acessível para inicializar o iframe, com dados carregados por API.
- CSP do cooperado permite `'self'` e `EMBED_ORIGEM`, usando `https://gestorcoop.app` por padrão. O cabeçalho foi confirmado localmente.
- As páginas `/gestor/*` emitem `X-Frame-Options: DENY`. O embed implementado é o do cooperado, não o painel do gestor.

Após corrigir os bloqueios, o fluxo esperado é:

1. Bubble autentica o usuário e vincula `user.fk_cooperado` corretamente.
2. Bubble emite um token SSO temporário e passa seu valor na URL do iframe. O código atual consulta os campos `txt_sso_token_text` e, como alternativa, `sso_token_text`; conferir os nomes reais no Data API. A expiração do SSO não é validada pelo código atual, e `clearSSOToken` absorve falhas de limpeza (`src/lib/bubble.ts:1545`).
3. A URL segue o formato `https://<host-do-app>/api/auth/sso?token=<token-temporario>&redirect=%2Fcooperado`.
4. Cloudflare precisa ter `ASSINATURA_SECRET`, configuração Bubble e binding D1 com as migrações corretas. O `wrangler.toml` local contém `database_id = "local"`; isso não comprova a ligação do ambiente publicado. O acesso real ao binding precisa ser validado no runtime escolhido. [Cloudflare — bindings do Pages](https://developers.cloudflare.com/pages/functions/bindings/).
5. A origem exata da página Bubble deve estar permitida pela CSP. Para gravar áudio em iframe, configurar HTTPS, permissão de microfone no elemento (`allow="microphone"`) e política compatível na página hospedeira; se houver sandbox, conferir os atributos necessários. [MDN — getUserMedia em iframe](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia).
6. Validar dentro do Bubble efetivo, incluindo Android e iPhone/Safari ou WebView usado pelo aplicativo, bloqueio de cookies de terceiros, expiração de sessão e reconexão.

Não foi executado login SSO real pelo Bubble nem teste em dispositivo físico. Os testes de navegador existentes usam Chromium desktop e respostas simuladas para os fluxos clínicos; não verificam persistência D1 ou incorporação cross-site real.

## Ordem de correção e critério de liberação

1. Fechar autenticação e autorização, incluindo contingências, cookies, SSO e checagens por paciente.
2. Corrigir check-in e substituir REPLACE na agenda, com testes SQL que protejam registros existentes.
3. Completar schema e persistência D1; conectar o prontuário do gestor à mesma fonte do cooperado.
4. Remover informação clínica simulada e corrigir a confirmação por ação da fila, inclusive áudio.
5. Corrigir isolamento local, assinatura/finalização, cargo/turno e atendimento recorrente.
6. Configurar um ambiente de homologação e realizar o ciclo completo: login Bubble → paciente autorizado → atendimento → medicamento → áudio/texto → assinatura → reconexão → leitura no gestor em outro navegador.

A liberação exige que esse registro continue disponível após reinício do servidor, que um segundo profissional não consiga lê-lo/alterá-lo sem autorização, que uma atualização da agenda preserve todo o histórico e que nenhuma ação seja anunciada como sincronizada sem existir no banco.
