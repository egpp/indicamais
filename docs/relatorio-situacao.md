# Relatório de situação dos requisitos (05/11/2026)

Gerado a partir de `docs/acompanhamento.md`. Cobre os IDs IM-001 a IM-101. Serve de visão para a decisão de lançamento; não substitui o acompanhamento por ID.

## Resumo

| Situação | IDs | Observação |
|---|---|---|
| Verificado | 59 | Com evidência registrada pelo verificador |
| Verificado com ressalva | 21 | Verificado, com limite conhecido (veja abaixo) |
| Decidido, sem trabalho de código | 2 | IM-031 (D-012, D-031) e IM-087 (D-003) |
| Implementado, não verificado | 1 | IM-027 (e-mail de pedido de contato: falta provedor real) |
| A fazer / regra contínua | 5 | IM-004, IM-059, IM-084, IM-089, IM-090 |
| Aguardando decisão | 6 | IM-054 a IM-058 (social) e IM-082 (revisão jurídica) |
| Futuro (F), desativado | 7 | IM-010, IM-037, IM-038, IM-046, IM-060, IM-074, IM-075 |
| **Total** | **101** | |

Dos 94 IDs ativos (fora os 7 futuros), **80 estão verificados** (59 + 21), ou seja, cerca de 85%. Somados os 2 decididos, 82 estão resolvidos.

## O que ainda falta para o lançamento

### Decisões e ações do Emerson (fora do código)
- **IM-082:** revisão jurídica da política de privacidade e retenção. Prazo de carência e retenção atuais são provisórios (D-014). Antes de ativar comissões de verdade e de abrir ao público.
- **IM-026:** texto definitivo da política de privacidade (hoje provisório).
- **Provedor de e-mail (D-032):** criar a conta no Resend, definir o domínio e verificar os registros DNS, guardar `EMAIL_API_KEY`, `EMAIL_FROM` e `NEXT_PUBLIC_APP_URL` no Worker e a variável de repositório no GitHub. Sem isso IM-023, IM-027 e IM-028 ficam sem e-mail real.
- **Login com Google (IM-007):** credenciais no Google Cloud. Apple continua bloqueada por custo.
- **Subdomínio workers.dev e domínio de produção.**
- **Deploy em produção** e `supabase db push` em produção: só com aprovação, naquele momento (D-003, IM-089).

### Trabalho do projeto
- **Social (IM-054 a IM-059):** módulo futuro, sem código ativo; aguarda decisão de escopo.
- **Regras contínuas:** IM-004, IM-084, IM-089, IM-090 (valem enquanto o projeto durar).
- **Cadastro da Equipe (A7)** e as demais funções dos modelos listadas em `docs/lacunas-modelos.md`.
- **Alerta ao administrador quando a cota mensal de e-mail esgotar** (IM-028).
- **Revisão de segurança completa**, antes do lançamento (`docs/roteiro.md`).
- **Proteção por Turnstile e limite por IP** (IM-076) e variável `NEXT_PUBLIC_APP_URL` na produção.
- **Estender a regra de fronteira de módulos a `worker/` e `scripts/`** (baixo risco).

## Ressalvas dos 21 verificados com ressalva
- **Celular real e leitor de tela (julgamento do Emerson):** IM-035, IM-036, IM-047, IM-092, IM-030. Falta abrir no aparelho e conferir.
- **E-mail e SMTP:** IM-008 (confirmação em outro aparelho), IM-023 (só a parte do painel verificada; e-mail do resultado não feito), IM-028.
- **Ciclo de vida sem execução real no dev:** IM-079, IM-080, IM-081 (carência, desistência e anonimização provadas só em pgTAP no CI). Falta rodar com conta descartável.
- **Mapa, patrocinadores e busca:** IM-018 (ver o mapa renderizado no navegador), IM-019 e IM-020 (Playwright no celular).
- **Loja, imóveis e cota de imagens:** IM-097, IM-098, IM-099, IM-101.
- **Denúncias:** IM-076 (captcha e limite por IP só na borda).
- **Política provisória:** IM-026.
- **Carrosséis da home:** IM-095 (critérios de "Na sua cidade" e "Em alta").
- **Comissões:** IM-061 a IM-073 estão verificadas no CI, por revisão e no dev em modo somente leitura. O fluxo de escrita completo só está provado por pgTAP, porque as tabelas são só-inserção e permanentes.

## Ambiente e custos
- **Sem custo novo até aqui.** Provedor de e-mail escolhido no plano grátis (D-032).
- **Dev:** migrações aplicadas até `20261105160000`. Cota de imagens do dono de teste estável em 88 de 100 (guarda dispara em 90).
- **Produção:** nada publicado.

## Próximas ações sugeridas
1. Emerson: contratar a revisão jurídica e decidir o escopo do social.
2. Emerson: criar a conta do Resend, o domínio e as chaves; credenciais do Google.
3. Projeto: revisão de segurança completa e preparação do deploy de produção (sem publicar).
4. Projeto: cadastro da Equipe e demais funções dos modelos, conforme prioridade do Emerson.
