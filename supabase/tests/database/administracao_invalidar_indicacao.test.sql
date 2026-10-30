-- pgTAP · invalidar indicação · Fase 6 · IM-077, IM-035, IM-078, IM-086, IM-029, D-014
-- Exige a permissão invalidar_indicacoes; reverte os pontos pela rotina existente (categoria fixa, lançamento novo que aponta o
-- original); marca a indicação; audita; idempotente; quem participa não invalida; quem só tem reverter_pontos não invalida.
begin;
select * from no_plan();
delete from public.catalogo_categoria;

-- A = responsável do perfil P1; I = indicador; K = permissão invalidar_indicacoes; M = permissão reverter_pontos; G = comum.
insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@teste.local'),
  ('11111111-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'i@teste.local'),
  ('cccccccc-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'k@teste.local'),
  ('dddddddd-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd@teste.local'),
  ('eeeeeeee-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'm@teste.local'),
  ('99999999-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'g@teste.local');
insert into public.administracao_administrador (conta_id) values ('dddddddd-0000-0000-0000-00000000000d');
insert into public.administracao_permissao (conta_id, permissao, concedida_por, motivo) values
  ('cccccccc-0000-0000-0000-00000000000c', 'invalidar_indicacoes', 'dddddddd-0000-0000-0000-00000000000d', 'teste'),
  ('eeeeeeee-0000-0000-0000-00000000000e', 'reverter_pontos', 'dddddddd-0000-0000-0000-00000000000d', 'teste'),
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'invalidar_indicacoes', 'dddddddd-0000-0000-0000-00000000000d', 'teste');
update public.contas_conta set whatsapp_e164 = '+5551999990001' where id = '11111111-0000-0000-0000-00000000000a';
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

-- Link do indicador I e três pedidos: P1 e P3 pelo link (pontuam), P2 sem link.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$select * from public.indicacoes_gerar_link(p_perfil_id => 'a0000000-0000-0000-0000-000000000001')$$, 'I gera o link do perfil');
select set_config('t.cod', (select codigo from public.indicacoes_meus_links where destino_id = 'a0000000-0000-0000-0000-000000000001'), true);
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select lives_ok($$select * from public.indicacoes_enviar_contato(p_perfil_id => 'a0000000-0000-0000-0000-000000000001', p_item_id => null,
  p_nome => 'Visitante Um', p_whatsapp => '+5511988880001', p_chave => 'chave-inval-0000001', p_codigo => current_setting('t.cod'))$$, 'pedido 1 pelo link');
select lives_ok($$select * from public.indicacoes_enviar_contato(p_perfil_id => 'a0000000-0000-0000-0000-000000000001', p_item_id => null,
  p_nome => 'Visitante Dois', p_whatsapp => '+5511988880002', p_chave => 'chave-inval-0000002')$$, 'pedido 2 sem link');
select lives_ok($$select * from public.indicacoes_enviar_contato(p_perfil_id => 'a0000000-0000-0000-0000-000000000001', p_item_id => null,
  p_nome => 'Visitante Tres', p_whatsapp => '+5511988880003', p_chave => 'chave-inval-0000003', p_codigo => current_setting('t.cod'))$$, 'pedido 3 pelo link');
reset role;
select set_config('t.p1', (select id::text from public.indicacoes_pedido_contato where whatsapp_e164 = '+5511988880001'), true);
select set_config('t.p2', (select id::text from public.indicacoes_pedido_contato where whatsapp_e164 = '+5511988880002'), true);
select set_config('t.p3', (select id::text from public.indicacoes_pedido_contato where whatsapp_e164 = '+5511988880003'), true);
select is((select count(*)::int from public.pontos_lancamento where tipo = 'credito'), 2, 'baseline: dois créditos (pedidos 1 e 3)');
select set_config('t.cred3', (select id::text from public.pontos_lancamento where pedido_id = current_setting('t.p3')::uuid and tipo = 'credito'), true);

-- ===== Estrutura =====
select is((select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.administracao_invalidacao_indicacao'::regclass), true, 'RLS ativa e forçada');
select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'administracao_invalidacao_indicacao'), 4, 'uma política por operação');
select is((select bool_or(has_table_privilege(r, 'public.administracao_invalidacao_indicacao', p))
  from unnest(array['anon', 'authenticated']) r, unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) p), false, 'sem privilégio direto');
select columns_are('public', 'administracao_indicacoes_invalidadas', array['pedido_id', 'motivo', 'tem_reversao', 'autor_ref', 'criado_em'], 'a visão não traz id de conta nem dado do visitante');
select is(has_function_privilege('anon', 'public.administracao_invalidar_indicacao(uuid,text,boolean)', 'EXECUTE'), false, 'anon não invalida');

-- ===== Sem permissão =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"99999999-0000-0000-0000-000000000009","role":"authenticated"}', true);
select throws_ok($$select public.administracao_invalidar_indicacao(current_setting('t.p1')::uuid, 'tentativa')$$, '42501', null, 'usuário comum não invalida');
select is((select count(*)::int from public.administracao_indicacoes_invalidadas), 0, 'usuário comum não lê as invalidações');
select throws_ok($$select * from public.administracao_invalidacao_indicacao$$, '42501', null, 'nem a tabela');
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-0000-0000-00000000000e","role":"authenticated"}', true);
select throws_ok($$select public.administracao_invalidar_indicacao(current_setting('t.p1')::uuid, 'tentativa')$$, '42501', null, 'quem só tem reverter_pontos não invalida indicação');
reset role;

-- ===== K invalida o pedido 1 (com crédito) =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select throws_ok($$select public.administracao_invalidar_indicacao(current_setting('t.p1')::uuid, '')$$, '22023', null, 'motivo obrigatório');
select throws_ok($$select public.administracao_invalidar_indicacao(gen_random_uuid(), 'x')$$, 'P0002', null, 'pedido inexistente');
select set_config('t.rev1', (select public.administracao_invalidar_indicacao(current_setting('t.p1')::uuid, 'Indicação combinada entre as partes')::text), true);
select ok(current_setting('t.rev1') <> '', 'devolve o lançamento de reversão');
select is((select count(*)::int from public.administracao_pontos_lancamentos where tipo = 'reversao'), 1, 'K enxerga a reversão pela visão de pontos');
reset role;
select is((select pontos from public.pontos_lancamento where id = current_setting('t.rev1')::uuid), -10, 'reversão de -10 pontos');
select is((select categoria from public.pontos_lancamento where id = current_setting('t.rev1')::uuid), 'indicacao_invalida', 'categoria fixa indicacao_invalida');
select is((select autor_id from public.pontos_lancamento where id = current_setting('t.rev1')::uuid), 'cccccccc-0000-0000-0000-00000000000c'::uuid, 'autor da reversão é K');
select is((select original_id from public.pontos_lancamento where id = current_setting('t.rev1')::uuid),
  (select id from public.pontos_lancamento where pedido_id = current_setting('t.p1')::uuid and tipo = 'credito'), 'a reversão aponta o crédito original');
select is((select pontos from public.pontos_lancamento where pedido_id = current_setting('t.p1')::uuid and tipo = 'credito'), 10, 'o crédito original não foi alterado');
select is((select count(*)::int from public.administracao_invalidacao_indicacao where pedido_id = current_setting('t.p1')::uuid
  and reversao_id = current_setting('t.rev1')::uuid and autor_id = 'cccccccc-0000-0000-0000-00000000000c'), 1, 'indicação marcada como invalidada');
select is((select count(*)::int from public.administracao_auditoria where acao = 'invalidar_indicacao' and alvo_id = current_setting('t.p1')
  and autor_id = 'cccccccc-0000-0000-0000-00000000000c' and motivo = 'Indicação combinada entre as partes'
  and valor_anterior ->> 'situacao' = 'valida' and valor_novo ->> 'situacao' = 'invalidada'), 1, 'auditoria da invalidação (autor, motivo, valor anterior)');
select is((select count(*)::int from public.administracao_auditoria where acao = 'reverter_pontos' and autor_id = 'cccccccc-0000-0000-0000-00000000000c'), 1, 'a reversão também fica auditada pela rotina existente');

-- O indicador vê só a categoria; o motivo interno não é coluna da visão dele.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is((select categoria from public.pontos_meus_lancamentos where tipo = 'reversao'), 'indicacao_invalida', 'o indicador vê a categoria da reversão');
select is((select saldo from public.pontos_meu_saldo), 10, 'saldo do indicador: 20 creditados menos 10 revertidos');
select is((select count(*)::int from public.administracao_indicacoes_invalidadas), 0, 'o indicador não vê a lista de invalidações');
reset role;

-- ===== Idempotência =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is((select public.administracao_invalidar_indicacao(current_setting('t.p1')::uuid, 'repetida')::text), current_setting('t.rev1'), 'repetir devolve a mesma reversão');
reset role;
select is((select count(*)::int from public.pontos_lancamento where tipo = 'reversao'), 1, 'sem segunda reversão');
select is((select count(*)::int from public.administracao_auditoria where acao = 'invalidar_indicacao' and alvo_id = current_setting('t.p1')), 1, 'sem segunda auditoria');

-- ===== Pedido sem crédito (sem link) =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is((select public.administracao_invalidar_indicacao(current_setting('t.p2')::uuid, 'Contato falso')), null, 'pedido sem crédito: marca sem reverter nada');
-- A delegação interna não vaza: K continua sem poder reverter pontos diretamente.
select throws_ok($$select public.pontos_reverter_credito(current_setting('t.cred3')::uuid, 'fraude', 'direto')$$,
  '42501', null, 'K não reverte pontos diretamente (só tem invalidar_indicacoes)');
reset role;
select is((select count(*)::int from public.pontos_lancamento where tipo = 'reversao'), 1, 'nenhuma reversão a mais');

-- ===== Conflito de interesse =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok($$select public.administracao_invalidar_indicacao(current_setting('t.p3')::uuid, 'Sou o responsável')$$, '42501', null, 'o responsável pelo destino não invalida indicação do próprio perfil');
reset role;

-- ===== M reverte o crédito do pedido 3 direto; depois K invalida e reaproveita a reversão =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-0000-0000-00000000000e","role":"authenticated"}', true);
select set_config('t.rev3', (select public.pontos_reverter_credito(current_setting('t.cred3')::uuid, 'fraude', 'Observação interna')::text), true);
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is((select public.administracao_invalidar_indicacao(current_setting('t.p3')::uuid, 'Fraude confirmada')::text), current_setting('t.rev3'), 'crédito já revertido: a invalidação reaproveita a reversão existente');
select is((select count(*)::int from public.administracao_indicacoes_invalidadas), 3, 'K lista as três indicações invalidadas');
reset role;
select is((select count(*)::int from public.pontos_lancamento where tipo = 'reversao'), 2, 'sem reversão duplicada');

-- ===== Histórico imutável =====
select throws_ok($$delete from public.administracao_invalidacao_indicacao$$, '42501', null, 'a marca de invalidação não é apagada');
select throws_ok($$update public.administracao_invalidacao_indicacao set motivo = 'x'$$, '42501', null, 'nem alterada');
select throws_ok($$update public.pontos_lancamento set pontos = 0$$, '42501', null, 'lançamentos seguem só de inserção');

select * from finish();
rollback;
