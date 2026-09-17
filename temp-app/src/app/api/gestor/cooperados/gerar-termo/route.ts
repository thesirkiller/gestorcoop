import { NextResponse } from 'next/server';
import { bubbleApi, Termo } from '@/lib/bubble';
import { zapsignApi } from '@/lib/zapsign';
import { jsPDF } from 'jspdf';
import { montarTermoResolvido } from '@/lib/termo-template';

export const runtime = 'edge';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID do cooperado é obrigatório' }, { status: 400 });
    }

    // 1. Fetch Cooperado details from Bubble
    console.log('Buscando cooperado no Bubble para geração de termo:', id);
    const cooperado = await bubbleApi.getCooperado(id);

    if (!cooperado) {
      return NextResponse.json({ error: 'Cooperado não encontrado' }, { status: 404 });
    }

    const nomeCompleto = cooperado.txt_nomeCompleto || '';
    const cpf = cooperado.txt_CPF || '';
    const email = cooperado.txt_email || '';

    if (!nomeCompleto || !cpf) {
      return NextResponse.json({ error: 'Dados básicos do cooperado (Nome/CPF) incompletos no banco' }, { status: 400 });
    }

    // Fetch all terms from Bubble for dynamic selection
    console.log('Buscando termos ativos no Bubble para preenchimento dinâmico...');
    let allTerms: Termo[] = [];
    try {
      allTerms = await bubbleApi.getTermos();
    } catch (e) {
      console.warn('Falha ao buscar termos no Bubble, usando fallback estático:', e);
    }

    const { text } = montarTermoResolvido(
      {
        nomeCompleto: cooperado.txt_nomeCompleto,
        rg: cooperado.txt_rg,
        cpf: cooperado.txt_CPF,
        dataNascimento: cooperado.date_dataNascimento,
        estadoCivil: cooperado.txt_estadoCivil,
        endereco: cooperado.txt_endereco,
        nomeMae: cooperado.txt_nomeMae || cooperado.nomeMae,
        nomePai: cooperado.txt_nomePai,
        pis: cooperado.txt_pis,
        email: cooperado.txt_email,
        whatsapp: cooperado.txt_whatsapp,
        telefone: cooperado.txt_telefone,
        matricula: cooperado._id || cooperado.id,
        profissoes: cooperado.fks_profissoes,
      },
      allTerms
    );

    // 2. Generate Termo de Adesão PDF dynamically (with multi-page support)
    console.log('Gerando PDF do Termo de Adesão para:', nomeCompleto);
    const doc = new jsPDF();
    
    const pages = (text || '').split('[PAGE_BREAK]');
    pages.forEach((pageContent, pageIndex) => {
      if (pageIndex > 0) {
        doc.addPage();
      }
      
      const marginX = 15;
      const width = 180;
      const startY = 30;
      const bottomLimit = 275;
      const lineSpacing = 5;
      
      // Page styling - Border & Header
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('MULTCARE - COOPERATIVA DE TRABALHO', 15, 15);
      
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(`Página ${pageIndex + 1} de ${pages.length}`, 195, 15, { align: 'right' });
      doc.line(15, 18, 195, 18);
      
      // Draw content lines
      doc.setFontSize(9);
      const splitLines = doc.splitTextToSize((pageContent || '').trim(), width);
      let y = startY;
      
      for (let i = 0; i < splitLines.length; i++) {
        if (y > bottomLimit) {
          doc.addPage();
          // Draw header on the overflow page too
          doc.setFont('Helvetica', 'bold');
          doc.setFontSize(10);
          doc.text('MULTCARE - COOPERATIVA DE TRABALHO', 15, 15);
          doc.setFont('Helvetica', 'normal');
          doc.setFontSize(8);
          doc.text(`Página ${pageIndex + 1} (cont.) de ${pages.length}`, 195, 15, { align: 'right' });
          doc.line(15, 18, 195, 18);
          
          doc.setFont('Helvetica', 'normal');
          doc.setFontSize(9);
          y = startY;
        }
        doc.text(splitLines[i], marginX, y);
        y += lineSpacing;
      }
    });

    let pdfBase64 = '';
    try {
      const dataUri = doc.output('datauristring');
      if (typeof dataUri === 'string' && dataUri.includes(',')) {
        pdfBase64 = dataUri.split(',')[1] || '';
      }
    } catch {
      // fallback
    }
    if (!pdfBase64) {
      const arrayBuffer = doc.output('arraybuffer');
      pdfBase64 = Buffer.from(arrayBuffer).toString('base64');
    }

    // 3. Create ZapSign Document
    console.log('Enviando documento para a ZapSign para:', nomeCompleto);
    let signUrl = '';
    let docToken = '';

    try {
      const zapsignDoc = await zapsignApi.createDocument(
        `Termo de Adesão - ${nomeCompleto}`,
        pdfBase64,
        nomeCompleto,
        email,
        id
      );

      docToken = zapsignDoc.token;
      signUrl = zapsignDoc.signers?.[0]?.sign_url || '';
    } catch (zapsignError) {
      const err = zapsignError as { response?: { data?: unknown }; message?: string };
      console.error('Erro na integração com a ZapSign:', err.message);
      return NextResponse.json({ success: false, error: 'Não foi possível gerar o link de assinatura. Tente novamente ou confira a configuração da ZapSign.' }, { status: 502 });
    }

    // Update Bubble: Set term status to "Aguardando Assinatura"
    console.log('Atualizando status no Bubble do cooperado:', id);
    await bubbleApi.updateCooperado(id, {
      txt_termo_status: 'Aguardando Assinatura'
    });

    return NextResponse.json({
      success: true,
      cooperadoId: id,
      docToken,
      signUrl,
    });
  } catch (error) {
    const err = error as { message?: string };
    console.error('Erro no fluxo de geração manual de termo:', err);
    return NextResponse.json({ error: err.message || 'Erro interno do servidor' }, { status: 500 });
  }
}
