"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface WalletState {
	/** Public address of the connected wallet (G…) — never a secret. */
	address: string | null;
	setConnected: (address: string) => void;
	clear: () => void;
}

/**
 * The wallet connected in this browser. Only public data is stored — Saji never holds keys, seed
 * phrases or signing credentials. Persisted so a reload doesn't ask again. The wallet linked to the
 * account is the API's (`GET /wallet`); this is the one that can sign right now.
 */
export const useWalletStore = create<WalletState>()(
	persist(
		(set) => ({
			address: null,
			setConnected: (address) => set({ address }),
			clear: () => set({ address: null }),
		}),
		{ name: "saji-wallet", storage: createJSONStorage(() => localStorage) },
	),
);
