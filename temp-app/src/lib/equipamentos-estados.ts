import type { StatusEquipamento, TipoMovimentacaoEquipamento } from './bubble';

// Máquina de estados do equipamento. Centraliza quais transições são
// permitidas para que nenhuma rota grave uma movimentação inválida.
// A checagem é feita no adaptador (registrarMovimentacao) antes de qualquer
// escrita, de modo que a validação valha para todos os fluxos.

// Estados terminais só saem por correção auditada (reversão excepcional).
export const STATUS_TERMINAIS: StatusEquipamento[] = ['Baixado', 'Condenado'];

// Estados a partir dos quais NÃO se pode iniciar uma nova operação de negócio
// (reserva/implantação) sem passar por conferência/liberação.
export const STATUS_INDISPONIVEIS: StatusEquipamento[] = [
  'Aguardando conferência',
  'Reservado',
  'Em transporte para implantação',
  'Implantado no domicílio',
  'Alugado',
  'Em transporte para recolhimento',
  'Recolhido e aguardando conferência',
  'Aguardando higienização',
  'Em higienização',
  'Manutenção',
  'Aguardando peça',
  'Bloqueado',
  'Extraviado',
  'Condenado',
  'Baixado',
];

// Para cada tipo de movimentação, os status de ORIGEM aceitos. Um valor
// undefined significa "qualquer origem" (correções/eventos administrativos).
const ORIGENS_PERMITIDAS: Partial<Record<TipoMovimentacaoEquipamento, StatusEquipamento[]>> = {
  'Reserva': ['Disponível'],
  'Cancelamento de reserva': ['Reservado'],
  'Implantação': ['Disponível', 'Reservado', 'Em transporte para implantação'],
  'Recolhimento': ['Implantado no domicílio', 'Alugado', 'Em transporte para recolhimento'],
  'Higienização': ['Aguardando higienização', 'Em higienização'],
  'Liberação': ['Manutenção', 'Aguardando peça', 'Liberado pela manutenção', 'Bloqueado'],
  'Baixa': [
    'Disponível', 'Aguardando conferência', 'Recolhido e aguardando conferência',
    'Aguardando higienização', 'Em higienização', 'Manutenção', 'Aguardando peça',
    'Bloqueado', 'Extraviado', 'Condenado',
  ],
};

export interface ResultadoValidacaoTransicao {
  ok: boolean;
  motivo?: string;
}

// `Correção` é a válvula de escape auditada usada por conferências, ajustes e
// reversões excepcionais de baixa. Exige justificativa (garantida na rota).
const TIPO_CORRECAO: TipoMovimentacaoEquipamento = 'Correção';

// Transferência não muda a situação, apenas a localização.
const TIPOS_SEM_MUDANCA_STATUS: TipoMovimentacaoEquipamento[] = ['Transferência'];

export function validarTransicao(
  statusAtual: StatusEquipamento | undefined,
  tipo: TipoMovimentacaoEquipamento,
  novoStatus: StatusEquipamento,
): ResultadoValidacaoTransicao {
  // Correção ignora as restrições de origem, mas continua auditada.
  if (tipo === TIPO_CORRECAO) {
    return { ok: true };
  }

  if (TIPOS_SEM_MUDANCA_STATUS.includes(tipo)) {
    if (statusAtual && novoStatus !== statusAtual) {
      return { ok: false, motivo: `${tipo} não pode alterar a situação do equipamento.` };
    }
    return { ok: true };
  }

  // Estados terminais só saem por correção/reversão auditada.
  if (statusAtual && STATUS_TERMINAIS.includes(statusAtual)) {
    return {
      ok: false,
      motivo: `Equipamento em "${statusAtual}" só pode ser alterado por reversão excepcional autorizada.`,
    };
  }

  const origens = ORIGENS_PERMITIDAS[tipo];
  if (origens && statusAtual && !origens.includes(statusAtual)) {
    return {
      ok: false,
      motivo: `Não é possível "${tipo}" a partir de "${statusAtual}". Origens válidas: ${origens.join(', ')}.`,
    };
  }

  return { ok: true };
}

export function podeOperar(statusAtual: StatusEquipamento | undefined): boolean {
  if (!statusAtual) return false;
  return !STATUS_INDISPONIVEIS.includes(statusAtual);
}
