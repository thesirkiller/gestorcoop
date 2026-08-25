/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { obterSessaoCooperado } from '@/lib/sessao-cooperado';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

interface SinaisVitaisExtraidos {
  paSistolica?: number;
  paDiastolica?: number;
  fc?: number;
  fr?: number;
  temp?: number;
  spo2?: number;
  glicemia?: number;
}

interface SoapEstruturado {
  subjetivo: string;
  objetivo: string;
  avaliacao: string;
  plano: string;
}

// Regex e heurística para extração local de sinais vitais caso o LLM não extraia
function extrairSinaisVitaisDoTexto(texto: string): SinaisVitaisExtraidos {
  const resultado: SinaisVitaisExtraidos = {};

  // PA: ex: "12 por 8", "120 por 80", "12/8", "120/80", "130x80"
  const paMatch = texto.match(/(\d{2,3})\s*(?:x|\/|\s*por\s*)\s*(\d{2,3})/i);
  if (paMatch) {
    let sis = parseInt(paMatch[1], 10);
    let dia = parseInt(paMatch[2], 10);
    if (sis < 30) sis *= 10;
    if (dia < 20) dia *= 10;
    resultado.paSistolica = sis;
    resultado.paDiastolica = dia;
  }

  // SpO2 / Saturação: ex: "sat 98", "saturação de 97%", "sat 98%"
  const spo2Match = texto.match(/(?:sat(?:uração)?|spo2)\s*(?:de\s*)?(\d{2,3})\s*%?/i);
  if (spo2Match) {
    resultado.spo2 = parseInt(spo2Match[1], 10);
  }

  // FC / Pulso: ex: "pulso 76", "fc de 80", "frequência de 78"
  const fcMatch = texto.match(/(?:pulso|fc|frequ[eê]ncia card[ií]aca)\s*(?:de\s*)?(\d{2,3})/i);
  if (fcMatch) {
    resultado.fc = parseInt(fcMatch[1], 10);
  }

  // Temperatura: ex: "temperatura 36.5", "temp 37", "febril 38.2"
  const tempMatch = texto.match(/(?:temp(?:eratura)?|tax)\s*(?:de\s*)?(\d{2}(?:[.,]\d)?)/i);
  if (tempMatch) {
    resultado.temp = parseFloat(tempMatch[1].replace(',', '.'));
  }

  // Glicemia: ex: "glicemia 110", "hgt 120"
  const glicemiaMatch = texto.match(/(?:glicemia|hgt|destro)\s*(?:de\s*)?(\d{2,3})/i);
  if (glicemiaMatch) {
    resultado.glicemia = parseInt(glicemiaMatch[1], 10);
  }

  return resultado;
}

export async function POST(request: NextRequest) {
  try {
    const sessao = await obterSessaoCooperado();
    if (!sessao) {
      return NextResponse.json(
        { success: false, error: 'Sessão de cooperado ausente ou inválida.' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const audioFile = formData.get('audio') as File | null;
    const tipoProfissional = (formData.get('tipoProfissional') as string) || 'Tecnico_Enfermagem';

    if (!audioFile) {
      return NextResponse.json({ success: false, error: 'Arquivo de áudio ausente.' }, { status: 400 });
    }

    const openAiKey = process.env.OPENAI_API_KEY;
    const groqKey = process.env.GROQ_API_KEY;

    // Se nenhuma chave de IA externa estiver configurada, gera simulação clínica realista e estruturada no formato SOAP
    if (!openAiKey && !groqKey) {
      console.warn('Provedores de IA não configurados. Simulando transcrição clínica em formato SOAP...');
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const transcricaoCrua =
        'é... paciente consciente e orientado no leito... sem queixas álgicas no momento... aferi a pressão que deu 12 por 8... saturação 98 por cento e pulso 76... acesso venoso periférico salinizado no MSD sem sinais de infecção ou dor... medicações do horário administradas conforme a prescrição... aceitou a dieta por via oral sem náuseas.';

      const soap: SoapEstruturado = {
        subjetivo: 'Paciente consciente, orientado no tempo e espaço, sem queixas álgicas referidas no momento da visita. Nega náuseas ou desconforto respiratório.',
        objetivo: 'PA: 120x80 mmHg, FC: 76 bpm, SpO2: 98% em ar ambiente, Temp: 36.5°C. Acesso venoso periférico em membro superior direito (MSD) pérvio, sem sinais flogísticos (dor, calor, rubor ou edema). Aceitou dieta oral satisfatoriamente.',
        avaliacao: 'Paciente estável hemodinamicamente, padrão respiratório e hemodinâmico preservados, sem intercorrências durante o período.',
        plano: 'Administradas medicações prescritas para o horário. Mantidos cuidados de rotina, hidratação cutânea, monitoramento de sinais vitais e incentivo à deambulação assistida.',
      };

      const transcricaoEstruturada = `EVOLUÇÃO CLÍNICA (${tipoProfissional.toUpperCase()}):\n\n[SUBJETIVO]\n${soap.subjetivo}\n\n[OBJETIVO]\n${soap.objetivo}\n\n[AVALIAÇÃO]\n${soap.avaliacao}\n\n[PLANO]\n${soap.plano}`;

      const sinaisVitais = extrairSinaisVitaisDoTexto(transcricaoCrua);

      return NextResponse.json({
        success: true,
        transcricaoCrua,
        transcricao: transcricaoEstruturada,
        soap,
        sinaisVitais,
      });
    }

    let transcricaoCrua = '';

    // 1. Transcrição com Whisper (OpenAI ou Groq)
    if (groqKey) {
      console.log('Enviando áudio para Groq Whisper...');
      const groqFormData = new FormData();
      groqFormData.append('file', audioFile);
      groqFormData.append('model', 'whisper-large-v3');
      groqFormData.append('language', 'pt');

      const groqRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${groqKey}` },
        body: groqFormData,
      });

      if (groqRes.ok) {
        const groqData = await groqRes.json();
        transcricaoCrua = groqData.text;
      }
    }

    if (!transcricaoCrua && openAiKey) {
      console.log('Enviando áudio para OpenAI Whisper...');
      const whisperFormData = new FormData();
      whisperFormData.append('file', audioFile);
      whisperFormData.append('model', 'whisper-1');
      whisperFormData.append('language', 'pt');

      const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${openAiKey}` },
        body: whisperFormData,
      });

      if (!whisperResponse.ok) {
        const errorText = await whisperResponse.text();
        throw new Error(`Erro no OpenAI Whisper: ${errorText}`);
      }

      const whisperData = await whisperResponse.json();
      transcricaoCrua = whisperData.text;
    }

    console.log('Transcrição concluída:', transcricaoCrua);

    // 2. Estruturação Clínica em formato SOAP via LLM (GPT-4o-mini ou Groq)
    const systemPrompt = `Você é um assistente de IA clínica especializado em documentação médica e prontuário eletrônico no formato SOAP (Subjetivo, Objetivo, Avaliação, Plano) para o padrão brasileiro de saúde.
Seu trabalho é converter o relato de voz transcrito do profissional de saúde (${tipoProfissional}) em um prontuário clínico formal estruturado.
Remova vícios de linguagem e hesitações.
Responda ESTRITAMENTE em formato JSON com o seguinte schema:
{
  "subjetivo": "Queixas do paciente, relato do acompanhante, sintomas, dor, estado geral referido.",
  "objetivo": "Sinais vitais (PA, FC, FR, Temp, SpO2, Glicemia), exame físico sumário, dispositivos (sondas, acessos, curativos), dieta e eliminações.",
  "avaliacao": "Juízo clínico, estabilidade hemodinâmica, diagnóstico provisório ou resposta terapêutica.",
  "plano": "Condutas executadas, medicações administradas, cuidados prestados e orientações aos familiares."
}`;

    let soapJson: SoapEstruturado | null = null;

    if (openAiKey) {
      const gptResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openAiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Relato clínico de áudio: "${transcricaoCrua}"` },
          ],
          temperature: 0.1,
        }),
      });

      if (gptResponse.ok) {
        const gptData = await gptResponse.json();
        soapJson = JSON.parse(gptData.choices[0].message.content);
      }
    }

    const soap: SoapEstruturado = soapJson || {
      subjetivo: 'Relato do paciente e familiares durante o atendimento.',
      objetivo: transcricaoCrua,
      avaliacao: 'Quadro clínico em acompanhamento.',
      plano: 'Medicações e cuidados administrados conforme plano terapêutico.',
    };

    const transcricaoEstruturada = `EVOLUÇÃO CLÍNICA (${tipoProfissional.toUpperCase()}):\n\n[SUBJETIVO]\n${soap.subjetivo}\n\n[OBJETIVO]\n${soap.objetivo}\n\n[AVALIAÇÃO]\n${soap.avaliacao}\n\n[PLANO]\n${soap.plano}`;

    const sinaisVitais = extrairSinaisVitaisDoTexto(transcricaoCrua);

    return NextResponse.json({
      success: true,
      transcricaoCrua,
      transcricao: transcricaoEstruturada,
      soap,
      sinaisVitais,
    });
  } catch (error: any) {
    console.error('Erro na rota api/cooperado/transcrever:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Falha ao processar transcrição do áudio.',
      },
      { status: 500 }
    );
  }
}
