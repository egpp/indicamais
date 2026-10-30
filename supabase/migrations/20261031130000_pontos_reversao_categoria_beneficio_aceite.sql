-- Fase 4 · módulo pontos · confirmações da D-012 de 30/10/2026 · IM-035, IM-036, IM-077, IM-078, IM-079, IM-086
--
-- (1) REVERSÃO COM CATEGORIA FIXA. O indicador vê só a categoria (contato_duplicado, indicacao_invalida, autoindicacao,
--     fraude, outro). A observação interna (coluna motivo) é livre, obrigatória, e só o administrador a lê.
-- (2) BENEFÍCIO CADASTRADO PELO ADMINISTRADOR NÃO É PUBLICADO SOZINHO. Nasce 'aguardando_aceite' (origem 'administrador')
--     e só o responsável do perfil aceita (aprova) ou recusa. O administrador só edita o que o responsável propôs
--     (versão 'pendente' de origem 'responsavel'): a edição vira uma contraproposta 'aguardando_aceite' e a versão original
--     fica 'substituida' (histórico imutável). Aceitar aprova a versão; ligar o benefício continua com o responsável.
-- (3) PRAZOS: prazo de resgate é DATA (prazo_resgate_ate); prazo de uso é "N dias depois do resgate" (prazo_uso_dias).
--     Benefício com prazo de resgate vencido (data < hoje em America/Sao_Paulo) sai da vitrine pública.
--
-- CÓDIGOS DE ERRO novos: 22023 categoria inválida ou motivo obrigatório; P0001 versão em estado que não permite a ação;
-- 42501 não é o responsável do perfil / administrador sobre o próprio perfil.

-- ===== (1) Reversão: categoria ==========================================================================================
alter table public.pontos_lancamento add column categoria text;
alter table public.pontos_lancamento add constraint pontos_lancamento_categoria_valida
  check (categoria is null or categoria in ('contato_duplicado', 'indicacao_invalida', 'autoindicacao', 'fraude', 'outro'));
-- NOT VALID: reversões antigas (sem categoria) não podem ser reescritas (histórico só de inserção); vale para as novas.
alter table public.pontos_lancamento add constraint pontos_lancamento_categoria_por_tipo
  check ((tipo = 'reversao' and categoria is not null) or (tipo = 'credito' and categoria is null)) not valid;
comment on column public.pontos_lancamento.categoria is 'Categoria fixa da reversão, visível ao indicador. A observação livre fica em motivo (só administrador).';
comment on column public.pontos_lancamento.motivo is 'Observação interna da reversão (só administrador). O indicador vê apenas a categoria.';

drop view public.pontos_meus_lancamentos;
drop view public.administracao_pontos_lancamentos;
drop function public.pontos_reverter_credito(uuid, text, boolean);

-- Reversão (IM-078): novo lançamento negativo que aponta o crédito original. Categoria fixa + observação interna.
create function public.pontos_reverter_credito(
  p_lancamento_id uuid,
  p_categoria text,
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
  if p_categoria is null or p_categoria not in ('contato_duplicado', 'indicacao_invalida', 'autoindicacao', 'fraude', 'outro') then
    raise exception 'categoria inválida' using errcode = '22023';
  end if;
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
    (indicador_id, tipo, pontos, original_id, destino_perfil_id, destino_item_id, destino_nome, categoria, motivo, autor_id,
     confirmou_saldo_negativo)
  values (o.indicador_id, 'reversao', -o.pontos, o.id, o.destino_perfil_id, o.destino_item_id, o.destino_nome,
          p_categoria, v_motivo, v_admin, v_saldo - o.pontos < 0)
  returning id into v_novo;

  insert into public.administracao_auditoria (autor_id, acao, alvo_tabela, alvo_id, motivo, valor_anterior, valor_novo)
  values (v_admin, 'reverter_pontos', 'pontos_lancamento', o.id::text, v_motivo,
          jsonb_build_object('situacao', 'creditado', 'pontos', o.pontos, 'saldo', v_saldo),
          jsonb_build_object('situacao', 'revertido', 'reversao_id', v_novo, 'categoria', p_categoria, 'pontos', -o.pontos,
                             'saldo', v_saldo - o.pontos, 'confirmou_saldo_negativo', v_saldo - o.pontos < 0));
  return v_novo;
end $$;
revoke all on function public.pontos_reverter_credito(uuid, text, text, boolean) from public, anon;
grant execute on function public.pontos_reverter_credito(uuid, text, text, boolean) to authenticated;

-- Visão do indicador: SÓ a categoria da reversão; a observação interna (motivo) não é coluna da visão.
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
       l.categoria,
       l.original_id,
       l.criado_em
from public.pontos_lancamento l
left join public.pontos_lancamento r on r.original_id = l.id
where l.indicador_id = (select auth.uid());
revoke all on public.pontos_meus_lancamentos from anon, authenticated;
grant select on public.pontos_meus_lancamentos to authenticated;

-- Visão do administrador: categoria e observação interna.
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
       l.categoria,
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

-- ===== (2) e (3) Benefícios =============================================================================================
drop view public.pontos_beneficio_publico;
drop view public.administracao_fila_beneficios;
drop function public.pontos_criar_beneficio(uuid, text, text, integer, text, integer, integer, date, date);
drop function public.pontos_salvar_beneficio(uuid, text, text, integer, text, integer, integer, date, date);
drop function public.pontos_admin_cadastrar_beneficio(uuid, text, text, integer, text, text, integer, integer, date, date);

-- Prazo de uso: N dias depois do resgate (substitui a data prazo_uso_ate; o resgate está desativado, IM-037).
alter table public.pontos_beneficio_versao drop constraint pontos_beneficio_versao_prazos;
alter table public.pontos_beneficio_versao drop column prazo_uso_ate;
alter table public.pontos_beneficio_versao add column prazo_uso_dias integer;
alter table public.pontos_beneficio_versao add constraint pontos_beneficio_versao_prazo_uso
  check (prazo_uso_dias is null or prazo_uso_dias between 1 and 3650);
alter table public.pontos_beneficio_versao add column origem text not null default 'responsavel';
alter table public.pontos_beneficio_versao add constraint pontos_beneficio_versao_origem
  check (origem in ('responsavel', 'administrador'));
-- proposta do administrador só existe como aguardando aceite (ou já decidida pelo responsável / substituída)
alter table public.pontos_beneficio_versao add constraint pontos_beneficio_versao_aguardando_do_admin
  check (situacao <> 'aguardando_aceite' or origem = 'administrador');

alter table public.pontos_beneficio_versao drop constraint pontos_beneficio_versao_situacao;
alter table public.pontos_beneficio_versao add constraint pontos_beneficio_versao_situacao
  check (situacao in ('rascunho', 'pendente', 'aguardando_aceite', 'aprovada', 'rejeitada', 'substituida'));
drop index public.pontos_beneficio_versao_uma_aberta;
create unique index pontos_beneficio_versao_uma_aberta on public.pontos_beneficio_versao (beneficio_id)
  where situacao in ('rascunho', 'pendente', 'aguardando_aceite');

-- Revisão: quem decidiu (administrador ou responsável que aceitou/recusou) e nova decisão 'substituida'.
alter table public.pontos_beneficio_revisao add column decisor text not null default 'administrador';
alter table public.pontos_beneficio_revisao add constraint pontos_beneficio_revisao_decisor
  check (decisor in ('administrador', 'responsavel'));
alter table public.pontos_beneficio_revisao drop constraint pontos_beneficio_revisao_decisao;
alter table public.pontos_beneficio_revisao add constraint pontos_beneficio_revisao_decisao
  check (decisao in ('aprovada', 'rejeitada', 'substituida'));
grant select (decisor) on public.pontos_beneficio_revisao to authenticated;

-- Gatilho próprio (o do catálogo é compartilhado e não conhece os estados novos).
drop trigger pontos_beneficio_versao_proteger on public.pontos_beneficio_versao;
create function public.pontos_beneficio_versao_proteger() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.situacao <> 'rascunho' then
      raise exception 'versão enviada é histórico e não pode ser apagada' using errcode = '42501';
    end if;
    return old;
  end if;
  if new.id <> old.id or new.beneficio_id <> old.beneficio_id or new.criado_em <> old.criado_em then
    raise exception 'identidade da versão é imutável' using errcode = '42501';
  end if;
  if old.situacao = 'rascunho' then
    if new.situacao not in ('rascunho', 'pendente') then
      raise exception 'rascunho só pode ser enviado (pendente)' using errcode = '42501';
    end if;
    return new;
  end if;
  if (to_jsonb(new) - 'situacao' - 'enviada_em') is distinct from (to_jsonb(old) - 'situacao' - 'enviada_em')
     or new.enviada_em is distinct from old.enviada_em then
    raise exception 'versão enviada é imutável' using errcode = '42501';
  end if;
  if new.situacao <> old.situacao and not (
       (old.situacao = 'pendente' and new.situacao in ('aprovada', 'rejeitada', 'substituida'))
    or (old.situacao = 'aguardando_aceite' and new.situacao in ('aprovada', 'rejeitada'))) then
    raise exception 'transição de situação inválida: % -> %', old.situacao, new.situacao using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function public.pontos_beneficio_versao_proteger() from public, anon, authenticated;
create trigger pontos_beneficio_versao_proteger before update or delete on public.pontos_beneficio_versao
  for each row execute function public.pontos_beneficio_versao_proteger();

-- Vitrine: prazo de resgate vencido esconde o benefício (dia do prazo ainda vale). Função definer para não recursar RLS.
create function public.pontos_beneficio_no_prazo(p_versao_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.pontos_beneficio_versao v
    where v.id = p_versao_id
      and (v.prazo_resgate_ate is null or v.prazo_resgate_ate >= (now() at time zone 'America/Sao_Paulo')::date));
$$;
revoke all on function public.pontos_beneficio_no_prazo(uuid) from public;
grant execute on function public.pontos_beneficio_no_prazo(uuid) to anon, authenticated;

drop policy pontos_beneficio_select_publico on public.pontos_beneficio;
create policy pontos_beneficio_select_publico on public.pontos_beneficio
  for select to anon, authenticated using (
    ativo and versao_aprovada_id is not null and public.perfis_perfil_disponivel(perfil_id)
    and public.pontos_beneficio_no_prazo(versao_aprovada_id));
drop policy pontos_beneficio_versao_select_publica on public.pontos_beneficio_versao;
create policy pontos_beneficio_versao_select_publica on public.pontos_beneficio_versao
  for select to anon, authenticated using (
    situacao = 'aprovada' and exists (
      select 1 from public.pontos_beneficio b
      where b.id = beneficio_id and b.versao_aprovada_id = pontos_beneficio_versao.id and b.ativo
        and public.perfis_perfil_disponivel(b.perfil_id))
    and public.pontos_beneficio_no_prazo(id));

-- Funções do responsável (assinaturas com prazo_uso_dias) ---------------------------------------------------------------
create function public.pontos_criar_beneficio(
  p_perfil_id uuid,
  p_nome text,
  p_descricao text,
  p_pontos_necessarios integer,
  p_condicoes text default null,
  p_limite_total integer default null,
  p_limite_por_pessoa integer default null,
  p_prazo_resgate_ate date default null,
  p_prazo_uso_dias integer default null
) returns table (o_beneficio_id uuid, o_versao_id uuid)
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_ben uuid;
  v_ver uuid;
begin
  if v_uid is null then
    raise exception 'não autenticado' using errcode = '42501';
  end if;
  if not exists (select 1 from public.perfis_perfil p where p.id = p_perfil_id and p.responsavel_id = v_uid) then
    raise exception 'perfil não encontrado' using errcode = '42501';
  end if;
  if not public.perfis_perfil_disponivel(p_perfil_id) then
    raise exception 'perfil indisponível' using errcode = 'P0002';
  end if;
  insert into public.pontos_beneficio (perfil_id) values (p_perfil_id) returning id into v_ben;
  insert into public.pontos_beneficio_versao
    (beneficio_id, nome, descricao, pontos_necessarios, condicoes, limite_total, limite_por_pessoa, prazo_resgate_ate, prazo_uso_dias)
  values (v_ben, p_nome, p_descricao, p_pontos_necessarios, p_condicoes, p_limite_total, p_limite_por_pessoa,
          p_prazo_resgate_ate, p_prazo_uso_dias)
  returning id into v_ver;
  o_beneficio_id := v_ben;
  o_versao_id := v_ver;
  return next;
end $$;

-- Salva o rascunho aberto ou cria nova versão (benefício aprovado). Versão em análise ou aguardando aceite não muda.
create function public.pontos_salvar_beneficio(
  p_beneficio_id uuid,
  p_nome text,
  p_descricao text,
  p_pontos_necessarios integer,
  p_condicoes text default null,
  p_limite_total integer default null,
  p_limite_por_pessoa integer default null,
  p_prazo_resgate_ate date default null,
  p_prazo_uso_dias integer default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_ver uuid;
  v_sit text;
begin
  if v_uid is null then
    raise exception 'não autenticado' using errcode = '42501';
  end if;
  perform 1 from public.pontos_beneficio b join public.perfis_perfil p on p.id = b.perfil_id
  where b.id = p_beneficio_id and p.responsavel_id = v_uid for update of b;
  if not found then
    raise exception 'benefício não encontrado' using errcode = '42501';
  end if;
  select v.id, v.situacao into v_ver, v_sit from public.pontos_beneficio_versao v
  where v.beneficio_id = p_beneficio_id and v.situacao in ('rascunho', 'pendente', 'aguardando_aceite');
  if found and v_sit <> 'rascunho' then
    raise exception 'há uma versão em análise ou aguardando aceite' using errcode = 'P0001';
  end if;
  if found then
    update public.pontos_beneficio_versao
       set nome = p_nome, descricao = p_descricao, pontos_necessarios = p_pontos_necessarios, condicoes = p_condicoes,
           limite_total = p_limite_total, limite_por_pessoa = p_limite_por_pessoa,
           prazo_resgate_ate = p_prazo_resgate_ate, prazo_uso_dias = p_prazo_uso_dias
     where id = v_ver;
  else
    insert into public.pontos_beneficio_versao
      (beneficio_id, nome, descricao, pontos_necessarios, condicoes, limite_total, limite_por_pessoa, prazo_resgate_ate, prazo_uso_dias)
    values (p_beneficio_id, p_nome, p_descricao, p_pontos_necessarios, p_condicoes, p_limite_total, p_limite_por_pessoa,
            p_prazo_resgate_ate, p_prazo_uso_dias)
    returning id into v_ver;
  end if;
  return v_ver;
end $$;

-- Aceite do responsável: aceita (aprova a versão, que passa a ser a aprovada; ligar o benefício continua com ele) ou
-- recusa (motivo obrigatório). Só vale para versão aguardando aceite do PRÓPRIO perfil.
create function public.pontos_responder_proposta_beneficio(p_versao_id uuid, p_aceitar boolean, p_motivo text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_ben uuid;
  v_sit text;
  v_anterior uuid;
  v_motivo text := nullif(left(btrim(coalesce(p_motivo, '')), 500), '');
begin
  if v_uid is null then
    raise exception 'não autenticado' using errcode = '42501';
  end if;
  if p_aceitar is null then
    raise exception 'informe aceitar ou recusar' using errcode = '22023';
  end if;
  select v.beneficio_id, v.situacao, b.versao_aprovada_id into v_ben, v_sit, v_anterior
  from public.pontos_beneficio_versao v
  join public.pontos_beneficio b on b.id = v.beneficio_id
  join public.perfis_perfil p on p.id = b.perfil_id
  where v.id = p_versao_id and p.responsavel_id = v_uid
  for update of v, b;
  if not found then
    raise exception 'proposta não encontrada' using errcode = '42501';
  end if;
  if v_sit <> 'aguardando_aceite' then
    raise exception 'só proposta aguardando aceite pode ser respondida' using errcode = 'P0001';
  end if;
  if not p_aceitar and v_motivo is null then
    raise exception 'motivo obrigatório na recusa' using errcode = '22023';
  end if;
  insert into public.pontos_beneficio_revisao (beneficio_id, versao_id, decisao, motivo, autor_id, versao_aprovada_anterior_id, decisor)
  values (v_ben, p_versao_id, case when p_aceitar then 'aprovada' else 'rejeitada' end, v_motivo, v_uid, v_anterior, 'responsavel');
  update public.pontos_beneficio_versao
     set situacao = case when p_aceitar then 'aprovada' else 'rejeitada' end
   where id = p_versao_id;
  if p_aceitar then
    update public.pontos_beneficio set versao_aprovada_id = p_versao_id where id = v_ben;
  end if;
  insert into public.administracao_auditoria (autor_id, acao, alvo_tabela, alvo_id, motivo, valor_anterior, valor_novo)
  values (v_uid, case when p_aceitar then 'aceitar_proposta_beneficio' else 'recusar_proposta_beneficio' end,
          'pontos_beneficio_versao', p_versao_id::text, v_motivo,
          jsonb_build_object('situacao', v_sit, 'beneficio_id', v_ben, 'versao_aprovada_anterior_id', v_anterior),
          jsonb_build_object('situacao', case when p_aceitar then 'aprovada' else 'rejeitada' end, 'beneficio_id', v_ben));
end $$;

-- Funções do administrador ---------------------------------------------------------------------------------------
-- Cadastro pelo administrador (IM-036): NÃO publica. Cria o benefício inativo e a versão 'aguardando_aceite' (origem
-- 'administrador'); só o aceite do responsável (pontos_responder_proposta_beneficio) a aprova. Motivo obrigatório + auditoria.
create function public.pontos_admin_cadastrar_beneficio(
  p_perfil_id uuid,
  p_nome text,
  p_descricao text,
  p_pontos_necessarios integer,
  p_motivo text,
  p_condicoes text default null,
  p_limite_total integer default null,
  p_limite_por_pessoa integer default null,
  p_prazo_resgate_ate date default null,
  p_prazo_uso_dias integer default null
) returns table (o_beneficio_id uuid, o_versao_id uuid)
language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := public.administracao_exigir_admin();
  v_motivo text := nullif(left(btrim(coalesce(p_motivo, '')), 500), '');
  v_dono uuid;
  v_ben uuid;
  v_ver uuid;
begin
  if v_motivo is null then
    raise exception 'motivo obrigatório' using errcode = '22023';
  end if;
  select p.responsavel_id into v_dono from public.perfis_perfil p where p.id = p_perfil_id;
  if not found or not public.perfis_perfil_disponivel(p_perfil_id) then
    raise exception 'perfil indisponível' using errcode = 'P0002';
  end if;
  if v_dono = v_admin then
    raise exception 'o responsável não decide o próprio conteúdo' using errcode = '42501';
  end if;
  insert into public.pontos_beneficio (perfil_id) values (p_perfil_id) returning id into v_ben;
  insert into public.pontos_beneficio_versao
    (beneficio_id, situacao, origem, enviada_em, nome, descricao, pontos_necessarios, condicoes, limite_total,
     limite_por_pessoa, prazo_resgate_ate, prazo_uso_dias)
  values (v_ben, 'aguardando_aceite', 'administrador', now(), p_nome, p_descricao, p_pontos_necessarios, p_condicoes,
          p_limite_total, p_limite_por_pessoa, p_prazo_resgate_ate, p_prazo_uso_dias)
  returning id into v_ver;
  insert into public.administracao_auditoria (autor_id, acao, alvo_tabela, alvo_id, motivo, valor_anterior, valor_novo)
  values (v_admin, 'cadastrar_beneficio', 'pontos_beneficio', v_ben::text, v_motivo, null,
          jsonb_build_object('perfil_id', p_perfil_id, 'versao_id', v_ver, 'situacao', 'aguardando_aceite',
                             'pontos_necessarios', p_pontos_necessarios, 'ativo', false));
  o_beneficio_id := v_ben;
  o_versao_id := v_ver;
  return next;
end $$;

-- Edição pelo administrador SÓ do que o responsável propôs (versão 'pendente', origem 'responsavel'). Vira contraproposta
-- aguardando aceite; a versão original fica 'substituida' (histórico). Devolve o id da nova versão.
create function public.pontos_admin_editar_proposta_beneficio(
  p_versao_id uuid,
  p_nome text,
  p_descricao text,
  p_pontos_necessarios integer,
  p_motivo text,
  p_condicoes text default null,
  p_limite_total integer default null,
  p_limite_por_pessoa integer default null,
  p_prazo_resgate_ate date default null,
  p_prazo_uso_dias integer default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := public.administracao_exigir_admin();
  v_motivo text := nullif(left(btrim(coalesce(p_motivo, '')), 500), '');
  v public.pontos_beneficio_versao%rowtype;
  v_dono uuid;
  v_anterior uuid;
  v_novo uuid;
begin
  if v_motivo is null then
    raise exception 'motivo obrigatório' using errcode = '22023';
  end if;
  select * into v from public.pontos_beneficio_versao where id = p_versao_id for update;
  if not found then
    raise exception 'versão não encontrada' using errcode = 'P0002';
  end if;
  select p.responsavel_id, b.versao_aprovada_id into v_dono, v_anterior
  from public.pontos_beneficio b
  join public.perfis_perfil p on p.id = b.perfil_id
  where b.id = v.beneficio_id
  for update of b;
  if v_dono = v_admin then
    raise exception 'o responsável não decide o próprio conteúdo' using errcode = '42501';
  end if;
  if v.situacao <> 'pendente' or v.origem <> 'responsavel' then
    raise exception 'o administrador só edita o que o responsável propôs e está em análise' using errcode = 'P0001';
  end if;
  insert into public.pontos_beneficio_revisao (beneficio_id, versao_id, decisao, motivo, autor_id, versao_aprovada_anterior_id)
  values (v.beneficio_id, v.id, 'substituida', v_motivo, v_admin, v_anterior);
  update public.pontos_beneficio_versao set situacao = 'substituida' where id = v.id;
  insert into public.pontos_beneficio_versao
    (beneficio_id, situacao, origem, enviada_em, nome, descricao, pontos_necessarios, condicoes, limite_total,
     limite_por_pessoa, prazo_resgate_ate, prazo_uso_dias)
  values (v.beneficio_id, 'aguardando_aceite', 'administrador', now(), p_nome, p_descricao, p_pontos_necessarios,
          p_condicoes, p_limite_total, p_limite_por_pessoa, p_prazo_resgate_ate, p_prazo_uso_dias)
  returning id into v_novo;
  insert into public.administracao_auditoria (autor_id, acao, alvo_tabela, alvo_id, motivo, valor_anterior, valor_novo)
  values (v_admin, 'editar_proposta_beneficio', 'pontos_beneficio_versao', v.id::text, v_motivo,
          jsonb_build_object('situacao', 'pendente', 'nome', v.nome, 'descricao', v.descricao,
                             'pontos_necessarios', v.pontos_necessarios, 'condicoes', v.condicoes,
                             'limite_total', v.limite_total, 'limite_por_pessoa', v.limite_por_pessoa,
                             'prazo_resgate_ate', v.prazo_resgate_ate, 'prazo_uso_dias', v.prazo_uso_dias),
          jsonb_build_object('situacao', 'aguardando_aceite', 'versao_id', v_novo, 'nome', p_nome,
                             'descricao', p_descricao, 'pontos_necessarios', p_pontos_necessarios,
                             'condicoes', p_condicoes, 'limite_total', p_limite_total,
                             'limite_por_pessoa', p_limite_por_pessoa, 'prazo_resgate_ate', p_prazo_resgate_ate,
                             'prazo_uso_dias', p_prazo_uso_dias));
  return v_novo;
end $$;

revoke all on function public.pontos_criar_beneficio(uuid, text, text, integer, text, integer, integer, date, integer) from public, anon;
revoke all on function public.pontos_salvar_beneficio(uuid, text, text, integer, text, integer, integer, date, integer) from public, anon;
revoke all on function public.pontos_responder_proposta_beneficio(uuid, boolean, text) from public, anon;
revoke all on function public.pontos_admin_cadastrar_beneficio(uuid, text, text, integer, text, text, integer, integer, date, integer) from public, anon;
revoke all on function public.pontos_admin_editar_proposta_beneficio(uuid, text, text, integer, text, text, integer, integer, date, integer) from public, anon;
grant execute on function public.pontos_criar_beneficio(uuid, text, text, integer, text, integer, integer, date, integer) to authenticated;
grant execute on function public.pontos_salvar_beneficio(uuid, text, text, integer, text, integer, integer, date, integer) to authenticated;
grant execute on function public.pontos_responder_proposta_beneficio(uuid, boolean, text) to authenticated;
grant execute on function public.pontos_admin_cadastrar_beneficio(uuid, text, text, integer, text, text, integer, integer, date, integer) to authenticated;
grant execute on function public.pontos_admin_editar_proposta_beneficio(uuid, text, text, integer, text, text, integer, integer, date, integer) to authenticated;

-- Visões ---------------------------------------------------------------------------------------------------------
-- Pública: ativo, aprovado, perfil disponível E prazo de resgate não vencido. prazo_uso_dias = N dias depois do resgate.
create view public.pontos_beneficio_publico with (security_invoker = true) as
select b.id, b.perfil_id, v.nome, v.descricao, v.pontos_necessarios, v.condicoes, v.limite_total,
       v.limite_por_pessoa, v.prazo_resgate_ate, v.prazo_uso_dias, b.criado_em
from public.pontos_beneficio b
join public.pontos_beneficio_versao v on v.id = b.versao_aprovada_id and v.situacao = 'aprovada'
where b.ativo and public.perfis_perfil_disponivel(b.perfil_id) and public.pontos_beneficio_no_prazo(v.id);
revoke all on public.pontos_beneficio_publico from anon, authenticated;
grant select on public.pontos_beneficio_publico to anon, authenticated;

-- Fila do administrador: propostas do responsável em análise (as únicas que ele pode decidir ou editar). As propostas
-- do próprio administrador aguardando aceite do responsável aparecem em administracao_beneficios_aguardando_aceite.
create view public.administracao_fila_beneficios with (security_invoker = true) as
select v.id as versao_id, v.beneficio_id, b.perfil_id, v.nome, v.enviada_em,
       (b.versao_aprovada_id is not null) as eh_edicao
from public.pontos_beneficio_versao v
join public.pontos_beneficio b on b.id = v.beneficio_id
where v.situacao = 'pendente' and v.origem = 'responsavel' and public.administracao_eh_admin();
revoke all on public.administracao_fila_beneficios from anon, authenticated;
grant select on public.administracao_fila_beneficios to authenticated;

create view public.administracao_beneficios_aguardando_aceite with (security_invoker = true) as
select v.id as versao_id, v.beneficio_id, b.perfil_id, v.nome, v.enviada_em
from public.pontos_beneficio_versao v
join public.pontos_beneficio b on b.id = v.beneficio_id
where v.situacao = 'aguardando_aceite' and public.administracao_eh_admin();
revoke all on public.administracao_beneficios_aguardando_aceite from anon, authenticated;
grant select on public.administracao_beneficios_aguardando_aceite to authenticated;
