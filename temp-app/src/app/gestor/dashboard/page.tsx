'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Link from 'next/link';
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
  DollarSign,
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

  // Filter cooperados
  const filteredCooperados = cooperados.filter(c => 
    c.txt_nomeCompleto?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.txt_CPF?.includes(searchQuery) ||
    c.txt_email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Classify into columns
  const getColumnData = (status: 'waiting' | 'analysis' | 'approved') => {
    return filteredCooperados.filter(c => {
      const isApproved = !!c.fk_usuario;
      const isSigned = c.txt_termo_status === 'Assinado';

      if (status === 'waiting') {
        return !isSigned && !isApproved;
      }
      if (status === 'analysis') {
        return isSigned && !isApproved;
      }
      if (status === 'approved') {
        return isApproved;
      }
      return false;
    });
  };

  const columns = {
    waiting: {
      title: 'Aguardando Assinatura',
      color: 'border-amber-200 text-amber-700 bg-amber-50',
      badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      items: getColumnData('waiting'),
    },
    analysis: {
      title: 'Em Análise',
      color: 'border-blue-200 text-blue-700 bg-blue-50',
      badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      items: getColumnData('analysis'),
    },
    approved: {
      title: 'Aprovados',
      color: 'border-green-200 text-green-700 bg-green-50',
      badge: 'bg-green-500/10 text-green-400 border-green-500/20',
      items: getColumnData('approved'),
    },
  };

  // Open detail modal
  const openDetails = (c: Cooperado) => {
    setSelectedCooperado(c);
    setModalOpen(true);
  };

  // Approve cooperado
  const approveCooperado = async (id: string) => {
    setApprovingId(id);
    try {
      const res = await axios.post('/api/gestor/cooperados/aprovar', { id });
      if (res.data.success) {
        // Update local list
        setCooperados(prev => prev.map(c => 
          c._id === id ? { ...c, fk_usuario: 'approved-user-id' } : c
        ));
        // Update currently selected modal item
        if (selectedCooperado && selectedCooperado._id === id) {
          setSelectedCooperado(prev => prev ? { ...prev, fk_usuario: 'approved-user-id' } : null);
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
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6 md:p-10 font-sans">
      
      {/* Header */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-8 h-8 text-indigo-600" />
            Painel do Gestor
          </h1>
          <p className="text-slate-550 text-sm mt-1">Monitore, analise e aprove a adesão dos novos sócios cooperados.</p>
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/gestor/financeiro"
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow flex items-center gap-2 transition-all"
          >
            <DollarSign className="w-4 h-4" />
            Painel Financeiro
          </Link>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input 
              type="text" 
              placeholder="Buscar por nome, CPF..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white border border-slate-200 focus:border-indigo-500 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none transition-all w-64 shadow-sm"
            />
          </div>
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
          { label: 'Total Inscrições', val: cooperados.length, icon: Users, color: 'text-indigo-600 bg-indigo-500/10 border-indigo-500/20' },
          { label: 'Aguardando Assinatura', val: getColumnData('waiting').length, icon: Clock, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
          { label: 'Em Análise', val: getColumnData('analysis').length, icon: FileText, color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
          { label: 'Aprovados', val: getColumnData('approved').length, icon: CheckCircle, color: 'text-green-400 bg-green-500/10 border-green-500/20' },
        ].map((item, idx) => {
          const Icon = item.icon;
          return (
            <div key={idx} className="bg-white border border-slate-200 p-5 rounded-xl flex items-center justify-between gap-4 shadow-sm">
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

      {/* Kanban Board */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {Object.entries(columns).map(([key, col]) => (
          <div key={key} className="flex flex-col bg-slate-100/50 border border-slate-200/80 rounded-xl p-4 shadow-sm min-h-[500px]">
            
            {/* Column Header */}
            <div className={`flex items-center justify-between border-b pb-3 mb-4 ${col.color}`}>
              <h2 className="font-bold text-sm uppercase tracking-wider">{col.title}</h2>
              <span className={`text-xs font-bold border px-2.5 py-0.5 rounded-full ${col.badge}`}>
                {col.items.length}
              </span>
            </div>

            {/* Column Items */}
            {loading ? (
              <div className="flex-1 flex items-center justify-center py-10">
                <Loader2 className="w-6 h-6 text-slate-700 animate-spin" />
              </div>
            ) : col.items.length === 0 ? (
              <div className="flex-1 border border-dashed border-slate-200 rounded-xl p-8 text-center text-slate-400 flex items-center justify-center text-xs">
                Nenhum cooperado nesta etapa
              </div>
            ) : (
              <div className="flex flex-col gap-4 overflow-y-auto max-h-[600px] pr-1">
                {col.items.map((coop) => (
                  <div 
                    key={coop._id}
                    className="bg-white border border-slate-200 hover:border-slate-350 hover:shadow rounded-xl p-4 shadow-sm transition-all cursor-pointer group"
                    onClick={() => openDetails(coop)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-bold text-sm text-slate-800 group-hover:text-indigo-600 transition-colors">
                          {coop.txt_nomeCompleto}
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">CPF: {coop.txt_CPF}</p>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-slate-100 p-1.5 rounded-lg">
                        <Eye className="w-3.5 h-3.5 text-slate-600" />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {coop.fks_profissoes && coop.fks_profissoes.map((prof, i) => (
                        <span key={i} className="bg-indigo-50 text-indigo-700 border border-indigo-100 text-[10px] font-medium px-2 py-0.5 rounded">
                          {prof}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-100 mt-4 pt-3 text-[10px] text-slate-500">
                      <span>{coop.txt_email}</span>
                      <span className="font-semibold">{coop.txt_whatsapp}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>
        ))}

      </div>

      {/* Detail Modal */}
      {modalOpen && selectedCooperado && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-250 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
            
            {/* Modal Header */}
            <div className="flex justify-between items-start p-6 border-b border-slate-100">
              <div>
                <span className="text-indigo-600 text-xs font-bold uppercase tracking-wider">Ficha de Inscrição Detalhada</span>
                <h2 className="text-2xl font-extrabold text-slate-900 mt-1">{selectedCooperado.txt_nomeCompleto}</h2>
              </div>
              <button 
                onClick={() => setModalOpen(false)}
                className="text-slate-500 hover:text-slate-800 p-2 hover:bg-slate-100 rounded-lg transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* Left Column: Personal info */}
              <div className="flex flex-col gap-6">
                <div>
                  <h3 className="font-bold text-white text-sm mb-3 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                    <User className="w-4 h-4 text-indigo-600" /> Dados Pessoais
                  </h3>
                  <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-xs">
                    <div>
                      <span className="text-slate-500">CPF</span>
                      <p className="text-white font-mono mt-0.5">{selectedCooperado.txt_CPF}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">PIS</span>
                      <p className="text-white font-mono mt-0.5">{selectedCooperado.txt_pis || '-'}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">E-mail</span>
                      <p className="text-slate-850 mt-0.5">{selectedCooperado.txt_email}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">WhatsApp</span>
                      <p className="text-white font-mono mt-0.5">{selectedCooperado.txt_whatsapp}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">RG / Emissor</span>
                      <p className="text-slate-850 mt-0.5">{selectedCooperado.txt_rg} ({selectedCooperado.txt_orgaoEmissor}/{selectedCooperado.txt_orgaoUF})</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Data Nascimento</span>
                      <p className="text-slate-850 mt-0.5">
                        {selectedCooperado.date_dataNascimento ? new Date(selectedCooperado.date_dataNascimento).toLocaleDateString('pt-BR') : '-'}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500">Estado Civil</span>
                      <p className="text-slate-850 mt-0.5">{selectedCooperado.txt_estadoCivil || '-'}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Escolaridade</span>
                      <p className="text-slate-850 mt-0.5">{selectedCooperado.txt_grauEscolaridade || '-'}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-500">Nome da Mãe</span>
                      <p className="text-slate-850 mt-0.5">{selectedCooperado.txt_nomeMae || '-'}</p>
                    </div>
                    {selectedCooperado.txt_nomePai && (
                      <div className="col-span-2">
                        <span className="text-slate-500">Nome do Pai</span>
                        <p className="text-slate-850 mt-0.5">{selectedCooperado.txt_nomePai}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="font-bold text-white text-sm mb-3 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                    <MapPin className="w-4 h-4 text-indigo-600" /> Endereço Residencial
                  </h3>
                  <p className="text-xs text-white leading-relaxed">{selectedCooperado.txt_endereco || 'Não cadastrado'}</p>
                </div>
              </div>

              {/* Right Column: Professions, Bank Accounts & Docs */}
              <div className="flex flex-col gap-6">
                <div>
                  <h3 className="font-bold text-white text-sm mb-3 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                    <Briefcase className="w-4 h-4 text-indigo-600" /> Profissões Cadastradas
                  </h3>
                  <div className="flex flex-col gap-2">
                    {selectedCooperado.fks_profissoes && selectedCooperado.fks_profissoes.length > 0 ? (
                      selectedCooperado.fks_profissoes.map((prof, i) => (
                        <div key={i} className="bg-slate-50 border border-slate-150 p-2.5 rounded-lg flex items-center justify-between text-xs">
                          <span className="font-bold text-white">{prof}</span>
                          <span className="text-slate-400">Conselho Ativo</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-500">Nenhuma profissão registrada.</p>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="font-bold text-white text-sm mb-3 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                    <CreditCard className="w-4 h-4 text-indigo-600" /> Dados Bancários
                  </h3>
                  {/* Since accounts are sub-records, we'll list how they are represented or show info */}
                  <p className="text-xs text-slate-400">Contas vinculadas na base de dados do Bubble.</p>
                  <div className="bg-slate-50 border border-slate-150 p-3 rounded-lg text-xs mt-2 flex flex-col gap-2">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Contas Criadas:</span>
                      <span className="text-white font-bold font-mono">{(selectedCooperado['fks_ContasBancarias'] || []).length} conta(s)</span>
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
                        <span className="text-slate-700 font-semibold">Status do Termo:</span>
                        <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full ${
                          selectedCooperado.txt_termo_status === 'Assinado'
                            ? 'bg-green-100 text-green-700 border border-green-200'
                            : 'bg-amber-100 text-amber-700 border border-amber-200'
                        }`}>
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
                        <span className="bg-green-600 hover:bg-green-700 text-white px-2 py-0.5 text-[9px] font-bold rounded transition-colors">
                          Visualizar
                        </span>
                      </a>
                    )}

                    {selectedCooperado.fks_pasta && selectedCooperado.fks_pasta.length > 0 ? (
                      selectedCooperado.fks_pasta.map((url, i) => {
                        if (url === selectedCooperado.file_termo_assinado) return null;
                        const isSignedPdf = url.includes('zapsign') || url.includes('signed') || url.endsWith('.pdf');
                        return (
                          <a 
                            key={i} 
                            href={url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="bg-slate-50 border border-slate-150 hover:bg-slate-100 p-2.5 rounded-lg flex items-center justify-between text-xs transition-colors"
                          >
                            <span className="text-indigo-650 truncate max-w-[250px] font-mono">{url.split('/').pop()}</span>
                            <span className={`px-2 py-0.5 text-[9px] font-bold rounded ${
                              isSignedPdf ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-slate-200 text-slate-600 border border-slate-300'
                            }`}>
                              {isSignedPdf ? 'Termo Assinado' : 'Documento Anexo'}
                            </span>
                          </a>
                        );
                      })
                    ) : (
                      !selectedCooperado.file_termo_assinado && (
                        <p className="text-xs text-slate-500">Aguardando anexos de documentos ou assinatura.</p>
                      )
                    )}
                  </div>
                </div>
              </div>

            </div>

            {/* Modal Footer (Action approval buttons) */}
            <div className="bg-slate-50 p-6 border-t border-slate-150 flex justify-between items-center gap-4">
              <button 
                onClick={() => setModalOpen(false)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-2 rounded-lg text-sm font-semibold transition-all border border-slate-200"
              >
                Fechar
              </button>

              {/* Only show Approve button if in Analysis stage (signed, no User login created yet) */}
              {selectedCooperado.txt_termo_status === 'Assinado' && !selectedCooperado.fk_usuario && (
                <button 
                  onClick={() => approveCooperado(selectedCooperado._id)}
                  disabled={!!approvingId}
                  className="bg-green-600 hover:bg-green-500 text-white px-6 py-2 rounded-lg text-sm font-bold shadow-lg shadow-green-600/20 flex items-center gap-1.5 transition-all disabled:opacity-50"
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
