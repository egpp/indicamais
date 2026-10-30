// Entrada do Worker (OpenNext + Cron Trigger). Conforme a documentação do @opennextjs/cloudflare ("custom
// worker"): reaproveita o `fetch` gerado e acrescenta o handler `scheduled`. O arquivo .open-next/worker.js só
// existe depois do build (`pnpm build:cf`).
import { executarRotinasAgendadas } from "../src/shared/agendador/rotinas";
// `.open-next/worker.js` é gerado no build: ausente antes dele, presente depois (por isso ts-ignore).
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { default as handler } from "../.open-next/worker.js";

type EnvAgendado = {
  NEXT_PUBLIC_SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};
type ContextoAgendado = { waitUntil(promessa: Promise<unknown>): void };

const entrada = {
  fetch: handler.fetch,

  async scheduled(_evento: unknown, env: EnvAgendado, ctx: ContextoAgendado) {
    ctx.waitUntil(
      executarRotinasAgendadas({
        url: env.NEXT_PUBLIC_SUPABASE_URL,
        chave: env.SUPABASE_SERVICE_ROLE_KEY,
      }).catch(() => {
        // Sem detalhes no log: pode conter dado de conexão (IM-086).
        console.log("[cron] falha ao executar as rotinas");
      }),
    );
  },
};

export default entrada;
