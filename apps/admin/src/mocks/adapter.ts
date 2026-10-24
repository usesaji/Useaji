import { AxiosError, AxiosHeaders, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { updateDb } from "@/mocks/db";
import type { MockAdminDb, MockAdminUser } from "@/mocks/seed";
import type { AuditLogDto } from "@/lib/api/dto";

/**
 * Answers the console's requests in the browser, like the Railway API: `/auth/login | refresh |
 * logout | me`, `/users`, `/users/{id}`, `/audit-logs`, `/health`. Same envelopes and error bodies
 * as the app's mock (apps/web/src/mocks/adapter.ts).
 */

class HttpError extends Error {
	constructor(
		readonly status: number,
		readonly code: string,
		message: string,
	) {
		super(message);
	}
}

const ACCESS_TTL_S = 15 * 60;
const wait = () => new Promise((resolve) => setTimeout(resolve, 180 + Math.random() * 320));

type Ctx = {
	db: MockAdminDb;
	user: MockAdminUser | null;
	query: Record<string, string | undefined>;
	body: Record<string, unknown>;
	params: string[];
};
type Handler = (ctx: Ctx) => unknown;

const ROUTES: {
	method: string;
	pattern: RegExp;
	auth: "none" | "user" | "admin";
	status?: number;
	message: string;
	handler: Handler;
}[] = [];
const route = (
	method: string,
	path: string,
	auth: "none" | "user" | "admin",
	message: string,
	handler: Handler,
	status?: number,
) => ROUTES.push({ method, pattern: new RegExp(`^${path.replace(/:\w+/g, "([^/]+)")}$`), auth, message, handler, status });

function tokens(db: MockAdminDb, user: MockAdminUser, family = crypto.randomUUID()) {
	const refreshToken = `mock-admin-refresh-${crypto.randomUUID()}`;
	db.refreshTokens.push({ token: refreshToken, userId: user.id, family, used: false });
	return {
		accessToken: `mock.${user.id}.${Date.now() + ACCESS_TTL_S * 1000}`,
		refreshToken,
		tokenType: "Bearer" as const,
		expiresIn: ACCESS_TTL_S,
	};
}

function log(db: MockAdminDb, action: string, user: MockAdminUser | null, metadata: Record<string, unknown> = {}) {
	db.auditLogs.unshift({
		id: (db.auditLogs[0]?.id ?? 0) + 1,
		action,
		actorId: user?.id ?? null,
		actorEmail: user?.email ?? null,
		resourceType: user ? "user" : null,
		resourceId: user?.id ?? null,
		ip: "127.0.0.1",
		requestId: crypto.randomUUID(),
		traceId: crypto.randomUUID().replace(/-/g, ""),
		metadata,
		createdAt: new Date().toISOString(),
	});
}

/** `?page&limit` → `{ results, paginationMeta }`, as the API pages its lists (limit at most 100). */
function paginate<T>(items: T[], query: Ctx["query"], defaultLimit = 20) {
	const limit = Math.min(Math.max(Number(query.limit) || defaultLimit, 1), 100);
	const totalPages = Math.max(1, Math.ceil(items.length / limit));
	const currentPage = Math.min(Math.max(Number(query.page) || 1, 1), totalPages);
	const results = items.slice((currentPage - 1) * limit, currentPage * limit);
	return {
		results,
		paginationMeta: {
			nextPage: currentPage < totalPages,
			previousPage: currentPage > 1,
			totalCount: items.length,
			count: results.length,
			totalPages,
			currentPage,
		},
	};
}

const summary = ({ id, email, role, createdAt }: MockAdminUser) => ({ id, email, role, createdAt });

route(
	"POST",
	"/auth/login",
	"none",
	"Signed in",
	({ db, body }) => {
		const user = db.users.find(
			(u) =>
				u.email ===
				String(body.email ?? "")
					.trim()
					.toLowerCase(),
		);
		if (!user || user.password !== body.password) {
			log(db, "auth.login_failed", null, { email: String(body.email ?? "") });
			throw new HttpError(401, "UNAUTHORIZED", "Incorrect email or password.");
		}
		log(db, "auth.login", user);
		return tokens(db, user);
	},
	200,
);

route(
	"POST",
	"/auth/refresh",
	"none",
	"Session refreshed",
	({ db, body }) => {
		const row = db.refreshTokens.find((t) => t.token === body.refreshToken);
		if (!row || row.used) {
			if (row) db.refreshTokens = db.refreshTokens.filter((t) => t.family !== row.family);
			throw new HttpError(401, "UNAUTHORIZED", "Your session has expired.");
		}
		row.used = true;
		return tokens(
			db,
			db.users.find((u) => u.id === row.userId)!,
			row.family,
		);
	},
	200,
);

route(
	"POST",
	"/auth/logout",
	"none",
	"Signed out",
	({ db, body }) => {
		const row = db.refreshTokens.find((t) => t.token === body.refreshToken);
		if (row) db.refreshTokens = db.refreshTokens.filter((t) => t.family !== row.family);
		return null;
	},
	200,
);

route("GET", "/auth/me", "user", "User retrieved", ({ user }) => summary(user!));

route("GET", "/users", "admin", "Users retrieved", ({ db, query }) => {
	const search = (query.search ?? "").toLowerCase();
	const list = db.users.filter(
		(u) => (!search || u.email.includes(search) || u.id.startsWith(search)) && (!query.role || u.role === query.role),
	);
	return paginate(list.map(summary), query);
});

route("GET", "/users/:id", "user", "User retrieved", ({ db, user, params }) => {
	if (user!.role !== "admin" && user!.id !== params[0]) throw new HttpError(403, "FORBIDDEN", "Forbidden");
	const found = db.users.find((u) => u.id === params[0]);
	if (!found) throw new HttpError(404, "NOT_FOUND", "User not found");
	return summary(found);
});

route("GET", "/audit-logs", "admin", "Audit log retrieved", ({ db, query }) => {
	const list: AuditLogDto[] = db.auditLogs.filter(
		(e) => (!query.action || e.action === query.action) && (!query.actorId || e.actorId === query.actorId),
	);
	return paginate(list, query, 25);
});

route(
	"GET",
	"/health",
	"none",
	"Healthy",
	({ db }) => {
		// As the API: 200 with `{ status, info, error, details }`, or 503 whose message names what's down.
		const down = (["database", "redis"] as const).filter((d) => db.health[d] === "down");
		if (down.length) throw new HttpError(503, "SERVICE_UNAVAILABLE", `Unavailable: ${down.join(", ")}`);
		const details = { database: { status: "up" as const }, redis: { status: "up" as const } };
		return { status: "ok", info: details, error: {}, details };
	},
	200,
);

export async function mockAdapter(config: InternalAxiosRequestConfig): Promise<AxiosResponse> {
	await wait();
	const method = (config.method ?? "get").toUpperCase();
	const path =
		"/" +
		(config.url ?? "")
			.replace(/^https?:\/\/[^/]+/, "")
			.replace(/^\/?(api\/)?v1\//, "")
			.replace(/^\/+/, "")
			.split("?")[0];
	const respond = (status: number, data: unknown): AxiosResponse => ({
		data,
		status,
		statusText: String(status),
		headers: new AxiosHeaders(),
		config,
		request: null,
	});
	try {
		const found = ROUTES.map((r) => ({ r, m: r.method === method ? r.pattern.exec(path) : null })).find((x) => x.m);
		if (!found) throw new HttpError(404, "NOT_FOUND", `Cannot ${method} ${path}`);
		const { r, m } = found;
		const body = typeof config.data === "string" ? (JSON.parse(config.data) as Record<string, unknown>) : {};
		const result = updateDb((db) => {
			const [prefix, userId, expires] = String(config.headers?.Authorization ?? "")
				.replace(/^Bearer /, "")
				.split(".");
			const user = prefix === "mock" && Number(expires) > Date.now() ? (db.users.find((u) => u.id === userId) ?? null) : null;
			if (r.auth !== "none" && !user) throw new HttpError(401, "UNAUTHORIZED", "Unauthorized");
			if (r.auth === "admin" && user?.role !== "admin") throw new HttpError(403, "FORBIDDEN", "Admins only.");
			return r.handler({ db, user, query: { ...(config.params as Record<string, string>) }, body, params: m!.slice(1) });
		});
		const status = r.status ?? (method === "POST" ? 201 : 200);
		return respond(status, { statusCode: status, message: r.message, data: result ?? null });
	} catch (error) {
		const e =
			error instanceof HttpError
				? error
				: new HttpError(500, "INTERNAL_SERVER_ERROR", error instanceof Error ? error.message : "Internal error");
		const data = {
			statusCode: e.status,
			code: e.code,
			message: e.message,
			details: (e as { details?: unknown }).details,
			requestId: crypto.randomUUID(),
			path: `/v1${path}`,
		};
		throw new AxiosError(e.message, AxiosError.ERR_BAD_REQUEST, config, null, respond(e.status, data));
	}
}
