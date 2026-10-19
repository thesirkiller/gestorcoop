# Como trabalhar no GestorCoop

Página única para quem vai desenvolver aqui (humanos e agentes de IA).

---

## O mapa em 30 segundos

| Ambiente | Onde você vê | Banco | Como o código chega lá |
|---|---|---|---|
| **Bancada local** | `localhost:3000` | SQLite/D1 local (`wrangler dev --local`) | você roda `npm run dev` |
| **Preview do PR** | Cloudflare Pages Preview (`<branch>.gestorcoop.pages.dev`) | D1 Preview / Efêmero | abrir/atualizar o PR para `homolog` |
| **Homolog** | `homolog.gestorcoop.pages.dev` | D1 Homolog | merge do PR em `homolog` |
| **Produção** | `gestorcoop.app` / `gestao.gestorcoop.app` / `cooperado.gestorcoop.app` | `gestorcoop-db` (Produção) | merge do PR `homolog → main` |

Três regras que explicam tudo:

1. **Todo PR mira `homolog`.** É o branch default do repositório.
2. **Produção (`main`) só recebe promoção**, que é um PR de `homolog` para `main`. Nunca uma feature direto.
3. **Os 4 Gates de CI na VPS Oracle Cloud (`163.176.25.166`) são bloqueantes.** O botão de Merge só libera quando todos os 4 checks ficam verdes ✅.

---

## O ciclo de uma tarefa

```text
branch criada a partir de origin/homolog
   ↓ commit + push
PR (mira homolog)
   ↓ automático na VPS Oracle (self-hosted):
   ├── 1. Guards (migração e padrões)
   ├── 2. Lint · Typecheck · Test · Build
   ├── 3. Migrações do zero (D1 efêmero)
   └── 4. Segredos (gitleaks)
merge em homolog
   ↓ validação em homologação
PR homolog → main  ← promoção para produção
```

---

## Migrações D1 (`temp-app/migrations/`)

- Todo arquivo de migração deve seguir o padrão `<4+ digitos>_<slug_com_underscore>.sql` (ex: `0013_nova_tabela.sql`).
- **Expand agora, contract depois:** Adicionar tabela/coluna é livre. Comandos destrutivos (`DROP TABLE`, `DROP COLUMN`, `RENAME`, `TRUNCATE`, `DELETE FROM`) são barrados pelo CI a menos que o PR possua a label consciente `contract-aprovado`.
- Antes de abrir o PR, valide localmente em `temp-app`:
  ```bash
  npm run lint
  npx tsc --noEmit
  npm run test:documentacao
  npm run test:prontuarios
  ```
