export type EmpresaContratanteId = 'verdes-mares' | 'multi' | 'isa';

export interface EmpresaContratante {
  id: EmpresaContratanteId;
  nome: string;
  nomeCurto: string;
  razaoSocial: string;
  cnpj: string;
  cabecalhoTexto: string;
  logoUrl: string;
  corPrimaria: string;
  corBadgeBg: string;
  corBadgeTexto: string;
  corBadgeBorda: string;
}

const SVG_LOGO_MULTI = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 100" fill="none">
    <rect width="320" height="100" rx="16" fill="#0F172A"/>
    <circle cx="48" cy="50" r="26" fill="#0284C7"/>
    <path d="M48 33V67M31 50H65" stroke="white" stroke-width="7.5" stroke-linecap="round"/>
    <text x="86" y="53" font-family="Arial, sans-serif" font-weight="900" font-size="30" fill="#FFFFFF" letter-spacing="1.5">MULTCARE</text>
    <text x="88" y="75" font-family="Arial, sans-serif" font-weight="700" font-size="13" fill="#38BDF8" letter-spacing="3">HOME CARE</text>
  </svg>`
)}`;

const SVG_LOGO_ISA = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 100" fill="none">
    <rect width="320" height="100" rx="16" fill="#064E3B"/>
    <circle cx="52" cy="50" r="28" fill="#10B981"/>
    <path d="M40 50L48 58L65 41" stroke="white" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="94" y="55" font-family="Arial, sans-serif" font-weight="900" font-size="38" fill="#FFFFFF" letter-spacing="4">ISA</text>
    <text x="96" y="76" font-family="Arial, sans-serif" font-weight="700" font-size="12" fill="#6EE7B7" letter-spacing="2.5">ASSISTÊNCIA INTEGRAL</text>
  </svg>`
)}`;

export const EMPRESAS_CONTRATANTES: EmpresaContratante[] = [
  {
    id: 'verdes-mares',
    nome: 'Verdes Mares Home Care',
    nomeCurto: 'Verdes Mares',
    razaoSocial: 'HOME CARE DE ASSISTÊNCIA INTEGRAL',
    cnpj: '54.800.169/0001-55',
    cabecalhoTexto: 'HOME CARE DE ASSISTÊNCIA INTEGRAL — INSCRIÇÃO CNPJ: 54.800.169/0001-55',
    logoUrl: '/logos/verdes-mares.png',
    corPrimaria: '#0d9488',
    corBadgeBg: 'bg-teal-50',
    corBadgeTexto: 'text-teal-800',
    corBadgeBorda: 'border-teal-200',
  },
  {
    id: 'multi',
    nome: 'Multcare Home Care',
    nomeCurto: 'Multcare',
    razaoSocial: 'MULTCARE ASSISTÊNCIA DOMICILIAR INTEGRAL LTDA',
    cnpj: '32.450.918/0001-20',
    cabecalhoTexto: 'MULTCARE HOME CARE DE ASSISTÊNCIA INTEGRAL — INSCRIÇÃO CNPJ: 32.450.918/0001-20',
    logoUrl: SVG_LOGO_MULTI,
    corPrimaria: '#0284c7',
    corBadgeBg: 'bg-sky-50',
    corBadgeTexto: 'text-sky-800',
    corBadgeBorda: 'border-sky-200',
  },
  {
    id: 'isa',
    nome: 'ISA Home Care',
    nomeCurto: 'ISA',
    razaoSocial: 'ISA SAÚDE E ASSISTÊNCIA DOMICILIAR INTEGRAL',
    cnpj: '18.920.340/0001-88',
    cabecalhoTexto: 'ISA HOME CARE DE ASSISTÊNCIA INTEGRAL — INSCRIÇÃO CNPJ: 18.920.340/0001-88',
    logoUrl: SVG_LOGO_ISA,
    corPrimaria: '#059669',
    corBadgeBg: 'bg-emerald-50',
    corBadgeTexto: 'text-emerald-800',
    corBadgeBorda: 'border-emerald-200',
  },
];

export const EMPRESA_PADRAO: EmpresaContratante = EMPRESAS_CONTRATANTES[0];

/**
 * Identifica uma empresa contratante a partir de ID, nome curto, razão social ou texto livre
 * (ex: salvo em `plano_saude` ou `empresa_contratante`).
 * Retorna `null` se o texto não corresponder a nenhuma das empresas do catálogo.
 */
export function identificarEmpresaContratante(valor?: string | null): EmpresaContratante | null {
  if (!valor) return null;
  const limpo = valor
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  if (!limpo) return null;

  if (
    limpo.includes('verdes') ||
    limpo.includes('mares') ||
    limpo === 'verdes-mares' ||
    limpo.includes('54.800.169')
  ) {
    return EMPRESAS_CONTRATANTES[0];
  }
  if (
    limpo.includes('multcare') ||
    limpo.includes('multi') ||
    limpo === 'multi-saude' ||
    limpo.includes('32.450.918') ||
    limpo.includes('11.426.910')
  ) {
    return EMPRESAS_CONTRATANTES[1];
  }
  if (
    /\bisa\b/.test(limpo) ||
    limpo.includes('isa home') ||
    limpo.includes('isa saude') ||
    limpo.includes('18.920.340')
  ) {
    return EMPRESAS_CONTRATANTES[2];
  }

  return null;
}

/**
 * Retorna a empresa contratante correspondente ou a empresa padrão (Verdes Mares)
 * para garantir que cabeçalhos e impressões sempre exibam logomarca oficial.
 */
export function obterEmpresaContratante(valor?: string | null): EmpresaContratante {
  return identificarEmpresaContratante(valor) || EMPRESA_PADRAO;
}

const STORAGE_KEY_PREFIX = 'gestorcoop:empresa_contratante:';
const STORAGE_SEXO_PREFIX = 'gestorcoop:paciente_sexo:';

export function salvarEmpresaContratanteLocal(pacienteId: string, empresaId: string, nomePaciente?: string): void {
  if (typeof window === 'undefined' || !pacienteId) return;
  try {
    window.localStorage.setItem(`${STORAGE_KEY_PREFIX}${pacienteId}`, empresaId);
    if (nomePaciente) {
      const chaveNome = nomePaciente.toLowerCase().trim();
      if (chaveNome) {
        window.localStorage.setItem(`${STORAGE_KEY_PREFIX}nome:${chaveNome}`, empresaId);
      }
    }
  } catch {
    // Ignora falhas de storage em modo privado
  }
}

export function lerEmpresaContratanteLocal(pacienteId?: string, nomePaciente?: string): EmpresaContratante | null {
  if (typeof window === 'undefined') return null;
  try {
    if (pacienteId) {
      const salvoPorId = window.localStorage.getItem(`${STORAGE_KEY_PREFIX}${pacienteId}`);
      const emp = identificarEmpresaContratante(salvoPorId);
      if (emp) return emp;
    }
    if (nomePaciente) {
      const chaveNome = nomePaciente.toLowerCase().trim();
      const salvoPorNome = window.localStorage.getItem(`${STORAGE_KEY_PREFIX}nome:${chaveNome}`);
      const emp = identificarEmpresaContratante(salvoPorNome);
      if (emp) return emp;
    }
  } catch {
    // Ignora falhas de storage
  }
  return null;
}

export function salvarSexoPacienteLocal(pacienteId: string, sexo: string): void {
  if (typeof window === 'undefined' || !pacienteId || !sexo) return;
  try {
    window.localStorage.setItem(`${STORAGE_SEXO_PREFIX}${pacienteId}`, sexo);
  } catch {}
}

export function lerSexoPacienteLocal(pacienteId?: string): string {
  if (typeof window === 'undefined' || !pacienteId) return '';
  try {
    return window.localStorage.getItem(`${STORAGE_SEXO_PREFIX}${pacienteId}`) || '';
  } catch {
    return '';
  }
}

/**
 * Resolve a empresa contratante de um registro de paciente combinando:
 * 1. Campo explícito `empresa_contratante` (se presente)
 * 2. Campo `plano_saude` (se contiver Verdes Mares, Multi ou ISA)
 * 3. Preferência salva localmente por ID ou nome do paciente
 * 4. Fallback oficial: Verdes Mares
 */
export function resolverEmpresaDoPaciente(paciente?: {
  id?: string;
  nome?: string;
  empresa_contratante?: string;
  plano_saude?: string;
} | null): EmpresaContratante {
  if (!paciente) return EMPRESA_PADRAO;

  const porCampoExplicito = identificarEmpresaContratante(paciente.empresa_contratante);
  if (porCampoExplicito) return porCampoExplicito;

  const porPlanoSaude = identificarEmpresaContratante(paciente.plano_saude);
  if (porPlanoSaude) return porPlanoSaude;

  const porStorage = lerEmpresaContratanteLocal(paciente.id, paciente.nome);
  if (porStorage) return porStorage;

  return EMPRESA_PADRAO;
}

/**
 * Calcula a idade em anos a partir de uma data de nascimento (YYYY-MM-DD ou DD/MM/YYYY).
 */
export function calcularIdadePaciente(
  dataNascimento?: string | null,
  dataReferencia: Date = new Date()
): string {
  if (!dataNascimento) return '--';
  const limpo = dataNascimento.trim();
  if (!limpo) return '--';

  let ano: number, mes: number, dia: number;
  if (/^\d{4}-\d{2}-\d{2}/.test(limpo)) {
    const partes = limpo.slice(0, 10).split('-').map(Number);
    [ano, mes, dia] = partes;
  } else if (/^\d{2}\/\d{2}\/\d{4}/.test(limpo)) {
    const partes = limpo.slice(0, 10).split('/').map(Number);
    [dia, mes, ano] = partes;
  } else {
    const d = new Date(limpo);
    if (isNaN(d.getTime())) return '--';
    ano = d.getFullYear();
    mes = d.getMonth() + 1;
    dia = d.getDate();
  }

  if (!ano || !mes || !dia || ano < 1900 || mes < 1 || mes > 12 || dia < 1 || dia > 31) {
    return '--';
  }

  const datateste = new Date(ano, mes - 1, dia);
  if (
    dataTesteInvalida(datateste, ano, mes, dia)
  ) {
    return '--';
  }

  const hoje = dataReferencia;
  let idade = hoje.getFullYear() - ano;
  const m = hoje.getMonth() + 1 - mes;
  if (m < 0 || (m === 0 && hoje.getDate() < dia)) {
    idade--;
  }

  return idade >= 0 && idade < 130 ? `${idade} anos` : '--';
}

function dataTesteInvalida(d: Date, ano: number, mes: number, dia: number): boolean {
  return (
    isNaN(d.getTime()) ||
    d.getFullYear() !== ano ||
    d.getMonth() + 1 !== mes ||
    d.getDate() !== dia
  );
}

export function formatarDataNascimentoBr(dataNascimento?: string | null): string {
  if (!dataNascimento) return '--/--/----';
  const limpo = dataNascimento.trim();
  if (!limpo) return '--/--/----';
  if (/^\d{4}-\d{2}-\d{2}/.test(limpo)) {
    const [ano, mes, dia] = limpo.slice(0, 10).split('-');
    return `${dia}/${mes}/${ano}`;
  }
  return limpo;
}
