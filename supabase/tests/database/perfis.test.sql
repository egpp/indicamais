-- pgTAP · módulo perfis · perfis comerciais, versões, revisão e publicação
-- IM-006, IM-011, IM-012, IM-016, IM-017, IM-021, IM-022, IM-023, IM-029, IM-079, IM-086
-- Perfis nascem por perfis_criar_rascunho (atômico). Caminhos de imagem são opacos: perfil/<perfil_id>/<arquivo>.
begin;
select * from no_plan();

insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@teste.local'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@teste.local'),
  ('dddddddd-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd@teste.local');
insert into public.administracao_administrador (conta_id) values ('dddddddd-0000-0000-0000-00000000000d');
insert into public.catalogo_categoria (id, nome, slug, ativa, ordem) values
  ('11111111-0000-0000-0000-000000000001', 'Alimentação', 'alimentacao', true, 1),
  ('11111111-0000-0000-0000-000000000002', 'Antiga', 'antiga', false, 2),
  ('11111111-0000-0000-0000-000000000003', 'Serviços', 'servicos', true, 3);

-- Ajudantes só do teste (rodam com as permissões de quem chama, então respeitam a RLS).
create schema t;
grant usage on schema t to anon, authenticated;
create function t.perfil(p text) returns uuid language sql stable as $$ select id from public.perfis_perfil where slug = p $$;
create function t.pid(p text) returns uuid language sql stable security definer as $$ select id from public.perfis_perfil where slug = p $$;
-- Prefixo opaco da pasta do perfil (perfil/<perfil_id>), lido com os direitos de quem chama.
create function t.pf(p text) returns text language sql stable as $$
  select 'perfil/' || (select id from public.perfis_perfil where slug = p)::text $$;
create function t.versao(p text, s text) returns uuid language sql stable as $$
  select id from public.perfis_perfil_versao where perfil_id = (select id from public.perfis_perfil where slug = p) and situacao = s $$;

-- ===== A cria o perfil =====
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select lives_ok($$select public.perfis_criar_rascunho('loja-ana', '+5551999990001')$$, 'A cria o perfil com rascunho e WhatsApp numa transação');
select is((select count(*)::int from public.perfis_perfil_versao where perfil_id = t.perfil('loja-ana') and situacao = 'rascunho'), 1, 'o perfil nasce com a primeira versão (rascunho)');
select is((select count(*)::int from public.perfis_perfil_versao_contato where versao_id = t.versao('loja-ana', 'rascunho')), 1, 'e com o WhatsApp comercial');
select throws_ok($$select public.perfis_criar_rascunho('Loja Ana', '+5551999990001')$$, '23514', null, 'slug com maiúscula/espaço é rejeitado');
select throws_ok($$select public.perfis_criar_rascunho('ab', '+5551999990001')$$, '23514', null, 'slug curto é rejeitado');
select lives_ok($$select public.perfis_criar_rascunho('padaria-ana', '+5551999990004')$$, 'uma conta pode ter vários perfis (IM-006)');
select is((select count(*)::int from public.perfis_perfil), 2, 'A vê seus 2 perfis');
select is((select count(*)::int from public.perfis_meus_perfis), 2, 'perfis_meus_perfis lista os 2 perfis de A');
select throws_ok($$insert into public.perfis_perfil (responsavel_id, slug) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'direto-na-tabela')$$, '42501', null, 'perfil não nasce por INSERT direto');

-- Atomicidade: falha parcial não deixa perfil sem versão
select throws_ok($$select public.perfis_criar_rascunho('falha-uf', '+5551999990001', p_uf => 'XX')$$, '23514', null, 'versão inválida derruba a criação');
select is((select count(*)::int from public.perfis_perfil where slug = 'falha-uf'), 0, 'nenhum perfil órfão após falha na versão');
select throws_ok($$select public.perfis_criar_rascunho('falha-zap', '5551')$$, '23514', null, 'WhatsApp inválido derruba a criação');
select is((select count(*)::int from public.perfis_perfil where slug = 'falha-zap'), 0, 'nenhum perfil sem contato após falha no WhatsApp');
select throws_ok($$select public.perfis_criar_rascunho('falha-nulo', null)$$, '23514', null, 'WhatsApp nulo é recusado');

-- Conteúdo inválido (IM-011, IM-012, IM-016)
select throws_ok($$insert into public.perfis_perfil_versao (perfil_id, categoria_secundaria_2_id) values (t.perfil('loja-ana'), '11111111-0000-0000-0000-000000000003')$$, '23514', null, 'secundária 2 sem secundária 1 é rejeitada');
select throws_ok($$insert into public.perfis_perfil_versao (perfil_id, categoria_principal_id, categoria_secundaria_1_id) values (t.perfil('loja-ana'), '11111111-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001')$$, '23514', null, 'categoria repetida é rejeitada');
select throws_ok($$insert into public.perfis_perfil_versao (perfil_id, categoria_principal_id) values (t.perfil('loja-ana'), '11111111-0000-0000-0000-000000000002')$$, '23514', null, 'categoria inativa é rejeitada');
select throws_ok($$insert into public.perfis_perfil_versao (perfil_id, uf) values (t.perfil('loja-ana'), 'XX')$$, '23514', null, 'UF inválida é rejeitada');
select throws_ok($$insert into public.perfis_perfil_versao (perfil_id, site) values (t.perfil('loja-ana'), 'javascript:alert(1)')$$, '23514', null, 'site que não é http(s) é rejeitado');
select throws_ok($$insert into public.perfis_perfil_versao (perfil_id, informacoes_sociais) values (t.perfil('loja-ana'), 'https://instagram.com/lojadaana')$$, '23514', null, 'informação social com URL é rejeitada');
select throws_ok($$insert into public.perfis_perfil_versao (perfil_id, informacoes_sociais) values (t.perfil('loja-ana'), 'instagram.com/lojadaana')$$, '23514', null, 'informação social com domínio é rejeitada');
select throws_ok($$insert into public.perfis_perfil_versao (perfil_id, imagem_path) values (t.perfil('loja-ana'), t.pf('padaria-ana') || '/capa.jpg')$$, '23514', null, 'imagem na pasta de outro perfil é rejeitada');
select throws_ok($$insert into public.perfis_perfil_versao (perfil_id, imagem_path) values (t.perfil('loja-ana'), 'aaaaaaaa-0000-0000-0000-00000000000a/capa.jpg')$$, '23514', null, 'caminho com o id da conta (formato antigo) é rejeitado');
select throws_ok($$insert into public.perfis_perfil_versao (perfil_id, imagem_path) values (t.perfil('loja-ana'), t.pf('loja-ana') || '/sub/pasta.jpg')$$, '23514', null, 'subpasta no caminho é rejeitada');
select throws_ok($$insert into public.perfis_perfil_versao (perfil_id, banners_paths) values (t.perfil('loja-ana'), array[t.pf('loja-ana') || '/1.jpg', t.pf('loja-ana') || '/2.jpg', t.pf('loja-ana') || '/3.jpg', t.pf('loja-ana') || '/4.jpg'])$$, '23514', null, 'mais de 3 banners é rejeitado');
select throws_ok($$insert into public.perfis_perfil_versao (perfil_id, fotos_paths) values (t.perfil('loja-ana'), array(select t.pf('loja-ana') || '/f' || g || '.jpg' from generate_series(1, 7) g))$$, '23514', null, 'mais de 6 fotos é rejeitado (D-006)');

-- Rascunho válido (prévia, IM-017)
select lives_ok($$select public.perfis_gravar_versao(
  p_perfil_id => t.perfil('loja-ana'), p_whatsapp_comercial => '+5551999990001', p_nome => 'Loja da Ana',
  p_descricao_breve => 'Doces caseiros', p_imagem_path => t.pf('loja-ana') || '/capa.jpg',
  p_categoria_principal_id => '11111111-0000-0000-0000-000000000001', p_categoria_secundaria_1_id => '11111111-0000-0000-0000-000000000003',
  p_cidade => 'Porto Alegre', p_uf => 'RS',
  p_fotos_paths => array(select t.pf('loja-ana') || '/f' || g || '.jpg' from generate_series(1, 6) g),
  p_informacoes_sociais => 'Instagram: @lojadaana')$$, 'A salva o rascunho com 6 fotos (informação social só como texto)');
select is((select count(*)::int from public.perfis_perfil_versao where perfil_id = t.perfil('loja-ana')), 1, 'gravar reaproveita o rascunho aberto (não cria segundo)');
select is((select imagem_path from public.perfis_perfil_versao where perfil_id = t.perfil('loja-ana')), t.pf('loja-ana') || '/capa.jpg', 'imagem_path gravado no formato opaco perfil/<perfil_id>/<arquivo>');
select throws_ok($$select public.perfis_gravar_versao(p_perfil_id => t.perfil('loja-ana'), p_whatsapp_comercial => '5551', p_nome => 'Muda')$$, '23514', null, 'WhatsApp inválido desfaz a gravação da versão inteira');
select is((select nome from public.perfis_perfil_versao where perfil_id = t.perfil('loja-ana')), 'Loja da Ana', 'a versão não ficou meio gravada');
select throws_ok($$insert into public.perfis_perfil_versao (perfil_id, nome) values (t.perfil('loja-ana'), 'Segundo rascunho')$$, '23505', null, 'só uma versão aberta por perfil');
select throws_ok($$insert into public.perfis_perfil_versao_contato (versao_id, whatsapp_comercial_e164) values (t.versao('loja-ana', 'rascunho'), '5551999990001')$$, '23514', null, 'WhatsApp comercial sem +55 é rejeitado');
select throws_ok($$insert into public.perfis_perfil_versao_contato (versao_id, whatsapp_comercial_e164) values (t.versao('loja-ana', 'rascunho'), '+5551')$$, '23514', null, 'WhatsApp comercial curto é rejeitado');
select lives_ok($$update public.perfis_perfil_versao_contato set whatsapp_comercial_e164 = '+5551999990001' where versao_id = t.versao('loja-ana', 'rascunho')$$, 'A atualiza o WhatsApp comercial do rascunho');
select is((select count(*)::int from public.perfis_perfil_versao where situacao = 'rascunho'), 2, 'A lê os próprios rascunhos (prévia)');

-- A não toca em situação nem aprovação
select throws_ok($$update public.perfis_perfil_versao set situacao = 'aprovada'$$, '42501', null, 'A não altera a situação da versão');
select throws_ok($$update public.perfis_perfil set versao_aprovada_id = t.versao('loja-ana', 'rascunho') where slug = 'loja-ana'$$, '42501', null, 'A não define a versão aprovada');
select throws_ok($$update public.perfis_perfil set publicado = true where slug = 'loja-ana'$$, '23514', null, 'A não publica perfil nunca aprovado');
select throws_ok($$update public.perfis_perfil set responsavel_id = 'bbbbbbbb-0000-0000-0000-00000000000b' where slug = 'loja-ana'$$, '42501', null, 'A não transfere o perfil');
select throws_ok($$select public.perfis_decidir_versao(t.versao('loja-ana', 'rascunho'), true, null)$$, '42501', null, 'o dono não se auto-aprova');
select throws_ok($$select public.perfis_decidir_versao(t.versao('loja-ana', 'rascunho'), true, null)$$, '42501', null, 'o dono não aprova nem rascunho (função só de administrador)');

-- Enviar
select lives_ok($$select public.perfis_enviar_versao(t.versao('loja-ana', 'rascunho'))$$, 'A envia para aprovação');
select throws_ok($$select public.perfis_enviar_versao(t.versao('loja-ana', 'pendente'))$$, 'P0001', null, 'enviar duas vezes é recusado');
update public.perfis_perfil_versao set nome = 'Editei pendente' where situacao = 'pendente';
delete from public.perfis_perfil_versao where situacao = 'pendente';
select is((select count(*)::int from public.perfis_perfil_versao where situacao = 'pendente'), 1, 'versão pendente não é apagada pelo dono');

-- ===== Isolamento: anon e B =====
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.perfis_perfil_publico), 0, 'anon não vê perfil pendente');
select is((select count(*)::int from public.perfis_perfil), 0, 'anon não lê a tabela de perfis não publicados');
select is((select count(*)::int from public.perfis_perfil_versao), 0, 'anon não lê versões não aprovadas');
select throws_ok($$select * from public.perfis_perfil_versao_contato$$, '42501', null, 'anon não lê o WhatsApp comercial');
select throws_ok($$select * from public.perfis_revisao$$, '42501', null, 'anon não lê revisões');
select is(has_column_privilege('anon', 'public.perfis_perfil', 'responsavel_id', 'select'), false, 'anon não lê responsavel_id');
select throws_ok($$insert into public.perfis_perfil (responsavel_id, slug) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'invasor')$$, '42501', null, 'anon não cria perfil');
select is(public.perfis_perfil_disponivel(t.pid('loja-ana')), false, 'perfil pendente não está disponível');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((select count(*)::int from public.perfis_perfil), 0, 'B não vê perfis de A');
select is((select count(*)::int from public.perfis_perfil_versao) + (select count(*)::int from public.perfis_perfil_versao_contato) + (select count(*)::int from public.perfis_revisao), 0, 'B não vê versões, contato nem revisões de A');
update public.perfis_perfil set publicado = false;
select throws_ok($$insert into public.perfis_perfil (responsavel_id, slug) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'em-nome-de-a')$$, '42501', null, 'B não cria perfil em nome de A');
select throws_ok($$select public.perfis_criar_rascunho('loja-ana', '+5551999990005')$$, '23505', null, 'slug duplicado é rejeitado (e nada fica criado)');
select throws_ok($$delete from public.perfis_perfil$$, '42501', null, 'B não apaga perfil');
select throws_ok($$select public.perfis_enviar_versao((select id from public.perfis_perfil_versao limit 1))$$, '42501', null, 'B não envia versão alheia');

reset role;
select is((select nome from public.perfis_perfil_versao where situacao = 'pendente'), 'Loja da Ana', 'A não editou a versão pendente (congelada)');

-- ===== Administrador rejeita =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select is((select count(*)::int from public.administracao_fila_pendencias), 1, 'fila do administrador mostra a pendência');
select throws_ok($$select public.perfis_decidir_versao(t.versao('loja-ana', 'pendente'), false, null)$$, '22023', null, 'rejeitar exige motivo');
select throws_ok($$select public.perfis_decidir_versao(t.versao('loja-ana', 'pendente'), false, '   ')$$, '22023', null, 'motivo em branco não vale');
select lives_ok($$select public.perfis_decidir_versao(t.versao('loja-ana', 'pendente'), false, 'Imagem fora do padrão')$$, 'administrador rejeita com motivo');
select throws_ok($$select public.perfis_decidir_versao((select id from public.perfis_perfil_versao where situacao = 'rejeitada'), true, null)$$, 'P0001', null, 'versão já decidida não é decidida de novo');

select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((select count(*)::int from public.administracao_fila_pendencias), 0, 'fila vazia para quem não é administrador');
select throws_ok($$select public.perfis_decidir_versao(gen_random_uuid(), true, null)$$, '42501', null, 'quem não é administrador não decide');

-- ===== A vê o resultado (IM-023) e reenvia =====
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok($$select autor_id from public.perfis_revisao$$, '42501', null, 'A não lê autor_id direto da revisão (id real do administrador)');
select is((select count(*)::int from public.perfis_revisao), 0, 'A não lê a tabela de revisão (RLS)');
select is((select motivo from public.administracao_meus_resultados where tipo = 'perfil' and situacao = 'rejeitada'), 'Imagem fora do padrão', 'A lê o motivo da rejeição pela visão administracao_meus_resultados');
select isnt((select decidida_em from public.administracao_meus_resultados where tipo = 'perfil' and situacao = 'rejeitada'), null, 'a visão traz a data da decisão');
select is((select count(*)::int from public.administracao_meus_resultados where to_jsonb(administracao_meus_resultados)::text like '%dddddddd%'), 0, 'a visão não devolve o id real do administrador');
reset role;
select is((select autor_id from public.perfis_revisao where decisao = 'rejeitada'), 'dddddddd-0000-0000-0000-00000000000d'::uuid, 'revisão registra o autor (lido como superusuário)');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok($$insert into public.perfis_revisao (perfil_id, versao_id, decisao, autor_id) values (t.perfil('loja-ana'), t.versao('loja-ana', 'rejeitada'), 'aprovada', 'aaaaaaaa-0000-0000-0000-00000000000a')$$, '42501', null, 'A não forja revisão');
select lives_ok($$select public.perfis_gravar_versao(p_perfil_id => t.perfil('loja-ana'), p_whatsapp_comercial => '+5551999990001', p_nome => 'Loja da Ana', p_descricao_breve => 'Doces caseiros',
  p_imagem_path => t.pf('loja-ana') || '/capa2.jpg', p_categoria_principal_id => '11111111-0000-0000-0000-000000000001', p_cidade => 'Porto Alegre', p_uf => 'RS')$$, 'rejeitada libera nova versão (gravada com o WhatsApp)');
select is((select count(*)::int from public.perfis_perfil_versao_contato where versao_id = t.versao('loja-ana', 'rascunho')), 1, 'WhatsApp da nova versão gravado junto');
select is((select count(*)::int from public.administracao_meus_resultados where tipo = 'perfil' and situacao = 'rejeitada' and motivo = 'Imagem fora do padrão'), 1, 'A vê a rejeição e o motivo em administracao_meus_resultados (IM-023)');
select lives_ok($$select public.perfis_enviar_versao(t.versao('loja-ana', 'rascunho'))$$, 'A reenvia');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select lives_ok($$select public.perfis_decidir_versao(t.versao('loja-ana', 'pendente'), true, null)$$, 'administrador aprova');

-- Aprovado mas ainda NÃO publicado: continua invisível (IM-021)
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.perfis_perfil_publico), 0, 'aprovado e não publicado não aparece');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$update public.perfis_perfil set publicado = true where slug = 'loja-ana'$$, 'A publica o perfil aprovado');

reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.perfis_perfil_publico), 1, 'aprovado e publicado aparece');
select is((select nome from public.perfis_perfil_publico), 'Loja da Ana', 'anon lê o conteúdo da versão aprovada');
select is(public.perfis_perfil_disponivel(t.pid('loja-ana')), true, 'perfil aprovado e publicado está disponível');
select is((select count(*)::int from public.perfis_perfil_versao), 1, 'anon lê só a versão no ar');
select throws_ok($$select responsavel_id from public.perfis_perfil$$, '42501', null, 'anon não lê o responsável');
select is((select count(*)::int from information_schema.columns where table_name = 'perfis_perfil_publico' and column_name in ('responsavel_id', 'whatsapp_comercial_e164', 'email')), 0, 'visão pública não tem dado privado');

-- ===== Editar perfil público: versão pendente sem derrubar a aprovada (IM-022) =====
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok($$update public.perfis_perfil set slug = 'novo-slug' where slug = 'loja-ana'$$, '42501', null, 'slug não muda depois da aprovação');
select lives_ok($$insert into public.perfis_perfil_versao (perfil_id, nome, descricao_breve, imagem_path, categoria_principal_id, cidade, uf)
  values (t.perfil('loja-ana'), 'Loja da Ana Nova', 'Doces e salgados', t.pf('loja-ana') || '/capa2.jpg', '11111111-0000-0000-0000-000000000001', 'Porto Alegre', 'RS')$$, 'A edita: nova versão em rascunho');
select lives_ok($$insert into public.perfis_perfil_versao_contato (versao_id, whatsapp_comercial_e164) values (t.versao('loja-ana', 'rascunho'), '+5551999990002')$$, 'WhatsApp da edição');
select lives_ok($$select public.perfis_enviar_versao(t.versao('loja-ana', 'rascunho'))$$, 'A envia a edição');
select is((select count(*)::int from public.perfis_perfil_versao where perfil_id = t.perfil('loja-ana')), 3, 'A tem 3 versões em loja-ana (rejeitada, aprovada, pendente)');

reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select nome from public.perfis_perfil_publico), 'Loja da Ana', 'edição pendente não derruba a versão aprovada');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select lives_ok($$select public.perfis_decidir_versao(t.versao('loja-ana', 'pendente'), false, 'Descrição incompleta')$$, 'administrador rejeita a edição');
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select nome from public.perfis_perfil_publico), 'Loja da Ana', 'edição rejeitada mantém a aprovada no ar');

-- Aprovar edição
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$insert into public.perfis_perfil_versao (perfil_id, nome, descricao_breve, imagem_path, categoria_principal_id, cidade, uf)
  values (t.perfil('loja-ana'), 'Loja da Ana Nova', 'Doces e salgados completos', t.pf('loja-ana') || '/capa2.jpg', '11111111-0000-0000-0000-000000000001', 'Porto Alegre', 'RS')$$, 'A refaz a edição');
select lives_ok($$insert into public.perfis_perfil_versao_contato (versao_id, whatsapp_comercial_e164) values (t.versao('loja-ana', 'rascunho'), '+5551999990002')$$, 'WhatsApp da edição refeita');
select lives_ok($$select public.perfis_enviar_versao(t.versao('loja-ana', 'rascunho'))$$, 'A reenvia a edição');
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select lives_ok($$select public.perfis_decidir_versao(t.versao('loja-ana', 'pendente'), true, null)$$, 'administrador aprova a edição');
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select nome from public.perfis_perfil_publico), 'Loja da Ana Nova', 'edição aprovada passa a valer');

-- ===== Despublicar (IM-079) e editar despublicado não republica (IM-022) =====
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$update public.perfis_perfil set publicado = false where slug = 'loja-ana'$$, 'A despublica imediatamente');
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.perfis_perfil_publico), 0, 'despublicado some da leitura pública');
select is(public.perfis_perfil_disponivel(t.pid('loja-ana')), false, 'perfil despublicado está indisponível');
select is((select count(*)::int from public.perfis_perfil_versao), 0, 'versão aprovada de perfil despublicado não é pública');

reset role;
select is(public.perfis_perfil_disponivel((select id from public.perfis_perfil where slug = 'loja-ana')), false, 'perfil despublicado está indisponível (consulta interna)');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$insert into public.perfis_perfil_versao (perfil_id, nome, descricao_breve, imagem_path, categoria_principal_id, cidade, uf)
  values (t.perfil('loja-ana'), 'Loja da Ana 3', 'Mais uma edição', t.pf('loja-ana') || '/capa3.jpg', '11111111-0000-0000-0000-000000000001', 'Canoas', 'RS')$$, 'A edita o despublicado');
select lives_ok($$insert into public.perfis_perfil_versao_contato (versao_id, whatsapp_comercial_e164) values (t.versao('loja-ana', 'rascunho'), '+5551999990002')$$, 'WhatsApp');
select lives_ok($$select public.perfis_enviar_versao(t.versao('loja-ana', 'rascunho'))$$, 'A envia');
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select lives_ok($$select public.perfis_decidir_versao(t.versao('loja-ana', 'pendente'), true, null)$$, 'administrador aprova a edição do despublicado');
reset role;
select is((select publicado from public.perfis_perfil where slug = 'loja-ana'), false, 'aprovar edição não republica');
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.perfis_perfil_publico), 0, 'continua fora do ar até o dono publicar');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$update public.perfis_perfil set publicado = true where slug = 'loja-ana'$$, 'A republica quando quiser');
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select nome from public.perfis_perfil_publico), 'Loja da Ana 3', 'republicado mostra a última aprovada');

-- ===== B sobre perfil público de A =====
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-00000000000b","role":"authenticated"}', true);
update public.perfis_perfil set publicado = false where slug = 'loja-ana';
select throws_ok($$insert into public.perfis_perfil_versao (perfil_id, nome) values (t.perfil('loja-ana'), 'invasão')$$, '42501', null, 'B não cria versão no perfil de A');
select is((select count(*)::int from public.perfis_perfil_versao where perfil_id = t.perfil('loja-ana')), 1, 'B (logado) só lê a versão pública de A');
select is((select count(*)::int from public.perfis_perfil_versao_contato), 0, 'B não lê o WhatsApp comercial de A');
select is((select count(*)::int from public.perfis_revisao), 0, 'B não lê revisões de A');

-- ===== Administrador não aprova o próprio conteúdo =====
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select lives_ok($$select public.perfis_criar_rascunho('loja-admin', '+5551999990003')$$, 'administrador cria o próprio perfil');
select lives_ok($$select public.perfis_gravar_versao(p_perfil_id => t.perfil('loja-admin'), p_whatsapp_comercial => '+5551999990003', p_nome => 'Loja Admin', p_descricao_breve => 'Teste',
  p_imagem_path => t.pf('loja-admin') || '/capa.jpg', p_categoria_principal_id => '11111111-0000-0000-0000-000000000001', p_cidade => 'Porto Alegre', p_uf => 'RS')$$, 'rascunho do administrador');
delete from public.perfis_perfil_versao_contato where versao_id = t.versao('loja-admin', 'rascunho');
select throws_ok($$select public.perfis_enviar_versao(t.versao('loja-admin', 'rascunho'))$$, '23514', null, 'enviar sem WhatsApp comercial é recusado');
select lives_ok($$select public.perfis_gravar_versao(p_perfil_id => t.perfil('loja-admin'), p_whatsapp_comercial => '+5551999990003', p_nome => 'Loja Admin', p_descricao_breve => 'Teste',
  p_imagem_path => t.pf('loja-admin') || '/capa.jpg', p_categoria_principal_id => '11111111-0000-0000-0000-000000000001', p_cidade => 'Porto Alegre', p_uf => 'RS')$$, 'WhatsApp do administrador regravado');
select lives_ok($$select public.perfis_enviar_versao(t.versao('loja-admin', 'rascunho'))$$, 'administrador envia');
select throws_ok($$select public.perfis_decidir_versao(t.versao('loja-admin', 'pendente'), true, null)$$, '42501', null, 'administrador não aprova o próprio perfil');

-- ===== Histórico imutável (vale até para superusuário/service_role) =====
reset role;
select throws_ok($$update public.perfis_perfil_versao set nome = 'alterada' where situacao = 'aprovada'$$, '42501', null, 'versão aprovada é imutável');
select throws_ok($$update public.perfis_perfil_versao set nome = 'alterada' where situacao = 'pendente'$$, '42501', null, 'versão pendente é imutável');
select throws_ok($$update public.perfis_perfil_versao set situacao = 'rejeitada' where situacao = 'aprovada'$$, '42501', null, 'versão aprovada não volta atrás');
select throws_ok($$update public.perfis_perfil_versao set situacao = 'aprovada' where situacao = 'rejeitada'$$, '42501', null, 'versão rejeitada não vira aprovada');
select throws_ok($$delete from public.perfis_perfil_versao where situacao = 'aprovada'$$, '42501', null, 'versão aprovada não é apagada');
select throws_ok($$update public.perfis_revisao set motivo = 'x'$$, '42501', null, 'revisão é só inserção (update)');
select throws_ok($$delete from public.perfis_revisao$$, '42501', null, 'revisão é só inserção (delete)');
select throws_ok($$update public.perfis_perfil_versao_contato set whatsapp_comercial_e164 = '+5551999990009' where versao_id = (select id from public.perfis_perfil_versao where situacao = 'aprovada' limit 1)$$, '42501', null, 'contato de versão aprovada é imutável');
select is((select count(*)::int from public.perfis_revisao where versao_aprovada_anterior_id is not null), 3, 'revisões guardam a versão aprovada anterior (valor anterior)');
select is((select count(*)::int from public.perfis_revisao where decisao = 'rejeitada' and motivo is null), 0, 'toda rejeição tem motivo');
select throws_ok($$insert into public.perfis_revisao (perfil_id, versao_id, decisao, autor_id) select perfil_id, id, 'rejeitada', 'dddddddd-0000-0000-0000-00000000000d'::uuid from public.perfis_perfil_versao where situacao = 'pendente' limit 1$$, '23514', null, 'rejeição sem motivo é recusada até no banco');
select is((select count(*)::int from information_schema.columns where table_name = 'perfis_perfil_versao_contato' and column_name like '%verific%'), 0, 'WhatsApp comercial nunca é marcado como verificado (sem coluna)');

select * from finish();
rollback;
