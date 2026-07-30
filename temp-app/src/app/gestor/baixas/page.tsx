'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Archive,
  Plus,
  Search,
  X,
  Loader2,
  RefreshCw,
  Info,
  ShieldCheck,
  ShieldAlert,
  RotateCcw,
  FileText,
} from 'lucide-react';
import { Equipamento, BaixaEquipamento } from '@/lib/bubble';

const MOTIVOS_BAIXA = ['Sem reparo', 'Custo inviável', 'Obsolescência', 'Extravio', 'Outro'];

type FiltroStatus = 'Pendente de aprovação' | 'Aprovada' | 'Reprovada' | 'todas';

export default function GestorBaixas() {
  const [baixas, setBaixas] = useState<BaixaEquipamento[]>([]);
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [fluxoV2Ativo, setFluxoV2Ativo] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [filtro, setFiltro] = useState<FiltroStatus>('Pendente de aprovação');
  const [searchQuery, setSearchQuery] = useState('');

  // Solicitar baixa
  const [isSolicitarOpen, setIsSolicitarOpen] = useState(false);
  const [solEquipId, setSolEquipId] = useState('');
  const [solMotivo, setSolMotivo] = useState('');
  const [solLaudo, setSolLaudo] = useState('');
  const [solValorReparo, setSolValorReparo] = useState('');
  const [solValorResidual, setSolValorResidual] = useState('');
  const [solDestino, setSolDestino] = useState('');
  const [solSolicitante, setSolSolicitante] = useState('');
  const [solObservacoes, setSolObservacoes] = useState('');

  // Decisão (aprovar / reprovar)
  const [decisao, setDecisao] = useState<{ baixa: BaixaEquipamento; tipo: 'aprovar' | 'reprovar' } | null>(null);
  const [decisorNome, setDecisorNome] = useState('');
  const [decisaoObs, setDecisaoObs] = useState('');

  // Reversão excepcional
  const [reversao, setReversao] = useState<BaixaEquipamento | null>(null);
  const [revPrimeiro, setRevPrimeiro] = useState('');
  const [revSegundo, setRevSegundo] = useState('');
  const [revJustificativa, setRevJustificativa] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const [resBaixas, resEquip] = await Promise.all([
        axios.get('/api/gestor/equipamentos/baixas'),
        axios.get('/api/gestor/equipamentos'),
      ]);
      if (resBaixas.data.success) {
        setBaixas(resBaixas.data.data || []);
        setFluxoV2Ativo(Boolean(resBaixas.data.fluxoV2Ativo));
      }
      if (resEquip.data.success) setEquipamentos(resEquip.data.data || []);
    } catch (err) {
      console.error('Erro ao carregar baixas:', err);
      setErrorMsg('Falha ao obter as baixas do Bubble. Verifique se o servidor está rodando.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatCurrency = (val?: number) =>
    typeof val === 'number' ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val) : '—';

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
      const date = new Date(dateStr);
      date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
      return date.toLocaleDateString('pt-BR');
    } catch {
      return dateStr;
    }
  };

  const equipNome = (id: string) => equipamentos.find((e) => e._id === id);

  const kpis = React.useMemo(() => {
    const count = (s: string) => baixas.filter((b) => b.txt_status === s).length;
    return {
      pendentes: count('Pendente de aprovação'),
      aprovadas: baixas.filter((b) => b.txt_status === 'Aprovada' && !b.bool_revertida).length,
      reprovadas: count('Reprovada'),
      revertidas: baixas.filter((b) => b.bool_revertida).length,
    };
  }, [baixas]);

  const filteredBaixas = React.useMemo(() => {
    const term = searchQuery.toLowerCase();
    return baixas
      .filter((b) => (filtro === 'todas' ? true : b.txt_status === filtro))
      .filter((b) => {
        if (!term) return true;
        const equip = equipNome(b.fk_equipamento);
        return (
          (equip?.txt_nome || '').toLowerCase().includes(term) ||
          (equip?.txt_numero_serie || '').toLowerCase().includes(term) ||
          (b.os_motivo_baixa || '').toLowerCase().includes(term) ||
          (b.txt_solicitante || '').toLowerCase().includes(term)
        );
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baixas, filtro, searchQuery, equipamentos]);

  const statusBadge = (b: BaixaEquipamento) => {
    if (b.bool_revertida) return 'bg-slate-500/10 text-slate-600 border-slate-500/20';
    switch (b.txt_status) {
      case 'Pendente de aprovação':
        return 'bg-amber-500/10 text-amber-700 border-amber-500/20';
      case 'Aprovada':
        return 'bg-rose-500/10 text-rose-700 border-rose-500/20';
      case 'Reprovada':
        return 'bg-slate-500/10 text-slate-600 border-slate-500/20';
      default:
        return 'bg-slate-500/10 text-slate-600 border-slate-500/20';
    }
  };

  const resetSolicitar = () => {
    setSolEquipId('');
    setSolMotivo('');
    setSolLaudo('');
    setSolValorReparo('');
    setSolValorResidual('');
    setSolDestino('');
    setSolSolicitante('');
    setSolObservacoes('');
  };

  const handleSubmitSolicitar = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!solEquipId) return;
    setSubmitting(true);
    setErrorMsg('');
    try {
      await axios.post(`/api/gestor/equipamentos/${solEquipId}/baixas`, {
        os_motivo_baixa: solMotivo,
        txt_laudo: solLaudo || undefined,
        num_valor_reparo_estimado: solValorReparo ? Number(solValorReparo) : undefined,
        num_valor_residual: solValorResidual ? Number(solValorResidual) : undefined,
        txt_destino_final: solDestino || undefined,
        txt_solicitante: solSolicitante,
        txt_observacoes: solObservacoes || undefined,
      });
      setIsSolicitarOpen(false);
      resetSolicitar();
      fetchData();
    } catch (error) {
      const err = error as { response?: { data?: { error?: string } } };
      setErrorMsg(err.response?.data?.error || 'Erro ao solicitar a baixa.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitDecisao = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!decisao?.baixa._id) return;
    setSubmitting(true);
    setErrorMsg('');
    const { baixa, tipo } = decisao;
    try {
      await axios.post(`/api/gestor/equipamentos/${baixa.fk_equipamento}/baixas/${baixa._id}/${tipo}`, {
        txt_autorizado_por: decisorNome,
        txt_observacoes: decisaoObs || undefined,
      });
      setDecisao(null);
      setDecisorNome('');
      setDecisaoObs('');
      fetchData();
    } catch (error) {
      const err = error as { response?: { data?: { error?: string } } };
      setErrorMsg(err.response?.data?.error || `Erro ao ${tipo} a baixa.`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitReversao = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!reversao?._id) return;
    setSubmitting(true);
    setErrorMsg('');
    try {
      await axios.post(`/api/gestor/equipamentos/${reversao.fk_equipamento}/baixas/${reversao._id}/reverter`, {
        txt_revertida_por: revPrimeiro,
        txt_revertida_por_segundo: revSegundo,
        txt_justificativa_reversao: revJustificativa,
      });
      setReversao(null);
      setRevPrimeiro('');
      setRevSegundo('');
      setRevJustificativa('');
      fetchData();
    } catch (error) {
      const err = error as { response?: { data?: { error?: string } } };
      setErrorMsg(err.response?.data?.error || 'Erro ao reverter a baixa.');
    } finally {
      setSubmitting(false);
    }
  };

  const FILTROS: { id: FiltroStatus; label: string; count: number }[] = [
    { id: 'Pendente de aprovação', label: 'Pendentes', count: kpis.pendentes },
    { id: 'Aprovada', label: 'Aprovadas', count: kpis.aprovadas },
    { id: 'Reprovada', label: 'Reprovadas', count: kpis.reprovadas },
    { id: 'todas', label: 'Todas', count: baixas.length },
  ];

  return (
    <div className="text-slate-800 font-sans relative">
      {/* Header */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 relative">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Archive className="w-6 h-6 text-indigo-600 shrink-0" />
            Baixa de Ativos
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">
            Fila de aprovação, decisão auditável e reversão excepcional de baixas definitivas.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              resetSolicitar();
              setErrorMsg('');
              setIsSolicitarOpen(true);
            }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/25"
          >
            <Plus className="w-3.5 h-3.5" />
            Solicitar baixa
          </button>
          <button
            onClick={fetchData}
            className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 p-2 rounded-lg transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/25"
            title="Atualizar dados"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="max-w-7xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 relative">
        {[
          { label: 'Pendentes de aprovação', val: kpis.pendentes, detail: 'aguardando decisão' },
          { label: 'Baixadas (aprovadas)', val: kpis.aprovadas, detail: 'ativos fora de operação' },
          { label: 'Reprovadas', val: kpis.reprovadas, detail: 'retornaram ao ciclo' },
          { label: 'Revertidas', val: kpis.revertidas, detail: 'baixas canceladas' },
        ].map((item, idx) => (
          <div key={idx} className="bg-white border border-slate-200 p-4 rounded-xl flex flex-col justify-between shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{item.label}</span>
            <div className="mt-1">
              <span className="text-xl font-bold text-slate-900">{item.val}</span>
              <p className="text-[10px] text-slate-500 mt-0.5">{item.detail}</p>
            </div>
          </div>
        ))}
      </div>

      {!fluxoV2Ativo && !loading && (
        <div className="max-w-7xl mx-auto mb-6 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl flex items-center gap-3 shadow-sm relative">
          <Info className="w-5 h-5 text-amber-500 shrink-0" />
          <span className="text-sm font-medium">O fluxo de baixa V2 ainda não está habilitado. As ações podem retornar erro 503 até a ativação.</span>
        </div>
      )}

      {errorMsg && (
        <div className="max-w-7xl mx-auto mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-3 shadow-sm relative">
          <Info className="w-5 h-5 text-red-500 shrink-0" />
          <span className="text-sm font-medium">{errorMsg}</span>
        </div>
      )}

      {/* Filters + search */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-slate-200 pb-px relative">
        <div className="flex gap-6">
          {FILTROS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFiltro(f.id)}
              className={`pb-3 text-xs font-bold transition-all relative focus:outline-none flex items-center gap-1.5 ${
                filtro === f.id ? 'text-slate-950 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {f.label}
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${filtro === f.id ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>{f.count}</span>
            </button>
          ))}
        </div>
        <div className="relative pb-2 md:pb-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por equipamento, motivo ou solicitante..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100 rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none transition-all shadow-sm w-72"
          />
        </div>
      </div>

      {/* Table */}
      <div className="max-w-7xl mx-auto bg-white border border-slate-200 rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.02)] relative overflow-hidden">
        {loading ? (
          <div className="p-20 flex flex-col items-center justify-center text-slate-500 gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
            <span className="text-xs font-medium">Carregando baixas...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-200/80 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
                  <th className="px-6 py-3.5">Equipamento</th>
                  <th className="px-6 py-3.5">Motivo</th>
                  <th className="px-6 py-3.5">Solicitante</th>
                  <th className="px-6 py-3.5">Solicitada em</th>
                  <th className="px-6 py-3.5">Valor residual</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 text-xs">
                {filteredBaixas.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-16 text-slate-400">
                      <Archive className="w-8 h-8 mx-auto mb-3 text-slate-300" />
                      <p className="font-semibold text-slate-500">Nenhuma baixa {filtro !== 'todas' ? `em "${FILTROS.find((f) => f.id === filtro)?.label.toLowerCase()}"` : 'registrada'}.</p>
                      <p className="text-[11px] mt-1">Use “Solicitar baixa” para encaminhar um ativo condenado à aprovação.</p>
                    </td>
                  </tr>
                ) : (
                  filteredBaixas.map((b) => {
                    const equip = equipNome(b.fk_equipamento);
                    return (
                      <tr key={b._id} className="hover:bg-slate-50/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-slate-900">{equip?.txt_nome || 'Equipamento removido'}</div>
                          <div className="text-[10px] text-slate-400">S/N: {equip?.txt_numero_serie || '—'}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-slate-800">{b.os_motivo_baixa || '—'}</div>
                          {b.txt_laudo && <div className="text-[10px] text-slate-400 truncate max-w-[16rem]" title={b.txt_laudo}>{b.txt_laudo}</div>}
                        </td>
                        <td className="px-6 py-4 text-slate-600">{b.txt_solicitante || '—'}</td>
                        <td className="px-6 py-4 text-slate-500">{formatDate(b.date_baixa)}</td>
                        <td className="px-6 py-4 font-semibold text-slate-900">{formatCurrency(b.num_valor_residual)}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border ${statusBadge(b)}`}>
                            {b.bool_revertida ? 'Revertida' : b.txt_status}
                          </span>
                          {b.txt_autorizado_por && !b.bool_revertida && b.txt_status !== 'Pendente de aprovação' && (
                            <div className="text-[9px] text-slate-400 mt-0.5">por {b.txt_autorizado_por}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="inline-flex items-center gap-3">
                            {b.txt_status === 'Pendente de aprovação' && (
                              <>
                                <button
                                  onClick={() => { setDecisao({ baixa: b, tipo: 'aprovar' }); setDecisorNome(''); setDecisaoObs(''); setErrorMsg(''); }}
                                  className="text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1 font-bold hover:underline transition-colors"
                                >
                                  <ShieldCheck className="w-3.5 h-3.5" /> Aprovar
                                </button>
                                <button
                                  onClick={() => { setDecisao({ baixa: b, tipo: 'reprovar' }); setDecisorNome(''); setDecisaoObs(''); setErrorMsg(''); }}
                                  className="text-rose-600 hover:text-rose-800 inline-flex items-center gap-1 font-bold hover:underline transition-colors"
                                >
                                  <ShieldAlert className="w-3.5 h-3.5" /> Reprovar
                                </button>
                              </>
                            )}
                            {b.txt_status === 'Aprovada' && !b.bool_revertida && (
                              <button
                                onClick={() => { setReversao(b); setRevPrimeiro(''); setRevSegundo(''); setRevJustificativa(''); setErrorMsg(''); }}
                                className="text-amber-700 hover:text-amber-800 inline-flex items-center gap-1 font-bold hover:underline transition-colors"
                              >
                                <RotateCcw className="w-3.5 h-3.5" /> Reverter
                              </button>
                            )}
                            {(b.bool_revertida || b.txt_status === 'Reprovada') && <span className="text-slate-300">—</span>}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SOLICITAR BAIXA MODAL */}
      {isSolicitarOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-[2px] z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-lg border border-slate-200/80 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white">
              <div>
                <h2 className="text-base font-bold text-slate-900">Solicitar baixa definitiva</h2>
                <p className="text-[11px] text-slate-500 mt-0.5">A baixa entra como pendente e só sai de operação após aprovação.</p>
              </div>
              <button onClick={() => setIsSolicitarOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmitSolicitar} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Equipamento *</label>
                <select required value={solEquipId} onChange={(e) => setSolEquipId(e.target.value)} className="w-full bg-slate-50/50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all">
                  <option value="">Selecione o ativo...</option>
                  {equipamentos.filter((e) => e.txt_status !== 'Baixado').map((e) => (
                    <option key={e._id} value={e._id}>{e.txt_nome} — S/N: {e.txt_numero_serie} ({e.txt_status})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Motivo *</label>
                  <select required value={solMotivo} onChange={(e) => setSolMotivo(e.target.value)} className="w-full bg-slate-50/50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all">
                    <option value="">Selecione...</option>
                    {MOTIVOS_BAIXA.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Solicitante *</label>
                  <input required value={solSolicitante} onChange={(e) => setSolSolicitante(e.target.value)} placeholder="Responsável pela solicitação" className="w-full bg-slate-50/50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Laudo técnico</label>
                <textarea value={solLaudo} onChange={(e) => setSolLaudo(e.target.value)} placeholder="Descreva o parecer técnico que embasa a baixa..." className="w-full bg-slate-50/50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all h-20 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Reparo estimado</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-semibold">R$</span>
                    <input type="number" step="0.01" value={solValorReparo} onChange={(e) => setSolValorReparo(e.target.value)} placeholder="0,00" className="w-full bg-slate-50/50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Valor residual</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-semibold">R$</span>
                    <input type="number" step="0.01" value={solValorResidual} onChange={(e) => setSolValorResidual(e.target.value)} placeholder="0,00" className="w-full bg-slate-50/50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all" />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Destino final</label>
                <input value={solDestino} onChange={(e) => setSolDestino(e.target.value)} placeholder="Ex.: descarte, doação, sucata, devolução ao fornecedor..." className="w-full bg-slate-50/50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all" />
              </div>
              <p className="text-[11px] text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg p-3 flex gap-2">
                <FileText className="w-4 h-4 shrink-0 mt-px" />
                A baixa registra a solicitação sem alterar o ativo. Ele só sai de operação quando um autorizador aprovar nesta tela.
              </p>
              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button type="button" onClick={() => setIsSolicitarOpen(false)} className="border border-slate-200 hover:bg-slate-50 px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 transition-all">Cancelar</button>
                <button type="submit" disabled={submitting} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/25">
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />} Enviar para aprovação
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DECISÃO MODAL (aprovar / reprovar) */}
      {decisao && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-[2px] z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-lg border border-slate-200/80 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">{decisao.tipo === 'aprovar' ? 'Aprovar baixa' : 'Reprovar baixa'}</h2>
                <p className="text-[11px] text-slate-500 mt-0.5">{equipNome(decisao.baixa.fk_equipamento)?.txt_nome || 'Equipamento'} • {decisao.baixa.os_motivo_baixa}</p>
              </div>
              <button onClick={() => setDecisao(null)} className="text-slate-400 hover:text-slate-600 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmitDecisao} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Autorizador *</label>
                <input required value={decisorNome} onChange={(e) => setDecisorNome(e.target.value)} placeholder="Quem está autorizando esta decisão" className="w-full bg-slate-50/50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Observações {decisao.tipo === 'reprovar' ? '' : '(opcional)'}</label>
                <textarea value={decisaoObs} onChange={(e) => setDecisaoObs(e.target.value)} placeholder={decisao.tipo === 'aprovar' ? 'Notas da aprovação...' : 'Justifique a reprovação...'} className="w-full bg-slate-50/50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all h-20 resize-none" />
              </div>
              {decisao.tipo === 'aprovar' ? (
                <p className="text-[11px] text-rose-700 bg-rose-50 border border-rose-100 rounded-lg p-3">Aprovar move o ativo para <span className="font-bold">Baixado</span> e o retira definitivamente de operação. A reversão exige dupla autorização.</p>
              ) : (
                <p className="text-[11px] text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3">Reprovar encerra a solicitação e mantém o ativo no ciclo atual, sem alterar sua situação.</p>
              )}
              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button type="button" onClick={() => setDecisao(null)} className="border border-slate-200 hover:bg-slate-50 px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 transition-all">Voltar</button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`text-white px-5 py-2 rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all focus:outline-none focus:ring-2 ${
                    decisao.tipo === 'aprovar' ? 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500/25' : 'bg-rose-600 hover:bg-rose-700 focus:ring-rose-500/25'
                  }`}
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {decisao.tipo === 'aprovar' ? 'Confirmar aprovação' : 'Confirmar reprovação'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REVERSÃO MODAL */}
      {reversao && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-[2px] z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-lg border border-slate-200/80 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Reverter baixa</h2>
                <p className="text-[11px] text-slate-500 mt-0.5">{equipNome(reversao.fk_equipamento)?.txt_nome || 'Equipamento'} • baixa aprovada</p>
              </div>
              <button onClick={() => setReversao(null)} className="text-slate-400 hover:text-slate-600 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmitReversao} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Autorizador 1 *</label>
                  <input required value={revPrimeiro} onChange={(e) => setRevPrimeiro(e.target.value)} placeholder="Primeiro autorizador" className="w-full bg-slate-50/50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Autorizador 2 *</label>
                  <input required value={revSegundo} onChange={(e) => setRevSegundo(e.target.value)} placeholder="Segundo autorizador" className="w-full bg-slate-50/50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Justificativa reforçada *</label>
                <textarea required value={revJustificativa} onChange={(e) => setRevJustificativa(e.target.value)} placeholder="Explique por que a baixa aprovada precisa ser revertida..." className="w-full bg-slate-50/50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all h-24 resize-none" />
              </div>
              <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
                Operação excepcional: exige <span className="font-bold">dois autorizadores distintos</span>. O ativo retorna para <span className="font-bold">Aguardando conferência</span> e a reversão fica registrada na auditoria.
              </p>
              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button type="button" onClick={() => setReversao(null)} className="border border-slate-200 hover:bg-slate-50 px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 transition-all">Voltar</button>
                <button type="submit" disabled={submitting} className="bg-amber-600 hover:bg-amber-700 text-white px-5 py-2 rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all focus:outline-none focus:ring-2 focus:ring-amber-500/25">
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />} Confirmar reversão
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
