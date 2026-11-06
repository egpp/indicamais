-- pgTAP · revisão de segurança do banco (Fase 14) · achados S-01, S-02 e S-03
-- IM-021, IM-025, IM-029, IM-030, IM-086
-- S-01: o Storage não guarda owner_id. S-02: o dono não sobrescreve imagem em uso. S-03: limites de ritmo dos pedidos.
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

-- ===== S-03: limites de ritmo dos pedidos de contato =====
select ok((select count(*) from public.indicacoes_parametro where chave in
  ('contato_limite_por_link_hora', 'contato_limite_por_destino_hora', 'contato_limite_global_hora')) = 3, 'os três parâmetros existem');
select is(has_function_privilege('anon', 'public.indicacoes_pedido_limitar()', 'execute'), false, 'anon não executa o gatilho de limite');
select is(has_function_privilege('authenticated', 'public.indicacoes_pedido_limitar()', 'execute'), false, 'authenticated não executa o gatilho de limite');

-- Destino: a rota normal (função pública) respeita o limite por destino.
update public.indicacoes_parametro set valor = 2 where chave = 'contato_limite_por_destino_hora';
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select lives_ok($$select * from public.indicacoes_enviar_contato('a0000000-0000-0000-0000-000000000001', null, 'Visitante Um', '+5551900000001', 'chave-limite-0000001', null, null, null)$$,
  'primeiro pedido do destino passa');
select lives_ok($$select * from public.indicacoes_enviar_contato('a0000000-0000-0000-0000-000000000001', null, 'Visitante Dois', '+5551900000002', 'chave-limite-0000002', null, null, null)$$,
  'segundo pedido (outro WhatsApp) passa');
select throws_ok($$select * from public.indicacoes_enviar_contato('a0000000-0000-0000-0000-000000000001', null, 'Visitante Tres', '+5551900000003', 'chave-limite-0000003', null, null, null)$$,
  'P0429', null, 'trocar o WhatsApp não burla: o destino atingiu o limite da hora');
-- Repetição idempotente continua respondendo, sem gravar nem acusar limite.
select lives_ok($$select * from public.indicacoes_enviar_contato('a0000000-0000-0000-0000-000000000001', null, 'Visitante Um', '+5551900000001', 'chave-limite-0000001', null, null, null)$$,
  'repetir a mesma operação (mesma chave) segue devolvendo o pedido existente');
reset role;
select is((select count(*)::int from public.indicacoes_pedido_contato where whatsapp_e164 = '+5551900000003'), 0, 'o pedido recusado não foi gravado');

-- Global.
update public.indicacoes_parametro set valor = 1000 where chave = 'contato_limite_por_destino_hora';
update public.indicacoes_parametro set valor = 10 where chave = 'contato_limite_global_hora';
insert into public.indicacoes_pedido_contato (perfil_id, nome, whatsapp_e164, chave_idempotencia)
select 'a0000000-0000-0000-0000-000000000001', 'Carga ' || g, '+55519000001' || lpad(g::text, 2, '0'), 'chave-carga-' || lpad(g::text, 6, '0')
from generate_series(1, 8) g;
select throws_ok($$insert into public.indicacoes_pedido_contato (perfil_id, nome, whatsapp_e164, chave_idempotencia) values ('a0000000-0000-0000-0000-000000000001', 'Excedente', '+5551900000999', 'chave-excedente-001')$$,
  'P0429', null, 'o limite global da hora barra pedidos em massa');

select * from finish();
rollback;
