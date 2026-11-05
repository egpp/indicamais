import { z } from "zod";
import { semControle, uuidSchema } from "@/shared/conteudo/zod-util";

/**
 * Filtros e paginação das leituras do administrador (IM-061 a IM-073). A página é numerada a partir de 1 e o
 * deslocamento enviado ao banco é derivado (nunca digitado). O banco limita a página a 1..100. Valor fora da lista é
 * recusado em vez de ignorado. Campos vazios (formulário GET) valem como ausentes.
 */
export const LIMITE_PADRAO = 20;
export const LIMITE_MAX = 100;
export const PAGINA_MAX = 10_000;
export const BUSCA_MAX = 80;

const vazioAusente = (v: unknown) => (v === "" || v === null ? undefined : v);
const opcional = <T extends z.ZodType>(s: T) => z.preprocess(vazioAusente, s.optional());

const paginacao = {
  pagina: z.preprocess(
    vazioAusente,
    z.coerce
      .number({ error: "Página inválida." })
      .int({ error: "Página inválida." })
      .min(1, { error: "Página inválida." })
      .max(PAGINA_MAX, { error: "Página inválida." })
      .default(1),
  ),
  limite: z.preprocess(
    vazioAusente,
    z.coerce
      .number({ error: "Tamanho de página inválido." })
      .int({ error: "Tamanho de página inválido." })
      .min(1, { error: "Tamanho de página inválido." })
      .max(LIMITE_MAX, { error: "Tamanho de página inválido." })
      .default(LIMITE_PADRAO),
  ),
};

const perfilOpcional = opcional(uuidSchema);

export const filtroNegociosAdminSchema = z.object({
  estado: opcional(z.enum(["habilitado", "nao_habilitado"], { error: "Estado inválido." })),
  busca: opcional(
    z
      .string()
      .trim()
      .max(BUSCA_MAX, { error: `A busca pode ter no máximo ${BUSCA_MAX} caracteres.` })
      .refine(semControle, { error: "A busca tem caracteres inválidos." }),
  ),
  ...paginacao,
});

export const filtroAssinaturasAdminSchema = z.object({
  perfilId: perfilOpcional,
  situacao: opcional(z.enum(["ativa", "encerrada", "cancelada"], { error: "Situação inválida." })),
  ...paginacao,
});

export const filtroPagamentosAdminSchema = z.object({
  perfilId: perfilOpcional,
  estado: opcional(z.enum(["confirmado", "estornado"], { error: "Estado inválido." })),
  ...paginacao,
});

export const filtroComissoesAdminSchema = z.object({
  perfilId: perfilOpcional,
  estado: opcional(z.enum(["gerada", "pendente_repasse", "paga"], { error: "Estado inválido." })),
  ...paginacao,
});

export const filtroVinculosAdminSchema = z.object({
  perfilId: perfilOpcional,
  situacao: opcional(z.enum(["ativo", "encerrado"], { error: "Situação inválida." })),
  ...paginacao,
});
