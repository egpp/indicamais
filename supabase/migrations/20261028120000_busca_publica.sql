-- Fase 2C-1 · busca e filtros públicos (página inicial) · IM-019, IM-016, IM-029, IM-079, IM-086
--
-- DECISÕES (documentadas):
--   * NENHUMA extensão nova. Normalização própria e imutável (busca_normalizar): minúsculas, remoção de acentos
--     do português/latim (translate) e espaços colapsados. Evita depender de unaccent/pg_trgm (esquema `extensions`
--     varia por ambiente e unaccent não é imutável). A busca usa strpos() sobre o texto normalizado: não há LIKE,
--     então não há curinga (% e _) nem escape a tratar, e nenhum SQL dinâmico. Como busca_normalizar é imutável,
--     um índice trigram pode ser adicionado depois (migração própria) se o volume exigir; no estágio atual é varredura.
--   * Função SECURITY INVOKER (padrão): lê SÓ as visões públicas (perfis_perfil_publico, catalogo_item_publico,
--     catalogo_categoria), que já filtram aprovado + publicado + perfil disponível (IM-079) com as permissões do
--     chamador (anon). Não existe caminho para rascunho, pendente, rejeitado, despublicado nem item de perfil indisponível.
--   * Retorno enxuto para cards, SEM WhatsApp, responsável, e-mail nem id de conta.
--   * Item de perfil herda cidade/UF do perfil. Anúncio particular (IM-015) não tem localização no modelo atual:
--     some quando se filtra por UF ou cidade (dúvida de requisito registrada no relatório).
--   * Limites impostos no servidor: termo e cidade truncados em 80 caracteres; página de 1 a 50 itens (padrão 20);
--     página de 1 a 1000; ordem estável (nome normalizado, tipo, id).

create function public.busca_normalizar(p_texto text) returns text
language sql immutable parallel safe set search_path = '' as $$
  select btrim(regexp_replace(
    lower(translate(coalesce(p_texto, ''),
      'ÁÀÂÃÄÅáàâãäåÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñÝýÿ',
      'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNnYyy')),
    '\s+', ' ', 'g'));
$$;
revoke all on function public.busca_normalizar(text) from public;
grant execute on function public.busca_normalizar(text) to anon, authenticated;

-- Parâmetros (todos opcionais):
--   p_termo        parte do NOME (acentos e caixa indiferentes), até 80 caracteres
--   p_tipo         null/'todos' | 'perfil' | 'produto' | 'servico' (outro valor: erro 22023)
--   p_categoria_id categoria principal OU secundária
--   p_uf           sigla (2 letras, caixa indiferente; formato inválido: erro 22023)
--   p_cidade       texto livre; igualdade sem acentos/caixa
--   p_limite       1..50 (padrão 20; fora da faixa é ajustado)
--   p_pagina       1..1000 (padrão 1)
-- Colunas: o_tipo, o_id, o_slug (só perfil), o_perfil_id e o_perfil_slug (só item de perfil), o_nome,
--   o_descricao (até 200 caracteres), o_imagem_path (opaco, ver contrato de imagens), o_categoria_id/nome/slug (principal),
--   o_cidade, o_uf, o_preco_modo, o_preco_centavos (item; null se sem preço), o_total (total de resultados do filtro).
create function public.busca_publica(
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
           pp.cidade, pp.uf, i.preco_modo, i.preco_centavos
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

revoke all on function public.busca_publica(text, text, uuid, text, text, integer, integer) from public;
grant execute on function public.busca_publica(text, text, uuid, text, text, integer, integer) to anon, authenticated;
