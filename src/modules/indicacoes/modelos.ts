import type { Database } from "@/shared/db/database.types";

/** Tipos de leitura. Linhas = colunas das visões; modelos = o que a aplicação entrega (sem ids de conta). */

type Visoes = Database["public"]["Views"];
export type LinhaMeuPedido = Visoes["indicacoes_meus_pedidos"]["Row"];
export type LinhaMinhaIndicacao = Visoes["indicacoes_minhas_indicacoes"]["Row"];
export type LinhaMeuLink = Visoes["indicacoes_meus_links"]["Row"];
export type LinhaFilaContato = Visoes["administracao_fila_contatos"]["Row"];
export type LinhaParametro = Database["public"]["Tables"]["indicacoes_parametro"]["Row"];

/** Colunas SEGURAS da fila administrativa para o descarte (IM-103): nada do visitante (nome, WhatsApp, e-mail, mensagem). */
export type LinhaNotificacaoDescartavel = Pick<
  LinhaFilaContato,
  "id" | "criado_em" | "notificacao_estado" | "tentativas" | "destino_nome"
>;

export type NotificacaoDescartavel = {
  /** Id do pedido de contato (identificador interno, não é dado pessoal). */
  id: string;
  criadoEm: string;
  estado: "pendente" | "falhou";
  tentativas: number;
  destinoNome: string;
};

export type PaginaNotificacoesDescartaveis = {
  itens: NotificacaoDescartavel[];
  total: number;
  pagina: number;
  porPagina: number;
};

export type TipoDestino = "perfil" | "item";
export type EstadoNotificacao = "pendente" | "enviada" | "falhou" | "descartada";
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

export type LinhaAlarme =
  Database["public"]["Functions"]["indicacoes_admin_listar_alarmes"]["Returns"][number];

/** Alarme de excesso de pedidos numa hora. Sem dado pessoal: só tipo, alvo (id interno) e contagens (S-03). */
export type AlarmeContato = {
  id: number;
  tipo: "link" | "destino" | "global";
  janela: string;
  alvoId: string | null;
  /** 0 = 1 x o limite, 1 = 2 x, 2 = 4 x. */
  nivel: number;
  quantidade: number;
  limite: number;
  criadoEm: string;
};

export type PaginaAlarmes = {
  itens: AlarmeContato[];
  total: number;
  pagina: number;
  porPagina: number;
};

export function paraAlarme(l: LinhaAlarme): AlarmeContato | null {
  if (l.o_tipo !== "link" && l.o_tipo !== "destino" && l.o_tipo !== "global") return null;
  return {
    id: l.o_id,
    tipo: l.o_tipo,
    janela: l.o_janela,
    alvoId: l.o_alvo_id,
    nivel: l.o_nivel,
    quantidade: l.o_quantidade,
    limite: l.o_limite,
    criadoEm: l.o_criado_em,
  };
}

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

/** Só copia os campos permitidos, um a um (nunca espalha a linha da fila). Estado fora de pendente/falhou é descartado. */
export function paraNotificacaoDescartavel(
  l: LinhaNotificacaoDescartavel,
): NotificacaoDescartavel | null {
  const estado = l.notificacao_estado;
  if (!l.id || !l.criado_em || (estado !== "pendente" && estado !== "falhou")) return null;
  return {
    id: l.id,
    criadoEm: l.criado_em,
    estado,
    tentativas: l.tentativas ?? 0,
    destinoNome: l.destino_nome ?? "",
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
