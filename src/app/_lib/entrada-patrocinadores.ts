import { brasiliaParaIsoUtc } from "./data-fuso";
import type { Ler } from "./entrada-conteudo";

/**
 * Formulário de patrocinador -> entrada dos schemas do módulo administracao (IM-020). Só transforma texto
 * digitado (datas de Brasília -> ISO em UTC, caixa marcada -> boolean); quem valida é o módulo, e a MESMA
 * validação roda no navegador e no servidor. Não existe campo de preço, plano, cobrança nem URL externa.
 */

export const CAMPOS_PATROCINADOR = [
  "titulo",
  "perfilDestinoId",
  "textoDestino",
  "ordem",
  "inicioEm",
  "fimEm",
  "ativo",
  "motivo",
] as const;

const semOrdem = (ler: Ler) => (ler("ordem").trim() === "" ? undefined : ler("ordem"));

function comum(ler: Ler) {
  return {
    id: ler("id"),
    titulo: ler("titulo"),
    imagemPath: ler("imagemPath"),
    perfilDestinoId: ler("perfilDestinoId"),
    textoDestino: ler("textoDestino"),
    ordem: semOrdem(ler),
    inicioEm: brasiliaParaIsoUtc(ler("inicioEm")),
    fimEm: brasiliaParaIsoUtc(ler("fimEm")),
    motivo: ler("motivo"),
  };
}

export const lerCriarPatrocinador = (ler: Ler) => ({
  ...comum(ler),
  ativo: ler("ativo") === "sim",
});
export const lerAlterarPatrocinador = (ler: Ler) => comum(ler);
export const lerDefinirAtivo = (ler: Ler) => ({
  id: ler("id"),
  ativo: ler("ativo") === "sim",
  motivo: ler("motivo"),
});
