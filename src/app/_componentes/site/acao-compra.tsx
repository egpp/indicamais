"use client";

import { useId, useState } from "react";
import type { GrupoVariacao } from "../../_lib/detalhes-item";
import type { AcaoCompraResolvida } from "./acao-compra-regras";
import { sacola } from "./sacola-estado";

/**
 * Botão da "ação de compra" (D-022, D-023). Recebe a decisão pronta de `resolverAcaoCompra` e a executa; é o único
 * componente que sabe o que cada modo faz. Sem preço, sem estoque, sem pagamento (IM-090).
 * Variações (tamanho, cor) são só texto informativo: o visitante escolhe e a escolha vai na mensagem.
 */
export function AcaoCompra({
  acao,
  perfilId,
  item,
  variacoes = [],
}: {
  acao: AcaoCompraResolvida;
  perfilId: string;
  item: { id: string; nome: string };
  variacoes?: readonly GrupoVariacao[];
}) {
  const base = useId();
  const [escolhas, setEscolhas] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState("");

  if (acao.modo === "contato") {
    return (
      <p className="st-acao-compra">
        <a className="botao botao-secundario st-botao-auto" href={acao.href}>
          {acao.rotulo}
          <span className="sr-only">: {item.nome}</span>
        </a>
      </p>
    );
  }

  const adicionar = () => {
    sacola.adicionar(perfilId, {
      id: item.id,
      nome: item.nome,
      escolhas: variacoes.flatMap((g) =>
        escolhas[g.rotulo] ? [`${g.rotulo}: ${escolhas[g.rotulo]}`] : [],
      ),
    });
    setAviso(`${item.nome} foi para a sua lista de interesse.`);
  };

  return (
    <div className="st-acao-compra">
      {variacoes.map((g, n) => {
        const id = `${base}-${n}`;
        return (
          <div className="st-variacao" key={g.rotulo}>
            <label htmlFor={id}>{g.rotulo}</label>
            <select
              id={id}
              value={escolhas[g.rotulo] ?? ""}
              onChange={(e) => setEscolhas((a) => ({ ...a, [g.rotulo]: e.target.value }))}
            >
              <option value="">Sem preferência</option>
              {g.opcoes.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
        );
      })}
      <button type="button" className="botao botao-secundario st-botao-auto" onClick={adicionar}>
        {acao.rotulo}
        <span className="sr-only">: {item.nome}</span>
      </button>
      <span className="sr-only" role="status">
        {aviso}
      </span>
    </div>
  );
}
