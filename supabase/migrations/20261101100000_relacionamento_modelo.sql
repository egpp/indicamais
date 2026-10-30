-- Fase 5 · módulo relacionamento · Base de Relacionamento por perfil · IM-039, IM-040, IM-041, IM-042, IM-043, IM-044,
-- IM-045, IM-051, IM-086, D-013
--
-- DESENHO
--   relacionamento_membro           UMA linha por (perfil, pessoa): deduplicada (IM-040). Registra curtida e/ou indicação,
--                                   datas e contagem de indicações válidas. Estado mutável SÓ por funções do banco. A mesma
--                                   pessoa pode estar em bases de perfis distintos. Ninguém lê conta_id: a empresa lê pela
--                                   visão relacionamento_meus_membros (migração seguinte).
--   relacionamento_saida            quem saiu da base de um perfil (IM-045). Impede reentrada AUTOMÁTICA por indicação; só uma
--                                   nova curtida (ato explícito da própria pessoa) remove a marca.
--   relacionamento_evento           histórico AGREGADO e ANÔNIMO por perfil (curtida, descurtida, indicacao_valida, saida):
--                                   não tem coluna de pessoa, então sobrevive à saída sem identificar ninguém. Só inserção.
--   relacionamento_entrada_decisao  uma linha por pedido de contato: o contato foi VÁLIDO para a base? (IM-044, D-013). Só
--                                   inserção. Critério igual ao dos pontos, SEM o intervalo de 30 dias: link do destino,
--                                   destino disponível, sem autoindicação. Não lê nem altera nada do módulo pontos.
--   relacionamento_falha            falha ao avaliar um pedido; o pedido é preservado (IM-028). Só inserção.
--
-- REGRAS
--   * Curtir (IM-043): só autenticado; 1 por conta e perfil (unique); desfazer a qualquer momento; idempotente. Não pontua nem
--     gera comissão (IM-042): nenhuma função aqui toca pontos ou comissões.
--   * Entrada por indicação (IM-044): SÓ por contato válido pelo link, no gatilho AFTER INSERT do pedido (qualquer caminho
--     que crie pedido). Gerar link e compartilhar não entram. Falha vai para relacionamento_falha e NUNCA impede o pedido.
--   * Saída (IM-045): descurtir remove só a curtida (a pessoa fica se tem indicação). relacionamento_sair_da_base() remove da
--     base, marca a saída e, como os avisos são derivados (migração de notificações), encerra os avisos dela e anonimiza o
--     nome dela nos avisos da empresa. O histórico agregado permanece.
--   * Privacidade (IM-041, IM-086): nenhum papel de API tem privilégio de tabela aqui; conta_id nunca é legível. Telefone,
--     e-mail e nome completo não existem neste módulo.

-- Tabelas ---------------------------------------------------------------------------------------------------------
create table public.relacionamento_membro (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references public.perfis_perfil (id) on delete restrict,
  conta_id uuid not null references public.contas_conta (id) on delete restrict,
  curtida_em timestamptz,
  primeira_indicacao_em timestamptz,
  ultima_indicacao_em timestamptz,
  indicacoes_validas integer not null default 0,
  entrou_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  -- IM-040: uma pessoa por perfil.
  constraint relacionamento_membro_unico unique (perfil_id, conta_id),
  constraint relacionamento_membro_contagem check (indicacoes_validas >= 0),
  -- Quem está na base curtiu, indicou ou ambos.
  constraint relacionamento_membro_vinculo check (curtida_em is not null or indicacoes_validas > 0),
  constraint relacionamento_membro_datas check (
    (indicacoes_validas > 0) = (primeira_indicacao_em is not null)
    and (indicacoes_validas > 0) = (ultima_indicacao_em is not null))
);
create index relacionamento_membro_conta_idx on public.relacionamento_membro (conta_id);
comment on table public.relacionamento_membro is 'Base de Relacionamento por perfil (IM-039/IM-040). conta_id nunca é legível por papel de API.';

create table public.relacionamento_saida (
  perfil_id uuid not null references public.perfis_perfil (id) on delete restrict,
  conta_id uuid not null references public.contas_conta (id) on delete restrict,
  saiu_em timestamptz not null default now(),
  primary key (perfil_id, conta_id)
);
comment on table public.relacionamento_saida is 'Quem saiu da base do perfil (IM-045): bloqueia reentrada automática por indicação e novos avisos.';

create table public.relacionamento_evento (
  id bigint generated always as identity primary key,
  perfil_id uuid not null references public.perfis_perfil (id) on delete restrict,
  tipo text not null,
  criado_em timestamptz not null default now(),
  constraint relacionamento_evento_tipo check (tipo in ('curtida', 'descurtida', 'indicacao_valida', 'saida'))
);
create index relacionamento_evento_perfil_idx on public.relacionamento_evento (perfil_id, tipo, criado_em desc);
comment on table public.relacionamento_evento is 'Histórico agregado e anônimo por perfil: sem coluna de pessoa de propósito (IM-045). Só inserção.';

create table public.relacionamento_entrada_decisao (
  id bigint generated always as identity primary key,
  pedido_id uuid not null references public.indicacoes_pedido_contato (id) on delete restrict,
  base_perfil_id uuid references public.perfis_perfil (id) on delete restrict,
  valido boolean not null,
  motivo text not null,
  incluido_na_base boolean not null default false,
  decidido_em timestamptz not null default now(),
  constraint relacionamento_decisao_pedido_unico unique (pedido_id),
  constraint relacionamento_decisao_motivo check (motivo in ('valido', 'sem_atribuicao', 'autoindicacao', 'destino_indisponivel')),
  constraint relacionamento_decisao_coerente check (
    (valido = (motivo = 'valido'))
    and (not incluido_na_base or (valido and base_perfil_id is not null)))
);
create index relacionamento_decisao_base_idx on public.relacionamento_entrada_decisao (base_perfil_id) where base_perfil_id is not null;
comment on table public.relacionamento_entrada_decisao is 'Uma linha por pedido: contato válido para a base ou não (IM-044). Sem identificar pessoa: o indicador vem do link. Só inserção.';

create table public.relacionamento_falha (
  id bigint generated always as identity primary key,
  pedido_id uuid not null references public.indicacoes_pedido_contato (id) on delete restrict,
  erro text not null,
  criado_em timestamptz not null default now(),
  constraint relacionamento_falha_erro check (char_length(erro) <= 200)
);
create index relacionamento_falha_pedido_idx on public.relacionamento_falha (pedido_id, criado_em desc);

-- Privilégios e RLS -----------------------------------------------------------------------------------------------
revoke all on public.relacionamento_membro from anon, authenticated;
revoke all on public.relacionamento_saida from anon, authenticated;
revoke all on public.relacionamento_evento from anon, authenticated;
revoke all on public.relacionamento_entrada_decisao from anon, authenticated;
revoke all on public.relacionamento_falha from anon, authenticated;

alter table public.relacionamento_membro enable row level security;
alter table public.relacionamento_membro force row level security;
alter table public.relacionamento_saida enable row level security;
alter table public.relacionamento_saida force row level security;
alter table public.relacionamento_evento enable row level security;
alter table public.relacionamento_evento force row level security;
alter table public.relacionamento_entrada_decisao enable row level security;
alter table public.relacionamento_entrada_decisao force row level security;
alter table public.relacionamento_falha enable row level security;
alter table public.relacionamento_falha force row level security;

-- Escrita sempre negada ao cliente (só funções do banco escrevem). Leitura por política só do administrador, e sem
-- privilégio de tabela o cliente lê apenas pelas visões definer.
create policy relacionamento_membro_select_admin on public.relacionamento_membro
  for select to authenticated using ((select public.administracao_eh_admin()));
create policy relacionamento_membro_insert_negado on public.relacionamento_membro
  for insert to authenticated with check (false);
create policy relacionamento_membro_update_negado on public.relacionamento_membro
  for update to authenticated using (false) with check (false);
create policy relacionamento_membro_delete_negado on public.relacionamento_membro
  for delete to authenticated using (false);

create policy relacionamento_saida_select_admin on public.relacionamento_saida
  for select to authenticated using ((select public.administracao_eh_admin()));
create policy relacionamento_saida_insert_negado on public.relacionamento_saida
  for insert to authenticated with check (false);
create policy relacionamento_saida_update_negado on public.relacionamento_saida
  for update to authenticated using (false) with check (false);
create policy relacionamento_saida_delete_negado on public.relacionamento_saida
  for delete to authenticated using (false);

create policy relacionamento_evento_select_admin on public.relacionamento_evento
  for select to authenticated using ((select public.administracao_eh_admin()));
create policy relacionamento_evento_insert_negado on public.relacionamento_evento
  for insert to authenticated with check (false);
create policy relacionamento_evento_update_negado on public.relacionamento_evento
  for update to authenticated using (false) with check (false);
create policy relacionamento_evento_delete_negado on public.relacionamento_evento
  for delete to authenticated using (false);

create policy relacionamento_decisao_select_admin on public.relacionamento_entrada_decisao
  for select to authenticated using ((select public.administracao_eh_admin()));
create policy relacionamento_decisao_insert_negado on public.relacionamento_entrada_decisao
  for insert to authenticated with check (false);
create policy relacionamento_decisao_update_negado on public.relacionamento_entrada_decisao
  for update to authenticated using (false) with check (false);
create policy relacionamento_decisao_delete_negado on public.relacionamento_entrada_decisao
  for delete to authenticated using (false);

create policy relacionamento_falha_select_admin on public.relacionamento_falha
  for select to authenticated using ((select public.administracao_eh_admin()));
create policy relacionamento_falha_insert_negado on public.relacionamento_falha
  for insert to authenticated with check (false);
create policy relacionamento_falha_update_negado on public.relacionamento_falha
  for update to authenticated using (false) with check (false);
create policy relacionamento_falha_delete_negado on public.relacionamento_falha
  for delete to authenticated using (false);

-- Gatilhos: histórico só de inserção (vale para service_role e donos) ------------------------------------------------
create trigger relacionamento_evento_imutavel before update or delete on public.relacionamento_evento
  for each row execute function public.administracao_registro_imutavel();
create trigger relacionamento_decisao_imutavel before update or delete on public.relacionamento_entrada_decisao
  for each row execute function public.administracao_registro_imutavel();
create trigger relacionamento_falha_imutavel before update or delete on public.relacionamento_falha
  for each row execute function public.administracao_registro_imutavel();

-- Membro: perfil, pessoa e data de entrada não mudam.
create function public.relacionamento_membro_proteger() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.id <> old.id or new.perfil_id <> old.perfil_id or new.conta_id <> old.conta_id or new.entrou_em <> old.entrou_em then
    raise exception 'identidade do membro é imutável' using errcode = '42501';
  end if;
  new.atualizado_em := now();
  return new;
end $$;
revoke all on function public.relacionamento_membro_proteger() from public, anon, authenticated;
create trigger relacionamento_membro_proteger before update on public.relacionamento_membro
  for each row execute function public.relacionamento_membro_proteger();

-- Nome público (IM-041, IM-050) -------------------------------------------------------------------------------------
-- O que a empresa e os avisos mostram de uma pessoa: primeiro nome + inicial do último sobrenome ("Maria S."), a partir
-- do nome de exibição da conta. Nunca nome completo, e-mail nem telefone. Sem nome: "Pessoa". Uso interno (visões).
create function public.relacionamento_nome_publico(p_conta uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  v_nome text;
  v_partes text[];
begin
  select c.nome_exibicao into v_nome from public.contas_conta c where c.id = p_conta;
  v_nome := btrim(regexp_replace(coalesce(v_nome, ''), '[[:space:]]+', ' ', 'g'));
  if v_nome = '' then
    return 'Pessoa';
  end if;
  v_partes := string_to_array(v_nome, ' ');
  if array_length(v_partes, 1) = 1 then
    return left(v_partes[1], 30);
  end if;
  return left(v_partes[1], 30) || ' ' || upper(left(v_partes[array_length(v_partes, 1)], 1)) || '.';
end $$;
revoke all on function public.relacionamento_nome_publico(uuid) from public, anon, authenticated;

-- Curtir (IM-043) ---------------------------------------------------------------------------------------------------
-- CÓDIGOS DE ERRO (SQLSTATE): 42501 não autenticado; 22023 parâmetro inválido; P0002 perfil inexistente ou indisponível;
-- P0403 o responsável não curte o próprio perfil.
-- Devolve true se a curtida foi criada agora; false se já existia (idempotente). Quem tinha saído da base e curte de novo
-- volta por ato próprio. Sem pontos, sem comissão (IM-042).
create function public.relacionamento_curtir(p_perfil_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_dono uuid;
  v_curtida timestamptz;
begin
  if v_uid is null then
    raise exception 'não autenticado' using errcode = '42501';
  end if;
  if p_perfil_id is null then
    raise exception 'informe o perfil' using errcode = '22023';
  end if;
  select p.responsavel_id into v_dono from public.perfis_perfil p where p.id = p_perfil_id;
  if not found or not public.perfis_perfil_disponivel(p_perfil_id) then
    raise exception 'perfil indisponível' using errcode = 'P0002';
  end if;
  if v_dono = v_uid then
    raise exception 'o responsável não curte o próprio perfil' using errcode = 'P0403';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('relacionamento_membro:' || p_perfil_id::text || ':' || v_uid::text, 0));
  select m.curtida_em into v_curtida from public.relacionamento_membro m
  where m.perfil_id = p_perfil_id and m.conta_id = v_uid;
  if found and v_curtida is not null then
    return false;
  end if;

  delete from public.relacionamento_saida s where s.perfil_id = p_perfil_id and s.conta_id = v_uid;
  insert into public.relacionamento_membro (perfil_id, conta_id, curtida_em)
  values (p_perfil_id, v_uid, now())
  on conflict (perfil_id, conta_id) do update set curtida_em = excluded.curtida_em;
  insert into public.relacionamento_evento (perfil_id, tipo) values (p_perfil_id, 'curtida');
  return true;
end $$;

-- Descurtir: remove só a curtida. Se a pessoa não tem indicação válida, sai da base junto (a linha some); se tem, fica.
-- Idempotente: devolve false quando não havia curtida. Não exige perfil disponível (desfazer é sempre possível).
create function public.relacionamento_descurtir(p_perfil_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_curtida timestamptz;
  v_indicacoes integer;
begin
  if v_uid is null then
    raise exception 'não autenticado' using errcode = '42501';
  end if;
  if p_perfil_id is null then
    raise exception 'informe o perfil' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('relacionamento_membro:' || p_perfil_id::text || ':' || v_uid::text, 0));
  select m.curtida_em, m.indicacoes_validas into v_curtida, v_indicacoes
  from public.relacionamento_membro m where m.perfil_id = p_perfil_id and m.conta_id = v_uid for update;
  if not found or v_curtida is null then
    return false;
  end if;
  if v_indicacoes = 0 then
    delete from public.relacionamento_membro m where m.perfil_id = p_perfil_id and m.conta_id = v_uid;
  else
    update public.relacionamento_membro set curtida_em = null where perfil_id = p_perfil_id and conta_id = v_uid;
  end if;
  insert into public.relacionamento_evento (perfil_id, tipo) values (p_perfil_id, 'descurtida');
  return true;
end $$;

-- Sair da base (IM-045) ---------------------------------------------------------------------------------------------
-- Ação da própria pessoa. Remove da base do perfil, marca a saída (sem reentrada automática, sem novos avisos) e deixa só o
-- histórico agregado e anônimo. Idempotente: false se a pessoa não estava na base.
create function public.relacionamento_sair_da_base(p_perfil_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'não autenticado' using errcode = '42501';
  end if;
  if p_perfil_id is null then
    raise exception 'informe o perfil' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('relacionamento_membro:' || p_perfil_id::text || ':' || v_uid::text, 0));
  delete from public.relacionamento_membro m where m.perfil_id = p_perfil_id and m.conta_id = v_uid;
  if not found then
    return false;
  end if;
  insert into public.relacionamento_saida (perfil_id, conta_id) values (p_perfil_id, v_uid)
  on conflict (perfil_id, conta_id) do nothing;
  insert into public.relacionamento_evento (perfil_id, tipo) values (p_perfil_id, 'saida');
  return true;
end $$;

-- Entrada por indicação (IM-044) ------------------------------------------------------------------------------------
-- Avalia UM pedido: grava a decisão e, se o contato é válido e a pessoa não saiu, inclui/atualiza o membro. Idempotente
-- (decisão única por pedido). Devolve o id da decisão. Erros propagam (o gatilho os captura).
-- Válido = veio por link do MESMO destino, destino disponível agora, sem autoindicação (mesmo critério dos pontos, sem o
-- intervalo de 30 dias). Anúncio particular (sem perfil) é válido para avisos, mas não tem base.
create function public.relacionamento_avaliar_pedido(p_pedido_id uuid) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_p public.indicacoes_pedido_contato%rowtype;
  v_decisao bigint;
  v_indicador uuid;
  v_disp boolean;
  v_dono uuid;
  v_item_perfil uuid;
  v_item_conta uuid;
  v_base uuid;
  v_motivo text;
  v_incluido boolean := false;
begin
  select * into v_p from public.indicacoes_pedido_contato where id = p_pedido_id;
  if not found then
    raise exception 'pedido não encontrado' using errcode = 'P0002';
  end if;
  select d.id into v_decisao from public.relacionamento_entrada_decisao d where d.pedido_id = p_pedido_id;
  if found then
    return v_decisao;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('relacionamento_pedido:' || p_pedido_id::text, 0));
  select d.id into v_decisao from public.relacionamento_entrada_decisao d where d.pedido_id = p_pedido_id;
  if found then
    return v_decisao;
  end if;

  if v_p.link_id is not null then
    select l.indicador_id into v_indicador from public.indicacoes_link l where l.id = v_p.link_id;
  end if;
  select r.o_disponivel, r.o_dono_id into v_disp, v_dono
  from public.indicacoes_resolver_destino(v_p.perfil_id, v_p.item_id) r;
  if v_p.item_id is not null then
    select i.perfil_id, i.conta_id into v_item_perfil, v_item_conta from public.catalogo_item i where i.id = v_p.item_id;
  end if;
  v_base := coalesce(v_p.perfil_id, v_item_perfil);

  if v_p.link_id is null then
    v_motivo := 'sem_atribuicao';
  elsif v_p.autoindicacao_suspeita or v_indicador is not distinct from v_dono
        or v_indicador is not distinct from v_item_conta
        or v_indicador is not distinct from v_p.solicitante_id then
    v_motivo := 'autoindicacao';
  elsif not coalesce(v_disp, false) then
    v_motivo := 'destino_indisponivel';
  else
    v_motivo := 'valido';
  end if;

  if v_motivo = 'valido' and v_base is not null then
    perform pg_advisory_xact_lock(hashtextextended('relacionamento_membro:' || v_base::text || ':' || v_indicador::text, 0));
    if not exists (select 1 from public.relacionamento_saida s where s.perfil_id = v_base and s.conta_id = v_indicador) then
      insert into public.relacionamento_membro as m
        (perfil_id, conta_id, primeira_indicacao_em, ultima_indicacao_em, indicacoes_validas)
      values (v_base, v_indicador, v_p.criado_em, v_p.criado_em, 1)
      on conflict (perfil_id, conta_id) do update
        set indicacoes_validas = m.indicacoes_validas + 1,
            primeira_indicacao_em = least(coalesce(m.primeira_indicacao_em, excluded.primeira_indicacao_em),
                                          excluded.primeira_indicacao_em),
            ultima_indicacao_em = greatest(coalesce(m.ultima_indicacao_em, excluded.ultima_indicacao_em),
                                           excluded.ultima_indicacao_em);
      insert into public.relacionamento_evento (perfil_id, tipo) values (v_base, 'indicacao_valida');
      v_incluido := true;
    end if;
  end if;

  insert into public.relacionamento_entrada_decisao (pedido_id, base_perfil_id, valido, motivo, incluido_na_base)
  values (p_pedido_id, v_base, v_motivo = 'valido', v_motivo, v_incluido)
  returning id into v_decisao;
  return v_decisao;
end $$;
revoke all on function public.relacionamento_avaliar_pedido(uuid) from public, anon, authenticated;

-- Gatilho: nunca impede o pedido (IM-028). Falha => relacionamento_falha para reprocessar.
create function public.relacionamento_pedido_avaliar() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  begin
    perform public.relacionamento_avaliar_pedido(new.id);
  exception when others then
    begin
      insert into public.relacionamento_falha (pedido_id, erro) values (new.id, left(sqlstate || ': ' || sqlerrm, 200));
    exception when others then
      raise warning 'relacionamento: não foi possível registrar a falha do pedido %', new.id;
    end;
  end;
  return null;
end $$;
revoke all on function public.relacionamento_pedido_avaliar() from public, anon, authenticated;
create trigger relacionamento_pedido_avaliar after insert on public.indicacoes_pedido_contato
  for each row execute function public.relacionamento_pedido_avaliar();

-- Servidor (service_role): reprocessa em lote os pedidos com falha e sem decisão. Devolve quantos foram resolvidos.
create function public.relacionamento_reprocessar_pendentes(p_limite integer default 20) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_ok integer := 0;
begin
  for v_id in
    select f.pedido_id
    from public.relacionamento_falha f
    where not exists (select 1 from public.relacionamento_entrada_decisao d where d.pedido_id = f.pedido_id)
    group by f.pedido_id
    order by min(f.criado_em)
    limit least(greatest(coalesce(p_limite, 20), 1), 100)
  loop
    begin
      perform public.relacionamento_avaliar_pedido(v_id);
      v_ok := v_ok + 1;
    exception when others then
      insert into public.relacionamento_falha (pedido_id, erro) values (v_id, left(sqlstate || ': ' || sqlerrm, 200));
    end;
  end loop;
  return v_ok;
end $$;
revoke all on function public.relacionamento_reprocessar_pendentes(integer) from public, anon, authenticated;
grant execute on function public.relacionamento_reprocessar_pendentes(integer) to service_role;

-- Ações da própria pessoa: só authenticated (visitante sem login não curte, D-013).
revoke all on function public.relacionamento_curtir(uuid) from public, anon;
revoke all on function public.relacionamento_descurtir(uuid) from public, anon;
revoke all on function public.relacionamento_sair_da_base(uuid) from public, anon;
grant execute on function public.relacionamento_curtir(uuid) to authenticated;
grant execute on function public.relacionamento_descurtir(uuid) to authenticated;
grant execute on function public.relacionamento_sair_da_base(uuid) to authenticated;
