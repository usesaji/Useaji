/** The public site's copy, and where the app lives (repo root `vercel.json`). */
export const SITE_NAME = "Saji";
export const SITE_TITLE = "Saji — Save Better Together";
export const SITE_DESCRIPTION =
	"SAJI is a savings platform built for how West Africa actually saves — community-first, transparent, and fraud-proof. Save in groups, track contributions with confidence, and decide together.";

const IS_PRODUCTION = process.env.NEXT_PUBLIC_VERCEL_ENV === "production";

export const SITE_URL = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? (IS_PRODUCTION ? "https://usesaji.com" : "http://localhost:3002"));

/** The app (`apps/web`): app.usesaji.com in production, `/app` on a preview's shared host, :3000 locally. */
const APP_URL =
	process.env.NEXT_PUBLIC_APP_URL ??
	(IS_PRODUCTION ? "https://app.usesaji.com" : process.env.NEXT_PUBLIC_VERCEL_ENV === "preview" ? "/app" : "http://localhost:3000");

export const APP_LINKS = {
	register: `${APP_URL}/auth/register`,
	login: `${APP_URL}/auth/login`,
};
