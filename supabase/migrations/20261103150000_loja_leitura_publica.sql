-- Fase 10 · módulo loja · leitura pública da Loja e filtros de imóveis · IM-097, IM-098, IM-016, IM-079, IM-029, IM-086 (D-020)
--
-- DECISÕES
--   * loja_item_publico (security_invoker): itens aprovados E publicados de perfil DISPONÍVEL (IM-079) com a Loja LIBERADA.
--     Serve a página do negócio (filtre por perfil_id) e a busca. Traz os campos extras da Loja (galeria, campos de imóvel)
--     e a localização do imóvel (bairro, cidade, UF do próprio imóvel). Nunca traz conta_id, responsavel_id, telefone, e-mail
--     nem endereço exato (a coluna não existe: ver migração anterior).
--   * Retirar a Loja faz o item sumir desta visão; o mesmo item de produto/serviço continua em catalogo_item_publico, SEM os
--     campos extras. Imóvel NUNCA aparece em catalogo_item_publico (nem na busca_publica atual, que só conhece produto e
--     serviço): sem a Loja liberada ele não tem leitura pública nenhuma.
--   * loja_listar_imoveis: função SECURITY INVOKER (padrão), lê só a visão pública. Filtros validados (22023): finalidade,
--     tipo do imóvel, faixa de preço em centavos, quartos mínimos, UF, cidade, bairro e perfil. Limites no servidor.
--     Sem SQL dinâmico; comparações de texto por igualdade sem acento/caixa (busca_normalizar).
--     Filtro de preço ignora imóvel "sob consulta" (sem valor). Ordem estável: mais recente primeiro, depois id.
--   * Imagens: a foto adicional segue o mesmo caminho opaco item/<item_id>/<arquivo>; as funções de Storage
--     (catalogo_imagem_publica e catalogo_imagem_em_uso) passam a reconhecê-la, para o público ver a foto de item no ar e o
--     dono não apagar foto em uso.

create or replace view public.catalogo_item_publico with (security_invoker = true) as
select i.id, i.perfil_id, i.tipo, v.nome, v.descricao, v.foto_path,
       v.categoria_principal_id, v.categoria_secundaria_1_id, v.categoria_secundaria_2_id,
       v.preco_modo, v.preco_centavos, i.criado_em,
       case when i.perfil_id is null then v.cidade else pp.cidade end as cidade,
       case when i.perfil_id is null then v.uf else pp.uf end as uf
from public.catalogo_item i
join public.catalogo_item_versao v on v.id = i.versao_aprovada_id and v.situacao = 'aprovada'
left join public.perfis_perfil_publico pp on pp.id = i.perfil_id
where i.publicado and i.tipo <> 'imovel' and (i.perfil_id is null or public.perfis_perfil_disponivel(i.perfil_id));
revoke all on public.catalogo_item_publico from anon, authenticated;
grant select on public.catalogo_item_publico to anon, authenticated;

create view public.loja_item_publico with (security_invoker = true) as
select i.id, i.perfil_id, pp.slug as perfil_slug, i.tipo, v.nome, v.descricao, v.foto_path, v.fotos_extras_paths,
       v.categoria_principal_id, v.categoria_secundaria_1_id, v.categoria_secundaria_2_id,
       v.preco_modo, v.preco_centavos,
       case when i.tipo = 'imovel' then v.cidade else pp.cidade end as cidade,
       case when i.tipo = 'imovel' then v.uf else pp.uf end as uf,
       v.bairro, v.imovel_tipo, v.finalidade, v.area_m2, v.quartos, v.banheiros, v.vagas,
       v.condominio_centavos, v.iptu_centavos, v.aceita_financiamento, i.criado_em
from public.catalogo_item i
join public.catalogo_item_versao v on v.id = i.versao_aprovada_id and v.situacao = 'aprovada'
join public.perfis_perfil_publico pp on pp.id = i.perfil_id
join public.loja_liberacao l on l.perfil_id = i.perfil_id and l.liberada
where i.publicado and public.perfis_perfil_disponivel(i.perfil_id);
revoke all on public.loja_item_publico from anon, authenticated;
grant select on public.loja_item_publico to anon, authenticated;

-- Parâmetros (todos opcionais):
--   p_finalidade   'venda' | 'aluguel'
--   p_imovel_tipo  'casa' | 'apartamento' | 'terreno' | 'comercial' | 'rural' | 'outro'
--   p_preco_min / p_preco_max  centavos de BRL (>= 0; min <= max)
--   p_quartos_min  0..50
--   p_uf           sigla de 2 letras (caixa indiferente)
--   p_cidade, p_bairro  igualdade sem acento/caixa, até 80 caracteres
--   p_perfil_id    só imóveis da Loja desse perfil (página do negócio)
--   p_limite 1..50 (padrão 20); p_pagina 1..1000 (padrão 1)
create function public.loja_listar_imoveis(
  p_finalidade text default null,
  p_imovel_tipo text default null,
  p_preco_min bigint default null,
  p_preco_max bigint default null,
  p_quartos_min integer default null,
  p_uf text default null,
  p_cidade text default null,
  p_bairro text default null,
  p_perfil_id uuid default null,
  p_limite integer default 20,
  p_pagina integer default 1
) returns table (
  o_id uuid,
  o_perfil_id uuid,
  o_perfil_slug text,
  o_nome text,
  o_descricao text,
  o_foto_path text,
  o_fotos_extras_paths text[],
  o_imovel_tipo text,
  o_finalidade text,
  o_preco_modo text,
  o_preco_centavos bigint,
  o_area_m2 numeric,
  o_quartos smallint,
  o_banheiros smallint,
  o_vagas smallint,
  o_bairro text,
  o_cidade text,
  o_uf text,
  o_condominio_centavos bigint,
  o_iptu_centavos bigint,
  o_aceita_financiamento boolean,
  o_total bigint
) language plpgsql stable set search_path = '' as $$
declare
  v_finalidade text := lower(btrim(coalesce(p_finalidade, '')));
  v_tipo text := lower(btrim(coalesce(p_imovel_tipo, '')));
  v_uf text := upper(btrim(coalesce(p_uf, '')));
  v_cidade text := public.busca_normalizar(left(coalesce(p_cidade, ''), 80));
  v_bairro text := public.busca_normalizar(left(coalesce(p_bairro, ''), 80));
  v_limite integer := least(greatest(coalesce(p_limite, 20), 1), 50);
  v_pagina integer := least(greatest(coalesce(p_pagina, 1), 1), 1000);
begin
  if v_finalidade not in ('', 'venda', 'aluguel') then
    raise exception 'finalidade inválida' using errcode = '22023';
  end if;
  if v_tipo not in ('', 'casa', 'apartamento', 'terreno', 'comercial', 'rural', 'outro') then
    raise exception 'tipo de imóvel inválido' using errcode = '22023';
  end if;
  if v_uf <> '' and v_uf !~ '^[A-Z]{2}$' then
    raise exception 'UF inválida' using errcode = '22023';
  end if;
  if (p_preco_min is not null and p_preco_min < 0) or (p_preco_max is not null and p_preco_max < 0)
     or (p_preco_min is not null and p_preco_max is not null and p_preco_min > p_preco_max) then
    raise exception 'faixa de preço inválida' using errcode = '22023';
  end if;
  if p_quartos_min is not null and p_quartos_min not between 0 and 50 then
    raise exception 'quartos inválido' using errcode = '22023';
  end if;

  return query
  select l.id, l.perfil_id, l.perfil_slug, l.nome, left(l.descricao, 300), l.foto_path, l.fotos_extras_paths,
         l.imovel_tipo, l.finalidade, l.preco_modo, l.preco_centavos, l.area_m2, l.quartos, l.banheiros, l.vagas,
         l.bairro, l.cidade, l.uf, l.condominio_centavos, l.iptu_centavos, l.aceita_financiamento,
         count(*) over ()
  from public.loja_item_publico l
  where l.tipo = 'imovel'
    and (v_finalidade = '' or l.finalidade = v_finalidade)
    and (v_tipo = '' or l.imovel_tipo = v_tipo)
    and (p_preco_min is null or l.preco_centavos >= p_preco_min)
    and (p_preco_max is null or l.preco_centavos <= p_preco_max)
    and (p_quartos_min is null or l.quartos >= p_quartos_min)
    and (v_uf = '' or l.uf = v_uf)
    and (v_cidade = '' or public.busca_normalizar(l.cidade) = v_cidade)
    and (v_bairro = '' or public.busca_normalizar(l.bairro) = v_bairro)
    and (p_perfil_id is null or l.perfil_id = p_perfil_id)
  order by l.criado_em desc, l.id
  limit v_limite offset (v_pagina - 1) * v_limite;
end $$;
revoke all on function public.loja_listar_imoveis(text, text, bigint, bigint, integer, text, text, text, uuid, integer, integer) from public;
grant execute on function public.loja_listar_imoveis(text, text, bigint, bigint, integer, text, text, text, uuid, integer, integer) to anon, authenticated;

-- Storage: a foto adicional de item no ar é pública; em rascunho/pendente/no ar não pode ser apagada ----------------------
create or replace function public.catalogo_imagem_publica(p_nome text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.perfis_perfil_publico v
    where v.imagem_path = p_nome or p_nome = any (v.banners_paths) or p_nome = any (v.fotos_paths)
  ) or exists (
    select 1 from public.catalogo_item_publico v where v.foto_path = p_nome
  ) or exists (
    select 1 from public.loja_item_publico v where v.foto_path = p_nome or p_nome = any (v.fotos_extras_paths)
  );
$$;

create or replace function public.catalogo_imagem_em_uso(p_nome text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.perfis_perfil_versao v
    left join public.perfis_perfil p on p.versao_aprovada_id = v.id
    where (v.situacao in ('rascunho', 'pendente') or p.id is not null)
      and (v.imagem_path = p_nome or p_nome = any (v.banners_paths) or p_nome = any (v.fotos_paths))
  ) or exists (
    select 1 from public.catalogo_item_versao v
    left join public.catalogo_item i on i.versao_aprovada_id = v.id
    where (v.situacao in ('rascunho', 'pendente') or i.id is not null)
      and (v.foto_path = p_nome or p_nome = any (v.fotos_extras_paths))
  );
$$;
