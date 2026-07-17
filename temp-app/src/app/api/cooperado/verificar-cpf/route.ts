import { NextResponse } from 'next/server';
import { bubbleApi } from '@/lib/bubble';
import { isValidCPF, cpfDigits } from '@/lib/cpf';

export const runtime = 'edge';

// Consulta se um CPF já possui cadastro de cooperado.
// Retorna apenas o mínimo necessário para o frontend orientar o usuário —
// nunca dados pessoais do registro encontrado.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cpf = searchParams.get('cpf') || '';

  if (!isValidCPF(cpf)) {
    return NextResponse.json({ error: 'CPF inválido' }, { status: 400 });
  }

  try {
    const existente = await bubbleApi.findCooperadoByCPF(cpfDigits(cpf));

    if (!existente) {
      return NextResponse.json({ exists: false });
    }

    const registro = existente as { txt_termo_status?: string; bool_BLOQUEADO?: boolean; bool_listaNegra?: boolean };
    return NextResponse.json({
      exists: true,
      termoStatus: registro.txt_termo_status || null,
      bloqueado: !!registro.bool_BLOQUEADO || !!registro.bool_listaNegra,
    });
  } catch (error) {
    const err = error as { message?: string };
    console.error('Erro ao verificar CPF:', err);
    // Em caso de falha na consulta, não bloqueia o fluxo — o POST de adesão
    // repete a verificação antes de criar o registro.
    return NextResponse.json({ exists: false, checkFailed: true });
  }
}
