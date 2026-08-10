import { NextResponse } from 'next/server';

import { obterSessaoCooperado } from '@/lib/sessao-cooperado';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

/**
 * Perfil do cooperado logado, espelhando `/api/gestor/me`.
 *
 * Existe para que a interface pare de inventar uma sessão local ("Dra. Ana
 * Silva", id `coop_123`) e passe a exibir e registrar a pessoa de verdade. O
 * `cooperadoId` devolvido serve para os registros otimistas que a tela guarda
 * no IndexedDB antes de sincronizar — o servidor NÃO confia nesse valor quando
 * a fila chega, ele resolve tudo de novo pelo cookie.
 */
export async function GET() {
  const sessao = await obterSessaoCooperado();

  if (!sessao) {
    return NextResponse.json(
      { success: false, error: 'Sessão de cooperado ausente ou inválida.' },
      { status: 401 },
    );
  }

  return NextResponse.json({
    success: true,
    cooperadoId: sessao.cooperadoId,
    nome: sessao.nome,
  });
}
