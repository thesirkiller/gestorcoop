export interface ZapSignDocumentResponse {
  token: string;
  name: string;
  status: string;
  external_id?: string;
  signed_file?: string;
  deleted?: boolean;
  signers: Array<{
    token: string;
    name: string;
    email: string;
    sign_url: string;
    status: string;
  }>;
}

export const zapsignApi = {
  async getDocument(documentToken: string): Promise<ZapSignDocumentResponse> {
    const token = (process.env.ZAPSIGN_API_TOKEN || '').trim().replace(/^Bearer\s+/i, '').trim();
    if (!token) throw new Error('Integração ZapSign não configurada.');
    const configuredUrl = (process.env.ZAPSIGN_BASE_URL || 'https://api.zapsign.com.br/api/v1').trim().replace(/\/+$/, '');
    const baseUrl = configuredUrl.endsWith('/api/v1') ? configuredUrl : `${configuredUrl}/api/v1`;
    const response = await fetch(`${baseUrl}/docs/${encodeURIComponent(documentToken)}/`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(30_000),
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`ZapSign API error (${response.status})`);
    return response.json();
  },
  async createDocument(name: string, pdfBase64: string, signerName: string, signerEmail: string, cooperadoId?: string): Promise<ZapSignDocumentResponse> {
    const rawEnvToken = process.env.ZAPSIGN_API_TOKEN || '';
    const token = rawEnvToken.trim().replace(/^Bearer\s+/i, '').trim();
    if (!token) throw new Error('Integração ZapSign não configurada.');
    const configuredUrl = (process.env.ZAPSIGN_BASE_URL || 'https://api.zapsign.com.br/api/v1').trim().replace(/\/+$/, '');
    const baseUrl = configuredUrl.endsWith('/api/v1') ? configuredUrl : `${configuredUrl}/api/v1`;
    
    const url = `${baseUrl}/docs/`;
    
    const webhookUrl = (process.env.ZAPSIGN_WEBHOOK_URL || (process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, '')}/api/webhooks/zapsign` : 'https://gestorcoop.app/api/webhooks/zapsign')).trim();
    
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(60_000),
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name,
          external_id: cooperadoId,
          base64_pdf: pdfBase64,
          ...(webhookUrl ? { webhook_url: webhookUrl } : {}),
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
        throw new Error(`ZapSign API error (${response.status})`);
      }

      const data = await response.json();
      const signUrl = data.signers?.[0]?.sign_url;
      let validSignUrl = false;
      try {
        const parsed = new URL(signUrl);
        // A ZapSign entrega o link do signatário como `/verificar/<uuid>`;
        // `/sign/<uuid>` é o formato antigo. Aceitar só `/sign/` fazia esta
        // função descartar toda resposta legítima e devolver "a ZapSign não
        // retornou um link de assinatura válido" mesmo com HTTP 200.
        validSignUrl = parsed.protocol === 'https:' && !parsed.username && !parsed.password &&
          (parsed.hostname === 'zapsign.com.br' || parsed.hostname.endsWith('.zapsign.com.br')) &&
          /^\/(sign|verificar)\/[^/]+/.test(parsed.pathname);
      } catch { /* Resposta incompleta do provedor. */ }
      if (!data.token || !validSignUrl) throw new Error('A ZapSign não retornou um link de assinatura válido.');
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
