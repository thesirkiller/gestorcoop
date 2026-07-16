// Probe do contrato de schema no Bubble Data API alvo (test por padrão; aponte
// para o live via BUBBLE_API_URL). Para cada campo faz um GET com constraint
// is_not_empty: HTTP 200 => campo existe; 404 "Field not found" => faltando.
// Read-only (não escreve nada).
//
// Uso:
//   npx tsx scripts/probar-schema.mts
//   BUBBLE_API_URL=https://gestorcoop.app/api/1.1 npx tsx scripts/probar-schema.mts
import { API, TOKEN, isLive } from './_env.mts';

// Contrato tipo => campos (nomes lógicos na Data API), alinhado ao src/lib/bubble.ts.
const CONTRATO: Record<string, string[]> = {
  movimentacao_equipamento: ['fk_equipamento','fk_locacao','fk_ordem_servico_manutencao','fk_domicilio','fk_localizacao_anterior','fk_localizacao_nova','os_tipo_evento','txt_tipo_evento','os_status_anterior','os_status_novo','date_data_hora','txt_responsavel_operacao','txt_observacoes','txt_justificativa','txt_chave_idempotencia','bool_cancelado'],
  reserva_equipamento: ['fk_equipamento','fk_paciente','fk_domicilio','date_data_reserva','date_prevista_implantacao','date_validade','txt_responsavel','txt_observacoes','os_status','txt_chave_idempotencia','fk_movimentacao_reserva','date_cancelamento','txt_motivo_cancelamento'],
  ordem_servico_manutencao: ['txt_numero_os','fk_equipamento','fk_movimentacao_entrada','date_entrada','date_diagnostico','date_conclusao','date_previsao_conclusao','txt_motivo','txt_defeito_relatado','txt_defeito_encontrado','txt_causa_provavel','txt_servico_recomendado','txt_responsavel','txt_responsavel_tecnico','txt_observacoes','os_status','os_resultado','num_orcamento','num_custo_pecas','num_custo_mao_obra','num_custo_frete','num_outros_custos','num_custo_total'],
  conferencia_equipamento: ['fk_equipamento','fk_movimentacao','date_conferencia','txt_responsavel','txt_estado_conservacao','txt_resultado','os_status_destino','txt_observacoes'],
  higienizacao_equipamento: ['fk_equipamento','date_inicio','date_conclusao','txt_metodo','txt_resultado','txt_responsavel','os_status','txt_observacoes'],
  baixa_equipamento: ['fk_equipamento','date_solicitacao','os_motivo','txt_laudo_tecnico','num_valor_reparo_estimado','num_valor_residual','txt_destino_final','txt_solicitante','txt_autorizado_por','os_status','txt_observacoes_decisao','date_decisao','date_baixa_efetiva','bool_revertida','txt_revertida_por','txt_revertida_por_segundo','txt_justificativa_reversao','date_reversao'],
  item_manutencao: ['fk_ordem_servico','txt_tipo','txt_descricao','num_quantidade','num_valor_unitario','num_valor_total','txt_fornecedor','txt_responsavel'],
  alerta_equipamento: ['fk_equipamento','fk_locacao','fk_ordem_servico','os_tipo','txt_titulo','txt_detalhe','date_vencimento','txt_prioridade','txt_responsavel','os_status','txt_chave_idempotencia','txt_resolucao','date_resolucao'],
};

async function probe(tipo: string, campo: string) {
  const c = encodeURIComponent(JSON.stringify([{ key: campo, constraint_type: 'is_not_empty' }]));
  const r = await fetch(`${API}/obj/${tipo}?constraints=${c}&limit=1`, { headers: { Authorization: `Bearer ${TOKEN}` } });
  return r.status;
}

async function main() {
  console.log(`== Probe do schema — alvo: ${isLive ? 'LIVE' : 'version-test'} (${API}) ==`);
  let ok = 0, miss = 0;
  const misses: string[] = [];
  for (const [tipo, campos] of Object.entries(CONTRATO)) {
    let c = 0;
    for (const campo of campos) {
      if (await probe(tipo, campo) === 200) c++;
      else { miss++; misses.push(`${tipo}.${campo}`); }
    }
    ok += c;
    console.log(`${c === campos.length ? '✅' : '❌'} ${tipo}: ${c}/${campos.length}`);
  }
  console.log(`\n=== TOTAL: ${ok} OK / ${miss} MISS ===`);
  if (misses.length) console.log('MISS:', misses.join(', '));
  process.exit(miss ? 1 : 0);
}
main();
