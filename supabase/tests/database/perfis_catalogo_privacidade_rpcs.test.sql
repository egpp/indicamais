-- pgTAP · privacidade do responsável, RPCs de criação atômica e resultado da revisão (IM-023)
-- IM-006, IM-011, IM-014, IM-015, IM-021, IM-022, IM-023, IM-029, IM-086
-- Prova: (1) nenhuma leitura pública revela conta_id/responsavel_id, WhatsApp comercial nem e-mail, por tabela, visão
-- ou função; (2) caminhos de imagem são opacos; (3) usuário A não cria nem edita em nome de B; (4) falha parcial não
-- deixa perfil/item órfão; (5) administracao_meus_resultados mostra ao responsável só o que é dele.
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
  ('11111111-0000-0000-0000-000000000001', 'Alimentação', 'alimentacao', true, 1);

create schema t;
grant usage on schema t to anon, authenticated;
create function t.perfil(p text) returns uuid language sql stable as $$ select id from public.perfis_perfil where slug = p $$;
create function t.pf(p text) returns text language sql stable as $$
  select 'perfil/' || (select id from public.perfis_perfil where slug = p)::text $$;
create function t.versao(p text, s text) returns uuid language sql stable as $$
  select id from public.perfis_perfil_versao where perfil_id = (select id from public.perfis_perfil where slug = p) and situacao = s $$;
create function t.item() returns uuid language sql stable security definer as $$
  select id from public.catalogo_item where perfil_id is null limit 1 $$;
create function t.itemv(s text) returns uuid language sql stable security definer as $$
  select id from public.catalogo_item_versao where item_id = (select id from public.catalogo_item where perfil_id is null limit 1) and situacao = s $$;

-- ===== Contrato estático: colunas das visões e privilégios =====
select columns_are('public', 'perfis_perfil_publico', array['id', 'slug', 'nome', 'descricao_breve', 'imagem_path',
  'categoria_principal_id', 'categoria_secundaria_1_id', 'categoria_secundaria_2_id', 'cidade', 'uf', 'endereco',
  'areas_atendidas', 'banners_paths', 'fotos_paths', 'site', 'informacoes_sociais'], 'colunas da visão pública do perfil');
select columns_are('public', 'catalogo_item_publico', array['id', 'perfil_id', 'tipo', 'nome', 'descricao', 'foto_path',
  'categoria_principal_id', 'categoria_secundaria_1_id', 'categoria_secundaria_2_id', 'preco_modo', 'preco_centavos', 'criado_em'],
  'colunas da visão pública do item');
select columns_are('public', 'administracao_meus_resultados', array['tipo', 'alvo_id', 'versao_id', 'situacao', 'nome', 'motivo',
  'decidida_em', 'enviada_em', 'autor_ref', 'slug', 'publicado', 'versao_vigente'], 'colunas do resultado da revisão (sem nome nem e-mail do autor)');
select is(has_column_privilege('anon', 'public.perfis_perfil', 'responsavel_id', 'select'), false, 'anon não lê responsavel_id');
select is(has_column_privilege('authenticated', 'public.perfis_perfil', 'responsavel_id', 'select'), false, 'usuário logado não lê responsavel_id');
select is(has_column_privilege('anon', 'public.catalogo_item', 'conta_id', 'select'), false, 'anon não lê conta_id');
select is(has_column_privilege('authenticated', 'public.catalogo_item', 'conta_id', 'select'), false, 'usuário logado não lê conta_id');
select is(has_table_privilege('anon', 'public.perfis_perfil_versao_contato', 'select'), false, 'anon não lê WhatsApp comercial');
select is(has_table_privilege('anon', 'public.administracao_meus_resultados', 'select'), false, 'anon não lê resultados de revisão');
select is(has_table_privilege('anon', 'public.perfis_meus_perfis', 'select') or has_table_privilege('anon', 'public.catalogo_meus_itens', 'select'), false, 'anon não lê as listas "meus"');
select is(has_table_privilege('authenticated', 'public.perfis_perfil', 'insert') or has_table_privilege('authenticated', 'public.catalogo_item', 'insert'), false, 'ninguém cria perfil/item por INSERT direto');

-- Funções executáveis por anon: só as booleanas públicas, nenhuma devolve dado.
select is((select coalesce(array_agg(p.proname::text order by p.proname), '{}'::text[])
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind = 'f' and has_function_privilege('anon', p.oid, 'execute')
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')),
  array['catalogo_imagem_publica', 'perfis_perfil_disponivel'], 'anon executa só as funções públicas esperadas');
select is((select count(*)::int
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind = 'f' and has_function_privilege('anon', p.oid, 'execute')
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
    and p.prorettype <> 'boolean'::regtype), 0, 'nenhuma função executável por anon devolve dado (só boolean)');
select is((select count(*)::int
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('perfis_criar_rascunho', 'perfis_gravar_versao', 'catalogo_criar_item')
    and (has_function_privilege('anon', p.oid, 'execute') or not has_function_privilege('authenticated', p.oid, 'execute'))), 0, 'RPCs de criação: só authenticated executa');

-- ===== A monta perfil, perfil rejeitado e anúncio =====
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select lives_ok($$select public.perfis_criar_rascunho('loja-ana', '+5551999990001')$$, 'A cria o perfil loja-ana');
select lives_ok($$select public.perfis_gravar_versao(p_perfil_id => t.perfil('loja-ana'), p_whatsapp_comercial => '+5551999990001',
  p_nome => 'Loja da Ana', p_descricao_breve => 'Doces caseiros', p_imagem_path => t.pf('loja-ana') || '/capa.jpg',
  p_categoria_principal_id => '11111111-0000-0000-0000-000000000001', p_cidade => 'Porto Alegre', p_uf => 'RS',
  p_banners_paths => array[t.pf('loja-ana') || '/b1.jpg'], p_fotos_paths => array[t.pf('loja-ana') || '/f1.jpg', t.pf('loja-ana') || '/f2.jpg'])$$, 'A grava versão completa de loja-ana');
select lives_ok($$select public.perfis_enviar_versao(t.versao('loja-ana', 'rascunho'))$$, 'A envia loja-ana');

select lives_ok($$select public.perfis_criar_rascunho('padaria-ana', '+5551999990004')$$, 'A cria o perfil padaria-ana');
select lives_ok($$select public.perfis_gravar_versao(p_perfil_id => t.perfil('padaria-ana'), p_whatsapp_comercial => '+5551999990004',
  p_nome => 'Padaria da Ana', p_descricao_breve => 'Pães', p_imagem_path => t.pf('padaria-ana') || '/capa.jpg',
  p_categoria_principal_id => '11111111-0000-0000-0000-000000000001', p_cidade => 'Canoas', p_uf => 'RS')$$, 'A grava padaria-ana');
select lives_ok($$select public.perfis_enviar_versao(t.versao('padaria-ana', 'rascunho'))$$, 'A envia padaria-ana');
select throws_ok($$select public.perfis_gravar_versao(p_perfil_id => t.perfil('padaria-ana'), p_whatsapp_comercial => '+5551999990004', p_nome => 'Mexe na pendente')$$, 'P0001', null, 'versão pendente não pode ser regravada');

select lives_ok($$select public.catalogo_criar_item('produto', null, p_nome => 'Bicicleta', p_descricao => 'Aro 29',
  p_categoria_principal_id => '11111111-0000-0000-0000-000000000001', p_preco_modo => 'fixo', p_preco_centavos => 120000)$$, 'A cria anúncio particular');
select lives_ok($$update public.catalogo_item_versao set foto_path = 'item/' || (select id from public.catalogo_meus_itens)::text || '/bike.jpg' where situacao = 'rascunho'$$, 'A grava a foto opaca do anúncio');
select lives_ok($$select public.catalogo_enviar_item_versao((select id from public.catalogo_item_versao where situacao = 'rascunho'))$$, 'A envia o anúncio');

-- IM-023: resultado pendente
select is((select count(*)::int from public.administracao_meus_resultados), 3, 'A vê as 3 versões enviadas');
select is((select count(*)::int from public.administracao_meus_resultados where situacao = 'pendente' and autor_ref is null and motivo is null and decidida_em is null), 3, 'pendente: sem autor, motivo nem data de decisão');
select is((select count(*)::int from public.administracao_meus_resultados where situacao = 'rascunho'), 0, 'rascunho não aparece como resultado');

-- ===== Administrador decide =====
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select lives_ok($$select public.perfis_decidir_versao(t.versao('loja-ana', 'pendente'), true, null)$$, 'administrador aprova loja-ana');
select lives_ok($$select public.perfis_decidir_versao(t.versao('padaria-ana', 'pendente'), false, 'Fotos escuras')$$, 'administrador rejeita padaria-ana');
select lives_ok($$select public.catalogo_decidir_item_versao(t.itemv('pendente'), true, null)$$, 'administrador aprova o anúncio');
select is((select count(*)::int from public.administracao_meus_resultados), 0, 'administrador sem perfis próprios não vê resultados de outros (filtro é por dono, não por papel)');

-- ===== A lê o resultado e publica =====
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is((select situacao from public.administracao_meus_resultados where tipo = 'perfil' and slug = 'padaria-ana'), 'rejeitada', 'resultado: padaria rejeitada');
select is((select motivo from public.administracao_meus_resultados where tipo = 'perfil' and slug = 'padaria-ana'), 'Fotos escuras', 'resultado traz o motivo');
select isnt((select decidida_em from public.administracao_meus_resultados where tipo = 'perfil' and slug = 'padaria-ana'), null, 'resultado traz a data da decisão');
select is((select length(autor_ref) from public.administracao_meus_resultados where tipo = 'perfil' and slug = 'padaria-ana'), 64, 'autor_ref é hash opaco');
select is((select count(*)::int from public.administracao_meus_resultados where autor_ref ~* 'dddddddd' or to_jsonb(administracao_meus_resultados)::text ~* 'dddddddd|d@teste.local'), 0, 'resultado não traz o id nem o e-mail do administrador');
select is((select situacao || '/' || versao_vigente::text from public.administracao_meus_resultados where tipo = 'perfil' and slug = 'loja-ana'), 'aprovada/true', 'loja-ana: aprovada e vigente');
select is((select slug from public.administracao_meus_resultados where tipo = 'item'), null, 'item não tem slug');
select is((select situacao from public.administracao_meus_resultados where tipo = 'item'), 'aprovada', 'anúncio aprovado');
select is((select count(*)::int from public.perfis_meus_perfis), 2, 'perfis_meus_perfis lista os 2 perfis de A');
select lives_ok($$update public.perfis_perfil set publicado = true where slug = 'loja-ana'$$, 'A publica loja-ana');
select lives_ok($$update public.catalogo_item set publicado = true where id = (select id from public.catalogo_meus_itens)$$, 'A publica o anúncio');

-- ===== Leitura pública: anon =====
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.perfis_perfil_publico), 1, 'anon vê o perfil publicado');
select is((select count(*)::int from public.catalogo_item_publico), 1, 'anon vê o anúncio publicado');
select is((select imagem_path from public.perfis_perfil_publico), 'perfil/' || (select id from public.perfis_perfil_publico)::text || '/capa.jpg', 'imagem_path é perfil/<perfil_id>/<arquivo>');
select is((select count(*)::int from public.perfis_perfil_publico v where v.banners_paths[1] <> 'perfil/' || v.id::text || '/b1.jpg' or exists (select 1 from unnest(v.fotos_paths) f where f !~ ('^perfil/' || v.id::text || '/[A-Za-z0-9._-]+$'))), 0, 'banners e fotos seguem o formato opaco');
select is((select foto_path from public.catalogo_item_publico), 'item/' || (select id from public.catalogo_item_publico)::text || '/bike.jpg', 'foto_path é item/<item_id>/<arquivo>');
select is((select count(*)::int from public.perfis_perfil_publico v where to_jsonb(v)::text ~* 'aaaaaaaa|a@teste.local|5551999990001|\+55'), 0, 'linha pública do perfil não contém id da conta, e-mail nem WhatsApp');
select is((select count(*)::int from public.catalogo_item_publico v where to_jsonb(v)::text ~* 'aaaaaaaa|a@teste.local|\+55'), 0, 'linha pública do item não contém id da conta, e-mail nem WhatsApp');
select throws_ok($$select responsavel_id from public.perfis_perfil$$, '42501', null, 'anon: responsavel_id negado');
select throws_ok($$select to_jsonb(p) from public.perfis_perfil p$$, '42501', null, 'anon: linha inteira do perfil negada (to_jsonb)');
select throws_ok($$select * from public.perfis_perfil$$, '42501', null, 'anon: select * negado (coluna sem privilégio)');
select throws_ok($$select conta_id from public.catalogo_item$$, '42501', null, 'anon: conta_id negado');
select throws_ok($$select to_jsonb(i) from public.catalogo_item i$$, '42501', null, 'anon: linha inteira do item negada');
select throws_ok($$select * from public.perfis_perfil_versao_contato$$, '42501', null, 'anon: WhatsApp comercial negado');
select throws_ok($$select * from public.administracao_meus_resultados$$, '42501', null, 'anon: resultados negados');
select throws_ok($$select * from public.perfis_meus_perfis$$, '42501', null, 'anon: perfis_meus_perfis negado');
select throws_ok($$select public.perfis_criar_rascunho('anon-perfil', '+5551999990009')$$, '42501', null, 'anon não executa perfis_criar_rascunho');
select throws_ok($$select public.perfis_gravar_versao(gen_random_uuid(), '+5551999990009')$$, '42501', null, 'anon não executa perfis_gravar_versao');
select throws_ok($$select public.catalogo_criar_item('produto')$$, '42501', null, 'anon não executa catalogo_criar_item');
select is((select count(*)::int from public.perfis_perfil_versao v where to_jsonb(v)::text ~* 'aaaaaaaa|\+55'), 0, 'versões lidas por anon não trazem id da conta nem WhatsApp');
select is((select count(*)::int from public.catalogo_item_versao v where to_jsonb(v)::text ~* 'aaaaaaaa'), 0, 'versões de item lidas por anon não trazem id da conta');
select is(public.perfis_perfil_disponivel((select id from public.perfis_perfil_publico)), true, 'função pública devolve só boolean');

-- ===== B (logado, não dono) =====
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select throws_ok($$select responsavel_id from public.perfis_perfil$$, '42501', null, 'B: responsavel_id do perfil público negado');
select throws_ok($$select to_jsonb(p) from public.perfis_perfil p$$, '42501', null, 'B: linha inteira do perfil negada');
select throws_ok($$select conta_id from public.catalogo_item$$, '42501', null, 'B: conta_id do item público negado');
select lives_ok($$select id, slug, publicado from public.perfis_perfil$$, 'B lê as colunas públicas do perfil');
select is((select count(*)::int from public.perfis_perfil_publico v where to_jsonb(v)::text ~* 'aaaaaaaa|a@teste.local|\+55'), 0, 'B: linha pública do perfil sem dado privado');
select is((select count(*)::int from public.catalogo_item_publico v where to_jsonb(v)::text ~* 'aaaaaaaa|a@teste.local|\+55'), 0, 'B: linha pública do item sem dado privado');
select is((select count(*)::int from public.perfis_perfil_versao_contato), 0, 'B não lê WhatsApp comercial de A');
select is((select count(*)::int from public.administracao_meus_resultados), 0, 'B não lê resultados de A');
select is((select count(*)::int from public.perfis_meus_perfis) + (select count(*)::int from public.catalogo_meus_itens), 0, 'B não lista perfis nem itens de A');
select is((select count(*)::int from public.perfis_revisao) + (select count(*)::int from public.catalogo_item_revisao), 0, 'B não lê revisões de A');
select throws_ok($$select public.perfis_gravar_versao(p_perfil_id => t.perfil('loja-ana'), p_whatsapp_comercial => '+5551999990009', p_nome => 'invasão')$$, '42501', null, 'B não grava versão no perfil de A');
select throws_ok($$select public.perfis_gravar_versao(p_perfil_id => t.perfil('padaria-ana'), p_whatsapp_comercial => '+5551999990009', p_nome => 'invasão')$$, '42501', null, 'B não grava versão em perfil de A (nem em perfil despublicado, que ele nem vê)');
select throws_ok($$select public.catalogo_criar_item('produto', (select id from public.perfis_perfil_publico limit 1))$$, '23503', null, 'B não cria item no perfil de A');
select throws_ok($$insert into public.perfis_perfil (responsavel_id, slug) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'em-nome-de-a')$$, '42501', null, 'B não cria perfil em nome de A por INSERT');
select throws_ok($$insert into public.catalogo_item (conta_id, tipo) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'produto')$$, '42501', null, 'B não cria item em nome de A por INSERT');
update public.perfis_perfil set publicado = false where slug = 'loja-ana';
update public.catalogo_item set publicado = false;
select lives_ok($$select public.perfis_criar_rascunho('loja-bia', '+5551999990002')$$, 'B cria o próprio perfil');
select lives_ok($$select public.catalogo_criar_item('servico', null, p_nome => 'Aula')$$, 'B cria o próprio item');

reset role;
select is((select responsavel_id from public.perfis_perfil where slug = 'loja-bia'), 'bbbbbbbb-0000-0000-0000-00000000000b'::uuid, 'o responsável do perfil criado por B é B (sempre auth.uid())');
select is((select conta_id from public.catalogo_item where tipo = 'servico'), 'bbbbbbbb-0000-0000-0000-00000000000b'::uuid, 'o dono do item criado por B é B');
select is((select publicado from public.perfis_perfil where slug = 'loja-ana'), true, 'B não despublicou o perfil de A');
select is((select count(*)::int from public.catalogo_item where publicado), 1, 'B não despublicou o anúncio de A');
select is((select count(*)::int from public.perfis_perfil_versao where perfil_id = (select id from public.perfis_perfil where slug = 'loja-ana')), 1, 'A versão de A segue única (B não gravou nada)');
select is((select count(*)::int from public.perfis_perfil where responsavel_id = 'aaaaaaaa-0000-0000-0000-00000000000a'), 2, 'A segue com 2 perfis');

select * from finish();
rollback;
