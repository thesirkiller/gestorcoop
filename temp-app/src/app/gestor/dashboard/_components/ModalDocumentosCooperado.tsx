'use client';

import React, { useState, useRef } from 'react';
import axios from 'axios';
import {
  X,
  FileText,
  Image as ImageIcon,
  UploadCloud,
  Trash2,
  ExternalLink,
  Eye,
  RefreshCw,
  Loader2,
  Plus,
  ZoomIn,
  ChevronLeft,
  ChevronRight,
  Download,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

export interface DocumentItem {
  url: string;
  filename: string;
  extension: string;
  isImage: boolean;
  isPdf: boolean;
  isSignedTerm: boolean;
  typeLabel: string;
}

interface ModalDocumentosCooperadoProps {
  isOpen: boolean;
  onClose: () => void;
  cooperadoId: string;
  cooperadoNome: string;
  cooperadoCpf: string;
  initialDocuments?: string[];
  termoAssinadoUrl?: string;
  onDocumentsChange?: (updatedUrls: string[]) => void;
}

function parseDoc(url: string, termoAssinadoUrl?: string): DocumentItem {
  const cleanUrl = url.split('?')[0];
  const filename = decodeURIComponent(cleanUrl.split('/').pop() || 'documento');
  const ext = (filename.split('.').pop() || '').toLowerCase();
  const isImage = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg'].includes(ext);
  const isPdf = ext === 'pdf' || cleanUrl.endsWith('.pdf') || url.includes('zapsign');
  const isSignedTerm = url === termoAssinadoUrl;

  let typeLabel = 'Documento';
  if (isSignedTerm) typeLabel = 'Termo Assinado';
  else if (isImage) typeLabel = 'Foto / Imagem';
  else if (isPdf) typeLabel = 'PDF';

  return {
    url,
    filename,
    extension: ext.toUpperCase() || 'ARQUIVO',
    isImage,
    isPdf,
    isSignedTerm,
    typeLabel,
  };
}

export default function ModalDocumentosCooperado({
  isOpen,
  onClose,
  cooperadoId,
  cooperadoNome,
  cooperadoCpf,
  initialDocuments = [],
  termoAssinadoUrl,
  onDocumentsChange,
}: ModalDocumentosCooperadoProps) {
  // Combine all initial documents avoiding duplicates
  const rawList = Array.from(
    new Set([
      ...(termoAssinadoUrl ? [termoAssinadoUrl] : []),
      ...initialDocuments,
    ])
  ).filter(Boolean);

  const [documentos, setDocumentos] = useState<DocumentItem[]>(
    rawList.map((url) => parseDoc(url, termoAssinadoUrl))
  );

  const [filterType, setFilterType] = useState<'all' | 'images' | 'docs'>('all');
  const [uploading, setUploading] = useState(false);
  const [replacingUrl, setReplacingUrl] = useState<string | null>(null);
  const [deletingUrl, setDeletingUrl] = useState<string | null>(null);
  const [confirmDeleteUrl, setConfirmDeleteUrl] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; isError: boolean } | null>(null);

  // Lightbox Preview State
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // File Inputs
  const addFileInputRef = useRef<HTMLInputElement>(null);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const showFeedback = (text: string, isError = false) => {
    setFeedbackMsg({ text, isError });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  // Sync back to parent
  const notifyChange = (updatedList: DocumentItem[]) => {
    const urls = updatedList.map((d) => d.url);
    setDocumentos(updatedList);
    if (onDocumentsChange) {
      onDocumentsChange(urls);
    }
  };

  // Handle Add Document
  const handleAddFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setFeedbackMsg(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await axios.post(`/api/gestor/cooperados/${cooperadoId}/documentos`, formData);
      if (res.data?.success && res.data?.fileUrl) {
        const newDoc = parseDoc(res.data.fileUrl, termoAssinadoUrl);
        const updated = [...documentos, newDoc];
        notifyChange(updated);
        showFeedback(`Documento "${file.name}" adicionado com sucesso!`);
      } else {
        throw new Error(res.data?.error || 'Erro ao processar upload.');
      }
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      showFeedback(error.response?.data?.error || error.message || 'Falha ao anexar documento.', true);
    } finally {
      setUploading(false);
      if (addFileInputRef.current) addFileInputRef.current.value = '';
    }
  };

  // Handle Replace Document
  const handleReplaceFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !replacingUrl) return;

    setUploading(true);
    setFeedbackMsg(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('oldUrl', replacingUrl);

      const res = await axios.patch(`/api/gestor/cooperados/${cooperadoId}/documentos`, formData);
      if (res.data?.success && res.data?.newUrl) {
        const newDoc = parseDoc(res.data.newUrl, termoAssinadoUrl);
        const updated = documentos.map((d) => (d.url === replacingUrl ? newDoc : d));
        notifyChange(updated);
        showFeedback(`Documento substituído por "${file.name}"!`);
      } else {
        throw new Error(res.data?.error || 'Erro ao substituir documento.');
      }
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      showFeedback(error.response?.data?.error || error.message || 'Falha ao substituir anexo.', true);
    } finally {
      setUploading(false);
      setReplacingUrl(null);
      if (replaceFileInputRef.current) replaceFileInputRef.current.value = '';
    }
  };

  // Handle Remove Document
  const handleDeleteDocument = async (url: string) => {
    setDeletingUrl(url);
    setFeedbackMsg(null);

    try {
      const res = await axios.delete(`/api/gestor/cooperados/${cooperadoId}/documentos`, {
        data: { url },
      });

      if (res.data?.success) {
        const updated = documentos.filter((d) => d.url !== url);
        notifyChange(updated);
        showFeedback('Documento removido com sucesso.');
      } else {
        throw new Error(res.data?.error || 'Erro ao excluir documento.');
      }
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      showFeedback(error.response?.data?.error || error.message || 'Falha ao remover documento.', true);
    } finally {
      setDeletingUrl(null);
      setConfirmDeleteUrl(null);
    }
  };

  // Filtered documents
  const filteredDocumentos = documentos.filter((doc) => {
    if (filterType === 'images') return doc.isImage;
    if (filterType === 'docs') return !doc.isImage;
    return true;
  });

  const totalImages = documentos.filter((d) => d.isImage).length;
  const totalDocs = documentos.filter((d) => !d.isImage).length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modalDocsTitle"
      className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 md:p-6 overflow-y-auto animate-in fade-in duration-150"
    >
      {/* Hidden file inputs */}
      <input
        type="file"
        ref={addFileInputRef}
        onChange={handleAddFile}
        className="hidden"
        accept="image/*,application/pdf,.doc,.docx"
      />
      <input
        type="file"
        ref={replaceFileInputRef}
        onChange={handleReplaceFile}
        className="hidden"
        accept="image/*,application/pdf,.doc,.docx"
      />

      {/* Main Modal Card */}
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col max-h-[92vh] transition-all">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 id="modalDocsTitle" className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                Documentos & Anexos
              </h2>
              <span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-2.5 py-0.5 rounded-full border border-indigo-100">
                {documentos.length} {documentos.length === 1 ? 'item' : 'itens'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              <span className="font-semibold text-slate-700">{cooperadoNome}</span> • CPF: {cooperadoCpf}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => addFileInputRef.current?.click()}
              disabled={uploading}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/25"
            >
              {uploading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              Adicionar Documento
            </button>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar & Filter Tabs */}
        <div className="px-6 py-2.5 border-b border-slate-100 bg-white flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200/60">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1 rounded-md font-semibold transition-all ${
                filterType === 'all'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Todos ({documentos.length})
            </button>
            <button
              onClick={() => setFilterType('images')}
              className={`px-3 py-1 rounded-md font-semibold transition-all flex items-center gap-1 ${
                filterType === 'images'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <ImageIcon className="w-3 h-3 text-indigo-500" />
              Fotos ({totalImages})
            </button>
            <button
              onClick={() => setFilterType('docs')}
              className={`px-3 py-1 rounded-md font-semibold transition-all flex items-center gap-1 ${
                filterType === 'docs'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <FileText className="w-3 h-3 text-amber-500" />
              PDFs & Arquivos ({totalDocs})
            </button>
          </div>

          <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
            <span>Visualização 2x2</span>
          </div>
        </div>

        {/* Feedback Alert Message */}
        {feedbackMsg && (
          <div
            className={`mx-6 mt-3 px-3.5 py-2 rounded-lg text-xs font-medium flex items-center gap-2 border ${
              feedbackMsg.isError
                ? 'bg-red-50 text-red-700 border-red-200'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
            }`}
          >
            {feedbackMsg.isError ? (
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            )}
            <span>{feedbackMsg.text}</span>
          </div>
        )}

        {/* Content / Documents Grid (2x2) */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-50/40">
          {filteredDocumentos.length === 0 ? (
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-12 text-center flex flex-col items-center justify-center gap-3 bg-white">
              <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <UploadCloud className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">Nenhum documento encontrado</p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  {filterType === 'all'
                    ? 'Este cooperado ainda não possui fotos ou documentos anexados.'
                    : 'Nenhum documento corresponde ao filtro selecionado.'}
                </p>
              </div>
              <button
                onClick={() => addFileInputRef.current?.click()}
                disabled={uploading}
                className="mt-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                Anexar Primeiro Documento
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredDocumentos.map((doc, index) => {
                const isSignedTerm = doc.isSignedTerm;
                const isConfirmingDelete = confirmDeleteUrl === doc.url;
                const isBeingDeleted = deletingUrl === doc.url;

                return (
                  <div
                    key={doc.url + index}
                    className={`bg-white rounded-xl border transition-all duration-150 overflow-hidden flex flex-col shadow-sm hover:shadow-md ${
                      isSignedTerm
                        ? 'border-emerald-200 ring-1 ring-emerald-500/10'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {/* Thumbnail / Visual Preview Area */}
                    <div className="relative aspect-[16/10] bg-slate-100 border-b border-slate-100 overflow-hidden group">
                      {doc.isImage ? (
                        <div
                          onClick={() => setLightboxIndex(index)}
                          className="w-full h-full cursor-pointer relative"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={doc.url}
                            alt={doc.filename}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-slate-950/0 group-hover:bg-slate-950/30 transition-colors flex items-center justify-center">
                            <span className="opacity-0 group-hover:opacity-100 bg-white/90 text-slate-800 text-[11px] font-bold px-2.5 py-1 rounded-full shadow backdrop-blur-sm flex items-center gap-1 transition-opacity">
                              <ZoomIn className="w-3 h-3" /> Ampliar
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-gradient-to-br from-slate-50 to-slate-100 text-slate-600">
                          <div
                            className={`w-12 h-12 rounded-xl flex items-center justify-center mb-2 shadow-sm ${
                              isSignedTerm
                                ? 'bg-emerald-100 text-emerald-700'
                                : doc.isPdf
                                ? 'bg-red-50 text-red-600'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            <FileText className="w-6 h-6" />
                          </div>
                          <span className="text-[11px] font-bold text-slate-700 truncate max-w-[200px] text-center">
                            {doc.filename}
                          </span>
                          <span className="text-[10px] text-slate-400 uppercase font-mono mt-0.5">
                            {doc.extension}
                          </span>
                        </div>
                      )}

                      {/* Tag / Badge Top Left */}
                      <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                        {isSignedTerm ? (
                          <span className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-sm flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Termo Assinado
                          </span>
                        ) : (
                          <span className="bg-slate-900/75 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-sm">
                            {doc.extension}
                          </span>
                        )}
                      </div>

                      {/* External Link Top Right */}
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute top-2.5 right-2.5 bg-white/90 hover:bg-white text-slate-700 p-1.5 rounded-lg shadow-sm backdrop-blur-sm transition-all hover:scale-105"
                        title="Abrir em nova aba"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>

                    {/* Card Body & Info */}
                    <div className="p-3.5 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <h4
                            className="text-xs font-bold text-slate-800 truncate flex-1"
                            title={doc.filename}
                          >
                            {doc.filename}
                          </h4>
                          <span className="text-[10px] font-semibold text-slate-400 shrink-0">
                            {doc.typeLabel}
                          </span>
                        </div>
                      </div>

                      {/* Card Action Buttons (View, Replace, Delete) */}
                      <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5">
                          {doc.isImage ? (
                            <button
                              onClick={() => setLightboxIndex(index)}
                              className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                            >
                              <Eye className="w-3 h-3" /> Ver
                            </button>
                          ) : (
                            <a
                              href={doc.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                            >
                              <Eye className="w-3 h-3" /> Ver PDF
                            </a>
                          )}

                          {/* Replace / Substitute Action */}
                          <button
                            onClick={() => {
                              setReplacingUrl(doc.url);
                              replaceFileInputRef.current?.click();
                            }}
                            disabled={uploading}
                            className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                            title="Substituir por outro arquivo"
                          >
                            <RefreshCw className="w-3 h-3" /> Trocar
                          </button>
                        </div>

                        {/* Delete Action with Confirmation */}
                        <div>
                          {isConfirmingDelete ? (
                            <div className="flex items-center gap-1 animate-in fade-in duration-150">
                              <button
                                onClick={() => handleDeleteDocument(doc.url)}
                                disabled={isBeingDeleted}
                                className="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                              >
                                {isBeingDeleted ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  'Confirmar'
                                )}
                              </button>
                              <button
                                onClick={() => setConfirmDeleteUrl(null)}
                                className="text-slate-400 hover:text-slate-600 p-1 text-xs"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDeleteUrl(doc.url)}
                              className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                              title="Remover documento"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            {filteredDocumentos.length} documento(s) exibido(s)
          </span>

          <button
            onClick={onClose}
            className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 px-4 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm"
          >
            Fechar
          </button>
        </div>
      </div>

      {/* Lightbox Modal for Image Fullscreen Viewing */}
      {lightboxIndex !== null && filteredDocumentos[lightboxIndex] && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <button
            onClick={() => setLightboxIndex(null)}
            className="absolute top-4 right-4 text-white/80 hover:text-white p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all z-10"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Navigation Prev/Next */}
          {filteredDocumentos.length > 1 && (
            <>
              <button
                onClick={() =>
                  setLightboxIndex((prev) =>
                    prev !== null
                      ? (prev - 1 + filteredDocumentos.length) % filteredDocumentos.length
                      : 0
                  )
                }
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-3 rounded-full bg-white/10 hover:bg-white/20 transition-all z-10"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={() =>
                  setLightboxIndex((prev) =>
                    prev !== null ? (prev + 1) % filteredDocumentos.length : 0
                  )
                }
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-3 rounded-full bg-white/10 hover:bg-white/20 transition-all z-10"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}

          <div className="max-w-4xl max-h-[85vh] flex flex-col items-center justify-center">
            {filteredDocumentos[lightboxIndex].isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={filteredDocumentos[lightboxIndex].url}
                alt={filteredDocumentos[lightboxIndex].filename}
                className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-2xl"
              />
            ) : (
              <div className="bg-white rounded-xl p-8 text-center flex flex-col items-center">
                <FileText className="w-16 h-16 text-indigo-600 mb-3" />
                <p className="font-bold text-slate-900">{filteredDocumentos[lightboxIndex].filename}</p>
                <a
                  href={filteredDocumentos[lightboxIndex].url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5"
                >
                  <ExternalLink className="w-4 h-4" /> Abrir Documento
                </a>
              </div>
            )}

            <div className="mt-4 flex items-center gap-3 text-white text-xs">
              <span className="font-medium">{filteredDocumentos[lightboxIndex].filename}</span>
              <span>•</span>
              <span className="text-white/70">
                {lightboxIndex + 1} de {filteredDocumentos.length}
              </span>
              <span>•</span>
              <a
                href={filteredDocumentos[lightboxIndex].url}
                target="_blank"
                rel="noopener noreferrer"
                download
                className="text-indigo-300 hover:text-indigo-200 underline flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" /> Baixar original
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
