/**
 * Textos dos avisos (pt-BR). IM-051: só existem textos para contato válido e curtida (mais indicação válida ao
 * indicador e resultado de revisão). NENHUM texto afirma compartilhamento externo (WhatsApp, redes etc.): o sistema
 * não sabe se o link foi compartilhado, então não diz. Teste em servico.test.ts barra termos de compartilhamento.
 * IM-050: o ator aparece só pelo nome público; sem ele, "Uma pessoa". Nunca há telefone, e-mail ou nome completo.
 */
export type TipoAviso =
  | "contato_valido"
  | "indicacao_valida"
  | "curtida"
  | "revisao_aprovada"
  | "revisao_rejeitada"
  | "banner_aguardando_aceite"
  | "inadimplencia_atraso_indicador"
  | "inadimplencia_prazo_indicador"
  | "inadimplencia_atraso_negocio"
  | "inadimplencia_prazo_negocio";

export const TIPOS_AVISO: readonly TipoAviso[] = [
  "contato_valido",
  "indicacao_valida",
  "curtida",
  "revisao_aprovada",
  "revisao_rejeitada",
  "banner_aguardando_aceite",
  "inadimplencia_atraso_indicador",
  "inadimplencia_prazo_indicador",
  "inadimplencia_atraso_negocio",
  "inadimplencia_prazo_negocio",
];

export const ehTipoAviso = (v: string | null): v is TipoAviso =>
  v !== null && (TIPOS_AVISO as readonly string[]).includes(v);

export function textoDoAviso(
  tipo: TipoAviso,
  destinoNome: string,
  atorNome: string | null,
): { titulo: string; texto: string } {
  const destino = destinoNome.trim() || "seu cadastro";
  const negocio = destinoNome.trim() || "o negócio";
  const ator = atorNome?.trim() || "Uma pessoa";
  switch (tipo) {
    case "contato_valido":
      return {
        titulo: "Novo contato por indicação",
        texto: `${ator} indicou e um contato chegou para ${destino}.`,
      };
    case "indicacao_valida":
      return {
        titulo: "Sua indicação gerou um contato",
        texto: `Um contato chegou para ${destino} pela sua indicação.`,
      };
    case "curtida":
      return { titulo: "Nova curtida", texto: `${ator} curtiu ${destino}.` };
    case "revisao_aprovada":
      return { titulo: "Cadastro aprovado", texto: `${destino} foi aprovado e já pode aparecer.` };
    case "revisao_rejeitada":
      return {
        titulo: "Cadastro não aprovado",
        texto: `${destino} não foi aprovado. Abra para ver o que ajustar.`,
      };
    case "banner_aguardando_aceite":
      return {
        titulo: "Banner aguardando aceite",
        texto: `Um banner novo aguarda o seu aceite no site ${destino}.`,
      };
    // IM-072: avisos de inadimplência. Sem valores, sem nomes de pessoas e sem prometer encerramento automático.
    case "inadimplencia_atraso_indicador":
      return {
        titulo: "Pagamento em atraso",
        texto: `Há um mês encerrado sem pagamento confirmado em ${negocio}. Enquanto isso, você não gera comissões novas nesse negócio. Regularize para manter seus vínculos.`,
      };
    case "inadimplencia_prazo_indicador":
      return {
        titulo: "Seus vínculos podem ser encerrados em breve",
        texto: `O prazo de atraso em ${negocio} está perto do fim. Depois dele, a administração pode encerrar seus vínculos nesse negócio.`,
      };
    case "inadimplencia_atraso_negocio":
      return {
        titulo: "Indicador com pagamento em atraso",
        texto: `Um indicador de ${negocio} tem mês encerrado sem pagamento confirmado e não gera comissões novas enquanto isso.`,
      };
    case "inadimplencia_prazo_negocio":
      return {
        titulo: "Prazo de atraso perto do fim",
        texto: `O prazo de atraso de um indicador de ${negocio} está perto do fim. Depois dele, a administração pode encerrar o vínculo.`,
      };
  }
}
