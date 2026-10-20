/* eslint-disable */
// Client-side IndexedDB Wrapper for Offline Clinical Operations
import { ehPlanoMensal, obterPeriodoMesVigencia } from '@/lib/tipos-clinicos';

export interface ResponsavelPacienteLocal {
  id: string;
  nome: string;
  parentesco: string;
  telefone?: string;
  cpf?: string;
  principal?: boolean;
}

export interface PacienteLocal {
  id: string;
  nome: string;
  cpf?: string;
  data_nascimento?: string;
  endereco?: string;
  telefone?: string;
  responsavel_nome?: string;
  responsavel_telefone?: string;
  responsaveis?: ResponsavelPacienteLocal[];
  warnings?: string[]; // Alergias, etc.
  limite_visitas_mes?: number;
  visitas_realizadas_mes?: number;
  visitas_restantes_mes?: number;
  limite_atingido?: boolean;
  bloqueio_plano?: boolean;
  bloqueio_plano_motivo?: string;
  especialidade_prevista?: number;
  especialidade_realizada?: number;
  especialidade_restante?: number;
  tem_plano_terapeutico?: boolean;
  mes_cota_referencia?: string;
  evolucoes_contabilizadas_ids?: string[];
  plano_vigente?: {
    id?: string;
    versao?: number;
    data_inicio?: string;
    data_fim?: string;
    total_previsto?: number;
    total_realizado?: number;
    total_restante?: number;
    tem_pendencias?: boolean;
  };
}

export function contabilizarEvolucaoNaCotaLocal(
  p: PacienteLocal,
  evolucaoId?: string,
  checkInIso?: string,
): PacienteLocal {
  if (!p) return p;
  const base = checkInIso ? normalizarPacienteQuotaMensalLocal(p, checkInIso) : p;
  const limite = base?.limite_visitas_mes ?? base?.especialidade_prevista ?? 0;
  if (limite <= 0) {
    return base;
  }
  if (checkInIso) {
    const dataCheckIn = checkInIso.split('T')[0];
    const iniPlano = base.plano_vigente?.data_inicio?.split('T')[0];
    const fimPlano = base.plano_vigente?.data_fim?.split('T')[0];
    if (iniPlano && fimPlano && !ehPlanoMensal(base.plano_vigente)) {
      if (dataCheckIn < iniPlano || dataCheckIn > fimPlano) {
        return base;
      }
    } else {
      const mesCheckIn = dataCheckIn.slice(0, 7);
      const mesPlano = base.mes_cota_referencia || iniPlano?.slice(0, 7) || fimPlano?.slice(0, 7);
      if (mesCheckIn && mesPlano && mesCheckIn !== mesPlano) {
        return base;
      }
    }
  }
  const idsJaContabilizados = Array.isArray(base.evolucoes_contabilizadas_ids)
    ? base.evolucoes_contabilizadas_ids
    : [];
  if (evolucaoId && idsJaContabilizados.includes(evolucaoId)) {
    return base;
  }

  const novasRealizadas = (base.visitas_realizadas_mes || 0) + 1;
  const novasRestantes = Math.max(0, limite - novasRealizadas);
  const atingiu = novasRealizadas >= limite;

  return {
    ...base,
    limite_visitas_mes: base.limite_visitas_mes ?? limite,
    visitas_realizadas_mes: novasRealizadas,
    visitas_restantes_mes: novasRestantes,
    especialidade_realizada:
      base.especialidade_prevista !== undefined ? novasRealizadas : base.especialidade_realizada,
    especialidade_restante:
      base.especialidade_prevista !== undefined
        ? Math.max(0, base.especialidade_prevista - novasRealizadas)
        : base.especialidade_restante,
    limite_atingido: atingiu,
    bloqueio_plano: atingiu ? true : base.bloqueio_plano,
    evolucoes_contabilizadas_ids: evolucaoId
      ? [...idsJaContabilizados, evolucaoId]
      : idsJaContabilizados,
  };
}

export function normalizarPacienteQuotaMensalLocal(
  p: PacienteLocal,
  dataRefIso?: string,
): PacienteLocal {
  if (!p) return p;
  const hojeIso = (dataRefIso || new Date().toISOString()).split('T')[0];
  const mesAtual = hojeIso.slice(0, 7);
  const possuiPlano = Boolean(p.plano_vigente);
  const planoMensal = ehPlanoMensal(p.plano_vigente);

  // Planos legados de período fixo (não mensais) não devem ser renovados em ciclo mensal localmente
  if (possuiPlano && !planoMensal) {
    return p;
  }

  const fimPlano = p.plano_vigente?.data_fim?.split('T')[0];
  const mesCache = p.mes_cota_referencia || (fimPlano ? fimPlano.slice(0, 7) : undefined);

  const virouMesPlano = Boolean(planoMensal && fimPlano && hojeIso > fimPlano);
  const virouMesCache = Boolean(mesCache && mesAtual > mesCache);

  if (!virouMesPlano && !virouMesCache) {
    return p;
  }

  const { data_inicio: dataInicioNovoMes, data_fim: dataFimNovoMes } = obterPeriodoMesVigencia(hojeIso);

  const previstas = p.especialidade_prevista ?? p.limite_visitas_mes ?? 0;
  const motivoEraCota =
    Boolean(p.limite_atingido) ||
    !p.bloqueio_plano_motivo ||
    /limite|atingid[oa]|esgotad[oa]/i.test(p.bloqueio_plano_motivo);

  return {
    ...p,
    mes_cota_referencia: mesAtual,
    visitas_realizadas_mes: 0,
    visitas_restantes_mes: previstas > 0 ? previstas : p.visitas_restantes_mes,
    especialidade_realizada: p.especialidade_prevista !== undefined ? 0 : p.especialidade_realizada,
    especialidade_restante: p.especialidade_prevista !== undefined ? p.especialidade_prevista : p.especialidade_restante,
    limite_atingido: false,
    bloqueio_plano: motivoEraCota ? false : p.bloqueio_plano,
    bloqueio_plano_motivo: motivoEraCota ? undefined : p.bloqueio_plano_motivo,
    evolucoes_contabilizadas_ids: [],
    plano_vigente: p.plano_vigente
      ? {
          ...p.plano_vigente,
          data_inicio: dataInicioNovoMes,
          data_fim: dataFimNovoMes,
          total_realizado: 0,
          total_restante: p.plano_vigente.total_previsto ?? 0,
          tem_pendencias: (p.plano_vigente.total_previsto ?? 0) > 0,
        }
      : undefined,
  };
}

export function reconciliarPacienteComCotaPendenteLocal(
  p: PacienteLocal,
  existente?: PacienteLocal | null,
  evolucoesLocais?: EvolucaoLocal[],
  filaSync?: SyncAction[],
  dataRefIso?: string,
): PacienteLocal {
  if (!p) return p;
  const pNormalizado = normalizarPacienteQuotaMensalLocal(p, dataRefIso);
  const mesAtual = (dataRefIso || new Date().toISOString()).slice(0, 7);
  const iniPlano = pNormalizado.plano_vigente?.data_inicio?.split('T')[0];
  const fimPlano = pNormalizado.plano_vigente?.data_fim?.split('T')[0];
  const planoFixo = Boolean(iniPlano && fimPlano && !ehPlanoMensal(pNormalizado.plano_vigente));
  const mesCota = planoFixo
    ? `${iniPlano}..${fimPlano}`
    : pNormalizado.mes_cota_referencia || iniPlano?.slice(0, 7) || fimPlano?.slice(0, 7) || mesAtual;

  const idsRecebidos = Array.isArray(pNormalizado.evolucoes_contabilizadas_ids)
    ? [...pNormalizado.evolucoes_contabilizadas_ids]
    : [];

  let resultado: PacienteLocal = {
    ...pNormalizado,
    mes_cota_referencia: mesCota,
    evolucoes_contabilizadas_ids: idsRecebidos,
  };

  const pacId = String(pNormalizado.id || '').trim();
  const evolsDoPaciente = (evolucoesLocais || []).filter(
    (ev) => ev && String(ev.paciente_id || '').trim() === pacId,
  );
  const evolsPorId = new Map<string, EvolucaoLocal>();
  for (const ev of evolsDoPaciente) {
    if (ev.id) evolsPorId.set(String(ev.id), ev);
  }

  const idsPendentesFila = new Map<string, string | undefined>();
  for (const act of filaSync || []) {
    if (!act || (act.type !== 'SIGN_EVOLUCAO' && act.type !== 'CHECK_IN')) continue;
    const actPacId = String(act.payload?.pacienteId || act.payload?.paciente_id || '').trim();
    const actEvId = String(act.payload?.evolucaoId || act.payload?.id || '').trim();
    if (actPacId === pacId && actEvId) {
      const checkInPayload = act.payload?.checkIn || act.payload?.check_in;
      if (!idsPendentesFila.has(actEvId) || checkInPayload) {
        idsPendentesFila.set(actEvId, checkInPayload);
      }
    }
  }

  const candidatosPendentes = new Map<string, string | undefined>();

  // 1. Evoluções já contabilizadas no paciente em cache local (preserva ordem cronológica)
  const existenteNormalizado = existente
    ? normalizarPacienteQuotaMensalLocal(existente, dataRefIso)
    : null;
  const mesmoMesCache = planoFixo
    ? Boolean(
        existenteNormalizado?.plano_vigente &&
          existenteNormalizado.plano_vigente.data_inicio?.split('T')[0] === iniPlano &&
          existenteNormalizado.plano_vigente.data_fim?.split('T')[0] === fimPlano,
      )
    : !existenteNormalizado?.mes_cota_referencia ||
      existenteNormalizado.mes_cota_referencia === mesCota;

  if (
    existenteNormalizado &&
    mesmoMesCache &&
    Array.isArray(existenteNormalizado.evolucoes_contabilizadas_ids)
  ) {
    for (const idExistente of existenteNormalizado.evolucoes_contabilizadas_ids) {
      if (!idExistente) continue;
      const evLocal = evolsPorId.get(idExistente);
      const jaSincronizadaNoServidor =
        Boolean(evLocal) &&
        evLocal!.status !== 'Assinado_Pendente_Sync' &&
        evLocal!.sync_status !== 'pending' &&
        !idsPendentesFila.has(idExistente);
      if (!jaSincronizadaNoServidor && !candidatosPendentes.has(idExistente)) {
        candidatosPendentes.set(idExistente, evLocal?.check_in);
      } else if (
        jaSincronizadaNoServidor &&
        !Array.isArray(pNormalizado.evolucoes_contabilizadas_ids) &&
        !resultado.evolucoes_contabilizadas_ids?.includes(idExistente)
      ) {
        resultado = {
          ...resultado,
          evolucoes_contabilizadas_ids: [
            ...(resultado.evolucoes_contabilizadas_ids || []),
            idExistente,
          ],
        };
      }
    }
  }

  // 2. Evoluções locais no store evolucoes com sincronização pendente
  for (const ev of evolsDoPaciente) {
    if (!ev.id) continue;
    const ehPendente =
      ev.status === 'Assinado_Pendente_Sync' ||
      ev.sync_status === 'pending' ||
      idsPendentesFila.has(ev.id);
    if (ehPendente && !candidatosPendentes.has(String(ev.id))) {
      candidatosPendentes.set(String(ev.id), ev.check_in);
    }
  }

  // 3. Ações na fila_sync ainda não refletidas
  for (const [evId, checkInFila] of Array.from(idsPendentesFila.entries())) {
    if (!candidatosPendentes.has(evId)) {
      candidatosPendentes.set(evId, evolsPorId.get(evId)?.check_in || checkInFila);
    }
  }

  for (const [evId, checkInIso] of Array.from(candidatosPendentes.entries())) {
    if (!idsRecebidos.includes(evId)) {
      resultado = contabilizarEvolucaoNaCotaLocal(resultado, evId, checkInIso);
    }
  }

  return resultado;
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
  medico_nome?: string;
  medico_crm?: string;
}

export interface SinalVitalLocal {
  id?: string;
  paciente_id?: string;
  evolucao_id?: string;
  data_hora: string;
  pa_sistolica?: number | null;
  pa_diastolica?: number | null;
  fc_bpm?: number | null;
  fr_rpm?: number | null;
  temp_celsius?: number | null;
  spo2_percent?: number | null;
  glicemia_mg_dl?: number | null;
  dor_escala?: number | null;
  nivel_consciencia?: string | null;
  observacoes?: string;
}

export interface EvolucaoLocal {
  id: string;
  paciente_id: string;
  paciente_nome?: string;
  paciente_cpf?: string;
  profissional_id: string;
  profissional_nome?: string;
  tipo_profissional: 'Tecnico_Enfermagem' | 'Medico' | 'Terapeuta' | string;
  turno?: 'Diurno' | 'Noturno' | '24h' | string;
  check_in: string; // ISO Datetime
  check_out: string; // ISO Datetime
  audio_url?: string;
  transcricao_crua?: string;
  transcricao_revisada?: string;
  soap_subjetivo?: string;
  soap_objetivo?: string;
  soap_avaliacao?: string;
  soap_plano?: string;
  status: 'Em_Andamento' | 'Assinado_Pendente_Sync' | 'Finalizado' | 'Auditado';
  sync_status?: 'pending' | 'synced' | string;
  data_assinatura?: string;
  assinatura_digital?: string;
  assinatura_biometrica?: any;
  responsavel_id?: string;
  responsavel_nome?: string;
  responsavel_parentesco?: string;
  sinais_vitais?: SinalVitalLocal[];
}

export interface SyncAction {
  id?: number;
  type: 'CHECK_IN' | 'CHECK_OUT' | 'CHECK_MEDICAMENTO' | 'EVOLUCAO_TEXTO' | 'SIGN_EVOLUCAO' | 'REGISTRAR_SINAIS_VITAIS';
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
    if (!pacientes || pacientes.length === 0) return;
    const [evolucoesLocais, filaSync] = await Promise.all([
      this.getEvolucoes().catch(() => [] as EvolucaoLocal[]),
      this.getSyncQueue().catch(() => [] as SyncAction[]),
    ]);
    const { store, transaction } = await getStore('pacientes', 'readwrite');
    const existingReq = store.getAll();
    return new Promise((resolve, reject) => {
      existingReq.onerror = () => reject(existingReq.error);
      existingReq.onsuccess = () => {
        const existingMap = new Map<string, PacienteLocal>();
        for (const item of (existingReq.result || []) as PacienteLocal[]) {
          if (item?.id) existingMap.set(String(item.id).trim(), item);
        }
        for (const p of pacientes) {
          if (!p?.id) continue;
          const existente = existingMap.get(String(p.id).trim());
          const reconciliado = reconciliarPacienteComCotaPendenteLocal(
            p,
            existente,
            evolucoesLocais,
            filaSync,
          );
          store.put(reconciliado);
        }
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  },

  async getPaciente(id: string): Promise<PacienteLocal | null> {
    const { store } = await getStore('pacientes', 'readonly');
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result ? normalizarPacienteQuotaMensalLocal(request.result) : null);
      request.onerror = () => reject(request.error);
    });
  },

  async getPacientes(): Promise<PacienteLocal[]> {
    const { store } = await getStore('pacientes', 'readonly');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve((request.result || []).map((p: PacienteLocal) => normalizarPacienteQuotaMensalLocal(p)));
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
        const existingList = (existingReq.result || []) as AprazamentoLocal[];
        const existingMap = new Map<string, AprazamentoLocal>();
        const existingByKey = new Map<string, AprazamentoLocal>();

        for (const item of existingList) {
          if (!item?.id) continue;
          const isDeterministico = String(item.id).startsWith(`apraz_${item.prescricao_id}_`) || String(item.id).startsWith('ap_');
          if (!isDeterministico && item.status === 'Pendente') {
            store.delete(item.id);
            continue;
          }
          existingMap.set(item.id, item);
          const key = `${item.prescricao_id}__${item.horario_previsto}`;
          const prevKey = existingByKey.get(key);
          if (prevKey) {
            if (prevKey.status === 'Pendente' && item.status !== 'Pendente') {
              store.delete(prevKey.id);
              existingByKey.set(key, item);
            } else {
              store.delete(item.id);
            }
          } else {
            existingByKey.set(key, item);
          }
        }

        for (const a of aprazamentos) {
          if (!a?.id) continue;
          const isDeterministico = String(a.id).startsWith(`apraz_${a.prescricao_id}_`) || String(a.id).startsWith('ap_');
          if (!isDeterministico && a.status === 'Pendente') {
            continue;
          }
          const key = `${a.prescricao_id}__${a.horario_previsto}`;
          const existente = existingMap.get(a.id) || existingByKey.get(key);
          if (existente && existente.status !== 'Pendente' && a.status === 'Pendente') {
            store.put({
              ...a,
              id: existente.id,
              status: existente.status,
              horario_executado: existente.horario_executado,
              justificativa: existente.justificativa,
              profissional_id: existente.profissional_id,
              assinatura_digital: existente.assinatura_digital,
            });
          } else {
            if (existente && existente.id !== a.id) {
              store.delete(existente.id);
            }
            store.put(a);
            existingByKey.set(key, a);
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
        const rawResults = (request.result || []) as AprazamentoLocal[];
        const dedupMap = new Map<string, AprazamentoLocal>();
        for (const item of rawResults) {
          if (!item?.id) continue;
          const isDeterministico = String(item.id).startsWith(`apraz_${item.prescricao_id}_`) || String(item.id).startsWith('ap_');
          if (!isDeterministico && item.status === 'Pendente') continue;
          const key = `${item.prescricao_id}__${item.horario_previsto}`;
          const existente = dedupMap.get(key);
          if (!existente || (existente.status === 'Pendente' && item.status !== 'Pendente')) {
            dedupMap.set(key, item);
          }
        }
        const results = Array.from(dedupMap.values());
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

  async saveEvolucoes(evolucoes: EvolucaoLocal[]): Promise<void> {
    if (!evolucoes || evolucoes.length === 0) return;
    const { store, transaction } = await getStore('evolucoes', 'readwrite');
    const existingReq = store.getAll();
    return new Promise((resolve, reject) => {
      existingReq.onerror = () => reject(existingReq.error);
      existingReq.onsuccess = () => {
        const existingMap = new Map<string, EvolucaoLocal>();
        for (const item of (existingReq.result || []) as EvolucaoLocal[]) {
          if (item?.id) existingMap.set(item.id, item);
        }
        for (const ev of evolucoes) {
          if (!ev?.id) continue;
          const local = existingMap.get(ev.id);
          if (local) {
            // Preserva evolução local assinada pendente de sync caso o servidor ainda esteja em andamento,
            // ou mescla metadados locais (ex: assinatura_biometrica, sinais_vitais) quando o servidor confirma Finalizado
            const servidorFinalizado = ev.status === 'Finalizado' || ev.status === 'Auditado';
            const statusFinal = servidorFinalizado
              ? ev.status
              : local.status === 'Assinado_Pendente_Sync' || local.status === 'Finalizado'
                ? local.status
                : ev.status || local.status;
            const syncStatusFinal = servidorFinalizado
              ? 'synced'
              : statusFinal === 'Assinado_Pendente_Sync'
                ? 'pending'
                : ev.sync_status || (local.sync_status === 'pending' && ev.status ? 'synced' : local.sync_status);
            store.put({
              ...local,
              ...ev,
              status: statusFinal,
              sync_status: syncStatusFinal,
              transcricao_revisada: ev.transcricao_revisada || local.transcricao_revisada || '',
              check_out: ev.check_out || local.check_out || '',
              data_assinatura: ev.data_assinatura || local.data_assinatura,
              assinatura_digital: ev.assinatura_digital || local.assinatura_digital,
              assinatura_biometrica: ev.assinatura_biometrica || local.assinatura_biometrica,
              responsavel_id: ev.responsavel_id || local.responsavel_id,
              responsavel_nome: ev.responsavel_nome || local.responsavel_nome,
              responsavel_parentesco: ev.responsavel_parentesco || local.responsavel_parentesco,
              sinais_vitais:
                Array.isArray(ev.sinais_vitais) && ev.sinais_vitais.length > 0
                  ? ev.sinais_vitais
                  : local.sinais_vitais,
            });
          } else {
            store.put(ev);
          }
        }
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
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
  let horariosBrutos: string[] = [];
  if (Array.isArray(prescricao.horarios_padrao) && prescricao.horarios_padrao.length > 0) {
    horariosBrutos = prescricao.horarios_padrao;
  } else if (typeof prescricao.horarios_padrao === 'string' && prescricao.horarios_padrao.trim()) {
    try {
      const parsed = JSON.parse(prescricao.horarios_padrao);
      if (Array.isArray(parsed) && parsed.length > 0) horariosBrutos = parsed;
      else horariosBrutos = prescricao.horarios_padrao.split(/[,•]/).map((s) => s.trim()).filter(Boolean);
    } catch {
      horariosBrutos = prescricao.horarios_padrao.split(/[,•]/).map((s) => s.trim()).filter(Boolean);
    }
  }

  if (horariosBrutos.length === 0) {
    const freq = prescricao.frequencia_horas || 12;
    if (freq === 24) horariosBrutos = ['08:00'];
    else if (freq === 12) horariosBrutos = ['08:00', '20:00'];
    else if (freq === 8) horariosBrutos = ['08:00', '16:00', '00:00'];
    else if (freq === 6) horariosBrutos = ['06:00', '12:00', '18:00', '00:00'];
    else if (freq === 4) horariosBrutos = ['04:00', '08:00', '12:00', '16:00', '20:00', '00:00'];
    else horariosBrutos = ['08:00', '20:00'];
  }

  const horariosUnicos = new Set<string>();
  for (const h of horariosBrutos) {
    const limpo = String(h || '').trim();
    if (!limpo) continue;
    const [hhRaw, mmRaw] = limpo.split(':');
    const hh = String(parseInt(hhRaw || '8', 10) || 0).padStart(2, '0');
    const mm = String(parseInt(mmRaw || '0', 10) || 0).padStart(2, '0');
    horariosUnicos.add(`${hh}:${mm}`);
  }
  const horarios = Array.from(horariosUnicos).slice(0, 12);

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
  const dataIso = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth(), inicio.getUTCDate()))
    .toISOString()
    .slice(0, 10);

  const slots: AprazamentoLocal[] = [];
  for (const h of horarios) {
    const [hora, min] = h.split(':');
    const instante = new Date(`${dataIso}T${hora || '08'}:${min || '00'}:00-03:00`);
    if (Number.isNaN(instante.getTime())) continue;
    slots.push({
      id: `apraz_${prescricao.id}_${dataIso}_${(h || '0800').replace(':', '')}`,
      prescricao_id: prescricao.id,
      paciente_id: prescricao.paciente_id,
      horario_previsto: instante.toISOString(),
      status: 'Pendente',
      medicamento: prescricao.medicamento,
      dosagem: prescricao.dosagem,
      via_administracao: prescricao.via_administracao,
      medico_nome: prescricao.medico_nome,
      medico_crm: prescricao.medico_crm,
    });
  }

  return slots;
}

