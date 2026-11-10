import { describe, expect, it } from "vitest";
import { mapearErroBancoPerfis } from "./index";

const teto = (chave: string, limite = "limite=3") => ({
  code: "P0430",
  message: `teto_atingido:${chave}`,
  details: limite,
});

describe("teto de criação de perfil (D-035, IM-006, IM-015)", () => {
  it("perfis por conta: mensagem com o limite vigente e sem prometer exclusão", () => {
    const r = mapearErroBancoPerfis(teto("tetos_perfis_por_conta", "limite=5"));
    expect(r.codigo).toBe("LIMITE_CONTA");
    expect(r.mensagem).toBe(
      "Você atingiu o limite de 5 perfis comerciais por conta. Para criar outro, fale com o suporte.",
    );
    expect(r.mensagem).not.toMatch(/exclu|apag|arquiv|remov/i);
  });

  it("limite 1 usa o singular", () => {
    expect(mapearErroBancoPerfis(teto("tetos_perfis_por_conta", "limite=1")).mensagem).toContain(
      "limite de 1 perfil comercial por conta",
    );
  });

  it("rascunhos abertos: orienta enviar para aprovação, sem prometer exclusão", () => {
    const r = mapearErroBancoPerfis(teto("tetos_rascunhos_abertos", "limite=10"));
    expect(r.codigo).toBe("LIMITE_CONTA");
    expect(r.mensagem).toContain("10 rascunhos abertos");
    expect(r.mensagem).not.toMatch(/exclu|apag|arquiv|remov/i);
  });

  it("sem detail: mensagem sem número", () => {
    const r = mapearErroBancoPerfis(teto("tetos_perfis_por_conta", ""));
    expect(r.mensagem).toBe(
      "Você atingiu o limite de perfis comerciais por conta. Para criar outro, fale com o suporte.",
    );
  });

  it("chave de outro módulo ou desconhecida: mensagem genérica de limite, nunca o texto do banco", () => {
    for (const chave of ["tetos_itens_por_perfil", "chave_estranha"]) {
      const r = mapearErroBancoPerfis({
        code: "P0430",
        message: `teto_atingido:${chave} segredo-interno`,
        details: "limite=3 segredo-interno",
      });
      expect(r.codigo).toBe("LIMITE_CONTA");
      expect(r.mensagem).not.toMatch(/segredo|teto_atingido|tetos_/);
    }
  });
});
