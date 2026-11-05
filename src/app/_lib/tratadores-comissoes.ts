import type { ErroComissoes, ServicoComissoes } from "@/modules/comissoes";
import type { ContextoComissoes } from "./contexto-comissoes";
import {
  DEFINICOES_COMISSOES,
  camposVisiveis,
  errosDoFormulario,
  type ChaveComissoes,
  type DefinicaoComissoes,
} from "./definicoes-comissoes";
import { lerDeFormData } from "./entrada-conteudo";
import type { EstadoComissoes } from "./estado-comissoes";

/**
 * Tratadores da Fase 7 (IM-061 a IM-073). Só leem o formulário, chamam o serviço do módulo e transformam o resultado
 * em estado de tela. Nenhuma regra de negócio. Mensagens vêm do módulo, nunca do banco. Nenhuma ação cobra, repassa
 * ou paga: o administrador confirma tudo manualmente (IM-090).
 */

type Resultado = { ok: true; valor: unknown } | { ok: false; erro: ErroComissoes };

/** Cada chave chama a operação do serviço do módulo; a entrada já foi lida pela definição. */
const CHAMADAS: Record<
  ChaveComissoes,
  (s: ServicoComissoes, entrada: Record<string, unknown>) => Promise<Resultado>
> = {
  parametro: (s, e) => s.definirParametro(e),
  habilitacao: (s, e) => s.definirHabilitacao(e),
  vinculo: (s, e) => s.registrarVinculo(e),
  assinatura: (s, e) => s.registrarAssinatura(e),
  cancelarAssinatura: (s, e) => s.cancelarAssinatura(e),
  pagamento: (s, e) => s.confirmarPagamento(e),
  estorno: (s, e) => s.estornarPagamento(e),
  reversao: (s, e) => s.reverterComissao(e),
  repasse: (s, e) => s.avancarRepasse(e),
  encerrarVinculo: (s, e) => s.encerrarVinculo(e),
  oferta: (s, e) => s.criarOferta(e),
  percentual: (s, e) => s.alterarPercentualOferta(e),
  ofertaAtiva: (s, e) => s.definirOfertaAtiva(e),
};

function valoresDe(f: FormData): Record<string, string> {
  const v: Record<string, string> = {};
  f.forEach((x, k) => {
    if (typeof x === "string") v[k] = x;
  });
  return v;
}

function estadoDeErro(
  chave: ChaveComissoes,
  erro: ErroComissoes,
  valores: Record<string, string>,
): EstadoComissoes {
  const def: DefinicaoComissoes = DEFINICOES_COMISSOES[chave];
  if (erro.codigo === "CONFIRMACAO_NECESSARIA") {
    return { erro: erro.mensagem, valores, pedirConfirmacaoPaga: true };
  }
  const visiveis = camposVisiveis(chave);
  const doCampo = Object.entries(erro.campos ?? {}).filter(([k]) => visiveis.includes(k));
  if (doCampo.length > 0) return { erros: Object.fromEntries(doCampo), valores };
  if (erro.codigo === "VALIDACAO" && def.recusaDoBanco) {
    return { erros: { [def.recusaDoBanco.campo]: def.recusaDoBanco.mensagem }, valores };
  }
  return { erro: erro.mensagem, valores };
}

/**
 * Valida (mesmo schema do navegador), chama o serviço e devolve o estado do formulário. Os campos fixos da linha
 * (ids escondidos) vêm do próprio formulário e são revalidados pelo módulo.
 */
export async function tratarComissoes(
  ctx: ContextoComissoes,
  chave: ChaveComissoes,
  f: FormData,
): Promise<EstadoComissoes> {
  const ler = lerDeFormData(f);
  const valores = valoresDe(f);
  const erros = errosDoFormulario(chave, ler);
  if (erros) return { erros, valores };
  const entrada = DEFINICOES_COMISSOES[chave].ler(ler);
  const r = await CHAMADAS[chave](ctx.servico, entrada);
  return r.ok
    ? { sucesso: DEFINICOES_COMISSOES[chave].sucesso }
    : estadoDeErro(chave, r.erro, valores);
}
