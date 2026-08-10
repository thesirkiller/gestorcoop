/* eslint-disable */
// Client-side IndexedDB Wrapper for Offline Clinical Operations
export interface PacienteLocal {
  id: string;
  nome: string;
  cpf?: string;
  data_nascimento?: string;
  endereco?: string;
  warnings?: string[]; // Alergias, etc.
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
}

export interface AprazamentoLocal {
  id: string;
  prescricao_id: string;
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
    const { store } = await getStore('pacientes', 'readwrite');
    for (const p of pacientes) {
      store.put(p);
    }
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
    const { store } = await getStore('prescricoes', 'readwrite');
    for (const p of prescricoes) {
      store.put(p);
    }
  },

  async getPrescricoes(pacienteId?: string): Promise<PrescricaoLocal[]> {
    const { store } = await getStore('prescricoes', 'readonly');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const results = request.result || [];
        if (pacienteId) {
          resolve(results.filter((p) => p.paciente_id === pacienteId));
        } else {
          resolve(results);
        }
      };
      request.onerror = () => reject(request.error);
    });
  },

  // Aprazamentos
  async saveAprazamentos(aprazamentos: AprazamentoLocal[]): Promise<void> {
    const { store } = await getStore('aprazamentos', 'readwrite');
    for (const a of aprazamentos) {
      store.put(a);
    }
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
