// Dublê de next/font/google para o Vitest: o carregador real só existe no build do Next.
type Opcoes = { variable?: string };
const fonte = (o: Opcoes) => ({ variable: o.variable ?? "", className: o.variable ?? "" });
export const Barlow = fonte;
export const Barlow_Condensed = fonte;
export const Cormorant_Garamond = fonte;
export const Inter = fonte;
export const Jost = fonte;
export const Lato = fonte;
export const Nunito = fonte;
export const Playfair_Display = fonte;
export const Plus_Jakarta_Sans = fonte;
