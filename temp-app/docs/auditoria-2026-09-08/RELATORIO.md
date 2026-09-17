# Auditoria do GestorCoop — 08/09/2026

## Resultado

**Há bloqueadores de autenticação e integridade de dados.** O build passa, mas isso não torna o app pronto para produção. A correção da documentação foi implementada localmente; a assinatura real continua dependendo de uma credencial ZapSign válida.

Foram registrados **18 achados pendentes: 6 P0, 7 P1, 5 P2 e 0 P3**. P0 significa bloqueador operacional ou risco de acesso/perda de dados; P1 requer correção antes da liberação; P2 deve entrar na próxima rodada.

## Escopo e evidências

Revisão do middleware, SSO, sessões, adesão, upload, documentos, webhook, aprovação de cooperados, agenda, sincronização, persistência clínica, paginação, layouts e componentes representativos. Inventário de 59 arquivos de rotas de API. A revisão detalhada concentrou-se nos fluxos descritos; não equivale a um pentest completo de todas as rotas.

- TypeScript: `npx tsc --noEmit` passou.
- ESLint dos arquivos da correção: passou. Build completo: passou, com aviso preexistente de dependência de efeito em `src/app/gestor/manutencao/page.tsx:99`.
- `npm run test:documentacao`: **11/11 testes de API passaram**, sem serviços reais.
- Suíte completa `npx playwright test --workers=2`: **43/45 passaram**. As duas falhas estão descritas abaixo.
- Documentação: **12 testes de interface passaram**, incluindo cadastro completo, retomada, bloqueio sem anexos, upload pendente/falho, falha na assinatura, visualização e exclusão.
- [Medições da interface](interface.json), capturas em [360 px](adesao-360.png), [768 px](adesao-768.png) e [1440 px](adesao-1440.png). Inspeção visual da captura mobile.
- Consulta autenticada somente de leitura à ZapSign com a configuração local: HTTP **403**, resposta **“API token not found / Token da API não encontrado”**. Nenhum documento foi criado nessa consulta. Não se presume que as variáveis publicadas sejam iguais às locais.
- Os testes de navegador simulam as APIs da interface. O teste de sessão exercita o servidor real local e revelou uma consulta de leitura não simulada ao Bubble, causada pelo fallback de sessão. Nenhum cadastro real foi criado por esta auditoria.

Não foram medidos Core Web Vitals em produção nem verificados todos os navegadores, políticas de privacidade do Bubble ou configuração publicada. Acessibilidade foi examinada por código, DOM e captura; não houve certificação WCAG ou teste com leitor de tela.

## Qualidade da interface

| Dimensão | Nota /4 | Evidência principal |
|---|---:|---|
| Acessibilidade | 1 | 17 campos sem associação label/ARIA; modal sem gestão de foco |
| Performance | 2 | Paginação dispara todas as páginas restantes; JavaScript inicial de 248 kB em Termos |
| Responsividade | 2 | Sem rolagem horizontal global nos três tamanhos, mas UF cortada dentro do formulário mobile |
| Temas | 2 | Tokens semânticos existem; adesão e gestão ainda usam muitas cores fixas |
| Padrões de interface | 2 | Navegação familiar; cadastro público herda mensagens clínicas e indicação indevida de salvamento |
| **Total** | **9/20** | **Fraco: exige correções relevantes** |

Esta nota é uma avaliação técnica da amostra observada, não uma nota de segurança. Os P0 prevalecem sobre a soma visual.

**Veredito de padrões visuais:** aprovação parcial. Há componentes convencionais úteis, mas também cartões e indicadores decorativos, textos pequenos em caixa alta, sombras e mensagens fora de contexto. A captura não permite inferir autoria humana ou por IA. O problema verificável é a clareza e a coerência do fluxo.

## Correções já feitas na documentação

1. A API de adesão rejeita ausência de identificação ou residência, URLs repetidas/inválidas e arquivos sem comprovante de upload emitido pelo servidor. O comprovante é vinculado à URL com HMAC e vence em sete dias. Categorias são declaradas pelo usuário; não há reconhecimento automático do conteúdo do documento.
2. A interface exige os dois tipos, bloqueia avanço durante upload, preserva dados em erro e oferece abertura do anexo. Documentos são enviados em arquivos separados. Arquivos de rascunhos antigos sem confirmação precisam ser reenviados.
3. Uploads recusam arquivos vazios, formatos diferentes de PDF/JPEG/PNG e arquivos acima de 10 MB. A chamada de armazenamento usa `/fileupload` e o campo `name`, normaliza URLs `//...` e não inventa mais links quando o Bubble falha.
4. A listagem do gestor e a rota de documentos não substituem falhas por cooperados, fotos ou PDFs fictícios. O painel informa falha de carregamento.
5. A geração do termo usa a saída base64 do jsPDF compatível com o runtime edge. A integração valida token/link retornados; falhas de assinatura devolvem erro e não uma URL `/sign/` vazia. A geração manual de termo usa o mesmo tratamento.
6. O webhook reconhece `event_type`, confirma o documento pela API autenticada, usa `external_id` para associar novos termos ao cadastro e salva o PDF no armazenamento do app antes de marcar como assinado. Eventos de documentos ainda pendentes não concluem o cadastro. Termos antigos sem `external_id` mantêm associação por e-mail, que requer revisão em caso de e-mails compartilhados.
7. Nomes com percentuais inválidos não derrubam o visualizador; imagens indisponíveis apresentam orientação para abrir ou substituir.

**Histórico:** links `mock-file-*` apontam para arquivos que não foram gravados; é necessário reenviar os originais. PDFs antigos da ZapSign que já expiraram precisam ser recuperados pela conta do provedor e reanexados/reprocessados. Esta alteração não migrou registros existentes nem foi publicada.

A ZapSign documenta que os links do PDF expiram em 60 minutos e recomenda baixar uma cópia ou consultar novamente o documento: [webhook de documento assinado](https://docs.zapsign.com.br/webhooks/eventos/document/documento-assinado), [detalhar documento](https://docs.zapsign.com.br/documentos/detalhar-documento). Contrato de criação: [criar documento](https://docs.zapsign.com.br/documentos/criar-documento). Upload Bubble: [API oficial](https://manual.bubble.io/core-resources/api/the-bubble-api) e [relato técnico do implementador do endpoint de upload](https://forum.bubble.io/t/guide-how-to-upload-files-to-the-file-manager-from-plugin-actions/273952).

## P0 — Bloqueadores

### A01. Credencial ZapSign recusada

**Categoria:** integração. **Local:** configuração `ZAPSIGN_API_TOKEN` consumida por [zapsign.ts](../../src/lib/zapsign.ts). **Evidência:** consulta GET autenticada retornou 403 com token não encontrado. **Impacto:** não é possível gerar uma assinatura real com a configuração local atual. **Ação:** corrigir o segredo no ambiente correto, confirmar acesso de leitura e homologar criação/assinatura/webhook com cadastro de teste autorizado. Não copiar segredos para relatórios ou mensagens. **Comando sugerido:** `$impeccable harden` para a homologação do fluxo.

### A02. Gestão aceita cookie sem autenticar sessão ou papel

**Categoria:** autorização. **Locais:** [middleware.ts](../../src/middleware.ts):54; [SSO](../../src/app/api/auth/sso/route.ts):39,80; [API de equipamentos](../../src/app/api/gestor/equipamentos/route.ts):8. **Evidência:** middleware só testa presença de `gestor_session`; várias rotas acessam dados diretamente. O SSO escolhe a sessão de gestor pelo destino solicitado, sem verificar papel de gestor. Cookies HTTP-only não impedem um cliente HTTP de enviar um valor arbitrário. **Impacto:** acesso indevido a dados e operações de gestão; falta também escopo de cooperativa nas rotas representativas. **Ação:** sessão assinada/armazenada no servidor, validação central de identidade/papel e autorização por recurso em cada rota. Validar também origem/caminhos permitidos de `redirect`. **Comando:** `$impeccable harden`.

### A03. Atalhos de sessão aceitam credenciais falsas

**Categoria:** autenticação. **Local:** [sessao-cooperado.ts](../../src/lib/sessao-cooperado.ts):69–91. **Evidência:** token inválido cai em sessão fictícia no modo development; o teste `sessao-iframe.spec.ts` esperava 401 e recebeu 200. Além disso, cookies com prefixo `dev` ou valor de teste são aceitos sem consulta e sem condição de ambiente. **Impacto:** um atalho de teste alcança o fluxo de dados; o ramo de cookies também existe em produção. **Ação:** retirar atalhos do código de sessão, simular autenticação apenas no harness de testes e assinar também a sessão de cookie. **Comando:** `$impeccable harden`.

### A04. Registros clínicos confirmados apenas em memória

**Categoria:** persistência. **Local:** [db/prontuarios.ts](../../src/lib/db/prontuarios.ts):649,682,703. **Evidência:** prescrições, aprazamentos, sinais vitais e pareceres são gravados em `Map`; essas funções retornam sucesso sem escrita persistente. **Impacto:** dados podem desaparecer ao reiniciar o processo ou divergir entre instâncias. **Ação:** persistir operações e leituras no banco, exigir confirmação de gravação e remover dados demonstrativos do caminho operacional. **Comando:** `$impeccable harden` para estados de falha e persistência associada.

### A05. Falha de consulta remove o filtro de pacientes

**Categoria:** autorização. **Local:** [agenda/route.ts](../../src/app/api/cooperado/agenda/route.ts):127,147. **Evidência:** após erro na integração, a execução alcança `SELECT *` de pacientes, prescrições e aprazamentos sem filtro. Sem banco, devolve dados fictícios, inclusive podendo relacionar prescrições demonstrativas a pacientes vindos do Bubble. **Impacto:** indisponibilidade pode ampliar acesso ou apresentar informação clínica incorreta. **Ação:** devolver erro explícito, manter escopo de autorização em todas as consultas e não utilizar demonstrações como recuperação de falha. **Comando:** `$impeccable harden`.

### A06. Sincronização não confirma cada ação nem autoriza todos os alvos

**Categoria:** integridade e autorização. **Local:** [sync/route.ts](../../src/app/api/cooperado/sync/route.ts):55,93,121,149; [sync-service.ts](../../src/lib/sync-service.ts):84. **Evidência:** atualização de medicamento usa apenas ID; check-in recebe paciente sem conferir vínculo. Tipos desconhecidos são ignorados e a resposta informa `syncedCount: actions.length`; atualizações sem linhas afetadas também não são distinguidas. O cliente apaga toda a fila quando recebe sucesso. **Impacto:** alterações indevidas e perda silenciosa de ações que não foram gravadas. **Ação:** validar tipo/payload e acesso ao paciente, verificar resultados por ação, preservar pendências recusadas e bloquear reescrita de evolução finalizada. **Comando:** `$impeccable harden`.

## P1 — Correção antes da liberação

### A07. Aprovação não valida documentação e vincula usuário fixo

**Categoria:** regra de negócio. **Local:** [cooperados/aprovar](../../src/app/api/gestor/cooperados/aprovar/route.ts):10–93. **Evidência:** exige somente ID; não verifica termo assinado/anexos; falha de integralização é ignorada e `fk_usuario` recebe ID fixo. **Impacto:** a aprovação administrativa pode liberar cadastro incompleto ou associá-lo à conta errada, mesmo com o envio inicial corrigido. **Ação:** autorização do aprovador, pré-condições no servidor, vínculo real de conta e recuperação explícita de operações parciais. **Comando:** `$impeccable harden`.

### A08. Documentos pessoais são enviados como públicos

**Categoria:** privacidade. **Local:** [bubble.ts](../../src/lib/bubble.ts):698. **Evidência:** upload usa `private: false`; rota pública de upload não tem limitação de taxa no código revisado. **Impacto:** quem obtiver a URL pode acessar o arquivo, e o endpoint pode consumir armazenamento. **Ação:** desenhar upload privado vinculado ao cadastro/sessão, acesso autorizado para visualização e controle de abuso. Não trocar a flag isoladamente: a visualização precisa acompanhar a política de acesso. **Comando:** `$impeccable harden`.

### A09. Retomada por CPF permite sobrescrever cadastro sem provar identidade

**Categoria:** autorização. **Local:** [adesao/route.ts](../../src/app/api/cooperado/adesao/route.ts), ramo `existente`. **Evidência:** para status aguardando assinatura, o endpoint público remove profissões/contas anteriores e atualiza dados a partir do CPF informado. O comprovante de upload novo prova envio de arquivo, não identidade do titular. **Impacto:** substituição de contato/anexos por terceiro e perda de sub-registros em falha parcial. **Ação:** vincular retomada a sessão de cadastro ou confirmação de identidade e substituir registros com recuperação/idempotência. **Comando:** `$impeccable harden`.

### A10. Erros de integração expõem credenciais nos logs

**Categoria:** segurança operacional. **Local:** [agenda/route.ts](../../src/app/api/cooperado/agenda/route.ts):128 e outros `console.error` de objetos Axios. **Evidência:** a execução da suíte imprimiu cabeçalho Authorization do Bubble dentro do objeto de erro. O valor não foi copiado para este relatório. **Impacto:** quem acessa logs pode obter o segredo da integração. **Ação:** registrar somente campos permitidos, remover headers/config/request do log e avaliar rotação da credencial exposta nos destinos de logging. **Comando:** `$impeccable harden`.

### A11. Campos não estão associados aos rótulos

**Categoria:** acessibilidade. **Local:** [adesao/page.tsx](../../src/app/cooperado/adesao/page.tsx):636 em diante. **Evidência:** 17 campos na primeira etapa sem `label` associado, `aria-label` ou `aria-labelledby`, nos três tamanhos. **Impacto:** nomes/contexto não são apresentados consistentemente a tecnologia assistiva; clicar no rótulo não direciona ao campo. **Referência:** associação de informações e instruções de formulário, WCAG 1.3.1/3.3.2. **Ação:** IDs únicos e `htmlFor`; erros com `aria-describedby` e `aria-invalid`. **Comando:** `$impeccable harden`.

### A12. UF do RG fica cortada no celular

**Categoria:** responsividade. **Local:** [adesao/page.tsx](../../src/app/cooperado/adesao/page.tsx):705–718. **Evidência:** captura de 360 px mostra select escapando da área do formulário. O input flexível sem `min-width: 0` disputa espaço com `w-24`. Não há scroll global porque o conteúdo é cortado internamente. **Impacto:** parte do controle fica inacessível visualmente. **Ação:** dimensionar a linha com `minmax(0, 1fr)`/`min-w-0` ou empilhar em telas estreitas; verificar zoom e o controle aberto. **Comando:** `$impeccable adapt`.

### A14. Modal de documentos sem gestão de foco

**Categoria:** acessibilidade. **Local:** [ModalDocumentosCooperado.tsx](../../src/app/gestor/dashboard/_components/ModalDocumentosCooperado.tsx):224,393,568. **Evidência:** usa `aria-modal`, mas não controla foco inicial/retorno, contenção de Tab ou Escape; miniatura acionável é uma div. **Impacto:** navegação por teclado pode sair do modal e a ampliação não é acessível pela miniatura. Há botão Ver como alternativa parcial. **Ação:** dialog acessível e controles semânticos, testar foco e teclado. **Referência:** WCAG 2.1.1/2.4.3. **Comando:** `$impeccable harden`.

## P2 — Próxima rodada

### A13. Cadastro público informa salvamento na nuvem sem confirmação

**Categoria:** clareza. **Local:** [cooperado/layout.tsx](../../src/app/cooperado/layout.tsx):223. **Evidência:** captura mostra “Todos os dados salvos na nuvem” no cadastro vazio, ainda com perfil “Carregando...”. O layout clínico envolve a adesão pública e o rascunho da adesão fica no localStorage. **Impacto:** usuário pode acreditar que o cadastro já foi enviado e sair. **Ação:** layout próprio para adesão e mensagens que distingam rascunho local, anexos enviados e cadastro submetido. **Comando:** `$impeccable clarify`.

### A15. Carregamento em massa e falha de paginação escondida

**Categoria:** performance e confiabilidade. **Local:** [client-fetch.ts](../../src/lib/client-fetch.ts):29–52. **Evidência:** dispara todas as páginas restantes simultaneamente; falha parcial é apenas logada e lista parcial é retornada. Build: Termos 248 kB e Adesão 182 kB de JavaScript inicial. Isso não mede LCP/INP. **Impacto:** mais requisições e memória em bases grandes; listagem incompleta pode parecer completa. **Ação:** paginação no servidor ou concorrência limitada, erro/repetição explícitos e carga tardia do editor/PDF quando aplicável. **Comando:** `$impeccable optimize`.

### A16. Uso inconsistente dos tokens de tema

**Categoria:** temas. **Locais:** [globals.css](../../src/app/globals.css), [tailwind.config.ts](../../tailwind.config.ts), adesão e dashboard. **Evidência:** há tokens semânticos e tema escuro; telas ainda usam `bg-white`, `text-slate-*` e classes como `text-slate-550`, sem esse degrau declarado no config. **Impacto:** aparência e contraste divergem entre módulos; classes inexistentes dependem de herança. **Ação:** migrar essas superfícies aos tokens existentes e medir contraste nos dois temas. **Comando:** `$impeccable extract`.

### A17. Movimento e alvos pequenos sem tratamento consistente

**Categoria:** acessibilidade/responsividade. **Locais:** adesão e modal de documentos. **Evidência:** Avançar/Voltar medem 40 px de altura; existem animações contínuas e não foi encontrado tratamento de `prefers-reduced-motion`/`reducedMotion` nos diretórios revisados. **Impacto:** menor conforto no toque e para pessoas sensíveis a movimento. A recomendação de 44 px é meta de usabilidade, não prova isolada de violação WCAG AA. **Ação:** ampliar áreas de toque e oferecer movimento reduzido. **Comando:** `$impeccable adapt` / `$impeccable animate`.

### A18. Indicação de obrigatoriedade difere da validação

**Categoria:** validação e clareza. **Local:** [adesao/page.tsx](../../src/app/cooperado/adesao/page.tsx), etapa 1 e `nextStep`. **Evidência:** Nome da Mãe e PIS têm asterisco, mas a validação da etapa exige somente nome, CPF, e-mail e WhatsApp. No servidor a validação de dados cadastrais também é parcial. **Impacto:** usuário não sabe quais dados precisa preencher; registros incompletos podem prosseguir. **Ação:** confirmar regra cadastral e compartilhar schema de validação entre cliente e servidor, cobrindo formato/datas/endereço. **Comando:** `$impeccable harden` / `$impeccable clarify`.

## Testes que falharam na auditoria

- `sessao-iframe.spec.ts:97`: token forjado recebeu 200 em vez de 401. Falha de implementação confirmada no atalho de desenvolvimento, registrada em A03. A suíte testa justamente a recusa, portanto não deve ser alterada para aceitar 200.
- `gestor-shell.spec.ts:33`: navegação para Financeiro excedeu 5 segundos na suíte completa. A repetição isolada passou (4,3 s), sem alterações no código: classificado como instabilidade temporal do teste, não defeito funcional confirmado. Não há evidência para atribuir a falha à correção de documentação.

## Padrões sistêmicos e aspectos positivos

Os maiores problemas vêm de simulações/fallbacks inseridos no caminho operacional, autenticação distribuída e confirmação de sucesso sem prova de persistência. A matriz de testes existente não cobre todas essas propriedades: simular uma API bem-sucedida comprova o comportamento da tela, não a durabilidade no servidor.

Preservar: tokens semânticos já existentes, fila local que permanece quando sync devolve erro, assinatura HMAC de tokens Bearer, filtro de profissional em assinatura de evolução, proteção de cron por segredo, estrutura responsiva e testes de fluxos com falha. Na documentação corrigida, preservar a comprovação do upload e o erro explícito dos provedores.

## Ordem recomendada

1. **P0 — `$impeccable harden`:** credencial ZapSign, sessões/papéis, autorização por paciente e persistência clínica; testar recusas e reinício de instância.
2. **P1 — `$impeccable harden`:** aprovação/retomada, armazenamento privado, logs sem segredos, rótulos e foco de modal.
3. **P1/P2 — `$impeccable adapt` e `$impeccable clarify`:** UF no celular, alvos de toque e mensagens reais de salvamento/obrigatoriedade.
4. **P2 — `$impeccable optimize` e `$impeccable extract`:** paginação, carregamento tardio e adoção dos tokens existentes.
5. **`$impeccable polish`:** passe final após os bloqueadores. Reexecutar `$impeccable audit` depois das correções.

As etapas podem ser executadas individualmente ou em conjunto, priorizando os bloqueadores. Opcionalmente, `$impeccable init` pode documentar o contexto visual/produto hoje ausente; isso não impede nenhuma correção acima.

