'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { fetchFullDataset } from '@/lib/client-fetch';
import {
  Users,
  Clock,
  Search,
  Eye,
  CheckCircle,
  FileText,
  User,
  MapPin,
  Briefcase,
  CreditCard,
  X,
  Loader2,
  RefreshCw,
  Copy,
  Check,
  ChevronDown,
  ExternalLink,
} from 'lucide-react';

interface Cooperado {
  _id: string;
  txt_nomeCompleto: string;
  txt_CPF: string;
  txt_email: string;
  txt_whatsapp: string;
  txt_telefone?: string;
  txt_rg?: string;
  txt_orgaoEmissor?: string;
  txt_orgaoUF?: string;
  date_dataNascimento?: string;
  txt_estadoCivil?: string;
  txt_nomeMae?: string;
  txt_nomePai?: string;
  txt_grauEscolaridade?: string;
  txt_etinia?: string;
  txt_pis?: string;
  txt_endereco?: string;
  fks_pasta?: string[];
  fk_usuario?: string;
  fks_profissoes?: string[]; // options list
  // relationships from Bubble
  'fks_Profissões '?: string[];
  'fks_ContasBancarias'?: string[];
  txt_termo_status?: string;
  file_termo_assinado?: string;
}

export default function GestorDashboard() {
  const [cooperados, setCooperados] = useState<Cooperado[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCooperado, setSelectedCooperado] = useState<Cooperado | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  // New states for filters, links and loading feedback
  const [selectedProfession, setSelectedProfession] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [showProfessionDropdown, setShowProfessionDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [generatingTermId, setGeneratingTermId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [generatedLinks, setGeneratedLinks] = useState<Record<string, string>>({});

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Reset pagination when search query or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedProfession, selectedStatus]);

  // Fetch data
  const fetchData = async () => {
    setLoading(true);
    try {
      await fetchFullDataset<Cooperado>('/api/gestor/cooperados', (data) => {
        setCooperados(data);
        setLoading(false);
      });
    } catch (err) {
      console.error('Error fetching cooperados:', err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Dynamic filter for unique professions present in the cooperados list
  const uniqueProfessions = Array.from(
    new Set(cooperados.flatMap((c) => c.fks_profissoes || []))
  ).sort();

  // Filter cooperados client-side based on search query, profession and status
  const filteredCooperados = cooperados.filter((c) => {
    // 1. Search Query
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
      (c.txt_nomeCompleto || '').toLowerCase().includes(searchLower) ||
      (c.txt_CPF || '').includes(searchQuery) ||
      (c.txt_email || '').toLowerCase().includes(searchLower);

    if (!matchesSearch) return false;

    // 2. Profession Filter
    if (selectedProfession) {
      const hasProf = (c.fks_profissoes || []).includes(selectedProfession);
      if (!hasProf) return false;
    }

    // 3. Status Filter
    if (selectedStatus) {
      const isApproved = !!c.fk_usuario;
      const isSigned = c.txt_termo_status === 'Assinado';
      const isWaiting = c.txt_termo_status === 'Aguardando Assinatura';
      const hasNoTerm = !c.txt_termo_status;

      if (selectedStatus === 'sem_termo' && !hasNoTerm) return false;
      if (selectedStatus === 'aguardando_assinatura' && !isWaiting) return false;
      if (selectedStatus === 'em_analise' && (!isSigned || isApproved)) return false;
      if (selectedStatus === 'aprovados' && !isApproved) return false;
    }

    return true;
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredCooperados.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedCooperados = filteredCooperados.slice(startIndex, endIndex);

  // Calculate metrics (Global values, independent of local filters)
  const totalSubmissions = cooperados.length;
  const waitingSignatureCount = cooperados.filter((c) => c.txt_termo_status === 'Aguardando Assinatura' && !c.fk_usuario).length;
  const underAnalysisCount = cooperados.filter((c) => c.txt_termo_status === 'Assinado' && !c.fk_usuario).length;
  const approvedCount = cooperados.filter((c) => !!c.fk_usuario).length;

  // Open detail modal
  const openDetails = (c: Cooperado) => {
    setSelectedCooperado(c);
    setModalOpen(true);
  };

  // Generate Termo de Adesão API call
  const handleGerarTermo = async (id: string) => {
    setGeneratingTermId(id);
    try {
      const res = await axios.post('/api/gestor/cooperados/gerar-termo', { id });
      if (res.data.success && res.data.signUrl) {
        // Store generated ZapSign signature link
        setGeneratedLinks((prev) => ({ ...prev, [id]: res.data.signUrl }));

        // Update local list state
        setCooperados((prev) =>
          prev.map((c) =>
            c._id === id ? { ...c, txt_termo_status: 'Aguardando Assinatura' } : c
          )
        );

        // Update currently selected modal item
        if (selectedCooperado && selectedCooperado._id === id) {
          setSelectedCooperado((prev) =>
            prev ? { ...prev, txt_termo_status: 'Aguardando Assinatura' } : null
          );
        }
      }
    } catch (err) {
      console.error('Error generating term:', err);
      alert('Falha ao gerar termo de adesão.');
    } finally {
      setGeneratingTermId(null);
    }
  };

  // Copy ZapSign link to clipboard helper
  const handleCopyLink = (id: string, link: string) => {
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Approve cooperado
  const approveCooperado = async (id: string) => {
    setApprovingId(id);
    try {
      const res = await axios.post('/api/gestor/cooperados/aprovar', { id });
      if (res.data.success) {
        // Update local list
        setCooperados((prev) =>
          prev.map((c) =>
            c._id === id ? { ...c, fk_usuario: 'approved-user-id' } : c
          )
        );
        // Update currently selected modal item
        if (selectedCooperado && selectedCooperado._id === id) {
          setSelectedCooperado((prev) =>
            prev ? { ...prev, fk_usuario: 'approved-user-id' } : null
          );
        }
      }
    } catch (err) {
      console.error('Error approving cooperado:', err);
      alert('Falha ao aprovar cooperado.');
    } finally {
      setApprovingId(null);
    }
  };

  return (
    <div className="text-slate-800 font-sans">
      {/* Header */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-8 h-8 text-indigo-600" />
            Painel do Gestor
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Monitore, analise e aprove a adesão dos novos sócios cooperados.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={fetchData}
            className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 p-2 rounded-lg transition-all shadow-sm"
            title="Atualizar dados"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 mb-10">
        {[
          {
            label: 'Total Inscrições',
            val: totalSubmissions,
            icon: Users,
            color: 'text-indigo-600 bg-indigo-500/10 border-indigo-500/20',
          },
          {
            label: 'Aguardando Assinatura',
            val: waitingSignatureCount,
            icon: Clock,
            color: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
          },
          {
            label: 'Em Análise',
            val: underAnalysisCount,
            icon: FileText,
            color: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
          },
          {
            label: 'Aprovados',
            val: approvedCount,
            icon: CheckCircle,
            color: 'text-green-600 bg-green-500/10 border-green-500/20',
          },
        ].map((item, idx) => {
          const Icon = item.icon;
          return (
            <div
              key={idx}
              className="bg-white border border-slate-200 p-5 rounded-xl flex items-center justify-between gap-4 shadow-sm"
            >
              <div>
                <span className="text-xs text-slate-400 font-semibold">{item.label}</span>
                <p className="text-2xl font-black text-slate-900 mt-1">{item.val}</p>
              </div>
              <div className={`p-3 rounded-lg border ${item.color}`}>
                <Icon className="w-5 h-5" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters (Style matching Financeiro Page) */}
      <div className="max-w-7xl mx-auto bg-white border border-slate-200 p-6 rounded-xl shadow-sm mb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Search Box */}
          <div className="relative">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              Busca Rápida
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-450" />
              <input
                type="text"
                placeholder="Nome, CPF ou e-mail..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white transition-all shadow-sm"
              />
            </div>
          </div>

          {/* Profession Filter */}
          <div className="relative">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              Filtrar por Profissão
            </label>
            <div
              onClick={() => {
                setShowProfessionDropdown(!showProfessionDropdown);
                setShowStatusDropdown(false);
              }}
              className="flex items-center justify-between p-2.5 border border-slate-200 rounded-lg bg-slate-50 hover:bg-white transition-all cursor-pointer text-sm"
            >
              <span className="truncate pr-2">
                {selectedProfession || 'Todas as Profissões'}
              </span>
              <ChevronDown className="w-4 h-4 text-slate-500" />
            </div>

            {showProfessionDropdown && (
              <div className="absolute z-30 w-full mt-1 border border-slate-200 bg-white rounded-lg shadow-lg max-h-48 overflow-y-auto">
                <button
                  onClick={() => {
                    setSelectedProfession('');
                    setShowProfessionDropdown(false);
                  }}
                  className="w-full text-left p-2.5 hover:bg-slate-50 transition-all border-b border-slate-100 text-xs text-slate-700"
                >
                  Todas as Profissões
                </button>
                {uniqueProfessions.map((prof) => (
                  <button
                    key={prof}
                    onClick={() => {
                      setSelectedProfession(prof);
                      setShowProfessionDropdown(false);
                    }}
                    className="w-full text-left p-2.5 hover:bg-slate-50 transition-all border-b border-slate-100 text-xs text-slate-700 font-semibold"
                  >
                    {prof}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Status Filter */}
          <div className="relative">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              Filtrar por Status
            </label>
            <div
              onClick={() => {
                setShowStatusDropdown(!showStatusDropdown);
                setShowProfessionDropdown(false);
              }}
              className="flex items-center justify-between p-2.5 border border-slate-200 rounded-lg bg-slate-50 hover:bg-white transition-all cursor-pointer text-sm"
            >
              <span>
                {selectedStatus === '' && 'Todos os Status'}
                {selectedStatus === 'sem_termo' && 'Sem Termo'}
                {selectedStatus === 'aguardando_assinatura' && 'Aguardando Assinatura'}
                {selectedStatus === 'em_analise' && 'Em Análise'}
                {selectedStatus === 'aprovados' && 'Aprovados'}
              </span>
              <ChevronDown className="w-4 h-4 text-slate-500" />
            </div>

            {showStatusDropdown && (
              <div className="absolute z-30 w-full mt-1 border border-slate-200 bg-white rounded-lg shadow-lg">
                {[
                  { value: '', label: 'Todos os Status' },
                  { value: 'sem_termo', label: 'Sem Termo' },
                  { value: 'aguardando_assinatura', label: 'Aguardando Assinatura' },
                  { value: 'em_analise', label: 'Em Análise (Assinado)' },
                  { value: 'aprovados', label: 'Aprovados' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setSelectedStatus(opt.value);
                      setShowStatusDropdown(false);
                    }}
                    className="w-full text-left p-2.5 hover:bg-slate-50 transition-all border-b border-slate-100 text-xs text-slate-700"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabela de Cooperados */}
      <div className="max-w-7xl mx-auto bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mb-12">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h4 className="text-sm font-bold text-slate-800">Detalhamento das Adesões</h4>
          <span className="text-xs bg-indigo-50 px-3 py-1 rounded-full text-indigo-700 font-semibold border border-indigo-150">
            Exibindo {filteredCooperados.length} cooperados
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-400 font-bold border-b border-slate-100 text-xs uppercase">
                <th className="py-3.5 px-6">Cooperado / Documentos</th>
                <th className="py-3.5 px-6">Contato</th>
                <th className="py-3.5 px-6">Profissões</th>
                <th className="py-3.5 px-6">Status do Termo</th>
                <th className="py-3.5 px-6 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-16">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
                      <span className="text-xs text-slate-450">Buscando cadastros no Bubble...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredCooperados.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-400 text-sm">
                    Nenhum cooperado encontrado com os filtros aplicados.
                  </td>
                </tr>
              ) : (
                paginatedCooperados.map((coop) => {
                  const isApproved = !!coop.fk_usuario;
                  const isSigned = coop.txt_termo_status === 'Assinado';
                  const isWaiting = coop.txt_termo_status === 'Aguardando Assinatura';
                  const hasNoTerm = !coop.txt_termo_status;

                  // Get active ZapSign link if generated in this session
                  const activeLink = generatedLinks[coop._id];

                  return (
                    <tr
                      key={coop._id}
                      className={`hover:bg-slate-50/50 transition-colors ${isApproved ? 'opacity-80' : ''
                        }`}
                    >
                      {/* Name & CPF */}
                      <td className="py-4 px-6">
                        <p className="font-bold text-slate-800">{coop.txt_nomeCompleto}</p>
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">CPF: {coop.txt_CPF}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{coop.txt_email}</p>
                      </td>

                      {/* WhatsApp / Telefone */}
                      <td className="py-4 px-6 text-xs text-slate-700">
                        <p className="font-semibold font-mono">{coop.txt_whatsapp}</p>
                        {coop.txt_telefone && (
                          <p className="text-slate-400 font-mono mt-0.5">Reserva: {coop.txt_telefone}</p>
                        )}
                      </td>

                      {/* Professions Badges */}
                      <td className="py-4 px-6">
                        <div className="flex flex-wrap gap-1.5 max-w-[250px]">
                          {coop.fks_profissoes && coop.fks_profissoes.length > 0 ? (
                            coop.fks_profissoes.map((prof, i) => (
                              <span
                                key={i}
                                className="bg-indigo-50 text-indigo-700 border border-indigo-100 text-[10px] font-semibold px-2 py-0.5 rounded"
                              >
                                {prof}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-400 text-xs">-</span>
                          )}
                        </div>
                      </td>

                      {/* Term Status Badge */}
                      <td className="py-4 px-6">
                        {isApproved ? (
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-green-50 text-green-700 border border-green-200">
                            Aprovado
                          </span>
                        ) : isSigned ? (
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-50 text-blue-700 border border-blue-200">
                            Em Análise (Assinado)
                          </span>
                        ) : isWaiting ? (
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200">
                            Aguardando Assinatura
                          </span>
                        ) : (
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-500 border border-slate-200">
                            Sem Termo
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-6">
                        <div className="flex items-center justify-center gap-2">
                          {/* Visualizar detalhes */}
                          <button
                            onClick={() => openDetails(coop)}
                            className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 p-2 rounded-lg transition-all shadow-sm"
                            title="Visualizar Cadastro Completo"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Geração e Cópia do Termo */}
                          {!isApproved && (
                            <>
                              {/* Gerar / Regerar Termo */}
                              {(hasNoTerm || isWaiting || activeLink) && (
                                <button
                                  onClick={() => handleGerarTermo(coop._id)}
                                  disabled={generatingTermId === coop._id}
                                  className="bg-indigo-50 border border-indigo-200 hover:bg-indigo-100/50 text-indigo-700 px-3 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                                >
                                  {generatingTermId === coop._id ? (
                                    <>
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      Gerando...
                                    </>
                                  ) : activeLink || isWaiting ? (
                                    'Regerar Termo'
                                  ) : (
                                    'Gerar Termo'
                                  )}
                                </button>
                              )}

                              {/* Copiar Link */}
                              {(isWaiting || activeLink) && (
                                <button
                                  onClick={() =>
                                    handleCopyLink(
                                      coop._id,
                                      activeLink || `https://sandbox.zapsign.com.br/sign/mock` // fallback se já estivesse aguardando assinatura anteriormente
                                    )
                                  }
                                  className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm border ${copiedId === coop._id
                                      ? 'bg-green-600 hover:bg-green-700 text-white border-green-700'
                                      : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                                    }`}
                                  title={
                                    !activeLink && isWaiting
                                      ? 'Copia link simulado. Clique em Regerar Termo para obter um link real da ZapSign.'
                                      : 'Copiar link da ZapSign'
                                  }
                                >
                                  {copiedId === coop._id ? (
                                    <>
                                      <Check className="w-3.5 h-3.5" />
                                      Copiado!
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3.5 h-3.5" />
                                      Copiar Link
                                    </>
                                  )}
                                </button>
                              )}

                              {/* Aprovar */}
                              {isSigned && (
                                <button
                                  onClick={() => approveCooperado(coop._id)}
                                  disabled={approvingId === coop._id}
                                  className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-xs font-bold shadow flex items-center gap-1 transition-all disabled:opacity-50"
                                >
                                  {approvingId === coop._id ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <CheckCircle className="w-3.5 h-3.5" />
                                  )}
                                  Aprovar
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Controles de Paginação */}
        {totalPages > 1 && (
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-500 font-medium">
              Exibindo <span className="font-bold text-slate-800">{Math.min(startIndex + 1, filteredCooperados.length)}</span> a{' '}
              <span className="font-bold text-slate-800">{Math.min(endIndex, filteredCooperados.length)}</span> de{' '}
              <span className="font-bold text-slate-800">{filteredCooperados.length}</span> cooperados
            </div>

            <div className="flex items-center gap-1.5">
              {/* Botão Anterior */}
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 text-xs font-bold bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700 disabled:opacity-50 disabled:hover:bg-white transition-all"
              >
                Anterior
              </button>

              {/* Números das Páginas */}
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((page) => {
                  return page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1;
                })
                .map((page, index, array) => {
                  const showEllipsisBefore = index > 0 && page - array[index - 1] > 1;
                  return (
                    <React.Fragment key={page}>
                      {showEllipsisBefore && (
                        <span className="px-2 text-xs text-slate-450">...</span>
                      )}
                      <button
                        onClick={() => setCurrentPage(page)}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${currentPage === page
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                      >
                        {page}
                      </button>
                    </React.Fragment>
                  );
                })}

              {/* Botão Próximo */}
              <button
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 text-xs font-bold bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700 disabled:opacity-50 disabled:hover:bg-white transition-all"
              >
                Próximo
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {modalOpen && selectedCooperado && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
            {/* Modal Header */}
            <div className="flex justify-between items-start p-6 border-b border-slate-100">
              <div>
                <span className="text-indigo-600 text-xs font-bold uppercase tracking-wider">
                  Ficha de Inscrição Detalhada
                </span>
                <h2 className="text-2xl font-extrabold text-slate-950 mt-1">
                  {selectedCooperado.txt_nomeCompleto}
                </h2>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-500 hover:text-slate-800 p-2 hover:bg-slate-100 rounded-lg transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 text-slate-800">
              {/* Left Column: Personal info */}
              <div className="flex flex-col gap-6">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm mb-3 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                    <User className="w-4 h-4 text-indigo-600" /> Dados Pessoais
                  </h3>
                  <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-xs">
                    <div>
                      <span className="text-slate-400 font-medium">CPF</span>
                      <p className="text-slate-900 font-semibold font-mono mt-0.5">
                        {selectedCooperado.txt_CPF}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium">PIS</span>
                      <p className="text-slate-900 font-semibold font-mono mt-0.5">
                        {selectedCooperado.txt_pis || '-'}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium">E-mail</span>
                      <p className="text-slate-800 font-medium mt-0.5">
                        {selectedCooperado.txt_email}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium">WhatsApp</span>
                      <p className="text-slate-900 font-semibold font-mono mt-0.5">
                        {selectedCooperado.txt_whatsapp}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium">RG / Emissor</span>
                      <p className="text-slate-800 font-semibold mt-0.5">
                        {selectedCooperado.txt_rg || '-'}{' '}
                        {selectedCooperado.txt_orgaoEmissor && (
                          <>
                            ({selectedCooperado.txt_orgaoEmissor}/{selectedCooperado.txt_orgaoUF})
                          </>
                        )}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium">Data Nascimento</span>
                      <p className="text-slate-800 font-semibold mt-0.5">
                        {selectedCooperado.date_dataNascimento
                          ? new Date(selectedCooperado.date_dataNascimento).toLocaleDateString('pt-BR')
                          : '-'}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium">Estado Civil</span>
                      <p className="text-slate-800 font-semibold mt-0.5">
                        {selectedCooperado.txt_estadoCivil || '-'}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium">Escolaridade</span>
                      <p className="text-slate-800 font-semibold mt-0.5">
                        {selectedCooperado.txt_grauEscolaridade || '-'}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-400 font-medium">Nome da Mãe</span>
                      <p className="text-slate-800 font-semibold mt-0.5">
                        {selectedCooperado.txt_nomeMae || '-'}
                      </p>
                    </div>
                    {selectedCooperado.txt_nomePai && (
                      <div className="col-span-2">
                        <span className="text-slate-400 font-medium">Nome do Pai</span>
                        <p className="text-slate-800 font-semibold mt-0.5">
                          {selectedCooperado.txt_nomePai}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="font-bold text-slate-800 text-sm mb-3 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                    <MapPin className="w-4 h-4 text-indigo-600" /> Endereço Residencial
                  </h3>
                  <p className="text-xs text-slate-700 leading-relaxed font-semibold">
                    {selectedCooperado.txt_endereco || 'Não cadastrado'}
                  </p>
                </div>
              </div>

              {/* Right Column: Professions, Bank Accounts & Docs */}
              <div className="flex flex-col gap-6 text-slate-800">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm mb-3 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                    <Briefcase className="w-4 h-4 text-indigo-600" /> Profissões Cadastradas
                  </h3>
                  <div className="flex flex-col gap-2">
                    {selectedCooperado.fks_profissoes && selectedCooperado.fks_profissoes.length > 0 ? (
                      selectedCooperado.fks_profissoes.map((prof, i) => (
                        <div
                          key={i}
                          className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg flex items-center justify-between text-xs"
                        >
                          <span className="font-bold text-slate-800">{prof}</span>
                          <span className="text-slate-400 font-medium">Conselho Ativo</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-500">Nenhuma profissão registrada.</p>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="font-bold text-slate-800 text-sm mb-3 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                    <CreditCard className="w-4 h-4 text-indigo-600" /> Dados Bancários
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">
                    Contas vinculadas na base de dados do Bubble.
                  </p>
                  <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-xs mt-2 flex flex-col gap-2">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Contas Criadas:</span>
                      <span className="text-slate-800 font-bold font-mono">
                        {(selectedCooperado['fks_ContasBancarias'] || []).length} conta(s)
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-bold text-slate-800 text-sm mb-3 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                    <FileText className="w-4 h-4 text-indigo-600" /> Documentos & Assinaturas
                  </h3>
                  <div className="flex flex-col gap-2">
                    {selectedCooperado.txt_termo_status && (
                      <div className="bg-indigo-50/50 border border-indigo-100 p-2.5 rounded-lg flex items-center justify-between text-xs mb-1">
                        <span className="text-slate-700 font-semibold font-sans">Status do Termo:</span>
                        <span
                          className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full ${selectedCooperado.txt_termo_status === 'Assinado'
                              ? 'bg-green-100 text-green-700 border border-green-200'
                              : 'bg-amber-100 text-amber-700 border border-amber-200'
                            }`}
                        >
                          {selectedCooperado.txt_termo_status}
                        </span>
                      </div>
                    )}

                    {selectedCooperado.file_termo_assinado && (
                      <a
                        href={selectedCooperado.file_termo_assinado}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-green-50 border border-green-100 hover:bg-green-100/50 p-2.5 rounded-lg flex items-center justify-between text-xs transition-colors mb-1"
                      >
                        <span className="text-green-800 font-semibold truncate max-w-[250px] flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-green-600" /> Termo de Adesão Assinado
                        </span>
                        <span className="bg-green-600 hover:bg-green-700 text-white px-2 py-0.5 text-[9px] font-bold rounded transition-colors flex items-center gap-0.5">
                          Visualizar <ExternalLink className="w-2.5 h-2.5" />
                        </span>
                      </a>
                    )}

                    {/* Exibe botão de cópia dentro da modal caso tenha link ativo na sessão */}
                    {generatedLinks[selectedCooperado._id] && (
                      <button
                        onClick={() =>
                          handleCopyLink(
                            selectedCooperado._id,
                            generatedLinks[selectedCooperado._id]
                          )
                        }
                        className={`p-2.5 rounded-lg text-xs font-bold transition-colors flex items-center justify-between border w-full ${copiedId === selectedCooperado._id
                            ? 'bg-green-600 text-white border-green-700'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                      >
                        <span className="flex items-center gap-1.5">
                          <Copy className="w-3.5 h-3.5" /> Link de Assinatura ZapSign
                        </span>
                        <span>{copiedId === selectedCooperado._id ? 'Copiado!' : 'Copiar'}</span>
                      </button>
                    )}

                    {selectedCooperado.fks_pasta && selectedCooperado.fks_pasta.length > 0 ? (
                      selectedCooperado.fks_pasta.map((url, i) => {
                        if (url === selectedCooperado.file_termo_assinado) return null;
                        const isSignedPdf =
                          url.includes('zapsign') || url.includes('signed') || url.endsWith('.pdf');
                        return (
                          <a
                            key={i}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-slate-50 border border-slate-200 hover:bg-slate-100 p-2.5 rounded-lg flex items-center justify-between text-xs transition-colors"
                          >
                            <span className="text-indigo-600 truncate max-w-[250px] font-mono">
                              {url.split('/').pop()}
                            </span>
                            <span
                              className={`px-2 py-0.5 text-[9px] font-bold rounded ${isSignedPdf
                                  ? 'bg-green-100 text-green-800 border border-green-200'
                                  : 'bg-slate-200 text-slate-600 border border-slate-300'
                                }`}
                            >
                              {isSignedPdf ? 'Termo Assinado' : 'Documento Anexo'}
                            </span>
                          </a>
                        );
                      })
                    ) : (
                      !selectedCooperado.file_termo_assinado && (
                        <p className="text-xs text-slate-450 italic mt-1">
                          Aguardando anexos de documentos ou assinatura.
                        </p>
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer (Action approval buttons) */}
            <div className="bg-slate-50 p-6 border-t border-slate-200 flex justify-between items-center gap-4">
              <button
                onClick={() => setModalOpen(false)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-2 rounded-lg text-sm font-semibold transition-all border border-slate-255"
              >
                Fechar
              </button>

              {/* Only show Approve button if in Analysis stage (signed, no User login created yet) */}
              {selectedCooperado.txt_termo_status === 'Assinado' && !selectedCooperado.fk_usuario && (
                <button
                  onClick={() => approveCooperado(selectedCooperado._id)}
                  disabled={!!approvingId}
                  className="bg-green-600 hover:bg-green-550 text-white px-6 py-2 rounded-lg text-sm font-bold shadow-lg shadow-green-600/20 flex items-center gap-1.5 transition-all disabled:opacity-50"
                >
                  {approvingId ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Aprovando...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" /> Aprovar Cadastro
                    </>
                  )}
                </button>
              )}

              {selectedCooperado.fk_usuario && (
                <span className="bg-green-50 text-green-700 border border-green-200 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" /> Cadastro Aprovado
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
