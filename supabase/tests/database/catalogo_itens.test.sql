-- pgTAP · módulo catalogo · produtos, serviços, anúncios particulares, versões e publicação
-- IM-014, IM-015, IM-016, IM-017, IM-021, IM-022, IM-023, IM-029, IM-079, IM-086
-- Itens nascem por catalogo_criar_item (atômico). Foto é opaca: item/<item_id>/<arquivo>.
begin;
select * from no_plan();

insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@teste.local'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@teste.local'),
  ('dddddddd-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd@teste.local');
insert into public.administracao_administrador (conta_id) values ('dddddddd-0000-0000-0000-00000000000d');
insert into public.catalogo_categoria (id, nome, slug, ativa, ordem) values
  ('11111111-0000-0000-0000-000000000001', 'Alimentação', 'alimentacao', true, 1),
  ('11111111-0000-0000-0000-000000000002', 'Antiga', 'antiga', false, 2),
  ('11111111-0000-0000-0000-000000000003', 'Serviços', 'servicos', true, 3);

-- Perfil de A já aprovado e publicado (montado como superusuário; o fluxo do perfil é testado em perfis.test.sql).
insert into public.perfis_perfil (id, responsavel_id, slug) values
  ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a', 'loja-ana');
insert into public.perfis_perfil_versao (id, perfil_id, situacao, enviada_em, nome, descricao_breve, imagem_path, categoria_principal_id, cidade, uf) values
  ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'aprovada', now(), 'Loja da Ana', 'Doces',
   'perfil/a0000000-0000-0000-0000-000000000001/capa.jpg', '11111111-0000-0000-0000-000000000001', 'Porto Alegre', 'RS');
update public.perfis_perfil set versao_aprovada_id = 'a1000000-0000-0000-0000-000000000001', publicado = true
 where id = 'a0000000-0000-0000-0000-000000000001';

-- Ajudantes só do teste (ids sem passar pela RLS).
create schema t;
grant usage on schema t to anon, authenticated;
create function t.serv() returns uuid language sql stable security definer as $$
  select id from public.catalogo_item where tipo = 'servico' and perfil_id is not null limit 1 $$;
create function t.part() returns uuid language sql stable security definer as $$
  select id from public.catalogo_item where perfil_id is null limit 1 $$;
create function t.iv(p_item uuid, s text) returns uuid language sql stable security definer as $$
  select id from public.catalogo_item_versao where item_id = p_item and situacao = s $$;

select hasnt_column('public', 'catalogo_item_versao', 'estoque', 'serviço/produto sem estoque obrigatório (não há coluna de estoque)');
select is(has_column_privilege('anon', 'public.catalogo_item', 'conta_id', 'select'), false, 'anon não lê conta_id do item');
select is(has_column_privilege('authenticated', 'public.catalogo_item', 'conta_id', 'select'), false, 'usuário logado também não lê conta_id do item');

-- ===== A cria itens =====
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select throws_ok($$select public.catalogo_criar_item('outro', 'a0000000-0000-0000-0000-000000000001')$$, '23514', null, 'tipo inválido é rejeitado');
select lives_ok($$select public.catalogo_criar_item('servico', 'a0000000-0000-0000-0000-000000000001')$$, 'A cria serviço no próprio perfil (item + 1ª versão)');
select lives_ok($$select public.catalogo_criar_item('produto', null, p_nome => 'Bicicleta')$$, 'A cria anúncio particular (sem perfil comercial, IM-015)');
select is((select count(*)::int from public.catalogo_meus_itens), 2, 'catalogo_meus_itens lista os 2 itens de A');
select is((select count(*)::int from public.catalogo_item_versao where situacao = 'rascunho'), 2, 'cada item nasce com a primeira versão (rascunho)');
select throws_ok($$insert into public.catalogo_item (conta_id, tipo) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'produto')$$, '42501', null, 'item não nasce por INSERT direto');
select throws_ok($$insert into public.catalogo_item (conta_id, tipo) values ('bbbbbbbb-0000-0000-0000-00000000000b', 'produto')$$, '42501', null, 'A não cria item em nome de B');
-- Atomicidade: versão inválida derruba o item
select throws_ok($$select public.catalogo_criar_item('produto', null, p_preco_modo => 'fixo')$$, '23514', null, 'versão inválida derruba a criação do item');
select is((select count(*)::int from public.catalogo_meus_itens), 2, 'nenhum item órfão (sem versão) após a falha');
select throws_ok($$select public.catalogo_criar_item('produto', 'a0000000-0000-0000-0000-0000000000ff')$$, '23503', null, 'perfil inexistente é recusado');
select throws_ok($$update public.catalogo_item set tipo = 'produto' where tipo = 'servico'$$, '42501', null, 'tipo do item não é alterável pelo cliente');
select throws_ok($$update public.catalogo_item set publicado = true where tipo = 'servico'$$, '23514', null, 'item nunca aprovado não pode ser publicado');

-- Preço (IM-014)
select throws_ok($$insert into public.catalogo_item_versao (item_id, preco_modo) values (t.serv(), 'fixo')$$, '23514', null, 'preço fixo sem valor é rejeitado');
select throws_ok($$insert into public.catalogo_item_versao (item_id, preco_modo, preco_centavos) values (t.serv(), 'sob_consulta', 1000)$$, '23514', null, 'sob consulta com valor é rejeitado');
select throws_ok($$insert into public.catalogo_item_versao (item_id, preco_centavos) values (t.serv(), 1000)$$, '23514', null, 'valor sem modo é rejeitado');
select throws_ok($$insert into public.catalogo_item_versao (item_id, preco_modo, preco_centavos) values (t.serv(), 'fixo', 0)$$, '23514', null, 'preço zero é rejeitado');
select throws_ok($$insert into public.catalogo_item_versao (item_id, preco_modo, preco_centavos) values (t.serv(), 'fixo', -5)$$, '23514', null, 'preço negativo é rejeitado');
select throws_ok($$insert into public.catalogo_item_versao (item_id, preco_modo, preco_centavos) values (t.serv(), 'a_partir_de', 100000001)$$, '23514', null, 'preço acima do limite é rejeitado');
select throws_ok($$insert into public.catalogo_item_versao (item_id, preco_modo, preco_centavos) values (t.serv(), 'gratis', 100)$$, '23514', null, 'modo de preço desconhecido é rejeitado');
-- Categorias e imagem (IM-016)
select throws_ok($$insert into public.catalogo_item_versao (item_id, categoria_principal_id) values (t.serv(), '11111111-0000-0000-0000-000000000002')$$, '23514', null, 'categoria inativa é rejeitada no item');
select throws_ok($$insert into public.catalogo_item_versao (item_id, categoria_secundaria_1_id) values (t.serv(), '11111111-0000-0000-0000-000000000001')$$, '23514', null, 'secundária sem principal é rejeitada');
select throws_ok($$insert into public.catalogo_item_versao (item_id, categoria_principal_id, categoria_secundaria_1_id, categoria_secundaria_2_id) values (t.serv(), '11111111-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000003')$$, '23514', null, 'secundárias repetidas são rejeitadas');
select throws_ok($$insert into public.catalogo_item_versao (item_id, foto_path) values (t.serv(), 'item/' || t.part()::text || '/foto.jpg')$$, '23514', null, 'foto na pasta de outro item é rejeitada');
select throws_ok($$insert into public.catalogo_item_versao (item_id, foto_path) values (t.serv(), 'aaaaaaaa-0000-0000-0000-00000000000a/foto.jpg')$$, '23514', null, 'caminho com o id da conta (formato antigo) é rejeitado');

-- Rascunho válido: principal + 2 secundárias é o máximo (IM-016)
select lives_ok($$update public.catalogo_item_versao set nome = 'Consultoria', descricao = 'Atendimento de consultoria', foto_path = 'item/' || t.serv()::text || '/serv.jpg',
  categoria_principal_id = '11111111-0000-0000-0000-000000000003', categoria_secundaria_1_id = '11111111-0000-0000-0000-000000000001', preco_modo = 'a_partir_de', preco_centavos = 5000
  where item_id = t.serv() and situacao = 'rascunho'$$, 'A salva rascunho do serviço');
select is((select count(*)::int from public.catalogo_item_versao where situacao = 'rascunho'), 2, 'A lê os rascunhos (prévia, IM-017)');
select is((select foto_path from public.catalogo_item_versao where item_id = t.serv() and situacao = 'rascunho'), 'item/' || t.serv()::text || '/serv.jpg', 'foto_path no formato opaco item/<item_id>/<arquivo>');
select lives_ok($$select public.catalogo_enviar_item_versao(t.iv(t.serv(), 'rascunho'))$$, 'A envia o serviço');
select throws_ok($$select public.catalogo_enviar_item_versao(t.iv(t.serv(), 'pendente'))$$, 'P0001', null, 'enviar duas vezes é recusado');
select throws_ok($$select public.catalogo_decidir_item_versao(t.iv(t.serv(), 'pendente'), true, null)$$, '42501', null, 'dono não aprova o próprio item');
select throws_ok($$update public.catalogo_item_versao set situacao = 'aprovada'$$, '42501', null, 'cliente não altera a situação da versão do item');
select throws_ok($$update public.catalogo_item set versao_aprovada_id = t.iv(t.serv(), 'pendente')$$, '42501', null, 'cliente não define a versão aprovada do item');

-- Anúncio particular: rascunho incompleto não pode ser enviado
select is((select nome from public.catalogo_item_versao where item_id = t.part() and situacao = 'rascunho'), 'Bicicleta', 'rascunho incompleto é permitido');
select throws_ok($$select public.catalogo_enviar_item_versao(t.iv(t.part(), 'rascunho'))$$, '23514', null, 'enviar anúncio incompleto é recusado');
update public.catalogo_item_versao set descricao = 'Bicicleta aro 29 seminova', foto_path = 'item/' || t.part()::text || '/bike.jpg', categoria_principal_id = '11111111-0000-0000-0000-000000000001', preco_modo = 'fixo', preco_centavos = 120000 where situacao = 'rascunho' and nome = 'Bicicleta';
select lives_ok($$select public.catalogo_enviar_item_versao(t.iv(t.part(), 'rascunho'))$$, 'anúncio completo é enviado');

-- ===== Anon e B: nada de pendente/rascunho =====
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.catalogo_item_publico), 0, 'anon não vê item pendente');
select is((select count(*)::int from public.catalogo_item), 0, 'anon não lê itens não publicados');
select is((select count(*)::int from public.catalogo_item_versao), 0, 'anon não lê versões não aprovadas');
select throws_ok($$select * from public.catalogo_item_revisao$$, '42501', null, 'anon não lê revisões de item');
select throws_ok($$select * from public.administracao_fila_pendencias$$, '42501', null, 'anon não lê a fila de pendências');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((select count(*)::int from public.catalogo_item) + (select count(*)::int from public.catalogo_item_versao) + (select count(*)::int from public.catalogo_item_revisao), 0, 'B não vê itens, versões nem revisões de A');
select throws_ok($$select public.catalogo_criar_item('produto', 'a0000000-0000-0000-0000-000000000001')$$, '23503', null, 'B não cria item no perfil comercial de A');
select is((select count(*)::int from public.catalogo_meus_itens), 0, 'B não lista itens de A em catalogo_meus_itens');
select is((select count(*)::int from public.administracao_meus_resultados), 0, 'B não lê resultados de A');
select throws_ok($$insert into public.catalogo_item_versao (item_id, nome) values (t.serv(), 'invasão')$$, '42501', null, 'B não cria versão no item de A');
update public.catalogo_item set publicado = false;
select throws_ok($$select public.catalogo_enviar_item_versao(t.iv(t.serv(), 'pendente'))$$, '42501', null, 'B não envia versão de A');
select is((select count(*)::int from public.administracao_fila_pendencias), 0, 'B não vê a fila');
select throws_ok($$select public.catalogo_decidir_item_versao(t.iv(t.serv(), 'pendente'), true, null)$$, '42501', null, 'B (não administrador) não aprova');

-- ===== Administrador =====
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select is((select count(*)::int from public.administracao_fila_pendencias where alvo_tipo = 'item'), 2, 'fila mostra os 2 itens pendentes');
select throws_ok($$select public.catalogo_decidir_item_versao(t.iv(t.part(), 'pendente'), false, '')$$, '22023', null, 'rejeitar item exige motivo');
select lives_ok($$select public.catalogo_decidir_item_versao(t.iv(t.part(), 'pendente'), false, 'Foto não mostra o produto')$$, 'administrador rejeita o anúncio com motivo');
select lives_ok($$select public.catalogo_decidir_item_versao(t.iv(t.serv(), 'pendente'), true, null)$$, 'administrador aprova o serviço');
select throws_ok($$select public.catalogo_decidir_item_versao((select id from public.catalogo_item_versao where situacao = 'aprovada'), true, null)$$, 'P0001', null, 'versão já decidida não é decidida de novo');

-- Aprovado e NÃO publicado: invisível
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.catalogo_item_publico), 0, 'item aprovado e não publicado não aparece');

-- A publica o serviço; rejeição aparece para A
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok($$select autor_id from public.catalogo_item_revisao$$, '42501', null, 'A não lê autor_id direto da revisão de item');
select is((select count(*)::int from public.catalogo_item_revisao), 0, 'A não lê a tabela de revisão de item (RLS)');
select is((select motivo from public.administracao_meus_resultados where tipo = 'item' and situacao = 'rejeitada'), 'Foto não mostra o produto', 'A lê o motivo da rejeição do anúncio pela visão');
select is((select situacao from public.administracao_meus_resultados where tipo = 'item' and alvo_id = t.part()), 'rejeitada', 'A vê a rejeição do anúncio em administracao_meus_resultados (IM-023)');
select is((select motivo from public.administracao_meus_resultados where tipo = 'item' and alvo_id = t.part()), 'Foto não mostra o produto', 'com o motivo');
select is((select versao_vigente from public.administracao_meus_resultados where tipo = 'item' and alvo_id = t.serv()), true, 'serviço aprovado: versão vigente');
select lives_ok($$update public.catalogo_item set publicado = true where id = t.serv()$$, 'A publica o serviço');

reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.catalogo_item_publico), 1, 'serviço aprovado e publicado aparece');
select is((select preco_centavos from public.catalogo_item_publico), 5000::bigint, 'preço a partir de em centavos');
select is((select preco_modo from public.catalogo_item_publico), 'a_partir_de', 'modo de preço');

-- IM-079: perfil despublicado retira os itens
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$update public.perfis_perfil set publicado = false where id = 'a0000000-0000-0000-0000-000000000001'$$, 'A despublica o perfil');
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.catalogo_item_publico), 0, 'perfil despublicado retira o item da leitura pública');
select is((select count(*)::int from public.catalogo_item), 0, 'e a tabela de itens não o expõe');
select is((select count(*)::int from public.catalogo_item_versao), 0, 'nem a versão aprovada');
select is(public.perfis_perfil_disponivel('a0000000-0000-0000-0000-000000000001'), false, 'perfil indisponível para Fases 3/4');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$update public.perfis_perfil set publicado = true where id = 'a0000000-0000-0000-0000-000000000001'$$, 'A republica o perfil');
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.catalogo_item_publico), 1, 'item volta com o perfil');

-- Edição de item público cria versão pendente sem derrubar a aprovada (IM-022)
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$insert into public.catalogo_item_versao (item_id, nome, descricao, foto_path, categoria_principal_id, preco_modo)
  values (t.serv(), 'Consultoria Premium', 'Atendimento completo', 'item/' || t.serv()::text || '/serv2.jpg', '11111111-0000-0000-0000-000000000003', 'sob_consulta')$$, 'A edita o serviço público');
select lives_ok($$select public.catalogo_enviar_item_versao(t.iv(t.serv(), 'rascunho'))$$, 'A envia a edição');
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select nome from public.catalogo_item_publico), 'Consultoria', 'edição pendente não derruba a versão aprovada');

-- A despublica o item; aprovar a edição não republica
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$update public.catalogo_item set publicado = false where id = t.serv()$$, 'A despublica o item imediatamente');
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.catalogo_item_publico), 0, 'item despublicado some');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select lives_ok($$select public.catalogo_decidir_item_versao(t.iv(t.serv(), 'pendente'), true, null)$$, 'administrador aprova a edição do item despublicado');
reset role;
select is((select publicado from public.catalogo_item where id = t.serv()), false, 'aprovar a edição não republica o item');
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.catalogo_item_publico), 0, 'item continua fora do ar');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$update public.catalogo_item set publicado = true where id = t.serv()$$, 'A republica o item');
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select nome from public.catalogo_item_publico), 'Consultoria Premium', 'republicado mostra a versão nova');
select is((select preco_modo from public.catalogo_item_publico), 'sob_consulta', 'sob consulta sem valor');

-- Anúncio particular: reenvia, aprova, publica; independe do perfil
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$insert into public.catalogo_item_versao (item_id, nome, descricao, foto_path, categoria_principal_id, preco_modo, preco_centavos)
  values (t.part(), 'Bicicleta', 'Bicicleta aro 29 com foto nova', 'item/' || t.part()::text || '/bike2.jpg', '11111111-0000-0000-0000-000000000001', 'fixo', 120000)$$, 'A refaz o anúncio');
select lives_ok($$select public.catalogo_enviar_item_versao(t.iv(t.part(), 'rascunho'))$$, 'A reenvia o anúncio');
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select lives_ok($$select public.catalogo_decidir_item_versao(t.iv(t.part(), 'pendente'), true, null)$$, 'administrador aprova o anúncio');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$update public.catalogo_item set publicado = true where id = t.part()$$, 'A publica o anúncio particular');
select lives_ok($$update public.perfis_perfil set publicado = false where id = 'a0000000-0000-0000-0000-000000000001'$$, 'A despublica o perfil comercial');
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.catalogo_item_publico), 1, 'só o anúncio particular segue público com o perfil fora do ar');
select is((select nome from public.catalogo_item_publico), 'Bicicleta', 'o anúncio particular independe do perfil');
select is((select count(*)::int from information_schema.columns where table_name = 'catalogo_item_publico' and column_name in ('conta_id', 'email', 'whatsapp_e164')), 0, 'visão pública do item sem dado privado');

-- B sobre item público
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-00000000000b","role":"authenticated"}', true);
update public.catalogo_item set publicado = false;
select throws_ok($$insert into public.catalogo_item_versao (item_id, nome) values (t.part(), 'invasão')$$, '42501', null, 'B não cria versão no anúncio de A');
select is((select count(*)::int from public.catalogo_item_versao), 1, 'B (logado) só lê a versão pública');
select is((select count(*)::int from public.catalogo_item_revisao), 0, 'B não lê revisões de A');

-- Administrador não aprova o próprio anúncio
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select lives_ok($$select public.catalogo_criar_item('produto', null, p_nome => 'Meu produto', p_descricao => 'Descrição', p_categoria_principal_id => '11111111-0000-0000-0000-000000000001')$$, 'administrador cria anúncio próprio');
select lives_ok($$update public.catalogo_item_versao set foto_path = 'item/' || (select id from public.catalogo_meus_itens)::text || '/p.jpg' where nome = 'Meu produto' and situacao = 'rascunho'$$, 'rascunho do administrador');
select lives_ok($$select public.catalogo_enviar_item_versao((select id from public.catalogo_item_versao where situacao = 'rascunho'))$$, 'administrador envia');
select throws_ok($$select public.catalogo_decidir_item_versao((select id from public.catalogo_item_versao where situacao = 'pendente' and nome = 'Meu produto'), true, null)$$, '42501', null, 'administrador não aprova o próprio item');

-- ===== Histórico imutável =====
reset role;
select throws_ok($$update public.catalogo_item_versao set nome = 'x' where situacao = 'aprovada'$$, '42501', null, 'versão aprovada do item é imutável');
select throws_ok($$update public.catalogo_item_versao set preco_centavos = 1 where situacao = 'aprovada' and preco_modo = 'fixo'$$, '42501', null, 'preço de versão aprovada é imutável');
select throws_ok($$delete from public.catalogo_item_versao where situacao = 'aprovada'$$, '42501', null, 'versão aprovada do item não é apagada');
select throws_ok($$delete from public.catalogo_item_versao where situacao = 'rejeitada'$$, '42501', null, 'versão rejeitada do item não é apagada');
select throws_ok($$update public.catalogo_item_revisao set motivo = 'x'$$, '42501', null, 'revisão de item é só inserção (update)');
select throws_ok($$delete from public.catalogo_item_revisao$$, '42501', null, 'revisão de item é só inserção (delete)');
select throws_ok($$update public.catalogo_item set conta_id = 'bbbbbbbb-0000-0000-0000-00000000000b' where tipo = 'servico'$$, '42501', null, 'dono do item é imutável');
select is((select count(*)::int from public.catalogo_item_revisao where versao_aprovada_anterior_id is not null), 1, 'revisão guarda a versão aprovada anterior');
select is((select count(*)::int from public.catalogo_item_revisao where decisao = 'rejeitada' and motivo is null), 0, 'toda rejeição de item tem motivo');

select * from finish();
rollback;
