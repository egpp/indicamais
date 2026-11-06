import type { ClienteBancoCicloVida } from "@/modules/administracao";
import type { ClienteBancoIndicacoes } from "@/modules/indicacoes";
import type { ErroBanco } from "@/shared/conteudo/resultado";
import { criarClienteServico } from "@/shared/supabase/servico";
import { criarBancoCicloVida } from "./banco-ciclo-vida";
import { criarBancoIndicacoes } from "./banco-indicacoes";

/**
 * Chamadas dos formulários públicos SEM LOGIN com a chave de serviço (D-034, decisão 2; S-03, M-01, M-03; IM-026,
 * IM-076, IM-086). `indicacoes_enviar_contato` e `administracao_denunciar` não são mais executáveis por anon: o
 * visitante só chega ao banco por aqui, DEPOIS de Turnstile e origem (HMAC) conferidos pela ação do servidor
 * (protecao-publica.ts). O cliente de serviço é criado só no instante da chamada, só nestas duas funções, só no
 * servidor, e nunca é devolvido nem registrado. Quem está logado segue pela sessão dele (o banco usa auth.uid()
 * para autoindicação, solicitante e denunciante; com a chave de serviço isso se perderia).
 * Chave ou URL ausentes: a chamada falha de forma controlada (código XX000), sem erro 500 e sem dizer o que falta.
 */
const FALHA: { dados: null; erro: ErroBanco } = { dados: null, erro: { code: "XX000" } };

export function enviarContatoViaServidor(
  a: Parameters<ClienteBancoIndicacoes["enviarContato"]>[0],
): ReturnType<ClienteBancoIndicacoes["enviarContato"]> {
  try {
    return criarBancoIndicacoes(criarClienteServico()).enviarContato(a);
  } catch {
    return Promise.resolve(FALHA);
  }
}

export function denunciarViaServidor(
  a: Parameters<ClienteBancoCicloVida["denunciar"]>[0],
): ReturnType<ClienteBancoCicloVida["denunciar"]> {
  try {
    return criarBancoCicloVida(criarClienteServico()).denunciar(a);
  } catch {
    return Promise.resolve({ erro: FALHA.erro });
  }
}
