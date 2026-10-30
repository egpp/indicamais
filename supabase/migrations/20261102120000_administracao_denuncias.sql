-- Fase 6 · módulo administracao · denúncias · IM-076, IM-077, IM-086, IM-029, D-014
--
-- DESENHO
--   administracao_denuncia            a denúncia: alvo (perfil, item, conta, pedido ou indicação), tipo (autoindicacao,
--                                     spam_fraude, uso_indevido_dados, conteudo_inadequado), texto livre curto (até 500) e
--                                     situação (aberta, em_analise, procedente, improcedente). Denunciante anônimo ou logado:
--                                     denunciante_id (conta, quando logado) e denunciante_chave (hash opaco). Nenhum papel de
--                                     API tem privilégio de tabela: o denunciante NUNCA é exposto ao denunciado nem a quem não
--                                     tem a permissão analisar_denuncias (IM-077). Mesmo quem analisa vê só a chave opaca.
--   administracao_denuncia_decisao    histórico de cada mudança de situação (motivo, autor, data). Só inserção.
--   administracao_denuncia_tentativa  registro de cada tentativa de denunciar (chave opaca + hora) para o limite por pessoa,
--                                     inclusive contra alvo inexistente (impede sondar quais alvos existem).
--   administracao_parametro           limites antispam (padrões abaixo). Alterados só por administracao_definir_parametro().
--
-- REGRAS
--   * administracao_denunciar() é pública (anon e authenticated) e SEMPRE responde igual quando aceita: não confirma se o
--     alvo existe, se já havia denúncia igual nem se um limite do alvo foi atingido (esses casos são descartados em silêncio).
--     Só o limite POR PESSOA e o limite GLOBAL respondem P0429 (mensagem neutra). Campo-armadilha p_site: se vier preenchido,
--     responde como aceita e não grava nada.
--   * Deduplicação: uma denúncia por (denunciante, alvo). Denunciante anônimo é identificado por p_origem (hash opaco que o
--     SERVIDOR deve calcular, ex.: sha256 de IP + agente); sem p_origem, todo anônimo cai no mesmo balde (mais restritivo).
--     Captcha (Turnstile) entra depois, na borda (D-014): a origem passada por cliente não é confiável sozinha.
--   * NENHUMA suspensão ou ação automática. Decisão "procedente" apenas registra; quem tem a permissão suspender age à parte.
--   * Decidir exige a permissão analisar_denuncias, motivo e grava auditoria na mesma transação; ninguém decide denúncia sobre
--     o próprio conteúdo.
--
-- CÓDIGOS DE ERRO: 22023 pedido inválido (formato); P0429 limite atingido; 42501 sem permissão / conta sem acesso / conflito;
-- P0002 denúncia inexistente (administração); P0001 transição de situação inválida.

-- Parâmetros ---------------------------------------------------------------------------------------------------------
create table public.administracao_parametro (
  chave text primary key,
  valor integer not null,
  minimo integer not null,
  maximo integer not null,
  descricao text not null,
  atualizado_em timestamptz not null default now(),
  constraint administracao_parametro_chave check (char_length(chave) between 1 and 80),
  constraint administracao_parametro_faixa check (minimo <= maximo and valor between minimo and maximo)
);
comment on table public.administracao_parametro is 'Parâmetros do módulo administracao (limites antispam das denúncias). Alterados só por administracao_definir_parametro() (auditado).';
insert into public.administracao_parametro (chave, valor, minimo, maximo, descricao) values
  ('denuncia_janela_horas', 1, 1, 168, 'Janela dos limites por pessoa e global de tentativas de denúncia.'),
  ('denuncia_limite_por_pessoa', 5, 1, 100, 'Máximo de tentativas de denúncia por pessoa (conta ou origem) dentro da janela; excedido: P0429.'),
  ('denuncia_limite_global', 500, 10, 100000, 'Máximo de tentativas de denúncia de todos dentro da janela; excedido: P0429.'),
  ('denuncia_limite_por_alvo_dia', 30, 1, 1000, 'Máximo de denúncias gravadas contra o mesmo alvo em 24 horas; as seguintes são descartadas em silêncio.');

-- Denúncias -------------------------------------------------------------------------------------------------------------
create table public.administracao_denuncia (
  id uuid primary key default gen_random_uuid(),
  alvo_tipo text not null,
  alvo_id uuid not null,
  tipo text not null,
  texto text,
  situacao text not null default 'aberta',
  denunciante_id uuid references public.contas_conta (id) on delete restrict,
  denunciante_chave text not null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint administracao_denuncia_alvo_tipo check (alvo_tipo in ('perfil', 'item', 'conta', 'pedido', 'indicacao')),
  constraint administracao_denuncia_tipo check (tipo in ('autoindicacao', 'spam_fraude', 'uso_indevido_dados', 'conteudo_inadequado')),
  constraint administracao_denuncia_texto check (
    texto is null or (char_length(texto) between 1 and 500 and texto !~ '[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]')),
  constraint administracao_denuncia_situacao check (situacao in ('aberta', 'em_analise', 'procedente', 'improcedente')),
  constraint administracao_denuncia_chave check (denunciante_chave ~ '^[0-9a-f]{64}$'),
  -- Deduplicação: uma denúncia por denunciante e alvo.
  constraint administracao_denuncia_unica unique (denunciante_chave, alvo_tipo, alvo_id)
);
create index administracao_denuncia_alvo_idx on public.administracao_denuncia (alvo_tipo, alvo_id, criado_em desc);
create index administracao_denuncia_fila_idx on public.administracao_denuncia (criado_em) where situacao in ('aberta', 'em_analise');
comment on table public.administracao_denuncia is 'Denúncias (IM-076). Sem privilégio de tabela para papel de API; o denunciante nunca é exposto ao denunciado.';

create table public.administracao_denuncia_decisao (
  id bigint generated always as identity primary key,
  denuncia_id uuid not null references public.administracao_denuncia (id) on delete restrict,
  de_situacao text not null,
  para_situacao text not null,
  motivo text not null,
  autor_id uuid not null references public.contas_conta (id) on delete restrict,
  criado_em timestamptz not null default now(),
  constraint administracao_denuncia_decisao_de check (de_situacao in ('aberta', 'em_analise')),
  constraint administracao_denuncia_decisao_para check (para_situacao in ('em_analise', 'procedente', 'improcedente')),
  constraint administracao_denuncia_decisao_motivo check (char_length(btrim(motivo)) between 1 and 500)
);
create index administracao_denuncia_decisao_idx on public.administracao_denuncia_decisao (denuncia_id, criado_em);
comment on table public.administracao_denuncia_decisao is 'Histórico das decisões sobre denúncias (autor, motivo, data). Só inserção.';

create table public.administracao_denuncia_tentativa (
  id bigint generated always as identity primary key,
  chave text not null,
  criado_em timestamptz not null default now(),
  constraint administracao_denuncia_tentativa_chave check (chave ~ '^[0-9a-f]{64}$')
);
create index administracao_denuncia_tentativa_chave_idx on public.administracao_denuncia_tentativa (chave, criado_em desc);
create index administracao_denuncia_tentativa_tempo_idx on public.administracao_denuncia_tentativa (criado_em desc);
comment on table public.administracao_denuncia_tentativa is 'Tentativas de denunciar (limite por pessoa e global). Operacional: sem dado pessoal; a limpeza periódica é feita pelo servidor.';

-- Privilégios e RLS -----------------------------------------------------------------------------------------------------
revoke all on public.administracao_parametro from anon, authenticated;
revoke all on public.administracao_denuncia from anon, authenticated;
revoke all on public.administracao_denuncia_decisao from anon, authenticated;
revoke all on public.administracao_denuncia_tentativa from anon, authenticated;

alter table public.administracao_parametro enable row level security;
alter table public.administracao_parametro force row level security;
alter table public.administracao_denuncia enable row level security;
alter table public.administracao_denuncia force row level security;
alter table public.administracao_denuncia_decisao enable row level security;
alter table public.administracao_denuncia_decisao force row level security;
alter table public.administracao_denuncia_tentativa enable row level security;
alter table public.administracao_denuncia_tentativa force row level security;

create policy administracao_parametro_select_admin on public.administracao_parametro
  for select to authenticated using ((select public.administracao_eh_admin()));
create policy administracao_parametro_insert_negado on public.administracao_parametro
  for insert to authenticated with check (false);
create policy administracao_parametro_update_negado on public.administracao_parametro
  for update to authenticated using (false) with check (false);
create policy administracao_parametro_delete_negado on public.administracao_parametro
  for delete to authenticated using (false);

-- Só quem analisa denúncias lê; a escrita é só das funções do banco.
create policy administracao_denuncia_select_analista on public.administracao_denuncia
  for select to authenticated using ((select public.administracao_permitido('analisar_denuncias')));
create policy administracao_denuncia_insert_negado on public.administracao_denuncia
  for insert to authenticated with check (false);
create policy administracao_denuncia_update_negado on public.administracao_denuncia
  for update to authenticated using (false) with check (false);
create policy administracao_denuncia_delete_negado on public.administracao_denuncia
  for delete to authenticated using (false);

create policy administracao_denuncia_decisao_select_analista on public.administracao_denuncia_decisao
  for select to authenticated using ((select public.administracao_permitido('analisar_denuncias')));
create policy administracao_denuncia_decisao_insert_negado on public.administracao_denuncia_decisao
  for insert to authenticated with check (false);
create policy administracao_denuncia_decisao_update_negado on public.administracao_denuncia_decisao
  for update to authenticated using (false) with check (false);
create policy administracao_denuncia_decisao_delete_negado on public.administracao_denuncia_decisao
  for delete to authenticated using (false);

create policy administracao_denuncia_tentativa_select_admin on public.administracao_denuncia_tentativa
  for select to authenticated using ((select public.administracao_eh_admin()));
create policy administracao_denuncia_tentativa_insert_negado on public.administracao_denuncia_tentativa
  for insert to authenticated with check (false);
create policy administracao_denuncia_tentativa_update_negado on public.administracao_denuncia_tentativa
  for update to authenticated using (false) with check (false);
create policy administracao_denuncia_tentativa_delete_negado on public.administracao_denuncia_tentativa
  for delete to authenticated using (false);

-- Gatilhos -----------------------------------------------------------------------------------------------------------------
create trigger administracao_denuncia_decisao_imutavel before update or delete on public.administracao_denuncia_decisao
  for each row execute function public.administracao_registro_imutavel();

create function public.administracao_parametro_proteger() returns trigger
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
revoke all on function public.administracao_parametro_proteger() from public, anon, authenticated;
create trigger administracao_parametro_proteger before update or delete on public.administracao_parametro
  for each row execute function public.administracao_parametro_proteger();

-- A denúncia nunca é apagada; só a situação muda, e só nas transições permitidas.
create function public.administracao_denuncia_proteger() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'denúncia não é apagada' using errcode = '42501';
  end if;
  if (to_jsonb(new) - 'situacao' - 'atualizado_em') is distinct from (to_jsonb(old) - 'situacao' - 'atualizado_em') then
    raise exception 'os dados da denúncia são imutáveis' using errcode = '42501';
  end if;
  if new.situacao <> old.situacao and not (
       (old.situacao = 'aberta' and new.situacao in ('em_analise', 'procedente', 'improcedente'))
    or (old.situacao = 'em_analise' and new.situacao in ('procedente', 'improcedente'))) then
    raise exception 'transição de situação inválida: % -> %', old.situacao, new.situacao using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function public.administracao_denuncia_proteger() from public, anon, authenticated;
create trigger administracao_denuncia_proteger before update or delete on public.administracao_denuncia
  for each row execute function public.administracao_denuncia_proteger();

-- Funções internas ---------------------------------------------------------------------------------------------------------
create function public.administracao_parametro_valor(p_chave text) returns integer
language sql stable security definer set search_path = '' as $$
  select valor from public.administracao_parametro where chave = p_chave;
$$;
revoke all on function public.administracao_parametro_valor(text) from public, anon, authenticated;

-- Dono do conteúdo denunciado (conflito de interesse na decisão). Pedido não tem dono único aqui: devolve nulo.
create function public.administracao_denuncia_dono(p_alvo_tipo text, p_alvo_id uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select case p_alvo_tipo
    when 'perfil' then (select p.responsavel_id from public.perfis_perfil p where p.id = p_alvo_id)
    when 'item' then (select i.conta_id from public.catalogo_item i where i.id = p_alvo_id)
    when 'conta' then (select c.id from public.contas_conta c where c.id = p_alvo_id)
    when 'indicacao' then (select l.indicador_id from public.indicacoes_link l where l.id = p_alvo_id)
    else null
  end;
$$;
revoke all on function public.administracao_denuncia_dono(text, uuid) from public, anon, authenticated;

-- Parâmetro: administrador geral, motivo obrigatório, auditoria com valor anterior e novo.
create function public.administracao_definir_parametro(p_chave text, p_valor integer, p_motivo text) returns void
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
  from public.administracao_parametro pa where pa.chave = p_chave for update;
  if not found then
    raise exception 'parâmetro não encontrado' using errcode = 'P0002';
  end if;
  if p_valor < v_min or p_valor > v_max then
    raise exception 'valor fora da faixa permitida (% a %)', v_min, v_max using errcode = '22023';
  end if;
  update public.administracao_parametro set valor = p_valor where chave = p_chave;
  insert into public.administracao_auditoria (autor_id, acao, alvo_tabela, alvo_id, motivo, valor_anterior, valor_novo)
  values (v_admin, 'definir_parametro_administracao', 'administracao_parametro', p_chave, v_motivo,
          jsonb_build_object('valor', v_anterior), jsonb_build_object('valor', p_valor));
end $$;
revoke all on function public.administracao_definir_parametro(text, integer, text) from public, anon;
grant execute on function public.administracao_definir_parametro(text, integer, text) to authenticated;

-- Denunciar (pública) ----------------------------------------------------------------------------------------------------------
create function public.administracao_denunciar(
  p_alvo_tipo text,
  p_alvo_id uuid,
  p_tipo text,
  p_texto text default null,
  p_origem text default null,
  p_site text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_texto text := nullif(btrim(coalesce(p_texto, '')), '');
  v_chave text;
  v_janela integer;
  v_existe boolean;
begin
  -- Campo-armadilha: preenchido só por robô. Responde como aceita e não grava nada.
  if nullif(btrim(coalesce(p_site, '')), '') is not null then
    return;
  end if;
  if v_uid is not null and not public.contas_acesso_permitido(v_uid) then
    raise exception 'acesso restrito' using errcode = '42501';
  end if;
  if p_alvo_id is null
     or p_alvo_tipo is null or p_alvo_tipo not in ('perfil', 'item', 'conta', 'pedido', 'indicacao')
     or p_tipo is null or p_tipo not in ('autoindicacao', 'spam_fraude', 'uso_indevido_dados', 'conteudo_inadequado')
     or (v_texto is not null and (char_length(v_texto) > 500 or v_texto ~ '[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]'))
     or (p_origem is not null and p_origem !~ '^[0-9a-f]{64}$') then
    raise exception 'denúncia inválida' using errcode = '22023';
  end if;

  v_chave := encode(sha256(convert_to(
    case when v_uid is not null then 'indicamais:denunciante:c:' || v_uid::text
         else 'indicamais:denunciante:o:' || coalesce(p_origem, 'sem-origem') end, 'UTF8')), 'hex');
  perform pg_advisory_xact_lock(hashtextextended('denuncia:' || v_chave, 0));

  -- Limites por pessoa e global: valem para qualquer alvo, existente ou não.
  v_janela := public.administracao_parametro_valor('denuncia_janela_horas');
  if (select count(*) from public.administracao_denuncia_tentativa t
      where t.chave = v_chave and t.criado_em > now() - make_interval(hours => v_janela))
     >= public.administracao_parametro_valor('denuncia_limite_por_pessoa')
     or (select count(*) from public.administracao_denuncia_tentativa t
      where t.criado_em > now() - make_interval(hours => v_janela))
     >= public.administracao_parametro_valor('denuncia_limite_global') then
    raise exception 'limite de denúncias atingido: tente novamente mais tarde' using errcode = 'P0429';
  end if;
  insert into public.administracao_denuncia_tentativa (chave) values (v_chave);

  -- A partir daqui, tudo que não vira denúncia é descartado em silêncio (resposta idêntica).
  v_existe := case p_alvo_tipo
    when 'perfil' then exists (select 1 from public.perfis_perfil x where x.id = p_alvo_id)
    when 'item' then exists (select 1 from public.catalogo_item x where x.id = p_alvo_id)
    when 'conta' then exists (select 1 from public.contas_conta x where x.id = p_alvo_id)
    when 'pedido' then exists (select 1 from public.indicacoes_pedido_contato x where x.id = p_alvo_id)
    when 'indicacao' then exists (select 1 from public.indicacoes_link x where x.id = p_alvo_id)
    else false
  end;
  if not v_existe then
    return;
  end if;
  if (select count(*) from public.administracao_denuncia d
      where d.alvo_tipo = p_alvo_tipo and d.alvo_id = p_alvo_id and d.criado_em > now() - interval '24 hours')
     >= public.administracao_parametro_valor('denuncia_limite_por_alvo_dia') then
    return;
  end if;
  insert into public.administracao_denuncia (alvo_tipo, alvo_id, tipo, texto, denunciante_id, denunciante_chave)
  values (p_alvo_tipo, p_alvo_id, p_tipo, v_texto, v_uid, v_chave)
  on conflict (denunciante_chave, alvo_tipo, alvo_id) do nothing;
end $$;
revoke all on function public.administracao_denunciar(text, uuid, text, text, text, text) from public;
grant execute on function public.administracao_denunciar(text, uuid, text, text, text, text) to anon, authenticated;

-- Decidir (permissão analisar_denuncias) ---------------------------------------------------------------------------------------
-- p_decisao: em_analise (assume a análise), procedente ou improcedente. Motivo obrigatório. NÃO executa nada além do registro.
create function public.administracao_decidir_denuncia(p_denuncia_id uuid, p_decisao text, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := public.administracao_exigir_permissao('analisar_denuncias');
  v_motivo text := nullif(left(btrim(coalesce(p_motivo, '')), 500), '');
  d public.administracao_denuncia%rowtype;
begin
  if v_motivo is null then
    raise exception 'motivo obrigatório' using errcode = '22023';
  end if;
  if p_decisao is null or p_decisao not in ('em_analise', 'procedente', 'improcedente') then
    raise exception 'decisão inválida' using errcode = '22023';
  end if;
  select * into d from public.administracao_denuncia where id = p_denuncia_id for update;
  if not found then
    raise exception 'denúncia não encontrada' using errcode = 'P0002';
  end if;
  if public.administracao_denuncia_dono(d.alvo_tipo, d.alvo_id) = v_admin then
    raise exception 'não é possível decidir denúncia sobre o próprio conteúdo' using errcode = '42501';
  end if;
  if d.situacao in ('procedente', 'improcedente') then
    raise exception 'denúncia já decidida' using errcode = 'P0001';
  end if;
  if d.situacao = 'em_analise' and p_decisao = 'em_analise' then
    raise exception 'denúncia já está em análise' using errcode = 'P0001';
  end if;
  update public.administracao_denuncia set situacao = p_decisao, atualizado_em = now() where id = d.id;
  insert into public.administracao_denuncia_decisao (denuncia_id, de_situacao, para_situacao, motivo, autor_id)
  values (d.id, d.situacao, p_decisao, v_motivo, v_admin);
  insert into public.administracao_auditoria (autor_id, acao, alvo_tabela, alvo_id, motivo, valor_anterior, valor_novo)
  values (v_admin, 'decidir_denuncia', 'administracao_denuncia', d.id::text, v_motivo,
          jsonb_build_object('situacao', d.situacao),
          jsonb_build_object('situacao', p_decisao, 'alvo_tipo', d.alvo_tipo, 'alvo_id', d.alvo_id, 'tipo', d.tipo));
end $$;
revoke all on function public.administracao_decidir_denuncia(uuid, text, text) from public, anon;
grant execute on function public.administracao_decidir_denuncia(uuid, text, text) to authenticated;

-- Visões (só quem tem a permissão analisar_denuncias) -----------------------------------------------------------------------------
-- A fila não traz id de conta nem dado de contato: o denunciante aparece só como tipo (anonimo ou conta) e chave opaca,
-- suficiente para agrupar denúncias repetidas da mesma origem.
create view public.administracao_fila_denuncias as
select d.id,
       d.alvo_tipo,
       d.alvo_id,
       d.tipo,
       d.texto,
       d.situacao,
       case when d.denunciante_id is null then 'anonimo' else 'conta' end as denunciante_tipo,
       d.denunciante_chave as denunciante_ref,
       (select count(*)::integer from public.administracao_denuncia x
         where x.alvo_tipo = d.alvo_tipo and x.alvo_id = d.alvo_id) as total_no_alvo,
       case d.alvo_tipo
         when 'perfil' then (select v.nome from public.perfis_perfil_versao v
                              where v.perfil_id = d.alvo_id order by v.criado_em desc, v.id desc limit 1)
         when 'item' then (select v.nome from public.catalogo_item_versao v
                            where v.item_id = d.alvo_id order by v.criado_em desc, v.id desc limit 1)
         else null
       end as alvo_nome,
       d.criado_em,
       d.atualizado_em
from public.administracao_denuncia d
where (select public.administracao_permitido('analisar_denuncias'));
revoke all on public.administracao_fila_denuncias from anon, authenticated;
grant select on public.administracao_fila_denuncias to authenticated;

create view public.administracao_denuncia_decisoes as
select x.denuncia_id,
       x.de_situacao,
       x.para_situacao,
       x.motivo,
       encode(sha256(convert_to('indicamais:admin:' || x.autor_id::text, 'UTF8')), 'hex') as autor_ref,
       x.criado_em
from public.administracao_denuncia_decisao x
where (select public.administracao_permitido('analisar_denuncias'));
revoke all on public.administracao_denuncia_decisoes from anon, authenticated;
grant select on public.administracao_denuncia_decisoes to authenticated;
