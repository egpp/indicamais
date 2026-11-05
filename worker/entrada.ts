// Entrada do Worker (OpenNext + Cron Trigger). Conforme a documentação do @opennextjs/cloudflare ("custom
// worker"): reaproveita o `fetch` gerado e acrescenta o handler `scheduled`. O arquivo .open-next/worker.js só
// existe depois do build (`pnpm build:cf`).
import { tarefasNotificacoesCron } from "../src/app/_lib/notificacoes-cron";
import { executarRotinasAgendadas } from "../src/shared/agendador/rotinas";
// `.open-next/worker.js` é gerado no build: ausente antes dele, presente depois (por isso ts-ignore).
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { default as handler } from "../.open-next/worker.js";

type EnvAgendado = {
  NEXT_PUBLIC_SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  // Aviso por e-mail (IM-027, IM-028): sem EMAIL_API_KEY/EMAIL_FROM a rotina de notificações não faz nada.
  EMAIL_API_KEY?: string;
  EMAIL_FROM?: string;
  NEXT_PUBLIC_APP_URL?: string;
};
type ContextoAgendado = { waitUntil(promessa: Promise<unknown>): void };

const entrada = {
  fetch: handler.fetch,

  async scheduled(_evento: unknown, env: EnvAgendado, ctx: ContextoAgendado) {
    ctx.waitUntil(
      executarRotinasAgendadas(
        {
          url: env.NEXT_PUBLIC_SUPABASE_URL,
          chave: env.SUPABASE_SERVICE_ROLE_KEY,
        },
        tarefasNotificacoesCron({
          EMAIL_API_KEY: env.EMAIL_API_KEY,
          EMAIL_FROM: env.EMAIL_FROM,
          NEXT_PUBLIC_APP_URL: env.NEXT_PUBLIC_APP_URL,
        }),
      ).catch(() => {
        // Sem detalhes no log: pode conter dado de conexão (IM-086).
        console.log("[cron] falha ao executar as rotinas");
      }),
    );
  },
};

export default entrada;
