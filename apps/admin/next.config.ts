import type { NextConfig } from "next";

/** admin.usesaji.com in production; `/admin` on a preview's shared host (repo root `vercel.json`). */
const BASE_PATH = process.env.VERCEL_ENV === "preview" ? "/admin" : "";

/**
 * The Saji API (Railway; Swagger at …/docs), with its `/v1` prefix. Unused when
 * NEXT_PUBLIC_API_SOURCE is `mock`. `/health` sits outside `/v1`, at the API's root.
 */
const API_ORIGIN = process.env.API_PROXY_TARGET || "https://saji-backend-production-0025.up.railway.app/v1";
const API_ROOT = API_ORIGIN.replace(/\/v1\/?$/, "");
const API_URL = process.env.NEXT_PUBLIC_API_URL || `${BASE_PATH}/api/v1`;

const nextConfig: NextConfig = {
	basePath: BASE_PATH,
	env: { NEXT_PUBLIC_BASE_PATH: BASE_PATH, NEXT_PUBLIC_API_URL: API_URL, NEXT_PUBLIC_VERCEL_ENV: process.env.VERCEL_ENV ?? "" },
	distDir: process.env.NEXT_DIST_DIR || ".next",
	reactCompiler: true,
	transpilePackages: ["@repo/ui"],
	allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*"],
	async rewrites() {
		return [
			{ source: "/api/v1/:path*", destination: `${API_ORIGIN}/:path*` },
			{ source: "/api/health", destination: `${API_ROOT}/health` },
		];
	},
};

export default nextConfig;
