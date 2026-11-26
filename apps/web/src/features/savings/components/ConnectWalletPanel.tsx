"use client";

import { Button } from "@repo/ui/button";
import { Card } from "@/components/Cards";
import { LINK_STEP_LABEL } from "@/features/wallet/components/LinkWalletPrompt";
import { useLinkWallet } from "@/features/wallet/hooks";

/**
 * Connect your wallet (v3 screen 13): shown where a linked wallet is required — it becomes the
 * owner of personal savings plans. Linking is the same flow as everywhere (sign, confirm it's you).
 */
export function ConnectWalletPanel({
	purpose = "create a personal savings plan, deposit test USDC, or request a slot takeover",
}: {
	purpose?: string;
}) {
	const link = useLinkWallet();
	return (
		<div className="space-y-5">
			<Card title="Not connected">
				<p>After connecting, review your public address and network before continuing.</p>
			</Card>
			<div>
				<h2 className="text-[26px] font-light md:text-[34px] md:font-normal">Connect your wallet</h2>
				<p className="mt-1 text-xs font-light md:text-sm">Your savings. Your wallet. Your keys.</p>
			</div>
			<section className="rounded-[20px] bg-panel p-5">
				<h3 className="text-base md:text-lg">Connect a Stellar-compatible wallet</h3>
				<p className="mt-2 text-xs md:text-sm">Choose your wallet to {purpose}.</p>
				<Button
					className="mt-5 w-full text-sm lg:text-base"
					onClick={() => link.mutate()}
					isLoading={link.isPending && link.step === "link"}
					disabled={link.isPending}
				>
					{link.step === "idle" ? "Choose wallet" : LINK_STEP_LABEL[link.step]}
				</Button>
			</section>
			<Card tone="lilac" title={<span className="text-primary">Use Stellar Testnet</span>}>
				<p className="text-ink">
					Switch your wallet to Testnet. Keep enough test XLM for network fees. This demo uses test USDC on Testnet, not real funds: the wallet page gets you some.
				</p>
			</Card>
		</div>
	);
}
