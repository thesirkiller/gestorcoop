/* eslint-disable */
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import axios from 'axios';
import {
  FileText,
  ArrowLeft,
  Calendar,
  Clock,
  User,
  ShieldCheck,
  Pill,
  CheckCircle,
  AlertOctagon,
  Headphones,
  Printer,
  Sparkles,
  Plus,
  Activity,
  Heart,
  AlertTriangle,
  FileCheck2,
  Stethoscope,
  ChevronDown,
  ChevronUp,
  X,
  Loader2,
  Phone,
  MapPin,
  ShieldAlert,
  Play,
  Volume2,
  CheckCircle2,
  Copy,
  Link2,
  MessageCircle,
  Check,
} from 'lucide-react';
import Link from 'next/link';
import type { PlanoTerapeutico } from '@/lib/tipos-clinicos';
import DashboardGeral from './dashboard-geral';
import PlanoTerapeuticoTab from './plano-terapeutico-tab';
import { obterUrlCooperado } from '@/lib/subdominios';
import { invalidarCacheNavegacao, CHAVE_CACHE_LISTAGEM_PACIENTES } from '@/lib/cache-navegacao';

interface PacienteData {
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
  numero_carteirinha?: string;
  warnings?: string[];
  status?: string;
  limite_visitas_mes?: number;
  visitas_realizadas_mes?: number;
  visitas_restantes_mes?: number;
  limite_atingido?: boolean;
  created_at?: string;
}

interface EvolucaoData {
  id: string;
  paciente_id: string;
  profissional_id: string;
  profissional_nome?: string;
  tipo_profissional: string;
  profissional_registro?: string;
  turno?: string;
  check_in: string;
  check_out: string;
  audio_url?: string;
  transcricao_crua?: string;
  transcricao_revisada?: string;
  soap_subjetivo?: string;
  soap_objetivo?: string;
  soap_avaliacao?: string;
  soap_plano?: string;
  status: string;
  data_assinatura?: string;
  assinatura_digital?: string;
  parecer_auditoria?: string;
  auditado_por?: string;
  data_auditoria?: string;
}

interface PrescricaoData {
  id: string;
  paciente_id: string;
  medico_nome?: string;
  medico_crm?: string;
  medicamento: string;
  dosagem: string;
  via_administracao: string;
  frequencia_horas: number;
  horarios_padrao?: string[];
  data_inicio: string;
  data_fim: string;
  instrucoes?: string;
  status: 'Ativa' | 'Suspensa' | 'Concluída';
}

interface SinalVitalData {
  id: string;
  paciente_id: string;
  data_hora: string;
  pa_sistolica?: number;
  pa_diastolica?: number;
  fc_bpm?: number;
  fr_rpm?: number;
  temp_celsius?: number;
  spo2_percent?: number;
  glicemia_mg_dl?: number;
  dor_escala?: number;
  nivel_consciencia?: string;
  observacoes?: string;
  profissional_nome?: string;
}

interface ParecerData {
  id: string;
  auditor_nome: string;
  tipo_parecer: string;
  descricao: string;
  data_registro: string;
}

export default function Prontuario360Detalhe() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [partialWarning, setPartialWarning] = useState<string | null>(null);

  const [paciente, setPaciente] = useState<PacienteData | null>(null);
  const [evolucoes, setEvolucoes] = useState<EvolucaoData[]>([]);
  const [prescricoes, setPrescricoes] = useState<PrescricaoData[]>([]);
  const [sinaisVitais, setSinaisVitais] = useState<SinalVitalData[]>([]);
  const [pareceres, setPareceres] = useState<ParecerData[]>([]);

  // Planos Terapêuticos e Equipamentos da Dashboard Individual
  const [planos, setPlanos] = useState<PlanoTerapeutico[]>([]);
  const [planoVigente, setPlanoVigente] = useState<PlanoTerapeutico | null>(null);
  const [equipamentos, setEquipamentos] = useState<any[]>([]);

  const [activeTab, setActiveTab] = useState<'geral' | 'plano' | 'evolucoes' | 'prescricoes' | 'sinais' | 'auditoria'>('geral');
  const [expandedEvolucaoId, setExpandedEvolucaoId] = useState<string | null>(null);

  // Modais
  const [isNovaPrescricaoOpen, setIsNovaPrescricaoOpen] = useState(false);
  const [isNovoSinalOpen, setIsNovoSinalOpen] = useState(false);
  const [isNovoParecerOpen, setIsNovoParecerOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);

  // Compartilhamento com Cooperado
  const [copiadoLink, setCopiadoLink] = useState(false);
  const [toastDetalhe, setToastDetalhe] = useState<string | null>(null);

  const copiarLinkCooperado = async () => {
    if (!paciente) return;
    try {
      const url = obterUrlCooperado(`/prontuario/${paciente.id}`);
      if (typeof window !== 'undefined' && navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else if (typeof document !== 'undefined') {
        const textArea = document.createElement('textarea');
        textArea.value = url;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopiadoLink(true);
      setToastDetalhe(`Link de atendimento copiado para o paciente ${paciente.nome}!`);
      setTimeout(() => {
        setCopiadoLink(false);
        setToastDetalhe(null);
      }, 3500);
    } catch (e) {
      console.error('Erro ao copiar link:', e);
    }
  };

  // Forms
  const [novaPrescricaoForm, setNovaPrescricaoForm] = useState({
    medicamento: '',
    dosagem: '',
    via_administracao: 'Oral',
    frequencia_horas: 12,
    horarios_padrao: '08:00, 20:00',
    instrucoes: '',
    medico_nome: 'Dr. Roberto Cardozo',
    medico_crm: 'CRM-SP 114520',
  });

  const [novoSinalForm, setNovoSinalForm] = useState({
    pa_sistolica: '120',
    pa_diastolica: '80',
    fc_bpm: '78',
    fr_rpm: '18',
    temp_celsius: '36.5',
    spo2_percent: '98',
    glicemia_mg_dl: '',
    dor_escala: '0',
    nivel_consciencia: 'Alerta',
    observacoes: '',
  });

  const [novoParecerForm, setNovoParecerForm] = useState({
    tipo_parecer: 'Conforme',
    descricao: '',
    auditor_nome: 'Dr. Marcos Gestor',
  });

  // Paciente atualmente exibido e requisição de equipamentos em voo: respostas
  // que chegam depois de trocar de paciente (ou de sair da tela) são descartadas.
  const idAtualRef = useRef(id);
  const equipamentosAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    idAtualRef.current = id;
    setEquipamentos([]);
    carregarProntuarioCompleto();
    return () => {
      equipamentosAbortRef.current?.abort();
      equipamentosAbortRef.current = null;
    };
  }, [id]);

  const carregarEquipamentos = async () => {
    const alvo = id;
    equipamentosAbortRef.current?.abort();
    const controle = new AbortController();
    equipamentosAbortRef.current = controle;
    const obsoleta = () => controle.signal.aborted || idAtualRef.current !== alvo;
    try {
      const res = await axios.get(`/api/gestor/prontuarios/pacientes/${alvo}/equipamentos`, {
        signal: controle.signal,
      });
      if (obsoleta()) return;
      if (res.data?.success && Array.isArray(res.data.data)) {
        setEquipamentos(res.data.data);
      }
    } catch (err) {
      if (obsoleta() || axios.isCancel(err)) return;
      console.warn('Erro ao carregar equipamentos do paciente:', err);
      setPartialWarning('Os equipamentos do paciente não puderam ser carregados agora. Os dados clínicos estão atualizados.');
    } finally {
      if (equipamentosAbortRef.current === controle) equipamentosAbortRef.current = null;
    }
  };

  const carregarProntuarioCompleto = async (silencioso = false) => {
    const alvo = id;
    const obsoleta = () => idAtualRef.current !== alvo;
    if (!silencioso) setLoading(true);
    setError(null);
    setPartialWarning(null);
    try {
      // Tenta buscar pelo endpoint 360 de paciente
      const res = await axios.get(`/api/gestor/prontuarios/pacientes/${id}`);
      if (obsoleta()) return;
      if (res.data.success && res.data.data) {
        const d = res.data.data;
        setPaciente(d.paciente);
        setEvolucoes(d.evolucoes || []);
        setPrescricoes(d.prescricoes || []);
        setSinaisVitais(d.sinaisVitais || []);
        setPareceres(d.pareceres || []);
        if (d.evolucoes && d.evolucoes.length > 0) {
          setExpandedEvolucaoId(d.evolucoes[0].id);
        }

        // Servidor novo: `/pacientes/[id]` já trouxe planos e plano vigente numa
        // única ida ao banco. Os equipamentos (Bubble, mais lento) chegam em
        // segundo plano, sem segurar a tela.
        if (d.completo === true) {
          const planosCarregados: PlanoTerapeutico[] = Array.isArray(d.planos) ? d.planos : [];
          // Mesma regra do caminho antigo: plano Ativo mais recente, senão o vigente do servidor, senão o primeiro.
          const ativoRecente = planosCarregados.find((p: any) => p.status === 'Ativo');
          setPlanos(planosCarregados);
          setPlanoVigente(ativoRecente || d.planoVigente || planosCarregados[0] || null);
          if (!silencioso) carregarEquipamentos();
          return;
        }

        // Buscar dados unificados da dashboard do paciente, planos, prescrições, sinais e pareceres em paralelo
        try {
          const [resDash, resPlanos, resPresc, resSinais, resPareceres] = await Promise.allSettled([
            axios.get(`/api/gestor/prontuarios/pacientes/${id}/dashboard`),
            axios.get(`/api/gestor/prontuarios/pacientes/${id}/planos`),
            axios.get(`/api/gestor/prontuarios/pacientes/${id}/prescricoes`),
            axios.get(`/api/gestor/prontuarios/pacientes/${id}/sinais-vitais`),
            axios.get(`/api/gestor/prontuarios/pacientes/${id}/parecer`),
          ]);
          if (obsoleta()) return;
          if ([resDash, resPlanos, resPresc, resSinais, resPareceres].some((result) => result.status === 'rejected' ||
            (result.status === 'fulfilled' && result.value.data?.success !== true))) {
            setPartialWarning('Parte dos dados do prontuário não pôde ser carregada. Atualize a página antes de tomar decisões clínicas.');
          }

          let planosCarregados: PlanoTerapeutico[] = [];
          let planoVigenteCarregado: PlanoTerapeutico | null = null;

          if (resDash.status === 'fulfilled' && resDash.value.data?.success && resDash.value.data?.data) {
            const dash = resDash.value.data.data;
            planoVigenteCarregado = dash.planoVigente || null;
            if (Array.isArray(dash.planos) && dash.planos.length > 0) {
              planosCarregados = dash.planos;
            }
            setEquipamentos(dash.equipamentos || []);
          }

          if (resPlanos.status === 'fulfilled' && resPlanos.value.data?.success && Array.isArray(resPlanos.value.data?.data)) {
            const listaPlanos = resPlanos.value.data.data;
            if (listaPlanos.length > 0) {
              planosCarregados = listaPlanos;
              const ativoRecente = listaPlanos.find((p: any) => p.status === 'Ativo');
              if (ativoRecente) {
                planoVigenteCarregado = ativoRecente;
              } else if (!planoVigenteCarregado) {
                planoVigenteCarregado = listaPlanos[0];
              }
            }
          }

          if (resPresc.status === 'fulfilled' && resPresc.value.data?.success && Array.isArray(resPresc.value.data?.data) && resPresc.value.data.data.length > 0) {
            setPrescricoes(resPresc.value.data.data);
          }

          if (resSinais.status === 'fulfilled' && resSinais.value.data?.success && Array.isArray(resSinais.value.data?.data) && resSinais.value.data.data.length > 0) {
            setSinaisVitais(resSinais.value.data.data);
          }

          if (resPareceres.status === 'fulfilled' && resPareceres.value.data?.success && Array.isArray(resPareceres.value.data?.data) && resPareceres.value.data.data.length > 0) {
            setPareceres(resPareceres.value.data.data);
          }

          setPlanos(planosCarregados);
          setPlanoVigente(planoVigenteCarregado);
        } catch (err) {
          console.warn('Erro ao carregar dashboard e planos:', err);
        }
      } else {
        // Fallback: se id for de uma evolução, busca paciente correspondente
        // (só precisa de id/paciente_id: pede a projeção leve da linha do tempo)
        const resEvo = await axios.get('/api/gestor/prontuarios', {
          headers: { 'X-Gestorcoop-Projecao': 'resumo' },
        });
        if (obsoleta()) return;
        const evo = resEvo.data.results?.find((e: any) => e.id === id || e.paciente_id === id);
        if (evo) {
          const resPac = await axios.get(`/api/gestor/prontuarios/pacientes/${evo.paciente_id || id}`);
          if (obsoleta()) return;
          if (resPac.data.success) {
            const d = resPac.data.data;
            setPaciente(d.paciente);
            setEvolucoes(d.evolucoes || []);
            setPrescricoes(d.prescricoes || []);
            setSinaisVitais(d.sinaisVitais || []);
            setPareceres(d.pareceres || []);
            setExpandedEvolucaoId(id);
          }
        } else {
          setError('Prontuário clínico não localizado.');
        }
      }
    } catch (e: any) {
      if (obsoleta()) return;
      console.error('Erro ao carregar prontuário 360:', e);
      setError(e.response?.data?.error || 'Erro ao carregar dados do prontuário.');
    } finally {
      // A carga do paciente novo controla o próprio indicador de carregamento.
      if (!silencioso && !obsoleta()) setLoading(false);
    }
  };

  const handleSalvarPrescricao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paciente) return;
    setSalvando(true);
    try {
      const horarios = (novaPrescricaoForm.horarios_padrao || '')
        .split(',')
        .map((h) => h.trim())
        .filter((h) => h.length > 0);

      const res = await axios.post(`/api/gestor/prontuarios/pacientes/${paciente.id}/prescricoes`, {
        ...novaPrescricaoForm,
        horarios_padrao: horarios,
        frequencia_horas: Number(novaPrescricaoForm.frequencia_horas),
      });

      if (res.data?.success && res.data?.data) {
        setPrescricoes((prev) => [res.data.data, ...prev]);
        invalidarCacheNavegacao(CHAVE_CACHE_LISTAGEM_PACIENTES);
      }

      setIsNovaPrescricaoOpen(false);
      setNovaPrescricaoForm({
        medicamento: '',
        dosagem: '',
        via_administracao: 'Oral',
        frequencia_horas: 12,
        horarios_padrao: '08:00, 20:00',
        instrucoes: '',
        medico_nome: 'Dr. Roberto Cardozo',
        medico_crm: 'CRM-SP 114520',
      });
      await carregarProntuarioCompleto(true);
    } catch (err: any) {
      console.error('Erro ao salvar prescrição:', err);
    } finally {
      setSalvando(false);
    }
  };

  const handleSalvarSinalVital = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paciente) return;
    setSalvando(true);
    try {
      const res = await axios.post(`/api/gestor/prontuarios/pacientes/${paciente.id}/sinais-vitais`, novoSinalForm);
      if (res.data?.success && res.data?.data) {
        setSinaisVitais((prev) => [res.data.data, ...prev]);
        invalidarCacheNavegacao(CHAVE_CACHE_LISTAGEM_PACIENTES);
      }

      setIsNovoSinalOpen(false);
      setNovoSinalForm({
        pa_sistolica: '120',
        pa_diastolica: '80',
        fc_bpm: '78',
        fr_rpm: '18',
        temp_celsius: '36.5',
        spo2_percent: '98',
        glicemia_mg_dl: '',
        dor_escala: '0',
        nivel_consciencia: 'Alerta',
        observacoes: '',
      });
      await carregarProntuarioCompleto(true);
    } catch (err: any) {
      console.error('Erro ao registrar sinal vital:', err);
    } finally {
      setSalvando(false);
    }
  };

  const handleSalvarParecer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paciente) return;
    setSalvando(true);
    try {
      const res = await axios.post(`/api/gestor/prontuarios/pacientes/${paciente.id}/parecer`, novoParecerForm);
      if (res.data?.success && res.data?.data) {
        setPareceres((prev) => [res.data.data, ...prev]);
      }

      setIsNovoParecerOpen(false);
      setNovoParecerForm({
        tipo_parecer: 'Conforme',
        descricao: '',
        auditor_nome: 'Dr. Marcos Gestor',
      });
      await carregarProntuarioCompleto(true);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao registrar parecer.');
    } finally {
      setSalvando(false);
    }
  };

  const [editandoCota, setEditandoCota] = useState(false);
  const [novaCotaValor, setNovaCotaValor] = useState('');
  const [salvandoCota, setSalvandoCota] = useState(false);

  const handleSalvarCota = async () => {
    if (!paciente) return;
    setSalvandoCota(true);
    try {
      await axios.put(`/api/gestor/prontuarios/pacientes/${paciente.id}`, {
        ...paciente,
        limite_visitas_mes: Number(novaCotaValor) || 0,
      });
      invalidarCacheNavegacao(CHAVE_CACHE_LISTAGEM_PACIENTES);
      setEditandoCota(false);
      await carregarProntuarioCompleto();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao atualizar cota de visitas.');
    } finally {
      setSalvandoCota(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 lg:p-8 space-y-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="h-8 w-44 bg-slate-200 rounded-xl animate-pulse"></div>
          <div className="h-8 w-36 bg-slate-200 rounded-xl animate-pulse"></div>
        </div>
        <div className="max-w-7xl mx-auto bg-white rounded-2xl border border-slate-200 p-6 lg:p-8 shadow-sm animate-pulse space-y-6">
          <div className="flex flex-col lg:flex-row justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-2xl bg-slate-200"></div>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <div className="h-4 w-28 bg-slate-200 rounded-full"></div>
                  <div className="h-4 w-20 bg-slate-200 rounded-full"></div>
                </div>
                <div className="h-8 w-64 bg-slate-200 rounded-xl"></div>
                <div className="h-4 w-48 bg-slate-100 rounded"></div>
              </div>
            </div>
            <div className="h-20 w-72 bg-slate-100 rounded-2xl"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
            <div className="h-16 bg-slate-100 rounded-xl"></div>
            <div className="h-16 bg-slate-100 rounded-xl"></div>
          </div>
          <div className="h-24 bg-slate-100 rounded-2xl"></div>
        </div>
        <div className="max-w-7xl mx-auto space-y-4">
          <div className="h-10 w-96 bg-slate-200 rounded-xl animate-pulse"></div>
          <div className="h-64 bg-white rounded-2xl border border-slate-200 animate-pulse"></div>
        </div>
      </div>
    );
  }

  if (error || !paciente) {
    return (
      <div className="min-h-screen bg-slate-50 p-8 flex items-center justify-center">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center max-w-md w-full shadow-lg">
          <AlertOctagon className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-900 mb-1">Prontuário Não Encontrado</h2>
          <p className="text-xs text-slate-500 mb-6">{error || 'O registro solicitado não existe ou foi removido.'}</p>
          <Link
            href="/gestor/prontuarios"
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2.5 px-5 rounded-xl transition-all inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar aos Prontuários
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-6 lg:p-8 print:bg-white print:p-2">
      {partialWarning && <div role="alert" className="max-w-7xl mx-auto mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">{partialWarning}</div>}
      {/* Action Bar / Navigation com Breadcrumb */}
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 print:hidden">
        <div className="flex items-center gap-2 text-xs">
          <Link
            href="/gestor/prontuarios"
            className="text-slate-500 hover:text-indigo-600 font-medium inline-flex items-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Pacientes
          </Link>
          <span className="text-slate-300">/</span>
          <span className="text-slate-800 font-bold">Prontuário Individual</span>
          <span className="text-slate-300">/</span>
          <span className="text-indigo-600 font-bold uppercase tracking-wider text-[11px] bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-100">
            {activeTab === 'geral'
              ? 'Dashboard Geral'
              : activeTab === 'plano'
              ? 'Plano Terapêutico'
              : activeTab === 'evolucoes'
              ? 'Evoluções & SOAP'
              : activeTab === 'prescricoes'
              ? 'Prescrições'
              : activeTab === 'sinais'
              ? 'Sinais Vitais'
              : 'Logs & Auditoria'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={copiarLinkCooperado}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-2 shadow-sm border ${
              copiadoLink
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600'
            }`}
            title="Copiar link de atendimento deste paciente para o cooperado"
          >
            {copiadoLink ? (
              <>
                <Check className="w-4 h-4 text-white" />
                <span>Link Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Copiar Link do Cooperado</span>
              </>
            )}
          </button>

          <a
            href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
              `Olá! Segue o link de acesso ao prontuário do paciente *${paciente.nome}* no GestorCoop:\n\n${obterUrlCooperado(`/prontuario/${paciente.id}`)}`
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1.5 shadow-sm"
            title="Enviar link via WhatsApp para o cooperado"
          >
            <MessageCircle className="w-4 h-4" />
            <span className="hidden sm:inline">WhatsApp</span>
          </a>

          <button
            onClick={() => window.print()}
            className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 px-3.5 py-2 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-2 shadow-sm"
          >
            <Printer className="w-4 h-4 text-indigo-600" />
            Imprimir / Exportar PDF
          </button>
        </div>
      </div>

      {/* Patient Header 360 Card */}
      <div className="max-w-7xl mx-auto bg-white rounded-2xl border border-slate-200 p-6 lg:p-8 shadow-sm mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
              <User className="w-8 h-8" />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                    paciente.complexidade === 'Alta'
                      ? 'bg-rose-100 text-rose-800 border border-rose-200'
                      : paciente.complexidade === 'Média'
                      ? 'bg-amber-100 text-amber-800 border border-amber-200'
                      : paciente.complexidade === 'Baixa'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : 'bg-slate-100 text-slate-700 border border-slate-200'
                  }`}
                >
                  Complexidade {paciente.complexidade || 'não informada'}
                </span>

                <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  {paciente.status || 'Status não informado'}
                </span>

                {paciente.plano_saude && (
                  <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-slate-200">
                    {paciente.plano_saude}
                  </span>
                )}
              </div>

              <h1 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">
                {paciente.nome}
              </h1>

              <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-500 mt-1">
                <span className="font-mono">CPF: <strong className="text-slate-800">{paciente.cpf}</strong></span>
                {paciente.data_nascimento && (
                  <span>Nascimento: <strong className="text-slate-800">{paciente.data_nascimento}</strong></span>
                )}
                {paciente.telefone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3 h-3 text-slate-400" />
                    {paciente.telefone}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Domicílio & Responsável */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs space-y-1.5 min-w-[280px]">
            {paciente.endereco && (
              <p className="flex items-start gap-1.5 text-slate-700">
                <MapPin className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                <span className="line-clamp-2">{paciente.endereco}</span>
              </p>
            )}
            {paciente.responsavel_nome && (
              <p className="text-slate-600">
                Responsável: <strong className="text-slate-800">{paciente.responsavel_nome}</strong>
                {paciente.responsavel_telefone ? ` (${paciente.responsavel_telefone})` : ''}
              </p>
            )}
          </div>
        </div>

        {/* Diagnóstico & Warnings Banner */}
        <div className="mt-5 pt-5 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 text-xs">
            <span className="font-bold text-indigo-900 block mb-0.5">Diagnóstico Clínico Principal</span>
            <p className="text-indigo-950 font-medium">
              {paciente.diagnostico_principal || 'Sem diagnóstico cadastrado'}
              {paciente.cid10 && <span className="ml-1 font-mono font-bold">({paciente.cid10})</span>}
            </p>
          </div>

          <div className="bg-rose-50/60 p-3 rounded-xl border border-rose-200 text-xs">
            <span className="font-bold text-rose-900 flex items-center gap-1 mb-1">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              Alergias & Alertas Críticos
            </span>
            <div className="flex flex-wrap gap-1.5">
              {paciente.warnings && paciente.warnings.length > 0 ? (
                paciente.warnings.map((w, idx) => (
                  <span
                    key={idx}
                    className="bg-white/80 text-rose-800 border border-rose-300 px-2 py-0.5 rounded-md font-bold text-[11px]"
                  >
                    {w}
                  </span>
                ))
              ) : (
                <span className="text-rose-700 italic">Sem registro de alergias ou alertas críticos.</span>
              )}
            </div>
          </div>
        </div>

        {/* A cota por especialidade pertence ao plano terapêutico. A cota legada
            só aparece enquanto não existe um plano para este paciente. */}
        {planos.length === 0 && Number(paciente.limite_visitas_mes) > 0 && <div className="mt-4 p-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-900">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider border border-slate-200">
                  Cota Contratada de Visitas Técnicas
                </span>
                {paciente.limite_atingido ? (
                  <span className="bg-rose-50 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded-md border border-rose-200 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-rose-400" />
                    Cota Esgotada - Bloqueio Ativo
                  </span>
                ) : (
                  <span className="bg-emerald-50 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-md border border-emerald-200">
                    {paciente.visitas_restantes_mes !== undefined ? `${paciente.visitas_restantes_mes} visitas restantes` : 'Sem limite'}
                  </span>
                )}
              </div>
              <h3 className="text-base font-bold tracking-tight">
                {paciente.visitas_realizadas_mes || 0} de {paciente.limite_visitas_mes || 0} visitas técnicas realizadas este mês
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                {paciente.limite_atingido
                  ? 'Novas visitas ficam bloqueadas até o início do próximo mês ou ajuste da cota.'
                  : `Restam ${paciente.visitas_restantes_mes ?? (paciente.limite_visitas_mes || 0)} visitas para o teto contratado do paciente.`}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {editandoCota ? (
                <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border border-slate-200">
                  <input
                    type="number"
                    min="0"
                    max="120"
                    value={novaCotaValor}
                    onChange={(e) => setNovaCotaValor(e.target.value)}
                    className="w-20 px-2 py-1 bg-white text-slate-900 font-bold rounded-lg text-xs"
                    placeholder="Qtd"
                  />
                  <button
                    onClick={handleSalvarCota}
                    disabled={salvandoCota}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs px-2.5 py-1 rounded-lg transition-all disabled:opacity-50"
                  >
                    {salvandoCota ? 'Salvando...' : 'Salvar'}
                  </button>
                  <button
                    onClick={() => setEditandoCota(false)}
                    className="text-slate-600 hover:text-slate-900 text-xs px-1.5 py-1"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setNovaCotaValor(String(paciente.limite_visitas_mes || 13));
                    setEditandoCota(true);
                  }}
                  className="bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0"
                >
                  Alterar Cota Mensal
                </button>
              )}
            </div>
          </div>

          {/* Barra de Progresso */}
          {paciente.limite_visitas_mes !== undefined && paciente.limite_visitas_mes > 0 && (
            <div className="mt-3 w-full bg-slate-200 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  paciente.limite_atingido
                    ? 'bg-rose-500'
                    : (paciente.visitas_realizadas_mes || 0) / paciente.limite_visitas_mes > 0.8
                    ? 'bg-amber-400'
                    : 'bg-emerald-400'
                }`}
                style={{
                  width: `${Math.min(100, Math.round(((paciente.visitas_realizadas_mes || 0) / paciente.limite_visitas_mes) * 100))}%`,
                }}
              />
            </div>
          )}
        </div>}
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto border-b border-slate-200 mb-6 flex items-center justify-between print:hidden">
        <div className="flex items-center gap-3 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab('geral')}
            className={`pb-3 px-2 font-bold text-sm transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'geral'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Activity className="w-4 h-4" />
            Geral (Dashboard)
          </button>

          <button
            onClick={() => setActiveTab('plano')}
            className={`pb-3 px-2 font-bold text-sm transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'plano'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Plano Terapêutico ({planos.length})
          </button>

          <button
            onClick={() => setActiveTab('evolucoes')}
            className={`pb-3 px-2 font-bold text-sm transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'evolucoes'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <FileText className="w-4 h-4" />
            Evoluções Clínicas & SOAP ({evolucoes.length})
          </button>

          <button
            onClick={() => setActiveTab('prescricoes')}
            className={`pb-3 px-2 font-bold text-sm transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'prescricoes'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Pill className="w-4 h-4" />
            Prescrições Médicas ({prescricoes.length})
          </button>

          <button
            onClick={() => setActiveTab('sinais')}
            className={`pb-3 px-2 font-bold text-sm transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'sinais'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Activity className="w-4 h-4" />
            Sinais Vitais ({sinaisVitais.length})
          </button>

          <button
            onClick={() => setActiveTab('auditoria')}
            className={`pb-3 px-2 font-bold text-sm transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'auditoria'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            Auditoria & Pareceres ({pareceres.length})
          </button>
        </div>

        {/* Tab-specific Actions */}
        {activeTab === 'prescricoes' && (
          <button
            onClick={() => setIsNovaPrescricaoOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Nova Prescrição
          </button>
        )}
        {activeTab === 'sinais' && (
          <button
            onClick={() => setIsNovoSinalOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Aferir Sinais
          </button>
        )}
        {activeTab === 'auditoria' && (
          <button
            onClick={() => setIsNovoParecerOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Emitir Parecer
          </button>
        )}
      </div>

      {/* Main Tab Content */}
      <div className="max-w-7xl mx-auto space-y-6">
        {/* ABA: DASHBOARD GERAL INDIVIDUAL */}
        {activeTab === 'geral' && (
          <DashboardGeral
            paciente={paciente}
            planoVigente={planoVigente}
            equipamentos={equipamentos}
            evolucoes={evolucoes}
            prescricoes={prescricoes}
            onIrParaPlano={() => setActiveTab('plano')}
            onIrParaProntuario={() => setActiveTab('evolucoes')}
          />
        )}

        {/* ABA: PLANO TERAPÊUTICO */}
        {activeTab === 'plano' && (
          <PlanoTerapeuticoTab
            pacienteId={paciente.id}
            pacienteNome={paciente.nome}
            planos={planos}
            onPlanoAtualizado={(novoPlano) => {
              if (novoPlano && novoPlano.status === 'Ativo') {
                setPlanoVigente(novoPlano);
                setPlanos((prev) => {
                  const idx = prev.findIndex((p) => p.id === novoPlano.id);
                  if (idx >= 0) {
                    const c = [...prev];
                    c[idx] = novoPlano;
                    return c;
                  }
                  return [novoPlano, ...prev];
                });
              }
              carregarProntuarioCompleto(true);
            }}
          />
        )}

        {/* ABA 1: EVOLUÇÕES CLÍNICAS (SOAP) */}
        {activeTab === 'evolucoes' && (
          <div className="space-y-4">
            {evolucoes.length === 0 ? (
              <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center">
                <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-800">Nenhuma evolução registrada</h3>
                <p className="text-xs text-slate-500 mt-1">
                  As evoluções gravadas por áudio e assinadas pelos cooperados aparecerão aqui em tempo real.
                </p>
              </div>
            ) : (
              evolucoes.map((ev) => {
                const isExpanded = expandedEvolucaoId === ev.id;
                return (
                  <div
                    key={ev.id}
                    className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden transition-all"
                  >
                    {/* Header do Card da Evolução */}
                    <div
                      onClick={() => setExpandedEvolucaoId(isExpanded ? null : ev.id)}
                      className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                          <FileCheck2 className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm">
                              {ev.profissional_nome || 'Profissional Cooperado'}
                            </span>
                            <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-md">
                              {ev.tipo_profissional.replace('_', ' ')}
                            </span>
                            {ev.profissional_registro && (
                              <span className="text-[10px] text-slate-450 font-mono">
                                ({ev.profissional_registro})
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {new Date(ev.check_in).toLocaleDateString('pt-BR')} das{' '}
                            {new Date(ev.check_in).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} até{' '}
                            {new Date(ev.check_out).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            {ev.turno ? ` • Turno ${ev.turno}` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {ev.audio_url && (
                          <span className="bg-slate-100 text-slate-700 text-xs font-semibold px-2.5 py-1 rounded-lg flex items-center gap-1">
                            <Headphones className="w-3.5 h-3.5 text-indigo-600" />
                            Áudio Gravado
                          </span>
                        )}

                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                            ev.status === 'Auditado'
                              ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {ev.status}
                        </span>

                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                    </div>

                    {/* Conteúdo Expandido da Evolução */}
                    {isExpanded && (
                      <div className="p-6 border-t border-slate-100 bg-slate-50/40 space-y-6">
                        {/* Audio Player if present */}
                        {ev.audio_url && (
                          <div className="bg-white p-3 rounded-2xl border border-slate-200 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                              <Volume2 className="w-4 h-4 text-indigo-600" />
                              <span className="text-xs font-bold text-slate-700">Áudio Original do Relato Clínico:</span>
                            </div>
                            <audio controls className="h-8 max-w-xs">
                              <source src={ev.audio_url} type="audio/webm" />
                              <source src={ev.audio_url} type="audio/mp4" />
                              Seu navegador não suporta reprodução de áudio.
                            </audio>
                          </div>
                        )}

                        {/* SOAP Format Structured Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* S: Subjetivo */}
                          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                            <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider mb-2 inline-block">
                              S — Subjetivo (Queixas & Relato)
                            </span>
                            <p className="text-xs text-slate-800 leading-relaxed">
                              {ev.soap_subjetivo || 'Paciente calmo e colaborativo durante a visita, sem queixas álgicas agudas.'}
                            </p>
                          </div>

                          {/* O: Objetivo */}
                          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider mb-2 inline-block">
                              O — Objetivo (Exame Físico & Sinais)
                            </span>
                            <p className="text-xs text-slate-800 leading-relaxed">
                              {ev.soap_objetivo || ev.transcricao_revisada || 'Sinais vitais estáveis, dispositivos e curativos íntegros.'}
                            </p>
                          </div>

                          {/* A: Avaliação */}
                          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                            <span className="bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider mb-2 inline-block">
                              A — Avaliação (Juízo Clínico)
                            </span>
                            <p className="text-xs text-slate-800 leading-relaxed">
                              {ev.soap_avaliacao || 'Evolução clínica dentro do esperado para o plano de assistência domiciliar.'}
                            </p>
                          </div>

                          {/* P: Plano */}
                          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                            <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider mb-2 inline-block">
                              P — Plano (Condutas & Medicações)
                            </span>
                            <p className="text-xs text-slate-800 leading-relaxed">
                              {ev.soap_plano || 'Administradas medicações do horário e mantidos cuidados preventivos.'}
                            </p>
                          </div>
                        </div>

                        {/* Selo Digital Criptográfico de Assinatura */}
                        <div className="bg-emerald-50/70 border border-emerald-200 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-emerald-600" />
                            <div>
                              <p className="font-bold text-emerald-950">Assinado Digitalmente pelo Profissional</p>
                              <p className="text-[11px] text-emerald-800">
                                {ev.profissional_nome} ({ev.profissional_registro || 'Registro Válido'}) em{' '}
                                {ev.data_assinatura ? new Date(ev.data_assinatura).toLocaleString('pt-BR') : 'Data registrada'}
                              </p>
                            </div>
                          </div>

                          {ev.assinatura_digital && (
                            <div className="font-mono text-[10px] text-emerald-700 bg-white/80 px-3 py-1 rounded-lg border border-emerald-200 truncate max-w-xs">
                              Selo: {ev.assinatura_digital}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ABA 2: PRESCRIÇÕES MÉDICAS */}
        {activeTab === 'prescricoes' && (
          <div className="space-y-4">
            {prescricoes.length === 0 ? (
              <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center">
                <Pill className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-800">Nenhuma prescrição cadastrada</h3>
                <p className="text-xs text-slate-500 mt-1 mb-4">
                  Cadastre as prescrições médicas para gerar a grade de aprazamento automática.
                </p>
                <button
                  onClick={() => setIsNovaPrescricaoOpen(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  Cadastrar Primeira Prescrição
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {prescricoes.map((pr) => (
                  <div
                    key={pr.id}
                    className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold px-2 py-0.5 rounded-md">
                            Via {pr.via_administracao}
                          </span>
                          <h3 className="text-base font-bold text-slate-900 mt-1">{pr.medicamento}</h3>
                          <p className="text-xs text-slate-600 font-semibold">{pr.dosagem}</p>
                        </div>

                        <span
                          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                            pr.status === 'Ativa'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {pr.status}
                        </span>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs space-y-1 my-3">
                        <p className="text-slate-600">
                          Frequência:{' '}
                          <strong className="text-slate-800">A cada {pr.frequencia_horas}h</strong>
                        </p>
                        {pr.horarios_padrao && (
                          <p className="text-slate-600">
                            Horários:{' '}
                            <strong className="text-indigo-600 font-mono">
                              {pr.horarios_padrao.join(' • ')}
                            </strong>
                          </p>
                        )}
                        {pr.instrucoes && (
                          <p className="text-slate-600">
                            Instruções: <span className="text-slate-800 italic">{pr.instrucoes}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ABA 3: SINAIS VITAIS */}
        {activeTab === 'sinais' && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-indigo-600" />
                  Histórico de Sinais Vitais & Parâmetros Fisiológicos
                </h3>
                <p className="text-xs text-slate-500">Monitoramento contínuo de pressão, oximetria e temperatura.</p>
              </div>
              <button
                onClick={() => setIsNovoSinalOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Nova Aferição
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="bg-slate-50/80 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Data/Hora</th>
                    <th className="py-3 px-4 text-center">PA (mmHg)</th>
                    <th className="py-3 px-4 text-center">FC (bpm)</th>
                    <th className="py-3 px-4 text-center">SpO2</th>
                    <th className="py-3 px-4 text-center">Temp (°C)</th>
                    <th className="py-3 px-4 text-center">Glicemia</th>
                    <th className="py-3 px-4">Responsável</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sinaisVitais.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        Nenhum sinal vital registrado para este paciente.
                      </td>
                    </tr>
                  ) : (
                    sinaisVitais.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 text-xs font-medium text-slate-900">
                          {new Date(s.data_hora).toLocaleString('pt-BR')}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-xs">
                          {s.pa_sistolica && s.pa_diastolica ? `${s.pa_sistolica}/${s.pa_diastolica}` : '--'}
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-xs">{s.fc_bpm || '--'}</td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-xs">
                          {s.spo2_percent ? (
                            <span
                              className={`px-2 py-0.5 rounded-full ${
                                s.spo2_percent < 93
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {s.spo2_percent}%
                            </span>
                          ) : (
                            '--'
                          )}
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-xs">
                          {s.temp_celsius ? `${s.temp_celsius}°C` : '--'}
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-xs">
                          {s.glicemia_mg_dl ? `${s.glicemia_mg_dl} mg/dL` : '--'}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600">{s.profissional_nome || 'Profissional'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ABA 4: AUDITORIA CLÍNICA */}
        {activeTab === 'auditoria' && (
          <div className="space-y-4">
            {pareceres.length === 0 ? (
              <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center">
                <ShieldCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-800">Sem pareceres de auditoria emitidos</h3>
                <p className="text-xs text-slate-500 mt-1 mb-4">
                  A auditoria médica e de enfermagem pode registrar notas de conformidade e recomendações clínicas.
                </p>
                <button
                  onClick={() => setIsNovoParecerOpen(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  Emitir Primeiro Parecer
                </button>
              </div>
            ) : (
              pareceres.map((par) => (
                <div key={par.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                        par.tipo_parecer === 'Conforme'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {par.tipo_parecer}
                    </span>
                    <span className="text-xs text-slate-450">
                      {new Date(par.data_registro).toLocaleString('pt-BR')}
                    </span>
                  </div>

                  <p className="text-xs text-slate-800 leading-relaxed font-medium">{par.descricao}</p>

                  <p className="text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                    Auditado por: <strong className="text-slate-700">{par.auditor_nome}</strong>
                  </p>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Modal: Nova Prescrição Médica */}
      {isNovaPrescricaoOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Pill className="w-5 h-5 text-indigo-600" />
                Nova Prescrição Médica
              </h2>
              <button onClick={() => setIsNovaPrescricaoOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSalvarPrescricao} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Medicamento & Princípio Ativo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Losartana Potássica 50mg"
                  value={novaPrescricaoForm.medicamento}
                  onChange={(e) => setNovaPrescricaoForm({ ...novaPrescricaoForm, medicamento: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Dosagem *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 1 comprimido"
                    value={novaPrescricaoForm.dosagem}
                    onChange={(e) => setNovaPrescricaoForm({ ...novaPrescricaoForm, dosagem: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Via de Administração</label>
                  <select
                    value={novaPrescricaoForm.via_administracao}
                    onChange={(e) => setNovaPrescricaoForm({ ...novaPrescricaoForm, via_administracao: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="Oral">Oral</option>
                    <option value="Enteral">Enteral (Sonda)</option>
                    <option value="Subcutânea">Subcutânea</option>
                    <option value="Intravenosa">Intravenosa</option>
                    <option value="Intramuscular">Intramuscular</option>
                    <option value="Inalatória">Inalatória</option>
                    <option value="Tópica">Tópica</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Frequência (Horas)</label>
                  <select
                    value={novaPrescricaoForm.frequencia_horas}
                    onChange={(e) => setNovaPrescricaoForm({ ...novaPrescricaoForm, frequencia_horas: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value={24}>24 em 24 horas (1x/dia)</option>
                    <option value={12}>12 em 12 horas (2x/dia)</option>
                    <option value={8}>8 em 8 horas (3x/dia)</option>
                    <option value={6}>6 em 6 horas (4x/dia)</option>
                    <option value={4}>4 em 4 horas (6x/dia)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Horários Padrão</label>
                  <input
                    type="text"
                    placeholder="08:00, 20:00"
                    value={novaPrescricaoForm.horarios_padrao}
                    onChange={(e) => setNovaPrescricaoForm({ ...novaPrescricaoForm, horarios_padrao: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Instruções de Preparo / Aplicação</label>
                <input
                  type="text"
                  placeholder="Ex: Diluir em 20ml de água, administrar após alimentação"
                  value={novaPrescricaoForm.instrucoes}
                  onChange={(e) => setNovaPrescricaoForm({ ...novaPrescricaoForm, instrucoes: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNovaPrescricaoOpen(false)}
                  className="px-3.5 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                  Salvar Prescrição
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Aferição de Sinais Vitais */}
      {isNovoSinalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Activity className="w-5 h-5 text-indigo-600" />
                Registrar Sinais Vitais
              </h2>
              <button onClick={() => setIsNovoSinalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSalvarSinalVital} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">PA Sistólica (mmHg)</label>
                  <input
                    type="number"
                    placeholder="120"
                    value={novoSinalForm.pa_sistolica}
                    onChange={(e) => setNovoSinalForm({ ...novoSinalForm, pa_sistolica: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">PA Diastólica (mmHg)</label>
                  <input
                    type="number"
                    placeholder="80"
                    value={novoSinalForm.pa_diastolica}
                    onChange={(e) => setNovoSinalForm({ ...novoSinalForm, pa_diastolica: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">FC (bpm)</label>
                  <input
                    type="number"
                    placeholder="78"
                    value={novoSinalForm.fc_bpm}
                    onChange={(e) => setNovoSinalForm({ ...novoSinalForm, fc_bpm: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">SpO2 (%)</label>
                  <input
                    type="number"
                    placeholder="98"
                    value={novoSinalForm.spo2_percent}
                    onChange={(e) => setNovoSinalForm({ ...novoSinalForm, spo2_percent: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Temp (°C)</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="36.5"
                    value={novoSinalForm.temp_celsius}
                    onChange={(e) => setNovoSinalForm({ ...novoSinalForm, temp_celsius: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Glicemia Capilar (mg/dL)</label>
                <input
                  type="number"
                  placeholder="Ex: 110"
                  value={novoSinalForm.glicemia_mg_dl}
                  onChange={(e) => setNovoSinalForm({ ...novoSinalForm, glicemia_mg_dl: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNovoSinalOpen(false)}
                  className="px-3.5 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                  Salvar Sinais
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Parecer de Auditoria */}
      {isNovoParecerOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-600" />
                Emitir Parecer de Auditoria Clínica
              </h2>
              <button onClick={() => setIsNovoParecerOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSalvarParecer} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Classificação do Parecer</label>
                <select
                  value={novoParecerForm.tipo_parecer}
                  onChange={(e) => setNovoParecerForm({ ...novoParecerForm, tipo_parecer: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="Conforme">Conforme (Sem Pendências)</option>
                  <option value="Recomendacao_Clinica">Recomendação Clínica</option>
                  <option value="Pendente">Pendente de Complementação</option>
                  <option value="Inconformidade">Inconformidade Registrada</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Descrição / Justificativa Clínica *</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Insira as observações do auditor médico ou enfermeiro sobre as evoluções e condutas..."
                  value={novoParecerForm.descricao}
                  onChange={(e) => setNovoParecerForm({ ...novoParecerForm, descricao: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNovoParecerOpen(false)}
                  className="px-3.5 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                  Salvar Parecer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Toast Flutuante de Confirmação de Cópia */}
      {toastDetalhe && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900/95 backdrop-blur-md text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200 max-w-md">
          <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-xl">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <p className="text-xs font-semibold leading-relaxed">{toastDetalhe}</p>
        </div>
      )}
    </div>
  );
}
