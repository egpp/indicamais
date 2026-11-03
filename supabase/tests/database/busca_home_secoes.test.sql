-- pgTAP · módulo busca · seções em carrossel da página inicial · Fase 9
-- IM-095, IM-096, IM-019, IM-029, IM-041, IM-079, IM-080, IM-086, D-018
-- Parâmetros editáveis só pelo administrador geral (motivo + auditoria); leitura pública só de perfis disponíveis e só com dados
-- públicos; rankings contam pessoas distintas, nunca o dono nem conta suspensa; seção abaixo do mínimo não aparece.
begin;
select * from no_plan();
delete from public.catalogo_categoria;

-- A = responsável de P1, P2, P3, P5 e P6; C = responsável de P4 (será suspensa); D = administrador geral; G = conta comum;
-- F1..F6 = pessoas que curtem/indicam (F6 será suspensa).
insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@teste.local'),
  ('cccccccc-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c@teste.local'),
  ('dddddddd-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd@teste.local'),
  ('99999999-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'g@teste.local'),
  ('f0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'f1@teste.local'),
  ('f0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'f2@teste.local'),
  ('f0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'f3@teste.local'),
  ('f0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'f4@teste.local'),
  ('f0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'f5@teste.local'),
  ('f0000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'f6@teste.local');
insert into public.administracao_administrador (conta_id) values ('dddddddd-0000-0000-0000-00000000000d');
insert into public.catalogo_categoria (id, nome, slug, ativa, ordem) values
  ('11111111-0000-0000-0000-000000000001', 'Alimentação', 'alimentacao', true, 1);

-- Perfis 1..6 (loja-1..loja-6). P4 é de C. P5 fica em São Paulo/SP. P6 fica DESPUBLICADO.
insert into public.perfis_perfil (id, responsavel_id, slug)
select ('a0000000-0000-0000-0000-00000000000' || n)::uuid,
       case when n = 4 then 'cccccccc-0000-0000-0000-00000000000c'::uuid else 'aaaaaaaa-0000-0000-0000-00000000000a'::uuid end,
       'loja-' || n
from generate_series(1, 6) n;
insert into public.perfis_perfil_versao (id, perfil_id, nome, descricao_breve, imagem_path, categoria_principal_id, cidade, uf)
select ('a1000000-0000-0000-0000-00000000000' || n)::uuid, ('a0000000-0000-0000-0000-00000000000' || n)::uuid, 'Loja ' || n, 'Doces',
       'perfil/a0000000-0000-0000-0000-00000000000' || n || '/c.jpg', '11111111-0000-0000-0000-000000000001',
       case when n = 5 then 'São Paulo' else 'Porto Alegre' end, case when n = 5 then 'SP' else 'RS' end
from generate_series(1, 6) n;
insert into public.perfis_perfil_versao_contato (versao_id, whatsapp_comercial_e164)
select id, '+55519888800' || right(id::text, 2) from public.perfis_perfil_versao;
update public.perfis_perfil_versao set situacao = 'pendente', enviada_em = now();
update public.perfis_perfil_versao set situacao = 'aprovada';
update public.perfis_perfil set versao_aprovada_id = ('a1000000-0000-0000-0000-00000000000' || right(id::text, 1))::uuid;
update public.perfis_perfil set publicado = true where right(id::text, 1) in ('1', '2', '3', '4', '5');
-- Primeira aprovação de cada perfil: P1 há 10 dias, P2 5, P3 1, P4 4, P5 3, P6 6.
insert into public.perfis_revisao (perfil_id, versao_id, decisao, autor_id, decidida_em)
select ('a0000000-0000-0000-0000-00000000000' || n)::uuid, ('a1000000-0000-0000-0000-00000000000' || n)::uuid, 'aprovada',
       'dddddddd-0000-0000-0000-00000000000d', now() - make_interval(days => d)
from (values (1, 10), (2, 5), (3, 1), (4, 4), (5, 3), (6, 6)) as x (n, d);

-- Base de Relacionamento (montada como superusuário; o cliente nunca escreve ali).
--   P1: curtidas de F1 (30d), F2 (30d), F3 (1d); indicações de F1 (última há 20d) e F4 (2d); o DONO A também curtiu (deve ser ignorado)
--   P2: curtidas de F1, F2 e F6 (F6 será suspensa)        P3: indicações de F5 e F1 (1d)
--   P4: curtidas de F1..F4 (dona suspensa)                P5: curtida de F1                 P6: curtidas de F1 e F2 (despublicado)
insert into public.relacionamento_membro (perfil_id, conta_id, curtida_em, primeira_indicacao_em, ultima_indicacao_em, indicacoes_validas) values
  ('a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', now() - interval '30 days', now() - interval '40 days', now() - interval '20 days', 2),
  ('a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000002', now() - interval '30 days', null, null, 0),
  ('a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000003', now() - interval '1 day', null, null, 0),
  ('a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000004', null, now() - interval '2 days', now() - interval '2 days', 1),
  ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a', now() - interval '1 day', null, null, 0),
  ('a0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000001', now() - interval '1 day', null, null, 0),
  ('a0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000002', now() - interval '1 day', null, null, 0),
  ('a0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000006', now() - interval '1 day', null, null, 0),
  ('a0000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000005', null, now() - interval '1 day', now() - interval '1 day', 1),
  ('a0000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000001', null, now() - interval '1 day', now() - interval '1 day', 1),
  ('a0000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000001', now() - interval '1 day', null, null, 0),
  ('a0000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000002', now() - interval '1 day', null, null, 0),
  ('a0000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000003', now() - interval '1 day', null, null, 0),
  ('a0000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000004', now() - interval '1 day', null, null, 0),
  ('a0000000-0000-0000-0000-000000000005', 'f0000000-0000-0000-0000-000000000001', now() - interval '1 day', null, null, 0),
  ('a0000000-0000-0000-0000-000000000006', 'f0000000-0000-0000-0000-000000000001', now() - interval '1 day', null, null, 0),
  ('a0000000-0000-0000-0000-000000000006', 'f0000000-0000-0000-0000-000000000002', now() - interval '1 day', null, null, 0);
-- Conta suspensa: C (dona de P4) e F6 (curtidora de P2).
insert into public.contas_ciclo_vida (conta_id, situacao, suspensa_em) values
  ('cccccccc-0000-0000-0000-00000000000c', 'suspensa', now()),
  ('f0000000-0000-0000-0000-000000000006', 'suspensa', now());

-- ===== Estrutura e privilégios =====
select is((select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.busca_home_secao'::regclass), true, 'RLS ativada e forçada');
select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'busca_home_secao'), 5, 'política explícita por operação (2 select, insert, update, delete)');
select is((select bool_or(has_table_privilege(r, 'public.busca_home_secao', p))
  from unnest(array['anon', 'authenticated']) r, unnest(array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) p), false, 'nenhum papel de API escreve direto na tabela');
select is(has_column_privilege('anon', 'public.busca_home_secao', 'atualizado_em', 'SELECT'), false, 'anon só lê os campos públicos da configuração');
select is((select array_agg(chave order by ordem) from public.busca_home_secao), array['novidades', 'mais_curtidos', 'mais_indicados', 'na_sua_cidade', 'em_alta_semana'], 'as cinco seções nascem na ordem da D-018');
select is((select array_agg(titulo order by ordem) from public.busca_home_secao), array['Novidades', 'Mais curtidos', 'Mais indicados', 'Na sua cidade', 'Em alta na semana'], 'títulos iniciais');
select is((select count(*)::int from public.busca_home_secao where tipo_item <> 'perfil' or not ativa or minimo_itens <> 4 or limite_padrao <> 10), 0, 'hoje só perfis; ativas; mínimo 4; limite padrão 10');
select is(has_function_privilege('anon', 'public.busca_home_secoes(text,text)', 'EXECUTE')
  and has_function_privilege('anon', 'public.busca_home_secao_perfis(text,text,text,integer)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.busca_home_secoes(text,text)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.busca_home_secao_perfis(text,text,text,integer)', 'EXECUTE'), true, 'anon e authenticated executam as funções públicas da home');
select is(has_function_privilege('anon', 'public.busca_home_candidatos(text,text,text)', 'EXECUTE')
  or has_function_privilege('authenticated', 'public.busca_home_candidatos(text,text,text)', 'EXECUTE'), false, 'a função interna não é executável pela API');
select is(has_function_privilege('anon', 'public.administracao_alterar_home_secao(text,text,boolean,integer,integer,integer,text)', 'EXECUTE'), false, 'anon não edita seções');
select is(has_function_privilege('authenticated', 'public.administracao_alterar_home_secao(text,text,boolean,integer,integer,integer,text)', 'EXECUTE'), true, 'a edição é chamável por logado (a função confere o administrador geral)');

-- ===== Leitura pública, mínimo padrão 4 =====
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select array_agg(o_chave order by o_ordem) from public.busca_home_secoes()), array['novidades', 'mais_curtidos', 'mais_indicados', 'na_sua_cidade', 'em_alta_semana'], 'anon lista as seções ativas em ordem');
select is((select array_agg(o_chave order by o_ordem) from public.busca_home_secoes() where o_exibir), array['novidades', 'em_alta_semana'], 'com mínimo 4 só Novidades (4) e Em alta (4) aparecem; as demais ficam ocultas');
select is((select o_total_itens from public.busca_home_secoes() where o_chave = 'mais_curtidos'), 3, 'Mais curtidos tem 3 candidatos (P4 suspenso, P6 despublicado, dono e F6 suspensa não contam)');
select is((select o_total_itens from public.busca_home_secoes() where o_chave = 'na_sua_cidade'), 0, 'sem cidade e UF, Na sua cidade não tem candidatos');
select is((select o_total_itens from public.busca_home_secoes('Porto Alegre', 'RS') where o_chave = 'na_sua_cidade'), 3, 'com cidade e UF, Na sua cidade tem 3 (P1, P2, P3)');
select is((select count(*)::int from public.busca_home_secao_perfis('mais_curtidos')), 0, 'seção abaixo do mínimo devolve vazio');
select is((select count(*)::int from public.busca_home_secao_perfis('na_sua_cidade', 'Porto Alegre', 'RS')), 0, 'Na sua cidade com 3 e mínimo 4 também fica vazia');
select is((select array_agg(o_slug order by o_posicao) from public.busca_home_secao_perfis('novidades')), array['loja-3', 'loja-5', 'loja-2', 'loja-1'], 'Novidades: primeira aprovação mais recente primeiro; P4 (conta suspensa) e P6 (despublicado) ficam fora');
select is((select count(*)::int from public.busca_home_secao), 5, 'anon lê a configuração das cinco seções ativas');
select throws_ok($$select * from public.relacionamento_membro$$, '42501', null, 'anon não lê a base de relacionamento');
select throws_ok($$select * from public.perfis_revisao$$, '42501', null, 'anon não lê as revisões');
select throws_ok($$select public.administracao_alterar_home_secao('novidades', 'Novidades', true, 1, 4, 10, 'x')$$, '42501', null, 'anon não edita seção');
select throws_ok($$update public.busca_home_secao set titulo = 'Hack'$$, '42501', null, 'anon não atualiza a tabela');
select throws_ok($$delete from public.busca_home_secao$$, '42501', null, 'anon não apaga');
reset role;

-- ===== Edição: só o administrador geral, com motivo, auditada =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"99999999-0000-0000-0000-000000000009","role":"authenticated"}', true);
select throws_ok($$select public.administracao_alterar_home_secao('mais_curtidos', 'Queridinhos', true, 2, 4, 10, 'teste')$$, '42501', null, 'conta comum não edita seção');
select is((select count(*)::int from public.busca_home_secao), 5, 'conta comum lê as seções ativas');
select throws_ok($$update public.busca_home_secao set titulo = 'Hack'$$, '42501', null, 'conta comum não atualiza a tabela direto');

select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select throws_ok($$select public.administracao_alterar_home_secao('mais_curtidos', 'Queridinhos', true, 2, 4, 10, '')$$, '22023', null, 'motivo obrigatório');
select throws_ok($$select public.administracao_alterar_home_secao('mais_curtidos', 'Queridinhos', true, 2, 4, 10, null)$$, '22023', null, 'motivo nulo é recusado');
select throws_ok($$select public.administracao_alterar_home_secao('mais_curtidos', null, true, 2, 4, 10, 'teste')$$, '22023', null, 'campos obrigatórios');
select throws_ok($$select public.administracao_alterar_home_secao('inexistente', 'Queridinhos', true, 2, 4, 10, 'teste')$$, 'P0002', null, 'seção inexistente');
select throws_ok($$select public.administracao_alterar_home_secao('mais_curtidos', 'ab', true, 2, 4, 10, 'teste')$$, '23514', null, 'título curto demais');
select throws_ok($$select public.administracao_alterar_home_secao('mais_curtidos', repeat('a', 41), true, 2, 4, 10, 'teste')$$, '23514', null, 'título longo demais');
select throws_ok($$select public.administracao_alterar_home_secao('mais_curtidos', 'Veja www.promo.com', true, 2, 4, 10, 'teste')$$, '23514', null, 'título não pode ter link');
select throws_ok($$select public.administracao_alterar_home_secao('mais_curtidos', '<b>Oferta</b>', true, 2, 4, 10, 'teste')$$, '23514', null, 'título não pode ter marcação');
select throws_ok($$select public.administracao_alterar_home_secao('mais_curtidos', '***', true, 2, 4, 10, 'teste')$$, '23514', null, 'título só de símbolos é recusado');
select throws_ok($$select public.administracao_alterar_home_secao('mais_curtidos', 'Queridinhos', true, 0, 4, 10, 'teste')$$, '23514', null, 'ordem mínima 1');
select throws_ok($$select public.administracao_alterar_home_secao('mais_curtidos', 'Queridinhos', true, 100, 4, 10, 'teste')$$, '23514', null, 'ordem máxima 99');
select throws_ok($$select public.administracao_alterar_home_secao('mais_curtidos', 'Queridinhos', true, 2, 0, 10, 'teste')$$, '23514', null, 'mínimo de itens entre 1 e 20');
select throws_ok($$select public.administracao_alterar_home_secao('mais_curtidos', 'Queridinhos', true, 2, 4, 31, 'teste')$$, '23514', null, 'limite padrão até 30');
select throws_ok($$select public.administracao_alterar_home_secao('mais_curtidos', 'Queridinhos', true, 2, 6, 5, 'teste')$$, '23514', null, 'limite padrão não pode ser menor que o mínimo');
select is((select count(*)::int from public.administracao_auditoria where alvo_tabela = 'busca_home_secao'), 0, 'nenhuma tentativa recusada grava auditoria');
select lives_ok($$select public.administracao_alterar_home_secao('mais_curtidos', '  Queridinhos   da   cidade ', true, 2, 4, 10, 'renomeado pelo Emerson')$$, 'administrador geral renomeia a seção (espaços normalizados)');
select is((select titulo from public.busca_home_secao where chave = 'mais_curtidos'), 'Queridinhos da cidade', 'título gravado normalizado');
select throws_ok($$update public.busca_home_secao set titulo = 'Hack'$$, '42501', null, 'nem o administrador atualiza a tabela direto');
select is((select count(*)::int from public.administracao_auditoria
  where alvo_tabela = 'busca_home_secao' and alvo_id = 'mais_curtidos' and acao = 'home_secao_alterada' and motivo = 'renomeado pelo Emerson'
    and valor_anterior ->> 'titulo' = 'Mais curtidos' and valor_novo ->> 'titulo' = 'Queridinhos da cidade'
    and autor_id = 'dddddddd-0000-0000-0000-00000000000d'), 1, 'auditoria com autor, motivo, valor anterior e novo');
select lives_ok($$select public.administracao_alterar_home_secao('mais_curtidos', 'Queridinhos da cidade', true, 2, 4, 10, 'repetido')$$, 'repetir a mesma edição é aceito');
select is((select count(*)::int from public.administracao_auditoria where alvo_tabela = 'busca_home_secao'), 1, 'sem mudança real não grava auditoria nova (idempotente)');

-- Desativar: some para o público, continua para o administrador.
select lives_ok($$select public.administracao_alterar_home_secao('em_alta_semana', 'Em alta na semana', false, 5, 4, 10, 'pausada')$$, 'administrador desativa a seção');
select is((select count(*)::int from public.busca_home_secao), 5, 'o administrador ainda lê as cinco (inclusive a inativa)');
select set_config('request.jwt.claims', '{"sub":"99999999-0000-0000-0000-000000000009","role":"authenticated"}', true);
select is((select count(*)::int from public.busca_home_secao), 4, 'conta comum só vê as ativas');
select is((select count(*)::int from public.busca_home_secoes() where o_chave = 'em_alta_semana'), 0, 'seção inativa não é listada');
select is((select count(*)::int from public.busca_home_secao_perfis('em_alta_semana')), 0, 'seção inativa devolve vazio');
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
-- Reativa e baixa o mínimo de todas para 1 (para provar os critérios).
select lives_ok($$select public.administracao_alterar_home_secao('em_alta_semana', 'Em alta na semana', true, 5, 1, 10, 'reativada')$$, 'reativa Em alta com mínimo 1');
select lives_ok($$select public.administracao_alterar_home_secao('novidades', 'Novidades', true, 1, 1, 10, 'mínimo 1')$$, 'mínimo 1 em Novidades');
select lives_ok($$select public.administracao_alterar_home_secao('mais_curtidos', 'Queridinhos da cidade', true, 2, 1, 10, 'mínimo 1')$$, 'mínimo 1 em Mais curtidos');
select lives_ok($$select public.administracao_alterar_home_secao('mais_indicados', 'Mais indicados', true, 3, 1, 10, 'mínimo 1')$$, 'mínimo 1 em Mais indicados');
select lives_ok($$select public.administracao_alterar_home_secao('na_sua_cidade', 'Na sua cidade', true, 4, 1, 10, 'mínimo 1')$$, 'mínimo 1 em Na sua cidade');
reset role;
-- Mudar a ordem muda a ordem pública.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select lives_ok($$select public.administracao_alterar_home_secao('em_alta_semana', 'Em alta na semana', true, 1, 1, 10, 'sobe para o topo')$$, 'administrador muda a ordem');
reset role;
select is((select count(*)::int from public.administracao_auditoria where alvo_tabela = 'busca_home_secao'), 8, 'cada mudança real gerou uma auditoria: renomear, desativar, reativar+mínimo, 3 mínimos e a ordem');
-- Gatilho: nem o superusuário muda a chave nem apaga.
select throws_ok($$update public.busca_home_secao set chave = 'novidades' where chave = 'mais_curtidos'$$, '42501', null, 'a chave é imutável (ou duplicada; o gatilho barra antes)');
select throws_ok($$update public.busca_home_secao set tipo_item = 'perfil', criado_em = now() + interval '1 day' where chave = 'novidades'$$, '42501', null, 'a criação é imutável');
select throws_ok($$delete from public.busca_home_secao where chave = 'novidades'$$, '42501', null, 'seção não é apagada');

-- ===== Critérios (mínimo 1 em todas) =====
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select array_agg(o_chave order by o_ordem, o_chave) from public.busca_home_secoes() where o_exibir), array['em_alta_semana', 'novidades', 'mais_curtidos', 'mais_indicados'], 'Em alta sobe para o topo; Na sua cidade (sem cidade) fica de fora');
select is((select array_agg(o_titulo order by o_ordem, o_chave) from public.busca_home_secoes()), array['Em alta na semana', 'Novidades', 'Queridinhos da cidade', 'Mais indicados', 'Na sua cidade'], 'o título editado chega ao público');
select is((select array_agg(o_slug order by o_posicao) from public.busca_home_secao_perfis('novidades')), array['loja-3', 'loja-5', 'loja-2', 'loja-1'], 'Novidades');
select is((select array_agg(o_slug order by o_posicao) from public.busca_home_secao_perfis('mais_curtidos')), array['loja-1', 'loja-2', 'loja-5'], 'Mais curtidos: pessoas distintas (dono e conta suspensa fora; perfil de conta suspensa e despublicado fora)');
select is((select array_agg(o_metrica order by o_posicao) from public.busca_home_secao_perfis('mais_curtidos')), array[3::bigint, 2, 1], 'contagens: P1 3 (o dono não conta), P2 2 (a suspensa não conta), P5 1');
select is((select array_agg(o_slug order by o_posicao) from public.busca_home_secao_perfis('mais_indicados')), array['loja-3', 'loja-1'], 'Mais indicados: pessoas distintas que indicaram; empate pela novidade');
select is((select array_agg(o_metrica order by o_posicao) from public.busca_home_secao_perfis('mais_indicados')), array[2::bigint, 2], 'P3 e P1 têm 2 indicadores cada');
select is((select array_agg(o_slug order by o_posicao) from public.busca_home_secao_perfis('em_alta_semana')), array['loja-3', 'loja-2', 'loja-1', 'loja-5'], 'Em alta: só atividade dos últimos 7 dias, por pessoas distintas');
select is((select array_agg(o_metrica order by o_posicao) from public.busca_home_secao_perfis('em_alta_semana')), array[2::bigint, 2, 2, 1], 'P1 só conta F3 e F4 (a atividade de F1 e F2 é antiga)');
select is((select count(*)::int from public.busca_home_secao_perfis('novidades') where o_metrica is not null), 0, 'Novidades não expõe contagem');
select is((select array_agg(o_slug order by o_posicao) from public.busca_home_secao_perfis('na_sua_cidade', 'Porto Alegre', 'RS')), array['loja-1', 'loja-3', 'loja-2'], 'Na sua cidade: só Porto Alegre/RS, mais pessoas na base primeiro');
select is((select array_agg(o_slug order by o_posicao) from public.busca_home_secao_perfis('na_sua_cidade', '  PORTO   alegre ', 'rs')), array['loja-1', 'loja-3', 'loja-2'], 'caixa, acento e espaços não importam');
select is((select array_agg(o_slug order by o_posicao) from public.busca_home_secao_perfis('na_sua_cidade', 'sao paulo', 'SP')), array['loja-5'], 'cidade sem acento encontra São Paulo');
select is((select count(*)::int from public.busca_home_secao_perfis('na_sua_cidade', 'Porto Alegre', 'SP')), 0, 'UF diferente não casa');
select is((select count(*)::int from public.busca_home_secao_perfis('na_sua_cidade')), 0, 'sem cidade e UF a seção não aparece');
select is((select count(*)::int from public.busca_home_secao_perfis('na_sua_cidade', 'Porto Alegre', null)), 0, 'sem UF a seção não aparece');
select is((select count(*)::int from public.busca_home_secao_perfis('na_sua_cidade', null, 'RS')), 0, 'sem cidade a seção não aparece');
select throws_ok($$select * from public.busca_home_secao_perfis('na_sua_cidade', 'Porto Alegre', 'X1')$$, '22023', null, 'UF mal formada é recusada');
select throws_ok($$select * from public.busca_home_secao_perfis('mais_visitados')$$, '22023', null, 'critério fora da D-018 (mais visitados) não existe');
select throws_ok($$select * from public.busca_home_secao_perfis(null)$$, '22023', null, 'chave obrigatória');
select is((select count(*)::int from public.busca_home_secao_perfis('novidades', null, null, 2)), 2, 'limite informado');
select is((select count(*)::int from public.busca_home_secao_perfis('novidades', null, null, 0)), 1, 'limite abaixo de 1 vira 1');
select is((select count(*)::int from public.busca_home_secao_perfis('novidades', null, null, 1000)), 4, 'limite acima do máximo é ajustado (30) e limitado pelos candidatos');
-- Só dados públicos do card.
select is((select array_agg(k order by k) from (select jsonb_object_keys(to_jsonb(r)) k from public.busca_home_secao_perfis('mais_curtidos') r limit 12) x),
  array['o_categoria_id', 'o_categoria_nome', 'o_categoria_slug', 'o_cidade', 'o_descricao', 'o_id', 'o_imagem_path', 'o_metrica', 'o_nome', 'o_posicao', 'o_slug', 'o_uf'],
  'campos do card: sem conta, responsável, telefone nem e-mail');
select is((select count(*)::int from (
    select to_jsonb(r)::text t from public.busca_home_secao_perfis('mais_curtidos') r
    union all select to_jsonb(r)::text from public.busca_home_secao_perfis('mais_indicados') r
    union all select to_jsonb(r)::text from public.busca_home_secao_perfis('em_alta_semana') r
    union all select to_jsonb(r)::text from public.busca_home_secao_perfis('novidades') r
    union all select to_jsonb(r)::text from public.busca_home_secao_perfis('na_sua_cidade', 'Porto Alegre', 'RS') r
    union all select to_jsonb(r)::text from public.busca_home_secoes() r) y
  where t ~* '(responsavel|conta_id|whatsapp|@teste|aaaaaaaa|cccccccc|dddddddd|f0000000|5198888)'), 0, 'nenhum id de conta, telefone ou e-mail em nenhuma resposta');
reset role;

-- Autenticado enxerga o mesmo que o público (logado não ganha dado extra).
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select is((select array_agg(o_slug order by o_posicao) from public.busca_home_secao_perfis('mais_curtidos')), array['loja-1', 'loja-2', 'loja-5'], 'logado vê o mesmo ranking');
select throws_ok($$select * from public.relacionamento_membro$$, '42501', null, 'logado também não lê a base de relacionamento');
reset role;

-- ===== Ciclo de vida: reativar a dona devolve o perfil; despublicar tira =====
update public.contas_ciclo_vida set situacao = 'ativa', suspensa_em = null where conta_id = 'cccccccc-0000-0000-0000-00000000000c';
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select array_agg(o_slug order by o_posicao) from public.busca_home_secao_perfis('mais_curtidos')), array['loja-4', 'loja-1', 'loja-2', 'loja-5'], 'conta reativada: P4 (4 curtidas) volta ao ranking');
reset role;
update public.perfis_perfil set publicado = false where id = 'a0000000-0000-0000-0000-000000000004';
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.busca_home_secao_perfis('mais_curtidos') where o_slug = 'loja-4'), 0, 'perfil despublicado sai da seção');
select is((select count(*)::int from public.busca_home_secao_perfis('novidades') where o_slug = 'loja-4'), 0, 'e das Novidades');
reset role;

select * from finish();
rollback;
