-- Fase 14 · revisão de segurança do banco · indicacoes · IM-025, IM-028, IM-030, IM-032, IM-086
-- Achado S-03 de docs/revisao-seguranca-banco.md. ESCRITA, NÃO APLICADA: aplicar primeiro no dev, com aprovação (D-003).
--
-- PROBLEMA (alto) · indicacoes_enviar_contato é chamável por anon e limita o ritmo só por WHATSAPP DO VISITANTE, valor que o
--   próprio chamador escolhe (basta trocar o número, que só precisa casar com ^\+55[0-9]{10,11}$). Sem limite por link, por
--   destino nem global, quem tem um link de indicação:
--   (a) fabrica pedidos "válidos" sem fim, e cada um credita pontos ao indicador (a regra de 30 dias é por WhatsApp do
--       visitante, que o atacante troca a cada pedido) e entra na base de relacionamento;
--   (b) inunda o responsável de pedidos e de e-mails de notificação;
--   (c) raspa o WhatsApp de anunciantes particulares, que a função devolve após o envio (IM-026).
-- CORREÇÃO: três limites de ritmo, por hora, aplicados por gatilho antes de gravar o pedido (a função não muda; os
--   caminhos de repetição e idempotência continuam respondendo antes, sem inserir):
--     por link de indicação, por destino (perfil ou item) e global. Excedido: P0429, mensagem neutra, nada gravado.
--   Valores iniciais CONSERVADORES e ajustáveis em indicacoes_definir_parametro (auditado). São uma PROPOSTA do
--   banco-seguranca: a escolha final dos números é do Emerson. O limite global é "mole" (sob concorrência pode passar
--   alguns): serve para conter abuso em massa, não como cota exata.
--   O que este gatilho NÃO resolve: um atacante com muitos links/destinos ainda passa; o fecho real é CAPTCHA na borda
--   (Turnstile, já previsto na D-014) e um teto de pontos por indicador, decisão de produto (ver relatório).

insert into public.indicacoes_parametro (chave, valor, minimo, maximo, descricao) values
  ('contato_limite_por_link_hora', 20, 1, 1000, 'Máximo de pedidos novos por link de indicação em 1 hora (contém fabricação de pedidos e de pontos).'),
  ('contato_limite_por_destino_hora', 60, 1, 10000, 'Máximo de pedidos novos por destino (perfil ou item) em 1 hora, com ou sem link.'),
  ('contato_limite_global_hora', 1000, 10, 100000, 'Máximo de pedidos novos no sistema inteiro em 1 hora (freio de abuso em massa).');

create index indicacoes_pedido_criado_idx on public.indicacoes_pedido_contato (criado_em desc);
create index indicacoes_pedido_link_criado_idx on public.indicacoes_pedido_contato (link_id, criado_em desc) where link_id is not null;

create function public.indicacoes_pedido_limitar() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_desde constant timestamptz := now() - interval '1 hour';
begin
  if new.link_id is not null
     and (select count(*) from public.indicacoes_pedido_contato p
          where p.link_id = new.link_id and p.criado_em > v_desde)
         >= public.indicacoes_parametro_valor('contato_limite_por_link_hora') then
    raise exception 'limite de pedidos atingido: tente novamente mais tarde' using errcode = 'P0429';
  end if;
  if (case when new.perfil_id is not null
        then (select count(*) from public.indicacoes_pedido_contato p
              where p.perfil_id = new.perfil_id and p.criado_em > v_desde)
        else (select count(*) from public.indicacoes_pedido_contato p
              where p.item_id = new.item_id and p.criado_em > v_desde)
      end) >= public.indicacoes_parametro_valor('contato_limite_por_destino_hora') then
    raise exception 'limite de pedidos atingido: tente novamente mais tarde' using errcode = 'P0429';
  end if;
  if (select count(*) from public.indicacoes_pedido_contato p where p.criado_em > v_desde)
     >= public.indicacoes_parametro_valor('contato_limite_global_hora') then
    raise exception 'limite de pedidos atingido: tente novamente mais tarde' using errcode = 'P0429';
  end if;
  return new;
end $$;
revoke all on function public.indicacoes_pedido_limitar() from public, anon, authenticated;

create trigger indicacoes_pedido_limitar before insert on public.indicacoes_pedido_contato
  for each row execute function public.indicacoes_pedido_limitar();
