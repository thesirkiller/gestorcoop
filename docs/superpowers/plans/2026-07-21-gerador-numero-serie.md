# Gerador de Número de Série Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o gerador automático e manual de Número de Série/Patrimônio no cadastro/edição de equipamentos.

**Architecture:** Criar uma função helper em `temp-app/src/lib/equipamentos-helpers.ts` para padronização de códigos baseados em Marca/Modelo e integrar no formulário do modal de equipamentos em `temp-app/src/app/gestor/equipamentos/page.tsx` com um botão dedicado e fallback no submit.

**Tech Stack:** Next.js 14, React, TypeScript, Tailwind CSS, Lucide Icons (`Wand2` ou `Sparkles`).

---

### Task 1: Criar Helper de Geração de Número de Série

**Files:**
- Create: `temp-app/src/lib/equipamentos-helpers.ts`
- Modify: `temp-app/src/app/gestor/equipamentos/page.tsx:1-30`

- [ ] **Step 1: Criar o arquivo helper com a função `generateSerialNumber`**

```ts
/**
 * Gera um número de série/patrimônio baseado na marca e modelo fornecidos.
 * Ex: Marca "Philips", Modelo "EverFlo" -> "PHIL-EVER-1234"
 * Se faltar marca/modelo -> "EQP-12345"
 */
export function generateSerialNumber(marca?: string, modelo?: string): string {
  const sanitize = (str: string) =>
    str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase();

  const cleanMarca = marca ? sanitize(marca) : '';
  const cleanModelo = modelo ? sanitize(modelo) : '';

  let prefix = '';

  if (cleanMarca && cleanModelo) {
    prefix = `${cleanMarca.slice(0, 4)}-${cleanModelo.slice(0, 4)}`;
  } else if (cleanMarca) {
    prefix = `${cleanMarca.slice(0, 4)}`;
  } else if (cleanModelo) {
    prefix = `${cleanModelo.slice(0, 4)}`;
  } else {
    prefix = 'EQP';
  }

  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${randomNum}`;
}
```

- [ ] **Step 2: Verificar a compilação de tipos do helper**

Run: `npx tsc --noEmit` na pasta `temp-app`
Expected: PASS (0 erros)

- [ ] **Step 3: Commit**

```bash
git add temp-app/src/lib/equipamentos-helpers.ts
git commit -m "feat(equipamentos): add generateSerialNumber helper function"
```

---

### Task 2: Integrar o Botão e o Fallback no Formulário do Modal

**Files:**
- Modify: `temp-app/src/app/gestor/equipamentos/page.tsx`

- [ ] **Step 1: Importar a função helper e ícone `Wand2` ou `Sparkles` no `page.tsx`**

Adicionar a importação:
```ts
import { generateSerialNumber } from '@/lib/equipamentos-helpers';
import { Sparkles } from 'lucide-react';
```

- [ ] **Step 2: Atualizar o campo de Número de Série no modal do formulário**

No `temp-app/src/app/gestor/equipamentos/page.tsx`, substituir a `div` do input do Nº Série para incluir o botão "Gerar":
```tsx
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Nº Série / Patrimônio *</label>
                    <button
                      type="button"
                      onClick={() => setEquipSerie(generateSerialNumber(equipMarca, equipModelo))}
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 hover:underline transition-all"
                      title="Gerar número de série automático"
                    >
                      <Sparkles className="w-3 h-3 text-amber-500" />
                      Gerar S/N
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={equipSerie}
                    onChange={(e) => setEquipSerie(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none font-mono"
                    placeholder="Ex: SN-19842"
                  />
                </div>
```

- [ ] **Step 3: Adicionar a auto-geração no submit caso o campo fique em branco**

No método `handleSubmitEquipamento`:
```ts
    let finalSerie = equipSerie.trim();
    if (!finalSerie) {
      finalSerie = generateSerialNumber(equipMarca, equipModelo);
      setEquipSerie(finalSerie);
    }
```
E usar `finalSerie` no payload do cadastro.

- [ ] **Step 4: Verificar a compilação do Next.js**

Run: `npx tsc --noEmit` na pasta `temp-app`
Expected: PASS (0 erros)

- [ ] **Step 5: Commit**

```bash
git add temp-app/src/app/gestor/equipamentos/page.tsx
git commit -m "feat(equipamentos): integrate serial number generator button and submit fallback"
```
