import type { Metadata } from "next";
import Link from "next/link";
import { IndicarDestino } from "../_componentes/indicar-destino";
import { PainelPagina, SeloEstado } from "../_componentes/painel";
import { Aviso } from "../_componentes/ui";
import { formatarDataHora } from "../_lib/apresentacao";
import { obterContextoIndicacoes } from "../_lib/contexto-indicacoes";
import { SEM_INDEXACAO } from "../_lib/pagina";

export const metadata: Metadata = { title: "Minhas indicações | IndicaMais", ...SEM_INDEXACAO };
export const dynamic = "force-dynamic";

const ROTULO_STATUS: Record<string, string> = { recebido: "Pedido de contato recebido" };
const ROTULO_TIPO = { perfil: "Perfil", item: "Produto, serviço ou anúncio" } as const;

/**
 * IM-024, IM-029: links que o usuário gerou (para copiar ou compartilhar de novo) e as indicações que
 * viraram pedido de contato. NUNCA mostra nome, WhatsApp, e-mail ou mensagem de quem pediu contato.
 */
export default async function PaginaMinhasIndicacoes() {
  const ctx = await obterContextoIndicacoes("/minhas-indicacoes");
  const [admin, links, indicacoes] = await Promise.all([
    ctx.ehAdministrador(),
    ctx.servico.listarMeusLinks(),
    ctx.servico.listarMinhasIndicacoes(),
  ]);
  return (
    <PainelPagina
      titulo="Minhas indicações"
      subtitulo="Os links que você gerou e as indicações que já resultaram em pedido de contato."
      admin={admin}
      atual="indicacoes"
    >
      <section aria-labelledby="titulo-links">
        <h2 id="titulo-links">Links que gerei</h2>
        {!links.ok ? (
          <Aviso tipo="erro">{links.erro.mensagem}</Aviso>
        ) : links.valor.length === 0 ? (
          <p className="ajuda">
            Você ainda não gerou links. Abra um perfil ou anúncio e use o botão &quot;Indique&quot;.{" "}
            <Link href="/">Ir para a página inicial</Link>
          </p>
        ) : (
          <ul className="lista-cartoes">
            {links.valor.map((l) => (
              <li key={l.id} className="cartao">
                <h3>{l.destinoNome || ROTULO_TIPO[l.destinoTipo]}</h3>
                <p>
                  <SeloEstado rotulo={ROTULO_TIPO[l.destinoTipo]} />{" "}
                  <SeloEstado rotulo={l.disponivel ? "Disponível" : "Indisponível no momento"} />
                </p>
                <p className="ajuda">Gerado em {formatarDataHora(l.criadoEm)}</p>
                {l.disponivel ? (
                  <IndicarDestino
                    tipo={l.destinoTipo}
                    id={l.destinoId}
                    rotulo="Copiar ou compartilhar de novo"
                    retorno="/minhas-indicacoes"
                  />
                ) : (
                  <p className="ajuda">
                    Este destino não está visível ao público agora. O link volta a funcionar se ele
                    for publicado de novo.
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="titulo-recebidas">
        <h2 id="titulo-recebidas">Indicações recebidas</h2>
        <p className="ajuda">Por privacidade, os dados de quem pediu contato não aparecem aqui.</p>
        {!indicacoes.ok ? (
          <Aviso tipo="erro">{indicacoes.erro.mensagem}</Aviso>
        ) : indicacoes.valor.length === 0 ? (
          <p className="ajuda">Nenhuma indicação sua virou pedido de contato ainda.</p>
        ) : (
          <ul className="lista-cartoes">
            {indicacoes.valor.map((i) => (
              <li key={i.id} className="cartao">
                <h3>{i.destinoNome || ROTULO_TIPO[i.destinoTipo]}</h3>
                <p>
                  <SeloEstado rotulo={ROTULO_STATUS[i.status] ?? "Recebido"} />
                </p>
                <p className="ajuda">Em {formatarDataHora(i.criadoEm)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PainelPagina>
  );
}
