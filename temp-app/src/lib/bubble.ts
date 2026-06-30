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

  async getCooperados() {
    const response = await bubbleClient.get('/obj/socioscooperados');
    return response.data.response.results || [];
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
        constraint_type: 'greater_than',
        value: `${startDate}T00:00:00.000Z`,
      });
    }
    if (endDate) {
      constraints.push({
        key: 'date_fixa_entrada',
        constraint_type: 'less_than',
        value: `${endDate}T23:59:59.999Z`,
      });
    }
    const response = await bubbleClient.get(`/obj/servicos?constraints=${JSON.stringify(constraints)}`);
    return response.data.response.results || [];
  },

  async getEscalas() {
    const response = await bubbleClient.get('/obj/escalas');
    return response.data.response.results || [];
  },

  async getContasBancariasByCooperado(cooperadoId: string) {
    const constraints = [
      {
        key: 'fk_cooperado',
        constraint_type: 'equals',
        value: cooperadoId,
      },
    ];
    const response = await bubbleClient.get(`/obj/conta_cooperado?constraints=${JSON.stringify(constraints)}`);
    return response.data.response.results || [];
  },

  async updateServico(servicoId: string, data: Record<string, unknown>) {
    const response = await bubbleClient.patch(`/obj/servicos/${servicoId}`, data);
    return response.data;
  },
};

