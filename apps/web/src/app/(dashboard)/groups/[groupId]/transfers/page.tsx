"use client";

import { useParams } from "next/navigation";
import { HiArrowTopRightOnSquare } from "react-icons/hi2";
import { QueryState } from "@repo/ui/query-state";
import { Card, TwoColumns } from "@/components/Cards";
import { LinkButton } from "@/components/LinkButton";
import { PageHeader } from "@/components/PageHeader";
import { useAccount } from "@/features/auth/hooks";
import { useGroup } from "@/features/groups/hooks";
import { contributions, personName, priceLabel, slotLabel } from "@/features/slots/copy";
import { useSlotTransfers } from "@/features/slots/hooks";
import type { SlotTransferDto } from "@/lib/api/dto";
import { formatMoney, longDate } from "@/lib/format";
import { pageRoutes } from "@/lib/routes";
import { explorerContractUrl, shortAddress, SLOT_REGISTRY_CONTRACT, STELLAR_NETWORK_LABEL } from "@/lib/stellar/config";

/**
 * Slot transfer history (v3 screen 07), members only: each completed transfer — who to whom, the
 * price, the round it moved in, what the seller had paid in (`paidBySeller`), the slot's payout
 * once its round paid out, and the transaction on Stellar.
 */
export default function SlotTransfersPage() {
	const { groupId } = useParams<{ groupId: string }>();
	const r = pageRoutes.dashboardRoutes;
	const transfers = useSlotTransfers(groupId);
	const group = useGroup(groupId);
	const { data: account } = useAccount();
	const me = account?.id ?? null;
	const asset = group.data?.asset ?? "USDC";
	const all = transfers.data ?? [];

	return (
		<div className="w-full space-y-8 pb-10">
			<PageHeader title="Slot transfer history" subtitle="A permanent record of ownership changes." back backHref={r.CIRCLE(groupId)} />
			<QueryState isLoading={transfers.isLoading} error={transfers.error} onRetry={() => void transfers.refetch()} />
			{transfers.data && (
				<TwoColumns
					main={
						<>
							{all.length === 0 && (
								<Card>
									<p>No slot has changed hands in this group yet.</p>
								</Card>
							)}
							{all.map((t, i) => (
								<TransferRecord key={t.id} transfer={t} me={me} asset={asset} index={i} />
							))}
						</>
					}
					side={
						<>
							<Card tone="lilac" title="History stays with whoever paid">
								<p>Contributions and payouts keep the name of the member who made or received them. A transfer moves only the position.</p>
								<p>If the seller had already paid the open round, the buyer starts paying from the next one.</p>
							</Card>
							<Card title="On Stellar">
								<p>Network · {STELLAR_NETWORK_LABEL}</p>
								<p>Slot registry · {shortAddress(SLOT_REGISTRY_CONTRACT)}</p>
								<a href={explorerContractUrl(SLOT_REGISTRY_CONTRACT)} target="_blank" rel="noopener noreferrer" className="inline-block text-primary">
									View the registry on the explorer
								</a>
							</Card>
							<LinkButton href={r.MARKETPLACE} variant="soft" className="w-full text-sm lg:text-base">
								Slot marketplace
							</LinkButton>
						</>
					}
				/>
			)}
		</div>
	);
}

function TransferRecord({ transfer: t, me, asset, index }: { transfer: SlotTransferDto; me: string | null; asset: string; index: number }) {
	return (
		<section className="animate-rise space-y-4 rounded-[20px] bg-panel p-5" style={{ "--i": index } as React.CSSProperties}>
			<div className="flex items-start justify-between gap-3">
				<h3 className="text-base md:text-lg">
					{personName(t.from, me)} → {personName(t.to, me)}
				</h3>
				<span className="shrink-0 text-xs font-light text-ink-muted md:text-sm">{longDate(t.transferredAt)}</span>
			</div>
			<div className="space-y-2 text-xs font-light text-ink-muted md:text-sm">
				<p>
					{slotLabel(t.position)} · moved in round {t.effectiveRound + 1} · {priceLabel(t.price, asset)}
				</p>
				<p>
					Paid in by {personName(t.from, me)} before the transfer · {contributions(t.paidBySeller.rounds)} ·{" "}
					{formatMoney(t.paidBySeller.amount, asset)}
				</p>
				<p>
					{t.payout
						? `Payout · ${formatMoney(t.payout.amount, asset)} to ${personName(t.payout.recipient, me)} on ${longDate(t.payout.paidAt)}`
						: `Payout · still ahead, in round ${t.position + 1}`}
				</p>
			</div>
			<div className="flex flex-wrap gap-x-4 gap-y-2 text-xs md:text-sm">
				{t.txUrl && (
					<a href={t.txUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-primary">
						Transfer on Stellar <HiArrowTopRightOnSquare />
					</a>
				)}
				{t.payout?.txUrl && (
					<a href={t.payout.txUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-primary">
						Payout on Stellar <HiArrowTopRightOnSquare />
					</a>
				)}
			</div>
		</section>
	);
}
