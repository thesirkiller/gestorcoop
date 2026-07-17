// Diagnóstico pontual: inspeciona os cadastros de cooperado mais recentes e
// seus sub-registros (profissões/contas) para localizar onde a adesão quebrou.
import { API, TOKEN, isLive } from './_env.mts';
import axios from 'axios';

const client = axios.create({
  baseURL: API,
  headers: { Authorization: `Bearer ${TOKEN}` },
});

async function main() {
  console.log(`Alvo: ${API} (${isLive ? 'LIVE' : 'TEST'})`);

  const desde = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();
  const constraints = JSON.stringify([
    { key: 'Created Date', constraint_type: 'greater than', value: desde },
  ]);
  const res = await client.get(`/obj/socioscooperados?constraints=${constraints}&sort_field=Created Date&descending=true&limit=10`);
  const results = res.data.response.results || [];
  console.log(`Cooperados criados nos últimos 3 dias: ${results.length}\n`);

  for (const c of results) {
    console.log('────────────────────────────────');
    console.log('id:', c._id);
    console.log('criado:', c['Created Date']);
    console.log('nome:', c.txt_nomeCompleto);
    console.log('cpf:', c.txt_CPF);
    console.log('email:', c.txt_email);
    console.log('termo_status:', c.txt_termo_status);
    console.log('fks_Profissões (com espaço):', JSON.stringify(c['fks_Profissões ']));
    console.log('fks_Profissões (sem espaço):', JSON.stringify(c['fks_Profissões']));
    console.log('fks_profissoes (options):', JSON.stringify(c.fks_profissoes));
    console.log('fks_ContasBancarias:', JSON.stringify(c.fks_ContasBancarias));
    console.log('fks_pasta:', JSON.stringify(c.fks_pasta));

    // Sub-registros apontando para este cooperado
    const profConstraints = JSON.stringify([
      { key: 'fk_socio_cooperado', constraint_type: 'equals', value: c._id },
    ]);
    const profs = await client.get(`/obj/profissao_cooperado?constraints=${profConstraints}`);
    console.log('profissoes vinculadas:', (profs.data.response.results || []).map((p: any) => ({ id: p._id, nome: p.txt_nome, os: p.OS_profissao, conselho: p.txt_conselho })));

    const contaConstraints = JSON.stringify([
      { key: 'fk_cooperado', constraint_type: 'equals', value: c._id },
    ]);
    const contas = await client.get(`/obj/conta_cooperado?constraints=${contaConstraints}`);
    console.log('contas vinculadas:', (contas.data.response.results || []).map((b: any) => ({ id: b._id, banco: b.txt_banco, agencia: b.txt_agencia })));
  }
}

main().catch((e) => {
  console.error('Falha:', e?.response?.status, JSON.stringify(e?.response?.data || e.message, null, 2));
  process.exit(1);
});
