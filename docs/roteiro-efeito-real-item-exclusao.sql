-- Roteiro de efeito real · exclusão lógica de item (IM-108, IM-105, IM-102, D-040) · SÓ no ambiente de DESENVOLVIMENTO,
-- DEPOIS que a migração 20261114100000 for aplicada com "aprovado" do Emerson. Tudo termina em ROLLBACK: nada fica gravado.
-- Para o verificador (quem implementa não verifica). Não usa service_role em código de cliente: roda no editor SQL do
-- Supabase (papel postgres), simulando os papéis por `set local role` + claims, como o pgTAP.
--
-- Uso: troque os três UUIDs abaixo por contas de TESTE do dev: DONO (com ao menos 1 item publicado e aprovado), OUTRO
-- (conta comum sem relação com o dono) e ADM (administrador). Rode o bloco inteiro de uma vez. Cada `select` de conferência
-- traz o valor esperado no rótulo; qualquer divergência reprova. Ao final o ROLLBACK desfaz tudo.

begin;

-- 0. Parâmetros do roteiro (troque) -------------------------------------------------------------------------------------
create temp table r_ctx as select
  '00000000-0000-0000-0000-0000000000d1'::uuid as dono,
  '00000000-0000-0000-0000-0000000000b2'::uuid as outro,
  '00000000-0000-0000-0000-0000000000a3'::uuid as adm;
grant select on r_ctx to anon, authenticated;

-- Item do dono para o teste: um item publicado e aprovado qualquer (o roteiro não cria nada fora da transação).
create temp table r_item as
  select i.id from public.catalogo_item i, r_ctx c
  where i.conta_id = c.dono and i.publicado and i.versao_aprovada_id is not null and i.excluido_em is null
  order by i.criado_em limit 1;
grant select on r_item to anon, authenticated;

-- 1. FOTO ANTES: contagens que a exclusão NÃO pode mudar ----------------------------------------------------------------
create temp table r_antes as select
  (select count(*) from public.indicacoes_pedido_contato p, r_item r where p.item_id = r.id) as pedidos,
  (select count(*) from public.indicacoes_link l, r_item r where l.item_id = r.id) as links,
  (select count(*) from public.catalogo_item_versao v, r_item r where v.item_id = r.id) as versoes,
  (select count(*) from public.pontos_lancamento) as lancamentos_pontos,
  (select count(*) from public.catalogo_item) as itens_total;
select 'ANTES: item de teste escolhido (esperado 1 linha)' as passo, count(*) from r_item;
select 'ANTES: visível na visão pública (esperado 1)' as passo, count(*) from public.catalogo_item_publico p, r_item r where p.id = r.id;
select 'ANTES: visível na busca (esperado >= 1)' as passo, count(*)
  from public.busca_publica(null, null, null, null, null, 50, 1) b, r_item r where b.o_id = r.id;

-- 2. Anônimo não executa as funções ---------------------------------------------------------------------------------------
select 'anon sem EXECUTE nas 3 funções (esperado false,false,false)' as passo,
  has_function_privilege('anon', 'public.catalogo_excluir_item(uuid,text)', 'EXECUTE'),
  has_function_privilege('anon', 'public.catalogo_despublicar_item(uuid,text)', 'EXECUTE'),
  has_function_privilege('anon', 'public.catalogo_republicar_item(uuid)', 'EXECUTE');

-- 3. Dono alheio não exclui (esperado: erro P0002 'item não encontrado') -----------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select outro from r_ctx), 'role', 'authenticated')::text, true);
do $$ begin
  perform public.catalogo_excluir_item((select id from r_item));
  raise exception 'REPROVADO: outro excluiu item alheio';
exception when sqlstate 'P0002' then raise notice 'OK: outro não exclui (P0002)'; end $$;
select 'OUTRO não lê histórico (esperado 0)' as passo, count(*) from public.catalogo_item_ciclo;
reset role;
select 'item segue publicado após a tentativa alheia (esperado true)' as passo, i.publicado from public.catalogo_item i, r_item r where i.id = r.id;

-- 4. Dono despublica, republica e exclui; repetir não duplica ----------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select dono from r_ctx), 'role', 'authenticated')::text, true);
select public.catalogo_despublicar_item((select id from r_item), 'roteiro');
select public.catalogo_despublicar_item((select id from r_item), 'roteiro');
select public.catalogo_republicar_item((select id from r_item));
select public.catalogo_excluir_item((select id from r_item), 'roteiro de verificação');
select public.catalogo_excluir_item((select id from r_item), 'repetido');
select 'DONO: histórico do item (esperado despublicar=1, republicar=1, excluir=1)' as passo, acao, count(*)
  from public.catalogo_item_ciclo c, r_item r where c.item_id = r.id group by acao order by acao;
select 'DONO: some do painel (esperado 0)' as passo, count(*) from public.catalogo_meus_itens m, r_item r where m.id = r.id;
reset role;

-- 5. EFEITO: esconde de todas as leituras públicas ------------------------------------------------------------------------------
set local role anon;
select 'ANON: visão pública (esperado 0)' as passo, count(*) from public.catalogo_item_publico p, r_item r where p.id = r.id;
select 'ANON: busca (esperado 0)' as passo, count(*)
  from public.busca_publica(null, null, null, null, null, 50, 1) b, r_item r where b.o_id = r.id;
select 'ANON: tabela do item e versões (esperado 0 e 0)' as passo,
  (select count(*) from public.catalogo_item i, r_item r where i.id = r.id),
  (select count(*) from public.catalogo_item_versao v, r_item r where v.item_id = r.id);
reset role;
-- Imagem, contato e link dependem de `publicado` (invariante do banco: excluído nunca é publicado).
select 'foto pública (esperado false)' as passo, public.catalogo_imagem_publica(v.foto_path)
  from public.catalogo_item_versao v, r_item r where v.id = (select versao_aprovada_id from public.catalogo_item where id = r.id);
select 'item excluído e despublicado (esperado true,true)' as passo, i.excluido_em is not null, i.publicado = false
  from public.catalogo_item i, r_item r where i.id = r.id;

-- 6. EFEITO: preserva pedidos, links, versões e pontos (iguais à foto de antes) ------------------------------------------------------
select 'PRESERVADO (esperado tudo true)' as passo,
  (select count(*) from public.indicacoes_pedido_contato p, r_item r where p.item_id = r.id) = a.pedidos as pedidos,
  (select count(*) from public.indicacoes_link l, r_item r where l.item_id = r.id) = a.links as links,
  (select count(*) from public.catalogo_item_versao v, r_item r where v.item_id = r.id) = a.versoes as versoes,
  (select count(*) from public.pontos_lancamento) = a.lancamentos_pontos as pontos,
  (select count(*) from public.catalogo_item) = a.itens_total as nenhuma_linha_apagada
from r_antes a;

-- 7. Administrador lê o histórico ------------------------------------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select adm from r_ctx), 'role', 'authenticated')::text, true);
select 'ADM lê o histórico do item (esperado >= 3)' as passo, count(*) from public.catalogo_item_ciclo c, r_item r where c.item_id = r.id;
reset role;

-- 8. Casos com contas descartáveis criadas DENTRO da transação (somem no ROLLBACK) -------------------------------------------------
-- F = criador (cidade/UF, herança do site, rascunho de site sem cidade, versão pendente cancelada); G = vaga do teto;
-- S = conta suspensa. Nada disto depende dos três UUIDs do início. Roda no editor SQL do dev (papel postgres).
insert into auth.users (id, instance_id, aud, role, email) values
  ('ffffffff-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'roteiro-f@teste.local'),
  ('ffffffff-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'roteiro-g@teste.local'),
  ('ffffffff-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'roteiro-s@teste.local');
insert into public.contas_ciclo_vida (conta_id, situacao, suspensa_em)
  values ('ffffffff-0000-0000-0000-0000000000f3', 'suspensa', now());
-- Sites de F: S1 com cidade/UF (Canoas/RS) e S2 SEM cidade/UF. Itens de G (vaga) e de S (suspensa).
insert into public.perfis_perfil (id, responsavel_id, slug) values
  ('f0000000-0000-0000-0000-0000000000a1', 'ffffffff-0000-0000-0000-0000000000f1', 'roteiro-site-com-cidade'),
  ('f0000000-0000-0000-0000-0000000000a2', 'ffffffff-0000-0000-0000-0000000000f1', 'roteiro-site-sem-cidade');
insert into public.perfis_perfil_versao (perfil_id, nome, cidade, uf) values
  ('f0000000-0000-0000-0000-0000000000a1', 'Roteiro com cidade', 'Canoas', 'RS'),
  ('f0000000-0000-0000-0000-0000000000a2', 'Roteiro sem cidade', null, null);
insert into public.catalogo_item (id, conta_id, perfil_id, tipo, cidade, uf) values
  ('f0000000-0000-0000-0000-0000000000b2', 'ffffffff-0000-0000-0000-0000000000f2', null, 'produto', 'Recife', 'PE'),
  ('f0000000-0000-0000-0000-0000000000b3', 'ffffffff-0000-0000-0000-0000000000f3', null, 'produto', 'Recife', 'PE');
create temp table r_cat as select id from public.catalogo_categoria where ativa order by ordem, id limit 1;
grant select on r_cat to authenticated;

-- 8a. Conta suspensa não exclui (esperado: 42501) -----------------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"ffffffff-0000-0000-0000-0000000000f3","role":"authenticated"}', true);
do $$ begin
  perform public.catalogo_excluir_item('f0000000-0000-0000-0000-0000000000b3');
  raise exception 'REPROVADO: conta suspensa excluiu';
exception when sqlstate '42501' then raise notice 'OK 8a: conta suspensa não exclui (42501)'; end $$;
reset role;
select '8a: item da conta suspensa segue sem exclusão (esperado true)' as passo,
  excluido_em is null from public.catalogo_item where id = 'f0000000-0000-0000-0000-0000000000b3';

-- 8b. Criação com cidade/UF, herança do site e rascunho de site sem cidade ----------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"ffffffff-0000-0000-0000-0000000000f1","role":"authenticated"}', true);
do $$ begin
  perform public.catalogo_criar_item('produto', null, p_nome => 'Sem local');
  raise exception 'REPROVADO: anúncio particular sem cidade/UF foi criado';
exception when sqlstate '23514' then raise notice 'OK 8b: particular sem cidade/UF = 23514'; end $$;
select o_item_id from public.catalogo_criar_item('produto', null, p_nome => 'Com local', p_cidade => ' Recife ', p_uf => 'pe');
select '8b: localização gravada aparada (esperado Recife/PE)' as passo, cidade || '/' || uf
  from public.catalogo_meus_itens where cidade = 'Recife';
select o_item_id from public.catalogo_criar_item('servico', 'f0000000-0000-0000-0000-0000000000a1', p_nome => 'Serviço herda');
select '8b: item de site herda a do site (esperado Canoas/RS)' as passo, cidade || '/' || uf
  from public.catalogo_meus_itens where perfil_id = 'f0000000-0000-0000-0000-0000000000a1';
-- Site sem cidade: o rascunho NASCE (antes dava 23514 sem saída); o envio é que falha, com erro próprio.
select o_item_id from public.catalogo_criar_item('servico', 'f0000000-0000-0000-0000-0000000000a2',
  p_nome => 'Serviço sem cidade', p_descricao => 'Descrição', p_categoria_principal_id => (select id from r_cat));
select '8b: rascunho de site sem cidade criado, cidade nula (esperado true)' as passo, cidade is null
  from public.catalogo_meus_itens where perfil_id = 'f0000000-0000-0000-0000-0000000000a2';
update public.catalogo_item_versao v set foto_path = 'item/' || v.item_id::text || '/f.jpg' where v.nome = 'Serviço sem cidade';
do $$ begin
  perform public.catalogo_enviar_item_versao((select id from public.catalogo_item_versao where nome = 'Serviço sem cidade'));
  raise exception 'REPROVADO: enviou item de site sem cidade/UF';
exception when sqlstate 'P0001' then
  if sqlerrm <> 'localizacao_obrigatoria' then raise exception 'REPROVADO: mensagem inesperada %', sqlerrm; end if;
  raise notice 'OK 8b: envio sem cidade no site = P0001 localizacao_obrigatoria'; end $$;
reset role;

-- 8c. Versão pendente é cancelada na exclusão (motivo, revisão e auditoria; some da fila) --------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"ffffffff-0000-0000-0000-0000000000f1","role":"authenticated"}', true);
select o_item_id from public.catalogo_criar_item('produto', null, p_nome => 'Pendente vai sumir', p_descricao => 'Descrição',
  p_categoria_principal_id => (select id from r_cat), p_cidade => 'Recife', p_uf => 'PE');
update public.catalogo_item_versao v set foto_path = 'item/' || v.item_id::text || '/f.jpg' where v.nome = 'Pendente vai sumir';
select public.catalogo_enviar_item_versao((select id from public.catalogo_item_versao where nome = 'Pendente vai sumir'));
select public.catalogo_excluir_item((select item_id from public.catalogo_item_versao where nome = 'Pendente vai sumir'), 'roteiro');
reset role;
select '8c: versão virou rejeitada (esperado rejeitada)' as passo, situacao
  from public.catalogo_item_versao where nome = 'Pendente vai sumir';
select '8c: revisão (esperado rejeitada | item excluído)' as passo, decisao, motivo
  from public.catalogo_item_revisao r join public.catalogo_item_versao v on v.id = r.versao_id where v.nome = 'Pendente vai sumir';
select '8c: auditoria (esperado 1 linha, valor anterior pendente)' as passo, acao, valor_anterior ->> 'situacao'
  from public.administracao_auditoria a join public.catalogo_item_versao v on v.id::text = a.alvo_id
  where v.nome = 'Pendente vai sumir' and a.acao = 'cancelar_versao_item_excluido';
select '8c: nenhuma pendente sobra (esperado 0)' as passo, count(*)
  from public.catalogo_item_versao v where v.nome = 'Pendente vai sumir' and v.situacao = 'pendente';

-- 8d. EXECUTÁVEL: excluir LIBERA a vaga do teto (teto 1 só nesta transação; ROLLBACK desfaz) ---------------------------------------------
-- G tem 1 particular e o teto de anúncios particulares passa a ser 1: criar outro falha com P0430; depois de excluir, passa.
update public.contas_parametro set valor = 1 where chave = 'tetos_anuncios_particulares';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"ffffffff-0000-0000-0000-0000000000f2","role":"authenticated"}', true);
do $$ begin
  perform public.catalogo_criar_item('produto', null, p_nome => 'Segundo', p_cidade => 'Recife', p_uf => 'PE');
  raise exception 'REPROVADO: G passou do teto';
exception when sqlstate 'P0430' then raise notice 'OK 8d: G está no teto (P0430)'; end $$;
select public.catalogo_excluir_item('f0000000-0000-0000-0000-0000000000b2', 'libera vaga');
select 'OK 8d: depois de excluir, a criação passa (esperado true)' as passo, o_item_id is not null
  from public.catalogo_criar_item('produto', null, p_nome => 'Segundo', p_cidade => 'Recife', p_uf => 'PE');
do $$ begin
  perform public.catalogo_criar_item('produto', null, p_nome => 'Terceiro', p_cidade => 'Recife', p_uf => 'PE');
  raise exception 'REPROVADO: o teto deixou de valer';
exception when sqlstate 'P0430' then raise notice 'OK 8d: o teto volta a valer (P0430)'; end $$;
reset role;

-- 9. Backfill no DEV: contagem ANTES e DEPOIS de aplicar a migração (rodar à parte, FORA deste bloco, com "aprovado") -------------------
-- ANTES do `db push` (as colunas novas ainda não existem): guarde estes números.
--   select count(*) as itens, count(*) filter (where perfil_id is null) as particulares,
--          count(*) filter (where perfil_id is not null and tipo <> 'imovel') as de_site,
--          count(*) filter (where tipo = 'imovel') as imoveis from public.catalogo_item;
-- DEPOIS do `db push` (o aviso da migração já imprime "N itens, M sem cidade/UF"):
--   select count(*) as itens, count(*) filter (where cidade is null) as sem_cidade,
--          count(*) filter (where cidade is not null) as com_cidade,
--          count(*) filter (where (cidade is null) <> (uf is null)) as pares_quebrados   -- esperado 0
--   from public.catalogo_item;
--   -- imóveis com localização PRÓPRIA preservada (esperado 0 linhas: item diferente da própria versão aprovada):
--   select i.id, i.cidade, v.cidade as cidade_versao from public.catalogo_item i
--   join public.catalogo_item_versao v on v.id = i.versao_aprovada_id
--   where i.tipo = 'imovel' and v.cidade is not null and i.cidade is distinct from btrim(v.cidade);
--   -- itens sem fonte (ficam NULL e seguem funcionando): liste para decidir à parte.
--   select id, tipo, perfil_id from public.catalogo_item where cidade is null;
-- Conferência: `itens` antes = `itens` depois; com_cidade + sem_cidade = itens.

rollback;
