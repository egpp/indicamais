-- Fase 2A (correções) · criação atômica de perfil/item, gravação de versão e resultado da revisão ao responsável
-- IM-006, IM-011, IM-014, IM-015, IM-016, IM-021, IM-022, IM-023, IM-029, IM-086
--
-- VISÕES SECURITY DEFINER (perfis_meus_perfis, catalogo_meus_itens, administracao_meus_resultados), sem security_invoker
-- de propósito. O Security Advisor do Supabase (lint 0010 "Security Definer View") vai alertar; o alerta é esperado.
-- Justificativa: o responsável não tem SELECT em responsavel_id/conta_id nem nas tabelas de revisão (autor_id é o id
-- real do administrador). Cada visão roda com os direitos do dono e tem filtro FIXO por auth.uid(), sem parâmetro,
-- sem acesso a anon (revoke all) e só com colunas seguras. O responsável lê resultado de revisão SOMENTE por
-- administracao_meus_resultados (autor_ref opaco). Decisão do gestor.
--
-- Por que RPC e não INSERT direto: perfil sem versão, item sem versão e versão sem WhatsApp comercial seriam estados
-- parciais. Cada função abaixo roda numa única transação: qualquer falha desfaz tudo.
-- Todas: SECURITY DEFINER, search_path vazio, usam auth.uid() como único responsável (não há parâmetro de dono,
-- então A não consegue criar nem editar em nome de B), e só authenticated tem EXECUTE.
-- Imagens: o perfil/item ainda não existe antes da criação, então o rascunho nasce SEM imagem; depois do upload
-- (perfil/<perfil_id>/<arquivo>), os caminhos são gravados por perfis_gravar_versao. O WhatsApp comercial deve
-- chegar normalizado em E.164 (+55…); o banco valida o formato (CHECK) mas não normaliza.

-- ---------------------------------------------------------------------------------------------------------
-- perfis_criar_rascunho: perfil + 1ª versão (rascunho) + WhatsApp comercial
-- ---------------------------------------------------------------------------------------------------------
create function public.perfis_criar_rascunho(
  p_slug text,
  p_whatsapp_comercial text,
  p_nome text default null,
  p_descricao_breve text default null,
  p_categoria_principal_id uuid default null,
  p_categoria_secundaria_1_id uuid default null,
  p_categoria_secundaria_2_id uuid default null,
  p_cidade text default null,
  p_uf text default null,
  p_endereco text default null,
  p_areas_atendidas text[] default '{}',
  p_site text default null,
  p_informacoes_sociais text default null
) returns table (o_perfil_id uuid, o_versao_id uuid)
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_perfil uuid;
  v_versao uuid;
begin
  if v_uid is null then
    raise exception 'não autenticado' using errcode = '42501';
  end if;
  if p_whatsapp_comercial is null then
    raise exception 'WhatsApp comercial é obrigatório' using errcode = '23514';
  end if;

  insert into public.perfis_perfil (responsavel_id, slug) values (v_uid, p_slug) returning id into v_perfil;

  insert into public.perfis_perfil_versao (perfil_id, nome, descricao_breve, categoria_principal_id,
    categoria_secundaria_1_id, categoria_secundaria_2_id, cidade, uf, endereco, areas_atendidas, site, informacoes_sociais)
  values (v_perfil, p_nome, p_descricao_breve, p_categoria_principal_id, p_categoria_secundaria_1_id,
    p_categoria_secundaria_2_id, p_cidade, p_uf, p_endereco, coalesce(p_areas_atendidas, '{}'), p_site, p_informacoes_sociais)
  returning id into v_versao;

  insert into public.perfis_perfil_versao_contato (versao_id, whatsapp_comercial_e164) values (v_versao, p_whatsapp_comercial);

  o_perfil_id := v_perfil;
  o_versao_id := v_versao;
  return next;
end $$;

-- ---------------------------------------------------------------------------------------------------------
-- perfis_gravar_versao: grava o conteúdo completo do rascunho (cria o rascunho se não houver) + WhatsApp comercial
-- Semântica de substituição: o que vier é o novo conteúdo do rascunho (inclusive nulos e arrays vazios).
-- Se já há versão pendente, recusa (P0001): o conteúdo enviado é imutável até a decisão.
-- ---------------------------------------------------------------------------------------------------------
create function public.perfis_gravar_versao(
  p_perfil_id uuid,
  p_whatsapp_comercial text,
  p_nome text default null,
  p_descricao_breve text default null,
  p_imagem_path text default null,
  p_categoria_principal_id uuid default null,
  p_categoria_secundaria_1_id uuid default null,
  p_categoria_secundaria_2_id uuid default null,
  p_cidade text default null,
  p_uf text default null,
  p_endereco text default null,
  p_areas_atendidas text[] default '{}',
  p_banners_paths text[] default '{}',
  p_fotos_paths text[] default '{}',
  p_site text default null,
  p_informacoes_sociais text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_versao uuid;
  v_sit text;
begin
  if v_uid is null then
    raise exception 'não autenticado' using errcode = '42501';
  end if;
  if p_whatsapp_comercial is null then
    raise exception 'WhatsApp comercial é obrigatório' using errcode = '23514';
  end if;
  -- Trava o perfil do próprio responsável (serializa gravações concorrentes).
  perform 1 from public.perfis_perfil where id = p_perfil_id and responsavel_id = v_uid for update;
  if not found then
    raise exception 'perfil não encontrado' using errcode = '42501';
  end if;

  select v.id, v.situacao into v_versao, v_sit
  from public.perfis_perfil_versao v
  where v.perfil_id = p_perfil_id and v.situacao in ('rascunho', 'pendente');

  if v_sit = 'pendente' then
    raise exception 'versão pendente não pode ser editada' using errcode = 'P0001';
  end if;

  if v_versao is null then
    insert into public.perfis_perfil_versao (perfil_id, nome, descricao_breve, imagem_path, categoria_principal_id,
      categoria_secundaria_1_id, categoria_secundaria_2_id, cidade, uf, endereco, areas_atendidas, banners_paths,
      fotos_paths, site, informacoes_sociais)
    values (p_perfil_id, p_nome, p_descricao_breve, p_imagem_path, p_categoria_principal_id,
      p_categoria_secundaria_1_id, p_categoria_secundaria_2_id, p_cidade, p_uf, p_endereco,
      coalesce(p_areas_atendidas, '{}'), coalesce(p_banners_paths, '{}'), coalesce(p_fotos_paths, '{}'), p_site,
      p_informacoes_sociais)
    returning id into v_versao;
  else
    update public.perfis_perfil_versao set
      nome = p_nome, descricao_breve = p_descricao_breve, imagem_path = p_imagem_path,
      categoria_principal_id = p_categoria_principal_id, categoria_secundaria_1_id = p_categoria_secundaria_1_id,
      categoria_secundaria_2_id = p_categoria_secundaria_2_id, cidade = p_cidade, uf = p_uf, endereco = p_endereco,
      areas_atendidas = coalesce(p_areas_atendidas, '{}'), banners_paths = coalesce(p_banners_paths, '{}'),
      fotos_paths = coalesce(p_fotos_paths, '{}'), site = p_site, informacoes_sociais = p_informacoes_sociais
    where id = v_versao;
  end if;

  insert into public.perfis_perfil_versao_contato (versao_id, whatsapp_comercial_e164)
  values (v_versao, p_whatsapp_comercial)
  on conflict (versao_id) do update set whatsapp_comercial_e164 = excluded.whatsapp_comercial_e164;

  return v_versao;
end $$;

-- ---------------------------------------------------------------------------------------------------------
-- catalogo_criar_item: item + 1ª versão (rascunho). Perfil opcional (nulo = anúncio particular, IM-015).
-- Item de perfil exige que o perfil seja do próprio usuário (FK composta perfil_id + conta_id: 23503 caso contrário).
-- ---------------------------------------------------------------------------------------------------------
create function public.catalogo_criar_item(
  p_tipo text,
  p_perfil_id uuid default null,
  p_nome text default null,
  p_descricao text default null,
  p_categoria_principal_id uuid default null,
  p_categoria_secundaria_1_id uuid default null,
  p_categoria_secundaria_2_id uuid default null,
  p_preco_modo text default null,
  p_preco_centavos bigint default null
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
    categoria_secundaria_1_id, categoria_secundaria_2_id, preco_modo, preco_centavos)
  values (v_item, p_nome, p_descricao, p_categoria_principal_id, p_categoria_secundaria_1_id,
    p_categoria_secundaria_2_id, p_preco_modo, p_preco_centavos)
  returning id into v_versao;
  o_item_id := v_item;
  o_versao_id := v_versao;
  return next;
end $$;

revoke all on function public.perfis_criar_rascunho(text, text, text, text, uuid, uuid, uuid, text, text, text, text[], text, text) from public, anon;
revoke all on function public.perfis_gravar_versao(uuid, text, text, text, text, uuid, uuid, uuid, text, text, text, text[], text[], text[], text, text) from public, anon;
revoke all on function public.catalogo_criar_item(text, uuid, text, text, uuid, uuid, uuid, text, bigint) from public, anon;
grant execute on function public.perfis_criar_rascunho(text, text, text, text, uuid, uuid, uuid, text, text, text, text[], text, text) to authenticated;
grant execute on function public.perfis_gravar_versao(uuid, text, text, text, text, uuid, uuid, uuid, text, text, text, text[], text[], text[], text, text) to authenticated;
grant execute on function public.catalogo_criar_item(text, uuid, text, text, uuid, uuid, uuid, text, bigint) to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- IM-023: resultado da revisão para o RESPONSÁVEL
-- Uma linha por versão ENVIADA (pendente, aprovada ou rejeitada) dos perfis e itens do usuário logado.
-- Visão com os direitos do dono da visão (o usuário não tem SELECT em responsavel_id/conta_id) e filtro fixo
-- por auth.uid(): não devolve nada de outras contas. Não é acessível a anon.
--   autor_ref: identificador OPACO de quem decidiu (sha256 do id do administrador). Sem id real, nome ou e-mail;
--              o mesmo administrador gera sempre o mesmo valor. Nulo enquanto pendente.
--   versao_vigente: true se esta é a versão aprovada que o perfil/item aponta (a que está no ar quando publicado).
--   publicado: liga/desliga atual do perfil/item. slug: só perfil (nulo para item).
-- ---------------------------------------------------------------------------------------------------------
create view public.administracao_meus_resultados as
select 'perfil'::text as tipo, v.perfil_id as alvo_id, v.id as versao_id, v.situacao, v.nome,
       r.motivo, r.decidida_em, v.enviada_em,
       encode(sha256(convert_to('indicamais:autor:' || r.autor_id::text, 'UTF8')), 'hex') as autor_ref,
       p.slug, p.publicado, (p.versao_aprovada_id = v.id) as versao_vigente
from public.perfis_perfil_versao v
join public.perfis_perfil p on p.id = v.perfil_id
left join public.perfis_revisao r on r.versao_id = v.id
where p.responsavel_id = (select auth.uid()) and v.situacao <> 'rascunho'
union all
select 'item'::text, v.item_id, v.id, v.situacao, v.nome,
       r.motivo, r.decidida_em, v.enviada_em,
       encode(sha256(convert_to('indicamais:autor:' || r.autor_id::text, 'UTF8')), 'hex'),
       null::text, i.publicado, (i.versao_aprovada_id = v.id)
from public.catalogo_item_versao v
join public.catalogo_item i on i.id = v.item_id
left join public.catalogo_item_revisao r on r.versao_id = v.id
where i.conta_id = (select auth.uid()) and v.situacao <> 'rascunho';
revoke all on public.administracao_meus_resultados from anon, authenticated;
grant select on public.administracao_meus_resultados to authenticated;
