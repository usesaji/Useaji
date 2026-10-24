"use client";

import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

const STORAGE_KEY = "saji-session";

/** What sign-in returns: the API's AuthTokensDto, with the expiry turned into a timestamp. */
export interface AuthSession {
	token: string;
	/** Single use: swapped for a new pair at /auth/refresh. */
	refreshToken: string | null;
	/** When `token` lapses (ms since epoch). */
	expiresAt: number | null;
	/** How the person signed in: Google-only accounts have no password to confirm with. */
	method: "password" | "google";
}

interface SessionState {
	token: string | null;
	refreshToken: string | null;
	expiresAt: number | null;
	method: AuthSession["method"] | null;
	/** Set when the session ended on its own (a 401), vs. a deliberate logout. */
	expired: boolean;
	setSession: (session: AuthSession) => void;
	/** A refreshed pair (same person, same sign-in method). */
	rotate: (session: Pick<AuthSession, "token" | "refreshToken" | "expiresAt">) => void;
	clear: () => void;
	expire: () => void;
}

const SIGNED_OUT = { token: null, refreshToken: null, expiresAt: null, method: null };

/** The signed-in session. Persisted so a reload stays signed in. Only tokens are stored here; the
 * account itself is a query (`useAccount`), and wallets keep their own keys (never here). */
export const useSession = create<SessionState>()(
	persist(
		(set) => ({
			...SIGNED_OUT,
			expired: false,
			setSession: ({ token, refreshToken, expiresAt, method }) => set({ token, refreshToken, expiresAt, method, expired: false }),
			rotate: ({ token, refreshToken, expiresAt }) => set({ token, refreshToken, expiresAt }),
			clear: () => set({ ...SIGNED_OUT, expired: false }),
			expire: () => set({ ...SIGNED_OUT, expired: true }),
		}),
		{ name: STORAGE_KEY, storage: createJSONStorage(() => localStorage) },
	),
);

/** The access token if it is still good for at least `marginMs`, else null. */
export function activeToken(marginMs = 0) {
	const { token, expiresAt } = useSession.getState();
	if (!token) return null;
	return expiresAt === null || expiresAt - marginMs > Date.now() ? token : null;
}

// Follow other tabs' sign-in, sign-out and token rotation.
if (typeof window !== "undefined") {
	window.addEventListener("storage", (event) => {
		if (event.key === STORAGE_KEY) void useSession.persist?.rehydrate();
	});
}

/** False on the server and first client render, true once localStorage is read. */
export function useSessionHydrated() {
	return useSyncExternalStore(
		// No `persist` API when localStorage is blocked: the session then lives in memory only.
		(onChange) => useSession.persist?.onFinishHydration(onChange) ?? (() => {}),
		() => useSession.persist?.hasHydrated() ?? true,
		() => false,
	);
}
