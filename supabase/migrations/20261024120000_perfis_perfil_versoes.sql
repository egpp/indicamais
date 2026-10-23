-- Fase 2A · módulo perfis · perfis comerciais, versões e revisão · IM-006, IM-011, IM-012, IM-016, IM-017,
-- IM-021, IM-022, IM-023, IM-079, IM-086
--
-- DESENHO DO CICLO DE PUBLICAÇÃO (IM-021, IM-022, IM-017, IM-079)
--   perfis_perfil          identidade estável (slug, responsável) + 2 ponteiros de estado:
--                            publicado          (liga/desliga do responsável; despublicar é imediato)
--                            versao_aprovada_id (versão que está no ar; só muda por função de administrador)
--   perfis_perfil_versao   o CONTEÚDO. Cada edição é uma linha nova. situacao:
--                            rascunho -> pendente -> aprovada | rejeitada
--                          Rascunho é editável só pelo dono (isso é a prévia, IM-017: o dono lê o próprio
--                          rascunho/pendente sem torná-lo público). Depois de enviada, o conteúdo é
--                          IMUTÁVEL (gatilho vale até para service_role); só `situacao` avança, e só por função.
--                          No máximo UMA versão aberta (rascunho ou pendente) por perfil (índice único parcial).
--   perfis_perfil_versao_contato  WhatsApp comercial da versão, em tabela à parte para nunca sair em leitura
--                          pública (IM-029). Mesmas regras de congelamento da versão.
--   perfis_revisao         decisão de revisão (aprovada/rejeitada), só inserção: autor, data, motivo e a versão
--                          aprovada anterior (valor anterior). Uma linha por versão decidida.
--   Público = perfil.publicado E perfil.versao_aprovada_id apontando para versão 'aprovada'. Isso vale nas
--   políticas RLS e na visão perfis_perfil_publico. Editar um perfil público cria nova versão (pendente após
--   enviar); a aprovada segue no ar até a nova ser aprovada. Rejeitar a nova não derruba a aprovada. Aprovar
--   não altera `publicado`: se o dono despublicou, aprovar a edição NÃO republica.
--   O dono não tem privilégio de coluna para situacao, versao_aprovada_id nem nada de revisão.
--   Aprovar/rejeitar: perfis_decidir_versao(), só administrador, nunca o próprio dono (mesmo sendo admin).
--
-- PRIVACIDADE DO RESPONSÁVEL (IM-029, IM-086)
--   * Nenhuma leitura pública (anon ou outro usuário logado) alcança responsavel_id: o privilégio de SELECT dessa
--     coluna não é concedido a anon nem a authenticated. As políticas que precisam do dono usam funções
--     SECURITY DEFINER (perfis_eh_dono*). O dono lista os próprios perfis pela visão perfis_meus_perfis.
--   * Caminhos de imagem são OPACOS: perfil/<perfil_id>/<arquivo>. Nunca contêm conta_id/responsavel_id.
--     O perfil_id já é público (aparece na visão pública); quem prova que a pasta é do dono é o banco
--     (ver 20261024140000). Nome do arquivo: o app gera <uuid-aleatório>.<jpg|png|webp>.
--   * Perfis NÃO nascem por INSERT direto: perfis_criar_rascunho() (migração 20261024150000) cria perfil +
--     primeira versão + WhatsApp numa transação, sempre com responsável = auth.uid().

-- Base compartilhada com catalogo (itens): proteção de versões enviadas.
-- TG_ARGV[0] = nome da coluna que aponta para o pai (perfil_id ou item_id).
create function public.catalogo_versao_proteger() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_pai text := tg_argv[0];
begin
  if tg_op = 'DELETE' then
    if old.situacao <> 'rascunho' then
      raise exception 'versão enviada é histórico e não pode ser apagada' using errcode = '42501';
    end if;
    return old;
  end if;
  if new.id <> old.id or (to_jsonb(new) ->> v_pai) is distinct from (to_jsonb(old) ->> v_pai)
     or new.criado_em <> old.criado_em then
    raise exception 'identidade da versão é imutável' using errcode = '42501';
  end if;
  if old.situacao = 'rascunho' then
    if new.situacao not in ('rascunho', 'pendente') then
      raise exception 'rascunho só pode ser enviado (pendente)' using errcode = '42501';
    end if;
    return new;
  end if;
  -- Versão enviada: o conteúdo nunca muda.
  if (to_jsonb(new) - 'situacao' - 'enviada_em') is distinct from (to_jsonb(old) - 'situacao' - 'enviada_em')
     or new.enviada_em is distinct from old.enviada_em then
    raise exception 'versão enviada é imutável' using errcode = '42501';
  end if;
  if new.situacao <> old.situacao and not (old.situacao = 'pendente' and new.situacao in ('aprovada', 'rejeitada')) then
    raise exception 'transição de situação inválida: % -> %', old.situacao, new.situacao using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function public.catalogo_versao_proteger() from public, anon, authenticated;

-- Perfil comercial -----------------------------------------------------------------------------------------
create table public.perfis_perfil (
  id uuid primary key default gen_random_uuid(),
  responsavel_id uuid not null references public.contas_conta (id) on delete restrict,
  slug text not null,
  publicado boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint perfis_perfil_slug_formato check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 60),
  constraint perfis_perfil_slug_unico unique (slug),
  constraint perfis_perfil_id_responsavel_unico unique (id, responsavel_id)
);
create index perfis_perfil_responsavel_idx on public.perfis_perfil (responsavel_id);
comment on table public.perfis_perfil is 'Perfil comercial. Uma conta pode ter vários (IM-006); um responsável por perfil.';

create table public.perfis_perfil_versao (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references public.perfis_perfil (id) on delete restrict,
  situacao text not null default 'rascunho',
  nome text,
  descricao_breve text,
  imagem_path text,
  categoria_principal_id uuid references public.catalogo_categoria (id) on delete restrict,
  categoria_secundaria_1_id uuid references public.catalogo_categoria (id) on delete restrict,
  categoria_secundaria_2_id uuid references public.catalogo_categoria (id) on delete restrict,
  cidade text,
  uf text,
  endereco text,
  areas_atendidas text[] not null default '{}',
  banners_paths text[] not null default '{}',
  fotos_paths text[] not null default '{}',
  site text,
  informacoes_sociais text,
  criado_em timestamptz not null default now(),
  enviada_em timestamptz,
  constraint perfis_versao_id_perfil_unico unique (id, perfil_id),
  constraint perfis_versao_situacao check (situacao in ('rascunho', 'pendente', 'aprovada', 'rejeitada')),
  constraint perfis_versao_enviada_coerente check ((situacao = 'rascunho') = (enviada_em is null)),
  constraint perfis_versao_nome check (nome is null or char_length(btrim(nome)) between 1 and 80),
  constraint perfis_versao_descricao check (descricao_breve is null or char_length(btrim(descricao_breve)) between 1 and 280),
  constraint perfis_versao_cidade check (cidade is null or char_length(btrim(cidade)) between 1 and 80),
  constraint perfis_versao_uf check (uf is null or uf in (
    'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')),
  constraint perfis_versao_endereco check (endereco is null or char_length(endereco) <= 200),
  constraint perfis_versao_areas check (cardinality(areas_atendidas) <= 20 and char_length(array_to_string(areas_atendidas, ',')) <= 600),
  -- Imagens (D-006): 1 imagem principal + até 3 banners + até 6 fotos.
  constraint perfis_versao_banners check (cardinality(banners_paths) <= 3),
  constraint perfis_versao_fotos check (cardinality(fotos_paths) <= 6),
  constraint perfis_versao_site check (site is null or site ~ '^https?://[^[:space:]]{4,200}$'),
  -- IM-012: informações sociais só como texto; nada que pareça link ou domínio.
  constraint perfis_versao_sociais check (
    informacoes_sociais is null
    or (char_length(informacoes_sociais) <= 500
        and informacoes_sociais !~* '(https?:|www\.|[a-z0-9]\.(com|net|org|br|me|io|link|app|gg|ly)([^a-z]|$))')),
  -- IM-016: principal + até 2 secundárias, sem repetir e sem pular a primeira secundária.
  constraint perfis_versao_categorias check (
    (categoria_secundaria_2_id is null or categoria_secundaria_1_id is not null)
    and (categoria_secundaria_1_id is null or categoria_principal_id is not null)
    and (categoria_secundaria_1_id is null or categoria_secundaria_1_id <> categoria_principal_id)
    and (categoria_secundaria_2_id is null or categoria_secundaria_2_id <> categoria_principal_id)
    and (categoria_secundaria_2_id is null or categoria_secundaria_2_id <> categoria_secundaria_1_id)),
  -- IM-011: o que a página exige precisa existir antes de sair de rascunho.
  constraint perfis_versao_completa check (
    situacao = 'rascunho'
    or (nome is not null and descricao_breve is not null and imagem_path is not null
        and categoria_principal_id is not null and cidade is not null and uf is not null))
);
create unique index perfis_versao_uma_aberta on public.perfis_perfil_versao (perfil_id) where situacao in ('rascunho', 'pendente');
create index perfis_versao_pendentes_idx on public.perfis_perfil_versao (enviada_em) where situacao = 'pendente';
create index perfis_versao_perfil_idx on public.perfis_perfil_versao (perfil_id, criado_em desc);

-- Ponteiro da versão no ar. Só pode apontar para versão do próprio perfil (FK composta).
alter table public.perfis_perfil add column versao_aprovada_id uuid;
alter table public.perfis_perfil
  add constraint perfis_perfil_versao_aprovada_fk foreign key (versao_aprovada_id, id)
  references public.perfis_perfil_versao (id, perfil_id) on delete restrict;
-- Só se publica o que foi aprovado.
alter table public.perfis_perfil
  add constraint perfis_perfil_publicado_exige_aprovada check (publicado = false or versao_aprovada_id is not null);

-- WhatsApp comercial da versão (nunca verificado: não há coluna de verificação; IM-009/IM-010).
-- Não precisa ser único entre perfis.
create table public.perfis_perfil_versao_contato (
  versao_id uuid primary key references public.perfis_perfil_versao (id) on delete restrict,
  whatsapp_comercial_e164 text not null,
  constraint perfis_contato_whatsapp_formato check (whatsapp_comercial_e164 ~ '^\+55[0-9]{10,11}$')
);

-- Decisões de revisão: só inserção.
create table public.perfis_revisao (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references public.perfis_perfil (id) on delete restrict,
  versao_id uuid not null references public.perfis_perfil_versao (id) on delete restrict,
  decisao text not null,
  motivo text,
  autor_id uuid not null references public.contas_conta (id) on delete restrict,
  decidida_em timestamptz not null default now(),
  versao_aprovada_anterior_id uuid references public.perfis_perfil_versao (id) on delete restrict,
  constraint perfis_revisao_versao_unica unique (versao_id),
  constraint perfis_revisao_decisao check (decisao in ('aprovada', 'rejeitada')),
  constraint perfis_revisao_motivo check (
    (motivo is null or char_length(motivo) <= 500)
    and (decisao = 'aprovada' or (motivo is not null and char_length(btrim(motivo)) > 0)))
);
create index perfis_revisao_perfil_idx on public.perfis_revisao (perfil_id, decidida_em desc);

-- Privilégios ----------------------------------------------------------------------------------------------
revoke all on public.perfis_perfil from anon, authenticated;
revoke all on public.perfis_perfil_versao from anon, authenticated;
revoke all on public.perfis_perfil_versao_contato from anon, authenticated;
revoke all on public.perfis_revisao from anon, authenticated;

-- Anônimo e autenticado: só as colunas públicas do perfil (sem responsavel_id). Sem INSERT direto: ver
-- perfis_criar_rascunho(). O dono lista os próprios perfis por perfis_meus_perfis.
grant select (id, slug, publicado, versao_aprovada_id, criado_em, atualizado_em) on public.perfis_perfil to anon, authenticated;
-- O dono liga/desliga publicado e ajusta o slug (congelado após a 1ª aprovação, por gatilho).
grant update (publicado, slug) on public.perfis_perfil to authenticated;

-- Versão: o anônimo lê só linhas públicas (política); situacao/aprovação nunca são graváveis pelo cliente.
grant select on public.perfis_perfil_versao to anon, authenticated;
grant insert (perfil_id, nome, descricao_breve, imagem_path, categoria_principal_id, categoria_secundaria_1_id,
  categoria_secundaria_2_id, cidade, uf, endereco, areas_atendidas, banners_paths, fotos_paths, site, informacoes_sociais)
  on public.perfis_perfil_versao to authenticated;
grant update (nome, descricao_breve, imagem_path, categoria_principal_id, categoria_secundaria_1_id,
  categoria_secundaria_2_id, cidade, uf, endereco, areas_atendidas, banners_paths, fotos_paths, site, informacoes_sociais)
  on public.perfis_perfil_versao to authenticated;
grant delete on public.perfis_perfil_versao to authenticated;

grant select on public.perfis_perfil_versao_contato to authenticated;
grant insert (versao_id, whatsapp_comercial_e164) on public.perfis_perfil_versao_contato to authenticated;
grant update (whatsapp_comercial_e164) on public.perfis_perfil_versao_contato to authenticated;
grant delete on public.perfis_perfil_versao_contato to authenticated;

grant select on public.perfis_revisao to authenticated;

alter table public.perfis_perfil enable row level security;
alter table public.perfis_perfil force row level security;
alter table public.perfis_perfil_versao enable row level security;
alter table public.perfis_perfil_versao force row level security;
alter table public.perfis_perfil_versao_contato enable row level security;
alter table public.perfis_perfil_versao_contato force row level security;
alter table public.perfis_revisao enable row level security;
alter table public.perfis_revisao force row level security;

-- Disponibilidade (IM-079): perfil publicado com versão aprovada no ar. As Fases 3/4 usam para
-- indicações, pontos e resgates. Só devolve boolean, sem dados do perfil.
create function public.perfis_perfil_disponivel(p_perfil_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.perfis_perfil p
    join public.perfis_perfil_versao v on v.id = p.versao_aprovada_id and v.situacao = 'aprovada'
    where p.id = p_perfil_id and p.publicado
  );
$$;
revoke all on function public.perfis_perfil_disponivel(uuid) from public;
grant execute on function public.perfis_perfil_disponivel(uuid) to anon, authenticated;

-- Quem é o dono? Funções SECURITY DEFINER para que as políticas não precisem de SELECT em responsavel_id.
create function public.perfis_eh_dono(p_perfil_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.perfis_perfil p
    where p.id = p_perfil_id and p.responsavel_id = (select auth.uid()));
$$;
create function public.perfis_eh_dono_da_versao(p_versao_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.perfis_perfil_versao v join public.perfis_perfil p on p.id = v.perfil_id
    where v.id = p_versao_id and p.responsavel_id = (select auth.uid()));
$$;
revoke all on function public.perfis_eh_dono(uuid) from public, anon;
revoke all on function public.perfis_eh_dono_da_versao(uuid) from public, anon;
grant execute on function public.perfis_eh_dono(uuid) to authenticated;
grant execute on function public.perfis_eh_dono_da_versao(uuid) to authenticated;

-- Políticas: perfis_perfil ---------------------------------------------------------------------------------
create policy perfis_perfil_select_publico on public.perfis_perfil
  for select to anon, authenticated using (publicado and versao_aprovada_id is not null);
create policy perfis_perfil_select_proprio on public.perfis_perfil
  for select to authenticated using (responsavel_id = (select auth.uid()));
create policy perfis_perfil_select_admin on public.perfis_perfil
  for select to authenticated using ((select public.administracao_eh_admin()));
-- Criação só por perfis_criar_rascunho() (atômica). Sem INSERT direto.
create policy perfis_perfil_insert_negado on public.perfis_perfil
  for insert to authenticated with check (false);
create policy perfis_perfil_update_proprio on public.perfis_perfil
  for update to authenticated
  using (responsavel_id = (select auth.uid())) with check (responsavel_id = (select auth.uid()));
create policy perfis_perfil_delete_negado on public.perfis_perfil
  for delete to authenticated using (false);

-- Políticas: perfis_perfil_versao --------------------------------------------------------------------------
-- Público: só a versão que o perfil aponta como aprovada, com o perfil publicado.
create policy perfis_versao_select_publica on public.perfis_perfil_versao
  for select to anon, authenticated using (
    situacao = 'aprovada' and exists (
      select 1 from public.perfis_perfil p
      where p.id = perfil_id and p.versao_aprovada_id = perfis_perfil_versao.id and p.publicado));
create policy perfis_versao_select_propria on public.perfis_perfil_versao
  for select to authenticated using ((select public.perfis_eh_dono(perfil_id)));
create policy perfis_versao_select_admin on public.perfis_perfil_versao
  for select to authenticated using ((select public.administracao_eh_admin()));
-- Nova versão sempre nasce rascunho (situacao não é gravável pelo cliente).
create policy perfis_versao_insert_propria on public.perfis_perfil_versao
  for insert to authenticated with check ((select public.perfis_eh_dono(perfil_id)));
create policy perfis_versao_update_propria on public.perfis_perfil_versao
  for update to authenticated
  using (situacao = 'rascunho' and (select public.perfis_eh_dono(perfil_id)))
  with check ((select public.perfis_eh_dono(perfil_id)));
create policy perfis_versao_delete_propria on public.perfis_perfil_versao
  for delete to authenticated using (situacao = 'rascunho' and (select public.perfis_eh_dono(perfil_id)));

-- Políticas: perfis_perfil_versao_contato ------------------------------------------------------------------
create policy perfis_contato_select_proprio on public.perfis_perfil_versao_contato
  for select to authenticated using ((select public.perfis_eh_dono_da_versao(versao_id)));
create policy perfis_contato_select_admin on public.perfis_perfil_versao_contato
  for select to authenticated using ((select public.administracao_eh_admin()));
create policy perfis_contato_insert_proprio on public.perfis_perfil_versao_contato
  for insert to authenticated with check ((select public.perfis_eh_dono_da_versao(versao_id)));
create policy perfis_contato_update_proprio on public.perfis_perfil_versao_contato
  for update to authenticated
  using ((select public.perfis_eh_dono_da_versao(versao_id)))
  with check ((select public.perfis_eh_dono_da_versao(versao_id)));
create policy perfis_contato_delete_proprio on public.perfis_perfil_versao_contato
  for delete to authenticated using ((select public.perfis_eh_dono_da_versao(versao_id)));

-- Políticas: perfis_revisao --------------------------------------------------------------------------------
create policy perfis_revisao_select_propria on public.perfis_revisao
  for select to authenticated using ((select public.perfis_eh_dono(perfil_id)));
create policy perfis_revisao_select_admin on public.perfis_revisao
  for select to authenticated using ((select public.administracao_eh_admin()));
create policy perfis_revisao_insert_negado on public.perfis_revisao
  for insert to authenticated with check (false);
create policy perfis_revisao_update_negado on public.perfis_revisao
  for update to authenticated using (false) with check (false);
create policy perfis_revisao_delete_negado on public.perfis_revisao
  for delete to authenticated using (false);

-- Gatilhos -------------------------------------------------------------------------------------------------
create trigger perfis_perfil_tocar before update on public.perfis_perfil
  for each row execute function public.catalogo_tocar_atualizado_em();

-- Slug vira endereço público: congelado depois da primeira aprovação; responsável e id nunca mudam.
create function public.perfis_perfil_proteger() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.id <> old.id or new.responsavel_id <> old.responsavel_id then
    raise exception 'id e responsável do perfil são imutáveis' using errcode = '42501';
  end if;
  if old.versao_aprovada_id is not null and new.slug <> old.slug then
    raise exception 'slug não muda depois da primeira aprovação' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function public.perfis_perfil_proteger() from public, anon, authenticated;
create trigger perfis_perfil_proteger before update on public.perfis_perfil
  for each row execute function public.perfis_perfil_proteger();

create trigger perfis_versao_proteger before update or delete on public.perfis_perfil_versao
  for each row execute function public.catalogo_versao_proteger('perfil_id');

-- Categorias ativas e caminhos de imagem dentro da pasta OPACA do próprio perfil: perfil/<perfil_id>/<arquivo>.
create function public.perfis_versao_validar() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_cat uuid;
  v_path text;
begin
  if new.situacao not in ('rascunho', 'pendente') then
    return new;
  end if;
  foreach v_cat in array array[new.categoria_principal_id, new.categoria_secundaria_1_id, new.categoria_secundaria_2_id] loop
    if v_cat is not null and not exists (select 1 from public.catalogo_categoria where id = v_cat and ativa) then
      raise exception 'categoria inexistente ou inativa' using errcode = '23514';
    end if;
  end loop;
  foreach v_path in array (array[new.imagem_path] || new.banners_paths || new.fotos_paths) loop
    if v_path is not null and v_path !~ ('^perfil/' || new.perfil_id::text || '/[A-Za-z0-9._-]{1,100}$') then
      raise exception 'caminho de imagem fora da pasta do perfil' using errcode = '23514';
    end if;
  end loop;
  return new;
end $$;
revoke all on function public.perfis_versao_validar() from public, anon, authenticated;
create trigger perfis_versao_validar before insert or update on public.perfis_perfil_versao
  for each row execute function public.perfis_versao_validar();

create function public.perfis_contato_proteger() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := case when tg_op = 'DELETE' then old.versao_id else new.versao_id end;
  v_sit text;
begin
  select situacao into v_sit from public.perfis_perfil_versao where id = v_id;
  if v_sit is distinct from 'rascunho' then
    raise exception 'WhatsApp comercial de versão enviada é imutável' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and new.versao_id <> old.versao_id then
    raise exception 'versão do contato é imutável' using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
revoke all on function public.perfis_contato_proteger() from public, anon, authenticated;
create trigger perfis_contato_proteger before insert or update or delete on public.perfis_perfil_versao_contato
  for each row execute function public.perfis_contato_proteger();

create trigger perfis_revisao_imutavel before update or delete on public.perfis_revisao
  for each row execute function public.administracao_registro_imutavel();

-- Funções do ciclo -----------------------------------------------------------------------------------------
-- O dono envia o rascunho para aprovação (rascunho -> pendente).
create function public.perfis_enviar_versao(p_versao_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_sit text;
begin
  if v_uid is null then
    raise exception 'não autenticado' using errcode = '42501';
  end if;
  select v.situacao into v_sit
  from public.perfis_perfil_versao v join public.perfis_perfil p on p.id = v.perfil_id
  where v.id = p_versao_id and p.responsavel_id = v_uid
  for update of v;
  if not found then
    raise exception 'versão não encontrada' using errcode = '42501';
  end if;
  if v_sit <> 'rascunho' then
    raise exception 'só rascunho pode ser enviado' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.perfis_perfil_versao_contato where versao_id = p_versao_id) then
    raise exception 'WhatsApp comercial é obrigatório' using errcode = '23514';
  end if;
  update public.perfis_perfil_versao set situacao = 'pendente', enviada_em = now() where id = p_versao_id;
end $$;

-- Administrador aprova ou rejeita (rejeição exige motivo). Nunca o próprio dono.
create function public.perfis_decidir_versao(p_versao_id uuid, p_aprovar boolean, p_motivo text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := public.administracao_exigir_admin();
  v_perfil uuid;
  v_dono uuid;
  v_sit text;
  v_anterior uuid;
begin
  select v.perfil_id, p.responsavel_id, v.situacao, p.versao_aprovada_id
    into v_perfil, v_dono, v_sit, v_anterior
  from public.perfis_perfil_versao v join public.perfis_perfil p on p.id = v.perfil_id
  where v.id = p_versao_id
  for update of v, p;
  if not found then
    raise exception 'versão não encontrada' using errcode = 'P0002';
  end if;
  if v_dono = v_admin then
    raise exception 'o responsável não decide o próprio conteúdo' using errcode = '42501';
  end if;
  if v_sit <> 'pendente' then
    raise exception 'só versão pendente pode ser decidida' using errcode = 'P0001';
  end if;
  if not p_aprovar and (p_motivo is null or btrim(p_motivo) = '') then
    raise exception 'motivo obrigatório na rejeição' using errcode = '22023';
  end if;
  insert into public.perfis_revisao (perfil_id, versao_id, decisao, motivo, autor_id, versao_aprovada_anterior_id)
  values (v_perfil, p_versao_id, case when p_aprovar then 'aprovada' else 'rejeitada' end,
          nullif(left(btrim(coalesce(p_motivo, '')), 500), ''), v_admin, v_anterior);
  update public.perfis_perfil_versao
     set situacao = case when p_aprovar then 'aprovada' else 'rejeitada' end
   where id = p_versao_id;
  if p_aprovar then
    update public.perfis_perfil set versao_aprovada_id = p_versao_id where id = v_perfil;
  end if;
end $$;

revoke all on function public.perfis_enviar_versao(uuid) from public, anon;
revoke all on function public.perfis_decidir_versao(uuid, boolean, text) from public, anon;
grant execute on function public.perfis_enviar_versao(uuid) to authenticated;
grant execute on function public.perfis_decidir_versao(uuid, boolean, text) to authenticated;

-- Visão pública: só aprovado E publicado, só colunas públicas (sem responsável, sem WhatsApp, sem e-mail).
-- imagem_path, banners_paths e fotos_paths têm o formato opaco perfil/<perfil_id>/<arquivo>.
create view public.perfis_perfil_publico with (security_invoker = true) as
select p.id, p.slug, v.nome, v.descricao_breve, v.imagem_path,
       v.categoria_principal_id, v.categoria_secundaria_1_id, v.categoria_secundaria_2_id,
       v.cidade, v.uf, v.endereco, v.areas_atendidas, v.banners_paths, v.fotos_paths,
       v.site, v.informacoes_sociais
from public.perfis_perfil p
join public.perfis_perfil_versao v on v.id = p.versao_aprovada_id and v.situacao = 'aprovada'
where p.publicado;
revoke all on public.perfis_perfil_publico from anon, authenticated;
grant select on public.perfis_perfil_publico to anon, authenticated;

-- O dono lista os próprios perfis (a tabela não entrega responsavel_id a ninguém). Visão com os direitos do
-- dono da visão (NÃO é security_invoker) e filtro fixo por auth.uid(): nunca devolve linha de outra conta.
create view public.perfis_meus_perfis as
select p.id, p.slug, p.publicado, p.versao_aprovada_id, p.criado_em, p.atualizado_em
from public.perfis_perfil p
where p.responsavel_id = (select auth.uid());
revoke all on public.perfis_meus_perfis from anon, authenticated;
grant select on public.perfis_meus_perfis to authenticated;
