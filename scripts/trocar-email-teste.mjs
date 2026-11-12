// Troca o e-mail de uma conta de teste no Supabase de DESENVOLVIMENTO (IM-085, IM-086).
// Uso: pnpm trocar:email-teste <email-atual> <email-novo>
// (carrega .env.local via node --env-file, na maquina de quem roda).
// Imprime somente status. Nunca chave, URL completa nem e-mails alem dos argumentos.
// Recusa qualquer URL que nao seja do projeto de dev. Nao e importado pelo app nem roda no CI.
import { pathToFileURL } from "node:url";

export const REF_DEV = "qheleouixleltfjtccji";
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export function emailValido(valor) {
  return typeof valor === "string" && valor.length <= 254 && EMAIL_RE.test(valor);
}

/** Valida argumentos. Retorna { ok, atual, novo } ou { ok:false, erro }. */
export function validarArgumentos(args) {
  if (!Array.isArray(args) || args.length !== 2)
    return { ok: false, erro: "uso: pnpm trocar:email-teste <email-atual> <email-novo>" };
  const [a, n] = args.map((x) => String(x ?? "").trim());
  if (!emailValido(a)) return { ok: false, erro: "e-mail atual inválido" };
  if (!emailValido(n)) return { ok: false, erro: "e-mail novo inválido" };
  if (a.toLowerCase() === n.toLowerCase()) return { ok: false, erro: "e-mail novo igual ao atual" };
  return { ok: true, atual: a.toLowerCase(), novo: n.toLowerCase() };
}

/** Aceita somente https://<ref-dev>.supabase.co. */
export function urlEhDeDev(url) {
  try {
    const u = new URL(String(url ?? "").trim());
    return u.protocol === "https:" && u.hostname === `${REF_DEV}.supabase.co`;
  } catch {
    return false;
  }
}

async function buscarPorEmail(admin, email) {
  const achados = [];
  for (let pagina = 1; pagina <= 100; pagina++) {
    const { data, error } = await admin.auth.admin.listUsers({ page: pagina, perPage: 200 });
    if (error) throw new Error("falha ao listar usuários");
    const lote = data?.users ?? [];
    for (const u of lote) if ((u.email ?? "").toLowerCase() === email) achados.push(u);
    if (lote.length < 200) break;
  }
  return achados;
}

/** Executa a troca. `admin` e um cliente supabase-js com service_role. Retorna { ok, mensagem }. */
export async function trocarEmail(admin, atual, novo) {
  let origem;
  let destino;
  try {
    origem = await buscarPorEmail(admin, atual);
    destino = await buscarPorEmail(admin, novo);
  } catch {
    return { ok: false, mensagem: "erro: falha ao consultar contas" };
  }
  if (origem.length === 0) return { ok: false, mensagem: "erro: nenhuma conta com o e-mail atual" };
  if (origem.length > 1)
    return { ok: false, mensagem: "erro: mais de uma conta com o e-mail atual" };
  if (destino.length > 0)
    return { ok: false, mensagem: "erro: o novo e-mail já existe em outra conta" };
  const { error } = await admin.auth.admin.updateUserById(origem[0].id, {
    email: novo,
    email_confirm: true,
  });
  if (error) return { ok: false, mensagem: "erro: o Supabase recusou a troca" };
  return { ok: true, mensagem: "e-mail trocado" };
}

async function principal() {
  const v = validarArgumentos(process.argv.slice(2));
  if (!v.ok) {
    console.log(v.erro);
    return 1;
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave || !chave.trim()) {
    console.log("variáveis do Supabase faltando em .env.local");
    return 1;
  }
  if (!urlEhDeDev(url)) {
    console.log("recusado: a URL não é do projeto de desenvolvimento");
    return 1;
  }
  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(url.trim(), chave.trim(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const r = await trocarEmail(admin, v.atual, v.novo);
  console.log(r.mensagem);
  return r.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(await principal());
}
