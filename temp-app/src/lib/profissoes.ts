// Valores EXATOS do option set "Profissões" no Bubble (auditados no live em
// 17/07/2026 via scripts/probar-os-profissao.mts). Atenção às armadilhas reais
// do set: 'Técnico (a) de Enfermagem ' tem espaço no final, 'Psicologo (a)' é
// sem acento e o genérico é 'Outro (a)'. Enviar qualquer variação diferente
// faz o Data API responder 400 "could not parse".
export const PROFISSOES_BUBBLE = [
  'Biomédico (a)',
  'Enfermeiro (a)',
  'Farmacêutico (a)',
  'Fisioterapeuta',
  'Fonoaudiólogo (a)',
  'Médico (a)',
  'Nutricionista',
  'Outro (a)',
  'Psicologo (a)',
  'Técnico (a) de Enfermagem ',
  'Técnico (a) de Laboratório',
] as const;

// Rótulos exibidos no formulário (sem espaço sobrando, com acento) → valor Bubble.
export const PROFISSOES_FORM: Array<{ label: string; value: string }> = [
  { label: 'Enfermeiro (a)', value: 'Enfermeiro (a)' },
  { label: 'Técnico (a) de Enfermagem', value: 'Técnico (a) de Enfermagem ' },
  { label: 'Médico (a)', value: 'Médico (a)' },
  { label: 'Fisioterapeuta', value: 'Fisioterapeuta' },
  { label: 'Nutricionista', value: 'Nutricionista' },
  { label: 'Psicólogo (a)', value: 'Psicologo (a)' },
  { label: 'Fonoaudiólogo (a)', value: 'Fonoaudiólogo (a)' },
  { label: 'Biomédico (a)', value: 'Biomédico (a)' },
  { label: 'Farmacêutico (a)', value: 'Farmacêutico (a)' },
  { label: 'Técnico (a) de Laboratório', value: 'Técnico (a) de Laboratório' },
  { label: 'Outros', value: 'Outro (a)' },
];

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

// Converte o que veio do cliente (inclusive rascunhos salvos com valores
// antigos, sem espaço/com acento) para o valor exato aceito pelo Bubble.
// Retorna null quando não há correspondência — nesse caso o chamador deve
// omitir o campo de option set em vez de arriscar um 400.
export function normalizeProfissaoBubble(name: string): string | null {
  const target = fold(name || '');
  if (!target) return null;
  const hit = PROFISSOES_BUBBLE.find((p) => fold(p) === target);
  if (hit) return hit;
  if (target === 'outro' || target === 'outros') return 'Outro (a)';
  return null;
}
