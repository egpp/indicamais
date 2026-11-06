-- RSA-05 (D-033, IM-026, IM-076, IM-086): reconcilia o pedido de contato público com a revisão de banco (S-03, migração
-- 20261106110000). Esta migração vem DEPOIS dela: o limite por destino tem UMA casa só (os parâmetros do S-03).
--
-- PROBLEMA: indicacoes_enviar_contato() é liberada a anon e limitava só por WhatsApp do visitante (campo livre): variar o
-- número escapava de tudo e permitia inundar o painel do responsável e esgotar a cota de e-mail.
--
-- O QUE MUDA
--   * LIMITE POR DESTINO: NÃO existe mais parâmetro próprio aqui. Vale o do S-03 (contato_limite_por_destino_hora, na
--     janela de 1 h), que NÃO recusa: vira alarme em indicacoes_alarme_excesso e só recusa (P0429) se o interruptor
--     contato_recusar_excesso (padrão 0) for ligado, o que deve esperar o Turnstile. Recusar por destino é negação de
--     serviço barata (o visitante é livre para trocar de número; o código do link é público).
--   * LIMITE POR ORIGEM (novo, COM recusa P0429): parâmetro contato_limite_por_origem (padrão 10 na janela de
--     contato_limite_janela_minutos, 60 min). Só atinge quem gera os pedidos (o próprio abusador). RESSALVA: origem é um
--     hash de IP + user-agent; vários visitantes legítimos atrás do mesmo NAT (escritório, escola, operadora com CGNAT)
--     compartilham IP e, com o mesmo navegador, a mesma origem, e podem ser recusados juntos. Por isso o padrão é folgado
--     (10/h) e ajustável em /administracao/parametros; se virar problema, subir o valor.
--   * LIMITE POR LINK E ORIGEM: o gatilho de limite por link do S-03 passa a contar também o mesmo link com a mesma
--     origem_hash (quando existe): sem recusa, o excesso só tira a atribuição (sem pontos), como no limite por link.
--     Hoje a recusa por origem (acima) chega primeiro com a mesma janela; esta contagem cobre janela maior que 1 h e
--     inserções que não passam pela RPC.
--   * indicacoes_pedido_contato.origem_hash (nullable): HMAC-SHA-256 hex (64) de IP + user-agent, calculado pelo SERVIDOR do
--     app com segredo próprio. O IP nunca é guardado. Pedidos antigos ficam com nulo.
--   * indicacoes_enviar_contato() ganha o último parâmetro p_origem_hash (default null): chamadas antigas de 8 argumentos
--     continuam válidas. A RPC NÃO isenta service_role de nada (o limite por origem vale para qualquer papel).
--   * Mesma ordem de verificação: idempotência, repetição, limite por WhatsApp, por origem. Repetição não conta.
--   * Travas (pg_advisory_xact_lock), sempre nesta ordem, sem deadlock: WhatsApp, origem (na RPC), depois link e destino
--     (no gatilho do INSERT, ordem do S-03). Nenhum caminho adquire em ordem inversa.
--   * O gatilho indicacoes_pedido_limitar é recriado (create or replace: ACL e gatilho mantidos) só para o item acima.
--
-- LIMITE CONHECIDO: a função segue liberada a anon (contrato de IM-026). Quem chamar a API direto, sem passar pelo app,
-- não passa pelo Turnstile nem informa origem; fica sujeito ao limite por WhatsApp e aos alarmes/atribuição do gatilho. Fechar
-- isso por completo exige revogar anon e chamar por cliente de serviço no servidor (decisão do gestor).

alter table public.indicacoes_pedido_contato add column origem_hash text;
alter table public.indicacoes_pedido_contato add constraint indicacoes_pedido_origem_hash
  check (origem_hash is null or origem_hash ~ '^[0-9a-f]{64}$');
create index indicacoes_pedido_origem_idx on public.indicacoes_pedido_contato (origem_hash, criado_em desc)
  where origem_hash is not null;
comment on column public.indicacoes_pedido_contato.origem_hash is 'HMAC-SHA-256 (hex) de IP + user-agent, calculado no servidor; só para o limite por origem. Nunca o IP.';

insert into public.indicacoes_parametro (chave, valor, minimo, maximo, descricao) values
  ('contato_limite_por_origem', 10, 1, 1000, 'Máximo de pedidos novos por origem (hash de IP e navegador) dentro da janela de limite de taxa.');

drop function public.indicacoes_enviar_contato(uuid, uuid, text, text, text, text, text, text);

create function public.indicacoes_enviar_contato(
  p_perfil_id uuid,
  p_item_id uuid,
  p_nome text,
  p_whatsapp text,
  p_chave text,
  p_email text default null,
  p_mensagem text default null,
  p_codigo text default null,
  p_origem_hash text default null
) returns table (o_pedido_id uuid, o_whatsapp_responsavel text, o_repetido boolean)
language plpgsql security definer set search_path = '' as $$
declare
  c_invisiveis constant text := '[\u0001-\u001F\u007F​-‏ - ⁠-⁯﻿]';
  c_invisiveis_msg constant text := '[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏ - ⁠-⁯﻿]';
  v_uid uuid := (select auth.uid());
  v_nome text := btrim(coalesce(p_nome, ''));
  v_email text := nullif(btrim(coalesce(p_email, '')), '');
  v_msg text := nullif(btrim(coalesce(p_mensagem, '')), '');
  v_disp boolean;
  v_dono uuid;
  v_wa text;
  v_pedido uuid;
  v_perfil_existente uuid;
  v_item_existente uuid;
  v_link uuid;
  v_indicador uuid;
  v_suspeita boolean := false;
  v_janela integer;
  v_limite integer;
  v_limite_janela integer;
  v_limite_origem integer;
begin
  if p_chave is null or p_chave !~ '^[A-Za-z0-9_-]{16,100}$' then
    raise exception 'chave de idempotência inválida' using errcode = '22023';
  end if;
  if p_origem_hash is not null and p_origem_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'origem inválida' using errcode = '22023';
  end if;
  if p_whatsapp is null or p_whatsapp !~ '^\+55[0-9]{10,11}$' then
    raise exception 'WhatsApp inválido: use o formato +55DDDNÚMERO' using errcode = '22023';
  end if;
  if char_length(v_nome) not between 2 and 80 or v_nome ~ c_invisiveis then
    raise exception 'nome inválido' using errcode = '22023';
  end if;
  if v_email is not null and (char_length(v_email) > 254
     or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or v_email ~ c_invisiveis) then
    raise exception 'e-mail inválido' using errcode = '22023';
  end if;
  if v_msg is not null and (char_length(v_msg) > 1000 or v_msg ~ c_invisiveis_msg) then
    raise exception 'mensagem inválida' using errcode = '22023';
  end if;
  if (p_perfil_id is null) = (p_item_id is null) then
    raise exception 'informe exatamente um destino (perfil ou item)' using errcode = '22023';
  end if;

  -- IM-079: só destino disponível recebe pedido novo.
  select r.o_disponivel, r.o_dono_id, r.o_whatsapp into v_disp, v_dono, v_wa
  from public.indicacoes_resolver_destino(p_perfil_id, p_item_id) r;
  if not found or not coalesce(v_disp, false) or v_wa is null then
    raise exception 'destino indisponível' using errcode = 'P0002';
  end if;

  -- Serializa por WhatsApp do visitante: chave, janela e limite ficam consistentes sob concorrência.
  perform pg_advisory_xact_lock(hashtextextended('indicacoes_contato:' || p_whatsapp, 0));

  -- IM-028: mesma chave do mesmo WhatsApp = mesma operação.
  select p.id, p.perfil_id, p.item_id into v_pedido, v_perfil_existente, v_item_existente
  from public.indicacoes_pedido_contato p
  where p.whatsapp_e164 = p_whatsapp and p.chave_idempotencia = p_chave;
  if found then
    if v_perfil_existente is distinct from p_perfil_id or v_item_existente is distinct from p_item_id then
      raise exception 'chave de idempotência já usada em outro pedido' using errcode = '23505';
    end if;
    return query select v_pedido, v_wa, true;
    return;
  end if;

  -- Anti-repetição: mesmo WhatsApp e destino dentro da janela.
  v_janela := public.indicacoes_parametro_valor('contato_janela_repeticao_minutos');
  select p.id into v_pedido
  from public.indicacoes_pedido_contato p
  where p.whatsapp_e164 = p_whatsapp
    and p.perfil_id is not distinct from p_perfil_id and p.item_id is not distinct from p_item_id
    and p.criado_em > now() - make_interval(mins => v_janela)
  order by p.criado_em desc limit 1;
  if found then
    return query select v_pedido, v_wa, true;
    return;
  end if;

  -- Limite de taxa básico por WhatsApp.
  v_limite := public.indicacoes_parametro_valor('contato_limite_por_whatsapp');
  v_limite_janela := public.indicacoes_parametro_valor('contato_limite_janela_minutos');
  if (select count(*) from public.indicacoes_pedido_contato p
      where p.whatsapp_e164 = p_whatsapp and p.criado_em > now() - make_interval(mins => v_limite_janela)) >= v_limite then
    raise exception 'limite de pedidos atingido: tente novamente mais tarde' using errcode = 'P0429';
  end if;

  -- RSA-05: limite por ORIGEM (HMAC de IP + navegador calculado pelo servidor), COM recusa (P0429): só atinge quem gera
  -- os pedidos. Sem origem (chamada direta, sem o servidor do app) o limite por origem não se aplica; o de WhatsApp
  -- continua valendo, e os de link, destino e global são do gatilho indicacoes_pedido_limitar (alarme, sem recusa).
  -- Ordem das travas desta transação (sempre a mesma, sem deadlock): WhatsApp, origem, e depois, no gatilho do INSERT,
  -- link e destino.
  if p_origem_hash is not null then
    perform pg_advisory_xact_lock(hashtextextended('indicacoes_contato_origem:' || p_origem_hash, 0));
    v_limite_origem := public.indicacoes_parametro_valor('contato_limite_por_origem');
    if (select count(*) from public.indicacoes_pedido_contato p
        where p.origem_hash = p_origem_hash
          and p.criado_em > now() - make_interval(mins => v_limite_janela)) >= v_limite_origem then
      raise exception 'limite de pedidos atingido: tente novamente mais tarde' using errcode = 'P0429';
    end if;
  end if;

  -- IM-025: o código só vale para o destino do próprio link.
  if p_codigo is not null and p_codigo ~ '^[0-9a-f]{32}$' then
    select l.id, l.indicador_id into v_link, v_indicador
    from public.indicacoes_link l
    where l.codigo = p_codigo
      and l.perfil_id is not distinct from p_perfil_id and l.item_id is not distinct from p_item_id;
  end if;
  if v_link is not null then
    v_suspeita := coalesce(v_indicador = v_uid, false)
      or coalesce(v_dono = v_uid, false)
      or p_whatsapp = v_wa
      or exists (select 1 from public.contas_conta c
                 where c.id in (v_indicador, v_dono) and c.whatsapp_e164 = p_whatsapp);
  end if;

  insert into public.indicacoes_pedido_contato
    (perfil_id, item_id, link_id, solicitante_id, nome, whatsapp_e164, email, mensagem, chave_idempotencia, autoindicacao_suspeita, origem_hash)
  values (p_perfil_id, p_item_id, v_link, v_uid, v_nome, p_whatsapp, v_email, v_msg, p_chave, v_suspeita, p_origem_hash)
  returning id into v_pedido;
  insert into public.indicacoes_notificacao (pedido_id) values (v_pedido);
  insert into public.indicacoes_evento (tipo, link_id, pedido_id) values ('contato_enviado', v_link, v_pedido);

  return query select v_pedido, v_wa, false;
end $$;

revoke all on function public.indicacoes_enviar_contato(uuid, uuid, text, text, text, text, text, text, text) from public;
-- Único ponto de escrita aberto ao visitante sem cadastro (IM-026).
grant execute on function public.indicacoes_enviar_contato(uuid, uuid, text, text, text, text, text, text, text) to anon, authenticated;

-- Gatilho de limites do S-03, com a contagem por link e origem (ver cabeçalho). Assinatura e privilégios não mudam.
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
  if (select auth.role()) = 'service_role' then
    return new;
  end if;
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
