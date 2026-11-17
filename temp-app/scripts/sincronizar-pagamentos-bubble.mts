// Sincroniza relatórios de pagamento mensal (`f-relatoriodepagamentomensal`) e
// sub-relatórios (`f_subrelatorio_pagamento`) diretamente na Data API do Bubble,
// além de garantir o vínculo do usuário Multcare Financeiro em `times_internos`.
//
// Uso:
//   npx tsx scripts/sincronizar-pagamentos-bubble.mts
//   npx tsx scripts/sincronizar-pagamentos-bubble.mts --relatorio 1794852125061x826397300200833000 --verificar
//   BUBBLE_API_URL=https://appgestorcoop.bubbleapps.io/api/1.1 npx tsx scripts/sincronizar-pagamentos-bubble.mts --verificar

import { API, TOKEN, isLive } from './_env.mts';
import { sincronizarRelatoriosPagamentoBubble } from '../src/lib/sincronizar-relatorios-pagamento';

const USER_MULTCARE_FINANCEIRO = '1791911068154x655640409738488200';
const TIMES_MULTCARE_FINANCEIRO = [
  { id: '1632422170934x102388045155663870', nome: 'FINANCEIRO' },
  { id: '1632309502144x630629120700317700', nome: 'Recursos Humanos' },
];

function lerArgs() {
  const argv = process.argv.slice(2);
  let relatorioId: string | undefined;
  let forcar = false;
  let limiteRelatorios = 100;
  let verificar = false;
  let semTimes = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--forcar') {
      forcar = true;
    } else if (arg === '--verificar') {
      verificar = true;
    } else if (arg === '--sem-times') {
      semTimes = true;
    } else if (arg.startsWith('--relatorio=')) {
      relatorioId = arg.slice('--relatorio='.length).trim() || undefined;
    } else if (arg === '--relatorio' && argv[i + 1]) {
      relatorioId = argv[++i].trim() || undefined;
    } else if (arg.startsWith('--limite=')) {
      const n = parseInt(arg.slice('--limite='.length), 10);
      if (Number.isFinite(n) && n > 0) limiteRelatorios = n;
    } else if (arg === '--limite' && argv[i + 1]) {
      const n = parseInt(argv[++i], 10);
      if (Number.isFinite(n) && n > 0) limiteRelatorios = n;
    }
  }

  return { relatorioId, forcar, limiteRelatorios, verificar, semTimes };
}

async function garantirUsuarioNosTimesInternos() {
  const baseUrl = String(API).replace(/\/+$/, '');
  const atualizados: string[] = [];

  for (const time of TIMES_MULTCARE_FINANCEIRO) {
    const res = await fetch(`${baseUrl}/obj/times_internos/${time.id}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    if (!res.ok) {
      throw new Error(`Falha ao consultar times_internos ${time.id} (${time.nome}): HTTP ${res.status}`);
    }
    const json = (await res.json()) as { response?: { fks_users?: string[]; txt_nome?: string } };
    const fksUsers = Array.isArray(json.response?.fks_users) ? json.response!.fks_users! : [];

    if (fksUsers.includes(USER_MULTCARE_FINANCEIRO)) {
      console.log(`✓ Time ${time.nome} (${time.id}) já contém usuário ${USER_MULTCARE_FINANCEIRO}.`);
      continue;
    }

    const novaLista = [...fksUsers, USER_MULTCARE_FINANCEIRO];
    const patchRes = await fetch(`${baseUrl}/obj/times_internos/${time.id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fks_users: novaLista }),
    });
    if (!patchRes.ok) {
      const errTxt = await patchRes.text();
      throw new Error(`Falha ao atualizar fks_users do time ${time.nome} (${patchRes.status}): ${errTxt}`);
    }
    atualizados.push(time.nome);
    console.log(`✓ Time ${time.nome} (${time.id}) atualizado com usuário ${USER_MULTCARE_FINANCEIRO} (${novaLista.length} usuários).`);
  }

  return atualizados;
}

async function verificarPosSync(relatorioEspecifico?: string) {
  const baseUrl = String(API).replace(/\/+$/, '');
  const qs = new URLSearchParams({
    sort_field: 'Created Date',
    descending: 'true',
    limit: '50',
  });
  const res = await fetch(`${baseUrl}/obj/f-relatoriodepagamentomensal?${qs.toString()}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!res.ok) {
    throw new Error(`Falha na verificação GET f-relatoriodepagamentomensal: HTTP ${res.status}`);
  }
  const data = (await res.json()) as {
    response?: {
      results?: Array<{
        _id: string;
        Escalas?: string[];
        'sub relatórios'?: string[];
        'data da sincronia'?: string;
        'Created Date'?: string;
      }>;
    };
  };
  const recent = data.response?.results || [];
  const pendentesRecentes = recent.filter(
    (r) => Array.isArray(r.Escalas) && r.Escalas.length > 0 && (!Array.isArray(r['sub relatórios']) || r['sub relatórios'].length === 0)
  );
  console.log(`\n== Verificação Pós-Sync (últimos ${recent.length} relatórios) ==`);
  console.log(`Pendentes com Escalas vinculadas: ${pendentesRecentes.length}`);

  const alvoId = relatorioEspecifico || '1794852125061x826397300200833000';
  const relRes = await fetch(`${baseUrl}/obj/f-relatoriodepagamentomensal/${alvoId}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (relRes.ok) {
    const relJson = (await relRes.json()) as {
      response?: {
        _id: string;
        'sub relatórios'?: string[];
        'data da sincronia'?: string;
      };
    };
    const r = relJson.response;
    console.log(
      `Relatório destaque ${alvoId}: sub relatórios=${r?.['sub relatórios']?.length || 0}, data da sincronia=${r?.['data da sincronia'] || 'N/A'}`
    );
  }
}

async function main() {
  const { relatorioId, forcar, limiteRelatorios, verificar, semTimes } = lerArgs();
  console.log(
    `== Sincronização de Relatórios de Pagamento — alvo: ${isLive ? 'LIVE' : 'version-test'} (${API}) ==`
  );

  const resultado = await sincronizarRelatoriosPagamentoBubble({
    relatorioId,
    forcar,
    limiteRelatorios,
  });

  console.log(
    `Avaliados: ${resultado.avaliados} | Sincronizados: ${resultado.sincronizados} | Criados: ${resultado.subRelatoriosCriados} | Reutilizados: ${resultado.subRelatoriosReutilizados} | Ignorados: ${resultado.ignorados} | Erros: ${resultado.erros.length}`
  );

  for (const d of resultado.detalhes) {
    console.log(
      `  - ${d.relatorioId}: status=${d.status} | escalas=${d.escalasIds.length} | servicos=${d.totalServicos} | cooperados=${d.cooperados} | sub_relatorios=${d.subRelatorioIds.length}` +
        (d.erro ? ` | ERRO: ${d.erro}` : '')
    );
  }

  if (!semTimes) {
    await garantirUsuarioNosTimesInternos();
  }

  if (verificar) {
    await verificarPosSync(relatorioId);
  }

  if (resultado.erros.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('Erro fatal ao sincronizar pagamentos no Bubble:', err);
  process.exit(1);
});
