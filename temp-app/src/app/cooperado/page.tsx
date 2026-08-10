/* eslint-disable */
'use client';

import React, { useState, useEffect } from 'react';
import { localDB, PacienteLocal, PrescricaoLocal, AprazamentoLocal } from '@/lib/indexeddb';
import { subscribeToSync } from '@/lib/sync-service';
import { MapPin, User, FileText, ChevronRight, RefreshCw, AlertCircle, Clock } from 'lucide-react';
import Link from 'next/link';
import axios from 'axios';

interface Visit {
  pacienteId: string;
  pacienteNome: string;
  horario: string;
  status: 'Pendente' | 'Em_Andamento' | 'Concluído';
  endereco: string;
  cpf: string;
  dataNascimento: string;
}

export default function CooperadoDashboard() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [isOnline, setIsOnline] = useState(true);
  const [loading, setLoading] = useState(false);
  const [prefetechedAt, setPrefetchedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Monitorar rede
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const unsubscribe = subscribeToSync((status) => {
      setIsOnline(status.isOnline);
    });
    return () => unsubscribe();
  }, []);

  // Carregar dados iniciais do IndexedDB local
  useEffect(() => {
    loadLocalData();
  }, []);

  const loadLocalData = async () => {
    try {
      const pacientes = await localDB.getPacientes();
      if (pacientes.length > 0) {
        // Mapeia os pacientes locais para a lista de visitas
        const mappedVisits: Visit[] = await Promise.all(
          pacientes.map(async (p, idx) => {
            // Busca evolucoes locais para determinar status
            const evolucoes = await localDB.getEvolucoes();
            const ev = evolucoes.find(e => e.paciente_id === p.id);
            let status: Visit['status'] = 'Pendente';
            if (ev) {
              status = ev.status === 'Finalizado' ? 'Concluído' : 'Em_Andamento';
            }
            
            // Simula horários espaçados para a agenda
            const horas = ['08:00', '13:00', '16:00', '20:00'];
            const horario = horas[idx % horas.length];

            return {
              pacienteId: p.id,
              pacienteNome: p.nome,
              horario,
              status,
              endereco: p.endereco || 'Domicílio cadastrado',
              cpf: p.cpf || '***.***.***-**',
              dataNascimento: p.data_nascimento || '01/01/1970'
            };
          })
        );
        setVisits(mappedVisits);
        
        const lastPrefetch = window.localStorage.getItem('gc_last_prefetch');
        if (lastPrefetch) {
          setPrefetchedAt(new Date(lastPrefetch).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
        }
      }
    } catch (e) {
      console.error('Erro ao ler banco local:', e);
      setError('Falha ao carregar banco de dados local offline.');
    }
  };

  // Prefetch dos dados: busca da API e atualiza IndexedDB local
  const handlePrefetch = async () => {
    if (!isOnline) return;
    setLoading(true);
    setError(null);
    try {
      console.log('Prefetching diário dos dados...');
      // Sem `?cooperadoId=`: o servidor resolve o profissional pelo cookie de
      // sessão. Mandar o id daqui não adiantava nada além de permitir trocá-lo
      // e enxergar a agenda de outro profissional.
      const response = await axios.get('/api/cooperado/agenda');
      const { pacientes, prescricoes, aprazamentos } = response.data;

      // Salvar localmente
      await localDB.savePacientes(pacientes);
      await localDB.savePrescricoes(prescricoes);
      await localDB.saveAprazamentos(aprazamentos);

      // Registrar timestamp
      const now = new Date().toISOString();
      window.localStorage.setItem('gc_last_prefetch', now);
      setPrefetchedAt(new Date(now).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));

      // Recarregar UI do IndexedDB
      await loadLocalData();
    } catch (err: any) {
      console.error('Erro no prefetch:', err);
      setError('Erro ao baixar a agenda da nuvem. Verifique sua conexão.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Prefetch & Update Section */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-3 shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Carga de Dados Diária</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {prefetechedAt ? `Última atualização: hoje às ${prefetechedAt}` : 'Nenhuma carga feita hoje'}
            </p>
          </div>

          <button
            onClick={handlePrefetch}
            disabled={!isOnline || loading}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border transition-all active:scale-95 ${
              isOnline && !loading
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'
                : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Carregar Agenda
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 text-red-700 text-xs p-2.5 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!prefetechedAt && isOnline && !loading && (
          <div className="bg-indigo-50/50 border border-indigo-100 text-indigo-700 text-[11px] p-2.5 rounded-lg">
            🔔 **Atenção:** Baixe a agenda do dia antes de ir a campo para ter acesso a todos os prontuários e medicamentos offline.
          </div>
        )}
      </div>

      {/* Lista de Atendimentos */}
      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">Atendimentos de Hoje</h3>
        
        {visits.length === 0 ? (
          <div className="bg-white border border-slate-200 border-dashed rounded-xl p-8 text-center text-slate-500">
            <Clock className="w-10 h-10 text-slate-350 mx-auto mb-2.5" />
            <p className="text-sm font-bold text-slate-800">Nenhum atendimento carregado</p>
            <p className="text-xs text-slate-500 mt-1">Conecte-se à internet e clique em "Carregar Agenda" para baixar a sua escala.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {visits.map((visit) => (
              <Link
                key={visit.pacienteId}
                href={`/cooperado/prontuario/${visit.pacienteId}`}
                className="bg-white border border-slate-200 rounded-xl p-4 flex justify-between items-center hover:border-slate-300 transition-all shadow-sm active:bg-slate-50"
              >
                <div className="flex flex-col gap-1.5 flex-1 min-w-0 pr-3">
                  {/* Paciente e Horário */}
                  <div className="flex items-center gap-2">
                    <span className="bg-slate-100 text-slate-700 text-[10px] font-black px-2 py-0.5 rounded-md">
                      {visit.horario}
                    </span>
                    <h4 className="font-bold text-slate-900 truncate text-sm">
                      {visit.pacienteNome}
                    </h4>
                  </div>

                  {/* Endereço */}
                  <div className="flex items-center gap-1 text-slate-500 text-xs">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{visit.endereco}</span>
                  </div>
                </div>

                {/* Status & Direção */}
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] uppercase tracking-wider font-extrabold px-2.5 py-0.5 rounded-full border ${
                    visit.status === 'Concluído'
                      ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20'
                      : visit.status === 'Em_Andamento'
                        ? 'bg-blue-500/10 text-blue-700 border-blue-500/20'
                        : 'bg-slate-500/10 text-slate-750 border-slate-500/20'
                  }`}>
                    {visit.status === 'Em_Andamento' ? 'Em andamento' : visit.status.toLowerCase()}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
