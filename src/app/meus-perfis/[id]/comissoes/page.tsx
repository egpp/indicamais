import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AVISO_SEM_AUTOMATICO,
  CartaoComissao,
  CartaoVinculo,
} from "../../../_componentes/comissoes";
import { FormComissoes, FormOfertaAtiva } from "../../../_componentes/form-comissoes";
import { PainelPagina, SeloEstado } from "../../../_componentes/painel";
import { Aviso } from "../../../_componentes/ui";
import { formatarDataCivil } from "../../../_lib/apresentacao";
import { obterContextoComissoes } from "../../../_lib/contexto-comissoes";
import { obterContexto } from "../../../_lib/contexto-sessao";
import { formatarPercentualBp } from "../../../_lib/dinheiro-comissoes";
import { SEM_INDEXACAO } from "../../../_lib/pagina";

export const metadata: Metadata = { title: "Comissões do negócio | IndicaMais", ...SEM_INDEXACAO };
export const dynamic = "force-dynamic";

const LIMITE = 100;

/**
 * IM-061 a IM-063, IM-066, IM-069, IM-072, IM-073: painel de comissões do negócio. A seção só existe para o
 * responsável e só com o módulo habilitado pelo administrador; do contrário, 404 padrão (a seção fica oculta).
 * O anunciante cria ofertas recorrentes mensais com percentual próprio, ativa e desativa ofertas, e acompanha
 * comissões e vínculos. Indicador e cliente aparecem só como referência opaca (IM-029, IM-041, IM-050).
 */
export default async function PaginaComissoesDoNegocio({
  params,
}: PageProps<"/meus-perfis/[id]/comissoes">) {
  const { id } = await params;
  const voltar = `/meus-perfis/${id}/comissoes`;
  const base = await obterContexto(voltar);
  const perfil = await base.perfis.obter(id);
  if (!perfil.ok) {
    if (perfil.erro.codigo === "NAO_ENCONTRADO") notFound();
    return (
      <PainelPagina titulo="Comissões" atual="perfis">
        <Aviso tipo="erro">{perfil.erro.mensagem}</Aviso>
      </PainelPagina>
    );
  }
  const ctx = await obterContextoComissoes(voltar);
  const negocios = await ctx.servico.meusNegocios();
  const habilitado = negocios.ok && negocios.valor.some((n) => n.negocioId === id && n.moduloAtivo);
  if (!habilitado) notFound();

  const [ofertas, comissoes, vinculos, itens] = await Promise.all([
    ctx.servico.minhasOfertas(),
    ctx.servico.negocioComissoes(),
    ctx.servico.negocioVinculos(),
    base.itens.listarMeus(),
  ]);
  const nome = perfil.valor.conteudoEdicao.nome ?? "Site sem nome";
  const doNegocio = <T extends { negocioId: string }>(xs: T[]) =>
    xs.filter((x) => x.negocioId === id);
  const opcoesItens = itens.ok
    ? itens.valor
        .filter((i) => i.perfilId === id)
        .map((i) => ({ valor: i.id, rotulo: i.conteudoEdicao.nome ?? "Item sem nome" }))
    : [];
  const emAtraso = vinculos.ok
    ? doNegocio(vinculos.valor).filter((v) => v.situacao === "ativo" && !v.indicadorEmDia)
    : [];

  return (
    <PainelPagina
      titulo="Comissões"
      subtitulo={`Ofertas recorrentes, comissões e vínculos de ${nome}.`}
      atual="perfis"
    >
      <p>
        <Link className="botao botao-secundario" href={`/meus-perfis/${id}`}>
          Voltar para o site
        </Link>
      </p>
      <Aviso tipo="info">
        {AVISO_SEM_AUTOMATICO} Aqui você define as ofertas e acompanha; o registro das assinaturas e
        dos pagamentos é feito pela administração.
      </Aviso>

      {emAtraso.length > 0 ? (
        <Aviso tipo="atencao">
          <p>
            {emAtraso.length === 1
              ? "Um indicador seu está com a mensalidade em atraso."
              : `${emAtraso.length} indicadores estão com a mensalidade em atraso.`}{" "}
            Enquanto durar o atraso, eles não geram novas comissões neste negócio. Passado o prazo,
            a administração pode encerrar os vínculos; os clientes não mudam de indicador.
          </p>
        </Aviso>
      ) : null}

      <section aria-labelledby="titulo-ofertas">
        <h2 id="titulo-ofertas">Ofertas recorrentes</h2>
        <p className="ajuda">
          Só mensalidades entram. Vendas avulsas não geram comissão. Mudar o percentual vale apenas
          para os próximos pagamentos confirmados; o que já foi gerado não é recalculado.
        </p>
        {!ofertas.ok ? (
          <Aviso tipo="erro">{ofertas.erro.mensagem}</Aviso>
        ) : doNegocio(ofertas.valor).length === 0 ? (
          <p className="ajuda">Nenhuma oferta criada ainda.</p>
        ) : (
          <ul className="lista-cartoes">
            {doNegocio(ofertas.valor).map((o) => (
              <li key={o.id} className="cartao">
                <h3>{o.nome}</h3>
                <p>
                  <SeloEstado rotulo={o.ativa ? "Ativa" : "Inativa"} /> Comissão de{" "}
                  {formatarPercentualBp(o.percentualBp)} ao mês
                </p>
                <p className="ajuda">Criada em {formatarDataCivil(o.criadaEm.slice(0, 10))}</p>
                <FormOfertaAtiva ofertaId={o.id} ativa={o.ativa} />
                <details>
                  <summary className="botao-texto">Alterar percentual</summary>
                  <FormComissoes
                    chave="percentual"
                    ocultos={{ ofertaId: o.id }}
                    rotuloBotao="Salvar percentual"
                    rotuloEnviando="Salvando..."
                    secundario
                  />
                </details>
              </li>
            ))}
          </ul>
        )}
        <details>
          <summary className="botao-texto">Criar oferta recorrente</summary>
          {opcoesItens.length === 0 ? (
            <p className="ajuda">
              Para criar uma oferta, primeiro cadastre um produto ou serviço deste negócio em{" "}
              <Link href="/meus-itens">Meus itens</Link>.
            </p>
          ) : (
            <FormComissoes
              chave="oferta"
              ocultos={{ perfilId: id }}
              opcoes={{ itemId: opcoesItens }}
              rotuloBotao="Criar oferta"
              rotuloEnviando="Criando..."
            />
          )}
        </details>
      </section>

      <section aria-labelledby="titulo-comissoes-negocio">
        <h2 id="titulo-comissoes-negocio">Comissões geradas</h2>
        {!comissoes.ok ? (
          <Aviso tipo="erro">{comissoes.erro.mensagem}</Aviso>
        ) : doNegocio(comissoes.valor).length === 0 ? (
          <p className="ajuda">Nenhuma comissão gerada ainda.</p>
        ) : (
          <>
            <p className="ajuda">Mostrando as {LIMITE} mais recentes, no máximo.</p>
            <ul className="lista-cartoes">
              {doNegocio(comissoes.valor)
                .slice(0, LIMITE)
                .map((c) => (
                  <CartaoComissao key={c.id} c={c} comIndicador />
                ))}
            </ul>
          </>
        )}
      </section>

      <section aria-labelledby="titulo-vinculos-negocio">
        <h2 id="titulo-vinculos-negocio">Vínculos</h2>
        {!vinculos.ok ? (
          <Aviso tipo="erro">{vinculos.erro.mensagem}</Aviso>
        ) : doNegocio(vinculos.valor).length === 0 ? (
          <p className="ajuda">Nenhum vínculo registrado ainda.</p>
        ) : (
          <ul className="lista-cartoes">
            {doNegocio(vinculos.valor)
              .slice(0, LIMITE)
              .map((v) => (
                <CartaoVinculo key={v.id} v={v} />
              ))}
          </ul>
        )}
      </section>
    </PainelPagina>
  );
}
