-- Reprocessamento automatico de notificacoes de contato (IM-027, IM-028, IM-080/081).
-- ESCRITA E NAO APLICADA: aplicar primeiro em dev, por `banco-seguranca`/gestor (D-003).
-- Uma falha de envio grava estado 'falhou' (alerta aberto) e so voltava a 'pendente' por reenvio manual. Esta funcao,
-- chamada so pelo cron com a chave de servico, devolve a fila as falhas que ainda tem tentativas sobrando
-- (tentativas < p_tentativas_max) e esperaram p_espera_minutos desde a ultima tentativa. Nao cria pedido, nao apaga
-- nada, nao mexe em tentativas nem no alerta (o alerta fecha quando o envio der certo). Falha por "responsavel sem
-- e-mail" nao e recolocada (nao se resolve sozinha).
create function public.indicacoes_notificacoes_recolocar_falhas(
  p_limite integer default 10,
  p_tentativas_max integer default 3,
  p_espera_minutos integer default 60
) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_qtd integer;
begin
  with escolhidas as (
    select n.pedido_id
    from public.indicacoes_notificacao n
    where n.estado = 'falhou'
      and n.tentativas < greatest(coalesce(p_tentativas_max, 3), 1)
      and coalesce(n.ultimo_erro, '') <> 'responsável sem e-mail'
      and (n.ultima_tentativa_em is null
           or n.ultima_tentativa_em <= now() - make_interval(mins => greatest(coalesce(p_espera_minutos, 60), 0)))
    order by n.ultima_tentativa_em nulls first, n.pedido_id
    limit least(greatest(coalesce(p_limite, 10), 1), 100)
    for update skip locked
  )
  update public.indicacoes_notificacao n
     set estado = 'pendente'
    from escolhidas e
   where n.pedido_id = e.pedido_id;
  get diagnostics v_qtd = row_count;
  return v_qtd;
end $$;

revoke all on function public.indicacoes_notificacoes_recolocar_falhas(integer, integer, integer) from public, anon, authenticated;
grant execute on function public.indicacoes_notificacoes_recolocar_falhas(integer, integer, integer) to service_role;
