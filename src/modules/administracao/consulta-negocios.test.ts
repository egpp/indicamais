import { describe, expect, it, vi } from "vitest";
import {
  criarServicoConsultaNegocios,
  escaparCuringasLike,
  paraNegocioConsultado,
  POR_PAGINA_NEGOCIOS,
  type ClienteBancoConsultaNegocios,
  type LinhaConsultaNegocio,
} from "./index";

const linha = (p: Partial<LinhaConsultaNegocio> = {}): LinhaConsultaNegocio => ({
  alvo_tipo: "perfil",
  alvo_id: "00000000-0000-4000-8000-0000000000a1",
  dono_id: "11111111-1111-4111-8111-111111111111",
  versao_id: "00000000-0000-4000-8000-000000000001",
  nome: "Padaria",
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

function fake(admin = true, linhas: LinhaConsultaNegocio[] = [linha()]) {
  const banco: ClienteBancoConsultaNegocios = {
    ehAdministrador: vi.fn(async () => admin),
    consultarNegocios: vi.fn(async () => ({ dados: linhas, erro: null })),
  };
  return banco;
}

describe("consulta de negócios (D-009)", () => {
  it("escapa barra, % e _ na busca", () => {
    expect(escaparCuringasLike("50%_a\\b")).toBe("50\\%\\_a\\\\b");
  });

  it("passa busca escapada, filtros e range da página", async () => {
    const banco = fake();
    const r = await criarServicoConsultaNegocios(banco).consultar({
      busca: "  100%_x ",
      situacao: "pendente",
      tipo: "item",
      pagina: "3",
    });
    expect(r.ok).toBe(true);
    expect(banco.consultarNegocios).toHaveBeenCalledWith({
      buscaLike: "100\\%\\_x",
      situacao: "pendente",
      tipo: "item",
      de: 2 * POR_PAGINA_NEGOCIOS,
      ate: 3 * POR_PAGINA_NEGOCIOS,
    });
  });

  it("ignora filtros inválidos e página inválida", async () => {
    const banco = fake();
    await criarServicoConsultaNegocios(banco).consultar({
      situacao: "xyz",
      tipo: "outro",
      pagina: -4,
    });
    expect(banco.consultarNegocios).toHaveBeenCalledWith({ de: 0, ate: POR_PAGINA_NEGOCIOS });
  });

  it("detecta próxima página pela linha extra e corta a lista", async () => {
    const muitas = Array.from({ length: POR_PAGINA_NEGOCIOS + 1 }, (_, i) =>
      linha({ alvo_id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}` }),
    );
    const r = await criarServicoConsultaNegocios(fake(true, muitas)).consultar({ pagina: 2 });
    expect(r.ok && r.valor.itens).toHaveLength(POR_PAGINA_NEGOCIOS);
    expect(r.ok && r.valor.temProxima).toBe(true);
    expect(r.ok && r.valor.temAnterior).toBe(true);
  });

  it("nega a quem não é administrador sem consultar a visão", async () => {
    const banco = fake(false);
    const r = await criarServicoConsultaNegocios(banco).consultar({});
    expect(r.ok).toBe(false);
    expect(!r.ok && r.erro.codigo).toBe("SEM_PERMISSAO");
    expect(banco.consultarNegocios).not.toHaveBeenCalled();
  });

  it("falha fechado se a checagem de administrador der erro", async () => {
    const banco = fake();
    banco.ehAdministrador = async () => {
      throw new Error("x");
    };
    const s = criarServicoConsultaNegocios(banco);
    expect(await s.ehAdministrador()).toBe(false);
    expect((await s.consultar({})).ok).toBe(false);
  });

  it("erro do banco vira mensagem genérica", async () => {
    const banco = fake();
    banco.consultarNegocios = async () => ({ dados: null, erro: { message: "segredo" } });
    const r = await criarServicoConsultaNegocios(banco).consultar({});
    expect(r.ok).toBe(false);
    expect(!r.ok && r.erro.mensagem).not.toContain("segredo");
  });
});

describe("etiquetas e links", () => {
  it("pendente com versão no ar", () => {
    const n = paraNegocioConsultado(linha({ situacao: "pendente" }));
    expect(n?.situacaoRotulo).toBe("Pendente — já tem versão no ar");
    expect(n?.hrefPublico).toBe("/perfil/padaria");
    expect(n?.hrefRevisao).toBeNull();
  });

  it("indisponível pendente leva à revisão; sem versão pendente, sem link", () => {
    const pend = paraNegocioConsultado(
      linha({
        situacao: "pendente",
        disponivel: false,
        publicado: false,
        tem_versao_aprovada: false,
      }),
    );
    expect(pend?.indisponivel).toBe(true);
    expect(pend?.publicacaoRotulo).toBe("Despublicado");
    expect(pend?.hrefPublico).toBeNull();
    expect(pend?.hrefRevisao).toBe(
      "/administracao/revisao/perfil/00000000-0000-4000-8000-000000000001",
    );
    const rasc = paraNegocioConsultado(linha({ situacao: "rascunho", disponivel: false }));
    expect(rasc?.hrefPublico).toBeNull();
    expect(rasc?.hrefRevisao).toBeNull();
  });

  it("item usa /item/<id> e rótulo do tipo", () => {
    const n = paraNegocioConsultado(linha({ alvo_tipo: "item", item_tipo: "servico", slug: null }));
    expect(n?.hrefPublico).toBe("/item/00000000-0000-4000-8000-0000000000a1");
    expect(n?.tipoRotulo).toBe("Serviço");
  });

  it("descarta linha sem id e não expõe telefone nem e-mail", () => {
    expect(paraNegocioConsultado(linha({ alvo_id: null }))).toBeNull();
    const n = paraNegocioConsultado(linha());
    expect(Object.keys(n ?? {}).join()).not.toMatch(/telefone|email/i);
  });
});
