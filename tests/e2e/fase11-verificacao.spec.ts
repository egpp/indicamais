/**
 * Verificação independente da Fase 11 (IM-091, IM-094): os 20 estilos na prévia do responsável, em 360px.
 * Mede por script próprio: rolagem horizontal, contraste WCAG AA dos textos, igualdade de tamanho dos cards
 * de cada grade e fallback do id desconhecido. Só ambiente de DESENVOLVIMENTO; não grava nada.
 */
import { expect, test, type Page } from "@playwright/test";
import { entrar, exigirConta } from "./contas";

const ESTILOS = [
  "minimalista",
  "saude_bem_estar",
  "beleza_estetica",
  "gastronomia",
  "cafe_padaria",
  "construcao_reformas",
  "automotivo",
  "juridico_contabil",
  "educacao_cursos",
  "pet",
  "moda_lojas",
  "fitness_esportes",
  "imobiliario",
  "tecnologia_assistencia",
  "casa_decoracao",
  "eventos_fotografia",
  "servicos_rapidos",
  "agro_campo",
  "turismo_hospedagem",
  "premium",
];

async function idDoPerfil(page: Page): Promise<string> {
  await page.goto("/aparencia");
  if (!/\/meus-perfis\//.test(page.url()))
    await page.locator('main a[href$="/aparencia"]').first().click();
  await expect(page).toHaveURL(/\/meus-perfis\/[0-9a-f-]{36}\/aparencia$/, { timeout: 15000 });
  return /\/meus-perfis\/([0-9a-f-]{36})\//.exec(page.url())![1];
}

/** Roda no navegador: contraste de todo texto visível dentro do site e tamanho dos cards. */
function medir() {
  type Rgba = [number, number, number, number];
  // O navegador pode devolver cores em color(srgb ...), oklab etc.: normaliza via canvas (qualquer sintaxe).
  const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
  const parse = (s: string): Rgba => {
    if (s === "transparent") return [0, 0, 0, 0];
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = "#000";
    ctx.fillStyle = s;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    // fillRect sobre pixel transparente: d[3] é o alfa composto; cor já vem não pré-multiplicada
    return [d[0], d[1], d[2], d[3] / 255];
  };
  const sobre = (f: Rgba, b: Rgba): Rgba => {
    const a = f[3] + b[3] * (1 - f[3]);
    if (a === 0) return [0, 0, 0, 0];
    return [0, 1, 2].map((i) => (f[i] * f[3] + b[i] * b[3] * (1 - f[3])) / a).concat(a) as Rgba;
  };
  const lum = (c: Rgba) => {
    const [r, g, b] = c.slice(0, 3).map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const razao = (a: Rgba, b: Rgba) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  const raiz = document.querySelector<HTMLElement>('[data-testid="site-negocio"]')!;
  const falhas: string[] = [];
  const indeterminados: string[] = [];
  let medidos = 0;
  let menor = 99;
  const walker = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
  const vistos = new Set<Element>();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    if (!el || vistos.has(el) || !(n.textContent ?? "").trim()) continue;
    vistos.add(el);
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (r.width === 0 || r.height === 0 || cs.visibility === "hidden" || cs.display === "none")
      continue;
    if (el.closest('[aria-hidden="true"]')) continue;
    // opacidade acumulada dos ancestrais
    let op = 1;
    for (let e: Element | null = el; e; e = e.parentElement)
      op *= Number(getComputedStyle(e).opacity);
    // fundo efetivo: sobe pelos ancestrais compondo cores; imagem/gradiente = indeterminado
    let fundo: Rgba = [0, 0, 0, 0];
    const camadas: Rgba[] = [];
    let indet = false;
    for (let e: Element | null = el; e; e = e.parentElement) {
      const s = getComputedStyle(e);
      if (s.backgroundImage !== "none") {
        indet = true;
        break;
      }
      const c = parse(s.backgroundColor);
      if (c[3] > 0) camadas.push(c);
      if (c[3] >= 1) break;
    }
    fundo = [255, 255, 255, 1];
    for (const c of camadas.reverse()) fundo = sobre(c, fundo);
    const rotulo = `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 30)} "${(n.textContent ?? "").trim().slice(0, 24)}"`;
    if (indet) {
      indeterminados.push(rotulo);
      continue;
    }
    let cor = parse(cs.color);
    cor = [cor[0], cor[1], cor[2], cor[3] * op];
    const fg = sobre(cor, fundo);
    const tam = parseFloat(cs.fontSize);
    const negrito = Number(cs.fontWeight) >= 700;
    const grande = tam >= 24 || (tam >= 18.66 && negrito);
    const minimo = grande ? 3 : 4.5;
    const v = razao(fg, fundo);
    medidos++;
    menor = Math.min(menor, v);
    if (v < minimo) falhas.push(`${rotulo} ${v.toFixed(2)}<${minimo}`);
  }
  // cards: dentro de cada lista/grade os cards devem ter a mesma altura e largura
  const tamanhos: string[] = [];
  const pais = new Set(Array.from(raiz.querySelectorAll(".st-card")).map((c) => c.parentElement!));
  pais.forEach((p) => {
    const cards = Array.from(p.children).filter(
      (c) => c.querySelector(".st-card") || c.matches(".st-card"),
    );
    const alvo = cards.map(
      (c) => (c.matches(".st-card") ? c : c.querySelector(".st-card")!) as HTMLElement,
    );
    const lis = cards.map((c) => c.getBoundingClientRect());
    // agrupar por linha (top)
    const linhas = new Map<number, DOMRect[]>();
    lis.forEach((r) => {
      const k = Math.round(r.top / 4);
      linhas.set(k, [...(linhas.get(k) ?? []), r]);
    });
    linhas.forEach((rs) => {
      const hs = new Set(rs.map((r) => Math.round(r.height)));
      if (hs.size > 1) tamanhos.push(`alturas diferentes na linha: ${[...hs].join(",")}`);
    });
    const ws = new Set(alvo.map((a) => Math.round(a.getBoundingClientRect().width)));
    if (ws.size > 1) tamanhos.push(`larguras diferentes: ${[...ws].join(",")}`);
  });
  const sobraH = document.documentElement.scrollWidth - document.documentElement.clientWidth;
  // elementos do site que ultrapassam a viewport
  const vazando: string[] = [];
  raiz.querySelectorAll<HTMLElement>("*").forEach((e) => {
    const r = e.getBoundingClientRect();
    if (r.width > 0 && (r.right > document.documentElement.clientWidth + 1 || r.left < -1)) {
      if (e.closest(".st-banner, .st-carrossel, [aria-hidden='true']")) return;
      if (vazando.length < 5)
        vazando.push(
          `${e.tagName.toLowerCase()}.${String(e.className).slice(0, 30)} ${Math.round(r.left)}..${Math.round(r.right)}`,
        );
    }
  });
  return {
    sobraH,
    vazando,
    falhas,
    indeterminados,
    medidos,
    menor,
    tamanhos,
    cards: raiz.querySelectorAll(".st-card").length,
    estilo: raiz.getAttribute("data-estilo"),
  };
}

test.describe("Fase 11: 20 estilos em 360px", () => {
  test("rolagem, contraste AA e cards iguais", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "Mede em 360px dentro de um único projeto.");
    test.setTimeout(600_000);
    exigirConta("dono");
    await page.setViewportSize({ width: 360, height: 800 });
    await entrar(page, "dono");
    const id = await idDoPerfil(page);
    const resumo: string[] = [];
    for (const estilo of ESTILOS) {
      await page.goto(`/meus-perfis/${id}/previa?estilo=${estilo}`);
      await page.waitForLoadState("load");
      await expect(page.getByTestId("site-negocio")).toHaveAttribute("data-estilo", estilo);
      await page.evaluate(() => document.fonts.ready);
      const m = await page.evaluate(medir);
      resumo.push(
        `${estilo}: sobraH=${m.sobraH} textos=${m.medidos} menor=${m.menor.toFixed(2)} falhas=${m.falhas.length} indet=${m.indeterminados.length} cards=${m.cards} tamanhos=${m.tamanhos.length}`,
      );
      if (m.falhas.length) resumo.push(`   FALHAS ${estilo}: ${m.falhas.slice(0, 8).join(" | ")}`);
      if (m.indeterminados.length)
        resumo.push(`   INDET ${estilo}: ${m.indeterminados.slice(0, 6).join(" | ")}`);
      if (m.tamanhos.length) resumo.push(`   CARDS ${estilo}: ${m.tamanhos.join(" | ")}`);
      if (m.vazando.length) resumo.push(`   VAZANDO ${estilo}: ${m.vazando.join(" | ")}`);
      expect.soft(m.sobraH, `${estilo}: rolagem horizontal`).toBeLessThanOrEqual(0);
      expect.soft(m.falhas, `${estilo}: contraste`).toEqual([]);
      expect.soft(m.tamanhos, `${estilo}: cards de tamanhos diferentes`).toEqual([]);
    }
    console.log(resumo.join("\n"));
  });

  test("id desconhecido na prévia não aplica estilo; público ignora ?estilo=", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "desktop", "Um projeto basta.");
    exigirConta("dono");
    await entrar(page, "dono");
    const id = await idDoPerfil(page);
    await page.goto(`/meus-perfis/${id}/previa?estilo=nao_existe`);
    await expect(page.getByTestId("site-negocio")).toHaveCount(0);
    await page.goto(`/meus-perfis/${id}/previa?estilo=moto_bike`);
    await expect(page.getByTestId("site-negocio")).toHaveCount(0);
  });
});
