-- D-034, decisão 2 (S-03, M-01, M-03; IM-026, IM-076, IM-086): o contato do visitante e a denúncia pública deixam de
-- ser chamáveis por anon. Passam a ser chamados pela ação do servidor, DEPOIS do Turnstile e do cálculo da origem
-- (HMAC), com a chave de serviço só nessa chamada (src/app/_lib/chamada-publica-servidor.ts).
--
-- authenticated MANTÉM o EXECUTE: quem está logado chama com a sessão dele, e o banco usa auth.uid() para solicitante,
-- denunciante, autoindicação suspeita e bloqueio de conta suspensa (com a chave de serviço isso se perderia). A
-- ação do servidor também confere o Turnstile para quem está logado.
--
-- ORDEM DE IMPLANTAÇÃO: publicar o código novo ANTES desta migração. O código novo funciona antes e depois dela
-- (a chave de serviço já podia chamar as funções); o código ANTIGO, depois dela, deixa o visitante sem contato.
-- Exige SUPABASE_SERVICE_ROLE_KEY no Worker/servidor (o cron já a usa).
--
-- Lição D1: nenhuma visão, função ou gatilho do banco chama estas duas funções (conferido por busca nas migrações);
-- se uma visão ou função passar a chamá-las em nome de anon, o EXECUTE revogado faria a consulta falhar.

revoke all on function public.indicacoes_enviar_contato(uuid, uuid, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.indicacoes_enviar_contato(uuid, uuid, text, text, text, text, text, text, text) to authenticated, service_role;

revoke all on function public.administracao_denunciar(text, uuid, text, text, text, text) from public, anon;
grant execute on function public.administracao_denunciar(text, uuid, text, text, text, text) to authenticated, service_role;

-- Gatilho de limites do S-03 SEM a isenção de service_role. Antes, auth.role() = 'service_role' pulava os limites por link,
-- destino e global (e os alarmes), pensando em carga em massa. Agora o contato público do visitante chega ao banco como
-- service_role (ação do servidor): mantida a isenção, os limites e alarmes do D-034, decisão 1, deixariam de valer para
-- todo pedido do site. O limite por origem (na RPC) nunca teve isenção. Assinatura e privilégios não mudam.
-- Por isso: aplicar esta migração logo depois do código novo (entre os dois, o contato por service_role seria isento).
create or replace function public.indicacoes_pedido_limitar() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_janela constant timestamptz := date_trunc('hour', now());
  v_desde constant timestamptz := now() - interval '1 hour';
  v_recusar boolean;
  v_lim integer;
  v_qtd integer;
  v_nivel smallint;
  v_excesso boolean;
begin
  v_recusar := coalesce(public.indicacoes_parametro_valor('contato_recusar_excesso'), 0) = 1;

  -- Por link: serializa, e no excesso tira a atribuição (o pedido segue; sem pontos).
  if new.link_id is not null then
    perform pg_advisory_xact_lock(hashtextextended('indicacoes_link:' || new.link_id::text, 0));
    v_lim := public.indicacoes_parametro_valor('contato_limite_por_link_hora');
    select count(*) into v_qtd from (
      select 1 from public.indicacoes_pedido_contato p
      where p.link_id = new.link_id and p.criado_em > v_desde limit v_lim) s;
    v_excesso := v_qtd >= v_lim;
    -- Mesmo link, mesma origem (hash de IP): se uma só origem já usou a cota por origem neste link, perde a atribuição.
    if not v_excesso and new.origem_hash is not null then
      v_lim := public.indicacoes_parametro_valor('contato_limite_por_origem');
      select count(*) into v_qtd from (
        select 1 from public.indicacoes_pedido_contato p
        where p.link_id = new.link_id and p.origem_hash = new.origem_hash and p.criado_em > v_desde limit v_lim) s;
      v_excesso := v_qtd >= v_lim;
    end if;
    if v_excesso then
      insert into public.indicacoes_alarme_excesso (tipo, janela, alvo_id, nivel, quantidade, limite)
      values ('link', v_janela, new.link_id, 0, v_qtd, v_lim)
      on conflict (tipo, janela, (coalesce(alvo_id, '00000000-0000-0000-0000-000000000000'::uuid)), nivel) do nothing;
      new.link_id := null;
    end if;
  end if;

  -- Por destino: serializa e alarma (recusa só com o interruptor).
  perform pg_advisory_xact_lock(hashtextextended('indicacoes_destino:' || coalesce(new.perfil_id, new.item_id)::text, 0));
  v_lim := public.indicacoes_parametro_valor('contato_limite_por_destino_hora');
  -- Dois IF (e não CASE no WHERE) para o plano usar sempre o índice parcial do destino (perfil ou item).
  if new.perfil_id is not null then
    select count(*) into v_qtd from (
      select 1 from public.indicacoes_pedido_contato p
      where p.perfil_id = new.perfil_id and p.criado_em > v_desde limit v_lim * 4) s;
  else
    select count(*) into v_qtd from (
      select 1 from public.indicacoes_pedido_contato p
      where p.item_id = new.item_id and p.criado_em > v_desde limit v_lim * 4) s;
  end if;
  if v_qtd >= v_lim then
    if v_recusar then
      raise exception 'limite de pedidos atingido: tente novamente mais tarde' using errcode = 'P0429';
    end if;
    v_nivel := case when v_qtd >= v_lim * 4 then 2 when v_qtd >= v_lim * 2 then 1 else 0 end;
    insert into public.indicacoes_alarme_excesso (tipo, janela, alvo_id, nivel, quantidade, limite)
    values ('destino', v_janela, coalesce(new.perfil_id, new.item_id), v_nivel, v_qtd, v_lim)
    on conflict (tipo, janela, (coalesce(alvo_id, '00000000-0000-0000-0000-000000000000'::uuid)), nivel) do nothing;
  end if;

  -- Global (mole): alarma; recusa só com o interruptor.
  v_lim := public.indicacoes_parametro_valor('contato_limite_global_hora');
  select count(*) into v_qtd from (
    select 1 from public.indicacoes_pedido_contato p where p.criado_em > v_desde limit v_lim * 4) s;
  if v_qtd >= v_lim then
    if v_recusar then
      raise exception 'limite de pedidos atingido: tente novamente mais tarde' using errcode = 'P0429';
    end if;
    v_nivel := case when v_qtd >= v_lim * 4 then 2 when v_qtd >= v_lim * 2 then 1 else 0 end;
    insert into public.indicacoes_alarme_excesso (tipo, janela, alvo_id, nivel, quantidade, limite)
    values ('global', v_janela, null, v_nivel, v_qtd, v_lim)
    on conflict (tipo, janela, (coalesce(alvo_id, '00000000-0000-0000-0000-000000000000'::uuid)), nivel) do nothing;
  end if;
  return new;
end $$;
