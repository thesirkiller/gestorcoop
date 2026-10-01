'use client';

import React, { Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ShieldCheck, UserCheck, ArrowRight, Loader2, ExternalLink, AlertCircle, FileText } from 'lucide-react';

function LoginContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const redirectParam = searchParams.get('redirect');
  const errorParam = searchParams.get('error');

  const [cpf, setCpf] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  const handleSubmit = async (e: React.FormEvent) => {
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

      // Persiste cache de sessão para modo offline no prontuário
      if (typeof window !== 'undefined' && data.cooperado) {
        window.localStorage.setItem(
          'cooperado_session',
          JSON.stringify({
            id: data.cooperado.id,
            nome: data.cooperado.nome,
            cargo: data.cooperado.cargo || 'Tecnico_Enfermagem',
          })
        );
      }

      // Redireciona para o prontuário compartilhado ou painel
      const destino = data.redirect || '/cooperado';
      router.push(destino);
    } catch {
      setErrorMessage('Erro de conexão ao servidor. Verifique sua internet.');
      setLoading(false);
    }
  };

  const isProntuarioRedirect = redirectParam?.includes('/cooperado/prontuario');

  return (
    <div className="bg-white border border-slate-200/80 p-7 md:p-9 rounded-3xl shadow-2xl max-w-md w-full relative z-10 transition-all">
      {/* Header do Card */}
      <div className="text-center mb-6">
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

      {/* Alerta de erro vindo da URL (ex: sessão expirada) */}
      {errorParam && !errorMessage && (
        <div className="mb-5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
          <span>Sua sessão expirou. Digite seu CPF para continuar o atendimento com segurança.</span>
        </div>
      )}

      {/* Mensagem de Erro de Validação/Login */}
      {errorMessage && (
        <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 animate-fadeIn">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
          <span className="leading-snug">{errorMessage}</span>
        </div>
      )}

      {/* Formulário Zero Atrito: Apenas CPF */}
      <form onSubmit={handleSubmit} className="space-y-4">
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

      {/* Rodapé e Acesso Gestor */}
      <div className="mt-7 pt-5 border-t border-slate-100 flex flex-col items-center gap-3">
        <a
          href="https://gestorcoop.app/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1.5 transition-colors"
        >
          Acesso Administrativo / Gestores
          <ExternalLink className="w-3.5 h-3.5" />
        </a>

        <div className="text-[10px] text-slate-400 text-center flex items-center gap-1">
          <ShieldCheck className="w-3 h-3 text-emerald-500" />
          <span>Autenticação segura GestorCoop • Conformidade LGPD</span>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-emerald-50 text-slate-800 flex items-center justify-center p-4 md:p-6 relative overflow-hidden font-sans">
      {/* Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-100/60 rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-100/60 rounded-full blur-[130px] pointer-events-none" />

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
