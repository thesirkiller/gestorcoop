/* eslint-disable */
'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Wifi, WifiOff, RotateCw, Check, AlertCircle, Shield, Moon, Sun, User, LogIn, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { useTema } from '@/lib/tema';
import { CooperadoProvider, useCooperado } from './cooperado-context';
import { AreaDoUsuarioModal } from './_components/AreaDoUsuarioModal';

function CooperadoShell({ children }: { children: React.ReactNode }) {
  const { user, isAutenticado, syncStatus, manualSync, setIsUserModalOpen, toggleCargo } = useCooperado();
  const { tema, alternar } = useTema();
  const [imgError, setImgError] = useState(false);

  const getInitials = (name?: string) => {
    if (!name) return 'CO';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <div className="min-h-screen bg-base font-sans antialiased text-ink flex justify-center p-0 sm:p-4">
      {/* App Container - Limita largura simulação mobile */}
      <div className="w-full max-w-md bg-canvas min-h-screen sm:min-h-[850px] sm:rounded-3xl sm:shadow-float sm:border sm:border-line overflow-hidden flex flex-col relative">

        {/* Top Header */}
        <header className="bg-accent-deep text-on-accent py-3.5 px-4 shrink-0 shadow-raised">
          <div className="flex justify-between items-center">
            {/* Logo */}
            <Link href="/cooperado" className="flex items-center gap-2 group">
              <Shield className="w-5 h-5 text-on-accent-muted group-hover:text-on-accent transition-colors" />
              <span className="font-heavy tracking-tight text-lg">GestorCoop</span>
            </Link>

            {/* Ações da Direita */}
            <div className="flex items-center gap-2">
              {/* Conectividade Rápida */}
              <div
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-strong ${
                  syncStatus.isOnline
                    ? 'bg-accent-deeper text-pos-on-accent'
                    : 'bg-warn-solid/20 text-warn-on-accent animate-pulse'
                }`}
                title={syncStatus.isOnline ? 'Conexão ativa' : 'Trabalhando offline'}
              >
                {syncStatus.isOnline ? (
                  <>
                    <Wifi className="w-3 h-3" />
                    <span>Online</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3 h-3" />
                    <span>Offline</span>
                  </>
                )}
              </div>

              {/* Alternador de tema */}
              <button
                type="button"
                onClick={alternar}
                aria-pressed={tema === 'escuro'}
                aria-label={tema === 'escuro' ? 'Mudar para o tema claro' : 'Mudar para o tema escuro'}
                title={tema === 'escuro' ? 'Tema claro' : 'Tema escuro'}
                className="bg-accent-deeper hover:bg-accent-hover border border-accent-band-line w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                {tema === 'escuro' ? (
                  <Sun className="w-3.5 h-3.5" aria-hidden="true" />
                ) : (
                  <Moon className="w-3.5 h-3.5" aria-hidden="true" />
                )}
              </button>

              {/* Botão de Área do Usuário / Perfil */}
              {isAutenticado ? (
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(true)}
                  title="Abrir Área do Usuário / Deslogar"
                  className="flex items-center gap-1.5 bg-accent-deeper hover:bg-accent-hover border border-accent-band-line py-1 px-2 rounded-full transition-all active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                >
                  <div className="relative">
                    {user?.foto && !imgError ? (
                      <img
                        src={user.foto}
                        alt=""
                        onError={() => setImgError(true)}
                        className="w-5 h-5 rounded-full object-cover border border-on-accent/30"
                      />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-accent text-[9px] font-heavy text-white flex items-center justify-center">
                        {getInitials(user?.nome)}
                      </div>
                    )}
                    <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-pos-solid border border-accent-deep" />
                  </div>
                  <span className="text-[11px] font-strong text-on-accent max-w-[80px] truncate">
                    {user?.nome?.split(' ')[0] || 'Perfil'}
                  </span>
                  <ChevronDown className="w-3 h-3 text-on-accent-muted" />
                </button>
              ) : (
                <Link
                  href="/login?area=cooperado"
                  className="flex items-center gap-1 bg-accent-deeper hover:bg-accent-hover text-on-accent text-[11px] font-strong py-1 px-2.5 rounded-full border border-accent-band-line transition-all active:scale-95"
                >
                  <LogIn className="w-3 h-3" />
                  Entrar
                </Link>
              )}
            </div>
          </div>

          {/* Sub-bar: Identificação rápida do profissional e status de login */}
          <div className="text-[11px] text-on-accent-muted flex items-center justify-between mt-2 pt-2 border-t border-accent-band-line">
            <button
              onClick={() => setIsUserModalOpen(true)}
              className="text-left flex flex-col group focus:outline-none"
            >
              <div className="flex items-center gap-1.5">
                <span className="font-strong text-on-accent group-hover:underline">
                  {user?.nome || (isAutenticado ? 'Cooperado' : 'Visitante (Desconectado)')}
                </span>
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isAutenticado ? 'bg-pos-solid' : 'bg-warn-solid'
                  }`}
                />
              </div>
              <span className="text-[10px] text-on-accent-muted">
                {user?.profissao || (isAutenticado ? 'Profissional de Saúde' : 'Clique para fazer login')}
              </span>
            </button>

            {/* Atalho de perfil / deslogar */}
            <button
              onClick={() => setIsUserModalOpen(true)}
              className="text-[10px] uppercase font-strong tracking-wider px-2 py-0.5 rounded bg-accent-deeper hover:bg-accent-hover border border-accent-band-line text-on-accent-muted transition-all"
            >
              {isAutenticado ? 'Minha Conta' : 'Fazer Login'}
            </button>
          </div>
        </header>

        {/* Sync Status Bar */}
        <div className={`py-1.5 px-4 text-xs font-semibold shrink-0 flex justify-between items-center border-b transition-all ${
          syncStatus.isSyncing
            ? 'bg-info-soft border-info-line text-info-ink'
            : syncStatus.pendingCount > 0
              ? 'bg-warn-soft border-warn-line text-warn-ink'
              : 'bg-pos-soft border-pos-line text-pos-ink'
        }`}>
          <div className="flex items-center gap-2">
            {syncStatus.isSyncing ? (
              <>
                <RotateCw className="w-3.5 h-3.5 animate-spin" />
                <span>Sincronizando alterações locais...</span>
              </>
            ) : syncStatus.pendingCount > 0 ? (
              <>
                <AlertCircle className="w-3.5 h-3.5 animate-bounce" />
                <span>{syncStatus.pendingCount} pendente{syncStatus.pendingCount > 1 ? 's' : ''} de envio local</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Todos os dados salvos na nuvem</span>
              </>
            )}
          </div>

          {/* Ação manual */}
          {syncStatus.pendingCount > 0 && syncStatus.isOnline && !syncStatus.isSyncing && (
            <button
              onClick={manualSync}
              className="bg-warn-solid hover:bg-warn-solid-hover text-on-warn font-strong px-2 py-0.5 rounded text-[10px] transition-all uppercase active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              Sync Agora
            </button>
          )}
        </div>

        {/* Conteúdo Mobile Scrollable */}
        <main className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 pb-20">
          {children}
        </main>

        {/* Modal de Área do Usuário / Deslogar */}
        <AreaDoUsuarioModal />
      </div>
    </div>
  );
}

export default function CooperadoLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // O funil de adesão / cooperação online possui layout próprio de tela inteira
  if (
    pathname?.startsWith('/cooperado/adesao') ||
    pathname?.startsWith('/adesao') ||
    pathname?.includes('adesao') ||
    (typeof window !== 'undefined' && (
      window.location.hostname.includes('cooperacao') ||
      window.location.pathname.includes('adesao')
    ))
  ) {
    return <>{children}</>;
  }

  return (
    <CooperadoProvider>
      <CooperadoShell>{children}</CooperadoShell>
    </CooperadoProvider>
  );
}
