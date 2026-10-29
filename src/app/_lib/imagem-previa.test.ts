import { beforeEach, describe, expect, it } from "vitest";
import {
  CAMINHO_PUBLICO,
  SEGREDOS,
  criarMundoPublico,
  type MundoPublico,
} from "../../../tests/suporte/bancos-publicos-memoria";
import { IMAGEM_PADRAO, imagemPreviaItem, imagemPreviaPerfil } from "./imagem-previa";

let m: MundoPublico;
beforeEach(() => {
  m = criarMundoPublico();
});

function conferirSeguro(r: Response) {
  expect(r.headers.get("X-Robots-Tag")).toContain("noindex");
  const tudo = JSON.stringify([...r.headers.entries()]);
  for (const s of Object.values(SEGREDOS)) expect(tudo).not.toContain(s);
  expect(tudo).not.toMatch(/owner/i);
}

describe("imagem estável de prévia (IM-079, IM-029)", () => {
  it("perfil publicado: 302 para a URL assinada gerada agora, com cache curto e noindex", async () => {
    const p = m.novoPerfil({ nome: "Padaria", slug: "padaria" });
    const r = await imagemPreviaPerfil(m.contexto(), "padaria");
    expect(r.status).toBe(302);
    expect(r.headers.get("Location")).toBe(`${CAMINHO_PUBLICO}${p.imagem_path}`);
    expect(r.headers.get("Cache-Control")).toMatch(/max-age=300/);
    conferirSeguro(r);
  });

  it("item publicado: 302 para a URL assinada", async () => {
    const i = m.novoItem({ nome: "Bike", tipo: "produto" });
    const r = await imagemPreviaItem(m.contexto(), i.id);
    expect(r.status).toBe(302);
    expect(r.headers.get("Location")).toBe(`${CAMINHO_PUBLICO}${i.foto_path}`);
    conferirSeguro(r);
  });

  it("sem imagem: usa a imagem padrão estática", async () => {
    m.novoPerfil({ nome: "Sem", slug: "sem", imagem_path: null });
    const i = m.novoItem({ nome: "Sem foto", tipo: "servico", foto_path: null });
    for (const r of [
      await imagemPreviaPerfil(m.contexto(), "sem"),
      await imagemPreviaItem(m.contexto(), i.id),
    ]) {
      expect(r.status).toBe(302);
      expect(r.headers.get("Location")).toBe(IMAGEM_PADRAO);
    }
  });

  it("404 genérico: inexistente, não aprovado, não publicado e entrada inválida", async () => {
    m.novoPerfil({ nome: "A", slug: "a", aprovado: false });
    m.novoPerfil({ nome: "B", slug: "b", publicado: false });
    const i1 = m.novoItem({ nome: "I1", tipo: "produto", aprovado: false });
    const i2 = m.novoItem({ nome: "I2", tipo: "produto", publicado: false });
    const respostas = [
      await imagemPreviaPerfil(m.contexto(), "a"),
      await imagemPreviaPerfil(m.contexto(), "b"),
      await imagemPreviaPerfil(m.contexto(), "nao-existe"),
      await imagemPreviaPerfil(m.contexto(), "../../etc/passwd"),
      await imagemPreviaPerfil(m.contexto(), "perfil/x/y.webp"),
      await imagemPreviaItem(m.contexto(), i1.id),
      await imagemPreviaItem(m.contexto(), i2.id),
      await imagemPreviaItem(m.contexto(), "00000000-0000-4000-8000-000000000000"),
      await imagemPreviaItem(m.contexto(), "id-invalido"),
      await imagemPreviaItem(m.contexto(), "perfil/x/y.webp"),
    ];
    for (const r of respostas) {
      expect(r.status).toBe(404);
      expect(r.headers.get("Location")).toBeNull();
      expect(await r.text()).toBe("Não encontrado");
      conferirSeguro(r);
    }
  });
});
