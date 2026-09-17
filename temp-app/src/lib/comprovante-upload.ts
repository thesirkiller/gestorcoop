// Comprova que a URL foi retornada por um upload concluído neste servidor.
// O navegador não pode transformar um link arbitrário em documento enviado.
const encoder = new TextEncoder();
async function key() {
  const secret = process.env.BUBBLE_API_TOKEN;
  if (!secret) throw new Error('Armazenamento de documentos não configurado.');
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function criarComprovanteUpload(url: string): Promise<string> {
  const expires = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const signature = await crypto.subtle.sign('HMAC', await key(), encoder.encode(`${expires}:${url}`));
  return `${expires}.${Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, '0')).join('')}`;
}

export async function verificarComprovanteUpload(url: string, receipt: unknown): Promise<boolean> {
  if (typeof receipt !== 'string') return false;
  const [expires, signature, extra] = receipt.split('.');
  if (extra || !/^\d+$/.test(expires) || Number(expires) < Date.now() || !/^[a-f0-9]{64}$/.test(signature || '')) return false;
  const bytes = Uint8Array.from(signature.match(/../g)!, byte => parseInt(byte, 16));
  return crypto.subtle.verify('HMAC', await key(), bytes, encoder.encode(`${expires}:${url}`));
}
