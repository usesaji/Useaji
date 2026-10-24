import type { MockDb, MockUser } from "@/mocks/types";

/**
 * The mock's route table: one entry per Railway endpoint the app calls, written like the API's
 * own routes (`/groups/:id/cycle`). `scripts/check-api.mjs` compares this table and the app's
 * calls with docs/openapi.json, so a route the API lacks shows up as a gap, never silently.
 */

export interface Upload {
	name: string;
	type: string;
	size: number;
	/** The file as a data URL (downscaled when it is an image). */
	dataUrl: string;
}

export interface Ctx {
	db: MockDb;
	/** The mock clock, ms. */
	at: number;
	/** The same moment as ISO. */
	now: string;
	/** Signed-in user (null on public routes). */
	user: MockUser;
	params: Record<string, string>;
	query: Record<string, string | undefined>;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	body: any;
	/** Multipart fields; files arrive as `Upload`s. */
	form: Record<string, string | Upload>;
}

export interface RouteOptions {
	/** Default true: needs a bearer token. */
	auth?: boolean;
	status?: number;
	message: string;
	/**
	 * Set when the app needs this and the API doesn't have it (the reason, for BACKEND-GAPS.md).
	 * The mock serves it so the screen can be built; going live needs the backend to add it.
	 */
	notInApi?: string;
}

export interface Route extends RouteOptions {
	method: string;
	path: string;
	pattern: RegExp;
	keys: string[];
	handler: (ctx: Ctx) => unknown;
}

export const routes: Route[] = [];

export function route(
	method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
	path: string,
	options: RouteOptions,
	handler: (ctx: Ctx) => unknown,
) {
	const keys: string[] = [];
	const pattern = new RegExp(
		"^" +
			path.replace(/:(\w+)/g, (_, key: string) => {
				keys.push(key);
				return "([^/]+)";
			}) +
			"$",
	);
	routes.push({ method, path, pattern, keys, handler, ...options });
}

export function match(method: string, path: string) {
	for (const r of routes) {
		if (r.method !== method) continue;
		const m = r.pattern.exec(path);
		if (!m) continue;
		const params = Object.fromEntries(r.keys.map((key, i) => [key, decodeURIComponent(m[i + 1]!)]));
		return { route: r, params };
	}
	return null;
}

/** A failure the API would answer with: `{ statusCode, code, message, details? }`. */
export class HttpError extends Error {
	constructor(
		readonly status: number,
		readonly code: string,
		message: string,
		readonly details?: string[],
	) {
		super(message);
	}
}

export const badRequest = (message: string, details?: string[]) => new HttpError(400, "BAD_REQUEST", message, details);
export const notFound = (message = "Not found") => new HttpError(404, "NOT_FOUND", message);
export const forbidden = (message = "Forbidden") => new HttpError(403, "FORBIDDEN", message);
export const conflict = (message: string) => new HttpError(409, "CONFLICT", message);
export const unauthorized = (message = "Unauthorized") => new HttpError(401, "UNAUTHORIZED", message);

/** Validation in the API's style: 400 "Validation failed" with one message per field. */
export function validate(checks: [boolean, string][]) {
	const details = checks.filter(([ok]) => !ok).map(([, message]) => message);
	if (details.length) throw badRequest("Validation failed", details);
}

/** `?page&limit` (the spec doesn't document them yet; see BACKEND-GAPS.md) → `{ results, paginationMeta }`. */
export function paginate<T>(items: T[], query: Ctx["query"], defaultLimit = 20) {
	const limit = Math.min(Math.max(Number(query.limit) || defaultLimit, 1), 100);
	const totalCount = items.length;
	const totalPages = Math.max(1, Math.ceil(totalCount / limit));
	const currentPage = Math.min(Math.max(Number(query.page) || 1, 1), totalPages);
	const results = items.slice((currentPage - 1) * limit, currentPage * limit);
	return {
		results,
		paginationMeta: {
			nextPage: currentPage < totalPages,
			previousPage: currentPage > 1,
			totalCount,
			count: results.length,
			totalPages,
			currentPage,
		},
	};
}
