# IndicaMais — instruções do projeto

Plataforma de divulgação, indicação e relacionamento entre empresas, profissionais, anunciantes particulares e pessoas interessadas. Visão completa e os 90 requisitos (IDs IM-001 a IM-090) estão em @docs/requisitos.md.

Responda sempre em **português do Brasil**. O responsável pelo produto é o Emerson.

## Documentos do projeto
- `docs/requisitos.md` — catálogo central. IDs permanentes: requisito novo recebe ID novo (IM-091…), nunca renumerar.
- `docs/decisoes.md` — decisões com data. Uma decisão nova substitui a anterior de forma explícita.
- `docs/acompanhamento.md` — situação de execução de cada ID. Atualizar a cada entrega.
- `docs/roteiro.md` — fases de construção e o que cada uma exige.

## Stack (ver D-002 em docs/decisoes.md)
- Next.js (App Router) + TypeScript em modo estrito, publicado no Cloudflare Workers pelo adaptador OpenNext.
- Supabase: Postgres, Auth, Storage. Migrações versionadas em `supabase/migrations/` pela CLI do Supabase.
- Zod para validar toda entrada externa. Vitest (unidade/integração) e Playwright (ponta a ponta). pnpm. CI no GitHub Actions.
- Antes de instalar ou configurar, confira a versão atual e a documentação oficial de cada ferramenta. Não confie em versões de memória.

## Arquitetura modular (IM-001, IM-002)
- Monólito modular: um app, um banco, módulos separados em `src/modules/<modulo>/`.
- Módulos: contas, perfis, catalogo, busca, indicacoes, pontos, relacionamento, comissoes, administracao, notificacoes. Futuros (sem código ativo): planos, social, remarketing, pagamentos.
- Cada módulo expõe só o que está em seu `index.ts`. Outro módulo nunca importa arquivos internos. Regra de lint impede isso.
- Pontos, comissões, relacionamento e social têm tabelas, saldos e regras próprios. Nenhum altera o outro de forma automática.
- Serviços comuns (auth, e-mail, auditoria, config) ficam em `src/shared/`.

## Segurança (IM-086)
- RLS ativada em **toda** tabela, com política explícita. Tabela sem política é erro de entrega.
- Chave `service_role` só no servidor, nunca em código de cliente, log ou relatório.
- Segredos só em variáveis de ambiente. `.env.example` lista os nomes, sem valores.
- Toda ação administrativa e toda reversão grava auditoria (autor, data, motivo, valor original).
- Dados privados (telefone, e-mail, nome completo de visitante) nunca vão para o indicador nem para notificações (IM-029, IM-041, IM-050).

## Convenções brasileiras (IM-005)
Prioridade ao celular. Moeda em reais (BRL). Telefone normalizado em E.164 com +55. Cidade e UF. Datas em pt-BR, fuso America/Sao_Paulo na exibição, UTC no banco.

## Como trabalhar
- **D (definido):** pode executar. **P (pendente):** não decidir sozinho; registre a dúvida e siga com o que é independente. **F (futuro):** não implementar nem ativar.
- Sugestão sua ou de outro assistente **não** é aprovação do Emerson. Só vale o que está em requisitos.md ou decisoes.md.
- Pendência não bloqueia trabalho independente. Avance sem pedir "posso prosseguir?" a cada passo (IM-088).
- Pare e pergunte apenas quando: houver custo novo, ação irreversível, exposição pública, deploy em produção, ou conflito entre requisitos (IM-089).
- Requisitos em conflito: aponte os IDs, explique o conflito e espere decisão. Não escolha em silêncio.

## Equipe de agentes
Você (sessão principal) é o **gestor**: planeja, divide o trabalho, delega e integra. Delegue a:
- `banco-seguranca` — schema, migrações, RLS, funções no banco, auditoria.
- `regras-negocio` — lógica dos módulos: indicações, pontos, deduplicação, relacionamento, comissões.
- `interface` — telas, componentes, acessibilidade, experiência no celular.
- `verificador` — testes e evidência. É o único que marca um ID como Verificado.
Quem implementa não verifica a própria entrega.

## Rotina por entrega
1. Antes: liste os IDs que a entrega cobre e as dependências.
2. Trabalhe em branch própria (`fase-N/<assunto>`). Commits pequenos, mensagem citando IDs.
3. Depois: `verificador` roda testes e registra evidência em acompanhamento.md.
4. Ao fechar um módulo, confira os fluxos de outros módulos que ele afeta.
5. Relatório ao Emerson: IDs que avançaram, evidência, pendências que surgiram, próxima ação. Curto e direto.

## Ambientes (D-003)
Desenvolvimento e produção separados. Nada é testado em produção. Migração vai primeiro para dev. Deploy em produção e `supabase db push` em produção só com aprovação do Emerson naquele momento.

## Comandos
Usar Node 24 (arquivo `.nvmrc`; `engines.node` = `>=22 <25`). Node 25.3 quebra o Vitest 5/Vite 8 com ERR_PACKAGE_IMPORT_NOT_DEFINED (#module-sync-enabled), então não usar Node 25. Versões escolhidas (conferidas em 22/10/2026): Node 24 LTS (local e CI), pnpm 12.15.0, Next.js 16.4.2, React 19.3.0, TypeScript 5.x, ESLint 9, Vitest 5.0.5, Prettier 3.9.10, Zod 4.6.7, @opennextjs/cloudflare 1.20.13, Wrangler 4.151.3, Supabase CLI 2.121.0.

- Instalar: `pnpm install` (pnpm instalado com `npm i -g pnpm`; a versão fica fixa em `packageManager`).
- Rodar em desenvolvimento: `pnpm dev` (http://localhost:3000).
- Lint (inclui regra de fronteira entre módulos): `pnpm lint`
- Tipos: `pnpm typecheck`
- Testes: `pnpm test` (modo observação: `pnpm test:watch`). Teste da fronteira: `tests/fronteiras-modulos.test.ts`.
- Formatação: `pnpm format` / `pnpm format:check`
- Build Next: `pnpm build`
- Build/preview para Cloudflare Workers (OpenNext): `pnpm build:cf` e `pnpm preview`. Não funciona no Windows nativo (erro de leitura de symlinks do pnpm); rode em WSL, Linux ou no CI.
- Supabase local: `pnpm supabase start`, `pnpm supabase migration new <nome>`, `pnpm supabase db reset` (precisam de Docker).
- Tipos do Supabase: `pnpm db:types` (gera `src/shared/db/database.types.ts` a partir do projeto de desenvolvimento linkado, sem Docker; exige `pnpm supabase login` e `pnpm supabase link --project-ref qheleouixleltfjtccji`, D-005).
- Checar conexão com o Supabase de dev: `pnpm check:supabase` (script manual `scripts/checar-supabase.mjs`, lê `.env.local`, imprime só status; fora do app e do CI; IM-085, IM-086).
- Testes ponta a ponta (Playwright 1.64.1, conferida em 29/10/2026, D-011): `pnpm test:e2e` (headless; projetos `desktop` e `celular` = Pixel 7 em Chromium) e `pnpm test:e2e:ui` (modo interativo). Specs em `tests/e2e/` (fora do Vitest e do tsconfig). Reaproveita o servidor em http://localhost:3000 se já estiver rodando; senão inicia `pnpm dev`. Só contra o ambiente de DESENVOLVIMENTO, nunca produção. Primeira vez: `pnpm exec playwright install chromium webkit`. Testes autenticados precisam das variáveis `E2E_DONO_*`, `E2E_INDICADOR_*` e `E2E_ADMIN_*` (EMAIL e SENHA) em `.env.local`, com contas de teste do dev criadas pelo Emerson (nomes em `.env.example`); sem `service_role`. Relatório em `playwright-report/` e rastros em `test-results/` (fora do git). Não roda no CI por enquanto (precisa de contas e servidor).
- Tipos de bindings Cloudflare: `pnpm cf-typegen`
- Rotinas agendadas e bloqueio de acesso (IM-080, IM-081, IM-086): o Worker usa `worker/entrada.ts` (reaproveita o `fetch` do OpenNext e acrescenta `scheduled`, conforme a doc "custom worker" do @opennextjs/cloudflare). O Cron Trigger `*/15 * * * *` (`wrangler.jsonc`) roda `contas_executar_encerramentos`, `pontos_reprocessar_pendentes`, `relacionamento_reprocessar_pendentes` e a limpeza de `administracao_denuncia_tentativa` (>30 dias), com log só de contagens (`src/shared/agendador/rotinas.ts`). Não há rota HTTP de cron. O Worker precisa de `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` como variável/secret (dev: `pnpm wrangler secret put <NOME>`, feito pelo Emerson). O proxy consulta `contas_meu_estado()` (cache de 30 s em memória) e manda conta sem acesso para `/conta-indisponivel`. `src/shared/supabase/acesso-conta.ts` expõe `bloquearAcessoNoAuth` e `liberarAcessoNoAuth` (banned_until via Admin API) para as ações de suspender/reativar. Teste local do cron: `pnpm wrangler dev --test-scheduled` e `curl "http://localhost:8787/__scheduled?cron=*/15+*+*+*+*"` (após `pnpm build:cf`, em Linux/WSL).
- Publicar em DESENVOLVIMENTO (Worker `indicamais-dev`): `pnpm deploy:dev` (= `opennextjs-cloudflare build && opennextjs-cloudflare deploy`). Exige login `pnpm wrangler login` (confira com `pnpm wrangler whoami`). No Windows nativo o build falha (esbuild "Access is denied" nos symlinks do pnpm) e não há WSL nesta máquina: rode em Linux/WSL ou por GitHub Actions: GitHub > Actions > Deploy dev > Run workflow (`.github/workflows/deploy-dev.yml`, só `workflow_dispatch`; usa os secrets de repositório CLOUDFLARE_API_TOKEN e CLOUDFLARE_ACCOUNT_ID; roda lint, tipos e testes antes; só publica `indicamais-dev`). Primeiro deploy: se a conta Cloudflare ainda não tiver subdomínio workers.dev registrado, o Wrangler pede esse registro; o nome do subdomínio é decisão do Emerson (não escolher por ele) e se registra uma vez no painel Cloudflare em Workers & Pages > Subdomain, ou respondendo ao prompt do `pnpm wrangler deploy` rodado por ele. Produção (Worker `indicamais`) nunca sem aprovação do Emerson (D-003); `supabase db push` em produção idem.
- Variáveis: copie `.env.example` para `.env.local` e `.dev.vars.example` para `.dev.vars`; nunca comite valores.
- Regra de módulos: de fora de um módulo importe só `@/modules/<modulo>` (o index). Dentro do módulo use caminhos relativos; não saia da pasta do módulo por caminho relativo.
