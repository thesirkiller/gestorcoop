// Homologação ponta a ponta do módulo de equipamentos V2.
// Exercita os fluxos reais via bubbleApi contra o Bubble Data API alvo
// (test por padrão; aponte para o live via BUBBLE_API_URL) e valida que cada
// valor de option set persiste (lê de volta e compara). Cria registros de teste
// e os REMOVE ao final — inclusive um equipamento descartável cujo status é
// mutado pela máquina de estados.
//
// Uso:
//   npx tsx scripts/homologacao-equipamentos.mts           # usa .env.local (test)
//   BUBBLE_API_URL=https://gestorcoop.app/api/1.1 npx tsx scripts/homologacao-equipamentos.mts  # live
import { API, TOKEN, isLive } from './_env.mts';

const { bubbleApi } = await import('../src/lib/bubble.ts');

async function del(tipo: string, id: string) {
  try {
    const r = await fetch(`${API}/obj/${tipo}/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${TOKEN}` } });
    return r.status;
  } catch { return 'ERR'; }
}
async function raw(tipo: string, id: string) {
  return (await (await fetch(`${API}/obj/${tipo}/${id}`, { headers: { Authorization: `Bearer ${TOKEN}` } })).json()).response;
}

const criados: Array<[string, string]> = [];
const track = (tipo: string, id?: string) => { if (id) criados.push([tipo, id]); return id; };

let pass = 0, fail = 0;
const warns: string[] = [];
const ok = (cond: boolean, msg: string) => { if (cond) { pass++; console.log(`  ✅ ${msg}`); } else { fail++; console.log(`  ❌ ${msg}`); } };
const warn = (m: string) => { warns.push(m); console.log(`  ⚠️  ${m}`); };

const ts = Date.now();
const iso = (d = new Date()) => d.toISOString();

async function main() {
  console.log(`== Homologação equipamentos V2 — alvo: ${isLive ? 'LIVE ⚠️' : 'version-test'} (${API}) ==`);
  if (isLive) console.log('   (cria e apaga registros descartáveis em produção)');

  console.log('\n== Setup: equipamento de teste ==');
  const eq = await bubbleApi.createEquipamento({
    txt_nome: `HOMOLOG ${ts}`, txt_descricao: 'teste homologação — apagar',
    txt_marca: 'X', txt_modelo: 'Y', txt_numero_serie: `SN-${ts}`,
    num_preco_padrao: 100, txt_status: 'Disponível',
  } as any);
  track('equipamento', eq._id);
  const eqId = eq._id!;
  const eqCheck = await bubbleApi.getEquipamento(eqId);
  ok(eqCheck.txt_status === 'Disponível', `equipamento criado com status Disponível (lido: "${eqCheck.txt_status}")`);

  // ---------- Reserva: criar → cancelar ----------
  console.log('\n== Cenário 1: Reserva criar → cancelar ==');
  const reserva = await bubbleApi.criarReservaEquipamento({
    fk_equipamento: eqId, fk_paciente: '', fk_domicilio: '',
    date_reserva: iso(), date_implantacao_prevista: iso(), date_validade: iso(new Date(ts + 86400000)),
    txt_responsavel: 'Homolog', txt_observacoes: 'reserva teste', txt_status: 'Ativa',
    txt_chave_idempotencia: `res-${ts}`,
  } as any);
  track('reserva_equipamento', reserva._id);
  const r1 = await bubbleApi.getReserva(reserva._id!);
  ok(r1?.txt_status === 'Ativa', `reserva os_status persiste "Ativa" (lido: "${r1?.txt_status}")`);
  ok(r1?.fk_equipamento === eqId, 'reserva fk_equipamento linkado');
  await bubbleApi.atualizarReservaEquipamento(reserva._id!, {
    txt_status: 'Cancelada', date_cancelamento: iso(), txt_motivo_cancelamento: 'homolog',
  } as any);
  const r2 = await bubbleApi.getReserva(reserva._id!);
  ok(r2?.txt_status === 'Cancelada', `reserva cancelada os_status "Cancelada" (lido: "${r2?.txt_status}")`);
  const r2raw = await raw('reserva_equipamento', reserva._id!);
  ok(!!r2raw?.date_cancelamento, 'reserva date_cancelamento gravado');
  ok(r2raw?.txt_motivo_cancelamento === 'homolog', 'reserva txt_motivo_cancelamento gravado');

  // ---------- Movimentação: máquina de estados + idempotência ----------
  console.log('\n== Cenário 2: Movimentação (estado + idempotência) ==');
  const chaveMov = `mov-${ts}`;
  const mov = await bubbleApi.registrarMovimentacao({
    fk_equipamento: eqId, os_tipo_movimentacao: 'Reserva', txt_novo_status: 'Reservado',
    txt_responsavel: 'Homolog', txt_observacoes: 'mov teste', txt_chave_idempotencia: chaveMov,
  } as any);
  track('movimentacao_equipamento', mov._id);
  ok(!!mov._id, 'movimentação Reserva (Disponível→Reservado) criada');
  const eqAposMov = await bubbleApi.getEquipamento(eqId);
  ok(eqAposMov.txt_status === 'Reservado', `equipamento atualizado p/ "Reservado" (lido: "${eqAposMov.txt_status}")`);
  const movRaw = await raw('movimentacao_equipamento', mov._id!);
  ok(movRaw?.os_status_anterior === 'Disponível', `mov os_status_anterior "Disponível" (lido: "${movRaw?.os_status_anterior}")`);
  ok(movRaw?.os_status_novo === 'Reservado', `mov os_status_novo "Reservado" (lido: "${movRaw?.os_status_novo}")`);
  ok(movRaw?.os_tipo_evento === 'Reserva', `mov os_tipo_evento "Reserva" (lido: "${movRaw?.os_tipo_evento}")`);
  const movDup = await bubbleApi.registrarMovimentacao({
    fk_equipamento: eqId, os_tipo_movimentacao: 'Reserva', txt_novo_status: 'Reservado',
    txt_responsavel: 'Homolog', txt_chave_idempotencia: chaveMov,
  } as any);
  ok(movDup._id === mov._id, `idempotência: 2ª chamada retorna a mesma movimentação (${movDup._id === mov._id})`);
  let rejeitou = false;
  try {
    await bubbleApi.registrarMovimentacao({
      fk_equipamento: eqId, os_tipo_movimentacao: 'Recolhimento', txt_novo_status: 'Recolhido e aguardando conferência',
      txt_responsavel: 'Homolog', txt_chave_idempotencia: `mov-inv-${ts}`,
    } as any);
  } catch { rejeitou = true; }
  ok(rejeitou, 'máquina de estados rejeita Recolhimento a partir de Reservado');

  // ---------- OS de manutenção: criar → item → custo ----------
  console.log('\n== Cenário 3: OS manutenção → item → recálculo de custo ==');
  const os = await bubbleApi.criarOrdemServicoManutencao({
    txt_numero_os: `OS-${ts}`, fk_equipamento: eqId, date_entrada: iso(),
    txt_motivo: 'preventiva', txt_defeito_relatado: 'ruído', txt_responsavel: 'Homolog',
    txt_observacoes: 'os teste', txt_status: 'Aberta', num_custo_total: 0,
  } as any);
  track('ordem_servico_manutencao', os._id);
  const osRaw = await raw('ordem_servico_manutencao', os._id!);
  ok(osRaw?.os_status === 'Aberta', `OS os_status "Aberta" (lido: "${osRaw?.os_status}")`);
  const item = await bubbleApi.criarItemManutencao({
    fk_ordem_servico_manutencao: os._id!, txt_tipo: 'Peça', txt_descricao: 'filtro',
    num_quantidade: 2, num_custo_unitario: 30, txt_fornecedor: 'ACME', txt_responsavel: 'Homolog',
  } as any);
  track('item_manutencao', item._id);
  ok(item.num_custo_total === 60, `item recalcula custo total 2×30=60 (calc: ${item.num_custo_total})`);
  const itens = await bubbleApi.getItensManutencao(os._id!);
  ok(itens.length === 1 && itens[0].num_custo_total === 60, 'getItensManutencao lê item com custo correto');
  await bubbleApi.atualizarOrdemServicoManutencao(os._id!, { txt_status: 'Em execução', txt_resultado: 'Reparado e liberado' } as any);
  const os2 = await raw('ordem_servico_manutencao', os._id!);
  ok(os2?.os_status === 'Em execução', `OS atualizada os_status "Em execução" (lido: "${os2?.os_status}")`);
  ok(os2?.os_resultado === 'Reparado e liberado', `OS os_resultado (lido: "${os2?.os_resultado}")`);

  // ---------- Baixa: solicitar → aprovar → reverter ----------
  console.log('\n== Cenário 4: Baixa solicitar → aprovar → reverter ==');
  const baixa = await bubbleApi.criarBaixaEquipamento({
    fk_equipamento: eqId, date_baixa: iso(), os_motivo_baixa: 'Sem reparo', txt_laudo: 'laudo homolog',
    num_valor_reparo_estimado: 500, num_valor_residual: 50, txt_destino_final: 'Descarte',
    txt_solicitante: 'Solicitante', txt_status: 'Pendente de aprovação', txt_observacoes: 'baixa teste',
  } as any);
  track('baixa_equipamento', baixa._id);
  const bx1 = await raw('baixa_equipamento', baixa._id!);
  ok(bx1?.os_status === 'Pendente de aprovação', `baixa os_status "Pendente de aprovação" (lido: "${bx1?.os_status}")`);
  ok(bx1?.os_motivo === 'Sem reparo', `baixa os_motivo "Sem reparo" (lido: "${bx1?.os_motivo}")`);
  await bubbleApi.atualizarBaixaEquipamento(baixa._id!, {
    txt_status: 'Aprovada', txt_autorizado_por: 'Gestor A', date_decisao: iso(), date_baixa_efetiva: iso(),
  } as any);
  const bx2 = await raw('baixa_equipamento', baixa._id!);
  ok(bx2?.os_status === 'Aprovada', `baixa aprovada os_status "Aprovada" (lido: "${bx2?.os_status}")`);
  ok(!!bx2?.date_baixa_efetiva, 'baixa date_baixa_efetiva gravado');
  await bubbleApi.atualizarBaixaEquipamento(baixa._id!, {
    bool_revertida: true, txt_revertida_por: 'Gestor A', txt_revertida_por_segundo: 'Gestor B',
    txt_justificativa_reversao: 'engano', date_reversao: iso(),
  } as any);
  const bx3 = await raw('baixa_equipamento', baixa._id!);
  ok(bx3?.bool_revertida === true, 'baixa bool_revertida gravado');
  ok(bx3?.txt_revertida_por_segundo === 'Gestor B', 'baixa dupla autorização (2º revertida_por) gravado');

  // ---------- Alerta: criar + idempotência por chave ----------
  console.log('\n== Cenário 5: Alerta criar + idempotência por chave ==');
  const chaveAlerta = `alr-${ts}`;
  const alerta = await bubbleApi.criarAlerta({
    fk_equipamento: eqId, os_tipo_alerta: 'Conferência pendente', txt_titulo: 'Conferência pendente',
    txt_descricao: 'homolog', date_prazo: iso(new Date(ts + 86400000)), txt_prioridade: 'Alta',
    txt_responsavel: 'Homolog', txt_status: 'Aberto', txt_chave_idempotencia: chaveAlerta,
  } as any);
  track('alerta_equipamento', alerta._id);
  const alRaw = await raw('alerta_equipamento', alerta._id!);
  ok(alRaw?.os_tipo === 'Conferência pendente', `alerta os_tipo (lido: "${alRaw?.os_tipo}")`);
  ok(alRaw?.os_status === 'Aberto', `alerta os_status "Aberto" (lido: "${alRaw?.os_status}")`);
  const achado = await bubbleApi.getAlertaPorChave(chaveAlerta);
  ok(achado?._id === alerta._id, 'getAlertaPorChave encontra o alerta aberto (idempotência)');

  // ---------- Suspensão de locação (se houver locação) ----------
  console.log('\n== Cenário 6: Suspensão de locação (opcional) ==');
  const locs = await (await fetch(`${API}/obj/locacao_equipamento?limit=1`, { headers: { Authorization: `Bearer ${TOKEN}` } })).json();
  const loc = locs.response?.results?.[0];
  if (loc?._id) {
    const susp = await bubbleApi.criarSuspensaoLocacao({
      fk_locacao_equipamento: loc._id, date_inicio: iso(), date_fim: iso(new Date(ts + 86400000)),
      txt_motivo: 'homolog', txt_responsavel: 'Homolog',
    } as any);
    track('suspensao_locacao', susp._id);
    const susList = await bubbleApi.getSuspensoesLocacao(loc._id);
    ok(susList.some((s) => s._id === susp._id), 'suspensão criada e listada');
  } else {
    warn('sem locacao_equipamento existente — cenário de suspensão pulado');
  }

  console.log(`\n=== RESUMO: ${pass} ✅ / ${fail} ❌ / ${warns.length} ⚠️ ===`);
  warns.forEach((w) => console.log(`  ⚠️  ${w}`));
}

main()
  .catch((e) => { console.error('ERRO FATAL:', e?.message || e); fail++; })
  .finally(async () => {
    console.log('\n== Limpeza ==');
    for (const [tipo, id] of criados.reverse()) console.log(`  del ${tipo}/${id} → ${await del(tipo, id)}`);
    console.log(fail ? '\nHOMOLOGAÇÃO COM FALHAS' : '\nHOMOLOGAÇÃO OK');
    process.exit(fail ? 1 : 0);
  });
