-- Consulta de negócios e itens para o administrador · D-009 · IM-021, IM-077 (parte), IM-086
-- Visão SOMENTE LEITURA de todos os perfis e itens, em qualquer situação. Sem escrita e sem auditoria (consulta).
--   * Mesmo padrão da fila (administracao_fila_pendencias): visão sem security_invoker (o papel authenticated não
--     tem SELECT em responsavel_id/conta_id) e filtro FIXO administracao_eh_admin(): quem não é administrador
--     recebe zero linhas. anon não tem privilégio algum; authenticated só SELECT.
--   * "Situação atual" = situação da versão mais recente (por criado_em): rascunho, pendente, aprovada ou rejeitada.
--     tem_versao_aprovada diz se já existe versão no ar; publicado e disponivel refletem o estado público (IM-079).
--   * Nenhuma coluna de contato (telefone, WhatsApp, e-mail) nem dado de visitante. dono_id é o mesmo que a fila já expõe.
--   * Item de perfil herda cidade/UF da versão mais recente do perfil; anúncio particular usa a da própria versão.
--   * Tabelas base seguem com RLS ativa e forçada; nenhuma política foi alterada.

create view public.administracao_consulta_negocios as
select 'perfil'::text as alvo_tipo,
       p.id as alvo_id,
       p.responsavel_id as dono_id,
       v.id as versao_id,
       v.nome,
       c.nome as categoria,
       v.cidade,
       v.uf,
       v.situacao,
       (p.versao_aprovada_id is not null) as tem_versao_aprovada,
       p.publicado,
       public.perfis_perfil_disponivel(p.id) as disponivel,
       null::text as item_tipo,
       null::uuid as perfil_id,
       p.slug,
       p.criado_em,
       p.atualizado_em
from public.perfis_perfil p
left join lateral (
  select x.* from public.perfis_perfil_versao x where x.perfil_id = p.id order by x.criado_em desc, x.id desc limit 1
) v on true
left join public.catalogo_categoria c on c.id = v.categoria_principal_id
where public.administracao_eh_admin()
union all
select 'item'::text,
       i.id,
       i.conta_id,
       v.id,
       v.nome,
       c.nome,
       coalesce(v.cidade, pv.cidade),
       coalesce(v.uf, pv.uf),
       v.situacao,
       (i.versao_aprovada_id is not null),
       i.publicado,
       (i.publicado and i.versao_aprovada_id is not null
         and (i.perfil_id is null or public.perfis_perfil_disponivel(i.perfil_id))),
       i.tipo,
       i.perfil_id,
       null::text,
       i.criado_em,
       i.atualizado_em
from public.catalogo_item i
left join lateral (
  select x.* from public.catalogo_item_versao x where x.item_id = i.id order by x.criado_em desc, x.id desc limit 1
) v on true
left join public.catalogo_categoria c on c.id = v.categoria_principal_id
left join lateral (
  select y.cidade, y.uf from public.perfis_perfil_versao y
  where y.perfil_id = i.perfil_id order by y.criado_em desc, y.id desc limit 1
) pv on i.perfil_id is not null
where public.administracao_eh_admin();

revoke all on public.administracao_consulta_negocios from anon, authenticated;
grant select on public.administracao_consulta_negocios to authenticated;
