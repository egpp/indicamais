import { randomUUID } from "node:crypto";
import type {
  ClienteBancoPatrocinadores,
  LinhaPatrocinadorAdmin,
  LinhaPatrocinadorPublico,
} from "@/modules/administracao";
import type { ClienteBancoBusca, LinhaBusca, ParamsBuscaPublica } from "@/modules/busca";
import type { LinhaCategoria, LinhaItemPublico } from "@/modules/catalogo";
import type { LinhaPerfilPublico } from "@/modules/perfis";
import { criarContextoPublico, type ContextoPublico } from "@/app/_lib/contexto-publico";
import type { ClienteBancoLeituraPublica } from "@/app/_lib/leitura-publica";

/**
 * Banco em memória das páginas PÚBLICAS: só o banco é falso; busca, patrocinadores e leitura rodam sobre os
 * MÓDULOS REAIS. Imita o que as visões e a RLS garantem (só aprovado + publicado + perfil disponível) e, de
 * propósito, deixa DADOS PRIVADOS nas linhas internas (WhatsApp, responsável, e-mail, conta, owner): se alguma
 * tela os repassar, os testes de varredura do HTML pegam.
 */

export const SEGREDOS = {
  whatsapp: "+5511987650001",
  whatsappMascarado: "(11) 98765-0001",
  email: "dono.secreto@exemplo.com",
  responsavelId: "9f1d6a0e-1111-4aaa-8bbb-0000000000a1",
  contaId: "9f1d6a0e-2222-4aaa-8bbb-0000000000b2",
  owner: "owner-secreto-123",
} as const;

export const CAMINHO_PUBLICO = "https://storage.exemplo/assinada/";

type PerfilMem = LinhaPerfilPublico & {
  aprovado: boolean;
  publicado: boolean;
  // Privados (nunca saem):
  responsavel_id: string;
  whatsapp_comercial_e164: string;
  email_dono: string;
};
type ItemMem = LinhaItemPublico & {
  aprovado: boolean;
  publicado: boolean;
  // Privados:
  conta_id: string;
  owner: string;
};
type PatrocinadorMem = {
  id: string;
  titulo: string;
  imagem_path: string;
  perfil_destino_id: string | null;
  texto_destino: string | null;
  ordem: number;
  ativo: boolean;
  inicio_em: string | null;
  fim_em: string | null;
};

const sem = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

const caminhoImg = (pasta: "perfil" | "item" | "patrocinador", id: string) =>
  `${pasta}/${id}/${randomUUID()}.webp`;

export function criarMundoPublico(opcoes: { agora?: Date } = {}) {
  const agora = opcoes.agora ?? new Date("2026-10-28T15:00:00Z");
  const categorias: LinhaCategoria[] = [
    { id: randomUUID(), nome: "Alimentação", slug: "alimentacao", ativa: true, ordem: 1 },
    { id: randomUUID(), nome: "Tecnologia", slug: "tecnologia", ativa: true, ordem: 2 },
  ];
  const perfis: PerfilMem[] = [];
  const itens: ItemMem[] = [];
  const patrocinadores: PatrocinadorMem[] = [];
  let admin = false;
  const chamadas = { rpcs: [] as { nome: string; args: unknown }[] };

  const perfilVisivel = (id: string | null) =>
    id === null || perfis.some((p) => p.id === id && p.aprovado && p.publicado);

  function novoPerfil(c: Partial<PerfilMem> & { nome: string; slug: string }): PerfilMem {
    const id = c.id ?? randomUUID();
    const p: PerfilMem = {
      id,
      slug: c.slug,
      nome: c.nome,
      descricao_breve: c.descricao_breve === undefined ? "Descrição do perfil." : c.descricao_breve,
      imagem_path: c.imagem_path === undefined ? caminhoImg("perfil", id) : c.imagem_path,
      categoria_principal_id: c.categoria_principal_id ?? categorias[0]!.id,
      categoria_secundaria_1_id: c.categoria_secundaria_1_id ?? null,
      categoria_secundaria_2_id: c.categoria_secundaria_2_id ?? null,
      cidade: c.cidade ?? "Porto Alegre",
      uf: c.uf ?? "RS",
      endereco: c.endereco ?? null,
      areas_atendidas: c.areas_atendidas ?? [],
      banners_paths: c.banners_paths ?? [],
      fotos_paths: c.fotos_paths ?? [],
      site: c.site ?? null,
      informacoes_sociais: c.informacoes_sociais ?? null,
      aprovado: c.aprovado ?? true,
      publicado: c.publicado ?? true,
      responsavel_id: SEGREDOS.responsavelId,
      whatsapp_comercial_e164: SEGREDOS.whatsapp,
      email_dono: SEGREDOS.email,
    };
    perfis.push(p);
    return p;
  }

  function novoItem(c: Partial<ItemMem> & { nome: string; tipo: "produto" | "servico" }): ItemMem {
    const id = c.id ?? randomUUID();
    const i: ItemMem = {
      id,
      perfil_id: c.perfil_id ?? null,
      tipo: c.tipo,
      nome: c.nome,
      descricao: c.descricao ?? "Descrição do item.",
      foto_path: c.foto_path === undefined ? caminhoImg("item", id) : c.foto_path,
      categoria_principal_id: c.categoria_principal_id ?? categorias[0]!.id,
      categoria_secundaria_1_id: null,
      categoria_secundaria_2_id: null,
      preco_modo: c.preco_modo ?? "fixo",
      preco_centavos: c.preco_centavos === undefined ? 12550 : c.preco_centavos,
      cidade: c.cidade ?? null,
      uf: c.uf ?? null,
      criado_em: c.criado_em ?? "2026-10-20T10:00:00Z",
      aprovado: c.aprovado ?? true,
      publicado: c.publicado ?? true,
      conta_id: SEGREDOS.contaId,
      owner: SEGREDOS.owner,
    };
    itens.push(i);
    return i;
  }

  function novoPatrocinador(c: Partial<PatrocinadorMem> & { titulo: string }): PatrocinadorMem {
    const id = c.id ?? randomUUID();
    const p: PatrocinadorMem = {
      id,
      titulo: c.titulo,
      imagem_path: c.imagem_path ?? caminhoImg("patrocinador", id),
      perfil_destino_id: c.perfil_destino_id ?? null,
      texto_destino:
        c.texto_destino === undefined && !c.perfil_destino_id
          ? "Pão quente"
          : (c.texto_destino ?? null),
      ordem: c.ordem ?? 0,
      ativo: c.ativo ?? true,
      inicio_em: c.inicio_em ?? null,
      fim_em: c.fim_em ?? null,
    };
    patrocinadores.push(p);
    return p;
  }

  // Visões públicas -----------------------------------------------------------------------------------
  const perfisPublicos = () => perfis.filter((p) => p.aprovado && p.publicado);
  const itensPublicos = () =>
    itens.filter((i) => i.aprovado && i.publicado && perfilVisivel(i.perfil_id));

  const naJanela = (p: PatrocinadorMem) =>
    p.ativo &&
    (!p.inicio_em || Date.parse(p.inicio_em) <= agora.getTime()) &&
    (!p.fim_em || Date.parse(p.fim_em) > agora.getTime()) &&
    perfilVisivel(p.perfil_destino_id);

  const bancoBusca: ClienteBancoBusca = {
    async buscar(params: ParamsBuscaPublica) {
      chamadas.rpcs.push({ nome: "busca_publica", args: params });
      const linhas: (Omit<LinhaBusca, "o_total"> & Record<string, unknown>)[] = [
        ...perfisPublicos().map((p) => ({
          o_tipo: "perfil",
          o_id: p.id,
          o_slug: p.slug,
          o_perfil_id: null,
          o_perfil_slug: null,
          o_nome: p.nome,
          o_descricao: p.descricao_breve,
          o_imagem_path: p.imagem_path,
          o_categoria_id: p.categoria_principal_id,
          o_categoria_nome: categorias.find((c) => c.id === p.categoria_principal_id)?.nome ?? null,
          o_categoria_slug: null,
          o_cidade: p.cidade,
          o_uf: p.uf,
          o_preco_modo: null,
          o_preco_centavos: null,
          // Extras que um banco "vazando" poderia devolver: o modelo do módulo deve ignorá-los.
          responsavel_id: p.responsavel_id,
          whatsapp_comercial_e164: p.whatsapp_comercial_e164,
        })),
        ...itensPublicos().map((i) => {
          const dono = perfis.find((p) => p.id === i.perfil_id);
          return {
            o_tipo: i.tipo,
            o_id: i.id,
            o_slug: null,
            o_perfil_id: i.perfil_id,
            o_perfil_slug: dono?.slug ?? null,
            o_nome: i.nome,
            o_descricao: i.descricao,
            o_imagem_path: i.foto_path,
            o_categoria_id: i.categoria_principal_id,
            o_categoria_nome:
              categorias.find((c) => c.id === i.categoria_principal_id)?.nome ?? null,
            o_categoria_slug: null,
            o_cidade: (dono ? dono.cidade : i.cidade) ?? null,
            o_uf: (dono ? dono.uf : i.uf) ?? null,
            o_preco_modo: i.preco_modo,
            o_preco_centavos: i.preco_centavos,
            conta_id: i.conta_id,
            owner: i.owner,
          };
        }),
      ];
      const filtradas = linhas.filter(
        (l) =>
          (!params.p_tipo || l.o_tipo === params.p_tipo) &&
          (!params.p_termo || sem(l.o_nome ?? "").includes(sem(params.p_termo))) &&
          (!params.p_categoria_id || l.o_categoria_id === params.p_categoria_id) &&
          (!params.p_uf || l.o_uf === params.p_uf) &&
          (!params.p_cidade || sem(l.o_cidade ?? "") === sem(params.p_cidade)),
      );
      const inicio = (params.p_pagina - 1) * params.p_limite;
      return {
        dados: filtradas
          .slice(inicio, inicio + params.p_limite)
          .map((l) => ({ ...l, o_total: filtradas.length })) as LinhaBusca[],
        erro: null,
      };
    },
    async listarCategorias() {
      return { dados: categorias, erro: null };
    },
  };

  const bancoPatrocinadores: ClienteBancoPatrocinadores = {
    async listarPublicos() {
      const dados: LinhaPatrocinadorPublico[] = patrocinadores.filter(naJanela).map((p) => {
        const perfil = perfis.find((x) => x.id === p.perfil_destino_id);
        return {
          id: p.id,
          identificacao: "Patrocinado",
          titulo: p.titulo,
          imagem_path: p.imagem_path,
          destino_tipo: p.perfil_destino_id ? "perfil" : "texto",
          destino_perfil_id: p.perfil_destino_id,
          destino_perfil_slug: perfil?.slug ?? null,
          destino_texto: p.texto_destino,
          ordem: p.ordem,
        };
      });
      return { dados, erro: null };
    },
    async ehAdministrador() {
      return admin;
    },
    async listarTodos() {
      const dados: LinhaPatrocinadorAdmin[] = patrocinadores.map((p) => ({
        id: p.id,
        titulo: p.titulo,
        imagem_path: p.imagem_path,
        perfil_destino_id: p.perfil_destino_id,
        texto_destino: p.texto_destino,
        ordem: p.ordem,
        ativo: p.ativo,
        inicio_em: p.inicio_em,
        fim_em: p.fim_em,
        criado_em: "2026-10-20T10:00:00Z",
        atualizado_em: "2026-10-20T10:00:00Z",
      }));
      return { dados, erro: null };
    },
    async criar(p) {
      chamadas.rpcs.push({ nome: "administracao_criar_patrocinador", args: p });
      novoPatrocinador({
        id: p.p_id,
        titulo: p.p_titulo,
        imagem_path: p.p_imagem_path,
        perfil_destino_id: p.p_perfil_destino_id,
        texto_destino: p.p_texto_destino,
        ordem: p.p_ordem,
        ativo: p.p_ativo,
        inicio_em: p.p_inicio_em,
        fim_em: p.p_fim_em,
      });
      return { id: p.p_id, erro: null };
    },
    async alterar(p) {
      chamadas.rpcs.push({ nome: "administracao_alterar_patrocinador", args: p });
      const x = patrocinadores.find((y) => y.id === p.p_id);
      if (!x) return { erro: { code: "P0002", message: "não encontrado" } };
      Object.assign(x, {
        titulo: p.p_titulo,
        imagem_path: p.p_imagem_path,
        perfil_destino_id: p.p_perfil_destino_id,
        texto_destino: p.p_texto_destino,
        ordem: p.p_ordem,
        inicio_em: p.p_inicio_em,
        fim_em: p.p_fim_em,
      });
      return { erro: null };
    },
    async definirAtivo(p) {
      chamadas.rpcs.push({ nome: "administracao_definir_patrocinador_ativo", args: p });
      const x = patrocinadores.find((y) => y.id === p.p_id);
      if (!x) return { erro: { code: "P0002", message: "não encontrado" } };
      x.ativo = p.p_ativo;
      return { erro: null };
    },
  };

  const publico = (p: PerfilMem): LinhaPerfilPublico => ({
    // Seleção de colunas como a do adaptador real: nada de responsável nem WhatsApp.
    id: p.id,
    slug: p.slug,
    nome: p.nome,
    descricao_breve: p.descricao_breve,
    imagem_path: p.imagem_path,
    categoria_principal_id: p.categoria_principal_id,
    categoria_secundaria_1_id: p.categoria_secundaria_1_id,
    categoria_secundaria_2_id: p.categoria_secundaria_2_id,
    cidade: p.cidade,
    uf: p.uf,
    endereco: p.endereco,
    areas_atendidas: p.areas_atendidas,
    banners_paths: p.banners_paths,
    fotos_paths: p.fotos_paths,
    site: p.site,
    informacoes_sociais: p.informacoes_sociais,
  });
  const publicoItem = (i: ItemMem): LinhaItemPublico => {
    const dono = perfis.find((p) => p.id === i.perfil_id);
    return {
      id: i.id,
      perfil_id: i.perfil_id,
      tipo: i.tipo,
      nome: i.nome,
      descricao: i.descricao,
      foto_path: i.foto_path,
      categoria_principal_id: i.categoria_principal_id,
      categoria_secundaria_1_id: i.categoria_secundaria_1_id,
      categoria_secundaria_2_id: i.categoria_secundaria_2_id,
      preco_modo: i.preco_modo,
      preco_centavos: i.preco_centavos,
      cidade: dono ? dono.cidade : i.cidade,
      uf: dono ? dono.uf : i.uf,
      criado_em: i.criado_em,
    };
  };

  const bancoLeitura: ClienteBancoLeituraPublica = {
    async buscarPerfilPorSlug(slug) {
      const p = perfisPublicos().find((x) => x.slug === slug);
      return { dados: p ? publico(p) : null, erro: null };
    },
    async buscarPerfilPorId(id) {
      const p = perfisPublicos().find((x) => x.id === id);
      return { dados: p ? publico(p) : null, erro: null };
    },
    async buscarItemPorId(id) {
      const i = itensPublicos().find((x) => x.id === id);
      return { dados: i ? publicoItem(i) : null, erro: null };
    },
    async listarItensDoPerfil(perfilId) {
      return {
        dados: itensPublicos()
          .filter((i) => i.perfil_id === perfilId)
          .map(publicoItem),
        erro: null,
      };
    },
  };

  function contexto(): ContextoPublico {
    return criarContextoPublico({
      bancoBusca,
      bancoPatrocinadores,
      bancoLeitura,
      assinarImagens: async (caminhos) =>
        Object.fromEntries(caminhos.map((c) => [c, `${CAMINHO_PUBLICO}${c}`])),
    });
  }

  return {
    categorias,
    perfis,
    itens,
    patrocinadores,
    chamadas,
    novoPerfil,
    novoItem,
    novoPatrocinador,
    contexto,
    bancoPatrocinadores,
    bancoBusca,
    definirAdmin: (v: boolean) => {
      admin = v;
    },
  };
}

export type MundoPublico = ReturnType<typeof criarMundoPublico>;
