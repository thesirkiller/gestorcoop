import { test, before, beforeEach, afterEach } from 'node:test';
import { expect } from '@playwright/test';
import axios from 'axios';
import { criarComprovanteUpload, verificarComprovanteUpload } from '../../src/lib/comprovante-upload';
import { normalizarUrlDocumento, nomeDocumento } from '../../src/lib/documentos';

process.env.BUBBLE_API_URL = 'https://bubble.invalid/version-test/api/1.1';
process.env.BUBBLE_API_TOKEN = 'segredo-exclusivo-dos-testes';
process.env.ZAPSIGN_API_TOKEN = 'token-falso';
process.env.ZAPSIGN_BASE_URL = 'https://zapsign.invalid';
// Nenhuma requisição destes testes pode alcançar serviços reais.
let uploadResult: unknown;
axios.defaults.adapter = async config => {
  if (uploadResult instanceof Error) throw uploadResult;
  expect(config.url).toBe('https://bubble.invalid/version-test/fileupload');
  expect(JSON.parse(config.data).name).toBe('rg.pdf');
  return { data: uploadResult, status: 200, statusText: 'OK', headers: {}, config };
};
let bubble: typeof import('../../src/lib/bubble')['bubbleApi'];
let adesao: typeof import('../../src/app/api/cooperado/adesao/route')['POST'];
let webhook: typeof import('../../src/app/api/webhooks/zapsign/route')['POST'];
let writes: unknown[];
const originalFetch = globalThis.fetch;
const savedMethods: Record<string, unknown> = {};

before(async () => {
  bubble = (await import('../../src/lib/bubble')).bubbleApi;
  adesao = (await import('../../src/app/api/cooperado/adesao/route')).POST;
  webhook = (await import('../../src/app/api/webhooks/zapsign/route')).POST;
  for (const name of ['uploadFile', 'updateCooperado', 'getCooperado']) savedMethods[name] = bubble[name as keyof typeof bubble];
});
beforeEach(() => {
  writes = [];
  globalThis.fetch = async () => { throw new Error('Requisição externa não mockada'); };
  uploadResult = new Error('Upload indisponível');
  bubble.findCooperadoByCPF = async () => null;
  bubble.createCooperado = async data => { writes.push(data); return { id: 'coop-teste' }; };
  bubble.createProfissao = async () => ({ id: 'prof-teste' });
  bubble.createContaBancaria = async () => ({ id: 'conta-teste' });
  bubble.updateCooperado = async (_id, data) => { writes.push(data); };
  bubble.getTermos = async () => [];
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  Object.assign(bubble, savedMethods);
});
const request = (body: unknown) => new Request('http://localhost/api', { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
async function payload() {
  return {
    personalData: { nomeCompleto: 'Pessoa Teste', cpf: '529.982.247-25', email: 'teste@example.com', whatsapp: '62999999999' },
    addressData: { rua: 'Rua Teste' }, professions: [{ name: 'Enfermeiro (a)' }], bankAccounts: [{ bank: 'Banco', agency: '1', account: '2' }],
    uploadedFiles: await Promise.all(['identificacao', 'residencia'].map(async tipo => {
      const url = `https://cdn.bubble.io/${tipo}.pdf`;
      return { url, tipo, name: `${tipo}.pdf`, comprovante: await criarComprovanteUpload(url) };
    })),
  };
}

test('API recusa cadastro sem documentos antes de gravar', async () => {
  const data = await payload();
  data.uploadedFiles = [];
  const response = await adesao(request(data));
  expect(response.status).toBe(400);
  expect(writes).toHaveLength(0);
});
test('API recusa comprovante forjado e URLs repetidas', async () => {
  const data = await payload();
  data.uploadedFiles[0].comprovante = 'falso';
  expect((await adesao(request(data))).status).toBe(400);
  data.uploadedFiles[1].url = data.uploadedFiles[0].url;
  expect((await adesao(request(data))).status).toBe(400);
  expect(writes).toHaveLength(0);
});
test('comprovante de upload não pode ser reaproveitado em outra URL', async () => {
  const receipt = await criarComprovanteUpload('https://cdn.bubble.io/rg.pdf');
  expect(await verificarComprovanteUpload('https://cdn.bubble.io/rg.pdf', receipt)).toBe(true);
  expect(await verificarComprovanteUpload('https://cdn.bubble.io/outro.pdf', receipt)).toBe(false);
  expect(await verificarComprovanteUpload('https://cdn.bubble.io/rg.pdf', '1.' + 'a'.repeat(64))).toBe(false);
});
test('upload não inventa arquivo quando armazenamento falha; normaliza retorno real', async () => {
  // `uploadFile` usa `fetch`, e não o axios: o timeout do axios quebrava o
  // upload no runtime edge com "Illegal invocation". O mock acompanha isso.
  const mockarStorage = (corpo: unknown, status = 200) => {
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe('https://bubble.invalid/version-test/fileupload');
      expect(JSON.parse(String(init?.body)).name).toBe('rg.pdf');
      return new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } });
    };
  };

  mockarStorage(null, 502);
  await expect(bubble.uploadFile('rg.pdf', 'JVBERg==')).rejects.toThrow('recusou o arquivo');

  mockarStorage('//cdn.bubble.io/rg.pdf');
  expect(await bubble.uploadFile('rg.pdf', 'JVBERg==')).toBe('https://cdn.bubble.io/rg.pdf');

  mockarStorage({ success: true });
  await expect(bubble.uploadFile('rg.pdf', 'JVBERg==')).rejects.toThrow('não confirmou');
});
test('erro e resposta incompleta da ZapSign não viram cadastro concluído', async () => {
  globalThis.fetch = async () => new Response('Falha', { status: 401 });
  let response = await adesao(request(await payload()));
  expect(response.status).toBe(502);
  expect((await response.json()).signUrl).toBeUndefined();
  globalThis.fetch = async () => Response.json({ token: 'token', signers: [] });
  response = await adesao(request(await payload()));
  expect(response.status).toBe(502);
});
test('assinatura recebe PDF válido e ID do cadastro', async () => {
  globalThis.fetch = async (_url, init) => {
    const data = JSON.parse(init!.body as string);
    expect(Buffer.from(data.base64_pdf, 'base64').subarray(0, 5).toString()).toBe('%PDF-');
    expect(data.external_id).toBe('coop-teste');
    return Response.json({ token: 'token', signers: [{ sign_url: 'https://app.zapsign.com.br/sign/assinante' }] });
  };
  const response = await adesao(request(await payload()));
  expect(response.status).toBe(200);
  expect((await response.json()).signUrl).toBe('https://app.zapsign.com.br/sign/assinante');
});
test('webhook oficial verifica assinatura e salva PDF permanente', async () => {
  bubble.getCooperado = async () => ({ _id: 'coop-teste', fks_pasta: [] });
  bubble.uploadFile = async (name, contents) => {
    expect(name).toBe('termo-assinado-doc-token.pdf');
    expect(Buffer.from(contents, 'base64').toString()).toBe('%PDF-1.4 assinado');
    return 'https://cdn.bubble.io/termo-assinado-doc-token.pdf';
  };
  globalThis.fetch = async url => String(url).includes('/api/v1/docs/')
    ? Response.json({ token: 'doc-token', external_id: 'coop-teste', status: 'signed', signed_file: 'https://zapsign.s3.amazonaws.com/temporario.pdf' })
    : new Response('%PDF-1.4 assinado');
  const response = await webhook(request({ event_type: 'doc_signed', token: 'doc-token' }));
  expect(response.status).toBe(200);
  expect(writes).toContainEqual({ txt_termo_status: 'Assinado', file_termo_assinado: 'https://cdn.bubble.io/termo-assinado-doc-token.pdf', fks_pasta: ['https://cdn.bubble.io/termo-assinado-doc-token.pdf'] });
});
test('webhook não confia em status assinado informado pelo chamador', async () => {
  globalThis.fetch = async () => Response.json({ token: 'doc-token', status: 'pending' });
  const response = await webhook(request({ event_type: 'doc_signed', token: 'doc-token', status: 'signed' }));
  expect(response.status).toBe(200);
  expect(writes).toHaveLength(0);
});
test('nomes com percentual inválido ou valores nulos não derrubam a visualização', () => {
  expect(nomeDocumento('https://cdn.bubble.io/100%foto.png')).toBe('100%foto.png');
  expect(nomeDocumento(null)).toBe('documento');
  expect(nomeDocumento(undefined)).toBe('documento');
  expect(nomeDocumento('')).toBe('documento');
  expect(normalizarUrlDocumento('//cdn.bubble.io/rg.pdf')).toBe('https://cdn.bubble.io/rg.pdf');
  expect(normalizarUrlDocumento('https://cdn.bubble.io/mock-file-123.pdf')).toBeNull();
  expect(normalizarUrlDocumento(null)).toBeNull();
  expect(normalizarUrlDocumento(undefined)).toBeNull();
});

test('adesao com termos incompletos no banco de dados não falha com split', async () => {
  // Simula termos no Bubble com campos nulos/ausentes
  bubble.getTermos = async () => [
    { _id: 't1', bool_ativo: true, txt_profissao: null as unknown as string, txt_conteudo: null as unknown as string, txt_titulo: 'Termo', num_versao: 1 },
    { _id: 't2', bool_ativo: true, txt_profissao: 'Geral', txt_conteudo: 'Texto [PAGE_BREAK] Pagina 2', txt_titulo: 'Termo Geral', num_versao: 1 },
  ];
  globalThis.fetch = async (_url, init) => {
    const data = JSON.parse(init!.body as string);
    expect(Buffer.from(data.base64_pdf, 'base64').subarray(0, 5).toString()).toBe('%PDF-');
    return Response.json({ token: 'token', signers: [{ sign_url: 'https://app.zapsign.com.br/sign/assinante' }] });
  };
  const response = await adesao(request(await payload()));
  expect(response.status).toBe(200);
  expect((await response.json()).signUrl).toBe('https://app.zapsign.com.br/sign/assinante');
});


test('upload recusa arquivo vazio ou formato não aceito antes do armazenamento', async () => {
  const { POST } = await import('../../src/app/api/cooperado/upload/route');
  for (const file of [new File([], 'vazio.pdf', { type: 'application/pdf' }), new File(['texto'], 'arquivo.txt', { type: 'text/plain' })]) {
    const form = new FormData();
    form.set('file', file);
    const response = await POST(new Request('http://localhost/api/cooperado/upload', { method: 'POST', body: form }));
    expect(response.status).toBe(400);
  }
});

test('listagem vazia ou indisponível não inventa cooperados e documentos', async () => {
  const { GET } = await import('../../src/app/api/gestor/cooperados/route');
  const { NextRequest } = await import('next/server');
  const original = bubble.getCooperados;
  try {
    bubble.getCooperados = async () => ({ results: [], remaining: 0, count: 0 });
    const empty = await GET(new NextRequest('http://localhost/api/gestor/cooperados?cursor=0&limit=100'));
    expect((await empty.json()).data.results).toEqual([]);
    bubble.getCooperados = async () => { throw new Error('Indisponível'); };
    const failure = await GET(new NextRequest('http://localhost/api/gestor/cooperados?cursor=0&limit=100'));
    expect(failure.status).toBe(502);
    expect((await failure.json()).success).toBe(false);
  } finally { bubble.getCooperados = original; }
});
