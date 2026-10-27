"use client";

import { useId, type ReactNode } from "react";
import { UFS } from "@/modules/perfis";
import type { CategoriaOpcao } from "../_lib/apresentacao";

type Base = { nome: string; rotulo: string; erro?: string; ajuda?: ReactNode; opcional?: boolean };

function Moldura({
  id,
  rotulo,
  opcional,
  erro,
  ajuda,
  children,
}: Pick<Base, "rotulo" | "opcional" | "erro" | "ajuda"> & { id: string; children: ReactNode }) {
  return (
    <div className="campo">
      <label htmlFor={id}>
        {rotulo}
        {opcional ? <span className="opcional"> (opcional)</span> : null}
      </label>
      {children}
      {ajuda ? (
        <p id={`${id}-ajuda`} className="ajuda">
          {ajuda}
        </p>
      ) : null}
      {erro ? (
        <p id={`${id}-erro`} className="erro-campo">
          {erro}
        </p>
      ) : null}
    </div>
  );
}

const descrito = (id: string, erro?: string, ajuda?: ReactNode) =>
  [erro ? `${id}-erro` : null, ajuda ? `${id}-ajuda` : null].filter(Boolean).join(" ") || undefined;

/** Texto de várias linhas com rótulo, ajuda e erro anunciados. */
export function CampoTextoLongo({
  nome,
  rotulo,
  erro,
  ajuda,
  opcional,
  valorInicial,
  linhas = 4,
}: Base & { valorInicial?: string; linhas?: number }) {
  const id = useId();
  return (
    <Moldura id={id} rotulo={rotulo} opcional={opcional} erro={erro} ajuda={ajuda}>
      <textarea
        id={id}
        name={nome}
        rows={linhas}
        defaultValue={valorInicial}
        aria-invalid={erro ? true : undefined}
        aria-describedby={descrito(id, erro, ajuda)}
      />
    </Moldura>
  );
}

export type OpcaoSelect = { valor: string; rotulo: string };

export function CampoSelect({
  nome,
  rotulo,
  erro,
  ajuda,
  opcional,
  opcoes,
  valorInicial = "",
  vazio = "Selecione",
}: Base & { opcoes: readonly OpcaoSelect[]; valorInicial?: string; vazio?: string }) {
  const id = useId();
  // Valor que não está mais na lista (ex.: categoria desativada) continua visível, não some em silêncio.
  const ausente = valorInicial !== "" && !opcoes.some((o) => o.valor === valorInicial);
  return (
    <Moldura id={id} rotulo={rotulo} opcional={opcional} erro={erro} ajuda={ajuda}>
      <select
        id={id}
        name={nome}
        defaultValue={valorInicial}
        aria-invalid={erro ? true : undefined}
        aria-describedby={descrito(id, erro, ajuda)}
      >
        <option value="">{vazio}</option>
        {ausente ? <option value={valorInicial}>Categoria indisponível</option> : null}
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </select>
    </Moldura>
  );
}

/** UF: lista oficial dos módulos (D-006: cidade é texto, UF é validada). */
export function CampoUF({ erro, valorInicial }: { erro?: string; valorInicial?: string }) {
  return (
    <CampoSelect
      nome="uf"
      rotulo="UF"
      vazio="UF"
      erro={erro}
      valorInicial={valorInicial}
      opcoes={UFS.map((u) => ({ valor: u, rotulo: u }))}
    />
  );
}

/** Principal + até 2 secundárias (IM-016). A regra de combinação é do módulo; aqui só a escolha. */
export function CamposCategorias({
  categorias,
  principal,
  secundarias,
  erros,
}: {
  categorias: readonly CategoriaOpcao[];
  principal?: string;
  secundarias?: readonly string[];
  erros: Record<string, string>;
}) {
  const opcoes = categorias.map((c) => ({ valor: c.id, rotulo: c.nome }));
  return (
    <>
      <CampoSelect
        nome="categoriaPrincipalId"
        rotulo="Categoria principal"
        opcoes={opcoes}
        valorInicial={principal}
        erro={erros.categoriaPrincipalId}
      />
      <CampoSelect
        nome="categoriaSecundaria1"
        rotulo="Categoria secundária 1"
        opcional
        opcoes={opcoes}
        valorInicial={secundarias?.[0]}
        erro={erros.categoriasSecundariasIds}
      />
      <CampoSelect
        nome="categoriaSecundaria2"
        rotulo="Categoria secundária 2"
        opcional
        opcoes={opcoes}
        valorInicial={secundarias?.[1]}
      />
    </>
  );
}

/** Preço: modo + valor em R$ (formato brasileiro). A conversão e a faixa de valor são do módulo catalogo. */
export function CamposPreco({
  modoInicial,
  valorInicial,
  erros,
}: {
  modoInicial?: string;
  valorInicial?: string;
  erros: Record<string, string>;
}) {
  const idValor = useId();
  return (
    <>
      <CampoSelect
        nome="precoModo"
        rotulo="Preço"
        opcional
        vazio="Sem preço"
        valorInicial={modoInicial}
        erro={erros.precoModo}
        opcoes={[
          { valor: "fixo", rotulo: "Preço fixo" },
          { valor: "a_partir_de", rotulo: "A partir de" },
          { valor: "sob_consulta", rotulo: "Sob consulta" },
        ]}
      />
      <Moldura
        id={idValor}
        rotulo="Valor (R$)"
        opcional
        erro={erros.precoValor}
        ajuda="Preencha se escolheu preço fixo ou a partir de. Exemplo: 1.250,00"
      >
        <input
          id={idValor}
          name="precoValor"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0,00"
          defaultValue={valorInicial}
          aria-invalid={erros.precoValor ? true : undefined}
          aria-describedby={descrito(idValor, erros.precoValor, "x")}
        />
      </Moldura>
    </>
  );
}
