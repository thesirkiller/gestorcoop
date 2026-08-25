import { NextRequest, NextResponse } from 'next/server';
import { bubbleApi } from '@/lib/bubble';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

function parseDocumentInfo(url: string, isSignedTerm = false) {
  const cleanUrl = url.split('?')[0];
  const filename = cleanUrl.split('/').pop() || 'documento';
  const ext = (filename.split('.').pop() || '').toLowerCase();

  const isImage = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg'].includes(ext);
  const isPdf = ext === 'pdf' || cleanUrl.endsWith('.pdf') || url.includes('zapsign');

  let typeLabel = 'Documento';
  if (isSignedTerm) {
    typeLabel = 'Termo Assinado';
  } else if (isImage) {
    typeLabel = 'Foto / Imagem';
  } else if (isPdf) {
    typeLabel = 'Documento PDF';
  }

  return {
    url,
    filename: decodeURIComponent(filename),
    extension: ext.toUpperCase() || 'ARQUIVO',
    isImage,
    isPdf,
    isSignedTerm,
    typeLabel,
  };
}

// GET: List documents for a cooperado
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cooperadoId = params.id;
    let cooperado: any = null;
    try {
      cooperado = await bubbleApi.getCooperado(cooperadoId);
    } catch {
      // Fallback para IDs mockados
      if (cooperadoId.startsWith('coop_') || process.env.NODE_ENV === 'development') {
        cooperado = {
          _id: cooperadoId,
          txt_nomeCompleto: cooperadoId === 'coop_1' ? 'Juliana Ramos dos Santos' : cooperadoId === 'coop_2' ? 'Marcos Vinícius de Oliveira' : 'Dra. Beatriz Helena Meirelles',
          fks_pasta: [
            'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&auto=format&fit=crop&q=80',
            'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=800&auto=format&fit=crop&q=80',
            'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
          ],
          file_termo_assinado: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
        };
      }
    }

    if (!cooperado) {
      return NextResponse.json({ success: false, error: 'Cooperado não encontrado' }, { status: 404 });
    }

    const pastaUrls: string[] = cooperado.fks_pasta || [];
    const termoAssinadoUrl = cooperado.file_termo_assinado;

    const documents = pastaUrls.map((url: string) =>
      parseDocumentInfo(url, url === termoAssinadoUrl)
    );

    // If termo assinado is set but not in fks_pasta list, include it at the top
    if (termoAssinadoUrl && !pastaUrls.includes(termoAssinadoUrl)) {
      documents.unshift(parseDocumentInfo(termoAssinadoUrl, true));
    }

    return NextResponse.json({
      success: true,
      data: {
        cooperadoId,
        nomeCompleto: cooperado.txt_nomeCompleto || '',
        documents,
      },
    });
  } catch (error) {
    const err = error as { message?: string };
    console.error('Erro ao buscar documentos do cooperado:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Erro ao buscar documentos' },
      { status: 500 }
    );
  }
}

// POST: Add a new document (either via file upload or direct URL)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cooperadoId = params.id;
    const contentType = request.headers.get('content-type') || '';

    let fileUrl = '';
    let filename = '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;

      if (!file) {
        return NextResponse.json({ success: false, error: 'Nenhum arquivo enviado.' }, { status: 400 });
      }

      filename = file.name;
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      let binary = '';
      const len = uint8Array.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(uint8Array[i]);
      }
      const base64Contents = btoa(binary);

      fileUrl = await bubbleApi.uploadFile(filename, base64Contents);
    } else {
      const body = await request.json();
      fileUrl = body.url;
      filename = body.filename || fileUrl.split('/').pop() || 'documento';
    }

    if (!fileUrl) {
      return NextResponse.json({ success: false, error: 'URL do arquivo não gerada.' }, { status: 400 });
    }

    // Fetch current list and append
    const cooperado = (await bubbleApi.getCooperado(cooperadoId)) as { fks_pasta?: string[] };
    const currentPasta: string[] = cooperado.fks_pasta || [];

    if (!currentPasta.includes(fileUrl)) {
      const updatedPasta = [...currentPasta, fileUrl];
      await bubbleApi.updateCooperado(cooperadoId, { fks_pasta: updatedPasta });
    }

    const docInfo = parseDocumentInfo(fileUrl, false);

    return NextResponse.json({
      success: true,
      data: docInfo,
      fileUrl,
    });
  } catch (error) {
    const err = error as { message?: string };
    console.error('Erro ao adicionar documento:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Erro ao salvar novo documento' },
      { status: 500 }
    );
  }
}

// DELETE: Remove a document from cooperado fks_pasta
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cooperadoId = params.id;
    let urlToDelete = '';

    const body = await request.json().catch(() => null);
    if (body?.url) {
      urlToDelete = body.url;
    } else {
      const { searchParams } = new URL(request.url);
      urlToDelete = searchParams.get('url') || '';
    }

    if (!urlToDelete) {
      return NextResponse.json({ success: false, error: 'URL do documento a excluir é obrigatória.' }, { status: 400 });
    }

    const cooperado = (await bubbleApi.getCooperado(cooperadoId)) as {
      fks_pasta?: string[];
      file_termo_assinado?: string;
    };
    const currentPasta: string[] = cooperado.fks_pasta || [];

    const updatedPasta = currentPasta.filter((u) => u !== urlToDelete);

    const updatePayload: Record<string, unknown> = { fks_pasta: updatedPasta };
    // If deleting the signed term url, clear that field too
    if (cooperado.file_termo_assinado === urlToDelete) {
      updatePayload.file_termo_assinado = '';
    }

    await bubbleApi.updateCooperado(cooperadoId, updatePayload);

    return NextResponse.json({
      success: true,
      message: 'Documento removido com sucesso.',
      remainingCount: updatedPasta.length,
    });
  } catch (error) {
    const err = error as { message?: string };
    console.error('Erro ao remover documento:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Erro ao excluir documento' },
      { status: 500 }
    );
  }
}

// PATCH: Replace an existing document with a new one
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cooperadoId = params.id;
    const contentType = request.headers.get('content-type') || '';

    let oldUrl = '';
    let newUrl = '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      oldUrl = (formData.get('oldUrl') as string) || '';
      const file = formData.get('file') as File | null;

      if (!oldUrl || !file) {
        return NextResponse.json(
          { success: false, error: 'Arquivo substituto e URL anterior são obrigatórios.' },
          { status: 400 }
        );
      }

      const filename = file.name;
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      let binary = '';
      const len = uint8Array.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(uint8Array[i]);
      }
      const base64Contents = btoa(binary);

      newUrl = await bubbleApi.uploadFile(filename, base64Contents);
    } else {
      const body = await request.json();
      oldUrl = body.oldUrl;
      newUrl = body.newUrl;
    }

    if (!oldUrl || !newUrl) {
      return NextResponse.json(
        { success: false, error: 'oldUrl e newUrl são obrigatórios.' },
        { status: 400 }
      );
    }

    const cooperado = (await bubbleApi.getCooperado(cooperadoId)) as {
      fks_pasta?: string[];
      file_termo_assinado?: string;
    };
    const currentPasta: string[] = cooperado.fks_pasta || [];

    const updatedPasta = currentPasta.map((u) => (u === oldUrl ? newUrl : u));
    if (!updatedPasta.includes(newUrl)) {
      updatedPasta.push(newUrl);
    }

    const updatePayload: Record<string, unknown> = { fks_pasta: updatedPasta };
    if (cooperado.file_termo_assinado === oldUrl) {
      updatePayload.file_termo_assinado = newUrl;
    }

    await bubbleApi.updateCooperado(cooperadoId, updatePayload);

    const docInfo = parseDocumentInfo(newUrl, cooperado.file_termo_assinado === oldUrl);

    return NextResponse.json({
      success: true,
      data: docInfo,
      newUrl,
    });
  } catch (error) {
    const err = error as { message?: string };
    console.error('Erro ao substituir documento:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Erro ao substituir documento' },
      { status: 500 }
    );
  }
}
