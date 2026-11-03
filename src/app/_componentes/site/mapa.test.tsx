// @vitest-environment jsdom
import { cleanup, render, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { montarMapaUrls } from "@/modules/perfis";
import { demonstracaoDoEstilo } from "./demonstracao";
import { IDS_ESTILOS, TEMAS } from "./estilos";
import { SANDBOX_MAPA } from "./mapa-localizacao";
import { SiteNegocio } from "./site-negocio";

afterEach(cleanup);

const LIBERADOS = IDS_ESTILOS.filter((e) => TEMAS[e].liberado);
const urls = montarMapaUrls({ latitude: -9.665, longitude: -35.735 })!;

function pagina(estilo: (typeof IDS_ESTILOS)[number], mapa: typeof urls | null) {
  const demo = demonstracaoDoEstilo(estilo);
  return (
    <SiteNegocio
      estilo={estilo}
      perfil={{ ...demo.perfil, nome: "Padaria da Ana", endereco: "Rua das Flores, 100" }}
      itens={demo.itens}
      categorias={demo.categorias}
      urls={demo.urls}
      beneficios={[]}
      contato={<p>contato</p>}
      mapa={mapa}
    />
  );
}

describe("seção Localização com mapa (IM-018, IM-092)", () => {
  it.each(LIBERADOS)("estilo %s: endereço, iframe do OpenStreetMap e links seguros", (estilo) => {
    render(pagina(estilo, urls));
    const secao = document.getElementById("localizacao")!;
    expect(within(secao).getByText("Rua das Flores, 100")).toBeTruthy();
    const frame = within(secao).getByTitle("Mapa da localização de Padaria da Ana");
    expect(frame.tagName).toBe("IFRAME");
    expect(frame.getAttribute("src")).toBe(urls.embed);
    expect(frame.getAttribute("loading")).toBe("lazy");
    expect(frame.getAttribute("referrerpolicy")).toBe("no-referrer");
    expect(frame.getAttribute("sandbox")).toBe(SANDBOX_MAPA);
    expect(SANDBOX_MAPA).not.toMatch(/allow-top-navigation|allow-forms|allow-modals/);
    const maior = within(secao).getByRole("link", { name: /Ver mapa maior/ });
    const chegar = within(secao).getByRole("link", { name: /Como chegar/ });
    expect(maior.getAttribute("href")).toBe(urls.verMaior);
    expect(chegar.getAttribute("href")).toBe(urls.comoChegar);
    for (const a of [maior, chegar]) {
      expect(a.getAttribute("target")).toBe("_blank");
      expect(a.getAttribute("rel")).toBe("noopener noreferrer");
    }
    expect(within(secao).getByText("Mapa fornecido pelo OpenStreetMap.")).toBeTruthy();
  });

  it("todo endereço externo da seção é do openstreetmap.org (sem Google)", () => {
    render(pagina("minimalista", urls));
    const secao = document.getElementById("localizacao")!;
    const alvos = [
      ...Array.from(secao.querySelectorAll("a")).map((a) => a.getAttribute("href")!),
      ...Array.from(secao.querySelectorAll("iframe")).map((i) => i.getAttribute("src")!),
    ];
    expect(alvos.length).toBe(3);
    for (const u of alvos) expect(new URL(u).origin).toBe("https://www.openstreetmap.org");
  });

  it("sem mapa mantém só endereço e o Como chegar por busca, sem iframe", () => {
    render(pagina("gastronomia", null));
    const secao = document.getElementById("localizacao")!;
    expect(secao.querySelector("iframe")).toBeNull();
    expect(within(secao).queryByRole("link", { name: /Ver mapa maior/ })).toBeNull();
    expect(
      within(secao)
        .getByRole("link", { name: /Como chegar/ })
        .getAttribute("href"),
    ).toMatch(/^https:\/\/www\.google\.com\/maps\/search\//);
    expect(within(secao).getByText("Rua das Flores, 100")).toBeTruthy();
  });

  it("não expõe telefone, e-mail nem conta na seção", () => {
    render(pagina("minimalista", urls));
    const html = document.getElementById("localizacao")!.innerHTML;
    expect(html).not.toMatch(/whatsapp|wa\.me|mailto:|conta_id|@/i);
  });
});
