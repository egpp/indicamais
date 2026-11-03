import { test, type Page } from "@playwright/test";
import { entrar, exigirConta, type Papel } from "./contas";
const ID = "29b227e0-13da-4050-8d2c-8a89df163cbf";
async function dump(page: Page, url: string) {
  const r = await page.goto(url);
  const d = await page.evaluate(() => {
    const t = (e: Element) => (e.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
    return {
      h: [...document.querySelectorAll("main h1,main h2,main h3,main li.cartao p")].map(t),
      campos: [...document.querySelectorAll("main input,main select,main textarea")].map((e) => {
        const i = e as HTMLInputElement;
        const l = i.labels?.[0] ? t(i.labels[0]) : i.getAttribute("aria-label") ?? "";
        return `${i.tagName.toLowerCase()}[${i.type}|${i.name}] "${l}"${i.tagName === "SELECT" ? " opts=" + [...(e as HTMLSelectElement).options].map((o) => o.value + ":" + t(o)).join(",") : ""}`;
      }),
      botoes: [...document.querySelectorAll("main button,main a.botao")].map(t),
    };
  });
  console.log(`### ${url} -> ${r?.status()}\n` + JSON.stringify(d, null, 1));
}
const PLANO: [Papel, string[]][] = JSON.parse(process.env.EXPLORAR ?? "[]");
test("explorar", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  test.setTimeout(240000);
  for (const [p, urls] of PLANO) {
    exigirConta(p);
    await page.context().clearCookies();
    await entrar(page, p);
    for (const u of urls) await dump(page, u.replace("{ID}", ID));
  }
});
