// Sonda os valores aceitos pelo option set OS_profissao (profissao_cooperado):
// POST descartável com cada label do dropdown da adesão + variantes com espaço
// à direita; 201 = aceito (deleta em seguida), 400 could not parse = rejeitado.
import { API, TOKEN, isLive } from './_env.mts';
const H = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

const LABELS = [
  'Enfermeiro (a)',
  'Técnico (a) de Enfermagem',
  'Médico (a)',
  'Fisioterapeuta',
  'Nutricionista',
  'Psicólogo (a)',
  'Técnico (a) de Laboratório',
  'Outros',
];

async function probe(label: string) {
  const r = await fetch(`${API}/obj/profissao_cooperado`, {
    method: 'POST',
    headers: H,
    body: JSON.stringify({ OS_profissao: label, txt_nome: '[probe] apagar' }),
  });
  const t = await r.text();
  if (r.status === 201) {
    try {
      const id = JSON.parse(t).id;
      if (id) await fetch(`${API}/obj/profissao_cooperado/${id}`, { method: 'DELETE', headers: H });
    } catch {}
    return 'ACEITO';
  }
  if (r.status === 400 && /could not parse/i.test(t)) return 'REJEITADO';
  return `<${r.status}> ${t.slice(0, 100)}`;
}

async function main() {
  console.log(`Alvo: ${API} (${isLive ? 'LIVE' : 'TEST'})\n`);
  for (const label of LABELS) {
    const semEspaco = await probe(label);
    const comEspaco = await probe(label + ' ');
    console.log(`"${label}" → ${semEspaco}   |   "${label} " (c/ espaço) → ${comEspaco}`);
  }
}

main().catch((e) => {
  console.error('Falha:', e.message);
  process.exit(1);
});
