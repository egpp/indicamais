-- pgTAP · módulo perfis · estilo da página do negócio · Fase 8
-- IM-091, IM-094 (pendente: estilo fora do fluxo de revisão), IM-079, IM-080, IM-086, D-016
begin;
select * from no_plan();
delete from public.catalogo_categoria;

-- A = responsável de P1 (publicado); C = outra conta, responsável de P3; D = administrador geral; E = só permissão aprovar.
insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@teste.local'),
  ('cccccccc-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c@teste.local'),
  ('dddddddd-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd@teste.local'),
  ('eeeeeeee-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'e@teste.local');
insert into public.administracao_administrador (conta_id) values ('dddddddd-0000-0000-0000-00000000000d');
insert into public.administracao_permissao (conta_id, permissao, concedida_por, motivo) values
  ('eeeeeeee-0000-0000-0000-00000000000e', 'aprovar', 'dddddddd-0000-0000-0000-00000000000d', 'teste');
insert into public.catalogo_categoria (id, nome, slug, ativa, ordem) values
  ('11111111-0000-0000-0000-000000000001', 'Alimentação', 'alimentacao', true, 1);
insert into public.perfis_perfil (id, responsavel_id, slug) values
  ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a', 'loja-um'),
  ('a0000000-0000-0000-0000-000000000003', 'cccccccc-0000-0000-0000-00000000000c', 'loja-tres');
insert into public.perfis_perfil_versao (id, perfil_id, nome, descricao_breve, imagem_path, categoria_principal_id, cidade, uf) values
  ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Loja Um', 'Doces', 'perfil/a0000000-0000-0000-0000-000000000001/c.jpg', '11111111-0000-0000-0000-000000000001', 'Porto Alegre', 'RS'),
  ('a1000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', 'Loja Três', 'Doces', 'perfil/a0000000-0000-0000-0000-000000000003/c.jpg', '11111111-0000-0000-0000-000000000001', 'Canoas', 'RS');
insert into public.perfis_perfil_versao_contato (versao_id, whatsapp_comercial_e164) values
  ('a1000000-0000-0000-0000-000000000001', '+5551988880001'),
  ('a1000000-0000-0000-0000-000000000003', '+5551988880003');
update public.perfis_perfil_versao set situacao = 'pendente', enviada_em = now();
update public.perfis_perfil_versao set situacao = 'aprovada';
update public.perfis_perfil set versao_aprovada_id = 'a1000000-0000-0000-0000-000000000001', publicado = true where id = 'a0000000-0000-0000-0000-000000000001';
update public.perfis_perfil set versao_aprovada_id = 'a1000000-0000-0000-0000-000000000003', publicado = true where id = 'a0000000-0000-0000-0000-000000000003';

-- ===== Estrutura =====
select is((select bool_and(relrowsecurity and relforcerowsecurity) from pg_class where oid = 'public.perfis_estilo_pagina'::regclass), true, 'RLS ativa e forçada no catálogo de estilos');
select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'perfis_estilo_pagina'), 4, 'catálogo de estilos: política explícita por operação');
select is((select bool_or(has_table_privilege(r, 'public.perfis_estilo_pagina', p))
  from unnest(array['anon', 'authenticated']) r, unnest(array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) p), false, 'ninguém escreve direto no catálogo de estilos');
select is((select count(*)::int from public.perfis_estilo_pagina), 22, 'os 20 estilos de IM-091, o moto_bike (D-021) e o basico (IM-110) existem');
-- A migração 20261104130000 liberou os estilos 6 a 21; os testes abaixo partem da primeira entrega (D-016), dentro da transação.
select is((select count(*)::int from public.perfis_estilo_pagina where habilitado), 22, 'liberação inicial: os 22 estilos estão habilitados (o basico já nasce habilitado)');
update public.perfis_estilo_pagina set habilitado = false
  where id not in ('minimalista', 'saude_bem_estar', 'beleza_estetica', 'gastronomia', 'construcao_reformas', 'basico');
select is((select array_agg(id order by id) from public.perfis_estilo_pagina where habilitado),
  array['basico', 'beleza_estetica', 'construcao_reformas', 'gastronomia', 'minimalista', 'saude_bem_estar'], 'primeira entrega: 5 estilos de D-016 mais o basico (IM-110) habilitados');
select is((select column_default from information_schema.columns where table_name = 'perfis_perfil' and column_name = 'estilo_pagina'), '''basico''::text', 'padrão dos perfis novos é basico (IM-110)');
select is(has_column_privilege('authenticated', 'public.perfis_perfil', 'estilo_pagina', 'UPDATE'), false, 'o cliente não altera estilo por UPDATE direto');
select is(has_column_privilege('anon', 'public.perfis_perfil', 'estilo_pagina', 'SELECT'), true, 'estilo é leitura pública');
select is(has_function_privilege('anon', 'public.perfis_definir_estilo(uuid,text)', 'EXECUTE')
  or has_function_privilege('anon', 'public.perfis_admin_definir_estilo_habilitado(text,boolean,text)', 'EXECUTE'), false, 'anon não executa as RPCs de estilo');
select is((select count(*)::int from information_schema.columns where table_name = 'perfis_perfil_versao' and column_name like '%estilo%'), 0, 'o estilo não é versionado (IM-094 pendente)');
select is((select count(*)::int from information_schema.columns where table_name = 'perfis_perfil_publico' and column_name = 'estilo_pagina'), 1, 'a visão pública expõe estilo_pagina');
select is((select count(*)::int from information_schema.columns where table_name = 'perfis_perfil_publico' and column_name in ('responsavel_id', 'whatsapp_comercial_e164', 'email')), 0, 'visão pública segue sem dado privado');

-- Catálogo fixo: só `habilitado` muda (vale até para superusuário).
select throws_ok($$update public.perfis_estilo_pagina set rotulo = 'Outro' where id = 'pet'$$, '42501', null, 'rótulo do estilo é imutável');
select throws_ok($$delete from public.perfis_estilo_pagina where id = 'pet'$$, '42501', null, 'estilo não é apagado');
select throws_ok($$update public.perfis_estilo_pagina set habilitado = false where id = 'minimalista'$$, '23514', null, 'o estilo padrão não pode ficar desabilitado');
select throws_ok($$insert into public.perfis_estilo_pagina (id, rotulo, ordem) values ('inventado', 'X', 99)$$, '23514', null, 'só os 22 ids fixos existem');

-- Trocar o default não reescreve perfis existentes (IM-110): um perfil que já está em 'minimalista' continua nele.
insert into public.perfis_perfil (id, responsavel_id, slug, estilo_pagina) values
  ('a0000000-0000-0000-0000-000000000009', 'cccccccc-0000-0000-0000-00000000000c', 'loja-antiga', 'minimalista');
alter table public.perfis_perfil alter column estilo_pagina set default 'basico';
select is((select estilo_pagina from public.perfis_perfil where id = 'a0000000-0000-0000-0000-000000000009'), 'minimalista', 'perfil existente mantém o estilo ao reafirmar o default');
select is((select estilo_pagina from public.perfis_perfil where id = 'a0000000-0000-0000-0000-000000000003'), 'basico', 'perfil criado sem escolher nasce basico');

-- ===== Leitura pública =====
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select estilo_pagina from public.perfis_perfil_publico where id = 'a0000000-0000-0000-0000-000000000001'), 'basico', 'perfil novo é publicado como basico (IM-110)');
select is((select count(*)::int from public.perfis_estilo_pagina), 22, 'visitante lê o catálogo de estilos (22 estilos, D-021, IM-110)');
select throws_ok($$select public.perfis_definir_estilo('a0000000-0000-0000-0000-000000000001', 'gastronomia')$$, '42501', null, 'anon não define estilo');
select throws_ok($$update public.perfis_perfil set estilo_pagina = 'premium'$$, '42501', null, 'anon não altera estilo');
reset role;

-- ===== Responsável define o estilo =====
select is((select count(*)::int from public.perfis_perfil_versao where perfil_id = 'a0000000-0000-0000-0000-000000000001'), 1, 'antes: 1 versão');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$select public.perfis_definir_estilo('a0000000-0000-0000-0000-000000000001', 'gastronomia')$$, 'responsável escolhe estilo habilitado');
select is((select estilo_pagina from public.perfis_meus_perfis where id = 'a0000000-0000-0000-0000-000000000001'), 'gastronomia', 'e vê o estilo na própria lista');
select throws_ok($$select public.perfis_definir_estilo('a0000000-0000-0000-0000-000000000001', 'pet')$$, '22023', null, 'estilo ainda não habilitado é recusado');
select throws_ok($$select public.perfis_definir_estilo('a0000000-0000-0000-0000-000000000001', 'inventado')$$, '22023', null, 'estilo inexistente é recusado');
select throws_ok($$select public.perfis_definir_estilo('a0000000-0000-0000-0000-000000000001', null)$$, '22023', null, 'estilo nulo é recusado');
select throws_ok($$select public.perfis_definir_estilo('a0000000-0000-0000-0000-000000000003', 'saude_bem_estar')$$, '42501', null, 'não altera o estilo de perfil de outra conta');
select throws_ok($$update public.perfis_perfil set estilo_pagina = 'premium' where id = 'a0000000-0000-0000-0000-000000000001'$$, '42501', null, 'nem por UPDATE direto no próprio perfil');
select lives_ok($$select public.perfis_definir_estilo('a0000000-0000-0000-0000-000000000001', 'gastronomia')$$, 'repetir o mesmo estilo é idempotente');
select throws_ok($$select public.perfis_admin_definir_estilo_habilitado('pet', true, 'quero')$$, '42501', null, 'responsável comum não libera estilos');
select is((select count(*)::int from public.administracao_auditoria), 0, 'responsável não lê a auditoria');
reset role;

select is((select count(*)::int from public.administracao_auditoria where acao = 'definir_estilo_pagina' and alvo_id = 'a0000000-0000-0000-0000-000000000001'), 1, 'auditoria gravou a troca uma vez (a repetição não duplica)');
select is((select valor_anterior ->> 'estilo_pagina' from public.administracao_auditoria where acao = 'definir_estilo_pagina'), 'basico', 'auditoria guarda o valor anterior');
select is((select valor_novo ->> 'estilo_pagina' from public.administracao_auditoria where acao = 'definir_estilo_pagina'), 'gastronomia', 'e o novo');
select is((select autor_id from public.administracao_auditoria where acao = 'definir_estilo_pagina'), 'aaaaaaaa-0000-0000-0000-00000000000a'::uuid, 'e o autor');
select is((select count(*)::int from public.perfis_perfil_versao where perfil_id = 'a0000000-0000-0000-0000-000000000001'), 1, 'mudar o estilo não cria versão (sem revisão, IM-094)');
select is((select versao_aprovada_id from public.perfis_perfil where id = 'a0000000-0000-0000-0000-000000000001'), 'a1000000-0000-0000-0000-000000000001'::uuid, 'nem tira a versão aprovada do ar');

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select estilo_pagina from public.perfis_perfil_publico where id = 'a0000000-0000-0000-0000-000000000001'), 'gastronomia', 'o estilo escolhido sai na leitura pública na hora');
reset role;

-- ===== Outra conta não mexe =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select throws_ok($$select public.perfis_definir_estilo('a0000000-0000-0000-0000-000000000001', 'beleza_estetica')$$, '42501', null, 'C não muda o estilo do perfil de A');
select is((select count(*)::int from public.perfis_meus_perfis where id = 'a0000000-0000-0000-0000-000000000001'), 0, 'e não vê o perfil de A na lista dele');
reset role;

-- ===== Liberar e recolher estilos (administrador geral; sem nova migração de schema) =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-0000-0000-00000000000e","role":"authenticated"}', true);
select throws_ok($$select public.perfis_admin_definir_estilo_habilitado('pet', true, 'quero')$$, '42501', null, 'quem só tem aprovar não libera estilos (administrador geral)');
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select throws_ok($$select public.perfis_admin_definir_estilo_habilitado('pet', true, '')$$, '22023', null, 'liberar exige motivo');
select throws_ok($$select public.perfis_admin_definir_estilo_habilitado('inventado', true, 'x')$$, 'P0002', null, 'estilo inexistente');
select throws_ok($$select public.perfis_admin_definir_estilo_habilitado('minimalista', false, 'x')$$, '22023', null, 'não desabilita o padrão');
select lives_ok($$select public.perfis_admin_definir_estilo_habilitado('pet', true, 'segmento liberado')$$, 'administrador geral libera um estilo');
select is((select count(*)::int from public.administracao_auditoria where acao = 'definir_estilo_habilitado' and alvo_id = 'pet'), 1, 'com auditoria');
reset role;
select is((select valor_anterior ->> 'habilitado' from public.administracao_auditoria where acao = 'definir_estilo_habilitado' and alvo_id = 'pet'), 'false', 'e o valor anterior');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$select public.perfis_definir_estilo('a0000000-0000-0000-0000-000000000001', 'pet')$$, 'estilo liberado passa a poder ser escolhido');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select lives_ok($$select public.perfis_admin_definir_estilo_habilitado('pet', false, 'recolhido')$$, 'administrador recolhe o estilo');
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select estilo_pagina from public.perfis_perfil_publico where id = 'a0000000-0000-0000-0000-000000000001'), 'minimalista', 'estilo recolhido: a leitura pública cai para minimalista');
reset role;
select is((select estilo_pagina from public.perfis_perfil where id = 'a0000000-0000-0000-0000-000000000001'), 'pet', 'a escolha do responsável é mantida');

-- ===== Conta suspensa não altera (IM-080) e o perfil sai do ar =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select lives_ok($$select public.administracao_suspender_conta('aaaaaaaa-0000-0000-0000-00000000000a', 'teste de suspensão')$$, 'administrador suspende A');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok($$select public.perfis_definir_estilo('a0000000-0000-0000-0000-000000000001', 'minimalista')$$, '42501', null, 'conta suspensa não altera o estilo');
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.perfis_perfil_publico where id = 'a0000000-0000-0000-0000-000000000001'), 0, 'perfil de conta suspensa não aparece (nem o estilo)');
reset role;

select * from finish();
rollback;
