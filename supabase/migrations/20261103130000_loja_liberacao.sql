-- Fase 10 · módulo loja · liberação da Loja por perfil · IM-097, IM-099, IM-014, IM-086 (D-020)
--
-- O QUE É
--   A Loja é a evolução do catálogo de produtos e serviços (IM-014), sem segundo cadastro. Enquanto não existem planos
--   (IM-060 é futuro), o ADMINISTRADOR GERAL libera ou retira a Loja por perfil, só para testes: sem plano, sem cobrança.
--   Quando os planos existirem, o plano passa a controlar esta liberação (IM-099); nada de plano é implementado aqui.
--
-- MODELO
--   loja_liberacao (perfil_id PK, liberada, atualizado_em). Padrão DESLIGADA: perfil sem linha equivale a liberada = false.
--   A tabela guarda só o ESTADO atual; o histórico (quem, quando, motivo, valor anterior) fica em administracao_auditoria
--   (só inserção), gravada na MESMA transação da mudança.
--   Escrita só por loja_definir_liberacao() (administrador geral, motivo obrigatório). Sem INSERT/UPDATE/DELETE direto.
--
-- LEITURA (RLS forçada, uma política por finalidade)
--   * dono do perfil: lê a linha do PRÓPRIO perfil (perfis_eh_dono) e assim sabe se tem a Loja; a tabela não tem conta_id;
--   * administrador: lê todas;
--   * público (anon e authenticated): só linhas liberadas de perfil disponível (publicado, aprovado, conta ativa: IM-079).
--     É o que as visões públicas da Loja usam para decidir se mostram os itens; não revela nada que a página não revele.
--
-- CÓDIGOS DE ERRO (SQLSTATE): 42501 não é administrador geral; 22023 motivo obrigatório ou valor nulo; P0002 perfil inexistente.
-- Liberar o que já está liberado (ou retirar o que já está retirado) é idempotente: nada muda e não grava auditoria nova.

create table public.loja_liberacao (
  perfil_id uuid primary key references public.perfis_perfil (id) on delete restrict,
  liberada boolean not null default false,
  atualizado_em timestamptz not null default now()
);
comment on table public.loja_liberacao is
  'Liberação manual da Loja por perfil (D-020, IM-099). Padrão desligada. Escrita só por loja_definir_liberacao (auditada).';

revoke all on public.loja_liberacao from anon, authenticated;
grant select (perfil_id, liberada, atualizado_em) on public.loja_liberacao to anon, authenticated;

alter table public.loja_liberacao enable row level security;
alter table public.loja_liberacao force row level security;

create policy loja_liberacao_select_publica on public.loja_liberacao
  for select to anon, authenticated using (liberada and public.perfis_perfil_disponivel(perfil_id));
create policy loja_liberacao_select_dono on public.loja_liberacao
  for select to authenticated using ((select public.perfis_eh_dono(perfil_id)));
create policy loja_liberacao_select_admin on public.loja_liberacao
  for select to authenticated using ((select public.administracao_eh_admin()));
create policy loja_liberacao_insert_negado on public.loja_liberacao
  for insert to authenticated with check (false);
create policy loja_liberacao_update_negado on public.loja_liberacao
  for update to authenticated using (false) with check (false);
create policy loja_liberacao_delete_negado on public.loja_liberacao
  for delete to authenticated using (false);

-- O perfil tem a Loja liberada? Uso INTERNO (gatilhos e funções definer). Sem EXECUTE para nenhum papel de cliente.
create function public.loja_ativa(p_perfil_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_perfil_id is not null and exists (
    select 1 from public.loja_liberacao l where l.perfil_id = p_perfil_id and l.liberada);
$$;
revoke all on function public.loja_ativa(uuid) from public, anon, authenticated;

-- Libera ou retira a Loja de um perfil. Somente administrador geral. Motivo obrigatório. Auditoria na mesma transação.
create function public.loja_definir_liberacao(p_perfil_id uuid, p_liberada boolean, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := public.administracao_exigir_admin();
  v_motivo text := nullif(left(btrim(coalesce(p_motivo, '')), 500), '');
  v_ant boolean;
begin
  if p_liberada is null then
    raise exception 'informe se a Loja deve ser liberada ou retirada' using errcode = '22023';
  end if;
  if v_motivo is null then
    raise exception 'motivo obrigatório' using errcode = '22023';
  end if;
  if p_perfil_id is null or not exists (select 1 from public.perfis_perfil where id = p_perfil_id) then
    raise exception 'perfil não encontrado' using errcode = 'P0002';
  end if;
  -- Linha nasce desligada (padrão); travada para serializar duas decisões simultâneas sobre o mesmo perfil.
  insert into public.loja_liberacao (perfil_id) values (p_perfil_id) on conflict (perfil_id) do nothing;
  select l.liberada into v_ant from public.loja_liberacao l where l.perfil_id = p_perfil_id for update;
  if v_ant = p_liberada then
    return;
  end if;
  update public.loja_liberacao set liberada = p_liberada, atualizado_em = now() where perfil_id = p_perfil_id;
  insert into public.administracao_auditoria (autor_id, acao, alvo_tabela, alvo_id, motivo, valor_anterior, valor_novo)
  values (v_admin, case when p_liberada then 'liberar_loja' else 'retirar_loja' end, 'loja_liberacao', p_perfil_id::text, v_motivo,
          jsonb_build_object('liberada', v_ant), jsonb_build_object('liberada', p_liberada));
end $$;
revoke all on function public.loja_definir_liberacao(uuid, boolean, text) from public, anon;
grant execute on function public.loja_definir_liberacao(uuid, boolean, text) to authenticated;
