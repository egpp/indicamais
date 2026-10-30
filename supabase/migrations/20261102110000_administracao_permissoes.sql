-- Fase 6 · módulo administracao · permissões granulares · IM-077, IM-086, D-014
--
-- MODELO
--   * Administrador geral = linha em administracao_administrador (só service_role/SQL manual). Tem TODAS as permissões.
--   * Permissões específicas (concedidas e revogadas só pelo administrador geral, com motivo e auditoria):
--       aprovar, gerir_categorias, analisar_denuncias, invalidar_indicacoes, reverter_pontos, suspender.
--   * Conta suspensa ou anonimizada perde todas as permissões (contas_acesso_permitido).
--
-- COMO AS RPCs EXIGEM A PERMISSÃO ESPECÍFICA SEM REESCREVER CADA UMA
--   administracao_exigir_admin() (sem argumento, chamada por todas as RPCs administrativas existentes) agora lê a
--   configuração local da PRÓPRIA função chamadora, `indicamais.permissao_exigida`, definida com
--   ALTER FUNCTION ... SET (vale só durante a execução daquela função, nunca na sessão do cliente):
--       'geral'  (padrão se ausente: fail-closed) exige administrador geral;
--       outro valor da lista exige aquela permissão (o administrador geral passa).
--   Quem recria uma RPC com CREATE OR REPLACE perde a configuração e volta a exigir administrador geral (falha segura).
--   O pgTAP confere que TODA função que chama administracao_exigir_admin() tem a configuração.
--   Delegação interna: uma RPC já autorizada (ex.: invalidar indicação) pode chamar outra rotina existente (ex.: reverter
--   crédito) marcando `indicamais.permissao_delegada` na transação; só funções do banco fazem isso (o cliente da API não
--   consegue definir configuração de sessão).
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

-- Guarda das RPCs administrativas (mesma assinatura e mesmo retorno da versão original).
create or replace function public.administracao_exigir_admin() returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_perm text := coalesce(nullif(current_setting('indicamais.permissao_exigida', true), ''), 'geral');
  v_deleg text := coalesce(current_setting('indicamais.permissao_delegada', true), '');
  v_ok boolean;
begin
  if v_uid is null or not public.contas_acesso_permitido(v_uid) then
    raise exception 'acesso restrito a administradores' using errcode = '42501';
  end if;
  if v_perm = 'geral' then
    v_ok := exists (select 1 from public.administracao_administrador where conta_id = v_uid);
  elsif v_perm not in ('aprovar', 'gerir_categorias', 'analisar_denuncias', 'invalidar_indicacoes', 'reverter_pontos', 'suspender') then
    v_ok := false;
  elsif v_deleg = v_perm then
    v_ok := true;
  else
    v_ok := public.administracao_tem_permissao(v_uid, v_perm);
  end if;
  if not v_ok then
    raise exception 'acesso restrito a administradores' using errcode = '42501';
  end if;
  return v_uid;
end $$;
revoke all on function public.administracao_exigir_admin() from public, anon, authenticated;

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

-- Exigência da permissão específica nas RPCs existentes -------------------------------------------------------------
-- Aprovação e revisão de conteúdo e benefícios.
alter function public.perfis_decidir_versao(uuid, boolean, text) set indicamais.permissao_exigida = 'aprovar';
alter function public.catalogo_decidir_item_versao(uuid, boolean, text) set indicamais.permissao_exigida = 'aprovar';
alter function public.pontos_decidir_beneficio_versao(uuid, boolean, text) set indicamais.permissao_exigida = 'aprovar';
alter function public.pontos_admin_cadastrar_beneficio(uuid, text, text, integer, text, text, integer, integer, date, integer)
  set indicamais.permissao_exigida = 'aprovar';
alter function public.pontos_admin_editar_proposta_beneficio(uuid, text, text, integer, text, text, integer, integer, date, integer)
  set indicamais.permissao_exigida = 'aprovar';
alter function public.pontos_admin_definir_beneficio_ativo(uuid, boolean, text) set indicamais.permissao_exigida = 'aprovar';
-- Categorias.
alter function public.catalogo_criar_categoria(text, text, integer) set indicamais.permissao_exigida = 'gerir_categorias';
alter function public.catalogo_alterar_categoria(uuid, text, boolean, integer, text) set indicamais.permissao_exigida = 'gerir_categorias';
alter function public.catalogo_decidir_solicitacao(uuid, boolean, text, uuid) set indicamais.permissao_exigida = 'gerir_categorias';
-- Pontos.
alter function public.pontos_reverter_credito(uuid, text, text, boolean) set indicamais.permissao_exigida = 'reverter_pontos';
alter function public.pontos_reprocessar_pedido(uuid, text) set indicamais.permissao_exigida = 'reverter_pontos';
-- Sem permissão específica na lista do IM-077: seguem só para o administrador geral (decisão do gestor, ver relatório).
alter function public.pontos_definir_parametro(text, integer, text) set indicamais.permissao_exigida = 'geral';
alter function public.indicacoes_tratar_alerta(uuid, text) set indicamais.permissao_exigida = 'geral';
alter function public.indicacoes_definir_parametro(text, integer, text) set indicamais.permissao_exigida = 'geral';
alter function public.administracao_criar_patrocinador(text, text, uuid, text, integer, boolean, timestamptz, timestamptz, text, uuid)
  set indicamais.permissao_exigida = 'geral';
alter function public.administracao_alterar_patrocinador(uuid, text, text, uuid, text, integer, timestamptz, timestamptz, text)
  set indicamais.permissao_exigida = 'geral';
alter function public.administracao_definir_patrocinador_ativo(uuid, boolean, text) set indicamais.permissao_exigida = 'geral';
alter function public.contas_definir_parametro(text, integer, text) set indicamais.permissao_exigida = 'geral';
alter function public.administracao_conceder_permissao(uuid, text, text) set indicamais.permissao_exigida = 'geral';
alter function public.administracao_revogar_permissao(uuid, text, text) set indicamais.permissao_exigida = 'geral';

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
