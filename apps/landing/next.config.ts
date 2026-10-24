import type { NextConfig } from "next";

/** The public site at usesaji.com (Vercel Services; the app has its own subdomain, see the repo
 * root `vercel.json`). No basePath. */
const nextConfig: NextConfig = {
	// VERCEL_ENV inlined for client code too (lib/site.ts picks production URLs with it).
	env: { NEXT_PUBLIC_VERCEL_ENV: process.env.VERCEL_ENV ?? "" },
	// A separate output dir for one-off verification builds (`NEXT_DIST_DIR=.next-verify next build`)
	// so they never overwrite the `.next` a running `pnpm dev` is serving from.
	distDir: process.env.NEXT_DIST_DIR || ".next",
	reactCompiler: true,
	transpilePackages: ["@repo/ui"],
	allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*"],
	// Serve images as they are: behind Vercel Services the optimizer route (`/_next/image`) does not
	// reach this app. The files in public/images are already sized for the page.
	images: { unoptimized: true },
};

export default nextConfig;
