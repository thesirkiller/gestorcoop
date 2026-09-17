import { getDb, novoId, agoraIso } from '@/lib/db/client';

/**
 * Tetos de consumo e de tempo das chamadas de IA.
 *
 * Três riscos distintos, três defesas:
 *
 * 1. `fetch` sem timeout para provedor externo prende o worker até o limite da
 *    plataforma. Todas as chamadas usam `AbortSignal.timeout`.
 * 2. Áudio grande gasta cota proporcional ao tamanho. O teto por arquivo corta
 *    antes de gastar qualquer coisa.
 * 3. A cota diária é da conta inteira, não da pessoa. Sem teto por cooperado,
 *    um profissional derruba a transcrição de todos.
 *
 * Os números são conservadores de propósito e todos sobrescrevíveis por env —
 * ajustar teto não deveria exigir deploy de código.
 */

/** Timeout de cada etapa, em ms. Medido: whisper ~3s e SOAP ~4s num áudio de 12s. */
export const TIMEOUT_TRANSCRICAO_MS = numeroDeEnv('IA_TIMEOUT_TRANSCRICAO_MS', 45_000);
export const TIMEOUT_SOAP_MS = numeroDeEnv('IA_TIMEOUT_SOAP_MS', 20_000);

/** Teto por arquivo. ~10 MB de opus são ~28 min de fala — muito além de uma evolução. */
export const MAX_BYTES_AUDIO = numeroDeEnv('IA_MAX_BYTES_AUDIO', 10 * 1024 * 1024);

/**
 * Opus de MediaRecorder fica em torno de 48 kbps mono, ou ~360 KB/min. A duração
 * vem daqui e não do cliente: `durationSeconds` do front é controlado pelo
 * navegador e seria trivial de forjar para escapar da cota. Byte enviado, não.
 */
const BYTES_POR_MINUTO = 360_000;

export const LIMITE_MINUTOS_DIA_COOPERADO = numeroDeEnv('IA_LIMITE_MIN_DIA_COOPERADO', 60);
export const LIMITE_CHAMADAS_DIA_COOPERADO = numeroDeEnv('IA_LIMITE_CHAMADAS_DIA_COOPERADO', 25);
export const LIMITE_MINUTOS_DIA_GLOBAL = numeroDeEnv('IA_LIMITE_MIN_DIA_GLOBAL', 400);
export const LIMITE_CHAMADAS_DIA_GLOBAL = numeroDeEnv('IA_LIMITE_CHAMADAS_DIA_GLOBAL', 500);

function numeroDeEnv(nome: string, padrao: number): number {
  const bruto = process.env[nome];
  if (!bruto) return padrao;
  const n = Number(bruto);
  return Number.isFinite(n) && n > 0 ? n : padrao;
}

export function minutosEstimados(bytes: number): number {
  return Math.max(0.1, bytes / BYTES_POR_MINUTO);
}

/** Dia da cota em UTC (YYYY-MM-DD), mesma janela usada pela Cloudflare. */
function diaAtual(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface VeredictoCota {
  permitido: boolean;
  motivo?: string;
  /** `true` quando o teto atingido é da cooperativa toda, não do cooperado. */
  global?: boolean;
}

interface LinhaSoma {
  chamadas: number | null;
  minutos: number | null;
}

/**
 * Verifica os quatro tetos (minutos e chamadas, por cooperado e globais).
 *
 * Sem D1 o consumo é liberado, com aviso no log. É deliberado: o binding ausente
 * significa dev local ou falha de infraestrutura, não abuso, e recusar
 * transcrição de profissional em campo por causa disso troca um problema de
 * custo por um de assistência. Quando o D1 volta, a contagem volta junto.
 */
export async function verificarCota(cooperadoId: string, bytes: number): Promise<VeredictoCota> {
  if (bytes > MAX_BYTES_AUDIO) {
    const mb = (MAX_BYTES_AUDIO / 1024 / 1024).toFixed(0);
    return {
      permitido: false,
      motivo: `Áudio acima de ${mb} MB. Grave a evolução em trechos menores.`,
    };
  }

  const db = getDb();
  if (!db) {
    console.warn('[ia/limites] D1 indisponível: cota de transcrição não aplicada nesta chamada.');
    return { permitido: true };
  }

  const dia = diaAtual();
  const minutos = minutosEstimados(bytes);

  try {
    const [doCooperado, doDia] = await Promise.all([
      db
        .prepare(
          `SELECT COUNT(*) AS chamadas, COALESCE(SUM(minutos_estimados), 0) AS minutos
             FROM uso_transcricao WHERE cooperado_id = ? AND dia = ?`,
        )
        .bind(cooperadoId, dia)
        .first<LinhaSoma>(),
      db
        .prepare(
          `SELECT COUNT(*) AS chamadas, COALESCE(SUM(minutos_estimados), 0) AS minutos
             FROM uso_transcricao WHERE dia = ?`,
        )
        .bind(dia)
        .first<LinhaSoma>(),
    ]);

    const chamadasCoop = doCooperado?.chamadas ?? 0;
    const minutosCoop = doCooperado?.minutos ?? 0;
    const chamadasGlobal = doDia?.chamadas ?? 0;
    const minutosGlobal = doDia?.minutos ?? 0;

    if (chamadasCoop >= LIMITE_CHAMADAS_DIA_COOPERADO) {
      return {
        permitido: false,
        motivo: `Limite de ${LIMITE_CHAMADAS_DIA_COOPERADO} transcrições por dia atingido. Redija a evolução manualmente ou fale com a coordenação.`,
      };
    }
    if (minutosCoop + minutos > LIMITE_MINUTOS_DIA_COOPERADO) {
      return {
        permitido: false,
        motivo: `Limite de ${LIMITE_MINUTOS_DIA_COOPERADO} minutos de áudio por dia atingido. Redija a evolução manualmente ou fale com a coordenação.`,
      };
    }
    if (chamadasGlobal >= LIMITE_CHAMADAS_DIA_GLOBAL || minutosGlobal + minutos > LIMITE_MINUTOS_DIA_GLOBAL) {
      return {
        permitido: false,
        global: true,
        motivo: 'A cota diária de transcrição da cooperativa foi atingida. Redija a evolução manualmente — o registro segue válido.',
      };
    }

    return { permitido: true };
  } catch (erro) {
    console.warn('[ia/limites] Falha ao consultar cota, liberando chamada:', erro);
    return { permitido: true };
  }
}

/**
 * Grava a tentativa. Chamada mesmo quando todos os provedores falham: erro de
 * provedor ainda consome banda e, se não contasse, bastaria forçar falhas para
 * transcrever sem limite.
 */
export async function registrarUso(dados: {
  cooperadoId: string;
  bytes: number;
  provedor: string | null;
  sucesso: boolean;
}): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    await db
      .prepare(
        `INSERT INTO uso_transcricao (id, cooperado_id, dia, criado_em, bytes, minutos_estimados, provedor, sucesso)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        novoId('uso'),
        dados.cooperadoId,
        diaAtual(),
        agoraIso(),
        dados.bytes,
        minutosEstimados(dados.bytes),
        dados.provedor,
        dados.sucesso ? 1 : 0,
      )
      .run();
  } catch (erro) {
    console.warn('[ia/limites] Falha ao registrar uso de transcrição:', erro);
  }
}
