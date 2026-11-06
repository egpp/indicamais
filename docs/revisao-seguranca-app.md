# Revisão de segurança da aplicação (fase 14)

Data: 05/11/2026. Branch `fase-14/revisao-seguranca-app`. Escopo: aplicação (Next.js, Worker, workflows). O banco (RLS, funções) está com outro agente. Revisão independente, somente leitura: nenhum código de produção foi alterado, nada foi publicado, nenhuma chave aparece aqui.

## Totais

| Gravidade | Qtde |
| --------- | ---- |
| Crítico   | 0    |
| Alto      | 2    |
| Médio     | 5    |
| Baixo     | 5    |

Testes que provam os achados: `tests/revisao-seguranca-app.test.ts` (4 `it.fails` = achados abertos RSA-01, 03, 05, 07; 2 verificações que passam). Resultado: `2 passed | 4 expected fail`.

## Limite desta revisão (não verificado)

- **Provas dinâmicas contra o Supabase de dev (isolamento dono A x dono B, leitura anônima das tabelas, RPCs) NÃO foram executadas.** O ambiente bloqueou o script de sondagem (uso de `.env.local` e requisições de escrita ao dev). Não contornei. Fica pendente para o agente do banco ou para execução autorizada pelo Emerson: com as contas `E2E_*`, listar tabelas/visões via REST e conferir, para `anon`, dono e indicador, que só aparecem linhas próprias.
- Configuração remota do Supabase Auth (lista de redirecionamento permitida, proteção contra senha vazada, confirmação de e-mail, limites de taxa) não é legível pelo repositório. `supabase/config.toml` é só local.

## Verificado sem achado

- **Segredos no repositório e no histórico git (todas as branches):** varredura de JWT (`eyJ...`), `sb_secret_`, `sbp_`, `re_`, `sk_`, `ghp_`, `AKIA`, `0x4AAAA`, atribuições `KEY/SECRET/SENHA/PASSWORD=valor`, URLs `postgres://usuario:senha@` e strings de alta entropia (40+). Únicas ocorrências: textos fictícios em testes (`postgres://usuario:senha@host`). Arquivos `.env*`/`.dev.vars*` no histórico: apenas `.env.example` e `.dev.vars.example` (sem valores).
- `.gitignore` cobre `.env*` e `.dev.vars*` (exceto exemplos). Teste novo garante.
- `NEXT_PUBLIC_*` em uso: só `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `APP_URL`. Nenhuma sensível.
- **Bundle do cliente:** `pnpm build` com valores sentinela fictícios para `SUPABASE_SERVICE_ROLE_KEY` e `EMAIL_API_KEY`. `grep` em `.next/static` e `.next/server`: nenhuma sentinela nem o nome das variáveis. A chave de serviço só é lida em `src/shared/supabase/servico.ts` (teste existente `varredura-select-service-role` garante).
- **Uso do cliente de serviço:** só em `notificacoes-contato.ts` (aviso por e-mail), rotinas agendadas e `acesso-conta.ts` (banir/liberar). Os dois pontos que mudam o Auth só rodam depois da RPC que confere permissão (`suspender`/`reativar`) ou, em `sincronizarAcesso`, depois de checar a permissão `suspender` no servidor.
- **Autorização:** toda Server Action passa por `obterContexto*` (sessão lida com `auth.getUser()` no servidor; sem sessão, redireciona). Todas as 19 páginas de `/administracao` chamam `notFound()`/`exigir*` para quem não é administrador (404). Ids vindos do cliente seguem para RPC/RLS com a sessão do usuário (nunca service_role), então o isolamento entre responsáveis depende da RLS (a conferir pelo agente do banco). Caminhos de imagem são validados contra a pasta do perfil/item (`caminhoDaPasta`), impedindo usar imagem de outro responsável. `/painel/acesso` e `/avisos/contador` falham fechado, `no-store`, `noindex`.
- **Entrada:** nenhum `dangerouslySetInnerHTML`, `innerHTML`, `eval` ou `javascript:` no código. Entrada por Zod nos módulos. Links externos são montados no servidor (`wa.me` com número E.164 validado; redirecionamento do formulário de contato só aceita `https://wa.me/`). Sem SVG: bucket privado, 2 MiB, só JPEG/PNG/WebP. Nomes de arquivo são UUID. Único `fetch` com destino variável é a URL de OAuth devolvida pelo Supabase (confiável); geocodificação usa URL fixa (sem SSRF).
- **Open redirect:** `caminhoSeguro` recusa `//`, `\`, controles e esquemas; usado em login, callback e Google. Teste novo (`//evil.com`, `https://...`, `/\evil.com`, `javascript:`, quebra de linha).
- **Enumeração e erros:** cadastro, recuperação e reenvio devolvem resposta neutra; login só distingue "não confirmado" com a senha correta; erros do Auth classificados por `code`, nunca por texto. Callback nunca repassa texto da URL.
- **Privacidade (IM-029, IM-041, IM-050):** a visão do indicador (`indicacoes_minhas_indicacoes`) só tem id, destino, data e status; o e-mail de aviso é texto simples com assunto fixo, sem nome, telefone nem e-mail do visitante; Open Graph usa só o modelo público. Logs: só contagens, código/status de falha do Auth e frases fixas (nenhum e-mail, token ou corpo).
- **CSRF:** Server Actions do Next conferem `Origin` x `Host`; `allowedOrigins` não está configurado (bom). Cookies do Supabase com `SameSite=Lax`.
- **Workflows:** `permissions: contents: read`, sem `pull_request_target`, sem segredo em PR, `deploy-dev` só `workflow_dispatch` com trava contra o Worker de produção, saída do deploy sem segredo.
- **`pnpm audit`:** 0 críticas, 6 altas, 6 moderadas, todas em ferramentas de build/dev (ver RSA-04). `next`, `react`, `@supabase/*` e `zod` sem avisos.

## Achados

### Alto

**RSA-01. Nenhum cabeçalho de segurança HTTP (CSP, nosniff, anti-frame, Referrer-Policy, Permissions-Policy, HSTS)**
- Onde: `next.config.ts:4` (`nextConfig = {}`), `public/_headers` (só cache de `_next/static`), `src/proxy.ts`, `wrangler.jsonc`.
- Reprodução: `curl -sI https://<worker>/ ` (dev publicado): não há `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy`. Teste `RSA-01` falha como esperado.
- Risco: sem CSP, qualquer XSS futuro roda sem freio; sem anti-frame, as telas (incluindo `/administracao` e denúncia) podem ser emolduradas (clickjacking; atenuado pelo `SameSite=Lax`, que não envia o cookie em iframe de outro site); sem `nosniff`, imagens do bucket enviadas com `Content-Type` forjado podem ser interpretadas como HTML.
- Correção sugerida: `headers()` no `next.config.ts` (ou `public/_headers`) com `Content-Security-Policy` (default-src 'self'; img-src 'self' https://*.supabase.co data: blob:; connect-src 'self' https://*.supabase.co; frame-ancestors 'none'; base-uri 'self'; form-action 'self'), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, e HSTS na borda da Cloudflare (ou no domínio de produção).
- Decisão do Emerson: não (técnico), mas a CSP exige testar as telas no dev antes de ir à produção.

**RSA-05. Limite de pedidos de contato contornável: a chave do limite é o WhatsApp que o próprio visitante digita**
- Onde: `supabase/migrations/20261030110000_indicacoes_rpcs_link_contato.sql:199-232` (`indicacoes_enviar_contato`, liberada a `anon`); `src/app/acoes-indicacoes.ts`.
- Reprodução: enviar pedidos de contato para o mesmo perfil/item variando o número (`+5511999990001`, `...002`, ...). Cada número novo escapa da janela de repetição (10 min) e do limite (5 por hora por WhatsApp). Teste `RSA-05` (falha esperada) confirma que não há limite por destino nem por origem.
- Risco: inundar o painel do responsável de pedidos falsos e esgotar a cota gratuita do Resend (100 e-mails/dia, compartilhada por todo o site), impedindo avisos de todos os responsáveis (negação de serviço do aviso por e-mail). Também polui a base de relacionamento.
- Correção sugerida: além do limite por WhatsApp, limitar por destino (perfil/item) por hora e por origem (hash de IP, como na denúncia); agregar avisos por e-mail (resumo em vez de um e-mail por pedido); e Turnstile no formulário público (pendência conhecida de IM-076, vale também para o contato).
- Decisão do Emerson: sim, valores dos limites e adoção do Turnstile (custo zero, mas altera o formulário público).

### Médio

**RSA-02. Cookies de sessão sem `Secure` e legíveis por JavaScript**
- Onde: `src/shared/supabase/servidor.ts` e `sessao.ts` repassam as opções do `@supabase/ssr`, cujo padrão é `{ path:"/", sameSite:"lax", httpOnly:false, maxAge:400 dias }` (sem `secure`).
- Reprodução: após login, inspecionar `Set-Cookie` de `sb-*`: sem `Secure` e sem `HttpOnly`.
- Risco: com XSS, o token é roubável (agravado por RSA-01). `HttpOnly:false` é exigência do cliente de navegador do Supabase; o app usa `createBrowserClient` só para upload.
- Correção sugerida: forçar `secure: true` em produção nos `setAll` (servidor e proxy). Avaliar mover o upload para URL assinada de envio gerada no servidor e então usar `httpOnly: true`.

**RSA-06. Actions administrativas sem checagem de papel no app (defesa em profundidade)**
- Onde: `src/app/acoes-patrocinadores.ts`, `acoes-comissoes.ts`, `acoes-pontos.ts`, `acoes-home.ts`, `acoes-loja.ts`: a action só exige login; o papel é imposto exclusivamente pela RPC/RLS no banco. As páginas conferem (404), as actions não.
- Risco: hoje o isolamento é só do banco; um erro numa política ou RPC deixa a action utilizável por qualquer logado. Não é explorável pelo que vi no app; depende da revisão do banco.
- Correção sugerida: chamar `exigirAdministrador*`/`exigirPermissao` dentro de `rodar()` de cada action admin, e cobrir com teste "não administrador recebe 404".

**RSA-07. Hash de origem da denúncia é SHA-256 puro de IP+UA (reversível por força bruta)**
- Onde: `src/app/_lib/origem-denuncia.ts:15-18`. O espaço IPv4 tem 2^32 valores; com o user-agent conhecido o hash se inverte em segundos.
- Risco: o hash vai ao banco (`administracao_denuncia_tentativa`); em vazamento do banco, o IP do denunciante é recuperável. A doc afirma "IP nunca guardado"; na prática é pseudônimo fraco (LGPD).
- Correção sugerida: `HMAC-SHA-256` com segredo do servidor (nova variável `DENUNCIA_HASH_SEGREDO`, só no Worker). Teste `RSA-07` (falha esperada).
- Decisão do Emerson: criar o segredo no Worker (ação dele).

**RSA-08. `origemDoApp()` confia em `x-forwarded-host` quando `NEXT_PUBLIC_APP_URL` não está definida**
- Onde: `src/app/_lib/origem.ts:5-10`; usado em cadastro, recuperação de senha e reenvio (`acoes-conta.ts`).
- Reprodução: sem a variável, `POST` da action com `X-Forwarded-Host: evil.example` gera `emailRedirectTo`/`redirectTo` com esse host. O Supabase só aceita hosts da lista de redirecionamento permitida, o que atenua; se a lista tiver curinga, é envenenamento do link de recuperação.
- Correção sugerida: em produção exigir `NEXT_PUBLIC_APP_URL` (falhar se vazia) e ignorar `x-forwarded-host`. A variável já é pendência de produção (relatório de situação).

**RSA-09. Dependências de ferramentas com 6 CVEs altas (todas em `@opennextjs/cloudflare`)**
- Ver RSA-04 abaixo para o detalhe; classificado médio por exigir atualização antes do lançamento mesmo sendo só de build/dev.

### Baixo

**RSA-03. GitHub Actions fixadas por tag, não por SHA**
- Onde: `.github/workflows/*.yml` (`actions/checkout@v7`, `actions/setup-node@v7`, `pnpm/action-setup@v6.1.1`). `deploy-dev` usa os secrets da Cloudflare; uma tag movida entregaria o token a código de terceiros. Teste `RSA-03` (falha esperada).
- Correção: fixar por SHA de commit com comentário da versão (Dependabot mantém). Sugerir também `environment: dev` com revisor obrigatório no `deploy-dev` e, quando existir, ambiente `producao` protegido.

**RSA-04. `pnpm audit`: 12 avisos (6 altos, 6 moderados, 0 críticos), todos transitivos de `@opennextjs/cloudflare`**
- Altos: `undici <7.30.1` (via `wrangler > miniflare`; DoS, validação TLS, cache), `glob` CLI (injeção por `-c`, via `@node-minify`), `body-parser <2.4.0` (via `express` do `@opennextjs/aws`). Moderados: `undici` (SRI, WebSocket), `glob`, `minimatch`.
- Impacto prático baixo: rodam no build e no servidor local de desenvolvimento, não no Worker publicado. Correção: atualizar `@opennextjs/cloudflare`/`wrangler` quando a versão trouxer `undici >=7.30.1`, ou `pnpm.overrides` para `undici`, `body-parser`, `glob`, `minimatch`.

**RSA-10. `sincronizarAcesso` libera (remove o banimento) de qualquer UUID que não esteja na lista de contas fora do normal**
- Onde: `src/app/_lib/tratadores-ciclo-vida.ts:135-154`. Quem tem a permissão `suspender` pode enviar o id de uma conta ativa e chamar `liberarAcessoNoAuth`, desfazendo um banimento aplicado por outro meio (painel do Supabase). Exige permissão `suspender`; sem auditoria própria.
- Correção: só agir sobre contas presentes na lista; recusar id desconhecido; gravar auditoria.

**RSA-11. Matcher do `proxy.ts` com `\.` dentro de string comum**
- Onde: `src/proxy.ts:10`. Em string TS, `"\."` vira `"."`; qualquer caminho terminado em `png`, `svg`, `jpg` etc. (ex.: `/perfil/xpng`) pula o proxy, ou seja, sem renovação de sessão nem checagem de conta suspensa naquela requisição. As páginas e a RLS continuam valendo. Correção: usar `\\.` ou `String.raw`.

**RSA-12. Páginas de login, cadastro e recuperação sem `noindex`; sem `robots.txt`**
- Onde: `src/app/{entrar,cadastro,recuperar-senha,redefinir-senha,reenviar-confirmacao}/page.tsx`. As demais áreas privadas têm `robots` noindex. Baixo, pois não expõem dado. Correção: `SEM_INDEXACAO` nessas páginas e `robots.ts` com `Disallow` das áreas privadas.

## Observações para decisão do Emerson

1. Turnstile e limite por IP (RSA-05, e IM-076): recomendo tratar antes de abrir ao público (IM-089).
2. Segredo `DENUNCIA_HASH_SEGREDO` no Worker (RSA-07).
3. `NEXT_PUBLIC_APP_URL` obrigatório em produção (RSA-08).
4. No painel do Supabase (produção e dev): lista de URLs de redirecionamento sem curinga, proteção contra senha vazada, confirmação de e-mail ligada, limites de taxa do Auth. Não verificável daqui.
5. Proteção de ambiente no GitHub para `deploy-dev` e para o futuro deploy de produção (revisor obrigatório).

## Comandos executados

- `git log --all -p` com expressões de segredo; `git log --all --name-only` filtrado por `.env`.
- `pnpm install --frozen-lockfile`; `pnpm audit --prod --json`; `pnpm audit --json`.
- `pnpm build` com variáveis sentinela fictícias; `grep -r` em `.next/static` e `.next/server`.
- `pnpm exec vitest run tests/revisao-seguranca-app.test.ts`: 2 passed, 4 expected fail.

## Correções aplicadas (branch `fase-14/hardening-app`, D-033)

Situação: corrigido no código, aguardando verificação (nada marcado como Verificado). A migração está escrita e NÃO foi aplicada.

- **RSA-05:** limites por destino e por origem (hash) no pedido de contato (`supabase/migrations/20261105170000_indicacoes_contato_limites_destino_origem.sql`, pgTAP em `supabase/tests/database/indicacoes_contato_limites.test.sql`); Turnstile verificado no servidor no contato e na denúncia (`src/shared/turnstile`, `src/app/_lib/protecao-publica.ts`, widget `campo-turnstile.tsx`). Sem a chave secreta em produção o envio é recusado; em `pnpm dev` é dispensado. Limite conhecido: a RPC segue liberada a `anon`; quem chama a API direto não passa pelo Turnstile nem informa origem, mas continua sujeito aos limites por WhatsApp e por destino. Fechar por completo exige revogar `anon` e chamar com cliente de serviço no servidor.
- **RSA-07:** origem em HMAC-SHA-256 com `DENUNCIA_HASH_SEGREDO` (mínimo 32 caracteres). Sem o segredo em produção a ação falha de forma segura (mensagem neutra). Hashes antigos (SHA-256 puro) envelhecem e saem na limpeza de 30 dias.
- **RSA-06:** `exigirAdministrador` (`src/app/_lib/exigir-administrador.ts`) em 31 ações administrativas, antes de qualquer contexto ou chamada de negócio; teste em `src/app/acoes-administrativas-papel.test.ts`. As ações administrativas de indicações já conferiam no tratador (`soAdministrador`). Ações de suspender, reativar e decidir denúncia seguem por permissão específica, conferida pelo serviço e pelo banco.
- **RSA-10 (parcial):** id que não é UUID não chega à Admin API. Não se recusa conta fora da lista, porque esse é o caminho de repetir a liberação depois de "reativada sem liberar". Restringir de verdade (só conta reativada) e auditar exige função no banco que informe a situação de qualquer conta e grave auditoria (proposta, não escrita).
- **RSA-01 (pendente, outra entrega):** a CSP precisa liberar `https://challenges.cloudflare.com` em `script-src`, `frame-src` e `connect-src` por causa do Turnstile.
