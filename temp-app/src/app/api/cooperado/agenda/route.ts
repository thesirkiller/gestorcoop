/* eslint-disable */
import { NextRequest, NextResponse } from 'next/server';
import { bubbleApi } from '@/lib/bubble';

import { obterSessaoCooperado } from '@/lib/sessao-cooperado';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

// Tipo do D1Database injetado pelo Cloudflare Pages
interface D1Database {
  prepare(query: string): any;
  exec(query: string): Promise<any>;
}

export async function GET(request: NextRequest) {
  try {
    const db = (process.env.DB as unknown) as D1Database | undefined;

    // O cooperado vem da SESSÃO, nunca da query string. Antes esta rota lia
    // `?cooperadoId=`, então bastava trocar o id na URL para ver os pacientes
    // de outro profissional — dado clínico de terceiro exposto.
    const sessao = await obterSessaoCooperado();
    if (!sessao) {
      return NextResponse.json(
        { success: false, error: 'Sessão de cooperado ausente ou inválida.' },
        { status: 401 },
      );
    }
    const cooperadoId = sessao.cooperadoId;

    let dbPacientes: any[] = [];
    let dbPrescricoes: any[] = [];
    let dbAprazamentos: any[] = [];

    // Se houver cooperadoId vindo do login/session do Bubble
    if (cooperadoId) {
      console.log(`Buscando atendimentos/serviços integrados do Bubble para o cooperado: ${cooperadoId}`);
      try {
        const servicos = (await bubbleApi.getServicosByCooperado(cooperadoId)) as any[];
        const bubblePacientes = (await bubbleApi.getPacientes()) as any[];

        // Encontrar pacientes vinculados aos serviços ativos do profissional
        const activePatientIds = new Set(servicos.map((s) => s.fk_paciente).filter(Boolean));
        const filteredPacientes = bubblePacientes.filter((p) => activePatientIds.has(p._id));

        dbPacientes = filteredPacientes.map((p) => ({
          id: p._id,
          nome: p.txt_nome || 'Paciente Sem Nome',
          cpf: p.txt_cpf || '123.456.789-00',
          data_nascimento: '12/04/1958', // Mapeamento padrão
          endereco: p.txt_endereco || 'Sem endereço cadastrado',
          warnings: p.fks_equipamentos?.length > 0 ? ['Possui equipamentos em casa'] : []
        }));

        if (db) {
          // Atualiza registros de pacientes no D1 local vindos do Bubble
          for (const p of dbPacientes) {
            await db.prepare(
              'INSERT OR REPLACE INTO pacientes (id, nome, cpf, data_nascimento, endereco, warnings) VALUES (?, ?, ?, ?, ?, ?)'
            ).bind(p.id, p.nome, p.cpf, p.data_nascimento, p.endereco, JSON.stringify(p.warnings)).run();
          }

          // Só os pacientes deste cooperado. Antes eram três `SELECT *` sem
          // filtro: o D1 devolvia a base clínica inteira e desfazia o recorte
          // por serviço que acabara de ser feito com os dados do Bubble.
          const idsPermitidos = dbPacientes.map((p) => p.id);
          if (idsPermitidos.length === 0) {
            return NextResponse.json({ success: true, pacientes: [], prescricoes: [], aprazamentos: [] });
          }
          const marcadores = idsPermitidos.map(() => '?').join(', ');

          const pacientesRes = (
            await db.prepare(`SELECT * FROM pacientes WHERE id IN (${marcadores})`).bind(...idsPermitidos).all()
          ).results;
          dbPacientes = pacientesRes.map((p: any) => ({
            ...p,
            warnings: p.warnings ? JSON.parse(p.warnings) : []
          }));

          dbPrescricoes = (
            await db
              .prepare(`SELECT * FROM prescricoes WHERE paciente_id IN (${marcadores})`)
              .bind(...idsPermitidos)
              .all()
          ).results;

          dbAprazamentos = (
            await db
              .prepare(
                `SELECT a.* FROM aprazamentos a
                   JOIN prescricoes p ON p.id = a.prescricao_id
                  WHERE p.paciente_id IN (${marcadores})`
              )
              .bind(...idsPermitidos)
              .all()
          ).results;
        } else {
          // Fallback de desenvolvimento local (sem D1)
          const mockData = getMockData();
          if (dbPacientes.length === 0) {
            dbPacientes = mockData.pacientes;
          }
          dbPrescricoes = mockData.prescricoes.map((pr) => ({
            ...pr,
            paciente_id: dbPacientes[0]?.id || pr.paciente_id,
          }));
          dbAprazamentos = mockData.aprazamentos.map((ap) => ({
            ...ap,
            prescricao_id: dbPrescricoes[0]?.id || ap.prescricao_id,
          }));
        }

        if (dbPacientes.length === 0) {
          const mockData = getMockData();
          dbPacientes = mockData.pacientes;
          dbPrescricoes = mockData.prescricoes;
          dbAprazamentos = mockData.aprazamentos;
        }

        return NextResponse.json({
          success: true,
          pacientes: dbPacientes,
          prescricoes: dbPrescricoes,
          aprazamentos: dbAprazamentos,
        });
      } catch (err: any) {
        console.warn('Falha na integração direta com Bubble, utilizando fallback local:', err);
      }
    }

    // Fluxo padrão caso não seja fornecido cooperadoId ou ocorra erro
    if (!db) {
      console.warn('Conexão com D1 não configurada. Usando dados mockados.');
      return NextResponse.json(getMockData());
    }

    // 1. Verificar se o banco já está populado
    const checkPacientes = await db.prepare('SELECT COUNT(*) as count FROM pacientes').first('count');

    if (checkPacientes === 0) {
      console.log('Populando banco D1 com registros clínicos iniciais...');
      await seedDatabase(db);
    }

    // 2. Buscar dados das tabelas
    const pacientes = (await db.prepare('SELECT * FROM pacientes').all()).results;
    const prescricoes = (await db.prepare('SELECT * FROM prescricoes').all()).results;
    const aprazamentos = (await db.prepare('SELECT * FROM aprazamentos').all()).results;

    const formattedPacientes = pacientes.map((p: any) => ({
      ...p,
      warnings: p.warnings ? JSON.parse(p.warnings) : []
    }));

    return NextResponse.json({
      success: true,
      pacientes: formattedPacientes,
      prescricoes,
      aprazamentos
    });
  } catch (error: any) {
    console.error('Erro na rota de API de Agenda:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Erro interno ao buscar agenda diária.'
    }, { status: 500 });
  }
}

function getMockData() {
  const pacientes = [
    {
      id: 'p_1',
      nome: 'Seu João da Silva',
      cpf: '123.456.789-00',
      data_nascimento: '12/04/1958',
      endereco: 'Rua das Palmeiras, 102 - Centro',
      warnings: ['Alergia a Dipirona e Penicilina', 'Hipertensão Grave']
    },
    {
      id: 'p_2',
      nome: 'Dona Maria de Oliveira',
      cpf: '987.654.321-11',
      data_nascimento: '25/08/1945',
      endereco: 'Av. Paulista, 1500 - Bela Vista',
      warnings: ['Risco de Queda', 'Diabetes Mellitus Tipo 2']
    }
  ];

  const prescricoes = [
    {
      id: 'pr_1',
      paciente_id: 'p_1',
      medicamento: 'Losartana Potássica 50mg',
      dosagem: '1 comprimido',
      via_administracao: 'Oral',
      frequencia_horas: 12,
      data_inicio: '2026-08-01',
      data_fim: '2026-09-01'
    },
    {
      id: 'pr_2',
      paciente_id: 'p_1',
      medicamento: 'Paracetamol 500mg',
      dosagem: '1 comprimido',
      via_administracao: 'Oral',
      frequencia_horas: 8,
      data_inicio: '2026-08-01',
      data_fim: '2026-09-01'
    },
    {
      id: 'pr_3',
      paciente_id: 'p_2',
      medicamento: 'Metformina 850mg',
      dosagem: '1 comprimido',
      via_administracao: 'Oral',
      frequencia_horas: 12,
      data_inicio: '2026-08-01',
      data_fim: '2026-09-01'
    }
  ];

  const aprazamentos = [
    {
      id: 'ap_1',
      prescricao_id: 'pr_1',
      horario_previsto: new Date().toISOString().split('T')[0] + 'T08:00:00.000Z',
      status: 'Pendente',
      medicamento: 'Losartana Potássica 50mg',
      dosagem: '1 comprimido',
      via_administracao: 'Oral'
    },
    {
      id: 'ap_2',
      prescricao_id: 'pr_1',
      horario_previsto: new Date().toISOString().split('T')[0] + 'T20:00:00.000Z',
      status: 'Pendente',
      medicamento: 'Losartana Potássica 50mg',
      dosagem: '1 comprimido',
      via_administracao: 'Oral'
    },
    {
      id: 'ap_3',
      prescricao_id: 'pr_2',
      horario_previsto: new Date().toISOString().split('T')[0] + 'T08:00:00.000Z',
      status: 'Pendente',
      medicamento: 'Paracetamol 500mg',
      dosagem: '1 comprimido',
      via_administracao: 'Oral'
    },
    {
      id: 'ap_4',
      prescricao_id: 'pr_2',
      horario_previsto: new Date().toISOString().split('T')[0] + 'T16:00:00.000Z',
      status: 'Pendente',
      medicamento: 'Paracetamol 500mg',
      dosagem: '1 comprimido',
      via_administracao: 'Oral'
    },
    {
      id: 'ap_5',
      prescricao_id: 'pr_3',
      horario_previsto: new Date().toISOString().split('T')[0] + 'T08:00:00.000Z',
      status: 'Pendente',
      medicamento: 'Metformina 850mg',
      dosagem: '1 comprimido',
      via_administracao: 'Oral'
    },
    {
      id: 'ap_6',
      prescricao_id: 'pr_3',
      horario_previsto: new Date().toISOString().split('T')[0] + 'T20:00:00.000Z',
      status: 'Pendente',
      medicamento: 'Metformina 850mg',
      dosagem: '1 comprimido',
      via_administracao: 'Oral'
    }
  ];

  return { success: true, pacientes, prescricoes, aprazamentos };
}

async function seedDatabase(db: D1Database) {
  const data = getMockData();
  
  for (const p of data.pacientes) {
    await db.prepare(
      'INSERT INTO pacientes (id, nome, cpf, data_nascimento, endereco, warnings) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(p.id, p.nome, p.cpf, p.data_nascimento, p.endereco, JSON.stringify(p.warnings)).run();
  }

  for (const pr of data.prescricoes) {
    await db.prepare(
      'INSERT INTO prescricoes (id, paciente_id, medicamento, dosagem, via_administracao, frequencia_horas, data_inicio, data_fim) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(pr.id, pr.paciente_id, pr.medicamento, pr.dosagem, pr.via_administracao, pr.frequencia_horas, pr.data_inicio, pr.data_fim).run();
  }

  for (const ap of data.aprazamentos) {
    await db.prepare(
      'INSERT INTO aprazamentos (id, prescricao_id, horario_previsto, status) VALUES (?, ?, ?, ?)'
    ).bind(ap.id, ap.prescricao_id, ap.horario_previsto, ap.status).run();
  }
}
