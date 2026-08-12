/* eslint-disable */
'use client';

import React, { useState, useEffect } from 'react';
import { subscribeToSync, synchronizeQueue, SyncStatus } from '@/lib/sync-service';
import { Wifi, WifiOff, RotateCw, Check, AlertCircle, LogOut, Shield, Moon, Sun } from 'lucide-react';
import Link from 'next/link';
import { useTema } from '@/lib/tema';

interface ProfessionalSession {
  id: string;
  nome: string;
  email: string;
  cargo: 'Tecnico_Enfermagem' | 'Medico' | 'Terapeuta';
}

export default function CooperadoLayout({ children }: { children: React.ReactNode }) {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isOnline: true,
    pendingCount: 0,
    isSyncing: false,
    lastSyncedAt: null,
    error: null,
  });

  const [session, setSession] = useState<ProfessionalSession | null>(null);
  const { tema, alternar } = useTema();

  // A sessão vem do servidor, que a resolve pelo cookie httpOnly. O
  // localStorage é só cache para a tela continuar funcionando offline — nunca
  // fonte de identidade: o que vale para gravar prontuário é o cookie, e o
  // servidor reconfere a cada requisição.
  //
  // Antes daqui saía uma sessão inventada (`coop_123`, "Dra. Ana Silva"), e era
  // ela que assinava todos os registros clínicos do sistema.
  useEffect(() => {
    let cancelado = false;

    const carregar = async () => {
      // Mostra o cache primeiro para não piscar a tela offline.
      if (typeof window !== 'undefined') {
        const salva = window.localStorage.getItem('cooperado_session');
        if (salva) {
          try {
            if (!cancelado) setSession(JSON.parse(salva));
          } catch {
            window.localStorage.removeItem('cooperado_session');
          }
        }
      }

      try {
        const resposta = await fetch('/api/cooperado/me');
        if (!resposta.ok) {
          // 401 significa sessão expirada. Sem identidade não se assina nada:
          // limpamos o cache para a interface não seguir exibindo o profissional
          // anterior como se ele estivesse logado.
          if (resposta.status === 401 && typeof window !== 'undefined') {
            window.localStorage.removeItem('cooperado_session');
            if (!cancelado) setSession(null);
          }
          return;
        }

        const dados = await resposta.json();
        const sessaoReal: ProfessionalSession = {
          id: dados.cooperadoId,
          nome: dados.nome,
          email: '',
          cargo: 'Tecnico_Enfermagem',
        };
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('cooperado_session', JSON.stringify(sessaoReal));
        }
        if (!cancelado) setSession(sessaoReal);
      } catch {
        // Offline: segue com o cache já carregado acima.
      }
    };

    carregar();
    return () => {
      cancelado = true;
    };
  }, []);

  // Se inscrever nas atualizações de sync/rede
  useEffect(() => {
    const unsubscribe = subscribeToSync((status) => {
      setSyncStatus(status);
    });
    return () => unsubscribe();
  }, []);

  const handleManualSync = async () => {
    await synchronizeQueue();
  };

  const handleToggleCargo = () => {
    if (!session) return;
    const cargos: ProfessionalSession['cargo'][] = ['Tecnico_Enfermagem', 'Medico', 'Terapeuta'];
    const nextIndex = (cargos.indexOf(session.cargo) + 1) % cargos.length;
    const updated = { ...session, cargo: cargos[nextIndex] };
    window.localStorage.setItem('cooperado_session', JSON.stringify(updated));
    setSession(updated);
    // Recarrega a página para resetar estados locais das telas
    window.location.reload();
  };

  const cargoLabels: Record<ProfessionalSession['cargo'], string> = {
    Tecnico_Enfermagem: 'Técnico de Enfermagem',
    Medico: 'Médico',
    Terapeuta: 'Terapeuta'
  };

  return (
    <div className="min-h-screen bg-base font-sans antialiased text-ink flex justify-center p-0 sm:p-4">
      {/* App Container - Limita largura simulação mobile */}
      <div className="w-full max-w-md bg-canvas min-h-screen sm:min-h-[850px] sm:rounded-3xl sm:shadow-float sm:border sm:border-line overflow-hidden flex flex-col relative">

        {/* Top Header */}
        <header className="bg-accent-deep text-on-accent py-4 px-5 shrink-0 shadow-raised">
          <div className="flex justify-between items-center mb-1">
            <Link href="/cooperado" className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-on-accent-muted" />
              <span className="font-heavy tracking-tight text-lg">GestorCoop</span>
            </Link>

            <div className="flex items-center gap-2">
              {/* Toggle de cargo para simulação de perfil */}
              <button
                onClick={handleToggleCargo}
                title="Trocar Perfil de Acesso (Simulação)"
                className="bg-accent-deeper hover:bg-accent-hover text-[10px] uppercase font-strong py-1 px-2.5 rounded-full border border-accent-band-line transition-all active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                {session ? cargoLabels[session.cargo] : 'Carregando...'}
              </button>

              {/* Alternador de tema. Fica no cabeçalho, sempre visível: quem
                  precisa dele está num quarto escuro e não vai procurar em menu.
                  Um toque fixa a escolha; até lá o tema segue o sistema e o
                  relógio (ver src/lib/tema.ts). */}
              <button
                type="button"
                onClick={alternar}
                aria-pressed={tema === 'escuro'}
                aria-label={tema === 'escuro' ? 'Mudar para o tema claro' : 'Mudar para o tema escuro'}
                title={tema === 'escuro' ? 'Tema claro' : 'Tema escuro'}
                className="bg-accent-deeper hover:bg-accent-hover border border-accent-band-line w-11 h-11 -my-1.5 rounded-full flex items-center justify-center transition-all active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                {tema === 'escuro' ? (
                  <Sun className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <Moon className="w-4 h-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          <div className="text-[11px] text-on-accent-muted flex items-center justify-between mt-2 pt-2 border-t border-accent-band-line">
            <div>
              <p className="font-strong text-on-accent">{session?.nome || 'Profissional'}</p>
              <p className="text-[10px]">{session?.email}</p>
            </div>

            {/* Conectividade */}
            <div className="flex items-center gap-1.5 bg-accent-deeper px-2 py-1 rounded-md">
              {syncStatus.isOnline ? (
                <>
                  <Wifi className="w-3.5 h-3.5 text-pos-on-accent" />
                  <span className="text-pos-on-accent font-strong">Online</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-warn-on-accent animate-pulse" />
                  <span className="text-warn-on-accent font-strong">Offline</span>
                </>
              )}
            </div>
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
              onClick={handleManualSync}
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
      </div>
    </div>
  );
}
