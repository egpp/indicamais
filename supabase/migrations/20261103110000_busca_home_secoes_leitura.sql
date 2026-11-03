-- Fase 9 · módulo busca · leitura pública das seções em carrossel da home · IM-095, IM-019, IM-029, IM-041, IM-079, IM-080, IM-086, D-018
--
-- FUNÇÕES PÚBLICAS (anon e authenticated)
--   busca_home_secoes(p_cidade, p_uf)                     seções ATIVAS em ordem, com o total de candidatos e o sinal `o_exibir`
--                                                         (total >= mínimo da seção). A interface oculta quem vier com o_exibir = false.
--   busca_home_secao_perfis(p_chave, p_cidade, p_uf, p_limite)  os perfis da seção, já ordenados. Devolve ZERO linhas se a seção
--                                                         está inativa, tem menos candidatos que o mínimo ou (na_sua_cidade) falta cidade/UF.
--   Ambas são SECURITY DEFINER (precisam contar a Base de Relacionamento e o responsável, que nenhum cliente lê), mas devolvem
--   SOMENTE os campos de card já públicos na busca (busca_publica / perfis_perfil_publico) mais uma contagem agregada.
--   Nunca devolvem conta_id, responsavel_id, telefone, e-mail, nome de pessoa nem lista de pessoas (IM-029, IM-041, IM-050).
--   Não existe nome de pessoa no resultado, então a regra de nome reduzido (relacionamento_nome_publico) não se aplica aqui.
--   Execução interna: busca_home_candidatos (sem grant a nenhum papel de API).
--
-- CRITÉRIOS (D-018, IM-095). Elegível = perfil publicado, com versão aprovada e DISPONÍVEL (perfis_perfil_disponivel: exclui
-- conta suspensa, em carência de encerramento, anonimizada e perfil despublicado/oculto, IM-079/IM-080).
--   novidades       primeira aprovação do perfil (perfis_revisao, a mais antiga 'aprovada'; sem revisão, criação do perfil),
--                   mais recente primeiro. Editar um perfil já no ar NÃO o devolve às novidades.
--   mais_curtidos   nº de PESSOAS DISTINTAS com curtida ativa (relacionamento_membro.curtida_em), maior primeiro. Só perfis com >= 1.
--   mais_indicados  nº de PESSOAS DISTINTAS que indicaram com contato válido (relacionamento_membro.indicacoes_validas > 0),
--                   maior primeiro. Conta pessoas, não contatos, e não identifica ninguém. Quem saiu da base (IM-045) não conta.
--   na_sua_cidade   perfis com a cidade (comparação sem acento/maiúscula, busca_normalizar) e UF informadas. Ordem: pessoas
--                   distintas na base (curtiram ou indicaram) e, no empate, novidade. Sem cidade ou UF: nada (a seção não aparece).
--   em_alta_semana  pessoas DISTINTAS que curtiram ou fizeram indicação válida nos últimos 7 dias (curtida_em ou
--                   ultima_indicacao_em), maior primeiro. Só perfis com >= 1.
--   Todos os rankings: nunca contam o dono do perfil nem conta sem acesso (suspensa/anonimizada); empate por novidade e id.
--   O dono não consegue curtir o próprio perfil (D-013) e a autoindicação não é contato válido; o filtro é só defesa em profundidade.
--   Contagens vêm do estado ATUAL da base (quem descurtiu ou saiu deixa de contar); o histórico anônimo não é usado porque não
--   permite contar pessoas distintas.
--   A interface/servidor deve guardar o resultado em cache (atualização em intervalos, D-018), não consultar a cada visita.
--
-- ERROS: 22023 chave desconhecida, UF mal formada (como busca_publica).

-- Interna: candidatos já ordenados, até 50 por seção. Sem grant a papel de API.
create function public.busca_home_candidatos(p_chave text, p_cidade text, p_uf text)
returns table (
  o_posicao integer,
  o_id uuid,
  o_slug text,
  o_nome text,
  o_descricao text,
  o_imagem_path text,
  o_categoria_id uuid,
  o_categoria_nome text,
  o_categoria_slug text,
  o_cidade text,
  o_uf text,
  o_metrica bigint
) language plpgsql stable security definer set search_path = '' as $$
declare
  v_uf text := upper(btrim(coalesce(p_uf, '')));
  v_cidade text := public.busca_normalizar(left(coalesce(p_cidade, ''), 80));
  v_corte timestamptz := now() - interval '7 days';
begin
  if p_chave is null or p_chave not in ('novidades', 'mais_curtidos', 'mais_indicados', 'na_sua_cidade', 'em_alta_semana') then
    raise exception 'seção desconhecida' using errcode = '22023';
  end if;
  if v_uf <> '' and v_uf !~ '^[A-Z]{2}$' then
    raise exception 'UF inválida' using errcode = '22023';
  end if;
  if p_chave = 'na_sua_cidade' and (v_uf = '' or v_cidade = '') then
    return;
  end if;

  return query
  with base as (
    select p.id, p.slug, p.responsavel_id, v.nome, left(v.descricao_breve, 200) as descr, v.imagem_path,
           v.categoria_principal_id as cat, v.cidade, v.uf,
           coalesce((select min(r.decidida_em) from public.perfis_revisao r
                     where r.perfil_id = p.id and r.decisao = 'aprovada'), p.criado_em) as publicado_em
    from public.perfis_perfil p
    join public.perfis_perfil_versao v on v.id = p.versao_aprovada_id and v.situacao = 'aprovada'
    where p.publicado
      and public.perfis_perfil_disponivel(p.id)
      and (p_chave <> 'na_sua_cidade' or (v.uf = v_uf and public.busca_normalizar(v.cidade) = v_cidade))
  ), metrica as (
    select b.id,
           case p_chave
             when 'mais_curtidos' then count(m.conta_id) filter (where m.curtida_em is not null)
             when 'mais_indicados' then count(m.conta_id) filter (where m.indicacoes_validas > 0)
             when 'em_alta_semana' then count(m.conta_id) filter (where m.curtida_em >= v_corte or m.ultima_indicacao_em >= v_corte)
             when 'na_sua_cidade' then count(m.conta_id)
             else 0
           end as n
    from base b
    left join public.relacionamento_membro m
      on p_chave <> 'novidades'
     and m.perfil_id = b.id
     and m.conta_id <> b.responsavel_id
     and public.contas_acesso_permitido(m.conta_id)
    group by b.id
  )
  select (row_number() over (order by case when p_chave = 'novidades' then 0 else x.n end desc,
                                      b.publicado_em desc, b.id))::integer,
         b.id, b.slug, b.nome, b.descr, b.imagem_path, b.cat, c.nome, c.slug, b.cidade, b.uf,
         case when p_chave = 'novidades' then null::bigint else x.n end
  from base b
  join metrica x on x.id = b.id
  left join public.catalogo_categoria c on c.id = b.cat
  where p_chave in ('novidades', 'na_sua_cidade') or x.n > 0
  order by 1
  limit 50;
end $$;
revoke all on function public.busca_home_candidatos(text, text, text) from public, anon, authenticated;

-- Pública: as seções ativas e se cada uma deve aparecer.
create function public.busca_home_secoes(p_cidade text default null, p_uf text default null)
returns table (
  o_chave text,
  o_titulo text,
  o_ordem integer,
  o_tipo_item text,
  o_minimo_itens integer,
  o_limite_padrao integer,
  o_total_itens integer,
  o_exibir boolean
) language plpgsql stable security definer set search_path = '' as $$
begin
  return query
  select s.chave, s.titulo, s.ordem, s.tipo_item, s.minimo_itens, s.limite_padrao,
         t.n, t.n >= s.minimo_itens
  from public.busca_home_secao s
  cross join lateral (select count(*)::integer as n from public.busca_home_candidatos(s.chave, p_cidade, p_uf)) t
  where s.ativa
  order by s.ordem, s.chave;
end $$;

-- Pública: os perfis de UMA seção. Vazio quando a seção está inativa ou abaixo do mínimo.
create function public.busca_home_secao_perfis(
  p_chave text,
  p_cidade text default null,
  p_uf text default null,
  p_limite integer default null
) returns table (
  o_posicao integer,
  o_id uuid,
  o_slug text,
  o_nome text,
  o_descricao text,
  o_imagem_path text,
  o_categoria_id uuid,
  o_categoria_nome text,
  o_categoria_slug text,
  o_cidade text,
  o_uf text,
  o_metrica bigint
) language plpgsql stable security definer set search_path = '' as $$
declare
  v_minimo integer;
  v_padrao integer;
  v_limite integer;
begin
  if p_chave is null or p_chave not in ('novidades', 'mais_curtidos', 'mais_indicados', 'na_sua_cidade', 'em_alta_semana') then
    raise exception 'seção desconhecida' using errcode = '22023';
  end if;
  select s.minimo_itens, s.limite_padrao into v_minimo, v_padrao
  from public.busca_home_secao s where s.chave = p_chave and s.ativa;
  if not found then
    return;
  end if;
  v_limite := least(greatest(coalesce(p_limite, v_padrao), 1), 30);

  return query
  with c as materialized (select * from public.busca_home_candidatos(p_chave, p_cidade, p_uf))
  select c.o_posicao, c.o_id, c.o_slug, c.o_nome, c.o_descricao, c.o_imagem_path, c.o_categoria_id, c.o_categoria_nome,
         c.o_categoria_slug, c.o_cidade, c.o_uf, c.o_metrica
  from c
  where (select count(*) from c) >= v_minimo
  order by c.o_posicao
  limit v_limite;
end $$;

revoke all on function public.busca_home_secoes(text, text) from public;
revoke all on function public.busca_home_secao_perfis(text, text, text, integer) from public;
grant execute on function public.busca_home_secoes(text, text) to anon, authenticated;
grant execute on function public.busca_home_secao_perfis(text, text, text, integer) to anon, authenticated;
