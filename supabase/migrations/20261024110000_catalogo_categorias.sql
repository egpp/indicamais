-- Fase 2A · módulo catalogo · categorias e solicitações · IM-016, IM-086
-- Categorias: leitura pública só das ativas; escrita só por funções administrativas (com auditoria e motivo).
-- "Principal + até 2 secundárias" é imposto pela ESTRUTURA das versões (três colunas com FK, ver migrações
-- de perfis e itens): não existe uma terceira coluna secundária, então uma 4ª categoria é impossível.

create table public.catalogo_categoria (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text not null,
  ativa boolean not null default true,
  ordem integer not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint catalogo_categoria_nome_tamanho check (char_length(btrim(nome)) between 2 and 60),
  constraint catalogo_categoria_slug_formato check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 2 and 60),
  constraint catalogo_categoria_slug_unico unique (slug),
  constraint catalogo_categoria_ordem_faixa check (ordem between -1000 and 100000)
);
create unique index catalogo_categoria_nome_unico on public.catalogo_categoria (lower(btrim(nome)));
create index catalogo_categoria_ativa_ordem_idx on public.catalogo_categoria (ordem, nome) where ativa;

create table public.catalogo_categoria_solicitacao (
  id uuid primary key default gen_random_uuid(),
  solicitante_id uuid not null references public.contas_conta (id) on delete restrict,
  nome_sugerido text not null,
  justificativa text,
  situacao text not null default 'pendente',
  categoria_id uuid references public.catalogo_categoria (id) on delete restrict,
  motivo_resposta text,
  decidida_por uuid references public.contas_conta (id) on delete restrict,
  decidida_em timestamptz,
  criado_em timestamptz not null default now(),
  constraint catalogo_solicitacao_nome_tamanho check (char_length(btrim(nome_sugerido)) between 2 and 60),
  constraint catalogo_solicitacao_justificativa_tamanho check (justificativa is null or char_length(justificativa) <= 300),
  constraint catalogo_solicitacao_situacao check (situacao in ('pendente', 'atendida', 'recusada')),
  constraint catalogo_solicitacao_motivo_tamanho check (motivo_resposta is null or char_length(motivo_resposta) <= 500),
  constraint catalogo_solicitacao_coerencia check (
    (situacao = 'pendente' and categoria_id is null and decidida_por is null and decidida_em is null and motivo_resposta is null)
    or (situacao = 'atendida' and categoria_id is not null and decidida_por is not null and decidida_em is not null)
    or (situacao = 'recusada' and categoria_id is null and decidida_por is not null and decidida_em is not null
        and motivo_resposta is not null and char_length(btrim(motivo_resposta)) > 0)
  )
);
create index catalogo_solicitacao_solicitante_idx on public.catalogo_categoria_solicitacao (solicitante_id, criado_em desc);
create index catalogo_solicitacao_pendentes_idx on public.catalogo_categoria_solicitacao (criado_em) where situacao = 'pendente';

revoke all on public.catalogo_categoria from anon, authenticated;
revoke all on public.catalogo_categoria_solicitacao from anon, authenticated;
grant select on public.catalogo_categoria to anon, authenticated;
grant select on public.catalogo_categoria_solicitacao to authenticated;
-- O responsável só informa o pedido; situação e resposta ficam fora.
grant insert (solicitante_id, nome_sugerido, justificativa) on public.catalogo_categoria_solicitacao to authenticated;

alter table public.catalogo_categoria enable row level security;
alter table public.catalogo_categoria force row level security;
alter table public.catalogo_categoria_solicitacao enable row level security;
alter table public.catalogo_categoria_solicitacao force row level security;

-- catalogo_categoria: anônimo e usuário veem só as ativas; administrador vê todas; ninguém escreve pelo cliente.
create policy catalogo_categoria_select_publica on public.catalogo_categoria
  for select to anon using (ativa);
create policy catalogo_categoria_select_autenticado on public.catalogo_categoria
  for select to authenticated using (ativa or (select public.administracao_eh_admin()));
create policy catalogo_categoria_insert_negado on public.catalogo_categoria
  for insert to anon, authenticated with check (false);
create policy catalogo_categoria_update_negado on public.catalogo_categoria
  for update to anon, authenticated using (false) with check (false);
create policy catalogo_categoria_delete_negado on public.catalogo_categoria
  for delete to anon, authenticated using (false);

-- catalogo_categoria_solicitacao: o solicitante vê e cria as próprias; administrador vê todas; decisão só por função.
create policy catalogo_solicitacao_select_propria on public.catalogo_categoria_solicitacao
  for select to authenticated using (solicitante_id = (select auth.uid()));
create policy catalogo_solicitacao_select_admin on public.catalogo_categoria_solicitacao
  for select to authenticated using ((select public.administracao_eh_admin()));
create policy catalogo_solicitacao_insert_propria on public.catalogo_categoria_solicitacao
  for insert to authenticated with check (solicitante_id = (select auth.uid()));
create policy catalogo_solicitacao_update_negado on public.catalogo_categoria_solicitacao
  for update to authenticated using (false) with check (false);
create policy catalogo_solicitacao_delete_negado on public.catalogo_categoria_solicitacao
  for delete to authenticated using (false);

-- Atualiza atualizado_em (reutilizada por perfis e itens).
create function public.catalogo_tocar_atualizado_em() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.atualizado_em := now();
  return new;
end $$;
revoke all on function public.catalogo_tocar_atualizado_em() from public, anon, authenticated;
create trigger catalogo_categoria_tocar before update on public.catalogo_categoria
  for each row execute function public.catalogo_tocar_atualizado_em();

-- No máximo 5 pedidos pendentes por conta (evita abuso).
create function public.catalogo_solicitacao_limitar() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.catalogo_categoria_solicitacao
      where solicitante_id = new.solicitante_id and situacao = 'pendente') >= 5 then
    raise exception 'limite de 5 pedidos pendentes de categoria' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke all on function public.catalogo_solicitacao_limitar() from public, anon, authenticated;
create trigger catalogo_solicitacao_limitar before insert on public.catalogo_categoria_solicitacao
  for each row execute function public.catalogo_solicitacao_limitar();

-- Pedido decidido não muda mais (nem para service_role): só pendente -> atendida/recusada, uma vez.
create function public.catalogo_solicitacao_proteger() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'pedido de categoria não pode ser apagado' using errcode = '42501';
  end if;
  if old.situacao <> 'pendente'
     or new.id <> old.id or new.solicitante_id <> old.solicitante_id
     or new.nome_sugerido <> old.nome_sugerido or new.justificativa is distinct from old.justificativa
     or new.criado_em <> old.criado_em then
    raise exception 'pedido de categoria já decidido ou campo imutável' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function public.catalogo_solicitacao_proteger() from public, anon, authenticated;
create trigger catalogo_solicitacao_proteger before update or delete on public.catalogo_categoria_solicitacao
  for each row execute function public.catalogo_solicitacao_proteger();

-- Funções administrativas (todas gravam auditoria).
create function public.catalogo_criar_categoria(p_nome text, p_slug text, p_ordem integer default 0)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_autor uuid := public.administracao_exigir_admin();
  v_id uuid;
begin
  insert into public.catalogo_categoria (nome, slug, ordem)
  values (btrim(p_nome), p_slug, coalesce(p_ordem, 0))
  returning id into v_id;
  insert into public.administracao_auditoria (autor_id, acao, alvo_tabela, alvo_id, valor_novo)
  select v_autor, 'categoria_criada', 'catalogo_categoria', v_id::text, to_jsonb(c)
  from public.catalogo_categoria c where c.id = v_id;
  return v_id;
end $$;

create function public.catalogo_alterar_categoria(p_id uuid, p_nome text, p_ativa boolean, p_ordem integer, p_motivo text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_autor uuid := public.administracao_exigir_admin();
  v_antes public.catalogo_categoria;
begin
  if p_motivo is null or btrim(p_motivo) = '' then
    raise exception 'motivo obrigatório' using errcode = '22023';
  end if;
  select * into v_antes from public.catalogo_categoria where id = p_id for update;
  if not found then
    raise exception 'categoria não encontrada' using errcode = 'P0002';
  end if;
  update public.catalogo_categoria
     set nome = btrim(p_nome), ativa = p_ativa, ordem = p_ordem
   where id = p_id;
  insert into public.administracao_auditoria (autor_id, acao, alvo_tabela, alvo_id, motivo, valor_anterior, valor_novo)
  select v_autor, 'categoria_alterada', 'catalogo_categoria', p_id::text, left(btrim(p_motivo), 500),
         to_jsonb(v_antes), to_jsonb(c)
  from public.catalogo_categoria c where c.id = p_id;
end $$;

create function public.catalogo_decidir_solicitacao(p_id uuid, p_atendida boolean, p_motivo text, p_categoria_id uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_autor uuid := public.administracao_exigir_admin();
  v_antes public.catalogo_categoria_solicitacao;
begin
  select * into v_antes from public.catalogo_categoria_solicitacao where id = p_id for update;
  if not found then
    raise exception 'pedido não encontrado' using errcode = 'P0002';
  end if;
  if v_antes.situacao <> 'pendente' then
    raise exception 'pedido já decidido' using errcode = 'P0001';
  end if;
  if p_atendida then
    if p_categoria_id is null then
      raise exception 'informe a categoria criada para atender o pedido' using errcode = '22023';
    end if;
    update public.catalogo_categoria_solicitacao
       set situacao = 'atendida', categoria_id = p_categoria_id, motivo_resposta = nullif(btrim(p_motivo), ''),
           decidida_por = v_autor, decidida_em = now()
     where id = p_id;
  else
    if p_motivo is null or btrim(p_motivo) = '' then
      raise exception 'motivo obrigatório para recusar' using errcode = '22023';
    end if;
    update public.catalogo_categoria_solicitacao
       set situacao = 'recusada', motivo_resposta = left(btrim(p_motivo), 500),
           decidida_por = v_autor, decidida_em = now()
     where id = p_id;
  end if;
  insert into public.administracao_auditoria (autor_id, acao, alvo_tabela, alvo_id, motivo, valor_anterior, valor_novo)
  select v_autor, case when p_atendida then 'solicitacao_atendida' else 'solicitacao_recusada' end,
         'catalogo_categoria_solicitacao', p_id::text, nullif(left(btrim(coalesce(p_motivo, '')), 500), ''),
         to_jsonb(v_antes), to_jsonb(s)
  from public.catalogo_categoria_solicitacao s where s.id = p_id;
end $$;

revoke all on function public.catalogo_criar_categoria(text, text, integer) from public, anon;
revoke all on function public.catalogo_alterar_categoria(uuid, text, boolean, integer, text) from public, anon;
revoke all on function public.catalogo_decidir_solicitacao(uuid, boolean, text, uuid) from public, anon;
grant execute on function public.catalogo_criar_categoria(text, text, integer) to authenticated;
grant execute on function public.catalogo_alterar_categoria(uuid, text, boolean, integer, text) to authenticated;
grant execute on function public.catalogo_decidir_solicitacao(uuid, boolean, text, uuid) to authenticated;
