/* eslint-disable */
// Client-side IndexedDB Wrapper for Offline Clinical Operations
export interface PacienteLocal {
  id: string;
  nome: string;
  cpf?: string;
  data_nascimento?: string;
  endereco?: string;
  warnings?: string[]; // Alergias, etc.
  limite_visitas_mes?: number;
  visitas_realizadas_mes?: number;
  visitas_restantes_mes?: number;
  limite_atingido?: boolean;
}

export interface PrescricaoLocal {
  id: string;
  paciente_id: string;
  medicamento: string;
  dosagem: string;
  via_administracao: string;
  frequencia_horas: number;
  data_inicio: string;
  data_fim: string;
  horarios_padrao?: string[] | string;
  instrucoes?: string;
  status?: string;
  medico_nome?: string;
  medico_crm?: string;
  created_at?: string;
}

export interface AprazamentoLocal {
  id: string;
  prescricao_id: string;
  paciente_id?: string;
  horario_previsto: string; // ISO Datetime
  horario_executado?: string; // ISO Datetime
  status: 'Pendente' | 'Administrado' | 'Nao_Administrado';
  justificativa?: string;
  profissional_id?: string;
  assinatura_digital?: string;
  // Detalhes extras clonados da prescrição para facilitar renderização offline
  medicamento?: string;
  dosagem?: string;
  via_administracao?: string;
}

export interface EvolucaoLocal {
  id: string;
  paciente_id: string;
  profissional_id: string;
  tipo_profissional: 'Tecnico_Enfermagem' | 'Medico' | 'Terapeuta';
  turno?: 'Diurno' | 'Noturno' | '24h';
  check_in: string; // ISO Datetime
  check_out: string; // ISO Datetime
  audio_url?: string;
  transcricao_crua?: string;
  transcricao_revisada?: string;
  status: 'Em_Andamento' | 'Assinado_Pendente_Sync' | 'Finalizado';
  data_assinatura?: string;
}

export interface SyncAction {
  id?: number;
  type: 'CHECK_IN' | 'CHECK_OUT' | 'CHECK_MEDICAMENTO' | 'EVOLUCAO_TEXTO' | 'SIGN_EVOLUCAO';
  payload: any;
  timestamp: string;
}

const DB_NAME = 'gestorcoop-local-db';
const DB_VERSION = 1;

export function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('IndexedDB is only available in the browser'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = request.result;

      if (!db.objectStoreNames.contains('pacientes')) {
        db.createObjectStore('pacientes', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('prescricoes')) {
        db.createObjectStore('prescricoes', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('aprazamentos')) {
        db.createObjectStore('aprazamentos', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('evolucoes')) {
        db.createObjectStore('evolucoes', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('fila_sync')) {
        db.createObjectStore('fila_sync', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('audios')) {
        db.createObjectStore('audios', { keyPath: 'id' });
      }
    };
  });
}

// Auxiliar genérico para transações
function getStore(storeName: string, mode: IDBTransactionMode = 'readonly'): Promise<{ store: IDBObjectStore, transaction: IDBTransaction }> {
  return initDB().then((db) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    return { store, transaction };
  });
}

export const localDB = {
  // Pacientes
  async savePacientes(pacientes: PacienteLocal[]): Promise<void> {
    const { store, transaction } = await getStore('pacientes', 'readwrite');
    for (const p of pacientes) {
      store.put(p);
    }
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  },

  async getPaciente(id: string): Promise<PacienteLocal | null> {
    const { store } = await getStore('pacientes', 'readonly');
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  },

  async getPacientes(): Promise<PacienteLocal[]> {
    const { store } = await getStore('pacientes', 'readonly');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  },

  // Prescrições
  async savePrescricoes(prescricoes: PrescricaoLocal[]): Promise<void> {
    const { store, transaction } = await getStore('prescricoes', 'readwrite');
    for (const p of prescricoes) {
      store.put(p);
    }
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  },

  async getPrescricoes(pacienteId?: string): Promise<PrescricaoLocal[]> {
    const { store } = await getStore('prescricoes', 'readonly');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const results = request.result || [];
        if (pacienteId) {
          const target = String(pacienteId).trim();
          resolve(results.filter((p) => String(p.paciente_id).trim() === target));
        } else {
          resolve(results);
        }
      };
      request.onerror = () => reject(request.error);
    });
  },

  // Aprazamentos
  async saveAprazamentos(aprazamentos: AprazamentoLocal[]): Promise<void> {
    if (!aprazamentos || aprazamentos.length === 0) return;
    const { store, transaction } = await getStore('aprazamentos', 'readwrite');
    const existingReq = store.getAll();
    return new Promise((resolve, reject) => {
      existingReq.onerror = () => reject(existingReq.error);
      existingReq.onsuccess = () => {
        const existingMap = new Map<string, AprazamentoLocal>();
        for (const item of (existingReq.result || []) as AprazamentoLocal[]) {
          if (item?.id) existingMap.set(item.id, item);
        }
        for (const a of aprazamentos) {
          if (!a?.id) continue;
          const existente = existingMap.get(a.id);
          if (existente && existente.status !== 'Pendente' && a.status === 'Pendente') {
            store.put({
              ...a,
              status: existente.status,
              horario_executado: existente.horario_executado,
              justificativa: existente.justificativa,
              profissional_id: existente.profissional_id,
              assinatura_digital: existente.assinatura_digital,
            });
          } else {
            store.put(a);
          }
        }
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  },

  async getAprazamento(id: string): Promise<AprazamentoLocal | null> {
    const { store } = await getStore('aprazamentos', 'readonly');
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  },

  async getAprazamentos(prescricaoId?: string): Promise<AprazamentoLocal[]> {
    const { store } = await getStore('aprazamentos', 'readonly');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const results = request.result || [];
        if (prescricaoId) {
          resolve(results.filter((a) => a.prescricao_id === prescricaoId));
        } else {
          resolve(results);
        }
      };
      request.onerror = () => reject(request.error);
    });
  },

  // Evoluções
  async saveEvolucao(evolucao: EvolucaoLocal): Promise<void> {
    const { store } = await getStore('evolucoes', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(evolucao);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  async getEvolucao(id: string): Promise<EvolucaoLocal | null> {
    const { store } = await getStore('evolucoes', 'readonly');
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  },

  async getEvolucoes(): Promise<EvolucaoLocal[]> {
    const { store } = await getStore('evolucoes', 'readonly');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  },

  // Fila de Sincronização (Sync Queue)
  async enqueueAction(type: SyncAction['type'], payload: any): Promise<number> {
    const { store } = await getStore('fila_sync', 'readwrite');
    const action: SyncAction = {
      type,
      payload,
      timestamp: new Date().toISOString()
    };
    return new Promise((resolve, reject) => {
      const request = store.add(action);
      request.onsuccess = () => resolve(request.result as number);
      request.onerror = () => reject(request.error);
    });
  },

  async getSyncQueue(): Promise<SyncAction[]> {
    const { store } = await getStore('fila_sync', 'readonly');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  },

  async dequeueAction(id: number): Promise<void> {
    const { store } = await getStore('fila_sync', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  // Áudios locais (salvos como Blobs)
  async saveAudio(id: string, audioBlob: Blob): Promise<void> {
    const { store } = await getStore('audios', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put({ id, audioBlob });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  async getAudio(id: string): Promise<Blob | null> {
    const { store } = await getStore('audios', 'readonly');
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result?.audioBlob || null);
      request.onerror = () => reject(request.error);
    });
  },

  async deleteAudio(id: string): Promise<void> {
    const { store } = await getStore('audios', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
};

/**
 * Gera slots de aprazamento locais para o cooperado checar medicações,
 * calculando os horários conforme a frequência e horários padrão.
 */
export function gerarSlotsAprazamentoLocal(prescricao: PrescricaoLocal): AprazamentoLocal[] {
  let horarios: string[] = [];
  if (Array.isArray(prescricao.horarios_padrao) && prescricao.horarios_padrao.length > 0) {
    horarios = prescricao.horarios_padrao;
  } else if (typeof prescricao.horarios_padrao === 'string' && prescricao.horarios_padrao.trim()) {
    try {
      const parsed = JSON.parse(prescricao.horarios_padrao);
      if (Array.isArray(parsed) && parsed.length > 0) horarios = parsed;
      else horarios = prescricao.horarios_padrao.split(/[,•]/).map((s) => s.trim()).filter(Boolean);
    } catch {
      horarios = prescricao.horarios_padrao.split(/[,•]/).map((s) => s.trim()).filter(Boolean);
    }
  }

  if (horarios.length === 0) {
    const freq = prescricao.frequencia_horas || 12;
    if (freq === 24) horarios = ['08:00'];
    else if (freq === 12) horarios = ['08:00', '20:00'];
    else if (freq === 8) horarios = ['08:00', '16:00', '00:00'];
    else if (freq === 6) horarios = ['06:00', '12:00', '18:00', '00:00'];
    else if (freq === 4) horarios = ['04:00', '08:00', '12:00', '16:00', '20:00', '00:00'];
    else horarios = ['08:00', '20:00'];
  }

  const parseData = (dStr?: string) => {
    if (!dStr || !dStr.trim()) return new Date();
    const s = dStr.trim();
    if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) {
      const [dia, mes, ano] = s.split('/');
      return new Date(`${ano}-${mes}-${dia}T00:00:00Z`);
    }
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? new Date() : d;
  };

  const inicio = parseData(prescricao.data_inicio);
  let fim = parseData(prescricao.data_fim);
  if (fim < inicio || Number.isNaN(fim.getTime())) {
    fim = new Date(inicio.getTime() + 30 * 86400000);
  }

  const slots: AprazamentoLocal[] = [];
  const dia = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth(), inicio.getUTCDate()));
  const ultimoDia = new Date(Date.UTC(fim.getUTCFullYear(), fim.getUTCMonth(), fim.getUTCDate()));

  const MAX_SLOTS = 400;
  while (dia <= ultimoDia && slots.length < MAX_SLOTS) {
    const dataIso = dia.toISOString().slice(0, 10);
    for (const h of horarios) {
      if (slots.length >= MAX_SLOTS) break;
      const [hora, min] = h.split(':');
      const instante = new Date(`${dataIso}T${hora || '08'}:${min || '00'}:00-03:00`);
      slots.push({
        id: `apraz_${prescricao.id}_${dataIso}_${(h || '0800').replace(':', '')}`,
        prescricao_id: prescricao.id,
        paciente_id: prescricao.paciente_id,
        horario_previsto: instante.toISOString(),
        status: 'Pendente',
        medicamento: prescricao.medicamento,
        dosagem: prescricao.dosagem,
        via_administracao: prescricao.via_administracao,
      });
    }
    dia.setUTCDate(dia.getUTCDate() + 1);
  }

  return slots;
}

