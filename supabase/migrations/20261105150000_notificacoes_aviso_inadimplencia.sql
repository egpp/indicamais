-- Fase 7 · módulo notificacoes · avisos de inadimplência no sino (indicador e anunciante) · IM-072, IM-051, IM-052, IM-053,
-- IM-029, IM-041, IM-050, IM-065, IM-068, IM-086, D-029
--
-- DESENHO (segue o padrão de banner_aceite, IM-053: sem duplicar registros)
--   Nenhuma tabela de aviso. Nova ORIGEM 'inadimplencia', DERIVADA das visões de leitura do módulo comissoes
--   (comissoes_minha_situacao e comissoes_negocio_vinculos, ambas já com filtro fixo por auth.uid()). O aviso aparece e some
--   sozinho conforme a situação muda. Só o estado de leitura é gravado, em notificacoes_leitura (só inserção).
--   Quatro tipos:
--     inadimplencia_atraso_indicador   ao indicador: o primeiro mês encerrado ficou sem pagamento confirmado (IM-072, D-026)
--     inadimplencia_prazo_indicador    ao indicador: falta pouco para o prazo de encerramento dos vínculos
--     inadimplencia_atraso_negocio     ao anunciante: um indicador do negócio entrou em atraso
--     inadimplencia_prazo_negocio      ao anunciante: falta pouco para o prazo de encerramento de um vínculo
--   "Falta pouco" = faltam no máximo N dias para (inadimplente desde + prazo vigente). N é o parâmetro novo
--   aviso_encerramento_antecedencia_dias de comissoes_parametro (IM-068; valor inicial 7, faixa 1 a 365, alterável só pelo
--   administrador por comissoes_definir_parametro, com auditoria). O prazo em si segue prazo_inadimplencia_dias (padrão 60).
--
-- IDEMPOTÊNCIA (sem aviso duplicado): origem_id é DETERMINÍSTICO (md5), derivado de papel + tipo + referência + competência.
--   Indicador : referência = negócio (é assim que ele vê a situação em comissoes_minha_situacao).
--   Anunciante: referência = vínculo (é assim que ele vê em comissoes_negocio_vinculos).
--   Competência = inadimplente_desde (primeiro mês sem pagamento confirmado). A mesma situação gera sempre o mesmo id, e a
--   leitura marcada continua valendo; se o indicador regulariza e atrasa de novo, a competência muda e o aviso é novo.
--   O papel entra na chave para que a mesma conta, sendo indicadora e responsável, não colida.
--
-- QUANDO AVISA: só vínculos ATIVOS (clientes_ativos > 0 / situacao = 'ativo'), indicador não em dia, com competência
--   anterior ao mês corrente (o mês corrente não conta, D-026). Vínculo encerrado deixa de gerar aviso.
--
-- PRIVACIDADE (IM-029, IM-041, IM-050): ator_nome é sempre nulo. Nenhuma coluna traz nome, telefone, e-mail, valor, conta_id
--   nem referência de cliente ou indicador; o texto não cita valores. O aviso não diz QUEM está em atraso (a identificação
--   continua só pela referência opaca da tela de vínculos). destino = o negócio (perfil).
--
-- ISOLAMENTO (IM-065): só leitura. Nada aqui escreve em pontos, relacionamento ou comissoes (exceto o parâmetro novo
--   abaixo); não altera saldo nem vínculo.

insert into public.comissoes_parametro (chave, valor, minimo, maximo, descricao) values
  ('aviso_encerramento_antecedencia_dias', 7, 1, 365, 'Quantos dias antes do fim do prazo de inadimplência o indicador e o anunciante recebem o aviso de encerramento próximo dos vínculos (IM-072).')
on conflict (chave) do nothing;

alter table public.notificacoes_leitura drop constraint notificacoes_leitura_origem;
alter table public.notificacoes_leitura add constraint notificacoes_leitura_origem
  check (origem in ('contato_valido', 'indicacao_valida', 'curtida', 'revisao', 'banner_aceite', 'inadimplencia'));

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
  union all
  -- inadimplência, ao INDICADOR: por negócio, como ele vê em comissoes_minha_situacao (IM-072). Atraso e prazo próximo.
  select 'inadimplencia'::text,
         md5('inadimplencia:indicador:' || t.suf || ':' || s.negocio_id::text || ':' || s.inadimplente_desde::text)::uuid,
         ('inadimplencia_' || t.suf || '_indicador')::text,
         'perfil'::text, s.negocio_id, pv.nome,
         null::text,
         t.quando
  from public.comissoes_minha_situacao s
  join public.perfis_perfil pf on pf.id = s.negocio_id
  left join public.perfis_perfil_versao pv on pv.id = pf.versao_aprovada_id
  cross join lateral (
    select 'atraso'::text as suf, (s.inadimplente_desde + interval '1 month') at time zone 'utc' as quando
    union all
    select 'prazo'::text,
           greatest((s.inadimplente_desde + interval '1 month') at time zone 'utc',
                    (s.encerra_em - (select pa.valor from public.comissoes_parametro pa
                                     where pa.chave = 'aviso_encerramento_antecedencia_dias'))::timestamp at time zone 'utc')
    where s.encerra_em - (select pa.valor from public.comissoes_parametro pa
                          where pa.chave = 'aviso_encerramento_antecedencia_dias') <= (now() at time zone 'utc')::date
  ) t
  where s.clientes_ativos > 0 and not s.em_dia and s.inadimplente_desde is not null
    and s.inadimplente_desde < date_trunc('month', now() at time zone 'utc')::date
  union all
  -- inadimplência, ao ANUNCIANTE: por vínculo ativo, como ele vê em comissoes_negocio_vinculos (IM-072). Sem identificar
  -- o indicador nem o cliente (a referência opaca não sai da visão).
  select 'inadimplencia'::text,
         md5('inadimplencia:negocio:' || t.suf || ':' || v.id::text || ':' || v.inadimplente_desde::text)::uuid,
         ('inadimplencia_' || t.suf || '_negocio')::text,
         'perfil'::text, v.negocio_id, pv.nome,
         null::text,
         t.quando
  from public.comissoes_negocio_vinculos v
  join public.perfis_perfil pf on pf.id = v.negocio_id
  left join public.perfis_perfil_versao pv on pv.id = pf.versao_aprovada_id
  cross join lateral (
    select 'atraso'::text as suf, (v.inadimplente_desde + interval '1 month') at time zone 'utc' as quando
    union all
    select 'prazo'::text,
           greatest((v.inadimplente_desde + interval '1 month') at time zone 'utc',
                    (v.encerra_em - (select pa.valor from public.comissoes_parametro pa
                                     where pa.chave = 'aviso_encerramento_antecedencia_dias'))::timestamp at time zone 'utc')
    where v.encerra_em - (select pa.valor from public.comissoes_parametro pa
                          where pa.chave = 'aviso_encerramento_antecedencia_dias') <= (now() at time zone 'utc')::date
  ) t
  where v.situacao = 'ativo' and not v.indicador_em_dia and v.inadimplente_desde is not null
    and v.inadimplente_desde < date_trunc('month', now() at time zone 'utc')::date
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
     or p_origem not in ('contato_valido', 'indicacao_valida', 'curtida', 'revisao', 'banner_aceite', 'inadimplencia') then
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
