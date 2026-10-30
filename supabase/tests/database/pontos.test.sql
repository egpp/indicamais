-- pgTAP · módulo pontos (parâmetros, crédito, duplicidade e intervalo, saldo, reversão, privacidade) · Fase 4
-- IM-025, IM-028, IM-029, IM-030, IM-032, IM-033, IM-034, IM-035, IM-041, IM-042, IM-065, IM-077, IM-078, IM-079, IM-086
begin;
select * from no_plan();
delete from public.catalogo_categoria;

-- Contas: A (responsável do perfil P1 e do item I2/I5), B (anunciante particular), C e F (indicadores com WhatsApp),
-- E (sem WhatsApp, só para leitura), D (administrador).
insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@teste.local'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@teste.local'),
  ('cccccccc-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c@teste.local'),
  ('dddddddd-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd@teste.local'),
  ('eeeeeeee-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'e@teste.local'),
  ('ffffffff-0000-0000-0000-00000000000f', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'f@teste.local');
insert into public.administracao_administrador (conta_id) values ('dddddddd-0000-0000-0000-00000000000d');
update public.contas_conta set whatsapp_e164 = '+5551999990001' where id = 'aaaaaaaa-0000-0000-0000-00000000000a';
update public.contas_conta set whatsapp_e164 = '+5551999990002' where id = 'bbbbbbbb-0000-0000-0000-00000000000b';
update public.contas_conta set whatsapp_e164 = '+5511999990003' where id = 'cccccccc-0000-0000-0000-00000000000c';
update public.contas_conta set whatsapp_e164 = '+5511999990004' where id = 'ffffffff-0000-0000-0000-00000000000f';
insert into public.catalogo_categoria (id, nome, slug, ativa, ordem) values
  ('11111111-0000-0000-0000-000000000001', 'Alimentação', 'alimentacao', true, 1);

insert into public.perfis_perfil (id, responsavel_id, slug) values
  ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a', 'loja-um'),
  ('a0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-00000000000a', 'loja-dois');
insert into public.perfis_perfil_versao (id, perfil_id, nome, descricao_breve, imagem_path, categoria_principal_id, cidade, uf) values
  ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Loja Um', 'Doces', 'perfil/a0000000-0000-0000-0000-000000000001/c.jpg', '11111111-0000-0000-0000-000000000001', 'Porto Alegre', 'RS'),
  ('a1000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'Loja Dois', 'Doces', 'perfil/a0000000-0000-0000-0000-000000000002/c.jpg', '11111111-0000-0000-0000-000000000001', 'Canoas', 'RS');
insert into public.perfis_perfil_versao_contato (versao_id, whatsapp_comercial_e164) values
  ('a1000000-0000-0000-0000-000000000001', '+5551988880001'),
  ('a1000000-0000-0000-0000-000000000002', '+5551988880002');
update public.perfis_perfil_versao set situacao = 'pendente', enviada_em = now() where id in ('a1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002');
update public.perfis_perfil_versao set situacao = 'aprovada' where id in ('a1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002');
update public.perfis_perfil set versao_aprovada_id = 'a1000000-0000-0000-0000-000000000001', publicado = true where id = 'a0000000-0000-0000-0000-000000000001';
update public.perfis_perfil set versao_aprovada_id = 'a1000000-0000-0000-0000-000000000002', publicado = false where id = 'a0000000-0000-0000-0000-000000000002';

-- Itens: I1 e I4 particulares de B publicados; I2 e I5 itens do perfil P1 (dono A); I3 particular de B despublicado.
insert into public.catalogo_item (id, conta_id, perfil_id, tipo) values
  ('e0000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-00000000000b', null, 'produto'),
  ('e0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000001', 'servico'),
  ('e0000000-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-00000000000b', null, 'produto'),
  ('e0000000-0000-0000-0000-000000000004', 'bbbbbbbb-0000-0000-0000-00000000000b', null, 'produto'),
  ('e0000000-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000001', 'servico');
insert into public.catalogo_item_versao (id, item_id, situacao, enviada_em, nome, descricao, foto_path, categoria_principal_id, cidade, uf) values
  ('e1000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'aprovada', now(), 'Bolo', 'Bolo', 'item/e0000000-0000-0000-0000-000000000001/a.jpg', '11111111-0000-0000-0000-000000000001', 'Porto Alegre', 'RS'),
  ('e1000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000002', 'aprovada', now(), 'Entrega', 'Entrega', 'item/e0000000-0000-0000-0000-000000000002/a.jpg', '11111111-0000-0000-0000-000000000001', null, null),
  ('e1000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000003', 'aprovada', now(), 'Bike', 'Bike', 'item/e0000000-0000-0000-0000-000000000003/a.jpg', '11111111-0000-0000-0000-000000000001', 'Canoas', 'RS'),
  ('e1000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000004', 'aprovada', now(), 'Torta', 'Torta', 'item/e0000000-0000-0000-0000-000000000004/a.jpg', '11111111-0000-0000-0000-000000000001', 'Canoas', 'RS'),
  ('e1000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000005', 'aprovada', now(), 'Retirada', 'Retirada', 'item/e0000000-0000-0000-0000-000000000005/a.jpg', '11111111-0000-0000-0000-000000000001', null, null);
update public.catalogo_item set versao_aprovada_id = 'e1000000-0000-0000-0000-000000000001', publicado = true where id = 'e0000000-0000-0000-0000-000000000001';
update public.catalogo_item set versao_aprovada_id = 'e1000000-0000-0000-0000-000000000002', publicado = true where id = 'e0000000-0000-0000-0000-000000000002';
update public.catalogo_item set versao_aprovada_id = 'e1000000-0000-0000-0000-000000000003', publicado = false where id = 'e0000000-0000-0000-0000-000000000003';
update public.catalogo_item set versao_aprovada_id = 'e1000000-0000-0000-0000-000000000004', publicado = true where id = 'e0000000-0000-0000-0000-000000000004';
update public.catalogo_item set versao_aprovada_id = 'e1000000-0000-0000-0000-000000000005', publicado = true where id = 'e0000000-0000-0000-0000-000000000005';

-- Apoio (superusuário): link do indicador, pedido direto em data relativa a hoje e leitura da decisão.
create function pg_temp.lk(p_ind uuid, p_perfil uuid, p_item uuid) returns uuid language sql as $$
  select id from public.indicacoes_link
  where indicador_id = p_ind and perfil_id is not distinct from p_perfil and item_id is not distinct from p_item;
$$;
create function pg_temp.pedido(p_perfil uuid, p_item uuid, p_link uuid, p_wa text, p_n integer, p_dias integer, p_susp boolean default false)
returns uuid language sql as $$
  insert into public.indicacoes_pedido_contato
    (perfil_id, item_id, link_id, nome, whatsapp_e164, chave_idempotencia, autoindicacao_suspeita, criado_em)
  values (p_perfil, p_item, p_link, 'Visitante Teste', p_wa, 'chave-pontos-' || lpad(p_n::text, 6, '0'), p_susp,
          now() + p_dias * interval '1 day')
  returning id;
$$;
create function pg_temp.motivo(p_pedido uuid) returns text language sql as $$
  select motivo from public.pontos_decisao where pedido_id = p_pedido;
$$;
create function pg_temp.saldo(p_ind uuid) returns integer language sql as $$
  select coalesce(sum(pontos), 0)::integer from public.pontos_lancamento where indicador_id = p_ind;
$$;

-- ===== Estrutura: RLS forçada, anon sem acesso, sem escrita, sem resgate =====
select is((select bool_and(relrowsecurity and relforcerowsecurity) from pg_class where oid = any(array[
  'public.pontos_parametro'::regclass, 'public.pontos_decisao'::regclass, 'public.pontos_lancamento'::regclass,
  'public.pontos_falha'::regclass])), true, 'RLS ativa e forçada nas 4 tabelas de pontos');
select is((select count(*)::int from pg_policies where schemaname = 'public'
  and tablename in ('pontos_parametro', 'pontos_decisao', 'pontos_lancamento', 'pontos_falha')), 16,
  '4 políticas (select, insert, update, delete) por tabela');
select is((select bool_or(has_table_privilege('anon', t, p))
  from unnest(array['public.pontos_parametro', 'public.pontos_decisao', 'public.pontos_lancamento', 'public.pontos_falha']) t,
  unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) p), false, 'anon sem nenhum privilégio nas tabelas');
select is((select bool_or(has_table_privilege('authenticated', t, p))
  from unnest(array['public.pontos_decisao', 'public.pontos_lancamento', 'public.pontos_falha']) t,
  unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) p), false, 'authenticated sem privilégio direto em decisão, lançamento e falha');
select is((select bool_or(has_table_privilege('authenticated', 'public.pontos_parametro', p))
  from unnest(array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) p), false, 'authenticated só lê o parâmetro (e só o administrador passa na política)');
select is((select bool_or(has_table_privilege(r, v, p))
  from unnest(array['anon', 'authenticated']) r,
  unnest(array['public.pontos_meu_saldo', 'public.pontos_meus_lancamentos', 'public.administracao_pontos_lancamentos',
    'public.administracao_pontos_saldos', 'public.administracao_pontos_decisoes', 'public.administracao_pontos_falhas']) v,
  unnest(array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) p), false, 'visões sem escrita');
select is((select bool_or(has_table_privilege('anon', v, 'SELECT'))
  from unnest(array['public.pontos_meu_saldo', 'public.pontos_meus_lancamentos', 'public.administracao_pontos_lancamentos',
    'public.administracao_pontos_saldos', 'public.administracao_pontos_decisoes', 'public.administracao_pontos_falhas']) v),
  false, 'anon não lê nenhuma visão de pontos');
select columns_are('public', 'pontos_meu_saldo', array['saldo', 'total_creditado', 'total_revertido', 'ultimo_lancamento_em'], 'saldo sem id de conta');
select columns_are('public', 'pontos_meus_lancamentos', array['id', 'tipo', 'pontos', 'situacao', 'destino_tipo', 'destino_id', 'destino_nome', 'categoria', 'original_id', 'criado_em'],
  'lançamentos do indicador: só a categoria da reversão (sem observação interna), sem id de conta nem dado do visitante');
select columns_are('public', 'administracao_pontos_lancamentos', array['id', 'indicador_ref', 'tipo', 'pontos', 'situacao', 'destino_tipo', 'destino_id', 'destino_nome', 'categoria', 'motivo', 'original_id', 'pedido_id', 'confirmou_saldo_negativo', 'criado_em'],
  'visão do administrador: indicador opaco, pedido por id, sem WhatsApp nem nome do visitante');
select columns_are('public', 'administracao_pontos_decisoes', array['id', 'pedido_id', 'pedido_criado_em', 'destino_tipo', 'destino_id', 'indicador_ref', 'pontuado', 'motivo', 'pontos', 'intervalo_dias', 'decidido_em'],
  'decisões do administrador sem WhatsApp nem chave de duplicidade');
select is(has_function_privilege('anon', 'public.pontos_definir_parametro(text,integer,text)', 'EXECUTE')
  or has_function_privilege('anon', 'public.pontos_reverter_credito(uuid,text,text,boolean)', 'EXECUTE')
  or has_function_privilege('anon', 'public.pontos_reprocessar_pedido(uuid,text)', 'EXECUTE')
  or has_function_privilege('anon', 'public.pontos_parametros_atuais()', 'EXECUTE'), false, 'anon não executa funções de pontos');
select is(has_function_privilege('authenticated', 'public.pontos_avaliar_pedido(uuid)', 'EXECUTE')
  or has_function_privilege('authenticated', 'public.pontos_parametro_valor(text)', 'EXECUTE')
  or has_function_privilege('authenticated', 'public.pontos_reprocessar_pendentes(integer)', 'EXECUTE')
  or has_function_privilege('anon', 'public.pontos_reprocessar_pendentes(integer)', 'EXECUTE'), false,
  'avaliação, leitura de parâmetro e reprocessamento em lote não são chamáveis por anon nem authenticated');
select is(has_function_privilege('service_role', 'public.pontos_reprocessar_pendentes(integer)', 'EXECUTE'), true, 'service_role executa o reprocessamento em lote');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname ~* '(resgat|cupom|sorteio)'), 0, 'não existe função de resgate, cupom nem sorteio (IM-037, IM-038)');
select is((select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname ~* '(resgat|cupom|sorteio)'), 0, 'não existe tabela de resgate, cupom nem sorteio');
select is((select count(*)::int from pg_indexes where schemaname = 'public'
  and indexname in ('pontos_lancamento_pedido_unico', 'pontos_lancamento_reversao_unica')), 2, 'restrições únicas: um crédito por pedido e uma reversão por crédito');

-- ===== Parâmetros iniciais (D-012) =====
select is((select valor from public.pontos_parametro where chave = 'pontos_por_indicacao'), 10, '10 pontos por indicação (D-012)');
select is((select valor from public.pontos_parametro where chave = 'intervalo_dias'), 30, 'intervalo de 30 dias (D-012)');
select is((select count(*)::int from public.pontos_parametro where chave not in ('pontos_por_indicacao', 'intervalo_dias')), 0, 'só os parâmetros de pontos; os de comissão serão separados (IM-065)');

-- ===== Links, compartilhamento e visita não pontuam =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select lives_ok($$select * from public.indicacoes_gerar_link(p_perfil_id => 'a0000000-0000-0000-0000-000000000001')$$, 'C gera link do perfil P1');
select lives_ok($$select * from public.indicacoes_gerar_link(p_item_id => 'e0000000-0000-0000-0000-000000000001')$$, 'C gera link do anúncio I1');
select lives_ok($$select * from public.indicacoes_gerar_link(p_item_id => 'e0000000-0000-0000-0000-000000000002')$$, 'C gera link do item I2');
select lives_ok($$select * from public.indicacoes_gerar_link(p_item_id => 'e0000000-0000-0000-0000-000000000005')$$, 'C gera link do item I5');
select set_config('t.cod_c_p1', (select codigo from public.indicacoes_meus_links where destino_id = 'a0000000-0000-0000-0000-000000000001'), true);
select lives_ok($$select public.indicacoes_registrar_compartilhamento(current_setting('t.cod_c_p1'), 'whatsapp')$$, 'C registra compartilhamento');
select set_config('request.jwt.claims', '{"sub":"ffffffff-0000-0000-0000-00000000000f","role":"authenticated"}', true);
select lives_ok($$select * from public.indicacoes_gerar_link(p_perfil_id => 'a0000000-0000-0000-0000-000000000001')$$, 'F gera link do perfil P1');
select lives_ok($$select * from public.indicacoes_gerar_link(p_item_id => 'e0000000-0000-0000-0000-000000000001')$$, 'F gera link do anúncio I1');
select lives_ok($$select * from public.indicacoes_gerar_link(p_item_id => 'e0000000-0000-0000-0000-000000000004')$$, 'F gera link do anúncio I4');
select lives_ok($$select * from public.indicacoes_gerar_link(p_item_id => 'e0000000-0000-0000-0000-000000000005')$$, 'F gera link do item I5');
reset role;
select is((select count(*)::int from public.pontos_lancamento), 0, 'link gerado e compartilhamento não geram pontos (IM-025)');
select is((select count(*)::int from public.pontos_decisao), 0, 'sem pedido, sem decisão');

-- ===== Crédito no primeiro pedido atribuído e válido (fluxo real pelo RPC) =====
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select set_config('t.p1', (select o_pedido_id::text from public.indicacoes_enviar_contato(
  p_perfil_id => 'a0000000-0000-0000-0000-000000000001', p_item_id => null, p_nome => 'Maria Silva',
  p_whatsapp => '+5511988880001', p_chave => 'chave-pontos-rpc-0001', p_codigo => current_setting('t.cod_c_p1'))), true);
reset role;
select is(pg_temp.motivo(current_setting('t.p1')::uuid), 'pontuado', 'primeiro pedido atribuído e válido pontua');
select is((select pontos from public.pontos_lancamento where pedido_id = current_setting('t.p1')::uuid), 10, 'crédito de 10 pontos (padrão D-012)');
select is((select indicador_id from public.pontos_lancamento where pedido_id = current_setting('t.p1')::uuid), 'cccccccc-0000-0000-0000-00000000000c'::uuid, 'o crédito vai ao indicador do link');
select is((select destino_nome from public.pontos_lancamento where pedido_id = current_setting('t.p1')::uuid), 'Loja Um', 'o lançamento guarda o nome do destino');

-- Idempotência: repetir a mesma chave não cria pedido, decisão nem crédito.
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select o_repetido from public.indicacoes_enviar_contato(
  p_perfil_id => 'a0000000-0000-0000-0000-000000000001', p_item_id => null, p_nome => 'Maria Silva',
  p_whatsapp => '+5511988880001', p_chave => 'chave-pontos-rpc-0001', p_codigo => current_setting('t.cod_c_p1'))), true, 'mesma chave: operação repetida');
reset role;
select is((select count(*)::int from public.pontos_lancamento), 1, 'idempotência: mesma chave não duplica pontos');
select is((select count(*)::int from public.pontos_decisao), 1, 'idempotência: uma decisão por pedido');
select throws_ok($$insert into public.pontos_lancamento (indicador_id, tipo, pontos, pedido_id, destino_perfil_id, destino_nome)
  values ('cccccccc-0000-0000-0000-00000000000c', 'credito', 10, current_setting('t.p1')::uuid, 'a0000000-0000-0000-0000-000000000001', 'Loja Um')$$,
  '23505', null, 'o banco recusa segundo crédito para o mesmo pedido');
select throws_ok($$insert into public.pontos_decisao (pedido_id, pedido_criado_em, chave_hash, destino_ref_tipo, destino_ref_id, pontuado, motivo, pontos, intervalo_dias)
  values (current_setting('t.p1')::uuid, now(), repeat('a', 64), 'perfil', 'a0000000-0000-0000-0000-000000000001', false, 'sem_atribuicao', 0, 30)$$,
  '23505', null, 'o banco recusa segunda decisão para o mesmo pedido');

-- ===== Intervalo: mesmo WhatsApp + perfil =====
-- p1 = dia 0 (pontuado). Pedidos seguintes do mesmo WhatsApp (W1) no mesmo perfil, por outros itens e outro indicador.
select set_config('t.p2', pg_temp.pedido('a0000000-0000-0000-0000-000000000001', null,
  pg_temp.lk('ffffffff-0000-0000-0000-00000000000f', 'a0000000-0000-0000-0000-000000000001', null), '+5511988880001', 2, 10)::text, true);
select is(pg_temp.motivo(current_setting('t.p2')::uuid), 'dentro_do_intervalo', 'dia 10, outro indicador: dentro do intervalo, não pontua');
select set_config('t.p3', pg_temp.pedido(null, 'e0000000-0000-0000-0000-000000000002',
  pg_temp.lk('cccccccc-0000-0000-0000-00000000000c', null, 'e0000000-0000-0000-0000-000000000002'), '+5511988880001', 3, 20)::text, true);
select is(pg_temp.motivo(current_setting('t.p3')::uuid), 'dentro_do_intervalo', 'dia 20, item I2 do mesmo perfil: mesmo destino, não pontua');
select set_config('t.p3b', pg_temp.pedido(null, 'e0000000-0000-0000-0000-000000000005',
  pg_temp.lk('cccccccc-0000-0000-0000-00000000000c', null, 'e0000000-0000-0000-0000-000000000005'), '+5511988880001', 4, 25)::text, true);
select is(pg_temp.motivo(current_setting('t.p3b')::uuid), 'dentro_do_intervalo', 'dia 25, outro item do mesmo perfil: mesmo destino, não pontua');
select is((select count(*)::int from public.pontos_lancamento), 1, 'contatos dentro do intervalo foram registrados como pedidos mas não pontuaram');
select is((select count(*)::int from public.indicacoes_pedido_contato where whatsapp_e164 = '+5511988880001'), 4, 'os quatro pedidos existem (contato permitido)');
select is((select link_id from public.indicacoes_pedido_contato where id = current_setting('t.p1')::uuid),
  pg_temp.lk('cccccccc-0000-0000-0000-00000000000c', 'a0000000-0000-0000-0000-000000000001', null), 'a atribuição do pedido original não mudou');
select is((select pontuado from public.pontos_decisao where pedido_id = current_setting('t.p1')::uuid), true, 'a decisão original continua pontuada');
-- Dia 31 = mais de 30 dias do último PONTUADO (dia 0), embora só 6 dias depois do último contato: o prazo não reiniciou.
select set_config('t.p4', pg_temp.pedido('a0000000-0000-0000-0000-000000000001', null,
  pg_temp.lk('ffffffff-0000-0000-0000-00000000000f', 'a0000000-0000-0000-0000-000000000001', null), '+5511988880001', 5, 31)::text, true);
select is(pg_temp.motivo(current_setting('t.p4')::uuid), 'pontuado', 'dia 31: passou o intervalo do último pontuado, pontua de novo (os contatos intermediários não reiniciaram o prazo)');
select is(pg_temp.saldo('ffffffff-0000-0000-0000-00000000000f'), 10, 'F recebeu 10 pontos');
-- Limite exato: 30 dias depois do último pontuado (dia 31 -> dia 61) já pontua; 29 dias depois (dia 90) não.
select set_config('t.p5', pg_temp.pedido('a0000000-0000-0000-0000-000000000001', null,
  pg_temp.lk('cccccccc-0000-0000-0000-00000000000c', 'a0000000-0000-0000-0000-000000000001', null), '+5511988880001', 6, 61)::text, true);
select is(pg_temp.motivo(current_setting('t.p5')::uuid), 'pontuado', 'exatamente 30 dias depois do último pontuado: pontua');
select set_config('t.p5b', pg_temp.pedido('a0000000-0000-0000-0000-000000000001', null,
  pg_temp.lk('cccccccc-0000-0000-0000-00000000000c', 'a0000000-0000-0000-0000-000000000001', null), '+5511988880001', 7, 90)::text, true);
select is(pg_temp.motivo(current_setting('t.p5b')::uuid), 'dentro_do_intervalo', '29 dias depois do último pontuado: não pontua');
select is(pg_temp.saldo('cccccccc-0000-0000-0000-00000000000c'), 20, 'C tem 20 pontos (dia 0 e dia 61)');

-- ===== Anúncio particular: WhatsApp + conta anunciante, independente do item =====
select set_config('t.p6', pg_temp.pedido(null, 'e0000000-0000-0000-0000-000000000001',
  pg_temp.lk('cccccccc-0000-0000-0000-00000000000c', null, 'e0000000-0000-0000-0000-000000000001'), '+5511988880002', 8, 0)::text, true);
select is(pg_temp.motivo(current_setting('t.p6')::uuid), 'pontuado', 'anúncio particular atribuído pontua');
select set_config('t.p7', pg_temp.pedido(null, 'e0000000-0000-0000-0000-000000000004',
  pg_temp.lk('ffffffff-0000-0000-0000-00000000000f', null, 'e0000000-0000-0000-0000-000000000004'), '+5511988880002', 9, 5)::text, true);
select is(pg_temp.motivo(current_setting('t.p7')::uuid), 'dentro_do_intervalo', 'outro anúncio da mesma conta anunciante, mesmo WhatsApp: dentro do intervalo');
select is((select destino_ref_tipo from public.pontos_decisao where pedido_id = current_setting('t.p6')::uuid), 'conta', 'anúncio particular usa a conta anunciante como destino');
select is((select destino_ref_id from public.pontos_decisao where pedido_id = current_setting('t.p6')::uuid),
  (select destino_ref_id from public.pontos_decisao where pedido_id = current_setting('t.p7')::uuid), 'os dois anúncios resolvem para a mesma conta');
select is((select destino_ref_id from public.pontos_decisao where pedido_id = current_setting('t.p6')::uuid), 'bbbbbbbb-0000-0000-0000-00000000000b'::uuid, 'a conta é a do anunciante (dono do anúncio)');
select set_config('t.p8', pg_temp.pedido(null, 'e0000000-0000-0000-0000-000000000001',
  pg_temp.lk('ffffffff-0000-0000-0000-00000000000f', null, 'e0000000-0000-0000-0000-000000000001'), '+5511988880003', 10, 0)::text, true);
select is(pg_temp.motivo(current_setting('t.p8')::uuid), 'pontuado', 'outro WhatsApp no mesmo anúncio é outra chave: pontua');
select is(pg_temp.saldo('cccccccc-0000-0000-0000-00000000000c'), 30, 'C: 30 pontos');
select is(pg_temp.saldo('ffffffff-0000-0000-0000-00000000000f'), 20, 'F: 20 pontos');

-- ===== Autoindicação, sem atribuição e destino indisponível =====
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select set_config('t.p9', (select o_pedido_id::text from public.indicacoes_enviar_contato(
  p_perfil_id => 'a0000000-0000-0000-0000-000000000001', p_item_id => null, p_nome => 'Carlos C',
  p_whatsapp => '+5511999990003', p_chave => 'chave-pontos-rpc-0002', p_codigo => current_setting('t.cod_c_p1'))), true);
reset role;
select is((select autoindicacao_suspeita from public.indicacoes_pedido_contato where id = current_setting('t.p9')::uuid), true, 'o WhatsApp do indicador como visitante marca autoindicação');
select is(pg_temp.motivo(current_setting('t.p9')::uuid), 'autoindicacao', 'autoindicação não pontua');
select is((select count(*)::int from public.indicacoes_pedido_contato where id = current_setting('t.p9')::uuid), 1, 'mas o pedido de contato existe (contato permitido, tentativa registrada)');
select set_config('t.p10', pg_temp.pedido('a0000000-0000-0000-0000-000000000001', null,
  pg_temp.lk('cccccccc-0000-0000-0000-00000000000c', 'a0000000-0000-0000-0000-000000000001', null), '+5511988880004', 11, 0, true)::text, true);
select is(pg_temp.motivo(current_setting('t.p10')::uuid), 'autoindicacao', 'pedido marcado como autoindicação suspeita não pontua');
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select set_config('t.p11', (select o_pedido_id::text from public.indicacoes_enviar_contato(
  p_perfil_id => 'a0000000-0000-0000-0000-000000000001', p_item_id => null, p_nome => 'Sem Link',
  p_whatsapp => '+5511988880005', p_chave => 'chave-pontos-rpc-0003')), true);
select set_config('t.p12', (select o_pedido_id::text from public.indicacoes_enviar_contato(
  p_perfil_id => null, p_item_id => 'e0000000-0000-0000-0000-000000000001', p_nome => 'Link Errado',
  p_whatsapp => '+5511988880006', p_chave => 'chave-pontos-rpc-0004', p_codigo => current_setting('t.cod_c_p1'))), true);
reset role;
select is(pg_temp.motivo(current_setting('t.p11')::uuid), 'sem_atribuicao', 'pedido sem link não pontua');
select is(pg_temp.motivo(current_setting('t.p12')::uuid), 'sem_atribuicao', 'link de outro destino não atribui: não pontua (IM-025)');
select is((select link_id is null from public.indicacoes_pedido_contato where id = current_setting('t.p12')::uuid), true, 'o pedido segue sem atribuição');
-- Destino indisponível depois de o link existir (links criados direto: gerar_link recusaria).
insert into public.indicacoes_link (codigo, indicador_id, perfil_id) values (repeat('b', 32), 'cccccccc-0000-0000-0000-00000000000c', 'a0000000-0000-0000-0000-000000000002');
insert into public.indicacoes_link (codigo, indicador_id, item_id) values (repeat('c', 32), 'cccccccc-0000-0000-0000-00000000000c', 'e0000000-0000-0000-0000-000000000003');
select set_config('t.p13', pg_temp.pedido('a0000000-0000-0000-0000-000000000002', null,
  pg_temp.lk('cccccccc-0000-0000-0000-00000000000c', 'a0000000-0000-0000-0000-000000000002', null), '+5511988880007', 12, 0)::text, true);
select set_config('t.p14', pg_temp.pedido(null, 'e0000000-0000-0000-0000-000000000003',
  pg_temp.lk('cccccccc-0000-0000-0000-00000000000c', null, 'e0000000-0000-0000-0000-000000000003'), '+5511988880007', 13, 0)::text, true);
select is(pg_temp.motivo(current_setting('t.p13')::uuid), 'destino_indisponivel', 'perfil despublicado não pontua (IM-079)');
select is(pg_temp.motivo(current_setting('t.p14')::uuid), 'destino_indisponivel', 'anúncio despublicado não pontua (IM-079)');
select is(pg_temp.saldo('cccccccc-0000-0000-0000-00000000000c'), 30, 'nenhum desses casos alterou o saldo de C');
select is((select count(*)::int from public.pontos_decisao where pedido_id in (select id from public.indicacoes_pedido_contato)), (select count(*)::int from public.indicacoes_pedido_contato), 'uma decisão para cada pedido, pontuando ou não');

-- ===== Parâmetros: alteração afeta só lançamentos futuros =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select throws_ok($$select public.pontos_definir_parametro('pontos_por_indicacao', 20, 'tentativa')$$, '42501', null, 'não administrador não altera parâmetro');
select is((select count(*)::int from public.pontos_parametro), 0, 'não administrador não lê parâmetros pela tabela');
select is((select o_pontos_por_indicacao from public.pontos_parametros_atuais()), 10, 'a interface lê os pontos vigentes por função');
select is((select o_intervalo_dias from public.pontos_parametros_atuais()), 30, 'a interface lê o intervalo vigente por função');
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select is((select count(*)::int from public.pontos_parametro), 2, 'administrador lê os parâmetros');
select throws_ok($$select public.pontos_definir_parametro('pontos_por_indicacao', 20, '')$$, '22023', null, 'motivo obrigatório');
select throws_ok($$select public.pontos_definir_parametro('pontos_por_indicacao', 20, null)$$, '22023', null, 'motivo nulo recusado');
select throws_ok($$select public.pontos_definir_parametro('pontos_por_indicacao', 0, 'faixa')$$, '22023', null, 'pontos abaixo da faixa recusados');
select throws_ok($$select public.pontos_definir_parametro('pontos_por_indicacao', 1001, 'faixa')$$, '22023', null, 'pontos acima da faixa recusados');
select throws_ok($$select public.pontos_definir_parametro('intervalo_dias', 0, 'faixa')$$, '22023', null, 'intervalo abaixo da faixa recusado');
select throws_ok($$select public.pontos_definir_parametro('intervalo_dias', 366, 'faixa')$$, '22023', null, 'intervalo acima da faixa recusado');
select throws_ok($$select public.pontos_definir_parametro('inexistente', 5, 'faixa')$$, 'P0002', null, 'parâmetro inexistente');
select throws_ok($$update public.pontos_parametro set valor = 99$$, '42501', null, 'cliente não altera parâmetro direto');
select lives_ok($$select public.pontos_definir_parametro('pontos_por_indicacao', 20, 'campanha de teste')$$, 'administrador altera os pontos 10 -> 20');
reset role;
select is((select valor_anterior ->> 'valor' from public.administracao_auditoria where acao = 'definir_parametro_pontos' and alvo_id = 'pontos_por_indicacao'), '10', 'auditoria guarda o valor anterior');
select is((select valor_novo ->> 'valor' from public.administracao_auditoria where acao = 'definir_parametro_pontos' and alvo_id = 'pontos_por_indicacao'), '20', 'auditoria guarda o valor novo');
select is((select motivo from public.administracao_auditoria where acao = 'definir_parametro_pontos' and alvo_id = 'pontos_por_indicacao'), 'campanha de teste', 'auditoria guarda o motivo');
select is((select autor_id from public.administracao_auditoria where acao = 'definir_parametro_pontos' and alvo_id = 'pontos_por_indicacao'), 'dddddddd-0000-0000-0000-00000000000d'::uuid, 'auditoria guarda o autor');
select set_config('t.p15', pg_temp.pedido('a0000000-0000-0000-0000-000000000001', null,
  pg_temp.lk('cccccccc-0000-0000-0000-00000000000c', 'a0000000-0000-0000-0000-000000000001', null), '+5511988880008', 14, 0)::text, true);
select is((select pontos from public.pontos_lancamento where pedido_id = current_setting('t.p15')::uuid), 20, 'novo valor vale para o crédito futuro (20)');
select is((select pontos from public.pontos_lancamento where pedido_id = current_setting('t.p1')::uuid), 10, 'o lançamento antigo continua com 10');
select is(pg_temp.saldo('cccccccc-0000-0000-0000-00000000000c'), 50, 'saldo = 10 + 10 + 10 + 20');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select lives_ok($$select public.pontos_definir_parametro('pontos_por_indicacao', 10, 'volta ao padrão')$$, 'administrador volta os pontos a 10');
select lives_ok($$select public.pontos_definir_parametro('intervalo_dias', 15, 'intervalo menor')$$, 'administrador altera o intervalo 30 -> 15');
reset role;
-- Intervalo 15: dia 0 pontua; dia 20 (que estaria dentro de 30) pontua porque 20 >= 15.
select set_config('t.p16', pg_temp.pedido('a0000000-0000-0000-0000-000000000001', null,
  pg_temp.lk('ffffffff-0000-0000-0000-00000000000f', 'a0000000-0000-0000-0000-000000000001', null), '+5511988880009', 15, 0)::text, true);
select set_config('t.p17', pg_temp.pedido('a0000000-0000-0000-0000-000000000001', null,
  pg_temp.lk('ffffffff-0000-0000-0000-00000000000f', 'a0000000-0000-0000-0000-000000000001', null), '+5511988880009', 16, 20)::text, true);
select set_config('t.p18', pg_temp.pedido('a0000000-0000-0000-0000-000000000001', null,
  pg_temp.lk('ffffffff-0000-0000-0000-00000000000f', 'a0000000-0000-0000-0000-000000000001', null), '+5511988880009', 17, 30)::text, true);
select is(pg_temp.motivo(current_setting('t.p16')::uuid), 'pontuado', 'intervalo 15: dia 0 pontua');
select is(pg_temp.motivo(current_setting('t.p17')::uuid), 'pontuado', 'intervalo 15: dia 20 pontua (com 30 seria dentro do intervalo)');
select is(pg_temp.motivo(current_setting('t.p18')::uuid), 'dentro_do_intervalo', 'intervalo 15: dia 30 está a 10 dias do último pontuado e não pontua');
select is((select intervalo_dias from public.pontos_decisao where pedido_id = current_setting('t.p17')::uuid), 15, 'a decisão guarda o intervalo aplicado');
select is((select intervalo_dias from public.pontos_decisao where pedido_id = current_setting('t.p1')::uuid), 30, 'a decisão antiga guarda o intervalo antigo (30)');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select lives_ok($$select public.pontos_definir_parametro('intervalo_dias', 30, 'volta ao padrão')$$, 'administrador volta o intervalo a 30');
reset role;
select is((select count(*)::int from public.administracao_auditoria where acao = 'definir_parametro_pontos'), 4, 'cada alteração de parâmetro gerou auditoria');

-- ===== Leitura e privacidade =====
select set_config('t.npedidos', (select count(*)::text from public.indicacoes_pedido_contato), true);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is((select saldo from public.pontos_meu_saldo), 50, 'C vê o próprio saldo');
select is((select count(*)::int from public.pontos_meus_lancamentos), 4, 'C vê só os 4 lançamentos próprios');
select is((select count(*)::int from public.pontos_meus_lancamentos where situacao = 'creditado' and tipo = 'credito'), 4, 'todos creditados');
select is((select string_agg(destino_nome, ',' order by criado_em, destino_nome) from public.pontos_meus_lancamentos), 'Bolo,Loja Um,Loja Um,Loja Um', 'destino com nome em cada lançamento');
select throws_ok($$select * from public.pontos_lancamento$$, '42501', null, 'C não lê a tabela de lançamentos');
select throws_ok($$select * from public.pontos_decisao$$, '42501', null, 'C não lê a tabela de decisões');
select throws_ok($$insert into public.pontos_lancamento (indicador_id, tipo, pontos, pedido_id, destino_perfil_id, destino_nome)
  values ('cccccccc-0000-0000-0000-00000000000c', 'credito', 999, null, 'a0000000-0000-0000-0000-000000000001', 'x')$$, '42501', null, 'cliente não insere pontos');
select is((select count(*)::int from public.administracao_pontos_lancamentos), 0, 'C não vê a visão de administração (lançamentos)');
select is((select count(*)::int from public.administracao_pontos_saldos), 0, 'C não vê a visão de administração (saldos)');
select is((select count(*)::int from public.administracao_pontos_decisoes), 0, 'C não vê a visão de administração (decisões)');
select throws_ok($$select public.pontos_reverter_credito(gen_random_uuid(), 'outro', 'tentativa')$$, '42501', null, 'C não reverte pontos');
select set_config('request.jwt.claims', '{"sub":"ffffffff-0000-0000-0000-00000000000f","role":"authenticated"}', true);
select is((select saldo from public.pontos_meu_saldo), 40, 'F vê só o próprio saldo (4 lançamentos de 10)');
select is((select count(*)::int from public.pontos_meus_lancamentos), 4, 'F vê só os próprios lançamentos');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is((select saldo from public.pontos_meu_saldo), 0, 'o responsável do perfil não ganha pontos pelo próprio perfil');
select is((select count(*)::int from public.pontos_meus_lancamentos), 0, 'o responsável do perfil não vê os pontos do indicador');
select throws_ok($$select * from public.pontos_lancamento$$, '42501', null, 'o responsável não lê a tabela de lançamentos');
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((select count(*)::int from public.pontos_meus_lancamentos), 0, 'o dono do anúncio não vê os pontos do indicador');
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-0000-0000-00000000000e","role":"authenticated"}', true);
select is((select saldo from public.pontos_meu_saldo), 0, 'conta sem indicações tem saldo 0');
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select is((select count(*)::int from public.administracao_pontos_lancamentos), 8, 'administrador vê todos os lançamentos (4 de C + 4 de F)');
select is((select count(*)::int from public.administracao_pontos_saldos), 2, 'administrador vê o saldo de cada indicador');
select is((select sum(saldo)::int from public.administracao_pontos_saldos), 90, 'soma dos saldos = 50 + 40');
select is((select count(*)::int from public.administracao_pontos_decisoes), current_setting('t.npedidos')::int, 'administrador vê uma decisão por pedido (com motivo)');
select is((select count(*)::int from public.administracao_pontos_decisoes where motivo = 'dentro_do_intervalo'), 6, 'motivos de não pontuação visíveis para auditoria');
select is((select count(distinct indicador_ref)::int from public.administracao_pontos_saldos), 2, 'indicadores aparecem por referência opaca');
reset role;

-- ===== Reversão auditável (IM-078, IM-077) =====
select set_config('t.l1', (select id::text from public.pontos_lancamento where pedido_id = current_setting('t.p1')::uuid), true);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select throws_ok($$select public.pontos_reverter_credito(current_setting('t.l1')::uuid, 'indicacao_invalida', '')$$, '22023', null, 'reversão exige observação interna');
select throws_ok($$select public.pontos_reverter_credito(current_setting('t.l1')::uuid, 'indicacao_invalida', null)$$, '22023', null, 'reversão com observação nula recusada');
select throws_ok($$select public.pontos_reverter_credito(current_setting('t.l1')::uuid, null, 'sem categoria')$$, '22023', null, 'reversão exige categoria');
select throws_ok($$select public.pontos_reverter_credito(current_setting('t.l1')::uuid, 'texto_livre', 'categoria fora da lista')$$, '22023', null, 'categoria fora da lista fixa é recusada');
select throws_ok($$select public.pontos_reverter_credito(gen_random_uuid(), 'outro', 'não existe')$$, 'P0002', null, 'lançamento inexistente');
select set_config('t.rev1', (select public.pontos_reverter_credito(current_setting('t.l1')::uuid, 'indicacao_invalida', 'Indicação inválida: teste de reversão')::text), true);
select throws_ok($$select public.pontos_reverter_credito(current_setting('t.l1')::uuid, 'outro', 'de novo')$$, 'P0409', null, 'um crédito só é revertido uma vez');
select throws_ok($$select public.pontos_reverter_credito(current_setting('t.rev1')::uuid, 'outro', 'estorno do estorno')$$, 'P0001', null, 'reversão não se reverte');
reset role;
select is((select pontos from public.pontos_lancamento where id = current_setting('t.l1')::uuid), 10, 'o lançamento original foi preservado');
select is((select tipo from public.pontos_lancamento where id = current_setting('t.l1')::uuid), 'credito', 'o original continua crédito');
select is((select pontos from public.pontos_lancamento where id = current_setting('t.rev1')::uuid), -10, 'a reversão é um novo lançamento negativo');
select is((select original_id from public.pontos_lancamento where id = current_setting('t.rev1')::uuid), current_setting('t.l1')::uuid, 'a reversão aponta o original');
select is((select autor_id from public.pontos_lancamento where id = current_setting('t.rev1')::uuid), 'dddddddd-0000-0000-0000-00000000000d'::uuid, 'a reversão guarda o autor');
select is((select motivo from public.pontos_lancamento where id = current_setting('t.rev1')::uuid), 'Indicação inválida: teste de reversão', 'a reversão guarda o motivo');
select is((select valor_anterior ->> 'pontos' from public.administracao_auditoria where acao = 'reverter_pontos' and alvo_id = current_setting('t.l1')), '10', 'auditoria da reversão guarda o valor anterior');
select is((select motivo from public.administracao_auditoria where acao = 'reverter_pontos' and alvo_id = current_setting('t.l1')), 'Indicação inválida: teste de reversão', 'auditoria da reversão guarda o motivo');
select is((select autor_id from public.administracao_auditoria where acao = 'reverter_pontos' and alvo_id = current_setting('t.l1')), 'dddddddd-0000-0000-0000-00000000000d'::uuid, 'auditoria da reversão guarda o autor');
select is(pg_temp.saldo('cccccccc-0000-0000-0000-00000000000c'), 40, 'saldo de C = 50 - 10');
select throws_ok($$update public.pontos_lancamento set pontos = 0 where id = current_setting('t.l1')::uuid$$, '42501', null, 'lançamento não é alterado (nem pelo superusuário)');
select throws_ok($$delete from public.pontos_lancamento where id = current_setting('t.rev1')::uuid$$, '42501', null, 'lançamento não é apagado');
select throws_ok($$update public.pontos_decisao set pontuado = false where pedido_id = current_setting('t.p1')::uuid$$, '42501', null, 'decisão não é alterada');
select throws_ok($$delete from public.pontos_decisao$$, '42501', null, 'decisão não é apagada');
select throws_ok($$insert into public.pontos_lancamento (indicador_id, tipo, pontos, original_id, destino_perfil_id, destino_nome, categoria, motivo, autor_id)
  values ('cccccccc-0000-0000-0000-00000000000c', 'reversao', -5, current_setting('t.l1')::uuid, 'a0000000-0000-0000-0000-000000000001', 'Loja Um', 'outro', 'm', 'dddddddd-0000-0000-0000-00000000000d')$$,
  '23514', null, 'reversão de valor diferente do crédito original é recusada pelo banco');
select is((select categoria from public.pontos_lancamento where id = current_setting('t.rev1')::uuid), 'indicacao_invalida', 'a reversão guarda a categoria');
select is((select valor_novo ->> 'categoria' from public.administracao_auditoria where acao = 'reverter_pontos' and alvo_id = current_setting('t.l1')), 'indicacao_invalida', 'auditoria da reversão guarda a categoria');
select is((select count(*)::int from public.administracao_pontos_lancamentos where id = current_setting('t.rev1')::uuid and motivo = 'Indicação inválida: teste de reversão' and categoria = 'indicacao_invalida'), 1, 'a visão do administrador traz categoria e observação interna');
select throws_ok($$insert into public.pontos_lancamento (indicador_id, tipo, pontos, original_id, destino_perfil_id, destino_nome, motivo, autor_id)
  values ('ffffffff-0000-0000-0000-00000000000f', 'reversao', -10, (select id from public.pontos_lancamento where tipo = 'credito' and indicador_id = 'ffffffff-0000-0000-0000-00000000000f' limit 1), 'a0000000-0000-0000-0000-000000000001', 'Loja Um', 'm', 'dddddddd-0000-0000-0000-00000000000d')$$,
  '23514', null, 'reversão sem categoria é recusada pelo banco');
set local role service_role;
select throws_ok($$update public.pontos_lancamento set pontos = 0$$, '42501', null, 'service_role também não altera lançamento');
select throws_ok($$delete from public.pontos_lancamento$$, '42501', null, 'service_role também não apaga lançamento');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is((select saldo from public.pontos_meu_saldo), 40, 'C vê o saldo depois da reversão');
select is((select total_revertido from public.pontos_meu_saldo), -10, 'C vê o total revertido');
select is((select situacao from public.pontos_meus_lancamentos where id = current_setting('t.l1')::uuid), 'revertido', 'o crédito aparece como revertido');
select is((select situacao from public.pontos_meus_lancamentos where id = current_setting('t.rev1')::uuid), 'reversao', 'a reversão aparece como lançamento próprio');
select is((select categoria from public.pontos_meus_lancamentos where id = current_setting('t.rev1')::uuid), 'indicacao_invalida', 'o indicador vê a categoria da reversão');
select throws_ok($$select motivo from public.pontos_meus_lancamentos$$, '42703', null, 'o indicador não tem a observação interna na visão');
select throws_ok($$select motivo from public.pontos_lancamento$$, '42501', null, 'nem na tabela (sem privilégio)');
select is((select categoria from public.pontos_meus_lancamentos where id = current_setting('t.l1')::uuid), null, 'crédito não tem categoria');
select is((select count(*)::int from information_schema.columns where table_schema = 'public' and table_name = 'pontos_meus_lancamentos' and column_name ~* '(motivo|decisao|intervalo|pontuado)'), 0, 'a visão do indicador não tem coluna de motivo de não pontuação');
select is((select count(*)::int from public.pontos_meus_lancamentos), 5, 'histórico preservado: 4 créditos + 1 reversão');
select set_config('request.jwt.claims', '{"sub":"ffffffff-0000-0000-0000-00000000000f","role":"authenticated"}', true);
select is((select count(*)::int from public.pontos_meus_lancamentos where tipo = 'reversao'), 0, 'a reversão de C não aparece para F');
reset role;
-- A reversão não reabre o intervalo: visitante W13 pontua no dia 0, o crédito é revertido, e o dia 1 segue dentro do intervalo.
select set_config('t.p19a', pg_temp.pedido('a0000000-0000-0000-0000-000000000001', null,
  pg_temp.lk('ffffffff-0000-0000-0000-00000000000f', 'a0000000-0000-0000-0000-000000000001', null), '+5511988880013', 18, 0)::text, true);
select is(pg_temp.motivo(current_setting('t.p19a')::uuid), 'pontuado', 'visitante novo pontua no dia 0');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select lives_ok($$select public.pontos_reverter_credito((select id from public.administracao_pontos_lancamentos where pedido_id = current_setting('t.p19a')::uuid), 'contato_duplicado', 'Indicação inválida')$$, 'administrador reverte o crédito pela visão de administração');
reset role;
select set_config('t.p19', pg_temp.pedido('a0000000-0000-0000-0000-000000000001', null,
  pg_temp.lk('ffffffff-0000-0000-0000-00000000000f', 'a0000000-0000-0000-0000-000000000001', null), '+5511988880013', 19, 1)::text, true);
select is(pg_temp.motivo(current_setting('t.p19')::uuid), 'dentro_do_intervalo', 'depois da reversão, o pedido revertido segue como referência do intervalo (não reabre o prazo)');
select is(pg_temp.saldo('ffffffff-0000-0000-0000-00000000000f'), 40, 'saldo de F volta a 40 depois da reversão');

-- ===== Falha no crédito nunca impede o pedido (IM-028) =====
alter table public.pontos_lancamento add constraint falha_simulada check (pontos > 100000) not valid;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select set_config('t.p20', (select o_pedido_id::text from public.indicacoes_enviar_contato(
  p_perfil_id => 'a0000000-0000-0000-0000-000000000001', p_item_id => null, p_nome => 'Falha Teste',
  p_whatsapp => '+5511988880020', p_chave => 'chave-pontos-rpc-0020', p_codigo => current_setting('t.cod_c_p1'))), true);
reset role;
select is((select count(*)::int from public.indicacoes_pedido_contato where id = current_setting('t.p20')::uuid), 1, 'falha no crédito: o pedido de contato foi preservado');
select is((select count(*)::int from public.indicacoes_notificacao where pedido_id = current_setting('t.p20')::uuid), 1, 'falha no crédito: a notificação ao responsável foi criada');
select is((select count(*)::int from public.pontos_decisao where pedido_id = current_setting('t.p20')::uuid), 0, 'falha no crédito: nenhuma decisão parcial');
select is((select count(*)::int from public.pontos_lancamento where pedido_id = current_setting('t.p20')::uuid), 0, 'falha no crédito: nenhum lançamento parcial');
select is((select count(*)::int from public.pontos_falha where pedido_id = current_setting('t.p20')::uuid), 1, 'a falha foi registrada para reprocessamento');
select set_config('t.p21', pg_temp.pedido('a0000000-0000-0000-0000-000000000001', null,
  pg_temp.lk('cccccccc-0000-0000-0000-00000000000c', 'a0000000-0000-0000-0000-000000000001', null), '+5511988880021', 20, 0)::text, true);
select is((select count(*)::int from public.pontos_falha where pedido_id = current_setting('t.p21')::uuid), 1, 'segundo pedido com falha também registrado');
alter table public.pontos_lancamento drop constraint falha_simulada;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select is((select count(*)::int from public.administracao_pontos_falhas where pendente), 2, 'o administrador vê as duas falhas pendentes (alerta)');
select throws_ok($$select public.pontos_reprocessar_pedido(current_setting('t.p20')::uuid, '')$$, '22023', null, 'reprocessar exige motivo');
select set_config('t.dec20', (select public.pontos_reprocessar_pedido(current_setting('t.p20')::uuid, 'falha de teste corrigida')::text), true);
select set_config('t.dec20b', (select public.pontos_reprocessar_pedido(current_setting('t.p20')::uuid, 'repetição')::text), true);
reset role;
select is(current_setting('t.dec20b'), current_setting('t.dec20'), 'reprocessar de novo devolve a mesma decisão (idempotente)');
select is(pg_temp.motivo(current_setting('t.p20')::uuid), 'pontuado', 'o pedido reprocessado pontua');
select is((select count(*)::int from public.pontos_lancamento where pedido_id = current_setting('t.p20')::uuid), 1, 'reprocessar não duplica o crédito');
select is((select count(*)::int from public.administracao_auditoria where acao = 'reprocessar_pontos_pedido'), 1, 'o reprocessamento efetivo foi auditado (uma vez)');
select is(public.pontos_reprocessar_pendentes(10), 1, 'reprocessamento em lote resolve o pedido restante');
select is(public.pontos_reprocessar_pendentes(10), 0, 'e não há mais pendências');
select is(pg_temp.motivo(current_setting('t.p21')::uuid), 'pontuado', 'pedido do lote pontuou');
select is(pg_temp.saldo('cccccccc-0000-0000-0000-00000000000c'), 60, 'saldo de C = 40 + 10 + 10');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select is((select count(*)::int from public.administracao_pontos_falhas where pendente), 0, 'sem falhas pendentes depois do reprocessamento');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select throws_ok($$select public.pontos_reprocessar_pedido(gen_random_uuid(), 'x')$$, '42501', null, 'não administrador não reprocessa');
select throws_ok($$select public.pontos_reprocessar_pendentes(5)$$, '42501', null, 'authenticated não executa o lote do servidor');
reset role;

select * from finish();
rollback;
