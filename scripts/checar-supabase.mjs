// Checagem manual de conexao com o Supabase de DESENVOLVIMENTO (IM-085, IM-086).
// Uso: pnpm check:supabase  (carrega .env.local via node --env-file).
// Imprime somente status. Nunca valores, prefixos, tamanhos ou corpos de resposta.
// Nao e importado pelo app nem roda no CI (CI nao tem segredos).
import { createClient } from "@supabase/supabase-js";

const REF_ESPERADO = "qheleouixleltfjtccji";
const NOMES = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

let falhou = false;
const erro = (msg) => {
  console.log(msg);
  falhou = true;
};

for (const nome of NOMES) {
  const v = process.env[nome];
  if (v && v.trim() !== "") console.log(`${nome}: ok`);
  else erro(`${nome}: faltando`);
}
if (falhou) process.exit(1);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL.trim();
let host = "";
try {
  const u = new URL(url);
  host = u.hostname;
  if (u.protocol !== "https:") erro("URL usa https: falhou");
} catch {
  erro("URL é válida (inclui https://): falhou");
}
if (url.includes(REF_ESPERADO) && !host.includes(REF_ESPERADO))
  console.log("dica: o ref aparece na URL, mas não no host");
if (host.endsWith(".supabase.co")) console.log("URL termina com .supabase.co: ok");
else erro("URL termina com .supabase.co: falhou");
if (host.includes(REF_ESPERADO)) console.log("ref confere");
else erro("ref diferente");
if (falhou) process.exit(1);

const opcoes = { auth: { persistSession: false, autoRefreshToken: false } };

async function testar(rotulo, chave) {
  try {
    const cliente = createClient(url, chave.trim(), opcoes);
    // Consulta inofensiva: sem tabela garantida, so o status HTTP importa.
    // 401/403 = chave invalida; 404/anteriores de schema = chave aceita.
    const { error, status } = await cliente
      .from("_checagem_inexistente")
      .select("*", { head: true, count: "exact" })
      .limit(1);
    const chaveRejeitada = status === 401 || status === 403;
    const semResposta = status === 0;
    if (chaveRejeitada || semResposta) {
      erro(`${rotulo}: falhou: ${status}`);
    } else {
      console.log(`${rotulo}: conexão ok`);
    }
    void error;
  } catch {
    erro(`${rotulo}: falhou: 0`);
  }
}

await testar("publishable key", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
await testar("secret key", process.env.SUPABASE_SERVICE_ROLE_KEY);

process.exit(falhou ? 1 : 0);
