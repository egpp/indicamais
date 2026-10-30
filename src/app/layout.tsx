import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { RodapeSite } from "./_componentes/marca";
import "./globals.css";

/** Sans geométrica livre, próxima do logotipo. Servida pelo próprio site (sem pedido a terceiros no navegador). */
const fonteCorpo = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--fonte-corpo",
});

export const metadata: Metadata = {
  title: "IndicaMais",
  description: "Divulgação, indicação e relacionamento entre empresas, profissionais e pessoas.",
};

export const viewport: Viewport = {
  themeColor: "#19181d",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={fonteCorpo.variable}>
      <body>
        {children}
        <RodapeSite />
      </body>
    </html>
  );
}
