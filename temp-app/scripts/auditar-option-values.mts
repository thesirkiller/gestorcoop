// Audita valores de option set no Bubble Data API alvo (test por padrão; aponte
// para o live via BUBBLE_API_URL): para cada set, tenta gravar cada label num
// registro descartável (POST); 201 => valor existe, 400 "could not parse" =>
// valor FALTANDO. Não deixa nada permanente (deleta o registro de teste).
// Escreve os faltantes em scripts/_missing_values.json.
//
// Uso:
//   npx tsx scripts/auditar-option-values.mts
//   BUBBLE_API_URL=https://gestorcoop.app/api/1.1 npx tsx scripts/auditar-option-values.mts
import fs from 'node:fs';
import { API, TOKEN, isLive } from './_env.mts';
const H = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

async function post(tipo: string, body: any) {
  const r = await fetch(`${API}/obj/${tipo}`, { method: 'POST', headers: H, body: JSON.stringify(body) });
  return { s: r.status, t: await r.text() };
}
async function del(tipo: string, id: string) {
  await fetch(`${API}/obj/${tipo}/${id}`, { method: 'DELETE', headers: H }).catch(() => {});
}

// set => { tipo, campo (nome do field na Data API), labels exigidos pelo código }
const SETS: Record<string, { tipo: string; campo: string; labels: string[] }> = {
  os_status_equipamento: { tipo: 'equipamento', campo: 'OS_status', labels: [
    'Aguardando conferência','Disponível','Reservado','Em transporte para implantação','Implantado no domicílio',
    'Em transporte para recolhimento','Recolhido e aguardando conferência','Aguardando higienização','Em higienização',
    'Manutenção','Aguardando peça','Liberado pela manutenção','Bloqueado','Extraviado','Condenado','Baixado','Alugado','Inativo'] },
  os_os_tipo_movimentacao_equipamento: { tipo: 'movimentacao_equipamento', campo: 'os_tipo_evento', labels: [
    'Cadastro','Entrada no estoque','Alteração cadastral','Reserva','Cancelamento de reserva','Implantação','Recolhimento',
    'Transferência','Higienização','Manutenção','Calibração','Bloqueio','Liberação','Extravio','Baixa','Correção'] },
  os_status_reserva_equipamento: { tipo: 'reserva_equipamento', campo: 'os_status', labels: [
    'Ativa','Cancelada','Expirada','Convertida em implantação'] },
  os_status_ordem_servico_manutencao: { tipo: 'ordem_servico_manutencao', campo: 'os_status', labels: [
    'Aberta','Em diagnóstico','Aguardando aprovação','Aguardando peça','Em execução','Em teste','Liberada','Reprovada',
    'Sem reparo','Baixa recomendada','Cancelada'] },
  os_resultado_ordem_servico_manutencao: { tipo: 'ordem_servico_manutencao', campo: 'os_resultado', labels: [
    'Reparado e liberado','Reparado com restrições','Aguardando peça','Sem defeito identificado','Reparo não aprovado',
    'Sem reparo possível','Recomendado para baixa'] },
  os_status_baixa_equipamento: { tipo: 'baixa_equipamento', campo: 'os_status', labels: [
    'Pendente de aprovação','Aprovada','Reprovada','Cancelada'] },
  os_motivo_baixa_equipamento: { tipo: 'baixa_equipamento', campo: 'os_motivo', labels: [
    'Sem reparo','Custo inviável','Obsolescência','Extravio','Outro'] },
  os_status_higienizacao_equipamento: { tipo: 'higienizacao_equipamento', campo: 'os_status', labels: [
    'Aprovada','Reprovada','Em andamento'] },
  os_tipo_alerta_equipamento: { tipo: 'alerta_equipamento', campo: 'os_tipo', labels: [
    'Recolhimento atrasado','Implantação prevista não realizada','Preventiva vencida','Calibração vencida',
    'Garantia próxima do vencimento','Conferência pendente','Higienização parada','Manutenção parada',
    'Acessório não devolvido','Reserva vencida','Equipamento extraviado','Documentos pendentes'] },
  os_status_alerta_equipamento: { tipo: 'alerta_equipamento', campo: 'os_status', labels: [
    'Aberto','Em tratamento','Resolvido','Ignorado'] },
};

async function main() {
  console.log(`== Auditoria de valores de option set — alvo: ${isLive ? 'LIVE ⚠️' : 'version-test'} (${API}) ==`);
  const missing: Record<string, string[]> = {};
  for (const [set, { tipo, campo, labels }] of Object.entries(SETS)) {
    const miss: string[] = [];
    for (const label of labels) {
      const { s, t } = await post(tipo, { [campo]: label });
      if (s === 201) { try { const id = JSON.parse(t).id; if (id) await del(tipo, id); } catch {} }
      else if (s === 400 && /could not parse/i.test(t)) miss.push(label);
      else console.log(`  ?? ${set}/${label}: <${s}> ${t.slice(0, 120)}`);
    }
    console.log(`${miss.length ? '❌' : '✅'} ${set}: ${labels.length - miss.length}/${labels.length}${miss.length ? '  faltam: ' + miss.join(' | ') : ''}`);
    if (miss.length) missing[set] = miss;
  }
  fs.writeFileSync(new URL('./_missing_values.json', import.meta.url), JSON.stringify(missing, null, 2));
  const total = Object.values(missing).reduce((a, b) => a + b.length, 0);
  console.log(`\n=== ${total} valores faltando (gravados em scripts/_missing_values.json) ===`);
  process.exit(total ? 1 : 0);
}
main();
