"use client";

import { useSyncExternalStore } from "react";

/**
 * "Where to go after signing in": `?next=/groups/create`. Only same-app paths are honoured
 * (no `//host`, no auth pages), so a crafted link can't bounce someone to another site.
 */
export function safeNextPath(value: string | null | undefined): string | null {
	if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
	if (value.startsWith("/auth")) return null;
	return value;
}

/** The current page's `next`, if it's safe. For event handlers — in render, use `useNextPath`. */
export function currentNextPath(): string | null {
	if (typeof window === "undefined") return null;
	return safeNextPath(new URLSearchParams(window.location.search).get("next"));
}

/** `path` with `next` attached (when there is one). */
export function appendNext(path: string, next: string | null): string {
	if (!next) return path;
	return `${path}${path.includes("?") ? "&" : "?"}next=${encodeURIComponent(next)}`;
}

/** Carries the current page's `next` on to another auth page. For event handlers. */
export function withNext(path: string): string {
	return appendNext(path, currentNextPath());
}

const noSubscription = () => () => {};

/** The current `next` for rendering: null on the server and first paint, then the real value. */
export function useNextPath() {
	return useSyncExternalStore(noSubscription, currentNextPath, () => null);
}
