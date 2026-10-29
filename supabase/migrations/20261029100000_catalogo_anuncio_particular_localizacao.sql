-- Fase 2C · anúncio particular com cidade e UF obrigatórias · IM-015, IM-019, IM-029, IM-086 (D-008)
--
-- DECISÕES (documentadas):
--   * Migração SEGURA para dados existentes: colunas `cidade` e `uf` NULLABLE em catalogo_item_versao. Versões
--     antigas de anúncio particular (aprovadas ou pendentes) continuam válidas, sem valor de transição inventado;
--     elas apenas não aparecem nos filtros de cidade/UF até o dono editar e reenviar (nova versão exige localização).
--   * Formato (cidade 2..80 caracteres, UF na lista das 27 siglas) é CHECK de tabela: vale para qualquer linha que
--     tenha valor. A obrigatoriedade NÃO é CHECK de tabela (não dá para referenciar o item e invalidaria o legado):
--       - item de perfil: cidade/UF PROIBIDAS (herdam do perfil). Recusado no gatilho de validação (23514), em
--         rascunho e pendente, para não existir duas fontes de localização.
--       - anúncio particular: cidade e UF obrigatórias ao ENVIAR para aprovação (catalogo_enviar_item_versao, 23514).
--         O dono só envia por essa função (o grant de colunas não inclui `situacao`), então não há atalho.
--       - rascunho pode ficar sem localização (como já acontece com nome, foto etc.).
--   * O gatilho normaliza: cidade com espaços aparados; UF em maiúsculas; vazio vira NULL.
--   * catalogo_criar_item ganha p_cidade e p_uf AO FINAL (default null). Parâmetros novos mudam a assinatura, então a
--     função antiga é removida e recriada com os mesmos grants; chamadas existentes (por nome ou posição) seguem válidas.
--   * Visão pública catalogo_item_publico: colunas novas `cidade` e `uf` ao final (do próprio item no anúncio
--     particular; do perfil no item de perfil). busca_publica (mesma assinatura) usa essas colunas.
--   * Fora de escopo (dúvida registrada): aprovar pelo administrador um anúncio particular legado pendente sem
--     localização continua permitido; ele só não aparece nos filtros de cidade/UF.

alter table public.catalogo_item_versao add column cidade text, add column uf text;
alter table public.catalogo_item_versao
  add constraint catalogo_item_versao_cidade check (cidade is null or char_length(btrim(cidade)) between 2 and 80),
  add constraint catalogo_item_versao_uf check (uf is null or uf in (
    'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'));

grant insert (cidade, uf) on public.catalogo_item_versao to authenticated;
grant update (cidade, uf) on public.catalogo_item_versao to authenticated;

-- Gatilho de validação: acrescenta normalização e a proibição para item de perfil.
create or replace function public.catalogo_item_versao_validar() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_cat uuid;
  v_perfil uuid;
begin
  if new.situacao not in ('rascunho', 'pendente') then
    return new;
  end if;
  new.cidade := nullif(btrim(new.cidade), '');
  new.uf := nullif(upper(btrim(new.uf)), '');
  select i.perfil_id into v_perfil from public.catalogo_item i where i.id = new.item_id;
  if v_perfil is not null and (new.cidade is not null or new.uf is not null) then
    raise exception 'item de perfil herda a localização do perfil: cidade e UF não se aplicam' using errcode = '23514';
  end if;
  foreach v_cat in array array[new.categoria_principal_id, new.categoria_secundaria_1_id, new.categoria_secundaria_2_id] loop
    if v_cat is not null and not exists (select 1 from public.catalogo_categoria where id = v_cat and ativa) then
      raise exception 'categoria inexistente ou inativa' using errcode = '23514';
    end if;
  end loop;
  if new.foto_path is not null and new.foto_path !~ ('^item/' || new.item_id::text || '/[A-Za-z0-9._-]{1,100}$') then
    raise exception 'caminho de imagem fora da pasta do item' using errcode = '23514';
  end if;
  return new;
end $$;

-- Envio: anúncio particular exige cidade e UF.
create or replace function public.catalogo_enviar_item_versao(p_versao_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_sit text;
  v_perfil uuid;
  v_cidade text;
  v_uf text;
begin
  if v_uid is null then
    raise exception 'não autenticado' using errcode = '42501';
  end if;
  select v.situacao, i.perfil_id, v.cidade, v.uf into v_sit, v_perfil, v_cidade, v_uf
  from public.catalogo_item_versao v join public.catalogo_item i on i.id = v.item_id
  where v.id = p_versao_id and i.conta_id = v_uid
  for update of v;
  if not found then
    raise exception 'versão não encontrada' using errcode = '42501';
  end if;
  if v_sit <> 'rascunho' then
    raise exception 'só rascunho pode ser enviado' using errcode = 'P0001';
  end if;
  if v_perfil is null and (v_cidade is null or v_uf is null) then
    raise exception 'anúncio particular exige cidade e UF' using errcode = '23514';
  end if;
  update public.catalogo_item_versao set situacao = 'pendente', enviada_em = now() where id = p_versao_id;
end $$;

-- Criação do item: novos parâmetros ao final.
drop function public.catalogo_criar_item(text, uuid, text, text, uuid, uuid, uuid, text, bigint);
create function public.catalogo_criar_item(
  p_tipo text,
  p_perfil_id uuid default null,
  p_nome text default null,
  p_descricao text default null,
  p_categoria_principal_id uuid default null,
  p_categoria_secundaria_1_id uuid default null,
  p_categoria_secundaria_2_id uuid default null,
  p_preco_modo text default null,
  p_preco_centavos bigint default null,
  p_cidade text default null,
  p_uf text default null
) returns table (o_item_id uuid, o_versao_id uuid)
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_item uuid;
  v_versao uuid;
begin
  if v_uid is null then
    raise exception 'não autenticado' using errcode = '42501';
  end if;
  insert into public.catalogo_item (conta_id, perfil_id, tipo) values (v_uid, p_perfil_id, p_tipo)
  returning id into v_item;
  insert into public.catalogo_item_versao (item_id, nome, descricao, categoria_principal_id,
    categoria_secundaria_1_id, categoria_secundaria_2_id, preco_modo, preco_centavos, cidade, uf)
  values (v_item, p_nome, p_descricao, p_categoria_principal_id, p_categoria_secundaria_1_id,
    p_categoria_secundaria_2_id, p_preco_modo, p_preco_centavos, p_cidade, p_uf)
  returning id into v_versao;
  o_item_id := v_item;
  o_versao_id := v_versao;
  return next;
end $$;
revoke all on function public.catalogo_criar_item(text, uuid, text, text, uuid, uuid, uuid, text, bigint, text, text) from public, anon;
grant execute on function public.catalogo_criar_item(text, uuid, text, text, uuid, uuid, uuid, text, bigint, text, text) to authenticated;

-- Visão pública: localização do item (particular) ou do perfil (item de perfil). Colunas novas ao final.
create or replace view public.catalogo_item_publico with (security_invoker = true) as
select i.id, i.perfil_id, i.tipo, v.nome, v.descricao, v.foto_path,
       v.categoria_principal_id, v.categoria_secundaria_1_id, v.categoria_secundaria_2_id,
       v.preco_modo, v.preco_centavos, i.criado_em,
       case when i.perfil_id is null then v.cidade else pp.cidade end as cidade,
       case when i.perfil_id is null then v.uf else pp.uf end as uf
from public.catalogo_item i
join public.catalogo_item_versao v on v.id = i.versao_aprovada_id and v.situacao = 'aprovada'
left join public.perfis_perfil_publico pp on pp.id = i.perfil_id
where i.publicado and (i.perfil_id is null or public.perfis_perfil_disponivel(i.perfil_id));
revoke all on public.catalogo_item_publico from anon, authenticated;
grant select on public.catalogo_item_publico to anon, authenticated;

-- Busca: mesma assinatura e colunas; item usa a localização da visão (particular ou perfil).
create or replace function public.busca_publica(
  p_termo text default null,
  p_tipo text default null,
  p_categoria_id uuid default null,
  p_uf text default null,
  p_cidade text default null,
  p_limite integer default 20,
  p_pagina integer default 1
) returns table (
  o_tipo text,
  o_id uuid,
  o_slug text,
  o_perfil_id uuid,
  o_perfil_slug text,
  o_nome text,
  o_descricao text,
  o_imagem_path text,
  o_categoria_id uuid,
  o_categoria_nome text,
  o_categoria_slug text,
  o_cidade text,
  o_uf text,
  o_preco_modo text,
  o_preco_centavos bigint,
  o_total bigint
) language plpgsql stable set search_path = '' as $$
declare
  v_termo text := public.busca_normalizar(left(coalesce(p_termo, ''), 80));
  v_tipo text := lower(btrim(coalesce(p_tipo, '')));
  v_uf text := upper(btrim(coalesce(p_uf, '')));
  v_cidade text := public.busca_normalizar(left(coalesce(p_cidade, ''), 80));
  v_limite integer := least(greatest(coalesce(p_limite, 20), 1), 50);
  v_pagina integer := least(greatest(coalesce(p_pagina, 1), 1), 1000);
begin
  if v_tipo not in ('', 'todos', 'perfil', 'produto', 'servico') then
    raise exception 'tipo inválido' using errcode = '22023';
  end if;
  if v_uf <> '' and v_uf !~ '^[A-Z]{2}$' then
    raise exception 'UF inválida' using errcode = '22023';
  end if;

  return query
  with base as (
    select 'perfil'::text as t, p.id as id, p.slug as slug, null::uuid as perfil_id, null::text as perfil_slug,
           p.nome as nome, left(p.descricao_breve, 200) as descr, p.imagem_path as imagem,
           p.categoria_principal_id as cat, p.categoria_secundaria_1_id as cat1, p.categoria_secundaria_2_id as cat2,
           p.cidade as cidade, p.uf as uf, null::text as preco_modo, null::bigint as preco
    from public.perfis_perfil_publico p
    union all
    select i.tipo, i.id, null::text, i.perfil_id, pp.slug,
           i.nome, left(i.descricao, 200), i.foto_path,
           i.categoria_principal_id, i.categoria_secundaria_1_id, i.categoria_secundaria_2_id,
           i.cidade, i.uf, i.preco_modo, i.preco_centavos
    from public.catalogo_item_publico i
    left join public.perfis_perfil_publico pp on pp.id = i.perfil_id
  ), filtrado as (
    select b.*, public.busca_normalizar(b.nome) as nome_norm
    from base b
    where (v_tipo in ('', 'todos') or b.t = v_tipo)
      and (p_categoria_id is null or p_categoria_id in (b.cat, b.cat1, b.cat2))
      and (v_uf = '' or b.uf = v_uf)
      and (v_cidade = '' or public.busca_normalizar(b.cidade) = v_cidade)
      and (v_termo = '' or strpos(public.busca_normalizar(b.nome), v_termo) > 0)
  )
  select f.t, f.id, f.slug, f.perfil_id, f.perfil_slug, f.nome, f.descr, f.imagem,
         f.cat, c.nome, c.slug, f.cidade, f.uf, f.preco_modo, f.preco,
         count(*) over ()
  from filtrado f
  left join public.catalogo_categoria c on c.id = f.cat
  order by f.nome_norm, f.t, f.id
  limit v_limite offset (v_pagina - 1) * v_limite;
end $$;
