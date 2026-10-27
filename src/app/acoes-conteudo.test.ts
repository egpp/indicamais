import { beforeEach, describe, expect, it, vi } from "vitest";
import { criarMundo, formulario, type Mundo } from "../../tests/suporte/bancos-memoria";
import type { Contexto } from "./_lib/contexto";

let contextoAtual: Contexto;
const obterContexto = vi.fn(async (voltarPara: string) => {
  void voltarPara;
  return contextoAtual;
});
const revalidatePath = vi.fn();

vi.mock("./_lib/contexto-sessao", () => ({
  obterContexto: (v: string) => obterContexto(v),
}));
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

import {
  acaoCriarCategoria,
  acaoCriarPerfil,
  acaoDecidirRevisao,
  acaoEnviarPerfil,
} from "./acoes-conteudo";

const ANA = "3f8a7c1e-5b2d-4e9a-8c6f-1a2b3c4d5e6f";
let m: Mundo;

beforeEach(() => {
  vi.clearAllMocks();
  m = criarMundo({ administradores: [] });
  contextoAtual = m.contexto(ANA);
});

describe("Server Actions de conteúdo", () => {
  it("criar perfil: redireciona para a tela do perfil e atualiza as telas", async () => {
    const f = formulario({
      nome: "Padaria",
      descricaoBreve: "Pães",
      cidade: "Canoas",
      uf: "RS",
      whatsappComercial: "(51) 98123-7661",
      categoriaPrincipalId: m.categorias[0]!.id,
    });
    await expect(acaoCriarPerfil({}, f)).rejects.toThrow(
      /^REDIRECT:\/meus-perfis\/[0-9a-f-]{36}\?aviso=criado$/,
    );
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
    expect(obterContexto).toHaveBeenCalledWith("/meus-perfis/novo");
  });

  it("erro de validação volta ao formulário com os valores e sem redirecionar", async () => {
    const r = await acaoCriarPerfil({}, formulario({ nome: "Padaria", whatsappComercial: "" }));
    expect(r.erros?.whatsappComercial).toBe("Informe o WhatsApp comercial.");
    expect(r.valores?.nome).toBe("Padaria");
    expect("destino" in r).toBe(false);
  });

  it("ação sobre perfil que não é seu responde 'não encontrado'", async () => {
    const r = await acaoEnviarPerfil(
      {},
      formulario({ id: "3f8a7c1e-5b2d-4e9a-8c6f-000000000000" }),
    );
    expect(r.erro).toBe("Perfil não encontrado.");
  });

  it("ações de administrador respondem permissão negada a quem não é administrador", async () => {
    expect((await acaoCriarCategoria({}, formulario({ nome: "Pets" }))).erro).toBe(
      "Esta ação é restrita a administradores.",
    );
    const d = await acaoDecidirRevisao(
      {},
      formulario({ decisao: "aprovar", alvo: "perfil", versaoId: ANA }),
    );
    expect(d.erro).toBe("Esta ação é restrita a administradores.");
  });
});
