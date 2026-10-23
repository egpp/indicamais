-- pgTAP · Storage de imagens (políticas em storage.objects) · IM-011, IM-021, IM-086
-- Testa as POLÍTICAS inserindo direto em storage.objects. Tamanho máximo (2 MiB) e tipos (jpeg/png/webp) são
-- aplicados pela API do Storage e só são conferidos aqui na configuração do bucket, não no upload.
begin;
select * from no_plan();

insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@teste.local'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@teste.local'),
  ('dddddddd-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd@teste.local');
insert into public.administracao_administrador (conta_id) values ('dddddddd-0000-0000-0000-00000000000d');
insert into public.catalogo_categoria (id, nome, slug) values ('11111111-0000-0000-0000-000000000001', 'Alimentação', 'alimentacao');

select is((select public from storage.buckets where id = 'indicamais-imagens'), false, 'bucket é privado');
select is((select file_size_limit from storage.buckets where id = 'indicamais-imagens'), 2097152::bigint, 'limite de 2 MiB por arquivo');
select is((select allowed_mime_types from storage.buckets where id = 'indicamais-imagens'), array['image/jpeg', 'image/png', 'image/webp'], 'só jpeg, png e webp');

-- Perfil de A aprovado e publicado, apontando para capa.jpg; rascunho aponta para rascunho.jpg
insert into storage.objects (bucket_id, name) values
  ('indicamais-imagens', 'aaaaaaaa-0000-0000-0000-00000000000a/capa.jpg'),
  ('indicamais-imagens', 'aaaaaaaa-0000-0000-0000-00000000000a/rascunho.jpg'),
  ('indicamais-imagens', 'aaaaaaaa-0000-0000-0000-00000000000a/solta.jpg'),
  ('indicamais-imagens', 'bbbbbbbb-0000-0000-0000-00000000000b/dele.jpg');
insert into public.perfis_perfil (id, responsavel_id, slug) values
  ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a', 'loja-ana'),
  ('a0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-00000000000a', 'padaria-ana');
insert into public.perfis_perfil_versao (id, perfil_id, situacao, enviada_em, nome, descricao_breve, imagem_path, categoria_principal_id, cidade, uf) values
  ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'aprovada', now(), 'Loja da Ana', 'Doces',
   'aaaaaaaa-0000-0000-0000-00000000000a/capa.jpg', '11111111-0000-0000-0000-000000000001', 'Porto Alegre', 'RS');
insert into public.perfis_perfil_versao (perfil_id, imagem_path) values
  ('a0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-00000000000a/rascunho.jpg');
update public.perfis_perfil set versao_aprovada_id = 'a1000000-0000-0000-0000-000000000001', publicado = false
 where id = 'a0000000-0000-0000-0000-000000000001';

-- Aprovado mas NÃO publicado: imagem não é pública
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from storage.objects where bucket_id = 'indicamais-imagens'), 0, 'anon não lê imagem de perfil não publicado');

reset role;
update public.perfis_perfil set publicado = true where id = 'a0000000-0000-0000-0000-000000000001';
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from storage.objects where bucket_id = 'indicamais-imagens'), 1, 'anon lê só a imagem do perfil aprovado e publicado');
select is((select name from storage.objects where bucket_id = 'indicamais-imagens'), 'aaaaaaaa-0000-0000-0000-00000000000a/capa.jpg', 'a imagem pública é a da versão no ar');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('indicamais-imagens', 'aaaaaaaa-0000-0000-0000-00000000000a/anon.jpg')$$, '42501', null, 'anon não envia imagem');

-- Perfil despublicado retira a imagem
reset role;
update public.perfis_perfil set publicado = false where id = 'a0000000-0000-0000-0000-000000000001';
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from storage.objects where bucket_id = 'indicamais-imagens'), 0, 'despublicar retira a imagem da leitura pública');
reset role;
update public.perfis_perfil set publicado = true where id = 'a0000000-0000-0000-0000-000000000001';

-- B
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((select count(*)::int from storage.objects where bucket_id = 'indicamais-imagens'), 2, 'B vê a própria imagem e a pública de A, nada mais');
select is((select count(*)::int from storage.objects where name like 'aaaaaaaa%rascunho.jpg' or name like 'aaaaaaaa%solta.jpg'), 0, 'B não vê rascunho nem imagem solta de A');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('indicamais-imagens', 'aaaaaaaa-0000-0000-0000-00000000000a/b-invadiu.jpg')$$, '42501', null, 'B não escreve na pasta de A');
select set_config('storage.allow_delete_query', 'true', true);
delete from storage.objects where name like 'aaaaaaaa%';

-- A
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is((select count(*)::int from storage.objects where bucket_id = 'indicamais-imagens'), 3, 'A vê as 3 imagens da própria pasta (prévia)');
select lives_ok($$insert into storage.objects (bucket_id, name) values ('indicamais-imagens', 'aaaaaaaa-0000-0000-0000-00000000000a/nova.png')$$, 'A escreve na própria pasta');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('indicamais-imagens', 'bbbbbbbb-0000-0000-0000-00000000000b/de-a.jpg')$$, '42501', null, 'A não escreve na pasta de B');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('indicamais-imagens', 'aaaaaaaa-0000-0000-0000-00000000000a/sub/pasta.jpg')$$, '42501', null, 'subpastas são recusadas');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('indicamais-imagens', 'aaaaaaaa-0000-0000-0000-00000000000a/arquivo com espaço.jpg')$$, '42501', null, 'nome com caracteres fora do padrão é recusado');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('indicamais-imagens', 'solto.jpg')$$, '42501', null, 'objeto fora da pasta da conta é recusado');

-- Exclusão: não apaga imagem em uso (no ar ou em rascunho)
delete from storage.objects where name = 'aaaaaaaa-0000-0000-0000-00000000000a/capa.jpg';
delete from storage.objects where name = 'aaaaaaaa-0000-0000-0000-00000000000a/rascunho.jpg';
delete from storage.objects where name = 'aaaaaaaa-0000-0000-0000-00000000000a/solta.jpg';
reset role;
select is((select count(*)::int from storage.objects where name in ('aaaaaaaa-0000-0000-0000-00000000000a/capa.jpg', 'aaaaaaaa-0000-0000-0000-00000000000a/rascunho.jpg')), 2, 'imagem no ar e imagem de rascunho não foram apagadas');
select is((select count(*)::int from storage.objects where name = 'aaaaaaaa-0000-0000-0000-00000000000a/solta.jpg'), 0, 'imagem sem uso foi apagada pelo dono');
select is((select count(*)::int from storage.objects where name = 'bbbbbbbb-0000-0000-0000-00000000000b/dele.jpg'), 1, 'A não apagou imagem de B');

-- Administrador lê tudo para revisar
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select cmp_ok((select count(*)::int from storage.objects where bucket_id = 'indicamais-imagens'), '>=', 4, 'administrador lê as imagens para revisão');

-- Limite de 100 objetos por conta
reset role;
insert into storage.objects (bucket_id, name)
select 'indicamais-imagens', 'aaaaaaaa-0000-0000-0000-00000000000a/lote-' || g || '.jpg' from generate_series(1, 100) g;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok($$insert into storage.objects (bucket_id, name) values ('indicamais-imagens', 'aaaaaaaa-0000-0000-0000-00000000000a/excedente.jpg')$$, '42501', null, 'passar de 100 imagens por conta é recusado');

reset role;
select * from finish();
rollback;
