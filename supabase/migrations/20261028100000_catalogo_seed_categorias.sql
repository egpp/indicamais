-- Fase 2C-1 · seed das categorias iniciais (D-006) · IM-016
-- Idempotente: `on conflict do nothing` (sem alvo) ignora conflito de slug OU de nome (índice único em lower(btrim(nome))).
-- No dev elas já existem (inseridas por SQL manual); a migração serve para os demais ambientes.
-- Não grava auditoria: é carga inicial de migração, não ação de administrador. O administrador gerencia a lista depois
-- (catalogo_criar_categoria / catalogo_alterar_categoria). Roda como dono da migração (ignora RLS).
insert into public.catalogo_categoria (nome, slug, ordem) values
  ('Alimentação', 'alimentacao', 1),
  ('Beleza e estética', 'beleza-e-estetica', 2),
  ('Casa e construção', 'casa-e-construcao', 3),
  ('Saúde e bem-estar', 'saude-e-bem-estar', 4),
  ('Serviços profissionais', 'servicos-profissionais', 5),
  ('Veículos', 'veiculos', 6),
  ('Tecnologia', 'tecnologia', 7),
  ('Outros', 'outros', 8)
on conflict do nothing;
