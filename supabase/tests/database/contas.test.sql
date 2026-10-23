-- pgTAP · módulo contas · IM-006, IM-009, IM-086
begin;
select plan(22);

-- Usuários criados como superusuário; o gatilho cria as contas.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@teste.local', '{"full_name":"Ana"}'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@teste.local', '{}');

select is((select count(*)::int from public.contas_conta where id in ('aaaaaaaa-0000-0000-0000-00000000000a','bbbbbbbb-0000-0000-0000-00000000000b')), 2, 'gatilho criou as duas contas');
select is((select nome_exibicao from public.contas_conta where id = 'aaaaaaaa-0000-0000-0000-00000000000a'), 'Ana', 'nome vem do metadado');
select is((select whatsapp_verificado from public.contas_conta where id = 'aaaaaaaa-0000-0000-0000-00000000000a'), false, 'nasce não verificado');
select is((select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.contas_conta'::regclass), true, 'RLS ativa em contas_conta');
select is((select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.contas_whatsapp_historico'::regclass), true, 'RLS ativa no histórico');

-- Como usuário A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select is((select count(*)::int from public.contas_conta), 1, 'A vê só 1 conta');
select is((select count(*)::int from public.contas_conta where id = 'bbbbbbbb-0000-0000-0000-00000000000b'), 0, 'A não lê a conta de B');
select is(public.contas_pode_indicar(), false, 'sem WhatsApp não pode indicar');
select lives_ok($$update public.contas_conta set whatsapp_e164 = '+5511999990001' where id = auth.uid()$$, 'A grava o próprio WhatsApp');
select is(public.contas_pode_indicar(), true, 'com WhatsApp pode indicar');

-- A tenta alterar B: RLS faz a atualização afetar 0 linhas (conferido no fim, como superusuário)
update public.contas_conta set nome_exibicao = 'invadido' where id = 'bbbbbbbb-0000-0000-0000-00000000000b';
select throws_ok($$update public.contas_conta set whatsapp_verificado = true where id = auth.uid()$$, '42501', null, 'cliente não marca whatsapp_verificado');
select throws_ok($$update public.contas_conta set id = gen_random_uuid() where id = auth.uid()$$, '42501', null, 'cliente não altera id');
select throws_ok($$insert into public.contas_conta (id) values (gen_random_uuid())$$, null, null, 'cliente não insere conta');
select throws_ok($$delete from public.contas_conta$$, '42501', null, 'cliente não apaga conta');
select throws_ok($$update public.contas_whatsapp_historico set whatsapp_novo_e164 = null$$, '42501', null, 'cliente não altera histórico');

-- Como usuário B
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select throws_ok($$update public.contas_conta set whatsapp_e164 = '+5511999990001' where id = auth.uid()$$, '23505', null, 'WhatsApp duplicado é rejeitado');
select throws_ok($$update public.contas_conta set whatsapp_e164 = '11999990002' where id = auth.uid()$$, '23514', null, 'WhatsApp sem +55 é rejeitado');
select throws_ok($$update public.contas_conta set whatsapp_e164 = '+551199' where id = auth.uid()$$, '23514', null, 'WhatsApp curto é rejeitado');
select is((select count(*)::int from public.contas_whatsapp_historico), 0, 'B não vê histórico de A');

-- anon
reset role;
set local role anon;
select throws_ok($$select * from public.contas_conta$$, '42501', null, 'anon não lê contas');

reset role;
-- Como superusuário: B não foi alterada por A; histórico imutável
select is((select nome_exibicao from public.contas_conta where id = 'bbbbbbbb-0000-0000-0000-00000000000b'), null, 'conta de B não foi alterada por A');
select throws_ok($$delete from public.contas_whatsapp_historico$$, '42501', null, 'histórico imutável até para superusuário');

select * from finish();
rollback;
