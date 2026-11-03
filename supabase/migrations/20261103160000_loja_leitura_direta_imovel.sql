-- Fase 10 · módulo loja · fecha a leitura direta de imóvel sem Loja · IM-097, IM-098, IM-099, IM-029, IM-086 (D-020)
--
-- DEFEITO CORRIGIDO
--   A política catalogo_item_versao_select_publica (20261024130000) não conhecia a Loja: com a Loja RETIRADA e o imóvel ainda
--   publicado, anon e authenticated liam a versão aprovada direto na tabela (bairro, cidade, UF, campos do imóvel e
--   fotos_extras_paths). A 20261103150000 prometia "sem a Loja, o imóvel não tem leitura pública nenhuma".
--
-- DESENHO
--   * A política pública recriada exige: tipo <> 'imovel' OU Loja liberada do perfil do item.
--   * A checagem da Loja é uma subconsulta em loja_liberacao (sem chamar loja_ativa, que continua sem EXECUTE para papéis de
--     API). Anon e authenticated já têm SELECT nas colunas de loja_liberacao e a política pública dela só mostra Loja liberada
--     de perfil disponível (IM-079): para a leitura pública o resultado é o mesmo de loja_ativa.
--   * Dono, administrador e aprovador têm políticas próprias (select_propria, select_admin, select_aprovador) e seguem lendo
--     a versão mesmo sem a Loja; a retirada não despublica nem apaga nada (catalogo_item.publicado fica intacto).
--   * catalogo_item_publico não traz imóvel (i.tipo <> 'imovel') e loja_item_publico já exige a Loja: não mudam.
--   * catalogo_item_select_publico (tabela catalogo_item) só tem id, perfil_id, tipo e flags: não revela dado do imóvel; mantida.
--
-- LIMITE CONHECIDO (decisão para o gestor)
--   fotos_extras_paths de item de PRODUTO/SERVIÇO continua legível na tabela mesmo com a Loja retirada: esconder a coluna por
--   linha exigiria tirar o produto do catálogo simples, o que despublicaria (contra D-020/IM-099). São só caminhos opacos; a
--   imagem em si segue bloqueada no Storage (catalogo_imagem_publica só a libera pela visão da Loja).

drop policy catalogo_item_versao_select_publica on public.catalogo_item_versao;
create policy catalogo_item_versao_select_publica on public.catalogo_item_versao
  for select to anon, authenticated using (
    situacao = 'aprovada' and exists (
      select 1 from public.catalogo_item i
      where i.id = item_id and i.versao_aprovada_id = catalogo_item_versao.id and i.publicado
        and (i.perfil_id is null or public.perfis_perfil_disponivel(i.perfil_id))
        and (i.tipo <> 'imovel' or exists (
          select 1 from public.loja_liberacao l where l.perfil_id = i.perfil_id and l.liberada))));
