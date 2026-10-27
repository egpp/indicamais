-- Fase 2C-1 · patrocinadores internos (carrossel da página inicial) · IM-020, IM-019, IM-079, IM-086
--
-- DECISÕES (documentadas):
--   * Tabela no módulo `administracao` (o administrador escolhe e gerencia): administracao_patrocinador.
--   * SEM cobrança nesta etapa: não existe coluna de preço, plano, pagamento nem valor. Cobrança é futura (módulo
--     planos/pagamentos) e exigirá decisão e migração próprias.
--   * Destino: UM perfil comercial (perfil_destino_id) OU um texto sem link (texto_destino). Nunca URL externa
--     (mesmo critério de IM-012: texto sem http/www/domínio). Exatamente um dos dois.
--   * Só o administrador escreve, por funções SECURITY DEFINER (search_path vazio) que gravam administracao_auditoria
--     (autor, data, motivo, valor anterior/novo) na mesma transação. Não há exclusão: desativa-se (histórico).
--   * Leitura pública (anon e authenticated): só ativo, dentro do período e com destino (se perfil) disponível
--     (IM-079). Imposta DUAS vezes: política RLS e corpo da visão administracao_patrocinador_publico (que também é
--     lida por catalogo_imagem_publica, função definer que não passa por RLS).
--   * Identificação como patrocínio: a visão devolve sempre `identificacao = 'Patrocinado'`; a UI deve exibi-la.
--   * Imagem: caminho OPACO no bucket indicamais-imagens: patrocinador/<id>/<arquivo> (<arquivo> = [A-Za-z0-9._-]{1,100}),
--     mesmos limites do bucket (2 MiB; jpeg/png/webp). O administrador envia pela sessão (política abaixo) ou o
--     servidor envia; o app lê por URL assinada gerada no servidor, sem repassar metadados (owner).

create table public.administracao_patrocinador (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  imagem_path text not null,
  perfil_destino_id uuid references public.perfis_perfil (id) on delete restrict,
  texto_destino text,
  ordem integer not null default 0,
  ativo boolean not null default false,
  inicio_em timestamptz,
  fim_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint administracao_patrocinador_titulo check (char_length(btrim(titulo)) between 2 and 60),
  constraint administracao_patrocinador_imagem check (
    imagem_path ~ '^patrocinador/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[A-Za-z0-9._-]{1,100}$'),
  -- Exatamente um destino: perfil OU texto.
  constraint administracao_patrocinador_destino check ((perfil_destino_id is null) <> (texto_destino is null)),
  -- Texto sem link externo (IM-012/IM-020): nada que pareça URL ou domínio.
  constraint administracao_patrocinador_texto check (
    texto_destino is null
    or (char_length(btrim(texto_destino)) between 1 and 200
        and texto_destino !~* '(https?:|www\.|[a-z0-9]\.(com|net|org|br|me|io|link|app|gg|ly)([^a-z]|$))')),
  constraint administracao_patrocinador_ordem check (ordem between -1000 and 100000),
  constraint administracao_patrocinador_periodo check (inicio_em is null or fim_em is null or fim_em > inicio_em)
);
create index administracao_patrocinador_ordem_idx on public.administracao_patrocinador (ordem, criado_em) where ativo;
create index administracao_patrocinador_perfil_idx on public.administracao_patrocinador (perfil_destino_id) where perfil_destino_id is not null;
comment on table public.administracao_patrocinador is 'Patrocinadores internos do carrossel (IM-020). Sem preço/cobrança. Escrita só por funções administrativas com auditoria.';

-- Privilégios: anon lê só colunas públicas (nada privado existe na tabela); as linhas, pela política.
-- ativo e criado_em entram porque a visão pública (security_invoker) os usa no filtro e na ordem; anon só enxerga
-- linhas ativas de qualquer forma. atualizado_em fica fora.
revoke all on public.administracao_patrocinador from anon, authenticated;
grant select (id, titulo, imagem_path, perfil_destino_id, texto_destino, ordem, ativo, inicio_em, fim_em, criado_em)
  on public.administracao_patrocinador to anon;
-- authenticated: o administrador lê tudo (inclusive ativo) pela política de administrador; os demais, só as linhas públicas.
grant select on public.administracao_patrocinador to authenticated;

alter table public.administracao_patrocinador enable row level security;
alter table public.administracao_patrocinador force row level security;

create policy administracao_patrocinador_select_publico on public.administracao_patrocinador
  for select to anon, authenticated using (
    ativo
    and (inicio_em is null or inicio_em <= now())
    and (fim_em is null or fim_em > now())
    and (perfil_destino_id is null or public.perfis_perfil_disponivel(perfil_destino_id)));
create policy administracao_patrocinador_select_admin on public.administracao_patrocinador
  for select to authenticated using ((select public.administracao_eh_admin()));
create policy administracao_patrocinador_insert_negado on public.administracao_patrocinador
  for insert to anon, authenticated with check (false);
create policy administracao_patrocinador_update_negado on public.administracao_patrocinador
  for update to anon, authenticated using (false) with check (false);
create policy administracao_patrocinador_delete_negado on public.administracao_patrocinador
  for delete to anon, authenticated using (false);

create trigger administracao_patrocinador_tocar before update on public.administracao_patrocinador
  for each row execute function public.catalogo_tocar_atualizado_em();

-- id e criação nunca mudam; não se apaga (vale também para service_role).
create function public.administracao_patrocinador_proteger() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'patrocinador não é apagado: desative' using errcode = '42501';
  end if;
  if new.id <> old.id or new.criado_em <> old.criado_em then
    raise exception 'id e criação do patrocinador são imutáveis' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function public.administracao_patrocinador_proteger() from public, anon, authenticated;
create trigger administracao_patrocinador_proteger before update or delete on public.administracao_patrocinador
  for each row execute function public.administracao_patrocinador_proteger();

-- A imagem precisa estar na pasta do próprio patrocinador: patrocinador/<id>/<arquivo>.
create function public.administracao_patrocinador_validar() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.imagem_path !~ ('^patrocinador/' || new.id::text || '/[A-Za-z0-9._-]{1,100}$') then
    raise exception 'caminho de imagem fora da pasta do patrocinador' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function public.administracao_patrocinador_validar() from public, anon, authenticated;
create trigger administracao_patrocinador_validar before insert or update on public.administracao_patrocinador
  for each row execute function public.administracao_patrocinador_validar();

-- Funções administrativas (todas gravam auditoria na mesma transação) ---------------------------------------
-- Criação: o app pode gerar o id antes (p_id) para enviar a imagem em patrocinador/<id>/ e só então chamar a função.
create function public.administracao_criar_patrocinador(
  p_titulo text,
  p_imagem_path text,
  p_perfil_destino_id uuid default null,
  p_texto_destino text default null,
  p_ordem integer default 0,
  p_ativo boolean default false,
  p_inicio_em timestamptz default null,
  p_fim_em timestamptz default null,
  p_motivo text default null,
  p_id uuid default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_autor uuid := public.administracao_exigir_admin();
  v_id uuid := coalesce(p_id, gen_random_uuid());
begin
  insert into public.administracao_patrocinador
    (id, titulo, imagem_path, perfil_destino_id, texto_destino, ordem, ativo, inicio_em, fim_em)
  values (v_id, btrim(p_titulo), p_imagem_path, p_perfil_destino_id, nullif(btrim(p_texto_destino), ''),
          coalesce(p_ordem, 0), coalesce(p_ativo, false), p_inicio_em, p_fim_em);
  insert into public.administracao_auditoria (autor_id, acao, alvo_tabela, alvo_id, motivo, valor_novo)
  select v_autor, 'patrocinador_criado', 'administracao_patrocinador', v_id::text,
         nullif(left(btrim(coalesce(p_motivo, '')), 500), ''), to_jsonb(p)
  from public.administracao_patrocinador p where p.id = v_id;
  return v_id;
end $$;

-- Substitui o conteúdo (título, imagem, destino, ordem, período). Motivo obrigatório; auditoria com o valor anterior.
create function public.administracao_alterar_patrocinador(
  p_id uuid,
  p_titulo text,
  p_imagem_path text,
  p_perfil_destino_id uuid,
  p_texto_destino text,
  p_ordem integer,
  p_inicio_em timestamptz,
  p_fim_em timestamptz,
  p_motivo text
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_autor uuid := public.administracao_exigir_admin();
  v_antes public.administracao_patrocinador;
begin
  if p_motivo is null or btrim(p_motivo) = '' then
    raise exception 'motivo obrigatório' using errcode = '22023';
  end if;
  select * into v_antes from public.administracao_patrocinador where id = p_id for update;
  if not found then
    raise exception 'patrocinador não encontrado' using errcode = 'P0002';
  end if;
  update public.administracao_patrocinador
     set titulo = btrim(p_titulo), imagem_path = p_imagem_path, perfil_destino_id = p_perfil_destino_id,
         texto_destino = nullif(btrim(p_texto_destino), ''), ordem = coalesce(p_ordem, 0),
         inicio_em = p_inicio_em, fim_em = p_fim_em
   where id = p_id;
  insert into public.administracao_auditoria (autor_id, acao, alvo_tabela, alvo_id, motivo, valor_anterior, valor_novo)
  select v_autor, 'patrocinador_alterado', 'administracao_patrocinador', p_id::text, left(btrim(p_motivo), 500),
         to_jsonb(v_antes), to_jsonb(p)
  from public.administracao_patrocinador p where p.id = p_id;
end $$;

create function public.administracao_definir_patrocinador_ativo(p_id uuid, p_ativo boolean, p_motivo text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_autor uuid := public.administracao_exigir_admin();
  v_antes public.administracao_patrocinador;
begin
  if p_ativo is null then
    raise exception 'informe se fica ativo' using errcode = '22023';
  end if;
  if p_motivo is null or btrim(p_motivo) = '' then
    raise exception 'motivo obrigatório' using errcode = '22023';
  end if;
  select * into v_antes from public.administracao_patrocinador where id = p_id for update;
  if not found then
    raise exception 'patrocinador não encontrado' using errcode = 'P0002';
  end if;
  update public.administracao_patrocinador set ativo = p_ativo where id = p_id;
  insert into public.administracao_auditoria (autor_id, acao, alvo_tabela, alvo_id, motivo, valor_anterior, valor_novo)
  select v_autor, case when p_ativo then 'patrocinador_ativado' else 'patrocinador_desativado' end,
         'administracao_patrocinador', p_id::text, left(btrim(p_motivo), 500), to_jsonb(v_antes), to_jsonb(p)
  from public.administracao_patrocinador p where p.id = p_id;
end $$;

revoke all on function public.administracao_criar_patrocinador(text, text, uuid, text, integer, boolean, timestamptz, timestamptz, text, uuid) from public, anon;
revoke all on function public.administracao_alterar_patrocinador(uuid, text, text, uuid, text, integer, timestamptz, timestamptz, text) from public, anon;
revoke all on function public.administracao_definir_patrocinador_ativo(uuid, boolean, text) from public, anon;
grant execute on function public.administracao_criar_patrocinador(text, text, uuid, text, integer, boolean, timestamptz, timestamptz, text, uuid) to authenticated;
grant execute on function public.administracao_alterar_patrocinador(uuid, text, text, uuid, text, integer, timestamptz, timestamptz, text) to authenticated;
grant execute on function public.administracao_definir_patrocinador_ativo(uuid, boolean, text) to authenticated;

-- Visão pública do carrossel ---------------------------------------------------------------------------------
-- Colunas: id, identificacao ('Patrocinado', constante: a UI DEVE exibir), titulo, imagem_path (opaco),
-- destino_tipo ('perfil' | 'texto'), destino_perfil_id, destino_perfil_slug, destino_texto, ordem.
-- As condições (ativo, período, perfil disponível) estão no corpo porque catalogo_imagem_publica (definer) também
-- lê esta visão e não passa por RLS. No máximo 20 linhas, em ordem estável.
create view public.administracao_patrocinador_publico with (security_invoker = true) as
select s.id,
       'Patrocinado'::text as identificacao,
       s.titulo,
       s.imagem_path,
       case when s.perfil_destino_id is not null then 'perfil' else 'texto' end as destino_tipo,
       s.perfil_destino_id as destino_perfil_id,
       pp.slug as destino_perfil_slug,
       s.texto_destino as destino_texto,
       s.ordem
from public.administracao_patrocinador s
left join public.perfis_perfil_publico pp on pp.id = s.perfil_destino_id
where s.ativo
  and (s.inicio_em is null or s.inicio_em <= now())
  and (s.fim_em is null or s.fim_em > now())
  and (s.perfil_destino_id is null or public.perfis_perfil_disponivel(s.perfil_destino_id))
order by s.ordem, s.criado_em, s.id
limit 20;
revoke all on public.administracao_patrocinador_publico from anon, authenticated;
grant select on public.administracao_patrocinador_publico to anon, authenticated;

-- Imagens ----------------------------------------------------------------------------------------------------
-- A imagem de patrocinador visível entra na leitura pública (mesma política catalogo_imagens_select_publica).
-- create or replace mantém os grants; o resto da função é idêntico ao de 20261024140000.
create or replace function public.catalogo_imagem_publica(p_nome text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.perfis_perfil_publico v
    where v.imagem_path = p_nome or p_nome = any (v.banners_paths) or p_nome = any (v.fotos_paths)
  ) or exists (
    select 1 from public.catalogo_item_publico v where v.foto_path = p_nome
  ) or exists (
    select 1 from public.administracao_patrocinador_publico v where v.imagem_path = p_nome
  );
$$;

-- Administrador envia/troca/apaga imagens SÓ na pasta patrocinador/<uuid>/ (não toca pastas de donos).
-- A exclusão só vale se nenhum patrocinador referencia o arquivo.
create policy catalogo_imagens_insert_patrocinador on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'indicamais-imagens'
    and name ~ '^patrocinador/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[A-Za-z0-9._-]{1,100}$'
    and (select public.administracao_eh_admin()));
create policy catalogo_imagens_update_patrocinador on storage.objects
  for update to authenticated
  using (
    bucket_id = 'indicamais-imagens' and name like 'patrocinador/%' and (select public.administracao_eh_admin()))
  with check (
    bucket_id = 'indicamais-imagens'
    and name ~ '^patrocinador/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[A-Za-z0-9._-]{1,100}$'
    and (select public.administracao_eh_admin()));
create policy catalogo_imagens_delete_patrocinador on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'indicamais-imagens' and name like 'patrocinador/%' and (select public.administracao_eh_admin())
    and not exists (select 1 from public.administracao_patrocinador s where s.imagem_path = storage.objects.name));
