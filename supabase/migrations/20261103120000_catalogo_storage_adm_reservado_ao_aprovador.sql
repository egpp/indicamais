-- Fase 9 · endurecimento do Storage · nomes `adm-*` reservados ao aprovador · IM-093, IM-086, D-016
--
-- PROBLEMA: catalogo_imagens_insert_propria / catalogo_imagens_update_propria (20261024140000) deixavam o responsável gravar
-- QUALQUER nome na pasta perfil/<id>/ do próprio perfil, inclusive `adm-<arquivo>`, o prefixo que a Fase 8 reserva às imagens de
-- banner colocadas pelo administrador (perfis_pasta_para_aprovador). Com isso o responsável poderia criar um objeto com a
-- aparência de imagem de administrador (e ocupar a cota da pasta usada pelo aprovador).
--
-- CORREÇÃO: as duas políticas passam a recusar nomes cujo arquivo começa com `adm-`. A criação desses nomes continua possível
-- só pela política do aprovador (catalogo_imagens_insert_aprovador_banner, pasta de OUTRA conta, permissão `aprovar`).
-- Nada mais muda: o responsável continua vendo (select) e apagando (delete, se não estiver em uso) as imagens da própria pasta,
-- inclusive as `adm-*` já aceitas ou recusadas; leitura pública e proteção de imagem em uso ficam como estavam.
-- UPDATE: a regra vale no USING e no WITH CHECK, para o responsável também não "adotar" (renomear) um adm-* nem renomear
-- outro arquivo para adm-*.
--
-- Esta migração só troca políticas (DROP + CREATE com o mesmo nome); não altera função nem dados.

drop policy catalogo_imagens_insert_propria on storage.objects;
drop policy catalogo_imagens_update_propria on storage.objects;

create policy catalogo_imagens_insert_propria on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'indicamais-imagens'
    and name !~ '/adm-[^/]*$'
    and public.catalogo_pasta_do_dono(name)
    and public.catalogo_imagens_da_conta() < 100);

create policy catalogo_imagens_update_propria on storage.objects
  for update to authenticated
  using (
    bucket_id = 'indicamais-imagens'
    and name !~ '/adm-[^/]*$'
    and public.catalogo_pasta_do_dono(name))
  with check (
    bucket_id = 'indicamais-imagens'
    and name !~ '/adm-[^/]*$'
    and public.catalogo_pasta_do_dono(name));
