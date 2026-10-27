/* eslint-disable @next/next/no-img-element -- URLs assinadas do Storage mudam a cada visita; next/image não as otimiza. */
import type { ItemExibicao } from "@/modules/catalogo";
import type { PerfilExibicao } from "@/modules/perfis";
import { nomeDaCategoria, ROTULO_TIPO_ITEM, type CategoriaOpcao } from "../_lib/apresentacao";

/**
 * Exibição de perfil e item no formato da página pública (IM-017): prévia do responsável e conferência do
 * administrador. Os modelos de entrada não têm WhatsApp, responsável nem e-mail (IM-029); esta tela também não.
 */

type Urls = Record<string, string>;

function Foto({ caminho, urls, alt }: { caminho: string; urls: Urls; alt: string }) {
  const url = urls[caminho];
  return url ? (
    <img src={url} alt={alt} loading="lazy" />
  ) : (
    <span className="imagem-indisponivel">Imagem indisponível</span>
  );
}

export function CategoriasTexto({
  principal,
  secundarias,
  categorias,
}: {
  principal: string | null;
  secundarias: readonly string[];
  categorias: readonly CategoriaOpcao[];
}) {
  if (!principal) return null;
  return (
    <p className="categorias">
      <strong>{nomeDaCategoria(principal, categorias)}</strong>
      {secundarias.map((s) => (
        <span key={s}> · {nomeDaCategoria(s, categorias)}</span>
      ))}
    </p>
  );
}

export function PerfilVisao({
  perfil,
  categorias,
  urls,
}: {
  perfil: PerfilExibicao;
  categorias: readonly CategoriaOpcao[];
  urls: Urls;
}) {
  const local = [perfil.cidade, perfil.uf].filter(Boolean).join(" - ");
  return (
    <article className="visao">
      {perfil.bannersPaths.length > 0 ? (
        <div className="visao-banners">
          {perfil.bannersPaths.map((b, i) => (
            <Foto key={b} caminho={b} urls={urls} alt={`Banner ${i + 1}`} />
          ))}
        </div>
      ) : null}
      {perfil.imagemPath ? (
        <div className="visao-imagem">
          <Foto
            caminho={perfil.imagemPath}
            urls={urls}
            alt={`Imagem de ${perfil.nome ?? "perfil"}`}
          />
        </div>
      ) : null}
      <h2>{perfil.nome ?? "Perfil sem nome"}</h2>
      <CategoriasTexto
        principal={perfil.categoriaPrincipalId}
        secundarias={perfil.categoriasSecundariasIds}
        categorias={categorias}
      />
      {perfil.descricaoBreve ? <p>{perfil.descricaoBreve}</p> : null}
      {local ? <p>{local}</p> : null}
      {perfil.endereco ? (
        <p>
          <strong>Endereço:</strong> {perfil.endereco}
        </p>
      ) : null}
      {perfil.areasAtendidas.length > 0 ? (
        <p>
          <strong>Áreas atendidas:</strong> {perfil.areasAtendidas.join(", ")}
        </p>
      ) : null}
      {perfil.site ? (
        <p>
          <strong>Site:</strong> {perfil.site}
        </p>
      ) : null}
      {perfil.informacoesSociais ? <p>{perfil.informacoesSociais}</p> : null}
      {perfil.fotosPaths.length > 0 ? (
        <div className="visao-fotos">
          {perfil.fotosPaths.map((f, i) => (
            <Foto key={f} caminho={f} urls={urls} alt={`Foto ${i + 1}`} />
          ))}
        </div>
      ) : null}
    </article>
  );
}

export function ItemVisao({
  item,
  categorias,
  urls,
}: {
  item: ItemExibicao;
  categorias: readonly CategoriaOpcao[];
  urls: Urls;
}) {
  return (
    <article className="visao">
      {item.fotoPath ? (
        <div className="visao-imagem">
          <Foto caminho={item.fotoPath} urls={urls} alt={`Foto de ${item.nome ?? "item"}`} />
        </div>
      ) : null}
      <p className="ajuda">
        {item.anuncioParticular ? "Anúncio particular" : ROTULO_TIPO_ITEM[item.tipo]}
      </p>
      <h2>{item.nome ?? "Item sem nome"}</h2>
      {item.precoTexto ? <p className="preco">{item.precoTexto}</p> : null}
      <CategoriasTexto
        principal={item.categoriaPrincipalId}
        secundarias={item.categoriasSecundariasIds}
        categorias={categorias}
      />
      {item.descricao ? <p>{item.descricao}</p> : null}
    </article>
  );
}
