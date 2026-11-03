-- pgTAP · módulo loja · liberação da Loja por perfil (administrador geral, motivo, auditoria) · Fase 10
-- IM-097, IM-099, IM-086, D-020
begin;
select * from no_plan();
delete from public.catalogo_categoria;

-- A = responsável de P1 e P2; C = outra conta, responsável de P3; D = administrador geral.
insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@teste.local'),
  ('cccccccc-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c@teste.local'),
  ('dddddddd-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd@teste.local');
insert into public.administracao_administrador (conta_id) values ('dddddddd-0000-0000-0000-00000000000d');
insert into public.catalogo_categoria (id, nome, slug, ativa, ordem) values
  ('11111111-0000-0000-0000-000000000001', 'Imóveis', 'imoveis', true, 1);
insert into public.perfis_perfil (id, responsavel_id, slug) values
  ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a', 'imob-um'),
  ('a0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-00000000000a', 'imob-dois'),
  ('a0000000-0000-0000-0000-000000000003', 'cccccccc-0000-0000-0000-00000000000c', 'imob-tres');
insert into public.perfis_perfil_versao (id, perfil_id, nome, descricao_breve, imagem_path, categoria_principal_id, cidade, uf) values
  ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Imobiliária Um', 'Imóveis', 'perfil/a0000000-0000-0000-0000-000000000001/c.jpg', '11111111-0000-0000-0000-000000000001', 'Porto Alegre', 'RS'),
  ('a1000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'Imobiliária Dois', 'Imóveis', 'perfil/a0000000-0000-0000-0000-000000000002/c.jpg', '11111111-0000-0000-0000-000000000001', 'Porto Alegre', 'RS'),
  ('a1000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', 'Imobiliária Três', 'Imóveis', 'perfil/a0000000-0000-0000-0000-000000000003/c.jpg', '11111111-0000-0000-0000-000000000001', 'Canoas', 'RS');
insert into public.perfis_perfil_versao_contato (versao_id, whatsapp_comercial_e164) values
  ('a1000000-0000-0000-0000-000000000001', '+5551988880001'),
  ('a1000000-0000-0000-0000-000000000002', '+5551988880002'),
  ('a1000000-0000-0000-0000-000000000003', '+5551988880003');
update public.perfis_perfil_versao set situacao = 'pendente', enviada_em = now();
update public.perfis_perfil_versao set situacao = 'aprovada';
update public.perfis_perfil set versao_aprovada_id = 'a1000000-0000-0000-0000-000000000001', publicado = true where id = 'a0000000-0000-0000-0000-000000000001';
update public.perfis_perfil set versao_aprovada_id = 'a1000000-0000-0000-0000-000000000002', publicado = true where id = 'a0000000-0000-0000-0000-000000000002';
update public.perfis_perfil set versao_aprovada_id = 'a1000000-0000-0000-0000-000000000003', publicado = true where id = 'a0000000-0000-0000-0000-000000000003';

-- ===== Estrutura e privilégios =====
select is((select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.loja_liberacao'::regclass), true, 'RLS ativa e forçada em loja_liberacao');
select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'loja_liberacao'), 6, 'política explícita por operação (select x3, insert, update, delete)');
select is((select bool_or(has_table_privilege(r, 'public.loja_liberacao', p))
  from unnest(array['anon', 'authenticated']) r, unnest(array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) p), false, 'ninguém escreve direto na liberação');
select is((select count(*)::int from information_schema.columns where table_name = 'loja_liberacao'
  and column_name in ('conta_id', 'responsavel_id', 'autor_id', 'email', 'whatsapp_comercial_e164')), 0, 'sem dado de conta na tabela');
select is(has_function_privilege('anon', 'public.loja_definir_liberacao(uuid,boolean,text)', 'EXECUTE'), false, 'anon não libera a Loja');
select is(has_function_privilege('authenticated', 'public.loja_ativa(uuid)', 'EXECUTE'), false, 'loja_ativa é interna');
select is(public.loja_ativa('a0000000-0000-0000-0000-000000000001'), false, 'padrão: Loja desligada');
select is(public.loja_ativa(null), false, 'perfil nulo: desligada');

-- ===== Quem não é administrador geral não libera =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok($$select public.loja_definir_liberacao('a0000000-0000-0000-0000-000000000001', true, 'quero testar')$$, '42501', null, 'o próprio dono não se autoriza');
select throws_ok($$insert into public.loja_liberacao (perfil_id, liberada) values ('a0000000-0000-0000-0000-000000000001', true)$$, '42501', null, 'nem por INSERT direto');
select throws_ok($$update public.loja_liberacao set liberada = true$$, '42501', null, 'nem por UPDATE direto');
select throws_ok($$delete from public.loja_liberacao$$, '42501', null, 'nem por DELETE direto');
reset role;
select is((select count(*)::int from public.loja_liberacao), 0, 'nada foi gravado');
select is((select count(*)::int from public.administracao_auditoria where alvo_tabela = 'loja_liberacao'), 0, 'nem auditoria');

-- ===== Administrador geral libera =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select throws_ok($$select public.loja_definir_liberacao('a0000000-0000-0000-0000-000000000001', true, null)$$, '22023', null, 'motivo obrigatório (nulo)');
select throws_ok($$select public.loja_definir_liberacao('a0000000-0000-0000-0000-000000000001', true, '   ')$$, '22023', null, 'motivo obrigatório (vazio)');
select throws_ok($$select public.loja_definir_liberacao('a0000000-0000-0000-0000-000000000001', null, 'x')$$, '22023', null, 'valor nulo recusado');
select throws_ok($$select public.loja_definir_liberacao('99999999-0000-0000-0000-000000000099', true, 'teste')$$, 'P0002', null, 'perfil inexistente');
select lives_ok($$select public.loja_definir_liberacao('a0000000-0000-0000-0000-000000000001', true, 'Teste da Loja de imóveis')$$, 'administrador geral libera a Loja do perfil');
select lives_ok($$select public.loja_definir_liberacao('a0000000-0000-0000-0000-000000000001', true, 'Teste da Loja de imóveis')$$, 'repetir é idempotente');
select throws_ok($$update public.loja_liberacao set liberada = false$$, '42501', null, 'nem o administrador altera direto');
reset role;
select is(public.loja_ativa('a0000000-0000-0000-0000-000000000001'), true, 'Loja liberada em P1');
select is(public.loja_ativa('a0000000-0000-0000-0000-000000000002'), false, 'P2 segue desligada');
select is((select count(*)::int from public.administracao_auditoria where alvo_tabela = 'loja_liberacao'), 1, 'auditoria gravada uma vez (a repetição não duplica)');
select is((select autor_id from public.administracao_auditoria where alvo_tabela = 'loja_liberacao'), 'dddddddd-0000-0000-0000-00000000000d'::uuid, 'com o autor');
select is((select motivo from public.administracao_auditoria where alvo_tabela = 'loja_liberacao'), 'Teste da Loja de imóveis', 'com o motivo');
select is((select valor_anterior from public.administracao_auditoria where alvo_tabela = 'loja_liberacao'), '{"liberada": false}'::jsonb, 'com o valor anterior');
select is((select valor_novo from public.administracao_auditoria where alvo_tabela = 'loja_liberacao'), '{"liberada": true}'::jsonb, 'e o valor novo');
select is((select acao from public.administracao_auditoria where alvo_tabela = 'loja_liberacao'), 'liberar_loja', 'ação liberar_loja');

-- ===== Leitura: dono, outra conta, público =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is((select liberada from public.loja_liberacao where perfil_id = 'a0000000-0000-0000-0000-000000000001'), true, 'o dono lê que tem a Loja');
select is((select count(*)::int from public.loja_liberacao where perfil_id = 'a0000000-0000-0000-0000-000000000002'), 0, 'P2 não tem linha (padrão desligada)');
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is((select count(*)::int from public.loja_liberacao where perfil_id = 'a0000000-0000-0000-0000-000000000001'), 1, 'liberada de perfil publicado é pública (a página já mostra o negócio)');
reset role;

-- Retirar: auditoria com valor anterior verdadeiro; perfil fora do ar deixa de ser público, mas o dono segue lendo.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select lives_ok($$select public.loja_definir_liberacao('a0000000-0000-0000-0000-000000000001', false, 'Fim do teste')$$, 'administrador geral retira a Loja');
select lives_ok($$select public.loja_definir_liberacao('a0000000-0000-0000-0000-000000000001', false, 'Fim do teste')$$, 'retirar de novo é idempotente');
reset role;
select is((select count(*)::int from public.administracao_auditoria where alvo_tabela = 'loja_liberacao'), 2, 'duas auditorias no total');
select is((select valor_anterior from public.administracao_auditoria where acao = 'retirar_loja'), '{"liberada": true}'::jsonb, 'retirada guarda o valor anterior');

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.loja_liberacao), 0, 'anon não lê Loja retirada');
select throws_ok($$select public.loja_definir_liberacao('a0000000-0000-0000-0000-000000000001', true, 'x')$$, '42501', null, 'anon não executa a liberação');
reset role;

-- Perfil despublicado: nem liberada aparece ao público.
update public.loja_liberacao set liberada = true where perfil_id = 'a0000000-0000-0000-0000-000000000001';
update public.perfis_perfil set publicado = false where id = 'a0000000-0000-0000-0000-000000000001';
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.loja_liberacao), 0, 'perfil despublicado: liberação não é pública');
reset role;

select * from finish();
rollback;
