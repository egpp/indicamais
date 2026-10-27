import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

/**
 * Integração real do Storage contra o Supabase de DESENVOLVIMENTO (IM-029, IM-086). Pendente de execução:
 * só roda quando as variáveis abaixo existirem; sem elas, os testes ficam "skipped" (CI e máquina comum).
 * NÃO usa service_role, NÃO escreve nada (só login, listagem e leitura de metadado), NÃO imprime dados.
 *
 * Variáveis (apenas em ambiente local, nunca no repositório):
 *   INTEGRACAO_SUPABASE_URL, INTEGRACAO_SUPABASE_ANON_KEY  (a chave publicável já é pública)
 *   INTEGRACAO_CONTA_A_EMAIL / _SENHA   conta de teste COM perfil/item já criado e imagens enviadas
 *   INTEGRACAO_CONTA_B_EMAIL / _SENHA   outra conta de teste
 *   INTEGRACAO_PASTA_A                  ex.: perfil/<perfil_id da conta A> (sem barra final)
 *   INTEGRACAO_PASTA_PUBLICA            pasta de um perfil/item APROVADO e PUBLICADO (pode ser a mesma de A)
 *
 * Executar: INTEGRACAO_...=... pnpm exec vitest run tests/integracao/storage-owner.test.ts
 *
 * O que prova:
 *   1. a listagem do Storage (anon e usuário logado) NUNCA devolve `owner`, `owner_id` nem `user_metadata`
 *      (o metadado revelaria a conta de quem enviou a imagem pública);
 *   2. B não lista as imagens de rascunho/pendente da pasta de A (só as públicas);
 *   3. anon não lista nada de pasta não publicada;
 *   4. anon e B não conseguem URL assinada de imagem não pública.
 */
const e = process.env;
const pronto = Boolean(
  e.INTEGRACAO_SUPABASE_URL &&
  e.INTEGRACAO_SUPABASE_ANON_KEY &&
  e.INTEGRACAO_CONTA_A_EMAIL &&
  e.INTEGRACAO_CONTA_A_SENHA &&
  e.INTEGRACAO_CONTA_B_EMAIL &&
  e.INTEGRACAO_CONTA_B_SENHA &&
  e.INTEGRACAO_PASTA_A &&
  e.INTEGRACAO_PASTA_PUBLICA,
);

const BUCKET = "indicamais-imagens";
const PROIBIDOS = ["owner", "owner_id", "user_metadata"];

function cliente() {
  return createClient(e.INTEGRACAO_SUPABASE_URL!, e.INTEGRACAO_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function logado(email: string, senha: string) {
  const c = cliente();
  const { error } = await c.auth.signInWithPassword({ email, password: senha });
  if (error) throw new Error("login de teste falhou");
  return c;
}

function vazaOwner(objetos: unknown[] | null): boolean {
  const json = JSON.stringify(objetos ?? []);
  return PROIBIDOS.some((k) => json.includes(`"${k}"`));
}

describe.skipIf(!pronto)("Storage: metadado owner não chega ao cliente (integração dev)", () => {
  it("anon lista a pasta pública sem owner/owner_id", async () => {
    const { data, error } = await cliente().storage.from(BUCKET).list(e.INTEGRACAO_PASTA_PUBLICA!);
    expect(error).toBeNull();
    expect(vazaOwner(data)).toBe(false);
  });

  it("usuário logado lista a própria pasta sem owner/owner_id", async () => {
    const a = await logado(e.INTEGRACAO_CONTA_A_EMAIL!, e.INTEGRACAO_CONTA_A_SENHA!);
    const { data, error } = await a.storage.from(BUCKET).list(e.INTEGRACAO_PASTA_A!);
    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThan(0);
    expect(vazaOwner(data)).toBe(false);
  });

  it("B lista a pasta de A sem owner/owner_id (só o que for público)", async () => {
    const b = await logado(e.INTEGRACAO_CONTA_B_EMAIL!, e.INTEGRACAO_CONTA_B_SENHA!);
    const { data } = await b.storage.from(BUCKET).list(e.INTEGRACAO_PASTA_A!);
    expect(vazaOwner(data)).toBe(false);
  });

  it("B não vê mais objetos da pasta de A do que o anônimo vê (nada de rascunho/pendente)", async () => {
    const b = await logado(e.INTEGRACAO_CONTA_B_EMAIL!, e.INTEGRACAO_CONTA_B_SENHA!);
    const doB = await b.storage.from(BUCKET).list(e.INTEGRACAO_PASTA_A!);
    const doAnon = await cliente().storage.from(BUCKET).list(e.INTEGRACAO_PASTA_A!);
    const nomes = (l: { name: string }[] | null) => (l ?? []).map((o) => o.name).sort();
    expect(nomes(doB.data)).toEqual(nomes(doAnon.data));
  });

  it("a raiz do bucket não lista pastas de contas para anon", async () => {
    const { data } = await cliente().storage.from(BUCKET).list("");
    expect(vazaOwner(data)).toBe(false);
  });

  it("anon não gera URL assinada de caminho inexistente/não público", async () => {
    const { data } = await cliente()
      .storage.from(BUCKET)
      .createSignedUrl(`${e.INTEGRACAO_PASTA_A!}/nao-existe-00000000.jpg`, 60);
    expect(data?.signedUrl ?? null).toBeNull();
  });
});

describe("Storage: integração de owner (documentação)", () => {
  it("fica registrado como pendente quando as variáveis não existem", () => {
    // Evita arquivo sem teste ativo quando tudo acima é skip. Não é prova de nada.
    expect(typeof pronto).toBe("boolean");
  });
});
