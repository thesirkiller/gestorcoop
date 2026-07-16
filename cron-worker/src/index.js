// Worker de agendamento. O Cloudflare dispara `scheduled()` nos horários do
// wrangler.toml; ele apenas chama as rotas /api/cron/* do app (Pages) com o
// segredo compartilhado. Toda a lógica de negócio vive no app Next.

const ENDPOINTS = ['/api/cron/alertas-gerar', '/api/cron/reservas-expirar'];

async function dispararRotinas(env) {
  const base = (env.APP_BASE_URL || '').replace(/\/$/, '');
  const secret = env.CRON_SECRET;

  if (!base || !secret) {
    console.error('[cron] APP_BASE_URL ou CRON_SECRET ausente — abortando.');
    return;
  }

  const headers = {
    Authorization: `Bearer ${secret}`,
    'content-type': 'application/json',
  };

  for (const path of ENDPOINTS) {
    try {
      const res = await fetch(base + path, { method: 'POST', headers });
      const corpo = await res.text();
      console.log(`[cron] ${path} -> ${res.status} ${corpo}`);
    } catch (erro) {
      console.error(`[cron] ${path} falhou:`, erro && erro.message ? erro.message : erro);
    }
  }
}

export default {
  // Disparo agendado (produção).
  async scheduled(event, env, ctx) {
    ctx.waitUntil(dispararRotinas(env));
  },

  // Disparo manual via HTTP para teste (ex.: `curl -X POST <worker-url>`).
  // Protegido pelo mesmo CRON_SECRET.
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response('Use POST para disparar manualmente.', { status: 405 });
    }
    const auth = request.headers.get('authorization') || '';
    if (!env.CRON_SECRET || auth !== `Bearer ${env.CRON_SECRET}`) {
      return new Response('Não autorizado.', { status: 401 });
    }
    await dispararRotinas(env);
    return new Response('Rotinas disparadas.', { status: 200 });
  },
};
