-- Fase 5 · módulo notificacoes · avisos no app, abas e leitura · IM-047, IM-048, IM-049, IM-050, IM-051, IM-052, IM-053,
-- IM-086, D-013
--
-- DESENHO (IM-053: sem duplicar registros)
--   Os avisos NÃO são copiados: a lista é DERIVADA, por visão, dos registros que já existem (pedido de contato válido,
--   curtida na Base, resultado de revisão). O módulo guarda só o estado de leitura:
--   notificacoes_leitura   (conta, origem, origem_id) -> lida_em. Só inserção (marcar como lida = inserir; nunca desmarca).
--   Fontes (origem):
--     contato_valido   ao responsável do destino: contato chegou por indicação válida (relacionamento_entrada_decisao)
--     indicacao_valida ao indicador: a indicação dele gerou um contato válido (some ao sair da base do perfil, IM-045)
--     curtida          ao responsável do perfil: alguém curtiu (relacionamento_membro; sai junto com a curtida/saída)
--     revisao          ao responsável: versão aprovada ou rejeitada (administracao_meus_resultados)
--   Só dois eventos geram aviso de relacionamento: contato válido e curtida (IM-051). Link gerado e compartilhamento não.
--   Nenhum aviso afirma compartilhamento externo: não existe tipo para isso.
--
-- PRIVACIDADE (IM-029, IM-041, IM-050)
--   * O ator (indicador/curtidor) aparece só como nome público (relacionamento_nome_publico: "Maria S.", função pura sobre o nome de exibição) e, nas abas, como
--     referência opaca por responsável. Nunca WhatsApp, e-mail, nome completo nem conta_id. Dados do visitante (nome, WhatsApp,
--     e-mail, mensagem) NÃO entram em nenhuma visão deste módulo.
--   * Quem saiu da base do perfil (IM-045) deixa de aparecer pelo nome (ator_nome nulo) e deixa de receber avisos daquele perfil.
--   * Visões SECURITY DEFINER com filtro fixo por auth.uid(), sem acesso a anon (o alerta 0010 é esperado).
--
-- CÓDIGOS DE ERRO: 42501 não autenticado; 22023 parâmetro inválido; P0002 aviso inexistente (ou de outra conta: mensagem
-- neutra, igual nos dois casos).

create table public.notificacoes_leitura (
  conta_id uuid not null references public.contas_conta (id) on delete restrict,
  origem text not null,
  origem_id uuid not null,
  lida_em timestamptz not null default now(),
  primary key (conta_id, origem, origem_id),
  constraint notificacoes_leitura_origem check (origem in ('contato_valido', 'indicacao_valida', 'curtida', 'revisao'))
);
comment on table public.notificacoes_leitura is 'Estado de leitura dos avisos (IM-052). Só inserção; o conteúdo do aviso é derivado, nunca copiado (IM-053).';

revoke all on public.notificacoes_leitura from anon, authenticated;
grant select on public.notificacoes_leitura to authenticated;
alter table public.notificacoes_leitura enable row level security;
alter table public.notificacoes_leitura force row level security;

create policy notificacoes_leitura_select_propria on public.notificacoes_leitura
  for select to authenticated using (conta_id = (select auth.uid()));
create policy notificacoes_leitura_insert_negado on public.notificacoes_leitura
  for insert to authenticated with check (false);
create policy notificacoes_leitura_update_negado on public.notificacoes_leitura
  for update to authenticated using (false) with check (false);
create policy notificacoes_leitura_delete_negado on public.notificacoes_leitura
  for delete to authenticated using (false);

create trigger notificacoes_leitura_imutavel before update or delete on public.notificacoes_leitura
  for each row execute function public.administracao_registro_imutavel();

-- Lista de avisos da conta (IM-047, IM-052) ---------------------------------------------------------------------------
-- Colunas: origem + origem_id identificam o aviso (chave de "marcar como lida"); tipo diz o texto; destino_* diz qual item
-- ou página abrir; ator_nome é o nome público (nulo quando não se aplica ou quando a pessoa saiu da base).
create view public.notificacoes_meus_avisos as
select x.origem, x.origem_id, x.tipo, x.destino_tipo, x.destino_id, x.destino_nome, x.ator_nome, x.criado_em,
       (l.lida_em is not null) as lida,
       l.lida_em
from (
  -- contato válido, ao responsável do destino
  select 'contato_valido'::text as origem, d.pedido_id as origem_id, 'contato_valido'::text as tipo,
         (case when p.perfil_id is not null then 'perfil' else 'item' end)::text as destino_tipo,
         coalesce(p.perfil_id, p.item_id) as destino_id,
         coalesce(pv.nome, iv.nome) as destino_nome,
         (case when exists (select 1 from public.relacionamento_saida s
                            where s.perfil_id = d.base_perfil_id and s.conta_id = l.indicador_id)
               then null else public.relacionamento_nome_publico(ci.nome_exibicao) end)::text as ator_nome,
         p.criado_em
  from public.relacionamento_entrada_decisao d
  join public.indicacoes_pedido_contato p on p.id = d.pedido_id
  join public.indicacoes_link l on l.id = p.link_id
  join public.contas_conta ci on ci.id = l.indicador_id
  left join public.perfis_perfil pf on pf.id = p.perfil_id
  left join public.catalogo_item it on it.id = p.item_id
  left join public.perfis_perfil_versao pv on pv.id = pf.versao_aprovada_id
  left join public.catalogo_item_versao iv on iv.id = it.versao_aprovada_id
  where d.valido and (pf.responsavel_id = (select auth.uid()) or it.conta_id = (select auth.uid()))
  union all
  -- indicação válida, ao indicador (encerrado para quem saiu da base do perfil)
  select 'indicacao_valida'::text, d.pedido_id, 'indicacao_valida'::text,
         (case when p.perfil_id is not null then 'perfil' else 'item' end)::text,
         coalesce(p.perfil_id, p.item_id),
         coalesce(pv.nome, iv.nome),
         null::text,
         p.criado_em
  from public.relacionamento_entrada_decisao d
  join public.indicacoes_pedido_contato p on p.id = d.pedido_id
  join public.indicacoes_link l on l.id = p.link_id
  left join public.perfis_perfil pf on pf.id = p.perfil_id
  left join public.catalogo_item it on it.id = p.item_id
  left join public.perfis_perfil_versao pv on pv.id = pf.versao_aprovada_id
  left join public.catalogo_item_versao iv on iv.id = it.versao_aprovada_id
  where d.valido and l.indicador_id = (select auth.uid())
    and not exists (select 1 from public.relacionamento_saida s
                    where s.perfil_id = d.base_perfil_id and s.conta_id = l.indicador_id)
  union all
  -- curtida, ao responsável do perfil (origem_id determinístico: descurtir e curtir de novo não cria aviso novo)
  select 'curtida'::text, md5('curtida:' || m.perfil_id::text || ':' || m.conta_id::text)::uuid, 'curtida'::text,
         'perfil'::text, m.perfil_id, pv.nome,
         public.relacionamento_nome_publico(cc.nome_exibicao),
         m.curtida_em
  from public.relacionamento_membro m
  join public.contas_conta cc on cc.id = m.conta_id
  join public.perfis_perfil pf on pf.id = m.perfil_id
  left join public.perfis_perfil_versao pv on pv.id = pf.versao_aprovada_id
  where m.curtida_em is not null and pf.responsavel_id = (select auth.uid())
  union all
  -- resultado de revisão (aprovação ou rejeição), reaproveitando a visão existente (IM-053)
  select 'revisao'::text, r.versao_id, ('revisao_' || r.situacao)::text,
         r.tipo, r.alvo_id, r.nome, null::text, r.decidida_em
  from public.administracao_meus_resultados r
  where r.situacao in ('aprovada', 'rejeitada') and r.decidida_em is not null
) x
left join public.notificacoes_leitura l
  on l.conta_id = (select auth.uid()) and l.origem = x.origem and l.origem_id = x.origem_id;
revoke all on public.notificacoes_meus_avisos from anon, authenticated;
grant select on public.notificacoes_meus_avisos to authenticated;

-- Aba "Quem me indicou" (IM-048) -----------------------------------------------------------------------------------
-- Contatos válidos que chegaram por indicação a páginas e itens sob responsabilidade do usuário: qual item e, quando o
-- item é de um perfil, qual perfil de destino. Só dados públicos do indicador (IM-050). indicador_ref é opaco e estável por
-- responsável (agrupa sem identificar); nulo, junto com indicador_nome, quando a pessoa saiu da base.
create view public.notificacoes_quem_me_indicou as
select d.pedido_id as id,
       (case when p.perfil_id is not null then 'perfil' else 'item' end)::text as destino_tipo,
       coalesce(p.perfil_id, p.item_id) as destino_id,
       coalesce(pv.nome, iv.nome) as destino_nome,
       coalesce(p.perfil_id, it.perfil_id) as perfil_destino_id,
       coalesce(pv.nome, pvi.nome) as perfil_destino_nome,
       (case when sx.perfil_id is not null then null else public.relacionamento_nome_publico(ci.nome_exibicao) end)::text as indicador_nome,
       (case when sx.perfil_id is not null then null
             else encode(sha256(convert_to('indicamais:indicador:' || l.indicador_id::text || ':' || (select auth.uid())::text, 'UTF8')), 'hex') end)::text as indicador_ref,
       (sx.perfil_id is not null) as indicador_saiu_da_base,
       p.criado_em
from public.relacionamento_entrada_decisao d
join public.indicacoes_pedido_contato p on p.id = d.pedido_id
join public.indicacoes_link l on l.id = p.link_id
join public.contas_conta ci on ci.id = l.indicador_id
left join public.perfis_perfil pf on pf.id = p.perfil_id
left join public.catalogo_item it on it.id = p.item_id
left join public.perfis_perfil_versao pv on pv.id = pf.versao_aprovada_id
left join public.catalogo_item_versao iv on iv.id = it.versao_aprovada_id
left join public.perfis_perfil pfi on pfi.id = it.perfil_id
left join public.perfis_perfil_versao pvi on pvi.id = pfi.versao_aprovada_id
left join public.relacionamento_saida sx on sx.perfil_id = d.base_perfil_id and sx.conta_id = l.indicador_id
where d.valido and (pf.responsavel_id = (select auth.uid()) or it.conta_id = (select auth.uid()));
revoke all on public.notificacoes_quem_me_indicou from anon, authenticated;
grant select on public.notificacoes_quem_me_indicou to authenticated;

-- Aba "Minhas indicações" (IM-049): reaproveita indicacoes_minhas_indicacoes (contagem = count(*), histórico = linhas
-- com destino, data e status). Nenhuma visão nova: sem duplicar o registro.

-- Leitura (IM-052) ------------------------------------------------------------------------------------------------------
create function public.notificacoes_contar_nao_lidas() returns integer
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then
    raise exception 'não autenticado' using errcode = '42501';
  end if;
  return (select count(*)::integer from public.notificacoes_meus_avisos a where not a.lida);
end $$;

-- Marca UM aviso como lido. Idempotente: true se marcou agora, false se já estava lido. Aviso que não é da conta
-- (ou não existe) responde igual: P0002, mensagem neutra.
create function public.notificacoes_marcar_lida(p_origem text, p_origem_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_n integer;
begin
  if v_uid is null then
    raise exception 'não autenticado' using errcode = '42501';
  end if;
  if p_origem is null or p_origem_id is null
     or p_origem not in ('contato_valido', 'indicacao_valida', 'curtida', 'revisao') then
    raise exception 'aviso inválido' using errcode = '22023';
  end if;
  if not exists (select 1 from public.notificacoes_meus_avisos a where a.origem = p_origem and a.origem_id = p_origem_id) then
    raise exception 'aviso não encontrado' using errcode = 'P0002';
  end if;
  insert into public.notificacoes_leitura (conta_id, origem, origem_id) values (v_uid, p_origem, p_origem_id)
  on conflict (conta_id, origem, origem_id) do nothing;
  get diagnostics v_n = row_count;
  return v_n > 0;
end $$;

-- Marca TODOS os avisos da conta como lidos. Devolve quantos foram marcados agora.
create function public.notificacoes_marcar_todas_lidas() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_n integer;
begin
  if v_uid is null then
    raise exception 'não autenticado' using errcode = '42501';
  end if;
  insert into public.notificacoes_leitura (conta_id, origem, origem_id)
  select v_uid, a.origem, a.origem_id from public.notificacoes_meus_avisos a where not a.lida
  on conflict (conta_id, origem, origem_id) do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

revoke all on function public.notificacoes_contar_nao_lidas() from public, anon;
revoke all on function public.notificacoes_marcar_lida(text, uuid) from public, anon;
revoke all on function public.notificacoes_marcar_todas_lidas() from public, anon;
grant execute on function public.notificacoes_contar_nao_lidas() to authenticated;
grant execute on function public.notificacoes_marcar_lida(text, uuid) to authenticated;
grant execute on function public.notificacoes_marcar_todas_lidas() to authenticated;
