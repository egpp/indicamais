-- Fase 3 · módulo indicacoes · modelo de dados · IM-024, IM-025, IM-026, IM-027, IM-028, IM-029, IM-041, IM-044 (só
-- registro), IM-050, IM-079, IM-086
--
-- DESENHO
--   indicacoes_parametro           parâmetros centrais (janela anti-repetição, limite de taxa). Só o administrador lê;
--                                  só indicacoes_definir_parametro() altera (com auditoria).
--   indicacoes_link                um link por (indicador, destino). Código opaco (32 hex aleatórios). Destino = perfil
--                                  OU item. O indicador é gravado, mas NINGUÉM lê indicador_id cru.
--   indicacoes_pedido_contato      pedido de contato do visitante (nome, WhatsApp E.164, e-mail e mensagem opcionais).
--                                  SÓ INSERÇÃO. Nasce apenas por indicacoes_enviar_contato() (anônimo ou logado).
--                                  link_id só é preenchido quando o código corresponde EXATAMENTE ao destino (IM-025).
--   indicacoes_notificacao         estado da notificação ao responsável (pendente, enviada, falhou), tentativas e alerta
--                                  administrativo (IM-028). Mutável apenas por funções do banco.
--   indicacoes_notificacao_historico  cada tentativa, reenvio e tratamento de alerta. Só inserção.
--   indicacoes_evento              link_gerado, link_compartilhado, contato_enviado, separados (IM-044: a regra de
--                                  entrada na Base de Relacionamento NÃO existe aqui). Só inserção. Compartilhamento é
--                                  informado pelo cliente e não tem valor probatório. Nada aqui gera pontos (Fase 4).
--
-- PRIVACIDADE (IM-029, IM-041, IM-050, IM-086)
--   * Nenhum privilégio de tabela é concedido a anon. Para authenticated só indicacoes_parametro e indicacoes_evento
--     (SELECT, restrito a administrador por política). Pedidos, links, notificações e histórico são lidos só pelas
--     visões da migração 20261030120000 (definer, filtro fixo por auth.uid() ou administrador).
--   * O indicador nunca recebe nome, WhatsApp, e-mail ou mensagem do visitante.
--   * Notificações carregam só ids e o nome público do destino, jamais dados do visitante ou do indicador.

-- Parâmetros centrais -------------------------------------------------------------------------------------------
create table public.indicacoes_parametro (
  chave text primary key,
  valor integer not null,
  minimo integer not null,
  maximo integer not null,
  descricao text not null,
  atualizado_em timestamptz not null default now(),
  constraint indicacoes_parametro_chave check (char_length(chave) between 1 and 80),
  constraint indicacoes_parametro_faixa check (minimo <= maximo and valor between minimo and maximo)
);
comment on table public.indicacoes_parametro is 'Parâmetros centrais do módulo indicacoes. Alterados só por indicacoes_definir_parametro() (auditado).';

insert into public.indicacoes_parametro (chave, valor, minimo, maximo, descricao) values
  ('contato_janela_repeticao_minutos', 10, 1, 1440, 'Mesmo WhatsApp para o mesmo destino dentro desta janela devolve o pedido existente (sem duplicar nem notificar de novo).'),
  ('contato_limite_por_whatsapp', 5, 1, 100, 'Máximo de pedidos novos por WhatsApp de visitante dentro da janela de limite de taxa.'),
  ('contato_limite_janela_minutos', 60, 1, 1440, 'Janela do limite de taxa por WhatsApp de visitante.'),
  ('compartilhamento_limite_por_hora', 60, 1, 1000, 'Máximo de registros de compartilhamento por link em 1 hora.');

-- Links exclusivos ----------------------------------------------------------------------------------------------
create table public.indicacoes_link (
  id uuid primary key default gen_random_uuid(),
  codigo text not null,
  indicador_id uuid not null references public.contas_conta (id) on delete restrict,
  perfil_id uuid references public.perfis_perfil (id) on delete restrict,
  item_id uuid references public.catalogo_item (id) on delete restrict,
  criado_em timestamptz not null default now(),
  constraint indicacoes_link_codigo_formato check (codigo ~ '^[0-9a-f]{32}$'),
  constraint indicacoes_link_codigo_unico unique (codigo),
  -- exatamente um destino: perfil OU item
  constraint indicacoes_link_um_destino check ((perfil_id is null) <> (item_id is null))
);
-- IM-024: um link por (indicador, destino); gerar de novo devolve o mesmo.
create unique index indicacoes_link_indicador_perfil_unico on public.indicacoes_link (indicador_id, perfil_id) where perfil_id is not null;
create unique index indicacoes_link_indicador_item_unico on public.indicacoes_link (indicador_id, item_id) where item_id is not null;
create index indicacoes_link_perfil_idx on public.indicacoes_link (perfil_id) where perfil_id is not null;
create index indicacoes_link_item_idx on public.indicacoes_link (item_id) where item_id is not null;
comment on table public.indicacoes_link is 'Link exclusivo (indicador, destino). indicador_id nunca é legível por papel de API.';

-- Pedidos de contato (só inserção) ------------------------------------------------------------------------------
create table public.indicacoes_pedido_contato (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid references public.perfis_perfil (id) on delete restrict,
  item_id uuid references public.catalogo_item (id) on delete restrict,
  link_id uuid references public.indicacoes_link (id) on delete restrict,
  solicitante_id uuid references public.contas_conta (id) on delete restrict,
  nome text not null,
  whatsapp_e164 text not null,
  email text,
  mensagem text,
  chave_idempotencia text not null,
  autoindicacao_suspeita boolean not null default false,
  criado_em timestamptz not null default now(),
  constraint indicacoes_pedido_um_destino check ((perfil_id is null) <> (item_id is null)),
  constraint indicacoes_pedido_nome check (char_length(nome) between 2 and 80 and nome = btrim(nome)),
  constraint indicacoes_pedido_whatsapp check (whatsapp_e164 ~ '^\+55[0-9]{10,11}$'),
  constraint indicacoes_pedido_email check (
    email is null or (char_length(email) <= 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')),
  constraint indicacoes_pedido_mensagem check (mensagem is null or char_length(mensagem) between 1 and 1000),
  constraint indicacoes_pedido_chave check (chave_idempotencia ~ '^[A-Za-z0-9_-]{16,100}$'),
  -- sem caracteres de controle nem invisíveis (zero-width, separadores, marcas bidi)
  constraint indicacoes_pedido_sem_invisiveis check (
    nome !~ '[\u0001-\u001F\u007F​-‏ - ⁠-⁯﻿]'
    and (email is null or email !~ '[\u0001-\u001F\u007F​-‏ - ⁠-⁯﻿]')
    and (mensagem is null or mensagem !~ '[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏ - ⁠-⁯﻿]')),
  -- IM-028: repetir a operação (mesma chave do mesmo WhatsApp) não duplica.
  constraint indicacoes_pedido_idempotencia unique (whatsapp_e164, chave_idempotencia)
);
create index indicacoes_pedido_whatsapp_idx on public.indicacoes_pedido_contato (whatsapp_e164, criado_em desc);
create index indicacoes_pedido_perfil_idx on public.indicacoes_pedido_contato (perfil_id, criado_em desc) where perfil_id is not null;
create index indicacoes_pedido_item_idx on public.indicacoes_pedido_contato (item_id, criado_em desc) where item_id is not null;
create index indicacoes_pedido_link_idx on public.indicacoes_pedido_contato (link_id) where link_id is not null;
comment on table public.indicacoes_pedido_contato is 'Pedido de contato do visitante. Só inserção; nenhum papel de API tem privilégio de tabela.';
comment on column public.indicacoes_pedido_contato.autoindicacao_suspeita is 'Registro da tentativa (IM-034): visitante = indicador, responsável ou dono. Contato é permitido; pontos são da Fase 4.';

-- Estado da notificação ao responsável (IM-027, IM-028) ----------------------------------------------------------
create table public.indicacoes_notificacao (
  pedido_id uuid primary key references public.indicacoes_pedido_contato (id) on delete restrict,
  estado text not null default 'pendente',
  tentativas integer not null default 0,
  ultima_tentativa_em timestamptz,
  ultimo_erro text,
  reenvio_solicitado_em timestamptz,
  alerta_estado text not null default 'nenhum',
  atualizado_em timestamptz not null default now(),
  constraint indicacoes_notificacao_estado check (estado in ('pendente', 'enviada', 'falhou')),
  constraint indicacoes_notificacao_tentativas check (tentativas >= 0),
  constraint indicacoes_notificacao_erro check (ultimo_erro is null or char_length(ultimo_erro) <= 200),
  constraint indicacoes_notificacao_alerta check (alerta_estado in ('nenhum', 'aberto', 'tratado'))
);
create index indicacoes_notificacao_estado_idx on public.indicacoes_notificacao (estado) where estado <> 'enviada';
create index indicacoes_notificacao_alerta_idx on public.indicacoes_notificacao (atualizado_em) where alerta_estado = 'aberto';

create table public.indicacoes_notificacao_historico (
  id bigint generated always as identity primary key,
  pedido_id uuid not null references public.indicacoes_pedido_contato (id) on delete restrict,
  evento text not null,
  origem text not null,
  erro text,
  criado_em timestamptz not null default now(),
  constraint indicacoes_notif_hist_evento check (evento in ('tentativa_enviada', 'tentativa_falhou', 'reenvio_solicitado', 'alerta_tratado')),
  constraint indicacoes_notif_hist_origem check (origem in ('servidor', 'responsavel', 'admin')),
  constraint indicacoes_notif_hist_erro check (erro is null or char_length(erro) <= 200)
);
create index indicacoes_notif_hist_pedido_idx on public.indicacoes_notificacao_historico (pedido_id, criado_em desc);

-- Eventos (só inserção) -------------------------------------------------------------------------------------------
create table public.indicacoes_evento (
  id bigint generated always as identity primary key,
  tipo text not null,
  link_id uuid references public.indicacoes_link (id) on delete restrict,
  pedido_id uuid references public.indicacoes_pedido_contato (id) on delete restrict,
  canal text,
  criado_em timestamptz not null default now(),
  constraint indicacoes_evento_tipo check (tipo in ('link_gerado', 'link_compartilhado', 'contato_enviado')),
  constraint indicacoes_evento_canal check (canal is null or canal in ('whatsapp', 'copiar', 'outro')),
  constraint indicacoes_evento_coerente check (
    (tipo = 'link_gerado' and link_id is not null and pedido_id is null and canal is null)
    or (tipo = 'link_compartilhado' and link_id is not null and pedido_id is null and canal is not null)
    or (tipo = 'contato_enviado' and pedido_id is not null and canal is null))
);
-- Cada fato nasce uma vez: link gerado e contato enviado não se repetem.
create unique index indicacoes_evento_gerado_unico on public.indicacoes_evento (link_id) where tipo = 'link_gerado';
create unique index indicacoes_evento_contato_unico on public.indicacoes_evento (pedido_id) where tipo = 'contato_enviado';
create index indicacoes_evento_link_idx on public.indicacoes_evento (link_id, tipo, criado_em desc) where link_id is not null;
create index indicacoes_evento_tipo_idx on public.indicacoes_evento (tipo, criado_em desc);
comment on table public.indicacoes_evento is 'link_gerado, link_compartilhado (informado pelo cliente, sem valor probatório) e contato_enviado, separados (IM-044).';

-- Privilégios ---------------------------------------------------------------------------------------------------
revoke all on public.indicacoes_parametro from anon, authenticated;
revoke all on public.indicacoes_link from anon, authenticated;
revoke all on public.indicacoes_pedido_contato from anon, authenticated;
revoke all on public.indicacoes_notificacao from anon, authenticated;
revoke all on public.indicacoes_notificacao_historico from anon, authenticated;
revoke all on public.indicacoes_evento from anon, authenticated;
-- Só estas duas têm SELECT (e só o administrador passa pela política); nenhuma tem coluna de pessoa.
grant select on public.indicacoes_parametro to authenticated;
grant select on public.indicacoes_evento to authenticated;

alter table public.indicacoes_parametro enable row level security;
alter table public.indicacoes_parametro force row level security;
alter table public.indicacoes_link enable row level security;
alter table public.indicacoes_link force row level security;
alter table public.indicacoes_pedido_contato enable row level security;
alter table public.indicacoes_pedido_contato force row level security;
alter table public.indicacoes_notificacao enable row level security;
alter table public.indicacoes_notificacao force row level security;
alter table public.indicacoes_notificacao_historico enable row level security;
alter table public.indicacoes_notificacao_historico force row level security;
alter table public.indicacoes_evento enable row level security;
alter table public.indicacoes_evento force row level security;

-- Funções de apoio ------------------------------------------------------------------------------------------------
-- O usuário logado é responsável pelo destino do pedido? (perfil: responsavel_id; item: conta_id)
create function public.indicacoes_eh_responsavel_do_pedido(p_pedido_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.indicacoes_pedido_contato p
    left join public.perfis_perfil pf on pf.id = p.perfil_id
    left join public.catalogo_item it on it.id = p.item_id
    where p.id = p_pedido_id
      and (pf.responsavel_id = (select auth.uid()) or it.conta_id = (select auth.uid()))
  );
$$;
revoke all on function public.indicacoes_eh_responsavel_do_pedido(uuid) from public, anon;
grant execute on function public.indicacoes_eh_responsavel_do_pedido(uuid) to authenticated;

-- Leitura de parâmetro (uso interno das funções do módulo).
create function public.indicacoes_parametro_valor(p_chave text) returns integer
language sql stable security definer set search_path = '' as $$
  select valor from public.indicacoes_parametro where chave = p_chave;
$$;
revoke all on function public.indicacoes_parametro_valor(text) from public, anon, authenticated;

-- Políticas -------------------------------------------------------------------------------------------------------
-- indicacoes_parametro: só o administrador lê; escrita só por indicacoes_definir_parametro().
create policy indicacoes_parametro_select_admin on public.indicacoes_parametro
  for select to authenticated using ((select public.administracao_eh_admin()));
create policy indicacoes_parametro_insert_negado on public.indicacoes_parametro
  for insert to authenticated with check (false);
create policy indicacoes_parametro_update_negado on public.indicacoes_parametro
  for update to authenticated using (false) with check (false);
create policy indicacoes_parametro_delete_negado on public.indicacoes_parametro
  for delete to authenticated using (false);

-- indicacoes_link: o indicador (e o administrador) leem; criação só por indicacoes_gerar_link().
create policy indicacoes_link_select_proprio on public.indicacoes_link
  for select to authenticated using (indicador_id = (select auth.uid()) or (select public.administracao_eh_admin()));
create policy indicacoes_link_insert_negado on public.indicacoes_link
  for insert to authenticated with check (false);
create policy indicacoes_link_update_negado on public.indicacoes_link
  for update to authenticated using (false) with check (false);
create policy indicacoes_link_delete_negado on public.indicacoes_link
  for delete to authenticated using (false);

-- indicacoes_pedido_contato: responsável do destino e administrador. O indicador NÃO lê (IM-029).
create policy indicacoes_pedido_select_responsavel on public.indicacoes_pedido_contato
  for select to authenticated using (
    (select public.indicacoes_eh_responsavel_do_pedido(id)) or (select public.administracao_eh_admin()));
create policy indicacoes_pedido_insert_negado on public.indicacoes_pedido_contato
  for insert to authenticated with check (false);
create policy indicacoes_pedido_update_negado on public.indicacoes_pedido_contato
  for update to authenticated using (false) with check (false);
create policy indicacoes_pedido_delete_negado on public.indicacoes_pedido_contato
  for delete to authenticated using (false);

-- indicacoes_notificacao
create policy indicacoes_notificacao_select_responsavel on public.indicacoes_notificacao
  for select to authenticated using (
    (select public.indicacoes_eh_responsavel_do_pedido(pedido_id)) or (select public.administracao_eh_admin()));
create policy indicacoes_notificacao_insert_negado on public.indicacoes_notificacao
  for insert to authenticated with check (false);
create policy indicacoes_notificacao_update_negado on public.indicacoes_notificacao
  for update to authenticated using (false) with check (false);
create policy indicacoes_notificacao_delete_negado on public.indicacoes_notificacao
  for delete to authenticated using (false);

-- indicacoes_notificacao_historico: só administrador.
create policy indicacoes_notif_hist_select_admin on public.indicacoes_notificacao_historico
  for select to authenticated using ((select public.administracao_eh_admin()));
create policy indicacoes_notif_hist_insert_negado on public.indicacoes_notificacao_historico
  for insert to authenticated with check (false);
create policy indicacoes_notif_hist_update_negado on public.indicacoes_notificacao_historico
  for update to authenticated using (false) with check (false);
create policy indicacoes_notif_hist_delete_negado on public.indicacoes_notificacao_historico
  for delete to authenticated using (false);

-- indicacoes_evento: só administrador (o indicador vê o resumo pela visão de indicações).
create policy indicacoes_evento_select_admin on public.indicacoes_evento
  for select to authenticated using ((select public.administracao_eh_admin()));
create policy indicacoes_evento_insert_negado on public.indicacoes_evento
  for insert to authenticated with check (false);
create policy indicacoes_evento_update_negado on public.indicacoes_evento
  for update to authenticated using (false) with check (false);
create policy indicacoes_evento_delete_negado on public.indicacoes_evento
  for delete to authenticated using (false);

-- Gatilhos: histórico e pedidos são só de inserção, inclusive para service_role e donos.
create trigger indicacoes_pedido_imutavel before update or delete on public.indicacoes_pedido_contato
  for each row execute function public.administracao_registro_imutavel();
create trigger indicacoes_evento_imutavel before update or delete on public.indicacoes_evento
  for each row execute function public.administracao_registro_imutavel();
create trigger indicacoes_notif_hist_imutavel before update or delete on public.indicacoes_notificacao_historico
  for each row execute function public.administracao_registro_imutavel();
create trigger indicacoes_link_imutavel before update or delete on public.indicacoes_link
  for each row execute function public.administracao_registro_imutavel();

-- IM-025: a atribuição só existe se o link for DO MESMO destino do pedido (FK composta não protege com colunas
-- nulas, por isso o gatilho). Vale para qualquer papel, inclusive service_role.
create function public.indicacoes_pedido_validar() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.link_id is not null and not exists (
    select 1 from public.indicacoes_link l
    where l.id = new.link_id
      and l.perfil_id is not distinct from new.perfil_id
      and l.item_id is not distinct from new.item_id
  ) then
    raise exception 'o link não pertence ao destino do pedido' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function public.indicacoes_pedido_validar() from public, anon, authenticated;
create trigger indicacoes_pedido_validar before insert on public.indicacoes_pedido_contato
  for each row execute function public.indicacoes_pedido_validar();

-- Notificação: nunca apagada; pedido ligado nunca muda.
create function public.indicacoes_notificacao_proteger() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'notificação de pedido não é apagada' using errcode = '42501';
  end if;
  if new.pedido_id <> old.pedido_id then
    raise exception 'pedido da notificação é imutável' using errcode = '42501';
  end if;
  new.atualizado_em := now();
  return new;
end $$;
revoke all on function public.indicacoes_notificacao_proteger() from public, anon, authenticated;
create trigger indicacoes_notificacao_proteger before update or delete on public.indicacoes_notificacao
  for each row execute function public.indicacoes_notificacao_proteger();

-- Parâmetro: chave e faixa não mudam; só o valor.
create function public.indicacoes_parametro_proteger() returns trigger
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
revoke all on function public.indicacoes_parametro_proteger() from public, anon, authenticated;
create trigger indicacoes_parametro_proteger before update or delete on public.indicacoes_parametro
  for each row execute function public.indicacoes_parametro_proteger();
