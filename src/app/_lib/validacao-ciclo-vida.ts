import type { z } from "zod";
import {
  contaMotivoSchema,
  decidirDenunciaSchema,
  denunciarSchema,
  invalidarIndicacaoSchema,
  permissaoContaSchema,
} from "@/modules/administracao";
import { solicitarEncerramentoSchema } from "@/modules/contas";
import { errosPorCampo } from "@/shared/conteudo/zod-util";

/**
 * Validação no navegador com os MESMOS schemas do servidor (administracao e contas). Devolve null se válido, ou
 * { campo: mensagem } só dos campos visíveis. Ids ocultos são conferidos no servidor.
 */
const UUID = "00000000-0000-4000-8000-000000000000";
type Dados = Record<string, string>;

function validar(
  schema: z.ZodType,
  entrada: unknown,
  visiveis: readonly string[],
): Record<string, string> | null {
  const r = schema.safeParse(entrada);
  if (r.success) return null;
  const erros = Object.fromEntries(
    Object.entries(errosPorCampo(r.error)).filter(([k]) => visiveis.includes(k)),
  );
  return Object.keys(erros).length > 0 ? erros : null;
}

export const validarDenuncia = (d: Dados) =>
  validar(
    denunciarSchema,
    { alvoTipo: "perfil", alvoId: UUID, tipo: d.tipo ?? "", texto: d.texto?.trim() || undefined },
    ["tipo", "texto"],
  );
export const validarDecisaoDenuncia = (d: Dados) =>
  validar(
    decidirDenunciaSchema,
    { denunciaId: UUID, decisao: d.decisao ?? "", motivo: d.motivo ?? "" },
    ["motivo"],
  );
export const validarPermissao = (d: Dados) =>
  validar(
    permissaoContaSchema,
    { contaId: d.contaId ?? UUID, permissao: d.permissao ?? "", motivo: d.motivo ?? "" },
    ["contaId", "permissao", "motivo"],
  );
export const validarContaMotivo = (d: Dados) =>
  validar(contaMotivoSchema, { contaId: d.contaId ?? UUID, motivo: d.motivo ?? "" }, [
    "contaId",
    "motivo",
  ]);
export const validarInvalidacao = (d: Dados) =>
  validar(invalidarIndicacaoSchema, { pedidoId: d.pedidoId ?? UUID, motivo: d.motivo ?? "" }, [
    "pedidoId",
    "motivo",
  ]);
export const validarEncerramento = (d: Dados) =>
  validar(solicitarEncerramentoSchema, { confirmacao: d.confirmacao ?? "" }, ["confirmacao"]);
