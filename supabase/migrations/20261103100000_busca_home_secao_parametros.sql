-- Fase 9 · módulo busca · parâmetros das seções em carrossel da página inicial · IM-095, IM-096, IM-019, IM-086, D-018
--
-- MODELO
--   busca_home_secao  uma linha por seção (CHAVE FIXA: novidades, mais_curtidos, mais_indicados, na_sua_cidade, em_alta_semana).
--                     Editável: título, ativa, ordem, mínimo de itens e limite padrão. Não editável: chave e tipo de item.
--                     tipo_item é o ponto de extensão (D-018): hoje só 'perfil'; produtos e serviços entram depois ampliando o
--                     CHECK em migração própria, sem mudar a tabela.
--   Seções nascem por migração (seed abaixo). Não há INSERT nem DELETE pelo cliente nem pela função: a lista de critérios é
--   decisão de produto (D-018), e cada critério tem código próprio em busca_home_candidatos (migração seguinte).
--
-- ESCRITA: só administracao_alterar_home_secao(), exclusiva do ADMINISTRADOR GERAL, com motivo obrigatório e auditoria na mesma
-- transação (autor, data, motivo, valor anterior e novo em administracao_auditoria). Nenhum privilégio de escrita ao cliente.
--
-- LEITURA: pública (anon e authenticated) só das seções ATIVAS; o administrador geral lê todas (para reativar). A tabela só tem
-- configuração de exibição: nada de conta, pessoa ou contagem.
--
-- ERROS (SQLSTATE): 42501 não é administrador geral; 22023 motivo ou campo ausente; 23514 título/ordem/limites fora das regras;
-- P0002 seção inexistente.

create table public.busca_home_secao (
  chave text primary key,
  titulo text not null,
  ativa boolean not null default true,
  ordem integer not null,
  minimo_itens integer not null default 4,
  limite_padrao integer not null default 10,
  tipo_item text not null default 'perfil',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint busca_home_secao_chave check (chave in ('novidades', 'mais_curtidos', 'mais_indicados', 'na_sua_cidade', 'em_alta_semana')),
  -- Título: 3 a 40 caracteres, sem espaços nas pontas nem duplos, só letras (com acento), números e pontuação simples;
  -- nenhum caractere de controle, emoji, marcação ou link (IM-012).
  constraint busca_home_secao_titulo check (
    char_length(titulo) between 3 and 40
    and titulo = btrim(titulo)
    and titulo !~ '  '
    and titulo ~ '^[A-Za-zÀ-ÖØ-öø-ÿ0-9][A-Za-zÀ-ÖØ-öø-ÿ0-9 ,.!?:&''()/+-]*$'
    and titulo !~* '(https?:|www\.|\.com|\.net|\.org|\.br)'),
  constraint busca_home_secao_ordem check (ordem between 1 and 99),
  constraint busca_home_secao_minimo check (minimo_itens between 1 and 20),
  constraint busca_home_secao_limite check (limite_padrao between 1 and 30),
  constraint busca_home_secao_faixa check (limite_padrao >= minimo_itens),
  constraint busca_home_secao_tipo check (tipo_item in ('perfil'))
);
comment on table public.busca_home_secao is 'Seções em carrossel da home (IM-095/IM-096). Chave fixa; escrita só por administracao_alterar_home_secao (administrador geral, auditada).';

insert into public.busca_home_secao (chave, titulo, ordem) values
  ('novidades', 'Novidades', 1),
  ('mais_curtidos', 'Mais curtidos', 2),
  ('mais_indicados', 'Mais indicados', 3),
  ('na_sua_cidade', 'Na sua cidade', 4),
  ('em_alta_semana', 'Em alta na semana', 5);

-- Privilégios e RLS ---------------------------------------------------------------------------------------------------
revoke all on public.busca_home_secao from anon, authenticated;
grant select (chave, titulo, ativa, ordem, minimo_itens, limite_padrao, tipo_item) on public.busca_home_secao to anon;
grant select on public.busca_home_secao to authenticated;
alter table public.busca_home_secao enable row level security;
alter table public.busca_home_secao force row level security;

create policy busca_home_secao_select_publico on public.busca_home_secao
  for select to anon, authenticated using (ativa);
create policy busca_home_secao_select_admin on public.busca_home_secao
  for select to authenticated using ((select public.administracao_eh_admin()));
create policy busca_home_secao_insert_negado on public.busca_home_secao
  for insert to anon, authenticated with check (false);
create policy busca_home_secao_update_negado on public.busca_home_secao
  for update to anon, authenticated using (false) with check (false);
create policy busca_home_secao_delete_negado on public.busca_home_secao
  for delete to anon, authenticated using (false);

-- Integridade (vale também para service_role): chave, tipo de item e criação não mudam; seção não se apaga.
create function public.busca_home_secao_proteger() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'seção da home não é apagada: desative' using errcode = '42501';
  end if;
  if new.chave <> old.chave or new.tipo_item <> old.tipo_item or new.criado_em <> old.criado_em then
    raise exception 'chave, tipo de item e criação da seção são imutáveis' using errcode = '42501';
  end if;
  new.atualizado_em := now();
  return new;
end $$;
revoke all on function public.busca_home_secao_proteger() from public, anon, authenticated;
create trigger busca_home_secao_proteger before update or delete on public.busca_home_secao
  for each row execute function public.busca_home_secao_proteger();

-- Edição pelo administrador geral (IM-096) -----------------------------------------------------------------------------
-- Substitui título, ativa, ordem, mínimo e limite. Sem mudança real: não grava nada (idempotente), mas o motivo continua exigido.
create function public.administracao_alterar_home_secao(
  p_chave text,
  p_titulo text,
  p_ativa boolean,
  p_ordem integer,
  p_minimo_itens integer,
  p_limite_padrao integer,
  p_motivo text
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_autor uuid := public.administracao_exigir_admin();
  v_motivo text := nullif(left(btrim(coalesce(p_motivo, '')), 500), '');
  v_titulo text := btrim(regexp_replace(coalesce(p_titulo, ''), '[[:space:]]+', ' ', 'g'));
  v_antes public.busca_home_secao;
begin
  if v_motivo is null then
    raise exception 'motivo obrigatório' using errcode = '22023';
  end if;
  if p_titulo is null or p_ativa is null or p_ordem is null or p_minimo_itens is null or p_limite_padrao is null then
    raise exception 'informe título, ativa, ordem, mínimo e limite' using errcode = '22023';
  end if;
  select * into v_antes from public.busca_home_secao where chave = p_chave for update;
  if not found then
    raise exception 'seção não encontrada' using errcode = 'P0002';
  end if;
  if v_titulo = v_antes.titulo and p_ativa = v_antes.ativa and p_ordem = v_antes.ordem
     and p_minimo_itens = v_antes.minimo_itens and p_limite_padrao = v_antes.limite_padrao then
    return;
  end if;
  -- As faixas e o formato do título são impostos pelos CHECKs (23514).
  update public.busca_home_secao
     set titulo = v_titulo, ativa = p_ativa, ordem = p_ordem, minimo_itens = p_minimo_itens, limite_padrao = p_limite_padrao
   where chave = p_chave;
  insert into public.administracao_auditoria (autor_id, acao, alvo_tabela, alvo_id, motivo, valor_anterior, valor_novo)
  select v_autor, 'home_secao_alterada', 'busca_home_secao', p_chave, v_motivo,
         to_jsonb(v_antes), to_jsonb(s)
  from public.busca_home_secao s where s.chave = p_chave;
end $$;
revoke all on function public.administracao_alterar_home_secao(text, text, boolean, integer, integer, integer, text) from public, anon;
grant execute on function public.administracao_alterar_home_secao(text, text, boolean, integer, integer, integer, text) to authenticated;
