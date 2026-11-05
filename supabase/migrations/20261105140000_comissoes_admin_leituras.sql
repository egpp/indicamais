-- Fase 7 · módulo comissoes · leituras do administrador geral e nome público para o indicador · IM-061 a IM-073, IM-029,
-- IM-041, IM-050, IM-086
--
-- As telas administrativas pediam UUIDs digitados porque o banco só oferecia ações. Aqui entram LEITURAS, só funções:
-- nenhuma tabela, política RLS ou privilégio muda (as 16 tabelas seguem legíveis só pelo administrador, escrita negada).
--   Administrador (administracao_exigir_admin; 42501 para qualquer outro, inclusive anon):
--     comissoes_admin_listar_negocios, _assinaturas, _pagamentos, _comissoes, _vinculos, comissoes_admin_prazo_inadimplencia.
--   Indicador: comissoes_meus_negocios_vinculados() (sem parâmetros, filtro fixo em auth.uid()): nome PÚBLICO do negócio.
-- Paginação: p_limite (1 a 100, padrão 50) e p_deslocamento; o_total traz o total do filtro. Filtros simples por negócio e estado.
-- PRIVACIDADE: o administrador recebe ids de conta (necessários às ações), nunca nome completo, telefone nem e-mail de cliente
-- ou visitante; nenhuma coluna lê contas_conta nem contato. O motivo interno do administrador não é coluna.
-- Lição do defeito D1: não há visões novas; as funções são SECURITY DEFINER (dono executa as internas) e as internas
-- (comissoes_hoje, comissoes_situacao_indicador, comissoes_parametro_valor) seguem sem EXECUTE para authenticated.

-- 1. Negócios com o estado do módulo ------------------------------------------------------------------------------------
create function public.comissoes_admin_listar_negocios(
  p_estado text default null, p_busca text default null, p_limite integer default 50, p_deslocamento integer default 0)
returns table (o_negocio_id uuid, o_slug text, o_nome text, o_publicado boolean, o_modulo_ativo boolean,
               o_estado_desde timestamptz, o_origem text, o_total bigint)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_busca text := nullif(lower(btrim(coalesce(p_busca, ''))), '');
begin
  perform public.administracao_exigir_admin();
  if p_estado is not null and p_estado not in ('habilitado', 'nao_habilitado') then
    raise exception 'estado inválido' using errcode = '22023';
  end if;
  return query
  with base as (
    select p.id as negocio_id, p.slug, p.publicado,
           case when p.publicado then v.nome end as nome,
           coalesce(h.ativa, false) as ativa, h.criado_em as desde, h.origem
    from public.perfis_perfil p
    left join public.perfis_perfil_versao v on v.id = p.versao_aprovada_id and v.situacao = 'aprovada'
    left join lateral (
      select e.ativa, e.criado_em, e.origem from public.comissoes_habilitacao_evento e
      where e.perfil_id = p.id order by e.id desc limit 1
    ) h on true
  )
  select b.negocio_id, b.slug, b.nome, b.publicado, b.ativa, b.desde, b.origem, count(*) over ()
  from base b
  where (p_estado is null or (p_estado = 'habilitado') = b.ativa)
    and (v_busca is null or position(v_busca in lower(b.slug)) > 0 or position(v_busca in lower(coalesce(b.nome, ''))) > 0)
  order by b.ativa desc, lower(coalesce(b.nome, b.slug)), b.negocio_id
  limit least(greatest(coalesce(p_limite, 50), 1), 100) offset greatest(coalesce(p_deslocamento, 0), 0);
end $$;
revoke all on function public.comissoes_admin_listar_negocios(text, text, integer, integer) from public, anon;
grant execute on function public.comissoes_admin_listar_negocios(text, text, integer, integer) to authenticated;

-- 2a. Assinaturas -------------------------------------------------------------------------------------------------------
create function public.comissoes_admin_listar_assinaturas(
  p_perfil uuid default null, p_situacao text default null, p_limite integer default 50, p_deslocamento integer default 0)
returns table (o_id uuid, o_negocio_id uuid, o_oferta_id uuid, o_oferta_nome text, o_cliente_id uuid, o_valor_centavos integer,
               o_inicio date, o_fim date, o_situacao text, o_cancelada_em timestamptz, o_criada_em timestamptz, o_total bigint)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_hoje date := public.comissoes_hoje();
begin
  perform public.administracao_exigir_admin();
  if p_situacao is not null and p_situacao not in ('ativa', 'encerrada', 'cancelada') then
    raise exception 'situação inválida' using errcode = '22023';
  end if;
  return query
  with base as (
    select a.id, a.perfil_id, a.oferta_id, o.nome as oferta_nome, a.cliente_id, a.valor_centavos, a.inicio, a.fim,
           case when c.assinatura_id is not null then 'cancelada'
                when a.fim is not null and a.fim < v_hoje then 'encerrada'
                else 'ativa' end as situacao,
           c.cancelada_em, a.criada_em
    from public.comissoes_assinatura a
    join public.comissoes_oferta o on o.id = a.oferta_id
    left join public.comissoes_assinatura_cancelamento c on c.assinatura_id = a.id
    where p_perfil is null or a.perfil_id = p_perfil
  )
  select b.id, b.perfil_id, b.oferta_id, b.oferta_nome, b.cliente_id, b.valor_centavos, b.inicio, b.fim, b.situacao,
         b.cancelada_em, b.criada_em, count(*) over ()
  from base b
  where p_situacao is null or b.situacao = p_situacao
  order by b.criada_em desc, b.id
  limit least(greatest(coalesce(p_limite, 50), 1), 100) offset greatest(coalesce(p_deslocamento, 0), 0);
end $$;
revoke all on function public.comissoes_admin_listar_assinaturas(uuid, text, integer, integer) from public, anon;
grant execute on function public.comissoes_admin_listar_assinaturas(uuid, text, integer, integer) to authenticated;

-- 2b. Pagamentos --------------------------------------------------------------------------------------------------------
create function public.comissoes_admin_listar_pagamentos(
  p_perfil uuid default null, p_estado text default null, p_limite integer default 50, p_deslocamento integer default 0)
returns table (o_id uuid, o_assinatura_id uuid, o_negocio_id uuid, o_oferta_nome text, o_cliente_id uuid, o_competencia date,
               o_valor_centavos integer, o_estado text, o_estornado_em timestamptz, o_decisao text, o_comissao_id uuid,
               o_confirmado_em timestamptz, o_total bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.administracao_exigir_admin();
  if p_estado is not null and p_estado not in ('confirmado', 'estornado') then
    raise exception 'estado inválido' using errcode = '22023';
  end if;
  return query
  with base as (
    select pg.id, pg.assinatura_id, a.perfil_id, o.nome as oferta_nome, a.cliente_id, pg.competencia, pg.valor_centavos,
           case when es.pagamento_id is null then 'confirmado' else 'estornado' end as estado,
           es.criado_em as estornado_em, d.motivo as decisao, cm.id as comissao_id, pg.confirmado_em
    from public.comissoes_pagamento pg
    join public.comissoes_assinatura a on a.id = pg.assinatura_id
    join public.comissoes_oferta o on o.id = a.oferta_id
    left join public.comissoes_pagamento_estorno es on es.pagamento_id = pg.id
    left join public.comissoes_decisao d on d.pagamento_id = pg.id
    left join public.comissoes_comissao cm on cm.pagamento_id = pg.id
    where p_perfil is null or a.perfil_id = p_perfil
  )
  select b.id, b.assinatura_id, b.perfil_id, b.oferta_nome, b.cliente_id, b.competencia, b.valor_centavos, b.estado,
         b.estornado_em, b.decisao, b.comissao_id, b.confirmado_em, count(*) over ()
  from base b
  where p_estado is null or b.estado = p_estado
  order by b.competencia desc, b.confirmado_em desc, b.id
  limit least(greatest(coalesce(p_limite, 50), 1), 100) offset greatest(coalesce(p_deslocamento, 0), 0);
end $$;
revoke all on function public.comissoes_admin_listar_pagamentos(uuid, text, integer, integer) from public, anon;
grant execute on function public.comissoes_admin_listar_pagamentos(uuid, text, integer, integer) to authenticated;

-- 2c. Comissões (percentual e base congelados, estado do repasse e reversão) ----------------------------------------------
create function public.comissoes_admin_listar_comissoes(
  p_perfil uuid default null, p_estado text default null, p_limite integer default 50, p_deslocamento integer default 0)
returns table (o_id uuid, o_negocio_id uuid, o_pagamento_id uuid, o_oferta_nome text, o_competencia date, o_indicador_id uuid,
               o_cliente_id uuid, o_base_centavos integer, o_percentual_bp integer, o_valor_centavos integer, o_estado text,
               o_estado_em timestamptz, o_revertida boolean, o_reversao_causa text, o_criada_em timestamptz, o_total bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.administracao_exigir_admin();
  if p_estado is not null and p_estado not in ('gerada', 'pendente_repasse', 'paga') then
    raise exception 'estado inválido' using errcode = '22023';
  end if;
  return query
  with base as (
    select c.id, c.perfil_id, c.pagamento_id, o.nome as oferta_nome, pg.competencia, c.indicador_id, v.cliente_id,
           c.base_centavos, c.percentual_bp, c.valor_centavos, st.estado, st.criado_em as estado_em,
           (r.id is not null) as revertida, r.causa, c.criada_em
    from public.comissoes_comissao c
    join public.comissoes_oferta o on o.id = c.oferta_id
    join public.comissoes_pagamento pg on pg.id = c.pagamento_id
    join public.comissoes_vinculo v on v.id = c.vinculo_id
    cross join lateral (
      select e.estado, e.criado_em from public.comissoes_comissao_estado e where e.comissao_id = c.id order by e.id desc limit 1
    ) st
    left join public.comissoes_lancamento r on r.comissao_id = c.id and r.tipo = 'reversao'
    where p_perfil is null or c.perfil_id = p_perfil
  )
  select b.id, b.perfil_id, b.pagamento_id, b.oferta_nome, b.competencia, b.indicador_id, b.cliente_id, b.base_centavos,
         b.percentual_bp, b.valor_centavos, b.estado, b.estado_em, b.revertida, b.causa, b.criada_em, count(*) over ()
  from base b
  where p_estado is null or b.estado = p_estado
  order by b.criada_em desc, b.id
  limit least(greatest(coalesce(p_limite, 50), 1), 100) offset greatest(coalesce(p_deslocamento, 0), 0);
end $$;
revoke all on function public.comissoes_admin_listar_comissoes(uuid, text, integer, integer) from public, anon;
grant execute on function public.comissoes_admin_listar_comissoes(uuid, text, integer, integer) to authenticated;

-- 2d. Vínculos (data prevista de encerramento = inadimplente desde + prazo vigente) -----------------------------------------
create function public.comissoes_admin_listar_vinculos(
  p_perfil uuid default null, p_situacao text default null, p_limite integer default 50, p_deslocamento integer default 0)
returns table (o_id uuid, o_negocio_id uuid, o_indicador_id uuid, o_cliente_id uuid, o_situacao text, o_indicador_em_dia boolean,
               o_inadimplente_desde date, o_encerra_em date, o_criado_em timestamptz, o_encerrado_em timestamptz, o_total bigint)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_hoje date := public.comissoes_hoje();
  v_prazo integer := public.comissoes_parametro_valor('prazo_inadimplencia_dias');
begin
  perform public.administracao_exigir_admin();
  if p_situacao is not null and p_situacao not in ('ativo', 'encerrado') then
    raise exception 'situação inválida' using errcode = '22023';
  end if;
  return query
  with base as (
    select v.id, v.perfil_id, v.indicador_id, v.cliente_id,
           case when e.vinculo_id is null then 'ativo' else 'encerrado' end as situacao,
           v.criado_em, e.criado_em as encerrado_em
    from public.comissoes_vinculo v
    left join public.comissoes_vinculo_encerramento e on e.vinculo_id = v.id
    where p_perfil is null or v.perfil_id = p_perfil
  ), pagina as (
    select b.*, count(*) over () as total
    from base b
    where p_situacao is null or b.situacao = p_situacao
    order by b.criado_em desc, b.id
    limit least(greatest(coalesce(p_limite, 50), 1), 100) offset greatest(coalesce(p_deslocamento, 0), 0)
  )
  select g.id, g.perfil_id, g.indicador_id, g.cliente_id, g.situacao,
         case when g.situacao = 'ativo' then s.o_em_dia end,
         case when g.situacao = 'ativo' then s.o_inadimplente_desde end,
         case when g.situacao = 'ativo' then s.o_inadimplente_desde + v_prazo end,
         g.criado_em, g.encerrado_em, g.total
  from pagina g
  left join lateral public.comissoes_situacao_indicador(g.perfil_id, g.indicador_id, v_hoje) s on g.situacao = 'ativo'
  order by g.criado_em desc, g.id;
end $$;
revoke all on function public.comissoes_admin_listar_vinculos(uuid, text, integer, integer) from public, anon;
grant execute on function public.comissoes_admin_listar_vinculos(uuid, text, integer, integer) to authenticated;

-- 3. Prazo de inadimplência atual (IM-068, IM-072) ------------------------------------------------------------------------
create function public.comissoes_admin_prazo_inadimplencia()
returns table (o_prazo_dias integer, o_minimo integer, o_maximo integer, o_atualizado_em timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.administracao_exigir_admin();
  return query
  select pa.valor, pa.minimo, pa.maximo, pa.atualizado_em
  from public.comissoes_parametro pa where pa.chave = 'prazo_inadimplencia_dias';
end $$;
revoke all on function public.comissoes_admin_prazo_inadimplencia() from public, anon;
grant execute on function public.comissoes_admin_prazo_inadimplencia() to authenticated;

-- 4. Indicador: nome PÚBLICO dos negócios onde ele tem vínculo (para os avisos de inadimplência, IM-072) ---------------------
-- Sem parâmetros e com filtro fixo em auth.uid(). Só nome e slug de perfil já público (publicado e aprovado); perfil não
-- público volta sem nome. Não traz responsável, cliente, contato nem qualquer dado do vínculo.
create function public.comissoes_meus_negocios_vinculados()
returns table (o_negocio_id uuid, o_nome text, o_slug text)
language sql stable security definer set search_path = '' as $$
  select p.id, case when p.publicado then v.nome end, case when p.publicado then p.slug end
  from public.perfis_perfil p
  left join public.perfis_perfil_versao v on v.id = p.versao_aprovada_id and v.situacao = 'aprovada'
  where exists (select 1 from public.comissoes_vinculo cv
                where cv.perfil_id = p.id and cv.indicador_id = (select auth.uid()))
  order by p.id;
$$;
revoke all on function public.comissoes_meus_negocios_vinculados() from public, anon;
grant execute on function public.comissoes_meus_negocios_vinculados() to authenticated;
