import type { NextRequest } from "next/server";
import { renovarSessao } from "@/shared/supabase/sessao";

/** Next 16: `proxy.ts` substitui `middleware.ts`. Só renova a sessão do Auth. */
export async function proxy(request: NextRequest) {
  return renovarSessao(request);
}

export const config = {
  matcher: [
    "/((?!og/|_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
