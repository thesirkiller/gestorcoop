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

export interface ProfissionalDesignado {
  id: string;
  nome: string;
  cargo?: string;
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

export interface PlanoTerapeutico {
  id: string;
  paciente_id: string;
  data_inicio: string; // YYYY-MM-DD
  data_fim: string;    // YYYY-MM-DD
  status: 'Ativo' | 'Concluido' | 'Cancelado';
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

export function normalizarEspecialidade(esp: string): string {
  const map: Record<string, string> = {
    tecnico: 'Tecnico_Enfermagem',
    tecnico_enfermagem: 'Tecnico_Enfermagem',
    'técnico de enfermagem': 'Tecnico_Enfermagem',
    enfermeiro: 'Enfermeiro',
    enfermagem: 'Enfermeiro',
    medico: 'Medico',
    médico: 'Medico',
    dentista: 'Dentista',
    odontologia: 'Dentista',
    odonto: 'Dentista',
    fisioterapeuta: 'Fisioterapeuta',
    fisioterapia: 'Fisioterapeuta',
    fonoaudiologo: 'Fonoaudiologo',
    fonoaudiólogo: 'Fonoaudiologo',
    fono: 'Fonoaudiologo',
    nutricionista: 'Nutricionista',
    psicologo: 'Psicologo',
    psicólogo: 'Psicologo',
    terapeuta_ocupacional: 'Terapeuta_Ocupacional',
    'terapeuta ocupacional': 'Terapeuta_Ocupacional',
  };
  const key = (esp || '').toLowerCase().trim();
  return map[key] || esp;
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
