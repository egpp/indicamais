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

-- 8. Libera a vaga (exige conta de teste no teto: rode à parte se o dono não estiver no teto) --------------------------------------------
-- Com o dono no teto de `tetos_anuncios_particulares` (ou itens do perfil), a criação falha com P0430 antes da exclusão e passa
-- depois dela; despublicar não libera. O pgTAP catalogo_item_exclusao.test.sql prova o mesmo com teto 1.

rollback;
