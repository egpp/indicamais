-- pgTAP · módulo catalogo · item de site sem cidade/UF no site + versão pendente de item excluído
-- IM-105, IM-108, IM-102, IM-078, IM-086 (D-040)
-- Prova: (1) item de site nasce sem cidade/UF no RASCUNHO quando o site ainda não tem; o ENVIO falha com P0001
-- 'localizacao_obrigatoria' e passa depois que o site ganha cidade/UF (o item herda); particular e imóvel seguem
-- obrigatórios na criação. (2) Excluir rejeita a versão pendente (motivo 'item excluído', revisão e auditoria), tira da fila
-- do administrador e não deixa pendente para sempre; repetir não duplica.
begin;
select * from no_plan();
delete from public.catalogo_categoria;

insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@teste.local'),
  ('dddddddd-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd@teste.local');
insert into public.administracao_administrador (conta_id) values ('dddddddd-0000-0000-0000-00000000000d');
insert into public.catalogo_categoria (id, nome, slug, ativa, ordem) values
  ('11111111-0000-0000-0000-000000000001', 'Geral', 'geral', true, 1);

-- Site S de A: só um rascunho de versão, SEM cidade/UF.
insert into public.perfis_perfil (id, responsavel_id, slug) values
  ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a', 'site-sem-cidade');
insert into public.perfis_perfil_versao (id, perfil_id, nome) values
  ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Site sem cidade');

-- Particular legado: item sem cidade no item, versão rascunho completa COM cidade/UF (o envio copia para o item).
insert into public.catalogo_item (id, conta_id, perfil_id, tipo) values
  ('f0000000-0000-0000-0000-000000000009', 'aaaaaaaa-0000-0000-0000-00000000000a', null, 'produto');
insert into public.catalogo_item_versao (id, item_id, nome, descricao, foto_path, categoria_principal_id, cidade, uf) values
  ('f1000000-0000-0000-0000-000000000009', 'f0000000-0000-0000-0000-000000000009', 'Particular legado', 'Descrição',
   'item/f0000000-0000-0000-0000-000000000009/f.jpg', '11111111-0000-0000-0000-000000000001', 'Recife', 'PE');

create schema t;
grant usage on schema t to anon, authenticated;
create function t.iv(p_nome text, p_sit text) returns uuid language sql stable security definer as $$
  select id from public.catalogo_item_versao where nome = p_nome and situacao = p_sit order by criado_em desc, id limit 1 $$;

-- ===== Criação =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$select public.catalogo_criar_item('servico', 'a0000000-0000-0000-0000-000000000001', p_nome => 'Serviço do site',
  p_descricao => 'Descrição', p_categoria_principal_id => '11111111-0000-0000-0000-000000000001')$$,
  'item de site cria o rascunho mesmo com o site sem cidade/UF (não dá 23514 sem saída)');
select is((select cidade from public.catalogo_meus_itens where perfil_id = 'a0000000-0000-0000-0000-000000000001'), null, 'o item nasce sem cidade (herança fica para o envio)');
select throws_ok($$select public.catalogo_criar_item('produto', null, p_nome => 'Particular sem local')$$, '23514', null, 'anúncio particular segue exigindo cidade e UF na criação');
select throws_ok($$select public.catalogo_criar_item('produto', 'a0000000-0000-0000-0000-000000000001', p_nome => 'Meia', p_uf => 'RS')$$, '23514', null, 'só uma das duas continua sendo 23514');

-- ===== Envio: exige localização, com erro próprio e mapeável =====
select lives_ok($$update public.catalogo_item_versao v set foto_path = 'item/' || v.item_id::text || '/f.jpg' where nome = 'Serviço do site'$$, 'foto do rascunho');
select throws_ok($$select public.catalogo_enviar_item_versao(t.iv('Serviço do site', 'rascunho'))$$, 'P0001', 'localizacao_obrigatoria', 'site sem cidade/UF: o envio falha com P0001 localizacao_obrigatoria');
select is((select count(*)::int from public.catalogo_item_versao where nome = 'Serviço do site' and situacao = 'rascunho'), 1, 'a versão segue rascunho (nada mudou)');
reset role;

-- O dono completa a cidade/UF do site (rascunho); o item herda no envio.
update public.perfis_perfil_versao set cidade = 'Canoas', uf = 'RS' where id = 'a1000000-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$select public.catalogo_enviar_item_versao(t.iv('Serviço do site', 'rascunho'))$$, 'com cidade/UF no site o envio passa');
select is((select cidade || '/' || uf from public.catalogo_meus_itens where perfil_id = 'a0000000-0000-0000-0000-000000000001'), 'Canoas/RS', 'o item herdou a localização do site no envio');
select lives_ok($$select public.catalogo_enviar_item_versao(t.iv('Particular legado', 'rascunho'))$$, 'particular legado envia');
select is((select cidade || '/' || uf from public.catalogo_meus_itens where id = 'f0000000-0000-0000-0000-000000000009'), 'Recife/PE', 'particular: o envio copia a localização da versão para o item');
reset role;

-- ===== Excluir com versão pendente =====
select is((select count(*)::int from public.catalogo_item_versao where situacao = 'pendente'), 2, 'antes: 2 versões pendentes (serviço do site e particular legado)');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select is((select count(*)::int from public.administracao_fila_pendencias where alvo_tipo = 'item'), 2, 'antes: as duas estão na fila do administrador');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$select public.catalogo_excluir_item('f0000000-0000-0000-0000-000000000009', 'desisti')$$, 'A exclui o particular com versão pendente');
select lives_ok($$select public.catalogo_excluir_item('f0000000-0000-0000-0000-000000000009', 'de novo')$$, 'repetir não falha');
reset role;

select is((select count(*)::int from public.catalogo_item_versao where item_id = 'f0000000-0000-0000-0000-000000000009' and situacao = 'pendente'), 0, 'nenhuma versão pendente sobra no item excluído');
select is((select situacao from public.catalogo_item_versao where id = 'f1000000-0000-0000-0000-000000000009'), 'rejeitada', 'a versão pendente foi rejeitada');
select is((select decisao || '|' || motivo from public.catalogo_item_revisao where versao_id = 'f1000000-0000-0000-0000-000000000009'), 'rejeitada|item excluído', 'revisão gravada com o motivo "item excluído"');
select is((select autor_id from public.catalogo_item_revisao where versao_id = 'f1000000-0000-0000-0000-000000000009'), 'aaaaaaaa-0000-0000-0000-00000000000a'::uuid, 'o autor da rejeição é o dono que excluiu');
select is((select count(*)::int from public.administracao_auditoria where acao = 'cancelar_versao_item_excluido' and alvo_id = 'f1000000-0000-0000-0000-000000000009'), 1, 'auditoria gravada uma só vez (autor, motivo, valor anterior)');
select is((select valor_anterior ->> 'situacao' from public.administracao_auditoria where acao = 'cancelar_versao_item_excluido' and alvo_id = 'f1000000-0000-0000-0000-000000000009'), 'pendente', 'auditoria guarda o valor anterior');
select is((select autor_id from public.administracao_auditoria where acao = 'cancelar_versao_item_excluido' and alvo_id = 'f1000000-0000-0000-0000-000000000009'), 'aaaaaaaa-0000-0000-0000-00000000000a'::uuid, 'auditoria guarda o autor');
select is((select count(*)::int from public.catalogo_item_revisao where item_id = 'f0000000-0000-0000-0000-000000000009'), 1, 'repetir a exclusão não duplica a revisão');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select is((select count(*)::int from public.administracao_fila_pendencias where alvo_tipo = 'item'), 1, 'depois: só a pendência do serviço do site segue na fila');
reset role;

-- O serviço do site (não excluído) mantém a pendente.
select is((select situacao from public.catalogo_item_versao where nome = 'Serviço do site'), 'pendente', 'versão de item não excluído não é tocada');

select * from finish();
rollback;
