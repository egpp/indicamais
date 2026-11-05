-- Fase 7 · módulo comissoes · leitura do indicador e do anunciante · IM-029, IM-041, IM-050, IM-064, IM-065, IM-066, IM-068,
-- IM-072, IM-073, IM-086
--
-- Visões SECURITY DEFINER com filtro FIXO por auth.uid(), sem acesso a anon (alerta 0010 esperado, como em pontos).
--   Indicador  : comissoes_minhas_comissoes, comissoes_meu_saldo, comissoes_minha_situacao (aviso de inadimplência, IM-072).
--   Anunciante : comissoes_meus_negocios, comissoes_minhas_ofertas, comissoes_negocio_comissoes, comissoes_negocio_vinculos.
-- PRIVACIDADE: nenhuma visão traz nome, telefone, e-mail nem conta_id de cliente ou de indicador. Cliente e indicador
-- aparecem só como referência opaca (sha256 com prefixo fixo). O motivo interno do administrador não é coluna: só a causa
-- fixa da reversão (cancelamento, estorno, correcao). Os avisos de IM-072 são DERIVADOS destas visões, nunca copiados.
-- O administrador lê as tabelas diretamente (política de select do administrador).

-- Indicador: comissões próprias, com estado e reversão ---------------------------------------------------------------------
create view public.comissoes_minhas_comissoes as
select c.id,
       c.perfil_id as negocio_id,
       o.nome as oferta_nome,
       pg.competencia,
       c.base_centavos,
       c.percentual_bp,
       c.valor_centavos,
       encode(sha256(convert_to('indicamais:cliente:' || c.vinculo_id::text, 'UTF8')), 'hex') as cliente_ref,
       st.estado,
       (r.id is not null) as revertida,
       r.causa as reversao_causa,
       c.criada_em
from public.comissoes_comissao c
join public.comissoes_oferta o on o.id = c.oferta_id
join public.comissoes_pagamento pg on pg.id = c.pagamento_id
cross join lateral (
  select e.estado from public.comissoes_comissao_estado e where e.comissao_id = c.id order by e.id desc limit 1
) st
left join public.comissoes_lancamento r on r.original_id is not null and r.comissao_id = c.id and r.tipo = 'reversao'
where c.indicador_id = (select auth.uid());
revoke all on public.comissoes_minhas_comissoes from anon, authenticated;
grant select on public.comissoes_minhas_comissoes to authenticated;

-- Indicador: saldo próprio por estado (líquido de reversões). Não soma nada de pontos (IM-065). Uma linha.
create view public.comissoes_meu_saldo as
select coalesce(sum(x.valor), 0)::bigint as total_gerado_centavos,
       coalesce(sum(x.valor + x.rev), 0)::bigint as liquido_centavos,
       coalesce(sum(x.valor + x.rev) filter (where x.estado = 'gerada'), 0)::bigint as gerada_centavos,
       coalesce(sum(x.valor + x.rev) filter (where x.estado = 'pendente_repasse'), 0)::bigint as pendente_repasse_centavos,
       coalesce(sum(x.valor + x.rev) filter (where x.estado = 'paga'), 0)::bigint as paga_centavos,
       coalesce(sum(-x.rev) filter (where x.estado = 'paga'), 0)::bigint as revertida_apos_paga_centavos,
       count(*)::integer as quantidade
from (
  select c.valor_centavos as valor,
         coalesce(r.valor_centavos, 0) as rev,
         (select e.estado from public.comissoes_comissao_estado e where e.comissao_id = c.id order by e.id desc limit 1) as estado
  from public.comissoes_comissao c
  left join public.comissoes_lancamento r on r.original_id is not null and r.comissao_id = c.id and r.tipo = 'reversao'
  where c.indicador_id = (select auth.uid())
) x;
revoke all on public.comissoes_meu_saldo from anon, authenticated;
grant select on public.comissoes_meu_saldo to authenticated;

-- Indicador: situação por negócio (aviso interno de inadimplência, IM-066, IM-072). encerra_em = desde + prazo.
create view public.comissoes_minha_situacao as
select s.negocio_id,
       public.comissoes_modulo_ativo(s.negocio_id) as modulo_ativo,
       s.clientes_ativos,
       s.clientes_encerrados,
       s.em_dia,
       s.inadimplente_desde,
       (s.inadimplente_desde + public.comissoes_parametro_valor('prazo_inadimplencia_dias')) as encerra_em,
       public.comissoes_parametro_valor('prazo_inadimplencia_dias') as prazo_dias
from (
  select v.perfil_id as negocio_id,
         count(*) filter (where e.vinculo_id is null)::integer as clientes_ativos,
         count(*) filter (where e.vinculo_id is not null)::integer as clientes_encerrados,
         bool_and(sit.o_em_dia) as em_dia,
         min(sit.o_inadimplente_desde) as inadimplente_desde
  from public.comissoes_vinculo v
  left join public.comissoes_vinculo_encerramento e on e.vinculo_id = v.id
  cross join lateral public.comissoes_situacao_indicador(v.perfil_id, v.indicador_id, public.comissoes_hoje()) sit
  where v.indicador_id = (select auth.uid())
  group by v.perfil_id
) s;
revoke all on public.comissoes_minha_situacao from anon, authenticated;
grant select on public.comissoes_minha_situacao to authenticated;

-- Anunciante: módulo habilitado nos próprios negócios ---------------------------------------------------------------------
create view public.comissoes_meus_negocios as
select p.id as negocio_id,
       public.comissoes_modulo_ativo(p.id) as modulo_ativo,
       (select min(e.criado_em) from public.comissoes_habilitacao_evento e where e.perfil_id = p.id and e.ativa) as habilitado_desde
from public.perfis_perfil p
where p.responsavel_id = (select auth.uid())
  and exists (select 1 from public.comissoes_habilitacao_evento e where e.perfil_id = p.id);
revoke all on public.comissoes_meus_negocios from anon, authenticated;
grant select on public.comissoes_meus_negocios to authenticated;

-- Anunciante: ofertas dos próprios negócios, com o percentual vigente ---------------------------------------------------------
create view public.comissoes_minhas_ofertas as
select o.id,
       o.perfil_id as negocio_id,
       o.item_id,
       o.nome,
       o.periodicidade,
       public.comissoes_percentual_vigente(o.id) as percentual_bp,
       public.comissoes_oferta_ativa(o.id) as ativa,
       o.criada_em
from public.comissoes_oferta o
join public.perfis_perfil p on p.id = o.perfil_id
where p.responsavel_id = (select auth.uid());
revoke all on public.comissoes_minhas_ofertas from anon, authenticated;
grant select on public.comissoes_minhas_ofertas to authenticated;

-- Anunciante: comissões geradas no próprio negócio. Indicador e cliente só como referência opaca. -------------------------------
create view public.comissoes_negocio_comissoes as
select c.id,
       c.perfil_id as negocio_id,
       o.nome as oferta_nome,
       pg.competencia,
       c.base_centavos,
       c.percentual_bp,
       c.valor_centavos,
       encode(sha256(convert_to('indicamais:indicador:' || c.indicador_id::text, 'UTF8')), 'hex') as indicador_ref,
       encode(sha256(convert_to('indicamais:cliente:' || c.vinculo_id::text, 'UTF8')), 'hex') as cliente_ref,
       st.estado,
       (r.id is not null) as revertida,
       r.causa as reversao_causa,
       c.criada_em
from public.comissoes_comissao c
join public.perfis_perfil p on p.id = c.perfil_id
join public.comissoes_oferta o on o.id = c.oferta_id
join public.comissoes_pagamento pg on pg.id = c.pagamento_id
cross join lateral (
  select e.estado from public.comissoes_comissao_estado e where e.comissao_id = c.id order by e.id desc limit 1
) st
left join public.comissoes_lancamento r on r.original_id is not null and r.comissao_id = c.id and r.tipo = 'reversao'
where p.responsavel_id = (select auth.uid());
revoke all on public.comissoes_negocio_comissoes from anon, authenticated;
grant select on public.comissoes_negocio_comissoes to authenticated;

-- Anunciante: vínculos do negócio e situação de adimplência do indicador (aviso interno, IM-072) -----------------------------
create view public.comissoes_negocio_vinculos as
select v.id,
       v.perfil_id as negocio_id,
       encode(sha256(convert_to('indicamais:indicador:' || v.indicador_id::text, 'UTF8')), 'hex') as indicador_ref,
       encode(sha256(convert_to('indicamais:cliente:' || v.id::text, 'UTF8')), 'hex') as cliente_ref,
       case when e.vinculo_id is null then 'ativo' else 'encerrado' end as situacao,
       sit.o_em_dia as indicador_em_dia,
       sit.o_inadimplente_desde as inadimplente_desde,
       (sit.o_inadimplente_desde + public.comissoes_parametro_valor('prazo_inadimplencia_dias')) as encerra_em,
       v.criado_em,
       e.criado_em as encerrado_em
from public.comissoes_vinculo v
join public.perfis_perfil p on p.id = v.perfil_id
left join public.comissoes_vinculo_encerramento e on e.vinculo_id = v.id
cross join lateral public.comissoes_situacao_indicador(v.perfil_id, v.indicador_id, public.comissoes_hoje()) sit
where p.responsavel_id = (select auth.uid());
revoke all on public.comissoes_negocio_vinculos from anon, authenticated;
grant select on public.comissoes_negocio_vinculos to authenticated;
