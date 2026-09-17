/** @type {import('next').NextConfig} */
const nextConfig = {};

// D1 local só é montado sob demanda: o import é dinâmico porque
// `next-dev` exige o pacote `wrangler`, ausente do build de produção.
if (process.env.NODE_ENV === 'development' && process.env.CLINICAL_LOCAL_D1 === 'true') {
  const { setupDevPlatform } = await import('@cloudflare/next-on-pages/next-dev');
  await setupDevPlatform();
}

export default nextConfig;
