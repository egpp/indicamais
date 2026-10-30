-- Fase 4 · módulo pontos · reversão auditável, reprocessamento e leitura · IM-028, IM-029, IM-035, IM-041, IM-077,
-- IM-078, IM-086
--
-- CÓDIGOS DE ERRO (SQLSTATE) para a aplicação mapear mensagens:
--   42501  não autenticado / não administrador
--   22023  motivo obrigatório ou valor inválido
--   P0002  lançamento ou pedido inexistente
--   P0001  só crédito pode ser revertido
--   P0409  crédito já revertido (uma reversão por crédito)
--   P0410  a reversão deixaria o saldo negativo (pontos já resgatados): exige análise e confirmação explícita
--
-- VISÕES SECURITY DEFINER (sem security_invoker, de propósito; o alerta 0010 do Security Advisor é esperado):
-- pontos_lancamento, pontos_decisao e pontos_falha não têm privilégio de tabela para papel algum de API. Cada visão roda
-- com os direitos do dono e tem filtro FIXO por auth.uid() (indicador) ou administracao_eh_admin(), sem parâmetro, sem
-- acesso a anon. Nenhuma devolve id de conta: o administrador identifica o indicador por indicador_ref (hash opaco).
-- O responsável do perfil NÃO ganha nem vê pontos do indicador (IM-029). Nenhuma visão traz nome, WhatsApp, e-mail ou
-- mensagem do visitante: só ids opacos do pedido (administrador).

-- Reversão (IM-078): novo lançamento negativo que aponta o crédito original; o original não muda. Motivo obrigatório,
-- autor e data gravados; auditoria na MESMA transação. Sem suspensão automática de ninguém. Invalidar indicação
-- (IM-077) = reverter com motivo. p_confirmar_saldo_negativo: o resgate está desativado (IM-037), então hoje o saldo
-- nunca fica negativo; quando houver resgate, reverter pontos já gastos exige esta confirmação após análise.
create function public.pontos_reverter_credito(
  p_lancamento_id uuid,
  p_motivo text,
  p_confirmar_saldo_negativo boolean default false
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := public.administracao_exigir_admin();
  v_motivo text := nullif(left(btrim(coalesce(p_motivo, '')), 500), '');
  o public.pontos_lancamento%rowtype;
  v_saldo integer;
  v_novo uuid;
begin
  if v_motivo is null then
    raise exception 'motivo obrigatório' using errcode = '22023';
  end if;
  select * into o from public.pontos_lancamento where id = p_lancamento_id;
  if not found then
    raise exception 'lançamento não encontrado' using errcode = 'P0002';
  end if;
  if o.tipo <> 'credito' then
    raise exception 'só crédito pode ser revertido' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('pontos_saldo:' || o.indicador_id::text, 0));
  if exists (select 1 from public.pontos_lancamento r where r.original_id = o.id) then
    raise exception 'crédito já revertido' using errcode = 'P0409';
  end if;
  select coalesce(sum(l.pontos), 0)::integer into v_saldo from public.pontos_lancamento l where l.indicador_id = o.indicador_id;
  if v_saldo - o.pontos < 0 and not coalesce(p_confirmar_saldo_negativo, false) then
    raise exception 'a reversão deixaria o saldo negativo: analise e confirme' using errcode = 'P0410';
  end if;

  insert into public.pontos_lancamento
    (indicador_id, tipo, pontos, original_id, destino_perfil_id, destino_item_id, destino_nome, motivo, autor_id,
     confirmou_saldo_negativo)
  values (o.indicador_id, 'reversao', -o.pontos, o.id, o.destino_perfil_id, o.destino_item_id, o.destino_nome,
          v_motivo, v_admin, v_saldo - o.pontos < 0)
  returning id into v_novo;

  insert into public.administracao_auditoria (autor_id, acao, alvo_tabela, alvo_id, motivo, valor_anterior, valor_novo)
  values (v_admin, 'reverter_pontos', 'pontos_lancamento', o.id::text, v_motivo,
          jsonb_build_object('situacao', 'creditado', 'pontos', o.pontos, 'saldo', v_saldo),
          jsonb_build_object('situacao', 'revertido', 'reversao_id', v_novo, 'pontos', -o.pontos,
                             'saldo', v_saldo - o.pontos, 'confirmou_saldo_negativo', v_saldo - o.pontos < 0));
  return v_novo;
end $$;
revoke all on function public.pontos_reverter_credito(uuid, text, boolean) from public, anon;
grant execute on function public.pontos_reverter_credito(uuid, text, boolean) to authenticated;

-- Reprocessamento (IM-028) ---------------------------------------------------------------------------------------
-- Administrador: reavalia um pedido sem decisão (ex.: falha de crédito). Idempotente: pedido já decidido não duplica
-- nada e não gera auditoria. Motivo obrigatório. A avaliação usa o estado ATUAL do destino (IM-079).
create function public.pontos_reprocessar_pedido(p_pedido_id uuid, p_motivo text) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := public.administracao_exigir_admin();
  v_motivo text := nullif(left(btrim(coalesce(p_motivo, '')), 500), '');
  v_antes bigint;
  v_decisao bigint;
  v_resultado text;
begin
  if v_motivo is null then
    raise exception 'motivo obrigatório' using errcode = '22023';
  end if;
  select d.id into v_antes from public.pontos_decisao d where d.pedido_id = p_pedido_id;
  v_decisao := public.pontos_avaliar_pedido(p_pedido_id);
  if v_antes is null then
    select d.motivo into v_resultado from public.pontos_decisao d where d.id = v_decisao;
    insert into public.administracao_auditoria (autor_id, acao, alvo_tabela, alvo_id, motivo, valor_anterior, valor_novo)
    values (v_admin, 'reprocessar_pontos_pedido', 'indicacoes_pedido_contato', p_pedido_id::text, v_motivo,
            jsonb_build_object('decisao', null),
            jsonb_build_object('decisao_id', v_decisao, 'motivo', v_resultado));
  end if;
  return v_decisao;
end $$;
revoke all on function public.pontos_reprocessar_pedido(uuid, text) from public, anon;
grant execute on function public.pontos_reprocessar_pedido(uuid, text) to authenticated;

-- Servidor (service_role): reprocessa em lote os pedidos com falha e sem decisão. Devolve quantos foram resolvidos.
create function public.pontos_reprocessar_pendentes(p_limite integer default 20) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_ok integer := 0;
begin
  for v_id in
    select f.pedido_id
    from public.pontos_falha f
    where not exists (select 1 from public.pontos_decisao d where d.pedido_id = f.pedido_id)
    group by f.pedido_id
    order by min(f.criado_em)
    limit least(greatest(coalesce(p_limite, 20), 1), 100)
  loop
    begin
      perform public.pontos_avaliar_pedido(v_id);
      v_ok := v_ok + 1;
    exception when others then
      insert into public.pontos_falha (pedido_id, erro) values (v_id, left(sqlstate || ': ' || sqlerrm, 200));
    end;
  end loop;
  return v_ok;
end $$;
revoke all on function public.pontos_reprocessar_pendentes(integer) from public, anon, authenticated;
grant execute on function public.pontos_reprocessar_pendentes(integer) to service_role;

-- Leitura do indicador (filtro fixo por auth.uid()) ----------------------------------------------------------------
-- Saldo único, sem expiração (IM-035): soma dos lançamentos. total_revertido é negativo.
create view public.pontos_meu_saldo as
select coalesce(sum(l.pontos), 0)::integer as saldo,
       coalesce(sum(l.pontos) filter (where l.tipo = 'credito'), 0)::integer as total_creditado,
       coalesce(sum(l.pontos) filter (where l.tipo = 'reversao'), 0)::integer as total_revertido,
       max(l.criado_em) as ultimo_lancamento_em
from public.pontos_lancamento l
where l.indicador_id = (select auth.uid());
revoke all on public.pontos_meu_saldo from anon, authenticated;
grant select on public.pontos_meu_saldo to authenticated;

-- situacao: creditado | revertido (crédito que já tem reversão) | reversao (o próprio estorno). motivo: só na reversão,
-- texto escrito pelo administrador (não deve conter dados do visitante).
create view public.pontos_meus_lancamentos as
select l.id,
       l.tipo,
       l.pontos,
       case when l.tipo = 'reversao' then 'reversao'
            when r.id is not null then 'revertido'
            else 'creditado' end as situacao,
       case when l.destino_perfil_id is not null then 'perfil' else 'item' end as destino_tipo,
       coalesce(l.destino_perfil_id, l.destino_item_id) as destino_id,
       l.destino_nome,
       l.motivo,
       l.original_id,
       l.criado_em
from public.pontos_lancamento l
left join public.pontos_lancamento r on r.original_id = l.id
where l.indicador_id = (select auth.uid());
revoke all on public.pontos_meus_lancamentos from anon, authenticated;
grant select on public.pontos_meus_lancamentos to authenticated;

-- Leitura do administrador (filtro por administracao_eh_admin()) -----------------------------------------------------
create view public.administracao_pontos_lancamentos as
select l.id,
       encode(sha256(convert_to('indicamais:indicador:' || l.indicador_id::text, 'UTF8')), 'hex') as indicador_ref,
       l.tipo,
       l.pontos,
       case when l.tipo = 'reversao' then 'reversao'
            when r.id is not null then 'revertido'
            else 'creditado' end as situacao,
       case when l.destino_perfil_id is not null then 'perfil' else 'item' end as destino_tipo,
       coalesce(l.destino_perfil_id, l.destino_item_id) as destino_id,
       l.destino_nome,
       l.motivo,
       l.original_id,
       l.pedido_id,
       l.confirmou_saldo_negativo,
       l.criado_em
from public.pontos_lancamento l
left join public.pontos_lancamento r on r.original_id = l.id
where public.administracao_eh_admin();
revoke all on public.administracao_pontos_lancamentos from anon, authenticated;
grant select on public.administracao_pontos_lancamentos to authenticated;

create view public.administracao_pontos_saldos as
select encode(sha256(convert_to('indicamais:indicador:' || l.indicador_id::text, 'UTF8')), 'hex') as indicador_ref,
       sum(l.pontos)::integer as saldo,
       coalesce(sum(l.pontos) filter (where l.tipo = 'credito'), 0)::integer as total_creditado,
       coalesce(sum(l.pontos) filter (where l.tipo = 'reversao'), 0)::integer as total_revertido,
       max(l.criado_em) as ultimo_lancamento_em
from public.pontos_lancamento l
where public.administracao_eh_admin()
group by l.indicador_id;
revoke all on public.administracao_pontos_saldos from anon, authenticated;
grant select on public.administracao_pontos_saldos to authenticated;

-- Decisões de pontuação por pedido (auditoria e Fase 6). Só ids opacos do pedido; nada do visitante.
create view public.administracao_pontos_decisoes as
select d.id,
       d.pedido_id,
       d.pedido_criado_em,
       case when p.perfil_id is not null then 'perfil' else 'item' end as destino_tipo,
       coalesce(p.perfil_id, p.item_id) as destino_id,
       case when d.link_id is null then null
            else encode(sha256(convert_to('indicamais:indicador:' || d.indicador_id::text, 'UTF8')), 'hex') end as indicador_ref,
       d.pontuado,
       d.motivo,
       d.pontos,
       d.intervalo_dias,
       d.decidido_em
from public.pontos_decisao d
join public.indicacoes_pedido_contato p on p.id = d.pedido_id
where public.administracao_eh_admin();
revoke all on public.administracao_pontos_decisoes from anon, authenticated;
grant select on public.administracao_pontos_decisoes to authenticated;

-- Falhas de crédito (alerta administrativo, IM-028). pendente = o pedido ainda não tem decisão.
create view public.administracao_pontos_falhas as
select f.pedido_id,
       count(*)::integer as falhas,
       max(f.criado_em) as ultima_falha_em,
       (array_agg(f.erro order by f.criado_em desc))[1] as ultimo_erro,
       not exists (select 1 from public.pontos_decisao d where d.pedido_id = f.pedido_id) as pendente
from public.pontos_falha f
where public.administracao_eh_admin()
group by f.pedido_id;
revoke all on public.administracao_pontos_falhas from anon, authenticated;
grant select on public.administracao_pontos_falhas to authenticated;
