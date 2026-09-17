import Prontuario360Detalhe from './prontuario-detalhe';

/**
 * Casca de servidor só para declarar o runtime. O `next-on-pages` recusa o
 * build quando uma rota dinâmica não roda no edge, e `export const runtime`
 * não vale dentro de um arquivo `'use client'` — daí a separação: a tela
 * inteira vive em `prontuario-detalhe.tsx` e o id continua vindo de
 * `useParams()`, sem precisar descer por props.
 */
export const runtime = 'edge';

export default function Page() {
  return <Prontuario360Detalhe />;
}
