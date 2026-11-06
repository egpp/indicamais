-- RSA-05 (D-033, IM-026, IM-076, IM-086): limites do pedido de contato público que NÃO dependem do WhatsApp digitado.
--
-- PROBLEMA: indicacoes_enviar_contato() é liberada a anon e limitava só por WhatsApp do visitante (campo livre): variar o
-- número escapava de tudo e permitia inundar o painel do responsável e esgotar a cota de e-mail.
--
-- O QUE MUDA
--   * Parâmetros novos (editáveis pelo administrador, mesma janela do limite por WhatsApp):
--     contato_limite_por_destino (pedidos novos por perfil/item na janela) e contato_limite_por_origem (por hash de origem).
--   * indicacoes_pedido_contato.origem_hash (nullable): HMAC-SHA-256 hex (64) de IP + user-agent, calculado pelo SERVIDOR do
--     app com segredo próprio. O IP nunca é guardado. Pedidos antigos ficam com nulo.
--   * indicacoes_enviar_contato() ganha o último parâmetro p_origem_hash (default null): chamadas antigas de 8 argumentos
--     continuam válidas. Limite por destino vale SEMPRE (inclusive chamada direta). Limite por origem vale quando há hash.
--   * Mesma ordem de verificação: idempotência, repetição, limite por WhatsApp, por destino, por origem. Repetição não conta.
--   * Mesmos erros: P0429 (mensagem neutra) ao exceder qualquer limite.
--
-- LIMITE CONHECIDO: a função segue liberada a anon (contrato de IM-026). Quem chamar a API direto, sem passar pelo app,
-- não passa pelo Turnstile nem informa origem; fica sujeito aos limites por WhatsApp e por destino. Fechar isso por completo
-- exige revogar anon e chamar por cliente de serviço no servidor (decisão do gestor; muda o pgTAP existente).

alter table public.indicacoes_pedido_contato add column origem_hash text;
alter table public.indicacoes_pedido_contato add constraint indicacoes_pedido_origem_hash
  check (origem_hash is null or origem_hash ~ '^[0-9a-f]{64}$');
create index indicacoes_pedido_origem_idx on public.indicacoes_pedido_contato (origem_hash, criado_em desc)
  where origem_hash is not null;
create index indicacoes_pedido_destino_idx on public.indicacoes_pedido_contato (perfil_id, item_id, criado_em desc);
comment on column public.indicacoes_pedido_contato.origem_hash is 'HMAC-SHA-256 (hex) de IP + user-agent, calculado no servidor; só para o limite por origem. Nunca o IP.';

insert into public.indicacoes_parametro (chave, valor, minimo, maximo, descricao) values
  ('contato_limite_por_destino', 30, 1, 1000, 'Máximo de pedidos novos por perfil ou item (todos os visitantes) dentro da janela de limite de taxa.'),
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
  v_limite_destino integer;
  v_limite_origem integer;
begin
  if p_chave is null or p_chave !~ '^[A-Za-z0-9_-]{16,100}$' then
    raise exception 'chave de idempotência inválida' using errcode = '22023';
  end if;
  if p_origem_hash is not null and p_origem_hash !~ '^[0-9a-f]{64} p_whatsapp !~ '^\+55[0-9]{10,11}$' then
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

  -- RSA-05: limite por DESTINO (perfil ou item). A chave do limite por WhatsApp é digitada pelo visitante e se contorna
  -- trocando o número; este limite não depende de nada que o visitante informe. Serializa por destino.
  perform pg_advisory_xact_lock(hashtextextended('indicacoes_contato_destino:' || coalesce(p_perfil_id, p_item_id)::text, 0));
  v_limite_destino := public.indicacoes_parametro_valor('contato_limite_por_destino');
  if (select count(*) from public.indicacoes_pedido_contato p
      where p.perfil_id is not distinct from p_perfil_id and p.item_id is not distinct from p_item_id
        and p.criado_em > now() - make_interval(mins => v_limite_janela)) >= v_limite_destino then
    raise exception 'limite de pedidos atingido: tente novamente mais tarde' using errcode = 'P0429';
  end if;

  -- RSA-05: limite por ORIGEM (HMAC de IP + navegador calculado pelo servidor). Sem origem (chamada direta, sem o
  -- servidor do app) o limite por origem não se aplica; os de WhatsApp e destino continuam valendo.
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
end $$; then
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
    (perfil_id, item_id, link_id, solicitante_id, nome, whatsapp_e164, email, mensagem, chave_idempotencia, autoindicacao_suspeita)
  values (p_perfil_id, p_item_id, v_link, v_uid, v_nome, p_whatsapp, v_email, v_msg, p_chave, v_suspeita)
  returning id into v_pedido;
  insert into public.indicacoes_notificacao (pedido_id) values (v_pedido);
  insert into public.indicacoes_evento (tipo, link_id, pedido_id) values ('contato_enviado', v_link, v_pedido);

  return query select v_pedido, v_wa, false;
end $$;

revoke all on function public.indicacoes_enviar_contato(uuid, uuid, text, text, text, text, text, text, text) from public;
-- Único ponto de escrita aberto ao visitante sem cadastro (IM-026).
grant execute on function public.indicacoes_enviar_contato(uuid, uuid, text, text, text, text, text, text, text) to anon, authenticated;
