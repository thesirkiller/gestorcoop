import { NextResponse } from 'next/server';
import { bubbleApi } from '@/lib/bubble';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64Contents = buffer.toString('base64');
    const filename = file.name;

    console.log(`Recebido arquivo para upload: ${filename} (${file.size} bytes)`);

    // Upload to Bubble.io File storage
    const fileUrl = await bubbleApi.uploadFile(filename, base64Contents);

    return NextResponse.json({
      success: true,
      url: fileUrl,
      name: filename,
    });
  } catch (error) {
    const err = error as { message?: string };
    console.error('Erro no upload do arquivo:', err);
    return NextResponse.json({ error: err.message || 'Erro no processamento do upload' }, { status: 500 });
  }
}
