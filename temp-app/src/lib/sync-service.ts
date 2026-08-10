/* eslint-disable */
// Sync Service for Offline Queue Processing and Connectivity Monitoring
import { localDB, SyncAction } from './indexeddb';
import axios from 'axios';

export interface SyncStatus {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  lastSyncedAt: string | null;
  error: string | null;
}

type SyncListener = (status: SyncStatus) => void;

let listeners: Set<SyncListener> = new Set();
let isSyncing = false;
let lastSyncedAt: string | null = null;
let syncError: string | null = null;

function getNetworkStatus(): boolean {
  if (typeof window === 'undefined') return true;
  return navigator.onLine;
}

async function getPendingCount(): Promise<number> {
  try {
    const queue = await localDB.getSyncQueue();
    return queue.length;
  } catch {
    return 0;
  }
}

export function subscribeToSync(listener: SyncListener): () => void {
  listeners.add(listener);
  // Emit state immediately to the subscriber
  emitState();
  return () => {
    listeners.delete(listener);
  };
}

async function emitState() {
  const isOnline = getNetworkStatus();
  const pendingCount = await getPendingCount();
  const status: SyncStatus = {
    isOnline,
    pendingCount,
    isSyncing,
    lastSyncedAt,
    error: syncError
  };
  listeners.forEach((l) => l(status));
}

// Handler para sincronizar
export async function synchronizeQueue(): Promise<boolean> {
  if (isSyncing) return false;
  if (!getNetworkStatus()) {
    syncError = 'Sem conexão de internet no momento.';
    emitState();
    return false;
  }

  try {
    const queue = await localDB.getSyncQueue();
    if (queue.length === 0) {
      isSyncing = false;
      syncError = null;
      emitState();
      return true;
    }

    isSyncing = true;
    syncError = null;
    emitState();

    console.log(`Iniciando sincronização de ${queue.length} ações locais...`);

    // Enviar lote ao servidor
    const response = await axios.post('/api/cooperado/sync', { actions: queue });

    if (response.data.success) {
      // Remover com sucesso da fila local
      for (const action of queue) {
        if (action.id !== undefined) {
          await localDB.dequeueAction(action.id);
        }
      }
      lastSyncedAt = new Date().toISOString();
      syncError = null;
      console.log('Sincronização concluída com sucesso!');
    } else {
      throw new Error(response.data.error || 'Erro desconhecido no servidor durante a sincronização.');
    }
  } catch (err: any) {
    console.error('Erro de sincronização:', err);
    syncError = err.message || 'Falha ao sincronizar dados com o servidor.';
  } finally {
    isSyncing = false;
    emitState();
  }

  return syncError === null;
}

// Inicializar listeners de conectividade global (apenas no cliente)
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    emitState();
    // Tenta sincronizar automaticamente quando voltar a ficar online
    synchronizeQueue();
  });

  window.addEventListener('offline', () => {
    emitState();
  });

  // Tenta rodar a sincronização na inicialização caso já esteja online
  setTimeout(() => {
    if (navigator.onLine) {
      synchronizeQueue();
    }
  }, 1000);
}
