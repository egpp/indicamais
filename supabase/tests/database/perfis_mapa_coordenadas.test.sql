-- pgTAP · módulo perfis · mapa do OpenStreetMap (coordenadas do endereço) · Fase 8
-- IM-018, IM-092, IM-022, IM-012, IM-079, IM-080, IM-086, D-016
begin;
select * from no_plan();
delete from public.catalogo_categoria;

-- A = responsável de P1 (com endereço) e P2 (sem endereço); C = outra conta, responsável de P3; D = administrador geral.
insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@teste.local'),
  ('cccccccc-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c@teste.local'),
  ('dddddddd-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd@teste.local');
insert into public.administracao_administrador (conta_id) values ('dddddddd-0000-0000-0000-00000000000d');
insert into public.catalogo_categoria (id, nome, slug, ativa, ordem) values
  ('11111111-0000-0000-0000-000000000001', 'Alimentação', 'alimentacao', true, 1);
insert into public.perfis_perfil (id, responsavel_id, slug) values
  ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a', 'loja-um'),
  ('a0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-00000000000a', 'loja-dois'),
  ('a0000000-0000-0000-0000-000000000003', 'cccccccc-0000-0000-0000-00000000000c', 'loja-tres');
insert into public.perfis_perfil_versao (id, perfil_id, nome, descricao_breve, imagem_path, categoria_principal_id, cidade, uf, endereco) values
  ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Loja Um', 'Doces', 'perfil/a0000000-0000-0000-0000-000000000001/c.jpg', '11111111-0000-0000-0000-000000000001', 'Porto Alegre', 'RS', 'Rua A, 10'),
  ('a1000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'Loja Dois', 'Doces', 'perfil/a0000000-0000-0000-0000-000000000002/c.jpg', '11111111-0000-0000-0000-000000000001', 'Porto Alegre', 'RS', null),
  ('a1000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', 'Loja Três', 'Doces', 'perfil/a0000000-0000-0000-0000-000000000003/c.jpg', '11111111-0000-0000-0000-000000000001', 'Canoas', 'RS', 'Rua C, 30');
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
select is((select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.perfis_perfil_versao_local'::regclass), true, 'RLS ativa e forçada nas coordenadas');
select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'perfis_perfil_versao_local'), 6, 'política explícita por operação (select x3, insert, update, delete)');
select is((select bool_or(has_table_privilege(r, 'public.perfis_perfil_versao_local', p))
  from unnest(array['anon', 'authenticated']) r, unnest(array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) p), false, 'ninguém escreve direto nas coordenadas');
select is((select count(*)::int from information_schema.columns where table_name in ('perfis_perfil_versao_local', 'perfis_perfil_publico')
  and column_name in ('responsavel_id', 'conta_id', 'autor_id', 'whatsapp_comercial_e164', 'email')), 0, 'sem dado de conta/contato na tabela nem na visão pública');
select is(has_column_privilege('authenticated', 'public.perfis_perfil', 'mostrar_mapa', 'UPDATE'), false, 'mostrar_mapa não é gravável direto');
select is((select column_default from information_schema.columns where table_name = 'perfis_perfil' and column_name = 'mostrar_mapa'), 'true', 'mostrar_mapa nasce ligado');
select is(has_function_privilege('anon', 'public.perfis_gravar_coordenadas(uuid,numeric,numeric,text)', 'EXECUTE')
  or has_function_privilege('anon', 'public.perfis_limpar_coordenadas(uuid)', 'EXECUTE')
  or has_function_privilege('anon', 'public.perfis_definir_mostrar_mapa(uuid,boolean)', 'EXECUTE'), false, 'anon não executa as RPCs do mapa');
select throws_ok($$insert into public.perfis_perfil_versao_local (versao_id, perfil_id, latitude, longitude, origem, endereco_ref)
  values ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 100, 0, 'informado', repeat('a', 32))$$, '23514', null, 'latitude fora de -90..90 é recusada pela tabela');
select throws_ok($$insert into public.perfis_perfil_versao_local (versao_id, perfil_id, latitude, longitude, origem, endereco_ref)
  values ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 0, 181, 'informado', repeat('a', 32))$$, '23514', null, 'longitude fora de -180..180 é recusada pela tabela');
select throws_ok($$insert into public.perfis_perfil_versao_local (versao_id, perfil_id, latitude, longitude, origem, endereco_ref)
  values ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 0, 0, 'chute', repeat('a', 32))$$, '23514', null, 'origem só geocodificado ou informado');

-- ===== Anônimo =====
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select mostrar_mapa from public.perfis_perfil_publico where id = 'a0000000-0000-0000-0000-000000000001'), true, 'visão pública expõe mostrar_mapa');
select is((select latitude from public.perfis_perfil_publico where id = 'a0000000-0000-0000-0000-000000000001'), null, 'sem coordenada gravada o mapa não tem ponto');
select throws_ok($$select public.perfis_gravar_coordenadas('a1000000-0000-0000-0000-000000000001', -30.03, -51.2, 'geocodificado')$$, '42501', null, 'anon não grava coordenadas');
select throws_ok($$insert into public.perfis_perfil_versao_local (versao_id, perfil_id, latitude, longitude, origem, endereco_ref)
  values ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 0, 0, 'informado', repeat('a', 32))$$, '42501', null, 'anon não insere direto');
reset role;

-- ===== Responsável grava =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$select public.perfis_gravar_coordenadas('a1000000-0000-0000-0000-000000000001', -30.034647, -51.217658, 'geocodificado')$$, 'responsável grava coordenadas da versão aprovada com endereço');
select throws_ok($$select public.perfis_gravar_coordenadas('a1000000-0000-0000-0000-000000000001', 91, 0, 'geocodificado')$$, '22023', null, 'latitude > 90 recusada');
select throws_ok($$select public.perfis_gravar_coordenadas('a1000000-0000-0000-0000-000000000001', 0, -181, 'geocodificado')$$, '22023', null, 'longitude < -180 recusada');
select throws_ok($$select public.perfis_gravar_coordenadas('a1000000-0000-0000-0000-000000000001', 'NaN', 0, 'geocodificado')$$, '22023', null, 'NaN recusado');
select throws_ok($$select public.perfis_gravar_coordenadas('a1000000-0000-0000-0000-000000000001', null, 0, 'geocodificado')$$, '22023', null, 'nulo recusado');
select throws_ok($$select public.perfis_gravar_coordenadas('a1000000-0000-0000-0000-000000000001', 0, 0, 'chute')$$, '22023', null, 'origem inválida recusada');
select throws_ok($$select public.perfis_gravar_coordenadas('a1000000-0000-0000-0000-000000000002', -30.0, -51.0, 'geocodificado')$$, '22023', null, 'versão sem endereço não recebe coordenadas (IM-012)');
select throws_ok($$select public.perfis_gravar_coordenadas('a1000000-0000-0000-0000-000000000003', -29.9, -51.1, 'geocodificado')$$, '42501', null, 'não grava na versão de outra conta');
select throws_ok($$update public.perfis_perfil set mostrar_mapa = false where id = 'a0000000-0000-0000-0000-000000000001'$$, '42501', null, 'mostrar_mapa não muda por UPDATE direto');
select throws_ok($$delete from public.perfis_perfil_versao_local$$, '42501', null, 'nem apaga direto');
select lives_ok($$select public.perfis_gravar_coordenadas('a1000000-0000-0000-0000-000000000001', -30.034647, -51.217658, 'geocodificado')$$, 'repetir a mesma gravação é idempotente');
select is((select latitude from public.perfis_meus_perfis where id = 'a0000000-0000-0000-0000-000000000001'), -30.034647::numeric, 'o dono vê a coordenada na própria lista');
reset role;

select is((select count(*)::int from public.administracao_auditoria where acao = 'gravar_coordenadas' and alvo_id = 'a1000000-0000-0000-0000-000000000001'), 1, 'auditoria gravou uma vez (a repetição não duplica)');
select is((select autor_id from public.administracao_auditoria where acao = 'gravar_coordenadas'), 'aaaaaaaa-0000-0000-0000-00000000000a'::uuid, 'com o autor');
select is((select valor_anterior from public.administracao_auditoria where acao = 'gravar_coordenadas'), null, 'primeira gravação: sem valor anterior');

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select latitude from public.perfis_perfil_publico where id = 'a0000000-0000-0000-0000-000000000001'), -30.034647::numeric, 'página pública mostra a latitude');
select is((select longitude from public.perfis_perfil_publico where id = 'a0000000-0000-0000-0000-000000000001'), -51.217658::numeric, 'e a longitude');
select is((select count(*)::int from public.perfis_perfil_versao_local), 1, 'anon lê a coordenada só da versão aprovada de perfil publicado');
reset role;

-- Correção: valor anterior fica na auditoria.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$select public.perfis_gravar_coordenadas('a1000000-0000-0000-0000-000000000001', -30.04, -51.22, 'informado')$$, 'responsável corrige a coordenada');
reset role;
select is((select count(*)::int from public.administracao_auditoria where acao = 'gravar_coordenadas'), 2, 'a correção gera nova auditoria');
select is((select (valor_anterior ->> 'latitude')::numeric from public.administracao_auditoria where acao = 'gravar_coordenadas' order by id desc limit 1), -30.034647::numeric, 'guardando o valor anterior');

-- ===== Outra conta não lê rascunho nem altera =====
-- Rascunho novo de P1 (edição): endereço igual, sem coordenadas herdadas.
insert into public.perfis_perfil_versao (id, perfil_id, nome, descricao_breve, imagem_path, categoria_principal_id, cidade, uf, endereco) values
  ('a1000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000001', 'Loja Um v2', 'Doces', 'perfil/a0000000-0000-0000-0000-000000000001/c.jpg', '11111111-0000-0000-0000-000000000001', 'Porto Alegre', 'RS', 'Rua A, 10');
select is((select count(*)::int from public.perfis_perfil_versao_local where versao_id = 'a1000000-0000-0000-0000-000000000011'), 0, 'versão nova não herda coordenadas');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$select public.perfis_gravar_coordenadas('a1000000-0000-0000-0000-000000000011', -30.1, -51.3, 'geocodificado')$$, 'grava coordenadas no rascunho');
select is((select count(*)::int from public.perfis_perfil_versao_local where versao_id = 'a1000000-0000-0000-0000-000000000011'), 1, 'o dono vê as do rascunho');
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is((select count(*)::int from public.perfis_perfil_versao_local where versao_id = 'a1000000-0000-0000-0000-000000000011'), 0, 'outra conta não lê coordenadas de rascunho');
select throws_ok($$select public.perfis_limpar_coordenadas('a1000000-0000-0000-0000-000000000011')$$, '42501', null, 'outra conta não limpa');
select throws_ok($$select public.perfis_definir_mostrar_mapa('a0000000-0000-0000-0000-000000000001', false)$$, '42501', null, 'nem muda o mapa do perfil alheio');
select is((select count(*)::int from public.perfis_meus_perfis where id = 'a0000000-0000-0000-0000-000000000001'), 0, 'nem vê o perfil de A na lista');
reset role;

-- Endereço do rascunho muda: coordenada zerada (nunca aponta para lugar antigo). A versão no ar mantém a sua.
update public.perfis_perfil_versao set endereco = 'Rua B, 20' where id = 'a1000000-0000-0000-0000-000000000011';
select is((select count(*)::int from public.perfis_perfil_versao_local where versao_id = 'a1000000-0000-0000-0000-000000000011'), 0, 'endereço mudou: coordenadas do rascunho foram zeradas');
select is((select count(*)::int from public.perfis_perfil_versao_local where versao_id = 'a1000000-0000-0000-0000-000000000001'), 1, 'a versão aprovada mantém as dela');
update public.perfis_perfil_versao set descricao_breve = 'Outra' where id = 'a1000000-0000-0000-0000-000000000011';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$select public.perfis_gravar_coordenadas('a1000000-0000-0000-0000-000000000011', -30.2, -51.4, 'geocodificado')$$, 'regeocodifica o novo endereço');
select lives_ok($$select public.perfis_limpar_coordenadas('a1000000-0000-0000-0000-000000000011')$$, 'responsável limpa as coordenadas');
select lives_ok($$select public.perfis_limpar_coordenadas('a1000000-0000-0000-0000-000000000011')$$, 'limpar de novo é idempotente');
reset role;
select is((select count(*)::int from public.administracao_auditoria where acao = 'limpar_coordenadas'), 1, 'limpar auditado uma vez');
select is((select count(*)::int from public.administracao_auditoria where acao = 'zerar_coordenadas'), 1, 'e o zeramento automático por mudança de endereço também');

-- Nova versão aprovada sem coordenadas: o mapa some até regeocodificar (IM-022).
update public.perfis_perfil_versao set situacao = 'pendente', enviada_em = now() where id = 'a1000000-0000-0000-0000-000000000011';
update public.perfis_perfil_versao set situacao = 'aprovada' where id = 'a1000000-0000-0000-0000-000000000011';
update public.perfis_perfil set versao_aprovada_id = 'a1000000-0000-0000-0000-000000000011' where id = 'a0000000-0000-0000-0000-000000000001';
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select latitude from public.perfis_perfil_publico where id = 'a0000000-0000-0000-0000-000000000001'), null, 'versão nova no ar sem coordenada: latitude nula');
select is((select endereco from public.perfis_perfil_publico where id = 'a0000000-0000-0000-0000-000000000001'), 'Rua B, 20', 'o endereço em texto segue visível');
reset role;
-- Volta para a versão antiga no ar (as coordenadas dela batem com o texto dela).
update public.perfis_perfil set versao_aprovada_id = 'a1000000-0000-0000-0000-000000000001' where id = 'a0000000-0000-0000-0000-000000000001';

-- ===== mostrar_mapa =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$select public.perfis_definir_mostrar_mapa('a0000000-0000-0000-0000-000000000001', false)$$, 'responsável desliga o mapa');
select lives_ok($$select public.perfis_definir_mostrar_mapa('a0000000-0000-0000-0000-000000000001', false)$$, 'repetir é idempotente');
select throws_ok($$select public.perfis_definir_mostrar_mapa('a0000000-0000-0000-0000-000000000001', null)$$, '22023', null, 'valor nulo recusado');
reset role;
select is((select count(*)::int from public.administracao_auditoria where acao = 'definir_mostrar_mapa'), 1, 'auditado uma vez');
select is((select valor_anterior ->> 'mostrar_mapa' from public.administracao_auditoria where acao = 'definir_mostrar_mapa'), 'true', 'com valor anterior');
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select latitude from public.perfis_perfil_publico where id = 'a0000000-0000-0000-0000-000000000001'), null, 'mapa desligado: latitude oculta');
select is((select longitude from public.perfis_perfil_publico where id = 'a0000000-0000-0000-0000-000000000001'), null, 'e longitude');
select is((select mostrar_mapa from public.perfis_perfil_publico where id = 'a0000000-0000-0000-0000-000000000001'), false, 'a página sabe que o mapa está desligado');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$select public.perfis_definir_mostrar_mapa('a0000000-0000-0000-0000-000000000001', true)$$, 'e volta a ligar');
reset role;

-- ===== Despublicar oculta =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
update public.perfis_perfil set publicado = false where id = 'a0000000-0000-0000-0000-000000000001';
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.perfis_perfil_publico where id = 'a0000000-0000-0000-0000-000000000001'), 0, 'despublicado: a página (e as coordenadas) saem do ar');
select is((select count(*)::int from public.perfis_perfil_versao_local), 0, 'e a tabela de coordenadas não vaza para anon');
reset role;
update public.perfis_perfil set publicado = true where id = 'a0000000-0000-0000-0000-000000000001';

-- ===== Conta suspensa (IM-080) =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select lives_ok($$select public.administracao_suspender_conta('aaaaaaaa-0000-0000-0000-00000000000a', 'teste de suspensão')$$, 'administrador suspende A');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok($$select public.perfis_gravar_coordenadas('a1000000-0000-0000-0000-000000000001', -30.0, -51.0, 'geocodificado')$$, '42501', null, 'conta suspensa não grava coordenadas');
select throws_ok($$select public.perfis_limpar_coordenadas('a1000000-0000-0000-0000-000000000001')$$, '42501', null, 'nem limpa');
select throws_ok($$select public.perfis_definir_mostrar_mapa('a0000000-0000-0000-0000-000000000001', false)$$, '42501', null, 'nem muda o mapa');
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.perfis_perfil_publico where id = 'a0000000-0000-0000-0000-000000000001'), 0, 'perfil de conta suspensa sai do ar (coordenadas inclusas)');
select is((select count(*)::int from public.perfis_perfil_versao_local where perfil_id = 'a0000000-0000-0000-0000-000000000001'), 0, 'coordenadas de conta suspensa não são lidas por anon');
reset role;

select * from finish();
rollback;
