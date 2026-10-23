-- Fase 2A · módulo administracao (mínimo provisório) · IM-077 (antecipa parte), IM-023, IM-086
-- Decisão provisória do gestor: a administração completa é a Fase 6. Aqui só existem:
--   * a lista de administradores, que NINGUÉM altera pelo cliente (só service_role/migração/SQL manual);
--   * administracao_eh_admin() para as políticas e funções dos outros módulos;
--   * a trilha de auditoria geral (só inserção) usada pelas ações administrativas.
-- Nenhuma conta é criada como administradora aqui: o Emerson será inserido manualmente depois, com
--   insert into public.administracao_administrador (conta_id) values ('<uuid da conta>');
-- executado como superusuário/service_role.

create table public.administracao_administrador (
  conta_id uuid primary key references public.contas_conta (id) on delete restrict,
  criado_em timestamptz not null default now()
);
comment on table public.administracao_administrador is 'Administradores. Escrita só por service_role/SQL manual: não há política de escrita para o cliente.';

create table public.administracao_auditoria (
  id bigint generated always as identity primary key,
  autor_id uuid not null references public.contas_conta (id) on delete restrict,
  acao text not null check (char_length(acao) between 1 and 60),
  alvo_tabela text not null check (char_length(alvo_tabela) between 1 and 80),
  alvo_id text not null check (char_length(alvo_id) between 1 and 80),
  motivo text check (motivo is null or char_length(motivo) <= 500),
  valor_anterior jsonb,
  valor_novo jsonb,
  criado_em timestamptz not null default now()
);
create index administracao_auditoria_alvo_idx on public.administracao_auditoria (alvo_tabela, alvo_id, criado_em desc);
comment on table public.administracao_auditoria is 'Auditoria de ações administrativas (IM-086): autor, data, motivo, valor anterior. Só inserção.';

revoke all on public.administracao_administrador from anon, authenticated;
revoke all on public.administracao_auditoria from anon, authenticated;
grant select on public.administracao_administrador to authenticated;
grant select on public.administracao_auditoria to authenticated;

alter table public.administracao_administrador enable row level security;
alter table public.administracao_administrador force row level security;
alter table public.administracao_auditoria enable row level security;
alter table public.administracao_auditoria force row level security;

-- Funções (criadas antes das políticas que as usam).
create function public.administracao_eh_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.administracao_administrador
    where conta_id = (select auth.uid())
  );
$$;
revoke all on function public.administracao_eh_admin() from public, anon;
grant execute on function public.administracao_eh_admin() to authenticated;

-- Uso interno das funções administrativas: devolve o id do admin ou recusa.
create function public.administracao_exigir_admin() returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null or not exists (
    select 1 from public.administracao_administrador where conta_id = v_uid
  ) then
    raise exception 'acesso restrito a administradores' using errcode = '42501';
  end if;
  return v_uid;
end $$;
revoke all on function public.administracao_exigir_admin() from public, anon, authenticated;

-- Tabelas só de inserção: vale para qualquer papel, inclusive service_role.
create function public.administracao_registro_imutavel() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception '% é só de inserção', tg_table_name using errcode = '42501';
end $$;
revoke all on function public.administracao_registro_imutavel() from public, anon, authenticated;

create trigger administracao_auditoria_imutavel
  before update or delete on public.administracao_auditoria
  for each row execute function public.administracao_registro_imutavel();

-- Políticas: administracao_administrador. Cada um lê só a própria linha; ninguém escreve pelo cliente.
create policy administracao_administrador_select_proprio on public.administracao_administrador
  for select to authenticated using (conta_id = (select auth.uid()));
create policy administracao_administrador_insert_negado on public.administracao_administrador
  for insert to authenticated with check (false);
create policy administracao_administrador_update_negado on public.administracao_administrador
  for update to authenticated using (false) with check (false);
create policy administracao_administrador_delete_negado on public.administracao_administrador
  for delete to authenticated using (false);

-- Políticas: administracao_auditoria. Só administradores leem; a escrita é feita por funções do banco.
create policy administracao_auditoria_select_admin on public.administracao_auditoria
  for select to authenticated using ((select public.administracao_eh_admin()));
create policy administracao_auditoria_insert_negado on public.administracao_auditoria
  for insert to authenticated with check (false);
create policy administracao_auditoria_update_negado on public.administracao_auditoria
  for update to authenticated using (false) with check (false);
create policy administracao_auditoria_delete_negado on public.administracao_auditoria
  for delete to authenticated using (false);
