-- Fase 17 · módulo catalogo · modelo do item: tipo "procura", localização própria, exclusão lógica e histórico das ações do dono
-- IM-105, IM-108, IM-102, IM-078, IM-086, IM-029 (D-040: P1, P3, P8, P11, P14; D-039; D-035 refinada)
--
-- ESTA MIGRAÇÃO É NOVA E NÃO FOI APLICADA EM NENHUM AMBIENTE. O `db push` no dev só com "aprovado" do Emerson (D-003).
--
-- DESENHO
--   1. TIPO. A coluna catalogo_item.tipo JÁ EXISTE ('produto', 'servico', 'imovel'; imutável, 20261103140000). Nesta base
--      "produto" é a OFERTA (anúncio de venda) da D-040: não se renomeia (quebraria busca_publica, visões, código e links).
--      Entra o valor 'procura' (anúncio de compra, IM-109), mas BLOQUEADO por um CHECK próprio
--      (catalogo_item_procura_indisponivel) que o PR do IM-109 remove. O campo nasce pronto e não utilizável.
--   2. LOCALIZAÇÃO PRÓPRIA do item (cidade e UF, nunca endereço): colunas catalogo_item.cidade/uf.
--        * Itens EXISTENTES: preenchidos aqui pela função catalogo_item_preencher_localizacao_legada (testável; sem acesso da
--          API). Particular e IMÓVEL de site: da PRÓPRIA versão aprovada do item (senão a mais recente com cidade e UF
--          válidas). Item de perfil sem localização própria (e imóvel sem localização própria): da versão aprovada do perfil
--          (senão a mais recente com cidade e UF válidas).
--          A conta NÃO tem cidade (contas_conta não guarda localização): não é fonte. Item sem nenhuma fonte fica NULL
--          (o aviso mostra a contagem) e continua funcionando; o público segue lendo do jeito de hoje (esta migração não
--          mexe nas visões públicas de localização).
--        * Itens NOVOS: catalogo_criar_item (único caminho de criação do dono) exige cidade e UF. Item de perfil sem cidade/UF
--          informadas herda a do perfil (padrão da D-040 P8). Só uma das duas = 23514. Anúncio particular e imóvel sem
--          localização resolvida = 23514. Item de site (não imóvel) pode ficar sem cidade/UF no RASCUNHO (o Zod proíbe cidade
--          em item de site; o site pode ainda não ter cidade): ao ENVIAR para aprovação, catalogo_enviar_item_versao herda a
--          do site ou falha com P0001 'localizacao_obrigatoria' (mensagem própria, o dono corrige a cidade do site).
--          INSERT direto continua negado ao cliente; fixtures do banco (papel postgres) não são afetadas.
--        * A versão (catalogo_item_versao.cidade/uf) segue como está: anúncio particular continua gravando a cidade/UF na
--          versão (aprovação por versão, D-008) e item de perfil continua proibido de gravá-las na versão.
--        * Sem edição de cidade/UF do item nesta migração (sem GRANT de UPDATE): como o dono edita (com ou sem nova
--          aprovação) é decisão do PR da interface (dúvida registrada).
--   3. EXCLUSÃO LÓGICA: excluido_em, excluido_por, excluido_motivo (opcional, até 500). Excluir faz publicado = false e
--      grava excluido_em NA MESMA transação; versão pendente do item é rejeitada junto (motivo 'item excluído', revisão e
--      auditoria cancelar_versao_item_excluido), para não ficar na fila nem dar P0002 ao administrador. Invariante por CHECK: excluído nunca está publicado. Por isso TODA leitura
--      pública que já exige `publicado` (catalogo_item_publico, loja_item_publico, busca_publica, contato, link de
--      indicação, pontos, imagem, mapa, home) já o esconde SEM reescrita. O que muda são só as leituras do DONO e do
--      administrador: catalogo_meus_itens, administracao_meus_resultados, administracao_fila_pendencias, as políticas
--      select_proprio/update_proprio, catalogo_eh_dono e um gatilho que impede nova versão em item excluído.
--      Nunca apaga linha: indicações, pedidos, pontos, comissões e histórico ficam intactos (FKs seguem RESTRICT).
--      A exclusão não se desfaz (gatilho). A eliminação real de dado pessoal é da revisão jurídica (IM-082).
--   4. HISTÓRICO catalogo_item_ciclo: SÓ INSERÇÃO (gatilho de imutabilidade + sem escrita para cliente). Ações do dono:
--      despublicar, republicar, excluir. Guarda autor, data, motivo e valor anterior. Legível pelo dono (inclusive do item
--      excluído) e pelo administrador. autor_id e conta_id ficam fora do SELECT de qualquer cliente (padrão da revisão).
--      Um único evento 'excluir' por item (índice único parcial) e as funções são idempotentes (repetir = nada acontece).
--   5. FUNÇÕES SECURITY DEFINER (search_path vazio; só authenticated; checagem de dono DENTRO):
--        catalogo_despublicar_item(item, motivo)  catalogo_republicar_item(item)  catalogo_excluir_item(item, motivo)
--      Item alheio ou inexistente = P0002 'item não encontrado' (mesma resposta, sem revelar existência).
--      Conta que não está 'ativa' (suspensa, em encerramento, anonimizada) NÃO exclui nem republica (42501); despublicar é
--      sempre permitido a quem ainda consegue chamar.
--   6. TETO: contas_exigir_teto_criacao passa a ignorar item excluído (a exclusão LIBERA a vaga; despublicar, arquivar e
--      vencer não liberam: continuam contando). O teto único de 10 por conta e o limite diário são do PR 3.
--
-- LIMITES CONHECIDOS (anotados, não resolvidos aqui)
--   * O dono ainda pode alternar `publicado` por UPDATE direto (GRANT existente); esse caminho NÃO grava histórico. O PR da
--     interface passa a usar as funções e então o GRANT de UPDATE (publicado) pode ser revogado.
--   * administracao_consulta_negocios (lista administrativa) mostra o item excluído como não publicado, sem selo.

-- 1. Tipo -------------------------------------------------------------------------------------------------------------
alter table public.catalogo_item drop constraint catalogo_item_tipo;
alter table public.catalogo_item
  add constraint catalogo_item_tipo check (tipo in ('produto', 'servico', 'imovel', 'procura'));
-- Anúncio de compra (IM-109) ainda não está liberado: o PR do IM-109 remove esta restrição.
alter table public.catalogo_item
  add constraint catalogo_item_procura_indisponivel check (tipo <> 'procura');

-- 2 e 3. Colunas novas ------------------------------------------------------------------------------------------------
alter table public.catalogo_item
  add column cidade text,
  add column uf text,
  add column excluido_em timestamptz,
  add column excluido_por uuid references public.contas_conta (id) on delete restrict,
  add column excluido_motivo text;

alter table public.catalogo_item
  add constraint catalogo_item_cidade check (cidade is null or char_length(btrim(cidade)) between 2 and 80),
  add constraint catalogo_item_uf check (uf is null or uf in (
    'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')),
  add constraint catalogo_item_localizacao_par check ((cidade is null) = (uf is null)),
  add constraint catalogo_item_excluido_coerente check ((excluido_em is null) = (excluido_por is null)),
  add constraint catalogo_item_excluido_motivo check (excluido_motivo is null or (excluido_em is not null and char_length(excluido_motivo) <= 500)),
  -- Invariante que mantém toda leitura pública que já exige `publicado` escondendo o item excluído.
  add constraint catalogo_item_excluido_despublicado check (excluido_em is null or publicado = false);

create index catalogo_item_conta_ativos_idx on public.catalogo_item (conta_id) where excluido_em is null;

-- Cidade e UF do item são públicas por natureza (aparecem no card). O resto (excluido_*) não tem SELECT para cliente.
grant select (cidade, uf) on public.catalogo_item to anon, authenticated;

-- Preenchimento dos itens existentes, em função própria para ser testada com dado legado (pgTAP). Idempotente: só toca item
-- sem cidade. Gatilhos de usuário desligados só durante o preenchimento (não tocar atualizado_em nem esbarrar na trava de
-- publicação de conta suspensa); religados no fim, na mesma transação. Sem acesso da API (só o dono do banco executa).
create function public.catalogo_item_preencher_localizacao_legada() returns integer
language plpgsql set search_path = '' as $$
declare
  v_n integer;
begin
  alter table public.catalogo_item disable trigger user;
  update public.catalogo_item i
     set cidade = s.cidade, uf = s.uf
    from (
      select i2.id,
             coalesce(a.cidade, b.cidade) as cidade,
             coalesce(a.uf, b.uf) as uf
      from public.catalogo_item i2
      left join lateral (
        select btrim(v.cidade) as cidade, v.uf
        from public.catalogo_item_versao v
        where (i2.perfil_id is null or i2.tipo = 'imovel') and v.item_id = i2.id
          and v.cidade is not null and v.uf is not null
          and char_length(btrim(v.cidade)) between 2 and 80
        order by (v.id = i2.versao_aprovada_id) desc, v.criado_em desc, v.id desc
        limit 1) a on true
      left join lateral (
        select btrim(pv.cidade) as cidade, pv.uf
        from public.perfis_perfil_versao pv
        join public.perfis_perfil p on p.id = pv.perfil_id
        where i2.perfil_id is not null and pv.perfil_id = i2.perfil_id
          and pv.cidade is not null and pv.uf is not null
          and char_length(btrim(pv.cidade)) between 2 and 80
          and pv.uf in ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')
        order by (pv.id = p.versao_aprovada_id) desc, pv.criado_em desc, pv.id desc
        limit 1) b on true) s
   where i.id = s.id and i.cidade is null and s.cidade is not null and s.uf is not null;
  get diagnostics v_n = row_count;
  alter table public.catalogo_item enable trigger user;
  return v_n;
end $$;
revoke all on function public.catalogo_item_preencher_localizacao_legada() from public, anon, authenticated;

select public.catalogo_item_preencher_localizacao_legada();

do $$
declare
  v_total integer;
  v_sem integer;
begin
  select count(*), count(*) filter (where cidade is null) into v_total, v_sem from public.catalogo_item;
  raise notice 'catalogo_item: % itens, % sem cidade/UF (sem fonte para preencher; seguem funcionando)', v_total, v_sem;
end $$;

-- Gatilho de proteção: a exclusão não se desfaz e não se reescreve -------------------------------------------------------
create or replace function public.catalogo_item_proteger() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.id <> old.id or new.conta_id <> old.conta_id or new.perfil_id is distinct from old.perfil_id
     or new.tipo <> old.tipo then
    raise exception 'dono, perfil e tipo do item são imutáveis' using errcode = '42501';
  end if;
  if old.excluido_em is not null and (
       new.excluido_em is distinct from old.excluido_em
       or new.excluido_por is distinct from old.excluido_por
       or new.excluido_motivo is distinct from old.excluido_motivo) then
    raise exception 'a exclusão do item não se desfaz' using errcode = '42501';
  end if;
  return new;
end $$;

-- Item excluído não recebe versão nova nem muda de situação (nenhum caminho reabre o item) -----------------------------
create function public.catalogo_item_versao_item_excluido() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.catalogo_item i where i.id = new.item_id and i.excluido_em is not null) then
    raise exception 'item excluído' using errcode = 'P0002';
  end if;
  return new;
end $$;
revoke all on function public.catalogo_item_versao_item_excluido() from public, anon, authenticated;
create trigger catalogo_item_versao_item_excluido before insert or update on public.catalogo_item_versao
  for each row execute function public.catalogo_item_versao_item_excluido();

-- Dono para as políticas das versões: item excluído deixa de ser "do dono" (some do painel) ---------------------------
create or replace function public.catalogo_eh_dono(p_item_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.catalogo_item i
    where i.id = p_item_id and i.conta_id = (select auth.uid()) and i.excluido_em is null);
$$;
create or replace function public.catalogo_eh_dono_da_versao(p_versao_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.catalogo_item_versao v join public.catalogo_item i on i.id = v.item_id
    where v.id = p_versao_id and i.conta_id = (select auth.uid()) and i.excluido_em is null);
$$;

-- Políticas do item: o dono não lê nem altera item excluído ---------------------------------------------------------------
drop policy catalogo_item_select_proprio on public.catalogo_item;
create policy catalogo_item_select_proprio on public.catalogo_item
  for select to authenticated using (conta_id = (select auth.uid()) and excluido_em is null);
drop policy catalogo_item_update_proprio on public.catalogo_item;
create policy catalogo_item_update_proprio on public.catalogo_item
  for update to authenticated
  using (conta_id = (select auth.uid()) and excluido_em is null)
  with check (conta_id = (select auth.uid()) and excluido_em is null);

-- Leituras do dono e do administrador (mesmas colunas; colunas novas ao final) ---------------------------------------------
create or replace view public.catalogo_meus_itens as
select i.id, i.perfil_id, i.tipo, i.publicado, i.versao_aprovada_id, i.criado_em, i.atualizado_em, i.cidade, i.uf
from public.catalogo_item i
where i.conta_id = (select auth.uid()) and i.excluido_em is null;

create or replace view public.administracao_meus_resultados as
select 'perfil'::text as tipo, v.perfil_id as alvo_id, v.id as versao_id, v.situacao, v.nome,
       r.motivo, r.decidida_em, v.enviada_em,
       encode(sha256(convert_to('indicamais:autor:' || r.autor_id::text, 'UTF8')), 'hex') as autor_ref,
       p.slug, p.publicado, (p.versao_aprovada_id = v.id) as versao_vigente
from public.perfis_perfil_versao v
join public.perfis_perfil p on p.id = v.perfil_id
left join public.perfis_revisao r on r.versao_id = v.id
where p.responsavel_id = (select auth.uid()) and v.situacao <> 'rascunho'
union all
select 'item'::text, v.item_id, v.id, v.situacao, v.nome,
       r.motivo, r.decidida_em, v.enviada_em,
       encode(sha256(convert_to('indicamais:autor:' || r.autor_id::text, 'UTF8')), 'hex'),
       null::text, i.publicado, (i.versao_aprovada_id = v.id)
from public.catalogo_item_versao v
join public.catalogo_item i on i.id = v.item_id
left join public.catalogo_item_revisao r on r.versao_id = v.id
where i.conta_id = (select auth.uid()) and v.situacao <> 'rascunho' and i.excluido_em is null;

create or replace view public.administracao_fila_pendencias as
select 'perfil'::text as alvo_tipo, v.id as versao_id, v.perfil_id as alvo_id, v.nome, v.enviada_em,
       p.responsavel_id as dono_id, (p.versao_aprovada_id is not null) as eh_edicao
from public.perfis_perfil_versao v join public.perfis_perfil p on p.id = v.perfil_id
where v.situacao = 'pendente' and (select public.administracao_permitido('aprovar'))
union all
select 'item'::text, v.id, v.item_id, v.nome, v.enviada_em, i.conta_id, (i.versao_aprovada_id is not null)
from public.catalogo_item_versao v join public.catalogo_item i on i.id = v.item_id
where v.situacao = 'pendente' and i.excluido_em is null and (select public.administracao_permitido('aprovar'));

-- 4. Histórico das ações do dono (só inserção) -----------------------------------------------------------------------------
create table public.catalogo_item_ciclo (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.catalogo_item (id) on delete restrict,
  conta_id uuid not null references public.contas_conta (id) on delete restrict,
  acao text not null,
  autor_id uuid not null references public.contas_conta (id) on delete restrict,
  motivo text,
  valor_anterior jsonb not null,
  criado_em timestamptz not null default now(),
  constraint catalogo_item_ciclo_acao check (acao in ('despublicar', 'republicar', 'excluir')),
  constraint catalogo_item_ciclo_motivo check (motivo is null or char_length(motivo) <= 500)
);
create unique index catalogo_item_ciclo_uma_exclusao on public.catalogo_item_ciclo (item_id) where acao = 'excluir';
create index catalogo_item_ciclo_item_idx on public.catalogo_item_ciclo (item_id, criado_em desc);
create index catalogo_item_ciclo_conta_idx on public.catalogo_item_ciclo (conta_id, criado_em desc);

revoke all on public.catalogo_item_ciclo from anon, authenticated;
-- autor_id e conta_id fora do SELECT de qualquer cliente (padrão de catalogo_item_revisao). A leitura é por política.
grant select (id, item_id, acao, motivo, valor_anterior, criado_em) on public.catalogo_item_ciclo to authenticated;

alter table public.catalogo_item_ciclo enable row level security;
alter table public.catalogo_item_ciclo force row level security;

create policy catalogo_item_ciclo_select_proprio on public.catalogo_item_ciclo
  for select to authenticated using (conta_id = (select auth.uid()));
create policy catalogo_item_ciclo_select_admin on public.catalogo_item_ciclo
  for select to authenticated using ((select public.administracao_eh_admin()));
create policy catalogo_item_ciclo_insert_negado on public.catalogo_item_ciclo
  for insert to authenticated with check (false);
create policy catalogo_item_ciclo_update_negado on public.catalogo_item_ciclo
  for update to authenticated using (false) with check (false);
create policy catalogo_item_ciclo_delete_negado on public.catalogo_item_ciclo
  for delete to authenticated using (false);

create trigger catalogo_item_ciclo_imutavel before update or delete on public.catalogo_item_ciclo
  for each row execute function public.administracao_registro_imutavel();

-- 5. Funções do dono ---------------------------------------------------------------------------------------------------
create function public.catalogo_despublicar_item(p_item_id uuid, p_motivo text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_item public.catalogo_item%rowtype;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
begin
  if v_uid is null then
    raise exception 'não autenticado' using errcode = '42501';
  end if;
  if v_motivo is not null and char_length(v_motivo) > 500 then
    raise exception 'motivo longo demais' using errcode = '22023';
  end if;
  select * into v_item from public.catalogo_item i
   where i.id = p_item_id and i.conta_id = v_uid and i.excluido_em is null
   for update;
  if not found then
    raise exception 'item não encontrado' using errcode = 'P0002';
  end if;
  if not v_item.publicado then
    return; -- idempotente: já está despublicado
  end if;
  update public.catalogo_item set publicado = false where id = v_item.id;
  insert into public.catalogo_item_ciclo (item_id, conta_id, acao, autor_id, motivo, valor_anterior)
  values (v_item.id, v_item.conta_id, 'despublicar', v_uid, v_motivo,
          jsonb_build_object('publicado', true, 'versao_aprovada_id', v_item.versao_aprovada_id));
end $$;

create function public.catalogo_republicar_item(p_item_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_item public.catalogo_item%rowtype;
begin
  if v_uid is null then
    raise exception 'não autenticado' using errcode = '42501';
  end if;
  select * into v_item from public.catalogo_item i
   where i.id = p_item_id and i.conta_id = v_uid and i.excluido_em is null
   for update;
  if not found then
    raise exception 'item não encontrado' using errcode = 'P0002';
  end if;
  if v_item.publicado then
    return; -- idempotente: já está no ar
  end if;
  if not public.contas_pode_publicar(v_uid) then
    raise exception 'esta conta não pode publicar no momento' using errcode = '42501';
  end if;
  -- Sem aprovação não há o que republicar: a publicação nunca contorna a moderação (IM-021, IM-022).
  if v_item.versao_aprovada_id is null then
    raise exception 'item sem versão aprovada' using errcode = 'P0001';
  end if;
  -- Republicar não cria item: não consome vaga do teto (o item já conta, publicado ou não).
  update public.catalogo_item set publicado = true where id = v_item.id;
  insert into public.catalogo_item_ciclo (item_id, conta_id, acao, autor_id, motivo, valor_anterior)
  values (v_item.id, v_item.conta_id, 'republicar', v_uid, null,
          jsonb_build_object('publicado', false, 'versao_aprovada_id', v_item.versao_aprovada_id));
end $$;

create function public.catalogo_excluir_item(p_item_id uuid, p_motivo text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_item public.catalogo_item%rowtype;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_pend record;
begin
  if v_uid is null then
    raise exception 'não autenticado' using errcode = '42501';
  end if;
  if v_motivo is not null and char_length(v_motivo) > 500 then
    raise exception 'motivo longo demais' using errcode = '22023';
  end if;
  select * into v_item from public.catalogo_item i
   where i.id = p_item_id and i.conta_id = v_uid
   for update;
  if not found then
    raise exception 'item não encontrado' using errcode = 'P0002';
  end if;
  if v_item.excluido_em is not null then
    return; -- idempotente: já excluído, nenhum evento novo
  end if;
  if not public.contas_pode_publicar(v_uid) then
    raise exception 'esta conta não pode excluir itens no momento' using errcode = '42501';
  end if;
  -- Versão pendente de item excluído não fica na fila para sempre: é rejeitada pelo próprio dono, com motivo fixo e auditoria
  -- (valor anterior = situação pendente). Tem de vir ANTES de marcar a exclusão (o gatilho veda mexer em versão de item excluído).
  for v_pend in
    select v.id, v.enviada_em from public.catalogo_item_versao v
    where v.item_id = v_item.id and v.situacao = 'pendente' for update
  loop
    insert into public.catalogo_item_revisao (item_id, versao_id, decisao, motivo, autor_id, versao_aprovada_anterior_id)
    values (v_item.id, v_pend.id, 'rejeitada', 'item excluído', v_uid, v_item.versao_aprovada_id);
    update public.catalogo_item_versao set situacao = 'rejeitada' where id = v_pend.id;
    insert into public.administracao_auditoria (autor_id, acao, alvo_tabela, alvo_id, motivo, valor_anterior, valor_novo)
    values (v_uid, 'cancelar_versao_item_excluido', 'catalogo_item_versao', v_pend.id::text, 'item excluído',
            jsonb_build_object('situacao', 'pendente', 'item_id', v_item.id, 'enviada_em', v_pend.enviada_em),
            jsonb_build_object('situacao', 'rejeitada', 'item_id', v_item.id));
  end loop;
  update public.catalogo_item
     set publicado = false, excluido_em = now(), excluido_por = v_uid, excluido_motivo = v_motivo
   where id = v_item.id;
  insert into public.catalogo_item_ciclo (item_id, conta_id, acao, autor_id, motivo, valor_anterior)
  values (v_item.id, v_item.conta_id, 'excluir', v_uid, v_motivo,
          jsonb_build_object('publicado', v_item.publicado, 'versao_aprovada_id', v_item.versao_aprovada_id));
end $$;

revoke all on function public.catalogo_despublicar_item(uuid, text) from public, anon;
revoke all on function public.catalogo_republicar_item(uuid) from public, anon;
revoke all on function public.catalogo_excluir_item(uuid, text) from public, anon;
grant execute on function public.catalogo_despublicar_item(uuid, text) to authenticated;
grant execute on function public.catalogo_republicar_item(uuid) to authenticated;
grant execute on function public.catalogo_excluir_item(uuid, text) to authenticated;

-- 2 (novos itens). catalogo_criar_item: localização própria obrigatória -----------------------------------------------------
-- Mesma assinatura da 20261109110000 (grants preservados). Mudanças: (a) cidade e UF vão para o item; (b) item de perfil sem
-- cidade/UF herda a do perfil (sem localização no perfil, item de site não imóvel nasce sem e a exige no envio); (c) particular e imóvel continuam gravando também na versão o que foi informado (aprovação por versão, D-008; imóvel tem localização própria desde a Loja); (d) a
-- checagem de localização vem DEPOIS do INSERT do item, para que perfil alheio continue falhando com 23503 como antes.
create or replace function public.catalogo_criar_item(
  p_tipo text,
  p_perfil_id uuid default null,
  p_nome text default null,
  p_descricao text default null,
  p_categoria_principal_id uuid default null,
  p_categoria_secundaria_1_id uuid default null,
  p_categoria_secundaria_2_id uuid default null,
  p_preco_modo text default null,
  p_preco_centavos bigint default null,
  p_cidade text default null,
  p_uf text default null
) returns table (o_item_id uuid, o_versao_id uuid)
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_item uuid;
  v_versao uuid;
  v_cidade_in text := nullif(btrim(p_cidade), '');
  v_uf_in text := nullif(upper(btrim(p_uf)), '');
  v_cidade text := v_cidade_in;
  v_uf text := v_uf_in;
begin
  if v_uid is null then
    raise exception 'não autenticado' using errcode = '42501';
  end if;
  if (v_cidade is null) <> (v_uf is null) then
    raise exception 'informe cidade e UF juntas' using errcode = '23514';
  end if;
  perform public.contas_exigir_teto_criacao(v_uid, case when p_perfil_id is null then 'anuncio' else 'item_perfil' end, p_perfil_id);

  -- Padrão do site (só do próprio perfil; perfil alheio cai no 23503 do INSERT abaixo).
  if v_cidade is null and p_perfil_id is not null then
    select btrim(pv.cidade), pv.uf into v_cidade, v_uf
    from public.perfis_perfil_versao pv
    join public.perfis_perfil p on p.id = pv.perfil_id
    where p.id = p_perfil_id and p.responsavel_id = v_uid
      and pv.cidade is not null and pv.uf is not null and char_length(btrim(pv.cidade)) between 2 and 80
    order by (pv.id = p.versao_aprovada_id) desc, pv.criado_em desc, pv.id desc
    limit 1;
  end if;

  insert into public.catalogo_item (conta_id, perfil_id, tipo, cidade, uf)
  values (v_uid, p_perfil_id, p_tipo, v_cidade, v_uf)
  returning id into v_item;

  -- Anúncio particular e imóvel exigem localização na criação. Item de site (não imóvel) pode ficar sem no rascunho: o
  -- envio (catalogo_enviar_item_versao) herda a do site ou falha com 'localizacao_obrigatoria'.
  if (p_perfil_id is null or p_tipo = 'imovel') and (v_cidade is null or v_uf is null) then
    raise exception 'cidade e UF do item são obrigatórias' using errcode = '23514';
  end if;

  insert into public.catalogo_item_versao (item_id, nome, descricao, categoria_principal_id,
    categoria_secundaria_1_id, categoria_secundaria_2_id, preco_modo, preco_centavos, cidade, uf)
  values (v_item, p_nome, p_descricao, p_categoria_principal_id, p_categoria_secundaria_1_id,
    p_categoria_secundaria_2_id, p_preco_modo, p_preco_centavos,
    case when p_perfil_id is null or p_tipo = 'imovel' then v_cidade_in end,
    case when p_perfil_id is null or p_tipo = 'imovel' then v_uf_in end)
  returning id into v_versao;
  o_item_id := v_item;
  o_versao_id := v_versao;
  return next;
end $$;

-- Envio: item de site sem localização herda a do site ou não segue (P0001 'localizacao_obrigatoria') ---------------------------
-- Mesma assinatura e grants da 20261103140000; acrescenta a localização própria do item (D-040). Item que já tem cidade/UF não muda.
create or replace function public.catalogo_enviar_item_versao(p_versao_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_v public.catalogo_item_versao%rowtype;
  v_perfil uuid;
  v_tipo text;
  v_item_cidade text;
  v_cidade text;
  v_uf text;
begin
  if v_uid is null then
    raise exception 'não autenticado' using errcode = '42501';
  end if;
  select v.* into v_v
  from public.catalogo_item_versao v join public.catalogo_item i on i.id = v.item_id
  where v.id = p_versao_id and i.conta_id = v_uid and i.excluido_em is null
  for update of v;
  if not found then
    raise exception 'versão não encontrada' using errcode = '42501';
  end if;
  if v_v.situacao <> 'rascunho' then
    raise exception 'só rascunho pode ser enviado' using errcode = 'P0001';
  end if;
  select i.perfil_id, i.tipo, i.cidade into v_perfil, v_tipo, v_item_cidade
  from public.catalogo_item i where i.id = v_v.item_id for update;
  if v_perfil is null and (v_v.cidade is null or v_v.uf is null) then
    raise exception 'anúncio particular exige cidade e UF' using errcode = '23514';
  end if;
  if v_tipo = 'imovel' and (v_v.imovel_tipo is null or v_v.finalidade is null or v_v.preco_modo is null
      or v_v.area_m2 is null or v_v.quartos is null or v_v.banheiros is null or v_v.vagas is null
      or v_v.bairro is null or v_v.cidade is null or v_v.uf is null) then
    raise exception 'imóvel exige tipo, finalidade, preço, área, quartos, banheiros, vagas, bairro, cidade e UF' using errcode = '23514';
  end if;
  if v_item_cidade is null then
    if v_perfil is null or v_tipo = 'imovel' then
      -- particular e imóvel: a localização está na própria versão (checada acima)
      v_cidade := btrim(v_v.cidade);
      v_uf := v_v.uf;
    else
      select btrim(pv.cidade), pv.uf into v_cidade, v_uf
      from public.perfis_perfil_versao pv
      join public.perfis_perfil p on p.id = pv.perfil_id
      where p.id = v_perfil
        and pv.cidade is not null and pv.uf is not null and char_length(btrim(pv.cidade)) between 2 and 80
      order by (pv.id = p.versao_aprovada_id) desc, pv.criado_em desc, pv.id desc
      limit 1;
      if v_cidade is null then
        raise exception 'localizacao_obrigatoria' using errcode = 'P0001';
      end if;
    end if;
    if v_cidade is not null and char_length(v_cidade) between 2 and 80 then
      update public.catalogo_item set cidade = v_cidade, uf = v_uf where id = v_v.item_id;
    end if;
  end if;
  update public.catalogo_item_versao set situacao = 'pendente', enviada_em = now() where id = p_versao_id;
end $$;

-- 6. Teto: a exclusão libera a vaga ------------------------------------------------------------------------------------------
-- Mesma definição da 20261109110000; só acrescenta `i.excluido_em is null` nas contagens de itens.
create or replace function public.contas_exigir_teto_criacao(p_conta uuid, p_tipo text, p_perfil_id uuid default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_chave text;
  v_lim integer;
  v_usado integer;
  v_lim_rasc integer;
begin
  if p_conta is null or p_tipo is null or p_tipo not in ('perfil', 'item_perfil', 'anuncio') then
    raise exception 'teto de criação: conta e tipo válidos são obrigatórios' using errcode = '22023';
  end if;
  if p_tipo = 'item_perfil' and p_perfil_id is null then
    raise exception 'teto de criação: perfil obrigatório para item de perfil' using errcode = '22023';
  end if;
  if exists (select 1 from public.administracao_administrador a where a.conta_id = p_conta) then
    return;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('contas_criacao:' || p_conta::text, 0));

  if p_tipo = 'perfil' then
    v_chave := 'tetos_perfis_por_conta';
    v_lim := public.contas_parametro_valor(v_chave);
    select count(*)::integer into v_usado from (
      select 1 from public.perfis_perfil p where p.responsavel_id = p_conta limit v_lim) s;
  elsif p_tipo = 'item_perfil' then
    v_chave := 'tetos_itens_por_perfil';
    v_lim := public.contas_parametro_valor(v_chave);
    select count(*)::integer into v_usado from (
      select 1 from public.catalogo_item i
      where i.perfil_id = p_perfil_id and i.conta_id = p_conta and i.excluido_em is null limit v_lim) s;
  else
    v_chave := 'tetos_anuncios_particulares';
    v_lim := public.contas_parametro_valor(v_chave);
    select count(*)::integer into v_usado from (
      select 1 from public.catalogo_item i
      where i.conta_id = p_conta and i.perfil_id is null and i.excluido_em is null limit v_lim) s;
  end if;
  if v_usado >= v_lim then
    raise exception 'teto_atingido:%', v_chave using errcode = 'P0430', detail = 'limite=' || v_lim, hint = v_chave;
  end if;

  v_chave := 'tetos_rascunhos_abertos';
  v_lim_rasc := public.contas_parametro_valor(v_chave);
  select count(*)::integer into v_usado from (
    select 1 from public.perfis_perfil p
    where p.responsavel_id = p_conta
      and not exists (select 1 from public.perfis_perfil_versao v where v.perfil_id = p.id and v.situacao <> 'rascunho')
    union all
    select 1 from public.catalogo_item i
    where i.conta_id = p_conta and i.excluido_em is null
      and not exists (select 1 from public.catalogo_item_versao v where v.item_id = i.id and v.situacao <> 'rascunho')
    limit v_lim_rasc) s;
  if v_usado >= v_lim_rasc then
    raise exception 'teto_atingido:%', v_chave using errcode = 'P0430', detail = 'limite=' || v_lim_rasc, hint = v_chave;
  end if;
end $$;
