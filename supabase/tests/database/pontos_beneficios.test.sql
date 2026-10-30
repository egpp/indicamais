-- pgTAP · módulo pontos · cadastro de benefícios (versões, revisão, visão pública, sem resgate) · Fase 4
-- IM-036, IM-037 (nada de resgate), IM-038, IM-077, IM-079, IM-086
begin;
select * from no_plan();
delete from public.catalogo_categoria;

-- Contas: A (responsável de P1 e P2), C (outra conta), D (administrador e responsável de P4).
insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@teste.local'),
  ('cccccccc-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c@teste.local'),
  ('dddddddd-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd@teste.local');
insert into public.administracao_administrador (conta_id) values ('dddddddd-0000-0000-0000-00000000000d');
insert into public.catalogo_categoria (id, nome, slug, ativa, ordem) values
  ('11111111-0000-0000-0000-000000000001', 'Alimentação', 'alimentacao', true, 1);
insert into public.perfis_perfil (id, responsavel_id, slug) values
  ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a', 'loja-um'),
  ('a0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-00000000000a', 'loja-dois'),
  ('a0000000-0000-0000-0000-000000000004', 'dddddddd-0000-0000-0000-00000000000d', 'loja-do-admin');
insert into public.perfis_perfil_versao (id, perfil_id, nome, descricao_breve, imagem_path, categoria_principal_id, cidade, uf) values
  ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Loja Um', 'Doces', 'perfil/a0000000-0000-0000-0000-000000000001/c.jpg', '11111111-0000-0000-0000-000000000001', 'Porto Alegre', 'RS'),
  ('a1000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'Loja Dois', 'Doces', 'perfil/a0000000-0000-0000-0000-000000000002/c.jpg', '11111111-0000-0000-0000-000000000001', 'Canoas', 'RS'),
  ('a1000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000004', 'Loja do Admin', 'Doces', 'perfil/a0000000-0000-0000-0000-000000000004/c.jpg', '11111111-0000-0000-0000-000000000001', 'Canoas', 'RS');
insert into public.perfis_perfil_versao_contato (versao_id, whatsapp_comercial_e164) values
  ('a1000000-0000-0000-0000-000000000001', '+5551988880001'),
  ('a1000000-0000-0000-0000-000000000002', '+5551988880002'),
  ('a1000000-0000-0000-0000-000000000004', '+5551988880004');
update public.perfis_perfil_versao set situacao = 'pendente', enviada_em = now() where perfil_id in ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000004');
update public.perfis_perfil_versao set situacao = 'aprovada' where perfil_id in ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000004');
update public.perfis_perfil set versao_aprovada_id = 'a1000000-0000-0000-0000-000000000001', publicado = true where id = 'a0000000-0000-0000-0000-000000000001';
update public.perfis_perfil set versao_aprovada_id = 'a1000000-0000-0000-0000-000000000002', publicado = false where id = 'a0000000-0000-0000-0000-000000000002';
update public.perfis_perfil set versao_aprovada_id = 'a1000000-0000-0000-0000-000000000004', publicado = true where id = 'a0000000-0000-0000-0000-000000000004';

-- ===== Estrutura =====
select is((select bool_and(relrowsecurity and relforcerowsecurity) from pg_class where oid = any(array[
  'public.pontos_beneficio'::regclass, 'public.pontos_beneficio_versao'::regclass, 'public.pontos_beneficio_revisao'::regclass])),
  true, 'RLS ativa e forçada nas 3 tabelas de benefício');
select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'pontos_beneficio'), 6, 'pontos_beneficio: políticas por operação (3 select + 3 negados)');
select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'pontos_beneficio_versao'), 6, 'pontos_beneficio_versao: políticas por operação');
select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'pontos_beneficio_revisao'), 5, 'pontos_beneficio_revisao: políticas por operação');
select is((select bool_or(has_table_privilege(r, t, p))
  from unnest(array['anon', 'authenticated']) r,
  unnest(array['public.pontos_beneficio', 'public.pontos_beneficio_versao', 'public.pontos_beneficio_revisao']) t,
  unnest(array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) p), false, 'nenhum papel de API escreve direto nas tabelas de benefício');
select is(has_table_privilege('anon', 'public.pontos_beneficio_revisao', 'SELECT'), false, 'anon não lê revisões');
select is(has_column_privilege('authenticated', 'public.pontos_beneficio_revisao', 'autor_id', 'SELECT'), false, 'ninguém lê o id real do administrador na revisão');
select is(has_function_privilege('anon', 'public.pontos_criar_beneficio(uuid,text,text,integer,text,integer,integer,date,integer)', 'EXECUTE')
  or has_function_privilege('anon', 'public.pontos_decidir_beneficio_versao(uuid,boolean,text)', 'EXECUTE')
  or has_function_privilege('anon', 'public.pontos_responder_proposta_beneficio(uuid,boolean,text)', 'EXECUTE')
  or has_function_privilege('anon', 'public.pontos_admin_editar_proposta_beneficio(uuid,text,text,integer,text,text,integer,integer,date,integer)', 'EXECUTE')
  or has_function_privilege('anon', 'public.pontos_admin_cadastrar_beneficio(uuid,text,text,integer,text,text,integer,integer,date,integer)', 'EXECUTE'), false, 'anon não executa funções de benefício');
select is((select count(*)::int from information_schema.columns where table_schema = 'public' and table_name = 'pontos_beneficio_versao' and column_name = 'prazo_uso_ate'), 0, 'prazo de uso não é mais data');
select is((select data_type from information_schema.columns where table_schema = 'public' and table_name = 'pontos_beneficio_versao' and column_name = 'prazo_resgate_ate'), 'date', 'prazo de resgate é data');
select is((select data_type from information_schema.columns where table_schema = 'public' and table_name = 'pontos_beneficio_versao' and column_name = 'prazo_uso_dias'), 'integer', 'prazo de uso é número de dias depois do resgate');
select columns_are('public', 'pontos_beneficio_publico', array['id', 'perfil_id', 'nome', 'descricao', 'pontos_necessarios', 'condicoes', 'limite_total', 'limite_por_pessoa', 'prazo_resgate_ate', 'prazo_uso_dias', 'criado_em'],
  'visão pública sem conta, sem autor e sem ação de resgate');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname ~* '(resgat|cupom|sorteio)'), 0, 'não existe ação de resgate, cupom nem sorteio');

-- ===== Responsável propõe =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok($$select * from public.pontos_criar_beneficio(p_perfil_id => 'a0000000-0000-0000-0000-000000000004', p_nome => 'X', p_descricao => 'Y', p_pontos_necessarios => 50)$$,
  '42501', null, 'responsável não cria benefício em perfil de outra conta');
select throws_ok($$select * from public.pontos_criar_beneficio(p_perfil_id => 'a0000000-0000-0000-0000-000000000002', p_nome => 'Café', p_descricao => 'Um café', p_pontos_necessarios => 50)$$,
  'P0002', null, 'benefício só para perfil disponível (IM-036, IM-079)');
select throws_ok($$select * from public.pontos_criar_beneficio(p_perfil_id => 'a0000000-0000-0000-0000-000000000001', p_nome => 'Café', p_descricao => 'Um café', p_pontos_necessarios => 0)$$,
  '23514', null, 'pontos necessários precisam ser positivos');
select throws_ok($$select * from public.pontos_criar_beneficio(p_perfil_id => 'a0000000-0000-0000-0000-000000000001', p_nome => 'Café', p_descricao => 'Um café', p_pontos_necessarios => 50, p_limite_total => 5, p_limite_por_pessoa => 6)$$,
  '23514', null, 'limite por pessoa não passa do limite total');
select throws_ok($$select * from public.pontos_criar_beneficio(p_perfil_id => 'a0000000-0000-0000-0000-000000000001', p_nome => 'Café', p_descricao => 'Um café', p_pontos_necessarios => 50, p_prazo_uso_dias => 0)$$,
  '23514', null, 'prazo de uso precisa ser de pelo menos 1 dia depois do resgate');
select set_config('t.b1', r.o_beneficio_id::text, true), set_config('t.v1', r.o_versao_id::text, true)
  from public.pontos_criar_beneficio(p_perfil_id => 'a0000000-0000-0000-0000-000000000001', p_nome => 'Café grátis', p_descricao => 'Um café de cortesia',
    p_pontos_necessarios => 50, p_condicoes => 'Uma vez por visita', p_limite_total => 100, p_limite_por_pessoa => 2,
    p_prazo_resgate_ate => current_date + 30, p_prazo_uso_dias => 15) r;
select is((select situacao from public.pontos_beneficio_versao where id = current_setting('t.v1')::uuid), 'rascunho', 'benefício nasce em rascunho');
select is((select ativo from public.pontos_beneficio where id = current_setting('t.b1')::uuid), false, 'e inativo');
select throws_ok($$select public.pontos_definir_beneficio_ativo(current_setting('t.b1')::uuid, true)$$, 'P0001', null, 'sem versão aprovada não se ativa');
select throws_ok($$select public.pontos_decidir_beneficio_versao(current_setting('t.v1')::uuid, true)$$, '42501', null, 'responsável não aprova (nem o próprio)');
select lives_ok($$select public.pontos_enviar_beneficio_versao(current_setting('t.v1')::uuid)$$, 'responsável envia para análise (proposto)');
select throws_ok($$select public.pontos_enviar_beneficio_versao(current_setting('t.v1')::uuid)$$, 'P0001', null, 'só rascunho é enviado');
select throws_ok($$select public.pontos_salvar_beneficio(current_setting('t.b1')::uuid, 'Novo nome', 'Descrição', 50)$$, 'P0001', null, 'versão em análise não é editada');
select is((select count(*)::int from public.administracao_fila_beneficios), 0, 'responsável não vê a fila do administrador');
reset role;

select is((select count(*)::int from public.pontos_beneficio_publico), 0, 'proposto não aparece na vista pública');

-- Dono = administrador: não aprova o próprio benefício.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select set_config('t.b4', r.o_beneficio_id::text, true), set_config('t.v4', r.o_versao_id::text, true)
  from public.pontos_criar_beneficio(p_perfil_id => 'a0000000-0000-0000-0000-000000000004', p_nome => 'Brinde', p_descricao => 'Um brinde', p_pontos_necessarios => 20) r;
select lives_ok($$select public.pontos_enviar_beneficio_versao(current_setting('t.v4')::uuid)$$, 'administrador, como responsável do próprio perfil, propõe');
select throws_ok($$select public.pontos_decidir_beneficio_versao(current_setting('t.v4')::uuid, true)$$, '42501', null, 'o dono nunca aprova o próprio benefício, mesmo sendo administrador');
select throws_ok($$select * from public.pontos_admin_cadastrar_beneficio(p_perfil_id => 'a0000000-0000-0000-0000-000000000004', p_nome => 'Auto', p_descricao => 'Auto', p_pontos_necessarios => 10, p_motivo => 'teste')$$,
  '42501', null, 'administrador não cadastra benefício já aprovado no próprio perfil');

-- ===== Administrador decide =====
select is((select count(*)::int from public.administracao_fila_beneficios), 2, 'administrador vê os dois benefícios pendentes');
select is((select eh_edicao from public.administracao_fila_beneficios where versao_id = current_setting('t.v1')::uuid), false, 'primeira versão não é edição');
select throws_ok($$select public.pontos_decidir_beneficio_versao(current_setting('t.v1')::uuid, false)$$, '22023', null, 'rejeição exige motivo');
select throws_ok($$select public.pontos_decidir_beneficio_versao(gen_random_uuid(), true)$$, 'P0002', null, 'versão inexistente');
select lives_ok($$select public.pontos_decidir_beneficio_versao(current_setting('t.v1')::uuid, false, 'Descrição vaga demais')$$, 'administrador rejeita com motivo');
select throws_ok($$select public.pontos_decidir_beneficio_versao(current_setting('t.v1')::uuid, true)$$, 'P0001', null, 'versão já decidida não é decidida de novo');
reset role;
select is((select situacao from public.pontos_beneficio_versao where id = current_setting('t.v1')::uuid), 'rejeitada', 'versão rejeitada');
select is((select acao from public.administracao_auditoria where alvo_id = current_setting('t.v1')), 'rejeitar_beneficio', 'rejeição auditada');
select is((select motivo from public.administracao_auditoria where alvo_id = current_setting('t.v1')), 'Descrição vaga demais', 'auditoria guarda o motivo');
select is((select autor_id from public.administracao_auditoria where alvo_id = current_setting('t.v1')), 'dddddddd-0000-0000-0000-00000000000d'::uuid, 'auditoria guarda o autor');
select is((select valor_anterior ->> 'situacao' from public.administracao_auditoria where alvo_id = current_setting('t.v1')), 'pendente', 'auditoria guarda a situação anterior');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is((select motivo from public.pontos_beneficio_revisao where versao_id = current_setting('t.v1')::uuid), 'Descrição vaga demais', 'o responsável lê o motivo da rejeição');
select throws_ok($$select autor_id from public.pontos_beneficio_revisao$$, '42501', null, 'mas não lê quem decidiu');
-- Nova proposta depois da rejeição: salvar cria nova versão em rascunho.
select set_config('t.v2', (select public.pontos_salvar_beneficio(current_setting('t.b1')::uuid, 'Café grátis', 'Um café de cortesia, com bebida à escolha', 50,
  'Uma vez por visita', 100, 2, current_date + 30, 15))::text, true);
select isnt(current_setting('t.v2'), current_setting('t.v1'), 'nova versão em rascunho depois da rejeição');
select set_config('t.v2b', (select public.pontos_salvar_beneficio(current_setting('t.b1')::uuid, 'Café grátis', 'Um café de cortesia, com bebida à escolha e acompanhamento', 50))::text, true);
select is(current_setting('t.v2b'), current_setting('t.v2'), 'salvar de novo atualiza o mesmo rascunho');
select lives_ok($$select public.pontos_enviar_beneficio_versao(current_setting('t.v2')::uuid)$$, 'reenvia');
reset role;
select is((select prazo_resgate_ate is not null and prazo_uso_dias = 15 from public.pontos_beneficio_versao where id = current_setting('t.v1')::uuid), true, 'prazo de resgate (data) e prazo de uso (dias depois do resgate) são campos separados');
select is((select prazo_resgate_ate is null and prazo_uso_dias is null and limite_total is null and condicoes is null from public.pontos_beneficio_versao where id = current_setting('t.v2')::uuid), true, 'prazos, limites e condições são opcionais');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select lives_ok($$select public.pontos_decidir_beneficio_versao(current_setting('t.v2')::uuid, true)$$, 'administrador aprova a nova versão');
reset role;
select is((select versao_aprovada_id from public.pontos_beneficio where id = current_setting('t.b1')::uuid), current_setting('t.v2')::uuid, 'a versão aprovada é a nova');
select is((select acao from public.administracao_auditoria where alvo_id = current_setting('t.v2')), 'aprovar_beneficio', 'aprovação auditada');
select is((select count(*)::int from public.pontos_beneficio_publico), 0, 'aprovado mas ainda inativo: fora da vista pública');

-- ===== Ativar e visão pública =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select throws_ok($$select public.pontos_definir_beneficio_ativo(current_setting('t.b1')::uuid, true)$$, '42501', null, 'outra conta não ativa benefício alheio');
select throws_ok($$select public.pontos_salvar_beneficio(current_setting('t.b1')::uuid, 'Invasão', 'Invasão', 1)$$, '42501', null, 'outra conta não edita benefício alheio');
select is((select count(*)::int from public.pontos_beneficio_versao), 0, 'outra conta não lê versões em rascunho nem pendentes de terceiros');
select is((select count(*)::int from public.pontos_beneficio_revisao), 0, 'outra conta não lê revisões');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$select public.pontos_definir_beneficio_ativo(current_setting('t.b1')::uuid, true)$$, 'responsável ativa o benefício aprovado');
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.pontos_beneficio_publico), 1, 'visitante vê o benefício aprovado e ativo');
select is((select nome from public.pontos_beneficio_publico), 'Café grátis', 'com o nome da versão aprovada');
select is((select pontos_necessarios from public.pontos_beneficio_publico), 50, 'e os pontos necessários');
select is((select count(*)::int from public.pontos_beneficio_versao), 1, 'anon só lê a versão aprovada em uso (nada de rascunho, pendente ou rejeitada)');
select throws_ok($$update public.pontos_beneficio set ativo = false$$, '42501', null, 'anon não altera benefício');
select throws_ok($$select public.pontos_definir_beneficio_ativo(current_setting('t.b1')::uuid, false)$$, '42501', null, 'anon não liga/desliga');
reset role;

-- ===== Editar benefício aprovado cria nova versão e mantém a aprovada =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select set_config('t.v3', (select public.pontos_salvar_beneficio(current_setting('t.b1')::uuid, 'Café e bolo', 'Café com bolo de cortesia', 80))::text, true);
select isnt(current_setting('t.v3'), current_setting('t.v2'), 'editar o aprovado cria nova versão');
select lives_ok($$select public.pontos_enviar_beneficio_versao(current_setting('t.v3')::uuid)$$, 'envia a edição');
reset role;
select is((select versao_aprovada_id from public.pontos_beneficio where id = current_setting('t.b1')::uuid), current_setting('t.v2')::uuid, 'a versão aprovada continua a mesma enquanto a edição está pendente');
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select nome from public.pontos_beneficio_publico), 'Café grátis', 'a vista pública segue com a versão aprovada');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select is((select eh_edicao from public.administracao_fila_beneficios where versao_id = current_setting('t.v3')::uuid), true, 'na fila, a edição é marcada como edição');
select lives_ok($$select public.pontos_decidir_beneficio_versao(current_setting('t.v3')::uuid, true)$$, 'administrador aprova a edição');
reset role;
select is((select versao_aprovada_anterior_id from public.pontos_beneficio_revisao where versao_id = current_setting('t.v3')::uuid), current_setting('t.v2')::uuid, 'a revisão guarda a versão aprovada anterior');
select is((select count(*)::int from public.pontos_beneficio_versao where beneficio_id = current_setting('t.b1')::uuid and situacao = 'aprovada'), 2, 'as versões antigas ficam como histórico');
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select nome from public.pontos_beneficio_publico), 'Café e bolo', 'depois da aprovação, a vista pública usa a nova versão');
reset role;
select throws_ok($$update public.pontos_beneficio_versao set nome = 'Trocado' where id = current_setting('t.v2')::uuid$$, '42501', null, 'versão enviada é imutável (nem o superusuário altera o conteúdo)');
select throws_ok($$delete from public.pontos_beneficio_versao where id = current_setting('t.v2')::uuid$$, '42501', null, 'versão enviada não é apagada');
select throws_ok($$update public.pontos_beneficio_revisao set motivo = 'x'$$, '42501', null, 'revisão é só de inserção');
select throws_ok($$delete from public.pontos_beneficio_revisao$$, '42501', null, 'revisão não é apagada');

-- ===== Perfil indisponível retira o benefício (IM-079) =====
update public.perfis_perfil set publicado = false where id = 'a0000000-0000-0000-0000-000000000001';
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.pontos_beneficio_publico), 0, 'perfil despublicado: o benefício sai da vista pública');
select is((select count(*)::int from public.pontos_beneficio), 0, 'e da tabela, para o visitante');
select is((select count(*)::int from public.pontos_beneficio_versao), 0, 'e as versões deixam de ser legíveis');
reset role;
update public.perfis_perfil set publicado = true where id = 'a0000000-0000-0000-0000-000000000001';
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.pontos_beneficio_publico), 1, 'republicado o perfil, o benefício volta (nada foi apagado)');
reset role;

-- ===== Administrador cadastra e gerencia =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select throws_ok($$select * from public.pontos_admin_cadastrar_beneficio(p_perfil_id => 'a0000000-0000-0000-0000-000000000001', p_nome => 'X', p_descricao => 'Y', p_pontos_necessarios => 10, p_motivo => 'm')$$,
  '42501', null, 'não administrador não cadastra como administrador');
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select throws_ok($$select * from public.pontos_admin_cadastrar_beneficio(p_perfil_id => 'a0000000-0000-0000-0000-000000000001', p_nome => 'X', p_descricao => 'Y', p_pontos_necessarios => 10, p_motivo => '')$$,
  '22023', null, 'cadastro pelo administrador exige motivo');
select throws_ok($$select * from public.pontos_admin_cadastrar_beneficio(p_perfil_id => 'a0000000-0000-0000-0000-000000000002', p_nome => 'X', p_descricao => 'Y', p_pontos_necessarios => 10, p_motivo => 'm')$$,
  'P0002', null, 'perfil indisponível não recebe benefício');
select set_config('t.b5', r.o_beneficio_id::text, true), set_config('t.v5', r.o_versao_id::text, true)
  from public.pontos_admin_cadastrar_beneficio(p_perfil_id => 'a0000000-0000-0000-0000-000000000001', p_nome => 'Desconto de 10%', p_descricao => 'Desconto na próxima compra',
    p_pontos_necessarios => 120, p_motivo => 'Parceria combinada com o responsável', p_condicoes => 'Compras acima de R$ 50', p_prazo_uso_dias => 7) r;
-- O administrador não publica sozinho: a proposta espera o aceite do responsável do perfil.
select throws_ok($$select public.pontos_decidir_beneficio_versao(current_setting('t.v5')::uuid, true)$$, 'P0001', null, 'administrador não aprova a própria proposta (não está pendente de análise)');
select throws_ok($$select public.pontos_admin_editar_proposta_beneficio(current_setting('t.v5')::uuid, 'Outro', 'Outro', 10, 'm')$$, 'P0001', null, 'administrador só edita o que o responsável propôs');
select is((select count(*)::int from public.administracao_beneficios_aguardando_aceite), 1, 'administrador acompanha a proposta aguardando aceite');
reset role;
select is((select ativo from public.pontos_beneficio where id = current_setting('t.b5')::uuid), false, 'cadastro do administrador nasce inativo');
select is((select situacao from public.pontos_beneficio_versao where id = current_setting('t.v5')::uuid), 'aguardando_aceite', 'e aguardando aceite do responsável');
select is((select origem from public.pontos_beneficio_versao where id = current_setting('t.v5')::uuid), 'administrador', 'com origem administrador');
select is((select versao_aprovada_id from public.pontos_beneficio where id = current_setting('t.b5')::uuid), null, 'sem versão aprovada');
select is((select count(*)::int from public.pontos_beneficio_revisao where versao_id = current_setting('t.v5')::uuid), 0, 'ainda sem decisão');
select is((select acao from public.administracao_auditoria where alvo_id = current_setting('t.b5')), 'cadastrar_beneficio', 'cadastro auditado');
select is((select motivo from public.administracao_auditoria where alvo_id = current_setting('t.b5')), 'Parceria combinada com o responsável', 'com motivo');
select is((select prazo_uso_dias from public.pontos_beneficio_versao where id = current_setting('t.v5')::uuid), 7, 'prazo de uso em dias depois do resgate');
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.pontos_beneficio_publico), 1, 'proposta do administrador não aparece na vitrine antes do aceite');
reset role;

-- Aceite do responsável
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select throws_ok($$select public.pontos_responder_proposta_beneficio(current_setting('t.v5')::uuid, true)$$, '42501', null, 'outra conta não aceita proposta alheia');
select is((select count(*)::int from public.pontos_beneficio_versao where id = current_setting('t.v5')::uuid), 0, 'outra conta não lê a proposta');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is((select count(*)::int from public.pontos_beneficio_versao where id = current_setting('t.v5')::uuid and situacao = 'aguardando_aceite'), 1, 'o responsável vê a proposta aguardando aceite');
select throws_ok($$select public.pontos_responder_proposta_beneficio(current_setting('t.v5')::uuid, false)$$, '22023', null, 'recusar exige motivo');
select throws_ok($$select public.pontos_salvar_beneficio(current_setting('t.b5')::uuid, 'Mudei', 'Mudei', 10)$$, 'P0001', null, 'o responsável não edita a proposta do administrador: aceita ou recusa');
select throws_ok($$select public.pontos_definir_beneficio_ativo(current_setting('t.b5')::uuid, true)$$, 'P0001', null, 'sem aceite não se ativa');
select lives_ok($$select public.pontos_responder_proposta_beneficio(current_setting('t.v5')::uuid, true)$$, 'o responsável aceita');
select throws_ok($$select public.pontos_responder_proposta_beneficio(current_setting('t.v5')::uuid, true)$$, 'P0001', null, 'proposta já respondida não é respondida de novo');
reset role;
select is((select situacao from public.pontos_beneficio_versao where id = current_setting('t.v5')::uuid), 'aprovada', 'aceite aprova a versão');
select is((select versao_aprovada_id from public.pontos_beneficio where id = current_setting('t.b5')::uuid), current_setting('t.v5')::uuid, 'e a torna a versão aprovada');
select is((select ativo from public.pontos_beneficio where id = current_setting('t.b5')::uuid), true, 'aceitar já ativa o benefício');
select is((select (valor_novo ->> 'ativo')::boolean from public.administracao_auditoria where alvo_id = current_setting('t.v5')), true, 'e a auditoria registra a ativação');
select is((select (valor_anterior ->> 'ativo')::boolean from public.administracao_auditoria where alvo_id = current_setting('t.v5')), false, 'com o estado anterior inativo');
select is((select decisor from public.pontos_beneficio_revisao where versao_id = current_setting('t.v5')::uuid), 'responsavel', 'a revisão registra que o responsável decidiu');
select is((select acao from public.administracao_auditoria where alvo_id = current_setting('t.v5')), 'aceitar_proposta_beneficio', 'aceite auditado');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.pontos_beneficio_publico), 2, 'visão pública com os dois benefícios');
reset role;

-- Administrador edita só o que o responsável propôs (vira contraproposta aguardando aceite)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select set_config('t.b6', r.o_beneficio_id::text, true), set_config('t.v6', r.o_versao_id::text, true)
  from public.pontos_criar_beneficio(p_perfil_id => 'a0000000-0000-0000-0000-000000000001', p_nome => 'Brinde', p_descricao => 'Um brinde', p_pontos_necessarios => 30, p_prazo_uso_dias => 5) r;
select lives_ok($$select public.pontos_enviar_beneficio_versao(current_setting('t.v6')::uuid)$$, 'responsável propõe outro benefício');
select throws_ok($$select public.pontos_admin_editar_proposta_beneficio(current_setting('t.v6')::uuid, 'Brinde maior', 'Um brinde maior', 40, 'ajuste')$$, '42501', null, 'responsável não usa a edição do administrador');
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select throws_ok($$select public.pontos_admin_editar_proposta_beneficio(current_setting('t.v6')::uuid, 'Brinde maior', 'Um brinde maior', 40, '')$$, '22023', null, 'edição exige motivo');
select throws_ok($$select public.pontos_admin_editar_proposta_beneficio(current_setting('t.v4')::uuid, 'X', 'Y', 40, 'm')$$, '42501', null, 'administrador não edita proposta do próprio perfil');
select set_config('t.v7', (select public.pontos_admin_editar_proposta_beneficio(current_setting('t.v6')::uuid, 'Brinde maior', 'Um brinde maior', 40, 'Ajuste combinado', null, null, null, null, 9))::text, true);
reset role;
select is((select situacao from public.pontos_beneficio_versao where id = current_setting('t.v6')::uuid), 'substituida', 'a proposta original fica como histórico (substituída)');
select is((select situacao from public.pontos_beneficio_versao where id = current_setting('t.v7')::uuid), 'aguardando_aceite', 'a edição vira contraproposta aguardando aceite');
select is((select nome from public.pontos_beneficio_versao where id = current_setting('t.v6')::uuid), 'Brinde', 'a proposta original não foi alterada');
select is((select decisao from public.pontos_beneficio_revisao where versao_id = current_setting('t.v6')::uuid), 'substituida', 'revisão registra a substituição');
select is((select valor_anterior ->> 'nome' from public.administracao_auditoria where acao = 'editar_proposta_beneficio' and alvo_id = current_setting('t.v6')), 'Brinde', 'auditoria guarda o valor anterior');
select is((select motivo from public.administracao_auditoria where acao = 'editar_proposta_beneficio' and alvo_id = current_setting('t.v6')), 'Ajuste combinado', 'e o motivo');
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.pontos_beneficio_publico), 2, 'a contraproposta não aparece na vitrine');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$select public.pontos_responder_proposta_beneficio(current_setting('t.v7')::uuid, false, 'Prefiro o valor original')$$, 'o responsável recusa a contraproposta com motivo');
reset role;
select is((select situacao from public.pontos_beneficio_versao where id = current_setting('t.v7')::uuid), 'rejeitada', 'contraproposta recusada');
select is((select versao_aprovada_id from public.pontos_beneficio where id = current_setting('t.b6')::uuid), null, 'nada foi publicado');

-- Prazo de resgate é data: vencido sai da vitrine; vale até o fim do dia do prazo (America/Sao_Paulo)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select set_config('t.b8', r.o_beneficio_id::text, true), set_config('t.v8', r.o_versao_id::text, true)
  from public.pontos_admin_cadastrar_beneficio(p_perfil_id => 'a0000000-0000-0000-0000-000000000001', p_nome => 'Vencido', p_descricao => 'Prazo vencido', p_pontos_necessarios => 10,
    p_motivo => 'Teste de prazo', p_prazo_resgate_ate => ((now() at time zone 'America/Sao_Paulo')::date - 1), p_prazo_uso_dias => 10) r;
select set_config('t.b9', r.o_beneficio_id::text, true), set_config('t.v9', r.o_versao_id::text, true)
  from public.pontos_admin_cadastrar_beneficio(p_perfil_id => 'a0000000-0000-0000-0000-000000000001', p_nome => 'Vence hoje', p_descricao => 'Prazo hoje', p_pontos_necessarios => 10,
    p_motivo => 'Teste de prazo', p_prazo_resgate_ate => ((now() at time zone 'America/Sao_Paulo')::date), p_prazo_uso_dias => 10) r;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$select public.pontos_responder_proposta_beneficio(current_setting('t.v8')::uuid, true)$$, 'aceita o benefício de prazo vencido');
select lives_ok($$select public.pontos_responder_proposta_beneficio(current_setting('t.v9')::uuid, true)$$, 'aceita o benefício que vence hoje');
select is((select count(*)::int from public.pontos_beneficio where id = current_setting('t.b8')::uuid), 1, 'o responsável ainda enxerga o próprio benefício vencido');
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.pontos_beneficio_publico where id = current_setting('t.b8')::uuid), 0, 'prazo de resgate vencido: fora da vitrine pública');
select is((select count(*)::int from public.pontos_beneficio where id = current_setting('t.b8')::uuid), 0, 'e da tabela, para o visitante');
select is((select count(*)::int from public.pontos_beneficio_versao where id = current_setting('t.v8')::uuid), 0, 'e a versão não é legível');
select is((select count(*)::int from public.pontos_beneficio_publico where id = current_setting('t.b9')::uuid), 1, 'no dia do prazo ainda aparece');
select is((select prazo_uso_dias from public.pontos_beneficio_publico where id = current_setting('t.b9')::uuid), 10, 'prazo de uso: N dias depois do resgate');
select is((select count(*)::int from public.pontos_beneficio_publico), 3, 'vitrine: dois benefícios + o que vence hoje');
select columns_are('public', 'pontos_beneficio_publico', array['id', 'perfil_id', 'nome', 'descricao', 'pontos_necessarios', 'condicoes', 'limite_total', 'limite_por_pessoa', 'prazo_resgate_ate', 'prazo_uso_dias', 'criado_em'],
  'a vitrine tem prazo de resgate (data) e prazo de uso (dias)');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select throws_ok($$select public.pontos_admin_definir_beneficio_ativo(current_setting('t.b5')::uuid, false, '')$$, '22023', null, 'desativar pelo administrador exige motivo');
select lives_ok($$select public.pontos_admin_definir_beneficio_ativo(current_setting('t.b5')::uuid, false, 'Pedido do responsável')$$, 'administrador desativa o benefício');
reset role;
select is((select valor_anterior ->> 'ativo' from public.administracao_auditoria where acao = 'definir_beneficio_ativo' and alvo_id = current_setting('t.b5')), 'true', 'auditoria guarda o valor anterior');
select is((select valor_novo ->> 'ativo' from public.administracao_auditoria where acao = 'definir_beneficio_ativo' and alvo_id = current_setting('t.b5')), 'false', 'e o novo');
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.pontos_beneficio_publico where id = current_setting('t.b5')::uuid), 0, 'benefício desativado sai da vista pública');
select is((select count(*)::int from public.pontos_beneficio_publico), 2, 'os demais seguem na vitrine');
reset role;

-- ===== Benefício não mexe em pontos nem resgata =====
select is((select count(*)::int from public.pontos_lancamento), 0, 'cadastrar e aprovar benefícios não cria lançamentos de pontos');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok($$insert into public.pontos_beneficio (perfil_id) values ('a0000000-0000-0000-0000-000000000001')$$, '42501', null, 'cliente não insere benefício direto');
select throws_ok($$update public.pontos_beneficio set ativo = true$$, '42501', null, 'cliente não altera benefício direto');
select throws_ok($$delete from public.pontos_beneficio$$, '42501', null, 'cliente não apaga benefício direto');
reset role;

select * from finish();
rollback;
