-- pgTAP · módulo indicacoes (link, atribuição, pedido de contato, notificação) · Fase 3
-- IM-013, IM-024, IM-025, IM-026, IM-027, IM-028, IM-029, IM-041, IM-044 (só registro), IM-050, IM-079, IM-086
begin;
select * from no_plan();
delete from public.catalogo_categoria;

-- Contas: A (responsável do perfil P1 e do item I2), B (anunciante particular), C e F (indicadores com WhatsApp),
-- E (indicador sem WhatsApp), D (administrador).
insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@teste.local'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@teste.local'),
  ('cccccccc-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c@teste.local'),
  ('dddddddd-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd@teste.local'),
  ('eeeeeeee-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'e@teste.local'),
  ('ffffffff-0000-0000-0000-00000000000f', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'f@teste.local');
insert into public.administracao_administrador (conta_id) values ('dddddddd-0000-0000-0000-00000000000d');
update public.contas_conta set whatsapp_e164 = '+5551999990001' where id = 'aaaaaaaa-0000-0000-0000-00000000000a';
update public.contas_conta set whatsapp_e164 = '+5551999990002' where id = 'bbbbbbbb-0000-0000-0000-00000000000b';
update public.contas_conta set whatsapp_e164 = '+5511999990003' where id = 'cccccccc-0000-0000-0000-00000000000c';
update public.contas_conta set whatsapp_e164 = '+5511999990004' where id = 'ffffffff-0000-0000-0000-00000000000f';
insert into public.catalogo_categoria (id, nome, slug, ativa, ordem) values
  ('11111111-0000-0000-0000-000000000001', 'Alimentação', 'alimentacao', true, 1);

-- Perfis de A: P1 aprovado e publicado; P2 aprovado e despublicado; P3 só rascunho.
insert into public.perfis_perfil (id, responsavel_id, slug) values
  ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a', 'loja-um'),
  ('a0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-00000000000a', 'loja-dois'),
  ('a0000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-00000000000a', 'loja-tres');
insert into public.perfis_perfil_versao (id, perfil_id, nome, descricao_breve, imagem_path, categoria_principal_id, cidade, uf) values
  ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Loja Um', 'Doces', 'perfil/a0000000-0000-0000-0000-000000000001/c.jpg', '11111111-0000-0000-0000-000000000001', 'Porto Alegre', 'RS'),
  ('a1000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'Loja Dois', 'Doces', 'perfil/a0000000-0000-0000-0000-000000000002/c.jpg', '11111111-0000-0000-0000-000000000001', 'Canoas', 'RS');
insert into public.perfis_perfil_versao_contato (versao_id, whatsapp_comercial_e164) values
  ('a1000000-0000-0000-0000-000000000001', '+5551988880001'),
  ('a1000000-0000-0000-0000-000000000002', '+5551988880002');
update public.perfis_perfil_versao set situacao = 'pendente', enviada_em = now() where id in ('a1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002');
update public.perfis_perfil_versao set situacao = 'aprovada' where id in ('a1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002');
insert into public.perfis_perfil_versao (id, perfil_id, nome) values ('a1000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', 'Loja Três');
update public.perfis_perfil set versao_aprovada_id = 'a1000000-0000-0000-0000-000000000001', publicado = true where id = 'a0000000-0000-0000-0000-000000000001';
update public.perfis_perfil set versao_aprovada_id = 'a1000000-0000-0000-0000-000000000002', publicado = false where id = 'a0000000-0000-0000-0000-000000000002';

-- Itens: I1 e I4 particulares de B publicados; I2 item do perfil P1 (dono A); I3 particular de B despublicado.
insert into public.catalogo_item (id, conta_id, perfil_id, tipo) values
  ('e0000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-00000000000b', null, 'produto'),
  ('e0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000001', 'servico'),
  ('e0000000-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-00000000000b', null, 'produto'),
  ('e0000000-0000-0000-0000-000000000004', 'bbbbbbbb-0000-0000-0000-00000000000b', null, 'produto');
insert into public.catalogo_item_versao (id, item_id, situacao, enviada_em, nome, descricao, foto_path, categoria_principal_id, cidade, uf) values
  ('e1000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'aprovada', now(), 'Bolo', 'Bolo', 'item/e0000000-0000-0000-0000-000000000001/a.jpg', '11111111-0000-0000-0000-000000000001', 'Porto Alegre', 'RS'),
  ('e1000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000002', 'aprovada', now(), 'Entrega', 'Entrega', 'item/e0000000-0000-0000-0000-000000000002/a.jpg', '11111111-0000-0000-0000-000000000001', null, null),
  ('e1000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000003', 'aprovada', now(), 'Bike', 'Bike', 'item/e0000000-0000-0000-0000-000000000003/a.jpg', '11111111-0000-0000-0000-000000000001', 'Canoas', 'RS'),
  ('e1000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000004', 'aprovada', now(), 'Torta', 'Torta', 'item/e0000000-0000-0000-0000-000000000004/a.jpg', '11111111-0000-0000-0000-000000000001', 'Canoas', 'RS');
update public.catalogo_item set versao_aprovada_id = 'e1000000-0000-0000-0000-000000000001', publicado = true where id = 'e0000000-0000-0000-0000-000000000001';
update public.catalogo_item set versao_aprovada_id = 'e1000000-0000-0000-0000-000000000002', publicado = true where id = 'e0000000-0000-0000-0000-000000000002';
update public.catalogo_item set versao_aprovada_id = 'e1000000-0000-0000-0000-000000000003', publicado = false where id = 'e0000000-0000-0000-0000-000000000003';
update public.catalogo_item set versao_aprovada_id = 'e1000000-0000-0000-0000-000000000004', publicado = true where id = 'e0000000-0000-0000-0000-000000000004';

-- ===== Estrutura: RLS forçada, anon sem acesso direto, sem privilégio de tabela indevido =====
select is((select bool_and(relrowsecurity and relforcerowsecurity) from pg_class where oid = any(array[
  'public.indicacoes_parametro'::regclass, 'public.indicacoes_link'::regclass, 'public.indicacoes_pedido_contato'::regclass,
  'public.indicacoes_notificacao'::regclass, 'public.indicacoes_notificacao_historico'::regclass, 'public.indicacoes_evento'::regclass])),
  true, 'RLS ativa e forçada nas 6 tabelas do módulo');
select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename like 'indicacoes\_%'), 24, '4 políticas (select, insert, update, delete) por tabela');
select is((select bool_or(has_table_privilege('anon', t, p))
  from unnest(array['public.indicacoes_parametro', 'public.indicacoes_link', 'public.indicacoes_pedido_contato',
    'public.indicacoes_notificacao', 'public.indicacoes_notificacao_historico', 'public.indicacoes_evento']) t,
  unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) p), false, 'anon sem nenhum privilégio nas tabelas');
select is((select bool_or(has_table_privilege('authenticated', t, p))
  from unnest(array['public.indicacoes_link', 'public.indicacoes_pedido_contato', 'public.indicacoes_notificacao',
    'public.indicacoes_notificacao_historico']) t, unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) p),
  false, 'authenticated sem privilégio direto em link, pedido, notificação e histórico');
select is((select bool_or(has_table_privilege('authenticated', t, p))
  from unnest(array['public.indicacoes_parametro', 'public.indicacoes_evento']) t,
  unnest(array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) p), false, 'authenticated só lê parâmetro e evento (e só o administrador passa na política)');
select is((select bool_or(has_table_privilege(r, v, p))
  from unnest(array['anon', 'authenticated']) r,
  unnest(array['public.indicacoes_meus_pedidos', 'public.indicacoes_minhas_indicacoes', 'public.indicacoes_meus_links', 'public.administracao_fila_contatos']) v,
  unnest(array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) p), false, 'visões sem escrita');
select is(has_table_privilege('anon', 'public.indicacoes_minhas_indicacoes', 'SELECT')
  or has_table_privilege('anon', 'public.indicacoes_meus_pedidos', 'SELECT')
  or has_table_privilege('anon', 'public.administracao_fila_contatos', 'SELECT')
  or has_table_privilege('anon', 'public.indicacoes_meus_links', 'SELECT'), false, 'anon não lê nenhuma visão');
select columns_are('public', 'indicacoes_minhas_indicacoes', array['id', 'destino_tipo', 'destino_id', 'destino_nome', 'criado_em', 'status'],
  'a visão do indicador não tem nome, WhatsApp, e-mail nem mensagem do visitante');
select columns_are('public', 'indicacoes_meus_links', array['id', 'codigo', 'destino_tipo', 'destino_id', 'destino_nome', 'disponivel', 'criado_em'],
  'a visão de links não traz id de conta');
select columns_are('public', 'indicacoes_meus_pedidos', array['id', 'destino_tipo', 'destino_id', 'destino_nome', 'nome', 'whatsapp_e164', 'email', 'mensagem', 'criado_em', 'veio_por_indicacao', 'notificacao_estado'],
  'a visão do responsável traz o que o IM-027 pede e nenhum id de conta');
select is(has_function_privilege('anon', 'public.indicacoes_enviar_contato(uuid,uuid,text,text,text,text,text,text)', 'EXECUTE'), true, 'visitante anônimo pode enviar pedido pelo RPC');
select is(has_function_privilege('anon', 'public.indicacoes_gerar_link(uuid,uuid)', 'EXECUTE'), false, 'anon não gera link');
select is(has_function_privilege('anon', 'public.indicacoes_solicitar_reenvio(uuid,text)', 'EXECUTE')
  or has_function_privilege('anon', 'public.indicacoes_tratar_alerta(uuid,text)', 'EXECUTE')
  or has_function_privilege('anon', 'public.indicacoes_definir_parametro(text,integer,text)', 'EXECUTE')
  or has_function_privilege('anon', 'public.indicacoes_registrar_compartilhamento(text,text)', 'EXECUTE'), false, 'anon não executa ações de usuário nem de administrador');
select is(has_function_privilege('authenticated', 'public.indicacoes_notificacoes_pendentes(integer)', 'EXECUTE')
  or has_function_privilege('authenticated', 'public.indicacoes_notificacao_registrar(uuid,boolean,text)', 'EXECUTE')
  or has_function_privilege('authenticated', 'public.indicacoes_resolver_destino(uuid,uuid)', 'EXECUTE')
  or has_function_privilege('anon', 'public.indicacoes_notificacoes_pendentes(integer)', 'EXECUTE'), false, 'funções do servidor e internas não são chamáveis por anon nem authenticated');
select is(has_function_privilege('service_role', 'public.indicacoes_notificacoes_pendentes(integer)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.indicacoes_notificacao_registrar(uuid,boolean,text)', 'EXECUTE'), true, 'service_role executa as funções do servidor');
select is((select proargnames from pg_proc where oid = 'public.indicacoes_notificacoes_pendentes(integer)'::regprocedure),
  array['p_limite', 'o_pedido_id', 'o_email_responsavel', 'o_destino_tipo', 'o_destino_nome', 'o_tentativas'],
  'a notificação recebe só id, e-mail do responsável, tipo/nome do destino e tentativas (nada do visitante)');

-- ===== Link: indicador sem WhatsApp, anônimo e autoindicação =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-0000-0000-00000000000e","role":"authenticated"}', true);
select throws_ok($$select * from public.indicacoes_gerar_link(p_perfil_id => 'a0000000-0000-0000-0000-000000000001')$$, 'P0412', null, 'indicador sem WhatsApp não gera link');

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok($$select * from public.indicacoes_gerar_link(p_perfil_id => 'a0000000-0000-0000-0000-000000000001')$$, 'P0403', null, 'dono do perfil não gera link para o próprio perfil');
select throws_ok($$select * from public.indicacoes_gerar_link(p_item_id => 'e0000000-0000-0000-0000-000000000002')$$, 'P0403', null, 'responsável do perfil não gera link para item do próprio perfil');
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select throws_ok($$select * from public.indicacoes_gerar_link(p_item_id => 'e0000000-0000-0000-0000-000000000001')$$, 'P0403', null, 'anunciante não gera link para o próprio anúncio');
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$select * from public.indicacoes_gerar_link(p_perfil_id => 'a0000000-0000-0000-0000-000000000001')$$, '42501', null, 'anônimo não gera link');
reset role;

-- ===== Link: geração, idempotência e destinos indisponíveis =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select set_config('t.cod_c_p1', (select o_codigo from public.indicacoes_gerar_link(p_perfil_id => 'a0000000-0000-0000-0000-000000000001')), true);
select matches(current_setting('t.cod_c_p1'), '^[0-9a-f]{32}$', 'código opaco de 32 hex');
select is((select o_novo from public.indicacoes_gerar_link(p_perfil_id => 'a0000000-0000-0000-0000-000000000001')), false, 'gerar de novo não cria outro link');
select is((select o_codigo from public.indicacoes_gerar_link(p_perfil_id => 'a0000000-0000-0000-0000-000000000001')), current_setting('t.cod_c_p1'), 'gerar de novo devolve o mesmo código');
select set_config('t.cod_c_i1', (select o_codigo from public.indicacoes_gerar_link(p_item_id => 'e0000000-0000-0000-0000-000000000001')), true);
select isnt(current_setting('t.cod_c_i1'), current_setting('t.cod_c_p1'), 'destino diferente, código diferente');
select set_config('t.cod_c_i2', (select o_codigo from public.indicacoes_gerar_link(p_item_id => 'e0000000-0000-0000-0000-000000000002')), true);
select throws_ok($$select * from public.indicacoes_gerar_link(p_perfil_id => 'a0000000-0000-0000-0000-000000000002')$$, 'P0002', null, 'perfil despublicado recusa link');
select throws_ok($$select * from public.indicacoes_gerar_link(p_perfil_id => 'a0000000-0000-0000-0000-000000000003')$$, 'P0002', null, 'perfil sem versão aprovada recusa link');
select throws_ok($$select * from public.indicacoes_gerar_link(p_item_id => 'e0000000-0000-0000-0000-000000000003')$$, 'P0002', null, 'item despublicado recusa link');
select throws_ok($$select * from public.indicacoes_gerar_link(p_item_id => gen_random_uuid())$$, 'P0002', null, 'item inexistente recusa link');
select throws_ok($$select * from public.indicacoes_gerar_link()$$, '22023', null, 'sem destino é recusado');
select throws_ok($$select * from public.indicacoes_gerar_link(p_perfil_id => 'a0000000-0000-0000-0000-000000000001', p_item_id => 'e0000000-0000-0000-0000-000000000001')$$, '22023', null, 'dois destinos são recusados');
select set_config('request.jwt.claims', '{"sub":"ffffffff-0000-0000-0000-00000000000f","role":"authenticated"}', true);
select set_config('t.cod_f_p1', (select o_codigo from public.indicacoes_gerar_link(p_perfil_id => 'a0000000-0000-0000-0000-000000000001')), true);
select isnt(current_setting('t.cod_f_p1'), current_setting('t.cod_c_p1'), 'cada indicador tem o próprio código para o mesmo destino');
select is((select count(*)::int from public.indicacoes_meus_links), 1, 'F vê só o próprio link');
select throws_ok($$select * from public.indicacoes_link$$, '42501', null, 'F não lê a tabela de links');
select throws_ok($$insert into public.indicacoes_link (codigo, indicador_id, perfil_id) values (repeat('a', 32), 'ffffffff-0000-0000-0000-00000000000f', 'a0000000-0000-0000-0000-000000000001')$$, '42501', null, 'cliente não insere link direto');
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is((select count(*)::int from public.indicacoes_meus_links), 3, 'C vê só os 3 links próprios');
select is((select count(*)::int from public.indicacoes_meus_links where codigo = current_setting('t.cod_f_p1')), 0, 'C não vê o código de F');
reset role;
select is((select count(*)::int from public.indicacoes_link), 4, 'quatro links no total (um por indicador e destino)');
select is((select count(*)::int from public.indicacoes_evento where tipo = 'link_gerado'), 4, 'link_gerado registrado uma vez por link');

-- ===== Compartilhamento (sem valor probatório, sem pontos) =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select lives_ok($$select public.indicacoes_registrar_compartilhamento(current_setting('t.cod_c_p1'), 'whatsapp')$$, 'indicador registra compartilhamento do próprio link');
select throws_ok($$select public.indicacoes_registrar_compartilhamento(current_setting('t.cod_c_p1'), 'telegram')$$, '22023', null, 'canal inválido');
select throws_ok($$select public.indicacoes_registrar_compartilhamento(current_setting('t.cod_f_p1'), 'copiar')$$, 'P0002', null, 'não registra compartilhamento de link alheio');
select throws_ok($$select public.indicacoes_registrar_compartilhamento('nao-e-um-codigo', 'copiar')$$, 'P0002', null, 'código malformado');
reset role;
select is((select count(*)::int from public.indicacoes_evento where tipo = 'link_compartilhado'), 1, 'um compartilhamento registrado, separado dos demais eventos');
update public.indicacoes_parametro set valor = 2 where chave = 'compartilhamento_limite_por_hora';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select lives_ok($$select public.indicacoes_registrar_compartilhamento(current_setting('t.cod_c_p1'), 'copiar')$$, 'segundo compartilhamento cabe no limite');
select throws_ok($$select public.indicacoes_registrar_compartilhamento(current_setting('t.cod_c_p1'), 'copiar')$$, 'P0429', null, 'limite de compartilhamentos por hora');
reset role;
update public.indicacoes_parametro set valor = 60 where chave = 'compartilhamento_limite_por_hora';
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$select public.indicacoes_registrar_compartilhamento(current_setting('t.cod_c_p1'), 'copiar')$$, '42501', null, 'anônimo não registra compartilhamento');
reset role;

-- ===== Pedido de contato: visitante sem cadastro =====
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select o_whatsapp_responsavel from public.indicacoes_enviar_contato(
  p_perfil_id => 'a0000000-0000-0000-0000-000000000001', p_item_id => null, p_nome => 'Maria Silva',
  p_whatsapp => '+5511988880001', p_chave => 'chave-0000000000001')), '+5551988880001',
  'visitante sem login envia e recebe o WhatsApp comercial do perfil');
select set_config('t.ped_1', (select o_pedido_id::text from public.indicacoes_enviar_contato(
  p_perfil_id => 'a0000000-0000-0000-0000-000000000001', p_item_id => null, p_nome => 'Maria Silva',
  p_whatsapp => '+5511988880001', p_chave => 'chave-0000000000001')), true);
select is((select o_repetido from public.indicacoes_enviar_contato(
  p_perfil_id => 'a0000000-0000-0000-0000-000000000001', p_item_id => null, p_nome => 'Maria Silva',
  p_whatsapp => '+5511988880001', p_chave => 'chave-0000000000001')), true, 'mesma chave: operação repetida');
reset role;
select is((select count(*)::int from public.indicacoes_pedido_contato where whatsapp_e164 = '+5511988880001'), 1, 'mesma chave não duplica o pedido');
select is((select count(*)::int from public.indicacoes_evento where tipo = 'contato_enviado'), 1, 'contato_enviado registrado uma única vez');
select is((select estado from public.indicacoes_notificacao where pedido_id = current_setting('t.ped_1')::uuid), 'pendente', 'notificação nasce pendente');
select is((select link_id is null and solicitante_id is null from public.indicacoes_pedido_contato where id = current_setting('t.ped_1')::uuid), true, 'sem código e sem login: sem atribuição nem solicitante');

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select o_pedido_id::text from public.indicacoes_enviar_contato(
  p_perfil_id => 'a0000000-0000-0000-0000-000000000001', p_item_id => null, p_nome => 'Maria S.',
  p_whatsapp => '+5511988880001', p_chave => 'chave-0000000000002')), current_setting('t.ped_1'),
  'anti-repetição: mesmo WhatsApp e destino na janela devolve o pedido existente');
select throws_ok($$select * from public.indicacoes_enviar_contato(
  p_perfil_id => null, p_item_id => 'e0000000-0000-0000-0000-000000000001', p_nome => 'Maria Silva',
  p_whatsapp => '+5511988880001', p_chave => 'chave-0000000000001')$$, '23505', null, 'chave reutilizada em outro destino é recusada');
reset role;
select is((select count(*)::int from public.indicacoes_pedido_contato where whatsapp_e164 = '+5511988880001'), 1, 'janela: nenhum pedido novo');
select is((select count(*)::int from public.indicacoes_notificacao n join public.indicacoes_pedido_contato p on p.id = n.pedido_id where p.whatsapp_e164 = '+5511988880001'), 1, 'janela: nenhuma notificação nova');

-- Fora da janela (pedido antigo inserido como superusuário): cria pedido novo.
insert into public.indicacoes_pedido_contato (id, perfil_id, nome, whatsapp_e164, chave_idempotencia, criado_em)
values ('99999999-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Antigo', '+5511977770001', 'chave-antiga-00000001', now() - interval '30 minutes');
insert into public.indicacoes_notificacao (pedido_id) values ('99999999-0000-0000-0000-000000000001');
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select o_repetido from public.indicacoes_enviar_contato(
  p_perfil_id => 'a0000000-0000-0000-0000-000000000001', p_item_id => null, p_nome => 'Antigo',
  p_whatsapp => '+5511977770001', p_chave => 'chave-nova-0000000002')), false, 'fora da janela o pedido é novo');
reset role;
select is((select count(*)::int from public.indicacoes_pedido_contato where whatsapp_e164 = '+5511977770001'), 2, 'janela vencida gera segundo pedido');

-- Janela configurável: com janela de 60 minutos o pedido antigo (30 min) passa a contar.
update public.indicacoes_parametro set valor = 60 where chave = 'contato_janela_repeticao_minutos';
insert into public.indicacoes_pedido_contato (id, item_id, nome, whatsapp_e164, chave_idempotencia, criado_em)
values ('99999999-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000004', 'Antigo Dois', '+5511977770002', 'chave-antiga-00000002', now() - interval '30 minutes');
insert into public.indicacoes_notificacao (pedido_id) values ('99999999-0000-0000-0000-000000000002');
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select o_pedido_id from public.indicacoes_enviar_contato(
  p_perfil_id => null, p_item_id => 'e0000000-0000-0000-0000-000000000004', p_nome => 'Antigo Dois',
  p_whatsapp => '+5511977770002', p_chave => 'chave-nova-0000000003')), '99999999-0000-0000-0000-000000000002'::uuid, 'a janela é parâmetro central');
reset role;
update public.indicacoes_parametro set valor = 10 where chave = 'contato_janela_repeticao_minutos';

-- ===== Atribuição só no destino correto (IM-025) =====
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select set_config('t.ped_attr', (select o_pedido_id::text from public.indicacoes_enviar_contato(
  p_perfil_id => 'a0000000-0000-0000-0000-000000000001', p_item_id => null, p_nome => 'João Souza',
  p_whatsapp => '+5511955550001', p_chave => 'chave-attr-00000001', p_email => 'joao@exemplo.com', p_mensagem => E'Olá,\nquero orçamento.',
  p_codigo => current_setting('t.cod_c_p1'))), true);
select set_config('t.ped_errado', (select o_pedido_id::text from public.indicacoes_enviar_contato(
  p_perfil_id => 'a0000000-0000-0000-0000-000000000001', p_item_id => null, p_nome => 'Pedro Alves',
  p_whatsapp => '+5511955550002', p_chave => 'chave-attr-00000002', p_codigo => current_setting('t.cod_c_i1'))), true);
select set_config('t.ped_lixo', (select o_pedido_id::text from public.indicacoes_enviar_contato(
  p_perfil_id => 'a0000000-0000-0000-0000-000000000001', p_item_id => null, p_nome => 'Rita Lima',
  p_whatsapp => '+5511955550003', p_chave => 'chave-attr-00000003', p_codigo => 'codigo-inventado')), true);
select set_config('t.ped_item', (select o_pedido_id::text from public.indicacoes_enviar_contato(
  p_perfil_id => null, p_item_id => 'e0000000-0000-0000-0000-000000000001', p_nome => 'Ana Costa',
  p_whatsapp => '+5511955550004', p_chave => 'chave-attr-00000004', p_codigo => current_setting('t.cod_c_i1'))), true);
select set_config('t.ped_auto', (select o_pedido_id::text from public.indicacoes_enviar_contato(
  p_perfil_id => 'a0000000-0000-0000-0000-000000000001', p_item_id => null, p_nome => 'Carla Indicadora',
  p_whatsapp => '+5511999990003', p_chave => 'chave-attr-00000005', p_codigo => current_setting('t.cod_c_p1'))), true);
reset role;
select is((select link_id is not null from public.indicacoes_pedido_contato where id = current_setting('t.ped_attr')::uuid), true, 'código do destino correto atribui o pedido');
select is((select link_id is null from public.indicacoes_pedido_contato where id = current_setting('t.ped_errado')::uuid), true, 'código de outro destino não transfere atribuição');
select is((select link_id is null from public.indicacoes_pedido_contato where id = current_setting('t.ped_lixo')::uuid), true, 'código inventado não atribui (e não bloqueia o visitante)');
select is((select link_id is not null from public.indicacoes_pedido_contato where id = current_setting('t.ped_item')::uuid), true, 'link de item atribui o pedido do mesmo item');
select is((select autoindicacao_suspeita from public.indicacoes_pedido_contato where id = current_setting('t.ped_auto')::uuid), true, 'visitante com o WhatsApp do indicador: tentativa registrada, contato permitido (IM-034)');
select is((select autoindicacao_suspeita from public.indicacoes_pedido_contato where id = current_setting('t.ped_attr')::uuid), false, 'pedido normal não é marcado');
select is((select count(*)::int from public.indicacoes_evento where tipo = 'contato_enviado' and link_id is not null), 3, 'contato_enviado guarda o link só quando há atribuição');
select throws_ok($$insert into public.indicacoes_pedido_contato (perfil_id, link_id, nome, whatsapp_e164, chave_idempotencia)
  select 'a0000000-0000-0000-0000-000000000001', l.id, 'Forçado', '+5511944440001', 'chave-forcada-000001'
  from public.indicacoes_link l where l.item_id = 'e0000000-0000-0000-0000-000000000001' limit 1$$, '23514', null, 'o banco recusa link de outro destino mesmo por inserção direta');

-- Logado também envia.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"ffffffff-0000-0000-0000-00000000000f","role":"authenticated"}', true);
select lives_ok($$select * from public.indicacoes_enviar_contato(p_perfil_id => 'a0000000-0000-0000-0000-000000000001', p_item_id => null,
  p_nome => 'Fernanda', p_whatsapp => '+5511955550005', p_chave => 'chave-logado-00000001')$$, 'usuário logado também envia pedido');
reset role;
select is((select solicitante_id from public.indicacoes_pedido_contato where chave_idempotencia = 'chave-logado-00000001'), 'ffffffff-0000-0000-0000-00000000000f'::uuid, 'solicitante logado é guardado (e não é legível por papel de API)');

-- ===== Validação de entrada =====
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$select * from public.indicacoes_enviar_contato(p_perfil_id => 'a0000000-0000-0000-0000-000000000001', p_item_id => null, p_nome => 'Teste', p_whatsapp => '+55119999ABCDE', p_chave => 'chave-val-0000000001')$$, '22023', null, 'WhatsApp com letras');
select throws_ok($$select * from public.indicacoes_enviar_contato(p_perfil_id => 'a0000000-0000-0000-0000-000000000001', p_item_id => null, p_nome => 'Teste', p_whatsapp => E'+551199​990001', p_chave => 'chave-val-0000000002')$$, '22023', null, 'WhatsApp com caractere invisível (zero-width)');
select throws_ok($$select * from public.indicacoes_enviar_contato(p_perfil_id => 'a0000000-0000-0000-0000-000000000001', p_item_id => null, p_nome => 'Teste', p_whatsapp => E'+55１１９９９９９０００１', p_chave => 'chave-val-0000000003')$$, '22023', null, 'WhatsApp com dígitos de largura total');
select throws_ok($$select * from public.indicacoes_enviar_contato(p_perfil_id => 'a0000000-0000-0000-0000-000000000001', p_item_id => null, p_nome => 'Teste', p_whatsapp => '11999990001', p_chave => 'chave-val-0000000004')$$, '22023', null, 'WhatsApp sem +55');
select throws_ok($$select * from public.indicacoes_enviar_contato(p_perfil_id => 'a0000000-0000-0000-0000-000000000001', p_item_id => null, p_nome => 'Teste', p_whatsapp => '+55 11 99999-0001', p_chave => 'chave-val-0000000005')$$, '22023', null, 'WhatsApp não normalizado (espaços e hífen)');
select throws_ok($$select * from public.indicacoes_enviar_contato(p_perfil_id => 'a0000000-0000-0000-0000-000000000001', p_item_id => null, p_nome => 'Teste', p_whatsapp => '+5511', p_chave => 'chave-val-0000000006')$$, '22023', null, 'WhatsApp curto');
select throws_ok($$select * from public.indicacoes_enviar_contato(p_perfil_id => 'a0000000-0000-0000-0000-000000000001', p_item_id => null, p_nome => 'Teste', p_whatsapp => null, p_chave => 'chave-val-0000000007')$$, '22023', null, 'WhatsApp obrigatório');
select throws_ok($$select * from public.indicacoes_enviar_contato(p_perfil_id => 'a0000000-0000-0000-0000-000000000001', p_item_id => null, p_nome => null, p_whatsapp => '+5511933330001', p_chave => 'chave-val-0000000008')$$, '22023', null, 'nome obrigatório');
select throws_ok($$select * from public.indicacoes_enviar_contato(p_perfil_id => 'a0000000-0000-0000-0000-000000000001', p_item_id => null, p_nome => 'A', p_whatsapp => '+5511933330001', p_chave => 'chave-val-0000000009')$$, '22023', null, 'nome curto demais');
select throws_ok($$select * from public.indicacoes_enviar_contato(p_perfil_id => 'a0000000-0000-0000-0000-000000000001', p_item_id => null, p_nome => repeat('a', 81), p_whatsapp => '+5511933330001', p_chave => 'chave-val-0000000010')$$, '22023', null, 'nome acima de 80 caracteres');
select throws_ok($$select * from public.indicacoes_enviar_contato(p_perfil_id => 'a0000000-0000-0000-0000-000000000001', p_item_id => null, p_nome => E'Jo​ao', p_whatsapp => '+5511933330001', p_chave => 'chave-val-0000000011')$$, '22023', null, 'nome com caractere invisível');
select throws_ok($$select * from public.indicacoes_enviar_contato(p_perfil_id => 'a0000000-0000-0000-0000-000000000001', p_item_id => null, p_nome => 'Teste', p_whatsapp => '+5511933330001', p_chave => 'chave-val-0000000012', p_email => 'sem-arroba')$$, '22023', null, 'e-mail sem arroba');
select throws_ok($$select * from public.indicacoes_enviar_contato(p_perfil_id => 'a0000000-0000-0000-0000-000000000001', p_item_id => null, p_nome => 'Teste', p_whatsapp => '+5511933330001', p_chave => 'chave-val-0000000013', p_email => repeat('a', 250) || '@b.com')$$, '22023', null, 'e-mail acima de 254 caracteres');
select throws_ok($$select * from public.indicacoes_enviar_contato(p_perfil_id => 'a0000000-0000-0000-0000-000000000001', p_item_id => null, p_nome => 'Teste', p_whatsapp => '+5511933330001', p_chave => 'chave-val-0000000014', p_mensagem => repeat('m', 1001))$$, '22023', null, 'mensagem acima de 1000 caracteres');
select lives_ok($$select * from public.indicacoes_enviar_contato(p_perfil_id => 'a0000000-0000-0000-0000-000000000001', p_item_id => null, p_nome => repeat('a', 80), p_whatsapp => '+5511933330001', p_chave => 'chave-val-0000000015', p_email => '', p_mensagem => repeat('m', 1000))$$, 'limites exatos (nome 80, mensagem 1000, e-mail vazio) são aceitos');
select throws_ok($$select * from public.indicacoes_enviar_contato(p_perfil_id => 'a0000000-0000-0000-0000-000000000001', p_item_id => null, p_nome => 'Teste', p_whatsapp => '+5511933330002', p_chave => 'curta')$$, '22023', null, 'chave de idempotência curta demais');
select throws_ok($$select * from public.indicacoes_enviar_contato(p_perfil_id => null, p_item_id => null, p_nome => 'Teste', p_whatsapp => '+5511933330002', p_chave => 'chave-val-0000000016')$$, '22023', null, 'sem destino');
-- Destinos indisponíveis (IM-079)
select throws_ok($$select * from public.indicacoes_enviar_contato(p_perfil_id => 'a0000000-0000-0000-0000-000000000002', p_item_id => null, p_nome => 'Teste', p_whatsapp => '+5511933330003', p_chave => 'chave-ind-0000000001')$$, 'P0002', null, 'perfil despublicado recusa pedido');
select throws_ok($$select * from public.indicacoes_enviar_contato(p_perfil_id => 'a0000000-0000-0000-0000-000000000003', p_item_id => null, p_nome => 'Teste', p_whatsapp => '+5511933330003', p_chave => 'chave-ind-0000000002')$$, 'P0002', null, 'perfil sem versão aprovada recusa pedido');
select throws_ok($$select * from public.indicacoes_enviar_contato(p_perfil_id => null, p_item_id => 'e0000000-0000-0000-0000-000000000003', p_nome => 'Teste', p_whatsapp => '+5511933330003', p_chave => 'chave-ind-0000000003')$$, 'P0002', null, 'item despublicado recusa pedido');
select throws_ok($$select * from public.indicacoes_enviar_contato(p_perfil_id => null, p_item_id => gen_random_uuid(), p_nome => 'Teste', p_whatsapp => '+5511933330003', p_chave => 'chave-ind-0000000004')$$, 'P0002', null, 'destino inexistente recusa pedido');
reset role;
-- Perfil despublicado depois: item do perfil também sai (IM-079).
update public.perfis_perfil set publicado = false where id = 'a0000000-0000-0000-0000-000000000001';
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$select * from public.indicacoes_enviar_contato(p_perfil_id => null, p_item_id => 'e0000000-0000-0000-0000-000000000002', p_nome => 'Teste', p_whatsapp => '+5511933330003', p_chave => 'chave-ind-0000000005')$$, 'P0002', null, 'item de perfil despublicado recusa pedido');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is((select disponivel from public.indicacoes_meus_links where destino_id = 'a0000000-0000-0000-0000-000000000001'), false, 'o link existente aparece como indisponível após despublicar');
select throws_ok($$select * from public.indicacoes_gerar_link(p_item_id => 'e0000000-0000-0000-0000-000000000002')$$, 'P0002', null, 'link para item de perfil despublicado é recusado');
reset role;
update public.perfis_perfil set publicado = true where id = 'a0000000-0000-0000-0000-000000000001';

-- ===== Limite de taxa por WhatsApp =====
update public.indicacoes_parametro set valor = 3 where chave = 'contato_limite_por_whatsapp';
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select lives_ok($$select * from public.indicacoes_enviar_contato(p_perfil_id => 'a0000000-0000-0000-0000-000000000001', p_item_id => null, p_nome => 'Spam', p_whatsapp => '+5511922220001', p_chave => 'chave-spam-0000000001')$$, 'spam 1');
select lives_ok($$select * from public.indicacoes_enviar_contato(p_perfil_id => null, p_item_id => 'e0000000-0000-0000-0000-000000000001', p_nome => 'Spam', p_whatsapp => '+5511922220001', p_chave => 'chave-spam-0000000002')$$, 'spam 2');
select lives_ok($$select * from public.indicacoes_enviar_contato(p_perfil_id => null, p_item_id => 'e0000000-0000-0000-0000-000000000002', p_nome => 'Spam', p_whatsapp => '+5511922220001', p_chave => 'chave-spam-0000000003')$$, 'spam 3');
select throws_ok($$select * from public.indicacoes_enviar_contato(p_perfil_id => null, p_item_id => 'e0000000-0000-0000-0000-000000000004', p_nome => 'Spam', p_whatsapp => '+5511922220001', p_chave => 'chave-spam-0000000004')$$, 'P0429', null, 'quarto pedido do mesmo WhatsApp na janela é recusado');
select is((select o_repetido from public.indicacoes_enviar_contato(p_perfil_id => 'a0000000-0000-0000-0000-000000000001', p_item_id => null, p_nome => 'Spam', p_whatsapp => '+5511922220001', p_chave => 'chave-spam-0000000001')), true, 'repetição idempotente não consome o limite');
reset role;
update public.indicacoes_parametro set valor = 5 where chave = 'contato_limite_por_whatsapp';

-- ===== Leitura e privacidade (IM-027, IM-029, IM-041, IM-050) =====
-- Responsável A: pedidos de P1 e do item I2, nunca os do anúncio de B.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select ok((select count(*) from public.indicacoes_meus_pedidos) > 0, 'responsável A vê os pedidos dos seus destinos');
select is((select count(*)::int from public.indicacoes_meus_pedidos where destino_id = 'e0000000-0000-0000-0000-000000000001'), 0, 'A não vê pedidos do anúncio de B');
select is((select nome from public.indicacoes_meus_pedidos where id = current_setting('t.ped_attr')::uuid), 'João Souza', 'responsável vê o nome do visitante');
select is((select whatsapp_e164 from public.indicacoes_meus_pedidos where id = current_setting('t.ped_attr')::uuid), '+5511955550001', 'responsável vê o WhatsApp do visitante');
select is((select email from public.indicacoes_meus_pedidos where id = current_setting('t.ped_attr')::uuid), 'joao@exemplo.com', 'responsável vê o e-mail do visitante');
select is((select mensagem from public.indicacoes_meus_pedidos where id = current_setting('t.ped_attr')::uuid), E'Olá,\nquero orçamento.', 'responsável vê a mensagem do visitante');
select is((select veio_por_indicacao from public.indicacoes_meus_pedidos where id = current_setting('t.ped_attr')::uuid), true, 'veio por indicação: sim');
select is((select veio_por_indicacao from public.indicacoes_meus_pedidos where id = current_setting('t.ped_errado')::uuid), false, 'veio por indicação: não');
select is((select destino_nome from public.indicacoes_meus_pedidos where id = current_setting('t.ped_attr')::uuid), 'Loja Um', 'nome público do destino');
select is((select notificacao_estado from public.indicacoes_meus_pedidos where id = current_setting('t.ped_attr')::uuid), 'pendente', 'estado da notificação visível ao responsável');
select throws_ok($$select * from public.indicacoes_pedido_contato$$, '42501', null, 'responsável não lê a tabela de pedidos direto');
select is((select count(*)::int from public.indicacoes_evento), 0, 'responsável comum não lê eventos');
select is((select count(*)::int from public.indicacoes_parametro), 0, 'responsável comum não lê parâmetros');
select is((select count(*)::int from public.administracao_fila_contatos), 0, 'responsável comum não vê a fila do administrador');
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select ok((select count(*) from public.indicacoes_meus_pedidos where destino_id = 'e0000000-0000-0000-0000-000000000001') > 0, 'responsável B vê os pedidos do próprio anúncio');
select is((select count(*)::int from public.indicacoes_meus_pedidos where destino_id in ('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002')), 0, 'B não vê pedidos de A');
select throws_ok($$update public.indicacoes_pedido_contato set nome = 'x'$$, '42501', null, 'responsável não altera pedido');
select throws_ok($$delete from public.indicacoes_pedido_contato$$, '42501', null, 'responsável não apaga pedido');

-- Indicador C: só resumo, nenhum dado do visitante.
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is((select count(*)::int from public.indicacoes_minhas_indicacoes), 3, 'indicador vê as 3 indicações que geraram contato (perfil, item e a própria)');
select is((select status from public.indicacoes_minhas_indicacoes where id = current_setting('t.ped_attr')::uuid), 'recebido', 'status recebido');
select is((select destino_nome from public.indicacoes_minhas_indicacoes where id = current_setting('t.ped_item')::uuid), 'Bolo', 'destino da indicação');
select is((select count(*)::int from public.indicacoes_minhas_indicacoes where id = current_setting('t.ped_errado')::uuid), 0, 'pedido sem atribuição não aparece para o indicador');
select is((select count(*)::int from public.indicacoes_meus_pedidos), 0, 'indicador (que não é responsável) não vê pedidos pela visão do responsável');
select throws_ok($$select * from public.indicacoes_pedido_contato$$, '42501', null, 'indicador não lê a tabela de pedidos');
select throws_ok($$select nome from public.indicacoes_minhas_indicacoes$$, '42703', null, 'a visão do indicador não tem coluna nome');
select throws_ok($$select whatsapp_e164 from public.indicacoes_minhas_indicacoes$$, '42703', null, 'a visão do indicador não tem coluna de WhatsApp');
select throws_ok($$select email from public.indicacoes_minhas_indicacoes$$, '42703', null, 'a visão do indicador não tem coluna de e-mail');
select throws_ok($$select mensagem from public.indicacoes_minhas_indicacoes$$, '42703', null, 'a visão do indicador não tem coluna de mensagem');
select throws_ok($$select * from public.indicacoes_notificacao$$, '42501', null, 'indicador não lê notificações');
select set_config('request.jwt.claims', '{"sub":"ffffffff-0000-0000-0000-00000000000f","role":"authenticated"}', true);
select is((select count(*)::int from public.indicacoes_minhas_indicacoes), 0, 'F não vê indicações de C');
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$select * from public.indicacoes_pedido_contato$$, '42501', null, 'anon não lê pedidos');
select throws_ok($$select * from public.indicacoes_minhas_indicacoes$$, '42501', null, 'anon não lê a visão do indicador');
select throws_ok($$select * from public.administracao_fila_contatos$$, '42501', null, 'anon não lê a fila');
select throws_ok($$insert into public.indicacoes_pedido_contato (perfil_id, nome, whatsapp_e164, chave_idempotencia) values ('a0000000-0000-0000-0000-000000000001', 'Direto', '+5511900000001', 'chave-direta-00000001')$$, '42501', null, 'anon não insere pedido direto');
reset role;

-- Administrador vê tudo, com os mesmos campos.
select set_config('t.total_pedidos', (select count(*)::text from public.indicacoes_pedido_contato), true);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select is((select count(*)::int from public.administracao_fila_contatos), current_setting('t.total_pedidos')::int, 'administrador vê todos os pedidos pela fila');
select is((select nome from public.administracao_fila_contatos where id = current_setting('t.ped_attr')::uuid), 'João Souza', 'administrador vê o nome do visitante');
select is((select whatsapp_e164 from public.administracao_fila_contatos where id = current_setting('t.ped_attr')::uuid), '+5511955550001', 'administrador vê o WhatsApp do visitante');
select is((select email from public.administracao_fila_contatos where id = current_setting('t.ped_attr')::uuid), 'joao@exemplo.com', 'administrador vê o e-mail do visitante');
select is((select autoindicacao_suspeita from public.administracao_fila_contatos where id = current_setting('t.ped_auto')::uuid), true, 'administrador vê a tentativa de autoindicação');
select is((select count(distinct tipo)::int from public.indicacoes_evento), 3, 'administrador lê os três tipos de evento, separados');
select ok((select count(*) from public.indicacoes_parametro) >= 4, 'administrador lê os parâmetros centrais');
select throws_ok($$update public.indicacoes_pedido_contato set nome = 'x'$$, '42501', null, 'nem o administrador altera pedido pela API');
reset role;

-- ===== Notificação ao responsável: falha, alerta, reenvio (IM-028) =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok($$select * from public.indicacoes_notificacoes_pendentes(5)$$, '42501', null, 'responsável não executa a fila do servidor');
select throws_ok($$select public.indicacoes_notificacao_registrar(current_setting('t.ped_attr')::uuid, true, null)$$, '42501', null, 'responsável não registra resultado de envio');
reset role;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select is((select o_email_responsavel from public.indicacoes_notificacoes_pendentes(100) where o_pedido_id = current_setting('t.ped_attr')::uuid), 'a@teste.local', 'servidor recebe o e-mail do responsável do perfil');
select is((select o_email_responsavel from public.indicacoes_notificacoes_pendentes(100) where o_pedido_id = current_setting('t.ped_item')::uuid), 'b@teste.local', 'servidor recebe o e-mail do anunciante no anúncio particular');
select is((select o_destino_nome from public.indicacoes_notificacoes_pendentes(100) where o_pedido_id = current_setting('t.ped_attr')::uuid), 'Loja Um', 'só o nome público do destino');
select lives_ok($$select public.indicacoes_notificacao_registrar(current_setting('t.ped_attr')::uuid, false, 'smtp_timeout')$$, 'servidor registra falha');
select is((select count(*)::int from public.indicacoes_notificacoes_pendentes(100) where o_pedido_id = current_setting('t.ped_attr')::uuid), 0, 'pedido com falha sai da fila de pendentes');
reset role;
select is((select estado || ':' || tentativas::text || ':' || alerta_estado from public.indicacoes_notificacao where pedido_id = current_setting('t.ped_attr')::uuid), 'falhou:1:aberto', 'falha: estado, tentativa e alerta aberto');
select is((select count(*)::int from public.indicacoes_pedido_contato where id = current_setting('t.ped_attr')::uuid), 1, 'o pedido é preservado mesmo com falha');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select is((select count(*)::int from public.administracao_fila_contatos where alerta_estado = 'aberto' and id = current_setting('t.ped_attr')::uuid), 1, 'a falha gera alerta na fila do administrador');
select is((select ultimo_erro from public.administracao_fila_contatos where id = current_setting('t.ped_attr')::uuid), 'smtp_timeout', 'administrador vê o último erro');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is((select notificacao_estado from public.indicacoes_meus_pedidos where id = current_setting('t.ped_attr')::uuid), 'falhou', 'responsável vê que a notificação falhou');
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select throws_ok($$select public.indicacoes_solicitar_reenvio(current_setting('t.ped_attr')::uuid)$$, 'P0002', null, 'responsável de outro destino não pede reenvio');
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select throws_ok($$select public.indicacoes_solicitar_reenvio(current_setting('t.ped_attr')::uuid)$$, 'P0002', null, 'o indicador não pede reenvio');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$select public.indicacoes_solicitar_reenvio(current_setting('t.ped_attr')::uuid)$$, 'responsável pede reenvio depois da falha');
select throws_ok($$select public.indicacoes_solicitar_reenvio(current_setting('t.ped_attr')::uuid)$$, 'P0001', null, 'reenvio repetido: já está na fila');
reset role;
select is((select estado from public.indicacoes_notificacao where pedido_id = current_setting('t.ped_attr')::uuid), 'pendente', 'reenvio devolve a notificação à fila');
select is((select count(*)::int from public.indicacoes_pedido_contato where whatsapp_e164 = '+5511955550001'), 1, 'reenvio não duplica o pedido');
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select lives_ok($$select public.indicacoes_notificacao_registrar(current_setting('t.ped_attr')::uuid, true, null)$$, 'servidor registra o envio');
select lives_ok($$select public.indicacoes_notificacao_registrar(current_setting('t.ped_attr')::uuid, true, null)$$, 'registrar de novo é idempotente');
reset role;
select is((select estado || ':' || tentativas::text || ':' || alerta_estado from public.indicacoes_notificacao where pedido_id = current_setting('t.ped_attr')::uuid), 'enviada:2:tratado', 'envio: tentativas 2 (sem dupla contagem) e alerta fechado');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok($$select public.indicacoes_solicitar_reenvio(current_setting('t.ped_attr')::uuid)$$, 'P0001', null, 'responsável não reenvia o que foi enviado');
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select throws_ok($$select public.indicacoes_solicitar_reenvio(current_setting('t.ped_attr')::uuid)$$, '22023', null, 'reenvio forçado exige motivo');
select lives_ok($$select public.indicacoes_solicitar_reenvio(current_setting('t.ped_attr')::uuid, 'responsável não recebeu o e-mail')$$, 'administrador força o reenvio com motivo');
reset role;
select is((select count(*)::int from public.administracao_auditoria where acao = 'reenviar_notificacao_contato' and alvo_id = current_setting('t.ped_attr')
  and autor_id = 'dddddddd-0000-0000-0000-00000000000d' and motivo = 'responsável não recebeu o e-mail'
  and valor_anterior ->> 'estado' = 'enviada' and valor_novo ->> 'estado' = 'pendente'), 1, 'reenvio forçado auditado (autor, motivo, valor anterior)');
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select lives_ok($$select public.indicacoes_notificacao_registrar(current_setting('t.ped_attr')::uuid, false, '')$$, 'nova falha sem código usa erro_desconhecido');
reset role;
select is((select ultimo_erro from public.indicacoes_notificacao where pedido_id = current_setting('t.ped_attr')::uuid), 'erro_desconhecido', 'erro vazio vira erro_desconhecido');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok($$select public.indicacoes_tratar_alerta(current_setting('t.ped_attr')::uuid, 'ok')$$, '42501', null, 'responsável não trata alerta');
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select throws_ok($$select public.indicacoes_tratar_alerta(current_setting('t.ped_attr')::uuid, '  ')$$, '22023', null, 'tratar alerta exige motivo');
select lives_ok($$select public.indicacoes_tratar_alerta(current_setting('t.ped_attr')::uuid, 'contatei o responsável por telefone')$$, 'administrador marca o alerta como tratado');
select throws_ok($$select public.indicacoes_tratar_alerta(current_setting('t.ped_attr')::uuid, 'de novo')$$, 'P0001', null, 'não há mais alerta aberto');
reset role;
select is((select alerta_estado from public.indicacoes_notificacao where pedido_id = current_setting('t.ped_attr')::uuid), 'tratado', 'alerta tratado');
select is((select count(*)::int from public.administracao_auditoria where acao = 'tratar_alerta_contato' and alvo_id = current_setting('t.ped_attr')
  and autor_id = 'dddddddd-0000-0000-0000-00000000000d' and valor_anterior ->> 'alerta_estado' = 'aberto' and valor_novo ->> 'alerta_estado' = 'tratado'), 1, 'tratamento de alerta auditado');
select is((select string_agg(evento, ',' order by id) from public.indicacoes_notificacao_historico where pedido_id = current_setting('t.ped_attr')::uuid),
  'tentativa_falhou,reenvio_solicitado,tentativa_enviada,reenvio_solicitado,tentativa_falhou,alerta_tratado', 'histórico de notificação completo e em ordem');

-- ===== Parâmetros centrais =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok($$select public.indicacoes_definir_parametro('contato_limite_por_whatsapp', 9, 'x')$$, '42501', null, 'usuário comum não altera parâmetro');
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select throws_ok($$select public.indicacoes_definir_parametro('contato_limite_por_whatsapp', 9, null)$$, '22023', null, 'parâmetro exige motivo');
select throws_ok($$select public.indicacoes_definir_parametro('contato_limite_por_whatsapp', 0, 'valor fora da faixa')$$, '23514', null, 'valor fora da faixa é recusado');
select throws_ok($$select public.indicacoes_definir_parametro('nao_existe', 1, 'x')$$, 'P0002', null, 'parâmetro inexistente');
select lives_ok($$select public.indicacoes_definir_parametro('contato_limite_por_whatsapp', 8, 'ajuste de teste')$$, 'administrador altera parâmetro');
select throws_ok($$update public.indicacoes_parametro set valor = 1$$, '42501', null, 'parâmetro não é alterável direto pela API');
reset role;
select is((select valor from public.indicacoes_parametro where chave = 'contato_limite_por_whatsapp'), 8, 'parâmetro alterado');
select is((select count(*)::int from public.administracao_auditoria where acao = 'definir_parametro_indicacoes' and alvo_id = 'contato_limite_por_whatsapp'
  and valor_anterior ->> 'valor' = '5' and valor_novo ->> 'valor' = '8' and motivo = 'ajuste de teste'), 1, 'parâmetro auditado com valor anterior');

-- ===== Só inserção: eventos, pedidos, histórico, links (vale até para o superusuário) =====
select throws_ok($$update public.indicacoes_evento set tipo = 'link_gerado'$$, '42501', null, 'evento não é atualizado');
select throws_ok($$delete from public.indicacoes_evento$$, '42501', null, 'evento não é apagado');
select throws_ok($$update public.indicacoes_pedido_contato set nome = 'x'$$, '42501', null, 'pedido não é atualizado (nem pelo servidor)');
select throws_ok($$delete from public.indicacoes_pedido_contato$$, '42501', null, 'pedido não é apagado (nem pelo servidor)');
select throws_ok($$update public.indicacoes_notificacao_historico set erro = 'x'$$, '42501', null, 'histórico de notificação não é atualizado');
select throws_ok($$delete from public.indicacoes_notificacao_historico$$, '42501', null, 'histórico de notificação não é apagado');
select throws_ok($$update public.indicacoes_link set codigo = repeat('b', 32)$$, '42501', null, 'link não muda de código');
select throws_ok($$delete from public.indicacoes_link$$, '42501', null, 'link não é apagado');
select throws_ok($$delete from public.indicacoes_notificacao$$, '42501', null, 'notificação não é apagada');
select throws_ok($$update public.indicacoes_notificacao set pedido_id = gen_random_uuid()$$, '42501', null, 'notificação não muda de pedido');
select throws_ok($$insert into public.indicacoes_evento (tipo, canal) values ('link_compartilhado', 'copiar')$$, '23514', null, 'evento incoerente é recusado');
select throws_ok($$insert into public.indicacoes_evento (tipo, pedido_id) select 'contato_enviado', id from public.indicacoes_pedido_contato where id = current_setting('t.ped_1')::uuid$$, '23505', null, 'contato_enviado não se repete para o mesmo pedido');

select * from finish();
rollback;
