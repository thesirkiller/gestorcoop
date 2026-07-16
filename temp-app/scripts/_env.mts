// Carrega o env do módulo de equipamentos ANTES de importar src/lib/bubble.ts
// (que lê process.env no load). Ordem: variáveis já no ambiente têm prioridade;
// senão cai pro .env.local da raiz do app.
//
// Alvo (test x live): defina BUBBLE_API_URL. Ex.:
//   test: https://gestorcoop.app/version-test/api/1.1  (padrão do .env.local)
//   live: https://gestorcoop.app/api/1.1
import fs from 'node:fs';

const envPath = new URL('../.env.local', import.meta.url);
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    if (line.trim().startsWith('#')) continue;
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

// A homologação exige V2 ligado para exercitar os fluxos.
process.env.EQUIPAMENTOS_V2_ENABLED = 'true';

export const API = process.env.BUBBLE_API_URL;
export const TOKEN = process.env.BUBBLE_API_TOKEN;

if (!API || !TOKEN) {
  console.error('Defina BUBBLE_API_URL e BUBBLE_API_TOKEN (via .env.local ou ambiente).');
  process.exit(2);
}

export const isLive = !/version-test/.test(API);
