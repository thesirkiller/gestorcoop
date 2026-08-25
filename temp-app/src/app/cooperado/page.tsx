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
      } else {
        // Banco local vazio: busca automaticamente da API
        handlePrefetch();
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
      <div className="bg-surface border border-line rounded-xl p-4 flex flex-col gap-3 shadow-card">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xs font-strong text-muted uppercase tracking-wider">Carga de Dados Diária</h2>
            <p className="text-xs text-muted mt-0.5">
              {prefetechedAt ? `Última atualização: hoje às ${prefetechedAt}` : 'Nenhuma carga feita hoje'}
            </p>
          </div>

          <button
            onClick={handlePrefetch}
            disabled={!isOnline || loading}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-strong rounded-lg border transition-all active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
              isOnline && !loading
                ? 'bg-accent-soft border-accent-line text-accent-soft-ink hover:bg-accent-line'
                : 'bg-disabled border-line text-disabled-ink cursor-not-allowed'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Carregar Agenda
          </button>
        </div>

        {error && (
          <div className="bg-crit-soft border border-crit-line text-crit-ink text-xs p-2.5 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!prefetechedAt && isOnline && !loading && (
          <div className="bg-accent-soft border border-accent-line text-accent-soft-ink text-[11px] p-2.5 rounded-lg">
            🔔 <strong className="font-semibold">Atenção:</strong> Baixe a agenda do dia antes de ir a campo para ter acesso a todos os prontuários e medicamentos offline.
          </div>
        )}
      </div>

      {/* Lista de Atendimentos */}
      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-strong text-muted uppercase tracking-wider px-1">Atendimentos de Hoje</h3>

        {visits.length === 0 ? (
          <div className="bg-surface border border-line border-dashed rounded-xl p-8 text-center text-muted">
            <Clock className="w-10 h-10 text-faint mx-auto mb-2.5" aria-hidden="true" />
            <p className="text-sm font-strong text-ink">Nenhum atendimento carregado</p>
            <p className="text-xs text-muted mt-1">Conecte-se à internet e clique em "Carregar Agenda" para baixar a sua escala.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {visits.map((visit) => (
              <Link
                key={visit.pacienteId}
                href={`/cooperado/prontuario/${visit.pacienteId}`}
                className="bg-surface border border-line rounded-xl p-4 flex justify-between items-center hover:border-line-strong transition-all shadow-card active:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                <div className="flex flex-col gap-1.5 flex-1 min-w-0 pr-3">
                  {/* Paciente e Horário */}
                  <div className="flex items-center gap-2">
                    <span className="bg-chip text-ink-body text-[10px] font-heavy px-2 py-0.5 rounded-md">
                      {visit.horario}
                    </span>
                    <h4 className="font-strong text-ink truncate text-sm">
                      {visit.pacienteNome}
                    </h4>
                  </div>

                  {/* Endereço */}
                  <div className="flex items-center gap-1 text-muted text-xs">
                    <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">{visit.endereco}</span>
                  </div>
                </div>

                {/* Status & Direção */}
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] uppercase tracking-wider font-heavy px-2.5 py-0.5 rounded-full border ${
                    visit.status === 'Concluído'
                      ? 'bg-pos-soft text-pos-ink border-pos-line'
                      : visit.status === 'Em_Andamento'
                        ? 'bg-info-soft text-info-ink border-info-line'
                        : 'bg-idle-soft text-idle-ink border-idle-line'
                  }`}>
                    {visit.status === 'Em_Andamento' ? 'Em andamento' : visit.status.toLowerCase()}
                  </span>
                  <ChevronRight className="w-4 h-4 text-muted" aria-hidden="true" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
