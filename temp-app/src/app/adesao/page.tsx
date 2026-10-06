import AdesaoPage from '@/app/cooperado/adesao/page';

export const metadata = {
  title: 'GestorCoop - Ficha de Inscrição & Adesão',
  description: 'Canal oficial e seguro de cadastro e adesão de novos cooperados.',
};

/**
 * Rota independente de tela inteira para o funil de adesão online (cooperacao.gestorcoop.app).
 * Totalmente isolada de molduras ou cascas mobile do app de cooperados.
 */
export default function Page() {
  return <AdesaoPage />;
}
