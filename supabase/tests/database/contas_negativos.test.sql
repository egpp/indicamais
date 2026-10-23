-- pgTAP · módulo contas · testes negativos do verificador · IM-006, IM-009, IM-086
begin;
select plan(21);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('aaaaaaaa-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a1@teste.local', '{"full_name":"Ana"}'),
  ('bbbbbbbb-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b1@teste.local', '{}'),
  ('cccccccc-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c1@teste.local', jsonb_build_object('full_name', repeat('x', 200))),
  ('dddddddd-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd1@teste.local', '{"full_name":"   "}'),
  ('eeeeeeee-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'e1@teste.local', null);

-- Gatilho do Auth com entradas hostis: o cadastro nunca falha e o nome respeita 1-80
select is((select char_length(nome_exibicao) from public.contas_conta where id = 'cccccccc-0000-0000-0000-0000000000c1'), 80, 'nome de 200 caracteres é truncado em 80, sem derrubar o cadastro');
select is((select nome_exibicao from public.contas_conta where id = 'dddddddd-0000-0000-0000-0000000000d1'), null, 'nome só com espaços vira nulo');
select is((select count(*)::int from public.contas_conta where id = 'eeeeeeee-0000-0000-0000-0000000000e1'), 1, 'metadado nulo ainda cria a conta');
select cmp_ok((select count(*)::int from public.contas_conta where whatsapp_e164 is null), '>=', 3, 'várias contas sem WhatsApp convivem (unicidade só vale para números)');

-- on delete restrict
select throws_ok($$delete from auth.users where id = 'aaaaaaaa-0000-0000-0000-0000000000a1'$$, '23503', null, 'apagar usuário do Auth com conta é bloqueado (restrict)');

-- Constraints valem até para superusuário/service_role
select throws_ok($$update public.contas_conta set whatsapp_verificado = true where id = 'aaaaaaaa-0000-0000-0000-0000000000a1'$$, '23514', null, 'nem superusuário marca whatsapp_verificado nesta fase');
select throws_ok($$update public.contas_conta set whatsapp_e164 = E'+5511999990001\n' where id = 'aaaaaaaa-0000-0000-0000-0000000000a1'$$, '23514', null, 'quebra de linha no fim do número é rejeitada');
select throws_ok($$update public.contas_conta set whatsapp_e164 = '+5511999990001 ' where id = 'aaaaaaaa-0000-0000-0000-0000000000a1'$$, '23514', null, 'espaço no fim do número é rejeitado');
select throws_ok($$update public.contas_conta set whatsapp_e164 = '+55١١٩٩٩٩٩٠٠٠١' where id = 'aaaaaaaa-0000-0000-0000-0000000000a1'$$, '23514', null, 'dígitos não ASCII são rejeitados');
select throws_ok($$update public.contas_conta set whatsapp_e164 = '+55119999900012345' where id = 'aaaaaaaa-0000-0000-0000-0000000000a1'$$, '23514', null, 'número longo demais é rejeitado');

-- Como A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

select lives_ok($$update public.contas_conta set whatsapp_e164 = '+5511999990010' where id = auth.uid()$$, 'A grava o WhatsApp');
select is((select count(*)::int from public.contas_whatsapp_historico where conta_id = auth.uid() and whatsapp_anterior_e164 is null and whatsapp_novo_e164 = '+5511999990010' and autor_id = auth.uid()), 1, 'histórico registra anterior, novo e autor');
select throws_ok($$update public.contas_conta set nome_exibicao = '' where id = auth.uid()$$, '23514', null, 'nome vazio rejeitado pelo banco');
select throws_ok($$update public.contas_conta set nome_exibicao = repeat('y', 81) where id = auth.uid()$$, '23514', null, 'nome de 81 caracteres rejeitado pelo banco');
select throws_ok($$insert into public.contas_whatsapp_historico (conta_id, whatsapp_novo_e164) values (auth.uid(), '+5511999990011')$$, '42501', null, 'cliente não insere no histórico');
select throws_ok($$select public.contas_criar_conta_do_auth()$$, '42501', null, 'cliente não chama a função de gatilho de criação');
select throws_ok($$select public.contas_conta_registrar_whatsapp()$$, '42501', null, 'cliente não chama a função de gatilho do histórico');
-- A tenta mudar o WhatsApp de B: RLS zera o efeito (conferido adiante)
update public.contas_conta set whatsapp_e164 = '+5511999990099' where id = 'bbbbbbbb-0000-0000-0000-0000000000b1';

-- Sessão sem identidade (auth.uid() nulo)
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select is((select count(*)::int from public.contas_conta) + (select count(*)::int from public.contas_whatsapp_historico), 0, 'sem identidade não lê nada');

-- anon
reset role;
set local role anon;
select throws_ok($$select public.contas_pode_indicar()$$, '42501', null, 'anon não executa contas_pode_indicar');
select throws_ok($$select * from public.contas_whatsapp_historico$$, '42501', null, 'anon não lê o histórico');

reset role;
select is((select whatsapp_e164 from public.contas_conta where id = 'bbbbbbbb-0000-0000-0000-0000000000b1'), null, 'A não alterou o WhatsApp de B');

select * from finish();
rollback;
