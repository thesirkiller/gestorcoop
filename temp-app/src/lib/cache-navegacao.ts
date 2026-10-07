/**
 * Cache de navegação no cliente (sessionStorage + memória local)
 * com suporte a Stale-While-Revalidate (SWR) para navegação instantânea
 * entre a listagem de prontuários (/gestor/prontuarios) e as telas de detalhe/auditoria.
 *
 * Elimina o flash de loading (skeletons) e o custo de round-trips ao voltar do
 * detalhe de um paciente para a listagem.
 */

interface EntradaCacheNavegacao<T> {
  timestamp: number;
  data: T;
}

const memoriaNavegacao = new Map<string, EntradaCacheNavegacao<unknown>>();

export interface RespostaCacheNavegacao<T> {
  data: T;
  isStale: boolean;
}

/**
 * Lê uma entrada do cache de navegação.
 * @param chave Identificador único do recurso.
 * @param ttlFrescoMs Tempo (ms) durante o qual o dado é considerado estritamente fresco (padrão: 45s).
 * @param ttlMaximoMs Tempo (ms) após o qual o cache é descartado completamente (padrão: 5min).
 */
export function lerCacheNavegacao<T>(
  chave: string,
  ttlFrescoMs = 45_000,
  ttlMaximoMs = 300_000
): RespostaCacheNavegacao<T> | null {
  let entrada = memoriaNavegacao.get(chave) as EntradaCacheNavegacao<T> | undefined;

  if (!entrada && typeof window !== 'undefined') {
    try {
      const bruto = window.sessionStorage.getItem(chave);
      if (bruto) {
        entrada = JSON.parse(bruto) as EntradaCacheNavegacao<T>;
        memoriaNavegacao.set(chave, entrada);
      }
    } catch {
      // Ignora falhas de storage (Safari privado, iframe particionado)
    }
  }

  if (!entrada) return null;

  const idadeMs = Date.now() - entrada.timestamp;
  if (idadeMs > ttlMaximoMs) {
    invalidarCacheNavegacao(chave);
    return null;
  }

  return {
    data: entrada.data,
    isStale: idadeMs >= ttlFrescoMs,
  };
}

export function gravarCacheNavegacao<T>(chave: string, data: T): void {
  const entrada: EntradaCacheNavegacao<T> = { timestamp: Date.now(), data };
  memoriaNavegacao.set(chave, entrada);
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.setItem(chave, JSON.stringify(entrada));
    } catch {
      // Ignora erro de cota ou bloqueio de storage
    }
  }
}

export function invalidarCacheNavegacao(chave: string): void {
  memoriaNavegacao.delete(chave);
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.removeItem(chave);
    } catch {
      // Ignora
    }
  }
}

export function invalidarCacheNavegacaoPorPrefixo(prefixo: string): void {
  for (const chave of Array.from(memoriaNavegacao.keys())) {
    if (chave.startsWith(prefixo)) {
      memoriaNavegacao.delete(chave);
    }
  }
  if (typeof window !== 'undefined') {
    try {
      const chavesParaRemover: string[] = [];
      for (let i = 0; i < window.sessionStorage.length; i++) {
        const k = window.sessionStorage.key(i);
        if (k && k.startsWith(prefixo)) {
          chavesParaRemover.push(k);
        }
      }
      for (const k of chavesParaRemover) {
        window.sessionStorage.removeItem(k);
      }
    } catch {
      // Ignora
    }
  }
}

/** Chaves compartilhadas da tela de prontuários */
export const CHAVE_CACHE_LISTAGEM_PACIENTES = 'gc_cache_prontuarios_pacientes_v1';
export function chaveCacheListagemEvolucoes(especialidade?: string): string {
  return `gc_cache_prontuarios_evolucoes_v1_${especialidade || 'todas'}`;
}
