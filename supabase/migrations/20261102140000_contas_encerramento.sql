-- Fase 6 · módulo contas · encerramento de conta com carência e anonimização · IM-081, IM-082, IM-086, D-014
--
-- FLUXO
--   1. A própria pessoa chama contas_solicitar_encerramento('ENCERRAR'): a palavra é validada NO SERVIDOR (confirmação
--      reforçada). Perfis e itens são despublicados na hora, sem transferência para outra conta. A conta passa a
--      'encerramento_solicitado' com data de execução = agora + carência (contas_parametro.encerramento_carencia_dias, 30,
--      provisório até a revisão jurídica, IM-082). Nesse prazo a pessoa ainda entra e pode desistir com
--      contas_cancelar_encerramento() (perfis seguem despublicados; ela republica se quiser).
--   2. Rotina do servidor (service_role), idempotente: contas_executar_encerramentos() anonimiza as contas vencidas.
--   3. ANONIMIZAÇÃO (contas_anonimizar): a linha de contas_conta NÃO é apagada (pontos, relacionamento, auditoria e
--      lançamentos continuam apontando para um id opaco, o "on delete restrict" deixa de ser obstáculo). Zeram-se nome de
--      exibição, WhatsApp e o histórico de WhatsApp; no Auth, e-mail vira um endereço inválido único, telefone e metadados
--      são limpos, identidades e sessões saem, a senha é removida e o usuário fica banido. Permissões administrativas são
--      removidas. Preservados sem identificação: auditoria, decisões e lançamentos de pontos, relacionamento, eventos.
--      Perfis e itens não são transferidos e permanecem despublicados (ver dúvidas no relatório sobre o conteúdo comercial).
--   Se a anonimização de uma conta falhar, a conta fica como estava (transação desfeita) e o evento 'anonimizacao_falhou'
--   é registrado; a rotina tenta de novo na próxima execução.
--
-- CÓDIGOS DE ERRO: 42501 não autenticado / conta sem acesso; 22023 confirmação inválida; P0001 estado que não permite a
-- ação (administrador geral não encerra por aqui; não há encerramento solicitado).

-- O histórico de WhatsApp é só de inserção; a ÚNICA exceção é zerar os números durante a anonimização da própria conta
-- (a rotina marca a conta na configuração local da transação, o cliente da API não consegue fazer isso).
create or replace function public.contas_historico_imutavel() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE'
     and current_setting('indicamais.anonimizando', true) = old.conta_id::text
     and new.whatsapp_anterior_e164 is null and new.whatsapp_novo_e164 is null
     and new.id = old.id and new.conta_id = old.conta_id
     and new.autor_id is not distinct from old.autor_id and new.alterado_em = old.alterado_em then
    return new;
  end if;
  raise exception 'contas_whatsapp_historico é só de inserção' using errcode = '42501';
end $$;
revoke all on function public.contas_historico_imutavel() from public, anon, authenticated;

-- Solicitar encerramento ----------------------------------------------------------------------------------------------------
create function public.contas_solicitar_encerramento(p_confirmacao text) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_sit text;
  v_ate timestamptz;
begin
  if v_uid is null then
    raise exception 'não autenticado' using errcode = '42501';
  end if;
  if upper(btrim(coalesce(p_confirmacao, ''))) <> 'ENCERRAR' then
    raise exception 'confirmação inválida: digite ENCERRAR' using errcode = '22023';
  end if;
  if not exists (select 1 from public.contas_conta where id = v_uid) then
    raise exception 'não autenticado' using errcode = '42501';
  end if;
  if exists (select 1 from public.administracao_administrador where conta_id = v_uid) then
    raise exception 'administrador geral não encerra a conta por esta função' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('conta_ciclo_vida:' || v_uid::text, 0));
  select c.situacao, c.encerramento_executar_apos into v_sit, v_ate from public.contas_ciclo_vida c where c.conta_id = v_uid;
  v_sit := coalesce(v_sit, 'ativa');
  if v_sit = 'encerramento_solicitado' then
    return v_ate;
  end if;
  if v_sit <> 'ativa' then
    raise exception 'acesso restrito' using errcode = '42501';
  end if;

  update public.perfis_perfil set publicado = false where responsavel_id = v_uid and publicado;
  update public.catalogo_item set publicado = false where conta_id = v_uid and publicado;

  v_ate := now() + public.contas_parametro_valor('encerramento_carencia_dias') * interval '1 day';
  insert into public.contas_ciclo_vida (conta_id, situacao, encerramento_solicitado_em, encerramento_executar_apos)
  values (v_uid, 'encerramento_solicitado', now(), v_ate)
  on conflict (conta_id) do update
    set situacao = 'encerramento_solicitado', encerramento_solicitado_em = now(),
        encerramento_executar_apos = v_ate, suspensa_em = null, atualizado_em = now();
  insert into public.contas_ciclo_vida_evento (conta_id, evento, origem) values (v_uid, 'encerramento_solicitado', 'propria');
  return v_ate;
end $$;

-- Desistir dentro da carência. Perfis NÃO são republicados.
create function public.contas_cancelar_encerramento() returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_sit text;
begin
  if v_uid is null then
    raise exception 'não autenticado' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('conta_ciclo_vida:' || v_uid::text, 0));
  select c.situacao into v_sit from public.contas_ciclo_vida c where c.conta_id = v_uid;
  if v_sit is distinct from 'encerramento_solicitado' then
    raise exception 'não há encerramento solicitado' using errcode = 'P0001';
  end if;
  update public.contas_ciclo_vida
     set situacao = 'ativa', encerramento_solicitado_em = null, encerramento_executar_apos = null, atualizado_em = now()
   where conta_id = v_uid;
  insert into public.contas_ciclo_vida_evento (conta_id, evento, origem) values (v_uid, 'encerramento_cancelado', 'propria');
end $$;

revoke all on function public.contas_solicitar_encerramento(text) from public, anon;
revoke all on function public.contas_cancelar_encerramento() from public, anon;
grant execute on function public.contas_solicitar_encerramento(text) to authenticated;
grant execute on function public.contas_cancelar_encerramento() to authenticated;

-- Anonimização -------------------------------------------------------------------------------------------------------------------
-- Limpa o cadastro do Auth. Não apaga o usuário (a conta continua apontando para ele): e-mail vira endereço inválido e único.
create function public.contas_anonimizar_auth(p_conta uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from auth.identities where user_id = p_conta;
  delete from auth.sessions where user_id = p_conta;
  update auth.users
     set email = 'anonimizado+' || p_conta::text || '@anonimizado.invalid',
         phone = null,
         raw_user_meta_data = '{}'::jsonb,
         encrypted_password = null,
         banned_until = 'infinity'::timestamptz,
         updated_at = now()
   where id = p_conta;
end $$;
revoke all on function public.contas_anonimizar_auth(uuid) from public, anon, authenticated;

-- Anonimiza UMA conta cuja carência venceu. Idempotente: conta em outro estado é ignorada; rodar de novo não faz nada.
create function public.contas_anonimizar(p_conta uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_sit text;
begin
  perform pg_advisory_xact_lock(hashtextextended('conta_ciclo_vida:' || p_conta::text, 0));
  select c.situacao into v_sit from public.contas_ciclo_vida c where c.conta_id = p_conta for update;
  if v_sit is distinct from 'encerramento_solicitado' then
    return;
  end if;
  perform set_config('indicamais.anonimizando', p_conta::text, true);

  update public.perfis_perfil set publicado = false where responsavel_id = p_conta and publicado;
  update public.catalogo_item set publicado = false where conta_id = p_conta and publicado;

  update public.contas_conta set nome_exibicao = null, whatsapp_e164 = null where id = p_conta;
  update public.contas_whatsapp_historico
     set whatsapp_anterior_e164 = null, whatsapp_novo_e164 = null
   where conta_id = p_conta;
  delete from public.administracao_permissao where conta_id = p_conta;
  perform public.contas_anonimizar_auth(p_conta);

  update public.contas_ciclo_vida
     set situacao = 'anonimizada', anonimizada_em = now(), atualizado_em = now()
   where conta_id = p_conta;
  insert into public.contas_ciclo_vida_evento (conta_id, evento, origem) values (p_conta, 'anonimizada', 'rotina');
  perform set_config('indicamais.anonimizando', '', true);
end $$;
revoke all on function public.contas_anonimizar(uuid) from public, anon, authenticated;

-- Rotina do servidor (service_role): anonimiza em lote as contas com carência vencida. Devolve quantas foram processadas.
create function public.contas_executar_encerramentos(p_limite integer default 20) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_ok integer := 0;
begin
  for v_id in
    select c.conta_id
    from public.contas_ciclo_vida c
    where c.situacao = 'encerramento_solicitado' and c.encerramento_executar_apos <= now()
    order by c.encerramento_executar_apos
    limit least(greatest(coalesce(p_limite, 20), 1), 100)
  loop
    begin
      perform public.contas_anonimizar(v_id);
      v_ok := v_ok + 1;
    exception when others then
      insert into public.contas_ciclo_vida_evento (conta_id, evento, origem) values (v_id, 'anonimizacao_falhou', 'rotina');
    end;
  end loop;
  return v_ok;
end $$;
revoke all on function public.contas_executar_encerramentos(integer) from public, anon, authenticated;
grant execute on function public.contas_executar_encerramentos(integer) to service_role;
