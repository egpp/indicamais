import type { Database } from "@/shared/db/database.types";

/** Tipos de leitura. Linhas = colunas das visões; modelos = o que a aplicação entrega (sem ids de conta). */

type Visoes = Database["public"]["Views"];
export type LinhaMeuPedido = Visoes["indicacoes_meus_pedidos"]["Row"];
export type LinhaMinhaIndicacao = Visoes["indicacoes_minhas_indicacoes"]["Row"];
export type LinhaMeuLink = Visoes["indicacoes_meus_links"]["Row"];
export type LinhaFilaContato = Visoes["administracao_fila_contatos"]["Row"];
export type LinhaParametro = Database["public"]["Tables"]["indicacoes_parametro"]["Row"];

export type TipoDestino = "perfil" | "item";
export type EstadoNotificacao = "pendente" | "enviada" | "falhou";
export type EstadoAlerta = "nenhum" | "aberto" | "tratado";

const tipoDestino = (v: string | null): TipoDestino | null =>
  v === "perfil" || v === "item" ? v : null;

/** Pedido visto pelo RESPONSÁVEL do destino (IM-027): inclui dados do visitante. */
export type PedidoContato = {
  id: string;
  destinoTipo: TipoDestino;
  destinoId: string;
  destinoNome: string;
  visitanteNome: string;
  visitanteWhatsapp: string;
  visitanteEmail: string | null;
  mensagem: string | null;
  criadoEm: string;
  veioPorIndicacao: boolean;
  notificacaoEstado: string;
};

/**
 * Indicação vista pelo INDICADOR (IM-029): destino, data e status. Este tipo NÃO tem, e não pode ganhar,
 * campos do visitante (nome, WhatsApp, e-mail, mensagem). Teste de chaves exatas em modelos.test.ts.
 */
export type MinhaIndicacao = {
  id: string;
  destinoTipo: TipoDestino;
  destinoId: string;
  destinoNome: string;
  criadoEm: string;
  status: string;
};

export type MeuLink = {
  id: string;
  codigo: string;
  destinoTipo: TipoDestino;
  destinoId: string;
  destinoNome: string;
  disponivel: boolean;
  criadoEm: string;
};

export type ContatoAdmin = PedidoContato & {
  autoindicacaoSuspeita: boolean;
  tentativas: number;
  ultimaTentativaEm: string | null;
  ultimoErro: string | null;
  reenvioSolicitadoEm: string | null;
  alertaEstado: string;
};

export type Parametro = {
  chave: string;
  valor: number;
  minimo: number;
  maximo: number;
  descricao: string;
  atualizadoEm: string;
};

export function paraPedidoContato(l: LinhaMeuPedido): PedidoContato | null {
  const tipo = tipoDestino(l.destino_tipo);
  if (!tipo || !l.id || !l.destino_id || !l.nome || !l.whatsapp_e164 || !l.criado_em) return null;
  return {
    id: l.id,
    destinoTipo: tipo,
    destinoId: l.destino_id,
    destinoNome: l.destino_nome ?? "",
    visitanteNome: l.nome,
    visitanteWhatsapp: l.whatsapp_e164,
    visitanteEmail: l.email,
    mensagem: l.mensagem,
    criadoEm: l.criado_em,
    veioPorIndicacao: l.veio_por_indicacao ?? false,
    notificacaoEstado: l.notificacao_estado ?? "pendente",
  };
}

/** Só copia os campos permitidos ao indicador, um a um (nunca espalha a linha). */
export function paraMinhaIndicacao(l: LinhaMinhaIndicacao): MinhaIndicacao | null {
  const tipo = tipoDestino(l.destino_tipo);
  if (!tipo || !l.id || !l.destino_id || !l.criado_em) return null;
  return {
    id: l.id,
    destinoTipo: tipo,
    destinoId: l.destino_id,
    destinoNome: l.destino_nome ?? "",
    criadoEm: l.criado_em,
    status: l.status ?? "recebido",
  };
}

export function paraMeuLink(l: LinhaMeuLink): MeuLink | null {
  const tipo = tipoDestino(l.destino_tipo);
  if (!tipo || !l.id || !l.codigo || !l.destino_id || !l.criado_em) return null;
  return {
    id: l.id,
    codigo: l.codigo,
    destinoTipo: tipo,
    destinoId: l.destino_id,
    destinoNome: l.destino_nome ?? "",
    disponivel: l.disponivel ?? false,
    criadoEm: l.criado_em,
  };
}

export function paraContatoAdmin(l: LinhaFilaContato): ContatoAdmin | null {
  const base = paraPedidoContato({
    id: l.id,
    destino_tipo: l.destino_tipo,
    destino_id: l.destino_id,
    destino_nome: l.destino_nome,
    nome: l.nome,
    whatsapp_e164: l.whatsapp_e164,
    email: l.email,
    mensagem: l.mensagem,
    criado_em: l.criado_em,
    veio_por_indicacao: l.veio_por_indicacao,
    notificacao_estado: l.notificacao_estado,
  });
  if (!base) return null;
  return {
    ...base,
    autoindicacaoSuspeita: l.autoindicacao_suspeita ?? false,
    tentativas: l.tentativas ?? 0,
    ultimaTentativaEm: l.ultima_tentativa_em,
    ultimoErro: l.ultimo_erro,
    reenvioSolicitadoEm: l.reenvio_solicitado_em,
    alertaEstado: l.alerta_estado ?? "nenhum",
  };
}

export function paraParametro(l: LinhaParametro): Parametro {
  return {
    chave: l.chave,
    valor: l.valor,
    minimo: l.minimo,
    maximo: l.maximo,
    descricao: l.descricao,
    atualizadoEm: l.atualizado_em,
  };
}

const maisRecenteDepois = (a: { criadoEm: string }, b: { criadoEm: string }) =>
  b.criadoEm.localeCompare(a.criadoEm);

export const ordenarPorMaisRecente = <T extends { criadoEm: string }>(xs: T[]): T[] =>
  [...xs].sort(maisRecenteDepois);
