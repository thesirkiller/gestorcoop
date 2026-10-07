/* eslint-disable @typescript-eslint/no-explicit-any */
import { bubbleApi, Paciente } from '@/lib/bubble';
import { getClinicalDb, garantirSchemaD1, inMemoryPacientes, PacienteClinico } from '@/lib/db/prontuarios';
import { invalidarCacheMemoria, CHAVE_CACHE_PACIENTES_BUBBLE } from '@/lib/cache-memoria';
import { invalidarCacheNavegacao, CHAVE_CACHE_LISTAGEM_PACIENTES } from '@/lib/cache-navegacao';

export interface ResultadoSincronizacaoPacientes {
  totalBubble: number;
  sincronizados: number;
  erros: string[];
  duracaoMs: number;
}

const CHUNK_SIZE = 50;

/**
 * Sincroniza pacientes cadastrados no Bubble para a tabela `pacientes` do D1.
 *
 * Características essenciais:
 * 1. Executa upsert em batches de até 50 instruções por batch (compatível com os limites do D1).
 * 2. Em caso de conflito de ID, atualiza apenas dados cadastrais vindos do Bubble (nome, CPF se fornecido,
 *    endereço e telefone), PRESERVANDO integralmente todos os campos clínicos preenchidos no D1
 *    (diagnóstico, complexidade, plano de saúde, carteirinha, cota de visitas, status clínico, etc).
 * 3. Invalida os caches de memória e navegação após a conclusão.
 */
export async function sincronizarPacientesBubbleParaD1(
  opcoes: { db?: any; pacientesMock?: Paciente[] } = {}
): Promise<ResultadoSincronizacaoPacientes> {
  const inicio = Date.now();
  const db = opcoes.db !== undefined ? opcoes.db : getClinicalDb();
  const erros: string[] = [];

  let pacientesBubble: Paciente[] = [];
  try {
    pacientesBubble = opcoes.pacientesMock ?? (await bubbleApi.getPacientes());
  } catch (err: any) {
    const msg = `Falha ao buscar pacientes do Bubble: ${err?.message || err}`;
    console.error(`[sync-pacientes] ${msg}`);
    return {
      totalBubble: 0,
      sincronizados: 0,
      erros: [msg],
      duracaoMs: Date.now() - inicio,
    };
  }

  const totalBubble = pacientesBubble.length;
  let sincronizados = 0;

  if (!db) {
    // Ambiente sem D1 conectado (ex: dev local em memória): sincroniza via Map preservando dados clínicos locais
    for (const b of pacientesBubble) {
      if (!b._id) continue;
      try {
        const existente = inMemoryPacientes.get(b._id);
        const nomeTrim = (b.txt_nome || '').trim();
        const nome = (nomeTrim && nomeTrim !== 'Paciente sem Nome') ? nomeTrim : (existente?.nome || nomeTrim || 'Paciente sem Nome');
        const cpf = (b.txt_cpf || '').trim() || existente?.cpf || '';
        const endereco = (b.txt_endereco || '').trim() || existente?.endereco || '';
        const telefone = (b.txt_whatsapp || '').trim() || existente?.telefone || '';
        const warnings = b.fks_equipamentos && b.fks_equipamentos.length > 0
          ? (existente?.warnings ? Array.from(new Set([...existente.warnings, 'Possui equipamentos em casa'])) : ['Possui equipamentos em casa'])
          : (existente?.warnings || []);

        const registroAtualizado: PacienteClinico = {
          id: b._id,
          nome,
          cpf,
          data_nascimento: existente?.data_nascimento || '',
          endereco,
          telefone,
          responsavel_nome: existente?.responsavel_nome || '',
          responsavel_telefone: existente?.responsavel_telefone || '',
          diagnostico_principal: existente?.diagnostico_principal || 'Acompanhamento Domiciliar',
          cid10: existente?.cid10 || '',
          complexidade: existente?.complexidade || 'Baixa',
          plano_saude: existente?.plano_saude || '',
          numero_carteirinha: existente?.numero_carteirinha || '',
          warnings,
          status: existente?.status || 'Ativo',
          limite_visitas_mes: existente?.limite_visitas_mes ?? 0,
          created_at: existente?.created_at || b.CreatedDate || new Date().toISOString(),
        };

        inMemoryPacientes.set(b._id, registroAtualizado);
        sincronizados++;
      } catch (err: any) {
        erros.push(`Paciente ${b._id}: ${err?.message || err}`);
      }
    }
  } else {
    // D1 persistente: upsert seguro em lote preservando dados clínicos locais
    await garantirSchemaD1(db);

    const stmts: any[] = [];
    const now = new Date().toISOString();

    for (const b of pacientesBubble) {
      if (!b._id) continue;

      const nome = (b.txt_nome || '').trim() || 'Paciente sem Nome';
      const cpf = (b.txt_cpf || '').trim();
      const endereco = (b.txt_endereco || '').trim();
      const telefone = (b.txt_whatsapp || '').trim();
      const warnings = JSON.stringify(
        b.fks_equipamentos && b.fks_equipamentos.length > 0 ? ['Possui equipamentos em casa'] : []
      );
      const createdAt = b.CreatedDate || now;

      // Se o paciente já existe no D1, atualizamos nome (caso não seja vazio/'Paciente sem Nome'),
      // e atualizamos cpf/endereco/telefone apenas se o Bubble contiver valor preenchido.
      // Diagnóstico, complexidade, plano de saúde e status são integralmente preservados.
      const stmt = db.prepare(`
        INSERT INTO pacientes (
          id, nome, cpf, data_nascimento, endereco, telefone, responsavel_nome,
          responsavel_telefone, diagnostico_principal, cid10, complexidade,
          plano_saude, numero_carteirinha, warnings, status, limite_visitas_mes, created_at
        ) VALUES (?, ?, ?, '', ?, ?, '', '', 'Acompanhamento Domiciliar', '', 'Baixa', '', '', ?, 'Ativo', 0, ?)
        ON CONFLICT(id) DO UPDATE SET
          nome = CASE WHEN excluded.nome != '' AND excluded.nome != 'Paciente sem Nome' THEN excluded.nome ELSE pacientes.nome END,
          cpf = CASE WHEN excluded.cpf != '' THEN excluded.cpf ELSE pacientes.cpf END,
          endereco = CASE WHEN excluded.endereco != '' THEN excluded.endereco ELSE pacientes.endereco END,
          telefone = CASE WHEN excluded.telefone != '' THEN excluded.telefone ELSE pacientes.telefone END
      `).bind(b._id, nome, cpf, endereco, telefone, warnings, createdAt);

      stmts.push(stmt);
    }

    // Executa em chunks para respeitar o limite de statements por batch no Cloudflare D1
    for (let i = 0; i < stmts.length; i += CHUNK_SIZE) {
      const chunk = stmts.slice(i, i + CHUNK_SIZE);
      try {
        await db.batch(chunk);
        sincronizados += chunk.length;
      } catch (err: any) {
        const msg = `Erro no batch ${Math.floor(i / CHUNK_SIZE) + 1}: ${err?.message || err}`;
        console.error(`[sync-pacientes] ${msg}`);
        erros.push(msg);
      }
    }
  }

  // Invalida caches para refletir os novos dados
  invalidarCacheMemoria(CHAVE_CACHE_PACIENTES_BUBBLE);
  invalidarCacheNavegacao(CHAVE_CACHE_LISTAGEM_PACIENTES);

  return {
    totalBubble,
    sincronizados,
    erros,
    duracaoMs: Date.now() - inicio,
  };
}
