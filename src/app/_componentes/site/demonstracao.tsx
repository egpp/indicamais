import type { ItemExibicao } from "@/modules/catalogo";
import type { PerfilExibicao } from "@/modules/perfis";
import type { BeneficioPublico } from "@/modules/pontos";
import type { CategoriaOpcao } from "../../_lib/apresentacao";
import type { EstiloId } from "./estilos";

/**
 * Conteúdo de DEMONSTRAÇÃO (D-016): serve só para o responsável avaliar cada estilo na tela Aparência e na prévia,
 * quando o perfil ainda não tem conteúdo. Nome fictício, textos curtos e ilustrações em SVG geradas aqui (sem imagens
 * de terceiros e sem foto de pessoas). Sempre marcado como "exemplo" na tela; nunca vai a página pública nem a
 * mecanismo de busca (as telas que o usam são do painel, com noindex).
 */
export const ID_PERFIL_DEMO = "00000000-0000-4000-8000-0000000000de";

type Motivo = "prato" | "folha" | "arco" | "blocos" | "linhas";
type Paleta = { fundo: string; forma: string; destaque: string; motivo: Motivo };

const PALETAS: Partial<Record<EstiloId, Paleta[]>> = {
  minimalista: [
    { fundo: "#f1f1ee", forma: "#111111", destaque: "#1d4ed8", motivo: "linhas" },
    { fundo: "#e4e4e0", forma: "#555555", destaque: "#111111", motivo: "linhas" },
    { fundo: "#ffffff", forma: "#111111", destaque: "#8a8a8a", motivo: "linhas" },
    { fundo: "#f6f6f4", forma: "#1d4ed8", destaque: "#111111", motivo: "linhas" },
  ],
  gastronomia: [
    { fundo: "#f3e6d0", forma: "#8f1d1d", destaque: "#c8963e", motivo: "prato" },
    { fundo: "#e8cfa6", forma: "#6f1414", destaque: "#fbf4e8", motivo: "prato" },
    { fundo: "#fbf4e8", forma: "#c8963e", destaque: "#8f1d1d", motivo: "prato" },
    { fundo: "#d9b98a", forma: "#2b1a14", destaque: "#fbf4e8", motivo: "prato" },
  ],
  saude_bem_estar: [
    { fundo: "#e5f5f1", forma: "#0f766e", destaque: "#7bd3c6", motivo: "folha" },
    { fundo: "#cfe8e2", forma: "#0b4a52", destaque: "#ffffff", motivo: "folha" },
    { fundo: "#f4fbf9", forma: "#4fb3a6", destaque: "#0f766e", motivo: "folha" },
    { fundo: "#b7e3da", forma: "#0f766e", destaque: "#f4fbf9", motivo: "folha" },
  ],
  beleza_estetica: [
    { fundo: "#f9e7e9", forma: "#8c2f5a", destaque: "#e0b865", motivo: "arco" },
    { fundo: "#f3cdd5", forma: "#5e1d3f", destaque: "#fff8f7", motivo: "arco" },
    { fundo: "#fff8f7", forma: "#e0b865", destaque: "#8c2f5a", motivo: "arco" },
    { fundo: "#e9b8c4", forma: "#8c2f5a", destaque: "#fff8f7", motivo: "arco" },
  ],
  construcao_reformas: [
    { fundo: "#e4e4e0", forma: "#1c2025", destaque: "#f5b800", motivo: "blocos" },
    { fundo: "#f5b800", forma: "#1c2025", destaque: "#ffffff", motivo: "blocos" },
    { fundo: "#cfcfca", forma: "#6b7078", destaque: "#f5b800", motivo: "blocos" },
    { fundo: "#1c2025", forma: "#f5b800", destaque: "#e4e4e0", motivo: "blocos" },
  ],
};

function desenho(p: Paleta, v: number): string {
  const d = (v % 4) * 18;
  switch (p.motivo) {
    case "prato":
      return `<circle cx="${200 + d}" cy="150" r="96" fill="${p.forma}"/><circle cx="${200 + d}" cy="150" r="70" fill="${p.destaque}" opacity=".85"/><circle cx="${200 + d}" cy="150" r="34" fill="${p.forma}" opacity=".7"/><circle cx="${70 + d}" cy="${60 + d}" r="14" fill="${p.destaque}"/><circle cx="${340 - d}" cy="240" r="20" fill="${p.forma}" opacity=".5"/>`;
    case "folha":
      return `<circle cx="${300 - d}" cy="${90 + d}" r="110" fill="${p.destaque}" opacity=".55"/><path d="M${90 + d} 250C${90 + d} 120 190 60 320 60c0 130-80 190-${230 - d} 190z" fill="${p.forma}"/><path d="M${90 + d} 250C160 190 230 130 320 60" fill="none" stroke="${p.fundo}" stroke-width="5" stroke-linecap="round"/>`;
    case "arco":
      return `<path d="M${110 + d} 300V150a${90 - d / 2} ${90 - d / 2} 0 0 1 ${180 - d} 0v150z" fill="${p.forma}"/><path d="M${150 + d} 300V160a${50 - d / 3} ${50 - d / 3} 0 0 1 ${100 - d * 0.66} 0v140z" fill="${p.destaque}" opacity=".7"/><circle cx="${310 - d}" cy="70" r="26" fill="${p.destaque}"/>`;
    case "blocos":
      return `<rect x="${60 + d}" y="170" width="150" height="40" fill="${p.forma}"/><rect x="${110 + d}" y="130" width="150" height="40" fill="${p.destaque}"/><rect x="${60 + d}" y="90" width="150" height="40" fill="${p.forma}" opacity=".7"/><rect x="0" y="210" width="400" height="12" fill="${p.forma}" opacity=".35"/>`;
    default:
      return `<circle cx="${250 - d}" cy="140" r="90" fill="none" stroke="${p.forma}" stroke-width="3" opacity=".7"/><rect x="${60 + d}" y="${70 + d}" width="140" height="6" fill="${p.forma}"/><rect x="${60 + d}" y="${100 + d}" width="90" height="6" fill="${p.destaque}"/><rect x="${60 + d}" y="${130 + d}" width="120" height="6" fill="${p.forma}" opacity=".5"/>`;
  }
}

/** Ilustração local (SVG em data URI) da demonstração: formas, nunca pessoas nem fotos. */
export function ilustracaoDemo(estilo: EstiloId, variante: number): string {
  const lista = PALETAS[estilo] ?? PALETAS.minimalista!;
  const p = lista[variante % lista.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="${p.fundo}"/>${desenho(p, variante)}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

type Roteiro = {
  nome: string;
  categoria: string;
  descricao: string;
  cidade: string;
  endereco: string;
  areas: string[];
  itens: { nome: string; descricao: string; preco: string; tipo: "produto" | "servico" }[];
  beneficios: { nome: string; descricao: string; pontos: number }[];
};

const ROTEIROS: Record<string, Roteiro> = {
  minimalista: {
    nome: "Estúdio Exemplo",
    categoria: "Consultoria",
    descricao:
      "Um negócio de exemplo para você ver como a sua página fica. Texto curto, direto e fácil de ler no celular.",
    cidade: "Maceió",
    endereco: "Rua Exemplo, 100, Centro",
    areas: ["Centro", "Ponta Verde", "Jatiúca"],
    itens: [
      {
        nome: "Atendimento avulso",
        descricao: "Uma conversa para entender o que você precisa.",
        preco: "R$ 90,00",
        tipo: "servico",
      },
      {
        nome: "Pacote mensal",
        descricao: "Acompanhamento durante o mês, com retorno rápido.",
        preco: "R$ 280,00",
        tipo: "servico",
      },
      {
        nome: "Kit de boas-vindas",
        descricao: "Material de apoio para começar com o pé direito.",
        preco: "R$ 45,00",
        tipo: "produto",
      },
      {
        nome: "Plano trimestral",
        descricao: "Três meses com condição especial.",
        preco: "A partir de R$ 690,00",
        tipo: "servico",
      },
    ],
    beneficios: [
      {
        nome: "Primeira conversa de cortesia",
        descricao: "Exemplo de benefício em pontos.",
        pontos: 50,
      },
      { nome: "Desconto no pacote mensal", descricao: "Exemplo de benefício.", pontos: 120 },
    ],
  },
  gastronomia: {
    nome: "Cantina Exemplo",
    categoria: "Restaurante",
    descricao:
      "Comida feita na hora, com tempero de casa. Um restaurante de exemplo para você avaliar o cardápio da sua página.",
    cidade: "Maceió",
    endereco: "Avenida Exemplo, 250, Pajuçara",
    areas: ["Pajuçara", "Ponta Verde", "Mangabeiras"],
    itens: [
      {
        nome: "Prato do dia",
        descricao: "Arroz, feijão, salada e a mistura do dia.",
        preco: "R$ 32,00",
        tipo: "produto",
      },
      {
        nome: "Risoto de cogumelos",
        descricao: "Cremoso, finalizado com queijo e ervas.",
        preco: "R$ 54,00",
        tipo: "produto",
      },
      {
        nome: "Sobremesa da casa",
        descricao: "Porção individual, feita no dia.",
        preco: "R$ 18,00",
        tipo: "produto",
      },
      {
        nome: "Combo para a família",
        descricao: "Serve quatro pessoas, com bebida.",
        preco: "R$ 149,00",
        tipo: "produto",
      },
    ],
    beneficios: [
      {
        nome: "Sobremesa por conta da casa",
        descricao: "Exemplo de benefício em pontos.",
        pontos: 80,
      },
      { nome: "Bebida na compra do prato do dia", descricao: "Exemplo.", pontos: 40 },
    ],
  },
  saude_bem_estar: {
    nome: "Clínica Exemplo Bem-estar",
    categoria: "Clínica de saúde",
    descricao:
      "Cuidado com calma e atenção. Uma clínica de exemplo para você ver como a sua página transmite confiança.",
    cidade: "Maceió",
    endereco: "Rua Exemplo, 55, Farol",
    areas: ["Farol", "Gruta de Lourdes", "Jatiúca"],
    itens: [
      {
        nome: "Avaliação inicial",
        descricao: "Primeira consulta para entender suas necessidades.",
        preco: "R$ 120,00",
        tipo: "servico",
      },
      {
        nome: "Sessão de fisioterapia",
        descricao: "Atendimento individual de cinquenta minutos.",
        preco: "R$ 95,00",
        tipo: "servico",
      },
      {
        nome: "Pacote com oito sessões",
        descricao: "Condição especial para tratamento contínuo.",
        preco: "R$ 680,00",
        tipo: "servico",
      },
      {
        nome: "Orientação alimentar",
        descricao: "Plano simples para a sua rotina.",
        preco: "A partir de R$ 150,00",
        tipo: "servico",
      },
    ],
    beneficios: [
      {
        nome: "Desconto na avaliação inicial",
        descricao: "Exemplo de benefício em pontos.",
        pontos: 100,
      },
      { nome: "Sessão extra no pacote", descricao: "Exemplo.", pontos: 250 },
    ],
  },
  beleza_estetica: {
    nome: "Espaço Exemplo Beleza",
    categoria: "Salão de beleza",
    descricao:
      "Cuidado e capricho em cada detalhe. Um salão de exemplo para você avaliar a galeria e a elegância da sua página.",
    cidade: "Maceió",
    endereco: "Rua Exemplo, 77, Ponta Verde",
    areas: ["Ponta Verde", "Jatiúca", "Pajuçara"],
    itens: [
      {
        nome: "Corte e escova",
        descricao: "Atendimento com hora marcada.",
        preco: "R$ 85,00",
        tipo: "servico",
      },
      {
        nome: "Manicure e pedicure",
        descricao: "Esmaltação e cuidado completo.",
        preco: "R$ 60,00",
        tipo: "servico",
      },
      {
        nome: "Limpeza de pele",
        descricao: "Higienização e hidratação profunda.",
        preco: "R$ 130,00",
        tipo: "servico",
      },
      {
        nome: "Hidratação capilar",
        descricao: "Tratamento para fios mais macios.",
        preco: "A partir de R$ 90,00",
        tipo: "servico",
      },
    ],
    beneficios: [
      { nome: "Hidratação de cortesia", descricao: "Exemplo de benefício em pontos.", pontos: 90 },
      { nome: "Desconto na limpeza de pele", descricao: "Exemplo.", pontos: 150 },
    ],
  },
  construcao_reformas: {
    nome: "Exemplo Construções e Reformas",
    categoria: "Reformas e construção",
    descricao:
      "Obra limpa, prazo combinado e orçamento claro. Uma empresa de exemplo para você avaliar uma página forte e técnica.",
    cidade: "Maceió",
    endereco: "Rua Exemplo, 900, Tabuleiro",
    areas: ["Tabuleiro", "Cruz das Almas", "Jacintinho", "Benedito Bentes"],
    itens: [
      {
        nome: "Reforma de banheiro",
        descricao: "Do projeto ao acabamento, com prazo combinado.",
        preco: "Sob consulta",
        tipo: "servico",
      },
      {
        nome: "Pintura residencial",
        descricao: "Preparo da parede, tinta e acabamento.",
        preco: "A partir de R$ 18,00 o m²",
        tipo: "servico",
      },
      {
        nome: "Instalação de piso",
        descricao: "Porcelanato, cerâmica e laminado.",
        preco: "A partir de R$ 45,00 o m²",
        tipo: "servico",
      },
      {
        nome: "Visita técnica",
        descricao: "Avaliação no local e orçamento por escrito.",
        preco: "R$ 80,00",
        tipo: "servico",
      },
    ],
    beneficios: [
      {
        nome: "Visita técnica de cortesia",
        descricao: "Exemplo de benefício em pontos.",
        pontos: 120,
      },
      { nome: "Desconto na mão de obra", descricao: "Exemplo.", pontos: 400 },
    ],
  },
};

export type DemonstracaoSite = {
  perfil: PerfilExibicao;
  itens: ItemExibicao[];
  beneficios: BeneficioPublico[];
  categorias: CategoriaOpcao[];
  urls: Record<string, string>;
};

const ID_CATEGORIA_DEMO = "demo-categoria";

/**
 * Perfil, itens e benefícios fictícios do estilo. Se `base` já tem nome/descrição/etc., esses campos reais são
 * mantidos: a demonstração só preenche o que falta.
 */
export function demonstracaoDoEstilo(estilo: EstiloId, base?: PerfilExibicao): DemonstracaoSite {
  const r = ROTEIROS[estilo] ?? ROTEIROS.minimalista;
  const urls: Record<string, string> = {};
  const foto = (chave: string, v: number) => {
    urls[chave] = ilustracaoDemo(estilo, v);
    return chave;
  };
  const fotos = [0, 1, 2, 3].map((v) => foto(`demo/${estilo}/foto-${v}`, v));
  const perfil: PerfilExibicao = {
    id: base?.id ?? ID_PERFIL_DEMO,
    slug: base?.slug ?? "exemplo",
    nome: base?.nome ?? r.nome,
    descricaoBreve: base?.descricaoBreve ?? r.descricao,
    imagemPath: base?.imagemPath ?? null,
    categoriaPrincipalId: base?.categoriaPrincipalId ?? ID_CATEGORIA_DEMO,
    categoriasSecundariasIds: base?.categoriasSecundariasIds ?? [],
    cidade: base?.cidade ?? r.cidade,
    uf: base?.uf ?? "AL",
    endereco: base?.endereco ?? r.endereco,
    areasAtendidas: base && base.areasAtendidas.length > 0 ? base.areasAtendidas : r.areas,
    bannersPaths: [],
    fotosPaths: base && base.fotosPaths.length > 0 ? base.fotosPaths : fotos,
    site: base?.site ?? null,
    informacoesSociais: base?.informacoesSociais ?? null,
  };
  const itens: ItemExibicao[] = r.itens.map((i, n) => ({
    id: `demo-${n + 1}`,
    perfilId: perfil.id,
    anuncioParticular: false,
    tipo: i.tipo,
    nome: i.nome,
    descricao: i.descricao,
    fotoPath: foto(`demo/${estilo}/item-${n}`, n),
    categoriaPrincipalId: null,
    categoriasSecundariasIds: [],
    preco: null,
    cidade: null,
    uf: null,
    precoTexto: i.preco,
  }));
  const beneficios: BeneficioPublico[] = r.beneficios.map((b, n) => ({
    id: `demo-beneficio-${n + 1}`,
    perfilId: perfil.id,
    nome: b.nome,
    descricao: b.descricao,
    pontosNecessarios: b.pontos,
    condicoes: null,
    limiteTotal: null,
    limitePorPessoa: null,
    prazoResgateAte: null,
    prazoUsoDias: null,
  }));
  return {
    perfil,
    itens,
    beneficios,
    categorias: [{ id: ID_CATEGORIA_DEMO, nome: r.categoria }],
    urls,
  };
}

/** O perfil ainda não tem o mínimo para a página parecer um site (nome e descrição). */
export const perfilSemConteudo = (p: PerfilExibicao): boolean =>
  !p.nome?.trim() || !p.descricaoBreve?.trim();

/** Formulário de contato só para olhar o desenho (inerte: não recebe foco nem envia nada). */
export function FormularioExemplo() {
  return (
    <div className="st-form-exemplo" inert>
      <p className="st-exemplo-nota">
        Exemplo do formulário. O pedido de contato de verdade aparece na página publicada.
      </p>
      <div className="campo">
        <label>Seu nome</label>
        <input type="text" tabIndex={-1} readOnly value="" placeholder="Como podemos te chamar" />
      </div>
      <div className="campo">
        <label>Mensagem</label>
        <textarea tabIndex={-1} readOnly rows={3} placeholder="Conte o que você precisa" />
      </div>
      <span className="botao">Enviar pedido de contato</span>
    </div>
  );
}
