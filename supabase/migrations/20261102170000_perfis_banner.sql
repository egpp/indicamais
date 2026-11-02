-- Fase 8 · módulo perfis · banner de topo rotativo · IM-093, IM-012, IM-022, IM-029, IM-079, IM-080, IM-086, D-016
--
-- MODELO
--   perfis_banner  uma linha por imagem do banner. Dois caminhos, ambos só por RPC (nenhum privilégio de escrita ao cliente):
--
--   (1) ORIGEM 'responsavel' (situacao 'na_versao'): o banner faz parte de uma VERSÃO do perfil (versao_id) e segue o fluxo
--       normal de revisão e versionamento (IM-022): editável só enquanto a versão é rascunho, imutável depois de enviada,
--       público só quando a versão é a aprovada do perfil. Toda nova versão em rascunho já nasce com cópia dos banners da
--       versão aprovada (gatilho), então editar o perfil não perde o banner e o banner aprovado segue no ar até a nova
--       versão ser aprovada. O responsável grava o conjunto inteiro do rascunho por perfis_gravar_banners() (substituição,
--       como perfis_gravar_versao).
--   (2) ORIGEM 'administrador' (D-016): quem tem a permissão 'aprovar' (o administrador geral tem todas) adiciona banner
--       na empresa selecionada por perfis_admin_adicionar_banner(). Nasce 'aguardando_aceite' e NÃO publica sozinho: só o
--       aceite do responsável (perfis_responder_banner) o torna 'aceito' (no ar). Recusa exige motivo. Ficam fora das
--       versões do perfil (não passam por revisão: o aceite do próprio responsável é a aprovação, como nos benefícios).
--       O responsável pode ocultar/exibir um banner aceito (perfis_definir_banner_ativo); o administrador pode retirar o
--       que ele mesmo adicionou, com motivo (perfis_admin_remover_banner). 'recusado' e 'removido' são finais.
--   Linha de banner nunca é apagada, exceto cópia de rascunho de responsável (rascunho é descartável). Banner de
--   administrador não é apagado: muda de situacao, e cada passo vai para administracao_auditoria (autor, data, motivo,
--   valor anterior), na mesma transação.
--
-- REGRAS (IM-012, IM-093)
--   * Imagem no bucket `indicamais-imagens` (2 MiB; jpeg/png/webp, imposto pelo Storage), caminho opaco da pasta do próprio
--     perfil: perfil/<perfil_id>/<arquivo>.<jpg|jpeg|png|webp>. Nunca contém id de conta (IM-029).
--   * Texto alternativo OBRIGATÓRIO (1 a 200 caracteres, acessibilidade).
--   * NÃO há link externo: o destino é só uma SEÇÃO da própria página (destino_secao), nunca uma URL. Sem redes sociais.
--   * Limite: no máximo 6 banners por conjunto publicável = banners da versão + banners de administrador aguardando aceite
--     ou aceitos. O administrador não consegue passar o limite da versão aprovada nem do rascunho em aberto.
--   * Público (anon incluído): só banner ATIVO, de perfil DISPONÍVEL (IM-079: publicado e conta com permissão de publicar,
--     então despublicar o perfil ou suspender a conta (IM-080) oculta os banners junto), e (origem responsável com a versão
--     aprovada do perfil) ou (origem administrador aceito), em ordem. Nada é apagado ao despublicar/suspender.
--   * O responsável vê todos os banners do próprio perfil (inclusive os aguardando aceite); o aprovador vê todos para
--     revisar. Nenhuma coluna de conta é legível por nenhum papel: o id do administrador autor (autor_admin_id) fica sem
--     SELECT; quem lê o autor é só a auditoria.
--   * Banner é conteúdo de marca: nunca carrega telefone, e-mail nem nome de visitante (IM-029, IM-041, IM-050).
--
-- CÓDIGOS DE ERRO (SQLSTATE)
--   42501  não autenticado / conta sem acesso / perfil ou banner que não é do usuário / administrador no próprio perfil
--   22023  motivo obrigatório / dados inválidos (lista, texto alternativo, destino, caminho)
--   23514  limite de 6 banners / caminho fora da pasta do perfil / campo fora das regras
--   23505  imagem repetida no mesmo conjunto
--   P0002  perfil ou banner inexistente / perfil indisponível
--   P0001  estado inválido (versão em análise não aceita edição; banner não está no estado esperado)

create table public.perfis_banner (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references public.perfis_perfil (id) on delete restrict,
  versao_id uuid,
  origem text not null,
  situacao text not null,
  imagem_path text not null,
  texto_alternativo text not null,
  destino_secao text,
  ordem integer not null default 1,
  ativo boolean not null default true,
  autor_admin_id uuid references public.contas_conta (id) on delete restrict,
  motivo_resposta text,
  respondido_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  -- A versão precisa ser do MESMO perfil (FK composta; nula nos banners de administrador).
  constraint perfis_banner_versao_fk foreign key (versao_id, perfil_id)
    references public.perfis_perfil_versao (id, perfil_id) on delete restrict,
  constraint perfis_banner_origem check (origem in ('responsavel', 'administrador')),
  constraint perfis_banner_situacao check (situacao in ('na_versao', 'aguardando_aceite', 'aceito', 'recusado', 'removido')),
  constraint perfis_banner_forma check (
    (origem = 'responsavel' and versao_id is not null and situacao = 'na_versao' and autor_admin_id is null)
    or (origem = 'administrador' and versao_id is null and situacao <> 'na_versao' and autor_admin_id is not null)),
  constraint perfis_banner_imagem check (
    imagem_path ~ ('^perfil/' || perfil_id::text || '/[A-Za-z0-9._-]{1,100}$')
    and imagem_path ~* '\.(jpe?g|png|webp)$'),
  constraint perfis_banner_texto check (char_length(btrim(texto_alternativo)) between 1 and 200),
  -- IM-012: nunca URL. Só as seções da própria página (IM-092).
  constraint perfis_banner_destino check (destino_secao is null or destino_secao in (
    'inicio', 'sobre', 'produtos_servicos', 'beneficios', 'localizacao', 'contato')),
  constraint perfis_banner_ordem check (ordem between 1 and 99),
  constraint perfis_banner_motivo check (
    (motivo_resposta is null or char_length(btrim(motivo_resposta)) between 1 and 500)
    and (situacao <> 'recusado' or motivo_resposta is not null))
);
create index perfis_banner_perfil_idx on public.perfis_banner (perfil_id, ordem, criado_em);
create index perfis_banner_versao_idx on public.perfis_banner (versao_id) where versao_id is not null;
create index perfis_banner_aguardando_idx on public.perfis_banner (perfil_id) where situacao = 'aguardando_aceite';
-- Idempotência: a mesma imagem não entra duas vezes no mesmo conjunto (reenvio do formulário).
create unique index perfis_banner_versao_imagem_unico on public.perfis_banner (versao_id, imagem_path) where versao_id is not null;
create unique index perfis_banner_admin_imagem_unico on public.perfis_banner (perfil_id, imagem_path)
  where origem = 'administrador' and situacao in ('aguardando_aceite', 'aceito');
comment on table public.perfis_banner is 'Banner rotativo do topo da página (IM-093). Escrita só por RPC; sem link externo (IM-012).';

-- Privilégios ----------------------------------------------------------------------------------------------------
revoke all on public.perfis_banner from anon, authenticated;
-- Anônimo: só o que o carrossel público precisa (as políticas já limitam as linhas). autor_admin_id sem SELECT para todos.
-- (versao_id, origem e situacao entram porque a visão e a política pública os consultam; não identificam ninguém.)
grant select (id, perfil_id, versao_id, origem, situacao, imagem_path, texto_alternativo, destino_secao, ordem, ativo, criado_em)
  on public.perfis_banner to anon;
grant select (id, perfil_id, versao_id, origem, situacao, imagem_path, texto_alternativo, destino_secao, ordem, ativo,
              motivo_resposta, respondido_em, criado_em, atualizado_em) on public.perfis_banner to authenticated;
alter table public.perfis_banner enable row level security;
alter table public.perfis_banner force row level security;

-- Políticas --------------------------------------------------------------------------------------------------------
create policy perfis_banner_select_publico on public.perfis_banner
  for select to anon, authenticated using (
    ativo
    and public.perfis_perfil_disponivel(perfil_id)
    and ((origem = 'responsavel' and exists (
            select 1 from public.perfis_perfil p
            where p.id = perfis_banner.perfil_id and p.versao_aprovada_id = perfis_banner.versao_id))
         or (origem = 'administrador' and situacao = 'aceito')));
create policy perfis_banner_select_proprio on public.perfis_banner
  for select to authenticated using ((select public.perfis_eh_dono(perfil_id)));
create policy perfis_banner_select_aprovador on public.perfis_banner
  for select to authenticated using ((select public.administracao_permitido('aprovar')));
create policy perfis_banner_insert_negado on public.perfis_banner
  for insert to authenticated with check (false);
create policy perfis_banner_update_negado on public.perfis_banner
  for update to authenticated using (false) with check (false);
create policy perfis_banner_delete_negado on public.perfis_banner
  for delete to authenticated using (false);

-- Conjunto atual de um perfil para o limite: banners da versão + banners de administrador vivos. Uso interno.
create function public.perfis_banner_total(p_perfil_id uuid, p_versao_id uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select (select count(*) from public.perfis_banner b where p_versao_id is not null and b.versao_id = p_versao_id)::int
       + (select count(*) from public.perfis_banner b
           where b.perfil_id = p_perfil_id and b.origem = 'administrador' and b.situacao in ('aguardando_aceite', 'aceito'))::int;
$$;
revoke all on function public.perfis_banner_total(uuid, uuid) from public, anon, authenticated;

-- Regras de integridade (valem também para service_role) -------------------------------------------------------------
create function public.perfis_banner_proteger() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_sit text;
  v_aprovada uuid;
  v_aberta uuid;
begin
  if tg_op = 'DELETE' then
    select v.situacao into v_sit from public.perfis_perfil_versao v where v.id = old.versao_id;
    if old.origem <> 'responsavel' or v_sit is distinct from 'rascunho' then
      raise exception 'banner enviado ou de administrador é histórico e não pode ser apagado' using errcode = '42501';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    perform pg_advisory_xact_lock(hashtextextended('perfis_banner:' || new.perfil_id::text, 0));
    if new.origem = 'responsavel' then
      select v.situacao into v_sit from public.perfis_perfil_versao v where v.id = new.versao_id;
      if v_sit is distinct from 'rascunho' then
        raise exception 'banner só entra em versão em rascunho' using errcode = '42501';
      end if;
      if public.perfis_banner_total(new.perfil_id, new.versao_id) >= 6 then
        raise exception 'limite de 6 banners' using errcode = '23514';
      end if;
    else
      if new.situacao <> 'aguardando_aceite' then
        raise exception 'banner de administrador nasce aguardando aceite do responsável' using errcode = '42501';
      end if;
      select p.versao_aprovada_id into v_aprovada from public.perfis_perfil p where p.id = new.perfil_id;
      select v.id into v_aberta from public.perfis_perfil_versao v
       where v.perfil_id = new.perfil_id and v.situacao in ('rascunho', 'pendente');
      if public.perfis_banner_total(new.perfil_id, null) >= 6
         or (v_aprovada is not null and public.perfis_banner_total(new.perfil_id, v_aprovada) >= 6)
         or (v_aberta is not null and public.perfis_banner_total(new.perfil_id, v_aberta) >= 6) then
        raise exception 'limite de 6 banners' using errcode = '23514';
      end if;
    end if;
    return new;
  end if;

  -- UPDATE
  if new.id <> old.id or new.perfil_id <> old.perfil_id or new.versao_id is distinct from old.versao_id
     or new.origem <> old.origem or new.autor_admin_id is distinct from old.autor_admin_id
     or new.criado_em <> old.criado_em or new.imagem_path <> old.imagem_path
     or new.texto_alternativo <> old.texto_alternativo or new.destino_secao is distinct from old.destino_secao
     or new.ordem <> old.ordem then
    raise exception 'conteúdo do banner é imutável' using errcode = '42501';
  end if;
  if old.origem = 'responsavel' then
    raise exception 'banner de versão não muda: grave o rascunho de novo' using errcode = '42501';
  end if;
  if old.situacao in ('recusado', 'removido') then
    raise exception 'banner % é final', old.situacao using errcode = '42501';
  end if;
  if new.situacao <> old.situacao and not (
       (old.situacao = 'aguardando_aceite' and new.situacao in ('aceito', 'recusado', 'removido'))
       or (old.situacao = 'aceito' and new.situacao = 'removido')) then
    raise exception 'transição inválida: % -> %', old.situacao, new.situacao using errcode = '42501';
  end if;
  if new.ativo <> old.ativo and not (old.situacao = 'aceito' and new.situacao = 'aceito') then
    raise exception 'só banner aceito pode ser ocultado ou exibido' using errcode = '42501';
  end if;
  new.atualizado_em := now();
  return new;
end $$;
revoke all on function public.perfis_banner_proteger() from public, anon, authenticated;
create trigger perfis_banner_proteger before insert or update or delete on public.perfis_banner
  for each row execute function public.perfis_banner_proteger();

-- Copia os banners do responsável de uma versão para outra (rascunho novo). Uso interno.
create function public.perfis_banner_copiar(p_de uuid, p_para uuid) returns void
language sql security definer set search_path = '' as $$
  insert into public.perfis_banner (perfil_id, versao_id, origem, situacao, imagem_path, texto_alternativo, destino_secao, ordem, ativo)
  select b.perfil_id, p_para, 'responsavel', 'na_versao', b.imagem_path, b.texto_alternativo, b.destino_secao, b.ordem, b.ativo
  from public.perfis_banner b
  where b.versao_id = p_de and b.origem = 'responsavel';
$$;
revoke all on function public.perfis_banner_copiar(uuid, uuid) from public, anon, authenticated;

-- Toda versão nova em rascunho herda os banners da versão aprovada do perfil (IM-022: a edição não perde o banner).
create function public.perfis_banner_herdar() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_aprovada uuid;
begin
  select p.versao_aprovada_id into v_aprovada from public.perfis_perfil p where p.id = new.perfil_id;
  if v_aprovada is not null and v_aprovada <> new.id then
    perform public.perfis_banner_copiar(v_aprovada, new.id);
  end if;
  return null;
end $$;
revoke all on function public.perfis_banner_herdar() from public, anon, authenticated;
create trigger perfis_banner_herdar after insert on public.perfis_perfil_versao
  for each row when (new.situacao = 'rascunho') execute function public.perfis_banner_herdar();

-- Garante o rascunho aberto do perfil e devolve o id. Sem versão aberta (perfil com versão aprovada ou rejeitada), cria um
-- rascunho com o conteúdo e o WhatsApp comercial da versão mais relevante (aprovada, senão a mais recente). Versão em análise
-- (pendente) recusa. Uso interno: o chamador já validou dono e acesso e travou o perfil.
create function public.perfis_banner_garantir_rascunho(p_perfil_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_ver uuid;
  v_sit text;
  v_fonte uuid;
  v_aprovada uuid;
  v_novo uuid;
begin
  select v.id, v.situacao into v_ver, v_sit from public.perfis_perfil_versao v
   where v.perfil_id = p_perfil_id and v.situacao in ('rascunho', 'pendente');
  if found then
    if v_sit = 'pendente' then
      raise exception 'há uma versão em análise' using errcode = 'P0001';
    end if;
    return v_ver;
  end if;
  select p.versao_aprovada_id into v_aprovada from public.perfis_perfil p where p.id = p_perfil_id;
  v_fonte := v_aprovada;
  if v_fonte is null then
    select v.id into v_fonte from public.perfis_perfil_versao v where v.perfil_id = p_perfil_id order by v.criado_em desc limit 1;
  end if;
  if v_fonte is null then
    raise exception 'perfil sem versão' using errcode = 'P0002';
  end if;
  insert into public.perfis_perfil_versao (perfil_id, nome, descricao_breve, imagem_path, categoria_principal_id,
    categoria_secundaria_1_id, categoria_secundaria_2_id, cidade, uf, endereco, areas_atendidas, banners_paths, fotos_paths,
    site, informacoes_sociais)
  select s.perfil_id, s.nome, s.descricao_breve, s.imagem_path, s.categoria_principal_id, s.categoria_secundaria_1_id,
         s.categoria_secundaria_2_id, s.cidade, s.uf, s.endereco, s.areas_atendidas, s.banners_paths, s.fotos_paths,
         s.site, s.informacoes_sociais
  from public.perfis_perfil_versao s where s.id = v_fonte
  returning id into v_novo;
  insert into public.perfis_perfil_versao_contato (versao_id, whatsapp_comercial_e164)
  select v_novo, c.whatsapp_comercial_e164 from public.perfis_perfil_versao_contato c where c.versao_id = v_fonte;
  -- Com versão aprovada o gatilho já copiou os banners; sem ela (fonte rejeitada) a cópia é explícita.
  if v_aprovada is null then
    perform public.perfis_banner_copiar(v_fonte, v_novo);
  end if;
  return v_novo;
end $$;
revoke all on function public.perfis_banner_garantir_rascunho(uuid) from public, anon, authenticated;

-- RPC do responsável: grava o conjunto de banners do rascunho -------------------------------------------------------
-- p_banners: array JSON de até 6 objetos {imagem_path, texto_alternativo, destino_secao?, ordem?, ativo?}. SUBSTITUI os
-- banners do rascunho (lista vazia = sem banners próprios). Devolve o id do rascunho. Segue para revisão quando o responsável
-- envia a versão (perfis_enviar_versao). Os banners de administrador não são tocados.
create function public.perfis_gravar_banners(p_perfil_id uuid, p_banners jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_ver uuid;
  e jsonb;
  v_pos integer := 0;
begin
  if v_uid is null or not public.contas_acesso_permitido(v_uid) then
    raise exception 'não autenticado ou conta sem acesso' using errcode = '42501';
  end if;
  if p_banners is null or jsonb_typeof(p_banners) <> 'array' then
    raise exception 'informe a lista de banners' using errcode = '22023';
  end if;
  if jsonb_array_length(p_banners) > 6 then
    raise exception 'limite de 6 banners' using errcode = '23514';
  end if;
  perform 1 from public.perfis_perfil p where p.id = p_perfil_id and p.responsavel_id = v_uid for update;
  if not found then
    raise exception 'perfil não encontrado' using errcode = '42501';
  end if;
  v_ver := public.perfis_banner_garantir_rascunho(p_perfil_id);
  delete from public.perfis_banner where versao_id = v_ver and origem = 'responsavel';
  for e in select x from jsonb_array_elements(p_banners) as t (x) loop
    v_pos := v_pos + 1;
    if jsonb_typeof(e) <> 'object' then
      raise exception 'banner inválido' using errcode = '22023';
    end if;
    insert into public.perfis_banner (perfil_id, versao_id, origem, situacao, imagem_path, texto_alternativo, destino_secao, ordem, ativo)
    values (p_perfil_id, v_ver, 'responsavel', 'na_versao', e ->> 'imagem_path', coalesce(e ->> 'texto_alternativo', ''),
            nullif(e ->> 'destino_secao', ''), coalesce((e ->> 'ordem')::integer, v_pos), coalesce((e ->> 'ativo')::boolean, true));
  end loop;
  return v_ver;
end $$;

-- RPC do responsável: aceitar ou recusar banner colocado pelo administrador (mesmo padrão dos benefícios). Aceitar ativa
-- (vai ao ar assim que o perfil estiver disponível); recusar exige motivo. Auditado com o responsável como autor.
create function public.perfis_responder_banner(p_banner_id uuid, p_aceitar boolean, p_motivo text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_motivo text := nullif(left(btrim(coalesce(p_motivo, '')), 500), '');
  v_sit text;
  v_perfil uuid;
begin
  if v_uid is null or not public.contas_acesso_permitido(v_uid) then
    raise exception 'não autenticado ou conta sem acesso' using errcode = '42501';
  end if;
  if p_aceitar is null then
    raise exception 'informe aceitar ou recusar' using errcode = '22023';
  end if;
  select b.situacao, b.perfil_id into v_sit, v_perfil
  from public.perfis_banner b join public.perfis_perfil p on p.id = b.perfil_id
  where b.id = p_banner_id and b.origem = 'administrador' and p.responsavel_id = v_uid
  for update of b;
  if not found then
    raise exception 'banner não encontrado' using errcode = '42501';
  end if;
  if v_sit <> 'aguardando_aceite' then
    raise exception 'só banner aguardando aceite pode ser respondido' using errcode = 'P0001';
  end if;
  if not p_aceitar and v_motivo is null then
    raise exception 'motivo obrigatório na recusa' using errcode = '22023';
  end if;
  update public.perfis_banner
     set situacao = case when p_aceitar then 'aceito' else 'recusado' end,
         motivo_resposta = case when p_aceitar then null else v_motivo end,
         respondido_em = now()
   where id = p_banner_id;
  insert into public.administracao_auditoria (autor_id, acao, alvo_tabela, alvo_id, motivo, valor_anterior, valor_novo)
  values (v_uid, case when p_aceitar then 'aceitar_banner' else 'recusar_banner' end, 'perfis_banner', p_banner_id::text, v_motivo,
          jsonb_build_object('situacao', v_sit, 'perfil_id', v_perfil),
          jsonb_build_object('situacao', case when p_aceitar then 'aceito' else 'recusado' end, 'perfil_id', v_perfil));
end $$;

-- RPC do responsável: oculta ou volta a exibir um banner de administrador já aceito.
create function public.perfis_definir_banner_ativo(p_banner_id uuid, p_ativo boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_sit text;
  v_antes boolean;
begin
  if v_uid is null or not public.contas_acesso_permitido(v_uid) then
    raise exception 'não autenticado ou conta sem acesso' using errcode = '42501';
  end if;
  if p_ativo is null then
    raise exception 'informe ativo ou inativo' using errcode = '22023';
  end if;
  select b.situacao, b.ativo into v_sit, v_antes
  from public.perfis_banner b join public.perfis_perfil p on p.id = b.perfil_id
  where b.id = p_banner_id and b.origem = 'administrador' and p.responsavel_id = v_uid
  for update of b;
  if not found then
    raise exception 'banner não encontrado' using errcode = '42501';
  end if;
  if v_sit <> 'aceito' then
    raise exception 'só banner aceito pode ser ocultado ou exibido' using errcode = 'P0001';
  end if;
  if v_antes = p_ativo then
    return;
  end if;
  update public.perfis_banner set ativo = p_ativo where id = p_banner_id;
  insert into public.administracao_auditoria (autor_id, acao, alvo_tabela, alvo_id, motivo, valor_anterior, valor_novo)
  values (v_uid, 'definir_banner_ativo', 'perfis_banner', p_banner_id::text, null,
          jsonb_build_object('ativo', v_antes), jsonb_build_object('ativo', p_ativo));
end $$;

-- RPC do aprovador: adiciona banner na empresa selecionada. NÃO publica: nasce aguardando aceite do responsável.
-- A imagem já deve estar na pasta do perfil (upload permitido ao aprovador). Perfil precisa estar disponível, ser de OUTRA
-- conta e ter vaga (máx. 6). Motivo obrigatório; auditoria na mesma transação.
create function public.perfis_admin_adicionar_banner(
  p_perfil_id uuid,
  p_imagem_path text,
  p_texto_alternativo text,
  p_motivo text,
  p_ordem integer default 1,
  p_destino_secao text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := public.administracao_exigir_permissao('aprovar');
  v_motivo text := nullif(left(btrim(coalesce(p_motivo, '')), 500), '');
  v_dono uuid;
  v_id uuid;
begin
  if v_motivo is null then
    raise exception 'motivo obrigatório' using errcode = '22023';
  end if;
  select p.responsavel_id into v_dono from public.perfis_perfil p where p.id = p_perfil_id;
  if not found or not public.perfis_perfil_disponivel(p_perfil_id) then
    raise exception 'perfil indisponível' using errcode = 'P0002';
  end if;
  if v_dono = v_admin then
    raise exception 'o responsável não decide o próprio conteúdo' using errcode = '42501';
  end if;
  insert into public.perfis_banner (perfil_id, origem, situacao, imagem_path, texto_alternativo, destino_secao, ordem, autor_admin_id)
  values (p_perfil_id, 'administrador', 'aguardando_aceite', p_imagem_path, coalesce(p_texto_alternativo, ''),
          nullif(p_destino_secao, ''), coalesce(p_ordem, 1), v_admin)
  returning id into v_id;
  insert into public.administracao_auditoria (autor_id, acao, alvo_tabela, alvo_id, motivo, valor_anterior, valor_novo)
  values (v_admin, 'adicionar_banner', 'perfis_banner', v_id::text, v_motivo, null,
          jsonb_build_object('perfil_id', p_perfil_id, 'situacao', 'aguardando_aceite', 'imagem_path', p_imagem_path,
                             'ordem', coalesce(p_ordem, 1)));
  return v_id;
end $$;

-- RPC do aprovador: retira o banner que um administrador adicionou (aguardando aceite ou aceito). Motivo obrigatório.
create function public.perfis_admin_remover_banner(p_banner_id uuid, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := public.administracao_exigir_permissao('aprovar');
  v_motivo text := nullif(left(btrim(coalesce(p_motivo, '')), 500), '');
  v_sit text;
  v_ativo boolean;
  v_perfil uuid;
begin
  if v_motivo is null then
    raise exception 'motivo obrigatório' using errcode = '22023';
  end if;
  select b.situacao, b.ativo, b.perfil_id into v_sit, v_ativo, v_perfil
  from public.perfis_banner b where b.id = p_banner_id and b.origem = 'administrador' for update;
  if not found then
    raise exception 'banner não encontrado' using errcode = 'P0002';
  end if;
  if v_sit not in ('aguardando_aceite', 'aceito') then
    raise exception 'banner já finalizado' using errcode = 'P0001';
  end if;
  update public.perfis_banner set situacao = 'removido' where id = p_banner_id;
  insert into public.administracao_auditoria (autor_id, acao, alvo_tabela, alvo_id, motivo, valor_anterior, valor_novo)
  values (v_admin, 'remover_banner', 'perfis_banner', p_banner_id::text, v_motivo,
          jsonb_build_object('situacao', v_sit, 'ativo', v_ativo, 'perfil_id', v_perfil),
          jsonb_build_object('situacao', 'removido'));
end $$;

revoke all on function public.perfis_gravar_banners(uuid, jsonb) from public, anon;
revoke all on function public.perfis_responder_banner(uuid, boolean, text) from public, anon;
revoke all on function public.perfis_definir_banner_ativo(uuid, boolean) from public, anon;
revoke all on function public.perfis_admin_adicionar_banner(uuid, text, text, text, integer, text) from public, anon;
revoke all on function public.perfis_admin_remover_banner(uuid, text) from public, anon;
grant execute on function public.perfis_gravar_banners(uuid, jsonb) to authenticated;
grant execute on function public.perfis_responder_banner(uuid, boolean, text) to authenticated;
grant execute on function public.perfis_definir_banner_ativo(uuid, boolean) to authenticated;
grant execute on function public.perfis_admin_adicionar_banner(uuid, text, text, text, integer, text) to authenticated;
grant execute on function public.perfis_admin_remover_banner(uuid, text) to authenticated;

-- Visões (todas security_invoker com filtro fixo; nenhuma coluna de conta) --------------------------------------------
-- Pública: só os banners no ar de perfil disponível, na ordem do carrossel.
create view public.perfis_banner_publico with (security_invoker = true) as
select b.id, b.perfil_id, b.imagem_path, b.texto_alternativo, b.destino_secao, b.ordem
from public.perfis_banner b
where b.ativo
  and public.perfis_perfil_disponivel(b.perfil_id)
  and ((b.origem = 'responsavel' and exists (
          select 1 from public.perfis_perfil p where p.id = b.perfil_id and p.versao_aprovada_id = b.versao_id))
       or (b.origem = 'administrador' and b.situacao = 'aceito'))
order by b.ordem, b.criado_em, b.id;
revoke all on public.perfis_banner_publico from anon, authenticated;
grant select on public.perfis_banner_publico to anon, authenticated;

-- Responsável: banners colocados pelo administrador que esperam a resposta dele.
create view public.perfis_banner_aguardando_aceite with (security_invoker = true) as
select b.id, b.perfil_id, b.imagem_path, b.texto_alternativo, b.destino_secao, b.ordem, b.ativo, b.criado_em
from public.perfis_banner b
where b.situacao = 'aguardando_aceite' and (select public.perfis_eh_dono(b.perfil_id))
order by b.criado_em, b.id;
revoke all on public.perfis_banner_aguardando_aceite from anon, authenticated;
grant select on public.perfis_banner_aguardando_aceite to authenticated;

-- Aprovador: todos os banners (revisão do rascunho enviado e acompanhamento dos que ele adicionou).
create view public.administracao_banners_empresa with (security_invoker = true) as
select b.id, b.perfil_id, b.versao_id, b.origem, b.situacao, b.imagem_path, b.texto_alternativo, b.destino_secao,
       b.ordem, b.ativo, b.motivo_resposta, b.respondido_em, b.criado_em
from public.perfis_banner b
where (select public.administracao_permitido('aprovar'))
order by b.perfil_id, b.ordem, b.criado_em, b.id;
revoke all on public.administracao_banners_empresa from anon, authenticated;
grant select on public.administracao_banners_empresa to authenticated;

-- Storage --------------------------------------------------------------------------------------------------------
-- O aprovador envia a imagem do banner para a pasta do perfil de OUTRA conta (perfil/<id>/<arquivo>), no máximo 30 objetos
-- por pasta (as imagens contam na cota de 100 do responsável). Só inserção: ele não troca nem apaga objetos de ninguém.
create function public.perfis_pasta_para_aprovador(p_nome text) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null
    and p_nome ~ '^perfil/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[A-Za-z0-9._-]{1,100}$'
    and public.administracao_permitido('aprovar')
    and exists (select 1 from public.perfis_perfil p
                where p.id = split_part(p_nome, '/', 2)::uuid and p.responsavel_id <> (select auth.uid()))
    and (select count(*) from storage.objects o
          where o.bucket_id = 'indicamais-imagens' and o.name like 'perfil/' || split_part(p_nome, '/', 2) || '/%') < 30;
$$;
revoke all on function public.perfis_pasta_para_aprovador(text) from public, anon;
grant execute on function public.perfis_pasta_para_aprovador(text) to authenticated;

create policy catalogo_imagens_insert_aprovador_banner on storage.objects
  for insert to authenticated
  with check (bucket_id = 'indicamais-imagens' and public.perfis_pasta_para_aprovador(name));

-- A imagem do banner no ar é pública; a de rascunho/pendente/aguardando aceite fica protegida contra exclusão. As funções
-- abaixo são as definições anteriores (20261024140000 e 20261028110000) acrescidas dos banners. CREATE OR REPLACE mantém grants.
create or replace function public.catalogo_imagem_publica(p_nome text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.perfis_perfil_publico v
    where v.imagem_path = p_nome or p_nome = any (v.banners_paths) or p_nome = any (v.fotos_paths)
  ) or exists (
    select 1 from public.catalogo_item_publico v where v.foto_path = p_nome
  ) or exists (
    select 1 from public.administracao_patrocinador_publico v where v.imagem_path = p_nome
  ) or exists (
    select 1 from public.perfis_banner_publico v where v.imagem_path = p_nome
  );
$$;

create or replace function public.catalogo_imagem_em_uso(p_nome text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.perfis_perfil_versao v
    left join public.perfis_perfil p on p.versao_aprovada_id = v.id
    where (v.situacao in ('rascunho', 'pendente') or p.id is not null)
      and (v.imagem_path = p_nome or p_nome = any (v.banners_paths) or p_nome = any (v.fotos_paths))
  ) or exists (
    select 1 from public.catalogo_item_versao v
    left join public.catalogo_item i on i.versao_aprovada_id = v.id
    where (v.situacao in ('rascunho', 'pendente') or i.id is not null)
      and v.foto_path = p_nome
  ) or exists (
    select 1 from public.perfis_banner b
    left join public.perfis_perfil_versao v on v.id = b.versao_id
    left join public.perfis_perfil p on p.versao_aprovada_id = b.versao_id
    where b.imagem_path = p_nome
      and ((b.origem = 'responsavel' and (v.situacao in ('rascunho', 'pendente') or p.id is not null))
           or (b.origem = 'administrador' and b.situacao in ('aguardando_aceite', 'aceito')))
  );
$$;
