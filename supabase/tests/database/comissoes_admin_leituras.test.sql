-- pgTAP · leituras do administrador (negócios, assinaturas, pagamentos, comissões, vínculos, prazo) e nome público do negócio
-- para o indicador · Fase 7 · IM-061 a IM-073, IM-029, IM-041, IM-050, IM-086
-- Contas: A anunciante (P1 publicado, P2 não publicado), E anunciante de outro negócio, B indicador, C cliente, D administrador.
begin;
select * from no_plan();

insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@teste.local'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@teste.local'),
  ('cccccccc-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c@teste.local'),
  ('dddddddd-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd@teste.local'),
  ('eeeeeeee-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'e@teste.local');
insert into public.administracao_administrador (conta_id) values ('dddddddd-0000-0000-0000-00000000000d');

insert into public.perfis_perfil (id, responsavel_id, slug) values
  ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a', 'loja-um'),
  ('a0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-00000000000a', 'loja-dois'),
  ('a0000000-0000-0000-0000-000000000003', 'eeeeeeee-0000-0000-0000-00000000000e', 'loja-tres');
insert into public.catalogo_item (id, conta_id, perfil_id, tipo) values
  ('e0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000001', 'servico');
-- P1: perfil publicado com versão aprovada (nome público). P2 e P3 não são públicos.
insert into public.catalogo_categoria (id, nome, slug, ativa, ordem) values
  ('11111111-0000-0000-0000-000000000001', 'Alimentação', 'alimentacao', true, 1);
insert into public.perfis_perfil_versao (id, perfil_id, situacao, enviada_em, nome, descricao_breve, imagem_path, categoria_principal_id, cidade, uf) values
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'aprovada', now(), 'Loja Um Pública', 'Doces',
   'perfil/a0000000-0000-0000-0000-000000000001/c.jpg', '11111111-0000-0000-0000-000000000001', 'Porto Alegre', 'RS');
update public.perfis_perfil set versao_aprovada_id = 'b0000000-0000-0000-0000-000000000001', publicado = true
  where id = 'a0000000-0000-0000-0000-000000000001';

select set_config('t.m_1', (date_trunc('month', now() at time zone 'utc') - interval '1 month')::date::text, true);
select set_config('t.m_2', (date_trunc('month', now() at time zone 'utc') - interval '2 months')::date::text, true);

-- ===== Preparação feita pelo administrador (fluxo oficial) =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select set_config('t.hab', (select public.comissoes_definir_habilitacao('a0000000-0000-0000-0000-000000000001', true, 'solicitacao', 'Pedido do anunciante')::text), true);
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select set_config('t.of1', (select public.comissoes_criar_oferta('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'Plano mensal', 1000)::text), true);
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select set_config('t.vin', (select public.comissoes_registrar_vinculo('a0000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-00000000000b', 'cccccccc-0000-0000-0000-00000000000c', 'Indicação confirmada')::text), true);
select set_config('t.ass_b', (select public.comissoes_registrar_assinatura(current_setting('t.of1')::uuid, 'bbbbbbbb-0000-0000-0000-00000000000b', 5000, current_setting('t.m_2')::date, null, 'Contrato do indicador')::text), true);
select set_config('t.ass_c', (select public.comissoes_registrar_assinatura(current_setting('t.of1')::uuid, 'cccccccc-0000-0000-0000-00000000000c', 10000, current_setting('t.m_2')::date, null, 'Contrato do cliente')::text), true);
select set_config('t.pg1', (select public.comissoes_confirmar_pagamento(current_setting('t.ass_b')::uuid, current_setting('t.m_2')::date, 5000, 'Pix do indicador')::text), true);
select set_config('t.pg2', (select public.comissoes_confirmar_pagamento(current_setting('t.ass_b')::uuid, current_setting('t.m_1')::date, 5000, 'Pix do indicador')::text), true);
select set_config('t.pg3', (select public.comissoes_confirmar_pagamento(current_setting('t.ass_c')::uuid, current_setting('t.m_2')::date, 10000, 'Pix do cliente')::text), true);
reset role;

-- ===== Recusa: anon, indicador, anunciante e cliente =====
set local role anon;
select throws_ok($$select * from public.comissoes_admin_listar_negocios()$$, '42501', null, 'anon não lista negócios');
select throws_ok($$select * from public.comissoes_admin_listar_assinaturas()$$, '42501', null, 'anon não lista assinaturas');
select throws_ok($$select * from public.comissoes_admin_listar_pagamentos()$$, '42501', null, 'anon não lista pagamentos');
select throws_ok($$select * from public.comissoes_admin_listar_comissoes()$$, '42501', null, 'anon não lista comissões');
select throws_ok($$select * from public.comissoes_admin_listar_vinculos()$$, '42501', null, 'anon não lista vínculos');
select throws_ok($$select * from public.comissoes_admin_prazo_inadimplencia()$$, '42501', null, 'anon não lê o prazo');
select throws_ok($$select * from public.comissoes_meus_negocios_vinculados()$$, '42501', null, 'anon não lê os negócios do indicador');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok($$select * from public.comissoes_admin_listar_negocios()$$, '42501', null, 'anunciante não lista negócios');
select throws_ok($$select * from public.comissoes_admin_listar_assinaturas()$$, '42501', null, 'anunciante não lista assinaturas');
select throws_ok($$select * from public.comissoes_admin_listar_pagamentos()$$, '42501', null, 'anunciante não lista pagamentos');
select throws_ok($$select * from public.comissoes_admin_listar_comissoes()$$, '42501', null, 'anunciante não lista comissões');
select throws_ok($$select * from public.comissoes_admin_listar_vinculos()$$, '42501', null, 'anunciante não lista vínculos');
select throws_ok($$select * from public.comissoes_admin_prazo_inadimplencia()$$, '42501', null, 'anunciante não lê o prazo');
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select throws_ok($$select * from public.comissoes_admin_listar_negocios()$$, '42501', null, 'indicador não lista negócios');
select throws_ok($$select * from public.comissoes_admin_listar_assinaturas()$$, '42501', null, 'indicador não lista assinaturas');
select throws_ok($$select * from public.comissoes_admin_listar_pagamentos()$$, '42501', null, 'indicador não lista pagamentos');
select throws_ok($$select * from public.comissoes_admin_listar_comissoes()$$, '42501', null, 'indicador não lista comissões');
select throws_ok($$select * from public.comissoes_admin_listar_vinculos()$$, '42501', null, 'indicador não lista vínculos');
select throws_ok($$select * from public.comissoes_admin_prazo_inadimplencia()$$, '42501', null, 'indicador não lê o prazo');
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select throws_ok($$select * from public.comissoes_admin_listar_vinculos()$$, '42501', null, 'cliente não lista vínculos');
reset role;

-- ===== Administrador =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select throws_ok($$select * from public.comissoes_admin_listar_negocios('outro')$$, '22023', null, 'estado de negócio inválido');
select throws_ok($$select * from public.comissoes_admin_listar_assinaturas(null, 'outra')$$, '22023', null, 'situação de assinatura inválida');
select throws_ok($$select * from public.comissoes_admin_listar_pagamentos(null, 'outro')$$, '22023', null, 'estado de pagamento inválido');
select throws_ok($$select * from public.comissoes_admin_listar_comissoes(null, 'outro')$$, '22023', null, 'estado de comissão inválido');
select throws_ok($$select * from public.comissoes_admin_listar_vinculos(null, 'outra')$$, '22023', null, 'situação de vínculo inválida');

select is((select count(*)::int from public.comissoes_admin_listar_negocios()), 3, 'o administrador lista todos os negócios');
select is((select o_total from public.comissoes_admin_listar_negocios(null, null, 1, 0)), 3::bigint, 'o total independe da página');
select is((select count(*)::int from public.comissoes_admin_listar_negocios(null, null, 1, 0)), 1, 'paginação limita a página');
select is((select count(*)::int from public.comissoes_admin_listar_negocios('habilitado')), 1, 'filtro: só negócios habilitados');
select is((select count(*)::int from public.comissoes_admin_listar_negocios('nao_habilitado')), 2, 'filtro: negócios sem o módulo');
select is((select count(*)::int from public.comissoes_admin_listar_negocios(null, 'LOJA-um')), 1, 'busca por slug sem diferenciar caixa');
select is((select o_nome from public.comissoes_admin_listar_negocios('habilitado')), 'Loja Um Pública', 'nome público do negócio publicado');
select is((select o_origem from public.comissoes_admin_listar_negocios('habilitado')), 'solicitacao', 'origem da habilitação');
select ok((select o_estado_desde is not null from public.comissoes_admin_listar_negocios('habilitado')), 'habilitado desde quando');
select is((select o_nome from public.comissoes_admin_listar_negocios(null, 'loja-dois')), null, 'negócio não publicado vem sem nome público');

select is((select count(*)::int from public.comissoes_admin_listar_assinaturas()), 2, 'lista as assinaturas');
select is((select count(*)::int from public.comissoes_admin_listar_assinaturas('a0000000-0000-0000-0000-000000000003')), 0, 'filtro por negócio sem assinaturas');
select is((select o_situacao from public.comissoes_admin_listar_assinaturas(null, null, 1, 0) order by 1 limit 1), 'ativa', 'assinatura vigente é ativa');
select is((select o_oferta_nome from public.comissoes_admin_listar_assinaturas() limit 1), 'Plano mensal', 'traz o nome da oferta');
select is((select count(*)::int from public.comissoes_admin_listar_pagamentos()), 3, 'lista os pagamentos');
select is((select count(*)::int from public.comissoes_admin_listar_pagamentos(null, 'estornado')), 0, 'nenhum pagamento estornado ainda');
select is((select count(*)::int from public.comissoes_admin_listar_pagamentos(null, 'confirmado')), 3, 'filtro por estado do pagamento');
select is((select count(*)::int from public.comissoes_admin_listar_comissoes()), 1, 'uma comissão (a do cliente; o indicador está em dia)');
select is((select o_percentual_bp from public.comissoes_admin_listar_comissoes()), 1000, 'percentual congelado na comissão');
select is((select o_base_centavos from public.comissoes_admin_listar_comissoes()), 10000, 'base congelada na comissão');
select is((select o_estado from public.comissoes_admin_listar_comissoes()), 'gerada', 'estado do repasse');
select is((select o_revertida from public.comissoes_admin_listar_comissoes()), false, 'comissão sem reversão');
select is((select count(*)::int from public.comissoes_admin_listar_comissoes(null, 'paga')), 0, 'filtro por estado da comissão');
select is((select count(*)::int from public.comissoes_admin_listar_vinculos()), 1, 'lista os vínculos');
select is((select o_situacao from public.comissoes_admin_listar_vinculos()), 'ativo', 'vínculo ativo');
select is((select count(*)::int from public.comissoes_admin_listar_vinculos(null, 'encerrado')), 0, 'filtro: nenhum vínculo encerrado');
select is((select o_prazo_dias from public.comissoes_admin_prazo_inadimplencia()), 60, 'prazo atual de inadimplência: 60 dias');

reset role;

-- Privacidade: nenhuma coluna de nome, telefone ou e-mail
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace,
    unnest(coalesce(p.proargnames, array[]::text[])) a
  where n.nspname = 'public' and p.proname like 'comissoes\_admin\_%'
    and a ~* '(nome_completo|telefone|whatsapp|email|contato)'), 0, 'leituras do administrador não têm coluna de dado privado');
select is((select bool_or(has_function_privilege('anon', p.oid, 'EXECUTE'))
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and (p.proname like 'comissoes\_admin\_%' or p.proname = 'comissoes_meus_negocios_vinculados')),
  false, 'anon não executa as leituras novas');

-- ===== Indicador: nome público do negócio =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((select count(*)::int from public.comissoes_meus_negocios_vinculados()), 1, 'indicador vê só os negócios onde tem vínculo');
select is((select o_nome from public.comissoes_meus_negocios_vinculados()), 'Loja Um Pública', 'nome público do negócio nos avisos');
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is((select count(*)::int from public.comissoes_meus_negocios_vinculados()), 0, 'quem não é indicador não vê negócio algum');
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-0000-0000-00000000000e","role":"authenticated"}', true);
select is((select count(*)::int from public.comissoes_meus_negocios_vinculados()), 0, 'outro anunciante não vê vínculos alheios');
reset role;

select * from finish();
rollback;
