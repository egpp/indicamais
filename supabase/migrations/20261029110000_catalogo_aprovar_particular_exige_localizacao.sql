-- Fase 2C · aprovação de anúncio particular exige cidade e UF · IM-015, IM-019, IM-086 (D-008)
-- Recria catalogo_decidir_item_versao (create or replace; assinatura e grants iguais) acrescentando: aprovar versão de
-- anúncio particular (item sem perfil) sem cidade ou sem UF falha com 23514 e mensagem fixa, antes de gravar revisão
-- ou auditoria (a função inteira é uma transação). Rejeitar continua permitido (com motivo). Item de perfil não muda.
-- Resolve a dúvida registrada em 20261029100000 sobre anúncios legados pendentes sem localização.

create or replace function public.catalogo_decidir_item_versao(p_versao_id uuid, p_aprovar boolean, p_motivo text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := public.administracao_exigir_admin();
  v_item uuid;
  v_dono uuid;
  v_sit text;
  v_anterior uuid;
  v_motivo text;
  v_perfil uuid;
  v_cidade text;
  v_uf text;
begin
  select v.item_id, i.conta_id, v.situacao, i.versao_aprovada_id, i.perfil_id, v.cidade, v.uf
    into v_item, v_dono, v_sit, v_anterior, v_perfil, v_cidade, v_uf
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
  -- D-008: anúncio particular (sem perfil) não é aprovado sem cidade e UF (IM-015, IM-019). Rejeitar segue permitido.
  if p_aprovar and v_perfil is null
     and (v_cidade is null or btrim(v_cidade) = '' or v_uf is null or btrim(v_uf) = '') then
    raise exception 'anúncio particular exige cidade e UF para ser aprovado' using errcode = '23514';
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

revoke all on function public.catalogo_decidir_item_versao(uuid, boolean, text) from public, anon;
grant execute on function public.catalogo_decidir_item_versao(uuid, boolean, text) to authenticated;
