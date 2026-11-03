-- pgTAP · módulo loja · extensões do item, imóveis, privacidade e leitura pública · Fase 10
-- IM-097, IM-098, IM-099, IM-014, IM-016, IM-021, IM-022, IM-029, IM-079, IM-086, D-020
begin;
select * from no_plan();
delete from public.catalogo_categoria;

-- A = responsável de P1 (Loja liberada no teste) e P2 (nunca liberada); C = outra conta, responsável de P3; D = administrador geral.
insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@teste.local'),
  ('cccccccc-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c@teste.local'),
  ('dddddddd-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd@teste.local');
insert into public.administracao_administrador (conta_id) values ('dddddddd-0000-0000-0000-00000000000d');
insert into public.catalogo_categoria (id, nome, slug, ativa, ordem) values
  ('11111111-0000-0000-0000-000000000001', 'Imóveis', 'imoveis', true, 1);
insert into public.perfis_perfil (id, responsavel_id, slug) values
  ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a', 'imob-um'),
  ('a0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-00000000000a', 'imob-dois'),
  ('a0000000-0000-0000-0000-000000000003', 'cccccccc-0000-0000-0000-00000000000c', 'imob-tres');
insert into public.perfis_perfil_versao (id, perfil_id, nome, descricao_breve, imagem_path, categoria_principal_id, cidade, uf) values
  ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Imobiliária Um', 'Imóveis', 'perfil/a0000000-0000-0000-0000-000000000001/c.jpg', '11111111-0000-0000-0000-000000000001', 'Porto Alegre', 'RS'),
  ('a1000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'Imobiliária Dois', 'Imóveis', 'perfil/a0000000-0000-0000-0000-000000000002/c.jpg', '11111111-0000-0000-0000-000000000001', 'Porto Alegre', 'RS'),
  ('a1000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', 'Imobiliária Três', 'Imóveis', 'perfil/a0000000-0000-0000-0000-000000000003/c.jpg', '11111111-0000-0000-0000-000000000001', 'Canoas', 'RS');
insert into public.perfis_perfil_versao_contato (versao_id, whatsapp_comercial_e164) values
  ('a1000000-0000-0000-0000-000000000001', '+5551988880001'),
  ('a1000000-0000-0000-0000-000000000002', '+5551988880002'),
  ('a1000000-0000-0000-0000-000000000003', '+5551988880003');
update public.perfis_perfil_versao set situacao = 'pendente', enviada_em = now();
update public.perfis_perfil_versao set situacao = 'aprovada';
update public.perfis_perfil set versao_aprovada_id = 'a1000000-0000-0000-0000-000000000001', publicado = true where id = 'a0000000-0000-0000-0000-000000000001';
update public.perfis_perfil set versao_aprovada_id = 'a1000000-0000-0000-0000-000000000002', publicado = true where id = 'a0000000-0000-0000-0000-000000000002';
update public.perfis_perfil set versao_aprovada_id = 'a1000000-0000-0000-0000-000000000003', publicado = true where id = 'a0000000-0000-0000-0000-000000000003';

-- Ajudantes de teste: id do item (perfil + tipo) e da versão (item + situação).
create schema t;
grant usage on schema t to anon, authenticated;
create function t.item(p uuid, tp text) returns uuid language sql stable security definer as $$
  select id from public.catalogo_item where perfil_id = p and tipo = tp order by criado_em, id limit 1 $$;
create function t.vers(i uuid, s text) returns uuid language sql stable security definer as $$
  select id from public.catalogo_item_versao where item_id = i and situacao = s order by criado_em desc, id limit 1 $$;

-- ===== Estrutura: o endereço exato não existe =====
select is((select count(*)::int from information_schema.columns
  where table_name in ('catalogo_item_versao', 'loja_item_publico')
    and column_name ~ '(endereco|latitude|longitude|conta_id|responsavel_id|whatsapp|email|telefone|autor_id)'), 0, 'sem endereço exato, coordenada, conta, telefone ou e-mail na versão nem na visão pública da Loja');
select is(has_column_privilege('anon', 'public.catalogo_item_versao', 'quartos', 'UPDATE'), false, 'anon não grava campo de imóvel');
select is(has_column_privilege('authenticated', 'public.catalogo_item_versao', 'quartos', 'UPDATE'), true, 'o dono grava campo de imóvel (o banco decide pela Loja)');
select is(has_function_privilege('anon', 'public.loja_listar_imoveis(text,text,bigint,bigint,integer,text,text,text,uuid,integer,integer)', 'EXECUTE'), true, 'a lista pública de imóveis é aberta');

-- ===== Sem a Loja: catálogo simples intacto, nada da Loja =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok($$select public.catalogo_criar_item('imovel', 'a0000000-0000-0000-0000-000000000001', 'Apto Centro', 'Apartamento de 2 quartos', '11111111-0000-0000-0000-000000000001', null, null, 'fixo', 35000000, 'Porto Alegre', 'RS')$$, '42501', null, 'sem a Loja o dono não cria imóvel');
select throws_ok($$select public.catalogo_criar_item('imovel', null, 'Apto Centro', 'Apartamento de 2 quartos', '11111111-0000-0000-0000-000000000001', null, null, 'fixo', 35000000, 'Porto Alegre', 'RS')$$, '23514', null, 'imóvel não existe como anúncio particular');
select throws_ok($$select public.catalogo_criar_item('imovel', 'a0000000-0000-0000-0000-000000000003', 'Apto Centro', 'Apartamento de 2 quartos', '11111111-0000-0000-0000-000000000001', null, null, 'fixo', 35000000, 'Porto Alegre', 'RS')$$, '42501', null, 'nem em perfil de outra conta');
select lives_ok($$select public.catalogo_criar_item('produto', 'a0000000-0000-0000-0000-000000000002', 'Bolo', 'Bolo caseiro', '11111111-0000-0000-0000-000000000001', null, null, 'fixo', 5000, null, null)$$, 'catálogo simples: cria produto sem a Loja');
select lives_ok(format($q$update public.catalogo_item_versao set nome = 'Bolo 2', foto_path = 'item/%s/b.jpg' where id = %L$q$,
  t.item('a0000000-0000-0000-0000-000000000002', 'produto'), t.vers(t.item('a0000000-0000-0000-0000-000000000002', 'produto'), 'rascunho')), 'catálogo simples: edita o rascunho como hoje');
select throws_ok(format($q$update public.catalogo_item_versao set fotos_extras_paths = array['item/%s/x.jpg'] where id = %L$q$,
  t.item('a0000000-0000-0000-0000-000000000002', 'produto'), t.vers(t.item('a0000000-0000-0000-0000-000000000002', 'produto'), 'rascunho')), '42501', null, 'sem a Loja não há foto adicional');
select throws_ok(format($q$update public.catalogo_item_versao set quartos = 2 where id = %L$q$,
  t.vers(t.item('a0000000-0000-0000-0000-000000000002', 'produto'), 'rascunho')), '23514', null, 'campo de imóvel em produto é recusado');
select throws_ok(format($q$update public.catalogo_item_versao set bairro = 'Centro' where id = %L$q$,
  t.vers(t.item('a0000000-0000-0000-0000-000000000002', 'produto'), 'rascunho')), '23514', null, 'bairro também');
select is((select count(*)::int from public.loja_liberacao), 0, 'o dono vê que não tem a Loja');
reset role;

-- ===== Administrador geral libera P1; o dono cria imóvel e produto =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select lives_ok($$select public.loja_definir_liberacao('a0000000-0000-0000-0000-000000000001', true, 'Teste de imóveis')$$, 'administrador libera a Loja de P1');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is((select liberada from public.loja_liberacao where perfil_id = 'a0000000-0000-0000-0000-000000000001'), true, 'o dono vê que tem a Loja');
select lives_ok($$select public.catalogo_criar_item('imovel', 'a0000000-0000-0000-0000-000000000001', 'Apto Centro', 'Apartamento de 2 quartos', '11111111-0000-0000-0000-000000000001', null, null, 'fixo', 35000000, 'Porto Alegre', 'RS')$$, 'com a Loja o dono cria imóvel');
select lives_ok($$select public.catalogo_criar_item('produto', 'a0000000-0000-0000-0000-000000000001', 'Chaveiro', 'Chaveiro da imobiliária', '11111111-0000-0000-0000-000000000001', null, null, 'fixo', 1500, null, null)$$, 'e produto');

-- Valores fora da lista fechada ou da faixa
select throws_ok(format($q$update public.catalogo_item_versao set finalidade = 'permuta' where id = %L$q$, t.vers(t.item('a0000000-0000-0000-0000-000000000001', 'imovel'), 'rascunho')), '23514', null, 'finalidade só venda ou aluguel');
select throws_ok(format($q$update public.catalogo_item_versao set imovel_tipo = 'nave' where id = %L$q$, t.vers(t.item('a0000000-0000-0000-0000-000000000001', 'imovel'), 'rascunho')), '23514', null, 'tipo de imóvel da lista fechada');
select throws_ok(format($q$update public.catalogo_item_versao set quartos = -1 where id = %L$q$, t.vers(t.item('a0000000-0000-0000-0000-000000000001', 'imovel'), 'rascunho')), '23514', null, 'quartos não negativo');
select throws_ok(format($q$update public.catalogo_item_versao set area_m2 = 0 where id = %L$q$, t.vers(t.item('a0000000-0000-0000-0000-000000000001', 'imovel'), 'rascunho')), '23514', null, 'área maior que zero');
select throws_ok(format($q$update public.catalogo_item_versao set condominio_centavos = -5 where id = %L$q$, t.vers(t.item('a0000000-0000-0000-0000-000000000001', 'imovel'), 'rascunho')), '23514', null, 'condomínio não negativo');
select throws_ok(format($q$update public.catalogo_item_versao set bairro = 'X' where id = %L$q$, t.vers(t.item('a0000000-0000-0000-0000-000000000001', 'imovel'), 'rascunho')), '23514', null, 'bairro com tamanho mínimo');

-- Imóvel incompleto não é enviado (sem bairro)
select lives_ok(format($q$update public.catalogo_item_versao set foto_path = 'item/%s/apto.jpg', imovel_tipo = 'apartamento', finalidade = 'venda',
  area_m2 = 72.5, quartos = 2, banheiros = 1, vagas = 1, condominio_centavos = 45000, iptu_centavos = 120000, aceita_financiamento = true,
  fotos_extras_paths = array['item/%s/g1.jpg', 'item/%s/g2.jpg'] where id = %L$q$,
  t.item('a0000000-0000-0000-0000-000000000001', 'imovel'), t.item('a0000000-0000-0000-0000-000000000001', 'imovel'),
  t.item('a0000000-0000-0000-0000-000000000001', 'imovel'), t.vers(t.item('a0000000-0000-0000-0000-000000000001', 'imovel'), 'rascunho')),
  'com a Loja o dono grava campos do imóvel e fotos adicionais');
select throws_like(format($q$select public.catalogo_enviar_item_versao(%L)$q$, t.vers(t.item('a0000000-0000-0000-0000-000000000001', 'imovel'), 'rascunho')),
  '%imóvel exige%', 'imóvel sem bairro não é enviado');
select lives_ok(format($q$update public.catalogo_item_versao set bairro = '  Centro Histórico ' where id = %L$q$, t.vers(t.item('a0000000-0000-0000-0000-000000000001', 'imovel'), 'rascunho')), 'bairro informado');
select lives_ok(format($q$select public.catalogo_enviar_item_versao(%L)$q$, t.vers(t.item('a0000000-0000-0000-0000-000000000001', 'imovel'), 'rascunho')), 'imóvel completo é enviado para aprovação');

-- Foto adicional: limite, pasta do item, repetição
select throws_ok(format($q$update public.catalogo_item_versao set fotos_extras_paths = (select array_agg('item/%s/f' || g || '.jpg') from generate_series(1, 9) g) where id = %L$q$,
  t.item('a0000000-0000-0000-0000-000000000001', 'produto'), t.vers(t.item('a0000000-0000-0000-0000-000000000001', 'produto'), 'rascunho')), '23514', null, 'no máximo 8 fotos adicionais');
select throws_ok(format($q$update public.catalogo_item_versao set fotos_extras_paths = array['item/00000000-0000-0000-0000-000000000000/x.jpg'] where id = %L$q$,
  t.vers(t.item('a0000000-0000-0000-0000-000000000001', 'produto'), 'rascunho')), '23514', null, 'foto adicional só na pasta do próprio item');
select throws_ok(format($q$update public.catalogo_item_versao set fotos_extras_paths = array['item/%s/a.jpg', 'item/%s/a.jpg'] where id = %L$q$,
  t.item('a0000000-0000-0000-0000-000000000001', 'produto'), t.item('a0000000-0000-0000-0000-000000000001', 'produto'),
  t.vers(t.item('a0000000-0000-0000-0000-000000000001', 'produto'), 'rascunho')), '23514', null, 'foto adicional repetida é recusada');
select throws_ok(format($q$update public.catalogo_item_versao set quartos = 2 where id = %L$q$,
  t.vers(t.item('a0000000-0000-0000-0000-000000000001', 'produto'), 'rascunho')), '23514', null, 'produto da Loja não recebe campo de imóvel');
select lives_ok(format($q$update public.catalogo_item_versao set foto_path = 'item/%s/p.jpg', fotos_extras_paths = array['item/%s/e1.jpg', 'item/%s/e2.jpg'] where id = %L$q$,
  t.item('a0000000-0000-0000-0000-000000000001', 'produto'), t.item('a0000000-0000-0000-0000-000000000001', 'produto'),
  t.item('a0000000-0000-0000-0000-000000000001', 'produto'), t.vers(t.item('a0000000-0000-0000-0000-000000000001', 'produto'), 'rascunho')),
  'produto da Loja grava galeria');
select lives_ok(format($q$select public.catalogo_enviar_item_versao(%L)$q$, t.vers(t.item('a0000000-0000-0000-0000-000000000001', 'produto'), 'rascunho')), 'produto enviado');
select is(public.catalogo_imagem_em_uso(format('item/%s/e1.jpg', t.item('a0000000-0000-0000-0000-000000000001', 'produto'))), true, 'foto adicional em versão pendente não pode ser apagada');
reset role;

-- Antes da aprovação nada é público
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.loja_item_publico), 0, 'pendente não aparece na Loja pública');
select is(public.catalogo_imagem_publica(format('item/%s/e1.jpg', t.item('a0000000-0000-0000-0000-000000000001', 'produto'))), false, 'nem a foto adicional');
reset role;

-- ===== Aprovação (IM-021) e publicação =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select lives_ok(format($q$select public.catalogo_decidir_item_versao(%L, true, null)$q$, t.vers(t.item('a0000000-0000-0000-0000-000000000001', 'imovel'), 'pendente')), 'administrador aprova o imóvel');
select lives_ok(format($q$select public.catalogo_decidir_item_versao(%L, true, null)$q$, t.vers(t.item('a0000000-0000-0000-0000-000000000001', 'produto'), 'pendente')), 'e o produto');
reset role;

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.loja_item_publico), 0, 'aprovado mas ainda não publicado: não aparece');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok(format($q$update public.catalogo_item set publicado = true where id = %L$q$, t.item('a0000000-0000-0000-0000-000000000001', 'imovel')), 'dono publica o imóvel');
select lives_ok(format($q$update public.catalogo_item set publicado = true where id = %L$q$, t.item('a0000000-0000-0000-0000-000000000001', 'produto')), 'e o produto');
select is((select count(*)::int from public.catalogo_meus_itens), 3, 'o dono lista os próprios 3 itens (2 de P1, 1 de P2)');
reset role;

-- ===== Leitura pública =====
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.loja_item_publico), 2, 'anon vê imóvel e produto da Loja');
select is((select count(*)::int from public.loja_item_publico where tipo = 'imovel' and bairro = 'Centro Histórico' and cidade = 'Porto Alegre' and uf = 'RS'), 1, 'imóvel mostra bairro (aparado), cidade e UF');
select is((select cardinality(fotos_extras_paths) from public.loja_item_publico where tipo = 'imovel'), 2, 'imóvel traz as fotos adicionais');
select is((select count(*)::int from public.catalogo_item_publico where tipo = 'imovel'), 0, 'imóvel nunca entra na visão do catálogo simples');
select is((select count(*)::int from public.catalogo_item_publico where tipo = 'produto'), 1, 'produto da Loja segue no catálogo simples');
select is((select count(*)::int from public.busca_publica() where o_tipo = 'imovel'), 0, 'busca geral não lista imóvel');
select is((select count(*)::int from public.busca_publica() where o_tipo = 'produto'), 1, 'mas segue listando o produto');
select is(public.catalogo_imagem_publica(format('item/%s/e1.jpg', t.item('a0000000-0000-0000-0000-000000000001', 'produto'))), true, 'foto adicional de item no ar é pública');
select is((select count(*)::int from public.loja_listar_imoveis()), 1, 'lista de imóveis');
select is((select o_total from public.loja_listar_imoveis()), 1::bigint, 'com o total');
select is((select count(*)::int from public.loja_listar_imoveis(p_finalidade => 'venda')), 1, 'filtro: venda');
select is((select count(*)::int from public.loja_listar_imoveis(p_finalidade => 'aluguel')), 0, 'filtro: aluguel');
select is((select count(*)::int from public.loja_listar_imoveis(p_imovel_tipo => 'apartamento')), 1, 'filtro: tipo apartamento');
select is((select count(*)::int from public.loja_listar_imoveis(p_imovel_tipo => 'casa')), 0, 'filtro: tipo casa');
select is((select count(*)::int from public.loja_listar_imoveis(p_preco_min => 30000000, p_preco_max => 40000000)), 1, 'filtro: faixa de preço contém');
select is((select count(*)::int from public.loja_listar_imoveis(p_preco_max => 1000)), 0, 'filtro: faixa de preço não contém');
select is((select count(*)::int from public.loja_listar_imoveis(p_quartos_min => 2)), 1, 'filtro: quartos mínimos 2');
select is((select count(*)::int from public.loja_listar_imoveis(p_quartos_min => 3)), 0, 'filtro: quartos mínimos 3');
select is((select count(*)::int from public.loja_listar_imoveis(p_uf => 'rs', p_cidade => 'PORTO alegre', p_bairro => 'centro historico')), 1, 'filtro: UF, cidade e bairro sem acento e caixa');
select is((select count(*)::int from public.loja_listar_imoveis(p_uf => 'SP')), 0, 'filtro: outra UF');
select is((select count(*)::int from public.loja_listar_imoveis(p_perfil_id => 'a0000000-0000-0000-0000-000000000001')), 1, 'filtro: página do negócio');
select is((select count(*)::int from public.loja_listar_imoveis(p_perfil_id => 'a0000000-0000-0000-0000-000000000003')), 0, 'filtro: perfil sem Loja');
select is((select count(*)::int from public.loja_listar_imoveis(p_limite => 0, p_pagina => -4)), 1, 'limite e página fora da faixa são ajustados');
select throws_ok($$select * from public.loja_listar_imoveis(p_finalidade => 'permuta')$$, '22023', null, 'finalidade inválida');
select throws_ok($$select * from public.loja_listar_imoveis(p_imovel_tipo => 'nave')$$, '22023', null, 'tipo inválido');
select throws_ok($$select * from public.loja_listar_imoveis(p_uf => 'RS1')$$, '22023', null, 'UF inválida');
select throws_ok($$select * from public.loja_listar_imoveis(p_preco_min => 10, p_preco_max => 5)$$, '22023', null, 'faixa invertida');
select throws_ok($$select * from public.loja_listar_imoveis(p_preco_min => -1)$$, '22023', null, 'preço negativo');
select throws_ok($$select * from public.loja_listar_imoveis(p_quartos_min => 99)$$, '22023', null, 'quartos fora da faixa');
select is((select count(*)::int from public.loja_liberacao), 1, 'anon só sabe das Lojas liberadas de perfis no ar');
reset role;

-- ===== Retirar a Loja: some da leitura pública, nada é despublicado; escrita nova é recusada =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select lives_ok($$select public.loja_definir_liberacao('a0000000-0000-0000-0000-000000000001', false, 'Pausa no teste')$$, 'administrador retira a Loja');
reset role;
select is((select publicado from public.catalogo_item where id = t.item('a0000000-0000-0000-0000-000000000001', 'imovel')), true, 'retirar a Loja não despublica o item');

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.loja_item_publico), 0, 'sem a Loja a visão pública fica vazia');
select is((select count(*)::int from public.loja_listar_imoveis()), 0, 'e a lista de imóveis também');
select is((select count(*)::int from public.catalogo_item_publico where tipo = 'produto'), 1, 'produto segue no catálogo simples');
select is(public.catalogo_imagem_publica(format('item/%s/e1.jpg', t.item('a0000000-0000-0000-0000-000000000001', 'produto'))), false, 'foto adicional deixa de ser pública');
select is(public.catalogo_imagem_publica(format('item/%s/p.jpg', t.item('a0000000-0000-0000-0000-000000000001', 'produto'))), true, 'a foto principal do catálogo simples segue pública');
select is((select count(*)::int from public.catalogo_item_versao v join public.catalogo_item i on i.id = v.item_id where i.tipo = 'imovel'), 0, 'leitura direta da tabela de versões: anon não lê imóvel sem a Loja');
select is((select count(*)::int from public.catalogo_item_versao v join public.catalogo_item i on i.id = v.item_id where i.tipo = 'produto'), 1, 'e o produto segue legível (retirar não despublica)');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is((select count(*)::int from public.catalogo_item_versao v join public.catalogo_item i on i.id = v.item_id where i.tipo = 'imovel'), 0, 'usuário que não é dono também não lê imóvel sem a Loja');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is((select count(*)::int from public.catalogo_item_versao v join public.catalogo_item i on i.id = v.item_id where i.tipo = 'imovel' and i.perfil_id = 'a0000000-0000-0000-0000-000000000001'), 1, 'o dono segue lendo o próprio imóvel sem a Loja');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok($$select public.catalogo_criar_item('imovel', 'a0000000-0000-0000-0000-000000000001', 'Casa', 'Casa com pátio', '11111111-0000-0000-0000-000000000001', null, null, 'fixo', 50000000, 'Porto Alegre', 'RS')$$, '42501', null, 'sem a Loja não cria imóvel novo');
select throws_ok(format($q$insert into public.catalogo_item_versao (item_id, nome) values (%L, 'Nova edição')$q$, t.item('a0000000-0000-0000-0000-000000000001', 'imovel')), '42501', null, 'nem edição nova de imóvel');
select is((select liberada from public.loja_liberacao where perfil_id = 'a0000000-0000-0000-0000-000000000001'), false, 'o dono vê que perdeu a Loja');
reset role;

-- ===== Re-liberar; edição aprovada de item DESPUBLICADO não republica (IM-022) =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select lives_ok($$select public.loja_definir_liberacao('a0000000-0000-0000-0000-000000000001', true, 'Volta ao teste')$$, 'administrador libera de novo');
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.loja_item_publico), 2, 're-liberar traz de volta o que o dono já tinha publicado');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok(format($q$update public.catalogo_item set publicado = false where id = %L$q$, t.item('a0000000-0000-0000-0000-000000000001', 'imovel')), 'dono despublica o imóvel');
select lives_ok(format($q$insert into public.catalogo_item_versao (item_id, nome, descricao, foto_path, categoria_principal_id, imovel_tipo, finalidade,
  area_m2, quartos, banheiros, vagas, bairro, cidade, uf, preco_modo, preco_centavos)
  values (%L, 'Apto Centro v2', 'Apartamento reformado', 'item/%s/apto2.jpg', '11111111-0000-0000-0000-000000000001', 'apartamento', 'venda',
  72.5, 3, 2, 1, 'Centro Histórico', 'Porto Alegre', 'RS', 'fixo', 38000000)$q$,
  t.item('a0000000-0000-0000-0000-000000000001', 'imovel'), t.item('a0000000-0000-0000-0000-000000000001', 'imovel')), 'dono edita o imóvel (nova versão)');
select lives_ok(format($q$select public.catalogo_enviar_item_versao(%L)$q$, t.vers(t.item('a0000000-0000-0000-0000-000000000001', 'imovel'), 'rascunho')), 'e envia a edição');
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.loja_item_publico where tipo = 'imovel'), 0, 'despublicado e com edição pendente: nada público');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select lives_ok(format($q$select public.catalogo_decidir_item_versao(%L, true, null)$q$, t.vers(t.item('a0000000-0000-0000-0000-000000000001', 'imovel'), 'pendente')), 'administrador aprova a edição');
reset role;
select is((select publicado from public.catalogo_item where id = t.item('a0000000-0000-0000-0000-000000000001', 'imovel')), false, 'aprovar a edição NÃO republica o item despublicado');
select is((select quartos from public.catalogo_item_versao v join public.catalogo_item i on i.versao_aprovada_id = v.id where i.id = t.item('a0000000-0000-0000-0000-000000000001', 'imovel')), 3::smallint, 'a versão nova é a aprovada');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok(format($q$update public.catalogo_item set publicado = true where id = %L$q$, t.item('a0000000-0000-0000-0000-000000000001', 'imovel')), 'dono republica por vontade própria');
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.loja_listar_imoveis(p_quartos_min => 3)), 1, 'o público vê a versão nova');
reset role;

-- Versão aprovada é imutável (vale até para superusuário)
select throws_ok(format($q$update public.catalogo_item_versao set quartos = 9 where id = %L$q$,
  (select versao_aprovada_id from public.catalogo_item where id = t.item('a0000000-0000-0000-0000-000000000001', 'imovel'))), '42501', null, 'versão aprovada não muda');

-- ===== Outra conta não lê nem altera =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is((select count(*)::int from public.catalogo_meus_itens), 0, 'C não lista itens de A');
select is((select count(*)::int from public.catalogo_item_versao where item_id = t.item('a0000000-0000-0000-0000-000000000001', 'imovel') and situacao <> 'aprovada'), 0, 'C não lê versões não aprovadas de A');
select lives_ok(format($q$update public.catalogo_item set publicado = false where id = %L$q$, t.item('a0000000-0000-0000-0000-000000000001', 'imovel')), 'C tenta despublicar item de A (nenhuma linha atingida)');
select lives_ok(format($q$update public.catalogo_item_versao set quartos = 9 where item_id = %L$q$, t.item('a0000000-0000-0000-0000-000000000001', 'imovel')), 'C tenta alterar versão de A (nenhuma linha atingida)');
select throws_ok($$select public.loja_definir_liberacao('a0000000-0000-0000-0000-000000000003', true, 'quero')$$, '42501', null, 'C não se autoriza');
select throws_ok($$select public.catalogo_criar_item('imovel', 'a0000000-0000-0000-0000-000000000003', 'Casa', 'Casa', '11111111-0000-0000-0000-000000000001', null, null, 'fixo', 100000, 'Canoas', 'RS')$$, '42501', null, 'C sem Loja não cria imóvel');
reset role;
select is((select publicado from public.catalogo_item where id = t.item('a0000000-0000-0000-0000-000000000001', 'imovel')), true, 'o item de A continua publicado');
select is((select count(*)::int from public.catalogo_item_versao where item_id = t.item('a0000000-0000-0000-0000-000000000001', 'imovel') and quartos = 9), 0, 'e nenhuma versão de A foi alterada');

-- ===== Auditoria da liberação (autor, motivo, valor anterior) =====
select is((select array_agg(acao order by id) from public.administracao_auditoria where alvo_tabela = 'loja_liberacao' and alvo_id = 'a0000000-0000-0000-0000-000000000001'),
  array['liberar_loja', 'retirar_loja', 'liberar_loja'], 'liberar, retirar e liberar ficam na auditoria, na ordem');
select is((select count(*)::int from public.administracao_auditoria where alvo_tabela = 'loja_liberacao' and (motivo is null or autor_id <> 'dddddddd-0000-0000-0000-00000000000d')), 0, 'todas com motivo e autor');

select * from finish();
rollback;
