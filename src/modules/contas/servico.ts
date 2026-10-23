import { atualizarWhatsappSchema, nomeExibicaoSchema } from "./schemas";
import { mapearErroBanco, type ErroBanco, type ErroConta } from "./erros";
import { MENSAGEM_CONTA_NAO_ENCONTRADA, MENSAGEM_ERRO_GENERICO } from "./mensagens";
import { podeIndicar, whatsappApresentavelComoVerificado } from "./regras";

export type Resultado<T> = { ok: true; valor: T } | { ok: false; erro: ErroConta };

/** Linha de public.contas_conta como o banco devolve. */
export type LinhaConta = {
  id: string;
  nome_exibicao: string | null;
  whatsapp_e164: string | null;
  whatsapp_verificado: boolean;
  criado_em: string;
  atualizado_em: string;
};

export type RespostaBanco<T> = { dados: T | null; erro: ErroBanco | null };

/**
 * Cliente de banco mínimo, injetado. A implementação (sessão do usuário via
 * supabase-js, nunca service_role) fica fora do módulo. O RLS restringe à
 * própria conta; `dados: null` sem erro significa nenhuma linha afetada.
 */
export interface ClienteBancoContas {
  buscarMinhaConta(): Promise<RespostaBanco<LinhaConta>>;
  atualizarMinhaConta(
    campos: Partial<Pick<LinhaConta, "nome_exibicao" | "whatsapp_e164">>,
  ): Promise<RespostaBanco<LinhaConta>>;
}

export type Conta = {
  id: string;
  nomeExibicao: string | null;
  whatsappE164: string | null;
  /** Sempre false nesta fase (IM-009/IM-010). */
  whatsappVerificado: false;
  podeIndicar: boolean;
};

export function paraConta(l: LinhaConta): Conta {
  return {
    id: l.id,
    nomeExibicao: l.nome_exibicao,
    whatsappE164: l.whatsapp_e164,
    whatsappVerificado: whatsappApresentavelComoVerificado(l),
    podeIndicar: podeIndicar({ whatsappE164: l.whatsapp_e164 }),
  };
}

const interno = (): ErroConta => ({ codigo: "ERRO_INTERNO", mensagem: MENSAGEM_ERRO_GENERICO });

function resolver(r: RespostaBanco<LinhaConta>): Resultado<Conta> {
  if (r.erro) return { ok: false, erro: mapearErroBanco(r.erro) };
  if (!r.dados) {
    return {
      ok: false,
      erro: { codigo: "NAO_ENCONTRADA", mensagem: MENSAGEM_CONTA_NAO_ENCONTRADA },
    };
  }
  return { ok: true, valor: paraConta(r.dados) };
}

async function seguro(f: () => Promise<RespostaBanco<LinhaConta>>): Promise<Resultado<Conta>> {
  try {
    return resolver(await f());
  } catch {
    return { ok: false, erro: interno() };
  }
}

function falhaValidacao(mensagem: string | undefined): Resultado<never> {
  return {
    ok: false,
    erro: { codigo: "VALIDACAO", mensagem: mensagem ?? MENSAGEM_ERRO_GENERICO },
  };
}

export function criarServicoContas(banco: ClienteBancoContas) {
  return {
    obterMinhaConta: () => seguro(() => banco.buscarMinhaConta()),

    async atualizarWhatsapp(entrada: unknown): Promise<Resultado<Conta>> {
      const p = atualizarWhatsappSchema.safeParse(entrada);
      if (!p.success) return falhaValidacao(p.error.issues[0]?.message);
      return seguro(() => banco.atualizarMinhaConta({ whatsapp_e164: p.data.whatsapp }));
    },

    async atualizarNomeExibicao(entrada: unknown): Promise<Resultado<Conta>> {
      const p = nomeExibicaoSchema.safeParse(entrada);
      if (!p.success) return falhaValidacao(p.error.issues[0]?.message);
      return seguro(() => banco.atualizarMinhaConta({ nome_exibicao: p.data }));
    },
  };
}

export type ServicoContas = ReturnType<typeof criarServicoContas>;
