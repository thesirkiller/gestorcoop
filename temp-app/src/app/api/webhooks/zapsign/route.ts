import { NextResponse } from 'next/server';
import { bubbleApi } from '@/lib/bubble';
import { zapsignApi } from '@/lib/zapsign';
import { normalizarUrlDocumento } from '@/lib/documentos';

export const runtime = 'edge';

async function syncZapSignDocument(token: string, fallbackCooperadoId?: string) {
  if (typeof token !== 'string' || !token.trim()) {
    throw new Error('Token do documento ausente');
  }

  // Consulta autenticada: não confia em status, e-mail ou URL do webhook público.
  const document = await zapsignApi.getDocument(token.trim());
  const isSigned = document.status === 'signed' || document.status === 'completed';
  if (document.token !== token.trim() || document.deleted || !isSigned) {
    return { success: false, status: document.status, message: 'Documento ainda não concluído' };
  }

  const signedUrl = normalizarUrlDocumento(document.signed_file);
  if (!signedUrl) throw new Error('PDF assinado indisponível na ZapSign.');

  const email = document.signers?.[0]?.email;
  const cooperadoId = document.external_id || fallbackCooperadoId;
  const cooperado = cooperadoId
    ? await bubbleApi.getCooperado(cooperadoId)
    : email ? await bubbleApi.findCooperadoByEmail(email) : null;

  if (!cooperado) {
    return { success: false, message: 'Cooperado não encontrado' };
  }

  const filename = `termo-assinado-${token.trim()}.pdf`;
  const currentPasta: string[] = cooperado.fks_pasta || [];
  const saved = currentPasta.find(url => typeof url === 'string' && url.split('?')[0].endsWith(`/${filename}`));
  let permanentUrl = saved;

  if (!permanentUrl) {
    // signed_file expira em 60 minutos: preserva o PDF no armazenamento do app.
    const response = await fetch(signedUrl, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error('Não foi possível baixar o PDF assinado.');
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') throw new Error('A ZapSign não retornou um PDF.');
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) {
      binary += String.fromCharCode(...Array.from(bytes.slice(i, i + 8192)));
    }
    permanentUrl = await bubbleApi.uploadFile(filename, btoa(binary));
  }

  await bubbleApi.updateCooperado(cooperado._id, {
    txt_termo_status: 'Assinado',
    file_termo_assinado: permanentUrl,
    fks_pasta: Array.from(new Set([...currentPasta, permanentUrl])),
  });

  return {
    success: true,
    cooperadoId: cooperado._id,
    status: 'Assinado',
    fileUrl: permanentUrl,
    message: 'Termo assinado salvo',
  };
}

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => ({}));
    const event = (payload.event_type || payload.event || payload.action || '').toLowerCase().trim();
    if (event && !event.includes('signed') && !event.includes('completed')) {
      return NextResponse.json({ success: true, message: 'Evento ignorado' });
    }

    const token = payload.token || payload.document?.token || payload.doc?.token;
    if (typeof token !== 'string' || !token) {
      return NextResponse.json({ error: 'Token do documento ausente' }, { status: 400 });
    }

    const result = await syncZapSignDocument(token, payload.external_id || payload.document?.external_id);
    if (!result.success && result.message === 'Cooperado não encontrado') {
      return NextResponse.json({ error: 'Cooperado não encontrado' }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error('Erro no webhook da ZapSign:', error instanceof Error ? error.message : 'Erro desconhecido');
    return NextResponse.json({ error: 'Não foi possível salvar o termo assinado. Reenvie o evento.' }, { status: 502 });
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get('token');
    const cooperadoId = url.searchParams.get('cooperadoId');

    if (!token && !cooperadoId) {
      return NextResponse.json({ error: 'Parâmetro token ou cooperadoId é obrigatório' }, { status: 400 });
    }

    if (token) {
      const result = await syncZapSignDocument(token, cooperadoId || undefined);
      return NextResponse.json(result);
    }

    // Se só passou cooperadoId, verifica status atual no Bubble
    const cooperado = await bubbleApi.getCooperado(cooperadoId!);
    if (!cooperado) {
      return NextResponse.json({ error: 'Cooperado não encontrado' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      cooperadoId: cooperado._id,
      status: cooperado.txt_termo_status,
      fileUrl: cooperado.file_termo_assinado || null,
    });
  } catch (error) {
    console.error('Erro na sincronização da ZapSign:', error instanceof Error ? error.message : 'Erro desconhecido');
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro na sincronização' }, { status: 500 });
  }
}
