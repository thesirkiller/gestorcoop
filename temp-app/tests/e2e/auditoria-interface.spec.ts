import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Evidências locais da auditoria; não usa cadastros reais.
test('auditoria de rótulos, alvos de toque e largura da adesão', async ({ page }) => {
  const output = path.resolve('docs/auditoria-2026-09-08');
  await mkdir(output, { recursive: true });
  await page.goto('/cooperado/adesao');
  await expect(page.locator('input[name=nomeCompleto]')).toBeVisible();
  const observations = [];
  for (const width of [360, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const metrics = await page.evaluate(() => {
      const visible = (element: Element) => element.getBoundingClientRect().width > 0 && element.getBoundingClientRect().height > 0;
      const fields = Array.from(document.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input:not([type=hidden]),select,textarea')).filter(visible);
      const buttons = Array.from(document.querySelectorAll('button,a')).filter(visible);
      return {
        viewport: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        fields: fields.length,
        withoutAccessibleLabel: fields.filter(el => !el.labels?.length && !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby')).map(el => el.getAttribute('name') || el.tagName),
        smallTargets: buttons.map(el => ({ text: el.textContent?.trim() || el.getAttribute('aria-label'), width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height })).filter(el => el.width < 44 || el.height < 44),
      };
    });
    observations.push(metrics);
    await page.screenshot({ path: path.join(output, `adesao-${width}.png`), fullPage: true });
  }
  await writeFile(path.join(output, 'interface.json'), JSON.stringify(observations, null, 2));
  console.log('Auditoria da adesão:', JSON.stringify(observations));
});
