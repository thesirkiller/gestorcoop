/* eslint-disable */
'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  FileText, ArrowLeft, Filter, AlertTriangle, CheckCircle2, Clock, Calendar, User, Search, RefreshCw
} from 'lucide-react';
import Link from 'next/link';

interface Discrepancy {
  id: string;
  pacienteNome: string;
  profissionalNome: string;
  medicamento: string;
  dosagem: string;
  horarioPrevisto: string;
  horarioExecutado?: string;
  status: 'Pendente' | 'Administrado' | 'Nao_Administrado';
  tipoDesvio: 'Atraso' | 'Omissao_Com_Justificativa' | 'Pendente_Atrasado' | 'Conforme';
  detalheDesvio: string;
}

export default function ReconciliacaoMedicamentosPage() {
  const [discrepancies, setDiscrepancies] = useState<Discrepancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterDesvio, setFilterDesvio] = useState('');

  useEffect(() => {
    loadAuditoria();
  }, []);

  const loadAuditoria = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/gestor/prontuarios');
      if (response.data.success) {
        const evolucoes = response.data.results || [];
        
        // Extrai todas as checagens e calcula os desvios
        const list: Discrepancy[] = [];

        evolucoes.forEach((ev: any) => {
          if (ev.aprazamentos) {
            ev.aprazamentos.forEach((a: any) => {
              const prev = new Date(a.horario_previsto).getTime();
              const exec = a.horario_executado ? new Date(a.horario_executado).getTime() : null;
              
              let tipoDesvio: Discrepancy['tipoDesvio'] = 'Conforme';
              let detalheDesvio = 'Administrado dentro da janela regulamentar';

              if (a.status === 'Nao_Administrado') {
                tipoDesvio = 'Omissao_Com_Justificativa';
                detalheDesvio = a.justificativa || 'Omissão justificada pelo técnico';
              } else if (a.status === 'Pendente') {
                // Se o horário previsto já passou há mais de 1 hora
                const umaHoraEmMs = 60 * 60 * 1000;
                if (Date.now() - prev > umaHoraEmMs) {
                  tipoDesvio = 'Pendente_Atrasado';
                  detalheDesvio = 'Medicamento atrasado sem checagem realizada';
                }
              } else if (a.status === 'Administrado' && exec) {
                const diffMinutos = Math.round((exec - prev) / 60000);
                
                // Janela regulamentar aceitável é de até 60 minutos
                if (Math.abs(diffMinutos) > 60) {
                  tipoDesvio = 'Atraso';
                  detalheDesvio = diffMinutos > 0 
                    ? `Atraso de ${Math.floor(diffMinutos / 60)}h ${diffMinutos % 60}m` 
                    : `Adiantamento de ${Math.floor(Math.abs(diffMinutos) / 60)}h ${Math.abs(diffMinutos) % 60}m`;
                }
              }

              list.push({
                id: a.id,
                pacienteNome: ev.paciente_nome,
                profissionalNome: ev.profissional_nome || 'Dra. Ana Silva',
                medicamento: a.medicamento,
                dosagem: a.dosagem,
                horarioPrevisto: a.horario_previsto,
                horarioExecutado: a.horario_executado,
                status: a.status,
                tipoDesvio,
                detalheDesvio
              });
            });
          }
        });

        setDiscrepancies(list);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const filtered = discrepancies.filter(d => {
    const matchSearch = 
      d.pacienteNome.toLowerCase().includes(search.toLowerCase()) ||
      d.medicamento.toLowerCase().includes(search.toLowerCase()) ||
      d.profissionalNome.toLowerCase().includes(search.toLowerCase());
      
    const matchDesvio = filterDesvio ? d.tipoDesvio === filterDesvio : true;
    return matchSearch && matchDesvio;
  });

  // Métricas de reconciliação
  const countAtrasos = discrepancies.filter(d => d.tipoDesvio === 'Atraso').length;
  const countOmissoes = discrepancies.filter(d => d.tipoDesvio === 'Omissao_Com_Justificativa').length;
  const countPendenteAtrasado = discrepancies.filter(d => d.tipoDesvio === 'Pendente_Atrasado').length;
  const countConforme = discrepancies.filter(d => d.tipoDesvio === 'Conforme').length;
  const total = discrepancies.length;
  const complianceScore = total > 0 ? Math.round((countConforme / total) * 100) : 100;

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <Link
          href="/gestor/prontuarios"
          className="bg-white border border-slate-200 hover:border-slate-300 p-2 rounded-lg text-slate-600 hover:text-slate-900 transition-all shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-slate-900 leading-tight">Reconciliação e Auditoria de Aprazamento</h1>
          <p className="text-xs text-slate-500 mt-0.5">Cruzamento de prescrição médica vs. administração real.</p>
        </div>
      </div>

      {/* Grid Métricas de Reconciliação */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-1">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Índice de Pontualidade</span>
          <span className="text-2xl font-black text-slate-900">{complianceScore}%</span>
          <span className="text-[10px] text-slate-500 mt-1">Doses aplicadas no horário</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-1">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Atrasos de Dose (&gt; 1h)</span>
          <span className="text-2xl font-black text-amber-600">{countAtrasos}</span>
          <span className="text-[10px] text-slate-500 mt-1">Doses aplicadas fora do prazo</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-1">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Omissões Justificadas</span>
          <span className="text-2xl font-black text-red-500">{countOmissoes}</span>
          <span className="text-[10px] text-slate-500 mt-1">Remédios não aplicados com justificativa</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-1">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Pendente Atrasado</span>
          <span className="text-2xl font-black text-red-700 animate-pulse">{countPendenteAtrasado}</span>
          <span className="text-[10px] text-slate-500 mt-1">Passou do horário sem checar</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-1">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Aprazamentos</span>
          <span className="text-2xl font-black text-slate-900">{total}</span>
          <span className="text-[10px] text-slate-500 mt-1">Checagens monitoradas hoje</span>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-wrap gap-4 items-end">
        {/* Pesquisa */}
        <div className="flex-1 w-full sm:min-w-[200px] flex flex-col gap-1.5">
          <label htmlFor="auditoriaPesquisa" className="text-[10px] font-bold uppercase text-slate-500 tracking-wider flex items-center gap-1">
            <Search className="w-3.5 h-3.5" aria-hidden="true" />
            Pesquisa
          </label>
          <input
            id="auditoriaPesquisa"
            type="text"
            placeholder="Buscar por Paciente, Medicamento ou Técnico..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border border-slate-200 rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:ring-offset-1 focus:border-slate-300 w-full"
          />
        </div>

        {/* Tipo Desvio */}
        <div className="w-full sm:w-[200px] flex flex-col gap-1.5">
          <label htmlFor="auditoriaFiltroDesvio" className="text-[10px] font-bold uppercase text-slate-500 tracking-wider flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" aria-hidden="true" />
            Filtrar Inconformidades
          </label>
          <select
            id="auditoriaFiltroDesvio"
            value={filterDesvio}
            onChange={(e) => setFilterDesvio(e.target.value)}
            className="border border-slate-200 bg-white rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:ring-offset-1 focus:border-slate-300"
          >
            <option value="">Todos os status</option>
            <option value="Atraso">Atraso Crítico (&gt;1h)</option>
            <option value="Omissao_Com_Justificativa">Omissão de Dose</option>
            <option value="Pendente_Atrasado">Pendente Atrasado</option>
            <option value="Conforme">Pontuais (Conforme)</option>
          </select>
        </div>

        <button
          onClick={loadAuditoria}
          className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-100 p-2 rounded-lg text-xs font-bold flex items-center gap-1 transition-all active:scale-[0.98]"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Atualizar Painel
        </button>
      </div>

      {/* Grid de Discrepâncias */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-10 text-xs font-bold text-slate-500">Recalculando reconciliação...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-xs font-bold text-slate-500">Nenhum desvio ou reconciliação registrada.</div>
        ) : (
          // Rolagem contida na tabela; sem isso a página inteira rola lateralmente no celular.
          <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Paciente</th>
                <th className="py-3 px-4">Medicamento / Dose</th>
                <th className="py-3 px-4">Horário Prescrito</th>
                <th className="py-3 px-4">Horário Checado</th>
                <th className="py-3 px-4">Responsável Técnico</th>
                <th className="py-3 px-4">Status Desvio</th>
                <th className="py-3 px-4">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {filtered.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50/40">
                  {/* Paciente */}
                  <td className="py-3 px-4 font-bold text-slate-900">
                    {d.pacienteNome}
                  </td>
                  
                  {/* Medicamento */}
                  <td className="py-3 px-4">
                    <div>
                      <p className="font-bold text-slate-950">{d.medicamento}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{d.dosagem}</p>
                    </div>
                  </td>

                  {/* Prescrito */}
                  <td className="py-3 px-4 font-mono">
                    {new Date(d.horarioPrevisto).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </td>

                  {/* Checado */}
                  <td className="py-3 px-4 font-mono text-slate-500">
                    {d.horarioExecutado 
                      ? new Date(d.horarioExecutado).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                      : 'N/A'
                    }
                  </td>

                  {/* Responsável */}
                  <td className="py-3 px-4 font-semibold text-slate-500">
                    {d.profissionalNome}
                  </td>

                  {/* Status Desvio */}
                  <td className="py-3 px-4">
                    <span className={`text-[9px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded border ${
                      d.tipoDesvio === 'Conforme'
                        ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20'
                        : d.tipoDesvio === 'Atraso'
                          ? 'bg-amber-500/10 text-amber-700 border-amber-500/20'
                          : 'bg-red-500/10 text-red-700 border-red-500/20'
                    }`}>
                      {d.tipoDesvio === 'Omissao_Com_Justificativa' 
                        ? 'Omissão de Dose' 
                        : d.tipoDesvio === 'Pendente_Atrasado'
                          ? 'Pendente Atrasado'
                          : d.tipoDesvio.replace('_', ' ')
                      }
                    </span>
                  </td>

                  {/* Detalhes */}
                  <td className="py-3 px-4 text-slate-500 italic max-w-[200px] truncate" title={d.detalheDesvio}>
                    {d.detalheDesvio}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}
