-- Fase 6 · módulo contas · base do ciclo de vida da conta (suspensão e encerramento) · IM-080, IM-081, IM-082, IM-086,
-- D-014
--
-- DESENHO
--   contas_ciclo_vida          situação de cada conta que SAIU do normal (ausência de linha = ativa). Situações: ativa,
--                              suspensa, encerramento_solicitado, anonimizada. Mutável só por funções do banco. Ninguém lê
--                              conta_id: o próprio usuário consulta por contas_meu_estado() (flag para o proxy e para a interface).
--   contas_ciclo_vida_evento   histórico do ciclo de vida (suspensa, reativada, encerramento_solicitado, encerramento_cancelado,
--                              anonimizada, anonimizacao_falhou). Só inserção. Sem dado pessoal. A auditoria administrativa
--                              (autor, motivo, valor anterior) continua em administracao_auditoria.
--   contas_parametro           parâmetros do módulo (carência do encerramento: 30 dias, D-014, provisório até a revisão
--                              jurídica, IM-082). Alterado só por contas_definir_parametro() (administrador geral, motivo, auditoria).
--
-- EFEITOS DA SUSPENSÃO NO BANCO (as RPCs de suspender/reativar estão na migração seguinte)
--   * perfis e itens da conta saem do ar porque são DESPUBLICADOS; um gatilho impede republicar enquanto a conta não está
--     ativa. Reativar NÃO republica: o responsável republica por conta própria.
--   * perfis_perfil_disponivel() passa a exigir conta que pode publicar: contato, indicação, pontos e resgates ligados a
--     perfil de conta suspensa deixam de existir (IM-079).
--   * contas_pode_indicar() passa a exigir acesso permitido: conta suspensa não gera link.
--   * Pedido de contato feito por link de indicador suspenso entra SEM atribuição: não pontua e não entra na base
--     (gatilho BEFORE INSERT; o visitante não é prejudicado).
--   * Políticas RESTRICTIVE: conta sem acesso não escreve pelas tabelas que o cliente grava direto.
--   * Flag consultável para o proxy: contas_meu_estado() (authenticated).

-- Tabelas ---------------------------------------------------------------------------------------------------------
create table public.contas_ciclo_vida (
  conta_id uuid primary key references public.contas_conta (id) on delete restrict,
  situacao text not null default 'ativa',
  suspensa_em timestamptz,
  encerramento_solicitado_em timestamptz,
  encerramento_executar_apos timestamptz,
  anonimizada_em timestamptz,
  atualizado_em timestamptz not null default now(),
  constraint contas_ciclo_vida_situacao check (situacao in ('ativa', 'suspensa', 'encerramento_solicitado', 'anonimizada')),
  constraint contas_ciclo_vida_coerente check (
    (situacao = 'ativa' and suspensa_em is null and encerramento_solicitado_em is null
       and encerramento_executar_apos is null and anonimizada_em is null)
    or (situacao = 'suspensa' and suspensa_em is not null and encerramento_solicitado_em is null
       and encerramento_executar_apos is null and anonimizada_em is null)
    or (situacao = 'encerramento_solicitado' and encerramento_solicitado_em is not null
       and encerramento_executar_apos is not null and suspensa_em is null and anonimizada_em is null)
    or (situacao = 'anonimizada' and anonimizada_em is not null))
);
comment on table public.contas_ciclo_vida is 'Situação de ciclo de vida da conta (IM-080, IM-081). Sem linha = ativa. conta_id nunca é legível por papel de API.';

create table public.contas_ciclo_vida_evento (
  id bigint generated always as identity primary key,
  conta_id uuid not null references public.contas_conta (id) on delete restrict,
  evento text not null,
  origem text not null,
  criado_em timestamptz not null default now(),
  constraint contas_ciclo_vida_evento_tipo check (evento in (
    'suspensa', 'reativada', 'encerramento_solicitado', 'encerramento_cancelado', 'anonimizada', 'anonimizacao_falhou')),
  constraint contas_ciclo_vida_evento_origem check (origem in ('administrador', 'propria', 'rotina'))
);
create index contas_ciclo_vida_evento_conta_idx on public.contas_ciclo_vida_evento (conta_id, criado_em desc);
comment on table public.contas_ciclo_vida_evento is 'Histórico do ciclo de vida da conta. Só inserção; sem dado pessoal (a conta anonimizada continua identificável só pelo id opaco).';

create table public.contas_parametro (
  chave text primary key,
  valor integer not null,
  minimo integer not null,
  maximo integer not null,
  descricao text not null,
  atualizado_em timestamptz not null default now(),
  constraint contas_parametro_chave check (char_length(chave) between 1 and 80),
  constraint contas_parametro_faixa check (minimo <= maximo and valor between minimo and maximo)
);
comment on table public.contas_parametro is 'Parâmetros do módulo contas. Alterados só por contas_definir_parametro() (auditado).';
insert into public.contas_parametro (chave, valor, minimo, maximo, descricao) values
  ('encerramento_carencia_dias', 30, 1, 365, 'Dias entre a solicitação de encerramento e a anonimização; a pessoa pode desistir nesse prazo (D-014, provisório até a revisão jurídica, IM-082).');

-- Privilégios e RLS -----------------------------------------------------------------------------------------------
revoke all on public.contas_ciclo_vida from anon, authenticated;
revoke all on public.contas_ciclo_vida_evento from anon, authenticated;
revoke all on public.contas_parametro from anon, authenticated;

alter table public.contas_ciclo_vida enable row level security;
alter table public.contas_ciclo_vida force row level security;
alter table public.contas_ciclo_vida_evento enable row level security;
alter table public.contas_ciclo_vida_evento force row level security;
alter table public.contas_parametro enable row level security;
alter table public.contas_parametro force row level security;

-- Sem privilégio de tabela para ninguém: a leitura da própria situação é por contas_meu_estado().
create policy contas_ciclo_vida_select_proprio on public.contas_ciclo_vida
  for select to authenticated using (conta_id = (select auth.uid()));
create policy contas_ciclo_vida_insert_negado on public.contas_ciclo_vida
  for insert to authenticated with check (false);
create policy contas_ciclo_vida_update_negado on public.contas_ciclo_vida
  for update to authenticated using (false) with check (false);
create policy contas_ciclo_vida_delete_negado on public.contas_ciclo_vida
  for delete to authenticated using (false);

create policy contas_ciclo_vida_evento_select_admin on public.contas_ciclo_vida_evento
  for select to authenticated using ((select public.administracao_eh_admin()));
create policy contas_ciclo_vida_evento_insert_negado on public.contas_ciclo_vida_evento
  for insert to authenticated with check (false);
create policy contas_ciclo_vida_evento_update_negado on public.contas_ciclo_vida_evento
  for update to authenticated using (false) with check (false);
create policy contas_ciclo_vida_evento_delete_negado on public.contas_ciclo_vida_evento
  for delete to authenticated using (false);

create policy contas_parametro_select_admin on public.contas_parametro
  for select to authenticated using ((select public.administracao_eh_admin()));
create policy contas_parametro_insert_negado on public.contas_parametro
  for insert to authenticated with check (false);
create policy contas_parametro_update_negado on public.contas_parametro
  for update to authenticated using (false) with check (false);
create policy contas_parametro_delete_negado on public.contas_parametro
  for delete to authenticated using (false);

-- Histórico só de inserção (vale para service_role e donos).
create trigger contas_ciclo_vida_evento_imutavel before update or delete on public.contas_ciclo_vida_evento
  for each row execute function public.administracao_registro_imutavel();

create function public.contas_parametro_proteger() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'parâmetro não é apagado' using errcode = '42501';
  end if;
  if new.chave <> old.chave or new.minimo <> old.minimo or new.maximo <> old.maximo then
    raise exception 'chave e faixa do parâmetro são imutáveis' using errcode = '42501';
  end if;
  new.atualizado_em := now();
  return new;
end $$;
revoke all on function public.contas_parametro_proteger() from public, anon, authenticated;
create trigger contas_parametro_proteger before update or delete on public.contas_parametro
  for each row execute function public.contas_parametro_proteger();

-- Funções de apoio -------------------------------------------------------------------------------------------------
-- Conta com acesso permitido: tudo menos suspensa e anonimizada (em carência de encerramento a pessoa ainda entra,
-- para poder desistir).
create function public.contas_acesso_permitido(p_conta uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_conta is not null and not exists (
    select 1 from public.contas_ciclo_vida c
    where c.conta_id = p_conta and c.situacao in ('suspensa', 'anonimizada'));
$$;
revoke all on function public.contas_acesso_permitido(uuid) from public, anon, authenticated;

-- Conta que pode publicar perfis e itens: só a ativa (em carência de encerramento nada se republica).
create function public.contas_pode_publicar(p_conta uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_conta is not null and not exists (
    select 1 from public.contas_ciclo_vida c
    where c.conta_id = p_conta and c.situacao <> 'ativa');
$$;
revoke all on function public.contas_pode_publicar(uuid) from public, anon, authenticated;

-- Acesso da conta logada (para políticas restritivas). Sem argumento: não consulta conta alheia.
create function public.contas_acesso_ativo() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.contas_acesso_permitido((select auth.uid()));
$$;
revoke all on function public.contas_acesso_ativo() from public, anon;
grant execute on function public.contas_acesso_ativo() to authenticated;

-- Flag consultável pelo proxy e pela interface: a situação da PRÓPRIA conta. Funciona também para conta suspensa
-- (não depende de RLS). Anônimo: zero linhas.
create function public.contas_meu_estado()
returns table (o_situacao text, o_acesso_permitido boolean, o_encerramento_executar_apos timestamptz)
language sql stable security definer set search_path = '' as $$
  select coalesce(c.situacao, 'ativa'),
         coalesce(c.situacao, 'ativa') not in ('suspensa', 'anonimizada'),
         c.encerramento_executar_apos
  from (select (select auth.uid()) as id) u
  left join public.contas_ciclo_vida c on c.conta_id = u.id
  where u.id is not null;
$$;
revoke all on function public.contas_meu_estado() from public, anon;
grant execute on function public.contas_meu_estado() to authenticated;

create function public.contas_parametro_valor(p_chave text) returns integer
language sql stable security definer set search_path = '' as $$
  select valor from public.contas_parametro where chave = p_chave;
$$;
revoke all on function public.contas_parametro_valor(text) from public, anon, authenticated;

-- Parâmetro: administrador geral, motivo obrigatório, auditoria com valor anterior e novo.
-- Erros: 42501 não administrador; 22023 motivo/valor inválido ou fora da faixa; P0002 parâmetro inexistente.
create function public.contas_definir_parametro(p_chave text, p_valor integer, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := public.administracao_exigir_admin();
  v_motivo text := nullif(left(btrim(coalesce(p_motivo, '')), 500), '');
  v_anterior integer;
  v_min integer;
  v_max integer;
begin
  if v_motivo is null then
    raise exception 'motivo obrigatório' using errcode = '22023';
  end if;
  if p_valor is null then
    raise exception 'valor obrigatório' using errcode = '22023';
  end if;
  select pa.valor, pa.minimo, pa.maximo into v_anterior, v_min, v_max
  from public.contas_parametro pa where pa.chave = p_chave for update;
  if not found then
    raise exception 'parâmetro não encontrado' using errcode = 'P0002';
  end if;
  if p_valor < v_min or p_valor > v_max then
    raise exception 'valor fora da faixa permitida (% a %)', v_min, v_max using errcode = '22023';
  end if;
  update public.contas_parametro set valor = p_valor where chave = p_chave;
  insert into public.administracao_auditoria (autor_id, acao, alvo_tabela, alvo_id, motivo, valor_anterior, valor_novo)
  values (v_admin, 'definir_parametro_contas', 'contas_parametro', p_chave, v_motivo,
          jsonb_build_object('valor', v_anterior), jsonb_build_object('valor', p_valor));
end $$;
revoke all on function public.contas_definir_parametro(text, integer, text) from public, anon;
grant execute on function public.contas_definir_parametro(text, integer, text) to authenticated;

-- Efeitos sobre as regras existentes --------------------------------------------------------------------------------
-- Gatilho: perfil/item só fica publicado se a conta pode publicar (suspensa, em carência ou anonimizada: não).
create function public.contas_bloquear_publicacao() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_dono uuid := coalesce(to_jsonb(new) ->> 'responsavel_id', to_jsonb(new) ->> 'conta_id')::uuid;
begin
  if not public.contas_pode_publicar(v_dono) then
    raise exception 'esta conta não pode publicar no momento' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function public.contas_bloquear_publicacao() from public, anon, authenticated;
create trigger perfis_perfil_bloquear_publicacao before insert or update on public.perfis_perfil
  for each row when (new.publicado) execute function public.contas_bloquear_publicacao();
create trigger catalogo_item_bloquear_publicacao before insert or update on public.catalogo_item
  for each row when (new.publicado) execute function public.contas_bloquear_publicacao();

-- IM-079: perfil de conta que não pode publicar não está disponível (contato, indicação, pontos, benefícios).
create or replace function public.perfis_perfil_disponivel(p_perfil_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.perfis_perfil p
    join public.perfis_perfil_versao v on v.id = p.versao_aprovada_id and v.situacao = 'aprovada'
    where p.id = p_perfil_id and p.publicado and public.contas_pode_publicar(p.responsavel_id)
  );
$$;
-- (CREATE OR REPLACE preserva os privilégios: anon e authenticated seguem podendo executar.)

-- IM-009 + IM-080: só indica quem tem WhatsApp e acesso permitido.
create or replace function public.contas_pode_indicar() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.contas_conta
    where id = (select auth.uid()) and whatsapp_e164 is not null
      and public.contas_acesso_permitido(id)
  );
$$;
revoke all on function public.contas_pode_indicar() from public, anon;
grant execute on function public.contas_pode_indicar() to authenticated;

-- IM-080: pedido feito pelo link de indicador suspenso ou anonimizado segue SEM atribuição (não pontua, não entra na
-- base). O visitante não é prejudicado e o contato é registrado normalmente.
create function public.contas_pedido_sem_atribuicao_se_suspenso() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.link_id is not null and exists (
    select 1
    from public.indicacoes_link l
    join public.contas_ciclo_vida c on c.conta_id = l.indicador_id
    where l.id = new.link_id and c.situacao in ('suspensa', 'anonimizada')
  ) then
    new.link_id := null;
  end if;
  return new;
end $$;
revoke all on function public.contas_pedido_sem_atribuicao_se_suspenso() from public, anon, authenticated;
create trigger contas_pedido_sem_atribuicao before insert on public.indicacoes_pedido_contato
  for each row execute function public.contas_pedido_sem_atribuicao_se_suspenso();

-- Conta sem acesso (suspensa/anonimizada) não grava pelas tabelas que o cliente escreve direto. Restritivas: somam-se às
-- políticas existentes. As RPCs SECURITY DEFINER checam o acesso por conta própria.
do $$
declare
  r record;
  v_cond constant text := '(select public.contas_acesso_ativo())';
begin
  for r in select * from (values
      ('contas_conta', 'update'),
      ('perfis_perfil', 'update'),
      ('perfis_perfil_versao', 'insert'), ('perfis_perfil_versao', 'update'), ('perfis_perfil_versao', 'delete'),
      ('perfis_perfil_versao_contato', 'insert'), ('perfis_perfil_versao_contato', 'update'), ('perfis_perfil_versao_contato', 'delete'),
      ('catalogo_item', 'update'),
      ('catalogo_item_versao', 'insert'), ('catalogo_item_versao', 'update'), ('catalogo_item_versao', 'delete'),
      ('catalogo_categoria_solicitacao', 'insert')
    ) as t (tabela, op)
  loop
    execute format('create policy %I on public.%I as restrictive for %s to authenticated %s',
      r.tabela || '_' || r.op || '_acesso_ativo', r.tabela, r.op,
      case r.op
        when 'insert' then 'with check (' || v_cond || ')'
        when 'update' then 'using (' || v_cond || ') with check (' || v_cond || ')'
        else 'using (' || v_cond || ')'
      end);
  end loop;
end $$;
