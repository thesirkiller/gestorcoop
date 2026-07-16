import { NextRequest, NextResponse } from 'next/server';
import { equipamentosV2Ativo } from '@/lib/bubble';
import { cronAutorizado, gerarAlertas } from '@/lib/equipamentos-jobs';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

// Endpoint de cron (fora de /api/gestor, portanto fora da sessão de cookie).
// Protegido por CRON_SECRET via header Authorization: Bearer <segredo>.
export async function POST(request: NextRequest) {
  if (!cronAutorizado(request)) {
    return NextResponse.json({ success: false, error: 'Não autorizado.' }, { status: 401 });
  }
  if (!equipamentosV2Ativo) {
    return NextResponse.json({ success: false, error: 'V2 desabilitado.' }, { status: 503 });
  }
  const resultado = await gerarAlertas();
  return NextResponse.json({ success: true, data: resultado });
}
