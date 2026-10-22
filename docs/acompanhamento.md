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
| IM-005 | D | Experiência brasileira | Verificado (base Fase 0) | Verificar em tela no celular (Playwright, viewport móvel), moeda e telefone quando houver telas reais. | — | curl -sI/curl em https://indicamais-dev.egpp1234.workers.dev/ (22/10/2026): HTTP 200, text/html, <html lang="pt-BR">, meta viewport width=device-width, initial-scale=1, texto "Olá! Ambiente em construção."; nenhuma ocorrência de sb_secret/eyJ/service_role/supabase.co no HTML nem de sb_/eyJ/token nos cabeçalhos. Base verificada: idioma pt-BR e viewport mobile no ar. | 22/10/2026 |
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
| IM-083 | D | Destinos e acessos | Verificado (base Fase 0) | Na Fase 0 só o destino de dev. Pendente para depois: destinos de produção (Worker indicamais, Supabase de produção) com aprovação do Emerson (D-003); reutilização de acessos nas fases seguintes. | D-003, D-005 | wrangler.jsonc: name e service = indicamais-dev; deploy-dev.yml aborta se wrangler.jsonc referenciar "indicamais" (grep em .github, wrangler.jsonc: nenhuma referência ao Worker de produção); deploy-dev é só workflow_dispatch e sem passo de produção; URL de dev responde 200 (curl). RELATO DO EMERSON (não verificado por mim): pnpm check:supabase ok, ref do projeto dev confere. | 22/10/2026 |
| IM-084 | D | Proteção do trabalho | A fazer | — | — | — | — |
| IM-085 | D | Versionamento e recuperação | Verificado (base Fase 0) | Migrações reais só nas fases com tabelas; rodar Playwright/db no CI depois. Confirmar pnpm build:cf no CI quando houver acesso ao resultado. | D-003, D-005 | Git: branch fase-0/fundacoes limpa, 17 commits, migrações em supabase/migrations/ (vazia, ok na Fase 0), .env.example e .dev.vars.example versionados; src/shared/db/database.types.ts gerado (public sem tabelas, PostgrestVersion 14.18). curl -sI/curl em https://indicamais-dev.egpp1234.workers.dev/ (22/10/2026): HTTP 200, text/html, <html lang="pt-BR">, meta viewport width=device-width, initial-scale=1, texto "Olá! Ambiente em construção."; nenhuma ocorrência de sb_secret/eyJ/service_role/supabase.co no HTML nem de sb_/eyJ/token nos cabeçalhos. ci.yml cobre install --frozen-lockfile, lint, typecheck, test, format:check, build e build:cf (Node 24). EVIDÊNCIA DE TERCEIROS (relato do Emerson/gestor): CI verde; Deploy dev #2 verde; pnpm check:supabase ok nas 3 variáveis, publishable e secret key com conexão ok. | 22/10/2026 |
| IM-086 | D | Segurança | Verificado (base Fase 0) | Base de segredos verificada; RLS/auditoria/isolamento só quando houver tabelas (Fase 1+). Reavaliar na primeira migração com tabelas. | — | git log -p --all e git grep na árvore atual (22/10/2026): sem sb_secret_, sb_publishable_, eyJ..., ghp_, URLs de projeto Supabase; únicas ocorrências de CLOUDFLARE_API_TOKEN são referências a secrets.CLOUDFLARE_API_TOKEN do GitHub Actions; ".supabase.co" só em checagem de sufixo do scripts/checar-supabase.mjs. Portanto a secret key revogada nunca entrou no Git. Só .env.example rastreado de .env*. HTML e cabeçalhos do deploy de dev sem chaves. .env.local não foi lido. Nenhuma tabela ainda. | 22/10/2026 |
| IM-087 | P | Ambientes | Aguardando decisão | — | — | — | — |
| IM-088 | D | Validação e continuidade | Verificado (base Fase 0) | Testes de fluxos reais (Playwright) a partir da Fase 1. | — | Teste de fronteira (tests/fronteiras-modulos.test.ts, 10/10) verificado em 22/10/2026 com violador temporário; nesta data pnpm lint e pnpm typecheck: exit 0 (Node local 25.3, fora do Node 24; pnpm test local NÃO contado como evidência agora). EVIDÊNCIA DE TERCEIROS: CI verde e Deploy dev #2 (10 testes passando) relatados pelo Emerson/gestor; repositório privado, não consegui consultar. | 22/10/2026 |
| IM-089 | D | Limites | A fazer | — | — | — | — |
| IM-090 | D | Fora do escopo inicial | A fazer | — | — | — | — |
