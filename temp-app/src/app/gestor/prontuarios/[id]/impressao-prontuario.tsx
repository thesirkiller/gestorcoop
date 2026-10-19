/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Printer,
  X,
  Building2,
  Layers,
} from 'lucide-react';
import {
  EMPRESAS_CONTRATANTES,
  EmpresaContratante,
  EmpresaContratanteId,
  obterEmpresaContratante,
  salvarEmpresaContratanteLocal,
  salvarSexoPacienteLocal,
  lerSexoPacienteLocal,
  calcularIdadePaciente,
  formatarDataNascimentoBr,
} from '@/lib/empresas-contratantes';
import { normalizarEspecialidade, formatarNomeEspecialidade } from '@/lib/tipos-clinicos';

export type CategoriaImpressaoId =
  | 'todas'
  | 'individual'
  | 'enfermagem'
  | 'prescricao_enfermagem'
  | 'fisioterapia'
  | 'fonoaudiologia'
  | 'nutricao'
  | 'medico';

export interface CategoriaImpressaoInfo {
  id: CategoriaImpressaoId;
  rotulo: string;
  tituloFicha: string;
  conselhoLabel: string;
  descricao: string;
}

export const CATEGORIAS_IMPRESSAO: CategoriaImpressaoInfo[] = [
  {
    id: 'todas',
    rotulo: 'Prontuário por Categorias (Completo)',
    tituloFicha: 'EVOLUÇÃO DE ENFERMAGEM E MULTIPROFISSIONAL',
    conselhoLabel: 'Nº do Coren / Conselho e assinatura do profissional',
    descricao: 'Imprime o prontuário separado por todas as categorias profissionais e prescrições.',
  },
  {
    id: 'enfermagem',
    rotulo: 'Evolução de Enfermagem',
    tituloFicha: 'EVOLUÇÃO DE ENFERMAGEM',
    conselhoLabel: 'Nº do Coren e assinatura do profissional',
    descricao: 'Evoluções de Enfermeiros e Técnicos de Enfermagem com tabela SSVV.',
  },
  {
    id: 'prescricao_enfermagem',
    rotulo: 'Prescrição de Enfermagem & Aprazamento',
    tituloFicha: 'PRESCRIÇÃO DE ENFERMAGEM E CONTROLE MEDICAMENTOSO',
    conselhoLabel: 'Nº do Coren e assinatura do profissional',
    descricao: 'Grade de prescrições ativas, aprazamentos e checagens à beira do leito.',
  },
  {
    id: 'medico',
    rotulo: 'Evolução Médica',
    tituloFicha: 'EVOLUÇÃO MÉDICA DOMICILIAR',
    conselhoLabel: 'Nº do CRM e assinatura do profissional',
    descricao: 'Atendimentos, avaliações clínicas e condutas médicas.',
  },
  {
    id: 'fisioterapia',
    rotulo: 'Fisioterapia',
    tituloFicha: 'EVOLUÇÃO DE FISIOTERAPIA',
    conselhoLabel: 'Nº do CREFITO e assinatura do profissional',
    descricao: 'Sessões de reabilitação motora e respiratória domiciliar.',
  },
  {
    id: 'fonoaudiologia',
    rotulo: 'Fonoaudiologia',
    tituloFicha: 'EVOLUÇÃO DE FONOAUDIOLOGIA',
    conselhoLabel: 'Nº do CRFa e assinatura do profissional',
    descricao: 'Avaliações de deglutição, fonoterapia e reabilitação fonoaudiológica.',
  },
  {
    id: 'nutricao',
    rotulo: 'Nutrição',
    tituloFicha: 'EVOLUÇÃO DE NUTRIÇÃO CLÍNICA',
    conselhoLabel: 'Nº do CRN e assinatura do profissional',
    descricao: 'Acompanhamento nutricional, dieta enteral/oral e suporte metabólico.',
  },
  {
    id: 'individual',
    rotulo: 'Evolução Individual',
    tituloFicha: 'EVOLUÇÃO DE ENFERMAGEM',
    conselhoLabel: 'Nº do Coren e assinatura do profissional',
    descricao: 'Impressão individualizada de um único atendimento selecionado.',
  },
];

interface ImpressaoProntuarioProps {
  aberto: boolean;
  onFechar: () => void;
  paciente: {
    id: string;
    nome: string;
    cpf: string;
    data_nascimento?: string;
    sexo?: string;
    endereco?: string;
    telefone?: string;
    responsavel_nome?: string;
    responsavel_telefone?: string;
    diagnostico_principal?: string;
    cid10?: string;
    complexidade?: string;
    plano_saude?: string;
    empresa_contratante?: string;
  };
  evolucoes: any[];
  prescricoes: any[];
  aprazamentos: any[];
  sinaisVitais: any[];
  categoriaInicial?: CategoriaImpressaoId;
  evolucaoIndividualId?: string | null;
  empresaSelecionadaId?: EmpresaContratanteId;
  onAlterarEmpresa?: (empresa: EmpresaContratante) => void;
}

export function classificarCategoriaEvolucao(tipoProfissional?: string): CategoriaImpressaoId {
  const norm = normalizarEspecialidade(tipoProfissional || '');
  if (norm === 'Enfermeiro' || norm === 'Tecnico_Enfermagem') return 'enfermagem';
  if (norm === 'Medico') return 'medico';
  if (norm === 'Fisioterapeuta') return 'fisioterapia';
  if (norm === 'Fonoaudiologo') return 'fonoaudiologia';
  if (norm === 'Nutricionista') return 'nutricao';
  return 'enfermagem';
}

export function obterTituloFichaPorTipo(tipoProfissional?: string): string {
  const cat = classificarCategoriaEvolucao(tipoProfissional);
  if (cat === 'enfermagem') return 'EVOLUÇÃO DE ENFERMAGEM';
  if (cat === 'medico') return 'EVOLUÇÃO MÉDICA';
  if (cat === 'fisioterapia') return 'EVOLUÇÃO DE FISIOTERAPIA';
  if (cat === 'fonoaudiologia') return 'EVOLUÇÃO DE FONOAUDIOLOGIA';
  if (cat === 'nutricao') return 'EVOLUÇÃO DE NUTRIÇÃO';
  return 'EVOLUÇÃO DE ENFERMAGEM';
}

export default function ImpressaoProntuarioModal({
  aberto,
  onFechar,
  paciente,
  evolucoes,
  prescricoes,
  aprazamentos,
  sinaisVitais,
  categoriaInicial = 'todas',
  evolucaoIndividualId = null,
  empresaSelecionadaId,
  onAlterarEmpresa,
}: ImpressaoProntuarioProps) {
  const [categoriaAtiva, setCategoriaAtiva] = useState<CategoriaImpressaoId>(
    evolucaoIndividualId ? 'individual' : categoriaInicial
  );
  const [evolucaoSelecionadaId, setEvolucaoSelecionadaId] = useState<string>(
    evolucaoIndividualId || (evolucoes[0]?.id ?? '')
  );
  const [empresaId, setEmpresaId] = useState<EmpresaContratanteId>(
    empresaSelecionadaId || obterEmpresaContratante(paciente.empresa_contratante || paciente.plano_saude).id
  );
  const [sexoPaciente, setSexoPaciente] = useState<string>(
    paciente.sexo || lerSexoPacienteLocal(paciente.id) || 'Não informado'
  );
  const [filtroDataInicio, setFiltroDataInicio] = useState<string>('');
  const [filtroDataFim, setFiltroDataFim] = useState<string>('');

  useEffect(() => {
    if (!aberto) return;
    if (evolucaoIndividualId) {
      setCategoriaAtiva('individual');
      setEvolucaoSelecionadaId(evolucaoIndividualId);
    } else {
      setCategoriaAtiva(categoriaInicial);
      setEvolucaoSelecionadaId(evolucoes[0]?.id ?? '');
    }
  }, [aberto, evolucaoIndividualId, categoriaInicial, evolucoes]);

  useEffect(() => {
    if (empresaSelecionadaId) {
      setEmpresaId(empresaSelecionadaId);
    }
  }, [empresaSelecionadaId]);

  useEffect(() => {
    const salvo = lerSexoPacienteLocal(paciente.id);
    setSexoPaciente(salvo || paciente.sexo || 'Não informado');
  }, [paciente.id, paciente.sexo]);

  const empresaAtual = useMemo(
    () => obterEmpresaContratante(empresaId),
    [empresaId]
  );

  const handleSelecionarEmpresa = (id: EmpresaContratanteId) => {
    setEmpresaId(id);
    const emp = obterEmpresaContratante(id);
    salvarEmpresaContratanteLocal(paciente.id, emp.id, paciente.nome);
    if (onAlterarEmpresa) onAlterarEmpresa(emp);
  };

  const handleAlterarSexo = (novoSexo: string) => {
    setSexoPaciente(novoSexo);
    salvarSexoPacienteLocal(paciente.id, novoSexo);
  };

  // Filtra evoluções por período opcional
  const evolucoesPeriodo = useMemo(() => {
    return evolucoes.filter((ev) => {
      if (!ev.check_in) return true;
      const dataIso = ev.check_in.slice(0, 10);
      if (filtroDataInicio && dataIso < filtroDataInicio) return false;
      if (filtroDataFim && dataIso > filtroDataFim) return false;
      return true;
    });
  }, [evolucoes, filtroDataInicio, filtroDataFim]);

  // Contagem por categoria profissional
  const contagemPorCategoria = useMemo(() => {
    const mapa: Record<CategoriaImpressaoId, number> = {
      todas: evolucoesPeriodo.length + (prescricoes.length > 0 ? 1 : 0),
      individual: evolucoesPeriodo.length > 0 ? 1 : 0,
      enfermagem: 0,
      prescricao_enfermagem: prescricoes.length,
      fisioterapia: 0,
      fonoaudiologia: 0,
      nutricao: 0,
      medico: 0,
    };
    evolucoesPeriodo.forEach((ev) => {
      const cat = classificarCategoriaEvolucao(ev.tipo_profissional);
      mapa[cat] = (mapa[cat] || 0) + 1;
    });
    return mapa;
  }, [evolucoesPeriodo, prescricoes.length]);

  // Evoluções que serão impressas conforme a categoria selecionada
  const evolucoesParaImprimir = useMemo(() => {
    if (categoriaAtiva === 'individual') {
      const encontrada = evolucoes.find((e) => e.id === evolucaoSelecionadaId);
      if (encontrada) return [encontrada];
      return evolucoesPeriodo.slice(0, 1);
    }
    if (categoriaAtiva === 'prescricao_enfermagem') {
      return [];
    }
    if (categoriaAtiva === 'todas') {
      const ordemCategorias: CategoriaImpressaoId[] = [
        'enfermagem',
        'medico',
        'fisioterapia',
        'fonoaudiologia',
        'nutricao',
      ];
      return [...evolucoesPeriodo].sort((a, b) => {
        const catA = ordemCategorias.indexOf(classificarCategoriaEvolucao(a.tipo_profissional));
        const catB = ordemCategorias.indexOf(classificarCategoriaEvolucao(b.tipo_profissional));
        if (catA !== catB) return catA - catB;
        return String(b.check_in || '').localeCompare(String(a.check_in || ''));
      });
    }
    return evolucoesPeriodo.filter(
      (ev) => classificarCategoriaEvolucao(ev.tipo_profissional) === categoriaAtiva
    );
  }, [categoriaAtiva, evolucoes, evolucaoSelecionadaId, evolucoesPeriodo]);

  // Sinais vitais correspondentes a uma data de evolução ou gerais
  const obterSinaisParaEvolucao = (ev?: any) => {
    if (!sinaisVitais || sinaisVitais.length === 0) return [];
    if (!ev?.check_in) return sinaisVitais.slice(0, 5);
    const diaEv = ev.check_in.slice(0, 10);
    const doMesmoDia = sinaisVitais.filter((s) => (s.data_hora || '').slice(0, 10) === diaEv);
    return doMesmoDia.length > 0 ? doMesmoDia : sinaisVitais.slice(0, 5);
  };

  const acionarImpressao = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  if (!aberto) return null;

  const idadeCalculada = calcularIdadePaciente(paciente.data_nascimento);
  const dnFormatada = formatarDataNascimentoBr(paciente.data_nascimento);
  const diagnosticoCompleto = [
    paciente.diagnostico_principal || 'Acompanhamento Domiciliar',
    paciente.cid10 ? `CID-10: ${paciente.cid10}` : '',
  ]
    .filter(Boolean)
    .join(' — ');

  // Componente interno do Cabeçalho Oficial (Verdes Mares / Multi / ISA)
  const renderCabecalhoOficial = (profissionalNome: string, dataAtendimento: string) => (
    <div className="border-2 border-slate-900 rounded-t-lg overflow-hidden mb-2 bg-white text-slate-900">
      {/* Faixa superior com Logomarca e Razão Social / CNPJ */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-3.5 py-2.5 border-b-2 border-slate-900 bg-white">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={empresaAtual.logoUrl}
            alt={`Logo ${empresaAtual.nome}`}
            className="h-12 w-auto object-contain shrink-0"
          />
          <div>
            <h2 className="text-sm sm:text-base font-black uppercase tracking-wide text-slate-900 leading-tight">
              {empresaAtual.nome}
            </h2>
            <p className="text-[11px] font-extrabold text-slate-800 tracking-wide uppercase mt-0.5">
              {empresaAtual.cabecalhoTexto}
            </p>
          </div>
        </div>
        <div className="text-right text-[10px] font-mono text-slate-700 shrink-0">
          <div className="font-bold uppercase text-slate-900">PRONTUÁRIO DOMICILIAR</div>
          <div>CNPJ: {empresaAtual.cnpj}</div>
        </div>
      </div>

      {/* Grade de Identificação Oficial do Paciente (Modelo Verdes Mares) */}
      <div className="text-xs divide-y divide-slate-800">
        <div className="grid grid-cols-12 divide-x divide-slate-800">
          <div className="col-span-12 sm:col-span-6 px-2.5 py-1.5">
            <span className="font-extrabold uppercase text-[10px] text-slate-700 block">
              NOME DO PACIENTE:
            </span>
            <span className="font-black text-slate-900 text-xs uppercase">{paciente.nome}</span>
          </div>
          <div className="col-span-4 sm:col-span-2 px-2.5 py-1.5">
            <span className="font-extrabold uppercase text-[10px] text-slate-700 block">SEXO:</span>
            <span className="font-bold text-slate-900">{sexoPaciente}</span>
          </div>
          <div className="col-span-4 sm:col-span-2 px-2.5 py-1.5">
            <span className="font-extrabold uppercase text-[10px] text-slate-700 block">DN:</span>
            <span className="font-bold text-slate-900 font-mono">{dnFormatada}</span>
          </div>
          <div className="col-span-4 sm:col-span-2 px-2.5 py-1.5">
            <span className="font-extrabold uppercase text-[10px] text-slate-700 block">Idade:</span>
            <span className="font-bold text-slate-900">{idadeCalculada}</span>
          </div>
        </div>

        <div className="grid grid-cols-12 divide-x divide-slate-800">
          <div className="col-span-12 px-2.5 py-1.5">
            <span className="font-extrabold uppercase text-[10px] text-slate-700 mr-1.5">
              DIAGNÓSTICO:
            </span>
            <span className="font-semibold text-slate-900">{diagnosticoCompleto}</span>
          </div>
        </div>

        <div className="grid grid-cols-12 divide-x divide-slate-800 bg-slate-50/70">
          <div className="col-span-12 sm:col-span-8 px-2.5 py-1.5">
            <span className="font-extrabold uppercase text-[10px] text-slate-700 mr-1.5">
              NOME DO PROFISSIONAL:
            </span>
            <span className="font-bold text-slate-900">{profissionalNome}</span>
          </div>
          <div className="col-span-12 sm:col-span-4 px-2.5 py-1.5">
            <span className="font-extrabold uppercase text-[10px] text-slate-700 mr-1.5">
              Data do atendimento:
            </span>
            <span className="font-bold text-slate-900 font-mono">{dataAtendimento}</span>
          </div>
        </div>
      </div>
    </div>
  );

  // Componente interno da Tabela SSVV Oficial
  const renderTabelaSSVV = (sinaisLista: any[]) => {
    const linhasPreenchidas = sinaisLista.slice(0, 6);
    const linhasEmBranco = Math.max(0, 3 - linhasPreenchidas.length);

    return (
      <div className="border-2 border-slate-900 mb-2 bg-white">
        <div className="bg-slate-200/80 border-b-2 border-slate-900 px-3 py-1 flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-wider text-slate-900">
            SSVV — CONTROLE DE SINAIS VITAIS
          </span>
          <span className="text-[10px] font-semibold text-slate-700">
            Parâmetros Fisiológicos Domiciliares
          </span>
        </div>
        <table className="w-full text-xs border-collapse text-slate-900">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-800 text-[11px] font-extrabold uppercase text-center">
              <th className="border-r border-slate-800 py-1 px-2">Horário</th>
              <th className="border-r border-slate-800 py-1 px-2">T</th>
              <th className="border-r border-slate-800 py-1 px-2">FC</th>
              <th className="border-r border-slate-800 py-1 px-2">FR</th>
              <th className="border-r border-slate-800 py-1 px-2">PA</th>
              <th className="border-r border-slate-800 py-1 px-2">Glicemia</th>
              <th className="py-1 px-2">Sat.O2</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-center font-mono text-xs">
            {linhasPreenchidas.map((s, idx) => {
              const horario = s.data_hora
                ? new Date(s.data_hora).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '--:--';
              const pa =
                s.pa_sistolica && s.pa_diastolica
                  ? `${s.pa_sistolica}/${s.pa_diastolica} mmHg`
                  : '--';
              return (
                <tr key={s.id || idx}>
                  <td className="border-r border-slate-800 py-1 px-2 font-bold">{horario}</td>
                  <td className="border-r border-slate-800 py-1 px-2">
                    {s.temp_celsius ? `${s.temp_celsius} °C` : '--'}
                  </td>
                  <td className="border-r border-slate-800 py-1 px-2">
                    {s.fc_bpm ? `${s.fc_bpm} bpm` : '--'}
                  </td>
                  <td className="border-r border-slate-800 py-1 px-2">
                    {s.fr_rpm ? `${s.fr_rpm} irpm` : '--'}
                  </td>
                  <td className="border-r border-slate-800 py-1 px-2 font-bold">{pa}</td>
                  <td className="border-r border-slate-800 py-1 px-2">
                    {s.glicemia_mg_dl ? `${s.glicemia_mg_dl} mg/dL` : '--'}
                  </td>
                  <td className="py-1 px-2 font-bold">
                    {s.spo2_percent ? `${s.spo2_percent}%` : '--'}
                  </td>
                </tr>
              );
            })}
            {Array.from({ length: linhasEmBranco }).map((_, idx) => (
              <tr key={`blank-${idx}`} className="h-6">
                <td className="border-r border-slate-800 py-0.5 px-2 text-slate-400">____:____</td>
                <td className="border-r border-slate-800 py-0.5 px-2"></td>
                <td className="border-r border-slate-800 py-0.5 px-2"></td>
                <td className="border-r border-slate-800 py-0.5 px-2"></td>
                <td className="border-r border-slate-800 py-0.5 px-2"></td>
                <td className="border-r border-slate-800 py-0.5 px-2"></td>
                <td className="py-0.5 px-2"></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // Componente interno do Rodapé Oficial de Assinaturas
  const renderRodapeAssinaturas = (ev?: any) => {
    const catFolha = ev?.tipo_profissional
      ? classificarCategoriaEvolucao(ev.tipo_profissional)
      : categoriaAtiva;
    const infoCat = CATEGORIAS_IMPRESSAO.find((c) => c.id === catFolha);
    const conselhoComplementar =
      infoCat &&
      catFolha !== 'enfermagem' &&
      catFolha !== 'prescricao_enfermagem' &&
      catFolha !== 'individual' &&
      catFolha !== 'todas'
        ? infoCat.conselhoLabel
        : null;

    return (
      <div className="border-2 border-slate-900 rounded-b-lg p-3 bg-white mt-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-1">
          <div className="text-center">
            <div className="min-h-[28px] flex flex-col items-center justify-end pb-1">
              {ev?.profissional_nome && (
                <span className="text-xs font-bold text-slate-900">
                  {ev.profissional_nome}{' '}
                  {ev.profissional_registro ? `— ${ev.profissional_registro}` : ''}
                </span>
              )}
              {ev?.assinatura_digital && (
                <span className="text-[9px] font-mono text-emerald-800">
                  Assinado Digitalmente • Selo: {ev.assinatura_digital}
                </span>
              )}
            </div>
            <div className="border-t border-slate-900 pt-1 text-[11px] font-extrabold text-slate-900 uppercase">
              Nº do Coren e assinatura do profissional
            </div>
            {conselhoComplementar && (
              <div className="text-[10px] font-bold text-slate-600 uppercase mt-0.5">
                ({conselhoComplementar})
              </div>
            )}
          </div>

          <div className="text-center">
            <div className="min-h-[28px] flex flex-col items-center justify-end pb-1">
              {(ev?.responsavel_nome || paciente.responsavel_nome) && (
                <span className="text-xs font-bold text-slate-900">
                  {ev?.responsavel_nome
                    ? `${ev.responsavel_nome}${ev.responsavel_parentesco ? ` (${ev.responsavel_parentesco})` : ''}`
                    : paciente.responsavel_nome}
                </span>
              )}
            </div>
            <div className="border-t border-slate-900 pt-1 text-[11px] font-extrabold text-slate-900 uppercase">
              Responsável (nome legível)
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Renderiza uma folha completa de Evolução Clínica
  const renderFolhaEvolucao = (ev: any, index: number) => {
    const dataAtend = ev.check_in
      ? new Date(ev.check_in).toLocaleDateString('pt-BR') +
        ' (' +
        new Date(ev.check_in).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) +
        (ev.check_out
          ? ' às ' +
            new Date(ev.check_out).toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
            })
          : '') +
        ')'
      : new Date().toLocaleDateString('pt-BR');

    const nomeProf = [
      ev.profissional_nome || 'Profissional Cooperado',
      ev.tipo_profissional ? `(${formatarNomeEspecialidade(ev.tipo_profissional)})` : '',
      ev.profissional_registro ? `- ${ev.profissional_registro}` : '',
    ]
      .filter(Boolean)
      .join(' ');

    const tituloCategoria = obterTituloFichaPorTipo(ev.tipo_profissional);
    const sinaisEv = obterSinaisParaEvolucao(ev);

    return (
      <div
        key={ev.id || index}
        className="folha-impressao-oficial bg-white border border-slate-300 rounded-2xl p-4 sm:p-5 shadow-sm mb-5 print:border-0 print:shadow-none print:p-0 print:mb-0"
      >
        {renderCabecalhoOficial(nomeProf, dataAtend)}

        {/* Tabela SSVV */}
        {renderTabelaSSVV(sinaisEv)}

        {/* Quadro de Evolução */}
        <div className="border-2 border-slate-900 bg-white">
          <div className="bg-slate-200/80 border-b-2 border-slate-900 px-3 py-1 flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-900">
              {tituloCategoria === 'EVOLUÇÃO DE ENFERMAGEM'
                ? 'EVOLUÇÃO DE ENFERMAGEM'
                : `${tituloCategoria} / EVOLUÇÃO DE ENFERMAGEM E MULTIPROFISSIONAL`}
            </span>
            <span className="text-[10px] font-bold text-slate-800 uppercase">
              {ev.turno ? `Turno: ${ev.turno}` : `Status: ${ev.status || 'Finalizado'}`}
            </span>
          </div>

          <div className="p-3 space-y-2 text-xs text-slate-900 leading-snug min-h-[110px]">
            {ev.soap_subjetivo && (
              <div>
                <span className="font-extrabold uppercase text-[11px] text-slate-900 block">
                  S — Subjetivo (Queixas e Relato):
                </span>
                <p className="mt-0.5 whitespace-pre-line">{ev.soap_subjetivo}</p>
              </div>
            )}

            {(ev.soap_objetivo || ev.transcricao_revisada) && (
              <div>
                <span className="font-extrabold uppercase text-[11px] text-slate-900 block">
                  O — Objetivo (Exame Físico e Evolução Clínica):
                </span>
                <p className="mt-0.5 whitespace-pre-line">
                  {ev.soap_objetivo || ev.transcricao_revisada}
                </p>
              </div>
            )}

            {ev.soap_avaliacao && (
              <div>
                <span className="font-extrabold uppercase text-[11px] text-slate-900 block">
                  A — Avaliação (Juízo Clínico):
                </span>
                <p className="mt-0.5 whitespace-pre-line">{ev.soap_avaliacao}</p>
              </div>
            )}

            {ev.soap_plano && (
              <div>
                <span className="font-extrabold uppercase text-[11px] text-slate-900 block">
                  P — Plano (Condutas Realizadas e Orientações):
                </span>
                <p className="mt-0.5 whitespace-pre-line">{ev.soap_plano}</p>
              </div>
            )}

            {!ev.soap_subjetivo &&
              !ev.soap_objetivo &&
              !ev.transcricao_revisada &&
              !ev.soap_avaliacao &&
              !ev.soap_plano && (
                <p className="italic text-slate-500">
                  Evolução clínica registrada sem descrição textual complementar.
                </p>
              )}
          </div>
        </div>

        {renderRodapeAssinaturas(ev)}
      </div>
    );
  };

  // Renderiza a folha de Prescrição de Enfermagem & Médica / Aprazamentos
  const renderFolhaPrescricaoEnfermagem = () => {
    const prescComMedico = prescricoes.find((p) => p.medico_nome);
    const medicoRef = prescComMedico?.medico_nome
      ? `${prescComMedico.medico_nome}${prescComMedico.medico_crm ? ` (${prescComMedico.medico_crm})` : ''}`
      : 'Equipe Médica e de Enfermagem Domiciliar';
    const dataHoje = new Date().toLocaleDateString('pt-BR');

    return (
      <div className="folha-impressao-oficial bg-white border border-slate-300 rounded-2xl p-6 shadow-sm mb-6 print:border-0 print:shadow-none print:p-0 print:mb-0">
        {renderCabecalhoOficial(medicoRef, dataHoje)}

        <div className="border-2 border-slate-900 bg-white mb-3">
          <div className="bg-slate-200/80 border-b-2 border-slate-900 px-3 py-1.5 flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-900">
              PRESCRIÇÃO DE ENFERMAGEM E MÉDICA — PLANO MEDICAMENTOSO E APRAZAMENTO
            </span>
            <span className="text-[10px] font-bold text-slate-800">
              {prescricoes.length} item(ns) prescrito(s)
            </span>
          </div>

          {prescricoes.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">
              Nenhuma prescrição ativa registrada para este paciente no momento.
            </div>
          ) : (
            <table className="w-full text-xs border-collapse text-slate-900">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-800 text-[11px] font-extrabold uppercase text-left">
                  <th className="border-r border-slate-800 py-2 px-2.5">Medicamento / Cuidado</th>
                  <th className="border-r border-slate-800 py-2 px-2.5">Dosagem & Via</th>
                  <th className="border-r border-slate-800 py-2 px-2.5">Médico Prescritor</th>
                  <th className="border-r border-slate-800 py-2 px-2.5 text-center">Frequência</th>
                  <th className="border-r border-slate-800 py-2 px-2.5">Horários (Aprazamento)</th>
                  <th className="py-2 px-2.5">Instruções / Checagem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {prescricoes.map((pr, idx) => {
                  const checagens = aprazamentos.filter(
                    (a) => String(a.prescricao_id) === String(pr.id)
                  );
                  const administradas = checagens.filter((c) => c.status === 'Administrado').length;

                  return (
                    <tr key={pr.id || idx}>
                      <td className="border-r border-slate-800 py-2 px-2.5 font-bold">
                        {idx + 1}. {pr.medicamento}
                      </td>
                      <td className="border-r border-slate-800 py-2 px-2.5">
                        <span className="font-semibold">{pr.dosagem}</span>
                        <span className="block text-[10px] text-slate-600">
                          Via {pr.via_administracao}
                        </span>
                      </td>
                      <td className="border-r border-slate-800 py-2 px-2.5">
                        <span className="font-semibold text-slate-900 block">
                          {pr.medico_nome || '--'}
                        </span>
                        {pr.medico_crm && (
                          <span className="block text-[10px] font-mono text-slate-700">
                            {pr.medico_crm}
                          </span>
                        )}
                      </td>
                      <td className="border-r border-slate-800 py-2 px-2.5 text-center font-mono font-bold">
                        {pr.frequencia_horas ? `${pr.frequencia_horas}/${pr.frequencia_horas}h` : '--'}
                      </td>
                      <td className="border-r border-slate-800 py-2 px-2.5 font-mono">
                        {Array.isArray(pr.horarios_padrao) && pr.horarios_padrao.length > 0
                          ? pr.horarios_padrao.join(' • ')
                          : '08:00 • 20:00'}
                      </td>
                      <td className="py-2 px-2.5">
                        {pr.instrucoes && <div className="italic mb-0.5">{pr.instrucoes}</div>}
                        <span className="text-[10px] font-bold text-slate-700">
                          {checagens.length > 0
                            ? `${administradas}/${checagens.length} doses checadas`
                            : `Status: ${pr.status || 'Ativa'}`}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Tabela SSVV complementar na folha de prescrição de enfermagem */}
        {renderTabelaSSVV(sinaisVitais)}

        {renderRodapeAssinaturas()}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-sm flex items-center justify-center p-2 sm:p-3 overflow-y-auto print:static print:bg-white print:p-0 print:block print:overflow-visible">
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 8mm;
          }
          html, body {
            height: auto !important;
            overflow: visible !important;
            background: white !important;
          }
          body * {
            visibility: hidden;
          }
          #container-impressao-prontuario,
          #container-impressao-prontuario * {
            visibility: visible;
          }
          #container-impressao-prontuario {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            height: auto !important;
            max-height: none !important;
            margin: 0;
            padding: 0;
            overflow: visible !important;
            background: white !important;
          }
          .ocultar-na-impressao {
            display: none !important;
          }
          .folha-impressao-oficial {
            page-break-after: always;
            break-after: page;
            page-break-inside: avoid;
            break-inside: avoid-page;
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            padding: 4mm !important;
          }
          .folha-impressao-oficial:last-child {
            page-break-after: auto;
            break-after: auto;
          }
        }
      `}</style>

      <div className="bg-slate-100 rounded-3xl max-w-5xl w-full max-h-[97vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden print:block print:overflow-visible print:max-w-none print:max-h-none print:rounded-none print:border-0 print:shadow-none print:bg-white">
        {/* Barra Superior de Controles do Modal (Oculta na Impressão) */}
        <div className="ocultar-na-impressao bg-white border-b border-slate-200 px-4 py-3 sm:px-5 sm:py-3.5 flex flex-col gap-2.5 sticky top-0 z-20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-indigo-100 text-indigo-700 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  Impressão Oficial Homologada
                </span>
                <span className="bg-teal-100 text-teal-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                  Logo: {empresaAtual.nomeCurto}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2 mt-0.5">
                <Printer className="w-5 h-5 text-indigo-600" />
                Central de Impressão de Prontuários por Categoria &amp; Evolução Individual
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={acionarImpressao}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                Imprimir / Salvar PDF
              </button>
              <button
                type="button"
                onClick={onFechar}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                title="Fechar visualização de impressão"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Linha 1 de Configuração: Empresa Contratante (Logo) + Sexo + Período */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 bg-slate-50 px-3 py-2.5 rounded-2xl border border-slate-200">
            <div className="md:col-span-5">
              <label className="block text-[10px] font-extrabold text-slate-600 uppercase mb-1 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                Empresa Contratante (Cabeçalho &amp; Logomarca)
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {EMPRESAS_CONTRATANTES.map((emp) => {
                  const ativa = empresaAtual.id === emp.id;
                  return (
                    <button
                      key={emp.id}
                      type="button"
                      onClick={() => handleSelecionarEmpresa(emp.id)}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                        ativa
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span>{emp.nomeCurto}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="md:col-span-3">
              <label className="block text-[10px] font-extrabold text-slate-600 uppercase mb-1.5">
                Sexo do Paciente (Ficha)
              </label>
              <select
                value={sexoPaciente}
                onChange={(e) => handleAlterarSexo(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
              >
                <option value="Feminino">Feminino (F)</option>
                <option value="Masculino">Masculino (M)</option>
                <option value="Não informado">Não informado</option>
              </select>
            </div>

            <div className="md:col-span-4 grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-extrabold text-slate-600 uppercase mb-1.5">
                  De (Data)
                </label>
                <input
                  type="date"
                  value={filtroDataInicio}
                  onChange={(e) => setFiltroDataInicio(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800"
                />
              </div>
              <div>
                <label className="block text-[10px] font-extrabold text-slate-600 uppercase mb-1.5">
                  Até (Data)
                </label>
                <input
                  type="date"
                  value={filtroDataFim}
                  onChange={(e) => setFiltroDataFim(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800"
                />
              </div>
            </div>
          </div>

          {/* Linha 2: Seletor de Categorias Profissionais (Solicitação Cícero Vanderley) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                Separar Impressão por Categoria Profissional:
              </span>
              {categoriaAtiva === 'individual' && evolucoes.length > 0 && (
                <select
                  value={evolucaoSelecionadaId}
                  onChange={(e) => setEvolucaoSelecionadaId(e.target.value)}
                  className="px-3 py-1 bg-indigo-50 border border-indigo-200 rounded-lg text-xs font-bold text-indigo-900"
                >
                  {evolucoes.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.check_in ? new Date(ev.check_in).toLocaleDateString('pt-BR') : '--'} —{' '}
                      {ev.profissional_nome || 'Profissional'} (
                      {formatarNomeEspecialidade(ev.tipo_profissional)})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {CATEGORIAS_IMPRESSAO.map((cat) => {
                const selecionada = categoriaAtiva === cat.id;
                const qtd = contagemPorCategoria[cat.id] ?? 0;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategoriaAtiva(cat.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                      selecionada
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span>{cat.rotulo}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                        selecionada ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {qtd}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Área de Preview das Folhas A4 (Visível na tela e na impressão) */}
        <div
          id="container-impressao-prontuario"
          className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 print:overflow-visible print:p-0"
        >
          {/* Caso 1: Categoria é Prescrição de Enfermagem ou Todas */}
          {(categoriaAtiva === 'prescricao_enfermagem' ||
            (categoriaAtiva === 'todas' && prescricoes.length > 0)) &&
            renderFolhaPrescricaoEnfermagem()}

          {/* Caso 2: Folhas de Evoluções da Categoria Selecionada */}
          {categoriaAtiva !== 'prescricao_enfermagem' && (
            <>
              {evolucoesParaImprimir.length > 0 ? (
                evolucoesParaImprimir.map((ev, idx) => renderFolhaEvolucao(ev, idx))
              ) : (
                /* Se não houver evolução cadastrada para a categoria, exibe ficha oficial em branco pronta para preenchimento ou conferência */
                <div className="folha-impressao-oficial bg-white border border-slate-300 rounded-2xl p-6 shadow-sm print:border-0 print:shadow-none print:p-0">
                  {renderCabecalhoOficial(
                    '____________________________________________',
                    new Date().toLocaleDateString('pt-BR')
                  )}
                  {renderTabelaSSVV(sinaisVitais)}
                  <div className="border-2 border-slate-900 bg-white">
                    <div className="bg-slate-200/80 border-b-2 border-slate-900 px-3 py-1.5 flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-900">
                        {CATEGORIAS_IMPRESSAO.find((c) => c.id === categoriaAtiva)?.tituloFicha ||
                          'EVOLUÇÃO DE ENFERMAGEM'}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-700">
                        Ficha de Atendimento Domiciliar
                      </span>
                    </div>
                    <div className="p-4 min-h-[240px] space-y-5 text-xs text-slate-500">
                      <p className="text-slate-600 font-medium">
                        Nenhum atendimento digitalizado encontrado nesta categoria para o filtro selecionado. Ficha oficial formatada para impressão:
                      </p>
                      <div className="space-y-4 pt-2">
                        <div className="border-b border-dashed border-slate-300 h-5"></div>
                        <div className="border-b border-dashed border-slate-300 h-5"></div>
                        <div className="border-b border-dashed border-slate-300 h-5"></div>
                        <div className="border-b border-dashed border-slate-300 h-5"></div>
                        <div className="border-b border-dashed border-slate-300 h-5"></div>
                        <div className="border-b border-dashed border-slate-300 h-5"></div>
                      </div>
                    </div>
                  </div>
                  {renderRodapeAssinaturas()}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
