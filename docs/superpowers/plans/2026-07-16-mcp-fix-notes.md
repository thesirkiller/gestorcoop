# Notas — Correção do bug de schema no befree-bubble-mcp (Task 1, Agente A)

Data: 2026-07-16. Repo alvo: `befree-bubble-mcp/` (servidor MCP Python).

## Causa raiz confirmada

**Bug primário — `%v` sem prefixo `option.`:**
`BubbleCLI.create_data_field` (`befree-bubble-mcp/src/bubble_mcp/aria_runtime/bubble_cli.py`)
gravava o `field_type` recebido **verbatim** em `%v`, sem nenhuma normalização/validação.
Quando o chamador passou a chave do option set sem o prefixo (`os_status_reserva_equipamento`
em vez de `option.os_status_reserva_equipamento`), o MCP enviou um type id inválido.
O endpoint `POST https://bubble.io/appeditor/write` **aceita esse payload com HTTP 200**
(resposta com `last_change`/`id_counter` normal — conferido em todas as 574 entradas do
overlay), então o MCP marcou tudo como sucesso e gravou o overlay. Mas o campo fica
irresolvível no runtime do Bubble → "missing" na Data API.

Prova no export base (`~/.config/bubble-mcp/contexts/gestorcoop/appgestorcoop.bubble`,
`user_types.equipamento.fields`):
- funciona: `os_status_option_os_status_equipamento` → `{"display":"OS_status","value":"option.os_status_equipamento"}`
- quebrado: `os_status_os_status_equipamento` → `{"deleted":true,"display":"OS_status - deleted","value":"os_status_equipamento"}`

**Por que alguns tipos perderam TODOS os campos e outros só os de option set:**
- Todos os campos `os_*` de todos os tipos foram gravados com `%v` inválido (confirmado no
  overlay: reserva `%v=os_status_reserva_equipamento`, movimentacao `%v=os_status_equipamento`
  / `os_os_tipo_movimentacao_equipamento` / `os_motivo_recolhimento_equipamento`, baixa
  `%v=os_motivo_baixa_equipamento`/`os_status_baixa_equipamento`, OS manutenção
  `%v=os_status_ordem_servico_manutencao`/`os_resultado_ordem_servico_manutencao`,
  conferencia `%v=os_status_equipamento`, higienizacao `%v=os_status_higienizacao_equipamento`,
  alerta `%v=os_tipo_alerta_equipamento`/`os_status_alerta_equipamento`).
- Um campo com type id inválido corrompe a resolução do **tipo inteiro** no schema de runtime
  do Bubble (a Data API responde `Field not found` para QUALQUER campo do tipo enquanto houver
  um campo vivo com type inválido). É por isso que movimentacao/reserva/baixa/os_manutencao/
  conferencia/higienizacao — que ainda têm campos `os_*` inválidos vivos — aparecem 100% missing,
  inclusive text/date/number.
- `equipamento` também recebeu um campo inválido, mas ele foi **deletado** (`deleted:true`,
  display "- deleted") e recriado com `option.` → o tipo voltou a funcionar. Esse é o mesmo
  mecanismo pelo qual `alerta_equipamento`/`item_manutencao` mantêm os campos simples:
  `item_manutencao` nunca recebeu campo inválido (todos primitivos/custom no overlay), e em
  `alerta_equipamento` os dois campos inválidos são os únicos que a Data API não enxerga.
  Conclusão operacional para a Task 3: **deletar os campos `os_*` quebrados** de cada tipo
  (ou recriar por cima com o formato certo) destrava os campos simples já existentes.
- NÃO foi abort de batch no cliente: cada campo foi um POST independente (overlay: 1 change
  por entrada) e todos retornaram 200 com shape válido. A falha era 100% silenciosa.

**Bug secundário — valores de option set órfãos:**
`create_option_value` não resolvia/validava `option_set_key`. Overlay entries 1–4: o set foi
criado como `os_status_equipamento`, mas os 4 valores foram gravados em
`option_sets/status_equipamento/values/...` (chave inexistente) → valores perdidos em silêncio.

**Bug terciário — sucesso superficial:**
`BubbleEditorClient.write` (`src/bubble_mcp/execution/client.py`) só checava HTTP 2xx +
presença de `last_change`/`id_counter`; um `error` dentro da resposta 200 era tratado como
sucesso. E `execution/executor.py` dava `break` silencioso nos steps restantes do plano
quando um step falhava.

## Arquivos/funções alterados

1. `befree-bubble-mcp/src/bubble_mcp/aria_runtime/bubble_cli.py`
   - **Novo** `BubbleCLI._normalize_data_field_type()` + constantes
     `DATA_FIELD_PRIMITIVE_TYPES` / `DATA_FIELD_TYPE_ALIASES`: normaliza o field_type para
     `text|number|boolean|date|file|image|user|geographic_address|date_range|dateinterval|number_range`,
     `option.<key>`, `custom.<key>` ou `list.<...>`. Chave bare tipo `os_x` vira
     `option.os_x` **se o set existir**; ref de data type vira `custom.<key>`. Se o option
     set/data type referenciado NÃO existir → `ValueError` (nada é enviado ao Bubble) —
     isso força a ordem "option set (e valores) antes do campo".
   - **Novo** `_resolve_existing_option_set_key()` / `_resolve_existing_data_type_key()` +
     rastreamento em memória `_session_created_option_set_keys()` /
     `_session_created_data_type_keys()` (registrados em `create_option_set` /
     `create_data_type`, inclusive em dry-run) para que batches ordenados corretamente
     funcionem antes do refresh de cache.
   - `create_data_field()`: normaliza/valida antes de montar o payload; erro individual
     claro (`logger.error`, retorna False) sem derrubar os demais comandos do batch
     (`execute_commands` já continuava por comando; agora a falha é explícita e precoce).
   - `create_option_value()` / `create_option_attribute()`: resolvem o `option_set_key`
     (aceita display/`OS:x`/key) e recusam set inexistente.
2. `befree-bubble-mcp/src/bubble_mcp/execution/client.py`
   - **Novo** `extract_response_error()`; `write()` agora marca `ok=False` (com campo
     `error`) quando a resposta 2xx traz `error`/`errors`/`error_message`/`error_class`.
3. `befree-bubble-mcp/src/bubble_mcp/execution/executor.py`
   - `execute_plan()`: removidos os `break` silenciosos; cada step é executado e reportado
     individualmente (campo `error` por step + lista `failed_steps` no resultado).
4. `befree-bubble-mcp/tests/unit/test_schema_option_field_types.py` (novo, 14 testes).

Verificação pós-escrita: não existe releitura de servidor barata nesta camada (o
`verify_write` lê só o estado local), então a defesa implementada é (a) validação
pré-escrita contra contexto+cache+criações da sessão e (b) tratamento de erro embutido na
resposta do write. Recomenda-se à Task 3 fazer o probe canônico via Data API após cada lote.

## Resultado dos testes

- `tests/unit/test_schema_option_field_types.py`: **14 passed**.
- `tests/unit/test_execution.py + test_cli_commands.py + test_aria_dispatch.py`: **86 passed**.
- Suíte completa `pytest tests`: ver resultado final no relatório do agente (rodada em background).

## FORMATOS EXATOS DE PAYLOAD VALIDADOS (para `bubble_editor_write`)

> O servidor MCP em execução NÃO recarrega este fix nesta sessão. Para reconstruir o schema
> use `bubble_editor_write` com `{"profile":"gestorcoop","execute":true,"payload":{...}}`.
> O payload abaixo é o corpo enviado a `POST https://bubble.io/appeditor/write`.
> Envelope comum de todo payload:

```json
{
  "appname": "appgestorcoop",
  "app_version": "test",
  "changes": [ <uma ou mais changes abaixo> ]
}
```

Cada change leva também `"version_control_api_version": 4`, `"changelog_data": []` e um
`"session_id"` qualquer no formato `"<epoch_ms>x<n>"` (ex.: `"1784232966345x76"`).
**IMPORTANTE:** enviar UMA change por chamada (padrão validado em produção pelo próprio MCP)
e respeitar a ordem: (i) option set → (ii) valores → (iii) campos.

### (i) Criar option set

```json
{
  "intent": {"name": "WriteOptionSet"},
  "path_array": ["option_sets", "os_status_reserva_equipamento"],
  "body": {"%d": "OS:status_reserva_equipamento", "creation_source": "editor"},
  "version_control_api_version": 4,
  "changelog_data": [],
  "session_id": "1784232966345x76"
}
```
- Convenção validada: key = `os_<slug>`, display = `OS:<slug>`.

### (ii) Criar valor de option set

```json
{
  "intent": {"name": "WriteOptionValue"},
  "path_array": ["option_sets", "os_status_reserva_equipamento", "values", "bHjj8"],
  "body": {"sort_factor": 1, "%d": "Ativa", "db_value": "ativa"},
  "version_control_api_version": 4,
  "changelog_data": [],
  "session_id": "1784232966345x77"
}
```
- O 4º elemento do path é a KEY do valor: id curto estilo Bubble (`b` + 4-5 alfanum, ex.
  `bHjj8`) — gerar um novo id único por valor.
- `db_value` = slug do label (é o token que a Data API grava/aceita); `%d` = label exibido.
- Formato confirmado contra valores funcionais do export (`os_status_equipamento.values`).

### (iii) Criar campo de OPTION SET em um data type

```json
{
  "intent": {"name": "WriteCustomField"},
  "path_array": ["user_types", "reserva_equipamento", "%f3", "os_status_option_os_status_reserva_equipamento"],
  "body": {"%d": "os_status", "%v": "option.os_status_reserva_equipamento"},
  "version_control_api_version": 4,
  "changelog_data": [],
  "session_id": "1784232966345x78"
}
```
- **`%v` OBRIGATORIAMENTE com prefixo `option.`** — este é o bug corrigido.
- Convenção de field key validada (igual ao campo funcional do export):
  `<slug_do_nome>_<slug_do_tipo>` onde o slug do tipo troca `.`→`_`
  (ex.: nome `os_status` + tipo `option.os_status_reserva_equipamento` →
  `os_status_option_os_status_reserva_equipamento`).

### (iv) Criar campo SIMPLES (text/date/number/boolean/file/image/user/fk)

```json
{
  "intent": {"name": "WriteCustomField"},
  "path_array": ["user_types", "reserva_equipamento", "%f3", "txt_responsavel_text"],
  "body": {"%d": "txt_responsavel", "%v": "text"},
  "version_control_api_version": 4,
  "changelog_data": [],
  "session_id": "1784232966345x79"
}
```
- `%v` primitivos válidos: `text`, `number`, `boolean`, `date`, `file`, `image`, `user`,
  `geographic_address`, `date_range`, `dateinterval`, `number_range`.
- FK para outro data type: `%v = "custom.<data_type_key>"` e field key
  `<nome>_custom_<data_type_key>` (ex.: `{"%d":"fk_equipamento","%v":"custom.equipamento"}`
  em `.../%f3/fk_equipamento_custom_equipamento`). Lista: `list.<tipo>`.

### Extras úteis para a Task 3

- **Deletar campo quebrado** (necessário para destravar os tipos 100% missing — remover cada
  campo `os_*` com `%v` sem prefixo antes/além de criar o campo certo):
```json
[
  {"intent":{"name":"WriteCustomField"},"path_array":["user_types","<tipo>","%f3","<field_key_quebrado>","%del"],"body":true,"version_control_api_version":4,"changelog_data":[],"session_id":"<sid>"},
  {"intent":{"name":"WriteCustomField"},"path_array":["user_types","<tipo>","%f3","<field_key_quebrado>","%d"],"body":"<display> - deleted","version_control_api_version":4,"changelog_data":[],"session_id":"<sid>"}
]
```
  (essas duas changes podem ir juntas no mesmo payload; é o contrato emitido por
  `delete_data_field` e validado por teste existente). Field keys quebrados conhecidos
  (todos com `%v` sem prefixo, extraídos do overlay):
  - movimentacao_equipamento: `os_status_anterior_os_status_equipamento`, `os_status_novo_os_status_equipamento`, `os_tipo_evento_os_os_tipo_movimentacao_equipamento`, `os_motivo_recolhimento_os_motivo_recolhimento_equipamento`
  - reserva_equipamento: `os_status_os_status_reserva_equipamento`
  - baixa_equipamento: `os_motivo_os_motivo_baixa_equipamento`, `os_status_os_status_baixa_equipamento`
  - ordem_servico_manutencao: `os_status_os_status_ordem_servico_manutencao`, `os_resultado_os_resultado_ordem_servico_manutencao`
  - conferencia_equipamento: `os_status_destino_os_status_equipamento`
  - higienizacao_equipamento: `os_status_os_status_higienizacao_equipamento`
  - alerta_equipamento: `os_tipo_os_tipo_alerta_equipamento`, `os_status_os_status_alerta_equipamento`
  Atenção: o campo NOVO correto terá field key diferente (contém `option_`), então não há
  colisão de key ao recriar.
- **Valores órfãos**: os 4 primeiros valores de `os_status_equipamento` foram gravados na
  chave errada `status_equipamento` (overlay entries 1–4: Manutenção?/labels iniciais) —
  verificar `os_status_equipamento.values` no export atual: os valores funcionais lá são os
  válidos; recriar em `os_status_equipamento` qualquer valor exigido pelo contrato que falte.
- **Expor tipo na Data API** (já feito para todos os tipos, mas se precisar):
```json
{"intent":{"name":"ChangeAppSetting"},"path_array":["user_types","<tipo>","exposed_api"],"body":true,"version_control_api_version":4,"changelog_data":[],"session_id":"<sid>"}
```
- **Criar data type**:
```json
{"intent":{"name":"WriteCustom"},"path_array":["user_types","<tipo>"],"body":{"%d":"<tipo>"},"version_control_api_version":4,"changelog_data":[],"session_id":"<sid>"}
```
- A resposta de sucesso do write tem shape `{"id_counter":"...","last_change":"...","last_change_date":"..."}`.
  **HTTP 200 NÃO garante persistência semântica** — sempre rodar o probe canônico da Data API
  (`GET /obj/<tipo>?constraints=[{"key":"<campo>","constraint_type":"is_not_empty"}]&limit=1`,
  200 = existe / 404 = missing) após cada lote.
