'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { subscribeToSync, synchronizeQueue, SyncStatus } from '@/lib/sync-service';
import { fetchAutenticado, descartarToken } from '@/lib/api-cliente';

export interface CooperadoUser {
  id: string;
  nome: string;
  email: string;
  cpf?: string;
  foto?: string | null;
  cargo: 'Tecnico_Enfermagem' | 'Medico' | 'Terapeuta' | string;
  profissao: string;
  autenticado: boolean;
}

interface CooperadoContextType {
  user: CooperadoUser | null;
  isAutenticado: boolean;
  carregandoSessao: boolean;
  syncStatus: SyncStatus;
  isUserModalOpen: boolean;
  setIsUserModalOpen: (open: boolean) => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  toggleCargo: () => void;
  manualSync: () => Promise<void>;
}

const CooperadoContext = createContext<CooperadoContextType | null>(null);

function formatarProfissao(cargo?: string): string {
  if (!cargo) return 'Técnico(a) de Enfermagem';
  if (cargo === 'Tecnico_Enfermagem' || cargo.toLowerCase().includes('tecnico')) return 'Técnico(a) de Enfermagem';
  if (cargo === 'Medico' || cargo.toLowerCase().includes('medico') || cargo.toLowerCase().includes('médic')) return 'Médico(a)';
  if (cargo === 'Terapeuta' || cargo.toLowerCase().includes('terapeuta')) return 'Terapeuta Ocupacional';
  return cargo;
}

export function CooperadoProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CooperadoUser | null>(null);
  const [carregandoSessao, setCarregandoSessao] = useState(true);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isOnline: true,
    pendingCount: 0,
    isSyncing: false,
    lastSyncedAt: null,
    error: null,
  });

  // 1. Escuta rede e fila de sincronização
  useEffect(() => {
    const unsubscribe = subscribeToSync((status) => {
      setSyncStatus(status);
    });
    return () => unsubscribe();
  }, []);

  // 2. Carrega sessão do usuário (cache inicial + /api/cooperado/me)
  const carregarPerfil = async () => {
    // Cache local imediato para não piscar a tela offline
    if (typeof window !== 'undefined') {
      const salva = window.localStorage.getItem('cooperado_session');
      if (salva) {
        try {
          const parsed = JSON.parse(salva);
          if (parsed && (parsed.id || parsed.nome)) {
            setUser({
              id: parsed.id || 'coop_local',
              nome: parsed.nome || 'Cooperado',
              email: parsed.email || '',
              cpf: parsed.cpf || '',
              foto: parsed.foto || null,
              cargo: parsed.cargo || 'Tecnico_Enfermagem',
              profissao: parsed.profissao || formatarProfissao(parsed.cargo),
              autenticado: true,
            });
            setCarregandoSessao(false);
          }
        } catch {
          window.localStorage.removeItem('cooperado_session');
        }
      }
    }

    try {
      const resposta = await fetchAutenticado('/api/cooperado/me');
      if (!resposta.ok) {
        if (resposta.status === 401 && typeof window !== 'undefined') {
          window.localStorage.removeItem('cooperado_session');
          descartarToken();
          setUser(null);
        }
        setCarregandoSessao(false);
        return;
      }

      const dados = await resposta.json();
      if (dados.success && dados.autenticado) {
        const usuarioAtualizado: CooperadoUser = {
          id: dados.cooperadoId,
          nome: dados.nome,
          email: dados.email || '',
          cpf: dados.cpf || '',
          cargo: dados.cargo || 'Tecnico_Enfermagem',
          profissao: dados.profissao || formatarProfissao(dados.cargo),
          foto: dados.foto || null,
          autenticado: true,
        };
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('cooperado_session', JSON.stringify(usuarioAtualizado));
        }
        setUser(usuarioAtualizado);
      }
    } catch {
      // Falha offline: mantém os dados do cache local
    } finally {
      setCarregandoSessao(false);
    }
  };

  useEffect(() => {
    carregarPerfil();
  }, []);

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.warn('Aviso no logout:', e);
    }
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('cooperado_session');
      descartarToken();
    }
    setUser(null);
    setIsUserModalOpen(false);
    if (typeof window !== 'undefined') {
      window.location.href = '/login?area=cooperado';
    }
  };

  const toggleCargo = () => {
    if (!user) return;
    const cargos = ['Tecnico_Enfermagem', 'Medico', 'Terapeuta'];
    const nextIndex = (cargos.indexOf(user.cargo) + 1) % cargos.length;
    const nextCargo = cargos[nextIndex];
    const updated: CooperadoUser = {
      ...user,
      cargo: nextCargo,
      profissao: formatarProfissao(nextCargo),
    };
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('cooperado_session', JSON.stringify(updated));
    }
    setUser(updated);
  };

  const manualSync = async () => {
    await synchronizeQueue();
  };

  return (
    <CooperadoContext.Provider
      value={{
        user,
        isAutenticado: Boolean(user && user.autenticado),
        carregandoSessao,
        syncStatus,
        isUserModalOpen,
        setIsUserModalOpen,
        logout,
        refreshUser: carregarPerfil,
        toggleCargo,
        manualSync,
      }}
    >
      {children}
    </CooperadoContext.Provider>
  );
}

export function useCooperado() {
  const context = useContext(CooperadoContext);
  if (!context) {
    throw new Error('useCooperado deve ser usado dentro de um CooperadoProvider');
  }
  return context;
}
