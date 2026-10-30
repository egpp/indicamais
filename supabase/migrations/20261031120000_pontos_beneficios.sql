-- Fase 4 · módulo pontos · cadastro de benefícios · IM-036, IM-077, IM-079, IM-086 (IM-037 e IM-038 são FUTUROS:
-- NÃO existe resgate, cupom, sorteio nem prêmio aqui; benefício é só um cadastro com versões e revisão).
--
-- Mesmo desenho de versões do catálogo (ver 20261024130000_catalogo_itens.sql):
--   pontos_beneficio          identidade, perfil, ativo (liga/desliga) e versao_aprovada_id (versão no ar)
--   pontos_beneficio_versao   conteúdo: rascunho -> pendente (proposto) -> aprovada | rejeitada; imutável depois de enviada
--   pontos_beneficio_revisao  decisão do administrador, só inserção
--
-- REGRAS
--   * O responsável do perfil propõe (cria, edita, envia, liga/desliga). Quem decide é o administrador, com motivo na
--     rejeição e auditoria; o dono nunca decide o próprio benefício.
--   * Editar benefício aprovado cria nova versão (rascunho -> pendente) e MANTÉM a aprovada no ar.
--   * O administrador também cadastra (IM-036 "Administrador gerencia"): pontos_admin_cadastrar_beneficio() cria o
--     benefício já aprovado, com motivo e auditoria; não vale para perfil do próprio administrador.
--   * IM-079: público só vê benefício ativo, com versão aprovada, de perfil DISPONÍVEL. Perfil despublicado ou sem versão
--     aprovada retira o benefício da vista pública sem apagar nada.
--   * Nenhuma tabela aqui tem conta_id/responsavel_id: o dono é resolvido por perfis_perfil via função definer.
--   * Todas as escritas são por RPC (nenhum privilégio de escrita para anon nem authenticated).
--
-- CÓDIGOS DE ERRO (SQLSTATE)
--   42501  não autenticado / benefício ou versão que não é do usuário / administrador decidindo o próprio
--   22023  motivo obrigatório
--   23514  campo fora das regras (pontos, limites, prazos, versão incompleta)
--   P0002  perfil indisponível ou benefício/versão inexistente
--   P0001  estado inválido (versão em análise, versão não é rascunho/pendente, sem versão aprovada para ativar)

create table public.pontos_beneficio (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references public.perfis_perfil (id) on delete restrict,
  ativo boolean not null default false,
  versao_aprovada_id uuid,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index pontos_beneficio_perfil_idx on public.pontos_beneficio (perfil_id);

create table public.pontos_beneficio_versao (
  id uuid primary key default gen_random_uuid(),
  beneficio_id uuid not null references public.pontos_beneficio (id) on delete restrict,
  situacao text not null default 'rascunho',
  nome text,
  descricao text,
  pontos_necessarios integer,
  condicoes text,
  limite_total integer,
  limite_por_pessoa integer,
  prazo_resgate_ate date,
  prazo_uso_ate date,
  criado_em timestamptz not null default now(),
  enviada_em timestamptz,
  constraint pontos_beneficio_versao_id_beneficio_unico unique (id, beneficio_id),
  constraint pontos_beneficio_versao_situacao check (situacao in ('rascunho', 'pendente', 'aprovada', 'rejeitada')),
  constraint pontos_beneficio_versao_enviada_coerente check ((situacao = 'rascunho') = (enviada_em is null)),
  constraint pontos_beneficio_versao_nome check (nome is null or char_length(btrim(nome)) between 1 and 100),
  constraint pontos_beneficio_versao_descricao check (descricao is null or char_length(btrim(descricao)) between 1 and 1500),
  constraint pontos_beneficio_versao_condicoes check (condicoes is null or char_length(btrim(condicoes)) between 1 and 1000),
  constraint pontos_beneficio_versao_pontos check (pontos_necessarios is null or pontos_necessarios between 1 and 1000000),
  constraint pontos_beneficio_versao_limites check (
    (limite_total is null or limite_total between 1 and 1000000)
    and (limite_por_pessoa is null or limite_por_pessoa between 1 and 1000000)
    and (limite_total is null or limite_por_pessoa is null or limite_por_pessoa <= limite_total)),
  -- prazo de resgate e prazo de uso são campos separados e opcionais; o uso não termina antes do resgate.
  constraint pontos_beneficio_versao_prazos check (
    prazo_resgate_ate is null or prazo_uso_ate is null or prazo_uso_ate >= prazo_resgate_ate),
  constraint pontos_beneficio_versao_completa check (
    situacao = 'rascunho' or (nome is not null and descricao is not null and pontos_necessarios is not null))
);
create unique index pontos_beneficio_versao_uma_aberta on public.pontos_beneficio_versao (beneficio_id) where situacao in ('rascunho', 'pendente');
create index pontos_beneficio_versao_pendentes_idx on public.pontos_beneficio_versao (enviada_em) where situacao = 'pendente';
create index pontos_beneficio_versao_beneficio_idx on public.pontos_beneficio_versao (beneficio_id, criado_em desc);

alter table public.pontos_beneficio
  add constraint pontos_beneficio_versao_aprovada_fk foreign key (versao_aprovada_id, id)
  references public.pontos_beneficio_versao (id, beneficio_id) on delete restrict;
alter table public.pontos_beneficio
  add constraint pontos_beneficio_ativo_exige_aprovada check (ativo = false or versao_aprovada_id is not null);

create table public.pontos_beneficio_revisao (
  id uuid primary key default gen_random_uuid(),
  beneficio_id uuid not null references public.pontos_beneficio (id) on delete restrict,
  versao_id uuid not null references public.pontos_beneficio_versao (id) on delete restrict,
  decisao text not null,
  motivo text,
  autor_id uuid not null references public.contas_conta (id) on delete restrict,
  decidida_em timestamptz not null default now(),
  versao_aprovada_anterior_id uuid references public.pontos_beneficio_versao (id) on delete restrict,
  constraint pontos_beneficio_revisao_versao_unica unique (versao_id),
  constraint pontos_beneficio_revisao_decisao check (decisao in ('aprovada', 'rejeitada')),
  constraint pontos_beneficio_revisao_motivo check (
    (motivo is null or char_length(motivo) <= 500)
    and (decisao = 'aprovada' or (motivo is not null and char_length(btrim(motivo)) > 0)))
);
create index pontos_beneficio_revisao_beneficio_idx on public.pontos_beneficio_revisao (beneficio_id, decidida_em desc);

-- Privilégios ----------------------------------------------------------------------------------------------------
revoke all on public.pontos_beneficio from anon, authenticated;
revoke all on public.pontos_beneficio_versao from anon, authenticated;
revoke all on public.pontos_beneficio_revisao from anon, authenticated;
-- Sem escrita para o cliente: tudo por RPC. Estas tabelas não têm coluna de conta nem de pessoa.
grant select on public.pontos_beneficio to anon, authenticated;
grant select on public.pontos_beneficio_versao to anon, authenticated;
-- autor_id (id real do administrador) fora do SELECT; a auditoria guarda o autor.
grant select (id, beneficio_id, versao_id, decisao, motivo, decidida_em, versao_aprovada_anterior_id)
  on public.pontos_beneficio_revisao to authenticated;

alter table public.pontos_beneficio enable row level security;
alter table public.pontos_beneficio force row level security;
alter table public.pontos_beneficio_versao enable row level security;
alter table public.pontos_beneficio_versao force row level security;
alter table public.pontos_beneficio_revisao enable row level security;
alter table public.pontos_beneficio_revisao force row level security;

create function public.pontos_eh_dono_beneficio(p_beneficio_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.pontos_beneficio b join public.perfis_perfil p on p.id = b.perfil_id
    where b.id = p_beneficio_id and p.responsavel_id = (select auth.uid()));
$$;
revoke all on function public.pontos_eh_dono_beneficio(uuid) from public, anon;
grant execute on function public.pontos_eh_dono_beneficio(uuid) to authenticated;

-- Políticas: pontos_beneficio --------------------------------------------------------------------------------------
create policy pontos_beneficio_select_publico on public.pontos_beneficio
  for select to anon, authenticated using (
    ativo and versao_aprovada_id is not null and public.perfis_perfil_disponivel(perfil_id));
create policy pontos_beneficio_select_proprio on public.pontos_beneficio
  for select to authenticated using ((select public.pontos_eh_dono_beneficio(id)));
create policy pontos_beneficio_select_admin on public.pontos_beneficio
  for select to authenticated using ((select public.administracao_eh_admin()));
create policy pontos_beneficio_insert_negado on public.pontos_beneficio
  for insert to authenticated with check (false);
create policy pontos_beneficio_update_negado on public.pontos_beneficio
  for update to authenticated using (false) with check (false);
create policy pontos_beneficio_delete_negado on public.pontos_beneficio
  for delete to authenticated using (false);

-- Políticas: pontos_beneficio_versao -------------------------------------------------------------------------------
create policy pontos_beneficio_versao_select_publica on public.pontos_beneficio_versao
  for select to anon, authenticated using (
    situacao = 'aprovada' and exists (
      select 1 from public.pontos_beneficio b
      where b.id = beneficio_id and b.versao_aprovada_id = pontos_beneficio_versao.id and b.ativo
        and public.perfis_perfil_disponivel(b.perfil_id)));
create policy pontos_beneficio_versao_select_propria on public.pontos_beneficio_versao
  for select to authenticated using ((select public.pontos_eh_dono_beneficio(beneficio_id)));
create policy pontos_beneficio_versao_select_admin on public.pontos_beneficio_versao
  for select to authenticated using ((select public.administracao_eh_admin()));
create policy pontos_beneficio_versao_insert_negado on public.pontos_beneficio_versao
  for insert to authenticated with check (false);
create policy pontos_beneficio_versao_update_negado on public.pontos_beneficio_versao
  for update to authenticated using (false) with check (false);
create policy pontos_beneficio_versao_delete_negado on public.pontos_beneficio_versao
  for delete to authenticated using (false);

-- Políticas: pontos_beneficio_revisao (o dono lê o resultado sem o autor) ------------------------------------------
create policy pontos_beneficio_revisao_select_propria on public.pontos_beneficio_revisao
  for select to authenticated using ((select public.pontos_eh_dono_beneficio(beneficio_id)));
create policy pontos_beneficio_revisao_select_admin on public.pontos_beneficio_revisao
  for select to authenticated using ((select public.administracao_eh_admin()));
create policy pontos_beneficio_revisao_insert_negado on public.pontos_beneficio_revisao
  for insert to authenticated with check (false);
create policy pontos_beneficio_revisao_update_negado on public.pontos_beneficio_revisao
  for update to authenticated using (false) with check (false);
create policy pontos_beneficio_revisao_delete_negado on public.pontos_beneficio_revisao
  for delete to authenticated using (false);

-- Gatilhos --------------------------------------------------------------------------------------------------------
create function public.pontos_beneficio_proteger() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.id <> old.id or new.perfil_id <> old.perfil_id or new.criado_em <> old.criado_em then
    raise exception 'perfil do benefício é imutável' using errcode = '42501';
  end if;
  new.atualizado_em := now();
  return new;
end $$;
revoke all on function public.pontos_beneficio_proteger() from public, anon, authenticated;
create trigger pontos_beneficio_proteger before update on public.pontos_beneficio
  for each row execute function public.pontos_beneficio_proteger();

create trigger pontos_beneficio_versao_proteger before update or delete on public.pontos_beneficio_versao
  for each row execute function public.catalogo_versao_proteger('beneficio_id');

create trigger pontos_beneficio_revisao_imutavel before update or delete on public.pontos_beneficio_revisao
  for each row execute function public.administracao_registro_imutavel();

-- Funções do responsável -------------------------------------------------------------------------------------------
-- Cria o benefício e a 1ª versão (rascunho). O perfil precisa ser do usuário e estar disponível (publicado e aprovado).
create function public.pontos_criar_beneficio(
  p_perfil_id uuid,
  p_nome text,
  p_descricao text,
  p_pontos_necessarios integer,
  p_condicoes text default null,
  p_limite_total integer default null,
  p_limite_por_pessoa integer default null,
  p_prazo_resgate_ate date default null,
  p_prazo_uso_ate date default null
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
    (beneficio_id, nome, descricao, pontos_necessarios, condicoes, limite_total, limite_por_pessoa, prazo_resgate_ate, prazo_uso_ate)
  values (v_ben, p_nome, p_descricao, p_pontos_necessarios, p_condicoes, p_limite_total, p_limite_por_pessoa,
          p_prazo_resgate_ate, p_prazo_uso_ate)
  returning id into v_ver;
  o_beneficio_id := v_ben;
  o_versao_id := v_ver;
  return next;
end $$;

-- Salva o conteúdo: atualiza o rascunho aberto ou, se não houver versão aberta (ex.: edição de benefício aprovado),
-- cria uma nova versão em rascunho. A versão aprovada continua no ar. Versão em análise não muda.
create function public.pontos_salvar_beneficio(
  p_beneficio_id uuid,
  p_nome text,
  p_descricao text,
  p_pontos_necessarios integer,
  p_condicoes text default null,
  p_limite_total integer default null,
  p_limite_por_pessoa integer default null,
  p_prazo_resgate_ate date default null,
  p_prazo_uso_ate date default null
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
  where v.beneficio_id = p_beneficio_id and v.situacao in ('rascunho', 'pendente');
  if found and v_sit = 'pendente' then
    raise exception 'há uma versão em análise' using errcode = 'P0001';
  end if;
  if found then
    update public.pontos_beneficio_versao
       set nome = p_nome, descricao = p_descricao, pontos_necessarios = p_pontos_necessarios, condicoes = p_condicoes,
           limite_total = p_limite_total, limite_por_pessoa = p_limite_por_pessoa,
           prazo_resgate_ate = p_prazo_resgate_ate, prazo_uso_ate = p_prazo_uso_ate
     where id = v_ver;
  else
    insert into public.pontos_beneficio_versao
      (beneficio_id, nome, descricao, pontos_necessarios, condicoes, limite_total, limite_por_pessoa, prazo_resgate_ate, prazo_uso_ate)
    values (p_beneficio_id, p_nome, p_descricao, p_pontos_necessarios, p_condicoes, p_limite_total, p_limite_por_pessoa,
            p_prazo_resgate_ate, p_prazo_uso_ate)
    returning id into v_ver;
  end if;
  return v_ver;
end $$;

create function public.pontos_enviar_beneficio_versao(p_versao_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_sit text;
begin
  if v_uid is null then
    raise exception 'não autenticado' using errcode = '42501';
  end if;
  select v.situacao into v_sit
  from public.pontos_beneficio_versao v
  join public.pontos_beneficio b on b.id = v.beneficio_id
  join public.perfis_perfil p on p.id = b.perfil_id
  where v.id = p_versao_id and p.responsavel_id = v_uid
  for update of v;
  if not found then
    raise exception 'versão não encontrada' using errcode = '42501';
  end if;
  if v_sit <> 'rascunho' then
    raise exception 'só rascunho pode ser enviado' using errcode = 'P0001';
  end if;
  update public.pontos_beneficio_versao set situacao = 'pendente', enviada_em = now() where id = p_versao_id;
end $$;

-- Liga/desliga pelo responsável. Ligar exige versão aprovada.
create function public.pontos_definir_beneficio_ativo(p_beneficio_id uuid, p_ativo boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_aprovada uuid;
begin
  if v_uid is null then
    raise exception 'não autenticado' using errcode = '42501';
  end if;
  if p_ativo is null then
    raise exception 'informe ativo ou inativo' using errcode = '22023';
  end if;
  select b.versao_aprovada_id into v_aprovada
  from public.pontos_beneficio b join public.perfis_perfil p on p.id = b.perfil_id
  where b.id = p_beneficio_id and p.responsavel_id = v_uid for update of b;
  if not found then
    raise exception 'benefício não encontrado' using errcode = '42501';
  end if;
  if p_ativo and v_aprovada is null then
    raise exception 'só benefício aprovado pode ser ativado' using errcode = 'P0001';
  end if;
  update public.pontos_beneficio set ativo = p_ativo where id = p_beneficio_id;
end $$;

-- Funções do administrador ---------------------------------------------------------------------------------------
-- Aprova ou rejeita uma versão pendente. O dono não decide o próprio. Rejeição exige motivo. Auditoria na mesma transação.
create function public.pontos_decidir_beneficio_versao(p_versao_id uuid, p_aprovar boolean, p_motivo text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := public.administracao_exigir_admin();
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

-- IM-036 "Administrador gerencia": cadastra benefício já aprovado e ativo para um perfil de OUTRA conta que esteja
-- disponível. Motivo obrigatório; revisão e auditoria gravadas na mesma transação.
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
  p_prazo_uso_ate date default null
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
    (beneficio_id, situacao, enviada_em, nome, descricao, pontos_necessarios, condicoes, limite_total, limite_por_pessoa,
     prazo_resgate_ate, prazo_uso_ate)
  values (v_ben, 'pendente', now(), p_nome, p_descricao, p_pontos_necessarios, p_condicoes, p_limite_total,
          p_limite_por_pessoa, p_prazo_resgate_ate, p_prazo_uso_ate)
  returning id into v_ver;
  insert into public.pontos_beneficio_revisao (beneficio_id, versao_id, decisao, motivo, autor_id)
  values (v_ben, v_ver, 'aprovada', v_motivo, v_admin);
  update public.pontos_beneficio_versao set situacao = 'aprovada' where id = v_ver;
  update public.pontos_beneficio set versao_aprovada_id = v_ver, ativo = true where id = v_ben;
  insert into public.administracao_auditoria (autor_id, acao, alvo_tabela, alvo_id, motivo, valor_anterior, valor_novo)
  values (v_admin, 'cadastrar_beneficio', 'pontos_beneficio', v_ben::text, v_motivo, null,
          jsonb_build_object('perfil_id', p_perfil_id, 'versao_id', v_ver, 'pontos_necessarios', p_pontos_necessarios,
                             'ativo', true));
  o_beneficio_id := v_ben;
  o_versao_id := v_ver;
  return next;
end $$;

-- Administrador liga/desliga qualquer benefício (motivo obrigatório; auditoria com o valor anterior).
create function public.pontos_admin_definir_beneficio_ativo(p_beneficio_id uuid, p_ativo boolean, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := public.administracao_exigir_admin();
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

revoke all on function public.pontos_criar_beneficio(uuid, text, text, integer, text, integer, integer, date, date) from public, anon;
revoke all on function public.pontos_salvar_beneficio(uuid, text, text, integer, text, integer, integer, date, date) from public, anon;
revoke all on function public.pontos_enviar_beneficio_versao(uuid) from public, anon;
revoke all on function public.pontos_definir_beneficio_ativo(uuid, boolean) from public, anon;
revoke all on function public.pontos_decidir_beneficio_versao(uuid, boolean, text) from public, anon;
revoke all on function public.pontos_admin_cadastrar_beneficio(uuid, text, text, integer, text, text, integer, integer, date, date) from public, anon;
revoke all on function public.pontos_admin_definir_beneficio_ativo(uuid, boolean, text) from public, anon;
grant execute on function public.pontos_criar_beneficio(uuid, text, text, integer, text, integer, integer, date, date) to authenticated;
grant execute on function public.pontos_salvar_beneficio(uuid, text, text, integer, text, integer, integer, date, date) to authenticated;
grant execute on function public.pontos_enviar_beneficio_versao(uuid) to authenticated;
grant execute on function public.pontos_definir_beneficio_ativo(uuid, boolean) to authenticated;
grant execute on function public.pontos_decidir_beneficio_versao(uuid, boolean, text) to authenticated;
grant execute on function public.pontos_admin_cadastrar_beneficio(uuid, text, text, integer, text, text, integer, integer, date, date) to authenticated;
grant execute on function public.pontos_admin_definir_beneficio_ativo(uuid, boolean, text) to authenticated;

-- Visões ---------------------------------------------------------------------------------------------------------
-- Pública: benefício ativo, aprovado, de perfil disponível. Sem conta nem dado privado. NÃO há ação de resgate (IM-037).
create view public.pontos_beneficio_publico with (security_invoker = true) as
select b.id, b.perfil_id, v.nome, v.descricao, v.pontos_necessarios, v.condicoes, v.limite_total,
       v.limite_por_pessoa, v.prazo_resgate_ate, v.prazo_uso_ate, b.criado_em
from public.pontos_beneficio b
join public.pontos_beneficio_versao v on v.id = b.versao_aprovada_id and v.situacao = 'aprovada'
where b.ativo and public.perfis_perfil_disponivel(b.perfil_id);
revoke all on public.pontos_beneficio_publico from anon, authenticated;
grant select on public.pontos_beneficio_publico to anon, authenticated;

-- Fila de benefícios pendentes do administrador (IM-036). Só devolve linhas para administradores.
create view public.administracao_fila_beneficios with (security_invoker = true) as
select v.id as versao_id, v.beneficio_id, b.perfil_id, v.nome, v.enviada_em,
       (b.versao_aprovada_id is not null) as eh_edicao
from public.pontos_beneficio_versao v
join public.pontos_beneficio b on b.id = v.beneficio_id
where v.situacao = 'pendente' and public.administracao_eh_admin();
revoke all on public.administracao_fila_beneficios from anon, authenticated;
grant select on public.administracao_fila_beneficios to authenticated;
