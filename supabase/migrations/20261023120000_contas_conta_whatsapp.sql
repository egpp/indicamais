-- Fase 1 · módulo contas · IM-006, IM-007, IM-008, IM-009, IM-086
-- Conta do módulo contas, ligada a auth.users. Perfis comerciais (Fase 2) apontarão para contas_conta(id).
-- IM-010 (verificação por código) é futuro: whatsapp_verificado fica sempre false nesta fase.

create table public.contas_conta (
  id uuid primary key references auth.users (id) on delete restrict,
  nome_exibicao text,
  whatsapp_e164 text,
  whatsapp_verificado boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint contas_conta_whatsapp_formato check (whatsapp_e164 is null or whatsapp_e164 ~ '^\+55[0-9]{10,11}$'),
  constraint contas_conta_whatsapp_unico unique (whatsapp_e164),
  -- IM-009/IM-010: nenhum número é apresentado como verificado nesta fase.
  constraint contas_conta_whatsapp_nao_verificado_nesta_fase check (whatsapp_verificado = false),
  constraint contas_conta_nome_tamanho check (nome_exibicao is null or char_length(nome_exibicao) between 1 and 80)
);

comment on table public.contas_conta is 'Conta do usuário (módulo contas). 1:1 com auth.users.';
comment on column public.contas_conta.whatsapp_e164 is 'WhatsApp normalizado E.164 (+55). Nulo até o usuário informar; obrigatório antes de indicar (IM-009).';

-- Histórico de mudança de WhatsApp: só inserção.
create table public.contas_whatsapp_historico (
  id bigint generated always as identity primary key,
  conta_id uuid not null,
  whatsapp_anterior_e164 text,
  whatsapp_novo_e164 text,
  autor_id uuid,
  alterado_em timestamptz not null default now()
);
create index contas_whatsapp_historico_conta_idx on public.contas_whatsapp_historico (conta_id, alterado_em desc);

-- Permissões: nada por padrão; só o necessário.
revoke all on public.contas_conta from anon, authenticated;
revoke all on public.contas_whatsapp_historico from anon, authenticated;
grant select on public.contas_conta to authenticated;
-- Cliente só altera estas colunas; whatsapp_verificado, id e timestamps ficam fora.
grant update (nome_exibicao, whatsapp_e164) on public.contas_conta to authenticated;
grant select on public.contas_whatsapp_historico to authenticated;

alter table public.contas_conta enable row level security;
alter table public.contas_conta force row level security;
alter table public.contas_whatsapp_historico enable row level security;
alter table public.contas_whatsapp_historico force row level security;

-- contas_conta: só a própria conta.
create policy contas_conta_select_propria on public.contas_conta
  for select to authenticated using (id = (select auth.uid()));
-- A linha nasce pelo gatilho do Auth; o cliente não insere nem apaga.
create policy contas_conta_insert_negado on public.contas_conta
  for insert to authenticated with check (false);
create policy contas_conta_update_propria on public.contas_conta
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy contas_conta_delete_negado on public.contas_conta
  for delete to authenticated using (false);

-- contas_whatsapp_historico: o dono lê o próprio histórico; escrita só pelo gatilho.
create policy contas_whatsapp_historico_select_proprio on public.contas_whatsapp_historico
  for select to authenticated using (conta_id = (select auth.uid()));
create policy contas_whatsapp_historico_insert_negado on public.contas_whatsapp_historico
  for insert to authenticated with check (false);
create policy contas_whatsapp_historico_update_negado on public.contas_whatsapp_historico
  for update to authenticated using (false) with check (false);
create policy contas_whatsapp_historico_delete_negado on public.contas_whatsapp_historico
  for delete to authenticated using (false);

-- Histórico imutável, inclusive para service_role e donos.
create function public.contas_historico_imutavel() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'contas_whatsapp_historico é só de inserção' using errcode = '42501';
end $$;
create trigger contas_whatsapp_historico_imutavel
  before update or delete on public.contas_whatsapp_historico
  for each row execute function public.contas_historico_imutavel();

-- Atualiza atualizado_em.
create function public.contas_conta_antes_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.atualizado_em := now();
  return new;
end $$;
create trigger contas_conta_antes_update
  before update on public.contas_conta
  for each row execute function public.contas_conta_antes_update();

-- Registra mudança de WhatsApp (valor anterior, novo, autor, data).
create function public.contas_conta_registrar_whatsapp() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.contas_whatsapp_historico (conta_id, whatsapp_anterior_e164, whatsapp_novo_e164, autor_id)
  values (new.id, old.whatsapp_e164, new.whatsapp_e164, (select auth.uid()));
  return new;
end $$;
create trigger contas_conta_registrar_whatsapp
  after update of whatsapp_e164 on public.contas_conta
  for each row when (old.whatsapp_e164 is distinct from new.whatsapp_e164)
  execute function public.contas_conta_registrar_whatsapp();

-- Cria a conta quando o usuário se cadastra no Auth (e-mail/senha ou Google).
create function public.contas_criar_conta_do_auth() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.contas_conta (id, nome_exibicao)
  values (
    new.id,
    nullif(left(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')), 80), '')
  )
  on conflict (id) do nothing;
  return new;
end $$;
create trigger contas_criar_conta_do_auth
  after insert on auth.users
  for each row execute function public.contas_criar_conta_do_auth();

-- Usuários que já existam no Auth.
insert into public.contas_conta (id)
select id from auth.users on conflict (id) do nothing;

-- IM-009: "obrigatório antes de indicar". Usada pelas regras da Fase 3.
create function public.contas_pode_indicar() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.contas_conta
    where id = (select auth.uid()) and whatsapp_e164 is not null
  );
$$;

-- Funções de gatilho não são chamáveis pelo cliente.
revoke all on function public.contas_historico_imutavel() from public, anon, authenticated;
revoke all on function public.contas_conta_antes_update() from public, anon, authenticated;
revoke all on function public.contas_conta_registrar_whatsapp() from public, anon, authenticated;
revoke all on function public.contas_criar_conta_do_auth() from public, anon, authenticated;
revoke all on function public.contas_pode_indicar() from public, anon;
grant execute on function public.contas_pode_indicar() to authenticated;
