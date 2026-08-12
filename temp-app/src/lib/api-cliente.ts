'use client';

import axios from 'axios';

/**
 * Transporte autenticado do módulo de prontuário.
 *
 * Dentro do iframe do Bubble o cookie de sessão não chega (ver
 * `src/lib/sessao-token.ts`). O `/api/auth/sso` devolve, junto do redirecionamento,
 * um token assinado no FRAGMENTO da URL (`#s=...`). Este módulo:
 *
 *   1. captura esse token assim que é importado — antes de qualquer efeito de
 *      componente, porque a avaliação do módulo acontece na importação e os
 *      efeitos só rodam depois da montagem;
 *   2. limpa o fragmento da barra de endereços, para o token não ficar visível
 *      nem entrar no histórico;
 *   3. anexa `Authorization: Bearer` em toda chamada a `/api/cooperado/*`.
 *
 * Onde o cookie chega, o servidor prefere o cookie e o cabeçalho é ignorado.
 * Nada quebra por mandar os dois.
 */

const CHAVE = 'gc_sessao';

/**
 * Fallback em memória. Em iframe de terceira parte o armazenamento é
 * particionado por site de topo — funciona, mas versões antigas do Safari
 * chegam a LANÇAR ao tocar em `sessionStorage`. Perder a sessão inteira por
 * causa disso, em campo, seria pior que não persistir: a cópia em memória
 * sobrevive à navegação client-side, que é como o app navega.
 */
let tokenEmMemoria: string | null = null;

function guardar(token: string) {
  tokenEmMemoria = token;
  try {
    window.sessionStorage.setItem(CHAVE, token);
  } catch {
    /* armazenamento bloqueado: segue só com a cópia em memória */
  }
}

export function lerToken(): string | null {
  if (tokenEmMemoria) return tokenEmMemoria;
  try {
    tokenEmMemoria = window.sessionStorage.getItem(CHAVE);
  } catch {
    tokenEmMemoria = null;
  }
  return tokenEmMemoria;
}

export function descartarToken() {
  tokenEmMemoria = null;
  try {
    window.sessionStorage.removeItem(CHAVE);
  } catch {
    /* nada a fazer */
  }
}

/**
 * Lê `#s=<token>` e apaga o fragmento. `replaceState` em vez de `pushState`
 * para o botão voltar não devolver o usuário a uma URL com token.
 */
export function capturarTokenDoFragmento() {
  if (typeof window === 'undefined') return;
  const hash = window.location.hash;
  if (!hash || hash.length < 2) return;

  const params = new URLSearchParams(hash.slice(1));
  const token = params.get('s');
  if (!token) return;

  guardar(token);

  params.delete('s');
  const resto = params.toString();
  window.history.replaceState(
    window.history.state,
    '',
    window.location.pathname + window.location.search + (resto ? `#${resto}` : ''),
  );
}

/** `true` quando a URL é do prontuário e portanto precisa da credencial. */
function precisaDeToken(url: string | undefined): boolean {
  return !!url && (url.startsWith('/api/cooperado') || url.includes('/api/cooperado'));
}

let interceptadorInstalado = false;

function instalarInterceptador() {
  if (interceptadorInstalado) return;
  interceptadorInstalado = true;

  // Interceptador global: `page.tsx` e `sync-service.ts` usam o axios padrão
  // direto, e passar uma instância nova por todos os pontos de chamada seria
  // fácil de esquecer no próximo que aparecer.
  axios.interceptors.request.use((config) => {
    if (!precisaDeToken(config.url)) return config;
    const token = lerToken();
    if (token) config.headers.set('Authorization', `Bearer ${token}`);
    return config;
  });
}

/** `fetch` com a mesma regra do interceptador, para os pontos que não usam axios. */
export async function fetchAutenticado(entrada: string, init: RequestInit = {}): Promise<Response> {
  const token = precisaDeToken(entrada) ? lerToken() : null;
  if (!token) return fetch(entrada, init);

  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  return fetch(entrada, { ...init, headers });
}

if (typeof window !== 'undefined') {
  capturarTokenDoFragmento();
  instalarInterceptador();
}
