import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CSP_COMPLETA } from "../src/shared/seguranca/cabecalhos";
import { verificarTurnstile } from "../src/shared/turnstile/verificar";
import { ipDoPedido, origemDoPedido } from "../src/app/_lib/origem-denuncia";

/**
 * Verificação independente do PR #73 (RSA-05, RSA-06, RSA-07, RSA-10; IM-076, IM-086, D-033).
 * Testes de lacuna: nada de rede real, banco ou chave verdadeira.
 */
const SEGREDO = "1x0000000000000000000000000000000AA";
const TOKEN_SECRETO = "TOKEN-PRIVADO-QUE-NAO-PODE-VAZAR-123";
const ok = () => vi.fn(async () => new Response(JSON.stringify({ success: true })));

afterEach(() => vi.restoreAllMocks());

describe("Turnstile: dispensa de desenvolvimento não vaza para produção", () => {
  it("NODE_ENV=production sem chave: fechado, mesmo com APP_ENV forjado como 'development' e token qualquer", async () => {
    const buscar = ok();
    for (const app of ["development", "dev", "test", "", undefined]) {
      const r = await verificarTurnstile(
        { token: "qualquer", ip: "198.51.100.1" },
        { env: { NODE_ENV: "production", APP_ENV: app }, buscar },
      );
      expect(r).toEqual({ ok: false, motivo: "nao_configurado" });
    }
    expect(buscar).not.toHaveBeenCalled();
  });

  it("APP_ENV=production (com NODE_ENV de dev) também falha fechado, em qualquer caixa", async () => {
    for (const app of ["production", "PRODUCTION", " Production "]) {
      const r = await verificarTurnstile(
        { token: "x" },
        { env: { NODE_ENV: "development", APP_ENV: app } },
      );
      expect(r).toEqual({ ok: false, motivo: "nao_configurado" });
    }
  });

  it("o resultado depende só do ambiente do processo: o token (ou um campo 'dispensar') do formulário não muda nada", async () => {
    const r = await verificarTurnstile(
      { token: { verificado: true, dispensar: "1" } as unknown },
      { env: { NODE_ENV: "production" } },
    );
    expect(r).toEqual({ ok: false, motivo: "nao_configurado" });
  });
});

describe("Turnstile: token e segredo não vazam; uso único; timeout", () => {
  it("falhas não escrevem token nem segredo em console", async () => {
    const espioes = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => undefined),
    );
    const falhas: (typeof fetch)[] = [
      vi.fn(async () => {
        throw new Error(`boom ${TOKEN_SECRETO} ${SEGREDO}`);
      }) as unknown as typeof fetch,
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ success: false, "error-codes": ["invalid-input-response"] }),
          ),
      ) as unknown as typeof fetch,
    ];
    for (const buscar of falhas) {
      const r = await verificarTurnstile(
        { token: TOKEN_SECRETO, ip: "203.0.113.5" },
        { env: { TURNSTILE_SECRET_KEY: SEGREDO }, buscar },
      );
      expect(r.ok).toBe(false);
      expect(JSON.stringify(r)).not.toContain(TOKEN_SECRETO);
      expect(JSON.stringify(r)).not.toContain(SEGREDO);
    }
    for (const e of espioes) expect(e).not.toHaveBeenCalled();
  });

  it("reaproveitar o mesmo token: a 2ª resposta 'timeout-or-duplicate' é recusada como inválida", async () => {
    let n = 0;
    const buscar = vi.fn(async () => {
      n += 1;
      return new Response(
        JSON.stringify(
          n === 1 ? { success: true } : { success: false, "error-codes": ["timeout-or-duplicate"] },
        ),
      );
    }) as unknown as typeof fetch;
    const env = { TURNSTILE_SECRET_KEY: SEGREDO };
    expect(await verificarTurnstile({ token: "t" }, { env, buscar })).toEqual({
      ok: true,
      verificado: true,
    });
    expect(await verificarTurnstile({ token: "t" }, { env, buscar })).toEqual({
      ok: false,
      motivo: "invalido",
    });
  });

  it("a chamada ao siteverify leva um AbortSignal (timeout) e não segue redirecionamento de resposta sem sucesso", async () => {
    const buscar = ok();
    await verificarTurnstile({ token: "t" }, { env: { TURNSTILE_SECRET_KEY: SEGREDO }, buscar });
    const init = (buscar.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("success:false sem 'error-codes' nunca aprova; success não booleano é indisponível", async () => {
    const env = { TURNSTILE_SECRET_KEY: SEGREDO };
    const sem = vi.fn(
      async () => new Response(JSON.stringify({ success: false })),
    ) as unknown as typeof fetch;
    expect(await verificarTurnstile({ token: "t" }, { env, buscar: sem })).toEqual({
      ok: false,
      motivo: "invalido",
    });
    const texto = vi.fn(
      async () => new Response(JSON.stringify({ success: "true" })),
    ) as unknown as typeof fetch;
    expect(await verificarTurnstile({ token: "t" }, { env, buscar: texto })).toEqual({
      ok: false,
      motivo: "indisponivel",
    });
  });
});

describe("IP de origem e HMAC", () => {
  it("cf-connecting-ip (reescrito pela Cloudflare) tem prioridade sobre x-forwarded-for forjado pelo cliente", () => {
    const h = new Headers({
      "cf-connecting-ip": "203.0.113.7",
      "x-forwarded-for": "1.2.3.4, 5.6.7.8",
    });
    expect(ipDoPedido(h)).toBe("203.0.113.7");
  });

  it("segredo com 31 caracteres é recusado em produção; com 32 é aceito; contexto separa os domínios", async () => {
    const h = new Headers({ "cf-connecting-ip": "203.0.113.7", "user-agent": "UA" });
    await expect(
      origemDoPedido(h, "contato", {
        NODE_ENV: "production",
        DENUNCIA_HASH_SEGREDO: "a".repeat(31),
      }),
    ).rejects.toThrow();
    const env = { NODE_ENV: "production", DENUNCIA_HASH_SEGREDO: "a".repeat(32) };
    const c = await origemDoPedido(h, "contato", env);
    const d = await origemDoPedido(h, "denuncia", env);
    expect(c).toMatch(/^[0-9a-f]{64}$/);
    expect(d).toMatch(/^[0-9a-f]{64}$/);
    expect(c).not.toBe(d);
  });

  it("segredo só com espaços vale como ausente (produção lança)", async () => {
    const h = new Headers({ "cf-connecting-ip": "203.0.113.7" });
    await expect(
      origemDoPedido(h, "contato", {
        NODE_ENV: "production",
        DENUNCIA_HASH_SEGREDO: " ".repeat(40),
      }),
    ).rejects.toThrow();
  });
});

describe("RSA-06: toda ação exportada de src/app/acoes-*.ts está classificada", () => {
  // Ao criar uma ação nova, classifique-a aqui: o teste falha para ação não classificada.
  const ADMIN_GERAL_COM_HELPER = "exigirAdministrador";
  const DELEGADAS_POR_PERMISSAO = [
    // Permissão delegável (não só o administrador geral): conferida pelo serviço/banco (e pelo tratador no sincronizar).
    "acaoDecidirDenuncia",
    "acaoSuspenderConta",
    "acaoReativarConta",
    "acaoSincronizarAcesso",
    "acaoInvalidarIndicacao",
  ];
  const ADMIN_NO_TRATADOR = [
    // Conferem soAdministrador no tratador, antes de qualquer escrita (o contexto é montado antes, sem escrever).
    "acaoReenviarComoAdmin",
    "acaoTratarAlerta",
    "acaoDefinirParametro",
  ];
  const PUBLICAS_OU_DO_PROPRIO_USUARIO = [
    "cadastrar",
    "entrar",
    "entrarComGoogle",
    "solicitarRecuperacao",
    "reenviarConfirmacao",
    "redefinirSenha",
    "atualizarNome",
    "atualizarWhatsapp",
    "sair",
    "acaoEnviarContato",
    "acaoGerarLink",
    "acaoRegistrarCompartilhamento",
    "acaoPedirReenvio",
    "acaoDenunciar",
    "acaoSolicitarEncerramento",
    "acaoCancelarEncerramento",
    "acaoLocalizarNoMapa",
    "acaoInformarCoordenadas",
    "acaoRemoverCoordenadas",
    "acaoDefinirMostrarMapa",
    "acaoCurtirPerfil",
    "acaoDescurtirPerfil",
    "acaoSairDaBase",
    "acaoMarcarAvisoLido",
    "acaoMarcarTodosLidos",
    "acaoAbrirAviso",
    "acaoSalvarEstilo",
    "acaoSalvarBanners",
    "acaoResponderBanner",
    "acaoBannerAtivo",
    "acaoCriarPerfil",
    "acaoEditarPerfil",
    "acaoSalvarImagensPerfil",
    "acaoAlterarEnderecoPerfil",
    "acaoEnviarPerfil",
    "acaoPublicarPerfil",
    "acaoDespublicarPerfil",
    "acaoCriarItem",
    "acaoEditarItem",
    "acaoSalvarFotoItem",
    "acaoSalvarFotosExtrasItem",
    "acaoEnviarItem",
    "acaoPublicarItem",
    "acaoDespublicarItem",
    "acaoSolicitarCategoria",
    "acaoCriarOferta",
    "acaoAlterarPercentual",
    "acaoDefinirOfertaAtiva",
    "acaoCriarBeneficio",
    "acaoSalvarBeneficio",
    "acaoEnviarVersao",
    "acaoLigarDesligarBeneficio",
    "acaoResponderProposta",
  ];
  const ADMIN_GERAL = [
    "acaoCriarPatrocinador",
    "acaoAlterarPatrocinador",
    "acaoDefinirPatrocinadorAtivo",
    "acaoDefinirPrazoInadimplencia",
    "acaoDefinirAntecedenciaAviso",
    "acaoDefinirHabilitacao",
    "acaoRegistrarVinculo",
    "acaoRegistrarAssinatura",
    "acaoCancelarAssinatura",
    "acaoConfirmarPagamento",
    "acaoEstornarPagamento",
    "acaoReverterComissao",
    "acaoAvancarRepasse",
    "acaoEncerrarVinculo",
    "acaoDefinirParametroPontos",
    "acaoReverterCredito",
    "acaoReprocessarPedido",
    "acaoDecidirBeneficio",
    "acaoCadastrarBeneficioAdmin",
    "acaoEditarPropostaAdmin",
    "acaoAlterarSecaoHome",
    "acaoDefinirLiberacaoLoja",
    "acaoHabilitarEstilo",
    "acaoAdicionarBannerAdmin",
    "acaoRemoverBannerAdmin",
    "acaoDecidirRevisao",
    "acaoCriarCategoria",
    "acaoAlterarCategoria",
    "acaoDecidirSolicitacao",
    "acaoConcederPermissao",
    "acaoRevogarPermissao",
  ];

  const dir = join(__dirname, "..", "src", "app");
  const arquivos = readdirSync(dir).filter(
    (f) => /^acoes-.*\.ts$/.test(f) && !f.endsWith(".test.ts"),
  );
  const exportadas = arquivos.flatMap((f) =>
    [...readFileSync(join(dir, f), "utf8").matchAll(/^export async function (\w+)/gm)].map(
      (m) => m[1]!,
    ),
  );

  it("o helper existe e as 31 ações do administrador geral continuam em 31", () => {
    expect(ADMIN_GERAL).toHaveLength(31);
    expect(ADMIN_GERAL_COM_HELPER).toBe("exigirAdministrador");
  });

  it("nenhuma ação exportada fica sem classificação (nem classificada em dois lugares)", () => {
    const todas = [
      ...ADMIN_GERAL,
      ...DELEGADAS_POR_PERMISSAO,
      ...ADMIN_NO_TRATADOR,
      ...PUBLICAS_OU_DO_PROPRIO_USUARIO,
    ];
    expect(new Set(todas).size).toBe(todas.length);
    const semClasse = exportadas.filter((n) => !todas.includes(n));
    expect(semClasse).toEqual([]);
    const fantasmas = todas.filter((n) => !exportadas.includes(n));
    expect(fantasmas).toEqual([]);
  });

  it("as ações 'ADMIN_NO_TRATADOR' conferem soAdministrador antes de escrever", () => {
    const fonte = readFileSync(join(dir, "_lib", "tratadores-indicacoes.ts"), "utf8");
    for (const t of ["reenviarComoAdmin", "tratarAlertaAdmin", "definirParametroAdmin"]) {
      const corpo = fonte.slice(fonte.indexOf(`function ${t}`));
      const antes = corpo.slice(0, corpo.indexOf("soAdministrador(ctx)") + 1);
      expect(antes.length).toBeGreaterThan(0);
      expect(corpo.indexOf("soAdministrador(ctx)")).toBeGreaterThan(-1);
      expect(corpo.indexOf("soAdministrador(ctx)")).toBeLessThan(corpo.indexOf("ctx.servico"));
    }
  });
});

describe("CSP: Turnstile é o mínimo necessário", () => {
  const diretiva = (nome: string) =>
    CSP_COMPLETA.split("; ").find((d) => d.startsWith(`${nome} `)) ?? "";

  it("challenges.cloudflare.com só em script-src, connect-src e frame-src, sem curinga", () => {
    const com = CSP_COMPLETA.split("; ")
      .filter((d) => d.includes("challenges.cloudflare.com"))
      .map((d) => d.split(" ")[0]);
    expect(com.sort()).toEqual(["connect-src", "frame-src", "script-src"]);
    expect(CSP_COMPLETA).not.toMatch(/\*\.cloudflare\.com/);
    expect(diretiva("default-src")).toBe("default-src 'self'");
    expect(diretiva("frame-ancestors")).toBe("frame-ancestors 'none'");
  });
});

describe("origem sem User-Agent e deploy com a chave do Turnstile (IM-076, IM-086)", () => {
  it("11 pedidos do mesmo IP com User-Agents diferentes têm a MESMA origem (o limite por origem não é contornado)", async () => {
    const env = { NODE_ENV: "production", DENUNCIA_HASH_SEGREDO: "a".repeat(32) };
    const origens = new Set<string | undefined>();
    for (let i = 0; i < 11; i++) {
      const h = new Headers({ "cf-connecting-ip": "203.0.113.7", "user-agent": `UA-${i}` });
      origens.add(await origemDoPedido(h, "contato", env));
    }
    expect(origens.size).toBe(1);
  });

  it("o deploy-dev repassa NEXT_PUBLIC_TURNSTILE_SITE_KEY como variável (vars), nunca secret", () => {
    const yml = readFileSync(join(process.cwd(), ".github/workflows/deploy-dev.yml"), "utf8");
    expect(yml).toMatch(
      /NEXT_PUBLIC_TURNSTILE_SITE_KEY:\s*\$\{\{\s*vars\.NEXT_PUBLIC_TURNSTILE_SITE_KEY\s*\}\}/,
    );
    expect(yml).not.toMatch(/secrets\.NEXT_PUBLIC_TURNSTILE/);
  });
});
