-- pgTAP · consulta de negócios e itens do administrador · D-009 · IM-021, IM-077 (parte), IM-086, IM-029
-- Administrador vê tudo em qualquer situação; usuário comum, dono não administrador e anônimo não veem nada;
-- sem colunas privadas; sem escrita.
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

-- Perfis do dono A: p1 aprovado e publicado; p2 só rascunho; p3 rejeitado; p4 aprovado e despublicado.
insert into public.perfis_perfil (id, responsavel_id, slug) values
  ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a', 'loja-um'),
  ('a0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-00000000000a', 'loja-dois'),
  ('a0000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-00000000000a', 'loja-tres'),
  ('a0000000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-00000000000a', 'loja-quatro');
insert into public.perfis_perfil_versao (id, perfil_id, situacao, enviada_em, nome, descricao_breve, imagem_path, categoria_principal_id, cidade, uf) values
  ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'aprovada', now(), 'Loja Um', 'Doces', 'perfil/a0000000-0000-0000-0000-000000000001/c.jpg', '11111111-0000-0000-0000-000000000001', 'Porto Alegre', 'RS'),
  ('a1000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', 'rejeitada', now(), 'Loja Três', 'Doces', 'perfil/a0000000-0000-0000-0000-000000000003/c.jpg', '11111111-0000-0000-0000-000000000001', 'Canoas', 'RS'),
  ('a1000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000004', 'aprovada', now(), 'Loja Quatro', 'Doces', 'perfil/a0000000-0000-0000-0000-000000000004/c.jpg', '11111111-0000-0000-0000-000000000001', 'Gravataí', 'RS');
insert into public.perfis_perfil_versao (id, perfil_id, situacao, nome) values
  ('a1000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'rascunho', 'Loja Dois');
update public.perfis_perfil set versao_aprovada_id = 'a1000000-0000-0000-0000-000000000001', publicado = true where id = 'a0000000-0000-0000-0000-000000000001';
update public.perfis_perfil set versao_aprovada_id = 'a1000000-0000-0000-0000-000000000004', publicado = false where id = 'a0000000-0000-0000-0000-000000000004';

-- Itens: i1 particular aprovado publicado; i2 particular pendente; i3 particular rascunho; i4 particular rejeitado;
-- i5 particular aprovado despublicado; i6 item do perfil p1 (cidade herdada) aprovado publicado.
insert into public.catalogo_item (id, conta_id, perfil_id, tipo) values
  ('e0000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-00000000000b', null, 'produto'),
  ('e0000000-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-00000000000b', null, 'produto'),
  ('e0000000-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-00000000000b', null, 'servico'),
  ('e0000000-0000-0000-0000-000000000004', 'bbbbbbbb-0000-0000-0000-00000000000b', null, 'produto'),
  ('e0000000-0000-0000-0000-000000000005', 'bbbbbbbb-0000-0000-0000-00000000000b', null, 'produto'),
  ('e0000000-0000-0000-0000-000000000006', 'aaaaaaaa-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000001', 'servico');
insert into public.catalogo_item_versao (id, item_id, situacao, enviada_em, nome, descricao, foto_path, categoria_principal_id, cidade, uf) values
  ('e1000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'aprovada', now(), 'Bolo', 'Bolo', 'item/e0000000-0000-0000-0000-000000000001/a.jpg', '11111111-0000-0000-0000-000000000001', 'Porto Alegre', 'RS'),
  ('e1000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000002', 'pendente', now(), 'Pão', 'Pão', 'item/e0000000-0000-0000-0000-000000000002/a.jpg', '11111111-0000-0000-0000-000000000001', 'Canoas', 'RS'),
  ('e1000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000004', 'rejeitada', now(), 'Torta', 'Torta', 'item/e0000000-0000-0000-0000-000000000004/a.jpg', '11111111-0000-0000-0000-000000000001', 'Canoas', 'RS'),
  ('e1000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000005', 'aprovada', now(), 'Bike', 'Bike', 'item/e0000000-0000-0000-0000-000000000005/a.jpg', '11111111-0000-0000-0000-000000000001', 'Gravataí', 'RS'),
  ('e1000000-0000-0000-0000-000000000006', 'e0000000-0000-0000-0000-000000000006', 'aprovada', now(), 'Entrega', 'Entrega', 'item/e0000000-0000-0000-0000-000000000006/a.jpg', '11111111-0000-0000-0000-000000000001', null, null);
insert into public.catalogo_item_versao (id, item_id, situacao, nome) values
  ('e1000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000003', 'rascunho', 'Aula');
update public.catalogo_item set versao_aprovada_id = 'e1000000-0000-0000-0000-000000000001', publicado = true where id = 'e0000000-0000-0000-0000-000000000001';
update public.catalogo_item set versao_aprovada_id = 'e1000000-0000-0000-0000-000000000005', publicado = false where id = 'e0000000-0000-0000-0000-000000000005';
update public.catalogo_item set versao_aprovada_id = 'e1000000-0000-0000-0000-000000000006', publicado = true where id = 'e0000000-0000-0000-0000-000000000006';

-- ===== Estrutura: sem contato nem dado privado =====
select columns_are('public', 'administracao_consulta_negocios',
  array['alvo_tipo', 'alvo_id', 'dono_id', 'versao_id', 'nome', 'categoria', 'cidade', 'uf', 'situacao',
        'tem_versao_aprovada', 'publicado', 'disponivel', 'item_tipo', 'perfil_id', 'slug', 'criado_em', 'atualizado_em'],
  'a visão não tem telefone, WhatsApp, e-mail nem dado de visitante');
select is((select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.perfis_perfil'::regclass), true, 'RLS segue ativa e forçada (perfis)');
select is((select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.catalogo_item'::regclass), true, 'RLS segue ativa e forçada (itens)');

-- ===== Catálogo: nenhum papel de API tem escrita na visão =====
select is((select bool_or(has_table_privilege(r, 'public.administracao_consulta_negocios', p))
  from unnest(array['anon', 'authenticated']) r, unnest(array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) p), false,
  'anon e authenticated não têm INSERT, UPDATE, DELETE nem TRUNCATE na visão');
select is(has_table_privilege('anon', 'public.administracao_consulta_negocios', 'SELECT'), false, 'anon não tem SELECT na visão');

-- ===== anônimo: sem privilégio =====
set local role anon;
select throws_ok($$select count(*) from public.administracao_consulta_negocios$$, '42501', null, 'anônimo não lê a visão');
reset role;

-- ===== usuário comum e dono não administrador: zero linhas =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((select count(*)::int from public.administracao_consulta_negocios), 0, 'usuário comum (dono de itens) vê zero linhas');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is((select count(*)::int from public.administracao_consulta_negocios), 0, 'dono de perfis não administrador vê zero linhas');
select lives_ok($$do $b$ begin update public.administracao_consulta_negocios set nome = 'x'; raise exception 'ESCRITA_PERMITIDA'; exception when sqlstate '55000' or sqlstate '42501' then null; end $b$$$, 'sem UPDATE (bloqueio 55000 ou 42501, nunca sucesso)');
select lives_ok($$do $b$ begin delete from public.administracao_consulta_negocios; raise exception 'ESCRITA_PERMITIDA'; exception when sqlstate '55000' or sqlstate '42501' then null; end $b$$$, 'sem DELETE (bloqueio 55000 ou 42501, nunca sucesso)');
select lives_ok($$do $b$ begin insert into public.administracao_consulta_negocios (alvo_tipo) values ('perfil'); raise exception 'ESCRITA_PERMITIDA'; exception when sqlstate '55000' or sqlstate '42501' then null; end $b$$$, 'sem INSERT (bloqueio 55000 ou 42501, nunca sucesso)');
reset role;

-- ===== administrador: vê tudo =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select is((select count(*)::int from public.administracao_consulta_negocios where alvo_tipo = 'perfil'), 4, 'administrador vê os 4 perfis');
select is((select count(*)::int from public.administracao_consulta_negocios where alvo_tipo = 'item'), 6, 'administrador vê os 6 itens');
select is((select array_agg(distinct situacao order by situacao) from public.administracao_consulta_negocios),
  array['aprovada', 'pendente', 'rascunho', 'rejeitada'], 'todas as situações aparecem');
select is((select situacao from public.administracao_consulta_negocios where alvo_id = 'a0000000-0000-0000-0000-000000000002'), 'rascunho', 'perfil só com rascunho aparece');
select is((select situacao from public.administracao_consulta_negocios where alvo_id = 'a0000000-0000-0000-0000-000000000003'), 'rejeitada', 'perfil rejeitado aparece');
select is((select publicado from public.administracao_consulta_negocios where alvo_id = 'a0000000-0000-0000-0000-000000000004'), false, 'perfil despublicado aparece como não publicado');
select is((select disponivel from public.administracao_consulta_negocios where alvo_id = 'a0000000-0000-0000-0000-000000000004'), false, 'perfil despublicado não está disponível');
select is((select disponivel from public.administracao_consulta_negocios where alvo_id = 'a0000000-0000-0000-0000-000000000001'), true, 'perfil publicado está disponível');
select is((select disponivel from public.administracao_consulta_negocios where alvo_id = 'a0000000-0000-0000-0000-000000000002'), false, 'perfil sem versão aprovada não está disponível');
select is((select dono_id from public.administracao_consulta_negocios where alvo_id = 'a0000000-0000-0000-0000-000000000001'), 'aaaaaaaa-0000-0000-0000-00000000000a'::uuid, 'dono_id do perfil');
select is((select categoria from public.administracao_consulta_negocios where alvo_id = 'a0000000-0000-0000-0000-000000000001'), 'Alimentação', 'nome da categoria');
select is((select situacao from public.administracao_consulta_negocios where alvo_id = 'e0000000-0000-0000-0000-000000000003'), 'rascunho', 'item em rascunho aparece');
select is((select situacao from public.administracao_consulta_negocios where alvo_id = 'e0000000-0000-0000-0000-000000000004'), 'rejeitada', 'item rejeitado aparece');
select is((select situacao from public.administracao_consulta_negocios where alvo_id = 'e0000000-0000-0000-0000-000000000002'), 'pendente', 'item pendente aparece');
select is((select publicado from public.administracao_consulta_negocios where alvo_id = 'e0000000-0000-0000-0000-000000000005'), false, 'item despublicado aparece');
select is((select disponivel from public.administracao_consulta_negocios where alvo_id = 'e0000000-0000-0000-0000-000000000005'), false, 'item despublicado não está disponível');
select is((select disponivel from public.administracao_consulta_negocios where alvo_id = 'e0000000-0000-0000-0000-000000000001'), true, 'item publicado está disponível');
select is((select cidade from public.administracao_consulta_negocios where alvo_id = 'e0000000-0000-0000-0000-000000000006'), 'Porto Alegre', 'item de perfil herda a cidade do perfil');
select is((select dono_id from public.administracao_consulta_negocios where alvo_id = 'e0000000-0000-0000-0000-000000000001'), 'bbbbbbbb-0000-0000-0000-00000000000b'::uuid, 'dono_id do item');
select lives_ok($$do $b$ begin update public.administracao_consulta_negocios set nome = 'x'; raise exception 'ESCRITA_PERMITIDA'; exception when sqlstate '55000' or sqlstate '42501' then null; end $b$$$, 'administrador também não escreve pela visão (55000 ou 42501)');
reset role;

select * from finish();
rollback;
