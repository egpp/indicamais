import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  caminhoDe,
  criarMundo,
  formulario,
  type Mundo,
} from "../../../tests/suporte/bancos-memoria";
import {
  alterarCategoria,
  criarCategoria,
  decidirRevisao,
  decidirSolicitacao,
  solicitarCategoria,
} from "./tratadores-administracao";
import {
  criarItem,
  despublicarItem,
  editarItem,
  enviarItem,
  publicarItem,
  salvarFotoItem,
} from "./tratadores-itens";
import {
  alterarEnderecoPerfil,
  criarPerfil,
  despublicarPerfil,
  editarPerfil,
  enviarPerfil,
  publicarPerfil,
  salvarImagensPerfil,
} from "./tratadores-perfis";

const ANA = randomUUID();
const BIA = randomUUID();
const ADM = randomUUID();

function mundo() {
  return criarMundo({ administradores: [ADM] });
}

const dadosPerfil = (m: Mundo, extra: Record<string, string> = {}) => ({
  nome: "Padaria da Ana",
  descricaoBreve: "Pães e bolos artesanais.",
  cidade: "Porto Alegre",
  uf: "RS",
  whatsappComercial: "(51) 98123-7661",
  categoriaPrincipalId: m.categorias[0]!.id,
  ...extra,
});

async function novoPerfil(m: Mundo, conta = ANA, extra: Record<string, string> = {}) {
  const r = await criarPerfil(m.contexto(conta), formulario(dadosPerfil(m, extra)));
  const id = /\/meus-perfis\/([0-9a-f-]{36})/.exec(r.destino ?? "")?.[1];
  if (!id) throw new Error(`perfil não criado: ${JSON.stringify(r)}`);
  return id;
}

/** Perfil pronto para enviar (com imagem) e, se pedido, já aprovado pelo administrador. */
async function perfilEnviado(m: Mundo, aprovar = false) {
  const id = await novoPerfil(m);
  const ana = m.contexto(ANA);
  await salvarImagensPerfil(
    ana,
    formulario({ id, imagemPath: caminhoDe("perfil", id), fotosPaths: [], bannersPaths: [] }),
  );
  const env = await enviarPerfil(ana, formulario({ id }));
  expect(env.erro).toBeUndefined();
  if (aprovar) {
    const versao = m.versoesPerfil.find((v) => v.perfil_id === id && v.situacao === "pendente")!;
    const r = await decidirRevisao(
      m.contexto(ADM),
      formulario({ decisao: "aprovar", alvo: "perfil", versaoId: versao.id }),
    );
    expect(r.destino).toContain("decidido=aprovada");
  }
  return id;
}

describe("perfil: criar rascunho (IM-011, IM-012, IM-016)", () => {
  it("cria o rascunho, normaliza o WhatsApp para E.164 e leva à tela do perfil", async () => {
    const m = mundo();
    const id = await novoPerfil(m);
    const versao = m.versoesPerfil.find((v) => v.perfil_id === id)!;
    expect(versao.whatsapp_comercial_e164).toBe("+5551981237661");
    expect(versao.situacao).toBe("rascunho");
    expect(m.perfis.get(id)!.publicado).toBe(false);
  });

  it("WhatsApp comercial é obrigatório e os valores digitados voltam ao formulário", async () => {
    const m = mundo();
    const r = await criarPerfil(
      m.contexto(ANA),
      formulario(dadosPerfil(m, { whatsappComercial: "" })),
    );
    expect(r.destino).toBeUndefined();
    expect(r.erros?.whatsappComercial).toBe("Informe o WhatsApp comercial.");
    expect(r.valores?.nome).toBe("Padaria da Ana");
    expect(m.perfis.size).toBe(0);
  });

  it("recusa UF inexistente e informações sociais com link ou @ (só texto)", async () => {
    const m = mundo();
    const uf = await criarPerfil(m.contexto(ANA), formulario(dadosPerfil(m, { uf: "XX" })));
    expect(uf.erros?.uf).toBe("Escolha uma UF válida.");
    const links = await criarPerfil(
      m.contexto(ANA),
      formulario(dadosPerfil(m, { informacoesSociais: "Siga @padaria ou instagram.com/padaria" })),
    );
    expect(links.erros?.informacoesSociais).toMatch(/apenas texto/);
    expect(m.perfis.size).toBe(0);
  });

  it("aceita até 2 categorias secundárias, sem repetir", async () => {
    const m = mundo();
    const repetida = await criarPerfil(
      m.contexto(ANA),
      formulario(dadosPerfil(m, { categoriaSecundaria1: m.categorias[0]!.id })),
    );
    expect(repetida.erros?.categoriasSecundariasIds).toBe("Não repita a mesma categoria.");
    const ok = await criarPerfil(
      m.contexto(ANA),
      formulario(
        dadosPerfil(m, {
          categoriaSecundaria1: m.categorias[1]!.id,
          categoriaSecundaria2: m.categorias[2]!.id,
        }),
      ),
    );
    expect(ok.destino).toBeDefined();
  });

  it("endereço (slug) já usado vira mensagem do módulo, sem texto de banco", async () => {
    const m = mundo();
    await novoPerfil(m, ANA, { slug: "padaria-ana" });
    const r = await criarPerfil(
      m.contexto(BIA),
      formulario(dadosPerfil(m, { slug: "padaria-ana" })),
    );
    expect(r.erros?.slug ?? r.erro).toBe("Este endereço já está em uso. Escolha outro.");
    expect(JSON.stringify(r)).not.toMatch(/duplicate|constraint|perfis_perfil/i);
  });
});

describe("perfil: edição, imagens e envio (IM-017, IM-021, IM-022)", () => {
  it("editar rascunho salva; imagem de outra pasta é recusada", async () => {
    const m = mundo();
    const id = await novoPerfil(m);
    const ana = m.contexto(ANA);
    const salvo = await editarPerfil(
      ana,
      formulario({ id, ...dadosPerfil(m, { nome: "Padaria Nova" }) }),
    );
    expect(salvo.sucesso).toMatch(/^Alterações salvas no rascunho. .*NÃO foram enviadas/);
    expect(m.versoesPerfil.find((v) => v.perfil_id === id)!.nome).toBe("Padaria Nova");

    const alheia = await salvarImagensPerfil(
      ana,
      formulario({ id, imagemPath: caminhoDe("perfil", randomUUID()) }),
    );
    expect(alheia.erros?.imagemPath).toBe("Imagem inválida. Envie novamente.");
  });

  it("salva imagem do perfil, banners (até 3) e fotos (até 6)", async () => {
    const m = mundo();
    const id = await novoPerfil(m);
    const ana = m.contexto(ANA);
    const muitos = (n: number) => Array.from({ length: n }, () => caminhoDe("perfil", id, "jpg"));
    const ok = await salvarImagensPerfil(
      ana,
      formulario({
        id,
        imagemPath: caminhoDe("perfil", id),
        bannersPaths: muitos(3),
        fotosPaths: muitos(6),
      }),
    );
    expect(ok.sucesso).toBe("Imagens salvas.");
    const mais = await salvarImagensPerfil(
      ana,
      formulario({ id, imagemPath: "", fotosPaths: muitos(7) }),
    );
    expect(mais.erros?.fotosPaths).toBe("Use até 6 fotos.");
    const banners = await salvarImagensPerfil(
      ana,
      formulario({ id, imagemPath: "", bannersPaths: muitos(4) }),
    );
    expect(banners.erros?.bannersPaths).toBe("Use até 3 banners.");
  });

  it("não envia incompleto e lista o que falta; depois de completo, envia", async () => {
    const m = mundo();
    const id = await novoPerfil(m);
    const ana = m.contexto(ANA);
    const incompleto = await enviarPerfil(ana, formulario({ id }));
    expect(incompleto.erro).toContain("Preencha os campos obrigatórios");
    expect(incompleto.erro).toContain("Envie a imagem do perfil.");
    await salvarImagensPerfil(ana, formulario({ id, imagemPath: caminhoDe("perfil", id) }));
    const ok = await enviarPerfil(ana, formulario({ id }));
    expect(ok.sucesso).toContain("Enviado para aprovação");
  });

  it("em análise não edita; depois de aprovado a edição cria nova versão e a aprovada segue", async () => {
    const m = mundo();
    const id = await perfilEnviado(m);
    const ana = m.contexto(ANA);
    const bloqueada = await editarPerfil(ana, formulario({ id, ...dadosPerfil(m) }));
    expect(bloqueada.erro).toBe("Este perfil está em análise. Aguarde a decisão antes de editar.");

    const pendente = m.versoesPerfil.find((v) => v.perfil_id === id && v.situacao === "pendente")!;
    await decidirRevisao(
      m.contexto(ADM),
      formulario({ decisao: "aprovar", alvo: "perfil", versaoId: pendente.id }),
    );
    const aprovadaId = m.perfis.get(id)!.versao_aprovada_id;
    expect(aprovadaId).toBe(pendente.id);

    const edicao = await editarPerfil(
      ana,
      formulario({ id, ...dadosPerfil(m, { nome: "Padaria Premium" }) }),
    );
    expect(edicao.sucesso).toMatch(/rascunho.*NÃO foi enviada.*versão aprovada continua no ar/);
    expect(m.perfis.get(id)!.versao_aprovada_id).toBe(aprovadaId);
    expect(m.versoesPerfil.find((v) => v.id === aprovadaId)!.nome).toBe("Padaria da Ana");
    expect(m.versoesPerfil.filter((v) => v.perfil_id === id)).toHaveLength(2);
  });

  it("outra conta não enxerga nem altera o perfil (tratado como inexistente)", async () => {
    const m = mundo();
    const id = await novoPerfil(m);
    const r = await editarPerfil(m.contexto(BIA), formulario({ id, ...dadosPerfil(m) }));
    expect(r.erro).toBe("Perfil não encontrado.");
    const pub = await publicarPerfil(m.contexto(BIA), formulario({ id }));
    expect(pub.erro).toBe("Perfil não encontrado.");
  });

  it("endereço da página só muda antes da primeira aprovação", async () => {
    const m = mundo();
    const id = await novoPerfil(m);
    const ana = m.contexto(ANA);
    const ok = await alterarEnderecoPerfil(ana, formulario({ id, slug: "minha-padaria" }));
    expect(ok.sucesso).toBe("Endereço da página atualizado.");
    const reservado = await alterarEnderecoPerfil(ana, formulario({ id, slug: "admin" }));
    expect(reservado.erro ?? reservado.erros?.slug).toBeTruthy();
    const aprovado = await perfilEnviado(m, true);
    const congelado = await alterarEnderecoPerfil(
      ana,
      formulario({ id: aprovado, slug: "outro-nome" }),
    );
    expect(congelado.erro ?? congelado.erros?.slug).toBe(
      "O endereço não pode mais ser alterado depois da primeira aprovação.",
    );
  });
});

describe("perfil: publicar e despublicar (IM-079)", () => {
  it("só publica depois de aprovado; despublica na hora", async () => {
    const m = mundo();
    const id = await novoPerfil(m);
    const ana = m.contexto(ANA);
    const antes = await publicarPerfil(ana, formulario({ id }));
    expect(antes.erro).toBe("Só é possível publicar um perfil depois de aprovado.");

    const aprovado = await perfilEnviado(m, true);
    const pub = await publicarPerfil(ana, formulario({ id: aprovado }));
    expect(pub.sucesso).toBe("Perfil publicado.");
    expect(m.perfis.get(aprovado)!.publicado).toBe(true);
    const des = await despublicarPerfil(ana, formulario({ id: aprovado }));
    expect(des.sucesso).toContain("saiu do ar");
    expect(m.perfis.get(aprovado)!.publicado).toBe(false);
  });

  it("editar um perfil despublicado não o republica (IM-022)", async () => {
    const m = mundo();
    const id = await perfilEnviado(m, true);
    const ana = m.contexto(ANA);
    await publicarPerfil(ana, formulario({ id }));
    await despublicarPerfil(ana, formulario({ id }));
    await editarPerfil(ana, formulario({ id, ...dadosPerfil(m, { nome: "Outro" }) }));
    expect(m.perfis.get(id)!.publicado).toBe(false);
  });
});

describe("itens e anúncios particulares (IM-014, IM-015)", () => {
  const dadosItem = (m: Mundo, extra: Record<string, string> = {}) => ({
    origem: "anuncio",
    tipo: "produto",
    nome: "Bicicleta aro 29",
    descricao: "Pouco usada.",
    categoriaPrincipalId: m.categorias[2]!.id,
    precoModo: "fixo",
    precoValor: "1.250,50",
    ...extra,
  });

  async function novoItemId(m: Mundo, conta = ANA, extra: Record<string, string> = {}) {
    const r = await criarItem(m.contexto(conta), formulario(dadosItem(m, extra)));
    const id = /\/meus-itens\/([0-9a-f-]{36})/.exec(r.destino ?? "")?.[1];
    if (!id) throw new Error(`item não criado: ${JSON.stringify(r)}`);
    return id;
  }

  it("anúncio particular não tem perfil; o preço em R$ vira centavos", async () => {
    const m = mundo();
    const id = await novoItemId(m);
    expect(m.itens.get(id)!.perfil_id).toBeNull();
    const v = m.versoesItem.find((x) => x.item_id === id)!;
    expect(v.preco_modo).toBe("fixo");
    expect(v.preco_centavos).toBe(125050);
  });

  it("preço: sem preço, a partir de, sob consulta (sem valor) e valor inválido", async () => {
    const m = mundo();
    const semPreco = await novoItemId(m, ANA, { precoModo: "", precoValor: "" });
    expect(m.versoesItem.find((x) => x.item_id === semPreco)!.preco_modo).toBeNull();
    const aPartir = await novoItemId(m, ANA, { precoModo: "a_partir_de", precoValor: "10" });
    expect(m.versoesItem.find((x) => x.item_id === aPartir)!.preco_centavos).toBe(1000);
    const sob = await novoItemId(m, ANA, { precoModo: "sob_consulta", precoValor: "99" });
    const vs = m.versoesItem.find((x) => x.item_id === sob)!;
    expect([vs.preco_modo, vs.preco_centavos]).toEqual(["sob_consulta", null]);

    const ruim = await criarItem(m.contexto(ANA), formulario(dadosItem(m, { precoValor: "abc" })));
    expect(ruim.erros?.precoValor).toMatch(/^Informe um valor entre R\$/);
    const zero = await criarItem(m.contexto(ANA), formulario(dadosItem(m, { precoValor: "0,00" })));
    expect(zero.erros?.precoValor).toMatch(/^Informe um valor entre R\$/);
    const semValor = await criarItem(m.contexto(ANA), formulario(dadosItem(m, { precoValor: "" })));
    expect(semValor.erros?.precoValor).toBeTruthy();
  });

  it("item de perfil exige escolher o perfil e só aceita perfil da própria conta", async () => {
    const m = mundo();
    const faltando = await criarItem(
      m.contexto(ANA),
      formulario(dadosItem(m, { origem: "perfil", perfilId: "" })),
    );
    expect(faltando.erros?.perfilId).toBe("Escolha o perfil do item.");
    const perfilDeBia = await novoPerfil(m, BIA);
    const alheio = await criarItem(
      m.contexto(ANA),
      formulario(dadosItem(m, { origem: "perfil", perfilId: perfilDeBia, tipo: "servico" })),
    );
    expect(alheio.destino).toBeUndefined();
    expect(alheio.erro ?? alheio.erros?.perfilId).toBe(
      "Perfil não encontrado ou não pertence à sua conta.",
    );
    const meuPerfil = await novoPerfil(m, ANA);
    const ok = await criarItem(
      m.contexto(ANA),
      formulario(dadosItem(m, { origem: "perfil", perfilId: meuPerfil, tipo: "servico" })),
    );
    expect(ok.destino).toBeDefined();
  });

  it("foto -> enviar -> aprovar -> publicar; edição depois cria nova versão", async () => {
    const m = mundo();
    const id = await novoItemId(m);
    const ana = m.contexto(ANA);
    const sem = await enviarItem(ana, formulario({ id }));
    expect(sem.erro).toContain("Envie uma foto.");
    const foto = await salvarFotoItem(ana, formulario({ id, fotoPath: caminhoDe("item", id) }));
    expect(foto.sucesso).toBe("Foto salva.");
    const alheia = await salvarFotoItem(
      ana,
      formulario({ id, fotoPath: caminhoDe("item", randomUUID()) }),
    );
    expect(alheia.erros?.fotoPath).toBe("Imagem inválida. Envie novamente.");
    expect((await enviarItem(ana, formulario({ id }))).sucesso).toContain("Enviado para aprovação");

    const pendente = m.versoesItem.find((v) => v.item_id === id)!;
    await decidirRevisao(
      m.contexto(ADM),
      formulario({ decisao: "aprovar", alvo: "item", versaoId: pendente.id }),
    );
    expect((await publicarItem(ana, formulario({ id }))).sucesso).toBe("Publicado.");
    const edit = await editarItem(ana, formulario({ id, ...dadosItem(m, { nome: "Bike nova" }) }));
    expect(edit.sucesso).toMatch(/NÃO foi enviada/);
    expect(m.itens.get(id)!.publicado).toBe(true);
    expect((await despublicarItem(ana, formulario({ id }))).sucesso).toContain("Saiu do ar");
  });
});

describe("administrador: revisão (IM-021, IM-023, IM-077)", () => {
  it("quem não é administrador não decide", async () => {
    const m = mundo();
    const id = await perfilEnviado(m);
    const versao = m.versoesPerfil.find((v) => v.perfil_id === id)!;
    const r = await decidirRevisao(
      m.contexto(BIA),
      formulario({ decisao: "aprovar", alvo: "perfil", versaoId: versao.id }),
    );
    expect(r.erro).toBe("Esta ação é restrita a administradores.");
    expect(versao.situacao).toBe("pendente");
  });

  it("rejeição exige motivo; com motivo, o responsável o vê nos resultados", async () => {
    const m = mundo();
    const id = await perfilEnviado(m);
    const versao = m.versoesPerfil.find((v) => v.perfil_id === id)!;
    const adm = m.contexto(ADM);
    const sem = await decidirRevisao(
      adm,
      formulario({ decisao: "rejeitar", alvo: "perfil", versaoId: versao.id, motivo: "  " }),
    );
    expect(sem.erros?.motivo).toBe("Informe o motivo da rejeição.");
    expect(versao.situacao).toBe("pendente");

    const ok = await decidirRevisao(
      adm,
      formulario({
        decisao: "rejeitar",
        alvo: "perfil",
        versaoId: versao.id,
        motivo: "Imagem fora do padrão.",
      }),
    );
    expect(ok.destino).toBe("/administracao/revisao?decidido=rejeitada");
    const resultados = await m.contexto(ANA).administracao.listarMeusResultados();
    expect(resultados.ok && resultados.valor[0]).toMatchObject({
      situacao: "rejeitado",
      motivo: "Imagem fora do padrão.",
    });
    expect(m.auditoria.some((a) => a.acao === "rejeitada")).toBe(true);
  });

  it("administrador não decide o próprio conteúdo", async () => {
    const m = mundo();
    const id = await novoPerfil(m, ADM);
    const adm = m.contexto(ADM);
    await salvarImagensPerfil(adm, formulario({ id, imagemPath: caminhoDe("perfil", id) }));
    await enviarPerfil(adm, formulario({ id }));
    const versao = m.versoesPerfil.find((v) => v.perfil_id === id)!;
    const r = await decidirRevisao(
      adm,
      formulario({ decisao: "aprovar", alvo: "perfil", versaoId: versao.id }),
    );
    expect(r.erro).toMatch(/próprio conteúdo/);
    expect(versao.situacao).toBe("pendente");
  });

  it("a fila lista pendências e some o que já foi decidido", async () => {
    const m = mundo();
    await perfilEnviado(m);
    const adm = m.contexto(ADM);
    const fila = await adm.administracao.listarFila();
    expect(fila.ok && fila.valor).toHaveLength(1);
    const ana = await m.contexto(ANA).administracao.listarFila();
    expect(ana.ok && ana.valor).toHaveLength(0);
  });
});

describe("categorias (IM-016)", () => {
  it("responsável pede nova categoria; nome repetido é recusado com orientação", async () => {
    const m = mundo();
    const ana = m.contexto(ANA);
    const dup = await solicitarCategoria(
      ana,
      formulario({ nome: "alimentacao", justificativa: "" }),
    );
    expect(dup.erro ?? dup.erros?.nome).toBe("Esta categoria já existe. Escolha-a na lista.");
    const ok = await solicitarCategoria(
      ana,
      formulario({ nome: "Pet shop", justificativa: "Banho e tosa" }),
    );
    expect(ok.sucesso).toContain("Pedido enviado");
    const minhas = await ana.categorias.listarMinhasSolicitacoes();
    expect(minhas.ok && minhas.valor[0]!.nomeSugerido).toBe("Pet shop");
  });

  it("administrador cria, desativa com motivo e decide pedidos; os demais não", async () => {
    const m = mundo();
    const adm = m.contexto(ADM);
    const negado = await criarCategoria(
      m.contexto(ANA),
      formulario({ nome: "Pet shop", ordem: "" }),
    );
    expect(negado.erro).toBe("Esta ação é restrita a administradores.");

    const criada = await criarCategoria(adm, formulario({ nome: "Pet shop", ordem: "9" }));
    expect(criada.sucesso).toBe("Categoria criada.");
    const nova = m.categorias.find((c) => c.slug === "pet-shop")!;

    const semMotivo = await alterarCategoria(
      adm,
      formulario({ id: nova.id, nome: "Pet shop", ordem: "9", ativa: "nao", motivo: "" }),
    );
    expect(semMotivo.erros?.motivo).toBe("Informe o motivo.");
    expect(nova.ativa).toBe(true);
    const ok = await alterarCategoria(
      adm,
      formulario({ id: nova.id, nome: "Pet shop", ordem: "9", ativa: "nao", motivo: "Duplicada" }),
    );
    expect(ok.sucesso).toBe("Categoria atualizada.");
    expect(nova.ativa).toBe(false);
    expect(m.auditoria.at(-1)).toEqual({ acao: "categoria_alterada", motivo: "Duplicada" });
    const ativas = await m.contexto(ANA).categorias.listarAtivas();
    expect(ativas.ok && ativas.valor.some((c) => c.slug === "pet-shop")).toBe(false);

    await solicitarCategoria(
      m.contexto(ANA),
      formulario({ nome: "Fotografia", justificativa: "" }),
    );
    const pedido = m.solicitacoes[0]!;
    const semCategoria = await decidirSolicitacao(
      adm,
      formulario({ id: pedido.id, decisao: "atender" }),
    );
    expect(semCategoria.erros?.categoriaId).toBeTruthy();
    const recusaSemMotivo = await decidirSolicitacao(
      adm,
      formulario({ id: pedido.id, decisao: "recusar", motivo: "" }),
    );
    expect(recusaSemMotivo.erros?.motivo).toBe("Informe o motivo.");
    const recusada = await decidirSolicitacao(
      adm,
      formulario({ id: pedido.id, decisao: "recusar", motivo: "Já coberta por Serviços." }),
    );
    expect(recusada.sucesso).toBe("Pedido recusado.");
    const minhas = await m.contexto(ANA).categorias.listarMinhasSolicitacoes();
    expect(minhas.ok && minhas.valor[0]).toMatchObject({
      situacao: "recusada",
      motivoResposta: "Já coberta por Serviços.",
    });
  });
});
