/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';

import { obterSessaoCooperado } from '@/lib/sessao-cooperado';
import { bubbleApi } from '@/lib/bubble';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

function formatarProfissao(profissaoBruta?: string, cargoBruto?: string): string {
  const p = (profissaoBruta || cargoBruto || '').trim();
  if (!p) return 'Técnico(a) de Enfermagem';
  if (p === 'Tecnico_Enfermagem' || p.toLowerCase().includes('tecnico') || p.toLowerCase().includes('técnico')) return 'Técnico(a) de Enfermagem';
  if (p === 'Medico' || p.toLowerCase().includes('medico') || p.toLowerCase().includes('médic')) return 'Médico(a)';
  if (p === 'Terapeuta' || p.toLowerCase().includes('terapeuta')) return 'Terapeuta Ocupacional';
  if (p.toLowerCase().includes('enferm')) return 'Enfermeiro(a)';
  if (p.toLowerCase().includes('fisio')) return 'Fisioterapeuta';
  if (p.toLowerCase().includes('fono')) return 'Fonoaudiólogo(a)';
  if (p.toLowerCase().includes('nutri')) return 'Nutricionista';
  if (p.toLowerCase().includes('psico')) return 'Psicólogo(a)';
  return p;
}

/**
 * Perfil do cooperado logado, espelhando `/api/gestor/me`.
 *
 * Retorna dados cadastrais completos (nome, cargo, foto, profissão, email, cpf)
 * para exibição no aplicativo do cooperado, na home e na área do usuário.
 */
export async function GET(request: NextRequest) {
  const sessao = await obterSessaoCooperado(request);

  if (!sessao) {
    return NextResponse.json(
      { success: false, autenticado: false, error: 'Sessão de cooperado ausente ou inválida.' },
      { status: 401 },
    );
  }

  let nome = sessao.nome;
  const cargo = sessao.cargo || 'Tecnico_Enfermagem';
  let profissao = formatarProfissao(undefined, cargo);
  let email = '';
  let cpf = '';
  let foto: string | null = null;

  try {
    const cooperado: any = await bubbleApi.getCooperado(sessao.cooperadoId);
    if (cooperado) {
      if (cooperado.txt_nomeCompleto || cooperado.txt_nome) {
        nome = (cooperado.txt_nomeCompleto || cooperado.txt_nome).trim();
      }
      if (cooperado.txt_profissao) {
        profissao = formatarProfissao(cooperado.txt_profissao, cargo);
      }
      if (cooperado.txt_email || cooperado.email) {
        email = (cooperado.txt_email || cooperado.email).trim();
      }
      if (cooperado.txt_CPF || cooperado.txt_cpf) {
        cpf = (cooperado.txt_CPF || cooperado.txt_cpf).trim();
      }

      // Resolução de foto do cooperado
      let candidateFoto = cooperado.img_foto || cooperado.foto || cooperado.file_foto || cooperado.foto_perfil;
      if (!candidateFoto && Array.isArray(cooperado.fks_pasta)) {
        candidateFoto = cooperado.fks_pasta.find((url: string) => {
          if (typeof url !== 'string') return false;
          const clean = url.split('?')[0].toLowerCase();
          return clean.endsWith('.jpg') || clean.endsWith('.jpeg') || clean.endsWith('.png') || clean.endsWith('.webp');
        });
      }

      if (!candidateFoto && cooperado.fk_usuario) {
        try {
          const user = await bubbleApi.getUser(cooperado.fk_usuario);
          if (user?.img_foto) candidateFoto = user.img_foto;
        } catch {
          // ignora falha secundária de usuário
        }
      }

      if (candidateFoto && typeof candidateFoto === 'string') {
        foto = candidateFoto.startsWith('//') ? `https:${candidateFoto}` : candidateFoto;
      }
    }
  } catch (e) {
    console.warn('Aviso ao buscar detalhes do sócio cooperado:', e);
  }

  return NextResponse.json({
    success: true,
    autenticado: true,
    cooperadoId: sessao.cooperadoId,
    userId: sessao.userId,
    nome,
    cargo,
    profissao,
    email,
    cpf,
    foto,
  });
}

