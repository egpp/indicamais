-- pgTAP · módulo catalogo · modelo do item: tipo, localização própria, exclusão lógica e histórico do dono
-- IM-105, IM-108, IM-102, IM-078, IM-086, IM-029 (D-040)
-- Prova: excluir ESCONDE de todas as leituras públicas e do painel do dono e preserva pedidos e histórico; dono alheio não
-- despublica, não republica nem exclui; anon não executa; excluir libera a vaga do teto e despublicar não; histórico só de
-- inserção, legível pelo dono e pelo administrador e por mais ninguém; conta suspensa não exclui nem republica.
begin;
select * from no_plan();
delete from public.catalogo_categoria;

insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@teste.local'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@teste.local'),
  ('dddddddd-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd@teste.local'),
  ('eeeeeeee-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's@teste.local'),
  ('ffffffff-0000-0000-0000-00000000000f', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'g@teste.local');
insert into public.administracao_administrador (conta_id) values ('dddddddd-0000-0000-0000-00000000000d');
insert into public.catalogo_categoria (id, nome, slug, ativa, ordem) values
  ('11111111-0000-0000-0000-000000000001', 'Alimentação', 'alimentacao', true, 1);

-- Perfil de A aprovado e publicado (Porto Alegre/RS) e itens montados como superusuário.
insert into public.perfis_perfil (id, responsavel_id, slug) values
  ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a', 'loja-ana');
insert into public.perfis_perfil_versao (id, perfil_id, situacao, enviada_em, nome, descricao_breve, imagem_path, categoria_principal_id, cidade, uf) values
  ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'aprovada', now(), 'Loja da Ana', 'Doces',
   'perfil/a0000000-0000-0000-0000-000000000001/capa.jpg', '11111111-0000-0000-0000-000000000001', 'Porto Alegre', 'RS');
update public.perfis_perfil set versao_aprovada_id = 'a1000000-0000-0000-0000-000000000001', publicado = true
 where id = 'a0000000-0000-0000-0000-000000000001';

-- e1: particular no ar (despublicar/republicar). e2: particular no ar (excluir, com pedido). e3: só rascunho (nunca aprovado).
-- e4: item de perfil no ar. e5: particular no ar com versão pendente (fila). e6: de B no ar. e7: de E (será suspensa).
-- e8: de F no ar (teto). Cada um com versão aprovada completa quando "no ar".
insert into public.catalogo_item (id, conta_id, perfil_id, tipo) values
  ('e0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a', null, 'produto'),
  ('e0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-00000000000a', null, 'produto'),
  ('e0000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-00000000000a', null, 'servico'),
  ('e0000000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000001', 'produto'),
  ('e0000000-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-00000000000a', null, 'produto'),
  ('e0000000-0000-0000-0000-000000000006', 'bbbbbbbb-0000-0000-0000-00000000000b', null, 'produto'),
  ('e0000000-0000-0000-0000-000000000007', 'eeeeeeee-0000-0000-0000-00000000000e', null, 'produto'),
  ('e0000000-0000-0000-0000-000000000008', 'ffffffff-0000-0000-0000-00000000000f', null, 'produto');
insert into public.catalogo_item_versao (id, item_id, situacao, enviada_em, nome, descricao, foto_path, categoria_principal_id, cidade, uf)
select ('e1' || substr(i.id::text, 3))::uuid, i.id, 'aprovada', now(), 'Item ' || right(i.id::text, 1), 'Descrição',
       'item/' || i.id::text || '/f.jpg', '11111111-0000-0000-0000-000000000001',
       case when i.perfil_id is null then 'Porto Alegre' end, case when i.perfil_id is null then 'RS' end
from public.catalogo_item i where right(i.id::text, 1) in ('1', '2', '4', '5', '6', '7', '8');
insert into public.catalogo_item_versao (id, item_id, situacao, nome) values
  ('e1000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000003', 'rascunho', 'Rascunho');
update public.catalogo_item i set versao_aprovada_id = ('e1' || substr(i.id::text, 3))::uuid, publicado = true
 where right(i.id::text, 1) in ('1', '2', '4', '5', '6', '7', '8');
-- e5: edição pendente (entra na fila do administrador enquanto o item existe).
insert into public.catalogo_item_versao (id, item_id, situacao, enviada_em, nome, descricao, foto_path, categoria_principal_id, cidade, uf) values
  ('e1000000-0000-0000-0000-0000000000a5', 'e0000000-0000-0000-0000-000000000005', 'pendente', now(), 'Item 5 editado', 'Nova',
   'item/e0000000-0000-0000-0000-000000000005/g.jpg', '11111111-0000-0000-0000-000000000001', 'Porto Alegre', 'RS');
-- Pedido de contato do e2 (histórico que a exclusão não pode tocar).
insert into public.indicacoes_pedido_contato (item_id, nome, whatsapp_e164, chave_idempotencia)
values ('e0000000-0000-0000-0000-000000000002', 'Visitante Teste', '+5551988887777', 'chave-exclusao-0000001');
-- E: item despublicado e conta suspensa (o fluxo real despublica na suspensão).
update public.catalogo_item set publicado = false where id = 'e0000000-0000-0000-0000-000000000007';
insert into public.contas_ciclo_vida (conta_id, situacao, suspensa_em) values ('eeeeeeee-0000-0000-0000-00000000000e', 'suspensa', now());

create schema t;
grant usage on schema t to anon, authenticated;
create function t.nciclo(p_item uuid, p_acao text) returns integer language sql stable security definer as $$
  select count(*)::int from public.catalogo_item_ciclo where item_id = p_item and acao = p_acao $$;
create function t.pub(p_item uuid) returns boolean language sql stable security definer as $$
  select publicado from public.catalogo_item where id = p_item $$;

-- ===== Estrutura =====
select is((select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.catalogo_item_ciclo'::regclass), true, 'RLS ativa e forçada no histórico');
select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'catalogo_item_ciclo'), 5, 'cinco políticas explícitas (select proprio e admin, insert, update, delete)');
select is((select bool_or(has_table_privilege(r, 'public.catalogo_item_ciclo', p))
  from unnest(array['anon', 'authenticated']) r, unnest(array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) p), false, 'ninguém escreve no histórico pelo cliente');
select is(has_table_privilege('anon', 'public.catalogo_item_ciclo', 'SELECT') or has_column_privilege('anon', 'public.catalogo_item_ciclo', 'id', 'SELECT'), false, 'anon não lê o histórico');
select is(has_column_privilege('authenticated', 'public.catalogo_item_ciclo', 'autor_id', 'SELECT')
  or has_column_privilege('authenticated', 'public.catalogo_item_ciclo', 'conta_id', 'SELECT'), false, 'autor_id e conta_id fora do SELECT do cliente');
select is(has_column_privilege('authenticated', 'public.catalogo_item', 'excluido_por', 'SELECT')
  or has_column_privilege('anon', 'public.catalogo_item', 'excluido_por', 'SELECT')
  or has_column_privilege('anon', 'public.catalogo_item', 'conta_id', 'SELECT'), false, 'excluido_por e conta_id continuam sem SELECT para cliente');
select is((select count(*)::int from unnest(array['catalogo_despublicar_item(uuid,text)', 'catalogo_republicar_item(uuid)', 'catalogo_excluir_item(uuid,text)']) f
  where has_function_privilege('anon', 'public.' || f, 'EXECUTE') or not has_function_privilege('authenticated', 'public.' || f, 'EXECUTE')), 0, 'as 3 funções: authenticated sim, anon não');
select is((select count(*)::int from pg_proc p where p.pronamespace = 'public'::regnamespace
  and p.proname in ('catalogo_despublicar_item', 'catalogo_republicar_item', 'catalogo_excluir_item')
  and p.prosecdef and p.proconfig::text ~ 'search_path'), 3, 'SECURITY DEFINER com search_path vazio');
select is(has_function_privilege('authenticated', 'public.catalogo_item_versao_item_excluido()', 'EXECUTE')
  or has_function_privilege('anon', 'public.catalogo_item_versao_item_excluido()', 'EXECUTE'), false, 'gatilho interno sem EXECUTE para a API');

-- ===== Tipo e localização =====
select throws_ok($$insert into public.catalogo_item (conta_id, tipo) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'procura')$$, '23514', null, 'tipo procura existe mas está bloqueado até o IM-109');
select throws_ok($$insert into public.catalogo_item (conta_id, tipo) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'oferta')$$, '23514', null, 'oferta é o valor produto nesta base (não existe outro nome)');
select throws_ok($$insert into public.catalogo_item (conta_id, tipo, cidade, uf) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'produto', 'Recife', null)$$, '23514', null, 'cidade sem UF é recusada');
select throws_ok($$insert into public.catalogo_item (conta_id, tipo, cidade, uf) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'produto', 'Recife', 'XX')$$, '23514', null, 'UF inexistente é recusada');
select throws_ok($$insert into public.catalogo_item (conta_id, tipo, cidade, uf) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'produto', 'R', 'PE')$$, '23514', null, 'cidade de 1 caractere é recusada');
select throws_ok($$update public.catalogo_item set publicado = true, excluido_em = now(), excluido_por = 'aaaaaaaa-0000-0000-0000-00000000000a' where id = 'e0000000-0000-0000-0000-000000000001'$$, '23514', null, 'invariante: item excluído não fica publicado');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok($$select public.catalogo_criar_item('procura', null, p_nome => 'Procuro bike', p_cidade => 'Recife', p_uf => 'PE')$$, '23514', null, 'o dono não cria item do tipo procura ainda');
select throws_ok($$select public.catalogo_criar_item('produto', null, p_nome => 'Sem local')$$, '23514', null, 'item novo exige cidade e UF');
select throws_ok($$select public.catalogo_criar_item('produto', null, p_nome => 'Meia local', p_cidade => 'Recife')$$, '23514', null, 'só a cidade não basta');
select lives_ok($$select public.catalogo_criar_item('produto', null, p_nome => 'Com local', p_cidade => '  Recife ', p_uf => 'pe')$$, 'item novo com cidade e UF');
select is((select cidade || '/' || uf from public.catalogo_meus_itens where cidade = 'Recife'), 'Recife/PE', 'localização própria gravada aparada e em maiúsculas');
select lives_ok($$select public.catalogo_criar_item('servico', 'a0000000-0000-0000-0000-000000000001', p_nome => 'Serviço da loja')$$, 'item de perfil sem localização informada');
select is((select cidade || '/' || uf from public.catalogo_meus_itens where perfil_id is not null and cidade <> 'Recife' and id <> 'e0000000-0000-0000-0000-000000000004'), 'Porto Alegre/RS', 'herda a cidade e a UF do site como padrão');
select throws_ok($$update public.catalogo_item set cidade = 'Outra', uf = 'SP' where id = 'e0000000-0000-0000-0000-000000000001'$$, '42501', null, 'o dono não edita a localização direto (sem GRANT)');
select throws_ok($$update public.catalogo_item set excluido_em = now() where id = 'e0000000-0000-0000-0000-000000000001'$$, '42501', null, 'o dono não marca exclusão por UPDATE direto');
reset role;

-- ===== Estado antes: tudo o que a exclusão não pode tocar =====
select is((select count(*)::int from public.catalogo_item_publico where id = 'e0000000-0000-0000-0000-000000000002'), 1, 'antes: e2 está na visão pública');
select is((select count(*)::int from public.busca_publica('Item 2')), 1, 'antes: e2 está na busca');
select is(public.catalogo_imagem_publica('item/e0000000-0000-0000-0000-000000000002/f.jpg'), true, 'antes: a foto do e2 é pública');

-- ===== Anônimo =====
set local role anon;
select throws_ok($$select public.catalogo_excluir_item('e0000000-0000-0000-0000-000000000001')$$, '42501', null, 'anon não exclui');
select throws_ok($$select public.catalogo_despublicar_item('e0000000-0000-0000-0000-000000000001')$$, '42501', null, 'anon não despublica');
select throws_ok($$select public.catalogo_republicar_item('e0000000-0000-0000-0000-000000000001')$$, '42501', null, 'anon não republica');
reset role;

-- ===== Dono alheio (B) =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select throws_ok($$select public.catalogo_excluir_item('e0000000-0000-0000-0000-000000000002')$$, 'P0002', 'item não encontrado', 'B não exclui item de A (mesma resposta de inexistente)');
select throws_ok($$select public.catalogo_despublicar_item('e0000000-0000-0000-0000-000000000001')$$, 'P0002', 'item não encontrado', 'B não despublica item de A');
select throws_ok($$select public.catalogo_republicar_item('e0000000-0000-0000-0000-000000000001')$$, 'P0002', 'item não encontrado', 'B não republica item de A');
select throws_ok($$select public.catalogo_excluir_item('e0000000-0000-0000-0000-0000000000ff')$$, 'P0002', 'item não encontrado', 'item inexistente: mesma resposta');
select is((select count(*)::int from public.catalogo_item_ciclo), 0, 'B não lê histórico algum');
select throws_ok($$insert into public.catalogo_item_ciclo (item_id, conta_id, acao, autor_id, valor_anterior) values ('e0000000-0000-0000-0000-000000000006', 'bbbbbbbb-0000-0000-0000-00000000000b', 'excluir', 'bbbbbbbb-0000-0000-0000-00000000000b', '{}')$$, '42501', null, 'B não escreve histórico direto');
reset role;
select is(t.pub('e0000000-0000-0000-0000-000000000001'), true, 'o item de A seguiu no ar depois das tentativas de B');
select is(t.pub('e0000000-0000-0000-0000-000000000002'), true, 'e2 também');
select is((select excluido_em from public.catalogo_item where id = 'e0000000-0000-0000-0000-000000000002'), null, 'e2 não foi excluído por B');

-- ===== Despublicar e republicar (A) =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$select public.catalogo_despublicar_item('e0000000-0000-0000-0000-000000000001', 'pausa')$$, 'A despublica e1');
select lives_ok($$select public.catalogo_despublicar_item('e0000000-0000-0000-0000-000000000001', 'pausa')$$, 'repetir não falha');
reset role;
select is(t.pub('e0000000-0000-0000-0000-000000000001'), false, 'e1 despublicado');
select is(t.nciclo('e0000000-0000-0000-0000-000000000001', 'despublicar'), 1, 'um só evento (idempotente)');
select is((select valor_anterior ->> 'publicado' from public.catalogo_item_ciclo where item_id = 'e0000000-0000-0000-0000-000000000001' and acao = 'despublicar'), 'true', 'valor anterior gravado');
select is((select motivo from public.catalogo_item_ciclo where item_id = 'e0000000-0000-0000-0000-000000000001' and acao = 'despublicar'), 'pausa', 'motivo gravado');
select is((select autor_id from public.catalogo_item_ciclo where item_id = 'e0000000-0000-0000-0000-000000000001' and acao = 'despublicar'), 'aaaaaaaa-0000-0000-0000-00000000000a'::uuid, 'autor gravado');
select is((select count(*)::int from public.catalogo_item_publico where id = 'e0000000-0000-0000-0000-000000000001'), 0, 'despublicado sai da visão pública');
select is((select count(*)::int from public.catalogo_item where id = 'e0000000-0000-0000-0000-000000000001' and not excluido_em is null), 0, 'despublicar não exclui');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is((select count(*)::int from public.catalogo_meus_itens where id = 'e0000000-0000-0000-0000-000000000001'), 1, 'despublicado continua no painel do dono');
select lives_ok($$select public.catalogo_republicar_item('e0000000-0000-0000-0000-000000000001')$$, 'A republica e1');
select lives_ok($$select public.catalogo_republicar_item('e0000000-0000-0000-0000-000000000001')$$, 'repetir não falha');
select throws_ok($$select public.catalogo_republicar_item('e0000000-0000-0000-0000-000000000003')$$, 'P0001', 'item sem versão aprovada', 'sem aprovação não há o que republicar (moderação não é contornada)');
reset role;
select is(t.pub('e0000000-0000-0000-0000-000000000001'), true, 'e1 de volta ao ar');
select is(t.nciclo('e0000000-0000-0000-0000-000000000001', 'republicar'), 1, 'um só evento de republicar');
select is((select count(*)::int from public.catalogo_item_publico where id = 'e0000000-0000-0000-0000-000000000001'), 1, 'e1 volta à visão pública');

-- ===== Excluir (A): esconde de tudo e preserva o resto =====
select is((select count(*)::int from public.indicacoes_pedido_contato where item_id = 'e0000000-0000-0000-0000-000000000002'), 1, 'antes: 1 pedido do e2');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$select public.catalogo_excluir_item('e0000000-0000-0000-0000-000000000002', 'vendi')$$, 'A exclui e2');
select lives_ok($$select public.catalogo_excluir_item('e0000000-0000-0000-0000-000000000002', 'outra vez')$$, 'excluir duas vezes não falha');
select is((select count(*)::int from public.catalogo_meus_itens where id = 'e0000000-0000-0000-0000-000000000002'), 0, 'some do painel do dono');
select is((select count(*)::int from public.catalogo_item where id = 'e0000000-0000-0000-0000-000000000002'), 0, 'o dono não lê o item excluído nem na tabela');
select is((select count(*)::int from public.catalogo_item_versao where item_id = 'e0000000-0000-0000-0000-000000000002'), 0, 'nem as versões dele');
select is((select count(*)::int from public.administracao_meus_resultados where alvo_id = 'e0000000-0000-0000-0000-000000000002'), 0, 'nem os resultados de revisão');
select throws_ok($$select public.catalogo_republicar_item('e0000000-0000-0000-0000-000000000002')$$, 'P0002', 'item não encontrado', 'excluído não republica');
select throws_ok($$select public.catalogo_despublicar_item('e0000000-0000-0000-0000-000000000002')$$, 'P0002', 'item não encontrado', 'excluído não despublica');
select is((select count(*)::int from public.catalogo_item_ciclo where item_id = 'e0000000-0000-0000-0000-000000000002'), 1, 'o dono lê o histórico do item excluído (1 evento)');
select is((select acao from public.catalogo_item_ciclo where item_id = 'e0000000-0000-0000-0000-000000000002'), 'excluir', 'o evento é excluir');
select throws_ok($$select autor_id from public.catalogo_item_ciclo$$, '42501', null, 'o cliente não lê autor_id');
select throws_ok($$update public.catalogo_item_ciclo set motivo = 'x'$$, '42501', null, 'histórico não se altera pelo cliente');
select throws_ok($$delete from public.catalogo_item_ciclo$$, '42501', null, 'histórico não se apaga pelo cliente');
reset role;
select is(t.pub('e0000000-0000-0000-0000-000000000002'), false, 'e2 despublicado pela exclusão');
select is((select excluido_motivo from public.catalogo_item where id = 'e0000000-0000-0000-0000-000000000002'), 'vendi', 'motivo da exclusão guardado');
select is((select excluido_por from public.catalogo_item where id = 'e0000000-0000-0000-0000-000000000002'), 'aaaaaaaa-0000-0000-0000-00000000000a'::uuid, 'autor da exclusão guardado');
select is(t.nciclo('e0000000-0000-0000-0000-000000000002', 'excluir'), 1, 'excluir duas vezes grava um evento só');
select is((select valor_anterior ->> 'publicado' from public.catalogo_item_ciclo where item_id = 'e0000000-0000-0000-0000-000000000002'), 'true', 'valor anterior: estava publicado');
select is((select count(*)::int from public.indicacoes_pedido_contato where item_id = 'e0000000-0000-0000-0000-000000000002'), 1, 'o pedido de contato foi preservado');
select is((select count(*)::int from public.catalogo_item_versao where item_id = 'e0000000-0000-0000-0000-000000000002'), 1, 'a versão foi preservada');
select throws_ok($$delete from public.catalogo_item where id = 'e0000000-0000-0000-0000-000000000002'$$, '23503', null, 'nunca apaga linha com vínculo (FK RESTRICT)');
select throws_ok($$update public.catalogo_item set excluido_em = null, excluido_por = null where id = 'e0000000-0000-0000-0000-000000000002'$$, '42501', null, 'a exclusão não se desfaz');
select throws_ok($$update public.catalogo_item set publicado = true where id = 'e0000000-0000-0000-0000-000000000002'$$, '23514', null, 'excluído nunca volta a ser publicado');
select throws_ok($$insert into public.catalogo_item_versao (item_id, nome) values ('e0000000-0000-0000-0000-000000000002', 'Nova')$$, 'P0002', 'item excluído', 'item excluído não recebe versão nova');
select throws_ok($$update public.catalogo_item_ciclo set motivo = 'x'$$, '42501', null, 'histórico é só de inserção (nem o superusuário altera)');
select throws_ok($$delete from public.catalogo_item_ciclo$$, '42501', null, 'histórico não se apaga');
select throws_ok($$insert into public.catalogo_item_ciclo (item_id, conta_id, acao, autor_id, valor_anterior) values ('e0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-00000000000a', 'excluir', 'aaaaaaaa-0000-0000-0000-00000000000a', '{}')$$, '23505', null, 'um único evento de exclusão por item (restrição única)');

-- Leituras públicas: tudo escondido
select is((select count(*)::int from public.catalogo_item_publico where id = 'e0000000-0000-0000-0000-000000000002'), 0, 'fora da visão pública');
select is((select count(*)::int from public.busca_publica('Item 2')), 0, 'fora da busca');
select is(public.catalogo_imagem_publica('item/e0000000-0000-0000-0000-000000000002/f.jpg'), false, 'foto deixa de ser pública');
set local role anon;
select is((select count(*)::int from public.catalogo_item where id = 'e0000000-0000-0000-0000-000000000002'), 0, 'anon não lê o item excluído na tabela');
select is((select count(*)::int from public.catalogo_item_versao where item_id = 'e0000000-0000-0000-0000-000000000002'), 0, 'anon não lê a versão do item excluído');
select is((select count(*)::int from public.catalogo_item_publico where id = 'e0000000-0000-0000-0000-000000000002'), 0, 'anon: fora da visão pública');
select is((select count(*)::int from public.busca_publica('Item 2')), 0, 'anon: fora da busca');
reset role;

-- Fila do administrador: item excluído com edição pendente sai da fila
select is((select count(*)::int from public.catalogo_item where id = 'e0000000-0000-0000-0000-000000000005' and excluido_em is null), 1, 'e5 existe com edição pendente');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select is((select count(*)::int from public.administracao_fila_pendencias where alvo_id = 'e0000000-0000-0000-0000-000000000005'), 1, 'antes: a edição de e5 está na fila');
select is((select count(*)::int from public.catalogo_item_ciclo), 3, 'o administrador lê o histórico de todos (3 eventos até aqui)');
select is((select count(*)::int from public.catalogo_item where id = 'e0000000-0000-0000-0000-000000000002'), 1, 'o administrador ainda enxerga o item excluído');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$select public.catalogo_excluir_item('e0000000-0000-0000-0000-000000000005')$$, 'A exclui e5');
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select is((select count(*)::int from public.administracao_fila_pendencias where alvo_id = 'e0000000-0000-0000-0000-000000000005'), 0, 'depois: sai da fila de revisão');
reset role;

-- ===== Conta suspensa não exclui nem republica =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-0000-0000-00000000000e","role":"authenticated"}', true);
select throws_ok($$select public.catalogo_excluir_item('e0000000-0000-0000-0000-000000000007')$$, '42501', null, 'conta suspensa não exclui');
select throws_ok($$select public.catalogo_republicar_item('e0000000-0000-0000-0000-000000000007')$$, '42501', null, 'conta suspensa não republica');
reset role;
select is((select excluido_em from public.catalogo_item where id = 'e0000000-0000-0000-0000-000000000007'), null, 'nada foi excluído');

-- ===== Teto: excluir libera a vaga; despublicar não =====
update public.contas_parametro set valor = 1 where chave = 'tetos_anuncios_particulares';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"ffffffff-0000-0000-0000-00000000000f","role":"authenticated"}', true);
select throws_ok($$select public.catalogo_criar_item('produto', null, p_nome => 'Segundo', p_cidade => 'Recife', p_uf => 'PE')$$, 'P0430', 'teto_atingido:tetos_anuncios_particulares', 'F está no teto (1 item)');
select lives_ok($$select public.catalogo_despublicar_item('e0000000-0000-0000-0000-000000000008')$$, 'F despublica o único item');
select throws_ok($$select public.catalogo_criar_item('produto', null, p_nome => 'Segundo', p_cidade => 'Recife', p_uf => 'PE')$$, 'P0430', 'teto_atingido:tetos_anuncios_particulares', 'despublicar NÃO libera a vaga');
select lives_ok($$select public.catalogo_excluir_item('e0000000-0000-0000-0000-000000000008')$$, 'F exclui o item');
select lives_ok($$select public.catalogo_criar_item('produto', null, p_nome => 'Segundo', p_cidade => 'Recife', p_uf => 'PE')$$, 'excluir LIBERA a vaga: o novo item passa');
select throws_ok($$select public.catalogo_criar_item('produto', null, p_nome => 'Terceiro', p_cidade => 'Recife', p_uf => 'PE')$$, 'P0430', 'teto_atingido:tetos_anuncios_particulares', 'e o teto volta a valer');
reset role;

select * from finish();
rollback;
