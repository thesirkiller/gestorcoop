'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Link from 'next/link';
import { jsPDF } from 'jspdf';
import {
  Plus,
  Search,
  Eye,
  CheckCircle,
  X,
  Loader2,
  RefreshCw,
  Info,
  Briefcase,
  History,
  Copy,
  Check,
  ArrowLeft,
  DollarSign,
  FileText,
} from 'lucide-react';

interface Termo {
  _id: string;
  txt_titulo: string;
  txt_conteudo: string;
  txt_profissao: string;
  num_versao: number;
  bool_ativo: boolean;
  CreatedDate?: string;
}

export default function GestorTermos() {
  const [termos, setTermos] = useState<Termo[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProfession, setSelectedProfession] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Modals state
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [selectedTermo, setSelectedTermo] = useState<Termo | null>(null);

  // Editor Form state
  const [formTitulo, setFormTitulo] = useState('');
  const [formProfissaoSelect, setFormProfissaoSelect] = useState('Geral');
  const [formProfissaoCustom, setFormProfissaoCustom] = useState('');
  const [formConteudo, setFormConteudo] = useState('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Variables clipboard copy helpers
  const [copiedVar, setCopiedVar] = useState<string | null>(null);

  // Fetch terms safely with array validation
  const fetchTermos = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const response = await axios.get('/api/gestor/termos');
      const data = Array.isArray(response.data) ? response.data : [];
      setTermos(data);
    } catch (err) {
      console.error('Error fetching terms:', err);
      setErrorMsg('Falha ao carregar termos do servidor.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTermos();
  }, []);

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedProfession]);

  // List of unique professions for filtering
  const uniqueProfessions = Array.from(
    new Set(termos.map((t) => t?.txt_profissao || 'Geral'))
  ).filter(Boolean).sort();

  // Filtered terms
  const filteredTermos = termos.filter((t) => {
    if (!t) return false;
    const searchLower = searchQuery.toLowerCase();
    const titulo = t.txt_titulo || '';
    const conteudo = t.txt_conteudo || '';
    const profissao = t.txt_profissao || '';

    const matchesSearch =
      titulo.toLowerCase().includes(searchLower) ||
      conteudo.toLowerCase().includes(searchLower);

    if (!matchesSearch) return false;

    if (selectedProfession && profissao !== selectedProfession) {
      return false;
    }

    return true;
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredTermos.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedTermos = filteredTermos.slice(startIndex, endIndex);

  // Variable helpers list
  const helperVariables = [
    { code: '{nome}', desc: 'Nome completo do cooperado' },
    { code: '{rg}', desc: 'RG' },
    { code: '{cpf}', desc: 'CPF' },
    { code: '{dataNascimento}', desc: 'Data de nascimento' },
    { code: '{estadoCivil}', desc: 'Estado civil' },
    { code: '{endereco}', desc: 'Endereço completo' },
    { code: '{profissoes}', desc: 'Lista de profissões' },
    { code: '{nomeMae}', desc: 'Nome da Mãe' },
    { code: '{nomePai}', desc: 'Nome do Pai' },
    { code: '{pis}', desc: 'PIS/PASEP' },
    { code: '{email}', desc: 'E-mail de contato' },
    { code: '{telefone}', desc: 'Telefone / Whatsapp' },
    { code: '{matricula}', desc: 'Número da Matrícula' },
    { code: '{dataAtual}', desc: 'Data de assinatura' },
  ];

  const handleCopyVariable = (variable: string) => {
    navigator.clipboard.writeText(variable);
    setCopiedVar(variable);
    setTimeout(() => setCopiedVar(null), 2000);
  };

  // Open editor for brand new term
  const handleOpenNewTermEditor = () => {
    setFormTitulo('');
    setFormProfissaoSelect('Geral');
    setFormProfissaoCustom('');
    setFormConteudo('');
    setIsEditorOpen(true);
  };

  // Open editor to create a new version of an existing term
  const handleCreateNewVersion = (termo: Termo) => {
    setFormTitulo(termo.txt_titulo);

    // Check if it matches preset common professions
    const common = ['Geral', 'Médico', 'Enfermeiro', 'Fisioterapeuta', 'Nutricionista', 'Psicólogo', 'Dentista'];
    if (common.includes(termo.txt_profissao)) {
      setFormProfissaoSelect(termo.txt_profissao);
      setFormProfissaoCustom('');
    } else {
      setFormProfissaoSelect('Outro');
      setFormProfissaoCustom(termo.txt_profissao);
    }

    setFormConteudo(termo.txt_conteudo);
    setIsEditorOpen(true);
  };

  const handlePreviewTermoPDF = (termo: Termo) => {
    try {
      const doc = new jsPDF();
      
      // Replace placeholders with mock data
      let text = termo.txt_conteudo || '';
      
      const mockData = {
        nome: 'FULANO DE TAL DA SILVA',
        nomeCompleto: 'FULANO DE TAL DA SILVA',
        rg: '1234567 SSP/GO',
        cpf: '123.456.789-00',
        dataNascimento: '01/01/1990',
        estadoCivil: 'Solteiro(a)',
        endereco: 'Rua das Flores, nº 123, Bairro Centro, Goiânia - GO, CEP: 74000-000',
        profissoes: termo.txt_profissao !== 'Geral' ? termo.txt_profissao : 'Enfermeiro, Técnico de Enfermagem',
        nomeMae: 'MARIA DE TAL DA SILVA',
        nomePai: 'JOSÉ DE TAL DA SILVA',
        pis: '123.45678.90-1',
        email: 'cooperado.preview@email.com',
        telefone: '(62) 99999-9999',
        matricula: 'COOP-9999',
        dataAtual: new Date().toLocaleDateString('pt-BR')
      };

      Object.entries(mockData).forEach(([key, value]) => {
        const regex = new RegExp(`{${key}}`, 'gi');
        text = text.replace(regex, value);
      });

      const pages = text.split('[PAGE_BREAK]');
      pages.forEach((pageContent, pageIndex) => {
        if (pageIndex > 0) {
          doc.addPage();
        }
        
        const marginX = 15;
        const width = 180;
        const startY = 30;
        const bottomLimit = 275;
        const lineSpacing = 5;
        
        // Page styling - Border & Header
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(10);
        doc.text('MULTCARE - COOPERATIVA DE TRABALHO', 15, 15);
        
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(`Página ${pageIndex + 1} de ${pages.length} (PREVIEW)`, 195, 15, { align: 'right' });
        doc.line(15, 18, 195, 18);
        
        // Draw content lines
        doc.setFontSize(9);
        const splitLines = doc.splitTextToSize(pageContent.trim(), width);
        let y = startY;
        
        for (let i = 0; i < splitLines.length; i++) {
          if (y > bottomLimit) {
            doc.addPage();
            // Draw header on the overflow page too
            doc.setFont('Helvetica', 'bold');
            doc.setFontSize(10);
            doc.text('MULTCARE - COOPERATIVA DE TRABALHO', 15, 15);
            doc.setFont('Helvetica', 'normal');
            doc.setFontSize(8);
            doc.text(`Página ${pageIndex + 1} (cont.) de ${pages.length} (PREVIEW)`, 195, 15, { align: 'right' });
            doc.line(15, 18, 195, 18);
            
            doc.setFont('Helvetica', 'normal');
            doc.setFontSize(9);
            y = startY;
          }
          doc.text(splitLines[i], marginX, y);
          y += lineSpacing;
        }
      });

      const pdfBlob = doc.output('bloburl');
      window.open(pdfBlob, '_blank');
    } catch (error) {
      console.error('Error generating PDF preview:', error);
      alert('Erro ao gerar preview do PDF.');
    }
  };

  // Handle Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg('');

    const finalProfissao = formProfissaoSelect === 'Outro' ? formProfissaoCustom.trim() : formProfissaoSelect;

    if (!formTitulo.trim() || !formConteudo.trim() || !finalProfissao) {
      setErrorMsg('Preencha todos os campos obrigatórios.');
      setSubmitting(false);
      return;
    }

    try {
      await axios.post('/api/gestor/termos', {
        txt_titulo: formTitulo.trim(),
        txt_conteudo: formConteudo,
        txt_profissao: finalProfissao,
      });

      setIsEditorOpen(false);
      fetchTermos();
    } catch (err) {
      console.error('Error creating term:', err);
      const error = err as { response?: { data?: { error?: string } } };
      setErrorMsg(error.response?.data?.error || 'Erro ao salvar o termo.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6 md:p-10 font-sans">
      <div className="max-w-7xl mx-auto">
        {/* Navigation Link back */}
        <div className="mb-6 flex items-center gap-4">
          <Link href="/gestor/dashboard" className="text-slate-500 hover:text-indigo-600 transition-all flex items-center gap-2 text-sm font-semibold">
            <ArrowLeft className="w-4 h-4" />
            Voltar para Adesões
          </Link>
          <span className="text-slate-300">|</span>
          <Link href="/gestor/financeiro" className="text-slate-500 hover:text-indigo-600 transition-all flex items-center gap-2 text-sm font-semibold">
            <DollarSign className="w-4 h-4" />
            Painel Financeiro
          </Link>
        </div>

        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <FileText className="w-8 h-8 text-indigo-600" />
              Gerenciamento de Termos
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Cadastre, versione e customize os termos de adesão para cada especialidade ou profissionais da cooperativa.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={handleOpenNewTermEditor}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg text-sm font-bold shadow flex items-center gap-2 transition-all"
            >
              <Plus className="w-4 h-4" />
              Criar Novo Termo
            </button>
            <button
              onClick={fetchTermos}
              disabled={loading}
              className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 p-2.5 rounded-lg transition-all shadow-sm disabled:opacity-50"
              title="Recarregar dados"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Filters and Search Bar Section */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 mb-6">
          <div className="flex flex-col md:flex-row items-center gap-3">
            {/* Search Input */}
            <div className="relative w-full md:flex-1">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Pesquisar termo por título ou conteúdo..."
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>

            {/* Profession Dropdown Filter */}
            <div className="w-full md:w-64">
              <select
                value={selectedProfession}
                onChange={(e) => setSelectedProfession(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
              >
                <option value="">Todas as Profissões</option>
                {uniqueProfessions.map((prof) => (
                  <option key={prof} value={prof}>
                    {prof}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Terms Table Section */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          {errorMsg && (
            <div className="p-4 bg-rose-50 border-b border-rose-100 text-rose-700 text-sm font-medium">
              {errorMsg}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 text-xs font-black uppercase tracking-wider">
                  <th className="py-4 px-6">Título do Termo</th>
                  <th className="py-4 px-6">Profissão / Categoria</th>
                  <th className="py-4 px-6 text-center">Versão</th>
                  <th className="py-4 px-6 text-center">Status</th>
                  <th className="py-4 px-6 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="text-center py-16">
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                        <span className="text-slate-400 text-xs font-semibold">Carregando termos...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredTermos.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-16 text-slate-400 text-sm">
                      Nenhum termo cadastrado ou encontrado com os filtros atuais.
                    </td>
                  </tr>
                ) : (
                  paginatedTermos.map((termo) => (
                    <tr key={termo._id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-6">
                        <div className="font-bold text-slate-900">{termo.txt_titulo || 'Sem título'}</div>
                        <div className="text-slate-400 text-xs mt-0.5">
                          {termo.CreatedDate ? `Criado em ${new Date(termo.CreatedDate).toLocaleDateString('pt-BR')}` : ''}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold ${(termo.txt_profissao || 'Geral') === 'Geral'
                            ? 'bg-slate-100 text-slate-600'
                            : 'bg-indigo-50 text-indigo-700'
                          }`}>
                          <Briefcase className="w-3.5 h-3.5 opacity-70" />
                          {termo.txt_profissao || 'Geral'}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-xs">
                          v{termo.num_versao || 1}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        {termo.bool_ativo ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full text-xs font-bold border border-emerald-100 shadow-sm">
                            <CheckCircle className="w-3.5 h-3.5" />
                            Ativo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-400 px-2.5 py-1 rounded-full text-xs font-bold">
                            Inativo
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setSelectedTermo(termo);
                              setIsViewerOpen(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
                            title="Visualizar Termo"
                          >
                            <Eye className="w-4.5 h-4.5" />
                          </button>

                          <button
                            onClick={() => handlePreviewTermoPDF(termo)}
                            className="p-1.5 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-all"
                            title="Preview PDF (dados fictícios)"
                          >
                            <FileText className="w-4.5 h-4.5" />
                          </button>

                          <button
                            onClick={() => handleCreateNewVersion(termo)}
                            className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-lg transition-all"
                            title="Criar nova versão a partir deste termo"
                          >
                            <History className="w-3.5 h-3.5" />
                            Nova Versão
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-slate-500 font-medium">
                Exibindo <span className="font-bold text-slate-800">{Math.min(startIndex + 1, filteredTermos.length)}</span> a{' '}
                <span className="font-bold text-slate-800">{Math.min(endIndex, filteredTermos.length)}</span> de{' '}
                <span className="font-bold text-slate-800">{filteredTermos.length}</span> termos
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 text-xs font-bold bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700 disabled:opacity-50 disabled:hover:bg-white transition-all"
                >
                  Anterior
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((page) => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1)
                  .map((page, index, array) => {
                    const showEllipsisBefore = index > 0 && page - array[index - 1] > 1;
                    return (
                      <React.Fragment key={page}>
                        {showEllipsisBefore && (
                          <span className="px-2 text-xs text-slate-400">...</span>
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
      </div>

      {/* Editor Modal */}
      {isEditorOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-950">Novo Termo / Nova Versão</h3>
                <p className="text-xs text-slate-400 mt-0.5">Cadastre ou atualize a redação do termo para cooperados.</p>
              </div>
              <button
                onClick={() => setIsEditorOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 flex flex-col md:flex-row gap-6">
              {/* Form Side */}
              <div className="flex-1 flex flex-col gap-4">
                {/* Title */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                    Título do Termo *
                  </label>
                  <input
                    type="text"
                    required
                    value={formTitulo}
                    onChange={(e) => setFormTitulo(e.target.value)}
                    placeholder="Ex: Termo de Adesão Geral v2"
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-800"
                  />
                </div>

                {/* Profession Selection */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                      Profissão do Termo *
                    </label>
                    <select
                      value={formProfissaoSelect}
                      onChange={(e) => setFormProfissaoSelect(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
                    >
                      <option value="Geral">Geral (Termo Padrão)</option>
                      <option value="Médico">Médico</option>
                      <option value="Enfermeiro">Enfermeiro</option>
                      <option value="Fisioterapeuta">Fisioterapeuta</option>
                      <option value="Nutricionista">Nutricionista</option>
                      <option value="Psicólogo">Psicólogo</option>
                      <option value="Dentista">Dentista</option>
                      <option value="Outro">Outro (Digitar)...</option>
                    </select>
                  </div>

                  {formProfissaoSelect === 'Outro' && (
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                        Nome da Profissão *
                      </label>
                      <input
                        type="text"
                        required
                        value={formProfissaoCustom}
                        onChange={(e) => setFormProfissaoCustom(e.target.value)}
                        placeholder="Ex: Farmacêutico"
                        className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-800"
                      />
                    </div>
                  )}
                </div>

                {/* Term Content ContentTextArea */}
                <div className="flex-1 flex flex-col min-h-[350px]">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                    Conteúdo do Termo *
                  </label>
                  <textarea
                    required
                    value={formConteudo}
                    onChange={(e) => setFormConteudo(e.target.value)}
                    placeholder="Cole ou escreva o texto do termo..."
                    className="flex-1 w-full p-4 border border-slate-200 rounded-lg text-sm font-mono placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-800 resize-none min-h-[300px]"
                  />
                </div>
              </div>

              {/* Side Panel helper (Variables and instructions) */}
              <div className="w-full md:w-80 bg-slate-50 border border-slate-100 rounded-xl p-5 flex flex-col gap-4">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-indigo-600" />
                    Variáveis Disponíveis
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Insira as variáveis abaixo no texto. Elas serão substituídas automaticamente com os dados reais do cooperado na geração do PDF.
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  {helperVariables.map((v) => (
                    <div
                      key={v.code}
                      onClick={() => handleCopyVariable(v.code)}
                      className="group flex items-center justify-between p-2 bg-white border border-slate-200 hover:border-indigo-300 rounded-lg cursor-pointer transition-all hover:shadow-sm"
                    >
                      <div>
                        <code className="text-xs font-black text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded font-mono">
                          {v.code}
                        </code>
                        <div className="text-[10px] text-slate-500 mt-1 font-medium">{v.desc}</div>
                      </div>
                      <button
                        type="button"
                        className="text-slate-400 group-hover:text-indigo-600 transition-colors"
                      >
                        {copiedVar === v.code ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>

                <div className="text-[11px] text-slate-500 leading-relaxed mt-auto pt-4 border-t border-slate-200/60">
                  <span className="font-bold text-slate-600 block mb-1">Como funciona o versionamento?</span>
                  Ao salvar um termo para uma profissão que já possui um termo cadastrado, o sistema irá criar uma nova versão incrementada automaticamente (ex: v2) e marcar as anteriores como inativas.
                </div>
              </div>
            </form>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-100 text-xs font-bold text-slate-500 transition-all"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2.5 rounded-lg shadow-sm disabled:opacity-50 disabled:hover:bg-indigo-600 transition-all"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Salvar Termo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Viewer Modal */}
      {isViewerOpen && selectedTermo && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-4xl max-h-[85vh] overflow-y-auto shadow-2xl flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-slate-950">{selectedTermo.txt_titulo}</h3>
                  <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-xs">
                    v{selectedTermo.num_versao}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Profissão correspondente: <span className="font-bold text-slate-700">{selectedTermo.txt_profissao}</span>
                </p>
              </div>
              <button
                onClick={() => setIsViewerOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
              <div className="bg-white border border-slate-200/60 rounded-xl p-8 shadow-sm whitespace-pre-wrap font-mono text-sm leading-relaxed text-slate-800 min-h-[350px]">
                {selectedTermo.txt_conteudo}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-white border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={() => handlePreviewTermoPDF(selectedTermo)}
                className="flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-4 py-2 rounded-lg text-xs font-bold transition-all hover:shadow-sm"
              >
                <FileText className="w-4 h-4 text-indigo-600" />
                Visualizar PDF (Preview)
              </button>
              <button
                onClick={() => setIsViewerOpen(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shadow-sm transition-all"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
