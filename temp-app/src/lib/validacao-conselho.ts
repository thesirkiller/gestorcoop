// Validação automática de registros em conselhos profissionais (COREN, CRM, CREFITO etc.)
// e validação de dígito verificador de PIS/PASEP/NIT (Módulo 11).

export const UFS_BRASIL = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;

export type UFBrasil = (typeof UFS_BRASIL)[number];

export const CONSELHOS_RECONHECIDOS = [
  'COREN',
  'CRM',
  'CREFITO',
  'CRN',
  'CRP',
  'CRFA',
  'CREFONO',
  'CRBM',
  'CRF',
  'CRO',
  'CRESS',
  'CRT',
] as const;

export type ConselhoProfissional = (typeof CONSELHOS_RECONHECIDOS)[number];

export const CATEGORIAS_COREN = [
  'ENF',
  'TE',
  'TEC',
  'AE',
  'AUX',
  'OBST',
  'PAR',
] as const;

const SUFIXOS_MODALIDADE_COREN = new Set([
  ...CATEGORIAS_COREN,
  'IS',
  'IP',
  'IR',
  'REMIDO',
  'SEC',
  'PROV',
]);

const SUFIXOS_OUTROS_CONSELHOS: Record<string, ReadonlySet<string>> = {
  CREFITO: new Set(['F', 'TO']),
  CRN: new Set(['P', 'S', 'D']),
  CRBM: new Set(['P', 'S']),
};

export const LINKS_CONSULTA_CONSELHO: Record<ConselhoProfissional, { orgao: string; url: string }> = {
  COREN: {
    orgao: 'COFEN / COREN',
    url: 'https://www.cofen.gov.br/servicos-cofen/consulta-de-inscritos/',
  },
  CRM: {
    orgao: 'CFM / CRM',
    url: 'https://portal.cfm.org.br/busca-medicos/',
  },
  CREFITO: {
    orgao: 'COFFITO / CREFITO',
    url: 'https://www.coffito.gov.br/nsite/?page_id=3482',
  },
  CRN: {
    orgao: 'CFN / CRN',
    url: 'https://www.cfn.org.br/index.php/consulta-nacional-de-nutricionistas/',
  },
  CRP: {
    orgao: 'CFP / CRP',
    url: 'https://cadastro.cfp.org.br/',
  },
  CRFA: {
    orgao: 'CFFa / CRFa',
    url: 'https://www.fonoaudiologia.org.br/ache-um-fonoaudiologo/',
  },
  CREFONO: {
    orgao: 'CFFa / CREFONO',
    url: 'https://www.fonoaudiologia.org.br/ache-um-fonoaudiologo/',
  },
  CRBM: {
    orgao: 'CFBM / CRBM',
    url: 'https://cfbm.gov.br/',
  },
  CRF: {
    orgao: 'CFF / CRF',
    url: 'https://site.cff.org.br/',
  },
  CRO: {
    orgao: 'CFO / CRO',
    url: 'https://website.cfo.org.br/busca-profissionais/',
  },
  CRESS: {
    orgao: 'CFESS / CRESS',
    url: 'https://www.cfess.org.br/',
  },
  CRT: {
    orgao: 'CFT / CRT',
    url: 'https://www.cft.org.br/',
  },
};

export function isValidUF(uf: unknown): uf is UFBrasil {
  return typeof uf === 'string' && (UFS_BRASIL as readonly string[]).includes(uf.trim().toUpperCase());
}

/**
 * Retorna a lista de conselhos compatíveis com a profissão informada,
 * ou null quando a profissão é genérica ("Outro") e aceita qualquer conselho reconhecido.
 */
export function conselhosAceitosPorProfissao(profissao: string): ConselhoProfissional[] | null {
  const norm = (profissao || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  if (!norm || norm.includes('outro')) return null;
  // Importante: testar 'biomedic' antes de 'medic' pois "biomedico" contém "medic".
  if (norm.includes('biomedic')) return ['CRBM'];
  if (norm.includes('enferm')) return ['COREN'];
  if (norm.includes('medic')) return ['CRM'];
  if (norm.includes('fisioterap') || norm.includes('terapeuta ocupacional')) return ['CREFITO'];
  if (norm.includes('nutricion')) return ['CRN'];
  if (norm.includes('psicolog')) return ['CRP'];
  if (norm.includes('fonoaudiol')) return ['CRFA', 'CREFONO'];
  if (norm.includes('farmaceut')) return ['CRF'];
  if (norm.includes('odont') || norm.includes('dentist')) return ['CRO'];
  if (norm.includes('assistent') && norm.includes('social')) return ['CRESS'];
  if (norm.includes('radiolog') || norm.includes('industrial')) return ['CRT'];
  if (norm.includes('laborator')) return ['CRBM', 'CRF', 'CRT'];
  return null;
}

/**
 * Retorna a sigla padrão do conselho de classe correspondente à profissão.
 */
export function conselhoPorProfissao(profissao: string): ConselhoProfissional {
  const aceitos = conselhosAceitosPorProfissao(profissao);
  return aceitos && aceitos.length > 0 ? aceitos[0] : 'COREN';
}

/**
 * Validação de PIS/PASEP/NIT/NIS pelo algoritmo oficial Módulo 11 (pesos 3,2,9,8,7,6,5,4,3,2).
 */
export function isValidPIS(pis: string): boolean {
  if (typeof pis !== 'string') return false;
  const digits = pis.replace(/\D/g, '');
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  const weights = [3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += Number(digits[i]) * weights[i];
  }

  const remainder = sum % 11;
  const checkDigit = remainder < 2 ? 0 : 11 - remainder;
  return checkDigit === Number(digits[10]);
}

export function pisDigits(pis: string): string {
  return typeof pis === 'string' ? pis.replace(/\D/g, '') : '';
}

export function formatarPIS(pis: string): string {
  const digits = pisDigits(pis);
  if (digits.length !== 11) return pis;
  return `${digits.slice(0, 3)}.${digits.slice(3, 8)}.${digits.slice(8, 10)}-${digits.slice(10, 11)}`;
}

export function validarPIS(pis: string): {
  valid: boolean;
  valido: boolean;
  digits: string;
  pisFormatado: string | null;
  error?: string;
} {
  const digits = pisDigits(pis);
  const valid = isValidPIS(pis);
  if (!valid) {
    return {
      valid: false,
      valido: false,
      digits,
      pisFormatado: null,
      error: 'PIS/PASEP inválido. Confira os 11 dígitos e o dígito verificador.',
    };
  }
  return {
    valid: true,
    valido: true,
    digits,
    pisFormatado: formatarPIS(digits),
  };
}

function isSequenciaMonotona(str: string): boolean {
  if (str.length < 4) return false;
  let isAscending = true;
  let isDescending = true;
  for (let i = 1; i < str.length; i++) {
    const prev = Number(str[i - 1]);
    const curr = Number(str[i]);
    if (curr !== (prev + 1) % 10) isAscending = false;
    if (curr !== (prev + 9) % 10) isDescending = false;
  }
  return isAscending || isDescending;
}

function contemSubsequenciaSequencialLonga(str: string, tamanhoMinimo = 5): boolean {
  if (str.length < tamanhoMinimo) return false;
  for (let start = 0; start <= str.length - tamanhoMinimo; start++) {
    const fatia = str.slice(start, start + tamanhoMinimo);
    if (isSequenciaMonotona(fatia)) return true;
  }
  return false;
}

/**
 * Detecta se a sequência numérica do registro profissional parece falsa,
 * aleatória de teste (ex.: 123456, 654321, 111111, 001111, 001234, 121212, 123123, 000001).
 */
export function isNumeroRegistroSuspeito(digits: string, conselho: ConselhoProfissional = 'COREN'): string | null {
  if (!/^\d+$/.test(digits)) {
    return 'O número de registro do conselho deve conter apenas dígitos numéricos.';
  }

  const minDigits = 4;
  const maxDigits = conselho === 'CRM' ? 8 : 9;

  if (digits.length < minDigits || digits.length > maxDigits) {
    return `O número de registro do ${conselho} deve ter entre ${minDigits} e ${maxDigits} dígitos.`;
  }

  const semZeros = digits.replace(/^0+/, '');
  if (!semZeros || semZeros.length < 3 || /^0{3,}/.test(digits)) {
    return 'Número de registro inválido (zeros à esquerda excessivos ou valor zerado).';
  }

  // Todos os dígitos iguais (ex.: 111111, 999999, 001111) ou 4+ dígitos idênticos seguidos (ex.: 111123)
  if (/^(\d)\1+$/.test(digits) || /^(\d)\1+$/.test(semZeros) || /(\d)\1{3,}/.test(digits)) {
    return 'Número de registro inválido: dígitos repetidos não são aceitos.';
  }

  // Sequência estritamente crescente ou decrescente (ex.: 123456, 012345, 001234, 654321, 987654, 123450)
  if (
    isSequenciaMonotona(digits) ||
    isSequenciaMonotona(semZeros) ||
    contemSubsequenciaSequencialLonga(digits, 5)
  ) {
    return 'Número de registro inválido: sequências numéricas (ex.: 123456 ou 654321) não são aceitas.';
  }

  // Padrões repetitivos curtos (ex.: 121212, 123123, 12341234, 001212)
  if (/^(\d{2,4})\1+$/.test(digits) || /^(\d{2,4})\1+$/.test(semZeros)) {
    return 'Número de registro inválido: padrão repetitivo detectado.';
  }

  // Baixa entropia em números de 5+ dígitos (ex.: 111112, 999990, 000012)
  for (const alvo of [digits, semZeros]) {
    if (alvo.length >= 5) {
      const counts: Record<string, number> = {};
      for (const ch of alvo) {
        counts[ch] = (counts[ch] || 0) + 1;
      }
      const maxCount = Math.max(...Object.values(counts));
      if (maxCount >= alvo.length - 1) {
        return 'Número de registro inválido: combinação numérica inconsistente.';
      }
    }
  }

  return null;
}

export interface ValidacaoConselhoInput {
  conselho?: string;
  council?: string;
  uf?: string;
  numero?: string;
  registration?: string;
  categoria?: string;
  category?: string;
  profissao?: string;
}

export interface ResultadoValidacaoConselho {
  valid: boolean;
  valido: boolean;
  conselho: string;
  uf: string;
  numero: string;
  categoria: string | null;
  registroFormatado: string;
  consultaUrl: string;
  orgao: string;
  exigeCertidaoRegularidade: boolean;
  message?: string;
  error?: string;
  motivo?: string;
}

function falhaValidacao(
  error: string,
  partial?: Partial<Pick<ResultadoValidacaoConselho, 'conselho' | 'uf' | 'numero' | 'categoria'>>
): ResultadoValidacaoConselho {
  const conselho = (partial?.conselho || 'COREN') as ConselhoProfissional;
  const info = LINKS_CONSULTA_CONSELHO[conselho] || LINKS_CONSULTA_CONSELHO.COREN;
  return {
    valid: false,
    valido: false,
    conselho: partial?.conselho || '',
    uf: partial?.uf || '',
    numero: partial?.numero || '',
    categoria: partial?.categoria ?? null,
    registroFormatado: '',
    consultaUrl: info.url,
    orgao: info.orgao,
    exigeCertidaoRegularidade: true,
    error,
    motivo: error,
  };
}

/**
 * Valida e normaliza o registro profissional do cooperado (COREN, CRM, CREFITO, etc.).
 * Exige UF válida, sigla de conselho reconhecida e número real (rejeitando sequenciais e aleatórios).
 */
export function validarRegistroConselho(
  inputOrConselho: ValidacaoConselhoInput | string,
  numeroArg?: string,
  ufArg?: string,
  categoriaArg?: string
): ResultadoValidacaoConselho {
  let rawConselho = '';
  let rawNumero = '';
  let rawUf = '';
  let rawCategoria = '';
  let rawProfissao = '';

  if (typeof inputOrConselho === 'string') {
    if (numeroArg === undefined && ufArg === undefined && categoriaArg === undefined) {
      rawNumero = inputOrConselho;
    } else {
      rawConselho = inputOrConselho;
      rawNumero = numeroArg || '';
      rawUf = ufArg || '';
      rawCategoria = categoriaArg || '';
    }
  } else if (inputOrConselho && typeof inputOrConselho === 'object') {
    rawConselho = String(inputOrConselho.conselho ?? inputOrConselho.council ?? '').trim();
    rawNumero = String(inputOrConselho.numero ?? inputOrConselho.registration ?? '').trim();
    rawUf = String(inputOrConselho.uf ?? '').trim();
    rawCategoria = String(inputOrConselho.categoria ?? inputOrConselho.category ?? '').trim();
    rawProfissao = String(inputOrConselho.profissao ?? '').trim();
  }

  if (!rawNumero.trim()) {
    return falhaValidacao('Informe o número de registro no conselho profissional.');
  }

  // Rejeita caracteres especiais inválidos
  if (/[^a-zA-Z0-9\s\-\/.]/.test(rawNumero)) {
    return falhaValidacao('Formato de registro inválido: caracteres não permitidos.');
  }

  // Pontos só são aceitos como separador de milhar (ex.: 248.591)
  if (rawNumero.includes('.')) {
    if (!/^\d{1,3}(\.\d{3})+$/.test(rawNumero.replace(/^[^0-9]+|[^0-9]+$/g, ''))) {
      // Verifica se todos os pontos estão entre grupos de 3 dígitos
      const dotCheck = rawNumero.split(/[\s\-\/]+/).every(tok => !tok.includes('.') || /^\d{1,3}(\.\d{3})+$/.test(tok));
      if (!dotCheck) {
        return falhaValidacao('Formato numérico inválido no registro do conselho.');
      }
    }
  }

  let conselhoExtraido = '';
  let ufDoConselho = '';

  if (rawConselho) {
    const cTokens = rawConselho.toUpperCase().split(/[\s\-\/]+/).filter(Boolean);
    if (cTokens.length > 0) {
      conselhoExtraido = cTokens[0];
      if (!(CONSELHOS_RECONHECIDOS as readonly string[]).includes(conselhoExtraido)) {
        return falhaValidacao(`Conselho profissional "${conselhoExtraido}" não reconhecido.`);
      }
    }
    if (cTokens.length > 1) {
      if (!isValidUF(cTokens[1])) {
        return falhaValidacao(`UF "${cTokens[1]}" inválida no conselho informado.`);
      }
      ufDoConselho = cTokens[1];
    }
  }

  if (rawUf && !isValidUF(rawUf)) {
    return falhaValidacao(`UF "${rawUf}" inválida. Informe uma UF brasileira válida (ex.: GO, SP, RJ, DF).`, {
      conselho: conselhoExtraido,
    });
  }

  if (rawUf && ufDoConselho && rawUf.toUpperCase() !== ufDoConselho) {
    return falhaValidacao(
      `A UF informada (${rawUf.toUpperCase()}) diverge da UF do conselho (${ufDoConselho}).`,
      { conselho: conselhoExtraido, uf: rawUf.toUpperCase() }
    );
  }

  const ufExplicita = rawUf ? rawUf.toUpperCase() : ufDoConselho;

  // Tokeniza o campo de número/registro
  const normalizedNumeroStr = rawNumero
    .toUpperCase()
    .replace(/(\d)\.(\d{3})\b/g, '$1$2')
    .replace(/(\d)\.(\d{3})\b/g, '$1$2');

  const rawTokens = normalizedNumeroStr.split(/[\s\-\/]+/).filter(Boolean);

  let conselhoNoNumero = '';
  let ufNoNumero = '';
  let categoriaNoNumero = '';
  const numericTokens: string[] = [];
  const conselhoInferidoProfissao = rawProfissao ? conselhoPorProfissao(rawProfissao) : '';

  for (let i = 0; i < rawTokens.length; i++) {
    const tok = rawTokens[i];

    // Caso o primeiro token seja a sigla do conselho (ex.: COREN, CRM)
    if (i === 0 && (CONSELHOS_RECONHECIDOS as readonly string[]).includes(tok)) {
      conselhoNoNumero = tok;
      continue;
    }

    // Token puramente numérico
    if (/^\d+$/.test(tok)) {
      numericTokens.push(tok);
      continue;
    }

    // Token com número seguido de sufixo colado? Rejeita mistura alfanumérica arbitrária
    if (/\d/.test(tok) && /[A-Z]/.test(tok)) {
      return falhaValidacao('Formato de registro inválido: não misture letras e números no mesmo bloco.', {
        conselho: conselhoNoNumero || conselhoExtraido || conselhoInferidoProfissao,
        uf: ufExplicita,
      });
    }

    // Token puramente alfabético: pode ser UF ou categoria do conselho
    if (/^[A-Z]+$/.test(tok)) {
      const targetConselho = (conselhoNoNumero || conselhoExtraido || conselhoInferidoProfissao || 'COREN') as ConselhoProfissional;
      const isKnownCat =
        (targetConselho === 'COREN' && SUFIXOS_MODALIDADE_COREN.has(tok)) ||
        Boolean(SUFIXOS_OUTROS_CONSELHOS[targetConselho]?.has(tok));

      // Se é UF válida e ainda não temos UF no número (e não é ambíguo como TO no final quando já há UF)
      if (isValidUF(tok) && (!ufNoNumero && !(ufExplicita && isKnownCat && i === rawTokens.length - 1))) {
        ufNoNumero = tok;
        continue;
      }

      if (isKnownCat && !categoriaNoNumero) {
        categoriaNoNumero = tok === 'TEC' ? 'TE' : tok === 'AUX' ? 'AE' : tok;
        continue;
      }

      return falhaValidacao(`Sufixo ou sigla "${tok}" inválido para o registro do conselho.`, {
        conselho: targetConselho,
        uf: ufNoNumero || ufExplicita,
      });
    }

    return falhaValidacao('Formato de registro do conselho inválido.');
  }

  // Se o conselho veio tanto no campo conselho quanto no número e não há profissão mediando,
  // rejeita conflito explícito (ex.: conselho='COREN' e numero='CRM-GO 248591')
  if (conselhoExtraido && conselhoNoNumero && conselhoExtraido !== conselhoNoNumero) {
    const isFonoEquivalente =
      (conselhoExtraido === 'CRFA' && conselhoNoNumero === 'CREFONO') ||
      (conselhoExtraido === 'CREFONO' && conselhoNoNumero === 'CRFA');
    if (!isFonoEquivalente) {
      return falhaValidacao(
        `O conselho informado (${conselhoExtraido}) diverge do prefixo no número de registro (${conselhoNoNumero}).`,
        { conselho: conselhoNoNumero, uf: ufNoNumero || ufExplicita }
      );
    }
  }

  const conselhoFinal = (conselhoNoNumero || conselhoExtraido || conselhoInferidoProfissao) as ConselhoProfissional;

  if (!conselhoFinal || !(CONSELHOS_RECONHECIDOS as readonly string[]).includes(conselhoFinal)) {
    return falhaValidacao('Informe um conselho profissional válido (ex.: COREN, CRM, CREFITO).');
  }

  // Valida compatibilidade entre o conselho (seja explícito ou extraído do número) e a profissão
  if (rawProfissao) {
    const aceitos = conselhosAceitosPorProfissao(rawProfissao);
    if (aceitos && !aceitos.includes(conselhoFinal)) {
      return falhaValidacao(
        `O conselho ${conselhoFinal} não corresponde à profissão selecionada (${rawProfissao} requer ${aceitos[0]}).`,
        { conselho: conselhoFinal, uf: ufNoNumero || ufExplicita }
      );
    }
  }

  const ufFinal = ufNoNumero || ufExplicita;
  if (!ufFinal || !isValidUF(ufFinal)) {
    return falhaValidacao(
      `Informe a UF do conselho regional (ex.: ${conselhoFinal}-GO 248591).`,
      { conselho: conselhoFinal }
    );
  }

  // Para CRP permite prefixo de região de 2 dígitos (ex.: CRP 06/248591), nos demais exige 1 bloco numérico principal
  let numeroPrincipal = '';
  if (numericTokens.length === 1) {
    numeroPrincipal = numericTokens[0];
  } else if (conselhoFinal === 'CRP' && numericTokens.length === 2 && numericTokens[0].length === 2) {
    numeroPrincipal = numericTokens[1];
  } else if (numericTokens.length === 0) {
    return falhaValidacao('Informe os dígitos numéricos do registro no conselho.', {
      conselho: conselhoFinal,
      uf: ufFinal,
    });
  } else {
    return falhaValidacao('Formato numérico inválido: informe apenas um número de inscrição.', {
      conselho: conselhoFinal,
      uf: ufFinal,
    });
  }

  // Valida categoria se informada no número ou separadamente
  const rawCatNorm = rawCategoria
    ? rawCategoria.toUpperCase() === 'TEC'
      ? 'TE'
      : rawCategoria.toUpperCase() === 'AUX'
        ? 'AE'
        : rawCategoria.toUpperCase()
    : '';

  if (categoriaNoNumero && rawCatNorm && categoriaNoNumero !== rawCatNorm) {
    return falhaValidacao(
      `A categoria informada (${rawCatNorm}) diverge do sufixo no número de registro (${categoriaNoNumero}).`,
      { conselho: conselhoFinal, uf: ufFinal, numero: numeroPrincipal }
    );
  }

  let categoriaFinal: string | null = categoriaNoNumero || (rawCatNorm || null);
  if (categoriaFinal) {
    if (conselhoFinal === 'COREN') {
      if (!SUFIXOS_MODALIDADE_COREN.has(categoriaFinal)) {
        return falhaValidacao(
          `Categoria "${categoriaFinal}" inválida para o COREN. Use ENF, TE ou AE.`,
          { conselho: conselhoFinal, uf: ufFinal, numero: numeroPrincipal }
        );
      }
      if (categoriaFinal === 'TEC') categoriaFinal = 'TE';
      if (categoriaFinal === 'AUX') categoriaFinal = 'AE';
    } else {
      const sufixosPermitidos = SUFIXOS_OUTROS_CONSELHOS[conselhoFinal];
      if (!sufixosPermitidos || !sufixosPermitidos.has(categoriaFinal)) {
        return falhaValidacao(
          `Categoria ou sufixo "${categoriaFinal}" inválido para o ${conselhoFinal}.`,
          { conselho: conselhoFinal, uf: ufFinal, numero: numeroPrincipal }
        );
      }
    }
  } else if (conselhoFinal === 'COREN' && rawProfissao) {
    const normProf = rawProfissao
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    if (normProf.includes('tecnico')) categoriaFinal = 'TE';
    else if (normProf.includes('auxiliar')) categoriaFinal = 'AE';
    else if (normProf.includes('enfermeir')) categoriaFinal = 'ENF';
  }

  // Se é COREN e há profissão informada, garante que a categoria (ENF/TE/AE) condiz com o cargo
  if (conselhoFinal === 'COREN' && rawProfissao && categoriaFinal) {
    const normProf = rawProfissao
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    if (normProf.includes('tecnico') && (categoriaFinal === 'ENF' || categoriaFinal === 'AE' || categoriaFinal === 'OBST')) {
      return falhaValidacao(
        `A categoria ${categoriaFinal} do COREN não corresponde à profissão de Técnico(a) de Enfermagem (esperado TE).`,
        { conselho: conselhoFinal, uf: ufFinal, numero: numeroPrincipal, categoria: categoriaFinal }
      );
    }
    if (normProf.includes('auxiliar') && (categoriaFinal === 'ENF' || categoriaFinal === 'TE' || categoriaFinal === 'OBST')) {
      return falhaValidacao(
        `A categoria ${categoriaFinal} do COREN não corresponde à profissão de Auxiliar de Enfermagem (esperado AE).`,
        { conselho: conselhoFinal, uf: ufFinal, numero: numeroPrincipal, categoria: categoriaFinal }
      );
    }
    if (!normProf.includes('tecnico') && !normProf.includes('auxiliar') && normProf.includes('enfermeir') && (categoriaFinal === 'TE' || categoriaFinal === 'AE')) {
      return falhaValidacao(
        `A categoria ${categoriaFinal} do COREN não corresponde à profissão de Enfermeiro(a) (esperado ENF).`,
        { conselho: conselhoFinal, uf: ufFinal, numero: numeroPrincipal, categoria: categoriaFinal }
      );
    }
  }

  const erroSuspeito = isNumeroRegistroSuspeito(numeroPrincipal, conselhoFinal);
  if (erroSuspeito) {
    return falhaValidacao(erroSuspeito, {
      conselho: conselhoFinal,
      uf: ufFinal,
      numero: numeroPrincipal,
      categoria: categoriaFinal,
    });
  }

  const infoConsulta = LINKS_CONSULTA_CONSELHO[conselhoFinal] || LINKS_CONSULTA_CONSELHO.COREN;
  const sufixoCat = categoriaFinal ? `-${categoriaFinal}` : '';
  const registroFormatado = `${conselhoFinal}-${ufFinal} ${numeroPrincipal}${sufixoCat}`;

  return {
    valid: true,
    valido: true,
    conselho: conselhoFinal,
    uf: ufFinal,
    numero: numeroPrincipal,
    categoria: categoriaFinal,
    registroFormatado,
    consultaUrl: infoConsulta.url,
    orgao: `${infoConsulta.orgao}-${ufFinal}`,
    exigeCertidaoRegularidade: true,
    message: `Formato de registro válido (${registroFormatado}). A confirmação de regularidade exige o anexo da Certidão de Regularidade e carteira do ${conselhoFinal}.`,
  };
}
