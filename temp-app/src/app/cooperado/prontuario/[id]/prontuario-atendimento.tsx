/* eslint-disable */
'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { localDB, PacienteLocal, PrescricaoLocal, AprazamentoLocal, EvolucaoLocal, SinalVitalLocal, ResponsavelPacienteLocal, gerarSlotsAprazamentoLocal } from '@/lib/indexeddb';
import { AudioRecorder } from '@/lib/audio-recorder';
import { subscribeToSync, synchronizeQueue } from '@/lib/sync-service';
import {
  User, Check, X, Play, Square, Mic, Volume2, Clock, AlertTriangle, AlertCircle, FileText, CheckSquare, Pill, ChevronDown, Lock, RotateCw, Activity, Camera, ShieldCheck, PlusCircle, CheckCircle2, UserCheck
} from 'lucide-react';
import axios from 'axios';
import { fetchAutenticado } from '@/lib/api-cliente';
import ValidacaoFacialModal, { DadosAssinaturaBiometrica, gerarHashBiometricoSha256 } from './validacao-facial-modal';

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
    if (inicioMs === null) {
      setSegundos(0);
      return;
    }
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

export {
  parseHorariosPadrao,
  obterJanelaTurno,
  gerarSlotsParaTurno,
  filtrarSlotsPorJanela,
} from '@/lib/aprazamento-engine';
import {
  parseHorariosPadrao,
  obterJanelaTurno,
  gerarSlotsParaTurno,
  filtrarSlotsPorJanela,
} from '@/lib/aprazamento-engine';

function ordenarEvolucoesRecentes(lista: EvolucaoLocal[]): EvolucaoLocal[] {
  return [...lista].sort((a, b) => {
    const tA = new Date(a.data_assinatura || a.check_out || a.check_in || 0).getTime();
    const tB = new Date(b.data_assinatura || b.check_out || b.check_in || 0).getTime();
    return (Number.isNaN(tB) ? 0 : tB) - (Number.isNaN(tA) ? 0 : tA);
  });
}

function extrairHashBiometricoDeSelo(selo?: string): { metodo: 'FACIAL' | 'PIN_FALLBACK'; hash: string } | null {
  if (!selo) return null;
  const m = selo.match(/v2:bio:(facial|pin_fallback):sha256=([a-f0-9]{64})/i);
  if (m) {
    return {
      metodo: m[1].toUpperCase() === 'PIN_FALLBACK' ? 'PIN_FALLBACK' : 'FACIAL',
      hash: m[2].toLowerCase(),
    };
  }
  const mSha = selo.match(/SHA256:([a-f0-9]{64})/i);
  if (mSha) {
    return { metodo: 'FACIAL', hash: mSha[1].toLowerCase() };
  }
  return null;
}

export default function ProntuarioAtendimento() {
  const params = useParams();
  const router = useRouter();
  const pacienteId = params.id as string;

  // Estados principais
  const [paciente, setPaciente] = useState<PacienteLocal | null>(null);
  const [prescricoes, setPrescricoes] = useState<PrescricaoLocal[]>([]);
  const [aprazamentos, setAprazamentos] = useState<AprazamentoLocal[]>([]);
  const [evolucao, setEvolucao] = useState<EvolucaoLocal | null>(null);
  const [historicoEvolucoes, setHistoricoEvolucoes] = useState<EvolucaoLocal[]>([]);
  const [sinaisRegistradosSessao, setSinaisRegistradosSessao] = useState<SinalVitalLocal[]>([]);
  
  // Controle de estados de sessão
  const [sessionCargo, setSessionCargo] = useState<'Tecnico_Enfermagem' | 'Medico' | 'Terapeuta'>('Tecnico_Enfermagem');
  const [cooperadoId, setCooperadoId] = useState<string>('');
  const [cooperadoNome, setCooperadoNome] = useState<string>('');
  const [cooperadoCpf, setCooperadoCpf] = useState<string>('');
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
  const [transcricaoSimulada, setTranscricaoSimulada] = useState(false);
  
  // Módulo de Enfermagem - Checagem
  const [checkingAprazamento, setCheckingAprazamento] = useState<AprazamentoLocal | null>(null);
  const [justificativaTexto, setJustificativaTexto] = useState('');
  const [justificativaMotivo, setJustificativaMotivo] = useState('Paciente recusou');

  // Assinatura, Biometria Facial, Familiar/Responsável pelo Plantão e Bloqueio
  const [pinCode, setPinCode] = useState('');
  const [showFacialModal, setShowFacialModal] = useState(false);
  const [dadosBiometricos, setDadosBiometricos] = useState<DadosAssinaturaBiometrica | null>(null);
  const [responsavelSelecionadoId, setResponsavelSelecionadoId] = useState<string>('');
  const [outroResponsavelNome, setOutroResponsavelNome] = useState<string>('');
  const [outroResponsavelParentesco, setOutroResponsavelParentesco] = useState<string>('Familiar');
  const [isLocked, setIsLocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [syncingPrescricoes, setSyncingPrescricoes] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const responsaveisPaciente = useMemo<ResponsavelPacienteLocal[]>(() => {
    if (Array.isArray(paciente?.responsaveis) && paciente.responsaveis.length > 0) {
      return paciente.responsaveis;
    }
    if (paciente?.responsavel_nome && paciente.responsavel_nome.trim()) {
      return [
        {
          id: 'resp_principal',
          nome: paciente.responsavel_nome.trim(),
          parentesco: 'Familiar / Responsável',
          telefone: paciente.responsavel_telefone || undefined,
          principal: true,
        },
      ];
    }
    const nomePac = (paciente?.nome || '').toLowerCase();
    if (nomePac.includes('helena')) {
      return [
        {
          id: 'resp_maria_helena',
          nome: 'Maria Helena Albuquerque',
          parentesco: 'Filha',
          telefone: '(85) 99981-4420',
          principal: true,
        },
        {
          id: 'resp_carlos_prado',
          nome: 'Carlos Eduardo Prado',
          parentesco: 'Neto',
          telefone: '(85) 98812-3310',
          principal: false,
        },
      ];
    }
    return [
      {
        id: 'resp_padrao_domicilio',
        nome: 'Clara Albuquerque (Familiar)',
        parentesco: 'Filha / Responsável',
        principal: true,
      },
      {
        id: 'resp_secundario_domicilio',
        nome: 'Roberto Albuquerque',
        parentesco: 'Cônjuge / Familiar',
        principal: false,
      },
    ];
  }, [paciente]);

  useEffect(() => {
    if (responsaveisPaciente.length > 0) {
      setResponsavelSelecionadoId((atual) => {
        if (atual === 'outro' || responsaveisPaciente.some((r) => r.id === atual)) {
          return atual;
        }
        const principal = responsaveisPaciente.find((r) => r.principal) || responsaveisPaciente[0];
        return principal.id;
      });
    }
  }, [responsaveisPaciente]);

  const responsavelEfetivo = useMemo<ResponsavelPacienteLocal>(() => {
    if (responsavelSelecionadoId === 'outro') {
      return {
        id: 'outro',
        nome: outroResponsavelNome.trim() || 'Familiar Acompanhante',
        parentesco: outroResponsavelParentesco || 'Familiar',
      };
    }
    return (
      responsaveisPaciente.find((r) => r.id === responsavelSelecionadoId) ||
      responsaveisPaciente.find((r) => r.principal) ||
      responsaveisPaciente[0] || {
        id: 'resp_principal',
        nome: paciente?.responsavel_nome || 'Familiar Responsável',
        parentesco: 'Familiar / Responsável',
      }
    );
  }, [responsavelSelecionadoId, outroResponsavelNome, outroResponsavelParentesco, responsaveisPaciente, paciente]);

  // Aferição de Sinais Vitais no Leito
  const [paSistolica, setPaSistolica] = useState('');
  const [paDiastolica, setPaDiastolica] = useState('');
  const [fcBpm, setFcBpm] = useState('');
  const [spo2, setSpo2] = useState('');
  const [tempCelsius, setTempCelsius] = useState('');
  const [glicemia, setGlicemia] = useState('');
  const [sinaisSalvos, setSinaisSalvos] = useState(false);
  const [salvandoSinais, setSalvandoSinais] = useState(false);
  const [ultimaAfericao, setUltimaAfericao] = useState<string | null>(null);

  const atualizarHistoricoLocal = async () => {
    try {
      const cleanId = String(pacienteId).trim();
      const evols = await localDB.getEvolucoes();
      const doPaciente = ordenarEvolucoesRecentes(
        evols.filter((e) => String(e.paciente_id).trim() === cleanId)
      );
      const finalizadas = doPaciente.filter(
        (e) =>
          e.status === 'Finalizado' ||
          e.status === 'Assinado_Pendente_Sync' ||
          e.status === 'Auditado' ||
          (e as any).status === 'Concluído'
      );
      setHistoricoEvolucoes(finalizadas);
      setEvolucao((atual) => {
        if (!atual) return atual;
        const atualizada = doPaciente.find((e) => e.id === atual.id);
        return atualizada ? { ...atual, ...atualizada } : atual;
      });
    } catch {}
  };

  // Carregar dados na inicialização
  useEffect(() => {
    let sessaoPresente = false;
    if (typeof window !== 'undefined') {
      const savedSession = window.localStorage.getItem('cooperado_session');
      if (savedSession) {
        try {
          const s = JSON.parse(savedSession);
          if (s && s.id) {
            sessaoPresente = true;
            setSessionCargo(s.cargo);
            setCooperadoId(s.id);
            if (s.nome) setCooperadoNome(s.nome);
            if (s.cpf) setCooperadoCpf(s.cpf);
          }
        } catch {}
      }
    }

    if (typeof window !== 'undefined' && !sessaoPresente) {
      fetchAutenticado('/api/cooperado/me')
        .then(async (res) => {
          if (!res.ok) {
            if (navigator.onLine) {
              const redirectPath = window.location.pathname + window.location.search;
              window.location.href = `/login?redirect=${encodeURIComponent(redirectPath)}`;
            }
            return;
          }
          const dados = await res.json();
          const coopId = dados?.cooperadoId || dados?.id;
          if (coopId) {
            setCooperadoId(coopId);
            if (dados.cargo) setSessionCargo(dados.cargo);
            if (dados.nome) setCooperadoNome(dados.nome);
            if (dados.cpf) setCooperadoCpf(dados.cpf);
            window.localStorage.setItem(
              'cooperado_session',
              JSON.stringify({
                id: coopId,
                nome: dados.nome,
                cargo: dados.cargo || 'Tecnico_Enfermagem',
                profissao: dados.profissao,
                email: dados.email,
                cpf: dados.cpf,
                foto: dados.foto,
                autenticado: true,
              })
            );
          }
        })
        .catch(() => {});
    }

    setIsOnline(navigator.onLine);
    let cancelado = false;

    const unsubscribeSync = subscribeToSync((status) => {
      setIsOnline(status.isOnline);
      if (!cancelado) {
        atualizarHistoricoLocal();
      }
      if (status.isOnline && !cancelado && status.pendingCount === 0 && !status.isSyncing) {
        syncOnlinePaciente();
      }
    });

    async function inicializarProntuario() {
      await loadLocalDetails();
      if (!cancelado && typeof navigator !== 'undefined' && navigator.onLine) {
        await syncOnlinePaciente();
        if (!cancelado) {
          await loadLocalDetails();
        }
      }
    }

    inicializarProntuario();

    return () => {
      cancelado = true;
      unsubscribeSync();
    };
  }, [pacienteId]);

  const loadLocalDetails = async () => {
    try {
      const cleanId = String(pacienteId).trim();
      const p = await localDB.getPaciente(cleanId);
      if (p) {
        if (p.cpf === '123.456.789-00' && p.nome === 'João da Silva' && cleanId !== 'p_1') {
          p.cpf = '';
          p.warnings = (p.warnings || []).filter(
            (w) => w !== 'Alergia a Dipirona e Penicilina' && w !== 'Hipertensão Grave'
          );
        }
        setPaciente(p);
      } else {
        const placeholderP: PacienteLocal = {
          id: cleanId,
          nome: 'Paciente em Atendimento',
          cpf: '',
          data_nascimento: '',
          endereco: '',
          warnings: [],
        };
        setPaciente(placeholderP);
      }

      const presList = await localDB.getPrescricoes(cleanId);
      setPrescricoes(presList);

      const aprazList = await localDB.getAprazamentos();
      for (const pr of presList) {
        if (!aprazList.some((a) => String(a.prescricao_id) === String(pr.id))) {
          const slots = gerarSlotsAprazamentoLocal(pr);
          if (slots.length > 0) {
            await localDB.saveAprazamentos(slots);
            aprazList.push(...slots);
          }
        }
      }
      const filteredApraz = aprazList.filter(
        (a) =>
          presList.some((p) => String(p.id) === String(a.prescricao_id)) ||
          (a.paciente_id && String(a.paciente_id).trim() === cleanId)
      );
      setAprazamentos(filteredApraz);

      // Carrega evoluções do paciente ordenadas da mais recente para a mais antiga
      const evols = await localDB.getEvolucoes();
      const doPaciente = ordenarEvolucoesRecentes(
        evols.filter((e) => String(e.paciente_id).trim() === cleanId)
      );
      const finalizadas = doPaciente.filter(
        (e) =>
          e.status === 'Finalizado' ||
          e.status === 'Assinado_Pendente_Sync' ||
          e.status === 'Auditado' ||
          (e as any).status === 'Concluído'
      );
      setHistoricoEvolucoes(finalizadas);

      // Prioriza atendimento em andamento; caso contrário exibe a evolução finalizada mais recente
      const emAndamento = doPaciente.find((e) => e.status === 'Em_Andamento');
      const currentEv = (emAndamento || finalizadas[0]) as
        | (EvolucaoLocal & { assinatura_biometrica?: DadosAssinaturaBiometrica })
        | undefined;

      if (currentEv) {
        setEvolucao(currentEv);
        setCheckedIn(true);
        setTurno((currentEv.turno as 'Diurno' | 'Noturno' | '24h') || 'Diurno');
        setTranscriptionText(currentEv.transcricao_revisada || '');
        if (Array.isArray(currentEv.sinais_vitais) && currentEv.sinais_vitais.length > 0) {
          setSinaisRegistradosSessao(currentEv.sinais_vitais);
        }
        if (currentEv.audio_url || currentEv.transcricao_crua) {
          setAudioRecorded(true);
        }
        if (currentEv.assinatura_biometrica?.biometriaHash) {
          setDadosBiometricos(currentEv.assinatura_biometrica);
        } else {
          const extraido = extrairHashBiometricoDeSelo(currentEv.assinatura_digital);
          if (extraido) {
            setDadosBiometricos({
              metodo: extraido.metodo,
              biometriaHash: extraido.hash,
              timestamp: currentEv.data_assinatura || currentEv.check_out || currentEv.check_in,
              cooperadoIdentificador: cooperadoCpf || cooperadoId || currentEv.profissional_id,
              evolucaoId: currentEv.id,
            });
          }
        }
        if (
          currentEv.status === 'Finalizado' ||
          currentEv.status === 'Assinado_Pendente_Sync' ||
          currentEv.status === 'Auditado' ||
          (currentEv as any).status === 'Concluído'
        ) {
          setIsLocked(true);
          setCheckedOut(true);
        } else {
          setIsLocked(false);
          setCheckedOut(false);
        }
      }
    } catch (e) {
      console.error(e);
      setErrorText('Erro ao recuperar dados locais do prontuário.');
    }
  };

  const syncOnlinePaciente = async () => {
    if (!pacienteId) return;
    setSyncingPrescricoes(true);
    try {
      const cleanId = String(pacienteId).trim();
      let res;
      try {
        res = await axios.get(`/api/cooperado/agenda?paciente_id=${encodeURIComponent(cleanId)}`);
      } catch (e1) {
        res = await axios.get(`/api/cooperado/sync?paciente_id=${encodeURIComponent(cleanId)}`);
      }

      if (res?.data?.success) {
        const {
          pacientes,
          prescricoes: serverPrescs,
          aprazamentos: serverApraz,
          evolucoes: serverEvols,
        } = res.data;

        const serverPac = (pacientes || []).find((p: any) => String(p.id).trim() === cleanId);
        if (serverPac) {
          setPaciente(serverPac);
          await localDB.savePacientes([serverPac]);
        }

        const patientPrescs = (serverPrescs || []).filter(
          (p: any) =>
            String(p.paciente_id).trim() === cleanId &&
            (!p.status || p.status === 'Ativa' || String(p.status).toLowerCase() === 'ativa')
        );

        await localDB.savePrescricoes(patientPrescs);
        setPrescricoes(patientPrescs);

        const aprazList: any[] = (serverApraz || []).filter(
          (a: any) =>
            patientPrescs.some((p: any) => String(p.id) === String(a.prescricao_id)) ||
            String(a.paciente_id).trim() === cleanId
        );

        for (const pr of patientPrescs) {
          if (!aprazList.some((a: any) => String(a.prescricao_id) === String(pr.id))) {
            const slots = gerarSlotsAprazamentoLocal(pr);
            aprazList.push(...slots);
          }
        }

        if (aprazList.length > 0) {
          await localDB.saveAprazamentos(aprazList);
        }

        const allApraz = await localDB.getAprazamentos();
        const consolidatedPrescs = await localDB.getPrescricoes(cleanId);
        const finalApraz = allApraz.filter(
          (a) =>
            consolidatedPrescs.some((p) => String(p.id) === String(a.prescricao_id)) ||
            String(a.paciente_id).trim() === cleanId
        );
        setAprazamentos(finalApraz);

        // Sincroniza evoluções já realizadas vindas do servidor
        if (Array.isArray(serverEvols) && serverEvols.length > 0) {
          const evolsPaciente = serverEvols.filter(
            (e: any) => String(e.paciente_id).trim() === cleanId
          );
          if (evolsPaciente.length > 0) {
            await localDB.saveEvolucoes(evolsPaciente);
          }
        }
        await atualizarHistoricoLocal();
      }
    } catch (err) {
      console.warn('Aviso ao sincronizar prontuário online:', err);
    } finally {
      setSyncingPrescricoes(false);
    }
  };

  // O cronômetro é derivado da evolução, não replicado em estado: enquanto
  // `check_out` estiver vazio o filho conta sozinho; quando chegar, ele congela.
  const inicioSessaoMs = evolucao?.check_in ? new Date(evolucao.check_in).getTime() : null;
  const fimSessaoMs = evolucao?.check_out ? new Date(evolucao.check_out).getTime() : null;

  // Janela do plantão (assumido 12h: Diurno 07h-19h ou Noturno 19h-07h)
  const refData = evolucao?.check_in ? new Date(evolucao.check_in) : new Date();
  const janelaTurno = useMemo(() => obterJanelaTurno(refData, turno), [evolucao?.check_in, turno]);

  // Filtra e deduplica aprazamentos para o plantão de 12 horas ativo (ou 24h)
  const aprazamentosTurno = useMemo(() => {
    const tInicio = janelaTurno.inicio.getTime();
    const tFim = janelaTurno.fim.getTime();

    const filtrados = aprazamentos.filter((a) => {
      if (!a.horario_previsto) return false;
      const tSlot = new Date(a.horario_previsto).getTime();
      if (Number.isNaN(tSlot)) return false;
      return tSlot >= tInicio && tSlot < tFim;
    });

    const dedup = new Map<string, AprazamentoLocal>();
    for (const item of filtrados) {
      const chave = `${item.prescricao_id}__${item.horario_previsto}`;
      const existente = dedup.get(chave);
      if (!existente || (existente.status === 'Pendente' && item.status !== 'Pendente')) {
        dedup.set(chave, item);
      }
    }
    return Array.from(dedup.values()).sort(
      (a, b) => new Date(a.horario_previsto).getTime() - new Date(b.horario_previsto).getTime()
    );
  }, [aprazamentos, janelaTurno]);

  // Garante que prescrições ativas tenham slots gerados para o turno de 12h no IndexedDB
  useEffect(() => {
    if (!pacienteId || prescricoes.length === 0) return;
    let cancelado = false;

    const assegurarSlotsTurno = async () => {
      try {
        const existing = await localDB.getAprazamentos();
        const paraSalvar: AprazamentoLocal[] = [];

        for (const pr of prescricoes) {
          const esperados = gerarSlotsParaTurno(pr, janelaTurno);
          for (const esp of esperados) {
            const jaExiste = existing.some(
              (e) =>
                e.id === esp.id ||
                (String(e.prescricao_id) === String(esp.prescricao_id) &&
                  e.horario_previsto === esp.horario_previsto)
            );
            if (!jaExiste) {
              paraSalvar.push(esp);
              existing.push(esp);
            }
          }
        }

        if (paraSalvar.length > 0 && !cancelado) {
          await localDB.saveAprazamentos(paraSalvar);
          setAprazamentos((prev) => {
            const chaves = new Set(prev.map((p) => `${p.prescricao_id}__${p.horario_previsto}`));
            const novos = paraSalvar.filter((s) => !chaves.has(`${s.prescricao_id}__${s.horario_previsto}`));
            return [...prev, ...novos];
          });
        }
      } catch (err) {
        console.warn('Aviso ao assegurar slots do turno:', err);
      }
    };

    assegurarSlotsTurno();
    return () => {
      cancelado = true;
    };
  }, [pacienteId, prescricoes, janelaTurno]);

  // Iniciar novo atendimento quando já existe evolução anterior finalizada
  const handleIniciarNovoAtendimento = () => {
    if (paciente?.limite_atingido) {
      setErrorText(
        `Limite mensal de ${paciente.limite_visitas_mes || 13} visitas atingido para este paciente (${paciente.visitas_realizadas_mes}/${paciente.limite_visitas_mes}).`
      );
      return;
    }
    setEvolucao(null);
    setCheckedIn(false);
    setCheckedOut(false);
    setIsLocked(false);
    setTranscriptionText('');
    setAudioRecorded(false);
    setDurationSecs(0);
    setDadosBiometricos(null);
    setPinCode('');
    setSinaisRegistradosSessao([]);
    setErrorText(null);
  };

  // Check-in
  const handleCheckIn = async () => {
    if (!identificado) {
      setErrorText('Confirme a identificação do paciente antes de iniciar o atendimento.');
      return;
    }

    if (paciente?.limite_atingido) {
      setErrorText(
        `Limite mensal de ${paciente.limite_visitas_mes || 13} visitas atingido para este paciente (${paciente.visitas_realizadas_mes}/${paciente.limite_visitas_mes}). Não é permitido realizar novas visitas este mês.`
      );
      return;
    }

    const checkInTime = new Date().toISOString();
    const newEv: EvolucaoLocal = {
      id: `ev_${Date.now()}`,
      paciente_id: pacienteId,
      paciente_nome: paciente?.nome,
      paciente_cpf: paciente?.cpf,
      profissional_id: cooperadoId,
      profissional_nome: cooperadoNome || 'Profissional Cooperado',
      tipo_profissional: sessionCargo,
      turno: sessionCargo === 'Tecnico_Enfermagem' ? turno : undefined,
      check_in: checkInTime,
      check_out: '',
      status: 'Em_Andamento',
    };

    try {
      if (paciente) {
        await localDB.savePacientes([paciente]);
      }
      await localDB.saveEvolucao(newEv);
      setEvolucao(newEv);
      setCheckedIn(true);
      setCheckedOut(false);
      setIsLocked(false);
      setTranscriptionText('');
      setDadosBiometricos(null);
      setSinaisRegistradosSessao([]);
      setErrorText(null);

      await localDB.enqueueAction('CHECK_IN', {
        pacienteId,
        pacienteNome: paciente?.nome,
        checkIn: checkInTime,
        evolucaoId: newEv.id,
        tipoProfissional: newEv.tipo_profissional,
        profissionalNome: newEv.profissional_nome,
        turno: newEv.turno,
      });

      if (typeof navigator !== 'undefined' && navigator.onLine) {
        synchronizeQueue().catch(() => {});
      }
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
      await localDB.saveAudio(evolucao.id, blob);

      if (isOnline) {
        await transcreverAudio(evolucao.id, blob);
      } else {
        await localDB.enqueueAction('EVOLUCAO_TEXTO', { evolucaoId: evolucao.id });
        setTranscriptionText('[Áudio salvo offline. Reconecte e toque em Transcrever áudio.]');
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
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (response.data.success) {
        setTranscriptionText(response.data.transcricao);
        setTranscricaoSimulada(response.data.simulado === true);

        if (response.data.sinaisVitais && !response.data.simulado) {
          const sv = response.data.sinaisVitais;
          if (sv.paSistolica) setPaSistolica(String(sv.paSistolica));
          if (sv.paDiastolica) setPaDiastolica(String(sv.paDiastolica));
          if (sv.fc) setFcBpm(String(sv.fc));
          if (sv.spo2) setSpo2(String(sv.spo2));
          if (sv.temp) setTempCelsius(String(sv.temp));
          if (sv.glicemia) setGlicemia(String(sv.glicemia));
        }

        if (evolucao) {
          const updated = {
            ...evolucao,
            transcricao_crua: response.data.transcricaoCrua,
            transcricao_revisada: response.data.transcricao,
          };
          await localDB.saveEvolucao(updated);
          setEvolucao(updated);
        }
        const pendentes = await localDB.getSyncQueue();
        for (const acao of pendentes) {
          if (acao.type === 'EVOLUCAO_TEXTO' && acao.payload?.evolucaoId === evolucaoId && acao.id !== undefined) {
            await localDB.dequeueAction(acao.id);
          }
        }
      } else {
        throw new Error(response.data.error || 'Erro ao processar áudio no servidor.');
      }
    } catch (err: any) {
      console.error(err);
      const doServidor = err?.response?.data?.error;
      setErrorText(
        typeof doServidor === 'string' && doServidor
          ? doServidor
          : 'Erro ao transcrever áudio. Você pode redigir a evolução manualmente.'
      );
      setTranscriptionText('');
      setTranscricaoSimulada(false);
    } finally {
      setTranscribing(false);
    }
  };

  // Módulo de Enfermagem: Registrar Checagem de Aprazamento
  const handleCheckMedicação = async (aprazamento: AprazamentoLocal, status: 'Administrado' | 'Nao_Administrado') => {
    setCheckingAprazamento(aprazamento);
    if (status === 'Administrado') {
      const updatedAprazamentos = aprazamentos.map((a) => {
        if (a.id === aprazamento.id) {
          return {
            ...a,
            status: 'Administrado' as const,
            horario_executado: new Date().toISOString(),
            profissional_id: cooperadoId,
            assinatura_digital: undefined,
          };
        }
        return a;
      });

      await localDB.saveAprazamentos(updatedAprazamentos);
      setAprazamentos(updatedAprazamentos);
      setCheckingAprazamento(null);

      await localDB.enqueueAction('CHECK_MEDICAMENTO', {
        aprazamentoId: aprazamento.id,
        prescricaoId: aprazamento.prescricao_id,
        pacienteId,
        horario_previsto: aprazamento.horario_previsto,
        status: 'Administrado',
        horario_executado: new Date().toISOString(),
        profissional_id: cooperadoId,
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
          justificativa: `[${justificativaMotivo}] ${justificativaTexto}`,
        };
      }
      return a;
    });

    await localDB.saveAprazamentos(updatedAprazamentos);
    setAprazamentos(updatedAprazamentos);

    await localDB.enqueueAction('CHECK_MEDICAMENTO', {
      aprazamentoId: checkingAprazamento.id,
      prescricaoId: checkingAprazamento.prescricao_id,
      pacienteId,
      horario_previsto: checkingAprazamento.horario_previsto,
      status: 'Nao_Administrado',
      horario_executado: new Date().toISOString(),
      profissional_id: cooperadoId,
      justificativa: `[${justificativaMotivo}] ${justificativaTexto}`,
    });

    setCheckingAprazamento(null);
    setJustificativaTexto('');
  };

  const handleSalvarSinaisVitais = async () => {
    if (!paSistolica && !fcBpm && !spo2 && !tempCelsius && !glicemia) {
      setErrorText('Preencha ao menos um parâmetro para registrar sinais vitais.');
      return;
    }
    setSalvandoSinais(true);
    try {
      const agora = new Date();
      const sinalId = `sv_${pacienteId}_${agora.getTime()}`;
      const novoSinal: SinalVitalLocal = {
        id: sinalId,
        paciente_id: pacienteId,
        evolucao_id: evolucao?.id,
        data_hora: agora.toISOString(),
        pa_sistolica: paSistolica ? Number(paSistolica) : null,
        pa_diastolica: paDiastolica ? Number(paDiastolica) : null,
        fc_bpm: fcBpm ? Number(fcBpm) : null,
        spo2_percent: spo2 ? Number(spo2) : null,
        temp_celsius: tempCelsius ? Number(tempCelsius) : null,
        glicemia_mg_dl: glicemia ? Number(glicemia) : null,
      };

      await localDB.enqueueAction('REGISTRAR_SINAIS_VITAIS', {
        id: sinalId,
        pacienteId,
        pacienteNome: paciente?.nome,
        evolucaoId: evolucao?.id,
        data_hora: novoSinal.data_hora,
        pa_sistolica: novoSinal.pa_sistolica,
        pa_diastolica: novoSinal.pa_diastolica,
        fc_bpm: novoSinal.fc_bpm,
        spo2_percent: novoSinal.spo2_percent,
        temp_celsius: novoSinal.temp_celsius,
        glicemia_mg_dl: novoSinal.glicemia_mg_dl,
      });

      const novosSinais = [novoSinal, ...sinaisRegistradosSessao];
      setSinaisRegistradosSessao(novosSinais);

      if (evolucao) {
        const evComSinais: EvolucaoLocal = {
          ...evolucao,
          sinais_vitais: novosSinais,
        };
        await localDB.saveEvolucao(evComSinais);
        setEvolucao(evComSinais);
      }

      setSinaisSalvos(true);
      setUltimaAfericao(agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
      setPaSistolica('');
      setPaDiastolica('');
      setFcBpm('');
      setSpo2('');
      setTempCelsius('');
      setGlicemia('');
      setTimeout(() => setSinaisSalvos(false), 3500);
    } catch (e: any) {
      console.error('Erro ao salvar sinais vitais:', e);
      setErrorText('Não foi possível gravar os sinais vitais localmente.');
    } finally {
      setSalvandoSinais(false);
    }
  };

  const validarPreRequisitosAssinatura = (): boolean => {
    if (!evolucao) return false;

    if (sessionCargo === 'Tecnico_Enfermagem') {
      const pendentes = aprazamentosTurno.filter((a) => a.status === 'Pendente');
      if (pendentes.length > 0) {
        setErrorText(
          `Atenção: Existem ${pendentes.length} horário(s) de medicação pendente(s) de checagem digital neste plantão de 12h.`
        );
        return false;
      }
    }

    if (!transcriptionText.trim() || transcriptionText.startsWith('[Áudio salvo offline')) {
      setErrorText('Transcreva o áudio pendente ou digite o relato antes de assinar.');
      return false;
    }

    if (transcricaoSimulada) {
      setErrorText(
        'Este texto é uma simulação de desenvolvimento, não a transcrição do seu áudio. Remova os trechos marcados com [SIMULAÇÃO] e redija a evolução antes de assinar.'
      );
      return false;
    }

    return true;
  };

  const finalizarComDadosBiometricos = async (dadosBio: DadosAssinaturaBiometrica) => {
    if (!evolucao) return;
    setLoading(true);
    setErrorText(null);

    const checkOutTime = dadosBio.timestamp || new Date().toISOString();
    const respIdFinal = dadosBio.responsavelId || responsavelEfetivo.id || 'resp_principal';
    const respNomeFinal = dadosBio.responsavelNome || responsavelEfetivo.nome || 'Familiar Responsável';
    const respParentescoFinal = dadosBio.responsavelParentesco || responsavelEfetivo.parentesco || 'Familiar';

    const resumoBiometrico: DadosAssinaturaBiometrica = {
      metodo: dadosBio.metodo,
      biometriaHash: dadosBio.biometriaHash,
      timestamp: dadosBio.timestamp,
      cooperadoIdentificador: dadosBio.cooperadoIdentificador,
      evolucaoId: evolucao.id,
      dispositivoInfo: dadosBio.dispositivoInfo,
      responsavelId: respIdFinal,
      responsavelNome: respNomeFinal,
      responsavelParentesco: respParentescoFinal,
    };

    try {
      // Se o cooperado preencheu sinais vitais nos inputs e ainda não clicou em Registrar, captura automaticamente
      let sinaisFinais = [...sinaisRegistradosSessao];
      if (paSistolica || fcBpm || spo2 || tempCelsius || glicemia) {
        const agora = new Date();
        const sinalId = `sv_${pacienteId}_${agora.getTime()}`;
        const sinalAuto: SinalVitalLocal = {
          id: sinalId,
          paciente_id: pacienteId,
          evolucao_id: evolucao.id,
          data_hora: agora.toISOString(),
          pa_sistolica: paSistolica ? Number(paSistolica) : null,
          pa_diastolica: paDiastolica ? Number(paDiastolica) : null,
          fc_bpm: fcBpm ? Number(fcBpm) : null,
          spo2_percent: spo2 ? Number(spo2) : null,
          temp_celsius: tempCelsius ? Number(tempCelsius) : null,
          glicemia_mg_dl: glicemia ? Number(glicemia) : null,
        };
        await localDB.enqueueAction('REGISTRAR_SINAIS_VITAIS', {
          id: sinalId,
          pacienteId,
          pacienteNome: paciente?.nome,
          evolucaoId: evolucao.id,
          data_hora: sinalAuto.data_hora,
          pa_sistolica: sinalAuto.pa_sistolica,
          pa_diastolica: sinalAuto.pa_diastolica,
          fc_bpm: sinalAuto.fc_bpm,
          spo2_percent: sinalAuto.spo2_percent,
          temp_celsius: sinalAuto.temp_celsius,
          glicemia_mg_dl: sinalAuto.glicemia_mg_dl,
        });
        sinaisFinais = [sinalAuto, ...sinaisFinais];
        setSinaisRegistradosSessao(sinaisFinais);
        setPaSistolica('');
        setPaDiastolica('');
        setFcBpm('');
        setSpo2('');
        setTempCelsius('');
        setGlicemia('');
      }

      if (paciente) {
        await localDB.savePacientes([paciente]);
      }

      const seloLocal = `v2:bio:${dadosBio.metodo.toLowerCase()}:sha256=${dadosBio.biometriaHash}:coop=${dadosBio.cooperadoIdentificador}:ts=${checkOutTime}`;
      const finalEv: EvolucaoLocal & { assinatura_biometrica?: DadosAssinaturaBiometrica } = {
        ...evolucao,
        paciente_nome: paciente?.nome || evolucao.paciente_nome,
        paciente_cpf: paciente?.cpf || evolucao.paciente_cpf,
        profissional_nome: cooperadoNome || evolucao.profissional_nome || 'Profissional Cooperado',
        check_out: checkOutTime,
        transcricao_revisada: transcriptionText,
        status: 'Assinado_Pendente_Sync',
        data_assinatura: checkOutTime,
        assinatura_digital: evolucao.assinatura_digital || seloLocal,
        assinatura_biometrica: resumoBiometrico,
        responsavel_id: respIdFinal,
        responsavel_nome: respNomeFinal,
        responsavel_parentesco: respParentescoFinal,
        sinais_vitais: sinaisFinais.length > 0 ? sinaisFinais : evolucao.sinais_vitais,
      };

      await localDB.saveEvolucao(finalEv);
      setDadosBiometricos(resumoBiometrico);
      setEvolucao(finalEv);
      setIsLocked(true);
      setCheckedOut(true);
      setShowFacialModal(false);

      // Atualiza imediatamente o histórico de evoluções na tela
      setHistoricoEvolucoes((prev) =>
        ordenarEvolucoesRecentes([finalEv, ...prev.filter((e) => e.id !== finalEv.id)])
      );

      // Enfileira ação de finalização com metadados completos, responsável pelo plantão e hash biométrico SHA-256
      await localDB.enqueueAction('SIGN_EVOLUCAO', {
        evolucaoId: evolucao.id,
        pacienteId,
        pacienteNome: paciente?.nome,
        checkIn: evolucao.check_in,
        checkOut: checkOutTime,
        tipoProfissional: evolucao.tipo_profissional,
        profissionalNome: finalEv.profissional_nome,
        turno: evolucao.turno,
        transcricao_revisada: transcriptionText,
        pinCode: dadosBio.pinFallback || pinCode || undefined,
        biometria_hash: dadosBio.biometriaHash,
        metodo_assinatura: dadosBio.metodo,
        biometria_timestamp: dadosBio.timestamp,
        cooperado_identificador: dadosBio.cooperadoIdentificador,
        responsavel_id: respIdFinal,
        responsavel_nome: respNomeFinal,
        responsavel_parentesco: respParentescoFinal,
        assinatura_biometrica: {
          metodo: dadosBio.metodo,
          biometriaHash: dadosBio.biometriaHash,
          timestamp: dadosBio.timestamp,
          cooperadoIdentificador: dadosBio.cooperadoIdentificador,
          dispositivoInfo: dadosBio.dispositivoInfo,
          responsavelId: respIdFinal,
          responsavelNome: respNomeFinal,
          responsavelParentesco: respParentescoFinal,
        },
      });

      if (typeof navigator !== 'undefined' && navigator.onLine) {
        await synchronizeQueue().catch(() => false);
      }
      await atualizarHistoricoLocal();

      console.log('Prontuário assinado biometricamente e finalizado!');
    } catch (e) {
      console.error(e);
      setErrorText('Erro ao salvar assinatura localmente.');
    } finally {
      setLoading(false);
    }
  };

  const handleAbrirValidacaoFacial = () => {
    if (!validarPreRequisitosAssinatura()) return;
    setErrorText(null);
    setShowFacialModal(true);
  };

  // Assinar e Bloquear Evolução (Check-out automático via Reconhecimento Facial ou Fallback PIN)
  const handleAssinarProntuario = async () => {
    if (!evolucao) return;
    if (!validarPreRequisitosAssinatura()) return;

    if (dadosBiometricos) {
      await finalizarComDadosBiometricos(dadosBiometricos);
      return;
    }

    const pinLimpo = pinCode.trim();
    if (!pinLimpo) {
      // Sem PIN digitado, abre o modal de Reconhecimento Facial (padrão oficial)
      setErrorText(null);
      setShowFacialModal(true);
      return;
    }

    if (pinLimpo !== '1234' && !/^\d{4,6}$/.test(pinLimpo)) {
      setErrorText('Digite um PIN válido (ex: 1234 ou 6 dígitos) ou utilize o Reconhecimento Facial.');
      return;
    }

    const timestampIso = new Date().toISOString();
    const identificadorCooperado = cooperadoCpf || cooperadoId || 'coop_sessao';
    const hashPin = await gerarHashBiometricoSha256({
      imagemBase64: `PIN_FALLBACK:${pinLimpo}`,
      cooperadoIdentificador: identificadorCooperado,
      evolucaoId: evolucao.id,
      timestampIso,
    });

    await finalizarComDadosBiometricos({
      metodo: 'PIN_FALLBACK',
      biometriaHash: hashPin,
      timestamp: timestampIso,
      cooperadoIdentificador: identificadorCooperado,
      evolucaoId: evolucao.id,
      pinFallback: pinLimpo,
      dispositivoInfo: typeof navigator !== 'undefined' ? navigator.userAgent : 'PIN-Fallback',
    });
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

        {/* Cota Mensal de Visitas do Paciente */}
        {paciente.limite_visitas_mes !== undefined && paciente.limite_visitas_mes > 0 && (
          <div className={`rounded-xl p-3 text-xs flex items-start gap-2.5 border ${
            paciente.limite_atingido
              ? 'bg-crit-soft border-crit-line text-crit-ink'
              : (paciente.visitas_restantes_mes || 0) <= 2
              ? 'bg-warn-soft border-warn-line text-warn-ink'
              : 'bg-accent-soft border-accent-line text-accent-soft-ink'
          }`}>
            {paciente.limite_atingido ? (
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-crit-ink" aria-hidden="true" />
            ) : (
              <Clock className="w-4 h-4 shrink-0 mt-0.5 text-accent-ink" aria-hidden="true" />
            )}
            <div className="flex flex-col gap-0.5">
              <span className="font-heavy uppercase tracking-wider text-[10px]">
                {paciente.limite_atingido ? '🚫 Cota Mensal Esgotada - Visitas Bloqueadas' : '📋 Cota Mensal Contratada'}
              </span>
              <span className="font-medium">
                {paciente.limite_atingido
                  ? `Este paciente atingiu o teto de ${paciente.limite_visitas_mes} visitas neste mês (${paciente.visitas_realizadas_mes}/${paciente.limite_visitas_mes}). Novos atendimentos foram bloqueados pela gestão.`
                  : `Cota contratada: ${paciente.visitas_realizadas_mes || 0} de ${paciente.limite_visitas_mes} visitas realizadas. Restam ${paciente.visitas_restantes_mes} visitas este mês.`}
              </span>
            </div>
          </div>
        )}

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
          paciente.limite_atingido ? (
            <div className="bg-crit-soft border border-crit-line text-crit-ink text-xs font-heavy px-3 py-2 rounded-xl text-center">
              Visitas Bloqueadas
            </div>
          ) : (
            <button
              onClick={handleCheckIn}
              className="bg-accent hover:bg-accent-hover text-on-accent font-strong text-xs px-4 py-2.5 rounded-xl shadow-raised transition-all active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              Iniciar Check-in
            </button>
          )
        )}

        {checkedIn && !checkedOut && (
          <span className="text-xs font-heavy text-accent-soft-ink bg-accent-soft border border-accent-line px-3 py-1 rounded-lg animate-pulse">
            Sessão Ativa
          </span>
        )}

        {checkedOut && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-heavy text-pos-ink bg-pos-soft border border-pos-line px-3 py-1 rounded-lg flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
              Finalizada
            </span>
            {!paciente.limite_atingido && (
              <button
                type="button"
                data-testid="btn-novo-atendimento"
                onClick={handleIniciarNovoAtendimento}
                className="bg-accent hover:bg-accent-hover text-on-accent font-strong text-xs px-3 py-1.5 rounded-lg shadow-card transition-all active:scale-[0.98] flex items-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                <PlusCircle className="w-3.5 h-3.5" aria-hidden="true" />
                Novo Atendimento
              </button>
            )}
          </div>
        )}
      </div>

      {checkedIn && (
        <div className={`flex flex-col gap-4 ${isLocked ? 'pointer-events-none opacity-80' : ''}`}>
          
          {/* Módulo de Enfermagem: Turnos e Prescrições */}
          {sessionCargo === 'Tecnico_Enfermagem' && (
            <div className="bg-surface border border-line rounded-xl p-4 shadow-card flex flex-col gap-4">

              {/* Seleção do Turno */}
              <div>
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
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex flex-col">
                    <h4 className="text-xs font-strong text-muted uppercase tracking-wider flex items-center gap-1.5">
                      <Pill className="w-4 h-4 text-accent-ink" aria-hidden="true" />
                      Aprazamento & Checagem Digital
                    </h4>
                    <span className="text-[11px] text-muted font-medium mt-0.5">
                      Plantão {turno} (12h) • {aprazamentosTurno.length} horário(s) agendado(s)
                    </span>
                  </div>
                  {isOnline && (
                    <button
                      type="button"
                      onClick={() => syncOnlinePaciente()}
                      disabled={syncingPrescricoes}
                      className="text-xs text-accent-ink hover:underline flex items-center gap-1 focus:outline-none disabled:opacity-50"
                      title="Sincronizar prescrições da nuvem"
                    >
                      <RotateCw className={`w-3 h-3 ${syncingPrescricoes ? 'animate-spin' : ''}`} />
                      {syncingPrescricoes ? 'Sincronizando...' : 'Atualizar'}
                    </button>
                  )}
                </div>

                {aprazamentosTurno.length === 0 ? (
                  <div className="text-center py-4 text-muted text-xs flex flex-col items-center gap-2">
                    <p>Nenhum medicamento agendado para o plantão {turno.toLowerCase()} (12h).</p>
                    {isOnline && (
                      <button
                        type="button"
                        onClick={() => syncOnlinePaciente()}
                        disabled={syncingPrescricoes}
                        className="text-xs text-accent-ink hover:underline flex items-center gap-1 bg-surface border border-line px-2.5 py-1.5 rounded-lg disabled:opacity-50"
                      >
                        <RotateCw className={`w-3 h-3 ${syncingPrescricoes ? 'animate-spin' : ''}`} />
                        {syncingPrescricoes ? 'Buscando da nuvem...' : 'Buscar prescrições da nuvem'}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {aprazamentosTurno.map((apraz) => {
                      const prescRef = prescricoes.find((p) => String(p.id) === String(apraz.prescricao_id));
                      const medicoNome = apraz.medico_nome || prescRef?.medico_nome;
                      const medicoCrm = apraz.medico_crm || prescRef?.medico_crm;
                      return (
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
                          {medicoNome && (
                            <p className="text-xs font-semibold text-accent-ink">
                              Médico Prescritor: {medicoNome}
                              {medicoCrm ? ` (${medicoCrm})` : ''}
                            </p>
                          )}
                          {apraz.justificativa && (
                            <p className="text-sm text-crit-ink not-italic mt-1">
                              Justificativa: {apraz.justificativa}
                            </p>
                          )}
                        </div>

                        {/* Checagem Actions */}
                        {apraz.status === 'Pendente' ? (
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
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Módulo de Aferição de Sinais Vitais à Beira do Leito */}
          <div className="bg-surface border border-line rounded-xl p-4 shadow-card flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-strong text-muted uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-accent-ink" aria-hidden="true" />
                Aferição de Sinais Vitais (Leito)
              </h3>
              <div className="flex items-center gap-2">
                {ultimaAfericao && !sinaisSalvos && (
                  <span className="text-[11px] text-muted italic">
                    Última às {ultimaAfericao}
                  </span>
                )}
                {sinaisSalvos && (
                  <span className="text-xs font-semibold text-pos-ink bg-pos-soft border border-pos-line px-2 py-0.5 rounded-md flex items-center gap-1 animate-fade-in">
                    <Check className="w-3 h-3" /> Registrado!
                  </span>
                )}
              </div>
            </div>

            {sinaisRegistradosSessao.length > 0 && (
              <div className="bg-pos-soft/60 border border-pos-line rounded-lg p-2.5 flex flex-wrap items-center gap-2 text-xs">
                <span className="font-heavy text-pos-ink text-[11px] uppercase tracking-wider">Aferido nesta sessão:</span>
                {sinaisRegistradosSessao[0].pa_sistolica && (
                  <span className="bg-surface border border-line px-2 py-0.5 rounded font-mono font-semibold text-ink">
                    PA {sinaisRegistradosSessao[0].pa_sistolica}/{sinaisRegistradosSessao[0].pa_diastolica || '--'} mmHg
                  </span>
                )}
                {sinaisRegistradosSessao[0].fc_bpm && (
                  <span className="bg-surface border border-line px-2 py-0.5 rounded font-mono font-semibold text-ink">
                    FC {sinaisRegistradosSessao[0].fc_bpm} bpm
                  </span>
                )}
                {sinaisRegistradosSessao[0].spo2_percent && (
                  <span className="bg-surface border border-line px-2 py-0.5 rounded font-mono font-semibold text-ink">
                    SpO2 {sinaisRegistradosSessao[0].spo2_percent}%
                  </span>
                )}
                {sinaisRegistradosSessao[0].temp_celsius && (
                  <span className="bg-surface border border-line px-2 py-0.5 rounded font-mono font-semibold text-ink">
                    Temp {sinaisRegistradosSessao[0].temp_celsius}°C
                  </span>
                )}
                {sinaisRegistradosSessao[0].glicemia_mg_dl && (
                  <span className="bg-surface border border-line px-2 py-0.5 rounded font-mono font-semibold text-ink">
                    HGT {sinaisRegistradosSessao[0].glicemia_mg_dl} mg/dL
                  </span>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="flex flex-col gap-1">
                <label className="text-muted font-strong">PA Sistólica (mmHg)</label>
                <input
                  type="number"
                  placeholder="Ex: 120"
                  value={paSistolica}
                  onChange={(e) => setPaSistolica(e.target.value)}
                  disabled={isLocked}
                  className="bg-canvas border border-line rounded-lg p-2 text-ink-body font-mono text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-muted font-strong">PA Diastólica (mmHg)</label>
                <input
                  type="number"
                  placeholder="Ex: 80"
                  value={paDiastolica}
                  onChange={(e) => setPaDiastolica(e.target.value)}
                  disabled={isLocked}
                  className="bg-canvas border border-line rounded-lg p-2 text-ink-body font-mono text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-muted font-strong">Freq. Cardíaca (bpm)</label>
                <input
                  type="number"
                  placeholder="Ex: 75"
                  value={fcBpm}
                  onChange={(e) => setFcBpm(e.target.value)}
                  disabled={isLocked}
                  className="bg-canvas border border-line rounded-lg p-2 text-ink-body font-mono text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-muted font-strong">SpO2 (%)</label>
                <input
                  type="number"
                  placeholder="Ex: 98"
                  value={spo2}
                  onChange={(e) => setSpo2(e.target.value)}
                  disabled={isLocked}
                  className="bg-canvas border border-line rounded-lg p-2 text-ink-body font-mono text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-muted font-strong">Temperatura (°C)</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="Ex: 36.5"
                  value={tempCelsius}
                  onChange={(e) => setTempCelsius(e.target.value)}
                  disabled={isLocked}
                  className="bg-canvas border border-line rounded-lg p-2 text-ink-body font-mono text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-muted font-strong">Glicemia (mg/dL)</label>
                <input
                  type="number"
                  placeholder="Ex: 110"
                  value={glicemia}
                  onChange={(e) => setGlicemia(e.target.value)}
                  disabled={isLocked}
                  className="bg-canvas border border-line rounded-lg p-2 text-ink-body font-mono text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={handleSalvarSinaisVitais}
                disabled={isLocked || salvandoSinais}
                className="bg-accent hover:bg-accent-hover text-on-accent text-xs font-strong px-4 py-2 rounded-lg shadow-raised transition-all active:scale-[0.98] disabled:opacity-50 flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                <Activity className="w-3.5 h-3.5" />
                {salvandoSinais ? 'Registrando...' : 'Registrar Sinais Vitais'}
              </button>
            </div>
          </div>

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
                <div className="flex flex-col items-center gap-2">
                  <div className="flex items-center gap-2 text-accent-soft-ink font-heavy text-xs bg-accent-soft border border-accent-line py-2 px-4 rounded-xl">
                    <Check className="w-4 h-4" aria-hidden="true" />
                    <span>Áudio salvo no aparelho ({durationSecs}s)</span>
                  </div>
                  {transcriptionText.startsWith('[Áudio salvo offline') && (
                    <button type="button" disabled={!isOnline || transcribing} onClick={async () => {
                      if (!evolucao) return;
                      const audio = await localDB.getAudio(evolucao.id);
                      if (audio) await transcreverAudio(evolucao.id, audio);
                      else setErrorText('Áudio local não encontrado. Digite o relato antes de assinar.');
                    }} className="rounded-lg bg-accent px-3 py-2 text-xs font-bold text-on-accent disabled:opacity-50">
                      {transcribing ? 'Transcrevendo...' : 'Transcrever áudio'}
                    </button>
                  )}
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

              {transcricaoSimulada && (
                <div className="bg-crit-soft border border-crit-line text-crit-ink text-xs p-2.5 rounded-lg flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>
                    <strong className="font-heavy">Texto simulado, não é o seu áudio.</strong> Nenhum serviço de
                    transcrição está configurado neste ambiente. A assinatura está bloqueada até os trechos marcados
                    com [SIMULAÇÃO] serem removidos.
                  </span>
                </div>
              )}

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
                  onChange={(e) => {
                    setTranscriptionText(e.target.value);
                    if (transcricaoSimulada && !e.target.value.includes('[SIMULAÇÃO]')) {
                      setTranscricaoSimulada(false);
                    }
                  }}
                  placeholder="A evolução estruturada aparecerá aqui automaticamente após gravar o áudio..."
                  className="bg-canvas border border-line rounded-xl p-3 text-xs text-ink-body placeholder-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 focus-visible:ring-offset-surface focus:border-line-strong resize-none"
                />
              )}
            </div>
          </div>

          {/* Seção 3: Assinatura Eletrônica, Reconhecimento Facial e Fechamento */}
          <div className="bg-accent-soft border border-accent-line rounded-xl p-4 shadow-card flex flex-col gap-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-xs font-strong text-ink flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-accent-ink" aria-hidden="true" />
                  Validação de Assinatura Eletrônica
                </h3>
                <p className="text-xs text-muted mt-0.5">
                  Selecione o familiar/responsável que acompanha o encerramento do plantão e assine por Reconhecimento Facial (padrão oficial) ou PIN de contingência.
                </p>
              </div>
              <span className="text-[10px] font-heavy uppercase tracking-wider bg-surface text-accent-ink border border-accent-line px-2 py-0.5 rounded-full shrink-0">
                Biometria SHA-256
              </span>
            </div>

            {!isLocked ? (
              <div className="flex flex-col gap-3">
                {/* Seletor do Familiar / Responsável pela Finalização do Plantão */}
                <div
                  data-testid="secao-selecao-responsavel"
                  className="bg-surface border border-accent-line rounded-xl p-3.5 flex flex-col gap-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="text-[11px] font-heavy text-ink uppercase tracking-wider flex items-center gap-1.5">
                        <UserCheck className="w-4 h-4 text-accent-ink" aria-hidden="true" />
                        Familiar / Responsável pela Finalização do Plantão
                      </span>
                      <p className="text-[11px] text-muted mt-0.5">
                        Indique quem está recebendo a passagem/finalização do plantão no domicílio:
                      </p>
                    </div>
                    <span className="text-[10px] font-heavy text-accent-ink bg-accent-soft border border-accent-line px-2 py-0.5 rounded-full shrink-0">
                      Obrigatório no Plantão
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {responsaveisPaciente.map((r) => {
                      const selecionado = responsavelSelecionadoId === r.id;
                      return (
                        <button
                          key={r.id}
                          type="button"
                          data-testid={`btn-selecionar-responsavel-${r.id}`}
                          onClick={() => setResponsavelSelecionadoId(r.id)}
                          className={`p-2.5 rounded-xl border text-left transition-all flex items-center justify-between gap-2 ${
                            selecionado
                              ? 'bg-accent text-on-accent border-accent shadow-card'
                              : 'bg-canvas hover:bg-chip text-ink border-line'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-heavy truncate flex items-center gap-1.5">
                              <span>{r.nome}</span>
                              {r.principal && (
                                <span
                                  className={`text-[9px] uppercase font-heavy px-1.5 py-0.2 rounded ${
                                    selecionado
                                      ? 'bg-white/20 text-on-accent'
                                      : 'bg-pos-soft text-pos-ink border border-pos-line'
                                  }`}
                                >
                                  Principal
                                </span>
                              )}
                            </div>
                            <div className={`text-[11px] ${selecionado ? 'text-on-accent/90' : 'text-muted'}`}>
                              Vínculo: {r.parentesco}
                              {r.telefone ? ` • ${r.telefone}` : ''}
                            </div>
                          </div>
                          <div
                            className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                              selecionado ? 'bg-white text-accent border-white' : 'border-line'
                            }`}
                          >
                            {selecionado && <Check className="w-3.5 h-3.5" aria-hidden="true" />}
                          </div>
                        </button>
                      );
                    })}

                    <button
                      type="button"
                      data-testid="btn-selecionar-responsavel-outro"
                      onClick={() => setResponsavelSelecionadoId('outro')}
                      className={`p-2.5 rounded-xl border text-left transition-all flex items-center justify-between gap-2 ${
                        responsavelSelecionadoId === 'outro'
                          ? 'bg-accent text-on-accent border-accent shadow-card'
                          : 'bg-canvas hover:bg-chip text-ink border-line'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-heavy">Outro Familiar / Acompanhante</div>
                        <div
                          className={`text-[11px] ${
                            responsavelSelecionadoId === 'outro' ? 'text-on-accent/90' : 'text-muted'
                          }`}
                        >
                          Informar nome manualmente no plantão
                        </div>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                          responsavelSelecionadoId === 'outro' ? 'bg-white text-accent border-white' : 'border-line'
                        }`}
                      >
                        {responsavelSelecionadoId === 'outro' && <Check className="w-3.5 h-3.5" aria-hidden="true" />}
                      </div>
                    </button>
                  </div>

                  {responsavelSelecionadoId === 'outro' && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                      <input
                        type="text"
                        data-testid="input-outro-responsavel-nome"
                        placeholder="Nome completo do familiar presente"
                        value={outroResponsavelNome}
                        onChange={(e) => setOutroResponsavelNome(e.target.value)}
                        className="sm:col-span-2 bg-canvas border border-line rounded-lg px-3 py-2 text-xs text-ink placeholder-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                      />
                      <select
                        data-testid="select-outro-responsavel-parentesco"
                        value={outroResponsavelParentesco}
                        onChange={(e) => setOutroResponsavelParentesco(e.target.value)}
                        className="bg-canvas border border-line rounded-lg px-2.5 py-2 text-xs font-strong text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                      >
                        <option value="Filho(a)">Filho(a)</option>
                        <option value="Cônjuge">Cônjuge</option>
                        <option value="Neto(a)">Neto(a)</option>
                        <option value="Irmão(ã)">Irmão(ã)</option>
                        <option value="Cuidador(a) Familiar">Cuidador(a) Familiar</option>
                        <option value="Familiar">Familiar</option>
                      </select>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  data-testid="btn-abrir-validacao-facial"
                  onClick={handleAbrirValidacaoFacial}
                  disabled={loading}
                  className="w-full bg-accent hover:bg-accent-hover text-on-accent font-strong text-xs py-3 px-4 rounded-xl shadow-raised transition-all active:scale-[0.98] flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                >
                  <Camera className="w-4 h-4" aria-hidden="true" />
                  Assinar com Reconhecimento Facial (Câmera)
                </button>

                <div className="flex gap-2 items-center">
                  <input
                    type="password"
                    maxLength={6}
                    placeholder="PIN (6 dígitos)"
                    value={pinCode}
                    onChange={(e) => setPinCode(e.target.value.replace(/\D/g, ''))}
                    className="bg-surface border border-accent-line rounded-lg px-3 py-2.5 text-center text-xs font-heavy text-ink w-36 sm:w-40 min-h-[44px] placeholder-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 focus-visible:ring-offset-accent-soft focus:border-accent"
                  />
                  <button
                    onClick={handleAssinarProntuario}
                    disabled={loading}
                    className="flex-1 bg-surface hover:bg-chip border border-accent-line text-ink font-strong text-xs py-2.5 min-h-[44px] rounded-lg shadow-card transition-all active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                  >
                    Assinar e Finalizar
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-accent text-on-accent p-3.5 rounded-xl text-center text-xs font-strong flex flex-col gap-1.5">
                <p className="flex items-center justify-center gap-1.5">
                  <CheckSquare className="w-4 h-4" aria-hidden="true" />
                  Prontuário Assinado Digitalmente
                </p>
                <p className="font-normal text-on-accent-muted text-xs">
                  Bloqueado para edições. Documento indexado ao histórico clínico permanente.
                </p>
                {(evolucao?.responsavel_nome || responsavelEfetivo?.nome) && (
                  <p
                    data-testid="responsavel-assinado-resumo"
                    className="text-[11px] font-heavy text-on-accent bg-white/15 px-2.5 py-1 rounded-lg mx-auto"
                  >
                    Familiar / Responsável no Plantão: {evolucao?.responsavel_nome || responsavelEfetivo?.nome}
                    {(evolucao?.responsavel_parentesco || responsavelEfetivo?.parentesco)
                      ? ` (${evolucao?.responsavel_parentesco || responsavelEfetivo?.parentesco})`
                      : ''}
                  </p>
                )}
                {dadosBiometricos && (
                  <div className="mt-1 pt-2 border-t border-white/20 flex flex-col gap-1 text-[10px] font-mono text-on-accent/90">
                    <span className="flex items-center justify-center gap-1 font-sans font-bold uppercase tracking-wider">
                      <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                      {dadosBiometricos.metodo === 'FACIAL'
                        ? 'Biometria Facial Validada (SHA-256)'
                        : 'Assinatura de Contingência Validada (SHA-256)'}
                    </span>
                    <span className="truncate px-2" data-testid="selo-biometrico-assinado">
                      Hash: {dadosBiometricos.biometriaHash}
                    </span>
                  </div>
                )}
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

      {/* Seção 4: Histórico de Evoluções Realizadas no Prontuário do Paciente */}
      {historicoEvolucoes.length > 0 && (
        <div
          data-testid="secao-historico-evolucoes"
          className="bg-surface border border-line rounded-xl p-4 shadow-card flex flex-col gap-3"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-strong text-ink uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-accent-ink" aria-hidden="true" />
              Histórico de Evoluções Realizadas ({historicoEvolucoes.length})
            </h3>
            <span className="text-[11px] font-semibold text-pos-ink bg-pos-soft border border-pos-line px-2 py-0.5 rounded-full">
              Prontuário Ativo
            </span>
          </div>

          <div className="flex flex-col gap-3">
            {historicoEvolucoes.map((evItem) => {
              const dtRef = evItem.data_assinatura || evItem.check_out || evItem.check_in;
              const dataFormatada = dtRef
                ? new Date(dtRef).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                : '';
              const horaInicio = evItem.check_in
                ? new Date(evItem.check_in).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                : '';
              const horaFim = (evItem.check_out || evItem.data_assinatura)
                ? new Date(evItem.check_out || evItem.data_assinatura || '').toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                : '';
              const textoClinico =
                evItem.transcricao_revisada ||
                [
                  evItem.soap_subjetivo ? `[S] ${evItem.soap_subjetivo}` : '',
                  evItem.soap_objetivo ? `[O] ${evItem.soap_objetivo}` : '',
                  evItem.soap_avaliacao ? `[A] ${evItem.soap_avaliacao}` : '',
                  evItem.soap_plano ? `[P] ${evItem.soap_plano}` : '',
                ]
                  .filter(Boolean)
                  .join('\n');
              const hashExtraido =
                evItem.assinatura_biometrica?.biometriaHash ||
                extrairHashBiometricoDeSelo(evItem.assinatura_digital)?.hash ||
                evItem.assinatura_digital;
              const sincronizado = evItem.status === 'Finalizado' || evItem.status === 'Auditado' || (evItem as any).status === 'Concluído';

              return (
                <div
                  key={evItem.id}
                  data-testid={`card-evolucao-historico-${evItem.id}`}
                  className="bg-canvas border border-line rounded-xl p-3.5 flex flex-col gap-2.5 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft pb-2">
                    <div className="flex flex-col">
                      <span className="font-heavy text-ink">
                        {evItem.profissional_nome || cooperadoNome || 'Profissional Cooperado'}
                      </span>
                      <span className="text-[11px] text-muted">
                        {dataFormatada} • {horaInicio}{horaFim ? ` às ${horaFim}` : ''}
                        {evItem.turno ? ` • Turno ${evItem.turno}` : ''}
                      </span>
                      {evItem.responsavel_nome && (
                        <span
                          data-testid={`historico-responsavel-${evItem.id}`}
                          className="text-[11px] font-strong text-accent-ink mt-0.5 flex items-center gap-1"
                        >
                          <UserCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          Familiar / Responsável no Plantão: {evItem.responsavel_nome}
                          {evItem.responsavel_parentesco ? ` (${evItem.responsavel_parentesco})` : ''}
                        </span>
                      )}
                    </div>
                    <span
                      className={`text-[11px] font-heavy px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${
                        sincronizado
                          ? 'bg-pos-soft text-pos-ink border-pos-line'
                          : 'bg-warn-soft text-warn-ink border-warn-line'
                      }`}
                    >
                      <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                      {sincronizado ? 'Assinado & Sincronizado' : 'Aguardando Sincronização'}
                    </span>
                  </div>

                  {Array.isArray(evItem.sinais_vitais) && evItem.sinais_vitais.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {evItem.sinais_vitais[0].pa_sistolica && (
                        <span className="bg-surface border border-line px-2 py-0.5 rounded font-mono text-[11px] font-semibold text-ink">
                          PA {evItem.sinais_vitais[0].pa_sistolica}/{evItem.sinais_vitais[0].pa_diastolica || '--'} mmHg
                        </span>
                      )}
                      {evItem.sinais_vitais[0].fc_bpm && (
                        <span className="bg-surface border border-line px-2 py-0.5 rounded font-mono text-[11px] font-semibold text-ink">
                          FC {evItem.sinais_vitais[0].fc_bpm} bpm
                        </span>
                      )}
                      {evItem.sinais_vitais[0].spo2_percent && (
                        <span className="bg-surface border border-line px-2 py-0.5 rounded font-mono text-[11px] font-semibold text-ink">
                          SpO2 {evItem.sinais_vitais[0].spo2_percent}%
                        </span>
                      )}
                      {evItem.sinais_vitais[0].temp_celsius && (
                        <span className="bg-surface border border-line px-2 py-0.5 rounded font-mono text-[11px] font-semibold text-ink">
                          Temp {evItem.sinais_vitais[0].temp_celsius}°C
                        </span>
                      )}
                      {evItem.sinais_vitais[0].glicemia_mg_dl && (
                        <span className="bg-surface border border-line px-2 py-0.5 rounded font-mono text-[11px] font-semibold text-ink">
                          HGT {evItem.sinais_vitais[0].glicemia_mg_dl} mg/dL
                        </span>
                      )}
                    </div>
                  )}

                  {textoClinico && (
                    <div className="bg-surface border border-line-soft rounded-lg p-2.5 text-ink-body whitespace-pre-wrap leading-relaxed">
                      {textoClinico}
                    </div>
                  )}

                  {hashExtraido && (
                    <div className="flex items-center justify-between gap-2 pt-1 text-[10px] font-mono text-muted">
                      <span className="flex items-center gap-1 font-sans font-semibold text-accent-ink">
                        <ShieldCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        Assinatura Biométrica SHA-256 Validada
                      </span>
                      <span className="truncate max-w-[180px]" title={String(hashExtraido)}>
                        {String(hashExtraido)}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal de Validação Facial WebRTC */}
      <ValidacaoFacialModal
        aberto={showFacialModal}
        cooperadoId={cooperadoId}
        cooperadoNome={cooperadoNome}
        cooperadoCpf={cooperadoCpf}
        evolucaoId={evolucao?.id || `ev_${pacienteId}`}
        loading={loading}
        responsaveisDisponiveis={responsaveisPaciente}
        responsavelSelecionadoId={responsavelEfetivo.id}
        onSelecionarResponsavel={(idResp) => setResponsavelSelecionadoId(idResp)}
        responsavelNome={responsavelEfetivo.nome}
        responsavelParentesco={responsavelEfetivo.parentesco}
        onFechar={() => setShowFacialModal(false)}
        onConfirmar={finalizarComDadosBiometricos}
      />

      {/* Botão de retorno para a Agenda */}
      <button
        type="button"
        onClick={() => router.push('/cooperado')}
        className="w-full bg-invert hover:bg-invert-hover text-on-invert font-strong text-xs py-3 rounded-xl shadow-raised transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        Voltar para a Agenda
      </button>
    </div>
  );
}
