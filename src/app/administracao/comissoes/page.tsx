import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PARAMETRO_AVISO_ANTECEDENCIA, type Pagina, type Resultado } from "@/modules/comissoes";
import { AVISO_SEM_AUTOMATICO } from "../../_componentes/comissoes";
import {
  ABAS_ADMIN,
  AbasAdmin,
  CartaoAssinaturaAdmin,
  CartaoComissaoAdmin,
  CartaoNegocioAdmin,
  CartaoPagamentoAdmin,
  CartaoVinculoAdmin,
  FiltrosAdmin,
  PaginacaoAdmin,
  AntecedenciaAtual,
  PrazoAtual,
  ResumoLista,
  type AbaAdmin,
} from "../../_componentes/comissoes-admin";
import { FormComissoes } from "../../_componentes/form-comissoes";
import { PainelPagina } from "../../_componentes/painel";
import { Aviso } from "../../_componentes/ui";
import {
  exigirAdministradorComissoes,
  obterContextoComissoes,
  type ContextoComissoes,
} from "../../_lib/contexto-comissoes";
import { SEM_INDEXACAO, um } from "../../_lib/pagina";

export const metadata: Metadata = {
  title: "Comissões (administração) | IndicaMais",
  ...SEM_INDEXACAO,
};
export const dynamic = "force-dynamic";

function Acao({
  id,
  titulo,
  descricao,
  children,
}: {
  id: string;
  titulo: string;
  descricao: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="cartao">
      <h2 id={id}>{titulo}</h2>
      <p className="ajuda">{descricao}</p>
      <details>
        <summary className="botao-texto">Abrir formulário</summary>
        {children}
      </details>
    </section>
  );
}

type Busca = Record<string, string | string[] | undefined>;

const OPCOES = {
  negocios: [
    { valor: "habilitado", rotulo: "Módulo ativo" },
    { valor: "nao_habilitado", rotulo: "Módulo desligado" },
  ],
  assinaturas: [
    { valor: "ativa", rotulo: "Ativas" },
    { valor: "encerrada", rotulo: "Encerradas" },
    { valor: "cancelada", rotulo: "Canceladas" },
  ],
  pagamentos: [
    { valor: "confirmado", rotulo: "Confirmados" },
    { valor: "estornado", rotulo: "Estornados" },
  ],
  comissoes: [
    { valor: "gerada", rotulo: "Geradas" },
    { valor: "pendente_repasse", rotulo: "Pendentes de repasse" },
    { valor: "paga", rotulo: "Pagas" },
  ],
  vinculos: [
    { valor: "ativo", rotulo: "Ativos" },
    { valor: "encerrado", rotulo: "Encerrados" },
  ],
} as const;

const ROTULO_FILTRO: Record<AbaAdmin, string> = {
  negocios: "Estado do módulo",
  assinaturas: "Situação",
  pagamentos: "Estado",
  comissoes: "Estado",
  vinculos: "Situação",
};

const VAZIO: Record<AbaAdmin, string> = {
  negocios: "Nenhum negócio para esses filtros.",
  assinaturas: "Nenhuma assinatura registrada para esses filtros.",
  pagamentos: "Nenhum pagamento registrado para esses filtros.",
  comissoes: "Nenhuma comissão para esses filtros.",
  vinculos: "Nenhum vínculo para esses filtros.",
};

type Pronto =
  { ok: false; mensagem: string } | { ok: true; pagina: Pagina<unknown>; cartoes: ReactNode[] };

function desenhar<T>(r: Resultado<Pagina<T>>, cartao: (item: T) => ReactNode): Pronto {
  if (!r.ok) return { ok: false, mensagem: r.erro.mensagem };
  return { ok: true, pagina: r.valor, cartoes: r.valor.itens.map(cartao) };
}

/** Lista da seção escolhida. Filtros e página vêm do endereço e são validados pelo módulo (nada confia no navegador). */
async function Lista({ ctx, aba, sp }: { ctx: ContextoComissoes; aba: AbaAdmin; sp: Busca }) {
  const estado = um(sp.estado);
  const busca = um(sp.busca);
  const negocio = um(sp.negocio);
  const pagina = um(sp.pagina);
  const s = ctx.servico;
  const base = { ...(negocio ? { perfilId: negocio } : {}), ...(pagina ? { pagina } : {}) };
  const comEstado = { ...base, ...(estado ? { estado } : {}) };
  const comSituacao = { ...base, ...(estado ? { situacao: estado } : {}) };

  let pronto: Pronto;
  if (aba === "negocios") {
    pronto = desenhar(
      await s.adminNegocios({
        ...(estado ? { estado } : {}),
        ...(busca ? { busca } : {}),
        ...(pagina ? { pagina } : {}),
      }),
      (n) => <CartaoNegocioAdmin key={n.negocioId} n={n} />,
    );
  } else if (aba === "assinaturas") {
    pronto = desenhar(await s.adminAssinaturas(comSituacao), (a) => (
      <CartaoAssinaturaAdmin key={a.id} a={a} />
    ));
  } else if (aba === "pagamentos") {
    pronto = desenhar(await s.adminPagamentos(comEstado), (p) => (
      <CartaoPagamentoAdmin key={p.id} p={p} />
    ));
  } else if (aba === "comissoes") {
    pronto = desenhar(await s.adminComissoes(comEstado), (c) => (
      <CartaoComissaoAdmin key={c.id} c={c} />
    ));
  } else {
    pronto = desenhar(await s.adminVinculos(comSituacao), (v) => (
      <CartaoVinculoAdmin key={v.id} v={v} />
    ));
  }

  return (
    <>
      <FiltrosAdmin
        aba={aba}
        valores={{ estado, busca, negocio }}
        opcoesEstado={OPCOES[aba]}
        rotuloEstado={ROTULO_FILTRO[aba]}
        comBusca={aba === "negocios"}
      />
      {!pronto.ok ? (
        <Aviso tipo="erro">{pronto.mensagem}</Aviso>
      ) : (
        <>
          <ResumoLista pagina={pronto.pagina} vazio={VAZIO[aba]} />
          <ul className="lista-cartoes">{pronto.cartoes}</ul>
          {pronto.pagina.total > pronto.pagina.limite ? (
            <PaginacaoAdmin
              pagina={{
                numero: Math.floor(pronto.pagina.deslocamento / pronto.pagina.limite) + 1,
                limite: pronto.pagina.limite,
                total: pronto.pagina.total,
              }}
              params={{ aba, estado, busca, negocio }}
            />
          ) : null}
        </>
      )}
    </>
  );
}

async function Vencidos({ ctx }: { ctx: ContextoComissoes }) {
  const vencidos = await ctx.servico.listarVinculosVencidos();
  return (
    <section aria-labelledby="titulo-vencidos">
      <h2 id="titulo-vencidos">Vínculos com prazo vencido</h2>
      <p className="ajuda">
        São vínculos cujo indicador ficou em atraso além do prazo de inadimplência. Nada é encerrado
        sozinho: você decide, um a um, no botão do vínculo na lista abaixo. Ao encerrar, o cliente
        não passa para outro indicador e o vínculo não volta sozinho se o indicador regularizar.
      </p>
      {!vencidos.ok ? (
        <Aviso tipo="erro">{vencidos.erro.mensagem}</Aviso>
      ) : vencidos.valor.length === 0 ? (
        <p className="ajuda">Nenhum vínculo vencido no momento.</p>
      ) : (
        <Aviso tipo="atencao">
          {vencidos.valor.length === 1
            ? "Há 1 vínculo com prazo vencido."
            : `Há ${vencidos.valor.length} vínculos com prazo vencido.`}{" "}
          Procure o selo &ldquo;Prazo vencido&rdquo; na lista.
        </Aviso>
      )}
    </section>
  );
}

/**
 * IM-061 a IM-073: área do administrador geral para o módulo de comissões. Tudo é manual: habilitar o módulo por
 * negócio, registrar vínculo e assinatura, confirmar cada mensalidade, estornar, reverter, avançar o repasse e
 * encerrar vínculos vencidos. As listas são paginadas e filtradas, e cada linha tem os próprios botões (nada de
 * identificador digitado). Toda ação pede motivo (auditoria) e ações sem volta pedem confirmação. A plataforma não
 * cobra nem repassa dinheiro (IM-070, IM-090). Contas aparecem só como identificador curto, sem nome, telefone ou
 * e-mail (IM-029, IM-041, IM-050). Quem não é administrador recebe o 404 padrão.
 */
export default async function PaginaComissoesAdmin({
  searchParams,
}: PageProps<"/administracao/comissoes">) {
  const ctx = await obterContextoComissoes("/administracao/comissoes");
  await exigirAdministradorComissoes(ctx);
  const sp = await searchParams;
  const pedida = um(sp.aba);
  const aba: AbaAdmin = ABAS_ADMIN.find((a) => a.chave === pedida)?.chave ?? "negocios";
  const negocio = um(sp.negocio);
  const prazo = await ctx.servico.adminPrazoInadimplencia();
  const antecedencia = await ctx.servico.adminParametro(PARAMETRO_AVISO_ANTECEDENCIA);
  return (
    <PainelPagina
      titulo="Comissões"
      subtitulo="Registro e confirmação manual de assinaturas, pagamentos e repasses."
      admin
      atual="administracao"
    >
      <Aviso tipo="info">{AVISO_SEM_AUTOMATICO}</Aviso>

      {prazo.ok ? (
        <PrazoAtual prazo={prazo.valor} />
      ) : (
        <Aviso tipo="erro">{prazo.erro.mensagem}</Aviso>
      )}
      <Acao
        id="titulo-prazo"
        titulo="Alterar o prazo de inadimplência"
        descricao="Dias de atraso do indicador antes de o vínculo poder ser encerrado. Só o administrador muda; a mudança fica na auditoria."
      >
        <FormComissoes chave="parametro" rotuloBotao="Salvar prazo" rotuloEnviando="Salvando..." />
      </Acao>

      {antecedencia.ok ? (
        <AntecedenciaAtual parametro={antecedencia.valor} />
      ) : (
        <Aviso tipo="erro">{antecedencia.erro.mensagem}</Aviso>
      )}
      <Acao
        id="titulo-antecedencia"
        titulo="Alterar a antecedência do aviso de encerramento"
        descricao="Quantos dias antes do prazo de encerramento o indicador e o anunciante são avisados. A mudança fica na auditoria."
      >
        <FormComissoes
          chave="antecedenciaAviso"
          rotuloBotao="Salvar antecedência"
          rotuloEnviando="Salvando..."
          textoConfirmacao="Confirmo que quero mudar a antecedência dos avisos de encerramento."
        />
      </Acao>

      <AbasAdmin atual={aba} />

      {aba === "vinculos" ? <Vencidos ctx={ctx} /> : null}

      <Lista ctx={ctx} aba={aba} sp={sp} />

      {aba === "assinaturas" ? (
        <Acao
          id="titulo-assinatura"
          titulo="Registrar assinatura"
          descricao="Registra a assinatura mensal que o cliente combinou com o negócio. A plataforma não cobra: você só anota."
        >
          <FormComissoes
            chave="assinatura"
            rotuloBotao="Registrar assinatura"
            rotuloEnviando="Salvando..."
          />
        </Acao>
      ) : null}

      {aba === "vinculos" ? (
        <Acao
          id="titulo-vinculo"
          titulo="Registrar vínculo indicador e cliente"
          descricao="Liga a conta de quem indicou à conta do cliente, dentro de um negócio. Sem níveis: só clientes diretos."
        >
          <FormComissoes
            chave="vinculo"
            {...(negocio ? { iniciais: { perfilId: negocio } } : {})}
            rotuloBotao="Registrar vínculo"
            rotuloEnviando="Salvando..."
          />
        </Acao>
      ) : null}
    </PainelPagina>
  );
}
