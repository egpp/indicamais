/**
 * Conteúdo de DEMONSTRAÇÃO dos estilos 6 a 20 (D-016; IM-091): negócios fictícios e ilustrações em formas, só para
 * o responsável avaliar cada estilo na tela Aparência. Mesmo contrato dos 5 primeiros (`demonstracao.tsx`).
 * Nenhum dado real, nenhuma foto de pessoa.
 */
type Motivo = "prato" | "folha" | "arco" | "blocos" | "linhas";
export type PaletaDemo = { fundo: string; forma: string; destaque: string; motivo: Motivo };
export type RoteiroDemo = {
  nome: string;
  categoria: string;
  descricao: string;
  cidade: string;
  endereco: string;
  areas: string[];
  itens: { nome: string; descricao: string; preco: string; tipo: "produto" | "servico" }[];
  beneficios: { nome: string; descricao: string; pontos: number }[];
};

const P = (motivo: Motivo, c: [string, string, string][]): PaletaDemo[] =>
  c.map(([fundo, forma, destaque]) => ({ fundo, forma, destaque, motivo }));

export const PALETAS_NOVAS: Record<string, PaletaDemo[]> = {
  basico: P("linhas", [
    ["#e0eaff", "#1d4ed8", "#0f172a"],
    ["#eef3fc", "#1d4ed8", "#93b4ff"],
    ["#ffffff", "#1d4ed8", "#0f172a"],
    ["#c7d8ff", "#0f172a", "#1d4ed8"],
  ]),
  cafe_padaria: P("prato", [
    ["#fde8a6", "#1d3f94", "#4a2a18"],
    ["#f1cfa0", "#4a2a18", "#fff8e6"],
    ["#fff8e6", "#c27a2c", "#1d3f94"],
    ["#e8b574", "#1d3f94", "#fff8e6"],
  ]),
  moto_bike: P("blocos", [
    ["#23282e", "#c8102e", "#f4f4f1"],
    ["#c8102e", "#14181c", "#ffffff"],
    ["#d6d7d4", "#14181c", "#c8102e"],
    ["#14181c", "#c8102e", "#d6d7d4"],
  ]),
  automotivo: P("blocos", [
    ["#2a3038", "#ff5a1f", "#f1f1ef"],
    ["#ff5a1f", "#14181c", "#ffffff"],
    ["#d4d6d8", "#14181c", "#ff5a1f"],
    ["#14181c", "#ff5a1f", "#d4d6d8"],
  ]),
  juridico_contabil: P("linhas", [
    ["#e7e2d8", "#0e2a3d", "#b07a4a"],
    ["#0e2a3d", "#e0aa6f", "#f6f1e9"],
    ["#f6f1e9", "#0e2a3d", "#b07a4a"],
    ["#d9d0c0", "#143a52", "#0e2a3d"],
  ]),
  educacao_cursos: P("blocos", [
    ["#e9e1f8", "#4c1d95", "#c8ec4f"],
    ["#c8ec4f", "#4c1d95", "#ffffff"],
    ["#4c1d95", "#c8ec4f", "#e9e1f8"],
    ["#f9d4cc", "#4c1d95", "#ffffff"],
  ]),
  pet: P("prato", [
    ["#dff0e2", "#0f5a4a", "#f4896b"],
    ["#fbdcc6", "#f4896b", "#0f4d3f"],
    ["#fdf4e7", "#0f5a4a", "#f4896b"],
    ["#bfdcc6", "#f4896b", "#fffdf9"],
  ]),
  moda_lojas: P("arco", [
    ["#efe9e1", "#111111", "#1d3dd6"],
    ["#d9cfc2", "#1d3dd6", "#faf8f5"],
    ["#e6ecf7", "#111111", "#c8a97a"],
    ["#faf8f5", "#8a6a4a", "#111111"],
  ]),
  fitness_esportes: P("blocos", [
    ["#101415", "#d4ff1f", "#f2f2ee"],
    ["#d4ff1f", "#0d0f10", "#ffffff"],
    ["#2b3236", "#d4ff1f", "#ffffff"],
    ["#e6e6e0", "#0d0f10", "#d4ff1f"],
  ]),
  imobiliario: P("blocos", [
    ["#efe6da", "#17434a", "#e8c9a0"],
    ["#17434a", "#e8c9a0", "#ffffff"],
    ["#fbf8f3", "#8a4b24", "#17434a"],
    ["#d9e4e2", "#17434a", "#8a4b24"],
  ]),
  tecnologia_assistencia: P("linhas", [
    ["#e4ebfb", "#1537d6", "#0b1230"],
    ["#1537d6", "#ffffff", "#c9d6ff"],
    ["#f4f6fb", "#0b1230", "#1537d6"],
    ["#c9d6ff", "#1537d6", "#ffffff"],
  ]),
  casa_decoracao: P("arco", [
    ["#eee3d3", "#9a3f25", "#fffaf3"],
    ["#4b5a3a", "#eee3d3", "#c9a77a"],
    ["#f8f2ea", "#9a3f25", "#4b5a3a"],
    ["#d9c4a6", "#4b5a3a", "#fffaf3"],
  ]),
  eventos_fotografia: P("arco", [
    ["#231f26", "#c9b3e4", "#f7f1ea"],
    ["#e9dfd3", "#231f26", "#6a3fa0"],
    ["#c9b3e4", "#231f26", "#ffffff"],
    ["#f7f1ea", "#6a3fa0", "#231f26"],
  ]),
  servicos_rapidos: P("blocos", [
    ["#e3eefb", "#0b4fb8", "#ff8a2a"],
    ["#ff8a2a", "#0b2f6b", "#ffffff"],
    ["#fdf6ee", "#0b4fb8", "#ff8a2a"],
    ["#0b4fb8", "#ffffff", "#ff8a2a"],
  ]),
  agro_campo: P("folha", [
    ["#efe5cc", "#1f4d2e", "#e8c98a"],
    ["#1f4d2e", "#e8c98a", "#f6f0e6"],
    ["#f6f0e6", "#2f6a3f", "#a2441f"],
    ["#cfdcc2", "#1f4d2e", "#fffdf8"],
  ]),
  turismo_hospedagem: P("folha", [
    ["#e8f1ef", "#0e4a4f", "#f1e3c8"],
    ["#157076", "#f1e3c8", "#ffffff"],
    ["#fbf6ee", "#0e4a4f", "#e3a86a"],
    ["#bfe0dc", "#0e4a4f", "#fbf6ee"],
  ]),
  premium: P("arco", [
    ["#14110f", "#d9a566", "#f1ebe2"],
    ["#e7dfd2", "#14110f", "#7f5224"],
    ["#2a231d", "#d9a566", "#f1ebe2"],
    ["#f1ebe2", "#7f5224", "#14110f"],
  ]),
};

type It = [string, string, string, "produto" | "servico"];
const R = (
  nome: string,
  categoria: string,
  descricao: string,
  endereco: string,
  areas: string[],
  itens: It[],
  beneficios: [string, number][],
): RoteiroDemo => ({
  nome,
  categoria,
  descricao,
  cidade: "Maceió",
  endereco,
  areas,
  itens: itens.map(([n, d, p, t]) => ({ nome: n, descricao: d, preco: p, tipo: t })),
  beneficios: beneficios.map(([n, pontos]) => ({
    nome: n,
    descricao: "Exemplo de benefício em pontos.",
    pontos,
  })),
});

export const ROTEIROS_NOVOS: Record<string, RoteiroDemo> = {
  basico: R(
    "Ponto Serviços",
    "Serviços",
    "Soluções práticas para o seu dia. Um site de exemplo para você avaliar um visual simples, claro e direto.",
    "Rua Exemplo, 50, Centro",
    ["Centro", "Ponta Verde", "Jatiúca"],
    [
      [
        "Atendimento inicial",
        "Conte sua necessidade e conheça as possibilidades.",
        "Sob consulta",
        "servico",
      ],
      [
        "Serviço personalizado",
        "Converse sobre uma proposta para o que você procura.",
        "Sob consulta",
        "servico",
      ],
      [
        "Acompanhamento",
        "Consulte as opções para dar continuidade ao atendimento.",
        "Sob consulta",
        "servico",
      ],
    ],
    [["Atendimento prioritário", 150]],
  ),
  cafe_padaria: R(
    "Padaria Exemplo",
    "Café e padaria",
    "Pão quentinho, café passado e aquele cantinho para uma pausa. Uma padaria de exemplo para você avaliar a sua página.",
    "Rua Exemplo, 21, Jatiúca",
    ["Jatiúca", "Ponta Verde", "Mangabeiras"],
    [
      ["Pão de fermentação natural", "Casca marcante e miolo macio.", "R$ 24,00", "produto"],
      ["Croissant de manteiga", "Camadas leves e douradas.", "R$ 14,00", "produto"],
      ["Pão de queijo (6 un.)", "Pequeno no tamanho, grande na vontade.", "R$ 7,00", "produto"],
      [
        "Encomenda de café da manhã",
        "Para a mesa de casa ou um encontro.",
        "A partir de R$ 85,00",
        "servico",
      ],
    ],
    [
      ["Café de cortesia", 60],
      ["Desconto na encomenda", 200],
    ],
  ),
  automotivo: R(
    "Auto Exemplo",
    "Veículos e serviços automotivos",
    "Revisão, freios e suspensão com transparência. Uma oficina de exemplo para você avaliar uma página forte e direta.",
    "Av. Exemplo, 1500, Gruta de Lourdes",
    ["Gruta de Lourdes", "Farol", "Jaraguá"],
    [
      [
        "Revisão completa",
        "Itens de manutenção conferidos e explicados.",
        "A partir de R$ 280,00",
        "servico",
      ],
      [
        "Alinhamento e balanceamento",
        "Mais estabilidade e menos desgaste.",
        "R$ 120,00",
        "servico",
      ],
      [
        "Troca de pastilhas",
        "Peças e mão de obra combinadas antes.",
        "A partir de R$ 190,00",
        "servico",
      ],
      ["Check-up de viagem", "Avaliação geral antes de pegar a estrada.", "R$ 90,00", "servico"],
    ],
    [
      ["Check-up de cortesia", 150],
      ["Desconto em revisão", 400],
    ],
  ),
  juridico_contabil: R(
    "Escritório Exemplo",
    "Assessoria jurídica e contábil",
    "Orientação clara para decisões importantes. Um escritório de exemplo para você avaliar uma página sóbria e confiável.",
    "Rua Exemplo, 300, Centro",
    ["Centro", "Pajuçara", "Farol"],
    [
      ["Análise de contratos", "Leitura e orientação sobre documentos.", "Sob consulta", "servico"],
      ["Consultivo empresarial", "Assessoria para demandas do negócio.", "Sob consulta", "servico"],
      [
        "Rotinas contábeis",
        "Acompanhamento e organização contábil.",
        "A partir de R$ 350,00 por mês",
        "servico",
      ],
      ["Primeira conversa", "Entender o contexto e os próximos passos.", "R$ 120,00", "servico"],
    ],
    [
      ["Primeira conversa de cortesia", 100],
      ["Desconto na abertura de empresa", 300],
    ],
  ),
  educacao_cursos: R(
    "Escola Exemplo",
    "Cursos e capacitação",
    "Aprender abre caminhos. Uma escola de exemplo para você avaliar uma página clara e didática.",
    "Rua Exemplo, 77, Farol",
    ["Farol", "Centro", "Jatiúca"],
    [
      [
        "Design: primeiros passos",
        "Composição, cor e exercícios criativos.",
        "R$ 249,00",
        "servico",
      ],
      [
        "Marketing digital na prática",
        "Conteúdo, presença digital e comunicação.",
        "R$ 229,00",
        "servico",
      ],
      ["Planilhas para o dia a dia", "Dados, fórmulas e controles.", "R$ 189,00", "servico"],
      [
        "Comunicação e apresentação",
        "Organize ideias e apresente mensagens.",
        "R$ 179,00",
        "servico",
      ],
    ],
    [
      ["Aula experimental", 50],
      ["Desconto na matrícula", 250],
    ],
  ),
  pet: R(
    "Pet Shop Exemplo",
    "Pet shop e cuidados",
    "Cuidado de verdade e carinho de sobra. Um pet shop de exemplo para você avaliar uma página alegre e acolhedora.",
    "Rua Exemplo, 45, Mangabeiras",
    ["Mangabeiras", "Jatiúca", "Ponta Verde"],
    [
      ["Banho e cuidados", "Higiene com atenção aos detalhes.", "A partir de R$ 60,00", "servico"],
      ["Tosa e acabamento", "Opções de cuidado para conversar.", "A partir de R$ 80,00", "servico"],
      ["Brinquedo de corda", "Para brincadeiras acompanhadas.", "R$ 29,00", "produto"],
      ["Comedouro de cerâmica", "Um detalhe para o cantinho do pet.", "R$ 49,00", "produto"],
    ],
    [
      ["Banho de cortesia", 180],
      ["Desconto na loja", 90],
    ],
  ),
  moda_lojas: R(
    "Loja Exemplo",
    "Moda e acessórios",
    "Presença em cada escolha. Uma loja de exemplo para você avaliar uma vitrine moderna e organizada.",
    "Rua Exemplo, 12, Ponta Verde",
    ["Ponta Verde", "Pajuçara", "Jatiúca"],
    [
      ["Camisa essencial", "Branca, de caimento leve.", "R$ 189,00", "produto"],
      ["Calça movimento", "Cor areia, modelagem ampla.", "R$ 249,00", "produto"],
      ["Vestido horizonte", "Azul, para ocasiões do dia a dia.", "R$ 299,00", "produto"],
      ["Bolsa traço", "Caramelo, tamanho único.", "R$ 159,00", "produto"],
    ],
    [
      ["Frete de cortesia", 70],
      ["Desconto na segunda peça", 160],
    ],
  ),
  fitness_esportes: R(
    "Academia Exemplo",
    "Academia e treino",
    "Seu ritmo, sua força, seu próximo passo. Uma academia de exemplo para você avaliar uma página cheia de energia.",
    "Av. Exemplo, 800, Stella Maris",
    ["Stella Maris", "Jatiúca", "Cruz das Almas"],
    [
      ["Musculação", "Desenvolva força e disposição no seu ritmo.", "R$ 149,00 por mês", "servico"],
      ["Funcional", "Treinos dinâmicos para o corpo todo.", "R$ 219,00 por mês", "servico"],
      ["Mobilidade", "Mais liberdade e qualidade de movimento.", "R$ 129,00 por mês", "servico"],
      ["Aula experimental", "Conheça a estrutura e a equipe.", "Grátis", "servico"],
    ],
    [
      ["Aula experimental", 80],
      ["Desconto na matrícula", 300],
    ],
  ),
  imobiliario: R(
    "Imobiliária Exemplo",
    "Imóveis",
    "Um lugar para viver o próximo capítulo. Uma imobiliária de exemplo para você avaliar uma página espaçosa e sofisticada.",
    "Rua Exemplo, 150, Jardim Central",
    ["Jardim Central", "Vila Parque", "Centro"],
    [
      ["Apartamento Vista", "82 m², 2 quartos, 1 vaga.", "R$ 680.000,00", "produto"],
      ["Casa Jardim", "180 m², 3 quartos, 2 vagas.", "R$ 1.250.000,00", "produto"],
      ["Studio Essencial", "34 m², 1 quarto, sem vaga.", "R$ 320.000,00", "produto"],
      ["Visita guiada", "Conheça o imóvel com acompanhamento.", "Grátis", "servico"],
    ],
    [
      ["Avaliação de imóvel de cortesia", 200],
      ["Desconto na taxa de administração", 500],
    ],
  ),
  tecnologia_assistencia: R(
    "Assistência Exemplo",
    "Tecnologia e assistência técnica",
    "Sua tecnologia de volta ao que importa. Uma assistência de exemplo para você avaliar uma página digital e objetiva.",
    "Rua Exemplo, 99, Centro",
    ["Centro", "Farol", "Jatiúca"],
    [
      [
        "Assistência para notebook",
        "Avaliação, manutenção e reparos.",
        "A partir de R$ 90,00",
        "servico",
      ],
      ["Configuração de equipamentos", "Ajustes do sistema e do ambiente.", "R$ 120,00", "servico"],
      ["Mouse sem fio", "Uma escolha para o seu espaço de trabalho.", "R$ 89,00", "produto"],
      ["Hub USB", "Consulte as conexões disponíveis.", "R$ 129,00", "produto"],
    ],
    [
      ["Diagnóstico de cortesia", 100],
      ["Desconto em acessórios", 220],
    ],
  ),
  casa_decoracao: R(
    "Casa Exemplo",
    "Casa e decoração",
    "Sua casa, com mais de você. Uma loja de exemplo para você avaliar uma página aconchegante e de bom gosto.",
    "Rua Exemplo, 60, Pajuçara",
    ["Pajuçara", "Ponta Verde", "Jatiúca"],
    [
      ["Sofá Horizonte", "Uma base acolhedora para a sala.", "R$ 4.290,00", "produto"],
      ["Mesa Lume", "Madeira maciça, acabamento natural.", "R$ 1.290,00", "produto"],
      ["Vaso Terra", "Cerâmica artesanal.", "R$ 149,00", "produto"],
      ["Consultoria de ambientes", "Combinamos peças e cores com você.", "R$ 250,00", "servico"],
    ],
    [
      ["Entrega de cortesia", 120],
      ["Desconto em objetos", 180],
    ],
  ),
  eventos_fotografia: R(
    "Estúdio Exemplo",
    "Fotografia e eventos",
    "O que passa merece ficar. Um estúdio de exemplo para você avaliar uma página que coloca as imagens em destaque.",
    "Rua Exemplo, 18, Ponta Verde",
    ["Ponta Verde", "Pajuçara", "Cruz das Almas"],
    [
      ["Ensaio Essência", "Até 1 hora e 20 fotos editadas.", "R$ 690,00", "servico"],
      ["Cobertura de encontros", "Até 3 horas e 80 fotos editadas.", "R$ 1.890,00", "servico"],
      ["Celebração", "Até 6 horas e 150 fotos editadas.", "R$ 3.890,00", "servico"],
      [
        "Álbum de memórias",
        "Projeto personalizado a combinar.",
        "A partir de R$ 490,00",
        "produto",
      ],
    ],
    [
      ["Ampliação de cortesia", 150],
      ["Desconto no álbum", 350],
    ],
  ),
  servicos_rapidos: R(
    "Resolve Exemplo",
    "Reparos e instalações",
    "Tem algo para resolver? Comece por aqui. Um prestador de exemplo para você avaliar uma página prática e de ação imediata.",
    "Rua Exemplo, 33, Farol",
    ["Farol", "Centro", "Jatiúca"],
    [
      ["Montagem de móveis", "Conte sobre o móvel e o modelo.", "A partir de R$ 149,00", "servico"],
      [
        "Instalação de prateleiras",
        "Informe quantidade e local.",
        "A partir de R$ 89,00",
        "servico",
      ],
      [
        "Troca de torneira",
        "Consulte o escopo conforme a peça.",
        "A partir de R$ 119,00",
        "servico",
      ],
      ["Pequenos reparos", "Apresente a necessidade para avaliação.", "Sob consulta", "servico"],
    ],
    [
      ["Visita de cortesia", 60],
      ["Desconto no segundo serviço", 140],
    ],
  ),
  agro_campo: R(
    "Casa do Campo Exemplo",
    "Agro e campo",
    "Perto de quem vive o campo. Uma loja de exemplo para você avaliar uma página natural e robusta.",
    "Rodovia Exemplo, km 12, Tabuleiro",
    ["Tabuleiro", "Rio Largo", "Satuba"],
    [
      ["Enxada com cabo", "Para compor o conjunto da propriedade.", "R$ 89,00", "produto"],
      ["Tesoura de poda", "Consulte características e aplicação.", "R$ 79,00", "produto"],
      ["Regador", "Para a rotina de horta e jardim.", "R$ 59,00", "produto"],
      ["Mangueira para jardim", "Consulte medidas e conexões.", "R$ 119,00", "produto"],
    ],
    [
      ["Luvas de cortesia", 90],
      ["Desconto em ferramentas", 260],
    ],
  ),
  turismo_hospedagem: R(
    "Pousada Exemplo",
    "Turismo e hospedagem",
    "Desacelere. O resto é paisagem. Uma pousada de exemplo para você avaliar uma página leve e convidativa.",
    "Estrada Exemplo, 5, Barra de São Miguel",
    ["Barra de São Miguel", "Pontal do Coruripe", "Maragogi"],
    [
      [
        "Suíte Jardim",
        "Até 2 hóspedes, com vista para o verde.",
        "A partir de R$ 390,00 por noite",
        "servico",
      ],
      ["Chalé Brisa", "Até 3 hóspedes, com varanda.", "A partir de R$ 590,00 por noite", "servico"],
      [
        "Caminhada ao entardecer",
        "Um convite para observar a paisagem.",
        "A partir de R$ 90,00 por pessoa",
        "servico",
      ],
      [
        "Rota de sabores",
        "Um encontro com a gastronomia local.",
        "A partir de R$ 160,00 por pessoa",
        "servico",
      ],
    ],
    [
      ["Café da manhã de cortesia", 140],
      ["Desconto na segunda diária", 450],
    ],
  ),
  moto_bike: R(
    "Giro Exemplo Moto e Bike",
    "Motos, bikes e acessórios",
    "Duas rodas, muitas possibilidades. Uma loja de exemplo para você avaliar uma página de caixa alta, hero escuro e vermelho.",
    "Av. Exemplo, 700, Jatiúca",
    ["Jatiúca", "Ponta Verde", "Farol"],
    [
      ["Scooter urbana", "Para os trajetos do dia a dia.", "R$ 15.900,00", "produto"],
      ["Bike cidade", "Modelo urbano para conhecer em detalhes.", "R$ 1.890,00", "produto"],
      ["Capacete urbano", "Consulte tamanhos e características.", "R$ 499,00", "produto"],
      [
        "Revisão de moto ou bike",
        "Verificação geral dos principais itens.",
        "A partir de R$ 120,00",
        "servico",
      ],
    ],
    [
      ["Revisão de cortesia", 200],
      ["Desconto em acessórios", 120],
    ],
  ),
  premium: R(
    "Ateliê Exemplo",
    "Curadoria e objetos",
    "Presença que se percebe. Um ateliê de exemplo para você avaliar uma página escura, refinada e cheia de espaço.",
    "Rua Exemplo, 8, Jardim Oceania",
    ["Jardim Oceania", "Ponta Verde", "Mangabeiras"],
    [
      ["Bolsa Origem", "Linhas definidas e presença discreta.", "R$ 1.490,00", "produto"],
      ["Luminária Eclipse", "Uma forma escultural para o ambiente.", "R$ 1.890,00", "produto"],
      ["Vaso Monólito", "Volume e textura em equilíbrio.", "R$ 690,00", "produto"],
      ["Consultoria de composição", "Combinações que se completam.", "Sob consulta", "servico"],
    ],
    [
      ["Embalagem presente de cortesia", 100],
      ["Atendimento reservado", 350],
    ],
  ),
};
