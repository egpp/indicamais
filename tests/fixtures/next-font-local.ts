// Dublê de next/font/local para o Vitest: o carregador real só existe no build do Next.
type Opcoes = { variable?: string };
export default function localFont(o: Opcoes) {
  return { variable: o.variable ?? "", className: o.variable ?? "" };
}
