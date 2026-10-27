import Link from "next/link";
import { formatarPreco, type MeuItem } from "@/modules/catalogo";
import { ROTULO_TIPO_ITEM } from "../_lib/apresentacao";
import { EtiquetaRascunhoNaoEnviado } from "./aviso-rascunho";
import { SeloEstado } from "./painel";

/** Lista de itens do responsável (produtos, serviços ou anúncios particulares). */
export function ListaItens({
  itens,
  nomesDePerfil,
}: {
  itens: readonly MeuItem[];
  nomesDePerfil?: Record<string, string>;
}) {
  return (
    <ul className="lista-cartoes">
      {itens.map((i) => {
        const preco = formatarPreco(i.conteudoEdicao.preco);
        return (
          <li key={i.id} className="cartao">
            <h2>
              <Link href={`/meus-itens/${i.id}`}>{i.conteudoEdicao.nome ?? "Item sem nome"}</Link>
            </h2>
            <p>
              <SeloEstado rotulo={i.estado.rotulo} />
              {i.estado.aberta === "rascunho" ? (
                <>
                  {" "}
                  <EtiquetaRascunhoNaoEnviado />
                </>
              ) : null}
            </p>
            <p className="ajuda">
              {i.anuncioParticular ? "Anúncio particular" : ROTULO_TIPO_ITEM[i.tipo]}
              {i.perfilId && nomesDePerfil?.[i.perfilId] ? ` · ${nomesDePerfil[i.perfilId]}` : ""}
              {preco ? ` · ${preco}` : ""}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
