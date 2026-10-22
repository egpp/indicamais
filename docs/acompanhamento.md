# IndicaMais — Acompanhamento de execução

Situações: A fazer · Em andamento · Bloqueado · Implementado · Verificado · Aguardando decisão · Desativado (futuro).

Regras:
- Só o agente `verificador` marca **Verificado**, e só com evidência (teste que passou, comando e resultado, ou captura de tela). Código ou documentação sozinhos não são evidência.
- Nunca remover linhas. Futuros e pendentes continuam na tabela mesmo após o lançamento.
- Itens P mudam de situação só depois de a decisão estar registrada em `docs/decisoes.md`.

| ID | Tipo | Requisito | Execução | Próxima ação | Dependência/decisão | Evidência | Verificado em |
|---|---|---|---|---|---|---|---|
| IM-001 | D | Arquitetura modular | Verificado (base Fase 0) | Módulos funcionais virão nas fases seguintes; repetir o teste de fronteira a cada módulo novo. | — | 10 módulos ativos em src/modules/<x>/index.ts (vazios), nenhum futuro (planos, social, remarketing, pagamentos). pnpm install --frozen-lockfile, lint, typecheck, format:check, build: exit 0; pnpm test: 10/10. Arquivo violador temporário em src/modules/indicacoes importando @/modules/pontos/interno e ../pontos/interno: eslint deu 3 erros no-restricted-imports; removido. | 22/10/2026 |
| IM-002 | D | Integração entre módulos | Verificado (base Fase 0) | Parte "saldos e regras separados" só pode ser verificada quando pontos/comissões/relacionamento existirem. | — | tests/fronteiras-modulos.test.ts: 4 casos permitidos passam, 4 proibidos falham, shared->módulos bloqueado, módulo real indicacoes->pontos/interno bloqueado (10/10 passaram). Violador temporário confirmado via pnpm exec eslint. | 22/10/2026 |
| IM-003 | D | Referência central | Verificado (base Fase 0) | Manter IDs ao incluir requisitos novos. | — | docs/ versionado no Git (git ls-files docs); 7 commits na branch fase-0/fundacoes citam IDs; CLAUDE.md com seção Comandos preenchida e coerente com package.json. | 22/10/2026 |
| IM-004 | D | Continuidade | A fazer | — | — | — | — |
| IM-005 | D | Experiência brasileira | Implementado | Verificar em tela no celular (Playwright, viewport móvel) quando houver telas reais; hoje só há <html lang="pt-BR"> e página inicial. | — | pnpm build ok (rotas / e /_not-found estáticas). Sem teste de responsividade, moeda ou telefone ainda. | — |
| IM-006 | D | Conta multifunção | A fazer | — | — | — | — |
| IM-007 | D | Login | A fazer | — | — | — | — |
| IM-008 | D | Confirmação e recuperação | A fazer | — | — | — | — |
| IM-009 | D | WhatsApp da conta | A fazer | — | — | — | — |
| IM-010 | F | Verificação por código | Desativado (futuro) | — | — | — | — |
| IM-011 | D | Página comercial | A fazer | — | — | — | — |
| IM-012 | D | Conteúdo opcional | A fazer | — | — | — | — |
| IM-013 | D | Ações da página | A fazer | — | — | — | — |
| IM-014 | D | Produtos e serviços | A fazer | — | — | — | — |
| IM-015 | D | Anúncios particulares | A fazer | — | — | — | — |
| IM-016 | D | Categorias | A fazer | — | — | — | — |
| IM-017 | D | Prévia | A fazer | — | — | — | — |
| IM-018 | P | Mapa e rota | Aguardando decisão | — | — | — | — |
| IM-019 | D | Página inicial | A fazer | — | — | — | — |
| IM-020 | D | Patrocinadores internos | A fazer | — | — | — | — |
| IM-021 | D | Aprovação inicial | A fazer | — | — | — | — |
| IM-022 | D | Versões de conteúdo | A fazer | — | — | — | — |
| IM-023 | D | Resultado da revisão | A fazer | — | — | — | — |
| IM-024 | D | Link exclusivo | A fazer | — | — | — | — |
| IM-025 | D | Atribuição por destino | A fazer | — | — | — | — |
| IM-026 | D | Formulário sem cadastro | A fazer | — | — | — | — |
| IM-027 | D | Pedidos de contato | A fazer | — | — | — | — |
| IM-028 | D | Falhas de comunicação | A fazer | — | — | — | — |
| IM-029 | D | Privacidade | A fazer | — | — | — | — |
| IM-030 | D | Pontuação configurável | A fazer | — | — | — | — |
| IM-031 | P | Parâmetros iniciais | Aguardando decisão | — | — | — | — |
| IM-032 | D | Duplicidade | A fazer | — | — | — | — |
| IM-033 | D | Contatos no intervalo | A fazer | — | — | — | — |
| IM-034 | D | Autoindicação | A fazer | — | — | — | — |
| IM-035 | D | Saldo e histórico | A fazer | — | — | — | — |
| IM-036 | D | Cadastro de benefícios | A fazer | — | — | — | — |
| IM-037 | F | Resgates | Desativado (futuro) | — | — | — | — |
| IM-038 | F | Cupons, sorteios e prêmios | Desativado (futuro) | — | — | — | — |
| IM-039 | D | Base por empresa | A fazer | — | — | — | — |
| IM-040 | D | Deduplicação | A fazer | — | — | — | — |
| IM-041 | D | Permissões da base | A fazer | — | — | — | — |
| IM-042 | D | Separação dos incentivos | A fazer | — | — | — | — |
| IM-043 | P | Identificação na curtida | Aguardando decisão | — | — | — | — |
| IM-044 | P | Evento de entrada por indicação | Aguardando decisão | — | — | — | — |
| IM-045 | P | Saída e visibilidade | Aguardando decisão | — | — | — | — |
| IM-046 | F | Remarketing | Desativado (futuro) | — | — | — | — |
| IM-047 | D | Ícone no dashboard | A fazer | — | — | — | — |
| IM-048 | D | Aba Quem me indicou | A fazer | — | — | — | — |
| IM-049 | D | Aba Minhas indicações | A fazer | — | — | — | — |
| IM-050 | D | Identificação permitida | A fazer | — | — | — | — |
| IM-051 | P | Estados e contagens | Aguardando decisão | — | — | — | — |
| IM-052 | P | Leitura dos avisos | Aguardando decisão | — | — | — | — |
| IM-053 | D | Integração modular | A fazer | — | — | — | — |
| IM-054 | P | Escopo social | Aguardando decisão | — | — | — | — |
| IM-055 | P | Publicações da empresa | Aguardando decisão | — | — | — | — |
| IM-056 | P | Comentários e respostas | Aguardando decisão | — | — | — | — |
| IM-057 | P | Mensagens privadas e grupos | Aguardando decisão | — | — | — | — |
| IM-058 | P | Curtidas em anúncios particulares | Aguardando decisão | — | — | — | — |
| IM-059 | D | Independência do social | A fazer | — | — | — | — |
| IM-060 | F | Planos da plataforma | Desativado (futuro) | — | — | — | — |
| IM-061 | D | Habilitação do módulo | A fazer | — | — | — | — |
| IM-062 | D | Ofertas e percentuais | A fazer | — | — | — | — |
| IM-063 | D | Redes independentes | A fazer | — | — | — | — |
| IM-064 | D | Cálculo de comissão | A fazer | — | — | — | — |
| IM-065 | D | Saldos separados | A fazer | — | — | — | — |
| IM-066 | D | Adimplência do indicador | A fazer | — | — | — | — |
| IM-067 | D | Regularização no prazo | A fazer | — | — | — | — |
| IM-068 | D | Encerramento de vínculos | A fazer | — | — | — | — |
| IM-069 | D | Preservação e percentuais | A fazer | — | — | — | — |
| IM-070 | D | Confirmação manual | A fazer | — | — | — | — |
| IM-071 | P | Elegibilidade exata | Aguardando decisão | — | — | — | — |
| IM-072 | P | Inadimplência operacional | Aguardando decisão | — | — | — | — |
| IM-073 | P | Mudanças e reversões | Aguardando decisão | — | — | — | — |
| IM-074 | F | Recebimentos Pix/cartão | Desativado (futuro) | — | — | — | — |
| IM-075 | F | Repasses | Desativado (futuro) | — | — | — | — |
| IM-076 | D | Denúncias | A fazer | — | — | — | — |
| IM-077 | D | Permissões administrativas | A fazer | — | — | — | — |
| IM-078 | D | Reversões auditáveis | A fazer | — | — | — | — |
| IM-079 | D | Despublicação | A fazer | — | — | — | — |
| IM-080 | D | Suspensão e reativação | A fazer | — | — | — | — |
| IM-081 | D | Encerramento | A fazer | — | — | — | — |
| IM-082 | P | Políticas | Aguardando decisão | — | — | — | — |
| IM-083 | D | Destinos e acessos | A fazer | — | — | — | — |
| IM-084 | D | Proteção do trabalho | A fazer | — | — | — | — |
| IM-085 | D | Versionamento e recuperação | Implementado | Verificar: (1) CI verde no GitHub após push (ci.yml coerente com scripts: install --frozen-lockfile, lint, typecheck, test; falta format:check e build no CI, sugestão ao gestor); (2) deploy de dev na Cloudflare acessível; (3) pnpm build:cf em WSL/Linux/CI (não validado: falha no Windows nativo, limitação do OpenNext); (4) Supabase dev ligado e geração de tipos (não testado, exige Docker/projeto). | — | Repositório Git com migrações em supabase/ (init, sem link), .env.example e .dev.vars.example versionados. CI ainda não executado no GitHub; deploy de dev inexistente. | — |
| IM-086 | D | Segurança | Implementado | Base de segredos verificada; RLS/auditoria/isolamento só quando houver tabelas (Fase 1+). Reavaliar quando a primeira migração com tabelas existir. | — | git ls-files: só .env.example e .dev.vars.example; .gitignore cobre .env* e .dev.vars*; git log -p --all sem chaves/tokens/JWT/URLs Supabase (única ocorrência é "env(SUPABASE_AUTH_EXTERNAL_APPLE_SECRET)" do config.toml, referência e não valor); .env.example só com nomes, sem valores. Nenhuma tabela ainda. | — |
| IM-087 | P | Ambientes | Aguardando decisão | — | — | — | — |
| IM-088 | D | Validação e continuidade | Implementado | Fechar quando o CI estiver verde e houver testes de fluxos reais nas fases seguintes. | — | Teste de risco concreto (fronteira) passa; lint/tipos/testes/format/build locais verdes. CI no GitHub não rodou. | — |
| IM-089 | D | Limites | A fazer | — | — | — | — |
| IM-090 | D | Fora do escopo inicial | A fazer | — | — | — | — |
