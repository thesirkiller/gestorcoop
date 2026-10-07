/* eslint-disable */
import { NextRequest, NextResponse } from 'next/server';
import { bubbleApi } from '@/lib/bubble';
import { memoizarComTtl, CHAVE_CACHE_PACIENTES_BUBBLE, TTL_PACIENTES_BUBBLE_MS } from '@/lib/cache-memoria';

import { obterSessaoCooperado } from '@/lib/sessao-cooperado';
import { getDb } from '@/lib/db/client';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    const db = getDb();

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
        const bubblePacientes = ((await memoizarComTtl(
          CHAVE_CACHE_PACIENTES_BUBBLE,
          TTL_PACIENTES_BUBBLE_MS,
          () => bubbleApi.getPacientes()
        )) || []) as any[];

        // Encontrar pacientes vinculados aos serviços ativos do profissional
        const activePatientIds = new Set(servicos.map((s) => s.fk_paciente).filter(Boolean));
        const filteredPacientes = bubblePacientes.filter((p) => activePatientIds.has(p._id));

        dbPacientes = filteredPacientes.map((p) => ({
          id: p._id,
          nome: p.txt_nome || 'Paciente Sem Nome',
          cpf: p.txt_cpf || '',
          data_nascimento: '',
          endereco: p.txt_endereco || 'Sem endereço cadastrado',
          warnings: p.fks_equipamentos?.length > 0 ? ['Possui equipamentos em casa'] : []
        }));

        if (db) {
          // Atualiza registros de pacientes no D1 local vindos do Bubble preservando limite_visitas_mes
          for (const p of dbPacientes) {
            await db.prepare(`
              INSERT INTO pacientes (id, nome, cpf, data_nascimento, endereco, warnings)
              VALUES (?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                nome = excluded.nome,
                cpf = excluded.cpf,
                data_nascimento = excluded.data_nascimento,
                endereco = excluded.endereco,
                warnings = excluded.warnings
            `).bind(p.id, p.nome, p.cpf, p.data_nascimento, p.endereco, JSON.stringify(p.warnings)).run();
          }

          // Só os pacientes deste cooperado.
          const idsPermitidos = dbPacientes.map((p) => p.id);
          if (idsPermitidos.length === 0) {
            return NextResponse.json({ success: true, pacientes: [], prescricoes: [], aprazamentos: [] });
          }
          const marcadores = idsPermitidos.map(() => '?').join(', ');

          const pacientesRes = (
            await db.prepare(`SELECT * FROM pacientes WHERE id IN (${marcadores})`).bind(...idsPermitidos).all()
          ).results;

          const mesAtualIso = new Date().toISOString().slice(0, 7);

          dbPacientes = await Promise.all(pacientesRes.map(async (p: any) => {
            const limite = Number(p.limite_visitas_mes || 0);
            let realizadas = 0;
            try {
              const countRes: any = await db.prepare(
                "SELECT COUNT(*) as total FROM evolucoes WHERE paciente_id = ? AND strftime('%Y-%m', check_in) = ?"
              ).bind(p.id, mesAtualIso).first();
              realizadas = Number(countRes?.total || 0);
            } catch {}

            const restantes = limite > 0 ? Math.max(0, limite - realizadas) : undefined;
            const atingido = limite > 0 ? realizadas >= limite : false;

            return {
              ...p,
              warnings: p.warnings ? JSON.parse(p.warnings) : [],
              limite_visitas_mes: limite,
              visitas_realizadas_mes: realizadas,
              visitas_restantes_mes: restantes,
              limite_atingido: atingido,
            };
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
                // `a.*` sozinho não bastava: nome do medicamento, dosagem e via
                // moram em `prescricoes`, e são exatamente o que a tela de
                // checagem do técnico exibe em cada card. Sem estas colunas o
                // cooperado recebia o horário com o medicamento em branco.
                `SELECT a.*, p.paciente_id, p.medicamento, p.dosagem, p.via_administracao
                   FROM aprazamentos a
                   JOIN prescricoes p ON p.id = a.prescricao_id
                  WHERE p.paciente_id IN (${marcadores})
                  ORDER BY a.horario_previsto ASC`
              )
              .bind(...idsPermitidos)
              .all()
          ).results;
        }

        return NextResponse.json({
          success: true,
          pacientes: dbPacientes,
          prescricoes: dbPrescricoes,
          aprazamentos: dbAprazamentos,
        });
      } catch (err: any) {
        console.error('Falha ao carregar agenda autorizada do Bubble:', err);
        return NextResponse.json({ success: false, error: 'Não foi possível confirmar os pacientes vinculados ao cooperado.' }, { status: 503 });
      }
    }

    return NextResponse.json({ success: true, pacientes: [], prescricoes: [], aprazamentos: [] });
  } catch (error: any) {
    console.error('Erro na rota de API de Agenda:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Erro interno ao buscar agenda diária.'
    }, { status: 500 });
  }
}
