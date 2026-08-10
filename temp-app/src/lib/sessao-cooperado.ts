import { cookies } from 'next/headers';
import { bubbleApi } from '@/lib/bubble';

/**
 * Sessão do cooperado no módulo de prontuário.
 *
 * O cookie guarda o `_id` do `user` do Bubble — mesma convenção do
 * `gestor_session` (ver `api/auth/sso/route.ts`). O identificador do
 * profissional para fins de prontuário, porém, é o `fk_cooperado` desse user
 * (tipo `cooperados`, exibido como `socioscooperados` no editor do Bubble).
 *
 * A distinção importa: quem assina uma evolução é o cooperado, não a conta de
 * acesso. Um mesmo cooperado poderia, no futuro, ter mais de um login.
 *
 * NUNCA aceite o id do profissional vindo do cliente (query string, body ou
 * campo de formulário). Em prontuário a atribuição é o valor legal do
 * documento: se o cliente puder escolher em nome de quem grava, o registro não
 * vale nada. Toda rota do prontuário deve resolver a identidade por aqui.
 */

export const COOKIE_SESSAO_COOPERADO = 'cooperado_session';

export interface SessaoCooperado {
  /** `_id` do `user` do Bubble — o que está no cookie. */
  userId: string;
  /** `_id` do cooperado (`user.fk_cooperado`) — é quem assina o prontuário. */
  cooperadoId: string;
  nome: string;
}

export class SemSessaoError extends Error {
  constructor(mensagem = 'Sessão de cooperado ausente ou inválida.') {
    super(mensagem);
    this.name = 'SemSessaoError';
  }
}

/**
 * Resolve a sessão a partir do cookie. Devolve `null` quando não há cookie ou
 * quando o user não tem cooperado vinculado — nesse segundo caso a pessoa até
 * consegue logar, mas não pode assinar evolução, e é melhor tratar como sem
 * sessão do que gravar um prontuário órfão.
 */
export async function obterSessaoCooperado(): Promise<SessaoCooperado | null> {
  const userId = cookies().get(COOKIE_SESSAO_COOPERADO)?.value;
  if (!userId) return null;

  try {
    const user = await bubbleApi.getUser(userId);
    const cooperadoId: string | undefined = user?.fk_cooperado;
    if (!cooperadoId) {
      console.warn(`User ${userId} autenticou mas não tem fk_cooperado; sem permissão de prontuário.`);
      return null;
    }
    return {
      userId,
      cooperadoId,
      nome: user?.txt_nome || 'Cooperado',
    };
  } catch (error) {
    console.error('Falha ao resolver a sessão do cooperado no Bubble:', error);
    return null;
  }
}

/** Igual a `obterSessaoCooperado`, mas lança em vez de devolver `null`. */
export async function exigirSessaoCooperado(): Promise<SessaoCooperado> {
  const sessao = await obterSessaoCooperado();
  if (!sessao) throw new SemSessaoError();
  return sessao;
}

/**
 * Selo de integridade da assinatura.
 *
 * ATENÇÃO AO QUE ISTO É E AO QUE NÃO É. Isto NÃO é assinatura digital com
 * validade jurídica — para isso seria preciso certificado ICP-Brasil, como já
 * se faz nos termos via ZapSign. O que este selo garante é integridade e
 * atribuição: um HMAC sobre (evolução, cooperado, instante, conteúdo) com um
 * segredo que só o servidor conhece. Serve para provar que o conteúdo não foi
 * alterado depois de assinado e que saiu daquela sessão.
 *
 * Substitui a string fixa `'ass_hash_digital_tecnico_enfermagem'`, que era
 * idêntica para todos os registros e portanto não provava absolutamente nada.
 */
export async function gerarSeloAssinatura(dados: {
  evolucaoId: string;
  cooperadoId: string;
  instante: string;
  conteudo: string;
}): Promise<string> {
  const segredo = process.env.ASSINATURA_SECRET;
  if (!segredo) {
    // Sem segredo não existe selo. Falhar é obrigatório: gravar um valor
    // qualquer aqui reproduziria a assinatura decorativa que estamos removendo.
    throw new Error(
      'ASSINATURA_SECRET não configurada. Sem ela não é possível assinar evolução clínica.',
    );
  }

  const mensagem = [dados.evolucaoId, dados.cooperadoId, dados.instante, dados.conteudo].join('|');
  const chave = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(segredo),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const assinatura = await crypto.subtle.sign('HMAC', chave, new TextEncoder().encode(mensagem));

  const hex = Array.from(new Uint8Array(assinatura))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `v1:${dados.cooperadoId}:${dados.instante}:${hex}`;
}
