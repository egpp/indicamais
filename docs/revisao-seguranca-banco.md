# Revisão de segurança do banco (Fase 14)

Data: 06/11/2026 · Responsável: `banco-seguranca` · IDs: IM-029, IM-041, IM-050, IM-065, IM-078, IM-086 (e IM-021, IM-025, IM-028, IM-032, IM-064, IM-082 nos achados).
Escopo: análise estática das 50 migrações de `supabase/migrations/` (estado final, considerando `drop`/`create or replace`). Nenhum `db push`, nenhuma alteração no banco remoto, nenhuma `service_role` usada. Nada aqui foi marcado como Verificado (isso é do `verificador`).

## Resultado em uma linha

Nenhum achado crítico. 3 altos (corrigidos em migrações NOVAS, escritas e não aplicadas), 7 médios, 8 baixos. A base está bem fechada (RLS, funções, visões e auditoria sem furo estrutural); os altos são de abuso e de metadado do Storage, não de isolamento de dados.

| Gravidade | Qtde | IDs |
|---|---|---|
| Crítico | 0 | |
| Alto | 3 | S-01, S-02, S-03 |
| Médio | 7 | M-01 a M-07 |
| Baixo | 8 | B-01 a B-08 |

## Inventário (estado final)

- **Tabelas (schema public): 65.** Todas com RLS ativada e forçada, política explícita para select, insert, update e delete, e `revoke all` de anon e authenticated. Não há tabela customizada em `auth` nem em `storage` (só políticas e, agora, um gatilho em `storage.objects`). 34 são só de inserção por gatilho (`administracao_registro_imutavel`), sem privilégio de escrita para anon/authenticated.
- **Funções: 187 (mais 2 nas migrações novas).** Todas com `set search_path = ''`. Nenhuma executável por PUBLIC. Todo EXECUTE de authenticated é um GRANT explícito (110 funções). anon executa 11 (lista fechada abaixo). 6 são só de `service_role` (rotinas do Worker). 77 são internas (gatilhos e ajudantes) sem EXECUTE para papel de API. 164 são SECURITY DEFINER; todas as que anon/authenticated executam validam o chamador (`auth.uid()`, administrador, permissão, responsável) ou estão em lista revisada de 6 ajudantes de leitura pública (B-03).
- **anon executa:** `administracao_denunciar`, `busca_home_secao_perfis`, `busca_home_secoes`, `busca_normalizar`, `busca_publica`, `catalogo_imagem_publica`, `indicacoes_enviar_contato`, `loja_listar_imoveis`, `perfis_endereco_ref`, `perfis_perfil_disponivel`, `pontos_beneficio_no_prazo`.
- **Visões: 43.** 8 `security_invoker` (6 abertas a anon: `perfis_perfil_publico`, `catalogo_item_publico`, `loja_item_publico`, `perfis_banner_publico`, `pontos_beneficio_publico`, `administracao_patrocinador_publico`; nenhuma com coluna de conta, e-mail ou WhatsApp) e 35 "definer" com filtro fixo por `auth.uid()` ou administrador, sem acesso a anon. Nenhuma visão invoker chama função sem EXECUTE para o papel consumidor (lição D1 das comissões confirmada limpa).
- **Storage:** um bucket, `indicamais-imagens`, privado, 2 MiB, jpeg/png/webp. Leitura de anon só de imagem pública; escrita só de authenticated na própria pasta; `adm-*` reservado ao aprovador; cota de 100 por conta na política de insert.
- **SQL dinâmico:** um único bloco `DO` com `format` (constantes, `20261102100000`, políticas restritivas de conta sem acesso). Nenhuma função monta SQL com entrada do usuário. `LIKE` só com padrão constante (2 funções).
- **service_role:** o app só a lê em `src/shared/supabase/servico.ts` (teste existente `tests/seguranca-codigo.test.ts`); no banco ela herda o padrão do Supabase e as 6 funções do servidor.

## Testes novos

- `tests/revisao-seguranca-banco.test.ts` (Vitest, estático, 222 casos): simula as migrações em ordem e falha se aparecer tabela sem RLS forçada, sem política por operação ou sem `revoke`; função sem `search_path` vazio, executável por PUBLIC, com EXECUTE implícito, ou nova função liberada a anon; SECURITY DEFINER aberta a API sem validar quem chama; visão aberta a anon sem `security_invoker` ou com coluna privada; visão invoker que chama função sem EXECUTE; tabela só de inserção com escrita liberada; SELECT de tabela inteira para anon fora da lista; função administrativa que escreve sem auditoria; SQL dinâmico novo; política de Storage fora do bucket ou escrita por anon; e os três achados corrigidos (S-01, S-02, S-03).
- `supabase/tests/database/seguranca_revisao_fase14.test.sql` (pgTAP, roda no CI): prova S-01 (owner_id zerado), S-02 (dono não sobrescreve imagem em uso, outro responsável não altera nada) e S-03 (limite por destino e global, idempotência preservada, pedido recusado não gravado).

## Achados altos (corrigidos em migração nova, NÃO aplicada)

### S-01 · Alto · Storage devolve a conta de quem enviou (owner_id) a quem tem a chave pública
- Onde: `20261024140000_catalogo_storage_imagens.sql:22` (o próprio comentário registra "RISCO CONHECIDO"); política de leitura pública no mesmo arquivo.
- Problema: o Storage grava `owner`/`owner_id` em `storage.objects` e os devolve na listagem. Como anon pode listar as imagens públicas, quem chama a API do Storage direto com a chave anon liga cada página e cada anúncio ao `id` da conta do responsável, algo que o desenho esconde (visões públicas sem `responsavel_id`; caminhos opacos, IM-029). A mitigação era só do app ("o servidor não repassa o metadado"), que não vale para chamada direta. O teste `tests/integracao/storage-owner.test.ts` que provaria o contrário existe, mas está "skipped" (nunca rodou).
- Reprodução: `POST /storage/v1/object/list/indicamais-imagens` com a chave anon e `prefix: "perfil/<id>"` de um perfil publicado; o objeto traz `owner`/`owner_id` (a confirmar no dev; ver "Dúvidas").
- Correção: `20261106100000_seguranca_storage_sem_dono_sem_sobrescrita.sql`: gatilho `before insert or update` em `storage.objects` zera `owner` e `owner_id` do bucket e limpa o que já existe. Nenhuma política depende desses campos.

### S-02 · Alto · Dono sobrescreve o conteúdo de imagem já aprovada (revisão contornada, IM-021)
- Onde: `20261103120000_catalogo_storage_adm_reservado_ao_aprovador.sql:28` (política `catalogo_imagens_update_propria`, herdada de `20261024140000:120`).
- Problema: o UPDATE do dono só olhava a pasta e o prefixo `adm-`, não se a imagem estava em uso. Com `upsert` pela API direta, o dono troca os bytes de um arquivo aprovado (ou pendente) mantendo o nome, e o conteúdo publicado deixa de ser o que o administrador aprovou. O DELETE já tinha a proteção `not catalogo_imagem_em_uso`; o UPDATE não.
- Reprodução: enviar `foto.jpg`, aprovar a versão, reenviar `foto.jpg` com `x-upsert: true` e outro conteúdo.
- Correção: mesma migração: UPDATE do dono exige `not catalogo_imagem_em_uso(name)` no USING e no WITH CHECK. O app só envia com `upsert: false` (`src/app/_lib/upload-imagem.ts`) e nunca faz UPDATE, então não muda comportamento.

### S-03 · Alto · Pedido de contato sem freio real: pontos, spam e raspagem (IM-025, IM-030, IM-032, IM-026)
- Onde: `20261030110000_indicacoes_rpcs_link_contato.sql:141` (`indicacoes_enviar_contato`, executável por anon), limite em `:227`.
- Problema: o único limite de ritmo é por WhatsApp do visitante, valor que o próprio chamador escolhe (basta trocar o número; a regex só exige `+55` e 10 a 11 dígitos). Sem limite por link, por destino nem global, quem tem um link: (a) fabrica pedidos "válidos" sem fim, e cada um credita 10 pontos ao indicador (a regra de 30 dias é por WhatsApp do visitante, trocado a cada pedido); (b) inunda o responsável de pedidos e de e-mails; (c) raspa o WhatsApp pessoal de anunciantes particulares, que a função devolve após o envio (M-01). Resgates de pontos estão desligados (IM-037), então hoje o dano é de saldo falso e de spam; ao ligar os resgates passa a valer dinheiro.
- Reprodução: chamar a RPC em laço, com a chave anon, mudando `p_whatsapp` e `p_chave` a cada chamada e mantendo `p_codigo` de um link.
- Correção: `20261106110000_seguranca_indicacoes_limites_contato.sql`: gatilho `before insert` nos pedidos com três limites por hora (por link 20, por destino 60, global 1000), parâmetros em `indicacoes_parametro` ajustáveis e auditados, erro P0429 neutro, nada gravado. Os caminhos de repetição e idempotência (IM-028) respondem antes e continuam como estavam. **Os números são proposta do `banco-seguranca`; a escolha é do Emerson.** Limite global é "mole" sob concorrência. Não fecha o caso de atacante com muitos links: isso exige as decisões da seção "Precisa de decisão".

## Achados médios (sem migração; decisão ou trabalho de outro agente)

- **M-01 · WhatsApp pessoal do anunciante particular devolvido a qualquer visitante.** `indicacoes_resolver_destino` (`20261030110000:19`) usa `contas_conta.whatsapp_e164` para item sem perfil e `indicacoes_enviar_contato` o devolve (`:257`). É o desenho do IM-026 (seguir ao WhatsApp do responsável), mas sem CAPTCHA e com o ritmo burlável do S-03 vira raspagem do número pessoal (IM-029, IM-041). Mitigado em parte pelo S-03. Decisão: ver abaixo.
- **M-02 · Sem proteção contra TRUNCATE nas tabelas só de inserção.** Os gatilhos `before update or delete` (34 tabelas) não cobrem `TRUNCATE`; `service_role` e quem tem SQL direto apagam `pontos_lancamento`, `comissoes_lancamento`, `administracao_auditoria` de uma vez, contra IM-078. Correção sugerida (nova migração, trivial): gatilho `before truncate ... for each statement` com a mesma função. Não escrita por ser médio.
- **M-03 · Denúncia: limite global permite congestionamento e o limite por pessoa depende de `p_origem` que o chamador escolhe.** `20261102120000_administracao_denuncias.sql:249`. O servidor calcula o hash de IP (`src/app/_lib/origem-denuncia.ts`), mas a RPC é chamável direto com a chave anon, com `p_origem` livre ou nulo. Um robô esgota `denuncia_limite_global` (500 por janela) e bloqueia denúncias legítimas. A D-014 já prevê Turnstile; ver "Precisa de decisão".
- **M-04 · LGPD: dado pessoal de visitante em tabela imutável, sem caminho de exclusão.** `indicacoes_pedido_contato` guarda nome, WhatsApp e e-mail do visitante (`20261030100000:265`, imutável); o encerramento de conta anonimiza a conta mas não o visitante, nem o WhatsApp comercial das versões de perfil. A D-014 já deixa isso para a revisão jurídica (IM-082). Pendente: política de retenção, canal de pedido do titular, e como conciliar imutabilidade com apagamento (por exemplo, anonimizar por rotina com gatilho autorizado, como já se faz em `contas_whatsapp_historico`).
- **M-05 · Sem teto de perfis, itens e rascunhos por conta, com cadastro aberto.** `perfis_criar_rascunho` e `catalogo_criar_item` (`20261024150000:22` e `:144`) não limitam quantidade; a única cota é a de 100 imagens. Com "Confirm email" desligado no dev (D-011, "religar antes do lançamento"), qualquer um cria contas e enche o banco (custo, IM-089). Ações: religar a confirmação de e-mail, definir teto por conta (decisão de produto) e limite de cadastro na borda.
- **M-06 · WhatsApp da conta sem verificação: reserva indevida de número e oráculo de existência.** `contas_conta` permite trocar `whatsapp_e164` livremente (`20261023120000:13`, `grant update`); a unicidade (IM-009) faz o erro 23505 revelar se um número já tem conta, e permite "reservar" o número de outra pessoa até a verificação (IM-010, futuro). Conhecido e coerente com os requisitos; registrar como risco aceito até o IM-010.
- **M-07 · RPCs públicas de busca sem limite de custo.** `busca_publica` (`20261029100000:140`), `busca_home_secoes`/`busca_home_secao_perfis` (varre membros com `contas_acesso_permitido` por linha) e `loja_listar_imoveis` são executáveis por anon e fazem varredura completa com `count(*) over ()`. Têm teto de página e de limite, mas não de custo por chamada. Mitigar com rate limiting na Cloudflare e cache; sem mudança de banco por ora.

## Achados baixos

- **B-01** Visões "definer" sem `security_barrier`: em tese, um predicado com erro dependente de dado poderia ser empurrado antes do filtro por `auth.uid()`. Pelo PostgREST não há expressão que provoque isso (sem cast em filtro). Defesa em profundidade: `alter view ... set (security_barrier = true)` nas 35, em migração futura, medindo desempenho.
- **B-02** `perfis_local_select_publico` (`20261102190000:78`) ignora `mostrar_mapa`: com a chave anon, a coordenada de um perfil que escondeu o mapa continua legível direto na tabela (o endereço em texto já é público na visão).
- **B-03** Ajudantes booleanos expostos: `perfis_perfil_disponivel(uuid)`, `catalogo_imagem_publica(text)` e `pontos_beneficio_no_prazo(uuid)` (anon) e `catalogo_imagem_em_uso(text)` (authenticated) servem de oráculo sobre ids e caminhos arbitrários (e `perfis_perfil_disponivel` revela indiretamente conta suspensa). Dado já derivável do público; risco mínimo. Revisados e travados na lista do teste novo.
- **B-04** SELECT de tabela inteira para anon em 6 tabelas (`catalogo_categoria`, `catalogo_item_versao`, `perfis_estilo_pagina`, `perfis_perfil_versao`, `pontos_beneficio`, `pontos_beneficio_versao`): coluna futura nasce pública. Hoje nenhuma coluna é privada. O teste novo trava a lista; ao adicionar coluna sensível, trocar por grant por coluna.
- **B-05** Dependência do privilégio padrão do Supabase: não há `alter default privileges`; toda função e tabela nova nasce aberta e depende de `revoke` manual. O teste novo cobre; o endurecimento definitivo (`alter default privileges ... revoke execute ... from anon, authenticated`) exige o papel dono e fica como sugestão.
- **B-06** Dono pode apagar imagem `adm-*` (banner do administrador) que não esteja em uso (já documentado em `20261103120000`).
- **B-07** Cota de 100 imagens conferida na política de insert, sem trava: envios simultâneos podem passar de 100 por pouco.
- **B-08** Conta suspensa ou anonimizada mantém JWT válido até expirar (banimento só impede renovação) e as políticas do Storage não consultam `contas_acesso_ativo`. Janela de no máximo a vida do token (1 h). Auditoria sem motivo na criação de categoria (`catalogo_criar_categoria`, só `valor_novo`).

## Verificações sem achado

- **Isolamento entre responsáveis, indicador e anunciante, cliente e administrador:** políticas e visões filtram por `auth.uid()`; funções que recebem uuid (`p_perfil`, `p_oferta`, `p_banner_id`, `p_pedido_id`) checam o dono antes de agir (`perfis_eh_dono`, `comissoes_exigir_responsavel`, `catalogo_eh_dono`). Oferta ou vínculo inexistente responde igual a "sem acesso".
- **Escalada por funções administrativas:** concessão de permissão só do administrador geral, com motivo; `suspender` não atinge administrador nem a si mesmo; permissão exige conta ativa (`contas_acesso_permitido`).
- **IM-029, IM-041, IM-050:** nenhuma visão para indicador, relacionamento ou notificações tem nome completo, WhatsApp, e-mail ou mensagem de visitante; nome mostrado ao responsável é "primeiro nome + inicial" (`relacionamento_nome_publico`); `indicador_ref` é hash opaco por responsável; o e-mail de notificação só leva destino e nome público (`indicacoes_notificacoes_pendentes`).
- **IM-065 e só-inserção:** pontos, comissões e relacionamento têm tabelas, saldos e leituras próprios; nenhuma função de um altera o outro.
- **Idempotência (IM-028, IM-064):** `unique(whatsapp, chave)` nos pedidos; um lançamento por pedido e uma reversão por original nos pontos; pagamento por (assinatura, competência), comissão por pagamento e reversão única nas comissões.
- **Auditoria (IM-086):** as 43 funções administrativas que escrevem gravam `administracao_auditoria` com autor, motivo e valor anterior na mesma função (mesma transação); a tabela é imutável por gatilho e só o administrador geral a lê.
- **Injeção:** sem SQL dinâmico com entrada de usuário; `LIKE` só com constantes; a busca usa `strpos` sobre texto normalizado.
- **Storage:** bucket privado, sem política de escrita para anon, `adm-*` reservado, caminhos opacos, leitura pública só de imagem aprovada e publicada.
- **Anonimização no encerramento:** conta, histórico de WhatsApp e `auth.users` são anonimizados após a carência; a exceção de imutabilidade do histórico vale só com a configuração local da transação, que a API não consegue definir.

## Precisa de decisão do Emerson

1. **Limites do pedido de contato (S-03):** confirmar ou ajustar 20 por link, 60 por destino e 1000 global por hora.
2. **Fechar o formulário público com CAPTCHA (S-03, M-01, M-03):** hoje a RPC é chamável direto com a chave anon, então Turnstile no app não a protege. A opção segura é revogar o EXECUTE de anon em `indicacoes_enviar_contato` e `administracao_denunciar` e chamá-las por uma ação do servidor (com Turnstile e limite por IP), usando `service_role` só nessa chamada. Custo: pequeno (Turnstile é gratuito); muda o desenho da D-014. Decidir se entra antes do lançamento.
3. **Teto de pontos por indicador (S-03):** regra de produto (por dia, por destino ou de validação do visitante) para o ganho de pontos não depender só do ritmo.
4. **WhatsApp pessoal do anunciante particular (M-01):** manter a entrega direta ao visitante após o formulário (IM-026) ou usar um número comercial/intermediário.
5. **Teto de perfis e itens por conta e religar "Confirm email" (M-05, D-011).**
6. **Retenção e exclusão de dados do visitante (M-04, IM-082):** depende da revisão jurídica.

## Dúvidas

- S-01: confirmar no dev, com a chave anon, se a listagem do Storage de fato devolve `owner_id` (o teste de integração `tests/integracao/storage-owner.test.ts` está parado por falta de contas de teste). A migração é inofensiva se não devolver.
- A migração `20261106100000` cria gatilho em `storage.objects`. O CI (pgTAP) a aplica em banco local; no projeto Supabase hospedado, confirmar no dev que o papel da migração tem permissão (as políticas em `storage.objects` já funcionam, o que indica que sim).

## Migrações novas (escritas, NÃO aplicadas; só dev e com aprovação, D-003)

- `supabase/migrations/20261106100000_seguranca_storage_sem_dono_sem_sobrescrita.sql` (S-01, S-02)
- `supabase/migrations/20261106110000_seguranca_indicacoes_limites_contato.sql` (S-03)

Tipos TypeScript: não regenerados, porque o schema remoto não mudou (migrações não aplicadas; o gatilho e os parâmetros não alteram tabelas nem funções chamáveis pelo app). Regenerar com `pnpm db:types` depois de aplicar no dev.
