import { createHash, randomUUID } from "node:crypto";
import type {
  ClienteBancoIndicacoes,
  LinhaFilaContato,
  LinhaMeuLink,
  LinhaMeuPedido,
  LinhaMinhaIndicacao,
  LinhaParametro,
} from "@/modules/indicacoes";
import { criarContextoIndicacoes, type ContextoIndicacoes } from "@/app/_lib/contexto-indicacoes";
import type { LeituraPublica } from "@/app/_lib/leitura-publica";

/**
 * Banco em memória do módulo indicacoes para os testes da interface. Só o banco é falso: serviço e tratadores
 * rodam de verdade. Imita as regras do banco que a tela precisa ver (idempotência pela chave, autoindicação,
 * WhatsApp obrigatório, login). As linhas internas guardam DADOS PRIVADOS de propósito: se alguma tela do
 * indicador os repassar, os testes de privacidade pegam.
 */

export const WHATSAPP_RESPONSAVEL = "+5551988887777";
export const VISITANTE = { nome: "Carla Visitante", whatsapp: "(11) 98765-4321" } as const;
export const URL_BASE = "https://app.exemplo";

const erro = (code: string) => ({ dados: null, erro: { code } });
const ok = <T>(dados: T) => ({ dados, erro: null });
const md5 = (t: string) => createHash("md5").update(t).digest("hex");

export type PedidoMem = {
  id: string;
  chave: string;
  perfilId: string | null;
  itemId: string | null;
  nome: string;
  whatsapp: string;
  email: string | null;
  mensagem: string | null;
  codigo: string | null;
  criadoEm: string;
  notificacao: string;
  alerta: string;
  suspeita: boolean;
  tentativas: number;
  ultimoErro: string | null;
  indicadorId: string | null;
};

export type Usuario = { id: string; comWhatsapp?: boolean; admin?: boolean };

export function criarMundoIndicacoes(
  opcoes: {
    usuario?: Usuario | null;
    /** destinoId -> conta dona (autoindicação). */
    donos?: Record<string, string>;
    indisponiveis?: string[];
    leitura?: LeituraPublica;
  } = {},
) {
  const usuario = opcoes.usuario === undefined ? null : opcoes.usuario;
  const donos = opcoes.donos ?? {};
  const indisponiveis = new Set(opcoes.indisponiveis ?? []);
  const pedidos: PedidoMem[] = [];
  const compartilhamentos: { codigo: string; canal: string }[] = [];
  const chamadasContato: Parameters<ClienteBancoIndicacoes["enviarContato"]>[0][] = [];
  const reenvios: { pedidoId: string; motivo: string | null }[] = [];
  const alertasTratados: { pedidoId: string; motivo: string }[] = [];
  const parametros: LinhaParametro[] = [
    {
      chave: "contato_limite_por_hora",
      valor: 5,
      minimo: 1,
      maximo: 50,
      descricao: "Pedidos por hora por WhatsApp de visitante.",
      atualizado_em: "2026-10-30T12:00:00Z",
    },
  ];
  const definicoes: { chave: string; valor: number; motivo: string }[] = [];
  /** Linhas das visões do indicador, com campos privados extras que a tela jamais pode mostrar. */
  let minhasIndicacoes: LinhaMinhaIndicacao[] = [];
  let meusLinks: LinhaMeuLink[] = [];
  let meusPedidos: LinhaMeuPedido[] = [];
  let fila: LinhaFilaContato[] = [];

  const destino = (perfilId: string | null, itemId: string | null) => perfilId ?? itemId ?? "";

  const banco: ClienteBancoIndicacoes = {
    gerarLink: async (a) => {
      if (!usuario) return erro("42501");
      const d = destino(a.perfilId, a.itemId);
      if (indisponiveis.has(d)) return erro("P0002");
      if (!usuario.comWhatsapp) return erro("P0412");
      if (donos[d] === usuario.id) return erro("P0403");
      return ok([{ o_codigo: md5(`${usuario.id}:${d}`), o_novo: true }]);
    },
    registrarCompartilhamento: async (a) => {
      if (!usuario) return { erro: { code: "42501" } };
      compartilhamentos.push(a);
      return { erro: null };
    },
    enviarContato: async (a) => {
      chamadasContato.push(a);
      if (indisponiveis.has(destino(a.perfilId, a.itemId))) return erro("P0002");
      const existente = pedidos.find((p) => p.chave === a.chave);
      if (existente) {
        return ok([
          {
            o_pedido_id: existente.id,
            o_whatsapp_responsavel: WHATSAPP_RESPONSAVEL,
            o_repetido: true,
          },
        ]);
      }
      const p: PedidoMem = {
        id: randomUUID(),
        chave: a.chave,
        perfilId: a.perfilId,
        itemId: a.itemId,
        nome: a.nome,
        whatsapp: a.whatsapp,
        email: a.email,
        mensagem: a.mensagem,
        codigo: a.codigo,
        criadoEm: "2026-10-30T15:00:00Z",
        notificacao: "pendente",
        alerta: "nenhum",
        suspeita: false,
        tentativas: 0,
        ultimoErro: null,
        indicadorId: null,
      };
      pedidos.push(p);
      return ok([
        { o_pedido_id: p.id, o_whatsapp_responsavel: WHATSAPP_RESPONSAVEL, o_repetido: false },
      ]);
    },
    listarMeusPedidos: async () => ok(meusPedidos),
    listarMinhasIndicacoes: async () => ok(minhasIndicacoes),
    listarMeusLinks: async () => ok(meusLinks),
    listarFilaContatos: async () => ok(usuario?.admin ? fila : []),
    solicitarReenvio: async (a) => {
      reenvios.push(a);
      return { erro: null };
    },
    tratarAlerta: async (a) => {
      alertasTratados.push(a);
      return { erro: null };
    },
    listarParametros: async () => ok(usuario?.admin ? parametros : []),
    definirParametro: async (a) => {
      definicoes.push(a);
      return { erro: null };
    },
  };

  return {
    banco,
    pedidos,
    compartilhamentos,
    chamadasContato,
    reenvios,
    alertasTratados,
    definicoes,
    parametros,
    definirMeusPedidos: (x: LinhaMeuPedido[]) => (meusPedidos = x),
    definirMinhasIndicacoes: (x: LinhaMinhaIndicacao[]) => (minhasIndicacoes = x),
    definirMeusLinks: (x: LinhaMeuLink[]) => (meusLinks = x),
    definirFila: (x: LinhaFilaContato[]) => (fila = x),
    contexto(leitura: LeituraPublica): ContextoIndicacoes {
      return criarContextoIndicacoes({
        banco,
        leitura,
        logado: usuario !== null,
        urlBase: URL_BASE,
        ehAdministrador: async () => usuario?.admin === true,
      });
    },
  };
}

export const linhaPedido = (o: Partial<LinhaMeuPedido> = {}): LinhaMeuPedido => ({
  id: randomUUID(),
  destino_tipo: "perfil",
  destino_id: randomUUID(),
  destino_nome: "Padaria da Ana",
  nome: VISITANTE.nome,
  whatsapp_e164: "+5511987654321",
  email: "carla@exemplo.com",
  mensagem: "Quero encomendar um bolo.",
  criado_em: "2026-10-30T15:30:00Z",
  veio_por_indicacao: false,
  notificacao_estado: "pendente",
  ...o,
});

export const linhaFila = (o: Partial<LinhaFilaContato> = {}): LinhaFilaContato => ({
  ...linhaPedido(),
  autoindicacao_suspeita: false,
  tentativas: 0,
  ultima_tentativa_em: null,
  ultimo_erro: null,
  reenvio_solicitado_em: null,
  alerta_estado: "nenhum",
  ...o,
});
