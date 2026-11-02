-- Fase 8 · módulo notificacoes · aviso "banner aguardando seu aceite" no sino do responsável
-- IM-047, IM-052, IM-053, IM-093, IM-029, IM-086, D-013, D-016
--
-- DESENHO (IM-053: sem duplicar registros)
--   Nenhuma tabela nova de aviso. Nova ORIGEM 'banner_aceite' (origem_id = perfis_banner.id), DERIVADA de perfis_banner com
--   situacao = 'aguardando_aceite' do perfil de que a pessoa é responsável. O aviso some sozinho quando o banner é aceito,
--   recusado ou removido (a situação deixa de ser 'aguardando_aceite'). O estado de leitura continua em notificacoes_leitura
--   (só inserção).
--
-- PRIVACIDADE (IM-029, IM-050)
--   * ator_nome é sempre nulo: o aviso nunca mostra nome nem identificação do administrador (autor_admin_id nem é lido).
--   * Filtro fixo por auth.uid(); sem conta_id; anon sem acesso (grants da visão reafirmados).
--   * Administrador que não é responsável do perfil não vê o aviso.
--
-- A visão segue como estava (SECURITY DEFINER, o padrão de create view sem security_invoker), com as mesmas colunas e na
-- mesma ordem. marcar_lida recriada com a mesma assinatura e security definer; contar_nao_lidas e marcar_todas_lidas leem a
-- visão e não repetem a lista de origens: não mudam.

alter table public.notificacoes_leitura drop constraint notificacoes_leitura_origem;
alter table public.notificacoes_leitura add constraint notificacoes_leitura_origem
  check (origem in ('contato_valido', 'indicacao_valida', 'curtida', 'revisao', 'banner_aceite'));

create or replace view public.notificacoes_meus_avisos as
select x.origem, x.origem_id, x.tipo, x.destino_tipo, x.destino_id, x.destino_nome, x.ator_nome, x.criado_em,
       (l.lida_em is not null) as lida,
       l.lida_em
from (
  -- contato válido, ao responsável do destino
  select 'contato_valido'::text as origem, d.pedido_id as origem_id, 'contato_valido'::text as tipo,
         (case when p.perfil_id is not null then 'perfil' else 'item' end)::text as destino_tipo,
         coalesce(p.perfil_id, p.item_id) as destino_id,
         coalesce(pv.nome, iv.nome) as destino_nome,
         (case when exists (select 1 from public.relacionamento_saida s
                            where s.perfil_id = d.base_perfil_id and s.conta_id = l.indicador_id)
               then null else public.relacionamento_nome_publico(ci.nome_exibicao) end)::text as ator_nome,
         p.criado_em
  from public.relacionamento_entrada_decisao d
  join public.indicacoes_pedido_contato p on p.id = d.pedido_id
  join public.indicacoes_link l on l.id = p.link_id
  join public.contas_conta ci on ci.id = l.indicador_id
  left join public.perfis_perfil pf on pf.id = p.perfil_id
  left join public.catalogo_item it on it.id = p.item_id
  left join public.perfis_perfil_versao pv on pv.id = pf.versao_aprovada_id
  left join public.catalogo_item_versao iv on iv.id = it.versao_aprovada_id
  where d.valido and (pf.responsavel_id = (select auth.uid()) or it.conta_id = (select auth.uid()))
  union all
  -- indicação válida, ao indicador (encerrado para quem saiu da base do perfil)
  select 'indicacao_valida'::text, d.pedido_id, 'indicacao_valida'::text,
         (case when p.perfil_id is not null then 'perfil' else 'item' end)::text,
         coalesce(p.perfil_id, p.item_id),
         coalesce(pv.nome, iv.nome),
         null::text,
         p.criado_em
  from public.relacionamento_entrada_decisao d
  join public.indicacoes_pedido_contato p on p.id = d.pedido_id
  join public.indicacoes_link l on l.id = p.link_id
  left join public.perfis_perfil pf on pf.id = p.perfil_id
  left join public.catalogo_item it on it.id = p.item_id
  left join public.perfis_perfil_versao pv on pv.id = pf.versao_aprovada_id
  left join public.catalogo_item_versao iv on iv.id = it.versao_aprovada_id
  where d.valido and l.indicador_id = (select auth.uid())
    and not exists (select 1 from public.relacionamento_saida s
                    where s.perfil_id = d.base_perfil_id and s.conta_id = l.indicador_id)
  union all
  -- curtida, ao responsável do perfil (origem_id determinístico: descurtir e curtir de novo não cria aviso novo)
  select 'curtida'::text, md5('curtida:' || m.perfil_id::text || ':' || m.conta_id::text)::uuid, 'curtida'::text,
         'perfil'::text, m.perfil_id, pv.nome,
         public.relacionamento_nome_publico(cc.nome_exibicao),
         m.curtida_em
  from public.relacionamento_membro m
  join public.contas_conta cc on cc.id = m.conta_id
  join public.perfis_perfil pf on pf.id = m.perfil_id
  left join public.perfis_perfil_versao pv on pv.id = pf.versao_aprovada_id
  where m.curtida_em is not null and pf.responsavel_id = (select auth.uid())
  union all
  -- resultado de revisão (aprovação ou rejeição), reaproveitando a visão existente (IM-053)
  select 'revisao'::text, r.versao_id, ('revisao_' || r.situacao)::text,
         r.tipo, r.alvo_id, r.nome, null::text, r.decidida_em
  from public.administracao_meus_resultados r
  where r.situacao in ('aprovada', 'rejeitada') and r.decidida_em is not null
  union all
  -- banner colocado pelo administrador, aguardando o aceite do responsável (IM-093, D-016). Sem autor: ator_nome nulo.
  select 'banner_aceite'::text, b.id, 'banner_aguardando_aceite'::text,
         'perfil'::text, b.perfil_id, pv.nome,
         null::text,
         b.criado_em
  from public.perfis_banner b
  join public.perfis_perfil pf on pf.id = b.perfil_id
  left join public.perfis_perfil_versao pv on pv.id = pf.versao_aprovada_id
  where b.origem = 'administrador' and b.situacao = 'aguardando_aceite' and pf.responsavel_id = (select auth.uid())
) x
left join public.notificacoes_leitura l
  on l.conta_id = (select auth.uid()) and l.origem = x.origem and l.origem_id = x.origem_id;
revoke all on public.notificacoes_meus_avisos from anon, authenticated;
grant select on public.notificacoes_meus_avisos to authenticated;

-- Marca UM aviso como lido: mesma função, com a nova origem na lista válida.
create or replace function public.notificacoes_marcar_lida(p_origem text, p_origem_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_n integer;
begin
  if v_uid is null then
    raise exception 'não autenticado' using errcode = '42501';
  end if;
  if p_origem is null or p_origem_id is null
     or p_origem not in ('contato_valido', 'indicacao_valida', 'curtida', 'revisao', 'banner_aceite') then
    raise exception 'aviso inválido' using errcode = '22023';
  end if;
  if not exists (select 1 from public.notificacoes_meus_avisos a where a.origem = p_origem and a.origem_id = p_origem_id) then
    raise exception 'aviso não encontrado' using errcode = 'P0002';
  end if;
  insert into public.notificacoes_leitura (conta_id, origem, origem_id) values (v_uid, p_origem, p_origem_id)
  on conflict (conta_id, origem, origem_id) do nothing;
  get diagnostics v_n = row_count;
  return v_n > 0;
end $$;
revoke all on function public.notificacoes_marcar_lida(text, uuid) from public, anon;
grant execute on function public.notificacoes_marcar_lida(text, uuid) to authenticated;
