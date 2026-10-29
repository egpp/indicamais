-- Fase 3 · módulo indicacoes · leitura (visões), notificação ao responsável e ações administrativas ·
-- IM-027, IM-028, IM-029, IM-041, IM-050, IM-086
--
-- VISÕES SECURITY DEFINER (sem security_invoker, de propósito; o alerta 0010 do Security Advisor é esperado):
-- pedidos, links e notificações não têm privilégio de tabela para papel algum de API. Cada visão roda com os
-- direitos do dono e tem filtro FIXO por auth.uid() (responsável, indicador) ou administracao_eh_admin(), sem
-- parâmetro, sem acesso a anon e sem id de conta (responsavel_id, conta_id, indicador_id, solicitante_id nunca saem).
--   indicacoes_meus_pedidos       responsável: pedidos dos seus destinos, com dados do visitante (IM-027).
--   indicacoes_minhas_indicacoes  indicador: SÓ destino, data e status. Nenhum dado do visitante (IM-029).
--   indicacoes_meus_links         indicador: seus links e se o destino segue disponível.
--   administracao_fila_contatos   administrador: todos os pedidos + estado da notificação e alerta.
-- Notificações (IM-050): o e-mail ao responsável carrega só o nome público do destino; nunca nome, WhatsApp, e-mail
-- ou mensagem do visitante, nem dado do indicador. O envio é do servidor (provedor ainda indefinido); o banco guarda
-- o estado e expõe as funções abaixo.

create view public.indicacoes_meus_pedidos as
select p.id,
       case when p.perfil_id is not null then 'perfil' else 'item' end as destino_tipo,
       coalesce(p.perfil_id, p.item_id) as destino_id,
       coalesce(pv.nome, iv.nome) as destino_nome,
       p.nome,
       p.whatsapp_e164,
       p.email,
       p.mensagem,
       p.criado_em,
       (p.link_id is not null) as veio_por_indicacao,
       n.estado as notificacao_estado
from public.indicacoes_pedido_contato p
join public.indicacoes_notificacao n on n.pedido_id = p.id
left join public.perfis_perfil pf on pf.id = p.perfil_id
left join public.catalogo_item it on it.id = p.item_id
left join public.perfis_perfil_versao pv on pv.id = pf.versao_aprovada_id
left join public.catalogo_item_versao iv on iv.id = it.versao_aprovada_id
where pf.responsavel_id = (select auth.uid()) or it.conta_id = (select auth.uid());
revoke all on public.indicacoes_meus_pedidos from anon, authenticated;
grant select on public.indicacoes_meus_pedidos to authenticated;

create view public.indicacoes_minhas_indicacoes as
select p.id,
       case when p.perfil_id is not null then 'perfil' else 'item' end as destino_tipo,
       coalesce(p.perfil_id, p.item_id) as destino_id,
       coalesce(pv.nome, iv.nome) as destino_nome,
       p.criado_em,
       'recebido'::text as status
from public.indicacoes_pedido_contato p
join public.indicacoes_link l on l.id = p.link_id
left join public.perfis_perfil pf on pf.id = p.perfil_id
left join public.catalogo_item it on it.id = p.item_id
left join public.perfis_perfil_versao pv on pv.id = pf.versao_aprovada_id
left join public.catalogo_item_versao iv on iv.id = it.versao_aprovada_id
where l.indicador_id = (select auth.uid());
revoke all on public.indicacoes_minhas_indicacoes from anon, authenticated;
grant select on public.indicacoes_minhas_indicacoes to authenticated;

create view public.indicacoes_meus_links as
select l.id,
       l.codigo,
       case when l.perfil_id is not null then 'perfil' else 'item' end as destino_tipo,
       coalesce(l.perfil_id, l.item_id) as destino_id,
       coalesce(pv.nome, iv.nome) as destino_nome,
       coalesce(
         case when l.perfil_id is not null then public.perfis_perfil_disponivel(l.perfil_id)
              else (it.publicado and it.versao_aprovada_id is not null
                    and (it.perfil_id is null or public.perfis_perfil_disponivel(it.perfil_id))) end,
         false) as disponivel,
       l.criado_em
from public.indicacoes_link l
left join public.perfis_perfil pf on pf.id = l.perfil_id
left join public.catalogo_item it on it.id = l.item_id
left join public.perfis_perfil_versao pv on pv.id = pf.versao_aprovada_id
left join public.catalogo_item_versao iv on iv.id = it.versao_aprovada_id
where l.indicador_id = (select auth.uid());
revoke all on public.indicacoes_meus_links from anon, authenticated;
grant select on public.indicacoes_meus_links to authenticated;

-- Fila do administrador (mesmos campos do responsável + notificação). Alertas abertos: alerta_estado = 'aberto'.
create view public.administracao_fila_contatos as
select p.id,
       case when p.perfil_id is not null then 'perfil' else 'item' end as destino_tipo,
       coalesce(p.perfil_id, p.item_id) as destino_id,
       coalesce(pv.nome, iv.nome) as destino_nome,
       p.nome,
       p.whatsapp_e164,
       p.email,
       p.mensagem,
       p.criado_em,
       (p.link_id is not null) as veio_por_indicacao,
       p.autoindicacao_suspeita,
       n.estado as notificacao_estado,
       n.tentativas,
       n.ultima_tentativa_em,
       n.ultimo_erro,
       n.reenvio_solicitado_em,
       n.alerta_estado
from public.indicacoes_pedido_contato p
join public.indicacoes_notificacao n on n.pedido_id = p.id
left join public.perfis_perfil pf on pf.id = p.perfil_id
left join public.catalogo_item it on it.id = p.item_id
left join public.perfis_perfil_versao pv on pv.id = pf.versao_aprovada_id
left join public.catalogo_item_versao iv on iv.id = it.versao_aprovada_id
where public.administracao_eh_admin();
revoke all on public.administracao_fila_contatos from anon, authenticated;
grant select on public.administracao_fila_contatos to authenticated;

-- Servidor (service_role) --------------------------------------------------------------------------------------
-- Pedidos a notificar. Devolve o mínimo para montar o e-mail: e-mail do responsável (auth.users), tipo e nome público
-- do destino. Nada do visitante nem do indicador.
create function public.indicacoes_notificacoes_pendentes(p_limite integer default 20)
returns table (o_pedido_id uuid, o_email_responsavel text, o_destino_tipo text, o_destino_nome text, o_tentativas integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  return query
  select n.pedido_id,
         u.email::text,
         case when p.perfil_id is not null then 'perfil' else 'item' end,
         coalesce(pv.nome, iv.nome),
         n.tentativas
  from public.indicacoes_notificacao n
  join public.indicacoes_pedido_contato p on p.id = n.pedido_id
  left join public.perfis_perfil pf on pf.id = p.perfil_id
  left join public.catalogo_item it on it.id = p.item_id
  left join public.perfis_perfil_versao pv on pv.id = pf.versao_aprovada_id
  left join public.catalogo_item_versao iv on iv.id = it.versao_aprovada_id
  join auth.users u on u.id = coalesce(pf.responsavel_id, it.conta_id)
  where n.estado = 'pendente'
  order by n.atualizado_em, n.pedido_id
  limit least(greatest(coalesce(p_limite, 20), 1), 100);
end $$;

-- O servidor informa o resultado de uma tentativa. Idempotente para pedido já enviado. Falha abre o alerta
-- administrativo; sucesso fecha o alerta aberto. O pedido nunca é alterado nem apagado (IM-028).
-- p_erro: código curto do provedor; o servidor não deve colocar dados do visitante aqui.
create function public.indicacoes_notificacao_registrar(p_pedido_id uuid, p_sucesso boolean, p_erro text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_estado text;
begin
  if p_sucesso is null then
    raise exception 'informe o resultado' using errcode = '22023';
  end if;
  select n.estado into v_estado from public.indicacoes_notificacao n where n.pedido_id = p_pedido_id for update;
  if not found then
    raise exception 'pedido não encontrado' using errcode = 'P0002';
  end if;
  if v_estado = 'enviada' then
    return;
  end if;
  if p_sucesso then
    update public.indicacoes_notificacao
       set estado = 'enviada', tentativas = tentativas + 1, ultima_tentativa_em = now(), ultimo_erro = null,
           alerta_estado = case when alerta_estado = 'aberto' then 'tratado' else alerta_estado end
     where pedido_id = p_pedido_id;
    insert into public.indicacoes_notificacao_historico (pedido_id, evento, origem)
    values (p_pedido_id, 'tentativa_enviada', 'servidor');
  else
    update public.indicacoes_notificacao
       set estado = 'falhou', tentativas = tentativas + 1, ultima_tentativa_em = now(),
           ultimo_erro = left(coalesce(nullif(btrim(p_erro), ''), 'erro_desconhecido'), 200),
           alerta_estado = 'aberto'
     where pedido_id = p_pedido_id;
    insert into public.indicacoes_notificacao_historico (pedido_id, evento, origem, erro)
    values (p_pedido_id, 'tentativa_falhou', 'servidor', left(coalesce(nullif(btrim(p_erro), ''), 'erro_desconhecido'), 200));
  end if;
end $$;

revoke all on function public.indicacoes_notificacoes_pendentes(integer) from public, anon, authenticated;
revoke all on function public.indicacoes_notificacao_registrar(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.indicacoes_notificacoes_pendentes(integer) to service_role;
grant execute on function public.indicacoes_notificacao_registrar(uuid, boolean, text) to service_role;

-- Reenvio (responsável ou administrador) -----------------------------------------------------------------------
-- Responsável: só depois de falha. Administrador: forçado, em qualquer estado diferente de pendente, com motivo e
-- auditoria na mesma transação. Nunca cria outro pedido: só devolve a notificação para a fila (estado pendente).
create function public.indicacoes_solicitar_reenvio(p_pedido_id uuid, p_motivo text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_admin boolean := (select public.administracao_eh_admin());
  v_motivo text := nullif(left(btrim(coalesce(p_motivo, '')), 500), '');
  v_estado text;
  v_tentativas integer;
  v_alerta text;
begin
  if v_uid is null then
    raise exception 'não autenticado' using errcode = '42501';
  end if;
  if not v_admin and not public.indicacoes_eh_responsavel_do_pedido(p_pedido_id) then
    raise exception 'pedido não encontrado' using errcode = 'P0002';
  end if;
  select n.estado, n.tentativas, n.alerta_estado into v_estado, v_tentativas, v_alerta
  from public.indicacoes_notificacao n where n.pedido_id = p_pedido_id for update;
  if not found then
    raise exception 'pedido não encontrado' using errcode = 'P0002';
  end if;
  if v_estado = 'pendente' then
    raise exception 'a notificação já está na fila' using errcode = 'P0001';
  end if;
  if v_admin then
    if v_motivo is null then
      raise exception 'motivo obrigatório no reenvio forçado' using errcode = '22023';
    end if;
  elsif v_estado <> 'falhou' then
    raise exception 'reenvio só é possível depois de falha' using errcode = 'P0001';
  end if;

  update public.indicacoes_notificacao set estado = 'pendente', reenvio_solicitado_em = now() where pedido_id = p_pedido_id;
  insert into public.indicacoes_notificacao_historico (pedido_id, evento, origem)
  values (p_pedido_id, 'reenvio_solicitado', case when v_admin then 'admin' else 'responsavel' end);
  if v_admin then
    insert into public.administracao_auditoria (autor_id, acao, alvo_tabela, alvo_id, motivo, valor_anterior, valor_novo)
    values (v_uid, 'reenviar_notificacao_contato', 'indicacoes_pedido_contato', p_pedido_id::text, v_motivo,
            jsonb_build_object('estado', v_estado, 'tentativas', v_tentativas, 'alerta_estado', v_alerta),
            jsonb_build_object('estado', 'pendente', 'tentativas', v_tentativas, 'alerta_estado', v_alerta));
  end if;
end $$;

-- Administrador marca o alerta como tratado (motivo obrigatório; auditado).
create function public.indicacoes_tratar_alerta(p_pedido_id uuid, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := public.administracao_exigir_admin();
  v_motivo text := nullif(left(btrim(coalesce(p_motivo, '')), 500), '');
  v_estado text;
  v_alerta text;
begin
  if v_motivo is null then
    raise exception 'motivo obrigatório' using errcode = '22023';
  end if;
  select n.estado, n.alerta_estado into v_estado, v_alerta
  from public.indicacoes_notificacao n where n.pedido_id = p_pedido_id for update;
  if not found then
    raise exception 'pedido não encontrado' using errcode = 'P0002';
  end if;
  if v_alerta <> 'aberto' then
    raise exception 'não há alerta aberto' using errcode = 'P0001';
  end if;
  update public.indicacoes_notificacao set alerta_estado = 'tratado' where pedido_id = p_pedido_id;
  insert into public.indicacoes_notificacao_historico (pedido_id, evento, origem)
  values (p_pedido_id, 'alerta_tratado', 'admin');
  insert into public.administracao_auditoria (autor_id, acao, alvo_tabela, alvo_id, motivo, valor_anterior, valor_novo)
  values (v_admin, 'tratar_alerta_contato', 'indicacoes_pedido_contato', p_pedido_id::text, v_motivo,
          jsonb_build_object('estado', v_estado, 'alerta_estado', v_alerta),
          jsonb_build_object('estado', v_estado, 'alerta_estado', 'tratado'));
end $$;

-- Administrador altera um parâmetro central (motivo obrigatório; auditado com o valor anterior).
create function public.indicacoes_definir_parametro(p_chave text, p_valor integer, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := public.administracao_exigir_admin();
  v_motivo text := nullif(left(btrim(coalesce(p_motivo, '')), 500), '');
  v_anterior integer;
begin
  if v_motivo is null then
    raise exception 'motivo obrigatório' using errcode = '22023';
  end if;
  if p_valor is null then
    raise exception 'valor obrigatório' using errcode = '22023';
  end if;
  select pa.valor into v_anterior from public.indicacoes_parametro pa where pa.chave = p_chave for update;
  if not found then
    raise exception 'parâmetro não encontrado' using errcode = 'P0002';
  end if;
  update public.indicacoes_parametro set valor = p_valor where chave = p_chave;
  insert into public.administracao_auditoria (autor_id, acao, alvo_tabela, alvo_id, motivo, valor_anterior, valor_novo)
  values (v_admin, 'definir_parametro_indicacoes', 'indicacoes_parametro', p_chave, v_motivo,
          jsonb_build_object('valor', v_anterior), jsonb_build_object('valor', p_valor));
end $$;

revoke all on function public.indicacoes_solicitar_reenvio(uuid, text) from public, anon;
revoke all on function public.indicacoes_tratar_alerta(uuid, text) from public, anon;
revoke all on function public.indicacoes_definir_parametro(text, integer, text) from public, anon;
grant execute on function public.indicacoes_solicitar_reenvio(uuid, text) to authenticated;
grant execute on function public.indicacoes_tratar_alerta(uuid, text) to authenticated;
grant execute on function public.indicacoes_definir_parametro(text, integer, text) to authenticated;
