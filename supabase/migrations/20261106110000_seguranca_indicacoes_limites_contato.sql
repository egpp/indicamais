-- Fase 14 · revisão de segurança do banco · indicacoes · IM-025, IM-028, IM-030, IM-032, IM-076, IM-086
-- Achado S-03 de docs/revisao-seguranca-banco.md. ESCRITA, NÃO APLICADA: aplicar primeiro no dev, com aprovação (D-003).
-- INDEPENDENTE do S-02 (20261106100000) e do S-01 (20261106130000): nada aqui depende deles.
--
-- PROBLEMA (alto) · indicacoes_enviar_contato é chamável por anon e limita o ritmo só por WHATSAPP DO VISITANTE, valor que o
--   próprio chamador escolhe (basta trocar o número). Quem tem um link de indicação (o código é público) fabrica pedidos
--   "válidos" sem fim e cada um credita pontos ao indicador; também inunda o responsável e raspa WhatsApp (IM-026).
--
-- DESENHO (revisado após a verificação independente): limite que RECUSA vira negação de serviço barata (o código do link é
--   público e o número do visitante é livre: 60 chamadas bloqueariam o contato de um perfil por 1 h). Por isso:
--   * POR LINK: no excesso o gatilho NÃO recusa. Zera new.link_id: o pedido segue normalmente (o visitante legítimo é
--     atendido e o responsável é notificado), mas SEM atribuição e SEM pontos (motivo 'sem_atribuicao', IM-030). O atacante
--     não ganha nada e ninguém é bloqueado. Um gatilho em indicacoes_evento mantém o evento 'contato_enviado' coerente com
--     o pedido (sem link).
--   * POR DESTINO e GLOBAL: por ora só ALARME. O excesso grava um registro auditável (indicacoes_alarme_excesso: tipo,
--     hora, alvo, nível, contagem e limite; sem dado pessoal) legível só pelo administrador, pela função
--     indicacoes_admin_listar_alarmes (a tela é da interface).
--     SIGNIFICADO DE `quantidade`: contagem REAL de pedidos da janela de 1 h no momento do registro, lida até um teto de
--     4 x o limite (custo limitado). Como a tabela é só de inserção e o registro é único por tipo, alvo, hora e NÍVEL, o
--     alarme sobe de nível quando a contagem chega a 2 x e 4 x o limite (nível 0 = 1 x, 1 = 2 x, 2 = 4 x): no máximo 3 linhas
--     por alvo e hora, e o administrador vê a ordem de grandeza do ataque. No POR LINK a contagem satura no limite (os
--     pedidos acima dele perdem o link_id e deixam de ser contados), então só existe o nível 0. Recusa (P0429) só se o interruptor
--     'contato_recusar_excesso' for ligado (padrão 0 = só alarme), o que deve esperar o Turnstile (D-014).
--     Com o interruptor ligado o pedido é recusado e a transação desfaz, então o alarme dessa tentativa não persiste.
--   Os valores (20 por link, 60 por destino, 1000 global, por hora) são PROPOSTA do banco-seguranca; a escolha é do
--   Emerson. Ajustáveis em indicacoes_definir_parametro (auditado).
--
-- CONCORRÊNCIA: o gatilho serializa por LINK e por DESTINO (pg_advisory_xact_lock sobre o id), então o limite por link é
--   exato mesmo se o atacante variar o WhatsApp. O global NÃO é serializado (seria um gargalo para a plataforma toda): é
--   "mole", pode passar alguns sob concorrência; serve de alarme, não de cota exata. O lock dura até o fim da transação
--   do pedido (curta).
-- CUSTO: as contagens usam limit (count sobre no máximo 4 x `limite` linhas; no link, `limite`), então o custo é
--   limitado pelo parâmetro, que tem teto de 10000.
-- ISENÇÃO: service_role (carga em massa/seed pela chave de serviço) não passa pelo gatilho. O papel é lido do JWT validado
--   pelo PostgREST (auth.role()), que anon não consegue forjar. O papel postgres (migração) NÃO é isento: com os padrões
--   (alarme apenas) nada é recusado; só o excesso por link perderia a atribuição.
-- NÃO RESOLVE: atacante com muitos links/destinos. O fecho real é CAPTCHA na borda e teto de pontos por indicador.

insert into public.indicacoes_parametro (chave, valor, minimo, maximo, descricao) values
  ('contato_limite_por_link_hora', 20, 1, 1000, 'Máximo de pedidos COM atribuição por link em 1 hora; acima disso o pedido segue sem atribuição e sem pontos.'),
  ('contato_limite_por_destino_hora', 60, 1, 10000, 'Limiar de alarme: pedidos novos por destino (perfil ou item) em 1 hora.'),
  ('contato_limite_global_hora', 1000, 10, 10000, 'Limiar de alarme: pedidos novos no sistema inteiro em 1 hora.'),
  ('contato_recusar_excesso', 0, 0, 1, '0 = excesso por destino/global só gera alarme; 1 = também recusa o pedido (ligar só com Turnstile no ar).');

create index indicacoes_pedido_criado_idx on public.indicacoes_pedido_contato (criado_em desc);
create index indicacoes_pedido_link_criado_idx on public.indicacoes_pedido_contato (link_id, criado_em desc) where link_id is not null;

-- Alarme de excesso (só inserção; sem dado pessoal; um registro por tipo, alvo, hora e nível) ------------------------------
create table public.indicacoes_alarme_excesso (
  id bigint generated always as identity primary key,
  tipo text not null,
  janela timestamptz not null,
  alvo_id uuid,
  nivel smallint not null default 0,
  quantidade integer not null,
  limite integer not null,
  criado_em timestamptz not null default now(),
  constraint indicacoes_alarme_tipo check (tipo in ('link', 'destino', 'global')),
  constraint indicacoes_alarme_alvo check ((tipo = 'global') = (alvo_id is null)),
  constraint indicacoes_alarme_nivel check (nivel between 0 and 2),
  constraint indicacoes_alarme_numeros check (quantidade >= 0 and limite >= 1)
);
create unique index indicacoes_alarme_unico on public.indicacoes_alarme_excesso
  (tipo, janela, (coalesce(alvo_id, '00000000-0000-0000-0000-000000000000'::uuid)), nivel);
create index indicacoes_alarme_criado_idx on public.indicacoes_alarme_excesso (criado_em desc);
comment on table public.indicacoes_alarme_excesso is 'Excesso de pedidos por link, destino ou global numa hora (S-03). Só inserção, sem dado pessoal; leitura só do administrador. quantidade = contagem real da janela até 4 x o limite; nivel 0/1/2 = 1 x/2 x/4 x o limite.';

revoke all on public.indicacoes_alarme_excesso from anon, authenticated;
grant select on public.indicacoes_alarme_excesso to authenticated;
alter table public.indicacoes_alarme_excesso enable row level security;
alter table public.indicacoes_alarme_excesso force row level security;
create policy indicacoes_alarme_excesso_select_admin on public.indicacoes_alarme_excesso
  for select to authenticated using ((select public.administracao_eh_admin()));
create policy indicacoes_alarme_excesso_insert_negado on public.indicacoes_alarme_excesso
  for insert to authenticated with check (false);
create policy indicacoes_alarme_excesso_update_negado on public.indicacoes_alarme_excesso
  for update to authenticated using (false) with check (false);
create policy indicacoes_alarme_excesso_delete_negado on public.indicacoes_alarme_excesso
  for delete to authenticated using (false);
create trigger indicacoes_alarme_excesso_imutavel
  before update or delete on public.indicacoes_alarme_excesso
  for each row execute function public.administracao_registro_imutavel();

-- Gatilho do pedido ----------------------------------------------------------------------------------------------
create function public.indicacoes_pedido_limitar() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_janela constant timestamptz := date_trunc('hour', now());
  v_desde constant timestamptz := now() - interval '1 hour';
  v_recusar boolean;
  v_lim integer;
  v_qtd integer;
  v_nivel smallint;
begin
  if (select auth.role()) = 'service_role' then
    return new;
  end if;
  v_recusar := coalesce(public.indicacoes_parametro_valor('contato_recusar_excesso'), 0) = 1;

  -- Por link: serializa, e no excesso tira a atribuição (o pedido segue; sem pontos).
  if new.link_id is not null then
    perform pg_advisory_xact_lock(hashtextextended('indicacoes_link:' || new.link_id::text, 0));
    v_lim := public.indicacoes_parametro_valor('contato_limite_por_link_hora');
    select count(*) into v_qtd from (
      select 1 from public.indicacoes_pedido_contato p
      where p.link_id = new.link_id and p.criado_em > v_desde limit v_lim) s;
    if v_qtd >= v_lim then
      insert into public.indicacoes_alarme_excesso (tipo, janela, alvo_id, nivel, quantidade, limite)
      values ('link', v_janela, new.link_id, 0, v_qtd, v_lim)
      on conflict (tipo, janela, (coalesce(alvo_id, '00000000-0000-0000-0000-000000000000'::uuid)), nivel) do nothing;
      new.link_id := null;
    end if;
  end if;

  -- Por destino: serializa e alarma (recusa só com o interruptor).
  perform pg_advisory_xact_lock(hashtextextended('indicacoes_destino:' || coalesce(new.perfil_id, new.item_id)::text, 0));
  v_lim := public.indicacoes_parametro_valor('contato_limite_por_destino_hora');
  -- Dois IF (e não CASE no WHERE) para o plano usar sempre o índice parcial do destino (perfil ou item).
  if new.perfil_id is not null then
    select count(*) into v_qtd from (
      select 1 from public.indicacoes_pedido_contato p
      where p.perfil_id = new.perfil_id and p.criado_em > v_desde limit v_lim * 4) s;
  else
    select count(*) into v_qtd from (
      select 1 from public.indicacoes_pedido_contato p
      where p.item_id = new.item_id and p.criado_em > v_desde limit v_lim * 4) s;
  end if;
  if v_qtd >= v_lim then
    if v_recusar then
      raise exception 'limite de pedidos atingido: tente novamente mais tarde' using errcode = 'P0429';
    end if;
    v_nivel := case when v_qtd >= v_lim * 4 then 2 when v_qtd >= v_lim * 2 then 1 else 0 end;
    insert into public.indicacoes_alarme_excesso (tipo, janela, alvo_id, nivel, quantidade, limite)
    values ('destino', v_janela, coalesce(new.perfil_id, new.item_id), v_nivel, v_qtd, v_lim)
    on conflict (tipo, janela, (coalesce(alvo_id, '00000000-0000-0000-0000-000000000000'::uuid)), nivel) do nothing;
  end if;

  -- Global (mole): alarma; recusa só com o interruptor.
  v_lim := public.indicacoes_parametro_valor('contato_limite_global_hora');
  select count(*) into v_qtd from (
    select 1 from public.indicacoes_pedido_contato p where p.criado_em > v_desde limit v_lim * 4) s;
  if v_qtd >= v_lim then
    if v_recusar then
      raise exception 'limite de pedidos atingido: tente novamente mais tarde' using errcode = 'P0429';
    end if;
    v_nivel := case when v_qtd >= v_lim * 4 then 2 when v_qtd >= v_lim * 2 then 1 else 0 end;
    insert into public.indicacoes_alarme_excesso (tipo, janela, alvo_id, nivel, quantidade, limite)
    values ('global', v_janela, null, v_nivel, v_qtd, v_lim)
    on conflict (tipo, janela, (coalesce(alvo_id, '00000000-0000-0000-0000-000000000000'::uuid)), nivel) do nothing;
  end if;
  return new;
end $$;
revoke all on function public.indicacoes_pedido_limitar() from public, anon, authenticated;

create trigger indicacoes_pedido_limitar before insert on public.indicacoes_pedido_contato
  for each row execute function public.indicacoes_pedido_limitar();

-- O evento 'contato_enviado' herda o link do pedido (que pode ter sido zerado acima), sem mudar a função pública.
create function public.indicacoes_evento_link_do_pedido() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.tipo = 'contato_enviado' and new.pedido_id is not null then
    new.link_id := (select p.link_id from public.indicacoes_pedido_contato p where p.id = new.pedido_id);
  end if;
  return new;
end $$;
revoke all on function public.indicacoes_evento_link_do_pedido() from public, anon, authenticated;

create trigger indicacoes_evento_link_do_pedido before insert on public.indicacoes_evento
  for each row execute function public.indicacoes_evento_link_do_pedido();

-- Leitura do alarme, SÓ para o administrador geral (padrão das leituras administrativas das comissões) ----------------
-- Sem dado pessoal (a tabela não tem). Paginada (padrão 50, máximo 100). Filtro opcional por tipo.
create function public.indicacoes_admin_listar_alarmes(
  p_tipo text default null, p_limite integer default 50, p_deslocamento integer default 0)
returns table (o_id bigint, o_tipo text, o_janela timestamptz, o_alvo_id uuid, o_nivel smallint, o_quantidade integer,
               o_limite integer, o_criado_em timestamptz, o_total bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.administracao_exigir_admin();
  if p_tipo is not null and p_tipo not in ('link', 'destino', 'global') then
    raise exception 'tipo inválido' using errcode = '22023';
  end if;
  return query
  select a.id, a.tipo, a.janela, a.alvo_id, a.nivel, a.quantidade, a.limite, a.criado_em, count(*) over ()
  from public.indicacoes_alarme_excesso a
  where p_tipo is null or a.tipo = p_tipo
  order by a.criado_em desc, a.id desc
  limit least(greatest(coalesce(p_limite, 50), 1), 100) offset greatest(coalesce(p_deslocamento, 0), 0);
end $$;
revoke all on function public.indicacoes_admin_listar_alarmes(text, integer, integer) from public, anon;
grant execute on function public.indicacoes_admin_listar_alarmes(text, integer, integer) to authenticated;
