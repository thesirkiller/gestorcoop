export const MAX_DOCUMENTO_BYTES = 10 * 1024 * 1024;
export const TIPOS_DOCUMENTO = {
  identificacao: 'Identificação (RG ou CNH)',
  conselho: 'Carteira Profissional (COREN / Conselho)',
  certidao_regularidade: 'Certidão de Regularidade do COREN / Conselho',
  certidao_negativa_criminal: 'Certidão Negativa Criminal',
  residencia: 'Comprovante de endereço',
  cartao_vacinacao: 'Cartão de vacinação',
  cartao_sus_pis: 'Cartão do SUS / PIS (opcional)',
  outro: 'Outro documento de identificação social (opcional)',
} as const;

export type TipoDocumentoAdesao = keyof typeof TIPOS_DOCUMENTO;

export const TIPOS_DOCUMENTO_OBRIGATORIOS: readonly TipoDocumentoAdesao[] = [
  'identificacao',
  'conselho',
  'certidao_regularidade',
  'certidao_negativa_criminal',
  'residencia',
  'cartao_vacinacao',
] as const;

export const TIPOS_DOCUMENTO_OPCIONAIS: readonly TipoDocumentoAdesao[] = [
  'cartao_sus_pis',
  'outro',
] as const;

export interface DocumentoAdesao {
  url: string;
  name: string;
  tipo: TipoDocumentoAdesao;
  comprovante: string;
}

export function isTipoDocumentoValido(tipo: unknown): tipo is TipoDocumentoAdesao {
  return typeof tipo === 'string' && Object.prototype.hasOwnProperty.call(TIPOS_DOCUMENTO, tipo);
}

export function normalizarUrlDocumento(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim().startsWith('//') ? `https:${value.trim()}` : value.trim());
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname.includes('mock-file-')) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function documentosObrigatoriosPendentes(files: DocumentoAdesao[]): string[] {
  const lista = Array.isArray(files) ? files : [];
  const urlsUsadas = new Set<string>();
  const tiposValidos = new Set<TipoDocumentoAdesao>();

  for (const file of lista) {
    if (!file || typeof file !== 'object' || !isTipoDocumentoValido(file.tipo) || !file.comprovante) continue;
    const urlNorm = normalizarUrlDocumento(file.url);
    if (!urlNorm || urlsUsadas.has(urlNorm)) continue;
    urlsUsadas.add(urlNorm);
    tiposValidos.add(file.tipo);
  }

  return TIPOS_DOCUMENTO_OBRIGATORIOS
    .filter(tipo => !tiposValidos.has(tipo))
    .map(tipo => TIPOS_DOCUMENTO[tipo]);
}

export function validarArquivoDocumento(file: File): string | null {
  if (file.size === 0) return 'O arquivo está vazio. Selecione outro documento.';
  if (file.size > MAX_DOCUMENTO_BYTES) return 'O arquivo excede 10 MB. Envie um arquivo menor.';
  if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type) || !/\.(pdf|jpe?g|png)$/i.test(file.name)) {
    return 'Formato não aceito. Envie PDF, JPEG ou PNG.';
  }
  return null;
}

export function nomeDocumento(url?: string | null): string {
  if (typeof url !== 'string' || !url.trim()) return 'documento';
  const name = url.split(/[?#]/)[0]?.split('/').pop() || 'documento';
  try { return decodeURIComponent(name); } catch { return name; }
}
