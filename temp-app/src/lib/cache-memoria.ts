/**
 * Memo com TTL por isolate, guardando SÓ valores já resolvidos.
 *
 * Serve para leituras caras e pouco voláteis de serviços externos (ex.: a lista
 * completa de pacientes do Bubble, que exige paginar a Data API inteira a cada
 * abertura do painel de prontuários).
 *
 * Por que não guardar a Promise em andamento (dedupe de chamadas simultâneas):
 * no Cloudflare Workers cada requisição tem seu próprio contexto de I/O. Uma
 * Promise criada pela requisição A e aguardada pela requisição B fica presa ao
 * ciclo de vida de A — se A for cancelada (cliente fechou a aba, timeout), o
 * `fetch` dela é abortado e B fica pendurada; o runtime ainda registra o aviso
 * "A promise was resolved or rejected from a different request context". Por
 * isso cada requisição faz a própria carga quando não há valor pronto, e só o
 * resultado (dado JS puro, sem I/O) é compartilhado.
 *
 * Limites conscientes:
 * - O estado vive no isolate do Worker. Isolates diferentes têm caches
 *   diferentes, e um dado alterado em outro sistema pode aparecer com até `ttlMs`
 *   de atraso. Não use para nada que precise de leitura imediatamente consistente.
 * - Falhas não ficam em cache: a próxima chamada tenta de novo.
 * - Uma carga que começou antes de `invalidarCacheMemoria` não grava o
 *   resultado (pode ser anterior à escrita que motivou a invalidação).
 */
type Entrada = { expiraEm: number; valor: unknown };

type Estado = { valores: Map<string, Entrada>; geracoes: Map<string, number> };

const g = globalThis as unknown as { __gestorcoop_cacheMemoriaV2?: Estado };
if (!g.__gestorcoop_cacheMemoriaV2) g.__gestorcoop_cacheMemoriaV2 = { valores: new Map(), geracoes: new Map() };
const estado: Estado = g.__gestorcoop_cacheMemoriaV2;

export async function memoizarComTtl<T>(chave: string, ttlMs: number, carregar: () => Promise<T>): Promise<T> {
  const atual = estado.valores.get(chave);
  if (atual && atual.expiraEm > Date.now()) return atual.valor as T;

  const geracao = estado.geracoes.get(chave) ?? 0;
  const valor = await carregar();
  if ((estado.geracoes.get(chave) ?? 0) === geracao) {
    estado.valores.set(chave, { expiraEm: Date.now() + ttlMs, valor });
  }
  return valor;
}

export function invalidarCacheMemoria(chave: string): void {
  estado.valores.delete(chave);
  estado.geracoes.set(chave, (estado.geracoes.get(chave) ?? 0) + 1);
}

/** Chaves compartilhadas entre quem lê e quem precisa invalidar. */
export const CHAVE_CACHE_PACIENTES_BUBBLE = 'bubble:pacientes';

/**
 * Validade da lista completa de pacientes do Bubble memoizada por isolate.
 * Um paciente criado no Bubble por fora do app aparece em até esse tempo;
 * escritas via `bubbleApi.createPaciente/updatePaciente` invalidam no mesmo isolate.
 */
export const TTL_PACIENTES_BUBBLE_MS = 60_000;

/**
 * TTL de validação de sessão ativa no D1 por isolate (30 segundos).
 * Reduz uma ida ao D1 a cada requisição HTTP autenticada.
 */
export const TTL_SESSAO_MS = 30_000;

export function chaveCacheSessao(sessionId: string): string {
  return `sessao:${sessionId}`;
}

export function invalidarSessaoMemoria(sessionId: string): void {
  invalidarCacheMemoria(chaveCacheSessao(sessionId));
}
