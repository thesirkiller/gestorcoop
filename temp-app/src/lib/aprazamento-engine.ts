/**
 * Motor puro de cálculo e filtragem de aprazamentos para turnos e atendimentos.
 * Sem dependências de DOM, React ou banco de dados.
 */

export const FUSO_CLINICO = process.env.APRAZAMENTO_UTC_OFFSET || '-03:00';

export interface JanelaTurno {
  inicio: Date;
  fim: Date;
}

export type TipoTurno = 'Diurno' | 'Noturno' | '24h';

/**
 * Extrai e normaliza horários padrão de uma prescrição (ex: ['08:00', '12:00']).
 */
export function parseHorariosPadrao(horariosPadrao?: string[] | string, frequenciaHoras?: number): string[] {
  let horarios: string[] = [];
  if (Array.isArray(horariosPadrao) && horariosPadrao.length > 0) {
    horarios = horariosPadrao;
  } else if (typeof horariosPadrao === 'string' && horariosPadrao.trim()) {
    try {
      const parsed = JSON.parse(horariosPadrao);
      if (Array.isArray(parsed) && parsed.length > 0) horarios = parsed;
      else horarios = horariosPadrao.split(/[,•]/).map((s) => s.trim()).filter(Boolean);
    } catch {
      horarios = horariosPadrao.split(/[,•]/).map((s) => s.trim()).filter(Boolean);
    }
  }

  if (horarios.length === 0) {
    const freq = frequenciaHoras || 12;
    if (freq === 24) horarios = ['08:00'];
    else if (freq === 12) horarios = ['08:00', '20:00'];
    else if (freq === 8) horarios = ['08:00', '16:00', '00:00'];
    else if (freq === 6) horarios = ['06:00', '12:00', '18:00', '00:00'];
    else if (freq === 4) horarios = ['04:00', '08:00', '12:00', '16:00', '20:00', '00:00'];
    else horarios = ['08:00', '20:00'];
  }

  const setUnicos = new Set<string>();
  for (const h of horarios) {
    const limpo = h.trim();
    if (!limpo) continue;
    const partes = limpo.split(':');
    const hh = (partes[0] || '08').padStart(2, '0');
    const mm = (partes[1] || '00').padStart(2, '0');
    setUnicos.add(`${hh}:${mm}`);
  }
  return Array.from(setUnicos).sort();
}

/**
 * Calcula a janela de 12 horas (ou 24h) para o atendimento no fuso de Brasília (-03:00).
 * Diurno: 07:00 às 19:00 do mesmo dia.
 * Noturno: 19:00 às 07:00 do dia seguinte.
 * Intervalo fechado no início e aberto no fim: [inicio, fim).
 */
export function obterJanelaTurno(
  referencia: Date | string,
  turno: TipoTurno = 'Diurno'
): JanelaTurno {
  const d = typeof referencia === 'string' ? new Date(referencia) : referencia;
  const ref = Number.isNaN(d.getTime()) ? new Date() : d;

  const ano = ref.getFullYear();
  const mes = String(ref.getMonth() + 1).padStart(2, '0');
  const dia = String(ref.getDate()).padStart(2, '0');
  const hora = ref.getHours();

  if (turno === 'Noturno') {
    if (hora < 7) {
      const ontem = new Date(ref.getTime() - 86400000);
      const anoO = ontem.getFullYear();
      const mesO = String(ontem.getMonth() + 1).padStart(2, '0');
      const diaO = String(ontem.getDate()).padStart(2, '0');
      return {
        inicio: new Date(`${anoO}-${mesO}-${diaO}T19:00:00${FUSO_CLINICO}`),
        fim: new Date(`${ano}-${mes}-${dia}T07:00:00${FUSO_CLINICO}`),
      };
    }
    const amanha = new Date(ref.getTime() + 86400000);
    const anoA = amanha.getFullYear();
    const mesA = String(amanha.getMonth() + 1).padStart(2, '0');
    const diaA = String(amanha.getDate()).padStart(2, '0');
    return {
      inicio: new Date(`${ano}-${mes}-${dia}T19:00:00${FUSO_CLINICO}`),
      fim: new Date(`${anoA}-${mesA}-${diaA}T07:00:00${FUSO_CLINICO}`),
    };
  }

  if (turno === '24h') {
    if (hora < 7) {
      const ontem = new Date(ref.getTime() - 86400000);
      const anoO = ontem.getFullYear();
      const mesO = String(ontem.getMonth() + 1).padStart(2, '0');
      const diaO = String(ontem.getDate()).padStart(2, '0');
      return {
        inicio: new Date(`${anoO}-${mesO}-${diaO}T07:00:00${FUSO_CLINICO}`),
        fim: new Date(`${ano}-${mes}-${dia}T07:00:00${FUSO_CLINICO}`),
      };
    }
    const amanha = new Date(ref.getTime() + 86400000);
    const anoA = amanha.getFullYear();
    const mesA = String(amanha.getMonth() + 1).padStart(2, '0');
    const diaA = String(amanha.getDate()).padStart(2, '0');
    return {
      inicio: new Date(`${ano}-${mes}-${dia}T07:00:00${FUSO_CLINICO}`),
      fim: new Date(`${anoA}-${mesA}-${diaA}T07:00:00${FUSO_CLINICO}`),
    };
  }

  // Padrão: Diurno (12 horas das 07:00 às 19:00)
  return {
    inicio: new Date(`${ano}-${mes}-${dia}T07:00:00${FUSO_CLINICO}`),
    fim: new Date(`${ano}-${mes}-${dia}T19:00:00${FUSO_CLINICO}`),
  };
}

export interface PrescricaoBaseParaSlot {
  id: string;
  paciente_id: string;
  medicamento: string;
  dosagem: string;
  via_administracao: string;
  horarios_padrao?: string[] | string;
  frequencia_horas?: number;
  data_inicio?: string;
  data_fim?: string;
  status?: string;
}

export interface SlotAprazamentoGerado {
  id: string;
  prescricao_id: string;
  paciente_id: string;
  medicamento: string;
  dosagem: string;
  via_administracao: string;
  horario_previsto: string;
  status: 'Pendente';
}

/**
 * Gera slots para os horários que caem estritamente dentro da janela do atendimento [inicio, fim).
 * Garante que uma prescrição de 4 horários em 12h produza exatamente 4 slots, sem explodir para 50+.
 */
export function gerarSlotsParaTurno(
  prescricao: PrescricaoBaseParaSlot,
  janela: JanelaTurno
): SlotAprazamentoGerado[] {
  // Ignora prescrições canceladas ou suspensas se status foi informado
  if (prescricao.status && String(prescricao.status).trim().toLowerCase() !== 'ativa') {
    return [];
  }

  const parseDataLimite = (dStr?: string) => {
    if (!dStr || !dStr.trim()) return null;
    const s = dStr.trim();
    if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) {
      const [dia, mes, ano] = s.split('/');
      return new Date(`${ano}-${mes}-${dia}T00:00:00${FUSO_CLINICO}`);
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      return new Date(`${s}T00:00:00${FUSO_CLINICO}`);
    }
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const inicioPresc = parseDataLimite(prescricao.data_inicio);
  const fimPresc = parseDataLimite(prescricao.data_fim);

  // Se fimPresc foi fornecido apenas como data no fuso clínico, estende até o fim do dia
  let fimPrescComMargem: Date | null = null;
  if (fimPresc) {
    fimPrescComMargem = new Date(fimPresc);
    const fimStr = prescricao.data_fim?.trim() || '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(fimStr)) {
      fimPrescComMargem = new Date(`${fimStr}T23:59:59.999${FUSO_CLINICO}`);
    } else if (/^\d{2}\/\d{2}\/\d{4}/.test(fimStr)) {
      const [d, m, y] = fimStr.split('/');
      fimPrescComMargem = new Date(`${y}-${m}-${d}T23:59:59.999${FUSO_CLINICO}`);
    }
  }

  const horarios = parseHorariosPadrao(prescricao.horarios_padrao, prescricao.frequencia_horas);
  const slots: SlotAprazamentoGerado[] = [];

  const diaCorrente = new Date(janela.inicio);
  diaCorrente.setHours(0, 0, 0, 0);

  const diaLimite = new Date(janela.fim);
  diaLimite.setHours(23, 59, 59, 999);

  while (diaCorrente <= diaLimite) {
    const ano = diaCorrente.getFullYear();
    const mes = String(diaCorrente.getMonth() + 1).padStart(2, '0');
    const dia = String(diaCorrente.getDate()).padStart(2, '0');
    const dataIso = `${ano}-${mes}-${dia}`;

    for (const h of horarios) {
      const [horaStr, minStr] = (h || '08:00').split(':');
      const horaParsed = parseInt(horaStr, 10);
      const minParsed = parseInt(minStr, 10);
      const hora = Number.isNaN(horaParsed) ? 8 : horaParsed;
      const min = Number.isNaN(minParsed) ? 0 : minParsed;

      const horaPad = String(hora).padStart(2, '0');
      const minPad = String(min).padStart(2, '0');
      const instante = new Date(`${dataIso}T${horaPad}:${minPad}:00${FUSO_CLINICO}`);
      const tInstante = instante.getTime();

      // Valida se o horário cai na janela do turno [janela.inicio, janela.fim)
      if (tInstante >= janela.inicio.getTime() && tInstante < janela.fim.getTime()) {
        // Valida vigência da prescrição se data_inicio ou data_fim existirem
        if (inicioPresc && tInstante < inicioPresc.getTime()) {
          continue;
        }
        if (fimPrescComMargem && tInstante > fimPrescComMargem.getTime()) {
          continue;
        }

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
    }
    diaCorrente.setDate(diaCorrente.getDate() + 1);
  }

  return slots;
}

/**
 * Filtra slots existentes cuja data/hora prevista caia estritamente dentro da janela do atendimento.
 */
export function filtrarSlotsPorJanela<T extends { horario_previsto?: string }>(
  slots: T[],
  janela: JanelaTurno
): T[] {
  const tInicio = janela.inicio.getTime();
  const tFim = janela.fim.getTime();

  return slots.filter((s) => {
    if (!s.horario_previsto) return false;
    const tSlot = new Date(s.horario_previsto).getTime();
    if (Number.isNaN(tSlot)) return false;
    return tSlot >= tInicio && tSlot < tFim;
  });
}
