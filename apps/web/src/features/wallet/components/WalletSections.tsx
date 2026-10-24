"use client";

import { useState } from "react";
import { HiOutlineArrowTrendingUp, HiOutlineBanknotes, HiOutlineUserGroup } from "react-icons/hi2";
import { IoEye, IoEyeOff } from "react-icons/io5";
import { Button } from "@repo/ui/button";
import Link from "next/link";
import { LINK_STEP_LABEL } from "@/features/wallet/components/LinkWalletPrompt";
import { useAddUsdcTrustline, useLinkWallet, useUnlinkWallet, useWalletUsdc } from "@/features/wallet/hooks";
import type { WalletSummaryDto } from "@/lib/api/dto";
import { Money } from "@/components/Money";
import { formatMoney, relative } from "@/lib/format";
import { pageRoutes } from "@/lib/routes";
import { USDC_FAUCET_URL, explorerAccountUrl, shortAddress } from "@/lib/stellar/config";
import { useNow } from "@/lib/use-now";

/**
 * Payouts (`WalletSummaryDto`): what groups have paid you, and where payouts go. SAJI holds no
 * balance — each payout goes from the group escrow straight to `payoutAddress`: the primary withdraw
 * destination, else the linked wallet. With neither, payouts wait until one exists.
 */
export function PayoutsCard({ wallet }: { wallet: WalletSummaryDto }) {
	const [hidden, setHidden] = useState(false);
	const to = wallet.payoutAddress;
	return (
		<section className="flex h-full flex-col rounded-[20px] bg-panel p-6 md:p-7">
			<div className="flex items-center justify-between gap-3">
				<div>
					<h5 className="text-base md:text-lg">Paid Out to You</h5>
					<p className="text-xs font-light">Sent straight to your wallet when your round pays out</p>
				</div>
				<button type="button" onClick={() => setHidden((h) => !h)} className="text-lg text-ink-muted" aria-label={hidden ? "Show amount" : "Hide amount"}>
					{hidden ? <IoEyeOff /> : <IoEye />}
				</button>
			</div>
			<p className="mt-3 text-3xl md:text-[40px]">
				{hidden ? "*****" : <Money amount={wallet.totalPaidOut} />} <span className="text-base font-light text-ink-muted md:text-lg">{wallet.asset}</span>
			</p>
			<div className="mt-auto pt-6">
				{to ? (
					<div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-4 py-3 text-xs">
						<span className="min-w-0">
							<span className="block text-ink-muted">Payouts go to {to.source === "destination" ? "your primary address" : "your linked wallet"}</span>
							<span className="font-mono">{shortAddress(to.address)}</span>
						</span>
						<Link href={pageRoutes.dashboardRoutes.WITHDRAW_INFO} className="shrink-0 text-primary underline-offset-4 hover:underline">
							Change
						</Link>
					</div>
				) : (
					<div role="alert" className="animate-drop rounded-xl bg-accent-light px-4 py-3 text-xs text-accent">
						Payouts can&apos;t reach you yet. Link a wallet or{" "}
						<Link href={pageRoutes.dashboardRoutes.WITHDRAW_INFO} className="underline">
							add a payout address
						</Link>{" "}
						— anything due to you waits until you do.
					</div>
				)}
			</div>
		</section>
	);
}

/** The linked Stellar wallet: link (connect → sign → link), its USDC, or disconnect. */
export function LinkedWalletCard({ wallet }: { wallet: WalletSummaryDto }) {
	const link = useLinkWallet();
	const unlink = useUnlinkWallet();
	const trustline = useAddUsdcTrustline();
	const linked = wallet.wallet;
	const { data: usdc } = useWalletUsdc(linked?.publicKey);
	return (
		<section className="flex flex-wrap items-center justify-between gap-4 rounded-[20px] bg-panel px-6 py-5">
			<div className="min-w-0">
				<p className="text-xs font-light md:text-sm">Wallet Address</p>
				{linked ? (
					<>
						<a href={explorerAccountUrl(linked.publicKey)} target="_blank" rel="noreferrer" className="mt-1 block font-mono text-xs break-all hover:text-primary">
							{linked.publicKey}
						</a>
						{usdc &&
							(!usdc.funded ? (
								<p className="mt-1 text-xs text-accent">
									This account isn&apos;t on Stellar Testnet yet — fund it with test XLM (Friendbot) first.
								</p>
							) : usdc.trustline ? (
								<p className="mt-1 text-xs text-ink-muted">
									{formatMoney(usdc.usdc, "USDC")} in this wallet ·{" "}
									<a href={USDC_FAUCET_URL} target="_blank" rel="noreferrer" className="text-primary">
										Get test USDC
									</a>
								</p>
							) : (
								<p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-accent">
									This wallet can&apos;t hold USDC yet.
									<button type="button" onClick={() => trustline.mutate(linked.publicKey)} disabled={trustline.isPending} className="text-primary underline disabled:opacity-50">
										{trustline.isPending ? "Confirm in your wallet…" : "Enable USDC"}
									</button>
								</p>
							))}
					</>
				) : (
					<p className="mt-1 text-xs">No wallet linked yet.</p>
				)}
			</div>
			{linked ? (
				<div className="flex items-center gap-3">
					<span className="rounded-full bg-success-50 px-3 py-1 text-xs text-success-700">Linked · {shortAddress(linked.publicKey)}</span>
					<button type="button" onClick={() => unlink.mutate()} disabled={unlink.isPending} className="text-xs font-medium underline disabled:opacity-50">
						Disconnect
					</button>
				</div>
			) : (
				<Button onClick={() => link.mutate()} isLoading={link.isPending && link.step === "link"} disabled={link.isPending}>
					{LINK_STEP_LABEL[link.step]}
				</Button>
			)}
		</section>
	);
}

/** "Useful Insights" (`WalletSummaryDto.insights`): savings growth, active groups, next payout. */
export function UsefulInsights({ wallet }: { wallet: WalletSummaryDto }) {
	const now = useNow();
	const { insights } = wallet;
	const tiles = [
		{ Icon: HiOutlineArrowTrendingUp, tone: "text-success-700", label: "Saved in the last 30 days", value: formatMoney(insights.savingsGrowth, wallet.asset) },
		{ Icon: HiOutlineUserGroup, tone: "text-primary", label: "Active Groups", value: `${insights.activeGroups} group${insights.activeGroups === 1 ? "" : "s"}` },
		{ Icon: HiOutlineBanknotes, tone: "text-accent", label: "Next Payout", value: insights.nextPayout && now ? relative(insights.nextPayout, now) : "—" },
	];
	return (
		<section>
			<h3 className="text-lg md:text-[26px]">Useful Insights</h3>
			<div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3 md:mt-6 md:gap-4">
				{tiles.map(({ Icon, tone, label, value }) => (
					<div key={label} className="rounded-[20px] bg-panel p-5 md:p-6">
						<span className={`flex h-11 w-11 items-center justify-center rounded-full bg-white ${tone}`}>
							<Icon className="text-lg" />
						</span>
						<p className="mt-4 text-xs font-light md:text-sm">{label}</p>
						<p className="mt-0.5 text-lg md:text-xl">{value}</p>
					</div>
				))}
			</div>
		</section>
	);
}
