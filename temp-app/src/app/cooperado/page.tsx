/* eslint-disable */
'use client';

import React, { useState, useEffect } from 'react';
import { localDB } from '@/lib/indexeddb';
import { subscribeToSync } from '@/lib/sync-service';
import { useCooperado } from './cooperado-context';
import {
  MapPin,
  User,
  FileText,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  Clock,
  CalendarClock,
  CheckCircle2,
  Stethoscope,
  LogOut,
  Play,
  Pill,
  AlertTriangle,
  LogIn,
  Check,
  Activity,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import axios from 'axios';

interface ProntuarioItem {
  pacienteId: string;
  pacienteNome: string;
  cpf: string;
  dataNascimento: string;
  endereco: string;
  horario: string;
  dataLabel: string;
  status: 'Pendente' | 'Em_Andamento' | 'Concluído';
  limite_visitas_mes?: number;
  visitas_realizadas_mes?: number;
  visitas_restantes_mes?: number;
  limite_atingido?: boolean;
  warnings?: string[];
  evolucaoId?: string;
  checkIn?: string;
  checkOut?: string;
  dataAssinatura?: string;
  transcricaoPreview?: string;
  medicamentosAdministrados?: number;
  totalMedicamentos?: number;
  syncPendente?: boolean;
}

type TabType = 'proximos' | 'de_hoje' | 'finalizados';

export default function CooperadoDashboard() {
  const { user, isAutenticado, carregandoSessao, setIsUserModalOpen, logout } = useCooperado();
  const [items, setItems] = useState<ProntuarioItem[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('de_hoje');
  const [isOnline, setIsOnline] = useState(true);
  const [loading, setLoading] = useState(false);
  const [prefetechedAt, setPrefetchedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);

  // Monitorar rede
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const unsubscribe = subscribeToSync((status) => {
      setIsOnline(status.isOnline);
    });
    return () => unsubscribe();
  }, []);

  // Carregar dados locais do IndexedDB
  useEffect(() => {
    loadLocalData();
  }, []);

  const loadLocalData = async () => {
    try {
      const [pacientes, evolucoes, aprazamentos] = await Promise.all([
        localDB.getPacientes(),
        localDB.getEvolucoes(),
        localDB.getAprazamentos(),
      ]);

      if (pacientes.length > 0) {
        const horas = ['08:00', '13:00', '16:00', '20:00'];

        const mapped: ProntuarioItem[] = pacientes.map((p: any, idx) => {
          // Busca a evolução mais recente deste paciente
          const pacEvolucoes = evolucoes
            .filter((e) => e.paciente_id === p.id)
            .sort((a, b) => {
              const tA = new Date(a.data_assinatura || a.check_out || a.check_in || 0).getTime();
              const tB = new Date(b.data_assinatura || b.check_out || b.check_in || 0).getTime();
              return tB - tA;
            });
          const ev = pacEvolucoes[0];

          const pacAprazamentos = aprazamentos.filter(
            (a) => a.prescricao_id || (a as any).paciente_id === p.id
          );
          const administrados = pacAprazamentos.filter(
            (a) => a.status === 'Administrado'
          ).length;

          let status: ProntuarioItem['status'] = 'Pendente';
          if (ev) {
            status =
              ev.status === 'Finalizado' || ev.status === 'Assinado_Pendente_Sync'
                ? 'Concluído'
                : 'Em_Andamento';
          }

          const horario = horas[idx % horas.length];
          const dataLabel = idx >= 2 ? 'Hoje mais tarde' : 'Hoje';

          return {
            pacienteId: p.id,
            pacienteNome: p.nome,
            horario,
            dataLabel,
            status,
            endereco: p.endereco || 'Domicílio cadastrado',
            cpf: p.cpf || '***.***.***-**',
            dataNascimento: p.data_nascimento || '01/01/1970',
            limite_visitas_mes: p.limite_visitas_mes,
            visitas_realizadas_mes: p.visitas_realizadas_mes,
            visitas_restantes_mes: p.visitas_restantes_mes,
            limite_atingido: p.limite_atingido,
            warnings: Array.isArray(p.warnings) ? p.warnings : [],
            evolucaoId: ev?.id,
            checkIn: ev?.check_in,
            checkOut: ev?.check_out,
            dataAssinatura: ev?.data_assinatura,
            transcricaoPreview: ev?.transcricao_revisada || ev?.transcricao_crua,
            medicamentosAdministrados: administrados,
            totalMedicamentos: pacAprazamentos.length,
            syncPendente: ev?.status === 'Assinado_Pendente_Sync',
          };
        });

        setItems(mapped);

        const lastPrefetch = window.localStorage.getItem('gc_last_prefetch');
        if (lastPrefetch) {
          setPrefetchedAt(
            new Date(lastPrefetch).toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
            })
          );
        }
      } else {
        setItems([]);
        if (isAutenticado && isOnline) {
          // Banco vazio e autenticado: busca da nuvem automaticamente se online
          handlePrefetch();
        }
      }
    } catch (e) {
      console.error('Erro ao ler banco local:', e);
      setError('Falha ao carregar banco de dados local offline.');
    }
  };

  // Se autenticado e sem itens na memória, executa prefetch inicial seguro
  useEffect(() => {
    if (!carregandoSessao && isAutenticado && items.length === 0 && isOnline) {
      handlePrefetch();
    }
  }, [carregandoSessao, isAutenticado]);

  const handlePrefetch = async () => {
    if (!isOnline) return;
    if (!isAutenticado) {
      setError('Faça login com seu CPF para carregar sua escala de atendimentos.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get('/api/cooperado/agenda');
      const { pacientes, prescricoes, aprazamentos } = response.data;

      await localDB.savePacientes(pacientes || []);
      await localDB.savePrescricoes(prescricoes || []);
      await localDB.saveAprazamentos(aprazamentos || []);

      const now = new Date().toISOString();
      window.localStorage.setItem('gc_last_prefetch', now);
      setPrefetchedAt(
        new Date(now).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      );

      await loadLocalData();
    } catch (err: any) {
      console.error('Erro no prefetch:', err);
      if (err?.response?.status === 401) {
        setError('Sessão expirada. Faça login novamente para baixar sua escala.');
      } else {
        setError('Erro ao baixar a agenda da nuvem. Verifique sua conexão.');
      }
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return 'CO';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Separação dos dados para as 3 abas solicitadas
  // 1. Finalizados: atendimentos já concluídos e assinados
  const itensFinalizados = items.filter((item) => item.status === 'Concluído');

  // 2. De hoje: escala do dia (atendimentos em andamento, pendentes ou concluídos hoje)
  const itensDeHoje = items.filter(
    (item) => item.dataLabel.toLowerCase().includes('hoje') || item.status === 'Em_Andamento'
  );

  // 3. Próximos: atendimentos pendentes / a serem iniciados
  const itensProximos = items.filter((item) => item.status === 'Pendente');

  const itensEmAndamento = items.filter((item) => item.status === 'Em_Andamento');

  return (
    <div className="flex flex-col gap-4">
      {/* ============================================================== */}
      {/* 1. SEÇÃO DE PERFIL DO COOPERADO NA HOME                       */}
      {/* ============================================================== */}
      <section
        aria-label="Perfil do Cooperado"
        className="bg-surface border border-line rounded-xl p-4 shadow-card flex flex-col gap-3 relative overflow-hidden"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {/* Foto ou Iniciais */}
            <div className="relative shrink-0">
              {user?.foto && !imgError ? (
                <img
                  src={user.foto}
                  alt={user.nome || 'Foto do Cooperado'}
                  onError={() => setImgError(true)}
                  className="w-14 h-14 rounded-full object-cover border border-line shadow-xs"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-accent text-on-accent flex items-center justify-center font-heavy text-base shadow-xs border border-accent-line">
                  {getInitials(user?.nome)}
                </div>
              )}
              {/* Status Online/Offline */}
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-surface flex items-center justify-center ${
                  isOnline ? 'bg-pos-solid text-on-pos' : 'bg-warn-solid text-on-warn'
                }`}
                title={isOnline ? 'Conectado' : 'Modo Offline'}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              </span>
            </div>

            {/* Identificação: Nome e Profissão */}
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] text-muted font-medium">Olá, bom plantão!</span>
              <h1 className="font-heavy text-ink text-base leading-tight truncate">
                {user?.nome || (isAutenticado ? 'Cooperado' : 'Visitante')}
              </h1>

              <div className="mt-1 flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 bg-accent-soft text-accent-soft-ink border border-accent-line text-[11px] font-strong px-2 py-0.5 rounded-full truncate">
                  <Stethoscope className="w-3 h-3 shrink-0" />
                  <span className="truncate">
                    {user?.profissao || 'Técnico(a) de Enfermagem'}
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* Botão para abrir Área do Usuário */}
          <div className="flex flex-col gap-1 items-end shrink-0 pl-2">
            <button
              onClick={() => setIsUserModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-strong rounded-lg bg-chip hover:bg-chip-hover border border-line text-ink transition-all active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus shadow-xs"
              title="Abrir Área do Usuário completa"
            >
              <User className="w-3.5 h-3.5 text-accent" />
              <span>Meu Perfil</span>
            </button>

            {isAutenticado && (
              <button
                onClick={() => setIsUserModalOpen(true)}
                className="text-[10px] text-crit-ink font-strong hover:underline flex items-center gap-1 px-1 py-0.5"
                title="Sair da Conta"
              >
                <LogOut className="w-2.5 h-2.5" />
                Deslogar
              </button>
            )}
          </div>
        </div>

        {/* Barra de Status de Autenticação */}
        <div className="pt-2 border-t border-line-soft flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                isAutenticado ? 'bg-pos-solid' : 'bg-warn-solid'
              }`}
            />
            <span className="text-muted">
              {isAutenticado ? (
                <>
                  Sessão ativa:{' '}
                  <strong className="text-ink font-strong">
                    {user?.cpf ? `CPF final ${user.cpf.slice(-4)}` : 'Identificado'}
                  </strong>
                </>
              ) : (
                <span className="text-warn-ink font-strong">Você está deslogado</span>
              )}
            </span>
          </div>

          {!isAutenticado && (
            <Link
              href="/login?area=cooperado"
              className="inline-flex items-center gap-1 text-[11px] font-heavy text-accent hover:underline"
            >
              <LogIn className="w-3 h-3" />
              Fazer Login
            </Link>
          )}
        </div>

      </section>

      {/* Alerta amigável se deslogado */}
      {!isAutenticado && (
        <div className="bg-warn-soft border border-warn-line text-warn-ink p-3 rounded-xl flex items-center justify-between gap-3 text-xs shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Faça login para assinar evoluções e ter sua agenda personalizada.</span>
          </div>
          <Link
            href="/login?area=cooperado"
            className="shrink-0 bg-warn-solid text-on-warn font-heavy px-2.5 py-1 rounded-md text-[11px] hover:bg-warn-solid-hover transition-all"
          >
            Entrar
          </Link>
        </div>
      )}

      {/* Destaque Atendimento em Andamento (se houver) */}
      {itensEmAndamento.length > 0 && (
        <div className="bg-info-soft border border-info-line rounded-xl p-3 flex flex-col gap-2 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-info-ink font-heavy text-xs">
              <Activity className="w-4 h-4 animate-spin" />
              <span>Atendimento em andamento agora</span>
            </div>
            <span className="text-[10px] bg-info-ink text-white px-2 py-0.5 rounded-full font-heavy uppercase tracking-wider">
              Ativo
            </span>
          </div>

          {itensEmAndamento.map((item) => (
            <Link
              key={item.pacienteId}
              href={`/cooperado/prontuario/${item.pacienteId}`}
              className="bg-surface rounded-xl p-3 border border-line flex items-center justify-between hover:border-info-line transition-all"
            >
              <div className="min-w-0 pr-2">
                <p className="font-heavy text-ink text-sm truncate">{item.pacienteNome}</p>
                <p className="text-muted text-xs flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3 shrink-0" />
                  <span className="truncate">{item.endereco}</span>
                </p>
              </div>
              <span className="shrink-0 flex items-center gap-1 bg-accent text-on-accent text-xs font-strong px-3 py-1.5 rounded-lg shadow-xs">
                <Play className="w-3 h-3 fill-current" />
                Continuar
              </span>
            </Link>
          ))}
        </div>
      )}

      {/* ============================================================== */}
      {/* 2. TRÊS ABAS: PRÓXIMOS, DE HOJE, FINALIZADOS                   */}
      {/* ============================================================== */}
      <section aria-label="Abas de Prontuários" className="flex flex-col gap-3">
        {/* Barra superior de status de sincronização e atualização */}
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-strong text-muted uppercase tracking-wider">
            Meus Prontuários
          </h2>

          <div className="flex items-center gap-2">
            {prefetechedAt && (
              <span className="text-[11px] text-muted hidden xs:inline">
                Carga {prefetechedAt}
              </span>
            )}
            <button
              onClick={handlePrefetch}
              disabled={!isOnline || loading || !isAutenticado}
              aria-label="Carregar Agenda"
              className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-strong rounded-lg border transition-all active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                isOnline && isAutenticado && !loading
                  ? 'bg-chip hover:bg-chip-hover border-line text-ink'
                  : 'bg-disabled border-line text-disabled-ink cursor-not-allowed'
              }`}
              title="Carregar ou atualizar agenda de atendimentos"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Baixando...' : (items.length > 0 ? 'Atualizar' : 'Carregar Agenda')}</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-crit-soft border border-crit-line text-crit-ink text-xs p-2 rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {/* Barra de Navegação das Abas */}
        <div
          role="tablist"
          aria-label="Categorias de Atendimento"
          className="grid grid-cols-3 p-1 bg-surface border border-line rounded-xl shadow-xs"
        >
          {/* Aba 1: Próximos */}
          <button
            role="tab"
            id="tab-proximos"
            aria-selected={activeTab === 'proximos'}
            aria-controls="panel-proximos"
            onClick={() => setActiveTab('proximos')}
            className={`flex items-center justify-center gap-1.5 py-2 px-2 text-xs rounded-lg transition-all ${
              activeTab === 'proximos'
                ? 'bg-accent text-on-accent font-heavy shadow-xs'
                : 'text-muted hover:text-ink font-strong'
            }`}
          >
            <CalendarClock className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Próximos</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-heavy ${
                activeTab === 'proximos'
                  ? 'bg-white/20 text-white'
                  : 'bg-chip text-muted'
              }`}
            >
              {itensProximos.length}
            </span>
          </button>

          {/* Aba 2: De hoje */}
          <button
            role="tab"
            id="tab-de_hoje"
            aria-selected={activeTab === 'de_hoje'}
            aria-controls="panel-de_hoje"
            onClick={() => setActiveTab('de_hoje')}
            className={`flex items-center justify-center gap-1.5 py-2 px-2 text-xs rounded-lg transition-all ${
              activeTab === 'de_hoje'
                ? 'bg-accent text-on-accent font-heavy shadow-xs'
                : 'text-muted hover:text-ink font-strong'
            }`}
          >
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">De hoje</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-heavy ${
                activeTab === 'de_hoje'
                  ? 'bg-white/20 text-white'
                  : 'bg-chip text-muted'
              }`}
            >
              {itensDeHoje.length}
            </span>
          </button>

          {/* Aba 3: Finalizados */}
          <button
            role="tab"
            id="tab-finalizados"
            aria-selected={activeTab === 'finalizados'}
            aria-controls="panel-finalizados"
            onClick={() => setActiveTab('finalizados')}
            className={`flex items-center justify-center gap-1.5 py-2 px-2 text-xs rounded-lg transition-all ${
              activeTab === 'finalizados'
                ? 'bg-accent text-on-accent font-heavy shadow-xs'
                : 'text-muted hover:text-ink font-strong'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Finalizados</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-heavy ${
                activeTab === 'finalizados'
                  ? 'bg-white/20 text-white'
                  : 'bg-chip text-muted'
              }`}
            >
              {itensFinalizados.length}
            </span>
          </button>
        </div>

        {/* ------------------------------------------------------------ */}
        {/* PAINEL DA ABA 1: PRÓXIMOS                                    */}
        {/* ------------------------------------------------------------ */}
        {activeTab === 'proximos' && (
          <div
            id="panel-proximos"
            role="tabpanel"
            aria-labelledby="tab-proximos"
            className="flex flex-col gap-2.5 animate-in fade-in-50 duration-150"
          >
            <div className="flex justify-between items-center px-1">
              <h3 className="text-xs font-strong text-muted uppercase tracking-wider">
                Próximos Atendimentos Agendados ({itensProximos.length})
              </h3>
            </div>

            {itensProximos.length === 0 ? (
              <div className="bg-surface border border-line border-dashed rounded-xl p-8 text-center text-muted">
                <CalendarClock className="w-10 h-10 text-faint mx-auto mb-2.5" />
                <p className="text-sm font-heavy text-ink">Nenhum atendimento próximo na fila</p>
                <p className="text-xs text-muted mt-1 max-w-xs mx-auto">
                  Você concluiu os atendimentos agendados ou ainda não baixou sua escala de campo.
                </p>
                <button
                  type="button"
                  onClick={handlePrefetch}
                  disabled={!isOnline || loading || !isAutenticado}
                  aria-label="Carregar Agenda"
                  className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-accent text-on-accent text-xs font-heavy rounded-lg shadow-sm hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span>{loading ? 'Carregando agenda...' : 'Carregar Agenda'}</span>
                </button>
              </div>
            ) : (
              itensProximos.map((item) => (
                <Link
                  key={item.pacienteId}
                  href={`/cooperado/prontuario/${item.pacienteId}`}
                  className="bg-surface border border-line rounded-xl p-4 flex flex-col gap-2.5 hover:border-line-strong transition-all shadow-card active:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-focus group"
                >
                  {/* Topo do Card */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="bg-chip text-ink text-[11px] font-heavy px-2.5 py-0.5 rounded-lg border border-line-soft">
                        {item.horario}
                      </span>
                      <span className="text-[10px] text-muted font-strong">
                        {item.dataLabel}
                      </span>
                    </div>

                    <span className="text-[10px] uppercase tracking-wider font-heavy px-2 py-0.5 rounded-full border bg-idle-soft text-idle-ink border-idle-line">
                      Agendado
                    </span>
                  </div>

                  {/* Nome e Endereço */}
                  <div>
                    <h4 className="font-heavy text-ink text-sm group-hover:text-accent transition-colors">
                      {item.pacienteNome}
                    </h4>
                    <p className="text-muted text-xs flex items-center gap-1.5 mt-0.5">
                      <MapPin className="w-3.5 h-3.5 shrink-0 text-muted" />
                      <span className="truncate">{item.endereco}</span>
                    </p>
                  </div>

                  {/* Alertas e Medicamentos */}
                  {item.warnings && item.warnings.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {item.warnings.map((w, i) => (
                        <span
                          key={i}
                          className="bg-warn-soft text-warn-ink border border-warn-line text-[10px] font-strong px-2 py-0.5 rounded-md flex items-center gap-1"
                        >
                          <AlertTriangle className="w-2.5 h-2.5" />
                          {w}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Rodapé do Card com CTA */}
                  <div className="pt-2 border-t border-line-soft flex items-center justify-between text-xs">
                    <span className="text-[11px] text-muted">
                      {item.limite_visitas_mes
                        ? `Cota mês: ${item.visitas_realizadas_mes || 0}/${item.limite_visitas_mes}`
                        : 'Atendimento Domiciliar'}
                    </span>

                    <span className="text-accent font-heavy text-xs flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                      Iniciar Prontuário
                      <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        )}

        {/* ------------------------------------------------------------ */}
        {/* PAINEL DA ABA 2: DE HOJE                                     */}
        {/* ------------------------------------------------------------ */}
        {activeTab === 'de_hoje' && (
          <div
            id="panel-de_hoje"
            role="tabpanel"
            aria-labelledby="tab-de_hoje"
            className="flex flex-col gap-2.5 animate-in fade-in-50 duration-150"
          >
            <div className="flex justify-between items-center px-1">
              <h3 className="text-xs font-strong text-muted uppercase tracking-wider">
                Escala de Hoje ({itensDeHoje.length})
              </h3>
            </div>

            {itensDeHoje.length === 0 ? (
              <div className="bg-surface border border-line border-dashed rounded-xl p-8 text-center text-muted">
                <Clock className="w-10 h-10 text-faint mx-auto mb-2.5" />
                <p className="text-sm font-heavy text-ink">Nenhum atendimento carregado para hoje</p>
                <p className="text-xs text-muted mt-1 max-w-xs mx-auto">
                  Conecte-se à internet e clique em "Carregar Agenda" para baixar os pacientes do seu plantão.
                </p>
                <button
                  type="button"
                  onClick={handlePrefetch}
                  disabled={!isOnline || loading || !isAutenticado}
                  aria-label="Carregar Agenda"
                  className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-accent text-on-accent text-xs font-heavy rounded-lg shadow-sm hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span>{loading ? 'Carregando agenda...' : 'Carregar Agenda'}</span>
                </button>
              </div>
            ) : (
              itensDeHoje.map((item) => (
                <Link
                  key={item.pacienteId}
                  href={`/cooperado/prontuario/${item.pacienteId}`}
                  className="bg-surface border border-line rounded-xl p-4 flex flex-col gap-2.5 hover:border-line-strong transition-all shadow-card active:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-focus group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="bg-chip text-ink text-[11px] font-heavy px-2.5 py-0.5 rounded-lg border border-line-soft">
                        {item.horario}
                      </span>
                      <span className="text-[10px] text-muted">Hoje</span>
                    </div>

                    <span
                      className={`text-[10px] uppercase tracking-wider font-heavy px-2.5 py-0.5 rounded-full border ${
                        item.status === 'Concluído'
                          ? 'bg-pos-soft text-pos-ink border-pos-line'
                          : item.status === 'Em_Andamento'
                          ? 'bg-info-soft text-info-ink border-info-line'
                          : 'bg-idle-soft text-idle-ink border-idle-line'
                      }`}
                    >
                      {item.status === 'Em_Andamento'
                        ? 'Em andamento'
                        : item.status === 'Concluído'
                        ? 'Finalizado'
                        : 'Pendente'}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-heavy text-ink text-sm group-hover:text-accent transition-colors">
                      {item.pacienteNome}
                    </h4>
                    <p className="text-muted text-xs flex items-center gap-1.5 mt-0.5">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{item.endereco}</span>
                    </p>
                  </div>

                  {item.limite_visitas_mes !== undefined && item.limite_visitas_mes > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[10px] font-heavy px-2 py-0.5 rounded-md border ${
                          item.limite_atingido
                            ? 'bg-crit-soft text-crit-ink border-crit-line'
                            : (item.visitas_restantes_mes || 0) <= 2
                            ? 'bg-warn-soft text-warn-ink border-warn-line'
                            : 'bg-accent-soft text-accent-soft-ink border-accent-line'
                        }`}
                      >
                        {item.limite_atingido
                          ? `⚠️ Cota atingida (${item.visitas_realizadas_mes}/${item.limite_visitas_mes})`
                          : `Visitas no mês: ${item.visitas_realizadas_mes || 0}/${item.limite_visitas_mes}`}
                      </span>
                    </div>
                  )}

                  <div className="pt-2 border-t border-line-soft flex items-center justify-between text-xs">
                    <span className="text-[11px] text-muted">
                      CPF: {item.cpf}
                    </span>

                    <span className="text-accent font-heavy text-xs flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                      {item.status === 'Em_Andamento'
                        ? 'Continuar'
                        : item.status === 'Concluído'
                        ? 'Ver Prontuário'
                        : 'Iniciar Atendimento'}
                      <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        )}

        {/* ------------------------------------------------------------ */}
        {/* PAINEL DA ABA 3: FINALIZADOS                                 */}
        {/* ------------------------------------------------------------ */}
        {activeTab === 'finalizados' && (
          <div
            id="panel-finalizados"
            role="tabpanel"
            aria-labelledby="tab-finalizados"
            className="flex flex-col gap-2.5 animate-in fade-in-50 duration-150"
          >
            <div className="flex justify-between items-center px-1">
              <h3 className="text-xs font-strong text-muted uppercase tracking-wider">
                Prontuários Concluídos ({itensFinalizados.length})
              </h3>
            </div>

            {itensFinalizados.length === 0 ? (
              <div className="bg-surface border border-line border-dashed rounded-xl p-8 text-center text-muted">
                <CheckCircle2 className="w-10 h-10 text-faint mx-auto mb-2.5" />
                <p className="text-sm font-heavy text-ink">Nenhum prontuário finalizado ainda</p>
                <p className="text-xs text-muted mt-1 max-w-xs mx-auto">
                  Assim que você concluir e assinar um atendimento, ele ficará disponível aqui no histórico.
                </p>
              </div>
            ) : (
              itensFinalizados.map((item) => (
                <Link
                  key={item.pacienteId}
                  href={`/cooperado/prontuario/${item.pacienteId}`}
                  className="bg-surface border border-line rounded-xl p-4 flex flex-col gap-2.5 hover:border-line-strong transition-all shadow-card active:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-focus group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-pos-ink text-xs font-heavy">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      <span>Prontuário Assinado</span>
                    </div>

                    <span
                      className={`text-[10px] font-heavy px-2 py-0.5 rounded-full border ${
                        item.syncPendente
                          ? 'bg-warn-soft text-warn-ink border-warn-line'
                          : 'bg-pos-soft text-pos-ink border-pos-line'
                      }`}
                    >
                      {item.syncPendente ? 'Pendente de envio' : 'Salvo na Nuvem'}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-heavy text-ink text-sm group-hover:text-accent transition-colors">
                      {item.pacienteNome}
                    </h4>
                    <p className="text-muted text-xs flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{item.endereco}</span>
                    </p>
                  </div>

                  {/* Resumo da Evolução ou transcrição */}
                  {item.transcricaoPreview ? (
                    <div className="bg-base border border-line-soft rounded-xl p-2.5 text-xs text-muted line-clamp-2">
                      <span className="font-strong text-ink">Evolução: </span>
                      {item.transcricaoPreview}
                    </div>
                  ) : (
                    <div className="text-[11px] text-muted flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      <span>Evolução clínica registrada e salva</span>
                    </div>
                  )}

                  <div className="pt-2 border-t border-line-soft flex items-center justify-between text-xs">
                    <span className="text-[10px] text-muted">
                      {item.dataAssinatura
                        ? `Concluído às ${new Date(item.dataAssinatura).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                        : 'Atendimento finalizado'}
                    </span>

                    <span className="text-accent font-heavy text-xs flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                      Ver Prontuário Completo
                      <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        )}
      </section>
    </div>
  );
}
