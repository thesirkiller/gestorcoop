export const MAX_DOCUMENTO_BYTES = 10 * 1024 * 1024;
export const TIPOS_DOCUMENTO = {
  identificacao: 'Identificação (RG ou CNH)',
  residencia: 'Comprovante de residência',
  outro: 'Outro documento',
} as const;

export interface DocumentoAdesao {
  url: string;
  name: string;
  tipo: keyof typeof TIPOS_DOCUMENTO;
  comprovante: string;
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
  return (['identificacao', 'residencia'] as const)
    .filter(tipo => !files.some(file => file.tipo === tipo && normalizarUrlDocumento(file.url) && file.comprovante))
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
