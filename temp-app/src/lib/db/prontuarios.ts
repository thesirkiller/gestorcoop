/* eslint-disable @typescript-eslint/no-explicit-any */
import { getDb, D1IndisponivelError, novoId, agoraIso, type D1Database } from './client';
import { bubbleApi } from '@/lib/bubble';

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
  tem_plano_terapeutico?: boolean;
  plano_vigente?: {
    id: string;
    data_inicio: string;
    data_fim: string;
    total_previsto: number;
    total_realizado: number;
    total_restante: number;
    tem_pendencias: boolean;
  } | null;
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

// -------------------------------------------------------------
// Banco de dados em memória para Fallback / Dev local sem D1
// Sincronizado via process.env e globalThis entre todos os módulos de rotas do Next.js
// -------------------------------------------------------------
const g = globalThis as any;

function criarMapaCompartilhado<K, V>(nome: string): Map<K, V> {
  const globalKey = `__gestorcoop_inMemory_${nome}`;
  if (!g[globalKey]) g[globalKey] = new Map<K, V>();
  const localMap: Map<K, V> = g[globalKey];
  const envKey = `__GESTORCOOP_STORE_${nome}`;

  const sincronizarDoEnv = () => {
    try {
      if (typeof process !== 'undefined' && process.env && process.env[envKey]) {
        const entries: [K, V][] = JSON.parse(process.env[envKey]!);
        for (const [k, v] of entries) {
          localMap.set(k, v);
        }
      }
    } catch {}
  };

  const persistirNoEnv = () => {
    try {
      if (typeof process !== 'undefined' && process.env) {
        process.env[envKey] = JSON.stringify(Array.from(localMap.entries()));
      }
    } catch {}
  };

  sincronizarDoEnv();

  return new Proxy(localMap, {
    get(target, prop) {
      if (
        prop === 'get' ||
        prop === 'has' ||
        prop === 'values' ||
        prop === 'entries' ||
        prop === 'keys' ||
        prop === 'size' ||
        prop === Symbol.iterator ||
        prop === 'forEach'
      ) {
        sincronizarDoEnv();
      }
      if (prop === 'size') return target.size;
      const val = (target as any)[prop];
      if (typeof val === 'function') {
        return function (...args: any[]) {
          sincronizarDoEnv();
          const res = val.apply(target, args);
          if (prop === 'set' || prop === 'delete' || prop === 'clear') {
            persistirNoEnv();
          }
          return res;
        };
      }
      return val;
    },
  });
}

export const inMemoryPacientes: Map<string, PacienteClinico> = criarMapaCompartilhado('Pacientes');
const inMemoryPrescricoes: Map<string, PrescricaoClinica> = criarMapaCompartilhado('Prescricoes');
const inMemoryAprazamentos: Map<string, AprazamentoClinico> = criarMapaCompartilhado('Aprazamentos');
const inMemorySinaisVitais: Map<string, SinalVitalClinico> = criarMapaCompartilhado('SinaisVitais');
const inMemoryEvolucoes: Map<string, EvolucaoClinica> = criarMapaCompartilhado('Evolucoes');
const inMemoryPareceres: Map<string, ParecerAuditoriaClinica> = criarMapaCompartilhado('Pareceres');
const inMemoryPlanosTerapeuticos: Map<string, PlanoTerapeutico> = criarMapaCompartilhado('PlanosTerapeuticos');
const inMemoryPlanoMetas: Map<string, MetaPlanoTerapeutico> = criarMapaCompartilhado('PlanoMetas');

export function getClinicalDb() {
  const db = getDb();
  if (!db && process.env.NODE_ENV === 'production') throw new D1IndisponivelError();
  return db;
}

function seedClinicalMemory() {
  if (getDb() || process.env.NODE_ENV === 'production') return;
  if (g.__gestorcoop_clinical_seeded) return;
  g.__gestorcoop_clinical_seeded = true;

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

let schemaGarantido = false;
let schemaEmAndamento: Promise<void> | null = null;

async function executarComandoDdl(db: any, sql: string): Promise<void> {
  const sqlLimpo = sql.replace(/\r?\n+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!sqlLimpo) return;
  try {
    if (typeof db.prepare === 'function') {
      await db.prepare(sqlLimpo).run();
    } else if (typeof db.exec === 'function') {
      await db.exec(sqlLimpo);
    }
  } catch (error) {
    const msg = String(error);
    if (
      /duplicate column name/i.test(msg) ||
      /already exists/i.test(msg)
    ) {
      return;
    }
    console.warn(`[garantirSchemaD1] Aviso DDL: ${sqlLimpo.slice(0, 45)}... -> ${msg}`);
  }
}

/**
 * Sonda do schema em UMA instrução.
 *
 * Cada isolate novo do Worker começa com `schemaGarantido = false`, e o caminho
 * de DDL abaixo dispara ~19 comandos em sequência — um round trip ao D1 cada —
 * antes da primeira consulta clínica. Isolates são reciclados o tempo todo, então
 * esse custo aparecia em boa parte das aberturas de prontuário.
 *
 * A sonda referencia exatamente as tabelas e colunas que o DDL cria/adiciona. Se
 * ela executa sem erro, o DDL inteiro seria no-op e pode ser pulado; se qualquer
 * tabela ou coluna faltar, o SQLite responde "no such table/column" e caímos no
 * caminho completo, como antes.
 */
const SONDA_SCHEMA = [
  'SELECT',
  '(SELECT COUNT(*) FROM (SELECT telefone, responsavel_nome, responsavel_telefone, diagnostico_principal, cid10, complexidade, plano_saude, numero_carteirinha, status, created_at, limite_visitas_mes FROM pacientes LIMIT 0))',
  '+ (SELECT COUNT(*) FROM (SELECT id FROM planos_terapeuticos LIMIT 0))',
  '+ (SELECT COUNT(*) FROM (SELECT id FROM plano_terapeutico_metas LIMIT 0))',
  '+ (SELECT COUNT(*) FROM (SELECT id FROM prescricoes LIMIT 0))',
  '+ (SELECT COUNT(*) FROM (SELECT id FROM aprazamentos LIMIT 0))',
  '+ (SELECT COUNT(*) FROM (SELECT id FROM sinais_vitais LIMIT 0))',
  '+ (SELECT COUNT(*) FROM (SELECT id FROM pareceres_auditoria LIMIT 0))',
  '+ (SELECT COUNT(*) FROM (SELECT id FROM evolucoes LIMIT 0)) AS ok',
].join(' ');

async function schemaJaAplicado(db: any): Promise<boolean> {
  if (typeof db?.prepare !== 'function') return false;
  try {
    await db.prepare(SONDA_SCHEMA).first();
    return true;
  } catch {
    return false;
  }
}

export async function garantirSchemaD1(db: any): Promise<void> {
  if (!db || schemaGarantido) return;
  if (schemaEmAndamento) return schemaEmAndamento;
  schemaEmAndamento = (async () => {
  if (await schemaJaAplicado(db)) return;
  try {
    await executarComandoDdl(db, `
      CREATE TABLE IF NOT EXISTS pacientes (
        id TEXT PRIMARY KEY,
        nome TEXT NOT NULL,
        cpf TEXT,
        data_nascimento TEXT,
        endereco TEXT,
        warnings TEXT
      );
    `);
    const comandos = [
      'ALTER TABLE pacientes ADD COLUMN telefone TEXT NOT NULL DEFAULT ""',
      'ALTER TABLE pacientes ADD COLUMN responsavel_nome TEXT NOT NULL DEFAULT ""',
      'ALTER TABLE pacientes ADD COLUMN responsavel_telefone TEXT NOT NULL DEFAULT ""',
      'ALTER TABLE pacientes ADD COLUMN diagnostico_principal TEXT NOT NULL DEFAULT ""',
      'ALTER TABLE pacientes ADD COLUMN cid10 TEXT NOT NULL DEFAULT ""',
      'ALTER TABLE pacientes ADD COLUMN complexidade TEXT NOT NULL DEFAULT "Baixa"',
      'ALTER TABLE pacientes ADD COLUMN plano_saude TEXT NOT NULL DEFAULT ""',
      'ALTER TABLE pacientes ADD COLUMN numero_carteirinha TEXT NOT NULL DEFAULT ""',
      'ALTER TABLE pacientes ADD COLUMN status TEXT NOT NULL DEFAULT "Ativo"',
      'ALTER TABLE pacientes ADD COLUMN created_at TEXT',
      'ALTER TABLE pacientes ADD COLUMN limite_visitas_mes INTEGER NOT NULL DEFAULT 0',
      `CREATE TABLE IF NOT EXISTS planos_terapeuticos (
        id TEXT PRIMARY KEY,
        paciente_id TEXT NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
        data_inicio TEXT NOT NULL,
        data_fim TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Ativo',
        observacoes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS plano_terapeutico_metas (
        id TEXT PRIMARY KEY,
        plano_id TEXT NOT NULL REFERENCES planos_terapeuticos(id) ON DELETE CASCADE,
        especialidade TEXT NOT NULL,
        quantidade_prevista INTEGER NOT NULL DEFAULT 1,
        profissionais_designados TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS prescricoes (
        id TEXT PRIMARY KEY,
        paciente_id TEXT NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
        medicamento TEXT NOT NULL,
        dosagem TEXT NOT NULL,
        via_administracao TEXT NOT NULL,
        frequencia_horas INTEGER NOT NULL,
        data_inicio TEXT NOT NULL,
        data_fim TEXT NOT NULL,
        medico_nome TEXT DEFAULT '',
        medico_crm TEXT DEFAULT '',
        horarios_padrao TEXT DEFAULT '[]',
        instrucoes TEXT DEFAULT '',
        status TEXT DEFAULT 'Ativa',
        created_at TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS aprazamentos (
        id TEXT PRIMARY KEY,
        prescricao_id TEXT NOT NULL REFERENCES prescricoes(id) ON DELETE CASCADE,
        horario_previsto TEXT NOT NULL,
        horario_executado TEXT,
        status TEXT NOT NULL DEFAULT 'Pendente',
        justificativa TEXT,
        profissional_id TEXT,
        assinatura_digital TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS sinais_vitais (
        id TEXT PRIMARY KEY,
        paciente_id TEXT NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
        evolucao_id TEXT,
        data_hora TEXT NOT NULL,
        pa_sistolica INTEGER,
        pa_diastolica INTEGER,
        fc_bpm INTEGER,
        fr_rpm INTEGER,
        temp_celsius REAL,
        spo2_percent INTEGER,
        glicemia_mg_dl INTEGER,
        dor_escala INTEGER,
        nivel_consciencia TEXT,
        observacoes TEXT,
        profissional_id TEXT,
        profissional_nome TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS pareceres_auditoria (
        id TEXT PRIMARY KEY,
        paciente_id TEXT NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
        evolucao_id TEXT,
        auditor_id TEXT NOT NULL,
        auditor_nome TEXT NOT NULL,
        tipo_parecer TEXT NOT NULL,
        descricao TEXT NOT NULL,
        data_registro TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS evolucoes (
        id TEXT PRIMARY KEY,
        paciente_id TEXT NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
        profissional_id TEXT NOT NULL,
        tipo_profissional TEXT NOT NULL,
        turno TEXT,
        check_in TEXT NOT NULL,
        check_out TEXT NOT NULL,
        audio_url TEXT,
        transcricao_crua TEXT,
        transcricao_revisada TEXT,
        status TEXT NOT NULL DEFAULT 'Em_Andamento',
        data_assinatura TEXT,
        assinatura_digital TEXT,
        profissional_nome TEXT DEFAULT '',
        soap_subjetivo TEXT,
        soap_objetivo TEXT,
        soap_avaliacao TEXT,
        soap_plano TEXT
      )`,
      'CREATE INDEX IF NOT EXISTS idx_prescricoes_paciente_status ON prescricoes(paciente_id, status)',
      'CREATE INDEX IF NOT EXISTS idx_pacientes_nome ON pacientes(nome COLLATE NOCASE)'
    ];
    for (const cmd of comandos) {
      await executarComandoDdl(db, cmd);
    }
  } catch (err) {
    console.error('Erro ao inicializar schema do D1:', err);
    throw err;
  }
  })();
  try {
    await schemaEmAndamento;
    schemaGarantido = true;
  } finally {
    schemaEmAndamento = null;
  }
}

// -------------------------------------------------------------
// Mapeadores de linha do D1 (compartilhados pelas consultas unitárias e pelas
// consultas agregadas abaixo, para que os dois caminhos devolvam o mesmo formato)
// -------------------------------------------------------------

function parseJsonSeguro<T>(valor: unknown, padrao: T): T {
  if (valor == null || valor === '') return padrao;
  if (typeof valor !== 'string') return valor as T;
  try {
    return JSON.parse(valor) as T;
  } catch {
    return padrao;
  }
}

export function mapearPacienteRow(r: any): PacienteClinico {
  return {
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
  };
}

/** Colunas das consultas de evolução com nome/CPF do paciente (alias `e` e `pac`). */
const COLUNAS_EVOLUCAO_COM_PACIENTE = 'e.*, pac.nome AS paciente_nome, pac.cpf AS paciente_cpf';

export function mapearEvolucaoRow(r: any): EvolucaoClinica {
  return {
    id: r.id,
    paciente_id: r.paciente_id,
    paciente_nome: r.paciente_nome || undefined,
    paciente_cpf: r.paciente_cpf || undefined,
    profissional_id: r.profissional_id,
    tipo_profissional: r.tipo_profissional,
    profissional_nome: r.profissional_nome || '',
    turno: r.turno || undefined,
    check_in: r.check_in,
    check_out: r.check_out,
    audio_url: r.audio_url || undefined,
    transcricao_crua: r.transcricao_crua || undefined,
    transcricao_revisada: r.transcricao_revisada || '',
    soap_subjetivo: r.soap_subjetivo || undefined,
    soap_objetivo: r.soap_objetivo || undefined,
    soap_avaliacao: r.soap_avaliacao || undefined,
    soap_plano: r.soap_plano || undefined,
    status: r.status || 'Finalizado',
    data_assinatura: r.data_assinatura || undefined,
    assinatura_digital: r.assinatura_digital || undefined,
  };
}

function mapearPrescricaoRow(p: any): PrescricaoClinica {
  return {
    ...p,
    horarios_padrao: p.horarios_padrao ? JSON.parse(p.horarios_padrao) : [],
  } as PrescricaoClinica;
}

function mapearMetaRow(m: any): MetaPlanoTerapeutico {
  return {
    id: m.id,
    plano_id: m.plano_id,
    especialidade: m.especialidade,
    quantidade_prevista: Number(m.quantidade_prevista || 1),
    profissionais_designados: parseJsonSeguro<ProfissionalDesignado[]>(m.profissionais_designados, []),
    created_at: m.created_at,
  };
}

function mapearPlanoRow(row: any, metas: MetaPlanoTerapeutico[]): PlanoTerapeutico {
  return {
    id: row.id,
    paciente_id: row.paciente_id,
    data_inicio: row.data_inicio,
    data_fim: row.data_fim,
    status: row.status,
    observacoes: row.observacoes,
    created_at: row.created_at,
    updated_at: row.updated_at,
    metas,
  };
}

/** Prefixo `YYYY-MM` do mês seguinte, para filtrar `check_in` por intervalo (usa o índice). */
function mesSeguinteIso(mesIso: string): string {
  const [ano, mes] = mesIso.split('-').map(Number);
  return mes === 12 ? `${ano + 1}-01` : `${ano}-${String(mes + 1).padStart(2, '0')}`;
}

export async function listarPacientesClinicos(filtro?: {
  busca?: string;
  status?: string;
  complexidade?: string;
}): Promise<PacienteClinico[]> {
  seedClinicalMemory();
  const db = getClinicalDb();
  if (db) await garantirSchemaD1(db);

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
      lista = (res.results || []).map(mapearPacienteRow);
    } catch (e) {
      throw e;
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
  const db = getClinicalDb();
  if (db) await garantirSchemaD1(db);
  let paciente: PacienteClinico | null = null;

  if (db) {
    try {
      const res = await db.prepare('SELECT * FROM pacientes WHERE id = ?').bind(id).first<any>();
      if (res) {
        paciente = mapearPacienteRow(res);
      }
    } catch (e) {
      throw e;
    }
  }

  if (!paciente) {
    paciente = inMemoryPacientes.get(id) || null;
  }

  // Se não foi encontrado no D1 nem na memória, auto-provisiona a partir do Bubble
  if (!paciente) {
    try {
      const bubblePac = await bubbleApi.getPaciente(id);
      if (bubblePac && (bubblePac._id || bubblePac.txt_nome)) {
        paciente = await salvarPacienteClinico({
          id: bubblePac._id || id,
          nome: bubblePac.txt_nome || 'Paciente sem Nome',
          cpf: bubblePac.txt_cpf || '',
          endereco: bubblePac.txt_endereco || '',
          telefone: bubblePac.txt_whatsapp || '',
          diagnostico_principal: '',
          status: 'Ativo',
          limite_visitas_mes: 0,
          warnings: [],
        });
      }
    } catch {
      // Paciente não localizado no Bubble
    }
  }

  if (paciente) {
    const mesAtualIso = new Date().toISOString().slice(0, 7);
    const evolucoes = await listarEvolucoesClinicas({ paciente_id: id });
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
  const db = getClinicalDb();
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

  const db = getClinicalDb();
  if (db) {
    await garantirSchemaD1(db);
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
      console.error('Erro ao salvar paciente no D1:', e);
      throw e;
    }
  }

  inMemoryPacientes.set(id, registro);
  return registro;
}

export interface FiltrosEvolucoes {
  paciente_id?: string;
  profissional_id?: string;
  especialidade?: string;
  status?: string;
  data_inicio?: string;
  data_fim?: string;
  limit?: number;
}

/**
 * SQL da linha do tempo de evoluções (alias `e` e `pac`), compartilhado pela
 * consulta completa e pela projeção leve, para que as duas apliquem exatamente
 * os mesmos filtros, ordem e limite.
 */
function montarConsultaEvolucoes(colunas: string, filtros?: FiltrosEvolucoes): { sql: string; params: any[] } {
  // LEFT JOIN pela PK do paciente: sem ele a linha do tempo do gestor saía
  // sem `paciente_nome`/`paciente_cpf` (coluna principal da tabela e campo de
  // busca). As colunas do WHERE vão prefixadas: `status` existe nas duas tabelas.
  let sql = `SELECT ${colunas} FROM evolucoes e LEFT JOIN pacientes pac ON pac.id = e.paciente_id WHERE 1=1`;
  const params: any[] = [];
  if (filtros?.paciente_id) {
    sql += ' AND e.paciente_id = ?';
    params.push(filtros.paciente_id);
  }
  if (filtros?.profissional_id) {
    sql += ' AND e.profissional_id = ?';
    params.push(filtros.profissional_id);
  }
  if (filtros?.especialidade) {
    sql += ' AND e.tipo_profissional = ?';
    params.push(filtros.especialidade);
  }
  if (filtros?.status) {
    sql += ' AND e.status = ?';
    params.push(filtros.status);
  }
  if (filtros?.data_inicio) {
    sql += ' AND e.check_in >= ?';
    params.push(filtros.data_inicio);
  }
  if (filtros?.data_fim) {
    sql += ' AND e.check_in <= ?';
    params.push(filtros.data_fim + 'T23:59:59');
  }
  sql += ' ORDER BY e.check_in DESC';
  if (filtros?.limit) {
    sql += ` LIMIT ${Number(filtros.limit)}`;
  }
  return { sql, params };
}

export async function listarEvolucoesClinicas(filtros?: FiltrosEvolucoes): Promise<EvolucaoClinica[]> {
  seedClinicalMemory();
  const db = getClinicalDb();
  if (db) {
    try {
      await garantirSchemaD1(db);
      const { sql: query, params } = montarConsultaEvolucoes(COLUNAS_EVOLUCAO_COM_PACIENTE, filtros);
      const stmt = db.prepare(query);
      const rows = (await (params.length ? stmt.bind(...params) : stmt).all<any>()).results;
      if (rows) {
        return rows.map(mapearEvolucaoRow);
      }
    } catch (e) {
      throw e;
    }
  }

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

/** Tamanho máximo do texto de resumo na projeção leve (a célula da tabela é truncada em 1 linha). */
export const LIMITE_RESUMO_EVOLUCAO = 240;

/**
 * Item da linha do tempo na projeção leve: o que a tabela/CSV/KPIs da
 * listagem usam, sem `transcricao_crua`, `audio_url`, assinatura e SOAP completo.
 */
export interface EvolucaoResumo {
  id: string;
  paciente_id: string;
  paciente_nome?: string;
  paciente_cpf?: string;
  profissional_id: string;
  profissional_nome: string;
  tipo_profissional: EspecialidadeProfissional | string;
  turno?: string;
  check_in: string;
  check_out: string;
  status: StatusEvolucao | string;
  data_assinatura?: string;
  /** `soap_avaliacao || transcricao_revisada`, truncado em `LIMITE_RESUMO_EVOLUCAO` caracteres. */
  resumo?: string;
  /** Aprazamentos do paciente executados durante o atendimento (mesmo critério do caminho em memória). */
  aprazamentos_total: number;
  aprazamentos_administrados: number;
}

const COLUNAS_EVOLUCAO_RESUMO =
  'e.id, e.paciente_id, pac.nome AS paciente_nome, pac.cpf AS paciente_cpf, e.profissional_id, ' +
  'e.profissional_nome, e.tipo_profissional, e.turno, e.check_in, e.check_out, e.status, e.data_assinatura, ' +
  `substr(COALESCE(NULLIF(e.soap_avaliacao, ''), NULLIF(e.transcricao_revisada, '')), 1, ${LIMITE_RESUMO_EVOLUCAO}) AS resumo`;

/**
 * Projeção leve da linha do tempo global (`GET /api/gestor/prontuarios` com
 * `X-Gestorcoop-Projecao: resumo`). Mesmos filtros, ordem e limite de
 * `listarEvolucoesClinicas`, mas sem transcrições/áudio/SOAP — que eram a maior
 * parte do payload de 100 evoluções e não aparecem na tabela.
 *
 * Também devolve a contagem de aprazamentos executados em cada atendimento: o
 * KPI de conformidade medicamentosa dependia de `ev.aprazamentos`, que só o
 * caminho em memória anexa — com D1 ele ficava sempre em 100%.
 *
 * D1: 2 instruções num único `batch` (uma ida). A contagem usa
 * `e.id IN (<mesma consulta com LIMIT>)`, que o SQLite materializa: o JOIN com
 * prescrições/aprazamentos roda só para as evoluções devolvidas.
 */
export async function listarEvolucoesResumo(
  filtros?: FiltrosEvolucoes,
  opcoes: { db?: D1Database } = {},
): Promise<EvolucaoResumo[]> {
  seedClinicalMemory();
  const db = opcoes.db ?? getClinicalDb();

  if (!db) {
    const completas = await listarEvolucoesClinicas(filtros);
    return completas.map((ev) => {
      const aprazamentos = ev.aprazamentos || [];
      return {
        id: ev.id,
        paciente_id: ev.paciente_id,
        paciente_nome: ev.paciente_nome || undefined,
        paciente_cpf: ev.paciente_cpf || undefined,
        profissional_id: ev.profissional_id,
        profissional_nome: ev.profissional_nome || '',
        tipo_profissional: ev.tipo_profissional,
        turno: ev.turno || undefined,
        check_in: ev.check_in,
        check_out: ev.check_out,
        status: ev.status || 'Finalizado',
        data_assinatura: ev.data_assinatura || undefined,
        resumo: (ev.soap_avaliacao || ev.transcricao_revisada || '').slice(0, LIMITE_RESUMO_EVOLUCAO) || undefined,
        aprazamentos_total: aprazamentos.length,
        aprazamentos_administrados: aprazamentos.filter((a) => a.status === 'Administrado').length,
      };
    });
  }

  await garantirSchemaD1(db);

  const principal = montarConsultaEvolucoes(COLUNAS_EVOLUCAO_RESUMO, filtros);
  const ids = montarConsultaEvolucoes('e.id', filtros);
  const [rEvo, rAprazamentos] = await db.batch<any>([
    db.prepare(principal.sql).bind(...principal.params),
    db.prepare(
      "SELECT e.id AS evolucao_id, COUNT(*) AS total, SUM(CASE WHEN a.status = 'Administrado' THEN 1 ELSE 0 END) AS administrados " +
        'FROM evolucoes e ' +
        'JOIN prescricoes pr ON pr.paciente_id = e.paciente_id ' +
        'JOIN aprazamentos a ON a.prescricao_id = pr.id ' +
        `WHERE e.id IN (${ids.sql}) ` +
        "AND a.horario_executado IS NOT NULL AND a.horario_executado <> '' " +
        'AND a.horario_executado >= e.check_in ' +
        "AND a.horario_executado <= COALESCE(NULLIF(e.check_out, ''), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) " +
        'GROUP BY e.id'
    ).bind(...ids.params),
  ]);

  const contagem = new Map<string, { total: number; administrados: number }>();
  for (const r of rAprazamentos.results || []) {
    contagem.set(r.evolucao_id, { total: Number(r.total || 0), administrados: Number(r.administrados || 0) });
  }

  return (rEvo.results || []).map((r: any) => {
    const c = contagem.get(r.id);
    return {
      id: r.id,
      paciente_id: r.paciente_id,
      paciente_nome: r.paciente_nome || undefined,
      paciente_cpf: r.paciente_cpf || undefined,
      profissional_id: r.profissional_id,
      profissional_nome: r.profissional_nome || '',
      tipo_profissional: r.tipo_profissional,
      turno: r.turno || undefined,
      check_in: r.check_in,
      check_out: r.check_out,
      status: r.status || 'Finalizado',
      data_assinatura: r.data_assinatura || undefined,
      resumo: r.resumo || undefined,
      aprazamentos_total: c?.total ?? 0,
      aprazamentos_administrados: c?.administrados ?? 0,
    };
  });
}

export async function criarEvolucaoClinica(dados: Omit<EvolucaoClinica, 'id'> & { id?: string }): Promise<EvolucaoClinica> {
  seedClinicalMemory();
  const db = getClinicalDb();
  if (db) await garantirSchemaD1(db);

  // Garantir que o paciente existe no D1 antes de inserir a evolução
  await obterPacienteClinico(dados.paciente_id);

  const id = dados.id || novoId('evo');
  const evolucao: EvolucaoClinica = {
    ...dados,
    id,
  };

  if (db) {
    try {
      await db.prepare(`
        INSERT INTO evolucoes (
          id, paciente_id, profissional_id, tipo_profissional, turno,
          check_in, check_out, audio_url, transcricao_crua, transcricao_revisada,
          status, data_assinatura, assinatura_digital, profissional_nome,
          soap_subjetivo, soap_objetivo, soap_avaliacao, soap_plano
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          check_out = excluded.check_out,
          transcricao_crua = excluded.transcricao_crua,
          transcricao_revisada = excluded.transcricao_revisada,
          status = excluded.status,
          data_assinatura = excluded.data_assinatura,
          assinatura_digital = excluded.assinatura_digital,
          soap_subjetivo = excluded.soap_subjetivo,
          soap_objetivo = excluded.soap_objetivo,
          soap_avaliacao = excluded.soap_avaliacao,
          soap_plano = excluded.soap_plano
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
        evolucao.assinatura_digital || null,
        evolucao.profissional_nome || '',
        evolucao.soap_subjetivo || null,
        evolucao.soap_objetivo || null,
        evolucao.soap_avaliacao || null,
        evolucao.soap_plano || null
      ).run();
    } catch (e) {
      throw e;
    }
  }

  inMemoryEvolucoes.set(id, evolucao);
  return evolucao;
}

export async function listarPrescricoesClinicas(pacienteId: string, apenasAtivas = true): Promise<PrescricaoClinica[]> {
  seedClinicalMemory();

  // D1 primeiro: o Map em memória morre com o isolate do Worker, então ler só
  // dele fazia o painel perder prescrição recém-cadastrada entre dois cliques.
  const db = getClinicalDb();
  if (db) {
    try {
      const sql = apenasAtivas
        ? 'SELECT * FROM prescricoes WHERE paciente_id = ? AND status = ? ORDER BY created_at DESC'
        : 'SELECT * FROM prescricoes WHERE paciente_id = ? ORDER BY created_at DESC';
      const binds = apenasAtivas ? [pacienteId, 'Ativa'] : [pacienteId];
      const { results } = await db.prepare(sql).bind(...binds).all<any>();
      if (results) {
        return results.map((p) => ({
          ...p,
          horarios_padrao: p.horarios_padrao ? JSON.parse(p.horarios_padrao) : [],
        })) as PrescricaoClinica[];
      }
    } catch (e) {
      throw e;
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

  const slots = gerarSlotsAprazamento(prescricao);

  // Persistência no D1. Sem isto a prescrição existia só no Map deste isolate:
  // o gestor via a confirmação de sucesso e o cooperado nunca recebia a
  // medicação, porque a agenda dele lê da tabela `aprazamentos`.
  const db = getClinicalDb();
  if (db) {
    await garantirSchemaD1(db);
    // Assegurar paciente no D1 para foreign key
    await obterPacienteClinico(prescricao.paciente_id);

    try {
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

      // `batch` é atômico: ou entra a prescrição com todos os seus horários, ou nada.
      await db.batch(statements);
    } catch (e) {
      throw e;
    }
  }

  inMemoryPrescricoes.set(id, prescricao);
  for (const ap of slots) inMemoryAprazamentos.set(ap.id, ap);
  return prescricao;
}

export async function registrarSinalVitalClinico(dados: Omit<SinalVitalClinico, 'id'> & { id?: string }): Promise<SinalVitalClinico> {
  seedClinicalMemory();
  const db = getClinicalDb();
  if (db) await garantirSchemaD1(db);

  await obterPacienteClinico(dados.paciente_id);

  const id = dados.id || novoId('sv');
  const sinal: SinalVitalClinico = {
    ...dados,
    id,
    created_at: agoraIso(),
  };

  if (db) {
    try {
      await db.prepare(`
        INSERT INTO sinais_vitais (
          id, paciente_id, evolucao_id, data_hora, pa_sistolica, pa_diastolica,
          fc_bpm, fr_rpm, temp_celsius, spo2_percent, glicemia_mg_dl,
          dor_escala, nivel_consciencia, observacoes, profissional_id, profissional_nome, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        sinal.id,
        sinal.paciente_id,
        sinal.evolucao_id || null,
        sinal.data_hora,
        sinal.pa_sistolica ?? null,
        sinal.pa_diastolica ?? null,
        sinal.fc_bpm ?? null,
        sinal.fr_rpm ?? null,
        sinal.temp_celsius ?? null,
        sinal.spo2_percent ?? null,
        sinal.glicemia_mg_dl ?? null,
        sinal.dor_escala ?? null,
        sinal.nivel_consciencia || 'Alerta',
        sinal.observacoes || '',
        sinal.profissional_id || null,
        sinal.profissional_nome || null,
        sinal.created_at
      ).run();
    } catch (e) {
      throw e;
    }
  }

  inMemorySinaisVitais.set(id, sinal);
  return sinal;
}

export async function listarSinaisVitaisClinicos(pacienteId: string, limit = 50): Promise<SinalVitalClinico[]> {
  seedClinicalMemory();
  const db = getClinicalDb();
  if (db) await garantirSchemaD1(db);

  if (db) {
    try {
      const res = await db.prepare(
        'SELECT * FROM sinais_vitais WHERE paciente_id = ? ORDER BY data_hora DESC LIMIT ?'
      ).bind(pacienteId, limit).all<any>();
      if (res.results) {
        return res.results as SinalVitalClinico[];
      }
    } catch (e) {
      throw e;
    }
  }

  return Array.from(inMemorySinaisVitais.values())
    .filter((s) => s.paciente_id === pacienteId)
    .sort((a, b) => new Date(b.data_hora).getTime() - new Date(a.data_hora).getTime())
    .slice(0, limit);
}

export async function registrarParecerClinico(dados: Omit<ParecerAuditoriaClinica, 'id'> & { id?: string }): Promise<ParecerAuditoriaClinica> {
  seedClinicalMemory();
  const db = getClinicalDb();
  if (db) await garantirSchemaD1(db);

  await obterPacienteClinico(dados.paciente_id);

  const id = dados.id || novoId('par');
  const parecer: ParecerAuditoriaClinica = {
    ...dados,
    id,
  };

  if (db) {
    try {
      await db.prepare(`
        INSERT INTO pareceres_auditoria (id, paciente_id, evolucao_id, auditor_id, auditor_nome, tipo_parecer, descricao, data_registro)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        parecer.id,
        parecer.paciente_id,
        parecer.evolucao_id || null,
        parecer.auditor_id,
        parecer.auditor_nome,
        parecer.tipo_parecer,
        parecer.descricao,
        parecer.data_registro
      ).run();
    } catch (e) {
      throw e;
    }
  }

  inMemoryPareceres.set(id, parecer);
  return parecer;
}

export async function listarPareceresClinicos(pacienteId: string): Promise<ParecerAuditoriaClinica[]> {
  seedClinicalMemory();
  const db = getClinicalDb();
  if (db) await garantirSchemaD1(db);

  if (db) {
    try {
      const res = await db.prepare(
        'SELECT * FROM pareceres_auditoria WHERE paciente_id = ? ORDER BY data_registro DESC'
      ).bind(pacienteId).all<any>();
      if (res.results) {
        return res.results as ParecerAuditoriaClinica[];
      }
    } catch (e) {
      throw e;
    }
  }

  return Array.from(inMemoryPareceres.values())
    .filter((p) => p.paciente_id === pacienteId)
    .sort((a, b) => new Date(b.data_registro).getTime() - new Date(a.data_registro).getTime());
}

// -------------------------------------------------------------
// Planos Terapêuticos & Metas por Especialidade
// -------------------------------------------------------------

export function normalizarEspecialidade(esp: string): string {
  const map: Record<string, string> = {
    tecnico: 'Tecnico_Enfermagem',
    tecnico_enfermagem: 'Tecnico_Enfermagem',
    'técnico de enfermagem': 'Tecnico_Enfermagem',
    'técnico em enfermagem': 'Tecnico_Enfermagem',
    enfermeiro: 'Enfermeiro',
    enfermagem: 'Enfermeiro',
    medico: 'Medico',
    médico: 'Medico',
    dentista: 'Dentista',
    odontologo: 'Dentista',
    odontólogo: 'Dentista',
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
  const key = esp.toLowerCase().trim();
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
  return map[esp] || esp.replace(/_/g, ' ');
}

/**
 * Conta evoluções por especialidade normalizada dentro da vigência do plano.
 * Mesmo critério de antes: mesmo paciente, `check_in` preenchido e comparação
 * textual com `data_inicio T00:00:00.000Z` / `data_fim T23:59:59.999Z`.
 */
export function enriquecerPlanoComCalculos(plano: PlanoTerapeutico, evolucoes: EvolucaoClinica[]): PlanoTerapeutico {
  const inicioIso = `${plano.data_inicio}T00:00:00.000Z`;
  const fimIso = `${plano.data_fim}T23:59:59.999Z`;
  const contagem = new Map<string, number>();
  for (const ev of evolucoes) {
    if (ev.paciente_id !== plano.paciente_id || !ev.check_in) continue;
    if (ev.check_in < inicioIso || ev.check_in > fimIso) continue;
    const esp = normalizarEspecialidade(ev.tipo_profissional || '');
    contagem.set(esp, (contagem.get(esp) || 0) + 1);
  }
  return calcularProgressoPlano(plano, (esp) => contagem.get(esp) || 0);
}

/**
 * Regras de progresso/pendência do plano, separadas da origem da contagem.
 * `contarRealizadas` recebe a especialidade JÁ normalizada. Assim a listagem
 * agregada (contagem feita no D1 com GROUP BY) e o detalhe (contagem sobre as
 * evoluções carregadas) aplicam exatamente a mesma regra.
 */
export function calcularProgressoPlano(
  plano: PlanoTerapeutico,
  contarRealizadas: (especialidadeNormalizada: string) => number,
): PlanoTerapeutico {
  const hoje = new Date().toISOString().split('T')[0];
  const planoEncerradoOuProximo = hoje >= plano.data_fim;

  let totalPrevisto = 0;
  let totalRealizado = 0;
  const pendenciasAlertas: string[] = [];

  const metasEnriquecidas: MetaPlanoTerapeutico[] = (plano.metas || []).map((meta) => {
    const metaEspNormalizada = normalizarEspecialidade(meta.especialidade);

    const realizadas = contarRealizadas(metaEspNormalizada);
    const restante = Math.max(0, meta.quantidade_prevista - realizadas);
    totalPrevisto += meta.quantidade_prevista;
    totalRealizado += realizadas;

    let statusMeta: 'Em_Andamento' | 'Concluido' | 'Pendente' | 'Excedido' = 'Em_Andamento';
    if (realizadas >= meta.quantidade_prevista) {
      statusMeta = realizadas > meta.quantidade_prevista ? 'Excedido' : 'Concluido';
    } else if (planoEncerradoOuProximo || realizadas === 0) {
      statusMeta = 'Pendente';
      pendenciasAlertas.push(
        `${formatarNomeEspecialidade(meta.especialidade)}: ${realizadas} de ${meta.quantidade_prevista} visita(s) realizada(s) (${restante} pendente${restante > 1 ? 's' : ''})`
      );
    } else {
      statusMeta = 'Em_Andamento';
    }

    return {
      ...meta,
      especialidade: meta.especialidade,
      quantidade_realizada: realizadas,
      quantidade_restante: restante,
      status_meta: statusMeta,
    };
  });

  return {
    ...plano,
    metas: metasEnriquecidas,
    total_previsto: totalPrevisto,
    total_realizado: totalRealizado,
    total_restante: Math.max(0, totalPrevisto - totalRealizado),
    tem_pendencias: pendenciasAlertas.length > 0,
    pendencias_alertas: pendenciasAlertas,
  };
}

export async function salvarPlanoTerapeutico(dados: {
  id?: string;
  paciente_id: string;
  data_inicio: string;
  data_fim: string;
  status?: 'Ativo' | 'Concluido' | 'Cancelado';
  observacoes?: string;
  metas: Array<{
    id?: string;
    especialidade: string;
    quantidade_prevista: number;
    profissionais_designados?: ProfissionalDesignado[];
  }>;
}): Promise<PlanoTerapeutico> {
  seedClinicalMemory();
  const db = getClinicalDb();
  if (db) await garantirSchemaD1(db);

  // Assegura que o paciente existe no D1 para a foreign key
  await obterPacienteClinico(dados.paciente_id);

  const planoId = dados.id || novoId('pln');
  const now = agoraIso();

  const novoPlano: PlanoTerapeutico = {
    id: planoId,
    paciente_id: dados.paciente_id,
    data_inicio: dados.data_inicio,
    data_fim: dados.data_fim,
    status: dados.status || 'Ativo',
    observacoes: dados.observacoes || '',
    created_at: now,
    updated_at: now,
    metas: dados.metas.map((m) => ({
      id: m.id || novoId('meta'),
      plano_id: planoId,
      especialidade: m.especialidade,
      quantidade_prevista: Number(m.quantidade_prevista) || 1,
      profissionais_designados: m.profissionais_designados || [],
      created_at: now,
    })),
  };

  if (db) {
    try {
      const statements = [db.prepare(`
        INSERT INTO planos_terapeuticos (id, paciente_id, data_inicio, data_fim, status, observacoes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          data_inicio = excluded.data_inicio,
          data_fim = excluded.data_fim,
          status = excluded.status,
          observacoes = excluded.observacoes,
          updated_at = excluded.updated_at
      `).bind(
        novoPlano.id,
        novoPlano.paciente_id,
        novoPlano.data_inicio,
        novoPlano.data_fim,
        novoPlano.status,
        novoPlano.observacoes,
        novoPlano.created_at,
        novoPlano.updated_at
      ), db.prepare('DELETE FROM plano_terapeutico_metas WHERE plano_id = ?').bind(planoId)];

      for (const meta of novoPlano.metas || []) {
        statements.push(db.prepare(`
          INSERT INTO plano_terapeutico_metas (id, plano_id, especialidade, quantidade_prevista, profissionais_designados, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(
          meta.id,
          meta.plano_id,
          meta.especialidade,
          meta.quantidade_prevista,
          JSON.stringify(meta.profissionais_designados || []),
          meta.created_at
        ));
      }
      await db.batch(statements);
    } catch (e) {
      console.error('Erro ao salvar plano no D1:', e);
      throw e;
    }
  }

  inMemoryPlanosTerapeuticos.set(planoId, novoPlano);
  for (const m of novoPlano.metas || []) {
    inMemoryPlanoMetas.set(m.id, m);
  }

  const evolucoes = await listarEvolucoesClinicas({ paciente_id: dados.paciente_id });
  return enriquecerPlanoComCalculos(novoPlano, evolucoes);
}

export async function listarPlanosTerapeuticosPorPaciente(pacienteId: string): Promise<PlanoTerapeutico[]> {
  seedClinicalMemory();
  const db = getClinicalDb();
  if (db) {
    await garantirSchemaD1(db);
    // Uma ida ao D1: antes eram 1 (planos) + 1 por plano (metas) + 1 (evoluções),
    // todas em sequência.
    const [rPlanos, rMetas, rEvolucoes] = await db.batch<any>([
      db.prepare('SELECT * FROM planos_terapeuticos WHERE paciente_id = ? ORDER BY data_inicio DESC').bind(pacienteId),
      db.prepare(
        'SELECT m.* FROM plano_terapeutico_metas m JOIN planos_terapeuticos p ON p.id = m.plano_id WHERE p.paciente_id = ? ORDER BY m.rowid'
      ).bind(pacienteId),
      db.prepare('SELECT * FROM evolucoes WHERE paciente_id = ? ORDER BY check_in DESC').bind(pacienteId),
    ]);
    const planos = montarPlanos(rPlanos.results || [], rMetas.results || []);
    const evolucoes = (rEvolucoes.results || []).map(mapearEvolucaoRow);
    return planos.map((plano) => enriquecerPlanoComCalculos(plano, evolucoes));
  }

  const planos = Array.from(inMemoryPlanosTerapeuticos.values()).filter((p) => p.paciente_id === pacienteId);

  // Buscar evoluções para cálculo de progresso
  const evolucoes = await listarEvolucoesClinicas({ paciente_id: pacienteId });
  return planos.map((plano) => enriquecerPlanoComCalculos(plano, evolucoes));
}

/** Agrupa as metas (já em ordem de inserção) nos planos, preservando a ordem dos planos. */
function montarPlanos(planoRows: any[], metaRows: any[]): PlanoTerapeutico[] {
  const metasPorPlano = new Map<string, MetaPlanoTerapeutico[]>();
  for (const m of metaRows) {
    const meta = mapearMetaRow(m);
    const lista = metasPorPlano.get(meta.plano_id);
    if (lista) lista.push(meta);
    else metasPorPlano.set(meta.plano_id, [meta]);
  }
  return planoRows.map((row) => mapearPlanoRow(row, metasPorPlano.get(row.id) || []));
}

export async function obterPlanoTerapeuticoVigente(pacienteId: string, dataIso?: string): Promise<PlanoTerapeutico | null> {
  const planos = await listarPlanosTerapeuticosPorPaciente(pacienteId);
  return selecionarPlanoVigente(planos, dataIso);
}

/**
 * Primeiro plano `Ativo` (na ordem recebida — `data_inicio DESC`) cuja vigência
 * cobre a data de referência (UTC, YYYY-MM-DD).
 */
export function selecionarPlanoVigente(planos: PlanoTerapeutico[], dataIso?: string): PlanoTerapeutico | null {
  if (planos.length === 0) return null;
  const dataRef = (dataIso || new Date().toISOString()).split('T')[0]; // YYYY-MM-DD
  return planos.find((p) => p.status === 'Ativo' && dataRef >= p.data_inicio && dataRef <= p.data_fim) || null;
}

export async function validarCheckInPlanoTerapeutico(params: {
  pacienteId: string;
  tipoProfissional: string;
  checkIn?: string;
  cooperadoId?: string;
}): Promise<{
  permitido: boolean;
  motivo?: string;
  cotaAtingida?: boolean;
  plano?: PlanoTerapeutico;
  meta?: MetaPlanoTerapeutico;
  realizadas?: number;
  previstas?: number;
}> {
  const { pacienteId, tipoProfissional, checkIn, cooperadoId } = params;
  const plano = await obterPlanoTerapeuticoVigente(pacienteId, checkIn);

  // Se o paciente não tiver plano terapêutico cadastrado, verifica cota mensal legada
  if (!plano || !plano.metas || plano.metas.length === 0) {
    if (!plano && (await listarPlanosTerapeuticosPorPaciente(pacienteId)).length > 0) {
      return { permitido: false, motivo: 'Não existe plano terapêutico ativo para a data deste atendimento.' };
    }
    const cotaLegada = await obterCotaVisitasPaciente(pacienteId);
    if (cotaLegada.limite_visitas_mes > 0 && cotaLegada.visitas_realizadas_mes >= cotaLegada.limite_visitas_mes) {
      return {
        permitido: false,
        cotaAtingida: true,
        motivo: `Limite mensal de ${cotaLegada.limite_visitas_mes} visitas atingido para este paciente (${cotaLegada.visitas_realizadas_mes}/${cotaLegada.limite_visitas_mes}). Visita bloqueada pela gestão.`,
        realizadas: cotaLegada.visitas_realizadas_mes,
        previstas: cotaLegada.limite_visitas_mes,
      };
    }
    return { permitido: true };
  }

  const espNormalizada = normalizarEspecialidade(tipoProfissional);
  const meta = plano.metas.find((m) => normalizarEspecialidade(m.especialidade) === espNormalizada);

  // 1. Especialidade não está contemplada no plano
  if (!meta) {
    return {
      permitido: false,
      cotaAtingida: false,
      motivo: `A especialidade "${formatarNomeEspecialidade(tipoProfissional)}" não está contemplada no Plano Terapêutico vigente deste paciente.`,
      plano,
    };
  }

  // 2. Validação de Cooperado Designado (se houver restrição específica de cooperados escalados)
  if (cooperadoId && meta.profissionais_designados && meta.profissionais_designados.length > 0) {
    const cooperadoAutorizado = meta.profissionais_designados.some((p) => p.id === cooperadoId);
    if (!cooperadoAutorizado) {
      const nomes = meta.profissionais_designados.map((p) => p.nome).join(', ');
      return {
        permitido: false,
        cotaAtingida: false,
        motivo: `Você não está escalado no Plano Terapêutico deste paciente para ${formatarNomeEspecialidade(tipoProfissional)}. Profissionais designados: ${nomes}.`,
        plano,
        meta,
      };
    }
  }

  // 3. Validação Estrita de Cota da Especialidade (Ex: 5 atendimentos atingidos)
  const realizadas = meta.quantidade_realizada || 0;
  const previstas = meta.quantidade_prevista;

  if (realizadas >= previstas) {
    return {
      permitido: false,
      cotaAtingida: true,
      motivo: `Limite atingido: O Plano Terapêutico deste paciente prevê ${previstas} atendimento(s) de ${formatarNomeEspecialidade(meta.especialidade)} e todos já foram realizados (${realizadas}/${previstas}). Novos atendimentos desta especialidade estão bloqueados pela gestão.`,
      plano,
      meta,
      realizadas,
      previstas,
    };
  }

  return {
    permitido: true,
    plano,
    meta,
    realizadas,
    previstas,
  };
}

// -------------------------------------------------------------
// Consultas agregadas ("RPC") do módulo de prontuários
//
// O D1 não tem stored procedures; o equivalente a uma RPC aqui é UMA chamada
// `db.batch([...])`: várias instruções, um único round trip ao banco, executadas
// em transação implícita (leitura consistente). As funções abaixo substituem os
// laços que faziam uma consulta por paciente/plano (N+1) nas telas do gestor.
// -------------------------------------------------------------

export interface FiltrosListagemPacientes {
  status?: string;
  complexidade?: string;
  busca?: string;
  page?: number;
  limit?: number;
}

export interface ResumoPacientesClinicos {
  /** Pacientes do D1 com contadores clínicos (prescrições, última evolução, cota do mês, último sinal). */
  pacientes: PacienteClinico[];
  /** Plano vigente hoje, já com progresso calculado, indexado por `paciente_id`. */
  planosVigentes: Map<string, PlanoTerapeutico>;
  /** Total de pacientes que atendem aos filtros. */
  total?: number;
  /** Página atual quando paginado. */
  page?: number;
  /** Limite de itens por página quando paginado. */
  limit?: number;
  /** Total de páginas disponíveis quando paginado. */
  totalPages?: number;
}

function aplicarCotaMensal(p: PacienteClinico, realizadasNoMes: number): void {
  p.visitas_realizadas_mes = realizadasNoMes;
  const limite = p.limite_visitas_mes || 0;
  p.visitas_restantes_mes = limite > 0 ? Math.max(0, limite - realizadasNoMes) : undefined;
  p.limite_atingido = limite > 0 ? realizadasNoMes >= limite : false;
}

/**
 * Listagem de pacientes do painel de prontuários em UMA ida ao D1.
 *
 * Suporta filtros por status, complexidade, busca textual e paginação escalável.
 * Quando paginado, todas as 8 subconsultas são estritamente delimitadas aos pacientes
 * da página selecionada via subconsulta indexada.
 * A contagem de prescrições ativas usa subconsulta correlacionada com covering index
 * `idx_prescricoes_paciente_status`, eliminando agregação sobre a tabela inteira.
 */
export async function listarPacientesComResumoClinico(
  filtro: FiltrosListagemPacientes = {},
  opcoes: { db?: D1Database } = {},
): Promise<ResumoPacientesClinicos> {
  seedClinicalMemory();
  const db = opcoes.db ?? getClinicalDb();

  if (!db) {
    // Dev local sem D1: dados em memória, o custo por paciente é desprezível.
    let pacientes = await listarPacientesClinicos(filtro);
    if (filtro.busca && filtro.busca.trim()) {
      const bLower = filtro.busca.trim().toLowerCase();
      pacientes = pacientes.filter(
        (p) =>
          (p.nome && p.nome.toLowerCase().includes(bLower)) ||
          (p.cpf && p.cpf.includes(bLower)) ||
          (p.diagnostico_principal && p.diagnostico_principal.toLowerCase().includes(bLower)) ||
          (p.endereco && p.endereco.toLowerCase().includes(bLower))
      );
    }
    const total = pacientes.length;
    const paginar = typeof filtro.limit === 'number' && filtro.limit > 0;
    const limit = paginar ? Math.max(1, Math.floor(filtro.limit!)) : total;
    const page = paginar ? Math.max(1, Math.floor(filtro.page || 1)) : 1;
    const totalPages = paginar ? Math.max(1, Math.ceil(total / limit)) : 1;

    if (paginar) {
      const offset = (page - 1) * limit;
      pacientes = pacientes.slice(offset, offset + limit);
    }

    const ids = new Set<string>([
      ...pacientes.map((p) => p.id),
      ...Array.from(inMemoryPlanosTerapeuticos.values()).map((p) => p.paciente_id),
    ]);
    const planosVigentes = new Map<string, PlanoTerapeutico>();
    for (const id of Array.from(ids)) {
      try {
        const plano = await obterPlanoTerapeuticoVigente(id);
        if (plano) planosVigentes.set(id, plano);
      } catch {
        // mesmo comportamento da rota antiga: falha no plano não derruba a listagem
      }
    }
    return {
      pacientes,
      planosVigentes,
      total,
      page,
      limit,
      totalPages,
    };
  }

  await garantirSchemaD1(db);

  const hoje = new Date().toISOString().split('T')[0];
  const mes = hoje.slice(0, 7);
  const mesSeguinte = mesSeguinteIso(mes);

  // Prefixo `pac.`: o mesmo filtro é reaproveitado nas consultas que juntam
  // pacientes com evoluções/sinais (`status` também existe em `evolucoes`).
  let filtroPacientes = '1=1';
  const paramsPacientes: unknown[] = [];
  if (filtro.status) {
    filtroPacientes += ' AND pac.status = ?';
    paramsPacientes.push(filtro.status);
  }
  if (filtro.complexidade) {
    filtroPacientes += ' AND pac.complexidade = ?';
    paramsPacientes.push(filtro.complexidade);
  }
  if (filtro.busca && filtro.busca.trim()) {
    const b = `%${filtro.busca.trim().toLowerCase()}%`;
    filtroPacientes += ' AND (LOWER(pac.nome) LIKE ? OR pac.cpf LIKE ? OR LOWER(pac.diagnostico_principal) LIKE ? OR LOWER(pac.endereco) LIKE ?)';
    paramsPacientes.push(b, b, b, b);
  }

  const paginar = typeof filtro.limit === 'number' && filtro.limit > 0;
  const limit = paginar ? Math.max(1, Math.floor(filtro.limit!)) : undefined;
  const page = paginar ? Math.max(1, Math.floor(filtro.page || 1)) : 1;
  const offset = paginar ? (page - 1) * limit! : 0;

  // Subconsulta para delimitar a página de pacientes com desempate determinístico por ID
  const subqueryPacientes = `SELECT pac_sub.id FROM pacientes pac_sub WHERE ${filtroPacientes.replace(/\bpac\./g, 'pac_sub.')} ORDER BY pac_sub.nome COLLATE NOCASE ASC, pac_sub.id ASC` +
    (paginar ? ' LIMIT ? OFFSET ?' : '');
  const paramsSubquery = paginar ? [...paramsPacientes, limit, offset] : [...paramsPacientes];

  const filtroPlanoVigente = "p.status = 'Ativo' AND p.data_inicio <= ? AND p.data_fim >= ?";

  // Última evolução e último sinal: um *seek* por paciente listado, pelo índice
  // (paciente_id, check_in DESC) / (paciente_id, data_hora DESC).
  // Prescrições ativas: seek por paciente através do covering index
  // `idx_prescricoes_paciente_status (paciente_id, status)`.
  const batchStatements: any[] = [
    paginar
      ? db.prepare(`SELECT pac.* FROM pacientes pac WHERE pac.id IN (${subqueryPacientes}) ORDER BY pac.nome COLLATE NOCASE ASC, pac.id ASC`).bind(...paramsSubquery)
      : db.prepare(`SELECT pac.* FROM pacientes pac WHERE ${filtroPacientes} ORDER BY pac.nome COLLATE NOCASE ASC, pac.id ASC`).bind(...paramsPacientes),

    paginar
      ? db.prepare(
          `SELECT pac.id AS paciente_id, (
            SELECT COUNT(*) FROM prescricoes pr WHERE pr.paciente_id = pac.id AND pr.status = 'Ativa'
          ) AS total FROM pacientes pac WHERE pac.id IN (${subqueryPacientes})`
        ).bind(...paramsSubquery)
      : db.prepare(
          `SELECT pac.id AS paciente_id, (
            SELECT COUNT(*) FROM prescricoes pr WHERE pr.paciente_id = pac.id AND pr.status = 'Ativa'
          ) AS total FROM pacientes pac WHERE ${filtroPacientes}`
        ).bind(...paramsPacientes),

    paginar
      ? db.prepare(
          'SELECT pac.id AS paciente_id, e.check_in, e.profissional_nome FROM pacientes pac ' +
            'JOIN evolucoes e ON e.rowid = (' +
              'SELECT e2.rowid FROM evolucoes e2 WHERE e2.paciente_id = pac.id AND e2.check_in IS NOT NULL ' +
              'ORDER BY e2.check_in DESC, e2.rowid ASC LIMIT 1' +
            `) WHERE pac.id IN (${subqueryPacientes})`
        ).bind(...paramsSubquery)
      : db.prepare(
          'SELECT pac.id AS paciente_id, e.check_in, e.profissional_nome FROM pacientes pac ' +
            'JOIN evolucoes e ON e.rowid = (' +
              'SELECT e2.rowid FROM evolucoes e2 WHERE e2.paciente_id = pac.id AND e2.check_in IS NOT NULL ' +
              'ORDER BY e2.check_in DESC, e2.rowid ASC LIMIT 1' +
            `) WHERE ${filtroPacientes}`
        ).bind(...paramsPacientes),

    paginar
      ? db.prepare(
          `SELECT paciente_id, COUNT(*) AS total FROM evolucoes WHERE paciente_id IN (${subqueryPacientes}) AND check_in >= ? AND check_in < ? GROUP BY paciente_id`
        ).bind(...paramsSubquery, mes, mesSeguinte)
      : db.prepare(
          'SELECT paciente_id, COUNT(*) AS total FROM evolucoes WHERE check_in >= ? AND check_in < ? GROUP BY paciente_id'
        ).bind(mes, mesSeguinte),

    paginar
      ? db.prepare(
          'SELECT sv.* FROM pacientes pac ' +
            'JOIN sinais_vitais sv ON sv.rowid = (' +
              'SELECT s2.rowid FROM sinais_vitais s2 WHERE s2.paciente_id = pac.id ' +
              'ORDER BY s2.data_hora DESC, s2.rowid ASC LIMIT 1' +
            `) WHERE pac.id IN (${subqueryPacientes})`
        ).bind(...paramsSubquery)
      : db.prepare(
          'SELECT sv.* FROM pacientes pac ' +
            'JOIN sinais_vitais sv ON sv.rowid = (' +
              'SELECT s2.rowid FROM sinais_vitais s2 WHERE s2.paciente_id = pac.id ' +
              'ORDER BY s2.data_hora DESC, s2.rowid ASC LIMIT 1' +
            `) WHERE ${filtroPacientes}`
        ).bind(...paramsPacientes),

    paginar
      ? db.prepare(
          `SELECT p.* FROM planos_terapeuticos p WHERE p.paciente_id IN (${subqueryPacientes}) AND ${filtroPlanoVigente} ORDER BY p.paciente_id, p.data_inicio DESC`
        ).bind(...paramsSubquery, hoje, hoje)
      : db.prepare(
          `SELECT p.* FROM planos_terapeuticos p WHERE ${filtroPlanoVigente} ORDER BY p.paciente_id, p.data_inicio DESC`
        ).bind(hoje, hoje),

    paginar
      ? db.prepare(
          `SELECT m.* FROM plano_terapeutico_metas m JOIN planos_terapeuticos p ON p.id = m.plano_id WHERE p.paciente_id IN (${subqueryPacientes}) AND ${filtroPlanoVigente} ORDER BY m.rowid`
        ).bind(...paramsSubquery, hoje, hoje)
      : db.prepare(
          `SELECT m.* FROM plano_terapeutico_metas m JOIN planos_terapeuticos p ON p.id = m.plano_id WHERE ${filtroPlanoVigente} ORDER BY m.rowid`
        ).bind(hoje, hoje),

    paginar
      ? db.prepare(
          'SELECT p.id AS plano_id, e.tipo_profissional AS tipo_profissional, COUNT(*) AS total ' +
          'FROM planos_terapeuticos p JOIN evolucoes e ON e.paciente_id = p.paciente_id ' +
          "AND e.check_in >= (p.data_inicio || 'T00:00:00.000Z') AND e.check_in <= (p.data_fim || 'T23:59:59.999Z') " +
          `WHERE p.paciente_id IN (${subqueryPacientes}) AND ${filtroPlanoVigente} GROUP BY p.id, e.tipo_profissional`
        ).bind(...paramsSubquery, hoje, hoje)
      : db.prepare(
          'SELECT p.id AS plano_id, e.tipo_profissional AS tipo_profissional, COUNT(*) AS total ' +
          'FROM planos_terapeuticos p JOIN evolucoes e ON e.paciente_id = p.paciente_id ' +
          "AND e.check_in >= (p.data_inicio || 'T00:00:00.000Z') AND e.check_in <= (p.data_fim || 'T23:59:59.999Z') " +
          `WHERE ${filtroPlanoVigente} GROUP BY p.id, e.tipo_profissional`
        ).bind(hoje, hoje),
  ];

  if (paginar) {
    batchStatements.push(
      db.prepare(`SELECT COUNT(*) AS total FROM pacientes pac WHERE ${filtroPacientes}`).bind(...paramsPacientes)
    );
  }

  const batchResults = await db.batch<any>(batchStatements);
  const rPac = batchResults[0];
  const rPresc = batchResults[1];
  const rUltEvo = batchResults[2];
  const rVisitas = batchResults[3];
  const rSinal = batchResults[4];
  const rPlanos = batchResults[5];
  const rMetas = batchResults[6];
  const rContagem = batchResults[7];
  const rTotal = paginar ? batchResults[8] : null;

  const porPaciente = <T>(rows: any[] | undefined, valor: (r: any) => T) =>
    new Map<string, T>((rows || []).map((r) => [r.paciente_id, valor(r)]));

  const prescricoesAtivas = porPaciente(rPresc?.results, (r) => Number(r.total || 0));
  const ultimaEvolucao = porPaciente(rUltEvo?.results, (r) => r);
  const visitasMes = porPaciente(rVisitas?.results, (r) => Number(r.total || 0));
  const ultimoSinal = porPaciente(rSinal?.results, (r) => ({ ...r }) as SinalVitalClinico);

  const pacientes = (rPac?.results || []).map(mapearPacienteRow);
  for (const p of pacientes) {
    p.total_prescricoes_ativas = prescricoesAtivas.get(p.id) || 0;
    const ult = ultimaEvolucao.get(p.id);
    if (ult) {
      p.ultima_evolucao_data = ult.check_in;
      p.ultimo_profissional_nome = ult.profissional_nome || '';
    }
    aplicarCotaMensal(p, visitasMes.get(p.id) || 0);
    p.ultimo_sinal_vital = ultimoSinal.get(p.id) || null;
  }

  const contagemPorPlano = new Map<string, Map<string, number>>();
  for (const r of rContagem?.results || []) {
    const esp = normalizarEspecialidade(r.tipo_profissional || '');
    let mapa = contagemPorPlano.get(r.plano_id);
    if (!mapa) {
      mapa = new Map();
      contagemPorPlano.set(r.plano_id, mapa);
    }
    mapa.set(esp, (mapa.get(esp) || 0) + Number(r.total || 0));
  }

  const planosVigentes = new Map<string, PlanoTerapeutico>();
  for (const plano of montarPlanos(rPlanos?.results || [], rMetas?.results || [])) {
    if (planosVigentes.has(plano.paciente_id)) continue;
    const contagem = contagemPorPlano.get(plano.id);
    planosVigentes.set(plano.paciente_id, calcularProgressoPlano(plano, (esp) => contagem?.get(esp) || 0));
  }

  const total = paginar ? Number(rTotal?.results?.[0]?.total || 0) : pacientes.length;
  const totalPages = paginar ? Math.max(1, Math.ceil(total / limit!)) : 1;

  return {
    pacientes,
    planosVigentes,
    total,
    page: paginar ? page : 1,
    limit: paginar ? limit! : pacientes.length,
    totalPages,
  };
}

export interface Prontuario360 {
  paciente: PacienteClinico;
  evolucoes: EvolucaoClinica[];
  prescricoes: PrescricaoClinica[];
  sinaisVitais: SinalVitalClinico[];
  pareceres: ParecerAuditoriaClinica[];
  planos: PlanoTerapeutico[];
  planoVigente: PlanoTerapeutico | null;
}

/**
 * Prontuário 360° de um paciente em UMA ida ao D1.
 *
 * A tela de detalhe disparava 6 requisições HTTP (paciente, dashboard, planos,
 * prescrições, sinais, pareceres) que, somadas, faziam ~20 consultas ao D1 — a
 * maioria repetida (evoluções eram lidas 5 vezes). Aqui são 7 instruções num
 * único `batch`, e progresso do plano e cota mensal saem das mesmas evoluções.
 *
 * Retorna `null` quando o paciente não existe nem no D1, nem na memória, nem no
 * Bubble (o auto-provisionamento continua a cargo de `obterPacienteClinico`).
 */
export async function carregarProntuario360(
  pacienteId: string,
  opcoes: { db?: D1Database; limiteSinais?: number } = {},
): Promise<Prontuario360 | null> {
  seedClinicalMemory();
  const db = opcoes.db ?? getClinicalDb();
  const limiteSinais = opcoes.limiteSinais ?? 100;

  if (!db) {
    const paciente = await obterPacienteClinico(pacienteId);
    if (!paciente) return null;
    const [evolucoes, prescricoes, sinaisVitais, pareceres, planos] = await Promise.all([
      listarEvolucoesClinicas({ paciente_id: pacienteId }),
      listarPrescricoesClinicas(pacienteId, false),
      listarSinaisVitaisClinicos(pacienteId, limiteSinais),
      listarPareceresClinicos(pacienteId),
      listarPlanosTerapeuticosPorPaciente(pacienteId),
    ]);
    return { paciente, evolucoes, prescricoes, sinaisVitais, pareceres, planos, planoVigente: selecionarPlanoVigente(planos) };
  }

  await garantirSchemaD1(db);

  const [rPac, rEvo, rPresc, rSinais, rPar, rPlanos, rMetas] = await db.batch<any>([
    db.prepare('SELECT * FROM pacientes WHERE id = ?').bind(pacienteId),
    db.prepare(
      `SELECT ${COLUNAS_EVOLUCAO_COM_PACIENTE} FROM evolucoes e LEFT JOIN pacientes pac ON pac.id = e.paciente_id WHERE e.paciente_id = ? ORDER BY e.check_in DESC`
    ).bind(pacienteId),
    db.prepare('SELECT * FROM prescricoes WHERE paciente_id = ? ORDER BY created_at DESC').bind(pacienteId),
    db.prepare('SELECT * FROM sinais_vitais WHERE paciente_id = ? ORDER BY data_hora DESC LIMIT ?').bind(pacienteId, limiteSinais),
    db.prepare('SELECT * FROM pareceres_auditoria WHERE paciente_id = ? ORDER BY data_registro DESC').bind(pacienteId),
    db.prepare('SELECT * FROM planos_terapeuticos WHERE paciente_id = ? ORDER BY data_inicio DESC').bind(pacienteId),
    db.prepare(
      'SELECT m.* FROM plano_terapeutico_metas m JOIN planos_terapeuticos p ON p.id = m.plano_id WHERE p.paciente_id = ? ORDER BY m.rowid'
    ).bind(pacienteId),
  ]);

  const evolucoes = (rEvo.results || []).map(mapearEvolucaoRow);

  let paciente: PacienteClinico | null = rPac.results?.[0] ? mapearPacienteRow(rPac.results[0]) : null;
  if (!paciente) {
    // Ainda não está no D1: memória do isolate ou auto-provisionamento pelo Bubble.
    // Um paciente recém-provisionado não tem registros clínicos, então as listas
    // vazias do batch continuam corretas.
    paciente = await obterPacienteClinico(pacienteId);
    if (!paciente) return null;
  }
  const mesAtualIso = new Date().toISOString().slice(0, 7);
  aplicarCotaMensal(paciente, evolucoes.filter((ev) => ev.check_in && ev.check_in.startsWith(mesAtualIso)).length);

  const planos = montarPlanos(rPlanos.results || [], rMetas.results || []).map((plano) =>
    enriquecerPlanoComCalculos(plano, evolucoes)
  );

  return {
    paciente,
    evolucoes,
    prescricoes: (rPresc.results || []).map(mapearPrescricaoRow),
    sinaisVitais: (rSinais.results || []) as SinalVitalClinico[],
    pareceres: (rPar.results || []) as ParecerAuditoriaClinica[],
    planos,
    planoVigente: selecionarPlanoVigente(planos),
  };
}

// -------------------------------------------------------------
// Auditoria e Reconciliação de Medicamentos (Fase 2)
// -------------------------------------------------------------

export type TipoDesvioAuditoria = 'Atraso' | 'Omissao_Com_Justificativa' | 'Pendente_Atrasado' | 'Conforme';

export interface AprazamentoAuditoria {
  id: string;
  prescricao_id: string;
  paciente_id: string;
  paciente_nome: string;
  paciente_cpf?: string;
  profissional_id?: string;
  profissional_nome: string;
  medicamento: string;
  dosagem: string;
  via_administracao: string;
  horario_previsto: string;
  horario_executado?: string;
  status: 'Pendente' | 'Administrado' | 'Nao_Administrado' | string;
  justificativa?: string;
  tipoDesvio: TipoDesvioAuditoria;
  detalheDesvio: string;
  // Aliases compatíveis com camelCase da tela
  pacienteNome: string;
  profissionalNome: string;
  horarioPrevisto: string;
  horarioExecutado?: string;
}

export interface FiltrosAuditoria {
  paciente_id?: string;
  data_inicio?: string;
  data_fim?: string;
  status?: string;
  limit?: number;
}

/**
 * Calcula o tipo e detalhe do desvio clínico de um aprazamento em relação ao horário previsto.
 */
export function calcularDesvioAprazamento(
  a: {
    horario_previsto: string;
    horario_executado?: string | null;
    status: string;
    justificativa?: string | null;
  },
  agoraMs = Date.now()
): { tipoDesvio: TipoDesvioAuditoria; detalheDesvio: string } {
  const prev = new Date(a.horario_previsto).getTime();
  const exec = a.horario_executado ? new Date(a.horario_executado).getTime() : null;

  let tipoDesvio: TipoDesvioAuditoria = 'Conforme';
  let detalheDesvio = 'Administrado dentro da janela regulamentar';

  if (a.status === 'Nao_Administrado') {
    tipoDesvio = 'Omissao_Com_Justificativa';
    detalheDesvio = a.justificativa || 'Omissão justificada pelo técnico';
  } else if (a.status === 'Pendente') {
    const umaHoraEmMs = 60 * 60 * 1000;
    if (agoraMs - prev > umaHoraEmMs) {
      tipoDesvio = 'Pendente_Atrasado';
      detalheDesvio = 'Medicamento atrasado sem checagem realizada';
    } else {
      tipoDesvio = 'Conforme';
      detalheDesvio = 'Dentro da janela programada (pendente de administração)';
    }
  } else if (a.status === 'Administrado' && exec) {
    const diffMinutos = Math.round((exec - prev) / 60000);
    if (Math.abs(diffMinutos) > 60) {
      tipoDesvio = 'Atraso';
      detalheDesvio =
        diffMinutos > 0
          ? `Atraso de ${Math.floor(diffMinutos / 60)}h ${diffMinutos % 60}m`
          : `Adiantamento de ${Math.floor(Math.abs(diffMinutos) / 60)}h ${Math.abs(diffMinutos) % 60}m`;
    }
  }

  return { tipoDesvio, detalheDesvio };
}

/**
 * Consulta direta `aprazamentos JOIN prescricoes LEFT JOIN pacientes` no D1
 * para reconciliação e auditoria de medicamentos, com 1 round-trip e total paridade.
 */
export async function listarAprazamentosParaAuditoria(filtros?: FiltrosAuditoria): Promise<AprazamentoAuditoria[]> {
  const db = getClinicalDb();
  if (db) {
    try {
      await garantirSchemaD1(db);
      const limit = Math.min(filtros?.limit && filtros.limit > 0 ? filtros.limit : 200, 1000);
      let sql = `
        SELECT
          ap.id,
          ap.prescricao_id,
          ap.horario_previsto,
          ap.horario_executado,
          ap.status,
          ap.justificativa,
          ap.profissional_id,
          ap.assinatura_digital,
          pr.paciente_id,
          pr.medicamento,
          pr.dosagem,
          pr.via_administracao,
          pac.nome AS paciente_nome,
          pac.cpf AS paciente_cpf,
          COALESCE(
            NULLIF(
              (SELECT ev.profissional_nome FROM evolucoes ev WHERE ev.profissional_id = ap.profissional_id AND ev.profissional_nome != '' LIMIT 1),
              ''
            ),
            'Equipe de Enfermagem'
          ) AS profissional_nome
        FROM aprazamentos ap
        JOIN prescricoes pr ON pr.id = ap.prescricao_id
        LEFT JOIN pacientes pac ON pac.id = pr.paciente_id
      `;
      const condicoes: string[] = [];
      const params: unknown[] = [];

      if (filtros?.paciente_id) {
        condicoes.push('pr.paciente_id = ?');
        params.push(filtros.paciente_id);
      }
      if (filtros?.status) {
        condicoes.push('ap.status = ?');
        params.push(filtros.status);
      }
      if (filtros?.data_inicio) {
        condicoes.push('ap.horario_previsto >= ?');
        params.push(filtros.data_inicio.includes('T') ? filtros.data_inicio : filtros.data_inicio + 'T00:00:00.000Z');
      }
      if (filtros?.data_fim) {
        condicoes.push('ap.horario_previsto <= ?');
        params.push(filtros.data_fim.includes('T') ? filtros.data_fim : filtros.data_fim + 'T23:59:59.999Z');
      }

      if (condicoes.length > 0) {
        sql += ` WHERE ${condicoes.join(' AND ')}`;
      }
      sql += ' ORDER BY ap.horario_previsto DESC LIMIT ?';
      params.push(limit);

      const rows = (await db.prepare(sql).bind(...params).all<any>()).results || [];
      return rows.map((r: any) => {
        const desvio = calcularDesvioAprazamento(r);
        return {
          id: r.id,
          prescricao_id: r.prescricao_id,
          paciente_id: r.paciente_id,
          paciente_nome: r.paciente_nome || 'Paciente',
          paciente_cpf: r.paciente_cpf || '',
          profissional_id: r.profissional_id || undefined,
          profissional_nome: r.profissional_nome || 'Equipe de Enfermagem',
          medicamento: r.medicamento,
          dosagem: r.dosagem,
          via_administracao: r.via_administracao,
          horario_previsto: r.horario_previsto,
          horario_executado: r.horario_executado || undefined,
          status: r.status,
          justificativa: r.justificativa || undefined,
          tipoDesvio: desvio.tipoDesvio,
          detalheDesvio: desvio.detalheDesvio,
          pacienteNome: r.paciente_nome || 'Paciente',
          profissionalNome: r.profissional_nome || 'Equipe de Enfermagem',
          horarioPrevisto: r.horario_previsto,
          horarioExecutado: r.horario_executado || undefined,
        };
      });
    } catch (e) {
      throw e;
    }
  }

  seedClinicalMemory();
  const aprazamentos = Array.from(inMemoryAprazamentos.values());
  const resultados: AprazamentoAuditoria[] = [];

  for (const ap of aprazamentos) {
    const prescricao = inMemoryPrescricoes.get(ap.prescricao_id);
    const pacienteId = prescricao?.paciente_id || ap.paciente_id;
    if (!pacienteId) continue;
    if (filtros?.paciente_id && pacienteId !== filtros.paciente_id) continue;
    if (filtros?.status && ap.status !== filtros.status) continue;
    if (filtros?.data_inicio) {
      const inicioIso = filtros.data_inicio.includes('T') ? filtros.data_inicio : filtros.data_inicio + 'T00:00:00.000Z';
      if (ap.horario_previsto < inicioIso) continue;
    }
    if (filtros?.data_fim) {
      const fimIso = filtros.data_fim.includes('T') ? filtros.data_fim : filtros.data_fim + 'T23:59:59.999Z';
      if (ap.horario_previsto > fimIso) continue;
    }

    const paciente = inMemoryPacientes.get(pacienteId);
    const desvio = calcularDesvioAprazamento(ap);
    const profissionalNome =
      ap.profissional_nome ||
      Array.from(inMemoryEvolucoes.values()).find((e) => e.profissional_id === ap.profissional_id)?.profissional_nome ||
      'Equipe de Enfermagem';

    resultados.push({
      id: ap.id,
      prescricao_id: ap.prescricao_id,
      paciente_id: pacienteId,
      paciente_nome: paciente?.nome || 'Paciente',
      paciente_cpf: paciente?.cpf || '',
      profissional_id: ap.profissional_id,
      profissional_nome: profissionalNome,
      medicamento: ap.medicamento || prescricao?.medicamento || 'Medicamento',
      dosagem: ap.dosagem || prescricao?.dosagem || '',
      via_administracao: ap.via_administracao || prescricao?.via_administracao || 'Oral',
      horario_previsto: ap.horario_previsto,
      horario_executado: ap.horario_executado,
      status: ap.status,
      justificativa: ap.justificativa,
      tipoDesvio: desvio.tipoDesvio,
      detalheDesvio: desvio.detalheDesvio,
      pacienteNome: paciente?.nome || 'Paciente',
      profissionalNome: profissionalNome,
      horarioPrevisto: ap.horario_previsto,
      horarioExecutado: ap.horario_executado,
    });
  }

  resultados.sort((a, b) => new Date(b.horario_previsto).getTime() - new Date(a.horario_previsto).getTime());
  const limit = Math.min(filtros?.limit && filtros.limit > 0 ? filtros.limit : 200, 1000);
  return resultados.slice(0, limit);
}
