-- Fase 8 · módulo perfis · estilo da página do negócio · IM-091, IM-094 (pendente), IM-086, D-016
--
-- O QUE É
--   Cada perfil escolhe UM entre 20 estilos de página (ids fixos de IM-091). O estilo muda só a aparência (paleta,
--   tipografia, forma dos blocos), nunca o conteúdo.
--
-- DESENHO (IM-094 está PENDENTE: o estilo fica FORA do fluxo de revisão, de modo fácil de mudar depois)
--   * perfis_estilo_pagina   catálogo dos 20 estilos; `habilitado` liga/desliga cada um sem nova migração de schema.
--                            Inicialmente habilitados: minimalista, gastronomia, saude_bem_estar, beleza_estetica,
--                            construcao_reformas (D-016). Os outros 15 existem, desabilitados.
--   * perfis_perfil.estilo_pagina  estilo escolhido (padrão 'minimalista'). NÃO é versionado: mudar o estilo não cria versão
--                            nem passa por aprovação (recomendação do gestor para IM-094; conteúdo segue IM-022). Se o
--                            Emerson decidir que o estilo exige reaprovação, a mudança será: mover a coluna para
--                            perfis_perfil_versao (nova migração) e ajustar perfis_definir_estilo; a visão pública e o
--                            contrato de leitura (coluna `estilo_pagina`) permanecem.
--   * Escrita só por RPC: o responsável (perfis_definir_estilo, só o próprio perfil, conta suspensa não altera, auditado)
--     e o administrador geral (perfis_admin_definir_estilo_habilitado, motivo obrigatório, auditado).
--   * Leitura pública: perfis_perfil_publico ganha a coluna `estilo_pagina`. Se o estilo do perfil for desabilitado depois, a
--     leitura pública devolve 'minimalista' (queda segura); o valor escolhido é mantido para quando for reabilitado.
--
-- CÓDIGOS DE ERRO (SQLSTATE)
--   42501  não autenticado / perfil que não é do usuário / conta sem acesso / não é administrador geral
--   22023  estilo inexistente ou não habilitado / motivo obrigatório / minimalista não pode ser desabilitado
--   P0002  estilo inexistente (admin)

create table public.perfis_estilo_pagina (
  id text primary key,
  rotulo text not null,
  ordem integer not null,
  habilitado boolean not null default false,
  constraint perfis_estilo_pagina_id check (id in (
    'minimalista', 'saude_bem_estar', 'beleza_estetica', 'gastronomia', 'cafe_padaria', 'construcao_reformas',
    'automotivo', 'juridico_contabil', 'educacao_cursos', 'pet', 'moda_lojas', 'fitness_esportes', 'imobiliario',
    'tecnologia_assistencia', 'casa_decoracao', 'eventos_fotografia', 'servicos_rapidos', 'agro_campo',
    'turismo_hospedagem', 'premium')),
  constraint perfis_estilo_pagina_rotulo check (char_length(btrim(rotulo)) between 1 and 60),
  constraint perfis_estilo_pagina_ordem_unica unique (ordem),
  -- O estilo padrão e a queda segura da leitura pública: nunca pode ficar desabilitado.
  constraint perfis_estilo_pagina_minimalista_habilitado check (id <> 'minimalista' or habilitado)
);
comment on table public.perfis_estilo_pagina is 'Catálogo dos 20 estilos de página (IM-091). `habilitado` libera estilos sem nova migração de schema.';

insert into public.perfis_estilo_pagina (id, rotulo, ordem, habilitado) values
  ('minimalista', 'Minimalista', 1, true),
  ('saude_bem_estar', 'Saúde e Bem-estar', 2, true),
  ('beleza_estetica', 'Beleza e Estética', 3, true),
  ('gastronomia', 'Gastronomia', 4, true),
  ('cafe_padaria', 'Café e Padaria', 5, false),
  ('construcao_reformas', 'Construção e Reformas', 6, true),
  ('automotivo', 'Automotivo', 7, false),
  ('juridico_contabil', 'Jurídico e Contábil', 8, false),
  ('educacao_cursos', 'Educação e Cursos', 9, false),
  ('pet', 'Pet', 10, false),
  ('moda_lojas', 'Moda e Lojas', 11, false),
  ('fitness_esportes', 'Fitness e Esportes', 12, false),
  ('imobiliario', 'Imobiliário', 13, false),
  ('tecnologia_assistencia', 'Tecnologia e Assistência', 14, false),
  ('casa_decoracao', 'Casa e Decoração', 15, false),
  ('eventos_fotografia', 'Eventos e Fotografia', 16, false),
  ('servicos_rapidos', 'Serviços Rápidos', 17, false),
  ('agro_campo', 'Agro e Campo', 18, false),
  ('turismo_hospedagem', 'Turismo e Hospedagem', 19, false),
  ('premium', 'Premium', 20, false);

revoke all on public.perfis_estilo_pagina from anon, authenticated;
grant select on public.perfis_estilo_pagina to anon, authenticated;
alter table public.perfis_estilo_pagina enable row level security;
alter table public.perfis_estilo_pagina force row level security;

create policy perfis_estilo_pagina_select_publico on public.perfis_estilo_pagina
  for select to anon, authenticated using (true);
create policy perfis_estilo_pagina_insert_negado on public.perfis_estilo_pagina
  for insert to authenticated with check (false);
create policy perfis_estilo_pagina_update_negado on public.perfis_estilo_pagina
  for update to authenticated using (false) with check (false);
create policy perfis_estilo_pagina_delete_negado on public.perfis_estilo_pagina
  for delete to authenticated using (false);

-- O catálogo é fixo: só `habilitado` muda (vale também para service_role).
create function public.perfis_estilo_pagina_proteger() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'estilo de página não pode ser apagado' using errcode = '42501';
  end if;
  if new.id <> old.id or new.rotulo <> old.rotulo or new.ordem <> old.ordem then
    raise exception 'só a habilitação do estilo pode mudar' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function public.perfis_estilo_pagina_proteger() from public, anon, authenticated;
create trigger perfis_estilo_pagina_proteger before update or delete on public.perfis_estilo_pagina
  for each row execute function public.perfis_estilo_pagina_proteger();

-- Estilo escolhido por perfil (fora do fluxo de revisão e das versões: IM-094 pendente). ---------------------------
alter table public.perfis_perfil
  add column estilo_pagina text not null default 'minimalista'
  references public.perfis_estilo_pagina (id) on delete restrict;
-- Leitura como as demais colunas públicas do perfil (as políticas de linha seguem valendo). Sem UPDATE para o cliente:
-- a escolha é só por perfis_definir_estilo().
grant select (estilo_pagina) on public.perfis_perfil to anon, authenticated;

-- RPC do responsável ---------------------------------------------------------------------------------------------
create function public.perfis_definir_estilo(p_perfil_id uuid, p_estilo text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_anterior text;
begin
  if v_uid is null or not public.contas_acesso_permitido(v_uid) then
    raise exception 'não autenticado ou conta sem acesso' using errcode = '42501';
  end if;
  select p.estilo_pagina into v_anterior
  from public.perfis_perfil p where p.id = p_perfil_id and p.responsavel_id = v_uid for update;
  if not found then
    raise exception 'perfil não encontrado' using errcode = '42501';
  end if;
  if p_estilo is null or not exists (select 1 from public.perfis_estilo_pagina e where e.id = p_estilo and e.habilitado) then
    raise exception 'estilo inexistente ou não habilitado' using errcode = '22023';
  end if;
  if v_anterior = p_estilo then
    return;
  end if;
  update public.perfis_perfil set estilo_pagina = p_estilo where id = p_perfil_id;
  insert into public.administracao_auditoria (autor_id, acao, alvo_tabela, alvo_id, motivo, valor_anterior, valor_novo)
  values (v_uid, 'definir_estilo_pagina', 'perfis_perfil', p_perfil_id::text, null,
          jsonb_build_object('estilo_pagina', v_anterior), jsonb_build_object('estilo_pagina', p_estilo));
end $$;

-- RPC do administrador geral: liberar ou recolher um estilo (D-016: 5 agora, 15 depois, sem nova migração de schema) ---
create function public.perfis_admin_definir_estilo_habilitado(p_estilo text, p_habilitado boolean, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := public.administracao_exigir_admin();
  v_motivo text := nullif(left(btrim(coalesce(p_motivo, '')), 500), '');
  v_antes boolean;
begin
  if v_motivo is null then
    raise exception 'motivo obrigatório' using errcode = '22023';
  end if;
  if p_habilitado is null then
    raise exception 'informe habilitado ou não' using errcode = '22023';
  end if;
  select e.habilitado into v_antes from public.perfis_estilo_pagina e where e.id = p_estilo for update;
  if not found then
    raise exception 'estilo não encontrado' using errcode = 'P0002';
  end if;
  if p_estilo = 'minimalista' and not p_habilitado then
    raise exception 'o estilo padrão não pode ser desabilitado' using errcode = '22023';
  end if;
  if v_antes = p_habilitado then
    return;
  end if;
  update public.perfis_estilo_pagina set habilitado = p_habilitado where id = p_estilo;
  insert into public.administracao_auditoria (autor_id, acao, alvo_tabela, alvo_id, motivo, valor_anterior, valor_novo)
  values (v_admin, 'definir_estilo_habilitado', 'perfis_estilo_pagina', p_estilo, v_motivo,
          jsonb_build_object('habilitado', v_antes), jsonb_build_object('habilitado', p_habilitado));
end $$;

revoke all on function public.perfis_definir_estilo(uuid, text) from public, anon;
revoke all on function public.perfis_admin_definir_estilo_habilitado(text, boolean, text) from public, anon;
grant execute on function public.perfis_definir_estilo(uuid, text) to authenticated;
grant execute on function public.perfis_admin_definir_estilo_habilitado(text, boolean, text) to authenticated;

-- Leitura -------------------------------------------------------------------------------------------------------
-- Visão pública: mesmas colunas de antes + `estilo_pagina` ao final (CREATE OR REPLACE só acrescenta ao fim e mantém os
-- privilégios). Estilo desabilitado cai para 'minimalista'.
create or replace view public.perfis_perfil_publico with (security_invoker = true) as
select p.id, p.slug, v.nome, v.descricao_breve, v.imagem_path,
       v.categoria_principal_id, v.categoria_secundaria_1_id, v.categoria_secundaria_2_id,
       v.cidade, v.uf, v.endereco, v.areas_atendidas, v.banners_paths, v.fotos_paths,
       v.site, v.informacoes_sociais,
       case when e.habilitado then p.estilo_pagina else 'minimalista' end as estilo_pagina
from public.perfis_perfil p
join public.perfis_perfil_versao v on v.id = p.versao_aprovada_id and v.situacao = 'aprovada'
join public.perfis_estilo_pagina e on e.id = p.estilo_pagina
where p.publicado;

-- O dono vê o estilo que escolheu (e se ele segue habilitado) na própria lista. Visão do dono da visão com filtro fixo.
create or replace view public.perfis_meus_perfis as
select p.id, p.slug, p.publicado, p.versao_aprovada_id, p.criado_em, p.atualizado_em, p.estilo_pagina
from public.perfis_perfil p
where p.responsavel_id = (select auth.uid());
