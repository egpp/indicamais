-- pgTAP · rejeitar a EDIÇÃO de um item aprovado não derruba a versão no ar · IM-022, IM-021, IM-023, IM-086
-- Escrito pelo verificador (27/10/2026) para cobrir o que catalogo_itens.test.sql só cobria para perfis
-- (perfis.test.sql: "edição rejeitada mantém a aprovada no ar").
begin;
select * from no_plan();

insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@teste.local'),
  ('dddddddd-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd@teste.local');
insert into public.administracao_administrador (conta_id) values ('dddddddd-0000-0000-0000-00000000000d');
insert into public.catalogo_categoria (id, nome, slug, ativa, ordem) values
  ('11111111-0000-0000-0000-000000000001', 'Alimentação', 'alimentacao', true, 1);

-- Anúncio particular de A já aprovado e publicado (montado como superusuário).
insert into public.catalogo_item (id, conta_id, perfil_id, tipo) values
  ('e0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a', null, 'produto');
insert into public.catalogo_item_versao (id, item_id, situacao, enviada_em, nome, descricao, foto_path, categoria_principal_id) values
  ('e1000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'aprovada', now(), 'Bolo caseiro', 'Bolo de cenoura',
   'item/e0000000-0000-0000-0000-000000000001/bolo.jpg', '11111111-0000-0000-0000-000000000001');
update public.catalogo_item set versao_aprovada_id = 'e1000000-0000-0000-0000-000000000001', publicado = true
 where id = 'e0000000-0000-0000-0000-000000000001';

create schema t;
grant usage on schema t to anon, authenticated;
create function t.iv(s text) returns uuid language sql stable security definer as $$
  select id from public.catalogo_item_versao where item_id = 'e0000000-0000-0000-0000-000000000001' and situacao = s $$;

-- A edita e envia
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$insert into public.catalogo_item_versao (item_id, nome, descricao, foto_path, categoria_principal_id)
  values ('e0000000-0000-0000-0000-000000000001', 'Bolo caseiro 2', 'Descrição nova', 'item/e0000000-0000-0000-0000-000000000001/bolo2.jpg', '11111111-0000-0000-0000-000000000001')$$, 'A edita o item aprovado');
select lives_ok($$select public.catalogo_enviar_item_versao(t.iv('rascunho'))$$, 'A envia a edição');

-- Administrador rejeita a edição: sem motivo é recusado, com motivo passa
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select throws_ok($$select public.catalogo_decidir_item_versao(t.iv('pendente'), false, '   ')$$, '22023', null, 'rejeitar a edição sem motivo é recusado');
select lives_ok($$select public.catalogo_decidir_item_versao(t.iv('pendente'), false, 'Foto desfocada')$$, 'administrador rejeita a edição com motivo');

-- A versão aprovada continua no ar e o ponteiro não mudou
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select nome from public.catalogo_item_publico), 'Bolo caseiro', 'edição rejeitada mantém a versão aprovada no ar');
reset role;
select is((select versao_aprovada_id from public.catalogo_item where id = 'e0000000-0000-0000-0000-000000000001'),
  'e1000000-0000-0000-0000-000000000001'::uuid, 'o ponteiro da versão aprovada não mudou');
select is((select publicado from public.catalogo_item where id = 'e0000000-0000-0000-0000-000000000001'), true, 'rejeitar a edição não despublica o item');
select is((select count(*)::int from public.catalogo_item_versao where situacao = 'rejeitada'), 1, 'a edição ficou como rejeitada (histórico)');
select is((select versao_aprovada_anterior_id from public.catalogo_item_revisao where decisao = 'rejeitada'),
  'e1000000-0000-0000-0000-000000000001'::uuid, 'a revisão guarda a versão aprovada anterior');
select is((select motivo from public.catalogo_item_revisao where decisao = 'rejeitada'), 'Foto desfocada', 'a revisão guarda o motivo');

-- O responsável vê o motivo na visão de resultados e a versão aprovada continua vigente
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is((select motivo from public.administracao_meus_resultados where situacao = 'rejeitada'), 'Foto desfocada', 'A lê o motivo da rejeição da edição');
select is((select versao_vigente from public.administracao_meus_resultados where situacao = 'aprovada'), true, 'a versão aprovada segue vigente');
select is((select versao_vigente from public.administracao_meus_resultados where situacao = 'rejeitada'), false, 'a rejeitada não é a vigente');

-- A corrige e reenvia (nova versão aberta é permitida após a rejeição)
select lives_ok($$insert into public.catalogo_item_versao (item_id, nome, descricao, foto_path, categoria_principal_id)
  values ('e0000000-0000-0000-0000-000000000001', 'Bolo caseiro 3', 'Descrição corrigida', 'item/e0000000-0000-0000-0000-000000000001/bolo3.jpg', '11111111-0000-0000-0000-000000000001')$$, 'A corrige a edição rejeitada em nova versão');

select * from finish();
rollback;
