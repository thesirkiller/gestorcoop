import { obterSessao } from './sessao';
export const COOKIE_SESSAO_COOPERADO = 'cooperado_session';
export interface SessaoCooperado { userId: string; cooperadoId: string; nome: string; cargo?: 'Tecnico_Enfermagem' | 'Medico' | 'Terapeuta' }
export class SemSessaoError extends Error {
  constructor(message = 'Sessão expirada. Abra novamente pelo Bubble.') { super(message); this.name = 'SemSessaoError'; }
}
export async function obterSessaoCooperado(): Promise<SessaoCooperado | null> {
  const sessao = await obterSessao('cooperado');
  return sessao?.cooperadoId ? { ...sessao, cooperadoId: sessao.cooperadoId } : null;
}
export async function exigirSessaoCooperado(): Promise<SessaoCooperado> {
  const sessao = await obterSessaoCooperado();
  if (!sessao) throw new SemSessaoError();
  return sessao;
}
/** Selo de integridade. Não é certificado digital nem validação de PIN. */
export async function gerarSeloAssinatura(dados: { evolucaoId: string; cooperadoId: string; instante: string; conteudo: string }) {
  const segredo = process.env.ASSINATURA_SECRET;
  if (!segredo || segredo.length < 32) throw new Error('ASSINATURA_SECRET deve conter ao menos 32 caracteres.');
  const chave = await crypto.subtle.importKey('raw', new TextEncoder().encode(segredo), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mensagem = JSON.stringify(['evolucao:v2', dados.evolucaoId, dados.cooperadoId, dados.instante, dados.conteudo]);
  const assinatura = await crypto.subtle.sign('HMAC', chave, new TextEncoder().encode(mensagem));
  return `v2:${Array.from(new Uint8Array(assinatura)).map(b => b.toString(16).padStart(2, '0')).join('')}`;
}
