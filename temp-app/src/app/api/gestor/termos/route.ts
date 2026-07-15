import { NextResponse } from 'next/server';
import { bubbleApi, Termo } from '@/lib/bubble';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function GET() {
  try {
    console.log('Listando todos os termos do Bubble...');
    const termos = await bubbleApi.getTermos();
    
    // Sort terms by profession and version descending
    termos.sort((a, b) => {
      if (a.txt_profissao !== b.txt_profissao) {
        return a.txt_profissao.localeCompare(b.txt_profissao);
      }
      return b.num_versao - a.num_versao;
    });

    return NextResponse.json(termos);
  } catch (error) {
    const err = error as { message?: string };
    console.error('Erro ao listar termos:', err);
    return NextResponse.json({ error: err.message || 'Erro ao carregar termos' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { txt_titulo, txt_conteudo, txt_profissao } = body;

    if (!txt_titulo || !txt_conteudo || !txt_profissao) {
      return NextResponse.json({ error: 'Título, Conteúdo e Profissão são obrigatórios' }, { status: 400 });
    }

    console.log(`Buscando termos cadastrados para versionamento da profissão: ${txt_profissao}...`);
    const allTerms = await bubbleApi.getTermos();
    
    // Find existing terms for this profession (case insensitive comparison)
    const sameProfessionTerms = allTerms.filter(
      (t) => t.txt_profissao.toLowerCase().trim() === txt_profissao.toLowerCase().trim()
    );

    // Determine the next version number
    const maxVersion = sameProfessionTerms.reduce((max, t) => (t.num_versao > max ? t.num_versao : max), 0);
    const newVersion = maxVersion + 1;

    console.log(`Desativando versões anteriores da profissão ${txt_profissao}...`);
    // Deactivate all older active versions
    const deactivationPromises = sameProfessionTerms
      .filter((t) => t.bool_ativo)
      .map((t) => bubbleApi.updateTermo(t._id!, { bool_ativo: false }));
    
    await Promise.all(deactivationPromises);

    console.log(`Criando nova versão (${newVersion}) de termo para ${txt_profissao}...`);
    // Create new active version
    const newTermData: Omit<Termo, '_id'> = {
      txt_titulo,
      txt_conteudo,
      txt_profissao: txt_profissao.trim(),
      num_versao: newVersion,
      bool_ativo: true,
    };

    const createdTerm = await bubbleApi.createTermo(newTermData);

    return NextResponse.json({
      success: true,
      termo: createdTerm,
    });
  } catch (error) {
    const err = error as { message?: string };
    console.error('Erro ao criar/versionar termo:', err);
    return NextResponse.json({ error: err.message || 'Erro ao criar/versionar termo' }, { status: 500 });
  }
}
