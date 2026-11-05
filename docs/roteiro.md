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

## Bloco de layout (entre a Fase 3 e a Fase 4) — D-010
**IDs:** IM-005, IM-014 (acabamento visual; sem requisito novo)
Sistema de design aplicado a todas as telas existentes: paleta, tipografia, espaçamentos, componentes padronizados, logotipo e imagem de prévia do WhatsApp (substitui `public/og-padrao.png`), com verificação no celular e acessibilidade. As Fases 4 a 7 já nascem com o visual novo.
**Pendência do Emerson:** logotipo e arte da marca (variações para fundo claro e escuro, se houver); paleta (manter o verde atual ou outra) e sites de referência.

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
**Situação (05/11/2026):** concluída no código e verificada em camadas. Regras de IM-071 a IM-073 decididas em D-025, D-026, D-028, D-029 e D-030. Banco (migrações 20261105100000 a 20261105150000, aplicadas no dev), módulo `comissoes`, telas do administrador, do anunciante e do indicador, leituras administrativas e avisos de inadimplência nas notificações. Ressalva: o fluxo de escrita completo só está provado pelo pgTAP (tabelas só-inserção, sem dados de teste no dev). Cobrança e repasse automáticos seguem fora (IM-090, IM-074 é F).

## Fase 8 — Páginas dos negócios como sites (D-016)
**IDs:** IM-091, IM-092, IM-093 (e IM-011, IM-012 no que evoluem)
**Pendências:** IM-018 (mapa: fornecedor), IM-094 (aprovação da troca de estilo).
- Estrutura da página em seções com menu fixo no topo, banner rotativo (imagens do responsável e do admin com aceite), seção de localização (mapa quando IM-018 for decidida) e ações da página.
- Menu "Aparência" no painel com miniaturas, prévia e escolha de estilo; 5 estilos iniciais (Minimalista, Gastronomia, Saúde e Bem-estar, Beleza e Estética, Construção e Reformas); depois os outros 15.
- Pode ser feita antes ou depois da Fase 7, por decisão do Emerson; não depende de pontos nem de comissões.

## Fase 9 — Seções em carrossel na página inicial (D-018)
**IDs:** IM-095, IM-096 (e IM-019, IM-020 no que evoluem)
- Banco: critérios dos rankings (Novidades, Mais curtidos, Mais indicados, Na sua cidade, Em alta na semana) em visões/RPCs públicas só com dados públicos, parâmetros editáveis (nome, ativa, ordem, mínimo de itens, limite) com auditoria.
- Módulo e administração: editar nomes e ordem das seções (administrador geral).
- Interface: carrosséis acessíveis na home, 4 ou 5 cards por linha, rolagem horizontal no celular, seções vazias ocultas.

## Antes do lançamento
- Relatório com todos os IDs: verificados, bloqueados, adiados e não conferidos.
- Revisão de segurança completa (RLS de todas as tabelas, segredos, isolamento entre responsáveis).
- Abertura pública só com decisão do Emerson (IM-089).

## Fase 10 — Módulo Loja (catálogo) nas páginas (IM-097, IM-098, IM-099)
Decisões em D-020 (03/11/2026). Sem checkout, carrinho ou pagamento. Imóveis como tipo de item com campos próprios.
