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
