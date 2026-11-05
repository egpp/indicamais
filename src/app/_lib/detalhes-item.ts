/**
 * Detalhes informativos de um item, lidos da descrição (D-023, IM-101): variações como texto (tamanho, cor), sem
 * estoque, e marca de "plano" do negócio (vitrine do estilo Fitness, sem assinatura real). Convenção de linha na
 * descrição: "Tamanhos: P, M, G", "Cores: azul, preto", "Periodicidade: por mês". Não há campo novo no banco.
 * Só apresentação: nada aqui calcula preço, estoque nem disponibilidade (IM-090).
 */
export type GrupoVariacao = { rotulo: string; opcoes: string[] };

export type DetalhesItem = {
  /** Descrição sem as linhas de convenção. */
  descricao: string | null;
  variacoes: GrupoVariacao[];
  /** "por mês" etc.; presente = o item é um plano do negócio. */
  periodicidade: string | null;
  /** Linhas restantes da descrição, uma por benefício (usado nos planos). */
  linhas: string[];
};

const MAX_OPCOES = 12;
const MAX_TEXTO_OPCAO = 30;

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const ROTULOS: Record<string, string> = {
  tamanho: "Tamanho",
  tamanhos: "Tamanho",
  cor: "Cor",
  cores: "Cor",
};

export function detalhesDoItem(descricao: string | null | undefined): DetalhesItem {
  const variacoes: GrupoVariacao[] = [];
  let periodicidade: string | null = null;
  const restantes: string[] = [];
  for (const bruta of (descricao ?? "").split(/\r?\n/)) {
    const linha = bruta.trim();
    const m = /^([^:]{3,15}):\s*(.+)$/.exec(linha);
    const chave = m ? semAcento(m[1]!.trim()) : "";
    if (m && ROTULOS[chave]) {
      const opcoes = [
        ...new Set(
          m[2]!
            .split(/[,;/]/)
            .map((o) => o.trim())
            .filter((o) => o.length > 0 && o.length <= MAX_TEXTO_OPCAO),
        ),
      ].slice(0, MAX_OPCOES);
      if (opcoes.length > 0) {
        variacoes.push({ rotulo: ROTULOS[chave]!, opcoes });
        continue;
      }
    }
    if (m && chave === "periodicidade") {
      periodicidade = m[2]!.trim().slice(0, 40);
      continue;
    }
    restantes.push(linha);
  }
  const texto = restantes
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return {
    descricao: texto || null,
    variacoes,
    periodicidade,
    linhas: restantes.map((l) => l.replace(/^[-•*]\s*/, "").trim()).filter(Boolean),
  };
}
