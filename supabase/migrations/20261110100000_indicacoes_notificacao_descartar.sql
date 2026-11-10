-- Descartar notificacoes de contato pendentes/falhas (IM-027, IM-028, IM-086).
-- ESCRITA E NAO APLICADA: aplicar primeiro em dev, so com "aprovado" do Emerson (D-003).
-- Motivo: notificacoes de teste ficam 'pendente'/'falhou' para sempre e poluem a fila e o alerta do administrador.
-- Novo estado terminal 'descartada': o administrador encerra a notificacao com motivo, sem apagar pedido nem
-- notificacao e sem mexer em tentativas. Nunca age sobre 'enviada'. Fica fora de indicacoes_notificacoes_pendentes
-- e de indicacoes_notificacoes_recolocar_falhas (ambas filtram estado = 'pendente' / 'falhou').
-- Decisao de projeto: descartada NAO volta sozinha. O reenvio forcado do administrador deixa de aceitar descartada
-- (ressuscitar exigiria decisao do Emerson) e o registro de resultado do servidor ignora descartada.
-- O alerta aberto da notificacao descartada passa a 'tratado' (registrado em valor_novo da auditoria).

alter table public.indicacoes_notificacao drop constraint indicacoes_notificacao_estado;
alter table public.indicacoes_notificacao add constraint indicacoes_notificacao_estado
  check (estado in ('pendente', 'enviada', 'falhou', 'descartada'));

alter table public.indicacoes_notificacao_historico drop constraint indicacoes_notif_hist_evento;
alter table public.indicacoes_notificacao_historico add constraint indicacoes_notif_hist_evento
  check (evento in ('tentativa_enviada', 'tentativa_falhou', 'reenvio_solicitado', 'alerta_tratado', 'descartada'));

-- Descarte em lote (administrador). Retorna a contagem descartada. Pedidos 'enviada' ou ja 'descartada' sao ignorados.
create function public.indicacoes_notificacoes_descartar(p_pedido_ids uuid[], p_motivo text) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := public.administracao_exigir_admin();
  v_motivo text := btrim(coalesce(p_motivo, ''));
  v_ids uuid[];
  r record;
  v_qtd integer := 0;
begin
  if char_length(v_motivo) < 10 then
    raise exception 'motivo obrigatório (mínimo 10 caracteres)' using errcode = '22023';
  end if;
  if char_length(v_motivo) > 500 then
    raise exception 'motivo longo demais (máximo 500 caracteres)' using errcode = '22023';
  end if;
  if p_pedido_ids is null or coalesce(cardinality(p_pedido_ids), 0) = 0 then
    raise exception 'informe ao menos um pedido' using errcode = '22023';
  end if;
  if cardinality(p_pedido_ids) > 500 then
    raise exception 'no máximo 500 pedidos por chamada' using errcode = '22023';
  end if;
  select coalesce(array_agg(distinct x), '{}') into v_ids from unnest(p_pedido_ids) as x where x is not null;

  for r in
    select n.pedido_id, n.estado, n.tentativas, n.alerta_estado
    from public.indicacoes_notificacao n
    where n.pedido_id = any (v_ids) and n.estado in ('pendente', 'falhou')
    order by n.pedido_id
    for update
  loop
    update public.indicacoes_notificacao
       set estado = 'descartada',
           alerta_estado = case when r.alerta_estado = 'aberto' then 'tratado' else r.alerta_estado end
     where pedido_id = r.pedido_id;
    insert into public.indicacoes_notificacao_historico (pedido_id, evento, origem)
    values (r.pedido_id, 'descartada', 'admin');
    insert into public.administracao_auditoria (autor_id, acao, alvo_tabela, alvo_id, motivo, valor_anterior, valor_novo)
    values (v_admin, 'descartar_notificacao_contato', 'indicacoes_pedido_contato', r.pedido_id::text, v_motivo,
            jsonb_build_object('estado', r.estado, 'tentativas', r.tentativas, 'alerta_estado', r.alerta_estado),
            jsonb_build_object('estado', 'descartada', 'tentativas', r.tentativas,
                               'alerta_estado', case when r.alerta_estado = 'aberto' then 'tratado' else r.alerta_estado end));
    v_qtd := v_qtd + 1;
  end loop;
  return v_qtd;
end $$;

revoke all on function public.indicacoes_notificacoes_descartar(uuid[], text) from public, anon;
grant execute on function public.indicacoes_notificacoes_descartar(uuid[], text) to authenticated;

-- Reenvio: descartada nao ressuscita (nem pelo administrador). Mesma funcao da migracao 20261030120000 + um bloqueio.
create or replace function public.indicacoes_solicitar_reenvio(p_pedido_id uuid, p_motivo text default null) returns void
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
  if v_estado = 'descartada' then
    raise exception 'notificação descartada não volta à fila' using errcode = 'P0001';
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

-- Registro do servidor: descartada e terminal; um envio em andamento que termine depois do descarte nao a altera.
create or replace function public.indicacoes_notificacao_registrar(p_pedido_id uuid, p_sucesso boolean, p_erro text default null) returns void
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
  if v_estado in ('enviada', 'descartada') then
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
