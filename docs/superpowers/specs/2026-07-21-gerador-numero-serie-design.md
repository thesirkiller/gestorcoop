# Especificação de Design: Gerador de Número de Série para Equipamentos

**Data**: 2026-07-21  
**Módulo**: Gestão de Equipamentos / Cadastro  

## Objetivo
Adicionar uma funcionalidade de geração automática e semi-automática de número de série / patrimônio no cadastro e edição de equipamentos no painel do gestor.

---

## Requisitos Funcionais

1. **Geração Automática de Prefixo por Marca/Modelo**:
   - Se os campos **Marca** e/ou **Modelo** estiverem preenchidos:
     - Extrai os 3 ou 4 primeiros caracteres da Marca e do Modelo (higienizados em caixa alta, sem caracteres especiais ou espaços).
     - Exemplo: Marca `Philips`, Modelo `EverFlo` $\rightarrow$ `PHIL-EF-`.
     - Exemplo: Marca `ResMed`, Modelo `AirSense 10` $\rightarrow$ `RESM-AIR1-`.
   - Se Marca ou Modelo estiverem em branco:
     - Utiliza o prefixo genérico `EQP-`.

2. **Sufixo Único**:
   - Cada código gerado recebe um sufixo numérico de 4 a 5 dígitos (ex: `PHIL-EF-3842` ou `EQP-91823`).

3. **Gatilhos na Interface (UI)**:
   - **Botão Manual 🪄**: Junto ao campo "Nº Série / Patrimônio *" no modal de cadastro (`temp-app/src/app/gestor/equipamentos/page.tsx`), com o rótulo ou ícone de varinha mágica para preencher o campo sob demanda.
   - **Fallback ao Salvar**: Se o usuário submeter o formulário de cadastro com o campo de Número de Série em branco, o sistema invoca automaticamente a função de geração antes de enviar para a API.

---

## Arquitetura & Implementação

### 1. Módulo Auxiliar `temp-app/src/lib/equipamentos-helpers.ts`
Exportar a função `generateSerialNumber(marca?: string, modelo?: string): string`:
```ts
export function generateSerialNumber(marca?: string, modelo?: string): string {
  const sanitize = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  
  let prefix = '';
  const cleanMarca = marca ? sanitize(marca) : '';
  const cleanModelo = modelo ? sanitize(modelo) : '';

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

### 2. Formulário no Modal (`temp-app/src/app/gestor/equipamentos/page.tsx`)
- Atualizar o layout do input de `Nº Série / Patrimônio *` adicionando o botão de ação.
- No `handleSubmitEquipamento`, adicionar a verificação: se `!equipSerie.trim()`, preenche `equipSerie` chamando `generateSerialNumber(equipMarca, equipModelo)` antes de efetuar o submit.

---

## Plano de Testes / Verificação
- **Teste Unitário/Manual**:
  1. Abrir o modal "Cadastrar Equipamento".
  2. Preencher Marca `Philips` e Modelo `EverFlo`, clicar em "Gerar" e verificar se o campo preenche `PHIL-EVER-XXXX` ou `PHIL-EF-XXXX`.
  3. Limpar o campo e salvar diretamente; verificar se um S/N automático é gerado e salvo.
  4. Testar compilação Next.js (`npx tsc --noEmit`).
