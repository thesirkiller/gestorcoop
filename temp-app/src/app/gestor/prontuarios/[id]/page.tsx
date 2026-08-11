/* eslint-disable */
'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import axios from 'axios';
import {
  FileText, ArrowLeft, Calendar, Clock, User, ShieldCheck, Pill, CheckCircle, AlertOctagon, Headphones
} from 'lucide-react';
import Link from 'next/link';

interface EvolutionDetails {
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
  audio_url?: string;
  transcricao_crua?: string;
  transcricao_revisada?: string;
  status: string;
  data_assinatura?: string;
  aprazamentos?: any[];
}

export default function ProntuarioDetalheGestor() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [ev, setEv] = useState<EvolutionDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDetalhes();
  }, [id]);

  const fetchDetalhes = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get('/api/gestor/prontuarios');
      if (response.data.success) {
        // Encontra o item correspondente nos resultados (inclui mocks se local)
        const item = response.data.results.find((r: any) => r.id === id);
        if (item) {
          setEv(item);
        } else {
          setError('Registro de prontuário não encontrado.');
        }
      }
    } catch (e: any) {
      console.error(e);
      setError('Erro ao carregar dados do prontuário do servidor.');
    } finally {
      setLoading(false);
    }
  };

  const getDurationMin = () => {
    if (!ev?.check_in || !ev?.check_out) return 0;
    return Math.round((new Date(ev.check_out).getTime() - new Date(ev.check_in).getTime()) / 60000);
  };

  const specialtyLabels: Record<string, string> = {
    Tecnico_Enfermagem: 'Técnico de Enfermagem',
    Medico: 'Médico',
    Terapeuta: 'Terapeuta'
  };

  if (loading) {
    return <div className="text-center py-10 text-xs font-bold text-slate-500">Buscando prontuário...</div>;
  }

  if (error || !ev) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center max-w-md mx-auto mt-10">
        <AlertOctagon className="w-10 h-10 text-red-500 mx-auto mb-3" />
        <p className="font-bold text-slate-900">{error || 'Prontuário inválido'}</p>
        <button
          onClick={() => router.push('/gestor/prontuarios')}
          className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2 px-4 rounded-lg transition-all"
        >
          Voltar ao Painel
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Botão voltar */}
      <div className="flex items-center gap-3">
        <Link
          href="/gestor/prontuarios"
          className="bg-white border border-slate-200 hover:border-slate-300 p-2 rounded-lg text-slate-600 hover:text-slate-900 transition-all shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-slate-900 leading-tight">Auditoria Clínica - Prontuário #{ev.id}</h1>
          <p className="text-xs text-slate-500 mt-0.5">Evolução e registros de medicação correspondentes.</p>
        </div>
      </div>

      {/* Grid Principal */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Coluna Dados Paciente & Profissional */}
        <div className="md:col-span-1 space-y-6">
          {/* Ficha Paciente */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Identificação do Paciente</h3>
            <div className="space-y-2.5 text-xs text-slate-700">
              <div>
                <p className="text-slate-400">Nome:</p>
                <p className="font-extrabold text-slate-950 text-sm mt-0.5">{ev.paciente_nome}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <p className="text-slate-400">CPF:</p>
                  <p className="font-bold text-slate-900">{ev.paciente_cpf}</p>
                </div>
                <div>
                  <p className="text-slate-400">ID Bubble:</p>
                  <p className="font-mono text-[10px] text-slate-900">{ev.paciente_id}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Ficha Atendimento */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Metadados da Visita</h3>
            <div className="space-y-3 text-xs text-slate-700">
              <div className="flex justify-between items-center py-1.5 border-b border-slate-50">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <User className="w-4 h-4 text-slate-400" />
                  Profissional:
                </span>
                <span className="font-bold text-slate-900">{ev.profissional_nome || 'Dra. Ana Silva'}</span>
              </div>

              <div className="flex justify-between items-center py-1.5 border-b border-slate-50">
                <span className="text-slate-400">Especialidade:</span>
                <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-[10px]">
                  {specialtyLabels[ev.tipo_profissional]}
                </span>
              </div>

              {ev.turno && (
                <div className="flex justify-between items-center py-1.5 border-b border-slate-50">
                  <span className="text-slate-400">Turno Técnico:</span>
                  <span className="font-bold text-slate-900">{ev.turno}</span>
                </div>
              )}

              <div className="flex justify-between items-center py-1.5 border-b border-slate-50">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  Data de Execução:
                </span>
                <span className="font-bold text-slate-900">{new Date(ev.check_in).toLocaleDateString('pt-BR')}</span>
              </div>

              <div className="flex justify-between items-center py-1.5 border-b border-slate-50">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-slate-400" />
                  Entrada (Check-in):
                </span>
                <span className="font-mono text-slate-900">
                  {new Date(ev.check_in).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              <div className="flex justify-between items-center py-1.5 border-b border-slate-50">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-slate-400" />
                  Saída (Check-out):
                </span>
                <span className="font-mono text-slate-900">
                  {ev.check_out ? new Date(ev.check_out).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'Em andamento'}
                </span>
              </div>

              <div className="flex justify-between items-center py-1.5">
                <span className="text-slate-400">Duração Total:</span>
                <span className="font-bold font-mono text-indigo-700 text-sm">{getDurationMin()} minutos</span>
              </div>
            </div>
          </div>
        </div>

        {/* Coluna Evolução Clínca & Audio */}
        <div className="md:col-span-2 space-y-6">
          {/* Evolução e Áudio */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-indigo-600" />
                Relato da Evolução Clínica
              </h3>
              <span className="bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Assinado Eletronicamente
              </span>
            </div>

            {/* Reprodutor de Áudio se houver */}
            {ev.audio_url && (
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center shrink-0">
                    <Headphones className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900">Áudio Gravação original</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Capturado em campo pelo profissional</p>
                  </div>
                </div>
                {/* Audio Element */}
                <audio src={ev.audio_url} controls className="h-8 max-w-[200px]" />
              </div>
            )}

            {/* Texto Transcrição */}
            <div className="space-y-4 text-xs">
              <div className="flex flex-col gap-1">
                <span className="font-bold text-slate-500 uppercase text-[9px] tracking-wider">Evolução Clínica Formatada (Revisada)</span>
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 text-slate-800 leading-relaxed font-sans whitespace-pre-line">
                  {ev.transcricao_revisada || 'Nenhum texto de evolução salvo.'}
                </div>
              </div>

              {ev.transcricao_crua && (
                <div className="flex flex-col gap-1 pt-2 border-t border-slate-100">
                  <span className="font-bold text-slate-400 uppercase text-[9px] tracking-wider">Transcrição Crua Original (Whisper)</span>
                  <p className="text-slate-500 italic leading-relaxed whitespace-pre-line bg-slate-50/50 border border-slate-200/40 p-3 rounded-lg">
                    "{ev.transcricao_crua}"
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Checagem de Enfermagem se aplicável */}
          {ev.tipo_profissional === 'Tecnico_Enfermagem' && ev.aprazamentos && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Pill className="w-4 h-4 text-indigo-600" />
                Checagem Digital de Medicamentos (Turno)
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-[10px] uppercase font-bold text-slate-500">
                      <th className="py-2 pb-3">Horário Previsto</th>
                      <th className="py-2 pb-3">Medicamento / Dose</th>
                      <th className="py-2 pb-3">Status Checagem</th>
                      <th className="py-2 pb-3">Executado Em</th>
                      <th className="py-2 pb-3">Assinatura Técnico</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {ev.aprazamentos.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-4 text-slate-400">Nenhum medicamento checado neste turno.</td>
                      </tr>
                    ) : (
                      ev.aprazamentos.map((a: any) => (
                        <tr key={a.id} className="text-slate-700">
                          {/* Horário Previsto */}
                          <td className="py-3 font-mono font-bold text-slate-900">
                            {new Date(a.horario_previsto).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          
                          {/* Medicamento */}
                          <td className="py-3">
                            <div>
                              <p className="font-bold text-slate-950">{a.medicamento}</p>
                              <p className="text-[10px] text-slate-500 mt-0.5">{a.dosagem} ({a.via_administracao})</p>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="py-3">
                            <span className={`text-[9px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded border ${
                              a.status === 'Administrado'
                                ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20'
                                : 'bg-red-500/10 text-red-700 border-red-500/20'
                            }`}>
                              {a.status === 'Administrado' ? 'Administrado' : 'Não Administrado'}
                            </span>
                            {a.justificativa && (
                              <p className="text-[10px] text-red-700 italic mt-1 max-w-[200px] truncate" title={a.justificativa}>
                                Justif.: {a.justificativa}
                              </p>
                            )}
                          </td>

                          {/* Executado Em */}
                          <td className="py-3 font-mono text-slate-500">
                            {a.horario_executado ? new Date(a.horario_executado).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                          </td>

                          {/* Assinatura */}
                          <td className="py-3 font-mono text-[10px] text-slate-500">
                            {a.assinatura_digital ? (
                              <span className="text-emerald-700 font-bold flex items-center gap-1">
                                <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                Validada
                              </span>
                            ) : (
                              'N/A'
                            )}
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

      </div>
    </div>
  );
}
