'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import {
  User,
  MapPin,
  Briefcase,
  CreditCard,
  FileText,
  CheckCircle,
  Plus,
  Trash2,
  UploadCloud,
  ChevronRight,
  ChevronLeft,
  Loader2,
  FileCheck,
  Check,
  HelpCircle,
  X,
  RotateCcw,
  MessageCircle,
  Mail,
} from 'lucide-react';
import { isValidCPF } from '@/lib/cpf';
import { PROFISSOES_FORM } from '@/lib/profissoes';

// Form interfaces
interface Profession {
  name: string;
  council: string;
  registration: string;
  emissionDate: string;
  isPrincipal: boolean;
}

interface BankAccount {
  bank: string;
  agency: string;
  account: string;
  type: string;
}

// Chave única do progresso salvo. Mudar a versão invalida rascunhos antigos
// caso a estrutura do formulário mude de forma incompatível.
const PROGRESS_STORAGE_KEY = 'gc_adesao_progress_v1';
const PROGRESS_COOKIE = 'gc_adesao_step';

const SUPORTE_WHATSAPP = process.env.NEXT_PUBLIC_SUPORTE_WHATSAPP || '';
const SUPORTE_EMAIL = process.env.NEXT_PUBLIC_SUPORTE_EMAIL || '';

// Orientações exibidas no painel de ajuda, por etapa.
const HELP_BY_STEP: Record<number, { title: string; items: string[] }> = {
  1: {
    title: 'Dados Pessoais',
    items: [
      'Preencha seu nome completo exatamente como consta no seu documento de identidade.',
      'O CPF é usado para identificar seu cadastro — cada CPF só pode ter uma adesão.',
      'Use um e-mail que você acessa com frequência: o link de assinatura do termo será enviado para ele.',
      'O WhatsApp é o principal canal de contato da cooperativa com você.',
    ],
  },
  2: {
    title: 'Endereço',
    items: [
      'Digite o CEP e os campos de rua, bairro e cidade serão preenchidos automaticamente.',
      'Confira o número e complete com apartamento/bloco no campo Complemento, se houver.',
    ],
  },
  3: {
    title: 'Profissões',
    items: [
      'Adicione todas as profissões que você exerce, com o número de registro do conselho de classe (COREN, CRM etc.).',
      'Clique em "Adicionar" após preencher cada profissão — ela deve aparecer na lista antes de avançar.',
      'Marque como principal a profissão que você mais exerce na cooperativa.',
    ],
  },
  4: {
    title: 'Dados Bancários',
    items: [
      'Informe uma conta em seu nome para receber os repasses da cooperativa.',
      'Clique em "Adicionar" após preencher os dados — a conta deve aparecer na lista antes de avançar.',
    ],
  },
  5: {
    title: 'Documentos',
    items: [
      'Envie foto nítida (ou PDF) do seu RG ou CNH e de um comprovante de residência recente.',
      'Se tiver, envie também o comprovante de registro no conselho de classe.',
      'Formatos aceitos: PDF, JPEG e PNG, com até 10MB por arquivo.',
    ],
  },
  6: {
    title: 'Assinatura',
    items: [
      'Você será redirecionado para a ZapSign para assinar o Termo de Adesão eletronicamente.',
      'Se o link não abrir, verifique seu e-mail (inclusive a caixa de spam) — o link de assinatura também é enviado por lá.',
    ],
  },
};

export default function AdesaoPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [checkingCpf, setCheckingCpf] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [resumed, setResumed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Sign URL from ZapSign
  const [signUrl, setSignUrl] = useState('');

  // Step 1: Personal Data
  const [personalData, setPersonalData] = useState({
    nomeCompleto: '',
    cpf: '',
    email: '',
    whatsapp: '',
    telefoneReserva: '',
    rg: '',
    orgaoEmissor: '',
    orgaoUF: 'GO',
    dataNascimento: '',
    dataExpedicaoRG: '',
    sexo: 'Feminino',
    estadoCivil: 'Solteiro(a)',
    nomeMae: '',
    nomePai: '',
    grauEscolaridade: 'Superior Completo',
    racaCor: 'Branca',
    pis: '',
  });

  // Step 2: Address Data
  const [addressData, setAddressData] = useState({
    cep: '',
    rua: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: 'GO',
  });

  // Step 3: Professions list
  const [professions, setProfessions] = useState<Profession[]>([]);
  const [currentProf, setCurrentProf] = useState<Profession>({
    name: 'Enfermeiro (a)',
    council: 'COREN',
    registration: '',
    emissionDate: '',
    isPrincipal: true,
  });

  // Step 4: Bank Accounts list
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [currentBank, setCurrentBank] = useState<BankAccount>({
    bank: '341\tItaú Unibanco S.A.',
    agency: '',
    account: '',
    type: 'Conta Corrente',
  });

  // Step 5: Document Uploads
  const [uploadedFiles, setUploadedFiles] = useState<{ url: string; name: string }[]>([]);
  const [uploading, setUploading] = useState(false);

  // ── Retomada de progresso ────────────────────────────────────────────────
  // O rascunho completo fica no localStorage (cookies têm limite de ~4KB e
  // seriam enviados em toda requisição); um cookie leve guarda só a etapa,
  // permitindo que o servidor saiba que há um cadastro em andamento.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(PROGRESS_STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved && typeof saved === 'object' && saved.currentStep >= 1 && saved.currentStep <= 5) {
          if (saved.personalData) setPersonalData((prev) => ({ ...prev, ...saved.personalData }));
          if (saved.addressData) setAddressData((prev) => ({ ...prev, ...saved.addressData }));
          if (Array.isArray(saved.professions)) setProfessions(saved.professions);
          if (Array.isArray(saved.bankAccounts)) setBankAccounts(saved.bankAccounts);
          if (Array.isArray(saved.uploadedFiles)) setUploadedFiles(saved.uploadedFiles);
          setCurrentStep(saved.currentStep);
          setResumed(true);
        }
      }
    } catch (e) {
      console.warn('Não foi possível restaurar o progresso salvo:', e);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || currentStep >= 6) return;
    try {
      const snapshot = JSON.stringify({
        currentStep,
        personalData,
        addressData,
        professions,
        bankAccounts,
        uploadedFiles,
        savedAt: new Date().toISOString(),
      });
      window.localStorage.setItem(PROGRESS_STORAGE_KEY, snapshot);
      document.cookie = `${PROGRESS_COOKIE}=${currentStep}; path=/; max-age=604800; SameSite=Lax`;
    } catch (e) {
      console.warn('Não foi possível salvar o progresso:', e);
    }
  }, [hydrated, currentStep, personalData, addressData, professions, bankAccounts, uploadedFiles]);

  const clearProgress = () => {
    try {
      window.localStorage.removeItem(PROGRESS_STORAGE_KEY);
      document.cookie = `${PROGRESS_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
    } catch (e) {
      console.warn('Não foi possível limpar o progresso salvo:', e);
    }
  };

  const restartForm = () => {
    if (!window.confirm('Tem certeza que deseja recomeçar? Todos os dados preenchidos serão apagados.')) return;
    clearProgress();
    window.location.reload();
  };

  // Auto-redirect to ZapSign signing page once we reach step 6 with a valid URL
  useEffect(() => {
    if (currentStep === 6 && signUrl) {
      const timer = setTimeout(() => {
        window.location.href = signUrl;
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [currentStep, signUrl]);

  // Mask Formatters
  const formatCPF = (val: string) => {
    const digits = val.replace(/\D/g, '');
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
      .substring(0, 14);
  };

  const formatPIS = (val: string) => {
    const digits = val.replace(/\D/g, '');
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{5})(\d)/, '$1.$2')
      .replace(/(\d{2})(\d{1})$/, '$1-$2')
      .substring(0, 14);
  };

  const formatPhone = (val: string) => {
    const digits = val.replace(/\D/g, '');
    return digits
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d{4})$/, '$1-$2')
      .substring(0, 15);
  };

  const formatCEP = (val: string) => {
    const digits = val.replace(/\D/g, '');
    return digits
      .replace(/(\d{5})(\d)/, '$1-$2')
      .substring(0, 9);
  };

  // Handle personal data input change with masks
  const handlePersonalChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    let formattedValue = value;

    if (name === 'cpf') formattedValue = formatCPF(value);
    if (name === 'pis') formattedValue = formatPIS(value);
    if (name === 'whatsapp' || name === 'telefoneReserva') formattedValue = formatPhone(value);

    setPersonalData(prev => ({ ...prev, [name]: formattedValue }));
  };

  // Handle address input change with masks
  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    let formattedValue = value;

    if (name === 'cep') {
      formattedValue = formatCEP(value);
      // Trigger ViaCEP lookup when CEP is fully typed
      const cleanCep = formattedValue.replace(/\D/g, '');
      if (cleanCep.length === 8) {
        fetchAddress(cleanCep);
      }
    }

    setAddressData(prev => ({ ...prev, [name]: formattedValue }));
  };

  // Fetch address from ViaCEP
  const fetchAddress = async (cep: string) => {
    try {
      setLoading(true);
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setAddressData(prev => ({
          ...prev,
          rua: data.logradouro || '',
          bairro: data.bairro || '',
          cidade: data.localidade || '',
          estado: data.uf || '',
        }));
      }
    } catch (error) {
      console.error('ViaCEP error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Add profession to list
  const addProfession = () => {
    if (!currentProf.registration) {
      alert('Por favor, informe o número de registro do conselho.');
      return;
    }
    // If setting as principal, change others to false
    let updatedProfs = [...professions];
    if (currentProf.isPrincipal) {
      updatedProfs = updatedProfs.map(p => ({ ...p, isPrincipal: false }));
    }
    setProfessions([...updatedProfs, currentProf]);
    setCurrentProf({
      name: 'Enfermeiro (a)',
      council: 'COREN',
      registration: '',
      emissionDate: '',
      isPrincipal: professions.length === 0, // default principal if first
    });
  };

  const removeProfession = (index: number) => {
    setProfessions(professions.filter((_, i) => i !== index));
  };

  // Add bank account to list
  const addBankAccount = () => {
    if (!currentBank.agency || !currentBank.account) {
      alert('Por favor, preencha todos os dados bancários.');
      return;
    }
    setBankAccounts([...bankAccounts, currentBank]);
    setCurrentBank({
      bank: '341\tItaú Unibanco S.A.',
      agency: '',
      account: '',
      type: 'Conta Corrente',
    });
  };

  const removeBankAccount = (index: number) => {
    setBankAccounts(bankAccounts.filter((_, i) => i !== index));
  };

  // File dropzone configuration
  const onDrop = async (acceptedFiles: File[]) => {
    setUploading(true);
    setErrorMsg('');
    try {
      for (const file of acceptedFiles) {
        const formData = new FormData();
        formData.append('file', file);

        const res = await axios.post('/api/cooperado/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        if (res.data.success) {
          setUploadedFiles(prev => [...prev, { url: res.data.url, name: res.data.name }]);
        }
      }
    } catch (err) {
      const error = err as { message?: string };
      console.error(error);
      setErrorMsg('Falha ao enviar arquivo. Tente novamente.');
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles(uploadedFiles.filter((_, i) => i !== index));
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png'],
      'application/pdf': ['.pdf'],
    },
  });

  // Next / Prev step navigation
  const nextStep = async () => {
    // Basic validation per step
    if (currentStep === 1) {
      if (!personalData.nomeCompleto || !personalData.cpf || !personalData.email || !personalData.whatsapp) {
        alert('Por favor, preencha todos os campos obrigatórios (*).');
        return;
      }
      if (!isValidCPF(personalData.cpf)) {
        setErrorMsg('CPF inválido. Confira os números digitados.');
        return;
      }
      // Verifica cadastro existente logo na primeira etapa
      setCheckingCpf(true);
      setErrorMsg('');
      setInfoMsg('');
      try {
        const res = await axios.get('/api/cooperado/verificar-cpf', {
          params: { cpf: personalData.cpf.replace(/\D/g, '') },
        });
        if (res.data.exists) {
          const pendente = res.data.termoStatus === 'Aguardando Assinatura' && !res.data.bloqueado;
          if (!pendente) {
            setErrorMsg('Este CPF já possui cadastro na cooperativa. Se precisar atualizar seus dados, fale com a cooperativa pelo botão de Ajuda.');
            return;
          }
          // Cadastro anterior parou antes da assinatura: deixa continuar —
          // ao finalizar, o servidor retoma o mesmo registro e gera novo link.
          setInfoMsg('Encontramos um cadastro seu com a assinatura do termo pendente. Pode continuar normalmente: ao finalizar, seus dados serão atualizados e um novo link de assinatura será gerado.');
        }
      } catch (e) {
        // Falha na consulta não bloqueia: o envio final repete a verificação no servidor.
        console.warn('Falha ao verificar CPF, seguindo em frente:', e);
      } finally {
        setCheckingCpf(false);
      }
      setErrorMsg('');
    }
    if (currentStep === 2) {
      if (!addressData.cep || !addressData.rua || !addressData.numero || !addressData.cidade) {
        alert('Por favor, preencha os dados do endereço.');
        return;
      }
    }
    if (currentStep === 3 && professions.length === 0) {
      alert('Adicione pelo menos uma profissão antes de avançar.');
      return;
    }
    if (currentStep === 4 && bankAccounts.length === 0) {
      alert('Adicione pelo menos uma conta bancária antes de avançar.');
      return;
    }
    if (currentStep === 5 && uploadedFiles.length === 0) {
      alert('Por favor, envie pelo menos um documento de identificação para continuar.');
      return;
    }

    if (currentStep === 5) {
      // Final submit step, submit data to API and move to step 6 (iframe signing)
      submitAllData();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => prev - 1);
  };

  // Submit all data to BFF and get ZapSign URL
  const submitAllData = async () => {
    setSubmitting(true);
    setErrorMsg('');
    try {
      const payload = {
        personalData,
        addressData,
        professions,
        bankAccounts,
        uploadedFiles: uploadedFiles.map(f => f.url),
      };

      const res = await axios.post('/api/cooperado/adesao', payload);

      if (res.data.success) {
        clearProgress();
        setSignUrl(res.data.signUrl);
        setCurrentStep(6);
        if (res.data.signUrl) {
          setTimeout(() => {
            window.location.href = res.data.signUrl;
          }, 1500);
        }
      }
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      console.error(error);
      setErrorMsg(error.response?.data?.error || 'Erro ao realizar o cadastro. Entre em contato com a cooperativa.');
    } finally {
      setSubmitting(false);
    }
  };

  // Render step icons/indicators
  const steps = [
    { num: 1, label: 'Dados Pessoais', icon: User },
    { num: 2, label: 'Endereço', icon: MapPin },
    { num: 3, label: 'Profissões', icon: Briefcase },
    { num: 4, label: 'Dados Bancários', icon: CreditCard },
    { num: 5, label: 'Documentos', icon: FileText },
    { num: 6, label: 'Assinatura', icon: FileCheck },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-between py-10 px-4 md:px-8 font-sans">
      <div className="max-w-5xl w-full mx-auto bg-white border border-slate-200 rounded-2xl shadow-lg overflow-hidden flex flex-col">

        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-50/30 via-slate-50/80 to-indigo-50/30 px-8 py-6 border-b border-slate-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-indigo-600 font-bold uppercase tracking-wider text-xs">Adesão de Cooperado</span>
              <h1 className="text-2xl font-extrabold text-slate-900 mt-1">Ficha de Inscrição & Adesão</h1>
            </div>
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-slate-200 self-start md:self-center shadow-sm">
              <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse"></span>
              <span className="text-xs font-semibold text-slate-600">Canal de Cadastro Seguro</span>
            </div>
          </div>

          {/* Stepper Progress */}
          <div className="mt-8 flex justify-between items-center relative">
            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-200 -translate-y-1/2 z-0" />
            <div
              className="absolute top-1/2 left-0 h-0.5 bg-indigo-600 -translate-y-1/2 z-0 transition-all duration-300"
              style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
            />
            {steps.map((st) => {
              const Icon = st.icon;
              const isCompleted = st.num < currentStep;
              const isActive = st.num === currentStep;

              return (
                <div key={st.num} className="flex flex-col items-center z-10">
                  <div
                    className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center border transition-all duration-300 ${isCompleted
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : isActive
                          ? 'bg-indigo-50 border-indigo-500 text-indigo-700 ring-4 ring-indigo-500/10'
                          : 'bg-slate-100 border-slate-200 text-slate-500'
                      }`}
                  >
                    {isCompleted ? <Check className="w-4 h-4 md:w-5 md:h-5" /> : <Icon className="w-4 h-4 md:w-5 md:h-5" />}
                  </div>
                  <span className={`text-[10px] font-bold mt-2 hidden sm:block uppercase tracking-wider ${isActive ? 'text-indigo-600' : isCompleted ? 'text-slate-600' : 'text-slate-500'
                    }`}>
                    {st.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Form Body with slide transitions */}
        <div className="p-6 md:p-10 flex-1 relative min-h-[450px]">
          {resumed && currentStep < 6 && (
            <div className="mb-6 p-4 bg-indigo-50 border border-indigo-200 text-indigo-800 rounded-lg text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0 text-indigo-600" />
                <span>Continuamos de onde você parou. Seus dados preenchidos anteriormente foram recuperados.</span>
              </div>
              <button
                type="button"
                onClick={restartForm}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 hover:text-indigo-900 underline underline-offset-2 self-start sm:self-center shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Recomeçar do zero
              </button>
            </div>
          )}

          {infoMsg && currentStep < 6 && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-sm flex items-center gap-2">
              <span className="w-2 h-2 bg-amber-500 rounded-full shrink-0"></span>
              {infoMsg}
            </div>
          )}

          {errorMsg && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full"></span>
              {errorMsg}
            </div>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ x: 30, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -30, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >

              {/* STEP 1: Personal Data */}
              {currentStep === 1 && (
                <div>
                  <h2 className="text-xl font-bold text-slate-850 mb-6 flex items-center gap-2">
                    <User className="w-6 h-6 text-indigo-600" />
                    Dados Pessoais
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-slate-550 uppercase tracking-wider mb-2">Nome Completo *</label>
                      <input
                        type="text"
                        name="nomeCompleto"
                        value={personalData.nomeCompleto}
                        onChange={handlePersonalChange}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-4 py-3 text-slate-800 placeholder-slate-400 focus:outline-none transition-all shadow-sm"
                        placeholder="Nome completo do cooperado"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-550 uppercase tracking-wider mb-2">CPF *</label>
                      <input
                        type="text"
                        name="cpf"
                        value={personalData.cpf}
                        onChange={handlePersonalChange}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-4 py-3 text-slate-800 placeholder-slate-400 focus:outline-none transition-all font-mono shadow-sm"
                        placeholder="000.000.000-00"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-550 uppercase tracking-wider mb-2">E-mail *</label>
                      <input
                        type="email"
                        name="email"
                        value={personalData.email}
                        onChange={handlePersonalChange}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-4 py-3 text-slate-800 placeholder-slate-400 focus:outline-none transition-all shadow-sm"
                        placeholder="seuemail@exemplo.com"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-550 uppercase tracking-wider mb-2">WhatsApp / Celular *</label>
                      <input
                        type="text"
                        name="whatsapp"
                        value={personalData.whatsapp}
                        onChange={handlePersonalChange}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-4 py-3 text-slate-800 placeholder-slate-400 focus:outline-none transition-all font-mono shadow-sm"
                        placeholder="(00) 00000-0000"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-550 uppercase tracking-wider mb-2">Telefone Alternativo</label>
                      <input
                        type="text"
                        name="telefoneReserva"
                        value={personalData.telefoneReserva}
                        onChange={handlePersonalChange}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-4 py-3 text-slate-800 placeholder-slate-400 focus:outline-none transition-all font-mono shadow-sm"
                        placeholder="(00) 00000-0000"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-550 uppercase tracking-wider mb-2">RG</label>
                      <input
                        type="text"
                        name="rg"
                        value={personalData.rg}
                        onChange={handlePersonalChange}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-4 py-3 text-slate-800 placeholder-slate-400 focus:outline-none transition-all shadow-sm"
                        placeholder="Apenas números"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-550 uppercase tracking-wider mb-2">Órgão Emissor / UF</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          name="orgaoEmissor"
                          value={personalData.orgaoEmissor}
                          onChange={handlePersonalChange}
                          className="flex-1 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-4 py-3 text-slate-800 placeholder-slate-400 focus:outline-none transition-all shadow-sm"
                          placeholder="Ex: SSP"
                        />
                        <select
                          name="orgaoUF"
                          value={personalData.orgaoUF}
                          onChange={handlePersonalChange}
                          className="w-24 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-3 text-slate-800 focus:outline-none shadow-sm"
                        >
                          {['GO', 'DF', 'SP', 'RJ', 'MG', 'BA', 'PR', 'RS', 'SC', 'TO', 'MT', 'MS'].map(uf => (
                            <option key={uf} value={uf}>{uf}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-550 uppercase tracking-wider mb-2">Data de Expedição RG</label>
                      <input
                        type="date"
                        name="dataExpedicaoRG"
                        value={personalData.dataExpedicaoRG}
                        onChange={handlePersonalChange}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-4 py-3 text-slate-800 placeholder-slate-400 focus:outline-none transition-all font-mono shadow-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-550 uppercase tracking-wider mb-2">Data de Nascimento</label>
                      <input
                        type="date"
                        name="dataNascimento"
                        value={personalData.dataNascimento}
                        onChange={handlePersonalChange}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-4 py-3 text-slate-800 placeholder-slate-400 focus:outline-none transition-all font-mono shadow-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-550 uppercase tracking-wider mb-2">Sexo</label>
                      <select
                        name="sexo"
                        value={personalData.sexo}
                        onChange={handlePersonalChange}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-4 py-3 text-slate-800 focus:outline-none shadow-sm"
                      >
                        <option value="Feminino">Feminino</option>
                        <option value="Masculino">Masculino</option>
                        <option value="Outro">Outro / Não Informar</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-550 uppercase tracking-wider mb-2">Estado Civil</label>
                      <select
                        name="estadoCivil"
                        value={personalData.estadoCivil}
                        onChange={handlePersonalChange}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-4 py-3 text-slate-800 focus:outline-none shadow-sm"
                      >
                        <option value="Solteiro(a)">Solteiro(a)</option>
                        <option value="Casado(a)">Casado(a)</option>
                        <option value="Divorciado(a)">Divorciado(a)</option>
                        <option value="Viúvo(a)">Viúvo(a)</option>
                        <option value="União Estável">União Estável</option>
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-slate-550 uppercase tracking-wider mb-2">Nome da Mãe *</label>
                      <input
                        type="text"
                        name="nomeMae"
                        value={personalData.nomeMae}
                        onChange={handlePersonalChange}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-4 py-3 text-slate-800 placeholder-slate-400 focus:outline-none transition-all shadow-sm"
                        placeholder="Nome completo da mãe"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-550 uppercase tracking-wider mb-2">Nome do Pai</label>
                      <input
                        type="text"
                        name="nomePai"
                        value={personalData.nomePai}
                        onChange={handlePersonalChange}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-4 py-3 text-slate-800 placeholder-slate-400 focus:outline-none transition-all shadow-sm"
                        placeholder="Nome completo do pai (opcional)"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-550 uppercase tracking-wider mb-2">Grau de Escolaridade</label>
                      <select
                        name="grauEscolaridade"
                        value={personalData.grauEscolaridade}
                        onChange={handlePersonalChange}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-4 py-3 text-slate-800 focus:outline-none shadow-sm"
                      >
                        <option value="Ensino Médio">Ensino Médio</option>
                        <option value="Técnico Completo">Técnico Completo</option>
                        <option value="Superior Incompleto">Superior Incompleto</option>
                        <option value="Superior Completo">Superior Completo</option>
                        <option value="Pós-Graduação / Especialização">Pós-Graduação / Especialização</option>
                        <option value="Mestrado / Doutorado">Mestrado / Doutorado</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-550 uppercase tracking-wider mb-2">Raça / Cor</label>
                      <select
                        name="racaCor"
                        value={personalData.racaCor}
                        onChange={handlePersonalChange}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-4 py-3 text-slate-800 focus:outline-none shadow-sm"
                      >
                        <option value="Branca">Branca</option>
                        <option value="Preta">Preta</option>
                        <option value="Parda">Parda</option>
                        <option value="Amarela">Amarela</option>
                        <option value="Indígena">Indígena</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-550 uppercase tracking-wider mb-2">PIS (Com Máscara) *</label>
                      <input
                        type="text"
                        name="pis"
                        value={personalData.pis}
                        onChange={handlePersonalChange}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-4 py-3 text-slate-800 placeholder-slate-400 focus:outline-none transition-all font-mono shadow-sm"
                        placeholder="000.00000.00-0"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: Address Data */}
              {currentStep === 2 && (
                <div>
                  <h2 className="text-xl font-bold text-slate-850 mb-6 flex items-center gap-2">
                    <MapPin className="w-6 h-6 text-indigo-600" />
                    Endereço Residencial
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div>
                      <label className="block text-xs font-bold text-slate-550 uppercase tracking-wider mb-2">CEP *</label>
                      <div className="relative">
                        <input
                          type="text"
                          name="cep"
                          value={addressData.cep}
                          onChange={handleAddressChange}
                          className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-4 py-3 text-slate-800 placeholder-slate-400 focus:outline-none transition-all font-mono shadow-sm"
                          placeholder="00000-000"
                        />
                        {loading && (
                          <Loader2 className="w-4 h-4 animate-spin text-indigo-600 absolute right-3 top-1/2 -translate-y-1/2" />
                        )}
                      </div>
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-xs font-bold text-slate-550 uppercase tracking-wider mb-2">Logradouro / Rua *</label>
                      <input
                        type="text"
                        name="rua"
                        value={addressData.rua}
                        onChange={handleAddressChange}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-4 py-3 text-slate-800 placeholder-slate-400 focus:outline-none transition-all shadow-sm"
                        placeholder="Avenida, Rua, Travessa..."
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-550 uppercase tracking-wider mb-2">Número *</label>
                      <input
                        type="text"
                        name="numero"
                        value={addressData.numero}
                        onChange={handleAddressChange}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-4 py-3 text-slate-800 placeholder-slate-400 focus:outline-none transition-all shadow-sm"
                        placeholder="Ex: 120"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-550 uppercase tracking-wider mb-2">Complemento</label>
                      <input
                        type="text"
                        name="complemento"
                        value={addressData.complemento}
                        onChange={handleAddressChange}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-4 py-3 text-slate-800 placeholder-slate-400 focus:outline-none transition-all shadow-sm"
                        placeholder="Apto, Sala, Quadra..."
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-slate-550 uppercase tracking-wider mb-2">Bairro *</label>
                      <input
                        type="text"
                        name="bairro"
                        value={addressData.bairro}
                        onChange={handleAddressChange}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-4 py-3 text-slate-800 placeholder-slate-400 focus:outline-none transition-all shadow-sm"
                        placeholder="Bairro"
                      />
                    </div>

                    <div className="md:col-span-3">
                      <label className="block text-xs font-bold text-slate-550 uppercase tracking-wider mb-2">Cidade *</label>
                      <input
                        type="text"
                        name="cidade"
                        value={addressData.cidade}
                        onChange={handleAddressChange}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-4 py-3 text-slate-800 placeholder-slate-400 focus:outline-none transition-all shadow-sm"
                        placeholder="Cidade"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-550 uppercase tracking-wider mb-2">Estado (UF)</label>
                      <select
                        name="estado"
                        value={addressData.estado}
                        onChange={handleAddressChange}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-4 py-3 text-slate-800 focus:outline-none shadow-sm"
                      >
                        {['GO', 'DF', 'SP', 'RJ', 'MG', 'BA', 'PR', 'RS', 'SC', 'TO', 'MT', 'MS', 'PE', 'CE'].map(uf => (
                          <option key={uf} value={uf}>{uf}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: Professions */}
              {currentStep === 3 && (
                <div>
                  <h2 className="text-xl font-bold text-slate-850 mb-4 flex items-center gap-2">
                    <Briefcase className="w-6 h-6 text-indigo-600" />
                    Atuação Profissional
                  </h2>
                  <p className="text-sm text-slate-550 mb-6">Cadastre uma ou mais profissões pelas quais atuará na cooperativa. Indique qual é a principal.</p>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Left: Input Form */}
                    <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-4">
                      <h3 className="font-bold text-slate-800 text-sm mb-2">+ Adicionar Profissão</h3>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-550 uppercase tracking-wider mb-1">Profissão</label>
                        <select
                          value={currentProf.name}
                          onChange={(e) => setCurrentProf(prev => ({ ...prev, name: e.target.value }))}
                          className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-lg px-3 py-2.5 text-slate-800 text-sm focus:outline-none shadow-sm"
                        >
                          {PROFISSOES_FORM.map((p) => (
                            <option key={p.value} value={p.value}>{p.label}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-550 uppercase tracking-wider mb-1">Conselho de Classe (Ex: COREN, CRM)</label>
                        <input
                          type="text"
                          value={currentProf.council}
                          onChange={(e) => setCurrentProf(prev => ({ ...prev, council: e.target.value.toUpperCase() }))}
                          className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-lg px-3 py-2 text-slate-800 text-sm focus:outline-none shadow-sm"
                          placeholder="Ex: COREN"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-550 uppercase tracking-wider mb-1">Nº Registro</label>
                          <input
                            type="text"
                            value={currentProf.registration}
                            onChange={(e) => setCurrentProf(prev => ({ ...prev, registration: e.target.value }))}
                            className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-lg px-3 py-2 text-slate-800 text-sm focus:outline-none shadow-sm"
                            placeholder="123456"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-550 uppercase tracking-wider mb-1">Data Emissão</label>
                          <input
                            type="date"
                            value={currentProf.emissionDate}
                            onChange={(e) => setCurrentProf(prev => ({ ...prev, emissionDate: e.target.value }))}
                            className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-lg px-3 py-2 text-slate-800 text-sm focus:outline-none font-mono shadow-sm"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 my-2">
                        <input
                          type="checkbox"
                          id="prof_principal"
                          checked={currentProf.isPrincipal}
                          onChange={(e) => setCurrentProf(prev => ({ ...prev, isPrincipal: e.target.checked }))}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-50 border-slate-200"
                        />
                        <label htmlFor="prof_principal" className="text-xs font-semibold text-slate-700">Profissão Principal</label>
                      </div>

                      <button
                        type="button"
                        onClick={addProfession}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-slate-800 font-bold py-2 rounded-lg text-sm flex items-center justify-center gap-1 transition-all"
                      >
                        <Plus className="w-4 h-4" /> Salvar Profissão
                      </button>
                    </div>

                    {/* Right: Added Professions list */}
                    <div className="lg:col-span-2 flex flex-col gap-4">
                      <h3 className="font-bold text-slate-800 text-sm">Profissões Cadastradas ({professions.length})</h3>

                      {professions.length === 0 ? (
                        <div className="border border-dashed border-slate-800 rounded-xl p-8 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
                          <Briefcase className="w-10 h-10 text-slate-700" />
                          <p className="text-sm">Nenhuma profissão adicionada.</p>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3">
                          {professions.map((prof, idx) => (
                            <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-sm flex items-center justify-between gap-4">
                              <div className="flex items-start gap-3">
                                <div className="mt-1 bg-slate-100 p-2 rounded-lg">
                                  <Briefcase className="w-5 h-5 text-indigo-600" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-bold text-slate-800 text-sm">{prof.name}</h4>
                                    {prof.isPrincipal && (
                                      <span className="bg-indigo-950 text-indigo-600 border border-indigo-900 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full">
                                        Principal
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-550 mt-1">
                                    Conselho: {prof.council} • Registro: {prof.registration}
                                    {prof.emissionDate && ` • Emissão: ${new Date(prof.emissionDate).toLocaleDateString('pt-BR')}`}
                                  </p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeProfession(idx)}
                                className="text-red-500 hover:text-red-600 p-2 hover:bg-slate-100 rounded-lg transition-all"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                  </div>
                </div>
              )}

              {/* STEP 4: Bank Accounts */}
              {currentStep === 4 && (
                <div>
                  <h2 className="text-xl font-bold text-slate-850 mb-4 flex items-center gap-2">
                    <CreditCard className="w-6 h-6 text-indigo-600" />
                    Dados Bancários
                  </h2>
                  <p className="text-sm text-slate-550 mb-6">Cadastre as contas bancárias para recebimento de repasses. Você pode adicionar mais de uma.</p>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Left: Input Form */}
                    <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-4">
                      <h3 className="font-bold text-slate-800 text-sm mb-2">+ Adicionar Conta</h3>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-550 uppercase tracking-wider mb-1">Banco</label>
                        <select
                          value={currentBank.bank}
                          onChange={(e) => setCurrentBank(prev => ({ ...prev, bank: e.target.value }))}
                          className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-lg px-3 py-2.5 text-slate-800 text-sm focus:outline-none shadow-sm"
                        >
                          <option value="341\tItaú Unibanco S.A.">Itaú Unibanco</option>
                          <option value="001\tBanco do Brasil S.A.">Banco do Brasil</option>
                          <option value="237\tBanco Bradesco S.A.">Bradesco</option>
                          <option value="033\tBanco Santander (Brasil) S.A.">Santander</option>
                          <option value="104\tCaixa Econômica Federal">Caixa Econômica</option>
                          <option value="077\tBanco Inter S.A.">Banco Inter</option>
                          <option value="260\tNu Pagamentos S.A. (Nubank)">Nubank</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-550 uppercase tracking-wider mb-1">Agência</label>
                          <input
                            type="text"
                            value={currentBank.agency}
                            onChange={(e) => setCurrentBank(prev => ({ ...prev, agency: e.target.value }))}
                            className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-lg px-3 py-2 text-slate-800 text-sm focus:outline-none shadow-sm"
                            placeholder="1234-5"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-550 uppercase tracking-wider mb-1">Conta & Dígito</label>
                          <input
                            type="text"
                            value={currentBank.account}
                            onChange={(e) => setCurrentBank(prev => ({ ...prev, account: e.target.value }))}
                            className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-lg px-3 py-2 text-slate-800 text-sm focus:outline-none shadow-sm"
                            placeholder="123456-7"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-550 uppercase tracking-wider mb-1">Tipo de Conta</label>
                        <select
                          value={currentBank.type}
                          onChange={(e) => setCurrentBank(prev => ({ ...prev, type: e.target.value }))}
                          className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-lg px-3 py-2.5 text-slate-800 text-sm focus:outline-none shadow-sm"
                        >
                          <option value="Conta Corrente">Conta Corrente</option>
                          <option value="Conta Poupança">Conta Poupança</option>
                        </select>
                      </div>

                      <button
                        type="button"
                        onClick={addBankAccount}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-slate-800 font-bold py-2 rounded-lg text-sm flex items-center justify-center gap-1 transition-all mt-2"
                      >
                        <Plus className="w-4 h-4" /> Salvar Conta
                      </button>
                    </div>

                    {/* Right: Added Bank Accounts list */}
                    <div className="lg:col-span-2 flex flex-col gap-4">
                      <h3 className="font-bold text-slate-800 text-sm">Contas Cadastradas ({bankAccounts.length})</h3>

                      {bankAccounts.length === 0 ? (
                        <div className="border border-dashed border-slate-800 rounded-xl p-8 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
                          <CreditCard className="w-10 h-10 text-slate-700" />
                          <p className="text-sm">Nenhuma conta cadastrada.</p>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3">
                          {bankAccounts.map((bank, idx) => (
                            <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-sm flex items-center justify-between gap-4">
                              <div className="flex items-start gap-3">
                                <div className="mt-1 bg-slate-100 p-2 rounded-lg">
                                  <CreditCard className="w-5 h-5 text-indigo-600" />
                                </div>
                                <div>
                                  <h4 className="font-bold text-slate-800 text-sm">{bank.bank.split('\t')[1] || bank.bank}</h4>
                                  <p className="text-xs text-slate-550 mt-1">
                                    Agência: {bank.agency} • Conta: {bank.account} • {bank.type}
                                  </p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeBankAccount(idx)}
                                className="text-red-500 hover:text-red-600 p-2 hover:bg-slate-100 rounded-lg transition-all"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                  </div>
                </div>
              )}

              {/* STEP 5: Document Uploads */}
              {currentStep === 5 && (
                <div>
                  <h2 className="text-xl font-bold text-slate-850 mb-4 flex items-center gap-2">
                    <FileText className="w-6 h-6 text-indigo-600" />
                    Upload de Documentos
                  </h2>
                  <p className="text-sm text-slate-550 mb-6">Por favor, envie uma foto nítida do seu documento de identificação (RG ou CNH) e um Comprovante de Residência recente.</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                    {/* Drag and drop field */}
                    <div
                      {...getRootProps()}
                      className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all ${isDragActive
                          ? 'border-indigo-400 bg-indigo-950/20'
                          : 'border-slate-200 bg-slate-50 hover:border-slate-350 hover:bg-slate-100/50'
                        }`}
                    >
                      <input {...getInputProps()} />
                      {uploading ? (
                        <div className="flex flex-col items-center gap-2 text-indigo-600">
                          <Loader2 className="w-12 h-12 animate-spin" />
                          <p className="text-sm font-semibold">Enviando arquivo...</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-slate-550 text-center">
                          <UploadCloud className="w-16 h-16 text-indigo-600 mb-2" />
                          <p className="text-sm font-bold text-white">Arraste seus documentos aqui</p>
                          <p className="text-xs">ou clique para selecionar do computador</p>
                          <span className="text-[10px] text-slate-600 mt-2">Formatos aceitos: PDF, JPEG, PNG (máx. 10MB)</span>
                        </div>
                      )}
                    </div>

                    {/* Files list */}
                    <div className="flex flex-col gap-4">
                      <h3 className="font-bold text-slate-800 text-sm">Arquivos Carregados ({uploadedFiles.length})</h3>

                      {uploadedFiles.length === 0 ? (
                        <div className="border border-dashed border-slate-800 rounded-xl p-8 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
                          <FileText className="w-10 h-10 text-slate-700" />
                          <p className="text-xs">Nenhum documento anexado ainda.</p>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3">
                          {uploadedFiles.map((file, idx) => (
                            <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-sm flex items-center justify-between gap-4">
                              <div className="flex items-center gap-3 overflow-hidden">
                                <div className="bg-slate-100 p-2 rounded-lg shrink-0">
                                  <FileText className="w-5 h-5 text-indigo-600" />
                                </div>
                                <span className="text-xs text-slate-800 truncate font-mono max-w-[200px] md:max-w-xs">{file.name}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeFile(idx)}
                                className="text-red-500 hover:text-red-600 p-2 hover:bg-slate-100 rounded-lg transition-all"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                  </div>
                </div>
              )}

              {/* STEP 6: ZapSign Direct Redirect */}
              {currentStep === 6 && (
                <div className="flex flex-col items-center py-12 text-center animate-fadeIn">
                  <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-6 shadow-sm border border-indigo-100 animate-pulse">
                    <FileCheck className="w-10 h-10" />
                  </div>
                  
                  <h2 className="text-2xl font-extrabold text-slate-900 mb-3">
                    Ficha de Inscrição Enviada!
                  </h2>
                  
                  <p className="text-sm text-slate-600 max-w-md mb-8">
                    Para concluir sua adesão à cooperativa, você está sendo redirecionado para assinar o termo eletronicamente na ZapSign.
                  </p>

                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 max-w-lg w-full flex flex-col items-center justify-center gap-4 shadow-sm">
                    {signUrl ? (
                      <>
                        <div className="flex items-center gap-3 text-emerald-600 font-semibold text-sm bg-emerald-50 px-4 py-2 rounded-full border border-emerald-100">
                          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>
                          Redirecionando automaticamente...
                        </div>
                        
                        <p className="text-xs text-slate-550 mt-2">
                          Se o redirecionamento automático não iniciar em alguns segundos, clique no botão abaixo:
                        </p>
                        
                        <a
                          href={signUrl}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-8 py-3.5 rounded-xl shadow-lg shadow-indigo-600/20 active:scale-95 transition-all text-base flex items-center gap-2 mt-2"
                        >
                          Ir para Assinatura <ChevronRight className="w-5 h-5" />
                        </a>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-6 gap-3">
                        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                        <p className="text-sm font-semibold text-slate-600">Gerando documento de assinatura...</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer controls */}
        {currentStep < 6 && (
          <div className="bg-slate-50 px-8 py-5 border-t border-slate-200 flex justify-between items-center gap-4">
            <button
              onClick={prevStep}
              disabled={currentStep === 1 || submitting}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${currentStep === 1 || submitting
                  ? 'text-slate-600 cursor-not-allowed'
                  : 'text-slate-700 hover:text-white hover:bg-slate-800'
                }`}
            >
              <ChevronLeft className="w-4 h-4" /> Voltar
            </button>

            <button
              onClick={nextStep}
              disabled={submitting || checkingCpf}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-lg text-sm font-bold shadow-lg shadow-indigo-600/20 active:scale-95 transition-all disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Processando...
                </>
              ) : checkingCpf ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Verificando CPF...
                </>
              ) : currentStep === 5 ? (
                <>
                  Finalizar & Assinar <CheckCircle className="w-4 h-4" />
                </>
              ) : (
                <>
                  Avançar <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        )}

      </div>

      {/* Ajuda ao cooperado: botão flutuante + painel com orientações da etapa atual */}
      <button
        type="button"
        onClick={() => setHelpOpen(true)}
        aria-label="Abrir ajuda"
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-3 rounded-full text-sm font-bold shadow-xl shadow-indigo-600/30 active:scale-95 transition-all"
      >
        <HelpCircle className="w-5 h-5" />
        <span className="hidden sm:inline">Ajuda</span>
      </button>

      <AnimatePresence>
        {helpOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/40 flex items-end sm:items-center justify-center p-4"
            onClick={() => setHelpOpen(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ duration: 0.2 }}
              role="dialog"
              aria-label="Painel de ajuda"
              className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-bold text-slate-900">Precisa de ajuda?</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setHelpOpen(false)}
                  aria-label="Fechar ajuda"
                  className="text-slate-500 hover:text-slate-800 p-1.5 hover:bg-slate-100 rounded-lg transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="px-6 py-5">
                <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-2">
                  Etapa atual: {HELP_BY_STEP[currentStep]?.title || 'Cadastro'}
                </p>
                <ul className="space-y-2.5">
                  {(HELP_BY_STEP[currentStep]?.items || []).map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-sm text-slate-700">
                      <Check className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-6 pt-5 border-t border-slate-200">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Informações gerais</p>
                  <ul className="space-y-2.5 text-sm text-slate-700">
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                      <span>Seu progresso é salvo automaticamente neste dispositivo — se fechar a página, você continua de onde parou.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                      <span>Cada CPF só pode ter um cadastro. Se você já se cadastrou antes, não é necessário (nem possível) se cadastrar de novo.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                      <span>Ao final, o Termo de Adesão é assinado eletronicamente pela ZapSign — o link também chega no seu e-mail.</span>
                    </li>
                  </ul>
                </div>

                {(SUPORTE_WHATSAPP || SUPORTE_EMAIL) && (
                  <div className="mt-6 pt-5 border-t border-slate-200">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Fale com a cooperativa</p>
                    <div className="flex flex-col sm:flex-row gap-3">
                      {SUPORTE_WHATSAPP && (
                        <a
                          href={`https://wa.me/${SUPORTE_WHATSAPP.replace(/\D/g, '')}?text=${encodeURIComponent('Olá! Preciso de ajuda com o cadastro de adesão de cooperado.')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-lg text-sm font-bold transition-all"
                        >
                          <MessageCircle className="w-4 h-4" />
                          WhatsApp
                        </a>
                      )}
                      {SUPORTE_EMAIL && (
                        <a
                          href={`mailto:${SUPORTE_EMAIL}?subject=${encodeURIComponent('Ajuda com o cadastro de adesão')}`}
                          className="flex-1 inline-flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 px-4 py-2.5 rounded-lg text-sm font-bold border border-slate-200 transition-all"
                        >
                          <Mail className="w-4 h-4" />
                          E-mail
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
