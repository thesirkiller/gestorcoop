import { NextResponse } from 'next/server';
import { bubbleApi } from '@/lib/bubble';

export const runtime = 'edge';

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    console.log('Recebido webhook da ZapSign:', JSON.stringify(payload));

    const event = payload.event;
    // ZapSign events can be doc_signed, doc_completed, etc.
    if (event === 'doc_signed' || event === 'doc_completed' || payload.signed_pdf_url) {
      const document = payload.document || {};
      const signedPdfUrl = payload.signed_pdf_url || document.signed_file;
      const signers = document.signers || [];
      const primarySigner = signers[0] || {};
      const email = primarySigner.email || payload.signer_email;

      if (!email || !signedPdfUrl) {
        console.warn('Webhook recebido sem e-mail do signatário ou URL do PDF assinado');
        return NextResponse.json({ success: false, message: 'Dados incompletos' });
      }

      console.log(`Buscando cooperado com e-mail: ${email}`);
      const cooperado = await bubbleApi.findCooperadoByEmail(email);

      if (cooperado) {
        const currentPasta = cooperado.fks_pasta || [];
        const updateData: Record<string, unknown> = {
          txt_termo_status: 'Assinado',
          file_termo_assinado: signedPdfUrl,
        };

        // Also append signed document to fks_pasta list if not already there
        if (!currentPasta.includes(signedPdfUrl)) {
          updateData.fks_pasta = [...currentPasta, signedPdfUrl];
        }

        console.log(`Atualizando status de assinatura e termo para o cooperado ${cooperado._id}`);
        await bubbleApi.updateCooperado(cooperado._id, updateData);

        return NextResponse.json({ success: true, message: 'Cooperado atualizado' });
      } else {
        console.warn(`Cooperado não encontrado para o e-mail: ${email}`);
        return NextResponse.json({ success: false, message: 'Cooperado não encontrado' });
      }
    }

    return NextResponse.json({ success: true, message: 'Evento ignorado' });
  } catch (error) {
    const err = error as { message?: string };
    console.error('Erro no processamento do webhook da ZapSign:', err);
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 });
  }
}
