export type EspecialidadeProfissional =
  | 'Tecnico_Enfermagem'
  | 'Enfermeiro'
  | 'Medico'
  | 'Dentista'
  | 'Fisioterapeuta'
  | 'Fonoaudiologo'
  | 'Nutricionista'
  | 'Psicologo'
  | 'Terapeuta_Ocupacional';

export interface ResponsavelPaciente {
  id: string;
  nome: string;
  parentesco: string;
  telefone?: string;
  cpf?: string;
  principal?: boolean;
}

export interface ProfissionalDesignado {
  id: string;
  nome: string;
  cargo?: string;
  cpf?: string;
  crm_coren?: string;
}

export interface MetaPlanoTerapeutico {
  id: string;
  plano_id: string;
  especialidade: EspecialidadeProfissional | string;
  quantidade_prevista: number;
  profissionais_designados?: ProfissionalDesignado[];
  created_at?: string;
  // Campos computados em consultas
  quantidade_realizada?: number;
  quantidade_restante?: number;
  status_meta?: 'Em_Andamento' | 'Concluido' | 'Pendente' | 'Excedido';
}

export type StatusPlanoTerapeutico = 'Ativo' | 'Inativo' | 'Concluido' | 'Cancelado';

export interface PlanoTerapeutico {
  id: string;
  paciente_id: string;
  versao?: number;
  data_inicio: string; // YYYY-MM-01 (sempre dia 01 do mês)
  data_fim: string;    // YYYY-MM-28|29|30|31 (sempre último dia do mês)
  status: StatusPlanoTerapeutico;
  observacoes?: string;
  created_at?: string;
  updated_at?: string;
  metas?: MetaPlanoTerapeutico[];
  // Campos computados
  total_previsto?: number;
  total_realizado?: number;
  total_restante?: number;
  tem_pendencias?: boolean;
  pendencias_alertas?: string[];
}

export interface PeriodoMesVigencia {
  data_inicio: string;
  data_fim: string;
  mes_referencia: string;
  ultimo_dia: number;
  ano: number;
  mes: number;
}

/**
 * Calcula automaticamente o primeiro dia (01) e o último dia (28, 29, 30 ou 31)
 * do mês de referência. O Plano Terapêutico sempre vigora do dia 01 até o último dia do mês.
 */
export function obterPeriodoMesVigencia(dataRef?: string | Date | null): PeriodoMesVigencia {
  let ano: number;
  let mes: number; // 1-12

  if (dataRef instanceof Date && !Number.isNaN(dataRef.getTime())) {
    ano = dataRef.getUTCFullYear();
    mes = dataRef.getUTCMonth() + 1;
  } else if (typeof dataRef === 'string' && dataRef.trim()) {
    const limpo = dataRef.trim();
    const matchIso = limpo.match(/^(\d{4})-(\d{2})/);
    const matchBr = limpo.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (matchIso) {
      ano = Number(matchIso[1]);
      mes = Number(matchIso[2]);
    } else if (matchBr) {
      ano = Number(matchBr[3]);
      mes = Number(matchBr[2]);
    } else {
      const d = new Date(limpo);
      if (!Number.isNaN(d.getTime())) {
        ano = d.getUTCFullYear();
        mes = d.getUTCMonth() + 1;
      } else {
        const agora = new Date();
        ano = agora.getUTCFullYear();
        mes = agora.getUTCMonth() + 1;
      }
    }
  } else {
    const agora = new Date();
    ano = agora.getUTCFullYear();
    mes = agora.getUTCMonth() + 1;
  }

  if (!Number.isInteger(ano) || ano < 1970 || ano > 2100) {
    ano = new Date().getUTCFullYear();
  }
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
    mes = new Date().getUTCMonth() + 1;
  }

  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const mesStr = String(mes).padStart(2, '0');
  const ultimoDiaStr = String(ultimoDia).padStart(2, '0');
  const mesReferencia = `${ano}-${mesStr}`;

  return {
    data_inicio: `${mesReferencia}-01`,
    data_fim: `${mesReferencia}-${ultimoDiaStr}`,
    mes_referencia: mesReferencia,
    ultimo_dia: ultimoDia,
    ano,
    mes,
  };
}

export function ehPlanoMensal(
  planoOuDataInicio?: string | { data_inicio?: string | null; data_fim?: string | null } | null,
  dataFim?: string | null,
): boolean {
  const rawInicio =
    typeof planoOuDataInicio === 'object' && planoOuDataInicio !== null
      ? planoOuDataInicio.data_inicio
      : planoOuDataInicio;
  const rawFim =
    typeof planoOuDataInicio === 'object' && planoOuDataInicio !== null
      ? planoOuDataInicio.data_fim
      : dataFim;
  if (!rawInicio || !rawFim) return false;
  const ini = rawInicio.trim().split('T')[0];
  const fim = rawFim.trim().split('T')[0];
  if (!/^\d{4}-\d{2}-01$/.test(ini)) return false;
  const periodo = obterPeriodoMesVigencia(ini);
  return ini === periodo.data_inicio && fim === periodo.data_fim;
}

export function formatarDataIsoParaBr(dataIso?: string | null): string {
  if (!dataIso) return '--/--/----';
  const match = String(dataIso).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  return String(dataIso);
}

export function normalizarNome(nome?: string): string {
  return (nome || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

interface ObjetoDesignadoFlexivel {
  id?: string;
  _id?: string;
  nome?: string;
  txt_nome?: string;
  txt_nomeCompleto?: string;
  cargo?: string;
  txt_profissao?: string;
  cpf?: string;
  txt_CPF?: string;
}

export function parseProfissionaisDesignados(raw: unknown): ProfissionalDesignado[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        if (!item) return null;
        if (typeof item === 'string') {
          const nome = item.trim();
          return nome ? { id: '', nome } : null;
        }
        if (typeof item === 'object') {
          const flex = item as ObjetoDesignadoFlexivel;
          const res: ProfissionalDesignado = {
            id: flex.id || flex._id || '',
            nome: flex.nome || flex.txt_nome || flex.txt_nomeCompleto || '',
          };
          const cargo = flex.cargo || flex.txt_profissao;
          if (cargo) res.cargo = cargo;
          const cpf = flex.cpf || flex.txt_CPF;
          if (cpf) res.cpf = cpf;
          return res;
        }
        return null;
      })
      .filter((p): p is ProfissionalDesignado => !!p && (p.nome.length > 0 || p.id.length > 0));
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parseProfissionaisDesignados(parsed);
        }
        if (parsed && typeof parsed === 'object') {
          return parseProfissionaisDesignados([parsed]);
        }
      } catch {}
      return [];
    }
    // Suporte a listas de nomes em texto puro separadas por vírgula ou ponto-e-vírgula
    return trimmed
      .split(/[,;]+/)
      .map((n) => n.trim())
      .filter((n) => n.length > 0)
      .map((nome) => ({ id: '', nome }));
  }
  return [];
}

export function cooperadoCorresponde(
  designado: ProfissionalDesignado | string,
  cooperado: { id?: string; userId?: string; nome?: string; cpf?: string; cargo?: string }
): boolean {
  if (!designado || !cooperado) return false;

  const desigObj: ProfissionalDesignado =
    typeof designado === 'string'
      ? { id: '', nome: designado }
      : designado;

  // 1. Comparação direta por ID (cooperadoId ou userId)
  const dId = (desigObj.id || '').trim();
  const cId = (cooperado.id || '').trim();
  const uId = (cooperado.userId || '').trim();
  if (dId && (dId === cId || (uId && dId === uId))) {
    return true;
  }

  // 2. Comparação por CPF (11 dígitos numéricos limpos)
  if (desigObj.cpf && cooperado.cpf) {
    const dDigits = desigObj.cpf.replace(/\D/g, '');
    const cDigits = cooperado.cpf.replace(/\D/g, '');
    if (dDigits.length === 11 && cDigits.length === 11 && dDigits === cDigits) {
      return true;
    }
  }

  // 3. Comparação fonética/textual normalizada de Nome
  const normDesig = normalizarNome(desigObj.nome);
  const normCoop = normalizarNome(cooperado.nome);

  if (normDesig && normCoop) {
    // Igualdade exata após normalização
    if (normDesig === normCoop) return true;

    // Equivalência fonética brasileira: y <-> i (ex: Gabryel <-> Gabriel, Ely <-> Eli)
    const fonDesig = normDesig.replace(/y/g, 'i');
    const fonCoop = normCoop.replace(/y/g, 'i');
    if (fonDesig === fonCoop) return true;

    // Correspondência de prefixo com limite de palavra
    if (normDesig.length >= 3 && normCoop.length >= 3) {
      if (normCoop.startsWith(normDesig + ' ') || normDesig.startsWith(normCoop + ' ')) {
        return true;
      }
      if (fonCoop.startsWith(fonDesig + ' ') || fonDesig.startsWith(fonCoop + ' ')) {
        return true;
      }
    }

    // Comparação por tokens significativos (palavras >= 3 letras)
    const stopWords = new Set(['de', 'da', 'do', 'dos', 'das', 'e']);
    const tokensDesig = fonDesig.split(' ').filter((w) => w.length >= 3 && !stopWords.has(w));
    const tokensCoop = fonCoop.split(' ').filter((w) => w.length >= 3 && !stopWords.has(w));

    if (tokensDesig.length > 0 && tokensCoop.length > 0) {
      const primeiroNomeIgual = tokensDesig[0] === tokensCoop[0];
      const desigSubsetCoop = tokensDesig.every((t) => tokensCoop.includes(t));
      const coopSubsetDesig = tokensCoop.every((t) => tokensDesig.includes(t));

      if (desigSubsetCoop || coopSubsetDesig) {
        return true;
      }

      if (primeiroNomeIgual && tokensDesig.length > 1 && tokensCoop.length > 1) {
        const outrosCoincidentes = tokensDesig.slice(1).some((t) => tokensCoop.slice(1).includes(t));
        if (outrosCoincidentes) return true;
      }
    }
  }

  return false;
}

export function normalizarEspecialidade(esp: string): string {
  const norm = (esp || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  if (!norm) return esp;

  if (norm.includes('tecnic')) return 'Tecnico_Enfermagem';
  if (norm.includes('medic')) return 'Medico';
  if (norm.includes('dentist') || norm.includes('odont')) return 'Dentista';
  if (norm.includes('enferm')) return 'Enfermeiro';
  if (norm.includes('fisio')) return 'Fisioterapeuta';
  if (norm.includes('fono')) return 'Fonoaudiologo';
  if (norm.includes('nutri')) return 'Nutricionista';
  if (norm.includes('psico')) return 'Psicologo';
  if (norm.includes('terapeut') || norm.includes('ocupacional')) return 'Terapeuta_Ocupacional';

  const map: Record<string, string> = {
    tecnico: 'Tecnico_Enfermagem',
    tecnico_enfermagem: 'Tecnico_Enfermagem',
    'tecnico de enfermagem': 'Tecnico_Enfermagem',
    enfermeiro: 'Enfermeiro',
    enfermagem: 'Enfermeiro',
    medico: 'Medico',
    dentista: 'Dentista',
    odontologia: 'Dentista',
    odonto: 'Dentista',
    fisioterapeuta: 'Fisioterapeuta',
    fisioterapia: 'Fisioterapeuta',
    fonoaudiologo: 'Fonoaudiologo',
    fono: 'Fonoaudiologo',
    nutricionista: 'Nutricionista',
    psicologo: 'Psicologo',
    terapeuta_ocupacional: 'Terapeuta_Ocupacional',
    'terapeuta ocupacional': 'Terapeuta_Ocupacional',
  };

  return map[norm] || esp;
}

export function formatarNomeEspecialidade(esp: string): string {
  const map: Record<string, string> = {
    Tecnico_Enfermagem: 'Técnico de Enfermagem',
    Enfermeiro: 'Enfermeiro',
    Medico: 'Médico',
    Dentista: 'Dentista / Odontólogo',
    Fisioterapeuta: 'Fisioterapeuta',
    Fonoaudiologo: 'Fonoaudiólogo',
    Nutricionista: 'Nutricionista',
    Psicologo: 'Psicólogo',
    Terapeuta_Ocupacional: 'Terapeuta Ocupacional',
  };
  return map[esp] || (esp ? esp.replace(/_/g, ' ') : 'Profissional');
}
