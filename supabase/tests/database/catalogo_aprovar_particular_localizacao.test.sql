-- pgTAP · aprovar anúncio particular exige cidade e UF · IM-015, IM-019, IM-021, IM-086 (D-008)
begin;
select * from no_plan();
delete from public.catalogo_categoria;

insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@teste.local'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@teste.local'),
  ('dddddddd-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd@teste.local');
insert into public.administracao_administrador (conta_id) values ('dddddddd-0000-0000-0000-00000000000d');
insert into public.catalogo_categoria (id, nome, slug, ativa, ordem) values
  ('11111111-0000-0000-0000-000000000001', 'Alimentação', 'alimentacao', true, 1);

-- Perfil de A aprovado (item de perfil não tem cidade/UF própria: herda do perfil).
insert into public.perfis_perfil (id, responsavel_id, slug) values
  ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a', 'loja-ana');
insert into public.perfis_perfil_versao (id, perfil_id, situacao, enviada_em, nome, descricao_breve, imagem_path, categoria_principal_id, cidade, uf) values
  ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'aprovada', now(), 'Loja da Ana', 'Doces',
   'perfil/a0000000-0000-0000-0000-000000000001/capa.jpg', '11111111-0000-0000-0000-000000000001', 'Porto Alegre', 'RS');
update public.perfis_perfil set versao_aprovada_id = 'a1000000-0000-0000-0000-000000000001', publicado = true
 where id = 'a0000000-0000-0000-0000-000000000001';

-- Itens: 1 legado sem localização, 2 legado sem UF, 3 particular com localização, 4 de perfil,
-- 5 legado (será rejeitado), 6 do administrador sem localização.
insert into public.catalogo_item (id, conta_id, perfil_id, tipo) values
  ('e0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a', null, 'produto'),
  ('e0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-00000000000a', null, 'produto'),
  ('e0000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-00000000000a', null, 'produto'),
  ('e0000000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000001', 'servico'),
  ('e0000000-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-00000000000a', null, 'produto'),
  ('e0000000-0000-0000-0000-000000000006', 'dddddddd-0000-0000-0000-00000000000d', null, 'produto');
insert into public.catalogo_item_versao (id, item_id, situacao, enviada_em, nome, descricao, foto_path, categoria_principal_id, cidade, uf) values
  ('e1000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'pendente', now(), 'Sem local', 'Legado', 'item/e0000000-0000-0000-0000-000000000001/f.jpg', '11111111-0000-0000-0000-000000000001', null, null),
  ('e1000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000002', 'pendente', now(), 'Sem UF', 'Legado', 'item/e0000000-0000-0000-0000-000000000002/f.jpg', '11111111-0000-0000-0000-000000000001', 'Canoas', null),
  ('e1000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000003', 'pendente', now(), 'Com local', 'Novo', 'item/e0000000-0000-0000-0000-000000000003/f.jpg', '11111111-0000-0000-0000-000000000001', 'Porto Alegre', 'RS'),
  ('e1000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000004', 'pendente', now(), 'Serviço', 'Do perfil', 'item/e0000000-0000-0000-0000-000000000004/f.jpg', '11111111-0000-0000-0000-000000000001', null, null),
  ('e1000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000005', 'pendente', now(), 'Legado rej', 'Legado', 'item/e0000000-0000-0000-0000-000000000005/f.jpg', '11111111-0000-0000-0000-000000000001', null, null),
  ('e1000000-0000-0000-0000-000000000006', 'e0000000-0000-0000-0000-000000000006', 'pendente', now(), 'Do admin', 'Admin', 'item/e0000000-0000-0000-0000-000000000006/f.jpg', '11111111-0000-0000-0000-000000000001', null, null);

-- Negativos de acesso continuam valendo
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select throws_ok($$select public.catalogo_decidir_item_versao('e1000000-0000-0000-0000-000000000003', true, null)$$, '42501', null, 'não-administrador continua negado');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok($$select public.catalogo_decidir_item_versao('e1000000-0000-0000-0000-000000000003', true, null)$$, '42501', null, 'dono não se auto-aprova');

select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select throws_ok($$select public.catalogo_decidir_item_versao('e1000000-0000-0000-0000-000000000006', true, null)$$, '42501', null, 'administrador não aprova o próprio anúncio (mesmo sem localização)');

-- Aprovar sem cidade/UF falha com mensagem fixa
select throws_ok($$select public.catalogo_decidir_item_versao('e1000000-0000-0000-0000-000000000001', true, null)$$, '23514',
  'anúncio particular exige cidade e UF para ser aprovado', 'aprovar anúncio sem cidade nem UF falha');
select throws_ok($$select public.catalogo_decidir_item_versao('e1000000-0000-0000-0000-000000000002', true, 'ok')$$, '23514',
  'anúncio particular exige cidade e UF para ser aprovado', 'aprovar anúncio com cidade e sem UF falha');
reset role;
select is((select count(*)::int from public.administracao_auditoria), 0, 'falhas não gravam auditoria');
select is((select count(*)::int from public.catalogo_item_revisao), 0, 'falhas não gravam revisão');
select is((select count(*)::int from public.catalogo_item_versao where situacao = 'pendente'), 6, 'nenhuma versão mudou de situação');
select is((select count(*)::int from public.catalogo_item where versao_aprovada_id is not null), 0, 'ponteiro da versão aprovada não mudou');

-- Positivos
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select lives_ok($$select public.catalogo_decidir_item_versao('e1000000-0000-0000-0000-000000000003', true, null)$$, 'anúncio com cidade e UF é aprovado');
select lives_ok($$select public.catalogo_decidir_item_versao('e1000000-0000-0000-0000-000000000004', true, null)$$, 'item de perfil é aprovado normalmente');
select lives_ok($$select public.catalogo_decidir_item_versao('e1000000-0000-0000-0000-000000000005', false, 'Falta localização')$$, 'rejeitar legado sem localização funciona');
reset role;
select is((select versao_aprovada_id from public.catalogo_item where id = 'e0000000-0000-0000-0000-000000000003'), 'e1000000-0000-0000-0000-000000000003'::uuid, 'aprovação move o ponteiro');
select is((select count(*)::int from public.administracao_auditoria where acao = 'aprovar_versao'), 2, 'duas aprovações auditadas');
select is((select count(*)::int from public.administracao_auditoria where acao = 'rejeitar_versao' and motivo = 'Falta localização'), 1, 'rejeição auditada com motivo');
select is((select versao_aprovada_id from public.catalogo_item where id = 'e0000000-0000-0000-0000-000000000005'), null, 'rejeição não move ponteiro');
select is((select publicado from public.catalogo_item where id = 'e0000000-0000-0000-0000-000000000003'), false, 'aprovar não publica');

select * from finish();
rollback;
