# Alterando o banco do Bubble sem criar backend workflow

Guia prático pra conectar um front-end/backend externo ao banco de dados de um app Bubble
usando só a **Data API** — sem desenhar nenhum workflow no editor.

---

## A ideia central

O Bubble tem **duas** APIs diferentes, e isso confunde muita gente:

| | O que é | Precisa criar workflow? |
|---|---|---|
| **Workflow API** | Endpoints que você desenha à mão em *Backend Workflows* | Sim |
| **Data API** | Um CRUD REST **gerado automaticamente** pra cada Data Type | **Não** |

O caminho descrito aqui é o da **Data API**. Você liga um checkbox e o Bubble te entrega
GET / POST / PATCH / DELETE em cima da tabela, sem desenhar nada. É por isso que não
existe backend workflow no meio.

---

## Como ligar (3 passos no editor)

1. `Settings → API` → marcar **"Enable Data API"**.
2. Na lista que aparece logo abaixo, marcar **cada Data Type** que você quer expor.
   Tabela não marcada = 404, mesmo com token válido.
3. `Settings → API → API Tokens` → **Generate a new API token**.

> ⚠️ Esse token é **admin**: ele **ignora todas as Privacy Rules**.
> É exatamente por isso que ele nunca pode chegar no navegador. Ver a seção de segurança.

---

## O formato

A URL segue sempre o mesmo molde:

```
https://<seu-dominio>/version-test/api/1.1/obj/<nome_do_datatype>
```

- `version-test` = ambiente de **desenvolvimento**.
  Pra bater no **live**, tira esse pedaço: `https://<seu-dominio>/api/1.1/obj/<tipo>`.
  Errar isso é o bug mais comum: você grava e "não aparece" porque foi pro outro banco.
- `<nome_do_datatype>` é o nome **interno** — minúsculo, sem espaço.
  Não é o label bonitinho que aparece no editor.

Autenticação é um header simples:

```
Authorization: Bearer <SEU_TOKEN>
Content-Type: application/json
```

### Os verbos

```
GET    /obj/<tipo>          → lista (paginada)
GET    /obj/<tipo>/<id>     → um registro
POST   /obj/<tipo>          → cria           → responde { "id": "1699..." }
PATCH  /obj/<tipo>/<id>     → altera SÓ os campos enviados
PUT    /obj/<tipo>/<id>     → substitui o registro inteiro (apaga o que não veio)
DELETE /obj/<tipo>/<id>     → apaga
```

Na prática, **use `PATCH` pra 95% das alterações**.
`PUT` é uma armadilha: zera qualquer campo que você não mandou.

### Exemplos crus

```bash
# Ler (e descobrir os nomes reais dos campos)
curl -H "Authorization: Bearer $TOKEN" \
  "https://<dominio>/version-test/api/1.1/obj/produto?limit=1"

# Criar
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"txt_nome":"Teste","num_preco":10}' \
  "https://<dominio>/version-test/api/1.1/obj/produto"

# Atualizar um campo só
curl -X PATCH \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"num_preco":20}' \
  "https://<dominio>/version-test/api/1.1/obj/produto/1699123456789x123"
```

---

## Os detalhes que fazem perder tempo

### 1. Nome de campo ≠ label
O JSON tem que usar o nome **exato** do campo no banco. A regra de ouro: antes de escrever
qualquer `POST`, faça um `GET` de um registro real e leia as chaves que voltam. O que o
editor mostra e o que a API aceita divergem com frequência (campo renomeado costuma guardar
o nome antigo, por exemplo).

### 2. Resposta de leitura vem embrulhada
Não é o array puro:

```json
{
  "response": {
    "results": [ ... ],
    "cursor": 0,
    "remaining": 412,
    "count": 100
  }
}
```

Máximo **100 por página**. Pra pegar tudo, leia `remaining` e vá repetindo com
`cursor=100`, `cursor=200`... até zerar.

### 3. Busca com filtro
Vai por query string, como um array JSON codificado:

```
?constraints=[{"key":"campo","constraint_type":"equals","value":"x"}]
```

`constraint_type` úteis: `equals`, `not equal`, `text contains`, `greater than`,
`less than`, `in`, `is_empty`, `is_not_empty`.

Dá pra somar vários objetos no array — eles combinam com **E** (AND).

### 4. Relacionamento é só o ID
- Campo do tipo "Coisa" recebe a **string do `_id`**.
- Campo do tipo lista de coisas recebe um **array de strings de `_id`**.

Não mande objeto aninhado — o Bubble ignora silenciosamente.

### 5. Option Set é texto exato
Com acento e maiúscula idênticos ao cadastrado. Um caractere diferente e o campo grava
vazio, **sem dar erro**.

### 6. Data vai em ISO
`2026-08-12T14:30:00Z` ou timestamp em milissegundos.

### 7. Erro silencioso é a norma
Campo com nome errado **não** estoura 400. O Bubble aceita o request, responde 200 e
simplesmente não grava. Se algo "não salvou", suspeite do nome do campo antes de
qualquer outra coisa.

---

## Segurança — a parte mais importante

O token é admin e ignora Privacy Rules. Então **o front nunca fala com o Bubble direto**.
A arquitetura é:

```
navegador  →  seu backend (BFF)  →  Data API do Bubble
                    ↑
            o token vive só aqui,
            em variável de ambiente
```

O navegador chama uma rota do **seu** servidor; essa rota valida a sessão/permissão do
usuário, monta a chamada e só ela conhece o token. O cliente nunca vê a URL do Bubble
nem o Bearer.

Se o token fosse exposto no front, qualquer pessoa com o DevTools aberto teria leitura e
escrita irrestrita em **todas** as tabelas do app. É vazamento total do banco, não um
risco teórico.

### Uma camada de organização que ajuda muito

Concentre num **único módulo** o cliente HTTP (baseURL + headers) e exporte funções
nomeadas por intenção de negócio. Exemplo com axios:

```ts
// lib/bubble.ts
import axios from 'axios';

const bubble = axios.create({
  baseURL: process.env.BUBBLE_API_URL,          // .../version-test/api/1.1
  headers: {
    Authorization: `Bearer ${process.env.BUBBLE_API_TOKEN}`,
    'Content-Type': 'application/json',
  },
});

export const api = {
  async criarProduto(data: CreateProdutoInput) {
    const r = await bubble.post('/obj/produto', data);
    return r.data;                               // { id: "..." }
  },

  async atualizarProduto(id: string, patch: Partial<Produto>) {
    await bubble.patch(`/obj/produto/${id}`, patch);
  },

  async buscarPorCodigo(codigo: string) {
    const r = await bubble.get('/obj/produto', {
      params: {
        constraints: JSON.stringify([
          { key: 'txt_codigo', constraint_type: 'equals', value: codigo },
        ]),
      },
    });
    return r.data.response.results;
  },
};
```

O resto do código chama `api.criarProduto(...)` e **nunca monta URL na mão**. Quando o
schema do Bubble mudar, você conserta em um lugar só.

---

## Quando você AINDA vai precisar de backend workflow

A Data API resolve CRUD. Ela **não** resolve:

- **Atomicidade** — gravar em 3 tabelas e ter que falhar tudo junto se uma der erro.
- **Lógica que precisa rodar dentro do Bubble** — recorrentes, agendamento
  ("Schedule API Workflow"), envio de e-mail pelo próprio Bubble.
- **Signup / login de usuário** — tem endpoints próprios, não é `/obj`.
- **Regra de negócio que precisa valer mesmo se alguém chamar a API por fora.**

Se for só "gravar, ler, atualizar, apagar" — o que cobre a grande maioria dos casos — a
Data API sozinha basta. Boa parte da lógica composta dá pra manter no seu backend
orquestrando várias chamadas em sequência.

---

## Roteiro pra testar em 10 minutos

Faça isso **manualmente** antes de escrever qualquer código:

1. Ligue a Data API e marque **uma** tabela de teste.
2. Gere o token.
3. `GET` da lista no Insomnia/Postman/curl → confirma que autentica e mostra os nomes
   reais dos campos.
4. `POST` com 2 campos → guarde o `id` que voltou.
5. `PATCH` nesse id mudando 1 campo → confira no editor do Bubble se mudou de verdade.
6. Só depois disso escreva código.

Esses 5 passos eliminam 90% da depuração, porque separam
"meu código está errado" de "o Bubble não está configurado".

---

## Checklist rápido de troubleshooting

| Sintoma | Causa provável |
|---|---|
| 404 na rota | Data Type não marcado em Settings → API |
| 401 | Token errado, ou faltou o `Bearer ` antes dele |
| 200 mas não gravou | Nome do campo errado no JSON |
| Campo de Option Set vazio | Texto não bate exatamente (acento/maiúscula) |
| "Gravei e sumiu" | Confundiu `version-test` com live |
| Só vêm 100 registros | Paginação — use `cursor` + `remaining` |
| `PUT` apagou campos | Use `PATCH` |
