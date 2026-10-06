# Auditoria do prontuário clínico — 01/10/2026

## Escopo e evidência

Inspecionados a tela `/gestor/prontuarios/[id]`, suas oito rotas de API, o repositório D1, a agenda e sincronização do cooperado, a emissão de sessão SSO e o fluxo offline. A URL do paciente exibido na captura foi usada para a checagem HTTP de sessão inválida. Não foi acessado o banco remoto nem alterado prontuário real. As mudanças locais que já existiam no início da auditoria foram preservadas e complementadas.

## Achados e correções

| Prioridade | Achado | Correção aplicada |
| --- | --- | --- |
| P0 | `GET /api/cooperado/agenda` podia devolver todos os pacientes do D1 ou exemplos clínicos ao falhar a integração com o Bubble. | A agenda agora encerra com 503 quando não consegue confirmar os vínculos; quando não há pacientes autorizados, devolve listas vazias. |
| P0 | As rotas clínicas do gestor dependiam apenas da presença de um cookie arbitrário. | Todas as leituras e escritas de `/api/gestor/prontuarios` validam JWT, área de gestor e sessão vigente no D1. Cookie forjado recebeu 401 no servidor de produção local. |
| P0 | O SSO aceitava `user_id` fornecido pelo chamador e emitia sessão a partir dele. | O fluxo legado exige token temporário localizado no Bubble, restringe redirecionamento à área autenticada e só responde após registrar a sessão e limpar o token. A rota segura `/api/auth/embed` também carrega o cargo real do cooperado. |
| P0 | O login direto do cooperado emitia sessão clínica apenas com um CPF conhecido. | Em produção, o endpoint devolve 410 e a tela orienta acesso autenticado pelo portal da cooperativa. O formulário antigo continua disponível somente no ambiente local de desenvolvimento. |
| P0 | Escritas de paciente, plano, evolução, prescrição, sinais vitais e parecer podiam responder sucesso apesar de falha no D1. | Falhas de escrita agora propagam erro. O plano e suas metas são gravados em um único `batch` transacional. Em produção, ausência do binding D1 falha explicitamente. |
| P0 | `CHECK_IN` omitia o `check_out` obrigatório e o cargo na fila; ações desconhecidas recebiam confirmação de sincronização. | O INSERT fornece `check_out` vazio, o cliente envia especialidade e turno, o servidor confere a especialidade contra a sessão e rejeita ações não suportadas. Escritas sem linhas afetadas não são confirmadas. |
| P0 | Escritas de check-in, medicamento e assinatura não conferiam o vínculo do paciente ao serviço do cooperado. | O sync consulta os serviços do profissional no Bubble e recusa paciente ou registro fora desse conjunto. |
| P1 | A tela mostrava a cota mensal legada, em um bloco escuro, mesmo quando o controle correto está no plano terapêutico por especialidade. | O bloco só aparece quando existe uma cota legada positiva e não existe plano; a apresentação usa o padrão claro do sistema. |
| P1 | Falhas dos endpoints secundários apareciam como contagens zero, sem aviso. | A tela exibe alerta quando alguma leitura parcial falha. Leituras D1 com erro deixam de cair silenciosamente em memória; resultado vazio do D1 é respeitado. |
| P1 | Plano ativo fora da vigência ainda era tratado como vigente e podia liberar check-in. | A busca de plano vigente exige período válido; se existem planos mas nenhum ativo para a data, o check-in é recusado. |
| P1 | A lista de cooperados e o perfil clínico podiam exibir nomes, CPF, diagnóstico, alergias ou complexidade inventados como fallback. | Removidos exemplos do seletor em erro e vários valores clínicos fictícios. A ausência de alergias registradas passa a ser descrita como ausência de registro. |
| P1 | Áudio gravado offline podia ser assinado com texto de espera e uma ação de transcrição era enviada a um endpoint que não a implementava. | A assinatura bloqueia texto pendente; há ação explícita de transcrever o Blob local ao reconectar. A fila mantém essa pendência e impede sincronizar ações posteriores até a transcrição. |

## Verificações

- `npx tsc --noEmit`: passou após as correções.
- `npm run build`: passou. Há aviso preexistente de dependência de `useEffect` em `gestor/manutencao/page.tsx:99`, fora deste módulo.
- `gestor-prontuarios-360.spec.ts` e `plano-terapeutico-e2e.spec.ts`: 8/8 passaram em execução sequencial. Esses testes simulam respostas das APIs e validam a UI, não o D1 remoto.
- HTTP em `next start`, com `gestor_session=forged`: detalhe do paciente e planos retornaram 401; `cooperado_session=forged` na agenda retornou 401.
- `offline-sync.spec.ts`: passou na repetição isolada (1/1). A primeira tentativa falhou antes do check-in, ainda na navegação para o atendimento; esse teste usa agenda e sessão simuladas e não valida o backend D1.

## Qualidade técnica da interface

Avaliação estática do prontuário, em escala de 0 a 4 por dimensão. **10/20 — aceitável com lacunas importantes**; não equivale a uma medição WCAG ou Lighthouse.

| Dimensão | Nota | Evidência principal |
| --- | ---: | --- |
| Acessibilidade | 2/4 | Navegação por abas usa botões, mas falta semântica de abas/seleção e há alvos pequenos. |
| Desempenho | 2/4 | A listagem consulta o plano individualmente por paciente; o detalhe busca endpoints sobrepostos. |
| Responsividade | 2/4 | Há breakpoints e rolagem horizontal nas abas, mas controles compactos precisam de verificação em 320 px e zoom. |
| Tema | 2/4 | A tela segue majoritariamente o tema claro existente, com cores Tailwind locais em vez de tokens centralizados. |
| Padrões visuais | 2/4 | O bloco escuro incoerente foi removido da condição comum; persistem cartões aninhados e sombras excessivas. |

Pontos positivos: carregamento com esqueleto, divisão por abas, estados de erro no carregamento principal e campos clínicos separados por função. O teste de contraste, foco por teclado e layout móvel exige navegador autenticado com dados representativos.

## Pendências para homologação

1. **P0 — Persistência real:** aplicar e verificar migrações D1 no ambiente de homologação/produção e executar o ciclo autenticado Bubble → paciente → plano → atendimento → reload em outra sessão. Os testes atuais não demonstram essa persistência. A função de garantia de schema em runtime ajuda com tabelas ausentes, mas não substitui migrações controladas.
2. **P1 — Entrada autenticada:** confirmar no Bubble que o botão de acesso fornece `txt_sso_token_text` ou `sso_token_text`; chamadas antigas com `user_id` passarão a receber 400. Links diretos de prontuário exigem entrada pelo portal; o formulário de CPF não autoriza mais sessões em produção. A troca por ticket em `/api/auth/embed` já é a integração preferida do projeto.
3. **P1 — Elegibilidade temporal:** conferir no Bubble se `getServicosByCooperado` devolve somente serviços em período e status elegíveis. O sync confere o vínculo, mas ainda não filtra período/status dos serviços retornados.
4. **P1 — Offline:** validar transcrição e assinatura depois de reconexão com um Blob real, sem dados clínicos de teste. A repetição do teste simulado passou, mas não cobre esse percurso.
5. **P2 — Interface:** medir contraste, teclado e responsividade em navegador real. A revisão de código encontrou pouca indicação explícita de foco e áreas clicáveis pequenas; os 8 testes de UI não cobrem WCAG.

Nenhuma alteração foi publicada no Cloudflare Pages ou no Bubble nesta auditoria.
