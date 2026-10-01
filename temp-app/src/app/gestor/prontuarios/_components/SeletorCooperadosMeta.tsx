'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, X, Check, Users, Filter, ChevronDown, UserCheck } from 'lucide-react';

export interface CooperadoItem {
  id: string;
  nome: string;
  cargo?: string;
  profissoes?: string[];
  cpf?: string;
  email?: string;
}

interface SeletorCooperadosMetaProps {
  especialidade: string;
  especialidadeRotulo?: string;
  profissionaisDesignados: Array<{ id: string; nome: string; cargo?: string }>;
  todosCooperados: CooperadoItem[];
  onToggleCooperado: (coop: CooperadoItem) => void;
  disabled?: boolean;
}

function normalizeString(str: string): string {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .trim();
}

function matchesSpecialty(coop: CooperadoItem, especialidade: string, rotulo?: string): boolean {
  if (!especialidade) return true;
  const espNorm = normalizeString(especialidade);
  const rotNorm = normalizeString(rotulo || '');
  const coopCargoNorm = normalizeString(coop.cargo || '');
  const coopProfsNorm = (coop.profissoes || []).map(normalizeString);

  const check = (source: string) => {
    if (!source) return false;
    if (source === espNorm || (rotNorm && source === rotNorm)) return true;
    if (espNorm && source.includes(espNorm)) return true;
    if (rotNorm && source.includes(rotNorm)) return true;
    if (source.length >= 4 && (espNorm.includes(source) || (rotNorm && rotNorm.includes(source)))) return true;
    return false;
  };

  if (check(coopCargoNorm)) return true;
  return coopProfsNorm.some(check);
}

export default function SeletorCooperadosMeta({
  especialidade,
  especialidadeRotulo,
  profissionaisDesignados,
  todosCooperados,
  onToggleCooperado,
  disabled = false,
}: SeletorCooperadosMetaProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [apenasEspecialidade, setApenasEspecialidade] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fecha o dropdown se clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const totalSelecionados = profissionaisDesignados.length;

  // Filtra cooperados de forma performática
  const { cooperadosFiltrados, temCooperadosDaEspecialidade } = useMemo(() => {
    const sTerm = normalizeString(searchTerm);
    const espRotulo = especialidadeRotulo || especialidade;

    const daEspecialidadeCount = todosCooperados.filter((c) =>
      matchesSpecialty(c, especialidade, espRotulo)
    ).length;

    let base = todosCooperados;

    if (apenasEspecialidade && daEspecialidadeCount > 0) {
      base = base.filter((c) => matchesSpecialty(c, especialidade, espRotulo));
    }

    if (sTerm) {
      base = base.filter((c) => {
        const nomeNorm = normalizeString(c.nome);
        const cargoNorm = normalizeString(c.cargo || '');
        const cpfNorm = (c.cpf || '').replace(/\D/g, '');
        const sDigits = sTerm.replace(/\D/g, '');

        const matchNome = nomeNorm.includes(sTerm);
        const matchCargo = cargoNorm.includes(sTerm);
        const matchCpf = sDigits && cpfNorm.includes(sDigits);

        return matchNome || matchCargo || matchCpf;
      });
    }

    return {
      cooperadosFiltrados: base,
      temCooperadosDaEspecialidade: daEspecialidadeCount > 0,
    };
  }, [todosCooperados, especialidade, especialidadeRotulo, apenasEspecialidade, searchTerm]);

  // Limita a renderização inicial a 40 para garantir fluidez máxima no DOM com milhares de itens
  const exibicaoCooperados = useMemo(() => {
    return cooperadosFiltrados.slice(0, 40);
  }, [cooperadosFiltrados]);

  return (
    <div className="space-y-2" ref={containerRef}>
      {/* Cabeçalho do Bloco */}
      <div className="flex items-center justify-between gap-2">
        <label className="text-[10px] font-bold text-slate-600 uppercase flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-indigo-600" />
          Cooperados Escalados para esta Cota (Seleção Múltipla):
        </label>

        {totalSelecionados > 0 ? (
          <span className="text-[10px] font-extrabold px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full">
            {totalSelecionados} escalado{totalSelecionados > 1 ? 's' : ''}
          </span>
        ) : (
          <span className="text-[10px] text-slate-600 italic">
            (Cota aberta para qualquer cooperado da categoria)
          </span>
        )}
      </div>

      {/* Chips dos Cooperados Selecionados */}
      {profissionaisDesignados.length > 0 && (
        <div className="flex flex-wrap gap-1.5 p-2 bg-indigo-50/50 rounded-xl border border-indigo-100">
          {profissionaisDesignados.map((desig) => (
            <span
              key={desig.id}
              className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 bg-white border border-indigo-200 text-indigo-950 rounded-lg text-xs font-semibold shadow-2xs animate-in fade-in duration-150"
            >
              <UserCheck className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span className="max-w-[200px] truncate" title={desig.nome}>
                {desig.nome}
              </span>
              {desig.cargo && (
                <span className="text-[9px] text-slate-600 font-normal border-l border-slate-200 pl-1">
                  {desig.cargo}
                </span>
              )}
              <button
                type="button"
                onClick={() => onToggleCooperado({ id: desig.id, nome: desig.nome, cargo: desig.cargo })}
                disabled={disabled}
                className="p-0.5 hover:bg-rose-100 hover:text-rose-700 text-slate-600 rounded-md transition-colors"
                title="Remover cooperado desta cota"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Campo de Pesquisa e Seleção */}
      <div className="relative">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-slate-600 absolute left-3 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            disabled={disabled}
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              if (!isOpen) setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            placeholder={`Buscar por nome, CPF ou cargo para escalar nesta cota...`}
            className="w-full pl-8 pr-16 py-1.5 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 rounded-lg text-xs font-medium text-slate-800 placeholder-slate-600 transition-all outline-hidden"
          />

          <div className="absolute right-2 flex items-center gap-1">
            {searchTerm && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  inputRef.current?.focus();
                }}
                className="p-1 text-slate-600 hover:text-slate-600 rounded-md"
                title="Limpar busca"
              >
                <X className="w-3 h-3" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className="p-1 text-slate-600 hover:text-slate-600 rounded-md transition-transform"
              title={isOpen ? 'Recolher' : 'Expandir lista'}
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {/* Dropdown de Resultados Pesquisáveis */}
        {isOpen && (
          <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
            {/* Barra de Filtro de Categoria e Estatísticas */}
            <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <div className="flex items-center gap-2">
                {temCooperadosDaEspecialidade && (
                  <button
                    type="button"
                    onClick={() => setApenasEspecialidade(!apenasEspecialidade)}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold text-[10px] transition-all border ${
                      apenasEspecialidade
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Filter className="w-2.5 h-2.5" />
                    {apenasEspecialidade
                      ? `Filtrado por: ${especialidadeRotulo || especialidade}`
                      : 'Ver todos os cooperados'}
                  </button>
                )}
              </div>

              <span className="text-[10px] text-slate-600 font-medium">
                {cooperadosFiltrados.length === 1
                  ? '1 cooperado disponível'
                  : `${cooperadosFiltrados.length} cooperados encontrados`}
              </span>
            </div>

            {/* Lista Rolável de Cooperados */}
            <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
              {exibicaoCooperados.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-600 space-y-1">
                  <p className="font-semibold text-slate-700">Nenhum cooperado encontrado</p>
                  <p className="text-[11px]">
                    {apenasEspecialidade
                      ? 'Nenhum profissional localizado nesta especialidade com o termo digitado.'
                      : 'Verifique se o nome ou CPF digitado está correto.'}
                  </p>
                  {apenasEspecialidade && temCooperadosDaEspecialidade && (
                    <button
                      type="button"
                      onClick={() => setApenasEspecialidade(false)}
                      className="mt-1 text-xs text-indigo-600 font-bold hover:underline"
                    >
                      Buscar em toda a cooperativa (sem filtro de especialidade)
                    </button>
                  )}
                </div>
              ) : (
                exibicaoCooperados.map((coop) => {
                  const selecionado = profissionaisDesignados.some((d) => d.id === coop.id);

                  return (
                    <button
                      key={coop.id}
                      type="button"
                      onClick={() => onToggleCooperado(coop)}
                      className={`w-full px-3 py-2 text-left flex items-center justify-between gap-3 transition-colors ${
                        selecionado
                          ? 'bg-indigo-50/70 hover:bg-indigo-100/70'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                            selecionado
                              ? 'bg-indigo-600 border-indigo-600 text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {selecionado && <Check className="w-3 h-3 text-white" />}
                        </div>

                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate">
                            {coop.nome}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] text-slate-600 truncate">
                            {coop.cargo && (
                              <span className="font-medium text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded">
                                {coop.cargo}
                              </span>
                            )}
                            {coop.cpf && <span>CPF: {coop.cpf}</span>}
                          </div>
                        </div>
                      </div>

                      {selecionado ? (
                        <span className="text-[10px] font-bold text-indigo-600 shrink-0">
                          Escalado
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-600 group-hover:text-indigo-600 shrink-0">
                          + Escalar
                        </span>
                      )}
                    </button>
                  );
                })
              )}

              {cooperadosFiltrados.length > 40 && (
                <div className="px-3 py-1.5 bg-slate-50 text-center text-[10px] text-slate-600">
                  Mostrando os 40 primeiros de {cooperadosFiltrados.length} cooperados. Digite o nome ou CPF para refinar.
                </div>
              )}
            </div>

            {/* Rodapé da lista */}
            <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[10px] text-slate-600">
                Clique nos cooperados para marcar ou desmarcar.
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 px-2 py-0.5 rounded hover:bg-indigo-50 transition-colors"
              >
                Concluir Seleção
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
