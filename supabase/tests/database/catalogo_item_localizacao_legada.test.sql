-- pgTAP · módulo catalogo · preenchimento da localização própria dos itens LEGADOS (backfill da 20261114100000)
-- IM-105, IM-108, IM-086, IM-029 (D-040)
-- Prova com dado legado (itens inseridos SEM cidade/UF, como existiam antes da migração) que a função de preenchimento:
-- usa a versão do próprio item para particular e imóvel; usa o site para item de site e para imóvel sem localização
-- própria; deixa NULL o que não tem fonte; não sobrescreve o que já tem; é idempotente; e não é chamável pela API.
begin;
select * from no_plan();
delete from public.catalogo_categoria;

insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@teste.local');
insert into public.catalogo_categoria (id, nome, slug, ativa, ordem) values
  ('11111111-0000-0000-0000-000000000001', 'Geral', 'geral', true, 1);

-- P1: site com versão aprovada em Porto Alegre/RS e Loja liberada (imóvel). P2: site SEM cidade em nenhuma versão.
insert into public.perfis_perfil (id, responsavel_id, slug) values
  ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a', 'site-um'),
  ('a0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-00000000000a', 'site-dois');
insert into public.perfis_perfil_versao (id, perfil_id, situacao, enviada_em, nome, descricao_breve, imagem_path, categoria_principal_id, cidade, uf) values
  ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'aprovada', now(), 'Site Um', 'Um',
   'perfil/a0000000-0000-0000-0000-000000000001/c.jpg', '11111111-0000-0000-0000-000000000001', 'Porto Alegre', 'RS');
insert into public.perfis_perfil_versao (id, perfil_id, nome) values
  ('a1000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'Site Dois');
update public.perfis_perfil set versao_aprovada_id = 'a1000000-0000-0000-0000-000000000001' where id = 'a0000000-0000-0000-0000-000000000001';
insert into public.loja_liberacao (perfil_id, liberada) values ('a0000000-0000-0000-0000-000000000001', true);

-- Itens legados (sem cidade/UF no item):
--   f1 particular com versão aprovada em Curitiba/PR            -> Curitiba/PR
--   f2 particular: aprovada sem cidade, rejeitada recente Recife/PE -> Recife/PE (mais recente com localização)
--   f3 particular sem nenhuma versão com cidade                 -> NULL
--   f4 item de site P1 (produto)                                -> Porto Alegre/RS (do site)
--   f5 item de site P2 (site sem cidade)                        -> NULL
--   f6 imóvel de P1 com localização PRÓPRIA Santos/SP           -> Santos/SP (não a do site)
--   f7 imóvel de P1 sem localização própria                     -> Porto Alegre/RS (cai no site)
--   f8 item de site que já tem cidade (Manaus/AM)               -> não é sobrescrito
insert into public.catalogo_item (id, conta_id, perfil_id, tipo, cidade, uf) values
  ('f0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a', null, 'produto', null, null),
  ('f0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-00000000000a', null, 'produto', null, null),
  ('f0000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-00000000000a', null, 'servico', null, null),
  ('f0000000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000001', 'produto', null, null),
  ('f0000000-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000002', 'produto', null, null),
  ('f0000000-0000-0000-0000-000000000006', 'aaaaaaaa-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000001', 'imovel', null, null),
  ('f0000000-0000-0000-0000-000000000007', 'aaaaaaaa-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000001', 'imovel', null, null),
  ('f0000000-0000-0000-0000-000000000008', 'aaaaaaaa-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000001', 'produto', 'Manaus', 'AM');

insert into public.catalogo_item_versao (id, item_id, situacao, enviada_em, criado_em, nome, descricao, foto_path, categoria_principal_id, cidade, uf)
select ('f1' || substr(i.id::text, 3))::uuid, i.id, 'aprovada', now(), now() - interval '2 days', 'Item ' || right(i.id::text, 1), 'Descrição',
       'item/' || i.id::text || '/f.jpg', '11111111-0000-0000-0000-000000000001',
       case right(i.id::text, 1) when '1' then 'Curitiba' when '6' then 'Santos' end,
       case right(i.id::text, 1) when '1' then 'PR' when '6' then 'SP' end
from public.catalogo_item i;
update public.catalogo_item i set versao_aprovada_id = ('f1' || substr(i.id::text, 3))::uuid;
-- f2: a versão aprovada não tem cidade; uma versão rejeitada mais recente tem Recife/PE.
insert into public.catalogo_item_versao (id, item_id, situacao, enviada_em, criado_em, nome, descricao, foto_path, categoria_principal_id, cidade, uf) values
  ('f2000000-0000-0000-0000-0000000000b2', 'f0000000-0000-0000-0000-000000000002', 'rejeitada', now(), now() - interval '1 day', 'Item 2 rejeitado', 'Descrição',
   'item/f0000000-0000-0000-0000-000000000002/g.jpg', '11111111-0000-0000-0000-000000000001', 'Recife', 'PE');

-- Antes: tudo sem localização, exceto f8.
select is((select count(*)::int from public.catalogo_item where cidade is null), 7, 'antes: 7 itens legados sem cidade/UF');

select is(public.catalogo_item_preencher_localizacao_legada(), 5, 'o preenchimento atualiza 5 itens (os que têm fonte)');

select is((select cidade || '/' || uf from public.catalogo_item where id = 'f0000000-0000-0000-0000-000000000001'), 'Curitiba/PR', 'particular: usa a versão aprovada do próprio anúncio');
select is((select cidade || '/' || uf from public.catalogo_item where id = 'f0000000-0000-0000-0000-000000000002'), 'Recife/PE', 'particular sem cidade na aprovada: usa a versão mais recente com cidade e UF');
select is((select cidade from public.catalogo_item where id = 'f0000000-0000-0000-0000-000000000003'), null, 'particular sem nenhuma versão com cidade: fica NULL');
select is((select cidade || '/' || uf from public.catalogo_item where id = 'f0000000-0000-0000-0000-000000000004'), 'Porto Alegre/RS', 'item de site: usa a cidade e a UF do site');
select is((select cidade from public.catalogo_item where id = 'f0000000-0000-0000-0000-000000000005'), null, 'item de site cujo site não tem cidade: fica NULL');
select is((select cidade || '/' || uf from public.catalogo_item where id = 'f0000000-0000-0000-0000-000000000006'), 'Santos/SP', 'imóvel de site com localização própria: usa a DELE, não a do site');
select is((select cidade || '/' || uf from public.catalogo_item where id = 'f0000000-0000-0000-0000-000000000007'), 'Porto Alegre/RS', 'imóvel de site sem localização própria: cai na do site');
select is((select cidade || '/' || uf from public.catalogo_item where id = 'f0000000-0000-0000-0000-000000000008'), 'Manaus/AM', 'quem já tem localização não é sobrescrito');
select is((select count(*)::int from public.catalogo_item where cidade is null), 2, 'depois: só os itens sem fonte ficam NULL (f3 e f5)');
select is((select count(*)::int from public.catalogo_item where (cidade is null) <> (uf is null)), 0, 'cidade e UF sempre em par');

-- Efeitos colaterais: nada de publicação, versão ou atualizado_em tocados; nenhuma linha apagada
select is((select count(*)::int from public.catalogo_item where publicado), 0, 'nenhum item foi publicado pelo preenchimento');
select is((select count(*)::int from public.catalogo_item_versao), 9, 'nenhuma versão criada nem apagada');
select is((select count(*)::int from pg_trigger where tgrelid = 'public.catalogo_item'::regclass and tgenabled = 'D' and not tgisinternal), 0, 'gatilhos do item religados ao fim');

-- Idempotente
select is(public.catalogo_item_preencher_localizacao_legada(), 0, 'rodar de novo não muda nada');

-- A API não chama a função
select is(has_function_privilege('anon', 'public.catalogo_item_preencher_localizacao_legada()', 'EXECUTE')
  or has_function_privilege('authenticated', 'public.catalogo_item_preencher_localizacao_legada()', 'EXECUTE'), false, 'sem EXECUTE para anon e authenticated');

select * from finish();
rollback;
