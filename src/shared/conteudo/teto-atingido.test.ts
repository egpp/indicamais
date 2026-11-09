import { describe, expect, it } from "vitest";
import { lerTetoAtingido } from "./erros-banco";

const e = (message: string, details = "limite=3", code = "P0430") => ({ code, message, details });

describe("lerTetoAtingido (D-035)", () => {
  it("lê chave e limite das quatro chaves conhecidas", () => {
    for (const chave of [
      "tetos_perfis_por_conta",
      "tetos_itens_por_perfil",
      "tetos_anuncios_particulares",
      "tetos_rascunhos_abertos",
    ]) {
      expect(lerTetoAtingido(e(`teto_atingido:${chave}`, "limite=7"))).toEqual({
        chave,
        limite: 7,
      });
    }
  });

  it("outro SQLSTATE nunca é teto, mesmo com a mesma mensagem", () => {
    expect(lerTetoAtingido(e("teto_atingido:tetos_perfis_por_conta", "limite=3", "P0001"))).toBe(
      null,
    );
  });

  it("chave desconhecida ou mensagem estranha: null", () => {
    expect(lerTetoAtingido(e("teto_atingido:outra_coisa"))).toBe(null);
    expect(lerTetoAtingido(e("erro com texto do banco"))).toBe(null);
    expect(lerTetoAtingido({ code: "P0430" })).toBe(null);
  });

  it("limite ausente, zero ou malformado vira null (mensagem sai sem número)", () => {
    expect(lerTetoAtingido(e("teto_atingido:tetos_perfis_por_conta", ""))?.limite).toBe(null);
    expect(lerTetoAtingido(e("teto_atingido:tetos_perfis_por_conta", "limite=0"))?.limite).toBe(
      null,
    );
    expect(
      lerTetoAtingido(e("teto_atingido:tetos_perfis_por_conta", "limite=<script>"))?.limite,
    ).toBe(null);
  });
});
