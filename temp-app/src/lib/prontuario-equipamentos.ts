/* eslint-disable @typescript-eslint/no-explicit-any */
import { bubbleApi, type LocacaoEquipamento } from '@/lib/bubble';

export interface EquipamentoVinculadoPaciente {
  id?: string;
  equipamento_id: string;
  nome: string;
  categoria: string;
  numero_serie: string;
  status_locacao: string;
  data_inicio: string;
  data_fim_previsto: string;
  valor_aluguel: number;
}

/** Acima disso, uma varredura paginada sai mais barata que N GETs individuais. */
const MAX_BUSCAS_INDIVIDUAIS = 25;

/**
 * `fk_paciente` é um campo do tipo "coisa" no Bubble: uma constraint com um id
 * que não é de um paciente do Bubble (paciente só do D1, cadastro manual, ids
 * de teste) volta 400 "object with this id does not exist". Nenhuma locação
 * pode apontar para esse id, então a resposta certa é "nenhum equipamento" —
 * sem a varredura completa, que daria o mesmo resultado bem mais caro.
 */
function idInexistenteNoBubble(erro: unknown): boolean {
  const e = erro as { response?: { status?: number; data?: any } };
  if (e?.response?.status !== 400) return false;
  const corpo = e.response.data;
  const mensagem = String(corpo?.body?.message ?? corpo?.message ?? '');
  return /object with this id does not exist/i.test(mensagem);
}

/**
 * Equipamentos locados para um paciente, consultando só o que é dele no Bubble.
 *
 * A versão anterior (dentro da rota `/dashboard`) baixava TODAS as locações e
 * TODOS os equipamentos da Data API — paginando de 100 em 100 — para depois
 * filtrar um paciente em memória. Era a parte mais lenta do prontuário.
 *
 * Agora: locações filtradas por `fk_paciente` no próprio Bubble e equipamentos
 * buscados por id. Id que não existe no Bubble: lista vazia (ver
 * `idInexistenteNoBubble`). Qualquer outra recusa (campo renomeado, regra de
 * privacidade) cai na varredura completa antiga em vez de sumir com os dados.
 */
export async function listarEquipamentosDoPaciente(pacienteId: string): Promise<EquipamentoVinculadoPaciente[]> {
  let locacoes: LocacaoEquipamento[];
  try {
    locacoes = await bubbleApi.getLocacoes([
      { key: 'fk_paciente', constraint_type: 'equals', value: pacienteId },
    ]);
  } catch (erro) {
    if (idInexistenteNoBubble(erro)) return [];
    console.warn('Bubble recusou o filtro fk_paciente em locações; usando varredura completa:', erro);
    locacoes = await bubbleApi.getLocacoes();
  }
  // Filtro defensivo também no caminho filtrado: nunca exibir locação de outro paciente.
  locacoes = locacoes.filter((l) => l.fk_paciente === pacienteId);
  if (locacoes.length === 0) return [];

  const ids = Array.from(new Set(locacoes.map((l) => l.fk_equipamento).filter(Boolean)));
  const equipamentos = new Map<string, any>();
  if (ids.length > MAX_BUSCAS_INDIVIDUAIS) {
    for (const e of await bubbleApi.getEquipamentos()) {
      if (e._id) equipamentos.set(e._id, e);
    }
  } else {
    const encontrados = await Promise.all(ids.map((id) => bubbleApi.getEquipamento(id).catch(() => null)));
    ids.forEach((id, i) => {
      if (encontrados[i]) equipamentos.set(id, encontrados[i]);
    });
  }

  return locacoes.map((loc) => {
    const equip = equipamentos.get(loc.fk_equipamento) || {};
    return {
      id: loc._id,
      equipamento_id: loc.fk_equipamento,
      nome: equip.txt_nome || (loc as any).txt_nome || 'Equipamento Hospitalar',
      categoria: equip.txt_categoria || 'Domiciliar',
      numero_serie: equip.txt_numero_serie || 'N/A',
      status_locacao: loc.txt_status || 'Ativo',
      data_inicio: loc.date_inicio,
      data_fim_previsto: loc.date_fim_previsto,
      valor_aluguel: loc.num_valor_aluguel,
    };
  });
}
