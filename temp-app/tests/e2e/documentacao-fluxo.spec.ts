import { test, expect, Page } from '@playwright/test';

async function documentos(page: Page) {
  await page.addInitScript(() => localStorage.setItem('gc_adesao_progress_v1', JSON.stringify({ currentStep: 5 })));
  await page.goto('/cooperado/adesao');
  await expect(page.getByRole('heading', { name: 'Upload de Documentos' })).toBeVisible();
}
const arquivo = { name: 'rg.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 teste') };

test('não finaliza sem anexos nem durante upload; remover obrigatório bloqueia novamente', async ({ page }) => {
  let release!: () => void;
  const waiting = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/cooperado/upload', async route => {
    await waiting;
    const name = route.request().postDataBuffer()?.includes(Buffer.from('residencia.pdf')) ? 'residencia.pdf' : 'rg.pdf';
    await route.fulfill({ json: { success: true, url: `https://cdn.example.com/${name}`, name, comprovante: 'mock' } });
  });
  await documentos(page);
  const finalizar = page.getByRole('button', { name: /Finalizar & Assinar/ });
  await expect(finalizar).toBeDisabled();
  await page.locator('input[type=file]').setInputFiles(arquivo);
  await expect(page.getByText('Enviando arquivo...')).toBeVisible();
  await expect(finalizar).toBeDisabled();
  release();
  await page.getByRole('combobox', { name: 'Tipo de rg.pdf' }).selectOption('identificacao');
  await expect(finalizar).toBeDisabled();
  await page.locator('input[type=file]').setInputFiles({ ...arquivo, name: 'residencia.pdf' });
  await page.getByRole('combobox', { name: 'Tipo de residencia.pdf' }).selectOption('residencia');
  await expect(finalizar).toBeEnabled();
  await expect(page.getByRole('link', { name: 'rg.pdf', exact: true })).toHaveAttribute('href', 'https://cdn.example.com/rg.pdf');
  await page.getByRole('button', { name: 'Remover rg.pdf' }).click();
  await expect(finalizar).toBeDisabled();
});

test('falha de upload não conta como anexo e permite tentar novamente', async ({ page }) => {
  await page.route('**/api/cooperado/upload', route => route.fulfill({ status: 502, json: { error: 'Não foi possível salvar o documento. Tente enviar novamente.' } }));
  await documentos(page);
  await page.locator('input[type=file]').setInputFiles(arquivo);
  await expect(page.getByText('Não foi possível salvar o documento. Tente enviar novamente.')).toBeVisible();
  await expect(page.getByText('Arquivos Carregados (0)')).toBeVisible();
  await expect(page.getByRole('button', { name: /Finalizar & Assinar/ })).toBeDisabled();
});

test('erro da assinatura mantém anexos e rascunho para nova tentativa', async ({ page }) => {
  let count = 0;
  await page.route('**/api/cooperado/upload', route => {
    const name = ++count === 1 ? 'rg.pdf' : 'residencia.pdf';
    return route.fulfill({ json: { success: true, url: `https://cdn.example.com/${name}`, name, comprovante: 'mock' } });
  });
  await page.route('**/api/cooperado/adesao', route => route.fulfill({ status: 502, json: { error: 'Assinatura temporariamente indisponível.' } }));
  await documentos(page);
  await page.locator('input[type=file]').setInputFiles(arquivo);
  await page.getByRole('combobox', { name: 'Tipo de rg.pdf' }).selectOption('identificacao');
  await page.locator('input[type=file]').setInputFiles({ ...arquivo, name: 'residencia.pdf' });
  await page.getByRole('combobox', { name: 'Tipo de residencia.pdf' }).selectOption('residencia');
  await page.getByRole('button', { name: /Finalizar & Assinar/ }).click();
  await expect(page.getByText('Assinatura temporariamente indisponível.')).toBeVisible();
  await expect(page.getByText('Arquivos Carregados (2)')).toBeVisible();
  await expect(page.getByRole('button', { name: /Finalizar & Assinar/ })).toBeEnabled();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('gc_adesao_progress_v1')!).uploadedFiles.length)).toBe(2);
});
