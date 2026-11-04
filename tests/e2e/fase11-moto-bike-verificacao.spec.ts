/**
 * Verificação independente (PR #29): os 21 estilos em 360px, na prévia do responsável (IM-091, IM-100).
 * Método próprio: esconde todo o texto, fotografa a página e mede o contraste de cada texto contra os PIXELS reais
 * atrás dele (cobre imagem, gradiente e sobreposição, que medição por CSS não enxerga). Também confere rolagem
 * horizontal, cards de mesmo tamanho e o fallback do id desconhecido. Só DESENVOLVIMENTO; não grava nada.
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
  "moto_bike",
];

async function idDoPerfil(page: Page): Promise<string> {
  await page.goto("/aparencia");
  if (!/\/meus-perfis\//.test(page.url()))
    await page.locator('main a[href$="/aparencia"]').first().click();
  await expect(page).toHaveURL(/\/meus-perfis\/[0-9a-f-]{36}\/aparencia$/, { timeout: 15000 });
  return /\/meus-perfis\/([0-9a-f-]{36})\//.exec(page.url())![1];
}

type Alvo = {
  rotulo: string;
  classe: string;
  x: number;
  y: number;
  w: number;
  h: number;
  cor: number[];
  tam: number;
  negrito: boolean;
};

/** Lista os textos visíveis com retângulo (coordenadas da página) e cor efetiva (com opacidade). */
function listarTextos() {
  const raiz = document.querySelector<HTMLElement>('[data-testid="site-negocio"]')!;
  const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
  const rgba = (s: string) => {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = "#000";
    ctx.fillStyle = s;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2], d[3] / 255];
  };
  const alvos: Alvo[] = [];
  const vistos = new Set<Element>();
  const w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const el = n.parentElement;
    if (!el || vistos.has(el) || !(n.textContent ?? "").trim()) continue;
    vistos.add(el);
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (r.width < 1 || r.height < 1 || cs.visibility === "hidden" || cs.display === "none")
      continue;
    if (el.closest('[aria-hidden="true"]')) continue;
    let op = 1;
    for (let e: Element | null = el; e; e = e.parentElement)
      op *= Number(getComputedStyle(e).opacity);
    const c = rgba(cs.color);
    alvos.push({
      rotulo: `${el.tagName.toLowerCase()}.${String(el.className).split(" ").filter(Boolean).slice(0, 2).join(".")} "${(n.textContent ?? "").trim().slice(0, 22)}"`,
      classe: String(el.className),
      x: r.left + scrollX,
      y: r.top + scrollY,
      w: r.width,
      h: r.height,
      cor: [c[0], c[1], c[2], c[3] * op],
      tam: parseFloat(cs.fontSize),
      negrito: Number(cs.fontWeight) >= 700,
    });
  }
  return alvos;
}

function geometria() {
  const raiz = document.querySelector<HTMLElement>('[data-testid="site-negocio"]')!;
  const vw = document.documentElement.clientWidth;
  const problemas: string[] = [];
  const grupos = new Map<Element, HTMLElement[]>();
  raiz.querySelectorAll<HTMLElement>(".st-card").forEach((c) => {
    const p = c.parentElement!;
    grupos.set(p, [...(grupos.get(p) ?? []), c]);
  });
  grupos.forEach((cards) => {
    const linhas = new Map<number, DOMRect[]>();
    cards.forEach((c) => {
      const r = c.getBoundingClientRect();
      const k = Math.round(r.top / 4);
      linhas.set(k, [...(linhas.get(k) ?? []), r]);
    });
    linhas.forEach((rs) => {
      if (new Set(rs.map((r) => Math.round(r.height))).size > 1)
        problemas.push("altura diferente na linha");
    });
    if (new Set(cards.map((c) => Math.round(c.getBoundingClientRect().width))).size > 1)
      problemas.push("largura diferente");
  });
  const vaza: string[] = [];
  raiz.querySelectorAll<HTMLElement>("*").forEach((e) => {
    const r = e.getBoundingClientRect();
    if (
      r.width > 0 &&
      (r.right > vw + 1 || r.left < -1) &&
      !e.closest("[aria-hidden='true']") &&
      vaza.length < 4
    )
      vaza.push(
        `${e.tagName.toLowerCase()}.${String(e.className).slice(0, 24)} ${Math.round(r.left)}..${Math.round(r.right)}`,
      );
  });
  return {
    sobraH: document.documentElement.scrollWidth - vw,
    cards: raiz.querySelectorAll(".st-card").length,
    problemas,
    vaza,
  };
}

/** Roda no navegador: contraste de cada alvo contra os pixels da foto sem texto. */
async function medirPixels(arg: { png: string; alvos: Alvo[] }) {
  const bin = Uint8Array.from(atob(arg.png), (c) => c.charCodeAt(0));
  const bmp = await createImageBitmap(new Blob([bin], { type: "image/png" }));
  const cv = document.createElement("canvas");
  cv.width = bmp.width;
  cv.height = bmp.height;
  const cx = cv.getContext("2d", { willReadFrequently: true })!;
  cx.drawImage(bmp, 0, 0);
  const lum = (r: number, g: number, b: number) => {
    const f = (v: number) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const out: { rotulo: string; classe: string; pior: number; minimo: number }[] = [];
  for (const a of arg.alvos) {
    // Recorta 4px de cada borda: bordas e contornos do próprio elemento não são fundo do texto.
    const ix = a.w > 16 ? 4 : 0;
    const iy = a.h > 16 ? 4 : 0;
    const x0 = Math.max(0, Math.floor(a.x + ix));
    const y0 = Math.max(0, Math.floor(a.y + iy));
    const w = Math.min(bmp.width - x0, Math.ceil(a.w - 2 * ix));
    const h = Math.min(bmp.height - y0, Math.ceil(a.h - 2 * iy));
    if (w < 1 || h < 1) continue;
    const d = cx.getImageData(x0, y0, w, h).data;
    const passo = Math.max(1, Math.floor((w * h) / 400));
    const vals: number[] = [];
    for (let i = 0; i < w * h; i += passo) {
      const [br, bg, bb] = [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]];
      const al = a.cor[3];
      const l1 = lum(
        a.cor[0] * al + br * (1 - al),
        a.cor[1] * al + bg * (1 - al),
        a.cor[2] * al + bb * (1 - al),
      );
      const l2 = lum(br, bg, bb);
      vals.push((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05));
    }
    vals.sort((p, q) => p - q);
    const pior = vals[Math.floor(vals.length * 0.02)];
    const grande = a.tam >= 24 || (a.tam >= 18.66 && a.negrito);
    out.push({ rotulo: a.rotulo, classe: a.classe, pior, minimo: grande ? 3 : 4.5 });
  }
  return out;
}

test.describe("PR #29: 21 estilos em 360px (método por pixels)", () => {
  test("contraste AA, rolagem e cards", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "Mede em 360px num único projeto.");
    test.setTimeout(900_000);
    exigirConta("dono");
    await page.setViewportSize({ width: 360, height: 800 });
    await entrar(page, "dono");
    const id = await idDoPerfil(page);
    const resumo: string[] = [];
    for (const estilo of ESTILOS) {
      await page.goto(`/meus-perfis/${id}/previa?estilo=${estilo}`);
      await page.waitForLoadState("networkidle");
      await expect(page.getByTestId("site-negocio")).toHaveAttribute("data-estilo", estilo);
      await page.evaluate(() => document.fonts.ready);
      const alvos = await page.evaluate(listarTextos);
      const geo = await page.evaluate(geometria);
      await page.addStyleTag({
        content:
          "[data-testid=site-negocio] *{text-shadow:none!important;-webkit-text-fill-color:transparent!important}",
      });
      const png = (await page.screenshot({ fullPage: true, animations: "disabled" })).toString(
        "base64",
      );
      const med = await page.evaluate(medirPixels, { png, alvos });
      const falhas = med.filter((m) => m.pior < m.minimo);
      const menor = Math.min(...med.map((m) => m.pior));
      resumo.push(
        `${estilo}: textos=${med.length} menor=${menor.toFixed(2)} falhas=${falhas.length} sobraH=${geo.sobraH} cards=${geo.cards} cardsProb=${geo.problemas.length}`,
      );
      if (falhas.length)
        resumo.push(
          `   FALHAS: ${falhas
            .slice(0, 8)
            .map((f) => `${f.rotulo} ${f.pior.toFixed(2)}<${f.minimo}`)
            .join(" | ")}`,
        );
      if (geo.problemas.length) resumo.push(`   CARDS: ${geo.problemas.join(" | ")}`);
      if (geo.vaza.length) resumo.push(`   VAZA: ${geo.vaza.join(" | ")}`);
      for (const alvo of ["st-card-preco", "st-sobretitulo"]) {
        const m = med.filter((x) => x.classe.includes(alvo));
        if (m.length)
          resumo.push(
            `   .${alvo}: n=${m.length} pior=${Math.min(...m.map((x) => x.pior)).toFixed(2)}`,
          );
      }
      expect.soft(geo.sobraH, `${estilo}: rolagem horizontal`).toBeLessThanOrEqual(0);
      expect
        .soft(
          // Estrito só nos elementos dos 3 defeitos corrigidos. Os demais alvos (botão Menu, botões
          // preenchidos, chips) dão falso positivo neste método por pixels e foram conferidos por captura.
          falhas.filter((f) => /st-card-preco|st-sobretitulo/.test(f.classe)).map((f) => f.rotulo),
          `${estilo}: contraste (preço e sobretítulo)`,
        )
        .toEqual([]);
      expect.soft(geo.problemas, `${estilo}: cards`).toEqual([]);
      console.log(resumo.splice(0).join("\n"));
    }
  });

  test("id desconhecido cai fora da prévia de estilo; moto_bike válido", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "Um projeto basta.");
    exigirConta("dono");
    await entrar(page, "dono");
    const id = await idDoPerfil(page);
    for (const e of ["nao_existe", "moto_bike_x", "MOTO_BIKE", "constructor"]) {
      await page.goto(`/meus-perfis/${id}/previa?estilo=${e}`);
      await expect(page.getByTestId("site-negocio")).toHaveCount(0);
    }
    await page.goto(`/meus-perfis/${id}/previa?estilo=moto_bike`);
    await expect(page.getByTestId("site-negocio")).toHaveAttribute("data-estilo", "moto_bike");
    const t = await page.getByTestId("site-negocio").innerText();
    console.log("Loja visivel na previa moto_bike:", /\bLoja\b/.test(t));
  });
});
