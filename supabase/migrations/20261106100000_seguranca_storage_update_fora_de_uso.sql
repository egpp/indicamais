-- Fase 14 · revisão de segurança do banco · Storage · IM-021, IM-086
-- Achado S-02 de docs/revisao-seguranca-banco.md. ESCRITA, NÃO APLICADA: aplicar primeiro no dev, com aprovação (D-003).
-- INDEPENDENTE do S-01 (20261106130000): este arquivo só troca uma política e roda sem depender do gatilho em storage.objects.
-- Por isso vem ANTES na ordem do `db push`: se o S-01 falhar no Supabase hospedado, o S-02 já está aplicado.
--
-- S-02 (alto) · a política de UPDATE do dono não olhava se a imagem estava em uso. Quem chama a API direto, com upsert,
--   trocava o CONTEÚDO de um arquivo já aprovado (ou pendente de revisão) mantendo o mesmo nome: a revisão do
--   administrador (IM-021) ficava sem efeito. O app só envia com upsert: false (src/app/_lib/upload-imagem.ts) e nunca
--   usa UPDATE. CORREÇÃO: o UPDATE do dono só vale para objeto que NÃO está em rascunho, pendente nem no ar (mesma
--   função do DELETE: catalogo_imagem_em_uso), no USING e no WITH CHECK (também não "renomeia" para cima de um nome em uso).

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
