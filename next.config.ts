import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {};

export default nextConfig;

// Permite usar bindings do Cloudflare em `next dev` (apenas local).
initOpenNextCloudflareForDev();
