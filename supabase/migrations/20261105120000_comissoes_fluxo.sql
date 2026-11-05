-- Fase 7 · módulo comissoes · vínculos, assinaturas, pagamentos, comissões, repasse, reversões e encerramento ·
-- IM-063, IM-064, IM-066, IM-067, IM-068, IM-069, IM-070, IM-071, IM-072, IM-073, IM-078, IM-086, D-025
--
-- REGRAS (D-025). Tudo manual: o administrador registra a assinatura e confirma cada mensalidade paga. Não há cobrança nem
-- repasse automático e nenhuma rotina agendada: o encerramento de vínculos também é ação do administrador (IM-068).
--   * Comissão: uma por pagamento confirmado (chave única em comissoes_pagamento e comissoes_comissao). Valor =
--     floor(valor pago x percentual vigente / 10000); percentual e base ficam congelados (IM-069, IM-073).
--   * Elegibilidade (IM-071): só a oferta que o cliente assinou gera comissão (a assinatura aponta a oferta).
--   * Adimplência do indicador (IM-066): no MESMO negócio, o indicador precisa de uma assinatura vigente sem mês em aberto,
--     contando do mês de início até o mês corrente (UTC). Mês em aberto = sem pagamento confirmado e não estornado.
--   * Inadimplência (IM-072): o relógio começa no PRIMEIRO mês sem pagamento confirmado (dia 1 do mês). Com várias
--     assinaturas em aberto vale a de início mais recente do relógio (mais favorável ao indicador; decisão conservadora
--     contra o encerramento, que é irreversível sem decisão nova). Sem assinatura vigente, o relógio começa no mês seguinte
--     ao fim/cancelamento da última.
--   * Sem retroativo (IM-067): cada pagamento é decidido uma vez, na confirmação, com o estado do momento
--     (comissoes_decisao). Regularizar depois não gera comissão dos meses em que não houve decisão "gerada".
--   * Mudanças (IM-073): módulo desabilitado, oferta inativa, vínculo encerrado ou indicador inadimplente só bloqueiam NOVAS
--     comissões; saldos e histórico permanecem. Cancelar assinatura bloqueia as futuras e NÃO reverte o já gerado; reverter
--     é ação explícita (comissoes_reverter_comissao) ou consequência do estorno do pagamento.
--   * Reversão sobre comissão já paga exige confirmação explícita (a análise do repasse é manual, IM-078).
--
-- Erros: 42501 não administrador; 22023 entrada inválida; P0002 registro inexistente; P0001 regra de negócio; P0409
-- duplicidade; P0410 exige confirmação (comissão já paga).

-- Situação do indicador no negócio (interna; as visões a chamam) -----------------------------------------------------
create function public.comissoes_situacao_indicador(p_perfil uuid, p_indicador uuid, p_ref date)
returns table (o_em_dia boolean, o_inadimplente_desde date)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_mes date := date_trunc('month', p_ref::timestamp)::date;
  r record;
  v_primeiro date;
  v_ha_ativa boolean := false;
  v_alguma_em_dia boolean := false;
  v_desde date;
  v_fim timestamp;
begin
  for r in
    select a.id, a.inicio
    from public.comissoes_assinatura a
    where a.perfil_id = p_perfil and a.cliente_id = p_indicador
      and a.inicio <= p_ref
      and (a.fim is null or a.fim >= p_ref)
      and not exists (
        select 1 from public.comissoes_assinatura_cancelamento c
        where c.assinatura_id = a.id and (c.cancelada_em at time zone 'utc')::date <= p_ref)
  loop
    v_ha_ativa := true;
    select min(m.mes)::date into v_primeiro
    from generate_series(date_trunc('month', r.inicio::timestamp), v_mes::timestamp, interval '1 month') as m (mes)
    where not exists (
      select 1 from public.comissoes_pagamento pg
      where pg.assinatura_id = r.id and pg.competencia = m.mes::date
        and not exists (select 1 from public.comissoes_pagamento_estorno e where e.pagamento_id = pg.id));
    if v_primeiro is null then
      v_alguma_em_dia := true;
    else
      v_desde := greatest(coalesce(v_desde, v_primeiro), v_primeiro);
    end if;
  end loop;

  if v_alguma_em_dia then
    o_em_dia := true;
    o_inadimplente_desde := null;
  elsif v_ha_ativa then
    o_em_dia := false;
    o_inadimplente_desde := v_desde;
  else
    select max(coalesce(c.cancelada_em at time zone 'utc', a.fim::timestamp)) into v_fim
    from public.comissoes_assinatura a
    left join public.comissoes_assinatura_cancelamento c on c.assinatura_id = a.id
    where a.perfil_id = p_perfil and a.cliente_id = p_indicador and a.inicio <= p_ref
      and (c.assinatura_id is not null or a.fim is not null);
    o_em_dia := false;
    o_inadimplente_desde := case when v_fim is null then null
                                 else (date_trunc('month', v_fim) + interval '1 month')::date end;
  end if;
  return next;
end $$;
revoke all on function public.comissoes_situacao_indicador(uuid, uuid, date) from public, anon, authenticated;

-- Decisão e geração da comissão de UM pagamento (interna). Idempotente: devolve a decisão existente. ----------------------
create function public.comissoes_avaliar_pagamento(p_pagamento uuid, p_autor uuid) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_pg public.comissoes_pagamento%rowtype;
  v_a public.comissoes_assinatura%rowtype;
  v_v public.comissoes_vinculo%rowtype;
  v_s record;
  v_decisao bigint;
  v_motivo text;
  v_bp integer;
  v_valor integer;
  v_comissao uuid;
begin
  select * into v_pg from public.comissoes_pagamento where id = p_pagamento;
  if not found then
    raise exception 'pagamento não encontrado' using errcode = 'P0002';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('comissoes_pagamento:' || p_pagamento::text, 0));
  select d.id into v_decisao from public.comissoes_decisao d where d.pagamento_id = p_pagamento;
  if found then
    return v_decisao;
  end if;
  select * into v_a from public.comissoes_assinatura where id = v_pg.assinatura_id;
  select * into v_v from public.comissoes_vinculo where perfil_id = v_a.perfil_id and cliente_id = v_a.cliente_id;

  if not found then
    v_motivo := 'sem_vinculo';
  elsif exists (select 1 from public.comissoes_vinculo_encerramento e where e.vinculo_id = v_v.id) then
    v_motivo := 'vinculo_encerrado';
  elsif not public.comissoes_modulo_ativo(v_a.perfil_id) then
    v_motivo := 'modulo_desativado';
  elsif not public.comissoes_oferta_ativa(v_a.oferta_id) then
    v_motivo := 'oferta_inativa';
  else
    select * into v_s from public.comissoes_situacao_indicador(v_a.perfil_id, v_v.indicador_id, public.comissoes_hoje());
    if not v_s.o_em_dia then
      v_motivo := 'indicador_inadimplente';
    else
      v_bp := public.comissoes_percentual_vigente(v_a.oferta_id);
      v_valor := (v_pg.valor_centavos::bigint * v_bp / 10000)::integer;
      v_motivo := case when v_valor < 1 then 'valor_zero' else 'gerada' end;
    end if;
  end if;

  insert into public.comissoes_decisao (pagamento_id, vinculo_id, indicador_id, gerada, motivo)
  values (p_pagamento, v_v.id, v_v.indicador_id, v_motivo = 'gerada', v_motivo)
  returning id into v_decisao;

  if v_motivo = 'gerada' then
    insert into public.comissoes_comissao
      (pagamento_id, perfil_id, oferta_id, vinculo_id, indicador_id, base_centavos, percentual_bp, valor_centavos)
    values (p_pagamento, v_a.perfil_id, v_a.oferta_id, v_v.id, v_v.indicador_id, v_pg.valor_centavos, v_bp, v_valor)
    returning id into v_comissao;
    insert into public.comissoes_lancamento (indicador_id, perfil_id, comissao_id, tipo, valor_centavos, autor_id)
    values (v_v.indicador_id, v_a.perfil_id, v_comissao, 'comissao', v_valor, p_autor);
    insert into public.comissoes_comissao_estado (comissao_id, estado, autor_id) values (v_comissao, 'gerada', p_autor);
  end if;
  return v_decisao;
end $$;
revoke all on function public.comissoes_avaliar_pagamento(uuid, uuid) from public, anon, authenticated;

-- Reversão (interna): lançamento novo que aponta o original (IM-073, IM-078). Uma só vez por comissão. -------------------
create function public.comissoes_inserir_reversao(p_comissao uuid, p_causa text, p_motivo text, p_autor uuid, p_confirmar boolean)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_orig public.comissoes_lancamento%rowtype;
  v_estado text;
  v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('comissoes_comissao:' || p_comissao::text, 0));
  select * into v_orig from public.comissoes_lancamento l where l.comissao_id = p_comissao and l.tipo = 'comissao';
  if not found then
    raise exception 'comissão não encontrada' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.comissoes_lancamento r where r.original_id = v_orig.id) then
    raise exception 'comissão já revertida' using errcode = 'P0409';
  end if;
  select e.estado into v_estado from public.comissoes_comissao_estado e
  where e.comissao_id = p_comissao order by e.id desc limit 1;
  if v_estado = 'paga' and not coalesce(p_confirmar, false) then
    raise exception 'comissão já paga: analise o repasse e confirme' using errcode = 'P0410';
  end if;
  insert into public.comissoes_lancamento
    (indicador_id, perfil_id, comissao_id, tipo, valor_centavos, original_id, causa, motivo, autor_id, confirmou_ja_paga)
  values (v_orig.indicador_id, v_orig.perfil_id, p_comissao, 'reversao', -v_orig.valor_centavos, v_orig.id, p_causa,
          p_motivo, p_autor, coalesce(v_estado = 'paga', false))
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.comissoes_inserir_reversao(uuid, text, text, uuid, boolean) from public, anon, authenticated;

-- Vínculo indicador -> cliente direto (administrador) ----------------------------------------------------------------
-- Exige módulo habilitado. Indicador e cliente são contas existentes, com acesso permitido, diferentes entre si e do
-- responsável do negócio. Um cliente tem um só indicador por negócio e não é transferido (IM-063, IM-069).
create function public.comissoes_registrar_vinculo(p_perfil uuid, p_indicador uuid, p_cliente uuid, p_motivo text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := public.administracao_exigir_admin();
  v_motivo text := nullif(left(btrim(coalesce(p_motivo, '')), 500), '');
  v_resp uuid;
  v_rede uuid;
  v_id uuid;
begin
  if v_motivo is null then
    raise exception 'motivo obrigatório' using errcode = '22023';
  end if;
  if p_indicador is null or p_cliente is null or p_indicador = p_cliente then
    raise exception 'indicador e cliente devem ser contas diferentes' using errcode = '22023';
  end if;
  select p.responsavel_id into v_resp from public.perfis_perfil p where p.id = p_perfil;
  if not found then
    raise exception 'negócio não encontrado' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.contas_conta c where c.id = p_indicador)
     or not exists (select 1 from public.contas_conta c where c.id = p_cliente) then
    raise exception 'conta não encontrada' using errcode = 'P0002';
  end if;
  if not public.comissoes_modulo_ativo(p_perfil) then
    raise exception 'módulo de comissões não habilitado para este negócio' using errcode = 'P0001';
  end if;
  if p_indicador = v_resp or p_cliente = v_resp
     or not public.contas_acesso_permitido(p_indicador) or not public.contas_acesso_permitido(p_cliente) then
    raise exception 'conta não pode participar desta rede' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('comissoes_vinculo:' || p_perfil::text || ':' || p_cliente::text, 0));
  if exists (select 1 from public.comissoes_vinculo v where v.perfil_id = p_perfil and v.cliente_id = p_cliente) then
    raise exception 'cliente já vinculado neste negócio' using errcode = 'P0409';
  end if;
  select r.id into v_rede from public.comissoes_rede r where r.perfil_id = p_perfil;
  insert into public.comissoes_vinculo (rede_id, perfil_id, indicador_id, cliente_id, criado_por)
  values (v_rede, p_perfil, p_indicador, p_cliente, v_admin)
  returning id into v_id;
  insert into public.administracao_auditoria (autor_id, acao, alvo_tabela, alvo_id, motivo, valor_anterior, valor_novo)
  values (v_admin, 'registrar_vinculo_comissoes', 'comissoes_vinculo', v_id::text, v_motivo,
          jsonb_build_object('vinculo', null),
          jsonb_build_object('perfil_id', p_perfil, 'indicador_id', p_indicador, 'cliente_id', p_cliente));
  return v_id;
end $$;
revoke all on function public.comissoes_registrar_vinculo(uuid, uuid, uuid, text) from public, anon;
grant execute on function public.comissoes_registrar_vinculo(uuid, uuid, uuid, text) to authenticated;

-- Assinatura registrada manualmente (administrador) -------------------------------------------------------------------
-- O módulo precisa ter sido habilitado ao menos uma vez (desabilitado continua registrando; só não gera comissão).
create function public.comissoes_registrar_assinatura(
  p_oferta uuid, p_cliente uuid, p_valor_centavos integer, p_inicio date, p_fim date, p_motivo text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := public.administracao_exigir_admin();
  v_motivo text := nullif(left(btrim(coalesce(p_motivo, '')), 500), '');
  v_perfil uuid;
  v_resp uuid;
  v_id uuid;
begin
  if v_motivo is null then
    raise exception 'motivo obrigatório' using errcode = '22023';
  end if;
  if p_valor_centavos is null or p_valor_centavos < 1 or p_valor_centavos > 100000000 then
    raise exception 'valor fora da faixa' using errcode = '22023';
  end if;
  if p_inicio is null or p_inicio < date '2020-01-01' or (p_fim is not null and p_fim < p_inicio) then
    raise exception 'vigência inválida' using errcode = '22023';
  end if;
  select o.perfil_id into v_perfil from public.comissoes_oferta o where o.id = p_oferta;
  if not found then
    raise exception 'oferta não encontrada' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.contas_conta c where c.id = p_cliente) then
    raise exception 'conta não encontrada' using errcode = 'P0002';
  end if;
  select p.responsavel_id into v_resp from public.perfis_perfil p where p.id = v_perfil;
  if p_cliente = v_resp or not public.contas_acesso_permitido(p_cliente) then
    raise exception 'conta não pode ser cliente deste negócio' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.comissoes_habilitacao_evento e where e.perfil_id = v_perfil) then
    raise exception 'módulo de comissões nunca habilitado para este negócio' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('comissoes_assinatura:' || p_oferta::text || ':' || p_cliente::text, 0));
  if exists (
    select 1 from public.comissoes_assinatura a
    where a.oferta_id = p_oferta and a.cliente_id = p_cliente
      and (a.fim is null or a.fim >= p_inicio)
      and not exists (select 1 from public.comissoes_assinatura_cancelamento c where c.assinatura_id = a.id)
  ) then
    raise exception 'já existe assinatura vigente deste cliente nesta oferta' using errcode = 'P0409';
  end if;
  insert into public.comissoes_assinatura (perfil_id, oferta_id, cliente_id, valor_centavos, inicio, fim, criada_por)
  values (v_perfil, p_oferta, p_cliente, p_valor_centavos, p_inicio, p_fim, v_admin)
  returning id into v_id;
  insert into public.administracao_auditoria (autor_id, acao, alvo_tabela, alvo_id, motivo, valor_anterior, valor_novo)
  values (v_admin, 'registrar_assinatura_comissoes', 'comissoes_assinatura', v_id::text, v_motivo,
          jsonb_build_object('assinatura', null),
          jsonb_build_object('oferta_id', p_oferta, 'cliente_id', p_cliente, 'valor_centavos', p_valor_centavos,
                             'inicio', p_inicio, 'fim', p_fim));
  return v_id;
end $$;
revoke all on function public.comissoes_registrar_assinatura(uuid, uuid, integer, date, date, text) from public, anon;
grant execute on function public.comissoes_registrar_assinatura(uuid, uuid, integer, date, date, text) to authenticated;

-- Cancelar assinatura: bloqueia comissões futuras; não reverte o já gerado (IM-073). ------------------------------------
create function public.comissoes_cancelar_assinatura(p_assinatura uuid, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := public.administracao_exigir_admin();
  v_motivo text := nullif(left(btrim(coalesce(p_motivo, '')), 500), '');
  v_a public.comissoes_assinatura%rowtype;
begin
  if v_motivo is null then
    raise exception 'motivo obrigatório' using errcode = '22023';
  end if;
  select * into v_a from public.comissoes_assinatura where id = p_assinatura;
  if not found then
    raise exception 'assinatura não encontrada' using errcode = 'P0002';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('comissoes_assinatura_cancelar:' || p_assinatura::text, 0));
  if exists (select 1 from public.comissoes_assinatura_cancelamento c where c.assinatura_id = p_assinatura) then
    raise exception 'assinatura já cancelada' using errcode = 'P0409';
  end if;
  insert into public.comissoes_assinatura_cancelamento (assinatura_id, motivo, autor_id)
  values (p_assinatura, v_motivo, v_admin);
  insert into public.administracao_auditoria (autor_id, acao, alvo_tabela, alvo_id, motivo, valor_anterior, valor_novo)
  values (v_admin, 'cancelar_assinatura_comissoes', 'comissoes_assinatura', p_assinatura::text, v_motivo,
          jsonb_build_object('situacao', 'vigente', 'valor_centavos', v_a.valor_centavos, 'fim', v_a.fim),
          jsonb_build_object('situacao', 'cancelada'));
end $$;
revoke all on function public.comissoes_cancelar_assinatura(uuid, text) from public, anon;
grant execute on function public.comissoes_cancelar_assinatura(uuid, text) to authenticated;

-- Confirmar pagamento mensal (IM-064, IM-070) -----------------------------------------------------------------------
-- p_competencia = dia 1 do mês pago. Só meses de 'início' até o mês corrente (UTC), respeitando fim e cancelamento.
-- Idempotente: repetir a confirmação devolve o mesmo pagamento, sem nova comissão nem nova auditoria. Pagamento estornado
-- não é confirmado de novo (P0409). A comissão (se houver) nasce na MESMA transação, com a decisão e a auditoria.
create function public.comissoes_confirmar_pagamento(p_assinatura uuid, p_competencia date, p_valor_centavos integer, p_motivo text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := public.administracao_exigir_admin();
  v_motivo text := nullif(left(btrim(coalesce(p_motivo, '')), 500), '');
  v_a public.comissoes_assinatura%rowtype;
  v_mes_atual date := date_trunc('month', public.comissoes_hoje()::timestamp)::date;
  v_cancel timestamptz;
  v_pag uuid;
  v_dec bigint;
  v_dec_motivo text;
  v_com_valor integer;
begin
  if v_motivo is null then
    raise exception 'motivo obrigatório' using errcode = '22023';
  end if;
  if p_competencia is null or extract(day from p_competencia) <> 1 then
    raise exception 'competência deve ser o dia 1 do mês' using errcode = '22023';
  end if;
  if p_valor_centavos is null or p_valor_centavos < 1 or p_valor_centavos > 100000000 then
    raise exception 'valor fora da faixa' using errcode = '22023';
  end if;
  select * into v_a from public.comissoes_assinatura where id = p_assinatura;
  if not found then
    raise exception 'assinatura não encontrada' using errcode = 'P0002';
  end if;
  if p_competencia > v_mes_atual
     or p_competencia < date_trunc('month', v_a.inicio::timestamp)::date
     or (v_a.fim is not null and p_competencia > date_trunc('month', v_a.fim::timestamp)::date) then
    raise exception 'competência fora da vigência da assinatura' using errcode = '22023';
  end if;
  select c.cancelada_em into v_cancel from public.comissoes_assinatura_cancelamento c where c.assinatura_id = p_assinatura;
  if found and p_competencia > date_trunc('month', v_cancel at time zone 'utc')::date then
    raise exception 'assinatura cancelada antes desta competência' using errcode = 'P0001';
  end if;
  -- Valor diferente do contratado só com justificativa detalhada (mín. 10 caracteres); vai para a auditoria.
  if p_valor_centavos <> v_a.valor_centavos and char_length(v_motivo) < 10 then
    raise exception 'valor difere da assinatura: justifique no motivo (mín. 10 caracteres)' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('comissoes_pagamento_conf:' || p_assinatura::text || ':' || p_competencia::text, 0));
  select pg.id into v_pag from public.comissoes_pagamento pg
  where pg.assinatura_id = p_assinatura and pg.competencia = p_competencia;
  if found then
    if exists (select 1 from public.comissoes_pagamento_estorno e where e.pagamento_id = v_pag) then
      raise exception 'pagamento desta competência foi estornado' using errcode = 'P0409';
    end if;
    return v_pag;
  end if;
  -- Um mês só gera pagamento (e comissão) uma vez por cliente e oferta, mesmo com nova assinatura após cancelar.
  perform pg_advisory_xact_lock(hashtextextended(
    'comissoes_pagamento_cliente:' || v_a.oferta_id::text || ':' || v_a.cliente_id::text || ':' || p_competencia::text, 0));
  if exists (
    select 1 from public.comissoes_pagamento pg2
    join public.comissoes_assinatura a2 on a2.id = pg2.assinatura_id
    where a2.oferta_id = v_a.oferta_id and a2.cliente_id = v_a.cliente_id and pg2.competencia = p_competencia
      and not exists (select 1 from public.comissoes_pagamento_estorno e2 where e2.pagamento_id = pg2.id)
  ) then
    raise exception 'competência já paga para este cliente nesta oferta (outra assinatura)' using errcode = 'P0409';
  end if;

  insert into public.comissoes_pagamento (assinatura_id, competencia, valor_centavos, confirmado_por)
  values (p_assinatura, p_competencia, p_valor_centavos, v_admin)
  returning id into v_pag;
  v_dec := public.comissoes_avaliar_pagamento(v_pag, v_admin);
  select d.motivo into v_dec_motivo from public.comissoes_decisao d where d.id = v_dec;
  select c.valor_centavos into v_com_valor from public.comissoes_comissao c where c.pagamento_id = v_pag;

  insert into public.administracao_auditoria (autor_id, acao, alvo_tabela, alvo_id, motivo, valor_anterior, valor_novo)
  values (v_admin, 'confirmar_pagamento_comissoes', 'comissoes_pagamento', v_pag::text, v_motivo,
          jsonb_build_object('pagamento', null),
          jsonb_build_object('assinatura_id', p_assinatura, 'competencia', p_competencia, 'valor_centavos', p_valor_centavos,
                             'decisao', v_dec_motivo, 'comissao_centavos', v_com_valor,
                             'valor_assinatura_centavos', v_a.valor_centavos,
                             'valor_diferente', p_valor_centavos <> v_a.valor_centavos));
  return v_pag;
end $$;
revoke all on function public.comissoes_confirmar_pagamento(uuid, date, integer, text) from public, anon;
grant execute on function public.comissoes_confirmar_pagamento(uuid, date, integer, text) to authenticated;

-- Estornar pagamento (IM-073): o pagamento deixa de contar; se gerou comissão, ela é REVERTIDA por lançamento novo. -------
-- Comissão já paga exige p_confirmar_ja_paga (P0410); sem confirmação nada é gravado (transação inteira desfeita).
create function public.comissoes_estornar_pagamento(p_pagamento uuid, p_motivo text, p_confirmar_ja_paga boolean default false)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := public.administracao_exigir_admin();
  v_motivo text := nullif(left(btrim(coalesce(p_motivo, '')), 500), '');
  v_pg public.comissoes_pagamento%rowtype;
  v_comissao uuid;
  v_rev uuid;
begin
  if v_motivo is null then
    raise exception 'motivo obrigatório' using errcode = '22023';
  end if;
  select * into v_pg from public.comissoes_pagamento where id = p_pagamento;
  if not found then
    raise exception 'pagamento não encontrado' using errcode = 'P0002';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('comissoes_pagamento_est:' || p_pagamento::text, 0));
  if exists (select 1 from public.comissoes_pagamento_estorno e where e.pagamento_id = p_pagamento) then
    raise exception 'pagamento já estornado' using errcode = 'P0409';
  end if;
  insert into public.comissoes_pagamento_estorno (pagamento_id, motivo, autor_id) values (p_pagamento, v_motivo, v_admin);
  select c.id into v_comissao from public.comissoes_comissao c where c.pagamento_id = p_pagamento;
  if v_comissao is not null then
    perform pg_advisory_xact_lock(hashtextextended('comissoes_comissao:' || v_comissao::text, 0));
    -- Comissão já revertida antes (ex.: causa 'correcao'): o estorno do pagamento segue sem nova reversão (sem duplicar).
    select r.id into v_rev from public.comissoes_lancamento r where r.comissao_id = v_comissao and r.tipo = 'reversao';
    if v_rev is null then
      v_rev := public.comissoes_inserir_reversao(v_comissao, 'estorno', v_motivo, v_admin, p_confirmar_ja_paga);
    end if;
  end if;
  insert into public.administracao_auditoria (autor_id, acao, alvo_tabela, alvo_id, motivo, valor_anterior, valor_novo)
  values (v_admin, 'estornar_pagamento_comissoes', 'comissoes_pagamento', p_pagamento::text, v_motivo,
          jsonb_build_object('situacao', 'pago', 'competencia', v_pg.competencia, 'valor_centavos', v_pg.valor_centavos),
          jsonb_build_object('situacao', 'estornado', 'reversao_id', v_rev));
  return v_rev;
end $$;
revoke all on function public.comissoes_estornar_pagamento(uuid, text, boolean) from public, anon;
grant execute on function public.comissoes_estornar_pagamento(uuid, text, boolean) to authenticated;

-- Reverter uma comissão (cancelamento, estorno ou correção) por lançamento novo (IM-073, IM-078) ------------------------
create function public.comissoes_reverter_comissao(p_comissao uuid, p_causa text, p_motivo text, p_confirmar_ja_paga boolean default false)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := public.administracao_exigir_admin();
  v_motivo text := nullif(left(btrim(coalesce(p_motivo, '')), 500), '');
  v_c public.comissoes_comissao%rowtype;
  v_estado text;
  v_rev uuid;
begin
  if p_causa is null or p_causa not in ('cancelamento', 'estorno', 'correcao') then
    raise exception 'causa inválida' using errcode = '22023';
  end if;
  if v_motivo is null then
    raise exception 'motivo obrigatório' using errcode = '22023';
  end if;
  select * into v_c from public.comissoes_comissao where id = p_comissao;
  if not found then
    raise exception 'comissão não encontrada' using errcode = 'P0002';
  end if;
  select e.estado into v_estado from public.comissoes_comissao_estado e
  where e.comissao_id = p_comissao order by e.id desc limit 1;
  v_rev := public.comissoes_inserir_reversao(p_comissao, p_causa, v_motivo, v_admin, p_confirmar_ja_paga);
  insert into public.administracao_auditoria (autor_id, acao, alvo_tabela, alvo_id, motivo, valor_anterior, valor_novo)
  values (v_admin, 'reverter_comissao', 'comissoes_lancamento', p_comissao::text, v_motivo,
          jsonb_build_object('situacao', v_estado, 'valor_centavos', v_c.valor_centavos),
          jsonb_build_object('situacao', 'revertida', 'reversao_id', v_rev, 'causa', p_causa,
                             'valor_centavos', -v_c.valor_centavos));
  return v_rev;
end $$;
revoke all on function public.comissoes_reverter_comissao(uuid, text, text, boolean) from public, anon;
grant execute on function public.comissoes_reverter_comissao(uuid, text, text, boolean) to authenticated;

-- Repasse manual (IM-064, IM-070): gerada -> pendente_repasse -> paga. Nada é pago automaticamente. -----------------------
-- Idempotente: estado já registrado devolve null sem auditoria. Comissão revertida não avança (P0001).
create function public.comissoes_avancar_repasse(p_comissao uuid, p_estado text, p_motivo text) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := public.administracao_exigir_admin();
  v_motivo text := nullif(left(btrim(coalesce(p_motivo, '')), 500), '');
  v_anterior text;
  v_id bigint;
begin
  if p_estado is null or p_estado not in ('pendente_repasse', 'paga') then
    raise exception 'estado inválido' using errcode = '22023';
  end if;
  if v_motivo is null then
    raise exception 'motivo obrigatório' using errcode = '22023';
  end if;
  if not exists (select 1 from public.comissoes_comissao c where c.id = p_comissao) then
    raise exception 'comissão não encontrada' using errcode = 'P0002';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('comissoes_comissao:' || p_comissao::text, 0));
  if exists (select 1 from public.comissoes_comissao_estado e where e.comissao_id = p_comissao and e.estado = p_estado) then
    return null;
  end if;
  select e.estado into v_anterior from public.comissoes_comissao_estado e
  where e.comissao_id = p_comissao order by e.id desc limit 1;
  insert into public.comissoes_comissao_estado (comissao_id, estado, autor_id, motivo)
  values (p_comissao, p_estado, v_admin, v_motivo)
  returning id into v_id;
  insert into public.administracao_auditoria (autor_id, acao, alvo_tabela, alvo_id, motivo, valor_anterior, valor_novo)
  values (v_admin, 'repasse_comissao', 'comissoes_comissao_estado', p_comissao::text, v_motivo,
          jsonb_build_object('estado', v_anterior), jsonb_build_object('estado', p_estado, 'evento_id', v_id));
  return v_id;
end $$;
revoke all on function public.comissoes_avancar_repasse(uuid, text, text) from public, anon;
grant execute on function public.comissoes_avancar_repasse(uuid, text, text) to authenticated;

-- Encerramento de vínculos por inadimplência (IM-068, IM-072): SÓ o administrador, nunca automático --------------------
-- Lista os vínculos ativos cujo indicador está inadimplente além do prazo configurado.
create function public.comissoes_listar_vinculos_vencidos(p_perfil uuid default null)
returns table (o_vinculo_id uuid, o_perfil_id uuid, o_indicador_ref text, o_inadimplente_desde date, o_prazo_dias integer, o_vence_em date)
language plpgsql security definer set search_path = '' as $$
declare
  v_prazo integer := public.comissoes_parametro_valor('prazo_inadimplencia_dias');
  v_hoje date := public.comissoes_hoje();
begin
  perform public.administracao_exigir_admin();
  return query
  select v.id, v.perfil_id,
         encode(sha256(convert_to('indicamais:indicador:' || v.indicador_id::text, 'UTF8')), 'hex'),
         s.o_inadimplente_desde, v_prazo, s.o_inadimplente_desde + v_prazo
  from public.comissoes_vinculo v
  cross join lateral public.comissoes_situacao_indicador(v.perfil_id, v.indicador_id, v_hoje) s
  where (p_perfil is null or v.perfil_id = p_perfil)
    and not exists (select 1 from public.comissoes_vinculo_encerramento e where e.vinculo_id = v.id)
    and not s.o_em_dia and s.o_inadimplente_desde is not null
    and s.o_inadimplente_desde + v_prazo <= v_hoje
  order by s.o_inadimplente_desde, v.id;
end $$;
revoke all on function public.comissoes_listar_vinculos_vencidos(uuid) from public, anon;
grant execute on function public.comissoes_listar_vinculos_vencidos(uuid) to authenticated;

-- Encerra UM vínculo vencido: vale para comissões futuras; histórico e comissões anteriores ficam; sem restaurar. -----------
-- O cliente não é transferido (IM-069); o indicador pode formar nova carteira com outros clientes (IM-068).
create function public.comissoes_encerrar_vinculo(p_vinculo uuid, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := public.administracao_exigir_admin();
  v_motivo text := nullif(left(btrim(coalesce(p_motivo, '')), 500), '');
  v_prazo integer := public.comissoes_parametro_valor('prazo_inadimplencia_dias');
  v_hoje date := public.comissoes_hoje();
  v_v public.comissoes_vinculo%rowtype;
  v_s record;
begin
  if v_motivo is null then
    raise exception 'motivo obrigatório' using errcode = '22023';
  end if;
  select * into v_v from public.comissoes_vinculo where id = p_vinculo;
  if not found then
    raise exception 'vínculo não encontrado' using errcode = 'P0002';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('comissoes_vinculo_enc:' || p_vinculo::text, 0));
  if exists (select 1 from public.comissoes_vinculo_encerramento e where e.vinculo_id = p_vinculo) then
    raise exception 'vínculo já encerrado' using errcode = 'P0409';
  end if;
  select * into v_s from public.comissoes_situacao_indicador(v_v.perfil_id, v_v.indicador_id, v_hoje);
  if v_s.o_em_dia or v_s.o_inadimplente_desde is null or v_s.o_inadimplente_desde + v_prazo > v_hoje then
    raise exception 'o prazo de inadimplência ainda não venceu' using errcode = 'P0001';
  end if;
  insert into public.comissoes_vinculo_encerramento (vinculo_id, inadimplente_desde, prazo_dias, motivo, autor_id)
  values (p_vinculo, v_s.o_inadimplente_desde, v_prazo, v_motivo, v_admin);
  insert into public.administracao_auditoria (autor_id, acao, alvo_tabela, alvo_id, motivo, valor_anterior, valor_novo)
  values (v_admin, 'encerrar_vinculo_comissoes', 'comissoes_vinculo', p_vinculo::text, v_motivo,
          jsonb_build_object('situacao', 'ativo', 'inadimplente_desde', v_s.o_inadimplente_desde),
          jsonb_build_object('situacao', 'encerrado', 'prazo_dias', v_prazo));
end $$;
revoke all on function public.comissoes_encerrar_vinculo(uuid, text) from public, anon;
grant execute on function public.comissoes_encerrar_vinculo(uuid, text) to authenticated;
