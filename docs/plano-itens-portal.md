# Plano de entrega: itens da conta, teto único, validade, exclusão e site gratuito simples

Data: 13/11/2026 · Base: **D-040** (decisões do Emerson) e seção 12 de `docs/analise-impacto-portal-site.md` · IDs: IM-105 a IM-111, IM-006, IM-015, IM-079, IM-098, IM-102, IM-104, IM-032, D-035.

Este plano **substitui** `docs/proposta-arquivamento.md` (que fica como registro histórico). Onde a proposta antiga diz "arquivado não conta no teto", limites de arquivados ou "sem exclusão pelo dono", vale a D-040: despublicar/arquivar contam, **excluir esconde e libera a vaga**.

**Regras de todos os PRs:** branch `fase-17/<assunto>`, commits pequenos citando IDs, só ambiente de desenvolvimento (D-003). Toda migração é nova (nunca editar aplicada), tabela nova nasce com RLS e quatro políticas explícitas, histórico só de inserção, funções `SECURITY DEFINER` com `search_path = ''` e lista fechada de grants. Depois de cada migração: `pnpm db:types`. Marcação **[M]** = traz migração: o gestor pede **"aprovado" ao Emerson** antes de `db push` no dev. Produção nunca (D-003). Quem implementa não verifica; o `verificador` roda os testes e atualiza `docs/acompanhamento.md`.

---

## 1. O que muda no schema (resumo da seção 12 + D-040)

| Área | Mudança |
|---|---|
| `catalogo_item` | Coluna **tipo** (oferta, procura, servico, imovel; padrão `oferta` nos existentes, serviços já cadastrados mapeados pela categoria). **Cidade e UF próprias obrigatórias** (hoje só o anúncio particular tem, na versão): backfill com a do perfil, `not null` depois. `excluido_em` (exclusão lógica), `publicado_ate`, `vencido_em`. Regras `check` entre estados |
| Histórico | Nova tabela só inserção `catalogo_item_ciclo` (publicar, vencer, renovar, despublicar, excluir; autor, data, motivo, valor anterior), RLS: dono e administrador leem; escrita só por função |
| `perfis_perfil` | `excluido_em` e histórico `perfis_site_ciclo` (excluir/despublicar site libera a vaga de site). Slug continua reservado |
| Parâmetros | No padrão `contas_parametro` (auditado, motivo obrigatório): **teto único** `tetos_itens_por_conta` (10), `tetos_perfis_por_conta` (1; a faixa 1 a 50 já comporta), `tetos_criacoes_por_dia` (20), `itens_validade_dias` (7, faixa 1 a 90), `itens_aviso_vencimento_dias` (2). `tetos_itens_por_perfil` e `tetos_anuncios_particulares` deixam de ser usados (linhas preservadas, sem apagar) |
| Teto | Nova versão de `contas_exigir_teto_criacao`: conta **todas as linhas não excluídas da conta** (venda, compra, serviço, imóvel, qualquer estado); sites contam à parte; limite diário; administrador sem teto; `pg_advisory_xact_lock` por conta. **Conta acima do teto mantém o que tem** e só não cria novos |
| Vencimento | Função `catalogo_vencer_itens()` idempotente no **cron `*/15`** (`worker/entrada.ts`, `src/shared/agendador/rotinas.ts`), padrão de `contas_executar_encerramentos`, log só de contagens. As leituras públicas também exigem `publicado_ate > now()` (vence na hora, o job só grava o estado) |
| Leituras públicas | `catalogo_item_publico`, `busca_publica`, contato, link, imagem e mapa passam a depender do **item** (publicado, aprovado, vigente, não excluído, conta ativa), **não do site** (P10). Suspensão/encerramento da conta continuam derrubando tudo |
| Imóvel | Gatilho que recusa imóvel sem perfil (20261103140000) deixa de valer para card; imóvel vira **tipo de item**; `loja_liberacao` (por perfil) só governa a vitrine do site imobiliário. Privacidade de localização (D-020): só cidade e UF no card |
| Home | `busca_home_secao.tipo_item` hoje só `perfil`; passa a aceitar item de conta, e a leitura elege itens vigentes (IM-095) |
| Indicações e pontos | Sem mudança de estrutura (destino "perfil OU item" já existe). Recusar link/pontos para tipo `procura` no lançamento (IM-109). Duplicidade IM-032 **inalterada** (P9) |
| Pontos, relacionamento, comissões | Nenhuma tabela nova ou alterada; seguem só para quem tem site. Sem saldo compartilhado |

## 2. Ordem de PRs

Cada PR é pequeno e entrega o seu teste de efeito real. A ordem respeita as dependências (excluir antes do teto novo, para o dono nunca ficar preso; validade depois da vida própria do item).

| # | PR | Migração | IDs | Depende de |
|---|---|---|---|---|
| 0 | **Docs:** D-040, IM-105 a IM-111, este plano (este PR) | Não | todos | — |
| 1 | **Terminologia "site"** só em textos da interface e docs; rota `/perfil/...` mantida (P13); ajustar testes Playwright que procuram "perfil" | Não | IM-110 | 0 |
| 2 | **Modelo do item:** tipo, cidade/UF próprias (backfill), `excluido_em`, `catalogo_item_ciclo`, funções do dono `catalogo_despublicar_item` e `catalogo_excluir_item` (idempotentes; dono ou "não encontrado"), leituras ignoram excluído, tipos gerados | **[M]** | IM-105, IM-108 | 0 |
| 3 | **Teto único e parâmetros:** os 5 parâmetros, nova `contas_exigir_teto_criacao` (itens não excluídos por conta, 1 site, limite diário), contas acima mantêm o que têm, `contas_limites_criacao_atuais()` | **[M]** | IM-105, IM-111, IM-108 | 2 |
| 4 | **Módulos e interface do dono (itens):** schemas Zod, erros e mensagens do teto, criar item com tipo e localização padrão, despublicar, excluir com confirmação, contador "N de 10"; celular 44 px, `aria-live` | Não | IM-105, IM-108, IM-005 | 3 |
| 5 | **Site: despublicar e excluir** (exclusão lógica de `perfis_perfil`, histórico, libera vaga de site), **aviso** (sem bloquear) quando há comissão ou resgate em andamento; interface | **[M]** | IM-108, IM-102 | 3 |
| 6 | **Item com vida própria (IM-079 revisto):** leituras públicas, busca, contato, link, imagem e mapa dependem do item; site despublicado/oculto não derruba item; reteste de IM-097, IM-099, IM-032 | **[M]** | IM-106, IM-079 | 2 |
| 7 | **Carrossel da home com itens de conta** (IM-095) | **[M]** | IM-110 | 6 |
| 8 | **Imóvel como tipo de item:** remover o gatilho que recusa imóvel sem perfil para card, campos de imóvel e privacidade (D-020), vitrine do site imobiliário segue por `loja_liberacao` | **[M]** | IM-098 | 6 |
| 9 | **Validade (banco e cron):** `publicado_ate`, `vencido_em`, `catalogo_vencer_itens()` no cron `*/15`, `catalogo_renovar_item` (sem nova aprovação se o conteúdo não mudou; não devolve retirado por moderação; ilimitado), leitura com `publicado_ate > now()`, backfill de 7 dias para itens existentes (P12), link volta ao renovar, gancho desligado de isenção premium (F) | **[M]** | IM-107 | 6 |
| 10 | **Validade (interface):** aviso no painel ~2 dias antes (sem e-mail), tela de vencidos com Renovar/Excluir, edição dos parâmetros pelo administrador (faixa 1 a 90, auditado) | Não | IM-107 | 9 |
| 11 | **Anúncio de compra "Procura-se"** (depois do IM-102 = PRs 4 e 5): tipo `procura`, selo no card, mesmo formulário e aprovação, 7 dias; link de indicação e pontos recusados nesse tipo | **[M]** (recusa no banco) | IM-109 | 5, 9 |
| 12 | **Site gratuito simples e limitado:** 1 site por conta, estilo simples, restrições do gratuito. **Aguarda o layout do Emerson**; migração só se exigir estilo/liberação nova | **[M]** se precisar | IM-110 | layout do Emerson, 1 |
| 13 | **Verificação independente** e atualização de `docs/acompanhamento.md` (reabre status verificados afetados só quando a mudança chegar ao dev) | Não | todos | 2 a 12 |
| 14 | IM-104 (ocultar site pelo master), **pós-lançamento** | **[M]** | IM-104 | 5 |

PRs com migração: **2, 3, 5, 6, 7, 8, 9, 11 e (se preciso) 12 e 14**. Cada um só aplica no dev com "aprovado" do Emerson.

## 3. Testes de efeito real (pgTAP no dev e integração; e2e no `desktop` e `celular`)

**PR 2 e 3 (exclusão e teto)**
1. Dono exclui item: some do painel dele, de `catalogo_item_publico` e da busca; pedidos, pontos, links e histórico idênticos antes e depois (contagem).
2. Excluir libera a vaga; despublicar, arquivar e vencer **não** liberam. Com 10 itens, o 11º falha (P0430); exclui um, o 11º passa.
3. Itens de tipos diferentes (oferta, serviço, imóvel, procura) somam no mesmo teto; site não soma.
4. Limite diário: o 21º item criado no dia falha; no dia seguinte passa; administrador sem teto.
5. Sem corrida: criar em paralelo na mesma conta nunca passa de 10.
6. Conta acima do limite (ex.: 3 sites e 30 itens do dev) mantém tudo e falha ao criar novo.
7. Idempotência: excluir duas vezes grava um evento só.
8. Isolamento (RLS): usuário B não lê histórico, não exclui nem despublica o que é de A; `anon` não executa as funções; `conta_id` continua sem SELECT para `anon` e `authenticated`; administrador lê.

**PR 5 (site)**
9. Excluir/despublicar site não toca nos itens da conta; libera a vaga de site; com comissão ou resgate em andamento só avisa e executa.

**PR 6 (vida própria)**
10. Site despublicado ou oculto: itens seguem no ar, busca e contato funcionam; o item some só de dentro do site. Conta suspensa ou em encerramento derruba tudo.
11. Pontos, comissões e relacionamento: saldos e lançamentos iguais antes e depois. Duplicidade IM-032 inalterada (regressão pgTAP da regra atual: WhatsApp+site; sem site, WhatsApp+conta).

**PR 8 (imóvel)**
12. Imóvel solto (sem perfil) é aceito, aparece em card só com cidade e UF (sem endereço), conta nos 10 e segue a moderação; vitrine do site imobiliário só com `loja_liberacao`.

**PR 9 e 10 (validade)**
13. Item aprovado ganha `publicado_ate = agora + prazo`; ao passar, `catalogo_vencer_itens()` despublica e grava ciclo; segunda execução não repete. A leitura pública já esconde antes do job rodar.
14. Vencido: contato recusado com mensagem neutra, link mostra "anúncio indisponível", sem pedido nem pontos. Ao renovar, o **mesmo link** volta a valer.
15. Renovar sem mudança de conteúdo não cria versão nem nova aprovação; com edição, versão pendente e a aprovada antiga continua no ar; item retirado por moderação não volta ao renovar; renovar várias vezes é permitido.
16. Mudar o prazo (parâmetro) não altera itens no ar; só os próximos; fora da faixa 1 a 90 falha; auditoria com valor anterior e motivo.
17. Backfill: itens existentes ganham 7 dias da data da migração e não vencem todos no primeiro cron.
18. Cron: execução de teste (`--test-scheduled`, em Linux/WSL ou CI) mostra só contagens no log.
19. Painel: aviso aparece ~2 dias antes (sem e-mail enviado), lista de vencidos com Renovar/Excluir; celular e desktop.

**PR 7 (home)**
20. Carrossel inclui item de conta vigente e nunca inclui vencido, despublicado, excluído ou de conta suspensa.

**PR 11 (compra)**
21. Tipo `procura`: selo no card, contato pelo mesmo formulário com Turnstile; gerar link de indicação e creditar pontos são recusados no banco; vence em 7 dias.

**Todos:** teste estático da migração (lista fechada de funções e grants; RLS ativado e forçado com política por operação em tabela nova), `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm db:types`.

## 4. Riscos e pontos de atenção

- **Regressão em regra verificada** (IM-079, IM-097, IM-098, IM-099, IM-032): pgTAP de regressão antes e depois, reverificação só quando a mudança chegar ao dev.
- **Backfill** de localização e de prazo: migração com conferência de contagem; `not null` só depois do preenchimento.
- **Dono preso no teto:** por isso excluir (PR 2) vem antes do teto novo (PR 3) e a interface (PR 4) logo depois.
- **Abuso** (criar e excluir sem fim, renovar sem fim): limite diário de criação, auditoria, histórico só inserção. Renovação ilimitada é decisão do Emerson (P5); o abuso se contém pela moderação e pela janela de 7 dias.
- **Cron:** atraso de até 15 min coberto pela checagem na leitura; falha silenciosa coberta por alerta administrativo, se o job falhar.
- **Terminologia dupla** (site na tela, `perfis_*` no código): glossário nas docs e busca de textos antigos na revisão da interface.
- **Custo:** nenhum novo (cron e Storage atuais); aviso sem e-mail.

## 5. Fora do lançamento (F, não implementar)

Site premium pago e isenção de validade, modelos premium, site imobiliário contratado como produto, módulo de planos e pagamentos, indicação e pontos do anúncio de compra, renomear rotas e tabelas `perfis_*`.

## 6. Dúvidas abertas

Registradas ao fim da D-040: valores sugeridos (limite diário 20, aviso 2 dias), destino dos imóveis já cadastrados na Loja, layout do site simples (Emerson) e se rascunhos contam nos 10.
