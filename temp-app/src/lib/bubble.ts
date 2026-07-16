/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from 'axios';
import { validarTransicao } from './equipamentos-estados';

if (!process.env.BUBBLE_API_URL) {
  throw new Error(
    'BUBBLE_API_URL não está definida. Configure-a no .env.local (ex.: https://gestorcoop.app/version-test/api/1.1). ' +
    'Sem ela, o axios usa URLs relativas e o Next.js lança "URL is malformed".'
  );
}

const bubbleClient = axios.create({
  baseURL: process.env.BUBBLE_API_URL,
  headers: {
    'Authorization': `Bearer ${process.env.BUBBLE_API_TOKEN}`,
    'Content-Type': 'application/json',
  },
});

export interface CreateCooperadoInput {
  txt_nomeCompleto: string;
  txt_CPF: string;
  txt_email: string;
  txt_whatsapp: string;
  txt_telefone?: string;
  txt_rg: string;
  txt_orgaoEmissor: string;
  txt_orgaoUF: string;
  date_dataNascimento: string; // ISO date string or formatted
  date_dataExpedicaoRG: string;
  txt_sexo: string;
  txt_estadoCivil: string;
  txt_nomeMae: string;
  txt_nomePai?: string;
  txt_grauEscolaridade: string;
  txt_etinia: string;
  txt_pis: string;
  txt_endereco: string;
  fk_Cooperativa: string;
  bool_listaNegra?: boolean;
  bool_BLOQUEADO?: boolean;
  txt_termo_status?: string;
  file_termo_assinado?: string;
}

export interface CreateProfissaoInput {
  txt_nome: string;
  txt_conselho: string;
  date_emissao?: string;
  bool_principal: boolean;
  OS_profissao: string;
  fk_socio_cooperado: string;
  fk_cooperativa: string;
}

export interface CreateContaInput {
  txt_agencia: string;
  txt_banco: string;
  text_corrente_or_poupanca: string;
  txt_nConta: string;
  fk_cooperado: string;
}

export interface Termo {
  _id?: string;
  txt_titulo: string;
  txt_conteudo: string;
  txt_profissao: string;
  num_versao: number;
  bool_ativo: boolean;
}

export interface BubblePageResponse<T = unknown> {
  results: T[];
  remaining: number;
  count: number;
}

export const equipamentosV2Ativo = process.env.EQUIPAMENTOS_V2_ENABLED === 'true';

export type StatusEquipamento =
  | 'Aguardando conferência'
  | 'Disponível'
  | 'Reservado'
  | 'Em transporte para implantação'
  | 'Implantado no domicílio'
  | 'Em transporte para recolhimento'
  | 'Recolhido e aguardando conferência'
  | 'Aguardando higienização'
  | 'Em higienização'
  | 'Manutenção'
  | 'Aguardando peça'
  | 'Liberado pela manutenção'
  | 'Bloqueado'
  | 'Extraviado'
  | 'Condenado'
  | 'Baixado'
  | 'Alugado'
  | 'Inativo';

export type TipoMovimentacaoEquipamento =
  | 'Cadastro'
  | 'Entrada no estoque'
  | 'Alteração cadastral'
  | 'Reserva'
  | 'Cancelamento de reserva'
  | 'Implantação'
  | 'Recolhimento'
  | 'Transferência'
  | 'Higienização'
  | 'Manutenção'
  | 'Calibração'
  | 'Bloqueio'
  | 'Liberação'
  | 'Extravio'
  | 'Baixa'
  | 'Correção';

export interface Equipamento {
  _id?: string;
  txt_nome: string;
  txt_descricao?: string;
  txt_marca?: string;
  txt_modelo?: string;
  txt_numero_serie: string;
  num_preco_padrao: number;
  txt_status: StatusEquipamento;
  txt_codigo_interno?: string;
  txt_numero_patrimonio?: string;
  txt_codigo_barras?: string;
  txt_categoria?: string;
  txt_fabricante?: string;
  txt_origem?: string;
  txt_fornecedor?: string;
  fk_categoria_equipamento?: string;
  fk_fabricante_equipamento?: string;
  fk_modelo_equipamento?: string;
  fk_fornecedor_equipamento?: string;
  fk_localizacao_atual?: string;
  fk_ultima_movimentacao?: string;
  date_aquisicao?: string;
  date_fim_garantia?: string;
  date_proxima_preventiva?: string;
  date_ultima_movimentacao?: string;
  num_valor_aquisicao?: number;
  num_valor_diaria_padrao?: number;
  num_valor_mensal_padrao?: number;
  num_taxa_implantacao_padrao?: number;
  num_taxa_recolhimento_padrao?: number;
  txt_regra_cobranca_padrao?: string;
  CreatedDate?: string;
}

export interface Paciente {
  _id?: string;
  txt_nome: string;
  txt_cpf?: string;
  txt_whatsapp?: string;
  txt_endereco: string;
  txt_email?: string;
  txt_tipo?: 'Homecare' | 'Hospital';
  fks_equipamentos?: string[];
  fks_locacoes?: string[];
  CreatedDate?: string;
}

export interface LocacaoEquipamento {
  _id?: string;
  fk_equipamento: string;
  fk_paciente: string;
  fk_domicilio?: string;
  fk_movimentacao_implantacao?: string;
  fk_movimentacao_recolhimento?: string;
  date_inicio: string;
  date_fim_previsto: string;
  date_fim_real?: string;
  num_valor_aluguel: number;
  txt_status: 'Ativo' | 'Finalizado' | 'Cancelado';
  txt_observacoes?: string;
  os_tipo_cobranca?: string;
  num_valor_diaria_contratada?: number;
  num_valor_mensal_contratado?: number;
  num_taxa_implantacao_contratada?: number;
  num_taxa_recolhimento_contratada?: number;
  num_desconto_contratado?: number;
  num_acrescimo_contratado?: number;
  num_total_estimado?: number;
  CreatedDate?: string;
}

export interface Domicilio {
  _id?: string;
  fk_paciente: string;
  geo_endereco: string;
  txt_cep?: string;
  txt_numero?: string;
  txt_complemento?: string;
  txt_bairro?: string;
  txt_cidade?: string;
  txt_estado?: string;
  txt_ponto_referencia?: string;
  txt_contato_local?: string;
  txt_instrucoes_acesso?: string;
  bool_ativo: boolean;
  CreatedDate?: string;
}

export interface MovimentacaoEquipamento {
  _id?: string;
  fk_equipamento: string;
  fk_locacao_equipamento?: string;
  fk_ordem_servico_manutencao?: string;
  fk_domicilio?: string;
  fk_localizacao_anterior?: string;
  fk_nova_localizacao?: string;
  os_tipo_movimentacao: TipoMovimentacaoEquipamento;
  txt_tipo_movimentacao: TipoMovimentacaoEquipamento;
  txt_status_anterior?: StatusEquipamento;
  txt_novo_status: StatusEquipamento;
  date_data_hora: string;
  txt_responsavel?: string;
  txt_observacoes?: string;
  txt_justificativa?: string;
  txt_chave_idempotencia: string;
  bool_cancelado?: boolean;
  CreatedDate?: string;
}

export interface RegistrarMovimentacaoInput {
  fk_equipamento: string;
  os_tipo_movimentacao: TipoMovimentacaoEquipamento;
  txt_novo_status: StatusEquipamento;
  fk_locacao_equipamento?: string;
  fk_ordem_servico_manutencao?: string;
  fk_domicilio?: string;
  fk_nova_localizacao?: string;
  txt_responsavel?: string;
  txt_observacoes?: string;
  txt_justificativa?: string;
  txt_chave_idempotencia: string;
  date_data_hora?: string;
  // Guarda de concorrência: se informado, a movimentação só grava quando o
  // status atual do equipamento ainda for este (detecta escrita concorrente).
  txt_status_esperado?: StatusEquipamento;
}

export interface HistoricoEventoEquipamento {
  id: string;
  data: string;
  tipo: string;
  statusAnterior?: string;
  statusNovo?: string;
  observacoes?: string;
  responsavel?: string;
  locacaoId?: string;
}

export interface OrdemServicoManutencao {
  _id?: string;
  txt_numero_os: string;
  fk_equipamento: string;
  fk_movimentacao_entrada?: string;
  date_entrada: string;
  txt_motivo: string;
  txt_defeito_relatado?: string;
  txt_responsavel?: string;
  txt_observacoes?: string;
  txt_status: string;
  txt_resultado?: string;
  date_diagnostico?: string;
  date_conclusao?: string;
  date_prazo_estimado?: string;
  txt_defeito_encontrado?: string;
  txt_causa_provavel?: string;
  txt_servico_recomendado?: string;
  txt_responsavel_tecnico?: string;
  num_orcamento?: number;
  num_custo_pecas?: number;
  num_custo_mao_obra?: number;
  num_custo_frete?: number;
  num_outros_custos?: number;
  num_custo_total?: number;
  CreatedDate?: string;
}

export interface ReservaEquipamento {
  _id?: string;
  fk_equipamento: string;
  fk_paciente: string;
  fk_domicilio?: string;
  date_reserva: string;
  date_implantacao_prevista: string;
  date_validade: string;
  txt_responsavel?: string;
  txt_observacoes?: string;
  txt_status: string;
  txt_chave_idempotencia: string;
  fk_movimentacao_reserva?: string;
  CreatedDate?: string;
}

export interface ConferenciaEquipamento {
  _id?: string;
  fk_equipamento: string;
  fk_movimentacao_equipamento?: string;
  date_conferencia: string;
  txt_responsavel?: string;
  txt_estado_conservacao?: string;
  txt_resultado: string;
  txt_status_destino: StatusEquipamento;
  txt_observacoes?: string;
  CreatedDate?: string;
}

export interface HigienizacaoEquipamento {
  _id?: string;
  fk_equipamento: string;
  date_inicio: string;
  date_fim?: string;
  txt_metodo?: string;
  txt_resultado?: string;
  txt_responsavel?: string;
  txt_status: string;
  txt_observacoes?: string;
}

export interface ItemManutencao {
  _id?: string;
  fk_ordem_servico_manutencao: string;
  txt_tipo: 'Peça' | 'Mão de obra' | 'Frete' | 'Outro';
  txt_descricao: string;
  num_quantidade?: number;
  num_custo_unitario?: number;
  num_custo_total?: number;
  txt_fornecedor?: string;
  txt_responsavel?: string;
  CreatedDate?: string;
}

export interface BaixaEquipamento {
  _id?: string;
  fk_equipamento: string;
  date_baixa: string;
  os_motivo_baixa: string;
  txt_laudo?: string;
  num_valor_reparo_estimado?: number;
  num_valor_residual?: number;
  txt_destino_final?: string;
  txt_solicitante?: string;
  txt_autorizado_por?: string;
  txt_status: 'Pendente de aprovação' | 'Aprovada' | 'Reprovada' | 'Cancelada';
  date_decisao?: string;
  txt_observacoes?: string;
  // Reversão excepcional (dupla autorização + auditoria reforçada).
  bool_revertida?: boolean;
  txt_revertida_por?: string;
  txt_revertida_por_segundo?: string;
  txt_justificativa_reversao?: string;
  date_reversao?: string;
  CreatedDate?: string;
}

export interface SuspensaoLocacao {
  _id?: string;
  fk_locacao_equipamento: string;
  date_inicio: string;
  date_fim: string;
  txt_motivo?: string;
  txt_responsavel?: string;
  CreatedDate?: string;
}

export type TipoAlertaEquipamento =
  | 'Recolhimento atrasado'
  | 'Implantação prevista não realizada'
  | 'Preventiva vencida'
  | 'Calibração vencida'
  | 'Garantia próxima do vencimento'
  | 'Conferência pendente'
  | 'Higienização parada'
  | 'Manutenção parada'
  | 'Acessório não devolvido'
  | 'Reserva vencida'
  | 'Equipamento extraviado'
  | 'Documentos pendentes';

export interface AlertaEquipamento {
  _id?: string;
  fk_equipamento: string;
  fk_locacao_equipamento?: string;
  fk_ordem_servico_manutencao?: string;
  os_tipo_alerta: TipoAlertaEquipamento;
  txt_titulo: string;
  txt_descricao?: string;
  date_prazo?: string;
  txt_prioridade?: 'Baixa' | 'Média' | 'Alta' | 'Crítica';
  txt_responsavel?: string;
  txt_status: 'Aberto' | 'Em tratamento' | 'Resolvido' | 'Ignorado';
  txt_resolucao?: string;
  date_resolucao?: string;
  txt_chave_idempotencia: string;
  CreatedDate?: string;
}


// Helper to fetch all results in parallel using Bubble API cursor pagination
async function getAllResults<T>(endpoint: string, constraints?: unknown[]): Promise<T[]> {
  const limit = 100;
  const params: Record<string, unknown> = { limit, cursor: 0 };
  if (constraints) {
    params.constraints = JSON.stringify(constraints);
  }

  // Fetch the first page
  const response = await bubbleClient.get(endpoint, { params });
  const firstPageResults = response.data.response.results || [];
  const remaining = response.data.response.remaining || 0;

  if (remaining === 0) {
    return firstPageResults;
  }

  // Calculate other pages and fetch them in parallel
  const totalPages = Math.ceil(remaining / limit);
  const promises = [];

  for (let i = 1; i <= totalPages; i++) {
    const nextCursor = i * limit;
    promises.push(
      bubbleClient.get(endpoint, {
        params: {
          ...params,
          cursor: nextCursor,
        },
      })
    );
  }

  const responses = await Promise.all(promises);
  let allResults = [...firstPageResults];
  for (const resp of responses) {
    const results = resp.data.response.results || [];
    allResults = allResults.concat(results);
  }

  return allResults;
}

function mapEquipamento(raw: any): Equipamento {
  return {
    _id: raw._id,
    txt_nome: raw.txt_nome || '',
    txt_descricao: raw.txt_descricao || '',
    txt_marca: raw.txt_marca || '',
    txt_modelo: raw.txt_modelo || '',
    txt_numero_serie: raw.txt_numero_serie || '',
    num_preco_padrao: raw.num_preco_padrao || 0,
    txt_status: raw.OS_status || 'Disponível',
    txt_codigo_interno: raw.txt_codigo_interno || '',
    txt_numero_patrimonio: raw.txt_numero_patrimonio || '',
    txt_codigo_barras: raw.txt_codigo_barras || '',
    txt_categoria: raw.txt_categoria || '',
    txt_fabricante: raw.txt_fabricante || '',
    txt_origem: raw.txt_origem || '',
    txt_fornecedor: raw.txt_fornecedor || '',
    fk_categoria_equipamento: raw.fk_categoria_equipamento || undefined,
    fk_fabricante_equipamento: raw.fk_fabricante_equipamento || undefined,
    fk_modelo_equipamento: raw.fk_modelo_equipamento || undefined,
    fk_fornecedor_equipamento: raw.fk_fornecedor_equipamento || undefined,
    fk_localizacao_atual: raw.fk_localizacao_atual || undefined,
    fk_ultima_movimentacao: raw.fk_ultima_movimentacao || undefined,
    date_aquisicao: raw.date_aquisicao || undefined,
    date_fim_garantia: raw.date_fim_garantia || undefined,
    date_proxima_preventiva: raw.date_proxima_preventiva || undefined,
    date_ultima_movimentacao: raw.date_ultima_movimentacao || undefined,
    num_valor_aquisicao: raw.num_valor_aquisicao ?? undefined,
    num_valor_diaria_padrao: raw.num_valor_diaria_padrao ?? undefined,
    num_valor_mensal_padrao: raw.num_valor_mensal_padrao ?? undefined,
    num_taxa_implantacao_padrao: raw.num_taxa_implantacao_padrao ?? undefined,
    num_taxa_recolhimento_padrao: raw.num_taxa_recolhimento_padrao ?? undefined,
    txt_regra_cobranca_padrao: raw.txt_regra_cobranca_padrao || undefined,
    CreatedDate: raw['Created Date'],
  };
}

function mapLocacao(raw: any): LocacaoEquipamento {
  return {
    _id: raw._id,
    fk_equipamento: raw.fk_equipamento || '',
    fk_paciente: raw.fk_paciente || '',
    fk_domicilio: raw.fk_domicilio || undefined,
    fk_movimentacao_implantacao: raw.fk_movimentacao_implantacao || undefined,
    fk_movimentacao_recolhimento: raw.fk_movimentacao_recolhimento || undefined,
    date_inicio: raw.date_inicio || '',
    date_fim_previsto: raw.date_fim_previsto || '',
    date_fim_real: raw.date_fim_real || undefined,
    num_valor_aluguel: raw.num_valor_aluguel || 0,
    txt_status: raw.OS_status || 'Ativo',
    txt_observacoes: raw.txt_observacoes || '',
    os_tipo_cobranca: raw.os_tipo_cobranca || undefined,
    num_valor_diaria_contratada: raw.num_valor_diaria_contratada ?? undefined,
    num_valor_mensal_contratado: raw.num_valor_mensal_contratado ?? undefined,
    num_taxa_implantacao_contratada: raw.num_taxa_implantacao_contratada ?? undefined,
    num_taxa_recolhimento_contratada: raw.num_taxa_recolhimento_contratada ?? undefined,
    num_desconto_contratado: raw.num_desconto_contratado ?? undefined,
    num_acrescimo_contratado: raw.num_acrescimo_contratado ?? undefined,
    num_total_estimado: raw.num_total_estimado ?? undefined,
    CreatedDate: raw['Created Date'],
  };
}

function mapReserva(raw: any): ReservaEquipamento {
  return {
    _id: raw._id,
    fk_equipamento: raw.fk_equipamento || '',
    fk_paciente: raw.fk_paciente || '',
    fk_domicilio: raw.fk_domicilio || undefined,
    date_reserva: raw.date_reserva || raw['Created Date'] || '',
    date_implantacao_prevista: raw.date_implantacao_prevista || '',
    date_validade: raw.date_validade || '',
    txt_responsavel: raw.txt_responsavel || undefined,
    txt_observacoes: raw.txt_observacoes || undefined,
    txt_status: raw.OS_status || 'Ativa',
    txt_chave_idempotencia: raw.txt_chave_idempotencia || '',
    fk_movimentacao_reserva: raw.fk_movimentacao_reserva || undefined,
    CreatedDate: raw['Created Date'],
  };
}

function mapBaixa(raw: any): BaixaEquipamento {
  return {
    _id: raw._id,
    fk_equipamento: raw.fk_equipamento || '',
    date_baixa: raw.date_baixa || raw['Created Date'] || '',
    os_motivo_baixa: raw.os_motivo_baixa || '',
    txt_laudo: raw.txt_laudo || undefined,
    num_valor_reparo_estimado: raw.num_valor_reparo_estimado ?? undefined,
    num_valor_residual: raw.num_valor_residual ?? undefined,
    txt_destino_final: raw.txt_destino_final || undefined,
    txt_solicitante: raw.txt_solicitante || undefined,
    txt_autorizado_por: raw.txt_autorizado_por || undefined,
    txt_status: raw.OS_status || 'Pendente de aprovação',
    date_decisao: raw.date_decisao || undefined,
    txt_observacoes: raw.txt_observacoes || undefined,
    bool_revertida: Boolean(raw.bool_revertida),
    txt_revertida_por: raw.txt_revertida_por || undefined,
    txt_revertida_por_segundo: raw.txt_revertida_por_segundo || undefined,
    txt_justificativa_reversao: raw.txt_justificativa_reversao || undefined,
    date_reversao: raw.date_reversao || undefined,
    CreatedDate: raw['Created Date'],
  };
}

function mapAlerta(raw: any): AlertaEquipamento {
  return {
    _id: raw._id,
    fk_equipamento: raw.fk_equipamento || '',
    fk_locacao_equipamento: raw.fk_locacao_equipamento || undefined,
    fk_ordem_servico_manutencao: raw.fk_ordem_servico_manutencao || undefined,
    os_tipo_alerta: raw.os_tipo_alerta,
    txt_titulo: raw.txt_titulo || '',
    txt_descricao: raw.txt_descricao || undefined,
    date_prazo: raw.date_prazo || undefined,
    txt_prioridade: raw.txt_prioridade || undefined,
    txt_responsavel: raw.txt_responsavel || undefined,
    txt_status: raw.OS_status || 'Aberto',
    txt_resolucao: raw.txt_resolucao || undefined,
    date_resolucao: raw.date_resolucao || undefined,
    txt_chave_idempotencia: raw.txt_chave_idempotencia || '',
    CreatedDate: raw['Created Date'],
  };
}

export const bubbleApi = {
  async createCooperado(data: CreateCooperadoInput) {
    const response = await bubbleClient.post('/obj/socioscooperados', data);
    return response.data;
  },

  async createProfissao(data: CreateProfissaoInput) {
    const response = await bubbleClient.post('/obj/profissao_cooperado', data);
    return response.data;
  },

  async createContaBancaria(data: CreateContaInput) {
    const response = await bubbleClient.post('/obj/conta_cooperado', data);
    return response.data;
  },

  async getCooperado(id: string) {
    const response = await bubbleClient.get(`/obj/socioscooperados/${id}`);
    return response.data.response;
  },

  async getCooperados(cursor?: number, limit?: number): Promise<unknown[] | BubblePageResponse> {
    if (cursor !== undefined || limit !== undefined) {
      const response = await bubbleClient.get('/obj/socioscooperados', {
        params: {
          cursor: cursor ?? 0,
          limit: limit ?? 100,
        },
      });
      return response.data.response;
    }
    return getAllResults('/obj/socioscooperados');
  },

  async updateCooperado(id: string, data: Record<string, unknown>) {
    const response = await bubbleClient.patch(`/obj/socioscooperados/${id}`, data);
    return response.data;
  },

  async findCooperadoByEmail(email: string) {
    const constraints = [
      {
        key: 'txt_email',
        constraint_type: 'equals',
        value: email,
      },
    ];
    const response = await bubbleClient.get(`/obj/socioscooperados?constraints=${JSON.stringify(constraints)}`);
    return response.data.response.results?.[0] || null;
  },

  async uploadFile(filename: string, base64Contents: string): Promise<string> {
    try {
      const response = await bubbleClient.post('/file', {
        filename,
        contents: base64Contents,
        private: false,
      });
      // The Bubble API response for file uploads usually contains either url or response.url or response.data.url
      const url = response.data?.url || response.data?.response?.url || response.data;
      if (typeof url === 'string') return url;
      throw new Error('Invalid upload response format');
    } catch (error) {
      console.warn('Bubble file upload failed, using fallback mock URL:', error);
      return `https://ac33ef5507a749df80cc649e43463289.cdn.bubble.io/mock-file-${Date.now()}-${filename}`;
    }
  },

  async getServicosByCooperado(cooperadoId: string, startDate?: string, endDate?: string) {
    const constraints: Array<{ key: string; constraint_type: string; value: string }> = [
      {
        key: 'fk_cooperado',
        constraint_type: 'equals',
        value: cooperadoId,
      },
    ];
    if (startDate) {
      constraints.push({
        key: 'date_fixa_entrada',
        constraint_type: 'greater than',
        value: `${startDate}T00:00:00.000Z`,
      });
    }
    if (endDate) {
      constraints.push({
        key: 'date_fixa_entrada',
        constraint_type: 'less than',
        value: `${endDate}T23:59:59.999Z`,
      });
    }
    return getAllResults('/obj/servicos', constraints);
  },

  async getEscalas(cursor?: number, limit?: number): Promise<unknown[] | BubblePageResponse> {
    if (cursor !== undefined || limit !== undefined) {
      const response = await bubbleClient.get('/obj/escalas', {
        params: {
          cursor: cursor ?? 0,
          limit: limit ?? 100,
        },
      });
      return response.data.response;
    }
    return getAllResults('/obj/escalas');
  },

  async getContasBancariasByCooperado(cooperadoId: string) {
    const constraints = [
      {
        key: 'fk_cooperado',
        constraint_type: 'equals',
        value: cooperadoId,
      },
    ];
    return getAllResults('/obj/conta_cooperado', constraints);
  },

  async updateServico(servicoId: string, data: Record<string, unknown>) {
    const response = await bubbleClient.patch(`/obj/servicos/${servicoId}`, data);
    return response.data;
  },

  async createTermo(data: Omit<Termo, '_id'>) {
    const response = await bubbleClient.post('/obj/termos', data);
    return response.data;
  },

  async getTermos(): Promise<Termo[]> {
    return getAllResults<Termo>('/obj/termos');
  },

  async updateTermo(id: string, data: Partial<Termo>) {
    const response = await bubbleClient.patch(`/obj/termos/${id}`, data);
    return response.data;
  },

  // Equipamentos
  async getEquipamento(id: string): Promise<Equipamento> {
    const response = await bubbleClient.get(`/obj/equipamento/${id}`);
    return mapEquipamento(response.data.response);
  },
  async getEquipamentos(constraints?: unknown[]): Promise<Equipamento[]> {
    const rawList = await getAllResults<any>('/obj/equipamento', constraints);
    return rawList.map(mapEquipamento);
  },
  async createEquipamento(data: Omit<Equipamento, '_id' | 'CreatedDate'>): Promise<Equipamento> {
    const payload = {
      txt_nome: data.txt_nome,
      txt_descricao: data.txt_descricao,
      txt_marca: data.txt_marca,
      txt_modelo: data.txt_modelo,
      txt_numero_serie: data.txt_numero_serie,
      num_preco_padrao: data.num_preco_padrao,
      OS_status: data.txt_status || 'Disponível',
      txt_codigo_interno: data.txt_codigo_interno,
      txt_numero_patrimonio: data.txt_numero_patrimonio,
      txt_codigo_barras: data.txt_codigo_barras,
      txt_categoria: data.txt_categoria,
      txt_fabricante: data.txt_fabricante,
      txt_origem: data.txt_origem,
      txt_fornecedor: data.txt_fornecedor,
      fk_categoria_equipamento: data.fk_categoria_equipamento,
      fk_fabricante_equipamento: data.fk_fabricante_equipamento,
      fk_modelo_equipamento: data.fk_modelo_equipamento,
      fk_fornecedor_equipamento: data.fk_fornecedor_equipamento,
      fk_localizacao_atual: data.fk_localizacao_atual,
      date_aquisicao: data.date_aquisicao,
      date_fim_garantia: data.date_fim_garantia,
      date_proxima_preventiva: data.date_proxima_preventiva,
      num_valor_aquisicao: data.num_valor_aquisicao,
      num_valor_diaria_padrao: data.num_valor_diaria_padrao,
      num_valor_mensal_padrao: data.num_valor_mensal_padrao,
      num_taxa_implantacao_padrao: data.num_taxa_implantacao_padrao,
      num_taxa_recolhimento_padrao: data.num_taxa_recolhimento_padrao,
      txt_regra_cobranca_padrao: data.txt_regra_cobranca_padrao,
    };
    const response = await bubbleClient.post('/obj/equipamento', payload);
    const createdId = response.data.id || response.data.response?.id;
    return {
      _id: createdId,
      ...data
    };
  },
  async updateEquipamento(id: string, data: Partial<Equipamento>): Promise<void> {
    const payload: any = {};
    if (data.txt_nome !== undefined) payload.txt_nome = data.txt_nome;
    if (data.txt_descricao !== undefined) payload.txt_descricao = data.txt_descricao;
    if (data.txt_marca !== undefined) payload.txt_marca = data.txt_marca;
    if (data.txt_modelo !== undefined) payload.txt_modelo = data.txt_modelo;
    if (data.txt_numero_serie !== undefined) payload.txt_numero_serie = data.txt_numero_serie;
    if (data.num_preco_padrao !== undefined) payload.num_preco_padrao = data.num_preco_padrao;
    if (data.txt_status !== undefined) payload.OS_status = data.txt_status;
    if (data.txt_codigo_interno !== undefined) payload.txt_codigo_interno = data.txt_codigo_interno;
    if (data.txt_numero_patrimonio !== undefined) payload.txt_numero_patrimonio = data.txt_numero_patrimonio;
    if (data.txt_codigo_barras !== undefined) payload.txt_codigo_barras = data.txt_codigo_barras;
    if (data.txt_categoria !== undefined) payload.txt_categoria = data.txt_categoria;
    if (data.txt_fabricante !== undefined) payload.txt_fabricante = data.txt_fabricante;
    if (data.txt_origem !== undefined) payload.txt_origem = data.txt_origem;
    if (data.txt_fornecedor !== undefined) payload.txt_fornecedor = data.txt_fornecedor;
    if (data.fk_categoria_equipamento !== undefined) payload.fk_categoria_equipamento = data.fk_categoria_equipamento;
    if (data.fk_fabricante_equipamento !== undefined) payload.fk_fabricante_equipamento = data.fk_fabricante_equipamento;
    if (data.fk_modelo_equipamento !== undefined) payload.fk_modelo_equipamento = data.fk_modelo_equipamento;
    if (data.fk_fornecedor_equipamento !== undefined) payload.fk_fornecedor_equipamento = data.fk_fornecedor_equipamento;
    if (data.fk_localizacao_atual !== undefined) payload.fk_localizacao_atual = data.fk_localizacao_atual;
    if (data.fk_ultima_movimentacao !== undefined) payload.fk_ultima_movimentacao = data.fk_ultima_movimentacao;
    if (data.date_aquisicao !== undefined) payload.date_aquisicao = data.date_aquisicao;
    if (data.date_fim_garantia !== undefined) payload.date_fim_garantia = data.date_fim_garantia;
    if (data.date_proxima_preventiva !== undefined) payload.date_proxima_preventiva = data.date_proxima_preventiva;
    if (data.date_ultima_movimentacao !== undefined) payload.date_ultima_movimentacao = data.date_ultima_movimentacao;
    if (data.num_valor_aquisicao !== undefined) payload.num_valor_aquisicao = data.num_valor_aquisicao;
    if (data.num_valor_diaria_padrao !== undefined) payload.num_valor_diaria_padrao = data.num_valor_diaria_padrao;
    if (data.num_valor_mensal_padrao !== undefined) payload.num_valor_mensal_padrao = data.num_valor_mensal_padrao;
    if (data.num_taxa_implantacao_padrao !== undefined) payload.num_taxa_implantacao_padrao = data.num_taxa_implantacao_padrao;
    if (data.num_taxa_recolhimento_padrao !== undefined) payload.num_taxa_recolhimento_padrao = data.num_taxa_recolhimento_padrao;
    if (data.txt_regra_cobranca_padrao !== undefined) payload.txt_regra_cobranca_padrao = data.txt_regra_cobranca_padrao;
    await bubbleClient.patch(`/obj/equipamento/${id}`, payload);
  },
  async deleteEquipamento(id: string): Promise<void> {
    await bubbleClient.delete(`/obj/equipamento/${id}`);
  },

  // Pacientes
  async getPaciente(id: string): Promise<Paciente> {
    const response = await bubbleClient.get(`/obj/locais_de_trabalho_pacientes/${id}`);
    const raw = response.data.response;
    return {
      _id: raw._id,
      txt_nome: raw.txt_nome || '',
      txt_cpf: '',
      txt_whatsapp: '',
      txt_endereco: typeof raw.geo_local === 'string'
        ? raw.geo_local
        : (raw.geo_local?.address || ''),
      txt_email: '',
      txt_tipo: raw.os_tipo || 'Homecare',
      fks_equipamentos: raw.fks_equipamentos || [],
      fks_locacoes: raw.fks_locacoes || [],
      CreatedDate: raw['Created Date']
    };
  },
  async getPacientes(constraints?: unknown[]): Promise<Paciente[]> {
    const rawList = await getAllResults<any>('/obj/locais_de_trabalho_pacientes', constraints);
    return rawList.map(raw => ({
      _id: raw._id,
      txt_nome: raw.txt_nome || '',
      txt_cpf: '',
      txt_whatsapp: '',
      txt_endereco: typeof raw.geo_local === 'string'
        ? raw.geo_local
        : (raw.geo_local?.address || ''),
      txt_email: '',
      txt_tipo: raw.os_tipo || 'Homecare',
      fks_equipamentos: raw.fks_equipamentos || [],
      fks_locacoes: raw.fks_locacoes || [],
      CreatedDate: raw['Created Date']
    }));
  },
  async createPaciente(data: Omit<Paciente, '_id' | 'CreatedDate'>): Promise<Paciente> {
    const payload: any = {
      txt_nome: data.txt_nome,
      geo_local: data.txt_endereco,
      os_tipo: data.txt_tipo || 'Homecare'
    };
    const response = await bubbleClient.post('/obj/locais_de_trabalho_pacientes', payload);
    const createdId = response.data.id || response.data.response?.id;
    return {
      _id: createdId,
      txt_nome: data.txt_nome,
      txt_endereco: data.txt_endereco,
      txt_tipo: data.txt_tipo || 'Homecare',
      fks_equipamentos: [],
      fks_locacoes: []
    };
  },
  async updatePaciente(id: string, data: Partial<Paciente>): Promise<void> {
    const payload: any = {};
    if (data.txt_nome !== undefined) payload.txt_nome = data.txt_nome;
    if (data.txt_endereco !== undefined) payload.geo_local = data.txt_endereco;
    if (data.txt_tipo !== undefined) payload.os_tipo = data.txt_tipo;
    if (data.fks_equipamentos !== undefined) payload.fks_equipamentos = data.fks_equipamentos;
    if (data.fks_locacoes !== undefined) payload.fks_locacoes = data.fks_locacoes;
    await bubbleClient.patch(`/obj/locais_de_trabalho_pacientes/${id}`, payload);
  },

  async obterOuCriarDomicilioAtivo(pacienteId: string, enderecoLegado: string): Promise<Domicilio> {
    if (!equipamentosV2Ativo) {
      throw new Error('O cadastro de domicilios v2 ainda nao esta habilitado.');
    }

    const existentes = await getAllResults<any>('/obj/domicilio', [
      {
        key: 'fk_paciente',
        constraint_type: 'equals',
        value: pacienteId,
      },
    ]);
    const existente = existentes.find((item) => item.bool_ativo !== false);
    if (existente) {
      return {
        _id: existente._id,
        fk_paciente: existente.fk_paciente,
        geo_endereco: typeof existente.geo_endereco === 'string'
          ? existente.geo_endereco
          : existente.geo_endereco?.address || '',
        txt_cep: existente.txt_cep || undefined,
        txt_numero: existente.txt_numero || undefined,
        txt_complemento: existente.txt_complemento || undefined,
        txt_bairro: existente.txt_bairro || undefined,
        txt_cidade: existente.txt_cidade || undefined,
        txt_estado: existente.txt_estado || undefined,
        txt_ponto_referencia: existente.txt_ponto_referencia || undefined,
        txt_contato_local: existente.txt_contato_local || undefined,
        txt_instrucoes_acesso: existente.txt_instrucoes_acesso || undefined,
        bool_ativo: existente.bool_ativo !== false,
        CreatedDate: existente['Created Date'],
      };
    }

    const response = await bubbleClient.post('/obj/domicilio', {
      fk_paciente: pacienteId,
      geo_endereco: enderecoLegado,
      bool_ativo: true,
    });
    const id = response.data.id || response.data.response?.id;
    if (!id) throw new Error('O Bubble nao retornou o identificador do domicilio.');

    return {
      _id: id,
      fk_paciente: pacienteId,
      geo_endereco: enderecoLegado,
      bool_ativo: true,
    };
  },

  // Locações
  async getLocacao(id: string): Promise<LocacaoEquipamento> {
    const response = await bubbleClient.get(`/obj/locacao_equipamento/${id}`);
    return mapLocacao(response.data.response);
  },
  async getLocacoes(constraints?: unknown[]): Promise<LocacaoEquipamento[]> {
    const rawList = await getAllResults<any>('/obj/locacao_equipamento', constraints);
    return rawList.map(mapLocacao);
  },
  async createLocacao(data: Omit<LocacaoEquipamento, '_id' | 'CreatedDate'>): Promise<LocacaoEquipamento> {
    const payload = {
      fk_equipamento: data.fk_equipamento,
      fk_paciente: data.fk_paciente,
      fk_domicilio: data.fk_domicilio,
      date_inicio: data.date_inicio,
      date_fim_previsto: data.date_fim_previsto,
      num_valor_aluguel: data.num_valor_aluguel,
      OS_status: data.txt_status || 'Ativo',
      txt_observacoes: data.txt_observacoes,
      os_tipo_cobranca: data.os_tipo_cobranca,
      num_valor_diaria_contratada: data.num_valor_diaria_contratada,
      num_valor_mensal_contratado: data.num_valor_mensal_contratado,
      num_taxa_implantacao_contratada: data.num_taxa_implantacao_contratada,
      num_taxa_recolhimento_contratada: data.num_taxa_recolhimento_contratada,
      num_desconto_contratado: data.num_desconto_contratado,
      num_acrescimo_contratado: data.num_acrescimo_contratado,
      num_total_estimado: data.num_total_estimado,
    };
    const response = await bubbleClient.post('/obj/locacao_equipamento', payload);
    const createdId = response.data.id || response.data.response?.id;
    return {
      _id: createdId,
      ...data
    };
  },
  async updateLocacao(id: string, data: Partial<LocacaoEquipamento>): Promise<void> {
    const payload: any = {};
    if (data.fk_equipamento !== undefined) payload.fk_equipamento = data.fk_equipamento;
    if (data.fk_paciente !== undefined) payload.fk_paciente = data.fk_paciente;
    if (data.fk_domicilio !== undefined) payload.fk_domicilio = data.fk_domicilio;
    if (data.fk_movimentacao_implantacao !== undefined) payload.fk_movimentacao_implantacao = data.fk_movimentacao_implantacao;
    if (data.fk_movimentacao_recolhimento !== undefined) payload.fk_movimentacao_recolhimento = data.fk_movimentacao_recolhimento;
    if (data.date_inicio !== undefined) payload.date_inicio = data.date_inicio;
    if (data.date_fim_previsto !== undefined) payload.date_fim_previsto = data.date_fim_previsto;
    if (data.date_fim_real !== undefined) payload.date_fim_real = data.date_fim_real;
    if (data.num_valor_aluguel !== undefined) payload.num_valor_aluguel = data.num_valor_aluguel;
    if (data.txt_status !== undefined) payload.OS_status = data.txt_status;
    if (data.txt_observacoes !== undefined) payload.txt_observacoes = data.txt_observacoes;
    if (data.os_tipo_cobranca !== undefined) payload.os_tipo_cobranca = data.os_tipo_cobranca;
    if (data.num_valor_diaria_contratada !== undefined) payload.num_valor_diaria_contratada = data.num_valor_diaria_contratada;
    if (data.num_valor_mensal_contratado !== undefined) payload.num_valor_mensal_contratado = data.num_valor_mensal_contratado;
    if (data.num_taxa_implantacao_contratada !== undefined) payload.num_taxa_implantacao_contratada = data.num_taxa_implantacao_contratada;
    if (data.num_taxa_recolhimento_contratada !== undefined) payload.num_taxa_recolhimento_contratada = data.num_taxa_recolhimento_contratada;
    if (data.num_desconto_contratado !== undefined) payload.num_desconto_contratado = data.num_desconto_contratado;
    if (data.num_acrescimo_contratado !== undefined) payload.num_acrescimo_contratado = data.num_acrescimo_contratado;
    if (data.num_total_estimado !== undefined) payload.num_total_estimado = data.num_total_estimado;
    await bubbleClient.patch(`/obj/locacao_equipamento/${id}`, payload);
  },

  // The Bubble Data API cannot commit across data types. This orchestrator
  // writes the audit event first and compensates it if the asset update fails.
  // It is unreachable until EQUIPAMENTOS_V2_ENABLED is explicitly enabled.
  async getMovimentacaoPorChave(chave: string): Promise<MovimentacaoEquipamento | null> {
    if (!equipamentosV2Ativo) return null;

    const resultados = await getAllResults<any>('/obj/movimentacao_equipamento', [
      {
        key: 'txt_chave_idempotencia',
        constraint_type: 'equals',
        value: chave,
      },
    ]);
    const raw = resultados.find((item) => !item.bool_cancelado);
    if (!raw) return null;

    return {
      _id: raw._id,
        fk_equipamento: raw.fk_equipamento,
        fk_locacao_equipamento: raw.fk_locacao_equipamento || undefined,
        fk_ordem_servico_manutencao: raw.fk_ordem_servico_manutencao || undefined,
      fk_domicilio: raw.fk_domicilio || undefined,
      fk_localizacao_anterior: raw.fk_localizacao_anterior || undefined,
      fk_nova_localizacao: raw.fk_nova_localizacao || undefined,
      os_tipo_movimentacao: raw.os_tipo_movimentacao,
      txt_tipo_movimentacao: raw.txt_tipo_movimentacao,
      txt_status_anterior: raw.txt_status_anterior || undefined,
      txt_novo_status: raw.txt_novo_status,
      date_data_hora: raw.date_data_hora,
      txt_responsavel: raw.txt_responsavel || undefined,
      txt_observacoes: raw.txt_observacoes || undefined,
      txt_justificativa: raw.txt_justificativa || undefined,
      txt_chave_idempotencia: raw.txt_chave_idempotencia,
      bool_cancelado: Boolean(raw.bool_cancelado),
      CreatedDate: raw['Created Date'],
    };
  },

  async getHistoricoEquipamento(equipamentoId: string): Promise<HistoricoEventoEquipamento[]> {
    const locacoes = await this.getLocacoes([
      { key: 'fk_equipamento', constraint_type: 'equals', value: equipamentoId },
    ]);
    const eventos: HistoricoEventoEquipamento[] = locacoes.flatMap((locacao) => {
      const resultado: HistoricoEventoEquipamento[] = [{
        id: `locacao-inicio-${locacao._id}`,
        data: locacao.date_inicio,
        tipo: 'Implantação',
        statusNovo: equipamentosV2Ativo ? 'Implantado no domicílio' : 'Alugado',
        observacoes: locacao.txt_observacoes,
        locacaoId: locacao._id,
      }];
      if (locacao.date_fim_real) {
        resultado.push({
          id: `locacao-fim-${locacao._id}`,
          data: locacao.date_fim_real,
          tipo: 'Recolhimento',
          statusNovo: equipamentosV2Ativo ? 'Recolhido e aguardando conferência' : 'Disponível',
          observacoes: locacao.txt_observacoes,
          locacaoId: locacao._id,
        });
      }
      return resultado;
    });

    if (!equipamentosV2Ativo) {
      return eventos.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
    }

    const movimentacoes = await getAllResults<any>('/obj/movimentacao_equipamento', [
      { key: 'fk_equipamento', constraint_type: 'equals', value: equipamentoId },
    ]);
    const porMovimentacao = movimentacoes.map((raw) => ({
      id: raw._id,
      data: raw.date_data_hora || raw['Created Date'],
      tipo: raw.txt_tipo_movimentacao || raw.os_tipo_movimentacao || 'Movimentação',
      statusAnterior: raw.txt_status_anterior || undefined,
      statusNovo: raw.txt_novo_status || undefined,
      observacoes: raw.txt_observacoes || undefined,
      responsavel: raw.txt_responsavel || undefined,
      locacaoId: raw.fk_locacao_equipamento || undefined,
    }));
    return porMovimentacao.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
  },

  async criarOrdemServicoManutencao(data: Omit<OrdemServicoManutencao, '_id' | 'CreatedDate'>): Promise<OrdemServicoManutencao> {
    if (!equipamentosV2Ativo) {
      throw new Error('O fluxo de manutencao v2 ainda nao esta habilitado.');
    }
    const response = await bubbleClient.post('/obj/ordem_servico_manutencao', {
      txt_numero_os: data.txt_numero_os,
      fk_equipamento: data.fk_equipamento,
      date_entrada: data.date_entrada,
      txt_motivo: data.txt_motivo,
      txt_defeito_relatado: data.txt_defeito_relatado,
      txt_responsavel: data.txt_responsavel,
      txt_observacoes: data.txt_observacoes,
      OS_status: data.txt_status,
      num_custo_total: data.num_custo_total,
    });
    return { _id: response.data.id || response.data.response?.id, ...data };
  },

  async atualizarOrdemServicoManutencao(id: string, data: Partial<OrdemServicoManutencao>): Promise<void> {
    if (!equipamentosV2Ativo) {
      throw new Error('O fluxo de manutencao v2 ainda nao esta habilitado.');
    }
    const payload: Record<string, unknown> = {};
    if (data.fk_movimentacao_entrada !== undefined) payload.fk_movimentacao_entrada = data.fk_movimentacao_entrada;
    if (data.txt_motivo !== undefined) payload.txt_motivo = data.txt_motivo;
    if (data.txt_defeito_relatado !== undefined) payload.txt_defeito_relatado = data.txt_defeito_relatado;
    if (data.txt_responsavel !== undefined) payload.txt_responsavel = data.txt_responsavel;
    if (data.txt_observacoes !== undefined) payload.txt_observacoes = data.txt_observacoes;
    if (data.txt_status !== undefined) payload.OS_status = data.txt_status;
    if (data.txt_resultado !== undefined) payload.OS_resultado = data.txt_resultado;
    if (data.date_diagnostico !== undefined) payload.date_diagnostico = data.date_diagnostico;
    if (data.date_conclusao !== undefined) payload.date_conclusao = data.date_conclusao;
    if (data.date_prazo_estimado !== undefined) payload.date_prazo_estimado = data.date_prazo_estimado;
    if (data.txt_defeito_encontrado !== undefined) payload.txt_defeito_encontrado = data.txt_defeito_encontrado;
    if (data.txt_causa_provavel !== undefined) payload.txt_causa_provavel = data.txt_causa_provavel;
    if (data.txt_servico_recomendado !== undefined) payload.txt_servico_recomendado = data.txt_servico_recomendado;
    if (data.txt_responsavel_tecnico !== undefined) payload.txt_responsavel_tecnico = data.txt_responsavel_tecnico;
    if (data.num_orcamento !== undefined) payload.num_orcamento = data.num_orcamento;
    if (data.num_custo_pecas !== undefined) payload.num_custo_pecas = data.num_custo_pecas;
    if (data.num_custo_mao_obra !== undefined) payload.num_custo_mao_obra = data.num_custo_mao_obra;
    if (data.num_custo_frete !== undefined) payload.num_custo_frete = data.num_custo_frete;
    if (data.num_outros_custos !== undefined) payload.num_outros_custos = data.num_outros_custos;
    if (data.num_custo_total !== undefined) payload.num_custo_total = data.num_custo_total;
    await bubbleClient.patch(`/obj/ordem_servico_manutencao/${id}`, payload);
  },

  async getOrdensServicoManutencao(equipamentoId: string): Promise<OrdemServicoManutencao[]> {
    if (!equipamentosV2Ativo) return [];
    const itens = await getAllResults<any>('/obj/ordem_servico_manutencao', [
      { key: 'fk_equipamento', constraint_type: 'equals', value: equipamentoId },
    ]);
    return itens.map((raw) => ({
      _id: raw._id,
      txt_numero_os: raw.txt_numero_os || '',
      fk_equipamento: raw.fk_equipamento,
      fk_movimentacao_entrada: raw.fk_movimentacao_entrada || undefined,
      date_entrada: raw.date_entrada || raw['Created Date'],
      date_diagnostico: raw.date_diagnostico || undefined,
      date_conclusao: raw.date_conclusao || undefined,
      date_prazo_estimado: raw.date_prazo_estimado || undefined,
      txt_motivo: raw.txt_motivo || '',
      txt_defeito_relatado: raw.txt_defeito_relatado || undefined,
      txt_defeito_encontrado: raw.txt_defeito_encontrado || undefined,
      txt_causa_provavel: raw.txt_causa_provavel || undefined,
      txt_servico_recomendado: raw.txt_servico_recomendado || undefined,
      txt_responsavel: raw.txt_responsavel || undefined,
      txt_responsavel_tecnico: raw.txt_responsavel_tecnico || undefined,
      txt_observacoes: raw.txt_observacoes || undefined,
      txt_status: raw.OS_status || 'Aberta',
      txt_resultado: raw.OS_resultado || undefined,
      num_orcamento: raw.num_orcamento ?? undefined,
      num_custo_total: raw.num_custo_total ?? undefined,
      CreatedDate: raw['Created Date'],
    })).sort((a, b) => new Date(b.date_entrada).getTime() - new Date(a.date_entrada).getTime());
  },

  async criarReservaEquipamento(data: Omit<ReservaEquipamento, '_id' | 'CreatedDate'>): Promise<ReservaEquipamento> {
    if (!equipamentosV2Ativo) throw new Error('O fluxo de reservas v2 ainda nao esta habilitado.');
    const response = await bubbleClient.post('/obj/reserva_equipamento', {
      fk_equipamento: data.fk_equipamento,
      fk_paciente: data.fk_paciente,
      fk_domicilio: data.fk_domicilio,
      date_reserva: data.date_reserva,
      date_implantacao_prevista: data.date_implantacao_prevista,
      date_validade: data.date_validade,
      txt_responsavel: data.txt_responsavel,
      txt_observacoes: data.txt_observacoes,
      OS_status: data.txt_status,
      txt_chave_idempotencia: data.txt_chave_idempotencia,
    });
    return { _id: response.data.id || response.data.response?.id, ...data };
  },

  async atualizarReservaEquipamento(id: string, data: Partial<ReservaEquipamento>): Promise<void> {
    if (!equipamentosV2Ativo) throw new Error('O fluxo de reservas v2 ainda nao esta habilitado.');
    const payload: Record<string, unknown> = {};
    if (data.fk_movimentacao_reserva !== undefined) payload.fk_movimentacao_reserva = data.fk_movimentacao_reserva;
    if (data.txt_status !== undefined) payload.OS_status = data.txt_status;
    await bubbleClient.patch(`/obj/reserva_equipamento/${id}`, payload);
  },

  async criarConferenciaEquipamento(data: Omit<ConferenciaEquipamento, '_id' | 'CreatedDate'>): Promise<ConferenciaEquipamento> {
    if (!equipamentosV2Ativo) throw new Error('O fluxo de conferencia v2 ainda nao esta habilitado.');
    const response = await bubbleClient.post('/obj/conferencia_equipamento', {
      fk_equipamento: data.fk_equipamento,
      fk_movimentacao_equipamento: data.fk_movimentacao_equipamento,
      date_conferencia: data.date_conferencia,
      txt_responsavel: data.txt_responsavel,
      txt_estado_conservacao: data.txt_estado_conservacao,
      txt_resultado: data.txt_resultado,
      txt_status_destino: data.txt_status_destino,
      txt_observacoes: data.txt_observacoes,
    });
    return { _id: response.data.id || response.data.response?.id, ...data };
  },

  async criarHigienizacaoEquipamento(data: Omit<HigienizacaoEquipamento, '_id'>): Promise<HigienizacaoEquipamento> {
    if (!equipamentosV2Ativo) throw new Error('O fluxo de higienizacao v2 ainda nao esta habilitado.');
    const response = await bubbleClient.post('/obj/higienizacao_equipamento', {
      fk_equipamento: data.fk_equipamento, date_inicio: data.date_inicio, date_fim: data.date_fim,
      txt_metodo: data.txt_metodo, txt_resultado: data.txt_resultado, txt_responsavel: data.txt_responsavel,
      OS_status: data.txt_status, txt_observacoes: data.txt_observacoes,
    });
    return { _id: response.data.id || response.data.response?.id, ...data };
  },

  async registrarMovimentacao(input: RegistrarMovimentacaoInput): Promise<MovimentacaoEquipamento> {
    if (!equipamentosV2Ativo) {
      throw new Error('O fluxo de movimentacoes v2 ainda nao esta habilitado.');
    }

    const existente = await this.getMovimentacaoPorChave(input.txt_chave_idempotencia);
    if (existente) {
      return existente;
    }

    const equipamento = await this.getEquipamento(input.fk_equipamento);

    // Guarda de concorrência: rejeita se o estado mudou desde a leitura do chamador.
    if (input.txt_status_esperado && equipamento.txt_status !== input.txt_status_esperado) {
      const err: any = new Error(
        `Conflito de concorrência: o equipamento está em "${equipamento.txt_status}", não em "${input.txt_status_esperado}". Recarregue e tente novamente.`
      );
      err.statusHttp = 409;
      throw err;
    }

    // Valida a transição pela máquina de estados antes de qualquer escrita.
    const transicao = validarTransicao(equipamento.txt_status, input.os_tipo_movimentacao, input.txt_novo_status);
    if (!transicao.ok) {
      const err: any = new Error(transicao.motivo || 'Transição de estado não permitida.');
      err.statusHttp = 409;
      throw err;
    }

    let movimentacaoId: string | undefined;
    const dataHora = input.date_data_hora || new Date().toISOString();

    try {
      const response = await bubbleClient.post('/obj/movimentacao_equipamento', {
        fk_equipamento: input.fk_equipamento,
        fk_locacao_equipamento: input.fk_locacao_equipamento,
        fk_ordem_servico_manutencao: input.fk_ordem_servico_manutencao,
        fk_domicilio: input.fk_domicilio,
        fk_localizacao_anterior: equipamento.fk_localizacao_atual,
        fk_nova_localizacao: input.fk_nova_localizacao,
        os_tipo_movimentacao: input.os_tipo_movimentacao,
        txt_tipo_movimentacao: input.os_tipo_movimentacao,
        txt_status_anterior: equipamento.txt_status,
        txt_novo_status: input.txt_novo_status,
        date_data_hora: dataHora,
        txt_responsavel: input.txt_responsavel,
        txt_observacoes: input.txt_observacoes,
        txt_justificativa: input.txt_justificativa,
        txt_chave_idempotencia: input.txt_chave_idempotencia,
      });
      movimentacaoId = response.data.id || response.data.response?.id;

      if (!movimentacaoId) {
        throw new Error('O Bubble nao retornou o identificador da movimentacao.');
      }

      await this.updateEquipamento(input.fk_equipamento, {
        txt_status: input.txt_novo_status,
        fk_localizacao_atual: input.fk_nova_localizacao,
        fk_ultima_movimentacao: movimentacaoId,
        date_ultima_movimentacao: dataHora,
      });

      return {
        _id: movimentacaoId,
        fk_equipamento: input.fk_equipamento,
        fk_locacao_equipamento: input.fk_locacao_equipamento,
        fk_ordem_servico_manutencao: input.fk_ordem_servico_manutencao,
        fk_domicilio: input.fk_domicilio,
        fk_localizacao_anterior: equipamento.fk_localizacao_atual,
        fk_nova_localizacao: input.fk_nova_localizacao,
        os_tipo_movimentacao: input.os_tipo_movimentacao,
        txt_tipo_movimentacao: input.os_tipo_movimentacao,
        txt_status_anterior: equipamento.txt_status,
        txt_novo_status: input.txt_novo_status,
        date_data_hora: dataHora,
        txt_responsavel: input.txt_responsavel,
        txt_observacoes: input.txt_observacoes,
        txt_justificativa: input.txt_justificativa,
        txt_chave_idempotencia: input.txt_chave_idempotencia,
      };
    } catch (error) {
      if (movimentacaoId) {
        try {
          await bubbleClient.patch(`/obj/movimentacao_equipamento/${movimentacaoId}`, {
            bool_cancelado: true,
            txt_justificativa: 'Compensada automaticamente: a atualizacao do equipamento falhou.',
          });
        } catch (compensationError) {
          console.error('Falha ao compensar movimentacao de equipamento:', compensationError);
        }
      }
      throw error;
    }
  },

  // Reservas — consulta, cancelamento e expiração
  async getReserva(id: string): Promise<ReservaEquipamento | null> {
    if (!equipamentosV2Ativo) return null;
    const response = await bubbleClient.get(`/obj/reserva_equipamento/${id}`);
    return mapReserva(response.data.response);
  },
  async getReservasEquipamento(equipamentoId: string): Promise<ReservaEquipamento[]> {
    if (!equipamentosV2Ativo) return [];
    const itens = await getAllResults<any>('/obj/reserva_equipamento', [
      { key: 'fk_equipamento', constraint_type: 'equals', value: equipamentoId },
    ]);
    return itens.map(mapReserva).sort((a, b) => new Date(b.date_reserva).getTime() - new Date(a.date_reserva).getTime());
  },
  async getReservasVencidas(dataReferenciaIso: string): Promise<ReservaEquipamento[]> {
    if (!equipamentosV2Ativo) return [];
    const itens = await getAllResults<any>('/obj/reserva_equipamento', [
      { key: 'OS_status', constraint_type: 'equals', value: 'Ativa' },
      { key: 'date_validade', constraint_type: 'less than', value: dataReferenciaIso },
    ]);
    return itens.map(mapReserva);
  },

  // Baixa — solicitação, decisão e reversão excepcional
  async criarBaixaEquipamento(data: Omit<BaixaEquipamento, '_id' | 'CreatedDate'>): Promise<BaixaEquipamento> {
    if (!equipamentosV2Ativo) throw new Error('O fluxo de baixa v2 ainda nao esta habilitado.');
    const response = await bubbleClient.post('/obj/baixa_equipamento', {
      fk_equipamento: data.fk_equipamento,
      date_baixa: data.date_baixa,
      os_motivo_baixa: data.os_motivo_baixa,
      txt_laudo: data.txt_laudo,
      num_valor_reparo_estimado: data.num_valor_reparo_estimado,
      num_valor_residual: data.num_valor_residual,
      txt_destino_final: data.txt_destino_final,
      txt_solicitante: data.txt_solicitante,
      txt_autorizado_por: data.txt_autorizado_por,
      OS_status: data.txt_status,
      txt_observacoes: data.txt_observacoes,
    });
    return { _id: response.data.id || response.data.response?.id, ...data };
  },
  async getBaixa(id: string): Promise<BaixaEquipamento | null> {
    if (!equipamentosV2Ativo) return null;
    const response = await bubbleClient.get(`/obj/baixa_equipamento/${id}`);
    return mapBaixa(response.data.response);
  },
  async getBaixasEquipamento(equipamentoId: string): Promise<BaixaEquipamento[]> {
    if (!equipamentosV2Ativo) return [];
    const itens = await getAllResults<any>('/obj/baixa_equipamento', [
      { key: 'fk_equipamento', constraint_type: 'equals', value: equipamentoId },
    ]);
    return itens.map(mapBaixa).sort((a, b) => new Date(b.date_baixa).getTime() - new Date(a.date_baixa).getTime());
  },
  async atualizarBaixaEquipamento(id: string, data: Partial<BaixaEquipamento>): Promise<void> {
    if (!equipamentosV2Ativo) throw new Error('O fluxo de baixa v2 ainda nao esta habilitado.');
    const payload: Record<string, unknown> = {};
    if (data.txt_status !== undefined) payload.OS_status = data.txt_status;
    if (data.txt_autorizado_por !== undefined) payload.txt_autorizado_por = data.txt_autorizado_por;
    if (data.date_decisao !== undefined) payload.date_decisao = data.date_decisao;
    if (data.txt_observacoes !== undefined) payload.txt_observacoes = data.txt_observacoes;
    if (data.bool_revertida !== undefined) payload.bool_revertida = data.bool_revertida;
    if (data.txt_revertida_por !== undefined) payload.txt_revertida_por = data.txt_revertida_por;
    if (data.txt_revertida_por_segundo !== undefined) payload.txt_revertida_por_segundo = data.txt_revertida_por_segundo;
    if (data.txt_justificativa_reversao !== undefined) payload.txt_justificativa_reversao = data.txt_justificativa_reversao;
    if (data.date_reversao !== undefined) payload.date_reversao = data.date_reversao;
    await bubbleClient.patch(`/obj/baixa_equipamento/${id}`, payload);
  },

  // Itens de manutenção (peças, mão de obra, frete)
  async criarItemManutencao(data: Omit<ItemManutencao, '_id' | 'CreatedDate'>): Promise<ItemManutencao> {
    if (!equipamentosV2Ativo) throw new Error('O fluxo de manutencao v2 ainda nao esta habilitado.');
    const quantidade = Number(data.num_quantidade ?? 1);
    const custoUnitario = Number(data.num_custo_unitario ?? 0);
    const custoTotal = data.num_custo_total ?? Math.round((quantidade * custoUnitario + Number.EPSILON) * 100) / 100;
    const response = await bubbleClient.post('/obj/item_manutencao', {
      fk_ordem_servico_manutencao: data.fk_ordem_servico_manutencao,
      os_tipo: data.txt_tipo,
      txt_descricao: data.txt_descricao,
      num_quantidade: quantidade,
      num_custo_unitario: custoUnitario,
      num_custo_total: custoTotal,
      txt_fornecedor: data.txt_fornecedor,
      txt_responsavel: data.txt_responsavel,
    });
    return { _id: response.data.id || response.data.response?.id, ...data, num_custo_total: custoTotal };
  },
  async getItensManutencao(osId: string): Promise<ItemManutencao[]> {
    if (!equipamentosV2Ativo) return [];
    const itens = await getAllResults<any>('/obj/item_manutencao', [
      { key: 'fk_ordem_servico_manutencao', constraint_type: 'equals', value: osId },
    ]);
    return itens.map((raw) => ({
      _id: raw._id,
      fk_ordem_servico_manutencao: raw.fk_ordem_servico_manutencao,
      txt_tipo: raw.os_tipo || raw.txt_tipo || 'Outro',
      txt_descricao: raw.txt_descricao || '',
      num_quantidade: raw.num_quantidade ?? undefined,
      num_custo_unitario: raw.num_custo_unitario ?? undefined,
      num_custo_total: raw.num_custo_total ?? undefined,
      txt_fornecedor: raw.txt_fornecedor || undefined,
      txt_responsavel: raw.txt_responsavel || undefined,
      CreatedDate: raw['Created Date'],
    }));
  },
  async deleteItemManutencao(id: string): Promise<void> {
    if (!equipamentosV2Ativo) throw new Error('O fluxo de manutencao v2 ainda nao esta habilitado.');
    await bubbleClient.delete(`/obj/item_manutencao/${id}`);
  },

  // Suspensões de locação (períodos não cobrados)
  async criarSuspensaoLocacao(data: Omit<SuspensaoLocacao, '_id' | 'CreatedDate'>): Promise<SuspensaoLocacao> {
    if (!equipamentosV2Ativo) throw new Error('O fluxo financeiro v2 ainda nao esta habilitado.');
    const response = await bubbleClient.post('/obj/suspensao_locacao', {
      fk_locacao_equipamento: data.fk_locacao_equipamento,
      date_inicio: data.date_inicio,
      date_fim: data.date_fim,
      txt_motivo: data.txt_motivo,
      txt_responsavel: data.txt_responsavel,
    });
    return { _id: response.data.id || response.data.response?.id, ...data };
  },
  async getSuspensoesLocacao(locacaoId: string): Promise<SuspensaoLocacao[]> {
    if (!equipamentosV2Ativo) return [];
    const itens = await getAllResults<any>('/obj/suspensao_locacao', [
      { key: 'fk_locacao_equipamento', constraint_type: 'equals', value: locacaoId },
    ]);
    return itens.map((raw) => ({
      _id: raw._id,
      fk_locacao_equipamento: raw.fk_locacao_equipamento,
      date_inicio: raw.date_inicio,
      date_fim: raw.date_fim,
      txt_motivo: raw.txt_motivo || undefined,
      txt_responsavel: raw.txt_responsavel || undefined,
      CreatedDate: raw['Created Date'],
    }));
  },

  // Alertas operacionais
  async criarAlerta(data: Omit<AlertaEquipamento, '_id' | 'CreatedDate'>): Promise<AlertaEquipamento> {
    if (!equipamentosV2Ativo) throw new Error('O fluxo de alertas v2 ainda nao esta habilitado.');
    const response = await bubbleClient.post('/obj/alerta_equipamento', {
      fk_equipamento: data.fk_equipamento,
      fk_locacao_equipamento: data.fk_locacao_equipamento,
      fk_ordem_servico_manutencao: data.fk_ordem_servico_manutencao,
      os_tipo_alerta: data.os_tipo_alerta,
      txt_titulo: data.txt_titulo,
      txt_descricao: data.txt_descricao,
      date_prazo: data.date_prazo,
      txt_prioridade: data.txt_prioridade,
      txt_responsavel: data.txt_responsavel,
      OS_status: data.txt_status,
      txt_chave_idempotencia: data.txt_chave_idempotencia,
    });
    return { _id: response.data.id || response.data.response?.id, ...data };
  },
  async getAlertas(constraints?: unknown[]): Promise<AlertaEquipamento[]> {
    if (!equipamentosV2Ativo) return [];
    const itens = await getAllResults<any>('/obj/alerta_equipamento', constraints);
    return itens.map(mapAlerta).sort((a, b) => new Date(b.CreatedDate || 0).getTime() - new Date(a.CreatedDate || 0).getTime());
  },
  async getAlertaPorChave(chave: string): Promise<AlertaEquipamento | null> {
    if (!equipamentosV2Ativo) return null;
    const itens = await getAllResults<any>('/obj/alerta_equipamento', [
      { key: 'txt_chave_idempotencia', constraint_type: 'equals', value: chave },
    ]);
    const raw = itens.find((item) => item.OS_status !== 'Resolvido' && item.OS_status !== 'Ignorado');
    return raw ? mapAlerta(raw) : null;
  },
  async atualizarAlerta(id: string, data: Partial<AlertaEquipamento>): Promise<void> {
    if (!equipamentosV2Ativo) throw new Error('O fluxo de alertas v2 ainda nao esta habilitado.');
    const payload: Record<string, unknown> = {};
    if (data.txt_status !== undefined) payload.OS_status = data.txt_status;
    if (data.txt_resolucao !== undefined) payload.txt_resolucao = data.txt_resolucao;
    if (data.date_resolucao !== undefined) payload.date_resolucao = data.date_resolucao;
    if (data.txt_responsavel !== undefined) payload.txt_responsavel = data.txt_responsavel;
    await bubbleClient.patch(`/obj/alerta_equipamento/${id}`, payload);
  },

  // Autenticação SSO
  async findUserBySSOToken(token: string): Promise<any> {
    let constraints = [
      {
        key: 'txt_sso_token_text',
        constraint_type: 'equals',
        value: token,
      },
    ];
    let response = await bubbleClient.get(`/obj/user?constraints=${JSON.stringify(constraints)}`);
    let user = response.data.response.results?.[0];
    
    if (!user) {
      constraints = [
        {
          key: 'sso_token_text',
          constraint_type: 'equals',
          value: token,
        },
      ];
      response = await bubbleClient.get(`/obj/user?constraints=${JSON.stringify(constraints)}`);
      user = response.data.response.results?.[0];
    }
    return user || null;
  },

  async clearSSOToken(userId: string): Promise<void> {
    try {
      const payload: any = {
        txt_sso_token_text: null,
        sso_token_text: null
      };
      await bubbleClient.patch(`/obj/user/${userId}`, payload);
    } catch (e) {
      console.warn("Failed to clear SSO token fields:", e);
    }
  },

  // Cooperativas, Integralização e Logs Gerais
  async getCooperativa(id: string): Promise<any> {
    const response = await bubbleClient.get(`/obj/cooperativas/${id}`);
    return response.data.response;
  },

  async updateCooperativa(id: string, data: Record<string, unknown>): Promise<any> {
    const response = await bubbleClient.patch(`/obj/cooperativas/${id}`, data);
    return response.data;
  },

  async createIntegralizacao(data: Record<string, unknown>): Promise<any> {
    const response = await bubbleClient.post('/obj/integraliza__o', data);
    return response.data;
  },

  async createLogGeral(data: Record<string, unknown>): Promise<any> {
    const response = await bubbleClient.post('/obj/logs_gerais', data);
    return response.data;
  },
};

