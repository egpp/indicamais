-- pgTAP · patrocinadores internos (carrossel) · IM-020, IM-019, IM-079, IM-086, IM-029
-- Leitura pública só de ativo + no período + destino disponível; escrita só do administrador, com auditoria;
-- imagens de patrocinador visível entram na leitura pública do Storage; nenhum dado privado nem preço.
begin;
select * from no_plan();
-- A migração de seed cria as 8 categorias da D-006; este teste monta as suas.
delete from public.catalogo_categoria;

insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@teste.local'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@teste.local'),
  ('dddddddd-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd@teste.local');
insert into public.administracao_administrador (conta_id) values ('dddddddd-0000-0000-0000-00000000000d');
insert into public.catalogo_categoria (id, nome, slug, ativa, ordem) values
  ('11111111-0000-0000-0000-000000000001', 'Alimentação', 'alimentacao', true, 1);

-- Perfil 1: aprovado e publicado. Perfil 2: aprovado mas DESPUBLICADO.
insert into public.perfis_perfil (id, responsavel_id, slug) values
  ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a', 'loja-um'),
  ('a0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-00000000000a', 'loja-dois');
insert into public.perfis_perfil_versao (id, perfil_id, situacao, enviada_em, nome, descricao_breve, imagem_path, categoria_principal_id, cidade, uf) values
  ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'aprovada', now(), 'Loja Um', 'Doces', 'perfil/a0000000-0000-0000-0000-000000000001/capa.jpg', '11111111-0000-0000-0000-000000000001', 'Porto Alegre', 'RS'),
  ('a1000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'aprovada', now(), 'Loja Dois', 'Salgados', 'perfil/a0000000-0000-0000-0000-000000000002/capa.jpg', '11111111-0000-0000-0000-000000000001', 'Porto Alegre', 'RS');
update public.perfis_perfil set versao_aprovada_id = 'a1000000-0000-0000-0000-000000000001', publicado = true where id = 'a0000000-0000-0000-0000-000000000001';
update public.perfis_perfil set versao_aprovada_id = 'a1000000-0000-0000-0000-000000000002', publicado = false where id = 'a0000000-0000-0000-0000-000000000002';

-- Patrocinadores montados como superusuário.
--   5...01 ativo, sem período, perfil 1                  -> VISÍVEL
--   5...02 INATIVO                                        -> oculto
--   5...03 ativo, período já terminou                     -> oculto
--   5...04 ativo, período ainda não começou               -> oculto
--   5...05 ativo, destino é o perfil 2 (despublicado)     -> oculto
--   5...06 ativo, texto, período em curso                 -> VISÍVEL
insert into public.administracao_patrocinador (id, titulo, imagem_path, perfil_destino_id, texto_destino, ordem, ativo, inicio_em, fim_em) values
  ('50000000-0000-0000-0000-000000000001', 'Doces da Um', 'patrocinador/50000000-0000-0000-0000-000000000001/a.jpg', 'a0000000-0000-0000-0000-000000000001', null, 2, true, null, null),
  ('50000000-0000-0000-0000-000000000002', 'Inativo', 'patrocinador/50000000-0000-0000-0000-000000000002/a.jpg', null, 'Texto inativo', 1, false, null, null),
  ('50000000-0000-0000-0000-000000000003', 'Expirado', 'patrocinador/50000000-0000-0000-0000-000000000003/a.jpg', null, 'Texto expirado', 1, true, now() - interval '2 days', now() - interval '1 day'),
  ('50000000-0000-0000-0000-000000000004', 'Futuro', 'patrocinador/50000000-0000-0000-0000-000000000004/a.jpg', null, 'Texto futuro', 1, true, now() + interval '1 day', now() + interval '2 days'),
  ('50000000-0000-0000-0000-000000000005', 'Perfil fora do ar', 'patrocinador/50000000-0000-0000-0000-000000000005/a.jpg', 'a0000000-0000-0000-0000-000000000002', null, 1, true, null, null),
  ('50000000-0000-0000-0000-000000000006', 'Campanha de Natal', 'patrocinador/50000000-0000-0000-0000-000000000006/a.jpg', null, 'Descontos em toda a cidade', 1, true, now() - interval '1 day', now() + interval '1 day');
insert into storage.objects (bucket_id, name) values
  ('indicamais-imagens', 'patrocinador/50000000-0000-0000-0000-000000000001/a.jpg'),
  ('indicamais-imagens', 'patrocinador/50000000-0000-0000-0000-000000000002/a.jpg'),
  ('indicamais-imagens', 'patrocinador/50000000-0000-0000-0000-000000000003/a.jpg'),
  ('indicamais-imagens', 'patrocinador/50000000-0000-0000-0000-000000000004/a.jpg'),
  ('indicamais-imagens', 'patrocinador/50000000-0000-0000-0000-000000000005/a.jpg'),
  ('indicamais-imagens', 'patrocinador/50000000-0000-0000-0000-000000000006/a.jpg');

-- ===== Estrutura: sem preço/cobrança, sem dado privado =====
select columns_are('public', 'administracao_patrocinador',
  array['id', 'titulo', 'imagem_path', 'perfil_destino_id', 'texto_destino', 'ordem', 'ativo', 'inicio_em', 'fim_em', 'criado_em', 'atualizado_em'],
  'a tabela não tem preço, cobrança nem dado de conta');
select columns_are('public', 'administracao_patrocinador_publico',
  array['id', 'identificacao', 'titulo', 'imagem_path', 'destino_tipo', 'destino_perfil_id', 'destino_perfil_slug', 'destino_texto', 'ordem'],
  'a visão pública devolve só o necessário');
select is((select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.administracao_patrocinador'::regclass), true, 'RLS ativada e forçada');
select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'administracao_patrocinador'), 5, 'política explícita para cada operação (select público/admin, insert, update, delete)');

-- ===== anon =====
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select array_agg(id::text order by id) from public.administracao_patrocinador_publico),
  array['50000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000006'], 'anon vê só ativo, no período e com destino disponível');
select is((select count(*)::int from public.administracao_patrocinador_publico where identificacao <> 'Patrocinado'), 0, 'todo item do carrossel vem identificado como Patrocinado');
select is((select array_agg(id::text order by ordem, id) from public.administracao_patrocinador_publico),
  array['50000000-0000-0000-0000-000000000006', '50000000-0000-0000-0000-000000000001'], 'ordem estável pelo campo ordem');
select is((select destino_perfil_slug from public.administracao_patrocinador_publico where id = '50000000-0000-0000-0000-000000000001'), 'loja-um', 'destino perfil devolve o slug do perfil público');
select is((select destino_tipo from public.administracao_patrocinador_publico where id = '50000000-0000-0000-0000-000000000006'), 'texto', 'destino texto');
select is((select count(*)::int from public.administracao_patrocinador_publico where id in
  ('50000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000004', '50000000-0000-0000-0000-000000000005')), 0,
  'anon não vê inativo, expirado, futuro nem de perfil despublicado');
select is((select count(*)::int from public.administracao_patrocinador), 2, 'anon também só enxerga 2 linhas lendo a tabela (RLS)');
select throws_ok($$select atualizado_em from public.administracao_patrocinador$$, '42501', null, 'anon não lê colunas fora da lista pública');
select is((select count(*)::int from public.administracao_patrocinador_publico where to_jsonb(administracao_patrocinador_publico)::text ~* '(responsavel|conta_id|autor|@teste|aaaaaaaa|dddddddd)'), 0, 'visão sem dado privado');
select throws_ok($$insert into public.administracao_patrocinador (titulo, imagem_path, texto_destino) values ('X', 'patrocinador/50000000-0000-0000-0000-0000000000ff/a.jpg', 'x')$$, '42501', null, 'anon não insere');
select throws_ok($$update public.administracao_patrocinador set titulo = 'Hack'$$, '42501', null, 'anon não atualiza');
select throws_ok($$delete from public.administracao_patrocinador$$, '42501', null, 'anon não apaga');
select throws_ok($$select public.administracao_criar_patrocinador('X', 'patrocinador/50000000-0000-0000-0000-0000000000ff/a.jpg', null, 'x', 0, true, null, null, null, '50000000-0000-0000-0000-0000000000ff')$$, '42501', null, 'anon não executa a função de criação');
-- Imagens
select is((select array_agg(name order by name) from storage.objects where bucket_id = 'indicamais-imagens'),
  array['patrocinador/50000000-0000-0000-0000-000000000001/a.jpg', 'patrocinador/50000000-0000-0000-0000-000000000006/a.jpg'], 'anon lê só a imagem de patrocinador visível (sem listar as outras)');
select is((select count(*)::int from storage.objects where name like 'patrocinador/50000000-0000-0000-0000-000000000002/%'
  or name like 'patrocinador/50000000-0000-0000-0000-000000000003/%' or name like 'patrocinador/50000000-0000-0000-0000-000000000005/%'), 0, 'imagem de patrocinador inativo, expirado ou de perfil despublicado não é pública');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('indicamais-imagens', 'patrocinador/50000000-0000-0000-0000-000000000007/a.jpg')$$, '42501', null, 'anon não envia imagem de patrocinador');

-- ===== Usuário comum (B) =====
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((select count(*)::int from public.administracao_patrocinador), 2, 'usuário comum lê só as linhas públicas da tabela');
select is((select count(*)::int from public.administracao_patrocinador_publico), 2, 'usuário comum vê o carrossel público');
select throws_ok($$insert into public.administracao_patrocinador (titulo, imagem_path, texto_destino) values ('X', 'patrocinador/50000000-0000-0000-0000-0000000000ff/a.jpg', 'x')$$, '42501', null, 'usuário comum não insere direto');
select throws_ok($$update public.administracao_patrocinador set titulo = 'Hack'$$, '42501', null, 'usuário comum não atualiza direto');
select throws_ok($$delete from public.administracao_patrocinador$$, '42501', null, 'usuário comum não apaga direto');
select throws_ok($$select public.administracao_criar_patrocinador('X', 'patrocinador/50000000-0000-0000-0000-0000000000ff/a.jpg', null, 'x', 0, true, null, null, null, '50000000-0000-0000-0000-0000000000ff')$$, '42501', null, 'não-admin não cria patrocinador');
select throws_ok($$select public.administracao_alterar_patrocinador('50000000-0000-0000-0000-000000000001', 'Novo', 'patrocinador/50000000-0000-0000-0000-000000000001/a.jpg', null, 'texto', 1, null, null, 'motivo')$$, '42501', null, 'não-admin não edita patrocinador');
select throws_ok($$select public.administracao_definir_patrocinador_ativo('50000000-0000-0000-0000-000000000002', true, 'motivo')$$, '42501', null, 'não-admin não ativa patrocinador');
select throws_ok($$select public.administracao_definir_patrocinador_ativo('50000000-0000-0000-0000-000000000001', false, 'motivo')$$, '42501', null, 'não-admin não desativa patrocinador');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('indicamais-imagens', 'patrocinador/50000000-0000-0000-0000-000000000007/b.jpg')$$, '42501', null, 'usuário comum não envia imagem de patrocinador');
select is((select count(*)::int from storage.objects where name like 'patrocinador/%'), 2, 'usuário comum também só lê imagem de patrocinador visível');
reset role;
select is((select count(*)::int from public.administracao_auditoria), 0, 'nenhuma tentativa negada deixou auditoria');
select is((select titulo from public.administracao_patrocinador where id = '50000000-0000-0000-0000-000000000001'), 'Doces da Um', 'nada foi alterado pelas tentativas');

-- ===== Administrador =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select is((select count(*)::int from public.administracao_patrocinador), 6, 'administrador lê todos, inclusive inativos e expirados');
select throws_ok($$insert into public.administracao_patrocinador (titulo, imagem_path, texto_destino) values ('X', 'patrocinador/50000000-0000-0000-0000-0000000000ff/a.jpg', 'x')$$, '42501', null, 'nem o administrador insere direto (só por função)');
select throws_ok($$update public.administracao_patrocinador set ativo = true$$, '42501', null, 'nem o administrador atualiza direto');
select throws_ok($$delete from public.administracao_patrocinador$$, '42501', null, 'nem o administrador apaga direto');
select lives_ok($$insert into storage.objects (bucket_id, name) values ('indicamais-imagens', 'patrocinador/50000000-0000-0000-0000-000000000007/a.jpg')$$, 'administrador envia imagem na pasta patrocinador/<uuid>/');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('indicamais-imagens', 'patrocinador/nao-uuid/a.jpg')$$, '42501', null, 'administrador não envia fora do padrão de caminho');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('indicamais-imagens', 'perfil/a0000000-0000-0000-0000-000000000001/admin.jpg')$$, '42501', null, 'administrador não escreve na pasta de perfil de outro');

-- Validações (nenhuma deixa auditoria)
select throws_ok($$select public.administracao_criar_patrocinador('Com link', 'patrocinador/50000000-0000-0000-0000-000000000008/a.jpg', null, 'veja https://exemplo.com', 0, false, null, null, null, '50000000-0000-0000-0000-000000000008')$$, '23514', null, 'texto de destino não aceita URL');
select throws_ok($$select public.administracao_criar_patrocinador('Com dominio', 'patrocinador/50000000-0000-0000-0000-000000000008/a.jpg', null, 'acesse loja.com.br', 0, false, null, null, null, '50000000-0000-0000-0000-000000000008')$$, '23514', null, 'texto de destino não aceita domínio');
select throws_ok($$select public.administracao_criar_patrocinador('Sem destino', 'patrocinador/50000000-0000-0000-0000-000000000008/a.jpg', null, null, 0, false, null, null, null, '50000000-0000-0000-0000-000000000008')$$, '23514', null, 'exige um destino');
select throws_ok($$select public.administracao_criar_patrocinador('Dois destinos', 'patrocinador/50000000-0000-0000-0000-000000000008/a.jpg', 'a0000000-0000-0000-0000-000000000001', 'texto', 0, false, null, null, null, '50000000-0000-0000-0000-000000000008')$$, '23514', null, 'perfil e texto juntos são recusados');
select throws_ok($$select public.administracao_criar_patrocinador('Imagem alheia', 'patrocinador/50000000-0000-0000-0000-000000000009/a.jpg', null, 'texto', 0, false, null, null, null, '50000000-0000-0000-0000-000000000008')$$, '23514', null, 'imagem fora da pasta do patrocinador é recusada');
select throws_ok($$select public.administracao_criar_patrocinador('Imagem ruim', 'item/x/a.jpg', null, 'texto', 0, false, null, null, null, '50000000-0000-0000-0000-000000000008')$$, '23514', null, 'caminho de imagem de outro tipo é recusado');
select throws_ok($$select public.administracao_criar_patrocinador('Periodo', 'patrocinador/50000000-0000-0000-0000-000000000008/a.jpg', null, 'texto', 0, false, now(), now() - interval '1 day', null, '50000000-0000-0000-0000-000000000008')$$, '23514', null, 'fim antes do início é recusado');
select throws_ok($$select public.administracao_criar_patrocinador('X', 'patrocinador/50000000-0000-0000-0000-000000000008/a.jpg', null, 'texto', 0, false, null, null, null, '50000000-0000-0000-0000-000000000008')$$, '23514', null, 'título curto demais é recusado');
select throws_ok($$select public.administracao_alterar_patrocinador('50000000-0000-0000-0000-000000000001', 'Novo título', 'patrocinador/50000000-0000-0000-0000-000000000001/a.jpg', null, 'texto', 1, null, null, '  ')$$, '22023', null, 'alterar sem motivo falha');
select throws_ok($$select public.administracao_definir_patrocinador_ativo('50000000-0000-0000-0000-000000000001', false, null)$$, '22023', null, 'desativar sem motivo falha');
select throws_ok($$select public.administracao_definir_patrocinador_ativo('50000000-0000-0000-0000-0000000000aa', false, 'motivo')$$, 'P0002', null, 'patrocinador inexistente');
reset role;
select is((select count(*)::int from public.administracao_auditoria), 0, 'nenhuma validação recusada deixou auditoria');

-- Atomicidade: se a auditoria falha, a criação desfaz
create function public.t_auditoria_falha() returns trigger language plpgsql as $$ begin raise exception 'auditoria indisponível' using errcode = 'XX001'; end $$;
create trigger t_auditoria_falha before insert on public.administracao_auditoria for each row execute function public.t_auditoria_falha();
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select throws_ok($$select public.administracao_criar_patrocinador('Atomico', 'patrocinador/50000000-0000-0000-0000-000000000008/a.jpg', null, 'texto', 0, false, null, null, null, '50000000-0000-0000-0000-000000000008')$$, 'XX001', null, 'auditoria falha: criação falha');
select throws_ok($$select public.administracao_definir_patrocinador_ativo('50000000-0000-0000-0000-000000000001', false, 'motivo')$$, 'XX001', null, 'auditoria falha: desativação falha');
reset role;
drop trigger t_auditoria_falha on public.administracao_auditoria;
select is((select count(*)::int from public.administracao_patrocinador where id = '50000000-0000-0000-0000-000000000008'), 0, 'criação foi desfeita');
select is((select ativo from public.administracao_patrocinador where id = '50000000-0000-0000-0000-000000000001'), true, 'desativação foi desfeita');

-- Ações do administrador
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select lives_ok($$select public.administracao_criar_patrocinador('Novo parceiro', 'patrocinador/50000000-0000-0000-0000-000000000008/a.jpg', 'a0000000-0000-0000-0000-000000000001', null, 5, true, null, null, 'Parceria aprovada', '50000000-0000-0000-0000-000000000008')$$, 'administrador cria patrocinador');
select lives_ok($$select public.administracao_alterar_patrocinador('50000000-0000-0000-0000-000000000008', 'Parceiro renomeado', 'patrocinador/50000000-0000-0000-0000-000000000008/a.jpg', null, 'Novo texto', 7, null, null, 'Troca de campanha')$$, 'administrador edita patrocinador');
select lives_ok($$select public.administracao_definir_patrocinador_ativo('50000000-0000-0000-0000-000000000008', false, 'Fim da campanha')$$, 'administrador desativa patrocinador');
select lives_ok($$select public.administracao_definir_patrocinador_ativo('50000000-0000-0000-0000-000000000008', true, 'Reativado')$$, 'administrador reativa patrocinador');
select lives_ok($$select public.administracao_definir_patrocinador_ativo('50000000-0000-0000-0000-000000000002', true, 'Liberar campanha')$$, 'administrador ativa patrocinador inativo');
select is((select count(*)::int from public.administracao_auditoria), 5, 'administrador lê as 5 linhas de auditoria');
reset role;

select is((select count(*)::int from public.administracao_auditoria where alvo_tabela = 'administracao_patrocinador'), 5, '1 linha de auditoria por ação');
select is((select autor_id from public.administracao_auditoria where acao = 'patrocinador_criado'), 'dddddddd-0000-0000-0000-00000000000d'::uuid, 'criar: autor é o administrador');
select is((select motivo from public.administracao_auditoria where acao = 'patrocinador_criado'), 'Parceria aprovada', 'criar: motivo');
select is((select valor_novo ->> 'titulo' from public.administracao_auditoria where acao = 'patrocinador_criado'), 'Novo parceiro', 'criar: valor novo');
select is((select valor_anterior from public.administracao_auditoria where acao = 'patrocinador_criado'), null, 'criar: sem valor anterior');
select is((select valor_anterior ->> 'titulo' from public.administracao_auditoria where acao = 'patrocinador_alterado'), 'Novo parceiro', 'alterar: valor anterior');
select is((select valor_novo ->> 'titulo' from public.administracao_auditoria where acao = 'patrocinador_alterado'), 'Parceiro renomeado', 'alterar: valor novo');
select is((select motivo from public.administracao_auditoria where acao = 'patrocinador_alterado'), 'Troca de campanha', 'alterar: motivo');
select is((select valor_anterior ->> 'ativo' from public.administracao_auditoria where acao = 'patrocinador_desativado'), 'true', 'desativar: ativo anterior');
select is((select valor_novo ->> 'ativo' from public.administracao_auditoria where acao = 'patrocinador_desativado'), 'false', 'desativar: ativo novo');
select is((select motivo from public.administracao_auditoria where acao = 'patrocinador_desativado'), 'Fim da campanha', 'desativar: motivo');
select is((select count(*)::int from public.administracao_auditoria where acao = 'patrocinador_ativado'), 2, 'ativar: uma linha por ativação');
select isnt((select criado_em from public.administracao_auditoria where acao = 'patrocinador_criado'), null, 'data gravada');
select is((select count(*)::int from public.administracao_auditoria where to_jsonb(administracao_auditoria)::text ~* '(@teste|\+55)'), 0, 'auditoria sem e-mail nem telefone');

-- Ativado pelo administrador: passa a aparecer
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.administracao_patrocinador_publico where id = '50000000-0000-0000-0000-000000000002'), 1, 'patrocinador ativado passa a aparecer ao anon');
select is((select count(*)::int from public.administracao_patrocinador_publico where id = '50000000-0000-0000-0000-000000000008'), 1, 'patrocinador reativado aparece');
reset role;

-- Despublicar o perfil de destino retira o patrocinador e a imagem
update public.perfis_perfil set publicado = false where id = 'a0000000-0000-0000-0000-000000000001';
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.administracao_patrocinador_publico where id = '50000000-0000-0000-0000-000000000001'), 0, 'despublicar o perfil de destino retira o patrocinador (IM-079)');
select is((select count(*)::int from storage.objects where name = 'patrocinador/50000000-0000-0000-0000-000000000001/a.jpg'), 0, 'e a imagem deixa de ser pública');
reset role;
update public.perfis_perfil set publicado = true where id = 'a0000000-0000-0000-0000-000000000001';

-- Exclusão de imagem pelo administrador: só se nenhum patrocinador a referencia
select set_config('storage.allow_delete_query', 'true', true);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
delete from storage.objects where name = 'patrocinador/50000000-0000-0000-0000-000000000001/a.jpg';
delete from storage.objects where name = 'patrocinador/50000000-0000-0000-0000-000000000007/a.jpg';
reset role;
select is((select count(*)::int from storage.objects where name = 'patrocinador/50000000-0000-0000-0000-000000000001/a.jpg'), 1, 'imagem em uso por patrocinador não é apagada');
select is((select count(*)::int from storage.objects where name = 'patrocinador/50000000-0000-0000-0000-000000000007/a.jpg'), 0, 'imagem solta é apagada pelo administrador');

-- Histórico: patrocinador não é apagado nem para superusuário; auditoria imutável
select throws_ok($$delete from public.administracao_patrocinador where id = '50000000-0000-0000-0000-000000000001'$$, '42501', null, 'patrocinador não é apagado (nem superusuário)');
select throws_ok($$update public.administracao_patrocinador set id = '50000000-0000-0000-0000-0000000000bb' where id = '50000000-0000-0000-0000-000000000001'$$, '42501', null, 'id do patrocinador é imutável');
select throws_ok($$update public.administracao_auditoria set motivo = 'x'$$, '42501', null, 'auditoria é imutável');

select * from finish();
rollback;
