-- Fase 6 · módulo administracao · suspender e reativar conta · IM-080, IM-077, IM-086, D-014
--
-- SUSPENDER (permissão suspender; motivo obrigatório; auditoria com valor anterior na mesma transação)
--   * a conta passa a 'suspensa' em contas_ciclo_vida: perde o acesso (contas_acesso_permitido = false, contas_meu_estado()
--     devolve acesso_permitido = false para o proxy), não gera link, não escreve nas tabelas que o cliente grava direto,
--     não exerce permissões administrativas e não recebe pedidos de contato;
--   * perfis e itens da conta são DESPUBLICADOS na hora (saem do catálogo, da busca, do patrocinador e dos benefícios);
--   * pontos, lançamentos, histórico, base de relacionamento e auditoria ficam intactos (nada é apagado ou revertido);
--   * pedidos futuros feitos pelo link de um indicador suspenso entram sem atribuição (gatilho da migração anterior).
-- REATIVAR (permissão suspender; motivo obrigatório; auditoria)
--   * a conta volta a 'ativa'. NÃO republica nada: perfis e itens seguem despublicados até o responsável republicar.
-- Ninguém é suspenso automaticamente (nem por denúncia procedente). Administrador geral e a própria conta não são suspensos
-- por esta função. Suspender conta em carência de encerramento cancela o pedido de encerramento (fica no histórico).
--
-- CÓDIGOS DE ERRO: 42501 sem permissão / alvo protegido; 22023 motivo obrigatório; P0002 conta inexistente; P0001 estado
-- que não permite a ação. Suspender conta já suspensa é idempotente (nada muda, sem auditoria nova).

create function public.administracao_suspender_conta(p_conta uuid, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := public.administracao_exigir_admin();
  v_motivo text := nullif(left(btrim(coalesce(p_motivo, '')), 500), '');
  v_sit text;
  v_enc_ate timestamptz;
  v_perfis uuid[];
  v_itens uuid[];
begin
  if v_motivo is null then
    raise exception 'motivo obrigatório' using errcode = '22023';
  end if;
  if p_conta is null or not exists (select 1 from public.contas_conta where id = p_conta) then
    raise exception 'conta não encontrada' using errcode = 'P0002';
  end if;
  if p_conta = v_admin or exists (select 1 from public.administracao_administrador where conta_id = p_conta) then
    raise exception 'esta conta não pode ser suspensa por esta função' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('conta_ciclo_vida:' || p_conta::text, 0));
  select c.situacao, c.encerramento_executar_apos into v_sit, v_enc_ate
  from public.contas_ciclo_vida c where c.conta_id = p_conta;
  v_sit := coalesce(v_sit, 'ativa');
  if v_sit = 'suspensa' then
    return;
  end if;
  if v_sit = 'anonimizada' then
    raise exception 'conta já encerrada' using errcode = 'P0001';
  end if;

  with d as (
    update public.perfis_perfil set publicado = false where responsavel_id = p_conta and publicado returning id
  ) select coalesce(array_agg(id), '{}') into v_perfis from d;
  with d as (
    update public.catalogo_item set publicado = false where conta_id = p_conta and publicado returning id
  ) select coalesce(array_agg(id), '{}') into v_itens from d;

  insert into public.contas_ciclo_vida (conta_id, situacao, suspensa_em)
  values (p_conta, 'suspensa', now())
  on conflict (conta_id) do update
    set situacao = 'suspensa', suspensa_em = now(), encerramento_solicitado_em = null,
        encerramento_executar_apos = null, atualizado_em = now();
  if v_sit = 'encerramento_solicitado' then
    insert into public.contas_ciclo_vida_evento (conta_id, evento, origem) values (p_conta, 'encerramento_cancelado', 'administrador');
  end if;
  insert into public.contas_ciclo_vida_evento (conta_id, evento, origem) values (p_conta, 'suspensa', 'administrador');

  insert into public.administracao_auditoria (autor_id, acao, alvo_tabela, alvo_id, motivo, valor_anterior, valor_novo)
  values (v_admin, 'suspender_conta', 'contas_conta', p_conta::text, v_motivo,
          jsonb_build_object('situacao', v_sit, 'encerramento_executar_apos', v_enc_ate),
          jsonb_build_object('situacao', 'suspensa', 'perfis_despublicados', to_jsonb(v_perfis),
                             'itens_despublicados', to_jsonb(v_itens)));
end $$;

create function public.administracao_reativar_conta(p_conta uuid, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := public.administracao_exigir_admin();
  v_motivo text := nullif(left(btrim(coalesce(p_motivo, '')), 500), '');
  v_sit text;
  v_desde timestamptz;
  v_publicados integer;
begin
  if v_motivo is null then
    raise exception 'motivo obrigatório' using errcode = '22023';
  end if;
  if p_conta is null or not exists (select 1 from public.contas_conta where id = p_conta) then
    raise exception 'conta não encontrada' using errcode = 'P0002';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('conta_ciclo_vida:' || p_conta::text, 0));
  select c.situacao, c.suspensa_em into v_sit, v_desde from public.contas_ciclo_vida c where c.conta_id = p_conta;
  if v_sit is distinct from 'suspensa' then
    raise exception 'a conta não está suspensa' using errcode = 'P0001';
  end if;
  update public.contas_ciclo_vida
     set situacao = 'ativa', suspensa_em = null, atualizado_em = now()
   where conta_id = p_conta;
  insert into public.contas_ciclo_vida_evento (conta_id, evento, origem) values (p_conta, 'reativada', 'administrador');
  -- Reativar NÃO republica: nada é alterado em perfis nem itens. O número abaixo é a prova na auditoria.
  select (select count(*) from public.perfis_perfil where responsavel_id = p_conta and publicado)
       + (select count(*) from public.catalogo_item where conta_id = p_conta and publicado)
    into v_publicados;
  insert into public.administracao_auditoria (autor_id, acao, alvo_tabela, alvo_id, motivo, valor_anterior, valor_novo)
  values (v_admin, 'reativar_conta', 'contas_conta', p_conta::text, v_motivo,
          jsonb_build_object('situacao', 'suspensa', 'suspensa_em', v_desde),
          jsonb_build_object('situacao', 'ativa', 'republicado_automaticamente', false, 'publicados_agora', v_publicados));
end $$;

revoke all on function public.administracao_suspender_conta(uuid, text) from public, anon;
revoke all on function public.administracao_reativar_conta(uuid, text) from public, anon;
grant execute on function public.administracao_suspender_conta(uuid, text) to authenticated;
grant execute on function public.administracao_reativar_conta(uuid, text) to authenticated;
alter function public.administracao_suspender_conta(uuid, text) set indicamais.permissao_exigida = 'suspender';
alter function public.administracao_reativar_conta(uuid, text) set indicamais.permissao_exigida = 'suspender';

-- Contas fora do normal, para quem tem a permissão suspender. Sem nome, telefone nem e-mail.
create view public.administracao_contas_ciclo_vida as
select c.conta_id,
       c.situacao,
       c.suspensa_em,
       c.encerramento_solicitado_em,
       c.encerramento_executar_apos,
       c.anonimizada_em,
       c.atualizado_em
from public.contas_ciclo_vida c
where c.situacao <> 'ativa' and (select public.administracao_permitido('suspender'));
revoke all on public.administracao_contas_ciclo_vida from anon, authenticated;
grant select on public.administracao_contas_ciclo_vida to authenticated;
