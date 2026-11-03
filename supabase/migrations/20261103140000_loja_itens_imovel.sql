-- Fase 10 · módulo loja · extensões do item do catálogo e imóveis · IM-097, IM-098, IM-014, IM-016, IM-021, IM-022, IM-086 (D-020)
--
-- DESENHO (o mais simples e seguro)
--   Colunas novas, todas OPCIONAIS, na própria VERSÃO do item (catalogo_item_versao), e não em tabela à parte:
--     * as versões já são imutáveis depois de enviadas (catalogo_versao_proteger compara a linha inteira em JSON), então os
--       campos novos herdam, sem código novo, a aprovação inicial (IM-021) e o congelamento por versão (IM-022);
--     * uma tabela filha exigiria política, gatilho de congelamento e cópia de versão para versão: mais superfície, mesma função.
--   O que a Loja libera além do catálogo simples (tudo imposto por GATILHO no banco, não só na interface):
--     1. tipo de item 'imovel' (catalogo_item.tipo passa a aceitar 'imovel'), só em item de PERFIL com a Loja liberada;
--     2. galeria: até 8 fotos adicionais (fotos_extras_paths), além da foto única do catálogo simples;
--     3. campos de imóvel (IM-098): imovel_tipo, finalidade (venda/aluguel), area_m2, quartos, banheiros, vagas, bairro,
--        cidade e UF (as colunas cidade/uf já existentes passam a valer para o imóvel) e, opcionais, condominio_centavos,
--        iptu_centavos, aceita_financiamento. O preço do imóvel usa preco_modo/preco_centavos (aluguel: valor mensal).
--   Sem a Loja liberada, o dono segue com o catálogo simples de hoje: não cria item de imóvel, não grava campo de imóvel,
--   não grava foto adicional. Se a Loja for retirada, o que já existe permanece no banco (versões são histórico), mas some
--   da leitura pública (visão loja_item_publico, migração seguinte) e nenhum rascunho de imóvel/extra é gravado ou enviado.
--   Retirar a Loja NÃO despublica nada e re-liberar NÃO republica nada: o liga/desliga (publicado) segue só do dono (IM-022).
--
-- PRIVACIDADE DO IMÓVEL (IM-029, IM-086, padrão do mapa em perfis)
--   NÃO existe coluna de endereço exato. catalogo_item_versao é legível por qualquer pessoa quando a versão está no ar
--   (política pública existente), então qualquer coluna nova é pública por natureza: só entram bairro, cidade e UF.
--   Coordenadas do imóvel não existem. Nada de conta, telefone ou e-mail nas colunas novas.
--
-- ERROS (SQLSTATE): 42501 Loja não liberada para o perfil; 23514 campo inválido, imóvel sem perfil, campo de imóvel em
-- item que não é imóvel, caminho de foto fora da pasta do item, imóvel incompleto ao enviar.

-- Tipo de item ------------------------------------------------------------------------------------------------
alter table public.catalogo_item drop constraint catalogo_item_tipo;
alter table public.catalogo_item add constraint catalogo_item_tipo check (tipo in ('produto', 'servico', 'imovel'));

-- Colunas da versão -------------------------------------------------------------------------------------------
alter table public.catalogo_item_versao
  add column imovel_tipo text,
  add column finalidade text,
  add column area_m2 numeric(12, 2),
  add column quartos smallint,
  add column banheiros smallint,
  add column vagas smallint,
  add column bairro text,
  add column condominio_centavos bigint,
  add column iptu_centavos bigint,
  add column aceita_financiamento boolean,
  add column fotos_extras_paths text[] not null default '{}';

alter table public.catalogo_item_versao
  add constraint catalogo_item_versao_imovel_tipo check (imovel_tipo is null or imovel_tipo in (
    'casa', 'apartamento', 'terreno', 'comercial', 'rural', 'outro')),
  add constraint catalogo_item_versao_finalidade check (finalidade is null or finalidade in ('venda', 'aluguel')),
  add constraint catalogo_item_versao_area check (area_m2 is null or (area_m2 > 0 and area_m2 <= 100000000)),
  add constraint catalogo_item_versao_quartos check (quartos is null or quartos between 0 and 50),
  add constraint catalogo_item_versao_banheiros check (banheiros is null or banheiros between 0 and 50),
  add constraint catalogo_item_versao_vagas check (vagas is null or vagas between 0 and 50),
  add constraint catalogo_item_versao_bairro check (bairro is null or char_length(btrim(bairro)) between 2 and 80),
  add constraint catalogo_item_versao_condominio check (condominio_centavos is null or condominio_centavos between 0 and 100000000),
  add constraint catalogo_item_versao_iptu check (iptu_centavos is null or iptu_centavos between 0 and 100000000),
  add constraint catalogo_item_versao_fotos_extras check (cardinality(fotos_extras_paths) <= 8);

-- Mesmos privilégios de coluna das demais colunas de conteúdo (a linha só é gravável no rascunho: política existente).
grant insert (imovel_tipo, finalidade, area_m2, quartos, banheiros, vagas, bairro, condominio_centavos, iptu_centavos,
  aceita_financiamento, fotos_extras_paths) on public.catalogo_item_versao to authenticated;
grant update (imovel_tipo, finalidade, area_m2, quartos, banheiros, vagas, bairro, condominio_centavos, iptu_centavos,
  aceita_financiamento, fotos_extras_paths) on public.catalogo_item_versao to authenticated;

-- Item de imóvel só nasce em perfil com a Loja liberada (vale para qualquer papel, inclusive service_role) -----------
create function public.catalogo_item_validar_loja() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.tipo = 'imovel' then
    if new.perfil_id is null then
      raise exception 'imóvel pertence a um perfil: anúncio particular não tem Loja' using errcode = '23514';
    end if;
    if not public.loja_ativa(new.perfil_id) then
      raise exception 'a Loja não está liberada para este perfil' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.catalogo_item_validar_loja() from public, anon, authenticated;
create trigger catalogo_item_validar_loja before insert on public.catalogo_item
  for each row execute function public.catalogo_item_validar_loja();

-- Validação existente: o imóvel PODE ter cidade e UF próprias (item de perfil comum continua herdando do perfil) -------
create or replace function public.catalogo_item_versao_validar() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_cat uuid;
  v_perfil uuid;
  v_tipo text;
begin
  if new.situacao not in ('rascunho', 'pendente') then
    return new;
  end if;
  new.cidade := nullif(btrim(new.cidade), '');
  new.uf := nullif(upper(btrim(new.uf)), '');
  select i.perfil_id, i.tipo into v_perfil, v_tipo from public.catalogo_item i where i.id = new.item_id;
  if v_perfil is not null and v_tipo <> 'imovel' and (new.cidade is not null or new.uf is not null) then
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

-- Gatilho novo: o que só a Loja libera. Roda em rascunho e pendente (inclui o ENVIO, que passa a pendente).
create function public.catalogo_item_versao_validar_loja() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_perfil uuid;
  v_tipo text;
  v_loja boolean;
begin
  if new.situacao not in ('rascunho', 'pendente') then
    return new;
  end if;
  select i.perfil_id, i.tipo into v_perfil, v_tipo from public.catalogo_item i where i.id = new.item_id;
  v_loja := v_perfil is not null and public.loja_ativa(v_perfil);
  new.bairro := nullif(btrim(new.bairro), '');

  if v_tipo = 'imovel' then
    if not v_loja then
      raise exception 'a Loja não está liberada para este perfil' using errcode = '42501';
    end if;
  elsif new.imovel_tipo is not null or new.finalidade is not null or new.area_m2 is not null or new.quartos is not null
        or new.banheiros is not null or new.vagas is not null or new.bairro is not null
        or new.condominio_centavos is not null or new.iptu_centavos is not null or new.aceita_financiamento is not null then
    raise exception 'campos de imóvel só existem em item do tipo imóvel' using errcode = '23514';
  end if;

  if cardinality(new.fotos_extras_paths) > 0 then
    if not v_loja then
      raise exception 'fotos adicionais exigem a Loja liberada para o perfil' using errcode = '42501';
    end if;
    if exists (
      select 1 from unnest(new.fotos_extras_paths) as e (p)
      where e.p is null or e.p !~ ('^item/' || new.item_id::text || '/[A-Za-z0-9._-]{1,100}$')) then
      raise exception 'caminho de foto adicional fora da pasta do item' using errcode = '23514';
    end if;
    if (select count(distinct e.p) from unnest(new.fotos_extras_paths) as e (p)) <> cardinality(new.fotos_extras_paths) then
      raise exception 'foto adicional repetida' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.catalogo_item_versao_validar_loja() from public, anon, authenticated;
create trigger catalogo_item_versao_validar_loja before insert or update on public.catalogo_item_versao
  for each row execute function public.catalogo_item_versao_validar_loja();

-- Envio: imóvel só segue para aprovação completo (anúncio particular continua exigindo cidade e UF) ------------------
create or replace function public.catalogo_enviar_item_versao(p_versao_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_v public.catalogo_item_versao%rowtype;
  v_perfil uuid;
  v_tipo text;
begin
  if v_uid is null then
    raise exception 'não autenticado' using errcode = '42501';
  end if;
  select v.* into v_v
  from public.catalogo_item_versao v join public.catalogo_item i on i.id = v.item_id
  where v.id = p_versao_id and i.conta_id = v_uid
  for update of v;
  if not found then
    raise exception 'versão não encontrada' using errcode = '42501';
  end if;
  if v_v.situacao <> 'rascunho' then
    raise exception 'só rascunho pode ser enviado' using errcode = 'P0001';
  end if;
  select i.perfil_id, i.tipo into v_perfil, v_tipo from public.catalogo_item i where i.id = v_v.item_id;
  if v_perfil is null and (v_v.cidade is null or v_v.uf is null) then
    raise exception 'anúncio particular exige cidade e UF' using errcode = '23514';
  end if;
  if v_tipo = 'imovel' and (v_v.imovel_tipo is null or v_v.finalidade is null or v_v.preco_modo is null
      or v_v.area_m2 is null or v_v.quartos is null or v_v.banheiros is null or v_v.vagas is null
      or v_v.bairro is null or v_v.cidade is null or v_v.uf is null) then
    raise exception 'imóvel exige tipo, finalidade, preço, área, quartos, banheiros, vagas, bairro, cidade e UF' using errcode = '23514';
  end if;
  update public.catalogo_item_versao set situacao = 'pendente', enviada_em = now() where id = p_versao_id;
end $$;
