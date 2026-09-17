import { NextResponse } from 'next/server';
import { bubbleApi } from '@/lib/bubble';
import { validarArquivoDocumento } from '@/lib/documentos';
import { criarComprovanteUpload } from '@/lib/comprovante-upload';

export const runtime = 'edge';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
    }

    const validationError = validarArquivoDocumento(file);
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    let binary = '';
    const len = uint8Array.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    const base64Contents = btoa(binary);
    const filename = file.name;

    console.log(`Recebido arquivo para upload: ${filename} (${file.size} bytes)`);

    // Upload to Bubble.io File storage
    const fileUrl = await bubbleApi.uploadFile(filename, base64Contents);

    return NextResponse.json({
      success: true,
      url: fileUrl,
      name: filename,
      comprovante: await criarComprovanteUpload(fileUrl),
    });
  } catch (error) {
    const err = error as { message?: string };
    console.error('Erro no upload do arquivo:', err.message);
    return NextResponse.json({ error: 'Não foi possível salvar o documento. Tente enviar novamente.' }, { status: 502 });
  }
}
