"use client";

import { Button } from "@repo/ui/button";
import { useAccount } from "@/features/auth/hooks";
import { useLinkWallet } from "@/features/wallet/hooks";

export const LINK_STEP_LABEL = { idle: "Connect Wallet", connect: "Choose your wallet…", sign: "Sign in your wallet…", confirm: "Confirm it's you…", link: "Linking…" } as const;

/**
 * Shown while the account has no linked wallet. Linking is the gate for every money action —
 * contributing, paying a missed contribution, receiving payouts — so it's surfaced up front and
 * disappears once a wallet is linked.
 */
export function LinkWalletPrompt() {
	const { data: account, isLoading } = useAccount();
	const link = useLinkWallet();
	if (isLoading || account?.wallet) return null;

	return (
		<section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-primary-light p-4 md:p-6">
			<div className="min-w-0">
				<h5 className="font-medium md:text-lg">Connect a wallet to get started</h5>
				<p className="mt-1 text-sm font-light text-ink-muted">
					Link your Stellar wallet to contribute and receive payouts. You stay in control of your funds — Saji never holds your keys.
				</p>
			</div>
			<Button onClick={() => link.mutate()} isLoading={link.isPending && link.step === "link"} disabled={link.isPending}>
				{LINK_STEP_LABEL[link.step]}
			</Button>
		</section>
	);
}
