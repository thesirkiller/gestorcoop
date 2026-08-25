import { Page } from '@playwright/test';

/**
 * Injeta a sessão de cooperado exigida pelo middleware para as telas de
 * prontuário.
 *
 * Antes, os testes do prontuário passavam sem sessão nenhuma porque o
 * middleware tinha um `if (NODE_ENV === 'development') return next()`, que
 * desligava a autenticação de todo o app — gestor incluído. Esse atalho foi
 * removido; a sessão de teste passou a ser explícita, como já era em
 * equipamentos.spec.ts.
 *
 * Fica fora de um arquivo `.spec` de propósito: o Playwright recusa import
 * entre arquivos de teste.
 */
export async function autenticarCooperado(page: Page) {
  await page.context().addCookies([
    { name: 'cooperado_session', value: 'user-e2e-coop', url: 'http://localhost:3005' },
  ]);

  // O middleware só confere a presença do cookie; quem resolve o cooperado de
  // verdade é /api/cooperado/me, que aqui é mockado para não bater no Bubble.
  await page.route('**/api/cooperado/me', (route) =>
    route.fulfill({ json: { success: true, cooperadoId: 'coop-e2e-1', nome: 'Ana Silva' } })
  );
}
