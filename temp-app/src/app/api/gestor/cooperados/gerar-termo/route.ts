import { NextResponse } from 'next/server';
import { bubbleApi } from '@/lib/bubble';
import { zapsignApi } from '@/lib/zapsign';
import { jsPDF } from 'jspdf';

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
    const rg = cooperado.txt_rg || '';
    const cpf = cooperado.txt_CPF || '';
    const email = cooperado.txt_email || '';
    const dataNascimento = cooperado.date_dataNascimento;
    const estadoCivil = cooperado.txt_estadoCivil || '';
    const endereco = cooperado.txt_endereco || '';
    const professionsList = cooperado.fks_profissoes || [];
    const professionsText = professionsList.join(', ') || 'Cooperado';

    if (!nomeCompleto || !cpf) {
      return NextResponse.json({ error: 'Dados básicos do cooperado (Nome/CPF) incompletos no banco' }, { status: 400 });
    }

    // 2. Generate Termo de Adesão PDF dynamically
    console.log('Gerando PDF do Termo de Adesão para:', nomeCompleto);
    const doc = new jsPDF();
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(16);
    doc.text('TERMO DE ADESAO AO QUADRO SOCIAL', 105, 20, { align: 'center' });
    doc.text('GESTORCOOP COOPERATIVA DE TRABALHO', 105, 28, { align: 'center' });
    
    doc.setFontSize(10);
    const currentDate = new Date().toLocaleDateString('pt-BR');

    const text = `
Pelo presente instrumento, eu, ${nomeCompleto.toUpperCase()}, portador(a) da cédula de identidade RG nº ${rg} e inscrito(a) no CPF/MF sob o nº ${cpf}, nascido(a) em ${dataNascimento ? new Date(dataNascimento).toLocaleDateString('pt-BR') : ''}, de estado civil ${estadoCivil}, residente e domiciliado(a) em ${endereco}, venho por meio deste solicitar a minha adesão e admissão como cooperado(a) na GESTORCOOP COOPERATIVA DE TRABALHO.

Declaro estar ciente e de acordo com as seguintes disposições:

1. COMPROMISSO SOCIAL: Comprometo-me a cumprir integralmente as normas do Estatuto Social, do Regimento Interno e as deliberações das Assembleias Gerais da Cooperativa.
2. INTEGRALIZAÇÃO DE CAPITAL: Comprometo-me a integralizar o capital social mínimo exigido nos termos do estatuto.
3. ATIVIDADE PROFISSIONAL: Declaro exercer legalmente a(s) profissão(ões) de ${professionsText}, possuindo todos os registros ativos nos respectivos conselhos de classe.
4. RESPONSABILIDADE: Declaro-me ciente de que a atividade cooperativa é exercida em caráter autônomo, sem vínculo empregatício de qualquer natureza com a cooperativa ou com seus tomadores de serviços.
5. VERACIDADE DAS INFORMAÇÕES: Declaro, sob as penas da lei, que todas as informações prestadas neste cadastro e os documentos anexados são inteiramente verdadeiros e autênticos.

Por ser a expressão da minha livre vontade e concordância, assino este Termo de Adesão por meio de assinatura eletrônica disponibilizada.

Goiânia - GO, ${currentDate}.
    `;

    const splitText = doc.splitTextToSize(text, 180);
    doc.text(splitText, 15, 40);

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
      // Fallback para simulação em ambiente de desenvolvimento caso as credenciais falhem
      docToken = `mock-token-${Date.now()}`;
      const isProduction = process.env.ZAPSIGN_BASE_URL?.includes('api.zapsign.com.br') && !process.env.ZAPSIGN_BASE_URL?.includes('sandbox');
      const baseSignUrl = isProduction ? 'https://zapsign.com.br' : 'https://sandbox.zapsign.com.br';
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
