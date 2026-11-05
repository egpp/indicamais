# Lacunas dos modelos de sites (IM-101, D-022)

Inventário das funções que aparecem nos 21 modelos de `docs/marca/modelos-sites/estilo/*.png` e **ainda não existem** no sistema. Nada é removido dos modelos: este arquivo serve para o Emerson planejar a implementação e tornar os sites totalmente funcionais. Elaborado em 04/11/2026 pelo agente `interface`; é leitura dos PNGs, não decisão. Cada item que virar trabalho precisa de ID novo (IM-102 em diante) ou de decisão registrada.

Legenda de bloqueio: **F** = esbarra em requisito futuro; **IM-090** = esbarra na regra "sem intermediação de venda, carrinho ou pagamento" (D-020); **D-022** = só aparece em plano pago (Loja oculta sem liberação); **livre** = pode ser feito sem decisão nova, só precisa de requisito.

Estilos citados por número: 1 Minimalista, 2 Gastronomia, 3 Saúde e Bem-estar, 4 Beleza e Estética, 5 Construção e Reformas, 6 Café e Padaria, 7 Automotivo, 8 Jurídico e Contábil, 9 Educação e Cursos, 10 Pet, 11 Moda e Lojas, 12 Fitness e Esportes, 13 Imobiliário, 14 Tecnologia e Assistência, 15 Casa e Decoração, 16 Eventos e Fotografia, 17 Serviços Rápidos, 18 Agro e Campo, 19 Turismo e Hospedagem, 20 Premium, 21 Moto e Bike.

## Já cobertas hoje (para referência, não são lacuna)

Cabeçalho com menu de seções, hero com texto e chamadas, catálogo de produtos/serviços em cartões (preço em texto, foto), imóveis com chips (IM-097, IM-098), formulário de pedido de contato (IM-013), benefícios em pontos, mapa e "Como chegar" (IM-018), banner rotativo (IM-093), rodapé, estilos de página (IM-091, IM-100). O estilo muda só aparência; a composição dos modelos é adaptada à estrutura única da página.

## A. Conteúdo da página (sem dinheiro envolvido)

| # | Função | Estilos | O que falta | Dependências | Bloqueio |
|---|---|---|---|---|---|
| A1 | **Hero com foto grande do negócio e chamadas duplas** (botão principal + link secundário) | todos | Hoje o hero usa banner ou imagem principal; falta escolher foto de capa por estilo e dois botões configuráveis (rótulo e destino) | Módulo perfis (campos de capa e chamadas); upload já existe | livre **Apontado pelo verificador (pendente):** o modelo 1 traz o botão "Falar com a equipe" no menu do cabeçalho; hoje o menu só tem as seções e o chamado "Falar com a empresa" fica no hero. Falta o botão no menu (rótulo e destino por negócio). |
| A2 | **Faixa de diferenciais** (3 ícones com frase) | 1, 3, 6, 10, 17 | Campo de "pontos fortes" editável com ícone | perfis | livre |
| A3 | **Seção "Sobre" rica**: título, dois parágrafos, foto e link | 1, 2, 4, 8, 15, 20 | Hoje há só descrição breve; falta texto longo e foto da seção | perfis (versão e revisão IM-022) | livre |
| A4 | **Lista de serviços/áreas de atuação** com ícone, resumo e link "Quero saber mais" (distinta do catálogo) | 1, 3, 5, 8, 10, 13, 14 | Bloco editável de áreas (título, resumo, ícone, destino); hoje só o catálogo | perfis ou catalogo | livre |
| A5 | **Como funciona / passo a passo numerado** (01, 02, 03) | 1, 3, 5, 6, 8, 9, 14, 15, 16, 17, 18 | Bloco editável de etapas | perfis | livre |
| A6 | **FAQ / perguntas frequentes em acordeão** por negócio | 3, 8, 9, 17 | Bloco de perguntas e respostas editável, com marcação acessível (aria-expanded) e dados estruturados opcionais. A página "Dúvidas frequentes" da plataforma é outra coisa | perfis | livre |
| A7 | **Equipe / "Pessoas que cuidam de pessoas"** (foto, nome, especialidade) | 3 | Cadastro de membros com foto. Foto de pessoa exige consentimento e moderação de imagem | perfis, administração (moderação IM-022/IM-024); atenção a dado pessoal (LGPD) | livre, com cuidado de privacidade **Parcial (D-023, fase 12):** a seção "Equipe" já existe na página (nome e cargo, com ícone, sem foto de pessoa) e só aparece quando recebe membros. **Falta o cadastro** no perfil (campo versionado, IM-022): exige migração e tela do dono; foto de pessoa só depois da revisão jurídica (IM-082). |
| A8 | **Galeria / portfólio com legendas e filtro** (Casamentos, Eventos, Ensaios) | 4, 16, 5, 19 | Hoje há fotos do perfil sem legenda, categoria ou ordem; falta galeria com legenda e filtro por tipo | perfis (fotos), storage | livre **Apontado pelo verificador (pendente):** o estilo 21 (Moto e Bike) traz uma galeria de duas fotos com legenda; as fotos do perfil ainda não têm legenda. |
| A9 | **Antes e depois** (comparador deslizante) | 5 | Par de imagens e controle de deslize acessível por teclado | perfis, storage | livre |
| A10 | **Tags sobre a foto / composição de ambiente** (rótulos clicáveis em cima da imagem) | 15, 20 | Marcação de pontos sobre a imagem ligados a itens do catálogo | catalogo, perfis | livre (itens à venda dependem de D-022) |
| A11 | **Abas por categoria dentro do bloco** (ex.: Moto / Bike, Revisão / Freios / Suspensão, "Minha casa / Meu negócio") | 5, 7, 14, 17, 18, 21 | Bloco de "serviço em destaque" com abas, cada aba com texto, foto e botão | perfis | livre |
| A12 | **Seletor de intenção no contato** (Quero um veículo / Preciso de um serviço; Cão / Gato; Moto / Bike) | 7, 10, 21 | Formulário com campos extras por segmento (veículo ou item de interesse, tipo de pet, serviço, assunto) | Pedido de contato (IM-013) e seu Zod. Cada campo novo é dado pessoal ou de interesse: não pode ir ao indicador (IM-029) | livre, revisar IM-029/IM-041 |
| A13 | **Campos de data, horário e quantidade de pessoas no contato** ("Solicitar reserva", "Solicitar visita", "Preferência de dia") | 2, 4, 10, 12, 13, 16, 19 | Campos opcionais de data e horário no pedido de contato, como **preferência** (a equipe confirma) | IM-013; sem agenda real (ver B1) | livre se continuar só como pedido; vira agenda se houver confirmação automática (B1) |
| A14 | **Busca de imóveis no hero** (finalidade, tipo, bairro) | 13 | Já existem filtros de imóveis na Loja (IM-098); falta levar o buscador ao hero e o botão "Limpar filtros" | catalogo (IM-097/098) | D-022 (Loja) |
| A15 | **Busca por texto e filtros por categoria no catálogo** (campo "Buscar peça", abas, "Menor preço", contador de itens) | 11, 14, 15, 17, 18, 20, 21, 7, 9, 12 | Hoje só os filtros de imóvel. Faltam busca textual, abas por categoria do item e ordenação por preço dentro do perfil | catalogo, busca | D-022 (Loja); a Loja de produtos/serviços sem liberação continua oculta |
| A16 | **Destaque de um item** ("Um espaço em destaque", cartão grande) | 13, 15 | Marcar item como destaque no catálogo do perfil | catalogo | livre |
| A17 | **Barra de busca de serviços no hero** | 17 | Busca interna do perfil com atalhos ("Montar um móvel") | catalogo, busca | livre |
| A18 | **Textos prontos por segmento** (selos como "Feito para bons momentos", frases de marca) | 6, 21, todos | Hoje são exemplos no modelo; o negócio escreve seus próprios textos. Falta decidir se haverá modelos de texto sugeridos | perfis | livre (decisão de produto) |
| A19 | **Logotipo e marca do negócio no cabeçalho** (símbolo + nome + subtítulo) | todos | Campo de logotipo do negócio e subtítulo; hoje só nome | perfis, storage | livre |
| A20 | **Menu com submenu** ("Imóveis" com seta) | 13 | Hoje o menu é fixo por seções | interface | livre |
| A21 | **Seção "Anuncie seu imóvel" / captação de parceiros** | 13 | Chamada que leva a formulário de captação | IM-013; anúncios particulares (IM-016, conferir) | livre |

## B. Funções com agenda, plano ou pagamento

| # | Função | Estilos | O que falta | Dependências | Bloqueio |
|---|---|---|---|---|---|
| B1 | **Agenda / programação semanal** (Seg a Sex, horários, "Tenho interesse") | 12 | Cadastro de grade semanal por dia e modalidade; botão leva ao contato. Reserva de vaga com confirmação seria outra função | perfis (módulo próprio ou do relacionamento); fuso America/Sao_Paulo | livre como vitrine; reserva/vagas esbarra em IM-090 se envolver cobrança |
| B2 | **Planos de mensalidade** (Essencial R$ 149/mês, Ritmo, Completo, com lista de benefícios) | 12 | Exibir planos do **negócio** com preço e inclusões. Não é o módulo de planos da plataforma (IM-060, F): é vitrine do próprio negócio. Botão "Conhecer este plano" leva ao contato | catalogo (novo tipo de item "plano" com periodicidade) | D-022 (Loja); assinatura real é **F** e IM-090. Cuidado de nome para não confundir com planos da IndicaMais **Feito (D-023, fase 12):** com a Loja liberada, item com a linha "Periodicidade: por mês" na descrição vira cartão de plano (preço, periodicidade, inclusos, botão "Conhecer este plano" ao contato). Falta tipo próprio de item "plano" (hoje é convenção de texto). Assinatura real segue F. |
| B3 | **Assinatura / recorrência** | 12, 6 | Cobrança recorrente de verdade | pagamentos | **F** e IM-090 |
| B4 | **Carrinho / sacola** ("Sacola (2)", "Sua sacola: 2 peças, Total estimado", "Minha composição", "Minha cotação (0)", "Montar solicitação (0)", "Minha seleção (0)") | 6, 11, 15, 17, 18, 20 | Lista de itens escolhidos no navegador, com quantidade, total **estimado** e envio como mensagem de contato. Sem cobrança | catalogo, IM-013; estado do navegador | IM-090 (carrinho é vedado hoje, D-020); só passa se o Emerson autorizar um "montar pedido de contato" sem pagamento. **Pendência para o Emerson** **Feito (D-023, fase 12), sem total:** "Sua lista de interesse" com quantidade, que vira texto no campo Mensagem do pedido de contato, que o visitante revisa antes de enviar. Sem preço total, checkout nem pagamento, só em memória do navegador. Vale para todos os estilos (IM-094: o estilo não muda o conteúdo). Pendente: salvar a lista entre visitas (não feito de propósito, por privacidade) e total estimado (não autorizado). |
| B5 | **Seleção de tamanho/variação por item** (P, M, G, GG; cor) | 11 | Variações de item (tamanho, cor, estoque) | catalogo | D-022; fora de IM-090 se só informativo **Feito (D-023, fase 12), só informativo:** linhas "Tamanhos: P, M, G" e "Cores: azul, preto" na descrição viram texto no cartão e escolha na lista. Sem estoque. Falta campo próprio de variação no cadastro do item (hoje convenção de texto, sem migração). |
| B6 | **Quantidade por item** (− 1 +) e **total estimado** | 6 | Controle de quantidade e soma | catalogo | IM-090 (mesmo que B4) **Parcial:** quantidade (− 1 +) feita na lista de interesse; o total estimado não, por decisão (sem total vinculante). |
| B7 | **Botões "Comprar", "Adicionar" e checkout** | 11, 17, 6 | Hoje todo botão de compra leva ao contato (D-022). Falta um **ponto único de "ação de compra"** pronto para trocar o destino no futuro | catalogo, interface | **F** (pagamentos) e IM-090 **Feito (D-022, D-023, fase 12):** `resolverAcaoCompra` (`acao-compra-regras.ts`) e o componente `AcaoCompra` são o ponto único; hoje levam ao contato (IM-013) ou à lista de interesse. Pagamento entra como novo modo ali, sem mexer nos cartões; nada de pagamento agora. |
| B8 | **Preço por unidade de medida** (R$ 89/m², R$ 149/unidade, por pessoa, por noite, a partir de) | 5, 19, 17, 13 | Hoje o preço é texto livre ou valor; falta unidade padronizada para exibir e ordenar | catalogo (IM-098 já traz "por mês" para imóvel) | D-022 |
| B9 | **Disponibilidade e reserva por data** (entrada, saída, hóspedes, "consulta sem verificação em tempo real") | 19 | Seletor de datas no hero que leva ao pedido de contato. Disponibilidade em tempo real exigiria calendário e integração | IM-013, A13 | livre como pedido; disponibilidade real é **F** |
| B10 | **Capacidade por item** (até 2 hóspedes) e **duração/horas** (24 horas · Online) e **ficha técnica** (ano, km, câmbio, bairro, quartos) | 19, 9, 7, 21, 13 | Campos de ficha por tipo de item (veículo, curso, hospedagem). Imóvel já existe (IM-098) | catalogo (modelo de dados por tipo) | D-022 |
| B11 | **Estoque demonstrativo de veículos/motos/bikes** | 7, 21 | Tipo de item "veículo" com ano, km, câmbio, categoria (Hatch, Sedã, SUV; Moto, Bike, Acessórios) | catalogo | D-022; sem venda no site |
| B12 | **Catálogo de serviços com "Adicionar à solicitação"** | 17 | Mesmo que B4 | catalogo | IM-090 **Feito (D-023):** o item de serviço usa a mesma lista de interesse (ver B4). |
| B13 | **Cursos** (carga horária, modalidade, categoria) | 9 | Tipo de item "curso" | catalogo | D-022; matrícula e pagamento são **F** |
| B14 | **Pacotes de serviço** (ensaio com duração, fotos editadas, preço) | 16 | Tipo de item "pacote" com descrição de escopo | catalogo | D-022 |

## C. Experiência e acabamento

| # | Função | Estilos | O que falta | Dependências | Bloqueio |
|---|---|---|---|---|---|
| C1 | **Hero em tela cheia com foto de fundo** (gastronomia, imobiliário, turismo, Moto e Bike com duas fotos lado a lado) | 2, 13, 19, 21, 3, 11, 12 | Composições de hero por estilo com foto (hoje os estilos usam fundo de cor e faixas) | perfis (foto de capa por estilo, A1) | livre |
| C2 | **Imagens de apoio por estilo** (ambiente, oficina, equipe) | todos | Cada negócio envia as suas; o modelo traz fotos de banco. Decidir se haverá banco de imagens sugeridas (custo e licença) | storage | custo novo: perguntar ao Emerson |
| C3 | **Animações e interações** (hover com giro, comparador, acordeão, abas) | vários | Respeitar `prefers-reduced-motion` e teclado | interface | livre |
| C4 | **Tipografia de marca por estilo** (fontes dos modelos, como a Plus Jakarta, Barlow, Playfair) | todos | Já há 9 famílias; fontes novas só se o modelo exigir | interface | livre |
| C5 | **Rodapé com selo "formulário demonstrativo / valores ilustrativos"** | todos | Aviso editável do negócio ("Valores ilustrativos. Consulte...") em vez de texto fixo | perfis | livre |
| C6 | **Avisos de privacidade no formulário** ("Evite incluir documentos ou informações sensíveis", "Não inclua senhas") | 8, 14 | Textos por segmento no pedido de contato | IM-013 | livre |

## Entregue na fase 12 (D-023), sem pagamento

Ponto único da ação de compra (B7), lista de interesse (B4, B6, B12), variações informativas (B5), vitrine de planos do negócio (B2) e seção de equipe sem foto (A7, só a exibição). Convenções de texto na descrição do item, sem migração: `Tamanhos:`, `Cores:` e `Periodicidade:` (ver `src/app/_lib/detalhes-item.ts`). Continua pendente: cadastro da equipe no perfil (A7), campo próprio de variação e tipo "plano" (exigem migração), botão "Falar com a equipe" no menu (A1) e galeria de duas fotos com legenda do estilo 21 (A8). Banco de imagens: não haverá (D-023); equipe sem foto.

## Pontos que dependem de decisão do Emerson

1. **Carrinho / sacola / "montar solicitação" (B4, B6, B12):** decidido em D-023 (lista de interesse que vira mensagem de contato, sem pagamento). Segue em aberto só o total estimado dos modelos: não foi feito, por IM-090.
2. **Variações de item (tamanho e cor) e unidade de preço (B5, B8):** informativas ou com estoque? Estoque é gestão de venda.
3. **Planos do negócio (B2) vs. planos da plataforma (IM-060, F):** manter nomes separados. Plano do negócio só como vitrine com botão ao contato.
4. **Fotos de pessoas na equipe (A7):** regra de consentimento e moderação.
5. **Banco de imagens sugeridas (C2):** custo e licença.
6. **Agenda com vagas (B1) e disponibilidade de hospedagem (B9):** vitrine agora; reserva real é futuro (F).
7. **Pagamento e assinatura:** continuam abertos para o futuro (D-022): o ponto único de "ação de compra" (B7) deve ser criado antes de multiplicar botões, para não fechar a porta.

## Regra de exibição (D-022)

A seção Loja só aparece para perfis com liberação (IM-099). Sem liberação ela é **ocultada**, nunca mostrada desabilitada, inclusive na prévia e na demonstração dos estilos (teste em `src/app/_componentes/site/site-loja.test.tsx`). Todos os itens marcados "D-022" acima seguem essa regra. Para perfis sem liberação, produtos e serviços aparecem como "Produtos e serviços" (catálogo de apresentação, sem Loja).
