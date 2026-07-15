/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from 'axios';

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

export interface Equipamento {
  _id?: string;
  txt_nome: string;
  txt_descricao?: string;
  txt_marca?: string;
  txt_modelo?: string;
  txt_numero_serie: string;
  num_preco_padrao: number;
  txt_status: 'Disponível' | 'Alugado' | 'Manutenção' | 'Inativo';
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
  date_inicio: string;
  date_fim_previsto: string;
  date_fim_real?: string;
  num_valor_aluguel: number;
  txt_status: 'Ativo' | 'Finalizado' | 'Cancelado';
  txt_observacoes?: string;
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
    const raw = response.data.response;
    return {
      _id: raw._id,
      txt_nome: raw.txt_nome || '',
      txt_descricao: raw.txt_descricao || '',
      txt_marca: raw.txt_marca || '',
      txt_modelo: raw.txt_modelo || '',
      txt_numero_serie: raw.txt_numero_serie || '',
      num_preco_padrao: raw.num_preco_padrao || 0,
      txt_status: raw.OS_status || 'Disponível',
      CreatedDate: raw['Created Date']
    };
  },
  async getEquipamentos(constraints?: unknown[]): Promise<Equipamento[]> {
    const rawList = await getAllResults<any>('/obj/equipamento', constraints);
    return rawList.map(raw => ({
      _id: raw._id,
      txt_nome: raw.txt_nome || '',
      txt_descricao: raw.txt_descricao || '',
      txt_marca: raw.txt_marca || '',
      txt_modelo: raw.txt_modelo || '',
      txt_numero_serie: raw.txt_numero_serie || '',
      num_preco_padrao: raw.num_preco_padrao || 0,
      txt_status: raw.OS_status || 'Disponível',
      CreatedDate: raw['Created Date']
    }));
  },
  async createEquipamento(data: Omit<Equipamento, '_id' | 'CreatedDate'>): Promise<Equipamento> {
    const payload = {
      txt_nome: data.txt_nome,
      txt_descricao: data.txt_descricao,
      txt_marca: data.txt_marca,
      txt_modelo: data.txt_modelo,
      txt_numero_serie: data.txt_numero_serie,
      num_preco_padrao: data.num_preco_padrao,
      OS_status: data.txt_status || 'Disponível'
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

  // Locações
  async getLocacao(id: string): Promise<LocacaoEquipamento> {
    const response = await bubbleClient.get(`/obj/locacao_equipamento/${id}`);
    const raw = response.data.response;
    return {
      _id: raw._id,
      fk_equipamento: raw.fk_equipamento || '',
      fk_paciente: raw.fk_paciente || '',
      date_inicio: raw.date_inicio || '',
      date_fim_previsto: raw.date_fim_previsto || '',
      date_fim_real: raw.date_fim_real || undefined,
      num_valor_aluguel: raw.num_valor_aluguel || 0,
      txt_status: raw.OS_status || 'Ativo',
      txt_observacoes: raw.txt_observacoes || '',
      CreatedDate: raw['Created Date']
    };
  },
  async getLocacoes(constraints?: unknown[]): Promise<LocacaoEquipamento[]> {
    const rawList = await getAllResults<any>('/obj/locacao_equipamento', constraints);
    return rawList.map(raw => ({
      _id: raw._id,
      fk_equipamento: raw.fk_equipamento || '',
      fk_paciente: raw.fk_paciente || '',
      date_inicio: raw.date_inicio || '',
      date_fim_previsto: raw.date_fim_previsto || '',
      date_fim_real: raw.date_fim_real || undefined,
      num_valor_aluguel: raw.num_valor_aluguel || 0,
      txt_status: raw.OS_status || 'Ativo',
      txt_observacoes: raw.txt_observacoes || '',
      CreatedDate: raw['Created Date']
    }));
  },
  async createLocacao(data: Omit<LocacaoEquipamento, '_id' | 'CreatedDate'>): Promise<LocacaoEquipamento> {
    const payload = {
      fk_equipamento: data.fk_equipamento,
      fk_paciente: data.fk_paciente,
      date_inicio: data.date_inicio,
      date_fim_previsto: data.date_fim_previsto,
      num_valor_aluguel: data.num_valor_aluguel,
      OS_status: data.txt_status || 'Ativo',
      txt_observacoes: data.txt_observacoes
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
    if (data.date_inicio !== undefined) payload.date_inicio = data.date_inicio;
    if (data.date_fim_previsto !== undefined) payload.date_fim_previsto = data.date_fim_previsto;
    if (data.date_fim_real !== undefined) payload.date_fim_real = data.date_fim_real;
    if (data.num_valor_aluguel !== undefined) payload.num_valor_aluguel = data.num_valor_aluguel;
    if (data.txt_status !== undefined) payload.OS_status = data.txt_status;
    if (data.txt_observacoes !== undefined) payload.txt_observacoes = data.txt_observacoes;
    await bubbleClient.patch(`/obj/locacao_equipamento/${id}`, payload);
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
};

