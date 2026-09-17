import { SignJWT, jwtVerify } from 'jose';
export const VALIDADE_PADRAO_SEGUNDOS = 12 * 60 * 60;
export type AreaSessao = 'cooperado' | 'gestor';
export interface IdentidadeSessao {
  userId: string; area: AreaSessao; cooperadoId?: string; nome: string;
  cargo?: 'Tecnico_Enfermagem' | 'Medico' | 'Terapeuta';
}
export interface ClaimsSessao extends IdentidadeSessao { sessionId: string; exp: number }
function chave() {
  const secret = process.env.AUTH_JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error('AUTH_JWT_SECRET deve conter ao menos 32 caracteres.');
  return new TextEncoder().encode(secret);
}
const issuer = () => process.env.AUTH_JWT_ISSUER || 'gestorcoop';
export async function emitirTokenSessao(identity: IdentidadeSessao, sessionId: string, segundos = VALIDADE_PADRAO_SEGUNDOS) {
  return new SignJWT({ area: identity.area, cooperadoId: identity.cooperadoId, nome: identity.nome, cargo: identity.cargo })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' }).setSubject(identity.userId)
    .setIssuer(issuer()).setAudience('gestorcoop-app').setJti(sessionId).setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + segundos).sign(chave());
}
export async function validarTokenSessao(token: string | null | undefined, area?: AreaSessao): Promise<ClaimsSessao | null> {
  if (!token || token.length > 8192) return null;
  try {
    const { payload, protectedHeader } = await jwtVerify(token, chave(), {
      algorithms: ['HS256'], issuer: issuer(), audience: 'gestorcoop-app', requiredClaims: ['sub', 'iat', 'exp', 'jti'],
    });
    if (protectedHeader.typ !== 'JWT' || !payload.sub || !payload.jti || !payload.exp ||
      !['cooperado', 'gestor'].includes(String(payload.area)) || (area && payload.area !== area) ||
      typeof payload.nome !== 'string' || (payload.area === 'cooperado' && !payload.cooperadoId)) return null;
    return { userId: payload.sub, sessionId: payload.jti, exp: payload.exp, area: payload.area as AreaSessao,
      cooperadoId: typeof payload.cooperadoId === 'string' ? payload.cooperadoId : undefined,
      nome: payload.nome, cargo: payload.cargo as IdentidadeSessao['cargo'] };
  } catch { return null; }
}
export function tokenDoCabecalho(value: string | null | undefined): string | null {
  return value?.match(/^Bearer ([A-Za-z0-9_.-]+)$/i)?.[1] || null;
}
