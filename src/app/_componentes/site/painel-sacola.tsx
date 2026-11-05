"use client";

import { MAX_ITENS_SACOLA } from "../../_lib/sacola";
import { sacola, useSacola } from "./sacola-estado";

/**
 * Lista de interesse (D-023, IM-101): aparece só depois que o visitante adiciona algo. Não mostra preço nem total,
 * não tem pagamento; o botão leva a lista ao pedido de contato (IM-013), onde o visitante revisa o texto antes de enviar.
 */
export function PainelSacola({ perfilId }: { perfilId: string }) {
  const { perfilId: dono, itens } = useSacola();
  if (dono !== perfilId || itens.length === 0) return null;
  const total = itens.reduce((s, i) => s + i.quantidade, 0);
  return (
    <section className="st-sacola" aria-labelledby="titulo-sacola">
      <h3 id="titulo-sacola">
        Sua lista de interesse ({total} {total === 1 ? "item" : "itens"})
      </h3>
      <p className="ajuda">
        Não é uma compra: a lista vai como mensagem para a empresa, que confirma preço e
        disponibilidade.
      </p>
      <ul className="st-sacola-itens">
        {itens.map((i, n) => (
          <li key={`${i.id}-${i.escolhas.join("|")}`}>
            <span className="st-sacola-nome">
              {i.nome}
              {i.escolhas.length > 0 ? <small> ({i.escolhas.join(", ")})</small> : null}
            </span>
            <span className="st-sacola-qtd">
              <button
                type="button"
                className="st-sacola-botao"
                onClick={() => sacola.alterar(n, -1)}
                aria-label={`Diminuir a quantidade de ${i.nome}`}
              >
                −
              </button>
              <span aria-label={`Quantidade: ${i.quantidade}`}>{i.quantidade}</span>
              <button
                type="button"
                className="st-sacola-botao"
                onClick={() => sacola.alterar(n, 1)}
                aria-label={`Aumentar a quantidade de ${i.nome}`}
              >
                +
              </button>
            </span>
          </li>
        ))}
      </ul>
      {itens.length >= MAX_ITENS_SACOLA ? (
        <p className="ajuda">A lista chegou ao limite de {MAX_ITENS_SACOLA} itens.</p>
      ) : null}
      <p className="st-sacola-acoes">
        <button
          type="button"
          className="botao st-botao-auto"
          onClick={() => sacola.levarAoContato()}
        >
          Enviar a lista ao contato
        </button>
        <button
          type="button"
          className="botao botao-secundario st-botao-auto"
          onClick={() => sacola.limpar()}
        >
          Esvaziar a lista
        </button>
      </p>
    </section>
  );
}
