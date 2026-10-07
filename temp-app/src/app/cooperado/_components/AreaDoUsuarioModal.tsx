/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState } from 'react';
import { useCooperado } from '../cooperado-context';
import { useTema } from '@/lib/tema';
import {
  X,
  Shield,
  LogOut,
  Wifi,
  WifiOff,
  Sun,
  Moon,
  RotateCw,
  Check,
  AlertCircle,
  Stethoscope,
  Briefcase,
  Mail,
  CreditCard,
  Hash,
  LogIn,
} from 'lucide-react';
import Link from 'next/link';

export function AreaDoUsuarioModal() {
  const {
    user,
    isAutenticado,
    isUserModalOpen,
    setIsUserModalOpen,
    logout,
    syncStatus,
    manualSync,
    toggleCargo,
  } = useCooperado();

  const { tema, alternar: alternarTema } = useTema();
  const [confirmandoLogout, setConfirmandoLogout] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const [imgError, setImgError] = useState(false);

  React.useEffect(() => {
    if (!isUserModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saindo) {
        setIsUserModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isUserModalOpen, saindo, setIsUserModalOpen]);

  if (!isUserModalOpen) return null;

  const handleLogout = async () => {
    setSaindo(true);
    await logout();
  };

  const getInitials = (name?: string) => {
    if (!name) return 'CO';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const mascararCpf = (cpf?: string) => {
    if (!cpf) return '***.***.***-**';
    const digits = cpf.replace(/\D/g, '');
    if (digits.length !== 11) return cpf;
    return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-scrim/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={() => {
        if (!saindo) setIsUserModalOpen(false);
      }}
    >
      <div
        className="w-full max-w-sm bg-surface border border-line rounded-xl shadow-float overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header do Modal */}
        <div className="bg-accent-deep text-on-accent p-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-on-accent-muted" />
            <h2 id="user-modal-title" className="font-heavy text-base text-on-accent">
              Área do Cooperado
            </h2>
          </div>
          <button
            onClick={() => setIsUserModalOpen(false)}
            aria-label="Fechar área do cooperado"
            className="w-8 h-8 rounded-full bg-accent-deeper hover:bg-accent-hover text-on-accent flex items-center justify-center transition-all active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Conteúdo com Scroll */}
        <div className="p-4 flex flex-col gap-4 overflow-y-auto">
          {/* Cartão de Identidade com Foto e Nome */}
          <div className="bg-base border border-line rounded-xl p-4 flex flex-col items-center text-center relative shadow-xs">
            <div className="relative mb-3">
              {user?.foto && !imgError ? (
                <img
                  src={user.foto}
                  alt={user.nome || 'Foto do Cooperado'}
                  onError={() => setImgError(true)}
                  className="w-20 h-20 rounded-full object-cover border border-line shadow-xs"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-accent text-on-accent flex items-center justify-center font-heavy text-2xl shadow-xs border border-accent-line">
                  {getInitials(user?.nome)}
                </div>
              )}
              {/* Indicador de Conexão no Avatar */}
              <span
                className={`absolute bottom-0 right-0 w-5 h-5 rounded-full border-2 border-surface flex items-center justify-center ${
                  syncStatus.isOnline ? 'bg-pos-solid text-on-pos' : 'bg-warn-solid text-on-warn'
                }`}
                title={syncStatus.isOnline ? 'Conexão Online' : 'Modo Offline'}
              >
                {syncStatus.isOnline ? (
                  <Wifi className="w-2.5 h-2.5" />
                ) : (
                  <WifiOff className="w-2.5 h-2.5" />
                )}
              </span>
            </div>

            <h3 className="font-heavy text-ink text-base leading-snug">
              {user?.nome || 'Profissional Não Identificado'}
            </h3>

            <div className="mt-1 flex flex-wrap items-center justify-center gap-1.5">
              <span className="inline-flex items-center gap-1 bg-accent-soft text-accent-soft-ink border border-accent-line text-[11px] font-strong px-2.5 py-0.5 rounded-full">
                <Stethoscope className="w-3 h-3" />
                {user?.profissao || 'Profissional de Saúde'}
              </span>

              {isAutenticado ? (
                <span className="inline-flex items-center gap-1 bg-pos-soft text-pos-ink border border-pos-line text-[10px] font-heavy px-2 py-0.5 rounded-full">
                  <Check className="w-3 h-3" />
                  Sessão Ativa
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 bg-warn-soft text-warn-ink border border-warn-line text-[10px] font-heavy px-2 py-0.5 rounded-full">
                  <AlertCircle className="w-3 h-3" />
                  Desconectado
                </span>
              )}
            </div>
          </div>

          {/* Dados do Cooperado */}
          <div className="bg-surface border border-line rounded-xl p-3 flex flex-col gap-2.5 text-xs">
            <h4 className="font-strong text-muted uppercase tracking-wider text-[10px]">
              Dados Cadastrais
            </h4>

            <div className="flex items-center justify-between py-1 border-b border-line-soft">
              <span className="text-muted flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5" /> CPF:
              </span>
              <span className="font-mono font-strong text-ink">
                {user?.cpf ? mascararCpf(user.cpf) : '***.***.***-**'}
              </span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-line-soft">
              <span className="text-muted flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" /> E-mail:
              </span>
              <span className="font-strong text-ink truncate max-w-[180px]">
                {user?.email || 'Cadastrado na cooperativa'}
              </span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-line-soft">
              <span className="text-muted flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5" /> Atuação:
              </span>
              <span className="font-strong text-ink">
                Home Care / Domiciliar
              </span>
            </div>

            <div className="flex items-center justify-between py-1">
              <span className="text-muted flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5" /> ID Cooperado:
              </span>
              <span className="font-mono text-muted text-[11px] truncate max-w-[160px]">
                {user?.id ? user.id.slice(0, 14) : 'Local'}
              </span>
            </div>
          </div>

          {/* Status de Sincronização & Armazenamento */}
          <div className="bg-surface border border-line rounded-xl p-3 flex flex-col gap-2 text-xs">
            <div className="flex justify-between items-center">
              <h4 className="font-strong text-muted uppercase tracking-wider text-[10px]">
                Sincronização Offline
              </h4>
              <span
                className={`text-[10px] font-heavy px-2 py-0.5 rounded-full border ${
                  syncStatus.isOnline
                    ? 'bg-pos-soft text-pos-ink border-pos-line'
                    : 'bg-warn-soft text-warn-ink border-warn-line'
                }`}
              >
                {syncStatus.isOnline ? 'Online' : 'Offline'}
              </span>
            </div>

            <p className="text-muted text-[11px]">
              {syncStatus.pendingCount === 0
                ? 'Todos os registros clínicos deste aparelho estão sincronizados na nuvem.'
                : `${syncStatus.pendingCount} registro(s) pendente(s) de envio para a nuvem.`}
            </p>

            {syncStatus.pendingCount > 0 && syncStatus.isOnline && (
              <button
                onClick={manualSync}
                disabled={syncStatus.isSyncing}
                className="mt-1 flex items-center justify-center gap-1.5 w-full py-1.5 bg-accent text-on-accent text-xs font-strong rounded-lg hover:bg-accent-hover transition-all"
              >
                <RotateCw className={`w-3.5 h-3.5 ${syncStatus.isSyncing ? 'animate-spin' : ''}`} />
                {syncStatus.isSyncing ? 'Sincronizando...' : 'Enviar Dados Pendentes Agora'}
              </button>
            )}
          </div>

          {/* Configurações Rápidas: Tema & Cargo de Simulação */}
          <div className="flex flex-col gap-2">
            <h4 className="font-strong text-muted uppercase tracking-wider text-[10px] px-1">
              Ajustes de Visualização
            </h4>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={alternarTema}
                className="flex items-center justify-center gap-2 p-2.5 rounded-xl border border-line bg-surface hover:bg-surface-hover text-xs font-strong text-ink transition-all active:scale-95"
              >
                {tema === 'escuro' ? (
                  <>
                    <Sun className="w-4 h-4 text-warn-solid" />
                    Tema Claro
                  </>
                ) : (
                  <>
                    <Moon className="w-4 h-4 text-accent" />
                    Tema Escuro
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={toggleCargo}
                title="Alternar cargo clínico para testar permissões"
                className="flex items-center justify-center gap-1.5 p-2.5 rounded-xl border border-line bg-surface hover:bg-surface-hover text-xs font-strong text-ink transition-all active:scale-95"
              >
                <Stethoscope className="w-4 h-4 text-accent" />
                Trocar Perfil
              </button>
            </div>
          </div>

          {/* Seção de Sessão: Logout ou Login */}
          <div className="pt-2 border-t border-line flex flex-col gap-2">
            {isAutenticado ? (
              confirmandoLogout ? (
                <div className="bg-crit-soft border border-crit-line rounded-xl p-3 flex flex-col gap-2 animate-in fade-in">
                  <p className="text-xs font-strong text-crit-ink">
                    Tem certeza que deseja deslogar?
                  </p>
                  <p className="text-[11px] text-crit-ink/90">
                    Seus prontuários salvos localmente continuarão armazenados com segurança no aparelho.
                  </p>
                  <div className="flex gap-2 mt-1">
                    <button
                      onClick={handleLogout}
                      disabled={saindo}
                      className="flex-1 py-1.5 bg-crit-solid text-on-crit text-xs font-heavy rounded-lg hover:bg-crit-solid-hover transition-all flex items-center justify-center gap-1"
                    >
                      {saindo ? (
                        <>
                          <RotateCw className="w-3.5 h-3.5 animate-spin" />
                          Saindo...
                        </>
                      ) : (
                        'Sim, Deslogar'
                      )}
                    </button>
                    <button
                      onClick={() => setConfirmandoLogout(false)}
                      disabled={saindo}
                      className="flex-1 py-1.5 bg-surface border border-line text-ink text-xs font-strong rounded-lg hover:bg-surface-hover transition-all"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmandoLogout(true)}
                  className="w-full py-2.5 px-3 rounded-lg border border-crit-line bg-crit-soft text-crit-ink hover:bg-crit-line font-strong text-xs flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  <LogOut className="w-4 h-4" />
                  Deslogar da Conta
                </button>
              )
            ) : (
              <Link
                href="/login?area=cooperado"
                onClick={() => setIsUserModalOpen(false)}
                className="w-full py-2.5 px-3 rounded-lg bg-accent text-on-accent hover:bg-accent-hover font-heavy text-xs flex items-center justify-center gap-2 transition-all active:scale-95 shadow-xs"
              >
                <LogIn className="w-4 h-4" />
                Fazer Login com CPF
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
