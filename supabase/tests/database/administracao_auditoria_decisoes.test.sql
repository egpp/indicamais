-- pgTAP · auditoria das decisões de revisão (D-007) · IM-021, IM-023, IM-086
-- Aprovar/rejeitar versão de perfil ou item grava 1 linha em administracao_auditoria, na mesma transação.
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

-- Perfis (montados como superusuário). loja-um já tem versão aprovada (v0) e uma edição pendente (v1).
insert into public.perfis_perfil (id, responsavel_id, slug) values
  ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a', 'loja-um'),
  ('a0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-00000000000a', 'loja-dois'),
  ('a0000000-0000-0000-0000-000000000003', 'dddddddd-0000-0000-0000-00000000000d', 'loja-admin');
insert into public.perfis_perfil_versao (id, perfil_id, situacao, enviada_em, nome, descricao_breve, imagem_path, categoria_principal_id, cidade, uf) values
  ('a1000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000001', 'aprovada', now(), 'Loja Um', 'Doces', 'perfil/a0000000-0000-0000-0000-000000000001/capa.jpg', '11111111-0000-0000-0000-000000000001', 'Porto Alegre', 'RS');
update public.perfis_perfil set versao_aprovada_id = 'a1000000-0000-0000-0000-000000000000', publicado = true
 where id = 'a0000000-0000-0000-0000-000000000001';
insert into public.perfis_perfil_versao (id, perfil_id, situacao, enviada_em, nome, descricao_breve, imagem_path, categoria_principal_id, cidade, uf) values
  ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'pendente', now(), 'Loja Um 2', 'Doces', 'perfil/a0000000-0000-0000-0000-000000000001/capa2.jpg', '11111111-0000-0000-0000-000000000001', 'Porto Alegre', 'RS'),
  ('a1000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'pendente', now(), 'Loja Dois', 'Salgados', 'perfil/a0000000-0000-0000-0000-000000000002/capa.jpg', '11111111-0000-0000-0000-000000000001', 'Porto Alegre', 'RS'),
  ('a1000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', 'pendente', now(), 'Loja Admin', 'Teste', 'perfil/a0000000-0000-0000-0000-000000000003/capa.jpg', '11111111-0000-0000-0000-000000000001', 'Porto Alegre', 'RS');

-- Itens. item 1: aprovado (v0) com edição pendente (v1); item 2: pendente; item 3: do administrador, pendente.
insert into public.catalogo_item (id, conta_id, perfil_id, tipo) values
  ('e0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a', null, 'produto'),
  ('e0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-00000000000a', null, 'produto'),
  ('e0000000-0000-0000-0000-000000000003', 'dddddddd-0000-0000-0000-00000000000d', null, 'produto');
insert into public.catalogo_item_versao (id, item_id, situacao, enviada_em, nome, descricao, foto_path, categoria_principal_id) values
  ('e1000000-0000-0000-0000-000000000000', 'e0000000-0000-0000-0000-000000000001', 'aprovada', now(), 'Bolo', 'Bolo de cenoura', 'item/e0000000-0000-0000-0000-000000000001/bolo.jpg', '11111111-0000-0000-0000-000000000001');
update public.catalogo_item set versao_aprovada_id = 'e1000000-0000-0000-0000-000000000000', publicado = true
 where id = 'e0000000-0000-0000-0000-000000000001';
insert into public.catalogo_item_versao (id, item_id, situacao, enviada_em, nome, descricao, foto_path, categoria_principal_id, cidade, uf) values
  ('e1000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'pendente', now(), 'Bolo 2', 'Bolo novo', 'item/e0000000-0000-0000-0000-000000000001/bolo2.jpg', '11111111-0000-0000-0000-000000000001', 'Porto Alegre', 'RS'),
  ('e1000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000002', 'pendente', now(), 'Pão', 'Pão caseiro', 'item/e0000000-0000-0000-0000-000000000002/pao.jpg', '11111111-0000-0000-0000-000000000001', 'Porto Alegre', 'RS'),
  ('e1000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000003', 'pendente', now(), 'Bike', 'Bicicleta', 'item/e0000000-0000-0000-0000-000000000003/bike.jpg', '11111111-0000-0000-0000-000000000001', 'Porto Alegre', 'RS');

select is((select count(*)::int from public.administracao_auditoria), 0, 'começa sem auditoria');

-- ===== Negativos: nada é auditado =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select throws_ok($$select public.perfis_decidir_versao('a1000000-0000-0000-0000-000000000001', true, null)$$, '42501', null, 'não-administrador não decide perfil');
select throws_ok($$select public.catalogo_decidir_item_versao('e1000000-0000-0000-0000-000000000001', true, null)$$, '42501', null, 'não-administrador não decide item');
-- O dono comum também não decide o próprio conteúdo (não é administrador)
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok($$select public.perfis_decidir_versao('a1000000-0000-0000-0000-000000000001', true, null)$$, '42501', null, 'dono não administrador não se auto-aprova (perfil)');
select throws_ok($$select public.catalogo_decidir_item_versao('e1000000-0000-0000-0000-000000000001', true, null)$$, '42501', null, 'dono não administrador não se auto-aprova (item)');
-- Administrador dono: nunca se auto-aprova
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select throws_ok($$select public.perfis_decidir_versao('a1000000-0000-0000-0000-000000000003', true, null)$$, '42501', null, 'administrador não aprova o próprio perfil');
select throws_ok($$select public.perfis_decidir_versao('a1000000-0000-0000-0000-000000000003', false, 'motivo')$$, '42501', null, 'administrador não rejeita o próprio perfil');
select throws_ok($$select public.catalogo_decidir_item_versao('e1000000-0000-0000-0000-000000000003', true, null)$$, '42501', null, 'administrador não aprova o próprio item');
-- Rejeição sem motivo
select throws_ok($$select public.perfis_decidir_versao('a1000000-0000-0000-0000-000000000002', false, null)$$, '22023', null, 'rejeitar perfil sem motivo falha');
select throws_ok($$select public.perfis_decidir_versao('a1000000-0000-0000-0000-000000000002', false, '   ')$$, '22023', null, 'rejeitar perfil com motivo em branco falha');
select throws_ok($$select public.catalogo_decidir_item_versao('e1000000-0000-0000-0000-000000000002', false, null)$$, '22023', null, 'rejeitar item sem motivo falha');
select throws_ok($$select public.catalogo_decidir_item_versao('e1000000-0000-0000-0000-000000000002', false, '   ')$$, '22023', null, 'rejeitar item com motivo em branco falha');
reset role;
select is((select count(*)::int from public.administracao_auditoria), 0, 'nenhuma falha deixou linha de auditoria');
select is((select count(*)::int from public.perfis_perfil_versao where situacao = 'pendente'), 3, 'nenhuma versão de perfil mudou');
select is((select count(*)::int from public.catalogo_item_versao where situacao = 'pendente'), 3, 'nenhuma versão de item mudou');

-- ===== Atomicidade: se a auditoria falhar, a decisão desfaz =====
create function public.t_auditoria_falha() returns trigger language plpgsql as $$ begin raise exception 'auditoria indisponível' using errcode = 'XX001'; end $$;
create trigger t_auditoria_falha before insert on public.administracao_auditoria for each row execute function public.t_auditoria_falha();
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select throws_ok($$select public.perfis_decidir_versao('a1000000-0000-0000-0000-000000000002', true, null)$$, 'XX001', null, 'auditoria falha: decisão do perfil falha');
select throws_ok($$select public.catalogo_decidir_item_versao('e1000000-0000-0000-0000-000000000002', true, null)$$, 'XX001', null, 'auditoria falha: decisão do item falha');
reset role;
drop trigger t_auditoria_falha on public.administracao_auditoria;
select is((select situacao from public.perfis_perfil_versao where id = 'a1000000-0000-0000-0000-000000000002'), 'pendente', 'decisão do perfil foi desfeita');
select is((select situacao from public.catalogo_item_versao where id = 'e1000000-0000-0000-0000-000000000002'), 'pendente', 'decisão do item foi desfeita');
select is((select count(*)::int from public.perfis_revisao), 0, 'revisão do perfil também foi desfeita');
select is((select count(*)::int from public.catalogo_item_revisao), 0, 'revisão do item também foi desfeita');
select is((select versao_aprovada_id from public.perfis_perfil where id = 'a0000000-0000-0000-0000-000000000002'), null, 'ponteiro do perfil intacto');

-- ===== Positivos =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select lives_ok($$select public.perfis_decidir_versao('a1000000-0000-0000-0000-000000000001', true, 'Tudo certo')$$, 'administrador aprova a edição do perfil');
select lives_ok($$select public.perfis_decidir_versao('a1000000-0000-0000-0000-000000000002', false, 'Imagem fora do padrão')$$, 'administrador rejeita o perfil');
select lives_ok($$select public.catalogo_decidir_item_versao('e1000000-0000-0000-0000-000000000001', true, null)$$, 'administrador aprova a edição do item');
select lives_ok($$select public.catalogo_decidir_item_versao('e1000000-0000-0000-0000-000000000002', false, 'Foto desfocada')$$, 'administrador rejeita o item');
select is((select count(*)::int from public.administracao_auditoria), 4, 'administrador lê as 4 linhas de auditoria');
reset role;

select is((select count(*)::int from public.administracao_auditoria), 4, '1 linha por decisão (4 decisões)');
-- Aprovar perfil
select is((select count(*)::int from public.administracao_auditoria where acao = 'aprovar_versao' and alvo_tabela = 'perfis_perfil_versao' and alvo_id = 'a1000000-0000-0000-0000-000000000001'), 1, 'aprovar perfil: 1 linha');
select is((select autor_id from public.administracao_auditoria where alvo_id = 'a1000000-0000-0000-0000-000000000001'), 'dddddddd-0000-0000-0000-00000000000d'::uuid, 'aprovar perfil: autor é o administrador');
select is((select motivo from public.administracao_auditoria where alvo_id = 'a1000000-0000-0000-0000-000000000001'), 'Tudo certo', 'aprovar perfil: motivo');
select is((select valor_anterior ->> 'situacao' from public.administracao_auditoria where alvo_id = 'a1000000-0000-0000-0000-000000000001'), 'pendente', 'aprovar perfil: situação anterior');
select is((select valor_anterior ->> 'versao_aprovada_anterior_id' from public.administracao_auditoria where alvo_id = 'a1000000-0000-0000-0000-000000000001'), 'a1000000-0000-0000-0000-000000000000', 'aprovar perfil: versão aprovada anterior');
select is((select valor_novo ->> 'situacao' from public.administracao_auditoria where alvo_id = 'a1000000-0000-0000-0000-000000000001'), 'aprovada', 'aprovar perfil: situação nova');
select is((select valor_novo ->> 'versao_aprovada_id' from public.administracao_auditoria where alvo_id = 'a1000000-0000-0000-0000-000000000001'), 'a1000000-0000-0000-0000-000000000001', 'aprovar perfil: nova versão aprovada');
select isnt((select criado_em from public.administracao_auditoria where alvo_id = 'a1000000-0000-0000-0000-000000000001'), null, 'aprovar perfil: data gravada');
-- Rejeitar perfil
select is((select count(*)::int from public.administracao_auditoria where acao = 'rejeitar_versao' and alvo_tabela = 'perfis_perfil_versao' and alvo_id = 'a1000000-0000-0000-0000-000000000002'), 1, 'rejeitar perfil: 1 linha');
select is((select motivo from public.administracao_auditoria where alvo_id = 'a1000000-0000-0000-0000-000000000002'), 'Imagem fora do padrão', 'rejeitar perfil: motivo');
select is((select autor_id from public.administracao_auditoria where alvo_id = 'a1000000-0000-0000-0000-000000000002'), 'dddddddd-0000-0000-0000-00000000000d'::uuid, 'rejeitar perfil: autor');
select is((select valor_anterior ->> 'situacao' from public.administracao_auditoria where alvo_id = 'a1000000-0000-0000-0000-000000000002'), 'pendente', 'rejeitar perfil: situação anterior');
select is((select valor_novo ->> 'situacao' from public.administracao_auditoria where alvo_id = 'a1000000-0000-0000-0000-000000000002'), 'rejeitada', 'rejeitar perfil: situação nova');
select is((select valor_novo ->> 'versao_aprovada_id' from public.administracao_auditoria where alvo_id = 'a1000000-0000-0000-0000-000000000002'), null, 'rejeitar perfil: sem versão aprovada nova');
-- Aprovar item
select is((select count(*)::int from public.administracao_auditoria where acao = 'aprovar_versao' and alvo_tabela = 'catalogo_item_versao' and alvo_id = 'e1000000-0000-0000-0000-000000000001'), 1, 'aprovar item: 1 linha');
select is((select autor_id from public.administracao_auditoria where alvo_id = 'e1000000-0000-0000-0000-000000000001'), 'dddddddd-0000-0000-0000-00000000000d'::uuid, 'aprovar item: autor');
select is((select valor_anterior ->> 'versao_aprovada_anterior_id' from public.administracao_auditoria where alvo_id = 'e1000000-0000-0000-0000-000000000001'), 'e1000000-0000-0000-0000-000000000000', 'aprovar item: versão aprovada anterior');
select is((select valor_novo ->> 'versao_aprovada_id' from public.administracao_auditoria where alvo_id = 'e1000000-0000-0000-0000-000000000001'), 'e1000000-0000-0000-0000-000000000001', 'aprovar item: nova versão aprovada');
select is((select valor_novo ->> 'situacao' from public.administracao_auditoria where alvo_id = 'e1000000-0000-0000-0000-000000000001'), 'aprovada', 'aprovar item: situação nova');
select is((select valor_anterior ->> 'situacao' from public.administracao_auditoria where alvo_id = 'e1000000-0000-0000-0000-000000000001'), 'pendente', 'aprovar item: situação anterior');
-- Rejeitar item
select is((select count(*)::int from public.administracao_auditoria where acao = 'rejeitar_versao' and alvo_tabela = 'catalogo_item_versao' and alvo_id = 'e1000000-0000-0000-0000-000000000002'), 1, 'rejeitar item: 1 linha');
select is((select motivo from public.administracao_auditoria where alvo_id = 'e1000000-0000-0000-0000-000000000002'), 'Foto desfocada', 'rejeitar item: motivo');
select is((select valor_novo ->> 'situacao' from public.administracao_auditoria where alvo_id = 'e1000000-0000-0000-0000-000000000002'), 'rejeitada', 'rejeitar item: situação nova');
-- Sem dados pessoais na trilha
select is((select count(*)::int from public.administracao_auditoria where to_jsonb(administracao_auditoria)::text ~* '(@teste|\+55)'), 0, 'auditoria sem e-mail nem telefone');
-- Aprovar nunca altera publicado
select is((select publicado from public.perfis_perfil where id = 'a0000000-0000-0000-0000-000000000001'), true, 'aprovar perfil não altera publicado');
select is((select publicado from public.catalogo_item where id = 'e0000000-0000-0000-0000-000000000001'), true, 'aprovar item não altera publicado');
select is((select publicado from public.perfis_perfil where id = 'a0000000-0000-0000-0000-000000000002'), false, 'rejeitar perfil mantém despublicado');

-- ===== O cliente não lê nem altera a auditoria =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is((select count(*)::int from public.administracao_auditoria), 0, 'responsável (A) não lê a auditoria');
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((select count(*)::int from public.administracao_auditoria), 0, 'outra conta (B) não lê a auditoria');
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$select * from public.administracao_auditoria$$, '42501', null, 'anon não lê a auditoria');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select throws_ok($$insert into public.administracao_auditoria (autor_id, acao, alvo_tabela, alvo_id) values ('dddddddd-0000-0000-0000-00000000000d', 'forjada', 'x', 'y')$$, '42501', null, 'nem o administrador insere direto');
select throws_ok($$update public.administracao_auditoria set motivo = 'x'$$, '42501', null, 'auditoria é só inserção (update, administrador)');
select throws_ok($$delete from public.administracao_auditoria$$, '42501', null, 'auditoria é só inserção (delete, administrador)');
reset role;
select throws_ok($$update public.administracao_auditoria set motivo = 'x'$$, '42501', null, 'auditoria é imutável (update, superusuário)');
select throws_ok($$delete from public.administracao_auditoria$$, '42501', null, 'auditoria é imutável (delete, superusuário)');

select * from finish();
rollback;
