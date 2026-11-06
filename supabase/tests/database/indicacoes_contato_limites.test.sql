-- pgTAP · RSA-05 (D-033) · pedido de contato: destino só alarma (parâmetros do S-03), origem recusa (P0429)
-- IM-026, IM-028, IM-076, IM-086
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

-- ===== Parâmetros novos e coluna de origem =====
select is((select count(*)::int from public.indicacoes_parametro where chave = 'contato_limite_por_destino'), 0, 'não há parâmetro duplicado de destino: vale o do S-03 (contato_limite_por_destino_hora)');
select is((select valor from public.indicacoes_parametro where chave = 'contato_recusar_excesso'), 0, 'padrão: destino só gera alarme, sem recusa');
select is((select valor from public.indicacoes_parametro where chave = 'contato_limite_por_origem'), 10, 'padrão do limite por origem');
select has_column('public', 'indicacoes_pedido_contato', 'origem_hash', 'pedido guarda só o hash de origem');

-- ===== Limite por DESTINO: só alarme (não recusa) com o interruptor desligado; recusa só com ele ligado =====
update public.indicacoes_parametro set valor = 3 where chave = 'contato_limite_por_destino_hora';
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select lives_ok($$select * from public.indicacoes_enviar_contato(p_perfil_id => 'a0000000-0000-0000-0000-000000000001', p_item_id => null, p_nome => 'Spam', p_whatsapp => '+5511911110001', p_chave => 'chave-dest-0000000001')$$, 'destino: pedido 1 (whatsapp 1)');
select lives_ok($$select * from public.indicacoes_enviar_contato(p_perfil_id => 'a0000000-0000-0000-0000-000000000001', p_item_id => null, p_nome => 'Spam', p_whatsapp => '+5511911110002', p_chave => 'chave-dest-0000000002')$$, 'destino: pedido 2 (whatsapp 2)');
select lives_ok($$select * from public.indicacoes_enviar_contato(p_perfil_id => 'a0000000-0000-0000-0000-000000000001', p_item_id => null, p_nome => 'Spam', p_whatsapp => '+5511911110003', p_chave => 'chave-dest-0000000003')$$, 'destino: pedido 3 (whatsapp 3)');
select lives_ok($$select * from public.indicacoes_enviar_contato(p_perfil_id => 'a0000000-0000-0000-0000-000000000001', p_item_id => null, p_nome => 'Spam', p_whatsapp => '+5511911110004', p_chave => 'chave-dest-0000000004')$$, 'quarto pedido ao mesmo destino com outro WhatsApp: aceito (excesso por destino não recusa, só alarma)');
select lives_ok($$select * from public.indicacoes_enviar_contato(p_perfil_id => 'a0000000-0000-0000-0000-000000000001', p_item_id => null, p_nome => 'Spam', p_whatsapp => '+5511911110001', p_chave => 'chave-dest-0000000009')$$, 'repetição do mesmo WhatsApp devolve o existente e não conta como pedido novo');
select lives_ok($$select * from public.indicacoes_enviar_contato(p_perfil_id => null, p_item_id => 'e0000000-0000-0000-0000-000000000001', p_nome => 'Ok', p_whatsapp => '+5511911110005', p_chave => 'chave-dest-0000000005')$$, 'outro destino não é afetado');
reset role;
select is((select count(*)::int from public.indicacoes_alarme_excesso where tipo = 'destino' and alvo_id = 'a0000000-0000-0000-0000-000000000001'), 1, 'o excesso por destino gerou alarme');
update public.indicacoes_parametro set valor = 1 where chave = 'contato_recusar_excesso';
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$select * from public.indicacoes_enviar_contato(p_perfil_id => 'a0000000-0000-0000-0000-000000000001', p_item_id => null, p_nome => 'Spam', p_whatsapp => '+5511911110006', p_chave => 'chave-dest-0000000006')$$, 'P0429', null, 'interruptor ligado: o destino acima do limiar recusa (mesmo interruptor do S-03)');
reset role;
update public.indicacoes_parametro set valor = 0 where chave = 'contato_recusar_excesso';
update public.indicacoes_parametro set valor = 60 where chave = 'contato_limite_por_destino_hora';

-- ===== Limite por ORIGEM (hash) =====
update public.indicacoes_parametro set valor = 2 where chave = 'contato_limite_por_origem';
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select lives_ok($$select * from public.indicacoes_enviar_contato(p_perfil_id => null, p_item_id => 'e0000000-0000-0000-0000-000000000002', p_nome => 'Bot', p_whatsapp => '+5511922220001', p_chave => 'chave-orig-0000000001', p_origem_hash => repeat('a', 64))$$, 'origem A: pedido 1');
select lives_ok($$select * from public.indicacoes_enviar_contato(p_perfil_id => null, p_item_id => 'e0000000-0000-0000-0000-000000000004', p_nome => 'Bot', p_whatsapp => '+5511922220002', p_chave => 'chave-orig-0000000002', p_origem_hash => repeat('a', 64))$$, 'origem A: pedido 2 (outro destino e outro WhatsApp)');
select throws_ok($$select * from public.indicacoes_enviar_contato(p_perfil_id => 'a0000000-0000-0000-0000-000000000001', p_item_id => null, p_nome => 'Bot', p_whatsapp => '+5511922220003', p_chave => 'chave-orig-0000000003', p_origem_hash => repeat('a', 64))$$, 'P0429', null, 'origem A: terceiro pedido é recusado mesmo trocando destino e WhatsApp');
select lives_ok($$select * from public.indicacoes_enviar_contato(p_perfil_id => 'a0000000-0000-0000-0000-000000000001', p_item_id => null, p_nome => 'Pessoa', p_whatsapp => '+5511922220004', p_chave => 'chave-orig-0000000004', p_origem_hash => repeat('b', 64))$$, 'outra origem não é afetada');
select throws_ok($$select * from public.indicacoes_enviar_contato(p_perfil_id => 'a0000000-0000-0000-0000-000000000001', p_item_id => null, p_nome => 'Bot', p_whatsapp => '+5511922220005', p_chave => 'chave-orig-0000000005', p_origem_hash => '1.2.3.4')$$, '22023', null, 'origem que não é hash é recusada (IP cru nunca entra)');
reset role;
select is((select count(*)::int from public.indicacoes_pedido_contato where origem_hash = repeat('a', 64)), 2, 'só os 2 pedidos aceitos guardam a origem');
select is((select count(*)::int from public.indicacoes_pedido_contato where origem_hash is null and whatsapp_e164 = '+5511911110001'), 1, 'chamada sem origem continua válida (compatibilidade)');

-- ===== Limite por LINK e ORIGEM (gatilho do S-03): a mesma origem não consome a cota do link além do limite =====
insert into public.indicacoes_link (id, codigo, indicador_id, perfil_id) values
  ('c0000000-0000-0000-0000-000000000001', 'abcdef0123456789abcdef0123456789', 'cccccccc-0000-0000-0000-00000000000c', 'a0000000-0000-0000-0000-000000000001');
insert into public.indicacoes_pedido_contato (perfil_id, link_id, nome, whatsapp_e164, chave_idempotencia, origem_hash) values
  ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Lnk 1', '+5511933330001', 'chave-lnk-0000000001', repeat('c', 64)),
  ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Lnk 2', '+5511933330002', 'chave-lnk-0000000002', repeat('c', 64));
insert into public.indicacoes_pedido_contato (perfil_id, link_id, nome, whatsapp_e164, chave_idempotencia, origem_hash) values
  ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Lnk 3', '+5511933330003', 'chave-lnk-0000000003', repeat('c', 64));
select is((select link_id from public.indicacoes_pedido_contato where whatsapp_e164 = '+5511933330003'), null, 'mesma origem acima do limite no mesmo link: pedido aceito, sem atribuição');
insert into public.indicacoes_pedido_contato (perfil_id, link_id, nome, whatsapp_e164, chave_idempotencia, origem_hash) values
  ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Lnk 4', '+5511933330004', 'chave-lnk-0000000004', repeat('d', 64));
select is((select link_id from public.indicacoes_pedido_contato where whatsapp_e164 = '+5511933330004'), 'c0000000-0000-0000-0000-000000000001'::uuid, 'outra origem no mesmo link mantém a atribuição');
select is((select count(*)::int from public.indicacoes_alarme_excesso where tipo = 'link' and alvo_id = 'c0000000-0000-0000-0000-000000000001'), 1, 'o excesso por link e origem gerou alarme de link');

-- ===== Privilégios: anon executa só a assinatura nova; nada de tabela =====
select ok(has_function_privilege('anon', 'public.indicacoes_enviar_contato(uuid, uuid, text, text, text, text, text, text, text)', 'execute'), 'anon executa o envio de contato (IM-026)');
select ok(not has_function_privilege('public', 'public.indicacoes_enviar_contato(uuid, uuid, text, text, text, text, text, text, text)', 'execute'), 'PUBLIC sem execute');
select ok(not has_table_privilege('anon', 'public.indicacoes_pedido_contato', 'select'), 'anon continua sem ler pedidos (origem_hash nunca exposto)');
select ok(not has_table_privilege('authenticated', 'public.indicacoes_pedido_contato', 'select'), 'authenticated continua sem ler a tabela de pedidos');
select ok(not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'indicacoes_meus_pedidos' and column_name = 'origem_hash'), 'visão do responsável não expõe origem_hash');
select ok(not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'indicacoes_minhas_indicacoes' and column_name = 'origem_hash'), 'visão do indicador não expõe origem_hash');

select * from finish();
rollback;
