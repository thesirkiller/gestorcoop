import { NextRequest, NextResponse } from 'next/server';
import { bubbleApi } from '@/lib/bubble';
import { criarTicket, validarChaveIntegracao } from '@/lib/auth-embed';
export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  const headers = { 'Cache-Control': 'no-store' };
  try {
    if (!await validarChaveIntegracao(request.headers.get('x-bubble-embed-key'))) return NextResponse.json({ error: 'Integração não autenticada.' }, { status: 401, headers });
    const { user_id, area = 'cooperado' } = await request.json();
    if (typeof user_id !== 'string' || user_id.length > 128 || !['cooperado', 'gestor'].includes(area)) return NextResponse.json({ error: 'Identidade inválida.' }, { status: 400, headers });
    const origin = process.env.APP_ORIGIN;
    if (!origin) throw new Error('APP_ORIGIN não configurada.');
    const user = await bubbleApi.getUser(user_id);
    // Quem é gestor sai do próprio cadastro (`bool_colaborador_interno`), não de
    // uma lista no ambiente: são dezenas de pessoas e cada admissão ou
    // desligamento exigiria editar a variável e refazer o deploy — com o risco
    // de alguém desligado continuar entrando. GESTOR_USER_IDS segue valendo como
    // liberação avulsa, para conceder acesso sem mexer no cadastro.
    const liberadosPorAmbiente = (process.env.GESTOR_USER_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
    const ehGestor = user?.bool_colaborador_interno === true || liberadosPorAmbiente.includes(user_id);
    if (!user?._id || user._id !== user_id || (area === 'gestor' && !ehGestor) || (area === 'cooperado' && !user.fk_cooperado)) return NextResponse.json({ error: 'Usuário sem acesso a esta área.' }, { status: 403, headers });
    const ticket = await criarTicket({ userId: user_id, area, cooperadoId: area === 'cooperado' ? user.fk_cooperado : undefined, nome: user.txt_nome || 'Profissional', cargo: 'Tecnico_Enfermagem' });
    return NextResponse.json({ success: true, embed_url: `${origin.replace(/\/$/, '')}/entrar#ticket=${ticket}`, expires_in: 60 }, { headers });
  } catch { return NextResponse.json({ error: 'Não foi possível emitir acesso. Verifique a configuração da integração.' }, { status: 503, headers }); }
}
