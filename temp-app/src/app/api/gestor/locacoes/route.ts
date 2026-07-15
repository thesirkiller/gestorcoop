import { NextRequest, NextResponse } from 'next/server';
import { bubbleApi, LocacaoEquipamento } from '@/lib/bubble';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    console.log('Listando todas as locações no Bubble...');
    const list = await bubbleApi.getLocacoes();
    return NextResponse.json({ success: true, data: list });
  } catch (error) {
    const err = error as { message?: string };
    console.error('Erro ao listar locações:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Erro ao buscar locações' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fk_equipamento, fk_paciente, date_inicio, date_fim_previsto, num_valor_aluguel, txt_observacoes } = body;

    if (!fk_equipamento || !fk_paciente || !date_inicio || !date_fim_previsto || num_valor_aluguel === undefined) {
      return NextResponse.json(
        { success: false, error: 'Equipamento, Paciente, Data de Início, Data de Fim Previsto e Valor do Aluguel são obrigatórios.' },
        { status: 400 }
      );
    }

    console.log(`Registrando nova locação: Equipamento ${fk_equipamento} para Paciente ${fk_paciente}`);
    
    // Create the rental
    const newLocacao: Omit<LocacaoEquipamento, '_id' | 'CreatedDate'> = {
      fk_equipamento,
      fk_paciente,
      date_inicio,
      date_fim_previsto,
      num_valor_aluguel: Number(num_valor_aluguel),
      txt_status: 'Ativo',
      txt_observacoes,
    };
    const created = await bubbleApi.createLocacao(newLocacao);

    // Update equipment status to 'Alugado'
    console.log(`Atualizando status do equipamento ${fk_equipamento} para 'Alugado'`);
    await bubbleApi.updateEquipamento(fk_equipamento, { txt_status: 'Alugado' });

    // Link equipment and rental to the patient (Option B)
    try {
      console.log(`Buscando paciente ${fk_paciente} para atualizar listas...`);
      const patient = await bubbleApi.getPaciente(fk_paciente);
      const currentEquips = patient.fks_equipamentos || [];
      const currentLocacoes = patient.fks_locacoes || [];

      if (!currentEquips.includes(fk_equipamento)) {
        currentEquips.push(fk_equipamento);
      }
      if (created._id && !currentLocacoes.includes(created._id)) {
        currentLocacoes.push(created._id);
      }

      console.log(`Atualizando listas no paciente ${fk_paciente}`);
      await bubbleApi.updatePaciente(fk_paciente, {
        fks_equipamentos: currentEquips,
        fks_locacoes: currentLocacoes
      });
    } catch (linkError) {
      console.error('Erro ao relacionar locacao/equipamento ao paciente:', linkError);
    }

    return NextResponse.json({ success: true, data: created });
  } catch (error) {
    const err = error as { message?: string };
    console.error('Erro ao registrar locação:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Erro ao registrar locação' },
      { status: 500 }
    );
  }
}
