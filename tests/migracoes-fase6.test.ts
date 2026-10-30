import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Varredura estática da Fase 6 (IM-076, IM-077, IM-078, IM-080, IM-081, IM-086, D-014): permissões granulares, denúncias,
 * suspensão, encerramento e invalidação de indicação. Complementa o pgTAP (banco real, no CI): aqui só se confere o TEXTO.
 */
const DIR = join(process.cwd(), "supabase", "migrations");
const arquivos = readdirSync(DIR).filter((n) => n.endsWith(".sql"));
const semComentario = (t: string) => t.replace(/--.*$/gm, "");
const ler = (nome: RegExp) =>
  semComentario(
    arquivos
      .filter((n) => nome.test(n))
      .map((n) => readFileSync(join(DIR, n), "utf8"))
      .join("\n"),
  );
const todas = semComentario(arquivos.map((n) => readFileSync(join(DIR, n), "utf8")).join("\n"));

const permissoes = ler(/administracao_permissoes/);
const denuncias = ler(/administracao_denuncias/);
const suspensao = ler(/administracao_suspensao_reativacao/);
const ciclo = ler(/contas_ciclo_vida_base/);
const encerramento = ler(/contas_encerramento/);
const invalidar = ler(/administracao_invalidar_indicacao/);

/** Corpo da ÚLTIMA definição (create ou create or replace) da função. */
const corpo = (texto: string, nome: string) =>
  [
    ...texto.matchAll(
      new RegExp(`create (?:or replace )?function public\\.${nome}\\(([\\s\\S]*?)\\$\\$;`, "gi"),
    ),
  ]
    .map((m) => m[0])
    .at(-1) ?? "";

describe("Fase 6: permissões granulares (IM-077)", () => {
  const LISTA = [
    "aprovar",
    "gerir_categorias",
    "analisar_denuncias",
    "invalidar_indicacoes",
    "reverter_pontos",
    "suspender",
  ];

  it("a tabela só aceita as seis permissões do IM-077", () => {
    for (const p of LISTA) expect(permissoes).toContain(`'${p}'`);
    expect(permissoes).toMatch(/administracao_permissao_valida check \(permissao in \(/);
  });

  it("toda função que chama administracao_exigir_admin() declara a permissão exigida (fail-closed se faltar)", () => {
    const nomes = new Set<string>();
    for (const m of todas.matchAll(
      /create (?:or replace )?function public\.(\w+)\(([\s\S]*?)\$\$;/gi,
    )) {
      if (/administracao_exigir_admin\(\)/.test(m[0]) && m[1] !== "administracao_exigir_admin") {
        nomes.add(m[1]!);
      }
    }
    expect(nomes.size).toBeGreaterThan(20);
    for (const n of nomes) {
      expect(todas, `${n} sem ALTER FUNCTION ... SET indicamais.permissao_exigida`).toMatch(
        new RegExp(
          `alter function public\\.${n}\\([^)]*\\)\\s+set indicamais\\.permissao_exigida = '(geral|${LISTA.join("|")})'`,
          "i",
        ),
      );
    }
  });

  it("cada RPC existente exige a permissão específica certa", () => {
    const esperado: Record<string, string> = {
      perfis_decidir_versao: "aprovar",
      catalogo_decidir_item_versao: "aprovar",
      pontos_decidir_beneficio_versao: "aprovar",
      pontos_admin_cadastrar_beneficio: "aprovar",
      pontos_admin_editar_proposta_beneficio: "aprovar",
      pontos_admin_definir_beneficio_ativo: "aprovar",
      catalogo_criar_categoria: "gerir_categorias",
      catalogo_alterar_categoria: "gerir_categorias",
      catalogo_decidir_solicitacao: "gerir_categorias",
      pontos_reverter_credito: "reverter_pontos",
      pontos_reprocessar_pedido: "reverter_pontos",
      pontos_definir_parametro: "geral",
    };
    for (const [fn, perm] of Object.entries(esperado)) {
      expect(permissoes, fn).toMatch(
        new RegExp(
          `alter function public\\.${fn}\\([^)]*\\)\\s+set indicamais\\.permissao_exigida = '${perm}'`,
          "i",
        ),
      );
    }
  });

  it("o guarda trata permissão ausente ou desconhecida como administrador geral/negado e só delega por configuração interna", () => {
    const g = corpo(permissoes, "administracao_exigir_admin");
    expect(g).toMatch(
      /coalesce\(nullif\(current_setting\('indicamais\.permissao_exigida', true\), ''\), 'geral'\)/,
    );
    expect(g).toMatch(/v_ok := false/);
    expect(g).toMatch(/contas_acesso_permitido\(v_uid\)/);
    expect(g).toMatch(/errcode = '42501'/);
  });

  it("conceder e revogar: só administrador geral, motivo obrigatório e auditoria com valor anterior", () => {
    for (const f of ["administracao_conceder_permissao", "administracao_revogar_permissao"]) {
      const c = corpo(permissoes, f);
      expect(c, f).toMatch(/administracao_exigir_admin\(\)/);
      expect(c, f).toMatch(/motivo obrigatório/);
      expect(c, f).toMatch(/insert into public\.administracao_auditoria/);
      expect(c, f).toMatch(/valor_anterior/);
      expect(permissoes, f).toMatch(
        new RegExp(
          `alter function public\\.${f}\\([^)]*\\)\\s+set indicamais\\.permissao_exigida = 'geral'`,
          "i",
        ),
      );
    }
  });

  it("nenhum papel de API lê ou escreve a tabela de permissões diretamente", () => {
    expect(permissoes).toMatch(
      /revoke all on public\.administracao_permissao from anon, authenticated/,
    );
    expect(permissoes).not.toMatch(/grant [a-z, ()_]*on public\.administracao_permissao to/i);
  });
});

describe("Fase 6: denúncias (IM-076)", () => {
  const denunciar = corpo(denuncias, "administracao_denunciar");

  it("é pública (anon e authenticated) e tem campo-armadilha antes de qualquer gravação", () => {
    expect(denuncias).toMatch(
      /grant execute on function public\.administracao_denunciar\([^)]*\) to anon, authenticated;/,
    );
    expect(denunciar.indexOf("p_site")).toBeGreaterThan(-1);
    expect(denunciar.indexOf("return;")).toBeLessThan(denunciar.indexOf("insert into"));
  });

  it("limita por pessoa e global (P0429), deduplica por denunciante e alvo e não confirma existência do alvo", () => {
    expect(denunciar).toMatch(/P0429/);
    expect(denuncias).toMatch(
      /administracao_denuncia_unica unique \(denunciante_chave, alvo_tipo, alvo_id\)/,
    );
    expect(denunciar).toMatch(/on conflict \(denunciante_chave, alvo_tipo, alvo_id\) do nothing/);
    // Alvo inexistente e limite por alvo: retorno silencioso, nunca erro.
    expect(denunciar).toMatch(/if not v_existe then\s+return;/);
    expect(denunciar).not.toMatch(/não encontrad|inexistente|P0002/i);
    // A tentativa é registrada ANTES de checar a existência (impede sondar alvos).
    expect(denunciar.indexOf("administracao_denuncia_tentativa (chave)")).toBeLessThan(
      denunciar.indexOf("v_existe :="),
    );
  });

  it("aceita só os tipos e alvos do IM-076 e estados aberta, em_analise, procedente, improcedente", () => {
    for (const t of ["autoindicacao", "spam_fraude", "uso_indevido_dados", "conteudo_inadequado"]) {
      expect(denuncias).toContain(`'${t}'`);
    }
    for (const a of ["perfil", "item", "conta", "pedido", "indicacao"])
      expect(denuncias).toContain(`'${a}'`);
    for (const s of ["aberta", "em_analise", "procedente", "improcedente"])
      expect(denuncias).toContain(`'${s}'`);
  });

  it("o denunciante nunca é exposto: sem privilégio de tabela e sem id de conta nas visões", () => {
    for (const t of [
      "administracao_denuncia",
      "administracao_denuncia_decisao",
      "administracao_denuncia_tentativa",
    ]) {
      expect(denuncias, t).toMatch(
        new RegExp(`revoke all on public\\.${t} from anon, authenticated`),
      );
      expect(denuncias, t).not.toMatch(new RegExp(`grant [a-z, ()_]*on public\\.${t} to`, "i"));
    }
    for (const v of ["administracao_fila_denuncias", "administracao_denuncia_decisoes"]) {
      const m = denuncias.match(new RegExp(`create view public\\.${v} as([\\s\\S]*?);`, "i"))!;
      const colunas = m[1]!.split(/\bwhere\b/i)[0]!.replace(/sha256\([\s\S]*?\), 'hex'\)/gi, "");
      // denunciante_id só aparece dentro do CASE que o reduz a "anonimo"/"conta".
      const semCase = colunas.replace(/d\.denunciante_id is null/gi, "");
      expect(semCase, v).not.toMatch(
        /denunciante_id|autor_id|conta_id|solicitante_id|responsavel_id/i,
      );
      expect(m[1], v).toMatch(/administracao_permitido\('analisar_denuncias'\)/);
    }
  });

  it("decidir exige analisar_denuncias, motivo e auditoria, e NÃO executa nada além do registro (sem suspensão automática)", () => {
    const d = corpo(denuncias, "administracao_decidir_denuncia");
    expect(denuncias).toMatch(
      /alter function public\.administracao_decidir_denuncia\([^)]*\)\s+set indicamais\.permissao_exigida = 'analisar_denuncias'/,
    );
    expect(d).toMatch(/motivo obrigatório/);
    expect(d).toMatch(/insert into public\.administracao_auditoria/);
    expect(d).not.toMatch(/contas_ciclo_vida|publicado|suspend|despublic|pontos_|delete from/i);
    // Nada em denúncias dispara suspensão.
    expect(denuncias).not.toMatch(
      /administracao_suspender_conta|insert into public\.contas_ciclo_vida/i,
    );
  });

  it("o histórico de decisões é só de inserção", () => {
    expect(denuncias).toMatch(
      /before update or delete on public\.administracao_denuncia_decisao\s+for each row execute function public\.administracao_registro_imutavel/i,
    );
  });
});

describe("Fase 6: suspensão e reativação (IM-080)", () => {
  it("suspender: permissão suspender, motivo, auditoria com valor anterior, despublica e preserva pontos e histórico", () => {
    const s = corpo(suspensao, "administracao_suspender_conta");
    expect(suspensao).toMatch(
      /alter function public\.administracao_suspender_conta\([^)]*\)\s+set indicamais\.permissao_exigida = 'suspender'/,
    );
    expect(s).toMatch(/motivo obrigatório/);
    expect(s).toMatch(/update public\.perfis_perfil set publicado = false/);
    expect(s).toMatch(/update public\.catalogo_item set publicado = false/);
    expect(s).toMatch(/insert into public\.administracao_auditoria/);
    expect(s).toMatch(/valor_anterior/);
    expect(s).not.toMatch(/pontos_|relacionamento_|delete from|publicado = true/i);
  });

  it("reativar NÃO republica e registra a prova na auditoria", () => {
    const r = corpo(suspensao, "administracao_reativar_conta");
    expect(r).not.toMatch(
      /publicado = true|update public\.perfis_perfil|update public\.catalogo_item/i,
    );
    expect(r).toMatch(/republicado_automaticamente/);
    expect(r).toMatch(/insert into public\.administracao_auditoria/);
  });

  it("um gatilho impede publicar enquanto a conta não está ativa; disponibilidade e indicar exigem conta com acesso", () => {
    expect(ciclo).toMatch(
      /create trigger perfis_perfil_bloquear_publicacao before insert or update on public\.perfis_perfil/,
    );
    expect(ciclo).toMatch(
      /create trigger catalogo_item_bloquear_publicacao before insert or update on public\.catalogo_item/,
    );
    expect(corpo(ciclo, "perfis_perfil_disponivel")).toMatch(
      /contas_pode_publicar\(p\.responsavel_id\)/,
    );
    expect(corpo(ciclo, "contas_pode_indicar")).toMatch(/contas_acesso_permitido\(id\)/);
    expect(corpo(ciclo, "contas_pedido_sem_atribuicao_se_suspenso")).toMatch(
      /new\.link_id := null/,
    );
  });

  it("o proxy tem uma flag consultável da própria conta (sem id de conta)", () => {
    expect(ciclo).toMatch(
      /grant execute on function public\.contas_meu_estado\(\) to authenticated;/,
    );
    expect(corpo(ciclo, "contas_meu_estado")).toMatch(/auth\.uid\(\)/);
  });

  it("a visão de contas fora do normal não traz nome, telefone nem e-mail", () => {
    const m = suspensao.match(
      /create view public\.administracao_contas_ciclo_vida as([\s\S]*?);/i,
    )!;
    expect(m[1]).not.toMatch(/nome|whatsapp|telefone|email/i);
  });
});

describe("Fase 6: encerramento (IM-081)", () => {
  it("confirmação reforçada validada no servidor e carência vinda do parâmetro (nunca fixa)", () => {
    const f = corpo(encerramento, "contas_solicitar_encerramento");
    expect(f).toMatch(/<> 'ENCERRAR'/);
    expect(f).toMatch(/contas_parametro_valor\('encerramento_carencia_dias'\)/);
    expect(f).not.toMatch(/\b30\b/);
    expect(f).toMatch(/update public\.perfis_perfil set publicado = false/);
    expect(ciclo).toMatch(/'encerramento_carencia_dias', 30,/);
  });

  it("a pessoa pode desistir e a desistência não republica", () => {
    const f = corpo(encerramento, "contas_cancelar_encerramento");
    expect(f).toMatch(/encerramento_cancelado/);
    expect(f).not.toMatch(/publicado = true/);
  });

  it("a rotina é só do servidor (service_role) e idempotente", () => {
    expect(encerramento).toMatch(
      /grant execute on function public\.contas_executar_encerramentos\(integer\) to service_role;/,
    );
    expect(encerramento).not.toMatch(
      /grant execute on function public\.contas_(anonimizar|anonimizar_auth|executar_encerramentos)\([^)]*\) to[^;]*\b(anon|authenticated)\b/i,
    );
    expect(corpo(encerramento, "contas_anonimizar")).toMatch(
      /is distinct from 'encerramento_solicitado'/,
    );
  });

  it("anonimiza dados pessoais sem apagar a conta nem tocar em pontos, relacionamento ou auditoria", () => {
    const a = corpo(encerramento, "contas_anonimizar");
    expect(a).toMatch(/nome_exibicao = null, whatsapp_e164 = null/);
    expect(a).toMatch(/contas_anonimizar_auth/);
    expect(encerramento).not.toMatch(/delete from public\.contas_conta/i);
    expect(encerramento).not.toMatch(
      /(update|delete from|insert into) public\.(pontos_|relacionamento_|administracao_auditoria|indicacoes_)/i,
    );
    expect(corpo(encerramento, "contas_anonimizar_auth")).toMatch(/email = 'anonimizado\+'/);
  });

  it("a exceção ao histórico de WhatsApp só vale durante a anonimização da própria conta", () => {
    const h = corpo(encerramento, "contas_historico_imutavel");
    expect(h).toMatch(/current_setting\('indicamais\.anonimizando', true\) = old\.conta_id::text/);
    expect(h).toMatch(/new\.whatsapp_anterior_e164 is null and new\.whatsapp_novo_e164 is null/);
    expect(h).toMatch(/raise exception 'contas_whatsapp_historico é só de inserção'/);
  });
});

describe("Fase 6: invalidar indicação (IM-077, IM-035, IM-078)", () => {
  const f = corpo(invalidar, "administracao_invalidar_indicacao");

  it("exige invalidar_indicacoes, motivo e auditoria", () => {
    expect(invalidar).toMatch(
      /alter function public\.administracao_invalidar_indicacao\([^)]*\)\s+set indicamais\.permissao_exigida = 'invalidar_indicacoes'/,
    );
    expect(f).toMatch(/motivo obrigatório/);
    expect(f).toMatch(/insert into public\.administracao_auditoria/);
  });

  it("reverte pontos só pela rotina existente, com categoria fixa, sem lançamento escrito à mão", () => {
    expect(f).toMatch(/public\.pontos_reverter_credito\(v_credito, 'indicacao_invalida'/);
    expect(f).not.toMatch(
      /insert into public\.pontos_lancamento|update public\.pontos_|delete from/i,
    );
  });

  it("a marca de invalidação é só de inserção e uma por pedido", () => {
    expect(invalidar).toMatch(/administracao_invalidacao_pedido_unico unique \(pedido_id\)/);
    expect(invalidar).toMatch(
      /before update or delete on public\.administracao_invalidacao_indicacao\s+for each row execute function public\.administracao_registro_imutavel/i,
    );
  });
});

describe("Fase 6: histórico nunca sofre UPDATE ou DELETE (IM-078)", () => {
  it("nenhuma migração nova altera lançamentos, auditoria ou eventos", () => {
    const nova = [permissoes, denuncias, suspensao, ciclo, encerramento, invalidar].join("\n");
    expect(nova).not.toMatch(
      /(update|delete from) public\.(pontos_lancamento|pontos_decisao|pontos_falha|administracao_auditoria|contas_ciclo_vida_evento|administracao_denuncia_decisao|relacionamento_evento)/i,
    );
  });
});
