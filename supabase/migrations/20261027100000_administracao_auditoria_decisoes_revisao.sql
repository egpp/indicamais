-- Auditoria das decisões de revisão (D-007; IM-021, IM-023, IM-086).
-- Aprovar ou rejeitar versão de perfil ou de item passa a gravar também uma linha em administracao_auditoria,
-- na MESMA transação da decisão: se a auditoria falhar, a decisão inteira é desfeita.
-- Regras preservadas das migrações 20261024120000 e 20261024130000 (não editadas): somente administrador,
-- o dono nunca decide o próprio conteúdo, só versão pendente, motivo obrigatório na rejeição, aprovar só move
-- o ponteiro versao_aprovada_id (nunca altera publicado), SECURITY DEFINER, search_path vazio, mesmos grants.
-- A auditoria guarda o autor real (autor_id); o cliente não lê essa tabela. Sem e-mail, WhatsApp ou dados pessoais:
-- só ids, situações e o motivo.

create or replace function public.perfis_decidir_versao(p_versao_id uuid, p_aprovar boolean, p_motivo text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := public.administracao_exigir_admin();
  v_perfil uuid;
  v_dono uuid;
  v_sit text;
  v_anterior uuid;
  v_motivo text;
begin
  select v.perfil_id, p.responsavel_id, v.situacao, p.versao_aprovada_id
    into v_perfil, v_dono, v_sit, v_anterior
  from public.perfis_perfil_versao v join public.perfis_perfil p on p.id = v.perfil_id
  where v.id = p_versao_id
  for update of v, p;
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
  v_motivo := nullif(left(btrim(coalesce(p_motivo, '')), 500), '');
  insert into public.perfis_revisao (perfil_id, versao_id, decisao, motivo, autor_id, versao_aprovada_anterior_id)
  values (v_perfil, p_versao_id, case when p_aprovar then 'aprovada' else 'rejeitada' end,
          v_motivo, v_admin, v_anterior);
  update public.perfis_perfil_versao
     set situacao = case when p_aprovar then 'aprovada' else 'rejeitada' end
   where id = p_versao_id;
  if p_aprovar then
    update public.perfis_perfil set versao_aprovada_id = p_versao_id where id = v_perfil;
  end if;
  insert into public.administracao_auditoria (autor_id, acao, alvo_tabela, alvo_id, motivo, valor_anterior, valor_novo)
  values (v_admin,
          case when p_aprovar then 'aprovar_versao' else 'rejeitar_versao' end,
          'perfis_perfil_versao', p_versao_id::text, v_motivo,
          jsonb_build_object('situacao', v_sit, 'perfil_id', v_perfil, 'versao_aprovada_anterior_id', v_anterior),
          jsonb_build_object('situacao', case when p_aprovar then 'aprovada' else 'rejeitada' end,
                             'perfil_id', v_perfil,
                             'versao_aprovada_id', case when p_aprovar then p_versao_id else v_anterior end));
end $$;

create or replace function public.catalogo_decidir_item_versao(p_versao_id uuid, p_aprovar boolean, p_motivo text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := public.administracao_exigir_admin();
  v_item uuid;
  v_dono uuid;
  v_sit text;
  v_anterior uuid;
  v_motivo text;
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
  v_motivo := nullif(left(btrim(coalesce(p_motivo, '')), 500), '');
  insert into public.catalogo_item_revisao (item_id, versao_id, decisao, motivo, autor_id, versao_aprovada_anterior_id)
  values (v_item, p_versao_id, case when p_aprovar then 'aprovada' else 'rejeitada' end,
          v_motivo, v_admin, v_anterior);
  update public.catalogo_item_versao
     set situacao = case when p_aprovar then 'aprovada' else 'rejeitada' end
   where id = p_versao_id;
  if p_aprovar then
    update public.catalogo_item set versao_aprovada_id = p_versao_id where id = v_item;
  end if;
  insert into public.administracao_auditoria (autor_id, acao, alvo_tabela, alvo_id, motivo, valor_anterior, valor_novo)
  values (v_admin,
          case when p_aprovar then 'aprovar_versao' else 'rejeitar_versao' end,
          'catalogo_item_versao', p_versao_id::text, v_motivo,
          jsonb_build_object('situacao', v_sit, 'item_id', v_item, 'versao_aprovada_anterior_id', v_anterior),
          jsonb_build_object('situacao', case when p_aprovar then 'aprovada' else 'rejeitada' end,
                             'item_id', v_item,
                             'versao_aprovada_id', case when p_aprovar then p_versao_id else v_anterior end));
end $$;

-- Mesmos grants das migrações originais (create or replace preserva, reafirmado por segurança).
revoke all on function public.perfis_decidir_versao(uuid, boolean, text) from public, anon;
revoke all on function public.catalogo_decidir_item_versao(uuid, boolean, text) from public, anon;
grant execute on function public.perfis_decidir_versao(uuid, boolean, text) to authenticated;
grant execute on function public.catalogo_decidir_item_versao(uuid, boolean, text) to authenticated;
