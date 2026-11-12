# Proposta: arquivar perfil, item e anúncio particular (IM-102)

Data: 12/11/2026 · Para decisão do Emerson · IDs: IM-102, IM-104, IM-006, IM-011, IM-014, IM-015, IM-079, IM-086, IM-089.

**Tudo aqui é SUGESTÃO.** Nada foi implementado (sem migração, sem código). Só vale o que o Emerson aceitar; o aceite vira uma decisão nova (D-039 ou a próxima livre) e só então o trabalho começa. Formato igual ao de `docs/proposta-tetos.md`.

---

## Resumo em 8 linhas
- **Arquivar = despublicar + carimbar `arquivado_em`.** O dono arquiva e reativa; o arquivado some de tudo que é público porque todas as leituras já dependem de `publicado`.
- Uma regra no banco (`arquivado_em` preenchido exige `publicado = false`) garante isso para qualquer papel, inclusive `service_role`.
- Arquivado **não conta** nos tetos de criação (D-035), mas tem **teto próprio de arquivados** e limite de ações por dia, para impedir "criar e arquivar sem fim".
- Arquivar perfil **não altera** os itens dele (ficam escondidos junto, sem cascata). Reativar **não republica**: o dono liga o "no ar" de novo.
- Reativar respeita o teto de ativos. O dono nunca reativa o que o administrador ocultar (IM-104).
- Pontos, comissões e relacionamento não mudam. Pedidos, links e histórico ficam intactos.
- Histórico próprio, só inserção, legível pelo dono e pelo administrador.
- Entrega em 5 PRs pequenos, com testes de efeito real no banco de desenvolvimento.

---

## 1. O que muda no modelo

### Como é hoje (conferido nas migrações)
- `perfis_perfil` e `catalogo_item` têm `publicado boolean` (liga/desliga do dono, já existe) e `versao_aprovada_id`. Não há DELETE (política `*_delete_negado`, FKs `on delete restrict`).
- Anúncio particular é `catalogo_item` com `perfil_id` nulo.
- Os tetos (`contas_exigir_teto_criacao`, 20261109110000) contam **todas** as linhas da conta, inclusive despublicadas. Por isso despublicar não libera espaço, e hoje só o suporte livra o dono.
- O dono já pode `update (publicado, slug)` em `perfis_perfil` e `update (publicado)` em `catalogo_item`.
- Suspensão e encerramento de conta já usam o padrão "despublica e não republica sozinho" (20261102130000 e 20261102140000). Arquivar segue o mesmo caminho.

### Opções

| | A. Coluna `arquivado_em` (mais tabela de histórico) | B. Estado novo (coluna `situacao` com ativo, arquivado, oculto) | C. Apagar de verdade (soft delete via DELETE) |
|---|---|---|---|
| Como funciona | `arquivado_em timestamptz null` em cada tabela; regra `arquivado_em is null or publicado = false` | Troca `publicado boolean` por um estado | Remove a linha |
| Leituras públicas | **Nada a mudar**: todas já filtram `publicado` (visões, busca, loja, mapa, banner, indicações, pontos) | Reescrever mais de 15 funções e visões | Quebra FKs de indicações, pontos, comissões |
| Reversível | Sim | Sim | Não |
| Histórico preservado | Sim | Sim | Não (viola IM-102) |
| Risco | Baixo | Alto: muita migração em regra já verificada | Inaceitável |

### Recomendação (sugestão): A
- Colunas: `perfis_perfil.arquivado_em` e `catalogo_item.arquivado_em` (nulas = ativo).
- Regra de banco: `check (arquivado_em is null or publicado = false)` nas duas tabelas. Vale para qualquer papel. Se o dono tentar religar `publicado` num arquivado, o banco recusa (23514) e a interface mostra "Reative antes de colocar no ar".
- Tabelas de histórico, só inserção (gatilho `administracao_registro_imutavel`, que já existe): `perfis_arquivamento` (perfil_id, acao `arquivar`/`reativar`, autor_id, motivo opcional, publicado_antes, criado_em) e `catalogo_arquivamento` (item_id, mesmas colunas). O prefixo é o do módulo (perfis, catalogo).
- Quem arquivou não precisa de coluna: o dono é o responsável; o autor fica no histórico.
- `arquivado_em` **não** entra no SELECT de `anon` (só `authenticated`) e **não** entra no UPDATE de ninguém: só as funções abaixo o mudam.
- Os dados privados do dono (`conta_id`) continuam sem SELECT, como hoje.

---

## 2. Efeito nas leituras públicas

Como arquivado implica `publicado = false`, e toda leitura pública já exige `publicado` (e `perfis_perfil_disponivel`, que também exige), o efeito é o mesmo de "despublicado" hoje, sem reescrever nada:

| Onde | O que acontece com perfil arquivado | Item arquivado | Anúncio particular arquivado |
|---|---|---|---|
| Vitrine e home (`busca_home_secoes`) | Some | Some | Some |
| Busca (`busca_publica`, visões públicas) | Some | Some | Some |
| Página pública (`perfis_perfil_publico`, `catalogo_item_publico`, loja) | Não encontrada (404 neutro, igual ao despublicado) | Idem | Idem |
| Itens do perfil arquivado | Somem também (a visão do item exige perfil disponível, IM-079), mesmo sem arquivar cada um | n/a | n/a |
| Imagens no Storage | Deixam de ser públicas (a função `catalogo_imagem_publica` usa as visões públicas), mas os arquivos continuam guardados | Idem | Idem |
| Mapa e banner | Somem (exigem perfil disponível) | n/a | n/a |
| Formulário de contato | **Recusado**: `indicacoes_enviar_contato` já devolve P0002 "destino indisponível" quando o destino não está disponível. A página mostra a mensagem neutra de indisponível, sem dizer que está arquivado | Idem | Idem |
| Link de indicação já existente | O registro do link fica. Aberto por visitante, cai na página indisponível; não gera pedido nem pontos. O indicador vê "indisponível" na lista dele (a leitura já calcula `disponivel`). Se o dono reativar e recolocar no ar, o mesmo link volta a funcionar | Idem | Idem |
| Gerar link novo | Recusado (P0002, `indicacoes_gerar_link` exige destino disponível) | Idem | Idem |
| Pedidos de contato já feitos | Preservados, intocados. A notificação ao dono segue o fluxo normal (a conferir no teste de efeito real: reenvio de aviso de pedido anterior ao arquivamento) | Idem | Idem |
| Slug do perfil | Continua reservado (`unique`), não é liberado, para ninguém tomar o endereço | n/a | n/a |

**Pergunta:** o visitante deve saber que o perfil foi arquivado? Recomendo que não (mensagem neutra), igual a despublicado.

---

## 3. Efeito nos tetos (D-035)

### Regra proposta
- **Arquivado não conta** nos tetos de criação: 3 perfis, 30 itens por perfil, 10 anúncios particulares, 10 rascunhos abertos. `contas_exigir_teto_criacao` passa a contar só `arquivado_em is null`.
- Despublicado **continua contando** (só arquivar libera).
- Rascunho arquivado não conta em "rascunhos abertos".
- Mudança na própria função de teto: uma migração nova (`create or replace`), sem editar a antiga.

### O abuso: criar e arquivar sem fim
Sem freio, a conta cria 3, arquiva 3, cria 3 e enche o banco, anulando o objetivo da D-035 (custo, IM-089). Proposta em duas camadas, ambas parâmetros auditados no padrão de `contas_parametro` (motivo obrigatório, auditoria com valor anterior):

| Parâmetro | Valor sugerido | Faixa | O que limita |
|---|---|---|---|
| `tetos_perfis_arquivados_por_conta` | **10** | 0 a 100 | Perfis arquivados ao mesmo tempo |
| `tetos_itens_arquivados_por_conta` | **100** | 0 a 1000 | Itens de perfil arquivados individualmente (soma de todos os perfis) |
| `tetos_anuncios_arquivados_por_conta` | **50** | 0 a 500 | Anúncios particulares arquivados |
| `tetos_arquivamentos_por_dia` | **20** | 1 a 500 | Arquivar + reativar por conta por dia (conta no histórico; evita girar sem parar e encher o histórico) |

- Tamanho máximo por conta fica limitado: no máximo 3 + 10 perfis, 30 itens por perfil ativo, mais 100 itens arquivados, 10 + 50 anúncios.
- Passou do teto de arquivados: erro P0430 (o mesmo código dos tetos, chave `tetos_perfis_arquivados_por_conta` etc.), com a mensagem "Você chegou ao limite de itens arquivados. Fale com o suporte."
- Mesma exceção dos tetos: administrador sem limite.
- Mesmo bloqueio contra corrida: `pg_advisory_xact_lock` por conta (a mesma chave `contas_criacao:<conta>`), para criar, arquivar e reativar da mesma conta se serializarem. Assim, "criar" e "reativar" simultâneos nunca passam do teto.
- **Ressalva honesta:** o teto de arquivados é fixo e acaba para um dono muito ativo (por exemplo, quem vende e arquiva anúncios todo mês). Duas saídas, para o Emerson escolher: (i) valores generosos e o suporte resolve os raros casos; (ii) arquivado com mais de 12 meses deixa de contar no teto de arquivados (janela móvel; mais complexo). Recomendo (i) agora.
- **Imagens:** o arquivado **continua contando** nas 100 imagens por conta (os arquivos ficam no Storage, IM-089). Arquivar libera teto de criação, não libera espaço de imagem. Precisa ficar claro na tela.

---

## 4. Arquivar perfil: e os itens? E reativar?

### Recomendação (sugestão): sem cascata
- Arquivar perfil **não altera** nenhuma linha de item. Os itens ficam como estavam; somem do público porque o perfil indisponível os esconde (IM-079).
- Na tela do dono, os itens de um perfil arquivado aparecem sob o perfil, em modo leitura: não se cria item novo, não se envia versão, não se arquiva item individual enquanto o perfil estiver arquivado ("Reative o perfil primeiro"). A criação de item exige perfil ativo.
- Itens do perfil arquivado **não** entram na conta de "itens arquivados", e continuam contando só no teto de 30 daquele perfil.
- Reativar perfil: só retira `arquivado_em`. Exige vaga em `tetos_perfis_por_conta`. O perfil **não** volta ao ar sozinho: o dono liga "no ar" de novo (mesmo padrão da reativação de conta suspensa, 20261102130000).
- Reativar não pede nova aprovação: a versão aprovada continua a mesma. Qualquer edição cria versão nova que passa pela revisão de sempre.
- Reativar item: exige perfil ativo (se for item de perfil), vaga no teto de 30 do perfil (ou 10 de anúncios) e vaga em rascunhos se o item nunca foi enviado. Também não recoloca no ar.

### Por que sem cascata
Com cascata, arquivar um perfil de 30 itens gastaria 30 vagas do teto de itens arquivados e reativar exigiria religar 30 estados. Sem cascata, o histórico e o "no ar" de cada item ficam como o dono deixou.

### Moderação
- Versão pendente de perfil ou item arquivado sai da fila de revisão (`administracao_fila_pendencias` ignora arquivados) e volta quando reativado.
- Enviar versão e gravar rascunho de algo arquivado é recusado (`perfis_enviar_versao`, `perfis_gravar_versao`, `catalogo_enviar_item_versao`).

---

## 5. Relação com o IM-104 (ocultar pelo administrador master)

Oculto pelo administrador **não é** arquivado pelo dono. Proposta para o desenho não travar o IM-104, que é pós-lançamento:

| | Arquivado (IM-102) | Oculto (IM-104) |
|---|---|---|
| Quem faz | Dono | Administrador master |
| Quem desfaz | Dono (com vaga no teto) | Só administrador master (o IM-104 define se desfaz) |
| Coluna | `arquivado_em` | Outra, `oculto_pelo_admin_em` (só no IM-104) |
| Some do painel do dono | Não, fica na aba "Arquivados" | Sim (IM-104) |
| Regra de banco | `arquivado_em` preenchido exige `publicado = false` | Idem, na migração do IM-104 |
| Auditoria | Histórico próprio do dono | `administracao_auditoria` (autor, data, motivo, valor anterior) |

- Se o administrador oculta um perfil que o dono já arquivou, as duas marcas coexistem. As funções de reativar do dono **recusam** quando existir a marca de oculto (a verificação entra na migração do IM-104; hoje a coluna não existe e não vou criá-la antes).
- O dono não vê nem reativa o que o administrador ocultou.
- Se o oculto conta nos tetos do dono ou não é pergunta para a proposta do IM-104, não desta. Deixo registrado.

---

## 6. Pontos, comissões, relacionamento

**Nada muda e nenhum altera o outro** (IM-065, IM-042). Arquivar não toca em saldo, lançamento, acordo, base de relacionamento nem em histórico. O que acontece é só o efeito de "indisponível" que já existe para despublicado:
- Pedidos já feitos e os pontos deles ficam. Novos pedidos não entram (contato recusado), logo sem novos pontos.
- Benefícios de pontos e ofertas de comissão do perfil somem da vitrine, pois exigem perfil disponível. Resgates, comissões e lançamentos pendentes **não são cancelados** automaticamente.
- Reversões e estornos continuam possíveis (só inserção, IM-078).
- Atenção (pergunta 9): arquivar perfil com acordo de comissão ou resgate em andamento pode ser bloqueado ou só avisado.

---

## 7. RLS, auditoria, funções

### RLS
- Tabelas novas: `perfis_arquivamento` e `catalogo_arquivamento`, `enable` e `force row level security`, quatro políticas explícitas cada:
  - SELECT: dono (via `perfis_eh_dono` / `catalogo_eh_dono`) e administrador.
  - INSERT, UPDATE, DELETE: negados (`false`). A escrita é só por funções SECURITY DEFINER; o gatilho de imutabilidade vale também para `service_role`.
- Tabelas existentes: nenhuma política muda. Dono segue lendo o seu e atualizando só `publicado` (e `slug`); `arquivado_em` fica fora do UPDATE e do SELECT de `anon`. Só `authenticated` lê `arquivado_em`, e as visões `perfis_meus_perfis` e `catalogo_meus_itens` ganham a coluna (com `create or replace view`, coluna no fim).
- Teste obrigatório de isolamento (mesmo estilo dos existentes): o usuário B não lê, não arquiva e não reativa o que é do usuário A.

### Auditoria
- Ação do dono não é "ação administrativa", mas é uma reversão com efeito público. Recomendo: **grava histórico próprio** (autor, data, motivo opcional, estado anterior de `publicado`) nas tabelas acima, e **não** escreve em `administracao_auditoria` (que é só leitura de administrador e pensada para atos do admin).
- O administrador lê os dois. A consulta administrativa de negócios (`administracao_consulta_negocios`) ganha o campo `arquivado` em PR posterior.
- Teto e limites são parâmetros: mudar valor continua em `contas_definir_parametro` (motivo obrigatório, auditoria com valor anterior e novo).

### Funções novas (todas `SECURITY DEFINER`, `set search_path = ''`)
Lista fechada para os testes de privilégio. Colunas: quem pode executar.

| Função | Execute |
|---|---|
| `perfis_arquivar_perfil(p_perfil_id uuid, p_motivo text default null)` | só `authenticated` |
| `perfis_reativar_perfil(p_perfil_id uuid)` | só `authenticated` |
| `catalogo_arquivar_item(p_item_id uuid, p_motivo text default null)` (serve a item de perfil e anúncio particular) | só `authenticated` |
| `catalogo_reativar_item(p_item_id uuid)` | só `authenticated` |
| `contas_exigir_teto_arquivamento(p_conta uuid, p_tipo text)` (guarda interna) | ninguém (`revoke all` de public, anon e authenticated) |
| `contas_exigir_teto_criacao(...)` (substitui a atual, conta só ativos) | ninguém |
| `contas_limites_criacao_atuais()` (substitui, inclui os 4 parâmetros novos) | `authenticated` |
| `perfis_enviar_versao`, `perfis_gravar_versao`, `catalogo_enviar_item_versao`, `catalogo_criar_item` (substituídas para recusar arquivado) | mesmos grants de hoje |

- Os quatro nomes de arquivar/reativar não aparecem para `anon`. As funções verificam `auth.uid()`, o dono e o estado; não dependem de o cliente "confiar".
- Idempotência: arquivar algo já arquivado, ou reativar algo já ativo, não faz nada e não grava histórico duplicado (retorna sem erro). A restrição é por estado, não por contador.
- Erros (reaproveita o padrão): `42501` sem login ou não é dono (para quem não é dono vale o mesmo P0002 de "não encontrado", para não vazar existência); `22023` parâmetro inválido (motivo acima de 200 caracteres); `P0430` teto (criação ou arquivados; hint = chave do parâmetro); `P0001` estado inválido ("reative o perfil primeiro"); `23514` tentativa de religar `publicado` em arquivado.

---

## 8. Interface (módulo perfis e catálogo; tela do dono)

- **Listas atuais** (perfis, itens, anúncios): botão/menu "Arquivar" em cada linha. Diálogo de confirmação com o que acontece em linguagem simples: "Sai do ar e da busca. Seus pedidos, pontos e histórico ficam guardados. Você pode reativar depois." Campo de motivo opcional.
- **Aba "Arquivados"** em cada lista, com contador (por exemplo "2 arquivados de 10") e botão "Reativar". Mostra a data em que foi arquivado (fuso America/Sao_Paulo, pt-BR).
- **Contador de uso** ("2 de 3 perfis") perto do botão de criar, usando `contas_limites_criacao_atuais`.
- **Reativar com teto cheio:** mensagem "Você já tem 3 perfis ativos. Arquive outro para reativar este." O item aparece reativado mas fora do ar; aviso "Reativado. Para voltar ao ar, ligue 'No ar'."
- **Mensagens do teto atualizadas** (hoje mandam falar com o suporte):
  - Perfis: "Você chegou ao limite de 3 perfis. Arquive um perfil que não usa para criar outro."
  - Itens: "Este perfil chegou ao limite de 30 itens. Arquive um item para criar outro."
  - Anúncios: "Você chegou ao limite de 10 anúncios particulares. Arquive um anúncio que não vale mais."
  - Rascunhos: "Você tem 10 rascunhos abertos. Envie, exclua ou arquive algum antes de criar outro."
  - Arquivados cheios: "Você chegou ao limite de arquivados. Fale com o suporte."
  - Arquivos a mudar: `src/modules/perfis/erros.ts`, `src/modules/catalogo/erros.ts`, `src/shared/conteudo/erros-banco.ts` e seus testes `erros-limite`.
- **Celular (prioridade, IM-005):** ação num menu "mais" por linha, com área de toque de pelo menos 44 px; confirmação em folha inferior (bottom sheet) ou tela cheia; "Ativos / Arquivados" como abas lado a lado, sem tabela larga; botão de confirmar com rótulo claro ("Arquivar") e o de cancelar ao lado; nada que dependa de passar o mouse. Testar nos dois projetos do Playwright (`desktop` e `celular`).
- Acessibilidade: foco volta ao item após fechar o diálogo; mensagens de erro e sucesso em região `aria-live`; contraste da marca "Arquivado".

---

## 9. Plano de entrega e testes

Branch `fase-17/<assunto>` por PR, commits pequenos citando IDs. Só ambiente de desenvolvimento (D-003). Após a migração, `pnpm db:types`.

| PR | Conteúdo | IDs |
|---|---|---|
| 1 | Migração do modelo: colunas, regra `arquivado_em/publicado`, tabelas de histórico com RLS, parâmetros de arquivados, quatro funções, teto de criação só de ativos, guarda de arquivados, views do dono. Tipos gerados. Teste estático da migração (`tests/migracoes-arquivamento.test.ts`) com a lista fechada de funções e o RLS de cada tabela | IM-102, IM-086, IM-089 |
| 2 | Migração complementar: recusar enviar/gravar versão e criar item em arquivado, filtrar arquivado da fila de revisão, campo `arquivado` na consulta administrativa | IM-102, IM-079 |
| 3 | Módulos perfis e catálogo (serviços, schemas Zod, erros e mensagens) e testes de unidade | IM-102 |
| 4 | Interface do dono: arquivar, reativar, aba "Arquivados", contador e mensagens do teto | IM-102, IM-005 |
| 5 | Testes de efeito real (integração contra o dev) e ponta a ponta (desktop e celular); registro em `docs/acompanhamento.md` feito pelo verificador | IM-102 |

### Testes de efeito real (PR 1, 2 e 5)
1. Dono arquiva perfil: some de `perfis_perfil_publico`, `busca_publica` e da home; o item dele some de `catalogo_item_publico`; a imagem deixa de ser pública.
2. Contato público para perfil arquivado é recusado (P0002), sem gerar pedido nem pontos; o link existente continua gravado.
3. Pedidos, pontos, links e histórico anteriores ao arquivamento seguem idênticos (contagem antes e depois).
4. Teto: com 3 perfis ativos, o 4º falha; arquivar um, o 4º passa; reativar com 3 ativos falha; arquivados cheio falha; 21ª ação do dia falha.
5. Sem corrida: criar e reativar em paralelo na mesma conta nunca passam do teto.
6. Dono não consegue `publicado = true` em arquivado (23514), nem direto na tabela nem pela API; `service_role` também não.
7. Reativar não coloca no ar; reativar item de perfil arquivado falha.
8. Isolamento: usuário B não lê histórico, não arquiva e não reativa nada de A; `anon` não executa as funções; administrador lê.
9. Idempotência: arquivar duas vezes grava um evento só.
10. Administrador sem teto de arquivados.
11. Pontos, comissões e relacionamento: saldos e lançamentos iguais antes e depois.
12. Interface: arquivar, ver em Arquivados, reativar, mensagem do teto, no celular.

---

## 10. Perguntas de produto para o Emerson

Responda "Aceito" ou "Não" (com o valor que prefere, se quiser mudar).

| # | Pergunta | Sugestão | Resposta |
|---|---|---|---|
| 1 | Arquivar vale para perfil, item de perfil e anúncio particular, só pelo dono? | Sim | |
| 2 | Arquivar tira do ar e da busca, mas guarda tudo (indicações, pedidos, pontos, histórico), e é reversível? | Sim | |
| 3 | Arquivado deixa de contar nos tetos de criação (despublicado continua contando)? | Sim | |
| 4 | Limite de perfis arquivados por conta | 10 | |
| 5 | Limite de itens arquivados por conta (itens de perfil) | 100 | |
| 6 | Limite de anúncios particulares arquivados por conta | 50 | |
| 7 | Limite de arquivar e reativar por dia, por conta | 20 | |
| 8 | Quando o teto de arquivados enche, o dono fala com o suporte (sem janela móvel de 12 meses)? | Sim, valores generosos agora | |
| 9 | Arquivar perfil com comissão ou resgate em andamento: só avisar, ou bloquear? | Só avisar | |
| 10 | Arquivar perfil não arquiva os itens (sem cascata); itens ficam em modo leitura até reativar o perfil? | Sim | |
| 11 | Reativar não recoloca no ar (o dono liga "No ar" de novo) e não exige nova aprovação? | Sim | |
| 12 | Reativar só é permitido se houver vaga no teto de ativos? | Sim | |
| 13 | Imagens de arquivado continuam contando nas 100 por conta (arquivar não libera Storage)? | Sim | |
| 14 | O endereço (slug) do perfil arquivado continua reservado? | Sim | |
| 15 | O visitante que abre um perfil arquivado vê a mensagem neutra "indisponível", igual a despublicado? | Sim | |
| 16 | O dono informa motivo ao arquivar? | Opcional (até 200 caracteres) | |
| 17 | Rascunho nunca enviado também pode ser arquivado (e deixa de contar em "rascunhos abertos")? | Sim | |
| 18 | O histórico do dono (arquivou e reativou) fica visível para ele e para o administrador? | Sim | |
| 19 | Quem não é dono nunca reativa o que o administrador ocultou (IM-104), mesmo já estando arquivado pelo dono? | Sim | |
| 20 | Conta suspensa ou em encerramento pode arquivar? E reativar? | Arquivar sim; reativar só com a conta ativa | |
| 21 | Atualizar as mensagens do teto para orientar "arquive" em vez de "fale com o suporte"? | Sim | |

### Impacto em IDs (se aceito)
- **IM-102**: passa de "regra a definir" para regra definida (D nova).
- **IM-015, IM-006, IM-011, IM-014** (perfis, itens, anúncios): o teto da D-035 conta só ativos; ganham arquivados.
- **IM-079** (disponibilidade): sem mudança de regra, só ganha mais um motivo para "indisponível".
- **IM-086, IM-089**: parâmetros auditados e limite de arquivados contêm custo de banco e Storage.
- **IM-104**: não é alterado; a regra de "dono não reativa o oculto" entra na migração do IM-104.
- **IM-065, IM-042, IM-078**: sem mudança.
- Nenhum ID novo é necessário; se o Emerson preferir, os limites de arquivados viram requisito novo (IM-105, próximo livre), sem renumerar.
- Fora desta proposta: exclusão definitiva pelo dono (não existe e conflitaria com o histórico), retenção de dados (IM-082).
