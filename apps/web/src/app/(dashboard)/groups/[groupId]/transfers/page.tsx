"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@repo/ui/button";
import { QueryState } from "@repo/ui/query-state";
import { Card, TwoColumns } from "@/components/Cards";
import { PageHeader } from "@/components/PageHeader";
import { useAccount } from "@/features/auth/hooks";
import { contributions, firstOf, personName } from "@/features/slots/copy";
import { Handover, TakeoverPill } from "@/features/slots/components/SlotUi";
import { useSlotTransfers } from "@/features/slots/hooks";
import type { SlotTakeoverDto } from "@/lib/api/dto";
import { formatMoney, longDate, shortDate } from "@/lib/format";
import { pageRoutes } from "@/lib/routes";
import { explorerTxUrl, shortAddress, STELLAR_NETWORK_LABEL } from "@/lib/stellar/config";

/**
 * Slot transfer history (v3 screen 07): the permanent record of ownership changes in a group. Each
 * completed transfer shows who to whom, the ownership record, the slot's preserved history and the
 * Soroban receipt; open and closed requests are listed below.
 */
export default function SlotTransfersPage() {
	const { groupId } = useParams<{ groupId: string }>();
	const r = pageRoutes.dashboardRoutes;
	const transfers = useSlotTransfers(groupId);
	const { data: account } = useAccount();
	const me = account?.id ?? null;
	const all = transfers.data?.results ?? [];
	const done = all.filter((t) => t.status === "transferred");
	const others = all.filter((t) => t.status !== "transferred");

	return (
		<div className="w-full space-y-8 pb-10">
			<PageHeader
				title="Slot transfer history"
				subtitle="A permanent record of ownership changes."
				back
				backHref={r.CIRCLE(groupId)}
			/>
			<QueryState isLoading={transfers.isLoading} error={transfers.error} onRetry={() => void transfers.refetch()} />
			{transfers.data && all.length === 0 && (
				<Card>
					<p>No slot in this group has changed hands.</p>
				</Card>
			)}
			{done.map((t) => (
				<CompletedTransfer key={t.id} takeover={t} me={me} />
			))}
			{others.length > 0 && (
				<section className="space-y-3">
					<h3 className="text-base md:text-lg">Requests</h3>
					{others.map((t) => (
						<Link
							key={t.id}
							href={r.TAKEOVER(groupId, t.id)}
							className="block rounded-[20px] bg-panel p-5 transition hover:bg-neutral-comment"
						>
							<div className="flex items-start justify-between gap-3">
								<p className="min-w-0 text-sm md:text-base">
									Slot #{t.slotNumber} · <Handover takeover={t} me={me} />
								</p>
								<TakeoverPill status={t.status} />
							</div>
							<p className="mt-2 text-xs font-light text-ink-muted md:text-sm">
								Requested {longDate(t.requestedAt)} · {t.yes} of {t.required} approvals
							</p>
						</Link>
					))}
				</section>
			)}
		</div>
	);
}

function CompletedTransfer({ takeover: t, me }: { takeover: SlotTakeoverDto; me: string | null }) {
	const asset = t.group.asset;
	return (
		<TwoColumns
			main={
				<>
					<Card title="Transfer completed">
						<p>
							{t.group.name} · Slot #{t.slotNumber} of {t.group.totalRounds}
						</p>
						<p>
							{personName(t.from, me)} → {personName(t.to, me)}
						</p>
						<p>
							{longDate(t.transferredAt)} · {t.yes} of {t.eligible} members approved
						</p>
					</Card>
					<Card title="Preserved slot history">
						{t.history.length === 0 ? (
							<p>No contributions recorded yet.</p>
						) : (
							t.history.map((h, i) => (
								<p key={`${h.kind}-${h.at}-${i}`}>
									{shortDate(h.at)} ·{" "}
									{h.kind === "contribution"
										? `${formatMoney(h.amount, asset)} contributed by ${firstOf(h.member, me)}`
										: h.scheduled
											? `Payout of ${formatMoney(h.amount, asset)} scheduled`
											: `Payout of ${formatMoney(h.amount, asset)} to ${firstOf(h.member, me)}`}
								</p>
							))
						)}
					</Card>
				</>
			}
			side={
				<>
					<Card title="Ownership record">
						<p>Current owner · {personName(t.to, me)}</p>
						<p>Previous owner · {personName(t.from, me)}</p>
						<p>
							Remaining · {contributions(t.terms.remainingContributions)} / {formatMoney(t.terms.remainingAmount, asset)}
						</p>
					</Card>
					<Card tone="lilac" title="Transaction receipt">
						<p>Network · {STELLAR_NETWORK_LABEL}</p>
						<p>Soroban slot transfer · Confirmed</p>
						<p>Transaction · {t.txHash ? shortAddress(t.txHash) : "Simulated"}</p>
					</Card>
					{t.txHash && (
						<Button asChild variant="soft" className="w-full text-sm lg:text-base">
							<a href={explorerTxUrl(t.txHash)} target="_blank" rel="noopener noreferrer">
								View transaction on explorer
							</a>
						</Button>
					)}
				</>
			}
		/>
	);
}
