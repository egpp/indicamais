-- Fase 2A · módulo catalogo · produtos, serviços e anúncios particulares · IM-014, IM-015, IM-016, IM-017,
-- IM-021, IM-022, IM-023, IM-079, IM-086
--
-- Mesmo desenho de versões do perfil (ver cabeçalho de 20261024120000_perfis_perfil_versoes.sql):
--   catalogo_item         identidade + publicado (liga/desliga do dono) + versao_aprovada_id (versão no ar)
--   catalogo_item_versao  conteúdo: rascunho -> pendente -> aprovada | rejeitada; imutável depois de enviada
--   catalogo_item_revisao decisão de revisão, só inserção
-- Item de perfil comercial: perfil_id preenchido e conta_id = responsável do perfil (FK composta garante).
-- Anúncio particular (IM-015): perfil_id nulo, vinculado só à conta.
-- Item público = item.publicado E versão aprovada E (anúncio particular OU perfil disponível, IM-079).
-- Serviço não tem estoque: não existe coluna de estoque. Preço opcional em centavos de BRL.

create table public.catalogo_item (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references public.contas_conta (id) on delete restrict,
  perfil_id uuid,
  tipo text not null,
  publicado boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint catalogo_item_tipo check (tipo in ('produto', 'servico')),
  -- Item de perfil só existe para perfil da mesma conta.
  constraint catalogo_item_perfil_da_conta_fk foreign key (perfil_id, conta_id)
    references public.perfis_perfil (id, responsavel_id) on delete restrict
);
create index catalogo_item_conta_idx on public.catalogo_item (conta_id);
create index catalogo_item_perfil_idx on public.catalogo_item (perfil_id) where perfil_id is not null;

create table public.catalogo_item_versao (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.catalogo_item (id) on delete restrict,
  situacao text not null default 'rascunho',
  nome text,
  descricao text,
  foto_path text,
  categoria_principal_id uuid references public.catalogo_categoria (id) on delete restrict,
  categoria_secundaria_1_id uuid references public.catalogo_categoria (id) on delete restrict,
  categoria_secundaria_2_id uuid references public.catalogo_categoria (id) on delete restrict,
  preco_modo text,
  preco_centavos bigint,
  criado_em timestamptz not null default now(),
  enviada_em timestamptz,
  constraint catalogo_item_versao_id_item_unico unique (id, item_id),
  constraint catalogo_item_versao_situacao check (situacao in ('rascunho', 'pendente', 'aprovada', 'rejeitada')),
  constraint catalogo_item_versao_enviada_coerente check ((situacao = 'rascunho') = (enviada_em is null)),
  constraint catalogo_item_versao_nome check (nome is null or char_length(btrim(nome)) between 1 and 100),
  constraint catalogo_item_versao_descricao check (descricao is null or char_length(btrim(descricao)) between 1 and 1500),
  constraint catalogo_item_versao_categorias check (
    (categoria_secundaria_2_id is null or categoria_secundaria_1_id is not null)
    and (categoria_secundaria_1_id is null or categoria_principal_id is not null)
    and (categoria_secundaria_1_id is null or categoria_secundaria_1_id <> categoria_principal_id)
    and (categoria_secundaria_2_id is null or categoria_secundaria_2_id <> categoria_principal_id)
    and (categoria_secundaria_2_id is null or categoria_secundaria_2_id <> categoria_secundaria_1_id)),
  -- Preço opcional: sem modo, sem valor. Sob consulta, sem valor. Fixo e a partir de: valor de R$ 0,01 a R$ 1.000.000,00.
  constraint catalogo_item_versao_preco check (
    (preco_modo is null and preco_centavos is null)
    or (preco_modo = 'sob_consulta' and preco_centavos is null)
    or (preco_modo in ('fixo', 'a_partir_de') and preco_centavos is not null and preco_centavos between 1 and 100000000)),
  constraint catalogo_item_versao_completa check (
    situacao = 'rascunho'
    or (nome is not null and descricao is not null and foto_path is not null and categoria_principal_id is not null))
);
create unique index catalogo_item_versao_uma_aberta on public.catalogo_item_versao (item_id) where situacao in ('rascunho', 'pendente');
create index catalogo_item_versao_pendentes_idx on public.catalogo_item_versao (enviada_em) where situacao = 'pendente';
create index catalogo_item_versao_item_idx on public.catalogo_item_versao (item_id, criado_em desc);

alter table public.catalogo_item add column versao_aprovada_id uuid;
alter table public.catalogo_item
  add constraint catalogo_item_versao_aprovada_fk foreign key (versao_aprovada_id, id)
  references public.catalogo_item_versao (id, item_id) on delete restrict;
alter table public.catalogo_item
  add constraint catalogo_item_publicado_exige_aprovada check (publicado = false or versao_aprovada_id is not null);

create table public.catalogo_item_revisao (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.catalogo_item (id) on delete restrict,
  versao_id uuid not null references public.catalogo_item_versao (id) on delete restrict,
  decisao text not null,
  motivo text,
  autor_id uuid not null references public.contas_conta (id) on delete restrict,
  decidida_em timestamptz not null default now(),
  versao_aprovada_anterior_id uuid references public.catalogo_item_versao (id) on delete restrict,
  constraint catalogo_item_revisao_versao_unica unique (versao_id),
  constraint catalogo_item_revisao_decisao check (decisao in ('aprovada', 'rejeitada')),
  constraint catalogo_item_revisao_motivo check (
    (motivo is null or char_length(motivo) <= 500)
    and (decisao = 'aprovada' or (motivo is not null and char_length(btrim(motivo)) > 0)))
);
create index catalogo_item_revisao_item_idx on public.catalogo_item_revisao (item_id, decidida_em desc);

-- Privilégios ----------------------------------------------------------------------------------------------
revoke all on public.catalogo_item from anon, authenticated;
revoke all on public.catalogo_item_versao from anon, authenticated;
revoke all on public.catalogo_item_revisao from anon, authenticated;

-- Anônimo não lê conta_id.
grant select (id, perfil_id, tipo, publicado, versao_aprovada_id, criado_em) on public.catalogo_item to anon;
grant select on public.catalogo_item to authenticated;
grant insert (conta_id, perfil_id, tipo) on public.catalogo_item to authenticated;
grant update (publicado) on public.catalogo_item to authenticated;

grant select on public.catalogo_item_versao to anon, authenticated;
grant insert (item_id, nome, descricao, foto_path, categoria_principal_id, categoria_secundaria_1_id,
  categoria_secundaria_2_id, preco_modo, preco_centavos) on public.catalogo_item_versao to authenticated;
grant update (nome, descricao, foto_path, categoria_principal_id, categoria_secundaria_1_id,
  categoria_secundaria_2_id, preco_modo, preco_centavos) on public.catalogo_item_versao to authenticated;
grant delete on public.catalogo_item_versao to authenticated;

grant select on public.catalogo_item_revisao to authenticated;

alter table public.catalogo_item enable row level security;
alter table public.catalogo_item force row level security;
alter table public.catalogo_item_versao enable row level security;
alter table public.catalogo_item_versao force row level security;
alter table public.catalogo_item_revisao enable row level security;
alter table public.catalogo_item_revisao force row level security;

-- Políticas: catalogo_item ---------------------------------------------------------------------------------
create policy catalogo_item_select_publico on public.catalogo_item
  for select to anon, authenticated using (
    publicado and versao_aprovada_id is not null
    and (perfil_id is null or public.perfis_perfil_disponivel(perfil_id)));
create policy catalogo_item_select_proprio on public.catalogo_item
  for select to authenticated using (conta_id = (select auth.uid()));
create policy catalogo_item_select_admin on public.catalogo_item
  for select to authenticated using ((select public.administracao_eh_admin()));
create policy catalogo_item_insert_proprio on public.catalogo_item
  for insert to authenticated with check (conta_id = (select auth.uid()));
create policy catalogo_item_update_proprio on public.catalogo_item
  for update to authenticated
  using (conta_id = (select auth.uid())) with check (conta_id = (select auth.uid()));
create policy catalogo_item_delete_negado on public.catalogo_item
  for delete to authenticated using (false);

-- Políticas: catalogo_item_versao --------------------------------------------------------------------------
create policy catalogo_item_versao_select_publica on public.catalogo_item_versao
  for select to anon, authenticated using (
    situacao = 'aprovada' and exists (
      select 1 from public.catalogo_item i
      where i.id = item_id and i.versao_aprovada_id = catalogo_item_versao.id and i.publicado
        and (i.perfil_id is null or public.perfis_perfil_disponivel(i.perfil_id))));
create policy catalogo_item_versao_select_propria on public.catalogo_item_versao
  for select to authenticated using (exists (
    select 1 from public.catalogo_item i where i.id = item_id and i.conta_id = (select auth.uid())));
create policy catalogo_item_versao_select_admin on public.catalogo_item_versao
  for select to authenticated using ((select public.administracao_eh_admin()));
create policy catalogo_item_versao_insert_propria on public.catalogo_item_versao
  for insert to authenticated with check (exists (
    select 1 from public.catalogo_item i where i.id = item_id and i.conta_id = (select auth.uid())));
create policy catalogo_item_versao_update_propria on public.catalogo_item_versao
  for update to authenticated
  using (situacao = 'rascunho' and exists (
    select 1 from public.catalogo_item i where i.id = item_id and i.conta_id = (select auth.uid())))
  with check (exists (
    select 1 from public.catalogo_item i where i.id = item_id and i.conta_id = (select auth.uid())));
create policy catalogo_item_versao_delete_propria on public.catalogo_item_versao
  for delete to authenticated using (situacao = 'rascunho' and exists (
    select 1 from public.catalogo_item i where i.id = item_id and i.conta_id = (select auth.uid())));

-- Políticas: catalogo_item_revisao -------------------------------------------------------------------------
create policy catalogo_item_revisao_select_propria on public.catalogo_item_revisao
  for select to authenticated using (exists (
    select 1 from public.catalogo_item i where i.id = item_id and i.conta_id = (select auth.uid())));
create policy catalogo_item_revisao_select_admin on public.catalogo_item_revisao
  for select to authenticated using ((select public.administracao_eh_admin()));
create policy catalogo_item_revisao_insert_negado on public.catalogo_item_revisao
  for insert to authenticated with check (false);
create policy catalogo_item_revisao_update_negado on public.catalogo_item_revisao
  for update to authenticated using (false) with check (false);
create policy catalogo_item_revisao_delete_negado on public.catalogo_item_revisao
  for delete to authenticated using (false);

-- Gatilhos -------------------------------------------------------------------------------------------------
create trigger catalogo_item_tocar before update on public.catalogo_item
  for each row execute function public.catalogo_tocar_atualizado_em();

create function public.catalogo_item_proteger() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.id <> old.id or new.conta_id <> old.conta_id or new.perfil_id is distinct from old.perfil_id
     or new.tipo <> old.tipo then
    raise exception 'dono, perfil e tipo do item são imutáveis' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function public.catalogo_item_proteger() from public, anon, authenticated;
create trigger catalogo_item_proteger before update on public.catalogo_item
  for each row execute function public.catalogo_item_proteger();

create trigger catalogo_item_versao_proteger before update or delete on public.catalogo_item_versao
  for each row execute function public.catalogo_versao_proteger('item_id');

create function public.catalogo_item_versao_validar() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_dono uuid;
  v_cat uuid;
begin
  if new.situacao not in ('rascunho', 'pendente') then
    return new;
  end if;
  select conta_id into v_dono from public.catalogo_item where id = new.item_id;
  foreach v_cat in array array[new.categoria_principal_id, new.categoria_secundaria_1_id, new.categoria_secundaria_2_id] loop
    if v_cat is not null and not exists (select 1 from public.catalogo_categoria where id = v_cat and ativa) then
      raise exception 'categoria inexistente ou inativa' using errcode = '23514';
    end if;
  end loop;
  if new.foto_path is not null and new.foto_path !~ ('^' || v_dono::text || '/[A-Za-z0-9._-]{1,100}$') then
    raise exception 'caminho de imagem fora da pasta do responsável' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function public.catalogo_item_versao_validar() from public, anon, authenticated;
create trigger catalogo_item_versao_validar before insert or update on public.catalogo_item_versao
  for each row execute function public.catalogo_item_versao_validar();

create trigger catalogo_item_revisao_imutavel before update or delete on public.catalogo_item_revisao
  for each row execute function public.administracao_registro_imutavel();

-- Funções do ciclo -----------------------------------------------------------------------------------------
create function public.catalogo_enviar_item_versao(p_versao_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_sit text;
begin
  if v_uid is null then
    raise exception 'não autenticado' using errcode = '42501';
  end if;
  select v.situacao into v_sit
  from public.catalogo_item_versao v join public.catalogo_item i on i.id = v.item_id
  where v.id = p_versao_id and i.conta_id = v_uid
  for update of v;
  if not found then
    raise exception 'versão não encontrada' using errcode = '42501';
  end if;
  if v_sit <> 'rascunho' then
    raise exception 'só rascunho pode ser enviado' using errcode = 'P0001';
  end if;
  update public.catalogo_item_versao set situacao = 'pendente', enviada_em = now() where id = p_versao_id;
end $$;

create function public.catalogo_decidir_item_versao(p_versao_id uuid, p_aprovar boolean, p_motivo text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := public.administracao_exigir_admin();
  v_item uuid;
  v_dono uuid;
  v_sit text;
  v_anterior uuid;
begin
  select v.item_id, i.conta_id, v.situacao, i.versao_aprovada_id
    into v_item, v_dono, v_sit, v_anterior
  from public.catalogo_item_versao v join public.catalogo_item i on i.id = v.item_id
  where v.id = p_versao_id
  for update of v, i;
  if not found then
    raise exception 'versão não encontrada' using errcode = 'P0002';
  end if;
  if v_dono = v_admin then
    raise exception 'o responsável não decide o próprio conteúdo' using errcode = '42501';
  end if;
  if v_sit <> 'pendente' then
    raise exception 'só versão pendente pode ser decidida' using errcode = 'P0001';
  end if;
  if not p_aprovar and (p_motivo is null or btrim(p_motivo) = '') then
    raise exception 'motivo obrigatório na rejeição' using errcode = '22023';
  end if;
  insert into public.catalogo_item_revisao (item_id, versao_id, decisao, motivo, autor_id, versao_aprovada_anterior_id)
  values (v_item, p_versao_id, case when p_aprovar then 'aprovada' else 'rejeitada' end,
          nullif(left(btrim(coalesce(p_motivo, '')), 500), ''), v_admin, v_anterior);
  update public.catalogo_item_versao
     set situacao = case when p_aprovar then 'aprovada' else 'rejeitada' end
   where id = p_versao_id;
  if p_aprovar then
    update public.catalogo_item set versao_aprovada_id = p_versao_id where id = v_item;
  end if;
end $$;

revoke all on function public.catalogo_enviar_item_versao(uuid) from public, anon;
revoke all on function public.catalogo_decidir_item_versao(uuid, boolean, text) from public, anon;
grant execute on function public.catalogo_enviar_item_versao(uuid) to authenticated;
grant execute on function public.catalogo_decidir_item_versao(uuid, boolean, text) to authenticated;

-- Visão pública: aprovado E publicado E (particular ou perfil disponível). Sem conta_id.
create view public.catalogo_item_publico with (security_invoker = true) as
select i.id, i.perfil_id, i.tipo, v.nome, v.descricao, v.foto_path,
       v.categoria_principal_id, v.categoria_secundaria_1_id, v.categoria_secundaria_2_id,
       v.preco_modo, v.preco_centavos, i.criado_em
from public.catalogo_item i
join public.catalogo_item_versao v on v.id = i.versao_aprovada_id and v.situacao = 'aprovada'
where i.publicado and (i.perfil_id is null or public.perfis_perfil_disponivel(i.perfil_id));
revoke all on public.catalogo_item_publico from anon, authenticated;
grant select on public.catalogo_item_publico to anon, authenticated;

-- Fila de pendências do administrador (IM-023). Só retorna linhas para administradores.
create view public.administracao_fila_pendencias with (security_invoker = true) as
select 'perfil'::text as alvo_tipo, v.id as versao_id, v.perfil_id as alvo_id, v.nome, v.enviada_em,
       p.responsavel_id as dono_id, (p.versao_aprovada_id is not null) as eh_edicao
from public.perfis_perfil_versao v join public.perfis_perfil p on p.id = v.perfil_id
where v.situacao = 'pendente' and public.administracao_eh_admin()
union all
select 'item'::text, v.id, v.item_id, v.nome, v.enviada_em, i.conta_id, (i.versao_aprovada_id is not null)
from public.catalogo_item_versao v join public.catalogo_item i on i.id = v.item_id
where v.situacao = 'pendente' and public.administracao_eh_admin();
revoke all on public.administracao_fila_pendencias from anon, authenticated;
grant select on public.administracao_fila_pendencias to authenticated;
