import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { formulario } from "../../../tests/suporte/bancos-memoria";
import {
  criarMundoIndicacoes,
  type Usuario,
} from "../../../tests/suporte/banco-indicacoes-memoria";
import { criarMundoPublico } from "../../../tests/suporte/bancos-publicos-memoria";
import { definirParametroContatoAdmin } from "./tratadores-indicacoes";

/** Tela "Limites do contato" (D-034 item 1, IM-076, IM-086): tratador da ação. */
function cenario(usuario: Usuario) {
  const mundo = criarMundoIndicacoes({ usuario });
  mundo.parametros.push({
    chave: "contato_recusar_excesso",
    valor: 0,
    minimo: 0,
    maximo: 1,
    descricao: "Interruptor.",
    atualizado_em: "2026-11-06T12:00:00Z",
  });
  return { mundo, ctx: mundo.contexto(criarMundoPublico().contexto().leitura) };
}

const base = {
  chave: "contato_recusar_excesso",
  valor: "1",
  motivo: "Turnstile já está no ar",
  confirmo: "sim",
};

describe("definirParametroContatoAdmin", () => {
  it("administrador liga o interruptor: grava e limpa o motivo", async () => {
    const { ctx, mundo } = cenario({ id: randomUUID(), admin: true });
    const r = await definirParametroContatoAdmin(ctx, formulario(base));
    expect(r.sucesso).toBe("Limite do contato atualizado.");
    expect(r.valores?.motivo).toBe("");
    expect(mundo.definicoes).toEqual([
      { chave: "contato_recusar_excesso", valor: 1, motivo: "Turnstile já está no ar" },
    ]);
  });

  it("usuário comum recusado, nada chega ao banco", async () => {
    const { ctx, mundo } = cenario({ id: randomUUID() });
    const r = await definirParametroContatoAdmin(ctx, formulario(base));
    expect(r.erro).toBe("Você não tem permissão para esta ação.");
    expect(mundo.definicoes).toHaveLength(0);
  });

  it("motivo curto, valor fora da faixa, texto e chave não permitida: mensagens em português, sem gravar", async () => {
    const { ctx, mundo } = cenario({ id: randomUUID(), admin: true });
    const curto = await definirParametroContatoAdmin(ctx, formulario({ ...base, motivo: "curto" }));
    expect(curto.erros?.motivo).toBe("O motivo deve ter ao menos 10 caracteres.");
    const faixa = await definirParametroContatoAdmin(ctx, formulario({ ...base, valor: "2" }));
    expect(faixa.erros?.valor).toBe("Informe um valor entre 0 e 1.");
    const texto = await definirParametroContatoAdmin(ctx, formulario({ ...base, valor: "abc" }));
    expect(texto.erros?.valor).toBe("Informe um número inteiro.");
    const chave = await definirParametroContatoAdmin(
      ctx,
      formulario({ ...base, chave: "contato_limite_por_hora" }),
    );
    expect(chave.erro).toBe("Este parâmetro não pode ser alterado aqui.");
    expect(mundo.definicoes).toHaveLength(0);
  });

  it("ligar sem confirmo é recusado no servidor e não chega ao banco", async () => {
    const { ctx, mundo } = cenario({ id: randomUUID(), admin: true });
    const semConfirmo = Object.fromEntries(Object.entries(base).filter(([k]) => k !== "confirmo"));
    const r = await definirParametroContatoAdmin(ctx, formulario(semConfirmo));
    expect(r.erros?.confirmo).toBe("Confirme que o Turnstile está no ar antes de ligar a recusa.");
    const errado = await definirParametroContatoAdmin(ctx, formulario({ ...base, confirmo: "on" }));
    expect(errado.erros?.confirmo).toBeTruthy();
    expect(mundo.definicoes).toHaveLength(0);
  });

  it("desligar sem confirmo grava", async () => {
    const { ctx, mundo } = cenario({ id: randomUUID(), admin: true });
    const semConfirmo = Object.fromEntries(Object.entries(base).filter(([k]) => k !== "confirmo"));
    const r = await definirParametroContatoAdmin(ctx, formulario({ ...semConfirmo, valor: "0" }));
    expect(r.sucesso).toBe("Limite do contato atualizado.");
    expect(mundo.definicoes).toHaveLength(1);
  });
});
