'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Activity,
  Plus,
  Search,
  CheckCircle,
  X,
  Loader2,
  RefreshCw,
  Info,
  FileText,
  Wrench,
  Edit3,
  Sparkles,
  Calendar,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import { Equipamento, HistoricoEventoEquipamento, OrdemServicoManutencao, Paciente, LocacaoEquipamento, StatusEquipamento, ReservaEquipamento } from '@/lib/bubble';
import { TipoCobrancaLocacao, RentabilidadeResultado } from '@/lib/equipamentos-financeiro';
import { generateSerialNumber } from '@/lib/equipamentos-helpers';

export default function GestorEquipamentos() {
  // Data States
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [locacoes, setLocacoes] = useState<LocacaoEquipamento[]>([]);
  const [reservas, setReservas] = useState<ReservaEquipamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [fluxoV2Ativo, setFluxoV2Ativo] = useState(false);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'locacoes' | 'equipamentos' | 'reservas' | 'pacientes'>('locacoes');

  // Search Queries
  const [searchQuery, setSearchQuery] = useState('');

  // Form Submitting Feedback
  const [submitting, setSubmitting] = useState(false);

  // Modals Open State
  const [isEquipModalOpen, setIsEquipModalOpen] = useState(false);
  const [isPatientModalOpen, setIsPatientModalOpen] = useState(false);
  const [isRentalModalOpen, setIsRentalModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [isMaintenanceModalOpen, setIsMaintenanceModalOpen] = useState(false);
  const [isReserveModalOpen, setIsReserveModalOpen] = useState(false);
  const [isInspectionModalOpen, setIsInspectionModalOpen] = useState(false);
  const [isHygieneModalOpen, setIsHygieneModalOpen] = useState(false);

  // Editing items
  const [editingEquipamento, setEditingEquipamento] = useState<Equipamento | null>(null);
  const [historicoEquipamento, setHistoricoEquipamento] = useState<Equipamento | null>(null);
  const [historicoEventos, setHistoricoEventos] = useState<HistoricoEventoEquipamento[]>([]);
  const [historicoOrdens, setHistoricoOrdens] = useState<OrdemServicoManutencao[]>([]);
  const [historicoLoading, setHistoricoLoading] = useState(false);
  const [rentabilidade, setRentabilidade] = useState<RentabilidadeResultado | null>(null);
  const [rentabilidadeLoading, setRentabilidadeLoading] = useState(false);

  // Cancelamento de reserva
  const [reservaParaCancelar, setReservaParaCancelar] = useState<ReservaEquipamento | null>(null);
  const [cancelReservaMotivo, setCancelReservaMotivo] = useState('');

  // Return Rental Target
  const [selectedRentalForReturn, setSelectedRentalForReturn] = useState<LocacaoEquipamento | null>(null);
  const [selectedForMaintenance, setSelectedForMaintenance] = useState<Equipamento | null>(null);
  const [selectedForReserve, setSelectedForReserve] = useState<Equipamento | null>(null);
  const [selectedForInspection, setSelectedForInspection] = useState<Equipamento | null>(null);
  const [selectedForHygiene, setSelectedForHygiene] = useState<Equipamento | null>(null);
  const [returnEquipStatus, setReturnEquipStatus] = useState<'Disponível' | 'Manutenção'>('Disponível');

  // Equipment Form State
  const [equipNome, setEquipNome] = useState('');
  const [equipDescricao, setEquipDescricao] = useState('');
  const [equipMarca, setEquipMarca] = useState('');
  const [equipModelo, setEquipModelo] = useState('');
  const [equipSerie, setEquipSerie] = useState('');
  const [equipPreco, setEquipPreco] = useState('');
  const [equipStatus, setEquipStatus] = useState<StatusEquipamento>('Disponível');

  // Patient Form State
  const [patNome, setPatNome] = useState('');
  const [patCPF, setPatCPF] = useState('');
  const [patWhatsapp, setPatWhatsapp] = useState('');
  const [patEndereco, setPatEndereco] = useState('');
  const [patEmail, setPatEmail] = useState('');
  const [patTipo, setPatTipo] = useState<'Homecare' | 'Hospital'>('Homecare');
  const [patientFilter, setPatientFilter] = useState<string>('todos');

  // Rental Form State
  const [rentEquipId, setRentEquipId] = useState('');
  const [rentPatId, setRentPatId] = useState('');
  const [rentValor, setRentValor] = useState('');
  const [rentTipoCobranca, setRentTipoCobranca] = useState<TipoCobrancaLocacao>('Somente mensalidade');
  const [rentDataInicio, setRentDataInicio] = useState(new Date().toISOString().split('T')[0]);
  const [rentDataFimPrevisto, setRentDataFimPrevisto] = useState('');
  const [rentObservacoes, setRentObservacoes] = useState('');
  const [patientSearch, setPatientSearch] = useState('');
  const [maintenanceReason, setMaintenanceReason] = useState('');
  const [maintenanceDetails, setMaintenanceDetails] = useState('');
  const [reservePatientId, setReservePatientId] = useState('');
  const [reserveDate, setReserveDate] = useState('');
  const [reserveValidity, setReserveValidity] = useState('');
  const [inspectionResult, setInspectionResult] = useState('');
  const [inspectionDestination, setInspectionDestination] = useState<StatusEquipamento>('Aguardando higienização');
  const [hygieneMethod, setHygieneMethod] = useState('');
  const [hygieneResult, setHygieneResult] = useState('');

  // Fetch all data
  const fetchData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const [resEquip, resPat, resRent] = await Promise.all([
        axios.get('/api/gestor/equipamentos'),
        axios.get('/api/gestor/pacientes'),
        axios.get('/api/gestor/locacoes'),
      ]);

      if (resEquip.data.success) {
        setEquipamentos(resEquip.data.data || []);
        setFluxoV2Ativo(Boolean(resEquip.data.fluxoV2Ativo));
      }
      if (resPat.data.success) setPacientes(resPat.data.data || []);
      if (resRent.data.success) setLocacoes(resRent.data.data || []);

      // Reservas ativas são complementares: uma falha aqui não deve zerar a tela.
      try {
        const resReserva = await axios.get('/api/gestor/equipamentos/reservas', { params: { status: 'Ativa' } });
        if (resReserva.data.success) setReservas(resReserva.data.data || []);
      } catch (reservaErr) {
        console.error('Erro ao carregar reservas:', reservaErr);
      }
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
      setErrorMsg('Falha ao obter dados do Bubble. Certifique-se de que o servidor está rodando e as tabelas estão criadas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Helper formatting BRL
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  // Helper formatting Dates
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      // Adjust offset for correct local display
      date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
      return date.toLocaleDateString('pt-BR');
    } catch {
      return dateStr;
    }
  };

  // Metrics Calculations (Memoized)
  const {
    totalEquips,
    availableEquips,
    rentedEquips,
    maintenanceEquips,
    estimatedRevenue,
    recolhimentosAtrasados,
    aguardandoConferencia,
    aguardandoTratativaTecnica,
  } = React.useMemo(() => {
    const total = equipamentos.length;
    const available = equipamentos.filter((e) => ['Disponível', 'Liberado pela manutenção'].includes(e.txt_status)).length;
    const rented = equipamentos.filter((e) => ['Alugado', 'Implantado no domicílio', 'Em transporte para implantação'].includes(e.txt_status)).length;
    const maintenance = equipamentos.filter((e) => ['Manutenção', 'Aguardando peça', 'Em higienização', 'Aguardando higienização'].includes(e.txt_status)).length;
    const active = locacoes.filter((l) => l.txt_status === 'Ativo');
    const revenue = active.reduce((sum, r) => sum + (r.num_total_estimado ?? r.num_valor_aluguel), 0);
    const hojeStr = new Date().toISOString().slice(0, 10);
    const recolhimentos = active.filter((locacao) => locacao.date_fim_previsto && locacao.date_fim_previsto.slice(0, 10) < hojeStr);
    const conf = equipamentos.filter((equipamento) => ['Aguardando conferência', 'Recolhido e aguardando conferência'].includes(equipamento.txt_status));
    const tratativa = equipamentos.filter((equipamento) => ['Manutenção', 'Aguardando peça', 'Aguardando higienização', 'Em higienização'].includes(equipamento.txt_status));
    return {
      totalEquips: total,
      availableEquips: available,
      rentedEquips: rented,
      maintenanceEquips: maintenance,
      activeRentals: active,
      estimatedRevenue: revenue,
      recolhimentosAtrasados: recolhimentos,
      aguardandoConferencia: conf,
      aguardandoTratativaTecnica: tratativa,
    };
  }, [equipamentos, locacoes]);

  // Reset queries on Tab Change
  useEffect(() => {
    setSearchQuery('');
  }, [activeTab]);

  // Filters & Search (Memoized)
  const filteredEquipamentos = React.useMemo(() => {
    const term = searchQuery.toLowerCase();
    return equipamentos.filter((e) => {
      return (
        e.txt_nome.toLowerCase().includes(term) ||
        (e.txt_numero_serie || '').toLowerCase().includes(term) ||
        (e.txt_marca || '').toLowerCase().includes(term) ||
        (e.txt_modelo || '').toLowerCase().includes(term)
      );
    });
  }, [equipamentos, searchQuery]);

  const filteredPacientes = React.useMemo(() => {
    const term = searchQuery.toLowerCase();
    return pacientes.filter((p) => {
      const matchesSearch =
        p.txt_nome.toLowerCase().includes(term) ||
        (p.txt_cpf || '').includes(searchQuery) ||
        (p.txt_whatsapp || '').includes(searchQuery);

      if (!matchesSearch) return false;

      if (patientFilter === 'homecare') {
        return p.txt_tipo === 'Homecare' || !p.txt_tipo;
      }
      if (patientFilter === 'hospital') {
        return p.txt_tipo === 'Hospital';
      }
      if (patientFilter === 'com_equipamento') {
        return locacoes.some((l) => l.fk_paciente === p._id && l.txt_status === 'Ativo');
      }
      return true;
    });
  }, [pacientes, searchQuery, patientFilter, locacoes]);

  const filteredLocacoes = React.useMemo(() => {
    const term = searchQuery.toLowerCase();
    return locacoes.filter((l) => {
      const equip = equipamentos.find((e) => e._id === l.fk_equipamento);
      const pac = pacientes.find((p) => p._id === l.fk_paciente);
      return (
        (equip?.txt_nome || '').toLowerCase().includes(term) ||
        (pac?.txt_nome || '').toLowerCase().includes(term) ||
        (equip?.txt_numero_serie || '').toLowerCase().includes(term)
      );
    });
  }, [locacoes, searchQuery, equipamentos, pacientes]);

  const filteredReservas = React.useMemo(() => {
    const term = searchQuery.toLowerCase();
    return reservas
      .filter((r) => r.txt_status === 'Ativa')
      .filter((r) => {
        const equip = equipamentos.find((e) => e._id === r.fk_equipamento);
        const pac = pacientes.find((p) => p._id === r.fk_paciente);
        return (
          (equip?.txt_nome || '').toLowerCase().includes(term) ||
          (pac?.txt_nome || '').toLowerCase().includes(term) ||
          (equip?.txt_numero_serie || '').toLowerCase().includes(term)
        );
      });
  }, [reservas, searchQuery, equipamentos, pacientes]);

  // Dias restantes até a validade da reserva (negativo = vencida).
  const diasAteValidade = (dataIso?: string) => {
    if (!dataIso) return null;
    const alvo = new Date(dataIso);
    if (Number.isNaN(alvo.getTime())) return null;
    const base = new Date();
    return Math.floor((alvo.setHours(0, 0, 0, 0) - base.setHours(0, 0, 0, 0)) / 86_400_000);
  };

  // Modal Open Handlers
  const handleOpenEquipModal = (equip: Equipamento | null = null) => {
    if (equip) {
      setEditingEquipamento(equip);
      setEquipNome(equip.txt_nome);
      setEquipDescricao(equip.txt_descricao || '');
      setEquipMarca(equip.txt_marca || '');
      setEquipModelo(equip.txt_modelo || '');
      setEquipSerie(equip.txt_numero_serie);
      setEquipPreco(String(equip.num_preco_padrao));
      setEquipStatus(equip.txt_status);
    } else {
      setEditingEquipamento(null);
      setEquipNome('');
      setEquipDescricao('');
      setEquipMarca('');
      setEquipModelo('');
      setEquipSerie('');
      setEquipPreco('');
      setEquipStatus('Disponível');
    }
    setIsEquipModalOpen(true);
  };

  const handleOpenRentalModal = () => {
    setRentEquipId('');
    setRentPatId('');
    setRentValor('');
    setRentTipoCobranca('Somente mensalidade');
    setRentDataInicio(new Date().toISOString().split('T')[0]);
    setRentDataFimPrevisto('');
    setRentObservacoes('');
    setPatientSearch('');
    setErrorMsg('');
    setIsRentalModalOpen(true);
  };

  const handleOpenHistorico = async (equipamento: Equipamento) => {
    if (!equipamento._id) return;
    setHistoricoEquipamento(equipamento);
    setHistoricoEventos([]);
    setHistoricoOrdens([]);
    setRentabilidade(null);
    setHistoricoLoading(true);

    if (fluxoV2Ativo) {
      setRentabilidadeLoading(true);
      axios
        .get(`/api/gestor/equipamentos/${equipamento._id}/rentabilidade`)
        .then((response) => {
          if (response.data.success) setRentabilidade(response.data.data.rentabilidade);
        })
        .catch((error) => console.error('Erro ao calcular rentabilidade:', error))
        .finally(() => setRentabilidadeLoading(false));
    }

    try {
      const response = await axios.get(`/api/gestor/equipamentos/${equipamento._id}/historico`);
      if (response.data.success) {
        setHistoricoEventos(response.data.data.eventos || []);
        setHistoricoOrdens(response.data.data.ordensServico || []);
      }
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
      setErrorMsg('Não foi possível carregar o histórico do equipamento.');
    } finally {
      setHistoricoLoading(false);
    }
  };

  const handleSubmitCancelReserva = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!reservaParaCancelar?._id) return;
    setSubmitting(true);
    setErrorMsg('');
    try {
      await axios.post(
        `/api/gestor/equipamentos/${reservaParaCancelar.fk_equipamento}/reservas/${reservaParaCancelar._id}/cancelar`,
        { txt_motivo: cancelReservaMotivo }
      );
      setReservaParaCancelar(null);
      setCancelReservaMotivo('');
      fetchData();
    } catch (error) {
      const responseError = error as { response?: { data?: { error?: string } } };
      setErrorMsg(responseError.response?.data?.error || 'Erro ao cancelar a reserva.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenMaintenance = (equipamento: Equipamento) => {
    setSelectedForMaintenance(equipamento);
    setMaintenanceReason('');
    setMaintenanceDetails('');
    setIsMaintenanceModalOpen(true);
  };

  const handleOpenReserve = (equipamento: Equipamento) => {
    setSelectedForReserve(equipamento);
    setReservePatientId('');
    setReserveDate('');
    setReserveValidity('');
    setIsReserveModalOpen(true);
  };

  const handleSubmitReserve = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedForReserve?._id) return;
    setSubmitting(true);
    setErrorMsg('');
    try {
      await axios.post(`/api/gestor/equipamentos/${selectedForReserve._id}/reservas`, {
        fk_paciente: reservePatientId,
        date_implantacao_prevista: reserveDate,
        date_validade: reserveValidity,
      });
      setIsReserveModalOpen(false);
      fetchData();
    } catch (error) {
      const responseError = error as { response?: { data?: { error?: string } } };
      setErrorMsg(responseError.response?.data?.error || 'Erro ao reservar o equipamento.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenInspection = (equipamento: Equipamento) => {
    setSelectedForInspection(equipamento);
    setInspectionResult('');
    setInspectionDestination('Aguardando higienização');
    setIsInspectionModalOpen(true);
  };

  const handleSubmitInspection = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedForInspection?._id) return;
    setSubmitting(true);
    try {
      await axios.post(`/api/gestor/equipamentos/${selectedForInspection._id}/conferencias`, { txt_resultado: inspectionResult, txt_status_destino: inspectionDestination });
      setIsInspectionModalOpen(false);
      fetchData();
    } catch (error) {
      const responseError = error as { response?: { data?: { error?: string } } };
      setErrorMsg(responseError.response?.data?.error || 'Erro ao registrar a conferência.');
    } finally { setSubmitting(false); }
  };

  const handleOpenHygiene = (equipamento: Equipamento) => {
    setSelectedForHygiene(equipamento);
    setHygieneMethod('');
    setHygieneResult('');
    setIsHygieneModalOpen(true);
  };

  const handleSubmitHygiene = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedForHygiene?._id) return;
    setSubmitting(true);
    try {
      await axios.post(`/api/gestor/equipamentos/${selectedForHygiene._id}/higienizacoes`, { txt_metodo: hygieneMethod, txt_resultado: hygieneResult });
      setIsHygieneModalOpen(false);
      fetchData();
    } catch (error) {
      const responseError = error as { response?: { data?: { error?: string } } };
      setErrorMsg(responseError.response?.data?.error || 'Erro ao registrar higienização.');
    } finally { setSubmitting(false); }
  };

  const handleSubmitMaintenance = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedForMaintenance?._id) return;
    setSubmitting(true);
    setErrorMsg('');
    try {
      await axios.post(`/api/gestor/equipamentos/${selectedForMaintenance._id}/manutencoes`, {
        txt_motivo: maintenanceReason,
        txt_defeito_relatado: maintenanceDetails,
      });
      setIsMaintenanceModalOpen(false);
      setSelectedForMaintenance(null);
      fetchData();
    } catch (error) {
      const responseError = error as { response?: { data?: { error?: string } } };
      setErrorMsg(responseError.response?.data?.error || 'Erro ao abrir a ordem de serviço.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportarInventario = () => {
    const escapeCsv = (valor: unknown) => `"${String(valor ?? '').replace(/"/g, '""')}"`;
    const cabecalho = ['Código interno', 'Nome', 'Número de série', 'Patrimônio', 'Marca', 'Modelo', 'Situação', 'Diária padrão', 'Mensalidade padrão'];
    const linhas = equipamentos.map((equipamento) => [
      equipamento.txt_codigo_interno,
      equipamento.txt_nome,
      equipamento.txt_numero_serie,
      equipamento.txt_numero_patrimonio,
      equipamento.txt_marca,
      equipamento.txt_modelo,
      equipamento.txt_status,
      equipamento.num_valor_diaria_padrao ?? 0,
      equipamento.num_valor_mensal_padrao ?? equipamento.num_preco_padrao,
    ]);
    const conteudo = [cabecalho, ...linhas].map((linha) => linha.map(escapeCsv).join(';')).join('\n');
    const blob = new Blob([`\uFEFF${conteudo}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `inventario-equipamentos-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportarLocacoes = () => {
    const escapeCsv = (valor: unknown) => `"${String(valor ?? '').replace(/"/g, '""')}"`;
    const cabecalho = ['Equipamento', 'Código interno', 'Cliente', 'Início', 'Fim previsto', 'Fim real', 'Status', 'Cobrança', 'Valor final'];
    const linhas = locacoes.map((locacao) => {
      const equipamento = equipamentos.find((item) => item._id === locacao.fk_equipamento);
      const paciente = pacientes.find((item) => item._id === locacao.fk_paciente);
      return [equipamento?.txt_nome, equipamento?.txt_codigo_interno, paciente?.txt_nome, locacao.date_inicio, locacao.date_fim_previsto, locacao.date_fim_real, locacao.txt_status, locacao.os_tipo_cobranca, locacao.num_total_estimado ?? locacao.num_valor_aluguel];
    });
    const conteudo = [cabecalho, ...linhas].map((linha) => linha.map(escapeCsv).join(';')).join('\n');
    const blob = new Blob([`\uFEFF${conteudo}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio-locacoes-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Submit Equipamento (Create or Edit)
  const handleSubmitEquipamento = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg('');

    try {
      let finalSerie = equipSerie.trim();
      if (!finalSerie) {
        finalSerie = generateSerialNumber(equipMarca, equipModelo);
        setEquipSerie(finalSerie);
      }

      const payload: Record<string, unknown> = {
        txt_nome: equipNome,
        txt_descricao: equipDescricao,
        txt_marca: equipMarca,
        txt_modelo: equipModelo,
        txt_numero_serie: finalSerie,
        num_preco_padrao: Number(equipPreco),
      };
      if (!fluxoV2Ativo) payload.txt_status = equipStatus;

      if (editingEquipamento?._id) {
        await axios.patch(`/api/gestor/equipamentos/${editingEquipamento._id}`, payload);
      } else {
        await axios.post('/api/gestor/equipamentos', payload);
      }

      setIsEquipModalOpen(false);
      fetchData();
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } } };
      setErrorMsg(error.response?.data?.error || 'Erro ao salvar equipamento.');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Patient
  const handleSubmitPaciente = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg('');

    try {
      const payload = {
        txt_nome: patNome,
        txt_cpf: patCPF,
        txt_whatsapp: patWhatsapp,
        txt_endereco: patEndereco,
        txt_email: patEmail,
        txt_tipo: patTipo,
      };

      await axios.post('/api/gestor/pacientes', payload);

      setIsPatientModalOpen(false);
      setPatNome('');
      setPatCPF('');
      setPatWhatsapp('');
      setPatEndereco('');
      setPatEmail('');
      setPatTipo('Homecare');
      fetchData();
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } } };
      setErrorMsg(error.response?.data?.error || 'Erro ao cadastrar cliente.');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Rental
  const handleSubmitRental = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg('');

    try {
      const payload = {
        fk_equipamento: rentEquipId,
        fk_paciente: rentPatId,
        date_inicio: rentDataInicio,
        date_fim_previsto: rentDataFimPrevisto,
        num_valor_aluguel: Number(rentValor),
        os_tipo_cobranca: rentTipoCobranca,
        num_valor_diaria_contratada: rentTipoCobranca === 'Somente diária' ? Number(rentValor) : undefined,
        num_valor_mensal_contratado: rentTipoCobranca === 'Somente diária' ? undefined : Number(rentValor),
        txt_observacoes: rentObservacoes,
      };

      await axios.post('/api/gestor/locacoes', payload);

      setIsRentalModalOpen(false);
      fetchData();
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } } };
      setErrorMsg(error.response?.data?.error || 'Erro ao registrar locação.');
    } finally {
      setSubmitting(false);
    }
  };

  // Pre-fill Rental Value when Equipment is selected
  useEffect(() => {
    if (rentEquipId) {
      const selected = equipamentos.find((e) => e._id === rentEquipId);
      if (selected) {
        setRentValor(String(selected.num_preco_padrao));
      }
    }
  }, [rentEquipId, equipamentos]);

  // Open Return Rental Dialog
  const handleOpenReturnModal = (rental: LocacaoEquipamento) => {
    setSelectedRentalForReturn(rental);
    setReturnEquipStatus('Disponível');
    setIsReturnModalOpen(true);
  };

  // Finalize/Return Rental Submit
  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRentalForReturn?._id) return;
    setSubmitting(true);
    setErrorMsg('');

    try {
      await axios.patch(`/api/gestor/locacoes/${selectedRentalForReturn._id}`, {
        txt_status: 'Finalizado',
        date_fim_real: new Date().toISOString().split('T')[0],
        txt_status_equipamento: returnEquipStatus,
        fk_equipamento: selectedRentalForReturn.fk_equipamento,
      });

      setIsReturnModalOpen(false);
      setSelectedRentalForReturn(null);
      fetchData();
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } } };
      setErrorMsg(error.response?.data?.error || 'Erro ao finalizar devolução.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="text-slate-800 font-sans relative">
      {/* Header */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 relative">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Activity className="w-6 h-6 text-indigo-600 shrink-0" />
            Gestão de Equipamentos
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">
            Controle de inventário, clientes cadastrados e ciclos de locações médicas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportarInventario}
            className="bg-white hover:bg-slate-500/10 border border-slate-200 text-slate-700 px-3.5 py-2 rounded-lg text-xs font-semibold shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/25"
          >
            Exportar inventário
          </button>
          <button 
            onClick={handleExportarLocacoes} 
            className="bg-white hover:bg-slate-500/10 border border-slate-200 text-slate-700 px-3.5 py-2 rounded-lg text-xs font-semibold shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/25"
          >
            Exportar locações
          </button>
          <button
            onClick={fetchData}
            className="bg-white hover:bg-slate-500/10 border border-slate-200 text-slate-600 p-2 rounded-lg transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/25"
            title="Atualizar dados"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="max-w-7xl mx-auto grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8 relative">
        {[
          {
            label: 'Total de Ativos',
            val: totalEquips,
            detail: 'equipamentos cadastrados',
          },
          {
            label: 'Disponíveis',
            val: availableEquips,
            detail: 'em estoque e prontos',
          },
          {
            label: 'Implantados',
            val: rentedEquips,
            detail: 'em uso domiciliar',
          },
          {
            label: 'Em Manutenção / OS',
            val: maintenanceEquips,
            detail: 'em conserto ou limpeza',
          },
          {
            label: 'Faturamento Estimado',
            val: formatCurrency(estimatedRevenue),
            detail: 'mensalidade ativa total',
          },
        ].map((item, idx) => {
          return (
            <div
              key={idx}
              className="bg-white border border-slate-200 p-4 rounded-xl flex flex-col justify-between shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
            >
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{item.label}</span>
              <div className="mt-1">
                <span className="text-xl font-bold text-slate-900">{item.val}</span>
                <p className="text-[10px] text-slate-500 mt-0.5">{item.detail}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Backlog alerts */}
      <div className="max-w-7xl mx-auto bg-slate-50 border border-slate-200/80 rounded-xl p-4 mb-8 relative flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Info className="w-5 h-5 text-indigo-600 shrink-0 animate-pulse" />
          <div>
            <h4 className="text-xs uppercase font-bold text-slate-500 tracking-wider">Ações Operacionais Pendentes</h4>
            <p className="text-[11px] text-slate-500 mt-0.5">Fluxos que exigem atenção ou liberação no ciclo de vida atual.</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 text-xs font-semibold text-slate-700">
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200/60 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
            <span>Recolhimentos em Atraso: <span className="font-bold text-slate-950">{recolhimentosAtrasados.length}</span></span>
          </div>
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200/60 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
            <span>Aguardando Conferência: <span className="font-bold text-slate-950">{aguardandoConferencia.length}</span></span>
          </div>
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200/60 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></span>
            <span>Tratativa Técnica: <span className="font-bold text-slate-950">{aguardandoTratativaTecnica.length}</span></span>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {errorMsg && (
        <div className="max-w-7xl mx-auto mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-3 shadow-sm z-10 relative">
          <Info className="w-5 h-5 text-red-500 shrink-0" />
          <span className="text-sm font-medium">{errorMsg}</span>
        </div>
      )}

      {/* Navigation Tabs and Register Actions */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-slate-200 pb-px relative">
        <div className="flex gap-6">
          {[
            { id: 'locacoes', label: 'Locações Ativas' },
            { id: 'equipamentos', label: 'Catálogo de Equipamentos' },
            ...(fluxoV2Ativo ? [{ id: 'reservas', label: `Reservas${reservas.filter((r) => r.txt_status === 'Ativa').length ? ` (${reservas.filter((r) => r.txt_status === 'Ativa').length})` : ''}` }] : []),
            { id: 'pacientes', label: 'Cadastro de Clientes' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'locacoes' | 'equipamentos' | 'reservas' | 'pacientes')}
              className={`pb-3 text-xs font-bold transition-all relative focus:outline-none ${
                activeTab === tab.id
                  ? 'text-slate-950 border-b-2 border-indigo-600'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search bar & quick registers */}
        <div className="flex items-center gap-2 pb-2 md:pb-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder={
                activeTab === 'locacoes'
                  ? 'Buscar por cliente ou equipamento...'
                  : activeTab === 'equipamentos'
                  ? 'Buscar por nome, marca, nº série...'
                  : activeTab === 'reservas'
                  ? 'Buscar por cliente ou equipamento...'
                  : 'Buscar por nome ou CPF...'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100 rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none transition-all shadow-sm w-64"
            />
          </div>

          {activeTab === 'locacoes' && (
            <button
              onClick={handleOpenRentalModal}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/25"
            >
              <Plus className="w-3.5 h-3.5" />
              Nova Locação
            </button>
          )}

          {activeTab === 'equipamentos' && (
            <button
              onClick={() => handleOpenEquipModal(null)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/25"
            >
              <Plus className="w-3.5 h-3.5" />
              Cadastrar Equipamento
            </button>
          )}

          {activeTab === 'pacientes' && (
            <button
              onClick={() => setIsPatientModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/25"
            >
              <Plus className="w-3.5 h-3.5" />
              Cadastrar Cliente
            </button>
          )}
        </div>
      </div>

      {/* Main Tables Container */}
      <div className="max-w-7xl mx-auto bg-white border border-slate-200 rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.02)] z-10 relative overflow-hidden">
        {loading ? (
          <div className="p-20 flex flex-col items-center justify-center text-slate-500 gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
            <span className="text-xs font-medium">Carregando dados...</span>
          </div>
        ) : (
          <>
            {/* TAB 1: LOCAÇÕES */}
            {activeTab === 'locacoes' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-200/80 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
                      <th className="px-6 py-3.5">Cliente</th>
                      <th className="px-6 py-3.5">Equipamento</th>
                      <th className="px-6 py-3.5">Valor Estimado</th>
                      <th className="px-6 py-3.5">Início</th>
                      <th className="px-6 py-3.5">Fim Previsto</th>
                      <th className="px-6 py-3.5">Devolução</th>
                      <th className="px-6 py-3.5">Status</th>
                      <th className="px-6 py-3.5 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 text-xs">
                    {filteredLocacoes.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-12 text-slate-400">
                          Nenhuma locação encontrada.
                        </td>
                      </tr>
                    ) : (
                      filteredLocacoes.map((l) => {
                        const equip = equipamentos.find((e) => e._id === l.fk_equipamento);
                        const pac = pacientes.find((p) => p._id === l.fk_paciente);
                        return (
                          <tr key={l._id} className="hover:bg-slate-50/30 transition-colors">
                            <td className="px-6 py-4">
                              <div className="font-semibold text-slate-900">{pac?.txt_nome || 'Desconhecido'}</div>
                              <div className="text-[10px] text-slate-400">CPF: {pac?.txt_cpf || '-'}</div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="font-semibold text-slate-800">{equip?.txt_nome || 'N/A'}</div>
                              <div className="text-[10px] text-slate-400">S/N: {equip?.txt_numero_serie || '-'}</div>
                            </td>
                            <td className="px-6 py-4 font-semibold text-slate-900">
                              {formatCurrency(l.num_total_estimado ?? l.num_valor_aluguel)}
                            </td>
                            <td className="px-6 py-4 text-slate-500">{formatDate(l.date_inicio)}</td>
                            <td className="px-6 py-4 text-slate-500">{formatDate(l.date_fim_previsto)}</td>
                            <td className="px-6 py-4 text-slate-500">{formatDate(l.date_fim_real)}</td>
                            <td className="px-6 py-4">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                                  l.txt_status === 'Ativo'
                                    ? 'bg-green-500/10 text-green-700 border border-green-500/20'
                                    : l.txt_status === 'Finalizado'
                                    ? 'bg-slate-500/10 text-slate-600 border border-slate-500/20'
                                    : 'bg-red-500/10 text-red-700 border border-red-500/20'
                                }`}
                              >
                                {l.txt_status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              {l.txt_status === 'Ativo' && (
                                <button
                                  onClick={() => handleOpenReturnModal(l)}
                                  className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-indigo-600 hover:text-indigo-800 text-xs font-bold transition-all min-h-[32px] focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                >
                                  Devolver
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* TAB 2: EQUIPAMENTOS */}
            {activeTab === 'equipamentos' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-200/80 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
                      <th className="px-6 py-3.5">Equipamento</th>
                      <th className="px-6 py-3.5">Marca / Modelo</th>
                      <th className="px-6 py-3.5">Nº Série</th>
                      <th className="px-6 py-3.5">Preço Padrão</th>
                      <th className="px-6 py-3.5">Status</th>
                      <th className="px-6 py-3.5 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 text-xs">
                    {filteredEquipamentos.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-12 text-slate-400">
                          Nenhum equipamento cadastrado.
                        </td>
                      </tr>
                    ) : (
                      filteredEquipamentos.map((e) => (
                        <tr key={e._id} className="hover:bg-slate-50/30 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-semibold text-slate-900">{e.txt_nome}</div>
                            {e.txt_descricao && <div className="text-[10px] text-slate-400 truncate max-w-md">{e.txt_descricao}</div>}
                            {e.txt_codigo_interno && <div className="text-[9px] text-indigo-600 font-mono mt-0.5">{e.txt_codigo_interno}</div>}
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-medium text-slate-800">{e.txt_marca || '-'}</span>
                            {e.txt_modelo && <span className="text-slate-400 text-[10px] block">{e.txt_modelo}</span>}
                          </td>
                          <td className="px-6 py-4 text-slate-500 font-mono">{e.txt_numero_serie}</td>
                          <td className="px-6 py-4 font-semibold text-slate-900">
                            {formatCurrency(e.num_preco_padrao)}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                                e.txt_status === 'Disponível'
                                  ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/20'
                                  : e.txt_status === 'Alugado' || e.txt_status === 'Implantado no domicílio'
                                  ? 'bg-blue-500/10 text-blue-700 border border-blue-500/20'
                                  : e.txt_status === 'Manutenção'
                                  ? 'bg-amber-500/10 text-amber-700 border border-amber-500/20'
                                  : e.txt_status === 'Aguardando higienização' || e.txt_status === 'Em higienização'
                                  ? 'bg-teal-500/10 text-teal-700 border border-teal-500/20'
                                  : e.txt_status === 'Recolhido e aguardando conferência' || e.txt_status === 'Aguardando conferência'
                                  ? 'bg-purple-500/10 text-purple-700 border border-purple-500/20'
                                  : 'bg-slate-500/10 text-slate-600 border border-slate-500/20'
                              }`}
                            >
                              {e.txt_status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="inline-flex items-center gap-2">
                              {fluxoV2Ativo && e.txt_status === 'Aguardando higienização' && (
                                <button onClick={() => handleOpenHygiene(e)} className="inline-flex items-center justify-center px-2.5 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100/70 border border-teal-200 text-teal-700 hover:text-teal-900 text-xs font-bold transition-all min-h-[32px] focus:outline-none focus:ring-2 focus:ring-teal-500/20">Higienizar</button>
                              )}
                              {fluxoV2Ativo && ['Recolhido e aguardando conferência', 'Aguardando conferência'].includes(e.txt_status) && (
                                <button onClick={() => handleOpenInspection(e)} className="inline-flex items-center justify-center px-2.5 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100/70 border border-purple-200 text-purple-700 hover:text-purple-900 text-xs font-bold transition-all min-h-[32px] focus:outline-none focus:ring-2 focus:ring-purple-500/20">Conferir</button>
                              )}
                              {fluxoV2Ativo && e.txt_status === 'Disponível' && (
                                <button onClick={() => handleOpenReserve(e)} className="inline-flex items-center justify-center px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100/70 border border-blue-200 text-blue-700 hover:text-blue-900 text-xs font-bold transition-all min-h-[32px] focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                                  Reservar
                                </button>
                              )}
                              {fluxoV2Ativo && !['Baixado', 'Condenado', 'Extraviado'].includes(e.txt_status) && (
                                <button
                                  onClick={() => handleOpenMaintenance(e)}
                                  className="inline-flex items-center justify-center px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100/70 border border-amber-200 text-amber-700 hover:text-amber-900 text-xs font-bold transition-all min-h-[32px] gap-1 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                                >
                                  <Wrench className="w-3 h-3" />
                                  OS
                                </button>
                              )}
                              <button
                                onClick={() => handleOpenHistorico(e)}
                                className="inline-flex items-center justify-center px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-900 text-xs font-bold transition-all min-h-[32px] gap-1 focus:outline-none focus:ring-2 focus:ring-slate-500/20"
                              >
                                <FileText className="w-3 h-3" />
                                Histórico
                              </button>
                              <button
                                onClick={() => handleOpenEquipModal(e)}
                                className="inline-flex items-center justify-center px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-indigo-600 hover:text-indigo-800 text-xs font-bold transition-all min-h-[32px] gap-1 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                              >
                                <Edit3 className="w-3 h-3" />
                                Editar
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* TAB: RESERVAS */}
            {activeTab === 'reservas' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-200/80 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
                      <th className="px-6 py-3.5">Cliente</th>
                      <th className="px-6 py-3.5">Equipamento</th>
                      <th className="px-6 py-3.5">Reservado em</th>
                      <th className="px-6 py-3.5">Implantação prevista</th>
                      <th className="px-6 py-3.5">Validade</th>
                      <th className="px-6 py-3.5">Status</th>
                      <th className="px-6 py-3.5 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 text-xs">
                    {filteredReservas.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-16 text-slate-400">
                          <Calendar className="w-8 h-8 mx-auto mb-3 text-slate-300" />
                          <p className="font-semibold text-slate-500">Nenhuma reserva ativa.</p>
                          <p className="text-[11px] mt-1">Reserve um equipamento disponível no Catálogo para bloqueá-lo até a implantação.</p>
                        </td>
                      </tr>
                    ) : (
                      filteredReservas.map((r) => {
                        const equip = equipamentos.find((e) => e._id === r.fk_equipamento);
                        const pac = pacientes.find((p) => p._id === r.fk_paciente);
                        const dias = diasAteValidade(r.date_validade);
                        return (
                          <tr key={r._id} className="hover:bg-slate-50/30 transition-colors">
                            <td className="px-6 py-4">
                              <div className="font-semibold text-slate-900">{pac?.txt_nome || 'Desconhecido'}</div>
                              <div className="text-[10px] text-slate-400">CPF: {pac?.txt_cpf || '-'}</div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="font-semibold text-slate-800">{equip?.txt_nome || 'N/A'}</div>
                              <div className="text-[10px] text-slate-400">S/N: {equip?.txt_numero_serie || '-'}</div>
                            </td>
                            <td className="px-6 py-4 text-slate-500">{formatDate(r.date_reserva)}</td>
                            <td className="px-6 py-4 text-slate-500">{formatDate(r.date_implantacao_prevista)}</td>
                            <td className="px-6 py-4">
                              <div className="text-slate-700 font-medium">{formatDate(r.date_validade)}</div>
                              {dias !== null && (
                                <span
                                  className={`inline-flex items-center mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide ${
                                    dias < 0
                                      ? 'bg-rose-500/10 text-rose-700 border border-rose-500/20'
                                      : dias <= 3
                                      ? 'bg-amber-500/10 text-amber-700 border border-amber-500/20'
                                      : 'bg-slate-500/10 text-slate-600 border border-slate-500/20'
                                  }`}
                                >
                                  {dias < 0 ? `Vencida há ${Math.abs(dias)}d` : dias === 0 ? 'Vence hoje' : `Vence em ${dias}d`}
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-blue-500/10 text-blue-700 border border-blue-500/20">
                                {r.txt_status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button
                                onClick={() => {
                                  setReservaParaCancelar(r);
                                  setCancelReservaMotivo('');
                                  setErrorMsg('');
                                }}
                                className="text-rose-600 hover:text-rose-800 inline-flex items-center gap-1 text-xs font-bold hover:underline transition-colors"
                              >
                                <XCircle className="w-3 h-3" />
                                Cancelar
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* TAB 3: PACIENTES */}
            {activeTab === 'pacientes' && (
              <div>
                <div className="flex gap-1.5 p-3 border-b border-slate-100 bg-slate-50/50 flex-wrap">
                  {[
                    { id: 'todos', label: 'Todos' },
                    { id: 'homecare', label: 'Homecare' },
                    { id: 'hospital', label: 'Hospital' },
                    { id: 'com_equipamento', label: 'Com Equipamento Enviado' },
                  ].map((filter) => (
                    <button
                      key={filter.id}
                      onClick={() => setPatientFilter(filter.id)}
                      className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-all border ${
                        patientFilter === filter.id
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-200/80 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
                        <th className="px-6 py-3.5">Nome / Tipo</th>
                        <th className="px-6 py-3.5">Endereço de Entrega</th>
                        <th className="px-6 py-3.5">Equipamentos Enviados</th>
                        <th className="px-6 py-3.5">Contato</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700 text-xs">
                      {filteredPacientes.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="text-center py-12 text-slate-400">
                            Nenhum cliente encontrado.
                          </td>
                        </tr>
                      ) : (
                        filteredPacientes.map((p) => {
                          const activePatientRentals = locacoes.filter((l) => l.fk_paciente === p._id && l.txt_status === 'Ativo');
                          const activePatientEquipamentos = activePatientRentals
                            .map((locacao) => equipamentos.find((equipamento) => equipamento._id === locacao.fk_equipamento))
                            .filter((equipamento): equipamento is Equipamento => Boolean(equipamento));
                          const hasActiveRental = activePatientRentals.length > 0;
                          return (
                            <tr key={p._id} className="hover:bg-slate-50/30 transition-colors">
                              <td className="px-6 py-4">
                                <div className="font-semibold text-slate-900 flex items-center gap-2">
                                  {p.txt_nome}
                                  <span
                                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold border border-slate-200 uppercase tracking-wide ${
                                      p.txt_tipo === 'Hospital'
                                        ? 'bg-blue-500/10 text-blue-700 border-blue-500/20'
                                        : 'bg-green-500/10 text-green-700 border-green-500/20'
                                    }`}
                                  >
                                    {p.txt_tipo || 'Homecare'}
                                  </span>
                                  {hasActiveRental && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/10 text-amber-700 border border-amber-500/20 uppercase tracking-wide">
                                      Ativo
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 text-slate-500 max-w-sm truncate" title={p.txt_endereco}>
                                {p.txt_endereco}
                              </td>
                              <td className="px-6 py-4">
                                <div className="text-slate-500 space-y-1">
                                  {activePatientEquipamentos.length > 0 ? (
                                    activePatientEquipamentos.map((equipamento) => (
                                      <div key={equipamento._id} className="flex items-center gap-1.5">
                                        <span className="w-1 h-1 rounded-full bg-indigo-500 shrink-0"></span>
                                        <span className="font-medium text-slate-700">{equipamento.txt_nome}</span>
                                      </div>
                                    ))
                                  ) : (
                                    <span className="text-slate-400 font-normal italic">Nenhum</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                {p.txt_whatsapp && <div className="text-slate-600 font-medium">WhatsApp: {p.txt_whatsapp}</div>}
                                {p.txt_email && <div className="text-[10px] text-slate-400">{p.txt_email}</div>}
                                {!p.txt_whatsapp && !p.txt_email && <span className="text-slate-400">-</span>}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* MODAL HISTÓRICO / PRONTUÁRIO */}
      {historicoEquipamento && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-[2px] z-50 flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="historyModalTitle" className="bg-white rounded-xl max-w-2xl w-full max-h-[85vh] shadow-xl overflow-hidden border border-slate-200/80 flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 id="historyModalTitle" className="text-base font-bold text-slate-900">Prontuário do Equipamento</h2>
                <p className="text-[11px] text-slate-500 mt-0.5">{historicoEquipamento.txt_nome} {historicoEquipamento.txt_codigo_interno ? `• ${historicoEquipamento.txt_codigo_interno}` : ''}</p>
              </div>
              <button onClick={() => setHistoricoEquipamento(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-6">
              {fluxoV2Ativo && (
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[10px] uppercase tracking-wider font-bold text-slate-400 flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-indigo-500" /> Rentabilidade do ativo
                    </h3>
                    {rentabilidade && (
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide ${
                          rentabilidade.aquisicaoRecuperada
                            ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/20'
                            : 'bg-slate-500/10 text-slate-600 border border-slate-500/20'
                        }`}
                      >
                        {rentabilidade.aquisicaoRecuperada ? 'Aquisição recuperada' : 'Aquisição em recuperação'}
                      </span>
                    )}
                  </div>
                  {rentabilidadeLoading ? (
                    <div className="py-6 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-indigo-600" /></div>
                  ) : !rentabilidade ? (
                    <p className="text-[11px] text-slate-400 py-2">Indicadores financeiros indisponíveis para este ativo.</p>
                  ) : (
                    <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3">
                        {[
                          { label: 'Aquisição', val: formatCurrency(rentabilidade.valorAquisicao) },
                          { label: 'Receita realizada', val: formatCurrency(rentabilidade.receitaRealizada) },
                          { label: 'Receita em aberto', val: formatCurrency(rentabilidade.receitaEstimada) },
                          { label: 'Custo manutenção', val: formatCurrency(rentabilidade.custoManutencaoTotal) },
                        ].map((f) => (
                          <div key={f.label}>
                            <div className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">{f.label}</div>
                            <div className="text-sm font-bold text-slate-900 mt-0.5">{f.val}</div>
                          </div>
                        ))}
                        {[
                          { label: 'Resultado realizado', val: rentabilidade.resultadoRealizado },
                          { label: 'Resultado projetado', val: rentabilidade.resultadoProjetado },
                        ].map((f) => (
                          <div key={f.label}>
                            <div className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">{f.label}</div>
                            <div className={`text-sm font-bold mt-0.5 ${f.val < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>{formatCurrency(f.val)}</div>
                          </div>
                        ))}
                        <div>
                          <div className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Implantações</div>
                          <div className="text-sm font-bold text-slate-900 mt-0.5">{rentabilidade.quantidadeImplantacoes}</div>
                        </div>
                        <div>
                          <div className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Dias implantado</div>
                          <div className="text-sm font-bold text-slate-900 mt-0.5">{rentabilidade.diasImplantado}</div>
                        </div>
                      </div>
                      <div className="mt-4 pt-3 border-t border-slate-200/70">
                        <div className="flex justify-between items-center text-[10px] font-semibold text-slate-500 mb-1.5">
                          <span>Recuperação da aquisição</span>
                          <span className="text-slate-800 tabular-nums">{Math.round(rentabilidade.percentualRecuperacaoAquisicao)}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${rentabilidade.aquisicaoRecuperada ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                            style={{ width: `${Math.min(100, Math.max(0, rentabilidade.percentualRecuperacaoAquisicao))}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </section>
              )}
              {historicoLoading ? (
                <div className="py-12 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-indigo-600" /></div>
              ) : historicoEventos.length === 0 && historicoOrdens.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-10">Nenhuma movimentação registrada.</p>
              ) : (
                <>
                  {historicoOrdens.length > 0 && (
                    <section>
                      <h3 className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-3">Ordens de Serviço</h3>
                      <div className="space-y-2">
                        {historicoOrdens.map((ordem) => (
                          <div key={ordem._id} className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-xs">
                            <div className="flex justify-between gap-3"><span className="font-bold text-slate-800">{ordem.txt_numero_os || 'OS'}</span><span className="font-semibold text-amber-700">{ordem.txt_status}</span></div>
                            <p className="text-slate-600 mt-1">{ordem.txt_motivo}</p>
                            {ordem.txt_defeito_encontrado && <p className="text-slate-500 mt-0.5">Diagnóstico: {ordem.txt_defeito_encontrado}</p>}
                            <div className="flex justify-between text-slate-400 text-[10px] mt-2"><span>{formatDate(ordem.date_entrada)}</span><span>{ordem.num_custo_total !== undefined ? formatCurrency(ordem.num_custo_total) : 'Custo pendente'}</span></div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                  
                  <section>
                    <h3 className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-3">Linha do Tempo</h3>
                    <ol className="space-y-4 border-l-2 border-slate-100 ml-1.5 pl-4">
                      {historicoEventos.map((evento) => (
                        <li key={evento.id} className="relative">
                          <span className="absolute -left-[23px] top-1 w-2 h-2 rounded-full bg-indigo-500 border-2 border-white" />
                          <div className="flex justify-between gap-3">
                            <div>
                              <p className="font-bold text-xs text-slate-800">{evento.tipo}</p>
                              {(evento.statusAnterior || evento.statusNovo) && <p className="text-[10px] text-slate-500 mt-0.5">{evento.statusAnterior || '—'} → {evento.statusNovo || '—'}</p>}
                              {evento.observacoes && <p className="text-[11px] text-slate-600 mt-1 whitespace-pre-wrap bg-slate-50 p-2 rounded-md border border-slate-200/50">{evento.observacoes}</p>}
                              {evento.responsavel && <p className="text-[10px] text-slate-400 mt-1">Responsável: {evento.responsavel}</p>}
                            </div>
                            <time className="text-[10px] text-slate-400 whitespace-nowrap">{formatDate(evento.data)}</time>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </section>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CANCELAR RESERVA MODAL */}
      {reservaParaCancelar && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-[2px] z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-lg border border-slate-200/80 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Cancelar Reserva</h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {equipamentos.find((e) => e._id === reservaParaCancelar.fk_equipamento)?.txt_nome || 'Equipamento'}
                  {' • '}
                  {pacientes.find((p) => p._id === reservaParaCancelar.fk_paciente)?.txt_nome || 'Cliente'}
                </p>
              </div>
              <button onClick={() => setReservaParaCancelar(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmitCancelReserva} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Motivo do cancelamento *</label>
                <textarea
                  required
                  value={cancelReservaMotivo}
                  onChange={(event) => setCancelReservaMotivo(event.target.value)}
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all h-24 resize-none"
                  placeholder="Ex.: desistência do cliente, realocação para outro caso, reserva duplicada..."
                />
              </div>
              <p className="text-[11px] text-rose-700 bg-rose-50 border border-rose-100 rounded-lg p-3">
                Ao cancelar, a reserva é encerrada e o equipamento volta a <span className="font-bold">Disponível</span> no estoque, liberando-o para novas reservas e locações.
              </p>
              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button type="button" onClick={() => setReservaParaCancelar(null)} className="border border-slate-200 hover:bg-slate-50 px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 transition-all">Voltar</button>
                <button type="submit" disabled={submitting} className="bg-rose-600 hover:bg-rose-700 text-white px-5 py-2 rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all focus:outline-none focus:ring-2 focus:ring-rose-500/25">
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />} Confirmar cancelamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* HIGIENIZAR MODAL */}
      {isHygieneModalOpen && selectedForHygiene && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-[2px] z-50 flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="hygieneModalTitle" className="bg-white rounded-xl max-w-lg w-full shadow-lg border border-slate-200/80 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h2 id="hygieneModalTitle" className="text-base font-bold text-slate-900">Registrar Higienização</h2>
                <p className="text-[11px] text-slate-500 mt-0.5">{selectedForHygiene.txt_nome}</p>
              </div>
              <button onClick={() => setIsHygieneModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmitHygiene} className="p-6 space-y-4">
              <div>
                <label htmlFor="hygieneMethod" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Método *</label>
                <input id="hygieneMethod" required value={hygieneMethod} onChange={(event) => setHygieneMethod(event.target.value)} className="w-full bg-slate-50/50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all" placeholder="Ex.: Limpeza química e troca de filtro" />
              </div>
              <div>
                <label htmlFor="hygieneResult" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Resultado *</label>
                <textarea id="hygieneResult" required value={hygieneResult} onChange={(event) => setHygieneResult(event.target.value)} className="w-full bg-slate-50/50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all h-20 resize-none" placeholder="Descreva o resultado e eventuais observações..." />
              </div>
              <p className="text-[11px] text-teal-700 bg-teal-50 border border-teal-100/50 rounded-lg p-3">Ao aprovar, o equipamento retorna a disponível no estoque para novas reservas e locações.</p>
              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button type="button" onClick={() => setIsHygieneModalOpen(false)} className="border border-slate-200 hover:bg-slate-50 px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 transition-all">Cancelar</button>
                <button type="submit" disabled={submitting} className="bg-teal-600 hover:bg-teal-700 text-white px-5 py-2 rounded-lg text-xs font-bold shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-teal-500/25">{submitting ? 'Salvando...' : 'Concluir'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFERIR MODAL */}
      {isInspectionModalOpen && selectedForInspection && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-[2px] z-50 flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="inspectionModalTitle" className="bg-white rounded-xl max-w-lg w-full shadow-lg border border-slate-200/80 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h2 id="inspectionModalTitle" className="text-base font-bold text-slate-900">Conferência Pós-Recolhimento</h2>
                <p className="text-[11px] text-slate-500 mt-0.5">{selectedForInspection.txt_nome}</p>
              </div>
              <button onClick={() => setIsInspectionModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmitInspection} className="p-6 space-y-4">
              <div>
                <label htmlFor="inspectionResult" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Resultado *</label>
                <textarea id="inspectionResult" required value={inspectionResult} onChange={(event) => setInspectionResult(event.target.value)} className="w-full bg-slate-50/50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all h-24 resize-none" placeholder="Estado geral do ativo, integridade dos acessórios, avarias..." />
              </div>
              <div>
                <label htmlFor="inspectionDestination" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Encaminhar Para *</label>
                <select id="inspectionDestination" value={inspectionDestination} onChange={(event) => setInspectionDestination(event.target.value as StatusEquipamento)} className="w-full bg-slate-50/50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all">
                  <option value="Aguardando higienização">Aguardando higienização</option>
                  <option value="Manutenção">Manutenção</option>
                  <option value="Bloqueado">Bloqueado</option>
                </select>
              </div>
              <p className="text-[11px] text-purple-700 bg-purple-50 border border-purple-100/50 rounded-lg p-3">A conferência registra a integridade, mas não libera o ativo diretamente para o estoque de locação.</p>
              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button type="button" onClick={() => setIsInspectionModalOpen(false)} className="border border-slate-200 hover:bg-slate-50 px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 transition-all">Cancelar</button>
                <button type="submit" disabled={submitting} className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2 rounded-lg text-xs font-bold shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-purple-500/25">{submitting ? 'Salvando...' : 'Confirmar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESERVAR MODAL */}
      {isReserveModalOpen && selectedForReserve && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-[2px] z-50 flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="reserveModalTitle" className="bg-white rounded-xl max-w-lg w-full shadow-lg border border-slate-200/80 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 id="reserveModalTitle" className="text-base font-bold text-slate-900">Reservar Equipamento</h2>
                <p className="text-[11px] text-slate-500 mt-0.5">{selectedForReserve.txt_nome}</p>
              </div>
              <button onClick={() => setIsReserveModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmitReserve} className="p-6 space-y-4">
              <div>
                <label htmlFor="reservePatientId" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Cliente *</label>
                <select id="reservePatientId" required value={reservePatientId} onChange={(event) => setReservePatientId(event.target.value)} className="w-full bg-slate-50/50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all">
                  <option value="">Selecione o cliente...</option>
                  {pacientes.map((paciente) => <option key={paciente._id} value={paciente._id}>{paciente.txt_nome}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="reserveDate" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Implantação Prevista *</label>
                  <input id="reserveDate" required type="date" value={reserveDate} onChange={(event) => setReserveDate(event.target.value)} className="w-full bg-slate-50/50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all" />
                </div>
                <div>
                  <label htmlFor="reserveValidity" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Validade *</label>
                  <input id="reserveValidity" required type="date" value={reserveValidity} onChange={(event) => setReserveValidity(event.target.value)} className="w-full bg-slate-50/50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all" />
                </div>
              </div>
              <p className="text-[11px] text-blue-700 bg-blue-50 border border-blue-100/50 rounded-lg p-3">A reserva bloqueia este equipamento para novas implantações até que ela seja convertida, cancelada ou expire.</p>
              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button type="button" onClick={() => setIsReserveModalOpen(false)} className="border border-slate-200 hover:bg-slate-500/10 px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 transition-all">Cancelar</button>
                <button type="submit" disabled={submitting} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/25">
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />} Reservar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MANUTENÇÃO / OS MODAL */}
      {isMaintenanceModalOpen && selectedForMaintenance && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-[2px] z-50 flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="maintenanceModalTitle" className="bg-white rounded-xl max-w-lg w-full shadow-lg border border-slate-200/80 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 id="maintenanceModalTitle" className="text-base font-bold text-slate-900">Abrir Ordem de Serviço</h2>
                <p className="text-[11px] text-slate-500 mt-0.5">{selectedForMaintenance.txt_nome}</p>
              </div>
              <button onClick={() => setIsMaintenanceModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmitMaintenance} className="p-6 space-y-4">
              <div>
                <label htmlFor="maintenanceReason" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Motivo *</label>
                <select id="maintenanceReason" required value={maintenanceReason} onChange={(event) => setMaintenanceReason(event.target.value)} className="w-full bg-slate-50/50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all">
                  <option value="">Selecione o motivo...</option>
                  <option value="Defeito relatado">Defeito relatado</option>
                  <option value="Manutenção preventiva">Manutenção preventiva</option>
                  <option value="Calibração">Calibração</option>
                  <option value="Higienização técnica">Higienização técnica</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>
              <div>
                <label htmlFor="maintenanceDetails" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Defeito / Detalhes</label>
                <textarea id="maintenanceDetails" value={maintenanceDetails} onChange={(event) => setMaintenanceDetails(event.target.value)} className="w-full bg-slate-50/50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all h-24 resize-none" placeholder="Descreva o defeito apresentado, laudos iniciais ou serviço preventivo planejado..." />
              </div>
              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100/50 rounded-lg p-3">Ao abrir a ordem de serviço, o ativo passa a manutenção e fica bloqueado para novas locações.</p>
              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button type="button" onClick={() => setIsMaintenanceModalOpen(false)} className="border border-slate-200 hover:bg-slate-50 px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 transition-all">Cancelar</button>
                <button type="submit" disabled={submitting} className="bg-amber-600 hover:bg-amber-700 text-white px-5 py-2 rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all focus:outline-none focus:ring-2 focus:ring-amber-500/25">
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />} Abrir OS
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CADASTRAR/EDITAR EQUIPAMENTO MODAL */}
      {isEquipModalOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-[2px] z-50 flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="equipModalTitle" className="bg-white rounded-xl max-w-lg w-full shadow-lg border border-slate-200/80 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 id="equipModalTitle" className="text-base font-bold text-slate-900">
                {editingEquipamento ? 'Editar Equipamento' : 'Cadastrar Equipamento'}
              </h2>
              <button
                onClick={() => setIsEquipModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitEquipamento} className="p-6 space-y-4">
              <div>
                <label htmlFor="equipNome" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Nome do Equipamento *</label>
                <input
                  id="equipNome"
                  type="text"
                  required
                  value={equipNome}
                  onChange={(e) => setEquipNome(e.target.value)}
                  placeholder="Ex: Concentrador de Oxigênio 10L"
                  className="w-full bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none transition-all focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="equipMarca" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Marca / Fabricante</label>
                  <input
                    id="equipMarca"
                    type="text"
                    value={equipMarca}
                    onChange={(e) => setEquipMarca(e.target.value)}
                    className="w-full bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none transition-all"
                    placeholder="Ex: Philips"
                  />
                </div>
                <div>
                  <label htmlFor="equipModelo" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Modelo</label>
                  <input
                    id="equipModelo"
                    type="text"
                    value={equipModelo}
                    onChange={(e) => setEquipModelo(e.target.value)}
                    className="w-full bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none transition-all"
                    placeholder="Ex: EverFlo"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="equipSerie" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Nº Série / Patrimônio *</label>
                    <button
                      type="button"
                      onClick={() => setEquipSerie(generateSerialNumber(equipMarca, equipModelo))}
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 hover:underline transition-all"
                      title="Gerar número de série automático"
                    >
                      <Sparkles className="w-3 h-3 text-amber-500" />
                      Gerar S/N
                    </button>
                  </div>
                  <input
                    id="equipSerie"
                    type="text"
                    value={equipSerie}
                    onChange={(e) => setEquipSerie(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none font-mono"
                    placeholder="Ex: PHIL-EVER-1984"
                  />
                </div>
                <div>
                  <label htmlFor="equipPreco" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Preço Base Aluguel *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-semibold">R$</span>
                    <input
                      id="equipPreco"
                      type="number"
                      required
                      step="0.01"
                      value={equipPreco}
                      onChange={(e) => setEquipPreco(e.target.value)}
                      className="w-full bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-800 focus:outline-none transition-all"
                      placeholder="0,00"
                    />
                  </div>
                </div>
              </div>

              {editingEquipamento && (
                <div>
                  <label htmlFor="equipStatus" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Status</label>
                  {fluxoV2Ativo ? (
                    <div className="w-full bg-slate-100 border border-slate-200 rounded-lg p-3 text-sm text-slate-700 flex items-center justify-between gap-3">
                      <div>
                        <span className="font-semibold text-slate-900">{equipStatus}</span>
                        <p className="text-[10px] text-slate-500 mt-0.5">O status do ativo é governado por ações de movimentação.</p>
                      </div>
                      {['Recolhido e aguardando conferência', 'Aguardando conferência'].includes(equipStatus) && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsEquipModalOpen(false);
                            if (editingEquipamento) handleOpenInspection(editingEquipamento);
                          }}
                          className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-sm transition-all whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-purple-500/25"
                        >
                          Conferir Agora
                        </button>
                      )}
                    </div>
                  ) : (
                    <select
                      id="equipStatus"
                      value={equipStatus}
                      onChange={(e) => setEquipStatus(e.target.value as Equipamento['txt_status'])}
                      className="w-full bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none transition-all"
                    >
                      <option value="Disponível">Disponível</option>
                      <option value="Alugado">Alugado</option>
                      <option value="Manutenção">Manutenção</option>
                      <option value="Inativo">Inativo</option>
                    </select>
                  )}
                </div>
              )}

              <div>
                <label htmlFor="equipDescricao" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Descrição / Notas</label>
                <textarea
                  id="equipDescricao"
                  value={equipDescricao}
                  onChange={(e) => setEquipDescricao(e.target.value)}
                  className="w-full bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none h-20 resize-none transition-all"
                  placeholder="Detalhes sobre acessórios, estado físico..."
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEquipModalOpen(false)}
                  className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-xs font-semibold transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/25"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CADASTRAR PACIENTE MODAL */}
      {isPatientModalOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-[2px] z-50 flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="patientModalTitle" className="bg-white rounded-xl max-w-lg w-full shadow-lg border border-slate-200/80 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 id="patientModalTitle" className="text-base font-bold text-slate-900">Cadastrar Cliente</h2>
              <button
                onClick={() => setIsPatientModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitPaciente} className="p-6 space-y-4">
              <div>
                <label htmlFor="patNome" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Nome Completo *</label>
                <input
                  id="patNome"
                  type="text"
                  required
                  value={patNome}
                  onChange={(e) => setPatNome(e.target.value)}
                  placeholder="Nome do cliente..."
                  className="w-full bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="patCPF" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">CPF *</label>
                  <input
                    id="patCPF"
                    type="text"
                    required
                    value={patCPF}
                    onChange={(e) => setPatCPF(e.target.value)}
                    placeholder="Ex: 000.000.000-00"
                    className="w-full bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none transition-all"
                  />
                </div>
                <div>
                  <label htmlFor="patWhatsapp" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">WhatsApp / Tel *</label>
                  <input
                    id="patWhatsapp"
                    type="text"
                    required
                    value={patWhatsapp}
                    onChange={(e) => setPatWhatsapp(e.target.value)}
                    placeholder="Ex: (00) 90000-0000"
                    className="w-full bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="patEmail" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">E-mail (Opcional)</label>
                <input
                  id="patEmail"
                  type="email"
                  value={patEmail}
                  onChange={(e) => setPatEmail(e.target.value)}
                  placeholder="Ex: cliente@email.com"
                  className="w-full bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none transition-all"
                />
              </div>

              <div>
                <label htmlFor="patTipo" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Tipo de Cliente *</label>
                <select
                  id="patTipo"
                  value={patTipo}
                  onChange={(e) => setPatTipo(e.target.value as 'Homecare' | 'Hospital')}
                  className="w-full bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none transition-all"
                >
                  <option value="Homecare">Homecare</option>
                  <option value="Hospital">Hospital</option>
                </select>
              </div>

              <div>
                <label htmlFor="patEndereco" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Endereço Completo de Entrega *</label>
                <textarea
                  id="patEndereco"
                  required
                  value={patEndereco}
                  onChange={(e) => setPatEndereco(e.target.value)}
                  className="w-full bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none h-20 resize-none transition-all"
                  placeholder="Rua, número, complemento, bairro, cidade - UF..."
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsPatientModalOpen(false)}
                  className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-xs font-semibold transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/25"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Cadastrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* NOVA LOCAÇÃO MODAL */}
      {isRentalModalOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-[2px] z-50 flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="rentalModalTitle" className="bg-white rounded-xl max-w-lg w-full shadow-lg border border-slate-200/80 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 id="rentalModalTitle" className="text-base font-bold text-slate-900">Registrar Nova Locação</h2>
              <button
                onClick={() => setIsRentalModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitRental} className="p-6 space-y-4">
              {errorMsg && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-3">
                  <Info className="w-5 h-5 text-red-500 shrink-0" />
                  <span className="text-xs font-medium">{errorMsg}</span>
                </div>
              )}
              <div>
                <label htmlFor="patientSearch" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Selecionar Cliente *</label>
                <div className="space-y-2">
                  <input
                    id="patientSearch"
                    type="text"
                    placeholder="🔍 Buscar cliente por nome..."
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    className="w-full bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none transition-all"
                  />
                  <select
                    required
                    aria-label="Cliente selecionado"
                    value={rentPatId}
                    onChange={(e) => setRentPatId(e.target.value)}
                    className="w-full bg-slate-50/50 border border-slate-200 focus:border-indigo-500 rounded-lg px-3 py-2.5 text-sm text-slate-800 focus:outline-none transition-all"
                  >
                    <option value="">Selecione o cliente...</option>
                    {pacientes
                      .filter((p) =>
                        p.txt_nome.toLowerCase().includes(patientSearch.toLowerCase())
                      )
                      .map((p) => (
                        <option key={p._id} value={p._id}>
                          {p.txt_nome}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="rentEquipId" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Equipamento Disponível *</label>
                <select
                  id="rentEquipId"
                  required
                  value={rentEquipId}
                  onChange={(e) => setRentEquipId(e.target.value)}
                  className="w-full bg-slate-50/50 border border-slate-200 focus:border-indigo-500 rounded-lg px-3 py-2.5 text-sm text-slate-800 focus:outline-none transition-all"
                >
                  <option value="">Selecione o equipamento...</option>
                  {equipamentos
                    .filter((e) => e.txt_status === 'Disponível')
                    .map((e) => (
                      <option key={e._id} value={e._id}>
                        {e.txt_nome} — S/N: {e.txt_numero_serie} ({formatCurrency(e.num_preco_padrao)})
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="rentDataInicio" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Data de Início *</label>
                  <input
                    id="rentDataInicio"
                    type="date"
                    required
                    value={rentDataInicio}
                    onChange={(e) => setRentDataInicio(e.target.value)}
                    className="w-full bg-slate-50/50 border border-slate-200 focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none transition-all"
                  />
                </div>
                <div>
                  <label htmlFor="rentDataFimPrevisto" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Fim Previsto *</label>
                  <input
                    id="rentDataFimPrevisto"
                    type="date"
                    required
                    value={rentDataFimPrevisto}
                    onChange={(e) => setRentDataFimPrevisto(e.target.value)}
                    className="w-full bg-slate-50/50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="rentTipoCobranca" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Regra de cobrança *</label>
                <select
                  id="rentTipoCobranca"
                  value={rentTipoCobranca}
                  onChange={(e) => setRentTipoCobranca(e.target.value as TipoCobrancaLocacao)}
                  className="w-full bg-slate-50/50 border border-slate-200 focus:border-indigo-500 rounded-lg px-3 py-2.5 text-sm text-slate-800 focus:outline-none transition-all"
                >
                  <option value="Somente diária">Somente diária</option>
                  <option value="Somente mensalidade">Somente mensalidade</option>
                  <option value="Mensalidade proporcional">Mensalidade proporcional</option>
                  <option value="Mensalidade fechada">Mensalidade fechada</option>
                  <option value="Valor personalizado">Valor personalizado</option>
                  <option value="Sem cobrança">Sem cobrança</option>
                </select>
              </div>

              <div>
                <label htmlFor="rentValor" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  {rentTipoCobranca === 'Somente diária' ? 'Valor da diária *' : rentTipoCobranca === 'Sem cobrança' ? 'Valor (sem cobrança)' : 'Valor contratado *'}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-semibold">R$</span>
                  <input
                    id="rentValor"
                    type="number"
                    required
                    step="0.01"
                    value={rentValor}
                    onChange={(e) => setRentValor(e.target.value)}
                    className="w-full bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-800 focus:outline-none transition-all"
                    placeholder="0,00"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="rentObservacoes" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Observações da Locação</label>
                <textarea
                  id="rentObservacoes"
                  value={rentObservacoes}
                  onChange={(e) => setRentObservacoes(e.target.value)}
                  className="w-full bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none h-20 resize-none transition-all"
                  placeholder="Observações ou termos de entrega adicionais..."
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsRentalModalOpen(false)}
                  className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-xs font-semibold transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/25"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Registrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DEVOLUÇÃO MODAL */}
      {isReturnModalOpen && selectedRentalForReturn && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-[2px] z-50 flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="returnModalTitle" className="bg-white rounded-xl max-w-md w-full shadow-lg border border-slate-200/80 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 id="returnModalTitle" className="text-base font-bold text-slate-900">Registrar Devolução</h2>
              <button
                onClick={() => {
                  setIsReturnModalOpen(false);
                  setSelectedRentalForReturn(null);
                }}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitReturn} className="p-6 space-y-4">
              <div className="bg-slate-50 border border-slate-200/60 p-4 rounded-xl text-xs space-y-1.5">
                <div className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Resumo da Locação</div>
                <div className="text-slate-800">
                  <span className="font-bold">Cliente:</span>{' '}
                  {pacientes.find((p) => p._id === selectedRentalForReturn.fk_paciente)?.txt_nome || 'N/A'}
                </div>
                <div className="text-slate-800">
                  <span className="font-bold">Equipamento:</span>{' '}
                  {equipamentos.find((e) => e._id === selectedRentalForReturn.fk_equipamento)?.txt_nome || 'N/A'}
                </div>
                <div className="text-slate-800">
                  <span className="font-bold">Preço Cobrado:</span>{' '}
                  {formatCurrency(selectedRentalForReturn.num_valor_aluguel)}
                </div>
              </div>

              <div>
                {fluxoV2Ativo ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    <p className="font-bold uppercase tracking-wider text-[10px]">Destino: Recolhido e aguardando conferência</p>
                    <p className="mt-1">O equipamento passará pelos processos obrigatórios de conferência, higienização e OS para voltar a ficar operacional.</p>
                  </div>
                ) : (
                  <>
                    <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Status de Destino do Equipamento
                    </span>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setReturnEquipStatus('Disponível')}
                        className={`flex items-center justify-center gap-2 p-3 rounded-lg border text-sm font-semibold transition-all ${
                          returnEquipStatus === 'Disponível'
                            ? 'bg-green-50 border-green-300 text-green-700 font-bold shadow-sm'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <CheckCircle className="w-4 h-4" />
                        Disponível
                      </button>
                      <button
                        type="button"
                        onClick={() => setReturnEquipStatus('Manutenção')}
                        className={`flex items-center justify-center gap-2 p-3 rounded-lg border text-sm font-semibold transition-all ${
                          returnEquipStatus === 'Manutenção'
                            ? 'bg-amber-50 border-amber-300 text-amber-700 font-bold shadow-sm'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <Wrench className="w-4 h-4" />
                        Manutenção
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2">
                      Defina se o equipamento retornará para estoque imediatamente ou necessita de reparo/higienização.
                    </p>
                  </>
                )}
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsReturnModalOpen(false);
                    setSelectedRentalForReturn(null);
                  }}
                  className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-xs font-semibold transition-all"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/25"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Confirmar Devolução
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
