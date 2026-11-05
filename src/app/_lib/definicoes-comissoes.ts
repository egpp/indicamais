import type { ZodType } from "zod";
import {
  alterarPercentualSchema,
  avancarRepasseSchema,
  cancelarAssinaturaSchema,
  confirmarPagamentoSchema,
  criarOfertaSchema,
  definirHabilitacaoSchema,
  definirOfertaAtivaSchema,
  definirParametroSchema,
  encerrarVinculoSchema,
  estornarPagamentoSchema,
  registrarAssinaturaSchema,
  registrarVinculoSchema,
  reverterComissaoSchema,
} from "@/modules/comissoes";
import { errosPorCampo } from "@/shared/conteudo/zod-util";
import { lerCompetencia, lerPercentualBp, lerReais } from "./dinheiro-comissoes";
import type { Ler } from "./entrada-conteudo";

/**
 * Definição dos formulários de comissões (Fase 7): como ler cada campo digitado, qual schema do módulo valida (o MESMO
 * no navegador e no servidor) e quais campos aparecem. Nenhuma regra de negócio: só leitura de texto e mensagens.
 * IM-028 (sem duplicar envio), IM-064, IM-068, IM-070, IM-073.
 */

export type TipoCampo =
  "texto" | "reais" | "percentual" | "data" | "competencia" | "inteiro" | "select" | "motivo";

export type CampoSpec = {
  nome: string;
  rotulo: string;
  tipo: TipoCampo;
  opcoes?: readonly { valor: string; rotulo: string }[];
  ajuda?: string;
  opcional?: boolean;
};

export type DefinicaoComissoes = {
  campos: readonly CampoSpec[];
  schema: ZodType;
  ler: (ler: Ler) => Record<string, unknown>;
  sucesso: string;
  /** Ação sem volta (registros só de inserção): exige marcar a confirmação antes de enviar. */
  confirmar?: boolean;
  /** Mensagem do campo quando o banco recusa os dados sem apontar o campo (22023). */
  recusaDoBanco?: { campo: string; mensagem: string };
};

const MOTIVO: CampoSpec = {
  nome: "motivo",
  rotulo: "Motivo (fica na auditoria)",
  tipo: "motivo",
  ajuda: "Pelo menos 10 caracteres. Explique o que foi conferido e por que a ação é necessária.",
};
const uuid = (nome: string, rotulo: string, ajuda?: string): CampoSpec => ({
  nome,
  rotulo,
  tipo: "texto",
  ...(ajuda ? { ajuda } : {}),
});

const inteiro = (s: string): number => (s.trim() === "" ? Number.NaN : Number(s.trim()));
const vazioParaNulo = (s: string) => (s.trim() === "" ? null : s.trim());
const marcado = (s: string) => s === "on" || s === "sim";

export const DEFINICOES_COMISSOES = {
  parametro: {
    campos: [
      {
        nome: "valor",
        rotulo: "Prazo de inadimplência (dias)",
        tipo: "inteiro",
        ajuda: "Padrão: 60 dias. O banco aceita de 1 a 365.",
      },
      MOTIVO,
    ],
    schema: definirParametroSchema,
    ler: (l) => ({
      chave: "prazo_inadimplencia_dias",
      valor: inteiro(l("valor")),
      motivo: l("motivo"),
    }),
    sucesso: "Prazo de inadimplência atualizado.",
    recusaDoBanco: {
      campo: "valor",
      mensagem: "Informe um prazo entre 1 e 365 dias.",
    },
  },
  habilitacao: {
    campos: [
      uuid("perfilId", "Identificador do negócio (perfil)"),
      {
        nome: "ativa",
        rotulo: "Ação",
        tipo: "select",
        opcoes: [
          { valor: "sim", rotulo: "Habilitar o módulo de comissões" },
          { valor: "nao", rotulo: "Desabilitar o módulo de comissões" },
        ],
        ajuda: "Desabilitar preserva saldos e histórico; só bloqueia comissões novas.",
      },
      {
        nome: "origem",
        rotulo: "Origem do pedido",
        tipo: "select",
        opcoes: [
          { valor: "espontanea", rotulo: "Espontânea (iniciativa da plataforma)" },
          { valor: "solicitacao", rotulo: "Solicitação do negócio" },
        ],
      },
      MOTIVO,
    ],
    schema: definirHabilitacaoSchema,
    ler: (l) => ({
      perfilId: l("perfilId").trim(),
      ativa: l("ativa") === "sim" ? true : l("ativa") === "nao" ? false : undefined,
      origem: l("origem"),
      motivo: l("motivo"),
    }),
    sucesso: "Habilitação do módulo registrada.",
  },
  vinculo: {
    campos: [
      uuid("perfilId", "Identificador do negócio (perfil)"),
      uuid(
        "indicadorId",
        "Identificador da conta do indicador",
        "Conta da plataforma de quem indicou.",
      ),
      uuid(
        "clienteId",
        "Identificador da conta do cliente",
        "O cliente precisa ter conta. Cada cliente tem um único indicador por negócio.",
      ),
      MOTIVO,
    ],
    schema: registrarVinculoSchema,
    ler: (l) => ({
      perfilId: l("perfilId").trim(),
      indicadorId: l("indicadorId").trim(),
      clienteId: l("clienteId").trim(),
      motivo: l("motivo"),
    }),
    sucesso: "Vínculo registrado.",
    confirmar: true,
  },
  assinatura: {
    campos: [
      uuid("ofertaId", "Identificador da oferta recorrente"),
      uuid("clienteId", "Identificador da conta do cliente"),
      {
        nome: "valorCentavos",
        rotulo: "Valor da mensalidade (R$)",
        tipo: "reais",
        ajuda: "Exemplo: 99,90",
      },
      { nome: "inicio", rotulo: "Início da assinatura", tipo: "data" },
      {
        nome: "fim",
        rotulo: "Fim da assinatura",
        tipo: "data",
        opcional: true,
        ajuda: "Deixe em branco se não há data de fim.",
      },
      MOTIVO,
    ],
    schema: registrarAssinaturaSchema,
    ler: (l) => ({
      ofertaId: l("ofertaId").trim(),
      clienteId: l("clienteId").trim(),
      valorCentavos: lerReais(l("valorCentavos")),
      inicio: l("inicio"),
      fim: vazioParaNulo(l("fim")),
      motivo: l("motivo"),
    }),
    sucesso: "Assinatura registrada. Nenhuma cobrança é feita pela plataforma.",
    confirmar: true,
  },
  cancelarAssinatura: {
    campos: [uuid("assinaturaId", "Identificador da assinatura"), MOTIVO],
    schema: cancelarAssinaturaSchema,
    ler: (l) => ({ assinaturaId: l("assinaturaId").trim(), motivo: l("motivo") }),
    sucesso: "Assinatura cancelada. Comissões já geradas não são alteradas.",
    confirmar: true,
  },
  pagamento: {
    campos: [
      uuid("assinaturaId", "Identificador da assinatura"),
      {
        nome: "competencia",
        rotulo: "Mês da mensalidade",
        tipo: "competencia",
        ajuda: "Formato AAAA-MM ou MM/AAAA. Exemplo: 2026-11",
      },
      {
        nome: "valorCentavos",
        rotulo: "Valor recebido (R$)",
        tipo: "reais",
        ajuda:
          "Se o valor for diferente do combinado, explique a diferença no motivo (mínimo de 10 caracteres).",
      },
      MOTIVO,
    ],
    schema: confirmarPagamentoSchema,
    ler: (l) => ({
      assinaturaId: l("assinaturaId").trim(),
      competencia: lerCompetencia(l("competencia")),
      valorCentavos: lerReais(l("valorCentavos")),
      motivo: l("motivo"),
    }),
    sucesso: "Pagamento confirmado. A comissão, se devida, foi registrada.",
    confirmar: true,
  },
  estorno: {
    campos: [uuid("pagamentoId", "Identificador do pagamento"), MOTIVO],
    schema: estornarPagamentoSchema,
    ler: (l) => ({
      pagamentoId: l("pagamentoId").trim(),
      motivo: l("motivo"),
      confirmarJaPaga: marcado(l("confirmarJaPaga")),
    }),
    sucesso: "Pagamento estornado. A comissão gerada foi revertida por um lançamento novo.",
    confirmar: true,
  },
  reversao: {
    campos: [
      uuid("comissaoId", "Identificador da comissão"),
      {
        nome: "causa",
        rotulo: "Causa da reversão",
        tipo: "select",
        opcoes: [
          { valor: "cancelamento", rotulo: "Cancelamento" },
          { valor: "estorno", rotulo: "Estorno" },
          { valor: "correcao", rotulo: "Correção" },
        ],
      },
      MOTIVO,
    ],
    schema: reverterComissaoSchema,
    ler: (l) => ({
      comissaoId: l("comissaoId").trim(),
      causa: l("causa"),
      motivo: l("motivo"),
      confirmarJaPaga: marcado(l("confirmarJaPaga")),
    }),
    sucesso: "Comissão revertida por um lançamento novo. O histórico foi preservado.",
    confirmar: true,
  },
  repasse: {
    campos: [
      uuid("comissaoId", "Identificador da comissão"),
      {
        nome: "estado",
        rotulo: "Novo estado do repasse",
        tipo: "select",
        opcoes: [
          { valor: "pendente_repasse", rotulo: "Pendente de repasse" },
          { valor: "paga", rotulo: "Paga (repasse feito fora da plataforma)" },
        ],
        ajuda: "A plataforma não transfere dinheiro: você só registra o que já foi feito.",
      },
      MOTIVO,
    ],
    schema: avancarRepasseSchema,
    ler: (l) => ({
      comissaoId: l("comissaoId").trim(),
      estado: l("estado"),
      motivo: l("motivo"),
    }),
    sucesso: "Estado do repasse atualizado.",
    confirmar: true,
  },
  encerrarVinculo: {
    campos: [uuid("vinculoId", "Identificador do vínculo"), MOTIVO],
    schema: encerrarVinculoSchema,
    ler: (l) => ({ vinculoId: l("vinculoId").trim(), motivo: l("motivo") }),
    sucesso: "Vínculo encerrado. O cliente não é transferido a outro indicador.",
    confirmar: true,
  },
  oferta: {
    campos: [
      { nome: "itemId", rotulo: "Item do catálogo", tipo: "select" },
      {
        nome: "nome",
        rotulo: "Nome da oferta",
        tipo: "texto",
        ajuda: "Exemplo: Plano mensal básico",
      },
      {
        nome: "percentualBp",
        rotulo: "Comissão (%)",
        tipo: "percentual",
        ajuda: "Percentual sobre cada mensalidade confirmada. Exemplo: 10 ou 7,5",
      },
    ],
    schema: criarOfertaSchema,
    ler: (l) => ({
      perfilId: l("perfilId").trim(),
      itemId: l("itemId").trim(),
      nome: l("nome"),
      percentualBp: lerPercentualBp(l("percentualBp")),
    }),
    sucesso: "Oferta recorrente criada.",
  },
  percentual: {
    campos: [
      {
        nome: "percentualBp",
        rotulo: "Novo percentual (%)",
        tipo: "percentual",
        ajuda: "Vale só para pagamentos confirmados depois. Nada já gerado é recalculado.",
      },
    ],
    schema: alterarPercentualSchema,
    ler: (l) => ({
      ofertaId: l("ofertaId").trim(),
      percentualBp: lerPercentualBp(l("percentualBp")),
    }),
    sucesso: "Percentual atualizado para os próximos pagamentos.",
  },
  ofertaAtiva: {
    campos: [],
    schema: definirOfertaAtivaSchema,
    ler: (l) => ({
      ofertaId: l("ofertaId").trim(),
      ativa: l("ativa") === "sim" ? true : l("ativa") === "nao" ? false : undefined,
    }),
    sucesso: "Situação da oferta atualizada.",
  },
} as const satisfies Record<string, DefinicaoComissoes>;

export type ChaveComissoes = keyof typeof DEFINICOES_COMISSOES;

export const MENSAGEM_PERCENTUAL = "Informe um percentual entre 0,01% e 100%. Exemplo: 10 ou 7,5.";
export const MENSAGEM_REAIS = "Informe o valor em reais. Exemplo: 99,90.";
export const MENSAGEM_PRAZO = "Informe um número inteiro de dias.";
export const MENSAGEM_CONFIRMAR = "Marque a confirmação para continuar.";

/**
 * Erros por campo (null se válido). Mesma função no navegador e no servidor. Texto ilegível em campos de valor ou
 * percentual recebe mensagem em reais/%, nunca em centavos ou pontos-base. A confirmação das ações sem volta também
 * é conferida aqui.
 */
export function errosDoFormulario(chave: ChaveComissoes, ler: Ler): Record<string, string> | null {
  const def: DefinicaoComissoes = DEFINICOES_COMISSOES[chave];
  const entrada = def.ler(ler);
  const saida: Record<string, string> = {};
  const r = def.schema.safeParse(entrada);
  const doSchema = r.success ? {} : errosPorCampo(r.error);
  for (const c of def.campos) {
    const lido = entrada[c.nome];
    const ilegivel = typeof lido === "number" && Number.isNaN(lido);
    if (c.tipo === "percentual" && (c.nome in doSchema || ilegivel)) {
      saida[c.nome] = MENSAGEM_PERCENTUAL;
    } else if (c.tipo === "reais" && ilegivel) {
      saida[c.nome] = MENSAGEM_REAIS;
    } else if (c.tipo === "inteiro" && ilegivel) {
      saida[c.nome] = MENSAGEM_PRAZO;
    } else if (c.nome in doSchema) {
      saida[c.nome] = doSchema[c.nome] as string;
    }
  }
  if (def.confirmar && !marcado(ler("confirmo"))) saida.confirmo = MENSAGEM_CONFIRMAR;
  return Object.keys(saida).length > 0 ? saida : null;
}

/** Campos de formulário que o servidor mostra junto de cada campo (o resto vira aviso geral). */
export function camposVisiveis(chave: ChaveComissoes): readonly string[] {
  const def: DefinicaoComissoes = DEFINICOES_COMISSOES[chave];
  return [...def.campos.map((c) => c.nome), "confirmo"];
}
