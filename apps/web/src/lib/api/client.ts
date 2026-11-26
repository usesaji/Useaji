"use client";

import axios, { type AxiosRequestConfig, type InternalAxiosRequestConfig } from "axios";
import type { PageMeta } from "@repo/ui/pager";
import { activeToken, useSession } from "@/features/auth/session";
import { USE_MOCK_API } from "@/lib/api/source";
import type { AuthTokensDto } from "@/lib/api/dto";

/**
 * Saji API client (Railway: docs/openapi.json, Swagger at …/docs). The browser calls this app's
 * `/api/v1` proxy (next.config.ts), so CORS never applies. While the API is mocked
 * (`lib/api/source.ts`), a mock adapter answers every request in the browser instead
 * (`src/mocks/adapter.ts`), with the same envelopes, status codes and error bodies.
 *
 * Success bodies are `{ statusCode, message, data }`: the helpers return `data`. Lists put
 * `{ results, paginationMeta }` in `data` (`Page<T>`). Errors are `{ statusCode, code, message,
 * details?, requestId }` → `ApiError`. Access tokens refresh on their own (single-use refresh
 * tokens, one rotation at a time across tabs).
 */
export const API_URL = process.env.NEXT_PUBLIC_API_URL || `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/v1`;

declare module "axios" {
	interface AxiosRequestConfig {
		/** Public route (log in, sign up, refresh…): no bearer token, and a 401 doesn't end the session. */
		anonymous?: boolean;
		/**
		 * The body carries a password (or Google token) the API checks: a 401 means that check failed,
		 * not the session — so it neither refreshes nor signs out (wallet changes, password change).
		 */
		credentialCheck?: boolean;
	}
	interface InternalAxiosRequestConfig {
		/** Already replayed once after a refresh. */
		replayed?: boolean;
	}
}

/** An API failure with a user-readable message and the backend's `code` when it sends one. */
export class ApiError extends Error {
	constructor(
		message: string,
		readonly status: number | undefined,
		readonly code?: string,
		readonly details?: unknown,
		/** The API's `requestId`, for support. */
		readonly requestId?: string,
	) {
		super(message);
	}
}

/** `paginationMeta` of a list response (the shared pager renders it). */
export type { PageMeta };

/** A paginated `data`: `{ results, paginationMeta }`. */
export interface Page<T> {
	results: T[];
	paginationMeta: PageMeta;
}

interface Envelope<T> {
	statusCode: number;
	message: string;
	data: T;
}

interface ErrorBody {
	code?: string;
	message?: string | string[];
	details?: unknown;
	requestId?: string;
}

/** Refresh slightly early so a request never leaves with a token about to lapse. */
const REFRESH_MARGIN_MS = 30_000;

const http = axios.create({ baseURL: API_URL, timeout: 30_000 });

if (USE_MOCK_API) {
	// Loaded lazily so the mock (and its seed data) never ships in a live build's first chunk.
	http.defaults.adapter = async (config) => (await import("@/mocks/adapter")).mockAdapter(config);
}

http.interceptors.request.use(async (config) => {
	if (config.anonymous) return config;
	const { token, refreshToken } = useSession.getState();
	let bearer = activeToken(REFRESH_MARGIN_MS);
	if (!bearer && token && refreshToken) {
		bearer = await refreshSession(token);
		// The session just ended (the store is marked expired): don't send the request at all.
		if (!bearer) throw new ApiError("Your session has expired. Please sign in again.", 401, "UNAUTHORIZED");
	}
	bearer ??= activeToken();
	if (bearer) config.headers.Authorization = `Bearer ${bearer}`;
	return config;
});

http.interceptors.response.use(undefined, async (error) => {
	// Text and file responses carry their error body as text / a Blob: parse it so `code` survives.
	if (axios.isAxiosError(error) && error.response) {
		const raw: unknown = error.response.data;
		if (raw instanceof Blob) error.response.data = safeJson(await raw.text().catch(() => ""));
		else if (typeof raw === "string") error.response.data = safeJson(raw);
	}
	const config = axios.isAxiosError(error) ? (error.config as InternalAxiosRequestConfig | undefined) : undefined;
	const sent = config?.headers.Authorization;
	// A signed-in request rejected as unauthenticated: refresh once and replay it. Safe even for
	// writes, because a 401 is refused before anything runs. If that fails, the session is over.
	if (config && !config.anonymous && !config.credentialCheck && error.response?.status === 401 && typeof sent === "string") {
		const fresh =
			!config.replayed && useSession.getState().refreshToken ? await refreshSession(sent.replace(/^Bearer /, "")) : null;
		if (fresh) {
			config.replayed = true;
			config.headers.Authorization = `Bearer ${fresh}`;
			return http(config);
		}
		useSession.getState().expire();
	}
	throw toApiError(error);
});

let refreshing: Promise<string | null> | null = null;

/**
 * Swaps the refresh token for a new pair and returns the access token (null = the session is over
 * and the store is marked expired). Refresh tokens are single-use and replaying a spent one revokes
 * the whole session family, so one refresh runs at a time: per tab through the shared promise,
 * across tabs through a Web Lock. A tab that waited adopts what another tab rotated.
 */
export function refreshSession(stale: string | null): Promise<string | null> {
	refreshing ??= withRefreshLock(() => rotateTokens(stale)).finally(() => {
		refreshing = null;
	});
	return refreshing;
}

function withRefreshLock<T>(run: () => Promise<T>): Promise<T> {
	return typeof navigator !== "undefined" && navigator.locks
		? (navigator.locks.request("saji-session-refresh", run) as Promise<T>)
		: run();
}

async function rotateTokens(stale: string | null) {
	await useSession.persist?.rehydrate();
	const { refreshToken } = useSession.getState();
	if (!refreshToken) return null;
	const current = activeToken(REFRESH_MARGIN_MS);
	if (current && current !== stale) return current;
	try {
		const dto = await apiPost<AuthTokensDto>("/auth/refresh", { refreshToken }, { anonymous: true });
		useSession.getState().rotate(toSession(dto));
		return dto.accessToken;
	} catch (error) {
		if (error instanceof ApiError && (error.status === 401 || error.status === 400)) {
			useSession.getState().expire();
			return null;
		}
		throw error;
	}
}

/** AuthTokensDto → the session's token fields. */
export function toSession(dto: AuthTokensDto) {
	return { token: dto.accessToken, refreshToken: dto.refreshToken, expiresAt: Date.now() + dto.expiresIn * 1000 };
}

function safeJson(text: string) {
	try {
		return JSON.parse(text) as unknown;
	} catch {
		return text;
	}
}

function toApiError(error: unknown) {
	if (error instanceof ApiError || !axios.isAxiosError(error)) return error;
	const status = error.response?.status;
	const body = error.response?.data as ErrorBody | undefined;
	const raw = Array.isArray(body?.message) ? body.message[0] : body?.message;
	// The generic rate limit gets our wording; a limit the API explains (the faucet's hourly one) keeps its own.
	if (status === 429) {
		const own = raw && !/throttler|too many requests/i.test(raw) ? raw : null;
		return new ApiError(own ?? rateLimitMessage(error.response?.headers["retry-after"]), status, body?.code);
	}
	// Validation failures carry the field messages in `details`; the first one says more than "Validation failed".
	const detail = Array.isArray(body?.details) && typeof body.details[0] === "string" ? body.details[0] : undefined;
	const message =
		status && status < 500 && typeof raw === "string"
			? raw === "Validation failed" && detail
				? capitalize(detail)
				: raw
			: status
				? "Something went wrong on our side. Please try again."
				: "Can’t reach Saji — check your connection.";
	return new ApiError(message, status, body?.code, body?.details, body?.requestId);
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** `Retry-After` is in seconds. */
function rateLimitMessage(retryAfter: unknown) {
	const seconds = Number(retryAfter);
	const minutes = Math.ceil(seconds / 60);
	const wait =
		!Number.isFinite(seconds) || seconds <= 0
			? "a moment"
			: seconds < 60
				? `${Math.ceil(seconds)} seconds`
				: `${minutes} minute${minutes === 1 ? "" : "s"}`;
	return `Too many attempts. Please wait ${wait} and try again.`;
}

/** Drops empty filters so they aren't sent as `?status=`. */
function clean(params?: object) {
	if (!params) return undefined;
	return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ""));
}

/* Each helper unwraps the envelope and returns `data`. */

export async function apiGet<T>(url: string, params?: object, config?: AxiosRequestConfig) {
	const { data } = await http.get<Envelope<T>>(url, { ...config, params: clean(params) });
	return data.data;
}

export async function apiPost<T>(url: string, body?: unknown, config?: AxiosRequestConfig) {
	const { data } = await http.post<Envelope<T> | "">(url, body ?? {}, config);
	return (data === "" ? undefined : data?.data) as T;
}

export async function apiPut<T>(url: string, body?: unknown, config?: AxiosRequestConfig) {
	const { data } = await http.put<Envelope<T>>(url, body ?? {}, config);
	return data.data;
}

export async function apiPatch<T>(url: string, body?: unknown) {
	const { data } = await http.patch<Envelope<T>>(url, body ?? {});
	return data.data;
}

/** `body` for the deletes that take one (`DELETE /wallet` re-authenticates). */
export async function apiDelete<T = null>(url: string, body?: unknown, config?: AxiosRequestConfig) {
	const { data } = await http.delete<Envelope<T>>(url, { ...config, data: body });
	return data?.data;
}

/** `multipart/form-data` (avatar and cover uploads, group creation). */
export async function apiForm<T>(method: "post" | "put", url: string, form: FormData) {
	const { data } = await http.request<Envelope<T>>({ method, url, data: form });
	return data.data;
}
