-- Fase 2A · Storage de imagens de perfis e itens · IM-011, IM-012, IM-014, IM-021, IM-086
--
-- Bucket único e PRIVADO `indicamais-imagens` (public = false). Bucket público serviria qualquer arquivo a quem
-- tivesse a URL, mesmo de item rejeitado ou despublicado; no privado a leitura passa pelas políticas abaixo
-- (a aplicação usa URL assinada ou o endpoint autenticado do Storage; anon com a chave pública também é avaliado).
-- Limites configurados no bucket (aplicados pela API do Storage, NÃO testáveis em pgTAP):
--   * 2 MiB por arquivo; tipos image/jpeg, image/png, image/webp.
--   * O cliente deve redimensionar/comprimir antes do envio.
-- CAMINHOS OPACOS (IM-029, IM-086): o nome do objeto NUNCA contém o id da conta.
--   perfil/<perfil_id>/<arquivo>     imagens de um perfil comercial
--   item/<item_id>/<arquivo>         foto de um item do catálogo
--   <arquivo> = [A-Za-z0-9._-]{1,100}; o app gera <uuid-aleatório>.<jpg|png|webp>.
-- Esses caminhos são gravados nas versões (imagem_path, banners_paths, fotos_paths, foto_path) e devolvidos pelas
-- visões públicas; como perfil_id e item_id já são públicos, nada revela a conta. Quem pode escrever na pasta é
-- decidido pelo banco, consultando o dono do perfil/item (catalogo_pasta_do_dono): o perfil/item precisa EXISTIR
-- antes do upload (crie o rascunho por perfis_criar_rascunho/catalogo_criar_item, envie as imagens, depois grave
-- os caminhos com perfis_gravar_versao / atualização do rascunho do item).
-- Limites impostos em política (testáveis em pgTAP):
--   * o dono só escreve na pasta do próprio perfil/item;
--   * no máximo 100 objetos por conta (somando todas as pastas dos seus perfis e itens);
--   * máx. de imagens por versão: perfil 1 + 3 banners + 6 fotos (D-006); item 1 foto (CHECKs nas versões).
-- Atenção ao adaptador: o Storage pode devolver o metadado `owner`/`owner_id` (conta que enviou) em listagens e
-- info de objeto. Para não expor a conta em leitura pública, o envio deve ser feito no servidor, com a chave de
-- serviço (owner nulo), depois de checar o dono; ou o app nunca deve repassar esse metadado ao cliente.
-- Plano gratuito do Supabase: 1 GB de Storage no total. Pior caso: 100 objetos x 2 MiB x contas; na prática
-- imagens comprimidas (~300 KB) cabem em torno de 3.000 imagens. Acompanhar o uso; se aproximar de 1 GB,
-- reduzir o limite por arquivo/por conta ou subir de plano (custo: decisão do Emerson, IM-089).
-- Leitura:
--   * pública (anon e autenticado): só imagem referenciada por perfil/item aprovado e publicado (e perfil disponível);
--   * dono: tudo das pastas dos próprios perfis e itens (prévia de rascunho/pendente, IM-017);
--   * administrador: tudo do bucket (revisão).
-- Exclusão: o dono só apaga imagem que não esteja em rascunho, pendente ou no ar.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('indicamais-imagens', 'indicamais-imagens', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- A pasta (perfil/<id>/ ou item/<id>/) do objeto pertence ao usuário logado? Só devolve boolean.
create function public.catalogo_pasta_do_dono(p_nome text) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and case
    when p_nome ~ '^perfil/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[A-Za-z0-9._-]{1,100}$' then
      exists (select 1 from public.perfis_perfil p
              where p.id = split_part(p_nome, '/', 2)::uuid and p.responsavel_id = (select auth.uid()))
    when p_nome ~ '^item/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[A-Za-z0-9._-]{1,100}$' then
      exists (select 1 from public.catalogo_item i
              where i.id = split_part(p_nome, '/', 2)::uuid and i.conta_id = (select auth.uid()))
    else false
  end;
$$;
revoke all on function public.catalogo_pasta_do_dono(text) from public, anon;
grant execute on function public.catalogo_pasta_do_dono(text) to authenticated;

-- A imagem faz parte de algo público agora? (usa as visões públicas, que já filtram aprovado+publicado)
create function public.catalogo_imagem_publica(p_nome text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.perfis_perfil_publico v
    where v.imagem_path = p_nome or p_nome = any (v.banners_paths) or p_nome = any (v.fotos_paths)
  ) or exists (
    select 1 from public.catalogo_item_publico v where v.foto_path = p_nome
  );
$$;

-- A imagem está em rascunho, pendente ou na versão no ar de algum perfil/item?
create function public.catalogo_imagem_em_uso(p_nome text) returns boolean
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
      and v.foto_path = p_nome
  );
$$;

-- Objetos do usuário logado (sem parâmetro: ninguém conta imagens de outra conta).
create function public.catalogo_imagens_da_conta() returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::int from storage.objects o
  where o.bucket_id = 'indicamais-imagens'
    and ((o.name like 'perfil/%' and (storage.foldername(o.name))[2] in (
            select p.id::text from public.perfis_perfil p where p.responsavel_id = (select auth.uid())))
      or (o.name like 'item/%' and (storage.foldername(o.name))[2] in (
            select i.id::text from public.catalogo_item i where i.conta_id = (select auth.uid()))));
$$;

revoke all on function public.catalogo_imagem_publica(text) from public;
revoke all on function public.catalogo_imagem_em_uso(text) from public, anon;
revoke all on function public.catalogo_imagens_da_conta() from public, anon;
grant execute on function public.catalogo_imagem_publica(text) to anon, authenticated;
grant execute on function public.catalogo_imagem_em_uso(text) to authenticated;
grant execute on function public.catalogo_imagens_da_conta() to authenticated;

create policy catalogo_imagens_select_publica on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'indicamais-imagens' and public.catalogo_imagem_publica(name));
create policy catalogo_imagens_select_propria on storage.objects
  for select to authenticated
  using (bucket_id = 'indicamais-imagens' and public.catalogo_pasta_do_dono(name));
create policy catalogo_imagens_select_admin on storage.objects
  for select to authenticated
  using (bucket_id = 'indicamais-imagens' and (select public.administracao_eh_admin()));
create policy catalogo_imagens_insert_propria on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'indicamais-imagens'
    and public.catalogo_pasta_do_dono(name)
    and public.catalogo_imagens_da_conta() < 100);
create policy catalogo_imagens_update_propria on storage.objects
  for update to authenticated
  using (bucket_id = 'indicamais-imagens' and public.catalogo_pasta_do_dono(name))
  with check (bucket_id = 'indicamais-imagens' and public.catalogo_pasta_do_dono(name));
create policy catalogo_imagens_delete_propria on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'indicamais-imagens'
    and public.catalogo_pasta_do_dono(name)
    and not public.catalogo_imagem_em_uso(name));
