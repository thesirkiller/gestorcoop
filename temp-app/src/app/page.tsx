import React from 'react';
import Link from 'next/link';
import { UserPlus, LayoutDashboard, ShieldCheck, ChevronRight, Users, Sparkles } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-between py-12 px-4 md:px-8 font-sans relative overflow-hidden">
      {/* Decorative Background Glows - subtle and bright */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-100 rounded-full blur-[120px] pointer-events-none opacity-60" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-100 rounded-full blur-[120px] pointer-events-none opacity-60" />

      {/* Header */}
      <header className="max-w-6xl w-full mx-auto flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-50 border border-indigo-100 p-2.5 rounded-xl text-indigo-600 shadow-sm">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-widest font-extrabold text-indigo-600">Plataforma</span>
            <h1 className="text-lg font-black tracking-tight text-slate-900 leading-none">GestorCoop</h1>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-slate-200 shadow-sm">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span className="text-xs font-semibold text-slate-600">Ambiente Seguro</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl w-full mx-auto my-auto py-12 flex flex-col items-center text-center z-10 gap-8">
        <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 px-4 py-1.5 rounded-full text-indigo-700 text-xs font-semibold shadow-sm mb-2">
          <Sparkles className="w-3.5 h-3.5 text-indigo-550" />
          Novo Fluxo de Onboarding Ativo
        </div>
        
        <h2 className="text-4xl md:text-6xl font-extrabold tracking-tight text-slate-900 max-w-2xl leading-[1.1]">
          Facilitando a adesão de <span className="bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-600 bg-clip-text text-transparent">sócios cooperados</span>
        </h2>
        
        <p className="text-slate-600 text-base md:text-lg max-w-xl leading-relaxed">
          Seja bem-vindo ao GestorCoop. Escolha uma das opções abaixo para realizar a sua inscrição de cooperado ou para gerenciar o painel administrativo.
        </p>

        {/* Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl mt-6">
          
          {/* Card 1: Onboarding */}
          <Link 
            href="/cooperado/adesao" 
            className="group relative bg-white hover:bg-slate-50/50 border border-slate-200 hover:border-indigo-400 rounded-2xl p-8 text-left transition-all duration-300 flex flex-col justify-between h-64 shadow-sm hover:shadow-xl hover:shadow-indigo-100/50 cursor-pointer overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-bl-[100px] group-hover:bg-indigo-100/50 transition-colors" />
            <div className="bg-indigo-50 border border-indigo-100 p-3.5 rounded-xl text-indigo-600 group-hover:scale-110 transition-transform duration-300 w-fit">
              <UserPlus className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-955 mb-2 flex items-center gap-1 group-hover:text-indigo-600 transition-colors">
                Ficha de Inscrição & Adesão
                <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
              </h3>
              <p className="text-sm text-slate-550 leading-relaxed">
                Cadastre seus dados pessoais, endereço, profissões, dados bancários e assine o termo eletronicamente via ZapSign.
              </p>
            </div>
          </Link>

          {/* Card 2: Dashboard */}
          <Link 
            href="/gestor/dashboard" 
            className="group relative bg-white hover:bg-slate-50/50 border border-slate-200 hover:border-blue-400 rounded-2xl p-8 text-left transition-all duration-300 flex flex-col justify-between h-64 shadow-sm hover:shadow-xl hover:shadow-blue-100/50 cursor-pointer overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-[100px] group-hover:bg-blue-100/50 transition-colors" />
            <div className="bg-blue-50 border border-blue-100 p-3.5 rounded-xl text-blue-600 group-hover:scale-110 transition-transform duration-300 w-fit">
              <LayoutDashboard className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-955 mb-2 flex items-center gap-1 group-hover:text-blue-600 transition-colors">
                Painel do Gestor
                <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
              </h3>
              <p className="text-sm text-slate-550 leading-relaxed">
                Acesse o dashboard Kanban administrativo para gerenciar, auditar, revisar e aprovar o cadastro de novos cooperados.
              </p>
            </div>
          </Link>

        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl w-full mx-auto border-t border-slate-200 pt-6 text-center z-10">
        <p className="text-xs text-slate-500">
          &copy; {new Date().getFullYear()} GestorCoop. Todos os direitos reservados.
        </p>
      </footer>
    </div>
  );
}
