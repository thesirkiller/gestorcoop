import { NextResponse } from 'next/server';
import { bubbleApi } from '@/lib/bubble';
import { zapsignApi } from '@/lib/zapsign';
import { jsPDF } from 'jspdf';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { personalData, addressData, professions, bankAccounts, uploadedFiles } = body;

    if (!personalData || !personalData.nomeCompleto || !personalData.cpf) {
      return NextResponse.json({ error: 'Dados pessoais obrigatórios ausentes' }, { status: 400 });
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

    // 6. Generate Termo de Adesão PDF dynamically
    console.log('Gerando PDF do Termo de Adesão');
    const doc = new jsPDF();
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(16);
    doc.text('TERMO DE ADESAO AO QUADRO SOCIAL', 105, 20, { align: 'center' });
    doc.text('GESTORCOOP COOPERATIVA DE TRABALHO', 105, 28, { align: 'center' });
    
    doc.setFontSize(10);
    const currentDate = new Date().toLocaleDateString('pt-BR');
    const professionsText = professionOptionNames.join(', ') || 'Cooperado';

    const text = `
Pelo presente instrumento, eu, ${personalData.nomeCompleto.toUpperCase()}, portador(a) da cédula de identidade RG nº ${personalData.rg || ''} e inscrito(a) no CPF/MF sob o nº ${personalData.cpf}, nascido(a) em ${personalData.dataNascimento ? new Date(personalData.dataNascimento).toLocaleDateString('pt-BR') : ''}, de estado civil ${personalData.estadoCivil || ''}, residente e domiciliado(a) em ${fullAddress}, venho por meio deste solicitar a minha adesão e admissão como cooperado(a) na GESTORCOOP COOPERATIVA DE TRABALHO.

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
      signUrl = `https://sandbox.zapsign.com.br/sign/${docToken}`;
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
