-- pgTAP · seed das categorias iniciais (D-006) · IM-016
-- A migração 20261028100000 cria as 8 categorias; reexecutar é inofensivo e não grava auditoria.
begin;
select * from no_plan();

select is((select count(*)::int from public.catalogo_categoria), 8, 'a migração criou exatamente 8 categorias');
select is((select array_agg(nome order by ordem) from public.catalogo_categoria),
  array['Alimentação', 'Beleza e estética', 'Casa e construção', 'Saúde e bem-estar', 'Serviços profissionais', 'Veículos', 'Tecnologia', 'Outros'],
  'as 8 categorias da D-006, na ordem');
select is((select count(*)::int from public.catalogo_categoria where ativa), 8, 'todas ativas');
select is((select count(*)::int from public.administracao_auditoria), 0, 'o seed não grava auditoria');

-- Reexecuta o mesmo comando do seed: nada muda, nada falha. Se o administrador alterou uma categoria, o seed não desfaz.
update public.catalogo_categoria set ativa = false, ordem = 99 where slug = 'outros';
select lives_ok($$
  insert into public.catalogo_categoria (nome, slug, ordem) values
    ('Alimentação', 'alimentacao', 1),
    ('Beleza e estética', 'beleza-e-estetica', 2),
    ('Casa e construção', 'casa-e-construcao', 3),
    ('Saúde e bem-estar', 'saude-e-bem-estar', 4),
    ('Serviços profissionais', 'servicos-profissionais', 5),
    ('Veículos', 'veiculos', 6),
    ('Tecnologia', 'tecnologia', 7),
    ('Outros', 'outros', 8)
  on conflict do nothing$$, 'rodar o seed de novo não falha');
select is((select count(*)::int from public.catalogo_categoria), 8, 'continua com 8 categorias (sem duplicar)');
select is((select ativa from public.catalogo_categoria where slug = 'outros'), false, 'o seed não sobrescreve alteração do administrador');
select is((select ordem from public.catalogo_categoria where slug = 'outros'), 99, 'nem a ordem');
-- Conflito pelo nome com outro slug também é ignorado
select lives_ok($$insert into public.catalogo_categoria (nome, slug, ordem) values ('alimentação', 'alimentacao-2', 9) on conflict do nothing$$, 'nome repetido (caixa diferente) é ignorado');
select is((select count(*)::int from public.catalogo_categoria), 8, 'sem categoria duplicada por nome');
select is((select count(*)::int from public.administracao_auditoria), 0, 'reexecutar o seed continua sem auditoria');

-- Leitura pública das categorias ativas (para o filtro da página inicial)
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.catalogo_categoria), 7, 'anon vê as 7 ativas (a desativada fica de fora)');
reset role;

select * from finish();
rollback;
