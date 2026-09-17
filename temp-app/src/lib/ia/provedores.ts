import { getRequestContext } from '@cloudflare/next-on-pages';
import { TIMEOUT_SOAP_MS, TIMEOUT_TRANSCRICAO_MS } from './limites';

/**
 * Cascata de provedores de IA.
 *
 * Provedor único é ponto único de falha: quando a OpenAI oscila ou o crédito
 * acaba, o profissional em campo fica sem transcrever. Aqui cada etapa percorre
 * uma lista ordenada e só desiste quando todos falharem — e mesmo então a rota
 * degrada para digitação manual em vez de estourar.
 *
 * A ordem vem de env (`IA_ORDEM_TRANSCRICAO` / `IA_ORDEM_SOAP`, separados por
 * vírgula). O padrão começa pela OpenAI porque é o caminho validado contra a API
 * real; o Workers AI é ~10x mais barato mas ainda não foi medido com áudio
 * clínico de verdade. Depois de comparar, basta inverter a env — sem deploy de
 * código — e o custo cai para perto de zero, com a OpenAI virando a rede de
 * segurança.
 */

export type Provedor = 'workersai' | 'groq' | 'openai';

const ORDEM_PADRAO_TRANSCRICAO: Provedor[] = ['openai', 'groq', 'workersai'];
const ORDEM_PADRAO_SOAP: Provedor[] = ['openai', 'workersai', 'groq'];

const MODELO_WHISPER_CF = '@cf/openai/whisper-large-v3-turbo';
const MODELO_LLM_CF = '@cf/meta/llama-4-scout-17b-16e-instruct';

const NUMERO_OU_NULO = { type: ['number', 'null'] };

/** Mesmo contrato do prompt, em schema, para os modelos que aceitam saída estruturada. */
const SCHEMA_SOAP = {
  type: 'object',
  properties: {
    subjetivo: { type: 'string' },
    objetivo: { type: 'string' },
    avaliacao: { type: 'string' },
    plano: { type: 'string' },
    sinaisVitais: {
      type: 'object',
      properties: {
        paSistolica: NUMERO_OU_NULO,
        paDiastolica: NUMERO_OU_NULO,
        fc: NUMERO_OU_NULO,
        fr: NUMERO_OU_NULO,
        temp: NUMERO_OU_NULO,
        spo2: NUMERO_OU_NULO,
        glicemia: NUMERO_OU_NULO,
      },
    },
  },
  required: ['subjetivo', 'objetivo', 'avaliacao', 'plano'],
};

interface BindingAi {
  run(modelo: string, entrada: Record<string, unknown>): Promise<unknown>;
}

/** Binding de Workers AI, quando configurado (`[ai]` no wrangler.toml). */
function getAi(): BindingAi | undefined {
  try {
    const env = getRequestContext().env as unknown as { AI?: BindingAi };
    if (env.AI && typeof env.AI.run === 'function') return env.AI;
  } catch {
    /* Build e testes fora do runtime Cloudflare. */
  }
  const binding = (process.env as unknown as Record<string, unknown>).AI;
  if (binding && typeof (binding as BindingAi).run === 'function') return binding as BindingAi;
  return undefined;
}

function ordemDeEnv(nome: string, padrao: Provedor[]): Provedor[] {
  const bruto = process.env[nome];
  if (!bruto) return padrao;
  const validos = bruto
    .split(',')
    .map((p) => p.trim().toLowerCase())
    .filter((p): p is Provedor => p === 'workersai' || p === 'groq' || p === 'openai');
  return validos.length > 0 ? validos : padrao;
}

/** `true` quando pelo menos um provedor está configurado para transcrever. */
export function temProvedorConfigurado(): boolean {
  return Boolean(process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY || getAi());
}

/** Base64 em blocos: `String.fromCharCode(...array)` estoura a pilha em MBs de áudio. */
function paraBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const BLOCO = 8192;
  let binario = '';
  for (let i = 0; i < bytes.length; i += BLOCO) {
    const bloco = bytes.subarray(i, i + BLOCO);
    let parcial = '';
    for (let j = 0; j < bloco.length; j++) parcial += String.fromCharCode(bloco[j]);
    binario += parcial;
  }
  return btoa(binario);
}

export interface ResultadoTranscricao {
  texto: string;
  provedor: Provedor;
}

async function transcreverWhisperHttp(
  audio: File,
  url: string,
  chave: string,
  modelo: string,
): Promise<string> {
  const form = new FormData();
  form.append('file', audio);
  form.append('model', modelo);
  form.append('language', 'pt');

  const resposta = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${chave}` },
    body: form,
    signal: AbortSignal.timeout(TIMEOUT_TRANSCRICAO_MS),
  });

  if (!resposta.ok) {
    throw new Error(`HTTP ${resposta.status}: ${(await resposta.text()).slice(0, 300)}`);
  }
  const dados = (await resposta.json()) as { text?: string };
  return (dados.text || '').trim();
}

async function transcreverComProvedor(provedor: Provedor, audio: File): Promise<string> {
  if (provedor === 'openai') {
    const chave = process.env.OPENAI_API_KEY;
    if (!chave) throw new Error('OPENAI_API_KEY ausente');
    return transcreverWhisperHttp(audio, 'https://api.openai.com/v1/audio/transcriptions', chave, 'whisper-1');
  }

  if (provedor === 'groq') {
    const chave = process.env.GROQ_API_KEY;
    if (!chave) throw new Error('GROQ_API_KEY ausente');
    return transcreverWhisperHttp(
      audio,
      'https://api.groq.com/openai/v1/audio/transcriptions',
      chave,
      process.env.GROQ_MODELO_WHISPER || 'whisper-large-v3-turbo',
    );
  }

  const ai = getAi();
  if (!ai) throw new Error('Binding AI ausente');
  // O binding não aceita AbortSignal; o teto de tamanho do áudio é o que limita
  // a duração dessa chamada.
  const saida = (await ai.run(MODELO_WHISPER_CF, {
    audio: paraBase64(await audio.arrayBuffer()),
    language: 'pt',
    task: 'transcribe',
  })) as { text?: string };
  return (saida?.text || '').trim();
}

/** Percorre a cascata e devolve a primeira transcrição não vazia, ou `null`. */
export async function transcreverAudio(audio: File): Promise<ResultadoTranscricao | null> {
  for (const provedor of ordemDeEnv('IA_ORDEM_TRANSCRICAO', ORDEM_PADRAO_TRANSCRICAO)) {
    try {
      const texto = await transcreverComProvedor(provedor, audio);
      if (texto) return { texto, provedor };
      console.warn(`[ia/provedores] ${provedor} devolveu transcrição vazia, tentando o próximo.`);
    } catch (erro) {
      const motivo = erro instanceof Error ? erro.message : String(erro);
      console.warn(`[ia/provedores] Transcrição via ${provedor} falhou (${motivo}), tentando o próximo.`);
    }
  }
  return null;
}

export interface SoapEstruturado {
  subjetivo: string;
  objetivo: string;
  avaliacao: string;
  plano: string;
}

export interface SinaisVitaisExtraidos {
  paSistolica?: number;
  paDiastolica?: number;
  fc?: number;
  fr?: number;
  temp?: number;
  spo2?: number;
  glicemia?: number;
}

export interface ResultadoSoap {
  soap: SoapEstruturado;
  sinaisVitais: SinaisVitaisExtraidos;
  provedor: Provedor;
}

function promptSistema(tipoProfissional: string): string {
  return `Você é um assistente de IA clínica especializado em documentação médica e prontuário eletrônico no formato SOAP (Subjetivo, Objetivo, Avaliação, Plano) para o padrão brasileiro de saúde.
Seu trabalho é converter o relato de voz transcrito do profissional de saúde (${tipoProfissional}) em um prontuário clínico formal estruturado.
Remova vícios de linguagem e hesitações.
NUNCA invente dado clínico. Todo sinal vital que não tiver sido dito no relato deve vir como null em "sinaisVitais".
Nunca escreva a palavra "null" dentro do texto das seções: dado ausente simplesmente não é citado.
As quatro seções (subjetivo, objetivo, avaliacao, plano) são obrigatórias e nenhuma pode vir vazia.
A transcrição pode conter erros de reconhecimento de fala; interprete termos clínicos pelo contexto (ex.: "saturacal" é "saturação").
Pressão dita no formato coloquial ("12 por 8") corresponde a mmHg ("120 x 80").
Responda ESTRITAMENTE em formato JSON com o seguinte schema, mantendo null em tudo que o relato não mencionar:
{
  "subjetivo": "Queixas do paciente, relato do acompanhante, sintomas, dor, estado geral referido.",
  "objetivo": "Sinais vitais, exame físico sumário, dispositivos (sondas, acessos, curativos), dieta e eliminações.",
  "avaliacao": "Juízo clínico, estabilidade hemodinâmica, diagnóstico provisório ou resposta terapêutica.",
  "plano": "Condutas executadas, medicações administradas, cuidados prestados e orientações aos familiares.",
  "sinaisVitais": { "paSistolica": null, "paDiastolica": null, "fc": null, "fr": null, "temp": null, "spo2": null, "glicemia": null }
}`;
}

/** Extrai o primeiro objeto JSON da resposta: modelo menor às vezes embrulha em texto ou cerca de código. */
function parseJsonDefensivo(bruto: string): Record<string, unknown> | null {
  const limpo = bruto.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(limpo) as Record<string, unknown>;
  } catch {
    /* Segue para a extração por delimitador. */
  }
  const inicio = limpo.indexOf('{');
  const fim = limpo.lastIndexOf('}');
  if (inicio === -1 || fim <= inicio) return null;
  try {
    return JSON.parse(limpo.slice(inicio, fim + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function numeroOuIndefinido(valor: unknown): number | undefined {
  const n = typeof valor === 'string' ? Number(valor.replace(',', '.')) : valor;
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined;
}

function normalizar(objeto: Record<string, unknown>): ResultadoSoap['soap'] & { sinaisVitais: SinaisVitaisExtraidos } {
  const texto = (chave: string) => (typeof objeto[chave] === 'string' ? (objeto[chave] as string).trim() : '');
  const vitaisBrutos = (objeto.sinaisVitais || {}) as Record<string, unknown>;
  const sinaisVitais: SinaisVitaisExtraidos = {};
  for (const campo of ['paSistolica', 'paDiastolica', 'fc', 'fr', 'temp', 'spo2', 'glicemia'] as const) {
    const valor = numeroOuIndefinido(vitaisBrutos[campo]);
    if (valor !== undefined) sinaisVitais[campo] = valor;
  }
  return {
    subjetivo: texto('subjetivo'),
    objetivo: texto('objetivo'),
    avaliacao: texto('avaliacao'),
    plano: texto('plano'),
    sinaisVitais,
  };
}

async function chatJson(
  url: string,
  chave: string,
  modelo: string,
  sistema: string,
  usuario: string,
): Promise<string> {
  const resposta = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${chave}` },
    body: JSON.stringify({
      model: modelo,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: sistema },
        { role: 'user', content: usuario },
      ],
      temperature: 0.1,
    }),
    signal: AbortSignal.timeout(TIMEOUT_SOAP_MS),
  });

  if (!resposta.ok) {
    throw new Error(`HTTP ${resposta.status}: ${(await resposta.text()).slice(0, 300)}`);
  }
  const dados = (await resposta.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return dados.choices?.[0]?.message?.content || '';
}

/** Devolve o texto cru do modelo; quem chama parseia e loga o que não der. */
async function estruturarComProvedor(
  provedor: Provedor,
  transcricao: string,
  tipoProfissional: string,
): Promise<string> {
  const sistema = promptSistema(tipoProfissional);
  const usuario = `Relato clínico de áudio: "${transcricao}"`;

  if (provedor === 'openai') {
    const chave = process.env.OPENAI_API_KEY;
    if (!chave) throw new Error('OPENAI_API_KEY ausente');
    return chatJson('https://api.openai.com/v1/chat/completions', chave, 'gpt-4o-mini', sistema, usuario);
  }

  if (provedor === 'groq') {
    const chave = process.env.GROQ_API_KEY;
    if (!chave) throw new Error('GROQ_API_KEY ausente');
    return chatJson(
      'https://api.groq.com/openai/v1/chat/completions',
      chave,
      process.env.GROQ_MODELO_LLM || 'llama-3.3-70b-versatile',
      sistema,
      usuario,
    );
  }

  const ai = getAi();
  if (!ai) throw new Error('Binding AI ausente');
  const saida = (await ai.run(MODELO_LLM_CF, {
    messages: [
      { role: 'system', content: sistema },
      { role: 'user', content: usuario },
    ],
    temperature: 0.1,
    // Workers AI não respeita "responda só JSON" no prompt com a mesma
    // confiabilidade da OpenAI: sem o schema declarado, o modelo embrulha a
    // resposta em prosa e o parse falha.
    response_format: { type: 'json_schema', json_schema: SCHEMA_SOAP },
  })) as { response?: unknown };

  // Com json_schema o binding devolve objeto já parseado; sem, vem string.
  const resposta = saida?.response;
  if (typeof resposta === 'string') return resposta;
  return resposta ? JSON.stringify(resposta) : '';
}

/** Percorre a cascata e devolve o primeiro SOAP válido, ou `null`. */
export async function estruturarSoap(
  transcricao: string,
  tipoProfissional: string,
): Promise<ResultadoSoap | null> {
  for (const provedor of ordemDeEnv('IA_ORDEM_SOAP', ORDEM_PADRAO_SOAP)) {
    try {
      const textoBruto = await estruturarComProvedor(provedor, transcricao, tipoProfissional);
      const objeto = parseJsonDefensivo(textoBruto);
      if (!objeto) {
        console.warn(
          `[ia/provedores] ${provedor} devolveu JSON inválido no SOAP, tentando o próximo. Resposta: ${textoBruto.slice(0, 200)}`,
        );
        continue;
      }
      const { sinaisVitais, ...soap } = normalizar(objeto);
      // As quatro seções precisam vir preenchidas. Modelo menor às vezes devolve
      // "avaliacao" em branco, e seção vazia em prontuário assinado é lacuna no
      // registro clínico — melhor cair para o próximo provedor.
      const secaoVazia = (['subjetivo', 'objetivo', 'avaliacao', 'plano'] as const).find((s) => !soap[s]);
      if (secaoVazia) {
        console.warn(`[ia/provedores] ${provedor} devolveu "${secaoVazia}" vazio no SOAP, tentando o próximo.`);
        continue;
      }
      return { soap, sinaisVitais, provedor };
    } catch (erro) {
      const motivo = erro instanceof Error ? erro.message : String(erro);
      console.warn(`[ia/provedores] SOAP via ${provedor} falhou (${motivo}), tentando o próximo.`);
    }
  }
  return null;
}
