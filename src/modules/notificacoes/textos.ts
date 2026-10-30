/**
 * Textos dos avisos (pt-BR). IM-051: só existem textos para contato válido e curtida (mais indicação válida ao
 * indicador e resultado de revisão). NENHUM texto afirma compartilhamento externo (WhatsApp, redes etc.): o sistema
 * não sabe se o link foi compartilhado, então não diz. Teste em servico.test.ts barra termos de compartilhamento.
 * IM-050: o ator aparece só pelo nome público; sem ele, "Uma pessoa". Nunca há telefone, e-mail ou nome completo.
 */
export type TipoAviso =
  "contato_valido" | "indicacao_valida" | "curtida" | "revisao_aprovada" | "revisao_rejeitada";

export const TIPOS_AVISO: readonly TipoAviso[] = [
  "contato_valido",
  "indicacao_valida",
  "curtida",
  "revisao_aprovada",
  "revisao_rejeitada",
];

export const ehTipoAviso = (v: string | null): v is TipoAviso =>
  v !== null && (TIPOS_AVISO as readonly string[]).includes(v);

export function textoDoAviso(
  tipo: TipoAviso,
  destinoNome: string,
  atorNome: string | null,
): { titulo: string; texto: string } {
  const destino = destinoNome.trim() || "seu cadastro";
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
  }
}
