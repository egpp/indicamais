# Modelo "básico" do site gratuito (IM-110, D-040; PR 12)

Referência visual: `docs/marca/modelos-sites/estilo/22.basico.png` (enviada pelo Emerson). Análise de encaixe; nada aqui é Verificado.

## 1. Encaixe nos estilos existentes
- Os 21 estilos são ids em `src/app/_componentes/site/estilos.ts` (`IDS_ESTILOS`, `TEMAS`), com CSS em `site-estilos*.css` e composição única em `site-negocio.tsx` (o estilo muda aparência e composição por CSS, nunca o conteúdo, IM-094).
- O "básico" é um **estilo novo** (22º, id `basico`), não uma variação do `minimalista`. O `minimalista` é o padrão de quem não escolheu (`ESTILO_PADRAO`) e seguirá assim; trocar o padrão mudaria os sites existentes.
- **Exige migração.** O id vive no banco: `perfis_estilo_pagina` tem CHECK de ids (`perfis_estilo_pagina_id`) e uma linha por estilo com `habilitado`; `perfis.estilo_pagina` tem default `'minimalista'`. Sem a linha e o CHECK ampliado, `basico` não pode ser gravado nem liberado pelo admin. Precedente: `20261104120000_perfis_estilo_moto_bike.sql`.
- Para "ser o padrão do site gratuito" há duas opções (decisão do gestor/Emerson):
  - A) novos sites nascem com `basico` (mudar o default da coluna e a queda segura `ESTILO_PADRAO`); sites existentes ficam como estão.
  - B) manter `minimalista` como padrão e só liberar o `basico` (habilitado) para escolha.
  Pelo D-040 a opção A parece a intenção; precisa confirmação, pois muda o comportamento de quem hoje não escolheu estilo.

## 2. Seções do layout e origem dos dados (sem campo novo)
| Parte do modelo | Dado real |
|---|---|
| Cabeçalho: marca + Sobre / Catálogo / Contato | nome e logo do perfil; âncoras `#sobre`, `#produtos`, `#contato-site` (já existem em `site-negocio.tsx`, menu em `menu-site.tsx`) |
| Apresentação (kicker, título, texto, "Fale com a gente", "Conhecer o catálogo") | kicker = nome; título/texto = descrição curta do perfil (o texto do modelo "Soluções práticas..." é ilustrativo, não vira campo); botões levam a `#contato-site` e `#produtos` |
| "Um pouco sobre a gente" | descrição longa do perfil; seção some se vazia |
| Catálogo: cartões | itens publicados do perfil (nome, resumo, imagem; o ícone do modelo só aparece se não houver imagem) |
| "Valores sob consulta" | exibido quando o item não tem preço; com preço, mostra R$ real |
| "Tenho interesse" | leva ao formulário de contato com o item citado (pré-preenche a mensagem com o nome do item, sem dado privado) |
| "Vamos conversar?" | **formulário público atual** (`form-contato.tsx`, Turnstile, limites, S-03). Sem "Formulário demonstrativo"; o texto do modelo é descartado |
| Rodapé | nome, cidade/UF, denunciar, link IndicaMais (já existem) |

## 3. Requisitos transversais
- Texto "site" na interface (D-039/D-040); rota `/perfil/...` inalterada.
- Open Graph e SSR vêm de `generateMetadata` da página; nada muda, o estilo só troca CSS/composição.
- Celular a 360px primeiro: cabeçalho com menu compacto (`menu-site.tsx`), cartões em coluna única, formulário em coluna; 3 cartões lado a lado só a partir de ~768px, como no modelo.
- Acessibilidade: azul do modelo (~#1d4ed8) sobre branco passa 4,5:1; botões e campos com altura mínima de 44px; foco visível; rótulos Nome/Telefone/Mensagem já existem no formulário; links sublinhados.
- Dados privados: nada novo é exposto (IM-029, IM-041, IM-050).

## 4. Pendência para implementar
Migração (a cargo do banco-seguranca): ampliar o CHECK `perfis_estilo_pagina_id` com `basico`, inserir a linha (`habilitado = true`, ordem 22) e, se for a opção A, alterar o default de `perfis.estilo_pagina`. Depois, no código: `IDS_ESTILOS`/`TEMAS`/`ESTILO_PADRAO` (se A), CSS `site-estilos-basico.css`, fonte, miniatura, demonstração e teste de verificação dos estilos (hoje contam 21). Não implementado neste PR por depender da migração.
