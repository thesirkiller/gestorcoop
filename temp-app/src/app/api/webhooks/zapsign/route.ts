import { NextResponse } from 'next/server';
import { bubbleApi } from '@/lib/bubble';
import { zapsignApi } from '@/lib/zapsign';
import { normalizarUrlDocumento } from '@/lib/documentos';

export const runtime = 'edge';

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const event = payload.event_type || payload.event;
    if (event !== 'doc_signed' && event !== 'doc_completed') {
      return NextResponse.json({ success: true, message: 'Evento ignorado' });
    }
    const token = payload.token || payload.document?.token;
    if (typeof token !== 'string' || !token) {
      return NextResponse.json({ error: 'Token do documento ausente' }, { status: 400 });
    }

    // Consulta autenticada: não confia em status, e-mail ou URL do webhook público.
    const document = await zapsignApi.getDocument(token);
    if (document.token !== token || document.deleted || document.status !== 'signed') {
      return NextResponse.json({ success: true, message: 'Documento ainda não concluído' });
    }
    const signedUrl = normalizarUrlDocumento(document.signed_file);
    if (!signedUrl) throw new Error('PDF assinado indisponível na ZapSign.');
    const email = document.signers?.[0]?.email;
    const cooperado = document.external_id
      ? await bubbleApi.getCooperado(document.external_id)
      : email ? await bubbleApi.findCooperadoByEmail(email) : null;
    if (!cooperado) return NextResponse.json({ error: 'Cooperado não encontrado' }, { status: 404 });

    const filename = `termo-assinado-${token}.pdf`;
    const currentPasta: string[] = cooperado.fks_pasta || [];
    const saved = currentPasta.find(url => url.split('?')[0].endsWith(`/${filename}`));
    let permanentUrl = saved;
    if (!permanentUrl) {
      // signed_file expira em 60 minutos: preserva o PDF no armazenamento do app.
      const response = await fetch(signedUrl, { signal: AbortSignal.timeout(30_000) });
      if (!response.ok) throw new Error('Não foi possível baixar o PDF assinado.');
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') throw new Error('A ZapSign não retornou um PDF.');
      let binary = '';
      for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...Array.from(bytes.slice(i, i + 8192)));
      permanentUrl = await bubbleApi.uploadFile(filename, btoa(binary));
    }
    await bubbleApi.updateCooperado(cooperado._id, {
      txt_termo_status: 'Assinado',
      file_termo_assinado: permanentUrl,
      fks_pasta: Array.from(new Set([...currentPasta, permanentUrl])),
    });
    return NextResponse.json({ success: true, message: 'Termo assinado salvo' });
  } catch (error) {
    console.error('Erro no webhook da ZapSign:', error instanceof Error ? error.message : 'Erro desconhecido');
    return NextResponse.json({ error: 'Não foi possível salvar o termo assinado. Reenvie o evento.' }, { status: 502 });
  }
}
