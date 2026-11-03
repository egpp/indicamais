import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { RodapeSite } from "./_componentes/marca";
import "./globals.css";

/** Sans geométrica livre, próxima do logotipo. Hospedada no projeto (OFL, variável, latin): sem rede no build nem pedido a terceiros. */
const fonteCorpo = localFont({
  src: "./fonts/plus-jakarta-sans-latin-wght-normal.woff2",
  weight: "200 800",
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
