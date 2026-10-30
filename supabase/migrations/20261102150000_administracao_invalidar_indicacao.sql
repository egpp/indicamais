-- Fase 6 · módulo administracao · invalidar indicação · IM-077, IM-035, IM-078, IM-086, D-014
--
-- Invalidar uma indicação (pedido de contato atribuído a um indicador) exige a permissão invalidar_indicacoes. O fluxo:
--   1. se o pedido gerou crédito de pontos ainda não revertido, REVERTE pelo mesmo caminho já existente
--      (pontos_reverter_credito, categoria fixa 'indicacao_invalida', lançamento novo que aponta o original, IM-078);
--      quem só tem invalidar_indicacoes não precisa da permissão reverter_pontos para isso: a autorização vem desta função
--      (delegação interna, ver migração de permissões);
--   2. marca a indicação como invalidada em administracao_invalidacao_indicacao (só inserção, uma por pedido);
--   3. grava auditoria (autor, motivo, valor anterior) na mesma transação.
-- A base de relacionamento, o pedido e o contato do visitante NÃO são alterados (pedido é só de inserção). O indicador vê
-- apenas a reversão com a categoria 'indicacao_invalida' (D-012); nunca o motivo interno.
-- Idempotente: repetir a chamada devolve a reversão já feita, sem lançamento nem auditoria novos.
--
-- CÓDIGOS DE ERRO: 42501 sem permissão / participante da própria indicação; 22023 motivo obrigatório; P0002 pedido
-- inexistente; P0410 a reversão deixaria o saldo negativo (repetir com confirmação, vem de pontos_reverter_credito).

create table public.administracao_invalidacao_indicacao (
  id bigint generated always as identity primary key,
  pedido_id uuid not null references public.indicacoes_pedido_contato (id) on delete restrict,
  motivo text not null,
  autor_id uuid not null references public.contas_conta (id) on delete restrict,
  reversao_id uuid references public.pontos_lancamento (id) on delete restrict,
  criado_em timestamptz not null default now(),
  constraint administracao_invalidacao_pedido_unico unique (pedido_id),
  constraint administracao_invalidacao_motivo check (char_length(btrim(motivo)) between 1 and 500)
);
comment on table public.administracao_invalidacao_indicacao is 'Indicações invalidadas (IM-077). Só inserção. A reversão de pontos, se houve, é o lançamento apontado por reversao_id.';

revoke all on public.administracao_invalidacao_indicacao from anon, authenticated;
alter table public.administracao_invalidacao_indicacao enable row level security;
alter table public.administracao_invalidacao_indicacao force row level security;

create policy administracao_invalidacao_select_analista on public.administracao_invalidacao_indicacao
  for select to authenticated using ((select public.administracao_permitido('invalidar_indicacoes')));
create policy administracao_invalidacao_insert_negado on public.administracao_invalidacao_indicacao
  for insert to authenticated with check (false);
create policy administracao_invalidacao_update_negado on public.administracao_invalidacao_indicacao
  for update to authenticated using (false) with check (false);
create policy administracao_invalidacao_delete_negado on public.administracao_invalidacao_indicacao
  for delete to authenticated using (false);

create trigger administracao_invalidacao_imutavel before update or delete on public.administracao_invalidacao_indicacao
  for each row execute function public.administracao_registro_imutavel();

create function public.administracao_invalidar_indicacao(
  p_pedido_id uuid,
  p_motivo text,
  p_confirmar_saldo_negativo boolean default false
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := public.administracao_exigir_permissao('invalidar_indicacoes');
  v_motivo text := nullif(left(btrim(coalesce(p_motivo, '')), 500), '');
  v_pedido public.indicacoes_pedido_contato%rowtype;
  v_indicador uuid;
  v_dono uuid;
  v_credito uuid;
  v_rev uuid;
  v_ja boolean;
begin
  if v_motivo is null then
    raise exception 'motivo obrigatório' using errcode = '22023';
  end if;
  select * into v_pedido from public.indicacoes_pedido_contato where id = p_pedido_id;
  if not found then
    raise exception 'indicação não encontrada' using errcode = 'P0002';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('invalidar_indicacao:' || p_pedido_id::text, 0));

  select true, i.reversao_id into v_ja, v_rev from public.administracao_invalidacao_indicacao i where i.pedido_id = p_pedido_id;
  if coalesce(v_ja, false) then
    return v_rev;
  end if;

  -- Ninguém invalida indicação da qual participa (indicador, responsável pelo destino ou solicitante logado).
  select l.indicador_id into v_indicador from public.indicacoes_link l where l.id = v_pedido.link_id;
  if v_pedido.perfil_id is not null then
    select p.responsavel_id into v_dono from public.perfis_perfil p where p.id = v_pedido.perfil_id;
  else
    select i.conta_id into v_dono from public.catalogo_item i where i.id = v_pedido.item_id;
  end if;
  if coalesce(v_admin = v_indicador, false) or coalesce(v_admin = v_dono, false) or coalesce(v_admin = v_pedido.solicitante_id, false) then
    raise exception 'não é possível invalidar indicação em que a própria conta participa' using errcode = '42501';
  end if;

  v_rev := null;
  select l.id into v_credito from public.pontos_lancamento l where l.pedido_id = p_pedido_id and l.tipo = 'credito';
  if v_credito is not null then
    select r.id into v_rev from public.pontos_lancamento r where r.original_id = v_credito;
    if v_rev is null then
      perform set_config('indicamais.permissao_delegada', 'reverter_pontos', true);
      v_rev := public.pontos_reverter_credito(v_credito, 'indicacao_invalida', v_motivo, coalesce(p_confirmar_saldo_negativo, false));
      perform set_config('indicamais.permissao_delegada', '', true);
    end if;
  end if;

  insert into public.administracao_invalidacao_indicacao (pedido_id, motivo, autor_id, reversao_id)
  values (p_pedido_id, v_motivo, v_admin, v_rev);
  insert into public.administracao_auditoria (autor_id, acao, alvo_tabela, alvo_id, motivo, valor_anterior, valor_novo)
  values (v_admin, 'invalidar_indicacao', 'indicacoes_pedido_contato', p_pedido_id::text, v_motivo,
          jsonb_build_object('situacao', 'valida', 'credito_id', v_credito),
          jsonb_build_object('situacao', 'invalidada', 'reversao_id', v_rev));
  return v_rev;
end $$;
revoke all on function public.administracao_invalidar_indicacao(uuid, text, boolean) from public, anon;
grant execute on function public.administracao_invalidar_indicacao(uuid, text, boolean) to authenticated;

-- Indicações invalidadas, para quem tem a permissão. Sem id de conta, sem dado do visitante.
create view public.administracao_indicacoes_invalidadas as
select i.pedido_id,
       i.motivo,
       (i.reversao_id is not null) as tem_reversao,
       encode(sha256(convert_to('indicamais:admin:' || i.autor_id::text, 'UTF8')), 'hex') as autor_ref,
       i.criado_em
from public.administracao_invalidacao_indicacao i
where (select public.administracao_permitido('invalidar_indicacoes'));
revoke all on public.administracao_indicacoes_invalidadas from anon, authenticated;
grant select on public.administracao_indicacoes_invalidadas to authenticated;
