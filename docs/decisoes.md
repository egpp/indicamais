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
