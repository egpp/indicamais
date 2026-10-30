-- pgTAP · suspensão, reativação e encerramento de conta · Fase 6 · IM-080, IM-081, IM-077, IM-078, IM-086, D-014
-- Suspensa: sem acesso, perfis e itens fora do ar, sem contato novo, sem pontuar; pontos e histórico preservados; reativar NÃO
-- republica. Encerramento: confirmação no servidor, carência, desistência, anonimização idempotente preservando históricos.
begin;
select * from no_plan();
delete from public.catalogo_categoria;

-- A = responsável do perfil P1 e do anúncio I1 (será suspenso); O = responsável do perfil P2 (segue ativo); B = indicador
-- (será suspenso); X = quem encerra a conta (indicador e responsável do perfil P3); C = permissão suspender; D = administrador
-- geral; G = usuário comum.
insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@teste.local'),
  ('01010101-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'o@teste.local'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@teste.local'),
  ('eeeeeeee-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'x@teste.local'),
  ('cccccccc-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c@teste.local'),
  ('dddddddd-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd@teste.local'),
  ('99999999-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'g@teste.local');
insert into public.administracao_administrador (conta_id) values ('dddddddd-0000-0000-0000-00000000000d');
insert into public.administracao_permissao (conta_id, permissao, concedida_por, motivo) values
  ('cccccccc-0000-0000-0000-00000000000c', 'suspender', 'dddddddd-0000-0000-0000-00000000000d', 'teste');
update public.contas_conta set nome_exibicao = 'Alice Dona', whatsapp_e164 = '+5551999990001' where id = 'aaaaaaaa-0000-0000-0000-00000000000a';
update public.contas_conta set nome_exibicao = 'Beto Indicador', whatsapp_e164 = '+5551999990002' where id = 'bbbbbbbb-0000-0000-0000-00000000000b';
update public.contas_conta set nome_exibicao = 'Xavier Encerra', whatsapp_e164 = '+5551999990005' where id = 'eeeeeeee-0000-0000-0000-00000000000e';
insert into public.catalogo_categoria (id, nome, slug, ativa, ordem) values
  ('11111111-0000-0000-0000-000000000001', 'Alimentação', 'alimentacao', true, 1);

insert into public.perfis_perfil (id, responsavel_id, slug) values
  ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a', 'loja-um'),
  ('a0000000-0000-0000-0000-000000000002', '01010101-0000-0000-0000-000000000001', 'loja-dois'),
  ('a0000000-0000-0000-0000-000000000003', 'eeeeeeee-0000-0000-0000-00000000000e', 'loja-tres');
insert into public.perfis_perfil_versao (id, perfil_id, nome, descricao_breve, imagem_path, categoria_principal_id, cidade, uf) values
  ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Loja Um', 'Doces', 'perfil/a0000000-0000-0000-0000-000000000001/c.jpg', '11111111-0000-0000-0000-000000000001', 'Porto Alegre', 'RS'),
  ('a1000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'Loja Dois', 'Doces', 'perfil/a0000000-0000-0000-0000-000000000002/c.jpg', '11111111-0000-0000-0000-000000000001', 'Canoas', 'RS'),
  ('a1000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', 'Loja Três', 'Doces', 'perfil/a0000000-0000-0000-0000-000000000003/c.jpg', '11111111-0000-0000-0000-000000000001', 'Gravataí', 'RS');
insert into public.perfis_perfil_versao_contato (versao_id, whatsapp_comercial_e164) values
  ('a1000000-0000-0000-0000-000000000001', '+5551988880001'),
  ('a1000000-0000-0000-0000-000000000002', '+5551988880002'),
  ('a1000000-0000-0000-0000-000000000003', '+5551988880003');
update public.perfis_perfil_versao set situacao = 'pendente', enviada_em = now() where perfil_id in
  ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003');
update public.perfis_perfil_versao set situacao = 'aprovada' where perfil_id in
  ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003');
update public.perfis_perfil set versao_aprovada_id = 'a1000000-0000-0000-0000-000000000001', publicado = true where id = 'a0000000-0000-0000-0000-000000000001';
update public.perfis_perfil set versao_aprovada_id = 'a1000000-0000-0000-0000-000000000002', publicado = true where id = 'a0000000-0000-0000-0000-000000000002';
update public.perfis_perfil set versao_aprovada_id = 'a1000000-0000-0000-0000-000000000003', publicado = true where id = 'a0000000-0000-0000-0000-000000000003';

insert into public.catalogo_item (id, conta_id, perfil_id, tipo) values
  ('e0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a', null, 'produto');
insert into public.catalogo_item_versao (id, item_id, situacao, enviada_em, nome, descricao, foto_path, categoria_principal_id, cidade, uf) values
  ('e1000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'aprovada', now(), 'Bolo', 'Bolo', 'item/e0000000-0000-0000-0000-000000000001/a.jpg', '11111111-0000-0000-0000-000000000001', 'Porto Alegre', 'RS');
update public.catalogo_item set versao_aprovada_id = 'e1000000-0000-0000-0000-000000000001', publicado = true where id = 'e0000000-0000-0000-0000-000000000001';

-- ===== Estrutura =====
select is((select bool_and(relrowsecurity and relforcerowsecurity) from pg_class where oid = any(array[
  'public.contas_ciclo_vida'::regclass, 'public.contas_ciclo_vida_evento'::regclass, 'public.contas_parametro'::regclass])), true, 'RLS ativa e forçada nas três tabelas');
select is((select count(*)::int from pg_policies where schemaname = 'public'
  and tablename in ('contas_ciclo_vida', 'contas_ciclo_vida_evento', 'contas_parametro')), 12, 'quatro políticas por tabela');
select is((select bool_or(has_table_privilege(r, t, p))
  from unnest(array['anon', 'authenticated']) r,
  unnest(array['public.contas_ciclo_vida', 'public.contas_ciclo_vida_evento', 'public.contas_parametro']) t,
  unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) p), false, 'nenhum privilégio direto nas tabelas do ciclo de vida');
select is(has_function_privilege('anon', 'public.contas_solicitar_encerramento(text)', 'EXECUTE')
  or has_function_privilege('anon', 'public.contas_meu_estado()', 'EXECUTE')
  or has_function_privilege('anon', 'public.administracao_suspender_conta(uuid,text)', 'EXECUTE')
  or has_function_privilege('authenticated', 'public.contas_executar_encerramentos(integer)', 'EXECUTE')
  or has_function_privilege('authenticated', 'public.contas_anonimizar(uuid)', 'EXECUTE'), false, 'anon e authenticated não executam o que não devem');
select is(has_function_privilege('service_role', 'public.contas_executar_encerramentos(integer)', 'EXECUTE'), true, 'service_role executa a rotina de encerramento');
select is((select valor from public.contas_parametro where chave = 'encerramento_carencia_dias'), 30, 'carência padrão de 30 dias, em parâmetro');
select columns_are('public', 'administracao_contas_ciclo_vida',
  array['conta_id', 'situacao', 'suspensa_em', 'encerramento_solicitado_em', 'encerramento_executar_apos', 'anonimizada_em', 'atualizado_em'],
  'a visão de contas fora do normal não traz nome, telefone nem e-mail');

-- ===== Baseline: B e X pontuam com links do perfil P2 =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select lives_ok($$select * from public.indicacoes_gerar_link(p_perfil_id => 'a0000000-0000-0000-0000-000000000002')$$, 'B gera link de P2');
select set_config('t.cod_b', (select codigo from public.indicacoes_meus_links where destino_id = 'a0000000-0000-0000-0000-000000000002'), true);
select is(public.contas_pode_indicar(), true, 'B pode indicar enquanto ativo');
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-0000-0000-00000000000e","role":"authenticated"}', true);
select lives_ok($$select * from public.indicacoes_gerar_link(p_perfil_id => 'a0000000-0000-0000-0000-000000000002')$$, 'X gera link de P2');
select set_config('t.cod_x', (select codigo from public.indicacoes_meus_links where destino_id = 'a0000000-0000-0000-0000-000000000002'), true);
reset role;

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select lives_ok($$select * from public.indicacoes_enviar_contato(p_perfil_id => 'a0000000-0000-0000-0000-000000000002', p_item_id => null,
  p_nome => 'Visitante Um', p_whatsapp => '+5511988880001', p_chave => 'chave-ciclo-0000001', p_codigo => current_setting('t.cod_x'))$$, 'contato 1 pelo link de X');
select lives_ok($$select * from public.indicacoes_enviar_contato(p_perfil_id => 'a0000000-0000-0000-0000-000000000002', p_item_id => null,
  p_nome => 'Visitante Dois', p_whatsapp => '+5511988880002', p_chave => 'chave-ciclo-0000002', p_codigo => current_setting('t.cod_b'))$$, 'contato 2 pelo link de B');
reset role;
select is((select count(*)::int from public.pontos_lancamento), 2, 'baseline: X e B têm 10 pontos cada');
select set_config('t.auditoria_antes', (select count(*)::text from public.administracao_auditoria), true);

-- ===== Suspender: quem pode e quem não pode =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"99999999-0000-0000-0000-000000000009","role":"authenticated"}', true);
select throws_ok($$select public.administracao_suspender_conta('aaaaaaaa-0000-0000-0000-00000000000a', 'tentativa')$$, '42501', null, 'usuário comum não suspende');
select is((select count(*)::int from public.administracao_contas_ciclo_vida), 0, 'usuário comum não vê contas fora do normal');
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select throws_ok($$select public.administracao_suspender_conta('aaaaaaaa-0000-0000-0000-00000000000a', '')$$, '22023', null, 'suspender exige motivo');
select throws_ok($$select public.administracao_suspender_conta(gen_random_uuid(), 'x')$$, 'P0002', null, 'conta inexistente');
select throws_ok($$select public.administracao_suspender_conta('dddddddd-0000-0000-0000-00000000000d', 'x')$$, '42501', null, 'administrador geral não é suspenso por esta função');
select throws_ok($$select public.administracao_suspender_conta('cccccccc-0000-0000-0000-00000000000c', 'x')$$, '42501', null, 'ninguém suspende a si mesmo');
select throws_ok($$select public.administracao_reativar_conta('01010101-0000-0000-0000-000000000001', 'x')$$, 'P0001', null, 'não reativa conta que não está suspensa');
select lives_ok($$select public.administracao_suspender_conta('aaaaaaaa-0000-0000-0000-00000000000a', 'Denúncia confirmada de fraude')$$, 'C (suspender) suspende A');
select lives_ok($$select public.administracao_suspender_conta('aaaaaaaa-0000-0000-0000-00000000000a', 'repetida')$$, 'suspender de novo é idempotente');
reset role;

select is((select situacao from public.contas_ciclo_vida where conta_id = 'aaaaaaaa-0000-0000-0000-00000000000a'), 'suspensa', 'A está suspensa');
select is((select publicado from public.perfis_perfil where id = 'a0000000-0000-0000-0000-000000000001'), false, 'perfil de A saiu do ar');
select is((select publicado from public.catalogo_item where id = 'e0000000-0000-0000-0000-000000000001'), false, 'anúncio de A saiu do ar');
select is((select count(*)::int from public.administracao_auditoria where acao = 'suspender_conta' and alvo_id = 'aaaaaaaa-0000-0000-0000-00000000000a'
  and autor_id = 'cccccccc-0000-0000-0000-00000000000c' and motivo = 'Denúncia confirmada de fraude'
  and valor_anterior ->> 'situacao' = 'ativa' and valor_novo ->> 'situacao' = 'suspensa'
  and valor_novo -> 'perfis_despublicados' @> '["a0000000-0000-0000-0000-000000000001"]'::jsonb), 1, 'auditoria: autor, motivo, valor anterior e perfis despublicados (uma só vez)');
select is((select count(*)::int from public.contas_ciclo_vida_evento where conta_id = 'aaaaaaaa-0000-0000-0000-00000000000a' and evento = 'suspensa'), 1, 'evento de suspensão registrado uma vez');

-- Catálogo, busca e contato
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.perfis_perfil_publico where id = 'a0000000-0000-0000-0000-000000000001'), 0, 'perfil suspenso sai do catálogo público');
select is((select count(*)::int from public.catalogo_item_publico where id = 'e0000000-0000-0000-0000-000000000001'), 0, 'anúncio suspenso sai do catálogo público');
select is((select count(*)::int from public.perfis_perfil_publico where id = 'a0000000-0000-0000-0000-000000000002'), 1, 'perfil de outra conta segue no ar');
select is(public.perfis_perfil_disponivel('a0000000-0000-0000-0000-000000000001'), false, 'perfil suspenso não está disponível');
select throws_ok($$select * from public.indicacoes_enviar_contato(p_perfil_id => 'a0000000-0000-0000-0000-000000000001', p_item_id => null,
  p_nome => 'Visitante Tres', p_whatsapp => '+5511988880003', p_chave => 'chave-ciclo-0000003')$$, 'P0002', null, 'conta suspensa não recebe pedido de contato');
reset role;

-- Acesso: flag para o proxy, sem publicar, sem escrever
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is((select o_situacao from public.contas_meu_estado()), 'suspensa', 'o proxy lê a situação da conta suspensa');
select is((select o_acesso_permitido from public.contas_meu_estado()), false, 'o proxy lê acesso_permitido = false');
select is(public.contas_pode_indicar(), false, 'conta suspensa não gera link');
update public.contas_conta set nome_exibicao = 'Tentativa de edição' where id = 'aaaaaaaa-0000-0000-0000-00000000000a';
select throws_ok($$insert into public.perfis_perfil_versao (perfil_id) values ('a0000000-0000-0000-0000-000000000001')$$, '42501', null, 'conta suspensa não grava versões de perfil');
select set_config('request.jwt.claims', '{"sub":"99999999-0000-0000-0000-000000000009","role":"authenticated"}', true);
select is((select o_situacao from public.contas_meu_estado()), 'ativa', 'conta comum: ativa');
select is((select o_acesso_permitido from public.contas_meu_estado()), true, 'conta comum: acesso permitido');
reset role;
select is((select nome_exibicao from public.contas_conta where id = 'aaaaaaaa-0000-0000-0000-00000000000a'), 'Alice Dona', 'conta suspensa não altera o próprio cadastro');
select throws_ok($$update public.perfis_perfil set publicado = true where id = 'a0000000-0000-0000-0000-000000000001'$$, '42501', null, 'o banco impede republicar enquanto suspensa (qualquer papel)');
select throws_ok($$update public.catalogo_item set publicado = true where id = 'e0000000-0000-0000-0000-000000000001'$$, '42501', null, 'idem para o anúncio');

-- ===== Indicador suspenso: histórico preservado, sem pontuar =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select lives_ok($$select public.administracao_suspender_conta('bbbbbbbb-0000-0000-0000-00000000000b', 'Spam de indicações')$$, 'C suspende o indicador B');
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select lives_ok($$select * from public.indicacoes_enviar_contato(p_perfil_id => 'a0000000-0000-0000-0000-000000000002', p_item_id => null,
  p_nome => 'Visitante Quatro', p_whatsapp => '+5511988880004', p_chave => 'chave-ciclo-0000004', p_codigo => current_setting('t.cod_b'))$$, 'o visitante contata normalmente pelo link do indicador suspenso');
reset role;
select is((select link_id from public.indicacoes_pedido_contato where whatsapp_e164 = '+5511988880004'), null, 'o pedido entra sem atribuição');
select is((select motivo from public.pontos_decisao d join public.indicacoes_pedido_contato p on p.id = d.pedido_id where p.whatsapp_e164 = '+5511988880004'), 'sem_atribuicao', 'e não pontua');
select is((select count(*)::int from public.pontos_lancamento where indicador_id = 'bbbbbbbb-0000-0000-0000-00000000000b'), 1, 'pontos de B preservados e sem crédito novo');
select is((select count(*)::int from public.indicacoes_pedido_contato where perfil_id = 'a0000000-0000-0000-0000-000000000002'), 3, 'o responsável de P2 recebeu os três pedidos');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((select saldo from public.pontos_meu_saldo), 10, 'o histórico de pontos de B continua guardado');
select throws_ok($$select * from public.indicacoes_gerar_link(p_perfil_id => 'a0000000-0000-0000-0000-000000000003')$$, 'P0412', null, 'indicador suspenso não gera link novo');
reset role;

-- ===== Permissão de quem é suspenso =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select lives_ok($$select public.administracao_suspender_conta('cccccccc-0000-0000-0000-00000000000c', 'Revisão interna')$$, 'administrador geral suspende o analista C');
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select throws_ok($$select public.administracao_reativar_conta('aaaaaaaa-0000-0000-0000-00000000000a', 'x')$$, '42501', null, 'conta suspensa perde as permissões administrativas');
select is((select count(*)::int from public.administracao_minhas_permissoes), 0, 'e não lista permissões');
select throws_ok($$select public.administracao_denunciar('perfil', 'a0000000-0000-0000-0000-000000000002', 'spam_fraude')$$, '42501', null, 'conta suspensa não denuncia');
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select lives_ok($$select public.administracao_reativar_conta('cccccccc-0000-0000-0000-00000000000c', 'Revisão concluída')$$, 'administrador geral reativa C');
select is((select count(*)::int from public.administracao_contas_ciclo_vida), 2, 'administrador geral lista A e B como suspensas');
reset role;

-- ===== Reativar NÃO republica =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select throws_ok($$select public.administracao_reativar_conta('aaaaaaaa-0000-0000-0000-00000000000a', '')$$, '22023', null, 'reativar exige motivo');
select lives_ok($$select public.administracao_reativar_conta('aaaaaaaa-0000-0000-0000-00000000000a', 'Recurso aceito')$$, 'C reativa A');
reset role;
select is((select situacao from public.contas_ciclo_vida where conta_id = 'aaaaaaaa-0000-0000-0000-00000000000a'), 'ativa', 'A voltou a ativa');
select is((select publicado from public.perfis_perfil where id = 'a0000000-0000-0000-0000-000000000001'), false, 'o perfil continua despublicado');
select is((select publicado from public.catalogo_item where id = 'e0000000-0000-0000-0000-000000000001'), false, 'o anúncio continua despublicado');
select is(public.perfis_perfil_disponivel('a0000000-0000-0000-0000-000000000001'), false, 'sem republicar, o perfil segue indisponível');
select is((select count(*)::int from public.administracao_auditoria where acao = 'reativar_conta' and alvo_id = 'aaaaaaaa-0000-0000-0000-00000000000a'
  and motivo = 'Recurso aceito' and valor_anterior ->> 'situacao' = 'suspensa'
  and (valor_novo ->> 'republicado_automaticamente')::boolean = false), 1, 'reativação auditada (autor, motivo, valor anterior)');
select lives_ok($$update public.perfis_perfil set publicado = true where id = 'a0000000-0000-0000-0000-000000000001'$$, 'o responsável republica por conta própria depois de reativado');
select is(public.perfis_perfil_disponivel('a0000000-0000-0000-0000-000000000001'), true, 'e o perfil volta a ficar disponível');

-- ===== Encerramento: confirmação, carência e desistência =====
set local role anon;
select throws_ok($$select public.contas_solicitar_encerramento('ENCERRAR')$$, '42501', null, 'anônimo não encerra conta');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select throws_ok($$select public.contas_solicitar_encerramento('ENCERRAR')$$, 'P0001', null, 'administrador geral não encerra por esta função');
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-0000-0000-00000000000e","role":"authenticated"}', true);
select throws_ok($$select public.contas_solicitar_encerramento('sim')$$, '22023', null, 'palavra errada é recusada no servidor');
select throws_ok($$select public.contas_solicitar_encerramento('')$$, '22023', null, 'confirmação vazia é recusada');
select throws_ok($$select public.contas_cancelar_encerramento()$$, 'P0001', null, 'sem encerramento solicitado não há o que cancelar');
select lives_ok($$select public.contas_solicitar_encerramento(' encerrar ')$$, 'X confirma digitando a palavra');
select is((select o_situacao from public.contas_meu_estado()), 'encerramento_solicitado', 'situação: encerramento solicitado');
select is((select o_acesso_permitido from public.contas_meu_estado()), true, 'na carência a pessoa ainda entra (para poder desistir)');
select ok((select o_encerramento_executar_apos from public.contas_meu_estado()) between now() + interval '29 days' and now() + interval '31 days', 'execução prevista em cerca de 30 dias');
select lives_ok($$select public.contas_solicitar_encerramento('ENCERRAR')$$, 'pedir de novo é idempotente');
reset role;
select is((select count(*)::int from public.contas_ciclo_vida_evento where conta_id = 'eeeeeeee-0000-0000-0000-00000000000e' and evento = 'encerramento_solicitado'), 1, 'um só evento de solicitação');
select is((select publicado from public.perfis_perfil where id = 'a0000000-0000-0000-0000-000000000003'), false, 'o perfil de X foi despublicado na hora');
select is((select responsavel_id from public.perfis_perfil where id = 'a0000000-0000-0000-0000-000000000003'), 'eeeeeeee-0000-0000-0000-00000000000e'::uuid, 'sem transferência de perfil');
select throws_ok($$update public.perfis_perfil set publicado = true where id = 'a0000000-0000-0000-0000-000000000003'$$, '42501', null, 'em carência não se republica');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-0000-0000-00000000000e","role":"authenticated"}', true);
select lives_ok($$select public.contas_cancelar_encerramento()$$, 'X desiste dentro da carência');
select is((select o_situacao from public.contas_meu_estado()), 'ativa', 'conta ativa de novo');
reset role;
select is((select publicado from public.perfis_perfil where id = 'a0000000-0000-0000-0000-000000000003'), false, 'desistir não republica o perfil');
select lives_ok($$update public.perfis_perfil set publicado = true where id = 'a0000000-0000-0000-0000-000000000003'$$, 'depois de desistir, X pode republicar');

-- Pede de novo e antecipa a data para a rotina.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-0000-0000-00000000000e","role":"authenticated"}', true);
select lives_ok($$select public.contas_solicitar_encerramento('ENCERRAR')$$, 'X pede o encerramento outra vez');
select throws_ok($$select public.contas_executar_encerramentos(10)$$, '42501', null, 'a rotina não é chamável pelo cliente');
reset role;

set local role service_role;
select is(public.contas_executar_encerramentos(10), 0, 'antes do fim da carência a rotina não anonimiza ninguém');
reset role;
select is((select situacao from public.contas_ciclo_vida where conta_id = 'eeeeeeee-0000-0000-0000-00000000000e'), 'encerramento_solicitado', 'X segue em carência');

-- ===== Anonimização =====
update public.contas_ciclo_vida set encerramento_executar_apos = now() - interval '1 minute' where conta_id = 'eeeeeeee-0000-0000-0000-00000000000e';
select set_config('t.auditoria_antes', (select count(*)::text from public.administracao_auditoria), true);
set local role service_role;
select is(public.contas_executar_encerramentos(10), 1, 'a rotina anonimiza a conta com carência vencida');
select is(public.contas_executar_encerramentos(10), 0, 'rodar de novo não faz nada (idempotente)');
reset role;
select is((select situacao from public.contas_ciclo_vida where conta_id = 'eeeeeeee-0000-0000-0000-00000000000e'), 'anonimizada', 'conta anonimizada');
select is((select nome_exibicao from public.contas_conta where id = 'eeeeeeee-0000-0000-0000-00000000000e'), null, 'nome apagado');
select is((select whatsapp_e164 from public.contas_conta where id = 'eeeeeeee-0000-0000-0000-00000000000e'), null, 'WhatsApp apagado');
select is((select count(*)::int from public.contas_whatsapp_historico where conta_id = 'eeeeeeee-0000-0000-0000-00000000000e'
  and (whatsapp_anterior_e164 is not null or whatsapp_novo_e164 is not null)), 0, 'histórico de WhatsApp sem nenhum número');
select ok((select count(*)::int from public.contas_whatsapp_historico where conta_id = 'eeeeeeee-0000-0000-0000-00000000000e') >= 1, 'as linhas do histórico foram preservadas');
select is((select email from auth.users where id = 'eeeeeeee-0000-0000-0000-00000000000e'), 'anonimizado+eeeeeeee-0000-0000-0000-00000000000e@anonimizado.invalid', 'e-mail do Auth anonimizado');
select is((select banned_until from auth.users where id = 'eeeeeeee-0000-0000-0000-00000000000e'), 'infinity'::timestamptz, 'usuário do Auth banido');
select is((select count(*)::int from public.contas_conta where id = 'eeeeeeee-0000-0000-0000-00000000000e'), 1, 'a linha da conta não é apagada');
select is((select count(*)::int from public.pontos_lancamento where indicador_id = 'eeeeeeee-0000-0000-0000-00000000000e'), 1, 'lançamentos de pontos preservados');
select is((select count(*)::int from public.indicacoes_pedido_contato), 3, 'pedidos preservados');
select is((select count(*)::int from public.administracao_auditoria)::text, current_setting('t.auditoria_antes'), 'auditoria preservada, sem linhas apagadas');
select is((select responsavel_id from public.perfis_perfil where id = 'a0000000-0000-0000-0000-000000000003'), 'eeeeeeee-0000-0000-0000-00000000000e'::uuid, 'perfil não foi transferido');
select is((select publicado from public.perfis_perfil where id = 'a0000000-0000-0000-0000-000000000003'), false, 'perfil segue despublicado');
select is((select count(*)::int from public.contas_ciclo_vida_evento where conta_id = 'eeeeeeee-0000-0000-0000-00000000000e' and evento = 'anonimizada'), 1, 'evento de anonimização registrado uma vez');
select throws_ok($$update public.contas_whatsapp_historico set whatsapp_novo_e164 = null$$, '42501', null, 'fora da anonimização, o histórico de WhatsApp volta a ser só de inserção');
select throws_ok($$delete from public.contas_whatsapp_historico$$, '42501', null, 'e nunca é apagado');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-0000-0000-00000000000e","role":"authenticated"}', true);
select is((select o_acesso_permitido from public.contas_meu_estado()), false, 'conta anonimizada não tem acesso');
reset role;

select * from finish();
rollback;
