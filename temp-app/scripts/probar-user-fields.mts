// Diagnóstico: lista os campos dos registros de user (para o header do painel).
import { API, TOKEN } from './_env.mts';
import axios from 'axios';

const c = axios.create({ baseURL: API, headers: { Authorization: `Bearer ${TOKEN}` } });

async function main() {
  const r = await c.get('/obj/user?limit=3');
  for (const u of r.data.response.results) {
    console.log(JSON.stringify(u, null, 1).slice(0, 1200));
    console.log('────────');
  }
}

main().catch((e) => {
  console.error('ERR', e?.response?.status, e.message);
  process.exit(1);
});
