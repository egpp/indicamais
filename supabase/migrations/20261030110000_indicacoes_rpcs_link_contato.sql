-- Fase 3 · módulo indicacoes · RPCs de link e de pedido de contato · IM-024, IM-025, IM-026, IM-028, IM-029,
-- IM-044 (só registro), IM-079, IM-086
--
-- CÓDIGOS DE ERRO (SQLSTATE) para a aplicação mapear mensagens:
--   42501  não autenticado / link que não é do usuário
--   22023  parâmetro inválido (WhatsApp, nome, e-mail, mensagem, chave, canal, destino)
--   P0412  indicador sem WhatsApp cadastrado (IM-009)
--   P0002  destino inexistente ou indisponível (IM-079), link inexistente
--   P0403  autoindicação: o dono não gera link para o próprio destino
--   P0429  limite de taxa atingido
--   23505  chave de idempotência já usada em outro destino
-- Nada aqui concede pontos, entra na Base de Relacionamento ou calcula comissão (Fases 4 e 5).

-- Resolve o destino (perfil OU item) para uso interno: disponibilidade (IM-079), dono, WhatsApp de contato e nome.
--   perfil ............ WhatsApp comercial da versão aprovada (IM-011)
--   item de perfil .... WhatsApp comercial da versão aprovada do perfil
--   anúncio particular  WhatsApp da conta do anunciante
-- Disponível = perfil publicado com versão aprovada; item publicado com versão aprovada e (particular ou perfil disponível).
create function public.indicacoes_resolver_destino(p_perfil_id uuid, p_item_id uuid)
returns table (o_disponivel boolean, o_dono_id uuid, o_whatsapp text, o_nome text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if (p_perfil_id is null) = (p_item_id is null) then
    raise exception 'informe exatamente um destino (perfil ou item)' using errcode = '22023';
  end if;
  if p_perfil_id is not null then
    return query
    select public.perfis_perfil_disponivel(p.id), p.responsavel_id, c.whatsapp_comercial_e164, v.nome
    from public.perfis_perfil p
    left join public.perfis_perfil_versao v on v.id = p.versao_aprovada_id and v.situacao = 'aprovada'
    left join public.perfis_perfil_versao_contato c on c.versao_id = v.id
    where p.id = p_perfil_id;
  else
    return query
    select (i.publicado and i.versao_aprovada_id is not null
              and (i.perfil_id is null or public.perfis_perfil_disponivel(i.perfil_id))),
           i.conta_id,
           case when i.perfil_id is null then ct.whatsapp_e164 else pc.whatsapp_comercial_e164 end,
           iv.nome
    from public.catalogo_item i
    left join public.catalogo_item_versao iv on iv.id = i.versao_aprovada_id and iv.situacao = 'aprovada'
    left join public.contas_conta ct on ct.id = i.conta_id
    left join public.perfis_perfil pp on pp.id = i.perfil_id
    left join public.perfis_perfil_versao pv on pv.id = pp.versao_aprovada_id and pv.situacao = 'aprovada'
    left join public.perfis_perfil_versao_contato pc on pc.versao_id = pv.id
    where i.id = p_item_id;
  end if;
end $$;
revoke all on function public.indicacoes_resolver_destino(uuid, uuid) from public, anon, authenticated;

-- IM-024: gera (ou devolve) o link do indicador para o destino. Idempotente: um link por (indicador, destino).
create function public.indicacoes_gerar_link(p_perfil_id uuid default null, p_item_id uuid default null)
returns table (o_codigo text, o_novo boolean)
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_disp boolean;
  v_dono uuid;
  v_link uuid;
  v_codigo text;
begin
  if v_uid is null then
    raise exception 'não autenticado' using errcode = '42501';
  end if;
  if (p_perfil_id is null) = (p_item_id is null) then
    raise exception 'informe exatamente um destino (perfil ou item)' using errcode = '22023';
  end if;
  if not public.contas_pode_indicar() then
    raise exception 'cadastre seu WhatsApp antes de indicar' using errcode = 'P0412';
  end if;
  select r.o_disponivel, r.o_dono_id into v_disp, v_dono
  from public.indicacoes_resolver_destino(p_perfil_id, p_item_id) r;
  if not found or not coalesce(v_disp, false) then
    raise exception 'destino indisponível' using errcode = 'P0002';
  end if;
  if v_dono = v_uid then
    raise exception 'autoindicação não é permitida' using errcode = 'P0403';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'indicacoes_link:' || v_uid::text || ':' || coalesce(p_perfil_id::text, p_item_id::text), 0));

  select l.codigo into v_codigo from public.indicacoes_link l
  where l.indicador_id = v_uid and l.perfil_id is not distinct from p_perfil_id and l.item_id is not distinct from p_item_id;
  if found then
    o_codigo := v_codigo;
    o_novo := false;
    return next;
    return;
  end if;

  insert into public.indicacoes_link (codigo, indicador_id, perfil_id, item_id)
  values (replace(gen_random_uuid()::text, '-', ''), v_uid, p_perfil_id, p_item_id)
  returning id, codigo into v_link, v_codigo;
  insert into public.indicacoes_evento (tipo, link_id) values ('link_gerado', v_link);

  o_codigo := v_codigo;
  o_novo := true;
  return next;
end $$;

-- IM-024/IM-025: registra que o INDICADOR compartilhou o link. Informado pelo cliente, sem valor probatório,
-- não pontua. Só o dono do link registra.
create function public.indicacoes_registrar_compartilhamento(p_codigo text, p_canal text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_link uuid;
  v_limite integer := public.indicacoes_parametro_valor('compartilhamento_limite_por_hora');
begin
  if v_uid is null then
    raise exception 'não autenticado' using errcode = '42501';
  end if;
  if p_canal is null or p_canal not in ('whatsapp', 'copiar', 'outro') then
    raise exception 'canal inválido' using errcode = '22023';
  end if;
  if p_codigo is null or p_codigo !~ '^[0-9a-f]{32}$' then
    raise exception 'link não encontrado' using errcode = 'P0002';
  end if;
  select l.id into v_link from public.indicacoes_link l where l.codigo = p_codigo and l.indicador_id = v_uid;
  if not found then
    raise exception 'link não encontrado' using errcode = 'P0002';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('indicacoes_compartilhar:' || v_link::text, 0));
  if (select count(*) from public.indicacoes_evento e
      where e.link_id = v_link and e.tipo = 'link_compartilhado' and e.criado_em > now() - interval '1 hour') >= v_limite then
    raise exception 'limite de compartilhamentos atingido' using errcode = 'P0429';
  end if;
  insert into public.indicacoes_evento (tipo, link_id, canal) values ('link_compartilhado', v_link, p_canal);
end $$;

-- IM-026/IM-028: pedido de contato de visitante (anônimo ou logado). Único caminho de escrita em
-- indicacoes_pedido_contato. Devolve SÓ o necessário ao redirecionamento: o WhatsApp de contato do destino.
--   * WhatsApp do visitante já normalizado em E.164 (+55): o banco valida e não "conserta".
--   * Idempotência: (WhatsApp, chave) repetido devolve o mesmo pedido, sem duplicar nem notificar de novo.
--   * Anti-repetição: mesmo WhatsApp + destino dentro da janela configurada devolve o pedido existente.
--   * Limite de taxa por WhatsApp (configurável). Proteção avançada e denúncias são da Fase 6.
--   * Atribuição (IM-025): p_codigo só vale se for exatamente o link do destino do pedido; senão o pedido segue
--     SEM atribuição (sem erro, o visitante não é prejudicado).
--   * autoindicacao_suspeita registra a tentativa (IM-034); o contato é permitido.
create function public.indicacoes_enviar_contato(
  p_perfil_id uuid,
  p_item_id uuid,
  p_nome text,
  p_whatsapp text,
  p_chave text,
  p_email text default null,
  p_mensagem text default null,
  p_codigo text default null
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
begin
  if p_chave is null or p_chave !~ '^[A-Za-z0-9_-]{16,100}$' then
    raise exception 'chave de idempotência inválida' using errcode = '22023';
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

revoke all on function public.indicacoes_gerar_link(uuid, uuid) from public, anon;
revoke all on function public.indicacoes_registrar_compartilhamento(text, text) from public, anon;
revoke all on function public.indicacoes_enviar_contato(uuid, uuid, text, text, text, text, text, text) from public;
grant execute on function public.indicacoes_gerar_link(uuid, uuid) to authenticated;
grant execute on function public.indicacoes_registrar_compartilhamento(text, text) to authenticated;
-- Único ponto de escrita aberto ao visitante sem cadastro (IM-026).
grant execute on function public.indicacoes_enviar_contato(uuid, uuid, text, text, text, text, text, text) to anon, authenticated;
