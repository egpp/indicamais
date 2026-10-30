-- pgTAP · permissões administrativas granulares · Fase 6 · IM-077, IM-086, D-014
-- O administrador geral concede e revoga; quem tem só uma permissão faz só aquilo; sem permissão não lê nem altera;
-- tudo é auditado; usuário comum e anônimo não enxergam nada.
begin;
select * from no_plan();
delete from public.catalogo_categoria;

-- D = administrador geral; E = receberá permissões; F = sem permissão nenhuma; A = responsável pelos perfis; G = usuário comum.
insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@teste.local'),
  ('dddddddd-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd@teste.local'),
  ('eeeeeeee-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'e@teste.local'),
  ('ffffffff-0000-0000-0000-00000000000f', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'f@teste.local'),
  ('99999999-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'g@teste.local');
insert into public.administracao_administrador (conta_id) values ('dddddddd-0000-0000-0000-00000000000d');
insert into public.catalogo_categoria (id, nome, slug, ativa, ordem) values
  ('11111111-0000-0000-0000-000000000001', 'Alimentação', 'alimentacao', true, 1);

-- Dois perfis com versão pendente (dono A).
insert into public.perfis_perfil (id, responsavel_id, slug) values
  ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a', 'loja-um'),
  ('a0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-00000000000a', 'loja-dois');
insert into public.perfis_perfil_versao (id, perfil_id, situacao, enviada_em, nome, descricao_breve, imagem_path, categoria_principal_id, cidade, uf) values
  ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'pendente', now(), 'Loja Um', 'Doces', 'perfil/a0000000-0000-0000-0000-000000000001/c.jpg', '11111111-0000-0000-0000-000000000001', 'Porto Alegre', 'RS'),
  ('a1000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'pendente', now(), 'Loja Dois', 'Doces', 'perfil/a0000000-0000-0000-0000-000000000002/c.jpg', '11111111-0000-0000-0000-000000000001', 'Canoas', 'RS');

-- ===== Estrutura =====
select is((select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.administracao_permissao'::regclass), true, 'RLS ativa e forçada em administracao_permissao');
select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'administracao_permissao'), 4, 'uma política por operação');
select is((select bool_or(has_table_privilege(r, 'public.administracao_permissao', p))
  from unnest(array['anon', 'authenticated']) r, unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) p), false,
  'nenhum privilégio direto na tabela de permissões');
select columns_are('public', 'administracao_minhas_permissoes', array['permissao', 'criado_em'], 'minhas permissões: sem id de conta');
select columns_are('public', 'administracao_permissoes_concedidas', array['conta_id', 'permissao', 'concedida_por_ref', 'criado_em'], 'concedidas: autor opaco');
select is((select array_agg(p.proname::text order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosrc like '%public.administracao_exigir_admin()%' and p.proname <> 'administracao_exigir_admin'),
  array['administracao_alterar_patrocinador', 'administracao_conceder_permissao', 'administracao_criar_patrocinador',
        'administracao_definir_parametro', 'administracao_definir_patrocinador_ativo', 'administracao_revogar_permissao',
        'contas_definir_parametro', 'indicacoes_definir_parametro', 'indicacoes_tratar_alerta', 'pontos_definir_parametro'],
  'só as RPCs sem permissão específica seguem exigindo administrador geral');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('perfis_decidir_versao', 'catalogo_decidir_item_versao', 'pontos_decidir_beneficio_versao',
    'pontos_admin_cadastrar_beneficio', 'pontos_admin_editar_proposta_beneficio', 'pontos_admin_definir_beneficio_ativo',
    'catalogo_criar_categoria', 'catalogo_alterar_categoria', 'catalogo_decidir_solicitacao', 'pontos_reverter_credito',
    'pontos_reprocessar_pedido', 'administracao_decidir_denuncia', 'administracao_suspender_conta', 'administracao_reativar_conta',
    'administracao_invalidar_indicacao')
    and p.prosrc like '%public.administracao_exigir_permissao(%'), 15, 'as 15 RPCs por permissão usam o guarda da permissão específica');
select is(has_function_privilege('anon', 'public.administracao_conceder_permissao(uuid,text,text)', 'EXECUTE')
  or has_function_privilege('anon', 'public.administracao_revogar_permissao(uuid,text,text)', 'EXECUTE')
  or has_function_privilege('anon', 'public.administracao_permitido(text)', 'EXECUTE'), false, 'anon não executa as funções de permissão');
select is(has_function_privilege('authenticated', 'public.administracao_tem_permissao(uuid,text)', 'EXECUTE'), false, 'a função interna por conta não é chamável pela API');

-- ===== anon =====
set local role anon;
select throws_ok($$select public.administracao_conceder_permissao('eeeeeeee-0000-0000-0000-00000000000e', 'aprovar', 'x')$$, '42501', null, 'anônimo não concede');
select throws_ok($$select * from public.administracao_minhas_permissoes$$, '42501', null, 'anônimo não lê as permissões');
reset role;

-- ===== quem não é administrador geral =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"99999999-0000-0000-0000-000000000009","role":"authenticated"}', true);
select throws_ok($$select public.administracao_conceder_permissao('eeeeeeee-0000-0000-0000-00000000000e', 'aprovar', 'tentativa')$$, '42501', null, 'usuário comum não concede');
select throws_ok($$select * from public.administracao_permissao$$, '42501', null, 'usuário comum não lê a tabela');
select is((select count(*)::int from public.administracao_minhas_permissoes), 0, 'usuário comum não tem permissões');
select is((select count(*)::int from public.administracao_fila_pendencias), 0, 'usuário comum vê fila vazia');
select is((select count(*)::int from public.administracao_fila_denuncias), 0, 'usuário comum vê fila de denúncias vazia');
reset role;

-- ===== administrador geral =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select is((select count(*)::int from public.administracao_minhas_permissoes), 6, 'administrador geral tem as seis permissões');
select throws_ok($$select public.administracao_conceder_permissao('eeeeeeee-0000-0000-0000-00000000000e', 'inexistente', 'x')$$, '22023', null, 'permissão fora da lista é recusada');
select throws_ok($$select public.administracao_conceder_permissao('eeeeeeee-0000-0000-0000-00000000000e', 'aprovar', '')$$, '22023', null, 'motivo obrigatório');
select throws_ok($$select public.administracao_conceder_permissao(gen_random_uuid(), 'aprovar', 'x')$$, 'P0002', null, 'conta inexistente');
select throws_ok($$select public.administracao_conceder_permissao('dddddddd-0000-0000-0000-00000000000d', 'aprovar', 'x')$$, '42501', null, 'não concede a si mesmo');
select lives_ok($$select public.administracao_conceder_permissao('eeeeeeee-0000-0000-0000-00000000000e', 'aprovar', 'Revisora de conteúdo')$$, 'concede aprovar a E');
select lives_ok($$select public.administracao_conceder_permissao('eeeeeeee-0000-0000-0000-00000000000e', 'aprovar', 'repetido')$$, 'conceder de novo é idempotente');
select is((select count(*)::int from public.administracao_permissoes_concedidas where permissao = 'aprovar'), 1, 'administrador geral lista a permissão concedida');
reset role;
select is((select count(*)::int from public.administracao_permissao where conta_id = 'eeeeeeee-0000-0000-0000-00000000000e'), 1, 'uma só linha mesmo após repetir');
select is((select count(*)::int from public.administracao_auditoria where acao = 'conceder_permissao'
  and alvo_id = 'eeeeeeee-0000-0000-0000-00000000000e:aprovar' and autor_id = 'dddddddd-0000-0000-0000-00000000000d'
  and motivo = 'Revisora de conteúdo'), 1, 'concessão auditada (autor, motivo) uma única vez');

-- ===== E (só aprovar) =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-0000-0000-00000000000e","role":"authenticated"}', true);
select is((select array_agg(permissao) from public.administracao_minhas_permissoes), array['aprovar'], 'E vê só a própria permissão');
select throws_ok($$select public.administracao_conceder_permissao('ffffffff-0000-0000-0000-00000000000f', 'aprovar', 'x')$$, '42501', null, 'E não concede permissões');
select is((select count(*)::int from public.administracao_fila_pendencias), 2, 'E (aprovar) vê a fila de aprovação');
select is((select count(*)::int from public.administracao_consulta_negocios where alvo_tipo = 'perfil'), 2, 'E (aprovar) consulta os negócios');
select is((select count(*)::int from public.perfis_perfil_versao where perfil_id = 'a0000000-0000-0000-0000-000000000001'), 1, 'E (aprovar) lê o conteúdo em revisão');
select throws_ok($$select public.catalogo_criar_categoria('Nova', 'nova', 0)$$, '42501', null, 'E não gere categorias sem a permissão');
select throws_ok($$select public.pontos_reverter_credito(gen_random_uuid(), 'outro', 'x')$$, '42501', null, 'E não reverte pontos sem a permissão');
select throws_ok($$select public.administracao_suspender_conta('aaaaaaaa-0000-0000-0000-00000000000a', 'x')$$, '42501', null, 'E não suspende sem a permissão');
select is((select count(*)::int from public.administracao_pontos_saldos), 0, 'E não lê saldos de pontos');
select lives_ok($$select public.perfis_decidir_versao('a1000000-0000-0000-0000-000000000001', true)$$, 'E aprova a versão do perfil um');
reset role;
select is((select situacao from public.perfis_perfil_versao where id = 'a1000000-0000-0000-0000-000000000001'), 'aprovada', 'a versão foi aprovada por quem só tem aprovar');
select is((select count(*)::int from public.administracao_auditoria where acao = 'aprovar_versao'
  and autor_id = 'eeeeeeee-0000-0000-0000-00000000000e'), 1, 'a aprovação ficou auditada em nome de E');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"ffffffff-0000-0000-0000-00000000000f","role":"authenticated"}', true);
select throws_ok($$select public.perfis_decidir_versao('a1000000-0000-0000-0000-000000000002', true)$$, '42501', null, 'F (sem permissão) não aprova');
select is((select count(*)::int from public.administracao_fila_pendencias), 0, 'F não vê a fila');
reset role;

-- ===== administrador geral continua passando em tudo =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select lives_ok($$select public.perfis_decidir_versao('a1000000-0000-0000-0000-000000000002', true)$$, 'administrador geral segue aprovando');
select lives_ok($$select public.catalogo_criar_categoria('Serviços', 'servicos', 2)$$, 'administrador geral segue gerindo categorias');

-- Concede gerir_categorias a E e depois revoga aprovar.
select lives_ok($$select public.administracao_conceder_permissao('eeeeeeee-0000-0000-0000-00000000000e', 'gerir_categorias', 'Curadoria de categorias')$$, 'concede gerir_categorias a E');
select lives_ok($$select public.administracao_revogar_permissao('eeeeeeee-0000-0000-0000-00000000000e', 'aprovar', 'Mudou de função')$$, 'revoga aprovar de E');
select throws_ok($$select public.administracao_revogar_permissao('eeeeeeee-0000-0000-0000-00000000000e', 'aprovar', 'de novo')$$, 'P0002', null, 'revogar o que não existe é recusado');
select throws_ok($$select public.administracao_revogar_permissao('eeeeeeee-0000-0000-0000-00000000000e', 'gerir_categorias', '')$$, '22023', null, 'revogar exige motivo');
reset role;
select is((select count(*)::int from public.administracao_auditoria where acao = 'revogar_permissao'
  and alvo_id = 'eeeeeeee-0000-0000-0000-00000000000e:aprovar' and motivo = 'Mudou de função'
  and (valor_anterior ->> 'tem_permissao')::boolean = true), 1, 'revogação auditada com o valor anterior');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-0000-0000-00000000000e","role":"authenticated"}', true);
select is((select array_agg(permissao) from public.administracao_minhas_permissoes), array['gerir_categorias'], 'E ficou só com gerir_categorias');
select lives_ok($$select public.catalogo_criar_categoria('Beleza', 'beleza', 3)$$, 'E gere categorias');
select is((select count(*)::int from public.catalogo_categoria), 3, 'E lê todas as categorias');
select is((select count(*)::int from public.administracao_fila_pendencias), 0, 'E perdeu a fila de aprovação');
select throws_ok($$select public.perfis_decidir_versao('a1000000-0000-0000-0000-000000000002', false, 'x')$$, '42501', null, 'E não aprova mais');
reset role;

-- Auditoria só de administrador: E não lê.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-0000-0000-00000000000e","role":"authenticated"}', true);
select is((select count(*)::int from public.administracao_auditoria), 0, 'quem tem permissão específica não lê a auditoria geral');
reset role;

select * from finish();
rollback;
