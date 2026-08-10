/* eslint-disable */
'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  FileText, Search, Filter, Download, ArrowRight, Eye, Calendar, Clock, User, ShieldAlert
} from 'lucide-react';
import Link from 'next/link';

interface Evolution {
  id: string;
  paciente_id: string;
  paciente_nome: string;
  paciente_cpf: string;
  profissional_id: string;
  profissional_nome?: string;
  tipo_profissional: 'Tecnico_Enfermagem' | 'Medico' | 'Terapeuta';
  turno?: string;
  check_in: string;
  check_out: string;
  status: string;
  data_assinatura?: string;
  aprazamentos?: any[];
}

export default function ProntuariosAuditDashboard() {
  const [evolutions, setEvolutions] = useState<Evolution[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('');
  const [selectedTurno, setSelectedTurno] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    fetchProntuarios();
  }, [selectedSpecialty]);

  const fetchProntuarios = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (selectedSpecialty) params.specialty = selectedSpecialty;
      
      const response = await axios.get('/api/gestor/prontuarios', { params });
      if (response.data.success) {
        setEvolutions(response.data.results || []);
      }
    } catch (e) {
      console.error('Erro ao buscar prontuários:', e);
    } finally {
      setLoading(false);
    }
  };

  // Filtragem local complementar para pesquisa textual
  const filteredEvolutions = evolutions.filter((ev) => {
    const term = search.toLowerCase();
    const matchSearch =
      ev.paciente_nome.toLowerCase().includes(term) ||
      ev.paciente_cpf.includes(term) ||
      (ev.profissional_nome || 'Dra. Ana Silva').toLowerCase().includes(term);
      
    const matchTurno = selectedTurno ? ev.turno === selectedTurno : true;

    // Filtros de data
    let matchDates = true;
    if (startDate) {
      matchDates = matchDates && new Date(ev.check_in) >= new Date(startDate);
    }
    if (endDate) {
      matchDates = matchDates && new Date(ev.check_in) <= new Date(endDate + 'T23:59:59');
    }

    return matchSearch && matchTurno && matchDates;
  });

  // Métricas Consolidadas
  const totalAtendimentos = filteredEvolutions.length;
  
  const totalSegundos = filteredEvolutions.reduce((acc, curr) => {
    if (!curr.check_out || !curr.check_in) return acc;
    const duracao = new Date(curr.check_out).getTime() - new Date(curr.check_in).getTime();
    return acc + Math.max(0, duracao / 1000);
  }, 0);
  
  const tempoMedioMinutos = totalAtendimentos > 0 ? Math.round((totalSegundos / 60) / totalAtendimentos) : 0;

  // Taxa de conformidade de medicação (quantos administrados / total aprazados)
  let totalAprazados = 0;
  let totalAdministrados = 0;
  filteredEvolutions.forEach(ev => {
    if (ev.aprazamentos) {
      ev.aprazamentos.forEach(a => {
        totalAprazados++;
        if (a.status === 'Administrado') {
          totalAdministrados++;
        }
      });
    }
  });
  const complianceRate = totalAprazados > 0 ? Math.round((totalAdministrados / totalAprazados) * 100) : 100;

  const exportToCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'ID Prontuario,Paciente,CPF Paciente,Profissional,Especialidade,Turno,Check-In,Check-Out,Tempo Gasto (Min),Status,Data Assinatura\n';

    filteredEvolutions.forEach((ev) => {
      const durationMin = ev.check_out && ev.check_in
        ? Math.round((new Date(ev.check_out).getTime() - new Date(ev.check_in).getTime()) / 60000)
        : 0;

      const row = [
        ev.id,
        ev.paciente_nome,
        ev.paciente_cpf,
        ev.profissional_nome || 'Dra. Ana Silva',
        ev.tipo_profissional,
        ev.turno || 'N/A',
        ev.check_in,
        ev.check_out || 'N/A',
        durationMin,
        ev.status,
        ev.data_assinatura || 'N/A'
      ].map(val => `"${val}"`).join(',');

      csvContent += row + '\n';
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `auditoria_prontuarios_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const specialtyLabels: Record<Evolution['tipo_profissional'], string> = {
    Tecnico_Enfermagem: 'Técnico de Enfermagem',
    Medico: 'Médico',
    Terapeuta: 'Terapeuta'
  };

  return (
    <div className="space-y-6">
      {/* Título da Página */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            Auditoria de Prontuários Multidisciplinares
          </h1>
          <p className="text-xs text-slate-500 mt-1">Conformidade de evoluções, aprazamentos e tempos de permanência em domicílio.</p>
        </div>
        
        <div className="flex gap-2">
          <Link
            href="/gestor/prontuarios/auditoria"
            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold py-2 px-4 rounded-lg border border-indigo-100 transition-all"
          >
            Reconciliação de Medicamentos
          </Link>
          <button
            onClick={exportToCSV}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2 px-4 rounded-lg flex items-center gap-1.5 shadow transition-all"
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Grid de Métricas Gerais de Auditoria */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-1">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total de Atendimentos</span>
          <span className="text-2xl font-black text-slate-900">{totalAtendimentos}</span>
          <span className="text-[10px] text-slate-500 mt-1">Sessões finalizadas no período</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-1">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Tempo Médio em Domicílio</span>
          <span className="text-2xl font-black text-slate-900">{tempoMedioMinutos} min</span>
          <span className="text-[10px] text-slate-500 mt-1">Calculado por check-in/out</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-1">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Conformidade de Medicação</span>
          <span className="text-2xl font-black text-slate-900">{complianceRate}%</span>
          <span className="text-[10px] text-slate-500 mt-1">Checked vs. Prescrito</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-1">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Erros / Omissões Graves</span>
          <span className="text-2xl font-black text-red-600">
            {filteredEvolutions.reduce((acc, curr) => acc + (curr.aprazamentos?.filter(a => a.status === 'Nao_Administrado').length || 0), 0)}
          </span>
          <span className="text-[10px] text-slate-500 mt-1">Justificativas pendentes de revisão</span>
        </div>
      </div>

      {/* Seção Filtros */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-wrap gap-4 items-end">
        {/* Pesquisa Geral */}
        <div className="flex-1 min-w-[200px] flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase text-slate-450 tracking-wider flex items-center gap-1">
            <Search className="w-3.5 h-3.5" />
            Pesquisa rápida
          </label>
          <input
            type="text"
            placeholder="Buscar por Paciente, CPF ou Profissional..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border border-slate-200 rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus:border-slate-350 w-full"
          />
        </div>

        {/* Especialidade */}
        <div className="w-[180px] flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase text-slate-450 tracking-wider flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" />
            Especialidade
          </label>
          <select
            value={selectedSpecialty}
            onChange={(e) => setSelectedSpecialty(e.target.value)}
            className="border border-slate-200 bg-white rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus:border-slate-350"
          >
            <option value="">Todas as especialidades</option>
            <option value="Tecnico_Enfermagem">Enfermagem</option>
            <option value="Medico">Médico</option>
            <option value="Terapeuta">Terapia Multidisciplinar</option>
          </select>
        </div>

        {/* Turno */}
        <div className="w-[120px] flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase text-slate-450 tracking-wider flex items-center gap-1">
            Turno
          </label>
          <select
            value={selectedTurno}
            onChange={(e) => setSelectedTurno(e.target.value)}
            className="border border-slate-200 bg-white rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus:border-slate-350"
          >
            <option value="">Todos</option>
            <option value="Diurno">Diurno</option>
            <option value="Noturno">Noturno</option>
            <option value="24h">24 Horas</option>
          </select>
        </div>

        {/* Datas */}
        <div className="flex gap-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase text-slate-450 tracking-wider flex items-center gap-1">
              De
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border border-slate-200 rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus:border-slate-350"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase text-slate-450 tracking-wider flex items-center gap-1">
              Até
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border border-slate-200 rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus:border-slate-350"
            />
          </div>
        </div>
      </div>

      {/* Tabela de Prontuários (Visualização Auditoria) */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-10 text-xs font-bold text-slate-500">Filtrando registros...</div>
        ) : filteredEvolutions.length === 0 ? (
          <div className="text-center py-10 text-xs font-bold text-slate-500">Nenhum prontuário encontrado com os filtros selecionados.</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-extrabold uppercase tracking-wider text-slate-450">
                <th className="py-3 px-4">Paciente / CPF</th>
                <th className="py-3 px-4">Profissional</th>
                <th className="py-3 px-4">Especialidade</th>
                <th className="py-3 px-4">Turno</th>
                <th className="py-3 px-4">Entrada / Saída</th>
                <th className="py-3 px-4 text-right">Tempo Total</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredEvolutions.map((ev) => {
                const durationMin = ev.check_out && ev.check_in
                  ? Math.round((new Date(ev.check_out).getTime() - new Date(ev.check_in).getTime()) / 60000)
                  : 0;

                return (
                  <tr key={ev.id} className="hover:bg-slate-50/40 text-slate-700">
                    {/* Paciente */}
                    <td className="py-3.5 px-4">
                      <div>
                        <p className="font-bold text-slate-900">{ev.paciente_nome}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{ev.paciente_cpf}</p>
                      </div>
                    </td>

                    {/* Profissional */}
                    <td className="py-3.5 px-4 font-semibold">
                      {ev.profissional_nome || 'Dra. Ana Silva'}
                    </td>

                    {/* Especialidade */}
                    <td className="py-3.5 px-4 font-semibold text-slate-500">
                      {specialtyLabels[ev.tipo_profissional]}
                    </td>

                    {/* Turno */}
                    <td className="py-3.5 px-4 text-slate-500 font-mono">
                      {ev.turno || 'N/A'}
                    </td>

                    {/* Data / Hora */}
                    <td className="py-3.5 px-4 text-slate-500">
                      <div className="flex flex-col gap-0.5">
                        <p className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {new Date(ev.check_in).toLocaleDateString('pt-BR')}
                        </p>
                        <p className="flex items-center gap-1 text-[10px] text-slate-400">
                          <Clock className="w-3.5 h-3.5 text-slate-450" />
                          {new Date(ev.check_in).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} até {ev.check_out ? new Date(ev.check_out).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'em andamento'}
                        </p>
                      </div>
                    </td>

                    {/* Duração */}
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                      {durationMin} min
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4 text-center">
                      <span className={`text-[9px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full border ${
                        ev.status === 'Finalizado'
                          ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-700 border-amber-500/20 animate-pulse'
                      }`}>
                        {ev.status === 'Finalizado' ? 'Assinado' : 'Em Andamento'}
                      </span>
                    </td>

                    {/* Detalhes */}
                    <td className="py-3.5 px-4 text-right">
                      <Link
                        href={`/gestor/prontuarios/${ev.id}`}
                        className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100/80 px-2.5 py-1 rounded-md border border-indigo-100 transition-all active:scale-[0.98]"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Auditar
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
