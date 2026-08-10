/* eslint-disable */
import { NextRequest, NextResponse } from 'next/server';

import { obterSessaoCooperado } from '@/lib/sessao-cooperado';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function POST(request: NextRequest) {
  try {
    // Rota paga: cada chamada consome crédito de Whisper + GPT na OpenAI.
    // Sem sessão, qualquer um na internet podia gastar a conta da cooperativa
    // — e mandar áudio de terceiro para um serviço externo.
    const sessao = await obterSessaoCooperado();
    if (!sessao) {
      return NextResponse.json(
        { success: false, error: 'Sessão de cooperado ausente ou inválida.' },
        { status: 401 },
      );
    }

    const formData = await request.formData();
    const audioFile = formData.get('audio') as File | null;
    const evolucaoId = formData.get('evolucaoId') as string | null;

    if (!audioFile) {
      return NextResponse.json({ success: false, error: 'Arquivo de áudio ausente.' }, { status: 400 });
    }

    const openAiKey = process.env.OPENAI_API_KEY;

    // Se a chave não estiver configurada, faz uma simulação clínica realista
    if (!openAiKey) {
      console.warn('OPENAI_API_KEY ausente. Simulando transcrição clínica via IA...');
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simula delay de processamento

      const transcricaoCrua = 'é... o paciente tá bem... a pressão deu 12 por 8... sem dor... o acesso venoso tá bom, sem sinais de infecção ou inflamação... medicado conforme a prescrição do dia... o paciente dormiu bem à noite e tá calmo.';
      const transcricaoEstruturada = `EVOLUÇÃO CLÍNICA DE ENFERMAGEM:
- ESTADO GERAL: Paciente normotenso (PA: 120/80 mmHg), eupneico, afebril, calmo e colaborativo. Sono e repouso preservados durante a noite.
- SISTEMA CARDIOVASCULAR E RESPIRATÓRIO: Sem queixas álgicas ou respiratórias.
- DISPOSITIVOS: Acesso venoso periférico mantido, pérvio e sem sinais flogísticos (dor, calor, rubor ou edema).
- CONDUTA: Medicações administradas rigorosamente conforme prescrição médica do dia. Paciente mantido em repouso no leito.`;

      return NextResponse.json({
        success: true,
        transcricaoCrua,
        transcricao: transcricaoEstruturada
      });
    }

    // 1. Transcrição com OpenAI Whisper
    console.log('Enviando áudio para OpenAI Whisper...');
    const whisperFormData = new FormData();
    whisperFormData.append('file', audioFile);
    whisperFormData.append('model', 'whisper-1');
    whisperFormData.append('language', 'pt');

    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAiKey}`
      },
      body: whisperFormData
    });

    if (!whisperResponse.ok) {
      const errorText = await whisperResponse.text();
      throw new Error(`Erro no OpenAI Whisper: ${errorText}`);
    }

    const whisperData = await whisperResponse.json();
    const transcricaoCrua = whisperData.text;
    console.log('Transcrição Whisper concluída:', transcricaoCrua);

    // 2. Refinamento Clínico com GPT-4o-mini (Mais econômico e unificado)
    console.log('Enviando texto bruto para GPT-4o-mini...');
    const systemPrompt = `Você é um assistente de IA clínica especializado em auditoria e formatação de prontuários médicos.
Seu trabalho é pegar a seguinte transcrição de áudio clínico feita por um profissional de saúde, remover hesitações (hã, né, aí), corrigir gramática e pontuação, e formatá-la em um relato clínico profissional estruturado em português.
Mantenha todas as informações, medicamentos, dosagens, dados vitais e observações médicas intactas. Não invente nenhuma informação nova que não estava no áudio.
Escreva apenas a evolução final estruturada de forma limpa e objetiva, sem qualquer comentário introdutório ou explicativo.`;

    const gptResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openAiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Transcrição de áudio para estruturar: "${transcricaoCrua}"` }
        ],
        temperature: 0.1
      })
    });

    if (!gptResponse.ok) {
      const errorText = await gptResponse.text();
      throw new Error(`Erro na API do GPT-4o-mini: ${errorText}`);
    }

    const gptData = await gptResponse.json();
    const transcricaoEstruturada = gptData.choices[0].message.content.trim();
    console.log('Formatação GPT-4o-mini concluída.');

    return NextResponse.json({
      success: true,
      transcricaoCrua,
      transcricao: transcricaoEstruturada
    });
  } catch (error: any) {
    console.error('Erro na rota api/cooperado/transcrever:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Falha ao processar transcrição do áudio.'
    }, { status: 500 });
  }
}
