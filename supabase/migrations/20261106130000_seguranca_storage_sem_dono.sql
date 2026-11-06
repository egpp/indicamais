-- Fase 14 · revisão de segurança do banco · Storage · IM-029, IM-086
-- Achado S-01 de docs/revisao-seguranca-banco.md. ESCRITA, NÃO APLICADA: aplicar primeiro no dev, com aprovação (D-003).
-- ANTES de aplicar, rodar no dev a verificação prévia de docs/revisao-seguranca-banco.md (dono de storage.objects e
-- privilégio TRIGGER do papel da migração). Este arquivo é o ÚLTIMO da fila de propósito: cria gatilho em tabela do Storage
-- e pode falhar no Supabase hospedado; o S-02 (20261106100000), o S-03 (20261106110000) e as demais migrações da fase 14
-- são independentes e ficam aplicadas se este falhar (cada migração roda em transação própria).
--
-- S-01 (alto) · o Storage grava `owner`/`owner_id` (a conta que enviou) em storage.objects e o devolve na listagem e no
--   "info" do objeto. Como as políticas deixam anon listar as imagens públicas, quem tem a chave pública (anon) poderia
--   ligar cada página/anúncio à conta do responsável, o que o desenho esconde de propósito (visões públicas sem
--   responsavel_id/conta_id; caminhos opacos). A mitigação anterior era só do app ("o servidor não repassa o metadado"),
--   que não vale para quem chama a API do Storage direto. CORREÇÃO: gatilho que zera owner e owner_id de todo objeto do
--   bucket. Nenhuma política depende deles (todas usam auth.uid() e a pasta do perfil/item). Zera também o que já existe.
--   jsonb_populate_record troca só os campos citados e ignora o que não existir no tipo (a coluna `owner` é legada).

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
