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
          className="bg-surface border border-line hover:border-line-strong p-2 rounded-lg text-ink-body hover:text-ink transition-all shadow-card"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-lg font-strong text-ink leading-tight">Reconciliação e Auditoria de Aprazamento</h1>
          <p className="text-xs text-muted mt-0.5">Cruzamento de prescrição médica vs. administração real.</p>
        </div>
      </div>

      {/* Grid Métricas de Reconciliação */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-surface border border-line rounded-xl p-4 shadow-card flex flex-col gap-1">
          <span className="text-[10px] uppercase font-strong text-muted tracking-wider">Índice de Pontualidade</span>
          <span className="text-2xl font-heavy text-ink">{complianceScore}%</span>
          <span className="text-[10px] text-muted mt-1">Doses aplicadas no horário</span>
        </div>

        <div className="bg-surface border border-line rounded-xl p-4 shadow-card flex flex-col gap-1">
          <span className="text-[10px] uppercase font-strong text-muted tracking-wider">Atrasos de Dose (&gt; 1h)</span>
          <span className="text-2xl font-heavy text-warn-ink">{countAtrasos}</span>
          <span className="text-[10px] text-muted mt-1">Doses aplicadas fora do prazo</span>
        </div>

        <div className="bg-surface border border-line rounded-xl p-4 shadow-card flex flex-col gap-1">
          <span className="text-[10px] uppercase font-strong text-muted tracking-wider">Omissões Justificadas</span>
          <span className="text-2xl font-heavy text-crit-ink">{countOmissoes}</span>
          <span className="text-[10px] text-muted mt-1">Remédios não aplicados com justificativa</span>
        </div>

        <div className="bg-surface border border-line rounded-xl p-4 shadow-card flex flex-col gap-1">
          <span className="text-[10px] uppercase font-strong text-muted tracking-wider">Pendente Atrasado</span>
          <span className="text-2xl font-heavy text-crit-ink animate-pulse">{countPendenteAtrasado}</span>
          <span className="text-[10px] text-muted mt-1">Passou do horário sem checar</span>
        </div>

        <div className="bg-surface border border-line rounded-xl p-4 shadow-card flex flex-col gap-1">
          <span className="text-[10px] uppercase font-strong text-muted tracking-wider">Total Aprazamentos</span>
          <span className="text-2xl font-heavy text-ink">{total}</span>
          <span className="text-[10px] text-muted mt-1">Checagens monitoradas hoje</span>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-surface border border-line rounded-xl p-4 shadow-card flex flex-wrap gap-4 items-end">
        {/* Pesquisa */}
        <div className="flex-1 w-full sm:min-w-[200px] flex flex-col gap-1.5">
          <label htmlFor="auditoriaPesquisa" className="text-[10px] font-strong uppercase text-muted tracking-wider flex items-center gap-1">
            <Search className="w-3.5 h-3.5" aria-hidden="true" />
            Pesquisa
          </label>
          <input
            id="auditoriaPesquisa"
            type="text"
            placeholder="Buscar por Paciente, Medicamento ou Técnico..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border border-line rounded-lg p-2 text-xs text-ink-body focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 focus-visible:ring-offset-surface focus:border-line-strong w-full"
          />
        </div>

        {/* Tipo Desvio */}
        <div className="w-full sm:w-[200px] flex flex-col gap-1.5">
          <label htmlFor="auditoriaFiltroDesvio" className="text-[10px] font-strong uppercase text-muted tracking-wider flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" aria-hidden="true" />
            Filtrar Inconformidades
          </label>
          <select
            id="auditoriaFiltroDesvio"
            value={filterDesvio}
            onChange={(e) => setFilterDesvio(e.target.value)}
            className="border border-line bg-surface rounded-lg p-2 text-xs text-ink-body focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 focus-visible:ring-offset-surface focus:border-line-strong"
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
          className="bg-accent-soft hover:bg-accent-line text-accent-soft-ink border border-accent-line p-2 rounded-lg text-xs font-strong flex items-center gap-1 transition-all active:scale-[0.98]"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Atualizar Painel
        </button>
      </div>

      {/* Grid de Discrepâncias */}
      <div className="bg-surface border border-line rounded-xl shadow-card overflow-hidden">
        {loading ? (
          <div className="text-center py-10 text-xs font-strong text-muted">Recalculando reconciliação...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-xs font-strong text-muted">Nenhum desvio ou reconciliação registrada.</div>
        ) : (
          // Rolagem contida na tabela; sem isso a página inteira rola lateralmente no celular.
          <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left border-collapse">
            <thead>
              <tr className="bg-canvas border-b border-line-soft text-[10px] font-heavy uppercase tracking-wider text-muted">
                <th className="py-3 px-4">Paciente</th>
                <th className="py-3 px-4">Medicamento / Dose</th>
                <th className="py-3 px-4">Horário Prescrito</th>
                <th className="py-3 px-4">Horário Checado</th>
                <th className="py-3 px-4">Responsável Técnico</th>
                <th className="py-3 px-4">Status Desvio</th>
                <th className="py-3 px-4">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft text-xs text-ink-body">
              {filtered.map((d) => (
                <tr key={d.id} className="hover:bg-surface-hover">
                  {/* Paciente */}
                  <td className="py-3 px-4 font-strong text-ink">
                    {d.pacienteNome}
                  </td>
                  
                  {/* Medicamento */}
                  <td className="py-3 px-4">
                    <div>
                      <p className="font-strong text-ink">{d.medicamento}</p>
                      <p className="text-[10px] text-muted mt-0.5">{d.dosagem}</p>
                    </div>
                  </td>

                  {/* Prescrito */}
                  <td className="py-3 px-4 font-mono">
                    {new Date(d.horarioPrevisto).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </td>

                  {/* Checado */}
                  <td className="py-3 px-4 font-mono text-muted">
                    {d.horarioExecutado 
                      ? new Date(d.horarioExecutado).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                      : 'N/A'
                    }
                  </td>

                  {/* Responsável */}
                  <td className="py-3 px-4 font-semibold text-muted">
                    {d.profissionalNome}
                  </td>

                  {/* Status Desvio */}
                  <td className="py-3 px-4">
                    <span className={`text-[9px] uppercase tracking-wider font-heavy px-2 py-0.5 rounded border ${
                      d.tipoDesvio === 'Conforme'
                        ? 'bg-pos-soft text-pos-ink border-pos-line'
                        : d.tipoDesvio === 'Atraso'
                          ? 'bg-warn-soft text-warn-ink border-warn-line'
                          : 'bg-crit-soft text-crit-ink border-crit-line'
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
                  <td className="py-3 px-4 text-muted italic max-w-[200px] truncate" title={d.detalheDesvio}>
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
