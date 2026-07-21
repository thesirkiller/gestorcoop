import { NextResponse } from 'next/server';
import { bubbleApi, Termo } from '@/lib/bubble';
import { zapsignApi } from '@/lib/zapsign';
import { jsPDF } from 'jspdf';

export const runtime = 'edge';

function resolveTermoText(
  cooperado: {
    fks_profissoes?: string[];
    txt_nomeCompleto?: string;
    txt_rg?: string;
    txt_CPF?: string;
    date_dataNascimento?: string;
    txt_estadoCivil?: string;
    txt_endereco?: string;
    txt_nomeMae?: string;
    txt_nomePai?: string;
    txt_pis?: string;
    txt_email?: string;
    txt_whatsapp?: string;
    txt_telefone?: string;
    _id?: string;
    id?: string;
  },
  allTerms: Termo[]
) {
  const professionsList = cooperado.fks_profissoes || [];
  const professionsText = professionsList.join(', ') || 'Cooperado';
  const nomeCompleto = cooperado.txt_nomeCompleto || '';
  const rg = cooperado.txt_rg || '';
  const cpf = cooperado.txt_CPF || '';
  const dataNascimento = cooperado.date_dataNascimento;
  const estadoCivil = cooperado.txt_estadoCivil || '';
  const endereco = cooperado.txt_endereco || '';
  const nomeMae = cooperado.txt_nomeMae || '';
  const nomePai = cooperado.txt_nomePai || '';
  const pis = cooperado.txt_pis || '';
  const email = cooperado.txt_email || '';
  const telefone = cooperado.txt_whatsapp || cooperado.txt_telefone || '';
  const matricula = cooperado._id || cooperado.id || '';
  const currentDate = new Date().toLocaleDateString('pt-BR');

  // 1. Try to find active term for one of the cooperado's professions
  let activeTerm = allTerms.find(
    (t) => t.bool_ativo && professionsList.some((p: string) => p.toLowerCase().trim() === t.txt_profissao.toLowerCase().trim())
  );

  // 2. If not found, try to find active term for 'Geral'
  if (!activeTerm) {
    activeTerm = allTerms.find((t) => t.bool_ativo && t.txt_profissao.toLowerCase().trim() === 'geral');
  }

  let templateText = activeTerm?.txt_conteudo;
  const title = activeTerm?.txt_titulo || 'TERMO DE ADESAO AO QUADRO SOCIAL';

  // Fallback to static text if no term exists in database
  if (!templateText) {
    templateText = `Pelo presente instrumento, eu, {nome}, portador(a) da cédula de identidade RG nº {rg} e inscrito(a) no CPF/MF sob o nº {cpf}, nascido(a) em {dataNascimento}, de estado civil {estadoCivil}, residente e domiciliado(a) em {endereco}, venho por meio deste solicitar a minha adesão e admissão como cooperado(a) na GESTORCOOP COOPERATIVA DE TRABALHO.

Declaro estar ciente e de acordo com as seguintes disposições:

1. COMPROMISSO SOCIAL: Comprometo-me a cumprir integralmente as normas do Estatuto Social, do Regimento Interno e as deliberações das Assembleias Gerais da Cooperativa.
2. INTEGRALIZAÇÃO DE CAPITAL: Comprometo-me a integralizar o capital social mínimo exigido nos termos do estatuto.
3. ATIVIDADE PROFISSIONAL: Declaro exercer legalmente a(s) profissão(ões) de {profissoes}, possuindo todos os registros ativos nos respectivos conselhos de classe.
4. RESPONSABILIDADE: Declaro-me ciente de que a atividade cooperativa é exercida em caráter autônomo, sem vínculo empregatício de qualquer natureza com a cooperativa ou com seus tomadores de serviços.
5. VERACIDADE DAS INFORMAÇÕES: Declaro, sob as penas da lei, que todas as informações prestadas neste cadastro e os documentos anexados são inteiramente verdadeiros e autênticos.

Por ser a expressão da minha livre vontade e concordância, assino este Termo de Adesão por meio de assinatura eletrônica disponibilizada.

Goiânia - GO, {dataAtual}.`;
  }

  // Replace placeholders
  const resolvedText = templateText
    .replace(/{nome}/gi, nomeCompleto.toUpperCase())
    .replace(/{nomeCompleto}/gi, nomeCompleto.toUpperCase())
    .replace(/{rg}/gi, rg)
    .replace(/{cpf}/gi, cpf)
    .replace(/{dataNascimento}/gi, dataNascimento ? new Date(dataNascimento).toLocaleDateString('pt-BR') : '')
    .replace(/{estadoCivil}/gi, estadoCivil)
    .replace(/{endereco}/gi, endereco)
    .replace(/{profissoes}/gi, professionsText)
    .replace(/{nomeMae}/gi, nomeMae.toUpperCase())
    .replace(/{nomePai}/gi, nomePai.toUpperCase())
    .replace(/{pis}/gi, pis)
    .replace(/{email}/gi, email)
    .replace(/{telefone}/gi, telefone)
    .replace(/{matricula}/gi, matricula)
    .replace(/{dataAtual}/gi, currentDate);

  return { title, text: resolvedText };
}

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

    const { text } = resolveTermoText(cooperado, allTerms);

    // 2. Generate Termo de Adesão PDF dynamically (with multi-page support)
    console.log('Gerando PDF do Termo de Adesão para:', nomeCompleto);
    const doc = new jsPDF();
    
    const pages = text.split('[PAGE_BREAK]');
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
      const splitLines = doc.splitTextToSize(pageContent.trim(), width);
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

    const pdfBase64 = Buffer.from(doc.output(), 'binary').toString('base64');

    // 3. Create ZapSign Document
    console.log('Enviando documento para a ZapSign para:', nomeCompleto);
    let signUrl = '';
    let docToken = '';

    try {
      const zapsignDoc = await zapsignApi.createDocument(
        `Termo de Adesão - ${nomeCompleto}`,
        pdfBase64,
        nomeCompleto,
        email
      );

      docToken = zapsignDoc.token;
      signUrl = zapsignDoc.signers?.[0]?.sign_url || '';
    } catch (zapsignError) {
      const err = zapsignError as { response?: { data?: unknown }; message?: string };
      console.error('Erro na integração com a ZapSign:', err?.response?.data || err.message);
      const isSandbox = process.env.ZAPSIGN_BASE_URL?.includes('sandbox');
      const baseSignUrl = isSandbox ? 'https://sandbox.zapsign.com.br' : 'https://app.zapsign.com.br';
      signUrl = `${baseSignUrl}/sign/${docToken}`;
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
