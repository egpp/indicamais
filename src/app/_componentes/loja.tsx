/* eslint-disable @next/next/no-img-element -- URLs assinadas do Storage mudam a cada visita; next/image não as otimiza. */
import Link from "next/link";
import {
  FINALIDADES_IMOVEL,
  ROTULOS_FINALIDADE_IMOVEL,
  ROTULOS_TIPO_IMOVEL,
  TIPOS_IMOVEL,
  type ImovelExibicao,
} from "@/modules/catalogo";
import type { FiltrosLojaTela } from "../_lib/loja-pagina";

/**
 * Peças da Loja (IM-097, IM-098, D-020) para páginas públicas e prévia. Servidor, sem JavaScript no navegador.
 * Recebem só modelos de exibição: sem endereço exato, WhatsApp, e-mail nem dado de pessoa (IM-029). Sem carrinho,
 * checkout nem pagamento: o negócio se conclui pelo contato existente (IM-090).
 */

const numero = (n: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(n);

/** Dados do imóvel em lista de definições (rótulo e valor), só o que foi informado. */
export function DetalhesImovel({ imovel }: { imovel: ImovelExibicao }) {
  const linhas: [string, string | null][] = [
    ["Tipo", imovel.tipoRotulo],
    ["Finalidade", imovel.finalidadeRotulo],
    ["Área", imovel.areaM2 === null ? null : `${numero(imovel.areaM2)} m²`],
    ["Quartos", imovel.quartos === null ? null : String(imovel.quartos)],
    ["Banheiros", imovel.banheiros === null ? null : String(imovel.banheiros)],
    ["Vagas", imovel.vagas === null ? null : String(imovel.vagas)],
    ["Localização", imovel.localTexto],
    ["Condomínio", imovel.condominioTexto === null ? null : `${imovel.condominioTexto} por mês`],
    ["IPTU", imovel.iptuTexto],
    [
      "Financiamento",
      imovel.aceitaFinanciamento === null
        ? null
        : imovel.aceitaFinanciamento
          ? "Aceita financiamento"
          : "Não aceita financiamento",
    ],
  ];
  const preenchidas = linhas.filter((l): l is [string, string] => l[1] !== null);
  if (preenchidas.length === 0) return null;
  return (
    <dl className="detalhes-imovel" aria-label="Dados do imóvel">
      {preenchidas.map(([rotulo, valor]) => (
        <div key={rotulo}>
          <dt>{rotulo}</dt>
          <dd>{valor}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Fotos adicionais do item (Loja). Só as que têm URL assinada. */
export function GaleriaFotos({
  nome,
  caminhos,
  urls,
}: {
  nome: string;
  caminhos: readonly string[];
  urls: Record<string, string>;
}) {
  const fotos = caminhos.flatMap((c, i) =>
    urls[c] ? [{ chave: c, src: urls[c], alt: `Foto ${i + 2} de ${nome}` }] : [],
  );
  if (fotos.length === 0) return null;
  return (
    <ul className="galeria-fotos" aria-label={`Mais fotos de ${nome}`}>
      {fotos.map((f) => (
        <li key={f.chave}>
          <img src={f.src} alt={f.alt} loading="lazy" decoding="async" />
        </li>
      ))}
    </ul>
  );
}

/**
 * Filtros simples dos imóveis do perfil (finalidade, tipo, quartos, preço máximo). Formulário GET comum: funciona
 * sem JavaScript e a URL fica compartilhável. Preserva ?ind e ?estilo.
 */
export function FiltrosImoveis({
  slug,
  valores,
  preservar,
  erro,
}: {
  slug: string;
  valores: FiltrosLojaTela;
  preservar: Record<string, string>;
  erro?: string | null;
}) {
  const base = `/perfil/${slug}`;
  return (
    <form
      className="filtros-loja"
      method="get"
      action={`${base}#produtos`}
      role="search"
      aria-label="Filtrar imóveis"
    >
      {Object.entries(preservar).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <div className="campo">
        <label htmlFor="f-finalidade">Finalidade</label>
        <select id="f-finalidade" name="finalidade" defaultValue={valores.finalidade}>
          <option value="">Venda ou aluguel</option>
          {FINALIDADES_IMOVEL.map((f) => (
            <option key={f} value={f}>
              {ROTULOS_FINALIDADE_IMOVEL[f]}
            </option>
          ))}
        </select>
      </div>
      <div className="campo">
        <label htmlFor="f-tipo">Tipo de imóvel</label>
        <select id="f-tipo" name="imovelTipo" defaultValue={valores.imovelTipo}>
          <option value="">Todos</option>
          {TIPOS_IMOVEL.map((t) => (
            <option key={t} value={t}>
              {ROTULOS_TIPO_IMOVEL[t]}
            </option>
          ))}
        </select>
      </div>
      <div className="campo">
        <label htmlFor="f-quartos">Quartos (mínimo)</label>
        <select id="f-quartos" name="quartos" defaultValue={valores.quartos}>
          <option value="">Qualquer</option>
          {[1, 2, 3, 4].map((q) => (
            <option key={q} value={q}>
              {q === 4 ? "4 ou mais" : `${q}+`}
            </option>
          ))}
        </select>
      </div>
      <div className="campo">
        <label htmlFor="f-preco">Preço máximo (R$)</label>
        <input
          id="f-preco"
          name="precoMax"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder="Ex.: 350.000,00"
          defaultValue={valores.precoMax}
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro ? "f-preco-erro" : undefined}
        />
        {erro ? (
          <p id="f-preco-erro" className="erro-campo">
            {erro}
          </p>
        ) : null}
      </div>
      <div className="acoes">
        <button type="submit" className="botao">
          Filtrar imóveis
        </button>{" "}
        <Link
          className="botao botao-secundario"
          href={`${base}${preservarQuery(preservar)}#produtos`}
        >
          Limpar
        </Link>
      </div>
    </form>
  );
}

function preservarQuery(preservar: Record<string, string>): string {
  const q = new URLSearchParams(preservar).toString();
  return q ? `?${q}` : "";
}
