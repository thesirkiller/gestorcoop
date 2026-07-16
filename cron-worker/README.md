# gestorcoop-cron

Worker de agendamento (Cloudflare Cron Triggers) para o módulo de equipamentos.
Roda **separado** do app (que está em Cloudflare Pages) porque Pages não dispara
cron nativamente. Fica no **plano Free** do Workers (até 5 cron triggers/conta;
sem custo adicional).

Ele não contém lógica de negócio — apenas chama, no horário agendado, as rotas
protegidas do app:

- `POST /api/cron/alertas-gerar`
- `POST /api/cron/reservas-expirar`

autenticando com o header `Authorization: Bearer <CRON_SECRET>`.

## Pré-requisitos

- Node/npm instalados.
- `wrangler` (usado via `npx`, não precisa instalar global).
- Estar logado na conta Cloudflare: `npx wrangler login`.

## Configuração

1. **Defina o `APP_BASE_URL`** em `wrangler.toml` com o domínio real do app
   (ex.: `https://gestorcoop.pages.dev` ou o domínio custom).

2. **Gere um segredo forte** e configure nos DOIS lados com o MESMO valor:

   - No Worker:
     ```
     cd cron-worker
     npx wrangler secret put CRON_SECRET
     ```
   - No app (Cloudflare Pages → Settings → Environment variables): adicione
     `CRON_SECRET` com o mesmo valor (nos ambientes Production e Preview que usar).
   - Para rodar/testar local, adicione também em `temp-app/.env.local`:
     ```
     CRON_SECRET=<mesmo-valor>
     ```

## Deploy

```
cd cron-worker
npx wrangler deploy
```

O cron passa a rodar nos horários de `wrangler.toml` (`[triggers] crons`).
Horários são **UTC**. O default `0 9 * * *` ≈ 06:00 America/Sao_Paulo, diário.

## Teste manual

- Via HTTP (dispara as duas rotinas na hora):
  ```
  curl -X POST https://gestorcoop-cron.<sua-conta>.workers.dev \
    -H "Authorization: Bearer <CRON_SECRET>"
  ```
- Ou o cron agendado no ambiente de dev do wrangler:
  ```
  npx wrangler dev --test-scheduled
  # depois: curl "http://localhost:8787/__scheduled?cron=0+9+*+*+*"
  ```

## Segurança

- As rotas `/api/cron/*` do app recusam (401) qualquer chamada sem o
  `CRON_SECRET` correto — o cron é o único que as dispara automaticamente.
- O mesmo trabalho continua acionável manualmente pela UI autenticada em
  `/api/gestor/equipamentos/alertas/gerar` (botão "Gerar alertas"), que usa a
  sessão de gestor, sem precisar do segredo.
- As rotinas são idempotentes: rodar mais de uma vez não duplica alertas nem
  reexpira reservas já tratadas.
