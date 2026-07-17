import GestorShell from './_components/GestorShell';

// Todas as telas do gestor compartilham o mesmo shell (sidebar + header).
// O fluxo público do cooperado (/cooperado/adesao) fica fora deste layout.
export default function GestorLayout({ children }: { children: React.ReactNode }) {
  return <GestorShell>{children}</GestorShell>;
}
