'use client';

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import Link from 'next/link';
import {
  Activity,
  ArrowLeft,
  RefreshCw,
  Loader2,
  Info,
  Bell,
  Boxes,
  ArrowLeftRight,
  Wrench,
  Zap,
  CheckCircle,
  XCircle,
  Download,
} from 'lucide-react';
import { AlertaEquipamento } from '@/lib/bubble';

type Aba = 'alertas' | 'inventario' | 'movimentacoes' | 'manutencoes';

interface InventarioItem {
  id: string;
  nome: string;
  numeroSerie: string;
  patrimonio: string;
  codigoInterno: string;
  status: string;
  categoria: string;
  fabricante: string;
  localizacao: string;
  ultimaMovimentacao: string;
}

interface MovimentacaoEvento {
  tipo: 'Implantação' | 'Recolhimento';
  data: string;
  locacaoId?: string;
  equipamentoId: string;
  pacienteId: string;
}

interface ManutencaoLinha {
  equipamentoId: string;
  nome: string;
  numeroSerie: string;
  numOrdens: number;
  custoTotal: number;
}

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
    return date.toLocaleDateString('pt-BR');
  } catch {
    return dateStr;
  }
};

const prioridadeClasse = (prioridade?: string) => {
  switch (prioridade) {
    case 'Crítica':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'Alta':
      return 'bg-orange-50 text-orange-700 border-orange-200';
    case 'Média':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200';
  }
};

const statusAlertaClasse = (status?: string) => {
  switch (status) {
    case 'Aberto':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'Em tratamento':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'Resolvido':
      return 'bg-green-50 text-green-700 border-green-200';
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200';
  }
};

export default function GestorEquipamentosRelatorios() {
  const [activeTab, setActiveTab] = useState<Aba>('alertas');
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  // ALERTAS
  const [alertas, setAlertas] = useState<AlertaEquipamento[]>([]);
  const [alertasLoading, setAlertasLoading] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState('Aberto');
  const [filtroPrioridade, setFiltroPrioridade] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');

  // INVENTÁRIO
  const [inventario, setInventario] = useState<InventarioItem[]>([]);
  const [inventarioPorStatus, setInventarioPorStatus] = useState<Record<string, number>>({});
  const [inventarioLoading, setInventarioLoading] = useState(false);
  const [invStatus, setInvStatus] = useState('');
  const [invCategoria, setInvCategoria] = useState('');
  const [invFabricante, setInvFabricante] = useState('');

  // MOVIMENTAÇÕES
  const [movimentacoes, setMovimentacoes] = useState<MovimentacaoEvento[]>([]);
  const [movContagens, setMovContagens] = useState<{ implantacoes: number; recolhimentos: number; total: number }>({
    implantacoes: 0,
    recolhimentos: 0,
    total: 0,
  });
  const [movLoading, setMovLoading] = useState(false);
  const [movInicio, setMovInicio] = useState('');
  const [movFim, setMovFim] = useState('');

  // MANUTENÇÕES
  const [manutencoes, setManutencoes] = useState<ManutencaoLinha[]>([]);
  const [manutTruncado, setManutTruncado] = useState(false);
  const [manutLoading, setManutLoading] = useState(false);

  const extrairErro = (error: unknown, fallback: string) => {
    const e = error as { response?: { data?: { error?: string } } };
    return e.response?.data?.error || fallback;
  };

  // ---- ALERTAS ----
  const fetchAlertas = useCallback(async () => {
    setAlertasLoading(true);
    setErrorMsg('');
    try {
      const params = new URLSearchParams();
      if (filtroStatus) params.set('status', filtroStatus);
      if (filtroPrioridade) params.set('prioridade', filtroPrioridade);
      if (filtroTipo) params.set('tipo', filtroTipo);
      const res = await axios.get(`/api/gestor/equipamentos/alertas?${params.toString()}`);
      if (res.data.success) setAlertas(res.data.data || []);
    } catch (error) {
      setErrorMsg(extrairErro(error, 'Falha ao carregar alertas.'));
    } finally {
      setAlertasLoading(false);
    }
  }, [filtroStatus, filtroPrioridade, filtroTipo]);

  const handleGerarAlertas = async () => {
    setGerando(true);
    setErrorMsg('');
    setInfoMsg('');
    try {
      const res = await axios.post('/api/gestor/equipamentos/alertas/gerar');
      if (res.data.success) {
        const { criados, falhas } = res.data.data;
        setInfoMsg(`Rotina concluída: ${criados} novo(s) alerta(s).${falhas?.length ? ` ${falhas.length} falha(s) por item.` : ''}`);
        fetchAlertas();
      }
    } catch (error) {
      setErrorMsg(extrairErro(error, 'Falha ao gerar alertas.'));
    } finally {
      setGerando(false);
    }
  };

  const handleResolverAlerta = async (alerta: AlertaEquipamento, status: 'Resolvido' | 'Ignorado') => {
    if (!alerta._id) return;
    setErrorMsg('');
    try {
      await axios.patch(`/api/gestor/equipamentos/alertas/${alerta._id}`, { txt_status: status });
      fetchAlertas();
    } catch (error) {
      setErrorMsg(extrairErro(error, 'Falha ao atualizar o alerta.'));
    }
  };

  // ---- INVENTÁRIO ----
  const fetchInventario = useCallback(async () => {
    setInventarioLoading(true);
    setErrorMsg('');
    try {
      const params = new URLSearchParams();
      if (invStatus) params.set('status', invStatus);
      if (invCategoria) params.set('categoria', invCategoria);
      if (invFabricante) params.set('fabricante', invFabricante);
      const res = await axios.get(`/api/gestor/equipamentos/relatorios/inventario?${params.toString()}`);
      if (res.data.success) {
        setInventario(res.data.data.itens || []);
        setInventarioPorStatus(res.data.data.porStatus || {});
      }
    } catch (error) {
      setErrorMsg(extrairErro(error, 'Falha ao carregar inventário.'));
    } finally {
      setInventarioLoading(false);
    }
  }, [invStatus, invCategoria, invFabricante]);

  const handleExportarInventario = () => {
    const escapeCsv = (valor: unknown) => `"${String(valor ?? '').replace(/"/g, '""')}"`;
    const cabecalho = ['Código interno', 'Nome', 'Número de série', 'Patrimônio', 'Situação', 'Categoria', 'Fabricante', 'Localização', 'Última movimentação'];
    const linhas = inventario.map((item) => [
      item.codigoInterno,
      item.nome,
      item.numeroSerie,
      item.patrimonio,
      item.status,
      item.categoria,
      item.fabricante,
      item.localizacao,
      item.ultimaMovimentacao,
    ]);
    const conteudo = [cabecalho, ...linhas].map((linha) => linha.map(escapeCsv).join(';')).join('\n');
    const blob = new Blob([`﻿${conteudo}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `inventario-equipamentos-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // ---- MOVIMENTAÇÕES ----
  const fetchMovimentacoes = useCallback(async () => {
    setMovLoading(true);
    setErrorMsg('');
    try {
      const params = new URLSearchParams();
      if (movInicio) params.set('inicio', movInicio);
      if (movFim) params.set('fim', movFim);
      const res = await axios.get(`/api/gestor/equipamentos/relatorios/movimentacoes?${params.toString()}`);
      if (res.data.success) {
        setMovimentacoes(res.data.data.eventos || []);
        setMovContagens(res.data.data.contagens || { implantacoes: 0, recolhimentos: 0, total: 0 });
      }
    } catch (error) {
      setErrorMsg(extrairErro(error, 'Falha ao carregar movimentações.'));
    } finally {
      setMovLoading(false);
    }
  }, [movInicio, movFim]);

  // ---- MANUTENÇÕES ----
  const fetchManutencoes = useCallback(async () => {
    setManutLoading(true);
    setErrorMsg('');
    try {
      const res = await axios.get('/api/gestor/equipamentos/relatorios/manutencoes');
      if (res.data.success) {
        setManutencoes(res.data.data.ranking || []);
        setManutTruncado(Boolean(res.data.data.truncado));
      }
    } catch (error) {
      setErrorMsg(extrairErro(error, 'Falha ao carregar manutenções.'));
    } finally {
      setManutLoading(false);
    }
  }, []);

  // Load per active tab
  useEffect(() => {
    if (activeTab === 'alertas') fetchAlertas();
    if (activeTab === 'inventario') fetchInventario();
    if (activeTab === 'movimentacoes') fetchMovimentacoes();
    if (activeTab === 'manutencoes') fetchManutencoes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const refreshAtual = () => {
    if (activeTab === 'alertas') fetchAlertas();
    if (activeTab === 'inventario') fetchInventario();
    if (activeTab === 'movimentacoes') fetchMovimentacoes();
    if (activeTab === 'manutencoes') fetchManutencoes();
  };

  const tabs: Array<{ id: Aba; label: string; icon: React.ElementType }> = [
    { id: 'alertas', label: 'Alertas', icon: Bell },
    { id: 'inventario', label: 'Inventário', icon: Boxes },
    { id: 'movimentacoes', label: 'Movimentações', icon: ArrowLeftRight },
    { id: 'manutencoes', label: 'Manutenções', icon: Wrench },
  ];

  const anyLoading = alertasLoading || inventarioLoading || movLoading || manutLoading;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6 md:p-10 font-sans relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-100 rounded-full blur-[120px] pointer-events-none opacity-60" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-100 rounded-full blur-[120px] pointer-events-none opacity-60" />

      {/* Header */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 z-10 relative">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 mb-1 hover:text-indigo-850 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <Link href="/gestor/equipamentos" className="text-xs font-bold uppercase tracking-wider">
              Gestão de Equipamentos
            </Link>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Activity className="w-8 h-8 text-indigo-600 animate-pulse" />
            Relatórios e Alertas
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Alertas operacionais, inventário, movimentações e custo de manutenção do parque de equipamentos.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/gestor/equipamentos"
            className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-all"
          >
            Voltar aos Equipamentos
          </Link>
          <button
            onClick={refreshAtual}
            className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 p-2 rounded-lg transition-all shadow-sm"
            title="Atualizar dados"
          >
            <RefreshCw className={`w-4 h-4 ${anyLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Banners */}
      {errorMsg && (
        <div className="max-w-7xl mx-auto mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-3 shadow-sm z-10 relative">
          <Info className="w-5 h-5 text-red-500 shrink-0" />
          <span className="text-sm font-medium">{errorMsg}</span>
        </div>
      )}
      {infoMsg && (
        <div className="max-w-7xl mx-auto mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl flex items-center gap-3 shadow-sm z-10 relative">
          <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
          <span className="text-sm font-medium">{infoMsg}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="max-w-7xl mx-auto mb-6 z-10 relative">
        <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm w-fit flex-wrap">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === tab.id ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-w-7xl mx-auto z-10 relative">
        {/* ================= ALERTAS ================= */}
        {activeTab === 'alertas' && (
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 flex flex-col md:flex-row md:items-end gap-3">
              <div className="flex flex-wrap gap-3 flex-1">
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Status</label>
                  <select
                    value={filtroStatus}
                    onChange={(e) => setFiltroStatus(e.target.value)}
                    className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Todos</option>
                    <option value="Aberto">Aberto</option>
                    <option value="Em tratamento">Em tratamento</option>
                    <option value="Resolvido">Resolvido</option>
                    <option value="Ignorado">Ignorado</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Prioridade</label>
                  <select
                    value={filtroPrioridade}
                    onChange={(e) => setFiltroPrioridade(e.target.value)}
                    className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Todas</option>
                    <option value="Crítica">Crítica</option>
                    <option value="Alta">Alta</option>
                    <option value="Média">Média</option>
                    <option value="Baixa">Baixa</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Tipo</label>
                  <select
                    value={filtroTipo}
                    onChange={(e) => setFiltroTipo(e.target.value)}
                    className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-indigo-500 max-w-[220px]"
                  >
                    <option value="">Todos</option>
                    <option value="Recolhimento atrasado">Recolhimento atrasado</option>
                    <option value="Preventiva vencida">Preventiva vencida</option>
                    <option value="Calibração vencida">Calibração vencida</option>
                    <option value="Garantia próxima do vencimento">Garantia próxima do vencimento</option>
                    <option value="Conferência pendente">Conferência pendente</option>
                    <option value="Higienização parada">Higienização parada</option>
                    <option value="Manutenção parada">Manutenção parada</option>
                    <option value="Acessório não devolvido">Acessório não devolvido</option>
                    <option value="Reserva vencida">Reserva vencida</option>
                    <option value="Equipamento extraviado">Equipamento extraviado</option>
                    <option value="Documentos pendentes">Documentos pendentes</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={fetchAlertas}
                    className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-bold transition-all"
                  >
                    Aplicar filtros
                  </button>
                </div>
              </div>
              <button
                onClick={handleGerarAlertas}
                disabled={gerando}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md flex items-center gap-1.5 transition-all"
              >
                {gerando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                Gerar alertas
              </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              {alertasLoading ? (
                <div className="p-16 flex flex-col items-center justify-center text-slate-500 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                  <span className="text-sm font-medium">Carregando alertas...</span>
                </div>
              ) : alertas.length === 0 ? (
                <div className="p-16 text-center text-slate-400 text-sm">Nenhum alerta encontrado para os filtros selecionados.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/70 border-b border-slate-100 text-slate-450 uppercase text-[10px] font-bold tracking-wider">
                        <th className="px-6 py-4">Alerta</th>
                        <th className="px-6 py-4">Tipo</th>
                        <th className="px-6 py-4">Prioridade</th>
                        <th className="px-6 py-4">Prazo</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700 text-sm">
                      {alertas.map((alerta) => (
                        <tr key={alerta._id} className="hover:bg-slate-50/40 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-semibold text-slate-900">{alerta.txt_titulo}</div>
                            {alerta.txt_descricao && <div className="text-xs text-slate-450 max-w-md">{alerta.txt_descricao}</div>}
                          </td>
                          <td className="px-6 py-4 text-slate-600 text-xs">{alerta.os_tipo_alerta}</td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${prioridadeClasse(alerta.txt_prioridade)}`}>
                              {alerta.txt_prioridade || '-'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-500">{formatDate(alerta.date_prazo)}</td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusAlertaClasse(alerta.txt_status)}`}>
                              {alerta.txt_status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            {(alerta.txt_status === 'Aberto' || alerta.txt_status === 'Em tratamento') && (
                              <div className="inline-flex items-center gap-3">
                                <button
                                  onClick={() => handleResolverAlerta(alerta, 'Resolvido')}
                                  className="text-green-700 hover:text-green-900 inline-flex items-center gap-1 text-xs font-bold hover:underline"
                                >
                                  <CheckCircle className="w-3.5 h-3.5" />
                                  Resolver
                                </button>
                                <button
                                  onClick={() => handleResolverAlerta(alerta, 'Ignorado')}
                                  className="text-slate-500 hover:text-slate-700 inline-flex items-center gap-1 text-xs font-bold hover:underline"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  Ignorar
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= INVENTÁRIO ================= */}
        {activeTab === 'inventario' && (
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 flex flex-col md:flex-row md:items-end gap-3">
              <div className="flex flex-wrap gap-3 flex-1">
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Status</label>
                  <input
                    value={invStatus}
                    onChange={(e) => setInvStatus(e.target.value)}
                    placeholder="Ex.: Disponível"
                    className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Categoria</label>
                  <input
                    value={invCategoria}
                    onChange={(e) => setInvCategoria(e.target.value)}
                    placeholder="Categoria"
                    className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Fabricante</label>
                  <input
                    value={invFabricante}
                    onChange={(e) => setInvFabricante(e.target.value)}
                    placeholder="Fabricante"
                    className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={fetchInventario}
                    className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-bold transition-all"
                  >
                    Aplicar filtros
                  </button>
                </div>
              </div>
              <button
                onClick={handleExportarInventario}
                disabled={inventario.length === 0}
                className="bg-white hover:bg-slate-100 disabled:opacity-50 border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-all flex items-center gap-1.5"
              >
                <Download className="w-4 h-4" />
                Exportar CSV
              </button>
            </div>

            {/* Resumo por situação */}
            {Object.keys(inventarioPorStatus).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {Object.entries(inventarioPorStatus).map(([status, total]) => (
                  <span key={status} className="inline-flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-600 shadow-sm">
                    {status}
                    <span className="bg-indigo-100 text-indigo-700 rounded-full px-2 py-0.5">{total}</span>
                  </span>
                ))}
              </div>
            )}

            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              {inventarioLoading ? (
                <div className="p-16 flex flex-col items-center justify-center text-slate-500 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                  <span className="text-sm font-medium">Carregando inventário...</span>
                </div>
              ) : inventario.length === 0 ? (
                <div className="p-16 text-center text-slate-400 text-sm">Nenhum equipamento encontrado.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/70 border-b border-slate-100 text-slate-450 uppercase text-[10px] font-bold tracking-wider">
                        <th className="px-6 py-4">Equipamento</th>
                        <th className="px-6 py-4">Nº Série</th>
                        <th className="px-6 py-4">Patrimônio</th>
                        <th className="px-6 py-4">Categoria</th>
                        <th className="px-6 py-4">Fabricante</th>
                        <th className="px-6 py-4">Situação</th>
                        <th className="px-6 py-4">Últ. movimentação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700 text-sm">
                      {inventario.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/40 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-semibold text-slate-900">{item.nome}</div>
                            {item.codigoInterno && <div className="text-[10px] text-indigo-600 font-mono mt-1">{item.codigoInterno}</div>}
                          </td>
                          <td className="px-6 py-4 text-slate-500 font-mono text-xs">{item.numeroSerie || '-'}</td>
                          <td className="px-6 py-4 text-slate-500">{item.patrimonio || '-'}</td>
                          <td className="px-6 py-4 text-slate-500">{item.categoria || '-'}</td>
                          <td className="px-6 py-4 text-slate-500">{item.fabricante || '-'}</td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                              {item.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-500">{formatDate(item.ultimaMovimentacao)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= MOVIMENTAÇÕES ================= */}
        {activeTab === 'movimentacoes' && (
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 flex flex-wrap items-end gap-3">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Início</label>
                <input
                  type="date"
                  value={movInicio}
                  onChange={(e) => setMovInicio(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Fim</label>
                <input
                  type="date"
                  value={movFim}
                  onChange={(e) => setMovFim(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <button
                onClick={fetchMovimentacoes}
                className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-bold transition-all"
              >
                Aplicar período
              </button>
              <div className="flex gap-2 ml-auto">
                <span className="inline-flex items-center gap-1.5 bg-green-50 border border-green-200 text-green-700 rounded-lg px-3 py-1.5 text-xs font-bold">
                  Implantações <span className="bg-green-100 rounded-full px-2 py-0.5">{movContagens.implantacoes}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg px-3 py-1.5 text-xs font-bold">
                  Recolhimentos <span className="bg-blue-100 rounded-full px-2 py-0.5">{movContagens.recolhimentos}</span>
                </span>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              {movLoading ? (
                <div className="p-16 flex flex-col items-center justify-center text-slate-500 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                  <span className="text-sm font-medium">Carregando movimentações...</span>
                </div>
              ) : movimentacoes.length === 0 ? (
                <div className="p-16 text-center text-slate-400 text-sm">Nenhuma movimentação no período.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/70 border-b border-slate-100 text-slate-450 uppercase text-[10px] font-bold tracking-wider">
                        <th className="px-6 py-4">Tipo</th>
                        <th className="px-6 py-4">Data</th>
                        <th className="px-6 py-4">Equipamento (ID)</th>
                        <th className="px-6 py-4">Paciente (ID)</th>
                        <th className="px-6 py-4">Locação (ID)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700 text-sm">
                      {movimentacoes.map((evento, idx) => (
                        <tr key={`${evento.locacaoId}-${evento.tipo}-${idx}`} className="hover:bg-slate-50/40 transition-colors">
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                                evento.tipo === 'Implantação'
                                  ? 'bg-green-50 text-green-700 border-green-200'
                                  : 'bg-blue-50 text-blue-700 border-blue-200'
                              }`}
                            >
                              {evento.tipo}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-500">{formatDate(evento.data)}</td>
                          <td className="px-6 py-4 text-slate-500 font-mono text-xs">{evento.equipamentoId || '-'}</td>
                          <td className="px-6 py-4 text-slate-500 font-mono text-xs">{evento.pacienteId || '-'}</td>
                          <td className="px-6 py-4 text-slate-500 font-mono text-xs">{evento.locacaoId || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= MANUTENÇÕES ================= */}
        {activeTab === 'manutencoes' && (
          <div className="space-y-4">
            {manutTruncado && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl flex items-center gap-3 text-sm font-medium">
                <Info className="w-5 h-5 shrink-0" />
                O parque excede o limite de varredura (100 equipamentos). O ranking abaixo é parcial.
              </div>
            )}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              {manutLoading ? (
                <div className="p-16 flex flex-col items-center justify-center text-slate-500 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                  <span className="text-sm font-medium">Carregando manutenções...</span>
                </div>
              ) : manutencoes.length === 0 ? (
                <div className="p-16 text-center text-slate-400 text-sm">Nenhuma ordem de serviço de manutenção registrada.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/70 border-b border-slate-100 text-slate-450 uppercase text-[10px] font-bold tracking-wider">
                        <th className="px-6 py-4">#</th>
                        <th className="px-6 py-4">Equipamento</th>
                        <th className="px-6 py-4">Nº Série</th>
                        <th className="px-6 py-4">Nº OS</th>
                        <th className="px-6 py-4 text-right">Custo total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700 text-sm">
                      {manutencoes.map((linha, idx) => (
                        <tr key={linha.equipamentoId} className="hover:bg-slate-50/40 transition-colors">
                          <td className="px-6 py-4 text-slate-400 font-bold">{idx + 1}</td>
                          <td className="px-6 py-4 font-semibold text-slate-900">{linha.nome}</td>
                          <td className="px-6 py-4 text-slate-500 font-mono text-xs">{linha.numeroSerie || '-'}</td>
                          <td className="px-6 py-4 text-slate-600">{linha.numOrdens}</td>
                          <td className="px-6 py-4 text-right font-semibold text-slate-900">{formatCurrency(linha.custoTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
