-- pgTAP · módulo comissoes (habilitação, ofertas, vínculos, assinaturas, pagamentos, comissões, repasse, reversões,
-- encerramento, isolamento e privacidade) · Fase 7
-- IM-061, IM-062, IM-063, IM-064, IM-065, IM-066, IM-067, IM-068, IM-069, IM-070, IM-071, IM-072, IM-073, IM-078, IM-086
-- Contas: A anunciante (P1, P2), E anunciante de OUTRO negócio (P3), B indicador, G indicador 2, C e F clientes, D administrador.
begin;
select * from no_plan();

insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@teste.local'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@teste.local'),
  ('cccccccc-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c@teste.local'),
  ('dddddddd-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd@teste.local'),
  ('eeeeeeee-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'e@teste.local'),
  ('ffffffff-0000-0000-0000-00000000000f', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'f@teste.local'),
  ('77777777-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'g@teste.local');
insert into public.administracao_administrador (conta_id) values ('dddddddd-0000-0000-0000-00000000000d');

insert into public.perfis_perfil (id, responsavel_id, slug) values
  ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a', 'loja-um'),
  ('a0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-00000000000a', 'loja-dois'),
  ('a0000000-0000-0000-0000-000000000003', 'eeeeeeee-0000-0000-0000-00000000000e', 'loja-tres');
insert into public.catalogo_item (id, conta_id, perfil_id, tipo) values
  ('e0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000001', 'servico'),
  ('e0000000-0000-0000-0000-000000000003', 'eeeeeeee-0000-0000-0000-00000000000e', 'a0000000-0000-0000-0000-000000000003', 'servico');

-- Meses de referência (UTC, dia 1).
select set_config('t.m0', (date_trunc('month', now() at time zone 'utc'))::date::text, true);
select set_config('t.m_1', (date_trunc('month', now() at time zone 'utc') - interval '1 month')::date::text, true);
select set_config('t.m_2', (date_trunc('month', now() at time zone 'utc') - interval '2 months')::date::text, true);
select set_config('t.m_3', (date_trunc('month', now() at time zone 'utc') - interval '3 months')::date::text, true);
select set_config('t.m_4', (date_trunc('month', now() at time zone 'utc') - interval '4 months')::date::text, true);
select set_config('t.m1', (date_trunc('month', now() at time zone 'utc') + interval '1 month')::date::text, true);

-- ===== Estrutura =====
select is((select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'comissoes\_%'), 16, 'o módulo tem 16 tabelas, todas com prefixo comissoes_');
select is((select bool_and(c.relrowsecurity and c.relforcerowsecurity) from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'comissoes\_%'), true, 'RLS ativa e forçada em todas as tabelas');
select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename like 'comissoes\_%'), 64, 'quatro políticas por tabela (16 x 4)');
select is((select count(*)::int from (select tablename from pg_policies where schemaname = 'public' and tablename like 'comissoes\_%'
  group by tablename having count(distinct cmd) = 4) x), 16, 'select, insert, update e delete explícitos em cada tabela');
select is((select bool_or(has_table_privilege(r, c.oid, p))
  from pg_class c join pg_namespace n on n.oid = c.relnamespace, unnest(array['anon', 'authenticated']) r,
       unnest(array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) p
  where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'comissoes\_%'), false, 'nenhum privilégio de escrita direto nas tabelas');
select is((select bool_or(has_table_privilege('anon', c.oid, 'SELECT'))
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'v') and c.relname like 'comissoes\_%'), false, 'anon não lê nada do módulo');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname like 'comissoes\_%'
    and (p.proconfig is null or array_to_string(p.proconfig, ',') not like '%search_path=%')), 0, 'toda função do módulo fixa search_path');
select is((select bool_or(has_function_privilege('anon', p.oid, 'EXECUTE'))
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname like 'comissoes\_%'), false, 'anon não executa nenhuma função do módulo');
select is((select bool_or(has_function_privilege('authenticated', p.oid, 'EXECUTE'))
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('comissoes_hoje', 'comissoes_parametro_valor', 'comissoes_modulo_ativo', 'comissoes_oferta_ativa',
    'comissoes_percentual_vigente', 'comissoes_exigir_responsavel', 'comissoes_situacao_indicador', 'comissoes_avaliar_pagamento',
    'comissoes_inserir_reversao')), false, 'funções internas não são chamáveis pela API');
select is((select valor from public.comissoes_parametro where chave = 'prazo_inadimplencia_dias'), 60, 'prazo padrão de inadimplência: 60 dias');
select columns_are('public', 'comissoes_minhas_comissoes', array['id', 'negocio_id', 'oferta_nome', 'competencia', 'base_centavos', 'percentual_bp',
  'valor_centavos', 'cliente_ref', 'estado', 'revertida', 'reversao_causa', 'criada_em'], 'comissões do indicador: sem dados do cliente');
select columns_are('public', 'comissoes_negocio_comissoes', array['id', 'negocio_id', 'oferta_nome', 'competencia', 'base_centavos', 'percentual_bp',
  'valor_centavos', 'indicador_ref', 'cliente_ref', 'estado', 'revertida', 'reversao_causa', 'criada_em'], 'comissões do anunciante: só referências opacas');
select columns_are('public', 'comissoes_negocio_vinculos', array['id', 'negocio_id', 'indicador_ref', 'cliente_ref', 'situacao', 'indicador_em_dia',
  'inadimplente_desde', 'encerra_em', 'criado_em', 'encerrado_em'], 'vínculos do anunciante: sem conta de cliente nem de indicador');

-- ===== anon =====
set local role anon;
select throws_ok($$select * from public.comissoes_meu_saldo$$, '42501', null, 'anônimo não lê o saldo');
select throws_ok($$select * from public.comissoes_negocio_comissoes$$, '42501', null, 'anônimo não lê comissões do negócio');
select throws_ok($$select public.comissoes_definir_habilitacao('a0000000-0000-0000-0000-000000000001', true, 'espontanea', 'x')$$, '42501', null, 'anônimo não habilita');
select throws_ok($$select count(*) from public.comissoes_comissao$$, '42501', null, 'anônimo não lê a tabela de comissões');
reset role;

-- ===== usuário comum e anunciante não administram =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok($$select public.comissoes_definir_habilitacao('a0000000-0000-0000-0000-000000000001', true, 'espontanea', 'tentativa')$$, '42501', null, 'o próprio anunciante não habilita o módulo (IM-061)');
select throws_ok($$select public.comissoes_definir_parametro('prazo_inadimplencia_dias', 30, 'tentativa')$$, '42501', null, 'anunciante não altera o prazo (IM-068)');
select throws_ok($$select public.comissoes_encerrar_vinculo(gen_random_uuid(), 'tentativa')$$, '42501', null, 'anunciante não encerra vínculos (IM-068)');
select throws_ok($$select * from public.comissoes_listar_vinculos_vencidos()$$, '42501', null, 'anunciante não lista vínculos vencidos');
select throws_ok($$insert into public.comissoes_oferta (perfil_id, item_id, nome, criada_por) values ('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'x', 'aaaaaaaa-0000-0000-0000-00000000000a')$$, '42501', null, 'sem insert direto em ofertas');
select throws_ok($$update public.comissoes_parametro set valor = 1$$, '42501', null, 'sem update direto no parâmetro');
select throws_ok($$delete from public.comissoes_lancamento$$, '42501', null, 'sem delete direto no razão');
select throws_ok($$select public.comissoes_criar_oferta('a0000000-0000-0000-0000-000000000002', null, 'x', 100)$$, 'P0001', null, 'módulo não habilitado: anunciante não cria oferta (IM-061)');
reset role;

-- ===== Habilitação (administrador) =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select throws_ok($$select public.comissoes_definir_habilitacao('a0000000-0000-0000-0000-000000000001', true, 'espontanea', '')$$, '22023', null, 'habilitar exige motivo');
select throws_ok($$select public.comissoes_definir_habilitacao('a0000000-0000-0000-0000-000000000001', true, 'outra', 'x')$$, '22023', null, 'origem fora da lista');
select throws_ok($$select public.comissoes_definir_habilitacao(gen_random_uuid(), true, 'espontanea', 'x')$$, 'P0002', null, 'negócio inexistente');
select ok((select public.comissoes_definir_habilitacao('a0000000-0000-0000-0000-000000000001', true, 'solicitacao', 'Pedido do anunciante') is not null), 'administrador habilita o negócio P1');
select is((select public.comissoes_definir_habilitacao('a0000000-0000-0000-0000-000000000001', true, 'solicitacao', 'repetido')), null, 'habilitar de novo é idempotente (sem evento novo)');
select ok((select public.comissoes_definir_habilitacao('a0000000-0000-0000-0000-000000000003', true, 'espontanea', 'Piloto') is not null), 'administrador habilita o negócio P3 (outra rede)');
select is((select count(*)::int from public.comissoes_habilitacao_evento where perfil_id = 'a0000000-0000-0000-0000-000000000001'), 1, 'um só evento de habilitação para P1');
select is((select count(*)::int from public.comissoes_rede), 2, 'uma rede por negócio habilitado (IM-063)');
reset role;
select is((select valor_novo ->> 'origem' from public.administracao_auditoria where acao = 'habilitar_comissoes' and alvo_id = 'a0000000-0000-0000-0000-000000000001'),
  'solicitacao', 'auditoria da habilitação: origem, motivo e autor');
select is((select autor_id from public.administracao_auditoria where acao = 'habilitar_comissoes' and alvo_id = 'a0000000-0000-0000-0000-000000000001'),
  'dddddddd-0000-0000-0000-00000000000d'::uuid, 'auditoria da habilitação registra o autor');
select is((select (valor_anterior ->> 'ativa')::boolean from public.administracao_auditoria where acao = 'habilitar_comissoes' and alvo_id = 'a0000000-0000-0000-0000-000000000001'),
  false, 'auditoria da habilitação guarda o valor anterior');

-- ===== Ofertas (anunciante) =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-0000-0000-00000000000e","role":"authenticated"}', true);
select throws_ok($$select public.comissoes_criar_oferta('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'Invasão', 500)$$, '42501', null, 'outro anunciante não cria oferta no negócio alheio');
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select throws_ok($$select public.comissoes_criar_oferta('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'Cliente', 500)$$, '42501', null, 'cliente comum não cria oferta');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok($$select public.comissoes_criar_oferta('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'Plano', 0)$$, '22023', null, 'percentual zero recusado');
select throws_ok($$select public.comissoes_criar_oferta('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'Plano', 10001)$$, '22023', null, 'percentual acima de 100% recusado');
select throws_ok($$select public.comissoes_criar_oferta('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000003', 'Plano', 500)$$, '22023', null, 'item de outro negócio recusado');
select throws_ok($$select public.comissoes_criar_oferta('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', '  ', 500)$$, '22023', null, 'nome obrigatório');
select set_config('t.of1', (select public.comissoes_criar_oferta('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'Plano mensal', 1000)::text), true);
select ok(current_setting('t.of1') is not null, 'anunciante cria a oferta recorrente com 10%');
select throws_ok($$select public.comissoes_criar_oferta('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'Plano outra vez', 500)$$, 'P0409', null, 'o mesmo item não vira duas ofertas');
select is((select count(*)::int from public.comissoes_minhas_ofertas), 1, 'anunciante vê a própria oferta');
select is((select percentual_bp from public.comissoes_minhas_ofertas), 1000, 'percentual vigente 10,00%');
select is((select count(*)::int from public.comissoes_oferta), 0, 'a tabela de ofertas segue invisível ao anunciante (RLS)');
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-0000-0000-00000000000e","role":"authenticated"}', true);
select is((select count(*)::int from public.comissoes_minhas_ofertas), 0, 'outro anunciante não vê ofertas alheias');
select throws_ok($$select public.comissoes_alterar_percentual_oferta(current_setting('t.of1')::uuid, 2000)$$, '42501', null, 'outro anunciante não altera percentual alheio');
select throws_ok($$select public.comissoes_definir_oferta_ativa(current_setting('t.of1')::uuid, false)$$, '42501', null, 'outro anunciante não inativa oferta alheia');
reset role;
select is((select periodicidade from public.comissoes_oferta where id = current_setting('t.of1')::uuid), 'mensal', 'oferta sempre mensal (sem venda avulsa, IM-062)');
select throws_ok($$insert into public.comissoes_oferta (perfil_id, item_id, nome, periodicidade, criada_por) values ('a0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000003', 'Avulsa', 'avulsa', 'eeeeeeee-0000-0000-0000-00000000000e')$$,
  '23514', null, 'venda avulsa não é representável');

-- ===== Vínculos e assinaturas (administrador) =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select throws_ok($$select public.comissoes_registrar_vinculo('a0000000-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-00000000000b', 'cccccccc-0000-0000-0000-00000000000c', 'x')$$, 'P0001', null, 'sem módulo habilitado não há vínculo (P2)');
select throws_ok($$select public.comissoes_registrar_vinculo('a0000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-00000000000b', 'x')$$, '22023', null, 'indicador não é o próprio cliente');
select throws_ok($$select public.comissoes_registrar_vinculo('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a', 'cccccccc-0000-0000-0000-00000000000c', 'x')$$, 'P0001', null, 'o responsável do negócio não indica no próprio negócio');
select throws_ok($$select public.comissoes_registrar_vinculo('a0000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-00000000000b', 'cccccccc-0000-0000-0000-00000000000c', '')$$, '22023', null, 'vínculo exige motivo');
select set_config('t.vin_bc', (select public.comissoes_registrar_vinculo('a0000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-00000000000b', 'cccccccc-0000-0000-0000-00000000000c', 'Indicação confirmada')::text), true);
select set_config('t.vin_gf', (select public.comissoes_registrar_vinculo('a0000000-0000-0000-0000-000000000001', '77777777-0000-0000-0000-000000000007', 'ffffffff-0000-0000-0000-00000000000f', 'Indicação confirmada')::text), true);
select ok((select public.comissoes_registrar_vinculo('a0000000-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-00000000000b', 'cccccccc-0000-0000-0000-00000000000c', 'Mesmo indicador e cliente em outra rede') is not null),
  'a conta participa de várias redes e o cliente pode estar em outra (IM-063)');
select throws_ok($$select public.comissoes_registrar_vinculo('a0000000-0000-0000-0000-000000000001', '77777777-0000-0000-0000-000000000007', 'cccccccc-0000-0000-0000-00000000000c', 'x')$$, 'P0409', null, 'cliente não é transferido a outro indicador no mesmo negócio (IM-069)');
select is((select count(*)::int from public.comissoes_vinculo where indicador_id = 'bbbbbbbb-0000-0000-0000-00000000000b'), 2, 'B está em duas redes independentes');

select throws_ok($$select public.comissoes_registrar_assinatura(current_setting('t.of1')::uuid, 'bbbbbbbb-0000-0000-0000-00000000000b', 0, current_setting('t.m_2')::date, null, 'x')$$, '22023', null, 'valor zero recusado');
select throws_ok($$select public.comissoes_registrar_assinatura(current_setting('t.of1')::uuid, 'bbbbbbbb-0000-0000-0000-00000000000b', 5000, current_setting('t.m_2')::date, (current_setting('t.m_4')::date), 'x')$$, '22023', null, 'fim antes do início recusado');
select throws_ok($$select public.comissoes_registrar_assinatura(gen_random_uuid(), 'bbbbbbbb-0000-0000-0000-00000000000b', 5000, current_setting('t.m_2')::date, null, 'x')$$, 'P0002', null, 'oferta inexistente');
select set_config('t.ass_b', (select public.comissoes_registrar_assinatura(current_setting('t.of1')::uuid, 'bbbbbbbb-0000-0000-0000-00000000000b', 5000, current_setting('t.m_2')::date, null, 'Contrato do indicador')::text), true);
select set_config('t.ass_c', (select public.comissoes_registrar_assinatura(current_setting('t.of1')::uuid, 'cccccccc-0000-0000-0000-00000000000c', 10000, current_setting('t.m_2')::date, null, 'Contrato do cliente')::text), true);
select set_config('t.ass_g', (select public.comissoes_registrar_assinatura(current_setting('t.of1')::uuid, '77777777-0000-0000-0000-000000000007', 5000, current_setting('t.m_4')::date, null, 'Contrato do indicador 2')::text), true);
select set_config('t.ass_f', (select public.comissoes_registrar_assinatura(current_setting('t.of1')::uuid, 'ffffffff-0000-0000-0000-00000000000f', 10000, current_setting('t.m_4')::date, null, 'Contrato do cliente 2')::text), true);
select throws_ok($$select public.comissoes_registrar_assinatura(current_setting('t.of1')::uuid, 'bbbbbbbb-0000-0000-0000-00000000000b', 5000, current_setting('t.m_1')::date, null, 'x')$$, 'P0409', null, 'não há duas assinaturas vigentes do mesmo cliente na oferta');

-- ===== Pagamentos: indicador inadimplente não gera comissão (IM-066) =====
select throws_ok($$select public.comissoes_confirmar_pagamento(current_setting('t.ass_c')::uuid, (current_setting('t.m_2')::date + 1), 10000, 'x')$$, '22023', null, 'competência deve ser dia 1');
select throws_ok($$select public.comissoes_confirmar_pagamento(current_setting('t.ass_c')::uuid, current_setting('t.m1')::date, 10000, 'x')$$, '22023', null, 'competência futura recusada');
select throws_ok($$select public.comissoes_confirmar_pagamento(current_setting('t.ass_c')::uuid, current_setting('t.m_3')::date, 10000, 'x')$$, '22023', null, 'competência anterior ao início recusada');
select throws_ok($$select public.comissoes_confirmar_pagamento(current_setting('t.ass_c')::uuid, current_setting('t.m_2')::date, 0, 'x')$$, '22023', null, 'valor zero recusado');
select throws_ok($$select public.comissoes_confirmar_pagamento(current_setting('t.ass_c')::uuid, current_setting('t.m_2')::date, 10000, '')$$, '22023', null, 'confirmação exige motivo');
select throws_ok($$select public.comissoes_confirmar_pagamento(gen_random_uuid(), current_setting('t.m_2')::date, 10000, 'x')$$, 'P0002', null, 'assinatura inexistente');
select set_config('t.pg_c2', (select public.comissoes_confirmar_pagamento(current_setting('t.ass_c')::uuid, current_setting('t.m_2')::date, 10000, 'Pix do mês retrasado')::text), true);
select is((select motivo from public.comissoes_decisao where pagamento_id = current_setting('t.pg_c2')::uuid), 'indicador_inadimplente', 'indicador sem pagamento em dia: nenhuma comissão (IM-066)');
select is((select count(*)::int from public.comissoes_comissao), 0, 'nenhuma comissão criada');

-- ===== Indicador regulariza; comissão passa a ser gerada só dali em diante (IM-067) =====
select lives_ok($$select count(public.comissoes_confirmar_pagamento(current_setting('t.ass_b')::uuid, (date_trunc('month', now() at time zone 'utc') - g * interval '1 month')::date, 5000, 'Pix do indicador')) from generate_series(0, 2) g$$,
  'administrador confirma os três meses do indicador');
select set_config('t.pg_c1', (select public.comissoes_confirmar_pagamento(current_setting('t.ass_c')::uuid, current_setting('t.m_1')::date, 10000, 'Pix recebido')::text), true);
select is((select motivo from public.comissoes_decisao where pagamento_id = current_setting('t.pg_c1')::uuid), 'gerada', 'indicador em dia: comissão gerada (IM-064)');
select is((select valor_centavos from public.comissoes_comissao where pagamento_id = current_setting('t.pg_c1')::uuid), 1000, '10% de R$ 100,00 = R$ 10,00 em centavos');
select is((select percentual_bp from public.comissoes_comissao where pagamento_id = current_setting('t.pg_c1')::uuid), 1000, 'percentual vigente congelado na comissão');
select is((select motivo from public.comissoes_decisao where pagamento_id = current_setting('t.pg_c2')::uuid), 'indicador_inadimplente', 'o mês anterior NÃO vira comissão retroativa (IM-067)');
select is((select public.comissoes_confirmar_pagamento(current_setting('t.ass_c')::uuid, current_setting('t.m_1')::date, 10000, 'repetido'))::text, current_setting('t.pg_c1'), 'confirmar de novo devolve o mesmo pagamento (idempotência)');
select is((select count(*)::int from public.comissoes_comissao), 1, 'sem comissão duplicada');
select is((select count(*)::int from public.administracao_auditoria where acao = 'confirmar_pagamento_comissoes' and alvo_id = current_setting('t.pg_c1')), 1, 'sem auditoria duplicada na repetição');
select is((select valor_novo ->> 'decisao' from public.administracao_auditoria where acao = 'confirmar_pagamento_comissoes' and alvo_id = current_setting('t.pg_c1')), 'gerada', 'auditoria da confirmação traz a decisão');
select is((select estado from public.comissoes_comissao_estado where comissao_id = (select id from public.comissoes_comissao limit 1)), 'gerada', 'estado inicial: gerada');

-- ===== Percentual novo vale só para pagamentos futuros (IM-069, IM-073) =====
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select ok((select public.comissoes_alterar_percentual_oferta(current_setting('t.of1')::uuid, 2000) is not null), 'anunciante altera o percentual para 20%');
select is((select public.comissoes_alterar_percentual_oferta(current_setting('t.of1')::uuid, 2000)), null, 'mesmo percentual: sem efeito');
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select set_config('t.pg_c0', (select public.comissoes_confirmar_pagamento(current_setting('t.ass_c')::uuid, current_setting('t.m0')::date, 10000, 'Pix do mês')::text), true);
select is((select valor_centavos from public.comissoes_comissao where pagamento_id = current_setting('t.pg_c0')::uuid), 2000, 'pagamento novo usa 20%');
select is((select valor_centavos from public.comissoes_comissao where pagamento_id = current_setting('t.pg_c1')::uuid), 1000, 'comissão anterior NÃO foi recalculada (IM-069)');
select is((select count(*)::int from public.comissoes_oferta_percentual where oferta_id = current_setting('t.of1')::uuid), 2, 'histórico guarda os dois percentuais');

-- ===== Repasse manual (IM-064, IM-070) =====
select set_config('t.com1', (select id::text from public.comissoes_comissao where pagamento_id = current_setting('t.pg_c1')::uuid), true);
select set_config('t.com0', (select id::text from public.comissoes_comissao where pagamento_id = current_setting('t.pg_c0')::uuid), true);
select throws_ok($$select public.comissoes_avancar_repasse(current_setting('t.com1')::uuid, 'paga', 'pulou etapa')$$, 'P0001', null, 'não paga sem passar por pendente de repasse');
select throws_ok($$select public.comissoes_avancar_repasse(current_setting('t.com1')::uuid, 'gerada', 'x')$$, '22023', null, 'estado inválido');
select throws_ok($$select public.comissoes_avancar_repasse(current_setting('t.com1')::uuid, 'paga', '')$$, '22023', null, 'repasse exige motivo');
select ok((select public.comissoes_avancar_repasse(current_setting('t.com1')::uuid, 'pendente_repasse', 'Lote de novembro') is not null), 'comissão passa a pendente de repasse');
select is((select public.comissoes_avancar_repasse(current_setting('t.com1')::uuid, 'pendente_repasse', 'repetido')), null, 'repetir o estado é idempotente');
select ok((select public.comissoes_avancar_repasse(current_setting('t.com1')::uuid, 'paga', 'Pix enviado') is not null), 'comissão marcada como paga');
select is((select (valor_anterior ->> 'estado') from public.administracao_auditoria where acao = 'repasse_comissao' and alvo_id = current_setting('t.com1') and valor_novo ->> 'estado' = 'paga'),
  'pendente_repasse', 'auditoria do repasse guarda o estado anterior');

-- ===== Reversão sem apagar histórico (IM-073, IM-078) =====
select throws_ok($$select public.comissoes_reverter_comissao(current_setting('t.com1')::uuid, 'fraude', 'x')$$, '22023', null, 'causa fora da lista');
select throws_ok($$select public.comissoes_reverter_comissao(current_setting('t.com1')::uuid, 'cancelamento', '')$$, '22023', null, 'reversão exige motivo');
select throws_ok($$select public.comissoes_reverter_comissao(current_setting('t.com1')::uuid, 'cancelamento', 'Cliente cancelou')$$, 'P0410', null, 'comissão já paga exige confirmação explícita');
select is((select count(*)::int from public.comissoes_lancamento where tipo = 'reversao'), 0, 'sem confirmação nada foi gravado');
select set_config('t.rev1', (select public.comissoes_reverter_comissao(current_setting('t.com1')::uuid, 'cancelamento', 'Cliente cancelou', true)::text), true);
select is((select valor_centavos from public.comissoes_lancamento where id = current_setting('t.rev1')::uuid), -1000, 'reversão é lançamento negativo');
select is((select original_id from public.comissoes_lancamento where id = current_setting('t.rev1')::uuid),
  (select id from public.comissoes_lancamento where comissao_id = current_setting('t.com1')::uuid and tipo = 'comissao'), 'a reversão aponta o lançamento original');
select is((select confirmou_ja_paga from public.comissoes_lancamento where id = current_setting('t.rev1')::uuid), true, 'reversão de comissão paga fica marcada');
select is((select count(*)::int from public.comissoes_lancamento where comissao_id = current_setting('t.com1')::uuid), 2, 'original preservado ao lado da reversão');
select throws_ok($$select public.comissoes_reverter_comissao(current_setting('t.com1')::uuid, 'correcao', 'de novo', true)$$, 'P0409', null, 'uma comissão só é revertida uma vez');
select is((select valor_anterior ->> 'situacao' from public.administracao_auditoria where acao = 'reverter_comissao' and alvo_id = current_setting('t.com1')), 'paga', 'auditoria da reversão guarda o estado anterior');

-- Estorno do pagamento reverte a comissão correspondente
select throws_ok($$select public.comissoes_estornar_pagamento(current_setting('t.pg_c0')::uuid, '', true)$$, '22023', null, 'estorno exige motivo');
select lives_ok($$select public.comissoes_avancar_repasse(current_setting('t.com0')::uuid, 'pendente_repasse', 'Lote')$$, 'comissão 2 pendente de repasse');
select lives_ok($$select public.comissoes_avancar_repasse(current_setting('t.com0')::uuid, 'paga', 'Pix enviado')$$, 'comissão 2 paga');
select throws_ok($$select public.comissoes_estornar_pagamento(current_setting('t.pg_c0')::uuid, 'Estorno do cartão')$$, 'P0410', null, 'estorno de comissão paga exige confirmação');
select is((select count(*)::int from public.comissoes_pagamento_estorno), 0, 'estorno recusado não deixa registro (transação inteira desfeita)');
select ok((select public.comissoes_estornar_pagamento(current_setting('t.pg_c0')::uuid, 'Estorno do cartão', true) is not null), 'estorno confirmado reverte a comissão');
select is((select causa from public.comissoes_lancamento where comissao_id = current_setting('t.com0')::uuid and tipo = 'reversao'), 'estorno', 'causa da reversão: estorno');
select throws_ok($$select public.comissoes_estornar_pagamento(current_setting('t.pg_c0')::uuid, 'de novo', true)$$, 'P0409', null, 'pagamento só é estornado uma vez');
select throws_ok($$select public.comissoes_confirmar_pagamento(current_setting('t.ass_c')::uuid, current_setting('t.m0')::date, 10000, 'tentativa')$$, 'P0409', null, 'competência estornada não é confirmada de novo');
select is((select coalesce(sum(valor_centavos), 0)::int from public.comissoes_lancamento where indicador_id = 'bbbbbbbb-0000-0000-0000-00000000000b'), 0, 'saldo líquido do indicador volta a zero; histórico mantido');
select is((select count(*)::int from public.comissoes_lancamento where indicador_id = 'bbbbbbbb-0000-0000-0000-00000000000b'), 4, 'quatro lançamentos preservados (2 comissões e 2 reversões)');

-- ===== Leitura: o indicador vê só o que é dele; sem dados de cliente (IM-029, IM-041) =====
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((select count(*)::int from public.comissoes_minhas_comissoes), 2, 'B vê as próprias duas comissões');
select is((select count(*)::int from public.comissoes_minhas_comissoes where revertida), 2, 'ambas aparecem como revertidas');
select is((select total_gerado_centavos from public.comissoes_meu_saldo), 3000::bigint, 'total gerado');
select is((select liquido_centavos from public.comissoes_meu_saldo), 0::bigint, 'líquido após reversões');
select is((select revertida_apos_paga_centavos from public.comissoes_meu_saldo), 3000::bigint, 'valor revertido depois de pago fica visível para análise');
select is((select count(*)::int from public.comissoes_minha_situacao), 2, 'B tem situação em dois negócios');
select is((select em_dia from public.comissoes_minha_situacao where negocio_id = 'a0000000-0000-0000-0000-000000000001'), true, 'B está em dia em P1');
select is((select em_dia from public.comissoes_minha_situacao where negocio_id = 'a0000000-0000-0000-0000-000000000003'), false, 'B não tem assinatura em P3: sem direito a novas comissões lá');
select is((select count(*)::int from public.comissoes_comissao), 0, 'o indicador não lê a tabela de comissões (RLS)');
select is((select count(*)::int from public.comissoes_negocio_vinculos), 0, 'B não é responsável de negócio: não vê vínculos de negócio');
select is((select count(*)::int from public.comissoes_negocio_comissoes), 0, 'B não vê comissões de negócio como anunciante');
reset role;

-- ===== Leitura do anunciante: só o próprio negócio; indicador e cliente opacos =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is((select count(*)::int from public.comissoes_negocio_comissoes), 2, 'A vê as duas comissões do próprio negócio');
select is((select count(*)::int from public.comissoes_negocio_vinculos), 2, 'A vê os dois vínculos de P1');
select is((select count(*)::int from public.comissoes_negocio_vinculos where negocio_id <> 'a0000000-0000-0000-0000-000000000001'), 0, 'nenhum vínculo de outro negócio (P3)');
select is((select count(*)::int from public.comissoes_meus_negocios), 1, 'só P1 foi habilitado entre os negócios de A');
select isnt((select indicador_ref from public.comissoes_negocio_comissoes limit 1), 'bbbbbbbb-0000-0000-0000-00000000000b', 'o indicador aparece só como referência opaca');
select is((select count(*)::int from public.comissoes_comissao), 0, 'A não lê a tabela de comissões (RLS)');
select is((select count(*)::int from public.comissoes_vinculo), 0, 'A não lê a tabela de vínculos (RLS)');
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-0000-0000-00000000000e","role":"authenticated"}', true);
select is((select count(*)::int from public.comissoes_negocio_comissoes), 0, 'E não vê comissões do negócio de A');
select is((select count(*)::int from public.comissoes_negocio_vinculos), 1, 'E vê só o vínculo do próprio negócio P3');
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is((select count(*)::int from public.comissoes_minhas_comissoes), 0, 'o cliente não vê comissão alguma');
select is((select total_gerado_centavos from public.comissoes_meu_saldo), 0::bigint, 'o cliente tem saldo zero');
reset role;

-- ===== Encerramento de vínculos: só o administrador, após o prazo configurável (IM-068, IM-072) =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select is((select count(*)::int from public.comissoes_listar_vinculos_vencidos()), 1, 'G (sem pagar há meses) tem vínculo vencido; B em dia não');
select is((select o_vinculo_id from public.comissoes_listar_vinculos_vencidos()), current_setting('t.vin_gf')::uuid, 'o vínculo vencido é o de G');
select is((select o_prazo_dias from public.comissoes_listar_vinculos_vencidos()), 60, 'prazo padrão de 60 dias');
select is((select o_inadimplente_desde from public.comissoes_listar_vinculos_vencidos()), current_setting('t.m_4')::date, 'contagem a partir do primeiro mês sem pagamento (IM-072)');
select throws_ok($$select public.comissoes_definir_parametro('prazo_inadimplencia_dias', 0, 'x')$$, '22023', null, 'prazo fora da faixa');
select throws_ok($$select public.comissoes_definir_parametro('prazo_inadimplencia_dias', 30, '')$$, '22023', null, 'prazo exige motivo');
select throws_ok($$select public.comissoes_definir_parametro('inexistente', 30, 'x')$$, 'P0002', null, 'parâmetro inexistente');
select lives_ok($$select public.comissoes_definir_parametro('prazo_inadimplencia_dias', 365, 'Teste de prazo maior')$$, 'administrador altera o prazo');
select is((select count(*)::int from public.comissoes_listar_vinculos_vencidos()), 0, 'com prazo de 365 dias nada vence');
select throws_ok($$select public.comissoes_encerrar_vinculo(current_setting('t.vin_gf')::uuid, 'cedo demais')$$, 'P0001', null, 'não encerra antes do prazo');
select lives_ok($$select public.comissoes_definir_parametro('prazo_inadimplencia_dias', 60, 'Volta ao padrão')$$, 'prazo volta a 60');
select is((select (valor_anterior ->> 'valor')::int from public.administracao_auditoria where acao = 'definir_parametro_comissoes' and valor_novo ->> 'valor' = '60'), 365, 'auditoria do parâmetro guarda o valor anterior');
select throws_ok($$select public.comissoes_encerrar_vinculo(current_setting('t.vin_bc')::uuid, 'B está em dia')$$, 'P0001', null, 'vínculo de indicador em dia não é encerrado');
select throws_ok($$select public.comissoes_encerrar_vinculo(current_setting('t.vin_gf')::uuid, '')$$, '22023', null, 'encerrar exige motivo');
select lives_ok($$select public.comissoes_encerrar_vinculo(current_setting('t.vin_gf')::uuid, 'Prazo de 60 dias vencido')$$, 'administrador encerra o vínculo vencido');
select throws_ok($$select public.comissoes_encerrar_vinculo(current_setting('t.vin_gf')::uuid, 'de novo')$$, 'P0409', null, 'vínculo só é encerrado uma vez');
select is((select valor_novo ->> 'situacao' from public.administracao_auditoria where acao = 'encerrar_vinculo_comissoes'), 'encerrado', 'auditoria do encerramento');
select set_config('t.pg_f4', (select public.comissoes_confirmar_pagamento(current_setting('t.ass_f')::uuid, current_setting('t.m_4')::date, 10000, 'Pix do cliente 2')::text), true);
select is((select motivo from public.comissoes_decisao where pagamento_id = current_setting('t.pg_f4')::uuid), 'vinculo_encerrado', 'vínculo encerrado não gera comissão');

-- G regulariza: nada é restaurado e nada é retroativo (IM-067, IM-068)
select lives_ok($$select count(public.comissoes_confirmar_pagamento(current_setting('t.ass_g')::uuid, (date_trunc('month', now() at time zone 'utc') - g * interval '1 month')::date, 5000, 'Pix do indicador 2')) from generate_series(0, 4) g$$,
  'G paga todos os meses em aberto');
select set_config('t.pg_f3', (select public.comissoes_confirmar_pagamento(current_setting('t.ass_f')::uuid, current_setting('t.m_3')::date, 10000, 'Pix do cliente 2')::text), true);
select is((select motivo from public.comissoes_decisao where pagamento_id = current_setting('t.pg_f3')::uuid), 'vinculo_encerrado', 'regularizar não restaura o vínculo encerrado');
select is((select count(*)::int from public.comissoes_listar_vinculos_vencidos()), 0, 'nada mais vencido');
select is((select count(*)::int from public.comissoes_comissao), 2, 'nenhuma comissão retroativa foi criada');
-- Nova carteira: G forma vínculo com outro cliente (E); o antigo permanece no histórico
select ok((select public.comissoes_registrar_vinculo('a0000000-0000-0000-0000-000000000001', '77777777-0000-0000-0000-000000000007', 'eeeeeeee-0000-0000-0000-00000000000e', 'Nova carteira') is not null), 'G pode formar nova carteira');
select set_config('t.ass_e', (select public.comissoes_registrar_assinatura(current_setting('t.of1')::uuid, 'eeeeeeee-0000-0000-0000-00000000000e', 4000, current_setting('t.m_1')::date, null, 'Contrato do cliente 3')::text), true);
select set_config('t.pg_e1', (select public.comissoes_confirmar_pagamento(current_setting('t.ass_e')::uuid, current_setting('t.m_1')::date, 4000, 'Pix do cliente 3')::text), true);
select is((select valor_centavos from public.comissoes_comissao where pagamento_id = current_setting('t.pg_e1')::uuid), 800, 'regularizada, G volta a ganhar só das comissões futuras: 20% de R$ 40,00');
select is((select count(*)::int from public.comissoes_vinculo_encerramento), 1, 'o histórico do vínculo encerrado permanece');

-- ===== Cancelamento de assinatura =====
select throws_ok($$select public.comissoes_cancelar_assinatura(current_setting('t.ass_f')::uuid, '')$$, '22023', null, 'cancelar exige motivo');
select throws_ok($$select public.comissoes_cancelar_assinatura(gen_random_uuid(), 'x')$$, 'P0002', null, 'assinatura inexistente');
select lives_ok($$select public.comissoes_cancelar_assinatura(current_setting('t.ass_f')::uuid, 'Cliente saiu')$$, 'administrador cancela a assinatura');
select throws_ok($$select public.comissoes_cancelar_assinatura(current_setting('t.ass_f')::uuid, 'de novo')$$, 'P0409', null, 'assinatura só é cancelada uma vez');
select is((select valor_novo ->> 'situacao' from public.administracao_auditoria where acao = 'cancelar_assinatura_comissoes'), 'cancelada', 'auditoria do cancelamento');
select is((select count(*)::int from public.comissoes_pagamento where assinatura_id = current_setting('t.ass_f')::uuid), 2, 'cancelar não apaga pagamentos já confirmados');
reset role;

-- ===== Desativar o módulo preserva saldos e histórico; só bloqueia novas comissões (IM-073) =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select ok((select public.comissoes_definir_habilitacao('a0000000-0000-0000-0000-000000000001', false, 'espontanea', 'Fim do piloto') is not null), 'administrador desabilita o módulo em P1');
select set_config('t.pg_e0', (select public.comissoes_confirmar_pagamento(current_setting('t.ass_e')::uuid, current_setting('t.m0')::date, 4000, 'Pix do cliente 3')::text), true);
select is((select motivo from public.comissoes_decisao where pagamento_id = current_setting('t.pg_e0')::uuid), 'modulo_desativado', 'módulo desabilitado não gera nova comissão');
select is((select count(*)::int from public.comissoes_comissao), 3, 'comissões existentes continuam');
select is((select sum(valor_centavos)::int from public.comissoes_lancamento where indicador_id = '77777777-0000-0000-0000-000000000007'), 800, 'saldo de G preservado');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok($$select public.comissoes_alterar_percentual_oferta(current_setting('t.of1')::uuid, 3000)$$, 'P0001', null, 'com o módulo desabilitado o anunciante não muda percentual');
select ok((select public.comissoes_definir_oferta_ativa(current_setting('t.of1')::uuid, false) is not null), 'inativar a oferta continua permitido');
select throws_ok($$select public.comissoes_definir_oferta_ativa(current_setting('t.of1')::uuid, true)$$, 'P0001', null, 'ativar a oferta exige o módulo habilitado');
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((select count(*)::int from public.comissoes_minhas_comissoes), 2, 'o histórico do indicador segue legível com o módulo desabilitado');
select set_config('request.jwt.claims', '{"sub":"77777777-0000-0000-0000-000000000007","role":"authenticated"}', true);
select is((select count(*)::int from public.comissoes_minhas_comissoes), 1, 'G vê a própria comissão');
select is((select clientes_encerrados from public.comissoes_minha_situacao where negocio_id = 'a0000000-0000-0000-0000-000000000001'), 1, 'G vê o vínculo encerrado no histórico');
select is((select clientes_ativos from public.comissoes_minha_situacao where negocio_id = 'a0000000-0000-0000-0000-000000000001'), 1, 'e a nova carteira');
select is((select modulo_ativo from public.comissoes_minha_situacao where negocio_id = 'a0000000-0000-0000-0000-000000000001'), false, 'a situação informa que o módulo está desabilitado');
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select ok((select public.comissoes_definir_habilitacao('a0000000-0000-0000-0000-000000000001', true, 'espontanea', 'Retomada') is not null), 'administrador habilita de novo');
select is((select count(*)::int from public.comissoes_rede where perfil_id = 'a0000000-0000-0000-0000-000000000001'), 1, 'continua uma só rede por negócio');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select ok((select public.comissoes_definir_oferta_ativa(current_setting('t.of1')::uuid, true) is not null), 'anunciante reativa a oferta');
select is((select ativa from public.comissoes_minhas_ofertas), true, 'oferta ativa de novo');
reset role;

-- ===== Histórico só de inserção (vale também para o superusuário) =====
select throws_ok($$update public.comissoes_lancamento set motivo = 'x'$$, '42501', null, 'razão não aceita update');
select throws_ok($$delete from public.comissoes_comissao$$, '42501', null, 'comissão não é apagada');
select throws_ok($$update public.comissoes_pagamento set valor_centavos = 1$$, '42501', null, 'pagamento confirmado não é alterado');
select throws_ok($$delete from public.comissoes_decisao$$, '42501', null, 'decisão não é apagada');
select throws_ok($$update public.comissoes_oferta_percentual set percentual_bp = 1$$, '42501', null, 'histórico de percentual não é alterado');
select throws_ok($$update public.comissoes_parametro set chave = 'outra'$$, '42501', null, 'chave do parâmetro é imutável');
select throws_ok($$delete from public.comissoes_parametro$$, '42501', null, 'parâmetro não é apagado');

-- ===== Restrições do banco contra duplicidade e dados inválidos =====
select throws_ok($$insert into public.comissoes_pagamento (assinatura_id, competencia, valor_centavos, confirmado_por) values (current_setting('t.ass_b')::uuid, current_setting('t.m0')::date, 100, 'dddddddd-0000-0000-0000-00000000000d')$$,
  '23505', null, 'pagamento duplicado na mesma assinatura e mês é recusado (IM-064)');
select throws_ok($$insert into public.comissoes_pagamento (assinatura_id, competencia, valor_centavos, confirmado_por) values (current_setting('t.ass_b')::uuid, current_setting('t.m_2')::date + 1, 100, 'dddddddd-0000-0000-0000-00000000000d')$$,
  '23514', null, 'competência que não é dia 1 é recusada');
select throws_ok($$insert into public.comissoes_comissao (pagamento_id, perfil_id, oferta_id, vinculo_id, indicador_id, base_centavos, percentual_bp, valor_centavos)
  values (current_setting('t.pg_c1')::uuid, 'a0000000-0000-0000-0000-000000000001', current_setting('t.of1')::uuid, current_setting('t.vin_bc')::uuid, 'bbbbbbbb-0000-0000-0000-00000000000b', 10000, 1000, 1000)$$,
  '23505', null, 'segunda comissão para o mesmo pagamento é recusada');
select throws_ok($$insert into public.comissoes_comissao (pagamento_id, perfil_id, oferta_id, vinculo_id, indicador_id, base_centavos, percentual_bp, valor_centavos)
  values (current_setting('t.pg_c2')::uuid, 'a0000000-0000-0000-0000-000000000001', current_setting('t.of1')::uuid, current_setting('t.vin_bc')::uuid, 'bbbbbbbb-0000-0000-0000-00000000000b', 10000, 1000, 999)$$,
  '23514', null, 'valor da comissão tem de bater com base x percentual');
select throws_ok($$insert into public.comissoes_lancamento (indicador_id, perfil_id, comissao_id, tipo, valor_centavos, original_id, causa, motivo, autor_id)
  select 'bbbbbbbb-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-000000000001', current_setting('t.com1')::uuid, 'reversao', -5, l.id, 'correcao', 'valor errado', 'dddddddd-0000-0000-0000-00000000000d'
  from public.comissoes_lancamento l where l.comissao_id = current_setting('t.com1')::uuid and l.tipo = 'comissao'$$,
  '23514', null, 'reversão com valor diferente do original é recusada');
select throws_ok($$insert into public.comissoes_vinculo (rede_id, perfil_id, indicador_id, cliente_id, criado_por)
  select r.id, r.perfil_id, 'bbbbbbbb-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-00000000000b', 'dddddddd-0000-0000-0000-00000000000d' from public.comissoes_rede r limit 1$$,
  '23514', null, 'autoindicação é recusada pelo banco');
select throws_ok($$insert into public.comissoes_assinatura (perfil_id, oferta_id, cliente_id, valor_centavos, inicio, criada_por)
  values ('a0000000-0000-0000-0000-000000000003', current_setting('t.of1')::uuid, 'cccccccc-0000-0000-0000-00000000000c', 100, current_date, 'dddddddd-0000-0000-0000-00000000000d')$$,
  '23503', null, 'assinatura não mistura oferta de um negócio com outro');

-- ===== Auditoria completa das ações administrativas (IM-086) =====
select is((select count(distinct acao)::int from public.administracao_auditoria where acao in (
  'habilitar_comissoes', 'desabilitar_comissoes', 'registrar_vinculo_comissoes', 'registrar_assinatura_comissoes',
  'confirmar_pagamento_comissoes', 'repasse_comissao', 'reverter_comissao', 'estornar_pagamento_comissoes',
  'encerrar_vinculo_comissoes', 'definir_parametro_comissoes', 'cancelar_assinatura_comissoes')), 11, 'as 11 ações administrativas do módulo gravaram auditoria');
select is((select count(*)::int from public.administracao_auditoria
  where (acao like '%\_comissoes' or acao in ('repasse_comissao', 'reverter_comissao'))
    and (motivo is null or autor_id <> 'dddddddd-0000-0000-0000-00000000000d' or valor_anterior is null)), 0, 'toda auditoria tem autor, motivo e valor anterior');

-- ===== Isolamento (IM-065): nada de pontos foi tocado =====
select is((select count(*)::int from public.pontos_lancamento), 0, 'comissões não criaram nem alteraram lançamentos de pontos');
select is((select count(*)::int from public.pontos_decisao), 0, 'nem decisões de pontos');

select * from finish();
rollback;
