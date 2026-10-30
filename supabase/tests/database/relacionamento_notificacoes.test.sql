-- pgTAP · Base de Relacionamento (curtir, entrada por indicação, saída, privacidade) e avisos no app · Fase 5
-- IM-039, IM-040, IM-041, IM-042, IM-043, IM-044, IM-045, IM-047, IM-048, IM-049, IM-050, IM-051, IM-052, IM-053, IM-086
begin;
select * from no_plan();
delete from public.catalogo_categoria;

-- Contas: A (responsável de P1, P2, P3 e do item I2), B (anunciante particular do item I1), C e F (indicadores com WhatsApp),
-- E (curtidor), D (administrador).
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
update public.contas_conta set whatsapp_e164 = '+5511999990003', nome_exibicao = 'Carla Souza' where id = 'cccccccc-0000-0000-0000-00000000000c';
update public.contas_conta set whatsapp_e164 = '+5511999990004', nome_exibicao = 'Fernanda' where id = 'ffffffff-0000-0000-0000-00000000000f';
update public.contas_conta set nome_exibicao = 'Eduardo Pereira' where id = 'eeeeeeee-0000-0000-0000-00000000000e';
insert into public.catalogo_categoria (id, nome, slug, ativa, ordem) values
  ('11111111-0000-0000-0000-000000000001', 'Alimentação', 'alimentacao', true, 1);

insert into public.perfis_perfil (id, responsavel_id, slug) values
  ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a', 'loja-um'),
  ('a0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-00000000000a', 'loja-dois'),
  ('a0000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-00000000000a', 'loja-tres');
insert into public.perfis_perfil_versao (id, perfil_id, nome, descricao_breve, imagem_path, categoria_principal_id, cidade, uf) values
  ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Loja Um', 'Doces', 'perfil/a0000000-0000-0000-0000-000000000001/c.jpg', '11111111-0000-0000-0000-000000000001', 'Porto Alegre', 'RS'),
  ('a1000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'Loja Dois', 'Doces', 'perfil/a0000000-0000-0000-0000-000000000002/c.jpg', '11111111-0000-0000-0000-000000000001', 'Canoas', 'RS'),
  ('a1000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', 'Loja Três', 'Doces', 'perfil/a0000000-0000-0000-0000-000000000003/c.jpg', '11111111-0000-0000-0000-000000000001', 'Gravataí', 'RS');
insert into public.perfis_perfil_versao_contato (versao_id, whatsapp_comercial_e164) values
  ('a1000000-0000-0000-0000-000000000001', '+5551988880001'),
  ('a1000000-0000-0000-0000-000000000002', '+5551988880002'),
  ('a1000000-0000-0000-0000-000000000003', '+5551988880003');
update public.perfis_perfil_versao set situacao = 'pendente', enviada_em = now()
  where id in ('a1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000003');
update public.perfis_perfil_versao set situacao = 'aprovada'
  where id in ('a1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000003');
update public.perfis_perfil set versao_aprovada_id = 'a1000000-0000-0000-0000-000000000001', publicado = true where id = 'a0000000-0000-0000-0000-000000000001';
update public.perfis_perfil set versao_aprovada_id = 'a1000000-0000-0000-0000-000000000002', publicado = false where id = 'a0000000-0000-0000-0000-000000000002';
update public.perfis_perfil set versao_aprovada_id = 'a1000000-0000-0000-0000-000000000003', publicado = true where id = 'a0000000-0000-0000-0000-000000000003';

-- Itens: I1 particular de B; I2 item do perfil P1 (dono A).
insert into public.catalogo_item (id, conta_id, perfil_id, tipo) values
  ('e0000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-00000000000b', null, 'produto'),
  ('e0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000001', 'servico');
insert into public.catalogo_item_versao (id, item_id, situacao, enviada_em, nome, descricao, foto_path, categoria_principal_id, cidade, uf) values
  ('e1000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'aprovada', now(), 'Bolo', 'Bolo', 'item/e0000000-0000-0000-0000-000000000001/a.jpg', '11111111-0000-0000-0000-000000000001', 'Porto Alegre', 'RS'),
  ('e1000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000002', 'aprovada', now(), 'Entrega', 'Entrega', 'item/e0000000-0000-0000-0000-000000000002/a.jpg', '11111111-0000-0000-0000-000000000001', null, null);
update public.catalogo_item set versao_aprovada_id = 'e1000000-0000-0000-0000-000000000001', publicado = true where id = 'e0000000-0000-0000-0000-000000000001';
update public.catalogo_item set versao_aprovada_id = 'e1000000-0000-0000-0000-000000000002', publicado = true where id = 'e0000000-0000-0000-0000-000000000002';

-- Apoio (superusuário): link do indicador, pedido direto e leitura da decisão.
create function pg_temp.lk(p_ind uuid, p_perfil uuid, p_item uuid) returns uuid language sql as $$
  select id from public.indicacoes_link
  where indicador_id = p_ind and perfil_id is not distinct from p_perfil and item_id is not distinct from p_item;
$$;
create function pg_temp.pedido(p_perfil uuid, p_item uuid, p_link uuid, p_wa text, p_n integer, p_susp boolean default false)
returns uuid language sql as $$
  insert into public.indicacoes_pedido_contato
    (perfil_id, item_id, link_id, nome, whatsapp_e164, chave_idempotencia, autoindicacao_suspeita)
  values (p_perfil, p_item, p_link, 'Visitante Teste', p_wa, 'chave-rel-' || lpad(p_n::text, 6, '0'), p_susp)
  returning id;
$$;
create function pg_temp.motivo(p_pedido uuid) returns text language sql as $$
  select motivo from public.relacionamento_entrada_decisao where pedido_id = p_pedido;
$$;

-- ===== Estrutura: RLS forçada, políticas por operação, sem privilégio direto, sem escrita =====
select is((select bool_and(relrowsecurity and relforcerowsecurity) from pg_class where oid = any(array[
  'public.relacionamento_membro'::regclass, 'public.relacionamento_saida'::regclass, 'public.relacionamento_evento'::regclass,
  'public.relacionamento_entrada_decisao'::regclass, 'public.relacionamento_falha'::regclass,
  'public.notificacoes_leitura'::regclass])), true, 'RLS ativa e forçada nas 6 tabelas novas');
select is((select count(*)::int from pg_policies where schemaname = 'public'
  and tablename in ('relacionamento_membro', 'relacionamento_saida', 'relacionamento_evento', 'relacionamento_entrada_decisao',
    'relacionamento_falha', 'notificacoes_leitura')), 24, '4 políticas (select, insert, update, delete) por tabela');
select is((select bool_or(has_table_privilege('anon', t, p))
  from unnest(array['public.relacionamento_membro', 'public.relacionamento_saida', 'public.relacionamento_evento',
    'public.relacionamento_entrada_decisao', 'public.relacionamento_falha', 'public.notificacoes_leitura']) t,
  unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) p), false, 'anon sem nenhum privilégio nas tabelas');
select is((select bool_or(has_table_privilege('authenticated', t, p))
  from unnest(array['public.relacionamento_membro', 'public.relacionamento_saida', 'public.relacionamento_evento',
    'public.relacionamento_entrada_decisao', 'public.relacionamento_falha']) t,
  unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) p), false, 'authenticated sem privilégio direto nas tabelas do relacionamento');
select is((select bool_or(has_table_privilege('authenticated', 'public.notificacoes_leitura', p))
  from unnest(array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) p), false, 'authenticated só lê a leitura (e só a própria, por política)');
select is((select bool_or(has_table_privilege(r, v, p))
  from unnest(array['anon', 'authenticated']) r,
  unnest(array['public.relacionamento_meus_membros', 'public.relacionamento_meu_resumo', 'public.relacionamento_minhas_participacoes',
    'public.notificacoes_meus_avisos', 'public.notificacoes_quem_me_indicou']) v,
  unnest(array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) p), false, 'visões sem escrita');
select is((select bool_or(has_table_privilege('anon', v, 'SELECT'))
  from unnest(array['public.relacionamento_meus_membros', 'public.relacionamento_meu_resumo', 'public.relacionamento_minhas_participacoes',
    'public.notificacoes_meus_avisos', 'public.notificacoes_quem_me_indicou']) v), false, 'anon não lê nenhuma visão nova');
select columns_are('public', 'relacionamento_meus_membros', array['id', 'perfil_id', 'perfil_nome', 'pessoa_nome', 'curtiu', 'curtida_em',
  'indicou', 'primeira_indicacao_em', 'ultima_indicacao_em', 'indicacoes_validas', 'interacoes', 'entrou_em'],
  'visão da empresa: nome público, datas e interações; sem WhatsApp, e-mail, nome completo nem conta_id (IM-041)');
select columns_are('public', 'relacionamento_meu_resumo', array['perfil_id', 'perfil_nome', 'membros', 'curtidas_ativas', 'indicadores', 'interacoes', 'saidas'],
  'resumo agregado por perfil, sem pessoa');
select columns_are('public', 'relacionamento_minhas_participacoes', array['perfil_id', 'perfil_slug', 'perfil_nome', 'curtiu', 'curtida_em',
  'indicou', 'indicacoes_validas', 'entrou_em'], 'participações da própria pessoa, sem id de conta');
select columns_are('public', 'notificacoes_meus_avisos', array['origem', 'origem_id', 'tipo', 'destino_tipo', 'destino_id', 'destino_nome',
  'ator_nome', 'criado_em', 'lida', 'lida_em'], 'avisos: nome público do ator, nada do visitante, sem id de conta (IM-050)');
select columns_are('public', 'notificacoes_quem_me_indicou', array['id', 'destino_tipo', 'destino_id', 'destino_nome', 'perfil_destino_id',
  'perfil_destino_nome', 'indicador_nome', 'indicador_ref', 'indicador_saiu_da_base', 'criado_em'], 'aba Quem me indicou: só dados públicos do indicador (IM-048, IM-050)');
select is(has_function_privilege('anon', 'public.relacionamento_curtir(uuid)', 'EXECUTE')
  or has_function_privilege('anon', 'public.relacionamento_descurtir(uuid)', 'EXECUTE')
  or has_function_privilege('anon', 'public.relacionamento_sair_da_base(uuid)', 'EXECUTE')
  or has_function_privilege('anon', 'public.notificacoes_contar_nao_lidas()', 'EXECUTE')
  or has_function_privilege('anon', 'public.notificacoes_marcar_lida(text,uuid)', 'EXECUTE')
  or has_function_privilege('anon', 'public.notificacoes_marcar_todas_lidas()', 'EXECUTE'), false, 'anon não executa nenhuma função nova');
select is(has_function_privilege('authenticated', 'public.relacionamento_avaliar_pedido(uuid)', 'EXECUTE')
  or has_function_privilege('authenticated', 'public.relacionamento_reprocessar_pendentes(integer)', 'EXECUTE'), false,
  'avaliação e reprocessamento não são chamáveis por authenticated');
select is(has_function_privilege('authenticated', 'public.relacionamento_nome_publico(text)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.relacionamento_nome_publico(text)', 'EXECUTE'), true, 'nome público: função pura, só authenticated (as visões a chamam em nome de quem consulta)');
select is(public.relacionamento_nome_publico('  Maria   de Souza Lima '), 'Maria L.', 'nome público: primeiro nome e inicial do último sobrenome');
select is(public.relacionamento_nome_publico('Fernanda'), 'Fernanda', 'nome público: nome único');
select is(public.relacionamento_nome_publico(null), 'Pessoa', 'nome público: sem nome vira Pessoa');
select is(has_function_privilege('service_role', 'public.relacionamento_reprocessar_pendentes(integer)', 'EXECUTE'), true, 'service_role executa o reprocessamento');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname ~* '^(relacionamento|notificacoes)_' and p.proname ~* '(comiss|remarket|campanha)'), 0,
  'os módulos não têm função de comissão nem de remarketing (IM-042, IM-046)');
select is((select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'relacionamento_evento'
  and column_name ~ '(conta|pessoa|usuario)')::int, 0, 'o histórico agregado não tem coluna de pessoa (anônimo)');

-- ===== Curtir (IM-043) =====
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$select public.relacionamento_curtir('a0000000-0000-0000-0000-000000000001')$$, '42501', null, 'visitante sem login não curte');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-0000-0000-00000000000e","role":"authenticated"}', true);
select is(public.relacionamento_curtir('a0000000-0000-0000-0000-000000000001'), true, 'E curte P1: curtida criada');
select is(public.relacionamento_curtir('a0000000-0000-0000-0000-000000000001'), false, 'curtir de novo é idempotente (1 por conta e perfil)');
select throws_ok($$select public.relacionamento_curtir('a0000000-0000-0000-0000-000000000002')$$, 'P0002', null, 'perfil indisponível não recebe curtida');
select throws_ok($$select public.relacionamento_curtir(gen_random_uuid())$$, 'P0002', null, 'perfil inexistente: mesma resposta');
select throws_ok($$select public.relacionamento_curtir(null)$$, '22023', null, 'perfil obrigatório');
select is((select count(*)::int from public.relacionamento_minhas_participacoes where curtiu and not indicou), 1, 'E vê a própria participação');
select is((select count(*)::int from public.notificacoes_meus_avisos), 0, 'quem curtiu não recebe aviso de curtida');
select throws_ok($$insert into public.relacionamento_membro (perfil_id, conta_id, curtida_em) values ('a0000000-0000-0000-0000-000000000003', 'eeeeeeee-0000-0000-0000-00000000000e', now())$$,
  '42501', null, 'authenticated não insere direto na base');
select throws_ok($$select * from public.relacionamento_membro$$, '42501', null, 'authenticated não lê a tabela da base');
reset role;
select is((select count(*)::int from public.relacionamento_membro), 1, 'uma linha na base');
select is((select count(*)::int from public.relacionamento_evento where tipo = 'curtida'), 1, 'um evento de curtida');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok($$select public.relacionamento_curtir('a0000000-0000-0000-0000-000000000001')$$, 'P0403', null, 'o responsável não curte o próprio perfil');
select is((select count(*)::int from public.relacionamento_meus_membros), 1, 'o responsável vê 1 pessoa na base');
select is((select pessoa_nome from public.relacionamento_meus_membros), 'Eduardo P.', 'a empresa vê só o nome público (primeiro nome e inicial)');
select is((select interacoes from public.relacionamento_meus_membros), 1, 'contagem de interações: a curtida');
select is(public.notificacoes_contar_nao_lidas(), 1, 'sino: 1 não lida (curtida)');
select is((select tipo from public.notificacoes_meus_avisos), 'curtida', 'o aviso é de curtida');
select is((select ator_nome from public.notificacoes_meus_avisos), 'Eduardo P.', 'aviso com nome público');
select set_config('t.curtida_origem', (select origem_id::text from public.notificacoes_meus_avisos where origem = 'curtida'), true);
select is(public.notificacoes_marcar_lida('curtida', current_setting('t.curtida_origem')::uuid), true, 'marcar uma como lida');
select is(public.notificacoes_marcar_lida('curtida', current_setting('t.curtida_origem')::uuid), false, 'marcar de novo: idempotente');
select is(public.notificacoes_contar_nao_lidas(), 0, 'contador zerou');
reset role;

-- Outro responsável não vê nada de A, nem lê a base, nem marca aviso alheio.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((select count(*)::int from public.relacionamento_meus_membros), 0, 'B não vê a base de A (IM-041)');
select is((select count(*)::int from public.relacionamento_meu_resumo), 0, 'B não tem perfis, resumo vazio');
select is((select count(*)::int from public.notificacoes_meus_avisos), 0, 'B não vê avisos de A');
select is((select count(*)::int from public.notificacoes_leitura), 0, 'B não lê a leitura de A (RLS)');
select throws_ok($$select public.notificacoes_marcar_lida('curtida', current_setting('t.curtida_origem')::uuid)$$, 'P0002', null, 'B não marca aviso de A (mensagem neutra)');
reset role;
select is((select count(*)::int from public.notificacoes_leitura), 1, 'a leitura de A continua intacta');

-- Descurtir remove só a curtida; sem indicação a pessoa sai da base. Curtir de novo não cria aviso novo.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-0000-0000-00000000000e","role":"authenticated"}', true);
select is(public.relacionamento_descurtir('a0000000-0000-0000-0000-000000000001'), true, 'E descurte');
select is(public.relacionamento_descurtir('a0000000-0000-0000-0000-000000000001'), false, 'descurtir de novo: idempotente');
select is((select count(*)::int from public.relacionamento_minhas_participacoes), 0, 'sem indicação, descurtir tira da base');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is((select count(*)::int from public.notificacoes_meus_avisos where origem = 'curtida'), 0, 'curtida desfeita some dos avisos');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-0000-0000-00000000000e","role":"authenticated"}', true);
select is(public.relacionamento_curtir('a0000000-0000-0000-0000-000000000001'), true, 'E curte de novo');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is((select lida from public.notificacoes_meus_avisos where origem = 'curtida'), true, 'curtir de novo não cria aviso novo não lido');
select is(public.notificacoes_contar_nao_lidas(), 0, 'contador segue zerado');
reset role;
select is((select count(*)::int from public.relacionamento_evento where tipo = 'descurtida'), 1, 'evento de descurtida registrado');
select is((select count(*)::int from public.pontos_lancamento), 0, 'curtir não pontua (IM-042)');

-- ===== Gerar link e compartilhar NÃO incluem ninguém nem geram aviso (IM-044, IM-051) =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select lives_ok($$select * from public.indicacoes_gerar_link(p_perfil_id => 'a0000000-0000-0000-0000-000000000001')$$, 'C gera link de P1');
select lives_ok($$select * from public.indicacoes_gerar_link(p_item_id => 'e0000000-0000-0000-0000-000000000002')$$, 'C gera link do item I2');
select lives_ok($$select * from public.indicacoes_gerar_link(p_item_id => 'e0000000-0000-0000-0000-000000000001')$$, 'C gera link do anúncio I1');
select lives_ok($$select * from public.indicacoes_gerar_link(p_perfil_id => 'a0000000-0000-0000-0000-000000000003')$$, 'C gera link de P3');
select set_config('t.cod_c_p1', (select codigo from public.indicacoes_meus_links where destino_id = 'a0000000-0000-0000-0000-000000000001'), true);
select lives_ok($$select public.indicacoes_registrar_compartilhamento(current_setting('t.cod_c_p1'), 'whatsapp')$$, 'C registra compartilhamento');
select is(public.notificacoes_contar_nao_lidas(), 0, 'link e compartilhamento não geram aviso');
select set_config('request.jwt.claims', '{"sub":"ffffffff-0000-0000-0000-00000000000f","role":"authenticated"}', true);
select lives_ok($$select * from public.indicacoes_gerar_link(p_perfil_id => 'a0000000-0000-0000-0000-000000000001')$$, 'F gera link de P1');
reset role;
-- Link de P2 (indisponível) só pode existir por inserção direta: serve para provar a regra de disponibilidade.
insert into public.indicacoes_link (codigo, indicador_id, perfil_id)
values (replace(gen_random_uuid()::text, '-', ''), 'cccccccc-0000-0000-0000-00000000000c', 'a0000000-0000-0000-0000-000000000002');
select is((select count(*)::int from public.relacionamento_membro where conta_id in ('cccccccc-0000-0000-0000-00000000000c', 'ffffffff-0000-0000-0000-00000000000f')), 0,
  'gerar link e compartilhar não colocam ninguém na base (D-013)');

-- ===== Contato válido pelo link: entra na base (IM-044) =====
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select set_config('t.p1', (select o_pedido_id::text from public.indicacoes_enviar_contato(
  p_perfil_id => 'a0000000-0000-0000-0000-000000000001', p_item_id => null, p_nome => 'Maria Silva',
  p_whatsapp => '+5511988880001', p_chave => 'chave-rel-rpc-00001', p_codigo => current_setting('t.cod_c_p1'))), true);
reset role;
select is(pg_temp.motivo(current_setting('t.p1')::uuid), 'valido', 'p1: contato válido pelo link do indicador');
select is((select incluido_na_base from public.relacionamento_entrada_decisao where pedido_id = current_setting('t.p1')::uuid), true, 'p1: indicador incluído na base de P1');
select set_config('t.p2', pg_temp.pedido(null, 'e0000000-0000-0000-0000-000000000002', pg_temp.lk('cccccccc-0000-0000-0000-00000000000c', null, 'e0000000-0000-0000-0000-000000000002'), '+5511988880002', 2)::text, true);
select is(pg_temp.motivo(current_setting('t.p2')::uuid), 'valido', 'p2: item do perfil, válido');
select set_config('t.p3', pg_temp.pedido(null, 'e0000000-0000-0000-0000-000000000001', pg_temp.lk('cccccccc-0000-0000-0000-00000000000c', null, 'e0000000-0000-0000-0000-000000000001'), '+5511988880003', 3)::text, true);
select is(pg_temp.motivo(current_setting('t.p3')::uuid), 'valido', 'p3: anúncio particular, válido');
select is((select incluido_na_base from public.relacionamento_entrada_decisao where pedido_id = current_setting('t.p3')::uuid), false, 'p3: anúncio particular não tem base de perfil');
select set_config('t.p4', pg_temp.pedido('a0000000-0000-0000-0000-000000000001', null, null, '+5511988880004', 4)::text, true);
select is(pg_temp.motivo(current_setting('t.p4')::uuid), 'sem_atribuicao', 'p4: sem link não entra na base');
select set_config('t.p5', pg_temp.pedido('a0000000-0000-0000-0000-000000000001', null, pg_temp.lk('cccccccc-0000-0000-0000-00000000000c', 'a0000000-0000-0000-0000-000000000001', null), '+5511988880005', 5, true)::text, true);
select is(pg_temp.motivo(current_setting('t.p5')::uuid), 'autoindicacao', 'p5: autoindicação não entra');
select set_config('t.p6', pg_temp.pedido('a0000000-0000-0000-0000-000000000002', null, pg_temp.lk('cccccccc-0000-0000-0000-00000000000c', 'a0000000-0000-0000-0000-000000000002', null), '+5511988880006', 6)::text, true);
select is(pg_temp.motivo(current_setting('t.p6')::uuid), 'destino_indisponivel', 'p6: perfil indisponível não entra');
select set_config('t.p7', pg_temp.pedido('a0000000-0000-0000-0000-000000000003', null, pg_temp.lk('cccccccc-0000-0000-0000-00000000000c', 'a0000000-0000-0000-0000-000000000003', null), '+5511988880007', 7)::text, true);
select set_config('t.p8', pg_temp.pedido('a0000000-0000-0000-0000-000000000001', null, pg_temp.lk('ffffffff-0000-0000-0000-00000000000f', 'a0000000-0000-0000-0000-000000000001', null), '+5511988880008', 8)::text, true);
select is((select count(*)::int from public.relacionamento_entrada_decisao), 8, 'uma decisão por pedido');
select is((select count(*)::int from public.relacionamento_membro), 4, 'base: E e C e F em P1, C em P3');
select is((select count(*)::int from public.relacionamento_membro where conta_id = 'cccccccc-0000-0000-0000-00000000000c'), 2, 'a mesma pessoa está em duas bases de perfis distintos (IM-040)');
select is((select indicacoes_validas from public.relacionamento_membro where perfil_id = 'a0000000-0000-0000-0000-000000000001' and conta_id = 'cccccccc-0000-0000-0000-00000000000c'), 2,
  'deduplicada: duas indicações válidas, uma linha por pessoa e perfil');
-- Idempotência da avaliação.
select is(public.relacionamento_avaliar_pedido(current_setting('t.p1')::uuid), (select id from public.relacionamento_entrada_decisao where pedido_id = current_setting('t.p1')::uuid),
  'avaliar de novo devolve a mesma decisão');
select is((select indicacoes_validas from public.relacionamento_membro where perfil_id = 'a0000000-0000-0000-0000-000000000001' and conta_id = 'cccccccc-0000-0000-0000-00000000000c'), 2, 'e não conta de novo');
select throws_ok($$insert into public.relacionamento_entrada_decisao (pedido_id, valido, motivo) values (current_setting('t.p1')::uuid, false, 'sem_atribuicao')$$,
  '23505', null, 'o banco recusa segunda decisão para o mesmo pedido');
select throws_ok($$update public.relacionamento_evento set tipo = 'saida' where tipo = 'curtida'$$, '42501', null, 'eventos são só de inserção');
select throws_ok($$delete from public.relacionamento_entrada_decisao$$, '42501', null, 'decisões são só de inserção');

-- A (responsável) vê a base, as abas e os avisos.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is((select count(*)::int from public.relacionamento_meus_membros), 4, 'A vê 4 pessoas nas bases dos seus perfis');
select is((select indicacoes_validas::text || '/' || interacoes::text from public.relacionamento_meus_membros where pessoa_nome = 'Carla S.' and perfil_id = 'a0000000-0000-0000-0000-000000000001'), '2/2',
  'contagem de interações de C em P1');
select is((select count(*)::int from public.relacionamento_meus_membros where pessoa_nome ilike '%Souza%'), 0, 'nunca o nome completo');
select is((select count(*)::int from public.notificacoes_meus_avisos where tipo = 'contato_valido'), 4, 'avisos de contato válido: p1, p2, p7, p8 (não p3 de B, nem p4, p5, p6)');
select is(public.notificacoes_contar_nao_lidas(), 4, 'sino: 4 não lidas');
select is((select count(*)::int from public.notificacoes_quem_me_indicou), 4, 'Quem me indicou: só contatos válidos');
select is((select count(*)::int from public.notificacoes_quem_me_indicou where indicador_nome = 'Carla S.'), 3, 'indicador identificado só pelo nome público');
select is((select count(*)::int from public.notificacoes_quem_me_indicou where indicador_nome ilike '%Souza%'), 0, 'sem nome completo do indicador (IM-050)');
select is((select perfil_destino_nome || '/' || destino_tipo || '/' || destino_nome from public.notificacoes_quem_me_indicou where id = current_setting('t.p2')::uuid), 'Loja Um/item/Entrega',
  'item de perfil: mostra o item e o perfil de destino (IM-048)');
select is((select count(*)::int from public.notificacoes_quem_me_indicou q where q.id in (current_setting('t.p4')::uuid, current_setting('t.p5')::uuid, current_setting('t.p6')::uuid)), 0, 'contato sem link, autoindicação e destino indisponível não aparecem');
select throws_ok($$select public.notificacoes_marcar_lida('indicacao_valida', current_setting('t.p1')::uuid)$$, 'P0002', null, 'A não marca aviso do indicador');
select throws_ok($$select public.notificacoes_marcar_lida('qualquer', current_setting('t.p1')::uuid)$$, '22023', null, 'origem inválida');
select is(public.notificacoes_marcar_todas_lidas(), 4, 'marcar todas: 4 marcadas agora');
select is(public.notificacoes_marcar_todas_lidas(), 0, 'de novo: nada a marcar');
select is(public.notificacoes_contar_nao_lidas(), 0, 'contador zerou');
select is((select count(*)::int from public.notificacoes_leitura), 5, 'A só vê a própria leitura (curtida + 4)');
reset role;

-- B (anunciante particular) vê só o seu item.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((select count(*)::int from public.notificacoes_quem_me_indicou), 1, 'B vê só o contato válido do seu anúncio');
select is((select perfil_destino_id is null from public.notificacoes_quem_me_indicou), true, 'anúncio particular não tem perfil de destino');
select is(public.notificacoes_contar_nao_lidas(), 1, 'B tem 1 aviso');
reset role;

-- C (indicador) vê as próprias indicações e avisos; nunca dados do visitante.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is((select count(*)::int from public.indicacoes_minhas_indicacoes), 6, 'Minhas indicações reaproveita indicacoes_minhas_indicacoes (IM-049)');
select is((select count(*)::int from public.notificacoes_meus_avisos where tipo = 'indicacao_valida'), 4, 'C recebe aviso das 4 indicações válidas (p1, p2, p3, p7)');
select is((select count(*)::int from public.notificacoes_quem_me_indicou), 0, 'C não é responsável: aba vazia');
select is((select count(*)::int from public.relacionamento_meus_membros), 0, 'C não vê base alguma');
select is((select count(*)::int from public.relacionamento_minhas_participacoes), 2, 'C vê as próprias participações (P1 e P3)');
reset role;

-- ===== Curtida e indicação juntas, na mesma linha =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is(public.relacionamento_curtir('a0000000-0000-0000-0000-000000000001'), true, 'C curte P1');
reset role;
select is((select count(*)::int from public.relacionamento_membro where perfil_id = 'a0000000-0000-0000-0000-000000000001' and conta_id = 'cccccccc-0000-0000-0000-00000000000c'), 1, 'curtida e indicação na mesma linha');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is((select curtiu::text || '/' || indicou::text || '/' || interacoes::text from public.relacionamento_meus_membros where pessoa_nome = 'Carla S.' and perfil_id = 'a0000000-0000-0000-0000-000000000001'), 'true/true/3', 'curtiu, indicou e 3 interações');
select is(public.notificacoes_contar_nao_lidas(), 1, 'nova curtida: 1 não lida');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is(public.relacionamento_descurtir('a0000000-0000-0000-0000-000000000001'), true, 'C descurte P1');
select is((select indicou from public.relacionamento_minhas_participacoes where perfil_id = 'a0000000-0000-0000-0000-000000000001'), true, 'descurtir remove só a curtida: a indicação permanece');
reset role;

-- ===== Sair da base (IM-045) =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-0000-0000-00000000000e","role":"authenticated"}', true);
select is(public.relacionamento_sair_da_base('a0000000-0000-0000-0000-000000000001'), true, 'E sai da base de P1');
select is(public.relacionamento_sair_da_base('a0000000-0000-0000-0000-000000000001'), false, 'sair de novo: idempotente');
select is(public.relacionamento_sair_da_base('a0000000-0000-0000-0000-000000000003'), false, 'quem não estava na base: nada a fazer');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is(public.relacionamento_sair_da_base('a0000000-0000-0000-0000-000000000001'), true, 'C sai da base de P1');
select is((select count(*)::int from public.notificacoes_meus_avisos where tipo = 'indicacao_valida'), 2, 'encerra os avisos dele sobre P1 (sobram p3 e p7)');
select is((select count(*)::int from public.relacionamento_minhas_participacoes), 1, 'continua só na base de P3');
reset role;
select is((select count(*)::int from public.relacionamento_saida), 2, 'saídas registradas (E e C em P1)');
select is((select count(*)::int from public.relacionamento_evento where tipo = 'saida'), 2, 'histórico agregado guarda as saídas');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is((select count(*)::int from public.relacionamento_meus_membros), 2, 'a empresa não vê mais quem saiu: sobram C em P3 e F em P1');
select is((select count(*)::int from public.notificacoes_quem_me_indicou where indicador_saiu_da_base and indicador_nome is null and indicador_ref is null), 2,
  'Quem me indicou anonimiza quem saiu (p1, p2)');
select is((select count(*)::int from public.notificacoes_meus_avisos where tipo = 'contato_valido' and ator_nome is null), 2, 'avisos de contato também sem o nome de quem saiu');
select is((select saidas from public.relacionamento_meu_resumo where perfil_id = 'a0000000-0000-0000-0000-000000000001'), 2, 'resumo agregado conta as saídas');
reset role;

-- Novo contato válido de quem saiu: o contato vale, a pessoa não volta sozinha e não recebe aviso.
select set_config('t.p9', pg_temp.pedido('a0000000-0000-0000-0000-000000000001', null, pg_temp.lk('cccccccc-0000-0000-0000-00000000000c', 'a0000000-0000-0000-0000-000000000001', null), '+5511988880009', 9)::text, true);
select is(pg_temp.motivo(current_setting('t.p9')::uuid), 'valido', 'p9: contato válido de quem saiu');
select is((select incluido_na_base from public.relacionamento_entrada_decisao where pedido_id = current_setting('t.p9')::uuid), false, 'p9: sem reentrada automática');
select is((select count(*)::int from public.relacionamento_membro where perfil_id = 'a0000000-0000-0000-0000-000000000001' and conta_id = 'cccccccc-0000-0000-0000-00000000000c'), 0, 'C segue fora da base de P1');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is((select count(*)::int from public.notificacoes_meus_avisos where tipo = 'indicacao_valida'), 2, 'sem novos avisos para quem saiu');
-- Reentrada só por ato próprio (curtir).
select is(public.relacionamento_curtir('a0000000-0000-0000-0000-000000000001'), true, 'C volta curtindo');
select is((select curtiu::text || '/' || indicou::text from public.relacionamento_minhas_participacoes where perfil_id = 'a0000000-0000-0000-0000-000000000001'), 'true/false',
  'volta só com a curtida: o histórico de indicações não é restaurado');
reset role;
select is((select count(*)::int from public.relacionamento_saida where conta_id = 'cccccccc-0000-0000-0000-00000000000c'), 0, 'a marca de saída é removida pelo ato explícito');

-- ===== Falha não impede o pedido (IM-028) =====
alter table public.relacionamento_membro add constraint falha_simulada
  check (conta_id <> 'ffffffff-0000-0000-0000-00000000000f') not valid;
select set_config('t.p10', pg_temp.pedido('a0000000-0000-0000-0000-000000000001', null, pg_temp.lk('ffffffff-0000-0000-0000-00000000000f', 'a0000000-0000-0000-0000-000000000001', null), '+5511988880010', 10)::text, true);
select is((select count(*)::int from public.indicacoes_pedido_contato where id = current_setting('t.p10')::uuid), 1, 'o pedido foi preservado apesar da falha');
select is((select count(*)::int from public.relacionamento_falha where pedido_id = current_setting('t.p10')::uuid), 1, 'a falha foi registrada');
select is(pg_temp.motivo(current_setting('t.p10')::uuid), null::text, 'sem decisão enquanto pendente');
alter table public.relacionamento_membro drop constraint falha_simulada;
select is(public.relacionamento_reprocessar_pendentes(10), 1, 'reprocessamento resolve o pedido');
select is(public.relacionamento_reprocessar_pendentes(10), 0, 'e não há mais pendências');
select is((select indicacoes_validas from public.relacionamento_membro where perfil_id = 'a0000000-0000-0000-0000-000000000001' and conta_id = 'ffffffff-0000-0000-0000-00000000000f'), 2, 'F ganhou a indicação reprocessada, sem duplicar');

select * from finish();
rollback;
