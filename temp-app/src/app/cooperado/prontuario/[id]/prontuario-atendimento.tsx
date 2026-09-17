/* eslint-disable */
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { localDB, PacienteLocal, PrescricaoLocal, AprazamentoLocal, EvolucaoLocal } from '@/lib/indexeddb';
import { AudioRecorder } from '@/lib/audio-recorder';
import { subscribeToSync } from '@/lib/sync-service';
import {
  User, Check, X, Play, Square, Mic, Volume2, Clock, AlertTriangle, AlertCircle, FileText, CheckSquare, Pill, ChevronDown, Lock, RotateCw
} from 'lucide-react';
import axios from 'axios';

/**
 * Onda sonora, isolada de propósito.
 *
 * O `onWaveformUpdate` do gravador roda dentro de um requestAnimationFrame, ou
 * seja ~60x por segundo. Enquanto esse estado morava no componente de página,
 * cada quadro de áudio re-renderizava a tela INTEIRA durante toda a gravação:
 * cartão do paciente, alertas de alergia, a lista completa de aprazamentos, o
 * textarea da evolução e os modais. Num Android mediano, em campo, isso é a
 * diferença entre gravar e travar.
 *
 * Aqui o estado nasce e morre dentro destas 16 barrinhas: o pai não re-renderiza
 * mais nenhuma vez por causa do áudio.
 */
const OndaSonora = React.memo(function OndaSonora({
  recorder,
  pausado,
}: {
  recorder: AudioRecorder;
  pausado: boolean;
}) {
  const [barras, setBarras] = useState<number[]>(() => new Array(16).fill(0.1));

  useEffect(() => {
    recorder.onWaveformUpdate = (waveData) => {
      setBarras(waveData.slice(0, 16).map((val) => Math.max(0.1, val)));
    };
    return () => {
      recorder.onWaveformUpdate = null;
    };
  }, [recorder]);

  return (
    <div className="flex items-center justify-center gap-1.5 h-10 w-full px-4" aria-hidden="true">
      {barras.map((h, i) => (
        <div
          key={i}
          style={{ height: `${h * 100}%` }}
          className={`w-1.5 rounded-full bg-accent transition-all duration-75 ${pausado ? 'opacity-40 animate-none' : 'animate-pulse'}`}
        />
      ))}
    </div>
  );
});

/**
 * Cronômetro da sessão, isolado pelo mesmo motivo: o tick de 1 em 1 segundo
 * re-renderizava a página toda enquanto o atendimento estivesse aberto — o que
 * pode ser um plantão inteiro.
 */
const TempoDeSessao = React.memo(function TempoDeSessao({
  inicioMs,
  congeladoEm,
}: {
  inicioMs: number | null;
  congeladoEm: number | null;
}) {
  const [segundos, setSegundos] = useState(0);

  useEffect(() => {
    if (inicioMs === null) return;
    if (congeladoEm !== null) {
      setSegundos(Math.max(0, Math.round((congeladoEm - inicioMs) / 1000)));
      return;
    }
    const calcular = () => setSegundos(Math.max(0, Math.round((Date.now() - inicioMs) / 1000)));
    calcular();
    const id = setInterval(calcular, 1000);
    return () => clearInterval(id);
  }, [inicioMs, congeladoEm]);

  const h = Math.floor(segundos / 3600).toString().padStart(2, '0');
  const m = Math.floor((segundos % 3600) / 60).toString().padStart(2, '0');
  const s = (segundos % 60).toString().padStart(2, '0');

  return (
    <p className="font-mono text-lg font-heavy text-ink tracking-tight mt-0.5">
      {`${h}:${m}:${s}`}
    </p>
  );
});

export default function ProntuarioAtendimento() {
  const params = useParams();
  const router = useRouter();
  const pacienteId = params.id as string;

  // Estados principais
  const [paciente, setPaciente] = useState<PacienteLocal | null>(null);
  const [prescricoes, setPrescricoes] = useState<PrescricaoLocal[]>([]);
  const [aprazamentos, setAprazamentos] = useState<AprazamentoLocal[]>([]);
  const [evolucao, setEvolucao] = useState<EvolucaoLocal | null>(null);
  
  // Controle de estados de sessão
  const [sessionCargo, setSessionCargo] = useState<'Tecnico_Enfermagem' | 'Medico' | 'Terapeuta'>('Tecnico_Enfermagem');
  // Só rotula o registro local até a sincronização; o servidor reconfere pelo cookie.
  const [cooperadoId, setCooperadoId] = useState<string>('');
  const [isOnline, setIsOnline] = useState(true);
  const [checkedIn, setCheckedIn] = useState(false);
  const [checkedOut, setCheckedOut] = useState(false);
  const [showIdentificacaoModal, setShowIdentificacaoModal] = useState(true);
  const [identificado, setIdentificado] = useState(false);
  
  // Turno de Enfermagem (obrigatório para Técnicos)
  const [turno, setTurno] = useState<'Diurno' | 'Noturno' | '24h'>('Diurno');

  // Gravação de Áudio e Transcrição
  const [recorder] = useState(() => new AudioRecorder());
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingPaused, setIsRecordingPaused] = useState(false);
  const [audioRecorded, setAudioRecorded] = useState<boolean>(false);
  const [transcribing, setTranscribing] = useState(false);
  const [transcriptionText, setTranscriptionText] = useState('');
  const [durationSecs, setDurationSecs] = useState(0);
  
  // Módulo de Enfermagem - Checagem
  const [checkingAprazamento, setCheckingAprazamento] = useState<AprazamentoLocal | null>(null);
  const [justificativaTexto, setJustificativaTexto] = useState('');
  const [justificativaMotivo, setJustificativaMotivo] = useState('Paciente recusou');

  // Assinatura e Bloqueio
  const [pinCode, setPinCode] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);


  // Carregar dados na inicialização
  useEffect(() => {
    // 1. Identificar cargo e profissional da sessão. O cache é preenchido pelo
    // layout a partir de /api/cooperado/me; aqui ele serve só para rotular os
    // registros otimistas gravados no IndexedDB antes da sincronização. A
    // atribuição que vale é resolvida no servidor, pelo cookie.
    if (typeof window !== 'undefined') {
      const savedSession = window.localStorage.getItem('cooperado_session');
      if (savedSession) {
        try {
          const s = JSON.parse(savedSession);
          setSessionCargo(s.cargo);
          if (s.id) setCooperadoId(s.id);
        } catch {}
      }
    }

    // 2. Monitorar conectividade
    setIsOnline(navigator.onLine);
    const unsubscribeSync = subscribeToSync((status) => {
      setIsOnline(status.isOnline);
    });

    // 3. Carregar dados do IndexedDB local
    loadLocalDetails();

    return () => {
      unsubscribeSync();
    };
  }, [pacienteId]);

  const loadLocalDetails = async () => {
    try {
      const p = await localDB.getPaciente(pacienteId);
      if (p) {
        setPaciente(p);
      } else {
        // Mock fallback se o prefetch não tiver sido feito
        const mockP: PacienteLocal = {
          id: pacienteId,
          nome: pacienteId === '1' ? 'João da Silva' : pacienteId === '2' ? 'Maria de Oliveira' : 'Paciente Desconhecido',
          cpf: '123.456.789-00',
          data_nascimento: '12/04/1958',
          endereco: 'Rua das Palmeiras, 102 - Centro',
          warnings: ['Alergia a Dipirona e Penicilina', 'Hipertensão Grave']
        };
        await localDB.savePacientes([mockP]);
        setPaciente(mockP);
      }

      // Prescrições e aprazamentos do paciente
      const presList = await localDB.getPrescricoes(pacienteId);
      setPrescricoes(presList);

      const aprazList = await localDB.getAprazamentos();
      // Filtra aprazamentos correspondentes às prescrições do paciente
      const filteredApraz = aprazList.filter(a => presList.some(p => p.id === a.prescricao_id));
      setAprazamentos(filteredApraz);

      // Carrega evolução existente se houver
      const evols = await localDB.getEvolucoes();
      const currentEv = evols.find(e => e.paciente_id === pacienteId);
      if (currentEv) {
        setEvolucao(currentEv);
        setCheckedIn(true);
        setTurno(currentEv.turno || 'Diurno');
        setTranscriptionText(currentEv.transcricao_revisada || '');
        if (currentEv.audio_url || currentEv.transcricao_crua) {
          setAudioRecorded(true);
        }
        if (currentEv.status === 'Finalizado' || currentEv.status === 'Assinado_Pendente_Sync') {
          setIsLocked(true);
          setCheckedOut(true);
        }

      }
    } catch (e) {
      console.error(e);
      setErrorText('Erro ao recuperar dados locais do prontuário.');
    }
  };

  // O cronômetro é derivado da evolução, não replicado em estado: enquanto
  // `check_out` estiver vazio o filho conta sozinho; quando chegar, ele congela.
  const inicioSessaoMs = evolucao?.check_in ? new Date(evolucao.check_in).getTime() : null;
  const fimSessaoMs = evolucao?.check_out ? new Date(evolucao.check_out).getTime() : null;

  // Check-in
  const handleCheckIn = async () => {
    if (!identificado) {
      setErrorText('Confirme a identificação do paciente antes de iniciar o atendimento.');
      return;
    }

    const checkInTime = new Date().toISOString();
    const newEv: EvolucaoLocal = {
      id: `ev_${Date.now()}`,
      paciente_id: pacienteId,
      profissional_id: cooperadoId,
      tipo_profissional: sessionCargo,
      turno: sessionCargo === 'Tecnico_Enfermagem' ? turno : undefined,
      check_in: checkInTime,
      check_out: '',
      status: 'Em_Andamento'
    };

    try {
      await localDB.saveEvolucao(newEv);
      setEvolucao(newEv);
      setCheckedIn(true);
      setErrorText(null);
      
      // Salva ação na fila de sincronização
      await localDB.enqueueAction('CHECK_IN', { pacienteId, checkIn: checkInTime, evolucaoId: newEv.id });
      
    } catch (e) {
      console.error(e);
      setErrorText('Erro ao iniciar atendimento no banco local.');
    }
  };

  // Gravação de Áudio
  const handleStartRecord = async () => {
    try {
      await recorder.start();
      setIsRecording(true);
      setIsRecordingPaused(false);
    } catch (err) {
      console.error(err);
      setErrorText('Não foi possível acessar o microfone.');
    }
  };

  const handlePauseRecord = () => {
    if (isRecording) {
      recorder.pause();
      setIsRecordingPaused(true);
    }
  };

  const handleResumeRecord = () => {
    if (isRecording) {
      recorder.resume();
      setIsRecordingPaused(false);
    }
  };

  const handleStopRecord = async () => {
    setIsRecording(false);
    setIsRecordingPaused(false);
    const { blob, durationSeconds } = await recorder.stop();
    setDurationSecs(durationSeconds);
    
    if (blob.size > 0 && evolucao) {
      setAudioRecorded(true);
      // Salvar áudio localmente no IndexedDB
      await localDB.saveAudio(evolucao.id, blob);
      
      // Tenta transcrever imediatamente se estiver online
      if (isOnline) {
        await transcreverAudio(evolucao.id, blob);
      } else {
        // Enfileira ação de transcrição pendente para quando voltar online
        await localDB.enqueueAction('EVOLUCAO_TEXTO', { evolucaoId: evolucao.id });
        setTranscriptionText('[Áudio salvo offline. Transcrição ocorrerá assim que a conexão for restabelecida.]');
      }
    }
  };

  const transcreverAudio = async (evolucaoId: string, audioBlob: Blob) => {
    setTranscribing(true);
    setErrorText(null);
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, `audio-${evolucaoId}.webm`);
      formData.append('evolucaoId', evolucaoId);
      
      const response = await axios.post('/api/cooperado/transcrever', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      if (response.data.success) {
        setTranscriptionText(response.data.transcricao);
        
        // Atualizar evolução no banco local
        if (evolucao) {
          const updated = {
            ...evolucao,
            transcricao_crua: response.data.transcricaoCrua,
            transcricao_revisada: response.data.transcricao
          };
          await localDB.saveEvolucao(updated);
          setEvolucao(updated);
        }
      } else {
        throw new Error(response.data.error || 'Erro ao processar áudio no servidor.');
      }
    } catch (err: any) {
      console.error(err);
      setErrorText('Erro ao transcrever áudio. Você pode redigir a evolução manualmente.');
      setTranscriptionText('');
    } finally {
      setTranscribing(false);
    }
  };

  // Módulo de Enfermagem: Registrar Checagem de Aprazamento
  const handleCheckMedicação = async (aprazamento: AprazamentoLocal, status: 'Administrado' | 'Nao_Administrado') => {
    setCheckingAprazamento(aprazamento);
    if (status === 'Administrado') {
      // Salvar checagem direto no banco local
      const updatedAprazamentos = aprazamentos.map((a) => {
        if (a.id === aprazamento.id) {
          return {
            ...a,
            status: 'Administrado' as const,
            horario_executado: new Date().toISOString(),
            profissional_id: cooperadoId,
            assinatura_digital: undefined /* selo real e gerado no servidor ao sincronizar */
          };
        }
        return a;
      });
      
      await localDB.saveAprazamentos(updatedAprazamentos);
      setAprazamentos(updatedAprazamentos);
      setCheckingAprazamento(null);
      
      // Enfileirar ação de sincronização
      await localDB.enqueueAction('CHECK_MEDICAMENTO', {
        aprazamentoId: aprazamento.id,
        status: 'Administrado',
        horario_executado: new Date().toISOString(),
        profissional_id: cooperadoId
      });
    }
  };

  const handleJustificarNaoAdministrado = async () => {
    if (!checkingAprazamento) return;

    const updatedAprazamentos = aprazamentos.map((a) => {
      if (a.id === checkingAprazamento.id) {
        return {
          ...a,
          status: 'Nao_Administrado' as const,
          horario_executado: new Date().toISOString(),
          profissional_id: cooperadoId,
          justificativa: `[${justificativaMotivo}] ${justificativaTexto}`
        };
      }
      return a;
    });

    await localDB.saveAprazamentos(updatedAprazamentos);
    setAprazamentos(updatedAprazamentos);
    
    // Enfileirar ação de sincronização
    await localDB.enqueueAction('CHECK_MEDICAMENTO', {
      aprazamentoId: checkingAprazamento.id,
      status: 'Nao_Administrado',
      horario_executado: new Date().toISOString(),
      profissional_id: cooperadoId,
      justificativa: `[${justificativaMotivo}] ${justificativaTexto}`
    });

    setCheckingAprazamento(null);
    setJustificativaTexto('');
  };

  // Assinar e Bloquear Evolução (Check-out automático)
  const handleAssinarProntuario = async () => {
    if (!evolucao) return;
    if (!pinCode) {
      setErrorText('Digite sua senha/PIN de assinatura eletrônica para validar.');
      return;
    }
    
    // Se for técnico de enfermagem, valida se todos os horários do turno foram checados
    if (sessionCargo === 'Tecnico_Enfermagem') {
      const pendentes = aprazamentos.filter(a => a.status === 'Pendente');
      if (pendentes.length > 0) {
        setErrorText(`Atenção: Existem ${pendentes.length} medicamentos pendentes de checagem digital.`);
        return;
      }
    }

    if (!transcriptionText && !audioRecorded) {
      setErrorText('A evolução clínica não pode estar em branco. Grave o áudio ou digite o relato.');
      return;
    }

    setLoading(true);
    setErrorText(null);
    
    const checkOutTime = new Date().toISOString();
    const finalEv: EvolucaoLocal = {
      ...evolucao,
      check_out: checkOutTime,
      transcricao_revisada: transcriptionText,
      status: isOnline ? 'Finalizado' : 'Assinado_Pendente_Sync',
      data_assinatura: checkOutTime
    };

    try {
      await localDB.saveEvolucao(finalEv);
      setEvolucao(finalEv);
      setIsLocked(true);
      setCheckedOut(true);
      
      // Enfileira ação de finalização
      await localDB.enqueueAction('SIGN_EVOLUCAO', {
        evolucaoId: evolucao.id,
        checkOut: checkOutTime,
        transcricao_revisada: transcriptionText,
        pinCode
      });
      
      console.log('Prontuário assinado e finalizado localmente!');
    } catch (e) {
      console.error(e);
      setErrorText('Erro ao salvar assinatura localmente.');
    } finally {
      setLoading(false);
    }
  };

  // Formatar tempo em segundos para HH:MM:SS
  if (!paciente) {
    return <div className="text-center py-10 font-strong text-muted">Buscando prontuário...</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Modal Mandatório de Identificação do Paciente */}
      {showIdentificacaoModal && !identificado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="tituloIdentificacao"
            aria-describedby="descIdentificacao"
            className="bg-raised rounded-2xl border border-line shadow-float p-6 max-w-sm w-full text-center"
          >
            <div className="mx-auto w-12 h-12 bg-warn-soft text-warn-ink rounded-xl flex items-center justify-center mb-4">
              <User className="w-6 h-6" aria-hidden="true" />
            </div>
            <h3 id="tituloIdentificacao" className="text-base font-heavy text-ink mb-2">Identificação de Segurança</h3>
            <p id="descIdentificacao" className="text-xs text-muted mb-5 leading-relaxed">
              Confirme visualmente que você está diante do paciente correto antes de qualquer evolução clínica:
            </p>

            <div className="bg-canvas border border-line-soft rounded-xl p-4 text-left mb-6 text-xs flex flex-col gap-1.5">
              <p className="text-muted">Nome do Paciente:</p>
              <p className="font-heavy text-ink text-sm">{paciente.nome}</p>
              <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-line">
                <div>
                  <p className="text-muted">CPF:</p>
                  <p className="font-strong text-ink">{paciente.cpf}</p>
                </div>
                <div>
                  <p className="text-muted">Nascimento:</p>
                  <p className="font-strong text-ink">{paciente.data_nascimento}</p>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => router.push('/cooperado')}
                className="flex-1 bg-chip hover:bg-chip-hover text-ink-body font-strong text-xs py-2.5 rounded-lg transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                Voltar à Agenda
              </button>
              <button
                onClick={() => {
                  setIdentificado(true);
                  setShowIdentificacaoModal(false);
                }}
                className="flex-1 bg-accent hover:bg-accent-hover text-on-accent font-strong text-xs py-2.5 rounded-lg shadow-raised transition-all active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Identificação de Cabeçalho Clínico */}
      <div className="bg-surface border border-line rounded-xl p-4 shadow-card flex flex-col gap-2.5">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-sm font-strong text-ink">{paciente.nome}</h2>
            <p className="text-xs text-muted mt-0.5">CPF: {paciente.cpf} | Nasc.: {paciente.data_nascimento}</p>
          </div>
          <span className="text-xs bg-accent-soft border border-accent-line text-accent-soft-ink font-heavy px-2.5 py-0.5 rounded-full uppercase">
            {pacienteId === '1' ? 'Homecare' : 'Hospital'}
          </span>
        </div>

        {/* Warnings */}
        {paciente.warnings && paciente.warnings.length > 0 && (
          <div className="bg-crit-soft border border-crit-line rounded-lg p-3 text-sm text-crit-ink flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex flex-col gap-0.5">
              <span className="font-heavy uppercase tracking-wider text-xs">Alertas Críticos</span>
              <span>{paciente.warnings.join(', ')}</span>
            </div>
          </div>
        )}
      </div>

      {/* Seção 1: Check-in / Check-out Timer */}
      <div className="bg-surface border border-line rounded-xl p-4 shadow-card flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${checkedIn ? 'bg-accent-soft text-accent-ink' : 'bg-chip text-muted'}`}>
            <Clock className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-strong text-muted uppercase tracking-wider">Tempo de Sessão</p>
            <TempoDeSessao inicioMs={inicioSessaoMs} congeladoEm={fimSessaoMs} />
          </div>
        </div>

        {!checkedIn && (
          <button
            onClick={handleCheckIn}
            className="bg-accent hover:bg-accent-hover text-on-accent font-strong text-xs px-4 py-2.5 rounded-xl shadow-raised transition-all active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            Iniciar Check-in
          </button>
        )}

        {checkedIn && !checkedOut && (
          <span className="text-xs font-heavy text-accent-soft-ink bg-accent-soft border border-accent-line px-3 py-1 rounded-lg animate-pulse">
            Sessão Ativa
          </span>
        )}

        {checkedOut && (
          <span className="text-xs font-heavy text-idle-ink bg-idle-soft border border-idle-line px-3 py-1 rounded-lg">
            Finalizada
          </span>
        )}
      </div>

      {checkedIn && (
        <div className={`flex flex-col gap-4 ${isLocked ? 'pointer-events-none opacity-80' : ''}`}>
          
          {/* Módulo de Enfermagem: Turnos e Prescrições */}
          {sessionCargo === 'Tecnico_Enfermagem' && (
            <div className="bg-surface border border-line rounded-xl p-4 shadow-card flex flex-col gap-4">

              {/* Seleção do Turno */}
              <div>
                {/* Grupo de botões, não um campo: rotular via role/aria-labelledby.
                    Um <label> solto aqui não se associa a nada. */}
                <span id="rotuloTurno" className="text-xs font-strong text-muted uppercase tracking-wider block mb-1.5">Turno de Enfermagem</span>
                <div role="group" aria-labelledby="rotuloTurno" className="grid grid-cols-3 gap-2">
                  {(['Diurno', 'Noturno', '24h'] as const).map((t) => (
                    <button
                      key={t}
                      disabled={isLocked}
                      onClick={() => setTurno(t)}
                      className={`min-h-[44px] py-2 px-3 text-xs font-strong rounded-lg border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                        turno === t
                          ? 'bg-accent text-on-accent border-accent'
                          : 'bg-surface border-line text-ink-body hover:border-line-strong'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Aprazamento de Medicamentos */}
              <div className="border-t border-line-soft pt-3">
                <h4 className="text-xs font-strong text-muted uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <Pill className="w-4 h-4 text-accent-ink" aria-hidden="true" />
                  Aprazamento & Checagem Digital
                </h4>

                {aprazamentos.length === 0 ? (
                  <div className="text-center py-4 text-muted text-xs">Sem prescrições médicas ativas carregadas.</div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {aprazamentos.map((apraz) => (
                      <div
                        key={apraz.id}
                        className={`border rounded-xl p-3 flex justify-between items-center transition-all ${
                          apraz.status === 'Administrado'
                            ? 'bg-pos-soft border-pos-line'
                            : apraz.status === 'Nao_Administrado'
                              ? 'bg-crit-soft border-crit-line'
                              : 'bg-surface border-line'
                        }`}
                      >
                        <div className="flex flex-col gap-1 min-w-0 flex-1 pr-2.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-heavy bg-chip text-ink-body px-1.5 py-0.5 rounded">
                              {new Date(apraz.horario_previsto).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className="font-heavy text-ink text-xs truncate">
                              {apraz.medicamento}
                            </span>
                          </div>
                          <p className="text-sm text-ink-body leading-snug">
                            Dosagem: {apraz.dosagem} | Via: {apraz.via_administracao}
                          </p>
                          {apraz.justificativa && (
                            <p className="text-sm text-crit-ink not-italic mt-1">
                              Justificativa: {apraz.justificativa}
                            </p>
                          )}
                        </div>

                        {/* Checagem Actions */}
                        {apraz.status === 'Pendente' ? (
                          // Par de maior risco da tela: registra administração de
                          // medicamento. Eram 30x30px (p-2 + ícone de 14px) a 6px
                          // um do outro, vermelho colado no verde, só ícone. Em
                          // campo, no celular, isso é erro de dose esperando
                          // acontecer. Agora 44x44 com separação de 12px, e o
                          // rótulo aparece assim que a largura permite.
                          <div className="flex gap-3 shrink-0">
                            <button
                              disabled={isLocked}
                              onClick={() => handleCheckMedicação(apraz, 'Nao_Administrado')}
                              className="bg-surface border border-crit-line text-crit-ink hover:bg-crit-soft disabled:opacity-40 min-w-[44px] min-h-[44px] px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                              aria-label={`Registrar não administrado: ${apraz.medicamento}`}
                            >
                              <X className="w-4 h-4" aria-hidden="true" />
                              <span className="text-sm font-semibold whitespace-nowrap">Não deu</span>
                            </button>
                            <button
                              disabled={isLocked}
                              onClick={() => handleCheckMedicação(apraz, 'Administrado')}
                              className="bg-pos-solid hover:bg-pos-solid-hover disabled:opacity-40 text-on-pos min-w-[44px] min-h-[44px] px-3 rounded-lg shadow-card transition-all flex items-center justify-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                              aria-label={`Registrar administrado: ${apraz.medicamento}`}
                            >
                              <Check className="w-4 h-4" aria-hidden="true" />
                              <span className="text-sm font-semibold whitespace-nowrap">Administrado</span>
                            </button>
                          </div>
                        ) : (
                          <span className={`text-xs font-semibold px-2 py-1 rounded-md border shrink-0 ${
                            apraz.status === 'Administrado'
                              ? 'bg-pos-soft text-pos-ink border-pos-line'
                              : 'bg-crit-soft text-crit-ink border-crit-line'
                          }`}>
                            {apraz.status === 'Administrado' ? 'Checado' : 'Omitido'}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Modal Justificativa de Omissão */}
          {checkingAprazamento && checkingAprazamento.status === 'Pendente' && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4">
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="tituloJustificativa"
                className="bg-raised rounded-2xl border border-line shadow-float p-6 max-w-sm w-full"
              >
                <div className="flex justify-between items-center mb-4">
                  <h3 id="tituloJustificativa" className="text-sm font-heavy text-ink">Justificativa de Omissão</h3>
                  <button
                    onClick={() => setCheckingAprazamento(null)}
                    aria-label="Fechar justificativa de omissão"
                    className="text-muted hover:text-ink w-11 h-11 -m-2 flex items-center justify-center rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                  >
                    <X className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>

                <div className="flex flex-col gap-4 text-xs">
                  <p className="text-muted">
                    Por que o medicamento{' '}
                    <strong className="font-semibold text-ink">{checkingAprazamento.medicamento}</strong>{' '}
                    não foi administrado?
                  </p>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="justificativaMotivo" className="font-strong text-ink-body">Motivo</label>
                    <select
                      id="justificativaMotivo"
                      style={{ fontSize: 16 }}
                      value={justificativaMotivo}
                      onChange={(e) => setJustificativaMotivo(e.target.value)}
                      className="bg-canvas border border-line rounded-lg p-2 font-semibold text-ink-body focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 focus-visible:ring-offset-raised"
                    >
                      <option value="Paciente recusou">Paciente recusou</option>
                      <option value="Medicamento ausente">Medicamento ausente</option>
                      <option value="Condições clínicas desfavoráveis">Condições clínicas desfavoráveis</option>
                      <option value="Paciente dormindo">Paciente dormindo</option>
                      <option value="Outros">Outros (Descrever abaixo)</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="justificativaTexto" className="font-strong text-ink-body">Explicação / Detalhes</label>
                    <textarea
                      id="justificativaTexto"
                      style={{ fontSize: 16 }}
                      rows={3}
                      value={justificativaTexto}
                      onChange={(e) => setJustificativaTexto(e.target.value)}
                      placeholder="Descreva detalhadamente o ocorrido..."
                      className="bg-canvas border border-line rounded-lg p-2.5 text-ink-body placeholder-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 focus-visible:ring-offset-raised"
                    />
                  </div>

                  <button
                    onClick={handleJustificarNaoAdministrado}
                    disabled={!justificativaTexto.trim()}
                    // `text-white` era incondicional e o estado desabilitado usava
                    // `bg-slate-355`, classe que não existe no Tailwind: sem fundo,
                    // o rótulo virava branco sobre o modal branco e sumia. Agora os
                    // dois estados vêm de token, e `disabled-ink` sobre `disabled`
                    // foi medido em 4,55:1 no claro e 4,56:1 no escuro.
                    className={`w-full min-h-[44px] py-2.5 font-strong rounded-lg shadow-raised transition-all active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                      justificativaTexto.trim()
                        ? 'bg-accent hover:bg-accent-hover text-on-accent'
                        : 'bg-disabled text-disabled-ink cursor-not-allowed'
                    }`}
                  >
                    Gravar Justificativa
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Seção 2: Gravação de Áudio e Relato */}
          <div className="bg-surface border border-line rounded-xl p-4 shadow-card flex flex-col gap-3">
            <h3 className="text-xs font-strong text-muted uppercase tracking-wider flex items-center gap-1.5">
              <Mic className="w-4 h-4 text-accent-ink" aria-hidden="true" />
              Evolução por Comando de Voz
            </h3>

            {/* Widget de Gravação */}
            <div className="bg-canvas border border-line-soft rounded-xl p-4 text-center flex flex-col items-center gap-4 relative overflow-hidden">

              {/* Onda Sonora Dinâmica */}
              {isRecording ? (
                <OndaSonora recorder={recorder} pausado={isRecordingPaused} />
              ) : audioRecorded ? (
                <div className="flex items-center gap-2 text-accent-soft-ink font-heavy text-xs bg-accent-soft border border-accent-line py-2 px-4 rounded-xl">
                  <Check className="w-4 h-4" aria-hidden="true" />
                  <span>Áudio Relato Gravado com Sucesso ({durationSecs}s)</span>
                </div>
              ) : (
                <div className="text-muted text-xs flex items-center gap-1">
                  <Volume2 className="w-4 h-4" aria-hidden="true" />
                  <span>Pronto para capturar evolução clínica.</span>
                </div>
              )}

              {/* Botões do Controle do Gravador */}
              {!audioRecorded && (
                <div className="flex items-center gap-3">
                  {!isRecording ? (
                    <button
                      onClick={handleStartRecord}
                      disabled={isLocked}
                      className="w-12 h-12 rounded-full bg-accent hover:bg-accent-hover text-on-accent flex items-center justify-center shadow-raised transition-all active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                      title="Gravar áudio"
                    >
                      <Mic className="w-5 h-5" aria-hidden="true" />
                    </button>
                  ) : (
                    <>
                      {isRecordingPaused ? (
                        <button
                          onClick={handleResumeRecord}
                          className="w-10 h-10 rounded-full bg-accent-soft border border-accent-line text-accent-ink flex items-center justify-center hover:bg-accent-line transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                          title="Retomar Gravação"
                        >
                          <Play className="w-4 h-4" aria-hidden="true" />
                        </button>
                      ) : (
                        <button
                          onClick={handlePauseRecord}
                          className="w-10 h-10 rounded-full bg-chip text-ink-body flex items-center justify-center hover:bg-chip-hover transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                          title="Pausar Gravação"
                        >
                          <Clock className="w-4 h-4 animate-spin" aria-hidden="true" />
                        </button>
                      )}

                      <button
                        onClick={handleStopRecord}
                        className="w-12 h-12 rounded-full bg-crit-solid hover:bg-crit-solid-hover text-on-crit flex items-center justify-center shadow-raised transition-all active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                        title="Finalizar e Salvar"
                      >
                        <Square className="w-4 h-4 fill-current" aria-hidden="true" />
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Tela de Revisão & Edição de Texto */}
            <div className="flex flex-col gap-1.5 mt-2">
              <label htmlFor="revisaoEvolucao" className="text-xs font-strong text-muted uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-accent-ink" aria-hidden="true" />
                Revisão Textual da Evolução
              </label>

              {transcribing ? (
                <div className="bg-canvas border border-line-soft rounded-xl p-6 text-center text-xs text-muted flex flex-col items-center gap-2">
                  <RotateCw className="w-6 h-6 text-accent-ink animate-spin" aria-hidden="true" />
                  <span className="font-strong text-ink">IA Transcrevendo & Formatando Evolução...</span>
                  <span className="scale-95 text-xs text-muted">Whisper + GPT-4o-mini analisando termos clínicos.</span>
                </div>
              ) : (
                <textarea
                  id="revisaoEvolucao"
                  style={{ fontSize: 16 }}
                  rows={6}
                  disabled={isLocked}
                  value={transcriptionText}
                  onChange={(e) => setTranscriptionText(e.target.value)}
                  placeholder="A evolução estruturada aparecerá aqui automaticamente após gravar o áudio..."
                  className="bg-canvas border border-line rounded-xl p-3 text-xs text-ink-body placeholder-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 focus-visible:ring-offset-surface focus:border-line-strong resize-none"
                />
              )}
            </div>
          </div>

          {/* Seção 3: Assinatura Eletrônica e Fechamento */}
          <div className="bg-accent-soft border border-accent-line rounded-xl p-4 shadow-card flex flex-col gap-4">
            <div>
              <h3 className="text-xs font-strong text-ink flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-accent-ink" aria-hidden="true" />
                Validação de Assinatura Eletrônica
              </h3>
              <p className="text-xs text-muted mt-0.5">
                Digite sua senha/PIN de segurança para assinar digitalmente e bloquear alterações.
              </p>
            </div>

            {!isLocked ? (
              <div className="flex gap-2">
                <input
                  type="password"
                  maxLength={6}
                  placeholder="PIN (6 dígitos)"
                  value={pinCode}
                  onChange={(e) => setPinCode(e.target.value.replace(/\D/g, ''))}
                  style={{ fontSize: 16 }}
                  className="bg-surface border border-accent-line rounded-lg p-2.5 text-center font-heavy text-ink w-28 min-h-[44px] placeholder-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 focus-visible:ring-offset-accent-soft focus:border-accent"
                />
                <button
                  onClick={handleAssinarProntuario}
                  className="flex-1 bg-accent hover:bg-accent-hover text-on-accent font-strong text-xs py-2.5 rounded-lg shadow-raised transition-all active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                >
                  Assinar e Finalizar
                </button>
              </div>
            ) : (
              <div className="bg-accent text-on-accent p-3.5 rounded-xl text-center text-xs font-strong flex flex-col gap-1">
                <p className="flex items-center justify-center gap-1.5">
                  <CheckSquare className="w-4 h-4" aria-hidden="true" />
                  Prontuário Assinado Digitalmente
                </p>
                <p className="font-normal text-on-accent-muted text-xs">
                  Bloqueado para edições. Documento indexado ao histórico clínico permanente.
                </p>
              </div>
            )}

            {errorText && (
              <div className="bg-crit-soft border border-crit-line text-crit-ink text-xs p-2.5 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{errorText}</span>
              </div>
            )}
          </div>

        </div>
      )}

      {/* Botão de retorno se concluído */}
      {checkedOut && (
        <button
          onClick={() => router.push('/cooperado')}
          className="w-full bg-invert hover:bg-invert-hover text-on-invert font-strong text-xs py-3 rounded-xl shadow-raised transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          Voltar para a Agenda
        </button>
      )}
    </div>
  );
}
