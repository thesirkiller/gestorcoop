'use client';

import React, { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  ShieldCheck,
  UserCheck,
  ArrowRight,
  Loader2,
  ExternalLink,
  AlertCircle,
  FileText,
  Building2,
  Stethoscope,
  KeyRound,
  Sparkles,
} from 'lucide-react';
import { URL_BUBBLE_GESTORCOOP, URL_APEX_GESTORCOOP } from '@/lib/subdominios';

function LoginContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const redirectParam = searchParams.get('redirect');
  const errorParam = searchParams.get('error');
  const areaParam = searchParams.get('area');

  // Identifica intenção inicial de área
  const isGestaoParam =
    areaParam === 'gestor' ||
    errorParam === 'token_missing' ||
    errorParam === 'invalid_token' ||
    errorParam === 'acesso_restrito_gestao' ||
    (redirectParam ? redirectParam.startsWith('/gestor') : false);

  const [abaAtiva, setAbaAtiva] = useState<'gestao' | 'cooperado'>(
    isGestaoParam ? 'gestao' : 'cooperado'
  );

  // Sincroniza com subdomínio real em execução no cliente
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname.toLowerCase();
      if (host.startsWith('gestao.') && areaParam !== 'cooperado') {
        setAbaAtiva('gestao');
      } else if (host.startsWith('cooperado.') && areaParam !== 'gestor') {
        setAbaAtiva('cooperado');
      }
    }
  }, [areaParam]);

  // Estados do formulário de Cooperado (CPF)
  const [cpf, setCpf] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Estados do formulário direto de Token SSO (Gestor)
  const [ssoTokenInput, setSsoTokenInput] = useState('');
  const [tokenLoading, setTokenLoading] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);

  // Formatação com máscara de CPF
  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);

    if (value.length <= 11) {
      value = value
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    }

    setCpf(value);
    if (errorMessage) setErrorMessage(null);
  };

  const handleCpfSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const digitsOnly = cpf.replace(/\D/g, '');

    if (digitsOnly.length !== 11) {
      setErrorMessage('Por favor, digite um CPF válido com 11 dígitos.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/auth/cooperado-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cpf: digitsOnly,
          redirect: redirectParam || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setErrorMessage(data.error || 'Não foi possível validar o CPF. Tente novamente.');
        setLoading(false);
        return;
      }

      // Persiste cache de sessão enriquecida para modo offline no prontuário
      if (typeof window !== 'undefined' && data.cooperado) {
        window.localStorage.setItem(
          'cooperado_session',
          JSON.stringify({
            id: data.cooperado.id,
            nome: data.cooperado.nome,
            cargo: data.cooperado.cargo || 'Tecnico_Enfermagem',
            profissao: data.cooperado.profissao,
            email: data.cooperado.email,
            cpf: data.cooperado.cpf,
            foto: data.cooperado.foto,
            autenticado: true,
          })
        );
        if (data.token) {
          try {
            window.sessionStorage.setItem('gc_sessao', data.token);
          } catch {}
        }
      }

      // Redireciona para o prontuário compartilhado ou painel do cooperado
      const destino = data.redirect || '/cooperado';
      if (typeof window !== 'undefined' && window.location.hostname.startsWith('gestao.')) {
        window.location.href = `https://cooperado.gestorcoop.app${destino.startsWith('/cooperado') ? destino : `/cooperado`}`;
      } else {
        router.push(destino);
      }
    } catch {
      setErrorMessage('Erro de conexão ao servidor. Verifique sua internet.');
      setLoading(false);
    }
  };

  const handleSsoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const token = ssoTokenInput.trim();
    if (!token) {
      setTokenError('Por favor, informe seu token de acesso SSO.');
      return;
    }
    setTokenLoading(true);
    setTokenError(null);
    const destino = redirectParam || '/gestor/prontuarios';
    window.location.href = `/api/auth/sso?token=${encodeURIComponent(token)}&area=gestor&redirect=${encodeURIComponent(destino)}`;
  };

  const isProntuarioRedirect = redirectParam?.includes('/cooperado/prontuario') || redirectParam?.includes('/prontuario');

  return (
    <div className="bg-white border border-slate-200/80 p-7 md:p-9 rounded-3xl shadow-2xl max-w-md w-full relative z-10 transition-all">
      {/* Seletor de Perfil / Abas (Gestão vs Cooperado) */}
      <div className="flex p-1 bg-slate-100 rounded-2xl mb-6 shadow-inner">
        <button
          type="button"
          onClick={() => {
            setAbaAtiva('gestao');
            setErrorMessage(null);
          }}
          className={`flex-1 py-2.5 px-3 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            abaAtiva === 'gestao'
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Gestão & Diretoria</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setAbaAtiva('cooperado');
            setErrorMessage(null);
          }}
          className={`flex-1 py-2.5 px-3 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            abaAtiva === 'cooperado'
              ? 'bg-white text-emerald-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Stethoscope className="w-4 h-4" />
          <span>Portal do Cooperado</span>
        </button>
      </div>

      {/* ============================================================== */}
      {/* ABA 1: GESTÃO & ADMINISTRAÇÃO (SSO via Bubble / GestorCoop)     */}
      {/* ============================================================== */}
      {abaAtiva === 'gestao' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Header Gestor */}
          <div className="text-center">
            <div className="mx-auto w-14 h-14 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mb-3 shadow-inner">
              <Building2 className="w-7 h-7" />
            </div>

            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Acesso Administrativo & Gestão
            </h1>
            <p className="text-slate-500 text-sm mt-1 leading-relaxed">
              Painel exclusivo para diretores, coordenadores e gestores da cooperativa.
            </p>
          </div>

          {/* Mensagens de Alerta ou Contexto */}
          {errorParam && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
              <div className="leading-snug">
                {errorParam === 'token_missing' || errorParam === 'invalid_token' ? (
                  <span>
                    Sua sessão expirou ou o token de acesso não foi identificado. Acesse pelo portal do <strong>GestorCoop</strong> para autenticar com segurança.
                  </span>
                ) : errorParam === 'acesso_restrito_gestao' ? (
                  <span>
                    Esta área é reservada para a equipe de gestão. Autentique-se pelo painel administrativo para prosseguir.
                  </span>
                ) : (
                  <span>Autenticação necessária para acessar esta área restrita de gestão.</span>
                )}
              </div>
            </div>
          )}

          {/* Ação Primária: Retornar ao GestorCoop (Bubble) */}
          <div className="space-y-3">
            <a
              href={URL_BUBBLE_GESTORCOOP}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 px-5 rounded-2xl text-sm font-bold shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
            >
              <span>Ir para o GestorCoop (Bubble)</span>
              <ExternalLink className="w-4 h-4" />
            </a>

            <div className="text-center">
              <a
                href={URL_APEX_GESTORCOOP}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold inline-flex items-center gap-1 transition-colors"
              >
                <span>Acessar portal principal (gestorcoop.app)</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Acesso Direto com Token SSO */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
                Token SSO (Acesso Rápido)
              </span>
              <span className="text-[10px] text-slate-400 font-medium">Opcional</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-tight">
              Já tem o token gerado no Bubble? Cole-o abaixo para entrar imediatamente:
            </p>

            <form onSubmit={handleSsoSubmit} className="space-y-2.5">
              <input
                type="text"
                placeholder="Cole seu token SSO aqui..."
                value={ssoTokenInput}
                onChange={(e) => {
                  setSsoTokenInput(e.target.value);
                  if (tokenError) setTokenError(null);
                }}
                disabled={tokenLoading}
                className="w-full text-xs font-mono text-slate-800 px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-sm placeholder:text-slate-400 placeholder:font-sans"
              />

              {tokenError && (
                <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-[11px] flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                  <span>{tokenError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={tokenLoading || !ssoTokenInput.trim()}
                className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                {tokenLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Validando Token...</span>
                  </>
                ) : (
                  <>
                    <span>Entrar com Token</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Rodapé Gestor */}
          <div className="pt-4 border-t border-slate-100 flex flex-col items-center gap-2.5 text-center">
            <button
              type="button"
              onClick={() => setAbaAtiva('cooperado')}
              className="text-xs text-slate-600 hover:text-emerald-700 font-medium inline-flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Stethoscope className="w-3.5 h-3.5 text-emerald-600" />
              <span>É profissional de saúde cooperado? Acessar com CPF</span>
            </button>

            <div className="text-[10px] text-slate-400 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-indigo-500" />
              <span>Autenticação Integrada GestorCoop • Conformidade LGPD</span>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* ABA 2: PORTAL DO COOPERADO (Autenticação Simplificada por CPF)  */}
      {/* ============================================================== */}
      {abaAtiva === 'cooperado' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Header Cooperado */}
          <div className="text-center">
            <div className="mx-auto w-14 h-14 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mb-3 shadow-inner">
              {isProntuarioRedirect ? <FileText className="w-7 h-7" /> : <ShieldCheck className="w-7 h-7" />}
            </div>

            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              {isProntuarioRedirect ? 'Acesso ao Prontuário' : 'Portal do Cooperado'}
            </h1>
            <p className="text-slate-500 text-sm mt-1 leading-relaxed">
              {isProntuarioRedirect
                ? 'Digite seu CPF para abrir o prontuário do paciente compartilhado.'
                : 'Identifique-se com seu CPF para acessar suas atividades e plantões.'}
            </p>
          </div>

          {/* Alerta de sessão expirada */}
          {errorParam && !errorMessage && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>Sua sessão expirou. Digite seu CPF para continuar o atendimento com segurança.</span>
            </div>
          )}

          {/* Mensagem de Erro de Validação */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <span className="leading-snug">{errorMessage}</span>
            </div>
          )}

          {/* Formulário Zero Atrito: CPF */}
          <form onSubmit={handleCpfSubmit} className="space-y-4">
            <div>
              <label htmlFor="cpf-input" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                CPF do Profissional
              </label>
              <div className="relative">
                <input
                  id="cpf-input"
                  type="text"
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={handleCpfChange}
                  autoFocus
                  disabled={loading}
                  className="w-full text-lg tracking-widest font-mono text-slate-800 px-4 py-3.5 bg-slate-50 border border-slate-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:border-transparent transition-all shadow-sm placeholder:text-slate-400 placeholder:tracking-normal placeholder:font-sans"
                />
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                  <UserCheck className="w-5 h-5" />
                </div>
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">
                Insira os 11 dígitos do seu CPF cadastrado na cooperativa.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || cpf.replace(/\D/g, '').length !== 11}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white py-3.5 px-5 rounded-2xl text-sm font-bold shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Validando Cooperado...</span>
                </>
              ) : (
                <>
                  <span>{isProntuarioRedirect ? 'Acessar Prontuário' : 'Entrar no Sistema'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Rodapé Cooperado */}
          <div className="pt-4 border-t border-slate-100 flex flex-col items-center gap-2.5 text-center">
            <button
              type="button"
              onClick={() => setAbaAtiva('gestao')}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Acesso Administrativo / Gestores (Bubble)</span>
            </button>

            <a
              href="https://cooperacao.gestorcoop.app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-slate-500 hover:text-slate-800 font-medium inline-flex items-center gap-1 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              <span>Novo cooperado? Fazer adesão online</span>
            </a>

            <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-1">
              <ShieldCheck className="w-3 h-3 text-emerald-500" />
              <span>Autenticação segura GestorCoop • Conformidade LGPD</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-emerald-50 text-slate-800 flex items-center justify-center p-4 md:p-6 relative overflow-hidden font-sans">
      {/* Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-100/60 rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-100/60 rounded-full blur-[130px] pointer-events-none" />

      <Suspense
        fallback={
          <div className="bg-white border border-slate-200 p-8 rounded-3xl shadow-xl max-w-md w-full text-center z-10 relative">
            <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mx-auto mb-2" />
            <span className="text-slate-500 text-sm">Carregando portal de acesso...</span>
          </div>
        }
      >
        <LoginContent />
      </Suspense>
    </div>
  );
}
