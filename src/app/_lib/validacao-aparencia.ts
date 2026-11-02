import type { ZodError } from "zod";
import {
  adicionarBannerAdminSchema,
  definirEstiloHabilitadoSchema,
  removerBannerAdminSchema,
  responderBannerSchema,
} from "@/modules/perfis";
import { errosPorCampo } from "@/shared/conteudo/zod-util";

/**
 * Validação no navegador com os MESMOS schemas do servidor (módulo perfis). Devolve null se válido, ou
 * { campo: mensagem } com os nomes dos campos do formulário.
 */
type Dados = Record<string, string>;
type Erros = Record<string, string> | null;

const UUID_VAZIO = "00000000-0000-4000-8000-000000000000";

function resultado(r: { success: true } | { success: false; error: ZodError }): Erros {
  return r.success ? null : errosPorCampo(r.error);
}

export const validarRecusaBanner = (d: Dados): Erros =>
  resultado(
    responderBannerSchema.safeParse({
      bannerId: d.bannerId || UUID_VAZIO,
      aceitar: false,
      motivo: d.motivo ?? "",
    }),
  );

export const validarHabilitarEstilo = (d: Dados): Erros =>
  resultado(
    definirEstiloHabilitadoSchema.safeParse({
      estilo: d.estilo ?? "",
      habilitado: d.habilitado === "sim",
      motivo: d.motivo ?? "",
    }),
  );

export const validarRemoverBannerAdmin = (d: Dados): Erros =>
  resultado(
    removerBannerAdminSchema.safeParse({
      bannerId: d.bannerId || UUID_VAZIO,
      motivo: d.motivo ?? "",
    }),
  );

/** Nomes do schema do módulo -> nomes dos campos do formulário. */
const CAMPO_ADMIN: Record<string, string> = {
  imagemPath: "imagemPath",
  textoAlternativo: "textoAlternativo",
  motivo: "motivo",
  destinoSecao: "destinoSecao",
};

export const validarAdicionarBannerAdmin = (d: Dados): Erros => {
  const r = resultado(
    adicionarBannerAdminSchema.safeParse({
      perfilId: d.perfilId || UUID_VAZIO,
      imagemPath: d.imagemPath ?? "",
      textoAlternativo: d.textoAlternativo ?? "",
      motivo: d.motivo ?? "",
      destinoSecao: d.destinoSecao ? d.destinoSecao : null,
    }),
  );
  if (!r) return null;
  const saida: Record<string, string> = {};
  for (const [k, v] of Object.entries(r)) saida[CAMPO_ADMIN[k] ?? k] = v;
  if (saida.imagemPath) saida.imagemPath = "Escolha a imagem do banner.";
  return saida;
};
