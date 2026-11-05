# Fase 7 — Comissões mononível: desenho do banco

**IDs:** IM-061 a IM-073 (IM-060 e IM-074 seguem F). Base: D-017 e D-025. Só banco e desenho; regras em `src/` e telas vêm depois.
**Migrações (dev apenas):** `20261105100000_comissoes_modelo`, `20261105110000_comissoes_habilitacao_ofertas`, `20261105120000_comissoes_fluxo`, `20261105130000_comissoes_leitura`.
**Testes:** `supabase/tests/database/comissoes.test.sql` (pgTAP, roda no CI) e `tests/migracoes-fase7.test.ts` (varredura estática).

## Princípios
- Negócio = perfil comercial (`perfis_perfil`). Prefixo `comissoes_`. Nenhuma tabela, saldo ou função toca pontos, relacionamento ou social (IM-065).
- Tudo é só inserção (gatilho vale até para `service_role`); o estado atual é o último evento. Reversão é lançamento novo que aponta o original (IM-073, IM-078). Única tabela com UPDATE: `comissoes_parametro` (só o valor).
- Dinheiro em centavos inteiros (BRL); percentual em pontos-base (100 = 1%); datas em UTC; competência = dia 1 do mês.
- Sem cobrança, repasse ou cron: o administrador registra assinaturas e confirma cada mensalidade (IM-070, IM-090). O encerramento de vínculos também é ação manual.

## Modelo de dados (16 tabelas)
| Tabela | Papel |
|---|---|
| `comissoes_parametro` | `prazo_inadimplencia_dias` (padrão 60, faixa 1 a 365) |
| `comissoes_habilitacao_evento` | habilitar/desabilitar por negócio, origem (espontânea ou solicitação), motivo, autor (IM-061) |
| `comissoes_rede` | uma rede por negócio, criada na primeira habilitação (IM-063) |
| `comissoes_oferta`, `_oferta_percentual`, `_oferta_estado` | oferta recorrente mensal (item do catálogo do negócio), histórico do percentual, ativa/inativa (IM-062). Venda avulsa não é representável |
| `comissoes_vinculo`, `_vinculo_encerramento` | indicador → cliente direto; cliente único por negócio; sem níveis (IM-063); encerramento só pelo administrador (IM-068) |
| `comissoes_assinatura`, `_assinatura_cancelamento` | assinatura registrada manualmente: cliente, oferta, valor mensal, vigência (D-025) |
| `comissoes_pagamento`, `_pagamento_estorno` | mensalidade confirmada manualmente (única por assinatura e mês); estorno (IM-064, IM-070, IM-073) |
| `comissoes_decisao` | uma por pagamento: gerou comissão ou não e o motivo (`sem_vinculo`, `vinculo_encerrado`, `modulo_desativado`, `oferta_inativa`, `indicador_inadimplente`, `valor_zero`, `gerada`) |
| `comissoes_comissao`, `_comissao_estado` | comissão com base e percentual congelados; estados gerada, pendente de repasse, paga (IM-064, IM-069) |
| `comissoes_lancamento` | razão do saldo do indicador: `comissao` (+) e `reversao` (−, com causa, motivo interno e ponteiro ao original) |

Duplicidade: restrições únicas em pagamento (assinatura+mês), decisão (pagamento), comissão (pagamento), lançamento de comissão (comissão) e de reversão (original).

## Fluxos
1. **Habilitar** (admin): `comissoes_definir_habilitacao`. Desabilitar preserva tudo e só bloqueia novas comissões (IM-073).
2. **Ofertas** (responsável do negócio, só com módulo habilitado): `comissoes_criar_oferta`, `comissoes_alterar_percentual_oferta`, `comissoes_definir_oferta_ativa`. Percentual novo vale só para pagamentos confirmados depois (IM-069).
3. **Vínculo e assinatura** (admin): `comissoes_registrar_vinculo`, `comissoes_registrar_assinatura`, `comissoes_cancelar_assinatura`.
4. **Pagamento** (admin): `comissoes_confirmar_pagamento` grava pagamento, decisão, comissão, lançamento, estado `gerada` e auditoria na mesma transação. Repetir devolve o mesmo pagamento.
5. **Repasse** (admin): `comissoes_avancar_repasse` (gerada, pendente de repasse, paga), em ordem.
6. **Reversão** (admin): `comissoes_reverter_comissao` e `comissoes_estornar_pagamento` (que reverte a comissão do pagamento). Comissão já paga exige confirmação explícita (P0410). Uma reversão por comissão.
7. **Inadimplência** (IM-066, IM-067, IM-072): `comissoes_situacao_indicador` (interna) calcula se o indicador está em dia no mesmo negócio e desde quando. Cada pagamento é decidido uma vez, na confirmação; regularizar depois não gera comissão dos meses anteriores.
8. **Encerramento** (admin): `comissoes_listar_vinculos_vencidos` e `comissoes_encerrar_vinculo` (só se desde + prazo ≤ hoje). Sem restauração; cliente não é transferido; indicador forma nova carteira com outros clientes (IM-068).
9. **Parâmetro** (admin): `comissoes_definir_parametro`.

## Política de acesso (IM-086)
- RLS ativada e forçada nas 16 tabelas, quatro políticas cada. Insert, update e delete sempre negados ao cliente; select só do administrador. Privilégios de escrita revogados de `anon` e `authenticated`.
- Funções `SECURITY DEFINER` com `search_path` vazio; nenhuma executável por `anon`; internas sem acesso da API. Ações administrativas usam `administracao_exigir_admin()` (administrador geral) e gravam `administracao_auditoria` (autor, data, motivo, valor anterior) na mesma transação.
- Leitura por visões com filtro fixo por `auth.uid()`: indicador (`comissoes_minhas_comissoes`, `comissoes_meu_saldo`, `comissoes_minha_situacao`) e anunciante (`comissoes_meus_negocios`, `comissoes_minhas_ofertas`, `comissoes_negocio_comissoes`, `comissoes_negocio_vinculos`). Nenhuma traz nome, telefone, e-mail nem id de conta de cliente ou indicador: só referência opaca (sha256). O motivo interno do administrador não é coluna; só a causa fixa da reversão. Os avisos de inadimplência (IM-072) são derivados dessas visões, sem cópia.

## Perguntas em aberto (adotei a opção mais conservadora; nada foi decidido pelo Emerson)
1. **Cliente sem conta:** o cliente precisa ser uma conta da plataforma (evita guardar nome, telefone ou e-mail). Cliente sem conta é permitido?
2. **Origem do vínculo (IM-063):** hoje o administrador registra o vínculo à mão. Ligar ao pedido de contato/link de indicação (módulo indicacoes) ou manter manual?
3. **Solicitação de habilitação (IM-061):** só o administrador habilita; a origem (espontânea ou solicitação) é informada por ele. Haverá pedido pelo painel do anunciante?
4. **Qual percentual vale (IM-073):** o vigente no momento da confirmação do pagamento, não o da competência. Existe teto (hoje de 0,01% a 100%)?
5. **Elegibilidade do indicador (IM-071):** basta assinatura vigente e em dia no mesmo negócio, em qualquer oferta; a comissão é só sobre a oferta do cliente. Deve ser a mesma oferta do cliente?
6. **Contagem (IM-072):** o relógio começa no dia 1 do primeiro mês sem pagamento confirmado (mensalidade tratada como antecipada). Deve começar no vencimento?
7. **Várias assinaturas do indicador em atraso:** vale o relógio mais recente (mais favorável ao indicador).
8. **Cancelamento (IM-073):** cancelar a assinatura bloqueia comissões futuras e não reverte as geradas; reverter é ação explícita. Cancelar deve reverter o último mês?
9. **Comissão já paga e revertida:** o banco registra e sinaliza; a recuperação do valor é fora do sistema.
10. **Pagamento estornado:** a competência não pode ser confirmada de novo. Como corrigir um estorno indevido?
11. **Vínculo encerrado:** o cliente continua atribuído ao indicador original (único por negócio) e não pode ser vinculado a outro. Deve poder?
12. **Oferta inativa:** bloqueia novas comissões da oferta (assinaturas existentes continuam registradas).
13. **Oferta exige item do catálogo de um negócio (perfil):** anúncio particular fica fora do módulo.
14. **Arredondamento:** para baixo, em centavos.
15. **Avisos (IM-072):** só dentro da plataforma, derivados das visões; a tela e a integração com o módulo notificacoes ficam para a etapa de regras e interface.
16. **Permissão:** todas as ações administrativas exigem o administrador geral (comissões não está nas seis permissões de IM-077).
