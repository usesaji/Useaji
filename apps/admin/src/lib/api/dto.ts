import type { components } from "./schema";

/** The Railway API's DTOs the console uses, by name (`schema.d.ts` is generated: `pnpm --filter admin api:types`). */
type S = components["schemas"];

export type AuthTokensDto = S["AuthTokensDto"];
export type MeDto = S["MeDto"];
export type UserSummaryDto = S["UserSummaryDto"];
export type Role = UserSummaryDto["role"];

/** One audit log entry. `id` is an increasing integer. Unknown `action` values show as raw text. */
export type AuditLogDto = S["AuditLogDto"];

/** `GET /health` on 200. A down dependency answers 503 with an error body instead. */
export type HealthDto = S["HealthDto"];

/** What the console shows for health: the 200 body, or what a 503's message names as down. */
export interface HealthView {
	status: "ok" | "error";
	details: Record<string, { status: "up" | "down" }>;
	/** The 503's message, e.g. "Unavailable: redis". */
	message?: string;
	checkedAt: number;
	latencyMs: number;
}
