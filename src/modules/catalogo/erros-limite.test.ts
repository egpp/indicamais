import { describe, expect, it } from "vitest";
import { mapearErroBancoCatalogo } from "./index";

const teto = (chave: string, limite = "limite=3") => ({
  code: "P0430",
  message: `teto_atingido:${chave}`,
  details: limite,
});

describe("teto de criação de item e anúncio (D-035, IM-006, IM-015)", () => {
  it("itens por site", () => {
    const r = mapearErroBancoCatalogo(teto("tetos_itens_por_perfil", "limite=30"));
    expect(r.codigo).toBe("LIMITE_CONTA");
    expect(r.mensagem).toBe(
      "Este site atingiu o limite de 30 itens. Para cadastrar outro, fale com o suporte.",
    );
  });

  it("anúncios particulares", () => {
    const r = mapearErroBancoCatalogo(teto("tetos_anuncios_particulares", "limite=10"));
    expect(r.codigo).toBe("LIMITE_CONTA");
    expect(r.mensagem).toBe(
      "Você atingiu o limite de 10 anúncios particulares por conta. Para criar outro, fale com o suporte.",
    );
  });

  it("rascunhos abertos", () => {
    const r = mapearErroBancoCatalogo(teto("tetos_rascunhos_abertos", "limite=10"));
    expect(r.codigo).toBe("LIMITE_CONTA");
    expect(r.mensagem).toContain("10 rascunhos abertos");
  });

  it("nenhuma mensagem promete exclusão", () => {
    for (const c of [
      "tetos_itens_por_perfil",
      "tetos_anuncios_particulares",
      "tetos_rascunhos_abertos",
    ]) {
      expect(mapearErroBancoCatalogo(teto(c)).mensagem).not.toMatch(/exclu|apag|arquiv|remov/i);
    }
  });

  it("sem detail: sem número; chave de site ou desconhecida: genérica, sem texto do banco", () => {
    expect(mapearErroBancoCatalogo(teto("tetos_itens_por_perfil", "")).mensagem).toBe(
      "Este site atingiu o limite de itens. Para cadastrar outro, fale com o suporte.",
    );
    for (const chave of ["tetos_perfis_por_conta", "chave_estranha"]) {
      const r = mapearErroBancoCatalogo({
        code: "P0430",
        message: `teto_atingido:${chave} segredo-interno`,
        details: "limite=3",
      });
      expect(r.codigo).toBe("LIMITE_CONTA");
      expect(r.mensagem).not.toMatch(/segredo|teto_atingido|tetos_/);
    }
  });
});
