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

---

## Pendências que afetam as primeiras fases

| ID | Pendência | Como seguir até a decisão |
|---|---|---|
| IM-031 | 10 pontos a cada 30 dias, ou 15 dias? | Implementar quantidade e intervalo como configuração central (IM-030). Não ativar valor em produção até a decisão. Testes usam valores de exemplo. |
| IM-044 | Quando quem indica entra na Base de Relacionamento: ao gerar link, ao compartilhar ou ao gerar contato válido? | Registrar os três eventos separadamente no banco. A regra de entrada fica isolada e é ligada depois. |
| IM-007 (Apple) | Login com Apple exige conta Apple Developer paga. | Implementar e-mail/senha e Google. Apple fica bloqueado até o Emerson aprovar o custo. |
| IM-043 | Que identificação é exigida para curtir. | Não implementar curtida até a decisão. |
| IM-051, IM-052 | Eventos e leitura dos avisos. | Construir a estrutura de notificações; detalhes de contagem e leitura esperam decisão. |
