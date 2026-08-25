import { NextRequest, NextResponse } from 'next/server';
import { bubbleApi } from '@/lib/bubble';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

const MOCK_COOPERADOS = [
  {
    _id: 'coop_1',
    txt_nomeCompleto: 'Juliana Ramos dos Santos',
    txt_CPF: '123.456.789-00',
    txt_email: 'juliana.ramos@multcare.com.br',
    txt_whatsapp: '(11) 98765-4321',
    txt_telefone: '(11) 3456-7890',
    txt_rg: '34.567.890-1',
    txt_orgaoEmissor: 'SSP',
    txt_orgaoUF: 'SP',
    date_dataNascimento: '1990-05-14',
    txt_estadoCivil: 'Solteiro(a)',
    txt_nomeMae: 'Maria de Fátima Ramos',
    txt_nomePai: 'Carlos Alberto Ramos',
    txt_grauEscolaridade: 'Superior Completo',
    txt_etinia: 'Parda',
    txt_pis: '123.45678.90-1',
    txt_endereco: 'Av. Paulista, 1000, Apto 42 - Bela Vista, São Paulo/SP',
    fks_pasta: [
      'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=800&auto=format&fit=crop&q=80',
      'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    ],
    fks_profissoes: ['Enfermeiro(a)'],
    txt_termo_status: 'Aprovado',
    file_termo_assinado: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
  },
  {
    _id: 'coop_2',
    txt_nomeCompleto: 'Marcos Vinícius de Oliveira',
    txt_CPF: '234.567.890-11',
    txt_email: 'marcos.oliveira@gestorcoop.com.br',
    txt_whatsapp: '(11) 97654-3210',
    txt_telefone: '(11) 3322-1100',
    txt_rg: '23.456.789-2',
    txt_orgaoEmissor: 'SSP',
    txt_orgaoUF: 'SP',
    date_dataNascimento: '1988-11-20',
    txt_estadoCivil: 'Casado(a)',
    txt_nomeMae: 'Tereza Cristina Oliveira',
    txt_grauEscolaridade: 'Técnico',
    txt_pis: '234.56789.01-2',
    txt_endereco: 'Rua Domingos de Morais, 500 - Vila Mariana, São Paulo/SP',
    fks_pasta: [
      'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1582750433449-648ed127bb54?w=800&auto=format&fit=crop&q=80',
    ],
    fks_profissoes: ['Técnico de Enfermagem'],
    txt_termo_status: 'Pendente',
  },
  {
    _id: 'coop_3',
    txt_nomeCompleto: 'Dra. Beatriz Helena Meirelles',
    txt_CPF: '345.678.901-22',
    txt_email: 'beatriz.meirelles@multcare.com.br',
    txt_whatsapp: '(11) 96543-2109',
    txt_rg: '12.345.678-0',
    txt_orgaoEmissor: 'SSP',
    txt_orgaoUF: 'SP',
    date_dataNascimento: '1985-03-08',
    txt_estadoCivil: 'Casado(a)',
    txt_nomeMae: 'Helena Meirelles',
    txt_grauEscolaridade: 'Pós-Graduação',
    txt_endereco: 'Rua Pedrosa, 780 - Jardim Paulista, São Paulo/SP',
    fks_pasta: [
      'https://images.unsplash.com/photo-1594824813515-0d7e48cfeb5c?w=800&auto=format&fit=crop&q=80',
    ],
    fks_profissoes: ['Médico(a)'],
    txt_termo_status: 'Aprovado',
  },
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cursorStr = searchParams.get('cursor');
    const limitStr = searchParams.get('limit');

    if (cursorStr !== null || limitStr !== null) {
      const cursor = cursorStr ? parseInt(cursorStr, 10) : 0;
      const limit = limitStr ? parseInt(limitStr, 10) : 100;
      console.log(`Buscando página de cooperados no Bubble... cursor: ${cursor}, limit: ${limit}`);
      
      try {
        const pageData = (await bubbleApi.getCooperados(cursor, limit)) as any;
        if (pageData && pageData.results && pageData.results.length > 0) {
          return NextResponse.json({ success: true, data: pageData });
        }
      } catch (bubbleErr) {
        console.warn('Erro ao consultar Bubble para cooperados, usando fallback local:', bubbleErr);
      }

      // Fallback para desenvolvimento / teste quando o Bubble estiver vazio
      return NextResponse.json({
        success: true,
        data: {
          cursor: 0,
          results: MOCK_COOPERADOS,
          remaining: 0,
          count: MOCK_COOPERADOS.length,
        },
      });
    }

    try {
      const list = (await bubbleApi.getCooperados()) as any[];
      if (Array.isArray(list) && list.length > 0) {
        return NextResponse.json({ success: true, data: list });
      }
    } catch (bubbleErr) {
      console.warn('Erro ao consultar lista de cooperados no Bubble:', bubbleErr);
    }

    return NextResponse.json({ success: true, data: MOCK_COOPERADOS });
  } catch (error) {
    const err = error as { message?: string };
    console.error('Erro ao listar cooperados:', err);
    return NextResponse.json({
      success: true,
      data: {
        cursor: 0,
        results: MOCK_COOPERADOS,
        remaining: 0,
        count: MOCK_COOPERADOS.length,
      },
    });
  }
}
