-- pgTAP · módulo notificacoes · avisos de inadimplência (indicador e anunciante) · IM-072, IM-051, IM-052, IM-053, IM-029,
-- IM-041, IM-050, IM-065, IM-068, D-029
-- Contas: A anunciante (P1), B indicador, C cliente do vínculo, D administrador, E outra conta sem relação.
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
  ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a', 'loja-um');
insert into public.catalogo_item (id, conta_id, perfil_id, tipo) values
  ('e0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000001', 'servico');
select set_config('t.m_1', (date_trunc('month', now() at time zone 'utc') - interval '1 month')::date::text, true);

-- ===== Estrutura =====
select is(has_table_privilege('anon', 'public.notificacoes_meus_avisos', 'SELECT'), false, 'anon continua sem acesso à visão de avisos');
select columns_are('public', 'notificacoes_meus_avisos', array['origem', 'origem_id', 'tipo', 'destino_tipo', 'destino_id', 'destino_nome',
  'ator_nome', 'criado_em', 'lida', 'lida_em'], 'colunas da visão inalteradas (sem conta_id, sem valores, sem referência de pessoa)');
select is((select valor from public.comissoes_parametro where chave = 'aviso_encerramento_antecedencia_dias'), 7, 'antecedência padrão do aviso: 7 dias');
select is((select count(*)::int from pg_constraint where conname = 'notificacoes_leitura_origem'
  and pg_get_constraintdef(oid) like '%inadimplencia%'), 1, 'a origem inadimplencia é aceita no estado de leitura');
select is((select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.notificacoes_leitura'::regclass), true, 'notificacoes_leitura segue com RLS forçada');

-- ===== Cenário: negócio habilitado, oferta, vínculo B -> C e assinatura de B no mês anterior SEM pagamento =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select public.comissoes_definir_habilitacao('a0000000-0000-0000-0000-000000000001', true, 'solicitacao', 'Pedido do anunciante');
select public.comissoes_definir_parametro('prazo_inadimplencia_dias', 365, 'Teste: prazo longo, ainda sem prazo próximo');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select set_config('t.of1', (select public.comissoes_criar_oferta('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'Plano mensal', 1000)::text), true);
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select set_config('t.vin', (select public.comissoes_registrar_vinculo('a0000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-00000000000b', 'cccccccc-0000-0000-0000-00000000000c', 'Indicação confirmada')::text), true);
select set_config('t.ass_b', (select public.comissoes_registrar_assinatura(current_setting('t.of1')::uuid, 'bbbbbbbb-0000-0000-0000-00000000000b', 5000, current_setting('t.m_1')::date, null, 'Contrato do indicador')::text), true);
select is((select count(*)::int from public.notificacoes_meus_avisos where origem = 'inadimplencia'), 0, 'o administrador não recebe aviso de inadimplência');
reset role;

-- ===== Atraso: indicador e anunciante recebem; os outros não =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((select count(*)::int from public.notificacoes_meus_avisos where origem = 'inadimplencia'), 1, 'indicador recebe um aviso (atraso; sem prazo próximo)');
select is((select tipo from public.notificacoes_meus_avisos where origem = 'inadimplencia'), 'inadimplencia_atraso_indicador', 'tipo do aviso do indicador');
select is((select ator_nome from public.notificacoes_meus_avisos where origem = 'inadimplencia'), null, 'sem nome de pessoa no aviso (IM-050)');
select is((select destino_id from public.notificacoes_meus_avisos where origem = 'inadimplencia'), 'a0000000-0000-0000-0000-000000000001'::uuid, 'destino = o negócio');
select set_config('t.av_b', (select origem_id::text from public.notificacoes_meus_avisos where origem = 'inadimplencia'), true);
select is((select origem_id::text from public.notificacoes_meus_avisos where origem = 'inadimplencia'), current_setting('t.av_b'), 'consultar de novo devolve o mesmo id (sem duplicar)');
select is(public.notificacoes_contar_nao_lidas(), 1, 'contador do indicador sobe');

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is((select count(*)::int from public.notificacoes_meus_avisos where origem = 'inadimplencia'), 1, 'anunciante recebe um aviso');
select is((select tipo from public.notificacoes_meus_avisos where origem = 'inadimplencia'), 'inadimplencia_atraso_negocio', 'tipo do aviso do anunciante');
select is((select ator_nome from public.notificacoes_meus_avisos where origem = 'inadimplencia'), null, 'o aviso do anunciante não identifica o indicador');
select set_config('t.av_a', (select origem_id::text from public.notificacoes_meus_avisos where origem = 'inadimplencia'), true);
select isnt(current_setting('t.av_a'), current_setting('t.av_b'), 'ids distintos por papel');
select throws_ok($$select public.notificacoes_marcar_lida('inadimplencia', current_setting('t.av_b')::uuid)$$, 'P0002', null, 'anunciante não marca o aviso do indicador');

select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is((select count(*)::int from public.notificacoes_meus_avisos where origem = 'inadimplencia'), 0, 'o cliente do vínculo não recebe aviso');
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-0000-0000-00000000000e","role":"authenticated"}', true);
select is((select count(*)::int from public.notificacoes_meus_avisos where origem = 'inadimplencia'), 0, 'conta sem relação não recebe aviso');
select throws_ok($$select public.notificacoes_marcar_lida('inadimplencia', current_setting('t.av_a')::uuid)$$, 'P0002', null, 'conta sem relação não marca aviso alheio (mensagem neutra)');
select is(public.notificacoes_contar_nao_lidas(), 0, 'e o contador dela não sobe');

-- ===== Leitura: marcar e manter marcada =====
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is(public.notificacoes_marcar_lida('inadimplencia', current_setting('t.av_b')::uuid), true, 'indicador marca como lido');
select is(public.notificacoes_marcar_lida('inadimplencia', current_setting('t.av_b')::uuid), false, 'marcar de novo é idempotente');
select is(public.notificacoes_contar_nao_lidas(), 0, 'contador volta a zero');
reset role;

-- ===== Prazo próximo: com prazo de 1 dia, o prazo do mês anterior já venceu =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select throws_ok($$select public.comissoes_definir_parametro('aviso_encerramento_antecedencia_dias', 0, 'fora da faixa')$$, '22023', null, 'antecedência fora da faixa é recusada');
select lives_ok($$select public.comissoes_definir_parametro('prazo_inadimplencia_dias', 1, 'Teste: prazo curto')$$, 'administrador encurta o prazo');
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((select count(*)::int from public.notificacoes_meus_avisos where origem = 'inadimplencia'), 2, 'indicador passa a ter atraso e prazo próximo');
select is((select lida from public.notificacoes_meus_avisos where origem_id = current_setting('t.av_b')::uuid), true, 'o aviso de atraso continua lido (mesmo id)');
select is((select lida from public.notificacoes_meus_avisos where tipo = 'inadimplencia_prazo_indicador'), false, 'o de prazo próximo é novo e não lido');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is((select count(*)::int from public.notificacoes_meus_avisos where origem = 'inadimplencia' and tipo = 'inadimplencia_prazo_negocio'), 1, 'anunciante recebe o aviso de prazo próximo');
select is((select count(*)::int from public.notificacoes_meus_avisos where origem = 'inadimplencia'), 2, 'e continua com um aviso de cada tipo (sem duplicar)');

-- ===== Vínculo encerrado deixa de avisar =====
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select lives_ok($$select public.comissoes_encerrar_vinculo(current_setting('t.vin')::uuid, 'Prazo vencido')$$, 'administrador encerra o vínculo vencido');
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((select count(*)::int from public.notificacoes_meus_avisos where origem = 'inadimplencia'), 0, 'indicador: vínculo encerrado não gera aviso');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is((select count(*)::int from public.notificacoes_meus_avisos where origem = 'inadimplencia'), 0, 'anunciante: vínculo encerrado não gera aviso');
reset role;

-- ===== Isolamento (IM-065): nada em pontos nem relacionamento =====
select is((select count(*)::int from public.pontos_lancamento), 0, 'os avisos não criaram lançamentos de pontos');
select is((select count(*)::int from public.relacionamento_membro), 0, 'nem alteraram o relacionamento');

select * from finish();
rollback;
