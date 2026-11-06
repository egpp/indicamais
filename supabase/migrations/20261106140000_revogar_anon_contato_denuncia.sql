-- D-034, decisão 2 (S-03, M-01, M-03; IM-026, IM-076, IM-086): o contato do visitante e a denúncia pública deixam de
-- ser chamáveis por anon. Passam a ser chamados pela ação do servidor, DEPOIS do Turnstile e do cálculo da origem
-- (HMAC), com a chave de serviço só nessa chamada (src/app/_lib/chamada-publica-servidor.ts).
--
-- authenticated MANTÉM o EXECUTE: quem está logado chama com a sessão dele, e o banco usa auth.uid() para solicitante,
-- denunciante, autoindicação suspeita e bloqueio de conta suspensa (com a chave de serviço isso se perderia). A
-- ação do servidor também confere o Turnstile para quem está logado.
--
-- ORDEM DE IMPLANTAÇÃO: publicar o código novo ANTES desta migração. O código novo funciona antes e depois dela
-- (a chave de serviço já podia chamar as funções); o código ANTIGO, depois dela, deixa o visitante sem contato.
-- Exige SUPABASE_SERVICE_ROLE_KEY no Worker/servidor (o cron já a usa).
--
-- Lição D1: nenhuma visão, função ou gatilho do banco chama estas duas funções (conferido por busca nas migrações);
-- se uma visão ou função passar a chamá-las em nome de anon, o EXECUTE revogado faria a consulta falhar.

revoke all on function public.indicacoes_enviar_contato(uuid, uuid, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.indicacoes_enviar_contato(uuid, uuid, text, text, text, text, text, text, text) to authenticated, service_role;

revoke all on function public.administracao_denunciar(text, uuid, text, text, text, text) from public, anon;
grant execute on function public.administracao_denunciar(text, uuid, text, text, text, text) to authenticated, service_role;
