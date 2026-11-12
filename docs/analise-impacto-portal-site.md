# Análise de impacto: portal de anúncios e "site" (D-039)

Data: 12/11/2026 · Para decisão do Emerson · IDs: IM-006, IM-011, IM-014, IM-015, IM-016, IM-021, IM-022, IM-032, IM-079, IM-092, IM-095, IM-097, IM-099, IM-102, IM-104, D-035, D-020.

**Só a D-039 (pontos 1 a 7) é decisão do Emerson. Tudo o mais aqui é análise e SUGESTÃO.** Nada foi implementado: sem migração, sem código. Conferido nas migrações (`20261024130000_catalogo_itens`, `20261029100000_catalogo_anuncio_particular_localizacao`, `20261030100000_indicacoes_modelo`, `20261109110000_contas_tetos_criacao`) e em `docs/acompanhamento.md`.

---

## 1. Como é hoje

- `catalogo_item` tem `conta_id` (obrigatório) e `perfil_id` (opcional). Com `perfil_id` é "item de perfil"; sem, é "anúncio particular" (IM-015). Uma FK composta garante que o perfil seja da mesma conta.
- O item público exige `publicado` + versão aprovada + (anúncio particular **ou** perfil disponível). Ou seja, perfil indisponível derruba os itens dele (IM-079).
- Anúncio particular tem cidade/UF na versão (localização obrigatória, 20261029); item de perfil herda a localização do perfil.
- `indicacoes_link` e `indicacoes_pedido_contato` têm destino "perfil OU item". Pontos e duplicidade (IM-032) usam: WhatsApp do visitante + perfil; para particular, WhatsApp + conta anunciante; "independe do item".
- Tetos (D-035): 3 perfis, 30 itens por perfil, 10 particulares, 10 rascunhos; contam **todas** as linhas, inclusive despublicadas. Não há DELETE nem arquivamento (IM-102 a fazer).
- Loja (IM-097/098/099): evolução do catálogo, liberada por plano manual (`loja_liberacao`); itens de imóvel em tabela própria.

## 2. O que a D-039 muda, em termos de modelo

Pelos pontos 3 e 6, o item é da **conta** e o site é um **serviço opcional**. Em termos práticos:
- O item sem site deixa de ser exceção ("anúncio particular") e passa a ser o caso normal.
- O item de site vira "o mesmo item, exibido também dentro do site" (como no Marketplace).

### 2.1 Unificar ou manter dois tipos?

| | A. Unificar (recomendado) | B. Manter dois tipos |
|---|---|---|
| Ideia | Um só tipo de item da conta. "Mostrar no meu site" é uma opção do item (ou automática se a conta tem site). `perfil_id` deixa de ser a identidade e vira "exibição no site" | `perfil_id` nulo = anúncio particular; preenchido = item do site, como hoje |
| Encaixe na D-039 | Total (ponto 3: item com vida própria) | Parcial: item de site some quando o site cai |
| Migração | Média: `perfil_id` passa a ser só vínculo de exibição, sem exigir dono pelo perfil; leituras trocam "perfil disponível" por "item publicado" | Mínima |
| Risco | Mexe em regras verificadas (ver seção 8) | Baixo, mas cria duas regras de teto, validade e despublicação |
| Teto | Um só: 10 itens por conta | Dois: o que conta para os 10? |

Sugestão: **A**, em etapas (seção 9). Por baixo, o menos arriscado é manter a coluna `perfil_id` (sem renomear) e mudar só o significado e as leituras: o item passa a ser público por si, e o site o lista se `perfil_id` está preenchido e o site está disponível.

## 3. Schema (por tabela)

| Tabela | Mudança sugerida |
|---|---|
| `catalogo_item` | `perfil_id` continua opcional, sem exigir que o item "pertença" ao site. Novas colunas: `publicado_ate timestamptz` (fim da validade), `vencido_em timestamptz`, `excluido_em timestamptz` (ver 6). Regras `check` coerentes entre estados. Localização do item deixa de depender do perfil: item de site precisa de localização própria ou herda por padrão (pergunta 8) |
| `catalogo_item_versao` | Sem mudança estrutural. Renovar não cria versão nova (se a pergunta 5 for "sem nova aprovação") |
| Histórico do item | Nova tabela só de inserção (`catalogo_item_ciclo`: publicar, vencer, renovar, despublicar, excluir; autor, data, motivo, valor anterior), como a proposta de arquivamento |
| `perfis_perfil` | `excluido_em` e, se IM-102 for adiante, `arquivado_em`. Nada muda em slug, versões, estilos |
| Parâmetros | Nova tabela `contas_limite_parametro` ou extensão de `contas_tetos_criacao` (padrão `indicacoes_parametro`, auditado, motivo obrigatório): `sites_por_conta` (1), `itens_por_conta` (10), `validade_item_dias` (7), `aviso_vencimento_dias` (a definir). Planos (F) entram depois trocando a origem dos valores, sem mudar a regra |
| `indicacoes_*`, `pontos_*`, `comissoes_*`, `relacionamento_*` | Sem mudança de estrutura. Os destinos "perfil OU item" já cobrem os dois casos |

Excluir: sugestão de **exclusão lógica** (`excluido_em`), não DELETE, porque pedidos, pontos, comissões e links apontam para o item com `on delete restrict` e a regra do projeto proíbe apagar histórico (IM-078). O item "excluído" some para todos, inclusive do painel do dono, e deixa de contar no teto (ver pergunta 3). Exclusão definitiva de dados pessoais fica com a revisão jurídica (IM-082).

## 4. RLS e privacidade

- Sem tabela nova sem RLS e políticas explícitas por operação; pgTAP de isolamento entre contas para cada tabela nova.
- `conta_id` continua sem SELECT para `anon` e `authenticated` (IM-029); o dono lê por função `SECURITY DEFINER`.
- O dono só muda estado por funções (`publicar`, `despublicar`, `renovar`, `excluir`), nunca por UPDATE de coluna de vencimento: assim o prazo não é burlado.
- Item público passa a ser lido só pela condição própria do item (não mais "perfil disponível"). Teste novo: site despublicado não derruba o item; item vencido, despublicado ou excluído nunca aparece para `anon`.
- Auditoria de toda ação administrativa sobre item/site, como hoje.

## 5. Busca, vitrine e contato público

- **Busca e home** (`busca_publica`, `busca_home_secoes`): hoje os itens entram pelo perfil disponível ou como particular. Passam a entrar pelo item publicado e vigente. A seção de carrossel de itens (IM-095, hoje só perfis) fica mais natural.
- **Página do site** (IM-092, Loja IM-097): lista os itens da conta ligados ao site, mais a ordem. Item vencido some da lista.
- **Contato público** (`indicacoes_enviar_contato`): hoje recusa se o destino não está "disponível". Para item, "disponível" passa a significar publicado e dentro da validade (não depende do site). Para o site, continua. Mensagem neutra, sem dizer que venceu.
- **Link de indicação** de item vencido: registro fica, página indisponível, sem pedido nem pontos (mesmo tratamento do despublicado). Ao renovar, o link volta a valer (confirmar na pergunta 7).
- **Imagens** (Storage): a função de imagem pública acompanha a visão pública; item vencido deixa de servir a imagem, arquivo preservado.

## 6. Validade de 7 dias

- **Estados** do item: rascunho, pendente, publicado (vigente), **vencido** (despublicado automaticamente, aguardando decisão do dono), despublicado (pelo dono), excluído.
- **Início da contagem:** na publicação (aprovação pela moderação, IM-021) e a cada renovação. Item aguardando aprovação não conta prazo.
- **Job:** nova função `catalogo_vencer_itens()` no cron `*/15` existente (`worker/entrada.ts`, `src/shared/agendador/rotinas.ts`), no padrão de `contas_executar_encerramentos`: `update ... set publicado=false, vencido_em=now() where publicado and publicado_ate <= now()`, idempotente, com log só de contagens. Execução a cada 15 min significa vencimento com até 15 min de atraso: aceitável. Para não depender do cron, as leituras públicas também checam `publicado_ate > now()` (vencimento valendo de imediato, o job só grava o estado).
- **Renovar:** função do dono, só para item `vencido` (e, se quiser, publicado perto do fim); recoloca `publicado_ate = now() + prazo`. Respeita o teto. Limite de renovações por dia para evitar abuso.
- **Excluir anúncio:** função do dono; exclusão lógica (seção 3).
- **Aviso de vencimento:** só no painel, por sugestão (sem e-mail: sem custo, sem novo envio de dados). Banner "N itens vencem em X dias" e "N itens vencidos" no painel.
- **Prazo como parâmetro** (`validade_item_dias`, padrão 7), editável pelo administrador com motivo e auditoria. Mudança vale para as próximas publicações e renovações, não retroativa.
- **Efeito em pontos e relacionamento:** item vencido não aceita novas indicações (como despublicado); pontos já creditados e pedidos preservados.

## 7. Conflitos com requisitos existentes

| ID | Conflito | Sugestão de ajuste (texto para o Emerson aceitar) |
|---|---|---|
| IM-079 | "perfil indisponível retira itens/benefícios e impede novas indicações, pontos e resgates associados" contradiz o ponto 3 | **IM-106 (proposta):** despublicar ou ocultar um site retira o site e a exibição dos itens **dentro dele**; os itens da conta continuam publicados. Benefícios e resgates do site seguem ligados ao site. Item vencido, despublicado ou excluído impede novas indicações e pontos daquele item |
| IM-015 | "Produtos sem exigir perfil comercial" vira regra geral, não tipo especial | **IM-105 (proposta):** a conta cadastrada pode publicar itens (produtos, serviços, itens à venda) sem site. O "anúncio particular" passa a ser "item da conta" |
| IM-006 | "responder por vários perfis comerciais" | Ajustar para o limite de sites do plano (1 no básico). Texto em IM-105 |
| IM-032 | Duplicidade: "para particular, WhatsApp + conta anunciante; independe do item" | Com item unificado, a chave de duplicidade precisa ser redefinida: por site (WhatsApp + site) ou por conta dona do item (WhatsApp + conta)? Pergunta 9. Mudança em regra verificada: exige reteste de pontos |
| IM-099 / D-020 | Loja "vinculada a plano", liberada manualmente, e IM-097 diz "nas páginas dos negócios" | Itens à venda agora existem fora do site. A Loja é o módulo do site que lista os itens? Pergunta 2 |
| IM-102 | Proposta de arquivamento diz "arquivado não conta no teto"; ponto 5 diz o contrário | Reescrever IM-102: despublicar, arquivar e vencer contam; só **excluir** libera espaço |
| IM-104 | Ocultar perfil | Só trocar "perfil" por "site". O item da conta não some junto (tem vida própria). Confirmar na pergunta 10 |
| IM-021/022 | Aprovação e versões do item | Sem conflito. Renovação sem nova aprovação é a sugestão (pergunta 5); edição continua gerando versão pendente |

Texto proposto para **IM-105** (aceitar ou ajustar): "A conta cadastrada pode publicar itens (produtos, serviços e itens à venda) sem possuir site. Os itens pertencem à conta e têm vida própria. Quem possui site também os vê dentro dele. O site é serviço à parte, contratado ou não. O plano básico permite 1 site e 10 itens por conta, em parâmetros editáveis pelo administrador."
Texto proposto para **IM-107** (validade): "Todo item publicado tem validade (inicial: 7 dias, parâmetro). Ao vencer, o sistema o despublica e ele aguarda o dono: Renovar ou Excluir. O dono é avisado no painel."
Texto proposto para **IM-108** (despublicar e excluir): "O dono pode despublicar e excluir site e item. Despublicado, arquivado e vencido contam no limite; só excluído libera espaço. A exclusão preserva pedidos, pontos, comissões e histórico."

## 8. Impacto no que já foi implementado ou verificado

Vão precisar de revisão e **reverificação** (o `verificador` reabre o status só quando a mudança chegar ao dev):
- **Verificados e afetados diretamente:** IM-006, IM-014, IM-015, IM-016, IM-021, IM-022, IM-032, IM-079, IM-097, IM-098, IM-099.
- **Afetados por leitura pública (busca, vitrine, página, contato):** IM-011, IM-019, IM-092, IM-095, IM-096, IM-013, IM-024, IM-025, IM-026, IM-027, IM-028.
- **Afetados se a regra de duplicidade mudar:** IM-032, IM-033, IM-034, IM-035 (pontos) e relacionamento IM-039 a IM-044 (conferir se a base é por site ou por item).
- **Tetos:** D-035 e `contas_exigir_teto_criacao` (20261109110000, verificação em curso do PR #85).
- **Em aberto, a redesenhar:** IM-102 (proposta de arquivamento) e IM-104 (pós-lançamento).
- **Renomeação "site" em textos:** só interface e docs; sem risco de dados. Testes Playwright que procuram o texto "perfil" quebram e precisam de ajuste.

## 9. Riscos

1. **Regressão em regra verificada** (leitura pública, pontos, duplicidade): mitigar com migração de compatibilidade e pgTAP antes e depois.
2. **Dados já existentes** no dev: itens de perfil existentes ganham `publicado_ate` na migração (valor padrão a definir, para não vencerem todos no primeiro cron). Produção ainda não tem dados (D-003), o que ajuda.
3. **Abuso:** criar, excluir e recriar para fugir do teto ou renovar sem fim. Mitigar com limite por dia de criação e de renovação, auditoria e teto sobre itens não excluídos.
4. **Cron:** atraso de até 15 min e falha silenciosa. Mitigar com a checagem de validade também na leitura e alerta administrativo se o job falhar.
5. **Contagem do teto:** o ponto 5 faz o dono preso com 10 itens se não puder excluir. Por isso "excluir" precisa existir no mesmo PR do teto novo.
6. **Terminologia dupla** (site na tela, perfil no código): risco de confusão e de vazamento de texto antigo. Mitigar com glossário em `docs/` e busca de textos na revisão de interface.
7. **Duplicidade de pontos** (IM-032): mudar a chave pode abrir brecha de pontuação (S-03 da revisão de segurança do banco). Não mexer sem desenho do `regras-negocio` e aceite.
8. **Exposição pública:** item sem site passa a ser mais visível na vitrine. Moderação (IM-021) segue obrigatória.
9. **Custo:** nenhum novo (cron e Storage atuais). Aviso por e-mail teria custo de envio; por isso sugestão de painel só.

## 10. Ordem de entrega em PRs pequenos

Todos em dev, cada um com pgTAP de RLS e isolamento; nenhum depende de produção.
1. **Docs** (este PR): D-039, análise; depois, texto aceito vira IM-105 a IM-108.
2. **Terminologia "site"** só em textos da interface e docs. Sem migração.
3. **Parâmetros de limites** (1 site, 10 itens, 7 dias) auditados + `contas_exigir_teto_criacao` lendo deles; tetos passam a contar por conta. Inclui mensagem do teto.
4. **Excluir e despublicar** item e site (exclusão lógica, histórico só inserção, funções do dono). Entrega o IM-102 revisto.
5. **Item da conta com vida própria:** leituras públicas, busca, vitrine e contato passam a depender do item, não do site; `perfil_id` vira exibição. Reteste de IM-079, IM-097, IM-099, IM-032.
6. **Validade:** colunas, `catalogo_vencer_itens()` no cron, "Renovar" e "Excluir", aviso no painel.
7. **Interface:** painel de itens da conta, tela de vencidos, página do site listando os itens da conta.
8. **Verificação independente** e atualização de `docs/acompanhamento.md`.
9. IM-104 (ocultar site pelo master), pós-lançamento, depois de 4.

## 11. Perguntas ao Emerson (cada uma com sugestão)

1. **Os 10 itens incluem os anúncios particulares?** Sugestão: **sim**. Com item unificado não há mais "particular" separado; um teto só, simples de explicar. Alternativa: 10 itens + 10 particulares, o que faz sentido só se os dois tipos continuarem separados.
2. **A Loja (IM-097/099) continua ligada ao site?** Sugestão: sim. Quem tem site e Loja vê os itens da conta dentro do site; quem não tem site anuncia itens normalmente. Imóveis (IM-098) seguem na Loja do site por ora.
3. **Quem exclui libera espaço no teto?** Sugestão: **sim, só a exclusão** libera; despublicar, arquivar e vencer contam (ponto 5), com limite por dia de criação para evitar abuso.
4. **A quem vale a validade de 7 dias?** Sugestão: itens **fora de site contratado** (os anúncios soltos, como no Facebook). Itens exibidos dentro de um site contratado não vencem, porque o dono já paga pelo serviço. Alternativa: vale para todos os itens.
5. **Renovar exige nova aprovação?** Sugestão: **não**, se o conteúdo não mudou (a versão aprovada continua valendo); edição segue gerando versão pendente (IM-022).
6. **Aviso de vencimento:** sugestão: **só no painel**, sem e-mail (sem custo e sem novo envio). Quantos dias antes (sugestão: 2)?
7. **Prazo como parâmetro** editável pelo administrador (padrão 7 dias), valendo da próxima publicação ou renovação em diante, não retroativo? Sugestão: sim. E o link de indicação do item volta a valer quando ele é renovado? Sugestão: sim.
8. **Localização do item** (cidade/UF): item de conta sem site precisa informar a sua (como o particular hoje); item exibido num site herda a do site por padrão, com opção de própria? Sugestão: sempre própria e obrigatória, preenchida por padrão com a do site.
9. **Duplicidade de pontos (IM-032):** para item da conta sem site, a chave é WhatsApp do visitante + conta dona; para item exibido em site, WhatsApp + site. Sugestão: manter assim (é o que já vale hoje) e não mexer na regra.
10. **Ao ocultar um site (IM-104) ou despublicá-lo,** os itens da conta continuam publicados? Sugestão: **sim** (ponto 3), só deixam de aparecer dentro do site. Exceção: suspensão ou encerramento da conta continuam derrubando tudo, como já é.
11. **"Excluir" apaga de fato ou esconde?** Sugestão: esconde (exclusão lógica), porque pedidos, pontos e comissões precisam do histórico (IM-078). Eliminação real de dados pessoais fica para a revisão jurídica (IM-082).
12. **Itens existentes no dev** (ao ligar a validade): sugestão: ganham prazo novo de 7 dias contados da migração, para não vencerem todos no primeiro cron.
13. **Terminologia:** "site" também no endereço público (hoje `/perfil/...`)? Sugestão: manter a rota por ora e decidir junto do lançamento, porque mudar rota quebra links já compartilhados.
14. **Plano básico por ora:** vale 1 site e 10 itens para **todos**, inclusive contas que hoje já têm 3 perfis no dev? Sugestão: contas existentes acima do limite continuam como estão (não perdem nada), só não criam novos.
15. **Aceita os textos IM-105 a IM-108** da seção 7 (ou ajustes)? Sugestão: aceitar, para o catálogo refletir a D-039 antes de qualquer migração.

---

## 12. Dependências do perfil (se o lançamento NÃO oferecer site gratuito)

Pergunta do Emerson: sem site (perfil) gratuito, que funções ficam inutilizáveis? Só leitura do código e das migrações (sem dados). **Análise, não decisão.** Aqui "perfil" é `perfis_perfil`; "site" é o nome na tela (D-039). `catalogo_item` com `perfil_id` nulo é o anúncio particular / item da conta (IM-015).

Legenda: **Funciona** = funciona só com a conta e o item; **Depende** = exige `perfis_perfil`; **Parcial** = funciona com limitações.

### 12.1 Mapa por função

| # | Função (IDs) | Situação | Evidência |
|---|---|---|---|
| 1 | Item/anúncio particular: criar, moderar, publicar (IM-015, IM-021, IM-022) | **Funciona** | `catalogo_item.perfil_id` é opcional; a leitura pública usa `(perfil_id is null or perfis_perfil_disponivel(perfil_id))` (20261024130000:145,164,308; 20261029100000:135). Localização própria na versão (20261029100000) |
| 2 | Indicar item particular: link, pedido de contato, atribuição (IM-024, IM-025, IM-026) | **Funciona** | `indicacoes_link` e `indicacoes_pedido_contato` têm `perfil_id` OU `item_id` (`check (perfil_id is null) <> (item_id is null)`, 20261030100000:56,79). `indicacoes_resolver_destino` usa o WhatsApp da conta quando o item não tem perfil (20261030110000:19-45) |
| 3 | Contato público, aviso ao anunciante, painel de pedidos (IM-013, IM-027, IM-028, IM-029) | **Funciona** | Mesmo `indicacoes_resolver_destino` (dono = `i.conta_id`). Página pública `src/app/item/[id]/page.tsx` com formulário e `?ind=` (linha 21) |
| 4 | Pontos por indicação e duplicidade (IM-032 a IM-035) | **Funciona** | `pontos_lancamento.destino_item_id` existe junto de `destino_perfil_id` (20261031100000:87-96). Chave de duplicidade de item sem perfil: `'conta':<conta_id>` (linhas 265-280). `pontos_parametro` é global, não por perfil |
| 5 | Benefícios de pontos por negócio (IM-036) | **Depende** | `pontos_beneficio.perfil_id uuid not null references perfis_perfil` (20261031120000:29); criar exige perfil disponível e do usuário (linhas 209-213). Não existe benefício de conta sem site. Resgate ainda não existe no modelo |
| 6 | Relacionamento: base por negócio, curtir, avisos (IM-039 a IM-045) | **Depende** | `relacionamento_membro.perfil_id not null`, `unique (perfil_id, conta_id)`; `_saida`, `_evento`, `_alternancia` idem (20261101100000:32-62,113). `base_perfil_id` obrigatório quando `incluido_na_base` (linha 82). A própria migração diz: "Anúncio particular (sem perfil) é válido para avisos, mas não tem base" (linha 378). Indicação de item particular é válida e **não entra em base alguma** |
| 7 | Comissões e redes (IM-063 a IM-070) | **Depende** | "Negócio = perfil comercial" (20261105100000:5). `comissoes_rede` (perfil_id unique), `_oferta`, `_vinculo`, `_assinatura`, `_comissao`, `_lancamento` têm `perfil_id not null` (linhas 44,59,70,109,138,208,243). Oferta exige `i.perfil_id = p_perfil` (20261105110000:154); habilitação é por perfil (`comissoes_modulo_ativo`). Item particular não participa |
| 8 | Loja de produtos e serviços (IM-097, IM-099) | **Depende** | `loja_liberacao.perfil_id` PK (20261103130000:24); liberação manual por perfil |
| 9 | Loja de imóveis (IM-098) | **Depende** | Gatilho recusa imóvel sem perfil: "anúncio particular não tem Loja" (20261103140000:69-72) |
| 10 | Busca e vitrine de itens (IM-011, IM-019) | **Funciona** | `busca_publica` traz item com `left join perfis_perfil_publico` (`perfil_slug` nulo para particular; 20261029100000:189-194). `catalogo_item_publico` usa cidade/UF do item ou do perfil (linhas 130-131) |
| 11 | Busca de perfis e carrosséis da home (IM-095, IM-096) | **Depende** | `busca_home_secao.tipo_item check in ('perfil')` e a leitura só elege `perfis_perfil` disponíveis (20261103100000:43; 20261103110000:69-73). Sem site, as seções da home ficam vazias: item não entra |
| 12 | Página como site, banner, menu, estilos (IM-092 a IM-094) | **Depende** | `perfis_perfil`, `perfis_estilo_pagina`, banner (20261102160000, 20261102170000). É o próprio site |
| 13 | Mapa e rota (IM-018) | **Parcial** | Coordenadas só em `perfis_perfil_versao_local` (20261102190000:51-66). Item particular tem só cidade/UF, sem mapa |
| 14 | Open Graph e compartilhamento | **Funciona** | Rota `src/app/og/item/[id]` e `generateMetadata` em `src/app/item/[id]/page.tsx:34,59`, além de `og/perfil` |
| 15 | Curtir a partir do item (IM-043) | **Parcial** | Na página do item, curtir é o do "perfil de origem" (item/[id]/page.tsx:21,132); só se o item tem perfil |
| 16 | Administração: moderação, suspensão, denúncia, invalidar indicação, auditoria (IM-021, IM-079) | **Funciona** | Denúncia aceita alvo `item` (20261102120000:60,203); consulta de negócios lista item particular (20261029120000:26-63); invalidar indicação trata perfil e item (20261102150000:77). Auditoria é genérica (autor, alvo, motivo) |
| 17 | Administração: patrocinadores, ocultar perfil (IM-104) | **Parcial** | `administracao_patrocinador.perfil_destino_id` (20261028110000:45); o destino alternativo é texto livre e não exige perfil. Ocultar perfil só faz sentido com perfil |
| 18 | Tetos de criação (D-035) | **Funciona** | `contas_exigir_teto_criacao` tem tipo `anuncio` (item sem perfil, 10 por conta; 20261109110000:72) e `perfil` (3 por conta). `tetos_perfis_por_conta` tem faixa 1 a 50 (linha 30): **não aceita 0** |

### 12.2 Conclusões

**(a) Lançamento sem site gratuito é viável?** Sim, para o núcleo "anunciar, indicar e pontuar": o anúncio particular funciona de ponta a ponta no formulário, aviso, pedido, atribuição, pontos, duplicidade (IM-032), busca, Open Graph e administração (linhas 1 a 4, 10, 14, 16). Ficam **de fora**, sem uso até existir site: benefícios de pontos (5), base de relacionamento e curtir (6, 15), comissões e redes (7), Loja e imóveis (8, 9), carrosséis da home (11), página-site com banner e estilos (12) e mapa (13). Ou seja, perdem-se justamente relacionamento, comissões e benefícios. Nada do já construído quebra; esses módulos só ficam sem usuário.

**(b) Manter 1 site gratuito limitado é mais seguro?** Sugestão, não decisão: **sim em risco técnico**. Reaproveita sem mudar schema os itens 5 a 9 e 11 a 13 e mantém o que foi verificado (IM-036, IM-039 a IM-045, IM-063 a IM-070, IM-092 a IM-099). `tetos_perfis_por_conta` já é parâmetro auditado (D-035), aceita 1 (faixa 1 a 50), e baixar o valor não afeta contas existentes. O "limitado" quase já existe por padrão: Loja desligada (`loja_liberacao` nasce `false`), comissões desligadas (habilitação só pelo admin) e estilos controlados por liberação (20261104130000). O risco restante é de produto (mais perfis para moderar, IM-021; custo de suporte), não de código. Observação: com tetos no mínimo 1, não existe "0 sites" por parâmetro; sem site gratuito seria preciso esconder a criação de perfil na interface ou exigir liberação por conta (isso ainda não existe).

**(c) Esforço aproximado em PRs** (estimativa):

| Caminho | PRs | O que entra |
|---|---|---|
| 1. Sem site gratuito; só item de conta; relacionamento, comissões e benefícios ficam sem uso | 2 a 3 | esconder entradas de interface de perfil, Loja, comissões e benefícios; bloquear criação de perfil sem liberação (hoje só o teto, mínimo 1, limita); textos; testes. Sem mudança de modelo. Validade de 7 dias, exclusão e parâmetros (seção 10, PRs 3 a 6) seguem à parte |
| 2. Sem site, mas com relacionamento, comissões e benefícios por conta | 8 a 12 | redesenho de `relacionamento_*`, `comissoes_*` (6 tabelas) e `pontos_beneficio`; migração de compatibilidade; reverificação de IM-036, IM-039 a IM-045, IM-063 a IM-070 e IM-032 a IM-035; risco alto em regras verificadas. Não aparenta compensar antes do lançamento |
| 3. 1 site gratuito limitado (`tetos_perfis_por_conta`=1, estilo simples) | 1 a 2 | ajustar parâmetro e padrões, textos do limite, conferir moderação. O resto já existe. Não inclui regras de plano pago (IM-060, futuro) |

**Dúvidas de requisito para o Emerson** (nenhuma decidida aqui):
1. Benefícios (IM-036), relacionamento (IM-039 a IM-045) e comissões (IM-063 a IM-070) valem só para quem tem site, ou também para conta com item solto? IM-039 e IM-063 dizem "por empresa" e "por negócio".
2. O carrossel da home (IM-095, hoje só perfis) deve incluir itens de conta para não ficar vazio sem site?
3. Quem anuncia item solto tem base de relacionamento: por site ou por conta?
