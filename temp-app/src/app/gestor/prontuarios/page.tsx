/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  FileText,
  Search,
  Download,
  Eye,
  Calendar,
  User,
  Plus,
  Activity,
  Pill,
  CheckCircle2,
  AlertTriangle,
  Users,
  ChevronRight,
  Sparkles,
  ClipboardList,
  Stethoscope,
  X,
  Loader2,
  Building,
  Trash2,
  Check,
  ShieldAlert,
  Copy,
  Link2,
  MessageCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { fetchFullDataset } from '@/lib/client-fetch';
import { formatarNomeEspecialidade, EspecialidadeProfissional } from '@/lib/tipos-clinicos';
import SeletorCooperadosMeta, { CooperadoItem } from './_components/SeletorCooperadosMeta';
import { obterUrlCooperado } from '@/lib/subdominios';
import {
  lerCacheNavegacao,
  gravarCacheNavegacao,
  invalidarCacheNavegacao,
  CHAVE_CACHE_LISTAGEM_PACIENTES,
  chaveCacheListagemEvolucoes,
} from '@/lib/cache-navegacao';

interface PacienteSummary {
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
  warnings?: string[];
  status?: string;
  limite_visitas_mes?: number;
  visitas_realizadas_mes?: number;
  visitas_restantes_mes?: number;
  limite_atingido?: boolean;
  total_prescricoes_ativas?: number;
  ultima_evolucao_data?: string;
  ultimo_profissional_nome?: string;
  origem?: string;
  tem_plano_terapeutico?: boolean;
  plano_vigente?: {
    id: string;
    data_inicio: string;
    data_fim: string;
    total_previsto?: number;
    total_realizado?: number;
    total_restante?: number;
    tem_pendencias?: boolean;
  };
  ultimo_sinal_vital?: {
    pa_sistolica?: number;
    pa_diastolica?: number;
    fc_bpm?: number;
    temp_celsius?: number;
    spo2_percent?: number;
    glicemia_mg_dl?: number;
    data_hora?: string;
  } | null;
}

interface Evolution {
  id: string;
  paciente_id: string;
  paciente_nome?: string;
  paciente_cpf?: string;
  profissional_id: string;
  profissional_nome?: string;
  tipo_profissional: string;
  turno?: string;
  check_in: string;
  check_out: string;
  status: string;
  data_assinatura?: string;
  transcricao_revisada?: string;
  soap_subjetivo?: string;
  soap_objetivo?: string;
  soap_avaliacao?: string;
  soap_plano?: string;
  aprazamentos?: any[];
  // Projeção leve (`X-Gestorcoop-Projecao: resumo`): texto já truncado e
  // contagens de aprazamentos no lugar do SOAP completo e da lista de aprazamentos.
  resumo?: string;
  aprazamentos_total?: number;
  aprazamentos_administrados?: number;
}

const ESPECIALIDADES_DISPONIVEIS: { valor: EspecialidadeProfissional; rotulo: string }[] = [
  { valor: 'Tecnico_Enfermagem', rotulo: 'Técnico de Enfermagem' },
  { valor: 'Enfermeiro', rotulo: 'Enfermeiro' },
  { valor: 'Medico', rotulo: 'Médico' },
  { valor: 'Dentista', rotulo: 'Dentista' },
  { valor: 'Fisioterapeuta', rotulo: 'Fisioterapeuta' },
  { valor: 'Fonoaudiologo', rotulo: 'Fonoaudiólogo' },
  { valor: 'Nutricionista', rotulo: 'Nutricionista' },
  { valor: 'Psicologo', rotulo: 'Psicólogo' },
  { valor: 'Terapeuta_Ocupacional', rotulo: 'Terapeuta Ocupacional' },
];

export default function ProntuariosAuditDashboard() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'pacientes' | 'evolucoes'>('pacientes');
  const [pacientes, setPacientes] = useState<PacienteSummary[]>([]);
  const [evolutions, setEvolutions] = useState<Evolution[]>([]);
  const [carregandoPacientes, setCarregandoPacientes] = useState(true);
  const [carregandoEvolucoes, setCarregandoEvolucoes] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('');
  const [selectedComplexidade, setSelectedComplexidade] = useState('');

  // Dados do Bubble & Cooperados para Admissão
  const [pacientesBubble, setPacientesBubble] = useState<any[]>([]);
  const [cooperados, setCooperados] = useState<CooperadoItem[]>([]);
  const basesAuxiliaresSolicitadas = useRef(false);
  const requisicaoEvolucoesAtual = useRef(0);
  const [carregandoBasesAuxiliares, setCarregandoBasesAuxiliares] = useState(false);

  // Modal Novo Paciente & Início de Plano Terapêutico
  const [isNovoPacienteOpen, setIsNovoPacienteOpen] = useState(false);
  const [salvandoPaciente, setSalvandoPaciente] = useState(false);
  const [modoOrigemModal, setModoOrigemModal] = useState<'bubble' | 'manual'>('bubble');
  const [buscaBubbleModal, setBuscaBubbleModal] = useState('');
  const [pacienteBubbleSelecionado, setPacienteBubbleSelecionado] = useState<any | null>(null);

  const hojeIso = new Date().toISOString().split('T')[0];
  const proximoMesIso = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

  const [novoPacienteForm, setNovoPacienteForm] = useState({
    id: '',
    nome: '',
    cpf: '',
    data_nascimento: '',
    endereco: '',
    telefone: '',
    responsavel_nome: '',
    responsavel_telefone: '',
    diagnostico_principal: 'Reabilitação e Acompanhamento Domiciliar',
    cid10: '',
    complexidade: 'Média' as 'Baixa' | 'Média' | 'Alta',
    plano_saude: '',
    numero_carteirinha: '',
    warnings: '',
    limite_visitas_mes: 13,
  });

  // Plano Terapêutico Dinâmico
  const [planoDinamico, setPlanoDinamico] = useState({
    data_inicio: hojeIso,
    data_fim: proximoMesIso,
    observacoes: 'Assistência domiciliar multiprofissional com monitoramento de metas.',
    metas: [
      { especialidade: 'Tecnico_Enfermagem' as EspecialidadeProfissional, quantidade_prevista: 5, profissionais_designados: [] as any[] },
      { especialidade: 'Medico' as EspecialidadeProfissional, quantidade_prevista: 1, profissionais_designados: [] as any[] },
      { especialidade: 'Dentista' as EspecialidadeProfissional, quantidade_prevista: 2, profissionais_designados: [] as any[] },
    ],
  });

  // Estados para cópia do link do cooperado
  const [copiadoId, setCopiadoId] = useState<string | null>(null);
  const [copiadoGeral, setCopiadoGeral] = useState(false);
  const [toastMensagem, setToastMensagem] = useState<string | null>(null);

  // Paginação escalável na listagem de pacientes
  const ITENS_POR_PAGINA = 12;
  const [paginaAtual, setPaginaAtual] = useState(1);

  const exibirToast = (msg: string) => {
    setToastMensagem(msg);
    setTimeout(() => setToastMensagem(null), 3500);
  };

  const copiarTextoParaClipboard = async (texto: string) => {
    if (typeof window !== 'undefined' && navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(texto);
    } else if (typeof document !== 'undefined') {
      const textArea = document.createElement('textarea');
      textArea.value = texto;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  };

  const copiarLinkPacienteCooperado = async (p: PacienteSummary) => {
    try {
      const url = obterUrlCooperado(`/prontuario/${p.id}`);
      await copiarTextoParaClipboard(url);
      setCopiadoId(p.id);
      exibirToast(`Link copiado para o paciente ${p.nome}! Pronto para enviar no WhatsApp ou chat.`);
      setTimeout(() => setCopiadoId(null), 3000);
    } catch (e) {
      console.error('Erro ao copiar link do paciente:', e);
    }
  };

  const copiarLinkGeralCooperado = async () => {
    try {
      const url = obterUrlCooperado();
      await copiarTextoParaClipboard(url);
      setCopiadoGeral(true);
      exibirToast('Link do Portal de Atendimento do Cooperado copiado com sucesso!');
      setTimeout(() => setCopiadoGeral(false), 3000);
    } catch (e) {
      console.error('Erro ao copiar link geral:', e);
    }
  };

  // Pacientes: uma vez por abertura da tela. O filtro de complexidade é aplicado
  // no cliente (`filteredPacientes`), então não precisa refazer requisição.
  useEffect(() => {
    carregarPacientes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Evoluções: só quando o filtro de especialidade (aplicado no servidor) muda.
  useEffect(() => {
    carregarEvolucoes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSpecialty]);

  const carregarPacientes = async (forcar = false) => {
    if (!forcar) {
      const cache = lerCacheNavegacao<PacienteSummary[]>(CHAVE_CACHE_LISTAGEM_PACIENTES);
      if (cache) {
        setPacientes(cache.data);
        setCarregandoPacientes(false);
        if (!cache.isStale) return;
        // Se for stale (> 45s), revalida silenciosamente em segundo plano sem skeleton
      } else {
        setCarregandoPacientes(true);
      }
    } else {
      setCarregandoPacientes(true);
    }

    try {
      const resPacientes = await axios.get('/api/gestor/prontuarios/pacientes');
      if (resPacientes.data?.success) {
        const lista = resPacientes.data.data || [];
        setPacientes(lista);
        gravarCacheNavegacao(CHAVE_CACHE_LISTAGEM_PACIENTES, lista);
      }
    } catch (e) {
      console.error('Erro ao carregar pacientes do prontuário:', e);
    } finally {
      setCarregandoPacientes(false);
    }
  };

  const carregarEvolucoes = async (forcar = false) => {
    const chave = chaveCacheListagemEvolucoes(selectedSpecialty);
    const requisicao = ++requisicaoEvolucoesAtual.current;

    if (!forcar) {
      const cache = lerCacheNavegacao<Evolution[]>(chave);
      if (cache) {
        setEvolutions(cache.data);
        setCarregandoEvolucoes(false);
        if (!cache.isStale) return;
      } else {
        setCarregandoEvolucoes(true);
      }
    } else {
      setCarregandoEvolucoes(true);
    }

    try {
      const resEvolucoes = await axios.get('/api/gestor/prontuarios', {
        params: { specialty: selectedSpecialty || undefined },
        // Projeção leve: sem transcrições/SOAP completo, com contagem de
        // aprazamentos para o KPI. Servidor antigo ignora o cabeçalho e devolve
        // o payload completo, que a tela também entende.
        headers: { 'X-Gestorcoop-Projecao': 'resumo' },
      });
      if (requisicao !== requisicaoEvolucoesAtual.current) return;
      if (resEvolucoes.data?.success) {
        const lista = resEvolucoes.data.results || [];
        setEvolutions(lista);
        gravarCacheNavegacao(chave, lista);
      }
    } catch (e) {
      if (requisicao !== requisicaoEvolucoesAtual.current) return;
      console.error('Erro ao carregar evoluções do prontuário:', e);
    } finally {
      if (requisicao === requisicaoEvolucoesAtual.current) setCarregandoEvolucoes(false);
    }
  };

  // Base do Bubble e lista completa de cooperados só servem ao modal de admissão:
  // são carregadas na primeira abertura dele, não a cada visita à tela. Se a
  // carga falhar (ou cair nos dados de exemplo), a próxima abertura tenta de novo.
  const garantirBasesAuxiliares = () => {
    if (basesAuxiliaresSolicitadas.current) return;
    basesAuxiliaresSolicitadas.current = true;
    setCarregandoBasesAuxiliares(true);
    carregarBasesAuxiliares()
      .then((completo) => {
        if (!completo) basesAuxiliaresSolicitadas.current = false;
      })
      .catch(() => {
        basesAuxiliaresSolicitadas.current = false;
      })
      .finally(() => setCarregandoBasesAuxiliares(false));
  };

  /** Retorna `true` só se as duas bases vieram do servidor (sem fallback). */
  const carregarBasesAuxiliares = async (): Promise<boolean> => {
    let bubbleOk = false;
    let cooperadosOk = false;
    try {
      const [resBubble] = await Promise.all([
        axios
          .get('/api/gestor/pacientes', {
            // A rota pode responder com a lista memoizada (60 s) que a própria
            // listagem de prontuários já usa, em vez de paginar o Bubble de novo.
            headers: { 'X-Gestorcoop-Cache': 'permitido' },
          })
          .catch(() => null),
      ]);

      // Falha de rede/servidor: mantém o que já havia (retentativa na próxima abertura).
      if (resBubble && resBubble.data?.success !== false && Array.isArray(resBubble.data?.data)) {
        setPacientesBubble(resBubble.data.data);
        bubbleOk = true;
      }

      const formatarCooperados = (lista: any[]): CooperadoItem[] =>
        lista.map((c: any) => ({
          id: c._id || c.id,
          nome:
            (c.txt_nomeCompleto || c.nomeCompleto || c.nome_text || c.txt_nome || c.nome || '').trim() ||
            `Cooperado ${(c._id || c.id || '').substring(0, 6)}`,
          cargo:
            Array.isArray(c.fks_profissoes) && c.fks_profissoes.length > 0
              ? c.fks_profissoes.join(', ')
              : c.txt_profissao || c.cargo || '',
          profissoes: Array.isArray(c.fks_profissoes)
            ? c.fks_profissoes
            : c.txt_profissao
            ? [c.txt_profissao]
            : [],
          cpf: c.txt_CPF || c.cpf || '',
          email: c.txt_email || c.email || '',
        }));

      try {
        await fetchFullDataset<any>('/api/gestor/cooperados', (rawCoops) => {
          setCooperados(formatarCooperados(rawCoops));
        });
        cooperadosOk = true;
      } catch (errPaging) {
        console.warn('Falha ao paginar cooperados, buscando via GET simples:', errPaging);
        const resCoop = await axios.get('/api/gestor/cooperados').catch(() => ({ data: { data: [] } }));
        if (resCoop.data?.data && Array.isArray(resCoop.data.data) && resCoop.data.data.length > 0) {
          setCooperados(formatarCooperados(resCoop.data.data));
          cooperadosOk = true;
        } else {
          // Fallback para dev local com dados realistas (não conta como carga
          // concluída: a próxima abertura do modal tenta o servidor de novo)
          setCooperados([
            { id: 'coop_tec_carlos', nome: 'Carlos Enfermagem (Téc.)', cargo: 'Técnico de Enfermagem', profissoes: ['Técnico de Enfermagem'] },
            { id: 'coop_tec_roberto', nome: 'Roberto Soares (Téc.)', cargo: 'Técnico de Enfermagem', profissoes: ['Técnico de Enfermagem'] },
            { id: 'coop_med_marcos', nome: 'Dr. Marcos Mendes', cargo: 'Médico', profissoes: ['Médico'] },
            { id: 'coop_dent_camila', nome: 'Dra. Camila Odonto', cargo: 'Dentista', profissoes: ['Dentista'] },
            { id: 'coop_fisio_lucas', nome: 'Lucas Fisioterapeuta', cargo: 'Fisioterapeuta', profissoes: ['Fisioterapeuta'] },
          ]);
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar bases do Bubble e cooperados:', e);
    }
    return bubbleOk && cooperadosOk;
  };

  const abrirModalAdmissaoComPaciente = (pacienteBubble?: any) => {
    garantirBasesAuxiliares();
    if (pacienteBubble) {
      setModoOrigemModal('bubble');
      setPacienteBubbleSelecionado(pacienteBubble);
      setNovoPacienteForm({
        id: pacienteBubble._id || pacienteBubble.id,
        nome: pacienteBubble.txt_nome || pacienteBubble.nome || '',
        cpf: pacienteBubble.txt_cpf || pacienteBubble.cpf || '',
        data_nascimento: pacienteBubble.data_nascimento || '',
        endereco: pacienteBubble.txt_endereco || pacienteBubble.endereco || '',
        telefone: pacienteBubble.txt_whatsapp || pacienteBubble.telefone || '',
        responsavel_nome: pacienteBubble.responsavel_nome || '',
        responsavel_telefone: pacienteBubble.responsavel_telefone || '',
        diagnostico_principal: pacienteBubble.diagnostico_principal || 'Acompanhamento Domiciliar',
        cid10: pacienteBubble.cid10 || '',
        complexidade: pacienteBubble.complexidade || 'Média',
        plano_saude: pacienteBubble.plano_saude || '',
        numero_carteirinha: pacienteBubble.numero_carteirinha || '',
        warnings: Array.isArray(pacienteBubble.warnings) ? pacienteBubble.warnings.join('\n') : '',
        limite_visitas_mes: pacienteBubble.limite_visitas_mes || 13,
      });
    } else {
      setPacienteBubbleSelecionado(null);
      setNovoPacienteForm({
        id: '',
        nome: '',
        cpf: '',
        data_nascimento: '',
        endereco: '',
        telefone: '',
        responsavel_nome: '',
        responsavel_telefone: '',
        diagnostico_principal: 'Reabilitação Neurológica / Cuidados Domiciliares',
        cid10: '',
        complexidade: 'Média',
        plano_saude: '',
        numero_carteirinha: '',
        warnings: '',
        limite_visitas_mes: 13,
      });
    }

    setPlanoDinamico({
      data_inicio: hojeIso,
      data_fim: proximoMesIso,
      observacoes: 'Assistência domiciliar multiprofissional.',
      metas: [
        { especialidade: 'Tecnico_Enfermagem', quantidade_prevista: 5, profissionais_designados: [] },
        { especialidade: 'Medico', quantidade_prevista: 1, profissionais_designados: [] },
        { especialidade: 'Dentista', quantidade_prevista: 2, profissionais_designados: [] },
      ],
    });

    setIsNovoPacienteOpen(true);
  };

  const selecionarPacienteDoBubble = (pac: any) => {
    setPacienteBubbleSelecionado(pac);
    setNovoPacienteForm({
      ...novoPacienteForm,
      id: pac._id || pac.id,
      nome: pac.txt_nome || pac.nome || '',
      cpf: pac.txt_cpf || pac.cpf || '',
      endereco: pac.txt_endereco || pac.endereco || '',
      telefone: pac.txt_whatsapp || pac.telefone || '',
      diagnostico_principal: novoPacienteForm.diagnostico_principal || 'Acompanhamento Multiprofissional',
    });
  };

  // Manipulação Dinâmica de Metas
  const adicionarMetaAoPlano = () => {
    setPlanoDinamico({
      ...planoDinamico,
      metas: [
        ...planoDinamico.metas,
        { especialidade: 'Fisioterapeuta', quantidade_prevista: 2, profissionais_designados: [] },
      ],
    });
  };

  const removerMetaDoPlano = (index: number) => {
    setPlanoDinamico({
      ...planoDinamico,
      metas: planoDinamico.metas.filter((_, i) => i !== index),
    });
  };

  const atualizarMetaDoPlano = (index: number, campo: string, valor: any) => {
    const novas = [...planoDinamico.metas];
    novas[index] = { ...novas[index], [campo]: valor };
    setPlanoDinamico({ ...planoDinamico, metas: novas });
  };

  const toggleCooperadoNaMeta = (metaIndex: number, coop: CooperadoItem | { id: string; nome: string; cargo?: string }) => {
    const metaAtual = planoDinamico.metas[metaIndex];
    const designados = metaAtual.profissionais_designados || [];
    const jaExiste = designados.some((d: any) => d.id === coop.id);

    let novosDesignados;
    if (jaExiste) {
      novosDesignados = designados.filter((d: any) => d.id !== coop.id);
    } else {
      novosDesignados = [...designados, { id: coop.id, nome: coop.nome, cargo: coop.cargo }];
    }

    atualizarMetaDoPlano(metaIndex, 'profissionais_designados', novosDesignados);
  };

  const handleSalvarNovoPacienteEPlano = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoPacienteForm.nome) {
      alert('Selecione um paciente existente ou informe o nome do paciente.');
      return;
    }

    if (planoDinamico.metas.length === 0) {
      alert('O Plano Terapêutico precisa conter ao menos uma especialidade.');
      return;
    }

    setSalvandoPaciente(true);
    try {
      const warningsArray = novoPacienteForm.warnings
        ? novoPacienteForm.warnings.split('\n').filter((w) => w.trim().length > 0)
        : [];

      const payload = {
        ...novoPacienteForm,
        limite_visitas_mes: Number(novoPacienteForm.limite_visitas_mes || planoDinamico.metas[0]?.quantidade_prevista || 13),
        warnings: warningsArray,
        plano_terapeutico: {
          data_inicio: planoDinamico.data_inicio,
          data_fim: planoDinamico.data_fim,
          observacoes: planoDinamico.observacoes,
          metas: planoDinamico.metas,
        },
      };

      const res = await axios.post('/api/gestor/prontuarios/pacientes', payload);
      if (res.data?.success) {
        invalidarCacheNavegacao(CHAVE_CACHE_LISTAGEM_PACIENTES);
        setIsNovoPacienteOpen(false);
        const pacienteId = res.data.data?.id || novoPacienteForm.id;
        // Redireciona diretamente para a Dashboard Individual do Paciente com plano ativo
        router.push(`/gestor/prontuarios/${pacienteId}`);
      } else {
        alert(res.data?.error || 'Erro ao admitir paciente.');
      }
    } catch (err: any) {
      console.error('Erro ao admitir paciente:', err);
      alert(err.response?.data?.error || 'Erro de comunicação ao salvar admissão e plano.');
    } finally {
      setSalvandoPaciente(false);
    }
  };

  // Filtragem Pacientes
  const filteredPacientes = pacientes.filter((p) => {
    const term = search.toLowerCase();
    const matchSearch =
      (p.nome && p.nome.toLowerCase().includes(term)) ||
      (p.cpf && p.cpf.includes(term)) ||
      (p.diagnostico_principal && p.diagnostico_principal.toLowerCase().includes(term)) ||
      (p.cid10 && p.cid10.toLowerCase().includes(term));

    const matchComp = selectedComplexidade ? p.complexidade === selectedComplexidade : true;
    return matchSearch && matchComp;
  });

  // Reseta para a página 1 ao alterar filtros
  useEffect(() => {
    setPaginaAtual(1);
  }, [search, selectedComplexidade]);

  const totalPaginas = Math.max(1, Math.ceil(filteredPacientes.length / ITENS_POR_PAGINA));
  const pacientesPaginados = filteredPacientes.slice(
    (paginaAtual - 1) * ITENS_POR_PAGINA,
    paginaAtual * ITENS_POR_PAGINA
  );

  // Filtragem Pacientes Bubble no Modal
  const bubbleFiltradosModal = pacientesBubble.filter((b) => {
    const t = buscaBubbleModal.toLowerCase();
    return (
      (b.txt_nome && b.txt_nome.toLowerCase().includes(t)) ||
      (b.txt_endereco && b.txt_endereco.toLowerCase().includes(t)) ||
      (b.txt_cpf && b.txt_cpf.includes(t))
    );
  });

  // Filtragem Evoluções
  const filteredEvolutions = evolutions.filter((ev) => {
    const term = search.toLowerCase();
    const matchSearch =
      (ev.paciente_nome || '').toLowerCase().includes(term) ||
      (ev.paciente_cpf || '').includes(term) ||
      (ev.profissional_nome || '').toLowerCase().includes(term);

    return matchSearch;
  });

  // Métricas
  const totalPacientesAtivos = pacientes.filter((p) => p.status !== 'Alta').length;
  const totalAtendimentos = filteredEvolutions.length;
  let totalAprazados = 0;
  let totalAdministrados = 0;
  filteredEvolutions.forEach((ev) => {
    if (typeof ev.aprazamentos_total === 'number') {
      // Projeção leve: contagem já feita no servidor (funciona com D1).
      totalAprazados += ev.aprazamentos_total;
      totalAdministrados += ev.aprazamentos_administrados || 0;
    } else if (ev.aprazamentos) {
      ev.aprazamentos.forEach((a) => {
        totalAprazados++;
        if (a.status === 'Administrado') {
          totalAdministrados++;
        }
      });
    }
  });
  const complianceRate =
    totalAprazados > 0 ? Math.round((totalAdministrados / totalAprazados) * 100) : 100;

  const exportToCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent +=
      'ID Prontuario,Paciente,CPF Paciente,Profissional,Especialidade,Turno,Check-In,Check-Out,Tempo Gasto (Min),Status,Data Assinatura\n';

    filteredEvolutions.forEach((ev) => {
      const durationMin =
        ev.check_out && ev.check_in
          ? Math.round(
              (new Date(ev.check_out).getTime() - new Date(ev.check_in).getTime()) / (1000 * 60)
            )
          : '--';

      const row = [
        ev.id,
        `"${ev.paciente_nome || ''}"`,
        `"${ev.paciente_cpf || ''}"`,
        `"${ev.profissional_nome || ''}"`,
        `"${ev.tipo_profissional || ''}"`,
        `"${ev.turno || ''}"`,
        ev.check_in || '',
        ev.check_out || '',
        durationMin,
        ev.status || '',
        ev.data_assinatura || '',
      ];
      csvContent += row.join(',') + '\n';
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `auditoria_prontuarios_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-6 lg:p-8 space-y-6">
      {/* Top Header */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2.5 py-0.5 rounded-full">
              Módulo Clínico & EHR
            </span>
            <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              IA SOAP & Transcrição
            </span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Stethoscope className="w-7 h-7 text-indigo-600" />
            Gestão de Prontuários & Pacientes
          </h1>
          <p className="text-slate-500 text-xs lg:text-sm mt-0.5">
            Controle integral do cuidado domiciliar, plano terapêutico multiprofissional, evoluções clínicas e auditoria.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={copiarLinkGeralCooperado}
            className={`px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 border ${
              copiadoGeral
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
            }`}
            title="Copiar link de acesso ao portal do cooperado"
          >
            {copiadoGeral ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" />
                <span className="text-emerald-700 font-bold">Link Copiado!</span>
              </>
            ) : (
              <>
                <Link2 className="w-4 h-4 text-indigo-600" />
                <span>Link do Cooperado</span>
              </>
            )}
          </button>

          <Link
            href="/gestor/prontuarios/auditoria"
            className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shadow-sm flex items-center gap-2"
          >
            <ShieldAlert className="w-4 h-4 text-amber-500" />
            Painel de Auditoria
          </Link>

          <button
            onClick={() => abrirModalAdmissaoComPaciente()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shadow-md flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Admitir Paciente
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pacientes em Atendimento</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{totalPacientesAtivos}</h3>
            <p className="text-[11px] text-indigo-600 font-semibold mt-1">Cuidado domiciliar ativo</p>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Evoluções Registradas</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{totalAtendimentos}</h3>
            <p className="text-[11px] text-emerald-600 font-semibold mt-1">100% assinadas digitalmente</p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
            <FileText className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Conformidade Medicamentosa</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{complianceRate}%</h3>
            <p className="text-[11px] text-slate-500 font-medium mt-1">
              {totalAdministrados} de {totalAprazados} doses
            </p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
            <Pill className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Monitoramento Clínico</p>
            <h3 className="text-xl font-black text-slate-900 mt-1">Sinais em Dia</h3>
            <p className="text-[11px] text-slate-500 font-medium mt-1">Triagem de alerta contínua</p>
          </div>
          <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl">
            <Activity className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto border-b border-slate-200 flex items-center gap-6">
        <button
          onClick={() => setActiveTab('pacientes')}
          className={`pb-3 font-bold text-sm transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'pacientes'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4" />
          Pacientes & Prontuários ({pacientes.length})
        </button>

        <button
          onClick={() => setActiveTab('evolucoes')}
          className={`pb-3 font-bold text-sm transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'evolucoes'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          Linha do Tempo de Evoluções ({filteredEvolutions.length})
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="max-w-7xl mx-auto bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex-1 w-full relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, CPF, diagnóstico ou CID-10..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {activeTab === 'pacientes' ? (
            <select
              value={selectedComplexidade}
              onChange={(e) => setSelectedComplexidade(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="">Todas as Complexidades</option>
              <option value="Baixa">Baixa Complexidade</option>
              <option value="Média">Média Complexidade</option>
              <option value="Alta">Alta Complexidade (UTI Domiciliar)</option>
            </select>
          ) : (
            <>
              <select
                value={selectedSpecialty}
                onChange={(e) => setSelectedSpecialty(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="">Todas as Especialidades</option>
                <option value="Tecnico_Enfermagem">Técnico de Enfermagem</option>
                <option value="Enfermeiro">Enfermeiro</option>
                <option value="Medico">Médico</option>
                <option value="Dentista">Dentista</option>
                <option value="Fisioterapeuta">Fisioterapeuta</option>
              </select>

              <button
                onClick={exportToCSV}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                Exportar CSV
              </button>
            </>
          )}
        </div>
      </div>

      {/* Content Grid */}
      <div className="max-w-7xl mx-auto">
        {(activeTab === 'pacientes' ? carregandoPacientes : carregandoEvolucoes) ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm animate-pulse space-y-4">
                <div className="h-5 bg-slate-200 rounded w-1/3"></div>
                <div className="h-7 bg-slate-200 rounded w-2/3"></div>
                <div className="h-16 bg-slate-100 rounded-xl"></div>
              </div>
            ))}
          </div>
        ) : activeTab === 'pacientes' ? (
          /* TAB 1: PACIENTES GRID */
          filteredPacientes.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-sm max-w-lg mx-auto">
              <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Building className="w-8 h-8" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900">Base Integrada do GestorCoop (Bubble)</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto mb-6">
                Selecione um paciente que já existe na base do GestorCoop para admiti-lo e iniciar o Plano Terapêutico dinâmico.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  onClick={() => abrirModalAdmissaoComPaciente()}
                  className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Admitir da Base GestorCoop
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {pacientesPaginados.map((p) => (
                <div
                  key={p.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all p-5 flex flex-col justify-between"
                >
                  <div>
                    {/* Header do Card */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider mb-1 ${
                            p.complexidade === 'Alta'
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : p.complexidade === 'Média'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          Complexidade {p.complexidade || 'Média'}
                        </span>
                        <h3 className="text-base font-bold text-slate-900 tracking-tight leading-tight">
                          {p.nome}
                        </h3>
                        {p.cpf ? (
                          <p className="text-xs text-slate-500 font-mono mt-0.5">CPF: {p.cpf}</p>
                        ) : (
                          <p className="text-xs text-indigo-600 font-semibold mt-0.5">Origem: Base GestorCoop (Bubble)</p>
                        )}
                      </div>

                      <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-1 rounded-full border border-emerald-200 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        {p.status || 'Ativo'}
                      </span>
                    </div>

                    {/* Endereço / Local */}
                    {p.endereco && (
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs mb-3 text-slate-700 truncate">
                        <span className="text-slate-400 font-medium">Local: </span>
                        {p.endereco}
                      </div>
                    )}

                    {/* Status do Plano Terapêutico */}
                    {p.tem_plano_terapeutico && p.plano_vigente ? (
                      <div className="p-2.5 rounded-xl bg-indigo-50/70 border border-indigo-100 mb-3">
                        <div className="flex items-center justify-between text-xs font-bold text-indigo-950 mb-1">
                          <span className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                            Plano Terapêutico Vigente
                          </span>
                          <span className="text-[11px] font-mono bg-indigo-200/60 px-1.5 py-0.5 rounded text-indigo-900">
                            {p.plano_vigente.total_realizado || 0} / {p.plano_vigente.total_previsto || 0} visitas
                          </span>
                        </div>
                        <p className="text-[11px] text-indigo-700">
                          Vigência: {p.plano_vigente.data_inicio} até {p.plano_vigente.data_fim}
                        </p>
                      </div>
                    ) : (p.limite_visitas_mes || 0) > 0 ? (
                      <div className="p-2.5 rounded-xl bg-indigo-50/70 border border-indigo-100 mb-3">
                        <div className="flex items-center justify-between text-xs font-bold text-indigo-950 mb-1">
                          <span className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                            Cota Mensal
                          </span>
                          <span className="text-[11px] font-mono bg-indigo-200/60 px-1.5 py-0.5 rounded text-indigo-900">
                            {p.visitas_realizadas_mes || 0} / {p.limite_visitas_mes}
                          </span>
                        </div>
                        <p className="text-[11px] text-indigo-700">
                          Visitas ambulatoriais e domiciliares do período
                        </p>
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 mb-3 flex items-center justify-between">
                        <span className="text-xs font-semibold text-amber-900 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                          Sem Plano Terapêutico
                        </span>
                        <button
                          onClick={() => abrirModalAdmissaoComPaciente(p)}
                          className="bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold px-2 py-1 rounded-lg transition-all shadow-xs"
                        >
                          Iniciar Plano
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Footer do Card */}
                  <div className="pt-3 mt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1 shrink-0">
                      <Pill className="w-3.5 h-3.5 text-indigo-500" />
                      {p.total_prescricoes_ativas || 0} prescrições
                    </span>

                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      <button
                        type="button"
                        onClick={() => copiarLinkPacienteCooperado(p)}
                        className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1 shadow-xs border ${
                          copiadoId === p.id
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200 hover:border-slate-300'
                        }`}
                        title={`Copiar link direto para o cooperado acessar o prontuário de ${p.nome}`}
                      >
                        {copiadoId === p.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Copiar Link</span>
                          </>
                        )}
                      </button>

                      <a
                        href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                          `Olá! Segue o link de acesso ao prontuário do paciente *${p.nome}* no GestorCoop:\n\n${obterUrlCooperado(`/prontuario/${p.id}`)}`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-colors border border-emerald-200 bg-white"
                        title={`Enviar link de atendimento de ${p.nome} via WhatsApp`}
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                      </a>

                      <Link
                        href={`/gestor/prontuarios/${p.id}`}
                        className="bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-sm shrink-0"
                      >
                        Ver Prontuário 360°
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
              </div>

              {totalPaginas > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white rounded-2xl border border-slate-200 px-6 py-4 shadow-xs">
                  <div className="text-xs text-slate-500 font-medium">
                    Mostrando <span className="font-bold text-slate-800">{(paginaAtual - 1) * ITENS_POR_PAGINA + 1}</span> a{' '}
                    <span className="font-bold text-slate-800">
                      {Math.min(paginaAtual * ITENS_POR_PAGINA, filteredPacientes.length)}
                    </span>{' '}
                    de <span className="font-bold text-slate-800">{filteredPacientes.length}</span> pacientes
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={paginaAtual <= 1}
                      onClick={() => setPaginaAtual((p) => Math.max(1, p - 1))}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      Anterior
                    </button>

                    <span className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 rounded-lg">
                      Página {paginaAtual} de {totalPaginas}
                    </span>

                    <button
                      type="button"
                      disabled={paginaAtual >= totalPaginas}
                      onClick={() => setPaginaAtual((p) => Math.min(totalPaginas, p + 1))}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      Próxima
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        ) : (
          /* TAB 2: EVOLUÇÕES TABLE */
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="bg-slate-50/80 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4">Paciente</th>
                    <th className="py-3.5 px-4">Profissional & Especialidade</th>
                    <th className="py-3.5 px-4">Turno / Data</th>
                    <th className="py-3.5 px-4">Resumo da Evolução (SOAP)</th>
                    <th className="py-3.5 px-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredEvolutions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        Nenhuma evolução registrada encontrada.
                      </td>
                    </tr>
                  ) : (
                    filteredEvolutions.map((ev) => (
                      <tr key={ev.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-slate-900">{ev.paciente_nome}</td>
                        <td className="py-3.5 px-4 font-medium text-slate-700">
                          {ev.profissional_nome} ({formatarNomeEspecialidade(ev.tipo_profissional)})
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 font-mono">
                          {ev.check_in ? new Date(ev.check_in).toLocaleString('pt-BR') : '--'}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate">
                          {ev.resumo || ev.soap_avaliacao || ev.transcricao_revisada || 'Sem resumo cadastrado'}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <Link
                            href={`/gestor/prontuarios/${ev.paciente_id || ev.id}`}
                            className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 p-2 rounded-lg text-xs font-semibold transition-all inline-flex items-center justify-center shadow-sm"
                          >
                            <Eye className="w-4 h-4 text-indigo-600" />
                          </Link>
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

      {/* MODAL INTELIGENTE: ADMISSÃO DO PACIENTE (DO BUBBLE OU NOVO) & INÍCIO DO PLANO TERAPÊUTICO DINÂMICO */}
      {isNovoPacienteOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur z-20">
              <div>
                <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Stethoscope className="w-5 h-5 text-indigo-600" />
                  Admissão Clínica de Paciente &amp; Plano Terapêutico
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Admissão Clínica &amp; Plano Terapêutico: Selecione um paciente da base do GestorCoop (Bubble) ou cadastre manualmente.
                </p>
              </div>
              <button
                onClick={() => setIsNovoPacienteOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSalvarNovoPacienteEPlano} className="p-6 space-y-6">
              {/* ETAPA 1: ESCOLHA DA ORIGEM DO PACIENTE */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <User className="w-4 h-4 text-indigo-600" />
                    1. Identificação do Paciente
                  </label>
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setModoOrigemModal('bubble')}
                      className={`px-3 py-1 rounded-lg font-bold transition-all ${
                        modoOrigemModal === 'bubble'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Base GestorCoop (Bubble)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setModoOrigemModal('manual');
                        setPacienteBubbleSelecionado(null);
                      }}
                      className={`px-3 py-1 rounded-lg font-bold transition-all ${
                        modoOrigemModal === 'manual'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Cadastrar Novo
                    </button>
                  </div>
                </div>

                {modoOrigemModal === 'bubble' && (
                  <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="relative flex-1">
                        <Search className="w-3.5 h-3.5 text-indigo-400 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          value={buscaBubbleModal}
                          onChange={(e) => setBuscaBubbleModal(e.target.value)}
                          placeholder="Buscar paciente já existente na base do GestorCoop..."
                          className="w-full pl-9 pr-3 py-1.5 bg-white border border-indigo-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                      </div>
                      <span className="text-[11px] font-bold text-indigo-700 shrink-0">
                        {carregandoBasesAuxiliares && pacientesBubble.length === 0
                          ? 'Carregando base…'
                          : `${bubbleFiltradosModal.length} pacientes encontrados`}
                      </span>
                    </div>

                    <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                      {bubbleFiltradosModal.slice(0, 15).map((b) => {
                        const selecionado = pacienteBubbleSelecionado?._id === b._id;
                        return (
                          <div
                            key={b._id}
                            onClick={() => selecionarPacienteDoBubble(b)}
                            className={`cursor-pointer p-2.5 rounded-xl border text-xs transition-all flex items-center justify-between ${
                              selecionado
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                : 'bg-white hover:bg-indigo-50/80 border-slate-200 text-slate-800'
                            }`}
                          >
                            <div>
                              <div className="font-bold flex items-center gap-2">
                                <span>{b.txt_nome || 'Sem Nome'}</span>
                                {b.txt_tipo && (
                                  <span
                                    className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${
                                      selecionado ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                                    }`}
                                  >
                                    {b.txt_tipo}
                                  </span>
                                )}
                              </div>
                              <p className={`text-[11px] truncate max-w-md ${selecionado ? 'text-indigo-100' : 'text-slate-500'}`}>
                                {b.txt_endereco || 'Sem endereço'}
                              </p>
                            </div>
                            {selecionado ? (
                              <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
                            ) : (
                              <span className="text-[11px] font-semibold text-indigo-600">Selecionar</span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {pacienteBubbleSelecionado && (
                      <div className="p-3 bg-white rounded-xl border border-indigo-200 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-bold text-indigo-600 uppercase">Paciente Selecionado:</p>
                          <p className="text-xs font-bold text-slate-900">{pacienteBubbleSelecionado.txt_nome}</p>
                        </div>
                        <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          Pronto para Admissão
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Campos Cadastrais do Paciente */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Nome Completo *</label>
                    <input
                      type="text"
                      required
                      value={novoPacienteForm.nome}
                      onChange={(e) => setNovoPacienteForm({ ...novoPacienteForm, nome: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800"
                      placeholder="Ex: Seu João da Silva"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">CPF</label>
                    <input
                      type="text"
                      value={novoPacienteForm.cpf}
                      onChange={(e) => setNovoPacienteForm({ ...novoPacienteForm, cpf: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800"
                      placeholder="000.000.000-00"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Endereço do Domicílio</label>
                    <input
                      type="text"
                      value={novoPacienteForm.endereco}
                      onChange={(e) => setNovoPacienteForm({ ...novoPacienteForm, endereco: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800"
                      placeholder="Rua, número, complemento e cidade"
                    />
                  </div>
                </div>
              </div>

              {/* ETAPA 2: DADOS CLÍNICOS COMPLEMENTARES */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Grau de Complexidade</label>
                  <select
                    value={novoPacienteForm.complexidade}
                    onChange={(e) => setNovoPacienteForm({ ...novoPacienteForm, complexidade: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-semibold"
                  >
                    <option value="Baixa">Baixa Complexidade</option>
                    <option value="Média">Média Complexidade</option>
                    <option value="Alta">Alta Complexidade (UTI Domiciliar)</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Diagnóstico Principal</label>
                  <input
                    type="text"
                    value={novoPacienteForm.diagnostico_principal}
                    onChange={(e) => setNovoPacienteForm({ ...novoPacienteForm, diagnostico_principal: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                    placeholder="Ex: Reabilitação Neurológica Pós-TCE"
                  />
                </div>
              </div>

              {/* ETAPA 3: PLANO TERAPÊUTICO MULTIPROFISSIONAL DINÂMICO */}
              <div className="p-5 rounded-2xl bg-indigo-50/60 border border-indigo-200 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-100 pb-3">
                  <div>
                    <h3 className="text-xs font-extrabold text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-indigo-600" />
                      2. Plano Terapêutico Multiprofissional (Dinâmico)
                    </h3>
                    <p className="text-[11px] text-indigo-700 mt-0.5">
                      Defina a vigência e adicione livremente as categorias profissionais com suas cotas de visitas e cooperados escalados.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={adicionarMetaAoPlano}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] px-3 py-1.5 rounded-xl transition-all shadow-xs flex items-center gap-1 shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    + Adicionar Especialidade
                  </button>
                </div>

                {/* Vigência */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white p-3.5 rounded-xl border border-indigo-100">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Data Início da Vigência</label>
                    <input
                      type="date"
                      value={planoDinamico.data_inicio}
                      onChange={(e) => setPlanoDinamico({ ...planoDinamico, data_inicio: e.target.value })}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Data Fim da Vigência</label>
                    <input
                      type="date"
                      value={planoDinamico.data_fim}
                      onChange={(e) => setPlanoDinamico({ ...planoDinamico, data_fim: e.target.value })}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
                    />
                  </div>
                </div>

                {/* Metas Dinâmicas */}
                <div className="space-y-3">
                  <p className="text-[11px] font-bold text-slate-700">Metas Contratadas por Categoria Profissional:</p>

                  {planoDinamico.metas.map((meta, idx) => (
                    <div key={idx} className="bg-white p-4 rounded-xl border border-indigo-100 shadow-xs space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
                          <div className="sm:col-span-2">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Especialidade</label>
                            <select
                              value={meta.especialidade}
                              onChange={(e) => atualizarMetaDoPlano(idx, 'especialidade', e.target.value)}
                              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900"
                            >
                              {ESPECIALIDADES_DISPONIVEIS.map((esp) => (
                                <option key={esp.valor} value={esp.valor}>
                                  {esp.rotulo}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Qtd. Visitas</label>
                            <input
                              type="number"
                              min="1"
                              max="120"
                              placeholder="Ex: 13"
                              value={meta.quantidade_prevista || ''}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                atualizarMetaDoPlano(idx, 'quantidade_prevista', val);
                                if (idx === 0) {
                                  setNovoPacienteForm((prev) => ({ ...prev, limite_visitas_mes: val }));
                                }
                              }}
                              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-indigo-950 text-center"
                            />
                          </div>
                        </div>

                        {planoDinamico.metas.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removerMetaDoPlano(idx)}
                            className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
                            title="Remover especialidade"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {/* Seletor de Cooperados Designados para a Meta */}
                      <SeletorCooperadosMeta
                        especialidade={meta.especialidade}
                        especialidadeRotulo={
                          ESPECIALIDADES_DISPONIVEIS.find((esp) => esp.valor === meta.especialidade)?.rotulo
                        }
                        profissionaisDesignados={meta.profissionais_designados || []}
                        todosCooperados={cooperados}
                        onToggleCooperado={(coop) => toggleCooperadoNaMeta(idx, coop)}
                        disabled={salvandoPaciente}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Botões do Modal */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3 sticky bottom-0 bg-white/95 backdrop-blur py-2">
                <button
                  type="button"
                  onClick={() => setIsNovoPacienteOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={salvandoPaciente}
                  title="Admitir Paciente & Ativar Plano Terapêutico"
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  <span className="sr-only">Admitir Paciente &amp; Ativar Plano Terapêutico</span>
                  {salvandoPaciente ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Iniciando Plano Terapêutico...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Salvar Admissão &amp; Ativar Plano Terapêutico
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Toast Flutuante de Confirmação de Cópia */}
      {toastMensagem && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900/95 backdrop-blur-md text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200 max-w-md">
          <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-xl">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <p className="text-xs font-semibold leading-relaxed">{toastMensagem}</p>
        </div>
      )}
    </div>
  );
}
