-- pgTAP · Storage · nomes `adm-*` reservados ao aprovador · Fase 9
-- IM-093, IM-086, D-016
-- O responsável não grava nem renomeia objetos `adm-*` na própria pasta; o fluxo do banner do administrador continua.
begin;
select * from no_plan();

-- A = responsável de P1; E = tem a permissão aprovar e é responsável de P2; D = administrador geral.
insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@teste.local'),
  ('dddddddd-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd@teste.local'),
  ('eeeeeeee-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'e@teste.local');
insert into public.administracao_administrador (conta_id) values ('dddddddd-0000-0000-0000-00000000000d');
insert into public.administracao_permissao (conta_id, permissao, concedida_por, motivo) values
  ('eeeeeeee-0000-0000-0000-00000000000e', 'aprovar', 'dddddddd-0000-0000-0000-00000000000d', 'teste');
insert into public.perfis_perfil (id, responsavel_id, slug) values
  ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a', 'loja-um'),
  ('a0000000-0000-0000-0000-000000000002', 'eeeeeeee-0000-0000-0000-00000000000e', 'loja-dois');

-- ===== Responsável: arquivos normais seguem permitidos; adm-* não =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$insert into storage.objects (bucket_id, name) values ('indicamais-imagens', 'perfil/a0000000-0000-0000-0000-000000000001/foto.png')$$, 'o responsável continua enviando arquivos comuns para a própria pasta');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('indicamais-imagens', 'perfil/a0000000-0000-0000-0000-000000000001/adm-1.png')$$, '42501', null, 'o responsável não grava nome adm-* na própria pasta');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('indicamais-imagens', 'perfil/a0000000-0000-0000-0000-000000000001/adm-.png')$$, '42501', null, 'nem o prefixo com nome curto');
select lives_ok($$insert into storage.objects (bucket_id, name) values ('indicamais-imagens', 'perfil/a0000000-0000-0000-0000-000000000001/madm-1.png')$$, 'adm- no meio do nome não é o prefixo reservado');
select throws_ok($$update storage.objects set name = 'perfil/a0000000-0000-0000-0000-000000000001/adm-2.png' where name = 'perfil/a0000000-0000-0000-0000-000000000001/foto.png'$$, '42501', null, 'o responsável não renomeia um arquivo seu para adm-*');

-- ===== O aprovador envia o banner na pasta de OUTRA conta (fluxo da Fase 8 preservado) =====
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-0000-0000-00000000000e","role":"authenticated"}', true);
select lives_ok($$insert into storage.objects (bucket_id, name) values ('indicamais-imagens', 'perfil/a0000000-0000-0000-0000-000000000001/adm-1.png')$$, 'quem tem aprovar continua enviando adm-* para a pasta de outra conta');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('indicamais-imagens', 'perfil/a0000000-0000-0000-0000-000000000002/adm-1.png')$$, '42501', null, 'nem o aprovador grava adm-* na própria pasta (a regra do aprovador exige pasta alheia)');
select lives_ok($$insert into storage.objects (bucket_id, name) values ('indicamais-imagens', 'perfil/a0000000-0000-0000-0000-000000000002/foto.png')$$, 'o aprovador, como responsável do próprio perfil, envia arquivos comuns');

-- ===== O responsável vê e limpa o que não está em uso, mas não adota o objeto =====
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is((select count(*)::int from storage.objects where name = 'perfil/a0000000-0000-0000-0000-000000000001/adm-1.png'), 1, 'o responsável vê a imagem do administrador na própria pasta (prévia para o aceite)');
update storage.objects set name = 'perfil/a0000000-0000-0000-0000-000000000001/meu.png' where name = 'perfil/a0000000-0000-0000-0000-000000000001/adm-1.png';
reset role;
select is((select count(*)::int from storage.objects where name = 'perfil/a0000000-0000-0000-0000-000000000001/adm-1.png'), 1, 'o responsável não renomeia o objeto adm-* (a linha nem passa pelo USING)');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
delete from storage.objects where name = 'perfil/a0000000-0000-0000-0000-000000000001/adm-1.png';
reset role;
select is((select count(*)::int from storage.objects where name = 'perfil/a0000000-0000-0000-0000-000000000001/adm-1.png'), 0, 'adm-* sem uso pode ser apagado pelo responsável (limpeza); em uso a proteção da Fase 8 continua (perfis_banner.test.sql)');

select * from finish();
rollback;
