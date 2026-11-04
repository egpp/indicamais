-- Fase 11 · módulo perfis · liberação inicial dos estilos de página 6 a 21 · IM-091, IM-100, IM-086, D-016, D-021
--
-- ATENÇÃO: arquivo escrito, NÃO aplicado. Aplicar primeiro no DESENVOLVIMENTO (D-003) por decisão do gestor.
--
-- O QUE FAZ
--   * Habilita (habilitado = true) os 16 estilos que nasceram desabilitados: os modelos 6 a 20 da lista de IM-091 e o
--     21º, moto_bike (D-021). Os 5 primeiros (minimalista, saude_bem_estar, beleza_estetica, gastronomia,
--     construcao_reformas) já estão habilitados desde D-016 e não mudam.
--   * Idempotente: o UPDATE só toca linhas listadas e ainda com habilitado = false; rodar de novo não muda nada e não
--     duplica auditoria (a auditoria sai das linhas realmente alteradas).
--   * Mudança de dados apenas: sem alterar tabela, política, função, gatilho ou privilégio. A RLS segue como está
--     (select público; insert/update/delete negados ao cliente). O gatilho de proteção só barra mudança de id, rótulo e
--     ordem e exclusão, então esta carga (habilitado) passa.
--   * Auditoria (IM-086): uma linha em administracao_auditoria por estilo liberado, igual à da RPC
--     perfis_admin_definir_estilo_habilitado (acao 'definir_estilo_habilitado', alvo 'perfis_estilo_pagina', valor
--     anterior {habilitado:false}, novo {habilitado:true}), com o motivo da aprovação.
--
-- AUTOR DA AUDITORIA: administracao_auditoria.autor_id é NOT NULL e referencia contas_conta; não existe conta "sistema" e
--   esta migração não cria uma (seria mudança de schema/decisão). Por isso o autor é a conta do administrador geral mais
--   antigo (administracao_administrador), que é o Emerson, quem aprovou a liberação. Se ainda não houver administrador
--   (banco novo, testes), os estilos são liberados e a auditoria é omitida: não há ação de pessoa a registrar.

with alvo as (
  update public.perfis_estilo_pagina e
     set habilitado = true
   where e.habilitado = false
     and e.id in (
       'cafe_padaria', 'automotivo', 'juridico_contabil', 'educacao_cursos', 'pet', 'moda_lojas', 'fitness_esportes',
       'imobiliario', 'tecnologia_assistencia', 'casa_decoracao', 'eventos_fotografia', 'servicos_rapidos', 'agro_campo',
       'turismo_hospedagem', 'premium', 'moto_bike')
  returning e.id
)
insert into public.administracao_auditoria (autor_id, acao, alvo_tabela, alvo_id, motivo, valor_anterior, valor_novo)
select (select a.conta_id from public.administracao_administrador a order by a.criado_em, a.conta_id limit 1),
       'definir_estilo_habilitado', 'perfis_estilo_pagina', alvo.id,
       'liberação inicial dos estilos 6 a 21, aprovada por Emerson em 04/11/2026',
       jsonb_build_object('habilitado', false), jsonb_build_object('habilitado', true)
from alvo
where exists (select 1 from public.administracao_administrador);
