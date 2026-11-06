-- Fase 14 · revisão de segurança do banco · Storage · IM-021, IM-029, IM-086
-- Achados S-01 e S-02 de docs/revisao-seguranca-banco.md. ESCRITA, NÃO APLICADA: aplicar primeiro no dev, com aprovação (D-003).
--
-- S-01 (alto) · o Storage grava `owner`/`owner_id` (a conta que enviou) em storage.objects e o devolve na listagem e no
--   "info" do objeto. Como as políticas deixam anon listar as imagens públicas, quem tem a chave pública (anon) poderia
--   ligar cada página/anúncio à conta do responsável, o que o desenho esconde de propósito (visões públicas sem
--   responsavel_id/conta_id; caminhos opacos). A mitigação anterior era só do app ("o servidor não repassa o metadado"),
--   que não vale para quem chama a API do Storage direto. CORREÇÃO: gatilho que zera owner e owner_id de todo objeto do
--   bucket. Nenhuma política depende deles (todas usam auth.uid() e a pasta do perfil/item). Zera também o que já existe.
--   jsonb_populate_record troca só os campos citados e ignora o que não existir no tipo (a coluna `owner` é legada).
--
-- S-02 (alto) · a política de UPDATE do dono não olhava se a imagem estava em uso. Quem chama a API direto, com upsert,
--   trocava o CONTEÚDO de um arquivo já aprovado (ou pendente de revisão) mantendo o mesmo nome: a revisão do
--   administrador (IM-021) ficava sem efeito. O app só envia com upsert: false (src/app/_lib/upload-imagem.ts) e nunca
--   usa UPDATE. CORREÇÃO: o UPDATE do dono só vale para objeto que NÃO está em rascunho, pendente nem no ar (mesma
--   função do DELETE: catalogo_imagem_em_uso), no USING e no WITH CHECK (também não "renomeia" para cima de um nome em uso).

create function public.catalogo_storage_sem_dono() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.bucket_id = 'indicamais-imagens' then
    new := jsonb_populate_record(new, jsonb_build_object('owner', null, 'owner_id', null));
  end if;
  return new;
end $$;
revoke all on function public.catalogo_storage_sem_dono() from public, anon, authenticated;

create trigger catalogo_storage_sem_dono
  before insert or update on storage.objects
  for each row execute function public.catalogo_storage_sem_dono();

-- Objetos que já existem. O gatilho acima também roda nestas linhas (sem efeito além de zerar os dois campos).
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'storage' and table_name = 'objects' and column_name = 'owner_id') then
    update storage.objects set owner_id = null where bucket_id = 'indicamais-imagens' and owner_id is not null;
  end if;
  if exists (select 1 from information_schema.columns
             where table_schema = 'storage' and table_name = 'objects' and column_name = 'owner') then
    update storage.objects set owner = null where bucket_id = 'indicamais-imagens' and owner is not null;
  end if;
end $$;

drop policy catalogo_imagens_update_propria on storage.objects;
create policy catalogo_imagens_update_propria on storage.objects
  for update to authenticated
  using (
    bucket_id = 'indicamais-imagens'
    and name !~ '/adm-[^/]*$'
    and public.catalogo_pasta_do_dono(name)
    and not public.catalogo_imagem_em_uso(name))
  with check (
    bucket_id = 'indicamais-imagens'
    and name !~ '/adm-[^/]*$'
    and public.catalogo_pasta_do_dono(name)
    and not public.catalogo_imagem_em_uso(name));
