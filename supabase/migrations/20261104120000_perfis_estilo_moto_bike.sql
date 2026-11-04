-- Fase 11 · módulo perfis · 21º estilo de página "Moto e Bike" · IM-100, IM-091, D-021
--
-- ATENÇÃO: arquivo escrito, NÃO aplicado. Aplicar primeiro no DESENVOLVIMENTO (D-003) por decisão do gestor.
--
-- O QUE FAZ
--   * Amplia a restrição de ids de perfis_estilo_pagina para aceitar 'moto_bike' (os 20 ids anteriores seguem iguais).
--   * Insere o estilo com habilitado = false: o administrador geral o libera depois pela RPC
--     perfis_admin_definir_estilo_habilitado (com motivo e auditoria), sem nova migração.
--   * Nenhuma política, função ou visão muda: a RLS já cobre a tabela (select público; insert/update/delete negados
--     ao cliente) e o gatilho de proteção só barra UPDATE/DELETE, não esta carga feita pela migração.
--
-- PARA OS PRÓXIMOS ESTILOS (D-021): repetir este padrão (soltar a restrição e recriá-la com o id novo; inserir com
-- habilitado = false e a próxima `ordem`). Se virar rotina, trocar a restrição por checagem de formato do id.

alter table public.perfis_estilo_pagina drop constraint perfis_estilo_pagina_id;
alter table public.perfis_estilo_pagina add constraint perfis_estilo_pagina_id check (id in (
  'minimalista', 'saude_bem_estar', 'beleza_estetica', 'gastronomia', 'cafe_padaria', 'construcao_reformas',
  'automotivo', 'juridico_contabil', 'educacao_cursos', 'pet', 'moda_lojas', 'fitness_esportes', 'imobiliario',
  'tecnologia_assistencia', 'casa_decoracao', 'eventos_fotografia', 'servicos_rapidos', 'agro_campo',
  'turismo_hospedagem', 'premium', 'moto_bike'));

insert into public.perfis_estilo_pagina (id, rotulo, ordem, habilitado) values
  ('moto_bike', 'Moto e Bike', 21, false);

comment on table public.perfis_estilo_pagina is 'Catálogo dos estilos de página (IM-091, IM-100: 21 até aqui). `habilitado` libera estilos sem nova migração de schema.';
