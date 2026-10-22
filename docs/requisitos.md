# IndicaMais — Requisitos (lista mestra)

Versão 1.2 • 20/10/2026 — adaptada para Claude Code. IDs e textos dos requisitos preservados. Decisões ficam em `docs/decisoes.md`; execução em `docs/acompanhamento.md`.

## Visão geral do IndicaMais

O IndicaMais é uma plataforma de divulgação, indicação e relacionamento que conecta empresas, profissionais, anunciantes particulares e pessoas interessadas em produtos e serviços. Seu propósito é estimular recomendações entre pessoas, ampliar a visibilidade dos negócios e facilitar novos contatos comerciais, reduzindo a dependência exclusiva de anúncios pagos.

Empresas e profissionais apresentam seus negócios em páginas próprias e divulgam produtos e serviços. Usuários cadastrados podem indicá-los por links identificados. Quem recebe uma indicação pode conhecer a oferta e solicitar contato sem precisar criar uma conta. Os incentivos seguem regras específicas: pontos por indicações válidas e, em módulo separado e habilitado pelo administrador, comissões recorrentes mononível sobre pagamentos elegíveis.

Cada empresa constrói uma Base de Relacionamento com quem curte sua página ou a indica, sem duplicidade e respeitando a privacidade. Essa audiência representa um ativo de relacionamento e uma oportunidade de continuidade do vínculo com o público. O dashboard permitirá acompanhar tanto as indicações recebidas quanto as realizadas. Participar dessa base não significa autorizar automaticamente publicidade.

A evolução para interação social e remarketing está prevista para detalhamento posterior. Feed, comentários, respostas, mensagens e campanhas não devem ser tratados como funcionalidades aprovadas apenas por aparecerem como possibilidades neste documento.

O sistema será modular desde sua arquitetura: módulos com responsabilidades e regras próprias, integrados de forma controlada e capazes de evoluir sem reconstruir toda a plataforma. Pontos, comissões, relacionamento e funções sociais não compartilharão automaticamente regras de incentivo ou permissões. A proposta é manter uma experiência integrada para o usuário e uma estrutura simples de manter e ampliar.

Esta visão orienta o produto; o escopo, as pendências e as funções futuras são detalhados nos 90 itens abaixo. IDs são permanentes.

## Como usar a lista

- **D — Definido:** requisito registrado; execução ainda precisa ser conferida.
- **P — Pendente:** escolha necessária ou proposta a confirmar; não é escopo automaticamente aprovado.
- **F — Futuro:** previsto/adiado; manter inativo até definição e autorização.
- A situação de execução de cada ID fica em `docs/acompanhamento.md`, não neste arquivo.
- Os números são permanentes: novos requisitos devem receber novos IDs, sem renumerar os anteriores.

## Arquitetura e controle

- **IM-001 | D | Arquitetura modular.** Separar contas, perfis, catálogo, busca, indicações, pontos, relacionamento, comissões, administração e notificações. Módulos futuros: planos, social, remarketing e pagamentos.

- **IM-002 | D | Integração entre módulos.** Dependências explícitas; serviços comuns compartilhados; saldos e regras separados. Modularidade não exige vários bancos ou microsserviços.

- **IM-003 | D | Referência central.** Manter este catálogo versionado no projeto; preservar IDs, registrar alterações e acrescentar novos itens sem renumerar os anteriores.

- **IM-004 | D | Continuidade.** Aproveitar a reconstrução válida; não apagar novamente código, banco, repositório ou domínio. Avançar sem pedidos rotineiros de 'prossiga'.

- **IM-005 | D | Experiência brasileira.** Web responsiva com prioridade ao celular, português brasileiro, reais, telefone +55, cidade e estado.

## Contas e autenticação

- **IM-006 | D | Conta multifunção.** Uma conta pode indicar, anunciar como particular e responder por vários perfis comerciais; um responsável por perfil.

- **IM-007 | D | Login.** E-mail/senha, Google e Apple; vinculação segura dos métodos à mesma conta.

- **IM-008 | D | Confirmação e recuperação.** Confirmar e-mail, permitir reenvio; usar verificação do provedor social; recuperar acesso sem expor dados.

- **IM-009 | D | WhatsApp da conta.** Obrigatório antes de indicar e exclusivo após normalização; não apresentar número como verificado sem validação.

- **IM-010 | F | Verificação por código.** SMS/WhatsApp em etapa futura, com fornecedor, custos e ativação por definir.

## Perfis e catálogo

- **IM-011 | D | Página comercial.** Página padronizada e personalizável para empresa/profissional: nome, descrição breve, imagem, categoria principal, cidade principal, WhatsApp comercial e responsável.

- **IM-012 | D | Conteúdo opcional.** Endereço, áreas atendidas, banners, fotos, site e informações sociais; sem links externos de redes sociais nesta versão.

- **IM-013 | D | Ações da página.** Quero entrar em contato, Indique esta empresa e Curtir.

- **IM-014 | D | Produtos e serviços.** Páginas com foto, nome, descrição e categoria principal; preço opcional fixo, a partir de ou sob consulta; serviço sem estoque obrigatório.

- **IM-015 | D | Anúncios particulares.** Produtos sem exigir perfil comercial; aprovação e contato; terceiros podem indicar e pontuar.

- **IM-016 | D | Categorias.** Principal e até duas secundárias ativas por perfil/item, usadas nos filtros; administrador gerencia e responsável pode solicitar novas.

- **IM-017 | D | Prévia.** Permitir conferir o conteúdo antes de enviar para aprovação.

- **IM-018 | P | Mapa e rota.** Exibir quando configurados; confirmar fornecedor e configuração antes da ativação.

## Busca e publicação

- **IM-019 | D | Página inicial.** Busca por nome, filtros de categoria/localização, cards com imagem e descrição, seção de produtos e serviços.

- **IM-020 | D | Patrocinadores internos.** Carrossel identificado, escolhido pelo administrador; especificação consolidada prevê ausência de cobrança nesta etapa.

- **IM-021 | D | Aprovação inicial.** Novos perfis e itens dependem de aprovação; somente aprovados e publicados aparecem publicamente.

- **IM-022 | D | Versões de conteúdo.** Edição pública cria versão pendente e mantém versão aprovada; edição de item despublicado não o republica.

- **IM-023 | D | Resultado da revisão.** Painel e e-mail com situação, motivo da rejeição ou link publicado; registrar autor e data.

## Indicações e contato

- **IM-024 | D | Link exclusivo.** Identificar indicador autenticado e destino; copiar/compartilhar por WhatsApp e outros canais.

- **IM-025 | D | Atribuição por destino.** Não transferir atribuição ao navegar para outro perfil/item; visita ou compartilhamento isolado não pontua.

- **IM-026 | D | Formulário sem cadastro.** Visitante informa nome e WhatsApp; e-mail/mensagem opcionais; aviso de dados e política; após envio, seguir ao WhatsApp do responsável.

- **IM-027 | D | Pedidos de contato.** Registrar no painel e notificar por e-mail; acesso apenas ao responsável e administradores autorizados.

- **IM-028 | D | Falhas de comunicação.** Preservar pedido/pontos, permitir reenvio e alerta administrativo; impedir duplicação por repetição da operação.

- **IM-029 | D | Privacidade.** Não revelar automaticamente dados privados do indicador; indicador não vê nome completo ou WhatsApp do visitante.

## Pontos e benefícios

- **IM-030 | D | Pontuação configurável.** Pontos por indicação válida, com quantidade e intervalo definidos centralmente.

- **IM-031 | P | Parâmetros iniciais.** Há referência consolidada a 10 pontos/30 dias e histórico com 15 dias. Confirmar a decisão vigente; não escolher silenciosamente entre os prazos.

- **IM-032 | D | Duplicidade.** WhatsApp visitante + perfil comercial; para particular, WhatsApp + conta anunciante; independe do item.

- **IM-033 | D | Contatos no intervalo.** Permitir contato sem pontuar, sem reiniciar prazo e sem alterar atribuição original; contar desde último pedido pontuado.

- **IM-034 | D | Autoindicação.** Sem pontos para mesmo WhatsApp visitante/indicador, responsável pelo perfil ou dono do anúncio; contato permitido e tentativa registrada, sem suspensão automática.

- **IM-035 | D | Saldo e histórico.** Saldo único sem expiração; créditos/reversões; destino, data, situação, pontos e motivos.

- **IM-036 | D | Cadastro de benefícios.** Administrador gerencia; responsável propõe; perfil publicado, nome, descrição, pontos, condições, situação, limites, prazo de resgate e prazo de uso separados.

- **IM-037 | F | Resgates.** Resgate efetivo desativado até autorização; implementar/ativar apenas conforme definição posterior.

- **IM-038 | F | Cupons, sorteios e prêmios.** Desativados e sem divulgação até revisão; sem prêmios em dinheiro nesta etapa.

## Base de Relacionamento

- **IM-039 | D | Base por empresa.** Reunir quem curtiu a página e quem indicou a empresa; ativo de relacionamento dentro do IndicaMais.

- **IM-040 | D | Deduplicação.** Uma pessoa por empresa, registrando curtida, indicação ou ambas e suas interações; pode participar de bases de empresas distintas.

- **IM-041 | D | Permissões da base.** Responsável acessa somente seus perfis; não revelar automaticamente telefone/e-mail privado.

- **IM-042 | D | Separação dos incentivos.** Curtir não pontua nem gera comissão; participação na base não cria vínculo mononível.

- **IM-043 | P | Identificação na curtida.** Definir login/identificação necessários para curtir, evitar duplicidade e permitir desfazer.

- **IM-044 | P | Evento de entrada por indicação.** Definir se inclusão ocorre ao gerar link, compartilhar ou obter contato válido; não presumir que essas etapas são equivalentes.

- **IM-045 | P | Saída e visibilidade.** Definir efeitos de descurtir, sair da base e encerrar conta, além dos dados visíveis à empresa.

- **IM-046 | F | Remarketing.** Previsto para depois; não ativar campanhas, disparos, exportação ou integração publicitária agora. Curtir/indicar não equivale a autorizar publicidade; definir autorizações e saída antes da ativação.

## Notificações e acompanhamento

- **IM-047 | D | Ícone no dashboard.** Ícone de notificações no topo, acessível no celular e computador.

- **IM-048 | D | Aba Quem me indicou.** Mostrar quem indicou página/produto/serviço sob responsabilidade do usuário e qual item foi indicado; identificar o perfil de destino quando houver vários.

- **IM-049 | D | Aba Minhas indicações.** Mostrar quantas indicações o usuário realizou e quais páginas, produtos e serviços indicou, com histórico.

- **IM-050 | D | Identificação permitida.** Usar apenas dados de perfil permitidos; não expor telefone/e-mail privados nas notificações.

- **IM-051 | P | Estados e contagens.** Definir evento que gera aviso, o que conta como indicação, datas e distinção entre link gerado, compartilhamento e contato válido; não afirmar compartilhamento externo sem confirmação técnica.

- **IM-052 | P | Leitura dos avisos.** Proposta: contador de não lidas, marcar como lida e abrir item relacionado. Confirmar antes de tratar como requisito aprovado.

- **IM-053 | D | Integração modular.** Reutilizar módulo de notificações para os avisos já definidos de aprovação/rejeição e contatos, sem duplicar registros.

## Interação social

- **IM-054 | P | Escopo social.** Ideia solicitada: interação entre empresa, indicadores e pessoas indicadas. Definir participantes, formas de interação e adesão de visitantes sem conta.

- **IM-055 | P | Publicações da empresa.** Proposta ainda não confirmada: feed de novidades, promoções e avisos.

- **IM-056 | P | Comentários e respostas.** Proposta ainda não confirmada: comentários, respostas, moderação e avisos de interação.

- **IM-057 | P | Mensagens privadas e grupos.** Sugestões de possíveis etapas posteriores, não compromissos aprovados. Confirmar se entrarão no escopo.

- **IM-058 | P | Curtidas em anúncios particulares.** Apareceram em sugestão do assistente; aprovação expressa do usuário foi para páginas de empresa. Confirmar extensão.

- **IM-059 | D | Independência do social.** Não modificar pontos/comissões automaticamente; não inscrever visitante em comunidade sem sua escolha.

## Planos e comissões mononível

- **IM-060 | F | Planos da plataforma.** Somente administrador cria/gerencia; etapa futura; anunciante não cria planos da plataforma. Não confundir com ofertas recorrentes.

- **IM-061 | D | Habilitação do módulo.** Somente administrador habilita por anunciante, espontaneamente ou por solicitação; não ativa integração financeira.

- **IM-062 | D | Ofertas e percentuais.** Após habilitação, anunciante seleciona seus produtos/serviços recorrentes e define percentual por oferta; exclui vendas avulsas; TVX apenas exemplo.

- **IM-063 | D | Redes independentes.** Uma rede por negócio; conta pode participar de várias; comissão apenas por clientes diretos, sem recrutamento ou níveis adicionais.

- **IM-064 | D | Cálculo de comissão.** Sobre mensalidades efetivamente pagas e elegibilidade; valores gerados, pendentes de repasse e pagos; histórico e prevenção de duplicidade.

- **IM-065 | D | Saldos separados.** Regras, telas, saldos e históricos próprios; intervalo dos pontos não vale para comissões; desligamento não quebra funções independentes.

- **IM-066 | D | Adimplência do indicador.** Assinatura correspondente ativa/em dia; inadimplência impede novas comissões naquele negócio, preservando valores anteriores.

- **IM-067 | D | Regularização no prazo.** Retomar comissões futuras pelas mesmas indicações, sem retroativos.

- **IM-068 | D | Encerramento de vínculos.** Prazo configurável apenas pelo administrador; após prazo, encerrar para comissões futuras, sem restaurar automaticamente após regularização; permitir nova carteira.

- **IM-069 | D | Preservação e percentuais.** Preservar contas, assinaturas, históricos, comissões anteriores, outras redes e indicações dos clientes; não transferir indicados nem recalcular comissões geradas por mudança de percentual.

- **IM-070 | D | Confirmação manual.** Até integração financeira, administrador confirma pagamentos com auditoria; sem cobrança ou repasse automático.

- **IM-071 | P | Elegibilidade exata.** Qual assinatura habilita o indicador quando o negócio tiver várias ofertas.

- **IM-072 | P | Inadimplência operacional.** Início da contagem, avisos e destino dos vínculos encerrados.

- **IM-073 | P | Mudanças e reversões.** Vigência dos percentuais para assinaturas existentes, cancelamentos, estornos e efeitos da desativação.

- **IM-074 | F | Recebimentos Pix/cartão.** Integração futura; provedores, configuração e ativação por definir.

- **IM-075 | F | Repasses.** Operação separada do recebimento de mensalidades; método e ativação por definir.

## Administração e ciclo de vida

- **IM-076 | D | Denúncias.** Usuários/visitantes podem denunciar autoindicação, spam/fraude, uso indevido de dados e conteúdo inadequado; proteção antispam, sem suspensão automática.

- **IM-077 | D | Permissões administrativas.** Administrador geral e permissões específicas para aprovar, gerir categorias, analisar denúncias, invalidar indicações, reverter pontos e suspender.

- **IM-078 | D | Reversões auditáveis.** Novo lançamento preserva original, motivo, data e autor; pontos já resgatados exigem análise.

- **IM-079 | D | Despublicação.** Responsável pode despublicar imediatamente; perfil indisponível retira itens/benefícios e impede novas indicações, pontos e resgates associados.

- **IM-080 | D | Suspensão e reativação.** Suspensão bloqueia acesso e conteúdo da conta; reativação não republica automaticamente.

- **IM-081 | D | Encerramento.** Exigir confirmação; remover/anonimizar dados desnecessários e preservar históricos necessários; sem transferência automática de perfis.

- **IM-082 | P | Políticas.** Concluir política de privacidade, retenção e efeitos do ciclo de vida sobre relacionamento, assinaturas e comissões antes das respectivas ativações.

## Infraestrutura e entrega

- **IM-083 | D | Destinos e acessos.** Confirmar repositório e recursos corretos em GitHub, Supabase e Cloudflare; reutilizar acessos válidos, sem repetição desnecessária.

- **IM-084 | D | Proteção do trabalho.** Preservar domínio, outros projetos e reconstrução válida; não interpretar este documento como nova ordem de exclusão.

- **IM-085 | D | Versionamento e recuperação.** Código e migrações versionados, configuração documentada e recuperação proporcional ao risco; segredos fora do código/relatórios.

- **IM-086 | D | Segurança.** Controle de acesso na aplicação e banco, isolamento de dados entre responsáveis, auditoria e tratamento de falhas.

- **IM-087 | P | Ambientes.** Desenvolvimento direto em produção foi discutido, mas não decidido. Conferir decisão vigente; não inferir autorização de debate.

- **IM-088 | D | Validação e continuidade.** Testar riscos concretos e fluxos relevantes; continuar tarefas independentes; intervir apenas por bloqueio real ou ação fora da autorização.

- **IM-089 | D | Limites.** Custos novos, exclusões irreversíveis não autorizadas e abertura pública exigem decisão; funções adiadas permanecem desativadas.

- **IM-090 | D | Fora do escopo inicial.** Apps nativos, colaboradores, filiais, expansão internacional, integração Facebook, carrinho e processamento financeiro ativo. Revisar somente por nova decisão expressa.
