/** The admin endpoints (`/v1/users`, `/v1/users/{id}`, `/v1/audit-logs`, `/health`) — the only seam to the API. */
import { apiGet, type Page } from "@/lib/api/client";
import type { AuditLogDto, HealthDto, HealthView, Role, UserSummaryDto } from "@/lib/api/dto";
import { ApiError } from "@/lib/api/client";

/** `search`: a full user id matches that user, other text part of the email (any case). `role`: `user` / `admin`. */
export const listUsers = (query: { page?: number; limit?: number; search?: string; role?: Role }) =>
	apiGet<Page<UserSummaryDto>>("/users", query);

export const getUser = (id: string) => apiGet<UserSummaryDto>(`/users/${id}`);

/** Newest first. `action` is an exact match (e.g. `auth.login`); `actorId` the user who acted. */
export const listAuditLogs = (query: { page?: number; limit?: number; action?: string; actorId?: string }) =>
	apiGet<Page<AuditLogDto>>("/audit-logs", query);

/** Dependencies `/health` reports. */
const DEPENDENCIES = ["database", "redis"];

/**
 * `GET /health`: public, outside `/v1` — its own proxy route (next.config.ts); the mock answers it as
 * `/health`. On 200 `data` is `HealthDto`. A down dependency answers 503 with the standard error
 * body, whose message names what failed ("Unavailable: redis"): that comes back as data, not an error.
 */
export async function getHealth(): Promise<HealthView> {
	const started = performance.now();
	const timing = () => ({ checkedAt: Date.now(), latencyMs: Math.round(performance.now() - started) });
	try {
		const data = await apiGet<HealthDto>("/health", undefined, {
			anonymous: true,
			baseURL: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api`,
		});
		return { status: "ok", details: data.details, ...timing() };
	} catch (error) {
		if (!(error instanceof ApiError) || error.status !== 503) throw error;
		const down = ((error.serverMessage ?? error.message).split(":")[1] ?? "")
			.split(",")
			.map((d) => d.trim())
			.filter(Boolean);
		const details = Object.fromEntries(
			[...new Set([...DEPENDENCIES, ...down])].map((d) => [
				d,
				{ status: down.includes(d) ? ("down" as const) : ("up" as const) },
			]),
		);
		return { status: "error", details, message: error.serverMessage ?? error.message, ...timing() };
	}
}
