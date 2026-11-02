-- pgTAP · módulo perfis · banner de topo rotativo · Fase 8
-- IM-093, IM-012, IM-022, IM-029, IM-079, IM-080, IM-086, D-016
-- Responsável grava os banners no rascunho (revisão e versionamento normais); administrador adiciona na empresa e o banner só
-- vai ao ar depois do aceite do responsável; tudo auditado; sem link externo; limite de 6; leitura pública só do que está no ar.
begin;
select * from no_plan();
delete from public.catalogo_categoria;

-- A = responsável de P1 (publicado) e P2 (aprovado, despublicado); C = outra conta, responsável de P3; D = administrador geral;
-- E = só permissão aprovar, responsável de P4; G = conta comum sem permissão.
insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@teste.local'),
  ('cccccccc-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c@teste.local'),
  ('dddddddd-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd@teste.local'),
  ('eeeeeeee-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'e@teste.local'),
  ('99999999-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'g@teste.local');
insert into public.administracao_administrador (conta_id) values ('dddddddd-0000-0000-0000-00000000000d');
insert into public.administracao_permissao (conta_id, permissao, concedida_por, motivo) values
  ('eeeeeeee-0000-0000-0000-00000000000e', 'aprovar', 'dddddddd-0000-0000-0000-00000000000d', 'teste');
insert into public.catalogo_categoria (id, nome, slug, ativa, ordem) values
  ('11111111-0000-0000-0000-000000000001', 'Alimentação', 'alimentacao', true, 1);
insert into public.perfis_perfil (id, responsavel_id, slug) values
  ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a', 'loja-um'),
  ('a0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-00000000000a', 'loja-dois'),
  ('a0000000-0000-0000-0000-000000000003', 'cccccccc-0000-0000-0000-00000000000c', 'loja-tres'),
  ('a0000000-0000-0000-0000-000000000004', 'eeeeeeee-0000-0000-0000-00000000000e', 'loja-quatro');
insert into public.perfis_perfil_versao (id, perfil_id, nome, descricao_breve, imagem_path, categoria_principal_id, cidade, uf)
select ('a1000000-0000-0000-0000-00000000000' || n)::uuid, ('a0000000-0000-0000-0000-00000000000' || n)::uuid, 'Loja ' || n, 'Doces',
       'perfil/a0000000-0000-0000-0000-00000000000' || n || '/c.jpg', '11111111-0000-0000-0000-000000000001', 'Porto Alegre', 'RS'
from generate_series(1, 4) n;
insert into public.perfis_perfil_versao_contato (versao_id, whatsapp_comercial_e164)
select id, '+55519888800' || right(id::text, 2) from public.perfis_perfil_versao;
update public.perfis_perfil_versao set situacao = 'pendente', enviada_em = now();
update public.perfis_perfil_versao set situacao = 'aprovada';
update public.perfis_perfil set versao_aprovada_id = ('a1000000-0000-0000-0000-00000000000' || right(id::text, 1))::uuid;
update public.perfis_perfil set publicado = true where right(id::text, 1) in ('1', '3', '4');

create schema t;
grant usage on schema t to anon, authenticated;
-- Pasta opaca do perfil n.
create function t.pasta(n integer) returns text language sql immutable as $$ select 'perfil/a0000000-0000-0000-0000-00000000000' || n || '/' $$;
create function t.p(n integer) returns uuid language sql immutable as $$ select ('a0000000-0000-0000-0000-00000000000' || n)::uuid $$;
grant execute on function t.pasta(integer), t.p(integer) to anon, authenticated;

-- ===== Estrutura =====
select is((select bool_and(relrowsecurity and relforcerowsecurity) from pg_class where oid = 'public.perfis_banner'::regclass), true, 'RLS ativa e forçada em perfis_banner');
select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'perfis_banner'), 6, 'perfis_banner: política por operação (3 select + 3 negados)');
select is((select bool_or(has_table_privilege(r, 'public.perfis_banner', p))
  from unnest(array['anon', 'authenticated']) r, unnest(array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) p), false, 'nenhum papel de API escreve direto em perfis_banner');
select is(has_column_privilege('anon', 'public.perfis_banner', 'autor_admin_id', 'SELECT') or has_column_privilege('authenticated', 'public.perfis_banner', 'autor_admin_id', 'SELECT'),
  false, 'nenhum papel lê o id do administrador autor');
select is(has_column_privilege('anon', 'public.perfis_banner', 'motivo_resposta', 'SELECT'), false, 'anon não lê o motivo da recusa');
select columns_are('public', 'perfis_banner_publico', array['id', 'perfil_id', 'imagem_path', 'texto_alternativo', 'destino_secao', 'ordem'], 'visão pública sem conta, sem autor e sem situação');
select is((select count(*)::int from information_schema.columns where table_schema = 'public' and table_name = 'perfis_banner'
  and (column_name ~* '(url|link|http|rede|instagram|facebook)')), 0, 'não existe coluna de link externo (IM-012)');
select is(has_function_privilege('anon', 'public.perfis_gravar_banners(uuid,jsonb)', 'EXECUTE')
  or has_function_privilege('anon', 'public.perfis_responder_banner(uuid,boolean,text)', 'EXECUTE')
  or has_function_privilege('anon', 'public.perfis_definir_banner_ativo(uuid,boolean)', 'EXECUTE')
  or has_function_privilege('anon', 'public.perfis_admin_adicionar_banner(uuid,text,text,text,integer,text)', 'EXECUTE')
  or has_function_privilege('anon', 'public.perfis_admin_remover_banner(uuid,text)', 'EXECUTE'), false, 'anon não executa as RPCs de banner');
select is(has_function_privilege('authenticated', 'public.perfis_banner_garantir_rascunho(uuid)', 'EXECUTE')
  or has_function_privilege('authenticated', 'public.perfis_banner_copiar(uuid,uuid)', 'EXECUTE')
  or has_function_privilege('authenticated', 'public.perfis_banner_total(uuid,uuid)', 'EXECUTE'), false, 'rotinas internas não são executáveis pelo cliente');

-- ===== Responsável grava os banners (cria o rascunho a partir da versão aprovada) =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok($$select public.perfis_gravar_banners(t.p(3), '[]'::jsonb)$$, '42501', null, 'não grava banner em perfil de outra conta');
select throws_ok($$select public.perfis_gravar_banners(t.p(1), '{"a":1}'::jsonb)$$, '22023', null, 'a lista precisa ser um array');
select throws_ok($$select public.perfis_gravar_banners(t.p(1), null)$$, '22023', null, 'lista nula é recusada');
select throws_ok($$select public.perfis_gravar_banners(t.p(1), jsonb_build_array(jsonb_build_object('imagem_path', t.pasta(1) || 'a.jpg', 'texto_alternativo', '')))$$, '23514', null, 'texto alternativo é obrigatório');
select throws_ok($$select public.perfis_gravar_banners(t.p(1), jsonb_build_array(jsonb_build_object('imagem_path', t.pasta(1) || 'a.jpg', 'texto_alternativo', '   ')))$$, '23514', null, 'texto alternativo em branco é recusado');
select throws_ok($$select public.perfis_gravar_banners(t.p(1), jsonb_build_array(jsonb_build_object('imagem_path', t.pasta(1) || 'a.jpg', 'texto_alternativo', 'Fachada', 'destino_secao', 'https://instagram.com/loja')))$$, '23514', null, 'destino não pode ser link externo (IM-012)');
select throws_ok($$select public.perfis_gravar_banners(t.p(1), jsonb_build_array(jsonb_build_object('imagem_path', t.pasta(1) || 'a.jpg', 'texto_alternativo', 'Fachada', 'destino_secao', 'promocoes')))$$, '23514', null, 'destino só aceita seção da própria página');
select throws_ok($$select public.perfis_gravar_banners(t.p(1), jsonb_build_array(jsonb_build_object('imagem_path', t.pasta(3) || 'a.jpg', 'texto_alternativo', 'Fachada')))$$, '23514', null, 'imagem na pasta de outro perfil é recusada');
select throws_ok($$select public.perfis_gravar_banners(t.p(1), jsonb_build_array(jsonb_build_object('imagem_path', 'https://exemplo.com/a.jpg', 'texto_alternativo', 'Fachada')))$$, '23514', null, 'URL no lugar do caminho é recusada');
select throws_ok($$select public.perfis_gravar_banners(t.p(1), jsonb_build_array(jsonb_build_object('imagem_path', t.pasta(1) || 'a.gif', 'texto_alternativo', 'Fachada')))$$, '23514', null, 'tipo de arquivo fora de jpg/png/webp é recusado');
select throws_ok($$select public.perfis_gravar_banners(t.p(1), jsonb_build_array(jsonb_build_object('imagem_path', t.pasta(1) || 'a.jpg', 'texto_alternativo', 'Fachada'), jsonb_build_object('imagem_path', t.pasta(1) || 'a.jpg', 'texto_alternativo', 'Repetida')))$$, '23505', null, 'a mesma imagem duas vezes é recusada');
select throws_ok($$select public.perfis_gravar_banners(t.p(1), (select jsonb_agg(jsonb_build_object('imagem_path', t.pasta(1) || 'b' || n || '.jpg', 'texto_alternativo', 'Banner ' || n)) from generate_series(1, 7) n))$$, '23514', null, 'mais de 6 banners é recusado');
select throws_ok($$select public.perfis_gravar_banners(t.p(1), jsonb_build_array(jsonb_build_object('imagem_path', t.pasta(1) || 'a.jpg', 'texto_alternativo', 'Fachada', 'ordem', 0)))$$, '23514', null, 'ordem fora da faixa é recusada');
select is((select count(*)::int from public.perfis_perfil_versao where perfil_id = t.p(1) and situacao = 'rascunho'), 0, 'as tentativas inválidas não deixam rascunho nem banner');

select lives_ok($$select public.perfis_gravar_banners(t.p(1), jsonb_build_array(
  jsonb_build_object('imagem_path', t.pasta(1) || 'b1.jpg', 'texto_alternativo', 'Fachada da loja', 'ordem', 1, 'destino_secao', 'produtos_servicos'),
  jsonb_build_object('imagem_path', t.pasta(1) || 'b2.webp', 'texto_alternativo', 'Vitrine de doces', 'ordem', 2)))$$, 'responsável grava 2 banners (cria o rascunho)');
select is((select count(*)::int from public.perfis_perfil_versao where perfil_id = t.p(1) and situacao = 'rascunho'), 1, 'um rascunho nasceu da versão aprovada');
select is((select count(*)::int from public.perfis_perfil_versao_contato c join public.perfis_perfil_versao v on v.id = c.versao_id where v.perfil_id = t.p(1) and v.situacao = 'rascunho'), 1, 'com o WhatsApp comercial copiado');
select is((select count(*)::int from public.perfis_banner b join public.perfis_perfil_versao v on v.id = b.versao_id where v.situacao = 'rascunho' and b.perfil_id = t.p(1)), 2, 'os 2 banners estão no rascunho');
select lives_ok($$select public.perfis_gravar_banners(t.p(1), jsonb_build_array(
  jsonb_build_object('imagem_path', t.pasta(1) || 'b1.jpg', 'texto_alternativo', 'Fachada da loja', 'ordem', 1, 'destino_secao', 'produtos_servicos'),
  jsonb_build_object('imagem_path', t.pasta(1) || 'b2.webp', 'texto_alternativo', 'Vitrine de doces', 'ordem', 2)))$$, 'regravar o mesmo conjunto é idempotente');
select is((select count(*)::int from public.perfis_banner where perfil_id = t.p(1)), 2, 'sem duplicar linhas');
select is((select count(*)::int from public.perfis_banner_publico), 0, 'rascunho não aparece na leitura pública');
select is((select count(*)::int from public.perfis_banner_aguardando_aceite), 0, 'banner do próprio responsável não vai para a fila de aceite');
select lives_ok($$select public.perfis_enviar_versao((select id from public.perfis_perfil_versao where perfil_id = t.p(1) and situacao = 'rascunho'))$$, 'responsável envia a versão para aprovação');
select throws_ok($$select public.perfis_gravar_banners(t.p(1), '[]'::jsonb)$$, 'P0001', null, 'versão em análise não aceita edição de banner');
reset role;

select throws_ok($$delete from public.perfis_banner where perfil_id = 'a0000000-0000-0000-0000-000000000001'$$, '42501', null, 'banner de versão enviada não é apagado (nem por superusuário)');
select throws_ok($$update public.perfis_banner set texto_alternativo = 'Mudou' where perfil_id = 'a0000000-0000-0000-0000-000000000001'$$, '42501', null, 'nem alterado');
select throws_ok($$insert into public.perfis_banner (perfil_id, versao_id, origem, situacao, imagem_path, texto_alternativo)
  select perfil_id, id, 'responsavel', 'na_versao', 'perfil/a0000000-0000-0000-0000-000000000001/novo.jpg', 'Novo' from public.perfis_perfil_versao where perfil_id = 'a0000000-0000-0000-0000-000000000001' and situacao = 'pendente'$$,
  '42501', null, 'nem entra banner novo em versão enviada');

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.perfis_banner_publico), 0, 'versão pendente não aparece ao visitante');
select is((select count(*)::int from public.perfis_banner), 0, 'anon não lê a tabela fora do ar');
reset role;

-- ===== Revisão normal (IM-022): aprovada, o banner vai ao ar =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok($$select public.perfis_decidir_versao((select id from public.perfis_perfil_versao where perfil_id = t.p(1) and situacao = 'pendente'), true, null)$$, '42501', null, 'responsável não aprova o próprio banner');
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select is((select count(*)::int from public.administracao_banners_empresa where perfil_id = t.p(1)), 2, 'o revisor vê os banners da versão pendente');
select lives_ok($$select public.perfis_decidir_versao((select id from public.perfis_perfil_versao where perfil_id = t.p(1) and situacao = 'pendente'), true, null)$$, 'administrador aprova a versão');
reset role;

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.perfis_banner_publico), 2, 'aprovada, a leitura pública mostra os 2 banners');
select is((select array_agg(texto_alternativo) from public.perfis_banner_publico), array['Fachada da loja', 'Vitrine de doces'], 'em ordem');
select is((select destino_secao from public.perfis_banner_publico where ordem = 1), 'produtos_servicos', 'com o destino interno');
select is((select count(*)::int from public.perfis_banner_publico where imagem_path like '%aaaaaaaa%'), 0, 'caminho público não revela a conta (IM-029)');
select throws_ok($$select autor_admin_id from public.perfis_banner$$, '42501', null, 'anon não lê o autor');
reset role;

-- ===== Editar o perfil: o rascunho novo herda os banners; o aprovado segue no ar =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$select public.perfis_gravar_versao(t.p(1), '+5551988880001', p_nome => 'Loja 1 nova', p_descricao_breve => 'Doces', p_imagem_path => t.pasta(1) || 'c.jpg',
  p_categoria_principal_id => '11111111-0000-0000-0000-000000000001', p_cidade => 'Porto Alegre', p_uf => 'RS')$$, 'responsável edita o perfil (nova versão)');
select is((select count(*)::int from public.perfis_banner b join public.perfis_perfil_versao v on v.id = b.versao_id where v.situacao = 'rascunho' and b.perfil_id = t.p(1)), 2, 'o rascunho novo herdou os 2 banners');
select is((select count(*)::int from public.perfis_banner_publico), 2, 'e a versão aprovada segue no ar');
select lives_ok($$select public.perfis_gravar_banners(t.p(1), jsonb_build_array(
  jsonb_build_object('imagem_path', t.pasta(1) || 'b3.png', 'texto_alternativo', 'Promoção do mês')))$$, 'responsável troca o conjunto no rascunho');
select is((select count(*)::int from public.perfis_banner b join public.perfis_perfil_versao v on v.id = b.versao_id where v.situacao = 'rascunho' and b.perfil_id = t.p(1)), 1, 'o rascunho tem só o novo');
select is((select count(*)::int from public.perfis_banner_publico), 2, 'o público segue vendo os aprovados até a nova versão ser aprovada');
select is((select count(*)::int from public.perfis_banner where perfil_id = t.p(1)), 3, 'o responsável vê tudo do próprio perfil (2 aprovados + 1 do rascunho)');
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is((select count(*)::int from public.perfis_banner where perfil_id = t.p(1)), 2, 'outra conta vê só os 2 banners públicos de A, não o rascunho');
select is((select count(*)::int from public.perfis_banner_aguardando_aceite), 0, 'e nada da fila de A');
reset role;

-- ===== Administrador adiciona banner na empresa: nasce aguardando aceite e NÃO publica sozinho =====
-- Upload da imagem do aprovador para a pasta do perfil de outra conta.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"99999999-0000-0000-0000-000000000009","role":"authenticated"}', true);
select throws_ok($$insert into storage.objects (bucket_id, name) values ('indicamais-imagens', 'perfil/a0000000-0000-0000-0000-000000000001/adm-1.png')$$, '42501', null, 'conta sem permissão não envia imagem para a pasta alheia');
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-0000-0000-00000000000e","role":"authenticated"}', true);
select lives_ok($$insert into storage.objects (bucket_id, name) values ('indicamais-imagens', 'perfil/a0000000-0000-0000-0000-000000000001/adm-1.png')$$, 'quem tem aprovar envia a imagem para a pasta do perfil de outra conta');
select throws_ok($insert into storage.objects (bucket_id, name) values ('indicamais-imagens', 'perfil/a0000000-0000-0000-0000-000000000001/qualquer.png')$, '42501', null, 'o aprovador só envia arquivos com prefixo adm-');
select throws_ok($insert into storage.objects (bucket_id, name) values ('indicamais-imagens', 'perfil/a0000000-0000-0000-0000-000000000001/sub/pasta.png')$, '42501', null, 'subpastas continuam recusadas');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('indicamais-imagens', 'perfil/a0000000-0000-0000-0000-000000000001/../x.png')$$, '42501', null, 'nem com caminho fora do formato');
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select throws_ok($$insert into storage.objects (bucket_id, name) values ('indicamais-imagens', 'perfil/a0000000-0000-0000-0000-000000000001/c-invadiu.png')$$, '42501', null, 'outra conta comum não envia imagem para a pasta de A');
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-0000-0000-00000000000e","role":"authenticated"}', true);
update storage.objects set name = name || 'x' where name = 'perfil/a0000000-0000-0000-0000-000000000001/adm-1.png';
reset role;
select is((select count(*)::int from storage.objects where name = 'perfil/a0000000-0000-0000-0000-000000000001/adm-1.png'), 1, 'a imagem do administrador foi gravada e o aprovador não renomeia objetos');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"99999999-0000-0000-0000-000000000009","role":"authenticated"}', true);
select throws_ok($$select public.perfis_admin_adicionar_banner(t.p(1), t.pasta(1) || 'adm-1.png', 'Oferta', 'campanha')$$, '42501', null, 'conta sem permissão não adiciona banner');
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-0000-0000-00000000000e","role":"authenticated"}', true);
select throws_ok($$select public.perfis_admin_adicionar_banner(t.p(1), t.pasta(1) || 'adm-1.png', 'Oferta', '')$$, '22023', null, 'adicionar exige motivo');
select throws_ok($$select public.perfis_admin_adicionar_banner(t.p(4), t.pasta(4) || 'adm-1.png', 'Oferta', 'campanha')$$, '42501', null, 'o aprovador não coloca banner no próprio perfil');
select throws_ok($$select public.perfis_admin_adicionar_banner(t.p(2), t.pasta(2) || 'adm-1.png', 'Oferta', 'campanha')$$, 'P0002', null, 'perfil despublicado está indisponível');
select throws_ok($$select public.perfis_admin_adicionar_banner(gen_random_uuid(), t.pasta(1) || 'adm-1.png', 'Oferta', 'campanha')$$, 'P0002', null, 'perfil inexistente');
select throws_ok($$select public.perfis_admin_adicionar_banner(t.p(1), t.pasta(1) || 'adm-1.png', '', 'campanha')$$, '23514', null, 'texto alternativo obrigatório também para o administrador');
select throws_ok($$select public.perfis_admin_adicionar_banner(t.p(1), t.pasta(1) || 'adm-1.png', 'Oferta', 'campanha', 1, 'https://facebook.com/x')$$, '23514', null, 'sem link externo também para o administrador');
select throws_ok($$select public.perfis_admin_adicionar_banner(t.p(1), t.pasta(3) || 'adm-1.png', 'Oferta', 'campanha')$$, '23514', null, 'imagem fora da pasta do perfil');
select set_config('t.adm1', public.perfis_admin_adicionar_banner(t.p(1), t.pasta(1) || 'adm-1.png', 'Oferta da semana', 'campanha da semana', 3, 'beneficios')::text, true);
select is((select situacao from public.perfis_banner where id = current_setting('t.adm1')::uuid), 'aguardando_aceite', 'nasce aguardando aceite do responsável');
select throws_ok($$select public.perfis_admin_adicionar_banner(t.p(1), t.pasta(1) || 'adm-1.png', 'Oferta', 'de novo')$$, '23505', null, 'repetir a mesma imagem é recusado (idempotência)');
select throws_ok($$update public.perfis_banner set situacao = 'aceito' where id = current_setting('t.adm1')::uuid$$, '42501', null, 'o administrador não publica por UPDATE');
select throws_ok($$select public.perfis_responder_banner(current_setting('t.adm1')::uuid, true)$$, '42501', null, 'o administrador não aceita no lugar do responsável');
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select throws_ok($$select public.perfis_responder_banner(current_setting('t.adm1')::uuid, true)$$, '42501', null, 'nem o administrador geral');
select is((select count(*)::int from public.administracao_banners_empresa where situacao = 'aguardando_aceite'), 1, 'o administrador acompanha o que aguarda aceite');
reset role;

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.perfis_banner_publico), 2, 'aguardando aceite não aparece ao visitante');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is((select count(*)::int from public.perfis_banner_aguardando_aceite), 0, 'outra conta não vê o que aguarda aceite de A');
select throws_ok($$select public.perfis_responder_banner(current_setting('t.adm1')::uuid, true)$$, '42501', null, 'outra conta não responde por A');
select throws_ok($$select public.perfis_definir_banner_ativo(current_setting('t.adm1')::uuid, false)$$, '42501', null, 'nem oculta banner de A');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is((select count(*)::int from public.perfis_banner_aguardando_aceite), 1, 'o responsável vê o banner aguardando aceite');
select is((select count(*)::int from storage.objects where name = 'perfil/a0000000-0000-0000-0000-000000000001/adm-1.png'), 1, 'e consegue ver a imagem para decidir');
select throws_ok($$select public.perfis_definir_banner_ativo(current_setting('t.adm1')::uuid, false)$$, 'P0001', null, 'só banner aceito pode ser ocultado');
select set_config('storage.allow_delete_query', 'true', true);
delete from storage.objects where name = 'perfil/a0000000-0000-0000-0000-000000000001/adm-1.png';
select is((select count(*)::int from storage.objects where name = 'perfil/a0000000-0000-0000-0000-000000000001/adm-1.png'), 1, 'imagem aguardando aceite está em uso e não é apagada');
select lives_ok($$select public.perfis_responder_banner(current_setting('t.adm1')::uuid, true)$$, 'responsável aceita');
select throws_ok($$select public.perfis_responder_banner(current_setting('t.adm1')::uuid, false, 'mudei de ideia')$$, 'P0001', null, 'aceite não se desfaz por recusa');
reset role;

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.perfis_banner_publico), 3, 'depois do aceite, o banner do administrador vai ao ar');
select is((select array_agg(texto_alternativo) from public.perfis_banner_publico), array['Fachada da loja', 'Vitrine de doces', 'Oferta da semana'], 'na ordem');
select is((select count(*)::int from storage.objects where name = 'perfil/a0000000-0000-0000-0000-000000000001/adm-1.png'), 1, 'e a imagem fica pública');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$select public.perfis_definir_banner_ativo(current_setting('t.adm1')::uuid, false)$$, 'responsável oculta o banner aceito');
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.perfis_banner_publico), 2, 'oculto sai do ar');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$select public.perfis_definir_banner_ativo(current_setting('t.adm1')::uuid, true)$$, 'e volta a exibir');
reset role;

-- ===== Recusa exige motivo; limite de 6; remoção pelo administrador =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-0000-0000-00000000000e","role":"authenticated"}', true);
select set_config('t.adm2', public.perfis_admin_adicionar_banner(t.p(1), t.pasta(1) || 'adm-2.jpg', 'Segunda oferta', 'campanha 2', 4)::text, true);
select set_config('t.adm3', public.perfis_admin_adicionar_banner(t.p(1), t.pasta(1) || 'adm-3.jpg', 'Terceira oferta', 'campanha 3', 5)::text, true);
select set_config('t.adm4', public.perfis_admin_adicionar_banner(t.p(1), t.pasta(1) || 'adm-4.jpg', 'Quarta oferta', 'campanha 4', 6)::text, true);
select throws_ok($$select public.perfis_admin_adicionar_banner(t.p(1), t.pasta(1) || 'adm-5.jpg', 'Quinta oferta', 'campanha 5', 7)$$, '23514', null, 'o administrador não passa de 6 banners (2 da versão + 4 dele)');
select lives_ok($$select public.perfis_admin_remover_banner(current_setting('t.adm4')::uuid, 'campanha cancelada')$$, 'administrador retira o que adicionou');
select throws_ok($$select public.perfis_admin_remover_banner(current_setting('t.adm4')::uuid, 'de novo')$$, 'P0001', null, 'remover duas vezes é recusado');
select throws_ok($$select public.perfis_admin_remover_banner(current_setting('t.adm2')::uuid, '')$$, '22023', null, 'remover exige motivo');
select set_config('request.jwt.claims', '{"sub":"99999999-0000-0000-0000-000000000009","role":"authenticated"}', true);
select throws_ok($$select public.perfis_admin_remover_banner(current_setting('t.adm2')::uuid, 'x')$$, '42501', null, 'conta comum não remove');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok($$select public.perfis_responder_banner(current_setting('t.adm2')::uuid, false)$$, '22023', null, 'recusar exige motivo');
select throws_ok($$select public.perfis_responder_banner(current_setting('t.adm4')::uuid, true)$$, 'P0001', null, 'banner removido não se aceita');
select lives_ok($$select public.perfis_responder_banner(current_setting('t.adm2')::uuid, false, 'não combina com a loja')$$, 'responsável recusa com motivo');
select is((select motivo_resposta from public.perfis_banner where id = current_setting('t.adm2')::uuid), 'não combina com a loja', 'e o motivo fica visível a ele');
select throws_ok($$select public.perfis_responder_banner(current_setting('t.adm2')::uuid, true)$$, 'P0001', null, 'recusa é final');
reset role;
select throws_ok($$update public.perfis_banner set situacao = 'aceito' where id = current_setting('t.adm2')::uuid$$, '42501', null, 'recusado não volta (nem por superusuário)');
select throws_ok($$delete from public.perfis_banner where id = current_setting('t.adm2')::uuid$$, '42501', null, 'banner de administrador nunca é apagado');
select throws_ok($$update public.perfis_banner set imagem_path = 'perfil/a0000000-0000-0000-0000-000000000001/outra.jpg' where id = current_setting('t.adm1')::uuid$$, '42501', null, 'o conteúdo do banner aceito é imutável');

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.perfis_banner_publico where texto_alternativo in ('Segunda oferta', 'Quarta oferta', 'Terceira oferta')), 0, 'recusado, removido ou aguardando não aparecem');
reset role;

-- ===== Auditoria: autor, motivo e valor anterior =====
select is((select count(*)::int from public.administracao_auditoria where acao = 'adicionar_banner'), 4, 'auditou as 4 adições');
select is((select autor_id from public.administracao_auditoria where acao = 'adicionar_banner' and alvo_id = current_setting('t.adm1')), 'eeeeeeee-0000-0000-0000-00000000000e'::uuid, 'com o autor');
select is((select motivo from public.administracao_auditoria where acao = 'adicionar_banner' and alvo_id = current_setting('t.adm1')), 'campanha da semana', 'e o motivo');
select is((select autor_id from public.administracao_auditoria where acao = 'aceitar_banner'), 'aaaaaaaa-0000-0000-0000-00000000000a'::uuid, 'aceite auditado com o responsável como autor');
select is((select valor_anterior ->> 'situacao' from public.administracao_auditoria where acao = 'aceitar_banner'), 'aguardando_aceite', 'com o valor anterior');
select is((select motivo from public.administracao_auditoria where acao = 'recusar_banner'), 'não combina com a loja', 'recusa auditada com motivo');
select is((select valor_anterior ->> 'situacao' from public.administracao_auditoria where acao = 'remover_banner'), 'aguardando_aceite', 'remoção auditada com o valor anterior');
select is((select count(*)::int from public.administracao_auditoria where acao = 'definir_banner_ativo'), 2, 'ocultar e reexibir auditados');

-- ===== Despublicação (IM-079) e suspensão (IM-080) ocultam os banners junto do perfil =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$update public.perfis_perfil set publicado = false where id = t.p(1)$$, 'responsável despublica o perfil');
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.perfis_banner_publico where perfil_id = t.p(1)), 0, 'despublicado: nenhum banner na leitura pública');
select is((select count(*)::int from storage.objects where name like 'perfil/a0000000-0000-0000-0000-000000000001/%'), 0, 'e nenhuma imagem pública');
reset role;
select is((select count(*)::int from public.perfis_banner where perfil_id = 'a0000000-0000-0000-0000-000000000001'), 7, 'nada foi apagado (2 aprovados + 1 do rascunho + 4 do administrador)');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$update public.perfis_perfil set publicado = true where id = t.p(1)$$, 'responsável republica');
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.perfis_banner_publico where perfil_id = t.p(1)), 3, 'republicado: os banners voltam sem nova aprovação');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select lives_ok($$select public.administracao_suspender_conta('aaaaaaaa-0000-0000-0000-00000000000a', 'teste de suspensão')$$, 'administrador suspende A');
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.perfis_banner_publico where perfil_id = t.p(1)), 0, 'conta suspensa: banners fora do ar');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok($$select public.perfis_gravar_banners(t.p(1), '[]'::jsonb)$$, '42501', null, 'conta suspensa não grava banner');
select throws_ok($$select public.perfis_definir_banner_ativo(current_setting('t.adm1')::uuid, false)$$, '42501', null, 'nem oculta banner');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select lives_ok($$select public.administracao_reativar_conta('aaaaaaaa-0000-0000-0000-00000000000a', 'teste')$$, 'administrador reativa A');
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.perfis_banner_publico where perfil_id = t.p(1)), 0, 'reativada: o perfil volta despublicado, então os banners seguem fora do ar');
reset role;

select * from finish();
rollback;
