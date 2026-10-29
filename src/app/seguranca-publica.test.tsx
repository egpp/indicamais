// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SEGREDOS,
  criarMundoPublico,
  type MundoPublico,
} from "../../tests/suporte/bancos-publicos-memoria";
import {
  criarServicoConsultaNegocios,
  type ClienteBancoConsultaNegocios,
  type LinhaConsultaNegocio,
  type ServicoConsultaNegocios,
} from "@/modules/administracao";
import { criarServicoBusca, type ClienteBancoBusca } from "@/modules/busca";
import type { ContextoPublico } from "./_lib/contexto-publico";

/**
 * Verificação independente (Fase 2C): XSS nas páginas públicas e na metadata, entrada hostil na busca,
 * privacidade da lista administrativa e acesso de não administrador a /administracao/negocios.
 */

let contextoAtual: ContextoPublico;
let servicoNegocios: () => ServicoConsultaNegocios | Promise<never>;

vi.mock("./_lib/contexto-publico", async (importar) => ({
  ...(await importar<typeof import("./_lib/contexto-publico")>()),
  obterContextoPublico: () => contextoAtual,
}));
vi.mock("./_lib/contexto-negocios", () => ({
  obterServicoConsultaNegocios: async () => servicoNegocios(),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: (u: string) => {
    throw new Error(`REDIRECT:${u}`);
  },
}));

import PaginaItem, { generateMetadata as metadadosItem } from "./item/[id]/page";
import Home from "./page";
import PaginaPerfil, { generateMetadata as metadadosPerfil } from "./perfil/[slug]/page";
import PaginaNegocios, { metadata as metadadosNegocios } from "./administracao/negocios/page";

let m: MundoPublico;
beforeEach(() => {
  m = criarMundoPublico();
  contextoAtual = m.contexto();
  vi.unstubAllEnvs();
});
afterEach(() => cleanup());

const args = (params: Record<string, string> = {}, busca: Record<string, string> = {}) =>
  ({ params: Promise.resolve(params), searchParams: Promise.resolve(busca) }) as never;

const XSS_NOME = `<script>window.__xss=1</script>"><img src=x onerror=window.__xss=2>`;
const XSS_DESC = `<svg onload=window.__xss=3> javascript:alert(1) <a href="javascript:alert(2)">x</a>`;

function semMarcacaoInjetada() {
  expect(document.querySelector("script")).toBeNull();
  expect(document.querySelector("svg")).toBeNull();
  expect(document.querySelector("[onerror]")).toBeNull();
  expect(document.querySelector("[onload]")).toBeNull();
  expect(document.querySelector('a[href^="javascript:"]')).toBeNull();
  expect((globalThis as { __xss?: number }).__xss).toBeUndefined();
}

describe("XSS: texto de usuário é sempre texto (IM-086)", () => {
  it("perfil público escapa nome, descrição, endereço e áreas; metadados guardam o texto cru para o framework escapar", async () => {
    const p = m.novoPerfil({
      nome: XSS_NOME,
      slug: "xss-perfil",
      descricao_breve: XSS_DESC,
      endereco: XSS_DESC,
      areas_atendidas: [XSS_NOME],
    });
    m.novoItem({ nome: XSS_NOME, tipo: "produto", perfil_id: p.id, descricao: XSS_DESC });
    render(await PaginaPerfil(args({ slug: "xss-perfil" })));
    semMarcacaoInjetada();
    expect(document.querySelector("h1")!.textContent).toBe(XSS_NOME);

    const meta = await metadadosPerfil(args({ slug: "xss-perfil" }));
    // O Next serializa title/description com escape no <head>; aqui basta ser string pura, não objeto/HTML pronto.
    expect(typeof meta.title).toBe("string");
    expect(typeof meta.description).toBe("string");
  });

  it("item público e home (cards e busca) escapam nome e descrição", async () => {
    const it1 = m.novoItem({
      nome: XSS_NOME,
      tipo: "produto",
      descricao: XSS_DESC,
      cidade: "Canoas",
      uf: "RS",
    });
    render(await PaginaItem(args({ id: it1.id })));
    semMarcacaoInjetada();
    const meta = await metadadosItem(args({ id: it1.id }));
    expect(String(meta.title)).toContain("<script>");
    cleanup();

    render(await Home(args()));
    semMarcacaoInjetada();
    cleanup();

    render(await Home(args({}, { termo: XSS_NOME })));
    semMarcacaoInjetada();
    // O termo digitado volta no campo como valor, nunca como marcação.
    const campo = document.querySelector<HTMLInputElement>("#f-termo")!;
    expect(campo.value).toBe(XSS_NOME);
    expect(document.querySelector("[onerror]")).toBeNull();
  });

  it("patrocinador com título hostil é texto e destino texto não vira link", async () => {
    m.novoPatrocinador({ titulo: XSS_NOME, texto_destino: "Venha nos visitar" });
    render(await Home(args()));
    semMarcacaoInjetada();
    const regiao = document.querySelector('[aria-label="Patrocinados"]')!;
    expect(regiao.querySelectorAll("a[href^='http']").length).toBe(0);
    expect(regiao.textContent).toContain("Patrocinado");
  });
});

describe("busca com entrada hostil chega ao banco só como parâmetro de RPC (IM-019, IM-086)", () => {
  function banco() {
    const buscar = vi.fn(async () => ({ dados: [], erro: null }));
    const b: ClienteBancoBusca = {
      buscar,
      listarCategorias: async () => ({ dados: [], erro: null }),
    };
    return { buscar, servico: criarServicoBusca(b) };
  }

  it.each(["%", "_", "\\", "' OR 1=1 --", "a%b_c\\d", "%00", "ａｂｃ"])(
    "termo %j é repassado literal, sem escape próprio e sem recusa",
    async (termo) => {
      const { buscar, servico } = banco();
      const r = await servico.buscar({ termo, cidade: termo });
      if (termo.includes("\0")) {
        // Caractere de controle real é recusado antes do banco.
        return;
      }
      expect(r.ok).toBe(true);
      expect(buscar).toHaveBeenCalledTimes(1);
      const chamado = (buscar.mock.calls[0] as unknown as [Record<string, unknown>])[0];
      expect(chamado.p_termo).toBe(termo);
      expect(chamado.p_cidade).toBe(termo);
    },
  );

  it("caractere de controle, UF malformada, tipo desconhecido, termo longo e uuid ruim nem chegam ao banco", async () => {
    const { buscar, servico } = banco();
    for (const entrada of [
      { termo: "a\u0000b" },
      { uf: "RS; drop table x" },
      { uf: "XX" },
      { tipo: "admin" },
      { termo: "x".repeat(81) },
      { cidade: "x".repeat(81) },
      { categoriaId: "1 or 1=1" },
      { pagina: "-1" },
      { pagina: "1001" },
      { limite: "51" },
    ]) {
      const r = await servico.buscar(entrada);
      expect(r.ok, JSON.stringify(entrada)).toBe(false);
    }
    expect(buscar).not.toHaveBeenCalled();
  });

  it("campos desconhecidos (ex.: dono, conta_id) são descartados e não viram parâmetro", async () => {
    const { buscar, servico } = banco();
    await servico.buscar({ termo: "a", conta_id: "x", responsavel_id: "y", p_extra: "z" });
    const chamado = (buscar.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    expect(Object.keys(chamado).sort()).toEqual(["p_limite", "p_pagina", "p_termo"]);
  });
});

const linhaAdm = (p: Partial<LinhaConsultaNegocio> = {}): LinhaConsultaNegocio => ({
  alvo_tipo: "perfil",
  alvo_id: "00000000-0000-4000-8000-0000000000a1",
  dono_id: SEGREDOS.responsavelId,
  versao_id: "00000000-0000-4000-8000-000000000001",
  nome: "Padaria <b>negrito</b>",
  categoria: "Alimentação",
  cidade: "Campinas",
  uf: "SP",
  situacao: "aprovada",
  tem_versao_aprovada: true,
  publicado: true,
  disponivel: true,
  item_tipo: null,
  perfil_id: null,
  slug: "padaria",
  criado_em: "2026-10-01T10:00:00Z",
  atualizado_em: "2026-10-02T10:00:00Z",
  ...p,
});

function servicoCom(admin: boolean, linhas: LinhaConsultaNegocio[]) {
  const banco: ClienteBancoConsultaNegocios = {
    ehAdministrador: async () => admin,
    consultarNegocios: vi.fn(async () => ({ dados: linhas, erro: null })),
  };
  return { banco, servico: criarServicoConsultaNegocios(banco) };
}

describe("/administracao/negocios (D-009, IM-077 parte, IM-029)", () => {
  it("anônimo vai para o login (a função de contexto redireciona) e a rota fica noindex", async () => {
    servicoNegocios = () => {
      throw new Error("REDIRECT:/entrar?aviso=sessao&proximo=%2Fadministracao%2Fnegocios");
    };
    await expect(PaginaNegocios(args())).rejects.toThrow(/REDIRECT:\/entrar/);
    expect(metadadosNegocios.robots).toEqual({ index: false, follow: false });
  });

  it("usuário comum recebe o 404 padrão e a visão nem é consultada", async () => {
    const { banco, servico } = servicoCom(false, [linhaAdm()]);
    servicoNegocios = () => servico;
    await expect(PaginaNegocios(args())).rejects.toThrow("NEXT_NOT_FOUND");
    expect(banco.consultarNegocios).not.toHaveBeenCalled();
  });

  it("falha na checagem de administrador também é 404 (falha fechado)", async () => {
    const banco: ClienteBancoConsultaNegocios = {
      ehAdministrador: async () => {
        throw new Error("boom");
      },
      consultarNegocios: vi.fn(),
    };
    servicoNegocios = () => criarServicoConsultaNegocios(banco);
    await expect(PaginaNegocios(args())).rejects.toThrow("NEXT_NOT_FOUND");
    expect(banco.consultarNegocios).not.toHaveBeenCalled();
  });

  it("administrador: nome escapado, sem telefone/e-mail/mailto, link público só quando disponível", async () => {
    const itemId = "00000000-0000-4000-8000-0000000000b2";
    const { servico } = servicoCom(true, [
      linhaAdm(),
      linhaAdm({
        alvo_tipo: "item",
        alvo_id: itemId,
        nome: "Item despublicado",
        item_tipo: "produto",
        publicado: false,
        disponivel: false,
        slug: null,
      }),
      linhaAdm({
        alvo_id: "00000000-0000-4000-8000-0000000000c3",
        nome: "Perfil <script>1</script>",
        slug: "perfil-slug",
        disponivel: false,
        situacao: "rascunho",
        tem_versao_aprovada: false,
        publicado: false,
      }),
    ]);
    servicoNegocios = () => servico;
    const { container } = render(await PaginaNegocios(args()));
    const html = container.innerHTML;
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("b")).toBeNull();
    expect(html).not.toMatch(/mailto:|whatsapp|wa\.me|\+55\d{9,}|[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
    expect(html).not.toContain(SEGREDOS.whatsapp);
    expect(html).not.toContain(SEGREDOS.email);
    const hrefs = [...container.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    expect(hrefs).toContain("/perfil/padaria");
    expect(hrefs).not.toContain(`/item/${itemId}`);
    expect(hrefs).not.toContain("/perfil/perfil-slug");
    expect(container.textContent).toContain("Despublicado");
    expect(container.textContent).toContain("Indisponível");
  });

  it("filtros hostis na query string não quebram nem viram SQL: o adaptador recebe só valores validados", async () => {
    const { banco, servico } = servicoCom(true, []);
    servicoNegocios = () => servico;
    render(
      await PaginaNegocios(
        args({}, { busca: "100%_\\ ' or 1=1 --", situacao: "x;drop", tipo: "admin", pagina: "-5" }),
      ),
    );
    expect(banco.consultarNegocios).toHaveBeenCalledTimes(1);
    const c = (banco.consultarNegocios as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(c.situacao).toBeUndefined();
    expect(c.tipo).toBeUndefined();
    expect(c.de).toBe(0);
    expect(c.buscaLike).toBe("100\\%\\_\\\\ ' or 1=1 --");
  });
});
