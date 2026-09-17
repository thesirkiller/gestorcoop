import ProntuarioAtendimento from './prontuario-atendimento';

/**
 * Casca de servidor só para declarar o runtime. Ver a nota equivalente em
 * `gestor/prontuarios/[id]/page.tsx`: rota dinâmica precisa rodar no edge para
 * o `next-on-pages` aceitar o build, e `'use client'` não pode declarar isso.
 */
export const runtime = 'edge';

export default function Page() {
  return <ProntuarioAtendimento />;
}
