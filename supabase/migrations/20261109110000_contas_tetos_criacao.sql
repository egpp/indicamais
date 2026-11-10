-- Fase 15 · tetos de criação por conta (perfis, itens, anúncios particulares, rascunhos) · IM-006, IM-011, IM-014, IM-015,
-- IM-086, IM-089, D-035
--
-- DESENHO
--   * Quatro parâmetros auditados em contas_parametro (a tabela e a função administrativa contas_definir_parametro já
--     existem: administrador geral, motivo obrigatório, auditoria com valor anterior e novo; nenhuma tabela nova).
--       tetos_perfis_por_conta           3   (faixa 1 a 50)    perfis comerciais por conta
--       tetos_itens_por_perfil           30  (faixa 1 a 500)   itens (produto/serviço/imóvel) por perfil comercial
--       tetos_anuncios_particulares      10  (faixa 1 a 200)   itens sem perfil (anúncio particular) por conta
--       tetos_rascunhos_abertos          10  (faixa 1 a 100)   perfis e itens ainda NÃO enviados, somados, por conta
--   * Rascunho aberto = perfil ou item que ainda não tem nenhuma versão enviada (todas as versões são 'rascunho').
--     Nova versão em rascunho de algo já enviado não conta (não cria entidade nova).
--   * Aplicado só na CRIAÇÃO (perfis_criar_rascunho e catalogo_criar_item, os dois únicos caminhos que inserem em
--     perfis_perfil e catalogo_item). O que já existe nunca é afetado, mesmo que o teto seja reduzido depois.
--   * Administradores (administracao_administrador) não têm teto.
--   * Sem corrida: contas_exigir_teto_criacao toma pg_advisory_xact_lock por CONTA e conta DEPOIS do lock, na mesma
--     transação do insert. Duas criações simultâneas da mesma conta se serializam (a 4ª de 3 perfis é sempre recusada).
--     O lock só vale até o fim da transação (curta) e não afeta outras contas.
--   * Custo: as contagens usam LIMIT no valor do teto (nunca varrem tudo) e índices existentes por conta/perfil.
--   * Erro padronizado, estável para a aplicação mapear:
--       SQLSTATE  P0430
--       message   'teto_atingido:<chave>'   (chave = a do parâmetro, inteira, uma das quatro acima)
--       detail    'limite=<valor vigente>'
--       hint      '<chave>'
--     A aplicação mapeia pelo SQLSTATE e pela chave (ver relatório da D-035).
--   * Ordem das checagens: primeiro o teto específico (perfis, itens do perfil ou anúncios), depois o de rascunhos.
--   * Imagens não mudam (100 por conta, 6 por perfil/item; IM-089).

insert into public.contas_parametro (chave, valor, minimo, maximo, descricao) values
  ('tetos_perfis_por_conta', 3, 1, 50, 'Máximo de perfis comerciais por conta (administradores sem teto). D-035.'),
  ('tetos_itens_por_perfil', 30, 1, 500, 'Máximo de itens (produtos, serviços, imóveis) por perfil comercial (administradores sem teto). D-035.'),
  ('tetos_anuncios_particulares', 10, 1, 200, 'Máximo de anúncios particulares (itens sem perfil) por conta (administradores sem teto). D-035.'),
  ('tetos_rascunhos_abertos', 10, 1, 100, 'Máximo de rascunhos abertos (perfis e itens ainda não enviados, somados) por conta (administradores sem teto). D-035.');

-- Guarda interna: recusa a criação acima do teto. Só as funções de criação a chamam (sem EXECUTE para a API).
-- p_tipo: 'perfil' | 'item_perfil' (exige p_perfil_id) | 'anuncio'.
create function public.contas_exigir_teto_criacao(p_conta uuid, p_tipo text, p_perfil_id uuid default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_chave text;
  v_lim integer;
  v_usado integer;
  v_lim_rasc integer;
begin
  if p_conta is null or p_tipo is null or p_tipo not in ('perfil', 'item_perfil', 'anuncio') then
    raise exception 'teto de criação: conta e tipo válidos são obrigatórios' using errcode = '22023';
  end if;
  if p_tipo = 'item_perfil' and p_perfil_id is null then
    raise exception 'teto de criação: perfil obrigatório para item de perfil' using errcode = '22023';
  end if;
  -- Administradores não têm teto.
  if exists (select 1 from public.administracao_administrador a where a.conta_id = p_conta) then
    return;
  end if;
  -- Uma criação por vez por conta: a contagem abaixo já enxerga o que a transação anterior confirmou.
  perform pg_advisory_xact_lock(hashtextextended('contas_criacao:' || p_conta::text, 0));

  if p_tipo = 'perfil' then
    v_chave := 'tetos_perfis_por_conta';
    v_lim := public.contas_parametro_valor(v_chave);
    select count(*)::integer into v_usado from (
      select 1 from public.perfis_perfil p where p.responsavel_id = p_conta limit v_lim) s;
  elsif p_tipo = 'item_perfil' then
    v_chave := 'tetos_itens_por_perfil';
    v_lim := public.contas_parametro_valor(v_chave);
    select count(*)::integer into v_usado from (
      select 1 from public.catalogo_item i where i.perfil_id = p_perfil_id and i.conta_id = p_conta limit v_lim) s;
  else
    v_chave := 'tetos_anuncios_particulares';
    v_lim := public.contas_parametro_valor(v_chave);
    select count(*)::integer into v_usado from (
      select 1 from public.catalogo_item i where i.conta_id = p_conta and i.perfil_id is null limit v_lim) s;
  end if;
  if v_usado >= v_lim then
    raise exception 'teto_atingido:%', v_chave using errcode = 'P0430', detail = 'limite=' || v_lim, hint = v_chave;
  end if;

  v_chave := 'tetos_rascunhos_abertos';
  v_lim_rasc := public.contas_parametro_valor(v_chave);
  select count(*)::integer into v_usado from (
    select 1 from public.perfis_perfil p
    where p.responsavel_id = p_conta
      and not exists (select 1 from public.perfis_perfil_versao v where v.perfil_id = p.id and v.situacao <> 'rascunho')
    union all
    select 1 from public.catalogo_item i
    where i.conta_id = p_conta
      and not exists (select 1 from public.catalogo_item_versao v where v.item_id = i.id and v.situacao <> 'rascunho')
    limit v_lim_rasc) s;
  if v_usado >= v_lim_rasc then
    raise exception 'teto_atingido:%', v_chave using errcode = 'P0430', detail = 'limite=' || v_lim_rasc, hint = v_chave;
  end if;
end $$;
revoke all on function public.contas_exigir_teto_criacao(uuid, text, uuid) from public, anon, authenticated;

-- perfis_criar_rascunho: igual à versão de 20261024150000, com o teto antes do insert -----------------------------------
create or replace function public.perfis_criar_rascunho(
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
  perform public.contas_exigir_teto_criacao(v_uid, 'perfil');

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

-- catalogo_criar_item: igual à versão de 20261029100000, com o teto antes do insert -------------------------------------
create or replace function public.catalogo_criar_item(
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
  perform public.contas_exigir_teto_criacao(v_uid, case when p_perfil_id is null then 'anuncio' else 'item_perfil' end, p_perfil_id);
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

-- Valores vigentes para a interface mostrar o limite (só quem está logado; sem dado de conta) ---------------------------
create function public.contas_limites_criacao_atuais() returns table (o_chave text, o_valor integer)
language sql stable security definer set search_path = '' as $$
  select p.chave, p.valor from public.contas_parametro p
  where p.chave in ('tetos_perfis_por_conta', 'tetos_itens_por_perfil', 'tetos_anuncios_particulares', 'tetos_rascunhos_abertos')
    and (select auth.uid()) is not null
  order by p.chave;
$$;
revoke all on function public.contas_limites_criacao_atuais() from public, anon;
grant execute on function public.contas_limites_criacao_atuais() to authenticated;
