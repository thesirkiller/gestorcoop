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
    const rawEnvToken = process.env.ZAPSIGN_API_TOKEN || '';
    const token = rawEnvToken.replace(/^Bearer\s+/i, '').trim();
    const baseUrl = (process.env.ZAPSIGN_BASE_URL || 'https://api.zapsign.com.br/api/v1').replace(/\/$/, '');
    
    const url = `${baseUrl}/docs/`;
    
    console.log(`[ZapSign API] Sending request to: ${url}`);
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
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
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null) || await response.text();
        throw {
          response: {
            data: errorData
          },
          message: `ZapSign API error (${response.status})`
        };
      }

      const data = await response.json();
      return data as ZapSignDocumentResponse;
    } catch (err) {
      const error = err as { response?: unknown; message?: string };
      if (error.response) {
        throw error;
      }
      throw {
        message: error.message || 'Erro de rede ou conexão com ZapSign'
      };
    }
  },
};
