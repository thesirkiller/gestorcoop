/* eslint-disable */
// Sync Service for Offline Queue Processing and Connectivity Monitoring
import { localDB, SyncAction } from './indexeddb';
import {
  CHAVE_CACHE_LISTAGEM_PACIENTES,
  invalidarCacheNavegacao,
  invalidarCacheNavegacaoPorPrefixo,
} from './cache-navegacao';
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
let pendingResync = false;
let activeSyncPromise: Promise<boolean> | null = null;
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

async function executeSyncPass(): Promise<boolean> {
  if (!getNetworkStatus()) {
    syncError = 'Sem conexão de internet no momento.';
    await emitState();
    return false;
  }

  try {
    let queue = await localDB.getSyncQueue();
    if (queue.length === 0) {
      syncError = null;
      await emitState();
      return true;
    }

    // Limpa ações EVOLUCAO_TEXTO obsoletas quando a evolução já possui texto revisado ou já foi assinada
    const audioActions = queue.filter((action) => action.type === 'EVOLUCAO_TEXTO');
    if (audioActions.length > 0) {
      const localEvols = await localDB.getEvolucoes();
      const evolsMap = new Map(localEvols.map((e) => [e.id, e]));
      const signedIdsInQueue = new Set(
        queue
          .filter((a) => a.type === 'SIGN_EVOLUCAO')
          .map((a) => a.payload?.evolucaoId || a.payload?.id)
          .filter(Boolean)
      );
      let removedAny = false;
      for (const audioAct of audioActions) {
        const evId = audioAct.payload?.evolucaoId;
        const evLocal = evId ? evolsMap.get(evId) : undefined;
        const textoRevisado = (evLocal?.transcricao_revisada || '').trim();
        const jaRevisadoOuAssinado =
          signedIdsInQueue.has(evId) ||
          evLocal?.status === 'Assinado_Pendente_Sync' ||
          evLocal?.status === 'Finalizado' ||
          (textoRevisado.length > 0 && !textoRevisado.startsWith('[Áudio gravado offline'));

        if (jaRevisadoOuAssinado && audioAct.id !== undefined) {
          await localDB.dequeueAction(audioAct.id);
          removedAny = true;
        }
      }
      if (removedAny) {
        queue = await localDB.getSyncQueue();
      }
    }

    if (queue.length === 0) {
      syncError = null;
      await emitState();
      return true;
    }

    isSyncing = true;
    syncError = null;
    await emitState();

    console.log(`Iniciando sincronização de ${queue.length} ações locais...`);

    const pendenciaAudio = queue.findIndex((action) => action.type === 'EVOLUCAO_TEXTO');
    const actions = pendenciaAudio < 0 ? queue : queue.slice(0, pendenciaAudio);
    if (actions.length === 0) {
      throw new Error('Há um áudio pendente. Abra o atendimento e toque em Transcrever áudio.');
    }

    const response = await axios.post('/api/cooperado/sync', { actions });

    if (response.data.success) {
      for (const action of actions) {
        if (action.id !== undefined) {
          await localDB.dequeueAction(action.id);
        }
      }

      // Atualiza status das evoluções assinadas no banco local para 'Finalizado'
      const signedActions = actions.filter(
        (a) => a.type === 'SIGN_EVOLUCAO' || (a.type as string) === 'CHECK_OUT' || (a.type as string) === 'SALVAR_EVOLUCAO'
      );
      if (signedActions.length > 0) {
        const serverEvols: any[] = Array.isArray(response.data.evolucoes) ? response.data.evolucoes : [];
        const serverMap = new Map(serverEvols.map((e) => [e.id, e]));
        const localEvols = await localDB.getEvolucoes();
        for (const act of signedActions) {
          const evId = act.payload?.evolucaoId || act.payload?.id;
          if (!evId) continue;
          const localEv = localEvols.find((e) => e.id === evId);
          const srvEv = serverMap.get(evId);
          if (localEv) {
            await localDB.saveEvolucao({
              ...localEv,
              status: 'Finalizado',
              assinatura_digital: srvEv?.assinatura_digital || localEv.assinatura_digital,
              data_assinatura: srvEv?.data_assinatura || localEv.data_assinatura || act.payload?.checkOut,
              responsavel_id: srvEv?.responsavel_id || localEv.responsavel_id || act.payload?.responsavel_id,
              responsavel_nome: srvEv?.responsavel_nome || localEv.responsavel_nome || act.payload?.responsavel_nome,
              responsavel_parentesco:
                srvEv?.responsavel_parentesco || localEv.responsavel_parentesco || act.payload?.responsavel_parentesco,
            });
          } else if (srvEv) {
            await localDB.saveEvolucao({
              ...srvEv,
              status: 'Finalizado',
            });
          }
        }
        // Invalida caches de navegação para que o painel do gestor e listagens reflitam imediatamente
        invalidarCacheNavegacao(CHAVE_CACHE_LISTAGEM_PACIENTES);
        invalidarCacheNavegacaoPorPrefixo('gc_cache_prontuarios_evolucoes_v1_');
      }

      lastSyncedAt = new Date().toISOString();
      syncError = pendenciaAudio < 0 ? null : 'Há um áudio pendente. Abra o atendimento e toque em Transcrever áudio.';
      console.log('Sincronização concluída com sucesso!');
    } else {
      throw new Error(response.data.error || 'Erro desconhecido no servidor durante a sincronização.');
    }
  } catch (err: any) {
    console.error('Erro de sincronização:', err);
    syncError = err.response?.data?.error || err.message || 'Falha ao sincronizar dados com o servidor.';
  } finally {
    isSyncing = false;
    await emitState();
  }

  return syncError === null;
}

// Handler para sincronizar (suporta chamadas concorrentes enfileirando uma nova passada)
export async function synchronizeQueue(): Promise<boolean> {
  if (activeSyncPromise) {
    pendingResync = true;
    return activeSyncPromise;
  }

  activeSyncPromise = (async () => {
    let result = await executeSyncPass();
    while (pendingResync) {
      pendingResync = false;
      result = await executeSyncPass();
    }
    return result;
  })();

  try {
    return await activeSyncPromise;
  } finally {
    activeSyncPromise = null;
  }
}

// Inicializar listeners de conectividade global (apenas no cliente)
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    emitState();
    synchronizeQueue();
  });

  window.addEventListener('offline', () => {
    emitState();
  });

  setTimeout(() => {
    if (navigator.onLine) {
      synchronizeQueue();
    }
  }, 1000);
}
