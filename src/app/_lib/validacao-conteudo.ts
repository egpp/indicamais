import type { ZodError } from "zod";
import {
  alterarCategoriaSchema,
  camposItemSchema,
  criarCategoriaSchema,
  decidirSolicitacaoSchema,
  novoItemSchema,
  solicitarCategoriaSchema,
} from "@/modules/catalogo";
import { camposPerfilSchema, novoPerfilSchema } from "@/modules/perfis";
import { decidirRevisaoSchema } from "@/modules/administracao";
import { validarCategorias } from "@/shared/conteudo/categorias";
import { errosPorCampo as errosDoZod } from "@/shared/conteudo/zod-util";
import {
  MENSAGEM_ESCOLHA_PERFIL,
  lerCamposItem,
  lerCamposPerfil,
  lerDeRegistro,
  type Ler,
  lerNovoItem,
  lerNovoPerfil,
  perfilObrigatorioFaltando,
} from "./entrada-conteudo";
import { normalizarErros } from "./resposta";

/**
 * Validação no navegador com os MESMOS schemas do servidor (módulos perfis, catalogo, administracao).
 * Devolve null se válido, ou { campo: mensagem }.
 */
type Dados = Record<string, string>;
type Erros = Record<string, string> | null;

function resultado(r: { success: true } | { success: false; error: ZodError }): Erros {
  return r.success ? null : normalizarErros(errosDoZod(r.error));
}

const comoRegistro = (erros: Record<string, string>): Erros =>
  Object.keys(erros).length > 0 ? erros : null;

/** Regra de combinação das categorias (principal + até 2 secundárias, sem repetir): a mesma do servidor. */
function complementarCategorias(erros: Record<string, string>, ler: Ler) {
  const { categoriaPrincipalId, categoriasSecundariasIds } = lerCamposPerfil(ler);
  const msg = validarCategorias({
    principalId: categoriaPrincipalId,
    secundariasIds: categoriasSecundariasIds,
  });
  if (msg && !erros.categoriasSecundariasIds) erros.categoriasSecundariasIds = msg;
}

/** O WhatsApp comercial é obrigatório em toda versão (IM-011); o servidor confere de novo. */
function complementarWhatsapp(erros: Record<string, string>, ler: Ler) {
  if (!erros.whatsappComercial && ler("whatsappComercial").trim() === "") {
    erros.whatsappComercial = "Informe o WhatsApp comercial.";
  }
}

export const validarNovoPerfil = (d: Dados): Erros => {
  const ler = lerDeRegistro(d);
  const erros = resultado(novoPerfilSchema.safeParse(lerNovoPerfil(ler))) ?? {};
  complementarWhatsapp(erros, ler);
  complementarCategorias(erros, ler);
  return comoRegistro(erros);
};

export const validarEdicaoPerfil = (d: Dados): Erros => {
  const ler = lerDeRegistro(d);
  const erros = resultado(camposPerfilSchema.safeParse(lerCamposPerfil(ler))) ?? {};
  complementarWhatsapp(erros, ler);
  complementarCategorias(erros, ler);
  return comoRegistro(erros);
};

export const validarNovoItem = (d: Dados): Erros => {
  const ler = lerDeRegistro(d);
  const erros = resultado(novoItemSchema.safeParse(lerNovoItem(ler))) ?? {};
  if (perfilObrigatorioFaltando(ler)) erros.perfilId = MENSAGEM_ESCOLHA_PERFIL;
  complementarCategorias(erros, ler);
  return comoRegistro(erros);
};

export const validarEdicaoItem = (d: Dados): Erros => {
  const ler = lerDeRegistro(d);
  const erros = resultado(camposItemSchema.safeParse(lerCamposItem(ler))) ?? {};
  complementarCategorias(erros, ler);
  return comoRegistro(erros);
};

export const validarSolicitacaoCategoria = (d: Dados): Erros =>
  resultado(
    solicitarCategoriaSchema.safeParse({
      nome: d.nome ?? "",
      justificativa: d.justificativa ?? "",
    }),
  );

export const validarDecisaoRevisao = (d: Dados): Erros =>
  resultado(
    decidirRevisaoSchema.safeParse({
      aprovar: d.decisao === "aprovar",
      alvo: d.alvo ?? "",
      versaoId: d.versaoId ?? "",
      motivo: d.motivo ?? "",
    }),
  );

export const validarDecisaoSolicitacao = (d: Dados): Erros => {
  const atender = d.decisao === "atender";
  if (atender && (d.categoriaId ?? "").trim() === "") {
    return { categoriaId: "Escolha a categoria criada para atender este pedido." };
  }
  return resultado(
    decidirSolicitacaoSchema.safeParse(
      atender
        ? { atendida: true, id: d.id ?? "", categoriaId: d.categoriaId, motivo: d.motivo ?? "" }
        : { atendida: false, id: d.id ?? "", motivo: d.motivo ?? "" },
    ),
  );
};

export const validarCriacaoCategoria = (d: Dados): Erros => {
  const ordem = (d.ordem ?? "").trim();
  return resultado(
    criarCategoriaSchema.safeParse({
      nome: d.nome ?? "",
      ordem: ordem === "" ? undefined : Number(ordem),
    }),
  );
};

export const validarAlteracaoCategoria = (d: Dados): Erros =>
  resultado(
    alterarCategoriaSchema.safeParse({
      id: d.id ?? "",
      nome: d.nome ?? "",
      ativa: d.ativa === "sim",
      ordem: Number(d.ordem ?? "0"),
      motivo: d.motivo ?? "",
    }),
  );
