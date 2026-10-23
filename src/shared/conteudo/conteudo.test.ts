import { describe, expect, it } from "vitest";
import { slugComSufixo, slugificar } from "../formatacao/slug";
import { validarCategorias, categoriasParaColunas } from "./categorias";
import {
  decidirEdicao,
  disponivelPublicamente,
  estadoDoConteudo,
  podePublicar,
  type VersaoBasica,
} from "./ciclo-versao";
import { alvoDoErro, classificarErroBanco } from "./erros-banco";
import { caminhoDaConta, gerarCaminhoImagem, validarImagem } from "./imagens";

const CONTA = "11111111-1111-4111-8111-111111111111";
const OUTRA = "22222222-2222-4222-8222-222222222222";
const v = (id: string, situacao: VersaoBasica["situacao"], dia: number): VersaoBasica => ({
  id,
  situacao,
  criado_em: `2026-10-${String(dia).padStart(2, "0")}T10:00:00Z`,
});

describe("slugificar (IM-011)", () => {
  it("minúsculas, sem acentos, só a-z0-9 e hífen", () => {
    expect(slugificar("Café & Cia Ltda.")).toBe("cafe-e-cia-ltda");
    expect(slugificar("  Ação  Rápida!! ")).toBe("acao-rapida");
    expect(slugificar("São João -- Eletrônicos")).toBe("sao-joao-eletronicos");
  });
  it("entrada sem letras ou números vira vazio", () => {
    expect(slugificar("!!! ???")).toBe("");
    expect(slugificar("")).toBe("");
  });
  it("respeita o tamanho máximo sem terminar em hífen", () => {
    const s = slugificar("a".repeat(30) + " " + "b".repeat(40), 60);
    expect(s.length).toBeLessThanOrEqual(60);
    expect(s.endsWith("-")).toBe(false);
  });
  it("sufixo numérico cabe no limite", () => {
    expect(slugComSufixo("loja", 2)).toBe("loja-2");
    expect(slugComSufixo("a".repeat(60), 12).length).toBeLessThanOrEqual(60);
  });
});

describe("imagens (D-006, IM-011, IM-014)", () => {
  const MB = 1024 * 1024;
  it("aceita jpeg, png e webp até 2 MB (limite incluso)", () => {
    for (const tipoMime of ["image/jpeg", "image/png", "image/webp"]) {
      expect(validarImagem({ tipoMime, tamanhoBytes: 2 * MB }).ok).toBe(true);
    }
  });
  it("recusa imagem acima de 2 MB", () => {
    const r = validarImagem({ tipoMime: "image/png", tamanhoBytes: 2 * MB + 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.mensagem).toMatch(/2 MB/);
  });
  it.each(["image/gif", "image/svg+xml", "application/pdf", "text/html", "", "image/JPEG"])(
    "recusa tipo %j",
    (tipoMime) => {
      expect(validarImagem({ tipoMime, tamanhoBytes: 1000 }).ok).toBe(false);
    },
  );
  it.each([0, -5, Number.NaN, Number.POSITIVE_INFINITY])("recusa tamanho %s", (t) => {
    expect(validarImagem({ tipoMime: "image/png", tamanhoBytes: t }).ok).toBe(false);
  });
  it("caminho precisa estar na pasta da própria conta", () => {
    expect(caminhoDaConta(CONTA, `${CONTA}/foto-1.jpg`)).toBe(true);
    expect(caminhoDaConta(CONTA, `${OUTRA}/foto-1.jpg`)).toBe(false);
    expect(caminhoDaConta(CONTA, `${CONTA}/../${OUTRA}/x.jpg`)).toBe(false);
    expect(caminhoDaConta(CONTA, `${CONTA}/..`)).toBe(false);
    expect(caminhoDaConta(CONTA, `${CONTA}/.env`)).toBe(false);
    expect(caminhoDaConta(CONTA, `${CONTA}/a/b.jpg`)).toBe(false);
    expect(caminhoDaConta(CONTA, `foto.jpg`)).toBe(false);
  });
  it("gera caminho dentro da pasta da conta com extensão do tipo", () => {
    const c = gerarCaminhoImagem(CONTA, "image/webp", "abc-123");
    expect(c).toBe(`${CONTA}/abc-123.webp`);
    expect(caminhoDaConta(CONTA, c)).toBe(true);
    expect(() => gerarCaminhoImagem(CONTA, "image/webp", "../x")).toThrow();
  });
});

describe("categorias (IM-016)", () => {
  const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const D = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  it("principal + 2 secundárias distintas é válido", () => {
    expect(validarCategorias({ principalId: A, secundariasIds: [B, C] })).toBeNull();
    expect(validarCategorias({ principalId: null, secundariasIds: [] })).toBeNull();
  });
  it("recusa a quarta categoria", () => {
    expect(validarCategorias({ principalId: A, secundariasIds: [B, C, D] })).toMatch(/no máximo 2/);
  });
  it("recusa repetição e secundária sem principal", () => {
    expect(validarCategorias({ principalId: A, secundariasIds: [A] })).not.toBeNull();
    expect(validarCategorias({ principalId: A, secundariasIds: [B, B] })).not.toBeNull();
    expect(validarCategorias({ principalId: null, secundariasIds: [B] })).not.toBeNull();
  });
  it("mapeia para as três colunas do banco", () => {
    expect(categoriasParaColunas({ principalId: A, secundariasIds: [B] })).toEqual({
      categoria_principal_id: A,
      categoria_secundaria_1_id: B,
      categoria_secundaria_2_id: null,
    });
  });
});

describe("ciclo de versões (IM-021, IM-022, IM-079)", () => {
  it("rascunho aberto: atualiza o rascunho", () => {
    expect(decidirEdicao([v("a", "aprovada", 1), v("b", "rascunho", 2)])).toEqual({
      tipo: "atualizar_rascunho",
      versaoId: "b",
    });
  });
  it("pendente: bloqueia a edição", () => {
    expect(decidirEdicao([v("a", "aprovada", 1), v("b", "pendente", 2)])).toEqual({
      tipo: "bloqueada_em_analise",
      versaoId: "b",
    });
  });
  it("aprovada sem versão aberta: nova versão copiando a aprovada", () => {
    expect(decidirEdicao([v("a", "aprovada", 1)])).toEqual({ tipo: "nova_versao", baseId: "a" });
  });
  it("depois de rejeição, parte da última versão decidida (a rejeitada)", () => {
    expect(decidirEdicao([v("a", "aprovada", 1), v("b", "rejeitada", 3)])).toEqual({
      tipo: "nova_versao",
      baseId: "b",
    });
  });
  it("sem nenhuma versão: nova versão em branco", () => {
    expect(decidirEdicao([])).toEqual({ tipo: "nova_versao", baseId: null });
  });

  it("estado: edição de público mantém 'noAr' e mostra edição pendente", () => {
    const e = estadoDoConteudo({ publicado: true, versao_aprovada_id: "a" }, [
      v("a", "aprovada", 1),
      v("b", "pendente", 2),
    ]);
    expect(e.noAr).toBe(true);
    expect(e.aberta).toBe("pendente");
    expect(e.rotulo).toBe("Edição aguardando aprovação");
  });
  it("estado: despublicado com aprovada não está no ar", () => {
    const e = estadoDoConteudo({ publicado: false, versao_aprovada_id: "a" }, [
      v("a", "aprovada", 1),
    ]);
    expect(e.noAr).toBe(false);
    expect(e.rotulo).toBe("Despublicado");
  });
  it("estado: rejeitado e sem aprovada", () => {
    const e = estadoDoConteudo({ publicado: false, versao_aprovada_id: null }, [
      v("a", "rejeitada", 1),
    ]);
    expect(e.ultimaRejeitada).toBe(true);
    expect(e.rotulo).toBe("Rejeitado");
  });
  it("só se publica o que foi aprovado", () => {
    expect(podePublicar({ versao_aprovada_id: null })).toBe(false);
    expect(podePublicar({ versao_aprovada_id: "a" })).toBe(true);
  });
  it("IM-079: item de perfil indisponível não fica disponível", () => {
    const base = { publicado: true, versao_aprovada_id: "a" };
    expect(disponivelPublicamente({ ...base, perfilDisponivel: false })).toBe(false);
    expect(disponivelPublicamente({ ...base, perfilDisponivel: true })).toBe(true);
    expect(disponivelPublicamente({ ...base, perfilDisponivel: null })).toBe(true);
    expect(
      disponivelPublicamente({ publicado: false, versao_aprovada_id: "a", perfilDisponivel: null }),
    ).toBe(false);
    expect(
      disponivelPublicamente({ publicado: true, versao_aprovada_id: null, perfilDisponivel: null }),
    ).toBe(false);
  });
});

describe("classificação de erros do banco", () => {
  it("classifica por código e nunca devolve texto do banco", () => {
    expect(classificarErroBanco({ code: "23505" })).toBe("DUPLICADO");
    expect(classificarErroBanco({ code: "23514" })).toBe("CHECK");
    expect(classificarErroBanco({ code: "42501" })).toBe("PERMISSAO");
    expect(classificarErroBanco({ code: "P0002" })).toBe("NAO_ENCONTRADO");
    expect(classificarErroBanco({ code: "P0001" })).toBe("ESTADO_INVALIDO");
    expect(classificarErroBanco({ code: "22023" })).toBe("DADO_INVALIDO");
    expect(classificarErroBanco({ code: "XX000" })).toBe("DESCONHECIDO");
    expect(alvoDoErro({ constraint: "c", message: "m", details: "d" })).toBe("c m d");
  });
});
