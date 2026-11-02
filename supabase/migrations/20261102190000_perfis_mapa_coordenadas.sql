-- Fase 8 · módulo perfis · mapa incorporado do OpenStreetMap · IM-018, IM-092, IM-022, IM-012, IM-079, IM-080, IM-086, D-016
--
-- O QUE É
--   A seção "Localização" da página do negócio mostra um mapa do OpenStreetMap (gratuito, sem chave: D-016). O mapa precisa de
--   COORDENADAS do endereço; até aqui havia só texto. A geocodificação (endereço -> latitude/longitude) roda no SERVIDOR da
--   aplicação; o banco só VALIDA e GRAVA o que o responsável (via servidor) manda.
--
-- DECISÕES DE MODELAGEM
--   1. Coordenadas ficam POR VERSÃO, em tabela própria (perfis_perfil_versao_local), e não em colunas da versão nem do perfil:
--        * a versão enviada é imutável (IM-022, gatilho vale até para service_role) e a coordenada é gravada DEPOIS, pelo
--          servidor; uma tabela à parte evita abrir exceção no congelamento do conteúdo;
--        * as coordenadas acompanham o endereço que foi geocodificado: a versão aprovada mantém as dela enquanto a nova edição
--          (rascunho/pendente) tem as suas, e só passam a valer quando a edição é aprovada (mesma regra do restante do conteúdo);
--        * versão nova NÃO herda coordenadas: o mapa some até alguém gravar de novo (nunca aponta para lugar antigo).
--      As linhas de local são apagadas junto com o rascunho que as originou (cascata); não são histórico financeiro nem de pontos.
--   2. "Zerar quando o endereço muda": duas camadas.
--        * gatilho: se endereco, cidade ou uf da versão mudam (só o rascunho muda), a linha de local é apagada (e auditada);
--        * a linha guarda `endereco_ref` (md5 de endereco|cidade|uf normalizados) e a visão pública só usa a coordenada cujo
--          endereco_ref bate com o texto atual da versão aprovada.
--   3. `mostrar_mapa` é preferência do responsável, não conteúdo revisado: fica em perfis_perfil (padrão true), fora do fluxo de
--      versões, como o estilo da página (IM-094). Falso oculta latitude/longitude na leitura pública. As coordenadas só saem
--      se a versão aprovada tem endereço preenchido (endereço é opcional, IM-012).
--   4. Escrita só por RPC (SECURITY DEFINER, search_path vazio): só o responsável do próprio perfil, conta suspensa/anonimizada
--      bloqueada (IM-080), versão em rascunho, pendente ou aprovada com endereço, cidade e UF; tudo auditado com valor anterior.
--
-- PRIVACIDADE (IM-029, IM-041, IM-050, IM-086)
--   Nenhuma coluna de conta/responsável existe na tabela nova nem nas visões. Nenhum dado de visitante ou de contato entra.
--
-- CÓDIGOS DE ERRO (SQLSTATE)
--   42501  não autenticado / conta sem acesso / versão ou perfil que não é do usuário
--   22023  coordenada fora da faixa, origem inválida, versão sem endereço ou fora de situação gravável, mostrar nulo

-- Referência estável do endereço geocodificado (nome em minúsculas, espaços colapsados). Pura; sem dado de conta.
create function public.perfis_endereco_ref(p_endereco text, p_cidade text, p_uf text) returns text
language sql immutable set search_path = '' as $$
  select md5(lower(regexp_replace(btrim(coalesce(p_endereco, '')), '\s+', ' ', 'g')) || '|'
          || lower(regexp_replace(btrim(coalesce(p_cidade, '')), '\s+', ' ', 'g')) || '|'
          || lower(btrim(coalesce(p_uf, ''))));
$$;
revoke all on function public.perfis_endereco_ref(text, text, text) from public;
grant execute on function public.perfis_endereco_ref(text, text, text) to anon, authenticated;

-- Preferência do responsável: exibir o mapa na página pública.
alter table public.perfis_perfil add column mostrar_mapa boolean not null default true;
grant select (mostrar_mapa) on public.perfis_perfil to anon, authenticated;
-- (sem UPDATE para o cliente: só perfis_definir_mostrar_mapa())

create table public.perfis_perfil_versao_local (
  versao_id uuid primary key,
  perfil_id uuid not null,
  latitude numeric(9, 6) not null,
  longitude numeric(9, 6) not null,
  origem text not null,
  georreferenciado_em timestamptz not null default now(),
  endereco_ref text not null,
  constraint perfis_local_versao_fk foreign key (versao_id, perfil_id)
    references public.perfis_perfil_versao (id, perfil_id) on delete cascade,
  constraint perfis_local_latitude check (latitude between -90 and 90),
  constraint perfis_local_longitude check (longitude between -180 and 180),
  constraint perfis_local_origem check (origem in ('geocodificado', 'informado')),
  constraint perfis_local_ref check (char_length(endereco_ref) = 32)
);
create index perfis_local_perfil_idx on public.perfis_perfil_versao_local (perfil_id);
comment on table public.perfis_perfil_versao_local is
  'Coordenadas do endereço de uma versão do perfil (IM-018, D-016). Gravadas só por RPC; zeradas quando o endereço da versão muda.';

revoke all on public.perfis_perfil_versao_local from anon, authenticated;
-- Sem responsável/conta na tabela. O público lê só o necessário para a visão; políticas limitam as linhas.
grant select (versao_id, perfil_id, latitude, longitude, origem, georreferenciado_em, endereco_ref)
  on public.perfis_perfil_versao_local to anon, authenticated;
alter table public.perfis_perfil_versao_local enable row level security;
alter table public.perfis_perfil_versao_local force row level security;

-- Público: só a coordenada da versão APROVADA de perfil disponível (publicado, conta que pode publicar: IM-079, IM-080).
create policy perfis_local_select_publico on public.perfis_perfil_versao_local
  for select to anon, authenticated using (
    public.perfis_perfil_disponivel(perfil_id)
    and exists (select 1 from public.perfis_perfil p
                where p.id = perfis_perfil_versao_local.perfil_id and p.versao_aprovada_id = perfis_perfil_versao_local.versao_id));
create policy perfis_local_select_proprio on public.perfis_perfil_versao_local
  for select to authenticated using ((select public.perfis_eh_dono(perfil_id)));
create policy perfis_local_select_admin on public.perfis_perfil_versao_local
  for select to authenticated using ((select public.administracao_eh_admin()));
create policy perfis_local_insert_negado on public.perfis_perfil_versao_local
  for insert to authenticated with check (false);
create policy perfis_local_update_negado on public.perfis_perfil_versao_local
  for update to authenticated using (false) with check (false);
create policy perfis_local_delete_negado on public.perfis_perfil_versao_local
  for delete to authenticated using (false);

-- Endereço mudou na versão (só rascunho muda): apaga a coordenada antiga, com auditoria quando há autor logado.
create function public.perfis_local_zerar_se_endereco_mudou() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_ant record;
begin
  select l.latitude, l.longitude, l.origem into v_ant from public.perfis_perfil_versao_local l where l.versao_id = new.id;
  if not found then
    return new;
  end if;
  delete from public.perfis_perfil_versao_local where versao_id = new.id;
  if v_uid is not null then
    insert into public.administracao_auditoria (autor_id, acao, alvo_tabela, alvo_id, motivo, valor_anterior, valor_novo)
    values (v_uid, 'zerar_coordenadas', 'perfis_perfil_versao_local', new.id::text, 'endereço da versão mudou',
            jsonb_build_object('latitude', v_ant.latitude, 'longitude', v_ant.longitude, 'origem', v_ant.origem), null);
  end if;
  return new;
end $$;
revoke all on function public.perfis_local_zerar_se_endereco_mudou() from public, anon, authenticated;
create trigger perfis_local_zerar after update of endereco, cidade, uf on public.perfis_perfil_versao
  for each row when (new.endereco is distinct from old.endereco or new.cidade is distinct from old.cidade
                     or new.uf is distinct from old.uf)
  execute function public.perfis_local_zerar_se_endereco_mudou();

-- RPC: o responsável grava (ou corrige) as coordenadas do endereço da própria versão. Idempotente. ----------------------
create function public.perfis_gravar_coordenadas(p_versao_id uuid, p_latitude numeric, p_longitude numeric,
                                                 p_origem text default 'geocodificado') returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_perfil uuid;
  v_sit text;
  v_endereco text;
  v_cidade text;
  v_uf text;
  v_lat numeric(9, 6);
  v_lon numeric(9, 6);
  v_ant record;
begin
  if v_uid is null or not public.contas_acesso_permitido(v_uid) then
    raise exception 'não autenticado ou conta sem acesso' using errcode = '42501';
  end if;
  select v.perfil_id, v.situacao, v.endereco, v.cidade, v.uf
    into v_perfil, v_sit, v_endereco, v_cidade, v_uf
  from public.perfis_perfil_versao v join public.perfis_perfil p on p.id = v.perfil_id
  where v.id = p_versao_id and p.responsavel_id = v_uid
  for update of v;
  if not found then
    raise exception 'versão não encontrada' using errcode = '42501';
  end if;
  if v_sit not in ('rascunho', 'pendente', 'aprovada') then
    raise exception 'versão rejeitada não recebe coordenadas' using errcode = '22023';
  end if;
  if nullif(btrim(coalesce(v_endereco, '')), '') is null or v_cidade is null or v_uf is null then
    raise exception 'coordenadas exigem endereço, cidade e UF preenchidos' using errcode = '22023';
  end if;
  if p_origem is null or p_origem not in ('geocodificado', 'informado') then
    raise exception 'origem inválida' using errcode = '22023';
  end if;
  if p_latitude is null or p_longitude is null
     or p_latitude = 'NaN' or p_longitude = 'NaN'
     or p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
    raise exception 'coordenada fora da faixa válida' using errcode = '22023';
  end if;
  v_lat := round(p_latitude, 6);
  v_lon := round(p_longitude, 6);
  select l.latitude, l.longitude, l.origem, l.endereco_ref into v_ant
  from public.perfis_perfil_versao_local l where l.versao_id = p_versao_id;
  if found and v_ant.latitude = v_lat and v_ant.longitude = v_lon and v_ant.origem = p_origem
     and v_ant.endereco_ref = public.perfis_endereco_ref(v_endereco, v_cidade, v_uf) then
    return; -- repetição idêntica: sem nova linha de auditoria
  end if;
  insert into public.perfis_perfil_versao_local (versao_id, perfil_id, latitude, longitude, origem, georreferenciado_em, endereco_ref)
  values (p_versao_id, v_perfil, v_lat, v_lon, p_origem, now(), public.perfis_endereco_ref(v_endereco, v_cidade, v_uf))
  on conflict (versao_id) do update
    set latitude = excluded.latitude, longitude = excluded.longitude, origem = excluded.origem,
        georreferenciado_em = excluded.georreferenciado_em, endereco_ref = excluded.endereco_ref;
  insert into public.administracao_auditoria (autor_id, acao, alvo_tabela, alvo_id, motivo, valor_anterior, valor_novo)
  values (v_uid, 'gravar_coordenadas', 'perfis_perfil_versao_local', p_versao_id::text, null,
          case when v_ant.latitude is null then null
               else jsonb_build_object('latitude', v_ant.latitude, 'longitude', v_ant.longitude, 'origem', v_ant.origem) end,
          jsonb_build_object('latitude', v_lat, 'longitude', v_lon, 'origem', p_origem));
end $$;

-- RPC: o responsável limpa as coordenadas da própria versão (o mapa deixa de aparecer). Idempotente. ------------------------
create function public.perfis_limpar_coordenadas(p_versao_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_ant record;
begin
  if v_uid is null or not public.contas_acesso_permitido(v_uid) then
    raise exception 'não autenticado ou conta sem acesso' using errcode = '42501';
  end if;
  perform 1 from public.perfis_perfil_versao v join public.perfis_perfil p on p.id = v.perfil_id
  where v.id = p_versao_id and p.responsavel_id = v_uid for update of v;
  if not found then
    raise exception 'versão não encontrada' using errcode = '42501';
  end if;
  select l.latitude, l.longitude, l.origem into v_ant from public.perfis_perfil_versao_local l where l.versao_id = p_versao_id;
  if not found then
    return;
  end if;
  delete from public.perfis_perfil_versao_local where versao_id = p_versao_id;
  insert into public.administracao_auditoria (autor_id, acao, alvo_tabela, alvo_id, motivo, valor_anterior, valor_novo)
  values (v_uid, 'limpar_coordenadas', 'perfis_perfil_versao_local', p_versao_id::text, null,
          jsonb_build_object('latitude', v_ant.latitude, 'longitude', v_ant.longitude, 'origem', v_ant.origem), null);
end $$;

-- RPC: o responsável liga/desliga o mapa na página pública (não cria versão nem exige aprovação). ----------------------------
create function public.perfis_definir_mostrar_mapa(p_perfil_id uuid, p_mostrar boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_ant boolean;
begin
  if v_uid is null or not public.contas_acesso_permitido(v_uid) then
    raise exception 'não autenticado ou conta sem acesso' using errcode = '42501';
  end if;
  if p_mostrar is null then
    raise exception 'informe se o mapa deve aparecer' using errcode = '22023';
  end if;
  select p.mostrar_mapa into v_ant from public.perfis_perfil p
  where p.id = p_perfil_id and p.responsavel_id = v_uid for update;
  if not found then
    raise exception 'perfil não encontrado' using errcode = '42501';
  end if;
  if v_ant = p_mostrar then
    return;
  end if;
  update public.perfis_perfil set mostrar_mapa = p_mostrar where id = p_perfil_id;
  insert into public.administracao_auditoria (autor_id, acao, alvo_tabela, alvo_id, motivo, valor_anterior, valor_novo)
  values (v_uid, 'definir_mostrar_mapa', 'perfis_perfil', p_perfil_id::text, null,
          jsonb_build_object('mostrar_mapa', v_ant), jsonb_build_object('mostrar_mapa', p_mostrar));
end $$;

revoke all on function public.perfis_gravar_coordenadas(uuid, numeric, numeric, text) from public, anon;
revoke all on function public.perfis_limpar_coordenadas(uuid) from public, anon;
revoke all on function public.perfis_definir_mostrar_mapa(uuid, boolean) from public, anon;
grant execute on function public.perfis_gravar_coordenadas(uuid, numeric, numeric, text) to authenticated;
grant execute on function public.perfis_limpar_coordenadas(uuid) to authenticated;
grant execute on function public.perfis_definir_mostrar_mapa(uuid, boolean) to authenticated;

-- Leitura -------------------------------------------------------------------------------------------------------
-- Visão pública: colunas anteriores intactas + latitude, longitude, mostrar_mapa ao final. Coordenada só sai se o perfil mantém
-- o mapa ligado, a versão aprovada tem endereço e a coordenada foi gravada para ESSE texto de endereço.
create or replace view public.perfis_perfil_publico with (security_invoker = true) as
select p.id, p.slug, v.nome, v.descricao_breve, v.imagem_path,
       v.categoria_principal_id, v.categoria_secundaria_1_id, v.categoria_secundaria_2_id,
       v.cidade, v.uf, v.endereco, v.areas_atendidas, v.banners_paths, v.fotos_paths,
       v.site, v.informacoes_sociais,
       case when e.habilitado then p.estilo_pagina else 'minimalista' end as estilo_pagina,
       case when p.mostrar_mapa and nullif(btrim(coalesce(v.endereco, '')), '') is not null then l.latitude end as latitude,
       case when p.mostrar_mapa and nullif(btrim(coalesce(v.endereco, '')), '') is not null then l.longitude end as longitude,
       p.mostrar_mapa
from public.perfis_perfil p
join public.perfis_perfil_versao v on v.id = p.versao_aprovada_id and v.situacao = 'aprovada'
join public.perfis_estilo_pagina e on e.id = p.estilo_pagina
left join public.perfis_perfil_versao_local l
  on l.versao_id = v.id and l.endereco_ref = public.perfis_endereco_ref(v.endereco, v.cidade, v.uf)
where p.publicado;

-- Lista do dono (visão com filtro fixo por auth.uid(); sem conta_id): inclui a preferência e a coordenada da versão no ar.
create or replace view public.perfis_meus_perfis as
select p.id, p.slug, p.publicado, p.versao_aprovada_id, p.criado_em, p.atualizado_em, p.estilo_pagina,
       p.mostrar_mapa, l.latitude, l.longitude
from public.perfis_perfil p
left join public.perfis_perfil_versao v on v.id = p.versao_aprovada_id
left join public.perfis_perfil_versao_local l
  on l.versao_id = v.id and l.endereco_ref = public.perfis_endereco_ref(v.endereco, v.cidade, v.uf)
where p.responsavel_id = (select auth.uid());
