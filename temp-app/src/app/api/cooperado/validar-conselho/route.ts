import { NextResponse } from 'next/server';
import { validarRegistroConselho, validarPIS } from '@/lib/validacao-conselho';

export const runtime = 'edge';

function extrairParametrosUrl(request: Request) {
  const { searchParams } = new URL(request.url);
  return {
    conselho: searchParams.get('conselho') || searchParams.get('council') || '',
    uf: searchParams.get('uf') || searchParams.get('estado') || '',
    numero:
      searchParams.get('numero') ||
      searchParams.get('registration') ||
      searchParams.get('registro') ||
      '',
    categoria: searchParams.get('categoria') || searchParams.get('category') || '',
    profissao: searchParams.get('profissao') || searchParams.get('profession') || '',
    pis: searchParams.get('pis') || '',
  };
}

export async function GET(request: Request) {
  const params = extrairParametrosUrl(request);
  const resultado = validarRegistroConselho({
    conselho: params.conselho,
    uf: params.uf,
    numero: params.numero,
    categoria: params.categoria,
    profissao: params.profissao,
  });

  if (params.pis) {
    const pisResult = validarPIS(params.pis);
    const valid = resultado.valid && pisResult.valid;
    return NextResponse.json(
      {
        ...resultado,
        valid,
        valido: valid,
        ...(resultado.error ? {} : pisResult.error ? { error: pisResult.error, motivo: pisResult.error } : {}),
        pis: pisResult,
      },
      { status: valid ? 200 : 400 }
    );
  }

  return NextResponse.json(resultado, { status: resultado.valid ? 200 : 400 });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json(
        { valid: false, valido: false, error: 'Corpo da requisição inválido.' },
        { status: 400 }
      );
    }

    const resultado = validarRegistroConselho({
      conselho: body.conselho ?? body.council ?? '',
      uf: body.uf ?? body.estado ?? '',
      numero: body.numero ?? body.registration ?? body.registro ?? '',
      categoria: body.categoria ?? body.category ?? '',
      profissao: body.profissao ?? body.profession ?? '',
    });

    if (body.pis !== undefined && body.pis !== null && String(body.pis).trim() !== '') {
      const pisResult = validarPIS(String(body.pis));
      const valid = resultado.valid && pisResult.valid;
      return NextResponse.json(
        {
          ...resultado,
          valid,
          valido: valid,
          ...(resultado.error ? {} : pisResult.error ? { error: pisResult.error, motivo: pisResult.error } : {}),
          pis: pisResult,
        },
        { status: valid ? 200 : 400 }
      );
    }

    return NextResponse.json(resultado, { status: resultado.valid ? 200 : 400 });
  } catch {
    return NextResponse.json(
      { valid: false, valido: false, error: 'Não foi possível processar os dados para validação do conselho.' },
      { status: 400 }
    );
  }
}
