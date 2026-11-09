-- pgTAP · teto diário de pontos por indicador (D-035) · IM-030, IM-032, IM-033, IM-034, IM-035, IM-065, IM-078, IM-086, IM-029
-- Teto de 100 pontos por dia civil (America/Sao_Paulo) por indicador; acima disso o contato é aceito e NÃO pontua
-- (motivo limite_diario, tudo ou nada); reprocessamento respeita o mesmo teto sem duplicar; parâmetro auditado.
begin;
select * from no_plan();
delete from public.catalogo_categoria;

-- A = responsável do perfil P1; C e E = indicadores; D = administrador geral; G = usuário comum.
insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@teste.local'),
  ('cccccccc-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c@teste.local'),
  ('dddddddd-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd@teste.local'),
  ('eeeeeeee-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'e@teste.local'),
  ('99999999-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'g@teste.local');
insert into public.administracao_administrador (conta_id) values ('dddddddd-0000-0000-0000-00000000000d');
update public.contas_conta set whatsapp_e164 = '+5551999990001' where id = 'aaaaaaaa-0000-0000-0000-00000000000a';
update public.contas_conta set whatsapp_e164 = '+5511999990003' where id = 'cccccccc-0000-0000-0000-00000000000c';
update public.contas_conta set whatsapp_e164 = '+5511999990005' where id = 'eeeeeeee-0000-0000-0000-00000000000e';
insert into public.catalogo_categoria (id, nome, slug, ativa, ordem) values
  ('11111111-0000-0000-0000-000000000001', 'Alimentação', 'alimentacao', true, 1);
insert into public.perfis_perfil (id, responsavel_id, slug) values
  ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a', 'loja-um');
insert into public.perfis_perfil_versao (id, perfil_id, nome, descricao_breve, imagem_path, categoria_principal_id, cidade, uf) values
  ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Loja Um', 'Doces', 'perfil/a0000000-0000-0000-0000-000000000001/c.jpg', '11111111-0000-0000-0000-000000000001', 'Porto Alegre', 'RS');
insert into public.perfis_perfil_versao_contato (versao_id, whatsapp_comercial_e164) values
  ('a1000000-0000-0000-0000-000000000001', '+5551988880001');
update public.perfis_perfil_versao set situacao = 'pendente', enviada_em = now() where id = 'a1000000-0000-0000-0000-000000000001';
update public.perfis_perfil_versao set situacao = 'aprovada' where id = 'a1000000-0000-0000-0000-000000000001';
update public.perfis_perfil set versao_aprovada_id = 'a1000000-0000-0000-0000-000000000001', publicado = true where id = 'a0000000-0000-0000-0000-000000000001';

create function pg_temp.lk(p_ind uuid) returns uuid language sql as $$
  select id from public.indicacoes_link where indicador_id = p_ind and perfil_id = 'a0000000-0000-0000-0000-000000000001';
$$;
-- Um visitante diferente por pedido (WhatsApp único), no instante p_em.
create function pg_temp.pedido(p_link uuid, p_n integer, p_em timestamptz) returns uuid language sql as $$
  insert into public.indicacoes_pedido_contato
    (perfil_id, item_id, link_id, nome, whatsapp_e164, chave_idempotencia, autoindicacao_suspeita, criado_em)
  values ('a0000000-0000-0000-0000-000000000001', null, p_link, 'Visitante Teste', '+55119' || lpad(p_n::text, 8, '0'),
          'chave-teto-' || lpad(p_n::text, 6, '0'), false, p_em)
  returning id;
$$;
create function pg_temp.motivo(p_pedido uuid) returns text language sql as $$
  select motivo from public.pontos_decisao where pedido_id = p_pedido;
$$;
create function pg_temp.saldo(p_ind uuid) returns integer language sql as $$
  select coalesce(sum(pontos), 0)::integer from public.pontos_lancamento where indicador_id = p_ind;
$$;

-- ===== Estrutura e parâmetro =====
select is((select valor from public.pontos_parametro where chave = 'teto_diario_pontos'), 100, 'teto padrão de 100 pontos por dia (D-035)');
select is((select minimo || '-' || maximo from public.pontos_parametro where chave = 'teto_diario_pontos'), '10-10000', 'faixa do teto: 10 a 10000');
select has_column('public', 'pontos_decisao', 'teto_diario', 'a decisão guarda o teto aplicado');
select is(has_function_privilege('anon', 'public.pontos_meu_limite_diario()', 'EXECUTE'), false, 'anon não executa pontos_meu_limite_diario');
select is(has_function_privilege('authenticated', 'public.pontos_janela_dia(timestamptz)', 'EXECUTE'), false, 'a janela do dia é interna');
select is(has_table_privilege('anon', 'public.pontos_meus_limites_diarios', 'SELECT'), false, 'anon não lê a visão de limites do indicador');
select columns_are('public', 'pontos_meus_limites_diarios', array['id', 'contato_em', 'destino_tipo', 'destino_id', 'teto_diario'],
  'visão do indicador: só destino opaco e teto, sem dado do visitante');
select is((select o_ini::text || ' ' || o_fim::text from public.pontos_janela_dia('2026-03-10 02:30:00+00')),
  (select ('2026-03-09 00:00:00-03'::timestamptz)::text || ' ' || ('2026-03-10 00:00:00-03'::timestamptz)::text),
  'o dia é o de Brasília: 02:30 UTC de 10/03 ainda é dia 09 em São Paulo');

-- Links dos indicadores
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select lives_ok($$select * from public.indicacoes_gerar_link(p_perfil_id => 'a0000000-0000-0000-0000-000000000001')$$, 'C gera link');
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-0000-0000-00000000000e","role":"authenticated"}', true);
select lives_ok($$select * from public.indicacoes_gerar_link(p_perfil_id => 'a0000000-0000-0000-0000-000000000001')$$, 'E gera link');
reset role;

-- ===== Abaixo do teto e no teto =====
-- Dia 10/03 em São Paulo: 10 contatos (12:00 UTC a 21:00 UTC, uma hora de intervalo) = 100 pontos.
select pg_temp.pedido(pg_temp.lk('cccccccc-0000-0000-0000-00000000000c'), n, ('2026-03-10 12:00:00+00'::timestamptz) + (n - 1) * interval '1 hour')
from generate_series(1, 10) n;
select is((select count(*)::int from public.pontos_decisao where indicador_id = 'cccccccc-0000-0000-0000-00000000000c' and motivo = 'pontuado'), 10, 'abaixo do teto: as 10 primeiras indicações do dia pontuam');
select is(pg_temp.saldo('cccccccc-0000-0000-0000-00000000000c'), 100, 'saldo do indicador no teto: 100');
select set_config('t.p11', pg_temp.pedido(pg_temp.lk('cccccccc-0000-0000-0000-00000000000c'), 11, '2026-03-10 22:00:00+00')::text, true);
select is(pg_temp.motivo(current_setting('t.p11')::uuid), 'limite_diario', 'a 11a indicação do dia não pontua: motivo limite_diario');
select is((select pontuado from public.pontos_decisao where pedido_id = current_setting('t.p11')::uuid), false, 'decisão não pontuada');
select is((select pontos from public.pontos_decisao where pedido_id = current_setting('t.p11')::uuid), 0, 'zero pontos na decisão');
select is((select teto_diario from public.pontos_decisao where pedido_id = current_setting('t.p11')::uuid), 100, 'a decisão guarda o teto vigente');
select is((select count(*)::int from public.pontos_lancamento where pedido_id = current_setting('t.p11')::uuid), 0, 'acima do teto: nenhum lançamento no histórico de saldo');
select is((select count(*)::int from public.indicacoes_pedido_contato where id = current_setting('t.p11')::uuid), 1, 'o pedido de contato foi aceito e preservado (nunca recusado pelo teto)');
select is((select count(*)::int from public.pontos_falha where pedido_id = current_setting('t.p11')::uuid), 0, 'o teto não é falha');
select is(pg_temp.saldo('cccccccc-0000-0000-0000-00000000000c'), 100, 'saldo continua 100');

-- Independência: outro indicador no mesmo dia pontua; o mesmo indicador em outro dia pontua.
select set_config('t.pe1', pg_temp.pedido(pg_temp.lk('eeeeeeee-0000-0000-0000-00000000000e'), 31, '2026-03-10 22:30:00+00')::text, true);
select is(pg_temp.motivo(current_setting('t.pe1')::uuid), 'pontuado', 'o teto é por indicador: E pontua no mesmo dia');
select set_config('t.pc_dia2', pg_temp.pedido(pg_temp.lk('cccccccc-0000-0000-0000-00000000000c'), 12, '2026-03-11 15:00:00+00')::text, true);
select is(pg_temp.motivo(current_setting('t.pc_dia2')::uuid), 'pontuado', 'no dia seguinte o mesmo indicador pontua de novo');

-- Virada do dia em São Paulo (não em UTC): 23:30 de 11/03 em SP = 02:30 UTC de 12/03; 00:30 de 12/03 em SP = 03:30 UTC.
-- C já tem 10 pontos em 11/03; completa 90 em 11/03 (9 pedidos) -> 100; o próximo em 11/03 SP (02:30 UTC de 12/03) passa do teto.
select pg_temp.pedido(pg_temp.lk('cccccccc-0000-0000-0000-00000000000c'), 40 + n, ('2026-03-11 16:00:00+00'::timestamptz) + (n - 1) * interval '1 hour')
from generate_series(1, 9) n;
select set_config('t.pc_23h30', pg_temp.pedido(pg_temp.lk('cccccccc-0000-0000-0000-00000000000c'), 50, '2026-03-12 02:30:00+00')::text, true);
select set_config('t.pc_00h30', pg_temp.pedido(pg_temp.lk('cccccccc-0000-0000-0000-00000000000c'), 51, '2026-03-12 03:30:00+00')::text, true);
select is(pg_temp.motivo(current_setting('t.pc_23h30')::uuid), 'limite_diario', '23:30 em Brasília (02:30 UTC do dia seguinte) ainda é o dia anterior: teto atingido');
select is(pg_temp.motivo(current_setting('t.pc_00h30')::uuid), 'pontuado', '00:30 em Brasília é o dia novo: pontua');

-- ===== Regras anteriores seguem valendo (o teto vem depois) =====
-- Mesmo visitante no mesmo destino dentro do intervalo continua 'dentro_do_intervalo', não 'limite_diario'.
insert into public.indicacoes_pedido_contato (perfil_id, link_id, nome, whatsapp_e164, chave_idempotencia, autoindicacao_suspeita, criado_em)
values ('a0000000-0000-0000-0000-000000000001', pg_temp.lk('cccccccc-0000-0000-0000-00000000000c'), 'Visitante Teste', '+5511900000001', 'chave-teto-repeticao', false, '2026-03-10 23:00:00+00');
select is((select motivo from public.pontos_decisao d join public.indicacoes_pedido_contato p on p.id = d.pedido_id where p.chave_idempotencia = 'chave-teto-repeticao'),
  'dentro_do_intervalo', 'repetição do mesmo visitante: o intervalo (IM-033) tem precedência sobre o teto');

-- ===== Pontuação parcial: não existe (tudo ou nada) e o parâmetro é auditado =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"99999999-0000-0000-0000-000000000009","role":"authenticated"}', true);
select throws_ok($$select public.pontos_definir_parametro('teto_diario_pontos', 50, 'tentativa')$$, '42501', null, 'usuário comum não altera o teto');
select is((select count(*)::int from public.pontos_parametro), 0, 'usuário comum não lê parâmetros pela tabela');
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select throws_ok($$select public.pontos_definir_parametro('teto_diario_pontos', 9, 'abaixo')$$, '22023', null, 'teto abaixo da faixa (9) recusado');
select throws_ok($$select public.pontos_definir_parametro('teto_diario_pontos', 10001, 'acima')$$, '22023', null, 'teto acima da faixa (10001) recusado');
select throws_ok($$select public.pontos_definir_parametro('teto_diario_pontos', 50, '')$$, '22023', null, 'motivo obrigatório');
select throws_ok($$select public.pontos_definir_parametro('teto_diario_pontos', null, 'nulo')$$, '22023', null, 'valor nulo recusado');
select throws_ok($$update public.pontos_parametro set valor = 1 where chave = 'teto_diario_pontos'$$, '42501', null, 'cliente não altera o parâmetro direto (nem o administrador)');
select lives_ok($$select public.pontos_definir_parametro('teto_diario_pontos', 15, 'teste de pontuação parcial')$$, 'administrador altera o teto para 15');
reset role;
select is((select valor_anterior ->> 'valor' from public.administracao_auditoria where acao = 'definir_parametro_pontos' and alvo_id = 'teto_diario_pontos'), '100', 'auditoria: valor anterior');
select is((select valor_novo ->> 'valor' from public.administracao_auditoria where acao = 'definir_parametro_pontos' and alvo_id = 'teto_diario_pontos'), '15', 'auditoria: valor novo');
select is((select motivo from public.administracao_auditoria where acao = 'definir_parametro_pontos' and alvo_id = 'teto_diario_pontos'), 'teste de pontuação parcial', 'auditoria: motivo');
select is((select autor_id from public.administracao_auditoria where acao = 'definir_parametro_pontos' and alvo_id = 'teto_diario_pontos'), 'dddddddd-0000-0000-0000-00000000000d'::uuid, 'auditoria: autor');

-- Dia 13/03 para E (teto 15, 10 por indicação): 1a pontua (10); 2a faria 20 > 15 e NÃO pontua, nem os 5 pontos restantes (tudo ou nada).
select set_config('t.pe_a', pg_temp.pedido(pg_temp.lk('eeeeeeee-0000-0000-0000-00000000000e'), 60, '2026-03-13 15:00:00+00')::text, true);
select set_config('t.pe_b', pg_temp.pedido(pg_temp.lk('eeeeeeee-0000-0000-0000-00000000000e'), 61, '2026-03-13 16:00:00+00')::text, true);
select is(pg_temp.motivo(current_setting('t.pe_a')::uuid), 'pontuado', 'teto 15: primeira indicação pontua');
select is(pg_temp.motivo(current_setting('t.pe_b')::uuid), 'limite_diario', 'teto 15: a segunda (10 + 10 > 15) não pontua');
select is((select pontos from public.pontos_decisao where pedido_id = current_setting('t.pe_b')::uuid), 0, 'sem pontuação parcial: nada é creditado da sobra');
select is((select teto_diario from public.pontos_decisao where pedido_id = current_setting('t.pe_b')::uuid), 15, 'a decisão guarda o teto de 15 vigente na época');
select is((select teto_diario from public.pontos_decisao where pedido_id = current_setting('t.p11')::uuid), 100, 'decisões antigas mantêm o teto da época (100)');

-- Aumentar o teto vale para os próximos contatos; não reescreve decisões antigas.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select lives_ok($$select public.pontos_definir_parametro('teto_diario_pontos', 100, 'volta ao padrão')$$, 'administrador volta o teto a 100');
reset role;
select is(pg_temp.motivo(current_setting('t.pe_b')::uuid), 'limite_diario', 'decisão antiga não é reescrita');
select is((select count(*)::int from public.pontos_lancamento where pedido_id = current_setting('t.pe_b')::uuid), 0, 'e continua sem crédito');

-- ===== Reprocessamento respeita o teto, conta o dia do PEDIDO e não duplica =====
-- Falha simulada na gravação da decisão com teto: o pedido é preservado e a falha registrada (IM-028).
alter table public.pontos_decisao add constraint falha_simulada check (teto_diario is null or teto_diario > 100000) not valid;
select set_config('t.pr1', pg_temp.pedido(pg_temp.lk('cccccccc-0000-0000-0000-00000000000c'), 70, '2026-03-10 23:30:00+00')::text, true);
select set_config('t.pr2', pg_temp.pedido(pg_temp.lk('cccccccc-0000-0000-0000-00000000000c'), 71, '2026-03-10 23:40:00+00')::text, true);
select is((select count(*)::int from public.pontos_decisao where pedido_id in (current_setting('t.pr1')::uuid, current_setting('t.pr2')::uuid)), 0, 'falha simulada: sem decisão parcial');
select is((select count(*)::int from public.pontos_falha where pedido_id in (current_setting('t.pr1')::uuid, current_setting('t.pr2')::uuid)), 2, 'as duas falhas foram registradas');
alter table public.pontos_decisao drop constraint falha_simulada;
select is(public.pontos_reprocessar_pendentes(10), 2, 'reprocessamento em lote resolve os dois pedidos');
select is(pg_temp.motivo(current_setting('t.pr1')::uuid), 'limite_diario', 'reprocessado hoje, o pedido de 10/03 é contado no dia 10/03 e C já estava no teto');
select is(pg_temp.motivo(current_setting('t.pr2')::uuid), 'limite_diario', 'o segundo também');
select is(pg_temp.saldo('cccccccc-0000-0000-0000-00000000000c'), 210, 'saldo de C: 100 (10/03) + 100 (11/03) + 10 (12/03); o reprocessamento não creditou nada');
select is(public.pontos_reprocessar_pendentes(10), 0, 'segunda rodada: nada pendente, nada duplicado');
select is((select count(*)::int from public.pontos_decisao where pedido_id in (current_setting('t.pr1')::uuid, current_setting('t.pr2')::uuid)), 2, 'uma decisão por pedido');
-- Reprocessamento administrativo de pedido já decidido não muda nada.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select set_config('t.d1', (select public.pontos_reprocessar_pedido(current_setting('t.pr1')::uuid, 'conferência')::text), true);
reset role;
select is((select id::text from public.pontos_decisao where pedido_id = current_setting('t.pr1')::uuid), current_setting('t.d1'), 'reprocessar pedido já decidido devolve a mesma decisão');
select is(pg_temp.saldo('cccccccc-0000-0000-0000-00000000000c'), 210, 'e o saldo não muda');

-- Reversão não reabre espaço no teto (o crédito revertido segue contado no dia).
select set_config('t.pedido1', (select id::text from public.indicacoes_pedido_contato where chave_idempotencia = 'chave-teto-000001'), true);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select lives_ok($$select public.pontos_reverter_credito((select id from public.administracao_pontos_lancamentos where pedido_id = current_setting('t.pedido1')::uuid), 'contato_duplicado', 'Indicação inválida')$$, 'administrador reverte um crédito de 10/03');
reset role;
select is(pg_temp.motivo(pg_temp.pedido(pg_temp.lk('cccccccc-0000-0000-0000-00000000000c'), 80, '2026-03-10 23:50:00+00')), 'limite_diario', 'depois da reversão o dia continua no teto (a reversão não devolve espaço)');
select is(pg_temp.saldo('cccccccc-0000-0000-0000-00000000000c'), 200, 'saldo: reversão de 10 aplicada');

-- ===== Leitura do indicador: só os próprios, sem dado do visitante =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is((select count(*)::int from public.pontos_meus_limites_diarios), 5, 'C vê os 5 contatos sem pontos por limite (a repetição do visitante foi dentro_do_intervalo e não entra)');
select is((select min(teto_diario) from public.pontos_meus_limites_diarios), 100, 'e o teto da época');
select is((select o_teto_diario from public.pontos_meu_limite_diario()), 100, 'a interface lê o teto vigente');
select is((select o_pontos_hoje from public.pontos_meu_limite_diario()), 0, 'e os pontos de hoje (nenhum hoje no teste)');
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-0000-0000-00000000000e","role":"authenticated"}', true);
select is((select count(*)::int from public.pontos_meus_limites_diarios), 1, 'E vê só o dela (isolamento entre indicadores)');
select set_config('request.jwt.claims', '{"sub":"99999999-0000-0000-0000-000000000009","role":"authenticated"}', true);
select is((select count(*)::int from public.pontos_meus_limites_diarios), 0, 'quem não indicou não vê nada');
select throws_ok($$select * from public.pontos_decisao$$, '42501', null, 'o indicador não lê a tabela de decisões');
select throws_ok($$update public.pontos_decisao set pontuado = true$$, '42501', null, 'nem altera decisão');
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$select * from public.pontos_meus_limites_diarios$$, '42501', null, 'anônimo não lê a visão');
select throws_ok($$select * from public.pontos_meu_limite_diario()$$, '42501', null, 'anônimo não executa a função');
reset role;

-- Histórico de decisão e de lançamento segue só de inserção.
select throws_ok($$update public.pontos_decisao set motivo = 'pontuado' where pedido_id = current_setting('t.p11')::uuid$$, '42501', null, 'decisão limite_diario não é reescrita (histórico imutável)');
select throws_ok($$delete from public.pontos_decisao where pedido_id = current_setting('t.p11')::uuid$$, '42501', null, 'nem apagada');

select * from finish();
rollback;
