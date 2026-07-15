'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Lock, ShieldAlert, ExternalLink } from 'lucide-react';

function LoginContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  let errorTitle = 'Acesso Restrito';
  let errorDescription = 'Esta área é reservada para gestores autenticados da cooperativa.';

  if (error === 'token_missing' || error === 'invalid_token') {
    errorTitle = 'Sessão Expirada ou Inválida';
    errorDescription = 'O token de acesso único fornecido expirou ou é inválido. Por favor, acesse o painel principal no Bubble e clique no menu novamente para gerar um novo token.';
  } else if (error === 'internal_error') {
    errorTitle = 'Erro de Autenticação';
    errorDescription = 'Ocorreu um erro interno ao processar a autenticação. Tente novamente a partir do painel do Bubble.';
  }

  return (
    <div className="bg-white border border-slate-200 p-8 md:p-10 rounded-2xl shadow-xl max-w-md w-full text-center z-10 relative">
      <div className="mx-auto w-16 h-16 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mb-6">
        {error ? <ShieldAlert className="w-8 h-8" /> : <Lock className="w-8 h-8" />}
      </div>

      <h1 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">
        {errorTitle}
      </h1>
      <p className="text-slate-500 text-sm leading-relaxed mb-8">
        {errorDescription}
      </p>

      <div className="space-y-3">
        <a
          href="https://gestorcoop.app/"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 px-4 rounded-xl text-sm font-bold shadow-md flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
        >
          Acessar Painel no Bubble
          <ExternalLink className="w-4 h-4" />
        </a>
        
        <div className="text-[11px] text-slate-400 mt-6 pt-6 border-t border-slate-100">
          GestorCoop — Sistema Integrado de Gestão de Cooperados e Equipamentos
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-100 rounded-full blur-[120px] pointer-events-none opacity-60" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-100 rounded-full blur-[120px] pointer-events-none opacity-60" />

      <Suspense fallback={
        <div className="bg-white border border-slate-200 p-8 rounded-2xl shadow-xl max-w-md w-full text-center z-10 relative">
          Carregando...
        </div>
      }>
        <LoginContent />
      </Suspense>
    </div>
  );
}
