'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Link from 'next/link';
import {
  Activity,
  Plus,
  Search,
  Loader2,
  RefreshCw,
  Info,
  Wrench,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Trash2,
  AlertTriangle,
  Paperclip,
} from 'lucide-react';
import { Equipamento, OrdemServicoManutencao, ItemManutencao } from '@/lib/bubble';

type TipoItem = ItemManutencao['txt_tipo'];
const TIPOS_ITEM: TipoItem[] = ['Peça', 'Mão de obra', 'Frete', 'Outro'];

export default function GestorManutencao() {
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [loadingEquip, setLoadingEquip] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [fluxoV2Ativo, setFluxoV2Ativo] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [manualId, setManualId] = useState('');

  const [selectedEquip, setSelectedEquip] = useState<Equipamento | null>(null);
  const [selectedEquipId, setSelectedEquipId] = useState('');
  const [ordens, setOrdens] = useState<OrdemServicoManutencao[]>([]);
  const [loadingOrdens, setLoadingOrdens] = useState(false);

  // Expanded OS + its items
  const [expandedOsId, setExpandedOsId] = useState<string | null>(null);
  const [itens, setItens] = useState<ItemManutencao[]>([]);
  const [loadingItens, setLoadingItens] = useState(false);

  // New item form
  const [itemTipo, setItemTipo] = useState<TipoItem>('Peça');
  const [itemDescricao, setItemDescricao] = useState('');
  const [itemQuantidade, setItemQuantidade] = useState('1');
  const [itemCustoUnitario, setItemCustoUnitario] = useState('');
  const [itemFornecedor, setItemFornecedor] = useState('');
  const [submittingItem, setSubmittingItem] = useState(false);

  // Recomendar baixa
  const [baixaOsId, setBaixaOsId] = useState<string | null>(null);
  const [baixaJustificativa, setBaixaJustificativa] = useState('');
  const [baixaObservacoes, setBaixaObservacoes] = useState('');
  const [submittingBaixa, setSubmittingBaixa] = useState(false);

  // Evidência (registrada como observação/URL por ora)
  const [evidenciaOsId, setEvidenciaOsId] = useState<string | null>(null);
  const [evidenciaUrl, setEvidenciaUrl] = useState('');
  const [submittingEvidencia, setSubmittingEvidencia] = useState(false);

  const formatCurrency = (val?: number) =>
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

  const getErro = (error: unknown, fallback: string) => {
    const e = error as { response?: { data?: { error?: string } } };
    return e.response?.data?.error || fallback;
  };

  const fetchEquipamentos = async () => {
    setLoadingEquip(true);
    setErrorMsg('');
    try {
      const res = await axios.get('/api/gestor/equipamentos');
      if (res.data.success) {
        setEquipamentos(res.data.data || []);
        setFluxoV2Ativo(Boolean(res.data.fluxoV2Ativo));
      }
    } catch (err) {
      setErrorMsg(getErro(err, 'Falha ao carregar equipamentos do Bubble.'));
    } finally {
      setLoadingEquip(false);
    }
  };

  useEffect(() => {
    fetchEquipamentos();
  }, []);

  const fetchOrdens = async (equipId: string) => {
    if (!equipId) return;
    setLoadingOrdens(true);
    setErrorMsg('');
    setExpandedOsId(null);
    setItens([]);
    try {
      const res = await axios.get(`/api/gestor/equipamentos/${equipId}/manutencoes`);
      if (res.data.success) {
        setOrdens(res.data.data || []);
      } else {
        setErrorMsg(res.data.error || 'Não foi possível carregar as ordens de serviço.');
      }
    } catch (err) {
      setErrorMsg(getErro(err, 'Não foi possível carregar as ordens de serviço.'));
      setOrdens([]);
    } finally {
      setLoadingOrdens(false);
    }
  };

  const selecionarEquipamento = (equip: Equipamento) => {
    if (!equip._id) return;
    setSelectedEquip(equip);
    setSelectedEquipId(equip._id);
    setOrdens([]);
    fetchOrdens(equip._id);
  };

  const carregarPorId = () => {
    const id = manualId.trim();
    if (!id) return;
    const equip = equipamentos.find((e) => e._id === id) || null;
    setSelectedEquip(equip);
    setSelectedEquipId(id);
    setOrdens([]);
    fetchOrdens(id);
  };

  const fetchItens = async (osId: string) => {
    if (!selectedEquipId) return;
    setLoadingItens(true);
    try {
      const res = await axios.get(`/api/gestor/equipamentos/${selectedEquipId}/manutencoes/${osId}/itens`);
      if (res.data.success) setItens(res.data.data || []);
    } catch (err) {
      setErrorMsg(getErro(err, 'Não foi possível carregar os itens da OS.'));
    } finally {
      setLoadingItens(false);
    }
  };

  const toggleExpand = (osId?: string) => {
    if (!osId) return;
    if (expandedOsId === osId) {
      setExpandedOsId(null);
      setItens([]);
      return;
    }
    setExpandedOsId(osId);
    setItens([]);
    resetItemForm();
    setBaixaOsId(null);
    setEvidenciaOsId(null);
    fetchItens(osId);
  };

  const resetItemForm = () => {
    setItemTipo('Peça');
    setItemDescricao('');
    setItemQuantidade('1');
    setItemCustoUnitario('');
    setItemFornecedor('');
  };

  const handleAddItem = async (osId: string, event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedEquipId) return;
    setSubmittingItem(true);
    setErrorMsg('');
    try {
      await axios.post(`/api/gestor/equipamentos/${selectedEquipId}/manutencoes/${osId}/itens`, {
        txt_tipo: itemTipo,
        txt_descricao: itemDescricao,
        num_quantidade: itemQuantidade ? Number(itemQuantidade) : undefined,
        num_custo_unitario: itemCustoUnitario ? Number(itemCustoUnitario) : undefined,
        txt_fornecedor: itemFornecedor || undefined,
      });
      resetItemForm();
      await fetchItens(osId);
      await fetchOrdens(selectedEquipId);
      setExpandedOsId(osId);
    } catch (err) {
      setErrorMsg(getErro(err, 'Erro ao adicionar o item.'));
    } finally {
      setSubmittingItem(false);
    }
  };

  const handleDeleteItem = async (osId: string, itemId?: string) => {
    if (!selectedEquipId || !itemId) return;
    setErrorMsg('');
    try {
      await axios.delete(`/api/gestor/equipamentos/${selectedEquipId}/manutencoes/${osId}/itens`, {
        params: { itemId },
      });
      await fetchItens(osId);
      await fetchOrdens(selectedEquipId);
      setExpandedOsId(osId);
    } catch (err) {
      setErrorMsg(getErro(err, 'Erro ao remover o item.'));
    }
  };

  const handleRecomendarBaixa = async (osId: string, event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedEquipId) return;
    setSubmittingBaixa(true);
    setErrorMsg('');
    try {
      await axios.post(`/api/gestor/equipamentos/${selectedEquipId}/manutencoes/${osId}/recomendar-baixa`, {
        txt_justificativa: baixaJustificativa,
        txt_observacoes: baixaObservacoes || undefined,
      });
      setBaixaOsId(null);
      setBaixaJustificativa('');
      setBaixaObservacoes('');
      await fetchOrdens(selectedEquipId);
    } catch (err) {
      setErrorMsg(getErro(err, 'Erro ao recomendar a baixa.'));
    } finally {
      setSubmittingBaixa(false);
    }
  };

  // Evidência: por ora registrada como observação/URL na própria OS (PATCH).
  const handleAnexarEvidencia = async (os: OrdemServicoManutencao, event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedEquipId || !os._id) return;
    setSubmittingEvidencia(true);
    setErrorMsg('');
    try {
      const carimbo = `[Evidência ${new Date().toLocaleString('pt-BR')}] ${evidenciaUrl}`;
      const observacoes = os.txt_observacoes ? `${os.txt_observacoes}\n${carimbo}` : carimbo;
      await axios.patch(`/api/gestor/equipamentos/${selectedEquipId}/manutencoes/${os._id}`, {
        txt_observacoes: observacoes,
        txt_status: os.txt_status,
      });
      setEvidenciaOsId(null);
      setEvidenciaUrl('');
      await fetchOrdens(selectedEquipId);
    } catch (err) {
      setErrorMsg(getErro(err, 'Erro ao registrar a evidência.'));
    } finally {
      setSubmittingEvidencia(false);
    }
  };

  const filteredEquipamentos = equipamentos.filter((e) => {
    const term = searchQuery.toLowerCase();
    if (!term) return true;
    return (
      e.txt_nome.toLowerCase().includes(term) ||
      (e.txt_numero_serie || '').toLowerCase().includes(term) ||
      (e.txt_codigo_interno || '').toLowerCase().includes(term) ||
      (e.txt_marca || '').toLowerCase().includes(term)
    );
  });

  const statusBadge = (status?: string) => {
    const s = status || '';
    let cls = 'bg-slate-100 text-slate-600 border-slate-200';
    if (['Aberta', 'Em diagnóstico'].includes(s)) cls = 'bg-blue-50 text-blue-700 border-blue-200';
    else if (['Aguardando peça'].includes(s)) cls = 'bg-amber-50 text-amber-700 border-amber-200';
    else if (['Liberada'].includes(s)) cls = 'bg-green-50 text-green-700 border-green-200';
    else if (['Baixa recomendada', 'Cancelada'].includes(s)) cls = 'bg-red-50 text-red-700 border-red-200';
    return `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cls}`;
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6 md:p-10 font-sans relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-100 rounded-full blur-[120px] pointer-events-none opacity-60" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-100 rounded-full blur-[120px] pointer-events-none opacity-60" />

      {/* Header */}
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 z-10 relative">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 mb-1 hover:text-indigo-800 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <Link href="/gestor/equipamentos" className="text-xs font-bold uppercase tracking-wider">
              Gestão de Equipamentos
            </Link>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Wrench className="w-8 h-8 text-indigo-600" />
            Ordens de Serviço (Manutenção)
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Selecione um equipamento para gerenciar suas ordens de serviço, itens e custos.
          </p>
        </div>
        <button
          onClick={() => {
            fetchEquipamentos();
            if (selectedEquipId) fetchOrdens(selectedEquipId);
          }}
          className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 p-2 rounded-lg transition-all shadow-sm w-fit"
          title="Atualizar dados"
        >
          <RefreshCw className={`w-4 h-4 ${loadingEquip || loadingOrdens ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {!fluxoV2Ativo && !loadingEquip && (
        <div className="max-w-6xl mx-auto mb-6 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl flex items-center gap-3 shadow-sm z-10 relative">
          <Info className="w-5 h-5 text-amber-500 shrink-0" />
          <span className="text-sm font-medium">
            O fluxo de manutenção V2 ainda não está habilitado. As ações abaixo podem retornar erro 503 até a ativação.
          </span>
        </div>
      )}

      {errorMsg && (
        <div className="max-w-6xl mx-auto mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-3 shadow-sm z-10 relative">
          <Info className="w-5 h-5 text-red-500 shrink-0" />
          <span className="text-sm font-medium">{errorMsg}</span>
        </div>
      )}

      {/* Equipment selection */}
      <div className="max-w-6xl mx-auto bg-white border border-slate-200 rounded-2xl shadow-sm z-10 relative p-5 mb-6">
        <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar equipamento por nome, série, código..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none transition-all shadow-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Informar ID do equipamento"
              value={manualId}
              onChange={(e) => setManualId(e.target.value)}
              className="bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none transition-all shadow-sm w-56"
            />
            <button
              onClick={carregarPorId}
              className="bg-slate-800 hover:bg-slate-900 text-white px-3 py-2 rounded-xl text-sm font-bold shadow-sm transition-all"
            >
              Carregar
            </button>
          </div>
        </div>

        {loadingEquip ? (
          <div className="py-8 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2 max-h-40 overflow-y-auto">
            {filteredEquipamentos.length === 0 ? (
              <span className="text-sm text-slate-400 italic">Nenhum equipamento encontrado.</span>
            ) : (
              filteredEquipamentos.slice(0, 40).map((e) => (
                <button
                  key={e._id}
                  onClick={() => selecionarEquipamento(e)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                    selectedEquipId === e._id
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                  title={e.txt_numero_serie}
                >
                  {e.txt_nome}
                  <span className="ml-1.5 opacity-60 font-mono">{e.txt_codigo_interno || e.txt_numero_serie}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Ordens de serviço */}
      <div className="max-w-6xl mx-auto z-10 relative">
        {!selectedEquipId ? (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-16 text-center text-slate-400">
            <Activity className="w-8 h-8 mx-auto mb-3 text-slate-300" />
            <p className="text-sm font-medium">Selecione um equipamento acima para visualizar suas ordens de serviço.</p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-slate-900">
                  {selectedEquip ? selectedEquip.txt_nome : `Equipamento ${selectedEquipId}`}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedEquip?.txt_codigo_interno || selectedEquip?.txt_numero_serie || selectedEquipId}
                  {selectedEquip?.txt_status ? ` • Situação atual: ${selectedEquip.txt_status}` : ''}
                </p>
              </div>
              <span className="text-xs font-bold text-slate-500">
                {ordens.length} OS{ordens.length === 1 ? '' : 's'}
              </span>
            </div>

            {loadingOrdens ? (
              <div className="py-16 flex justify-center">
                <Loader2 className="w-7 h-7 animate-spin text-indigo-600" />
              </div>
            ) : ordens.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-sm">
                Nenhuma ordem de serviço para este equipamento.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {ordens.map((os) => {
                  const expandido = expandedOsId === os._id;
                  return (
                    <div key={os._id}>
                      <button
                        onClick={() => toggleExpand(os._id)}
                        className="w-full px-6 py-4 flex items-start gap-3 text-left hover:bg-slate-50/60 transition-colors"
                      >
                        <span className="mt-0.5 text-slate-400">
                          {expandido ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </span>
                        <div className="flex-1 grid grid-cols-2 md:grid-cols-5 gap-3">
                          <div>
                            <div className="text-[10px] uppercase font-bold text-slate-400">Nº OS</div>
                            <div className="font-mono text-sm font-semibold text-slate-800">{os.txt_numero_os}</div>
                            <div className="text-[11px] text-slate-400 mt-0.5">{formatDate(os.date_entrada)}</div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase font-bold text-slate-400">Situação</div>
                            <span className={statusBadge(os.txt_status)}>{os.txt_status}</span>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase font-bold text-slate-400">Motivo</div>
                            <div className="text-sm text-slate-700 truncate" title={os.txt_motivo}>{os.txt_motivo || '-'}</div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase font-bold text-slate-400">Resultado / Diagnóstico</div>
                            <div className="text-sm text-slate-700 truncate" title={os.txt_resultado || os.txt_defeito_encontrado}>
                              {os.txt_resultado || os.txt_defeito_encontrado || '-'}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase font-bold text-slate-400">Custo total</div>
                            <div className="text-sm font-black text-slate-900">{formatCurrency(os.num_custo_total)}</div>
                          </div>
                        </div>
                      </button>

                      {expandido && os._id && (
                        <div className="px-6 pb-6 pt-1 bg-slate-50/40">
                          {/* Diagnóstico details */}
                          {(os.txt_defeito_relatado || os.txt_defeito_encontrado || os.txt_causa_provavel || os.txt_observacoes) && (
                            <div className="mb-4 grid md:grid-cols-2 gap-x-6 gap-y-1 text-sm bg-white border border-slate-200 rounded-xl p-4">
                              {os.txt_defeito_relatado && (
                                <p><span className="text-slate-400 font-bold text-xs uppercase">Defeito relatado: </span>{os.txt_defeito_relatado}</p>
                              )}
                              {os.txt_defeito_encontrado && (
                                <p><span className="text-slate-400 font-bold text-xs uppercase">Defeito encontrado: </span>{os.txt_defeito_encontrado}</p>
                              )}
                              {os.txt_causa_provavel && (
                                <p><span className="text-slate-400 font-bold text-xs uppercase">Causa provável: </span>{os.txt_causa_provavel}</p>
                              )}
                              {os.txt_observacoes && (
                                <p className="md:col-span-2 whitespace-pre-line"><span className="text-slate-400 font-bold text-xs uppercase">Observações: </span>{os.txt_observacoes}</p>
                              )}
                            </div>
                          )}

                          {/* Items */}
                          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-4">
                            <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                              <span className="text-xs font-black uppercase text-slate-500 tracking-wider">Itens da OS</span>
                              <span className="text-xs font-bold text-slate-900">{formatCurrency(os.num_custo_total)}</span>
                            </div>
                            {loadingItens ? (
                              <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-indigo-600" /></div>
                            ) : itens.length === 0 ? (
                              <div className="py-6 text-center text-xs text-slate-400">Nenhum item lançado.</div>
                            ) : (
                              <table className="w-full text-left text-sm">
                                <thead>
                                  <tr className="bg-slate-50/70 text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                                    <th className="px-4 py-2">Tipo</th>
                                    <th className="px-4 py-2">Descrição</th>
                                    <th className="px-4 py-2 text-right">Qtd</th>
                                    <th className="px-4 py-2 text-right">Custo unit.</th>
                                    <th className="px-4 py-2 text-right">Total</th>
                                    <th className="px-4 py-2">Fornecedor</th>
                                    <th className="px-4 py-2 text-right"></th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-slate-700">
                                  {itens.map((item) => (
                                    <tr key={item._id} className="hover:bg-slate-50/50">
                                      <td className="px-4 py-2">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                          {item.txt_tipo}
                                        </span>
                                      </td>
                                      <td className="px-4 py-2">{item.txt_descricao}</td>
                                      <td className="px-4 py-2 text-right">{item.num_quantidade ?? '-'}</td>
                                      <td className="px-4 py-2 text-right">{formatCurrency(item.num_custo_unitario)}</td>
                                      <td className="px-4 py-2 text-right font-semibold text-slate-900">{formatCurrency(item.num_custo_total)}</td>
                                      <td className="px-4 py-2 text-slate-500">{item.txt_fornecedor || '-'}</td>
                                      <td className="px-4 py-2 text-right">
                                        <button
                                          onClick={() => handleDeleteItem(os._id!, item._id)}
                                          className="text-red-500 hover:text-red-700 transition-colors"
                                          title="Remover item"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}

                            {/* Add item form */}
                            <form onSubmit={(e) => handleAddItem(os._id!, e)} className="p-4 border-t border-slate-100 grid grid-cols-2 md:grid-cols-6 gap-2 items-end bg-slate-50/40">
                              <div>
                                <label className="text-[10px] uppercase font-bold text-slate-400">Tipo</label>
                                <select
                                  value={itemTipo}
                                  onChange={(e) => setItemTipo(e.target.value as TipoItem)}
                                  className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-500"
                                >
                                  {TIPOS_ITEM.map((t) => <option key={t} value={t}>{t}</option>)}
                                </select>
                              </div>
                              <div className="col-span-2">
                                <label className="text-[10px] uppercase font-bold text-slate-400">Descrição</label>
                                <input
                                  type="text"
                                  value={itemDescricao}
                                  onChange={(e) => setItemDescricao(e.target.value)}
                                  required
                                  className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-500"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] uppercase font-bold text-slate-400">Qtd</label>
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={itemQuantidade}
                                  onChange={(e) => setItemQuantidade(e.target.value)}
                                  className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-500"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] uppercase font-bold text-slate-400">Custo unit.</label>
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={itemCustoUnitario}
                                  onChange={(e) => setItemCustoUnitario(e.target.value)}
                                  className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-500"
                                />
                              </div>
                              <div className="flex flex-col">
                                <label className="text-[10px] uppercase font-bold text-slate-400">Fornecedor</label>
                                <input
                                  type="text"
                                  value={itemFornecedor}
                                  onChange={(e) => setItemFornecedor(e.target.value)}
                                  className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-500"
                                />
                              </div>
                              <div className="col-span-2 md:col-span-6">
                                <button
                                  type="submit"
                                  disabled={submittingItem}
                                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all"
                                >
                                  {submittingItem ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                                  Adicionar item
                                </button>
                              </div>
                            </form>
                          </div>

                          {/* Actions */}
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => {
                                setBaixaOsId(baixaOsId === os._id ? null : os._id!);
                                setEvidenciaOsId(null);
                              }}
                              className="inline-flex items-center gap-1.5 bg-white border border-red-200 text-red-700 hover:bg-red-50 px-3 py-2 rounded-lg text-xs font-bold transition-all"
                            >
                              <AlertTriangle className="w-3.5 h-3.5" />
                              Recomendar baixa
                            </button>
                            <button
                              onClick={() => {
                                setEvidenciaOsId(evidenciaOsId === os._id ? null : os._id!);
                                setBaixaOsId(null);
                              }}
                              className="inline-flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-3 py-2 rounded-lg text-xs font-bold transition-all"
                            >
                              <Paperclip className="w-3.5 h-3.5" />
                              Anexar evidência
                            </button>
                          </div>

                          {/* Recomendar baixa form */}
                          {baixaOsId === os._id && (
                            <form onSubmit={(e) => handleRecomendarBaixa(os._id!, e)} className="mt-3 bg-red-50 border border-red-200 rounded-xl p-4">
                              <p className="text-xs text-red-700 font-medium mb-2">
                                A baixa formal é aprovada em outra tela. Aqui a OS é marcada como &quot;Baixa recomendada&quot; e o equipamento é bloqueado.
                              </p>
                              <label className="text-[10px] uppercase font-bold text-red-500">Justificativa (obrigatória)</label>
                              <textarea
                                value={baixaJustificativa}
                                onChange={(e) => setBaixaJustificativa(e.target.value)}
                                required
                                rows={2}
                                className="w-full bg-white border border-red-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-red-400 mb-2"
                              />
                              <label className="text-[10px] uppercase font-bold text-red-500">Observações (opcional)</label>
                              <textarea
                                value={baixaObservacoes}
                                onChange={(e) => setBaixaObservacoes(e.target.value)}
                                rows={2}
                                className="w-full bg-white border border-red-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-red-400 mb-2"
                              />
                              <div className="flex gap-2">
                                <button
                                  type="submit"
                                  disabled={submittingBaixa}
                                  className="bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all"
                                >
                                  {submittingBaixa ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                                  Confirmar recomendação
                                </button>
                                <button type="button" onClick={() => setBaixaOsId(null)} className="text-slate-500 hover:text-slate-700 text-xs font-bold px-2">
                                  Cancelar
                                </button>
                              </div>
                            </form>
                          )}

                          {/* Evidência form */}
                          {evidenciaOsId === os._id && (
                            <form onSubmit={(e) => handleAnexarEvidencia(os, e)} className="mt-3 bg-white border border-slate-200 rounded-xl p-4">
                              <p className="text-xs text-slate-500 mb-2 flex items-center gap-1.5">
                                <Info className="w-3.5 h-3.5" />
                                Por ora, evidências são registradas como observação/URL na OS. O upload de arquivos depende de outro fluxo.
                              </p>
                              <label className="text-[10px] uppercase font-bold text-slate-400">URL ou descrição da evidência</label>
                              <input
                                type="text"
                                value={evidenciaUrl}
                                onChange={(e) => setEvidenciaUrl(e.target.value)}
                                required
                                placeholder="https://... ou descrição da evidência"
                                className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-500 mb-2"
                              />
                              <div className="flex gap-2">
                                <button
                                  type="submit"
                                  disabled={submittingEvidencia}
                                  className="bg-slate-800 hover:bg-slate-900 disabled:opacity-60 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all"
                                >
                                  {submittingEvidencia ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />}
                                  Registrar evidência
                                </button>
                                <button type="button" onClick={() => setEvidenciaOsId(null)} className="text-slate-500 hover:text-slate-700 text-xs font-bold px-2">
                                  Cancelar
                                </button>
                              </div>
                            </form>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
