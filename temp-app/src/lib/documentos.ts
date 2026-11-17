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

export function isComprovanteUploadFormatoAtivo(comprovante: unknown, now = Date.now()): boolean {
  if (typeof comprovante !== 'string') return false;
  const match = /^(\d+)\.[a-f0-9]{64}$/.exec(comprovante);
  return !!match && Number(match[1]) > now;
}

export function documentosObrigatoriosPendentes(files: DocumentoAdesao[], now = Date.now()): string[] {
  const lista = Array.isArray(files) ? files : [];
  const urlsUsadas = new Set<string>();
  const tiposValidos = new Set<TipoDocumentoAdesao>();

  for (const file of lista) {
    if (!file || typeof file !== 'object' || !isTipoDocumentoValido(file.tipo) || !isComprovanteUploadFormatoAtivo(file.comprovante, now)) continue;
    const urlNorm = normalizarUrlDocumento(file.url);
    if (!urlNorm || urlsUsadas.has(urlNorm)) continue;
    urlsUsadas.add(urlNorm);
    tiposValidos.add(file.tipo);
  }

  return TIPOS_DOCUMENTO_OBRIGATORIOS
    .filter(tipo => !tiposValidos.has(tipo))
    .map(tipo => TIPOS_DOCUMENTO[tipo]);
}

export function sugerirTipoDocumento(filename: string, filesAtuais: DocumentoAdesao[], now = Date.now()): TipoDocumentoAdesao {
  const nome = String(filename || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, ' ').toLowerCase();
  const preenchidos = new Set(filesAtuais.filter(file => normalizarUrlDocumento(file.url) && isComprovanteUploadFormatoAtivo(file.comprovante, now)).map(file => file.tipo));
  // Certidões específicas precedem o nome do conselho (ex.: regularidade COREN).
  const regras: [TipoDocumentoAdesao, RegExp][] = [
    ['certidao_regularidade', /\b(regularidade|nada[_\s-]?consta)\b/i],
    ['certidao_negativa_criminal', /\b(criminal|antecedente|negativa)\b/i],
    ['identificacao', /\b(rg|cnh|identidade|identificacao|cin)\b/i],
    ['conselho', /\b(coren|crm|crefito|crp|crn|crf|cro|crfa|cress|conselho|carteirinha|carteira)\b/i],
    ['residencia', /\b(endereco|residencia|energia|agua|luz)\b/i],
    ['cartao_vacinacao', /\b(vacina|vacinacao|imunizacao)\b/i],
    ['cartao_sus_pis', /\b(sus|pis|pasep|nis)\b/i],
  ];
  const inferido = regras.find(([, regra]) => regra.test(nome))?.[0];
  if (inferido && !preenchidos.has(inferido)) return inferido;
  return TIPOS_DOCUMENTO_OBRIGATORIOS.find(tipo => !preenchidos.has(tipo)) || 'outro';
}

export function diagnosticarDocumentosAdesao(files: DocumentoAdesao[], now = Date.now()) {
  const pendentes = documentosObrigatoriosPendentes(files, now);
  const urls = files.map(file => normalizarUrlDocumento(file?.url));
  const ativos = files.map(file => isComprovanteUploadFormatoAtivo(file?.comprovante, now));
  const tiposDuplicados = TIPOS_DOCUMENTO_OBRIGATORIOS.filter(tipo => files.filter((file, i) => file?.tipo === tipo && urls[i] && ativos[i]).length > 1).map(tipo => TIPOS_DOCUMENTO[tipo]);
  const porIndice = files.map((file, i) => {
    const expirado = !ativos[i];
    const urlInvalida = !urls[i];
    const urlDuplicada = !!urls[i] && urls.filter(url => url === urls[i]).length > 1;
    const tipoValido = isTipoDocumentoValido(file?.tipo);
    const tipoDuplicado = tipoValido && !!urls[i] && ativos[i] && tiposDuplicados.includes(TIPOS_DOCUMENTO[file.tipo]);
    const opcionalComObrigatoriosPendentes = tipoValido && pendentes.length > 0 && TIPOS_DOCUMENTO_OPCIONAIS.includes(file.tipo);
    const mensagens: string[] = [];
    if (expirado) mensagens.push('Envio expirado ou sem confirmação. Remova na lixeira e anexe novamente.');
    if (urlInvalida) mensagens.push('Link do arquivo inválido. Remova na lixeira e anexe novamente.');
    if (urlDuplicada) mensagens.push('Arquivo enviado mais de uma vez. Remova a cópia na lixeira.');
    if (tipoDuplicado) mensagens.push('Tipo obrigatório repetido. Confira o tipo selecionado em cada arquivo.');
    if (opcionalComObrigatoriosPendentes) mensagens.push('Marcado como opcional enquanto faltam obrigatórios. Confira se deve selecionar outro tipo.');
    const nivel: 'erro' | 'aviso' | 'ok' = expirado || urlInvalida || urlDuplicada ? 'erro' : tipoDuplicado || opcionalComObrigatoriosPendentes ? 'aviso' : 'ok';
    return { expirado, urlInvalida, urlDuplicada, tipoDuplicado, opcionalComObrigatoriosPendentes, nivel, mensagem: mensagens.join(' ') || null };
  });
  const nomes = (predicado: (item: typeof porIndice[number]) => boolean) => files.flatMap((file, i) => predicado(porIndice[i]) ? [file?.name || `Documento #${i + 1}`] : []);
  const expirados = nomes(item => item.expirado || item.urlInvalida);
  const urlsDuplicadas = nomes(item => item.urlDuplicada);
  const opcionaisComPendencia = nomes(item => item.opcionalComObrigatoriosPendentes);
  return { porIndice, expirados, urlsDuplicadas, tiposDuplicados, opcionaisComPendencia, pendentes, temErroBloqueante: pendentes.length > 0 || expirados.length > 0 || urlsDuplicadas.length > 0 };
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
