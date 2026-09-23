/* eslint-disable @typescript-eslint/no-explicit-any */
import { getDb, novoId, agoraIso } from './client';

export type EspecialidadeProfissional =
  | 'Tecnico_Enfermagem'
  | 'Enfermeiro'
  | 'Medico'
  | 'Fisioterapeuta'
  | 'Fonoaudiologo'
  | 'Nutricionista'
  | 'Psicologo'
  | 'Terapeuta_Ocupacional';

export type StatusEvolucao =
  | 'Em_Andamento'
  | 'Assinado_Pendente_Sync'
  | 'Finalizado'
  | 'Auditado';

export interface PacienteClinico {
  id: string;
  nome: string;
  cpf: string;
  data_nascimento?: string;
  endereco?: string;
  telefone?: string;
  responsavel_nome?: string;
  responsavel_telefone?: string;
  diagnostico_principal?: string;
  cid10?: string;
  complexidade?: 'Baixa' | 'Média' | 'Alta';
  plano_saude?: string;
  numero_carteirinha?: string;
  warnings?: string[]; // Array de alertas/alergias
  status?: 'Ativo' | 'Internado' | 'Alta' | 'Suspenso';
  limite_visitas_mes?: number; // Cota mensal de visitas técnicas (ex: 13)
  created_at?: string;
  // Campos computados em consultas
  visitas_realizadas_mes?: number;
  visitas_restantes_mes?: number;
  limite_atingido?: boolean;
  total_prescricoes_ativas?: number;
  ultima_evolucao_data?: string;
  ultimo_profissional_nome?: string;
  ultimo_sinal_vital?: SinalVitalClinico | null;
}

export interface PrescricaoClinica {
  id: string;
  paciente_id: string;
  medico_nome?: string;
  medico_crm?: string;
  medicamento: string;
  dosagem: string;
  via_administracao: 'Oral' | 'Intravenosa' | 'Intramuscular' | 'Subcutânea' | 'Inalatória' | 'Tópica' | 'Enteral' | 'Ocular' | string;
  frequencia_horas: number;
  horarios_padrao?: string[];
  data_inicio: string;
  data_fim: string;
  instrucoes?: string;
  status: 'Ativa' | 'Suspensa' | 'Concluída';
  created_at?: string;
}

export interface AprazamentoClinico {
  id: string;
  prescricao_id: string;
  paciente_id?: string;
  medicamento?: string;
  dosagem?: string;
  via_administracao?: string;
  horario_previsto: string;
  horario_executado?: string;
  status: 'Pendente' | 'Administrado' | 'Nao_Administrado';
  justificativa?: string;
  profissional_id?: string;
  profissional_nome?: string;
  profissional_cargo?: string;
  assinatura_digital?: string;
}

export interface SinalVitalClinico {
  id: string;
  paciente_id: string;
  evolucao_id?: string;
  data_hora: string;
  pa_sistolica?: number;
  pa_diastolica?: number;
  fc_bpm?: number;
  fr_rpm?: number;
  temp_celsius?: number;
  spo2_percent?: number;
  glicemia_mg_dl?: number;
  dor_escala?: number;
  nivel_consciencia?: 'Alerta' | 'Sonolento' | 'Torporoso' | 'Comatoso' | string;
  observacoes?: string;
  profissional_id?: string;
  profissional_nome?: string;
  created_at?: string;
}

export interface EvolucaoClinica {
  id: string;
  paciente_id: string;
  paciente_nome?: string;
  paciente_cpf?: string;
  profissional_id: string;
  profissional_nome?: string;
  tipo_profissional: EspecialidadeProfissional | string;
  profissional_registro?: string;
  turno?: string;
  check_in: string;
  check_out: string;
  audio_url?: string;
  transcricao_crua?: string;
  transcricao_revisada: string;
  soap_subjetivo?: string;
  soap_objetivo?: string;
  soap_avaliacao?: string;
  soap_plano?: string;
  status: StatusEvolucao | string;
  data_assinatura?: string;
  assinatura_digital?: string;
  parecer_auditoria?: string;
  auditado_por?: string;
  data_auditoria?: string;
  aprazamentos?: AprazamentoClinico[];
  sinais_vitais?: SinalVitalClinico[];
}

export interface ParecerAuditoriaClinica {
  id: string;
  paciente_id: string;
  evolucao_id?: string;
  auditor_id: string;
  auditor_nome: string;
  tipo_parecer: 'Conforme' | 'Pendente' | 'Inconformidade' | 'Recomendacao_Clinica';
  descricao: string;
  data_registro: string;
}

// -------------------------------------------------------------
// Banco de dados em memória para Fallback / Dev local sem D1
// -------------------------------------------------------------
const inMemoryPacientes: Map<string, PacienteClinico> = new Map();
const inMemoryPrescricoes: Map<string, PrescricaoClinica> = new Map();
const inMemoryAprazamentos: Map<string, AprazamentoClinico> = new Map();
const inMemorySinaisVitais: Map<string, SinalVitalClinico> = new Map();
const inMemoryEvolucoes: Map<string, EvolucaoClinica> = new Map();
const inMemoryPareceres: Map<string, ParecerAuditoriaClinica> = new Map();

let seeded = false;
function seedClinicalMemory() {
  if (seeded) return;
  seeded = true;

  const hoje = new Date().toISOString().split('T')[0];

  // Paciente 1
  const p1: PacienteClinico = {
    id: 'p_1',
    nome: 'Seu João da Silva',
    cpf: '123.456.789-00',
    data_nascimento: '1948-05-14',
    endereco: 'Rua das Palmeiras, 450 - Jd. América, São Paulo - SP',
    telefone: '(11) 98765-4321',
    responsavel_nome: 'Clara da Silva (Filha)',
    responsavel_telefone: '(11) 97766-5544',
    diagnostico_principal: 'Sequela de AVC Isquêmico / Hipertensão Arterial Sistêmica',
    cid10: 'I69.3 / I10',
    complexidade: 'Alta',
    plano_saude: 'Bradesco Saúde Top Nacional',
    numero_carteirinha: '789456123001',
    warnings: ['Alergia a Dipirona e Penicilina', 'Risco Alto de Queda (Morse 65)', 'Dieta Enteral por SNE'],
    status: 'Ativo',
    created_at: `${hoje}T07:00:00.000Z`,
  };
  inMemoryPacientes.set(p1.id, p1);

  // Paciente 2
  const p2: PacienteClinico = {
    id: 'p_2',
    nome: 'Dona Maria de Oliveira',
    cpf: '987.654.321-11',
    data_nascimento: '1952-11-20',
    endereco: 'Av. Brigadeiro Luis Antonio, 2300 - Bela Vista, São Paulo - SP',
    telefone: '(11) 99123-4567',
    responsavel_nome: 'Marcos Oliveira (Esposo)',
    responsavel_telefone: '(11) 98877-6655',
    diagnostico_principal: 'Pós-operatório de Artroplastia de Quadril / Diabetes Mellitus Tipo 2',
    cid10: 'Z96.6 / E11',
    complexidade: 'Média',
    plano_saude: 'SulAmérica Especial',
    numero_carteirinha: '456123789002',
    warnings: ['Diabética Insulino Dependente', 'Restrição de carga em membro inferior direito'],
    status: 'Ativo',
    created_at: `${hoje}T07:00:00.000Z`,
  };
  inMemoryPacientes.set(p2.id, p2);

  // Paciente 3
  const p3: PacienteClinico = {
    id: 'p_3',
    nome: 'Antônio Carlos Guimarães',
    cpf: '456.789.123-88',
    data_nascimento: '1939-08-30',
    endereco: 'Rua Vergueiro, 1500 - Vila Mariana, São Paulo - SP',
    telefone: '(11) 97654-3210',
    responsavel_nome: 'Renata Guimarães (Filha)',
    responsavel_telefone: '(11) 99988-1122',
    diagnostico_principal: 'DPOC Grave / Oxigenoterapia Domiciliar Contínua',
    cid10: 'J44.9',
    complexidade: 'Alta',
    plano_saude: 'Unimed Seguros',
    numero_carteirinha: '123789456003',
    warnings: ['Uso contínuo de O2 2L/min via cateter nasal', 'Alergia a AINEs'],
    status: 'Ativo',
    created_at: `${hoje}T07:00:00.000Z`,
  };
  inMemoryPacientes.set(p3.id, p3);

  // Prescrições P1
  const pr1: PrescricaoClinica = {
    id: 'pr_1',
    paciente_id: 'p_1',
    medico_nome: 'Dr. Roberto Cardozo',
    medico_crm: 'CRM-SP 114520',
    medicamento: 'Losartana Potássica 50mg',
    dosagem: '1 comprimido via SNE',
    via_administracao: 'Enteral',
    frequencia_horas: 12,
    horarios_padrao: ['08:00', '20:00'],
    data_inicio: `${hoje}T00:00:00.000Z`,
    data_fim: `${hoje}T23:59:59.000Z`,
    instrucoes: 'Triturar e diluir em 20ml de água filtrada',
    status: 'Ativa',
  };
  inMemoryPrescricoes.set(pr1.id, pr1);

  const pr2: PrescricaoClinica = {
    id: 'pr_2',
    paciente_id: 'p_1',
    medico_nome: 'Dr. Roberto Cardozo',
    medico_crm: 'CRM-SP 114520',
    medicamento: 'Enoxaparina Sódica 40mg/0,4ml',
    dosagem: '1 seringa preenchida',
    via_administracao: 'Subcutânea',
    frequencia_horas: 24,
    horarios_padrao: ['20:00'],
    data_inicio: `${hoje}T00:00:00.000Z`,
    data_fim: `${hoje}T23:59:59.000Z`,
    instrucoes: 'Alternar sítios de aplicação em abdome',
    status: 'Ativa',
  };
  inMemoryPrescricoes.set(pr2.id, pr2);

  // Aprazamentos P1
  const ap1: AprazamentoClinico = {
    id: 'ap_1',
    prescricao_id: 'pr_1',
    paciente_id: 'p_1',
    medicamento: 'Losartana Potássica 50mg',
    dosagem: '1 comprimido via SNE',
    via_administracao: 'Enteral',
    horario_previsto: `${hoje}T08:00:00.000Z`,
    horario_executado: `${hoje}T08:05:00.000Z`,
    status: 'Administrado',
    profissional_id: 'coop_123',
    profissional_nome: 'Ana Silva (Téc. Enfermagem)',
    profissional_cargo: 'Tecnico_Enfermagem',
    assinatura_digital: 'v1:coop_123:sha256_mock_sig',
  };
  inMemoryAprazamentos.set(ap1.id, ap1);

  const ap2: AprazamentoClinico = {
    id: 'ap_2',
    prescricao_id: 'pr_1',
    paciente_id: 'p_1',
    medicamento: 'Losartana Potássica 50mg',
    dosagem: '1 comprimido via SNE',
    via_administracao: 'Enteral',
    horario_previsto: `${hoje}T20:00:00.000Z`,
    status: 'Pendente',
  };
  inMemoryAprazamentos.set(ap2.id, ap2);

  // Sinais Vitais P1
  const sv1: SinalVitalClinico = {
    id: 'sv_1',
    paciente_id: 'p_1',
    data_hora: `${hoje}T08:10:00.000Z`,
    pa_sistolica: 120,
    pa_diastolica: 80,
    fc_bpm: 76,
    fr_rpm: 16,
    temp_celsius: 36.4,
    spo2_percent: 98,
    glicemia_mg_dl: 104,
    dor_escala: 0,
    nivel_consciencia: 'Alerta',
    observacoes: 'Paciente calmo, eupneico e normocorado.',
    profissional_id: 'coop_123',
    profissional_nome: 'Ana Silva',
  };
  inMemorySinaisVitais.set(sv1.id, sv1);

  // Evolução P1
  const ev1: EvolucaoClinica = {
    id: 'ev_1',
    paciente_id: 'p_1',
    paciente_nome: 'Seu João da Silva',
    paciente_cpf: '123.456.789-00',
    profissional_id: 'coop_123',
    profissional_nome: 'Dra. Ana Silva',
    tipo_profissional: 'Tecnico_Enfermagem',
    profissional_registro: 'COREN-SP 458921',
    turno: 'Diurno',
    check_in: `${hoje}T08:00:00.000Z`,
    check_out: `${hoje}T09:15:00.000Z`,
    audio_url: 'https://gestorcoop.pages.dev/mock-audio-1.webm',
    transcricao_crua: 'Paciente bem disposto no início da manhã, recebeu medicação matinal via sonda sem intercorrências, sinais vitais aferidos dentro dos limites de normalidade.',
    transcricao_revisada: 'EVOLUÇÃO CLÍNICA DE ENFERMAGEM:\n- SUBJETIVO: Paciente sem queixas álgicas, repouso noturno satisfatório.\n- OBJETIVO: PA 120/80 mmHg, FC 76 bpm, FR 16 rpm, Temp 36.4°C, SpO2 98%. SNE pérvia com boa fixação nasal.\n- AVALIAÇÃO: Quadro clínico estável, colaborativo.\n- PLANO: Realizada higiene e hidratação cutânea, mantida dieta e cabeceira elevada a 30°.',
    soap_subjetivo: 'Paciente calmo, sem queixas álgicas referidas ou demonstradas. Familiar relata noite de sono tranquila.',
    soap_objetivo: 'PA 120x80 mmHg, FC 76 bpm, Temp 36.4°C, SpO2 98% em ar ambiente. Sonda nasoenteral pérvia, pele íntegra, aceitou dieta prescrita sem refluxo.',
    soap_avaliacao: 'Paciente estável hemodinamicamente, sem sinais de complicações ou infecção.',
    soap_plano: 'Administrada medicação matinal prescrita (Losartana). Mantidas medidas de prevenção de lesão por pressão (mudança de decúbito).',
    status: 'Auditado',
    data_assinatura: `${hoje}T09:15:00.000Z`,
    assinatura_digital: 'v1:coop_123:hmac_sig_valid',
    parecer_auditoria: 'Evolução detalhada e conforme diretrizes do COREN.',
    auditado_por: 'Dr. Marcos Gestor',
    data_auditoria: `${hoje}T10:00:00.000Z`,
  };
  inMemoryEvolucoes.set(ev1.id, ev1);

  // Evolução Médica P2
  const ev2: EvolucaoClinica = {
    id: 'ev_2',
    paciente_id: 'p_2',
    paciente_nome: 'Dona Maria de Oliveira',
    paciente_cpf: '987.654.321-11',
    profissional_id: 'coop_789',
    profissional_nome: 'Dr. Roberto Cardozo',
    tipo_profissional: 'Medico',
    profissional_registro: 'CRM-SP 114520',
    turno: 'Visita Pontual',
    check_in: `${hoje}T10:00:00.000Z`,
    check_out: `${hoje}T10:45:00.000Z`,
    transcricao_crua: 'Visita médica de acompanhamento pós-artroplastia. Paciente deambulando com andador, ferida limpa e seca.',
    transcricao_revisada: 'EVOLUÇÃO MÉDICA:\n- SUBJETIVO: Refere dor leve (EVA 2/10) apenas aos movimentos de flexão máxima.\n- OBJETIVO: Incisão cirúrgica com cicatrização adequada, sem hiperemia ou secreção.\n- AVALIAÇÃO: Excelente recuperação motora funcional pós-artroplastia.\n- PLANO: Ajuste de analgésicos para uso apenas se dor moderada. Fisioterapia diária mantida.',
    soap_subjetivo: 'Refere dor leve (EVA 2/10) na região lateral da coxa direita ao realizar exercícios com fisioterapia.',
    soap_objetivo: 'Cicatrização da FO favorável, sem sinais flogísticos. Pulsos periféricos simétricos e cheios. PA 130/80 mmHg, Glicemia capilar 128 mg/dL.',
    soap_avaliacao: 'Pós-operatório de artroplastia total de quadril em evolução favorável.',
    soap_plano: 'Desmame gradual de analgésicos fortes, mantida profilaxia antitrombótica e cinesioterapia.',
    status: 'Finalizado',
    data_assinatura: `${hoje}T10:45:00.000Z`,
    assinatura_digital: 'v1:coop_789:hmac_sig_medico',
  };
  inMemoryEvolucoes.set(ev2.id, ev2);
}

// -------------------------------------------------------------
// Funções Públicas de Acesso a Dados
// -------------------------------------------------------------

export async function listarPacientesClinicos(filtro?: {
  busca?: string;
  status?: string;
  complexidade?: string;
}): Promise<PacienteClinico[]> {
  seedClinicalMemory();
  const db = getDb();

  let lista: PacienteClinico[] = [];

  if (db) {
    try {
      let query = `SELECT * FROM pacientes WHERE 1=1`;
      const params: unknown[] = [];

      if (filtro?.status) {
        query += ` AND status = ?`;
        params.push(filtro.status);
      }
      if (filtro?.complexidade) {
        query += ` AND complexidade = ?`;
        params.push(filtro.complexidade);
      }

      const res = await db.prepare(query).bind(...params).all();
      lista = (res.results || []).map((r: any) => ({
        id: r.id,
        nome: r.nome,
        cpf: r.cpf,
        data_nascimento: r.data_nascimento,
        endereco: r.endereco,
        telefone: r.telefone,
        responsavel_nome: r.responsavel_nome,
        responsavel_telefone: r.responsavel_telefone,
        diagnostico_principal: r.diagnostico_principal,
        cid10: r.cid10,
        complexidade: r.complexidade,
        plano_saude: r.plano_saude,
        numero_carteirinha: r.numero_carteirinha,
        warnings: r.warnings ? (typeof r.warnings === 'string' ? JSON.parse(r.warnings) : r.warnings) : [],
        status: r.status || 'Ativo',
        limite_visitas_mes: Number(r.limite_visitas_mes || 0),
        created_at: r.created_at,
      }));
    } catch (e) {
      console.warn('Erro ao consultar pacientes no D1, usando memória:', e);
      lista = Array.from(inMemoryPacientes.values());
    }
  } else {
    lista = Array.from(inMemoryPacientes.values());
  }

  // Filtragem complementar de texto
  if (filtro?.busca) {
    const b = filtro.busca.toLowerCase();
    lista = lista.filter(
      (p) =>
        p.nome.toLowerCase().includes(b) ||
        p.cpf.includes(b) ||
        (p.diagnostico_principal || '').toLowerCase().includes(b) ||
        (p.cid10 || '').toLowerCase().includes(b)
    );
  }

  const mesAtualIso = new Date().toISOString().slice(0, 7); // ex: '2026-09'

  // Enriquecer com métricas clínicas (última evolução, prescrições e cota de visitas do mês)
  for (const p of lista) {
    const prescricoes = Array.from(inMemoryPrescricoes.values()).filter(
      (pr) => pr.paciente_id === p.id && pr.status === 'Ativa'
    );
    p.total_prescricoes_ativas = prescricoes.length;

    const evolucoes = Array.from(inMemoryEvolucoes.values())
      .filter((ev) => ev.paciente_id === p.id)
      .sort((a, b) => new Date(b.check_in).getTime() - new Date(a.check_in).getTime());

    if (evolucoes.length > 0) {
      p.ultima_evolucao_data = evolucoes[0].check_in;
      p.ultimo_profissional_nome = evolucoes[0].profissional_nome;
    }

    // Contagem de visitas técnicas no mês atual
    const evolucoesMes = evolucoes.filter(
      (ev) => ev.check_in && ev.check_in.startsWith(mesAtualIso)
    );
    p.visitas_realizadas_mes = evolucoesMes.length;
    const limite = p.limite_visitas_mes || 0;
    p.visitas_restantes_mes = limite > 0 ? Math.max(0, limite - p.visitas_realizadas_mes) : undefined;
    p.limite_atingido = limite > 0 ? p.visitas_realizadas_mes >= limite : false;

    const sinais = Array.from(inMemorySinaisVitais.values())
      .filter((s) => s.paciente_id === p.id)
      .sort((a, b) => new Date(b.data_hora).getTime() - new Date(a.data_hora).getTime());

    p.ultimo_sinal_vital = sinais.length > 0 ? sinais[0] : null;
  }

  return lista;
}

export async function obterPacienteClinico(id: string): Promise<PacienteClinico | null> {
  seedClinicalMemory();
  const db = getDb();
  let paciente: PacienteClinico | null = null;

  if (db) {
    try {
      const res = await db.prepare('SELECT * FROM pacientes WHERE id = ?').bind(id).first<any>();
      if (res) {
        paciente = {
          id: res.id,
          nome: res.nome,
          cpf: res.cpf,
          data_nascimento: res.data_nascimento,
          endereco: res.endereco,
          telefone: res.telefone,
          responsavel_nome: res.responsavel_nome,
          responsavel_telefone: res.responsavel_telefone,
          diagnostico_principal: res.diagnostico_principal,
          cid10: res.cid10,
          complexidade: res.complexidade,
          plano_saude: res.plano_saude,
          numero_carteirinha: res.numero_carteirinha,
          warnings: res.warnings ? (typeof res.warnings === 'string' ? JSON.parse(res.warnings) : res.warnings) : [],
          status: res.status || 'Ativo',
          limite_visitas_mes: Number(res.limite_visitas_mes || 0),
          created_at: res.created_at,
        };
      }
    } catch (e) {
      console.warn('Erro ao obter paciente no D1:', e);
    }
  }

  if (!paciente) {
    paciente = inMemoryPacientes.get(id) || null;
  }

  if (paciente) {
    const mesAtualIso = new Date().toISOString().slice(0, 7);
    const evolucoes = Array.from(inMemoryEvolucoes.values()).filter((ev) => ev.paciente_id === id);
    const evolucoesMes = evolucoes.filter((ev) => ev.check_in && ev.check_in.startsWith(mesAtualIso));
    paciente.visitas_realizadas_mes = evolucoesMes.length;
    const limite = paciente.limite_visitas_mes || 0;
    paciente.visitas_restantes_mes = limite > 0 ? Math.max(0, limite - paciente.visitas_realizadas_mes) : undefined;
    paciente.limite_atingido = limite > 0 ? paciente.visitas_realizadas_mes >= limite : false;
  }

  return paciente;
}

export async function obterCotaVisitasPaciente(pacienteId: string, mesReferencia?: string): Promise<{
  limite_visitas_mes: number;
  visitas_realizadas_mes: number;
  visitas_restantes_mes: number;
  limite_atingido: boolean;
}> {
  seedClinicalMemory();
  const mes = mesReferencia || new Date().toISOString().slice(0, 7);
  const db = getDb();
  let limite = 0;
  let realizadas = 0;

  if (db) {
    try {
      const pRow = await db.prepare('SELECT limite_visitas_mes FROM pacientes WHERE id = ?').bind(pacienteId).first<any>();
      if (pRow) limite = Number(pRow.limite_visitas_mes || 0);

      const countRow = await db.prepare(
        "SELECT COUNT(*) as total FROM evolucoes WHERE paciente_id = ? AND strftime('%Y-%m', check_in) = ?"
      ).bind(pacienteId, mes).first<any>();
      if (countRow) realizadas = Number(countRow.total || 0);
    } catch (e) {
      console.warn('Erro ao obter cota no D1, caindo para memória:', e);
    }
  }

  if (limite === 0 && inMemoryPacientes.has(pacienteId)) {
    limite = inMemoryPacientes.get(pacienteId)?.limite_visitas_mes || 0;
  }
  if (realizadas === 0) {
    realizadas = Array.from(inMemoryEvolucoes.values()).filter(
      (ev) => ev.paciente_id === pacienteId && ev.check_in && ev.check_in.startsWith(mes)
    ).length;
  }

  const restantes = limite > 0 ? Math.max(0, limite - realizadas) : 0;
  const atingido = limite > 0 && realizadas >= limite;

  return {
    limite_visitas_mes: limite,
    visitas_realizadas_mes: realizadas,
    visitas_restantes_mes: restantes,
    limite_atingido: atingido,
  };
}

export async function salvarPacienteClinico(paciente: Partial<PacienteClinico> & { nome: string; cpf: string }): Promise<PacienteClinico> {
  seedClinicalMemory();
  const id = paciente.id || novoId('pac');
  const now = agoraIso();

  const registro: PacienteClinico = {
    id,
    nome: paciente.nome,
    cpf: paciente.cpf,
    data_nascimento: paciente.data_nascimento || '',
    endereco: paciente.endereco || '',
    telefone: paciente.telefone || '',
    responsavel_nome: paciente.responsavel_nome || '',
    responsavel_telefone: paciente.responsavel_telefone || '',
    diagnostico_principal: paciente.diagnostico_principal || '',
    cid10: paciente.cid10 || '',
    complexidade: paciente.complexidade || 'Baixa',
    plano_saude: paciente.plano_saude || '',
    numero_carteirinha: paciente.numero_carteirinha || '',
    warnings: paciente.warnings || [],
    status: paciente.status || 'Ativo',
    limite_visitas_mes: Number(paciente.limite_visitas_mes ?? 0),
    created_at: paciente.created_at || now,
  };

  inMemoryPacientes.set(id, registro);

  const db = getDb();
  if (db) {
    try {
      await db.prepare(`
        INSERT INTO pacientes (
          id, nome, cpf, data_nascimento, endereco, telefone, responsavel_nome,
          responsavel_telefone, diagnostico_principal, cid10, complexidade,
          plano_saude, numero_carteirinha, warnings, status, limite_visitas_mes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          nome = excluded.nome,
          cpf = excluded.cpf,
          data_nascimento = excluded.data_nascimento,
          endereco = excluded.endereco,
          telefone = excluded.telefone,
          responsavel_nome = excluded.responsavel_nome,
          responsavel_telefone = excluded.responsavel_telefone,
          diagnostico_principal = excluded.diagnostico_principal,
          cid10 = excluded.cid10,
          complexidade = excluded.complexidade,
          plano_saude = excluded.plano_saude,
          numero_carteirinha = excluded.numero_carteirinha,
          warnings = excluded.warnings,
          status = excluded.status,
          limite_visitas_mes = excluded.limite_visitas_mes
      `).bind(
        registro.id,
        registro.nome,
        registro.cpf,
        registro.data_nascimento,
        registro.endereco,
        registro.telefone,
        registro.responsavel_nome,
        registro.responsavel_telefone,
        registro.diagnostico_principal,
        registro.cid10,
        registro.complexidade,
        registro.plano_saude,
        registro.numero_carteirinha,
        JSON.stringify(registro.warnings || []),
        registro.status,
        registro.limite_visitas_mes,
        registro.created_at
      ).run();
    } catch (e) {
      console.warn('Erro ao salvar paciente no D1:', e);
    }
  }

  return registro;
}

export async function listarEvolucoesClinicas(filtros?: {
  paciente_id?: string;
  profissional_id?: string;
  especialidade?: string;
  status?: string;
  data_inicio?: string;
  data_fim?: string;
  limit?: number;
}): Promise<EvolucaoClinica[]> {
  seedClinicalMemory();
  let lista = Array.from(inMemoryEvolucoes.values());

  if (filtros?.paciente_id) {
    lista = lista.filter((ev) => ev.paciente_id === filtros.paciente_id);
  }
  if (filtros?.profissional_id) {
    lista = lista.filter((ev) => ev.profissional_id === filtros.profissional_id);
  }
  if (filtros?.especialidade) {
    lista = lista.filter((ev) => ev.tipo_profissional === filtros.especialidade);
  }
  if (filtros?.status) {
    lista = lista.filter((ev) => ev.status === filtros.status);
  }
  if (filtros?.data_inicio) {
    lista = lista.filter((ev) => new Date(ev.check_in) >= new Date(filtros.data_inicio!));
  }
  if (filtros?.data_fim) {
    lista = lista.filter((ev) => new Date(ev.check_in) <= new Date(filtros.data_fim! + 'T23:59:59'));
  }

  lista.sort((a, b) => new Date(b.check_in).getTime() - new Date(a.check_in).getTime());

  if (filtros?.limit) {
    lista = lista.slice(0, filtros.limit);
  }

  // Anexar aprazamentos e sinais vitais correspondentes
  for (const ev of lista) {
    ev.aprazamentos = Array.from(inMemoryAprazamentos.values()).filter(
      (ap) =>
        ap.paciente_id === ev.paciente_id &&
        ap.horario_executado &&
        ap.horario_executado >= ev.check_in &&
        ap.horario_executado <= (ev.check_out || agoraIso())
    );

    ev.sinais_vitais = Array.from(inMemorySinaisVitais.values()).filter(
      (sv) =>
        sv.paciente_id === ev.paciente_id &&
        sv.data_hora >= ev.check_in &&
        sv.data_hora <= (ev.check_out || agoraIso())
    );
  }

  return lista;
}

export async function criarEvolucaoClinica(dados: Omit<EvolucaoClinica, 'id'> & { id?: string }): Promise<EvolucaoClinica> {
  seedClinicalMemory();
  const id = dados.id || novoId('evo');
  const evolucao: EvolucaoClinica = {
    ...dados,
    id,
  };

  inMemoryEvolucoes.set(id, evolucao);

  const db = getDb();
  if (db) {
    try {
      await db.prepare(`
        INSERT INTO evolucoes (
          id, paciente_id, profissional_id, tipo_profissional, turno,
          check_in, check_out, audio_url, transcricao_crua, transcricao_revisada,
          status, data_assinatura, assinatura_digital
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        evolucao.id,
        evolucao.paciente_id,
        evolucao.profissional_id,
        evolucao.tipo_profissional,
        evolucao.turno || null,
        evolucao.check_in,
        evolucao.check_out,
        evolucao.audio_url || null,
        evolucao.transcricao_crua || null,
        evolucao.transcricao_revisada,
        evolucao.status || 'Finalizado',
        evolucao.data_assinatura || null,
        evolucao.assinatura_digital || null
      ).run();
    } catch (e) {
      console.warn('Erro ao salvar evolução no D1:', e);
    }
  }

  return evolucao;
}

export async function listarPrescricoesClinicas(pacienteId: string, apenasAtivas = true): Promise<PrescricaoClinica[]> {
  seedClinicalMemory();

  // D1 primeiro: o Map em memória morre com o isolate do Worker, então ler só
  // dele fazia o painel perder prescrição recém-cadastrada entre dois cliques.
  const db = getDb();
  if (db) {
    try {
      const sql = apenasAtivas
        ? 'SELECT * FROM prescricoes WHERE paciente_id = ? AND status = ? ORDER BY created_at DESC'
        : 'SELECT * FROM prescricoes WHERE paciente_id = ? ORDER BY created_at DESC';
      const binds = apenasAtivas ? [pacienteId, 'Ativa'] : [pacienteId];
      const { results } = await db.prepare(sql).bind(...binds).all<any>();
      if (results.length > 0) {
        return results.map((p) => ({
          ...p,
          horarios_padrao: p.horarios_padrao ? JSON.parse(p.horarios_padrao) : [],
        })) as PrescricaoClinica[];
      }
    } catch (e) {
      console.warn('Erro ao ler prescrições do D1, caindo para memória:', e);
    }
  }

  let lista = Array.from(inMemoryPrescricoes.values()).filter((p) => p.paciente_id === pacienteId);
  if (apenasAtivas) {
    lista = lista.filter((p) => p.status === 'Ativa');
  }
  return lista;
}

/**
 * Fuso dos horários de aprazamento.
 *
 * `horarios_padrao` é digitado pelo gestor em horário de Brasília ("08:00" é
 * oito da manhã, não 08:00 UTC). A versão anterior montava o ISO com sufixo `Z`
 * direto, então uma medicação das 8h aparecia como 5h no celular do técnico —
 * três horas de erro em horário de medicamento.
 */
const FUSO_APRAZAMENTO = process.env.APRAZAMENTO_UTC_OFFSET || '-03:00';

/** Teto de segurança: prescrição de longa duração não deve gerar milhares de linhas. */
const MAX_SLOTS_APRAZAMENTO = 400;

/**
 * Gera um slot por horário padrão por dia, da data de início até a de fim.
 *
 * Antes só existia slot para o dia do cadastro: uma prescrição de 30 dias dava
 * três horários hoje e nada amanhã.
 */
export function gerarSlotsAprazamento(prescricao: PrescricaoClinica): AprazamentoClinico[] {
  const horarios = prescricao.horarios_padrao?.length ? prescricao.horarios_padrao : ['08:00', '16:00', '00:00'];
  const inicio = new Date(prescricao.data_inicio);
  const fim = new Date(prescricao.data_fim);
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime()) || fim < inicio) return [];

  const slots: AprazamentoClinico[] = [];
  const dia = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth(), inicio.getUTCDate()));
  const ultimoDia = new Date(Date.UTC(fim.getUTCFullYear(), fim.getUTCMonth(), fim.getUTCDate()));

  while (dia <= ultimoDia && slots.length < MAX_SLOTS_APRAZAMENTO) {
    const dataIso = dia.toISOString().slice(0, 10);
    for (const h of horarios) {
      if (slots.length >= MAX_SLOTS_APRAZAMENTO) break;
      const instante = new Date(`${dataIso}T${h}:00${FUSO_APRAZAMENTO}`);
      if (Number.isNaN(instante.getTime())) continue;
      slots.push({
        id: novoId('apraz'),
        prescricao_id: prescricao.id,
        paciente_id: prescricao.paciente_id,
        medicamento: prescricao.medicamento,
        dosagem: prescricao.dosagem,
        via_administracao: prescricao.via_administracao,
        horario_previsto: instante.toISOString(),
        status: 'Pendente',
      });
    }
    dia.setUTCDate(dia.getUTCDate() + 1);
  }

  return slots;
}

export async function criarPrescricaoClinica(dados: Omit<PrescricaoClinica, 'id'> & { id?: string }): Promise<PrescricaoClinica> {
  seedClinicalMemory();
  const id = dados.id || novoId('presc');
  const prescricao: PrescricaoClinica = {
    ...dados,
    id,
    created_at: agoraIso(),
  };

  inMemoryPrescricoes.set(id, prescricao);

  const slots = gerarSlotsAprazamento(prescricao);
  for (const ap of slots) inMemoryAprazamentos.set(ap.id, ap);

  // Persistência no D1. Sem isto a prescrição existia só no Map deste isolate:
  // o gestor via a confirmação de sucesso e o cooperado nunca recebia a
  // medicação, porque a agenda dele lê da tabela `aprazamentos`.
  const db = getDb();
  if (db) {
    const statements = [
      db.prepare(`
        INSERT INTO prescricoes (
          id, paciente_id, medicamento, dosagem, via_administracao, frequencia_horas,
          data_inicio, data_fim, medico_nome, medico_crm, horarios_padrao, instrucoes, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        prescricao.id,
        prescricao.paciente_id,
        prescricao.medicamento,
        prescricao.dosagem,
        prescricao.via_administracao,
        prescricao.frequencia_horas,
        prescricao.data_inicio,
        prescricao.data_fim,
        prescricao.medico_nome || '',
        prescricao.medico_crm || '',
        JSON.stringify(prescricao.horarios_padrao || []),
        prescricao.instrucoes || '',
        prescricao.status || 'Ativa',
        prescricao.created_at || agoraIso(),
      ),
      ...slots.map((ap) =>
        db
          .prepare('INSERT INTO aprazamentos (id, prescricao_id, horario_previsto, status) VALUES (?, ?, ?, ?)')
          .bind(ap.id, ap.prescricao_id, ap.horario_previsto, ap.status),
      ),
    ];

    // `batch` é atômico: ou entra a prescrição com todos os seus horários, ou
    // nada. Aprazamento órfão significaria medicação sem prescrição na tela.
    await db.batch(statements);
  }

  return prescricao;
}

export async function registrarSinalVitalClinico(dados: Omit<SinalVitalClinico, 'id'> & { id?: string }): Promise<SinalVitalClinico> {
  seedClinicalMemory();
  const id = dados.id || novoId('sv');
  const sinal: SinalVitalClinico = {
    ...dados,
    id,
    created_at: agoraIso(),
  };

  inMemorySinaisVitais.set(id, sinal);
  return sinal;
}

export async function listarSinaisVitaisClinicos(pacienteId: string, limit = 50): Promise<SinalVitalClinico[]> {
  seedClinicalMemory();
  return Array.from(inMemorySinaisVitais.values())
    .filter((s) => s.paciente_id === pacienteId)
    .sort((a, b) => new Date(b.data_hora).getTime() - new Date(a.data_hora).getTime())
    .slice(0, limit);
}

export async function registrarParecerClinico(dados: Omit<ParecerAuditoriaClinica, 'id'> & { id?: string }): Promise<ParecerAuditoriaClinica> {
  seedClinicalMemory();
  const id = dados.id || novoId('par');
  const parecer: ParecerAuditoriaClinica = {
    ...dados,
    id,
  };

  inMemoryPareceres.set(id, parecer);
  return parecer;
}

export async function listarPareceresClinicos(pacienteId: string): Promise<ParecerAuditoriaClinica[]> {
  seedClinicalMemory();
  return Array.from(inMemoryPareceres.values())
    .filter((p) => p.paciente_id === pacienteId)
    .sort((a, b) => new Date(b.data_registro).getTime() - new Date(a.data_registro).getTime());
}
