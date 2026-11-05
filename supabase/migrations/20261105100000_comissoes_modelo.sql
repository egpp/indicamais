-- Fase 7 · módulo comissoes · modelo de dados · IM-061, IM-062, IM-063, IM-064, IM-065, IM-066, IM-068, IM-069, IM-070,
-- IM-071, IM-072, IM-073, IM-078, IM-086, IM-090, D-017, D-025
--
-- DESENHO (detalhes e perguntas em aberto em docs/fase7-desenho.md)
--   Negócio = perfil comercial (perfis_perfil). Valores em centavos inteiros (BRL); datas em UTC; mês de competência = dia 1.
--   Tudo é SÓ INSERÇÃO (inclusive para service_role), exceto o parâmetro (só o valor muda). Estado atual de habilitação,
--   oferta, repasse etc. é o ÚLTIMO evento. Reversão é lançamento novo que aponta o original (IM-073, IM-078).
--   Saldos e históricos são próprios: nenhuma tabela daqui toca pontos_*, relacionamento_* ou social (IM-065).
--
--   comissoes_parametro               prazo_inadimplencia_dias (padrão 60, IM-068/IM-072). Só o administrador altera.
--   comissoes_habilitacao_evento      habilitar/desabilitar o módulo por negócio (só administrador, IM-061).
--   comissoes_rede                    uma rede por negócio (IM-063).
--   comissoes_oferta / _percentual / _estado   ofertas recorrentes mensais do anunciante, percentual por oferta com
--                                     histórico (IM-062, IM-069); venda avulsa não existe no modelo.
--   comissoes_vinculo / _encerramento indicador -> cliente direto no negócio; sem níveis (IM-063); encerramento (IM-068).
--   comissoes_assinatura / _cancelamento  assinatura registrada manualmente pelo administrador (D-025).
--   comissoes_pagamento / _estorno    pagamento mensal confirmado manualmente (IM-070); estorno (IM-073).
--   comissoes_decisao                 uma por pagamento: gerou comissão ou não e por quê (IM-064, IM-066, IM-067).
--   comissoes_comissao / _estado      comissão gerada (percentual e base congelados, IM-069) e seu estado de repasse.
--   comissoes_lancamento              razão do saldo do indicador: comissao (+) e reversao (-) (IM-073, IM-078).
--
-- SEGURANÇA (IM-086): RLS ativa e forçada; política explícita nas quatro operações; escrita sempre negada ao cliente (só
-- funções SECURITY DEFINER escrevem); só o administrador lê as tabelas. Anunciante e indicador leem por visões com filtro
-- fixo por auth.uid() (migração de leitura), sem nome, telefone nem e-mail de cliente (IM-029, IM-041, IM-050).

-- Parâmetros -------------------------------------------------------------------------------------------------------
create table public.comissoes_parametro (
  chave text primary key,
  valor integer not null,
  minimo integer not null,
  maximo integer not null,
  descricao text not null,
  atualizado_em timestamptz not null default now(),
  constraint comissoes_parametro_chave check (char_length(chave) between 1 and 80),
  constraint comissoes_parametro_faixa check (minimo <= maximo and valor between minimo and maximo)
);
comment on table public.comissoes_parametro is 'Parâmetros do módulo comissoes (IM-068). Alterados só por comissoes_definir_parametro() (auditado). Próprios: não compartilhados com pontos (IM-065).';
insert into public.comissoes_parametro (chave, valor, minimo, maximo, descricao) values
  ('prazo_inadimplencia_dias', 60, 1, 365, 'Dias de inadimplência do indicador, contados do primeiro mês sem pagamento confirmado, até o administrador poder encerrar os vínculos (D-025).');

-- Habilitação por negócio (só inserção) -----------------------------------------------------------------------------
create table public.comissoes_habilitacao_evento (
  id bigint generated always as identity primary key,
  perfil_id uuid not null references public.perfis_perfil (id) on delete restrict,
  ativa boolean not null,
  origem text not null,
  motivo text not null,
  autor_id uuid not null references public.contas_conta (id) on delete restrict,
  criado_em timestamptz not null default now(),
  constraint comissoes_habilitacao_origem check (origem in ('espontanea', 'solicitacao')),
  constraint comissoes_habilitacao_motivo check (char_length(btrim(motivo)) between 1 and 500)
);
create index comissoes_habilitacao_perfil_idx on public.comissoes_habilitacao_evento (perfil_id, id desc);
comment on table public.comissoes_habilitacao_evento is 'Habilitação do módulo por negócio (IM-061). O estado atual é o último evento. Desativar não apaga nada (IM-073).';

-- Rede: uma por negócio (IM-063) --------------------------------------------------------------------------------------
create table public.comissoes_rede (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references public.perfis_perfil (id) on delete restrict,
  criada_por uuid not null references public.contas_conta (id) on delete restrict,
  criada_em timestamptz not null default now(),
  constraint comissoes_rede_perfil_unico unique (perfil_id),
  constraint comissoes_rede_id_perfil_unico unique (id, perfil_id)
);
comment on table public.comissoes_rede is 'Rede independente do negócio (IM-063). Uma conta pode estar em várias redes; cada rede é isolada.';

-- Ofertas recorrentes (IM-062) -------------------------------------------------------------------------------------
create table public.comissoes_oferta (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references public.perfis_perfil (id) on delete restrict,
  item_id uuid not null references public.catalogo_item (id) on delete restrict,
  nome text not null,
  periodicidade text not null default 'mensal',
  criada_por uuid not null references public.contas_conta (id) on delete restrict,
  criada_em timestamptz not null default now(),
  constraint comissoes_oferta_nome check (char_length(btrim(nome)) between 1 and 100),
  -- IM-062: só recorrente mensal; venda avulsa não é representável.
  constraint comissoes_oferta_so_recorrente check (periodicidade = 'mensal'),
  constraint comissoes_oferta_item_unico unique (perfil_id, item_id),
  constraint comissoes_oferta_id_perfil_unico unique (id, perfil_id)
);
comment on table public.comissoes_oferta is 'Produto/serviço recorrente do anunciante escolhido para comissão (IM-062). Sem venda avulsa. Nome não muda.';

create table public.comissoes_oferta_percentual (
  id bigint generated always as identity primary key,
  oferta_id uuid not null references public.comissoes_oferta (id) on delete restrict,
  percentual_bp integer not null,
  autor_id uuid not null references public.contas_conta (id) on delete restrict,
  criado_em timestamptz not null default now(),
  constraint comissoes_percentual_faixa check (percentual_bp between 1 and 10000)
);
create index comissoes_percentual_oferta_idx on public.comissoes_oferta_percentual (oferta_id, id desc);
comment on table public.comissoes_oferta_percentual is 'Histórico do percentual da oferta, em pontos-base (100 = 1%). O novo vale só para pagamentos futuros (IM-069, IM-073).';

create table public.comissoes_oferta_estado (
  id bigint generated always as identity primary key,
  oferta_id uuid not null references public.comissoes_oferta (id) on delete restrict,
  ativa boolean not null,
  autor_id uuid not null references public.contas_conta (id) on delete restrict,
  criado_em timestamptz not null default now()
);
create index comissoes_oferta_estado_idx on public.comissoes_oferta_estado (oferta_id, id desc);
comment on table public.comissoes_oferta_estado is 'Oferta ativa/inativa (último evento). Inativa bloqueia novas comissões da oferta.';

-- Vínculos indicador -> cliente direto (IM-063) -------------------------------------------------------------------
create table public.comissoes_vinculo (
  id uuid primary key default gen_random_uuid(),
  rede_id uuid not null,
  perfil_id uuid not null,
  indicador_id uuid not null references public.contas_conta (id) on delete restrict,
  cliente_id uuid not null references public.contas_conta (id) on delete restrict,
  criado_por uuid not null references public.contas_conta (id) on delete restrict,
  criado_em timestamptz not null default now(),
  constraint comissoes_vinculo_rede_fk foreign key (rede_id, perfil_id)
    references public.comissoes_rede (id, perfil_id) on delete restrict,
  constraint comissoes_vinculo_sem_autoindicacao check (indicador_id <> cliente_id),
  -- Cliente direto de UM indicador por negócio; nunca transferido (IM-069). Sem coluna de nível: mononível (IM-063).
  constraint comissoes_vinculo_cliente_unico unique (perfil_id, cliente_id)
);
create index comissoes_vinculo_indicador_idx on public.comissoes_vinculo (indicador_id, perfil_id);
comment on table public.comissoes_vinculo is 'Cliente direto do indicador no negócio. Sem níveis nem recrutamento (IM-063). cliente_id nunca é lido por indicador nem anunciante.';

create table public.comissoes_vinculo_encerramento (
  vinculo_id uuid primary key references public.comissoes_vinculo (id) on delete restrict,
  inadimplente_desde date not null,
  prazo_dias integer not null,
  motivo text not null,
  autor_id uuid not null references public.contas_conta (id) on delete restrict,
  criado_em timestamptz not null default now(),
  constraint comissoes_encerramento_prazo check (prazo_dias between 1 and 365),
  constraint comissoes_encerramento_motivo check (char_length(btrim(motivo)) between 1 and 500)
);
comment on table public.comissoes_vinculo_encerramento is 'Encerramento do vínculo para comissões futuras, só pelo administrador (IM-068). Sem restauração automática; histórico preservado.';

-- Assinaturas e pagamentos (registro manual, D-025) --------------------------------------------------------------
create table public.comissoes_assinatura (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null,
  oferta_id uuid not null,
  cliente_id uuid not null references public.contas_conta (id) on delete restrict,
  valor_centavos integer not null,
  inicio date not null,
  fim date,
  criada_por uuid not null references public.contas_conta (id) on delete restrict,
  criada_em timestamptz not null default now(),
  constraint comissoes_assinatura_oferta_fk foreign key (oferta_id, perfil_id)
    references public.comissoes_oferta (id, perfil_id) on delete restrict,
  constraint comissoes_assinatura_valor check (valor_centavos between 1 and 100000000),
  constraint comissoes_assinatura_vigencia check (fim is null or fim >= inicio),
  constraint comissoes_assinatura_unica unique (oferta_id, cliente_id, inicio)
);
create index comissoes_assinatura_cliente_idx on public.comissoes_assinatura (perfil_id, cliente_id);
comment on table public.comissoes_assinatura is 'Assinatura registrada manualmente pelo administrador (cliente, oferta, valor, vigência). Sem integração financeira (IM-070, IM-090).';

create table public.comissoes_assinatura_cancelamento (
  assinatura_id uuid primary key references public.comissoes_assinatura (id) on delete restrict,
  cancelada_em timestamptz not null default now(),
  motivo text not null,
  autor_id uuid not null references public.contas_conta (id) on delete restrict,
  constraint comissoes_cancelamento_motivo check (char_length(btrim(motivo)) between 1 and 500)
);
comment on table public.comissoes_assinatura_cancelamento is 'Cancelamento da assinatura: bloqueia comissões futuras; não apaga nem reverte o já gerado (a reversão é ação própria, IM-073).';

create table public.comissoes_pagamento (
  id uuid primary key default gen_random_uuid(),
  assinatura_id uuid not null references public.comissoes_assinatura (id) on delete restrict,
  competencia date not null,
  valor_centavos integer not null,
  confirmado_por uuid not null references public.contas_conta (id) on delete restrict,
  confirmado_em timestamptz not null default now(),
  constraint comissoes_pagamento_competencia check (extract(day from competencia) = 1),
  constraint comissoes_pagamento_valor check (valor_centavos between 1 and 100000000),
  -- IM-064: um pagamento por assinatura e mês; confirmar de novo não duplica.
  constraint comissoes_pagamento_unico unique (assinatura_id, competencia)
);
comment on table public.comissoes_pagamento is 'Mensalidade efetivamente paga, confirmada manualmente pelo administrador com auditoria (IM-064, IM-070).';

create table public.comissoes_pagamento_estorno (
  pagamento_id uuid primary key references public.comissoes_pagamento (id) on delete restrict,
  motivo text not null,
  autor_id uuid not null references public.contas_conta (id) on delete restrict,
  criado_em timestamptz not null default now(),
  constraint comissoes_estorno_motivo check (char_length(btrim(motivo)) between 1 and 500)
);
comment on table public.comissoes_pagamento_estorno is 'Estorno do pagamento (IM-073): o pagamento deixa de contar como pago; o original permanece.';

-- Decisão por pagamento, comissão e razão ---------------------------------------------------------------------------
create table public.comissoes_decisao (
  id bigint generated always as identity primary key,
  pagamento_id uuid not null references public.comissoes_pagamento (id) on delete restrict,
  vinculo_id uuid references public.comissoes_vinculo (id) on delete restrict,
  indicador_id uuid references public.contas_conta (id) on delete restrict,
  gerada boolean not null,
  motivo text not null,
  decidida_em timestamptz not null default now(),
  constraint comissoes_decisao_pagamento_unico unique (pagamento_id),
  constraint comissoes_decisao_motivo check (motivo in
    ('gerada', 'sem_vinculo', 'vinculo_encerrado', 'modulo_desativado', 'oferta_inativa', 'indicador_inadimplente', 'valor_zero')),
  constraint comissoes_decisao_coerente check (gerada = (motivo = 'gerada')
    and ((motivo = 'sem_vinculo') = (vinculo_id is null))
    and ((vinculo_id is null) = (indicador_id is null)))
);
comment on table public.comissoes_decisao is 'Uma linha por pagamento: gerou comissão ou não e por quê. Garante que regularização não gera comissão retroativa (IM-067).';

create table public.comissoes_comissao (
  id uuid primary key default gen_random_uuid(),
  pagamento_id uuid not null references public.comissoes_pagamento (id) on delete restrict,
  perfil_id uuid not null references public.perfis_perfil (id) on delete restrict,
  oferta_id uuid not null references public.comissoes_oferta (id) on delete restrict,
  vinculo_id uuid not null references public.comissoes_vinculo (id) on delete restrict,
  indicador_id uuid not null references public.contas_conta (id) on delete restrict,
  base_centavos integer not null,
  percentual_bp integer not null,
  valor_centavos integer not null,
  criada_em timestamptz not null default now(),
  -- IM-064: uma comissão por pagamento. IM-069: base e percentual vigentes ficam congelados na linha.
  constraint comissoes_comissao_pagamento_unico unique (pagamento_id),
  constraint comissoes_comissao_id_indicador_unico unique (id, indicador_id, perfil_id),
  constraint comissoes_comissao_base check (base_centavos between 1 and 100000000),
  constraint comissoes_comissao_percentual check (percentual_bp between 1 and 10000),
  constraint comissoes_comissao_valor check (valor_centavos >= 1 and valor_centavos = (base_centavos::bigint * percentual_bp / 10000))
);
create index comissoes_comissao_indicador_idx on public.comissoes_comissao (indicador_id, criada_em desc);
create index comissoes_comissao_perfil_idx on public.comissoes_comissao (perfil_id, criada_em desc);
comment on table public.comissoes_comissao is 'Comissão gerada por mensalidade paga. Valor = base x percentual vigente (arredondado para baixo), congelado (IM-069).';

create table public.comissoes_comissao_estado (
  id bigint generated always as identity primary key,
  comissao_id uuid not null references public.comissoes_comissao (id) on delete restrict,
  estado text not null,
  autor_id uuid not null references public.contas_conta (id) on delete restrict,
  motivo text,
  criado_em timestamptz not null default now(),
  constraint comissoes_estado_valido check (estado in ('gerada', 'pendente_repasse', 'paga')),
  constraint comissoes_estado_motivo check (motivo is null or char_length(motivo) <= 500),
  constraint comissoes_estado_unico unique (comissao_id, estado)
);
comment on table public.comissoes_comissao_estado is 'Estados gerada -> pendente de repasse -> paga (IM-064). Repasse é registro manual; nada é pago automaticamente (IM-070).';

create table public.comissoes_lancamento (
  id uuid primary key default gen_random_uuid(),
  indicador_id uuid not null references public.contas_conta (id) on delete restrict,
  perfil_id uuid not null references public.perfis_perfil (id) on delete restrict,
  comissao_id uuid not null,
  tipo text not null,
  valor_centavos integer not null,
  original_id uuid,
  causa text,
  motivo text,
  autor_id uuid references public.contas_conta (id) on delete restrict,
  confirmou_ja_paga boolean not null default false,
  criado_em timestamptz not null default now(),
  constraint comissoes_lancamento_comissao_fk foreign key (comissao_id, indicador_id, perfil_id)
    references public.comissoes_comissao (id, indicador_id, perfil_id) on delete restrict,
  constraint comissoes_lancamento_id_comissao_unico unique (id, comissao_id),
  constraint comissoes_lancamento_original_fk foreign key (original_id, comissao_id)
    references public.comissoes_lancamento (id, comissao_id) on delete restrict,
  constraint comissoes_lancamento_tipo check (tipo in ('comissao', 'reversao')),
  constraint comissoes_lancamento_comissao check (
    tipo <> 'comissao' or (valor_centavos > 0 and original_id is null and causa is null and motivo is null
      and not confirmou_ja_paga)),
  constraint comissoes_lancamento_reversao check (
    tipo <> 'reversao' or (valor_centavos < 0 and original_id is not null and autor_id is not null
      and causa in ('cancelamento', 'estorno', 'correcao')
      and motivo is not null and char_length(btrim(motivo)) between 1 and 500))
);
-- IM-064: uma comissão por pagamento (via comissao_id). IM-073: uma comissão só é revertida uma vez.
create unique index comissoes_lancamento_comissao_unico on public.comissoes_lancamento (comissao_id) where tipo = 'comissao';
create unique index comissoes_lancamento_reversao_unica on public.comissoes_lancamento (original_id) where original_id is not null;
create index comissoes_lancamento_indicador_idx on public.comissoes_lancamento (indicador_id, criado_em desc);
comment on table public.comissoes_lancamento is 'Razão do saldo de comissões do indicador (próprio, IM-065). Só inserção; reversão aponta o original (IM-073, IM-078). Saldo = soma.';

-- Privilégios, RLS e políticas (16 tabelas; escrita sempre negada ao cliente, leitura só do administrador) -------------
revoke all on public.comissoes_parametro from anon, authenticated;
grant select on public.comissoes_parametro to authenticated; -- só o administrador passa pela política
alter table public.comissoes_parametro enable row level security;
alter table public.comissoes_parametro force row level security;
revoke all on public.comissoes_habilitacao_evento from anon, authenticated;
grant select on public.comissoes_habilitacao_evento to authenticated; -- só o administrador passa pela política
alter table public.comissoes_habilitacao_evento enable row level security;
alter table public.comissoes_habilitacao_evento force row level security;
revoke all on public.comissoes_rede from anon, authenticated;
grant select on public.comissoes_rede to authenticated; -- só o administrador passa pela política
alter table public.comissoes_rede enable row level security;
alter table public.comissoes_rede force row level security;
revoke all on public.comissoes_oferta from anon, authenticated;
grant select on public.comissoes_oferta to authenticated; -- só o administrador passa pela política
alter table public.comissoes_oferta enable row level security;
alter table public.comissoes_oferta force row level security;
revoke all on public.comissoes_oferta_percentual from anon, authenticated;
grant select on public.comissoes_oferta_percentual to authenticated; -- só o administrador passa pela política
alter table public.comissoes_oferta_percentual enable row level security;
alter table public.comissoes_oferta_percentual force row level security;
revoke all on public.comissoes_oferta_estado from anon, authenticated;
grant select on public.comissoes_oferta_estado to authenticated; -- só o administrador passa pela política
alter table public.comissoes_oferta_estado enable row level security;
alter table public.comissoes_oferta_estado force row level security;
revoke all on public.comissoes_vinculo from anon, authenticated;
grant select on public.comissoes_vinculo to authenticated; -- só o administrador passa pela política
alter table public.comissoes_vinculo enable row level security;
alter table public.comissoes_vinculo force row level security;
revoke all on public.comissoes_vinculo_encerramento from anon, authenticated;
grant select on public.comissoes_vinculo_encerramento to authenticated; -- só o administrador passa pela política
alter table public.comissoes_vinculo_encerramento enable row level security;
alter table public.comissoes_vinculo_encerramento force row level security;
revoke all on public.comissoes_assinatura from anon, authenticated;
grant select on public.comissoes_assinatura to authenticated; -- só o administrador passa pela política
alter table public.comissoes_assinatura enable row level security;
alter table public.comissoes_assinatura force row level security;
revoke all on public.comissoes_assinatura_cancelamento from anon, authenticated;
grant select on public.comissoes_assinatura_cancelamento to authenticated; -- só o administrador passa pela política
alter table public.comissoes_assinatura_cancelamento enable row level security;
alter table public.comissoes_assinatura_cancelamento force row level security;
revoke all on public.comissoes_pagamento from anon, authenticated;
grant select on public.comissoes_pagamento to authenticated; -- só o administrador passa pela política
alter table public.comissoes_pagamento enable row level security;
alter table public.comissoes_pagamento force row level security;
revoke all on public.comissoes_pagamento_estorno from anon, authenticated;
grant select on public.comissoes_pagamento_estorno to authenticated; -- só o administrador passa pela política
alter table public.comissoes_pagamento_estorno enable row level security;
alter table public.comissoes_pagamento_estorno force row level security;
revoke all on public.comissoes_decisao from anon, authenticated;
grant select on public.comissoes_decisao to authenticated; -- só o administrador passa pela política
alter table public.comissoes_decisao enable row level security;
alter table public.comissoes_decisao force row level security;
revoke all on public.comissoes_comissao from anon, authenticated;
grant select on public.comissoes_comissao to authenticated; -- só o administrador passa pela política
alter table public.comissoes_comissao enable row level security;
alter table public.comissoes_comissao force row level security;
revoke all on public.comissoes_comissao_estado from anon, authenticated;
grant select on public.comissoes_comissao_estado to authenticated; -- só o administrador passa pela política
alter table public.comissoes_comissao_estado enable row level security;
alter table public.comissoes_comissao_estado force row level security;
revoke all on public.comissoes_lancamento from anon, authenticated;
grant select on public.comissoes_lancamento to authenticated; -- só o administrador passa pela política
alter table public.comissoes_lancamento enable row level security;
alter table public.comissoes_lancamento force row level security;

create policy comissoes_parametro_select_admin on public.comissoes_parametro
  for select to authenticated using ((select public.administracao_eh_admin()));
create policy comissoes_parametro_insert_negado on public.comissoes_parametro
  for insert to authenticated with check (false);
create policy comissoes_parametro_update_negado on public.comissoes_parametro
  for update to authenticated using (false) with check (false);
create policy comissoes_parametro_delete_negado on public.comissoes_parametro
  for delete to authenticated using (false);

create policy comissoes_habilitacao_evento_select_admin on public.comissoes_habilitacao_evento
  for select to authenticated using ((select public.administracao_eh_admin()));
create policy comissoes_habilitacao_evento_insert_negado on public.comissoes_habilitacao_evento
  for insert to authenticated with check (false);
create policy comissoes_habilitacao_evento_update_negado on public.comissoes_habilitacao_evento
  for update to authenticated using (false) with check (false);
create policy comissoes_habilitacao_evento_delete_negado on public.comissoes_habilitacao_evento
  for delete to authenticated using (false);

create policy comissoes_rede_select_admin on public.comissoes_rede
  for select to authenticated using ((select public.administracao_eh_admin()));
create policy comissoes_rede_insert_negado on public.comissoes_rede
  for insert to authenticated with check (false);
create policy comissoes_rede_update_negado on public.comissoes_rede
  for update to authenticated using (false) with check (false);
create policy comissoes_rede_delete_negado on public.comissoes_rede
  for delete to authenticated using (false);

create policy comissoes_oferta_select_admin on public.comissoes_oferta
  for select to authenticated using ((select public.administracao_eh_admin()));
create policy comissoes_oferta_insert_negado on public.comissoes_oferta
  for insert to authenticated with check (false);
create policy comissoes_oferta_update_negado on public.comissoes_oferta
  for update to authenticated using (false) with check (false);
create policy comissoes_oferta_delete_negado on public.comissoes_oferta
  for delete to authenticated using (false);

create policy comissoes_oferta_percentual_select_admin on public.comissoes_oferta_percentual
  for select to authenticated using ((select public.administracao_eh_admin()));
create policy comissoes_oferta_percentual_insert_negado on public.comissoes_oferta_percentual
  for insert to authenticated with check (false);
create policy comissoes_oferta_percentual_update_negado on public.comissoes_oferta_percentual
  for update to authenticated using (false) with check (false);
create policy comissoes_oferta_percentual_delete_negado on public.comissoes_oferta_percentual
  for delete to authenticated using (false);

create policy comissoes_oferta_estado_select_admin on public.comissoes_oferta_estado
  for select to authenticated using ((select public.administracao_eh_admin()));
create policy comissoes_oferta_estado_insert_negado on public.comissoes_oferta_estado
  for insert to authenticated with check (false);
create policy comissoes_oferta_estado_update_negado on public.comissoes_oferta_estado
  for update to authenticated using (false) with check (false);
create policy comissoes_oferta_estado_delete_negado on public.comissoes_oferta_estado
  for delete to authenticated using (false);

create policy comissoes_vinculo_select_admin on public.comissoes_vinculo
  for select to authenticated using ((select public.administracao_eh_admin()));
create policy comissoes_vinculo_insert_negado on public.comissoes_vinculo
  for insert to authenticated with check (false);
create policy comissoes_vinculo_update_negado on public.comissoes_vinculo
  for update to authenticated using (false) with check (false);
create policy comissoes_vinculo_delete_negado on public.comissoes_vinculo
  for delete to authenticated using (false);

create policy comissoes_vinculo_encerramento_select_admin on public.comissoes_vinculo_encerramento
  for select to authenticated using ((select public.administracao_eh_admin()));
create policy comissoes_vinculo_encerramento_insert_negado on public.comissoes_vinculo_encerramento
  for insert to authenticated with check (false);
create policy comissoes_vinculo_encerramento_update_negado on public.comissoes_vinculo_encerramento
  for update to authenticated using (false) with check (false);
create policy comissoes_vinculo_encerramento_delete_negado on public.comissoes_vinculo_encerramento
  for delete to authenticated using (false);

create policy comissoes_assinatura_select_admin on public.comissoes_assinatura
  for select to authenticated using ((select public.administracao_eh_admin()));
create policy comissoes_assinatura_insert_negado on public.comissoes_assinatura
  for insert to authenticated with check (false);
create policy comissoes_assinatura_update_negado on public.comissoes_assinatura
  for update to authenticated using (false) with check (false);
create policy comissoes_assinatura_delete_negado on public.comissoes_assinatura
  for delete to authenticated using (false);

create policy comissoes_assinatura_cancelamento_select_admin on public.comissoes_assinatura_cancelamento
  for select to authenticated using ((select public.administracao_eh_admin()));
create policy comissoes_assinatura_cancelamento_insert_negado on public.comissoes_assinatura_cancelamento
  for insert to authenticated with check (false);
create policy comissoes_assinatura_cancelamento_update_negado on public.comissoes_assinatura_cancelamento
  for update to authenticated using (false) with check (false);
create policy comissoes_assinatura_cancelamento_delete_negado on public.comissoes_assinatura_cancelamento
  for delete to authenticated using (false);

create policy comissoes_pagamento_select_admin on public.comissoes_pagamento
  for select to authenticated using ((select public.administracao_eh_admin()));
create policy comissoes_pagamento_insert_negado on public.comissoes_pagamento
  for insert to authenticated with check (false);
create policy comissoes_pagamento_update_negado on public.comissoes_pagamento
  for update to authenticated using (false) with check (false);
create policy comissoes_pagamento_delete_negado on public.comissoes_pagamento
  for delete to authenticated using (false);

create policy comissoes_pagamento_estorno_select_admin on public.comissoes_pagamento_estorno
  for select to authenticated using ((select public.administracao_eh_admin()));
create policy comissoes_pagamento_estorno_insert_negado on public.comissoes_pagamento_estorno
  for insert to authenticated with check (false);
create policy comissoes_pagamento_estorno_update_negado on public.comissoes_pagamento_estorno
  for update to authenticated using (false) with check (false);
create policy comissoes_pagamento_estorno_delete_negado on public.comissoes_pagamento_estorno
  for delete to authenticated using (false);

create policy comissoes_decisao_select_admin on public.comissoes_decisao
  for select to authenticated using ((select public.administracao_eh_admin()));
create policy comissoes_decisao_insert_negado on public.comissoes_decisao
  for insert to authenticated with check (false);
create policy comissoes_decisao_update_negado on public.comissoes_decisao
  for update to authenticated using (false) with check (false);
create policy comissoes_decisao_delete_negado on public.comissoes_decisao
  for delete to authenticated using (false);

create policy comissoes_comissao_select_admin on public.comissoes_comissao
  for select to authenticated using ((select public.administracao_eh_admin()));
create policy comissoes_comissao_insert_negado on public.comissoes_comissao
  for insert to authenticated with check (false);
create policy comissoes_comissao_update_negado on public.comissoes_comissao
  for update to authenticated using (false) with check (false);
create policy comissoes_comissao_delete_negado on public.comissoes_comissao
  for delete to authenticated using (false);

create policy comissoes_comissao_estado_select_admin on public.comissoes_comissao_estado
  for select to authenticated using ((select public.administracao_eh_admin()));
create policy comissoes_comissao_estado_insert_negado on public.comissoes_comissao_estado
  for insert to authenticated with check (false);
create policy comissoes_comissao_estado_update_negado on public.comissoes_comissao_estado
  for update to authenticated using (false) with check (false);
create policy comissoes_comissao_estado_delete_negado on public.comissoes_comissao_estado
  for delete to authenticated using (false);

create policy comissoes_lancamento_select_admin on public.comissoes_lancamento
  for select to authenticated using ((select public.administracao_eh_admin()));
create policy comissoes_lancamento_insert_negado on public.comissoes_lancamento
  for insert to authenticated with check (false);
create policy comissoes_lancamento_update_negado on public.comissoes_lancamento
  for update to authenticated using (false) with check (false);
create policy comissoes_lancamento_delete_negado on public.comissoes_lancamento
  for delete to authenticated using (false);

-- Histórico só de inserção: vale para qualquer papel, inclusive service_role e donos.
create trigger comissoes_habilitacao_evento_imutavel before update or delete on public.comissoes_habilitacao_evento
  for each row execute function public.administracao_registro_imutavel();
create trigger comissoes_rede_imutavel before update or delete on public.comissoes_rede
  for each row execute function public.administracao_registro_imutavel();
create trigger comissoes_oferta_imutavel before update or delete on public.comissoes_oferta
  for each row execute function public.administracao_registro_imutavel();
create trigger comissoes_oferta_percentual_imutavel before update or delete on public.comissoes_oferta_percentual
  for each row execute function public.administracao_registro_imutavel();
create trigger comissoes_oferta_estado_imutavel before update or delete on public.comissoes_oferta_estado
  for each row execute function public.administracao_registro_imutavel();
create trigger comissoes_vinculo_imutavel before update or delete on public.comissoes_vinculo
  for each row execute function public.administracao_registro_imutavel();
create trigger comissoes_vinculo_encerramento_imutavel before update or delete on public.comissoes_vinculo_encerramento
  for each row execute function public.administracao_registro_imutavel();
create trigger comissoes_assinatura_imutavel before update or delete on public.comissoes_assinatura
  for each row execute function public.administracao_registro_imutavel();
create trigger comissoes_assinatura_cancelamento_imutavel before update or delete on public.comissoes_assinatura_cancelamento
  for each row execute function public.administracao_registro_imutavel();
create trigger comissoes_pagamento_imutavel before update or delete on public.comissoes_pagamento
  for each row execute function public.administracao_registro_imutavel();
create trigger comissoes_pagamento_estorno_imutavel before update or delete on public.comissoes_pagamento_estorno
  for each row execute function public.administracao_registro_imutavel();
create trigger comissoes_decisao_imutavel before update or delete on public.comissoes_decisao
  for each row execute function public.administracao_registro_imutavel();
create trigger comissoes_comissao_imutavel before update or delete on public.comissoes_comissao
  for each row execute function public.administracao_registro_imutavel();
create trigger comissoes_comissao_estado_imutavel before update or delete on public.comissoes_comissao_estado
  for each row execute function public.administracao_registro_imutavel();
create trigger comissoes_lancamento_imutavel before update or delete on public.comissoes_lancamento
  for each row execute function public.administracao_registro_imutavel();

-- Parâmetro: chave e faixa não mudam; só o valor.
create function public.comissoes_parametro_proteger() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'parâmetro não é apagado' using errcode = '42501';
  end if;
  if new.chave <> old.chave or new.minimo <> old.minimo or new.maximo <> old.maximo then
    raise exception 'chave e faixa do parâmetro são imutáveis' using errcode = '42501';
  end if;
  new.atualizado_em := now();
  return new;
end $$;
revoke all on function public.comissoes_parametro_proteger() from public, anon, authenticated;
create trigger comissoes_parametro_proteger before update or delete on public.comissoes_parametro
  for each row execute function public.comissoes_parametro_proteger();

-- Defesa em profundidade no razão (vale para qualquer papel): lançamento coerente com a comissão e a reversão com o original.
create function public.comissoes_lancamento_validar() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  c public.comissoes_comissao%rowtype;
  o public.comissoes_lancamento%rowtype;
begin
  select * into c from public.comissoes_comissao where id = new.comissao_id;
  if not found then
    raise exception 'comissão inexistente' using errcode = '23503';
  end if;
  if new.tipo = 'comissao' and new.valor_centavos <> c.valor_centavos then
    raise exception 'o lançamento da comissão repete o valor congelado' using errcode = '23514';
  end if;
  if new.tipo = 'reversao' then
    select * into o from public.comissoes_lancamento where id = new.original_id;
    if not found or o.tipo <> 'comissao' then
      raise exception 'a reversão aponta o lançamento da comissão' using errcode = '23514';
    end if;
    if new.valor_centavos <> -o.valor_centavos then
      raise exception 'a reversão repete o valor da comissão com sinal contrário' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.comissoes_lancamento_validar() from public, anon, authenticated;
create trigger comissoes_lancamento_validar before insert on public.comissoes_lancamento
  for each row execute function public.comissoes_lancamento_validar();

-- Estados do repasse em ordem: gerada -> pendente_repasse -> paga; comissão revertida não avança.
create function public.comissoes_estado_validar() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.estado <> 'gerada' and exists (
    select 1 from public.comissoes_lancamento l where l.comissao_id = new.comissao_id and l.tipo = 'reversao') then
    raise exception 'comissão revertida não muda de estado' using errcode = 'P0001';
  end if;
  if new.estado = 'pendente_repasse' and not exists (
    select 1 from public.comissoes_comissao_estado e where e.comissao_id = new.comissao_id and e.estado = 'gerada') then
    raise exception 'pendente de repasse exige comissão gerada' using errcode = 'P0001';
  end if;
  if new.estado = 'paga' and not exists (
    select 1 from public.comissoes_comissao_estado e where e.comissao_id = new.comissao_id and e.estado = 'pendente_repasse') then
    raise exception 'paga exige estado pendente de repasse' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke all on function public.comissoes_estado_validar() from public, anon, authenticated;
create trigger comissoes_estado_validar before insert on public.comissoes_comissao_estado
  for each row execute function public.comissoes_estado_validar();
