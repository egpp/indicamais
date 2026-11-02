import type { TipoImagem } from "@/shared/config/limites";
import { gerarCaminhoImagem, validarImagem } from "@/shared/conteudo/imagens";
import { comprimirImagem } from "./comprimir-imagem";
import { enviarImagemAoStorage, type EnviarImagem } from "./upload-imagem";

/**
 * Envio da imagem de um banner (D-016; IM-093) ao Storage, ANTES de gravar o caminho no banco. O responsável usa
 * `perfil/<perfilId>/<uuid>.<ext>`; o administrador usa `perfil/<perfilId>/adm-<uuid>.<ext>` (a política do
 * Storage só deixa o aprovador gravar nesse formato na pasta de outra conta). Valida tipo e tamanho (2 MiB) como
 * as demais imagens e devolve só o caminho; nunca texto do Storage.
 */
export type ResultadoEnvioBanner =
  { ok: true; caminho: string; url: string | null } | { ok: false; mensagem: string };

export const MSG_FALHA_ENVIO_BANNER = "Não foi possível enviar a imagem. Tente novamente.";

export function caminhoDeBanner(
  perfilId: string,
  tipo: TipoImagem,
  admin: boolean,
  idUnico: string = crypto.randomUUID(),
): string {
  const base = gerarCaminhoImagem("perfil", perfilId, tipo, idUnico);
  return admin
    ? base.replace(`/${idUnico.toLowerCase()}.`, `/adm-${idUnico.toLowerCase()}.`)
    : base;
}

export async function enviarImagemDeBanner(
  arquivo: File,
  opcoes: {
    perfilId: string;
    admin?: boolean;
    enviar?: EnviarImagem;
    comprimir?: (a: Blob) => Promise<Blob>;
  },
): Promise<ResultadoEnvioBanner> {
  const {
    perfilId,
    admin = false,
    enviar = enviarImagemAoStorage,
    comprimir = comprimirImagem,
  } = opcoes;
  const tipoOk = validarImagem({ tipoMime: arquivo.type, tamanhoBytes: 1 });
  if (!tipoOk.ok) return { ok: false, mensagem: tipoOk.mensagem };
  const pronto = await comprimir(arquivo);
  const final = validarImagem({ tipoMime: pronto.type, tamanhoBytes: pronto.size });
  if (!final.ok) return { ok: false, mensagem: final.mensagem };
  let caminho: string;
  try {
    caminho = caminhoDeBanner(perfilId, pronto.type as TipoImagem, admin);
  } catch {
    return { ok: false, mensagem: MSG_FALHA_ENVIO_BANNER };
  }
  if (!(await enviar(caminho, pronto, pronto.type))) {
    return { ok: false, mensagem: MSG_FALHA_ENVIO_BANNER };
  }
  const url = typeof URL.createObjectURL === "function" ? URL.createObjectURL(pronto) : null;
  return { ok: true, caminho, url };
}
