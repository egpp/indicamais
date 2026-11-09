-- Fase 15 · módulo pontos · teto diário de pontos por indicador · IM-030, IM-035, IM-033, IM-034, IM-065, IM-078, IM-086, D-035
--
-- DESENHO
--   * Parâmetro auditado `teto_diario_pontos` em pontos_parametro (padrão 100, faixa 10 a 10000). Alteração só por
--     pontos_definir_parametro() (administrador geral, motivo obrigatório, auditoria com valor anterior e novo).
--   * Dia = dia civil em America/Sao_Paulo do PEDIDO (pedido_criado_em), não do processamento. Assim o reprocessamento
--     (pontos_reprocessar_pedido e pontos_reprocessar_pendentes, que chamam pontos_avaliar_pedido) conta o pedido no dia
--     certo e nunca dá dois créditos: a decisão continua única por pedido.
--   * Total do dia = soma de pontos_decisao.pontos das decisões PONTUADAS do indicador no dia. Reversão administrativa NÃO
--     devolve espaço no teto (mesma lógica do intervalo: o pedido revertido segue como referência); isso impede
--     "contato falso, reversão, contato falso de novo" e mantém o limite como freio de abuso.
--   * PONTUAÇÃO PARCIAL: NÃO. Escolha mais simples e segura: tudo ou nada. Se total do dia + pontos da indicação > teto,
--     a indicação não pontua (motivo `limite_diario`), em vez de creditar só a diferença. Com os padrões (10 por
--     indicação, teto 100) o resultado é o mesmo (10 indicações pontuam, a 11ª não). Teto que não é múltiplo dos pontos por
--     indicação deixa uma sobra sem uso, de propósito.
--   * Ordem das regras (D-035): sem atribuição, autoindicação, destino indisponível, dentro do intervalo, DEPOIS o teto. As
--     regras de duplicidade e autoindicação não mudam. O pedido de contato NUNCA é recusado por causa do teto: a decisão é
--     gravada com pontuado = false, pontos = 0 e motivo `limite_diario`; o visitante é atendido normalmente.
--   * Concorrência: advisory lock por indicador (depois do lock por chave de duplicidade; ordem fixa) serializa
--     avaliações do mesmo indicador; a soma é feita já com o lock. Gatilho espera pelos locks. Reprocessamento (lote e
--     pedido individual) usa a mesma ordem com pg_try_advisory_xact_lock: nunca espera, logo não forma deadlock; lock
--     ocupado = pedido pulado e ainda pendente (lote) ou erro 55P03 (administrador).
--   * Comissões e relacionamento não são tocados (IM-065): nenhuma tabela, função ou parâmetro deles muda aqui.
--   * O indicador lê os contatos sem pontos por limite em pontos_meus_limites_diarios e o total do dia em
--     pontos_meu_limite_diario(); sem dado do visitante (IM-029, IM-041).

-- Parâmetro ------------------------------------------------------------------------------------------------------
insert into public.pontos_parametro (chave, valor, minimo, maximo, descricao) values
  ('teto_diario_pontos', 100, 10, 10000, 'Máximo de pontos creditados por indicador por dia (America/Sao_Paulo). Acima disso o contato é aceito, mas não pontua (motivo limite_diario). D-035.');

-- Decisão: novo motivo e o teto aplicado ----------------------------------------------------------------------------
alter table public.pontos_decisao drop constraint pontos_decisao_motivo;
alter table public.pontos_decisao add constraint pontos_decisao_motivo check (
  motivo in ('pontuado', 'sem_atribuicao', 'autoindicacao', 'destino_indisponivel', 'dentro_do_intervalo', 'limite_diario'));
alter table public.pontos_decisao add column teto_diario integer;
alter table public.pontos_decisao add constraint pontos_decisao_teto check (
  (teto_diario is null or teto_diario between 10 and 10000)
  and (motivo <> 'limite_diario' or teto_diario is not null));
comment on column public.pontos_decisao.teto_diario is 'Teto diário vigente na avaliação (só quando o teto foi checado: pontuado ou limite_diario). Decisões antigas ficam nulas.';

create index pontos_decisao_indicador_dia_idx on public.pontos_decisao (indicador_id, pedido_criado_em) where pontuado;

-- Janela do dia civil em America/Sao_Paulo que contém o instante (início inclusive, fim exclusive) --------------------
create function public.pontos_janela_dia(p_em timestamptz) returns table (o_ini timestamptz, o_fim timestamptz)
language sql stable set search_path = '' as $$
  select (date_trunc('day', p_em at time zone 'America/Sao_Paulo')) at time zone 'America/Sao_Paulo',
         (date_trunc('day', p_em at time zone 'America/Sao_Paulo') + interval '1 day') at time zone 'America/Sao_Paulo';
$$;
revoke all on function public.pontos_janela_dia(timestamptz) from public, anon, authenticated;

-- Avaliação de UM pedido (mesma assinatura e mesmo contrato; acrescenta o teto diário) -----------------------------------
-- Corpo interno: p_sem_espera = true (reprocessamento) adquire os locks com pg_try_advisory_xact_lock e devolve NULL
-- se algum estiver ocupado (pedido pulado, segue pendente). false (gatilho) espera, como antes.
create function public.pontos_avaliar_pedido_interno(p_pedido_id uuid, p_sem_espera boolean) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_p public.indicacoes_pedido_contato%rowtype;
  v_decisao bigint;
  v_indicador uuid;
  v_disp boolean;
  v_dono uuid;
  v_nome text;
  v_ref_tipo text;
  v_ref_id uuid;
  v_item_perfil uuid;
  v_item_conta uuid;
  v_chave text;
  v_pts integer;
  v_iv integer;
  v_motivo text;
  v_teto integer;
  v_usado integer := 0;
  v_ini timestamptz;
  v_fim timestamptz;
begin
  select * into v_p from public.indicacoes_pedido_contato where id = p_pedido_id;
  if not found then
    raise exception 'pedido não encontrado' using errcode = 'P0002';
  end if;
  select d.id into v_decisao from public.pontos_decisao d where d.pedido_id = p_pedido_id;
  if found then
    return v_decisao;
  end if;

  -- Destino (IM-032): perfil comercial; item de perfil conta como o perfil; anúncio particular conta como a conta.
  select r.o_disponivel, r.o_dono_id, r.o_nome into v_disp, v_dono, v_nome
  from public.indicacoes_resolver_destino(v_p.perfil_id, v_p.item_id) r;
  if v_p.perfil_id is not null then
    v_ref_tipo := 'perfil';
    v_ref_id := v_p.perfil_id;
  else
    select i.perfil_id, i.conta_id into v_item_perfil, v_item_conta from public.catalogo_item i where i.id = v_p.item_id;
    if v_item_perfil is not null then
      v_ref_tipo := 'perfil';
      v_ref_id := v_item_perfil;
    else
      v_ref_tipo := 'conta';
      v_ref_id := v_item_conta;
    end if;
  end if;
  v_chave := encode(sha256(convert_to(
    'indicamais:pontos:' || v_p.whatsapp_e164 || '|' || v_ref_tipo || ':' || v_ref_id::text, 'UTF8')), 'hex');

  if v_p.link_id is not null then
    select l.indicador_id into v_indicador from public.indicacoes_link l where l.id = v_p.link_id;
  end if;

  -- Concorrência: um só crédito por janela da mesma chave.
  if p_sem_espera then
    if not pg_try_advisory_xact_lock(hashtextextended('pontos_chave:' || v_chave, 0)) then
      return null;
    end if;
  else
    perform pg_advisory_xact_lock(hashtextextended('pontos_chave:' || v_chave, 0));
  end if;
  select d.id into v_decisao from public.pontos_decisao d where d.pedido_id = p_pedido_id;
  if found then
    return v_decisao;
  end if;
  -- Teto diário: serializa as avaliações do mesmo indicador (sempre DEPOIS do lock da chave).
  if v_indicador is not null then
    if p_sem_espera then
      if not pg_try_advisory_xact_lock(hashtextextended('pontos_indicador_dia:' || v_indicador::text, 0)) then
        return null;
      end if;
    else
      perform pg_advisory_xact_lock(hashtextextended('pontos_indicador_dia:' || v_indicador::text, 0));
    end if;
  end if;

  v_pts := public.pontos_parametro_valor('pontos_por_indicacao');
  v_iv := public.pontos_parametro_valor('intervalo_dias');
  v_teto := public.pontos_parametro_valor('teto_diario_pontos');

  if v_indicador is not null then
    select j.o_ini, j.o_fim into v_ini, v_fim from public.pontos_janela_dia(v_p.criado_em) j;
    select coalesce(sum(d.pontos), 0)::integer into v_usado
    from public.pontos_decisao d
    where d.indicador_id = v_indicador and d.pontuado
      and d.pedido_criado_em >= v_ini and d.pedido_criado_em < v_fim;
  end if;

  if v_p.link_id is null then
    v_motivo := 'sem_atribuicao';
  elsif v_p.autoindicacao_suspeita or v_indicador is not distinct from v_dono
        or v_indicador is not distinct from v_item_conta
        or v_indicador is not distinct from v_p.solicitante_id then
    v_motivo := 'autoindicacao';
  elsif not coalesce(v_disp, false) then
    v_motivo := 'destino_indisponivel';
  elsif exists (
    select 1 from public.pontos_decisao d
    where d.chave_hash = v_chave and d.pontuado
      and d.pedido_criado_em > v_p.criado_em - v_iv * interval '24 hours'
      and d.pedido_criado_em < v_p.criado_em + v_iv * interval '24 hours'
  ) then
    v_motivo := 'dentro_do_intervalo';
  elsif v_usado + v_pts > v_teto then
    v_motivo := 'limite_diario';
  else
    v_motivo := 'pontuado';
  end if;

  insert into public.pontos_decisao
    (pedido_id, pedido_criado_em, chave_hash, destino_ref_tipo, destino_ref_id, link_id, indicador_id,
     pontuado, motivo, pontos, intervalo_dias, teto_diario)
  values (p_pedido_id, v_p.criado_em, v_chave, v_ref_tipo, v_ref_id, v_p.link_id, v_indicador,
          v_motivo = 'pontuado', v_motivo, case when v_motivo = 'pontuado' then v_pts else 0 end, v_iv,
          case when v_motivo in ('pontuado', 'limite_diario') then v_teto end)
  returning id into v_decisao;

  if v_motivo = 'pontuado' then
    insert into public.pontos_lancamento
      (indicador_id, tipo, pontos, pedido_id, destino_perfil_id, destino_item_id, destino_nome)
    values (v_indicador, 'credito', v_pts, p_pedido_id, v_p.perfil_id, v_p.item_id,
            coalesce(nullif(btrim(left(v_nome, 100)), ''), 'Destino'));
  end if;
  return v_decisao;
end $$;
revoke all on function public.pontos_avaliar_pedido_interno(uuid, boolean) from public, anon, authenticated;

-- Assinatura original (usada pelo gatilho): espera pelos locks, na ordem chave de duplicidade e depois indicador.
create or replace function public.pontos_avaliar_pedido(p_pedido_id uuid) returns bigint
language sql security definer set search_path = '' as $$
  select public.pontos_avaliar_pedido_interno(p_pedido_id, false);
$$;
revoke all on function public.pontos_avaliar_pedido(uuid) from public, anon, authenticated;

-- Reprocessamento sem deadlock (M1) -----------------------------------------------------------------------------------
-- Mesma ordem de locks do gatilho (chave, depois indicador), mas SEM ESPERA: o reprocessamento nunca fica bloqueado
-- segurando um lock enquanto espera outro, então não forma ciclo com um pedido novo. Lock ocupado = pedido pulado, sem
-- falha e sem decisão; continua pendente para o próximo ciclo do cron. Cada pedido do lote roda em seu próprio bloco
-- (subtransação); locks de transação só soltam no fim do lote, o que é inofensivo porque o lote nunca espera.
create or replace function public.pontos_reprocessar_pendentes(p_limite integer default 20) returns integer
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
      if public.pontos_avaliar_pedido_interno(v_id, true) is not null then
        v_ok := v_ok + 1;
      end if;
    exception when others then
      insert into public.pontos_falha (pedido_id, erro) values (v_id, left(sqlstate || ': ' || sqlerrm, 200));
    end;
  end loop;
  return v_ok;
end $$;

-- Administrador (definição de 20261102110000_administracao_permissoes.sql; muda só a chamada, sem espera).
-- Lock ocupado: erro 55P03 claro, nada gravado (nem auditoria); o administrador repete em instantes.
create or replace function public.pontos_reprocessar_pedido(p_pedido_id uuid, p_motivo text) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := public.administracao_exigir_permissao('reverter_pontos');
  v_motivo text := nullif(left(btrim(coalesce(p_motivo, '')), 500), '');
  v_antes bigint;
  v_decisao bigint;
  v_resultado text;
begin
  if v_motivo is null then
    raise exception 'motivo obrigatório' using errcode = '22023';
  end if;
  select d.id into v_antes from public.pontos_decisao d where d.pedido_id = p_pedido_id;
  v_decisao := public.pontos_avaliar_pedido_interno(p_pedido_id, true);
  if v_decisao is null then
    raise exception 'indicador em processamento, tente novamente' using errcode = '55P03';
  end if;
  if v_antes is null then
    select d.motivo into v_resultado from public.pontos_decisao d where d.id = v_decisao;
    insert into public.administracao_auditoria (autor_id, acao, alvo_tabela, alvo_id, motivo, valor_anterior, valor_novo)
    values (v_admin, 'reprocessar_pontos_pedido', 'indicacoes_pedido_contato', p_pedido_id::text, v_motivo,
            jsonb_build_object('decisao', null),
            jsonb_build_object('decisao_id', v_decisao, 'motivo', v_resultado));
  end if;
  return v_decisao;
end $$;

-- Leitura do indicador (filtro fixo por auth.uid()) -----------------------------------------------------------------
-- Contatos que não pontuaram por causa do teto. Só ids opacos do destino; nada do visitante.
create view public.pontos_meus_limites_diarios as
select d.id,
       d.pedido_criado_em as contato_em,
       case when p.perfil_id is not null then 'perfil' else 'item' end as destino_tipo,
       coalesce(p.perfil_id, p.item_id) as destino_id,
       d.teto_diario
from public.pontos_decisao d
join public.indicacoes_pedido_contato p on p.id = d.pedido_id
where d.indicador_id = (select auth.uid()) and d.motivo = 'limite_diario';
revoke all on public.pontos_meus_limites_diarios from anon, authenticated;
grant select on public.pontos_meus_limites_diarios to authenticated;

-- Teto vigente e pontos já creditados hoje (dia de Brasília) para o indicador logado.
create function public.pontos_meu_limite_diario() returns table (o_teto_diario integer, o_pontos_hoje integer)
language sql stable security definer set search_path = '' as $$
  select public.pontos_parametro_valor('teto_diario_pontos'),
         coalesce((
           select sum(d.pontos) from public.pontos_decisao d, public.pontos_janela_dia(now()) j
           where d.indicador_id = (select auth.uid()) and d.pontuado
             and d.pedido_criado_em >= j.o_ini and d.pedido_criado_em < j.o_fim
         ), 0)::integer
  where (select auth.uid()) is not null;
$$;
revoke all on function public.pontos_meu_limite_diario() from public, anon;
grant execute on function public.pontos_meu_limite_diario() to authenticated;
