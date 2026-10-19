/** @type {import('next').NextConfig} */
const nextConfig = {};

// D1 local é montado por padrão em desenvolvimento para garantir persistência
// compartilhada entre rotas Edge Runtime (sync, agenda e painel do gestor).
if (process.env.NODE_ENV === 'development' && process.env.CLINICAL_LOCAL_D1 !== 'false') {
  try {
    const { setupDevPlatform } = await import('@cloudflare/next-on-pages/next-dev');
    await setupDevPlatform();
  } catch (err) {
    console.warn('[next.config] Não foi possível inicializar setupDevPlatform local:', err);
  }
}

export default nextConfig;
