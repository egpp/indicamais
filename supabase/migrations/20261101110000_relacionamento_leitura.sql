-- Fase 5 · módulo relacionamento · leitura (visões) · IM-041, IM-045, IM-050, IM-086
--
-- VISÕES SECURITY DEFINER (sem security_invoker, de propósito; o alerta 0010 do Security Advisor é esperado):
-- relacionamento_membro e as demais tabelas não têm privilégio de tabela para papel algum de API. Cada visão roda com os
-- direitos do dono e tem filtro FIXO por auth.uid(), sem parâmetro, sem acesso a anon e SEM id de conta.
--   relacionamento_meus_membros        o responsável vê SÓ os seus perfis (IM-041): nome público da pessoa, datas de curtida e
--                                      de indicação e contagem de interações. Nunca WhatsApp, e-mail, nome completo nem conta_id.
--   relacionamento_meu_resumo          totais por perfil do responsável, incluindo saídas (histórico agregado e anônimo).
--   relacionamento_minhas_participacoes  a pessoa vê em quais bases está (para curtir/descurtir e "Sair da base").
-- "Interações" = indicações válidas + 1 se a curtida está ativa. Link gerado e compartilhamento não contam (D-013).

create view public.relacionamento_meus_membros as
select m.id,
       m.perfil_id,
       pv.nome as perfil_nome,
       public.relacionamento_nome_publico(c.nome_exibicao) as pessoa_nome,
       (m.curtida_em is not null) as curtiu,
       m.curtida_em,
       (m.indicacoes_validas > 0) as indicou,
       m.primeira_indicacao_em,
       m.ultima_indicacao_em,
       m.indicacoes_validas,
       m.indicacoes_validas + (case when m.curtida_em is not null then 1 else 0 end) as interacoes,
       m.entrou_em
from public.relacionamento_membro m
join public.contas_conta c on c.id = m.conta_id
join public.perfis_perfil pf on pf.id = m.perfil_id
left join public.perfis_perfil_versao pv on pv.id = pf.versao_aprovada_id
where pf.responsavel_id = (select auth.uid());
revoke all on public.relacionamento_meus_membros from anon, authenticated;
grant select on public.relacionamento_meus_membros to authenticated;

create view public.relacionamento_meu_resumo as
select pf.id as perfil_id,
       pv.nome as perfil_nome,
       (select count(*) from public.relacionamento_membro m where m.perfil_id = pf.id)::integer as membros,
       (select count(*) from public.relacionamento_membro m where m.perfil_id = pf.id and m.curtida_em is not null)::integer as curtidas_ativas,
       (select count(*) from public.relacionamento_membro m where m.perfil_id = pf.id and m.indicacoes_validas > 0)::integer as indicadores,
       (select coalesce(sum(m.indicacoes_validas + (case when m.curtida_em is not null then 1 else 0 end)), 0)
          from public.relacionamento_membro m where m.perfil_id = pf.id)::integer as interacoes,
       (select count(*) from public.relacionamento_evento e where e.perfil_id = pf.id and e.tipo = 'saida')::integer as saidas
from public.perfis_perfil pf
left join public.perfis_perfil_versao pv on pv.id = pf.versao_aprovada_id
where pf.responsavel_id = (select auth.uid());
revoke all on public.relacionamento_meu_resumo from anon, authenticated;
grant select on public.relacionamento_meu_resumo to authenticated;

create view public.relacionamento_minhas_participacoes as
select m.perfil_id,
       pf.slug as perfil_slug,
       pv.nome as perfil_nome,
       (m.curtida_em is not null) as curtiu,
       m.curtida_em,
       (m.indicacoes_validas > 0) as indicou,
       m.indicacoes_validas,
       m.entrou_em
from public.relacionamento_membro m
join public.perfis_perfil pf on pf.id = m.perfil_id
left join public.perfis_perfil_versao pv on pv.id = pf.versao_aprovada_id
where m.conta_id = (select auth.uid());
revoke all on public.relacionamento_minhas_participacoes from anon, authenticated;
grant select on public.relacionamento_minhas_participacoes to authenticated;
