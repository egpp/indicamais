import { z } from "zod";
import { normalizarWhatsappBR } from "@/modules/contas";
import { LIMITES } from "@/shared/config/limites";
import { formatoDeCaminhoValido } from "@/shared/conteudo/imagens";
import { textoOpcional, uuidSchema } from "@/shared/conteudo/zod-util";
import { UFS, ufSchema } from "@/shared/conteudo/ufs";
import { normalizarSite, pareceLinkOuRede } from "./texto-livre";

/** Entradas do módulo perfis (IM-011, IM-012, IM-016). Campos desconhecidos são descartados. */

export { UFS, ufSchema };

const L = LIMITES.perfil;
const vazioParaNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

const caminhoImagem = z
  .string({ error: "Imagem inválida." })
  .refine((c) => formatoDeCaminhoValido(c, "perfil"), { error: "Imagem inválida." });

const listaImagens = (max: number, msgMax: string) =>
  z
    .array(caminhoImagem, { error: "Imagens inválidas." })
    .max(max, { error: msgMax })
    .refine((a) => new Set(a).size === a.length, { error: "Não repita a mesma imagem." })
    .optional();


export const siteSchema = z.preprocess(
  vazioParaNull,
  z
    .string({ error: "Informe um endereço de site válido." })
    .transform((v, ctx) => {
      const r = normalizarSite(v, L.siteMax);
      if (!r.ok) {
        ctx.addIssue({ code: "custom", message: r.mensagem });
        return z.NEVER;
      }
      return r.site;
    })
    .nullable(),
);

export const informacoesSociaisSchema = z.preprocess(
  vazioParaNull,
  z
    .string({ error: "Texto inválido." })
    .max(L.informacoesSociaisMax, {
      error: `Use até ${L.informacoesSociaisMax} caracteres.`,
    })
    .refine((s) => !pareceLinkOuRede(s), {
      error: "Informe apenas texto: sem links, endereços de site nem @ de redes sociais.",
    })
    .nullable(),
);

/** WhatsApp comercial: entrada livre brasileira -> E.164 (contas.normalizarWhatsappBR). */
export const whatsappComercialSchema = z.preprocess(
  vazioParaNull,
  z
    .string({ error: "Informe o WhatsApp comercial." })
    .transform((v, ctx) => {
      const r = normalizarWhatsappBR(v);
      if (!r.ok) {
        ctx.addIssue({ code: "custom", message: r.mensagem });
        return z.NEVER;
      }
      return r.e164;
    })
    .nullable(),
);

const areasSchema = z
  .array(
    z
      .string({ error: "Área inválida." })
      .trim()
      .min(1, { error: "Área vazia." })
      .max(L.areaMax, { error: `Cada área deve ter até ${L.areaMax} caracteres.` }),
    { error: "Áreas inválidas." },
  )
  .max(L.areasMax, { error: `Informe até ${L.areasMax} áreas atendidas.` })
  .transform((a) => {
    const vistos = new Set<string>();
    return a.filter((x) => {
      const k = x.toLowerCase();
      if (vistos.has(k)) return false;
      vistos.add(k);
      return true;
    });
  })
  .refine((a) => a.join(",").length <= L.areasTotalMax, {
    error: "A lista de áreas atendidas está muito longa.",
  })
  .optional();

/** Campos editáveis do perfil (patch): undefined = não mexe; null = limpa. */
export const camposPerfilSchema = z.object({
  nome: textoOpcional(L.nomeMax, `O nome deve ter até ${L.nomeMax} caracteres.`),
  descricaoBreve: textoOpcional(
    L.descricaoBreveMax,
    `A descrição breve deve ter até ${L.descricaoBreveMax} caracteres.`,
  ),
  imagemPath: z.preprocess(vazioParaNull, caminhoImagem.nullable()).optional(),
  categoriaPrincipalId: uuidSchema.nullable().optional(),
  categoriasSecundariasIds: z
    .array(uuidSchema, { error: "Categorias inválidas." })
    .max(LIMITES.categorias.secundariasMax, {
      error: `Escolha no máximo ${LIMITES.categorias.secundariasMax} categorias secundárias.`,
    })
    .optional(),
  cidade: textoOpcional(L.cidadeMax, `A cidade deve ter até ${L.cidadeMax} caracteres.`),
  uf: ufSchema.optional(),
  whatsappComercial: whatsappComercialSchema.optional(),
  // IM-012: conteúdo opcional
  endereco: textoOpcional(L.enderecoMax, `O endereço deve ter até ${L.enderecoMax} caracteres.`),
  areasAtendidas: areasSchema,
  bannersPaths: listaImagens(L.bannersMax, `Use até ${L.bannersMax} banners.`),
  fotosPaths: listaImagens(L.fotosMax, `Use até ${L.fotosMax} fotos.`),
  site: siteSchema.optional(),
  informacoesSociais: informacoesSociaisSchema.optional(),
});
export type CamposPerfil = z.infer<typeof camposPerfilSchema>;

/**
 * Novo perfil: `slug` opcional (gerado do nome); sem ele o `nome` é obrigatório. O WhatsApp comercial é
 * obrigatório já no primeiro rascunho. Sem imagens: o perfil precisa existir antes do upload (as imagens
 * entram depois, em `editar`).
 */
export const novoPerfilSchema = camposPerfilSchema
  .omit({ imagemPath: true, bannersPaths: true, fotosPaths: true })
  .extend({ slug: z.string({ error: "Endereço inválido." }).trim().optional() })
  .superRefine((d, ctx) => {
    if (!d.slug && !d.nome) {
      ctx.addIssue({ code: "custom", path: ["nome"], message: "Informe o nome do perfil." });
    }
    if (!d.whatsappComercial) {
      ctx.addIssue({
        code: "custom",
        path: ["whatsappComercial"],
        message: "Informe o WhatsApp comercial.",
      });
    }
  });
export type NovoPerfil = z.infer<typeof novoPerfilSchema>;
