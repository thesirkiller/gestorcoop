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

// Resolve o tema ANTES da primeira pintura. Sem isto o profissional em plantão
// noturno leva um flash branco de tela cheia a cada navegação — exatamente o
// que o modo escuro existe para evitar.
//
// Roda só em /cooperado: o painel do gestor compartilha o `GestorShell` com sete
// outros módulos que ainda não foram migrados para os tokens, e escurecer o
// conteúdo dentro de um shell claro seria pior do que não escurecer nada.
//
// A lógica é a mesma de `@/lib/tema` (resolverTema). Está duplicada aqui de
// propósito: é um script inline, não pode importar módulo. Ao mexer numa,
// mexa na outra.
const SCRIPT_TEMA = `(function(){try{
if(!/^\\/cooperado(\\/|$)/.test(location.pathname))return;
var q=new URLSearchParams(location.search).get('tema');
if(q==='claro'||q==='escuro'||q==='auto'){try{localStorage.setItem('gc_tema',q)}catch(e){}}
var p=null;try{p=localStorage.getItem('gc_tema')}catch(e){}
if(p!=='claro'&&p!=='escuro')p='auto';
var h=new Date().getHours();
var escuro=p==='escuro'||(p==='auto'&&((window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)||h>=19||h<7));
if(escuro)document.documentElement.setAttribute('data-theme','escuro');
}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // O script inline acima escreve `data-theme` no <html> antes do React
    // hidratar; sem `suppressHydrationWarning` o Next reclama do atributo extra.
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
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
