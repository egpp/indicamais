import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

// Verificação independente do PR #35 (IM-101, D-023): contraste do ícone da Equipe medido em PIXELS reais (captura
// de tela a 360px) nos 22 estilos, na base e na faixa escura (.st-faixa-alt). Não depende de servidor nem de conta:
// monta a mesma marcação de site-negocio.tsx com o CSS real do site.
const RAIZ = join(process.cwd(), "src/app/_componentes/site");
const CSS = ["site.css", "site-estilos.css", "site-estilos-novos.css", "site-estilos-basico.css"]
  .map((f) => readFileSync(join(RAIZ, f), "utf8"))
  .join("\n");
const IDS = [
  ...readFileSync(join(RAIZ, "estilos.ts"), "utf8")
    .match(/IDS_ESTILOS = \[([\s\S]*?)\]/)![1]!
    .matchAll(/"([a-z_]+)"/g),
].map((m) => m[1]!);

const SVG = `<svg class="st-svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><path d="M12 7.5h.01"/></svg>`;

function lum([r, g, b]: number[]): number {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!);
}
function razao(a: number[], b: number[]): number {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

test.describe("PR #35: ícone da Equipe em pixels reais, 360px", () => {
  test.use({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 1 });
  test.skip(({ isMobile }) => !isMobile, "um só projeto basta (viewport fixo em 360px)");

  for (const id of IDS) {
    test(id, async ({ page }) => {
      await page.setContent(
        `<style>${CSS}</style><body style="margin:0"><div class="site site-${id}" data-estilo="${id}">
        ${["", " st-faixa-alt"]
          .map(
            (
              alt,
              i,
            ) => `<section class="st-faixa${alt}" id="s${i}"><div class="st-miolo"><ul class="st-equipe">
            <li id="li${i}"><span class="st-equipe-icone" id="ic${i}" aria-hidden="true">${SVG}</span><strong>Ana</strong><span>Cargo</span></li>
            </ul></div></section>`,
          )
          .join("")}</div></body>`,
      );
      for (const i of [0, 1]) {
        const ic = page.locator(`#ic${i}`);
        const caixa = (await ic.boundingBox())!;
        // quadrado do ícone mais 12px de margem: inclui o entorno (fundo do cartão)
        const m = 12;
        const png = await page.screenshot({
          fullPage: true,
          clip: {
            x: caixa.x - m,
            y: caixa.y - m,
            width: caixa.width + 2 * m,
            height: caixa.height + 2 * m,
          },
        });
        const b64 = png.toString("base64");
        const bgLi = await page
          .locator(`#li${i}`)
          .evaluate((e) => getComputedStyle(e).backgroundColor);
        const bgIc = await ic.evaluate((e) => getComputedStyle(e).backgroundColor);
        const r = await page.evaluate(async (dados) => {
          const img = new Image();
          img.src = `data:image/png;base64,${dados}`;
          await img.decode();
          const c = document.createElement("canvas");
          c.width = img.width;
          c.height = img.height;
          const x = c.getContext("2d")!;
          x.drawImage(img, 0, 0);
          const d = x.getImageData(0, 0, c.width, c.height).data;
          const px = (a: number, b: number) => [
            d[(b * c.width + a) * 4]!,
            d[(b * c.width + a) * 4 + 1]!,
            d[(b * c.width + a) * 4 + 2]!,
          ];
          return {
            w: c.width,
            h: c.height,
            px: Array.from({ length: c.height }, (_, b) =>
              Array.from({ length: c.width }, (_, a) => px(a, b)),
            ),
          };
        }, b64);
        const { w, h, px } = r;
        const cx = w / 2;
        const cy = h / 2;
        const rEx = caixa.width / 2;
        const lumDe = (p: number[]) => lum(p);
        // fora do círculo (canto da captura): fundo do cartão
        const fora = px[1]![1]!;
        // preenchimento do círculo: pixel a ~0,85 do raio, fora do traço do glifo (ângulo diagonal)
        const dentro = px[Math.round(cy - rEx * 0.8)]![Math.round(cx - rEx * 0.8)]!;
        // glifo: pixel mais distante (em luminância) do preenchimento dentro de 60% do raio
        let glifo = dentro;
        for (let yy = 0; yy < h; yy++)
          for (let xx = 0; xx < w; xx++) {
            if (Math.hypot(xx - cx, yy - cy) > rEx * 0.6) continue;
            const p = px[yy]![xx]!;
            if (Math.abs(lumDe(p) - lumDe(dentro)) > Math.abs(lumDe(glifo) - lumDe(dentro)))
              glifo = p;
          }
        // anel: pixel mais distante do preenchimento numa faixa de 2px ao redor do raio
        let anel = dentro;
        for (let yy = 0; yy < h; yy++)
          for (let xx = 0; xx < w; xx++) {
            const dd = Math.hypot(xx - cx, yy - cy);
            if (dd < rEx - 2.5 || dd > rEx + 0.5) continue;
            const p = px[yy]![xx]!;
            if (Math.abs(lumDe(p) - lumDe(dentro)) > Math.abs(lumDe(anel) - lumDe(dentro)))
              anel = p;
          }
        const gDentro = razao(glifo, dentro);
        const aFora = razao(anel, fora);
        const aLi = razao(anel, dentro); // o cartão (li) tem o mesmo fundo do círculo: este é o contraste real do contorno
        console.log(
          `${id}${i ? " [faixa escura]" : " [base]"} glifo/fundo=${gDentro.toFixed(2)} anel/secao=${aFora.toFixed(2)} anel/cartao=${aLi.toFixed(2)} dentro=${dentro} fora=${fora} liBg=${bgLi} icBg=${bgIc}`,
        );
        // ícone decorativo: meta de 3:1 do glifo sobre o círculo e do anel sobre o cartão (WCAG 1.4.11)
        expect(gDentro, `${id} glifo/fundo (i=${i})`).toBeGreaterThanOrEqual(3);
        expect(aFora, `${id} anel/secao (i=${i})`).toBeGreaterThanOrEqual(3);
        expect(aLi, `${id} anel/cartao (i=${i})`).toBeGreaterThanOrEqual(3);
      }
    });
  }
});
