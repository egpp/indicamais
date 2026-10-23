import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = {
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  signInWithOAuth: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  resend: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
  getUser: vi.fn(),
};
const consultaConta = vi.fn();

vi.mock("@/shared/supabase/servidor", () => ({
  criarClienteServidor: async () => ({
    auth,
    from: () => {
      const b: Record<string, unknown> = {};
      for (const m of ["select", "update", "eq"]) b[m] = () => b;
      b.maybeSingle = consultaConta;
      return b;
    },
  }),
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: "localhost:3000" }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

import {
  MENSAGEM_CONFIRMACAO_REENVIADA,
  MENSAGEM_LOGIN_INVALIDO,
  MENSAGEM_RECUPERACAO_SOLICITADA,
  MENSAGEM_WHATSAPP_INDISPONIVEL,
} from "@/modules/contas";
import {
  atualizarWhatsapp,
  cadastrar,
  entrar,
  entrarComGoogle,
  reenviarConfirmacao,
  solicitarRecuperacao,
} from "./acoes-conta";
import { MENSAGEM_CADASTRO_ENVIADO, MENSAGEM_GOOGLE_INDISPONIVEL } from "./_lib/mensagens-auth";

const form = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  auth.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
});

describe("IM-008 mensagens neutras", () => {
  it("login inválido: mensagem genérica do módulo", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: { code: "invalid_credentials" } });
    const r = await entrar({}, form({ email: "a@b.com", senha: "x" }));
    expect(r.erro).toBe(MENSAGEM_LOGIN_INVALIDO);
  });

  it("login válido redireciona só para caminho interno", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: null });
    await expect(
      entrar({}, form({ email: "a@b.com", senha: "x", proximo: "//evil.com" })),
    ).rejects.toThrow("REDIRECT:/minha-conta");
  });

  it("recuperação: mesma resposta mesmo se o Auth falhar ou lançar", async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ error: { code: "user_not_found" } });
    expect((await solicitarRecuperacao({}, form({ email: "a@b.com" }))).sucesso).toBe(
      MENSAGEM_RECUPERACAO_SOLICITADA,
    );
    auth.resetPasswordForEmail.mockRejectedValue(new Error("rede"));
    expect((await solicitarRecuperacao({}, form({ email: "a@b.com" }))).sucesso).toBe(
      MENSAGEM_RECUPERACAO_SOLICITADA,
    );
  });

  it("recuperação com e-mail inválido mostra erro de campo, sem chamar o Auth", async () => {
    const r = await solicitarRecuperacao({}, form({ email: "x" }));
    expect(r.erros?.email).toBe("E-mail inválido.");
    expect(auth.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("reenvio: resposta neutra mesmo com erro", async () => {
    auth.resend.mockResolvedValue({ error: { code: "x" } });
    expect((await reenviarConfirmacao({}, form({ email: "a@b.com" }))).sucesso).toBe(
      MENSAGEM_CONFIRMACAO_REENVIADA,
    );
  });

  it("cadastro com e-mail já existente (Auth devolve sucesso sem sessão): mensagem neutra", async () => {
    auth.signUp.mockResolvedValue({
      data: { user: { identities: [] }, session: null },
      error: null,
    });
    const r = await cadastrar({}, form({ email: "a@b.com", senha: "abcdefg1" }));
    expect(r.sucesso).toBe(MENSAGEM_CADASTRO_ENVIADO);
    expect(JSON.stringify(r)).not.toMatch(/já|existe|cadastrado/i);
  });

  it("cadastro valida no servidor e envia o nome só se informado", async () => {
    const r = await cadastrar({}, form({ email: "a@b.com", senha: "curta" }));
    expect(r.erros?.senha).toBeTruthy();
    expect(auth.signUp).not.toHaveBeenCalled();
    auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
    await cadastrar({}, form({ email: "a@b.com", senha: "abcdefg1", nomeExibicao: "Ana" }));
    expect(auth.signUp.mock.calls[0][0].options.data).toEqual({ full_name: "Ana" });
  });
});

describe("IM-009 WhatsApp", () => {
  it("duplicado: mensagem genérica, sem revelar de quem é o número", async () => {
    consultaConta.mockResolvedValue({
      data: null,
      error: {
        code: "23505",
        message: 'violates unique constraint "contas_conta_whatsapp_unico"',
        details: "Key (whatsapp_e164)=(+5511999990001) already exists.",
      },
    });
    const r = await atualizarWhatsapp({}, form({ whatsapp: "(11) 99999-0001" }));
    expect(r.erros?.whatsapp).toBe(MENSAGEM_WHATSAPP_INDISPONIVEL);
    expect(JSON.stringify(r)).not.toContain("already exists");
  });

  it("número inválido é barrado antes do banco", async () => {
    const r = await atualizarWhatsapp({}, form({ whatsapp: "123" }));
    expect(r.erros?.whatsapp).toBeTruthy();
    expect(consultaConta).not.toHaveBeenCalled();
  });

  it("sucesso informa que o número ainda não foi verificado", async () => {
    consultaConta.mockResolvedValue({
      data: {
        id: "u1",
        nome_exibicao: null,
        whatsapp_e164: "+5511999990001",
        whatsapp_verificado: false,
        criado_em: "",
        atualizado_em: "",
      },
      error: null,
    });
    const r = await atualizarWhatsapp({}, form({ whatsapp: "(11) 99999-0001" }));
    expect(r.sucesso).toMatch(/ainda não foi verificado/);
  });
});

describe("Google (IM-007)", () => {
  it("provedor desligado: mensagem amigável", async () => {
    auth.signInWithOAuth.mockResolvedValue({
      data: { url: "https://x.supabase.co/auth/v1/authorize?provider=google" },
      error: null,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 400 })),
    );
    const r = await entrarComGoogle({}, form({}));
    expect(r.erro).toBe(MENSAGEM_GOOGLE_INDISPONIVEL);
  });

  it("provedor ativo: redireciona ao endereço de autorização", async () => {
    const url = "https://x.supabase.co/auth/v1/authorize?provider=google";
    auth.signInWithOAuth.mockResolvedValue({ data: { url }, error: null });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 302 })),
    );
    await expect(entrarComGoogle({}, form({}))).rejects.toThrow(`REDIRECT:${url}`);
  });
});
