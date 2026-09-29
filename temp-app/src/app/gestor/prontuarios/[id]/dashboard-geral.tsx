/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React from 'react';
import {
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Activity,
  Layers,
  FileText,
  UserCheck,
  ChevronRight,
  TrendingUp,
  Stethoscope,
  Wrench,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { formatarNomeEspecialidade, PlanoTerapeutico } from '@/lib/tipos-clinicos';

interface DashboardGeralProps {
  paciente: any;
  planoVigente: PlanoTerapeutico | null;
  equipamentos: any[];
  evolucoes: any[];
  prescricoes: any[];
  onIrParaPlano: () => void;
  onIrParaProntuario: () => void;
}

export default function DashboardGeral({
  paciente,
  planoVigente,
  equipamentos,
  evolucoes,
  prescricoes,
  onIrParaPlano,
  onIrParaProntuario,
}: DashboardGeralProps) {
  const pendencias = planoVigente?.pendencias_alertas || [];
  const totalPrevisto = planoVigente?.total_previsto || 0;
  const totalRealizado = planoVigente?.total_realizado || 0;
  const percentualTotal = totalPrevisto > 0 ? Math.min(100, Math.round((totalRealizado / totalPrevisto) * 100)) : 0;

  return (
    <div className="space-y-6">
      {/* 1. Alerta de Pendência Crítica ("A Menos") */}
      {pendencias.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-l-4 border-amber-500 p-4 rounded-r-2xl bg-amber-50/50">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-100 text-amber-800 rounded-xl shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-amber-950 flex items-center gap-2">
                  <span>Alerta de Atendimentos Pendentes no Plano Terapêutico</span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900">
                    {pendencias.length} pendência{pendencias.length > 1 ? 's' : ''}
                  </span>
                </h4>
                <button
                  onClick={onIrParaPlano}
                  className="text-xs font-bold text-amber-800 hover:text-amber-950 underline flex items-center gap-1"
                >
                  Ver no Plano <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-xs text-amber-800/90 mt-1">
                O período deste plano está em andamento ou próximo do fim e constam visitas contratadas que ainda não foram executadas:
              </p>
              <ul className="mt-2 space-y-1">
                {pendencias.map((pen, idx) => (
                  <li key={idx} className="text-xs font-semibold text-amber-950 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                    {pen}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* 2. Grid de KPIs Executivos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Status do Plano */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Plano Terapêutico</span>
            <div className={`p-2 rounded-xl ${planoVigente ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-extrabold text-slate-900">
            {planoVigente ? `${totalRealizado} / ${totalPrevisto}` : 'Sem Plano Ativo'}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {planoVigente
              ? `Vigência: ${planoVigente.data_inicio} até ${planoVigente.data_fim}`
              : 'Clique em Plano Terapêutico para cadastrar.'}
          </p>
          {planoVigente && (
            <div className="mt-3 w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  percentualTotal >= 100 ? 'bg-emerald-500' : percentualTotal > 50 ? 'bg-indigo-600' : 'bg-amber-500'
                }`}
                style={{ width: `${percentualTotal}%` }}
              />
            </div>
          )}
        </div>

        {/* KPI 2: Atendimentos Realizados */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total de Evoluções</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-extrabold text-slate-900">{evolucoes.length}</div>
          <p className="text-xs text-slate-500 mt-1">
            Última em: {evolucoes[0]?.check_in ? new Date(evolucoes[0].check_in).toLocaleDateString('pt-BR') : 'Nenhuma'}
          </p>
        </div>

        {/* KPI 3: Prescrições Ativas */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Prescrições Ativas</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-extrabold text-slate-900">
            {prescricoes.filter((p) => p.status === 'Ativa').length}
          </div>
          <p className="text-xs text-slate-500 mt-1">Medicamentos em uso monitorado</p>
        </div>

        {/* KPI 4: Equipamentos Instalados */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Equipamentos no Domicílio</span>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <Wrench className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-extrabold text-slate-900">{equipamentos.length}</div>
          <p className="text-xs text-slate-500 mt-1">
            {equipamentos.length > 0 ? 'Equipamentos alocados' : 'Nenhum equipamento vinculado'}
          </p>
        </div>
      </div>

      {/* 3. Metas do Plano Terapêutico Vigente com Barras de Progresso e Cooperados Escalados */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Stethoscope className="w-5 h-5 text-indigo-600" />
              Metas por Especialidade no Plano Terapêutico Vigente
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Acompanhamento de visitas executadas vs. contratadas e profissionais autorizados.
            </p>
          </div>
          <button
            onClick={onIrParaPlano}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl transition-all"
          >
            Gerenciar Plano Terapêutico
          </button>
        </div>

        {planoVigente && planoVigente.metas && planoVigente.metas.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {planoVigente.metas.map((meta, idx) => {
              const realizadas = meta.quantidade_realizada || 0;
              const previstas = meta.quantidade_prevista;
              const restantes = meta.quantidade_restante || 0;
              const pct = previstas > 0 ? Math.min(100, Math.round((realizadas / previstas) * 100)) : 0;
              const esgotada = realizadas >= previstas;

              return (
                <div
                  key={idx}
                  className={`p-4 rounded-xl border transition-all ${
                    esgotada
                      ? 'border-emerald-200 bg-emerald-50/30'
                      : meta.status_meta === 'Pendente'
                      ? 'border-amber-200 bg-amber-50/20'
                      : 'border-slate-200 bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">
                        {formatarNomeEspecialidade(meta.especialidade)}
                      </h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-slate-600 font-medium">
                          {realizadas} de {previstas} realizada(s)
                        </span>
                        {esgotada ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md">
                            Concluído
                          </span>
                        ) : meta.status_meta === 'Pendente' ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md">
                            ⚠️ Pendente
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-md">
                            {restantes} resta{restantes > 1 ? 'm' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs font-extrabold text-slate-700">{pct}%</span>
                  </div>

                  {/* Barra de Progresso */}
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden mb-3">
                    <div
                      className={`h-full transition-all duration-500 ${
                        esgotada ? 'bg-emerald-500' : pct > 50 ? 'bg-indigo-600' : 'bg-amber-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  {/* Cooperados Designados para essa Especialidade */}
                  <div className="pt-2 border-t border-slate-200/60">
                    <span className="text-[11px] font-bold text-slate-500 block mb-1 flex items-center gap-1">
                      <UserCheck className="w-3 h-3 text-slate-400" />
                      Cooperados Escalados:
                    </span>
                    {meta.profissionais_designados && meta.profissionais_designados.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {meta.profissionais_designados.map((prof, pIdx) => (
                          <span
                            key={pIdx}
                            className="bg-white border border-slate-200 text-slate-800 px-2 py-0.5 rounded-md text-[11px] font-medium"
                          >
                            {prof.nome}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">Qualquer cooperado da especialidade</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <Calendar className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700">Nenhum plano terapêutico ativo para este paciente.</p>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              Defina a vigência e as cotas de atendimentos por especialidade para habilitar os bloqueios e controles.
            </p>
            <button
              onClick={onIrParaPlano}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-sm"
            >
              Criar Plano Terapêutico
            </button>
          </div>
        )}
      </div>

      {/* 4. Grid Inferior: Equipamentos no Domicílio e Últimos Atendimentos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bloco 1: Equipamentos no Domicílio */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Wrench className="w-4 h-4 text-purple-600" />
              Equipamentos Instalados no Domicílio ({equipamentos.length})
            </h3>
          </div>

          {equipamentos.length > 0 ? (
            <div className="space-y-3">
              {equipamentos.map((eq, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between"
                >
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">{eq.nome}</h4>
                    <p className="text-[11px] text-slate-500">
                      Série: <span className="font-mono">{eq.numero_serie}</span> | Categoria: {eq.categoria}
                    </p>
                    {eq.data_inicio && (
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Instalado em: {new Date(eq.data_inicio).toLocaleDateString('pt-BR')}
                      </p>
                    )}
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    {eq.status_locacao || 'Ativo'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500">
              Nenhum equipamento hospitalar locado atualmente para este paciente.
            </div>
          )}
        </div>

        {/* Bloco 2: Últimos Atendimentos / Evoluções */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-600" />
              Atendimentos Recentes ({evolucoes.length})
            </h3>
            <button
              onClick={onIrParaProntuario}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
            >
              Ver Todos
            </button>
          </div>

          {evolucoes.length > 0 ? (
            <div className="space-y-4">
              {evolucoes.slice(0, 3).map((ev, idx) => (
                <div
                  key={idx}
                  className="p-4 bg-slate-50 rounded-xl border border-slate-200 transition-all space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">
                          {ev.profissional_nome || 'Profissional Cooperado'}
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded">
                          {formatarNomeEspecialidade(ev.tipo_profissional)}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {ev.check_in ? new Date(ev.check_in).toLocaleString('pt-BR') : 'Horário não registrado'}
                      </p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-md shrink-0">
                      {ev.status || 'Concluído'}
                    </span>
                  </div>

                  {/* Relato Clínico / SOAP detalhado para o primeiro atendimento */}
                  {idx === 0 && (
                    <div className="space-y-2 pt-2 border-t border-slate-200/70 text-xs">
                      {ev.soap_objetivo || ev.transcricao_revisada ? (
                        <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-slate-800">
                          <span className="text-[10px] font-bold text-emerald-700 block mb-0.5">Exame & Conduta Clínica:</span>
                          <p>{ev.soap_objetivo || ev.transcricao_revisada}</p>
                        </div>
                      ) : null}

                      {/* Selo Digital Criptográfico de Assinatura */}
                      <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span className="font-bold text-emerald-950">Assinado Digitalmente pelo Profissional</span>
                        </div>
                        {ev.assinatura_digital && (
                          <span className="font-mono text-[10px] text-emerald-800 bg-white px-2 py-0.5 rounded border border-emerald-200 truncate max-w-xs">
                            {ev.assinatura_digital}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {idx > 0 && (
                    <p className="text-[11px] text-slate-600 line-clamp-2">
                      {ev.soap_objetivo || ev.transcricao_revisada || 'Evolução clínica registrada.'}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500">
              Nenhuma evolução clínica registrada ainda.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
