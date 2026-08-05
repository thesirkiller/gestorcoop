import { Domicilio, Equipamento, LocacaoEquipamento, Paciente } from '@/lib/bubble';

// NOTA DE VOCABULÁRIO: `Paciente` é o nome do tipo no Bubble; na interface a
// entidade se chama "Cliente". Ver nota em bubble.ts.

export interface ItemRomaneio {
  locacaoId: string;
  equipamentoId: string;
  nome: string;
  marcaModelo: string;
  numeroSerie: string;
  dataInicio: string;
  selecionado: boolean;
}

export interface DadosRomaneio {
  numero: string;
  dataEmissao: string;
  cliente: Paciente;
  enderecoEntrega: string;
  pontoReferencia?: string;
  instrucoesAcesso?: string;
  contatoLocal?: string;
  itens: ItemRomaneio[];
}

/**
 * Numeração estável para reimpressão no mesmo dia: ROM-AAAAMMDD-XXXX.
 * A numeração sequencial real chega na Fase 3, com persistência no Bubble.
 */
export function gerarNumeroRomaneio(clienteId: string, data = new Date()): string {
  const ymd = data.toISOString().slice(0, 10).replace(/-/g, '');
  const sufixo = (clienteId || '').slice(-4).toUpperCase().padStart(4, '0');
  return `ROM-${ymd}-${sufixo}`;
}

/**
 * Monta os itens do romaneio a partir das locações ativas do cliente.
 * Locações sem equipamento correspondente são descartadas — sem o cadastro do
 * equipamento não há o que imprimir na linha.
 */
export function montarItens(
  locacoes: LocacaoEquipamento[],
  equipamentos: Equipamento[],
  preSelecionados?: string[],
): ItemRomaneio[] {
  return locacoes
    .filter((l) => l.txt_status === 'Ativo' && l._id)
    .map((l) => {
      const eq = equipamentos.find((e) => e._id === l.fk_equipamento);
      if (!eq?._id) return null;
      const item: ItemRomaneio = {
        locacaoId: l._id as string,
        equipamentoId: eq._id,
        nome: eq.txt_nome,
        marcaModelo: [eq.txt_marca, eq.txt_modelo].filter(Boolean).join(' ') || '—',
        numeroSerie: eq.txt_numero_serie || eq.txt_numero_patrimonio || '—',
        dataInicio: l.date_inicio,
        selecionado: !preSelecionados?.length || preSelecionados.includes(l._id as string),
      };
      return item;
    })
    .filter((i): i is ItemRomaneio => i !== null);
}

/** O domicílio ativo tem prioridade sobre o endereço legado do cadastro. */
export function resolverEnderecoEntrega(cliente: Paciente, domicilio?: Domicilio): string {
  return domicilio?.geo_endereco || cliente.txt_endereco || '';
}

/** Formata uma data ISO como dd/mm/aaaa; devolve travessão quando ausente ou inválida. */
export function formatarData(iso?: string): string {
  if (!iso) return '—';
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return '—';
  return data.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}
