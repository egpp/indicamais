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
(Preencher na Fase 0 com os comandos reais de instalar, rodar, testar, lint, gerar tipos do Supabase e publicar.)
