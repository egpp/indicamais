-- Fase 4 · módulo pontos · modelo de dados, regra de crédito e parâmetros · IM-025, IM-028, IM-030, IM-032, IM-033,
-- IM-034, IM-035, IM-065, IM-078, IM-079, IM-086, D-012
--
-- DESENHO
--   pontos_parametro    pontos_por_indicacao (padrão 10, faixa 1-1000) e intervalo_dias (padrão 30, faixa 1-365).
--                       Só pontos_definir_parametro() altera (administrador, motivo obrigatório, auditoria). Comissões
--                       (Fase 7) terão parâmetros e tabelas próprios: nada aqui é compartilhado (IM-065).
--   pontos_decisao      UMA linha por pedido de contato: pontuou ou não e por quê (sem_atribuicao, autoindicacao,
--                       destino_indisponivel, dentro_do_intervalo, pontuado). Só inserção. Guarda o parâmetro aplicado
--                       e a chave de duplicidade como hash (o WhatsApp do visitante não é copiado para cá).
--   pontos_lancamento   histórico do saldo do indicador: credito (pontos > 0) e reversao (pontos < 0, aponta o
--                       crédito original). Só inserção, inclusive para service_role. O saldo é a SOMA (derivada).
--   pontos_falha        falha ao avaliar/creditar um pedido (IM-028). O pedido é preservado; a falha fica registrada
--                       para reprocessamento e alerta. Só inserção; pendente = falha sem decisão do pedido.
--
-- REGRAS
--   * Gatilho AFTER INSERT em indicacoes_pedido_contato: vale para qualquer caminho que crie pedido. O trabalho roda num
--     sub-bloco com tratamento de exceção: se falhar, o pedido PERMANECE e a falha é registrada (IM-028).
--   * Idempotência: pedido_id é único em pontos_decisao e em pontos_lancamento (crédito). Repetir a chave do pedido nem
--     chega a criar pedido novo (indicacoes_enviar_contato devolve o existente).
--   * Duplicidade (IM-032): WhatsApp do visitante + perfil comercial do destino (perfil, ou item de perfil); anúncio
--     particular = WhatsApp + conta anunciante. Independe do item.
--   * Intervalo (IM-033): contado desde o ÚLTIMO PEDIDO PONTUADO da chave. Dentro dele o contato é permitido, não pontua,
--     não reinicia o prazo e não altera a atribuição (a decisão original não é tocada). Exatamente intervalo_dias depois
--     do pontuado, pontua de novo.
--   * Concorrência: bloqueio consultivo por chave de duplicidade (pg_advisory_xact_lock) + decisão única por pedido.
--   * Reversão não reabre o intervalo: o pedido continua sendo "o último pontuado" da chave (decisão do gestor, ver
--     dúvidas no relatório).
--   * Privacidade (IM-029, IM-041): nenhum papel de API tem privilégio de tabela aqui (exceto leitura do parâmetro, restrita
--     ao administrador por política). A leitura é por visões e funções definer (migração 20261031120000).

-- Parâmetros centrais -------------------------------------------------------------------------------------------
create table public.pontos_parametro (
  chave text primary key,
  valor integer not null,
  minimo integer not null,
  maximo integer not null,
  descricao text not null,
  atualizado_em timestamptz not null default now(),
  constraint pontos_parametro_chave check (char_length(chave) between 1 and 80),
  constraint pontos_parametro_faixa check (minimo <= maximo and valor between minimo and maximo)
);
comment on table public.pontos_parametro is 'Parâmetros centrais do módulo pontos (IM-030, D-012). Alterados só por pontos_definir_parametro() (auditado).';

insert into public.pontos_parametro (chave, valor, minimo, maximo, descricao) values
  ('pontos_por_indicacao', 10, 1, 1000, 'Pontos creditados ao indicador por indicação válida (D-012).'),
  ('intervalo_dias', 30, 1, 365, 'Dias entre pontuações do mesmo visitante (WhatsApp) no mesmo destino, contados do último pedido pontuado (D-012).');

-- Decisão de pontuação, uma por pedido (só inserção) ---------------------------------------------------------------
create table public.pontos_decisao (
  id bigint generated always as identity primary key,
  pedido_id uuid not null references public.indicacoes_pedido_contato (id) on delete restrict,
  pedido_criado_em timestamptz not null,
  chave_hash text not null,
  destino_ref_tipo text not null,
  destino_ref_id uuid not null,
  link_id uuid references public.indicacoes_link (id) on delete restrict,
  indicador_id uuid references public.contas_conta (id) on delete restrict,
  pontuado boolean not null,
  motivo text not null,
  pontos integer not null default 0,
  intervalo_dias integer not null,
  decidido_em timestamptz not null default now(),
  constraint pontos_decisao_pedido_unico unique (pedido_id),
  constraint pontos_decisao_chave check (chave_hash ~ '^[0-9a-f]{64}$'),
  constraint pontos_decisao_ref_tipo check (destino_ref_tipo in ('perfil', 'conta')),
  constraint pontos_decisao_motivo check (motivo in ('pontuado', 'sem_atribuicao', 'autoindicacao', 'destino_indisponivel', 'dentro_do_intervalo')),
  constraint pontos_decisao_coerente check (
    (pontuado = (motivo = 'pontuado'))
    and ((pontuado and pontos between 1 and 1000) or (not pontuado and pontos = 0))
    and ((motivo = 'sem_atribuicao') = (link_id is null))
    and (link_id is null or indicador_id is not null)
    and intervalo_dias between 1 and 365)
);
create index pontos_decisao_chave_idx on public.pontos_decisao (chave_hash, pedido_criado_em desc) where pontuado;
create index pontos_decisao_indicador_idx on public.pontos_decisao (indicador_id, decidido_em desc) where indicador_id is not null;
comment on table public.pontos_decisao is 'Uma linha por pedido: pontuou ou não e o motivo (auditoria e Fase 6). Só inserção. chave_hash = sha256(WhatsApp do visitante + destino), sem o número.';

-- Lançamentos (só inserção) -----------------------------------------------------------------------------------------
create table public.pontos_lancamento (
  id uuid primary key default gen_random_uuid(),
  indicador_id uuid not null references public.contas_conta (id) on delete restrict,
  tipo text not null,
  pontos integer not null,
  pedido_id uuid references public.indicacoes_pedido_contato (id) on delete restrict,
  original_id uuid,
  destino_perfil_id uuid references public.perfis_perfil (id) on delete restrict,
  destino_item_id uuid references public.catalogo_item (id) on delete restrict,
  destino_nome text not null,
  motivo text,
  autor_id uuid references public.contas_conta (id) on delete restrict,
  confirmou_saldo_negativo boolean not null default false,
  criado_em timestamptz not null default now(),
  constraint pontos_lancamento_id_indicador_unico unique (id, indicador_id),
  constraint pontos_lancamento_tipo check (tipo in ('credito', 'reversao')),
  constraint pontos_lancamento_um_destino check ((destino_perfil_id is null) <> (destino_item_id is null)),
  constraint pontos_lancamento_nome check (char_length(btrim(destino_nome)) between 1 and 100),
  constraint pontos_lancamento_credito check (
    tipo <> 'credito' or (pontos between 1 and 1000 and pedido_id is not null and original_id is null
      and motivo is null and autor_id is null and not confirmou_saldo_negativo)),
  constraint pontos_lancamento_reversao check (
    tipo <> 'reversao' or (pontos between -1000 and -1 and pedido_id is null and original_id is not null
      and autor_id is not null and motivo is not null and char_length(btrim(motivo)) between 1 and 500)),
  -- a reversão é do mesmo indicador do crédito original
  constraint pontos_lancamento_original_fk foreign key (original_id, indicador_id)
    references public.pontos_lancamento (id, indicador_id) on delete restrict
);
-- IM-028: um crédito por pedido. IM-078: um crédito só é revertido uma vez.
create unique index pontos_lancamento_pedido_unico on public.pontos_lancamento (pedido_id) where pedido_id is not null;
create unique index pontos_lancamento_reversao_unica on public.pontos_lancamento (original_id) where original_id is not null;
create index pontos_lancamento_indicador_idx on public.pontos_lancamento (indicador_id, criado_em desc);
comment on table public.pontos_lancamento is 'Histórico de pontos. Só inserção; reversão é novo lançamento negativo que aponta o original (IM-078). Saldo = soma.';

-- Falhas de crédito (só inserção) ----------------------------------------------------------------------------------
create table public.pontos_falha (
  id bigint generated always as identity primary key,
  pedido_id uuid not null references public.indicacoes_pedido_contato (id) on delete restrict,
  erro text not null,
  criado_em timestamptz not null default now(),
  constraint pontos_falha_erro check (char_length(erro) <= 200)
);
create index pontos_falha_pedido_idx on public.pontos_falha (pedido_id, criado_em desc);
comment on table public.pontos_falha is 'Falha ao avaliar/creditar um pedido (IM-028). O pedido foi preservado. Pendente = pedido sem pontos_decisao.';

-- Privilégios -----------------------------------------------------------------------------------------------------
revoke all on public.pontos_parametro from anon, authenticated;
revoke all on public.pontos_decisao from anon, authenticated;
revoke all on public.pontos_lancamento from anon, authenticated;
revoke all on public.pontos_falha from anon, authenticated;
grant select on public.pontos_parametro to authenticated; -- só o administrador passa pela política

alter table public.pontos_parametro enable row level security;
alter table public.pontos_parametro force row level security;
alter table public.pontos_decisao enable row level security;
alter table public.pontos_decisao force row level security;
alter table public.pontos_lancamento enable row level security;
alter table public.pontos_lancamento force row level security;
alter table public.pontos_falha enable row level security;
alter table public.pontos_falha force row level security;

-- Políticas --------------------------------------------------------------------------------------------------------
-- Escrita sempre negada ao cliente: só funções do banco escrevem. Leitura de decisão, lançamento e falha é do
-- administrador por política; sem privilégio de tabela, o cliente lê apenas pelas visões definer.
create policy pontos_parametro_select_admin on public.pontos_parametro
  for select to authenticated using ((select public.administracao_eh_admin()));
create policy pontos_parametro_insert_negado on public.pontos_parametro
  for insert to authenticated with check (false);
create policy pontos_parametro_update_negado on public.pontos_parametro
  for update to authenticated using (false) with check (false);
create policy pontos_parametro_delete_negado on public.pontos_parametro
  for delete to authenticated using (false);

create policy pontos_decisao_select_admin on public.pontos_decisao
  for select to authenticated using ((select public.administracao_eh_admin()));
create policy pontos_decisao_insert_negado on public.pontos_decisao
  for insert to authenticated with check (false);
create policy pontos_decisao_update_negado on public.pontos_decisao
  for update to authenticated using (false) with check (false);
create policy pontos_decisao_delete_negado on public.pontos_decisao
  for delete to authenticated using (false);

create policy pontos_lancamento_select_admin on public.pontos_lancamento
  for select to authenticated using ((select public.administracao_eh_admin()));
create policy pontos_lancamento_insert_negado on public.pontos_lancamento
  for insert to authenticated with check (false);
create policy pontos_lancamento_update_negado on public.pontos_lancamento
  for update to authenticated using (false) with check (false);
create policy pontos_lancamento_delete_negado on public.pontos_lancamento
  for delete to authenticated using (false);

create policy pontos_falha_select_admin on public.pontos_falha
  for select to authenticated using ((select public.administracao_eh_admin()));
create policy pontos_falha_insert_negado on public.pontos_falha
  for insert to authenticated with check (false);
create policy pontos_falha_update_negado on public.pontos_falha
  for update to authenticated using (false) with check (false);
create policy pontos_falha_delete_negado on public.pontos_falha
  for delete to authenticated using (false);

-- Gatilhos: histórico só de inserção (vale para service_role e donos) -----------------------------------------------
create trigger pontos_decisao_imutavel before update or delete on public.pontos_decisao
  for each row execute function public.administracao_registro_imutavel();
create trigger pontos_lancamento_imutavel before update or delete on public.pontos_lancamento
  for each row execute function public.administracao_registro_imutavel();
create trigger pontos_falha_imutavel before update or delete on public.pontos_falha
  for each row execute function public.administracao_registro_imutavel();

-- Parâmetro: chave e faixa não mudam; só o valor.
create function public.pontos_parametro_proteger() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'parâmetro não é apagado' using errcode = '42501';
  end if;
  if new.chave <> old.chave or new.minimo <> old.minimo or new.maximo <> old.maximo then
    raise exception 'chave e faixa do parâmetro são imutáveis' using errcode = '42501';
  end if;
  new.atualizado_em := now();
  return new;
end $$;
revoke all on function public.pontos_parametro_proteger() from public, anon, authenticated;
create trigger pontos_parametro_proteger before update or delete on public.pontos_parametro
  for each row execute function public.pontos_parametro_proteger();

-- Reversão: valida contra o crédito original (defesa em profundidade, vale para qualquer papel).
create function public.pontos_lancamento_validar() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  o public.pontos_lancamento%rowtype;
begin
  if new.tipo = 'reversao' then
    select * into o from public.pontos_lancamento where id = new.original_id;
    if not found or o.tipo <> 'credito' then
      raise exception 'a reversão aponta um crédito' using errcode = '23514';
    end if;
    if new.pontos <> -o.pontos
       or new.destino_perfil_id is distinct from o.destino_perfil_id
       or new.destino_item_id is distinct from o.destino_item_id
       or new.destino_nome <> o.destino_nome then
      raise exception 'a reversão repete pontos (com sinal contrário) e destino do crédito original' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.pontos_lancamento_validar() from public, anon, authenticated;
create trigger pontos_lancamento_validar before insert on public.pontos_lancamento
  for each row execute function public.pontos_lancamento_validar();

-- Funções internas -------------------------------------------------------------------------------------------------
create function public.pontos_parametro_valor(p_chave text) returns integer
language sql stable security definer set search_path = '' as $$
  select valor from public.pontos_parametro where chave = p_chave;
$$;
revoke all on function public.pontos_parametro_valor(text) from public, anon, authenticated;

-- Avalia UM pedido: grava a decisão e, se pontuou, o crédito. Idempotente (decisão única por pedido). Devolve o id da
-- decisão. Erros propagam (o gatilho os captura; o reprocessamento os devolve).
create function public.pontos_avaliar_pedido(p_pedido_id uuid) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_p public.indicacoes_pedido_contato%rowtype;
  v_decisao bigint;
  v_indicador uuid;
  v_disp boolean;
  v_dono uuid;
  v_nome text;
  v_ref_tipo text;
  v_ref_id uuid;
  v_item_perfil uuid;
  v_item_conta uuid;
  v_chave text;
  v_pts integer;
  v_iv integer;
  v_motivo text;
begin
  select * into v_p from public.indicacoes_pedido_contato where id = p_pedido_id;
  if not found then
    raise exception 'pedido não encontrado' using errcode = 'P0002';
  end if;
  select d.id into v_decisao from public.pontos_decisao d where d.pedido_id = p_pedido_id;
  if found then
    return v_decisao;
  end if;

  -- Destino (IM-032): perfil comercial; item de perfil conta como o perfil; anúncio particular conta como a conta.
  select r.o_disponivel, r.o_dono_id, r.o_nome into v_disp, v_dono, v_nome
  from public.indicacoes_resolver_destino(v_p.perfil_id, v_p.item_id) r;
  if v_p.perfil_id is not null then
    v_ref_tipo := 'perfil';
    v_ref_id := v_p.perfil_id;
  else
    select i.perfil_id, i.conta_id into v_item_perfil, v_item_conta from public.catalogo_item i where i.id = v_p.item_id;
    if v_item_perfil is not null then
      v_ref_tipo := 'perfil';
      v_ref_id := v_item_perfil;
    else
      v_ref_tipo := 'conta';
      v_ref_id := v_item_conta;
    end if;
  end if;
  v_chave := encode(sha256(convert_to(
    'indicamais:pontos:' || v_p.whatsapp_e164 || '|' || v_ref_tipo || ':' || v_ref_id::text, 'UTF8')), 'hex');

  if v_p.link_id is not null then
    select l.indicador_id into v_indicador from public.indicacoes_link l where l.id = v_p.link_id;
  end if;

  -- Concorrência: um só crédito por janela da mesma chave.
  perform pg_advisory_xact_lock(hashtextextended('pontos_chave:' || v_chave, 0));
  select d.id into v_decisao from public.pontos_decisao d where d.pedido_id = p_pedido_id;
  if found then
    return v_decisao;
  end if;

  v_pts := public.pontos_parametro_valor('pontos_por_indicacao');
  v_iv := public.pontos_parametro_valor('intervalo_dias');

  if v_p.link_id is null then
    v_motivo := 'sem_atribuicao';
  elsif v_p.autoindicacao_suspeita or v_indicador is not distinct from v_dono
        or v_indicador is not distinct from v_item_conta
        or v_indicador is not distinct from v_p.solicitante_id then
    v_motivo := 'autoindicacao';
  elsif not coalesce(v_disp, false) then
    v_motivo := 'destino_indisponivel';
  elsif exists (
    select 1 from public.pontos_decisao d
    where d.chave_hash = v_chave and d.pontuado
      and d.pedido_criado_em > v_p.criado_em - v_iv * interval '24 hours'
      and d.pedido_criado_em < v_p.criado_em + v_iv * interval '24 hours'
  ) then
    v_motivo := 'dentro_do_intervalo';
  else
    v_motivo := 'pontuado';
  end if;

  insert into public.pontos_decisao
    (pedido_id, pedido_criado_em, chave_hash, destino_ref_tipo, destino_ref_id, link_id, indicador_id,
     pontuado, motivo, pontos, intervalo_dias)
  values (p_pedido_id, v_p.criado_em, v_chave, v_ref_tipo, v_ref_id, v_p.link_id, v_indicador,
          v_motivo = 'pontuado', v_motivo, case when v_motivo = 'pontuado' then v_pts else 0 end, v_iv)
  returning id into v_decisao;

  if v_motivo = 'pontuado' then
    insert into public.pontos_lancamento
      (indicador_id, tipo, pontos, pedido_id, destino_perfil_id, destino_item_id, destino_nome)
    values (v_indicador, 'credito', v_pts, p_pedido_id, v_p.perfil_id, v_p.item_id,
            coalesce(nullif(btrim(left(v_nome, 100)), ''), 'Destino'));
  end if;
  return v_decisao;
end $$;
revoke all on function public.pontos_avaliar_pedido(uuid) from public, anon, authenticated;

-- Gatilho: nunca impede o pedido (IM-028). Falha => registro em pontos_falha para reprocessar.
create function public.pontos_pedido_pontuar() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  begin
    perform public.pontos_avaliar_pedido(new.id);
  exception when others then
    begin
      insert into public.pontos_falha (pedido_id, erro) values (new.id, left(sqlstate || ': ' || sqlerrm, 200));
    exception when others then
      raise warning 'pontos: não foi possível registrar a falha do pedido %', new.id;
    end;
  end;
  return null;
end $$;
revoke all on function public.pontos_pedido_pontuar() from public, anon, authenticated;
create trigger pontos_pedido_pontuar after insert on public.indicacoes_pedido_contato
  for each row execute function public.pontos_pedido_pontuar();

-- Parâmetros: alteração pelo administrador (motivo obrigatório; auditoria com valor anterior e novo) ----------------
-- Erros: 42501 não administrador; 22023 motivo/valor inválido ou fora da faixa; P0002 parâmetro inexistente.
create function public.pontos_definir_parametro(p_chave text, p_valor integer, p_motivo text) returns void
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
  from public.pontos_parametro pa where pa.chave = p_chave for update;
  if not found then
    raise exception 'parâmetro não encontrado' using errcode = 'P0002';
  end if;
  if p_valor < v_min or p_valor > v_max then
    raise exception 'valor fora da faixa permitida (% a %)', v_min, v_max using errcode = '22023';
  end if;
  update public.pontos_parametro set valor = p_valor where chave = p_chave;
  insert into public.administracao_auditoria (autor_id, acao, alvo_tabela, alvo_id, motivo, valor_anterior, valor_novo)
  values (v_admin, 'definir_parametro_pontos', 'pontos_parametro', p_chave, v_motivo,
          jsonb_build_object('valor', v_anterior), jsonb_build_object('valor', p_valor));
end $$;
revoke all on function public.pontos_definir_parametro(text, integer, text) from public, anon;
grant execute on function public.pontos_definir_parametro(text, integer, text) to authenticated;

-- Parâmetros vigentes para a regra de negócio e a interface (sem segredo; só quem está logado).
create function public.pontos_parametros_atuais() returns table (o_pontos_por_indicacao integer, o_intervalo_dias integer)
language sql stable security definer set search_path = '' as $$
  select public.pontos_parametro_valor('pontos_por_indicacao'), public.pontos_parametro_valor('intervalo_dias')
  where (select auth.uid()) is not null;
$$;
revoke all on function public.pontos_parametros_atuais() from public, anon;
grant execute on function public.pontos_parametros_atuais() to authenticated;
