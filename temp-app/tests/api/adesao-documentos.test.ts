import { test, before, beforeEach, afterEach } from 'node:test';
import { expect } from '@playwright/test';
import { criarComprovanteUpload } from '../../src/lib/comprovante-upload';
import {
  TIPOS_DOCUMENTO,
  TIPOS_DOCUMENTO_OBRIGATORIOS,
  TIPOS_DOCUMENTO_OPCIONAIS,
  TipoDocumentoAdesao,
  documentosObrigatoriosPendentes,
} from '../../src/lib/documentos';
import {
  isValidPIS,
  validarPIS,
  validarRegistroConselho,
  conselhoPorProfissao,
} from '../../src/lib/validacao-conselho';
import {
  identificarEmpresaContratante,
  obterEmpresaContratante,
  calcularIdadePaciente,
} from '../../src/lib/empresas-contratantes';

process.env.BUBBLE_API_URL = 'https://bubble.invalid/version-test/api/1.1';
process.env.BUBBLE_API_TOKEN = 'segredo-exclusivo-dos-testes';
process.env.ZAPSIGN_API_TOKEN = 'token-falso';
process.env.ZAPSIGN_BASE_URL = 'https://zapsign.invalid';

let bubble: typeof import('../../src/lib/bubble')['bubbleApi'];
let adesaoPost: typeof import('../../src/app/api/cooperado/adesao/route')['POST'];
let validarConselhoGet: typeof import('../../src/app/api/cooperado/validar-conselho/route')['GET'];
let validarConselhoPost: typeof import('../../src/app/api/cooperado/validar-conselho/route')['POST'];

let writes: unknown[];
let profWrites: unknown[];
const originalFetch = globalThis.fetch;
const savedMethods: Record<string, unknown> = {};

before(async () => {
  bubble = (await import('../../src/lib/bubble')).bubbleApi;
  adesaoPost = (await import('../../src/app/api/cooperado/adesao/route')).POST;
  const validarRoute = await import('../../src/app/api/cooperado/validar-conselho/route');
  validarConselhoGet = validarRoute.GET;
  validarConselhoPost = validarRoute.POST;

  for (const name of [
    'findCooperadoByCPF',
    'createCooperado',
    'createProfissao',
    'createContaBancaria',
    'updateCooperado',
    'getTermos',
  ]) {
    savedMethods[name] = bubble[name as keyof typeof bubble];
  }
});

beforeEach(() => {
  writes = [];
  profWrites = [];
  globalThis.fetch = async (_url, init) => {
    if (init?.body) {
      const data = JSON.parse(String(init.body));
      expect(Buffer.from(data.base64_pdf, 'base64').subarray(0, 5).toString()).toBe('%PDF-');
    }
    return Response.json({
      token: 'token-zapsign',
      signers: [{ sign_url: 'https://app.zapsign.com.br/sign/assinante-regular' }],
    });
  };
  bubble.findCooperadoByCPF = async () => null;
  bubble.createCooperado = async (data) => {
    writes.push(data);
    return { id: 'coop-regular-1' };
  };
  bubble.createProfissao = async (data) => {
    profWrites.push(data);
    return { id: 'prof-regular-1' };
  };
  bubble.createContaBancaria = async () => ({ id: 'conta-regular-1' });
  bubble.updateCooperado = async (_id, data) => {
    writes.push(data);
  };
  bubble.getTermos = async () => [];
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  Object.assign(bubble, savedMethods);
});

const makeJsonRequest = (url: string, body: unknown) =>
  new Request(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });

async function criarDocumentos(tipos: readonly TipoDocumentoAdesao[]) {
  return Promise.all(
    tipos.map(async (tipo) => {
      const url = `https://cdn.bubble.io/${tipo}.pdf`;
      return {
        url,
        tipo,
        name: `${tipo}.pdf`,
        comprovante: await criarComprovanteUpload(url),
      };
    })
  );
}

async function payloadCompleto() {
  return {
    personalData: {
      nomeCompleto: 'Enfermeira Carolina Mendes',
      cpf: '529.982.247-25',
      email: 'carolina.mendes@example.com',
      whatsapp: '(62) 99999-8888',
      pis: '120.56874.10-7',
    },
    addressData: {
      cep: '74000-000',
      rua: 'Av. Goiás',
      numero: '100',
      bairro: 'Centro',
      cidade: 'Goiânia',
      estado: 'GO',
    },
    professions: [
      {
        name: 'Enfermeiro (a)',
        council: 'COREN',
        uf: 'GO',
        registration: '248591',
        emissionDate: '2021-05-10',
        isPrincipal: true,
      },
    ],
    bankAccounts: [
      {
        bank: '341\tItaú Unibanco S.A.',
        agency: '1234',
        account: '56789-0',
        type: 'Conta Corrente',
      },
    ],
    uploadedFiles: await criarDocumentos(TIPOS_DOCUMENTO_OBRIGATORIOS),
  };
}

test('Catálogo de documentos define os 6 obrigatórios e 2 opcionais solicitados pela cooperativa', async () => {
  expect(TIPOS_DOCUMENTO_OBRIGATORIOS).toEqual([
    'identificacao',
    'conselho',
    'certidao_regularidade',
    'certidao_negativa_criminal',
    'residencia',
    'cartao_vacinacao',
  ]);
  expect(TIPOS_DOCUMENTO_OPCIONAIS).toEqual(['cartao_sus_pis', 'outro']);

  // Sem documentos: todos os 6 obrigatórios ficam pendentes
  expect(documentosObrigatoriosPendentes([])).toHaveLength(6);

  // Apenas RG e comprovante de residência ainda deixam 4 obrigatórios pendentes
  const parciais = await criarDocumentos(['identificacao', 'residencia']);
  const pendentes = documentosObrigatoriosPendentes(parciais);
  expect(pendentes).toEqual([
    TIPOS_DOCUMENTO.conselho,
    TIPOS_DOCUMENTO.certidao_regularidade,
    TIPOS_DOCUMENTO.certidao_negativa_criminal,
    TIPOS_DOCUMENTO.cartao_vacinacao,
  ]);

  // Todos os 6 obrigatórios presentes zeram as pendências
  const todosObrigatorios = await criarDocumentos(TIPOS_DOCUMENTO_OBRIGATORIOS);
  expect(documentosObrigatoriosPendentes(todosObrigatorios)).toEqual([]);

  // URL duplicada reutilizada para mais de um tipo obrigatório continua pendente
  const comUrlDuplicada = todosObrigatorios.map((doc, idx) =>
    idx === 1 ? { ...doc, url: todosObrigatorios[0].url } : doc
  );
  expect(documentosObrigatoriosPendentes(comUrlDuplicada)).toEqual([TIPOS_DOCUMENTO.conselho]);
});

test('Validação de registro do conselho aceita COREN, CRM, CREFITO e CRBM reais com UF e retorna link oficial', () => {
  const coren = validarRegistroConselho({
    conselho: 'COREN',
    uf: 'GO',
    numero: '248591',
    profissao: 'Enfermeiro (a)',
  });
  expect(coren.valid).toBe(true);
  expect(coren.conselho).toBe('COREN');
  expect(coren.uf).toBe('GO');
  expect(coren.numero).toBe('248591');
  expect(coren.categoria).toBe('ENF');
  expect(coren.registroFormatado).toBe('COREN-GO 248591-ENF');
  expect(coren.consultaUrl).toContain('cofen.gov.br');

  const corenTec = validarRegistroConselho('COREN-SP 582914-TE');
  expect(corenTec.valid).toBe(true);
  expect(corenTec.uf).toBe('SP');
  expect(corenTec.categoria).toBe('TE');
  expect(corenTec.registroFormatado).toBe('COREN-SP 582914-TE');

  const crm = validarRegistroConselho('CRM-RJ 998877');
  expect(crm.valid).toBe(true);
  expect(crm.conselho).toBe('CRM');
  expect(crm.uf).toBe('RJ');
  expect(crm.registroFormatado).toBe('CRM-RJ 998877');
  expect(crm.consultaUrl).toContain('cfm.org.br');

  // Infere CREFITO automaticamente pela profissão Fisioterapeuta mesmo sem informar conselho
  const crefito = validarRegistroConselho({
    uf: 'MG',
    numero: '184920-F',
    profissao: 'Fisioterapeuta',
  });
  expect(crefito.valid).toBe(true);
  expect(crefito.conselho).toBe('CREFITO');
  expect(crefito.registroFormatado).toBe('CREFITO-MG 184920-F');

  // Biomédico deve mapear para CRBM (e não CRM)
  expect(conselhoPorProfissao('Biomédico (a)')).toBe('CRBM');
  const crbm = validarRegistroConselho({
    uf: 'GO',
    numero: '48291',
    profissao: 'Biomédico (a)',
  });
  expect(crbm.valid).toBe(true);
  expect(crbm.conselho).toBe('CRBM');
  expect(crbm.registroFormatado).toBe('CRBM-GO 48291');
});

test('Validação de conselho rejeita números aleatórios, sequenciais, repetidos, sem UF ou incompatíveis', () => {
  // Sequenciais crescentes, decrescentes e com prefixo/sufixo de zero
  for (const seq of ['123456', '12345', '012345', '001234', '006543', '123450', '654321', '987654']) {
    const res = validarRegistroConselho({ conselho: 'COREN', uf: 'GO', numero: seq });
    expect(res.valid).toBe(false);
    expect(res.error).toBeTruthy();
  }

  // Dígitos repetidos e padrões de teste (incluindo zero-padded e blocos repetidos)
  for (const rep of ['111111', '000000', '999999', '001111', '111123', '121212', '123123', '12341234', '111112', '000123']) {
    const res = validarRegistroConselho({ conselho: 'COREN', uf: 'GO', numero: rep });
    expect(res.valid).toBe(false);
  }

  // Curtos demais, longos demais ou alfanuméricos inválidos
  for (const invalido of ['12', '123', '192837465192', '12A34B', 'ABCDEF']) {
    const res = validarRegistroConselho({ conselho: 'COREN', uf: 'GO', numero: invalido });
    expect(res.valid).toBe(false);
  }

  // Sem UF informada
  const semUf = validarRegistroConselho({ conselho: 'COREN', numero: '248591' });
  expect(semUf.valid).toBe(false);
  expect(semUf.error).toContain('UF');

  // UF inexistente
  const ufInvalida = validarRegistroConselho({ conselho: 'COREN', uf: 'XX', numero: '248591' });
  expect(ufInvalida.valid).toBe(false);

  // Conselho incompatível com a profissão (explícito ou embutido no número)
  const incompativel = validarRegistroConselho({
    conselho: 'CRM',
    uf: 'GO',
    numero: '248591',
    profissao: 'Enfermeiro (a)',
  });
  expect(incompativel.valid).toBe(false);

  const incompativelNoNumero = validarRegistroConselho({
    uf: 'GO',
    numero: 'CRM-GO 248591',
    profissao: 'Enfermeiro (a)',
  });
  expect(incompativelNoNumero.valid).toBe(false);

  // Categoria do COREN incompatível com o cargo (Técnico tentando usar ENF ou Enfermeiro tentando usar TE)
  const catIncompativel = validarRegistroConselho({
    conselho: 'COREN',
    uf: 'GO',
    numero: '248591-ENF',
    profissao: 'Técnico (a) de Enfermagem',
  });
  expect(catIncompativel.valid).toBe(false);

  expect(conselhoPorProfissao('Técnico (a) de Enfermagem')).toBe('COREN');
  expect(conselhoPorProfissao('Médico (a)')).toBe('CRM');
});

test('Validação de PIS/PASEP (Módulo 11) aceita números válidos e recusa dígito incorreto ou sequência repetida', () => {
  expect(isValidPIS('120.56874.10-7')).toBe(true);
  expect(isValidPIS('12056874107')).toBe(true);
  expect(isValidPIS('170.33259.50-4')).toBe(true);

  expect(isValidPIS('120.56874.10-8')).toBe(false);
  expect(isValidPIS('120.56874.10-0')).toBe(false);
  expect(isValidPIS('111.11111.11-1')).toBe(false);
  expect(isValidPIS('000.00000.00-0')).toBe(false);
  expect(isValidPIS('12345')).toBe(false);
  expect(isValidPIS('')).toBe(false);

  const detalhado = validarPIS('12056874107');
  expect(detalhado.valid).toBe(true);
  expect(detalhado.pisFormatado).toBe('120.56874.10-7');
});

test('Endpoint /api/cooperado/validar-conselho valida via GET e POST e expõe link do COFEN/CFM', async () => {
  const okGet = await validarConselhoGet(
    new Request('http://localhost/api/cooperado/validar-conselho?conselho=COREN&uf=GO&numero=248591&profissao=Enfermeiro%20(a)')
  );
  expect(okGet.status).toBe(200);
  const bodyGet = await okGet.json();
  expect(bodyGet.valid).toBe(true);
  expect(bodyGet.registroFormatado).toBe('COREN-GO 248591-ENF');
  expect(bodyGet.consultaUrl).toContain('cofen.gov.br');

  const failGet = await validarConselhoGet(
    new Request('http://localhost/api/cooperado/validar-conselho?conselho=COREN&uf=GO&numero=123456')
  );
  expect(failGet.status).toBe(400);
  expect((await failGet.json()).valid).toBe(false);

  const okPost = await validarConselhoPost(
    makeJsonRequest('http://localhost/api/cooperado/validar-conselho', {
      conselho: 'CRM',
      uf: 'SP',
      numero: '482910',
      pis: '120.56874.10-7',
    })
  );
  expect(okPost.status).toBe(200);
  const bodyPost = await okPost.json();
  expect(bodyPost.valid).toBe(true);
  expect(bodyPost.consultaUrl).toContain('cfm.org.br');
  expect(bodyPost.pis.valid).toBe(true);

  const failPisPost = await validarConselhoPost(
    makeJsonRequest('http://localhost/api/cooperado/validar-conselho', {
      conselho: 'CRM',
      uf: 'SP',
      numero: '482910',
      pis: '120.56874.10-0',
    })
  );
  expect(failPisPost.status).toBe(400);
  const bodyFailPis = await failPisPost.json();
  expect(bodyFailPis.valid).toBe(false);
  expect(bodyFailPis.pis.valid).toBe(false);
});

test('POST /api/cooperado/adesao bloqueia quando faltam documentos obrigatórios (COREN, certidão ou vacinação)', async () => {
  const data = await payloadCompleto();
  // Envia apenas RG e comprovante de residência
  data.uploadedFiles = await criarDocumentos(['identificacao', 'residencia']);

  const response = await adesaoPost(makeJsonRequest('http://localhost/api/cooperado/adesao', data));
  expect(response.status).toBe(400);
  const json = await response.json();
  expect(json.error).toContain('Documentos obrigatórios pendentes');
  expect(writes).toHaveLength(0);
});

test('POST /api/cooperado/adesao bloqueia COREN aleatório/sequencial ou sem UF e PIS inválido', async () => {
  // 1. COREN sequencial (123456)
  const dataSeq = await payloadCompleto();
  dataSeq.professions[0].registration = '123456';
  const resSeq = await adesaoPost(makeJsonRequest('http://localhost/api/cooperado/adesao', dataSeq));
  expect(resSeq.status).toBe(400);
  expect(writes).toHaveLength(0);

  // 2. COREN sem UF
  const dataSemUf = await payloadCompleto();
  dataSemUf.professions[0] = {
    name: 'Enfermeiro (a)',
    council: 'COREN',
    uf: '',
    registration: '248591',
    emissionDate: '2021-05-10',
    isPrincipal: true,
  };
  const resSemUf = await adesaoPost(makeJsonRequest('http://localhost/api/cooperado/adesao', dataSemUf));
  expect(resSemUf.status).toBe(400);
  expect(writes).toHaveLength(0);

  // 3. PIS inválido
  const dataPisInvalido = await payloadCompleto();
  dataPisInvalido.personalData.pis = '120.56874.10-0';
  const resPis = await adesaoPost(makeJsonRequest('http://localhost/api/cooperado/adesao', dataPisInvalido));
  expect(resPis.status).toBe(400);
  expect((await resPis.json()).error).toContain('PIS');
  expect(writes).toHaveLength(0);
});

test('POST /api/cooperado/adesao conclui com sucesso com os 5 documentos obrigatórios + opcionais e grava COREN formatado', async () => {
  const data = await payloadCompleto();
  data.uploadedFiles = await criarDocumentos([
    ...TIPOS_DOCUMENTO_OBRIGATORIOS,
    'cartao_sus_pis',
  ]);

  const response = await adesaoPost(makeJsonRequest('http://localhost/api/cooperado/adesao', data));
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.success).toBe(true);
  expect(body.signUrl).toBe('https://app.zapsign.com.br/sign/assinante-regular');

  expect(profWrites).toHaveLength(1);
  expect((profWrites[0] as { txt_conselho: string }).txt_conselho).toBe('COREN-GO 248591-ENF');
  expect((writes[0] as { fks_pasta: string[] }).fks_pasta).toHaveLength(6);
});

test('Empresas contratantes reconhecem Verdes Mares, Multcare/Multi e ISA e calculam idade corretamente', () => {
  expect(identificarEmpresaContratante('Verdes Mares')?.id).toBe('verdes-mares');
  expect(identificarEmpresaContratante('verdes-mares')?.cnpj).toBe('54.800.169/0001-55');
  expect(identificarEmpresaContratante('Multcare')?.id).toBe('multi');
  expect(identificarEmpresaContratante('Multcare Home Care')?.nomeCurto).toBe('Multcare');
  expect(identificarEmpresaContratante('Multi')?.id).toBe('multi');
  expect(identificarEmpresaContratante('ISA')?.id).toBe('isa');
  expect(identificarEmpresaContratante('ISA Home Care')?.id).toBe('isa');
  expect(obterEmpresaContratante('Multcare').id).toBe('multi');
  expect(obterEmpresaContratante(undefined).id).toBe('verdes-mares');

  expect(calcularIdadePaciente('1944-08-19', new Date('2026-10-13T12:00:00Z'))).toBe('82 anos');
  expect(calcularIdadePaciente('19/08/1944', new Date('2026-10-13T12:00:00Z'))).toBe('82 anos');
});

