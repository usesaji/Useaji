import { AxiosError, AxiosHeaders, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { updateDb } from "@/mocks/db";
import { nowMs } from "@/mocks/clock";
import { RuleError, tick } from "@/mocks/engine";
import { HttpError, match, type Upload } from "@/mocks/router";
import { userForToken } from "@/mocks/handlers/auth";
import "@/mocks/handlers";

/**
 * Answers the API client's requests in the browser (lib/api/client.ts installs it while the API is
 * mocked). Same envelope, status codes and error bodies as the Railway API. Before each request
 * the engine catches up to "now" — the scanner and the other members act — so state moves on its
 * own between visits.
 */

const wait = (min = 200, max = 550) => new Promise((resolve) => setTimeout(resolve, min + Math.random() * (max - min)));

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
	const query = { ...(config.params as Record<string, string | undefined>) };
	const form = config.data instanceof FormData ? await readForm(config.data) : {};
	const body =
		typeof config.data === "string" ? safeJson(config.data) : config.data instanceof FormData ? form : (config.data ?? {});

	try {
		const found = match(method, path);
		if (!found) throw new HttpError(404, "NOT_FOUND", `Cannot ${method} ${path}`);
		const { route, params } = found;

		const result = updateDb((db) => {
			const at = nowMs();
			tick(db, at);
			const bearer = String(config.headers?.Authorization ?? "").replace(/^Bearer /, "");
			const user = route.auth === false ? null : userForToken(db, bearer, at);
			if (route.auth !== false && !user) throw new HttpError(401, "UNAUTHORIZED", "Unauthorized");
			return route.handler({ db, at, now: new Date(at).toISOString(), user: user!, params, query, body, form });
		});

		const status = route.status ?? (method === "POST" ? 201 : 200);
		return respond(config, status, { data: result ?? null, statusCode: status, message: route.message });
	} catch (error) {
		const failure =
			error instanceof HttpError
				? error
				: error instanceof RuleError
					? new HttpError(error.status, error.code, error.message)
					: new HttpError(500, "INTERNAL_SERVER_ERROR", error instanceof Error ? error.message : "Internal server error");
		if (failure.status === 500) console.error("[mock api]", method, path, error);
		const data = {
			statusCode: failure.status,
			code: failure.code,
			message: failure.message,
			...(failure.details ? { details: failure.details } : {}),
			requestId: crypto.randomUUID(),
			timestamp: new Date().toISOString(),
			path: `/v1${path}`,
		};
		const response = respond(config, failure.status, data);
		throw new AxiosError(failure.message, AxiosError.ERR_BAD_REQUEST, config, null, response);
	}
}

function respond(config: InternalAxiosRequestConfig, status: number, data: unknown): AxiosResponse {
	return {
		data,
		status,
		statusText: String(status),
		headers: new AxiosHeaders({ "content-type": "application/json" }),
		config,
		request: null,
	};
}

function safeJson(text: string) {
	try {
		return JSON.parse(text) as unknown;
	} catch {
		return {};
	}
}

/** Multipart → plain fields; images downscaled to 640px so they fit in localStorage. */
async function readForm(data: FormData) {
	const fields: Record<string, string | Upload> = {};
	for (const [key, value] of data.entries()) {
		fields[key] = typeof value === "string" ? value : await toUpload(value);
	}
	return fields;
}

async function toUpload(file: File): Promise<Upload> {
	const dataUrl = file.type.startsWith("image/") ? await downscale(file, 640) : await asDataUrl(file);
	return { name: file.name, type: file.type, size: file.size, dataUrl };
}

const asDataUrl = (file: Blob) =>
	new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result));
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(file);
	});

async function downscale(file: File, max: number) {
	try {
		const bitmap = await createImageBitmap(file);
		const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
		const canvas = document.createElement("canvas");
		canvas.width = Math.round(bitmap.width * scale);
		canvas.height = Math.round(bitmap.height * scale);
		canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
		return canvas.toDataURL("image/webp", 0.82);
	} catch {
		return asDataUrl(file);
	}
}
