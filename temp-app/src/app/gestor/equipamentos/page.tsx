'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Link from 'next/link';
import {
  Activity,
  Plus,
  Search,
  CheckCircle,
  X,
  Loader2,
  RefreshCw,
  Info,
  DollarSign,
  FileText,
  Wrench,
  Edit3,
  ArrowLeft,
} from 'lucide-react';
import { Equipamento, Paciente, LocacaoEquipamento } from '@/lib/bubble';

export default function GestorEquipamentos() {
  // Data States
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [locacoes, setLocacoes] = useState<LocacaoEquipamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Active Tab
  const [activeTab, setActiveTab] = useState<'locacoes' | 'equipamentos' | 'pacientes'>('locacoes');

  // Search Queries
  const [searchQuery, setSearchQuery] = useState('');

  // Form Submitting Feedback
  const [submitting, setSubmitting] = useState(false);

  // Modals Open State
  const [isEquipModalOpen, setIsEquipModalOpen] = useState(false);
  const [isPatientModalOpen, setIsPatientModalOpen] = useState(false);
  const [isRentalModalOpen, setIsRentalModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);

  // Editing items
  const [editingEquipamento, setEditingEquipamento] = useState<Equipamento | null>(null);

  // Return Rental Target
  const [selectedRentalForReturn, setSelectedRentalForReturn] = useState<LocacaoEquipamento | null>(null);
  const [returnEquipStatus, setReturnEquipStatus] = useState<'Disponível' | 'Manutenção'>('Disponível');

  // Equipment Form State
  const [equipNome, setEquipNome] = useState('');
  const [equipDescricao, setEquipDescricao] = useState('');
  const [equipMarca, setEquipMarca] = useState('');
  const [equipModelo, setEquipModelo] = useState('');
  const [equipSerie, setEquipSerie] = useState('');
  const [equipPreco, setEquipPreco] = useState('');
  const [equipStatus, setEquipStatus] = useState<'Disponível' | 'Alugado' | 'Manutenção' | 'Inativo'>('Disponível');

  // Patient Form State
  const [patNome, setPatNome] = useState('');
  const [patCPF, setPatCPF] = useState('');
  const [patWhatsapp, setPatWhatsapp] = useState('');
  const [patEndereco, setPatEndereco] = useState('');
  const [patEmail, setPatEmail] = useState('');
  const [patTipo, setPatTipo] = useState<'Homecare' | 'Hospital'>('Homecare');
  const [patientFilter, setPatientFilter] = useState<string>('todos');

  // Rental Form State
  const [rentEquipId, setRentEquipId] = useState('');
  const [rentPatId, setRentPatId] = useState('');
  const [rentValor, setRentValor] = useState('');
  const [rentDataInicio, setRentDataInicio] = useState(new Date().toISOString().split('T')[0]);
  const [rentDataFimPrevisto, setRentDataFimPrevisto] = useState('');
  const [rentObservacoes, setRentObservacoes] = useState('');

  // Fetch all data
  const fetchData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const [resEquip, resPat, resRent] = await Promise.all([
        axios.get('/api/gestor/equipamentos'),
        axios.get('/api/gestor/pacientes'),
        axios.get('/api/gestor/locacoes'),
      ]);

      if (resEquip.data.success) setEquipamentos(resEquip.data.data || []);
      if (resPat.data.success) setPacientes(resPat.data.data || []);
      if (resRent.data.success) setLocacoes(resRent.data.data || []);
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
      setErrorMsg('Falha ao obter dados do Bubble. Certifique-se de que o servidor está rodando e as tabelas estão criadas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Helper formatting BRL
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  // Helper formatting Dates
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      // Adjust offset for correct local display
      date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
      return date.toLocaleDateString('pt-BR');
    } catch {
      return dateStr;
    }
  };

  // Metrics Calculations
  const totalEquips = equipamentos.length;
  const availableEquips = equipamentos.filter((e) => e.txt_status === 'Disponível').length;
  const rentedEquips = equipamentos.filter((e) => e.txt_status === 'Alugado').length;
  const maintenanceEquips = equipamentos.filter((e) => e.txt_status === 'Manutenção').length;
  const activeRentals = locacoes.filter((l) => l.txt_status === 'Ativo');
  const estimatedRevenue = activeRentals.reduce((sum, r) => sum + r.num_valor_aluguel, 0);

  // Reset queries on Tab Change
  useEffect(() => {
    setSearchQuery('');
  }, [activeTab]);

  // Filters & Search
  const filteredEquipamentos = equipamentos.filter((e) => {
    const term = searchQuery.toLowerCase();
    return (
      e.txt_nome.toLowerCase().includes(term) ||
      (e.txt_numero_serie || '').toLowerCase().includes(term) ||
      (e.txt_marca || '').toLowerCase().includes(term) ||
      (e.txt_modelo || '').toLowerCase().includes(term)
    );
  });

  const filteredPacientes = pacientes.filter((p) => {
    const term = searchQuery.toLowerCase();
    const matchesSearch =
      p.txt_nome.toLowerCase().includes(term) ||
      (p.txt_cpf || '').includes(searchQuery) ||
      (p.txt_whatsapp || '').includes(searchQuery);

    if (!matchesSearch) return false;

    if (patientFilter === 'homecare') {
      return p.txt_tipo === 'Homecare' || !p.txt_tipo;
    }
    if (patientFilter === 'hospital') {
      return p.txt_tipo === 'Hospital';
    }
    if (patientFilter === 'com_equipamento') {
      return locacoes.some((l) => l.fk_paciente === p._id && l.txt_status === 'Ativo');
    }
    return true;
  });

  const filteredLocacoes = locacoes.filter((l) => {
    const term = searchQuery.toLowerCase();
    const equip = equipamentos.find((e) => e._id === l.fk_equipamento);
    const pac = pacientes.find((p) => p._id === l.fk_paciente);
    return (
      (equip?.txt_nome || '').toLowerCase().includes(term) ||
      (pac?.txt_nome || '').toLowerCase().includes(term) ||
      (equip?.txt_numero_serie || '').toLowerCase().includes(term)
    );
  });

  // Modal Open Handlers
  const handleOpenEquipModal = (equip: Equipamento | null = null) => {
    if (equip) {
      setEditingEquipamento(equip);
      setEquipNome(equip.txt_nome);
      setEquipDescricao(equip.txt_descricao || '');
      setEquipMarca(equip.txt_marca || '');
      setEquipModelo(equip.txt_modelo || '');
      setEquipSerie(equip.txt_numero_serie);
      setEquipPreco(String(equip.num_preco_padrao));
      setEquipStatus(equip.txt_status);
    } else {
      setEditingEquipamento(null);
      setEquipNome('');
      setEquipDescricao('');
      setEquipMarca('');
      setEquipModelo('');
      setEquipSerie('');
      setEquipPreco('');
      setEquipStatus('Disponível');
    }
    setIsEquipModalOpen(true);
  };

  const handleOpenRentalModal = () => {
    setRentEquipId('');
    setRentPatId('');
    setRentValor('');
    setRentDataInicio(new Date().toISOString().split('T')[0]);
    setRentDataFimPrevisto('');
    setRentObservacoes('');
    setIsRentalModalOpen(true);
  };

  // Submit Equipamento (Create or Edit)
  const handleSubmitEquipamento = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg('');

    try {
      const payload = {
        txt_nome: equipNome,
        txt_descricao: equipDescricao,
        txt_marca: equipMarca,
        txt_modelo: equipModelo,
        txt_numero_serie: equipSerie,
        num_preco_padrao: Number(equipPreco),
        txt_status: equipStatus,
      };

      if (editingEquipamento?._id) {
        await axios.patch(`/api/gestor/equipamentos/${editingEquipamento._id}`, payload);
      } else {
        await axios.post('/api/gestor/equipamentos', payload);
      }

      setIsEquipModalOpen(false);
      fetchData();
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } } };
      setErrorMsg(error.response?.data?.error || 'Erro ao salvar equipamento.');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Patient
  const handleSubmitPaciente = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg('');

    try {
      const payload = {
        txt_nome: patNome,
        txt_cpf: patCPF,
        txt_whatsapp: patWhatsapp,
        txt_endereco: patEndereco,
        txt_email: patEmail,
        txt_tipo: patTipo,
      };

      await axios.post('/api/gestor/pacientes', payload);

      setIsPatientModalOpen(false);
      setPatNome('');
      setPatCPF('');
      setPatWhatsapp('');
      setPatEndereco('');
      setPatEmail('');
      setPatTipo('Homecare');
      fetchData();
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } } };
      setErrorMsg(error.response?.data?.error || 'Erro ao cadastrar paciente.');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Rental
  const handleSubmitRental = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg('');

    try {
      const payload = {
        fk_equipamento: rentEquipId,
        fk_paciente: rentPatId,
        date_inicio: rentDataInicio,
        date_fim_previsto: rentDataFimPrevisto,
        num_valor_aluguel: Number(rentValor),
        txt_observacoes: rentObservacoes,
      };

      await axios.post('/api/gestor/locacoes', payload);

      setIsRentalModalOpen(false);
      fetchData();
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } } };
      setErrorMsg(error.response?.data?.error || 'Erro ao registrar locação.');
    } finally {
      setSubmitting(false);
    }
  };

  // Pre-fill Rental Value when Equipment is selected
  useEffect(() => {
    if (rentEquipId) {
      const selected = equipamentos.find((e) => e._id === rentEquipId);
      if (selected) {
        setRentValor(String(selected.num_preco_padrao));
      }
    }
  }, [rentEquipId, equipamentos]);

  // Open Return Rental Dialog
  const handleOpenReturnModal = (rental: LocacaoEquipamento) => {
    setSelectedRentalForReturn(rental);
    setReturnEquipStatus('Disponível');
    setIsReturnModalOpen(true);
  };

  // Finalize/Return Rental Submit
  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRentalForReturn?._id) return;
    setSubmitting(true);
    setErrorMsg('');

    try {
      await axios.patch(`/api/gestor/locacoes/${selectedRentalForReturn._id}`, {
        txt_status: 'Finalizado',
        date_fim_real: new Date().toISOString().split('T')[0],
        txt_status_equipamento: returnEquipStatus,
        fk_equipamento: selectedRentalForReturn.fk_equipamento,
      });

      setIsReturnModalOpen(false);
      setSelectedRentalForReturn(null);
      fetchData();
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } } };
      setErrorMsg(error.response?.data?.error || 'Erro ao finalizar devolução.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6 md:p-10 font-sans relative overflow-hidden">
      {/* Glow effects */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-100 rounded-full blur-[120px] pointer-events-none opacity-60" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-100 rounded-full blur-[120px] pointer-events-none opacity-60" />

      {/* Header */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 z-10 relative">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 mb-1 hover:text-indigo-850 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <Link href="/gestor/dashboard" className="text-xs font-bold uppercase tracking-wider">
              Painel Principal
            </Link>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Activity className="w-8 h-8 text-indigo-600 animate-pulse" />
            Gestão de Equipamentos
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Cadastre equipamentos, gerencie pacientes e acompanhe o fluxo de locações médicas.
          </p>
        </div>

        {/* Action buttons matching dashboard style */}
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/gestor/dashboard"
            className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-all"
          >
            Dashboard Cooperados
          </Link>
          <Link
            href="/gestor/financeiro"
            className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-all"
          >
            Painel Financeiro
          </Link>
          <Link
            href="/gestor/termos"
            className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-all"
          >
            Gerenciar Termos
          </Link>
          <button
            onClick={fetchData}
            className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-650 p-2 rounded-lg transition-all shadow-sm"
            title="Atualizar dados"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-5 gap-4 mb-10 z-10 relative">
        {[
          {
            label: 'Total Equipamentos',
            val: totalEquips,
            icon: Activity,
            color: 'text-indigo-600 bg-indigo-500/10 border-indigo-500/20',
          },
          {
            label: 'Disponíveis',
            val: availableEquips,
            icon: CheckCircle,
            color: 'text-green-600 bg-green-500/10 border-green-500/20',
          },
          {
            label: 'Alugados',
            val: rentedEquips,
            icon: FileText,
            color: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
          },
          {
            label: 'Manutenção',
            val: maintenanceEquips,
            icon: Wrench,
            color: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
          },
          {
            label: 'Faturamento Estimado',
            val: formatCurrency(estimatedRevenue),
            icon: DollarSign,
            color: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20',
          },
        ].map((item, idx) => {
          const Icon = item.icon;
          return (
            <div
              key={idx}
              className="bg-white border border-slate-200 p-5 rounded-xl flex items-center justify-between gap-4 shadow-sm"
            >
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">{item.label}</span>
                <p className="text-xl font-black text-slate-900 mt-1">{item.val}</p>
              </div>
              <div className={`p-3 rounded-lg border ${item.color} shrink-0`}>
                <Icon className="w-5 h-5" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Error Banner */}
      {errorMsg && (
        <div className="max-w-7xl mx-auto mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-3 shadow-sm z-10 relative">
          <Info className="w-5 h-5 text-red-500 shrink-0" />
          <span className="text-sm font-medium">{errorMsg}</span>
        </div>
      )}

      {/* Navigation Tabs and Register Actions */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 z-10 relative">
        <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm w-fit">
          <button
            onClick={() => setActiveTab('locacoes')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'locacoes' ? 'bg-indigo-650 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Locações Ativas
          </button>
          <button
            onClick={() => setActiveTab('equipamentos')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'equipamentos' ? 'bg-indigo-650 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Catálogo de Equipamentos
          </button>
          <button
            onClick={() => setActiveTab('pacientes')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'pacientes' ? 'bg-indigo-650 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Cadastro de Pacientes
          </button>
        </div>

        {/* Search bar & quick registers */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder={
                activeTab === 'locacoes'
                  ? 'Buscar por paciente ou equipamento...'
                  : activeTab === 'equipamentos'
                  ? 'Buscar por nome, marca, nº série...'
                  : 'Buscar por nome ou CPF...'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white border border-slate-200 focus:border-indigo-500 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none transition-all shadow-sm w-64"
            />
          </div>

          {activeTab === 'locacoes' && (
            <button
              onClick={handleOpenRentalModal}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md flex items-center gap-1.5 transition-all"
            >
              <Plus className="w-4 h-4" />
              Nova Locação
            </button>
          )}

          {activeTab === 'equipamentos' && (
            <button
              onClick={() => handleOpenEquipModal(null)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md flex items-center gap-1.5 transition-all"
            >
              <Plus className="w-4 h-4" />
              Cadastrar Equipamento
            </button>
          )}

          {activeTab === 'pacientes' && (
            <button
              onClick={() => setIsPatientModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md flex items-center gap-1.5 transition-all"
            >
              <Plus className="w-4 h-4" />
              Cadastrar Paciente
            </button>
          )}
        </div>
      </div>

      {/* Main Tables Container */}
      <div className="max-w-7xl mx-auto bg-white border border-slate-200 rounded-2xl shadow-sm z-10 relative overflow-hidden">
        {loading ? (
          <div className="p-20 flex flex-col items-center justify-center text-slate-500 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            <span className="text-sm font-medium">Carregando dados do Bubble...</span>
          </div>
        ) : (
          <>
            {/* TAB 1: LOCAÇÕES */}
            {activeTab === 'locacoes' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/70 border-b border-slate-100 text-slate-450 uppercase text-[10px] font-bold tracking-wider">
                      <th className="px-6 py-4">Paciente</th>
                      <th className="px-6 py-4">Equipamento</th>
                      <th className="px-6 py-4">Valor Cobrado</th>
                      <th className="px-6 py-4">Início</th>
                      <th className="px-6 py-4">Fim Previsto</th>
                      <th className="px-6 py-4">Devolução</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 text-sm">
                    {filteredLocacoes.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-12 text-slate-400">
                          Nenhuma locação encontrada.
                        </td>
                      </tr>
                    ) : (
                      filteredLocacoes.map((l) => {
                        const equip = equipamentos.find((e) => e._id === l.fk_equipamento);
                        const pac = pacientes.find((p) => p._id === l.fk_paciente);
                        return (
                          <tr key={l._id} className="hover:bg-slate-50/40 transition-colors">
                            <td className="px-6 py-4">
                              <div className="font-semibold text-slate-900">{pac?.txt_nome || 'Desconhecido'}</div>
                              <div className="text-xs text-slate-400">CPF: {pac?.txt_cpf || '-'}</div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="font-semibold text-slate-800">{equip?.txt_nome || 'N/A'}</div>
                              <div className="text-xs text-slate-400">S/N: {equip?.txt_numero_serie || '-'}</div>
                            </td>
                            <td className="px-6 py-4 font-semibold text-slate-900">
                              {formatCurrency(l.num_valor_aluguel)}
                            </td>
                            <td className="px-6 py-4 text-slate-500">{formatDate(l.date_inicio)}</td>
                            <td className="px-6 py-4 text-slate-500">{formatDate(l.date_fim_previsto)}</td>
                            <td className="px-6 py-4 text-slate-500">{formatDate(l.date_fim_real)}</td>
                            <td className="px-6 py-4">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                  l.txt_status === 'Ativo'
                                    ? 'bg-green-550/10 text-green-700 border border-green-200'
                                    : l.txt_status === 'Finalizado'
                                    ? 'bg-slate-100 text-slate-600 border border-slate-200'
                                    : 'bg-red-50 text-red-600 border border-red-150'
                                }`}
                              >
                                {l.txt_status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              {l.txt_status === 'Ativo' && (
                                <button
                                  onClick={() => handleOpenReturnModal(l)}
                                  className="text-indigo-650 hover:text-indigo-800 text-xs font-bold hover:underline"
                                >
                                  Devolver
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* TAB 2: EQUIPAMENTOS */}
            {activeTab === 'equipamentos' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/70 border-b border-slate-100 text-slate-450 uppercase text-[10px] font-bold tracking-wider">
                      <th className="px-6 py-4">Equipamento</th>
                      <th className="px-6 py-4">Marca/Modelo</th>
                      <th className="px-6 py-4">Nº Série</th>
                      <th className="px-6 py-4">Preço Padrão</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 text-sm">
                    {filteredEquipamentos.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-12 text-slate-400">
                          Nenhum equipamento cadastrado.
                        </td>
                      </tr>
                    ) : (
                      filteredEquipamentos.map((e) => (
                        <tr key={e._id} className="hover:bg-slate-50/40 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-semibold text-slate-900">{e.txt_nome}</div>
                            {e.txt_descricao && <div className="text-xs text-slate-450 truncate max-w-md">{e.txt_descricao}</div>}
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-medium text-slate-800">{e.txt_marca || '-'}</span>
                            {e.txt_modelo && <span className="text-slate-400 text-xs block">{e.txt_modelo}</span>}
                          </td>
                          <td className="px-6 py-4 text-slate-500 font-mono text-xs">{e.txt_numero_serie}</td>
                          <td className="px-6 py-4 font-semibold text-slate-900">
                            {formatCurrency(e.num_preco_padrao)}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                e.txt_status === 'Disponível'
                                  ? 'bg-green-550/10 text-green-700 border border-green-200'
                                  : e.txt_status === 'Alugado'
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : e.txt_status === 'Manutenção'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-slate-100 text-slate-600 border border-slate-200'
                              }`}
                            >
                              {e.txt_status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => handleOpenEquipModal(e)}
                              className="text-indigo-650 hover:text-indigo-800 inline-flex items-center gap-1 text-xs font-bold hover:underline"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              Editar
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* TAB 3: PACIENTES */}
            {activeTab === 'pacientes' && (
              <div>
                <div className="flex gap-2 p-4 border-b border-slate-100 bg-slate-50/40 flex-wrap">
                  {[
                    { id: 'todos', label: 'Todos' },
                    { id: 'homecare', label: 'Homecare' },
                    { id: 'hospital', label: 'Hospital' },
                    { id: 'com_equipamento', label: 'Com Equipamento Enviado' },
                  ].map((filter) => (
                    <button
                      key={filter.id}
                      onClick={() => setPatientFilter(filter.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                        patientFilter === filter.id
                          ? 'bg-indigo-600 text-white border-indigo-650 shadow-sm'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/70 border-b border-slate-100 text-slate-450 uppercase text-[10px] font-bold tracking-wider">
                        <th className="px-6 py-4">Nome / Tipo</th>
                        <th className="px-6 py-4">Endereço de Entrega</th>
                        <th className="px-6 py-4">Equipamentos Enviados</th>
                        <th className="px-6 py-4">Contato</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700 text-sm">
                      {filteredPacientes.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="text-center py-12 text-slate-400">
                            Nenhum paciente encontrado.
                          </td>
                        </tr>
                      ) : (
                        filteredPacientes.map((p) => {
                          const hasActiveRental = locacoes.some((l) => l.fk_paciente === p._id && l.txt_status === 'Ativo');
                          return (
                            <tr key={p._id} className="hover:bg-slate-50/40 transition-colors">
                              <td className="px-6 py-4">
                                <div className="font-semibold text-slate-900 flex items-center gap-2">
                                  {p.txt_nome}
                                  <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                      p.txt_tipo === 'Hospital'
                                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                                        : 'bg-green-50 text-green-700 border-green-200'
                                    }`}
                                  >
                                    {p.txt_tipo || 'Homecare'}
                                  </span>
                                  {hasActiveRental && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                      Com Equipamento
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 text-slate-500 max-w-sm truncate" title={p.txt_endereco}>
                                {p.txt_endereco}
                              </td>
                              <td className="px-6 py-4">
                                <div className="text-slate-500 text-xs space-y-1">
                                  {p.fks_equipamentos && p.fks_equipamentos.length > 0 ? (
                                    p.fks_equipamentos.map((equipId) => {
                                      const eq = equipamentos.find((e) => e._id === equipId);
                                      return (
                                        <div key={equipId} className="flex items-center gap-1">
                                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-505 bg-indigo-500"></span>
                                          <span className="font-medium text-slate-700">{eq ? eq.txt_nome : 'Equipamento'}</span>
                                        </div>
                                      );
                                    })
                                  ) : (
                                    <span className="text-slate-400 font-normal italic">Nenhum</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                {p.txt_whatsapp && <div className="text-xs text-slate-650 font-medium">WhatsApp: {p.txt_whatsapp}</div>}
                                {p.txt_email && <div className="text-[11px] text-slate-450">{p.txt_email}</div>}
                                {!p.txt_whatsapp && !p.txt_email && <span className="text-slate-400">-</span>}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* MODAL 1: CADASTRAR/EDITAR EQUIPAMENTO */}
      {isEquipModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden border border-slate-150 animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-900">
                {editingEquipamento ? 'Editar Equipamento' : 'Cadastrar Equipamento'}
              </h2>
              <button
                onClick={() => setIsEquipModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitEquipamento} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nome do Equipamento *</label>
                <input
                  type="text"
                  required
                  value={equipNome}
                  onChange={(e) => setEquipNome(e.target.value)}
                  placeholder="Ex: Concentrador de Oxigênio 10L"
                  className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Marca / Fabricante</label>
                  <input
                    type="text"
                    value={equipMarca}
                    onChange={(e) => setEquipMarca(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none"
                    placeholder="Ex: Philips"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Modelo</label>
                  <input
                    type="text"
                    value={equipModelo}
                    onChange={(e) => setEquipModelo(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none"
                    placeholder="Ex: EverFlo"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nº Série / Patrimônio *</label>
                  <input
                    type="text"
                    required
                    value={equipSerie}
                    onChange={(e) => setEquipSerie(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none font-mono"
                    placeholder="Ex: SN-19842"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Preço Base Aluguel *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-semibold">R$</span>
                    <input
                      type="number"
                      required
                      step="0.01"
                      value={equipPreco}
                      onChange={(e) => setEquipPreco(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-800 focus:outline-none"
                      placeholder="0,00"
                    />
                  </div>
                </div>
              </div>

              {editingEquipamento && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Status</label>
                  <select
                    value={equipStatus}
                    onChange={(e) => setEquipStatus(e.target.value as Equipamento['txt_status'])}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none"
                  >
                    <option value="Disponível">Disponível</option>
                    <option value="Alugado">Alugado</option>
                    <option value="Manutenção">Manutenção</option>
                    <option value="Inativo">Inativo</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Descrição / Notas</label>
                <textarea
                  value={equipDescricao}
                  onChange={(e) => setEquipDescricao(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl px-4 py-2 text-sm text-slate-800 focus:outline-none h-20 resize-none"
                  placeholder="Descreva detalhes como acessórios inclusos ou avarias estéticas..."
                />
              </div>

              <div className="pt-2 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEquipModalOpen(false)}
                  className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl text-sm font-bold shadow-md flex items-center gap-1.5 transition-all"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CADASTRAR PACIENTE */}
      {isPatientModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden border border-slate-150 animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-900">Cadastrar Paciente</h2>
              <button
                onClick={() => setIsPatientModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitPaciente} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nome Completo *</label>
                <input
                  type="text"
                  required
                  value={patNome}
                  onChange={(e) => setPatNome(e.target.value)}
                  placeholder="Nome do paciente..."
                  className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">CPF *</label>
                  <input
                    type="text"
                    required
                    value={patCPF}
                    onChange={(e) => setPatCPF(e.target.value)}
                    placeholder="Ex: 000.000.000-00"
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Whatsapp / Telefone *</label>
                  <input
                    type="text"
                    required
                    value={patWhatsapp}
                    onChange={(e) => setPatWhatsapp(e.target.value)}
                    placeholder="Ex: (00) 90000-0000"
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">E-mail (Opcional)</label>
                <input
                  type="email"
                  value={patEmail}
                  onChange={(e) => setPatEmail(e.target.value)}
                  placeholder="Ex: paciente@email.com"
                  className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tipo de Paciente *</label>
                <select
                  value={patTipo}
                  onChange={(e) => setPatTipo(e.target.value as 'Homecare' | 'Hospital')}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none"
                >
                  <option value="Homecare">Homecare</option>
                  <option value="Hospital">Hospital</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Endereço Completo de Entrega *</label>
                <textarea
                  required
                  value={patEndereco}
                  onChange={(e) => setPatEndereco(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl px-4 py-2 text-sm text-slate-800 focus:outline-none h-20 resize-none"
                  placeholder="Rua, número, complemento, bairro, cidade - UF..."
                />
              </div>

              <div className="pt-2 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsPatientModalOpen(false)}
                  className="bg-white hover:bg-slate-550/10 border border-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl text-sm font-bold shadow-md flex items-center gap-1.5 transition-all"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Cadastrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: REGISTRAR NOVA LOCAÇÃO */}
      {isRentalModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden border border-slate-150 animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-900">Registrar Nova Locação</h2>
              <button
                onClick={() => setIsRentalModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitRental} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Selecionar Paciente *</label>
                <select
                  required
                  value={rentPatId}
                  onChange={(e) => setRentPatId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none"
                >
                  <option value="">Selecione o paciente...</option>
                  {pacientes.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.txt_nome} (CPF: {p.txt_cpf})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Equipamento Disponível *</label>
                <select
                  required
                  value={rentEquipId}
                  onChange={(e) => setRentEquipId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none"
                >
                  <option value="">Selecione o equipamento...</option>
                  {equipamentos
                    .filter((e) => e.txt_status === 'Disponível')
                    .map((e) => (
                      <option key={e._id} value={e._id}>
                        {e.txt_nome} — S/N: {e.txt_numero_serie} ({formatCurrency(e.num_preco_padrao)})
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Data de Início *</label>
                  <input
                    type="date"
                    required
                    value={rentDataInicio}
                    onChange={(e) => setRentDataInicio(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Data Fim Previsto *</label>
                  <input
                    type="date"
                    required
                    value={rentDataFimPrevisto}
                    onChange={(e) => setRentDataFimPrevisto(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Valor Cobrado * (mensal/total)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-semibold">R$</span>
                  <input
                    type="number"
                    required
                    step="0.01"
                    value={rentValor}
                    onChange={(e) => setRentValor(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-800 focus:outline-none"
                    placeholder="0,00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Observações da Locação</label>
                <textarea
                  value={rentObservacoes}
                  onChange={(e) => setRentObservacoes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl px-4 py-2 text-sm text-slate-800 focus:outline-none h-20 resize-none"
                  placeholder="Notas adicionais sobre o termo ou condições da entrega..."
                />
              </div>

              <div className="pt-2 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsRentalModalOpen(false)}
                  className="bg-white hover:bg-slate-550/10 border border-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl text-sm font-bold shadow-md flex items-center gap-1.5 transition-all"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Registrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: REGISTRAR DEVOLUÇÃO */}
      {isReturnModalOpen && selectedRentalForReturn && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-150 animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-900">Registrar Devolução</h2>
              <button
                onClick={() => {
                  setIsReturnModalOpen(false);
                  setSelectedRentalForReturn(null);
                }}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitReturn} className="p-6 space-y-4">
              <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl text-xs space-y-1.5">
                <div className="text-slate-450 font-semibold uppercase">Resumo da Locação</div>
                <div className="text-slate-800">
                  <span className="font-bold">Paciente:</span>{' '}
                  {pacientes.find((p) => p._id === selectedRentalForReturn.fk_paciente)?.txt_nome || 'N/A'}
                </div>
                <div className="text-slate-800">
                  <span className="font-bold">Equipamento:</span>{' '}
                  {equipamentos.find((e) => e._id === selectedRentalForReturn.fk_equipamento)?.txt_nome || 'N/A'}
                </div>
                <div className="text-slate-800">
                  <span className="font-bold">Preço Cobrado:</span>{' '}
                  {formatCurrency(selectedRentalForReturn.num_valor_aluguel)}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">
                  Status de destino do Equipamento
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setReturnEquipStatus('Disponível')}
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-sm font-semibold transition-all ${
                      returnEquipStatus === 'Disponível'
                        ? 'bg-green-50 border-green-300 text-green-700 font-bold shadow-sm'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <CheckCircle className="w-4 h-4" />
                    Disponível
                  </button>
                  <button
                    type="button"
                    onClick={() => setReturnEquipStatus('Manutenção')}
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-sm font-semibold transition-all ${
                      returnEquipStatus === 'Manutenção'
                        ? 'bg-amber-50 border-amber-300 text-amber-700 font-bold shadow-sm'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Wrench className="w-4 h-4" />
                    Manutenção
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-2">
                  Defina se o equipamento retornará para estoque imediatamente ou passará por processo de higienização / reparo.
                </p>
              </div>

              <div className="pt-2 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsReturnModalOpen(false);
                    setSelectedRentalForReturn(null);
                  }}
                  className="bg-white hover:bg-slate-550/10 border border-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-indigo-650 hover:bg-indigo-800 text-white px-5 py-2 rounded-xl text-sm font-bold shadow-md flex items-center gap-1.5 transition-all"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Confirmar Devolução
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
