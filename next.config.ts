import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import { cabecalhosDeSeguranca } from "./src/shared/seguranca/cabecalhos";

const nextConfig: NextConfig = {
  // RSA-01: cabeçalhos de segurança. HSTS só em build de produção. Não toca em Cache-Control.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: cabecalhosDeSeguranca(process.env.NODE_ENV === "production"),
      },
    ];
  },
};

export default nextConfig;

// Permite usar bindings do Cloudflare em `next dev` (apenas local).
initOpenNextCloudflareForDev();
