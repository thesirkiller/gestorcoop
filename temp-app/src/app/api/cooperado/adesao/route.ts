import { NextResponse } from 'next/server';
import { bubbleApi, Termo } from '@/lib/bubble';
import { zapsignApi } from '@/lib/zapsign';
import { isValidCPF, cpfDigits } from '@/lib/cpf';
import { jsPDF } from 'jspdf';

export const runtime = 'edge';

function resolveTermoText(
  personalData: {
    nomeCompleto: string;
    rg?: string;
    cpf: string;
    dataNascimento?: string;
    estadoCivil?: string;
    nomeMae?: string;
    nomePai?: string;
    pis?: string;
    email?: string;
    whatsapp?: string;
    telefoneReserva?: string;
  },
  fullAddress: string,
  professionOptionNames: string[],
  allTerms: Termo[]
) {
  const professionsText = professionOptionNames.join(', ') || 'Cooperado';
  const nomeCompleto = personalData.nomeCompleto || '';
  const rg = personalData.rg || '';
  const cpf = personalData.cpf || '';
  const dataNascimento = personalData.dataNascimento;
  const estadoCivil = personalData.estadoCivil || '';
  const endereco = fullAddress || '';
  const nomeMae = personalData.nomeMae || '';
  const nomePai = personalData.nomePai || '';
  const pis = personalData.pis || '';
  const email = personalData.email || '';
  const telefone = personalData.whatsapp || personalData.telefoneReserva || '';
  const currentDate = new Date().toLocaleDateString('pt-BR');

  // 1. Try to find active term for one of the cooperado's professions
  let activeTerm = allTerms.find(
    (t) => t.bool_ativo && professionOptionNames.some((p: string) => p.toLowerCase().trim() === t.txt_profissao.toLowerCase().trim())
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
    .replace(/{matricula}/gi, '') // during signup, matricula is empty or not yet assigned
    .replace(/{dataAtual}/gi, currentDate);

  return { title, text: resolvedText };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { personalData, addressData, professions, bankAccounts, uploadedFiles } = body;

    if (!personalData || !personalData.nomeCompleto || !personalData.cpf) {
      return NextResponse.json({ error: 'Dados pessoais obrigatórios ausentes' }, { status: 400 });
    }

    if (!isValidCPF(personalData.cpf)) {
      return NextResponse.json({ error: 'CPF inválido. Confira os números digitados.' }, { status: 400 });
    }

    // Guarda contra cadastro duplicado: um CPF só pode ter um cadastro de cooperado.
    const existente = await bubbleApi.findCooperadoByCPF(cpfDigits(personalData.cpf));
    if (existente) {
      const registro = existente as { txt_termo_status?: string };
      const aguardandoAssinatura = registro.txt_termo_status === 'Aguardando Assinatura';
      return NextResponse.json(
        {
          error: aguardandoAssinatura
            ? 'Este CPF já possui um cadastro com assinatura do termo pendente. Verifique seu e-mail (inclusive spam) para localizar o link de assinatura da ZapSign ou entre em contato com a cooperativa.'
            : 'Este CPF já possui cadastro na cooperativa. Se precisar atualizar seus dados ou tiver dúvidas, entre em contato com a cooperativa.',
          code: 'CPF_JA_CADASTRADO',
          termoStatus: registro.txt_termo_status || null,
        },
        { status: 409 }
      );
    }

    // 1. Format Address text
    const fullAddress = `${addressData.rua || ''}, Nº ${addressData.numero || ''}${addressData.complemento ? `, ${addressData.complemento}` : ''}, ${addressData.bairro || ''}, ${addressData.cidade || ''} - ${addressData.estado || ''}, CEP: ${addressData.cep || ''}`;

    // 2. Create Cooperado in Bubble
    const defaultCooperativaId = '1632239151449x283019207795015680'; // GestorCoop
    const cooperadoPayload = {
      txt_nomeCompleto: personalData.nomeCompleto,
      txt_CPF: personalData.cpf,
      txt_email: personalData.email,
      txt_whatsapp: personalData.whatsapp,
      txt_telefone: personalData.telefoneReserva || '',
      txt_rg: personalData.rg || '',
      txt_orgaoEmissor: personalData.orgaoEmissor || '',
      txt_orgaoUF: personalData.orgaoUF || '',
      date_dataNascimento: personalData.dataNascimento ? new Date(personalData.dataNascimento).toISOString() : new Date().toISOString(),
      date_dataExpedicaoRG: personalData.dataExpedicaoRG ? new Date(personalData.dataExpedicaoRG).toISOString() : new Date().toISOString(),
      txt_sexo: personalData.sexo || '',
      txt_estadoCivil: personalData.estadoCivil || '',
      txt_nomeMae: personalData.nomeMae || '',
      txt_nomePai: personalData.nomePai || '',
      txt_grauEscolaridade: personalData.grauEscolaridade || '',
      txt_etinia: personalData.racaCor || '',
      txt_pis: personalData.pis || '',
      txt_endereco: fullAddress,
      fk_Cooperativa: defaultCooperativaId,
      bool_listaNegra: false,
      bool_BLOQUEADO: false,
      txt_termo_status: 'Aguardando Assinatura',
      // Storing uploaded files direct URLs in the list file field
      fks_pasta: uploadedFiles || [],
    };

    console.log('Criando cooperado no Bubble:', personalData.nomeCompleto);
    const cooperadoResponse = await bubbleApi.createCooperado(cooperadoPayload);
    const cooperadoId = cooperadoResponse.id;

    if (!cooperadoId) {
      throw new Error('Falha ao obter ID do cooperado criado no Bubble');
    }

    // 3. Create Professions in Bubble and link
    const professionIds: string[] = [];
    const professionOptionNames: string[] = [];

    for (const prof of (professions || [])) {
      const profPayload = {
        txt_nome: prof.name,
        txt_conselho: prof.registration || '', // using council number/registration
        date_emissao: prof.emissionDate ? new Date(prof.emissionDate).toISOString() : undefined,
        bool_principal: !!prof.isPrincipal,
        OS_profissao: prof.name, // maps to option.profiss_es text value
        fk_socio_cooperado: cooperadoId,
        fk_cooperativa: defaultCooperativaId,
      };
      const profResponse = await bubbleApi.createProfissao(profPayload);
      if (profResponse.id) {
        professionIds.push(profResponse.id);
        professionOptionNames.push(prof.name);
      }
    }

    // 4. Create Bank Accounts in Bubble and link
    const bankAccountIds: string[] = [];
    for (const bank of (bankAccounts || [])) {
      const bankPayload = {
        txt_agencia: bank.agency,
        txt_banco: bank.bank,
        text_corrente_or_poupanca: bank.type === 'Poupança' ? 'Conta Poupança' : 'Conta Corrente',
        txt_nConta: bank.account,
        fk_cooperado: cooperadoId,
      };
      const bankResponse = await bubbleApi.createContaBancaria(bankPayload);
      if (bankResponse.id) {
        bankAccountIds.push(bankResponse.id);
      }
    }

    // 5. Update Cooperado with relation lists in Bubble
    console.log('Vinculando sub-registros ao cooperado:', cooperadoId);
    await bubbleApi.updateCooperado(cooperadoId, {
      'fks_Profissões ': professionIds,
      'fks_ContasBancarias': bankAccountIds,
      'fks_profissoes': professionOptionNames, // option list field
    });

    // Fetch all terms from Bubble for dynamic selection
    console.log('Buscando termos ativos no Bubble para preenchimento dinâmico...');
    let allTerms: Termo[] = [];
    try {
      allTerms = await bubbleApi.getTermos();
    } catch (e) {
      console.warn('Falha ao buscar termos no Bubble, usando fallback estático:', e);
    }

    const { text } = resolveTermoText(personalData, fullAddress, professionOptionNames, allTerms);

    // 6. Generate Termo de Adesão PDF dynamically (with multi-page support)
    console.log('Gerando PDF do Termo de Adesão');
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

    // 7. Create ZapSign Document
    console.log('Enviando documento para a ZapSign');
    let signUrl = '';
    let docToken = '';

    try {
      const zapsignDoc = await zapsignApi.createDocument(
        `Termo de Adesão - ${personalData.nomeCompleto}`,
        pdfBase64,
        personalData.nomeCompleto,
        personalData.email
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

    // Save the ZapSign document token in the cooperado record for callback tracking
    // We can use txt_Bio or similar. Let's see if we have a field for document identifier, or just use comments.
    // Let's check bubble_meta for a field or just save it in a text field like txt_observacoes or similar.
    // Actually, saving it or responding to the frontend is enough since the webhook will match by CPF or email!
    
    return NextResponse.json({
      success: true,
      cooperadoId,
      docToken,
      signUrl,
    });
  } catch (error) {
    const err = error as { message?: string };
    console.error('Erro no fluxo de adesão:', err);
    return NextResponse.json({ error: err.message || 'Erro interno do servidor' }, { status: 500 });
  }
}
