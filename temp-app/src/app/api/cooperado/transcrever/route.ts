import { NextRequest, NextResponse } from 'next/server';
import { obterSessaoCooperado } from '@/lib/sessao-cooperado';
import { registrarUso, verificarCota } from '@/lib/ia/limites';
import {
  estruturarSoap,
  temProvedorConfigurado,
  transcreverAudio,
  type SinaisVitaisExtraidos,
  type SoapEstruturado,
} from '@/lib/ia/provedores';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

/**
 * Rede de segurança para sinais vitais.
 *
 * O caminho principal agora é o próprio LLM, que devolve os valores junto do
 * SOAP: ele lê o texto inteiro, tolera erro de reconhecimento de fala e não
 * diverge do que escreveu no laudo. Este regex só preenche o que o modelo tiver
 * deixado de fora.
 *
 * A versão anterior exigia `\d{2,3}` nos dois lados da pressão, então "12 por 8"
 * — a forma como a PA é dita em praticamente toda evolução de enfermagem, e o
 * texto do próprio mock desta rota — nunca casava, e a linha que corrige
 * diastólica de um dígito era inalcançável. Daí o `\d{1,3}` com validação de
 * faixa fisiológica depois da escala.
 */
function extrairSinaisVitaisDoTexto(texto: string): SinaisVitaisExtraidos {
  const resultado: SinaisVitaisExtraidos = {};

  // PA: "12 por 8", "120 por 80", "12/8", "120/80", "130x80"
  const paMatch = texto.match(/(\d{1,3})\s*(?:x|\/|\s*por\s*)\s*(\d{1,3})/i);
  if (paMatch) {
    let sis = parseInt(paMatch[1], 10);
    let dia = parseInt(paMatch[2], 10);
    if (sis < 30) sis *= 10;
    if (dia < 20) dia *= 10;
    // Sem a checagem de faixa, `\d{1,3}` transforma qualquer "3 por 4" solto do
    // relato em pressão arterial.
    if (sis >= 60 && sis <= 300 && dia >= 30 && dia <= 200 && dia < sis) {
      resultado.paSistolica = sis;
      resultado.paDiastolica = dia;
    }
  }

  // SpO2: "sat 98", "saturação de 97%", e também o que o Whisper erra ("saturacal 98%").
  const spo2Match = texto.match(/(?:sat[^\s\d]*|spo2)\s*(?:de\s*)?(\d{2,3})\s*%?/i);
  if (spo2Match) resultado.spo2 = parseInt(spo2Match[1], 10);

  const fcMatch = texto.match(/(?:pulso|fc|frequ[^\s\d]*\s*card[^\s\d]*)\s*(?:de\s*)?(\d{2,3})/i);
  if (fcMatch) resultado.fc = parseInt(fcMatch[1], 10);

  const tempMatch = texto.match(/(?:temp[^\s\d]*|tax)\s*(?:de\s*)?(\d{2}(?:[.,]\d)?)/i);
  if (tempMatch) resultado.temp = parseFloat(tempMatch[1].replace(',', '.'));

  const glicemiaMatch = texto.match(/(?:glicemia|hgt|destro)\s*(?:de\s*)?(\d{2,3})/i);
  if (glicemiaMatch) resultado.glicemia = parseInt(glicemiaMatch[1], 10);

  return resultado;
}

/**
 * Descarta sinal vital cujo número não aparece na transcrição.
 *
 * Medido com `gpt-4o-mini`: pedindo os vitais junto do SOAP, o modelo copiou os
 * números de exemplo do próprio schema e devolveu FR 18 e glicemia 110 num
 * relato que não citou nenhum dos dois. O prompt já foi corrigido para exigir
 * null, mas instrução não é garantia — e aqui o erro escreve aferição
 * inexistente em prontuário assinado.
 *
 * A checagem é literal: o valor só sobrevive se estiver no áudio transcrito. A
 * PA aceita também a forma coloquial sem o zero final ("12 por 8" → 120x80).
 * Valor dito por extenso é descartado junto — perder um campo que o profissional
 * revisa é muito melhor que inventar um que ninguém aferiu.
 */
function apenasCorroboradosPeloAudio(
  vitais: SinaisVitaisExtraidos,
  textoCru: string,
): SinaisVitaisExtraidos {
  const formasDe = (valor: number): string[] => {
    const formas = [String(valor)];
    if (!Number.isInteger(valor)) formas.push(String(valor).replace('.', ','));
    if (Number.isInteger(valor) && valor % 10 === 0) formas.push(String(valor / 10));
    return formas.map((f) => f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  };

  const aparece = (valor: number): boolean =>
    formasDe(valor).some((forma) => new RegExp(`(?<![\\d,.])${forma}(?![\\d])`).test(textoCru));

  const filtrados: SinaisVitaisExtraidos = {};
  const descartar = (campo: string, valor: number) =>
    console.warn(`[transcrever] Sinal vital "${campo}=${valor}" descartado: não consta na transcrição.`);

  // A PA é validada como par, não como dois números soltos. "80" isolado não
  // aparece em "12 por 8", e conferir só o "8" aceitaria qualquer oito do
  // relato ("8 comprimidos") como diastólica.
  const { paSistolica, paDiastolica, ...demais } = vitais;
  if (paSistolica !== undefined && paDiastolica !== undefined) {
    const par = formasDe(paSistolica).some((s) =>
      formasDe(paDiastolica).some((d) =>
        new RegExp(`(?<![\\d,.])${s}\\s*(?:x|\\/|por)\\s*${d}(?![\\d])`, 'i').test(textoCru),
      ),
    );
    if (par) {
      filtrados.paSistolica = paSistolica;
      filtrados.paDiastolica = paDiastolica;
    } else {
      descartar('pa', paSistolica);
    }
  }

  for (const [campo, valor] of Object.entries(demais) as [keyof SinaisVitaisExtraidos, number | undefined][]) {
    if (valor === undefined) continue;
    if (aparece(valor)) filtrados[campo] = valor;
    else descartar(campo, valor);
  }
  return filtrados;
}

function montarTextoEvolucao(tipoProfissional: string, soap: SoapEstruturado): string {
  return `EVOLUÇÃO CLÍNICA (${tipoProfissional.toUpperCase()}):\n\n[SUBJETIVO]\n${soap.subjetivo}\n\n[OBJETIVO]\n${soap.objetivo}\n\n[AVALIAÇÃO]\n${soap.avaliacao}\n\n[PLANO]\n${soap.plano}`;
}

/**
 * Simulação de desenvolvimento.
 *
 * Fica atrás de uma trava porque o texto é indistinguível de uma transcrição
 * real: ele descreve aferição de sinais vitais que nunca aconteceu. Em produção
 * isso chegaria à tela de revisão como qualquer evolução e poderia ser assinado
 * com o PIN — prontuário falso, assinado. Fora de produção o `simulado: true`
 * viaja na resposta e a tela bloqueia a assinatura.
 */
function simulacaoPermitida(): boolean {
  if (process.env.IA_PERMITIR_SIMULACAO === 'true') return true;
  return process.env.NODE_ENV !== 'production';
}

export async function POST(request: NextRequest) {
  try {
    const sessao = await obterSessaoCooperado();
    if (!sessao) {
      return NextResponse.json(
        { success: false, error: 'Sessão de cooperado ausente ou inválida.' },
        { status: 401 },
      );
    }

    const formData = await request.formData();
    const audioFile = formData.get('audio') as File | null;
    const tipoProfissional = (formData.get('tipoProfissional') as string) || 'Tecnico_Enfermagem';

    if (!audioFile || audioFile.size === 0) {
      return NextResponse.json({ success: false, error: 'Arquivo de áudio ausente.' }, { status: 400 });
    }

    const veredicto = await verificarCota(sessao.cooperadoId, audioFile.size);
    if (!veredicto.permitido) {
      return NextResponse.json(
        { success: false, error: veredicto.motivo, limiteAtingido: true, limiteGlobal: veredicto.global === true },
        { status: 429 },
      );
    }

    if (!temProvedorConfigurado()) {
      if (!simulacaoPermitida()) {
        return NextResponse.json(
          {
            success: false,
            error: 'Transcrição por voz indisponível no momento. Redija a evolução manualmente — o registro segue válido.',
          },
          { status: 503 },
        );
      }

      console.warn('[transcrever] Nenhum provedor de IA configurado. Devolvendo simulação marcada.');
      const transcricaoCrua =
        'é... paciente consciente e orientado no leito... sem queixas álgicas no momento... aferi a pressão que deu 12 por 8... saturação 98 por cento e pulso 76... acesso venoso periférico salinizado no MSD sem sinais de infecção ou dor... medicações do horário administradas conforme a prescrição... aceitou a dieta por via oral sem náuseas.';

      const soap: SoapEstruturado = {
        subjetivo: '[SIMULAÇÃO] Paciente consciente, orientado no tempo e espaço, sem queixas álgicas referidas no momento da visita. Nega náuseas ou desconforto respiratório.',
        objetivo: '[SIMULAÇÃO] PA: 120x80 mmHg, FC: 76 bpm, SpO2: 98% em ar ambiente, Temp: 36.5°C. Acesso venoso periférico em membro superior direito (MSD) pérvio, sem sinais flogísticos.',
        avaliacao: '[SIMULAÇÃO] Paciente estável hemodinamicamente, sem intercorrências durante o período.',
        plano: '[SIMULAÇÃO] Administradas medicações prescritas para o horário. Mantidos cuidados de rotina e monitoramento de sinais vitais.',
      };

      return NextResponse.json({
        success: true,
        simulado: true,
        transcricaoCrua,
        transcricao: montarTextoEvolucao(tipoProfissional, soap),
        soap,
        sinaisVitais: extrairSinaisVitaisDoTexto(transcricaoCrua),
      });
    }

    const transcricao = await transcreverAudio(audioFile);

    if (!transcricao) {
      // Conta mesmo assim: falha de provedor gasta banda, e uso não contabilizado
      // seria o caminho óbvio para furar a cota forçando erros.
      await registrarUso({ cooperadoId: sessao.cooperadoId, bytes: audioFile.size, provedor: null, sucesso: false });
      return NextResponse.json(
        {
          success: false,
          error: 'Nenhum serviço de transcrição respondeu. O áudio foi preservado — redija a evolução manualmente ou tente de novo.',
        },
        { status: 502 },
      );
    }

    const estruturado = await estruturarSoap(transcricao.texto, tipoProfissional);
    const porRegex = extrairSinaisVitaisDoTexto(transcricao.texto);

    // Sem SOAP, a transcrição crua ainda vale como evolução para o profissional revisar.
    const soap: SoapEstruturado = estruturado?.soap ?? {
      subjetivo: 'Relato do paciente e familiares durante o atendimento.',
      objetivo: transcricao.texto,
      avaliacao: 'Quadro clínico em acompanhamento.',
      plano: 'Medicações e cuidados administrados conforme plano terapêutico.',
    };

    // O LLM manda, o regex preenche lacuna, e o áudio tem a palavra final.
    const sinaisVitais = apenasCorroboradosPeloAudio(
      { ...porRegex, ...(estruturado?.sinaisVitais ?? {}) },
      transcricao.texto,
    );

    await registrarUso({
      cooperadoId: sessao.cooperadoId,
      bytes: audioFile.size,
      provedor: transcricao.provedor,
      sucesso: true,
    });

    return NextResponse.json({
      success: true,
      transcricaoCrua: transcricao.texto,
      transcricao: montarTextoEvolucao(tipoProfissional, soap),
      soap,
      sinaisVitais,
      provedor: { transcricao: transcricao.provedor, soap: estruturado?.provedor ?? null },
    });
  } catch (error) {
    console.error('Erro na rota api/cooperado/transcrever:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Falha ao processar transcrição do áudio. Redija a evolução manualmente — o registro segue válido.',
      },
      { status: 500 },
    );
  }
}
