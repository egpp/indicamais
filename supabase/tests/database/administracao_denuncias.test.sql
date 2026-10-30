-- pgTAP · denúncias · Fase 6 · IM-076, IM-077, IM-086, IM-029, D-014
-- Qualquer pessoa denuncia (anônima ou logada); antispam (limite por pessoa, campo-armadilha, deduplicação, sem enumeração);
-- o denunciante nunca é exposto ao denunciado nem a quem não tem analisar_denuncias; decidir exige permissão, motivo e
-- auditoria; procedente não executa nada sozinha.
begin;
select * from no_plan();
delete from public.catalogo_categoria;

-- A = denunciado (dono do perfil p1 e do item i1); B = denunciante logado; C = analista de denúncias; D = administrador geral;
-- G = usuário comum; H = analista que também é dono de um perfil (conflito de interesse).
insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@teste.local'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@teste.local'),
  ('cccccccc-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c@teste.local'),
  ('dddddddd-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd@teste.local'),
  ('99999999-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'g@teste.local'),
  ('44444444-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'h@teste.local');
insert into public.administracao_administrador (conta_id) values ('dddddddd-0000-0000-0000-00000000000d');
insert into public.administracao_permissao (conta_id, permissao, concedida_por, motivo) values
  ('cccccccc-0000-0000-0000-00000000000c', 'analisar_denuncias', 'dddddddd-0000-0000-0000-00000000000d', 'teste'),
  ('44444444-0000-0000-0000-000000000004', 'analisar_denuncias', 'dddddddd-0000-0000-0000-00000000000d', 'teste');
insert into public.perfis_perfil (id, responsavel_id, slug) values
  ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a', 'loja-um'),
  ('a0000000-0000-0000-0000-000000000004', '44444444-0000-0000-0000-000000000004', 'loja-do-analista');
insert into public.catalogo_item (id, conta_id, perfil_id, tipo) values
  ('e0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a', null, 'produto');

-- ===== Estrutura =====
select is((select bool_and(relrowsecurity and relforcerowsecurity) from pg_class where oid = any(array[
  'public.administracao_parametro'::regclass, 'public.administracao_denuncia'::regclass,
  'public.administracao_denuncia_decisao'::regclass, 'public.administracao_denuncia_tentativa'::regclass])), true, 'RLS ativa e forçada nas quatro tabelas');
select is((select count(*)::int from pg_policies where schemaname = 'public'
  and tablename in ('administracao_parametro', 'administracao_denuncia', 'administracao_denuncia_decisao', 'administracao_denuncia_tentativa')), 16,
  'quatro políticas por tabela');
select is((select bool_or(has_table_privilege(r, t, p))
  from unnest(array['anon', 'authenticated']) r,
  unnest(array['public.administracao_parametro', 'public.administracao_denuncia', 'public.administracao_denuncia_decisao', 'public.administracao_denuncia_tentativa']) t,
  unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) p), false, 'nenhum privilégio direto nas tabelas de denúncia');
select columns_are('public', 'administracao_fila_denuncias',
  array['id', 'alvo_tipo', 'alvo_id', 'tipo', 'texto', 'situacao', 'denunciante_tipo', 'denunciante_ref', 'total_no_alvo', 'alvo_nome', 'criado_em', 'atualizado_em'],
  'a fila não traz id de conta do denunciante');
select columns_are('public', 'administracao_denuncia_decisoes', array['denuncia_id', 'de_situacao', 'para_situacao', 'motivo', 'autor_ref', 'criado_em'], 'decisões com autor opaco');
select is(has_function_privilege('anon', 'public.administracao_denunciar(text,uuid,text,text,text,text)', 'EXECUTE'), true, 'anon pode denunciar');
select is(has_function_privilege('authenticated', 'public.administracao_denunciar(text,uuid,text,text,text,text)', 'EXECUTE'), true, 'authenticated pode denunciar');
select is(has_function_privilege('anon', 'public.administracao_decidir_denuncia(uuid,text,text)', 'EXECUTE')
  or has_function_privilege('anon', 'public.administracao_definir_parametro(text,integer,text)', 'EXECUTE'), false, 'anon não decide nem altera parâmetros');
select is((select count(*)::int from public.administracao_parametro), 4, 'quatro parâmetros antispam');

-- ===== Denúncia anônima =====
set local role anon;
select lives_ok($$select public.administracao_denunciar('perfil', 'a0000000-0000-0000-0000-000000000001', 'spam_fraude', 'Perfil falso', repeat('a', 64))$$, 'anônimo denuncia o perfil');
select lives_ok($$select public.administracao_denunciar('perfil', 'a0000000-0000-0000-0000-000000000001', 'spam_fraude', 'Perfil falso', repeat('a', 64), 'http://spam.example')$$, 'campo-armadilha preenchido: responde como aceita');
select lives_ok($$select public.administracao_denunciar('perfil', 'a0000000-0000-0000-0000-000000000001', 'conteudo_inadequado', 'de novo', repeat('a', 64))$$, 'denúncia repetida do mesmo denunciante é aceita em silêncio');
select lives_ok($$select public.administracao_denunciar('perfil', gen_random_uuid(), 'spam_fraude', null, repeat('a', 64))$$, 'alvo inexistente responde igual (sem enumeração)');
select throws_ok($$select public.administracao_denunciar('perfil', 'a0000000-0000-0000-0000-000000000001', 'tipo_invalido', null, repeat('a', 64))$$, '22023', null, 'tipo inválido');
select throws_ok($$select public.administracao_denunciar('lugar', 'a0000000-0000-0000-0000-000000000001', 'spam_fraude', null, repeat('a', 64))$$, '22023', null, 'alvo inválido');
select throws_ok($$select public.administracao_denunciar('perfil', 'a0000000-0000-0000-0000-000000000001', 'spam_fraude', repeat('x', 501), repeat('a', 64))$$, '22023', null, 'texto acima de 500 caracteres');
select throws_ok($$select public.administracao_denunciar('perfil', 'a0000000-0000-0000-0000-000000000001', 'spam_fraude', null, 'origem-nao-hash')$$, '22023', null, 'origem fora do formato');
select throws_ok($$select * from public.administracao_denuncia$$, '42501', null, 'anônimo não lê denúncias');
reset role;
select is((select count(*)::int from public.administracao_denuncia), 1, 'só uma denúncia gravada: armadilha, repetição e alvo inexistente não gravam');
select is((select denunciante_id from public.administracao_denuncia), null, 'denúncia anônima sem conta');
select is((select count(*)::int from public.administracao_denuncia_tentativa), 3, 'tentativas válidas registradas (inclusive a do alvo inexistente)');

-- ===== Limite por pessoa (P0429) =====
set local role anon;
select lives_ok($$select public.administracao_denunciar('perfil', gen_random_uuid(), 'spam_fraude', null, repeat('b', 64))$$, 'tentativa 1 da origem B');
select lives_ok($$select public.administracao_denunciar('perfil', gen_random_uuid(), 'spam_fraude', null, repeat('b', 64))$$, 'tentativa 2');
select lives_ok($$select public.administracao_denunciar('item', gen_random_uuid(), 'spam_fraude', null, repeat('b', 64))$$, 'tentativa 3');
select lives_ok($$select public.administracao_denunciar('conta', gen_random_uuid(), 'spam_fraude', null, repeat('b', 64))$$, 'tentativa 4');
select lives_ok($$select public.administracao_denunciar('pedido', gen_random_uuid(), 'spam_fraude', null, repeat('b', 64))$$, 'tentativa 5');
select throws_ok($$select public.administracao_denunciar('perfil', gen_random_uuid(), 'spam_fraude', null, repeat('b', 64))$$, 'P0429', null, 'a sexta tentativa na janela é recusada (mesmo contra alvo inexistente)');
select lives_ok($$select public.administracao_denunciar('perfil', 'a0000000-0000-0000-0000-000000000001', 'spam_fraude', null, repeat('c', 64))$$, 'outra origem não é afetada pelo limite da primeira');
reset role;

-- ===== Denunciante logado =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select lives_ok($$select public.administracao_denunciar('item', 'e0000000-0000-0000-0000-000000000001', 'conteudo_inadequado', 'Foto imprópria')$$, 'B denuncia o item');
select lives_ok($$select public.administracao_denunciar('perfil', 'a0000000-0000-0000-0000-000000000001', 'uso_indevido_dados')$$, 'B denuncia o perfil (sem texto)');
select lives_ok($$select public.administracao_denunciar('perfil', 'a0000000-0000-0000-0000-000000000004', 'autoindicacao')$$, 'B denuncia o perfil do analista H');
select is((select count(*)::int from public.administracao_fila_denuncias), 0, 'o denunciante não lê a fila');
select throws_ok($$select * from public.administracao_denuncia$$, '42501', null, 'o denunciante não lê a tabela');
reset role;
select is((select count(*)::int from public.administracao_denuncia where denunciante_id = 'bbbbbbbb-0000-0000-0000-00000000000b'), 3, 'denúncias de B ligadas à conta (visível só ao banco)');

-- ===== Denunciado e usuário comum não veem nada =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is((select count(*)::int from public.administracao_fila_denuncias), 0, 'o denunciado não vê quem o denunciou');
select is((select count(*)::int from public.administracao_denuncia_decisoes), 0, 'o denunciado não vê decisões');
select throws_ok($$select * from public.administracao_denuncia$$, '42501', null, 'o denunciado não lê a tabela');
select set_config('request.jwt.claims', '{"sub":"99999999-0000-0000-0000-000000000009","role":"authenticated"}', true);
select is((select count(*)::int from public.administracao_fila_denuncias), 0, 'usuário comum não vê a fila');
select throws_ok($$select public.administracao_decidir_denuncia(gen_random_uuid(), 'procedente', 'x')$$, '42501', null, 'usuário comum não decide');
reset role;

-- ===== Analista C =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is((select count(*)::int from public.administracao_fila_denuncias), 5, 'C vê as cinco denúncias gravadas');
select is((select array_agg(distinct denunciante_tipo order by denunciante_tipo) from public.administracao_fila_denuncias), array['anonimo', 'conta'], 'só o tipo do denunciante, nunca a conta');
select is((select count(*)::int from public.administracao_fila_denuncias where denunciante_ref !~ '^[0-9a-f]{64}$'), 0, 'referência do denunciante é um hash opaco');
select is((select total_no_alvo from public.administracao_fila_denuncias where alvo_tipo = 'perfil' and alvo_id = 'a0000000-0000-0000-0000-000000000001' limit 1), 3, 'contagem de denúncias do mesmo alvo (duas anônimas e uma de B)');
select throws_ok($$select public.administracao_decidir_denuncia((select id from public.administracao_fila_denuncias limit 1), 'procedente', '')$$, '22023', null, 'decidir exige motivo');
select throws_ok($$select public.administracao_decidir_denuncia((select id from public.administracao_fila_denuncias limit 1), 'talvez', 'x')$$, '22023', null, 'decisão fora da lista');
select throws_ok($$select public.administracao_decidir_denuncia(gen_random_uuid(), 'procedente', 'x')$$, 'P0002', null, 'denúncia inexistente');
select set_config('t.d_perfil', (select id::text from public.administracao_fila_denuncias where alvo_tipo = 'perfil' and alvo_id = 'a0000000-0000-0000-0000-000000000001' and denunciante_tipo = 'anonimo' limit 1), true);
select lives_ok($$select public.administracao_decidir_denuncia(current_setting('t.d_perfil')::uuid, 'em_analise', 'Assumi a análise')$$, 'C assume a análise');
select throws_ok($$select public.administracao_decidir_denuncia(current_setting('t.d_perfil')::uuid, 'em_analise', 'de novo')$$, 'P0001', null, 'já está em análise');
select lives_ok($$select public.administracao_decidir_denuncia(current_setting('t.d_perfil')::uuid, 'procedente', 'Perfil confirmado como falso')$$, 'C decide procedente');
select throws_ok($$select public.administracao_decidir_denuncia(current_setting('t.d_perfil')::uuid, 'improcedente', 'mudei de ideia')$$, 'P0001', null, 'denúncia decidida não muda');
select is((select situacao from public.administracao_fila_denuncias where id = current_setting('t.d_perfil')::uuid), 'procedente', 'situação procedente');
select is((select count(*)::int from public.administracao_denuncia_decisoes where denuncia_id = current_setting('t.d_perfil')::uuid), 2, 'histórico com as duas decisões');
select lives_ok($$select public.administracao_decidir_denuncia((select id from public.administracao_fila_denuncias where alvo_tipo = 'item' limit 1), 'improcedente', 'Foto regular')$$, 'C decide improcedente');
select throws_ok($$select public.administracao_definir_parametro('denuncia_limite_por_pessoa', 9, 'x')$$, '42501', null, 'C não altera parâmetros (só administrador geral)');
reset role;
select is((select count(*)::int from public.administracao_auditoria where acao = 'decidir_denuncia' and autor_id = 'cccccccc-0000-0000-0000-00000000000c'), 3, 'cada decisão foi auditada com autor');
select is((select count(*)::int from public.administracao_auditoria where acao = 'decidir_denuncia' and motivo = 'Perfil confirmado como falso'
  and valor_anterior ->> 'situacao' = 'em_analise' and valor_novo ->> 'situacao' = 'procedente'), 1, 'auditoria guarda situação anterior, nova e motivo');

-- ===== Procedente não executa nada sozinha (IM-076) =====
select is((select count(*)::int from public.contas_ciclo_vida), 0, 'nenhuma conta foi suspensa ou alterada');
select is((select count(*)::int from public.administracao_auditoria where acao in ('suspender_conta', 'reativar_conta')), 0, 'nenhuma suspensão auditada');
select is((select count(*)::int from public.perfis_perfil where id = 'a0000000-0000-0000-0000-000000000001' and publicado = false), 1, 'o perfil denunciado segue como estava');

-- ===== Conflito de interesse: H decide denúncia sobre o próprio perfil =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"44444444-0000-0000-0000-000000000004","role":"authenticated"}', true);
select throws_ok($$select public.administracao_decidir_denuncia((select id from public.administracao_fila_denuncias where alvo_id = 'a0000000-0000-0000-0000-000000000004'), 'improcedente', 'Sou eu')$$, '42501', null, 'ninguém decide denúncia sobre o próprio conteúdo');
reset role;

-- ===== Administrador geral =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select is((select count(*)::int from public.administracao_fila_denuncias), 5, 'administrador geral vê a fila');
select lives_ok($$select public.administracao_decidir_denuncia((select id from public.administracao_fila_denuncias where alvo_id = 'a0000000-0000-0000-0000-000000000004'), 'improcedente', 'Sem fundamento')$$, 'administrador geral decide');
select lives_ok($$select public.administracao_definir_parametro('denuncia_limite_por_pessoa', 7, 'Ajuste de teste')$$, 'administrador geral altera o limite');
select throws_ok($$select public.administracao_definir_parametro('denuncia_limite_por_pessoa', 0, 'fora da faixa')$$, '22023', null, 'valor fora da faixa');
select throws_ok($$select public.administracao_definir_parametro('inexistente', 1, 'x')$$, 'P0002', null, 'parâmetro inexistente');
reset role;
select is((select valor from public.administracao_parametro where chave = 'denuncia_limite_por_pessoa'), 7, 'limite alterado');
select is((select count(*)::int from public.administracao_auditoria where acao = 'definir_parametro_administracao'
  and (valor_anterior ->> 'valor')::int = 5 and (valor_novo ->> 'valor')::int = 7), 1, 'alteração de parâmetro auditada com valor anterior');

-- ===== Histórico imutável (vale para qualquer papel) =====
select throws_ok($$delete from public.administracao_denuncia$$, '42501', null, 'denúncia não é apagada');
select throws_ok($$update public.administracao_denuncia set texto = 'adulterado'$$, '42501', null, 'dados da denúncia não mudam');
select throws_ok($$update public.administracao_denuncia_decisao set motivo = 'x'$$, '42501', null, 'decisão não muda');
select throws_ok($$delete from public.administracao_denuncia_decisao$$, '42501', null, 'decisão não é apagada');

select * from finish();
rollback;
