import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

// NOTA: Geist e Geist Mono eram carregados aqui via next/font/local e expostos
// como --font-geist-sans / --font-geist-mono. Nada consumia essas variáveis:
// o tailwind.config não define `fontFamily` e nenhuma regra CSS as referencia.
// Os dois arquivos .woff eram baixados e preloaded a cada visita sem nunca
// renderizar um caractere. Removidos. O app usa a stack sans do sistema, que é
// legítima para o registro `product` — e é o que ele já renderizava de fato.

export const metadata: Metadata = {
  title: "GestorCoop - Gestão de Cooperados",
  description: "Plataforma de gestão integrada para cooperativas de trabalho.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <head>
        {process.env.NODE_ENV === "development" && (
          <Script
            src="//unpkg.com/react-grab/dist/index.global.js"
            crossOrigin="anonymous"
            strategy="beforeInteractive"
          />
        )}
      </head>
      <body
        className="antialiased"
      >
        {children}
      </body>
    </html>
  );
}
