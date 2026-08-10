/* eslint-disable */
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

interface D1Database {
  prepare(query: string): any;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pacienteId = searchParams.get('pacienteId');
    const profissionalId = searchParams.get('profissionalId');
    const specialty = searchParams.get('specialty'); // 'Tecnico_Enfermagem', 'Medico', 'Terapeuta'
    const limit = parseInt(searchParams.get('limit') || '50');

    const db = (process.env.DB as unknown) as D1Database | undefined;

    if (!db) {
      console.warn('Conexão com D1 (process.env.DB) não configurada. Retornando dados mockados para o Painel do Gestor.');
      return NextResponse.json({ success: true, results: getMockEvolucoes() });
    }

    // Construção dinâmica de query SQL
    let query = `
      SELECT e.*, p.nome as paciente_nome, p.cpf as paciente_cpf
      FROM evolucoes e
      JOIN pacientes p ON e.paciente_id = p.id
    `;
    const constraints: string[] = [];
    const params: any[] = [];

    if (pacienteId) {
      constraints.push('e.paciente_id = ?');
      params.push(pacienteId);
    }
    if (profissionalId) {
      constraints.push('e.profissional_id = ?');
      params.push(profissionalId);
    }
    if (specialty) {
      constraints.push('e.tipo_profissional = ?');
      params.push(specialty);
    }

    if (constraints.length > 0) {
      query += ' WHERE ' + constraints.join(' AND ');
    }

    query += ' ORDER BY e.check_in DESC LIMIT ?';
    params.push(limit);

    const results = (await db.prepare(query).bind(...params).all()).results;

    // Também obter checagens de medicamentos correspondentes a cada evolução
    const finalResults = await Promise.all(results.map(async (ev: any) => {
      // Se for enfermagem, busca as checagens realizadas no mesmo período
      let aprazamentosChecados: any[] = [];
      if (ev.tipo_profissional === 'Tecnico_Enfermagem') {
        const aprazQuery = `
          SELECT a.*, pr.medicamento, pr.dosagem, pr.via_administracao
          FROM aprazamentos a
          JOIN prescricoes pr ON a.prescricao_id = pr.id
          WHERE pr.paciente_id = ? 
            AND a.horario_executado >= ? 
            AND a.horario_executado <= ?
        `;
        aprazamentosChecados = (await db.prepare(aprazQuery).bind(ev.paciente_id, ev.check_in, ev.check_out || new Date().toISOString()).all()).results;
      }

      return {
        ...ev,
        aprazamentos: aprazamentosChecados
      };
    }));

    return NextResponse.json({
      success: true,
      results: finalResults
    });
  } catch (error: any) {
    console.error('Erro na API de prontuários do Gestor:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Falha ao buscar prontuários no servidor.'
    }, { status: 500 });
  }
}

function getMockEvolucoes() {
  const hoje = new Date().toISOString().split('T')[0];
  return [
    {
      id: 'ev_mock_1',
      paciente_id: 'p_1',
      paciente_nome: 'Seu João da Silva',
      paciente_cpf: '123.456.789-00',
      profissional_id: 'coop_123',
      profissional_nome: 'Dra. Ana Silva',
      tipo_profissional: 'Tecnico_Enfermagem',
      turno: 'Diurno',
      check_in: `${hoje}T08:00:00.000Z`,
      check_out: `${hoje}T09:12:00.000Z`,
      audio_url: 'https://gestorcoop.pages.dev/mock-audio-1.webm',
      transcricao_crua: 'o paciente tá bem... a pressão deu 12 por 8... sem dor... o acesso venoso tá bom, sem sinais de infecção ou inflamação...',
      transcricao_revisada: 'EVOLUÇÃO CLÍNICA DE ENFERMAGEM:\n- ESTADO GERAL: Paciente normotenso (PA: 120/80 mmHg), eupneico, afebril, calmo. Repouso preservado.\n- DISPOSITIVOS: Acesso venoso periférico mantido, pérvio e sem sinais de infiltração.\n- CONDUTA: Medicado conforme prescrição.',
      status: 'Finalizado',
      data_assinatura: `${hoje}T09:12:00.000Z`,
      aprazamentos: [
        {
          id: 'ap_1',
          prescricao_id: 'pr_1',
          horario_previsto: `${hoje}T08:00:00.000Z`,
          horario_executado: `${hoje}T08:05:00.000Z`,
          status: 'Administrado',
          profissional_id: 'coop_123',
          medicamento: 'Losartana Potássica 50mg',
          dosagem: '1 comprimido',
          via_administracao: 'Oral'
        },
        {
          id: 'ap_3',
          prescricao_id: 'pr_2',
          horario_previsto: `${hoje}T08:00:00.000Z`,
          horario_executado: `${hoje}T08:06:00.000Z`,
          status: 'Administrado',
          profissional_id: 'coop_123',
          medicamento: 'Paracetamol 500mg',
          dosagem: '1 comprimido',
          via_administracao: 'Oral'
        }
      ]
    },
    {
      id: 'ev_mock_2',
      paciente_id: 'p_2',
      paciente_nome: 'Dona Maria de Oliveira',
      paciente_cpf: '987.654.321-11',
      profissional_id: 'coop_789',
      profissional_nome: 'Dr. Marcos Souza',
      tipo_profissional: 'Medico',
      turno: null,
      check_in: `${hoje}T10:00:00.000Z`,
      check_out: `${hoje}T10:45:00.000Z`,
      audio_url: 'https://gestorcoop.pages.dev/mock-audio-2.webm',
      transcricao_crua: 'paciente apresenta boa evolução clínica... ferida operatória em cicatrização... sem queixas álgicas significativas... deambula com auxílio...',
      transcricao_revisada: 'EVOLUÇÃO MÉDICA DE ROTINA:\n- QUADRO CLÍNICO: Paciente em pós-operatório estável, deambulando com auxílio, afebril, eupneica.\n- PLANO TERAPÊUTICO: Mantida conduta medicamentosa e fisioterapia motora diária. Programada alta dos cuidados intensivos para a próxima semana.',
      status: 'Finalizado',
      data_assinatura: `${hoje}T10:45:00.000Z`,
      aprazamentos: []
    }
  ];
}
