import fs from 'node:fs';
import path from 'node:path';
import { jsPDF } from 'jspdf';

// 1. Carregar .env.local
const envPath = 'C:\\Users\\admin\\Documents\\projetos\\gestorcoop\\temp-app\\.env.local';
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    if (line.trim().startsWith('#')) continue;
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

const zapsignToken = (process.env.ZAPSIGN_API_TOKEN || '').trim().replace(/^Bearer\s+/i, '').trim();
const zapsignBaseUrl = (process.env.ZAPSIGN_BASE_URL || 'https://api.zapsign.com.br/api/v1').trim().replace(/\/+$/, '');
const bubbleUrl = process.env.BUBBLE_API_URL;
const bubbleToken = process.env.BUBBLE_API_TOKEN;

console.log('=== CONFIGURAÇÃO IDENTIFICADA ===');
console.log('ZapSign Base URL:', zapsignBaseUrl);
console.log('ZapSign Token length:', zapsignToken.length);
console.log('ZapSign Token prefix/suffix:', zapsignToken ? `${zapsignToken.slice(0, 8)}...${zapsignToken.slice(-8)}` : 'NÃO CONFIGURADO');
console.log('Bubble API URL:', bubbleUrl);
console.log('Bubble API Token:', bubbleToken ? `${bubbleToken.slice(0, 6)}...` : 'NÃO CONFIGURADO');
console.log('');

async function testarBubble() {
  console.log('--- 1. CONSULTANDO TERMOS NO BUBBLE ---');
  if (!bubbleUrl || !bubbleToken) {
    console.error('Bubble não configurado.');
    return null;
  }
  try {
    const res = await fetch(`${bubbleUrl}/obj/termos`, {
      headers: { Authorization: `Bearer ${bubbleToken}` }
    });
    console.log('GET /obj/termos status:', res.status, res.statusText);
    const data = await res.json();
    const termos = data.response?.results || [];
    console.log(`Total de termos no Bubble: ${termos.length}`);
    for (const t of termos) {
      console.log(`\n========================================`);
      console.log(`Termo [${t.txt_profissao || 'Geral'}] (Ativo: ${t.bool_ativo}): "${t.txt_titulo}" (Versão: ${t.num_versao})`);
      console.log(`ID: ${t._id}`);
      console.log(`CONTEÚDO COMPLETO:\n${t.txt_conteudo}`);
      console.log(`========================================\n`);
    }
    return termos;
  } catch (err: any) {
    console.error('Erro ao consultar Bubble:', err.message);
    return null;
  }
}

async function testarZapSignAuth() {
  console.log('--- 2. TESTANDO AUTENTICAÇÃO ZAPSIGN ---');
  if (!zapsignToken) {
    console.error('ZAPSIGN_API_TOKEN vazio!');
    return false;
  }

  // Teste 1: Header Authorization Bearer
  console.log('Teste 1.1: GET /docs/ com Header Authorization: Bearer <token>');
  try {
    const res1 = await fetch(`${zapsignBaseUrl}/docs/`, {
      headers: {
        'Authorization': `Bearer ${zapsignToken}`,
      },
    });
    console.log('Status:', res1.status, res1.statusText);
    const body1 = await res1.text();
    console.log('Resposta (1.1):', body1.slice(0, 300));
  } catch (err: any) {
    console.error('Erro no Teste 1.1:', err.message);
  }

  // Teste 2: Query param ?api_token=
  console.log('\nTeste 1.2: GET /docs/?api_token=<token>');
  try {
    const res2 = await fetch(`${zapsignBaseUrl}/docs/?api_token=${encodeURIComponent(zapsignToken)}`);
    console.log('Status:', res2.status, res2.statusText);
    const body2 = await res2.text();
    console.log('Resposta (1.2):', body2.slice(0, 300));
  } catch (err: any) {
    console.error('Erro no Teste 1.2:', err.message);
  }

  // Teste 3: GET /user/
  console.log('\nTeste 1.3: GET /user/?api_token=<token>');
  try {
    const res3 = await fetch(`${zapsignBaseUrl}/user/?api_token=${encodeURIComponent(zapsignToken)}`);
    console.log('Status:', res3.status, res3.statusText);
    const body3 = await res3.text();
    console.log('Resposta (1.3):', body3.slice(0, 300));
  } catch (err: any) {
    console.error('Erro no Teste 1.3:', err.message);
  }
}

async function gerarEEnviarTermoTeste(termosFromBubble: any[]) {
  console.log('\n--- 3. GERANDO TERMO DE ADESÃO EM PDF E TESTANDO CRIAÇÃO NA ZAPSIGN ---');

  const cooperadoTeste = {
    nomeCompleto: 'MARCOS TESTE VALIDAÇÃO',
    cpf: '123.456.789-00',
    rg: '1234567 SSP/GO',
    dataNascimento: '1990-01-15',
    estadoCivil: 'Solteiro(a)',
    endereco: 'Av. T-63, Qd. 10, Lt. 05, Setor Bueno, Goiânia - GO, CEP: 74230-100',
    profissoes: ['Enfermeiro', 'Técnico de Enfermagem'],
    nomeMae: 'MARIA TESTE SILVA',
    nomePai: 'JOSE TESTE SILVA',
    pis: '123.45678.90-1',
    email: 'marcosteste@exemplo.com.br',
    telefone: '(62) 99999-8888',
  };

  let activeTerm = termosFromBubble?.find(
    (t: any) => t.bool_ativo && cooperadoTeste.profissoes.some((p: string) => p.toLowerCase().trim() === (t.txt_profissao || '').toLowerCase().trim())
  );
  if (!activeTerm) {
    activeTerm = termosFromBubble?.find((t: any) => t.bool_ativo && (t.txt_profissao || '').toLowerCase().trim() === 'geral');
  }

  let templateText = activeTerm?.txt_conteudo;
  const title = activeTerm?.txt_titulo || 'TERMO DE ADESÃO AO QUADRO SOCIAL';

  if (!templateText) {
    console.log('Aviso: Nenhum termo cadastrado no Bubble. Usando template fallback padrão.');
    templateText = `Pelo presente instrumento, eu, {nome}, portador(a) da cédula de identidade RG nº {rg} e inscrito(a) no CPF/MF sob o nº {cpf}, nascido(a) em {dataNascimento}, de estado civil {estadoCivil}, residente e domiciliado(a) em {endereco}, venho por meio deste solicitar a minha adesão e admissão como cooperado(a) na GESTORCOOP COOPERATIVA DE TRABALHO.

Declaro estar ciente e de acordo com as seguintes disposições:

1. COMPROMISSO SOCIAL: Comprometo-me a cumprir integralmente as normas do Estatuto Social, do Regimento Interno e as deliberações das Assembleias Gerais da Cooperativa.
2. INTEGRALIZAÇÃO DE CAPITAL: Comprometo-me a integralizar o capital social mínimo exigido nos termos do estatuto.
3. ATIVIDADE PROFISSIONAL: Declaro exercer legalmente a(s) profissão(ões) de {profissoes}, possuindo todos os registros ativos nos respectivos conselhos de classe.
4. RESPONSABILIDADE: Declaro-me ciente de que a atividade cooperativa é exercida em caráter autônomo, sem vínculo empregatício de qualquer natureza com a cooperativa ou com seus tomadores de serviços.
5. VERACIDADE DAS INFORMAÇÕES: Declaro, sob as penas da lei, que todas as informações prestadas neste cadastro e os documentos anexados são inteiramente verdadeiros e autênticos.

Por ser a expressão da minha livre vontade e concordância, assino este Termo de Adesão por meio de assinatura eletrônica disponibilizada.

Goiânia - GO, {dataAtual}.`;
  } else {
    console.log(`Usando termo ativo do Bubble: "${activeTerm.txt_titulo}" (Profissão: ${activeTerm.txt_profissao})`);
  }

  const currentDate = new Date().toLocaleDateString('pt-BR');
  const resolvedText = templateText
    .replace(/{nome}/gi, cooperadoTeste.nomeCompleto.toUpperCase())
    .replace(/{nomeCompleto}/gi, cooperadoTeste.nomeCompleto.toUpperCase())
    .replace(/{rg}/gi, cooperadoTeste.rg)
    .replace(/{cpf}/gi, cooperadoTeste.cpf)
    .replace(/{dataNascimento}/gi, new Date(cooperadoTeste.dataNascimento).toLocaleDateString('pt-BR'))
    .replace(/{estadoCivil}/gi, cooperadoTeste.estadoCivil)
    .replace(/{endereco}/gi, cooperadoTeste.endereco)
    .replace(/{profissoes}/gi, cooperadoTeste.profissoes.join(', '))
    .replace(/{nomeMae}/gi, cooperadoTeste.nomeMae.toUpperCase())
    .replace(/{nomePai}/gi, cooperadoTeste.nomePai.toUpperCase())
    .replace(/{pis}/gi, cooperadoTeste.pis)
    .replace(/{email}/gi, cooperadoTeste.email)
    .replace(/{telefone}/gi, cooperadoTeste.telefone)
    .replace(/{matricula}/gi, 'TESTE-001')
    .replace(/{dataAtual}/gi, currentDate);

  // Gerar PDF com jsPDF (mesma lógica usada no app)
  const doc = new jsPDF();
  const pages = resolvedText.split('[PAGE_BREAK]');
  pages.forEach((pageContent: string, pageIndex: number) => {
    if (pageIndex > 0) doc.addPage();
    const marginX = 15;
    const width = 180;
    const startY = 30;
    const bottomLimit = 275;
    const lineSpacing = 5;

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('GESTORCOOP - COOPERATIVA DE TRABALHO', 15, 15);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Página ${pageIndex + 1} de ${pages.length}`, 195, 15, { align: 'right' });
    doc.line(15, 18, 195, 18);

    doc.setFontSize(9);
    const splitLines = doc.splitTextToSize(pageContent.trim(), width);
    let y = startY;

    for (let i = 0; i < splitLines.length; i++) {
      if (y > bottomLimit) {
        doc.addPage();
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(10);
        doc.text('GESTORCOOP - COOPERATIVA DE TRABALHO', 15, 15);
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

  // Salvar PDF na pasta Downloads do usuário
  const userHome = process.env.USERPROFILE || 'C:\\Users\\admin';
  const downloadsDir = path.join(userHome, 'Downloads');
  const targetPdfPath = path.join(downloadsDir, 'termo_adesao_validacao_zapsign.pdf');

  const pdfArrayBuffer = doc.output('arraybuffer');
  fs.writeFileSync(targetPdfPath, Buffer.from(pdfArrayBuffer));
  console.log(`\n[OK] PDF salvo com sucesso na pasta de Downloads:`);
  console.log(`-> ${targetPdfPath}`);

  // Testar envio para a ZapSign
  const pdfBase64 = doc.output('datauristring').split(',')[1];

  console.log('\n--- Tentando criar documento na ZapSign API ---');
  try {
    const zapPayload = {
      name: `Termo de Adesão - ${cooperadoTeste.nomeCompleto}`,
      base64_pdf: pdfBase64,
      signers: [
        {
          name: cooperadoTeste.nomeCompleto,
          email: cooperadoTeste.email,
          send_automatic_email: false,
          send_automatic_whatsapp: false,
          blank_signature_log: true,
        },
      ],
    };

    const resPost = await fetch(`${zapsignBaseUrl}/docs/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${zapsignToken}`,
      },
      body: JSON.stringify(zapPayload),
    });

    console.log('ZapSign POST /docs/ Status:', resPost.status, resPost.statusText);
    const resData = await resPost.json();
    console.log('ZapSign Resposta completa:\n', JSON.stringify(resData, null, 2));

    if (resData.token) {
      console.log('\n=============================================');
      console.log('>>> SUCESSO NA GERAÇÃO DO TERMO ZAPSIGN <<<');
      console.log('Token do Documento:', resData.token);
      console.log('Link de Assinatura (Sign URL):', resData.signers?.[0]?.sign_url);
      console.log('=============================================');
    }
  } catch (err: any) {
    console.error('Erro ao enviar para ZapSign:', err.message);
  }
}

async function main() {
  const termos = await testarBubble();
  await testarZapSignAuth();
  await gerarEEnviarTermoTeste(termos || []);
}

main().catch(console.error);
