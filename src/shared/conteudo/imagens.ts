import { LIMITES, type TipoImagem } from "../config/limites";

/** Regras de imagem (D-006, IM-011, IM-012, IM-014). Funções puras; o Storage reforça no servidor. */

export type ResultadoImagem = { ok: true } | { ok: false; mensagem: string };

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
/** <conta_id>/<arquivo>, igual à política do bucket. */
const CAMINHO = new RegExp(`^(${UUID})/([A-Za-z0-9._-]{1,100})$`);

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

/** Caminho no bucket: sempre dentro da pasta da conta. `idUnico` vem de fora (uuid). */
export function gerarCaminhoImagem(contaId: string, tipoMime: TipoImagem, idUnico: string): string {
  const ext = LIMITES.imagem.extensaoPorTipo[tipoMime];
  if (!ext) throw new Error("tipo de imagem não permitido");
  const caminho = `${contaId.toLowerCase()}/${idUnico}.${ext}`;
  if (!caminhoDaConta(contaId, caminho)) throw new Error("caminho de imagem inválido");
  return caminho;
}

/** O caminho tem o formato certo e está na pasta desta conta? Impede usar imagem de outra conta. */
export function caminhoDaConta(contaId: string, caminho: string): boolean {
  const m = CAMINHO.exec(caminho);
  if (!m) return false;
  if (m[1] !== contaId.toLowerCase()) return false;
  // Sem nomes começando por ponto (".", "..", ".env").
  return !m[2]!.startsWith(".");
}

export function formatoDeCaminhoValido(caminho: string): boolean {
  const m = CAMINHO.exec(caminho);
  return !!m && !m[2]!.startsWith(".");
}
