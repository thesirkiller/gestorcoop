/* eslint-disable */
'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  FileText,
  Search,
  Filter,
  Download,
  ArrowRight,
  Eye,
  Calendar,
  Clock,
  User,
  ShieldAlert,
  Plus,
  Activity,
  Heart,
  Pill,
  CheckCircle2,
  AlertTriangle,
  Users,
  ChevronRight,
  Sparkles,
  ClipboardList,
  Stethoscope,
  X,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';

interface PacienteSummary {
  id: string;
  nome: string;
  cpf: string;
  data_nascimento?: string;
  endereco?: string;
  telefone?: string;
  responsavel_nome?: string;
  responsavel_telefone?: string;
  diagnostico_principal?: string;
  cid10?: string;
  complexidade?: 'Baixa' | 'Média' | 'Alta';
  plano_saude?: string;
  warnings?: string[];
  status?: string;
  total_prescricoes_ativas?: number;
  ultima_evolucao_data?: string;
  ultimo_profissional_nome?: string;
  ultimo_sinal_vital?: {
    pa_sistolica?: number;
    pa_diastolica?: number;
    fc_bpm?: number;
    temp_celsius?: number;
    spo2_percent?: number;
    glicemia_mg_dl?: number;
    data_hora?: string;
  } | null;
}

interface Evolution {
  id: string;
  paciente_id: string;
  paciente_nome?: string;
  paciente_cpf?: string;
  profissional_id: string;
  profissional_nome?: string;
  tipo_profissional: string;
  turno?: string;
  check_in: string;
  check_out: string;
  status: string;
  data_assinatura?: string;
  transcricao_revisada?: string;
  soap_subjetivo?: string;
  soap_objetivo?: string;
  soap_avaliacao?: string;
  soap_plano?: string;
  aprazamentos?: any[];
}

export default function ProntuariosAuditDashboard() {
  const [activeTab, setActiveTab] = useState<'pacientes' | 'evolucoes'>('pacientes');
  const [pacientes, setPacientes] = useState<PacienteSummary[]>([]);
  const [evolutions, setEvolutions] = useState<Evolution[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('');
  const [selectedComplexidade, setSelectedComplexidade] = useState('');
  const [selectedTurno, setSelectedTurno] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modal Novo Paciente
  const [isNovoPacienteOpen, setIsNovoPacienteOpen] = useState(false);
  const [salvandoPaciente, setSalvandoPaciente] = useState(false);
  const [novoPacienteForm, setNovoPacienteForm] = useState({
    nome: '',
    cpf: '',
    data_nascimento: '',
    endereco: '',
    telefone: '',
    responsavel_nome: '',
    responsavel_telefone: '',
    diagnostico_principal: '',
    cid10: '',
    complexidade: 'Média',
    plano_saude: '',
    numero_carteirinha: '',
    warnings: '',
  });

  useEffect(() => {
    carregarDados();
  }, [selectedSpecialty, selectedComplexidade]);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const [resPacientes, resEvolucoes] = await Promise.all([
        axios.get('/api/gestor/prontuarios/pacientes'),
        axios.get('/api/gestor/prontuarios', {
          params: { specialty: selectedSpecialty || undefined },
        }),
      ]);

      if (resPacientes.data.success) {
        setPacientes(resPacientes.data.data || []);
      }
      if (resEvolucoes.data.success) {
        setEvolutions(resEvolucoes.data.results || []);
      }
    } catch (e) {
      console.error('Erro ao carregar dados do prontuário:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSalvarNovoPaciente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoPacienteForm.nome || !novoPacienteForm.cpf) {
      alert('Nome e CPF são obrigatórios.');
      return;
    }

    setSalvandoPaciente(true);
    try {
      const warningsArray = novoPacienteForm.warnings
        ? novoPacienteForm.warnings.split('\n').filter((w) => w.trim().length > 0)
        : [];

      await axios.post('/api/gestor/prontuarios/pacientes', {
        ...novoPacienteForm,
        warnings: warningsArray,
      });

      setIsNovoPacienteOpen(false);
      setNovoPacienteForm({
        nome: '',
        cpf: '',
        data_nascimento: '',
        endereco: '',
        telefone: '',
        responsavel_nome: '',
        responsavel_telefone: '',
        diagnostico_principal: '',
        cid10: '',
        complexidade: 'Média',
        plano_saude: '',
        numero_carteirinha: '',
        warnings: '',
      });
      await carregarDados();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao cadastrar paciente.');
    } finally {
      setSalvandoPaciente(false);
    }
  };

  // Filtragem Pacientes
  const filteredPacientes = pacientes.filter((p) => {
    const term = search.toLowerCase();
    const matchSearch =
      p.nome.toLowerCase().includes(term) ||
      p.cpf.includes(term) ||
      (p.diagnostico_principal || '').toLowerCase().includes(term) ||
      (p.cid10 || '').toLowerCase().includes(term);

    const matchComp = selectedComplexidade ? p.complexidade === selectedComplexidade : true;
    return matchSearch && matchComp;
  });

  // Filtragem Evoluções
  const filteredEvolutions = evolutions.filter((ev) => {
    const term = search.toLowerCase();
    const matchSearch =
      (ev.paciente_nome || '').toLowerCase().includes(term) ||
      (ev.paciente_cpf || '').includes(term) ||
      (ev.profissional_nome || '').toLowerCase().includes(term);

    const matchTurno = selectedTurno ? ev.turno === selectedTurno : true;

    let matchDates = true;
    if (startDate) {
      matchDates = matchDates && new Date(ev.check_in) >= new Date(startDate);
    }
    if (endDate) {
      matchDates = matchDates && new Date(ev.check_in) <= new Date(endDate + 'T23:59:59');
    }

    return matchSearch && matchTurno && matchDates;
  });

  // Métricas
  const totalPacientesAtivos = pacientes.filter((p) => p.status !== 'Alta').length;
  const totalAtendimentos = filteredEvolutions.length;
  let totalAprazados = 0;
  let totalAdministrados = 0;
  filteredEvolutions.forEach((ev) => {
    if (ev.aprazamentos) {
      ev.aprazamentos.forEach((a) => {
        totalAprazados++;
        if (a.status === 'Administrado') {
          totalAdministrados++;
        }
      });
    }
  });
  const complianceRate =
    totalAprazados > 0 ? Math.round((totalAdministrados / totalAprazados) * 100) : 100;

  const exportToCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent +=
      'ID Prontuario,Paciente,CPF Paciente,Profissional,Especialidade,Turno,Check-In,Check-Out,Tempo Gasto (Min),Status,Data Assinatura\n';

    filteredEvolutions.forEach((ev) => {
      const durationMin =
        ev.check_out && ev.check_in
          ? Math.round(
              (new Date(ev.check_out).getTime() - new Date(ev.check_in).getTime()) / 60000
            )
          : 0;

      const row = [
        ev.id,
        ev.paciente_nome || 'N/A',
        ev.paciente_cpf || 'N/A',
        ev.profissional_nome || 'Profissional',
        ev.tipo_profissional,
        ev.turno || 'N/A',
        ev.check_in,
        ev.check_out,
        durationMin,
        ev.status,
        ev.data_assinatura || 'N/A',
      ].map((val) => `"${val}"`).join(',');

      csvContent += row + '\n';
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `prontuarios_auditoria_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-6 lg:p-8">
      {/* Top Header */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-indigo-100 text-indigo-800 text-xs font-bold px-2.5 py-0.5 rounded-full border border-indigo-200">
              Módulo Clínico & EHR
            </span>
            <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-emerald-600" />
              IA SOAP & Transcrição
            </span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            <Stethoscope className="w-8 h-8 text-indigo-600" />
            Gestão de Prontuários & Pacientes
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Controle integral do cuidado domiciliar, evoluções clínicas, sinais vitais, prescrições e auditoria.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/gestor/prontuarios/auditoria"
            className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-all flex items-center gap-2"
          >
            <ShieldAlert className="w-4 h-4 text-amber-600" />
            Painel de Auditoria
          </Link>

          <button
            onClick={() => setIsNovoPacienteOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Admitir Paciente
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pacientes em Atendimento</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{totalPacientesAtivos}</p>
            <p className="text-xs text-indigo-600 font-semibold mt-1">Cuidado domiciliar ativo</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Evoluções Registradas</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{totalAtendimentos}</p>
            <p className="text-xs text-emerald-600 font-semibold mt-1">100% assinadas digitalmente</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <FileText className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Conformidade Medicamentosa</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{complianceRate}%</p>
            <p className="text-xs text-slate-500 font-semibold mt-1">{totalAdministrados} de {totalAprazados} doses</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
            <Pill className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Monitoramento Clínico</p>
            <p className="text-2xl font-black text-slate-900 mt-1">Sinais em Dia</p>
            <p className="text-xs text-indigo-600 font-semibold mt-1">Triagem de alerta contínua</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
            <Activity className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="max-w-7xl mx-auto flex items-center justify-between border-b border-slate-200 mb-6 pb-2">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setActiveTab('pacientes')}
            className={`pb-3 px-2 font-bold text-sm transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'pacientes'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4" />
            Pacientes & Prontuários ({pacientes.length})
          </button>
          <button
            onClick={() => setActiveTab('evolucoes')}
            className={`pb-3 px-2 font-bold text-sm transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'evolucoes'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            Linha do Tempo de Evoluções ({evolutions.length})
          </button>
        </div>

        {activeTab === 'evolucoes' && (
          <button
            onClick={exportToCSV}
            className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-indigo-600" />
            Exportar CSV
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="max-w-7xl mx-auto bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mb-6 flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={
              activeTab === 'pacientes'
                ? 'Buscar por nome, CPF, diagnóstico ou CID-10...'
                : 'Buscar evolução por paciente, CPF ou profissional...'
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-800"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {activeTab === 'pacientes' ? (
            <select
              value={selectedComplexidade}
              onChange={(e) => setSelectedComplexidade(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="">Todas as Complexidades</option>
              <option value="Alta">Alta Complexidade</option>
              <option value="Média">Média Complexidade</option>
              <option value="Baixa">Baixa Complexidade</option>
            </select>
          ) : (
            <>
              <select
                value={selectedSpecialty}
                onChange={(e) => setSelectedSpecialty(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="">Todas as Especialidades</option>
                <option value="Tecnico_Enfermagem">Téc. Enfermagem</option>
                <option value="Enfermeiro">Enfermeiro</option>
                <option value="Medico">Médico</option>
                <option value="Fisioterapeuta">Fisioterapeuta</option>
                <option value="Fonoaudiologo">Fonoaudiólogo</option>
              </select>

              <select
                value={selectedTurno}
                onChange={(e) => setSelectedTurno(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="">Todos os Turnos</option>
                <option value="Diurno">Diurno</option>
                <option value="Noturno">Noturno</option>
                <option value="24h">24h</option>
                <option value="Visita Pontual">Visita Pontual</option>
              </select>
            </>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-3" />
            <p className="text-sm font-semibold">Carregando dados clínicos...</p>
          </div>
        ) : activeTab === 'pacientes' ? (
          /* TAB 1: PACIENTES GRID */
          filteredPacientes.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800">Nenhum paciente encontrado</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Tente ajustar os filtros de busca ou cadastre um novo paciente para iniciar o acompanhamento.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredPacientes.map((p) => (
                <div
                  key={p.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all p-5 flex flex-col justify-between"
                >
                  <div>
                    {/* Header do Card */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider mb-1 ${
                            p.complexidade === 'Alta'
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : p.complexidade === 'Média'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          Complexidade {p.complexidade || 'Média'}
                        </span>
                        <h3 className="text-base font-bold text-slate-900 tracking-tight leading-tight">
                          {p.nome}
                        </h3>
                        <p className="text-xs text-slate-500 font-mono mt-0.5">CPF: {p.cpf}</p>
                      </div>

                      <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-1 rounded-full border border-emerald-200 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        {p.status || 'Ativo'}
                      </span>
                    </div>

                    {/* Diagnóstico */}
                    {p.diagnostico_principal && (
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs mb-3">
                        <span className="text-slate-500 font-medium">Diagnóstico: </span>
                        <span className="text-slate-800 font-semibold">{p.diagnostico_principal}</span>
                        {p.cid10 && <span className="ml-1 text-slate-500 font-mono">({p.cid10})</span>}
                      </div>
                    )}

                    {/* Alertas e Alergias */}
                    {p.warnings && p.warnings.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {p.warnings.slice(0, 2).map((w, idx) => (
                          <span
                            key={idx}
                            className="bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1"
                          >
                            <AlertTriangle className="w-2.5 h-2.5 text-rose-600" />
                            {w}
                          </span>
                        ))}
                        {p.warnings.length > 2 && (
                          <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                            +{p.warnings.length - 2}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Últimos Sinais Vitais */}
                    {p.ultimo_sinal_vital && (
                      <div className="grid grid-cols-3 gap-1.5 py-2 border-t border-slate-100 text-center">
                        <div className="bg-indigo-50/50 p-1.5 rounded-lg">
                          <p className="text-[9px] text-slate-500 font-medium">PA</p>
                          <p className="text-xs font-bold text-slate-800 font-mono">
                            {p.ultimo_sinal_vital.pa_sistolica && p.ultimo_sinal_vital.pa_diastolica
                              ? `${p.ultimo_sinal_vital.pa_sistolica}/${p.ultimo_sinal_vital.pa_diastolica}`
                              : '--'}
                          </p>
                        </div>
                        <div className="bg-indigo-50/50 p-1.5 rounded-lg">
                          <p className="text-[9px] text-slate-500 font-medium">SpO2</p>
                          <p className="text-xs font-bold text-slate-800 font-mono">
                            {p.ultimo_sinal_vital.spo2_percent ? `${p.ultimo_sinal_vital.spo2_percent}%` : '--'}
                          </p>
                        </div>
                        <div className="bg-indigo-50/50 p-1.5 rounded-lg">
                          <p className="text-[9px] text-slate-500 font-medium">FC</p>
                          <p className="text-xs font-bold text-slate-800 font-mono">
                            {p.ultimo_sinal_vital.fc_bpm ? `${p.ultimo_sinal_vital.fc_bpm} bpm` : '--'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer do Card */}
                  <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                      <Pill className="w-3.5 h-3.5 text-indigo-500" />
                      {p.total_prescricoes_ativas || 0} prescrições ativas
                    </span>

                    <Link
                      href={`/gestor/prontuarios/${p.id}`}
                      className="bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-sm"
                    >
                      Ver Prontuário 360°
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          /* TAB 2: EVOLUÇÕES TABLE */
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="bg-slate-50/80 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4">Paciente</th>
                    <th className="py-3.5 px-4">Profissional & Especialidade</th>
                    <th className="py-3.5 px-4">Turno / Data</th>
                    <th className="py-3.5 px-4">Resumo da Evolução (SOAP)</th>
                    <th className="py-3.5 px-4 text-center">Status / Selo</th>
                    <th className="py-3.5 px-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredEvolutions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        Nenhuma evolução encontrada com os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    filteredEvolutions.map((ev) => (
                      <tr key={ev.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-4">
                          <p className="font-bold text-slate-900">{ev.paciente_nome || 'Paciente'}</p>
                          <p className="text-xs text-slate-450 font-mono">{ev.paciente_cpf || '--'}</p>
                        </td>

                        <td className="py-3.5 px-4">
                          <p className="font-semibold text-slate-800">{ev.profissional_nome || 'Profissional'}</p>
                          <span className="inline-block bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-md mt-0.5">
                            {ev.tipo_profissional.replace('_', ' ')}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <p className="text-xs font-bold text-slate-800">
                            {new Date(ev.check_in).toLocaleDateString('pt-BR')}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {new Date(ev.check_in).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            {ev.turno ? ` • ${ev.turno}` : ''}
                          </p>
                        </td>

                        <td className="py-3.5 px-4 max-w-md">
                          <p className="text-xs text-slate-600 line-clamp-2">
                            {ev.soap_objetivo || ev.transcricao_revisada || 'Sem anotações detalhadas.'}
                          </p>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              ev.status === 'Auditado'
                                ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                                : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            }`}
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            {ev.status}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <Link
                            href={`/gestor/prontuarios/${ev.paciente_id || ev.id}`}
                            className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 p-2 rounded-lg text-xs font-semibold transition-all inline-flex items-center justify-center shadow-sm"
                            title="Visualizar Prontuário do Paciente"
                          >
                            <Eye className="w-4 h-4 text-indigo-600" />
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Admitir / Cadastrar Paciente */}
      {isNovoPacienteOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur z-10">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                  <User className="w-5 h-5 text-indigo-600" />
                  Admissão Clínica de Paciente
                </h2>
                <p className="text-xs text-slate-500">Cadastre os dados clínicos para acompanhamento domiciliar.</p>
              </div>
              <button
                onClick={() => setIsNovoPacienteOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSalvarNovoPaciente} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nome Completo *</label>
                  <input
                    type="text"
                    required
                    value={novoPacienteForm.nome}
                    onChange={(e) => setNovoPacienteForm({ ...novoPacienteForm, nome: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800"
                    placeholder="Ex: Seu João da Silva"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">CPF *</label>
                  <input
                    type="text"
                    required
                    value={novoPacienteForm.cpf}
                    onChange={(e) => setNovoPacienteForm({ ...novoPacienteForm, cpf: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800"
                    placeholder="000.000.000-00"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Data de Nascimento</label>
                  <input
                    type="date"
                    value={novoPacienteForm.data_nascimento}
                    onChange={(e) => setNovoPacienteForm({ ...novoPacienteForm, data_nascimento: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Grau de Complexidade</label>
                  <select
                    value={novoPacienteForm.complexidade}
                    onChange={(e) => setNovoPacienteForm({ ...novoPacienteForm, complexidade: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800"
                  >
                    <option value="Baixa">Baixa Complexidade</option>
                    <option value="Média">Média Complexidade</option>
                    <option value="Alta">Alta Complexidade (UTI Domiciliar)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Endereço de Atendimento (Domicílio)</label>
                <input
                  type="text"
                  value={novoPacienteForm.endereco}
                  onChange={(e) => setNovoPacienteForm({ ...novoPacienteForm, endereco: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800"
                  placeholder="Rua, número, complemento, bairro e cidade"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Diagnóstico Principal</label>
                  <input
                    type="text"
                    value={novoPacienteForm.diagnostico_principal}
                    onChange={(e) => setNovoPacienteForm({ ...novoPacienteForm, diagnostico_principal: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800"
                    placeholder="Ex: Sequela de AVC Isquêmico"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Código CID-10</label>
                  <input
                    type="text"
                    value={novoPacienteForm.cid10}
                    onChange={(e) => setNovoPacienteForm({ ...novoPacienteForm, cid10: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 font-mono"
                    placeholder="Ex: I69.3"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nome do Familiar / Responsável</label>
                  <input
                    type="text"
                    value={novoPacienteForm.responsavel_nome}
                    onChange={(e) => setNovoPacienteForm({ ...novoPacienteForm, responsavel_nome: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800"
                    placeholder="Ex: Maria da Silva (Esposa)"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Telefone / WhatsApp Responsável</label>
                  <input
                    type="text"
                    value={novoPacienteForm.responsavel_telefone}
                    onChange={(e) => setNovoPacienteForm({ ...novoPacienteForm, responsavel_telefone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800"
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Alergias e Alertas Clínicos Críticos (um por linha)
                </label>
                <textarea
                  rows={2}
                  value={novoPacienteForm.warnings}
                  onChange={(e) => setNovoPacienteForm({ ...novoPacienteForm, warnings: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800"
                  placeholder="Ex: Alergia severa a Dipirona&#10;Risco Alto de Queda&#10;Dieta exclusiva por SNE"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsNovoPacienteOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition-colors"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={salvandoPaciente}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {salvandoPaciente ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Salvar Admissão
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
