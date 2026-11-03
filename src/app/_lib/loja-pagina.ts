import { parsearReaisParaCentavos, type CartaoLoja, type ServicoLoja } from "@/modules/catalogo";
import { obterContextoPublico } from "./contexto-publico";
import { obterServicoLojaPublica } from "./contexto-loja";

/**
 * Carregamento da Loja nas páginas públicas (IM-097, IM-098, D-020). Só monta dados para exibir: quem decide se a
 * Loja está liberada, o que está no ar e como filtrar é o módulo catalogo (sessão anônima). Falha na leitura nunca
 * derruba a página: volta `null` e a página usa o catálogo simples de hoje.
 */

export type Consulta = Record<string, string | string[] | undefined>;

/** Filtros como o visitante digitou (texto), para repopular o formulário. */
export type FiltrosLojaTela = {
  finalidade: string;
  imovelTipo: string;
  quartos: string;
  precoMax: string;
};

const primeiro = (v: string | string[] | undefined) =>
  Array.isArray(v) ? (v[0] ?? "") : (v ?? "");

export function lerFiltrosLoja(consulta: Consulta): FiltrosLojaTela {
  return {
    finalidade: primeiro(consulta.finalidade).trim(),
    imovelTipo: primeiro(consulta.imovelTipo).trim(),
    quartos: primeiro(consulta.quartos).trim(),
    precoMax: primeiro(consulta.precoMax).trim(),
  };
}

export const filtrosAtivos = (f: FiltrosLojaTela) =>
  Boolean(f.finalidade || f.imovelTipo || f.quartos || f.precoMax);

export const MSG_PRECO_MAX = "Informe o preço máximo em reais. Exemplo: 350.000,00.";

/** Filtros digitados -> entrada do serviço (preço em centavos). `erroPreco` quando o texto do preço não é legível. */
export function filtrosParaServico(
  f: FiltrosLojaTela,
  perfilId: string,
): { entrada: Record<string, unknown>; erroPreco: string | null } {
  let erroPreco: string | null = null;
  let precoMaxCentavos: number | undefined;
  if (f.precoMax) {
    const c = parsearReaisParaCentavos(f.precoMax);
    if (c === null) erroPreco = MSG_PRECO_MAX;
    else precoMaxCentavos = c;
  }
  return {
    entrada: {
      perfilId,
      finalidade: f.finalidade,
      tipo: f.imovelTipo,
      quartosMin: f.quartos,
      ...(precoMaxCentavos !== undefined ? { precoMaxCentavos } : {}),
      limite: 50,
    },
    erroPreco,
  };
}

export type LojaDoPerfil = {
  itens: CartaoLoja[];
  urls: Record<string, string>;
  /** Há imóveis no perfil: mostra os filtros. */
  temImoveis: boolean;
  filtros: FiltrosLojaTela;
  filtroAtivo: boolean;
  /** Preço máximo digitado que não dá para ler (vai junto do campo). */
  erroPreco: string | null;
  /** Falha ao filtrar (mensagem neutra do módulo); a página continua. */
  erro: string | null;
};

type Deps = {
  servico: ServicoLoja;
  assinar: (caminhos: string[]) => Promise<Record<string, string>>;
};

/**
 * `null` = a Loja não está liberada, falhou ou veio vazia: a página usa o catálogo simples. Com filtro ativo, só os
 * imóveis que casam (listarImoveis); sem filtro, todos os itens da Loja do perfil (listarItensDoPerfil).
 */
export async function carregarLojaDoPerfil(
  perfilId: string,
  consulta: Consulta,
  dados?: Deps,
): Promise<LojaDoPerfil | null> {
  try {
    // Montado aqui dentro: qualquer falha (inclusive de configuração) cai no catálogo simples.
    const deps: Deps = dados ?? {
      servico: obterServicoLojaPublica(),
      assinar: (c) => obterContextoPublico().assinarImagens(c),
    };
    if (!(await deps.servico.lojaLiberada(perfilId))) return null;
    const todos = await deps.servico.listarItensDoPerfil(perfilId);
    if (!todos.ok || todos.valor.length === 0) return null;
    const temImoveis = todos.valor.some((i) => i.tipo === "imovel");
    const filtros = lerFiltrosLoja(consulta);
    const filtroAtivo = temImoveis && filtrosAtivos(filtros);

    let itens = todos.valor;
    let erro: string | null = null;
    let erroPreco: string | null = null;
    if (filtroAtivo) {
      const montado = filtrosParaServico(filtros, perfilId);
      erroPreco = montado.erroPreco;
      const r = await deps.servico.listarImoveis(montado.entrada);
      if (r.ok) itens = r.valor.itens;
      else {
        itens = [];
        erro = r.erro.mensagem;
      }
    }
    const caminhos = itens.flatMap((i) => (i.fotoPath ? [i.fotoPath] : []));
    const urls = await deps.assinar(caminhos);
    return { itens, urls, temImoveis, filtros, filtroAtivo, erroPreco, erro };
  } catch {
    return null;
  }
}
