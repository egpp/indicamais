-- pgTAP · busca e filtros públicos (página inicial) · IM-019, IM-016, IM-029, IM-079, IM-086
-- A busca só enxerga o conteúdo aprovado + publicado (e perfil disponível), ignora acentos e caixa, impõe teto de
-- página e não devolve dado privado.
begin;
select * from no_plan();
-- A migração de seed cria as 8 categorias da D-006; este teste monta as suas.
delete from public.catalogo_categoria;

insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@teste.local'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@teste.local');
insert into public.catalogo_categoria (id, nome, slug, ativa, ordem) values
  ('11111111-0000-0000-0000-000000000001', 'Alimentação', 'alimentacao', true, 1),
  ('11111111-0000-0000-0000-000000000002', 'Beleza e estética', 'beleza-e-estetica', true, 2),
  ('11111111-0000-0000-0000-000000000003', 'Tecnologia', 'tecnologia', true, 3);

-- Perfis (todos da conta A)
insert into public.perfis_perfil (id, responsavel_id, slug) values
  ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a', 'padaria-sao-joao'),
  ('a0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-00000000000a', 'acai-do-ze'),
  ('a0000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-00000000000a', 'rascunho-shop'),
  ('a0000000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-00000000000a', 'loja-antiga'),
  ('a0000000-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-00000000000a', 'rejeitada-loja'),
  ('a0000000-0000-0000-0000-000000000006', 'aaaaaaaa-0000-0000-0000-00000000000a', 'despublicada-loja');

-- P1: Padaria São João (categoria principal Alimentação, secundária Beleza), Porto Alegre/RS, com WhatsApp comercial.
insert into public.perfis_perfil_versao (id, perfil_id, nome, descricao_breve, imagem_path, categoria_principal_id, categoria_secundaria_1_id, cidade, uf)
values ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Padaria São João', 'Pães e doces',
        'perfil/a0000000-0000-0000-0000-000000000001/capa.jpg', '11111111-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000002', 'Porto Alegre', 'RS');
insert into public.perfis_perfil_versao_contato (versao_id, whatsapp_comercial_e164) values ('a1000000-0000-0000-0000-000000000001', '+5551999990001');
update public.perfis_perfil_versao set situacao = 'pendente', enviada_em = now() where id = 'a1000000-0000-0000-0000-000000000001';
update public.perfis_perfil_versao set situacao = 'aprovada' where id = 'a1000000-0000-0000-0000-000000000001';

insert into public.perfis_perfil_versao (id, perfil_id, situacao, enviada_em, nome, descricao_breve, imagem_path, categoria_principal_id, cidade, uf) values
  ('a1000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'aprovada', now(), 'Açaí do Zé', 'Açaí na tigela', 'perfil/a0000000-0000-0000-0000-000000000002/capa.jpg', '11111111-0000-0000-0000-000000000001', 'São Paulo', 'SP'),
  ('a1000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000004', 'aprovada', now(), 'Antigo Nome', 'Conserto de celular', 'perfil/a0000000-0000-0000-0000-000000000004/capa.jpg', '11111111-0000-0000-0000-000000000003', 'Canoas', 'RS'),
  ('a1000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000005', 'rejeitada', now(), 'Rejeitada Loja', 'Foi rejeitada', 'perfil/a0000000-0000-0000-0000-000000000005/capa.jpg', '11111111-0000-0000-0000-000000000001', 'Porto Alegre', 'RS'),
  ('a1000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000006', 'aprovada', now(), 'Despublicada Loja', 'Fora do ar', 'perfil/a0000000-0000-0000-0000-000000000006/capa.jpg', '11111111-0000-0000-0000-000000000001', 'Porto Alegre', 'RS');
-- P3 só rascunho; P4 com edição pendente que NÃO pode vazar para a busca
insert into public.perfis_perfil_versao (id, perfil_id, nome, descricao_breve, imagem_path, categoria_principal_id, cidade, uf)
values ('a1000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', 'Rascunho Shop', 'Ainda rascunho', 'perfil/a0000000-0000-0000-0000-000000000003/capa.jpg', '11111111-0000-0000-0000-000000000001', 'Porto Alegre', 'RS');
insert into public.perfis_perfil_versao (id, perfil_id, situacao, enviada_em, nome, descricao_breve, imagem_path, categoria_principal_id, cidade, uf)
values ('a1000000-0000-0000-0000-000000000014', 'a0000000-0000-0000-0000-000000000004', 'pendente', now(), 'Novo Nome Pendente', 'Edição pendente', 'perfil/a0000000-0000-0000-0000-000000000004/capa2.jpg', '11111111-0000-0000-0000-000000000003', 'Canoas', 'RS');
update public.perfis_perfil set versao_aprovada_id = 'a1000000-0000-0000-0000-000000000001', publicado = true where id = 'a0000000-0000-0000-0000-000000000001';
update public.perfis_perfil set versao_aprovada_id = 'a1000000-0000-0000-0000-000000000002', publicado = true where id = 'a0000000-0000-0000-0000-000000000002';
update public.perfis_perfil set versao_aprovada_id = 'a1000000-0000-0000-0000-000000000004', publicado = true where id = 'a0000000-0000-0000-0000-000000000004';
update public.perfis_perfil set versao_aprovada_id = 'a1000000-0000-0000-0000-000000000006', publicado = false where id = 'a0000000-0000-0000-0000-000000000006';

-- Itens
--   I1 produto de P1 (visível) | I2 serviço de P1 (visível) | I3 item de P6 (perfil despublicado)
--   I4 anúncio particular (visível) | I5 aprovado mas despublicado | I6 só pendente | I7 só rejeitado
insert into public.catalogo_item (id, conta_id, perfil_id, tipo) values
  ('e0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000001', 'produto'),
  ('e0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000001', 'servico'),
  ('e0000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000006', 'produto'),
  ('e0000000-0000-0000-0000-000000000004', 'bbbbbbbb-0000-0000-0000-00000000000b', null, 'produto'),
  ('e0000000-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000001', 'produto'),
  ('e0000000-0000-0000-0000-000000000006', 'bbbbbbbb-0000-0000-0000-00000000000b', null, 'produto'),
  ('e0000000-0000-0000-0000-000000000007', 'bbbbbbbb-0000-0000-0000-00000000000b', null, 'produto');
insert into public.catalogo_item_versao (id, item_id, situacao, enviada_em, nome, descricao, foto_path, categoria_principal_id, preco_modo, preco_centavos) values
  ('e1000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'aprovada', now(), 'Pão Francês', repeat('Pão fresquinho todo dia. ', 40), 'item/e0000000-0000-0000-0000-000000000001/f.jpg', '11111111-0000-0000-0000-000000000001', 'fixo', 150),
  ('e1000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000002', 'aprovada', now(), 'Entrega Rápida', 'Entregamos na sua casa', 'item/e0000000-0000-0000-0000-000000000002/f.jpg', '11111111-0000-0000-0000-000000000002', 'sob_consulta', null),
  ('e1000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000003', 'aprovada', now(), 'Item do Despublicado', 'Perfil fora do ar', 'item/e0000000-0000-0000-0000-000000000003/f.jpg', '11111111-0000-0000-0000-000000000001', null, null),
  ('e1000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000004', 'aprovada', now(), 'Bicicleta Usada', 'Aro 26, bom estado', 'item/e0000000-0000-0000-0000-000000000004/f.jpg', '11111111-0000-0000-0000-000000000003', 'a_partir_de', 35000),
  ('e1000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000005', 'aprovada', now(), 'Item Despublicado', 'Dono despublicou', 'item/e0000000-0000-0000-0000-000000000005/f.jpg', '11111111-0000-0000-0000-000000000001', null, null),
  ('e1000000-0000-0000-0000-000000000006', 'e0000000-0000-0000-0000-000000000006', 'pendente', now(), 'Item Pendente', 'Aguardando', 'item/e0000000-0000-0000-0000-000000000006/f.jpg', '11111111-0000-0000-0000-000000000001', null, null),
  ('e1000000-0000-0000-0000-000000000007', 'e0000000-0000-0000-0000-000000000007', 'rejeitada', now(), 'Item Rejeitado', 'Foi rejeitado', 'item/e0000000-0000-0000-0000-000000000007/f.jpg', '11111111-0000-0000-0000-000000000001', null, null);
update public.catalogo_item set versao_aprovada_id = ('e1000000-0000-0000-0000-00000000000' || right(id::text, 1))::uuid, publicado = true
 where id in ('e0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000004');
update public.catalogo_item set versao_aprovada_id = 'e1000000-0000-0000-0000-000000000005', publicado = false where id = 'e0000000-0000-0000-0000-000000000005';

-- ===== Contrato de colunas =====
select is((select proargnames from pg_proc where oid = 'public.busca_publica(text,text,uuid,text,text,integer,integer)'::regprocedure),
  array['p_termo', 'p_tipo', 'p_categoria_id', 'p_uf', 'p_cidade', 'p_limite', 'p_pagina',
        'o_tipo', 'o_id', 'o_slug', 'o_perfil_id', 'o_perfil_slug', 'o_nome', 'o_descricao', 'o_imagem_path',
        'o_categoria_id', 'o_categoria_nome', 'o_categoria_slug', 'o_cidade', 'o_uf', 'o_preco_modo', 'o_preco_centavos', 'o_total'],
  'a busca devolve só as colunas de card (sem WhatsApp, responsável, e-mail nem conta)');
select is((select prosecdef from pg_proc where oid = 'public.busca_publica(text,text,uuid,text,text,integer,integer)'::regprocedure), false, 'a busca roda com os direitos de quem chama (RLS vale)');

-- ===== anon: conteúdo visível =====
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.busca_publica()), 6, 'sem filtro: 3 perfis e 3 itens públicos');
select is((select array_agg(o_nome order by public.busca_normalizar(o_nome)) from public.busca_publica()),
  array['Açaí do Zé', 'Antigo Nome', 'Bicicleta Usada', 'Entrega Rápida', 'Padaria São João', 'Pão Francês'], 'só aprovado + publicado (nome da versão aprovada)');
select is((select array_agg(o_nome) from public.busca_publica()),
  array['Açaí do Zé', 'Antigo Nome', 'Bicicleta Usada', 'Entrega Rápida', 'Padaria São João', 'Pão Francês'], 'ordem estável por nome sem acentos');
select is((select o_total from public.busca_publica() limit 1), 6::bigint, 'o_total traz o total do filtro');
select is((select count(*)::int from public.busca_publica() where o_nome ~* '(rascunho|pendente|rejeitad|despublicad)'), 0, 'não retorna rascunho, pendente, rejeitado nem despublicado');
select is((select count(*)::int from public.busca_publica('Novo Nome Pendente')), 0, 'edição pendente de perfil publicado não vaza');
select is((select count(*)::int from public.busca_publica('Item do Despublicado')), 0, 'item de perfil indisponível não aparece (IM-079)');
select is((select count(*)::int from public.busca_publica('Item Despublicado')), 0, 'item despublicado pelo dono não aparece');
select is((select count(*)::int from public.busca_publica('Item Pendente')) + (select count(*)::int from public.busca_publica('Item Rejeitado')) + (select count(*)::int from public.busca_publica('Rascunho Shop')) + (select count(*)::int from public.busca_publica('Rejeitada Loja')), 0, 'pendente, rejeitado e rascunho nunca aparecem, nem buscando pelo nome exato');

-- Acentos, caixa e espaços
select is((select array_agg(o_nome) from public.busca_publica('sao joao')), array['Padaria São João'], 'sem acento acha com acento');
select is((select array_agg(o_nome) from public.busca_publica('SÃO JOÃO')), array['Padaria São João'], 'caixa alta com acento');
select is((select array_agg(o_nome) from public.busca_publica('acai')), array['Açaí do Zé'], 'acai acha Açaí');
select is((select array_agg(o_nome) from public.busca_publica('AÇAÍ DO ZE')), array['Açaí do Zé'], 'AÇAÍ DO ZE acha Açaí do Zé');
select is((select array_agg(o_nome) from public.busca_publica('  pao    frances  ')), array['Pão Francês'], 'espaços repetidos e nas pontas são ignorados');
select is((select array_agg(o_nome) from public.busca_publica('RÁPIDA')), array['Entrega Rápida'], 'maiúscula acentuada acha minúscula');
select is(public.busca_normalizar('  ÁÉÍÓÚ Çã  ÑÜ  '), 'aeiou ca nu', 'normalização de acentos, caixa e espaços');

-- Tipo
select is((select count(*)::int from public.busca_publica(null, 'perfil')), 3, 'tipo perfil');
select is((select array_agg(o_nome order by public.busca_normalizar(o_nome)) from public.busca_publica(null, 'produto')), array['Bicicleta Usada', 'Pão Francês'], 'tipo produto');
select is((select array_agg(o_nome) from public.busca_publica(null, 'servico')), array['Entrega Rápida'], 'tipo serviço');
select is((select count(*)::int from public.busca_publica(null, 'todos')), 6, 'tipo todos');
select is((select count(*)::int from public.busca_publica(null, 'PRODUTO')), 2, 'tipo sem diferença de caixa');
select throws_ok($$select * from public.busca_publica(null, 'outro')$$, '22023', null, 'tipo inválido é recusado');

-- Categoria (principal ou secundária)
select is((select array_agg(o_nome order by public.busca_normalizar(o_nome)) from public.busca_publica(null, null, '11111111-0000-0000-0000-000000000001')), array['Açaí do Zé', 'Padaria São João', 'Pão Francês'], 'categoria principal');
select is((select array_agg(o_nome order by public.busca_normalizar(o_nome)) from public.busca_publica(null, null, '11111111-0000-0000-0000-000000000002')), array['Entrega Rápida', 'Padaria São João'], 'categoria secundária também filtra');
select is((select array_agg(o_nome order by public.busca_normalizar(o_nome)) from public.busca_publica(null, null, '11111111-0000-0000-0000-000000000003')), array['Antigo Nome', 'Bicicleta Usada'], 'categoria com perfil e anúncio particular');
select is((select count(*)::int from public.busca_publica(null, null, '99999999-0000-0000-0000-000000000009')), 0, 'categoria inexistente: nada');
select is((select o_categoria_nome from public.busca_publica('padaria')), 'Alimentação', 'o card traz a categoria principal');
select is((select o_categoria_slug from public.busca_publica('padaria')), 'alimentacao', 'e o slug da categoria');

-- UF e cidade
select is((select array_agg(o_nome order by public.busca_normalizar(o_nome)) from public.busca_publica(null, null, null, 'rs')), array['Antigo Nome', 'Entrega Rápida', 'Padaria São João', 'Pão Francês'], 'UF (caixa indiferente); item herda o local do perfil; anúncio particular sem local sai');
select is((select array_agg(o_nome) from public.busca_publica(null, null, null, 'SP')), array['Açaí do Zé'], 'UF SP');
select is((select count(*)::int from public.busca_publica(null, null, null, 'AM')), 0, 'UF sem resultado');
select throws_ok($$select * from public.busca_publica(null, null, null, 'R1')$$, '22023', null, 'UF malformada é recusada');
select throws_ok($$select * from public.busca_publica(null, null, null, 'RS; drop table x')$$, '22023', null, 'UF com SQL é recusada');
select is((select array_agg(o_nome order by public.busca_normalizar(o_nome)) from public.busca_publica(null, null, null, null, 'porto alegre')), array['Entrega Rápida', 'Padaria São João', 'Pão Francês'], 'cidade (caixa indiferente)');
select is((select array_agg(o_nome) from public.busca_publica(null, null, null, null, 'SAO PAULO')), array['Açaí do Zé'], 'cidade sem acento acha cidade com acento');
select is((select array_agg(o_nome) from public.busca_publica(null, null, null, null, 'São   Paulo')), array['Açaí do Zé'], 'cidade com espaços repetidos');
select is((select count(*)::int from public.busca_publica(null, null, null, null, 'porto')), 0, 'cidade é igualdade, não trecho');
select is((select array_agg(o_nome) from public.busca_publica('pao', 'produto', '11111111-0000-0000-0000-000000000001', 'RS', 'porto alegre')), array['Pão Francês'], 'filtros combinados');

-- Card enxuto e preço
select is((select o_slug from public.busca_publica('padaria')), 'padaria-sao-joao', 'perfil devolve slug');
select is((select o_perfil_slug from public.busca_publica('pao')), 'padaria-sao-joao', 'item de perfil devolve o slug do perfil');
select is((select o_perfil_id from public.busca_publica('bicicleta')), null, 'anúncio particular sem perfil');
select is((select o_preco_centavos from public.busca_publica('pao')), 150::bigint, 'preço em centavos');
select is((select o_preco_modo from public.busca_publica('bicicleta')), 'a_partir_de', 'modo de preço');
select is((select o_preco_centavos from public.busca_publica('entrega')), null, 'sob consulta sem valor');
select is((select char_length(o_descricao) <= 200 from public.busca_publica('pao')), true, 'descrição curta (até 200)');
select is((select o_imagem_path from public.busca_publica('padaria')), 'perfil/a0000000-0000-0000-0000-000000000001/capa.jpg', 'imagem: caminho opaco do perfil');
select is((select o_imagem_path from public.busca_publica('pao')), 'item/e0000000-0000-0000-0000-000000000001/f.jpg', 'imagem: caminho opaco do item');
select is((select count(*)::int from public.busca_publica() b where to_jsonb(b)::text ~* '(whatsapp|\+55|@teste|aaaaaaaa|bbbbbbbb|responsavel|conta_id|autor)'), 0, 'resultado sem WhatsApp, e-mail, responsável nem id de conta');

-- Entradas hostis
select is((select count(*)::int from public.busca_publica('%')), 0, '% não é curinga');
select is((select count(*)::int from public.busca_publica('_')), 0, '_ não é curinga');
select is((select count(*)::int from public.busca_publica('\')), 0, 'barra invertida não quebra');
select is((select count(*)::int from public.busca_publica('.*')), 0, 'regex não é interpretada');
select is((select count(*)::int from public.busca_publica('[a-z]+')), 0, 'classe de caracteres não é interpretada');
select is((select count(*)::int from public.busca_publica('''; drop table public.perfis_perfil; --')), 0, 'termo com SQL não injeta');
select is((select count(*)::int from public.busca_publica($q$" or 1=1 --$q$)), 0, 'aspas não injetam');
select is((select count(*)::int from public.busca_publica(repeat('x', 100000))), 0, 'termo gigante não quebra');
select is((select array_agg(o_nome) from public.busca_publica('padaria' || repeat(' ', 200) || 'zzz')), array['Padaria São João'], 'termo é truncado em 80 caracteres');
select is((select count(*)::int from public.busca_publica(null, null, null, null, repeat('x', 100000))), 0, 'cidade gigante não quebra');
select is((select count(*)::int from public.busca_publica('')), 6, 'termo vazio equivale a sem termo');
select is((select count(*)::int from public.busca_publica('   ')), 6, 'termo só de espaços equivale a sem termo');
reset role;
select is((select count(*)::int from public.perfis_perfil), 6, 'a tabela de perfis continua intacta depois das entradas hostis');

-- ===== Paginação =====
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select array_agg(o_nome) from public.busca_publica(null, null, null, null, null, 2, 1)), array['Açaí do Zé', 'Antigo Nome'], 'página 1 de tamanho 2');
select is((select array_agg(o_nome) from public.busca_publica(null, null, null, null, null, 2, 2)), array['Bicicleta Usada', 'Entrega Rápida'], 'página 2');
select is((select array_agg(o_nome) from public.busca_publica(null, null, null, null, null, 2, 3)), array['Padaria São João', 'Pão Francês'], 'página 3');
select is((select count(*)::int from public.busca_publica(null, null, null, null, null, 2, 4)), 0, 'depois da última página: vazio');
select is((select o_total from public.busca_publica(null, null, null, null, null, 2, 2) limit 1), 6::bigint, 'o_total independe da página');
select is((select count(*)::int from public.busca_publica(null, null, null, null, null, 0, 1)), 1, 'limite 0 vira 1');
select is((select count(*)::int from public.busca_publica(null, null, null, null, null, -5, 1)), 1, 'limite negativo vira 1');
select is((select array_agg(o_nome) from public.busca_publica(null, null, null, null, null, 2, 0)), array['Açaí do Zé', 'Antigo Nome'], 'página 0 vira 1');
select is((select count(*)::int from public.busca_publica(null, null, null, null, null, null, null)), 6, 'limite e página nulos usam o padrão');
select is((select count(*)::int from public.busca_publica(null, null, null, null, null, 2, 1000000)), 0, 'página enorme é limitada e devolve vazio, sem erro');
reset role;

-- Mais de 50 resultados: 60 perfis publicados em Canoas/RS (categoria Tecnologia)
insert into public.perfis_perfil (id, responsavel_id, slug)
select ('c' || lpad(g::text, 7, '0') || '-0000-0000-0000-000000000001')::uuid, 'aaaaaaaa-0000-0000-0000-00000000000a', 'gen-loja-' || lpad(g::text, 3, '0')
from generate_series(1, 60) g;
insert into public.perfis_perfil_versao (id, perfil_id, situacao, enviada_em, nome, descricao_breve, imagem_path, categoria_principal_id, cidade, uf)
select ('d' || lpad(g::text, 7, '0') || '-0000-0000-0000-000000000001')::uuid,
       ('c' || lpad(g::text, 7, '0') || '-0000-0000-0000-000000000001')::uuid, 'aprovada', now(),
       'Gen Loja ' || lpad(g::text, 3, '0'), 'Loja gerada', 'perfil/c' || lpad(g::text, 7, '0') || '-0000-0000-0000-000000000001/capa.jpg',
       '11111111-0000-0000-0000-000000000003', 'Canoas', 'RS'
from generate_series(1, 60) g;
update public.perfis_perfil p set versao_aprovada_id = v.id, publicado = true
  from public.perfis_perfil_versao v where v.perfil_id = p.id and p.slug like 'gen-loja-%';
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select o_total from public.busca_publica() limit 1), 66::bigint, 'agora há 66 resultados');
select is((select count(*)::int from public.busca_publica(null, null, null, null, null, 1000, 1)), 50, 'teto de 50 por página imposto no servidor');
select is((select count(*)::int from public.busca_publica(null, null, null, null, null, 51, 1)), 50, 'limite 51 também é cortado em 50');
select is((select count(*)::int from public.busca_publica()), 20, 'padrão de 20 por página');
select is((select count(distinct o_id)::int from (
    select o_id from public.busca_publica(null, null, null, null, null, 50, 1)
    union all select o_id from public.busca_publica(null, null, null, null, null, 50, 2)) x), 66, 'páginas 1 e 2 cobrem os 66 sem repetir nem pular (ordem estável)');
select is((select array_agg(o_id) from public.busca_publica(null, null, null, null, null, 10, 3)), (select array_agg(o_id) from public.busca_publica(null, null, null, null, null, 10, 3)), 'mesma consulta, mesma ordem');
reset role;

-- ===== Usuário autenticado vê o mesmo que o anon, não o rascunho alheio =====
update public.perfis_perfil p set publicado = false where p.slug like 'gen-loja-%';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((select count(*)::int from public.busca_publica()), 6, 'usuário logado vê só o conteúdo público (não o rascunho de A nem o próprio item pendente)');
select is((select count(*)::int from public.busca_publica('Item Pendente')), 0, 'nem o próprio item pendente aparece na busca pública');
reset role;

-- ===== IM-079 dinâmico: despublicar o perfil retira perfil e itens =====
update public.perfis_perfil set publicado = false where id = 'a0000000-0000-0000-0000-000000000001';
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select array_agg(o_nome order by public.busca_normalizar(o_nome)) from public.busca_publica()), array['Açaí do Zé', 'Antigo Nome', 'Bicicleta Usada'], 'perfil despublicado some, com os itens dele');
reset role;
update public.perfis_perfil set publicado = true where id = 'a0000000-0000-0000-0000-000000000001';
update public.catalogo_item set publicado = false where id = 'e0000000-0000-0000-0000-000000000001';
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.busca_publica('Pão Francês')), 0, 'despublicar o item o retira da busca');
reset role;

-- ===== Permissões =====
select is(has_function_privilege('anon', 'public.busca_publica(text,text,uuid,text,text,integer,integer)', 'execute'), true, 'anon executa a busca');
select is(has_function_privilege('anon', 'public.busca_normalizar(text)', 'execute'), true, 'anon executa a normalização (pura)');

select * from finish();
rollback;
