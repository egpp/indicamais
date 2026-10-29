import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { formulario } from "../../../tests/suporte/bancos-memoria";
import {
  URL_BASE,
  WHATSAPP_RESPONSAVEL,
  criarMundoIndicacoes,
  type Usuario,
} from "../../../tests/suporte/banco-indicacoes-memoria";
import { criarMundoPublico } from "../../../tests/suporte/bancos-publicos-memoria";
import {
  definirParametroAdmin,
  enviarContatoVisitante,
  gerarLinkDeIndicacao,
  pedirReenvio,
  reenviarComoAdmin,
  registrarCompartilhamentoDeLink,
  tratarAlertaAdmin,
} from "./tratadores-indicacoes";

const CHAVE = "chave-de-teste-0123456789";

function cenario(usuario: Usuario | null = null, donoDoPerfil = false) {
  const publico = criarMundoPublico();
  const perfil = publico.novoPerfil({ nome: "Padaria da Ana", slug: "padaria-da-ana" });
  const item = publico.novoItem({ nome: "Bolo de cenoura", tipo: "produto", perfil_id: perfil.id });
  const mundo = criarMundoIndicacoes({
    usuario,
    donos: donoDoPerfil && usuario ? { [perfil.id]: usuario.id, [item.id]: usuario.id } : {},
  });
  return { perfil, item, mundo, ctx: mundo.contexto(publico.contexto().leitura) };
}

const contato = (extra: Record<string, string> = {}) => ({
  tipo: "perfil",
  slug: "padaria-da-ana",
  nome: "Carla Visitante",
  whatsapp: "(11) 98765-4321",
  email: "",
  mensagem: "",
  chave: CHAVE,
  ...extra,
});

describe("contato do visitante (IM-026, IM-028)", () => {
  it("anônimo: normaliza o WhatsApp no servidor e devolve o wa.me do responsável com a mensagem curta", async () => {
    const { ctx, mundo, perfil } = cenario(null);
    const r = await enviarContatoVisitante(ctx, formulario(contato()));
    expect(r.erro).toBeUndefined();
    expect(r.urlWhatsapp).toMatch(
      new RegExp(`^https://wa\\.me/${WHATSAPP_RESPONSAVEL.slice(1)}\\?text=`),
    );
    const texto = decodeURIComponent(r.urlWhatsapp!.split("text=")[1]!);
    expect(texto).toContain("Padaria da Ana");
    expect(texto).toContain("Carla Visitante");
    // Nada além do nome: nem o WhatsApp nem o e-mail do visitante vão no texto.
    expect(texto).not.toMatch(/11|98765|@/);
    expect(mundo.chamadasContato[0]).toMatchObject({
      perfilId: perfil.id,
      itemId: null,
      whatsapp: "+5511987654321",
      email: null,
      mensagem: null,
      codigo: null,
    });
  });

  it("reenvio com a MESMA chave não duplica o pedido (IM-028)", async () => {
    const { ctx, mundo } = cenario(null);
    const a = await enviarContatoVisitante(ctx, formulario(contato()));
    const b = await enviarContatoVisitante(ctx, formulario(contato()));
    expect(a.urlWhatsapp).toBeTruthy();
    expect(b.urlWhatsapp).toBe(a.urlWhatsapp);
    expect(mundo.pedidos).toHaveLength(1);
    expect(mundo.chamadasContato.map((c) => c.chave)).toEqual([CHAVE, CHAVE]);
  });

  it("?ind válido segue para o banco só deste destino; malformado é descartado sem erro (IM-025)", async () => {
    const { ctx, mundo } = cenario(null);
    const codigo = "a".repeat(32);
    await enviarContatoVisitante(ctx, formulario(contato({ ind: codigo })));
    await enviarContatoVisitante(ctx, formulario(contato({ ind: "<script>", chave: `${CHAVE}2` })));
    expect(mundo.chamadasContato[0]!.codigo).toBe(codigo);
    expect(mundo.chamadasContato[1]!.codigo).toBeNull();
    expect(mundo.pedidos).toHaveLength(2);
  });

  it("item: usa o id do item e o nome vem do servidor, não do navegador", async () => {
    const { ctx, mundo, item } = cenario(null);
    const r = await enviarContatoVisitante(
      ctx,
      formulario(contato({ tipo: "item", id: item.id, slug: "", nomeDestino: "Nome forjado" })),
    );
    expect(mundo.chamadasContato[0]).toMatchObject({ itemId: item.id, perfilId: null });
    expect(decodeURIComponent(r.urlWhatsapp!)).toContain("Bolo de cenoura");
    expect(decodeURIComponent(r.urlWhatsapp!)).not.toContain("Nome forjado");
  });

  it("validação: erro por campo em português, valores preservados e nada enviado ao banco", async () => {
    const { ctx, mundo } = cenario(null);
    const r = await enviarContatoVisitante(
      ctx,
      formulario(contato({ nome: "", whatsapp: "123", email: "sem-arroba" })),
    );
    expect(r.urlWhatsapp).toBeUndefined();
    expect(r.erros?.nome).toBe("Informe seu nome.");
    expect(r.erros?.whatsapp).toMatch(/WhatsApp válido com DDD/);
    expect(r.erros?.email).toBe("E-mail inválido.");
    expect(r.valores).toMatchObject({ whatsapp: "123", email: "sem-arroba" });
    expect(mundo.chamadasContato).toHaveLength(0);
  });

  it("chave inválida vira aviso geral (o campo não existe na tela)", async () => {
    const { ctx } = cenario(null);
    const r = await enviarContatoVisitante(ctx, formulario(contato({ chave: "curta" })));
    expect(r.erros).toBeUndefined();
    expect(r.erro).toBe("Chave de envio inválida.");
  });

  it("destino inexistente ou indisponível: mensagem do módulo, sem tocar no banco de contato", async () => {
    const { ctx, mundo } = cenario(null);
    const r = await enviarContatoVisitante(ctx, formulario(contato({ slug: "nao-existe" })));
    expect(r.erro).toBe("Este perfil ou anúncio não está disponível no momento.");
    const s = await enviarContatoVisitante(
      ctx,
      formulario(contato({ tipo: "item", id: randomUUID() })),
    );
    expect(s.erro).toBe("Este perfil ou anúncio não está disponível no momento.");
    const t = await enviarContatoVisitante(ctx, formulario(contato({ tipo: "outro" })));
    expect(t.erro).toBe("Este perfil ou anúncio não está disponível no momento.");
    expect(mundo.chamadasContato).toHaveLength(0);
  });

  it("limite do banco volta como mensagem do módulo, sem texto interno", async () => {
    const { ctx, mundo } = cenario(null);
    mundo.banco.enviarContato = async () => ({
      dados: null,
      erro: { code: "P0429", message: "tabela indicacoes_pedido_contato linha 7" },
    });
    const r = await enviarContatoVisitante(ctx, formulario(contato()));
    expect(r.erro).toBe("Muitos pedidos em pouco tempo. Tente novamente mais tarde.");
    expect(JSON.stringify(r)).not.toMatch(/tabela|linha 7/);
  });
});

describe("Indique (IM-024)", () => {
  it("não logado: leva a entrar, sem chamar o banco", async () => {
    const { ctx } = cenario(null);
    const r = await gerarLinkDeIndicacao(
      ctx,
      formulario({ tipo: "perfil", slug: "padaria-da-ana" }),
    );
    expect(r.passo).toBe("entrar");
    expect(r.erro).toBe("Entre na sua conta para continuar.");
    expect(r.link).toBeUndefined();
  });

  it("logado sem WhatsApp: leva a Minha conta", async () => {
    const { ctx } = cenario({ id: randomUUID() });
    const r = await gerarLinkDeIndicacao(
      ctx,
      formulario({ tipo: "perfil", slug: "padaria-da-ana" }),
    );
    expect(r.passo).toBe("whatsapp");
    expect(r.erro).toBe("Cadastre seu WhatsApp na sua conta antes de indicar.");
  });

  it("dono do perfil ou do item: mensagem de autoindicação", async () => {
    const { ctx, item } = cenario({ id: randomUUID(), comWhatsapp: true }, true);
    const p = await gerarLinkDeIndicacao(
      ctx,
      formulario({ tipo: "perfil", slug: "padaria-da-ana" }),
    );
    const i = await gerarLinkDeIndicacao(ctx, formulario({ tipo: "item", id: item.id }));
    for (const r of [p, i]) {
      expect(r.passo).toBe("autoindicacao");
      expect(r.erro).toBe(
        "Você não pode gerar link de indicação para o seu próprio perfil ou anúncio.",
      );
    }
  });

  it("logado com WhatsApp: link com ?ind, texto com o nome do destino e URL do WhatsApp", async () => {
    const { ctx, perfil, item } = cenario({ id: randomUUID(), comWhatsapp: true });
    const p = await gerarLinkDeIndicacao(
      ctx,
      formulario({ tipo: "perfil", slug: "padaria-da-ana" }),
    );
    expect(p.link?.codigo).toMatch(/^[0-9a-f]{32}$/);
    expect(p.link?.url).toBe(`${URL_BASE}/perfil/padaria-da-ana?ind=${p.link!.codigo}`);
    expect(p.link?.texto).toContain("Padaria da Ana");
    expect(p.link?.urlWhatsapp).toMatch(/^https:\/\/wa\.me\/\?text=/);
    // Perfil também pode ser resolvido por id (lista "Minhas indicações").
    const porId = await gerarLinkDeIndicacao(ctx, formulario({ tipo: "perfil", id: perfil.id }));
    expect(porId.link?.url).toBe(p.link?.url);
    const i = await gerarLinkDeIndicacao(ctx, formulario({ tipo: "item", id: item.id }));
    expect(i.link?.url).toBe(`${URL_BASE}/item/${item.id}?ind=${i.link!.codigo}`);
    expect(i.link?.texto).toContain("Bolo de cenoura");
  });

  it("destino indisponível: aviso do módulo", async () => {
    const { ctx } = cenario({ id: randomUUID(), comWhatsapp: true });
    const r = await gerarLinkDeIndicacao(ctx, formulario({ tipo: "item", id: randomUUID() }));
    expect(r.erro).toBe("Este perfil ou anúncio não está disponível no momento.");
  });

  it("registra o compartilhamento só para logado e canal válido", async () => {
    const logado = cenario({ id: randomUUID(), comWhatsapp: true });
    const codigo = "b".repeat(32);
    expect(await registrarCompartilhamentoDeLink(logado.ctx, codigo, "copiar")).toBe(true);
    expect(await registrarCompartilhamentoDeLink(logado.ctx, codigo, "whatsapp")).toBe(true);
    expect(await registrarCompartilhamentoDeLink(logado.ctx, codigo, "pombo")).toBe(false);
    expect(logado.mundo.compartilhamentos.map((c) => c.canal)).toEqual(["copiar", "whatsapp"]);
    const anonimo = cenario(null);
    expect(await registrarCompartilhamentoDeLink(anonimo.ctx, codigo, "copiar")).toBe(false);
    expect(anonimo.mundo.compartilhamentos).toHaveLength(0);
  });
});

describe("responsável e administração (IM-028, IM-034)", () => {
  const pedidoId = randomUUID();

  it("responsável pede reenvio", async () => {
    const { ctx, mundo } = cenario({ id: randomUUID() });
    const r = await pedirReenvio(ctx, formulario({ pedidoId }));
    expect(r.sucesso).toBe("Novo envio solicitado.");
    expect(mundo.reenvios).toEqual([{ pedidoId, motivo: null }]);
    const ruim = await pedirReenvio(ctx, formulario({ pedidoId: "xx" }));
    expect(ruim.erro).toBeTruthy();
    expect(mundo.reenvios).toHaveLength(1);
  });

  it("administrador: motivo obrigatório no reenvio e no tratamento do alerta", async () => {
    const { ctx, mundo } = cenario({ id: randomUUID(), admin: true });
    const sem = await reenviarComoAdmin(ctx, formulario({ pedidoId, motivo: "  " }));
    expect(sem.erros?.motivo).toBe("Informe o motivo.");
    const semAlerta = await tratarAlertaAdmin(ctx, formulario({ pedidoId, motivo: "" }));
    expect(semAlerta.erros?.motivo).toBe("Informe o motivo.");
    expect(mundo.reenvios).toHaveLength(0);
    expect(mundo.alertasTratados).toHaveLength(0);

    const a = await reenviarComoAdmin(ctx, formulario({ pedidoId, motivo: "E-mail corrigido" }));
    expect(a.sucesso).toBe("Reenvio solicitado.");
    expect(mundo.reenvios).toEqual([{ pedidoId, motivo: "E-mail corrigido" }]);
    const b = await tratarAlertaAdmin(ctx, formulario({ pedidoId, motivo: "Falso positivo" }));
    expect(b.sucesso).toBe("Alerta marcado como tratado.");
    expect(mundo.alertasTratados).toEqual([{ pedidoId, motivo: "Falso positivo" }]);
  });

  it("quem não é administrador recebe 'sem permissão' e nada chega ao banco", async () => {
    const { ctx, mundo } = cenario({ id: randomUUID() });
    const f = formulario({ pedidoId, motivo: "x", chave: "contato_limite_por_hora", valor: "5" });
    for (const r of [
      await reenviarComoAdmin(ctx, f),
      await tratarAlertaAdmin(ctx, f),
      await definirParametroAdmin(ctx, f),
    ]) {
      expect(r.erro).toBe("Você não tem permissão para esta ação.");
    }
    expect(mundo.reenvios).toHaveLength(0);
    expect(mundo.alertasTratados).toHaveLength(0);
    expect(mundo.definicoes).toHaveLength(0);
  });

  it("parâmetro: valor dentro da faixa com motivo grava; fora da faixa mostra mínimo e máximo", async () => {
    const { ctx, mundo } = cenario({ id: randomUUID(), admin: true });
    const base = { chave: "contato_limite_por_hora" };
    const ok = await definirParametroAdmin(
      ctx,
      formulario({ ...base, valor: "10", motivo: "Mais folga" }),
    );
    expect(ok.sucesso).toBe("Parâmetro atualizado.");
    expect(mundo.definicoes).toEqual([{ chave: base.chave, valor: 10, motivo: "Mais folga" }]);

    const alto = await definirParametroAdmin(
      ctx,
      formulario({ ...base, valor: "99", motivo: "x" }),
    );
    expect(alto.erros?.valor).toBe("Informe um valor entre 1 e 50.");
    const texto = await definirParametroAdmin(
      ctx,
      formulario({ ...base, valor: "abc", motivo: "x" }),
    );
    expect(texto.erros?.valor).toBe("Informe um número inteiro.");
    const vazio = await definirParametroAdmin(ctx, formulario({ ...base, valor: "", motivo: "x" }));
    expect(vazio.erros?.valor).toBe("Informe um número inteiro.");
    const semMotivo = await definirParametroAdmin(
      ctx,
      formulario({ ...base, valor: "5", motivo: "" }),
    );
    expect(semMotivo.erros?.motivo).toBe("Informe o motivo.");
    expect(mundo.definicoes).toHaveLength(1);
  });
});
