import axios from 'axios';

const zapsignClient = axios.create({
  baseURL: process.env.ZAPSIGN_BASE_URL || 'https://sandbox.api.zapsign.com.br/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface ZapSignDocumentResponse {
  token: string;
  name: string;
  status: string;
  signers: Array<{
    token: string;
    name: string;
    email: string;
    sign_url: string;
    status: string;
  }>;
}

export const zapsignApi = {
  async createDocument(name: string, pdfBase64: string, signerName: string, signerEmail: string): Promise<ZapSignDocumentResponse> {
    const token = process.env.ZAPSIGN_API_TOKEN;
    const response = await zapsignClient.post(
      `/docs/?api_token=${token}`,
      {
        name,
        base64_pdf: pdfBase64,
        signers: [
          {
            name: signerName,
            email: signerEmail,
            send_automatic_email: false,
            send_automatic_whatsapp: false,
            blank_signature_log: true,
          },
        ],
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    return response.data;
  },
};
