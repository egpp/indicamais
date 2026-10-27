import { criarClienteNavegador } from "@/shared/supabase/navegador";
import { BUCKET_IMAGENS } from "./imagens-servidor";

/** Envio de uma imagem ao Storage: `true` se gravou. Nunca devolve texto do Storage. */
export type EnviarImagem = (caminho: string, arquivo: Blob, tipo: string) => Promise<boolean>;

/**
 * Envio DIRETO do navegador ao Storage com a sessão do usuário (as políticas do bucket decidem se a pasta é
 * dele). O perfil ou item precisa existir antes; o caminho é opaco (sem id da conta, IM-029).
 */
export const enviarImagemAoStorage: EnviarImagem = async (caminho, arquivo, tipo) => {
  try {
    const { error } = await criarClienteNavegador()
      .storage.from(BUCKET_IMAGENS)
      .upload(caminho, arquivo, { contentType: tipo, upsert: false });
    return !error;
  } catch {
    return false;
  }
};
