import { criarClienteServico, type CredenciaisServico } from "../supabase/servico";

/**
 * Rotinas agendadas (Cloudflare Cron Trigger), IM-081 e IM-086. Rodam no servidor com a chave de serviço
 * (via criarClienteServico). O Cron Trigger só chega ao handler `scheduled` do Worker: não há rota HTTP, então
 * ninguém de fora consegue disparar. O log registra só nomes e contagens, nunca dados de conta.
 */

/** Tentativas de denúncia mais antigas que isto são apagadas (a janela de limite é bem menor). */
export const RETENCAO_TENTATIVAS_DIAS = 30;
const LIMITE_LOTE = 50;

type Falha = { message?: string } | null;
/** Só o que as rotinas usam do cliente (permite teste sem rede). */
export type ClienteRotinas = {
  rpc(
    nome:
      | "contas_executar_encerramentos"
      | "pontos_reprocessar_pendentes"
      | "relacionamento_reprocessar_pendentes",
    args: { p_limite: number },
  ): PromiseLike<{ data: number | null; error: Falha }>;
  from(tabela: "administracao_denuncia_tentativa"): {
    delete(opcoes: { count: "exact" }): {
      lt(coluna: "criado_em", valor: string): PromiseLike<{ count: number | null; error: Falha }>;
    };
  };
};

export type ResultadoRotinas = Record<string, number | "falhou">;

export async function executarRotinas(
  cliente: ClienteRotinas,
  agora: Date = new Date(),
  registrar: (linha: string) => void = (l) => console.log(l),
): Promise<ResultadoRotinas> {
  const resultado: ResultadoRotinas = {};

  const rpc = async (nome: Parameters<ClienteRotinas["rpc"]>[0]): Promise<void> => {
    try {
      const { data, error } = await cliente.rpc(nome, { p_limite: LIMITE_LOTE });
      resultado[nome] = error || typeof data !== "number" ? "falhou" : data;
    } catch {
      resultado[nome] = "falhou";
    }
  };

  // Uma rotina que falha não impede as outras.
  await rpc("contas_executar_encerramentos");
  await rpc("pontos_reprocessar_pendentes");
  await rpc("relacionamento_reprocessar_pendentes");

  try {
    const corte = new Date(agora.getTime() - RETENCAO_TENTATIVAS_DIAS * 86_400_000).toISOString();
    const { count, error } = await cliente
      .from("administracao_denuncia_tentativa")
      .delete({ count: "exact" })
      .lt("criado_em", corte);
    resultado.limpeza_denuncia_tentativa = error || count === null ? "falhou" : count;
  } catch {
    resultado.limpeza_denuncia_tentativa = "falhou";
  }

  registrar(`[cron] ${JSON.stringify(resultado)}`);
  return resultado;
}

/** Ponto de entrada do Worker: cria o cliente de serviço com as credenciais do `env` do handler. */
export async function executarRotinasAgendadas(credenciais: CredenciaisServico) {
  const cliente = criarClienteServico(credenciais) as unknown as ClienteRotinas;
  return executarRotinas(cliente);
}
