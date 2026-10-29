-- pgTAP · administracao (mínimo) e catalogo (categorias) · IM-016, IM-077 (parcial), IM-086
begin;
select * from no_plan();
-- A migração de seed cria as 8 categorias da D-006; este teste monta as suas.
delete from public.catalogo_categoria;

insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@teste.local'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@teste.local'),
  ('dddddddd-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd@teste.local');
insert into public.administracao_administrador (conta_id) values ('dddddddd-0000-0000-0000-00000000000d');
insert into public.catalogo_categoria (id, nome, slug, ativa, ordem) values
  ('11111111-0000-0000-0000-000000000001', 'Alimentação', 'alimentacao', true, 1),
  ('11111111-0000-0000-0000-000000000002', 'Antiga', 'antiga', false, 2);

-- RLS ativa e forçada em todas as tabelas novas, com política explícita para cada operação
select is((select count(*)::int from pg_class where oid in (
  'public.administracao_administrador'::regclass, 'public.administracao_auditoria'::regclass,
  'public.catalogo_categoria'::regclass, 'public.catalogo_categoria_solicitacao'::regclass,
  'public.perfis_perfil'::regclass, 'public.perfis_perfil_versao'::regclass,
  'public.perfis_perfil_versao_contato'::regclass, 'public.perfis_revisao'::regclass,
  'public.catalogo_item'::regclass, 'public.catalogo_item_versao'::regclass, 'public.catalogo_item_revisao'::regclass)
  and not (relrowsecurity and relforcerowsecurity)), 0, 'RLS ativa e forçada em todas as tabelas da Fase 2A');
select is((select count(*)::int
  from unnest(array['administracao_administrador','administracao_auditoria','catalogo_categoria','catalogo_categoria_solicitacao',
    'perfis_perfil','perfis_perfil_versao','perfis_perfil_versao_contato','perfis_revisao',
    'catalogo_item','catalogo_item_versao','catalogo_item_revisao']) t(nome)
  cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) c(cmd)
  where not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = t.nome and p.cmd = c.cmd)), 0,
  'toda tabela tem política explícita para select, insert, update e delete');

-- Estrutura: não existe 3ª categoria secundária
select hasnt_column('public', 'perfis_perfil_versao', 'categoria_secundaria_3_id', 'perfil: sem 3ª secundária (máx. principal + 2)');
select hasnt_column('public', 'catalogo_item_versao', 'categoria_secundaria_3_id', 'item: sem 3ª secundária (máx. principal + 2)');

-- Administrador
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is(public.administracao_eh_admin(), false, 'A não é administrador');
select is((select count(*)::int from public.administracao_administrador), 0, 'A não vê a lista de administradores');
select throws_ok($$insert into public.administracao_administrador (conta_id) values ('aaaaaaaa-0000-0000-0000-00000000000a')$$, '42501', null, 'cliente não se torna administrador');
select throws_ok($$update public.administracao_administrador set conta_id = conta_id$$, '42501', null, 'cliente não altera administradores');
select throws_ok($$delete from public.administracao_administrador$$, '42501', null, 'cliente não apaga administradores');
select is((select count(*)::int from public.administracao_auditoria), 0, 'A não lê auditoria');
select throws_ok($$select public.administracao_exigir_admin()$$, '42501', null, 'cliente não chama função interna de admin');

-- Categorias: leitura
select is((select count(*)::int from public.catalogo_categoria), 1, 'usuário vê só categoria ativa');
select is((select count(*)::int from public.catalogo_categoria where id = '11111111-0000-0000-0000-000000000002'), 0, 'categoria inativa não aparece');
select throws_ok($$insert into public.catalogo_categoria (nome, slug) values ('Nova', 'nova')$$, '42501', null, 'cliente não insere categoria');
select throws_ok($$update public.catalogo_categoria set nome = 'Hackeada' where id = '11111111-0000-0000-0000-000000000001'$$, '42501', null, 'cliente não altera categoria');
select throws_ok($$select public.catalogo_criar_categoria('Nova', 'nova', 0)$$, '42501', null, 'não administrador não cria categoria');
select throws_ok($$select public.catalogo_alterar_categoria('11111111-0000-0000-0000-000000000001', 'X', true, 1, 'm')$$, '42501', null, 'não administrador não altera categoria');

-- Solicitações do responsável
select lives_ok($$insert into public.catalogo_categoria_solicitacao (solicitante_id, nome_sugerido, justificativa) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'Pet shop', 'Atendo animais')$$, 'A solicita categoria');
select throws_ok($$insert into public.catalogo_categoria_solicitacao (solicitante_id, nome_sugerido) values ('bbbbbbbb-0000-0000-0000-00000000000b', 'Em nome de B')$$, '42501', null, 'A não solicita em nome de B');
select throws_ok($$insert into public.catalogo_categoria_solicitacao (solicitante_id, nome_sugerido, situacao) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'Auto', 'atendida')$$, '42501', null, 'cliente não define a situação do pedido');
select throws_ok($$update public.catalogo_categoria_solicitacao set situacao = 'atendida'$$, '42501', null, 'cliente não altera pedido');
select lives_ok($$insert into public.catalogo_categoria_solicitacao (solicitante_id, nome_sugerido) select 'aaaaaaaa-0000-0000-0000-00000000000a'::uuid, 'Pedido ' || g from generate_series(2, 5) g$$, 'A chega a 5 pedidos pendentes');
select throws_ok($$insert into public.catalogo_categoria_solicitacao (solicitante_id, nome_sugerido) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'Pedido 6')$$, 'P0001', null, 'o 6º pedido pendente é recusado');
select throws_ok($$select public.catalogo_decidir_solicitacao((select id from public.catalogo_categoria_solicitacao limit 1), false, 'não', null)$$, '42501', null, 'A não decide pedidos');
select throws_ok($$select decidida_por from public.catalogo_categoria_solicitacao$$, '42501', null, 'A não lê decidida_por (id real do administrador)');

select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((select count(*)::int from public.catalogo_categoria_solicitacao), 0, 'B não vê pedidos de A');

-- anon
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.catalogo_categoria), 1, 'anon vê só categoria ativa');
select throws_ok($$select * from public.catalogo_categoria_solicitacao$$, '42501', null, 'anon não lê pedidos');
select throws_ok($$select * from public.administracao_auditoria$$, '42501', null, 'anon não lê auditoria');
select throws_ok($$select public.administracao_eh_admin()$$, '42501', null, 'anon não executa administracao_eh_admin');
select throws_ok($$insert into public.catalogo_categoria (nome, slug) values ('Nova', 'nova')$$, '42501', null, 'anon não insere categoria');

-- Administrador
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select is(public.administracao_eh_admin(), true, 'administrador reconhecido');
select is((select count(*)::int from public.catalogo_categoria), 2, 'administrador vê categoria inativa');
select is((select count(*)::int from public.catalogo_categoria_solicitacao), 5, 'administrador vê os pedidos');
select lives_ok($$select public.catalogo_criar_categoria('Pet shop', 'pet-shop', 3)$$, 'administrador cria categoria');
select throws_ok($$select public.catalogo_criar_categoria('Outra', 'pet-shop', 3)$$, '23505', null, 'slug de categoria duplicado é rejeitado');
select throws_ok($$select public.catalogo_criar_categoria('pet SHOP', 'pet-shop-2', 3)$$, '23505', null, 'nome de categoria duplicado (sem diferenciar caixa) é rejeitado');
select throws_ok($$select public.catalogo_criar_categoria('Ruim', 'Slug Ruim', 3)$$, '23514', null, 'slug inválido é rejeitado');
select throws_ok($$select public.catalogo_alterar_categoria('11111111-0000-0000-0000-000000000001', 'Alimentação', false, 1, '  ')$$, '22023', null, 'alterar categoria exige motivo');
select lives_ok($$select public.catalogo_alterar_categoria('11111111-0000-0000-0000-000000000001', 'Alimentos', true, 1, 'renomeada')$$, 'administrador altera categoria com motivo');
select is((select valor_anterior ->> 'nome' from public.administracao_auditoria where acao = 'categoria_alterada'), 'Alimentação', 'auditoria guarda o valor anterior');
select is((select motivo from public.administracao_auditoria where acao = 'categoria_alterada'), 'renomeada', 'auditoria guarda o motivo');
select is((select autor_id from public.administracao_auditoria where acao = 'categoria_alterada'), 'dddddddd-0000-0000-0000-00000000000d'::uuid, 'auditoria guarda o autor');
select throws_ok($$select public.catalogo_decidir_solicitacao((select id from public.catalogo_categoria_solicitacao order by criado_em, id limit 1), false, '', null)$$, '22023', null, 'recusar pedido exige motivo');
select lives_ok($$select public.catalogo_decidir_solicitacao((select id from public.catalogo_categoria_solicitacao where nome_sugerido = 'Pet shop'), true, null, (select id from public.catalogo_categoria where slug = 'pet-shop'))$$, 'administrador atende o pedido');
select throws_ok($$select public.catalogo_decidir_solicitacao((select id from public.catalogo_categoria_solicitacao where nome_sugerido = 'Pet shop'), false, 'tarde', null)$$, 'P0001', null, 'pedido decidido não é decidido de novo');
select throws_ok($$delete from public.catalogo_categoria where slug = 'pet-shop'$$, '42501', null, 'nem administrador apaga categoria direto');

reset role;
select throws_ok($$update public.administracao_auditoria set motivo = 'x'$$, '42501', null, 'auditoria é imutável (update)');
select throws_ok($$delete from public.administracao_auditoria$$, '42501', null, 'auditoria é imutável (delete)');
select throws_ok($$update public.catalogo_categoria_solicitacao set nome_sugerido = 'Outro' where nome_sugerido = 'Pet shop'$$, '42501', null, 'pedido decidido é imutável');
select is((select nome from public.catalogo_categoria where id = '11111111-0000-0000-0000-000000000001'), 'Alimentos', 'categoria só mudou pela função do administrador');

select * from finish();
rollback;
