import { z } from "zod";
import { pareceLinkOuRede } from "@/modules/perfis";
import { LIMITES } from "@/shared/config/limites";
import { caminhoDaPasta } from "@/shared/conteudo/imagens";
import { semControle, uuidSchema } from "@/shared/conteudo/zod-util";

/**
 * Entradas de patrocinador (IM-020, D-008). Campos desconhecidos são descartados, então NÃO há como enviar
 * preço, plano, cobrança nem URL externa: esses campos não existem aqui nem na tabela.
 */

const P = LIMITES.patrocinador;
/** Ausente, null ou vazio = sem valor (null). */
const vazioParaNull = (v: unknown) =>
  v === undefined || (typeof v === "string" && v.trim() === "") ? null : v;

const titulo = z
  .string({ error: `O título deve ter de ${P.tituloMin} a ${P.tituloMax} caracteres.` })
  .trim()
  .min(P.tituloMin, { error: `O título deve ter de ${P.tituloMin} a ${P.tituloMax} caracteres.` })
  .max(P.tituloMax, { error: `O título deve ter de ${P.tituloMin} a ${P.tituloMax} caracteres.` })
  .refine(semControle, { error: "O título tem caracteres inválidos." });

/** Texto de destino: só texto, sem link, domínio, www nem @usuario (mesma regra do IM-012). */
const textoDestino = z.preprocess(
  (v) => (typeof v === "string" ? (v.trim() === "" ? null : v.trim()) : (v ?? null)),
  z
    .string({ error: "Texto de destino inválido." })
    .max(P.textoDestinoMax, { error: `O texto deve ter até ${P.textoDestinoMax} caracteres.` })
    .refine(semControle, { error: "O texto tem caracteres inválidos." })
    .refine((t) => !pareceLinkOuRede(t), {
      error: "O texto não pode ter link, endereço de site nem @usuário.",
    })
    .nullable(),
);

const perfilDestinoId = z.preprocess(vazioParaNull, uuidSchema.nullable());

const ordem = z.preprocess(
  (v) => {
    const x = vazioParaNull(v);
    return typeof x === "string" && /^-?\d{1,9}$/.test(x.trim()) ? Number(x.trim()) : x;
  },
  z
    .number({ error: "Ordem inválida." })
    .int({ error: "Ordem inválida." })
    .min(-1000, { error: "Ordem inválida." })
    .max(100000, { error: "Ordem inválida." }),
);

/** Instante ISO 8601 com fuso (ex.: 2026-11-01T12:00:00Z ou -03:00); vazio = sem limite. Saída em UTC. */
const instante = z.preprocess(
  vazioParaNull,
  z.iso
    .datetime({ offset: true, error: "Data e hora inválidas." })
    .transform((s) => new Date(s).toISOString())
    .nullable(),
);

const motivoObrigatorio = z
  .string({ error: "Informe o motivo." })
  .trim()
  .min(1, { error: "Informe o motivo." })
  .max(LIMITES.revisao.motivoMax, {
    error: `O motivo deve ter até ${LIMITES.revisao.motivoMax} caracteres.`,
  });

const motivoOpcional = z.preprocess(
  (v) => (typeof v === "string" ? (v.trim() === "" ? undefined : v.trim()) : v),
  z
    .string({ error: "Motivo inválido." })
    .max(LIMITES.revisao.motivoMax, {
      error: `O motivo deve ter até ${LIMITES.revisao.motivoMax} caracteres.`,
    })
    .optional(),
);

type Comum = {
  id: string;
  imagemPath: string;
  perfilDestinoId: string | null;
  textoDestino: string | null;
  inicioEm: string | null;
  fimEm: string | null;
};

/** Regras que cruzam campos: imagem na pasta do próprio patrocinador, exatamente um destino, fim > início. */
function validarCruzado(v: Comum, ctx: z.RefinementCtx): void {
  if (!caminhoDaPasta("patrocinador", v.id, v.imagemPath)) {
    ctx.addIssue({
      code: "custom",
      path: ["imagemPath"],
      message: "Imagem inválida. Envie novamente.",
    });
  }
  const temPerfil = v.perfilDestinoId !== null;
  const temTexto = v.textoDestino !== null;
  if (temPerfil === temTexto) {
    ctx.addIssue({
      code: "custom",
      path: [temPerfil ? "textoDestino" : "perfilDestinoId"],
      message: "Escolha um perfil OU escreva um texto de destino (apenas um dos dois).",
    });
  }
  if (v.inicioEm && v.fimEm && Date.parse(v.fimEm) <= Date.parse(v.inicioEm)) {
    ctx.addIssue({
      code: "custom",
      path: ["fimEm"],
      message: "O fim deve ser depois do início.",
    });
  }
}

const imagemPath = z.string({ error: "Envie a imagem do patrocinador." });

const conteudo = {
  id: uuidSchema,
  titulo,
  imagemPath,
  perfilDestinoId,
  textoDestino,
  ordem,
  inicioEm: instante,
  fimEm: instante,
};

/** `id` é gerado antes do upload da imagem (patrocinador/<id>/<uuid>.<ext>) e repassado como `p_id`. */
export const criarPatrocinadorSchema = z
  .object({
    ...conteudo,
    ordem: ordem.default(0),
    ativo: z.boolean({ error: "Informe se fica ativo." }).default(false),
    motivo: motivoOpcional,
  })
  .superRefine(validarCruzado);
export type CriarPatrocinador = z.infer<typeof criarPatrocinadorSchema>;

/** Substitui o conteúdo inteiro (como a função do banco). Motivo OBRIGATÓRIO. */
export const alterarPatrocinadorSchema = z
  .object({ ...conteudo, motivo: motivoObrigatorio })
  .superRefine(validarCruzado);
export type AlterarPatrocinador = z.infer<typeof alterarPatrocinadorSchema>;

export const definirPatrocinadorAtivoSchema = z.object({
  id: uuidSchema,
  ativo: z.boolean({ error: "Informe se fica ativo." }),
  motivo: motivoObrigatorio,
});
export type DefinirPatrocinadorAtivo = z.infer<typeof definirPatrocinadorAtivoSchema>;
