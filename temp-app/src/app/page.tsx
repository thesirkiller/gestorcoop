import React from 'react';
import Link from 'next/link';
import {
  UserPlus,
  LayoutDashboard,
  ShieldCheck,
  ChevronRight,
  Users,
  Sparkles,
  Stethoscope,
  ArrowUpRight,
} from 'lucide-react';
import { obterUrlCooperacao, obterUrlCooperado, obterUrlGestao } from '@/lib/subdominios';

export default function Home() {
  const urlCooperacao = obterUrlCooperacao();
  const urlCooperado = obterUrlCooperado();
  const urlGestao = obterUrlGestao('/prontuarios');

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-between py-10 px-4 md:px-8 font-sans relative overflow-hidden">
      {/* Decorative Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-100 rounded-full blur-[120px] pointer-events-none opacity-60" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-100 rounded-full blur-[120px] pointer-events-none opacity-60" />

      {/* Header */}
      <header className="max-w-6xl w-full mx-auto flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-50 border border-indigo-100 p-2.5 rounded-xl text-indigo-600 shadow-sm">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-widest font-extrabold text-indigo-600">Plataforma Integrada</span>
            <h1 className="text-lg font-black tracking-tight text-slate-900 leading-none">GestorCoop</h1>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-slate-200 shadow-sm">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span className="text-xs font-semibold text-slate-600">Ambiente Seguro & Separado por Subdomínios</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl w-full mx-auto my-auto py-10 flex flex-col items-center text-center z-10 gap-8">
        <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 px-4 py-1.5 rounded-full text-indigo-700 text-xs font-semibold shadow-sm mb-1">
          <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
          Ambientes Especializados Ativos
        </div>

        <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-slate-900 max-w-3xl leading-[1.15]">
          Acesso unificado aos módulos da{' '}
          <span className="bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-600 bg-clip-text text-transparent">
            cooperativa de saúde
          </span>
        </h2>

        <p className="text-slate-600 text-sm md:text-base max-w-2xl leading-relaxed">
          Selecione o portal correspondente ao seu perfil. O sistema utiliza separação inteligente por subdomínios para garantir privacidade clínica e isolamento operacional.
        </p>

        {/* Action Cards (3 Subdomínios) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl mt-4">
          {/* Card 1: Cooperação Online */}
          <Link
            href={urlCooperacao}
            className="group relative bg-white hover:bg-slate-50/70 border border-slate-200 hover:border-indigo-400 rounded-3xl p-6 text-left transition-all duration-300 flex flex-col justify-between h-80 shadow-sm hover:shadow-xl hover:shadow-indigo-100/50 cursor-pointer overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-bl-[100px] group-hover:bg-indigo-100/50 transition-colors" />
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-2xl text-indigo-600 group-hover:scale-110 transition-transform duration-300 w-fit">
                  <UserPlus className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100">
                  Público
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-1 group-hover:text-indigo-600 transition-colors">
                Cooperação Online
                <ArrowUpRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Ficha de inscrição de novos sócios cooperados, upload de documentos e assinatura eletrônica via ZapSign.
              </p>
            </div>
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono text-indigo-600 font-semibold">
              <span>cooperacao.gestorcoop.app</span>
              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Card 2: Portal do Cooperado */}
          <Link
            href={urlCooperado}
            className="group relative bg-white hover:bg-slate-50/70 border border-slate-200 hover:border-emerald-400 rounded-3xl p-6 text-left transition-all duration-300 flex flex-col justify-between h-80 shadow-sm hover:shadow-xl hover:shadow-emerald-100/50 cursor-pointer overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-bl-[100px] group-hover:bg-emerald-100/50 transition-colors" />
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-2xl text-emerald-600 group-hover:scale-110 transition-transform duration-300 w-fit">
                  <Stethoscope className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                  Cooperados
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-1 group-hover:text-emerald-600 transition-colors">
                Portal do Cooperado
                <ArrowUpRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Acesso aos plantões, agenda do dia, evolução clínica, transcrição por IA e prontuário de atendimento do paciente.
              </p>
            </div>
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono text-emerald-600 font-semibold">
              <span>cooperado.gestorcoop.app</span>
              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Card 3: Gestão & Administração */}
          <Link
            href={urlGestao}
            className="group relative bg-white hover:bg-slate-50/70 border border-slate-200 hover:border-blue-400 rounded-3xl p-6 text-left transition-all duration-300 flex flex-col justify-between h-80 shadow-sm hover:shadow-xl hover:shadow-blue-100/50 cursor-pointer overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-[100px] group-hover:bg-blue-100/50 transition-colors" />
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="bg-blue-50 border border-blue-100 p-3 rounded-2xl text-blue-600 group-hover:scale-110 transition-transform duration-300 w-fit">
                  <LayoutDashboard className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100">
                  Gestão
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-1 group-hover:text-blue-600 transition-colors">
                Painel do Gestor
                <ArrowUpRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Prontuários 360°, auditoria clínica, controle de cotas, gestão de cooperados, locação de equipamentos e financeiro.
              </p>
            </div>
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono text-blue-600 font-semibold">
              <span>gestao.gestorcoop.app</span>
              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
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
