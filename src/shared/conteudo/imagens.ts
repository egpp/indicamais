import { LIMITES, type TipoImagem } from "../config/limites";

/** Regras de imagem (D-006, IM-011, IM-012, IM-014). Funções puras; o Storage reforça no servidor. */

export type ResultadoImagem = { ok: true } | { ok: false; mensagem: string };

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const UUID_EXATO = new RegExp(`^${UUID}$`);
const EXTENSOES = Object.values(LIMITES.imagem.extensaoPorTipo).join("|");

/**
 * Caminhos OPACOS no bucket (IM-029, IM-086): `perfil/<perfil_id>/<uuid>.<jpg|png|webp>` e
 * `item/<item_id>/<uuid>.<ext>`. Nunca contêm o id da conta. Quem prova que a pasta é do dono é o banco
 * (política do Storage); o perfil/item precisa existir antes do upload.
 */
export type PastaImagem = "perfil" | "item";

const CAMINHO = new RegExp(`^(perfil|item)/(${UUID})/(${UUID})\\.(${EXTENSOES})$`);

export function validarImagem(entrada: {
  tipoMime: string;
  tamanhoBytes: number;
}): ResultadoImagem {
  const tipos: readonly string[] = LIMITES.imagem.tiposPermitidos;
  if (!tipos.includes(entrada.tipoMime)) {
    return { ok: false, mensagem: "Use uma imagem JPEG, PNG ou WebP." };
  }
  if (!Number.isFinite(entrada.tamanhoBytes) || entrada.tamanhoBytes <= 0) {
    return { ok: false, mensagem: "Arquivo de imagem vazio ou inválido." };
  }
  if (entrada.tamanhoBytes > LIMITES.imagem.tamanhoMaxBytes) {
    const mb = LIMITES.imagem.tamanhoMaxBytes / (1024 * 1024);
    return { ok: false, mensagem: `A imagem deve ter no máximo ${mb} MB.` };
  }
  return { ok: true };
}

/**
 * Caminho no bucket: `<pasta>/<donoId>/<uuid>.<ext>`. `idUnico` é injetável (teste); por padrão é um uuid
 * aleatório. Lança se `donoId`/`idUnico` não forem uuid ou o tipo não for permitido.
 */
export function gerarCaminhoImagem(
  pasta: PastaImagem,
  donoId: string,
  tipoMime: TipoImagem,
  idUnico: string = crypto.randomUUID(),
): string {
  const ext = LIMITES.imagem.extensaoPorTipo[tipoMime];
  if (!ext) throw new Error("tipo de imagem não permitido");
  if (!UUID_EXATO.test(donoId.toLowerCase())) throw new Error("identificador inválido");
  if (!UUID_EXATO.test(idUnico.toLowerCase())) throw new Error("identificador de imagem inválido");
  return `${pasta}/${donoId.toLowerCase()}/${idUnico.toLowerCase()}.${ext}`;
}

/** O caminho tem o formato certo e está na pasta deste perfil/item? Impede usar imagem de outro. */
export function caminhoDaPasta(pasta: PastaImagem, donoId: string, caminho: string): boolean {
  const m = CAMINHO.exec(caminho);
  return !!m && m[1] === pasta && m[2] === donoId.toLowerCase();
}

/** Só o formato (sem conferir a pasta): valida a entrada antes de saber a quem pertence. */
export function formatoDeCaminhoValido(caminho: string, pasta?: PastaImagem): boolean {
  const m = CAMINHO.exec(caminho);
  return !!m && (pasta === undefined || m[1] === pasta);
}
