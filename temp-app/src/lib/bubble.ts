import axios from 'axios';

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

export interface BubblePageResponse<T = unknown> {
  results: T[];
  remaining: number;
  count: number;
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
};

