import { describe, expect, it } from "vitest";
import { COLUNAS_AVISOS, criarBancoAvisos } from "./banco-notificacoes-app";

function falso(resposta: { data?: unknown; error?: unknown } = {}, lancar = false) {
  const chamadas: { rpc: [string, unknown][]; selects: [string, string][] } = {
    rpc: [],
    selects: [],
  };
  const pronto = () => {
    if (lancar) throw new Error("rede caiu: segredo-interno");
    return { data: resposta.data ?? null, error: resposta.error ?? null };
  };
  const cliente = {
    rpc: (nome: string, args: unknown) => {
      chamadas.rpc.push([nome, args]);
      return { then: (res: (v: unknown) => unknown) => Promise.resolve(pronto()).then(res) };
    },
    from: (tabela: string) => ({
      select: (colunas: string) => {
        chamadas.selects.push([tabela, colunas]);
        return { then: (res: (v: unknown) => unknown) => Promise.resolve(pronto()).then(res) };
      },
    }),
  };
  return { cliente: cliente as never, chamadas };
}

const ID = "11111111-1111-4111-8111-111111111111";

describe("adaptador do banco de avisos (sessão do usuário)", () => {
  it("lê as visões certas com colunas nomeadas e sem coluna de conta", async () => {
    const { cliente, chamadas } = falso({ data: [] });
    const banco = criarBancoAvisos(cliente);
    await banco.listarMeusAvisos();
    await banco.listarQuemMeIndicou();
    await banco.listarMinhasIndicacoes();
    expect(chamadas.selects.map((s) => s[0])).toEqual([
      "notificacoes_meus_avisos",
      "notificacoes_quem_me_indicou",
      "indicacoes_minhas_indicacoes",
    ]);
    for (const colunas of Object.values(COLUNAS_AVISOS)) {
      expect(colunas).not.toContain("*");
      for (const proibida of ["conta_id", "whatsapp_e164", "email", "nome,", "mensagem"]) {
        expect(colunas.split(", ")).not.toContain(proibida);
      }
    }
  });

  it("chama as RPCs de leitura com os parâmetros certos", async () => {
    const { cliente, chamadas } = falso({ data: 1 });
    const banco = criarBancoAvisos(cliente);
    await banco.contarNaoLidas();
    await banco.marcarLida({ origem: "curtida", origemId: ID });
    await banco.marcarTodasLidas();
    expect(chamadas.rpc).toEqual([
      ["notificacoes_contar_nao_lidas", undefined],
      ["notificacoes_marcar_lida", { p_origem: "curtida", p_origem_id: ID }],
      ["notificacoes_marcar_todas_lidas", undefined],
    ]);
  });

  it("repassa só o código do erro e converte exceção em erro desconhecido", async () => {
    const a = falso({ error: { code: "P0002", message: "texto" } });
    const r = await criarBancoAvisos(a.cliente).marcarLida({ origem: "curtida", origemId: ID });
    expect(r.erro?.code).toBe("P0002");
    const b = falso({}, true);
    const r2 = await criarBancoAvisos(b.cliente).contarNaoLidas();
    expect(r2.erro).toEqual({ code: "XX000" });
    expect(JSON.stringify(r2)).not.toContain("segredo-interno");
  });
});
