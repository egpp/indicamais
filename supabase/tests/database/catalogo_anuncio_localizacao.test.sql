-- pgTAP · anúncio particular com cidade e UF obrigatórias · IM-015, IM-019, IM-029, IM-086 (D-008)
begin;
select * from no_plan();
delete from public.catalogo_categoria;

insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@teste.local'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@teste.local');
insert into public.catalogo_categoria (id, nome, slug, ativa, ordem) values
  ('11111111-0000-0000-0000-000000000001', 'Alimentação', 'alimentacao', true, 1);

-- Perfil de A (Porto Alegre/RS) aprovado e publicado, e um item dele.
insert into public.perfis_perfil (id, responsavel_id, slug) values
  ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a', 'padaria-sao-joao');
insert into public.perfis_perfil_versao (id, perfil_id, situacao, enviada_em, nome, descricao_breve, imagem_path, categoria_principal_id, cidade, uf)
values ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'pendente', now(), 'Padaria São João', 'Pães',
        'perfil/a0000000-0000-0000-0000-000000000001/capa.jpg', '11111111-0000-0000-0000-000000000001', 'Porto Alegre', 'RS');
insert into public.perfis_perfil_versao_contato (versao_id, whatsapp_comercial_e164) values ('a1000000-0000-0000-0000-000000000001', '+5551999990001');
update public.perfis_perfil_versao set situacao = 'aprovada' where id = 'a1000000-0000-0000-0000-000000000001';
update public.perfis_perfil set versao_aprovada_id = 'a1000000-0000-0000-0000-000000000001', publicado = true where id = 'a0000000-0000-0000-0000-000000000001';

-- Legado: anúncio particular aprovado ANTES da D-008 (sem cidade/UF) continua válido e público.
insert into public.catalogo_item (id, conta_id, perfil_id, tipo) values
  ('e0000000-0000-0000-0000-000000000009', 'bbbbbbbb-0000-0000-0000-00000000000b', null, 'produto');
insert into public.catalogo_item_versao (id, item_id, situacao, enviada_em, nome, descricao, foto_path, categoria_principal_id) values
  ('e1000000-0000-0000-0000-000000000009', 'e0000000-0000-0000-0000-000000000009', 'aprovada', now(), 'Sofá legado', 'Sem localização',
   'item/e0000000-0000-0000-0000-000000000009/f.jpg', '11111111-0000-0000-0000-000000000001');
update public.catalogo_item set versao_aprovada_id = 'e1000000-0000-0000-0000-000000000009', publicado = true where id = 'e0000000-0000-0000-0000-000000000009';

create schema t;
grant usage on schema t to anon, authenticated;
create function t.iv(p_nome text, s text) returns uuid language sql stable security definer as $$
  select v.id from public.catalogo_item_versao v where v.nome = p_nome and v.situacao = s $$;
create function t.itemid(p_nome text) returns uuid language sql stable security definer as $$
  select item_id from public.catalogo_item_versao where nome = p_nome limit 1 $$;
-- aprova e publica a versão de um anúncio (como superusuário, equivale à decisão do administrador)
create function t.aprovar(p_nome text) returns void language plpgsql security definer as $$
declare v_id uuid; v_item uuid;
begin
  select id, item_id into v_id, v_item from public.catalogo_item_versao where nome = p_nome and situacao = 'pendente';
  update public.catalogo_item_versao set situacao = 'aprovada' where id = v_id;
  update public.catalogo_item set versao_aprovada_id = v_id, publicado = true where id = v_item;
end $$;

select columns_are('public', 'catalogo_item_publico', array['id', 'perfil_id', 'tipo', 'nome', 'descricao', 'foto_path',
  'categoria_principal_id', 'categoria_secundaria_1_id', 'categoria_secundaria_2_id', 'preco_modo', 'preco_centavos', 'criado_em', 'cidade', 'uf'],
  'visão pública do item: só a localização foi acrescentada, sem dado privado');
select is((select proargnames from pg_proc where oid = 'public.busca_publica(text,text,uuid,text,text,integer,integer)'::regprocedure)[8:],
  array['o_tipo', 'o_id', 'o_slug', 'o_perfil_id', 'o_perfil_slug', 'o_nome', 'o_descricao', 'o_imagem_path', 'o_categoria_id',
        'o_categoria_nome', 'o_categoria_slug', 'o_cidade', 'o_uf', 'o_preco_modo', 'o_preco_centavos', 'o_total'], 'busca com as mesmas colunas');
select is((select count(*)::int from pg_proc where proname = 'catalogo_criar_item' and pronamespace = 'public'::regnamespace), 1, 'uma só assinatura de catalogo_criar_item');
select is(has_function_privilege('anon', 'public.catalogo_criar_item(text,uuid,text,text,uuid,uuid,uuid,text,bigint,text,text)', 'execute'), false, 'anon não cria item');
select is(has_function_privilege('authenticated', 'public.catalogo_criar_item(text,uuid,text,text,uuid,uuid,uuid,text,bigint,text,text)', 'execute'), true, 'authenticated cria item');

-- ===== A cria anúncios e perfil-item =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
-- Sem localização: cria rascunho, mas não envia
select lives_ok($$select public.catalogo_criar_item('produto', null, p_nome => 'Bike sem cidade', p_descricao => 'x',
  p_categoria_principal_id => '11111111-0000-0000-0000-000000000001')$$, 'rascunho de anúncio sem localização é permitido');
select lives_ok($$update public.catalogo_item_versao v set foto_path = 'item/' || v.item_id::text || '/f.jpg' where nome = 'Bike sem cidade'$$, 'foto do rascunho');
select throws_ok($$select public.catalogo_enviar_item_versao(t.iv('Bike sem cidade', 'rascunho'))$$, '23514', null, 'anúncio particular sem cidade/UF não envia');
select lives_ok($$update public.catalogo_item_versao set cidade = 'Curitiba' where nome = 'Bike sem cidade'$$, 'só cidade grava no rascunho');
select throws_ok($$select public.catalogo_enviar_item_versao(t.iv('Bike sem cidade', 'rascunho'))$$, '23514', null, 'só cidade (sem UF) não envia');
-- UF e cidade inválidas
select throws_ok($$update public.catalogo_item_versao set uf = 'XX' where nome = 'Bike sem cidade'$$, '23514', null, 'UF inexistente é recusada');
select throws_ok($$update public.catalogo_item_versao set uf = 'Paraná' where nome = 'Bike sem cidade'$$, '23514', null, 'UF por extenso é recusada');
select throws_ok($$update public.catalogo_item_versao set cidade = 'X', uf = 'PR' where nome = 'Bike sem cidade'$$, '23514', null, 'cidade de 1 caractere é recusada');
select throws_ok($$update public.catalogo_item_versao set cidade = repeat('a', 81), uf = 'PR' where nome = 'Bike sem cidade'$$, '23514', null, 'cidade acima de 80 caracteres é recusada');
select throws_ok($$select public.catalogo_criar_item('produto', null, p_nome => 'Nasce errado', p_cidade => 'Curitiba', p_uf => 'ZZ')$$, '23514', null, 'criação com UF inválida derruba o item inteiro');
select is((select count(*)::int from public.catalogo_meus_itens), 1, 'criação inválida não deixa item órfão');
-- Normalização e envio válido
select lives_ok($$update public.catalogo_item_versao set cidade = '  Curitiba  ', uf = 'pr' where nome = 'Bike sem cidade'$$, 'cidade com espaços e UF minúscula são normalizadas');
select is((select cidade || '/' || uf from public.catalogo_item_versao where nome = 'Bike sem cidade'), 'Curitiba/PR', 'gravado aparado e em maiúsculas');
select lives_ok($$select public.catalogo_enviar_item_versao(t.iv('Bike sem cidade', 'rascunho'))$$, 'com cidade e UF, o anúncio particular envia');
-- Item de perfil: cidade/UF própria é recusada (herda do perfil)
select throws_ok($$select public.catalogo_criar_item('produto', 'a0000000-0000-0000-0000-000000000001', p_nome => 'Pão', p_cidade => 'Canoas', p_uf => 'RS')$$, '23514', null, 'item de perfil com cidade própria é recusado');
select throws_ok($$select public.catalogo_criar_item('produto', 'a0000000-0000-0000-0000-000000000001', p_nome => 'Pão', p_uf => 'RS')$$, '23514', null, 'item de perfil com UF própria é recusado');
select lives_ok($$select public.catalogo_criar_item('produto', 'a0000000-0000-0000-0000-000000000001', p_nome => 'Pão Francês', p_descricao => 'Fresco',
  p_categoria_principal_id => '11111111-0000-0000-0000-000000000001')$$, 'item de perfil sem localização própria é criado');
select lives_ok($$update public.catalogo_item_versao v set foto_path = 'item/' || v.item_id::text || '/f.jpg' where nome = 'Pão Francês'$$, 'foto do item de perfil');
select throws_ok($$update public.catalogo_item_versao set cidade = 'Canoas' where nome = 'Pão Francês'$$, '23514', null, 'editar o item de perfil com cidade é recusado');
select lives_ok($$select public.catalogo_enviar_item_versao(t.iv('Pão Francês', 'rascunho'))$$, 'item de perfil envia sem localização própria');
-- Anúncio de A com acento
select lives_ok($$select public.catalogo_criar_item('produto', null, p_nome => 'Violão', p_descricao => 'Bom', p_categoria_principal_id => '11111111-0000-0000-0000-000000000001',
  p_cidade => 'São José dos Pinhais', p_uf => 'PR')$$, 'anúncio particular com cidade acentuada');
select lives_ok($$update public.catalogo_item_versao v set foto_path = 'item/' || v.item_id::text || '/f.jpg' where nome = 'Violão'$$, 'foto');
select lives_ok($$select public.catalogo_enviar_item_versao(t.iv('Violão', 'rascunho'))$$, 'envia');
select lives_ok($$select public.catalogo_criar_item('produto', null, p_nome => 'Mesa pendente', p_descricao => 'Ainda não aprovada', p_cidade => 'Recife', p_uf => 'PE')$$, 'anúncio que ficará só pendente');
select lives_ok($$update public.catalogo_item_versao v set foto_path = 'item/' || v.item_id::text || '/f.jpg', categoria_principal_id = '11111111-0000-0000-0000-000000000001' where nome = 'Mesa pendente'$$, 'foto');
select lives_ok($$select public.catalogo_enviar_item_versao(t.iv('Mesa pendente', 'rascunho'))$$, 'envia (pendente)');

-- B não altera a localização do anúncio de A
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((select count(*)::int from public.catalogo_item_versao where nome = 'Violão'), 0, 'B não lê a versão pendente de A');
select throws_ok($$insert into public.catalogo_item_versao (item_id, cidade, uf) values (t.itemid('Violão'), 'Recife', 'PE')$$, '42501', null, 'B não cria versão (com outra cidade) no anúncio de A');

-- ===== Aprovação (administrador, simulada como superusuário) =====
reset role;
select t.aprovar('Bike sem cidade');
select t.aprovar('Violão');
select t.aprovar('Pão Francês');

-- ===== anon =====
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select array_agg(o_nome order by o_nome) from public.busca_publica(null, null, null, 'PR')), array['Bike sem cidade', 'Violão'], 'filtro por UF acha os anúncios particulares aprovados');
select is((select array_agg(o_nome) from public.busca_publica(null, null, null, 'pr', 'curitiba')), array['Bike sem cidade'], 'UF em minúscula e cidade em minúscula');
select is((select array_agg(o_nome) from public.busca_publica(null, null, null, null, 'SAO JOSE DOS PINHAIS')), array['Violão'], 'cidade sem acento e em caixa alta acha o anúncio acentuado');
select is((select array_agg(o_nome) from public.busca_publica(null, null, null, null, '  são   josé dos pinhais ')), array['Violão'], 'espaços repetidos e acentos');
select is((select o_cidade || '/' || o_uf from public.busca_publica('violao')), 'São José dos Pinhais/PR', 'a busca devolve a localização do anúncio');
select is((select count(*)::int from public.busca_publica(null, null, null, 'PE')), 0, 'anúncio pendente não aparece no filtro');
select is((select count(*)::int from public.busca_publica('mesa')), 0, 'anúncio pendente não aparece na busca');
select is((select array_agg(o_nome) from public.busca_publica(null, null, null, 'RS', 'porto alegre', 20, 1) where o_tipo = 'produto'), array['Pão Francês'], 'item de perfil herda a cidade do perfil');
select is((select cidade || '/' || uf from public.catalogo_item_publico where nome = 'Pão Francês'), 'Porto Alegre/RS', 'visão pública: item de perfil traz a localização do perfil');
select is((select cidade || '/' || uf from public.catalogo_item_publico where nome = 'Violão'), 'São José dos Pinhais/PR', 'visão pública: anúncio traz a própria localização');
select is((select count(*)::int from public.busca_publica('sofa')), 1, 'legado sem localização segue na busca sem filtro');
select is((select count(*)::int from public.busca_publica('sofa', null, null, 'RS')), 0, 'legado sem localização some ao filtrar por UF');
select is((select count(*)::int from public.busca_publica(null, null, null, null, 'curitiba') b where to_jsonb(b)::text ~* '(conta_id|responsavel|@teste|aaaaaaaa|bbbbbbbb)'), 0, 'resultado sem dado privado');
select is((select count(*)::int from public.catalogo_item_versao where nome = 'Mesa pendente'), 0, 'anon não lê versão pendente');

select * from finish();
rollback;
