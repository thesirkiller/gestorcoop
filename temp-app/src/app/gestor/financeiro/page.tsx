'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { jsPDF } from 'jspdf';
import { fetchFullDataset } from '@/lib/client-fetch';
import {
  Users,
  Calendar,
  DollarSign,
  CheckCircle,
  Clock,
  Check,
  Search,
  FileText,
  CreditCard,
  X,
  Loader2,
  Edit2,
  Save,
  Printer,
  Download,
  ChevronDown,
} from 'lucide-react';

interface Cooperado {
  _id: string;
  txt_nomeCompleto: string;
  txt_CPF: string;
  txt_email: string;
  txt_whatsapp: string;
  fk_usuario?: string;
  txt_termo_status?: string;
}

interface BankAccount {
  _id: string;
  txt_banco: string;
  txt_agencia: string;
  txt_nConta: string;
  text_corrente_or_poupanca: string;
}

interface Escala {
  _id: string;
  num_id?: number;
  txt_anotacoes?: string;
}

interface Servico {
  _id: string;
  num_id: number;
  txt_nome: string;
  fk_escala?: string;
  date_fixa_entrada?: string;
  date_fixa_saida?: string;
  num_valor_cooperado?: number;
  bool_confirmacao_finalizado?: boolean;
  bool_pago?: boolean;
}

export default function FinanceiroPage() {
  // Helpers to get first and last days of the current month
  const getFirstDayOfMonth = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-01`;
  };

  const getLastDayOfMonth = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const lastDay = new Date(year, month, 0).getDate();
    const monthStr = String(month).padStart(2, '0');
    const dayStr = String(lastDay).padStart(2, '0');
    return `${year}-${monthStr}-${dayStr}`;
  };

  // State
  const [cooperados, setCooperados] = useState<Cooperado[]>([]);
  const [selectedCooperadoId, setSelectedCooperadoId] = useState<string>('');
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [escalas, setEscalas] = useState<Escala[]>([]);

  // Filters State
  const [selectedEscalas, setSelectedEscalas] = useState<string[]>([]);
  const [showEscalaDropdown, setShowEscalaDropdown] = useState(false);
  const [startDate, setStartDate] = useState<string>(getFirstDayOfMonth());
  const [endDate, setEndDate] = useState<string>(getLastDayOfMonth());

  // Selection & Modal State
  const [selectedServicos, setSelectedServicos] = useState<string[]>([]);
  const [showRpaModal, setShowRpaModal] = useState(false);
  const [rpaRetencoes, setRpaRetencoes] = useState<string>('0');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Inline editing state
  const [editingServicoId, setEditingServicoId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');

  // Loading and action state
  const [loadingData, setLoadingData] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [cooperadoSearch, setCooperadoSearch] = useState('');

  // 1. Fetch Approved/Active Cooperados and Escalas on Load
  useEffect(() => {
    const init = async () => {
      try {
        // Fetch cooperados in background
        fetchFullDataset<Cooperado>('/api/gestor/cooperados', setCooperados)
          .catch(err => console.error('Error loading cooperados:', err));

        // Fetch scales in background
        fetchFullDataset<Escala>('/api/gestor/financeiro/escalas', setEscalas)
          .catch(err => console.error('Error loading escalas:', err));
      } catch (err) {
        console.error('Error initializing data:', err);
      }
    };
    init();
  }, []);

  // 2. Fetch Services and Bank Account when Cooperado changes or date range changes
  useEffect(() => {
    if (!selectedCooperadoId) {
      setServicos([]);
      setBankAccounts([]);
      setSelectedServicos([]);
      setShowRpaModal(false);
      setRpaRetencoes('0');
      return;
    }

    // Only run if dates are complete (10 characters long, format: YYYY-MM-DD)
    if (startDate.length < 10 || endDate.length < 10) {
      return;
    }

    const fetchCooperadoData = async () => {
      setLoadingData(true);
      setSelectedServicos([]);
      setShowRpaModal(false);
      setRpaRetencoes('0');
      try {
        // Fetch services with date boundaries
        let url = `/api/gestor/financeiro/servicos?cooperadoId=${selectedCooperadoId}`;
        if (startDate) url += `&startDate=${startDate}`;
        if (endDate) url += `&endDate=${endDate}`;

        const servRes = await axios.get(url);
        if (servRes.data.success) {
          setServicos(servRes.data.data);
        }

        // Fetch bank accounts
        const bankRes = await axios.get(`/api/gestor/financeiro/contas?cooperadoId=${selectedCooperadoId}`);
        if (bankRes.data.success) {
          setBankAccounts(bankRes.data.data);
        }
      } catch (err) {
        console.error('Error fetching cooperado data:', err);
      } finally {
        setLoadingData(false);
      }
    };

    fetchCooperadoData();
  }, [selectedCooperadoId, startDate, endDate]);

  // Handle Cooperado Selection
  const activeCooperado = cooperados.find(c => c._id === selectedCooperadoId);

  // Filter Services Client Side
  const filteredServicos = servicos.filter(serv => {
    // Escala Filter
    if (selectedEscalas.length > 0) {
      if (!serv.fk_escala || !selectedEscalas.includes(serv.fk_escala)) {
        return false;
      }
    }

    // Date Filter
    if (serv.date_fixa_entrada) {
      const servDate = new Date(serv.date_fixa_entrada).getTime();
      if (startDate) {
        const start = new Date(startDate + 'T00:00:00').getTime();
        if (servDate < start) return false;
      }
      if (endDate) {
        const end = new Date(endDate + 'T23:59:59').getTime();
        if (servDate > end) return false;
      }
    }

    return true;
  });

  // Calculate Metrics
  const metricTotalServicos = filteredServicos.length;

  const metricProntos = filteredServicos
    .filter(s => s.bool_confirmacao_finalizado && !s.bool_pago)
    .reduce((sum, s) => sum + (s.num_valor_cooperado || 0), 0);

  const metricAguardando = filteredServicos
    .filter(s => !s.bool_confirmacao_finalizado && !s.bool_pago)
    .reduce((sum, s) => sum + (s.num_valor_cooperado || 0), 0);

  const metricPagos = filteredServicos
    .filter(s => s.bool_pago)
    .reduce((sum, s) => sum + (s.num_valor_cooperado || 0), 0);

  // Sum of checked services that are pending payment
  const selectedUnpaidServicos = filteredServicos.filter(
    s => selectedServicos.includes(s._id) && !s.bool_pago
  );
  const selectedSum = selectedUnpaidServicos.reduce(
    (sum, s) => sum + (s.num_valor_cooperado || 0),
    0
  );

  // Handle row selection
  const handleSelectRow = (id: string) => {
    setSelectedServicos(prev =>
      prev.includes(id) ? prev.filter(rowId => rowId !== id) : [...prev, id]
    );
  };

  // Handle Select All Unpaid filtered rows
  const unpaidFilteredIds = filteredServicos.filter(s => !s.bool_pago).map(s => s._id);
  const allUnpaidSelected = unpaidFilteredIds.length > 0 && unpaidFilteredIds.every(id => selectedServicos.includes(id));

  const handleSelectAll = () => {
    if (allUnpaidSelected) {
      // Deselect all unpaid
      setSelectedServicos(prev => prev.filter(id => !unpaidFilteredIds.includes(id)));
    } else {
      // Select all unpaid
      setSelectedServicos(prev => {
        const union = new Set([...prev, ...unpaidFilteredIds]);
        return Array.from(union);
      });
    }
  };

  // Toggle paid status for selected
  const handleMarkAsPaid = async () => {
    if (selectedUnpaidServicos.length === 0) return;
    if (!confirm(`Deseja marcar os ${selectedUnpaidServicos.length} serviços selecionados como pagos?`)) return;

    const targetIds = selectedUnpaidServicos.map(s => s._id);
    setIsSaving(true);
    try {
      // Process updates sequentially or concurrently
      await Promise.all(
        targetIds.map(servicoId =>
          axios.patch('/api/gestor/financeiro/servicos', {
            servicoId,
            bool_pago: true
          })
        )
      );

      // Refresh services local state
      setServicos(prev => prev.map(s =>
        targetIds.includes(s._id) ? { ...s, bool_pago: true } : s
      ));
      setSelectedServicos([]);
      alert('Serviços marcados como pagos com sucesso!');
    } catch (err) {
      console.error('Error marking paid:', err);
      alert('Ocorreu um erro ao atualizar os pagamentos.');
    } finally {
      setIsSaving(false);
    }
  };

  // Inline edit price save
  const handleSavePrice = async (servicoId: string) => {
    const valNum = parseFloat(editingValue);
    if (isNaN(valNum)) {
      alert('Por favor insira um valor numérico válido.');
      return;
    }

    setIsSaving(true);
    try {
      await axios.patch('/api/gestor/financeiro/servicos', {
        servicoId,
        num_valor_cooperado: valNum
      });

      // Update local state
      setServicos(prev => prev.map(s =>
        s._id === servicoId ? { ...s, num_valor_cooperado: valNum } : s
      ));
      setEditingServicoId(null);
    } catch (err) {
      console.error('Error saving price:', err);
      alert('Erro ao atualizar o valor.');
    } finally {
      setIsSaving(false);
    }
  };

  // Helper formats
  const formatCurrency = (val?: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const formatDateTimeCompact = (dateStr?: string) => {
    return formatDate(dateStr).replace(',', '');
  };

  const formatPeriodDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  const getScaleLabel = (scaleId?: string) => {
    if (!scaleId) return 'Sem Escala';
    const esc = escalas.find(e => e._id === scaleId);
    return esc?.txt_anotacoes || `Escala #${esc?.num_id || scaleId.substring(0, 6)}`;
  };

  // RPA Selected Services & Financial Breakdown
  // Uses checked unpaid services; if all filtered services in the period are already paid, falls back to them so RPA can still be exported.
  const rpaSelectedServicos =
    selectedUnpaidServicos.length > 0
      ? selectedUnpaidServicos
      : unpaidFilteredIds.length === 0
        ? filteredServicos
        : [];
  const rpaValorBruto = rpaSelectedServicos.reduce((sum, s) => sum + (s.num_valor_cooperado || 0), 0);
  const rawDescontos = Math.max(0, parseFloat((rpaRetencoes || '0').replace(',', '.')) || 0);
  const rpaValorDescontos = Math.min(rpaValorBruto, rawDescontos);
  const rpaValorLiquido = Math.max(0, rpaValorBruto - rpaValorDescontos);

  const sanitizeFilePart = (str: string) =>
    (str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '');

  const getRpaFileName = () => {
    const safeNome = sanitizeFilePart(activeCooperado?.txt_nomeCompleto || 'Cooperado') || 'Cooperado';
    const rawPeriodo =
      startDate && endDate
        ? `${startDate}_a_${endDate}`
        : startDate || endDate || new Date().toISOString().slice(0, 10);
    const safePeriodo = sanitizeFilePart(rawPeriodo) || 'Periodo';
    return `RPA_${safeNome}_${safePeriodo}.pdf`;
  };

  // Direct PDF Generation & Download via jsPDF
  const handleDownloadRpaPdf = () => {
    if (!activeCooperado) return;
    setIsGeneratingPdf(true);
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const marginX = 14;
      const pageWidth = 210;
      const contentWidth = pageWidth - marginX * 2;
      const bottomLimit = 276;
      let y = 16;

      const drawInstitutionalHeader = (isContinuation = false) => {
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(30, 41, 59);
        doc.setLineWidth(0.4);
        doc.rect(marginX, y, contentWidth, isContinuation ? 18 : 28, 'FD');

        doc.setTextColor(15, 23, 42);
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(12);
        doc.text(
          isContinuation
            ? 'RECIBO DE PAGAMENTO DE AUTÔNOMO - RPA (CONTINUAÇÃO)'
            : 'RECIBO DE PAGAMENTO DE AUTÔNOMO - RPA',
          pageWidth / 2,
          y + 7,
          { align: 'center' }
        );

        doc.setFontSize(9);
        doc.text(
          'MULTCARE - COOPERATIVA DE TRABALHO DOS PROFISSIONAIS DE SAÚDE',
          pageWidth / 2,
          y + 13,
          { align: 'center' }
        );

        if (!isContinuation) {
          doc.setFont('Helvetica', 'normal');
          doc.setFontSize(7.5);
          doc.setTextColor(51, 65, 85);
          doc.text(
            'CNPJ: 11.426.910/0001-57 | Rua 802, Qd. 801, nº 99, Lote 10, Setor Leste Vila Nova - Goiânia/GO - CEP: 74.633-110',
            pageWidth / 2,
            y + 18.5,
            { align: 'center' }
          );
          doc.setFont('Helvetica', 'bold');
          doc.text(
            `Período de Apuração: ${formatPeriodDate(startDate)} a ${formatPeriodDate(endDate)}   |   Emissão: ${new Date().toLocaleDateString('pt-BR')}`,
            pageWidth / 2,
            y + 24,
            { align: 'center' }
          );
          y += 33;
        } else {
          y += 23;
        }
      };

      const drawTableHeader = () => {
        doc.setFillColor(30, 41, 59);
        doc.setTextColor(255, 255, 255);
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(8);
        doc.rect(marginX, y, contentWidth, 7, 'F');
        doc.text('Plantão / Serviço', marginX + 2, y + 4.8);
        doc.text('Escala', marginX + 78, y + 4.8);
        doc.text('Data Realização', marginX + 125, y + 4.8);
        doc.text('Valor Bruto', marginX + contentWidth - 2, y + 4.8, { align: 'right' });
        y += 7;
      };

      drawInstitutionalHeader(false);

      // Dados da Fonte Pagadora & Favorecido (Cooperado)
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.3);
      doc.rect(marginX, y, contentWidth, 30);
      doc.line(marginX + contentWidth / 2, y, marginX + contentWidth / 2, y + 30);

      // Left box: Fonte Pagadora
      doc.setTextColor(15, 23, 42);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('FONTE PAGADORA (COOPERATIVA)', marginX + 3, y + 5);
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text('MULTCARE COOPERATIVA DE TRABALHO', marginX + 3, y + 10.5);
      doc.text('CNPJ: 11.426.910/0001-57', marginX + 3, y + 15.5);
      doc.text('Rua 802, Qd. 801, nº 99, Setor Leste Vila Nova', marginX + 3, y + 20.5);
      doc.text('Goiânia/GO - CEP: 74.633-110', marginX + 3, y + 25.5);

      // Right box: Favorecido (Cooperado)
      const rightX = marginX + contentWidth / 2 + 3;
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('FAVORECIDO (COOPERADO)', rightX, y + 5);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8);
      const coopNameLines = doc.splitTextToSize(activeCooperado.txt_nomeCompleto || '-', contentWidth / 2 - 6);
      doc.text(coopNameLines[0] || '-', rightX, y + 10.5);
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text(`CPF: ${activeCooperado.txt_CPF || '-'}`, rightX, y + 15.5);
      doc.text(doc.splitTextToSize(`E-mail: ${activeCooperado.txt_email || '-'}`, contentWidth / 2 - 6)[0] || '-', rightX, y + 20.5);
      const bankLine =
        bankAccounts.length > 0
          ? `Banco: ${bankAccounts[0].txt_banco || '-'} | Ag: ${bankAccounts[0].txt_agencia || '-'} | CC: ${bankAccounts[0].txt_nConta || '-'}`
          : 'Dados Bancários: Não vinculados';
      doc.text(doc.splitTextToSize(bankLine, contentWidth / 2 - 6)[0] || bankLine, rightX, y + 25.5);

      y += 35;

      // Section Title: Services Table
      doc.setTextColor(15, 23, 42);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text(`DETALHAMENTO DOS SERVIÇOS / PLANTÕES DO PERÍODO (${rpaSelectedServicos.length} REGISTROS)`, marginX, y);
      y += 3;

      drawTableHeader();

      if (rpaSelectedServicos.length === 0) {
        doc.setFont('Helvetica', 'italic');
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.rect(marginX, y, contentWidth, 8);
        doc.text('Nenhum serviço selecionado para o período.', marginX + 3, y + 5.2);
        y += 8;
      } else {
        rpaSelectedServicos.forEach((serv, idx) => {
          doc.setFont('Helvetica', 'normal');
          doc.setFontSize(7.5);
          const servTitle = `${serv.txt_nome || 'Plantão'} (#${serv.num_id || serv._id.substring(0, 6)})`;
          const scaleTitle = getScaleLabel(serv.fk_escala);
          const dateTitle = formatDateTimeCompact(serv.date_fixa_entrada);

          const servLines = doc.splitTextToSize(servTitle, 73).slice(0, 2);
          const scaleLines = doc.splitTextToSize(scaleTitle, 44).slice(0, 2);
          const maxRowLines = Math.max(1, servLines.length, scaleLines.length);
          const rowHeight = maxRowLines > 1 ? 10.5 : 7;

          if (y + rowHeight > bottomLimit) {
            doc.addPage();
            y = 16;
            drawInstitutionalHeader(true);
            drawTableHeader();
            doc.setFont('Helvetica', 'normal');
            doc.setFontSize(7.5);
          }

          if (idx % 2 === 1) {
            doc.setFillColor(248, 250, 252);
            doc.rect(marginX, y, contentWidth, rowHeight, 'F');
          }
          doc.setDrawColor(226, 232, 240);
          doc.rect(marginX, y, contentWidth, rowHeight, 'S');

          doc.setTextColor(15, 23, 42);
          doc.text(servLines, marginX + 2, y + 4.4);
          doc.text(scaleLines, marginX + 78, y + 4.4);
          doc.text(dateTitle, marginX + 125, y + 4.7);

          doc.setFont('Helvetica', 'bold');
          doc.text(formatCurrency(serv.num_valor_cooperado), marginX + contentWidth - 2, y + 4.7, { align: 'right' });
          y += rowHeight;
        });
      }

      y += 5;

      // Pre-compute declaration lines to know exact height of closing block
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      const declaracaoTexto = `Declaro que recebi da MULTCARE - COOPERATIVA DE TRABALHO DOS PROFISSIONAIS DE SAÚDE (CNPJ 11.426.910/0001-57) a importância líquida de ${formatCurrency(rpaValorLiquido)} (valor bruto de ${formatCurrency(rpaValorBruto)} menos retenções/descontos de ${formatCurrency(rpaValorDescontos)}), referente à produção cooperativa dos plantões e serviços discriminados neste recibo no período de ${formatPeriodDate(startDate)} a ${formatPeriodDate(endDate)}, dando plena, geral e irrevogável quitação.`;
      const declaracaoLinhas = doc.splitTextToSize(declaracaoTexto, contentWidth);
      const closingBlockHeight = 30 + declaracaoLinhas.length * 4.2 + 14 + 9;

      // Ensure space for Financial Summary + Disclaimer + Signatures
      if (y + closingBlockHeight > bottomLimit) {
        doc.addPage();
        y = 16;
        drawInstitutionalHeader(true);
      }

      // Quadro de Resumo Financeiro (Bruto, Retenções/Descontos, Líquido)
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(30, 41, 59);
      doc.setLineWidth(0.35);
      doc.rect(marginX, y, contentWidth, 24, 'FD');

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(51, 65, 85);
      doc.text('Valor Bruto dos Serviços / Plantões:', marginX + 4, y + 6.5);
      doc.setFont('Helvetica', 'bold');
      doc.text(formatCurrency(rpaValorBruto), marginX + contentWidth - 4, y + 6.5, { align: 'right' });

      doc.setFont('Helvetica', 'normal');
      doc.text('Retenções / Descontos (INSS / IRRF / Taxa Cooperativa):', marginX + 4, y + 13);
      doc.setFont('Helvetica', 'bold');
      doc.text(`- ${formatCurrency(rpaValorDescontos)}`, marginX + contentWidth - 4, y + 13, { align: 'right' });

      doc.setDrawColor(148, 163, 184);
      doc.line(marginX + 2, y + 15.8, marginX + contentWidth - 2, y + 15.8);

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text('VALOR LÍQUIDO A RECEBER:', marginX + 4, y + 21.5);
      doc.text(formatCurrency(rpaValorLiquido), marginX + contentWidth - 4, y + 21.5, { align: 'right' });

      y += 30;

      // Declaração de Quitação
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
      doc.text(declaracaoLinhas, marginX, y);
      y += declaracaoLinhas.length * 4.2 + 14;

      // Local, Data e Linha de Assinatura
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.text(`Goiânia/GO, ${new Date().toLocaleDateString('pt-BR')}`, marginX, y);

      const sigWidth = 82;
      const sigLineStartX = marginX + contentWidth - sigWidth;
      const sigLineEndX = marginX + contentWidth;
      const sigCenter = (sigLineStartX + sigLineEndX) / 2;
      doc.setDrawColor(15, 23, 42);
      doc.setLineWidth(0.4);
      doc.line(sigLineStartX, y - 2, sigLineEndX, y - 2);

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      const sigName = doc.splitTextToSize(activeCooperado.txt_nomeCompleto || 'Cooperado', sigWidth)[0] || 'Cooperado';
      doc.text(sigName, sigCenter, y + 3, { align: 'center' });
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      const sigSub = doc.splitTextToSize(`CPF: ${activeCooperado.txt_CPF || '-'} - Assinatura do Cooperado`, sigWidth + 6)[0];
      doc.text(sigSub, sigCenter, y + 7.2, { align: 'center' });

      // Page numbers in footer
      const totalPagesCount = doc.getNumberOfPages();
      for (let p = 1; p <= totalPagesCount; p++) {
        doc.setPage(p);
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.line(marginX, 284, marginX + contentWidth, 284);
        doc.text('Documento emitido eletronicamente pelo Sistema GestorCoop / Multcare', marginX, 288);
        doc.text(`Página ${p} de ${totalPagesCount}`, marginX + contentWidth, 288, { align: 'right' });
      }

      doc.save(getRpaFileName());
    } catch (err) {
      console.error('Erro ao gerar PDF do RPA:', err);
      alert('Ocorreu um erro ao gerar o PDF do RPA.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Filter cooperados by search input
  const filteredCooperadosList = cooperados.filter(c =>
    (c.txt_nomeCompleto || '').toLowerCase().includes(cooperadoSearch.toLowerCase()) ||
    (c.txt_CPF || '').includes(cooperadoSearch)
  );

  return (
    <div className="text-slate-800 font-sans">

      {/* Print styles override (only prints print-area when printing) */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm;
          }
          html, body {
            background: white !important;
            color: black !important;
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
          }
          aside,
          header,
          nav,
          .rpa-dashboard-content,
          .rpa-modal-header {
            display: none !important;
          }
          body > div,
          body > div > div,
          main,
          .rpa-modal-backdrop,
          .rpa-modal-container {
            position: static !important;
            display: block !important;
            overflow: visible !important;
            background: transparent !important;
            border: none !important;
            box-shadow: none !important;
            margin: 0 !important;
            padding: 0 !important;
            min-height: 0 !important;
            height: auto !important;
            max-width: 100% !important;
            width: 100% !important;
          }
          #print-area {
            position: static !important;
            display: block !important;
            width: 100% !important;
            background: white !important;
            color: black !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            overflow: visible !important;
          }
          #print-area table {
            width: 100% !important;
            border-collapse: collapse !important;
          }
          #print-area thead {
            display: table-header-group !important;
          }
          #print-area tr,
          #print-area .rpa-avoid-break {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      <div className="rpa-dashboard-content max-w-7xl mx-auto print:hidden">

        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <DollarSign className="w-8 h-8 text-indigo-600" />
              Repasses &amp; Serviços Financeiros
            </h1>
            <p className="text-slate-500 text-sm mt-1">Consolide os plantões realizados pelos cooperados, edite valores, emita RPA e gerencie pagamentos.</p>
          </div>
        </div>

        {/* Step 1 & 2: Filters and Cooperado Selection */}
        <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm mb-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Passo 1: Período de Repasse */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-indigo-500" />
                Passo 1: Período de Repasse
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Data Início</label>
                  <input
                    type="date"
                    className="w-full p-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white text-xs focus:outline-none transition-all"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Data Fim</label>
                  <input
                    type="date"
                    className="w-full p-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white text-xs focus:outline-none transition-all"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Passo 2: Selecionar Cooperado */}
            <div className="lg:col-span-2 relative">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <Users className="w-4 h-4 text-indigo-500" />
                Passo 2: Selecionar Cooperado
              </h3>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="text"
                  className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white text-sm focus:outline-none focus:border-indigo-500 transition-all"
                  placeholder="Digite o nome ou CPF do cooperado..."
                  value={cooperadoSearch}
                  onChange={(e) => setCooperadoSearch(e.target.value)}
                />
              </div>

              {/* Cooperado Search Results List */}
              {cooperadoSearch && (
                <div className="mt-2 border border-slate-100 bg-white rounded-lg shadow-lg max-h-48 overflow-y-auto absolute z-20 w-full">
                  {filteredCooperadosList.length === 0 ? (
                    <div className="p-3 text-slate-500 text-sm">Nenhum cooperado encontrado.</div>
                  ) : (
                    filteredCooperadosList.map(coop => (
                      <button
                        key={coop._id}
                        onClick={() => {
                          setSelectedCooperadoId(coop._id);
                          setCooperadoSearch('');
                        }}
                        className="w-full text-left p-3 hover:bg-slate-50 transition-all border-b border-slate-100 flex justify-between items-center text-sm"
                      >
                        <span className="font-semibold text-slate-800">{coop.txt_nomeCompleto}</span>
                        <span className="text-xs text-slate-400 font-mono">CPF: {coop.txt_CPF}</span>
                      </button>
                    ))
                  )}
                </div>
              )}

              {/* Currently Selected Card */}
              {activeCooperado && (
                <div className="mt-3 p-3 bg-indigo-50/50 border border-indigo-100 rounded-lg flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-indigo-600 font-bold uppercase">Cooperado Ativo</span>
                    <h4 className="text-base font-bold text-slate-900 mt-0.5">{activeCooperado.txt_nomeCompleto}</h4>
                    <p className="text-xs text-slate-500">CPF: {activeCooperado.txt_CPF} | E-mail: {activeCooperado.txt_email}</p>
                  </div>
                  <button
                    onClick={() => setSelectedCooperadoId('')}
                    className="text-slate-400 hover:text-slate-600 bg-white hover:bg-slate-100 p-1.5 rounded-lg border border-slate-200 transition-all"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* If no cooperado is selected, don't render metrics or details */}
        {activeCooperado && (
          <>
            {/* Sub-Filters and Bank Account Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">

              {/* Multi Scale Filter */}
              <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm lg:col-span-2 relative">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Filtrar por Escalas ({selectedEscalas.length} selecionadas)</label>
                <div
                  onClick={() => setShowEscalaDropdown(!showEscalaDropdown)}
                  className="flex items-center justify-between p-2.5 border border-slate-200 rounded-lg bg-slate-50 hover:bg-white transition-all cursor-pointer text-sm"
                >
                  <div className="flex flex-wrap gap-1 max-w-[90%] overflow-hidden">
                    {selectedEscalas.length === 0 ? (
                      <span className="text-slate-400">Todas as Escalas</span>
                    ) : (
                      selectedEscalas.map(id => (
                        <span key={id} className="bg-indigo-100 text-indigo-700 font-semibold text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">
                          {getScaleLabel(id)}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEscalas(prev => prev.filter(scaleId => scaleId !== id));
                            }}
                            className="hover:text-indigo-900"
                          >
                            ✕
                          </button>
                        </span>
                      ))
                    )}
                  </div>
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                </div>

                {showEscalaDropdown && (
                  <div className="absolute z-10 w-[calc(100%-40px)] mt-1 border border-slate-100 bg-white rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {escalas.length === 0 ? (
                      <div className="p-3 text-slate-400 text-xs">Nenhuma escala encontrada.</div>
                    ) : (
                      escalas.map(esc => {
                        const isChecked = selectedEscalas.includes(esc._id);
                        return (
                          <label
                            key={esc._id}
                            className="flex items-center gap-2 p-2.5 hover:bg-slate-50 transition-all border-b border-slate-100 text-xs text-slate-700 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                setSelectedEscalas(prev =>
                                  isChecked ? prev.filter(id => id !== esc._id) : [...prev, esc._id]
                                );
                              }}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            {esc.txt_anotacoes || `Escala #${esc.num_id || esc._id.substring(0, 6)}`}
                          </label>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* Bank Account Info Card */}
              <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm">
                <h3 className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Dados Bancários / PIX</h3>
                {loadingData ? (
                  <div className="flex justify-center items-center py-2">
                    <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
                  </div>
                ) : bankAccounts.length > 0 ? (
                  <div className="space-y-2">
                    {bankAccounts.map((bank) => (
                      <div key={bank._id} className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 text-xs">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold text-slate-600">{bank.txt_banco}</span>
                          <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-bold uppercase text-[9px]">{bank.text_corrente_or_poupanca}</span>
                        </div>
                        <p className="text-slate-800">Ag: <strong className="font-semibold">{bank.txt_agencia}</strong> | Cc: <strong className="font-semibold">{bank.txt_nConta}</strong></p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-3 text-center text-slate-400 text-[10px] border border-dashed border-slate-100 rounded-lg">
                    Nenhuma conta bancária vinculada.
                  </div>
                )}
              </div>

            </div>

            {/* Step 3: Metrics summary row */}
            {loadingData ? (
              <div className="flex justify-center items-center py-20 bg-white border border-slate-200 rounded-xl shadow-sm mb-8">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mr-3" />
                <span className="text-slate-500 font-semibold">Carregando serviços e dados financeiros...</span>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">

                  {/* Total Services */}
                  <div className="bg-white border border-slate-200 p-5 rounded-xl flex items-center justify-between gap-4 shadow-sm border-l-4 border-l-indigo-600">
                    <div>
                      <span className="text-xs text-slate-400 font-semibold uppercase">Serviços Filtrados</span>
                      <p className="text-xl font-black text-slate-900 mt-1">{metricTotalServicos} plantões</p>
                    </div>
                    <div className="bg-indigo-50 text-indigo-600 p-2.5 rounded-lg">
                      <Calendar className="w-5 h-5" />
                    </div>
                  </div>

                  {/* Ready for payout */}
                  <div className="bg-white border border-slate-200 p-5 rounded-xl flex items-center justify-between gap-4 shadow-sm border-l-4 border-l-emerald-500">
                    <div>
                      <span className="text-xs text-slate-400 font-semibold uppercase">Prontos p/ Repasse</span>
                      <p className="text-xl font-black text-emerald-600 mt-1">{formatCurrency(metricProntos)}</p>
                    </div>
                    <div className="bg-emerald-50 text-emerald-600 p-2.5 rounded-lg">
                      <CheckCircle className="w-5 h-5" />
                    </div>
                  </div>

                  {/* Waiting management confirmation */}
                  <div className="bg-white border border-slate-200 p-5 rounded-xl flex items-center justify-between gap-4 shadow-sm border-l-4 border-l-amber-500">
                    <div>
                      <span className="text-xs text-slate-400 font-semibold uppercase">Aguardando Confirmação</span>
                      <p className="text-xl font-black text-amber-600 mt-1">{formatCurrency(metricAguardando)}</p>
                    </div>
                    <div className="bg-amber-50 text-amber-500 p-2.5 rounded-lg">
                      <Clock className="w-5 h-5" />
                    </div>
                  </div>

                  {/* Paid/Transferred */}
                  <div className="bg-white border border-slate-200 p-5 rounded-xl flex items-center justify-between gap-4 shadow-sm border-l-4 border-l-blue-500">
                    <div>
                      <span className="text-xs text-slate-400 font-semibold uppercase">Já Repassados (Pago)</span>
                      <p className="text-xl font-black text-blue-600 mt-1">{formatCurrency(metricPagos)}</p>
                    </div>
                    <div className="bg-blue-50 text-blue-600 p-2.5 rounded-lg">
                      <CreditCard className="w-5 h-5" />
                    </div>
                  </div>

                </div>

                {/* Step 4: Big Indigo Calculation Box and Actions */}
                <div className="bg-indigo-900 text-white rounded-xl p-6 shadow-md mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                  <div>
                    <h3 className="text-lg font-bold">Total Selecionado a Pagar</h3>
                    <p className="text-xs text-indigo-200 mt-0.5">Soma dos plantões marcados com check na tabela abaixo pendentes de repasse.</p>
                  </div>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full md:w-auto">
                    <div className="text-2xl md:text-3xl font-black text-right pr-4 font-mono">
                      {formatCurrency(selectedSum)}
                    </div>

                    {/* Emit RPA Action */}
                    <button
                      onClick={() => setShowRpaModal(true)}
                      disabled={rpaSelectedServicos.length === 0}
                      className="bg-sky-500 hover:bg-sky-600 disabled:bg-indigo-850 disabled:text-indigo-400 text-white px-5 py-2.5 rounded-lg text-sm font-bold shadow-sm flex items-center justify-center gap-2 transition-all"
                    >
                      <FileText className="w-4 h-4" />
                      Emitir RPA
                    </button>

                    {/* Bulk Payment Confirmation */}
                    <button
                      onClick={handleMarkAsPaid}
                      disabled={selectedUnpaidServicos.length === 0 || isSaving}
                      className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-indigo-850 disabled:text-indigo-400 text-white px-5 py-2.5 rounded-lg text-sm font-bold shadow-sm flex items-center justify-center gap-2 transition-all"
                    >
                      {isSaving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                      Marcar como Pago
                    </button>
                  </div>
                </div>

                {/* Step 5: Table of services with editing and selection */}
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mb-12">
                  <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h4 className="text-sm font-bold text-slate-800">Detalhamento dos Serviços Prestados</h4>
                    <span className="text-xs bg-slate-200/85 px-3 py-1 rounded-full text-slate-600 font-medium">
                      Exibindo {filteredServicos.length} registros
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-slate-400 font-bold border-b border-slate-100 text-xs uppercase">
                          <th className="py-3 px-4 w-12 text-center">
                            <input
                              type="checkbox"
                              checked={allUnpaidSelected}
                              onChange={handleSelectAll}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                            />
                          </th>
                          <th className="py-3 px-4">Plantão / ID</th>
                          <th className="py-3 px-4">Escala</th>
                          <th className="py-3 px-4">Data/Hora Entrada e Saída</th>
                          <th className="py-3 px-4 w-48">Valor Cooperado (Repasse)</th>
                          <th className="py-3 px-4 text-center">Confirmação</th>
                          <th className="py-3 px-4 text-center">Pagamento</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredServicos.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="text-center py-10 text-slate-400 text-sm">
                              Nenhum serviço encontrado no período ou escala selecionados.
                            </td>
                          </tr>
                        ) : (
                          filteredServicos.map(serv => {
                            const isChecked = selectedServicos.includes(serv._id);
                            const isEditing = editingServicoId === serv._id;

                            return (
                              <tr
                                key={serv._id}
                                className={`hover:bg-slate-50/70 transition-all ${serv.bool_pago ? 'opacity-70 bg-slate-50/30' : isChecked ? 'bg-indigo-50/20' : ''
                                  }`}
                              >
                                {/* Checkbox column */}
                                <td className="py-3 px-4 text-center">
                                  <input
                                    type="checkbox"
                                    checked={serv.bool_pago || isChecked}
                                    disabled={!!serv.bool_pago}
                                    onChange={() => handleSelectRow(serv._id)}
                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer disabled:opacity-50"
                                  />
                                </td>

                                {/* Service Name / ID */}
                                <td className="py-3 px-4">
                                  <p className="font-bold text-slate-800">{serv.txt_nome || 'Plantão S/ Nome'}</p>
                                  <span className="text-[10px] text-slate-400 font-mono">ID: #{serv.num_id || serv._id.substring(0, 8)}</span>
                                </td>

                                {/* Scale */}
                                <td className="py-3 px-4 text-slate-600">
                                  {getScaleLabel(serv.fk_escala)}
                                </td>

                                {/* Period */}
                                <td className="py-3 px-4 text-xs text-slate-500">
                                  <div className="font-medium text-slate-700">De: {formatDate(serv.date_fixa_entrada)}</div>
                                  <div>Até: {formatDate(serv.date_fixa_saida)}</div>
                                </td>

                                {/* Cooperado price with inline edit */}
                                <td className="py-3 px-4">
                                  {isEditing ? (
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs font-semibold text-slate-500">R$</span>
                                      <input
                                        type="number"
                                        className="w-20 p-1 text-xs border border-indigo-400 focus:outline-none rounded font-bold"
                                        value={editingValue}
                                        onChange={(e) => setEditingValue(e.target.value)}
                                        autoFocus
                                      />
                                      <button
                                        onClick={() => handleSavePrice(serv._id)}
                                        className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                                        title="Salvar valor"
                                      >
                                        <Save className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => setEditingServicoId(null)}
                                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                                        title="Cancelar"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2 group">
                                      <span className="font-bold text-slate-800">{formatCurrency(serv.num_valor_cooperado)}</span>
                                      {!serv.bool_pago && (
                                        <button
                                          onClick={() => {
                                            setEditingServicoId(serv._id);
                                            setEditingValue(String(serv.num_valor_cooperado || 0));
                                          }}
                                          className="text-indigo-500 opacity-0 group-hover:opacity-100 hover:bg-indigo-50 p-1 rounded transition-all"
                                          title="Editar Valor"
                                        >
                                          <Edit2 className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </td>

                                {/* Confirmation status */}
                                <td className="py-3 px-4 text-center">
                                  <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-bold uppercase ${serv.bool_confirmacao_finalizado
                                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-250'
                                      : 'bg-amber-100 text-amber-800 border border-amber-250'
                                    }`}>
                                    {serv.bool_confirmacao_finalizado ? 'Confirmado' : 'Aguardando'}
                                  </span>
                                </td>

                                {/* Payment status */}
                                <td className="py-3 px-4 text-center">
                                  <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-bold uppercase ${serv.bool_pago
                                      ? 'bg-indigo-100 text-indigo-800 border border-indigo-250'
                                      : 'bg-rose-100 text-rose-800 border border-rose-250'
                                    }`}>
                                    {serv.bool_pago ? 'Pago' : 'Pendente'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </>
            )}

          </>
        )}

      </div>

      {/* RPA MODAL LAYOUT */}
      {showRpaModal && activeCooperado && (
        <div className="rpa-modal-backdrop fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex justify-center items-start overflow-y-auto p-3 md:p-5">
          <div className="rpa-modal-container bg-white border border-slate-300 rounded-xl max-w-3xl w-full shadow-2xl relative my-2">

            {/* Modal Header Controls (Not Printed) */}
            <div className="rpa-modal-header px-4 py-3 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-50 rounded-t-xl print:hidden">
              <div>
                <span className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  Contracheque / Recibo de Pagamento de Autônomo (RPA)
                </span>
                <p className="text-[11px] text-slate-500 mt-0.5 font-mono">
                  Arquivo: {getRpaFileName()}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-end">
                <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1">
                  <label htmlFor="rpa-retencoes-input" className="text-[10px] font-bold text-slate-500 uppercase">
                    Retenções/Desc. (R$):
                  </label>
                  <input
                    id="rpa-retencoes-input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={rpaRetencoes}
                    onChange={(e) => setRpaRetencoes(e.target.value)}
                    className="w-20 text-xs font-bold text-slate-800 focus:outline-none text-right"
                    placeholder="0,00"
                  />
                </div>
                <button
                  type="button"
                  data-testid="btn-download-rpa-pdf"
                  onClick={handleDownloadRpaPdf}
                  disabled={isGeneratingPdf}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md flex items-center gap-1.5 transition-all"
                >
                  {isGeneratingPdf ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  Baixar PDF Direto
                </button>
                <button
                  type="button"
                  data-testid="btn-print-rpa"
                  onClick={() => window.print()}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-lg text-xs font-bold shadow flex items-center gap-1.5 transition-all"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Imprimir
                </button>
                <button
                  type="button"
                  onClick={() => setShowRpaModal(false)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg bg-white border border-slate-200 transition-all"
                  title="Fechar modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Printable Document Body */}
            <div id="print-area" className="p-6 md:p-8 bg-white text-black font-mono text-sm leading-relaxed">
              <div className="text-center border-b-4 border-double border-black pb-3 mb-4">
                <h2 className="text-xl font-extrabold m-0 uppercase">RECIBO DE PAGAMENTO DE AUTÔNOMO - RPA</h2>
                <span className="text-xs font-bold block mt-1">
                  MULTCARE - COOPERATIVA DE TRABALHO DOS PROFISSIONAIS DE SAÚDE
                </span>
                <span className="text-[10px] block mt-0.5">
                  CNPJ: 11.426.910/0001-57 | Rua 802, Qd. 801, nº 99, Lote 10, Setor Leste Vila Nova - Goiânia/GO - CEP: 74.633-110
                </span>
                <span className="text-[11px] font-bold block mt-1">
                  Período de Apuração: {formatPeriodDate(startDate)} a {formatPeriodDate(endDate)}
                </span>
              </div>

              {/* Parties */}
              <div className="rpa-avoid-break grid grid-cols-1 md:grid-cols-2 gap-6 border-b border-dashed border-black pb-3.5 mb-4 text-xs">
                <div>
                  <h4 className="font-bold uppercase mb-1">Fonte Pagadora (Cooperativa)</h4>
                  <p className="m-0 font-bold">MULTCARE COOPERATIVA DE TRABALHO</p>
                  <p className="m-0">CNPJ: 11.426.910/0001-57</p>
                  <p className="m-0">Endereço: Rua 802, Qd. 801, nº 99, Setor Leste Vila Nova</p>
                  <p className="m-0">Goiânia/GO - CEP: 74.633-110</p>
                </div>
                <div>
                  <h4 className="font-bold uppercase mb-1">Favorecido (Cooperado)</h4>
                  <p className="m-0 font-bold">{activeCooperado.txt_nomeCompleto}</p>
                  <p className="m-0">CPF: {activeCooperado.txt_CPF || '-'}</p>
                  <p className="m-0">E-mail: {activeCooperado.txt_email || '-'}</p>
                  {bankAccounts.length > 0 ? (
                    <p className="m-0">
                      Banco: {bankAccounts[0].txt_banco} | Ag: {bankAccounts[0].txt_agencia} | CC: {bankAccounts[0].txt_nConta}
                    </p>
                  ) : (
                    <p className="m-0 text-slate-600">Dados Bancários: Não vinculados</p>
                  )}
                </div>
              </div>

              {/* Service Details */}
              <div className="mb-4">
                <h4 className="font-bold text-xs uppercase mb-1.5">
                  Detalhamento dos Serviços / Plantões ({rpaSelectedServicos.length} registros)
                </h4>
                <table className="w-full border-collapse text-xs text-left">
                  <thead>
                    <tr className="border-b border-black font-bold">
                      <th className="py-1.5">Plantão / Serviço</th>
                      <th className="py-1.5">Escala</th>
                      <th className="py-1.5">Data Realização</th>
                      <th className="py-1.5 text-right">Valor Bruto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {rpaSelectedServicos.map(serv => (
                      <tr key={serv._id}>
                        <td className="py-1.5">{serv.txt_nome || 'Plantão'} (#{serv.num_id || serv._id.substring(0, 6)})</td>
                        <td className="py-1.5">{getScaleLabel(serv.fk_escala)}</td>
                        <td className="py-1.5">{formatDateTimeCompact(serv.date_fixa_entrada)}</td>
                        <td className="py-1.5 text-right font-bold">{formatCurrency(serv.num_valor_cooperado)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Financial Summary Box: Bruto, Retenções/Descontos, Líquido */}
              <div className="rpa-avoid-break border border-black p-3.5 mb-4 bg-slate-50/60 text-xs space-y-1">
                <div className="flex justify-between items-center">
                  <span>VALOR BRUTO DOS SERVIÇOS / PLANTÕES:</span>
                  <span className="font-bold font-mono">{formatCurrency(rpaValorBruto)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>RETENÇÕES / DESCONTOS (INSS / IRRF / TAXA COOPERATIVA):</span>
                  <span className="font-bold font-mono">- {formatCurrency(rpaValorDescontos)}</span>
                </div>
                <div className="flex justify-between items-center border-t border-black pt-1.5 text-sm font-extrabold">
                  <span>VALOR LÍQUIDO A RECEBER:</span>
                  <span className="font-mono">{formatCurrency(rpaValorLiquido)}</span>
                </div>
              </div>

              {/* Disclaimer & Signatures */}
              <div className="rpa-avoid-break">
                <div className="text-xs leading-normal border-t border-dashed border-black pt-3 mb-6">
                  Declaro que recebi da <strong>MULTCARE - COOPERATIVA DE TRABALHO DOS PROFISSIONAIS DE SAÚDE</strong> (CNPJ 11.426.910/0001-57) a importância líquida de <strong>{formatCurrency(rpaValorLiquido)}</strong> (valor bruto de <strong>{formatCurrency(rpaValorBruto)}</strong> menos retenções/descontos de <strong>{formatCurrency(rpaValorDescontos)}</strong>) pelos serviços e plantões discriminados acima no período de <strong>{formatPeriodDate(startDate)} a {formatPeriodDate(endDate)}</strong>, dando plena, geral e irrevogável quitação.
                </div>

                {/* Signatures */}
                <div className="flex flex-col md:flex-row justify-between items-end gap-8 mt-8 text-xs">
                  <div>
                    <p className="m-0">Local e Data: Goiânia/GO, {new Date().toLocaleDateString('pt-BR')}</p>
                  </div>
                  <div className="text-center min-w-[280px]">
                    <div className="border-t border-black pt-2 w-full">
                      <p className="m-0 font-bold">{activeCooperado.txt_nomeCompleto}</p>
                      <p className="m-0 text-[10px] text-slate-600">CPF: {activeCooperado.txt_CPF || '-'} — Assinatura do Cooperado</p>
                    </div>
                  </div>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
