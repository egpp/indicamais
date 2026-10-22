# IndicaMais — Roteiro de construção

Uma fase só começa quando a anterior tem seus IDs marcados como Verificado ou Bloqueado com motivo registrado. Itens F não entram em nenhuma fase até decisão expressa.

## Fase 0 — Fundações
**IDs:** IM-001, IM-002, IM-003, IM-005, IM-083, IM-085, IM-086 (base), IM-088
- Repositório, Next.js + TypeScript estrito, pnpm, lint com regra de fronteira entre módulos, formatação.
- Pastas `src/modules/*` com `index.ts` vazio para cada módulo ativo; `src/shared/`.
- Supabase de desenvolvimento ligado; pasta de migrações; geração de tipos.
- Deploy de desenvolvimento na Cloudflare funcionando (página "olá" no ar).
- CI rodando lint, checagem de tipos e testes a cada push.
- `.env.example`, seção "Comandos" do CLAUDE.md preenchida.
- **Entrega verificada quando:** CI verde, deploy de dev acessível, teste que prova que um módulo não consegue importar o interior de outro.

## Fase 1 — Contas e autenticação
**IDs:** IM-006, IM-007 (sem Apple), IM-008, IM-009
**Pendência:** Apple (custo).

## Fase 2 — Perfis, catálogo e publicação
**IDs:** IM-011 a IM-017, IM-019 a IM-023, IM-079
**Pendência:** IM-018 (mapa).

## Fase 3 — Indicações e contato
**IDs:** IM-024 a IM-029
Inclui prévia de link para WhatsApp (Open Graph) nas páginas indicáveis.

## Fase 4 — Pontos
**IDs:** IM-030, IM-032 a IM-036, IM-078
**Pendência:** IM-031 (valores iniciais).

## Fase 5 — Base de Relacionamento e notificações
**IDs:** IM-039 a IM-042, IM-047 a IM-050, IM-053
**Pendências:** IM-043, IM-044, IM-045, IM-051, IM-052.

## Fase 6 — Administração e ciclo de vida
**IDs:** IM-076, IM-077, IM-080, IM-081
**Pendência:** IM-082 (políticas).

## Fase 7 — Comissões mononível (confirmação manual)
**IDs:** IM-061 a IM-070
**Pendências:** IM-071, IM-072, IM-073.

## Antes do lançamento
- Relatório com todos os IDs: verificados, bloqueados, adiados e não conferidos.
- Revisão de segurança completa (RLS de todas as tabelas, segredos, isolamento entre responsáveis).
- Abertura pública só com decisão do Emerson (IM-089).
