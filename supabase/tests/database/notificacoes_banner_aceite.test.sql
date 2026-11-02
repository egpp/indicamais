-- pgTAP · módulo notificacoes · aviso "banner aguardando seu aceite" · IM-047, IM-052, IM-053, IM-093, IM-029, D-016
begin;
select * from no_plan();
delete from public.catalogo_categoria;

-- A = responsável de P1; C = outra conta (P3); D = administrador geral; E = só permissão aprovar (autor do banner).
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
insert into public.perfis_perfil_versao (id, perfil_id, nome, descricao_breve, imagem_path, categoria_principal_id, cidade, uf)
select ('a1000000-0000-0000-0000-00000000000' || n)::uuid, ('a0000000-0000-0000-0000-00000000000' || n)::uuid, 'Loja ' || n, 'Doces',
       'perfil/a0000000-0000-0000-0000-00000000000' || n || '/c.jpg', '11111111-0000-0000-0000-000000000001', 'Porto Alegre', 'RS'
from generate_series(1, 3, 2) n;
insert into public.perfis_perfil_versao_contato (versao_id, whatsapp_comercial_e164)
select id, '+55519888800' || right(id::text, 2) from public.perfis_perfil_versao;
update public.perfis_perfil_versao set situacao = 'pendente', enviada_em = now();
update public.perfis_perfil_versao set situacao = 'aprovada';
update public.perfis_perfil set versao_aprovada_id = ('a1000000-0000-0000-0000-00000000000' || right(id::text, 1))::uuid, publicado = true;

-- ===== Estrutura =====
select is(has_table_privilege('anon', 'public.notificacoes_meus_avisos', 'SELECT'), false, 'anon continua sem acesso à visão de avisos');
select is(has_table_privilege('authenticated', 'public.notificacoes_meus_avisos', 'SELECT'), true, 'authenticated lê a visão');
select columns_are('public', 'notificacoes_meus_avisos', array['origem', 'origem_id', 'tipo', 'destino_tipo', 'destino_id', 'destino_nome',
  'ator_nome', 'criado_em', 'lida', 'lida_em'], 'colunas da visão inalteradas (sem conta_id)');
select is(has_function_privilege('anon', 'public.notificacoes_marcar_lida(text,uuid)', 'EXECUTE'), false, 'anon não executa marcar_lida');

-- ===== Administrador (E) adiciona banners no perfil de A =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-0000-0000-00000000000e","role":"authenticated"}', true);
select set_config('t.b1', public.perfis_admin_adicionar_banner('a0000000-0000-0000-0000-000000000001',
  'perfil/a0000000-0000-0000-0000-000000000001/adm-1.jpg', 'Oferta da semana', 'campanha 1', 1)::text, true);
select set_config('t.b2', public.perfis_admin_adicionar_banner('a0000000-0000-0000-0000-000000000001',
  'perfil/a0000000-0000-0000-0000-000000000001/adm-2.jpg', 'Segunda oferta', 'campanha 2', 2)::text, true);
select is((select count(*)::int from public.notificacoes_meus_avisos), 0, 'o administrador autor não vê o aviso (não é o responsável)');
select is(public.notificacoes_contar_nao_lidas(), 0, 'e o contador dele não sobe');
select throws_ok($$select public.notificacoes_marcar_lida('banner_aceite', current_setting('t.b1')::uuid)$$, 'P0002', null, 'administrador não marca aviso do responsável');

select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select is((select count(*)::int from public.notificacoes_meus_avisos), 0, 'administrador geral também não vê');

select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is((select count(*)::int from public.notificacoes_meus_avisos where origem = 'banner_aceite'), 0, 'outro usuário não vê o aviso');
select is(public.notificacoes_contar_nao_lidas(), 0, 'e o contador dele não sobe');
select throws_ok($$select public.notificacoes_marcar_lida('banner_aceite', current_setting('t.b1')::uuid)$$, 'P0002', null, 'outro usuário não marca (mensagem neutra)');

-- ===== Dono recebe o aviso =====
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is((select count(*)::int from public.notificacoes_meus_avisos where origem = 'banner_aceite'), 2, 'dono recebe um aviso por banner');
select is(public.notificacoes_contar_nao_lidas(), 2, 'o contador sobe');
select is((select tipo from public.notificacoes_meus_avisos where origem_id = current_setting('t.b1')::uuid), 'banner_aguardando_aceite', 'tipo do aviso');
select is((select destino_tipo || ':' || destino_id::text || ':' || destino_nome from public.notificacoes_meus_avisos where origem_id = current_setting('t.b1')::uuid),
  'perfil:a0000000-0000-0000-0000-000000000001:Loja 1', 'destino é o perfil, com o nome dele');
select is((select count(*)::int from public.notificacoes_meus_avisos where origem = 'banner_aceite' and ator_nome is not null), 0, 'nunca identifica o administrador (ator_nome nulo)');
select is((select count(*)::int from public.notificacoes_meus_avisos where to_jsonb(notificacoes_meus_avisos)::text ~* 'eeeeeeee|dddddddd|e@teste|adm-'), 0, 'nenhum campo privado (id ou e-mail do administrador, caminho da imagem)');
select is((select count(*)::int from public.notificacoes_meus_avisos where origem_id = current_setting('t.b1')::uuid), 1, 'sem duplicar: uma linha por banner (IM-053)');

-- ===== Marcar como lida =====
select is(public.notificacoes_marcar_lida('banner_aceite', current_setting('t.b1')::uuid), true, 'marca um como lido');
select is(public.notificacoes_marcar_lida('banner_aceite', current_setting('t.b1')::uuid), false, 'idempotente');
select is(public.notificacoes_contar_nao_lidas(), 1, 'contador desce');
select is(public.notificacoes_marcar_lida('banner_aceite', current_setting('t.b2')::uuid), true, 'marca o outro');
select is(public.notificacoes_contar_nao_lidas(), 0, 'marcar como lida zera o contador');
select is((select count(*)::int from public.notificacoes_meus_avisos where origem = 'banner_aceite'), 2, 'avisos lidos continuam listados');

-- ===== Aceitar / recusar faz o aviso sumir =====
select lives_ok($$select public.perfis_responder_banner(current_setting('t.b1')::uuid, true)$$, 'dono aceita o banner 1');
select is((select count(*)::int from public.notificacoes_meus_avisos where origem_id = current_setting('t.b1')::uuid), 0, 'aceito: o aviso some');
select lives_ok($$select public.perfis_responder_banner(current_setting('t.b2')::uuid, false, 'não combina')$$, 'dono recusa o banner 2');
select is((select count(*)::int from public.notificacoes_meus_avisos where origem = 'banner_aceite'), 0, 'recusado: o aviso some');
select throws_ok($$select public.notificacoes_marcar_lida('banner_aceite', current_setting('t.b2')::uuid)$$, 'P0002', null, 'aviso que sumiu não é mais marcável');

-- ===== Novo banner: marcar_todas_lidas; remoção pelo administrador some o aviso =====
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-0000-0000-00000000000e","role":"authenticated"}', true);
select set_config('t.b3', public.perfis_admin_adicionar_banner('a0000000-0000-0000-0000-000000000001',
  'perfil/a0000000-0000-0000-0000-000000000001/adm-3.jpg', 'Terceira oferta', 'campanha 3', 3)::text, true);
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is(public.notificacoes_contar_nao_lidas(), 1, 'novo banner: contador sobe de novo');
select is(public.notificacoes_marcar_todas_lidas(), 1, 'marcar todas inclui o aviso de banner');
select is(public.notificacoes_contar_nao_lidas(), 0, 'e zera');
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-0000-0000-00000000000e","role":"authenticated"}', true);
select lives_ok($$select public.perfis_admin_remover_banner(current_setting('t.b3')::uuid, 'cancelado')$$, 'administrador retira o banner pendente');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is((select count(*)::int from public.notificacoes_meus_avisos where origem = 'banner_aceite'), 0, 'removido: o aviso some');

-- ===== Origem inválida continua recusada =====
select throws_ok($$select public.notificacoes_marcar_lida('qualquer', current_setting('t.b1')::uuid)$$, '22023', null, 'origem inválida: 22023');
select throws_ok($$select public.notificacoes_marcar_lida('banner_aceite', gen_random_uuid())$$, 'P0002', null, 'banner inexistente: P0002');
reset role;

-- Leitura é só inserção.
select is((select count(*)::int from public.notificacoes_leitura where origem = 'banner_aceite'), 3, 'leituras do aviso guardadas');
select throws_ok($$delete from public.notificacoes_leitura where origem = 'banner_aceite'$$, '42501', null, 'e imutáveis');

-- Sem sessão.
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$select * from public.notificacoes_meus_avisos$$, '42501', null, 'anon não lê a visão');
reset role;

select * from finish();
rollback;
