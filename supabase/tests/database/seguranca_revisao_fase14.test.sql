-- pgTAP · revisão de segurança do banco (Fase 14) · achados S-01, S-02 e S-03
-- IM-021, IM-025, IM-029, IM-030, IM-086
-- S-01: o Storage não guarda owner_id. S-02: o dono não sobrescreve imagem em uso. S-03: excesso de pedidos (link sem atribuição, alarme, interruptor).
begin;
select * from no_plan();
delete from public.catalogo_categoria;

insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@teste.local'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@teste.local');
insert into public.catalogo_categoria (id, nome, slug) values ('11111111-0000-0000-0000-000000000001', 'Alimentação', 'alimentacao');

-- Perfil de A, aprovado e publicado, com capa.jpg no ar; solta.jpg existe mas não é usada por nenhuma versão.
insert into public.perfis_perfil (id, responsavel_id, slug) values
  ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a', 'loja-ana');
insert into public.perfis_perfil_versao (id, perfil_id, nome, descricao_breve, imagem_path, categoria_principal_id, cidade, uf) values
  ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Loja da Ana', 'Doces',
   'perfil/a0000000-0000-0000-0000-000000000001/capa.jpg', '11111111-0000-0000-0000-000000000001', 'Porto Alegre', 'RS');
insert into public.perfis_perfil_versao_contato (versao_id, whatsapp_comercial_e164) values
  ('a1000000-0000-0000-0000-000000000001', '+5551988880001');
update public.perfis_perfil_versao set situacao = 'pendente', enviada_em = now() where id = 'a1000000-0000-0000-0000-000000000001';
update public.perfis_perfil_versao set situacao = 'aprovada' where id = 'a1000000-0000-0000-0000-000000000001';
update public.perfis_perfil set versao_aprovada_id = 'a1000000-0000-0000-0000-000000000001', publicado = true
 where id = 'a0000000-0000-0000-0000-000000000001';
insert into storage.objects (bucket_id, name) values
  ('indicamais-imagens', 'perfil/a0000000-0000-0000-0000-000000000001/capa.jpg'),
  ('indicamais-imagens', 'perfil/a0000000-0000-0000-0000-000000000001/solta.jpg');

-- ===== S-01: owner_id não é gravado, mesmo quando o cliente (ou a API) o informa =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$insert into storage.objects (bucket_id, name, owner_id) values ('indicamais-imagens', 'perfil/a0000000-0000-0000-0000-000000000001/nova.jpg', 'aaaaaaaa-0000-0000-0000-00000000000a')$$,
  'o dono envia imagem informando owner_id');
reset role;
select is((select owner_id from storage.objects where name = 'perfil/a0000000-0000-0000-0000-000000000001/nova.jpg'), null,
  'owner_id é zerado no envio: a listagem pública não revela a conta que enviou');
update storage.objects set owner_id = 'aaaaaaaa-0000-0000-0000-00000000000a' where name = 'perfil/a0000000-0000-0000-0000-000000000001/nova.jpg';
select is((select owner_id from storage.objects where name = 'perfil/a0000000-0000-0000-0000-000000000001/nova.jpg'), null,
  'nem por UPDATE o owner_id volta a ser gravado');
select is((select count(*)::int from storage.objects where bucket_id = 'indicamais-imagens' and owner_id is not null), 0,
  'nenhum objeto do bucket guarda owner_id');

-- ===== S-02: o dono não troca o conteúdo de imagem em uso, mas ajusta objeto solto =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
update storage.objects set metadata = jsonb_build_object('t', 1) where name = 'perfil/a0000000-0000-0000-0000-000000000001/capa.jpg';
update storage.objects set metadata = jsonb_build_object('t', 1) where name = 'perfil/a0000000-0000-0000-0000-000000000001/solta.jpg';
select throws_ok($$update storage.objects set name = 'perfil/a0000000-0000-0000-0000-000000000001/capa.jpg' where name = 'perfil/a0000000-0000-0000-0000-000000000001/solta.jpg'$$,
  '42501', null, 'o dono não renomeia um arquivo solto para cima do nome de uma imagem em uso');
reset role;
select is((select metadata ->> 't' from storage.objects where name = 'perfil/a0000000-0000-0000-0000-000000000001/capa.jpg'), null,
  'imagem no ar: o UPDATE do dono não a altera (a revisão do administrador continua valendo)');
select is((select metadata ->> 't' from storage.objects where name = 'perfil/a0000000-0000-0000-0000-000000000001/solta.jpg'), '1',
  'objeto que não está em uso continua editável pelo dono');

-- B não altera nada da pasta de A.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-00000000000b","role":"authenticated"}', true);
update storage.objects set metadata = jsonb_build_object('t', 2) where name = 'perfil/a0000000-0000-0000-0000-000000000001/solta.jpg';
reset role;
select is((select metadata ->> 't' from storage.objects where name = 'perfil/a0000000-0000-0000-0000-000000000001/solta.jpg'), '1',
  'outro responsável não altera objeto da pasta de A');

-- ===== S-03: ritmo dos pedidos de contato (link: tira atribuição; destino/global: alarme; recusa só com interruptor) =====
select ok((select count(*) from public.indicacoes_parametro where chave in
  ('contato_limite_por_link_hora', 'contato_limite_por_destino_hora', 'contato_limite_global_hora', 'contato_recusar_excesso')) = 4, 'os quatro parâmetros existem');
select is((select valor from public.indicacoes_parametro where chave = 'contato_recusar_excesso'), 0, 'padrão: só alarme, sem recusa');
select is(has_function_privilege('anon', 'public.indicacoes_pedido_limitar()', 'execute'), false, 'anon não executa o gatilho de limite');
select is(has_function_privilege('authenticated', 'public.indicacoes_pedido_limitar()', 'execute'), false, 'authenticated não executa o gatilho de limite');
select is(has_table_privilege('anon', 'public.indicacoes_alarme_excesso', 'select'), false, 'anon não lê o alarme');

-- Link: B é o indicador. Limite 2 por hora; o terceiro pedido (outro WhatsApp) NÃO é recusado, mas perde a atribuição.
insert into public.indicacoes_link (id, codigo, indicador_id, perfil_id) values
  ('c0000000-0000-0000-0000-000000000001', 'abcdef0123456789abcdef0123456789', 'bbbbbbbb-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-000000000001');
update public.indicacoes_parametro set valor = 2 where chave = 'contato_limite_por_link_hora';
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select lives_ok($$select * from public.indicacoes_enviar_contato('a0000000-0000-0000-0000-000000000001', null, 'Visitante Um', '+5551900000001', 'chave-limite-0000001', null, null, 'abcdef0123456789abcdef0123456789')$$, 'link: pedido 1 passa');
select lives_ok($$select * from public.indicacoes_enviar_contato('a0000000-0000-0000-0000-000000000001', null, 'Visitante Dois', '+5551900000002', 'chave-limite-0000002', null, null, 'abcdef0123456789abcdef0123456789')$$, 'link: pedido 2 passa');
select lives_ok($$select * from public.indicacoes_enviar_contato('a0000000-0000-0000-0000-000000000001', null, 'Visitante Tres', '+5551900000003', 'chave-limite-0000003', null, null, 'abcdef0123456789abcdef0123456789')$$,
  'link: acima do limite o visitante legítimo continua sendo atendido (sem negação de serviço)');
-- Repetição idempotente continua respondendo, sem gravar.
select lives_ok($$select * from public.indicacoes_enviar_contato('a0000000-0000-0000-0000-000000000001', null, 'Visitante Um', '+5551900000001', 'chave-limite-0000001', null, null, 'abcdef0123456789abcdef0123456789')$$,
  'repetir a mesma operação (mesma chave) segue devolvendo o pedido existente');
reset role;
select is((select count(*)::int from public.indicacoes_pedido_contato where whatsapp_e164 = '+5551900000003'), 1, 'o terceiro pedido foi gravado');
select is((select link_id from public.indicacoes_pedido_contato where whatsapp_e164 = '+5551900000003'), null, 'o excesso por link grava o pedido SEM atribuição (sem pontos)');
select is((select count(*)::int from public.indicacoes_pedido_contato where link_id = 'c0000000-0000-0000-0000-000000000001'), 2, 'só os dois primeiros ficam atribuídos ao link');
select is((select e.link_id from public.indicacoes_evento e join public.indicacoes_pedido_contato p on p.id = e.pedido_id
           where p.whatsapp_e164 = '+5551900000003' and e.tipo = 'contato_enviado'), null, 'o evento contato_enviado também fica sem link');
select is((select count(*)::int from public.indicacoes_alarme_excesso where tipo = 'link' and alvo_id = 'c0000000-0000-0000-0000-000000000001'), 1, 'o excesso por link gerou um alarme');

-- Destino: limiar 2 já excedido (3 pedidos): o próximo gera alarme e NÃO é recusado.
update public.indicacoes_parametro set valor = 2 where chave = 'contato_limite_por_destino_hora';
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select lives_ok($$select * from public.indicacoes_enviar_contato('a0000000-0000-0000-0000-000000000001', null, 'Visitante Quatro', '+5551900000004', 'chave-limite-0000004', null, null, null)$$,
  'destino acima do limiar, interruptor desligado: pedido aceito');
reset role;
select is((select count(*)::int from public.indicacoes_alarme_excesso where tipo = 'destino' and alvo_id = 'a0000000-0000-0000-0000-000000000001'), 1, 'o excesso por destino gerou alarme, sem dado pessoal');

-- Recusa só com o interruptor ligado.
update public.indicacoes_parametro set valor = 1 where chave = 'contato_recusar_excesso';
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$select * from public.indicacoes_enviar_contato('a0000000-0000-0000-0000-000000000001', null, 'Visitante Cinco', '+5551900000005', 'chave-limite-0000005', null, null, null)$$,
  'P0429', null, 'interruptor ligado: o destino acima do limiar recusa');
reset role;
select is((select count(*)::int from public.indicacoes_pedido_contato where whatsapp_e164 = '+5551900000005'), 0, 'o pedido recusado não foi gravado');

-- service_role é isento (carga em massa), mesmo com o interruptor ligado.
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select lives_ok($$insert into public.indicacoes_pedido_contato (perfil_id, nome, whatsapp_e164, chave_idempotencia) values ('a0000000-0000-0000-0000-000000000001', 'Carga', '+5551900000006', 'chave-carga-0000006')$$,
  'service_role não passa pelo limite');
select set_config('request.jwt.claims', '', true);

-- Global: limiar 10; com o interruptor desligado só alarma.
update public.indicacoes_parametro set valor = 0 where chave = 'contato_recusar_excesso';
update public.indicacoes_parametro set valor = 1000 where chave = 'contato_limite_por_destino_hora';
update public.indicacoes_parametro set valor = 10 where chave = 'contato_limite_global_hora';
insert into public.indicacoes_pedido_contato (perfil_id, nome, whatsapp_e164, chave_idempotencia)
select 'a0000000-0000-0000-0000-000000000001', 'Carga ' || g, '+55519000001' || lpad(g::text, 2, '0'), 'chave-carga-' || lpad(g::text, 6, '0')
from generate_series(10, 20) g;
select ok((select count(*) from public.indicacoes_alarme_excesso where tipo = 'global') = 1, 'o excesso global gerou um único alarme na hora');
select throws_ok($$update public.indicacoes_alarme_excesso set quantidade = 0$$, null, null, 'o alarme é só de inserção (UPDATE barrado)');
select throws_ok($$delete from public.indicacoes_alarme_excesso$$, null, null, 'o alarme é só de inserção (DELETE barrado)');

-- Quem não é administrador não lê o alarme.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((select count(*)::int from public.indicacoes_alarme_excesso), 0, 'responsável comum não lê o alarme');
reset role;

select * from finish();
rollback;
