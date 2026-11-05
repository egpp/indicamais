import Link from "next/link";
import type {
  AssinaturaAdmin,
  ComissaoAdmin,
  NegocioAdmin,
  PagamentoAdmin,
  Pagina,
  PrazoInadimplencia,
  VinculoAdmin,
} from "@/modules/comissoes";
import { formatarDataCivil as civil, formatarDataHora } from "../_lib/apresentacao";
import { formatarPercentualBp, formatarReais, rotuloCompetencia } from "../_lib/dinheiro-comissoes";
import { ROTULO_CAUSA_REVERSAO, ROTULO_ESTADO_COMISSAO } from "./comissoes";
import { CopiarId } from "./copiar-id";
import { FormComissoes } from "./form-comissoes";
import { SeloEstado } from "./painel";
import type { ReactNode } from "react";

/**
 * Listas do administrador em Comissões (IM-061 a IM-073): cartões paginados com botões por linha no lugar de
 * identificadores digitados. Só apresentação: o que cada botão faz é decidido pelo banco. Contas aparecem apenas como
 * identificador curto (necessário para o administrador agir), nunca com nome, telefone ou e-mail (IM-029, IM-041,
 * IM-050). Nada cobra nem repassa dinheiro (IM-090).
 */

export const ABAS_ADMIN = [
  { chave: "negocios", rotulo: "Negócios" },
  { chave: "assinaturas", rotulo: "Assinaturas" },
  { chave: "pagamentos", rotulo: "Pagamentos" },
  { chave: "comissoes", rotulo: "Comissões" },
  { chave: "vinculos", rotulo: "Vínculos" },
] as const;
export type AbaAdmin = (typeof ABAS_ADMIN)[number]["chave"];

const BASE = "/administracao/comissoes";
const dia = (iso: string | null | undefined) => civil(iso?.slice(0, 10));
const refConta = (id: string) => `${id.slice(0, 8)}…`;
const paraCampoReais = (centavos: number) => formatarReais(centavos).replace(/^R\$\s/, "");

/** Endereço da tela com os filtros atuais (sem valores vazios). */
export function hrefAdmin(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "" && !(k === "pagina" && Number(v) <= 1)) q.set(k, String(v));
  }
  const s = q.toString();
  return `${BASE}${s ? `?${s}` : ""}`;
}

export function AbasAdmin({ atual }: { atual: AbaAdmin }) {
  return (
    <nav aria-label="Seções de comissões" className="abas-admin">
      {ABAS_ADMIN.map((a) => (
        <Link
          key={a.chave}
          href={hrefAdmin({ aba: a.chave })}
          aria-current={a.chave === atual ? "page" : undefined}
        >
          {a.rotulo}
        </Link>
      ))}
    </nav>
  );
}

export function PrazoAtual({ prazo }: { prazo: PrazoInadimplencia }) {
  return (
    <p className="cartao">
      Prazo de inadimplência atual: <strong>{prazo.prazoDias} dias</strong>
      <span className="ajuda">
        {" "}
        (faixa permitida: {prazo.minimo} a {prazo.maximo} dias
        {prazo.atualizadoEm ? `; alterado em ${dia(prazo.atualizadoEm)}` : ""}). Vale para a data
        prevista de encerramento mostrada em cada vínculo.
      </span>
    </p>
  );
}

type OpcaoFiltro = { valor: string; rotulo: string };

/** Filtros por GET (sem JavaScript): negócio (quando veio de um cartão), estado e, nos negócios, busca por nome. */
export function FiltrosAdmin({
  aba,
  valores,
  opcoesEstado,
  rotuloEstado,
  comBusca,
}: {
  aba: AbaAdmin;
  valores: {
    estado?: string | undefined;
    busca?: string | undefined;
    negocio?: string | undefined;
  };
  opcoesEstado: readonly OpcaoFiltro[];
  rotuloEstado: string;
  comBusca?: boolean;
}) {
  return (
    <form className="filtros-busca" method="get" action={BASE} aria-label="Filtrar a lista">
      <input type="hidden" name="aba" value={aba} />
      {valores.negocio ? <input type="hidden" name="negocio" value={valores.negocio} /> : null}
      {comBusca ? (
        <div className="campo campo-largo">
          <label htmlFor="f-busca">Buscar por nome ou endereço do negócio</label>
          <input
            id="f-busca"
            name="busca"
            type="search"
            defaultValue={valores.busca ?? ""}
            maxLength={80}
            autoComplete="off"
          />
        </div>
      ) : null}
      <div className="campo">
        <label htmlFor="f-estado">{rotuloEstado}</label>
        <select id="f-estado" name="estado" defaultValue={valores.estado ?? ""}>
          <option value="">Todos</option>
          {opcoesEstado.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.rotulo}
            </option>
          ))}
        </select>
      </div>
      <div className="acoes">
        <button type="submit" className="botao">
          Filtrar
        </button>
        <Link className="botao botao-secundario" href={hrefAdmin({ aba })}>
          Limpar
        </Link>
      </div>
      {valores.negocio ? (
        <p className="ajuda">
          Mostrando só um negócio ({refConta(valores.negocio)}).{" "}
          <Link href={hrefAdmin({ aba, estado: valores.estado })}>Ver todos os negócios</Link>
        </p>
      ) : null}
    </form>
  );
}

export function PaginacaoAdmin({
  pagina,
  params,
}: {
  pagina: { numero: number; limite: number; total: number };
  params: Record<string, string | undefined>;
}) {
  const ultima = Math.max(1, Math.ceil(pagina.total / pagina.limite));
  return (
    <nav className="paginacao" aria-label="Paginação">
      {pagina.numero > 1 ? (
        <Link
          className="botao botao-secundario"
          rel="prev"
          href={hrefAdmin({ ...params, pagina: pagina.numero - 1 })}
        >
          Página anterior
        </Link>
      ) : (
        <span />
      )}
      <span className="pagina-atual">
        Página {pagina.numero} de {ultima}
      </span>
      {pagina.numero < ultima ? (
        <Link
          className="botao botao-secundario"
          rel="next"
          href={hrefAdmin({ ...params, pagina: pagina.numero + 1 })}
        >
          Próxima página
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

export function ResumoLista({ pagina, vazio }: { pagina: Pagina<unknown>; vazio: string }) {
  if (pagina.total === 0) return <p className="ajuda">{vazio}</p>;
  const de = pagina.deslocamento + 1;
  const ate = pagina.deslocamento + pagina.itens.length;
  return (
    <p className="ajuda" role="status">
      Mostrando {de} a {ate} de {pagina.total}.
    </p>
  );
}

/** Ação de uma linha: o formulário só abre sob demanda, para a lista continuar curta no celular. */
function AcaoLinha({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <details>
      <summary className="botao-texto">{titulo}</summary>
      {children}
    </details>
  );
}

function LinksNegocio({ id }: { id: string }) {
  return (
    <p className="ajuda">
      Ver deste negócio:{" "}
      {ABAS_ADMIN.filter((a) => a.chave !== "negocios").map((a, i) => (
        <span key={a.chave}>
          {i > 0 ? " · " : ""}
          <Link href={hrefAdmin({ aba: a.chave, negocio: id })}>{a.rotulo.toLowerCase()}</Link>
        </span>
      ))}
    </p>
  );
}

export function CartaoNegocioAdmin({ n }: { n: NegocioAdmin }) {
  return (
    <li className="cartao">
      <h3>{n.nome ?? n.slug}</h3>
      <p>
        <SeloEstado rotulo={n.moduloAtivo ? "Módulo ativo" : "Módulo desligado"} />{" "}
        {n.publicado ? null : <SeloEstado rotulo="Perfil não publicado" />}
      </p>
      <p className="ajuda quebra-total">
        Endereço: {n.slug}
        {n.estadoDesde
          ? ` · ${n.moduloAtivo ? "habilitado" : "desabilitado"} em ${formatarDataHora(n.estadoDesde)}`
          : " · nunca foi habilitado"}
        {n.origem
          ? ` · origem: ${n.origem === "solicitacao" ? "solicitação do negócio" : "espontânea"}`
          : ""}
      </p>
      <LinksNegocio id={n.negocioId} />
      <AcaoLinha titulo={n.moduloAtivo ? "Desabilitar o módulo" : "Habilitar o módulo"}>
        <FormComissoes
          chave="habilitacao"
          ocultos={{ perfilId: n.negocioId, ativa: n.moduloAtivo ? "nao" : "sim" }}
          rotuloBotao={n.moduloAtivo ? "Desabilitar módulo" : "Habilitar módulo"}
          rotuloEnviando="Salvando..."
          perigo={n.moduloAtivo}
        />
      </AcaoLinha>
    </li>
  );
}

const ROTULO_SITUACAO_ASSINATURA = {
  ativa: "Ativa",
  encerrada: "Encerrada",
  cancelada: "Cancelada",
} as const;

export function CartaoAssinaturaAdmin({ a }: { a: AssinaturaAdmin }) {
  return (
    <li className="cartao">
      <h3>
        {a.ofertaNome || "Oferta"} · {formatarReais(a.valorCentavos)} por mês
      </h3>
      <p>
        <SeloEstado rotulo={ROTULO_SITUACAO_ASSINATURA[a.situacao]} />
      </p>
      <p className="ajuda quebra-total">
        Cliente (conta): <CopiarId id={a.clienteId} /> · Negócio: <CopiarId id={a.negocioId} /> ·
        Oferta: <CopiarId id={a.ofertaId} />
      </p>
      <p className="ajuda">
        Início em {dia(a.inicio)}
        {a.fim ? ` · fim em ${dia(a.fim)}` : " · sem data de fim"}
        {a.canceladaEm ? ` · cancelada em ${dia(a.canceladaEm)}` : ""}
      </p>
      <AcaoLinha titulo="Confirmar pagamento de um mês">
        {a.situacao === "cancelada" ? (
          <p className="ajuda">
            Assinatura cancelada: só é possível confirmar meses até o cancelamento
            {a.canceladaEm ? ` (${dia(a.canceladaEm)})` : ""}.
          </p>
        ) : null}
        <FormComissoes
          chave="pagamento"
          ocultos={{ assinaturaId: a.id }}
          iniciais={{ valorCentavos: paraCampoReais(a.valorCentavos) }}
          valorCombinadoCentavos={a.valorCentavos}
          rotuloBotao="Confirmar pagamento"
          rotuloEnviando="Confirmando..."
          textoConfirmacao="Confirmo que o pagamento deste mês foi recebido fora da plataforma. O registro não pode ser apagado."
        />
      </AcaoLinha>
      {a.situacao === "ativa" ? (
        <AcaoLinha titulo="Cancelar assinatura">
          <FormComissoes
            chave="cancelarAssinatura"
            ocultos={{ assinaturaId: a.id }}
            rotuloBotao="Cancelar assinatura"
            rotuloEnviando="Cancelando..."
            perigo
            textoConfirmacao="Confirmo cancelar esta assinatura. Comissões já geradas continuam como estão."
          />
        </AcaoLinha>
      ) : null}
    </li>
  );
}

export function CartaoPagamentoAdmin({ p }: { p: PagamentoAdmin }) {
  const estornado = p.estado === "estornado";
  return (
    <li className="cartao">
      <h3>
        {formatarReais(p.valorCentavos)} · mês {rotuloCompetencia(p.competencia)}
      </h3>
      <p>
        <SeloEstado rotulo={estornado ? "Estornado" : "Confirmado"} />{" "}
        <SeloEstado rotulo={p.comissaoId ? "Gerou comissão" : "Sem comissão"} />
      </p>
      <p className="ajuda quebra-total">
        {p.ofertaNome ? `${p.ofertaNome} · ` : ""}Cliente (conta): <CopiarId id={p.clienteId} /> ·
        Negócio: <CopiarId id={p.negocioId} />
      </p>
      <p className="ajuda">
        Confirmado em {formatarDataHora(p.confirmadoEm)}
        {p.estornadoEm ? ` · estornado em ${formatarDataHora(p.estornadoEm)}` : ""}
      </p>
      {estornado ? null : (
        <AcaoLinha titulo="Estornar este pagamento">
          <FormComissoes
            chave="estorno"
            ocultos={{ pagamentoId: p.id }}
            rotuloBotao="Estornar pagamento"
            rotuloEnviando="Estornando..."
            perigo
            textoConfirmacao="Confirmo estornar este pagamento. A comissão gerada por ele será revertida e o mês não poderá ser confirmado de novo."
          />
        </AcaoLinha>
      )}
    </li>
  );
}

const PROXIMO_REPASSE = {
  gerada: { estado: "pendente_repasse", titulo: "Marcar como pendente de repasse" },
  pendente_repasse: { estado: "paga", titulo: "Registrar repasse feito (paga)" },
} as const;

export function CartaoComissaoAdmin({ c }: { c: ComissaoAdmin }) {
  const proximo = c.estado === "paga" ? null : PROXIMO_REPASSE[c.estado];
  return (
    <li className="cartao">
      <h3>
        {formatarReais(c.revertida ? 0 : c.valorCentavos)}
        {c.ofertaNome ? ` · ${c.ofertaNome}` : ""}
      </h3>
      <p>
        <SeloEstado rotulo={c.revertida ? "Revertida" : ROTULO_ESTADO_COMISSAO[c.estado]} />
        {c.revertida && c.reversaoCausa ? ` (${ROTULO_CAUSA_REVERSAO[c.reversaoCausa]})` : null}
      </p>
      <p className="ajuda">
        Mês {rotuloCompetencia(c.competencia)} · {formatarReais(c.baseCentavos)} ×{" "}
        {formatarPercentualBp(c.percentualBp)} = {formatarReais(c.valorCentavos)}
        {c.estadoEm ? ` · estado desde ${dia(c.estadoEm)}` : ""}
      </p>
      <p className="ajuda quebra-total">
        Indicador (conta): <CopiarId id={c.indicadorId} /> · Cliente (conta):{" "}
        <CopiarId id={c.clienteId} />
      </p>
      {proximo && !c.revertida ? (
        <AcaoLinha titulo={proximo.titulo}>
          <FormComissoes
            chave="repasse"
            ocultos={{ comissaoId: c.id, estado: proximo.estado }}
            rotuloBotao={proximo.titulo}
            rotuloEnviando="Salvando..."
            textoConfirmacao={
              proximo.estado === "paga"
                ? "Confirmo que o repasse foi feito fora da plataforma. A plataforma não transfere dinheiro."
                : "Confirmo marcar esta comissão como pendente de repasse."
            }
          />
        </AcaoLinha>
      ) : null}
      {c.revertida ? null : (
        <AcaoLinha titulo="Reverter esta comissão">
          <FormComissoes
            chave="reversao"
            ocultos={{ comissaoId: c.id }}
            rotuloBotao="Reverter comissão"
            rotuloEnviando="Revertendo..."
            perigo
            textoConfirmacao="Confirmo reverter esta comissão. O registro original é mantido e a reversão não pode ser desfeita."
          />
        </AcaoLinha>
      )}
    </li>
  );
}

export function CartaoVinculoAdmin({ v }: { v: VinculoAdmin }) {
  return (
    <li className="cartao">
      <p>
        <SeloEstado rotulo={v.situacao === "ativo" ? "Ativo" : "Encerrado"} />{" "}
        {v.situacao === "ativo" && !v.indicadorEmDia ? (
          <SeloEstado rotulo="Indicador em atraso" />
        ) : null}{" "}
        {v.vencido ? <SeloEstado rotulo="Prazo vencido" /> : null}
      </p>
      <p className="ajuda quebra-total">
        Indicador (conta): <CopiarId id={v.indicadorId} /> · Cliente (conta):{" "}
        <CopiarId id={v.clienteId} /> · Negócio: <CopiarId id={v.negocioId} />
      </p>
      {v.inadimplenteDesde ? (
        <p className="ajuda">
          Em atraso desde {dia(v.inadimplenteDesde)}
          {v.encerraEm ? ` · encerramento previsto para ${dia(v.encerraEm)}` : ""}
        </p>
      ) : null}
      <p className="ajuda">
        Vinculado em {dia(v.criadoEm)}
        {v.encerradoEm ? ` · encerrado em ${dia(v.encerradoEm)}` : ""}
      </p>
      {v.vencido ? (
        <AcaoLinha titulo="Encerrar este vínculo">
          <FormComissoes
            chave="encerrarVinculo"
            ocultos={{ vinculoId: v.id }}
            rotuloBotao="Encerrar vínculo"
            rotuloEnviando="Encerrando..."
            perigo
            textoConfirmacao="Confirmo encerrar este vínculo. Não há restauração automática e o cliente não passa para outro indicador."
          />
        </AcaoLinha>
      ) : null}
    </li>
  );
}
