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
| IM-006 | D | Conta multifunção | Em andamento | Parte de conta (tabela contas_conta 1:1 com auth.users, criada por gatilho) pronta no banco. Falta: vínculo com perfis comerciais (Fase 2) e fluxo de ponta a ponta com Auth real. Não marcar Verificado antes. | Fase 2 (perfis) | pgTAP contas.test.sql (CI Banco (pgTAP), run 39958430770, Result: PASS, 22/22): gatilho cria as duas contas, nome vem do metadado. contas_negativos.test.sql (run 39960008724, 20 de 21 ok): nome de 200 caracteres truncado em 80, nome só com espaços vira nulo, metadado nulo cria conta, apagar usuário do Auth com conta é bloqueado (restrict). | — |
| IM-007 | D | Login | Em andamento | Falta: configurar provedores no painel do Supabase (e-mail/senha, Google, Apple), telas e fluxo de ponta a ponta (Playwright). Vinculação de métodos à mesma conta ainda não testada. | Auth configurado no painel | Só validação de entrada: Vitest schemas.test.ts e seguranca.test.ts (e-mail com injeção de cabeçalho rejeitado, campos extras como whatsapp_verificado descartados); pnpm test local 93/93 em 23/10/2026. Sem evidência de login real. | — |
| IM-008 | D | Confirmação e recuperação | Em andamento | Falta: Auth configurado, e-mails de confirmação/recuperação, telas e teste de ponta a ponta (reenvio; e-mail inexistente com resposta idêntica na tela). | Auth configurado no painel | Só mensagens e validação: Vitest servico.test.ts (mensagens de recuperação/reenvio não afirmam que o e-mail existe; login não diferencia e-mail inexistente de senha errada). Sem evidência de fluxo real. | — |
| IM-009 | D | WhatsApp da conta | Bloqueado | DEFEITO no banco (ver Evidência): o CHECK aceita dígitos não ASCII e burla a exclusividade. Corrigir com nova migração trocando \d por [0-9] em contas_conta_whatsapp_formato e rodar de novo o CI Banco (pgTAP). Pendente da Fase 3: obrigatoriedade efetiva para indicar (contas_pode_indicar existe, mas nenhuma regra de indicação a chama ainda). Pendente de IM-010: verificação por código. | Fase 3 (indicações), IM-010 (futuro) | OK: Vitest whatsapp, schemas, servico e seguranca, 93/93 (normalização de formatos para E.164, DDD, estrangeiros, entradas hostis, fuzz de 5000 casos sempre casando com o CHECK, formas diferentes do mesmo número geram o mesmo valor, erro de duplicado idêntico ao de formato inválido e sem texto do banco, serviço nunca grava whatsapp_verificado, verificado sempre exibido como false). pgTAP no CI: duplicado 23505, sem +55 23514, curto 23514, quebra de linha final 23514, espaço final 23514, longo 23514, whatsapp_verificado=true 23514 até para superusuário, cliente não altera whatsapp_verificado nem id (42501). FALHA: contas_negativos.test.sql teste 9 'dígitos não ASCII são rejeitados' (run 39960008724, Result: FAIL). Passo a passo: como usuário autenticado, update public.contas_conta set whatsapp_e164 = '+55١١٩٩٩٩٩٠٠٠١' where id = auth.uid(); não dá erro, e '+5511999990001' continua livre para outra conta (exclusividade burlada por qualquer cliente autenticado via API). | — |
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
| IM-086 | D | Segurança | Verificado (base Fase 0; RLS das tabelas de contas) | RLS, isolamento e auditoria de cada tabela nova nas fases seguintes. Observações: (1) apagar usuário do Auth fica bloqueado por restrict, então é preciso um fluxo de exclusão de conta antes de atender pedidos de eliminação de dados (LGPD); (2) sem verificação (IM-010) qualquer usuário pode reservar um número alheio; (3) corrigir o defeito do IM-009. | — | Segredos: git grep em 23/10/2026 na branch fase-1/contas: sem sb_secret_, sb_publishable_, eyJ..., ghp_, postgres://; só nomes de variáveis (.env.example, scripts/checar-supabase.mjs) e comentários. Base da Fase 0 mantida (22/10/2026). RLS de contas_conta e contas_whatsapp_historico (CI Banco (pgTAP), run 39958430770 PASS 22/22; run 39960008724 contas_negativos 20/21, a única falha é a do IM-009): RLS ativa e forçada nas duas tabelas; A vê só a própria conta e não lê a de B; A não altera a conta de B; cliente não insere, não apaga, não altera id nem whatsapp_verificado; histórico imutável até para superusuário e cliente não insere nele; B não vê histórico de A; anon não lê contas nem histórico nem executa contas_pode_indicar; sessão sem identidade não lê nada; cliente não executa as funções de gatilho (42501); gatilho do histórico grava valor novo e autor. Revisão da migração: SECURITY DEFINER com search_path vazio, grants por coluna (update só em nome_exibicao e whatsapp_e164), REVOKE nas funções. Auditoria de ações administrativas ainda sem tabelas para testar. | 23/10/2026 |
| IM-087 | P | Ambientes | Aguardando decisão | — | — | — | — |
| IM-088 | D | Validação e continuidade | Verificado (base Fase 0) | Testes de fluxos reais (Playwright) a partir da Fase 1. | — | Teste de fronteira (tests/fronteiras-modulos.test.ts, 10/10) verificado em 22/10/2026 com violador temporário; nesta data pnpm lint e pnpm typecheck: exit 0 (Node local 25.3, fora do Node 24; pnpm test local NÃO contado como evidência agora). EVIDÊNCIA DE TERCEIROS: CI verde e Deploy dev #2 (10 testes passando) relatados pelo Emerson/gestor; repositório privado, não consegui consultar. | 22/10/2026 |
| IM-089 | D | Limites | A fazer | — | — | — | — |
| IM-090 | D | Fora do escopo inicial | A fazer | — | — | — | — |
