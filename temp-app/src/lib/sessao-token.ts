/**
 * Token de sessão do cooperado, assinado e com validade.
 *
 * POR QUE ISTO EXISTE
 * -------------------
 * O prontuário é aberto dentro de um iframe do app do Bubble. Enquanto o app
 * for servido num domínio diferente de `gestorcoop.app` (hoje
 * `gestorcoop.pages.dev`), o navegador trata o iframe como cross-site e
 * simplesmente NÃO envia o cookie `SameSite=Lax` — a sessão não existe lá
 * dentro. `SameSite=None` viraria cookie de terceiro, que o Safari bloqueia por
 * padrão. Nenhuma das duas resolve sem um domínio same-site.
 *
 * Como não haverá subdomínio, a sessão passa a ter DUAS formas:
 *
 *   1. cookie httpOnly — quando o app é primeira-parte (aba própria, WebView
 *      abrindo a URL direto). Continua sendo o caminho preferido.
 *   2. este token, guardado pelo cliente e mandado em `Authorization: Bearer` —
 *      quando o cookie não chega.
 *
 * O QUE MUDA EM SEGURANÇA
 * -----------------------
 * O cookie guarda o `user._id` CRU. Isso só é seguro porque é `httpOnly`: o
 * cliente não consegue lê-lo nem forjá-lo. Um valor equivalente entregue ao
 * cliente seria trivialmente falsificável — bastaria trocar o id no
 * sessionStorage para gravar evolução em nome de outro profissional. Por isso
 * o token é HMAC-SHA256 sobre o payload e carrega expiração própria.
 *
 * Reaproveita `ASSINATURA_SECRET` com SEPARAÇÃO DE DOMÍNIO (o prefixo abaixo),
 * para não exigir uma segunda variável de ambiente no deploy. O prefixo impede
 * que um selo de evolução seja aceito como token de sessão, ou vice-versa.
 *
 * Este módulo é deliberadamente autossuficiente: não importa `@/lib/bubble`
 * nem nada que toque rede, para poder ser usado no edge sem arrastar o axios.
 */

const PREFIXO_DOMINIO = 'sessao-cooperado:v1|';

/** 12 horas, igual ao `maxAge` do cookie. */
export const VALIDADE_PADRAO_SEGUNDOS = 60 * 60 * 12;

function b64urlDeBytes(bytes: Uint8Array): string {
  let binario = '';
  for (let i = 0; i < bytes.length; i++) binario += String.fromCharCode(bytes[i]);
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function bytesDeB64url(texto: string): Uint8Array {
  const b64 = texto.replace(/-/g, '+').replace(/_/g, '/');
  const resto = b64.length % 4;
  const binario = atob(resto ? b64 + '='.repeat(4 - resto) : b64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

function exigirSegredo(): string {
  const segredo = process.env.ASSINATURA_SECRET;
  if (!segredo) {
    throw new Error(
      'ASSINATURA_SECRET não configurada. Sem ela não é possível emitir sessão de cooperado.',
    );
  }
  return segredo;
}

async function hmac(payloadB64: string, segredo: string): Promise<string> {
  const chave = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(segredo),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const assinatura = await crypto.subtle.sign(
    'HMAC',
    chave,
    new TextEncoder().encode(PREFIXO_DOMINIO + payloadB64),
  );
  return b64urlDeBytes(new Uint8Array(assinatura));
}

/**
 * Comparação em tempo constante. `a === b` sai no primeiro byte diferente, e a
 * diferença de tempo vaza quanto do prefixo o atacante já acertou.
 */
function iguaisEmTempoConstante(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diferenca = 0;
  for (let i = 0; i < a.length; i++) diferenca |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diferenca === 0;
}

/** Emite `v1.<payload>.<assinatura>`. Lança se o segredo não estiver configurado. */
export async function assinarTokenSessao(
  userId: string,
  validadeSegundos: number = VALIDADE_PADRAO_SEGUNDOS,
): Promise<string> {
  const segredo = exigirSegredo();
  const payload = JSON.stringify({
    u: userId,
    exp: Math.floor(Date.now() / 1000) + validadeSegundos,
  });
  const payloadB64 = b64urlDeBytes(new TextEncoder().encode(payload));
  return `v1.${payloadB64}.${await hmac(payloadB64, segredo)}`;
}

/**
 * Devolve o `user._id` quando o token é autêntico e está no prazo; `null` em
 * qualquer outro caso. Nunca lança por token malformado — entrada hostil é
 * esperada aqui, e o chamador trata `null` como "não autenticado".
 */
export async function verificarTokenSessao(token: string | null | undefined): Promise<string | null> {
  if (!token) return null;

  const partes = token.split('.');
  if (partes.length !== 3 || partes[0] !== 'v1') return null;
  const [, payloadB64, assinaturaRecebida] = partes;

  let segredo: string;
  try {
    segredo = exigirSegredo();
  } catch {
    // Segredo ausente não pode virar "sessão válida". Grita no log porque em
    // produção isto significa que ninguém consegue abrir o prontuário.
    console.error('ASSINATURA_SECRET ausente: nenhum token de sessão pode ser verificado.');
    return null;
  }

  let assinaturaEsperada: string;
  try {
    assinaturaEsperada = await hmac(payloadB64, segredo);
  } catch {
    return null;
  }
  if (!iguaisEmTempoConstante(assinaturaRecebida, assinaturaEsperada)) return null;

  try {
    const dados = JSON.parse(new TextDecoder().decode(bytesDeB64url(payloadB64)));
    if (typeof dados?.u !== 'string' || typeof dados?.exp !== 'number') return null;
    if (Math.floor(Date.now() / 1000) >= dados.exp) return null;
    return dados.u;
  } catch {
    return null;
  }
}

/** Extrai o token de um cabeçalho `Authorization: Bearer <token>`. */
export function tokenDoCabecalho(authorization: string | null | undefined): string | null {
  if (!authorization) return null;
  const [esquema, valor] = authorization.split(' ');
  if (!valor || esquema.toLowerCase() !== 'bearer') return null;
  return valor.trim() || null;
}
