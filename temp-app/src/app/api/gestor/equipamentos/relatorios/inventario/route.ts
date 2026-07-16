import { NextRequest, NextResponse } from 'next/server';
import { bubbleApi, equipamentosV2Ativo } from '@/lib/bubble';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

// GET: relatório de inventário completo com filtros por status, categoria e fabricante.
export async function GET(request: NextRequest) {
  try {
    if (!equipamentosV2Ativo) {
      return NextResponse.json(
        { success: false, error: 'O fluxo de relatórios será habilitado junto com o V2.' },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const categoria = searchParams.get('categoria');
    const fabricante = searchParams.get('fabricante');

    const constraints: Array<{ key: string; constraint_type: string; value: string }> = [];
    if (status) constraints.push({ key: 'OS_status', constraint_type: 'equals', value: status });
    if (categoria) constraints.push({ key: 'txt_categoria', constraint_type: 'equals', value: categoria });
    if (fabricante) constraints.push({ key: 'txt_fabricante', constraint_type: 'equals', value: fabricante });

    const equipamentos = await bubbleApi.getEquipamentos(constraints.length > 0 ? constraints : undefined);

    const itens = equipamentos.map((e) => ({
      id: e._id,
      nome: e.txt_nome,
      numeroSerie: e.txt_numero_serie,
      patrimonio: e.txt_numero_patrimonio || '',
      codigoInterno: e.txt_codigo_interno || '',
      status: e.txt_status,
      categoria: e.txt_categoria || '',
      fabricante: e.txt_fabricante || '',
      localizacao: e.fk_localizacao_atual || '',
      ultimaMovimentacao: e.date_ultima_movimentacao || '',
    }));

    const porStatus: Record<string, number> = {};
    for (const item of itens) {
      porStatus[item.status] = (porStatus[item.status] || 0) + 1;
    }

    return NextResponse.json({
      success: true,
      data: { total: itens.length, itens, porStatus },
    });
  } catch (error) {
    const err = error as { message?: string };
    console.error('Erro ao gerar relatório de inventário:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Erro ao gerar o relatório de inventário.' },
      { status: 500 }
    );
  }
}
