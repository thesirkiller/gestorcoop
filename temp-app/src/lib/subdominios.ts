/**
 * Utilitários para gestão de subdomínios do GestorCoop:
 * - cooperado.gestorcoop.app: Portal do cooperado, agenda, prontuários de atendimento (isolado da gestão)
 * - gestao.gestorcoop.app: Painel administrativo, prontuários 360°, auditoria, equipamentos, financeiro
 * - cooperacao.gestorcoop.app: Funil de adesão online de novos cooperados
 * - gestorcoop.app: Domínio raiz / institucional
 */

export type SubdominioTipo = 'cooperado' | 'gestao' | 'cooperacao' | null;

export const DOMINIO_PRINCIPAL = 'gestorcoop.app';

/**
 * Identifica o subdomínio atual a partir do host (cabeçalho Host, X-Forwarded-Host ou window.location).
 * Suporta também ambientes locais (ex: cooperado.localhost:3005) e testes.
 */
export function extrairSubdominio(host?: string | null): SubdominioTipo {
  if (!host) return null;
  const hostLimpo = host.toLowerCase().split(':')[0].trim();

  if (hostLimpo.startsWith('cooperado.') || hostLimpo === 'cooperado') {
    return 'cooperado';
  }
  if (hostLimpo.startsWith('gestao.') || hostLimpo === 'gestao') {
    return 'gestao';
  }
  if (hostLimpo.startsWith('cooperacao.') || hostLimpo === 'cooperacao') {
    return 'cooperacao';
  }

  return null;
}

/**
 * Retorna a URL absoluta para a área do Cooperado.
 * Em produção: https://cooperado.gestorcoop.app/prontuario/:id
 * Em desenvolvimento: http://localhost:3005/cooperado/prontuario/:id
 */
export function obterUrlCooperado(caminho: string = ''): string {
  const pathNormalizado = caminho ? (caminho.startsWith('/') ? caminho : `/${caminho}`) : '';

  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname.toLowerCase();
    const ehProducao = hostname.endsWith('gestorcoop.app') || hostname.endsWith('pages.dev');

    if (ehProducao) {
      // Remove prefixo /cooperado se fornecido para manter rotas limpas no subdomínio
      const pathLimpo = pathNormalizado.startsWith('/cooperado/')
        ? pathNormalizado.replace('/cooperado', '')
        : pathNormalizado === '/cooperado'
        ? ''
        : pathNormalizado;
      return `https://cooperado.${DOMINIO_PRINCIPAL}${pathLimpo}`;
    }

    if (pathNormalizado.startsWith('/cooperado')) {
      return `${window.location.origin}${pathNormalizado}`;
    }
    return `${window.location.origin}/cooperado${pathNormalizado}`;
  }

  const pathLimpo = pathNormalizado.startsWith('/cooperado/')
    ? pathNormalizado.replace('/cooperado', '')
    : pathNormalizado === '/cooperado'
    ? ''
    : pathNormalizado;
  return `https://cooperado.${DOMINIO_PRINCIPAL}${pathLimpo}`;
}

/**
 * Retorna a URL absoluta para o painel de Gestão.
 * Em produção: https://gestao.gestorcoop.app/gestor/prontuarios
 * Em desenvolvimento: http://localhost:3005/gestor/prontuarios
 */
export function obterUrlGestao(caminho: string = ''): string {
  const pathNormalizado = caminho ? (caminho.startsWith('/') ? caminho : `/${caminho}`) : '';

  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname.toLowerCase();
    const ehProducao = hostname.endsWith('gestorcoop.app') || hostname.endsWith('pages.dev');

    if (ehProducao) {
      return `https://gestao.${DOMINIO_PRINCIPAL}${pathNormalizado}`;
    }

    if (pathNormalizado.startsWith('/gestor')) {
      return `${window.location.origin}${pathNormalizado}`;
    }
    return `${window.location.origin}/gestor${pathNormalizado}`;
  }

  return `https://gestao.${DOMINIO_PRINCIPAL}${pathNormalizado}`;
}

/**
 * Retorna a URL absoluta para o funil de adesão online (Cooperação).
 * Em produção: https://cooperacao.gestorcoop.app
 * Em desenvolvimento: http://localhost:3005/cooperado/adesao
 */
export function obterUrlCooperacao(caminho: string = ''): string {
  const pathNormalizado = caminho ? (caminho.startsWith('/') ? caminho : `/${caminho}`) : '';

  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname.toLowerCase();
    const ehProducao = hostname.endsWith('gestorcoop.app') || hostname.endsWith('pages.dev');

    if (ehProducao) {
      const pathLimpo = pathNormalizado.startsWith('/cooperado/adesao')
        ? pathNormalizado.replace('/cooperado/adesao', '')
        : pathNormalizado;
      return `https://cooperacao.${DOMINIO_PRINCIPAL}${pathLimpo || ''}`;
    }

    if (pathNormalizado.startsWith('/cooperado/adesao')) {
      return `${window.location.origin}${pathNormalizado}`;
    }
    return `${window.location.origin}/cooperado/adesao${pathNormalizado}`;
  }

  return `https://cooperacao.${DOMINIO_PRINCIPAL}`;
}
