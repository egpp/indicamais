import type { ZodError } from "zod";
import { errosPorCampo } from "@/shared/conteudo/zod-util";
import type {
  ErroBanco,
  RespostaBanco,
  Resultado as ResultadoBase,
} from "@/shared/conteudo/resultado";
import {
  erroAdm,
  mapearErroBancoPatrocinador,
  MENSAGENS_ADMINISTRACAO,
  type ErroAdministracao,
} from "./erros";
import {
  montarCarrossel,
  paraPatrocinadorAdmin,
  type LinhaPatrocinadorAdmin,
  type LinhaPatrocinadorPublico,
  type PatrocinadorAdmin,
  type PatrocinadorPublico,
} from "./patrocinador-modelos";
import {
  alterarPatrocinadorSchema,
  criarPatrocinadorSchema,
  definirPatrocinadorAtivoSchema,
} from "./patrocinador-schemas";

export type Resultado<T> = ResultadoBase<T, ErroAdministracao>;

/** Parâmetros de `administracao_criar_patrocinador` (nomes = parâmetros da função; datas em ISO UTC). */
export type ParamsCriarPatrocinador = {
  p_titulo: string;
  p_imagem_path: string;
  p_perfil_destino_id: string | null;
  p_texto_destino: string | null;
  p_ordem: number;
  p_ativo: boolean;
  p_inicio_em: string | null;
  p_fim_em: string | null;
  p_motivo: string | null;
  /** id gerado antes do upload da imagem: a pasta da imagem é patrocinador/<p_id>/. */
  p_id: string;
};

/** Parâmetros de `administracao_alterar_patrocinador` (substitui o conteúdo; motivo obrigatório). */
export type ParamsAlterarPatrocinador = {
  p_id: string;
  p_titulo: string;
  p_imagem_path: string;
  p_perfil_destino_id: string | null;
  p_texto_destino: string | null;
  p_ordem: number;
  p_inicio_em: string | null;
  p_fim_em: string | null;
  p_motivo: string;
};

/** Parâmetros de `administracao_definir_patrocinador_ativo`. */
export type ParamsDefinirPatrocinadorAtivo = {
  p_id: string;
  p_ativo: boolean;
  p_motivo: string;
};

/**
 * Banco injetado para patrocinadores (IM-020). Sessão do usuário (anon na página inicial; administrador no
 * painel), nunca service_role. As funções administrativas são OPCIONAIS no tipo: sem elas, o serviço falha
 * fechado (SEM_PERMISSAO). O banco confere o papel de novo em cada função e grava a auditoria.
 */
export interface ClienteBancoPatrocinadores {
  /**
   * select em administracao_patrocinador_publico (id, identificacao, titulo, imagem_path, destino_tipo,
   * destino_perfil_id, destino_perfil_slug, destino_texto, ordem), funciona para anon.
   */
  listarPublicos(): Promise<RespostaBanco<LinhaPatrocinadorPublico[]>>;
  /** rpc administracao_eh_admin (sem parâmetros; usa auth.uid()). Ausente = false. */
  ehAdministrador?(): Promise<boolean>;
  /**
   * select em administracao_patrocinador (todas as colunas; só o administrador vê as inativas e fora do
   * período, pela política `administracao_patrocinador_select_admin`).
   */
  listarTodos?(): Promise<RespostaBanco<LinhaPatrocinadorAdmin[]>>;
  /** rpc administracao_criar_patrocinador; devolve o uuid criado (igual a p_id). */
  criar?(p: ParamsCriarPatrocinador): Promise<{ id: string | null; erro: ErroBanco | null }>;
  /** rpc administracao_alterar_patrocinador. */
  alterar?(p: ParamsAlterarPatrocinador): Promise<{ erro: ErroBanco | null }>;
  /** rpc administracao_definir_patrocinador_ativo. */
  definirAtivo?(p: ParamsDefinirPatrocinadorAtivo): Promise<{ erro: ErroBanco | null }>;
}

const M = MENSAGENS_ADMINISTRACAO;
const falha = (erro: ErroAdministracao): { ok: false; erro: ErroAdministracao } => ({
  ok: false,
  erro,
});

export function criarServicoPatrocinadores(
  banco: ClienteBancoPatrocinadores,
  opcoes: { agora?: () => Date } = {},
) {
  const agora = opcoes.agora ?? (() => new Date());

  async function seguro<T>(f: () => Promise<Resultado<T>>): Promise<Resultado<T>> {
    try {
      return await f();
    } catch {
      return falha(erroAdm("ERRO_INTERNO", M.generica));
    }
  }

  /** Falha fechado: sem a checagem, sem a função ou com qualquer erro, não é administrador. */
  async function ehAdmin(): Promise<boolean> {
    if (!banco.ehAdministrador) return false;
    try {
      return (await banco.ehAdministrador()) === true;
    } catch {
      return false;
    }
  }

  const semPermissao = () => falha(erroAdm("SEM_PERMISSAO", M.semPermissao));

  function falhaValidacao(erro: ZodError) {
    const campos = errosPorCampo(erro);
    const motivoFaltando = "motivo" in campos;
    return falha(
      erroAdm(
        motivoFaltando ? "MOTIVO_OBRIGATORIO" : "VALIDACAO",
        Object.values(campos)[0] ?? M.dadosInvalidos,
        campos,
      ),
    );
  }

  return {
    /** Carrossel da página inicial: até 20, na ordem do administrador, sempre "Patrocinado". Público. */
    listarPatrocinadoresPublicos: (): Promise<Resultado<PatrocinadorPublico[]>> =>
      seguro(async () => {
        const r = await banco.listarPublicos();
        if (r.erro) return falha(mapearErroBancoPatrocinador(r.erro));
        return { ok: true, valor: montarCarrossel(r.dados ?? []) };
      }),

    /** Administrador: todos os patrocinadores, inclusive inativos e agendados. */
    listarPatrocinadoresAdmin: (): Promise<Resultado<PatrocinadorAdmin[]>> =>
      seguro(async () => {
        if (!banco.listarTodos || !(await ehAdmin())) return semPermissao();
        const r = await banco.listarTodos();
        if (r.erro) return falha(mapearErroBancoPatrocinador(r.erro));
        const agoraDt = agora();
        return {
          ok: true,
          valor: (r.dados ?? [])
            .map((l) => paraPatrocinadorAdmin(l, agoraDt))
            .sort((a, b) => a.ordem - b.ordem || a.criadoEm.localeCompare(b.criadoEm)),
        };
      }),

    criarPatrocinador: (entrada: unknown): Promise<Resultado<{ id: string }>> =>
      seguro(async () => {
        if (!banco.criar || !(await ehAdmin())) return semPermissao();
        const p = criarPatrocinadorSchema.safeParse(entrada);
        if (!p.success) return falhaValidacao(p.error);
        const d = p.data;
        const r = await banco.criar({
          p_titulo: d.titulo,
          p_imagem_path: d.imagemPath,
          p_perfil_destino_id: d.perfilDestinoId,
          p_texto_destino: d.textoDestino,
          p_ordem: d.ordem,
          p_ativo: d.ativo,
          p_inicio_em: d.inicioEm,
          p_fim_em: d.fimEm,
          p_motivo: d.motivo ?? null,
          p_id: d.id,
        });
        if (r.erro) return falha(mapearErroBancoPatrocinador(r.erro));
        return { ok: true, valor: { id: r.id ?? d.id } };
      }),

    /** Substitui o conteúdo. Motivo obrigatório (vai para a auditoria com o valor anterior). */
    alterarPatrocinador: (entrada: unknown): Promise<Resultado<{ id: string }>> =>
      seguro(async () => {
        if (!banco.alterar || !(await ehAdmin())) return semPermissao();
        const p = alterarPatrocinadorSchema.safeParse(entrada);
        if (!p.success) return falhaValidacao(p.error);
        const d = p.data;
        const r = await banco.alterar({
          p_id: d.id,
          p_titulo: d.titulo,
          p_imagem_path: d.imagemPath,
          p_perfil_destino_id: d.perfilDestinoId,
          p_texto_destino: d.textoDestino,
          p_ordem: d.ordem,
          p_inicio_em: d.inicioEm,
          p_fim_em: d.fimEm,
          p_motivo: d.motivo,
        });
        if (r.erro) return falha(mapearErroBancoPatrocinador(r.erro));
        return { ok: true, valor: { id: d.id } };
      }),

    /** Ativa ou desativa (não há exclusão: o histórico fica). Motivo obrigatório. */
    definirPatrocinadorAtivo: (entrada: unknown): Promise<Resultado<{ ativo: boolean }>> =>
      seguro(async () => {
        if (!banco.definirAtivo || !(await ehAdmin())) return semPermissao();
        const p = definirPatrocinadorAtivoSchema.safeParse(entrada);
        if (!p.success) return falhaValidacao(p.error);
        const d = p.data;
        const r = await banco.definirAtivo({ p_id: d.id, p_ativo: d.ativo, p_motivo: d.motivo });
        if (r.erro) return falha(mapearErroBancoPatrocinador(r.erro));
        return { ok: true, valor: { ativo: d.ativo } };
      }),
  };
}

export type ServicoPatrocinadores = ReturnType<typeof criarServicoPatrocinadores>;
