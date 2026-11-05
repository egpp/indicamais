import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MENSAGENS_COMISSOES, mapearErroBancoComissoes } from "./erros";

// Trava o texto da recusa no banco (P0001) ao mapeamento amigável: se a migração mudar a frase,
// este teste falha em vez de a tela voltar à mensagem genérica em silêncio (IM-064, IM-073).
describe("recusa de competência posterior ao cancelamento: texto da migração x mapeamento", () => {
  const sql = readFileSync(
    join(process.cwd(), "supabase/migrations/20261105120000_comissoes_fluxo.sql"),
    "utf8",
  );
  const m =
    /raise exception '(assinatura cancelada antes desta compet[^']*)' using errcode = 'P0001'/i.exec(
      sql,
    );

  it("a migração levanta P0001 com o texto esperado", () => {
    expect(m).not.toBeNull();
  });

  it("o texto exato da migração vira a mensagem amigável, sem vazar o texto do banco", () => {
    const e = mapearErroBancoComissoes({ code: "P0001", message: m![1] });
    expect(e.mensagem).toBe(MENSAGENS_COMISSOES.assinaturaCanceladaAntes);
    expect(e.mensagem).not.toContain(m![1]);
  });
});
