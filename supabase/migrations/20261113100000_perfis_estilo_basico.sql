-- Fase 17 · módulo perfis · 22º estilo de página "Básico" e novo padrão dos sites NOVOS · IM-110, IM-092, IM-094, D-040
--
-- ATENÇÃO: arquivo escrito, NÃO aplicado. Aplicar primeiro no DESENVOLVIMENTO (D-003), só com "aprovado" do Emerson.
--
-- O QUE FAZ
--   * Amplia a restrição de ids de perfis_estilo_pagina para aceitar 'basico' (os 21 ids anteriores seguem iguais).
--   * Insere o estilo habilitado = true, ordem 22 (decisão A do Emerson, 13/11/2026: sites novos nascem com 'basico').
--   * Troca o DEFAULT de perfis_perfil.estilo_pagina para 'basico'. ALTER ... SET DEFAULT não reescreve linhas:
--     todo perfil existente mantém o estilo que já tem (inclusive os que nunca escolheram e estão em 'minimalista').
--   * Sem política, função ou visão novas: a RLS do catálogo (select público; escrita negada ao cliente) segue valendo
--     e o gatilho de proteção só barra UPDATE/DELETE. A visão pública continua caindo para 'minimalista' (sempre
--     habilitado) se um estilo for recolhido; 'minimalista' segue como único estilo que não pode ser desabilitado.

alter table public.perfis_estilo_pagina drop constraint perfis_estilo_pagina_id;
alter table public.perfis_estilo_pagina add constraint perfis_estilo_pagina_id check (id in (
  'minimalista', 'saude_bem_estar', 'beleza_estetica', 'gastronomia', 'cafe_padaria', 'construcao_reformas',
  'automotivo', 'juridico_contabil', 'educacao_cursos', 'pet', 'moda_lojas', 'fitness_esportes', 'imobiliario',
  'tecnologia_assistencia', 'casa_decoracao', 'eventos_fotografia', 'servicos_rapidos', 'agro_campo',
  'turismo_hospedagem', 'premium', 'moto_bike', 'basico'));

-- A linha precisa existir antes do default, pois perfis_perfil.estilo_pagina referencia o catálogo.
insert into public.perfis_estilo_pagina (id, rotulo, ordem, habilitado) values
  ('basico', 'Básico', 22, true);

alter table public.perfis_perfil alter column estilo_pagina set default 'basico';

comment on table public.perfis_estilo_pagina is 'Catálogo dos estilos de página (IM-091, IM-100, IM-110: 22 até aqui). `habilitado` libera estilos sem nova migração de schema.';
