-- pgTAP · tetos de criação por conta (D-035) · IM-006, IM-011, IM-014, IM-015, IM-086, IM-089
-- 3 perfis comerciais por conta, 30 itens por perfil, 10 anúncios particulares por conta, 10 rascunhos abertos por conta;
-- administradores sem teto; parâmetros auditados em contas_parametro; erro P0430 'teto_atingido:<chave>'.
begin;
select * from no_plan();
delete from public.catalogo_categoria;

-- A e B = contas comuns; R = conta dos rascunhos; D = administrador geral.
insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@teste.local'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@teste.local'),
  ('cccccccc-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'r@teste.local'),
  ('dddddddd-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd@teste.local');
insert into public.administracao_administrador (conta_id) values ('dddddddd-0000-0000-0000-00000000000d');
insert into public.catalogo_categoria (id, nome, slug, ativa, ordem) values
  ('11111111-0000-0000-0000-000000000001', 'Alimentação', 'alimentacao', true, 1);

-- ===== Estrutura e padrões =====
select is((select valor from public.contas_parametro where chave = 'tetos_perfis_por_conta'), 3, 'padrão: 3 perfis por conta');
select is((select valor from public.contas_parametro where chave = 'tetos_itens_por_perfil'), 30, 'padrão: 30 itens por perfil');
select is((select valor from public.contas_parametro where chave = 'tetos_anuncios_particulares'), 10, 'padrão: 10 anúncios particulares por conta');
select is((select valor from public.contas_parametro where chave = 'tetos_rascunhos_abertos'), 10, 'padrão: 10 rascunhos abertos por conta');
select is((select string_agg(chave || ':' || minimo || '-' || maximo, ',' order by chave) from public.contas_parametro where chave like 'tetos\_%'),
  'tetos_anuncios_particulares:1-200,tetos_itens_por_perfil:1-500,tetos_perfis_por_conta:1-50,tetos_rascunhos_abertos:1-100', 'faixas dos tetos');
select is(has_function_privilege('authenticated', 'public.contas_exigir_teto_criacao(uuid,text,uuid)', 'EXECUTE')
  or has_function_privilege('anon', 'public.contas_exigir_teto_criacao(uuid,text,uuid)', 'EXECUTE'), false, 'a guarda de teto é interna (não chamável pela API)');
select is(has_function_privilege('anon', 'public.contas_limites_criacao_atuais()', 'EXECUTE'), false, 'anon não lê os limites');

-- ===== Administrador não tem teto (antes de qualquer ajuste dos padrões) =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select lives_ok($$select count(*)::int from (select (public.perfis_criar_rascunho('d-perfil-' || n, '+55119888803' || lpad(n::text, 2, '0'))).o_perfil_id from generate_series(1, 5) n) s$$,
  'administrador cria 5 perfis (acima do teto de 3 e dos 10 rascunhos somados)');
select lives_ok($$select count(*)::int from (select (public.catalogo_criar_item('produto', null, p_nome => 'Item D' || n)).o_item_id from generate_series(1, 12) n) s$$,
  'administrador cria 12 anúncios particulares (acima do teto de 10)');
reset role;
select is((select count(*)::int from public.perfis_perfil where responsavel_id = 'dddddddd-0000-0000-0000-00000000000d'), 5, 'os 5 perfis do administrador existem');

-- ===== Rascunhos abertos: 10 somados (perfis + itens), enviar libera =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select lives_ok($$select count(*)::int from (select (public.perfis_criar_rascunho('r-perfil-' || n, '+55119888804' || lpad(n::text, 2, '0'))).o_perfil_id from generate_series(1, 3) n) s$$,
  'R cria 3 perfis (3 rascunhos)');
select lives_ok($$select count(*)::int from (select (public.catalogo_criar_item('produto', null, p_nome => 'Item R' || n, p_descricao => 'Descrição', p_categoria_principal_id => '11111111-0000-0000-0000-000000000001', p_cidade => 'Recife', p_uf => 'PE')).o_item_id from generate_series(1, 7) n) s$$,
  'R cria 7 anúncios (10 rascunhos no total)');
select throws_ok($$select public.catalogo_criar_item('produto', null, p_nome => 'Item R8')$$, 'P0430', 'teto_atingido:tetos_rascunhos_abertos', 'o 11o rascunho (anúncio, abaixo do teto de anúncios) é recusado pelo teto de rascunhos');
select throws_ok($$select * from public.perfis_criar_rascunho('r-perfil-9', '+5511988880499')$$, 'P0430', null, 'perfil novo também é recusado (já são 3 perfis)');
select lives_ok($$update public.catalogo_item_versao v set foto_path = 'item/' || v.item_id::text || '/f.jpg' where nome = 'Item R1'$$, 'foto do rascunho R1');
select lives_ok($$select public.catalogo_enviar_item_versao((select id from public.catalogo_item_versao where nome = 'Item R1' and situacao = 'rascunho'))$$, 'R envia o item R1 para revisão');
select lives_ok($$select public.catalogo_criar_item('produto', null, p_nome => 'Item R8')$$, 'enviado deixa de ser rascunho aberto: R cria o próximo');
select throws_ok($$select public.catalogo_criar_item('produto', null, p_nome => 'Item R9')$$, 'P0430', 'teto_atingido:tetos_rascunhos_abertos', 'e volta a ficar no teto de rascunhos (10)');
reset role;
select is((select count(*)::int from public.catalogo_item where conta_id = 'cccccccc-0000-0000-0000-00000000000c'), 8, 'a criação recusada não deixou item órfão (8 itens)');

-- ===== Perfis por conta: 3 passam, o 4o não =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select set_config('t.pa1', (select o_perfil_id::text from public.perfis_criar_rascunho('a-perfil-1', '+5511988880201')), true);
select set_config('t.pa2', (select o_perfil_id::text from public.perfis_criar_rascunho('a-perfil-2', '+5511988880202')), true);
select lives_ok($$select * from public.perfis_criar_rascunho('a-perfil-3', '+5511988880203')$$, 'o 3o perfil passa (no teto exato)');
select throws_ok($$select * from public.perfis_criar_rascunho('a-perfil-4', '+5511988880204')$$, 'P0430', 'teto_atingido:tetos_perfis_por_conta', 'o 4o perfil é recusado com a chave do teto');
select throws_ok($$select * from public.perfis_criar_rascunho('a-perfil-4', '+5511988880204')$$, 'P0430', null, 'e continua recusado ao repetir');
reset role;
select is((select count(*)::int from public.perfis_perfil where responsavel_id = 'aaaaaaaa-0000-0000-0000-00000000000a'), 3, 'a recusa não deixou perfil parcial (3 perfis)');
select is((select count(*)::int from public.perfis_perfil_versao v join public.perfis_perfil p on p.id = v.perfil_id where p.responsavel_id = 'aaaaaaaa-0000-0000-0000-00000000000a'), 3, 'nem versão órfã');

-- Isolamento: B não é afetado pelo teto de A, e não cria item no perfil de A.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select lives_ok($$select * from public.perfis_criar_rascunho('b-perfil-1', '+5511988880301')$$, 'B cria o primeiro perfil (conta diferente, teto próprio)');
select lives_ok($$select * from public.catalogo_criar_item('servico', null, p_nome => 'Serviço B')$$, 'B cria um anúncio');
select throws_ok($$select * from public.catalogo_criar_item('produto', current_setting('t.pa1')::uuid, p_nome => 'Invasão')$$, '23503', null, 'B não cria item no perfil de A (a chave composta barra; o teto de A não vira informação para B)');
select throws_ok($$select count(*) from public.contas_parametro$$, '42501', null, 'cliente não lê a tabela de parâmetros (só por função)');
select is((select count(*)::int from public.contas_limites_criacao_atuais()), 4, 'mas lê os 4 limites vigentes por função');
select is((select o_valor from public.contas_limites_criacao_atuais() where o_chave = 'tetos_perfis_por_conta'), 3, 'valor do teto de perfis');
select throws_ok($$insert into public.perfis_perfil (responsavel_id, slug) values ('bbbbbbbb-0000-0000-0000-00000000000b', 'furo-direto')$$, '42501', null, 'sem INSERT direto: o teto não é contornado pela tabela');
select throws_ok($$update public.contas_parametro set valor = 99 where chave = 'tetos_perfis_por_conta'$$, '42501', null, 'cliente não altera o teto direto');
select throws_ok($$select public.contas_definir_parametro('tetos_perfis_por_conta', 50, 'tentativa')$$, '42501', null, 'usuário comum não altera o teto pela função administrativa');
reset role;

-- ===== Parâmetros: faixa, motivo, auditoria =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select throws_ok($$select public.contas_definir_parametro('tetos_perfis_por_conta', 0, 'faixa')$$, '22023', null, 'perfis: abaixo da faixa (0)');
select throws_ok($$select public.contas_definir_parametro('tetos_perfis_por_conta', 51, 'faixa')$$, '22023', null, 'perfis: acima da faixa (51)');
select throws_ok($$select public.contas_definir_parametro('tetos_itens_por_perfil', 501, 'faixa')$$, '22023', null, 'itens: acima da faixa (501)');
select throws_ok($$select public.contas_definir_parametro('tetos_anuncios_particulares', 201, 'faixa')$$, '22023', null, 'anúncios: acima da faixa (201)');
select throws_ok($$select public.contas_definir_parametro('tetos_rascunhos_abertos', 101, 'faixa')$$, '22023', null, 'rascunhos: acima da faixa (101)');
select throws_ok($$select public.contas_definir_parametro('tetos_rascunhos_abertos', 50, '')$$, '22023', null, 'motivo obrigatório');
select lives_ok($$select public.contas_definir_parametro('tetos_rascunhos_abertos', 100, 'isolar os testes de item e de anúncio')$$, 'administrador sobe o teto de rascunhos para 100');
reset role;
select is((select valor_anterior ->> 'valor' from public.administracao_auditoria where acao = 'definir_parametro_contas' and alvo_id = 'tetos_rascunhos_abertos'), '10', 'auditoria: valor anterior');
select is((select valor_novo ->> 'valor' from public.administracao_auditoria where acao = 'definir_parametro_contas' and alvo_id = 'tetos_rascunhos_abertos'), '100', 'auditoria: valor novo');
select is((select motivo from public.administracao_auditoria where acao = 'definir_parametro_contas' and alvo_id = 'tetos_rascunhos_abertos'), 'isolar os testes de item e de anúncio', 'auditoria: motivo');
select is((select autor_id from public.administracao_auditoria where acao = 'definir_parametro_contas' and alvo_id = 'tetos_rascunhos_abertos'), 'dddddddd-0000-0000-0000-00000000000d'::uuid, 'auditoria: autor');

-- ===== Itens por perfil: 30 passam, o 31o não; outro perfil e anúncios seguem =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$select count(*)::int from (select (public.catalogo_criar_item('produto', current_setting('t.pa1')::uuid, p_nome => 'Item A' || n)).o_item_id from generate_series(1, 30) n) s$$,
  'A cria 30 itens no perfil 1 (no teto exato)');
select throws_ok($$select * from public.catalogo_criar_item('produto', current_setting('t.pa1')::uuid, p_nome => 'Item A31')$$, 'P0430', 'teto_atingido:tetos_itens_por_perfil', 'o 31o item do perfil 1 é recusado');
select lives_ok($$select * from public.catalogo_criar_item('produto', current_setting('t.pa2')::uuid, p_nome => 'Item no perfil 2')$$, 'o teto é por perfil: o perfil 2 aceita item');
-- Anúncios particulares: 10 passam, o 11o não (os itens de perfil não contam como anúncio).
select lives_ok($$select count(*)::int from (select (public.catalogo_criar_item('servico', null, p_nome => 'Anúncio A' || n)).o_item_id from generate_series(1, 10) n) s$$,
  'A cria 10 anúncios particulares (no teto exato; os 31 itens de perfil não contam)');
select throws_ok($$select * from public.catalogo_criar_item('servico', null, p_nome => 'Anúncio A11')$$, 'P0430', 'teto_atingido:tetos_anuncios_particulares', 'o 11o anúncio particular é recusado');
select throws_ok($$select * from public.catalogo_criar_item('servico', null, p_nome => 'Anúncio A11')$$, 'P0430', null, 'e continua recusado ao repetir');
reset role;
select is((select count(*)::int from public.catalogo_item where conta_id = 'aaaaaaaa-0000-0000-0000-00000000000a' and perfil_id = current_setting('t.pa1')::uuid), 30, 'o perfil 1 ficou com exatamente 30 itens');
select is((select count(*)::int from public.catalogo_item where conta_id = 'aaaaaaaa-0000-0000-0000-00000000000a' and perfil_id is null), 10, 'A ficou com exatamente 10 anúncios');

-- ===== Reduzir o teto não afeta o que já existe; só barra novas criações =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select lives_ok($$select public.contas_definir_parametro('tetos_perfis_por_conta', 1, 'reduzir para testar')$$, 'administrador reduz o teto de perfis para 1');
reset role;
select is((select count(*)::int from public.perfis_perfil where responsavel_id = 'aaaaaaaa-0000-0000-0000-00000000000a'), 3, 'os 3 perfis de A continuam existindo');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select throws_ok($$select * from public.perfis_criar_rascunho('b-perfil-2', '+5511988880302')$$, 'P0430', 'teto_atingido:tetos_perfis_por_conta', 'com o teto em 1, o segundo perfil de B é recusado');
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select lives_ok($$select * from public.perfis_criar_rascunho('d-perfil-6', '+5511988880306')$$, 'administrador segue sem teto');
reset role;

select * from finish();
rollback;
