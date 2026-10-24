/** Brand copy for the root layout's metadata, and where the other apps live. */
const SITE_NAME = "Saji";
const SITE_TAGLINE = "Save Better Together";
const SITE_DESCRIPTION =
	"A community-first savings platform for West Africa. Save transparently, contribute confidently, and manage group savings without trust issues.";

const THEME_COLOR = "#4100F5";

/** Production hosts. Each app owns its own host (repo root `vercel.json`). */
const PRODUCTION_ORIGIN = "https://app.usesaji.com";
const LANDING_PRODUCTION_ORIGIN = "https://usesaji.com";

/** Read through next.config `env`, so client components agree with the server render. */
const IS_PRODUCTION = process.env.NEXT_PUBLIC_VERCEL_ENV === "production";

/** Absolute site URL for `metadataBase`: NEXT_PUBLIC_SITE_URL → production → the preview → localhost. */
const ORIGIN =
	process.env.NEXT_PUBLIC_SITE_URL ??
	(IS_PRODUCTION ? PRODUCTION_ORIGIN : undefined) ??
	(process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`) ??
	"http://localhost:3000";

/** This app's base path: `/app` on previews, empty in production and dev (next.config.ts). */
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Prefix app-local assets when this app is mounted below the site root (previews). */
function withBasePath(src: string) {
	return BASE_PATH && src.startsWith("/") && !src.startsWith(`${BASE_PATH}/`) ? `${BASE_PATH}${src}` : src;
}

const SITE_URL = new URL(`${BASE_PATH}/`, ORIGIN);

/** The landing site (`apps/landing`). Link to it with a plain <a>. */
const LANDING_URL =
	process.env.NEXT_PUBLIC_LANDING_URL ??
	(IS_PRODUCTION ? LANDING_PRODUCTION_ORIGIN : process.env.NEXT_PUBLIC_VERCEL_ENV === "preview" ? "/" : "http://localhost:3002");

export { SITE_NAME, SITE_TAGLINE, SITE_DESCRIPTION, THEME_COLOR, SITE_URL, BASE_PATH, withBasePath, LANDING_URL };
