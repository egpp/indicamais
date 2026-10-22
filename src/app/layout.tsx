import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IndicaMais",
  description: "Divulgação, indicação e relacionamento entre empresas, profissionais e pessoas.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
