/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Calendar,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Save,
  X,
  Loader2,
  Edit3,
  Lock,
  History,
} from 'lucide-react';
import {
  formatarNomeEspecialidade,
  obterPeriodoMesVigencia,
  formatarDataIsoParaBr,
  PlanoTerapeutico,
  StatusPlanoTerapeutico,
} from '@/lib/tipos-clinicos';
import { fetchFullDataset } from '@/lib/client-fetch';
import SeletorCooperadosMeta, { CooperadoItem } from '../_components/SeletorCooperadosMeta';
import { invalidarCacheNavegacao, CHAVE_CACHE_LISTAGEM_PACIENTES } from '@/lib/cache-navegacao';

interface PlanoTerapeuticoTabProps {
  pacienteId: string;
  pacienteNome: string;
  planos: PlanoTerapeutico[];
  onPlanoAtualizado: (planoAtualizado?: PlanoTerapeutico) => void;
}

const ESPECIALIDADES_DISPONIVEIS = [
  { valor: 'Tecnico_Enfermagem', label: 'Técnico de Enfermagem' },
  { valor: 'Medico', label: 'Médico' },
  { valor: 'Dentista', label: 'Dentista / Odontólogo' },
  { valor: 'Enfermeiro', label: 'Enfermeiro' },
  { valor: 'Fisioterapeuta', label: 'Fisioterapeuta' },
  { valor: 'Fonoaudiologo', label: 'Fonoaudiólogo' },
  { valor: 'Nutricionista', label: 'Nutricionista' },
  { valor: 'Psicologo', label: 'Psicólogo' },
  { valor: 'Terapeuta_Ocupacional', label: 'Terapeuta Ocupacional' },
];

export default function PlanoTerapeuticoTab({
  pacienteId,
  pacienteNome,
  planos,
  onPlanoAtualizado,
}: PlanoTerapeuticoTabProps) {
  const [modoEdicao, setModoEdicao] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  // Lista local de planos com sincronização robusta
  const [planosLocais, setPlanosLocais] = useState<PlanoTerapeutico[]>(planos || []);

  useEffect(() => {
    if (Array.isArray(planos)) {
      setPlanosLocais(planos);
    }
  }, [planos]);

  // Se inicializou sem planos, busca diretamente do endpoint dedicado
  useEffect(() => {
    if (!planos || planos.length === 0) {
      axios
        .get(`/api/gestor/prontuarios/pacientes/${pacienteId}/planos`)
        .then((res) => {
          if (res.data?.success && Array.isArray(res.data?.data) && res.data.data.length > 0) {
            setPlanosLocais(res.data.data);
          }
        })
        .catch(() => {});
    }
  }, [pacienteId, planos]);

  // Lista de cooperados do sistema
  const [todosCooperados, setTodosCooperados] = useState<CooperadoItem[]>([]);

  // Período automático do mês corrente (sempre do dia 01 até 28/29/30/31)
  const periodoMesAtual = obterPeriodoMesVigencia();
  const maiorVersaoAtual = planosLocais.reduce((max, p) => Math.max(max, Number(p.versao || 1)), 0);
  const proximaVersao = maiorVersaoAtual + 1;

  const [formPlano, setFormPlano] = useState<{
    id?: string;
    versaoBase?: number;
    data_inicio: string;
    data_fim: string;
    status: StatusPlanoTerapeutico;
    observacoes: string;
    metas: Array<{
      id?: string;
      especialidade: string;
      quantidade_prevista: number;
      profissionais_designados: Array<{ id: string; nome: string; cargo?: string }>;
    }>;
  }>({
    data_inicio: periodoMesAtual.data_inicio,
    data_fim: periodoMesAtual.data_fim,
    status: 'Ativo',
    observacoes: '',
    metas: [
      { especialidade: 'Tecnico_Enfermagem', quantidade_prevista: 5, profissionais_designados: [] },
      { especialidade: 'Medico', quantidade_prevista: 1, profissionais_designados: [] },
      { especialidade: 'Dentista', quantidade_prevista: 2, profissionais_designados: [] },
    ],
  });

  // Carregar cooperados
  useEffect(() => {
    carregarCooperados();
  }, []);

  const carregarCooperados = async () => {
    const formatar = (raw: any[]): CooperadoItem[] =>
      raw.map((c: any) => ({
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
      await fetchFullDataset<any>('/api/gestor/cooperados', (raw) => {
        setTodosCooperados(formatar(raw));
      });
    } catch (e) {
      console.warn('Tentando fallback GET para cooperados:', e);
      try {
        const res = await axios.get('/api/gestor/cooperados');
        if (res.data.success && Array.isArray(res.data.data)) {
          setTodosCooperados(formatar(res.data.data));
          return;
        }
      } catch (err) {
        console.warn('Erro ao carregar cooperados para o seletor:', err);
      }

      setTodosCooperados([]);
      setErro('Não foi possível carregar os cooperados. Atualize a página e tente novamente.');
    }
  };

  const iniciarNovoPlano = () => {
    const p = obterPeriodoMesVigencia();
    setFormPlano({
      data_inicio: p.data_inicio,
      data_fim: p.data_fim,
      status: 'Ativo',
      observacoes: '',
      metas: [
        { especialidade: 'Tecnico_Enfermagem', quantidade_prevista: 5, profissionais_designados: [] },
        { especialidade: 'Medico', quantidade_prevista: 1, profissionais_designados: [] },
        { especialidade: 'Dentista', quantidade_prevista: 2, profissionais_designados: [] },
      ],
    });
    setErro(null);
    setSucesso(null);
    setModoEdicao(true);
  };

  const editarPlanoExistente = (plano: PlanoTerapeutico) => {
    const p = obterPeriodoMesVigencia(plano.data_inicio);
    setFormPlano({
      id: plano.id,
      versaoBase: plano.versao || 1,
      data_inicio: p.data_inicio,
      data_fim: p.data_fim,
      status: 'Ativo',
      observacoes: plano.observacoes || '',
      metas: (plano.metas || []).map((m) => ({
        id: m.id,
        especialidade: m.especialidade,
        quantidade_prevista: m.quantidade_prevista,
        profissionais_designados: m.profissionais_designados || [],
      })),
    });
    setErro(null);
    setSucesso(null);
    setModoEdicao(true);
  };

  const adicionarMeta = () => {
    setFormPlano({
      ...formPlano,
      metas: [
        ...formPlano.metas,
        { especialidade: 'Fisioterapeuta', quantidade_prevista: 2, profissionais_designados: [] },
      ],
    });
  };

  const removerMeta = (index: number) => {
    setFormPlano({
      ...formPlano,
      metas: formPlano.metas.filter((_, i) => i !== index),
    });
  };

  const atualizarMeta = (index: number, campo: string, valor: any) => {
    const novasMetas = [...formPlano.metas];
    novasMetas[index] = { ...novasMetas[index], [campo]: valor };
    setFormPlano({ ...formPlano, metas: novasMetas });
  };

  const toggleCooperadoNaMeta = (metaIndex: number, coop: CooperadoItem | { id: string; nome: string; cargo?: string }) => {
    const metaAtual = formPlano.metas[metaIndex];
    const designados = metaAtual.profissionais_designados || [];
    const jaExiste = designados.some((d) => d.id === coop.id);

    let novosDesignados;
    if (jaExiste) {
      novosDesignados = designados.filter((d) => d.id !== coop.id);
    } else {
      novosDesignados = [
        ...designados,
        { id: coop.id, nome: coop.nome, cargo: coop.cargo, cpf: (coop as any).cpf },
      ];
    }

    atualizarMeta(metaIndex, 'profissionais_designados', novosDesignados);
  };

  const handleSalvarPlano = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    setSucesso(null);

    if (formPlano.metas.length === 0) {
      setErro('Adicione ao menos uma especialidade com quantidade prevista.');
      setSalvando(false);
      return;
    }

    try {
      const res = await axios.post(`/api/gestor/prontuarios/pacientes/${pacienteId}/planos`, {
        ...formPlano,
        status: 'Ativo',
        paciente_id: pacienteId,
      });
      if (res.data.success) {
        invalidarCacheNavegacao(CHAVE_CACHE_LISTAGEM_PACIENTES);
        const salvo: PlanoTerapeutico = res.data.data;
        const listaAtualizada: PlanoTerapeutico[] | undefined = res.data.planos;
        setSucesso(
          maiorVersaoAtual > 0
            ? `Nova Versão ${salvo?.versao || proximaVersao} salva como Ativa! A versão anterior foi mantida como Inativa para consulta.`
            : `Plano Terapêutico (Versão ${salvo?.versao || 1}) salvo e ativado com sucesso!`
        );
        setModoEdicao(false);
        if (Array.isArray(listaAtualizada) && listaAtualizada.length > 0) {
          setPlanosLocais(listaAtualizada);
        } else if (salvo && salvo.id) {
          setPlanosLocais((prev) => {
            const anterioresInativados = prev.map((p) =>
              p.status === 'Ativo' ? { ...p, status: 'Inativo' as const } : p
            );
            return [salvo, ...anterioresInativados];
          });
        }
        onPlanoAtualizado(salvo);
      } else {
        setErro(res.data.error || 'Erro ao salvar plano terapêutico.');
      }
    } catch (e: any) {
      console.error('Erro ao salvar plano:', e);
      setErro(e.response?.data?.error || 'Erro de comunicação ao salvar o plano terapêutico.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Aba */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-600" />
            Gestão de Planos Terapêuticos (Vigência Mensal & Versionamento)
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Vigência automática do dia 01 até o último dia do mês ({formatarDataIsoParaBr(periodoMesAtual.data_inicio)} a {formatarDataIsoParaBr(periodoMesAtual.data_fim)}) para {pacienteNome}. Ao editar um plano ativo, a versão anterior fica Inativa para consulta e uma nova versão Ativa é gerada.
          </p>
        </div>

        {!modoEdicao && (
          <button
            onClick={iniciarNovoPlano}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-sm flex items-center gap-1.5 shrink-0"
          >
            <Plus className="w-4 h-4" />
            {planosLocais.length > 0 ? `Nova Versão (v${proximaVersao})` : 'Criar Plano Terapêutico (v1)'}
          </button>
        )}
      </div>

      {erro && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          {erro}
        </div>
      )}

      {sucesso && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          {sucesso}
        </div>
      )}

      {/* Formulário de Criação/Edição */}
      {modoEdicao ? (
        <form onSubmit={handleSalvarPlano} className="bg-white rounded-2xl border border-indigo-200 p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h4 className="text-sm font-bold text-slate-900">
                {formPlano.id
                  ? `Editar Plano Terapêutico (Gerar Versão ${proximaVersao} Ativa)`
                  : `Lançar Plano Terapêutico (Versão ${proximaVersao} Ativa)`}
              </h4>
              <p className="text-xs text-slate-500">
                {maiorVersaoAtual > 0
                  ? `A Versão ${maiorVersaoAtual} será automaticamente marcada como Inativa e preservada no histórico para consulta.`
                  : 'O plano será criado na Versão 1 (Ativo) com vigência mensal automática.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setModoEdicao(false)}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Banner de Vigência Mensal Automática (Sem seleção manual de datas) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-indigo-50/60 border border-indigo-100 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 block">
                  Vigência Mensal Automática
                </span>
                <p className="text-xs font-extrabold text-slate-900 mt-0.5">
                  {formatarDataIsoParaBr(formPlano.data_inicio)} até {formatarDataIsoParaBr(formPlano.data_fim)}
                </p>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Válido sempre do dia 01 até o último dia do mês ({periodoMesAtual.ultimo_dia}), renovando a cota automaticamente na virada do mês.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <History className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 block">
                  Controle de Versão do Plano
                </span>
                <p className="text-xs font-extrabold text-slate-900 mt-0.5">
                  Versão {proximaVersao} • Status: Ativo
                </p>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  {maiorVersaoAtual > 0
                    ? `Substitui a Versão ${maiorVersaoAtual}, que passa para o status Inativo na lista abaixo.`
                    : 'Primeira versão ativa do plano terapêutico deste paciente.'}
                </p>
              </div>
            </div>
          </div>

          {/* Metas por Especialidade */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Metas de Atendimentos por Especialidade
                </h5>
                <p className="text-[11px] text-slate-500">
                  Defina a quantidade de visitas no mês e os cooperados autorizados. Ao atingir a cota mensal da especialidade, novos atendimentos são bloqueados automaticamente no painel e no app.
                </p>
              </div>
              <button
                type="button"
                onClick={adicionarMeta}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar Especialidade
              </button>
            </div>

            <div className="space-y-3">
              {formPlano.metas.map((meta, idx) => (
                <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1">
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Especialidade</label>
                      <select
                        value={meta.especialidade}
                        onChange={(e) => atualizarMeta(idx, 'especialidade', e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium"
                      >
                        {ESPECIALIDADES_DISPONIVEIS.map((esp) => (
                          <option key={esp.valor} value={esp.valor}>
                            {esp.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="w-full sm:w-36">
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Qtd. Contratada / Mês
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="120"
                        required
                        value={meta.quantidade_prevista}
                        onChange={(e) => atualizarMeta(idx, 'quantidade_prevista', Number(e.target.value))}
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold"
                        placeholder="Qtd"
                      />
                    </div>

                    <div className="sm:pt-5">
                      <button
                        type="button"
                        onClick={() => removerMeta(idx)}
                        disabled={formPlano.metas.length <= 1}
                        className="text-rose-500 hover:text-rose-700 disabled:opacity-30 p-1.5"
                        title="Remover especialidade"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Seleção de Múltiplos Cooperados para esta mesma especialidade */}
                  <div className="pt-2 border-t border-slate-200/60">
                    <SeletorCooperadosMeta
                      especialidade={meta.especialidade}
                      especialidadeRotulo={
                        ESPECIALIDADES_DISPONIVEIS.find((esp) => esp.valor === meta.especialidade)?.label
                      }
                      profissionaisDesignados={meta.profissionais_designados || []}
                      todosCooperados={todosCooperados}
                      onToggleCooperado={(coop) => toggleCooperadoNaMeta(idx, coop)}
                      disabled={salvando}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Observações */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Observações do Plano</label>
            <textarea
              rows={2}
              value={formPlano.observacoes}
              onChange={(e) => setFormPlano({ ...formPlano, observacoes: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Instruções específicas para a equipe domiciliar..."
            />
          </div>

          {/* Botões de Ação */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setModoEdicao(false)}
              className="px-4 py-2 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50"
            >
              {salvando ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" /> Salvar Versão {proximaVersao} (Ativa)
                </>
              )}
            </button>
          </div>
        </form>
      ) : null}

      {/* Listagem de Planos Cadastrados (Ativo + Histórico Inativo para Consulta) */}
      <div className="space-y-4">
        {planosLocais.length > 0 ? (
          planosLocais.map((plano) => {
            const isVigente = plano.status === 'Ativo';
            const isInativo = plano.status === 'Inativo';
            const versaoNum = plano.versao || 1;
            return (
              <div
                key={plano.id}
                className={`bg-white rounded-2xl border p-6 shadow-sm transition-all ${
                  isVigente
                    ? 'border-indigo-300 ring-2 ring-indigo-50'
                    : 'border-slate-200 bg-slate-50/40 opacity-90'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-extrabold bg-indigo-100 text-indigo-800 border border-indigo-200">
                      Versão {versaoNum} (v{versaoNum})
                    </span>
                    <span
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                        isVigente
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : isInativo
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      {isVigente ? 'Ativo' : isInativo ? 'Inativo (Histórico para Consulta)' : plano.status}
                    </span>
                    <h4 className="text-sm font-bold text-slate-900">
                      Vigência Mensal: {formatarDataIsoParaBr(plano.data_inicio)} até {formatarDataIsoParaBr(plano.data_fim)}
                    </h4>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500 font-medium">
                      Progresso no Mês:{' '}
                      <strong className="text-slate-800">
                        {plano.total_realizado || 0} / {plano.total_previsto || 0}
                      </strong>
                    </span>
                    {isVigente ? (
                      <button
                        onClick={() => editarPlanoExistente(plano)}
                        className="text-indigo-600 hover:text-indigo-800 text-xs font-bold flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-all"
                      >
                        <Edit3 className="w-3.5 h-3.5" /> Editar Plano
                      </button>
                    ) : (
                      <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg flex items-center gap-1">
                        <History className="w-3.5 h-3.5" /> Somente Consulta
                      </span>
                    )}
                  </div>
                </div>

                {/* Metas daquele plano */}
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {(plano.metas || []).map((meta, mIdx) => {
                    const realizadas = meta.quantidade_realizada || 0;
                    const previstas = meta.quantidade_prevista;
                    const esgotada = realizadas >= previstas;

                    return (
                      <div
                        key={mIdx}
                        className={`p-3 rounded-xl border ${
                          esgotada && isVigente
                            ? 'bg-rose-50/50 border-rose-200'
                            : esgotada
                            ? 'bg-emerald-50/40 border-emerald-200'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-slate-900">
                            {formatarNomeEspecialidade(meta.especialidade)}
                          </span>
                          <span className="text-xs font-extrabold text-slate-700">
                            {realizadas} / {previstas}
                          </span>
                        </div>

                        {/* Barra de progresso */}
                        <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden mb-2">
                          <div
                            className={`h-full transition-all ${
                              esgotada && isVigente ? 'bg-rose-500' : esgotada ? 'bg-emerald-500' : 'bg-indigo-600'
                            }`}
                            style={{
                              width: `${Math.min(100, Math.round((realizadas / previstas) * 100))}%`,
                            }}
                          />
                        </div>

                        {esgotada && isVigente && (
                          <div className="mb-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 text-[10px] font-bold">
                            <Lock className="w-3 h-3" /> Limite Mensal Atingido • Bloqueado
                          </div>
                        )}

                        {meta.profissionais_designados && meta.profissionais_designados.length > 0 ? (
                          <div className="text-[10px] text-slate-500">
                            <span className="font-semibold text-slate-600">Escalados:</span>{' '}
                            {meta.profissionais_designados.map((d) => d.nome).join(', ')}
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Livre para a especialidade</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {plano.observacoes && (
                  <p className="mt-3 text-xs text-slate-500 italic pt-3 border-t border-slate-100">
                    Obs: {plano.observacoes}
                  </p>
                )}
              </div>
            );
          })
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500">
            Nenhum plano terapêutico registrado ainda. Clique em &quot;Criar Plano Terapêutico (v1)&quot; para criar o primeiro.
          </div>
        )}
      </div>
    </div>
  );
}
