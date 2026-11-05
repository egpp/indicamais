# IndicaMais — Registro de decisões

Cada decisão tem data, IDs afetados e o que substitui. Decisão nova substitui a anterior de forma explícita; nunca apague uma decisão antiga, marque-a como "Substituída por D-xxx".

---

## D-001 · 20/10/2026 · Projeto começa do zero
**IDs:** IM-004, IM-083, IM-084
O Emerson entrega GitHub, Supabase e Cloudflare vazios para um início limpo. Não há código anterior a aproveitar.
As proteções de IM-004 e IM-084 continuam valendo para tudo o que for criado a partir de agora: não apagar código, banco, repositório, domínio nem outros projetos das contas.

## D-002 · 20/10/2026 · Stack
**IDs:** IM-001, IM-002, IM-005, IM-085, IM-086
Critério do Emerson: suportar crescimento, desempenho e segurança.
- **Next.js (App Router) + TypeScript estrito** — páginas públicas renderizadas no servidor. Isso é necessário para que links de indicação compartilhados no WhatsApp mostrem prévia (título, imagem, descrição) e para que as páginas comerciais apareçam em buscadores.
- **Cloudflare Workers via adaptador OpenNext** — rede global, bom desempenho no Brasil, custo baixo no início.
- **Supabase** — Postgres com RLS (isolamento de dados no próprio banco), Auth com e-mail/senha, Google e Apple, Storage para imagens.
- **Monólito modular** — um app e um banco, módulos isolados por fronteiras de código. Atende IM-002 sem a complexidade de microsserviços.
- **Zod, Vitest, Playwright, pnpm, GitHub Actions.**

## D-003 · 20/10/2026 · Ambientes separados
**IDs:** IM-087 (resolvido), IM-085
- Dois ambientes: **desenvolvimento** e **produção**, cada um com seu projeto Supabase e seu Worker na Cloudflare.
- Nada é desenvolvido nem testado direto em produção.
- Migrações e deploys passam primeiro por desenvolvimento.
- Deploy em produção e alteração do banco de produção exigem aprovação do Emerson na hora.
- Se criar o segundo projeto Supabase gerar custo, parar e pedir decisão (IM-089).

## D-004 · 20/10/2026 · Ferramenta e equipe
**IDs:** IM-003, IM-088
- Desenvolvimento migrado do Codex para o Claude Code.
- Estrutura de 5 agentes: sessão principal como gestor e quatro agentes técnicos (`banco-seguranca`, `regras-negocio`, `interface`, `verificador`).
- Comandos destrutivos são bloqueados por regra técnica em `.claude/settings.json`, não só por instrução.

## D-005 · 22/10/2026 · Projeto Supabase de desenvolvimento
**IDs:** IM-087, IM-085, IM-086
- O projeto Supabase `qheleouixleltfjtccji` (região São Paulo) é o ambiente de **desenvolvimento** (D-003). O Supabase não tem campo de ambiente; a designação é desta decisão.
- O projeto de produção ainda não existe. Quando for criado, será outro projeto, com aprovação do Emerson.
- A integração GitHub e o Branching do Supabase ficam desligados (risco de aplicar migração em produção sem aprovação e custo). A ligação com o código é só pela CLI (`supabase link`) e pelo `.env.local`.
- Custo do projeto: a confirmar com o Emerson (plano gratuito?).

## D-006 · 23/10/2026 · Decisões de partida da Fase 2 (perfis e catálogo)
**IDs:** IM-012, IM-016, IM-021, IM-022, IM-023, IM-077 (parte), IM-014, IM-015
Aprovadas pelo Emerson em 23/10/2026, sobre proposta do gestor:
- **Administrador mínimo na Fase 2.** Para cumprir a aprovação do IM-021, a Fase 2 cria só o papel de administrador e a fila de revisão. O primeiro administrador é o Emerson, concedido direto no banco. A administração completa (IM-076, IM-077, IM-078, IM-080, IM-081) continua na Fase 6.
- **Informações sociais (IM-012) só como texto**, sem link clicável de rede social nesta versão.
- **Cidade como texto e UF validada.** Lista oficial de municípios (IBGE) fica para depois.
- **Imagens:** até 2 MB por imagem e até 6 fotos por perfil ou item, em jpeg, png ou webp, no Storage do Supabase. O plano gratuito tem 1 GB; passar disso gera custo e exige nova decisão (IM-089).
- **Categorias iniciais (IM-016), provisórias:** Alimentação, Beleza e estética, Casa e construção, Saúde e bem-estar, Serviços profissionais, Veículos, Tecnologia e Outros. O administrador gerencia a lista e o responsável pode solicitar novas.
- **Fora da Fase 2:** ações da página (IM-013) são da Fase 3; "Curtir" segue pendente (IM-043); mapa e rota (IM-018) seguem pendentes; e-mail do resultado da revisão (IM-023) depende do SMTP próprio, então começa pelo aviso no painel.

## D-007 · 27/10/2026 · Auditoria das decisões de revisão
**IDs:** IM-021, IM-023, IM-086
Aprovada pelo Emerson em 27/10/2026, sobre recomendação do gestor: aprovar ou rejeitar versão de perfil ou item grava, além das tabelas de revisão, uma linha em `administracao_auditoria` (autor, data, motivo, valor anterior e novo), para haver uma trilha única de ações administrativas (regra do CLAUDE.md). As tabelas de revisão continuam sendo a fonte do resultado mostrado ao responsável.
Implementada em nova migração, aplicada primeiro no dev com aprovação do Emerson (D-003).

## D-008 · 28/10/2026 · Decisões da Fase 2C (conteúdo público)
**IDs:** IM-015, IM-019, IM-020
Aprovadas pelo Emerson ("de acordo") sobre recomendação do gestor:
- **Anúncio particular com cidade e UF obrigatórias**, para entrar nos filtros de localização (IM-015, IM-019). Exige migração nova na versão do item.
- **Patrocinador (IM-020):** destino é um perfil comercial público ou um texto sem link externo; link externo fica para quando houver cobrança. Carrossel com até 20 itens, ordenado pelo campo `ordem` definido pelo administrador, sempre identificado como "Patrocinado", sem preço nem cobrança.
- **Busca (IM-019) só por nome** nesta etapa; busca também em descrição e categoria fica para melhoria futura.
- Páginas públicas sem botões de ação (contato, indicar): são da Fase 3. "Curtir" segue pendente (IM-043).

## D-009 · 29/10/2026 · Lista de consulta de negócios e itens na administração
**IDs:** IM-021, IM-077 (parte), IM-086
Aprovada pelo Emerson em 29/10/2026 ("sim, é importante pra consultar"), após testar a 2C e notar que a administração só mostra o que está pendente:
- O administrador passa a ter uma **lista somente de leitura** de todos os perfis e itens, em qualquer situação (rascunho, pendente, aprovado, rejeitado, publicado, despublicado), com busca por nome e filtro por situação.
- Somente leitura: sem editar, suspender ou reverter (isso segue na Fase 6: IM-077 a IM-081).
- Leitura pelo banco via visão restrita ao administrador (filtro fixo por papel), sem expor telefone, e-mail nem dados privados de visitantes. Implementada em nova migração, aplicada primeiro no dev com aprovação do Emerson (D-003).

## D-010 · 29/10/2026 · Bloco de layout entre a Fase 3 e a Fase 4
**IDs:** IM-005, IM-014
Aprovada pelo Emerson em 29/10/2026 ("aceito sua sugestão, prossiga como sugerido"), sobre recomendação do gestor:
- A interface atual é funcional, sem identidade visual. O acabamento (sistema de design, logotipo, imagem de prévia do WhatsApp) é feito **depois da Fase 3**, quando o fluxo principal (indicar e contatar) já existe, e **antes da Fase 4**, para que as fases seguintes nasçam com o visual novo.
- Até lá, telas novas seguem o padrão atual, com celular primeiro e acessibilidade.
- O Emerson fornece logotipo e arte da marca e define a paleta (manter o verde atual ou outra) antes do bloco começar.

**Atualização em 30/10/2026 (aprovada pelo Emerson, "sim, aprovado"):**
- Logotipos entregues em `docs/marca/logotipo indicamais/` (8 PNG: fundo claro, escuro e transparente; quadrado e retangular). Sem SVG.
- **Paleta passa a ser a da marca**, no lugar do verde atual: grafite (≈ #232323) para texto, coral (≈ #FF5043) como cor principal de ação, laranja (≈ #F97316) em degradê e destaques, fundo claro neutro. Valores exatos extraídos dos arquivos pelo `interface`, com contraste acessível conferido.
- Os PNG são otimizados para a web e copiados para `public/marca/` com nomes padronizados (sem `.png.png`). A prévia do WhatsApp (`og-padrao.png`) passa a usar o logotipo quadrado.
- Trabalho na branch `layout/sistema-de-design`. Sem sites de referência: visual limpo e moderno, cantos arredondados como no logotipo.

## D-011 · 30/10/2026 · Testes ponta a ponta com Playwright (dev)
**IDs:** IM-005, IM-086, IM-088
Aprovada pelo Emerson em 30/10/2026 ("sim"), sobre proposta do gestor, para reduzir testes manuais repetitivos e cobrir a ressalva de tela em celular e desktop das Fases 2A a 2C:
- Playwright instalado (sem custo), rodando só contra o ambiente de **desenvolvimento** (servidor local), nunca contra produção.
- Duas contas de teste dedicadas no dev (dona e indicadora), criadas pelo Emerson. Credenciais só em `.env.local`, em variáveis `E2E_*` (nomes em `.env.example`); agentes nunca leem esse arquivo. Nenhum teste usa a chave `service_role` para criar usuários.
- Julgamento de aparência e de uso no celular continua com o Emerson.
- Nota de ambiente: no dev, "Confirm email" do Supabase está desligado para os testes. **Religar antes do lançamento.**

## D-012 · 30/10/2026 · Parâmetros iniciais dos pontos (resolve IM-031)
**IDs:** IM-030, IM-031
Decidida pelo Emerson em 30/10/2026 ("10 pontos a cada 30 dias, mas isso será configurável no painel do admin posteriormente"):
- Valores iniciais: **10 pontos por indicação válida** e **intervalo de 30 dias** entre pontuações do mesmo visitante no mesmo destino (IM-032, IM-033).
- Os dois valores ficam em configuração central no banco (IM-030), nunca fixos no código. A edição pelo painel do administrador (com motivo e auditoria) vem depois; até lá, a alteração é feita pela mesma rotina auditada dos demais parâmetros.
- O prazo de 15 dias citado no histórico fica descartado.
- **Interpretação do gestor, a confirmar com o Emerson:** "indicação válida" = pedido de contato recebido pelo link do indicador, no destino do link, com perfil disponível, sem ser autoindicação (IM-034) e fora do intervalo do mesmo visitante e destino (IM-032, IM-033). Visita ou compartilhamento isolado não pontua (IM-025). Os pontos entram assim que o pedido é registrado, sem confirmação do responsável. Resgates seguem desativados (IM-037), então os pontos só acumulam saldo.

**Confirmações do Emerson em 30/10/2026 ("siga as recomendações"):**
- A interpretação de "indicação válida" acima fica **confirmada**: pontos entram ao registrar o pedido, sem confirmação do responsável.
- Reversão de crédito **não reabre** o intervalo: o prazo de 30 dias segue contando desde o último pedido pontuado.
- Benefícios: prazo de uso como "N dias depois do resgate"; prazo de resgate como data. Benefício com prazo de resgate vencido sai da vitrine pública.
- Benefício cadastrado pelo administrador exige aceitação do responsável do perfil; o administrador só edita o que o responsável propôs.
- Motivo da reversão visível ao indicador: categorias fixas (ex.: "contato duplicado", "indicação inválida"). A observação interna é só do administrador.
- O indicador não vê por que um contato não pontuou (evita revelar que o visitante já contatou a empresa).

---

## D-013 · 30/10/2026 · Base de Relacionamento e notificações (resolve IM-043, IM-044, IM-045, IM-051, IM-052)
**IDs:** IM-039 a IM-045, IM-047 a IM-053
Aprovada pelo Emerson em 30/10/2026 ("siga as recomendações"), sobre proposta do gestor:
- **Curtir (IM-043):** exige conta logada; uma curtida por conta e por perfil; pode ser desfeita a qualquer momento. Visitante sem login não curte. Curtir não pontua nem gera comissão (IM-042).
- **Entrada na base por indicação (IM-044):** só com **contato válido** pelo link do indicador (mesmo critério dos pontos, D-012). Gerar link ou compartilhar não inclui ninguém.
- **Saída (IM-045):** descurtir remove só a curtida (a pessoa permanece se ainda tem indicação). "Sair da base" é ação nova da pessoa: remove da base da empresa e encerra notificações dela; fica só histórico agregado e anônimo. Encerramento de conta segue junto da exclusão de conta/LGPD (pendência antes do lançamento). A empresa vê nome de perfil público, datas de curtida e indicação e contagem de interações; nunca WhatsApp, e-mail nem nome completo (IM-041).
- **Estados e contagens (IM-051):** avisos e contagens usam só dois eventos: contato válido e curtida. "Link gerado" e "compartilhado" não contam. Nenhum aviso afirma compartilhamento externo.
- **Leitura dos avisos (IM-052):** sino com contador de não lidas, marcar como lida (uma ou todas) e abrir o item relacionado ao clicar.
- Na Fase 5 os avisos aparecem só no app; e-mail depende de provedor (custo, decisão do Emerson).

**Confirmações do Emerson em 30/10/2026 ("siga as recomendações", sobre o banco da Fase 5):**
- O sino mostra só contato válido, curtida e resultado de revisão; contato sem link não aparece no sino (o e-mail do responsável continua cobrindo todos os pedidos quando houver provedor).
- Contato válido repetido do mesmo visitante dentro de 30 dias conta como interação e gera aviso (o intervalo de 30 dias é regra dos pontos, não da base).
- O responsável não pode curtir o próprio perfil.
- Nome mostrado ao responsável: primeiro nome + inicial do último sobrenome ("Maria S."); sem nome, "Pessoa".
- Quem saiu da base continua aparecendo como contato válido ao responsável, sem nome.
- "Sair da base" é por perfil (sem "sair de todas").
- Curtir/descurtir repetido tem limite simples por pessoa e perfil, para não inflar o histórico agregado. Valor inicial: 10 mudanças (curtir ou descurtir) em 24 horas por pessoa e perfil, configurável em `relacionamento_parametro`; excedido responde P0429 (mensagem neutra), sem gravar evento nem alterar a curtida.
- Exclusão de conta de quem está na base fica junto da pendência de exclusão/LGPD antes do lançamento.

---

## D-014 · 30/10/2026 · Administração e ciclo de vida (IM-076, IM-077, IM-080, IM-081; IM-082 provisória)
**IDs:** IM-076, IM-077, IM-080, IM-081, IM-082
Aprovada pelo Emerson em 30/10/2026 ("siga as recomendações"), sobre proposta do gestor:
- **Permissões (IM-077):** administrador geral concede permissões específicas a outras contas: aprovar, gerir categorias, analisar denúncias, invalidar indicações, reverter pontos e suspender. A conta de administração atual é administrador geral. Toda ação administrativa grava auditoria (autor, data, motivo, valor original).
- **Denúncias (IM-076):** qualquer pessoa, logada ou não, pode denunciar (autoindicação, spam/fraude, uso indevido de dados, conteúdo inadequado). Proteção antispam: limite por pessoa e por alvo e campo-armadilha; captcha gratuito (Turnstile da Cloudflare) entra depois, com a proteção da borda. O denunciado nunca vê quem denunciou. Estados: aberta, em análise, procedente, improcedente. Nenhuma suspensão é automática.
- **Suspensão e reativação (IM-080):** suspensa, a conta não entra, perfis e itens saem do ar e ela não recebe contatos; pontos e histórico ficam guardados. Reativada, os perfis voltam despublicados e o responsável republica por conta própria.
- **Encerramento (IM-081):** confirmação reforçada (a pessoa digita uma palavra de confirmação); perfis ficam despublicados, sem transferência; **carência de 30 dias** com possibilidade de desistir; depois, dados pessoais (nome, telefone, e-mail) são anonimizados e ficam só históricos necessários (auditoria, pontos, lançamentos) sem identificação. Resolve também a exclusão de conta pendente para pontos e relacionamento.
- **IM-082 (políticas):** o prazo de carência e a retenção acima são provisórios para desenvolvimento. **Antes do lançamento**, a política real de privacidade e retenção precisa de revisão jurídica (pendência do Emerson); efeitos sobre assinaturas e comissões ficam para as respectivas ativações.

**Confirmações do Emerson em 30/10/2026 ("aprovado e siga as recomendações", sobre o banco da Fase 6):**
- Patrocinador, parâmetros (pontos, indicações, contas), alertas e concessão de permissões ficam só com o administrador geral; benefícios com `aprovar`.
- Conteúdo comercial dos perfis da conta encerrada (nome, descrição, WhatsApp comercial) e pedidos de contato feitos como visitante permanecem por ora; decisão final depende da política de retenção (IM-082, revisão jurídica).
- Indicador reativado volta a pontuar; pontos e histórico ficam guardados durante a suspensão.
- Indicador suspenso que tenta gerar link recebe mensagem própria (não a de "cadastre seu WhatsApp").
- Invalidar indicação reverte só os pontos; não altera a base de relacionamento nem o pedido (IM-042).
- Bloqueio de acesso: o servidor consulta `contas_meu_estado()` a cada requisição e aplica/desfaz `banned_until` pela Admin API ao suspender/reativar (sem custo novo). Rotina agendada de encerramentos e limpeza de tentativas de denúncia fica para o `devops`.

**Decisão do Emerson em 31/10/2026 (opção A, "aceito suas recomendações"), sobre o login de conta suspensa:**
- Quem tenta entrar com o e-mail de uma conta suspensa é levado a `/conta-indisponivel`. **Risco aceito:** a API do Supabase Auth recusa conta banida antes de conferir a senha, então esse redirecionamento confirma que "o e-mail tem conta e ela está suspensa" a quem digitar o e-mail com qualquer senha. Não revela senha, dado pessoal nem motivo. Senha errada e conta inexistente seguem com a mesma mensagem neutra. Reavaliar (opção C, conferir a senha no servidor) se o risco passar a pesar.
- Testes manuais no dev (suspender, entrar bloqueado, reativar, entrar, Minha conta com alterar senha e encerrar conta) deram ok.

---

## D-015 · 02/11/2026 · Painel com menu lateral em cascata (IM-005, IM-014, IM-047)
**IDs:** IM-005, IM-014, IM-047
Proposta do Emerson em 02/11/2026 ("já ir criando as dash no painel oficial em modelo de menus laterais, verticais que abrem em cascata"), registrada como decisão:
- A documentação (requisitos.md) fala em "dashboard" e no ícone de notificações no topo (IM-047), mas não define o formato da navegação. O Emerson define: **painel com menu lateral vertical, com grupos que abrem em cascata**, no lugar da faixa de botões no topo.
- Desktop: menu lateral fixo; celular: menu recolhível (botão de menu), com os mesmos grupos. O sino de avisos continua no topo (IM-047).
- Os grupos mostram só o que a pessoa pode usar (papéis e permissões, D-014); páginas, rotas e regras não mudam.
- Sugestão inicial de grupos (ajustável após ver na tela): Meu conteúdo (perfis, itens, anúncios, benefícios); Relacionamento (pedidos de contato, base, participações); Indicações e pontos (minhas indicações, pontos, avisos); Minha conta; Administração (revisão, denúncias, contas, permissões, pontos, benefícios, parâmetros, patrocinadores, categorias), por permissão.

---

## D-016 · 02/11/2026 · Páginas dos negócios como sites (IM-091, IM-092, IM-093; IM-094 e IM-018 pendentes)
**IDs:** IM-011, IM-012, IM-091 a IM-094, IM-018
Proposta do Emerson em 02/11/2026 e aprovada por ele ("aprovado, recomendo que sim"):
- A página de cada negócio passa a funcionar como **site de uma página**, muito bonito, intuitivo e prático: menu no topo, banner de topo rotativo, mapa, ações da página e boas práticas de navegação (IM-092).
- **20 estilos de página** por segmento, escolhidos pelo responsável em menu "Aparência" do painel (aba com miniaturas): lista aprovada em IM-091. **Primeira entrega com 5 estilos** (Minimalista, Gastronomia, Saúde e Bem-estar, Beleza e Estética, Construção e Reformas); os outros 15 depois, com a estrutura estável.
- **Banner rotativo** (IM-093): imagens inseridas pelo responsável e pelo administrador geral na empresa selecionada; imagem inserida pelo administrador exige **aceite do responsável** antes de publicar (como nos benefícios), com auditoria.
- Sem links externos de redes sociais nesta versão (IM-012).
- **Mapa (IM-018) decidido em 02/11/2026** ("sobre o mapa aceito sua recomendação"): usar **OpenStreetMap** (gratuito, sem chave nem cobrança). Google Maps fica como possibilidade futura, que exigiria conta Google Cloud com chave e cobrança habilitada, e portanto nova decisão. Ressalva: o uso das camadas públicas do OpenStreetMap segue a política de uso de tiles deles (sem tráfego pesado); reavaliar antes do lançamento em escala. A seção "Localização" da página recebe o mapa incorporado, com endereço em texto e "Como chegar".
- **IM-094 pendente:** se trocar de estilo exige nova aprovação (recomendação: não; estilo é só aparência e o conteúdo segue IM-022).
- **Confirmações do Emerson em 02/11/2026 ("siga as recomendações", sobre o banco da Fase 8):** o estilo da página fica **fora da revisão** (IM-094 passa a decidida: trocar estilo não exige nova aprovação; reavaliar só por nova decisão); só o **administrador geral** libera estilos novos; o **banner do administrador só entra em perfil já publicado** e exige aceite do responsável; **aviso no sino** para banner aguardando aceite entra na Fase 8 (reaproveita o módulo de notificações, IM-047/IM-052/IM-053).
- Entra como **Fase 8 — Páginas dos negócios** no roteiro, sem interromper as Fases 7 e do pré-lançamento já planejadas.

---

## D-017 · 02/11/2026 · Comissões mononível: decisões da Fase 7 (resolve IM-071, IM-072, IM-073)
**IDs:** IM-061 a IM-073
Aprovada pelo Emerson em 02/11/2026 ("siga as recomendações"), sobre proposta do gestor. Continua valendo: mononível, sem integração financeira, sem cobrança nem repasse automático; o administrador confirma pagamentos com auditoria (IM-070).
- **Elegibilidade (IM-071):** o indicador fica elegível com **qualquer assinatura ativa e em dia dele naquele negócio** e recebe comissão sobre as indicações dele em todas as ofertas habilitadas do negócio.
- **Inadimplência (IM-072):** a contagem começa no vencimento não pago da assinatura do indicador. Efeito imediato (IM-066): deixa de gerar novas comissões naquele negócio, preservando as geradas; se regularizar no prazo, volta a gerar as futuras, sem retroativas (IM-067). Avisos no app ao indicador no vencimento e a cada 15 dias; lista de inadimplentes para o administrador. **Prazo de encerramento do vínculo (IM-068): 90 dias**, configurável só pelo administrador; depois dele o vínculo encerra para comissões futuras, sem restaurar automaticamente. Clientes de vínculos encerrados ficam sem indicador, sem transferência automática (IM-069); nova indicação forma nova carteira.
- **Mudanças e reversões (IM-073):** percentual novo vale só para mensalidades pagas depois da data de vigência, inclusive em assinaturas existentes; nada gerado é recalculado (IM-069). Cancelamento da assinatura do cliente encerra as comissões futuras dessa assinatura e preserva as geradas. Estorno de mensalidade: comissão gerada **pendente** é cancelada; comissão já **paga** gera reversão registrada pelo administrador, compensada em comissões futuras, tudo auditado. Desativação do módulo para um negócio para novas comissões e preserva histórico, saldos e redes.
- **IM-082:** os efeitos do ciclo de vida sobre assinaturas e comissões entram na política real de privacidade e retenção, com revisão jurídica **antes de ativar comissões de verdade**.
- A Fase 7 só começa quando o Emerson der o sinal (envolve dinheiro).

---

## D-018 · 02/11/2026 · Seções em carrossel na página inicial (IM-095, IM-096)
**IDs:** IM-019, IM-020, IM-095, IM-096
Proposta do Emerson e aprovada por ele em 02/11/2026, sobre cinco seções sugeridas pelo gestor:
- A página inicial pública ganha **seções de carrossel por critério de importância**: Novidades, Mais curtidos, Mais indicados, Na sua cidade e Em alta na semana (critérios em IM-095). "Mais visitados" fica de fora (exigiria contar visitas: coleta nova de dados, LGPD, robôs).
- **Nomes das seções editáveis no admin master** (IM-096): título, ativação e ordem, com motivo e auditoria.
- **Inicialmente só perfis**; o modelo deve ficar preparado para acrescentar produtos e serviços depois (tipo de item da seção).
- **"Na sua cidade":** com a busca, usa a cidade e UF escolhidas; com login, a cidade do perfil da pessoa (o Emerson aceitou a sugestão do gestor). Sem cidade conhecida, a seção não aparece.
- **Cards:** 4 ou 5 por linha, conforme o que ficar melhor visualmente (decisão do `interface` com captura para o Emerson); no celular, rolagem horizontal acessível.
- Seção com poucos itens fica oculta; rankings contam pessoas distintas e nunca o dono; só dados públicos do perfil; atualização em intervalos (cache), não a cada visita. Patrocinados (IM-020) continuam no topo.
- Entra como **Fase 9** no roteiro; só avança depois do banco do mapa (mesma frente de banco).

---

## D-019 · 03/11/2026 · Ajustes da Fase 9 (IM-095, IM-096)
**IDs:** IM-095, IM-096. Aceitos pelo Emerson em 03/11/2026 ("aceito suas sugestões"); substitui os pontos correspondentes da D-018.
- **Cards por linha:** 4 (o contêiner público tem 64rem; com 5 o selo e o texto ficam apertados). Constante `CARDS_POR_LINHA_LARGA`.
- **"Na sua cidade":** os carrosséis aparecem só na home sem filtro. Com login usa a cidade do perfil da pessoa; a cidade escolhida na busca não alimenta a seção (a busca já mostra os resultados da cidade). Isso substitui o trecho "com a busca, usa a cidade escolhida" da D-018.
- **"Em alta na semana":** atividade (curtir ou indicar) de pessoas distintas nos últimos 7 dias, não crescimento. "Mais indicados" conta pessoas distintas que indicaram.
- **Cache:** memória de 60 s por instância; cache incremental compartilhado do OpenNext (R2/KV, possível custo) fica para quando houver tráfego (IM-089).

---

## D-020 · 03/11/2026 · Módulo Loja (catálogo) nas páginas (IM-097, IM-098, IM-099)
**IDs:** IM-014, IM-097, IM-098, IM-099. Aceito pelo Emerson em 03/11/2026 ("aceito suas recomendações, e aceito").
- **Catálogo, não venda:** a Loja não intermedeia venda; sem carrinho, checkout, pagamento ou repasse (IM-090). O negócio se conclui entre as partes pelo contato existente.
- **Evolução do catálogo existente:** a Loja amplia os "Produtos e serviços" (IM-014); não há segundo cadastro. Quem não tem a Loja segue com o catálogo simples de hoje.
- **Liberação sem plano:** o administrador geral libera ou retira a Loja por perfil, com motivo e auditoria, apenas para testes. Planos (IM-060) continuam futuros e, quando existirem, controlarão essa liberação. Nenhuma cobrança.
- **Imóveis (IM-098):** tipo, finalidade (venda ou aluguel), preço, área, quartos, banheiros, vagas, bairro, cidade e UF, fotos. O endereço exato fica oculto; só bairro e cidade aparecem (padrão de privacidade do mapa). Campos extras (condomínio, IPTU, financiamento) aceitos como opcionais, por recomendação do gestor.

---

## D-021 · 04/11/2026 · Estilo "Moto e Bike" e lista extensível de estilos (IM-100)
**IDs:** IM-091, IM-100. Decidido pelo Emerson em 04/11/2026 ("incluir Moto e Bike como 21º estilo, possivelmente haverão mais posteriormente").
- **21º estilo:** Moto e Bike entra na lista de estilos de página (modelo em `docs/marca/modelos-sites/estilo/`). Substitui, nesse ponto, o "20 estilos" de D-016.
- **Lista extensível:** o limite de 20 deixa de ser teto. Novos estilos virão depois; cada um recebe ID novo e só muda a aparência. A implementação deve permitir acrescentar estilo sem refatorar (lista de estilos em um só lugar).

---

## D-022 · 04/11/2026 · Seção Loja visível só em plano pago; funções dos modelos ainda não implementadas (IM-099, IM-101)
**IDs:** IM-097, IM-098, IM-099, IM-101. Decidido pelo Emerson em 04/11/2026 (aceitou a sugestão do gestor).
- **Loja depende de plano pago:** a seção Loja/catálogo (produtos, serviços e, no futuro, assinaturas) é função de planos pagos ainda a definir (IM-060 é F). Para perfis sem a liberação, a seção fica **oculta** na página pública (não aparece desabilitada) e some também dos modelos de estilo. Até existirem planos, vale a liberação manual por perfil de D-020.
- **Compra:** continua sem intermediação, carrinho, checkout ou pagamento (IM-090, D-020). Botões de compra/assinatura dos modelos, por ora, levam ao contato (IM-013). Pagamento e assinatura reais dependem de decisão futura do Emerson (pagamentos é módulo F).
- **Futuro aberto (04/11/2026):** a ausência de intermediação de pagamentos e transações vale **por enquanto**. A possibilidade de intermediar no futuro fica aberta (módulo pagamentos, F): a arquitetura não deve fechar essa porta (por exemplo, itens da Loja com preço e identificador estável, ponto único de "ação de compra"), mas nada de pagamento é implementado agora. Ativar exige decisão nova do Emerson e revisão de IM-090.
- **Confirmado em 04/11/2026 (Emerson: "creio que sim, mas aceito sua sugestão"):** sem a liberação, some só a Loja. A seção "Produtos e serviços" (catálogo simples, IM-014) continua visível como catálogo de apresentação.
- **Funções dos modelos ainda não implementadas:** não se excluem dos modelos; o `interface` as relata em `docs/lacunas-modelos.md` (IM-101), para o Emerson planejar a implementação.

---

## D-023 · 04/11/2026 · Liberação inicial dos estilos e sacola de interesse (IM-091, IM-100, IM-101)
**IDs:** IM-090, IM-091, IM-100, IM-101. Aceito pelo Emerson em 04/11/2026 ("aceito suas recomendações").
- **Liberação dos estilos:** os estilos 6 a 21 passam a `habilitado=true` no dev por migração de dados com auditoria. O autor da auditoria é o administrador mais antigo (não se cria conta "sistema").
- **Sacola/lista de interesse (modelos 6, 11, 15, 17, 18, 20):** pode existir como lista de interesse que vira mensagem de contato, **sem pagamento** e sem intermediar a venda (IM-090, D-020, D-022). A "ação de compra" fica num ponto único para não fechar a porta do pagamento futuro. Implementação posterior, conforme `docs/lacunas-modelos.md`.
- **Aceitas em 04/11/2026 ("aceito"), recomendações do gestor:** (1) variações de item (tamanho, cor) só **informativas**, sem estoque; (2) planos do negócio na página (estilo 12) como **vitrine** de itens com preço e descrição, contato pelo canal existente, sem assinatura real (F); (3) equipe **sem foto de pessoas** no início (nome e cargo ou ícone); foto com consentimento e moderação depois, junto da revisão jurídica (IM-082); (4) **sem banco de imagens** agora; o dono envia as próprias fotos e os estilos usam desenhos quando não há foto. Banco gratuito ou pago só com decisão futura do Emerson (custo, IM-089).

---

## Pendências antes do lançamento (Fase 1)
| Pendência | Situação |
|---|---|
| SMTP próprio | O envio embutido do Supabase tem limite baixo e atrasos; confirmação em outro aparelho depende de template próprio. Pode ter custo: decisão do Emerson. |
| Login com Google (IM-007) | Falta criar credenciais no Google Cloud e configurar o provedor. |
| Login com Apple (IM-007) | Bloqueado por custo (Apple Developer). |
| Exclusão de conta (LGPD) | `on delete restrict` impede apagar usuário com conta; fluxo na Fase 6. |
| IM-010 | Sem verificação por código, um número pode ser reservado por outra pessoa. Futuro. |

---

## Pendências que afetam as primeiras fases

| ID | Pendência | Como seguir até a decisão |
|---|---|---|
| IM-031 | 10 pontos a cada 30 dias, ou 15 dias? | Implementar quantidade e intervalo como configuração central (IM-030). Não ativar valor em produção até a decisão. Testes usam valores de exemplo. |
| IM-044 | Quando quem indica entra na Base de Relacionamento: ao gerar link, ao compartilhar ou ao gerar contato válido? | Registrar os três eventos separadamente no banco. A regra de entrada fica isolada e é ligada depois. |
| IM-007 (Apple) | Login com Apple exige conta Apple Developer paga. | Implementar e-mail/senha e Google. Apple fica bloqueado até o Emerson aprovar o custo. |
| IM-043 | Que identificação é exigida para curtir. | Não implementar curtida até a decisão. |
| IM-051, IM-052 | Eventos e leitura dos avisos. | Construir a estrutura de notificações; detalhes de contagem e leitura esperam decisão. |
| IM-026 (política) | A política de privacidade ainda não existe. A tela `/politica-de-privacidade` tem um texto curto e provisório, marcado como tal, e o formulário de contato aponta para ela. | Substituir pelo texto definitivo antes de abrir ao público (IM-089). |
| IM-027, IM-028 (provedor de e-mail) | Sem provedor de e-mail, o aviso ao responsável não é enviado: o pedido fica com o aviso "pendente" e a legenda "Aviso por e-mail ainda não configurado: veja aqui no painel". Com `EMAIL_API_KEY` preenchida a interface dispara o processamento, mas o enviador ainda é o padrão do módulo (falha controlada). | Escolher provedor/SMTP (pode ter custo, IM-089) e implementar o enviador. |
