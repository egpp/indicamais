-- Fase 7 · módulo comissoes · apoio, parâmetro, habilitação por negócio e ofertas · IM-061, IM-062, IM-063, IM-068, IM-069,
-- IM-073, IM-086, D-025
--
-- Erros: 42501 sem permissão (mensagem neutra, igual para "não existe" e "não é seu"); 22023 parâmetro inválido ou motivo
-- ausente; P0002 registro inexistente; P0001 regra de negócio (ex.: módulo não habilitado); P0409 duplicidade.
-- Auditoria (autor, data, motivo, valor anterior) é gravada na MESMA transação da ação administrativa.

-- Funções internas (sem acesso da API) ---------------------------------------------------------------------------
create function public.comissoes_hoje() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'utc')::date;
$$;
revoke all on function public.comissoes_hoje() from public, anon, authenticated;

create function public.comissoes_parametro_valor(p_chave text) returns integer
language sql stable security definer set search_path = '' as $$
  select valor from public.comissoes_parametro where chave = p_chave;
$$;
revoke all on function public.comissoes_parametro_valor(text) from public, anon, authenticated;

-- Módulo habilitado para o negócio (último evento). Sem evento = nunca habilitado = false.
create function public.comissoes_modulo_ativo(p_perfil uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select e.ativa from public.comissoes_habilitacao_evento e
                   where e.perfil_id = p_perfil order by e.id desc limit 1), false);
$$;
revoke all on function public.comissoes_modulo_ativo(uuid) from public, anon, authenticated;

create function public.comissoes_oferta_ativa(p_oferta uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select e.ativa from public.comissoes_oferta_estado e
                   where e.oferta_id = p_oferta order by e.id desc limit 1), false);
$$;
revoke all on function public.comissoes_oferta_ativa(uuid) from public, anon, authenticated;

create function public.comissoes_percentual_vigente(p_oferta uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select p.percentual_bp from public.comissoes_oferta_percentual p
  where p.oferta_id = p_oferta order by p.id desc limit 1;
$$;
revoke all on function public.comissoes_percentual_vigente(uuid) from public, anon, authenticated;

-- Guarda do anunciante: devolve o id da conta se ela é a RESPONSÁVEL do negócio e tem acesso permitido (não suspensa).
-- Mensagem neutra: não revela se o negócio existe.
create function public.comissoes_exigir_responsavel(p_perfil uuid) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null or p_perfil is null or not public.contas_acesso_permitido(v_uid)
     or not exists (select 1 from public.perfis_perfil p where p.id = p_perfil and p.responsavel_id = v_uid) then
    raise exception 'acesso negado' using errcode = '42501';
  end if;
  return v_uid;
end $$;
revoke all on function public.comissoes_exigir_responsavel(uuid) from public, anon, authenticated;

-- Parâmetro (somente administrador) -----------------------------------------------------------------------------------
-- Erros: 42501 não administrador; 22023 motivo/valor inválido ou fora da faixa; P0002 parâmetro inexistente.
create function public.comissoes_definir_parametro(p_chave text, p_valor integer, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := public.administracao_exigir_admin();
  v_motivo text := nullif(left(btrim(coalesce(p_motivo, '')), 500), '');
  v_anterior integer;
  v_min integer;
  v_max integer;
begin
  if v_motivo is null then
    raise exception 'motivo obrigatório' using errcode = '22023';
  end if;
  if p_valor is null then
    raise exception 'valor obrigatório' using errcode = '22023';
  end if;
  select pa.valor, pa.minimo, pa.maximo into v_anterior, v_min, v_max
  from public.comissoes_parametro pa where pa.chave = p_chave for update;
  if not found then
    raise exception 'parâmetro não encontrado' using errcode = 'P0002';
  end if;
  if p_valor < v_min or p_valor > v_max then
    raise exception 'valor fora da faixa permitida (% a %)', v_min, v_max using errcode = '22023';
  end if;
  update public.comissoes_parametro set valor = p_valor where chave = p_chave;
  insert into public.administracao_auditoria (autor_id, acao, alvo_tabela, alvo_id, motivo, valor_anterior, valor_novo)
  values (v_admin, 'definir_parametro_comissoes', 'comissoes_parametro', p_chave, v_motivo,
          jsonb_build_object('valor', v_anterior), jsonb_build_object('valor', p_valor));
end $$;
revoke all on function public.comissoes_definir_parametro(text, integer, text) from public, anon;
grant execute on function public.comissoes_definir_parametro(text, integer, text) to authenticated;

-- Habilitação por negócio (IM-061): somente o administrador geral ----------------------------------------------------
-- Idempotente: repetir o estado atual não grava evento nem auditoria (devolve null). Cria a rede do negócio na primeira
-- habilitação (IM-063). Desabilitar preserva saldos, vínculos e histórico; só bloqueia NOVAS comissões (IM-073).
-- Não ativa integração financeira (IM-061, IM-090).
create function public.comissoes_definir_habilitacao(p_perfil uuid, p_ativa boolean, p_origem text, p_motivo text) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := public.administracao_exigir_admin();
  v_motivo text := nullif(left(btrim(coalesce(p_motivo, '')), 500), '');
  v_atual boolean;
  v_id bigint;
begin
  if v_motivo is null then
    raise exception 'motivo obrigatório' using errcode = '22023';
  end if;
  if p_ativa is null or p_origem is null or p_origem not in ('espontanea', 'solicitacao') then
    raise exception 'estado ou origem inválidos' using errcode = '22023';
  end if;
  if not exists (select 1 from public.perfis_perfil p where p.id = p_perfil) then
    raise exception 'negócio não encontrado' using errcode = 'P0002';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('comissoes_habilitacao:' || p_perfil::text, 0));
  v_atual := public.comissoes_modulo_ativo(p_perfil);
  if v_atual = p_ativa then
    return null;
  end if;
  insert into public.comissoes_habilitacao_evento (perfil_id, ativa, origem, motivo, autor_id)
  values (p_perfil, p_ativa, p_origem, v_motivo, v_admin)
  returning id into v_id;
  if p_ativa then
    insert into public.comissoes_rede (perfil_id, criada_por) values (p_perfil, v_admin)
    on conflict (perfil_id) do nothing;
  end if;
  insert into public.administracao_auditoria (autor_id, acao, alvo_tabela, alvo_id, motivo, valor_anterior, valor_novo)
  values (v_admin, case when p_ativa then 'habilitar_comissoes' else 'desabilitar_comissoes' end,
          'comissoes_habilitacao_evento', p_perfil::text, v_motivo,
          jsonb_build_object('ativa', v_atual),
          jsonb_build_object('ativa', p_ativa, 'origem', p_origem, 'evento_id', v_id));
  return v_id;
end $$;
revoke all on function public.comissoes_definir_habilitacao(uuid, boolean, text, text) from public, anon;
grant execute on function public.comissoes_definir_habilitacao(uuid, boolean, text, text) to authenticated;

-- Ofertas recorrentes (IM-062): somente o responsável do negócio, e só com o módulo habilitado -----------------------
-- Cria a oferta a partir de um item do catálogo do MESMO negócio, com o percentual inicial. Percentual em pontos-base
-- (100 = 1%). Erros: 42501 não é o responsável; 22023 nome/percentual/item inválido; P0001 módulo não habilitado;
-- P0409 item já é oferta.
create function public.comissoes_criar_oferta(p_perfil uuid, p_item_id uuid, p_nome text, p_percentual_bp integer) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.comissoes_exigir_responsavel(p_perfil);
  v_nome text := nullif(left(btrim(coalesce(p_nome, '')), 100), '');
  v_id uuid;
begin
  if not public.comissoes_modulo_ativo(p_perfil) then
    raise exception 'módulo de comissões não habilitado para este negócio' using errcode = 'P0001';
  end if;
  if v_nome is null then
    raise exception 'nome obrigatório' using errcode = '22023';
  end if;
  if p_percentual_bp is null or p_percentual_bp < 1 or p_percentual_bp > 10000 then
    raise exception 'percentual fora da faixa' using errcode = '22023';
  end if;
  if p_item_id is null or not exists (select 1 from public.catalogo_item i where i.id = p_item_id and i.perfil_id = p_perfil) then
    raise exception 'item inválido para este negócio' using errcode = '22023';
  end if;
  if exists (select 1 from public.comissoes_oferta o where o.perfil_id = p_perfil and o.item_id = p_item_id) then
    raise exception 'item já cadastrado como oferta' using errcode = 'P0409';
  end if;
  insert into public.comissoes_oferta (perfil_id, item_id, nome, criada_por)
  values (p_perfil, p_item_id, v_nome, v_uid)
  returning id into v_id;
  insert into public.comissoes_oferta_percentual (oferta_id, percentual_bp, autor_id) values (v_id, p_percentual_bp, v_uid);
  insert into public.comissoes_oferta_estado (oferta_id, ativa, autor_id) values (v_id, true, v_uid);
  return v_id;
end $$;
revoke all on function public.comissoes_criar_oferta(uuid, uuid, text, integer) from public, anon;
grant execute on function public.comissoes_criar_oferta(uuid, uuid, text, integer) to authenticated;

-- Novo percentual: vale só para pagamentos confirmados DEPOIS (IM-069, IM-073). Nada é recalculado. Igual ao atual: sem efeito.
create function public.comissoes_alterar_percentual_oferta(p_oferta uuid, p_percentual_bp integer) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_perfil uuid;
  v_uid uuid;
  v_id bigint;
begin
  select o.perfil_id into v_perfil from public.comissoes_oferta o where o.id = p_oferta;
  v_uid := public.comissoes_exigir_responsavel(v_perfil);
  if not public.comissoes_modulo_ativo(v_perfil) then
    raise exception 'módulo de comissões não habilitado para este negócio' using errcode = 'P0001';
  end if;
  if p_percentual_bp is null or p_percentual_bp < 1 or p_percentual_bp > 10000 then
    raise exception 'percentual fora da faixa' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('comissoes_oferta:' || p_oferta::text, 0));
  if public.comissoes_percentual_vigente(p_oferta) = p_percentual_bp then
    return null;
  end if;
  insert into public.comissoes_oferta_percentual (oferta_id, percentual_bp, autor_id)
  values (p_oferta, p_percentual_bp, v_uid)
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.comissoes_alterar_percentual_oferta(uuid, integer) from public, anon;
grant execute on function public.comissoes_alterar_percentual_oferta(uuid, integer) to authenticated;

-- Ativar/inativar a oferta. Inativar é sempre permitido ao responsável; ativar exige o módulo habilitado. Sem mudança: null.
create function public.comissoes_definir_oferta_ativa(p_oferta uuid, p_ativa boolean) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_perfil uuid;
  v_uid uuid;
  v_id bigint;
begin
  select o.perfil_id into v_perfil from public.comissoes_oferta o where o.id = p_oferta;
  v_uid := public.comissoes_exigir_responsavel(v_perfil);
  if p_ativa is null then
    raise exception 'estado obrigatório' using errcode = '22023';
  end if;
  if p_ativa and not public.comissoes_modulo_ativo(v_perfil) then
    raise exception 'módulo de comissões não habilitado para este negócio' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('comissoes_oferta:' || p_oferta::text, 0));
  if public.comissoes_oferta_ativa(p_oferta) = p_ativa then
    return null;
  end if;
  insert into public.comissoes_oferta_estado (oferta_id, ativa, autor_id) values (p_oferta, p_ativa, v_uid)
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.comissoes_definir_oferta_ativa(uuid, boolean) from public, anon;
grant execute on function public.comissoes_definir_oferta_ativa(uuid, boolean) to authenticated;
