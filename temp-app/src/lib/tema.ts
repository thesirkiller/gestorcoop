'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Tema claro/escuro do módulo de prontuário.
 *
 * COMO O TEMA É ESCOLHIDO (e por quê)
 * -----------------------------------
 * Três entradas, resolvidas nesta ordem:
 *
 *   1. Escolha manual do profissional, persistida em localStorage.
 *   2. `?tema=` na URL — o app do Bubble embute estas telas num iframe e pode
 *      passar a preferência dele no src. É a única forma de o host mandar no
 *      tema: de dentro do iframe não dá para ler configuração do app hospedeiro.
 *      Quando vem, é gravada como se fosse escolha manual.
 *   3. `auto`: escuro se o sistema pedir escuro OU se o relógio local estiver
 *      na janela de plantão noturno (19h–07h).
 *
 * Por que não só `prefers-color-scheme`: dentro de um WebView o sinal existe,
 * mas reflete a configuração do celular, que a maioria deixa em claro para
 * sempre. Às 3h, no quarto do paciente, a resposta certa é escuro
 * independentemente disso — e é justamente aí que a tela branca inteira dói.
 *
 * Por que não só o alternador manual: obrigar quem já está no escuro a caçar um
 * controle numa tela branca em cheio é a pior versão de "tem modo escuro".
 *
 * Por que o relógio e não o campo `turno` do atendimento: `turno` é dado
 * clínico do registro, escolhido DEPOIS do check-in, dentro de uma tela só
 * (`prontuario/[id]`). A agenda, que é onde o profissional cai primeiro, não
 * tem turno nenhum. E trocar o tema inteiro como efeito colateral de preencher
 * um campo do prontuário é surpresa, não conveniência. O relógio cobre o mesmo
 * sinal, cobre as duas telas, e não depende de nada ter sido preenchido.
 *
 * A resolução do `auto` acontece na montagem e quando o sistema muda de tema.
 * De propósito não há timer virando a tela às 19h em ponto no meio de um
 * atendimento: quem estiver de plantão nesse horário tem o alternador a um
 * toque, e ele vence tudo.
 *
 * O CSS mora em `globals.css`. Este módulo só decide e escreve o atributo.
 */

export type PreferenciaTema = 'auto' | 'claro' | 'escuro';
export type TemaResolvido = 'claro' | 'escuro';

export const CHAVE_TEMA = 'gc_tema';

/** Início e fim (exclusivo) da janela considerada plantão noturno. */
const NOITE_INICIO = 19;
const NOITE_FIM = 7;

function ehPreferencia(valor: unknown): valor is PreferenciaTema {
  return valor === 'auto' || valor === 'claro' || valor === 'escuro';
}

export function lerPreferencia(): PreferenciaTema {
  if (typeof window === 'undefined') return 'auto';
  try {
    const salva = window.localStorage.getItem(CHAVE_TEMA);
    return ehPreferencia(salva) ? salva : 'auto';
  } catch {
    return 'auto';
  }
}

export function salvarPreferencia(pref: PreferenciaTema) {
  try {
    window.localStorage.setItem(CHAVE_TEMA, pref);
  } catch {
    /* modo privado / storage bloqueado dentro do iframe: segue sem persistir */
  }
}

export function ehHorarioNoturno(agora: Date = new Date()): boolean {
  const h = agora.getHours();
  return h >= NOITE_INICIO || h < NOITE_FIM;
}

export function resolverTema(pref: PreferenciaTema): TemaResolvido {
  if (pref === 'claro' || pref === 'escuro') return pref;
  const sistemaEscuro =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
  return sistemaEscuro || ehHorarioNoturno() ? 'escuro' : 'claro';
}

export function aplicarTema(tema: TemaResolvido) {
  if (typeof document === 'undefined') return;
  const raiz = document.documentElement;
  if (tema === 'escuro') raiz.setAttribute('data-theme', 'escuro');
  else raiz.removeAttribute('data-theme');
}

/**
 * Estado do tema para o alternador do cabeçalho.
 *
 * O primeiro render devolve `claro` no servidor e no cliente para não divergir
 * na hidratação; o valor real já está no `<html>` desde antes da primeira
 * pintura, escrito pelo script inline de `app/layout.tsx`. O efeito abaixo só
 * sincroniza o estado do React com o que já está na tela.
 */
export function useTema() {
  const [preferencia, setPreferencia] = useState<PreferenciaTema>('auto');
  const [tema, setTema] = useState<TemaResolvido>('claro');

  useEffect(() => {
    const pref = lerPreferencia();
    setPreferencia(pref);
    const resolvido = resolverTema(pref);
    setTema(resolvido);
    aplicarTema(resolvido);

    // O script inline de `app/layout.tsx` só roda no carregamento do documento.
    // Numa navegação client-side para FORA de /cooperado o atributo ficaria
    // grudado no <html> e escureceria os tokens do painel do gestor, cujo shell
    // ainda é claro. Este hook vive no layout do cooperado: ao desmontar, limpa.
    return () => aplicarTema('claro');
  }, []);

  // Só reage ao sistema enquanto a preferência for automática.
  useEffect(() => {
    if (preferencia !== 'auto') return;
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const aoMudar = () => {
      const resolvido = resolverTema('auto');
      setTema(resolvido);
      aplicarTema(resolvido);
    };
    mq.addEventListener('change', aoMudar);
    return () => mq.removeEventListener('change', aoMudar);
  }, [preferencia]);

  const definir = useCallback((pref: PreferenciaTema) => {
    salvarPreferencia(pref);
    setPreferencia(pref);
    const resolvido = resolverTema(pref);
    setTema(resolvido);
    aplicarTema(resolvido);
  }, []);

  /** Alterna e fixa a escolha: depois do primeiro toque o automático sai de cena. */
  const alternar = useCallback(() => {
    definir(resolverTema(lerPreferencia()) === 'escuro' ? 'claro' : 'escuro');
  }, [definir]);

  return { tema, preferencia, definir, alternar };
}
