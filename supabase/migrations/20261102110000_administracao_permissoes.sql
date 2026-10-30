-- Fase 6 · módulo administracao · permissões granulares · IM-077, IM-086, D-014
--
-- MODELO
--   * Administrador geral = linha em administracao_administrador (só service_role/SQL manual). Tem TODAS as permissões.
--   * Permissões específicas (concedidas e revogadas só pelo administrador geral, com motivo e auditoria):
--       aprovar, gerir_categorias, analisar_denuncias, invalidar_indicacoes, reverter_pontos, suspender.
--   * Conta suspensa ou anonimizada perde todas as permissões (contas_acesso_permitido).
--
-- COMO AS RPCs EXIGEM A PERMISSÃO ESPECÍFICA
--   * administracao_exigir_admin() segue exigindo ADMINISTRADOR GERAL (RPCs sem permissão específica no IM-077: patrocinador,
--     parâmetros, alertas de notificação, concessão de permissões).
--   * administracao_exigir_permissao('<permissão>') é o guarda novo: passa quem tem a permissão (o administrador geral tem todas).
--     As RPCs listadas abaixo foram RECRIADAS (CREATE OR REPLACE) com o corpo idêntico ao da última definição; só o guarda mudou.
--   * Delegação interna: uma RPC já autorizada (ex.: invalidar indicação) pode chamar outra rotina existente (ex.: reverter
--     crédito) marcando `indicamais.permissao_delegada` na transação; só funções do banco fazem isso (o cliente da API não
--     consegue definir configuração de sessão).
--   * Conta suspensa ou anonimizada não passa em nenhum dos dois guardas.
--
-- VISÕES E POLÍTICAS: as visões administrativas passam a filtrar por administracao_permitido('<permissão>') em vez de
-- administrador geral; as políticas de leitura das tabelas de revisão ganham uma política ADICIONAL para quem tem a permissão
-- (as políticas originais do administrador geral não foram alteradas).

-- Tabela -----------------------------------------------------------------------------------------------------------
create table public.administracao_permissao (
  conta_id uuid not null references public.contas_conta (id) on delete restrict,
  permissao text not null,
  concedida_por uuid not null references public.contas_conta (id) on delete restrict,
  motivo text not null,
  criado_em timestamptz not null default now(),
  primary key (conta_id, permissao),
  constraint administracao_permissao_valida check (permissao in (
    'aprovar', 'gerir_categorias', 'analisar_denuncias', 'invalidar_indicacoes', 'reverter_pontos', 'suspender')),
  constraint administracao_permissao_motivo check (char_length(btrim(motivo)) between 1 and 500)
);
comment on table public.administracao_permissao is 'Permissões específicas por conta (IM-077). Escrita só por administracao_conceder_permissao/revogar_permissao (auditadas).';

revoke all on public.administracao_permissao from anon, authenticated;
alter table public.administracao_permissao enable row level security;
alter table public.administracao_permissao force row level security;

create policy administracao_permissao_select_admin on public.administracao_permissao
  for select to authenticated using ((select public.administracao_eh_admin()));
create policy administracao_permissao_insert_negado on public.administracao_permissao
  for insert to authenticated with check (false);
create policy administracao_permissao_update_negado on public.administracao_permissao
  for update to authenticated using (false) with check (false);
create policy administracao_permissao_delete_negado on public.administracao_permissao
  for delete to authenticated using (false);

-- Funções de apoio -------------------------------------------------------------------------------------------------
-- A conta tem a permissão? Administrador geral tem todas. Conta sem acesso (suspensa/anonimizada) não tem nenhuma.
create function public.administracao_tem_permissao(p_conta uuid, p_permissao text) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_conta is not null
    and public.contas_acesso_permitido(p_conta)
    and (
      exists (select 1 from public.administracao_administrador a where a.conta_id = p_conta)
      or exists (select 1 from public.administracao_permissao x where x.conta_id = p_conta and x.permissao = p_permissao)
    );
$$;
revoke all on function public.administracao_tem_permissao(uuid, text) from public, anon, authenticated;

-- A conta logada tem a permissão? (políticas e visões)
create function public.administracao_permitido(p_permissao text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.administracao_tem_permissao((select auth.uid()), p_permissao);
$$;
revoke all on function public.administracao_permitido(text) from public, anon;
grant execute on function public.administracao_permitido(text) to authenticated;

-- A conta logada tem ALGUMA das permissões?
create function public.administracao_permitido_algum(p_permissoes text[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from unnest(p_permissoes) as x (permissao)
    where public.administracao_tem_permissao((select auth.uid()), x.permissao));
$$;
revoke all on function public.administracao_permitido_algum(text[]) from public, anon;
grant execute on function public.administracao_permitido_algum(text[]) to authenticated;

-- Guarda das RPCs que exigem ADMINISTRADOR GERAL (mesma assinatura e retorno da versão original; agora também recusa conta suspensa).
create or replace function public.administracao_exigir_admin() returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null or not public.contas_acesso_permitido(v_uid)
     or not exists (select 1 from public.administracao_administrador where conta_id = v_uid) then
    raise exception 'acesso restrito a administradores' using errcode = '42501';
  end if;
  return v_uid;
end $$;
revoke all on function public.administracao_exigir_admin() from public, anon, authenticated;

-- Guarda das RPCs que exigem uma permissão específica. Devolve o id da conta autora ou recusa (42501).
create function public.administracao_exigir_permissao(p_permissao text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_deleg text := coalesce(current_setting('indicamais.permissao_delegada', true), '');
begin
  if p_permissao is null or p_permissao not in ('aprovar', 'gerir_categorias', 'analisar_denuncias', 'invalidar_indicacoes', 'reverter_pontos', 'suspender') then
    raise exception 'permissão desconhecida' using errcode = '22023';
  end if;
  if v_uid is null or not public.contas_acesso_permitido(v_uid) then
    raise exception 'acesso restrito a administradores' using errcode = '42501';
  end if;
  if v_deleg <> p_permissao and not public.administracao_tem_permissao(v_uid, p_permissao) then
    raise exception 'acesso restrito a administradores' using errcode = '42501';
  end if;
  return v_uid;
end $$;
revoke all on function public.administracao_exigir_permissao(text) from public, anon, authenticated;

-- Conceder e revogar (somente o administrador geral) ----------------------------------------------------------------
-- Erros: 42501 não é administrador geral / conceder a si mesmo; 22023 permissão ou motivo inválido; P0002 conta inexistente;
-- P0001 conta já é administradora geral / conta anonimizada.
-- Idempotente: conceder o que a conta já tem não muda nada e não grava auditoria nova.
create function public.administracao_conceder_permissao(p_conta uuid, p_permissao text, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := public.administracao_exigir_admin();
  v_motivo text := nullif(left(btrim(coalesce(p_motivo, '')), 500), '');
begin
  if v_motivo is null then
    raise exception 'motivo obrigatório' using errcode = '22023';
  end if;
  if p_permissao is null or p_permissao not in ('aprovar', 'gerir_categorias', 'analisar_denuncias', 'invalidar_indicacoes', 'reverter_pontos', 'suspender') then
    raise exception 'permissão inválida' using errcode = '22023';
  end if;
  if p_conta is null or not exists (select 1 from public.contas_conta where id = p_conta) then
    raise exception 'conta não encontrada' using errcode = 'P0002';
  end if;
  if p_conta = v_admin then
    raise exception 'o administrador geral já tem todas as permissões' using errcode = '42501';
  end if;
  if exists (select 1 from public.administracao_administrador where conta_id = p_conta) then
    raise exception 'a conta já é administradora geral' using errcode = 'P0001';
  end if;
  if not public.contas_acesso_permitido(p_conta) then
    raise exception 'a conta não está ativa' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.administracao_permissao where conta_id = p_conta and permissao = p_permissao) then
    return;
  end if;
  insert into public.administracao_permissao (conta_id, permissao, concedida_por, motivo)
  values (p_conta, p_permissao, v_admin, v_motivo);
  insert into public.administracao_auditoria (autor_id, acao, alvo_tabela, alvo_id, motivo, valor_anterior, valor_novo)
  values (v_admin, 'conceder_permissao', 'administracao_permissao', p_conta::text || ':' || p_permissao, v_motivo,
          jsonb_build_object('tem_permissao', false),
          jsonb_build_object('tem_permissao', true, 'permissao', p_permissao));
end $$;

create function public.administracao_revogar_permissao(p_conta uuid, p_permissao text, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := public.administracao_exigir_admin();
  v_motivo text := nullif(left(btrim(coalesce(p_motivo, '')), 500), '');
  v_desde timestamptz;
begin
  if v_motivo is null then
    raise exception 'motivo obrigatório' using errcode = '22023';
  end if;
  if p_permissao is null or p_permissao not in ('aprovar', 'gerir_categorias', 'analisar_denuncias', 'invalidar_indicacoes', 'reverter_pontos', 'suspender') then
    raise exception 'permissão inválida' using errcode = '22023';
  end if;
  delete from public.administracao_permissao
  where conta_id = p_conta and permissao = p_permissao
  returning criado_em into v_desde;
  if not found then
    raise exception 'permissão não encontrada' using errcode = 'P0002';
  end if;
  insert into public.administracao_auditoria (autor_id, acao, alvo_tabela, alvo_id, motivo, valor_anterior, valor_novo)
  values (v_admin, 'revogar_permissao', 'administracao_permissao', p_conta::text || ':' || p_permissao, v_motivo,
          jsonb_build_object('tem_permissao', true, 'permissao', p_permissao, 'concedida_em', v_desde),
          jsonb_build_object('tem_permissao', false));
end $$;

revoke all on function public.administracao_conceder_permissao(uuid, text, text) from public, anon;
revoke all on function public.administracao_revogar_permissao(uuid, text, text) from public, anon;
grant execute on function public.administracao_conceder_permissao(uuid, text, text) to authenticated;
grant execute on function public.administracao_revogar_permissao(uuid, text, text) to authenticated;

-- Visões -----------------------------------------------------------------------------------------------------------
-- As permissões da própria conta (o administrador geral aparece com as seis). Sem id de conta.
create view public.administracao_minhas_permissoes as
select p.permissao, p.criado_em
from public.administracao_permissao p
where p.conta_id = (select auth.uid()) and (select public.contas_acesso_ativo())
union all
select x.permissao, a.criado_em
from public.administracao_administrador a
cross join (values ('aprovar'), ('gerir_categorias'), ('analisar_denuncias'), ('invalidar_indicacoes'), ('reverter_pontos'), ('suspender'))
  as x (permissao)
where a.conta_id = (select auth.uid()) and (select public.contas_acesso_ativo());
revoke all on public.administracao_minhas_permissoes from anon, authenticated;
grant select on public.administracao_minhas_permissoes to authenticated;

-- Quem tem o quê (só o administrador geral). concedida_por_ref é opaco.
create view public.administracao_permissoes_concedidas as
select p.conta_id,
       p.permissao,
       encode(sha256(convert_to('indicamais:admin:' || p.concedida_por::text, 'UTF8')), 'hex') as concedida_por_ref,
       p.criado_em
from public.administracao_permissao p
where (select public.administracao_eh_admin());
revoke all on public.administracao_permissoes_concedidas from anon, authenticated;
grant select on public.administracao_permissoes_concedidas to authenticated;

-- RPCs existentes recriadas com o guarda da permissão específica ----------------------------------------------------------------
-- Sem permissão específica na lista do IM-077, seguem só para o administrador geral (decisão do gestor, ver relatório):
-- pontos_definir_parametro, indicacoes_tratar_alerta, indicacoes_definir_parametro, patrocinador, parâmetros e concessão de permissões.

-- perfis_decidir_versao (definição de 20261027100000_administracao_auditoria_decisoes_revisao.sql; só muda o guarda: permissão 'aprovar')
create or replace function public.perfis_decidir_versao(p_versao_id uuid, p_aprovar boolean, p_motivo text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := public.administracao_exigir_permissao('aprovar');
  v_perfil uuid;
  v_dono uuid;
  v_sit text;
  v_anterior uuid;
  v_motivo text;
begin
  select v.perfil_id, p.responsavel_id, v.situacao, p.versao_aprovada_id
    into v_perfil, v_dono, v_sit, v_anterior
  from public.perfis_perfil_versao v join public.perfis_perfil p on p.id = v.perfil_id
  where v.id = p_versao_id
  for update of v, p;
  if not found then
    raise exception 'versão não encontrada' using errcode = 'P0002';
  end if;
  if v_dono = v_admin then
    raise exception 'o responsável não decide o próprio conteúdo' using errcode = '42501';
  end if;
  if v_sit <> 'pendente' then
    raise exception 'só versão pendente pode ser decidida' using errcode = 'P0001';
  end if;
  if not p_aprovar and (p_motivo is null or btrim(p_motivo) = '') then
    raise exception 'motivo obrigatório na rejeição' using errcode = '22023';
  end if;
  v_motivo := nullif(left(btrim(coalesce(p_motivo, '')), 500), '');
  insert into public.perfis_revisao (perfil_id, versao_id, decisao, motivo, autor_id, versao_aprovada_anterior_id)
  values (v_perfil, p_versao_id, case when p_aprovar then 'aprovada' else 'rejeitada' end,
          v_motivo, v_admin, v_anterior);
  update public.perfis_perfil_versao
     set situacao = case when p_aprovar then 'aprovada' else 'rejeitada' end
   where id = p_versao_id;
  if p_aprovar then
    update public.perfis_perfil set versao_aprovada_id = p_versao_id where id = v_perfil;
  end if;
  insert into public.administracao_auditoria (autor_id, acao, alvo_tabela, alvo_id, motivo, valor_anterior, valor_novo)
  values (v_admin,
          case when p_aprovar then 'aprovar_versao' else 'rejeitar_versao' end,
          'perfis_perfil_versao', p_versao_id::text, v_motivo,
          jsonb_build_object('situacao', v_sit, 'perfil_id', v_perfil, 'versao_aprovada_anterior_id', v_anterior),
          jsonb_build_object('situacao', case when p_aprovar then 'aprovada' else 'rejeitada' end,
                             'perfil_id', v_perfil,
                             'versao_aprovada_id', case when p_aprovar then p_versao_id else v_anterior end));
end $$;

-- catalogo_decidir_item_versao (definição de 20261029110000_catalogo_aprovar_particular_exige_localizacao.sql; só muda o guarda: permissão 'aprovar')
create or replace function public.catalogo_decidir_item_versao(p_versao_id uuid, p_aprovar boolean, p_motivo text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := public.administracao_exigir_permissao('aprovar');
  v_item uuid;
  v_dono uuid;
  v_sit text;
  v_anterior uuid;
  v_motivo text;
  v_perfil uuid;
  v_cidade text;
  v_uf text;
begin
  select v.item_id, i.conta_id, v.situacao, i.versao_aprovada_id, i.perfil_id, v.cidade, v.uf
    into v_item, v_dono, v_sit, v_anterior, v_perfil, v_cidade, v_uf
  from public.catalogo_item_versao v join public.catalogo_item i on i.id = v.item_id
  where v.id = p_versao_id
  for update of v, i;
  if not found then
    raise exception 'versão não encontrada' using errcode = 'P0002';
  end if;
  if v_dono = v_admin then
    raise exception 'o responsável não decide o próprio conteúdo' using errcode = '42501';
  end if;
  if v_sit <> 'pendente' then
    raise exception 'só versão pendente pode ser decidida' using errcode = 'P0001';
  end if;
  if not p_aprovar and (p_motivo is null or btrim(p_motivo) = '') then
    raise exception 'motivo obrigatório na rejeição' using errcode = '22023';
  end if;
  -- D-008: anúncio particular (sem perfil) não é aprovado sem cidade e UF (IM-015, IM-019). Rejeitar segue permitido.
  if p_aprovar and v_perfil is null
     and (v_cidade is null or btrim(v_cidade) = '' or v_uf is null or btrim(v_uf) = '') then
    raise exception 'anúncio particular exige cidade e UF para ser aprovado' using errcode = '23514';
  end if;
  v_motivo := nullif(left(btrim(coalesce(p_motivo, '')), 500), '');
  insert into public.catalogo_item_revisao (item_id, versao_id, decisao, motivo, autor_id, versao_aprovada_anterior_id)
  values (v_item, p_versao_id, case when p_aprovar then 'aprovada' else 'rejeitada' end,
          v_motivo, v_admin, v_anterior);
  update public.catalogo_item_versao
     set situacao = case when p_aprovar then 'aprovada' else 'rejeitada' end
   where id = p_versao_id;
  if p_aprovar then
    update public.catalogo_item set versao_aprovada_id = p_versao_id where id = v_item;
  end if;
  insert into public.administracao_auditoria (autor_id, acao, alvo_tabela, alvo_id, motivo, valor_anterior, valor_novo)
  values (v_admin,
          case when p_aprovar then 'aprovar_versao' else 'rejeitar_versao' end,
          'catalogo_item_versao', p_versao_id::text, v_motivo,
          jsonb_build_object('situacao', v_sit, 'item_id', v_item, 'versao_aprovada_anterior_id', v_anterior),
          jsonb_build_object('situacao', case when p_aprovar then 'aprovada' else 'rejeitada' end,
                             'item_id', v_item,
                             'versao_aprovada_id', case when p_aprovar then p_versao_id else v_anterior end));
end $$;

-- pontos_decidir_beneficio_versao (definição de 20261031120000_pontos_beneficios.sql; só muda o guarda: permissão 'aprovar')
create or replace function public.pontos_decidir_beneficio_versao(p_versao_id uuid, p_aprovar boolean, p_motivo text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := public.administracao_exigir_permissao('aprovar');
  v_ben uuid;
  v_dono uuid;
  v_sit text;
  v_anterior uuid;
  v_motivo text;
begin
  if p_aprovar is null then
    raise exception 'informe aprovar ou rejeitar' using errcode = '22023';
  end if;
  select v.beneficio_id, p.responsavel_id, v.situacao, b.versao_aprovada_id
    into v_ben, v_dono, v_sit, v_anterior
  from public.pontos_beneficio_versao v
  join public.pontos_beneficio b on b.id = v.beneficio_id
  join public.perfis_perfil p on p.id = b.perfil_id
  where v.id = p_versao_id
  for update of v, b;
  if not found then
    raise exception 'versão não encontrada' using errcode = 'P0002';
  end if;
  if v_dono = v_admin then
    raise exception 'o responsável não decide o próprio conteúdo' using errcode = '42501';
  end if;
  if v_sit <> 'pendente' then
    raise exception 'só versão pendente pode ser decidida' using errcode = 'P0001';
  end if;
  if not p_aprovar and (p_motivo is null or btrim(p_motivo) = '') then
    raise exception 'motivo obrigatório na rejeição' using errcode = '22023';
  end if;
  v_motivo := nullif(left(btrim(coalesce(p_motivo, '')), 500), '');
  insert into public.pontos_beneficio_revisao (beneficio_id, versao_id, decisao, motivo, autor_id, versao_aprovada_anterior_id)
  values (v_ben, p_versao_id, case when p_aprovar then 'aprovada' else 'rejeitada' end, v_motivo, v_admin, v_anterior);
  update public.pontos_beneficio_versao
     set situacao = case when p_aprovar then 'aprovada' else 'rejeitada' end
   where id = p_versao_id;
  if p_aprovar then
    update public.pontos_beneficio set versao_aprovada_id = p_versao_id where id = v_ben;
  end if;
  insert into public.administracao_auditoria (autor_id, acao, alvo_tabela, alvo_id, motivo, valor_anterior, valor_novo)
  values (v_admin,
          case when p_aprovar then 'aprovar_beneficio' else 'rejeitar_beneficio' end,
          'pontos_beneficio_versao', p_versao_id::text, v_motivo,
          jsonb_build_object('situacao', v_sit, 'beneficio_id', v_ben, 'versao_aprovada_anterior_id', v_anterior),
          jsonb_build_object('situacao', case when p_aprovar then 'aprovada' else 'rejeitada' end,
                             'beneficio_id', v_ben,
                             'versao_aprovada_id', case when p_aprovar then p_versao_id else v_anterior end));
end $$;

-- pontos_admin_cadastrar_beneficio (definição de 20261031130000_pontos_reversao_categoria_beneficio_aceite.sql; só muda o guarda: permissão 'aprovar')
create or replace function public.pontos_admin_cadastrar_beneficio(
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
  v_admin uuid := public.administracao_exigir_permissao('aprovar');
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

-- pontos_admin_editar_proposta_beneficio (definição de 20261031130000_pontos_reversao_categoria_beneficio_aceite.sql; só muda o guarda: permissão 'aprovar')
create or replace function public.pontos_admin_editar_proposta_beneficio(
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
  v_admin uuid := public.administracao_exigir_permissao('aprovar');
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

-- pontos_admin_definir_beneficio_ativo (definição de 20261031120000_pontos_beneficios.sql; só muda o guarda: permissão 'aprovar')
create or replace function public.pontos_admin_definir_beneficio_ativo(p_beneficio_id uuid, p_ativo boolean, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := public.administracao_exigir_permissao('aprovar');
  v_motivo text := nullif(left(btrim(coalesce(p_motivo, '')), 500), '');
  v_aprovada uuid;
  v_antes boolean;
begin
  if v_motivo is null then
    raise exception 'motivo obrigatório' using errcode = '22023';
  end if;
  if p_ativo is null then
    raise exception 'informe ativo ou inativo' using errcode = '22023';
  end if;
  select b.versao_aprovada_id, b.ativo into v_aprovada, v_antes
  from public.pontos_beneficio b where b.id = p_beneficio_id for update;
  if not found then
    raise exception 'benefício não encontrado' using errcode = 'P0002';
  end if;
  if p_ativo and v_aprovada is null then
    raise exception 'só benefício aprovado pode ser ativado' using errcode = 'P0001';
  end if;
  update public.pontos_beneficio set ativo = p_ativo where id = p_beneficio_id;
  insert into public.administracao_auditoria (autor_id, acao, alvo_tabela, alvo_id, motivo, valor_anterior, valor_novo)
  values (v_admin, 'definir_beneficio_ativo', 'pontos_beneficio', p_beneficio_id::text, v_motivo,
          jsonb_build_object('ativo', v_antes), jsonb_build_object('ativo', p_ativo));
end $$;

-- catalogo_criar_categoria (definição de 20261024110000_catalogo_categorias.sql; só muda o guarda: permissão 'gerir_categorias')
create or replace function public.catalogo_criar_categoria(p_nome text, p_slug text, p_ordem integer default 0)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_autor uuid := public.administracao_exigir_permissao('gerir_categorias');
  v_id uuid;
begin
  insert into public.catalogo_categoria (nome, slug, ordem)
  values (btrim(p_nome), p_slug, coalesce(p_ordem, 0))
  returning id into v_id;
  insert into public.administracao_auditoria (autor_id, acao, alvo_tabela, alvo_id, valor_novo)
  select v_autor, 'categoria_criada', 'catalogo_categoria', v_id::text, to_jsonb(c)
  from public.catalogo_categoria c where c.id = v_id;
  return v_id;
end $$;

-- catalogo_alterar_categoria (definição de 20261024110000_catalogo_categorias.sql; só muda o guarda: permissão 'gerir_categorias')
create or replace function public.catalogo_alterar_categoria(p_id uuid, p_nome text, p_ativa boolean, p_ordem integer, p_motivo text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_autor uuid := public.administracao_exigir_permissao('gerir_categorias');
  v_antes public.catalogo_categoria;
begin
  if p_motivo is null or btrim(p_motivo) = '' then
    raise exception 'motivo obrigatório' using errcode = '22023';
  end if;
  select * into v_antes from public.catalogo_categoria where id = p_id for update;
  if not found then
    raise exception 'categoria não encontrada' using errcode = 'P0002';
  end if;
  update public.catalogo_categoria
     set nome = btrim(p_nome), ativa = p_ativa, ordem = p_ordem
   where id = p_id;
  insert into public.administracao_auditoria (autor_id, acao, alvo_tabela, alvo_id, motivo, valor_anterior, valor_novo)
  select v_autor, 'categoria_alterada', 'catalogo_categoria', p_id::text, left(btrim(p_motivo), 500),
         to_jsonb(v_antes), to_jsonb(c)
  from public.catalogo_categoria c where c.id = p_id;
end $$;

-- catalogo_decidir_solicitacao (definição de 20261024110000_catalogo_categorias.sql; só muda o guarda: permissão 'gerir_categorias')
create or replace function public.catalogo_decidir_solicitacao(p_id uuid, p_atendida boolean, p_motivo text, p_categoria_id uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_autor uuid := public.administracao_exigir_permissao('gerir_categorias');
  v_antes public.catalogo_categoria_solicitacao;
begin
  select * into v_antes from public.catalogo_categoria_solicitacao where id = p_id for update;
  if not found then
    raise exception 'pedido não encontrado' using errcode = 'P0002';
  end if;
  if v_antes.situacao <> 'pendente' then
    raise exception 'pedido já decidido' using errcode = 'P0001';
  end if;
  if p_atendida then
    if p_categoria_id is null then
      raise exception 'informe a categoria criada para atender o pedido' using errcode = '22023';
    end if;
    update public.catalogo_categoria_solicitacao
       set situacao = 'atendida', categoria_id = p_categoria_id, motivo_resposta = nullif(btrim(p_motivo), ''),
           decidida_por = v_autor, decidida_em = now()
     where id = p_id;
  else
    if p_motivo is null or btrim(p_motivo) = '' then
      raise exception 'motivo obrigatório para recusar' using errcode = '22023';
    end if;
    update public.catalogo_categoria_solicitacao
       set situacao = 'recusada', motivo_resposta = left(btrim(p_motivo), 500),
           decidida_por = v_autor, decidida_em = now()
     where id = p_id;
  end if;
  insert into public.administracao_auditoria (autor_id, acao, alvo_tabela, alvo_id, motivo, valor_anterior, valor_novo)
  select v_autor, case when p_atendida then 'solicitacao_atendida' else 'solicitacao_recusada' end,
         'catalogo_categoria_solicitacao', p_id::text, nullif(left(btrim(coalesce(p_motivo, '')), 500), ''),
         to_jsonb(v_antes), to_jsonb(s)
  from public.catalogo_categoria_solicitacao s where s.id = p_id;
end $$;

-- pontos_reverter_credito (definição de 20261031130000_pontos_reversao_categoria_beneficio_aceite.sql; só muda o guarda: permissão 'reverter_pontos')
create or replace function public.pontos_reverter_credito(
  p_lancamento_id uuid,
  p_categoria text,
  p_motivo text,
  p_confirmar_saldo_negativo boolean default false
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := public.administracao_exigir_permissao('reverter_pontos');
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

-- pontos_reprocessar_pedido (definição de 20261031110000_pontos_reversao_leitura.sql; só muda o guarda: permissão 'reverter_pontos')
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

-- Visões administrativas: filtro pela permissão específica -----------------------------------------------------------
-- Mesmas colunas das versões anteriores (CREATE OR REPLACE). Filtro avaliado uma vez por consulta.
create or replace view public.administracao_fila_pendencias as
select 'perfil'::text as alvo_tipo, v.id as versao_id, v.perfil_id as alvo_id, v.nome, v.enviada_em,
       p.responsavel_id as dono_id, (p.versao_aprovada_id is not null) as eh_edicao
from public.perfis_perfil_versao v join public.perfis_perfil p on p.id = v.perfil_id
where v.situacao = 'pendente' and (select public.administracao_permitido('aprovar'))
union all
select 'item'::text, v.id, v.item_id, v.nome, v.enviada_em, i.conta_id, (i.versao_aprovada_id is not null)
from public.catalogo_item_versao v join public.catalogo_item i on i.id = v.item_id
where v.situacao = 'pendente' and (select public.administracao_permitido('aprovar'));

create or replace view public.administracao_consulta_negocios as
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
where (select public.administracao_permitido('aprovar'))
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
where (select public.administracao_permitido('aprovar'));

-- As filas de benefícios eram security_invoker (dependiam da política do administrador geral nas tabelas). Passam a visão
-- com os direitos do dono e filtro fixo pela permissão (mesmo padrão das demais filas).
alter view public.administracao_fila_beneficios set (security_invoker = false);
create or replace view public.administracao_fila_beneficios as
select v.id as versao_id, v.beneficio_id, b.perfil_id, v.nome, v.enviada_em,
       (b.versao_aprovada_id is not null) as eh_edicao
from public.pontos_beneficio_versao v
join public.pontos_beneficio b on b.id = v.beneficio_id
where v.situacao = 'pendente' and v.origem = 'responsavel' and (select public.administracao_permitido('aprovar'));

alter view public.administracao_beneficios_aguardando_aceite set (security_invoker = false);
create or replace view public.administracao_beneficios_aguardando_aceite as
select v.id as versao_id, v.beneficio_id, b.perfil_id, v.nome, v.enviada_em
from public.pontos_beneficio_versao v
join public.pontos_beneficio b on b.id = v.beneficio_id
where v.situacao = 'aguardando_aceite' and (select public.administracao_permitido('aprovar'));

-- Pontos: quem reverte pontos (e quem invalida indicações, que precisa achar o pedido e o crédito) lê lançamentos e decisões.
create or replace view public.administracao_pontos_lancamentos as
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
where (select public.administracao_permitido_algum(array['reverter_pontos', 'invalidar_indicacoes']));

create or replace view public.administracao_pontos_saldos as
select encode(sha256(convert_to('indicamais:indicador:' || l.indicador_id::text, 'UTF8')), 'hex') as indicador_ref,
       sum(l.pontos)::integer as saldo,
       coalesce(sum(l.pontos) filter (where l.tipo = 'credito'), 0)::integer as total_creditado,
       coalesce(sum(l.pontos) filter (where l.tipo = 'reversao'), 0)::integer as total_revertido,
       max(l.criado_em) as ultimo_lancamento_em
from public.pontos_lancamento l
where (select public.administracao_permitido('reverter_pontos'))
group by l.indicador_id;

create or replace view public.administracao_pontos_decisoes as
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
where (select public.administracao_permitido_algum(array['reverter_pontos', 'invalidar_indicacoes']));

create or replace view public.administracao_pontos_falhas as
select f.pedido_id,
       count(*)::integer as falhas,
       max(f.criado_em) as ultima_falha_em,
       (array_agg(f.erro order by f.criado_em desc))[1] as ultimo_erro,
       not exists (select 1 from public.pontos_decisao d where d.pedido_id = f.pedido_id) as pendente
from public.pontos_falha f
where (select public.administracao_permitido('reverter_pontos'))
group by f.pedido_id;

-- Políticas ADICIONAIS de leitura para quem tem a permissão de aprovar (a tela de revisão lê o conteúdo e as imagens) ------
create policy perfis_perfil_select_aprovador on public.perfis_perfil
  for select to authenticated using ((select public.administracao_permitido('aprovar')));
create policy perfis_versao_select_aprovador on public.perfis_perfil_versao
  for select to authenticated using ((select public.administracao_permitido('aprovar')));
create policy perfis_contato_select_aprovador on public.perfis_perfil_versao_contato
  for select to authenticated using ((select public.administracao_permitido('aprovar')));
create policy perfis_revisao_select_aprovador on public.perfis_revisao
  for select to authenticated using ((select public.administracao_permitido('aprovar')));
create policy catalogo_item_select_aprovador on public.catalogo_item
  for select to authenticated using ((select public.administracao_permitido('aprovar')));
create policy catalogo_item_versao_select_aprovador on public.catalogo_item_versao
  for select to authenticated using ((select public.administracao_permitido('aprovar')));
create policy catalogo_item_revisao_select_aprovador on public.catalogo_item_revisao
  for select to authenticated using ((select public.administracao_permitido('aprovar')));
create policy pontos_beneficio_select_aprovador on public.pontos_beneficio
  for select to authenticated using ((select public.administracao_permitido('aprovar')));
create policy pontos_beneficio_versao_select_aprovador on public.pontos_beneficio_versao
  for select to authenticated using ((select public.administracao_permitido('aprovar')));
create policy pontos_beneficio_revisao_select_aprovador on public.pontos_beneficio_revisao
  for select to authenticated using ((select public.administracao_permitido('aprovar')));
create policy catalogo_imagens_select_aprovador on storage.objects
  for select to authenticated
  using (bucket_id = 'indicamais-imagens' and (select public.administracao_permitido('aprovar')));
-- Categorias (inclusive inativas) e pedidos de categoria para quem gere categorias.
create policy catalogo_categoria_select_gestor on public.catalogo_categoria
  for select to authenticated using ((select public.administracao_permitido('gerir_categorias')));
create policy catalogo_solicitacao_select_gestor on public.catalogo_categoria_solicitacao
  for select to authenticated using ((select public.administracao_permitido('gerir_categorias')));
