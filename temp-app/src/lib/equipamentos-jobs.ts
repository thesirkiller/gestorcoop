import { bubbleApi, AlertaEquipamento, TipoAlertaEquipamento } from './bubble';

// Lógica das rotinas operacionais (geração de alertas e expiração de reservas),
// compartilhada entre a rota autenticada da UI (/api/gestor/...) e a rota de
// cron protegida por segredo (/api/cron/...). Mantém uma única fonte de verdade.

type NovoAlerta = Omit<AlertaEquipamento, '_id' | 'CreatedDate'>;

export interface ResultadoGerarAlertas {
  criados: number;
  porTipo: Partial<Record<TipoAlertaEquipamento, number>>;
  falhas: Array<{ chave: string; erro: string }>;
}

// Varre os dados operacionais e cria alertas idempotentes (uma chave estável
// por pendência; só cria se ainda não houver alerta aberto com a mesma chave).
export async function gerarAlertas(): Promise<ResultadoGerarAlertas> {
  const agora = new Date();
  const hojeIso = agora.toISOString();
  const hojeData = hojeIso.slice(0, 10);
  const em30diasIso = new Date(agora.getTime() + 30 * 86_400_000).toISOString().slice(0, 10);

  const porTipo: Partial<Record<TipoAlertaEquipamento, number>> = {};
  const falhas: Array<{ chave: string; erro: string }> = [];
  let criados = 0;

  const criarSeInexistente = async (chave: string, alerta: NovoAlerta) => {
    try {
      const existente = await bubbleApi.getAlertaPorChave(chave);
      if (existente) return;
      await bubbleApi.criarAlerta(alerta);
      criados += 1;
      porTipo[alerta.os_tipo_alerta] = (porTipo[alerta.os_tipo_alerta] || 0) + 1;
    } catch (error) {
      const err = error as { message?: string };
      falhas.push({ chave, erro: err.message || 'Erro desconhecido' });
    }
  };

  // 1) RESERVAS VENCIDAS
  try {
    const reservasVencidas = await bubbleApi.getReservasVencidas(hojeIso);
    for (const reserva of reservasVencidas) {
      if (!reserva._id) continue;
      const chave = `alerta-reserva-vencida-${reserva._id}`;
      await criarSeInexistente(chave, {
        fk_equipamento: reserva.fk_equipamento,
        os_tipo_alerta: 'Reserva vencida',
        txt_titulo: 'Reserva vencida',
        txt_descricao: `A reserva ${reserva._id} ultrapassou a data de validade (${(reserva.date_validade || '').slice(0, 10)}).`,
        date_prazo: reserva.date_validade,
        txt_prioridade: 'Média',
        txt_status: 'Aberto',
        txt_chave_idempotencia: chave,
      });
    }
  } catch (error) {
    const err = error as { message?: string };
    falhas.push({ chave: 'reservas-vencidas', erro: err.message || 'Falha ao varrer reservas vencidas.' });
  }

  // 2) RECOLHIMENTOS ATRASADOS (locações ativas vencidas e sem devolução)
  try {
    const locacoesAtivas = await bubbleApi.getLocacoes([
      { key: 'OS_status', constraint_type: 'equals', value: 'Ativo' },
    ]);
    for (const locacao of locacoesAtivas) {
      const fimPrevisto = (locacao.date_fim_previsto || '').slice(0, 10);
      if (!fimPrevisto || fimPrevisto >= hojeData) continue;
      if (locacao.date_fim_real) continue;
      const chave = `alerta-recolhimento-${locacao._id}`;
      await criarSeInexistente(chave, {
        fk_equipamento: locacao.fk_equipamento,
        fk_locacao_equipamento: locacao._id,
        os_tipo_alerta: 'Recolhimento atrasado',
        txt_titulo: 'Recolhimento atrasado',
        txt_descricao: `A locação ${locacao._id} passou da data prevista de término (${fimPrevisto}) sem recolhimento.`,
        date_prazo: locacao.date_fim_previsto,
        txt_prioridade: 'Alta',
        txt_status: 'Aberto',
        txt_chave_idempotencia: chave,
      });
    }
  } catch (error) {
    const err = error as { message?: string };
    falhas.push({ chave: 'recolhimentos-atrasados', erro: err.message || 'Falha ao varrer locações ativas.' });
  }

  // 3) EQUIPAMENTOS: preventiva vencida, garantia próxima, conferência pendente, extravio
  try {
    const equipamentos = await bubbleApi.getEquipamentos();
    for (const equipamento of equipamentos) {
      if (!equipamento._id) continue;
      const equipId = equipamento._id;
      const nome = equipamento.txt_nome || equipId;

      const proximaPreventiva = (equipamento.date_proxima_preventiva || '').slice(0, 10);
      if (proximaPreventiva && proximaPreventiva < hojeData) {
        const chave = `alerta-preventiva-${equipId}`;
        await criarSeInexistente(chave, {
          fk_equipamento: equipId,
          os_tipo_alerta: 'Preventiva vencida',
          txt_titulo: 'Preventiva vencida',
          txt_descricao: `A manutenção preventiva de "${nome}" venceu em ${proximaPreventiva}.`,
          date_prazo: equipamento.date_proxima_preventiva,
          txt_prioridade: 'Média',
          txt_status: 'Aberto',
          txt_chave_idempotencia: chave,
        });
      }

      const fimGarantia = (equipamento.date_fim_garantia || '').slice(0, 10);
      if (fimGarantia && fimGarantia >= hojeData && fimGarantia <= em30diasIso) {
        const chave = `alerta-garantia-${equipId}`;
        await criarSeInexistente(chave, {
          fk_equipamento: equipId,
          os_tipo_alerta: 'Garantia próxima do vencimento',
          txt_titulo: 'Garantia próxima do vencimento',
          txt_descricao: `A garantia de "${nome}" vence em ${fimGarantia}.`,
          date_prazo: equipamento.date_fim_garantia,
          txt_prioridade: 'Baixa',
          txt_status: 'Aberto',
          txt_chave_idempotencia: chave,
        });
      }

      if (equipamento.txt_status === 'Recolhido e aguardando conferência') {
        const chave = `alerta-conferencia-${equipId}`;
        await criarSeInexistente(chave, {
          fk_equipamento: equipId,
          os_tipo_alerta: 'Conferência pendente',
          txt_titulo: 'Conferência pendente',
          txt_descricao: `O equipamento "${nome}" foi recolhido e aguarda conferência.`,
          txt_prioridade: 'Média',
          txt_status: 'Aberto',
          txt_chave_idempotencia: chave,
        });
      }

      if (equipamento.txt_status === 'Extraviado') {
        const chave = `alerta-extravio-${equipId}`;
        await criarSeInexistente(chave, {
          fk_equipamento: equipId,
          os_tipo_alerta: 'Equipamento extraviado',
          txt_titulo: 'Equipamento extraviado',
          txt_descricao: `O equipamento "${nome}" está marcado como extraviado.`,
          txt_prioridade: 'Crítica',
          txt_status: 'Aberto',
          txt_chave_idempotencia: chave,
        });
      }
    }
  } catch (error) {
    const err = error as { message?: string };
    falhas.push({ chave: 'equipamentos', erro: err.message || 'Falha ao varrer equipamentos.' });
  }

  return { criados, porTipo, falhas };
}

export interface ResultadoExpirarReservas {
  expiradas: number;
  falhas: Array<{ reservaId?: string; error: string }>;
}

// Expira reservas cuja validade passou: marca 'Expirada' e devolve o
// equipamento para 'Disponível'. Erros por item não abortam o lote.
export async function expirarReservas(): Promise<ResultadoExpirarReservas> {
  const vencidas = await bubbleApi.getReservasVencidas(new Date().toISOString());
  let expiradas = 0;
  const falhas: Array<{ reservaId?: string; error: string }> = [];

  for (const reserva of vencidas) {
    const reservaId = reserva._id;
    try {
      if (!reservaId) throw new Error('Reserva sem identificador.');
      await bubbleApi.atualizarReservaEquipamento(reservaId, { txt_status: 'Expirada' });
      await bubbleApi.registrarMovimentacao({
        fk_equipamento: reserva.fk_equipamento,
        os_tipo_movimentacao: 'Cancelamento de reserva',
        txt_novo_status: 'Disponível',
        txt_justificativa: 'Reserva expirada automaticamente.',
        txt_status_esperado: 'Reservado',
        txt_chave_idempotencia: `reserva-expirar-${reservaId}`,
      });
      expiradas += 1;
    } catch (error) {
      const err = error as { message?: string };
      falhas.push({ reservaId, error: err.message || 'Erro ao expirar a reserva.' });
    }
  }

  return { expiradas, falhas };
}

// Autorização do cron: exige `Authorization: Bearer <CRON_SECRET>`. Falha
// fechada — sem o segredo configurado no ambiente, nenhuma chamada passa.
export function cronAutorizado(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get('authorization') || '';
  return auth === `Bearer ${secret}`;
}
